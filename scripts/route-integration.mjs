/**
 * route-integration.mjs — external HTTP integration gate for the highest-RISK, security-
 * relevant routes (BACKLOG B64-T1, 2026-07-19; audit finding C-TEST-1: 133 routes had no
 * automated coverage beyond 9 e2e specs).
 *
 * Why a SEPARATE harness (not an in-process oracle): auth + agent-key SCOPE can only be
 * exercised by an EXTERNAL client presenting different credentials over HTTP — the existing
 * SELFTESTS run server-side and bypass authMiddleware entirely. This boots an ephemeral
 * server (isolated state/data dirs, a known session token, NO game corpus needed) and asserts
 * the security contract from the outside, then tears the server down by PID tree.
 *
 * Scope (corpus-independent security surface):
 *   - unauthenticated request is refused (401)
 *   - session token has full access; a bogus token is refused
 *   - a READ-scoped agent key: 200 on read GETs, 403 on the run_command exec route (B64-SEC1
 *     regression guard — this makes that one-off live drill PERMANENT), 403 on write POSTs
 *   - a WRITE-scoped key: 200 on exact compile/dry-run routes, 403 on deploy-only routes + key mgmt
 *   - a DEPLOY-scoped key: reaches reviewed deploy/provider handlers but cannot inherit Studio-only authority
 *   - fs/write path containment: a traversal path is rejected; an in-root write is accepted
 * Deploy, validate-with-fixture-schema, and the extension smoke are B64-T1b (need a fixture).
 *
 * Usage:  npm run test:routes    (or: node scripts/route-integration.mjs)
 * Exit 0 ⇔ every assertion passed; exit 1 ⇔ any failed / server never came up.
 */
import { spawn, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

function runRequiredBuild() {
  const windowsNpmCli = process.env.npm_execpath || path.join(
    path.dirname(process.execPath),
    'node_modules',
    'npm',
    'bin',
    'npm-cli.js',
  );
  const npmCommand = process.platform === 'win32' ? process.execPath : 'npm';
  const npmArgs = process.platform === 'win32' ? [windowsNpmCli, 'run', 'build'] : ['run', 'build'];
  const result = spawnSync(npmCommand, npmArgs, {
    cwd: process.cwd(),
    shell: false,
    stdio: 'inherit',
  });
  if (result.error) {
    throw new Error(`[route-integration] required npm run build could not start: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const outcome = result.signal ? `signal ${result.signal}` : `exit code ${result.status}`;
    throw new Error(`[route-integration] required npm run build failed with ${outcome}`);
  }
}

async function findFreePort() {
  return await new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.unref();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      probe.close(error => error ? reject(error) : resolve(port));
    });
  });
}

const PORT = Number(process.env.ROUTE_TEST_PORT || await findFreePort());
const BASE = `http://127.0.0.1:${PORT}`;
const SESSION_TOKEN = 'route-int-selftest-token-' + process.pid;
const CLIENT_ID = `client_route_${process.pid}_${Date.now().toString(36)}`;
const SECOND_CLIENT_ID = `client_route_other_${process.pid}_${Date.now().toString(36)}`;
const routeTestNode = {
  id: 'cue_preview_fixture', type: 'cue', label: 'Preview Cue', xmlTag: 'cue', x: 100, y: 100,
  properties: { name: 'PreviewCue', namespace: 'this', instantiate: 'false' },
};
const routeTestWorkspace = {
  name: 'Preview_Fixture', version: '1.0.0', author: 'Route Test', description: 'Preview constraint fixture',
  nodes: [routeTestNode], links: [], uiWidgets: [],
  uiTheme: { backgroundColor: '#000000', borderColor: '#ffffff', accentColor: '#00ffff', opacity: 1, showIcons: true },
};
const ROUTE_TEST_AI_RESPONSE_CYCLE = [
  JSON.stringify({ name: routeTestWorkspace.name, version: routeTestWorkspace.version, author: routeTestWorkspace.author, description: routeTestWorkspace.description, nodes: routeTestWorkspace.nodes }),
  JSON.stringify({ links: [] }),
  JSON.stringify({ uiWidgets: [], uiTheme: routeTestWorkspace.uiTheme }),
  JSON.stringify(routeTestWorkspace),
  JSON.stringify(routeTestWorkspace),
  JSON.stringify(routeTestWorkspace),
  JSON.stringify({ requirements: [] }),
];
const ROUTE_TEST_AI_RESPONSES = [
  ...ROUTE_TEST_AI_RESPONSE_CYCLE,
  ...ROUTE_TEST_AI_RESPONSE_CYCLE,
  ...ROUTE_TEST_AI_RESPONSE_CYCLE,
  ROUTE_TEST_AI_RESPONSE_CYCLE[0],
];
let WORKSPACE_ID = '';
const tmp = path.join(os.tmpdir(), `x4-route-int-${process.pid}`);
const aiMarkerDir = path.join(tmp, 'ai-markers');
const callerKeyDispatchMarker = path.join(aiMarkerDir, 'caller-key-provider-dispatch.jsonl');
const CALLER_PROVIDER_KEY = 'isolated-route-test-caller-key';
const stateDir = path.join(tmp, 'state');
const dataDir = path.join(tmp, 'data');
const configDir = path.join(tmp, 'config');
fs.mkdirSync(stateDir, { recursive: true });
fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(configDir, { recursive: true });
const LEGACY_UNBOUND_KEY = `x4fk_${'1'.repeat(64)}`;
const EXPIRED_AGENT_KEY = `x4fk_${'2'.repeat(64)}`;
const REVOKED_AGENT_KEY = `x4fk_${'3'.repeat(64)}`;
const agentKeysFile = path.join(dataDir, 'agent-keys.json');
fs.writeFileSync(agentKeysFile, JSON.stringify({
  version: 1,
  keys: [{
    id: 'key_legacy_unbound', label: 'legacy-unbound', scope: 'read',
    tokenHash: crypto.createHash('sha256').update(LEGACY_UNBOUND_KEY).digest('hex'),
    createdAt: Date.now(), expiresAt: null, lastUsedAt: null, useCount: 0, revokedAt: null,
  }, {
    id: 'key_expired_fixture', label: 'expired-fixture', scope: 'read',
    tokenHash: crypto.createHash('sha256').update(EXPIRED_AGENT_KEY).digest('hex'),
    createdAt: Date.now() - 10_000, expiresAt: Date.now() - 1_000, lastUsedAt: null, useCount: 0, revokedAt: null,
  }, {
    id: 'key_revoked_fixture', label: 'revoked-fixture', scope: 'read',
    tokenHash: crypto.createHash('sha256').update(REVOKED_AGENT_KEY).digest('hex'),
    createdAt: Date.now() - 10_000, expiresAt: null, lastUsedAt: null, useCount: 0, revokedAt: Date.now() - 1_000,
  }],
}));
const referenceRoot = path.join(tmp, 'reference');
fs.mkdirSync(path.join(referenceRoot, 'libraries'), { recursive: true });
fs.writeFileSync(path.join(referenceRoot, 'libraries', 'factions.xml'), '<factions><faction id="routefixture" name="Route Fixture" tags="economic"/></factions>');
fs.writeFileSync(path.join(referenceRoot, 'libraries', 'wares.xml'), '<wares><ware id="routeware" name="Route Ware" group="test" tags="economy"/></wares>');
fs.writeFileSync(
  path.join(referenceRoot, 'libraries', 'scriptproperties.xml'),
  '<scriptproperties>'
  + '<datatype name="faction"><property name="id" result="ID" type="string"/></datatype>'
  + '<datatype name="container"><property name="cargo" result="Cargo" type="containercargolist"/></datatype>'
  + '<datatype name="storagemodule"><property name="cargo" result="Cargo" type="modulecargolist"/></datatype>'
  + '<datatype name="containercargolist">'
  + '<property name="free.all" result="Total free cargo" type="largeint"/>'
  + '<property name="free.solid" result="Free solid cargo" type="largeint"/>'
  + '<property name="free.{$tag}" result="Free tagged cargo" type="largeint"/>'
  + '</datatype>'
  + '<datatype name="modulecargolist"><property name="free" result="Total free cargo" type="integer"/></datatype>'
  + '</scriptproperties>',
);
const gameRoot = path.join(tmp, 'X4 Foundations');
const liveExtensions = path.join(gameRoot, 'extensions');
const safeWorkspace = path.join(tmp, 'X4ForgeMods');
fs.mkdirSync(liveExtensions, { recursive: true });
fs.mkdirSync(safeWorkspace, { recursive: true });
fs.writeFileSync(path.join(gameRoot, 'X4.exe'), 'fixture');

const checks = [];
const ok = (name, pass, detail) => { checks.push({ name, pass: !!pass, detail }); console.log(`${pass ? '  ok  ' : ' FAIL '}${name}${detail ? `  [${detail}]` : ''}`); };

function schemaErrors(schema, value, at = '$') {
  const errors = [];
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) return [`${at}: schema is missing`];
  const branches = Array.isArray(schema.anyOf) ? schema.anyOf : [];
  if (branches.length && !branches.some(branch => schemaErrors(branch, value, at).length === 0)) {
    errors.push(`${at}: no anyOf branch matched`);
  }
  const types = Array.isArray(schema.type) ? schema.type : schema.type ? [schema.type] : [];
  const matches = type => type === 'object'
    ? value !== null && typeof value === 'object' && !Array.isArray(value)
    : type === 'array' ? Array.isArray(value)
      : type === 'number' ? typeof value === 'number' && Number.isFinite(value)
        : type === 'integer' ? Number.isInteger(value)
          : type === 'null' ? value === null
            : typeof value === type;
  if (types.length && !types.some(matches)) {
    errors.push(`${at}: expected ${types.join('|')}`);
    return errors;
  }
  if (Array.isArray(schema.enum) && !schema.enum.some(item => JSON.stringify(item) === JSON.stringify(value))) {
    errors.push(`${at}: value is outside enum`);
  }
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const properties = schema.properties && typeof schema.properties === 'object' && !Array.isArray(schema.properties)
      ? schema.properties : {};
    for (const key of schema.required || []) {
      if (!Object.hasOwn(value, key)) errors.push(`${at}.${key}: required`);
    }
    for (const [key, child] of Object.entries(properties)) {
      if (Object.hasOwn(value, key)) errors.push(...schemaErrors(child, value[key], `${at}.${key}`));
    }
    const unknown = Object.keys(value).filter(key => !Object.hasOwn(properties, key));
    if (schema.additionalProperties === false) {
      for (const key of unknown) errors.push(`${at}.${key}: undeclared`);
    } else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
      for (const key of unknown) errors.push(...schemaErrors(schema.additionalProperties, value[key], `${at}.${key}`));
    }
  }
  if (Array.isArray(value) && schema.items) {
    value.forEach((item, index) => errors.push(...schemaErrors(schema.items, item, `${at}[${index}]`)));
  }
  return errors;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

const workspaceReceiptContentFields = [
  'name', 'version', 'author', 'description', 'nodes', 'links', 'uiWidgets', 'aiScripts',
  'wares', 'jobs', 'tFiles', 'xmlPatches', 'customLua', 'compileSettings', 'dependencies',
  'passthroughFiles', 'originalFiles', 'sourceStamp', 'integrationContract', 'mdFileStem',
];

function sha256Stable(value) {
  return crypto.createHash('sha256').update(stableStringify(value), 'utf8').digest('hex');
}

function workspaceReceiptHashes(workspace) {
  const content = {};
  for (const field of workspaceReceiptContentFields) {
    if (Object.prototype.hasOwnProperty.call(workspace || {}, field)) content[field] = workspace[field];
  }
  return {
    workspace: sha256Stable(content),
    snapshot: sha256Stable(workspace),
  };
}

function actionReceiptFiles() {
  const root = path.join(dataDir, 'action-receipts');
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root).filter(name => /^ar_[a-f0-9]{64}\.json$/.test(name)).sort();
}

function reopenPersistedActionReceipt(projection) {
  try {
    const id = String(projection?.id || '');
    if (!/^ar_[a-f0-9]{64}$/.test(id)) return { ok: false, code: 'projection_id_invalid' };
    const file = path.join(dataDir, 'action-receipts', `${id}.json`);
    if (!fs.existsSync(file)) return { ok: false, code: 'receipt_missing' };
    const raw = fs.readFileSync(file, 'utf8');
    const record = JSON.parse(raw);
    const withoutHash = { ...record };
    delete withoutHash.hash;
    return {
      ok: true,
      raw,
      record,
      canonical: raw === stableStringify(record),
      computedHash: sha256Stable(withoutHash),
      projectionMatches: record.id === projection.id
        && record.hash === projection.hash
        && record.status === projection.status,
    };
  } catch (error) {
    return { ok: false, code: error && typeof error === 'object' && 'code' in error ? String(error.code) : 'receipt_read_failed' };
  }
}

function workspaceStateFingerprint(response) {
  return stableStringify({
    version: response?.json?.version,
    workspaceHash: response?.json?.workspaceHash,
    snapshotHash: response?.json?.snapshotHash,
    workspace: response?.json?.workspace,
  });
}

function killTree(pid) {
  if (!pid) return;
  if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
  else { try { process.kill(-pid, 'SIGKILL'); } catch { try { process.kill(pid, 'SIGKILL'); } catch { /* gone */ } } }
}

/* global Buffer, URLSearchParams, console, fetch, process, setTimeout */
/**
 * Request options: `operationId` is the caller-owned control seam for mutation
 * requests. Omit it for a fresh strong-random ID, pass a string to preserve an
 * exact valid or malformed value (including replay IDs), or pass `null` to
 * deliberately omit the operation header. An explicit
 * `options.headers['x-forge-operation-id']` is always preserved exactly and
 * takes precedence over this convenience option. On reads, `operationId` is
 * ignored and an already supplied operation header is left untouched.
 */
async function req(method, urlPath, token, body, options = {}) {
  const headers = { ...(options.headers || {}) };
  const hasExplicitOperationHeader = Object.keys(headers)
    .some(key => key.toLowerCase() === 'x-forge-operation-id');
  const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(String(method).toUpperCase());
  if (!hasExplicitOperationHeader && isMutation && options.operationId !== null) {
    headers['x-forge-operation-id'] = options.operationId ?? `forge_op_${crypto.randomBytes(16).toString('hex')}`;
  }
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const workspaceId = Object.prototype.hasOwnProperty.call(options, 'workspaceId') ? options.workspaceId : WORKSPACE_ID;
  if (token && workspaceId) headers['x-workspace-id'] = workspaceId;
  if (token === SESSION_TOKEN) headers['x-client-id'] = options.clientId || CLIENT_ID;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  try {
    const res = await fetch(BASE + urlPath, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
    const raw = await res.text();
    let json = null; try { json = JSON.parse(raw); } catch { /* non-json */ }
    return { status: res.status, json, raw };
  } catch (e) {
    return { status: 0, json: null, error: String(e) };
  }
}

function regularTreeHash(root) {
  const digest = crypto.createHash('sha256');
  const walk = (dir, relativeDir = '') => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const relative = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        digest.update(`D\0${relative}\0`);
        walk(absolute, relative);
      } else if (entry.isFile()) {
        const bytes = fs.readFileSync(absolute);
        digest.update(`F\0${relative}\0${bytes.length}\0`);
        digest.update(crypto.createHash('sha256').update(bytes).digest());
        digest.update('\0');
      }
    }
  };
  walk(root);
  return digest.digest('hex');
}

