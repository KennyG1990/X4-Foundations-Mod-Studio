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
 *   - a WRITE-scoped key: 200 on a write-scoped prefix, 403 on deploy-only routes + key mgmt
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
const tmp = path.join(os.tmpdir(), `x4-route-int-${process.pid}`);
const stateDir = path.join(tmp, 'state');
const dataDir = path.join(tmp, 'data');
const configDir = path.join(tmp, 'config');
fs.mkdirSync(stateDir, { recursive: true });
fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(configDir, { recursive: true });
const referenceRoot = path.join(tmp, 'reference');
fs.mkdirSync(path.join(referenceRoot, 'libraries'), { recursive: true });
fs.writeFileSync(path.join(referenceRoot, 'libraries', 'factions.xml'), '<factions><faction id="routefixture" name="Route Fixture" tags="economic"/></factions>');
fs.writeFileSync(path.join(referenceRoot, 'libraries', 'wares.xml'), '<wares><ware id="routeware" name="Route Ware" group="test" tags="economy"/></wares>');
fs.writeFileSync(path.join(referenceRoot, 'libraries', 'scriptproperties.xml'), '<scriptproperties><datatype name="faction"><property name="id" result="ID" type="string"/></datatype></scriptproperties>');
const gameRoot = path.join(tmp, 'X4 Foundations');
const liveExtensions = path.join(gameRoot, 'extensions');
const safeWorkspace = path.join(tmp, 'X4ForgeMods');
fs.mkdirSync(liveExtensions, { recursive: true });
fs.mkdirSync(safeWorkspace, { recursive: true });
fs.writeFileSync(path.join(gameRoot, 'X4.exe'), 'fixture');

const checks = [];
const ok = (name, pass, detail) => { checks.push({ name, pass: !!pass, detail }); console.log(`${pass ? '  ok  ' : ' FAIL '}${name}${detail ? `  [${detail}]` : ''}`); };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function killTree(pid) {
  if (!pid) return;
  if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
  else { try { process.kill(-pid, 'SIGKILL'); } catch { try { process.kill(pid, 'SIGKILL'); } catch { /* gone */ } } }
}

async function req(method, urlPath, token, body) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
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

