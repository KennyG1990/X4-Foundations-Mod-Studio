/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Scriptproperty validation — the ROADMAP "TOOL GAP" (x4_ai_influence AAR, 2026-06-27).
 *
 * The Forge validates XSD structure + cross-file cues, but NOT MD/AIScript PROPERTY
 * ACCESS against the game's `libraries/scriptproperties.xml`. A wrong-but-schema-legal
 * property (`$station.controlentity`, `$station.manager`) passes validate and only fails
 * IN-GAME (cost 3 /refreshmd cycles building the NPC census). This engine parses the
 * real scriptproperties.xml (keywords + datatypes with inheritance + `{$...}` placeholder
 * properties + `<import>`-generated dynamic properties) and lints `$obj.property` chains
 * in MD/AIScript XML, flagging unknown property segments as WARNINGS with the valid
 * options — "caught offline at author time" instead of "discovered in-game over N reloads".
 *
 * Honesty scope (determinism doctrine): `$var` roots are UNTYPED in MD, so segment checks
 * are against the UNION of all known property names — this catches typos/nonexistent
 * properties but NOT type-wrong-but-existing-elsewhere ones. Typed first-segment checks
 * apply only to non-dynamic KEYWORD roots (`event.`, `player.`, …) where the root is
 * unambiguous. Everything is a warning, never an error: absence from the parsed set can
 * mean an `<import>`-generated property, so we never claim certainty we don't have.
 *
 * House pattern: pure engine (no fs/network — caller supplies the XML strings) + oracle
 * (`runScriptPropertiesSelftest`) + public GET selftest route in server.ts.
 * XML parsing: xmldom (nested structure), per the house rule — regex only for flat files.
 */

import { DOMParser } from '@xmldom/xmldom';
import { parseExpressionChains } from './expressionAst';

export interface SPEntry {
  kind: 'keyword' | 'datatype';
  name: string;
  /** datatype inheritance parent (`<datatype name="ship" type="container">`) */
  parent?: string;
  /** literal HEAD tokens of this entry's own property names ("isclass.{$class}" → "isclass") */
  heads: Set<string>;
  /** head → `result` documentation text (for autocomplete; first definition wins) */
  headDocs: Map<string, string>;
  /** full property names as written (for suggestions/diagnostics) */
  propNames: string[];
  /** full property records as authored in scriptproperties.xml (reference API). */
  properties: Array<{ name: string; result: string; type: string }>;
  /** has a pure-placeholder property like "{$numeric}" — any segment is legal here */
  wildcard: boolean;
  /** contains <import> children — property set is dynamic/incomplete, don't type-check */
  dynamic: boolean;
  /** return datatype declared by a dynamic import template (faction.<id> -> faction) */
  dynamicResultType?: string;
}

export interface ResolvedScriptProperty {
  name: string;
  result: string;
  type: string;
  owner: string;
  inherited: boolean;
}

export interface ScriptPropertyModel {
  keywords: Map<string, SPEntry>;
  datatypes: Map<string, SPEntry>;
  parsedProperties: number;
}

export interface ScriptPropertyIndex {
  model: ScriptPropertyModel;
  /** union of every literal property head across all keywords + datatypes */
  union: Set<string>;
  /** head → first `result` doc seen (for autocomplete detail text; first wins) */
  docs: Map<string, string>;
  /** heads that exist as a COMPLETE bare property name on at least one type ("exists") */
  bareOk: Set<string>;
  /**
   * head → its literal continuation tokens ("controlentity" → {"default"}), with "*"
   * when a placeholder continuation exists ("controlentity.{$controlpost}" → "*").
   * A head present here but NOT in bareOk requires a sub-selector — using it bare is
   * exactly the $station.controlentity in-game failure from the 2026-06-27 AAR.
   */
  continuations: Map<string, Set<string>>;
  /** true when built from a real (non-empty) scriptproperties.xml */
  loaded: boolean;
}

export interface ScriptPropertyFinding {
  code: 'scriptproperty.unknown' | 'scriptproperty.requires_subselector';
  severity: 'warning';
  /** the full chain as written, e.g. "$station.controlentity" */
  chain: string;
  /** the offending segment */
  segment: string;
  /** keyword root the typed check used, when applicable */
  root?: string;
  line: number;
  suggestions: string[];
  detail: string;
}

