/** Pure advisory lint for explicit reference literals not reliably schema-typed (notably Lua). */

export interface ReferenceLiteralSets {
  factions?: Set<string>;
  wares?: Set<string>;
  macros?: Set<string>;
  sectors?: Set<string>;
}

export interface ReferenceLiteralFinding {
  code: 'reference.unknown_faction' | 'reference.unknown_ware' | 'reference.unknown_macro' | 'reference.unknown_sector';
  severity: 'warning';
  kind: 'faction' | 'ware' | 'macro' | 'sector';
  id: string;
  filePath?: string;
  line: number;
  suggestions: string[];
  message: string;
}

function editDistance(a: string, b: string, cap: number): number {
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]; row[0] = i; let best = row[0];
    for (let j = 1; j <= b.length; j++) {
      const old = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = old; best = Math.min(best, row[j]);
    }
    if (best > cap) return cap + 1;
  }
  return row[b.length];
}

function suggest(id: string, values: Set<string> | undefined): string[] {
  if (!values?.size) return [];
  const clean = id.toLowerCase().replace(/^faction\./, '');
  const candidates = [...values]
    .map(v => v.toLowerCase().replace(/^faction\./, ''))
    .filter((v, i, all) => all.indexOf(v) === i)
    .map(v => ({ v, d: editDistance(clean, v, 3) }))
    .filter(x => x.d <= 3)
    .sort((a, b) => a.d - b.d || a.v.localeCompare(b.v))
    .slice(0, 3)
    .map(x => x.v);
  return candidates;
}

function maskComments(content: string, isLua: boolean): string {
  const keepLines = (s: string) => s.replace(/[^\n]/g, ' ');
  return isLua
    ? content.replace(/--\[(=*)\[[\s\S]*?\]\1\]/g, keepLines).replace(/--[^\r\n]*/g, keepLines)
    : content.replace(/<!--[\s\S]*?-->/g, keepLines);
}

function lineAt(content: string, index: number): number { return content.slice(0, index).split('\n').length; }

