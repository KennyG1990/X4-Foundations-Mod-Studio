#!/usr/bin/env node
/**
 * Boots an isolated Forge API, runs the complete runtime-discovered oracle sweep,
 * and always tears the server down. This keeps the oracle gate independent of a
 * developer's already-running Forge process.
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
// B93.1: never publish discovery records into the real user profile from a test harness.
const discoveryDirForTests = path.join(os.tmpdir(), `x4-oracle-discovery-${process.pid}`);

const port = Number(process.env.ORACLE_TEST_PORT || 8972);
const base = `http://127.0.0.1:${port}`;
const tmp = path.join(os.tmpdir(), `x4-oracle-int-${process.pid}`);
const stateDir = path.join(tmp, 'state');
const dataDir = path.join(tmp, 'data');
fs.mkdirSync(stateDir, { recursive: true });
fs.mkdirSync(dataDir, { recursive: true });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function killTree(pid) {
  if (!pid) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
    return;
  }
  try { process.kill(-pid, 'SIGKILL'); }
  catch { try { process.kill(pid, 'SIGKILL'); } catch { /* already gone */ } }
}

let server;
let exitCode = 1;
let serverOutput = '';

try {
  const tsxCli = path.join(process.cwd(), 'node_modules', 'tsx', 'dist', 'cli.mjs');
  server = spawn(process.execPath, [tsxCli, 'server.ts'], {
    cwd: process.cwd(),
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env, X4FORGE_DISCOVERY_DIR: discoveryDirForTests,
      PORT: String(port),
      NODE_ENV: 'development',
      X4_STATE_DIR: stateDir,
      X4_DATA_DIR: dataDir,
    },
  });
  server.stdout.on('data', (chunk) => { serverOutput += chunk; });
  server.stderr.on('data', (chunk) => { serverOutput += chunk; });

  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    await sleep(500);
    try {
      const response = await fetch(`${base}/api/agent/schema`);
      if (response.status > 0) { ready = true; break; }
    } catch { /* keep polling */ }
  }
  if (!ready) throw new Error(`isolated server did not become ready\n${serverOutput.slice(-1000)}`);

  const sweep = spawnSync(process.execPath, ['scripts/oracle-sweep.mjs'], {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: { ...process.env, X4_FORGE_BASE: base },
  });
  exitCode = sweep.status ?? 1;
  if (exitCode !== 0) {
    try {
      const aggregate = await fetch(`${base}/api/agent/selftest`);
      const body = await aggregate.json();
      console.error('[oracle-integration] aggregate /agent/selftest detail:');
      console.error(JSON.stringify(body, null, 2));
      const mdAudit = await fetch(`${base}/api/agent/md-audit`);
      const mdAuditBody = await mdAudit.json();
      console.error('[oracle-integration] md-audit findings:');
      console.error(JSON.stringify(mdAuditBody?.findings ?? mdAuditBody, null, 2));
    } catch (error) {
      console.error(`[oracle-integration] could not read aggregate detail: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
} catch (error) {
  console.error(`[oracle-integration] ${error instanceof Error ? error.message : String(error)}`);
} finally {
  killTree(server?.pid);
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* best effort */ }
}

process.exit(exitCode);