/* ------------------------------------------------------------------ *
 * Parsing — real shape (probed from the unpacked 9.00 game data):
 *   <scriptproperties>
 *     <keyword name="event" description="…"> <property name="param2" …/> … </keyword>
 *     <keyword name="faction" …> <import source="libraries/factions.xml" …> … </import> </keyword>
 *     <datatype name="component"> <property name="isclass.{$class}" …/> … </datatype>
 *     <datatype name="ship" type="container"> … </datatype>   (inheritance via type)
 *     <datatype name="list"> <property name="{$numeric}" …/> </datatype>  (wildcard)
 * ------------------------------------------------------------------ */

/** Literal head of a property name: text before the first '.' or placeholder. Empty → wildcard. */
export function propertyHead(name: string): string {
  const m = String(name || '').match(/^([A-Za-z_][\w]*)/);
  return m ? m[1].toLowerCase() : '';
}

export function parseScriptProperties(xml: string): ScriptPropertyModel {
  const model: ScriptPropertyModel = { keywords: new Map(), datatypes: new Map(), parsedProperties: 0 };
  if (!xml || typeof xml !== 'string') return model;
  let doc: ReturnType<DOMParser['parseFromString']>;
  try {
    doc = new DOMParser({ onError: () => { /* collect nothing; degrade */ } }).parseFromString(xml, 'text/xml');
  } catch {
    return model;
  }
  const root = doc?.documentElement;
  if (!root || root.nodeName !== 'scriptproperties') return model;

  for (let i = 0; i < root.childNodes.length; i++) {
    const node = root.childNodes[i] as unknown as { nodeType: number; nodeName: string; getAttribute?: (n: string) => string | null; getElementsByTagName?: (n: string) => ArrayLike<{ getAttribute: (n: string) => string | null }>; childNodes?: ArrayLike<{ nodeType: number; nodeName: string }> };
    if (node.nodeType !== 1) continue;
    const kind = node.nodeName === 'keyword' ? 'keyword' : node.nodeName === 'datatype' ? 'datatype' : null;
    if (!kind || !node.getAttribute) continue;
    const name = (node.getAttribute('name') || '').toLowerCase();
    if (!name) continue;

    const entry: SPEntry = {
      kind,
      name,
      parent: (node.getAttribute('type') || '').toLowerCase() || undefined,
      heads: new Set<string>(),
      headDocs: new Map<string, string>(),
      propNames: [],
      properties: [],
      wildcard: false,
      dynamic: false,
    };
    // properties can be direct children OR nested inside <import> templates; count only
    // direct <property> children as the static set, and any <import> marks it dynamic.
    const kids = node.childNodes || [];
    for (let k = 0; k < kids.length; k++) {
      const kid = kids[k] as unknown as { nodeType: number; nodeName: string; getAttribute?: (n: string) => string | null };
      if (kid.nodeType !== 1) continue;
      if (kid.nodeName === 'import') {
        entry.dynamic = true;
        const imported = (kid as unknown as { getElementsByTagName?: (n: string) => ArrayLike<{ getAttribute: (n: string) => string | null }> })
          .getElementsByTagName?.('property');
        const resultType = imported?.[0]?.getAttribute?.('type') || '';
        if (resultType && !entry.dynamicResultType) entry.dynamicResultType = resultType.toLowerCase();
        continue;
      }
      if (kid.nodeName !== 'property' || !kid.getAttribute) continue;
      const pname = kid.getAttribute('name') || '';
      if (!pname) continue;
      model.parsedProperties++;
      entry.propNames.push(pname);
      entry.properties.push({
        name: pname,
        result: kid.getAttribute('result') || '',
        type: kid.getAttribute('type') || '',
      });
      const head = propertyHead(pname);
      if (head) {
        entry.heads.add(head);
        const doc = kid.getAttribute('result') || '';
        if (doc && !entry.headDocs.has(head)) entry.headDocs.set(head, doc);
      } else entry.wildcard = true; // pure placeholder like "{$numeric}"
    }
    (kind === 'keyword' ? model.keywords : model.datatypes).set(name, entry);
  }
  return model;
}

