#!/usr/bin/env node

import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const extensionRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const appRoot = path.join(extensionRoot, 'app');
const serverPath = path.join(appRoot, 'dist', 'server.cjs');
const referenceRoot = process.env.X4_REFERENCE_ROOT || 'F:\\Downskies\\x4unpackersuiteV1\\X4 unpacked 9.00';
const port = Number(process.env.X4_STAGED_PROBE_PORT || 8982);
const base = `http://127.0.0.1:${port}`;
const token = `staged-app-probe-${process.pid}`;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'x4forge-staged-probe-'));
const checks = [];
const check = (name, pass, detail = '') => {
  checks.push({ name, pass: Boolean(pass), detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`);
};

function killTree(pid) {
  if (!pid) return;
  if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
  else {
    try { process.kill(-pid, 'SIGKILL'); }
    catch { try { process.kill(pid, 'SIGKILL'); } catch { /* already stopped */ } }
  }
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
let child;
let output = '';
try {
  check('staged server exists', fs.existsSync(serverPath), serverPath);
  if (!fs.existsSync(serverPath)) throw new Error('staged server missing');
  child = spawn(process.execPath, [serverPath], {
    cwd: appRoot,
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(port),
      STUDIO_API_TOKEN: token,
      X4_STATE_DIR: path.join(tmp, 'state'),
      X4_DATA_DIR: path.join(tmp, 'data'),
      X4_REFERENCE_ROOT: referenceRoot,
      X4_XSD_PATH: path.join(referenceRoot, 'libraries'),
    },
  });
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.on('data', chunk => { output += chunk; });

  let ready = false;
  for (let attempt = 0; attempt < 80; attempt++) {
    await sleep(250);
    try {
      const response = await fetch(`${base}/api/reference/status`);
      if (response.ok) { ready = true; break; }
    } catch { /* keep polling */ }
  }
  check('staged sidecar boots', ready, ready ? '' : output.slice(-500));
  if (!ready) throw new Error('staged sidecar did not become ready');

  const page = await fetch(`${base}/`).then(response => response.text());
  check('production UI serves injected session token', /__STUDIO_API_TOKEN__/.test(page));
  const unauthConfig = await fetch(`${base}/api/schema/config`);
  check('directory config remains protected', unauthConfig.status === 401, String(unauthConfig.status));
  const configResponse = await fetch(`${base}/api/schema/config`, { headers: auth });
  const config = await configResponse.json();
  check('authenticated directory config loads', configResponse.ok && config.resolved?.x4ReferenceExists === true, JSON.stringify(config.resolved || config));

  const completionResponse = await fetch(`${base}/api/reference/complete`, {
    method: 'POST', headers: auth,
    body: JSON.stringify({
      path: 'md/probe.xml',
      content: '<mdscript><cues><cue name="Probe"><actions><set_value name="$x" exact="faction."/></actions></cue></cues></mdscript>',
      line: 0,
      column: 79,
    }),
  });
  const completion = await completionResponse.json();
  check('staged completion reaches canonical corpus', completionResponse.ok && Array.isArray(completion)
    && completion.length === 32 && completion.some(item => item.label === 'fallensplit')
    && !completion.some(item => item.label === 'riptide'), `status=${completionResponse.status} count=${Array.isArray(completion) ? completion.length : 'n/a'}`);
} catch (error) {
  check('probe completed without exception', false, error instanceof Error ? error.message : String(error));
} finally {
  killTree(child?.pid);
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* best effort */ }
}

const passed = checks.filter(item => item.pass).length;
console.log(`[staged-app-probe] ${passed}/${checks.length} ${passed === checks.length ? 'PASS' : 'FAIL'}`);
process.exit(checks.length > 0 && passed === checks.length ? 0 : 1);
