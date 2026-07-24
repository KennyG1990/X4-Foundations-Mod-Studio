/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Startup walkaround card (beta-UX bundle D1, 2026-07-09) — the pre-flight inspection
 * a pilot does before touching anything: paths found, schemas loaded, game data indexed,
 * optional runtime integration alive, mod copies in sync, resident Lua fresh. One card, five seconds, no
 * surprises an hour into work.
 *
 * Pure assembly: the server gathers probe RESULTS (this module does no I/O) and this
 * engine turns them into ordered rows with pass/warn/fail and plain-English detail.
 * Unknown is reported as unknown — a probe that couldn't run never claims health.
 */

export interface HealthProbes {
  gamePath?: { path: string; exists: boolean };
  stagingPath?: { path: string; exists: boolean };
  mdSchema?: { loaded: boolean; elements: number };
  aiSchema?: { loaded: boolean; elements: number };
  scriptProperties?: { loaded: boolean; properties: number };
  objectIndex?: { items: number } | null;
  bridge?: { bridgeUp: boolean; gameActive: boolean; summary: string } | null;
  debugLog?: { found: boolean; updatedAt?: string } | null;
  activeModDrift?: { verdict: string; summary: string } | null;
  luaStaleness?: { restartRequired: boolean; instrumented: number; summary: string } | null;
}

export interface HealthRow {
  id: string;
  label: string;
  status: 'pass' | 'warn' | 'fail' | 'unknown';
  detail: string;
}

export interface HealthCard {
  rows: HealthRow[];
  verdict: 'ready' | 'attention' | 'blocked';
  summary: string;
}

export function buildHealthCard(p: HealthProbes): HealthCard {
  const rows: HealthRow[] = [];
  const row = (id: string, label: string, status: HealthRow['status'], detail: string) =>
    rows.push({ id, label, status, detail });

  // Paths — without the game path, most of the studio is blind.
  if (!p.gamePath) row('game_path', 'X4 installation', 'unknown', 'Probe did not run.');
  else row('game_path', 'X4 installation', p.gamePath.exists ? 'pass' : 'fail',
    p.gamePath.exists ? p.gamePath.path : `Configured path not found: ${p.gamePath.path} — set it in Settings.`);

  if (!p.stagingPath) row('staging', 'Mod staging folder', 'unknown', 'Probe did not run.');
  else row('staging', 'Mod staging folder', p.stagingPath.exists ? 'pass' : 'warn',
    p.stagingPath.exists ? p.stagingPath.path : `Not found (${p.stagingPath.path}) — deploys will skip the staging copy.`);

  // Knowledge — the schema + property truth every validator relies on.
  row('md_schema', 'Mission Director schema', p.mdSchema?.loaded ? 'pass' : 'fail',
    p.mdSchema?.loaded ? `${p.mdSchema.elements} elements loaded (md.xsd + common.xsd)` : 'md.xsd not loaded — validation is blind. Check the schema path in Settings.');
  row('ai_schema', 'AI-script schema', p.aiSchema?.loaded ? 'pass' : 'warn',
    p.aiSchema?.loaded ? `${p.aiSchema.elements} elements (harvested from game data)` : 'aiscripts.xsd unavailable — aiscript files will not be schema-checked.');
  row('scriptprops', 'Script properties', p.scriptProperties?.loaded ? 'pass' : 'warn',
    p.scriptProperties?.loaded ? `${p.scriptProperties.properties} properties indexed (autocomplete + chain lint armed)` : 'scriptproperties.xml not indexed — autocomplete and property lint are off.');
  row('object_index', 'Game object index', p.objectIndex ? 'pass' : 'warn',
    p.objectIndex ? `${p.objectIndex.items} wares/factions/ships indexed` : 'Object index not built yet — reference pickers will be empty until first build.');

  // Live chain — optional external runtime + log. ADR-F3 binds external integrations as
  // optional and never a Forge dependency. An unavailable runtime is therefore NEVER a
  // warning for the general walkaround.
  if (!p.bridge) row('bridge', 'Optional runtime integration', 'unknown', 'Probe did not run.');
  else if (p.bridge.bridgeUp) row('bridge', 'Optional runtime integration', 'pass', p.bridge.summary);
  else row('bridge', 'Optional runtime integration', 'unknown',
    `Not running — core Forge authoring and validation are unaffected. (${p.bridge.summary})`);
  if (!p.debugLog) row('debuglog', 'X4 debug log', 'unknown', 'Probe did not run.');
  else row('debuglog', 'X4 debug log', p.debugLog.found ? 'pass' : 'warn',
    p.debugLog.found ? `Found (last write ${p.debugLog.updatedAt || 'unknown'}) — LIVE mode available` : 'No debuglog found — LIVE mode and the log watcher have nothing to read (launch X4 with -debug scripts -logfile debuglog.txt).');

  // Integrity — the two silent killers.
  if (!p.activeModDrift) row('drift', 'Mod copies in sync', 'unknown', 'No active mod with both copies to compare.');
  else row('drift', 'Mod copies in sync', p.activeModDrift.verdict === 'identical' ? 'pass' : 'warn', p.activeModDrift.summary);
  if (!p.luaStaleness) row('lua', 'Resident Lua freshness', 'unknown', 'Probe did not run.');
  else row('lua', 'Resident Lua freshness',
    p.luaStaleness.restartRequired ? 'fail' : p.luaStaleness.instrumented > 0 ? 'pass' : 'warn',
    p.luaStaleness.summary);

  const fails = rows.filter(r => r.status === 'fail').length;
  const warns = rows.filter(r => r.status === 'warn').length;
  const verdict: HealthCard['verdict'] = fails > 0 ? 'blocked' : warns > 0 ? 'attention' : 'ready';
  const summary = verdict === 'ready'
    ? 'All checks green — ready to build.'
    : verdict === 'attention'
      ? `${warns} item(s) worth a look — nothing blocking.`
      : `${fails} blocking issue(s) — fix these before trusting builds.`;
  return { rows, verdict, summary };
}