let child;
async function main() {
  const tsxCli = path.join(process.cwd(), 'node_modules', 'tsx', 'dist', 'cli.mjs');
  child = spawn(process.execPath, [tsxCli, 'server.ts'], {
    cwd: process.cwd(),
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: String(PORT), NODE_ENV: 'development', STUDIO_API_TOKEN: SESSION_TOKEN, X4_STATE_DIR: stateDir, X4_DATA_DIR: dataDir, X4_CONFIG_DIR: configDir, X4_REFERENCE_ROOT: referenceRoot, X4FORGE_DISCOVERY_DIR: path.join(tmp, 'discovery'), FORGE_TIMEOUT_DRILL_MS: '300', FORGE_TIMEOUT_DRILL_RESPONSE_MS: '100' },
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
  const workspaceSuccess = await req('GET', '/api/agent/workspace', SESSION_TOKEN);
  ok('session_token_200_workspace', workspaceSuccess.status === 200);
  ok('success_object_shape_is_not_enveloped', !Object.prototype.hasOwnProperty.call(workspaceSuccess.json || {}, 'failedStages') && !Object.prototype.hasOwnProperty.call(workspaceSuccess.json || {}, 'code'), JSON.stringify(workspaceSuccess.json || {}));
  const agentSchema = await req('GET', '/api/agent/schema', null);
  ok('failure_contract_is_discoverable', agentSchema.status === 200 && agentSchema.json?.api_version === '2026-07-30.agent.v4' && Array.isArray(agentSchema.json?.failure_contract?.top_level?.failedStages), JSON.stringify(agentSchema.json?.failure_contract || {}));
  ok('deadline_contract_is_discoverable', agentSchema.json?.request_deadlines?.browser_api_default_ms === 30000 && agentSchema.json?.request_deadlines?.command_job?.maximum_ms === 1800000, JSON.stringify(agentSchema.json?.request_deadlines || {}));

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
  ];
  ok('artifact_selftest_public_and_green', artifactSelftest.status === 200 && artifactSelftest.json?.pass === true, `status=${artifactSelftest.status} summary=${artifactSelftest.json?.summary}`);
  ok('artifact_selftest_proves_locked_root_transaction', requiredArtifactChecks.every(name => artifactChecks.get(name) === true), JSON.stringify(Object.fromEntries(requiredArtifactChecks.map(name => [name, artifactChecks.get(name)]))));

  // --- mint a read + a write agent key with the session token ---
  const mkKey = async (scope) => {
    const r = await req('POST', '/api/agent/keys', SESSION_TOKEN, { label: `route-int-${scope}`, scope, ttl: '1h' });
    return r.json && (r.json.token || r.json.key);
  };
  const readKey = await mkKey('read');
  const writeKey = await mkKey('write');
  const deployKey = await mkKey('deploy');
  ok('minted_read_write_and_deploy_keys', !!readKey && !!writeKey && !!deployKey, `read=${!!readKey} write=${!!writeKey} deploy=${!!deployKey}`);

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
  ok('read_key_403_write_post', (await req('POST', '/api/agent/workspace', readKey, { workspace: {} })).status === 403);
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

  // #4 autoReimport actually unblocks the deploy the guard refused.
  const autoDeploy = await req('POST', '/api/agent/deploy-verify', SESSION_TOKEN, { workspace: staleImport.json?.workspace, autoReimport: true });
  ok('auto_reimport_unblocks_the_deploy', autoDeploy.status === 200 && autoDeploy.json?.ok === true, `status=${autoDeploy.status} stage=${autoDeploy.json?.stage}`);
  ok('auto_reimport_is_reported_not_silent',
    (autoDeploy.json?.checklist || []).some(c => c.id === 'source-sync' && /re-imported/i.test(c.detail || '')),
    JSON.stringify((autoDeploy.json?.checklist || []).find(c => c.id === 'source-sync')));

  // #9 the ledger row for that deploy carries its file effect.
  const histAfterDeploy = await req('GET', '/api/agent/history?kind=deploy', SESSION_TOKEN);
  const deployRow = (histAfterDeploy.json?.rows || [])[0];
  ok('deploy_row_records_file_effect', !!deployRow?.fileEffect, JSON.stringify(deployRow?.fileEffect));

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
    ? spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', 'Expand-Archive -LiteralPath $env:X4FORGE_ZIP -DestinationPath $env:X4FORGE_EXTRACT -Force'], { env: { ...process.env, X4FORGE_ZIP: nexusRelease.json?.zipPath || '', X4FORGE_EXTRACT: nexusExtract }, encoding: 'utf8' })
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

  // --- PRODUCTION SURFACE ---------------------------------------------------------------------
  // The API-honesty guard shipped GREEN on every dev assertion and was BROKEN in production: the
  // SPA catch-all `app.get("*")` is a ROUTE layer that matches everything, and it only exists in
  // the production branch (dev uses `app.use(vite.middlewares)`, which has no `.route`). Dev-only
  // coverage is how a false "done" reaches a user, so the prod bundle is now probed for real.
  const distServer = path.join(process.cwd(), 'dist', 'server.cjs');
  if (!fs.existsSync(distServer)) {
    ok('production_surface_probed', false, 'dist/server.cjs missing — run npm run build. NOT silently skipped.');
  } else {
    const prodPort = PORT + 3;
    const prodToken = SESSION_TOKEN + '-prod';
    const prodChild = spawn(process.execPath, [distServer], {
      cwd: process.cwd(), shell: false, stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PORT: String(prodPort), NODE_ENV: 'production', STUDIO_API_TOKEN: prodToken,
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
        const shell = await fetch(`${base}/`);
        const shellBody = await shell.text();
        ok('prod_app_shell_still_loads', shell.status === 200 && shellBody.includes('<!doctype'), `status=${shell.status}`);
      }
    } finally {
      killTree(prodChild.pid);
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
