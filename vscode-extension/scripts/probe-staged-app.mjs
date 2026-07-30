#!/usr/bin/env node

import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const extensionRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const appRoot = path.join(extensionRoot, 'app');
const serverPath = path.join(appRoot, 'dist', 'server.cjs');
const supervisorPath = path.join(extensionRoot, 'out', 'sidecar-supervisor.js');
const port = Number(process.env.X4_STAGED_PROBE_PORT || 8982);
const base = `http://127.0.0.1:${port}`;
const token = `staged-app-probe-${process.pid}`;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'x4forge-staged-probe-'));
const configuredReferenceRoot = process.env.X4_REFERENCE_ROOT?.trim();
const localReferenceRoot = 'F:\\Downskies\\x4unpackersuiteV1\\X4 unpacked 9.00';
let referenceRoot = configuredReferenceRoot || localReferenceRoot;
let fixtureReference = false;
if (!fs.existsSync(path.join(referenceRoot, 'libraries'))) {
  fixtureReference = true;
  referenceRoot = path.join(tmp, 'reference');
  const libraries = path.join(referenceRoot, 'libraries');
  fs.mkdirSync(libraries, { recursive: true });
  fs.writeFileSync(path.join(libraries, 'factions.xml'), '<factions><faction id="ci_probe_faction" name="CI Probe Faction" tags="economic"/></factions>');
  fs.writeFileSync(path.join(libraries, 'wares.xml'), '<wares><ware id="ci_probe_ware" name="CI Probe Ware" group="test" tags="economy"/></wares>');
  fs.writeFileSync(path.join(libraries, 'scriptproperties.xml'), '<scriptproperties><datatype name="faction"><property name="id" result="ID" type="string"/></datatype></scriptproperties>');
}
const canonicalReference = !fixtureReference
  && fs.existsSync(path.join(referenceRoot, 'extensions', 'ego_dlc_split'))
  && fs.existsSync(path.join(referenceRoot, 'extensions', 'ego_dlc_timelines'));
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

function pidAlive(pid) {
  if (!pid) return false;
  try { process.kill(pid, 0); return true; }
  catch (error) { return error?.code === 'EPERM'; }
}

