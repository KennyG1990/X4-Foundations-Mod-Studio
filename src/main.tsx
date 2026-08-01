import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App, { type WorkspacePollingResponse } from './App.tsx';
import './index.css';
import { toast } from './lib/uiDialogs';
import { clientRequestDeadlineMs, createAbortDeadline, timeoutError } from './lib/requestDeadline';

// Calibration L4: route any native alert() — legacy or stray — to a non-blocking in-app
// toast. Native alert/confirm/prompt freeze the renderer; confirm/prompt are converted to
// in-app async modals at their call sites (see uiDialogs: confirmDialog/promptDialog).
try {
  window.alert = (msg?: unknown) => toast(String(msg ?? ''));
} catch { /* non-writable in some envs */ }

declare global {
  interface Window {
    __STUDIO_API_TOKEN__?: string;
    __X4_WORKSPACE_CONTEXT__?: {
      clientId: string;
      getWorkspaceId(): string;
      selectWorkspace(workspaceId: string): void;
    };
  }
}

const injectedToken = window.__STUDIO_API_TOKEN__;
if (injectedToken) {
  sessionStorage.setItem('studio_session_token', injectedToken);
}

// Override fetch globally before rendering the app safely.
const originalFetch = window.fetch;
const CLIENT_ID_KEY = 'x4forge_client_id';
const WORKSPACE_ID_KEY = 'x4forge_workspace_id';
function generateClientId(): string {
  if (typeof crypto?.randomUUID === 'function') return `client_${crypto.randomUUID().replace(/-/g, '')}`;
  if (typeof crypto?.getRandomValues === 'function') {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return `client_${Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('')}`;
  }
  return `client_${Date.now().toString(36)}_${Math.random().toString(36).slice(2).padEnd(12, '0')}`;
}
const generatedClientId = generateClientId();
const clientId = sessionStorage.getItem(CLIENT_ID_KEY) || generatedClientId;
sessionStorage.setItem(CLIENT_ID_KEY, clientId);
window.__X4_WORKSPACE_CONTEXT__ = {
  clientId,
  getWorkspaceId: () => sessionStorage.getItem(WORKSPACE_ID_KEY) || '',
  selectWorkspace: (workspaceId: string) => {
    if (!/^ws_[a-f0-9]{24}$/i.test(workspaceId)) throw new Error('Refused malformed workspaceId.');
    sessionStorage.setItem(WORKSPACE_ID_KEY, workspaceId);
  },
};

// H3 boot-race: Vite (3000) starts proxying before the tsx API (3001) finishes
// transpiling server.ts (~2-3s), so early /api calls hit the proxy's soft 503
// ("API server is restarting") or a transient connection error. We transparently
// retry — but ONLY idempotent /api GETs, with a small capped backoff. Mutations
// (POST/PUT/PATCH/DELETE) are NEVER auto-retried (could double-apply a change).
const API_BOOT_BACKOFFS_MS = [200, 350, 500, 650]; // ~1.7s total, within the boot window
const delay = (ms: number, signal?: AbortSignal) => new Promise<void>((resolve, reject) => {
  if (signal?.aborted) return reject(signal.reason);
  const timer = setTimeout(() => {
    signal?.removeEventListener('abort', onAbort);
    resolve();
  }, ms);
  const onAbort = () => {
    clearTimeout(timer);
    reject(signal?.reason);
  };
  signal?.addEventListener('abort', onAbort, { once: true });
});

function methodOf(input: RequestInfo | URL, init?: RequestInit): string {
  const m = init?.method || (typeof input === 'object' && input instanceof Request ? input.method : undefined) || 'GET';
  return m.toUpperCase();
}

