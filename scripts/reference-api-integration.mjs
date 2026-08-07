#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function resolveReferenceRoot() {
  const candidates = [];
  if (process.env.X4_REFERENCE_ROOT?.trim()) candidates.push(process.env.X4_REFERENCE_ROOT.trim());
  try {
    const configured = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'config.json'), 'utf8'));
    if (configured.x4ReferenceRoot?.trim()) candidates.push(configured.x4ReferenceRoot.trim());
    if (configured.xsdSchemaPath?.trim() && path.basename(configured.xsdSchemaPath).toLowerCase() === 'libraries') {
      candidates.push(path.dirname(configured.xsdSchemaPath));
    }
  } catch { /* an unconfigured machine fails the corpus assertions honestly */ }
  candidates.push(path.join(process.cwd(), 'data', 'x4-unpacked'));
  return candidates.map(candidate => path.resolve(candidate)).find(candidate => {
    try { return fs.statSync(candidate).isDirectory(); } catch { return false; }
  }) || path.resolve(candidates.at(-1));
}

const root = resolveReferenceRoot();
const port = Number(process.env.REFERENCE_API_TEST_PORT || 8973);
const base = `http://127.0.0.1:${port}`;
const token = `reference-api-integration-${process.pid}`;
const clientId = `client_reference_${process.pid}_${Date.now().toString(36)}`;
let workspaceId = '';
const tmp = path.join(os.tmpdir(), `x4-reference-api-${process.pid}`);
const stateDir = path.join(tmp, 'state');
const dataDir = path.join(tmp, 'data');
const discoveryDir = path.join(tmp, 'discovery');
fs.mkdirSync(stateDir, { recursive: true });
fs.mkdirSync(dataDir, { recursive: true });

