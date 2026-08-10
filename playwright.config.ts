import { defineConfig, devices } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * B31s2 (2026-07-12): e2e runs against an EPHEMERAL Forge stack — its own Vite (3100),
 * its own API (3101), its own bearer token, and a per-run temp state dir. The user's
 * live dev stack (3000/3001) and workspace are untouched BY CONSTRUCTION, which retires
 * the workspace-guard snapshot/restore and every page.route isolation harness the old
 * shared-server model required (the half-isolation behind incident classes B15, #70,
 * and the 07-12 suppression interplay).
 */
export const E2E_WEB_PORT = 3100;
export const E2E_API_PORT = 3101;
export const E2E_TOKEN = 'x4forge-e2e-ephemeral-token';
export const E2E_VITE_ENV = {
  API_PORT: String(E2E_API_PORT),
  STUDIO_API_TOKEN: E2E_TOKEN,
  DISABLE_HMR: 'true',
} as const;
// Per-run state dir: unique-ish per process start; OS temp cleanup owns the leftovers.
const E2E_STATE_DIR = path.join(os.tmpdir(), `x4forge-e2e-state-${process.pid}`);
// B41: 127.0.0.1 EVERYWHERE, never "localhost" — vite binds whichever family
// "localhost" resolves to at boot (varies per run on Windows), while Playwright's
// request context resolves localhost to ::1 and does NOT fall back. A mismatched
// draw refuses every API call (reproduced 2026-07-15: ECONNREFUSED ::1:3100 failed
// all 19 tests). Same class as vite.config's proxy 127.0.0.1 comment.
const E2E_BASE_URL = process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${E2E_WEB_PORT}`;

/**
 * Mutable directory settings stay in E2E_STATE_DIR, but canonical game data is a
 * read-only test input and must remain available to corpus-backed diagnostics. Resolve
 * it before X4_CONFIG_DIR is redirected. An explicit environment value wins; the
 * repository's machine-local config may name the root directly or name its libraries
 * directory as the schema source.
 */
function resolveE2eReferenceRoot(): string | undefined {
  const candidates: string[] = [];
  if (process.env.X4_REFERENCE_ROOT?.trim()) candidates.push(process.env.X4_REFERENCE_ROOT.trim());
  try {
    const configured = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'config.json'), 'utf8')) as {
      x4ReferenceRoot?: string;
      xsdSchemaPath?: string;
    };
    if (configured.x4ReferenceRoot?.trim()) candidates.push(configured.x4ReferenceRoot.trim());
    if (configured.xsdSchemaPath?.trim() && path.basename(configured.xsdSchemaPath).toLowerCase() === 'libraries') {
      candidates.push(path.dirname(configured.xsdSchemaPath));
    }
  } catch { /* an unconfigured machine fails corpus-dependent tests honestly */ }
  candidates.push(path.join(process.cwd(), 'data', 'x4-unpacked'));
  return candidates.map(candidate => path.resolve(candidate)).find(candidate => {
    try { return fs.statSync(candidate).isDirectory(); } catch { return false; }
  });
}

const E2E_REFERENCE_ROOT = resolveE2eReferenceRoot();

const ephemeralEnv = {
  STUDIO_API_TOKEN: E2E_TOKEN,
  API_PORT: String(E2E_API_PORT),
  // The Playwright global setup starts Vite through its JS API. Keep server.ts API-only
  // so it never starts a second embedded Vite/HMR server (port 24678).
  API_ONLY: 'true',
  X4_STATE_DIR: E2E_STATE_DIR,
  // Config is mutable API state too. Keep schema/directory writes inside the same
  // per-run sandbox so a failed test can never strand the installed Forge on a
  // deleted temporary workspace.
  X4_CONFIG_DIR: E2E_STATE_DIR,
  ...(E2E_REFERENCE_ROOT ? { X4_REFERENCE_ROOT: E2E_REFERENCE_ROOT } : {}),
  // Deterministic pages: no HMR socket, no watcher-triggered reloads mid-spec.
  DISABLE_HMR: 'true',
  // B93.1: the ephemeral stack must NOT publish its port into the user's real ~/.x4forge.
  // Observed for real: a harness published, exited, and left a record advertising a dead port —
  // which is worse than no discovery file at all, because a caller trusts it.
  X4FORGE_DISCOVERY_DIR: path.join(E2E_STATE_DIR, 'discovery'),
};

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: path.resolve(process.cwd(), 'test-results', 'e2e'),
  globalSetup: './tests/e2e/global-setup.ts',
  // ONE worker still: specs share the ONE ephemeral server's active workspace.
  // (Per-worker servers would allow parallelism later — ports would need to shard.)
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: E2E_BASE_URL,
    trace: 'retain-on-failure',
    // Existing specs exercise the full studio. B37's focused spec removes this key to
    // prove the newcomer default; keeping the suite explicit avoids mode-dependent tests.
    storageState: {
      cookies: [],
      origins: [{ origin: E2E_BASE_URL, localStorage: [{ name: 'x4_forge_experience_mode', value: 'expert' }] }],
    },
  },
  webServer: [
    {
      // Keep the API server isolated under Playwright's existing webServer process owner.
      // The UI server is intentionally started by global setup through the Vite JS API;
      // Playwright's webServer command path uses shell:true and is not a direct Vite owner.
      command: 'node node_modules/tsx/dist/cli.mjs server.ts',
      url: `http://127.0.0.1:${E2E_API_PORT}/api/agent/schema`,
      reuseExistingServer: false,
      timeout: 120_000,
      stdout: 'pipe',
      stderr: 'pipe',
      env: { ...ephemeralEnv, PORT: String(E2E_API_PORT) },
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
