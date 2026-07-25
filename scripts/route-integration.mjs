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
import os from 'node:os';
import path from 'node:path';

const PORT = Number(process.env.ROUTE_TEST_PORT || 8971);
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
    env: { ...process.env, PORT: String(PORT), NODE_ENV: 'development', STUDIO_API_TOKEN: SESSION_TOKEN, X4_STATE_DIR: stateDir, X4_DATA_DIR: dataDir, X4_CONFIG_DIR: configDir, X4_REFERENCE_ROOT: referenceRoot },
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
  ok('no_token_401', (await req('GET', '/api/agent/workspace', null)).status === 401);
  ok('bogus_token_401', (await req('GET', '/api/agent/workspace', 'not-a-real-token')).status === 401);
  ok('session_token_200_workspace', (await req('GET', '/api/agent/workspace', SESSION_TOKEN)).status === 200);

  // --- public canonical reference API + raw-file containment ---
  const factions = await req('GET', '/api/reference/factions', null);
  ok('reference_factions_public_and_canonical', factions.status === 200 && factions.json?.[0]?.id === 'routefixture');
  const rawFaction = await req('GET', '/api/reference/file?path=libraries/factions.xml', null);
  ok('reference_file_returns_real_raw_file', rawFaction.status === 200 && rawFaction.raw.includes('routefixture'));
  const referenceTraversal = await req('GET', '/api/reference/file?path=../outside.xml', null);
  ok('reference_file_traversal_rejected', referenceTraversal.status === 403, `status=${referenceTraversal.status}`);

  // --- mint a read + a write agent key with the session token ---
  const mkKey = async (scope) => {
    const r = await req('POST', '/api/agent/keys', SESSION_TOKEN, { label: `route-int-${scope}`, scope, ttl: '1h' });
    return r.json && (r.json.token || r.json.key);
  };
  const readKey = await mkKey('read');
  const writeKey = await mkKey('write');
  ok('minted_read_and_write_keys', !!readKey && !!writeKey, `read=${!!readKey} write=${!!writeKey}`);

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