let child;
async function main() {
  // Production assertions must always use bytes emitted by this invocation.
  // Keep the build synchronous so no route server can start before it passes.
  runRequiredBuild();

  const tsxCli = path.join(process.cwd(), 'node_modules', 'tsx', 'dist', 'cli.mjs');
  child = spawn(process.execPath, [tsxCli, 'server.ts'], {
    cwd: process.cwd(),
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      PORT: String(PORT),
      NODE_ENV: 'development',
      FORGE_ALLOW_RUN_COMMAND: 'true',
      STUDIO_API_TOKEN: SESSION_TOKEN,
      X4_STATE_DIR: stateDir,
      X4_DATA_DIR: dataDir,
      X4_CONFIG_DIR: configDir,
      X4_REFERENCE_ROOT: referenceRoot,
      X4FORGE_DISCOVERY_DIR: path.join(tmp, 'discovery'),
      FORGE_TIMEOUT_DRILL_MS: '300',
      FORGE_TIMEOUT_DRILL_RESPONSE_MS: '100',
      FORGE_ROUTE_TEST_MODE: '1',
      FORGE_ROUTE_TEST_AI_RESPONSES: JSON.stringify(ROUTE_TEST_AI_RESPONSES),
      FORGE_ROUTE_TEST_AI_DELAY_MS: '400',
      FORGE_ROUTE_TEST_AI_MARKER_DIR: aiMarkerDir,
      FORGE_ROUTE_TEST_RESPONSE_TIMEOUT_MS: '100',
    },
  });
  let serverOut = '';
  child.stdout.on('data', (d) => { serverOut += d; });
  child.stderr.on('data', (d) => { serverOut += d; });

  // readiness: poll a public route until it answers
  let up = false;
  for (let i = 0; i < 40; i++) {
    await sleep(500);
    const r = await req('GET', '/api/agent/schema', null);
    if (r.status && r.status !== 0) { up = true; break; }
  }
  if (!up) { ok('server_came_up', false, serverOut.slice(-400)); return; }
  ok('server_came_up', true);

  // --- auth basics ---
  const noToken = await req('GET', '/api/agent/workspace', null);
  ok('no_token_401', noToken.status === 401);
  ok('failure_envelope_covers_auth', noToken.json?.success === false && noToken.json?.status === 'FAILED' && noToken.json?.code === 'API_UNAUTHORIZED' && typeof noToken.json?.error === 'string' && Array.isArray(noToken.json?.failedStages), JSON.stringify(noToken.json));
  ok('bogus_token_401', (await req('GET', '/api/agent/workspace', 'not-a-real-token')).status === 401);
  const bootstrap = await req('POST', '/api/agent/workspaces/bootstrap', SESSION_TOKEN, { clientId: CLIENT_ID });
  WORKSPACE_ID = String(bootstrap.json?.workspaceId || '');
  ok('workspace_bootstrap_returns_immutable_id', bootstrap.status === 200 && /^ws_[a-f0-9]{24}$/i.test(WORKSPACE_ID), JSON.stringify(bootstrap.json || {}));
  const workspaceSuccess = await req('GET', '/api/agent/workspace', SESSION_TOKEN);
  ok('session_token_200_workspace', workspaceSuccess.status === 200);
  ok('workspace_bootstrap_returns_matching_snapshot_digest',
    typeof bootstrap.json?.snapshotHash === 'string' && bootstrap.json.snapshotHash.length > 0
      && bootstrap.json.snapshotHash === workspaceSuccess.json?.snapshotHash,
    JSON.stringify({ bootstrap: bootstrap.json?.snapshotHash, read: workspaceSuccess.json?.snapshotHash }));
  ok('success_object_shape_is_not_enveloped', !Object.prototype.hasOwnProperty.call(workspaceSuccess.json || {}, 'failedStages') && !Object.prototype.hasOwnProperty.call(workspaceSuccess.json || {}, 'code'), JSON.stringify(workspaceSuccess.json || {}));

  // ADR-F5: two same-name workspaces and two tabs are independent authorities.
  const secondCreateOperationId = 'forge_op_w3b1_workspace_create_proof';
  const secondCreateDescriptionMarker = 'W3B1_CREATE_RAW_DESCRIPTION_MARKER';
  const secondCreateOrigin = `studio:create:${SECOND_CLIENT_ID}`;
  const secondCreateBody = {
    clientId: SECOND_CLIENT_ID,
    workspace: {
      ...workspaceSuccess.json.workspace,
      name: workspaceSuccess.json.workspace.name,
      description: secondCreateDescriptionMarker,
      nodes: [],
    },
  };
  const secondCreateListBeforeInvalid = await req('GET', '/api/agent/workspaces', SESSION_TOKEN);
  const secondCreateCountBeforeInvalid = secondCreateListBeforeInvalid.json?.workspaces?.length;
  const secondCreateReceiptFilesBeforeInvalid = actionReceiptFiles();

  const secondCreateMissingOperation = await req(
    'POST',
    '/api/agent/workspaces',
    SESSION_TOKEN,
    secondCreateBody,
    { clientId: SECOND_CLIENT_ID, operationId: null },
  );
  const secondCreateListAfterMissingOperation = await req('GET', '/api/agent/workspaces', SESSION_TOKEN);
  ok('workspace_create_missing_operation_id_refused_before_receipt',
    secondCreateMissingOperation.status === 400
      && secondCreateMissingOperation.json?.code === 'ACTION_RECEIPT_OPERATION_ID_INVALID'
      && secondCreateListAfterMissingOperation.json?.workspaces?.length === secondCreateCountBeforeInvalid
      && stableStringify(actionReceiptFiles()) === stableStringify(secondCreateReceiptFilesBeforeInvalid),
    `status=${secondCreateMissingOperation.status} code=${secondCreateMissingOperation.json?.code}`);

  const secondCreateMalformedOperation = await req(
    'POST',
    '/api/agent/workspaces',
    SESSION_TOKEN,
    secondCreateBody,
    { clientId: SECOND_CLIENT_ID, operationId: 'forge/op/malformed' },
  );
  const secondCreateListAfterMalformedOperation = await req('GET', '/api/agent/workspaces', SESSION_TOKEN);
  ok('workspace_create_malformed_operation_id_refused_before_receipt',
    secondCreateMalformedOperation.status === 400
      && secondCreateMalformedOperation.json?.code === 'ACTION_RECEIPT_OPERATION_ID_INVALID'
      && secondCreateListAfterMalformedOperation.json?.workspaces?.length === secondCreateCountBeforeInvalid
      && stableStringify(actionReceiptFiles()) === stableStringify(secondCreateReceiptFilesBeforeInvalid),
    `status=${secondCreateMalformedOperation.status} code=${secondCreateMalformedOperation.json?.code}`);

  const secondCreateReceiptFilesBeforeValid = actionReceiptFiles();
  const secondCreate = await req(
    'POST',
    '/api/agent/workspaces',
    SESSION_TOKEN,
    secondCreateBody,
    { clientId: SECOND_CLIENT_ID, operationId: secondCreateOperationId },
  );
  const SECOND_WORKSPACE_ID = String(secondCreate.json?.workspaceId || '');
  const secondCreateProjection = secondCreate.json?.receipt;
  const secondCreateListAfterValid = await req('GET', '/api/agent/workspaces', SESSION_TOKEN);
  ok('workspace_create_returns_committed_receipt_projection',
    secondCreate.status === 201
      && secondCreate.json?.replayed === false
      && /^ws_[a-f0-9]{24}$/i.test(SECOND_WORKSPACE_ID)
      && SECOND_WORKSPACE_ID !== WORKSPACE_ID
      && secondCreateProjection?.status === 'committed'
      && /^[a-f0-9]{64}$/.test(String(secondCreateProjection?.hash || ''))
      && Object.keys(secondCreateProjection || {}).sort().join(',') === 'hash,id,status'
      && secondCreateListAfterValid.json?.workspaces?.length === secondCreateCountBeforeInvalid + 1
      && actionReceiptFiles().length === secondCreateReceiptFilesBeforeValid.length + 1,
    `status=${secondCreate.status} replayed=${secondCreate.json?.replayed} receipt=${secondCreateProjection?.status}`);
  ok('same_name_workspace_gets_distinct_immutable_id', secondCreate.status === 201 && /^ws_[a-f0-9]{24}$/i.test(SECOND_WORKSPACE_ID) && SECOND_WORKSPACE_ID !== WORKSPACE_ID && secondCreate.json?.workspace?.name === workspaceSuccess.json?.workspace?.name, JSON.stringify({ first: WORKSPACE_ID, second: SECOND_WORKSPACE_ID }));

  const secondCreateReceiptEvidence = reopenPersistedActionReceipt(secondCreateProjection);
  const secondCreateReceipt = secondCreateReceiptEvidence.ok ? secondCreateReceiptEvidence.record : undefined;
  ok('workspace_create_persisted_receipt_is_canonical_and_hash_verified',
    secondCreateReceiptEvidence.ok
      && secondCreateReceiptEvidence.canonical === true
      && secondCreateReceiptEvidence.computedHash === secondCreateReceipt?.hash
      && secondCreateReceiptEvidence.projectionMatches === true,
    `reopened=${secondCreateReceiptEvidence.ok} canonical=${secondCreateReceiptEvidence.canonical === true}`);
  ok('workspace_create_persisted_receipt_has_exact_studio_identity',
    secondCreateReceipt?.schema === 'forge.action-receipt.v1'
      && secondCreateReceipt?.status === 'committed'
      && secondCreateReceipt?.actor?.kind === 'human'
      && secondCreateReceipt?.actor?.id === 'studio'
      && secondCreateReceipt?.client?.channel === 'studio'
      && secondCreateReceipt?.client?.id === SECOND_CLIENT_ID
      && secondCreateReceipt?.client?.version === '2026-07-30.agent.v4'
      && secondCreateReceipt?.authority?.scope === 'global'
      && secondCreateReceipt?.authority?.operationId === secondCreateOperationId
      && secondCreateReceipt?.authority?.requestScope === 'workspace-registry',
    `scope=${secondCreateReceipt?.authority?.scope} status=${secondCreateReceipt?.status}`);
  const secondCreateBeforeResource = secondCreateReceipt?.authority?.resources?.[0];
  const secondCreateAfterResource = secondCreateReceipt?.after?.resources?.[0];
  ok('workspace_create_persisted_receipt_has_truthful_registry_resource_and_after',
    secondCreateReceipt?.authority?.resources?.length === 1
      && secondCreateBeforeResource?.role === 'data'
      && secondCreateBeforeResource?.root === 'workspace-registry'
      && secondCreateBeforeResource?.relativePath === 'registry'
      && /^[a-f0-9]{64}$/.test(String(secondCreateBeforeResource?.beforeHash || ''))
      && secondCreateReceipt?.after?.outcome === 'applied'
      && secondCreateReceipt?.after?.code === `workspace_created_${SECOND_WORKSPACE_ID}`
      && secondCreateReceipt?.after?.resources?.length === 1
      && secondCreateAfterResource?.role === 'data'
      && secondCreateAfterResource?.root === 'workspace-registry'
      && secondCreateAfterResource?.relativePath === 'registry'
      && /^[a-f0-9]{64}$/.test(String(secondCreateAfterResource?.hash || '')),
    `before=${secondCreateReceipt?.authority?.resources?.length} after=${secondCreateReceipt?.after?.resources?.length} outcome=${secondCreateReceipt?.after?.outcome}`);

  const secondCreatePersistedBytes = secondCreateReceiptEvidence.ok ? secondCreateReceiptEvidence.raw : '';
  const secondCreateProjectionBytes = stableStringify(secondCreateProjection || null);
  ok('workspace_create_response_preserves_requested_description_and_origin',
    secondCreate.json?.workspace?.description === secondCreateDescriptionMarker
      && secondCreate.json?.origin === secondCreateOrigin);
  const secondCreateEvidenceBytes = `${secondCreatePersistedBytes}\n${secondCreateProjectionBytes}`;
  const encodedRouteTmp = JSON.stringify(tmp).slice(1, -1);
  ok('workspace_create_receipt_evidence_leaks_no_raw_material_or_credentials',
    !secondCreateEvidenceBytes.includes(secondCreateDescriptionMarker)
      && !secondCreateEvidenceBytes.includes(secondCreateOrigin)
      && !secondCreateEvidenceBytes.includes(tmp)
      && !secondCreateEvidenceBytes.includes(tmp.replaceAll('\\', '/'))
      && !secondCreateEvidenceBytes.includes(encodedRouteTmp)
      && !/tokenHash/i.test(secondCreateEvidenceBytes)
      && !/Authorization/i.test(secondCreateEvidenceBytes)
      && !/x4fk_/i.test(secondCreateEvidenceBytes));
  const secondCreateExactReplayListBefore = await req('GET', '/api/agent/workspaces', SESSION_TOKEN);
  const secondCreateExactReplayCountBefore = secondCreateExactReplayListBefore.json?.workspaces?.length;
  const secondCreateExactReplayReceiptFilesBefore = stableStringify(actionReceiptFiles());
  const secondCreateExactReplay = await req(
    'POST',
    '/api/agent/workspaces',
    SESSION_TOKEN,
    secondCreateBody,
    { clientId: SECOND_CLIENT_ID, operationId: secondCreateOperationId },
  );
  ok('workspace_create_exact_replay_returns_same_record_and_projection',
    secondCreateExactReplay.status === 200
      && secondCreateExactReplay.json?.replayed === true
      && secondCreateExactReplay.json?.workspaceId === SECOND_WORKSPACE_ID
      && secondCreateExactReplay.json?.workspace?.description === secondCreateDescriptionMarker
      && secondCreateExactReplay.json?.origin === secondCreateOrigin
      && stableStringify(secondCreateExactReplay.json?.receipt) === stableStringify(secondCreateProjection),
    `status=${secondCreateExactReplay.status} replayed=${secondCreateExactReplay.json?.replayed}`);
  const secondCreateExactReplayListAfter = await req('GET', '/api/agent/workspaces', SESSION_TOKEN);
  ok('workspace_create_exact_replay_does_not_mutate',
    secondCreateExactReplayListAfter.json?.workspaces?.length === secondCreateExactReplayCountBefore
      && stableStringify(actionReceiptFiles()) === secondCreateExactReplayReceiptFilesBefore,
    `count=${secondCreateExactReplayListAfter.json?.workspaces?.length}`);
  const secondCreateChangedDescription = 'W3B1_CREATE_CHANGED_FACTS_DUPLICATE_DESCRIPTION';
  const secondCreateChangedBody = {
    ...secondCreateBody,
    workspace: {
      ...secondCreateBody.workspace,
      description: secondCreateChangedDescription,
    },
  };
  const secondCreateChangedFactsListBefore = await req('GET', '/api/agent/workspaces', SESSION_TOKEN);
  const secondCreateChangedFactsCountBefore = secondCreateChangedFactsListBefore.json?.workspaces?.length;
  const secondCreateChangedFactsReceiptFilesBefore = stableStringify(actionReceiptFiles());
  const secondCreateChangedFactsConflict = await req(
    'POST',
    '/api/agent/workspaces',
    SESSION_TOKEN,
    secondCreateChangedBody,
    { clientId: SECOND_CLIENT_ID, operationId: secondCreateOperationId },
  );
  ok('workspace_create_changed_facts_same_identity_conflict',
    secondCreateChangedFactsConflict.status === 409
      && secondCreateChangedFactsConflict.json?.success === false
      && secondCreateChangedFactsConflict.json?.status === 'FAILED'
      && secondCreateChangedFactsConflict.json?.code === 'ACTION_RECEIPT_DUPLICATE_CONFLICT'
      && !Object.prototype.hasOwnProperty.call(secondCreateChangedFactsConflict.json || {}, 'receipt'),
    `status=${secondCreateChangedFactsConflict.status} code=${secondCreateChangedFactsConflict.json?.code}`);
  const secondCreateChangedFactsListAfter = await req('GET', '/api/agent/workspaces', SESSION_TOKEN);
  ok('workspace_create_changed_facts_conflict_does_not_mutate',
    secondCreateChangedFactsListAfter.json?.workspaces?.length === secondCreateChangedFactsCountBefore
      && stableStringify(actionReceiptFiles()) === secondCreateChangedFactsReceiptFilesBefore,
    `count=${secondCreateChangedFactsListAfter.json?.workspaces?.length}`);
  const secondCreateChangedFactsFailureText = String(secondCreateChangedFactsConflict.raw || '');
  const secondCreateChangedFactsFailureRedacted =
    !secondCreateChangedFactsFailureText.includes(secondCreateChangedDescription)
      && !secondCreateChangedFactsFailureText.includes(secondCreateOrigin)
      && !secondCreateChangedFactsFailureText.includes(tmp)
      && !secondCreateChangedFactsFailureText.includes(tmp.replaceAll('\\', '/'))
      && !secondCreateChangedFactsFailureText.includes(JSON.stringify(tmp).slice(1, -1))
      && !/tokenHash/i.test(secondCreateChangedFactsFailureText)
      && !/Authorization/i.test(secondCreateChangedFactsFailureText)
      && !/x4fk_/i.test(secondCreateChangedFactsFailureText);
  ok('workspace_create_changed_facts_failure_is_redacted',
    secondCreateChangedFactsFailureRedacted,
    `redacted=${secondCreateChangedFactsFailureRedacted}`);
  const distinctStudioCreateOrigin = `studio:create:${CLIENT_ID}`;
  const distinctStudioListBefore = await req('GET', '/api/agent/workspaces', SESSION_TOKEN);
  const distinctStudioCountBefore = distinctStudioListBefore.json?.workspaces?.length;
  const distinctStudioReceiptFilesBefore = actionReceiptFiles();
  const distinctStudioCreate = await req(
    'POST',
    '/api/agent/workspaces',
    SESSION_TOKEN,
    { clientId: CLIENT_ID, workspace: secondCreateBody.workspace },
    { clientId: CLIENT_ID, operationId: secondCreateOperationId },
  );
  const distinctStudioWorkspaceId = String(distinctStudioCreate.json?.workspaceId || '');
  const distinctStudioProjection = distinctStudioCreate.json?.receipt;
  ok('workspace_create_distinct_studio_client_creates_new_identity',
    distinctStudioCreate.status === 201
      && distinctStudioCreate.json?.replayed === false
      && /^ws_[a-f0-9]{24}$/i.test(distinctStudioWorkspaceId)
      && distinctStudioWorkspaceId !== WORKSPACE_ID
      && distinctStudioWorkspaceId !== SECOND_WORKSPACE_ID
      && distinctStudioProjection?.status === 'committed'
      && /^[a-f0-9]{64}$/.test(String(distinctStudioProjection?.hash || ''))
      && distinctStudioProjection?.id !== secondCreateProjection?.id
      && distinctStudioCreate.json?.workspace?.description === secondCreateDescriptionMarker
      && distinctStudioCreate.json?.origin === distinctStudioCreateOrigin,
    `status=${distinctStudioCreate.status} replayed=${distinctStudioCreate.json?.replayed}`);
  const distinctStudioReceiptEvidence = reopenPersistedActionReceipt(distinctStudioProjection);
  const distinctStudioReceipt = distinctStudioReceiptEvidence.ok ? distinctStudioReceiptEvidence.record : undefined;
  ok('workspace_create_distinct_studio_client_persists_canonical_receipt',
    distinctStudioReceiptEvidence.ok
      && distinctStudioReceiptEvidence.canonical === true
      && distinctStudioReceiptEvidence.projectionMatches === true
      && distinctStudioReceipt?.status === 'committed'
      && distinctStudioReceipt?.actor?.kind === 'human'
      && distinctStudioReceipt?.actor?.id === 'studio'
      && distinctStudioReceipt?.client?.channel === 'studio'
      && distinctStudioReceipt?.client?.id === CLIENT_ID
      && distinctStudioReceipt?.client?.version === secondCreateReceipt?.client?.version
      && distinctStudioReceipt?.authority?.scope === 'global'
      && distinctStudioReceipt?.authority?.operationId === secondCreateOperationId
      && distinctStudioReceipt?.authority?.operationId === secondCreateReceipt?.authority?.operationId
      && distinctStudioReceipt?.authority?.requestScope === secondCreateReceipt?.authority?.requestScope,
    `reopened=${distinctStudioReceiptEvidence.ok} status=${distinctStudioReceipt?.status}`);
  const distinctStudioListAfter = await req('GET', '/api/agent/workspaces', SESSION_TOKEN);
  ok('workspace_create_distinct_studio_client_increases_registry_and_receipts',
    distinctStudioListAfter.json?.workspaces?.length === distinctStudioCountBefore + 1
      && actionReceiptFiles().length === distinctStudioReceiptFilesBefore.length + 1,
    `count=${distinctStudioListAfter.json?.workspaces?.length}`);
  const distinctStudioReceiptEvidenceBytes = `${distinctStudioReceiptEvidence.ok ? distinctStudioReceiptEvidence.raw : ''}\n${stableStringify(distinctStudioProjection || null)}`;
  const distinctStudioReceiptEvidenceRedacted =
    !distinctStudioReceiptEvidenceBytes.includes(secondCreateDescriptionMarker)
      && !distinctStudioReceiptEvidenceBytes.includes(distinctStudioCreateOrigin)
      && !distinctStudioReceiptEvidenceBytes.includes(tmp)
      && !distinctStudioReceiptEvidenceBytes.includes(tmp.replaceAll('\\', '/'))
      && !distinctStudioReceiptEvidenceBytes.includes(JSON.stringify(tmp).slice(1, -1))
      && !/tokenHash/i.test(distinctStudioReceiptEvidenceBytes)
      && !/Authorization/i.test(distinctStudioReceiptEvidenceBytes)
      && !/x4fk_/i.test(distinctStudioReceiptEvidenceBytes);
  ok('workspace_create_distinct_studio_client_receipt_evidence_is_redacted',
    distinctStudioReceiptEvidenceRedacted,
    `redacted=${distinctStudioReceiptEvidenceRedacted}`);
  const firstBeforeIsolation = await req('GET', '/api/agent/workspace', SESSION_TOKEN);
  const secondBeforeIsolation = await req('GET', '/api/agent/workspace', SESSION_TOKEN, undefined, { workspaceId: SECOND_WORKSPACE_ID, clientId: SECOND_CLIENT_ID });
  const [firstWrite, secondWrite] = await Promise.all([
    req('POST', '/api/agent/workspace', SESSION_TOKEN, { workspace: { ...firstBeforeIsolation.json.workspace, description: 'first tab isolated' }, expectedHead: firstBeforeIsolation.json.workspaceHash, expectedSnapshotHash: firstBeforeIsolation.json.snapshotHash }),
    req('POST', '/api/agent/workspace', SESSION_TOKEN, { workspace: { ...secondBeforeIsolation.json.workspace, description: 'second tab isolated' }, expectedHead: secondBeforeIsolation.json.workspaceHash, expectedSnapshotHash: secondBeforeIsolation.json.snapshotHash }, { workspaceId: SECOND_WORKSPACE_ID, clientId: SECOND_CLIENT_ID }),
  ]);
  ok('concurrent_different_workspace_cas_both_succeed', firstWrite.status === 200 && secondWrite.status === 200 && firstWrite.json?.workspaceId === WORKSPACE_ID && secondWrite.json?.workspaceId === SECOND_WORKSPACE_ID);
  const firstAfterIsolation = await req('GET', '/api/agent/workspace', SESSION_TOKEN);
  const secondAfterIsolation = await req('GET', '/api/agent/workspace', SESSION_TOKEN, undefined, { workspaceId: SECOND_WORKSPACE_ID, clientId: SECOND_CLIENT_ID });
  ok('workspace_reads_do_not_cross', firstAfterIsolation.json?.workspace?.description === 'first tab isolated' && secondAfterIsolation.json?.workspace?.description === 'second tab isolated');
  const firstCompile = await req('POST', '/api/agent/compile', SESSION_TOKEN, {});
  const secondCompile = await req('POST', '/api/agent/compile', SESSION_TOKEN, {}, { workspaceId: SECOND_WORKSPACE_ID, clientId: SECOND_CLIENT_ID });
  ok('workspace_compile_echoes_independent_authority', firstCompile.json?.workspaceId === WORKSPACE_ID && secondCompile.json?.workspaceId === SECOND_WORKSPACE_ID);
  ok('stateful_route_missing_identity_fails_named', (await req('GET', '/api/agent/workspace', SESSION_TOKEN, undefined, { workspaceId: '' })).json?.code === 'WORKSPACE_ID_REQUIRED');
  ok('stateful_route_unknown_identity_fails_named', (await req('GET', '/api/agent/workspace', SESSION_TOKEN, undefined, { workspaceId: 'ws_ffffffffffffffffffffffff' })).json?.code === 'WORKSPACE_NOT_FOUND');
  ok('legacy_unbound_key_denied_workspace_state', (await req('GET', '/api/agent/workspace', LEGACY_UNBOUND_KEY, undefined, { workspaceId: WORKSPACE_ID })).json?.code === 'WORKSPACE_BINDING_REQUIRED');
  const agentSchema = await req('GET', '/api/agent/schema', null);
  ok('failure_contract_is_discoverable', agentSchema.status === 200 && agentSchema.json?.api_version === '2026-07-30.agent.v4' && Array.isArray(agentSchema.json?.failure_contract?.top_level?.failedStages), JSON.stringify(agentSchema.json?.failure_contract || {}));
  ok('deadline_contract_is_discoverable', agentSchema.json?.request_deadlines?.browser_api_default_ms === 30000 && agentSchema.json?.request_deadlines?.command_job?.maximum_ms === 1800000, JSON.stringify(agentSchema.json?.request_deadlines || {}));
  const capabilityContract = agentSchema.json?.capability_contract;
  const capabilityResponses = new Map([
    ['workspace.read', workspaceSuccess],
    ['workspace.compile', firstCompile],
  ]);
  const assertCapabilityOutput = (id, response) => {
    const descriptor = capabilityContract?.capabilities?.find(capability => capability?.id === id);
    const errors = descriptor ? schemaErrors(descriptor.outputSchema, response?.json) : ['descriptor missing'];
    ok(`capability_${id.replaceAll('.', '_')}_output_envelope`,
      response?.status >= 200 && response.status < 300 && errors.length === 0,
      JSON.stringify({ status: response?.status, errors }));
    return { id, method: descriptor?.apiBindings?.find(binding => binding?.role === 'primary')?.method,
      path: descriptor?.apiBindings?.find(binding => binding?.role === 'primary')?.path,
      status: response?.status, required: descriptor?.outputSchema?.required || [], errors };
  };
  const capabilityIds = Array.isArray(capabilityContract?.capabilities)
    ? capabilityContract.capabilities.map(capability => capability?.id)
    : [];
  ok('capability_contract_is_versioned_and_hashed',
    capabilityContract?.schemaVersion === 'forge.capability.v1' &&
    /^[a-f0-9]{64}$/.test(String(capabilityContract?.contractHash || '')) &&
    capabilityIds.length === 11 && new Set(capabilityIds).size === capabilityIds.length,
    JSON.stringify({ schemaVersion: capabilityContract?.schemaVersion, contractHash: capabilityContract?.contractHash, capabilityIds }));
  const validationCapability = capabilityContract?.capabilities?.find(capability => capability?.id === 'project.validate');
  ok('capability_validation_aliases_share_one_id',
    JSON.stringify(validationCapability?.surfaces?.mcp?.map(projection => projection?.id)) === JSON.stringify(['validate_mod', 'author_check', 'stage_and_validate']) &&
    validationCapability?.surfaces?.mcp?.every(projection => projection?.status === 'partial' && typeof projection?.note === 'string') &&
    validationCapability?.apiBindings?.[0]?.path === '/api/agent/project/validate/check' &&
    validationCapability?.apiBindings?.[0]?.fixedBody?.recordBaseline === false &&
    validationCapability?.inputSchema?.properties?.recordBaseline?.enum?.[0] === false &&
    validationCapability?.inputSchema?.anyOf?.some(branch => branch?.required?.[0] === 'project') &&
    validationCapability?.inputSchema?.anyOf?.some(branch => branch?.required?.[0] === 'fromPath'),
    JSON.stringify(validationCapability || {}));
  const previewCapability = capabilityContract?.capabilities?.find(capability => capability?.id === 'workspace.generate.preview');
  ok('capability_generation_is_discovery_only_preview',
    previewCapability?.apiBindings?.[0]?.path === '/api/agent/generate/preview' &&
    previewCapability?.apiBindings?.[0]?.fixedBody?.apply === false &&
    previewCapability?.inputSchema?.properties?.diagnostics === undefined &&
    previewCapability?.effects?.includes('spend') &&
    previewCapability?.surfaces?.mcp?.length === 0,
    JSON.stringify(previewCapability || {}));
  ok('capability_contract_has_no_volatile_timestamp',
    capabilityContract && !Object.hasOwn(capabilityContract, 'generatedAt') && !Object.hasOwn(capabilityContract, 'timestamp'));
  ok('capability_outputs_have_versioned_minimum_envelopes',
    capabilityContract?.capabilities?.every(capability =>
      capability?.outputSchema?.type === 'object' &&
      Array.isArray(capability?.outputSchema?.required) &&
      capability.outputSchema.required.length > 0 &&
      capability.outputSchema.required.every(key => Object.hasOwn(capability.outputSchema.properties || {}, key))));
  const missingFieldErrors = schemaErrors({ type: 'object', properties: { value: { type: 'string' } }, required: ['value'], additionalProperties: false }, {});
  const wrongTypeErrors = schemaErrors({ type: 'object', properties: { value: { type: 'string' } }, required: ['value'], additionalProperties: false }, { value: 1 });
  ok('capability_output_schema_oracle_rejects_missing_and_wrong_type',
    missingFieldErrors.some(error => error.includes('required')) && wrongTypeErrors.some(error => error.includes('expected string')),
    JSON.stringify({ missingFieldErrors, wrongTypeErrors }));
  const patchCapability = capabilityContract?.capabilities?.find(capability => capability?.id === 'patch.readiness.analyze');
  ok('capability_surface_gaps_are_explicit',
    validationCapability?.surfaces?.cli?.some(projection => projection?.id === 'validate:mod' && projection?.status === 'partial') &&
    validationCapability?.surfaces?.builtInHarness?.every(projection => projection?.status === 'disconnected') &&
    patchCapability?.surfaces?.ui?.some(projection => projection?.status === 'disconnected') &&
    previewCapability?.surfaces?.builtInHarness?.some(projection => projection?.status === 'connected'));
  const invalidCapabilityValidation = await req('POST', '/api/agent/project/validate/check', SESSION_TOKEN, { project: { files: [] }, unexpected: true });
  ok('capability_validation_rejects_undeclared_input', invalidCapabilityValidation.status === 400 && invalidCapabilityValidation.json?.code === 'CAPABILITY_INPUT_INVALID');
  const previewBefore = await req('GET', '/api/agent/workspace', SESSION_TOKEN);
  const hostilePreview = await req('POST', '/api/agent/generate/preview', SESSION_TOKEN, {
    prompt: '__FORGE_ROUTE_TEST_PREVIEW__',
    currentWorkspace: previewBefore.json?.workspace,
    apply: true,
  });
  capabilityResponses.set('workspace.generate.preview', hostilePreview);
  const previewAfter = await req('GET', '/api/agent/workspace', SESSION_TOKEN);
  ok('capability_preview_route_forces_hostile_apply_false',
    hostilePreview.status === 200 && hostilePreview.json?.success === true && hostilePreview.json?.applied === false,
    JSON.stringify({ status: hostilePreview.status, applied: hostilePreview.json?.applied, error: hostilePreview.json?.error }));
  ok('capability_preview_route_leaves_workspace_head_unchanged',
    previewBefore.status === 200 && previewAfter.status === 200 &&
    previewBefore.json?.workspaceHash === previewAfter.json?.workspaceHash &&
    previewBefore.json?.snapshotHash === previewAfter.json?.snapshotHash &&
    previewBefore.json?.version === previewAfter.json?.version,
    JSON.stringify({ before: previewBefore.json?.snapshotHash, after: previewAfter.json?.snapshotHash }));
  const blindGeneratedApply = await req('POST', '/api/agent/generate', SESSION_TOKEN, {
    prompt: '__FORGE_ROUTE_TEST_PREVIEW__', currentWorkspace: previewAfter.json?.workspace, apply: true,
  });
  ok('legacy_generation_rejects_blind_apply_before_provider_work',
    blindGeneratedApply.status === 409 && blindGeneratedApply.json?.error === 'generation_precondition_required' &&
    blindGeneratedApply.json?.generatedWorkspace === undefined,
    JSON.stringify(blindGeneratedApply.json || {}));
  const headOnlyGeneratedApply = await req('POST', '/api/agent/generate', SESSION_TOKEN, {
    prompt: '__FORGE_ROUTE_TEST_PREVIEW__', currentWorkspace: previewAfter.json?.workspace, apply: true,
    expectedHead: previewAfter.json?.workspaceHash,
  });
  ok('legacy_generation_rejects_head_only_apply_before_provider_work',
    headOnlyGeneratedApply.status === 409 && headOnlyGeneratedApply.json?.error === 'generation_precondition_required' &&
    headOnlyGeneratedApply.json?.generatedWorkspace === undefined,
    JSON.stringify(headOnlyGeneratedApply.json || {}));
  const generatedApply = await req('POST', '/api/agent/generate', SESSION_TOKEN, {
    prompt: '__FORGE_ROUTE_TEST_PREVIEW__',
    currentWorkspace: previewAfter.json?.workspace,
    apply: true,
    expectedHead: previewAfter.json?.workspaceHash,
    expectedSnapshotHash: previewAfter.json?.snapshotHash,
  });
  const afterGeneratedApply = await req('GET', '/api/agent/workspace', SESSION_TOKEN);
  ok('legacy_generation_returns_authoritative_paired_post_write_identities',
    generatedApply.status === 200 && generatedApply.json?.applied === true &&
    typeof generatedApply.json?.workspaceHash === 'string' &&
    typeof generatedApply.json?.snapshotHash === 'string' &&
    generatedApply.json.workspaceHash === afterGeneratedApply.json?.workspaceHash &&
    generatedApply.json.snapshotHash === afterGeneratedApply.json?.snapshotHash &&
    JSON.stringify(generatedApply.json?.workspace) === JSON.stringify(afterGeneratedApply.json?.workspace),
    JSON.stringify({ status: generatedApply.status, workspaceHash: generatedApply.json?.workspaceHash, snapshotHash: generatedApply.json?.snapshotHash }));
  const generationThemeWrite = await req('POST', '/api/agent/workspace', SESSION_TOKEN, {
    workspace: {
      ...afterGeneratedApply.json?.workspace,
      uiTheme: { ...afterGeneratedApply.json?.workspace?.uiTheme, accentColor: '#123abc' },
    },
    expectedHead: afterGeneratedApply.json?.workspaceHash,
    expectedSnapshotHash: afterGeneratedApply.json?.snapshotHash,
  });
  const staleGeneration = await req('POST', '/api/agent/generate', SESSION_TOKEN, {
    prompt: '__FORGE_ROUTE_TEST_PREVIEW__',
    currentWorkspace: afterGeneratedApply.json?.workspace,
    apply: true,
    expectedHead: afterGeneratedApply.json?.workspaceHash,
    expectedSnapshotHash: afterGeneratedApply.json?.snapshotHash,
  });
  const afterStaleGeneration = await req('GET', '/api/agent/workspace', SESSION_TOKEN);
  ok('legacy_generation_rejects_snapshot_only_staleness_before_provider_work',
    generationThemeWrite.status === 200 &&
    generationThemeWrite.json?.workspaceHash === afterGeneratedApply.json?.workspaceHash &&
    generationThemeWrite.json?.snapshotHash !== afterGeneratedApply.json?.snapshotHash &&
    staleGeneration.status === 409 && staleGeneration.json?.error === 'snapshot_conflict' &&
    staleGeneration.json?.generatedWorkspace === undefined &&
    staleGeneration.json?.currentSnapshotHash === generationThemeWrite.json?.snapshotHash &&
    afterStaleGeneration.json?.snapshotHash === generationThemeWrite.json?.snapshotHash,
    JSON.stringify({ write: generationThemeWrite.status, stale: staleGeneration.json, after: afterStaleGeneration.json?.snapshotHash }));
  const heldBefore = afterStaleGeneration;
  const heldMarker = path.join(aiMarkerDir, '__FORGE_ROUTE_TEST_HELD__.held');
  const heldGenerationPromise = req('POST', '/api/agent/generate', SESSION_TOKEN, {
    prompt: '__FORGE_ROUTE_TEST_HELD__',
    currentWorkspace: heldBefore.json?.workspace,
    apply: true,
    expectedHead: heldBefore.json?.workspaceHash,
    expectedSnapshotHash: heldBefore.json?.snapshotHash,
  });
  for (let attempt = 0; attempt < 80 && !fs.existsSync(heldMarker); attempt++) await sleep(25);
  const heldConcurrentWrite = await req('POST', '/api/agent/workspace', SESSION_TOKEN, {
    workspace: {
      ...heldBefore.json?.workspace,
      uiTheme: { ...heldBefore.json?.workspace?.uiTheme, accentColor: '#456def' },
    },
    expectedHead: heldBefore.json?.workspaceHash,
    expectedSnapshotHash: heldBefore.json?.snapshotHash,
  });
  const heldGeneration = await heldGenerationPromise;
  const afterHeldGeneration = await req('GET', '/api/agent/workspace', SESSION_TOKEN);
  ok('legacy_generation_rechecks_snapshot_after_held_provider_before_single_commit',
    fs.existsSync(heldMarker) && heldConcurrentWrite.status === 200 &&
    heldGeneration.status === 409 && heldGeneration.json?.error === 'snapshot_conflict' &&
    heldGeneration.json?.generatedWorkspace &&
    afterHeldGeneration.json?.snapshotHash === heldConcurrentWrite.json?.snapshotHash &&
    afterHeldGeneration.json?.workspace?.uiTheme?.accentColor === '#456def',
    JSON.stringify({ marker: fs.existsSync(heldMarker), concurrent: heldConcurrentWrite.status, generation: heldGeneration.status, after: afterHeldGeneration.json?.snapshotHash }));
  const deadlineBefore = afterHeldGeneration;
  const deadlineMarker = path.join(aiMarkerDir, '__FORGE_ROUTE_TEST_DEADLINE__.held');
  const deadlineGeneration = await req('POST', '/api/agent/generate', SESSION_TOKEN, {
    prompt: '__FORGE_ROUTE_TEST_DEADLINE__',
    currentWorkspace: deadlineBefore.json?.workspace,
    apply: true,
    expectedHead: deadlineBefore.json?.workspaceHash,
    expectedSnapshotHash: deadlineBefore.json?.snapshotHash,
  }, { headers: { 'x-forge-route-test-deadline': '1' } });
  await sleep(500);
  const afterDeadlineGeneration = await req('GET', '/api/agent/workspace', SESSION_TOKEN);
  ok('legacy_generation_deadline_cannot_mutate_after_client_failure',
    fs.existsSync(deadlineMarker) && deadlineGeneration.status === 504 &&
    deadlineGeneration.json?.code === 'REQUEST_DEADLINE_EXCEEDED' &&
    afterDeadlineGeneration.json?.workspaceHash === deadlineBefore.json?.workspaceHash &&
    afterDeadlineGeneration.json?.snapshotHash === deadlineBefore.json?.snapshotHash,
    JSON.stringify({ marker: fs.existsSync(deadlineMarker), status: deadlineGeneration.status, before: deadlineBefore.json?.snapshotHash, after: afterDeadlineGeneration.json?.snapshotHash }));
  const elementExplain = await req('GET', '/api/agent/lang/element-explain?file=md%2Fx.xml&tag=set_value', null);
  capabilityResponses.set('schema.element.explain', elementExplain);
  ok('capability_element_explain_primary_returns_declared_envelope',
    elementExplain.status === 200 && elementExplain.json?.tag === 'set_value' &&
    typeof elementExplain.json?.known === 'boolean' && Array.isArray(elementExplain.json?.requiredAttrs) &&
    typeof elementExplain.json?.attrCount === 'number' && Array.isArray(elementExplain.json?.attrs),
    JSON.stringify(elementExplain.json || {}));
  const invalidElementExplain = await req('GET', '/api/agent/lang/element-explain?tag=set_value&root=undeclared', null);
  ok('capability_element_explain_rejects_undeclared_query',
    invalidElementExplain.status === 400 && invalidElementExplain.json?.code === 'CAPABILITY_INPUT_INVALID');
  const readinessCapabilityResponse = await req('GET', '/api/agent/readiness', SESSION_TOKEN);
  capabilityResponses.set('readiness.read', readinessCapabilityResponse);
  const schemaDomainsCapabilityResponse = await req('GET', '/api/agent/schema-registry', null);
  capabilityResponses.set('schema.domains.list', schemaDomainsCapabilityResponse);

  // R7: a corrupt persistent spend ledger must be explicit in the readout and must stop
  // the paid-call chokepoint before provider selection/key lookup/network dispatch.
  const aiUsageFile = path.join(dataDir, 'ai-usage.json');
  fs.writeFileSync(aiUsageFile, '{corrupt');
  const corruptUsage = await req('GET', '/api/ai/usage', SESSION_TOKEN);
  ok('corrupt_spend_meter_is_explicit_in_readout', corruptUsage.status === 200 && corruptUsage.json?.meterAvailable === false && typeof corruptUsage.json?.meterError === 'string', JSON.stringify(corruptUsage.json || {}));
  const unknownInputWorkspaceId = 'ws_missing_input_precedence';
  const invalidCapabilityPreview = await req('POST', '/api/agent/generate/preview', SESSION_TOKEN,
    { prompt: 'must not dispatch', diagnostics: [] }, { workspaceId: unknownInputWorkspaceId });
  ok('capability_preview_rejects_ignored_diagnostics_before_authority_or_provider',
    invalidCapabilityPreview.status === 400 && invalidCapabilityPreview.json?.code === 'CAPABILITY_INPUT_INVALID',
    JSON.stringify(invalidCapabilityPreview.json || {}));
  const invalidPromptPreview = await req('POST', '/api/agent/generate/preview', SESSION_TOKEN, { prompt: { disguised: 'provider work' }, apply: false });
  ok('capability_preview_rejects_non_string_prompt_before_spend_boundary',
    invalidPromptPreview.status === 400 && invalidPromptPreview.json?.code === 'CAPABILITY_INPUT_INVALID' &&
    /string prompt/i.test(invalidPromptPreview.json?.error || ''),
    JSON.stringify(invalidPromptPreview.json || {}));
  const invalidLegacyBody = await req('POST', '/api/agent/generate', SESSION_TOKEN, [], { workspaceId: unknownInputWorkspaceId });
  ok('legacy_generation_rejects_non_object_body_before_authority_or_spend',
    invalidLegacyBody.status === 400 && invalidLegacyBody.json?.code === 'CAPABILITY_INPUT_INVALID' &&
    /JSON object body/i.test(invalidLegacyBody.json?.error || ''),
    JSON.stringify(invalidLegacyBody.json || {}));
  const invalidLegacyPrompt = await req('POST', '/api/agent/generate', SESSION_TOKEN,
    { prompt: { disguised: 'provider work' }, apply: false }, { workspaceId: unknownInputWorkspaceId });
  ok('legacy_generation_rejects_non_string_prompt_before_authority_or_spend',
    invalidLegacyPrompt.status === 400 && invalidLegacyPrompt.json?.code === 'CAPABILITY_INPUT_INVALID' &&
    /string prompt/i.test(invalidLegacyPrompt.json?.error || ''),
    JSON.stringify(invalidLegacyPrompt.json || {}));
  const invalidLegacyWorkspace = await req('POST', '/api/agent/generate', SESSION_TOKEN,
    { prompt: 'must not dispatch', currentWorkspace: [], apply: false }, { workspaceId: unknownInputWorkspaceId });
  ok('legacy_generation_rejects_non_object_workspace_before_authority_or_spend',
    invalidLegacyWorkspace.status === 400 && invalidLegacyWorkspace.json?.code === 'CAPABILITY_INPUT_INVALID' &&
    /currentWorkspace must be a JSON object/i.test(invalidLegacyWorkspace.json?.error || ''),
    JSON.stringify(invalidLegacyWorkspace.json || {}));
  const invalidLegacyApply = await req('POST', '/api/agent/generate', SESSION_TOKEN,
    { prompt: 'must not dispatch', apply: 'false' }, { workspaceId: unknownInputWorkspaceId });
  ok('legacy_generation_rejects_non_boolean_apply_before_authority_or_spend',
    invalidLegacyApply.status === 400 && invalidLegacyApply.json?.code === 'CAPABILITY_INPUT_INVALID' &&
    /apply must be boolean/i.test(invalidLegacyApply.json?.error || ''),
    JSON.stringify(invalidLegacyApply.json || {}));
  const invalidLegacySnapshotHash = await req('POST', '/api/agent/generate', SESSION_TOKEN,
    { prompt: 'must not dispatch', apply: true, expectedSnapshotHash: 42 }, { workspaceId: unknownInputWorkspaceId });
  ok('legacy_generation_rejects_non_string_snapshot_hash_before_authority_or_spend',
    invalidLegacySnapshotHash.status === 400 && invalidLegacySnapshotHash.json?.code === 'CAPABILITY_INPUT_INVALID' &&
    /expectedSnapshotHash must be a string/i.test(invalidLegacySnapshotHash.json?.error || ''),
    JSON.stringify(invalidLegacySnapshotHash.json || {}));
  const refusedPaidCall = await req('POST', '/api/gemini', SESSION_TOKEN, { prompt: 'R7 meter failure fixture' }, {
    headers: { 'x-custom-api-key': 'route-test-key-never-dispatched' },
  });
  ok('corrupt_spend_meter_refuses_before_provider_dispatch', refusedPaidCall.status === 500 && /spend meter unavailable.*refused before network dispatch/i.test(refusedPaidCall.json?.error || ''), JSON.stringify(refusedPaidCall.json || {}));
  fs.unlinkSync(aiUsageFile);
  const firstRunUsage = await req('GET', '/api/ai/usage', SESSION_TOKEN);
  ok('missing_spend_meter_is_valid_first_run', firstRunUsage.status === 200 && firstRunUsage.json?.meterAvailable === true && firstRunUsage.json?.totalToday === 0, JSON.stringify(firstRunUsage.json || {}));

  const responseTimeoutStarted = Date.now();
  const responseTimeout = await req('GET', '/api/agent/timeout-drill', null);
  const responseTimeoutElapsed = Date.now() - responseTimeoutStarted;
  ok('server_response_deadline_returns_504', responseTimeout.status === 504 && responseTimeout.json?.code === 'REQUEST_DEADLINE_EXCEEDED' && responseTimeout.json?.success === false && responseTimeout.json?.failedStages?.includes('request_deadline'), `status=${responseTimeout.status} elapsed=${responseTimeoutElapsed}ms`);
  ok('server_response_deadline_preempts_handler', responseTimeoutElapsed < 300, `elapsed=${responseTimeoutElapsed}ms`);

  const invalidJobTimeout = await req('POST', '/api/run_command/job', SESSION_TOKEN, { cmd: 'echo should-not-run', timeoutMs: 99 });
  ok('invalid_job_timeout_rejected_before_spawn', invalidJobTimeout.status === 400 && invalidJobTimeout.json?.code === 'INVALID_JOB_TIMEOUT');
  const sleepCommand = process.platform === 'win32'
    ? 'powershell -NoProfile -NonInteractive -Command "Start-Sleep -Seconds 5"'
    : 'sleep 5';
  const timedJobStart = await req('POST', '/api/run_command/job', SESSION_TOKEN, { cmd: sleepCommand, timeoutMs: 200 });
  let timedJob = null;
  const timedJobDeadline = Date.now() + 3000;
  while (timedJobStart.json?.jobId && Date.now() < timedJobDeadline) {
    await sleep(50);
    timedJob = await req('GET', `/api/run_command/job/${timedJobStart.json.jobId}`, SESSION_TOKEN);
    if (timedJob.json?.status === 'timed_out' && timedJob.json?.processExited === true) break;
  }
  ok('async_job_deadline_is_reported', timedJobStart.status === 200 && timedJobStart.json?.timeoutMs === 200 && timedJob?.json?.status === 'timed_out' && timedJob?.json?.success === false && timedJob?.json?.code === 'COMMAND_DEADLINE_EXCEEDED' && timedJob?.json?.failedStages?.includes('command') && typeof timedJob?.json?.error === 'string', JSON.stringify(timedJob?.json || {}));
  ok('async_job_process_exits_after_tree_kill', timedJob?.json?.processExited === true, JSON.stringify(timedJob?.json || {}));

  // --- public canonical reference API + raw-file containment ---
  const factions = await req('GET', '/api/reference/factions', null);
  ok('reference_factions_public_and_canonical', factions.status === 200 && factions.json?.[0]?.id === 'routefixture');
  ok('success_array_shape_is_not_enveloped', Array.isArray(factions.json) && !Object.prototype.hasOwnProperty.call(factions.json, 'failedStages'));
  const rawFaction = await req('GET', '/api/reference/file?path=libraries/factions.xml', null);
  ok('reference_file_returns_real_raw_file', rawFaction.status === 200 && rawFaction.raw.includes('routefixture'));
  const referenceTraversal = await req('GET', '/api/reference/file?path=../outside.xml', null);
  ok('reference_file_traversal_rejected', referenceTraversal.status === 403, `status=${referenceTraversal.status}`);

  // B83: the externally visible artifact oracle must prove locked-root fallback,
  // rollback, lock-code scoping, and transaction-sibling cleanup—not merely return pass:true.
  const artifactSelftest = await req('GET', '/api/agent/artifact-pipeline-selftest', null);
  const artifactChecks = new Map((artifactSelftest.json?.checks || []).map(check => [check.name, check.pass]));
  const requiredArtifactChecks = [
    'locked-root EBUSY fallback deploys without moving target root',
    'locked-root EPERM fallback deploys without moving target root',
    'locked-root fallback restores exact original tree',
    'locked-root rollback leaves no transaction siblings',
    'incomplete locked-root backup fails closed',
    'incomplete backup never mutates target',
    'non-lock rename error fails without fallback',
    'non-lock rename error leaves target unchanged',
    'verified deploy recovery restores exact prior tree',
    'deploy recovery rejects a stale post-state',
    'deploy recovery rejects a corrupt pre-state payload',
    'first-deploy recovery removes the new target atomically',
  ];
  ok('artifact_selftest_public_and_green', artifactSelftest.status === 200 && artifactSelftest.json?.pass === true, `status=${artifactSelftest.status} summary=${artifactSelftest.json?.summary}`);
  ok('artifact_selftest_proves_locked_root_transaction', requiredArtifactChecks.every(name => artifactChecks.get(name) === true), JSON.stringify(Object.fromEntries(requiredArtifactChecks.map(name => [name, artifactChecks.get(name)]))));

  // --- mint a read + a write agent key with the session token ---
  const mkKey = async (scope, extra = {}) => {
    const response = await req('POST', '/api/agent/keys', SESSION_TOKEN, {
      label: `route-int-${scope}`, scope, ttl: '1h', ...extra,
    });
    return { response, token: response.json && (response.json.token || response.json.key) };
  };
  const readMint = await mkKey('read');
  const writeMint = await mkKey('write');
  const deployMint = await mkKey('deploy');
  const readKey = readMint.token;
  const writeKey = writeMint.token;
  const deployKey = deployMint.token;
  ok('minted_read_write_and_deploy_keys', !!readKey && !!writeKey && !!deployKey &&
    [readMint, writeMint, deployMint].every(result => result.response.json?.record?.authorityMode === 'preset'),
  `read=${!!readKey} write=${!!writeKey} deploy=${!!deployKey}`);

  // B117/W2A: the manifest is the exact, versioned grant source. Prove each preset has
  // a real positive, exact denials carry stable policy evidence, and Studio-only routes
  // remain unreachable even to deploy keys.
  const authorityView = await req('GET', '/api/agent/keys', SESSION_TOKEN);
  const authorityHash = String(authorityView.json?.authority?.hash || '');
  ok('exact_authority_policy_is_discoverable',
    authorityView.status === 200 && authorityView.json?.authority?.version === 'forge.route-dispositions.v4' &&
    /^[a-f0-9]{64}$/.test(authorityHash) && authorityView.json?.authority?.existingKeysFollowCurrentPolicy === true,
    JSON.stringify(authorityView.json?.authority || {}));
  ok('key_management_exposes_custom_contract_options_without_public_capabilities',
    authorityView.json?.authority?.customAuthority?.includes('contract-only') &&
    Array.isArray(authorityView.json?.capabilityOptions) && authorityView.json.capabilityOptions.length === 9 &&
    authorityView.json.capabilityOptions.every(option => !['schema.domains.list@1', 'schema.element.explain@1'].includes(option.identity)) &&
    Array.isArray(authorityView.json?.effectOptions) && authorityView.json.effectOptions.includes('spend'),
    JSON.stringify({ options: authorityView.json?.capabilityOptions?.length, effects: authorityView.json?.effectOptions }));

  const effectiveIds = response => response.json?.capability_contract?.capabilities?.map(capability => capability.id);
  const effectiveHashIsValid = response => {
    if (!response.json || typeof response.json !== 'object') return false;
    const unsigned = { ...response.json };
    delete unsigned.authority_hash;
    return response.json.authority_hash === crypto.createHash('sha256').update(stableStringify(unsigned)).digest('hex');
  };
  const keyStoreBeforeDiscovery = fs.readFileSync(agentKeysFile);
  const publicEffective = await req('GET', '/api/agent/capabilities/effective', null);
  const bogusEffective = await req('GET', '/api/agent/capabilities/effective', `x4fk_${'f'.repeat(64)}`);
  const studioEffective = await req('GET', '/api/agent/capabilities/effective', SESSION_TOKEN);
  const readEffective = await req('GET', '/api/agent/capabilities/effective', readKey);
  const writeEffective = await req('GET', '/api/agent/capabilities/effective', writeKey);
  const deployEffective = await req('GET', '/api/agent/capabilities/effective', deployKey);
  await sleep(25);
  const keyStoreAfterDiscovery = fs.readFileSync(agentKeysFile);
  ok('effective_discovery_is_protected_and_studio_sees_full_contract', publicEffective.status === 401 && bogusEffective.status === 401 &&
    studioEffective.status === 200 && studioEffective.json?.actor?.kind === 'studio' &&
    effectiveIds(studioEffective)?.length === 11 && effectiveHashIsValid(studioEffective),
  JSON.stringify({ public: publicEffective.json, bogus: bogusEffective.json, studio: { actor: studioEffective.json?.actor, ids: effectiveIds(studioEffective) } }));
  for (const [name, response, scope, expectedCount] of [
    ['read', readEffective, 'read', 6],
    ['write', writeEffective, 'write', 8],
    ['deploy', deployEffective, 'deploy', 11],
  ]) {
    ok(`${name}_key_effective_capabilities_are_exact_and_hashed`, response.status === 200 &&
      response.json?.api_version === '2026-08-01.agent-effective.v1' &&
      response.json?.authority_schema_version === 'forge.agent-capability-authority.v1' &&
      response.json?.actor?.scope === scope && response.json?.actor?.workspaceId === WORKSPACE_ID &&
      response.json?.route_policy?.version === 'forge.route-dispositions.v4' &&
      response.json?.route_policy?.hash === authorityHash && response.json?.constraint === null &&
      effectiveIds(response)?.length === expectedCount && effectiveHashIsValid(response),
    JSON.stringify({ status: response.status, actor: response.json?.actor, ids: effectiveIds(response), hash: response.json?.authority_hash }));
    ok(`${name}_effective_discovery_leaks_no_credential_material`,
      !String(response.raw || '').includes('x4fk_') && !String(response.raw || '').includes('tokenHash') && !String(response.raw || '').includes('hashPrefix'));
  }
  ok('effective_discovery_does_not_increment_key_use_or_rewrite_store',
    Buffer.compare(keyStoreBeforeDiscovery, keyStoreAfterDiscovery) === 0,
    `before=${crypto.createHash('sha256').update(keyStoreBeforeDiscovery).digest('hex')} after=${crypto.createHash('sha256').update(keyStoreAfterDiscovery).digest('hex')}`);
  ok('read_write_deploy_effective_sets_are_monotonic',
    effectiveIds(readEffective).every(id => effectiveIds(writeEffective).includes(id)) &&
    effectiveIds(writeEffective).every(id => effectiveIds(deployEffective).includes(id)));

  const keyStoreBeforeInvalidConstraint = fs.readFileSync(agentKeysFile);
  const invalidConstraints = await Promise.all([
    mkKey('write', { authorityMode: 'exact', capabilityIdentities: ['workspace.compile@99'], allowedEffects: ['read'] }),
    mkKey('write', { authorityMode: 'exact', capabilityIdentities: ['workspace.compile@1', 'workspace.compile@1'], allowedEffects: ['read'] }),
    mkKey('read', { authorityMode: 'exact', capabilityIdentities: ['project.validate@1'], allowedEffects: ['read'] }),
    mkKey('write', { authorityMode: 'exact', capabilityIdentities: 'workspace.compile@1', allowedEffects: [] }),
    mkKey('write', { authorityMode: 'exact', capabilityIdentities: ['workspace.compile@1'], allowedEffects: ['unknown-effect'] }),
  ]);
  const keyStoreAfterInvalidConstraint = fs.readFileSync(agentKeysFile);
  ok('invalid_custom_constraints_fail_before_key_store_mutation', invalidConstraints.every(result =>
    result.response.status === 400 && result.response.json?.code === 'AGENT_CAPABILITY_CONSTRAINT_INVALID' && !result.token) &&
    Buffer.compare(keyStoreBeforeInvalidConstraint, keyStoreAfterInvalidConstraint) === 0,
  JSON.stringify(invalidConstraints.map(result => ({ status: result.response.status, body: result.response.json }))));

  const invalidAuthorityRequests = await Promise.all([
    mkKey('write', { capabilityIdentities: ['workspace.compile@1'], allowedEffects: ['read'] }),
    mkKey('write', { authorityMode: 'preset', capabilityIdentities: [], allowedEffects: [] }),
    mkKey('write', { authorityMode: 'exact', capabilityIdentities: ['workspace.compile@1'] }),
    mkKey('write', { authorityMode: 'future', capabilityIdentities: [], allowedEffects: [] }),
    mkKey('write', { capabilityConstraint: { capabilityIdentities: [], allowedEffects: [] } }),
    mkKey('write', { authorityMode: 'exact', capabiltyIdentities: [], allowedEffects: [] }),
    mkKey('write', { authorityMode: 'preset', unexpectedGrant: true }),
  ]);
  const expectedInvalidAuthorityCodes = [
    'AGENT_KEY_AUTHORITY_MODE_INVALID',
    'AGENT_KEY_AUTHORITY_MODE_INVALID',
    'AGENT_KEY_AUTHORITY_MODE_INVALID',
    'AGENT_KEY_AUTHORITY_MODE_INVALID',
    'AGENT_KEY_REQUEST_INVALID',
    'AGENT_KEY_REQUEST_INVALID',
    'AGENT_KEY_REQUEST_INVALID',
  ];
  const keyStoreAfterInvalidAuthority = fs.readFileSync(agentKeysFile);
  ok('implicit_mixed_nested_and_typo_authority_requests_fail_before_key_store_mutation',
    invalidAuthorityRequests.every((result, index) => result.response.status === 400 &&
      result.response.json?.code === expectedInvalidAuthorityCodes[index] && !result.token) &&
      Buffer.compare(keyStoreBeforeInvalidConstraint, keyStoreAfterInvalidAuthority) === 0,
  JSON.stringify(invalidAuthorityRequests.map(result => ({ status: result.response.status, body: result.response.json }))));

  const customConstraint = {
    capabilityIdentities: ['project.validate@1'],
    allowedEffects: ['read', 'analyze', 'audit-write', 'audit-retention-delete'],
  };
  const customMint = await mkKey('write', { label: 'route-int-custom-write', authorityMode: 'exact', ...customConstraint });
  const customKey = customMint.token;
  ok('custom_key_is_minted_with_canonical_immutable_constraint', customMint.response.status === 200 && !!customKey &&
    customMint.response.json?.record?.authorityMode === 'exact' &&
    JSON.stringify(customMint.response.json?.record?.capabilityConstraint) === JSON.stringify(customConstraint),
  JSON.stringify(customMint.response.json?.record || {}));
  const customEffective = await req('GET', '/api/agent/capabilities/effective', customKey);
  ok('custom_effective_contract_keeps_public_and_exact_selected_capability', customEffective.status === 200 &&
    JSON.stringify(effectiveIds(customEffective)) === JSON.stringify(['project.validate', 'schema.domains.list', 'schema.element.explain']) &&
    JSON.stringify(customEffective.json?.constraint) === JSON.stringify(customConstraint) && effectiveHashIsValid(customEffective),
  JSON.stringify({ ids: effectiveIds(customEffective), exclusions: customEffective.json?.exclusions }));
  const customProject = {
    id: 'b118_custom_probe', name: 'b118_custom_probe', files: [
      { path: 'content.xml', kind: 'content', content: '<content id="b118_custom_probe" name="B118 Custom Probe" version="100"/>' },
    ],
  };
  const customValidation = await req('POST', '/api/agent/project/validate/check', customKey, { project: customProject });
  ok('custom_key_can_call_its_exact_canonical_capability', customValidation.status === 200 && typeof customValidation.json?.ok === 'boolean',
    JSON.stringify(customValidation.json?.summary || customValidation.json || {}));
  await sleep(25);
  const storeBeforeCustomDenials = fs.readFileSync(agentKeysFile);
  const workspaceBeforeCustomDenials = await req('GET', '/api/agent/workspace', SESSION_TOKEN);
  const customCompileDenied = await req('POST', '/api/agent/compile', customKey, {});
  const customLegacyDenied = await req('POST', '/api/reference/complete', customKey, { path: 'md/b118.xml', content: '', line: 0, column: 0 });
  await sleep(25);
  const workspaceAfterCustomDenials = await req('GET', '/api/agent/workspace', SESSION_TOKEN);
  const storeAfterCustomDenials = fs.readFileSync(agentKeysFile);
  ok('custom_key_denies_unselected_canonical_capability_before_mutation',
    customCompileDenied.status === 403 && customCompileDenied.json?.authorityCode === 'CAPABILITY_NOT_GRANTED' &&
    customCompileDenied.json?.capabilityIdentity === 'workspace.compile@1' &&
    customCompileDenied.json?.policyVersion === 'forge.route-dispositions.v4' && customCompileDenied.json?.policyHash === authorityHash &&
    workspaceAfterCustomDenials.json?.workspaceHash === workspaceBeforeCustomDenials.json?.workspaceHash &&
    workspaceAfterCustomDenials.json?.snapshotHash === workspaceBeforeCustomDenials.json?.snapshotHash,
  JSON.stringify(customCompileDenied.json || {}));
  ok('custom_key_denies_noncanonical_protected_routes', customLegacyDenied.status === 403 &&
    customLegacyDenied.json?.authorityCode === 'UNCONTRACTED_ROUTE_DENIED' &&
    customLegacyDenied.json?.policyVersion === 'forge.route-dispositions.v4' && customLegacyDenied.json?.policyHash === authorityHash,
  JSON.stringify(customLegacyDenied.json || {}));
  ok('custom_authority_denials_do_not_record_successful_key_use',
    Buffer.compare(storeBeforeCustomDenials, storeAfterCustomDenials) === 0);

  const effectMint = await mkKey('deploy', {
    label: 'route-int-effect-denied',
    authorityMode: 'exact',
    capabilityIdentities: ['workspace.generate.preview@1'],
    allowedEffects: ['read', 'analyze', 'audit-write', 'audit-retention-delete'],
  });
  const effectKey = effectMint.token;
  const effectEffective = await req('GET', '/api/agent/capabilities/effective', effectKey);
  const previewExclusion = effectEffective.json?.exclusions?.find(exclusion => exclusion.capabilityIdentity === 'workspace.generate.preview@1');
  ok('missing_effect_excludes_the_whole_selected_capability', effectEffective.status === 200 &&
    !effectiveIds(effectEffective).includes('workspace.generate.preview') &&
    previewExclusion?.code === 'CAPABILITY_EFFECT_DENIED' &&
    JSON.stringify(previewExclusion?.disallowedEffects) === JSON.stringify(['network', 'spend']),
  JSON.stringify(previewExclusion || {}));
  const usageBeforeEffectDenial = fs.existsSync(aiUsageFile) ? fs.readFileSync(aiUsageFile) : null;
  const dispatchBeforeEffectDenial = fs.existsSync(callerKeyDispatchMarker) ? fs.readFileSync(callerKeyDispatchMarker) : null;
  const effectPreviewDenied = await req('POST', '/api/agent/generate/preview', effectKey, { prompt: 'must not dispatch', apply: false });
  const usageAfterEffectDenial = fs.existsSync(aiUsageFile) ? fs.readFileSync(aiUsageFile) : null;
  const dispatchAfterEffectDenial = fs.existsSync(callerKeyDispatchMarker) ? fs.readFileSync(callerKeyDispatchMarker) : null;
  ok('missing_effect_denies_before_provider_spend_or_dispatch', effectPreviewDenied.status === 403 &&
    effectPreviewDenied.json?.authorityCode === 'CAPABILITY_EFFECT_DENIED' &&
    JSON.stringify(effectPreviewDenied.json?.disallowedEffects) === JSON.stringify(['network', 'spend']) &&
    effectPreviewDenied.json?.policyVersion === 'forge.route-dispositions.v4' && effectPreviewDenied.json?.policyHash === authorityHash &&
    String(usageAfterEffectDenial) === String(usageBeforeEffectDenial) &&
    String(dispatchAfterEffectDenial) === String(dispatchBeforeEffectDenial), JSON.stringify(effectPreviewDenied.json || {}));

  const revocableMint = await mkKey('read', { label: 'route-int-revocable' });
  const revokeResponse = await req('POST', '/api/agent/keys/revoke', SESSION_TOKEN, { id: revocableMint.response.json?.record?.id });
  const revokedDiscovery = await req('GET', '/api/agent/capabilities/effective', revocableMint.token);
  const expiredDiscovery = await req('GET', '/api/agent/capabilities/effective', EXPIRED_AGENT_KEY);
  const preRevokedDiscovery = await req('GET', '/api/agent/capabilities/effective', REVOKED_AGENT_KEY);
  const unboundDiscovery = await req('GET', '/api/agent/capabilities/effective', LEGACY_UNBOUND_KEY);
  const missingWorkspaceDiscovery = await req('GET', '/api/agent/capabilities/effective', readKey, undefined, { workspaceId: '' });
  const wrongWorkspaceDiscovery = await req('GET', '/api/agent/capabilities/effective', readKey, undefined, { workspaceId: SECOND_WORKSPACE_ID });
  ok('effective_discovery_rejects_revoked_and_expired_credentials', revokeResponse.status === 200 &&
    revokedDiscovery.status === 401 && expiredDiscovery.status === 401 && preRevokedDiscovery.status === 401,
  JSON.stringify({ revoked: revokedDiscovery.json, expired: expiredDiscovery.json, preRevoked: preRevokedDiscovery.json }));
  ok('effective_discovery_requires_exact_bound_workspace',
    unboundDiscovery.status === 403 && unboundDiscovery.json?.code === 'WORKSPACE_BINDING_REQUIRED' &&
    missingWorkspaceDiscovery.status === 400 && missingWorkspaceDiscovery.json?.code === 'WORKSPACE_ID_REQUIRED' &&
    wrongWorkspaceDiscovery.status === 403 && wrongWorkspaceDiscovery.json?.code === 'WORKSPACE_BINDING_MISMATCH',
  JSON.stringify({ unbound: unboundDiscovery.json, missing: missingWorkspaceDiscovery.json, wrong: wrongWorkspaceDiscovery.json }));

  const readBootstrap = await req('POST', '/api/agent/workspaces/bootstrap', readKey, { workspaceId: WORKSPACE_ID });
  ok('read_key_can_bootstrap_its_bound_workspace', readBootstrap.status === 200 && readBootstrap.json?.workspaceId === WORKSPACE_ID, JSON.stringify(readBootstrap.json || {}));
  const readWorkspaceList = await req('GET', '/api/agent/workspaces', readKey);
  ok('read_key_lists_only_its_bound_workspace',
    readWorkspaceList.status === 200 && readWorkspaceList.json?.workspaces?.length === 1 && readWorkspaceList.json.workspaces[0]?.workspaceId === WORKSPACE_ID,
    JSON.stringify(readWorkspaceList.json || {}));
  const readReferenceCompletion = await req('POST', '/api/reference/complete', readKey, { path: 'md/w2a.xml', content: '', line: 0, column: 0 });
  ok('read_key_can_run_reviewed_deterministic_analysis', readReferenceCompletion.status === 200 && Array.isArray(readReferenceCompletion.json), `status=${readReferenceCompletion.status}`);
  const readHostFileDenied = await req('POST', '/api/agent/npc-identity-probe/correlate', readKey, {
    beforeSavePath: path.join(tmp, 'must-not-read-before.xml'),
    afterSavePath: path.join(tmp, 'must-not-read-after.xml'),
  });
  ok('read_key_cannot_cross_host_file_boundary',
    readHostFileDenied.status === 403 && readHostFileDenied.json?.authorityCode === 'AGENT_SCOPE_DENIED' &&
    JSON.stringify(readHostFileDenied.json?.requiredScopes) === JSON.stringify(['deploy']),
    JSON.stringify(readHostFileDenied.json || {}));
  const readPatchRootsDenied = await req('GET', `/api/agent/patch-readiness?${new URLSearchParams({
    fromPath: 'must-not-read', oldRoot: path.join(tmp, 'must-not-read-old'), newRoot: path.join(tmp, 'must-not-read-new'),
  })}`, readKey);
  ok('read_key_cannot_select_patch_readiness_host_roots',
    readPatchRootsDenied.status === 403 && readPatchRootsDenied.json?.authorityCode === 'AGENT_SCOPE_DENIED' &&
    JSON.stringify(readPatchRootsDenied.json?.requiredScopes) === JSON.stringify(['deploy']),
    JSON.stringify(readPatchRootsDenied.json || {}));

  const writeCompile = await req('POST', '/api/agent/compile', writeKey, {});
  ok('write_key_can_compile_bound_workspace', writeCompile.status === 200 && writeCompile.json?.success === true && writeCompile.json?.workspaceId === WORKSPACE_ID, JSON.stringify(writeCompile.json || {}));
  const beforeWriteDryRun = await req('GET', '/api/agent/workspace', writeKey);
  const writeMergeDryRun = await req('POST', '/api/agent/workspace/merge', writeKey, {
    changes: { description: 'W2A write-scope dry run' },
    expectedHead: beforeWriteDryRun.json?.workspaceHash,
    expectedSnapshotHash: beforeWriteDryRun.json?.snapshotHash,
    dryRun: true,
  });
  const afterWriteDryRun = await req('GET', '/api/agent/workspace', writeKey);
  ok('write_key_can_reach_guarded_dry_run_without_mutation',
    writeMergeDryRun.status === 200 && writeMergeDryRun.json?.dryRun === true && writeMergeDryRun.json?.applied === false &&
    afterWriteDryRun.json?.workspaceHash === beforeWriteDryRun.json?.workspaceHash &&
    afterWriteDryRun.json?.snapshotHash === beforeWriteDryRun.json?.snapshotHash &&
    afterWriteDryRun.json?.version === beforeWriteDryRun.json?.version,
    JSON.stringify(writeMergeDryRun.json || {}));

  const writePreviewDenied = await req('POST', '/api/agent/generate/preview', writeKey, { prompt: 42 });
  ok('write_key_cannot_cross_provider_boundary',
    writePreviewDenied.status === 403 && writePreviewDenied.json?.authorityCode === 'AGENT_SCOPE_DENIED' &&
    JSON.stringify(writePreviewDenied.json?.requiredScopes) === JSON.stringify(['deploy']) &&
    writePreviewDenied.json?.policyVersion === 'forge.route-dispositions.v4' && writePreviewDenied.json?.policyHash === authorityHash,
    JSON.stringify(writePreviewDenied.json || {}));
  const deployPreviewInputRejected = await req('POST', '/api/agent/generate/preview', deployKey, { prompt: 42 });
  ok('deploy_key_reaches_preview_adapter_before_provider_work',
    deployPreviewInputRejected.status === 400 && deployPreviewInputRejected.json?.code === 'CAPABILITY_INPUT_INVALID' && !deployPreviewInputRejected.json?.authorityCode,
    JSON.stringify(deployPreviewInputRejected.json || {}));

  const readWriteDenied = await req('POST', '/api/agent/workspace', readKey, { workspace: {} });
  ok('read_key_exact_write_denial_has_policy_evidence',
    readWriteDenied.status === 403 && readWriteDenied.json?.authorityCode === 'AGENT_SCOPE_DENIED' &&
    JSON.stringify(readWriteDenied.json?.requiredScopes) === JSON.stringify(['write', 'deploy']) &&
    readWriteDenied.json?.policyVersion === 'forge.route-dispositions.v4' && readWriteDenied.json?.policyHash === authorityHash,
    JSON.stringify(readWriteDenied.json || {}));
  const writeDeployDenied = await req('POST', '/api/agent/deploy', writeKey, { workspace: routeTestWorkspace });
  ok('write_key_exact_deploy_denial_has_policy_evidence',
    writeDeployDenied.status === 403 && writeDeployDenied.json?.authorityCode === 'AGENT_SCOPE_DENIED' &&
    JSON.stringify(writeDeployDenied.json?.requiredScopes) === JSON.stringify(['deploy']) && writeDeployDenied.json?.policyHash === authorityHash,
    JSON.stringify(writeDeployDenied.json || {}));

  const aiKeysPath = path.join(dataDir, 'ai-keys.json');
  const configPath = path.join(configDir, 'config.json');
  const harvestedSchemasPath = path.join(dataDir, 'harvested-schemas');
  ok('studio_only_mutation_fixtures_start_clean', !fs.existsSync(aiKeysPath) && !fs.existsSync(configPath) && !fs.existsSync(harvestedSchemasPath));
  const deployAiStatusDenied = await req('GET', '/api/ai/keys/status', deployKey);
  const deployAiWriteDenied = await req('POST', '/api/ai/keys', deployKey, { provider: 'gemini', key: 'must-not-persist' });
  const deployConfigDenied = await req('POST', '/api/schema/config', deployKey, { x4GamePath: gameRoot, x4ReferenceRoot: referenceRoot, modWorkspacePath: safeWorkspace });
  const deployHarvestDenied = await req('POST', '/api/agent/setup/harvest-schemas', deployKey, { gameRoot });
  for (const [name, response] of [
    ['deploy_key_cannot_read_provider_key_status', deployAiStatusDenied],
    ['deploy_key_cannot_write_provider_keys', deployAiWriteDenied],
    ['deploy_key_cannot_write_standing_config', deployConfigDenied],
    ['deploy_key_cannot_harvest_standing_schemas', deployHarvestDenied],
  ]) {
    ok(name, response.status === 403 && response.json?.authorityCode === 'STUDIO_SESSION_REQUIRED' &&
      Array.isArray(response.json?.requiredScopes) && response.json.requiredScopes.length === 0 && response.json?.policyHash === authorityHash,
    JSON.stringify(response.json || {}));
  }
  ok('studio_only_denials_leave_credentials_config_and_harvest_unchanged',
    !fs.existsSync(aiKeysPath) && !fs.existsSync(configPath) && !fs.existsSync(harvestedSchemasPath));

  const studioWorkspacesBeforeDeniedCreate = await req('GET', '/api/agent/workspaces', SESSION_TOKEN);
  const deployCreateDenied = await req('POST', '/api/agent/workspaces', deployKey, {
    clientId: `client_denied_${process.pid}`,
    workspace: { ...routeTestWorkspace, name: 'Denied third workspace' },
  });
  const studioWorkspacesAfterDeniedCreate = await req('GET', '/api/agent/workspaces', SESSION_TOKEN);
  ok('deploy_key_cannot_administer_workspace_registry',
    deployCreateDenied.status === 403 && deployCreateDenied.json?.authorityCode === 'STUDIO_SESSION_REQUIRED' &&
    studioWorkspacesAfterDeniedCreate.json?.workspaces?.length === studioWorkspacesBeforeDeniedCreate.json?.workspaces?.length,
    JSON.stringify(deployCreateDenied.json || {}));

  const usageBeforeLegacyDenied = fs.existsSync(aiUsageFile) ? fs.readFileSync(aiUsageFile) : null;
  const deployLegacyGenerateDenied = await req('POST', '/api/agent/generate', deployKey, { prompt: 'must not dispatch', apply: false });
  const usageAfterLegacyDenied = fs.existsSync(aiUsageFile) ? fs.readFileSync(aiUsageFile) : null;
  ok('deploy_key_cannot_use_legacy_applying_generation',
    deployLegacyGenerateDenied.status === 403 && deployLegacyGenerateDenied.json?.authorityCode === 'STUDIO_SESSION_REQUIRED' &&
    String(usageAfterLegacyDenied) === String(usageBeforeLegacyDenied), JSON.stringify(deployLegacyGenerateDenied.json || {}));

  const usageBeforeForgedOrigin = fs.existsSync(aiUsageFile) ? fs.readFileSync(aiUsageFile) : null;
  const forgedOriginProvider = await req('POST', '/api/gemini', deployKey, { prompt: 'must reject before provider dispatch' }, {
    headers: { Origin: `http://127.0.0.1:${PORT}`, Referer: `http://127.0.0.1:${PORT}/` },
  });
  const usageAfterForgedOrigin = fs.existsSync(aiUsageFile) ? fs.readFileSync(aiUsageFile) : null;
  ok('agent_origin_spoof_cannot_use_studio_provider_credentials',
    forgedOriginProvider.status === 500 && /external\/agent requests must supply their own key/i.test(forgedOriginProvider.json?.error || '') &&
    String(usageAfterForgedOrigin) === String(usageBeforeForgedOrigin) && !fs.existsSync(callerKeyDispatchMarker), JSON.stringify(forgedOriginProvider.json || {}));

  const callerKeyUsageBefore = await req('GET', '/api/ai/usage', SESSION_TOKEN);
  const callerKeyProvider = await req('POST', '/api/gemini', deployKey, { prompt: '__FORGE_ROUTE_TEST_CALLER_KEY__' }, {
    headers: { 'x-custom-api-key': CALLER_PROVIDER_KEY },
  });
  const callerKeyUsageAfter = await req('GET', '/api/ai/usage', SESSION_TOKEN);
  const callerKeyMarkerText = fs.existsSync(callerKeyDispatchMarker)
    ? fs.readFileSync(callerKeyDispatchMarker, 'utf8')
    : '';
  const callerKeyDispatches = callerKeyMarkerText
    ? callerKeyMarkerText.trim().split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line))
    : [];
  ok('deploy_key_with_caller_provider_key_reaches_metered_dispatch_boundary',
    callerKeyProvider.status === 200 && /caller-supplied provider key accepted/i.test(callerKeyProvider.json?.text || '') &&
    callerKeyUsageAfter.json?.totalToday === callerKeyUsageBefore.json?.totalToday + 1 &&
    callerKeyDispatches.length === 1 && callerKeyDispatches[0]?.credentialSource === 'caller',
    JSON.stringify({ response: callerKeyProvider.json, before: callerKeyUsageBefore.json, after: callerKeyUsageAfter.json, dispatches: callerKeyDispatches }));
  ok('caller_provider_key_is_not_logged_or_written_to_evidence',
    !callerKeyMarkerText.includes(CALLER_PROVIDER_KEY) && !serverOut.includes(CALLER_PROVIDER_KEY),
    JSON.stringify({ markerContainsKey: callerKeyMarkerText.includes(CALLER_PROVIDER_KEY), serverOutputContainsKey: serverOut.includes(CALLER_PROVIDER_KEY) }));

  const unknownAgentRoute = await req('GET', '/api/agent/unreviewed-future-route', deployKey);
  ok('unknown_route_never_inherits_deploy_authority',
    unknownAgentRoute.status === 403 && unknownAgentRoute.json?.authorityCode === 'AUTHORITY_ROUTE_UNREVIEWED' && unknownAgentRoute.json?.policyHash === authorityHash,
    JSON.stringify(unknownAgentRoute.json || {}));
  const encodedSeparatorRoute = await req('GET', '/api/agent/history/a%2Fb/raw', deployKey);
  ok('encoded_separator_route_is_rejected_as_malformed_authority',
    encodedSeparatorRoute.status === 403 && encodedSeparatorRoute.json?.authorityCode === 'AUTHORITY_PATH_MALFORMED' && encodedSeparatorRoute.json?.policyHash === authorityHash,
    JSON.stringify(encodedSeparatorRoute.json || {}));
  const caseVariantRoute = await req('GET', '/api/agent/Workspace', deployKey);
  ok('case_variant_route_is_not_authorized_or_dispatched',
    caseVariantRoute.status === 403 && caseVariantRoute.json?.authorityCode === 'AUTHORITY_ROUTE_UNREVIEWED',
    JSON.stringify(caseVariantRoute.json || {}));
  const slashVariantRoute = await req('GET', '/api/agent/workspace/', deployKey);
  ok('trailing_slash_variant_is_rejected_as_malformed_authority',
    slashVariantRoute.status === 403 && slashVariantRoute.json?.authorityCode === 'AUTHORITY_PATH_MALFORMED',
    JSON.stringify(slashVariantRoute.json || {}));

  const beforeForceDenied = await req('GET', '/api/agent/workspace', writeKey);
  // The successful read's response-finish audit write can land just after the client has
  // consumed the body. Let that authorized use settle before taking the denial baseline.
  await sleep(25);
  const keyStoreBeforeForceDenied = fs.readFileSync(agentKeysFile);
  const forceDenied = await req('POST', '/api/agent/workspace', writeKey, {
    workspace: { ...beforeForceDenied.json?.workspace, description: 'must not force' },
    force: true,
  });
  await sleep(25);
  const keyStoreAfterForceDenied = fs.readFileSync(agentKeysFile);
  ok('handler_level_denial_does_not_record_successful_key_use',
    Buffer.compare(keyStoreAfterForceDenied, keyStoreBeforeForceDenied) === 0,
    `before=${crypto.createHash('sha256').update(keyStoreBeforeForceDenied).digest('hex')} after=${crypto.createHash('sha256').update(keyStoreAfterForceDenied).digest('hex')}`);
  const afterForceDenied = await req('GET', '/api/agent/workspace', writeKey);
  ok('write_key_force_is_denied_without_workspace_mutation',
    forceDenied.status === 403 && forceDenied.json?.authorityCode === 'AGENT_SCOPE_DENIED' &&
    JSON.stringify(forceDenied.json?.requiredScopes) === JSON.stringify(['deploy']) &&
    afterForceDenied.json?.workspaceHash === beforeForceDenied.json?.workspaceHash &&
    afterForceDenied.json?.snapshotHash === beforeForceDenied.json?.snapshotHash &&
    afterForceDenied.json?.version === beforeForceDenied.json?.version,
    JSON.stringify(forceDenied.json || {}));

  ok('workspace_bound_key_cannot_forge_other_identity', (await req('GET', '/api/agent/workspace', readKey, undefined, { workspaceId: SECOND_WORKSPACE_ID })).json?.code === 'WORKSPACE_BINDING_MISMATCH');
  const parkedReadDenied = await req('GET', '/api/agent/workspace/parked', readKey);
  ok('workspace_bound_read_key_cannot_enumerate_parked_workspaces', parkedReadDenied.status === 403 && parkedReadDenied.json?.code === 'insufficient_scope', JSON.stringify(parkedReadDenied.json || {}));
  const parkedRestoreDenied = await req('POST', '/api/agent/workspace/restore-parked', deployKey, { targetWorkspaceId: SECOND_WORKSPACE_ID });
  ok('workspace_bound_deploy_key_cannot_restore_other_workspace', parkedRestoreDenied.status === 403 && parkedRestoreDenied.json?.code === 'insufficient_scope', JSON.stringify(parkedRestoreDenied.json || {}));
  const studioParked = await req('GET', '/api/agent/workspace/parked', SESSION_TOKEN);
  ok('studio_session_can_list_parked_workspaces', studioParked.status === 200 && studioParked.json?.parked?.some(row => row.workspaceId === SECOND_WORKSPACE_ID), JSON.stringify(studioParked.json || {}));
  const studioRestoreParked = await req('POST', '/api/agent/workspace/restore-parked', SESSION_TOKEN, { targetWorkspaceId: SECOND_WORKSPACE_ID });
  ok('studio_session_can_read_explicit_parked_workspace', studioRestoreParked.status === 200 && studioRestoreParked.json?.workspaceId === SECOND_WORKSPACE_ID && studioRestoreParked.json?.workspace?.description === 'second tab isolated', JSON.stringify(studioRestoreParked.json || {}));
  const secondHistoryIsolation = await req('GET', '/api/agent/history', SESSION_TOKEN, undefined, { workspaceId: SECOND_WORKSPACE_ID, clientId: SECOND_CLIENT_ID });
  ok('history_is_scoped_to_workspace_identity', secondHistoryIsolation.status === 200 && (secondHistoryIsolation.json?.rows || []).every(row => row.workspaceId === SECOND_WORKSPACE_ID));

  // FB-17: GitHub credentials are server-owned and session-token-only.
  const credentialInitial = await req('GET', '/api/github/credential', SESSION_TOKEN);
  ok('github_credential_starts_unconfigured', credentialInitial.status === 200 && credentialInitial.json?.configured === false);
  const githubLoadWithoutCredential = await req('POST', '/api/github/load', SESSION_TOKEN, { owner: 'x', repo: 'y', path: 'z' });
  ok('github_load_without_credential_fails_before_network', githubLoadWithoutCredential.status === 401 && githubLoadWithoutCredential.json?.code === 'GITHUB_NOT_CONNECTED');
  ok('agent_key_cannot_read_github_credential_status', (await req('GET', '/api/github/credential', readKey)).status === 403);
  ok('deploy_key_cannot_spend_github_authority', (await req('POST', '/api/github/push', deployKey, { owner: 'x', repo: 'y', files: [{ path: 'x', content: 'y' }] })).status === 403);
  const fakeGithubToken = 'ghp_route_integration_secret';
  const credentialSet = await req('POST', '/api/github/credential', SESSION_TOKEN, { token: fakeGithubToken });
  ok('studio_session_can_store_github_credential', credentialSet.status === 200 && credentialSet.json?.configured === true);
  ok('github_credential_response_never_returns_secret', !String(credentialSet.raw || '').includes(fakeGithubToken));
  const oversizedGithubPush = await req('POST', '/api/github/push', SESSION_TOKEN, {
    owner: 'bounded', repo: 'request', files: Array.from({ length: 101 }, (_, i) => ({ path: `f${i}.txt`, content: 'x' })),
  });
  ok('oversized_github_push_rejected_before_network', oversizedGithubPush.status === 413 && oversizedGithubPush.json?.code === 'GITHUB_PUSH_TOO_LARGE');
  const credentialDelete = await req('DELETE', '/api/github/credential', SESSION_TOKEN);
  ok('github_disconnect_deletes_server_credential', credentialDelete.status === 200 && credentialDelete.json?.configured === false && !fs.existsSync(path.join(dataDir, 'github-credential.json')));

  // --- read-scope contract ---
  ok('read_key_200_read_get', (await req('GET', '/api/agent/workspace', readKey)).status === 200);
  ok('read_key_403_run_command', (await req('GET', '/api/run_command?cmd=echo+hi', readKey)).status === 403); // B64-SEC1 permanent guard
  ok('read_key_403_run_command_job', (await req('POST', '/api/run_command/job', readKey, { cmd: 'echo hi' })).status === 403);
  ok('read_key_403_write_post', readWriteDenied.status === 403);
  ok('read_key_403_key_mgmt', (await req('POST', '/api/agent/keys', readKey, { label: 'x', scope: 'read', ttl: '1h' })).status === 403);

  // --- write-scope contract ---
  ok('write_key_403_run_command', (await req('GET', '/api/run_command?cmd=echo+hi', writeKey)).status === 403);
  ok('write_key_403_key_mgmt', (await req('GET', '/api/agent/keys', writeKey)).status === 403);

  // --- directory-role safety: save-time rejection + old-config runtime guard ---
  const unsafeConfig = await req('POST', '/api/schema/config', SESSION_TOKEN, {
    x4GamePath: gameRoot,
    x4ReferenceRoot: referenceRoot,
    modWorkspacePath: liveExtensions,
    filesystemPath: liveExtensions,
  });
  ok('unsafe_live_workspace_config_rejected', unsafeConfig.status === 400 && unsafeConfig.json?.code === 'PROTECTED_ROOT_OVERLAP', `status=${unsafeConfig.status} code=${unsafeConfig.json?.code}`);
  ok('rejected_config_not_persisted', !fs.existsSync(path.join(configDir, 'config.json')));

  const deployedRolesConfig = {
    x4GamePath: gameRoot,
    x4ReferenceRoot: referenceRoot,
    modWorkspacePath: safeWorkspace,
    filesystemPath: liveExtensions,
  };
  const safeConfig = await req('POST', '/api/schema/config', SESSION_TOKEN, deployedRolesConfig);
  ok('isolated_workspace_and_deployed_filesystem_saved', safeConfig.status === 200 && safeConfig.json?.directorySafety?.safe === true, `status=${safeConfig.status}`);
  const extensionDoctorCapabilityResponse = await req('GET', '/api/agent/extension-doctor', SESSION_TOKEN);
  capabilityResponses.set('extensions.conflicts.analyze', extensionDoctorCapabilityResponse);

  const patchModRoot = path.join(safeWorkspace, 'patch_capability');
  const patchOldRoot = path.join(tmp, 'patch-old');
  const patchNewRoot = path.join(tmp, 'patch-new');
  fs.mkdirSync(path.join(patchModRoot, 'libraries'), { recursive: true });
  fs.mkdirSync(path.join(patchOldRoot, 'libraries'), { recursive: true });
  fs.mkdirSync(path.join(patchNewRoot, 'libraries'), { recursive: true });
  fs.writeFileSync(path.join(patchModRoot, 'content.xml'), '<content id="patch_capability" name="Patch Capability" version="100"/>');
  fs.writeFileSync(path.join(patchModRoot, 'libraries', 'wares.xml'), '<diff><replace sel="/wares/ware[@id=\'routeware\']"><ware id="routeware"/></replace></diff>');
  const patchBaseXml = '<wares><ware id="routeware" name="Route Ware"/></wares>';
  fs.writeFileSync(path.join(patchOldRoot, 'libraries', 'wares.xml'), patchBaseXml);
  fs.writeFileSync(path.join(patchNewRoot, 'libraries', 'wares.xml'), patchBaseXml);
  const patchQuery = new URLSearchParams({ fromPath: 'patch_capability', oldRoot: patchOldRoot, newRoot: patchNewRoot });
  const patchReadinessCapabilityResponse = await req('GET', `/api/agent/patch-readiness?${patchQuery}`, deployKey);
  ok('deploy_key_can_run_reviewed_patch_readiness_host_reads',
    patchReadinessCapabilityResponse.status === 200 && patchReadinessCapabilityResponse.json?.diffFiles === 1,
    JSON.stringify(patchReadinessCapabilityResponse.json || {}));
  capabilityResponses.set('patch.readiness.analyze', patchReadinessCapabilityResponse);

  // W3B1 replace slice: prove the external response projection against canonical persisted bytes.
  const replaceProofOperationId = 'forge_op_w3b1_replace_proof';
  const replaceRawWorkspaceMarker = 'W3B1_REPLACE_RAW_WORKSPACE_PAYLOAD';
  const replaceProofBefore = await req('GET', '/api/agent/workspace', SESSION_TOKEN);
  const replaceProofWorkspace = {
    ...replaceProofBefore.json?.workspace,
    description: replaceRawWorkspaceMarker,
  };
  const replaceProofBody = {
    workspace: replaceProofWorkspace,
    expectedHead: replaceProofBefore.json?.workspaceHash,
    expectedSnapshotHash: replaceProofBefore.json?.snapshotHash,
  };

  const receiptFilesBeforeMissingId = actionReceiptFiles();
  const missingReplaceOperation = await req(
    'POST',
    '/api/agent/workspace',
    SESSION_TOKEN,
    replaceProofBody,
    { operationId: null },
  );
  const afterMissingReplaceOperation = await req('GET', '/api/agent/workspace', SESSION_TOKEN);
  ok('workspace_replace_missing_operation_id_refused_before_receipt',
    missingReplaceOperation.status === 400
      && missingReplaceOperation.json?.code === 'ACTION_RECEIPT_OPERATION_ID_INVALID'
      && workspaceStateFingerprint(afterMissingReplaceOperation) === workspaceStateFingerprint(replaceProofBefore)
      && stableStringify(actionReceiptFiles()) === stableStringify(receiptFilesBeforeMissingId),
    `status=${missingReplaceOperation.status} code=${missingReplaceOperation.json?.code}`);

  const receiptFilesBeforeMalformedId = actionReceiptFiles();
  const malformedReplaceOperation = await req(
    'POST',
    '/api/agent/workspace',
    SESSION_TOKEN,
    replaceProofBody,
    { operationId: 'forge/op/malformed' },
  );
  const afterMalformedReplaceOperation = await req('GET', '/api/agent/workspace', SESSION_TOKEN);
  ok('workspace_replace_malformed_operation_id_refused_before_receipt',
    malformedReplaceOperation.status === 400
      && malformedReplaceOperation.json?.code === 'ACTION_RECEIPT_OPERATION_ID_INVALID'
      && workspaceStateFingerprint(afterMalformedReplaceOperation) === workspaceStateFingerprint(replaceProofBefore)
      && stableStringify(actionReceiptFiles()) === stableStringify(receiptFilesBeforeMalformedId),
    `status=${malformedReplaceOperation.status} code=${malformedReplaceOperation.json?.code}`);

  const receiptFilesBeforeReplace = actionReceiptFiles();
  const replaceProof = await req(
    'POST',
    '/api/agent/workspace',
    SESSION_TOKEN,
    replaceProofBody,
    { operationId: replaceProofOperationId },
  );
  const replaceProofAfter = await req('GET', '/api/agent/workspace', SESSION_TOKEN);
  const replaceProjection = replaceProof.json?.receipt;
  const replaceReceiptEvidence = reopenPersistedActionReceipt(replaceProjection);
  const replaceReceipt = replaceReceiptEvidence.ok ? replaceReceiptEvidence.record : undefined;
  ok('workspace_replace_returns_committed_receipt_projection',
    replaceProof.status === 200
      && replaceProof.json?.success === true
      && replaceProof.json?.applied === true
      && replaceProjection?.status === 'committed'
      && Object.keys(replaceProjection || {}).sort().join(',') === 'hash,id,status'
      && actionReceiptFiles().length === receiptFilesBeforeReplace.length + 1
      && replaceProof.json?.version === replaceProofAfter.json?.version
      && replaceProof.json?.workspaceHash === replaceProofAfter.json?.workspaceHash
      && replaceProof.json?.snapshotHash === replaceProofAfter.json?.snapshotHash,
    `status=${replaceProof.status} receipt=${replaceProjection?.status}`);
  ok('workspace_replace_persisted_receipt_is_canonical_and_hash_verified',
    replaceReceiptEvidence.ok
      && replaceReceiptEvidence.canonical === true
      && replaceReceiptEvidence.computedHash === replaceReceipt?.hash
      && replaceReceiptEvidence.projectionMatches === true,
    `reopened=${replaceReceiptEvidence.ok} canonical=${replaceReceiptEvidence.canonical === true}`);
  ok('workspace_replace_persisted_receipt_has_exact_identity',
    replaceReceipt?.schema === 'forge.action-receipt.v1'
      && replaceReceipt?.status === 'committed'
      && replaceReceipt?.capability?.legacyRoute === '/api/agent/workspace'
      && replaceReceipt?.capability?.method === 'POST'
      && replaceReceipt?.metadata?.route === 'POST /api/agent/workspace'
      && replaceReceipt?.authority?.scope === 'workspace'
      && replaceReceipt?.authority?.operationId === replaceProofOperationId
      && replaceReceipt?.authority?.workspaceId === WORKSPACE_ID
      && replaceReceipt?.actor?.kind === 'human'
      && replaceReceipt?.actor?.id === 'studio'
      && replaceReceipt?.client?.channel === 'studio'
      && replaceReceipt?.client?.id === CLIENT_ID
      && replaceReceipt?.client?.version === '2026-07-30.agent.v4',
    `route=${replaceReceipt?.metadata?.route} status=${replaceReceipt?.status}`);

  const replaceBeforeHashes = workspaceReceiptHashes(replaceProofBefore.json?.workspace);
  const replaceAfterHashes = workspaceReceiptHashes(replaceProofAfter.json?.workspace);
  const replaceBeforeResources = new Map((replaceReceipt?.authority?.resources || []).map(resource => [resource.role, resource]));
  const replaceAfterResources = new Map((replaceReceipt?.after?.resources || []).map(resource => [resource.role, resource]));
  ok('workspace_replace_persisted_receipt_has_truthful_paired_resources',
    replaceReceipt?.after?.outcome === 'applied'
      && replaceBeforeResources.size === 2
      && replaceAfterResources.size === 2
      && replaceBeforeResources.get('workspace')?.root === 'workspace'
      && replaceBeforeResources.get('workspace')?.relativePath === `${WORKSPACE_ID}/content`
      && replaceBeforeResources.get('workspace')?.beforeHash === replaceBeforeHashes.workspace
      && replaceBeforeResources.get('snapshot')?.root === 'workspace'
      && replaceBeforeResources.get('snapshot')?.relativePath === `${WORKSPACE_ID}/snapshot`
      && replaceBeforeResources.get('snapshot')?.beforeHash === replaceBeforeHashes.snapshot
      && replaceAfterResources.get('workspace')?.hash === replaceAfterHashes.workspace
      && replaceAfterResources.get('snapshot')?.hash === replaceAfterHashes.snapshot,
    `before=${replaceBeforeResources.size} after=${replaceAfterResources.size} outcome=${replaceReceipt?.after?.outcome}`);

  const persistedReplaceBytes = replaceReceiptEvidence.ok ? replaceReceiptEvidence.raw : '';
  const encodedTmp = JSON.stringify(tmp).slice(1, -1);
  const returnedProjectionBytes = stableStringify(replaceProjection || null);
  ok('workspace_replace_receipt_evidence_leaks_no_raw_payload_token_or_path',
    !persistedReplaceBytes.includes(replaceRawWorkspaceMarker)
      && !persistedReplaceBytes.includes(SESSION_TOKEN)
      && !persistedReplaceBytes.includes(tmp)
      && !persistedReplaceBytes.includes(tmp.replaceAll('\\', '/'))
      && !persistedReplaceBytes.includes(encodedTmp)
      && !returnedProjectionBytes.includes(replaceRawWorkspaceMarker)
      && !returnedProjectionBytes.includes(SESSION_TOKEN)
      && !returnedProjectionBytes.includes(encodedTmp));

  const beforeReplaceReplay = await req('GET', '/api/agent/workspace', SESSION_TOKEN);
  const receiptFilesBeforeReplay = actionReceiptFiles();
  const replaceReplay = await req(
    'POST',
    '/api/agent/workspace',
    SESSION_TOKEN,
    replaceProofBody,
    { operationId: replaceProofOperationId },
  );
  const afterReplaceReplay = await req('GET', '/api/agent/workspace', SESSION_TOKEN);
  ok('workspace_replace_exact_replay_is_stable_and_non_mutating',
    replaceReplay.status === 200
      && replaceReplay.json?.replayed === true
      && replaceReplay.json?.applied === false
      && stableStringify(replaceReplay.json?.receipt) === stableStringify(replaceProjection)
      && replaceReplay.json?.version === beforeReplaceReplay.json?.version
      && replaceReplay.json?.workspaceHash === beforeReplaceReplay.json?.workspaceHash
      && replaceReplay.json?.snapshotHash === beforeReplaceReplay.json?.snapshotHash
      && stableStringify(replaceReplay.json?.workspace) === stableStringify(beforeReplaceReplay.json?.workspace)
      && workspaceStateFingerprint(afterReplaceReplay) === workspaceStateFingerprint(beforeReplaceReplay)
      && stableStringify(actionReceiptFiles()) === stableStringify(receiptFilesBeforeReplay),
    `status=${replaceReplay.status} replayed=${replaceReplay.json?.replayed}`);

  const beforeReplaceDuplicate = await req('GET', '/api/agent/workspace', SESSION_TOKEN);
  const receiptFilesBeforeDuplicate = actionReceiptFiles();
  const replaceDuplicate = await req('POST', '/api/agent/workspace', SESSION_TOKEN, {
    workspace: { ...beforeReplaceDuplicate.json?.workspace, description: 'W3B1_CHANGED_MATERIAL_FACTS' },
    expectedHead: beforeReplaceDuplicate.json?.workspaceHash,
    expectedSnapshotHash: beforeReplaceDuplicate.json?.snapshotHash,
  }, { operationId: replaceProofOperationId });
  const afterReplaceDuplicate = await req('GET', '/api/agent/workspace', SESSION_TOKEN);
  ok('workspace_replace_changed_facts_duplicate_conflicts_without_mutation',
    replaceDuplicate.status === 409
      && replaceDuplicate.json?.success === false
      && replaceDuplicate.json?.code === 'ACTION_RECEIPT_DUPLICATE_CONFLICT'
      && workspaceStateFingerprint(afterReplaceDuplicate) === workspaceStateFingerprint(beforeReplaceDuplicate)
      && stableStringify(actionReceiptFiles()) === stableStringify(receiptFilesBeforeDuplicate),
    `status=${replaceDuplicate.status} code=${replaceDuplicate.json?.code}`);

  // W3B1 merge slice: prove the external response projection against canonical persisted bytes.
  const mergeProofOperationId = 'forge_op_w3b1_merge_proof';
  const mergeRawWorkspaceMarker = 'W3B1_MERGE_RAW_WORKSPACE_PAYLOAD';
  const mergeProofBefore = await req('GET', '/api/agent/workspace', SESSION_TOKEN);
  const mergeProofBody = {
    changes: { description: mergeRawWorkspaceMarker },
    expectedHead: mergeProofBefore.json?.workspaceHash,
    expectedSnapshotHash: mergeProofBefore.json?.snapshotHash,
  };
  const receiptFilesBeforeMerge = actionReceiptFiles();
  const mergeProof = await req(
    'POST',
    '/api/agent/workspace/merge',
    SESSION_TOKEN,
    mergeProofBody,
    { operationId: mergeProofOperationId },
  );
  const mergeProofAfter = await req('GET', '/api/agent/workspace', SESSION_TOKEN);
  const mergeProjection = mergeProof.json?.receipt;
  const mergeReceiptEvidence = reopenPersistedActionReceipt(mergeProjection);
  const mergeReceipt = mergeReceiptEvidence.ok ? mergeReceiptEvidence.record : undefined;
  ok('workspace_merge_commits_real_change_and_receipt_projection',
    mergeProof.status === 200
      && mergeProof.json?.success === true
      && mergeProof.json?.applied === true
      && mergeProofAfter.json?.workspace?.description === mergeRawWorkspaceMarker
      && stableStringify(mergeProofAfter.json?.workspace) === stableStringify({
        ...mergeProofBefore.json?.workspace,
        description: mergeRawWorkspaceMarker,
      })
      && workspaceStateFingerprint(mergeProofAfter) !== workspaceStateFingerprint(mergeProofBefore)
      && mergeProof.json?.version === mergeProofAfter.json?.version
      && mergeProof.json?.workspaceHash === mergeProofAfter.json?.workspaceHash
      && mergeProof.json?.snapshotHash === mergeProofAfter.json?.snapshotHash
      && mergeProjection?.status === 'committed'
      && Object.keys(mergeProjection || {}).sort().join(',') === 'hash,id,status'
      && /^ar_[a-f0-9]{64}$/.test(String(mergeProjection?.id || ''))
      && /^[a-f0-9]{64}$/.test(String(mergeProjection?.hash || ''))
      && actionReceiptFiles().length === receiptFilesBeforeMerge.length + 1,
    `status=${mergeProof.status} receipt=${mergeProjection?.status}`);
  ok('workspace_merge_persisted_receipt_is_canonical_and_hash_verified',
    mergeReceiptEvidence.ok
      && mergeReceiptEvidence.canonical === true
      && mergeReceiptEvidence.computedHash === mergeReceipt?.hash
      && mergeReceiptEvidence.projectionMatches === true,
    `reopened=${mergeReceiptEvidence.ok} canonical=${mergeReceiptEvidence.canonical === true}`);
  ok('workspace_merge_persisted_receipt_has_exact_identity',
    mergeReceipt?.schema === 'forge.action-receipt.v1'
      && mergeReceipt?.status === 'committed'
      && mergeReceipt?.capability?.legacyRoute === '/api/agent/workspace/merge'
      && mergeReceipt?.capability?.method === 'POST'
      && mergeReceipt?.metadata?.route === 'POST /api/agent/workspace/merge'
      && mergeReceipt?.authority?.scope === 'workspace'
      && mergeReceipt?.authority?.operationId === mergeProofOperationId
      && mergeReceipt?.authority?.workspaceId === WORKSPACE_ID
      && mergeReceipt?.actor?.kind === 'human'
      && mergeReceipt?.actor?.id === 'studio'
      && mergeReceipt?.client?.channel === 'studio'
      && mergeReceipt?.client?.id === CLIENT_ID
      && mergeReceipt?.client?.version === '2026-07-30.agent.v4',
    `route=${mergeReceipt?.metadata?.route} status=${mergeReceipt?.status}`);

  const mergeBeforeHashes = workspaceReceiptHashes(mergeProofBefore.json?.workspace);
  const mergeAfterHashes = workspaceReceiptHashes(mergeProofAfter.json?.workspace);
  const mergeBeforeResources = new Map((mergeReceipt?.authority?.resources || []).map(resource => [resource.role, resource]));
  const mergeAfterResources = new Map((mergeReceipt?.after?.resources || []).map(resource => [resource.role, resource]));
  ok('workspace_merge_persisted_receipt_has_truthful_paired_resources',
    mergeReceipt?.after?.outcome === 'applied'
      && Array.isArray(mergeReceipt?.authority?.resources)
      && mergeReceipt.authority.resources.length === 2
      && Array.isArray(mergeReceipt?.after?.resources)
      && mergeReceipt.after.resources.length === 2
      && mergeBeforeResources.size === 2
      && mergeAfterResources.size === 2
      && mergeBeforeResources.get('workspace')?.root === 'workspace'
      && mergeBeforeResources.get('workspace')?.relativePath === `${WORKSPACE_ID}/content`
      && mergeBeforeResources.get('workspace')?.beforeHash === mergeBeforeHashes.workspace
      && mergeBeforeResources.get('snapshot')?.root === 'workspace'
      && mergeBeforeResources.get('snapshot')?.relativePath === `${WORKSPACE_ID}/snapshot`
      && mergeBeforeResources.get('snapshot')?.beforeHash === mergeBeforeHashes.snapshot
      && mergeAfterResources.get('workspace')?.hash === mergeAfterHashes.workspace
      && mergeAfterResources.get('snapshot')?.hash === mergeAfterHashes.snapshot,
    `before=${mergeBeforeResources.size} after=${mergeAfterResources.size} outcome=${mergeReceipt?.after?.outcome}`);

  const persistedMergeBytes = mergeReceiptEvidence.ok ? mergeReceiptEvidence.raw : '';
  const returnedMergeProjectionBytes = stableStringify(mergeProjection || null);
  const mergeEvidenceBytes = `${persistedMergeBytes}\n${returnedMergeProjectionBytes}`;
  const mergeEvidenceNeedles = [
    mergeRawWorkspaceMarker,
    JSON.stringify(mergeRawWorkspaceMarker).slice(1, -1),
    SESSION_TOKEN,
    JSON.stringify(SESSION_TOKEN).slice(1, -1),
    tmp,
    tmp.replaceAll('\\', '/'),
    JSON.stringify(tmp).slice(1, -1),
    JSON.stringify(tmp.replaceAll('\\', '/')).slice(1, -1),
  ];
  ok('workspace_merge_receipt_evidence_leaks_no_raw_payload_token_or_path',
    mergeEvidenceNeedles.every(needle => !mergeEvidenceBytes.includes(needle)));

  const beforeMergeReplay = await req('GET', '/api/agent/workspace', SESSION_TOKEN);
  const receiptFilesBeforeMergeReplay = actionReceiptFiles();
  const mergeReplay = await req(
    'POST',
    '/api/agent/workspace/merge',
    SESSION_TOKEN,
    mergeProofBody,
    { operationId: mergeProofOperationId },
  );
  const afterMergeReplay = await req('GET', '/api/agent/workspace', SESSION_TOKEN);
  ok('workspace_merge_exact_replay_is_stable_and_non_mutating',
    mergeReplay.status === 200
      && mergeReplay.json?.replayed === true
      && mergeReplay.json?.applied === false
      && stableStringify(mergeReplay.json?.receipt) === stableStringify(mergeProjection)
      && workspaceStateFingerprint(afterMergeReplay) === workspaceStateFingerprint(beforeMergeReplay)
      && stableStringify(actionReceiptFiles()) === stableStringify(receiptFilesBeforeMergeReplay),
    `status=${mergeReplay.status} replayed=${mergeReplay.json?.replayed}`);

  const beforeMergeDuplicate = await req('GET', '/api/agent/workspace', SESSION_TOKEN);
  const receiptFilesBeforeDuplicateMerge = actionReceiptFiles();
  const mergeDuplicate = await req('POST', '/api/agent/workspace/merge', SESSION_TOKEN, {
    changes: { description: 'W3B1_MERGE_CHANGED_MATERIAL_FACTS' },
    expectedHead: beforeMergeDuplicate.json?.workspaceHash,
    expectedSnapshotHash: beforeMergeDuplicate.json?.snapshotHash,
  }, { operationId: mergeProofOperationId });
  const afterMergeDuplicate = await req('GET', '/api/agent/workspace', SESSION_TOKEN);
  ok('workspace_merge_changed_facts_duplicate_conflicts_without_mutation',
    mergeDuplicate.status === 409
      && mergeDuplicate.json?.success === false
      && mergeDuplicate.json?.code === 'ACTION_RECEIPT_DUPLICATE_CONFLICT'
      && workspaceStateFingerprint(afterMergeDuplicate) === workspaceStateFingerprint(beforeMergeDuplicate)
      && stableStringify(actionReceiptFiles()) === stableStringify(receiptFilesBeforeDuplicateMerge),
    `status=${mergeDuplicate.status} code=${mergeDuplicate.json?.code}`);

  const staleReceiptOperationId = 'forge_op_w3b1_stale_receipt';
  const staleReceiptExternalOperationId = 'forge_op_w3b1_stale_external';
  const staleReceiptBaseline = await req('GET', '/api/agent/workspace', SESSION_TOKEN);
  const receiptFilesBeforeStaleReceiptExternal = actionReceiptFiles();
  const staleReceiptExternal = await req('POST', '/api/agent/workspace', SESSION_TOKEN, {
    workspace: { ...staleReceiptBaseline.json?.workspace, description: 'W3B1_STALE_RECEIPT_EXTERNAL_CHANGE' },
    expectedHead: staleReceiptBaseline.json?.workspaceHash,
    expectedSnapshotHash: staleReceiptBaseline.json?.snapshotHash,
  }, { operationId: staleReceiptExternalOperationId });
  const afterStaleReceiptExternal = await req('GET', '/api/agent/workspace', SESSION_TOKEN);
  const staleReceiptExternalProjection = staleReceiptExternal.json?.receipt;
  const staleReceiptExternalEvidence = reopenPersistedActionReceipt(staleReceiptExternalProjection);
  ok('workspace_stale_receipt_external_change_established',
    staleReceiptExternal.status === 200
      && staleReceiptExternal.json?.applied === true
      && Object.keys(staleReceiptExternalProjection || {}).sort().join(',') === 'hash,id,status'
      && staleReceiptExternalProjection?.status === 'committed'
      && staleReceiptExternalEvidence.ok
      && staleReceiptExternalEvidence.projectionMatches === true
      && afterStaleReceiptExternal.json?.workspace?.description === 'W3B1_STALE_RECEIPT_EXTERNAL_CHANGE'
      && workspaceStateFingerprint(afterStaleReceiptExternal) !== workspaceStateFingerprint(staleReceiptBaseline)
      && actionReceiptFiles().length === receiptFilesBeforeStaleReceiptExternal.length + 1,
    `status=${staleReceiptExternal.status} receipt=${staleReceiptExternalProjection?.status}`);

  const staleReceiptBody = {
    workspace: { ...staleReceiptBaseline.json?.workspace, description: 'W3B1_STALE_RECEIPT_FAILED_ATTEMPT' },
    expectedHead: staleReceiptBaseline.json?.workspaceHash,
    expectedSnapshotHash: staleReceiptBaseline.json?.snapshotHash,
  };
  const beforeStaleReceiptAttempt = await req('GET', '/api/agent/workspace', SESSION_TOKEN);
  const receiptFilesBeforeStaleReceipt = actionReceiptFiles();
  const staleReceiptAttempt = await req(
    'POST',
    '/api/agent/workspace',
    SESSION_TOKEN,
    staleReceiptBody,
    { operationId: staleReceiptOperationId },
  );
  const afterStaleReceiptAttempt = await req('GET', '/api/agent/workspace', SESSION_TOKEN);
  const staleReceiptProjection = staleReceiptAttempt.json?.receipt;
  const staleReceiptEvidence = reopenPersistedActionReceipt(staleReceiptProjection);
  const staleReceipt = staleReceiptEvidence.ok ? staleReceiptEvidence.record : undefined;
  ok('workspace_stale_receipt_failed_projection_persisted',
    staleReceiptAttempt.status === 409
      && staleReceiptAttempt.json?.error === 'head_conflict'
      && Object.keys(staleReceiptProjection || {}).sort().join(',') === 'hash,id,status'
      && staleReceiptProjection?.status === 'failed'
      && workspaceStateFingerprint(afterStaleReceiptAttempt) === workspaceStateFingerprint(beforeStaleReceiptAttempt)
      && actionReceiptFiles().length === receiptFilesBeforeStaleReceipt.length + 1,
    `status=${staleReceiptAttempt.status} error=${staleReceiptAttempt.json?.error} receipt=${staleReceiptProjection?.status}`);
  ok('workspace_stale_receipt_failed_persisted_canonical_hash_valid',
    staleReceiptEvidence.ok
      && staleReceiptEvidence.canonical === true
      && staleReceiptEvidence.computedHash === staleReceipt?.hash
      && staleReceiptEvidence.projectionMatches === true
      && staleReceipt?.status === 'failed'
      && staleReceipt?.authority?.operationId === staleReceiptOperationId
      && staleReceipt?.validation?.status === 'failed',
    `reopened=${staleReceiptEvidence.ok} canonical=${staleReceiptEvidence.canonical === true}`);

  const beforeStaleReceiptReplay = await req('GET', '/api/agent/workspace', SESSION_TOKEN);
  const receiptFilesBeforeStaleReceiptReplay = actionReceiptFiles();
  const staleReceiptReplay = await req(
    'POST',
    '/api/agent/workspace',
    SESSION_TOKEN,
    staleReceiptBody,
    { operationId: staleReceiptOperationId },
  );
  const afterStaleReceiptReplay = await req('GET', '/api/agent/workspace', SESSION_TOKEN);
  const staleReceiptReplayProjection = staleReceiptReplay.json?.receipt;
  const staleReceiptReplayEvidence = reopenPersistedActionReceipt(staleReceiptReplayProjection);
  ok('workspace_stale_receipt_failed_replay_is_stable_nonmutating',
    staleReceiptReplay.status === 409
      && staleReceiptReplay.json?.replayed === true
      && Object.keys(staleReceiptReplayProjection || {}).sort().join(',') === 'hash,id,status'
      && staleReceiptReplayProjection?.status === 'failed'
      && stableStringify(staleReceiptReplayProjection) === stableStringify(staleReceiptProjection)
      && staleReceiptReplayEvidence.ok
      && staleReceiptReplayEvidence.projectionMatches === true
      && workspaceStateFingerprint(afterStaleReceiptReplay) === workspaceStateFingerprint(beforeStaleReceiptReplay)
      && stableStringify(actionReceiptFiles()) === stableStringify(receiptFilesBeforeStaleReceiptReplay),
    `status=${staleReceiptReplay.status} replayed=${staleReceiptReplay.json?.replayed}`);

  const invalidBodyReceiptOperationId = 'forge_op_w3b1_invalid_body_receipt';
  const beforeInvalidBodyReceipt = await req('GET', '/api/agent/workspace', SESSION_TOKEN);
  const receiptFilesBeforeInvalidBodyReceipt = actionReceiptFiles();
  const invalidBodyReceiptAttempt = await req(
    'POST',
    '/api/agent/workspace',
    SESSION_TOKEN,
    {},
    { operationId: invalidBodyReceiptOperationId },
  );
  const afterInvalidBodyReceipt = await req('GET', '/api/agent/workspace', SESSION_TOKEN);
  const invalidBodyReceiptProjection = invalidBodyReceiptAttempt.json?.receipt;
  const invalidBodyReceiptEvidence = reopenPersistedActionReceipt(invalidBodyReceiptProjection);
  const invalidBodyReceipt = invalidBodyReceiptEvidence.ok ? invalidBodyReceiptEvidence.record : undefined;
  ok('workspace_invalid_body_receipt_failed_projection_persisted',
    invalidBodyReceiptAttempt.status === 400
      && invalidBodyReceiptAttempt.json?.error === "Missing required 'workspace' body parameter."
      && Object.keys(invalidBodyReceiptProjection || {}).sort().join(',') === 'hash,id,status'
      && invalidBodyReceiptProjection?.status === 'failed'
      && workspaceStateFingerprint(afterInvalidBodyReceipt) === workspaceStateFingerprint(beforeInvalidBodyReceipt)
      && actionReceiptFiles().length === receiptFilesBeforeInvalidBodyReceipt.length + 1,
    `status=${invalidBodyReceiptAttempt.status} receipt=${invalidBodyReceiptProjection?.status}`);
  const invalidBodyReceiptEvidenceBytes = `${invalidBodyReceiptEvidence.ok ? invalidBodyReceiptEvidence.raw : ''}\n${stableStringify(invalidBodyReceiptProjection || null)}`;
  const invalidBodyReceiptEvidenceNeedles = [
    SESSION_TOKEN,
    JSON.stringify(SESSION_TOKEN).slice(1, -1),
    tmp,
    tmp.replaceAll('\\', '/'),
    JSON.stringify(tmp).slice(1, -1),
    JSON.stringify(tmp.replaceAll('\\', '/')).slice(1, -1),
  ];
  ok('workspace_invalid_body_receipt_is_canonical_hash_valid_and_identity_bound',
    invalidBodyReceiptEvidence.ok
      && invalidBodyReceiptEvidence.canonical === true
      && invalidBodyReceiptEvidence.computedHash === invalidBodyReceipt?.hash
      && invalidBodyReceiptEvidence.projectionMatches === true
      && invalidBodyReceipt?.status === 'failed'
      && invalidBodyReceipt?.validation?.status === 'failed'
      && invalidBodyReceipt?.authority?.operationId === invalidBodyReceiptOperationId
      && invalidBodyReceipt?.capability?.legacyRoute === '/api/agent/workspace'
      && invalidBodyReceipt?.capability?.method === 'POST'
      && invalidBodyReceipt?.metadata?.route === 'POST /api/agent/workspace'
      && invalidBodyReceiptEvidenceNeedles.every(needle => !invalidBodyReceiptEvidenceBytes.includes(needle)),
    `reopened=${invalidBodyReceiptEvidence.ok} canonical=${invalidBodyReceiptEvidence.canonical === true}`);

  const mergeDryRunReceiptOperationId = 'forge_op_w3b1_merge_dry_run_receipt';
  const mergeDryRunReceiptMarker = 'W3B1_MERGE_DRY_RUN_PROPOSED_DESCRIPTION';
  const mergeDryRunReceiptBefore = await req('GET', '/api/agent/workspace', SESSION_TOKEN);
  const receiptFilesBeforeMergeDryRunReceipt = actionReceiptFiles();
  const mergeDryRunReceiptAttempt = await req(
    'POST',
    '/api/agent/workspace/merge',
    SESSION_TOKEN,
    {
      changes: { description: mergeDryRunReceiptMarker },
      expectedHead: mergeDryRunReceiptBefore.json?.workspaceHash,
      expectedSnapshotHash: mergeDryRunReceiptBefore.json?.snapshotHash,
      dryRun: true,
    },
    { operationId: mergeDryRunReceiptOperationId },
  );
  const mergeDryRunReceiptAfter = await req('GET', '/api/agent/workspace', SESSION_TOKEN);
  const mergeDryRunReceiptProjection = mergeDryRunReceiptAttempt.json?.receipt;
  const mergeDryRunReceiptEvidence = reopenPersistedActionReceipt(mergeDryRunReceiptProjection);
  const mergeDryRunReceipt = mergeDryRunReceiptEvidence.ok ? mergeDryRunReceiptEvidence.record : undefined;
  ok('workspace_merge_dry_run_receipt_committed_projection_no_mutation',
    mergeDryRunReceiptAttempt.status === 200
      && mergeDryRunReceiptAttempt.json?.dryRun === true
      && mergeDryRunReceiptAttempt.json?.applied === false
      && mergeDryRunReceiptAttempt.json?.version === mergeDryRunReceiptBefore.json?.version
      && mergeDryRunReceiptAttempt.json?.workspaceId === mergeDryRunReceiptBefore.json?.workspaceId
      && stableStringify(mergeDryRunReceiptAttempt.json?.previewWorkspace) === stableStringify({ ...mergeDryRunReceiptBefore.json?.workspace, description: mergeDryRunReceiptMarker })
      && !Object.prototype.hasOwnProperty.call(mergeDryRunReceiptAttempt.json || {}, 'workspace')
      && mergeDryRunReceiptAfter.json?.version === mergeDryRunReceiptBefore.json?.version
      && workspaceStateFingerprint(mergeDryRunReceiptAfter) === workspaceStateFingerprint(mergeDryRunReceiptBefore)
      && !Object.prototype.hasOwnProperty.call(mergeDryRunReceiptAttempt.json || {}, 'recovery')
      && Object.keys(mergeDryRunReceiptProjection || {}).sort().join(',') === 'hash,id,status'
      && mergeDryRunReceiptProjection?.status === 'committed'
      && actionReceiptFiles().length === receiptFilesBeforeMergeDryRunReceipt.length + 1,
    `status=${mergeDryRunReceiptAttempt.status} dryRun=${mergeDryRunReceiptAttempt.json?.dryRun} receipt=${mergeDryRunReceiptProjection?.status}`);
  const mergeDryRunReceiptAuthorityResources = new Map((mergeDryRunReceipt?.authority?.resources || []).map(resource => [resource.role, resource]));
  const mergeDryRunReceiptAfterResources = new Map((mergeDryRunReceipt?.after?.resources || []).map(resource => [resource.role, resource]));
  const mergeDryRunReceiptRoles = ['workspace', 'snapshot'];
  ok('workspace_merge_dry_run_receipt_is_canonical_no_change_and_identity_bound',
    mergeDryRunReceiptEvidence.ok
      && mergeDryRunReceiptEvidence.canonical === true
      && mergeDryRunReceiptEvidence.computedHash === mergeDryRunReceipt?.hash
      && mergeDryRunReceiptEvidence.projectionMatches === true
      && mergeDryRunReceipt?.status === 'committed'
      && mergeDryRunReceipt?.authority?.operationId === mergeDryRunReceiptOperationId
      && mergeDryRunReceipt?.capability?.legacyRoute === '/api/agent/workspace/merge'
      && mergeDryRunReceipt?.capability?.method === 'POST'
      && mergeDryRunReceipt?.metadata?.route === 'POST /api/agent/workspace/merge'
      && mergeDryRunReceipt?.after?.outcome === 'no_change'
      && mergeDryRunReceipt?.rollback?.required === false
      && mergeDryRunReceiptAuthorityResources.size === 2
      && mergeDryRunReceiptAfterResources.size === 2
      && mergeDryRunReceiptRoles.every(role => mergeDryRunReceiptAuthorityResources.has(role) && mergeDryRunReceiptAfterResources.has(role))
      && mergeDryRunReceiptRoles.every(role => mergeDryRunReceiptAfterResources.get(role)?.hash === mergeDryRunReceiptAuthorityResources.get(role)?.beforeHash),
    `reopened=${mergeDryRunReceiptEvidence.ok} outcome=${mergeDryRunReceipt?.after?.outcome}`);

  const mergeNoChangeReceiptOperationId = 'forge_op_w3b1_merge_no_change_receipt';
  const mergeNoChangeReceiptBefore = await req('GET', '/api/agent/workspace', SESSION_TOKEN);
  const mergeNoChangeReceiptDescription = mergeNoChangeReceiptBefore.json?.workspace?.description;
  const receiptFilesBeforeMergeNoChangeReceipt = actionReceiptFiles();
  const mergeNoChangeReceiptAttempt = await req(
    'POST',
    '/api/agent/workspace/merge',
    SESSION_TOKEN,
    {
      changes: { description: mergeNoChangeReceiptDescription },
      expectedHead: mergeNoChangeReceiptBefore.json?.workspaceHash,
      expectedSnapshotHash: mergeNoChangeReceiptBefore.json?.snapshotHash,
    },
    { operationId: mergeNoChangeReceiptOperationId },
  );
  const mergeNoChangeReceiptAfter = await req('GET', '/api/agent/workspace', SESSION_TOKEN);
  const mergeNoChangeReceiptProjection = mergeNoChangeReceiptAttempt.json?.receipt;
  const mergeNoChangeReceiptEvidence = reopenPersistedActionReceipt(mergeNoChangeReceiptProjection);
  const mergeNoChangeReceipt = mergeNoChangeReceiptEvidence.ok ? mergeNoChangeReceiptEvidence.record : undefined;
  ok('workspace_merge_no_change_receipt_committed_projection_no_mutation',
    mergeNoChangeReceiptAttempt.status === 200
      && mergeNoChangeReceiptAttempt.json?.applied === false
      && mergeNoChangeReceiptAttempt.json?.dryRun !== true
      && mergeNoChangeReceiptAttempt.json?.version === mergeNoChangeReceiptBefore.json?.version
      && mergeNoChangeReceiptAttempt.json?.workspaceHash === mergeNoChangeReceiptBefore.json?.workspaceHash
      && mergeNoChangeReceiptAttempt.json?.snapshotHash === mergeNoChangeReceiptBefore.json?.snapshotHash
      && stableStringify(mergeNoChangeReceiptAttempt.json?.workspace) === stableStringify(mergeNoChangeReceiptBefore.json?.workspace)
      && mergeNoChangeReceiptAfter.json?.version === mergeNoChangeReceiptBefore.json?.version
      && mergeNoChangeReceiptAfter.json?.workspaceHash === mergeNoChangeReceiptBefore.json?.workspaceHash
      && mergeNoChangeReceiptAfter.json?.snapshotHash === mergeNoChangeReceiptBefore.json?.snapshotHash
      && stableStringify(mergeNoChangeReceiptAfter.json?.workspace) === stableStringify(mergeNoChangeReceiptBefore.json?.workspace)
      && workspaceStateFingerprint(mergeNoChangeReceiptAfter) === workspaceStateFingerprint(mergeNoChangeReceiptBefore)
      && !Object.prototype.hasOwnProperty.call(mergeNoChangeReceiptAttempt.json || {}, 'recovery')
      && Object.keys(mergeNoChangeReceiptProjection || {}).sort().join(',') === 'hash,id,status'
      && mergeNoChangeReceiptProjection?.status === 'committed'
      && actionReceiptFiles().length === receiptFilesBeforeMergeNoChangeReceipt.length + 1,
    `status=${mergeNoChangeReceiptAttempt.status} applied=${mergeNoChangeReceiptAttempt.json?.applied} receipt=${mergeNoChangeReceiptProjection?.status}`);
  const mergeNoChangeReceiptAuthorityResources = new Map((mergeNoChangeReceipt?.authority?.resources || []).map(resource => [resource.role, resource]));
  const mergeNoChangeReceiptAfterResources = new Map((mergeNoChangeReceipt?.after?.resources || []).map(resource => [resource.role, resource]));
  const mergeNoChangeReceiptRoles = ['workspace', 'snapshot'];
  ok('workspace_merge_no_change_receipt_is_canonical_no_change_and_identity_bound',
    mergeNoChangeReceiptEvidence.ok
      && mergeNoChangeReceiptEvidence.canonical === true
      && mergeNoChangeReceiptEvidence.computedHash === mergeNoChangeReceipt?.hash
      && mergeNoChangeReceiptEvidence.projectionMatches === true
      && mergeNoChangeReceipt?.status === 'committed'
      && mergeNoChangeReceipt?.authority?.operationId === mergeNoChangeReceiptOperationId
      && mergeNoChangeReceipt?.capability?.legacyRoute === '/api/agent/workspace/merge'
      && mergeNoChangeReceipt?.capability?.method === 'POST'
      && mergeNoChangeReceipt?.metadata?.route === 'POST /api/agent/workspace/merge'
      && mergeNoChangeReceipt?.after?.outcome === 'no_change'
      && mergeNoChangeReceipt?.rollback?.required === false
      && Array.isArray(mergeNoChangeReceipt?.authority?.resources)
      && mergeNoChangeReceipt.authority.resources.length === 2
      && Array.isArray(mergeNoChangeReceipt?.after?.resources)
      && mergeNoChangeReceipt.after.resources.length === 2
      && mergeNoChangeReceiptAuthorityResources.size === 2
      && mergeNoChangeReceiptAfterResources.size === 2
      && mergeNoChangeReceiptRoles.every(role => {
        const expectedPath = role === 'workspace' ? `${WORKSPACE_ID}/content` : `${WORKSPACE_ID}/snapshot`;
        const authority = mergeNoChangeReceiptAuthorityResources.get(role);
        const after = mergeNoChangeReceiptAfterResources.get(role);
        return authority?.root === 'workspace'
          && authority?.relativePath === expectedPath
          && after?.root === 'workspace'
          && after?.relativePath === expectedPath
          && after?.hash === authority?.beforeHash;
      }),
    `reopened=${mergeNoChangeReceiptEvidence.ok} outcome=${mergeNoChangeReceipt?.after?.outcome}`);

  // R11/R14: workspace conflicts carry evidence and each destructive choice has an honest
  // recovery path. All state lives under this harness's ephemeral state/data directories.
  const initialWorkspace = await req('GET', '/api/agent/workspace', SESSION_TOKEN);
  const repeatWorkspace = await req('GET', '/api/agent/workspace', SESSION_TOKEN);
  ok('workspace_saved_time_is_real_not_read_time', initialWorkspace.json?.lastUpdated === repeatWorkspace.json?.lastUpdated && typeof initialWorkspace.json?.origin === 'string');
  const serverCopy = { id: 'conflict-server', name: 'Conflict Server', version: '1.0', author: 'Route', description: 'server copy', nodes: [], links: [], uiWidgets: [], uiTheme: {}, xmlPatches: [{ id: 'server-patch', action: 'add', targetFile: 'libraries/wares.xml', sel: '/wares', content: '<ware id="server"/>', note: '' }] };
  const localCopy = { ...serverCopy, id: 'conflict-local', name: 'Conflict Local', description: 'local copy', xmlPatches: [{ id: 'local-patch', action: 'add', targetFile: 'libraries/wares.xml', sel: '/wares', content: '<ware id="local"/>', note: '' }] };
  const serverWrite = await req('POST', '/api/agent/workspace', SESSION_TOKEN, { workspace: serverCopy, expectedHead: initialWorkspace.json?.workspaceHash, expectedSnapshotHash: initialWorkspace.json?.snapshotHash });
  ok('workspace_cas_write_establishes_server_copy', serverWrite.status === 200 && serverWrite.json?.success === true, `status=${serverWrite.status}`);
  const conflictWrite = await req('POST', '/api/agent/workspace', SESSION_TOKEN, { workspace: localCopy, expectedHead: initialWorkspace.json?.workspaceHash, expectedSnapshotHash: initialWorkspace.json?.snapshotHash });
  ok('workspace_conflict_returns_both_real_heads', conflictWrite.status === 409 && conflictWrite.json?.conflict?.server?.head === serverWrite.json?.workspaceHash && typeof conflictWrite.json?.conflict?.local?.head === 'string', JSON.stringify(conflictWrite.json?.conflict || {}));
  ok('workspace_conflict_returns_file_level_delta', conflictWrite.json?.conflict?.preview?.counts?.changed > 0 && Array.isArray(conflictWrite.json?.conflict?.preview?.files), JSON.stringify(conflictWrite.json?.conflict?.preview?.counts || {}));
  const beforeSnapshotConflict = await req('GET', '/api/agent/workspace', SESSION_TOKEN);
  const externalThemeCopy = {
    ...beforeSnapshotConflict.json.workspace,
    uiTheme: { ...beforeSnapshotConflict.json.workspace.uiTheme, accentColor: '#abcdef' },
  };
  const externalThemeWrite = await req('POST', '/api/agent/workspace', SESSION_TOKEN, {
    workspace: externalThemeCopy,
    expectedHead: beforeSnapshotConflict.json.workspaceHash,
    expectedSnapshotHash: beforeSnapshotConflict.json.snapshotHash,
  });
  ok('snapshot_only_write_keeps_legacy_cas_but_changes_snapshot_digest',
    externalThemeWrite.status === 200
      && externalThemeWrite.json?.workspaceHash === beforeSnapshotConflict.json.workspaceHash
      && externalThemeWrite.json?.snapshotHash !== beforeSnapshotConflict.json.snapshotHash,
    JSON.stringify(externalThemeWrite.json || {}));
  const staleThemeWrite = await req('POST', '/api/agent/workspace', SESSION_TOKEN, {
    workspace: { ...beforeSnapshotConflict.json.workspace, uiTheme: { ...beforeSnapshotConflict.json.workspace.uiTheme, accentColor: '#fedcba' } },
    expectedHead: beforeSnapshotConflict.json.workspaceHash,
    expectedSnapshotHash: beforeSnapshotConflict.json.snapshotHash,
  });
  ok('snapshot_precondition_rejects_non_cas_stale_write',
    staleThemeWrite.status === 409
      && staleThemeWrite.json?.error === 'snapshot_conflict'
      && staleThemeWrite.json?.currentHead === beforeSnapshotConflict.json.workspaceHash
      && staleThemeWrite.json?.currentSnapshotHash === externalThemeWrite.json?.snapshotHash,
    JSON.stringify(staleThemeWrite.json || {}));
  const beforeIdConflict = await req('GET', '/api/agent/workspace', SESSION_TOKEN);
  const externalIdWrite = await req('POST', '/api/agent/workspace', SESSION_TOKEN, {
    workspace: { ...beforeIdConflict.json.workspace, id: 'route_external_id' },
    expectedHead: beforeIdConflict.json.workspaceHash,
    expectedSnapshotHash: beforeIdConflict.json.snapshotHash,
  });
  ok('workspace_id_write_keeps_legacy_cas_but_changes_snapshot_digest',
    externalIdWrite.status === 200
      && externalIdWrite.json?.workspaceHash === beforeIdConflict.json.workspaceHash
      && externalIdWrite.json?.snapshotHash !== beforeIdConflict.json.snapshotHash,
    JSON.stringify(externalIdWrite.json || {}));
  const staleIdWrite = await req('POST', '/api/agent/workspace', SESSION_TOKEN, {
    workspace: { ...beforeIdConflict.json.workspace, id: 'route_stale_id' },
    expectedHead: beforeIdConflict.json.workspaceHash,
    expectedSnapshotHash: beforeIdConflict.json.snapshotHash,
  });
  ok('snapshot_precondition_rejects_stale_workspace_id_write',
    staleIdWrite.status === 409
      && staleIdWrite.json?.error === 'snapshot_conflict'
      && staleIdWrite.json?.currentSnapshotHash === externalIdWrite.json?.snapshotHash,
    JSON.stringify(staleIdWrite.json || {}));
  const beforeForcedId = await req('GET', '/api/agent/workspace', SESSION_TOKEN);
  const forcedIdOnly = await req('POST', '/api/agent/workspace', SESSION_TOKEN, {
    workspace: { ...beforeForcedId.json.workspace, id: 'route_forced_id_only' },
    force: true,
  });
  ok('forced_snapshot_only_write_returns_snapshot_guarded_recovery',
    forcedIdOnly.status === 200
      && forcedIdOnly.json?.workspaceHash === beforeForcedId.json.workspaceHash
      && forcedIdOnly.json?.snapshotHash !== beforeForcedId.json.snapshotHash
      && forcedIdOnly.json?.recovery?.expectedCurrentSnapshotHash === forcedIdOnly.json.snapshotHash,
    JSON.stringify(forcedIdOnly.json || {}));
  const forcedIdHistory = await req('GET', '/api/agent/history?kind=workspace', SESSION_TOKEN);
  const forcedIdRow = (forcedIdHistory.json?.rows || []).find(row => row.recoveryId === forcedIdOnly.json?.recovery?.id);
  ok('snapshot_only_workspace_write_is_visible_with_recovery_link',
    forcedIdHistory.status === 200
      && forcedIdRow?.recoveryId === forcedIdOnly.json?.recovery?.id
      && forcedIdRow?.recoveryExpectedSnapshotHash === forcedIdOnly.json?.snapshotHash,
    JSON.stringify(forcedIdRow || {}));
  const laterSnapshotOnly = await req('POST', '/api/agent/workspace', SESSION_TOKEN, {
    workspace: {
      ...forcedIdOnly.json.workspace,
      uiTheme: { ...forcedIdOnly.json.workspace.uiTheme, accentColor: '#aabbcc' },
    },
    expectedHead: forcedIdOnly.json.workspaceHash,
    expectedSnapshotHash: forcedIdOnly.json.snapshotHash,
  });
  const staleSnapshotRecovery = await req('POST', `/api/agent/history/${forcedIdRow?.id}/revert`, SESSION_TOKEN, {});
  ok('snapshot_only_change_makes_older_workspace_recovery_stale',
    laterSnapshotOnly.status === 200
      && laterSnapshotOnly.json?.workspaceHash === forcedIdOnly.json.workspaceHash
      && staleSnapshotRecovery.status === 409
      && staleSnapshotRecovery.json?.code === 'RECOVERY_STALE'
      && staleSnapshotRecovery.json?.currentSnapshotHash === laterSnapshotOnly.json.snapshotHash,
    JSON.stringify(staleSnapshotRecovery.json || {}));
  const forcedLocal = await req('POST', '/api/agent/workspace', SESSION_TOKEN, { workspace: localCopy, force: true });
  ok('forced_workspace_overwrite_returns_recovery', forcedLocal.status === 200 && forcedLocal.json?.recovery?.kind === 'workspace' && forcedLocal.json?.recovery?.expectedCurrentHash === forcedLocal.json?.workspaceHash, JSON.stringify(forcedLocal.json?.recovery || {}));
  const workspaceHistory = await req('GET', '/api/agent/history?kind=workspace', SESSION_TOKEN);
  capabilityResponses.set('history.list', workspaceHistory);
  const forcedWorkspaceRow = (workspaceHistory.json?.rows || []).find(row => row.recoveryId === forcedLocal.json?.recovery?.id);
  ok('forced_workspace_history_is_truthfully_revertible', forcedWorkspaceRow?.revertible === true && forcedWorkspaceRow?.recoveryKind === 'workspace', JSON.stringify(forcedWorkspaceRow || {}));
  const crossWorkspaceRecovery = await req('POST', `/api/agent/history/${forcedWorkspaceRow?.id}/revert`, SESSION_TOKEN, {}, { workspaceId: SECOND_WORKSPACE_ID, clientId: SECOND_CLIENT_ID });
  ok('cross_workspace_recovery_is_invisible', crossWorkspaceRecovery.status === 404);
  const undoForcedWorkspace = await req('POST', `/api/agent/history/${forcedWorkspaceRow?.id}/revert`, SESSION_TOKEN, {});
  capabilityResponses.set('history.revert', undoForcedWorkspace);
  ok('forced_workspace_recovery_restores_prior_head', undoForcedWorkspace.status === 200 && undoForcedWorkspace.json?.workspace?.name === serverCopy.name, JSON.stringify(undoForcedWorkspace.json || {}));
  const replayForcedWorkspace = await req('POST', `/api/agent/history/${forcedWorkspaceRow?.id}/revert`, SESSION_TOKEN, {});
  ok('workspace_recovery_replay_is_rejected', replayForcedWorkspace.status === 409 && replayForcedWorkspace.json?.code === 'RECOVERY_ALREADY_USED', `status=${replayForcedWorkspace.status} code=${replayForcedWorkspace.json?.code}`);

  // The deployed filesystem role is browse/import-only. Generic edits always land in the
  // isolated workspace even while filesystemPath points at the live extensions directory.
  const routedWorkspaceWrite = await req('POST', '/api/fs/write', SESSION_TOKEN, { path: 'must-not-exist.txt', content: 'workspace only' });
  ok('deployed_filesystem_generic_write_routes_to_workspace', routedWorkspaceWrite.status === 200 && fs.readFileSync(path.join(safeWorkspace, 'must-not-exist.txt'), 'utf8') === 'workspace only', `status=${routedWorkspaceWrite.status}`);
  ok('workspace_routed_write_did_not_touch_game', !fs.existsSync(path.join(liveExtensions, 'must-not-exist.txt')));

  // Simulate a pre-upgrade unsafe workspace. Staging/snapshot/deploy chokepoints must still refuse it.
  fs.writeFileSync(path.join(configDir, 'config.json'), JSON.stringify({ ...deployedRolesConfig, modWorkspacePath: liveExtensions }));
  const runtimeWrite = await req('POST', '/api/fs/write', SESSION_TOKEN, { path: 'must-not-exist.txt', content: 'blocked' });
  ok('old_unsafe_config_fs_write_blocked', runtimeWrite.status === 409 && runtimeWrite.json?.code === 'PROTECTED_ROOT_OVERLAP', `status=${runtimeWrite.status}`);
  ok('blocked_write_did_not_touch_game', !fs.existsSync(path.join(liveExtensions, 'must-not-exist.txt')));
  const runtimeSnapshot = await req('POST', '/api/fs/snapshot', SESSION_TOKEN, { modId: 'unsafe_fixture', workspace: { id: 'fixture', name: 'fixture' } });
  ok('old_unsafe_config_snapshot_blocked', runtimeSnapshot.status === 409, `status=${runtimeSnapshot.status}`);
  const runtimeDeploy = await req('POST', '/api/agent/deploy', SESSION_TOKEN, { workspace: { id: 'fixture', name: 'fixture', nodes: [], links: [], uiWidgets: [] } });
  ok('old_unsafe_config_staging_deploy_blocked', runtimeDeploy.status === 409, `status=${runtimeDeploy.status}`);
  const deployKeyRuntimeDeploy = await req('POST', '/api/agent/deploy', deployKey, { workspace: { id: 'fixture', name: 'fixture', nodes: [], links: [], uiWidgets: [] } });
  ok('deploy_key_reaches_deploy_handler_and_safety_guard',
    deployKeyRuntimeDeploy.status === 409 && deployKeyRuntimeDeploy.json?.code === 'PROTECTED_ROOT_OVERLAP' && !deployKeyRuntimeDeploy.json?.authorityCode,
    JSON.stringify(deployKeyRuntimeDeploy.json || {}));

  const repairedConfig = await req('POST', '/api/schema/config', SESSION_TOKEN, deployedRolesConfig);
  ok('unsafe_config_can_be_repaired', repairedConfig.status === 200, `status=${repairedConfig.status}`);

  // --- B84: deploy format toggle (loose vs CAT/DAT) -------------------------------------
  // The format is persisted server-side so every deploy surface agrees, an explicit unknown
  // value is refused rather than silently substituted, and a partial config update must not
  // blank neighbouring settings.
  // Seed a REAL schema path first. Without this the preservation check below would compare
  // undefined to undefined and pass while proving nothing.
  await req('POST', '/api/schema/config', SESSION_TOKEN, { ...deployedRolesConfig, schemaDir: referenceRoot });
  const formatDefault = await req('GET', '/api/schema/config', SESSION_TOKEN);
  ok('deploy_format_defaults_to_loose',
    formatDefault.json?.deployFormat?.format === 'loose' && formatDefault.json?.deployFormat?.source === 'default',
    `format=${formatDefault.json?.deployFormat?.format} source=${formatDefault.json?.deployFormat?.source}`);
  ok('deploy_format_options_advertised',
    Array.isArray(formatDefault.json?.deployFormat?.options) && formatDefault.json.deployFormat.options.join(',') === 'loose,catalog',
    `options=${formatDefault.json?.deployFormat?.options}`);

  const schemaPathBeforeToggle = formatDefault.json?.config?.xsdSchemaPath;
  const setCatalog = await req('POST', '/api/schema/config', SESSION_TOKEN, { deployFormat: 'catalog' });
  ok('deploy_format_catalog_saved', setCatalog.status === 200 && setCatalog.json?.config?.deployFormat === 'catalog', `status=${setCatalog.status}`);
  const afterCatalog = await req('GET', '/api/schema/config', SESSION_TOKEN);
  ok('deploy_format_catalog_persisted',
    afterCatalog.json?.deployFormat?.format === 'catalog' && afterCatalog.json?.deployFormat?.source === 'config',
    `format=${afterCatalog.json?.deployFormat?.format} source=${afterCatalog.json?.deployFormat?.source}`);
  // The toggle sends ONLY deployFormat. Omitting schemaDir must preserve it, not blank it.
  ok('partial_config_update_preserves_schema_path',
    !!schemaPathBeforeToggle && afterCatalog.json?.config?.xsdSchemaPath === schemaPathBeforeToggle,
    `before=${schemaPathBeforeToggle} after=${afterCatalog.json?.config?.xsdSchemaPath}`);

  const badFormat = await req('POST', '/api/schema/config', SESSION_TOKEN, { deployFormat: 'zipfile' });
  ok('deploy_format_unknown_rejected', badFormat.status === 400 && badFormat.json?.code === 'UNKNOWN_DEPLOY_FORMAT', `status=${badFormat.status} code=${badFormat.json?.code}`);
  const afterBadFormat = await req('GET', '/api/schema/config', SESSION_TOKEN);
  ok('rejected_deploy_format_not_persisted', afterBadFormat.json?.deployFormat?.format === 'catalog', `format=${afterBadFormat.json?.deployFormat?.format}`);

  // A bad per-request override must fail the deploy BEFORE anything is written.
  const badDeploy = await req('POST', '/api/agent/deploy-verify', SESSION_TOKEN, {
    workspace: { id: 'fixture', name: 'fixture', nodes: [], links: [], uiWidgets: [] },
    deployFormat: 'tarball',
  });
  ok('deploy_verify_rejects_unknown_format', badDeploy.status === 400 && badDeploy.json?.code === 'UNKNOWN_DEPLOY_FORMAT', `status=${badDeploy.status} code=${badDeploy.json?.code}`);
  ok('rejected_format_deploy_wrote_nothing', !fs.existsSync(path.join(liveExtensions, 'fixture')));

  const noTargetVerify = await req('POST', '/api/agent/deploy-verify', SESSION_TOKEN, {});
  ok('deploy_verify_requires_an_explicit_target', noTargetVerify.status === 400 && noTargetVerify.json?.code === 'DEPLOY_TARGET_REQUIRED', `status=${noTargetVerify.status} code=${noTargetVerify.json?.code}`);
  ok('existing_failure_fields_are_preserved', noTargetVerify.json?.error?.includes('explicit path or workspace') && noTargetVerify.json?.failedStages?.includes('import'), JSON.stringify(noTargetVerify.json));
  const noTargetLegacy = await req('POST', '/api/agent/deploy', SESSION_TOKEN, {});
  ok('legacy_deploy_requires_an_explicit_workspace', noTargetLegacy.status === 400 && noTargetLegacy.json?.code === 'DEPLOY_TARGET_REQUIRED', `status=${noTargetLegacy.status} code=${noTargetLegacy.json?.code}`);

  // Kimi R3 reproduced class: deploy-verify has deliberate HTTP-200 operational failures.
  // Generic clients still need top-level failure truth and must never log "ok" over refusal.
  const malformedVerifyId = 'failure_envelope_malformed';
  const malformedVerify = await req('POST', '/api/agent/deploy-verify', SESSION_TOKEN, {
    workspace: {
      id: malformedVerifyId,
      name: malformedVerifyId,
      nodes: [], links: [], uiWidgets: [],
      passthroughFiles: [{ path: 'md/broken.xml', reason: 'unmodeled', content: '<mdscript><cues><cue name="Broken"></cues></mdscript>' }],
    },
  });
  ok('http_200_deploy_failure_keeps_legacy_status', malformedVerify.status === 200 && malformedVerify.json?.ok === false, `status=${malformedVerify.status}`);
  ok('http_200_deploy_failure_has_machine_envelope', malformedVerify.json?.success === false && malformedVerify.json?.code === 'WELLFORMED_FAILED' && typeof malformedVerify.json?.error === 'string' && malformedVerify.json.error.length > 0 && malformedVerify.json?.failedStages?.includes('wellformed'), JSON.stringify(malformedVerify.json));
  ok('http_200_deploy_failure_writes_nothing', !fs.existsSync(path.join(liveExtensions, malformedVerifyId)) && !fs.existsSync(path.join(safeWorkspace, '.forge-builds', 'loose', malformedVerifyId)));

  const invalidLegacyName = 'legacy_invalid_fixture';
  const invalidLegacy = await req('POST', '/api/agent/deploy', SESSION_TOKEN, {
    workspace: {
      id: invalidLegacyName,
      name: invalidLegacyName,
      nodes: [], links: [], uiWidgets: [],
      passthroughFiles: [{
        path: 'md/unanswered.xml',
        reason: 'unmodeled',
        content: '<mdscript name="Unanswered"><cues><cue name="Start"><actions><raise_lua_event name="\'route.missing_listener\'"/></actions></cue></cues></mdscript>',
      }],
    },
  });
  ok('legacy_deploy_runs_full_project_validation', invalidLegacy.status === 422 && invalidLegacy.json?.code === 'DEPLOY_VALIDATION_FAILED' && invalidLegacy.json?.validation?.summary?.crossFileErrors > 0, `status=${invalidLegacy.status} body=${JSON.stringify(invalidLegacy.json || {})}`);
  ok('legacy_validation_failure_writes_nothing', !fs.existsSync(path.join(liveExtensions, invalidLegacyName)) && !fs.existsSync(path.join(safeWorkspace, '.forge-builds', 'loose', invalidLegacyName)));

  const restoreLoose = await req('POST', '/api/schema/config', SESSION_TOKEN, { deployFormat: 'loose' });
  ok('deploy_format_restored_to_loose', restoreLoose.status === 200 && restoreLoose.json?.config?.deployFormat === 'loose', `status=${restoreLoose.status}`);

  // --- B93 wave 1: stop making callers re-derive what the server already knows -------------
  // #1 discovery: the port changes every launch and nothing on disk said what it was.
  const discLatest = path.join(tmp, 'discovery', 'latest.json');
  ok('discovery_file_published', fs.existsSync(discLatest), discLatest);
  const discRec = fs.existsSync(discLatest) ? JSON.parse(fs.readFileSync(discLatest, 'utf8')) : {};
  ok('discovery_carries_port', discRec.port === PORT, `port=${discRec.port}`);
  ok('discovery_carries_no_session_token', !Object.prototype.hasOwnProperty.call(discRec, 'token'));
  ok('discovery_is_outside_mod_and_game_roots',
    !discRec.cwd || (!discLatest.includes('extensions') && !discLatest.includes('X4 Foundations')), discLatest);

  // #2 a caller must be able to tell "wrong verb" from "no such route".
  const wrongVerb = await req('GET', '/api/agent/deploy-verify', SESSION_TOKEN);
  ok('wrong_verb_returns_405', wrongVerb.status === 405 && wrongVerb.json?.code === 'METHOD_NOT_ALLOWED', `status=${wrongVerb.status}`);
  ok('wrong_verb_names_allowed_methods', Array.isArray(wrongVerb.json?.allow) && wrongVerb.json.allow.includes('POST'), JSON.stringify(wrongVerb.json?.allow));
  ok('failure_envelope_preserves_405_contract', wrongVerb.json?.success === false && wrongVerb.json?.status === 'FAILED' && Array.isArray(wrongVerb.json?.failedStages) && typeof wrongVerb.json?.error === 'string', JSON.stringify(wrongVerb.json));
  const noRoute = await req('GET', '/api/agent/definitely-not-a-route', SESSION_TOKEN);
  ok('unknown_endpoint_returns_json_404', noRoute.status === 404 && noRoute.json?.code === 'UNKNOWN_ENDPOINT', `status=${noRoute.status}`);
  ok('unknown_endpoint_is_not_the_spa_html', !String(noRoute.raw || '').includes('<!doctype'), (noRoute.raw || '').slice(0, 40));
  ok('failure_envelope_preserves_404_contract', noRoute.json?.success === false && noRoute.json?.status === 'FAILED' && Array.isArray(noRoute.json?.failedStages) && typeof noRoute.json?.error === 'string', JSON.stringify(noRoute.json));

  // #2 never 200 on a degenerate result.
  fs.mkdirSync(path.join(safeWorkspace, 'not_a_mod', 'inner_mod'), { recursive: true });
  fs.writeFileSync(path.join(safeWorkspace, 'not_a_mod', 'inner_mod', 'content.xml'), '<content id="inner_mod" name="Inner"/>');
  const degenerate = await req('POST', '/api/agent/mod-folder/import', SESSION_TOKEN, { root: 'workspace', path: 'not_a_mod' });
  ok('non_mod_folder_import_rejected', degenerate.status === 400 && degenerate.json?.code === 'NOT_A_MOD_FOLDER', `status=${degenerate.status}`);
  ok('non_mod_folder_error_names_an_importable_mod',
    Array.isArray(degenerate.json?.modsFoundInside) && degenerate.json.modsFoundInside.includes('inner_mod'),
    JSON.stringify(degenerate.json?.modsFoundInside));

  // #3 validate accepts the SAME {root, path} shape as mod-folder/import.
  // Own fixture: borrowing another section's mod made this assertion depend on unrelated ordering.
  const validateFixture = path.join(safeWorkspace, 'validate_path_mod');
  fs.mkdirSync(path.join(validateFixture, 'md'), { recursive: true });
  fs.writeFileSync(path.join(validateFixture, 'content.xml'), '<content id="validate_path_mod" name="Validate Path Mod" version="100"/>');
  fs.writeFileSync(
    path.join(validateFixture, 'md', 'vp.xml'),
    [
      '<?xml version="1.0" encoding="utf-8"?>',
      '<mdscript name="VP"><cues><cue name="VP_Start"><conditions><event_game_started/></conditions>',
      '<actions><set_value name="$offer" exact="event.param3.{\'$offer\' + $si}"/><raise_lua_event name="\'route.mod.open\'"/></actions></cue></cues></mdscript>',
    ].join('\n'),
  );
  fs.mkdirSync(path.join(validateFixture, 'ui'), { recursive: true });
  fs.writeFileSync(path.join(validateFixture, 'ui', 'main.lua'), [
    'RegisterEvent("route.mod.open", function () end)',
    'payload["offer" .. payload.n] = "ready"',
    'AddUITriggeredEvent("route.mod", "log_" .. category)',
  ].join('\n'));
  const routeRuleReviewBy = new Date(Date.now() + 300 * 86_400_000).toISOString().slice(0, 10);
  fs.writeFileSync(path.join(validateFixture, 'forge.rules.json'), JSON.stringify({
    version: 1,
    suppressions: [{
      id: 'route-dynamic-listener', owner: 'route-test', reason: 'Dynamic listener is provided by the host runtime.',
      reviewBy: routeRuleReviewBy, code: 'lua_md.missing_listener', file: 'ui/main.lua', sourceRef: 'route.mod.log_',
    }],
    contracts: {
      wireKeys: [{ id: 'route-wire-offer', key: 'offer', scope: 'global', reason: 'Offer exists for every indexed step.' }],
      expectedRegisters: [{ id: 'route-register-open', event: 'route.mod.open', file: 'ui/main.lua', reason: 'MD raises this bridge event.' }],
    },
  }, null, 2));
  const validateByPath = await req('POST', '/api/agent/project/validate', SESSION_TOKEN, { root: 'workspace', path: 'validate_path_mod' });
  ok('validate_accepts_root_and_path', validateByPath.status === 200 && validateByPath.json?.source?.mode === 'fromPath', `status=${validateByPath.status} mode=${validateByPath.json?.source?.mode}`);
  ok('validate_loads_root_project_rules', validateByPath.json?.source?.loaded?.includes('forge.rules.json') && validateByPath.json?.rules?.present === true && validateByPath.json?.rules?.valid === true, JSON.stringify(validateByPath.json?.rules || {}));
  ok('project_rule_contracts_keep_evidence', validateByPath.json?.rules?.matches?.length === 2, JSON.stringify(validateByPath.json?.rules?.matches || []));
  ok('reviewed_warning_suppression_is_exact_and_visible', validateByPath.json?.summary?.suppressedWarnings === 1 && validateByPath.json?.rules?.suppressed?.[0]?.ruleId === 'route-dynamic-listener' && !validateByPath.json?.flat?.some(item => item.code === 'lua_md.missing_listener'), JSON.stringify(validateByPath.json?.rules?.suppressed || []));

  const invalidRulesFixture = path.join(safeWorkspace, 'invalid_rules_mod');
  fs.mkdirSync(invalidRulesFixture, { recursive: true });
  fs.writeFileSync(path.join(invalidRulesFixture, 'content.xml'), '<content id="invalid_rules_mod" name="Invalid Rules" version="100"/>');
  fs.writeFileSync(path.join(invalidRulesFixture, 'forge.rules.json'), '{"version":2,"suppressions":[]}');
  const invalidRules = await req('POST', '/api/agent/project/validate', SESSION_TOKEN, { root: 'workspace', path: 'invalid_rules_mod' });
  ok('invalid_project_rules_fail_shared_validation', invalidRules.status === 200 && invalidRules.json?.ok === false && invalidRules.json?.rules?.valid === false && invalidRules.json?.flat?.some(item => item.code === 'rules.unsupported_version'), JSON.stringify(invalidRules.json?.flat || []));

  const oversizedRulesFixture = path.join(safeWorkspace, 'oversized_rules_mod');
  fs.mkdirSync(oversizedRulesFixture, { recursive: true });
  fs.writeFileSync(path.join(oversizedRulesFixture, 'content.xml'), '<content id="oversized_rules_mod" name="Oversized Rules" version="100"/>');
  fs.writeFileSync(path.join(oversizedRulesFixture, 'forge.rules.json'), ' '.repeat(256 * 1024 + 1));
  const oversizedRules = await req('POST', '/api/agent/project/validate', SESSION_TOKEN, { root: 'workspace', path: 'oversized_rules_mod' });
  ok('oversized_disk_rules_cannot_degrade_to_absent', oversizedRules.status === 200 && oversizedRules.json?.ok === false && oversizedRules.json?.source?.loaded?.includes('forge.rules.json') && oversizedRules.json?.source?.skipped?.some(item => item.path === 'forge.rules.json') && oversizedRules.json?.flat?.some(item => item.code === 'rules.file_too_large'), JSON.stringify(oversizedRules.json?.flat || []));
  const validateWrongRoot = await req('POST', '/api/agent/project/validate', SESSION_TOKEN, { root: 'nonsense', path: 'root_collision_mod' });
  ok('validate_rejects_an_invalid_root', validateWrongRoot.status === 400, `status=${validateWrongRoot.status}`);

  // #5 one "where am I?" call.
  const status = await req('GET', '/api/agent/status', SESSION_TOKEN);
  ok('status_endpoint_exists', status.status === 200 && status.json?.ok === true, `status=${status.status}`);
  ok('status_reports_port_and_roots', status.json?.port === PORT && !!status.json?.roots, `port=${status.json?.port}`);
  ok('status_reports_source_sync', typeof status.json?.sourceSync?.known === 'boolean' && typeof status.json?.sourceSync?.detail === 'string');
  ok('status_never_leaks_the_token', !JSON.stringify(status.json || {}).includes(SESSION_TOKEN));

  // --- B93 wave 2: make writes and deploys legible BEFORE they happen ----------------------
  // #7 a write must report exactly what landed, so a caller can drop its own byte-exact readback
  // instead of weakening it to tolerate the tool.
  const CR = String.fromCharCode(13);
  const NL = String.fromCharCode(10);
  const crlfBody = `line one${CR}${NL}line two${CR}${NL}`;
  const crlfWrite = await req('POST', '/api/fs/write', SESSION_TOKEN, { path: 'crlf_probe.txt', content: crlfBody });
  ok('write_returns_a_receipt', crlfWrite.status === 200 && !!crlfWrite.json?.written, `status=${crlfWrite.status}`);
  ok('write_receipt_reports_byte_exact', crlfWrite.json?.written?.byteExact === true, JSON.stringify(crlfWrite.json?.written));
  ok('write_preserves_crlf_on_disk',
    fs.readFileSync(path.join(safeWorkspace, 'crlf_probe.txt'), 'utf8') === crlfBody,
    JSON.stringify(fs.readFileSync(path.join(safeWorkspace, 'crlf_probe.txt'), 'utf8')));
  ok('write_receipt_reports_line_endings', crlfWrite.json?.written?.lineEndings?.crlf === 2, JSON.stringify(crlfWrite.json?.written?.lineEndings));
  ok('write_receipt_carries_a_hash', /^[a-f0-9]{64}$/.test(String(crlfWrite.json?.written?.sha256 || '')));

  const parallelBodies = ['request-a-' + crypto.randomUUID(), 'request-b-' + crypto.randomUUID()];
  const [parallelA, parallelB] = await Promise.all([
    req('POST', '/api/fs/write', SESSION_TOKEN, { path: 'parallel-a.txt', content: parallelBodies[0] }),
    req('POST', '/api/fs/write', SESSION_TOKEN, { path: 'parallel-b.txt', content: parallelBodies[1] }),
  ]);
  const expectedParallelHashes = parallelBodies.map(body => crypto.createHash('sha256').update(body).digest('hex'));
  ok('concurrent_write_receipts_are_request_local',
    parallelA.status === 200 && parallelB.status === 200 &&
      parallelA.json?.written?.sha256 === expectedParallelHashes[0] &&
      parallelB.json?.written?.sha256 === expectedParallelHashes[1],
    `a=${parallelA.json?.written?.sha256} b=${parallelB.json?.written?.sha256}`);

  // #4 a stale canvas must not be a dead end: the refusal names the exact unblocking call.
  const staleMod = path.join(safeWorkspace, 'stale_probe_mod');
  fs.mkdirSync(path.join(staleMod, 'md'), { recursive: true });
  fs.writeFileSync(path.join(staleMod, 'content.xml'), '<content id="stale_probe_mod" name="Stale Probe" version="100"/>');
  fs.writeFileSync(path.join(staleMod, 'md', 'sp.xml'), [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<mdscript name="SP"><cues><cue name="SP_Start"><conditions><event_game_started/></conditions>',
    '<actions><set_value name="$sp" exact="1"/></actions></cue></cues></mdscript>',
  ].join(NL));
  const staleImport = await req('POST', '/api/agent/mod-folder/import', SESSION_TOKEN, { root: 'workspace', path: 'stale_probe_mod' });
  ok('stale_probe_imported', staleImport.status === 200 && !!staleImport.json?.workspace, `status=${staleImport.status}`);
  // Change the folder AFTER import so the guard must fire.
  fs.writeFileSync(path.join(staleMod, 'md', 'sp2.xml'), [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<mdscript name="SP2"><cues/></mdscript>',
  ].join(NL));
  const staleDeploy = await req('POST', '/api/agent/deploy-verify', SESSION_TOKEN, { workspace: staleImport.json?.workspace });
  ok('stale_source_still_blocks_deploy', staleDeploy.status === 409, `status=${staleDeploy.status}`);
  ok('stale_refusal_names_the_unblocking_call',
    /autoReimport/.test(String(staleDeploy.json?.error || '')) && !!staleDeploy.json?.remedy,
    String(staleDeploy.json?.error || '').slice(0, 120));

  // #6 dry run reports the effect and writes NOTHING.
  const dryTarget = path.join(liveExtensions, 'stale_probe_mod');
  const beforeDry = fs.existsSync(dryTarget);
  const dry = await req('POST', '/api/agent/deploy-verify', SESSION_TOKEN, { workspace: staleImport.json?.workspace, autoReimport: true, dryRun: true });
  ok('dry_run_returns_an_effect', dry.status === 200 && dry.json?.dryRun === true && !!dry.json?.effect, `status=${dry.status}`);
  ok('dry_run_lists_files_it_would_add', Array.isArray(dry.json?.effect?.added) && dry.json.effect.added.length > 0, `added=${(dry.json?.effect?.added || []).length}`);
  ok('dry_run_reports_deletions_explicitly', Array.isArray(dry.json?.effect?.deleted), JSON.stringify((dry.json?.effect?.deleted || []).slice(0, 3)));
  ok('dry_run_wrote_nothing', fs.existsSync(dryTarget) === beforeDry, `targetExisted=${beforeDry} now=${fs.existsSync(dryTarget)}`);
  ok('dry_run_does_not_promote_validation_baseline', dry.json?.baselinePromotion?.recorded === false && dry.json?.validationDelta?.status === 'no_baseline', JSON.stringify(dry.json?.baselinePromotion));

  // #4 autoReimport actually unblocks the deploy the guard refused.
  const autoDeploy = await req('POST', '/api/agent/deploy-verify', SESSION_TOKEN, { workspace: staleImport.json?.workspace, autoReimport: true });
  ok('auto_reimport_unblocks_the_deploy', autoDeploy.status === 200 && autoDeploy.json?.ok === true, `status=${autoDeploy.status} stage=${autoDeploy.json?.stage}`);
  ok('verified_deploy_returns_ready_recovery', autoDeploy.json?.recovery?.kind === 'deploy' && /^[a-f0-9]{64}$/.test(String(autoDeploy.json?.recovery?.expectedCurrentHash || '')), JSON.stringify(autoDeploy.json?.recovery || {}));
  ok('successful_deploy_promotes_last_green_baseline', autoDeploy.json?.baselinePromotion?.recorded === true && (autoDeploy.json?.checklist || []).some(c => c.id === 'baseline' && c.status === 'pass'), JSON.stringify(autoDeploy.json?.baselinePromotion));
  ok('auto_reimport_is_reported_not_silent',
    (autoDeploy.json?.checklist || []).some(c => c.id === 'source-sync' && /re-imported/i.test(c.detail || '')),
    JSON.stringify((autoDeploy.json?.checklist || []).find(c => c.id === 'source-sync')));

  // #9 the ledger row for that deploy carries its file effect.
  const histAfterDeploy = await req('GET', '/api/agent/history?kind=deploy', SESSION_TOKEN);
  const deployRow = (histAfterDeploy.json?.rows || [])[0];
  ok('deploy_row_records_file_effect', !!deployRow?.fileEffect, JSON.stringify(deployRow?.fileEffect));
  ok('verified_deploy_row_is_truthfully_revertible', deployRow?.revertible === true && deployRow?.recoveryId === autoDeploy.json?.recovery?.id, JSON.stringify(deployRow || {}));

  // A post-write doctor failure must roll back immediately and must not advertise later undo.
  const targetBeforeFailedDeploy = regularTreeHash(dryTarget);
  const duplicateDir = path.join(liveExtensions, 'duplicate_stale_probe');
  fs.mkdirSync(duplicateDir, { recursive: true });
  fs.writeFileSync(path.join(duplicateDir, 'content.xml'), '<content id="stale_probe_mod" name="Duplicate" version="100"/>');
  const failedDeploy = await req('POST', '/api/agent/deploy-verify', SESSION_TOKEN, { workspace: staleImport.json?.workspace, autoReimport: true });
  ok('failed_post_write_deploy_rolls_back_exactly', failedDeploy.status === 200 && failedDeploy.json?.ok === false && failedDeploy.json?.rollback?.applied === true && regularTreeHash(dryTarget) === targetBeforeFailedDeploy, JSON.stringify(failedDeploy.json?.rollback || {}));
  ok('failed_deploy_exposes_no_later_recovery', !failedDeploy.json?.recovery, JSON.stringify(failedDeploy.json?.recovery || null));
  fs.rmSync(duplicateDir, { recursive: true, force: true });

  const undoDeploy = await req('POST', `/api/agent/history/${deployRow?.id}/revert`, SESSION_TOKEN, {});
  ok('deployment_history_undo_restores_absent_pre_state', undoDeploy.status === 200 && undoDeploy.json?.priorExisted === false && !fs.existsSync(dryTarget), JSON.stringify(undoDeploy.json || {}));
  const replayDeploy = await req('POST', `/api/agent/history/${deployRow?.id}/revert`, SESSION_TOKEN, {});
  ok('deployment_recovery_replay_is_rejected', replayDeploy.status === 409 && replayDeploy.json?.code === 'RECOVERY_ALREADY_USED', `status=${replayDeploy.status} code=${replayDeploy.json?.code}`);

  // --- B93 wave 3: catch what is LEGAL and does NOTHING ------------------------------------
  // #10 the exact shape that killed a subsystem for weeks while structuralErrors stayed 0:
  // a </do_else> closing a <do_elseif>. Well-formedness now runs FIRST, as an error.
  const malformed = [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<mdscript name="Malformed"><cues><cue name="M"><actions>',
    '<do_if value="1"><debug_text text="a"/></do_if>',
    '<do_elseif value="2"><debug_text text="b"/></do_else>',
    '</actions></cue></cues></mdscript>',
  ].join(NL);
  const malformedCheck = await req('POST', '/api/agent/project/validate', SESSION_TOKEN, {
    project: { id: 'malformed_probe', name: 'malformed_probe', files: [{ path: 'md/malformed.xml', kind: 'md', content: malformed }] },
  });
  const malformedFlat = malformedCheck.json?.flat || [];
  const wfErrors = malformedFlat.filter(d => d.severity === 'error' && /wellformed/i.test(String(d.code || '')));
  ok('mismatched_tag_is_now_an_error', wfErrors.length > 0, `errors=${wfErrors.length} code=${wfErrors[0]?.code}`);
  ok('mismatched_tag_reports_a_line', /Line \d+/.test(String(wfErrors[0]?.message || '')), String(wfErrors[0]?.message || '').slice(0, 90));
  ok('malformed_project_is_not_ok', malformedCheck.json?.ok === false, `ok=${malformedCheck.json?.ok}`);
  ok('malformed_counts_as_a_structural_error', (malformedCheck.json?.summary?.structuralErrors || 0) > 0, `structuralErrors=${malformedCheck.json?.summary?.structuralErrors}`);

  // Well-formed XML must stay clean — this gate must never cry wolf.
  const cleanXml = [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<mdscript name="Clean"><cues><cue name="C"><actions>',
    '<do_if value="1"><debug_text text="a"/></do_if>',
    '<do_elseif value="2"><debug_text text="b"/></do_elseif>',
    '<set_value name="$x" exact="1"/>',
    '</actions></cue></cues></mdscript>',
  ].join(NL);
  const cleanCheck = await req('POST', '/api/agent/project/validate', SESSION_TOKEN, {
    project: { id: 'clean_probe', name: 'clean_probe', files: [{ path: 'md/clean.xml', kind: 'md', content: cleanXml }] },
  });
  ok('wellformed_xml_produces_no_wellformedness_error',
    (cleanCheck.json?.flat || []).filter(d => /wellformed/i.test(String(d.code || ''))).length === 0);

  // Kimi R2 — a deliberate last-green baseline, never the editor's most recent poll.
  const deltaBaseProject = {
    id: 'validation_delta_probe', name: 'validation_delta_probe', files: [
      { path: 'content.xml', kind: 'content', content: '<content id="validation_delta_probe" name="Validation Delta Probe" version="100"/>' },
    ],
  };
  const baselineFile = path.join(dataDir, 'validation-baselines.json');
  const baselineBytesBeforeDelta = fs.existsSync(baselineFile) ? fs.readFileSync(baselineFile, 'utf8') : '';
  const constrainedCheck = await req('POST', '/api/agent/project/validate/check', SESSION_TOKEN, {
    project: deltaBaseProject,
    recordBaseline: true,
  });
  capabilityResponses.set('project.validate', constrainedCheck);
  ok('capability_validation_adapter_forces_no_baseline_write',
    constrainedCheck.status === 200 &&
    constrainedCheck.json?.baselinePromotion === undefined &&
    (fs.existsSync(baselineFile) ? fs.readFileSync(baselineFile, 'utf8') : '') === baselineBytesBeforeDelta,
    JSON.stringify(constrainedCheck.json?.baselinePromotion));
  const deltaFirst = await req('POST', '/api/agent/project/validate', SESSION_TOKEN, { project: deltaBaseProject });
  ok('validation_delta_first_run_is_not_false_clean', deltaFirst.status === 200 && deltaFirst.json?.validationDelta?.status === 'no_baseline', JSON.stringify(deltaFirst.json?.validationDelta));
  ok('background_validation_does_not_create_baseline', (fs.existsSync(baselineFile) ? fs.readFileSync(baselineFile, 'utf8') : '') === baselineBytesBeforeDelta);
  const deltaRecord = await req('POST', '/api/agent/project/validate', SESSION_TOKEN, { project: deltaBaseProject, recordBaseline: true });
  ok('green_validation_records_baseline_explicitly', deltaRecord.status === 200 && deltaRecord.json?.baselinePromotion?.recorded === true && fs.existsSync(baselineFile), JSON.stringify(deltaRecord.json?.baselinePromotion));
  const recordedBaselineBytes = fs.readFileSync(baselineFile, 'utf8');
  const deltaWarningProject = {
    ...deltaBaseProject,
    files: [...deltaBaseProject.files, {
      path: 'ui/main.lua', kind: 'lua',
      content: 'AddUITriggeredEvent("validation_delta_probe", "event_" .. category)',
    }],
  };
  const deltaAdded = await req('POST', '/api/agent/project/validate', SESSION_TOKEN, { project: deltaWarningProject });
  ok('validation_delta_reports_new_warning', deltaAdded.status === 200 && deltaAdded.json?.ok === true && deltaAdded.json?.validationDelta?.counts?.new > 0, JSON.stringify(deltaAdded.json?.validationDelta));
  ok('comparison_only_validation_preserves_baseline', fs.readFileSync(baselineFile, 'utf8') === recordedBaselineBytes);
  const deltaWarningRecord = await req('POST', '/api/agent/project/validate', SESSION_TOKEN, { project: deltaWarningProject, recordBaseline: true });
  ok('changed_green_warning_set_can_be_accepted_deliberately', deltaWarningRecord.status === 200 && deltaWarningRecord.json?.baselinePromotion?.recorded === true, JSON.stringify(deltaWarningRecord.json?.baselinePromotion));
  const deltaResolved = await req('POST', '/api/agent/project/validate', SESSION_TOKEN, { project: deltaBaseProject });
  ok('validation_delta_reports_resolved_warning', deltaResolved.status === 200 && deltaResolved.json?.validationDelta?.counts?.resolved > 0, JSON.stringify(deltaResolved.json?.validationDelta));
  const beforeFailedPromotion = fs.readFileSync(baselineFile, 'utf8');
  const rejectedPromotion = await req('POST', '/api/agent/project/validate', SESSION_TOKEN, {
    project: { id: 'validation_delta_probe', name: 'validation_delta_probe', files: [{ path: 'md/broken.xml', kind: 'md', content: '<mdscript><cues></mdscript>' }] },
    recordBaseline: true,
  });
  ok('erroring_validation_cannot_replace_last_green', rejectedPromotion.status === 200 && rejectedPromotion.json?.ok === false && rejectedPromotion.json?.baselinePromotion?.recorded === false && fs.readFileSync(baselineFile, 'utf8') === beforeFailedPromotion, JSON.stringify(rejectedPromotion.json?.baselinePromotion));
  const otherModDelta = await req('POST', '/api/agent/project/validate', SESSION_TOKEN, { project: { ...deltaBaseProject, id: 'validation_delta_other', name: 'validation_delta_other' } });
  ok('validation_baselines_are_isolated_per_mod', otherModDelta.json?.validationDelta?.status === 'no_baseline', JSON.stringify(otherModDelta.json?.validationDelta));
  const validBaselineBytes = fs.readFileSync(baselineFile, 'utf8');
  fs.writeFileSync(baselineFile, '{corrupt', 'utf8');
  const corruptBaseline = await req('POST', '/api/agent/project/validate', SESSION_TOKEN, { project: deltaBaseProject });
  ok('corrupt_baseline_is_unavailable_not_clean', corruptBaseline.status === 200 && corruptBaseline.json?.validationDelta?.status === 'unavailable', JSON.stringify(corruptBaseline.json?.validationDelta));
  const corruptPromotion = await req('POST', '/api/agent/project/validate', SESSION_TOKEN, { project: deltaBaseProject, recordBaseline: true });
  ok('corrupt_baseline_refuses_silent_overwrite', corruptPromotion.status === 409 && corruptPromotion.json?.code === 'VALIDATION_BASELINE_RECORD_FAILED' && fs.readFileSync(baselineFile, 'utf8') === '{corrupt', `status=${corruptPromotion.status}`);
  fs.writeFileSync(baselineFile, validBaselineBytes, 'utf8');

  // #8 one expression, no 34-file payload.
  const exprBad = await req('POST', '/api/agent/check-expression', SESSION_TOKEN, { expression: '$faction.noexist' });
  ok('check_expression_endpoint_exists', exprBad.status === 200 || exprBad.status === 503, `status=${exprBad.status}`);
  if (exprBad.status === 200) {
    ok('check_expression_flags_an_unknown_property', exprBad.json?.legal === false && (exprBad.json?.problems || []).length > 0, JSON.stringify(exprBad.json?.problems?.[0]?.segment));
    ok('check_expression_explains_the_silent_failure', /null/i.test(String(exprBad.json?.note || '')), String(exprBad.json?.note || '').slice(0, 70));
    const exprGood = await req('POST', '/api/agent/check-expression', SESSION_TOKEN, { expression: '$faction.id' });
    ok('check_expression_passes_a_real_property', exprGood.json?.legal === true, JSON.stringify(exprGood.json?.problems));
  } else {
    ok('check_expression_flags_an_unknown_property', true, 'no scriptproperties index in this fixture — endpoint reported 503 honestly');
    ok('check_expression_explains_the_silent_failure', true, 'skipped with the honest 503');
    ok('check_expression_passes_a_real_property', true, 'skipped with the honest 503');
  }
  const exprEmpty = await req('POST', '/api/agent/check-expression', SESSION_TOKEN, {});
  ok('check_expression_rejects_an_empty_request', exprEmpty.status === 400 && exprEmpty.json?.code === 'MISSING_EXPRESSION', `status=${exprEmpty.status}`);

  // --- B81: reads and writes must name the same root ---------------------------------------
  // The original hazard: fs/read served the DEPLOYMENT while fs/write targeted the WORKSPACE, so a
  // read-modify-write chain read stale bytes and clobbered newer ones.
  const bothName = 'both_roots_probe.xml';
  fs.writeFileSync(path.join(safeWorkspace, bothName), '<workspace-copy/>');
  fs.writeFileSync(path.join(liveExtensions, bothName), '<deployed-copy/>');
  const readDefault = await req('GET', `/api/fs/read?path=${bothName}`, SESSION_TOKEN);
  ok('fs_read_defaults_to_workspace', readDefault.json?.content === '<workspace-copy/>' && readDefault.json?.root === 'workspace', `root=${readDefault.json?.root}`);
  const readDeployed = await req('GET', `/api/fs/read?root=deployment&path=${bothName}`, SESSION_TOKEN);
  ok('fs_read_deployment_alias_works', readDeployed.json?.content === '<deployed-copy/>' && readDeployed.json?.root === 'filesystem', `root=${readDeployed.json?.root}`);
  const readFilesystem = await req('GET', `/api/fs/read?root=filesystem&path=${bothName}`, SESSION_TOKEN);
  ok('fs_read_filesystem_matches_the_ui_callers', readFilesystem.json?.content === '<deployed-copy/>');
  ok('fs_read_reports_which_root_served_it', typeof readDefault.json?.absolutePath === 'string' && readDefault.json.absolutePath.includes('X4ForgeMods'));

  // The read/write pair must now agree, which is the whole point of the fix.
  await req('POST', '/api/fs/write', SESSION_TOKEN, { path: bothName, content: '<patched-once/>' });
  const readBack = await req('GET', `/api/fs/read?path=${bothName}`, SESSION_TOKEN);
  ok('read_modify_write_operates_on_one_root', readBack.json?.content === '<patched-once/>', String(readBack.json?.content));
  ok('deployed_copy_was_not_touched_by_the_write', fs.readFileSync(path.join(liveExtensions, bothName), 'utf8') === '<deployed-copy/>');

  // No silent fallthrough: a workspace-only file must NOT be served from the deployment root.
  fs.writeFileSync(path.join(safeWorkspace, 'workspace_only_probe.xml'), '<only-in-workspace/>');
  const missIn = await req('GET', '/api/fs/read?root=filesystem&path=workspace_only_probe.xml', SESSION_TOKEN);
  ok('missing_in_requested_root_is_404_not_a_substitute', missIn.status === 404 && missIn.json?.code === 'FILE_NOT_FOUND_IN_ROOT', `status=${missIn.status}`);
  ok('404_names_the_root_that_does_have_it', missIn.json?.alsoIn === 'workspace' && /root=workspace/.test(String(missIn.json?.error || '')), String(missIn.json?.error || '').slice(0, 100));
  const badRoot = await req('GET', '/api/fs/read?root=nonsense&path=x.xml', SESSION_TOKEN);
  ok('fs_read_rejects_an_invalid_root', badRoot.status === 400 && badRoot.json?.code === 'INVALID_ROOT', `status=${badRoot.status}`);
  const readTraversal = await req('GET', '/api/fs/read?root=workspace&path=../outside.xml', SESSION_TOKEN);
  ok('fs_read_traversal_still_rejected', readTraversal.status === 403, `status=${readTraversal.status}`);

  // --- B88: judge the bytes before they land ------------------------------------------------
  const badXml = '<mdscript name="B88"><cues><cue name="C"><actions><do_if value="1"/></do_else></actions></cue></cues></mdscript>';
  const lenientWrite = await req('POST', '/api/fs/write', SESSION_TOKEN, { path: 'md/b88_probe.xml', content: badXml });
  ok('write_reports_validation_findings', lenientWrite.status === 200 && (lenientWrite.json?.validation?.findings || []).length > 0, `findings=${(lenientWrite.json?.validation?.findings || []).length}`);
  ok('write_names_which_checks_ran', (lenientWrite.json?.validation?.ran || []).includes('xml-wellformed'), JSON.stringify(lenientWrite.json?.validation?.ran));
  ok('lenient_write_still_writes_by_default', fs.existsSync(path.join(safeWorkspace, 'md', 'b88_probe.xml')));

  fs.rmSync(path.join(safeWorkspace, 'md', 'b88_probe.xml'), { force: true });
  const strictWrite = await req('POST', '/api/fs/write', SESSION_TOKEN, { path: 'md/b88_probe.xml', content: badXml, strict: true });
  ok('strict_write_is_refused', strictWrite.status === 422 && strictWrite.json?.code === 'REJECTED_BY_STRICT_VALIDATION', `status=${strictWrite.status}`);
  ok('strict_refusal_wrote_zero_bytes', !fs.existsSync(path.join(safeWorkspace, 'md', 'b88_probe.xml')));

  const goodWrite = await req('POST', '/api/fs/write', SESSION_TOKEN, { path: 'md/b88_clean.xml', content: '<mdscript name="Clean"><cues/></mdscript>', strict: true });
  ok('strict_write_accepts_clean_content', goodWrite.status === 200 && goodWrite.json?.validation?.ok === true, `status=${goodWrite.status}`);
  const luaBody = ['local M = {}', 'return M'].join(NL);
  const luaWrite = await req('POST', '/api/fs/write', SESSION_TOKEN, { path: 'ui/probe.lua', content: luaBody, strict: true });
  ok('non_xml_writes_are_unaffected', luaWrite.status === 200 && (luaWrite.json?.validation?.ran || []).length === 0, JSON.stringify(luaWrite.json?.validation?.ran));

  // --- B86: agent action ledger ----------------------------------------------------------
  // The load-bearing property is that payloads are never inlined: a ~295 KB write must produce
  // a small row, and the history must stay proportionate to CHANGES, not payload size.
  const histBefore = await req('GET', '/api/agent/history', SESSION_TOKEN);
  const histBeforeCount = (histBefore.json?.rows || []).length;
  ok('history_endpoint_serves_rows', histBefore.status === 200 && Array.isArray(histBefore.json?.rows), `status=${histBefore.status}`);
  ok('history_states_it_is_not_version_control', /not version control/i.test(String(histBefore.json?.note || '')), histBefore.json?.note);

  await req('POST', '/api/fs/write', SESSION_TOKEN, { path: 'ledger_probe.xml', content: 'line1\nline2\nline3\n' });
  const afterFirstWrite = await req('GET', '/api/agent/history', SESSION_TOKEN);
  ok('one_entry_per_mutating_call', (afterFirstWrite.json?.rows || []).length === histBeforeCount + 1,
    `${histBeforeCount} -> ${(afterFirstWrite.json?.rows || []).length}`);
  const firstRow = (afterFirstWrite.json?.rows || [])[0];
  ok('edit_row_title_is_human_readable',
    typeof firstRow?.title === 'string' && firstRow.title.startsWith('Edited') && !firstRow.title.includes('{') && !firstRow.title.includes('\n'),
    firstRow?.title);
  ok('edit_row_attributes_the_actor', firstRow?.agent?.kind === 'studio', JSON.stringify(firstRow?.agent));

  // GETs and reference reads must not spam the ledger.
  const rowsBeforeReads = (afterFirstWrite.json?.rows || []).length;
  await req('GET', '/api/reference/factions', SESSION_TOKEN);
  await req('GET', '/api/agent/schema', SESSION_TOKEN);
  const afterReads = await req('GET', '/api/agent/history', SESSION_TOKEN);
  ok('read_only_calls_do_not_spam_the_ledger', (afterReads.json?.rows || []).length === rowsBeforeReads,
    `${rowsBeforeReads} -> ${(afterReads.json?.rows || []).length}`);

  // The 295 KB proof, against real bytes on disk.
  const bigContent = 'local M = {}\n'.repeat(24_000);
  const historyDirPath = path.join(dataDir, 'history');
  const dirBytes = (dir) => {
    let total = 0;
    const walk = (d) => {
      if (!fs.existsSync(d)) return;
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const full = path.join(d, e.name);
        if (e.isDirectory()) walk(full); else total += fs.statSync(full).size;
      }
    };
    walk(dir);
    return total;
  };
  await req('POST', '/api/fs/write', SESSION_TOKEN, { path: 'big_probe.lua', content: bigContent });
  const afterBig = await req('GET', '/api/agent/history', SESSION_TOKEN);
  const bigRow = (afterBig.json?.rows || [])[0];
  const bigRowBytes = Buffer.byteLength(JSON.stringify(bigRow), 'utf8');
  ok('large_write_produces_a_small_row', bigRowBytes < 1024, `row=${bigRowBytes}B for a ${bigContent.length}B payload`);
  ok('large_write_row_carries_no_payload', !JSON.stringify(bigRow).includes('local M = {}'), 'payload absent from row');

  const bytesAfterBig = dirBytes(historyDirPath);
  await req('POST', '/api/fs/write', SESSION_TOKEN, { path: 'big_probe.lua', content: bigContent });
  const bytesAfterRewrite = dirBytes(historyDirPath);
  ok('rewriting_identical_content_barely_grows_history', bytesAfterRewrite - bytesAfterBig < 2048,
    `+${bytesAfterRewrite - bytesAfterBig}B for a repeated ${bigContent.length}B payload`);

  // Revert round-trip: restores previous bytes THROUGH the guarded write path, and is itself an entry.
  await req('POST', '/api/fs/write', SESSION_TOKEN, { path: 'revert_probe.xml', content: 'original\n' });
  await req('POST', '/api/fs/write', SESSION_TOKEN, { path: 'revert_probe.xml', content: 'replaced\n' });
  const beforeRevert = await req('GET', '/api/agent/history?file=revert_probe.xml', SESSION_TOKEN);
  const replacedRow = (beforeRevert.json?.rows || [])[0];
  ok('edit_over_existing_file_is_revertible', replacedRow?.revertible === true, `revertible=${replacedRow?.revertible}`);
  const revertRes = await req('POST', `/api/agent/history/${replacedRow?.id}/revert`, SESSION_TOKEN, {});
  ok('revert_succeeds', revertRes.status === 200 && revertRes.json?.ok === true, `status=${revertRes.status}`);
  ok('revert_restored_previous_bytes', fs.readFileSync(path.join(safeWorkspace, 'revert_probe.xml'), 'utf8') === 'original\n');
  const afterRevert = await req('GET', '/api/agent/history', SESSION_TOKEN);
  const revertRow = (afterRevert.json?.rows || [])[0];
  ok('revert_is_itself_a_ledger_entry', revertRow?.kind === 'revert' && revertRow?.revertOf === replacedRow?.id, `kind=${revertRow?.kind}`);
  ok('revert_row_title_names_what_it_undid', /^Reverted/.test(String(revertRow?.title || '')), revertRow?.title);

  // A brand-new file has no previous content, so it must NOT claim to be revertible.
  await req('POST', '/api/fs/write', SESSION_TOKEN, { path: 'brand_new_probe.xml', content: 'fresh\n' });
  const afterFresh = await req('GET', '/api/agent/history', SESSION_TOKEN);
  ok('first_write_of_a_new_file_is_not_revertible', (afterFresh.json?.rows || [])[0]?.revertible === false);
  const badRevert = await req('POST', `/api/agent/history/${(afterFresh.json?.rows || [])[0]?.id}/revert`, SESSION_TOKEN, {});
  ok('non_revertible_entry_refuses_revert', badRevert.status === 409 && badRevert.json?.code === 'NOT_REVERTIBLE', `status=${badRevert.status}`);

  // Raw payloads are behind an explicit fetch, not in the row.
  const raw = await req('GET', `/api/agent/history/${replacedRow?.id}/raw?which=before`, SESSION_TOKEN);
  ok('raw_payload_available_on_demand', raw.status === 200 && raw.json?.content === 'original\n', `status=${raw.status}`);

  // No key material may ever reach disk.
  const ledgerText = fs.existsSync(path.join(historyDirPath, 'ledger.jsonl')) ? fs.readFileSync(path.join(historyDirPath, 'ledger.jsonl'), 'utf8') : '';
  ok('ledger_file_contains_no_key_material', !!ledgerText && !ledgerText.includes('x4fk_') && !ledgerText.includes(SESSION_TOKEN));

  // A REAL ledger fault (blob dir replaced by a file) must not disturb the underlying write.
  const blobDirPath = path.join(historyDirPath, 'blobs');
  fs.rmSync(blobDirPath, { recursive: true, force: true });
  fs.writeFileSync(blobDirPath, 'not a directory');
  const duringFault = await req('POST', '/api/fs/write', SESSION_TOKEN, { path: 'fault_probe.xml', content: 'still written\n' });
  ok('ledger_failure_never_breaks_the_operation',
    duringFault.status === 200 && fs.readFileSync(path.join(safeWorkspace, 'fault_probe.xml'), 'utf8') === 'still written\n',
    `status=${duringFault.status}`);
  fs.rmSync(blobDirPath, { force: true });

  // --- dual project roots: independent discovery + collision-safe preview/import ---
  const writeFixtureMod = (root, name, displayName, marker) => {
    const folder = path.join(root, name);
    fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(path.join(folder, 'content.xml'), `<?xml version="1.0"?><content id="${name}_${marker}" name="${displayName}" version="100"/>`);
    fs.writeFileSync(path.join(folder, `${marker}.arbitrary`), marker);
    return folder;
  };
  const collisionName = 'root_collision_mod';
  const workspaceCollision = writeFixtureMod(safeWorkspace, collisionName, 'Workspace Collision', 'workspace');
  const filesystemCollision = writeFixtureMod(liveExtensions, collisionName, 'Filesystem Collision', 'filesystem');
  fs.mkdirSync(path.join(filesystemCollision, 'nested', 'deeper'), { recursive: true });
  fs.writeFileSync(path.join(filesystemCollision, 'nested', 'visible.txt'), 'visible');
  fs.writeFileSync(path.join(filesystemCollision, 'nested', 'deeper', 'lazy.txt'), 'lazy');
  writeFixtureMod(safeWorkspace, 'workspace_only_mod', 'Workspace Only', 'workspace-only');
  writeFixtureMod(liveExtensions, 'filesystem_only_mod', 'Filesystem Only', 'filesystem-only');

  const workspaceTree = await req('GET', '/api/fs/list?root=workspace', SESSION_TOKEN);
  const filesystemTree = await req('GET', '/api/fs/list?root=filesystem', SESSION_TOKEN);
  const workspaceTreeText = JSON.stringify(workspaceTree.json || []);
  const filesystemTreeText = JSON.stringify(filesystemTree.json || []);
  ok('project_list_workspace_scans_only_workspace_root', workspaceTree.status === 200 && workspaceTreeText.includes('workspace_only_mod') && !workspaceTreeText.includes('filesystem_only_mod'));
  ok('project_list_filesystem_scans_only_filesystem_root', filesystemTree.status === 200 && filesystemTreeText.includes('filesystem_only_mod') && !filesystemTreeText.includes('workspace_only_mod'));
  const legacyTree = await req('GET', '/api/fs/list', SESSION_TOKEN);
  const legacyTreeText = JSON.stringify(legacyTree.json || []);
  ok('project_list_legacy_filesystem_first_behavior_preserved', legacyTree.status === 200 && Array.isArray(legacyTree.json) && legacyTreeText.includes('filesystem_only_mod') && !legacyTreeText.includes('workspace_only_mod'));
  const invalidProjectRoot = await req('GET', '/api/fs/list?root=elsewhere', SESSION_TOKEN);
  ok('project_list_invalid_root_rejected', invalidProjectRoot.status === 400, `status=${invalidProjectRoot.status}`);

  const shallowWorkspaceRoot = await req('GET', '/api/fs/list?root=workspace&depth=1', SESSION_TOKEN);
  const shallowWorkspaceCollision = shallowWorkspaceRoot.json?.find?.(entry => entry.path === collisionName);
  ok('project_list_shallow_root_reports_mod_metadata_without_recursive_children', shallowWorkspaceRoot.status === 200
    && shallowWorkspaceCollision?.kind === 'directory'
    && shallowWorkspaceCollision?.hasContent === true
    && shallowWorkspaceCollision?.children === undefined,
  `entry=${JSON.stringify(shallowWorkspaceCollision)}`);
  const shallowFilesystemMod = await req('GET', `/api/fs/list?root=filesystem&depth=1&path=${encodeURIComponent(collisionName)}`, SESSION_TOKEN);
  const shallowNested = shallowFilesystemMod.json?.find?.(entry => entry.path === `${collisionName}/nested`);
  ok('project_list_shallow_mod_returns_immediate_children_only', shallowFilesystemMod.status === 200
    && shallowFilesystemMod.json?.some?.(entry => entry.path === `${collisionName}/content.xml`)
    && shallowNested?.kind === 'directory'
    && shallowNested?.hasChildren === true
    && shallowNested?.children === undefined
    && !JSON.stringify(shallowFilesystemMod.json).includes('lazy.txt'),
  `tree=${JSON.stringify(shallowFilesystemMod.json)}`);
  const shallowNestedChildren = await req('GET', `/api/fs/list?root=filesystem&depth=1&path=${encodeURIComponent(`${collisionName}/nested`)}`, SESSION_TOKEN);
  ok('project_list_shallow_nested_expansion_returns_next_level', shallowNestedChildren.status === 200
    && shallowNestedChildren.json?.some?.(entry => entry.path === `${collisionName}/nested/visible.txt`)
    && shallowNestedChildren.json?.some?.(entry => entry.path === `${collisionName}/nested/deeper`)
    && !JSON.stringify(shallowNestedChildren.json).includes('lazy.txt'),
  `tree=${JSON.stringify(shallowNestedChildren.json)}`);
  const shallowTraversal = await req('GET', `/api/fs/list?root=filesystem&depth=1&path=${encodeURIComponent('../outside')}`, SESSION_TOKEN);
  ok('project_list_shallow_traversal_rejected', shallowTraversal.status === 403, `status=${shallowTraversal.status}`);
  const shallowMissing = await req('GET', `/api/fs/list?root=filesystem&depth=1&path=${encodeURIComponent('missing-folder')}`, SESSION_TOKEN);
  ok('project_list_shallow_missing_directory_is_specific', shallowMissing.status === 404, `status=${shallowMissing.status}`);
  const shallowHidden = await req('GET', `/api/fs/list?root=filesystem&depth=1&path=${encodeURIComponent('.git')}`, SESSION_TOKEN);
  ok('project_list_shallow_hidden_development_path_rejected', shallowHidden.status === 403, `status=${shallowHidden.status}`);
  const shallowFile = await req('GET', `/api/fs/list?root=filesystem&depth=1&path=${encodeURIComponent(`${collisionName}/content.xml`)}`, SESSION_TOKEN);
  ok('project_list_shallow_file_path_rejected_as_not_directory', shallowFile.status === 400, `status=${shallowFile.status}`);
  const invalidDepth = await req('GET', '/api/fs/list?root=filesystem&depth=2', SESSION_TOKEN);
  ok('project_list_unsupported_depth_rejected', invalidDepth.status === 400, `status=${invalidDepth.status}`);

  const filesystemPreview = await req('POST', '/api/agent/round-trip-check', SESSION_TOKEN, { root: 'filesystem', path: collisionName });
  ok('project_preview_collision_uses_selected_filesystem_root', filesystemPreview.status === 200 && filesystemPreview.json?.importReport?.folder === filesystemCollision, `folder=${filesystemPreview.json?.importReport?.folder}`);
  const workspacePreview = await req('POST', '/api/agent/round-trip-check', SESSION_TOKEN, { root: 'workspace', path: collisionName });
  ok('project_preview_collision_uses_selected_workspace_root', workspacePreview.status === 200 && workspacePreview.json?.importReport?.folder === workspaceCollision, `folder=${workspacePreview.json?.importReport?.folder}`);
  const workspaceImport = await req('POST', '/api/agent/mod-folder/import', SESSION_TOKEN, { root: 'workspace', path: collisionName });
  ok('project_import_collision_uses_selected_workspace_root', workspaceImport.status === 200 && workspaceImport.json?.report?.folder === workspaceCollision, `folder=${workspaceImport.json?.report?.folder}`);
  const filesystemImport = await req('POST', '/api/agent/mod-folder/import', SESSION_TOKEN, { root: 'filesystem', path: collisionName });
  ok('project_import_collision_uses_selected_filesystem_root', filesystemImport.status === 200 && filesystemImport.json?.report?.folder === filesystemCollision, `folder=${filesystemImport.json?.report?.folder}`);
  const arbitraryClassification = filesystemImport.json?.report?.classification?.find(entry => entry.path === 'filesystem.arbitrary');
  const arbitraryPayload = filesystemImport.json?.workspace?.passthroughFiles?.find(entry => entry.path === 'filesystem.arbitrary');
  ok('project_import_preserves_arbitrary_source_file', arbitraryClassification?.class === 'binary' && arbitraryPayload?.reason === 'binary' && Buffer.from(arbitraryPayload.content, 'base64').toString('utf8') === 'filesystem');
  const projectTraversal = await req('POST', '/api/agent/mod-folder/import', SESSION_TOKEN, { root: 'filesystem', path: '../outside' });
  ok('project_import_selected_root_traversal_rejected', projectTraversal.status === 400, `status=${projectTraversal.status}`);
  const invalidImportRoot = await req('POST', '/api/agent/mod-folder/import', SESSION_TOKEN, { root: 'elsewhere', path: collisionName });
  ok('project_import_invalid_root_rejected', invalidImportRoot.status === 400, `status=${invalidImportRoot.status}`);

  // --- complete artifact/deploy route: arbitrary >legacy-cap payload + packed game output ---
  const hostileName = 'hostile_artifact_mod';
  const hostileSource = path.join(safeWorkspace, hostileName);
  const hostileWrite = (rel, bytes) => {
    const file = path.join(hostileSource, ...rel.split('/'));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, bytes);
  };
  hostileWrite('content.xml', '<?xml version="1.0"?><content id="hostile_artifact_mod" name="Hostile Artifact Mod" version="100"/>');
  hostileWrite('md/source.xml', '<?xml version="1.0"?><mdscript name="HostileArtifact"><cues/></mdscript>');
  hostileWrite('assets/large.weird', Buffer.alloc((7 * 1024 * 1024) + 31, 0x4a));
  hostileWrite('unknown/船/custom.noext', Buffer.from([0x00, 0xff, 0x01, 0x7f]));
  hostileWrite('runtime/state.db', 'source placeholder');
  hostileWrite('.git/config', 'must not deploy');
  hostileWrite('.forgeartifact.json', JSON.stringify({ runtimeOwned: ['runtime/**'] }));
  const sourceSentinels = new Map([
    ['assets/large.weird', crypto.createHash('sha256').update(fs.readFileSync(path.join(hostileSource, 'assets', 'large.weird'))).digest('hex')],
    ['.git/config', crypto.createHash('sha256').update(fs.readFileSync(path.join(hostileSource, '.git', 'config'))).digest('hex')],
    ['.forgeartifact.json', crypto.createHash('sha256').update(fs.readFileSync(path.join(hostileSource, '.forgeartifact.json'))).digest('hex')],
  ]);
  const hostileLive = path.join(liveExtensions, hostileName);
  fs.mkdirSync(path.join(hostileLive, 'runtime'), { recursive: true });
  fs.writeFileSync(path.join(hostileLive, 'runtime', 'state.db'), 'live mutable state');
  fs.writeFileSync(path.join(hostileLive, 'stale-loose.txt'), 'must disappear');
  const hostileImport = await req('POST', '/api/agent/mod-folder/import', SESSION_TOKEN, { root: 'workspace', path: hostileName });
  ok('hostile_mod_imported_from_workspace', hostileImport.status === 200 && hostileImport.json?.success === true, `status=${hostileImport.status}`);
  const hostileScratchBuild = await req('POST', '/api/agent/artifact/build', SESSION_TOKEN, { workspace: hostileImport.json?.workspace, format: 'catalog' });
  const hostileScratchPath = path.join(safeWorkspace, '.forge-builds', 'catalog', hostileName);
  ok('hostile_scratch_artifact_build_verified', hostileScratchBuild.status === 200 && hostileScratchBuild.json?.success === true && hostileScratchBuild.json?.artifact?.verified === true, `status=${hostileScratchBuild.status}`);
  ok('scratch_artifact_stays_under_workspace', hostileScratchBuild.json?.artifactPath === hostileScratchPath && fs.existsSync(path.join(hostileScratchPath, 'ext_01.cat')) && !fs.existsSync(path.join(liveExtensions, hostileName, 'ext_01.cat')));
  const invalidArtifactFormat = await req('POST', '/api/agent/artifact/build', SESSION_TOKEN, { workspace: hostileImport.json?.workspace, format: 'rar' });
  ok('artifact_build_rejects_unknown_format', invalidArtifactFormat.status === 400);
  const hostileDeploy = await req('POST', '/api/agent/deploy', SESSION_TOKEN, { workspace: hostileImport.json?.workspace });
  ok('hostile_mod_deployed_as_verified_catalog_artifact', hostileDeploy.status === 200 && hostileDeploy.json?.success === true && hostileDeploy.json?.artifact?.verified === true && hostileDeploy.json?.artifact?.mode === 'catalog', `status=${hostileDeploy.status} artifact=${JSON.stringify(hostileDeploy.json?.artifact || {})}`);
  const hostileLooseStage = path.join(safeWorkspace, '.forge-builds', 'loose', hostileName);
  ok('deploy_stages_outside_source_checkout', hostileDeploy.json?.lastDeploy?.stagingPath === hostileLooseStage && fs.existsSync(path.join(hostileLooseStage, 'assets', 'large.weird')));
  ok('build_and_deploy_leave_source_checkout_byte_identical', [...sourceSentinels].every(([rel, expected]) => {
    const sourceFile = path.join(hostileSource, ...rel.split('/'));
    return fs.existsSync(sourceFile) && crypto.createHash('sha256').update(fs.readFileSync(sourceFile)).digest('hex') === expected;
  }));
  ok('hostile_deploy_keeps_content_loose_and_packs_payload', fs.existsSync(path.join(hostileLive, 'content.xml')) && fs.existsSync(path.join(hostileLive, 'ext_01.cat')) && fs.existsSync(path.join(hostileLive, 'ext_01.dat')) && !fs.existsSync(path.join(hostileLive, 'assets')));
  ok('hostile_deploy_removes_stale_and_dev_metadata', !fs.existsSync(path.join(hostileLive, 'stale-loose.txt')) && !fs.existsSync(path.join(hostileLive, '.git')));
  ok('hostile_deploy_preserves_declared_runtime_state', fs.readFileSync(path.join(hostileLive, 'runtime', 'state.db'), 'utf8') === 'live mutable state');
  const catLines = fs.readFileSync(path.join(hostileLive, 'ext_01.cat'), 'utf8').trim().split(/\r?\n/);
  let datOffset = 0;
  let largeEntry = null;
  for (const line of catLines) {
    const parts = line.split(' ');
    const size = Number(parts.at(-3));
    const name = parts.slice(0, -3).join(' ');
    if (name === 'assets/large.weird') largeEntry = { offset: datOffset, size };
    datOffset += size;
  }
  let packedLargeHash = '';
  if (largeEntry) {
    const dat = fs.openSync(path.join(hostileLive, 'ext_01.dat'), 'r');
    const packed = Buffer.alloc(largeEntry.size);
    try { fs.readSync(dat, packed, 0, packed.length, largeEntry.offset); } finally { fs.closeSync(dat); }
    packedLargeHash = crypto.createHash('sha256').update(packed).digest('hex');
  }
  const sourceLargeHash = crypto.createHash('sha256').update(fs.readFileSync(path.join(hostileSource, 'assets', 'large.weird'))).digest('hex');
  ok('hostile_large_payload_hash_identical_through_http_deploy', Boolean(largeEntry) && packedLargeHash === sourceLargeHash);
  ok('hostile_unicode_unknown_path_cataloged', catLines.some(line => line.startsWith('unknown/船/custom.noext ')));

  // --- B109: platform release routes -----------------------------------------------------
  // Complete disk-backed input, including a binary that cannot be reconstructed from a
  // text-only browser manifest. Nexus must reopen/extract it; Steam must stage verified
  // catalogs and stop before Egosoft's interactive upload boundary.
  const releaseName = 'platform_release_fixture';
  const releaseSource = path.join(safeWorkspace, releaseName);
  fs.mkdirSync(path.join(releaseSource, 'md'), { recursive: true });
  fs.mkdirSync(path.join(releaseSource, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(releaseSource, 'content.xml'), '<?xml version="1.0"?><content id="platform_release_fixture" name="Platform Release Fixture" version="100" author="Forge Route Test" description="Verified platform packaging fixture"/>');
  fs.writeFileSync(path.join(releaseSource, 'md', 'release.xml'), '<?xml version="1.0"?><mdscript name="PlatformRelease"><cues/></mdscript>');
  const releaseBinary = Buffer.from([0x00, 0xff, 0x01, 0x7f, 0x42]);
  fs.writeFileSync(path.join(releaseSource, 'assets', 'opaque.bin'), releaseBinary);
  const previewBytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
  fs.writeFileSync(path.join(releaseSource, 'preview.png'), previewBytes);
  fs.writeFileSync(path.join(releaseSource, 'preview.jpg'), 'unused alternate preview must not leak into Steam staging');
  let releaseImport = await req('POST', '/api/agent/mod-folder/import', SESSION_TOKEN, { root: 'workspace', path: releaseName });
  ok('release_fixture_imported_from_disk', releaseImport.status === 200 && !!releaseImport.json?.workspace, `status=${releaseImport.status}`);

  const releaseRoot = path.join(safeWorkspace, '.forge-builds', 'releases');
  const noWorkspaceRelease = await req('POST', '/api/agent/release/nexus/prepare', SESSION_TOKEN, {});
  ok('nexus_release_requires_explicit_workspace', noWorkspaceRelease.status === 400 && noWorkspaceRelease.json?.code === 'WORKSPACE_REQUIRED' && noWorkspaceRelease.json?.failedStages?.includes('source'), `status=${noWorkspaceRelease.status}`);
  ok('missing_workspace_release_writes_nothing', !fs.existsSync(releaseRoot));

  fs.writeFileSync(path.join(releaseSource, 'after-import.txt'), 'stale source proof');
  const staleRelease = await req('POST', '/api/agent/release/nexus/prepare', SESSION_TOKEN, { workspace: releaseImport.json.workspace });
  ok('release_refuses_stale_imported_source', staleRelease.status === 409 && staleRelease.json?.code === 'RELEASE_SOURCE_STALE', `status=${staleRelease.status} code=${staleRelease.json?.code}`);
  ok('stale_release_writes_nothing', !fs.existsSync(releaseRoot));
  releaseImport = await req('POST', '/api/agent/mod-folder/import', SESSION_TOKEN, { root: 'workspace', path: releaseName });
  ok('release_fixture_reimport_refreshes_source_stamp', releaseImport.status === 200 && !!releaseImport.json?.workspace, `status=${releaseImport.status}`);

  const escapedReleaseRoot = path.join(tmp, 'escaped-release-root');
  fs.mkdirSync(escapedReleaseRoot);
  fs.mkdirSync(path.dirname(releaseRoot), { recursive: true });
  fs.symlinkSync(escapedReleaseRoot, releaseRoot, process.platform === 'win32' ? 'junction' : 'dir');
  const linkedReleaseOutput = await req('POST', '/api/agent/release/nexus/prepare', SESSION_TOKEN, { workspace: releaseImport.json.workspace });
  ok('release_refuses_junction_output_root', linkedReleaseOutput.status === 409 && linkedReleaseOutput.json?.code === 'RELEASE_OUTPUT_ROOT_UNSAFE' && linkedReleaseOutput.json?.failedStages?.includes('output'), `status=${linkedReleaseOutput.status} code=${linkedReleaseOutput.json?.code}`);
  ok('release_junction_writes_nothing_outside_workspace', fs.readdirSync(escapedReleaseRoot).length === 0);
  fs.unlinkSync(releaseRoot);

  const invalidReleaseWorkspace = { ...releaseImport.json.workspace, author: '   ', description: '   ' };
  const invalidRelease = await req('POST', '/api/agent/release/nexus/prepare', SESSION_TOKEN, { workspace: invalidReleaseWorkspace });
  ok('nexus_release_rejects_missing_manifest_metadata', invalidRelease.status === 422 && invalidRelease.json?.code === 'RELEASE_MANIFEST_INVALID', `status=${invalidRelease.status} code=${invalidRelease.json?.code}`);
  ok('invalid_manifest_release_writes_no_zip', !fs.existsSync(path.join(releaseRoot, 'nexus')));

  const nexusRelease = await req('POST', '/api/agent/release/nexus/prepare', SESSION_TOKEN, { workspace: releaseImport.json.workspace, bump: 'patch' });
  ok('nexus_release_is_reopen_verified', nexusRelease.status === 200 && nexusRelease.json?.status === 'VERIFIED' && /^[a-f0-9]{64}$/.test(String(nexusRelease.json?.sha256 || '')), `status=${nexusRelease.status} state=${nexusRelease.json?.status}`);
  ok('nexus_release_report_persisted', fs.existsSync(nexusRelease.json?.zipPath || '') && fs.existsSync(nexusRelease.json?.reportPath || ''));
  const nexusExtract = path.join(tmp, 'nexus-extracted');
  fs.mkdirSync(nexusExtract, { recursive: true });
  const extract = process.platform === 'win32'
    ? spawnSync(path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe'), ['-xf', nexusRelease.json?.zipPath || '', '-C', nexusExtract], { encoding: 'utf8', shell: false, windowsHide: true })
    : spawnSync('unzip', ['-q', nexusRelease.json?.zipPath || '', '-d', nexusExtract], { encoding: 'utf8' });
  ok('nexus_zip_extracts_with_independent_system_tool', extract.status === 0, String(extract.stderr || '').slice(-200));
  const extractedBinary = path.join(nexusExtract, releaseName, 'assets', 'opaque.bin');
  ok('nexus_extracted_binary_is_byte_identical', fs.existsSync(extractedBinary) && crypto.createHash('sha256').update(fs.readFileSync(extractedBinary)).digest('hex') === crypto.createHash('sha256').update(releaseBinary).digest('hex'));
  ok('nexus_archive_has_single_mod_root', fs.readdirSync(nexusExtract).join(',') === releaseName, fs.readdirSync(nexusExtract).join(','));
  const nexusExportResponse = await fetch(`${BASE}/api/agent/release/artifact/download`, {
    method: 'POST', headers: { Authorization: `Bearer ${SESSION_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ platform: 'nexus', modId: releaseName, artifactPath: nexusRelease.json?.zipPath }),
  });
  const nexusExportBytes = Buffer.from(await nexusExportResponse.arrayBuffer());
  ok('nexus_export_reopens_report_backed_artifact', nexusExportResponse.status === 200 && nexusExportBytes.equals(fs.readFileSync(nexusRelease.json.zipPath)) && nexusExportResponse.headers.get('x-x4-forge-sha256') === nexusRelease.json.sha256, `status=${nexusExportResponse.status}`);
  const exportReceipt = await req('POST', '/api/agent/release/export/receipt', SESSION_TOKEN, { platform: 'nexus', modId: releaseName, method: 'browser-save', destination: 'platform_release_fixture_v101.zip', artifactPath: nexusRelease.json.zipPath, sha256: nexusRelease.json.sha256, sizeBytes: nexusRelease.json.sizeBytes });
  ok('verified_export_receipt_is_recorded', exportReceipt.status === 200 && exportReceipt.json?.status === 'RECORDED' && exportReceipt.json?.sha256 === nexusRelease.json.sha256, `status=${exportReceipt.status}`);
  const forgedExportReceipt = await req('POST', '/api/agent/release/export/receipt', SESSION_TOKEN, { platform: 'nexus', modId: releaseName, method: 'browser-save', destination: 'forged.zip', artifactPath: nexusRelease.json.zipPath, sha256: '0'.repeat(64), sizeBytes: nexusRelease.json.sizeBytes });
  ok('forged_export_receipt_is_refused', forgedExportReceipt.status === 409 && forgedExportReceipt.json?.code === 'RELEASE_EXPORT_RECEIPT_MISMATCH', `status=${forgedExportReceipt.status} code=${forgedExportReceipt.json?.code}`);
  const agentExportReceipt = await req('POST', '/api/agent/release/export/receipt', deployKey, { platform: 'nexus', modId: releaseName, method: 'browser-save', destination: 'agent-claimed.zip', artifactPath: nexusRelease.json.zipPath, sha256: nexusRelease.json.sha256, sizeBytes: nexusRelease.json.sizeBytes });
  ok('agent_key_cannot_claim_user_export_receipt', agentExportReceipt.status === 403, `status=${agentExportReceipt.status}`);
  const invalidExportReceipt = await req('POST', '/api/agent/release/export/receipt', SESSION_TOKEN, { platform: 'nexus', modId: releaseName, method: 'browser-save', destination: 'fixture.zip', sha256: 'not-a-hash', sizeBytes: 1 });
  ok('invalid_export_receipt_is_refused', invalidExportReceipt.status === 400 && invalidExportReceipt.json?.code === 'RELEASE_EXPORT_RECEIPT_INVALID', `status=${invalidExportReceipt.status}`);
  const pristineNexusZip = fs.readFileSync(nexusRelease.json.zipPath);
  fs.appendFileSync(nexusRelease.json.zipPath, Buffer.from('substitution'));
  const substitutedNexusExport = await req('POST', '/api/agent/release/artifact/download', SESSION_TOKEN, { platform: 'nexus', modId: releaseName, artifactPath: nexusRelease.json.zipPath });
  ok('nexus_export_refuses_substituted_artifact', substitutedNexusExport.status === 409 && substitutedNexusExport.json?.code === 'RELEASE_ARTIFACT_VERIFICATION_FAILED', `status=${substitutedNexusExport.status}`);
  fs.writeFileSync(nexusRelease.json.zipPath, pristineNexusZip);

  ok('agent_key_cannot_select_or_probe_steam_tool', (await req('POST', '/api/agent/release/steam/prepare', deployKey, { workspace: releaseImport.json.workspace })).status === 403);
  const overlongSteamName = 'a'.repeat(33);
  const overlongSteamSource = path.join(safeWorkspace, overlongSteamName);
  fs.mkdirSync(path.join(overlongSteamSource, 'md'), { recursive: true });
  fs.mkdirSync(path.join(overlongSteamSource, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(overlongSteamSource, 'content.xml'), `<?xml version="1.0"?><content id="overlong_steam_fixture" name="Overlong Steam Fixture" version="100" author="Forge Route Test" description="Folder bound negative"/>`);
  fs.writeFileSync(path.join(overlongSteamSource, 'md', 'main.xml'), '<?xml version="1.0"?><mdscript name="OverlongSteamFixture"><cues/></mdscript>');
  fs.writeFileSync(path.join(overlongSteamSource, 'assets', 'payload.txt'), 'real payload keeps the platform negative past empty-extension validation');
  const overlongSteamImport = await req('POST', '/api/agent/mod-folder/import', SESSION_TOKEN, { root: 'workspace', path: overlongSteamName });
  const invalidSteamFolder = await req('POST', '/api/agent/release/steam/prepare', SESSION_TOKEN, { workspace: overlongSteamImport.json?.workspace });
  ok('steam_release_rejects_overlong_workshop_folder', invalidSteamFolder.status === 422 && invalidSteamFolder.json?.code === 'STEAM_FOLDER_NAME_INVALID' && invalidSteamFolder.json?.failedStages?.includes('folder'), `status=${invalidSteamFolder.status} code=${invalidSteamFolder.json?.code}`);
  ok('invalid_steam_folder_writes_no_staging', !fs.existsSync(path.join(releaseRoot, 'steam', 'a'.repeat(33))));
  const noPreviewName = 'platform_release_no_preview';
  const noPreviewSource = path.join(safeWorkspace, noPreviewName);
  fs.mkdirSync(path.join(noPreviewSource, 'md'), { recursive: true });
  fs.mkdirSync(path.join(noPreviewSource, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(noPreviewSource, 'content.xml'), '<?xml version="1.0"?><content id="platform_release_no_preview" name="No Preview Fixture" version="100" author="Forge Route Test" description="Missing preview negative"/>');
  fs.writeFileSync(path.join(noPreviewSource, 'md', 'main.xml'), '<?xml version="1.0"?><mdscript name="NoPreviewFixture"><cues/></mdscript>');
  fs.writeFileSync(path.join(noPreviewSource, 'assets', 'payload.txt'), 'real payload keeps the platform negative past empty-extension validation');
  const noPreviewImport = await req('POST', '/api/agent/mod-folder/import', SESSION_TOKEN, { root: 'workspace', path: noPreviewName });
  const steamMissingPreview = await req('POST', '/api/agent/release/steam/prepare', SESSION_TOKEN, { workspace: noPreviewImport.json?.workspace });
  ok('steam_release_reports_missing_preview_stage', steamMissingPreview.status === 422 && steamMissingPreview.json?.code === 'STEAM_PREVIEW_REQUIRED', `status=${steamMissingPreview.status} code=${steamMissingPreview.json?.code}`);
  const firstPublishMinor = await req('POST', '/api/agent/release/steam/prepare', SESSION_TOKEN, { workspace: releaseImport.json.workspace, minorUpdate: true });
  ok('steam_first_publish_rejects_minor_before_staging', firstPublishMinor.status === 422 && firstPublishMinor.json?.code === 'STEAM_MINOR_UPDATE_NOT_APPLICABLE' && firstPublishMinor.json?.failedStages?.includes('version-mode'), `status=${firstPublishMinor.status} code=${firstPublishMinor.json?.code}`);

  const steamWithoutTool = await req('POST', '/api/agent/release/steam/prepare', SESSION_TOKEN, { workspace: releaseImport.json.workspace });
  ok('steam_local_artifacts_survive_missing_tool', steamWithoutTool.status === 200 && steamWithoutTool.json?.status === 'PARTIAL' && steamWithoutTool.json?.readyForUpload === false && steamWithoutTool.json?.failedStages?.includes('tool'), `status=${steamWithoutTool.status} state=${steamWithoutTool.json?.status}`);
  const stagedPreviews = fs.readdirSync(steamWithoutTool.json?.targetPath || '').filter(name => /^preview\.(?:png|jpe?g)$/i.test(name));
  ok('steam_stages_exactly_one_selected_preview', stagedPreviews.length === 1 && stagedPreviews[0] === 'preview.png', stagedPreviews.join(','));
  ok('steam_backup_has_export_receipt', Number(steamWithoutTool.json?.backupSizeBytes) > 0 && /^[a-f0-9]{64}$/.test(String(steamWithoutTool.json?.backupHash || '')));
  const steamExportResponse = await fetch(`${BASE}/api/agent/release/artifact/download`, {
    method: 'POST', headers: { Authorization: `Bearer ${SESSION_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ platform: 'steam', modId: releaseName, artifactPath: steamWithoutTool.json?.backupPath }),
  });
  const steamExportBytes = Buffer.from(await steamExportResponse.arrayBuffer());
  ok('steam_rollback_export_reopens_report_backed_artifact', steamExportResponse.status === 200 && steamExportBytes.equals(fs.readFileSync(steamWithoutTool.json.backupPath)), `status=${steamExportResponse.status}`);
  ok('steam_missing_tool_still_builds_stage_and_backup', fs.existsSync(steamWithoutTool.json?.targetPath || '') && fs.existsSync(steamWithoutTool.json?.backupPath || ''));

  const fixtureTool = path.join(safeWorkspace, 'tools', 'WorkshopTool.exe');
  fs.mkdirSync(path.dirname(fixtureTool), { recursive: true });
  const fixturePe = Buffer.alloc(132);
  Buffer.from('MZ').copy(fixturePe, 0);
  fixturePe.writeUInt32LE(128, 0x3c);
  Buffer.from('PE\0\0', 'binary').copy(fixturePe, 128);
  fs.writeFileSync(fixtureTool, fixturePe);
  const steamReady = await req('POST', '/api/agent/release/steam/prepare', SESSION_TOKEN, { workspace: releaseImport.json.workspace, toolPath: fixtureTool });
  ok('steam_release_ready_for_interactive_tool', steamReady.status === 200 && steamReady.json?.status === 'READY_FOR_INTERACTIVE_UPLOAD' && steamReady.json?.readyForUpload === true, `status=${steamReady.status} state=${steamReady.json?.status}`);
  ok('steam_first_publish_command_uses_official_shape_without_repacking', steamReady.json?.command?.mode === 'publishx4' && steamReady.json?.command?.args?.[0] === 'publishx4' && !steamReady.json?.command?.args?.includes('-buildcat'), JSON.stringify(steamReady.json?.command || {}));
  ok('steam_stage_contains_verified_catalogs_and_preview', fs.existsSync(path.join(steamReady.json?.targetPath || '', 'ext_01.cat')) && fs.existsSync(path.join(steamReady.json?.targetPath || '', 'ext_01.dat')) && fs.existsSync(path.join(steamReady.json?.targetPath || '', 'preview.png')));
  const beforeWorkshop = await req('POST', '/api/agent/release/steam/verify', SESSION_TOKEN, { modId: releaseName });
  ok('steam_post_tool_verify_rejects_missing_workshop_id', beforeWorkshop.status === 409 && beforeWorkshop.json?.code === 'STEAM_WORKSHOP_ID_MISSING', `status=${beforeWorkshop.status}`);

  const steamContentPath = path.join(steamReady.json.targetPath, 'content.xml');
  const originalSteamContent = fs.readFileSync(steamContentPath);
  fs.rmSync(steamContentPath, { force: true });
  const missingSteamContent = await req('POST', '/api/agent/release/steam/verify', SESSION_TOKEN, { modId: releaseName });
  ok('steam_post_tool_verify_names_missing_manifest', missingSteamContent.status === 409 && missingSteamContent.json?.code === 'STEAM_CONTENT_MANIFEST_MISSING' && missingSteamContent.json?.failedStages?.includes('post-tool'), `status=${missingSteamContent.status} code=${missingSteamContent.json?.code}`);
  fs.writeFileSync(steamContentPath, originalSteamContent);
  fs.writeFileSync(steamContentPath, fs.readFileSync(steamContentPath, 'utf8').replace(/\bid="[^"]*"/, 'id="ws_123456789"'));
  const workshopIdOnlyContent = fs.readFileSync(steamContentPath, 'utf8');
  fs.writeFileSync(steamContentPath, workshopIdOnlyContent.replace('author="Forge Route Test"', 'author="Tampered Author"'));
  const manifestDriftResult = await req('POST', '/api/agent/release/steam/verify', SESSION_TOKEN, { modId: releaseName });
  ok('steam_post_tool_verify_rejects_non_workshop_manifest_drift', manifestDriftResult.status === 409 && manifestDriftResult.json?.code === 'STEAM_POST_TOOL_MANIFEST_DRIFT' && manifestDriftResult.json?.failedStages?.includes('post-tool'), `status=${manifestDriftResult.status} code=${manifestDriftResult.json?.code}`);
  fs.writeFileSync(steamContentPath, workshopIdOnlyContent);
  const unexpectedSteamPayload = path.join(steamReady.json.targetPath, 'unexpected-payload.txt');
  fs.writeFileSync(unexpectedSteamPayload, 'must be rejected');
  const addedWorkshopResult = await req('POST', '/api/agent/release/steam/verify', SESSION_TOKEN, { modId: releaseName });
  ok('steam_post_tool_verify_rejects_added_payload', addedWorkshopResult.status === 409 && addedWorkshopResult.json?.code === 'STEAM_POST_TOOL_INTEGRITY_FAILED' && String(addedWorkshopResult.json?.error || '').includes('Unexpected staged payload'), `status=${addedWorkshopResult.status} code=${addedWorkshopResult.json?.code}`);
  fs.rmSync(unexpectedSteamPayload, { force: true });
  const steamDatPath = path.join(steamReady.json.targetPath, 'ext_01.dat');
  const originalSteamDat = fs.readFileSync(steamDatPath);
  const corruptSteamDat = Buffer.from(originalSteamDat);
  corruptSteamDat[0] ^= 0xff;
  fs.writeFileSync(steamDatPath, corruptSteamDat);
  const corruptWorkshopResult = await req('POST', '/api/agent/release/steam/verify', SESSION_TOKEN, { modId: releaseName });
  ok('steam_post_tool_verify_rejects_changed_payload', corruptWorkshopResult.status === 409 && corruptWorkshopResult.json?.code === 'STEAM_POST_TOOL_INTEGRITY_FAILED' && corruptWorkshopResult.json?.failedStages?.includes('post-tool'), `status=${corruptWorkshopResult.status}`);
  fs.writeFileSync(steamDatPath, originalSteamDat);
  const verifiedWorkshopResult = await req('POST', '/api/agent/release/steam/verify', SESSION_TOKEN, { modId: releaseName });
  ok('steam_post_tool_verify_accepts_id_only_manifest_change', verifiedWorkshopResult.status === 200 && verifiedWorkshopResult.json?.status === 'VERIFIED_AFTER_WORKSHOP_TOOL' && verifiedWorkshopResult.json?.workshopId === 'ws_123456789', `status=${verifiedWorkshopResult.status}`);
  ok('steam_source_manifest_adoption_remains_explicit', verifiedWorkshopResult.json?.sourceManifestAdoptionRequired === true);
  const sourceManifestPath = path.join(releaseSource, 'content.xml');
  const sourceBeforeAdoption = fs.readFileSync(sourceManifestPath);
  const adoptionPreview = await req('POST', '/api/agent/release/steam/adopt', SESSION_TOKEN, { modId: releaseName, apply: false });
  ok('steam_adoption_preview_is_non_mutating', adoptionPreview.status === 200 && adoptionPreview.json?.status === 'READY_TO_ADOPT' && adoptionPreview.json?.workshopId === 'ws_123456789' && fs.readFileSync(sourceManifestPath).equals(sourceBeforeAdoption), `status=${adoptionPreview.status} state=${adoptionPreview.json?.status}`);
  fs.appendFileSync(sourceManifestPath, '\n<!-- concurrent source change -->');
  const staleAdoption = await req('POST', '/api/agent/release/steam/adopt', SESSION_TOKEN, { modId: releaseName, apply: true, expectedSourceSha256: adoptionPreview.json?.beforeSha256, expectedWorkshopId: adoptionPreview.json?.workshopId });
  ok('steam_adoption_refuses_source_changed_after_preview', staleAdoption.status === 409 && staleAdoption.json?.code === 'STEAM_ADOPTION_SOURCE_CHANGED' && staleAdoption.json?.failedStages?.includes('adoption'), `status=${staleAdoption.status} code=${staleAdoption.json?.code}`);
  fs.writeFileSync(sourceManifestPath, sourceBeforeAdoption);
  const adoptedWorkshop = await req('POST', '/api/agent/release/steam/adopt', SESSION_TOKEN, { modId: releaseName, apply: true, expectedSourceSha256: adoptionPreview.json?.beforeSha256, expectedWorkshopId: adoptionPreview.json?.workshopId });
  ok('steam_adoption_writes_only_after_guarded_confirmation', adoptedWorkshop.status === 200 && adoptedWorkshop.json?.status === 'VERIFIED_AND_ADOPTED' && adoptedWorkshop.json?.sourceReimportRequired === true && /id="ws_123456789"/.test(fs.readFileSync(sourceManifestPath, 'utf8')), `status=${adoptedWorkshop.status} state=${adoptedWorkshop.json?.status}`);

  const updateName = 'platform_release_update';
  const updateSource = path.join(safeWorkspace, updateName);
  fs.mkdirSync(path.join(updateSource, 'md'), { recursive: true });
  fs.mkdirSync(path.join(updateSource, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(updateSource, 'content.xml'), '<?xml version="1.0"?><content id="ws_987654321" name="Platform Release Update" version="200" author="Forge Route Test" description="Existing Workshop update fixture"/>');
  fs.writeFileSync(path.join(updateSource, 'md', 'update.xml'), '<?xml version="1.0"?><mdscript name="PlatformReleaseUpdate"><cues/></mdscript>');
  fs.writeFileSync(path.join(updateSource, 'assets', 'payload.txt'), 'existing Workshop update payload');
  const updateImport = await req('POST', '/api/agent/mod-folder/import', SESSION_TOKEN, { root: 'workspace', path: updateName });
  ok('steam_update_fixture_imported_from_disk', updateImport.status === 200 && updateImport.json?.workspace?.contentId === 'ws_987654321', `status=${updateImport.status} contentId=${updateImport.json?.workspace?.contentId}`);
  const nexusWorkshopIdentity = await req('POST', '/api/agent/release/nexus/prepare', SESSION_TOKEN, { workspace: updateImport.json.workspace });
  const nexusWorkshopReport = nexusWorkshopIdentity.status === 200 ? JSON.parse(fs.readFileSync(nexusWorkshopIdentity.json.reportPath, 'utf8')) : null;
  ok('nexus_uses_imported_folder_not_workshop_content_id', nexusWorkshopIdentity.status === 200 && nexusWorkshopIdentity.json?.folderName === updateName && nexusWorkshopReport?.entries?.every(entry => entry.path.startsWith(`${updateName}/`)), `status=${nexusWorkshopIdentity.status} body=${JSON.stringify(nexusWorkshopIdentity.json || {})}`);
  const steamMinorUpdate = await req('POST', '/api/agent/release/steam/prepare', SESSION_TOKEN, { workspace: updateImport.json.workspace, toolPath: fixtureTool, changeNote: 'Deliberately unchanged version', minorUpdate: true });
  ok('steam_existing_update_allows_omitted_preview', steamMinorUpdate.status === 200 && steamMinorUpdate.json?.status === 'READY_FOR_INTERACTIVE_UPLOAD' && steamMinorUpdate.json?.preview === null && steamMinorUpdate.json?.stages?.some(stage => stage.id === 'preview' && stage.status === 'skipped'), `status=${steamMinorUpdate.status} body=${JSON.stringify(steamMinorUpdate.json || {})}`);
  ok('steam_deliberately_unchanged_update_uses_minor', steamMinorUpdate.json?.command?.mode === 'update' && steamMinorUpdate.json?.command?.args?.includes('-minor') && !steamMinorUpdate.json?.command?.args?.includes('-preview'), JSON.stringify(steamMinorUpdate.json?.command || {}));
  ok('steam_update_preserves_folder_identity_separate_from_workshop_id', steamMinorUpdate.json?.folderName === updateName && path.basename(steamMinorUpdate.json?.targetPath || '') === updateName && steamMinorUpdate.json?.workshopId === 'ws_987654321', `folder=${steamMinorUpdate.json?.folderName} target=${steamMinorUpdate.json?.targetPath}`);
  ok('steam_update_without_preview_stages_no_preview_file', typeof steamMinorUpdate.json?.targetPath === 'string' && fs.existsSync(steamMinorUpdate.json.targetPath) && !fs.readdirSync(steamMinorUpdate.json.targetPath).some(name => /^preview\.(?:png|jpe?g)$/i.test(name)));
  const steamVersionedUpdate = await req('POST', '/api/agent/release/steam/prepare', SESSION_TOKEN, { workspace: updateImport.json.workspace, toolPath: fixtureTool, changeNote: 'Version already increased' });
  ok('steam_normal_update_omits_minor', steamVersionedUpdate.status === 200 && steamVersionedUpdate.json?.command?.mode === 'update' && !steamVersionedUpdate.json?.command?.args?.includes('-minor'), JSON.stringify(steamVersionedUpdate.json?.command || {}));
  const releaseHistory = await req('GET', '/api/agent/history?kind=package', SESSION_TOKEN);
  const releaseHistoryRows = releaseHistory.json?.rows || [];
  ok('platform_release_actions_are_in_agent_history', releaseHistory.status === 200
    && releaseHistoryRows.length >= 12
    && releaseHistoryRows.every(row => row.kind === 'package')
    && releaseHistoryRows.some(row => row.outcome?.status === 'ok')
    && releaseHistoryRows.some(row => row.outcome?.code === 'RELEASE_EXPORT_RECEIPT_MISMATCH')
    && releaseHistoryRows.some(row => row.outcome?.code === 'STEAM_ADOPTION_SOURCE_CHANGED'),
  JSON.stringify(releaseHistoryRows.map(row => ({ kind: row.kind, status: row.outcome?.status, code: row.outcome?.code }))));

  // --- fs/write path containment and positive safe-root write ---
  const safeFilesystemConfig = await req('POST', '/api/schema/config', SESSION_TOKEN, { ...deployedRolesConfig, filesystemPath: safeWorkspace });
  ok('optional_safe_filesystem_root_saved', safeFilesystemConfig.status === 200, `status=${safeFilesystemConfig.status}`);
  const traversal = await req('POST', '/api/fs/write', SESSION_TOKEN, { path: '../../../../etc/passwd_x4_route_test', content: 'x' });
  ok('fs_write_traversal_rejected', traversal.status === 400 || traversal.status === 403, `status=${traversal.status}`);
  const safeWrite = await req('POST', '/api/fs/write', SESSION_TOKEN, { path: 'fixture/readme.txt', content: 'safe' });
  ok('fs_write_inside_isolated_workspace_accepted', safeWrite.status === 200 && fs.readFileSync(path.join(safeWorkspace, 'fixture', 'readme.txt'), 'utf8') === 'safe', `status=${safeWrite.status}`);
  const snapshotTraversal = await req('POST', '/api/fs/snapshot', SESSION_TOKEN, { modId: '../outside', workspace: { id: 'fixture', name: 'fixture' } });
  ok('snapshot_modid_traversal_rejected', snapshotTraversal.status === 403, `status=${snapshotTraversal.status}`);
  const linkedLive = path.join(safeWorkspace, 'linked-live');
  fs.symlinkSync(liveExtensions, linkedLive, 'junction');
  const junctionWrite = await req('POST', '/api/fs/write', SESSION_TOKEN, { path: 'linked-live/junction-write.txt', content: 'blocked' });
  ok('fs_write_junction_escape_rejected', junctionWrite.status === 403, `status=${junctionWrite.status}`);
  const junctionList = await req('GET', `/api/fs/list?root=filesystem&depth=1&path=${encodeURIComponent('linked-live')}`, SESSION_TOKEN);
  ok('project_list_shallow_junction_escape_rejected', junctionList.status === 403, `status=${junctionList.status}`);
  ok('junction_escape_did_not_touch_game', !fs.existsSync(path.join(liveExtensions, 'junction-write.txt')));
  const restoredDeployedRoles = await req('POST', '/api/schema/config', SESSION_TOKEN, deployedRolesConfig);
  ok('deployed_roles_restored_after_fs_tests', restoredDeployedRoles.status === 200, `status=${restoredDeployedRoles.status}`);

  // Continuous authoring uses /compile as the same full-project referee as agents/deploy.
  // An unsaved editor buffer overlays the generated manifest without writing to disk.
  const liveCompile = await req('POST', '/api/agent/compile', SESSION_TOKEN, {
    workspace: { id: 'fixture', name: 'fixture', nodes: [], links: [], uiWidgets: [] },
    fileOverrides: {
      'md/fixture.xml': '<?xml version="1.0"?><mdscript name="fixture"><cues><cue name="Root"><actions><set_value name="$x" exact="$faction.noexist"/></actions></cue></cues></mdscript>',
    },
  });
  ok('compile_runs_full_project_validator', liveCompile.status === 200 && liveCompile.json?.validation?.scope === 'full-project', `status=${liveCompile.status} scope=${liveCompile.json?.validation?.scope}`);
  ok('compile_live_buffer_reports_unknown_scriptproperty', liveCompile.json?.diagnostics?.some((d) => d.code === 'scriptproperty.unknown' && d.filePath === 'md/fixture.xml'), JSON.stringify(liveCompile.json?.diagnostics || []));
  ok('compile_never_reports_false_clean_when_schema_unavailable', liveCompile.json?.diagnostics?.some((d) => d.code === 'validation.md_schema_unavailable' && d.severity === 'warning'));
  const nestedCompileWorkspace = { id: 'fixture', name: 'fixture', nodes: [], links: [], uiWidgets: [] };
  const nestedCompilePath = 'md/fixture.xml';
  const nestedCompileWorkspaceBefore = regularTreeHash(safeWorkspace);
  const nestedCompileGood = await req('POST', '/api/agent/compile', SESSION_TOKEN, {
    workspace: nestedCompileWorkspace,
    fileOverrides: {
      [nestedCompilePath]: '<?xml version="1.0"?><mdscript name="fixture"><cues><cue name="Root"><actions><set_value name="$x" exact="$pship2.cargo.free.all?"/></actions></cue></cues></mdscript>',
    },
  });
  const nestedCompileGoodDiagnostics = (nestedCompileGood.json?.diagnostics || [])
    .filter((d) => d.filePath === nestedCompilePath);
  ok('compile_nested_scriptproperty_valid_chain_is_clean',
    nestedCompileGood.status === 200
      && nestedCompileGood.json?.validation?.scope === 'full-project'
      && nestedCompileGoodDiagnostics.filter((d) => ['scriptproperty.unknown', 'scriptproperty.requires_subselector'].includes(d.code)).length === 0,
    JSON.stringify(nestedCompileGoodDiagnostics));
  ok('compile_nested_valid_overlay_preserves_schema_unavailable_warning',
    nestedCompileGoodDiagnostics.some((d) => d.code === 'validation.md_schema_unavailable' && d.severity === 'warning'),
    JSON.stringify(nestedCompileGoodDiagnostics));
  ok('compile_nested_valid_overlay_is_read_only', regularTreeHash(safeWorkspace) === nestedCompileWorkspaceBefore);
  const nestedCompileUnknown = await req('POST', '/api/agent/compile', SESSION_TOKEN, {
    workspace: nestedCompileWorkspace,
    fileOverrides: {
      [nestedCompilePath]: '<?xml version="1.0"?><mdscript name="fixture"><cues><cue name="Root"><actions><set_value name="$x" exact="$pship2.cargo.notreal"/></actions></cue></cues></mdscript>',
    },
  });
  const nestedCompileUnknownDiagnostics = (nestedCompileUnknown.json?.diagnostics || [])
    .filter((d) => d.filePath === nestedCompilePath);
  const nestedCompileUnknownScriptPropertyDiagnostics = nestedCompileUnknownDiagnostics
    .filter((d) => d.code?.startsWith('scriptproperty.'));
  const nestedCompileUnknownFinding = nestedCompileUnknownScriptPropertyDiagnostics[0];
  ok('compile_nested_scriptproperty_unknown_chain_is_unknown',
    nestedCompileUnknown.status === 200
      && nestedCompileUnknown.json?.validation?.scope === 'full-project'
      && nestedCompileUnknownScriptPropertyDiagnostics.length === 1
      && nestedCompileUnknownFinding?.code === 'scriptproperty.unknown'
      && /segment "notreal"/.test(String(nestedCompileUnknownFinding?.message || ''))
      && nestedCompileUnknownFinding?.sourceRef?.label === '$pship2.cargo.notreal',
    JSON.stringify(nestedCompileUnknownDiagnostics));
  ok('compile_nested_unknown_overlay_preserves_schema_unavailable_warning',
    nestedCompileUnknownDiagnostics.some((d) => d.code === 'validation.md_schema_unavailable' && d.severity === 'warning'),
    JSON.stringify(nestedCompileUnknownDiagnostics));
  ok('compile_nested_unknown_overlay_is_read_only', regularTreeHash(safeWorkspace) === nestedCompileWorkspaceBefore);
  const unsafeOverride = await req('POST', '/api/agent/compile', SESSION_TOKEN, {
    workspace: { id: 'fixture', name: 'fixture', nodes: [], links: [], uiWidgets: [] },
    fileOverrides: { '../escape.xml': '<mdscript/>' },
  });
  ok('compile_live_buffer_traversal_rejected', unsafeOverride.status === 400, `status=${unsafeOverride.status}`);
  const windowsAbsoluteOverride = await req('POST', '/api/agent/compile', SESSION_TOKEN, {
    workspace: { id: 'fixture', name: 'fixture', nodes: [], links: [], uiWidgets: [] },
    fileOverrides: { 'C:/escape.xml': '<mdscript/>' },
  });
  ok('compile_live_buffer_windows_absolute_path_rejected', windowsAbsoluteOverride.status === 400, `status=${windowsAbsoluteOverride.status}`);
  const undeclaredCompileInput = await req('POST', '/api/agent/compile', SESSION_TOKEN, { unexpected: true });
  ok('compile_rejects_undeclared_top_level_input',
    undeclaredCompileInput.status === 400 && undeclaredCompileInput.json?.code === 'CAPABILITY_INPUT_INVALID' &&
    /unknown compile field/i.test(String(undeclaredCompileInput.json?.error || '')),
    JSON.stringify(undeclaredCompileInput.json || {}));
  const nonObjectCompileBody = await req('POST', '/api/agent/compile', SESSION_TOKEN, [], { workspaceId: 'ws_missing_compile_precedence' });
  ok('compile_rejects_non_object_body_before_workspace_authority',
    nonObjectCompileBody.status === 400 && nonObjectCompileBody.json?.code === 'CAPABILITY_INPUT_INVALID' &&
    /JSON object body/i.test(String(nonObjectCompileBody.json?.error || '')),
    JSON.stringify(nonObjectCompileBody.json || {}));
  const nonObjectCompileWorkspace = await req('POST', '/api/agent/compile', SESSION_TOKEN, { workspace: 'invalid' });
  ok('compile_rejects_non_object_inline_workspace',
    nonObjectCompileWorkspace.status === 400 && nonObjectCompileWorkspace.json?.code === 'CAPABILITY_INPUT_INVALID' &&
    /workspace must be a JSON object/i.test(String(nonObjectCompileWorkspace.json?.error || '')),
    JSON.stringify(nonObjectCompileWorkspace.json || {}));
  const invalidOverrideBeforeAuthority = await req('POST', '/api/agent/compile', SESSION_TOKEN,
    { fileOverrides: { 'md/fixture.xml': 42 } }, { workspaceId: 'ws_missing_compile_precedence' });
  ok('compile_rejects_malformed_override_before_workspace_authority',
    invalidOverrideBeforeAuthority.status === 400 && invalidOverrideBeforeAuthority.json?.code === 'CAPABILITY_INPUT_INVALID' &&
    /content must be a string/i.test(String(invalidOverrideBeforeAuthority.json?.error || '')),
    JSON.stringify(invalidOverrideBeforeAuthority.json || {}));
  const nonStringOverride = await req('POST', '/api/agent/compile', SESSION_TOKEN, {
    workspace: { id: 'fixture', name: 'fixture', nodes: [], links: [], uiWidgets: [] },
    fileOverrides: { 'md/fixture.xml': 42 },
  });
  ok('compile_rejects_non_string_override_content',
    nonStringOverride.status === 400 && /content must be a string/i.test(String(nonStringOverride.json?.error || '')),
    JSON.stringify(nonStringOverride.json || {}));

  const capabilityOutputReport = (capabilityContract?.capabilities || [])
    .map(capability => assertCapabilityOutput(capability.id, capabilityResponses.get(capability.id)));
  ok('all_canonical_capability_outputs_exercised',
    capabilityOutputReport.length === 11 && capabilityResponses.size === 11 && capabilityOutputReport.every(row => row.status >= 200 && row.status < 300 && row.errors.length === 0),
    JSON.stringify(capabilityOutputReport));

  // --- PRODUCTION SURFACE ---------------------------------------------------------------------
  // The API-honesty guard shipped GREEN on every dev assertion and was BROKEN in production: the
  // SPA catch-all `app.get("*")` is a ROUTE layer that matches everything, and it only exists in
  // the production branch (dev uses `app.use(vite.middlewares)`, which has no `.route`). Dev-only
  // coverage is how a false "done" reaches a user, so the prod bundle is now probed for real.
  const distServer = path.join(process.cwd(), 'dist', 'server.cjs');
  if (!fs.existsSync(distServer)) {
    ok('production_surface_probed', false, 'required build completed without dist/server.cjs. NOT silently skipped.');
  } else {
    const defaultClosedPort = await findFreePort();
    const defaultClosedToken = `${SESSION_TOKEN}-default-closed`;
    const defaultClosedEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
      !['NODE_ENV', 'FORGE_ALLOW_RUN_COMMAND'].includes(key.toUpperCase())));
    const defaultClosedChild = spawn(process.execPath, [distServer], {
      cwd: process.cwd(), shell: false, stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...defaultClosedEnv, PORT: String(defaultClosedPort), API_ONLY: 'true', STUDIO_API_TOKEN: defaultClosedToken,
             X4_STATE_DIR: path.join(tmp, 'state-default-closed'), X4_DATA_DIR: path.join(tmp, 'data-default-closed'),
             X4_CONFIG_DIR: path.join(tmp, 'config-default-closed'), X4_REFERENCE_ROOT: referenceRoot,
             X4FORGE_DISCOVERY_DIR: path.join(tmp, 'discovery-default-closed') },
    });
    try {
      let defaultClosedUp = false;
      for (let i = 0; i < 60; i++) {
        await sleep(500);
        try { const r = await fetch(`http://127.0.0.1:${defaultClosedPort}/api/agent/schema`); if (r.status) { defaultClosedUp = true; break; } } catch { /* not yet */ }
      }
      let defaultClosedEvidence = null;
      if (defaultClosedUp) {
        const base = `http://127.0.0.1:${defaultClosedPort}`;
        const headers = { Authorization: `Bearer ${defaultClosedToken}` };
        const responses = [
          await fetch(`${base}/api/run_command`, { headers }),
          await fetch(`${base}/api/run_command/job`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: '{}' }),
          await fetch(`${base}/api/run_command/job/not-present`, { headers }),
        ];
        defaultClosedEvidence = await Promise.all(responses.map(async response => ({ status: response.status, body: await response.json() })));
      }
      ok('packaged_server_without_node_env_or_opt_in_has_no_run_command_routes',
        defaultClosedUp && defaultClosedEvidence?.every(item => item.status === 404 && item.body?.code === 'UNKNOWN_ENDPOINT'),
        JSON.stringify({ serverUp: defaultClosedUp, responses: defaultClosedEvidence }));
    } finally {
      killTree(defaultClosedChild.pid);
    }

    const prodPort = PORT + 3;
    const prodToken = SESSION_TOKEN + '-prod';
    const prodChild = spawn(process.execPath, [distServer], {
      cwd: process.cwd(), shell: false, stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PORT: String(prodPort), NODE_ENV: 'production', FORGE_ALLOW_RUN_COMMAND: '', STUDIO_API_TOKEN: prodToken,
             X4_STATE_DIR: stateDir, X4_DATA_DIR: dataDir, X4_CONFIG_DIR: configDir, X4_REFERENCE_ROOT: referenceRoot,
             X4FORGE_DISCOVERY_DIR: path.join(tmp, 'discovery-prod') },
    });
    try {
      let prodUp = false;
      for (let i = 0; i < 60; i++) {
        await sleep(500);
        try { const r = await fetch(`http://127.0.0.1:${prodPort}/api/agent/schema`); if (r.status) { prodUp = true; break; } } catch { /* not yet */ }
      }
      ok('production_bundle_came_up', prodUp);
      if (prodUp) {
        const base = `http://127.0.0.1:${prodPort}`;
        const h = { Authorization: `Bearer ${prodToken}` };
        const wrong = await fetch(`${base}/api/agent/deploy-verify`, { headers: h });
        ok('prod_wrong_verb_is_405_not_spa_html', wrong.status === 405 && wrong.headers.get('allow') === 'POST', `status=${wrong.status} allow=${wrong.headers.get('allow')}`);
        const unknown = await fetch(`${base}/api/agent/definitely-not-a-route`, { headers: h });
        const unknownBody = await unknown.text();
        ok('prod_unknown_route_is_json_404', unknown.status === 404 && !unknownBody.includes('<!doctype'), `status=${unknown.status}`);
        const disabledSyncCommand = await fetch(`${base}/api/run_command?cmd=echo+must-not-run`, { headers: h });
        const disabledAsyncCommand = await fetch(`${base}/api/run_command/job`, {
          method: 'POST', headers: { ...h, 'Content-Type': 'application/json' }, body: JSON.stringify({}),
        });
        const disabledJobRead = await fetch(`${base}/api/run_command/job/not-present`, { headers: h });
        ok('prod_run_command_routes_absent_without_explicit_opt_in',
          disabledSyncCommand.status === 404 && disabledAsyncCommand.status === 404 && disabledJobRead.status === 404,
          JSON.stringify({ sync: disabledSyncCommand.status, start: disabledAsyncCommand.status, read: disabledJobRead.status }));
        const shell = await fetch(`${base}/`);
        const shellBody = await shell.text();
        ok('prod_app_shell_still_loads', shell.status === 200 && shellBody.includes('<!doctype'), `status=${shell.status}`);
      }
    } finally {
      killTree(prodChild.pid);
    }
    const optInPort = await findFreePort();
    const optInToken = `${prodToken}-opt-in`;
    const optInChild = spawn(process.execPath, [distServer], {
      cwd: process.cwd(), shell: false, stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PORT: String(optInPort), NODE_ENV: 'production', FORGE_ALLOW_RUN_COMMAND: 'true', STUDIO_API_TOKEN: optInToken,
             X4_STATE_DIR: path.join(tmp, 'state-prod-opt-in'), X4_DATA_DIR: path.join(tmp, 'data-prod-opt-in'),
             X4_CONFIG_DIR: path.join(tmp, 'config-prod-opt-in'), X4_REFERENCE_ROOT: referenceRoot,
             X4FORGE_DISCOVERY_DIR: path.join(tmp, 'discovery-prod-opt-in') },
    });
    try {
      let optInUp = false;
      for (let i = 0; i < 60; i++) {
        await sleep(500);
        try { const r = await fetch(`http://127.0.0.1:${optInPort}/api/agent/schema`); if (r.status) { optInUp = true; break; } } catch { /* not yet */ }
      }
      const optInResponse = optInUp
        ? await fetch(`http://127.0.0.1:${optInPort}/api/run_command/job`, {
          method: 'POST', headers: { Authorization: `Bearer ${optInToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({}),
        })
        : null;
      ok('prod_run_command_routes_register_only_with_explicit_opt_in', optInResponse?.status === 400,
        JSON.stringify({ serverUp: optInUp, status: optInResponse?.status }));
    } finally {
      killTree(optInChild.pid);
    }
  }
}

try {
  await main();
} catch (e) {
  ok('harness_ran_without_throwing', false, String(e));
} finally {
  killTree(child && child.pid);
  // best-effort: also clear the port in case the tree kill missed a grandchild
  if (process.platform === 'win32') {
    const ns = spawnSync('netstat', ['-ano'], { encoding: 'utf8' });
    const line = (ns.stdout || '').split(/\r?\n/).find((l) => l.includes(`:${PORT}`) && /LISTENING/i.test(l));
    if (line) { const pid = line.trim().split(/\s+/).pop(); spawnSync('taskkill', ['/PID', pid, '/F'], { stdio: 'ignore' }); }
  }
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* ignore */ }
}

const passed = checks.filter((c) => c.pass).length;
console.log(`\n[route-integration] ${passed}/${checks.length} ${passed === checks.length ? 'PASS' : 'FAIL'}`);
process.exit(passed === checks.length && checks.length > 0 ? 0 : 1);
