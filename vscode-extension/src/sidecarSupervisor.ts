/**
 * Standalone parent-death supervisor for the managed Forge sidecar.
 *
 * It intentionally does not import VS Code. The extension host owns this process through stdin;
 * this process owns exactly one server child. Parent PID is diagnostic only—pipe closure is the
 * authority, so PID reuse can never keep the server alive or cause an unrelated process to die.
 */

import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import path from 'node:path';

const MODE = 'pipe-v1';
const NONCE_PATTERN = /^[a-f0-9]{32,128}$/i;
const GRACE_MS = 750;

function validContract(): boolean {
  const pid = Number(process.env.X4_FORGE_PARENT_PID);
  return process.env.X4_FORGE_PARENT_MODE === MODE
    && Number.isSafeInteger(pid)
    && pid > 0
    && NONCE_PATTERN.test(String(process.env.X4_FORGE_PARENT_NONCE || ''));
}

function forceKillOwnedTree(child: ChildProcess): void {
  if (!child.pid || child.exitCode !== null || child.signalCode !== null) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    return;
  }
  try { process.kill(-child.pid, 'SIGKILL'); }
  catch { try { process.kill(child.pid, 'SIGKILL'); } catch { /* already gone */ } }
}

function fail(message: string, code: number): never {
  console.error(`[sidecar-supervisor] ${message}`);
  process.exit(code);
}

if (!validContract()) fail('invalid or missing pipe-v1 parent contract; refusing to spawn an unowned server.', 64);

const [serverArg, ...nodeArgs] = process.argv.slice(2);
if (!serverArg) fail('missing server entrypoint.', 64);
const serverPath = path.resolve(serverArg);

const server = spawn(process.execPath, [...nodeArgs, serverPath], {
  cwd: process.cwd(),
  env: process.env,
  stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  windowsHide: true,
  detached: process.platform !== 'win32',
});
console.log(`[sidecar-supervisor] X4FORGE_SUPERVISED_PID=${server.pid || 0}`);
server.stdout?.pipe(process.stdout);
server.stderr?.pipe(process.stderr);

let shuttingDown = false;
let forceTimer: ReturnType<typeof setTimeout> | null = null;
let failsafeTimer: ReturnType<typeof setTimeout> | null = null;

function beginShutdown(reason: string, signalChild: boolean): void {
  if (shuttingDown) return;
  shuttingDown = true;
  console.error(`[sidecar-supervisor] ${reason}; waiting ${GRACE_MS} ms for owned server ${server.pid || 0} to exit.`);
  if (server.connected) {
    try {
      server.send({ type: 'x4forge-parent-lost', nonce: process.env.X4_FORGE_PARENT_NONCE });
    } catch { /* force fallback below */ }
  } else if (signalChild) {
    try { server.kill('SIGTERM'); } catch { /* force fallback below */ }
  }
  forceTimer = setTimeout(() => {
    forceKillOwnedTree(server);
    failsafeTimer = setTimeout(() => process.exit(1), 1500);
    failsafeTimer.unref();
  }, GRACE_MS);
  forceTimer.unref();
}

process.stdin.once('end', () => beginShutdown('parent pipe ended', false));
process.stdin.once('close', () => beginShutdown('parent pipe closed', false));
process.stdin.once('error', () => beginShutdown('parent pipe errored', false));
process.stdin.resume();

for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
  process.once(signal, () => beginShutdown(`supervisor received ${signal}`, true));
}

server.once('error', error => fail(`server spawn failed: ${error.message}`, 1));
server.once('exit', (code, signal) => {
  if (forceTimer) clearTimeout(forceTimer);
  if (failsafeTimer) clearTimeout(failsafeTimer);
  console.error(`[sidecar-supervisor] owned server exited (code=${code ?? 'null'}, signal=${signal ?? 'none'}).`);
  process.exit(code ?? (signal ? 1 : 0));
});

process.once('exit', () => forceKillOwnedTree(server));