const checks = [];
const check = (name, pass, detail = '') => {
  checks.push({ name, pass: !!pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`);
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const cursorDoc = (marked) => {
  const offset = marked.indexOf('|');
  if (offset < 0) throw new Error('cursor fixture missing | marker');
  const content = marked.slice(0, offset) + marked.slice(offset + 1);
  const before = marked.slice(0, offset);
  const rows = before.split('\n');
  return { content, line: rows.length - 1, column: rows.at(-1).length };
};

function killTree(pid) {
  if (!pid) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
    return;
  }
  try { process.kill(-pid, 'SIGKILL'); }
  catch { try { process.kill(pid, 'SIGKILL'); } catch { /* already gone */ } }
}

async function request(urlPath, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  if (options.token === token) headers['x-client-id'] = clientId;
  if (options.token && workspaceId) headers['x-workspace-id'] = workspaceId;
  if (options.operationId !== undefined) headers['x-forge-operation-id'] = options.operationId;
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  return fetch(base + urlPath, {
    method: options.method || 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
}

let server;
let output = '';
try {
  const tsxCli = path.join(process.cwd(), 'node_modules', 'tsx', 'dist', 'cli.mjs');
  server = spawn(process.execPath, [tsxCli, 'server.ts'], {
    cwd: process.cwd(),
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: 'development',
      API_ONLY: 'true',
      DISABLE_HMR: 'true',
      STUDIO_API_TOKEN: token,
      X4_STATE_DIR: stateDir,
      X4_DATA_DIR: dataDir,
      X4FORGE_DISCOVERY_DIR: discoveryDir,
      X4_REFERENCE_ROOT: root,
      X4_XSD_PATH: path.join(root, 'libraries'),
    },
  });
  server.stdout.on('data', (chunk) => { output += chunk; });
  server.stderr.on('data', (chunk) => { output += chunk; });

  let ready = false;
  for (let attempt = 0; attempt < 80; attempt++) {
    await sleep(500);
    try {
      const response = await request('/api/reference/status');
      if (response.ok) { ready = true; break; }
    } catch { /* keep polling */ }
  }
  check('isolated server ready', ready, ready ? '' : output.slice(-500));
  if (!ready) throw new Error('server did not become ready');

  const bootstrapResponse = await request('/api/agent/workspaces/bootstrap', {
    method: 'POST', token, body: { clientId },
  });
  const bootstrap = await bootstrapResponse.json();
  workspaceId = String(bootstrap.workspaceId || '');
  check('isolated workspace authority bootstrapped',
    bootstrapResponse.status === 200 && /^ws_[a-f0-9]{24}$/i.test(workspaceId),
    JSON.stringify({ status: bootstrapResponse.status, workspaceId }));
  if (!workspaceId) throw new Error(`could not bootstrap fixture workspace: ${JSON.stringify(bootstrap)}`);

  const makeKey = async (label, scope) => {
    const response = await request('/api/agent/keys', { method: 'POST', token, body: { label, scope, ttl: '1h' } });
    const body = await response.json();
    if (!response.ok || !body.token) throw new Error(`could not create ${scope} fixture key: ${JSON.stringify(body)}`);
    return body.token;
  };
  const readToken = await makeKey('reference-integration-read', 'read');
  const writeToken = await makeKey('reference-integration-write', 'write');

  const factions = await request('/api/reference/factions').then((response) => response.json());
  const factionMap = new Map(factions.map((faction) => [faction.id, faction]));
  check('exactly 32 factions', factions.length === 32, String(factions.length));
  for (const [id, source] of [
    ['fallensplit', 'ego_dlc_split'],
    ['kaori', 'ego_dlc_timelines'],
    ['holyorderfanatic', 'base'],
    ['loanshark', 'ego_dlc_pirate'],
    ['trinity', 'base'],
  ]) check(`faction provenance ${id}`, factionMap.get(id)?.source === source, String(factionMap.get(id)?.source || 'missing'));
  check('riptide absent', !factionMap.has('riptide'));

  const wares = await request('/api/reference/wares').then((response) => response.json());
  check('wares include metadata', wares.length > 1000 && wares.some((ware) => ware.id && ware.name && ware.group && Array.isArray(ware.tags) && ware.source), String(wares.length));
  const jobs = await request('/api/reference/jobs').then((response) => response.json());
  check('jobs include base+DLC provenance', jobs.length > 1000 && jobs.some((job) => job.id === 'dummy_job' && job.source === 'base') && jobs.some((job) => /^ego_dlc_/.test(job.source)), String(jobs.length));
  const aiScripts = await request('/api/reference/aiscripts').then((response) => response.json());
  check('AI scripts include canonical names', aiScripts.length > 100 && aiScripts.some((script) => script.id === 'boarding.pod'), String(aiScripts.length));
  const wareSuggestionResponse = await request('/api/reference/suggest?kind=ware&q=energyc&intent=reference&limit=10', { token });
  const wareSuggestions = await wareSuggestionResponse.json();
  check('shared suggestion endpoint ranks ware prefix', wareSuggestionResponse.status === 200 && wareSuggestions.items?.[0]?.label === 'energycells', JSON.stringify(wareSuggestions.items?.slice(0, 3) || wareSuggestions));
  const collisionResponse = await request('/api/reference/suggest?kind=ware&q=energycells&intent=new-definition&limit=10', { token });
  const collision = await collisionResponse.json();
  check('new-definition suggestion exposes collision', collisionResponse.status === 200 && collision.items?.[0]?.label === 'energycells' && collision.items[0].exists === true && /already exists/i.test(collision.items[0].documentation || ''), JSON.stringify(collision.items?.[0] || collision));
  check('suggest requires auth', (await request('/api/reference/suggest?kind=ware&q=energyc&limit=10')).status === 401);
  const sectors = await request('/api/reference/sectors').then((response) => response.json());
  check('sectors include macro ids and names', sectors.length > 100 && sectors.every((sector) => sector.id.endsWith('_macro') && sector.name), String(sectors.length));

  const factionProperties = await request('/api/reference/scriptproperties?datatype=faction').then((response) => response.json());
  const factionDatatype = factionProperties.find((entry) => entry.kind === 'datatype' && entry.name === 'faction');
  check('faction scriptproperties expose id', factionDatatype?.properties?.some((property) => property.name === 'id' && property.type === 'string'));
  check('faction scriptproperties expose display names', factionDatatype?.properties?.some((property) => property.name === 'name') && factionDatatype?.properties?.some((property) => property.name === 'knownname'));

  const schemaRegistry = await request('/api/agent/schema-registry?domain=md').then((response) => response.json());
  const mdSchema = schemaRegistry.domains?.find((domain) => domain.domain === 'md');
  check('canonical schema registry discovers libraries grammar', schemaRegistry.domainCount >= 35 && /[\\/]libraries$/i.test(schemaRegistry.roots?.[0] || ''), `domains=${schemaRegistry.domainCount} root=${schemaRegistry.roots?.[0] || ''}`);
  check('common.xsd include graph resolves without gaps', mdSchema?.includes?.some((name) => name.toLowerCase() === 'common.xsd') && mdSchema.missingIncludes?.length === 0 && schemaRegistry.domainIndex?.loaded === true, JSON.stringify(mdSchema));
  const expressionSelftest = await request('/api/agent/expression-suggest-selftest').then((response) => response.json());
  check('production-corpus expression completion oracle', expressionSelftest.allPassed === true, JSON.stringify(expressionSelftest.checks?.filter((item) => !item.pass) || expressionSelftest));

  const complete = async (filePath, marked) => {
    const cursor = cursorDoc(marked);
    const response = await request('/api/reference/complete', { method: 'POST', token, body: { path: filePath, ...cursor } });
    return { response, body: await response.json() };
  };
  const mdHeader = '<mdscript xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="md.xsd" name="B74">';
  const cueCompletion = await complete('md/b74.xml', `${mdHeader}<cues><cue name="Root"><|`);
  const cueLabels = cueCompletion.body.map((item) => item.label);
  check('cue completion is schema-contextual', cueCompletion.response.status === 200 && ['conditions', 'actions', 'cues'].every((label) => cueLabels.includes(label)), cueLabels.slice(0, 20).join(','));
  check('cue completion is not a flat vocabulary', !cueLabels.includes('ware') && !cueLabels.includes('faction'), String(cueLabels.length));
  const readScopedCompletionCursor = cursorDoc(`${mdHeader}<cues><cue name="Root"><|`);
  const readScopedCompletion = await request('/api/reference/complete', { method: 'POST', token: readToken, body: { path: 'md/b74.xml', ...readScopedCompletionCursor } });
  check('read-scoped agent key can use POST completion intelligence', readScopedCompletion.status === 200, `status=${readScopedCompletion.status}`);
  const afterConditions = await complete('md/b74.xml', `${mdHeader}<cues><cue name="Root"><conditions/><|`);
  const afterConditionLabels = afterConditions.body.map((item) => item.label);
  check('cue completion consumes prior sequence state', !afterConditionLabels.includes('conditions') && ['actions', 'delay', 'cues'].every((label) => afterConditionLabels.includes(label)), afterConditionLabels.join(','));
  const afterActions = await complete('md/b74.xml', `${mdHeader}<cues><cue name="Root"><actions/><|`);
  const afterActionLabels = afterActions.body.map((item) => item.label);
  check('cue completion rejects earlier sequence members', !afterActionLabels.includes('conditions') && afterActionLabels.includes('cues'), afterActionLabels.join(','));

  const warmLatencies = [];
  for (let sample = 0; sample < 20; sample++) {
    const started = performance.now();
    const warm = await complete('md/b74.xml', `${mdHeader}<cues><cue name="Root"><|`);
    warmLatencies.push(performance.now() - started);
    if (warm.response.status !== 200) break;
  }
  const sortedWarm = [...warmLatencies].sort((a, b) => a - b);
  const warmP95 = sortedWarm[Math.max(0, Math.ceil(sortedWarm.length * 0.95) - 1)] || Infinity;
  check('warm completion p95 under 50ms', warmLatencies.length === 20 && warmP95 < 50, `${warmP95.toFixed(1)}ms`);

  const factionLookup = await complete('md/b74.xml', `${mdHeader}<cues><cue name="Root"><actions><set_value name="$x" exact="faction.|"/></actions></cue></cues></mdscript>`);
  check('faction lookup completes exactly canonical ids', factionLookup.body.length === 32 && factionLookup.body.some((item) => item.label === 'fallensplit') && !factionLookup.body.some((item) => item.label === 'riptide'), String(factionLookup.body.length));

  const factionProps = await complete('md/b74.xml', `${mdHeader}<cues><cue name="Root"><actions><set_value name="$x" exact="faction.player.|"/></actions></cue></cues></mdscript>`);
  const factionPropMap = new Map(factionProps.body.map((item) => [item.label, item]));
  check('faction datatype completion exposes corpus truth', ['id', 'relationto', 'primaryrace', 'knownname'].every((name) => factionPropMap.has(name)), [...factionPropMap.keys()].slice(0, 30).join(','));
  check('faction.id completion carries return type', /string/i.test(String(factionPropMap.get('id')?.detail || '')), JSON.stringify(factionPropMap.get('id') || null));

  const projectTypedProps = await complete('md/b74.xml', `${mdHeader}<cues><cue name="Root"><actions><find_ship name="$target"/><set_value name="$x" exact="$target.|"/></actions></cue></cues></mdscript>`);
  const projectTypedLabels = projectTypedProps.body.map((item) => item.label);
  check('project symbol drives variable completion', projectTypedLabels.includes('name') && projectTypedLabels.includes('cargo'), projectTypedLabels.slice(0, 40).join(','));

  const factionAttr = await complete('md/b74.xml', `${mdHeader}<cues><cue name="Root"><conditions><event_object_changed_owner owner="|"/></conditions></cue></cues></mdscript>`);
  check('faction-typed attribute completes 32 ids', factionAttr.body.length === 32 && factionAttr.body.some((item) => item.label === 'trinity'), String(factionAttr.body.length));

  const hoverFixture = cursorDoc(`${mdHeader}<cues><cue name="Root"><actions><set_value name="$x" exact="faction.player.i|d"/></actions></cue></cues></mdscript>`);
  const hoverResponse = await request('/api/reference/hover', { method: 'POST', token, body: { path: 'md/b74.xml', ...hoverFixture } });
  const hover = await hoverResponse.json();
  check('expression hover exposes property signature and docs', hoverResponse.status === 200 && hover?.kind === 'property' && /faction\.id/i.test(hover.signature) && hover.documentation, JSON.stringify(hover));

  const variableHoverFixture = cursorDoc(`${mdHeader}<cues><cue name="Root"><actions><find_ship name="$target"/><set_value name="$x" exact="$target.na|me"/></actions></cue></cues></mdscript>`);
  const variableHoverResponse = await request('/api/reference/hover', { method: 'POST', token, body: { path: 'md/b74.xml', ...variableHoverFixture } });
  const variableHover = await variableHoverResponse.json();
  check('project-inferred variable hover exposes typed inherited property', variableHoverResponse.status === 200
    && variableHover?.kind === 'property' && variableHover?.label === 'name' && /name:\s*string/i.test(variableHover.signature)
    && /inherited from component/i.test(variableHover.detail || ''), JSON.stringify(variableHover));

  const factionDiffResponse = await request('/api/reference/simulate-diff', {
    method: 'POST', token,
    body: { path: 'libraries/factions.xml', content: '<diff><add sel="/factions"><faction id="x4forge_probe" name="Probe"/></add></diff>' },
  });
  const factionDiff = await factionDiffResponse.json();
  check('read-only diff API uses effective base plus official DLCs', factionDiffResponse.status === 200 && factionDiff.ok === true
    && factionDiff.base?.sources?.some((source) => source.source === 'base')
    && factionDiff.base?.sources?.some((source) => /^ego_dlc_/.test(source.source))
    && /id="x4forge_probe"/.test(factionDiff.content || ''), JSON.stringify(factionDiff.base || factionDiff));
  const deadDiffResponse = await request('/api/reference/simulate-diff', {
    method: 'POST', token,
    body: { path: 'libraries/factions.xml', content: '<diff><remove sel="/factions/faction[@id=\'definitely_missing\']"/></diff>' },
  });
  const deadDiff = await deadDiffResponse.json();
  check('diff API reports zero-match selector', deadDiffResponse.status === 200 && deadDiff.findings?.some((finding) => finding.code === 'DIFF_SELECTOR_ZERO'), JSON.stringify(deadDiff.findings || deadDiff));
  check('diff API requires authentication', (await request('/api/reference/simulate-diff', { method: 'POST', body: { path: 'libraries/factions.xml', content: '<diff/>' } })).status === 401);
  check('diff API rejects traversal', (await request('/api/reference/simulate-diff', { method: 'POST', token, body: { path: '../outside.xml', content: '<diff/>' } })).status === 403);

  let bulkManifestReady = false;
  let bulkManifestStatus = null;
  // A cold scan covers the complete million-file unpacked corpus. On slower disks that
  // legitimately takes well over the former fixed 60-second window, so readiness is
  // deadline-based and reports the last observed scanner state instead of racing it.
  const bulkManifestDeadline = Date.now() + Number(process.env.X4_FORGE_MANIFEST_WAIT_MS || 360_000);
  while (Date.now() < bulkManifestDeadline) {
    const manifestResponse = await request('/api/reference/manifest?q=assets%2Funits%2Fsize_xl%2Fmacros&extension=xml&limit=1');
    const manifest = await manifestResponse.json().catch(() => ({}));
    bulkManifestStatus = { httpStatus: manifestResponse.status, body: manifest };
    if (manifestResponse.status === 200 && manifest.generation && manifest.total > 0) { bulkManifestReady = true; break; }
    if (manifestResponse.status === 503 && /^(error|unavailable)$/.test(String(manifest.status?.state || ''))) break;
    await sleep(1_000);
  }
  check('canonical manifest ready for bulk path enumeration', bulkManifestReady, bulkManifestReady ? '' : JSON.stringify(bulkManifestStatus));
  const bulkRule = { pathPrefix: 'assets/units/size_xl/macros', selector: '/macros/macro/properties/hull/@max', operation: 'multiply', operand: 1.5, rounding: 'none', maxFiles: 500 };
  const beforeBulk = await request('/api/agent/workspace', { token }).then((response) => response.json());
  const bulkPreviewResponse = await request('/api/agent/bulk-transform/preview', { method: 'POST', token, body: { rule: bulkRule } });
  const bulkPreview = await bulkPreviewResponse.json();
  const afterPreview = await request('/api/agent/workspace', { token }).then((response) => response.json());
  check('bulk preview resolves and simulates real canonical macro matches', bulkPreviewResponse.status === 200 && bulkPreview.ok === true && bulkPreview.rows?.length > 0 && bulkPreview.rows.every((row) => row.simulationOk), JSON.stringify({ status: bulkPreviewResponse.status, matched: bulkPreview.matchedFiles, findings: bulkPreview.findings }));
  check('bulk preview reports every scanned logical file', Array.isArray(bulkPreview.files)
    && bulkPreview.files.length === bulkPreview.candidateCount
    && bulkPreview.files.filter((file) => file.status === 'matched').length === bulkPreview.matchedFiles
    && bulkPreview.files.filter((file) => file.status === 'skipped').length === bulkPreview.skippedFiles,
  JSON.stringify({ candidates: bulkPreview.candidateCount, files: bulkPreview.files?.length, matched: bulkPreview.matchedFiles, skipped: bulkPreview.skippedFiles }));
  check('bulk preview preserves base and official DLC source provenance', bulkPreview.files?.some((file) => file.sources?.some((source) => source.source === 'base'))
    && bulkPreview.files?.some((file) => file.sources?.some((source) => /^ego_dlc_/.test(source.source))),
  JSON.stringify(bulkPreview.files?.filter((file) => file.sources?.some((source) => /^ego_dlc_/.test(source.source))).slice(0, 2) || []));
  check('bulk preview writes nothing', beforeBulk.workspaceHash === afterPreview.workspaceHash && beforeBulk.version === afterPreview.version, `${beforeBulk.workspaceHash} -> ${afterPreview.workspaceHash}`);
  const quantumResponse = await request('/api/agent/bulk-transform/preview', {
    method: 'POST', token: readToken,
    body: { rule: { ...bulkRule, operand: 1.337, rounding: 'ceil', roundingIncrement: 1000 } },
  });
  const quantumPreview = await quantumResponse.json();
  check('bulk rounding quantum supports ceil-to-1000 hull transforms', quantumResponse.status === 200
    && quantumPreview.rows?.length > 0
    && quantumPreview.rows.every((row) => Number(row.newValue) % 1000 === 0),
  JSON.stringify({ status: quantumResponse.status, sample: quantumPreview.rows?.slice(0, 3).map((row) => [row.oldValue, row.newValue]) }));
  const invalidQuantum = await request('/api/agent/bulk-transform/preview', {
    method: 'POST', token: readToken,
    body: { rule: { ...bulkRule, rounding: 'ceil', roundingIncrement: 0 } },
  });
  const afterInvalidQuantum = await request('/api/agent/workspace', { token }).then((response) => response.json());
  check('invalid rounding quantum blocks with zero mutation', invalidQuantum.status === 422 && afterInvalidQuantum.workspaceHash === beforeBulk.workspaceHash, `status=${invalidQuantum.status}`);
  check('bulk preview requires authentication', (await request('/api/agent/bulk-transform/preview', { method: 'POST', body: { rule: bulkRule } })).status === 401);
  const readScopedPreview = await request('/api/agent/bulk-transform/preview', { method: 'POST', token: readToken, body: { rule: bulkRule } });
  check('read-scoped agent key can run no-write bulk preview', readScopedPreview.status === 200, `status=${readScopedPreview.status}`);
  const readScopedApplyOperationId = 'forge_op_reference_bulk_read_scope';
  const stalePlanOperationId = 'forge_op_reference_bulk_stale_plan';
  const stalePlanHash = '0'.repeat(64);
  const readScopedApply = await request('/api/agent/bulk-transform/apply', {
    method: 'POST', token: readToken, operationId: readScopedApplyOperationId,
    body: { rule: bulkRule, expectedPlanHash: bulkPreview.planHash, expectedHead: bulkPreview.workspaceHash, expectedSnapshotHash: bulkPreview.snapshotHash },
  });
  check('read-scoped agent key cannot apply a bulk mutation', readScopedApply.status === 403, `status=${readScopedApply.status}`);
  const stalePlanResponse = await request('/api/agent/bulk-transform/apply', {
    method: 'POST', token, operationId: stalePlanOperationId,
    body: { rule: bulkRule, expectedPlanHash: stalePlanHash, expectedHead: beforeBulk.workspaceHash, expectedSnapshotHash: beforeBulk.snapshotHash },
  });
  const afterStale = await request('/api/agent/workspace', { token }).then((response) => response.json());
  check('stale bulk plan is rejected with zero mutation', stalePlanResponse.status === 409 && afterStale.workspaceHash === beforeBulk.workspaceHash, `status=${stalePlanResponse.status}`);
  const traversalBulk = await request('/api/agent/bulk-transform/preview', { method: 'POST', token, body: { rule: { ...bulkRule, pathPrefix: '../outside' } } });
  check('bulk transform rejects traversal', traversalBulk.status === 400, `status=${traversalBulk.status}`);
  const invalidXPathBulk = await request('/api/agent/bulk-transform/preview', { method: 'POST', token, body: { rule: { ...bulkRule, selector: '//*[' } } });
  const invalidXPathBody = await invalidXPathBulk.json();
  const afterInvalidXPath = await request('/api/agent/workspace', { token }).then((response) => response.json());
  check('bulk transform rejects invalid XPath with zero mutation', invalidXPathBulk.status === 422
    && invalidXPathBody.findings?.some((finding) => finding.code === 'BULK_SELECTOR_INVALID')
    && afterInvalidXPath.workspaceHash === beforeBulk.workspaceHash,
  JSON.stringify({ status: invalidXPathBulk.status, finding: invalidXPathBody.findings?.[0] }));
  const zeroMatchBulk = await request('/api/agent/bulk-transform/preview', { method: 'POST', token, body: { rule: { ...bulkRule, selector: '/macros/macro/properties/definitely_missing/@max' } } });
  const zeroMatchBody = await zeroMatchBulk.json();
  const afterZeroMatch = await request('/api/agent/workspace', { token }).then((response) => response.json());
  check('bulk transform rejects an all-file zero match with per-file skips and zero mutation', zeroMatchBulk.status === 422
    && zeroMatchBody.findings?.some((finding) => finding.code === 'BULK_NO_MATCHES')
    && zeroMatchBody.files?.length === zeroMatchBody.candidateCount
    && zeroMatchBody.files?.every((file) => file.status === 'skipped')
    && afterZeroMatch.workspaceHash === beforeBulk.workspaceHash,
  JSON.stringify({ status: zeroMatchBulk.status, candidates: zeroMatchBody.candidateCount, files: zeroMatchBody.files?.length }));
  const cappedBulk = await request('/api/agent/bulk-transform/preview', { method: 'POST', token, body: { rule: { ...bulkRule, maxFiles: 1 } } });
  const cappedBody = await cappedBulk.json();
  const afterCap = await request('/api/agent/workspace', { token }).then((response) => response.json());
  check('bulk cap breach blocks all output and mutation', cappedBulk.status === 422 && cappedBody.droppedCount > 0 && cappedBody.rows?.length === 0 && afterCap.workspaceHash === beforeBulk.workspaceHash, JSON.stringify({ status: cappedBulk.status, dropped: cappedBody.droppedCount, rows: cappedBody.rows?.length }));
  if (bulkPreview.ok) {
    const changedApplyOperationId = 'forge_op_reference_bulk_changed';
    const noChangeApplyOperationId = 'forge_op_reference_bulk_no_change';
    const changedApplyBody = {
      rule: bulkRule,
      expectedPlanHash: bulkPreview.planHash,
      expectedHead: bulkPreview.workspaceHash,
      expectedSnapshotHash: bulkPreview.snapshotHash,
    };
    const applyResponse = await request('/api/agent/bulk-transform/apply', {
      method: 'POST', token: writeToken, operationId: changedApplyOperationId, body: changedApplyBody,
    });
    const applied = await applyResponse.json();
    const afterChangedApply = await request('/api/agent/workspace', { token }).then((response) => response.json());
    check('bulk apply atomically updates workspace patch state', applyResponse.status === 200 && applied.applied === true && applied.workspace?.xmlPatches?.length === bulkPreview.matchedFiles, JSON.stringify({ status: applyResponse.status, patches: applied.workspace?.xmlPatches?.length, expected: bulkPreview.matchedFiles }));
    check('changed bulk apply commits receipt projection and returns current hashes', applyResponse.status === 200
      && applied.success === true
      && applied.status === 'SUCCESS'
      && applied.applied === true
      && applied.replayed === false
      && Object.keys(applied.receipt || {}).sort().join(',') === 'hash,id,status'
      && applied.receipt?.status === 'committed'
      && applied.workspaceHash === afterChangedApply.workspaceHash
      && applied.snapshotHash === afterChangedApply.snapshotHash
      && afterChangedApply.workspaceHash !== beforeBulk.workspaceHash,
    JSON.stringify({ status: applyResponse.status, receipt: applied.receipt, workspaceHash: applied.workspaceHash, snapshotHash: applied.snapshotHash }));

    const beforeChangedReplay = await request('/api/agent/workspace', { token }).then((response) => response.json());
    const exactReplayResponse = await request('/api/agent/bulk-transform/apply', {
      method: 'POST', token: writeToken, operationId: changedApplyOperationId, body: changedApplyBody,
    });
    const exactReplay = await exactReplayResponse.json();
    const afterChangedReplay = await request('/api/agent/workspace', { token }).then((response) => response.json());
    check('changed bulk apply exact replay is replayed and nonmutating', exactReplayResponse.status === 200
      && exactReplay.success === true
      && exactReplay.replayed === true
      && exactReplay.applied === false
      && Object.keys(exactReplay.receipt || {}).sort().join(',') === 'hash,id,status'
      && exactReplay.receipt?.status === 'committed'
      && exactReplay.receipt?.id === applied.receipt?.id
      && exactReplay.receipt?.hash === applied.receipt?.hash
      && exactReplay.workspaceHash === beforeChangedReplay.workspaceHash
      && exactReplay.snapshotHash === beforeChangedReplay.snapshotHash
      && afterChangedReplay.workspaceHash === beforeChangedReplay.workspaceHash
      && afterChangedReplay.snapshotHash === beforeChangedReplay.snapshotHash
      && afterChangedReplay.version === beforeChangedReplay.version,
    JSON.stringify({ status: exactReplayResponse.status, replayed: exactReplay.replayed, receipt: exactReplay.receipt }));
    const compileResponse = await request('/api/agent/compile', { method: 'POST', token, body: { workspace: applied.workspace } });
    const compiled = await compileResponse.json();
    const compiledTargets = bulkPreview.rows.every((row) => {
      const content = compiled.files?.[row.targetFile];
      return typeof content === 'string'
        && content.includes(`<replace sel="${row.selector}">${row.newValue}</replace>`);
    });
    check('bulk-generated patches compile through the normal project path', compileResponse.status === 200
      && compiled.validation?.ok === true
      && compiledTargets,
    JSON.stringify({ status: compileResponse.status, validation: compiled.validation?.summary, targets: bulkPreview.rows.length, compiledTargets }));

    const corruptedWorkspace = structuredClone(applied.workspace);
    corruptedWorkspace.xmlPatches[0].sel = '//*[';
    const corruptCompileResponse = await request('/api/agent/compile', { method: 'POST', token, body: { workspace: corruptedWorkspace } });
    const corruptCompiled = await corruptCompileResponse.json();
    const corruptFinding = (corruptCompiled.diagnostics || []).find((finding) => finding.code === 'DIFF_SELECTOR_INVALID');
    check('normal validation cites a deliberately corrupted generated selector', corruptCompileResponse.status === 200
      && corruptCompiled.validation?.ok === false
      && corruptFinding?.severity === 'error'
      && corruptFinding?.filePath === corruptedWorkspace.xmlPatches[0].targetFile,
    JSON.stringify(corruptFinding || corruptCompiled.validation));

    const rerunPreviewResponse = await request('/api/agent/bulk-transform/preview', { method: 'POST', token, body: { rule: bulkRule } });
    const rerunPreview = await rerunPreviewResponse.json();
    const rerunApplyResponse = await request('/api/agent/bulk-transform/apply', {
      method: 'POST', token: writeToken, operationId: noChangeApplyOperationId,
      body: { rule: bulkRule, expectedPlanHash: rerunPreview.planHash, expectedHead: rerunPreview.workspaceHash, expectedSnapshotHash: rerunPreview.snapshotHash },
    });
    const rerunApplied = await rerunApplyResponse.json();
    const afterNoChangeApply = await request('/api/agent/workspace', { token }).then((response) => response.json());
    check('bulk rerun is idempotent and does not duplicate blocks', rerunPreviewResponse.status === 200 && rerunApplyResponse.status === 200 && rerunApplied.applied === false && rerunApplied.workspace?.xmlPatches?.length === bulkPreview.matchedFiles, JSON.stringify({ preview: rerunPreviewResponse.status, apply: rerunApplyResponse.status, applied: rerunApplied.applied, patches: rerunApplied.workspace?.xmlPatches?.length }));
    check('new-operation bulk rerun commits no_change without recovery', rerunPreviewResponse.status === 200
      && rerunApplyResponse.status === 200
      && rerunApplied.success === true
      && rerunApplied.status === 'SUCCESS'
      && rerunApplied.applied === false
      && rerunApplied.replayed === false
      && Object.keys(rerunApplied.receipt || {}).sort().join(',') === 'hash,id,status'
      && rerunApplied.receipt?.status === 'committed'
      && !Object.prototype.hasOwnProperty.call(rerunApplied, 'recovery')
      && rerunApplied.workspaceHash === afterNoChangeApply.workspaceHash
      && rerunApplied.snapshotHash === afterNoChangeApply.snapshotHash
      && afterNoChangeApply.workspaceHash === beforeChangedReplay.workspaceHash
      && afterNoChangeApply.snapshotHash === beforeChangedReplay.snapshotHash
      && afterNoChangeApply.version === beforeChangedReplay.version,
    JSON.stringify({ preview: rerunPreviewResponse.status, apply: rerunApplyResponse.status, receipt: rerunApplied.receipt, workspaceHash: rerunApplied.workspaceHash, snapshotHash: rerunApplied.snapshotHash }));

    const conflictWorkspace = structuredClone(rerunApplied.workspace);
    conflictWorkspace.wares.push({
      id: 'project_fuel', name: 'Project Fuel', description: 'Project-defined completion fixture',
      transport: 'container', volume: 1, minPrice: 1, avgPrice: 1, maxPrice: 1,
      prodTime: 1, prodAmount: 1, includeInBuild: true,
    });
    conflictWorkspace.xmlPatches.push({
      id: 'manual_conflict', action: 'replace', sel: bulkPreview.rows[0].selector,
      content: bulkPreview.rows[0].newValue, note: 'manual conflict fixture',
      targetFile: bulkPreview.rows[0].targetFile, includeInBuild: true,
    });
    const seedConflictResponse = await request('/api/agent/workspace', {
      method: 'POST', token, operationId: 'forge_op_reference_bulk_conflict_seed',
      body: { workspace: conflictWorkspace, expectedHead: rerunApplied.workspaceHash, expectedSnapshotHash: rerunApplied.snapshotHash },
    });
    const seededConflict = await seedConflictResponse.json();
    const conflictPreviewResponse = await request('/api/agent/bulk-transform/preview', { method: 'POST', token, body: { rule: bulkRule } });
    const conflictPreview = await conflictPreviewResponse.json();
    const afterConflictPreview = await request('/api/agent/workspace', { token }).then((response) => response.json());
    check('user-authored patch conflict blocks the whole plan with zero preview mutation', seedConflictResponse.status === 200
      && conflictPreviewResponse.status === 422
      && conflictPreview.findings?.some((finding) => finding.code === 'BULK_PATCH_CONFLICT')
      && afterConflictPreview.workspaceHash === seededConflict.workspaceHash,
    JSON.stringify({ seed: seedConflictResponse.status, preview: conflictPreviewResponse.status, conflicts: conflictPreview.conflicts?.length }));
    const projectSuggestionResponse = await request('/api/reference/suggest?kind=ware&q=project_f&intent=reference&limit=10', { token });
    const projectSuggestion = await projectSuggestionResponse.json();
    check('project-defined symbols layer over the canonical suggestion API', projectSuggestionResponse.status === 200
      && projectSuggestion.items?.some((item) => item.label === 'project_fuel' && item.source === 'project'),
    JSON.stringify(projectSuggestion.items || projectSuggestion));
    const projectCompletion = await complete('libraries/wares.xml', '<wares><ware id="fixture"><production><primary ware="project_f|"/></production></ware></wares>');
    check('project-defined symbols flow through document completion', projectCompletion.response.status === 200
      && projectCompletion.body?.some((item) => item.label === 'project_fuel' && /project/i.test(item.detail || '')),
    JSON.stringify(projectCompletion.body || null));
  }

  check('completion POST requires authentication', (await request('/api/reference/complete', { method: 'POST', body: { path: 'md/x.xml', content: '<x/>', line: 0, column: 0 } })).status === 401);
  check('invalid cursor rejected', (await request('/api/reference/complete', { method: 'POST', token, body: { path: 'md/x.xml', content: '<x/>', line: 9, column: 0 } })).status === 400);
  const unknownSchema = await complete('libraries/x.xml', '<x xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="not-real.xsd"><|');
  check('unknown declared schema degrades to empty completion', unknownSchema.response.status === 200 && Array.isArray(unknownSchema.body) && unknownSchema.body.length === 0, JSON.stringify(unknownSchema.body));

  const rawResponse = await request('/api/reference/file?path=index/macros.xml');
  const apiRaw = Buffer.from(await rawResponse.arrayBuffer());
  const diskRaw = fs.readFileSync(path.join(root, 'index', 'macros.xml'));
  check('raw reference file byte identity', rawResponse.status === 200 && apiRaw.equals(diskRaw), `status=${rawResponse.status}`);
  check('reference traversal rejected', (await request('/api/reference/file?path=../outside.xml')).status === 403);
  check('missing reference file is 404', (await request('/api/reference/file?path=libraries/definitely_missing.xml')).status === 404);

  const project = {
    id: 'reference_acceptance',
    name: 'Reference Acceptance',
    files: [
      { path: 'md/b74_invalid.xml', kind: 'md', content: `${mdHeader}<cues><cue name="Root" bogus="1"><conditions><totally_illegal/><match_relation_of relation="bogus"/></conditions><actions><find_ship name="$target"/><set_value name="$x" exact="$target.knownnmae"/><set_value name="$f" exact="faction.riptide"/><set_value name="$w" exact="ware.notarealware"/></actions></cue></cues></mdscript>` },
      { path: 'md/b74_order_invalid.xml', kind: 'md', content: `${mdHeader}<cues><cue name="Root"><actions/><conditions/></cue></cues></mdscript>` },
      { path: 'libraries/wares.xml', kind: 'xml', content: '<wares><ware id="projectware" name="Project Ware" group="test"/></wares>' },
      { path: 'libraries/factions.xml', kind: 'xml', content: '<factions><faction id="projectfaction" name="Project Faction"/></factions>' },
      { path: 'libraries/diff_fixture.xml', kind: 'xml', content: '<diff><add sel="/wares"><ware id="diffware"/></add></diff>' },
      { path: 'libraries/gamestarts.xml', kind: 'xml', content: '<diff><remove sel="/gamestarts/definitely_missing"/><add sel="/gamestarts"><definitely_illegal/></add></diff>' },
      { path: 'ui/addons/reference_acceptance/reference.lua', kind: 'lua', content: 'GetWareData("projectware", "name")\nGetFactionData("projectfaction", "name")\nGetWareData("notarealware", "name")\nGetFactionData("notarealfaction", "name")' },
    ],
  };
  const validationResponse = await request('/api/agent/project/validate', { method: 'POST', token, body: { project } });
  const validation = await validationResponse.json();
  const referenceFindings = validation?.references?.findings || [];
  check('project validation returned reference findings', validationResponse.status === 200 && validation?.references?.available === true, `status=${validationResponse.status}`);
  check('unknown ware warning names bad id', referenceFindings.some((finding) => finding.severity === 'warning' && finding.id === 'notarealware'));
  check('unknown faction warning names bad id', referenceFindings.some((finding) => finding.severity === 'warning' && finding.id === 'notarealfaction'));
  check('project-owned ids remain clean', !referenceFindings.some((finding) => finding.id === 'projectware' || finding.id === 'projectfaction'));
  const schemaFindings = validation?.schema?.findings || [];
  check('illegal child is a cited XSD error', schemaFindings.some((finding) => finding.severity === 'error' && finding.code === 'XSD_ILLEGAL_CHILD' && /md\.xsd|common\.xsd/i.test(finding.message)), JSON.stringify(schemaFindings.filter((finding) => finding.code === 'XSD_ILLEGAL_CHILD')));
  check('self-closing sibling actions do not create false nesting errors', !schemaFindings.some((finding) => finding.code === 'XSD_ILLEGAL_CHILD' && finding.sourceRef === 'set_value>set_value'), JSON.stringify(schemaFindings.filter((finding) => finding.sourceRef === 'set_value>set_value')));
  check('illegal attribute is a cited XSD error', schemaFindings.some((finding) => finding.severity === 'error' && finding.code === 'XSD_UNKNOWN_ATTRIBUTE' && /bogus/.test(finding.sourceRef || finding.message)));
  check('bad enum is a cited XSD error', schemaFindings.some((finding) => finding.severity === 'error' && finding.code === 'XSD_ENUM_VIOLATION' && /relation/.test(finding.sourceRef || finding.message)));
  check('illegal XSD child order is a cited error', schemaFindings.some((finding) => finding.filePath === 'md/b74_order_invalid.xml' && finding.severity === 'error' && finding.code === 'XSD_CHILD_ORDER' && /md\.xsd|common\.xsd/i.test(finding.message)), JSON.stringify(schemaFindings.filter((finding) => finding.filePath === 'md/b74_order_invalid.xml')));
  check('diff.xsd accepts schema-legal patch payload', !schemaFindings.some((finding) => finding.filePath === 'libraries/diff_fixture.xml' && ['XSD_UNKNOWN_ELEMENT', 'XSD_ILLEGAL_CHILD', 'XSD_UNKNOWN_ATTRIBUTE'].includes(finding.code)), JSON.stringify(schemaFindings.filter((finding) => finding.filePath === 'libraries/diff_fixture.xml')));
  const propertyFindings = validation?.scriptProperties?.findings || [];
  check('unknown typed script property is warning with suggestion', propertyFindings.some((finding) => finding.severity === 'warning' && finding.chain?.startsWith('$target.') && finding.segment === 'knownnmae' && finding.suggestions?.includes('knownname')), JSON.stringify(propertyFindings));
  check('project validation exposes inferred symbols', validation?.symbols?.variables?.some((symbol) => symbol.name === '$target' && symbol.type === 'ship' && symbol.filePath === 'md/b74_invalid.xml'), JSON.stringify(validation?.symbols || null));
  check('expression reference ids warn', referenceFindings.some((finding) => finding.id === 'riptide') && referenceFindings.some((finding) => finding.id === 'notarealware'));
  const diffLayer = validation?.diffSimulation?.files?.find((file) => file.path === 'libraries/gamestarts.xml');
  check('project validation detects dead diff selector', diffLayer?.findings?.some((finding) => finding.code === 'DIFF_SELECTOR_ZERO'), JSON.stringify(diffLayer || null));
  check('project validation XSD-checks post-apply document', diffLayer?.postApplyFindings?.some((finding) => finding.severity === 'error' && /ILLEGAL|UNKNOWN/.test(finding.code)), JSON.stringify(diffLayer?.postApplyFindings || null));
  check('post-apply validation subtracts vanilla baseline findings', !diffLayer?.postApplyFindings?.some((finding) => /test_ship_arg_m_uimax_test_macro/.test(finding.message || '')), JSON.stringify(diffLayer?.postApplyFindings || null));
} catch (error) {
  check('harness completed without exception', false, error instanceof Error ? error.message : String(error));
} finally {
  killTree(server?.pid);
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* best effort */ }
}

const passed = checks.filter((item) => item.pass).length;
console.log(`[reference-api-integration] ${passed}/${checks.length} ${passed === checks.length ? 'PASS' : 'FAIL'}`);
process.exit(checks.length > 0 && passed === checks.length ? 0 : 1);
