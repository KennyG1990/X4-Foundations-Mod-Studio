/**
 * B31s2 — helpers for the EPHEMERAL e2e stack (see playwright.config.ts).
 *
 * Specs seed the ephemeral server's workspace directly over its API and then let the
 * app adopt it naturally on page load — no page.route interception, no localStorage
 * version pinning, no restore/teardown. The live dev stack is never touched.
 */
import { randomBytes } from 'node:crypto';
import { ACTION_OPERATION_ID_HEADER, createActionOperationId } from '../../shared/actionOperationId';
import { E2E_API_PORT, E2E_TOKEN } from '../../playwright.config';

// B41: 127.0.0.1, never "localhost" — the API binds IPv4-only (server.ts listen)
// and resolver family order varies per run on Windows (see playwright.config note).
const API = `http://127.0.0.1:${E2E_API_PORT}`;
const CLIENT_ID = 'client_e2e_fixture_0001';
let workspaceIdPromise: Promise<string> | null = null;

async function fetchEphemeral(input: string, init?: RequestInit): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try { return await fetch(input, init); }
    catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise(resolve => setTimeout(resolve, 150 * (attempt + 1)));
    }
  }
  throw lastError;
}

async function fixtureWorkspaceId(): Promise<string> {
  if (!workspaceIdPromise) {
    workspaceIdPromise = (async () => {
      const res = await fetchEphemeral(`${API}/api/agent/workspaces/bootstrap`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${E2E_TOKEN}`, 'Content-Type': 'application/json', 'x-client-id': CLIENT_ID },
        body: JSON.stringify({ clientId: CLIENT_ID }),
      });
      const data = await res.json();
      if (!res.ok || !data?.workspaceId) throw new Error(`ephemeral bootstrap failed: ${res.status} ${JSON.stringify(data)}`);
      return String(data.workspaceId);
    })();
  }
  return workspaceIdPromise;
}

async function workspaceHeaders(json = false): Promise<Record<string, string>> {
  return {
    Authorization: `Bearer ${E2E_TOKEN}`,
    'x-client-id': CLIENT_ID,
    'x-workspace-id': await fixtureWorkspaceId(),
    ...(json ? { 'Content-Type': 'application/json' } : {}),
  };
}

export async function ephemeralWorkspaceHeaders(json = false): Promise<Record<string, string>> {
  return workspaceHeaders(json);
}

/** Force-set the ephemeral server's active workspace (deliberate overwrite by design). */
export async function seedServerWorkspace(workspace: unknown): Promise<void> {
  const headers = {
    ...(await workspaceHeaders(true)),
    [ACTION_OPERATION_ID_HEADER]: createActionOperationId(randomBytes),
  };
  const res = await fetchEphemeral(`${API}/api/agent/workspace`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ workspace, force: true }),
  });
  if (!res.ok) throw new Error(`ephemeral seed failed: ${res.status} ${await res.text()}`);
}

/** Read the ephemeral server's active workspace (for assertions on synced state). */
export async function readServerWorkspace(): Promise<any> {
  const res = await fetchEphemeral(`${API}/api/agent/workspace`, {
    headers: await workspaceHeaders(),
  });
  if (!res.ok) throw new Error(`ephemeral read failed: ${res.status}`);
  const data = await res.json();
  return data.workspace;
}

/** Read the full CAS envelope when a UI test needs to emulate a server-side transaction. */
export async function readServerWorkspaceEnvelope(): Promise<any> {
  const res = await fetchEphemeral(`${API}/api/agent/workspace`, {
    headers: await workspaceHeaders(),
  });
  if (!res.ok) throw new Error(`ephemeral envelope read failed: ${res.status}`);
  return res.json();
}

/** Persist Studio shell preferences in the isolated server state root. */
export async function seedServerLayout(layout: unknown): Promise<void> {
  const res = await fetchEphemeral(`${API}/api/studio/layout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${E2E_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ layout }),
  });
  if (!res.ok) throw new Error(`ephemeral layout seed failed: ${res.status} ${await res.text()}`);
}

export async function readServerLayout(): Promise<any> {
  const res = await fetchEphemeral(`${API}/api/studio/layout`, {
    headers: { Authorization: `Bearer ${E2E_TOKEN}` },
  });
  if (!res.ok) throw new Error(`ephemeral layout read failed: ${res.status} ${await res.text()}`);
  return (await res.json()).layout;
}