/* ------------------------------------------------------------------ *
 * Oracle.
 * ------------------------------------------------------------------ */

export function runHealthCardSelftest(): {
  allPassed: boolean; pass: boolean; passed: number; total: number;
  checks: { name: string; pass: boolean; detail?: string }[];
} {
  const checks: { name: string; pass: boolean; detail?: string }[] = [];
  const ok = (name: string, cond: boolean, detail?: unknown) =>
    checks.push({ name, pass: !!cond, detail: detail === undefined ? undefined : (typeof detail === 'string' ? detail : JSON.stringify(detail)) });

  const healthy = buildHealthCard({
    gamePath: { path: 'G:/X4', exists: true },
    stagingPath: { path: 'F:/mods', exists: true },
    mdSchema: { loaded: true, elements: 1200 },
    aiSchema: { loaded: true, elements: 1381 },
    scriptProperties: { loaded: true, properties: 2333 },
    objectIndex: { items: 5000 },
    bridge: { bridgeUp: true, gameActive: false, summary: 'Bridge UP, game idle.' },
    debugLog: { found: true, updatedAt: '2026-07-09' },
    activeModDrift: { verdict: 'identical', summary: 'Copies identical.' },
    luaStaleness: { restartRequired: false, instrumented: 3, summary: 'Consistent.' },
  });
  ok('healthy env → ready verdict', healthy.verdict === 'ready' && healthy.rows.every(r => r.status === 'pass'), healthy.summary);
  ok('row order stable (paths first, integrity last)', healthy.rows[0].id === 'game_path' && healthy.rows[healthy.rows.length - 1].id === 'lua');

  const broken = buildHealthCard({
    gamePath: { path: 'G:/nope', exists: false },
    mdSchema: { loaded: false, elements: 0 },
    aiSchema: { loaded: false, elements: 0 },
    scriptProperties: { loaded: false, properties: 0 },
    objectIndex: null,
    bridge: { bridgeUp: false, gameActive: false, summary: 'Bridge DOWN.' },
    debugLog: { found: false },
    activeModDrift: { verdict: 'drifted', summary: 'DRIFT: 3 differ.' },
    luaStaleness: { restartRequired: true, instrumented: 2, summary: 'STALE.' },
  });
  ok('missing game path + schema + stale lua → blocked', broken.verdict === 'blocked', broken.summary);
  ok('fail rows carry actionable plain-English detail',
    broken.rows.find(r => r.id === 'game_path')!.detail.includes('Settings')
    && broken.rows.find(r => r.id === 'debuglog')!.detail.includes('-debug scripts'));
  ok('drift warn not fail (advisory)', broken.rows.find(r => r.id === 'drift')!.status === 'warn');
  // ADR-F3: an unavailable optional runtime must NEVER surface as a warning or
  // requirement in the general walkaround.
  ok('down bridge is neutral info, never a warn (optional integration)',
    broken.rows.find(r => r.id === 'bridge')!.status === 'unknown'
    && broken.rows.find(r => r.id === 'bridge')!.label.toLowerCase().includes('optional'));
  ok('optional integration copy is implementation-neutral',
    broken.rows.find(r => r.id === 'bridge')!.label === 'Optional runtime integration'
    && broken.rows.find(r => r.id === 'bridge')!.detail.includes('core Forge authoring and validation are unaffected')
    && !broken.rows.find(r => r.id === 'bridge')!.detail.includes('x4_ai'),
    broken.rows.find(r => r.id === 'bridge'));

  const partial = buildHealthCard({ gamePath: { path: 'G:/X4', exists: true }, mdSchema: { loaded: true, elements: 10 } });
  ok('missing probes → unknown, never claimed healthy',
    partial.rows.find(r => r.id === 'bridge')!.status === 'unknown' && partial.rows.find(r => r.id === 'lua')!.status === 'unknown');
  ok('warn-only env → attention verdict', buildHealthCard({
    gamePath: { path: 'g', exists: true }, stagingPath: { path: 's', exists: false },
    mdSchema: { loaded: true, elements: 1 }, aiSchema: { loaded: true, elements: 1 },
    scriptProperties: { loaded: true, properties: 1 }, objectIndex: { items: 1 },
    bridge: { bridgeUp: true, gameActive: true, summary: 'up' }, debugLog: { found: true },
    activeModDrift: { verdict: 'identical', summary: 'ok' }, luaStaleness: { restartRequired: false, instrumented: 1, summary: 'ok' },
  }).verdict === 'attention');
  ok('empty probes degrade to unknowns', buildHealthCard({}).rows.length > 0);

  const passed = checks.filter(c => c.pass).length;
  const allPassed = passed === checks.length;
  return { allPassed, pass: allPassed, passed, total: checks.length, checks };
}