export function lintReferenceLiterals(
  content: string,
  references: ReferenceLiteralSets,
  opts: { filePath?: string; kind?: string } = {},
): ReferenceLiteralFinding[] {
  if (!content || (!references.factions?.size && !references.wares?.size && !references.macros?.size && !references.sectors?.size)) return [];
  const isLua = opts.kind === 'lua' || /\.lua$/i.test(opts.filePath || '');
  const masked = maskComments(content, isLua);
  const findings: ReferenceLiteralFinding[] = [];
  const seen = new Set<string>();
  const add = (kind: ReferenceLiteralFinding['kind'], idInput: string, index: number, values: Set<string> | undefined) => {
    if (!values?.size) return;
    const id = idInput.toLowerCase();
    const lookup = kind === 'faction' ? [id, `faction.${id}`] : [id];
    if (lookup.some(v => values.has(v))) return;
    const key = `${kind}:${id}:${index}`;
    if (seen.has(key)) return;
    seen.add(key);
    const suggestions = suggest(id, values);
    const suffix = suggestions.length ? ` Did you mean ${suggestions.join(', ')}?` : '';
    findings.push({
      code: kind === 'faction' ? 'reference.unknown_faction' : kind === 'ware' ? 'reference.unknown_ware' : kind === 'sector' ? 'reference.unknown_sector' : 'reference.unknown_macro',
      severity: 'warning', kind, id, filePath: opts.filePath, line: lineAt(masked, index), suggestions,
      message: `${kind} reference "${id}" is not present in the configured canonical X4 corpus.${suffix}`,
    });
  };

  // Unambiguous MD/AIScript expression form, also used in Lua strings sent to MD.
  for (const m of masked.matchAll(/\bfaction\.([A-Za-z_][\w-]*)\b/g)) add('faction', m[1], m.index || 0, references.factions);
  for (const m of masked.matchAll(/\bware\.([A-Za-z_][\w-]*)\b/g)) add('ware', m[1], m.index || 0, references.wares);
  for (const m of masked.matchAll(/\bmacro\.([A-Za-z_][\w-]*)\b/g)) add('macro', m[1], m.index || 0, references.macros);

  if (isLua) {
    // Corpus-proven literal APIs. Variable first arguments are intentionally skipped.
    for (const m of masked.matchAll(/\bGetWareData\s*\(\s*(["'])([^"']+)\1\s*,/g)) add('ware', m[2], m.index || 0, references.wares);
    for (const m of masked.matchAll(/\bGetFactionData\s*\(\s*(["'])([^"']+)\1\s*,/g)) add('faction', m[2], m.index || 0, references.factions);
    for (const m of masked.matchAll(/\bGetMacroData\s*\(\s*(["'])([^"']+)\1\s*,/g)) add('macro', m[2], m.index || 0, references.macros);
  } else {
    // Schema validation remains primary; these explicit attributes keep checks armed on
    // schema-less installs and for diff payloads whose domain schema is wrapper-only.
    for (const m of masked.matchAll(/\bware\s*=\s*(["'])([A-Za-z_][\w-]*)\1/g)) add('ware', m[2], m.index || 0, references.wares);
    for (const m of masked.matchAll(/\bmacro\s*=\s*(["'])([A-Za-z_][\w-]*_macro)\1/g)) add('macro', m[2], m.index || 0, references.macros);
    for (const m of masked.matchAll(/\bsector\s*=\s*(["'])([A-Za-z_][\w-]*_macro)\1/g)) add('sector', m[2], m.index || 0, references.sectors || references.macros);

    // B94 (phantom ids in list literals) was ATTEMPTED here and REVERTED 2026-07-26 — see BACKLOG.
    // The "a list containing a known faction proves a faction position" heuristic FAILED its bar:
    // it flagged `broker` in the real mod's ai_influence_chat.xml (real lists mix faction ids with
    // role/tag tokens) and still missed the target `riptide`, which lives in an XML attribute as
    // &apos;-escaped text. Shipping a lint that cries wolf is worse than shipping none.
  }
  return findings;
}

export function runReferenceLiteralLintSelftest() {
  const refs = {
    factions: new Set(['argon', 'faction.argon', 'fallensplit', 'faction.fallensplit']),
    wares: new Set(['energycells', 'water']),
    macros: new Set(['ship_arg_l_destroyer_01_a_macro', 'cluster_01_sector001_macro']),
    sectors: new Set(['cluster_01_sector001_macro']),
  };
  const xml = '<do_if value="faction.argonn.name"/><set_value exact="ware.energcells"/><ware ware="energcells"/><create_ship macro="ship_arg_l_destroyer_01_a_macro"/><find_sector sector="cluster_01_sector002_macro"/>';
  const lua = '-- GetWareData("boguscomment", "name")\nlocal n=GetWareData("waterr", "name")';
  const findings = [...lintReferenceLiterals(xml, refs, { filePath: 'md/test.xml', kind: 'md' }), ...lintReferenceLiterals(lua, refs, { filePath: 'ui/test.lua', kind: 'lua' })];
  const checks = [
    { name: 'bad faction warned with suggestion', pass: findings.some(f => f.kind === 'faction' && f.id === 'argonn' && f.suggestions.includes('argon')) },
    { name: 'bad XML ware warned', pass: findings.some(f => f.kind === 'ware' && f.id === 'energcells') },
    { name: 'bad expression ware warned', pass: findings.some(f => f.kind === 'ware' && f.id === 'energcells' && f.suggestions.includes('energycells')) },
    { name: 'bad sector uses sector catalog', pass: findings.some(f => f.kind === 'sector' && f.id === 'cluster_01_sector002_macro') },
    { name: 'bad Lua literal ware warned', pass: findings.some(f => f.kind === 'ware' && f.id === 'waterr') },
    { name: 'Lua comment ignored', pass: !findings.some(f => f.id === 'boguscomment') },
    { name: 'known macro clean', pass: !findings.some(f => f.kind === 'macro') },
  ];
  const passed = checks.filter(c => c.pass).length;
  return { allPassed: passed === checks.length, pass: passed === checks.length, passed, total: checks.length, checks };
}