/** Resolve a datatype's full head set following `type` inheritance (cycle-safe). */
export function resolveDatatypeHeads(model: ScriptPropertyModel, name: string): Set<string> {
  const out = new Set<string>();
  let cur = model.datatypes.get(String(name || '').toLowerCase());
  const seen = new Set<string>();
  while (cur && !seen.has(cur.name)) {
    seen.add(cur.name);
    for (const h of cur.heads) out.add(h);
    cur = cur.parent ? model.datatypes.get(cur.parent) : undefined;
  }
  return out;
}

/** Full property records for a datatype, own definitions first then inherited parents. */
export function resolveDatatypeProperties(model: ScriptPropertyModel, name: string): ResolvedScriptProperty[] {
  const out: ResolvedScriptProperty[] = [];
  const seenTypes = new Set<string>();
  const seenNames = new Set<string>();
  let current = model.datatypes.get(String(name || '').toLowerCase());
  let inherited = false;
  while (current && !seenTypes.has(current.name)) {
    seenTypes.add(current.name);
    for (const property of current.properties) {
      const key = property.name.toLowerCase();
      if (seenNames.has(key)) continue;
      seenNames.add(key);
      out.push({ ...property, owner: current.name, inherited });
    }
    current = current.parent ? model.datatypes.get(current.parent) : undefined;
    inherited = true;
  }
  return out;
}

export function buildScriptPropertyIndex(xml: string): ScriptPropertyIndex {
  const model = parseScriptProperties(xml);
  return buildScriptPropertyIndexFromModel(model);
}

export function buildScriptPropertyIndexFromModel(model: ScriptPropertyModel): ScriptPropertyIndex {
  const union = new Set<string>();
  const docs = new Map<string, string>();
  const bareOk = new Set<string>();
  const continuations = new Map<string, Set<string>>();
  for (const entry of [...model.keywords.values(), ...model.datatypes.values()]) {
    for (const h of entry.heads) {
      union.add(h);
      const d = entry.headDocs.get(h);
      if (d && !docs.has(h)) docs.set(h, d);
    }
    for (const pname of entry.propNames) {
      const head = propertyHead(pname);
      if (!head) continue;
      const rest = pname.slice(head.length);
      if (rest === '') { bareOk.add(head); continue; }
      if (!rest.startsWith('.')) { bareOk.add(head); continue; } // "head?" style oddities — treat as bare
      const contSet = continuations.get(head) || new Set<string>();
      const contTok = rest.slice(1).match(/^([A-Za-z_]\w*)/)?.[1];
      contSet.add(contTok ? contTok.toLowerCase() : '*'); // placeholder continuation → "*"
      continuations.set(head, contSet);
    }
  }
  return { model, union, docs, bareOk, continuations, loaded: union.size > 0 };
}

/* ------------------------------------------------------------------ *
 * Chain lint.
 * ------------------------------------------------------------------ */

/** Small edit distance for suggestions (capped; returns >cap early). */
function editDistance(a: string, b: string, cap: number): number {
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  const dp = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) dp[j] = j;
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    let rowMin = dp[0];
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
      if (dp[j] < rowMin) rowMin = dp[j];
    }
    if (rowMin > cap) return cap + 1;
  }
  return dp[b.length];
}

export function suggestProperties(segment: string, candidates: Iterable<string>, max = 5): string[] {
  const seg = segment.toLowerCase();
  const scored: { name: string; score: number }[] = [];
  for (const c of candidates) {
    let score = Number.MAX_SAFE_INTEGER;
    if (c.startsWith(seg.slice(0, 4)) && seg.length >= 4) score = 1;
    const d = editDistance(seg, c, 2);
    if (d <= 2) score = Math.min(score, d);
    if (score !== Number.MAX_SAFE_INTEGER) scored.push({ name: c, score });
  }
  scored.sort((a, b) => a.score - b.score || a.name.localeCompare(b.name));
  return scored.slice(0, max).map(s => s.name);
}

