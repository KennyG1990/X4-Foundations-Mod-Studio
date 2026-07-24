#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const port = Number(process.env.REFERENCE_MANIFEST_API_TEST_PORT || 8974);
const base = `http://127.0.0.1:${port}`;
const token = `reference-manifest-api-${process.pid}`;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'x4-reference-manifest-api-'));
const root = path.join(tmp, 'corpus');
const stateDir = path.join(tmp, 'state');
const dataDir = path.join(tmp, 'data');
const configDir = path.join(tmp, 'config');
for (const dir of [root, stateDir, dataDir, configDir]) fs.mkdirSync(dir, { recursive: true });

const write = (rel, content = '<root/>') => {
  const file = path.join(root, ...rel.split('/'));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
};
write('libraries/common.xsd', '<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema"/>');
write('libraries/md.xsd', '<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema"/>');
write('ui/core/addon.xsd', '<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema"/>');
write('libraries/factions.xml', '<factions><faction id="argon"/></factions>');
write('libraries/wares.xml', '<wares><ware id="energycells"/></wares>');
write('libraries/scriptproperties.xml', '<scriptproperties/>');
write('md/example.xml', '<mdscript/>');
write('extensions/ego_dlc_test/libraries/wares.xml', '<diff/>');
write('extensions/ego_dlc_test/libraries/md.xsd', '<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema"><xs:element name="dlc_only"/></xs:schema>');
write('extensions/community_mod/libraries/wares.xml', '<diff/>');
write('assets/sound.ogg', 'sound');

const checks = [];
const check = (name, pass, detail = '') => {
  checks.push({ name, pass: !!pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`);
};
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const request = route => fetch(base + route);
function killTree(pid) {
  if (!pid) return;
  if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
  else { try { process.kill(-pid, 'SIGKILL'); } catch { try { process.kill(pid, 'SIGKILL'); } catch {} } }
}
async function waitForCoverage(timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    const response = await request('/api/reference/coverage');
    last = { response, body: await response.json() };
    if (response.status === 200 && last.body?.status?.state === 'ready') return last;
    await sleep(100);
  }
  return last;
}

let server;
let output = '';
try {
  const tsxCli = path.join(process.cwd(), 'node_modules', 'tsx', 'dist', 'cli.mjs');
  server = spawn(process.execPath, [tsxCli, 'server.ts'], {
    cwd: process.cwd(), shell: false, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: String(port), NODE_ENV: 'development', STUDIO_API_TOKEN: token,
      X4_STATE_DIR: stateDir, X4_DATA_DIR: dataDir, X4_CONFIG_DIR: configDir,
      X4_REFERENCE_ROOT: root, X4_XSD_PATH: path.join(root, 'libraries') },
  });
  server.stdout.on('data', chunk => { output += chunk; });
  server.stderr.on('data', chunk => { output += chunk; });
  let ready = false;
  for (let attempt = 0; attempt < 80; attempt++) {
    await sleep(250);
    try { if ((await request('/api/reference/status')).ok) { ready = true; break; } } catch {}
  }
  check('isolated server ready', ready, ready ? '' : output.slice(-800));
  if (!ready) throw new Error('server did not become ready');

  const first = await request('/api/reference/coverage');
  check('first coverage request starts scan', first.status === 202, String(first.status));
  const coverageResult = await waitForCoverage();
  const coverage = coverageResult?.body?.coverage;
  check('coverage becomes ready', coverageResult?.response?.status === 200, JSON.stringify(coverageResult?.body?.status));
  check('all fixture files discovered', coverage?.totalFiles === 11, String(coverage?.totalFiles));
  check('coverage classifies grammar', coverage?.byRole?.some(row => row.key === 'grammar' && row.count === 4));
  check('coverage exposes unconsumed gaps', coverage?.byConsumer?.some(row => row.key === 'unconsumed' && row.count > 0));

  const schemasResponse = await request('/api/reference/manifest?extension=xsd&limit=9999');
  const schemas = await schemasResponse.json();
  check('manifest filters schema files', schemasResponse.status === 200 && schemas.total === 4 && schemas.files.every(file => file.role === 'grammar'));
  check('manifest response is bounded', schemas.limit === 500, String(schemas.limit));
  const dlc = await request('/api/reference/manifest?source=ego_dlc_test').then(response => response.json());
  check('official DLC provenance retained', dlc.total === 2 && dlc.files.every(file => ['canonical', 'deterministic'].includes(file.authority)));
  const community = await request('/api/reference/manifest?source=community_mod').then(response => response.json());
  check('third-party extension stays advisory', community.total === 1 && community.files[0]?.authority === 'advisory');
  check('manifest and coverage are public read-only', (await request('/api/reference/manifest?limit=1')).status === 200 && (await request('/api/reference/coverage')).status === 200);
  const canonicalStatus = await request('/api/reference/status?refresh=1').then(response => response.json());
  check('reference corpus consumes complete manifest generation', canonicalStatus.manifestGeneration === coverage.generation, String(canonicalStatus.manifestGeneration));
  const registry = await request('/api/agent/schema-registry?domain=md').then(response => response.json());
  const mdDomain = registry.domains?.find(domain => domain.domain === 'md');
  check('schema registry selects base and shadows DLC variant', mdDomain?.shadowedCopies === 1 && /[\\/]libraries[\\/]md\.xsd$/i.test(mdDomain.file) && registry.domains?.some(domain => domain.domain === 'addon'), JSON.stringify(mdDomain));

  write('extensions/ego_dlc_new/md/new.xml', '<mdscript/>');
  const refresh = await request('/api/reference/coverage?refresh=1');
  check('refresh serves old generation while scanning', refresh.status === 200 || refresh.status === 202, String(refresh.status));
  const refreshed = await waitForCoverage();
  check('DLC addition appears after refresh', refreshed?.body?.coverage?.totalFiles === 12, String(refreshed?.body?.coverage?.totalFiles));
  fs.unlinkSync(path.join(root, 'extensions', 'ego_dlc_new', 'md', 'new.xml'));
  await request('/api/reference/coverage?refresh=1');
  const removed = await waitForCoverage();
  check('DLC removal appears after refresh', removed?.body?.coverage?.totalFiles === 11, String(removed?.body?.coverage?.totalFiles));
} catch (error) {
  check('harness completed without exception', false, error instanceof Error ? error.message : String(error));
} finally {
  killTree(server?.pid);
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
}

const passed = checks.filter(item => item.pass).length;
console.log(`[reference-manifest-api] ${passed}/${checks.length} ${passed === checks.length ? 'PASS' : 'FAIL'}`);
process.exit(checks.length > 0 && passed === checks.length ? 0 : 1);
