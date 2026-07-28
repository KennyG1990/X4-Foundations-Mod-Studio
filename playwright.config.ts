import { defineConfig, devices } from '@playwright/test';
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
// Per-run state dir: unique-ish per process start; OS temp cleanup owns the leftovers.
const E2E_STATE_DIR = path.join(os.tmpdir(), `x4forge-e2e-state-${process.pid}`);
// B41: 127.0.0.1 EVERYWHERE, never "localhost" — vite binds whichever family
// "localhost" resolves to at boot (varies per run on Windows), while Playwright's
// request context resolves localhost to ::1 and does NOT fall back. A mismatched
// draw refuses every API call (reproduced 2026-07-15: ECONNREFUSED ::1:3100 failed
// all 19 tests). Same class as vite.config's proxy 127.0.0.1 comment.
const E2E_BASE_URL = process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${E2E_WEB_PORT}`;

const ephemeralEnv = {
  STUDIO_API_TOKEN: E2E_TOKEN,
  API_PORT: String(E2E_API_PORT),
  // The e2e stack already starts a standalone Vite process below. Keep server.ts
  // API-only so it never starts a second embedded Vite/HMR server (port 24678).
  API_ONLY: 'true',
  X4_STATE_DIR: E2E_STATE_DIR,
  // Deterministic pages: no HMR socket, no watcher-triggered reloads mid-spec.
  DISABLE_HMR: 'true',
  // B93.1: the ephemeral stack must NOT publish its port into the user's real ~/.x4forge.
  // Observed for real: a harness published, exited, and left a record advertising a dead port —
  // which is worse than no discovery file at all, because a caller trusts it.
  X4FORGE_DISCOVERY_DIR: path.join(E2E_STATE_DIR, 'discovery'),
};

export default defineConfig({
  testDir: './tests/e2e',
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
      // Own the real long-lived Node process directly. `npx` adds a wrapper process on
      // Windows, which can exit independently and leave Playwright with no useful reason
      // when the child server disappears mid-suite.
      command: 'node node_modules/tsx/dist/cli.mjs server.ts',
      url: `http://127.0.0.1:${E2E_API_PORT}/api/agent/schema`,
      reuseExistingServer: false,
      timeout: 120_000,
      stdout: 'pipe',
      stderr: 'pipe',
      env: { ...ephemeralEnv, PORT: String(E2E_API_PORT) },
    },
    {
      command: `node node_modules/vite/bin/vite.js --host 127.0.0.1 --port ${E2E_WEB_PORT} --strictPort`,
      url: `http://127.0.0.1:${E2E_WEB_PORT}`,
      reuseExistingServer: false,
      timeout: 120_000,
      stdout: 'pipe',
      stderr: 'pipe',
      env: ephemeralEnv,
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