/**
 * Mask spans whose contents must not be scanned as property chains, preserving
 * offsets/line numbers: XML comments, single-quoted MD string literals, and the
 * prose attributes (comment=, result=, description=) which legitimately contain
 * dotted sentences. Replaces non-newline chars with spaces.
 */
export function maskNonExpressionSpans(xml: string): string {
  return String(xml || '')
    .replace(/<!--[\s\S]*?-->/g, s => s.replace(/[^\n]/g, ' '))
    // prose attributes (never expressions)
    .replace(/\b(?:comment|result|description)\s*=\s*"[^"]*"/gi, s => s.replace(/[^\n]/g, ' '))
    // MD string literals inside attribute values: '...'
    .replace(/'[^'\n]*'/g, s => s.replace(/[^\n]/g, ' '));
}

/** Segment types inside a chain. `[...]` list selectors (e.g. distanceto.[$sector, $pos])
 * are dynamic segments like `{...}` — real usage probed from x4_ai_influence's aiscript. */
const SEG_RE = /\.(\$[A-Za-z_]\w*|\{[^}]*\}|\[[^\]]*\]|[A-Za-z_]\w*\??)/y;
const ROOT_RE = /(@?)(\$[A-Za-z_]\w*|[A-Za-z_]\w*)(?=\.(?:[$@{A-Za-z_]))/g;

/** Roots that behave like untyped object references in MD/AIScript context. */
const UNTYPED_ROOTS = new Set(['this', 'parent', 'static', 'namespace']);

/**
 * Lint every `$var.prop…` / `keyword.prop…` chain in MD/AIScript XML text.
 * - `$var` + this/parent/static roots: each identifier segment checked vs the UNION.
 * - non-dynamic keyword roots (event, player, …): FIRST segment checked vs that
 *   keyword's own heads (typed), deeper segments vs the union.
 * - dynamic keyword roots (faction, ware, md, …) and `{…}` / `$var` segments end checking.
 * All findings are warnings (import-generated properties are invisible to the static set).
 */
export function lintScriptPropertyChains(xml: string, index: ScriptPropertyIndex, opts?: { filePath?: string; variableTypes?: Record<string, string> }): ScriptPropertyFinding[] {
  const out: ScriptPropertyFinding[] = [];
  if (!index.loaded) return out;
  const masked = maskNonExpressionSpans(xml);

  ROOT_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = ROOT_RE.exec(masked)) !== null) {
    const rootRaw = m[2];
    const rootLower = rootRaw.toLowerCase();
    const isVar = rootRaw.startsWith('$');
    const keywordEntry = !isVar ? index.model.keywords.get(rootLower) : undefined;

    // decide the mode for the first segment
    let mode: 'typed' | 'union' | 'skip';
    let typedEntry: SPEntry | undefined;
    if (isVar || UNTYPED_ROOTS.has(rootLower)) {
      mode = 'union';
    } else if (keywordEntry) {
      mode = keywordEntry.dynamic || keywordEntry.heads.size === 0 ? 'skip' : 'typed';
      typedEntry = keywordEntry;
    } else {
      mode = 'skip'; // unknown bare identifier root — not a chain we understand
    }

    // walk the segments
    SEG_RE.lastIndex = ROOT_RE.lastIndex;
    let chain = rootRaw;
    let seg: RegExpExecArray | null;
    let first = true;
    // A continuation-required head awaiting its sub-selector (e.g. "controlentity"
    // must be followed by ".default"/".{$controlpost}" — bare use fails in-game).
    let pending: { head: string; at: number; chainAt: string } | null = null;
    while ((seg = SEG_RE.exec(masked)) !== null) {
      const token = seg[1];
      chain += '.' + token;
      const isDynamicSeg = token.startsWith('$') || token.startsWith('{') || token.startsWith('[');
      if (isDynamicSeg) {
        // dynamic segment — satisfies any pending sub-selector; later segments untypable
        pending = null;
        if (mode === 'typed') mode = 'union';
      } else if (mode !== 'skip') {
        const name = token.replace(/\?$/, '').toLowerCase();
        if (!/^\d+$/.test(name)) {
          const prevCont = pending ? index.continuations.get(pending.head) : undefined;
          const isContinuationOfPrev = !!prevCont && (prevCont.has(name) || prevCont.has('*'));
          if (pending && !isContinuationOfPrev) {
            out.push(buildSubselectorFinding(masked, pending.at, pending.chainAt, pending.head, index, opts));
          }
          pending = null;
          if (mode === 'typed' && typedEntry && first) {
            if (!typedEntry.heads.has(name) && !typedEntry.wildcard) {
              out.push(buildFinding(masked, seg.index, chain, token, rootLower, typedEntry.heads, opts));
            }
            mode = 'union';
          } else if (mode === 'union' && !isContinuationOfPrev) {
            if (!index.union.has(name)) {
              out.push(buildFinding(masked, seg.index, chain, token, undefined, index.union, opts));
            }
          }
          // does THIS segment itself require a sub-selector?
          if (index.continuations.has(name) && !index.bareOk.has(name)) {
            pending = { head: name, at: seg.index, chainAt: chain };
          }
        }
      }
      first = false;
      ROOT_RE.lastIndex = SEG_RE.lastIndex;
    }
    // chain ended on a continuation-required head → the AAR's $station.controlentity case
    if (pending && mode !== 'skip') {
      out.push(buildSubselectorFinding(masked, pending.at, pending.chainAt, pending.head, index, opts));
    }
  }
  // Type-aware pass for roots knowable without project-wide data flow: imported
  // keywords (`faction.<id>`) and variables named exactly after a datatype (`$ship`).
  for (const typed of parseExpressionChains(masked)) {
    const root = typed.root.raw;
    const rootName = root.replace(/^\$/, '').toLowerCase();
    const keyword = !root.startsWith('$') ? index.model.keywords.get(rootName) : undefined;
    const suppliedType = root.startsWith('$')
      ? opts?.variableTypes?.[root] || opts?.variableTypes?.[root.toLowerCase()] || opts?.variableTypes?.[rootName]
      : undefined;
    let datatype = suppliedType?.toLowerCase()
      || (root.startsWith('$') && index.model.datatypes.has(rootName) ? rootName : keyword?.dynamicResultType);
    if (!datatype || !index.model.datatypes.has(datatype)) continue;
    const segments = typed.segments.map(segment => ({ value: segment.raw, at: segment.start }));
    let indexInChain = keyword?.dynamic ? 1 : 0; // imported keyword's first segment is its lookup id
    for (; indexInChain < segments.length; indexInChain++) {
      const segment = segments[indexInChain];
      if (/^[{[]/.test(segment.value)) continue;
      const segmentName = segment.value.replace(/\?$/, '').toLowerCase();
      const properties = resolveDatatypeProperties(index.model, datatype);
      const property = properties.find(candidate => propertyHead(candidate.name) === segmentName);
      if (!property) {
        // Variable-name typing is a conservative hint, not proof of runtime type. If
        // the segment exists anywhere in the corpus, retain the legacy union allowance.
        if (root.startsWith('$') && index.union.has(segmentName)) break;
        const chain = `${root}${segments.slice(0, indexInChain + 1).map(value => `.${value.value}`).join('')}`;
        const candidates = properties.map(candidate => propertyHead(candidate.name)).filter(Boolean);
        const finding = buildFinding(masked, segment.at, chain, segment.value, datatype, candidates, opts);
        if (!out.some(existing => existing.code === finding.code && existing.line === finding.line && existing.chain === finding.chain && existing.segment === finding.segment)) out.push(finding);
        break;
      }
      if (/\.\{\$?[A-Za-z_]\w*\}/.test(property.name) && indexInChain + 1 < segments.length) indexInChain++;
      const nextType = property.type.toLowerCase();
      if (!nextType || !index.model.datatypes.has(nextType)) break;
      datatype = nextType;
    }
  }
  return out;
}

function buildSubselectorFinding(masked: string, at: number, chain: string, head: string, index: ScriptPropertyIndex, opts?: { filePath?: string; variableTypes?: Record<string, string> }): ScriptPropertyFinding {
  const line = masked.slice(0, at).split('\n').length;
  const conts = [...(index.continuations.get(head) || [])].map(c => c === '*' ? `{$...}` : c);
  const suggestions = conts.slice(0, 5).map(c => `${head}.${c}`);
  return {
    code: 'scriptproperty.requires_subselector',
    severity: 'warning',
    chain,
    segment: head,
    line,
    suggestions,
    detail: `"${head}" (in ${chain}${opts?.filePath ? `, ${opts.filePath}` : ''}) has no bare form in scriptproperties.xml — it always takes a sub-selector (${suggestions.join(', ')}). Bare use evaluates to nothing in-game with no error (the $station.controlentity failure class).`,
  };
}

function buildFinding(masked: string, at: number, chain: string, segment: string, root: string | undefined, candidates: Iterable<string>, opts?: { filePath?: string; variableTypes?: Record<string, string> }): ScriptPropertyFinding {
  const line = masked.slice(0, at).split('\n').length;
  const clean = segment.replace(/\?$/, '');
  const suggestions = suggestProperties(clean, candidates);
  return {
    code: 'scriptproperty.unknown',
    severity: 'warning',
    chain,
    segment: clean,
    root,
    line,
    suggestions,
    detail: `"${clean}" (in ${chain}${opts?.filePath ? `, ${opts.filePath}` : ''}) is not a known script property${root ? ` of keyword "${root}"` : ''} in the game's scriptproperties.xml — X4 raises no error for unknown properties, the expression just evaluates false/null and the branch silently skips.${suggestions.length ? ` Did you mean: ${suggestions.join(', ')}?` : ''}`,
  };
}

/* ------------------------------------------------------------------ *
 * Oracle — fixtures mirror the PROBED real shapes (unpacked 9.00 data).
 * ------------------------------------------------------------------ */

export const SCRIPT_PROPERTIES_FIXTURE = `<?xml version="1.0" encoding="utf-8"?>
<scriptproperties xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="scriptproperties.xsd">
  <keyword name="event" description="Event data access">
    <property name="name" result="Name of event condition that was met" type="string" />
    <property name="object" result="object according to event documentation" />
    <property name="param" result="param according to event documentation" />
    <property name="param2" result="param2 according to event documentation" />
    <property name="param3" result="param3 according to event documentation" />
  </keyword>
  <keyword name="player" description="Access to player-specific data">
    <property name="name" result="Player name" type="string" />
    <property name="entity" result="Player entity" />
  </keyword>
  <keyword name="faction" description="Faction lookup">
    <import source="common.xsd" select="/xs:schema/xs:simpleType[@name='factionlookup']//xs:enumeration">
      <property name="@value" result="xs:annotation/xs:documentation/text()" type="faction" ignoreprefix="true" />
    </import>
  </keyword>
  <datatype name="component">
    <property name="exists" result="true iff the component exists in the game graph" type="boolean" />
    <property name="isclass.{$class}" result="true iff the component exists and is of the given class" type="boolean" />
    <property name="name" result="component name" type="string" />
    <property name="knownname" result="component name as known to the player" type="string" />
    <property name="tradeblockedreason" result="reason string" type="string" />
  </datatype>
  <datatype name="destructible" type="component">
    <property name="hullpercentage" result="hull" type="integer" />
  </datatype>
  <datatype name="controllable" type="destructible">
    <property name="controlentity.default" result="Main control entity" type="entity" />
    <property name="controlentity.{$controlpost}" result="Control entity of specified control post" type="entity" />
    <property name="buildstorage.default" result="Build storage (literal-only continuation)" />
  </datatype>
  <datatype name="object" type="destructible">
    <property name="isplayerowned" result="true iff owned by the player" type="boolean" />
  </datatype>
  <datatype name="ship" type="object">
    <property name="cargo" result="cargo access" />
  </datatype>
  <datatype name="faction">
    <property name="id" result="Faction ID" type="string" />
    <property name="name" result="Faction name" type="string" />
    <property name="knownname" result="Known faction name" type="string" />
    <property name="relationto.{$faction}" result="Relation to another faction" type="relation" />
  </datatype>
  <datatype name="list">
    <property name="count" result="Number of elements in the list" type="integer" />
    <property name="{$numeric}" result="The numeric-th element in the list (1-based)" />
  </datatype>
</scriptproperties>`;

export function runScriptPropertiesSelftest(): {
  allPassed: boolean; pass: boolean; passed: number; total: number;
  checks: { name: string; pass: boolean; detail?: string }[];
} {
  const checks: { name: string; pass: boolean; detail?: string }[] = [];
  const ok = (name: string, cond: boolean, detail?: unknown) =>
    checks.push({ name, pass: !!cond, detail: detail === undefined ? undefined : (typeof detail === 'string' ? detail : JSON.stringify(detail)) });

  // --- parsing the real shape ---
  const idx = buildScriptPropertyIndex(SCRIPT_PROPERTIES_FIXTURE);
  ok('index loads', idx.loaded);
  ok('parses keywords + datatypes', idx.model.keywords.size === 3 && idx.model.datatypes.size === 7,
    `kw=${idx.model.keywords.size} dt=${idx.model.datatypes.size}`);
  ok('placeholder property indexed by literal head (isclass.{$class} → isclass)',
    idx.model.datatypes.get('component')!.heads.has('isclass'));
  ok('pure-placeholder property marks wildcard ({$numeric} on list)',
    idx.model.datatypes.get('list')!.wildcard);
  ok('import-bearing keyword marked dynamic (faction)',
    idx.model.keywords.get('faction')!.dynamic);
  ok('dynamic import retains result datatype', idx.model.keywords.get('faction')!.dynamicResultType === 'faction');
  ok('datatype inheritance resolves (ship inherits component.exists)',
    resolveDatatypeHeads(idx.model, 'ship').has('exists')
    && resolveDatatypeHeads(idx.model, 'ship').has('hullpercentage')
    && resolveDatatypeHeads(idx.model, 'ship').has('cargo'));
  ok('full inherited property records retain owner', resolveDatatypeProperties(idx.model, 'ship').some(p => p.name === 'exists' && p.owner === 'component' && p.inherited));
  ok('union contains heads from every level', ['exists', 'isplayerowned', 'cargo', 'param2', 'count'].every(h => idx.union.has(h)),
    [...idx.union].join(','));

  // --- the ROADMAP ground-truth cases ---
  const bad = lintScriptPropertyChains('<set_value name="$m" exact="$station.controlentity"/><set_value name="$m2" exact="$station.manager"/>', idx);
  ok('flags $station.controlentity (the real AAR bug)', bad.some(f => f.segment === 'controlentity'), bad.map(f => f.segment).join(','));
  ok('flags $station.manager (the real AAR bug)', bad.some(f => f.segment === 'manager'));
  ok('findings are warnings with the chain + line', bad.every(f => f.severity === 'warning' && f.line === 1 && f.chain.startsWith('$station')));

  const good = lintScriptPropertyChains('<do_if value="$ship.isplayerowned and $ship.cargo.count gt 0"/>', idx);
  ok('valid chains pass ($ship.isplayerowned, $ship.cargo.count)', good.length === 0, good.map(f => f.segment).join(','));

  // --- continuation-required heads (the REAL $station.controlentity failure shape:
  // the property exists, but ONLY as controlentity.default / controlentity.{$controlpost}) ---
  const bare = lintScriptPropertyChains('<set_value name="$m" exact="$station.controlentity"/>', idx);
  ok('flags BARE $station.controlentity (requires_subselector — the exact AAR case)',
    bare.some(f => f.code === 'scriptproperty.requires_subselector' && f.segment === 'controlentity'), JSON.stringify(bare));
  ok('bare-use finding suggests the real forms (controlentity.default)',
    bare[0]?.suggestions.includes('controlentity.default'), JSON.stringify(bare[0]?.suggestions));
  ok('$station.controlentity.default passes',
    lintScriptPropertyChains('<set_value name="$m" exact="$station.controlentity.default"/>', idx).length === 0,
    JSON.stringify(lintScriptPropertyChains('<set_value name="$m" exact="$station.controlentity.default"/>', idx)));
  ok('$station.controlentity.{controlpost.commander} passes (placeholder continuation)',
    lintScriptPropertyChains('<set_value name="$m" exact="$station.controlentity.{controlpost.commander}"/>', idx).length === 0);
  ok('placeholder continuation accepts any selector ($station.controlentity.name passes — {$controlpost} may bind it)',
    lintScriptPropertyChains('<set_value name="$m" exact="$station.controlentity.name"/>', idx).length === 0);
  ok('mid-chain bare use flagged on literal-only head ($station.buildstorage.name)',
    lintScriptPropertyChains('<set_value name="$m" exact="$station.buildstorage.name"/>', idx)
      .some(f => f.code === 'scriptproperty.requires_subselector' && f.segment === 'buildstorage'));
  ok('$station.buildstorage.default passes',
    lintScriptPropertyChains('<set_value name="$m" exact="$station.buildstorage.default"/>', idx).length === 0);
  ok('list-selector continuation satisfies a pending head (distanceto-style .[a, b])',
    lintScriptPropertyChains('<do_if value="$ship.buildstorage.[$targetsector, $position] gt 0"/>', idx).length === 0,
    JSON.stringify(lintScriptPropertyChains('<do_if value="$ship.buildstorage.[$targetsector, $position] gt 0"/>', idx)));

  // --- typed keyword root ---
  const evBad = lintScriptPropertyChains('<set_value name="$d" exact="event.param4"/>', idx);
  ok('typed keyword check flags event.param4', evBad.some(f => f.segment === 'param4' && f.root === 'event'), JSON.stringify(evBad));
  ok('event.param4 suggests param/param2/param3', evBad[0]?.suggestions.some(s => s.startsWith('param')), JSON.stringify(evBad[0]?.suggestions));
  const evGood = lintScriptPropertyChains('<set_value name="$d" exact="event.param3.$key"/>', idx);
  ok('valid event.param3 passes (dynamic tail skipped)', evGood.length === 0, JSON.stringify(evGood));

  // --- dynamic typed roots + false-positive guards ---
  ok('dynamic keyword valid property passes (faction.argon.name)',
    lintScriptPropertyChains('<do_if value="faction.argon.name"/>', idx).length === 0);
  const factionBad = lintScriptPropertyChains('<do_if value="faction.argon.knownnmae"/>', idx);
  ok('dynamic keyword result datatype catches unknown property', factionBad.some(f => f.segment === 'knownnmae' && f.root === 'faction'), JSON.stringify(factionBad));
  ok('dynamic keyword typo has did-you-mean', factionBad.some(f => f.suggestions.includes('knownname')), JSON.stringify(factionBad));
  ok('single-quoted string literals masked',
    lintScriptPropertyChains(`<raise_lua_event name="'ai_influence.chat.fetchmode'"/>`, idx).length === 0);
  ok('comment attributes masked',
    lintScriptPropertyChains('<param name="x" comment="checks this.nonexistent.thing here"/>', idx).length === 0);
  ok('XML comments masked',
    lintScriptPropertyChains('<!-- $obj.bogusprop --> <cue name="A"/>', idx).length === 0);
  ok('placeholder segments skipped ($fac.{$other}.exists checks only literal segs)',
    lintScriptPropertyChains('<do_if value="$fac.{$other}.exists"/>', idx).length === 0);
  ok('nullable suffix handled ($ship.exists? passes)',
    lintScriptPropertyChains('<do_if value="$ship.exists?"/>', idx).length === 0);
  ok('unknown bare roots skipped (md.Script.Cue refs not property chains)',
    lintScriptPropertyChains('<signal_cue cue="md.SomeScript.SomeCue"/>', idx).length === 0);

  // --- suggestions quality ---
  const sug = suggestProperties('knowname', idx.union);
  ok('suggestion finds near-miss (knowname → knownname)', sug.includes('knownname'), sug.join(','));

  // --- degradation ---
  ok('garbage input degrades to empty model', !buildScriptPropertyIndex('<not-scriptproperties/>').loaded);
  ok('empty input degrades', !buildScriptPropertyIndex('').loaded && lintScriptPropertyChains('x', buildScriptPropertyIndex('')).length === 0);

  const passed = checks.filter(c => c.pass).length;
  const allPassed = passed === checks.length;
  return { allPassed, pass: allPassed, passed, total: checks.length, checks };
}
