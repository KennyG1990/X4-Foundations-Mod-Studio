#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = process.env.X4_REFERENCE_ROOT || 'F:\\Downskies\\x4unpackersuiteV1\\X4 unpacked 9.00';
const port = Number(process.env.REFERENCE_API_TEST_PORT || 8973);
const base = `http://127.0.0.1:${port}`;
const token = `reference-api-integration-${process.pid}`;
const tmp = path.join(os.tmpdir(), `x4-reference-api-${process.pid}`);
const stateDir = path.join(tmp, 'state');
const dataDir = path.join(tmp, 'data');
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
      STUDIO_API_TOKEN: token,
      X4_STATE_DIR: stateDir,
      X4_DATA_DIR: dataDir,
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
  check('warm completion p95 under 100ms', warmLatencies.length === 20 && warmP95 < 100, `${warmP95.toFixed(1)}ms`);

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