const customFetch = async function(this: any, input: RequestInfo | URL, init?: RequestInit) {
  const url = typeof input === 'string' ? input : (input instanceof URL ? input.href : input.url);
  // Security: only attach the session token to SAME-ORIGIN /api/ requests. A bare
  // url.includes('/api/') would leak the bearer token to any future cross-origin URL
  // that happens to contain '/api/' (a plugin/analytics script). Resolve against the
  // app origin and require both same-origin AND an /api/ path prefix.
  let isApi = false;
  let isWorkspaceBootstrap = false;
  try {
    const u = new URL(url, location.origin);
    isApi = u.origin === location.origin && u.pathname.startsWith('/api/');
    isWorkspaceBootstrap = u.origin === location.origin && u.pathname === '/api/agent/workspaces/bootstrap';
  } catch { isApi = false; } // unparseable URL → never treat as our API
  const deadlineMs = clientRequestDeadlineMs(input, location.origin);
  const upstreamSignal = init?.signal || (input instanceof Request ? input.signal : undefined);
  const deadline = deadlineMs === null ? null : createAbortDeadline(upstreamSignal, deadlineMs);
  if (deadline) init = { ...init, signal: deadline.signal };

  try {
    if (isApi) {
      const token = sessionStorage.getItem('studio_session_token');
      const headers = new Headers(input instanceof Request ? input.headers : undefined);
      new Headers(init?.headers).forEach((value, key) => headers.set(key, value));
      if (token) headers.set('Authorization', `Bearer ${token}`);
      headers.set('x-client-id', clientId);
      const workspaceId = window.__X4_WORKSPACE_CONTEXT__?.getWorkspaceId() || '';
      if (workspaceId) headers.set('x-workspace-id', workspaceId);
      init = { ...init, headers };
    }

    // Fast path: anything that isn't an idempotent /api GET goes straight through.
    if (!isApi || (methodOf(input, init) !== 'GET' && !isWorkspaceBootstrap)) {
      return originalFetch.call(this, input, init);
    }

    // Bounded retry for the API boot/restart window only.
    for (let attempt = 0; ; attempt++) {
      try {
        const res = await originalFetch.call(this, input, init);
        if (res.status === 503 && attempt < API_BOOT_BACKOFFS_MS.length) {
          await delay(API_BOOT_BACKOFFS_MS[attempt], init?.signal);
          continue;
        }
        return res;
      } catch (err) {
        // Transient connection error (API socket not up yet) — retry within budget.
        if (attempt < API_BOOT_BACKOFFS_MS.length) {
          await delay(API_BOOT_BACKOFFS_MS[attempt], init?.signal);
          continue;
        }
        throw err;
      }
    }
  } catch (error) {
    if (deadline?.didTimeout()) throw timeoutError(deadlineMs!);
    throw error;
  } finally {
    deadline?.release();
  }
};

try {
  Object.defineProperty(window, 'fetch', {
    value: customFetch,
    writable: true,
    configurable: true,
    enumerable: true
  });
} catch {
  try {
    window.fetch = customFetch;
  } catch (err) {
    console.warn('Failed to intercept window.fetch safely:', err);
  }
}

async function bootstrapAndRender(): Promise<void> {
  const attempt = async (workspaceId: string) => {
    const response = await window.fetch('/api/agent/workspaces/bootstrap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, ...(workspaceId ? { workspaceId } : {}) }),
    });
    const body = await response.json();
    return { response, body };
  };
  let selected = window.__X4_WORKSPACE_CONTEXT__?.getWorkspaceId() || '';
  let boot = await attempt(selected);
  if (!boot.response.ok && selected && ['WORKSPACE_NOT_FOUND', 'WORKSPACE_ID_INVALID'].includes(String(boot.body?.code || ''))) {
    sessionStorage.removeItem(WORKSPACE_ID_KEY);
    selected = '';
    boot = await attempt('');
  }
  if (!boot.response.ok || !boot.body?.workspaceId) {
    throw new Error(boot.body?.error || `Workspace bootstrap failed (${boot.response.status}).`);
  }
  window.__X4_WORKSPACE_CONTEXT__?.selectWorkspace(String(boot.body.workspaceId));
  const bootstrapWorkspace: WorkspacePollingResponse = {
    workspaceId: String(boot.body.workspaceId),
    workspace: boot.body.workspace,
    version: Number(boot.body.version),
    workspaceHash: String(boot.body.workspaceHash || ''),
  };
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App bootstrapWorkspace={bootstrapWorkspace} />
    </StrictMode>,
  );
}

void bootstrapAndRender().catch(error => {
  const root = document.getElementById('root');
  if (root) root.textContent = `X4 Forge could not open a workspace: ${error instanceof Error ? error.message : String(error)}`;
});