async function waitForExit(processHandle, timeoutMs) {
  if (!processHandle || processHandle.exitCode !== null || processHandle.signalCode !== null) return true;
  return await new Promise(resolve => {
    const timer = setTimeout(() => resolve(false), timeoutMs);
    processHandle.once('exit', () => { clearTimeout(timer); resolve(true); });
  });
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
let child;
let output = '';
try {
  check('staged server exists', fs.existsSync(serverPath), serverPath);
  if (!fs.existsSync(serverPath)) throw new Error('staged server missing');
  check('packaged supervisor exists', fs.existsSync(supervisorPath), supervisorPath);
  if (!fs.existsSync(supervisorPath)) throw new Error('sidecar supervisor missing');
  const parentNonce = 'a'.repeat(64);
  const discoveryDir = path.join(tmp, 'discovery');
  child = spawn(process.execPath, [supervisorPath, serverPath], {
    cwd: appRoot,
    shell: false,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(port),
      STUDIO_API_TOKEN: token,
      X4_STATE_DIR: path.join(tmp, 'state'),
      X4_DATA_DIR: path.join(tmp, 'data'),
      X4_CONFIG_DIR: path.join(tmp, 'config'),
      X4_REFERENCE_ROOT: referenceRoot,
      X4_XSD_PATH: path.join(referenceRoot, 'libraries'),
      X4FORGE_DISCOVERY_DIR: discoveryDir,
      X4_FORGE_PARENT_MODE: 'pipe-v1',
      X4_FORGE_PARENT_PID: String(process.pid),
      X4_FORGE_PARENT_NONCE: parentNonce,
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

  if (canonicalReference) {
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
      && !completion.some(item => item.label === 'riptide'),
    `status=${completionResponse.status} count=${Array.isArray(completion) ? completion.length : 'n/a'} root=${referenceRoot}`);
  } else {
    const fixtureResponse = await fetch(`${base}/api/reference/factions`);
    const factions = await fixtureResponse.json();
    check('staged reference API reaches hermetic CI corpus', fixtureResponse.ok && Array.isArray(factions)
      && factions.length === 1 && factions[0]?.id === 'ci_probe_faction',
    `status=${fixtureResponse.status} count=${Array.isArray(factions) ? factions.length : 'n/a'} root=${referenceRoot}`);
  }

  const supervisedPid = Number(/X4FORGE_SUPERVISED_PID=(\d+)/.exec(output)?.[1] || 0);
  check('supervisor reports exact owned server pid', supervisedPid > 0 && pidAlive(supervisedPid), String(supervisedPid));
  check('claimed parent pid is alive before orphan drill', pidAlive(process.pid), String(process.pid));
  child.stdin.end();
  const gracefulExit = await waitForExit(child, 3000);
  check('parent pipe loss exits supervised staged sidecar', gracefulExit && !pidAlive(supervisedPid), `supervisorExit=${child.exitCode} serverPid=${supervisedPid}`);
  check('live claimed parent pid cannot preserve orphan', pidAlive(process.pid), String(process.pid));
  const instanceRecord = path.join(discoveryDir, 'instances', `${supervisedPid}.json`);
  let latestPid = 0;
  try { latestPid = JSON.parse(fs.readFileSync(path.join(discoveryDir, 'latest.json'), 'utf8')).pid; } catch { /* absent is clean */ }
  check('graceful orphan exit removes discovery', !fs.existsSync(instanceRecord) && latestPid !== supervisedPid, `record=${fs.existsSync(instanceRecord)} latestPid=${latestPid}`);

  const invalidEnv = { ...process.env };
  delete invalidEnv.X4_FORGE_PARENT_MODE;
  delete invalidEnv.X4_FORGE_PARENT_PID;
  delete invalidEnv.X4_FORGE_PARENT_NONCE;
  const invalid = spawnSync(process.execPath, [supervisorPath, serverPath], {
    cwd: appRoot, env: invalidEnv, encoding: 'utf8', windowsHide: true,
  });
  check('invalid parent contract refuses before spawn', invalid.status === 64 && /refusing to spawn/.test(invalid.stderr || ''), `status=${invalid.status}`);

  const stubbornPath = path.join(tmp, 'stubborn-child.cjs');
  fs.writeFileSync(stubbornPath, 'setInterval(() => {}, 1000);');
  let stubbornOutput = '';
  const stubborn = spawn(process.execPath, [supervisorPath, stubbornPath], {
    cwd: tmp,
    shell: false,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      X4_FORGE_PARENT_MODE: 'pipe-v1',
      X4_FORGE_PARENT_PID: String(process.pid),
      X4_FORGE_PARENT_NONCE: 'b'.repeat(64),
    },
  });
  stubborn.stdout.on('data', chunk => { stubbornOutput += chunk; });
  stubborn.stderr.on('data', chunk => { stubbornOutput += chunk; });
  let stubbornPid = 0;
  for (let attempt = 0; attempt < 30 && !stubbornPid; attempt++) {
    await sleep(50);
    stubbornPid = Number(/X4FORGE_SUPERVISED_PID=(\d+)/.exec(stubbornOutput)?.[1] || 0);
  }
  check('stubborn fixture was spawned by supervisor', stubbornPid > 0 && pidAlive(stubbornPid), String(stubbornPid));
  stubborn.stdin.end();
  const stubbornExit = await waitForExit(stubborn, 3500);
  check('supervisor force reaps pipe-ignorant owned child', stubbornExit && !pidAlive(stubbornPid), `supervisorExit=${stubborn.exitCode} childPid=${stubbornPid}`);
  check('force reap never kills claimed parent pid', pidAlive(process.pid), String(process.pid));
} catch (error) {
  check('probe completed without exception', false, error instanceof Error ? error.message : String(error));
} finally {
  killTree(child?.pid);
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* best effort */ }
}

const passed = checks.filter(item => item.pass).length;
console.log(`[staged-app-probe] ${passed}/${checks.length} ${passed === checks.length ? 'PASS' : 'FAIL'}`);
process.exit(checks.length > 0 && passed === checks.length ? 0 : 1);
