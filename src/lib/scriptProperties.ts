/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Scriptproperty validation — the ROADMAP "TOOL GAP" (AAR, 2026-06-27).
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
 * Honesty scope (determinism doctrine): `$var` roots are UNTYPED in MD, so traversal
 * retains every authoritative datatype/path candidate and accepts a chain only when a
 * candidate survives each literal segment. Typed first-segment checks apply to
 * non-dynamic KEYWORD roots (`event.`, `player.`, …) where the root is unambiguous.
 * Everything is a warning, never an error: absence from the parsed set can mean an
 * `<import>`-generated property, so we never claim certainty we don't have.
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
  /** Complete normalized authored path, retained for ordered traversal. */
  path?: string[];
}

export interface ScriptPropertyModel {
  keywords: Map<string, SPEntry>;
  datatypes: Map<string, SPEntry>;
  parsedProperties: number;
}

export interface ScriptPropertyPathIndex {
  keywords: Map<string, ResolvedScriptProperty[]>;
  datatypes: Map<string, ResolvedScriptProperty[]>;
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
  /** Complete normalized authored paths by keyword/datatype, including inherited datatype paths. */
  pathProperties?: ScriptPropertyPathIndex;
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
  /** Project-relative source file so editor diagnostics land in the correct buffer. */
  filePath?: string;
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

function normalizedPropertyPath(name: string): string[] {
  return String(name || '')
    .split('.')
    .map(segment => segment.replace(/\?$/, '').trim().toLowerCase())
    .filter(Boolean);
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
      out.push({ ...property, owner: current.name, inherited, path: normalizedPropertyPath(property.name) });
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
  const pathProperties: ScriptPropertyPathIndex = {
    keywords: new Map<string, ResolvedScriptProperty[]>(),
    datatypes: new Map<string, ResolvedScriptProperty[]>(),
  };
  for (const entry of model.keywords.values()) {
    pathProperties.keywords.set(entry.name, entry.properties.map(property => ({
      ...property,
      owner: entry.name,
      inherited: false,
      path: normalizedPropertyPath(property.name),
    })));
  }
  for (const entry of model.datatypes.values()) {
    pathProperties.datatypes.set(entry.name, resolveDatatypeProperties(model, entry.name));
  }
  return { model, union, docs, bareOk, continuations, pathProperties, loaded: union.size > 0 };
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

/** Roots that behave like untyped object references in MD/AIScript context. */
const UNTYPED_ROOTS = new Set(['this', 'parent', 'static', 'namespace']);

type PathContextKind = 'keyword' | 'datatype';

interface PathContext {
  kind: PathContextKind;
  name: string;
}

interface PathAnchor {
  head: string;
  at: number;
  chainAt: string;
}

interface PlaceholderLiteralMatch {
  segment: string;
  at: number;
  chainAt: string;
}

type PathState =
  | { kind: 'context'; context: PathContext }
  | {
    kind: 'pending';
    remaining: string[];
    property: ResolvedScriptProperty;
    anchor: PathAnchor;
    requiresSubselector: boolean;
    placeholderLiteral?: PlaceholderLiteralMatch;
  }
  | { kind: 'complete'; property: ResolvedScriptProperty }
  | { kind: 'opaque'; property?: ResolvedScriptProperty };

function normalizedPathSegment(segment: string): string {
  return String(segment || '').replace(/\?$/, '').trim().toLowerCase();
}

function pathForProperty(property: ResolvedScriptProperty): string[] {
  return property.path?.length ? property.path : normalizedPropertyPath(property.name);
}

function isAuthoredPlaceholder(segment: string): boolean {
  return /^\{[^}]*\}$/.test(segment) || /^<[^>]+>$/.test(segment);
}

function pathHeadMatches(expected: string, actual: { kind: string; name: string }): boolean {
  if (actual.kind !== 'property') return isAuthoredPlaceholder(expected);
  // A placeholder at the start of a candidate cannot validate an arbitrary
  // literal on an untyped root. Placeholder literals become conservative only
  // after a literal head has grounded the authored path.
  if (isAuthoredPlaceholder(expected)) return false;
  return normalizedPathSegment(expected) === actual.name;
}

function pathContinuationMatches(expected: string, actual: { kind: string; name: string }): boolean {
  // Dynamic/list/variable selectors conservatively satisfy an authored pending
  // continuation. An unbraced literal can also bind an authored placeholder,
  // but its selector domain is not certified by this engine.
  if (actual.kind !== 'property' || isAuthoredPlaceholder(expected)) return true;
  return normalizedPathSegment(expected) === actual.name;
}

function pathPropertiesForContext(index: ScriptPropertyIndex, context: PathContext): ResolvedScriptProperty[] {
  const cached = context.kind === 'keyword'
    ? index.pathProperties?.keywords.get(context.name)
    : index.pathProperties?.datatypes.get(context.name);
  if (cached) return cached;
  if (context.kind === 'keyword') {
    const entry = index.model.keywords.get(context.name);
    return entry ? entry.properties.map(property => ({
      ...property,
      owner: entry.name,
      inherited: false,
      path: normalizedPropertyPath(property.name),
    })) : [];
  }
  return resolveDatatypeProperties(index.model, context.name);
}

function allPathContexts(index: ScriptPropertyIndex): PathContext[] {
  return [...index.model.datatypes.keys()].sort().map(name => ({ kind: 'datatype' as const, name }));
}

function pathStateKey(state: PathState): string {
  if (state.kind === 'context') return `context:${state.context.kind}:${state.context.name}`;
  if (state.kind === 'pending') {
    return `pending:${state.property.name.toLowerCase()}:${state.property.type.toLowerCase()}:${state.remaining.join('.')}:${state.anchor.head}:${state.requiresSubselector}:${state.placeholderLiteral?.segment || ''}`;
  }
  if (state.kind === 'opaque') {
    return `opaque:${state.property?.owner || ''}:${state.property?.name.toLowerCase() || ''}:${state.property?.type.toLowerCase() || ''}`;
  }
  return `complete:${state.property.name.toLowerCase()}:${state.property.type.toLowerCase()}`;
}

function dedupePathStates(states: PathState[]): PathState[] {
  const seen = new Set<string>();
  const out: PathState[] = [];
  for (const state of states) {
    const key = pathStateKey(state);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(state);
  }
  return out;
}

function statesAfterProperty(
  index: ScriptPropertyIndex,
  property: ResolvedScriptProperty,
  remaining: string[],
  anchor: PathAnchor,
  requiresSubselector: boolean,
  placeholderLiteral?: PlaceholderLiteralMatch,
): PathState[] {
  if (remaining.length) {
    return [{ kind: 'pending', remaining, property, anchor, requiresSubselector, placeholderLiteral }];
  }
  const nextType = String(property.type || '').trim().toLowerCase();
  if (nextType && index.model.datatypes.has(nextType)) {
    return [{ kind: 'context', context: { kind: 'datatype', name: nextType } }];
  }
  // The authored property is complete, but an empty or unavailable return type
  // cannot support deterministic checking of any later segment.
  return [{ kind: 'complete', property }, { kind: 'opaque', property }];
}

function advancePathStates(
  index: ScriptPropertyIndex,
  states: PathState[],
  segment: { kind: string; name: string },
  chainAt: string,
  at: number,
): PathState[] {
  const next: PathState[] = [];
  for (const state of states) {
    if (state.kind === 'opaque') {
      next.push(state);
      continue;
    }
    if (state.kind === 'context') {
      const contextProperties = pathPropertiesForContext(index, state.context);
      for (const property of contextProperties) {
        const path = pathForProperty(property);
        if (!path.length || !pathHeadMatches(path[0], segment)) continue;
        const head = propertyHead(property.name) || normalizedPathSegment(path[0]);
        const hasBareForm = contextProperties.some(candidate => {
          const candidatePath = pathForProperty(candidate);
          return candidatePath.length === 1
            && !isAuthoredPlaceholder(candidatePath[0])
            && normalizedPathSegment(candidatePath[0]) === normalizedPathSegment(path[0]);
        });
        next.push(...statesAfterProperty(index, property, path.slice(1), { head, at, chainAt }, !hasBareForm));
      }
      continue;
    }
    if (state.kind === 'pending' && state.remaining.length && pathContinuationMatches(state.remaining[0], segment)) {
      const placeholderLiteral = segment.kind === 'property' && isAuthoredPlaceholder(state.remaining[0])
        ? { segment: segment.name, at, chainAt }
        : state.placeholderLiteral;
      next.push(...statesAfterProperty(
        index,
        state.property,
        state.remaining.slice(1),
        state.anchor,
        state.requiresSubselector,
        placeholderLiteral,
      ));
    }
  }
  return dedupePathStates(next);
}

function pendingPathState(states: PathState[]): Extract<PathState, { kind: 'pending' }> | undefined {
  return states
    .filter((state): state is Extract<PathState, { kind: 'pending' }> => state.kind === 'pending')
    .sort((a, b) => Number(b.requiresSubselector) - Number(a.requiresSubselector)
      || a.anchor.at - b.anchor.at || a.anchor.head.localeCompare(b.anchor.head))[0];
}

function candidateHeads(index: ScriptPropertyIndex, states: PathState[]): Set<string> {
  const heads = new Set<string>();
  for (const state of states) {
    if (state.kind === 'pending') {
      const next = state.remaining[0];
      if (next && !isAuthoredPlaceholder(next)) heads.add(normalizedPathSegment(next));
      continue;
    }
    if (state.kind !== 'context') continue;
    for (const property of pathPropertiesForContext(index, state.context)) {
      const path = pathForProperty(property);
      const head = path[0];
      if (head && !isAuthoredPlaceholder(head)) heads.add(normalizedPathSegment(head));
    }
  }
  return heads.size ? heads : new Set(index.union);
}

function pushFinding(out: ScriptPropertyFinding[], finding: ScriptPropertyFinding): void {
  if (out.some(existing => existing.code === finding.code
    && existing.line === finding.line
    && existing.chain === finding.chain
    && existing.segment === finding.segment)) return;
  out.push(finding);
}

function knownVariableDatatype(
  root: string,
  index: ScriptPropertyIndex,
  opts?: { variableTypes?: Record<string, string> },
): string | undefined {
  if (!root.startsWith('$')) return undefined;
  const rootName = root.slice(1).toLowerCase();
  const supplied = opts?.variableTypes?.[root]
    || opts?.variableTypes?.[root.toLowerCase()]
    || opts?.variableTypes?.[rootName];
  const candidate = String(supplied || (index.model.datatypes.has(rootName) ? rootName : '')).toLowerCase();
  return candidate && index.model.datatypes.has(candidate) ? candidate : undefined;
}

function variablePathContexts(
  root: string,
  index: ScriptPropertyIndex,
  opts?: { variableTypes?: Record<string, string> },
): PathContext[] {
  const contexts = allPathContexts(index);
  const preferred = knownVariableDatatype(root, index, opts);
  if (!preferred) return contexts;
  return [
    { kind: 'datatype', name: preferred },
    ...contexts.filter(context => context.name !== preferred),
  ];
}

/**
 * Lint every `$var.prop…` / `keyword.prop…` chain in MD/AIScript XML text.
 * - untyped variable roots retain all datatype/path candidates and traverse them in order;
 * - non-dynamic keyword roots use that keyword's own authored paths;
 * - dynamic keyword roots skip the lookup selector and use its declared result datatype;
 * - actual dynamic/list/variable selectors remain conservative and can satisfy a pending path.
 * All findings are warnings (import-generated properties are invisible to the static set).
 */
export function lintScriptPropertyChains(xml: string, index: ScriptPropertyIndex, opts?: { filePath?: string; variableTypes?: Record<string, string> }): ScriptPropertyFinding[] {
  const out: ScriptPropertyFinding[] = [];
  if (!index.loaded) return out;
  const masked = maskNonExpressionSpans(xml);
  for (const parsed of parseExpressionChains(masked)) {
    const rootRaw = parsed.root.raw;
    const rootLower = rootRaw.toLowerCase();
    const isVar = rootRaw.startsWith('$');
    const keywordEntry = !isVar ? index.model.keywords.get(rootLower) : undefined;
    let states: PathState[];
    let firstSegment = 0;
    let findingRoot: string | undefined;

    if (isVar || UNTYPED_ROOTS.has(rootLower)) {
      states = variablePathContexts(rootRaw, index, opts)
        .map(context => ({ kind: 'context' as const, context }));
    } else if (!keywordEntry) {
      continue; // unknown bare identifier roots are not property chains we understand
    } else if (keywordEntry.dynamic) {
      const datatype = String(keywordEntry.dynamicResultType || '').toLowerCase();
      if (!datatype || !index.model.datatypes.has(datatype)) continue;
      // The first segment is the imported lookup id (faction.argon / ware.energycells).
      firstSegment = 1;
      states = [{ kind: 'context', context: { kind: 'datatype', name: datatype } }];
      findingRoot = rootLower;
    } else if (!keywordEntry.heads.size) {
      continue;
    } else {
      states = [{ kind: 'context', context: { kind: 'keyword', name: rootLower } }];
      findingRoot = rootLower;
    }

    let chain = rootRaw + parsed.segments.slice(0, firstSegment).map(segment => `.${segment.raw}`).join('');
    let stopQuietly = false;
    for (let segmentIndex = firstSegment; segmentIndex < parsed.segments.length; segmentIndex++) {
      const segment = parsed.segments[segmentIndex];
      chain += `.${segment.raw}`;
      const isDynamic = segment.kind !== 'property';
      const nextStates = advancePathStates(index, states, segment, chain, segment.start);

      if (isDynamic) {
        // Without an authored placeholder/pending continuation, an actual
        // selector makes the remaining result unavailable rather than invalid.
        // If it consumed only part of a multi-token authored path, the selector
        // still leaves the return type unavailable; a completed path with a
        // known datatype remains a context and is checked normally.
        states = nextStates.length
          ? dedupePathStates(nextStates.map(state => state.kind === 'pending'
            ? { kind: 'opaque' as const, property: state.property }
            : state))
          : [{ kind: 'opaque' }];
        continue;
      }

      if (!nextStates.length) {
        const pending = pendingPathState(states);
        const hasUsableDatatypeContext = states.some(state => state.kind === 'context'
          && pathPropertiesForContext(index, state.context).length > 0);
        if (pending?.placeholderLiteral) {
          pushFinding(out, buildFinding(masked, segment.start, chain, segment.raw, findingRoot, candidateHeads(index, states), opts));
        } else if (pending?.requiresSubselector && !hasUsableDatatypeContext) {
          pushFinding(out, buildSubselectorFinding(masked, pending.anchor.at, pending.anchor.chainAt, pending.anchor.head, index, opts));
        } else {
          pushFinding(out, buildFinding(masked, segment.start, chain, segment.raw, findingRoot, candidateHeads(index, states), opts));
        }
        stopQuietly = true;
        break;
      }
      states = nextStates;
    }

    if (stopQuietly) continue;
    if (states.some(state => state.kind === 'context' || state.kind === 'complete' || state.kind === 'opaque')) continue;
    const pending = pendingPathState(states);
    if (pending) {
      if (pending.placeholderLiteral) {
        pushFinding(out, buildFinding(
          masked,
          pending.placeholderLiteral.at,
          pending.placeholderLiteral.chainAt,
          pending.placeholderLiteral.segment,
          findingRoot,
          candidateHeads(index, states),
          opts,
        ));
      } else {
        pushFinding(out, buildSubselectorFinding(masked, pending.anchor.at, pending.anchor.chainAt, pending.anchor.head, index, opts));
      }
    }
  }
  return out;
}

function buildSubselectorFinding(masked: string, at: number, chain: string, head: string, index: ScriptPropertyIndex, opts?: { filePath?: string; variableTypes?: Record<string, string> }): ScriptPropertyFinding {
  const line = masked.slice(0, at).split('\n').length;
  const conts = [...(index.continuations.get(head) || [])]
    .sort((a, b) => (a === '*' ? 1 : b === '*' ? -1 : a.localeCompare(b)))
    .map(c => c === '*' ? `{$...}` : c);
  const suggestions = [...new Set(conts.map(c => `${head}.${c}`))].slice(0, 8);
  const location = `${chain}${opts?.filePath ? `, ${opts.filePath}` : ''}`;
  const detail = index.bareOk.has(head)
    ? `"${head}" (in ${location}) has a bare form on another datatype, but the matching path requires a sub-selector (${suggestions.join(', ')}). The supplied continuation is not valid for that path.`
    : `"${head}" (in ${location}) has no bare form in scriptproperties.xml — it always takes a sub-selector (${suggestions.join(', ')}). Bare use evaluates to nothing in-game with no error (the $station.controlentity failure class).`;
  return {
    code: 'scriptproperty.requires_subselector',
    severity: 'warning',
    chain,
    segment: head,
    filePath: opts?.filePath,
    line,
    suggestions,
    detail,
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
    filePath: opts?.filePath,
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
    <property name="containercargo" result="Container cargo fixture" type="containercargolist" />
    <property name="opaquereturn" result="Result type unavailable" />
    <property name="deferredselector.{$value}.name" result="Selector continuation unavailable" type="string" />
    <property name="terminalselector.{$value}" result="Known terminal selector" type="terminal" />
    <property name="name" result="component name" type="string" />
    <property name="knownname" result="component name as known to the player" type="string" />
    <property name="tradeblockedreason" result="reason string" type="string" />
  </datatype>
  <datatype name="destructible" type="component">
    <property name="hullpercentage" result="hull" type="integer" />
  </datatype>
  <datatype name="controllable" type="object">
    <property name="controlentity.default" result="Main control entity" type="entity" />
    <property name="controlentity.{$controlpost}" result="Control entity of specified control post" type="entity" />
    <property name="buildstorage.default" result="Build storage (literal-only continuation)" />
  </datatype>
  <datatype name="object" type="destructible">
    <property name="isplayerowned" result="true iff owned by the player" type="boolean" />
  </datatype>
  <datatype name="ship" type="controllable">
    <property name="cargo" result="cargo access" type="containercargolist" />
  </datatype>
  <datatype name="container" type="component">
    <property name="cargo" result="cargo access" type="containercargolist" />
  </datatype>
  <datatype name="storagemodule" type="component">
    <property name="cargo" result="cargo access" type="modulecargolist" />
  </datatype>
  <datatype name="wareamountlist" type="list">
    <property name="random" result="Random ware" type="string" />
  </datatype>
  <datatype name="cargolist" type="wareamountlist">
    <property name="{$ware}.free" result="Amount of ware that can be added to the cargo" type="integer" />
  </datatype>
  <datatype name="containercargolist" type="cargolist">
    <property name="free.all" result="Total free cargo volume remaining" type="largeint" />
    <property name="free.condensate" result="Free condensate cargo volume" type="largeint" />
    <property name="free.container" result="Free container cargo volume" type="largeint" />
    <property name="free.liquid" result="Free liquid cargo volume" type="largeint" />
    <property name="free.solid" result="Free solid cargo volume" type="largeint" />
    <property name="free.universal" result="Free universal cargo volume" type="largeint" />
    <property name="free.{$tag}" result="Free cargo volume for the specified tag" type="largeint" />
  </datatype>
  <datatype name="modulecargolist" type="cargolist">
    <property name="free" result="Total free cargo volume remaining" type="integer" />
  </datatype>
  <datatype name="terminal" />
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
  ok('parses keywords + datatypes', idx.model.keywords.size === 3 && idx.model.datatypes.size === 14,
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
  ok('nested authored paths retain order and datatype transitions',
    resolveDatatypeProperties(idx.model, 'container').some(p => p.name === 'cargo'
      && p.path?.join('.') === 'cargo' && p.type === 'containercargolist')
    && resolveDatatypeProperties(idx.model, 'storagemodule').some(p => p.name === 'cargo'
      && p.path?.join('.') === 'cargo' && p.type === 'modulecargolist'));
  const containerCargoPaths = resolveDatatypeProperties(idx.model, 'containercargolist');
  ok('cargolist inheritance and free paths are indexed',
    containerCargoPaths.some(p => p.name === '{$ware}.free' && p.inherited)
    && ['free.all', 'free.solid', 'free.container', 'free.liquid', 'free.universal', 'free.condensate', 'free.{$tag}']
      .every(name => containerCargoPaths.some(p => p.name === name && p.path?.join('.') === name)));
  ok('union contains heads from every level', ['exists', 'isplayerowned', 'cargo', 'param2', 'count'].every(h => idx.union.has(h)),
    [...idx.union].join(','));
  const untypedKeywordOnly = lintScriptPropertyChains('<do_if value="$obj.param2"/>', idx);
  ok('untyped variables exclude keyword-only paths ($obj.param2)',
    untypedKeywordOnly.length === 1
    && untypedKeywordOnly[0].code === 'scriptproperty.unknown'
    && untypedKeywordOnly[0].segment === 'param2', JSON.stringify(untypedKeywordOnly));

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
    bare[0]?.suggestions.includes('controlentity.default')
    && bare[0]?.detail.includes('has no bare form in scriptproperties.xml'), JSON.stringify(bare[0]));
  ok('$station.controlentity.default passes',
    lintScriptPropertyChains('<set_value name="$m" exact="$station.controlentity.default"/>', idx).length === 0,
    JSON.stringify(lintScriptPropertyChains('<set_value name="$m" exact="$station.controlentity.default"/>', idx)));
  ok('$station.controlentity.{controlpost.commander} passes (placeholder continuation)',
    lintScriptPropertyChains('<set_value name="$m" exact="$station.controlentity.{controlpost.commander}"/>', idx).length === 0);
  const controlName = lintScriptPropertyChains('<set_value name="$m" exact="$station.controlentity.name"/>', idx);
  ok('$station.controlentity.name is conservative when the placeholder domain is unavailable',
    controlName.length === 0, JSON.stringify(controlName));
  ok('mid-chain bare use flagged on literal-only head ($station.buildstorage.name)',
    lintScriptPropertyChains('<set_value name="$m" exact="$station.buildstorage.name"/>', idx)
      .some(f => f.code === 'scriptproperty.requires_subselector' && f.segment === 'buildstorage'));
  ok('$station.buildstorage.default passes',
    lintScriptPropertyChains('<set_value name="$m" exact="$station.buildstorage.default"/>', idx).length === 0);
  ok('list-selector continuation satisfies a pending head (distanceto-style .[a, b])',
    lintScriptPropertyChains('<do_if value="$ship.buildstorage.[$targetsector, $position] gt 0"/>', idx).length === 0,
    JSON.stringify(lintScriptPropertyChains('<do_if value="$ship.buildstorage.[$targetsector, $position] gt 0"/>', idx)));

  // --- nested cargo paths and location-sensitive refusals ---
  const cargo = (expression: string) => lintScriptPropertyChains(`<do_if value="${expression}"/>`, idx);
  for (const expression of [
    '$pship2.cargo.free',
    '$pship2.cargo.free.all?',
    '$pship2.cargo.free.all',
    '$nsh.cargo.free.all',
    '$pship2.cargo.free.solid',
    '$pship2.cargo.free.{event.param.transporttag}',
  ]) {
    ok(`${expression} passes`, cargo(expression).length === 0, JSON.stringify(cargo(expression)));
  }
  const freeNotReal = cargo('$pship2.cargo.free.notreal');
  ok('$pship2.cargo.free.notreal is conservative when the placeholder domain is unavailable',
    freeNotReal.length === 0, JSON.stringify(freeNotReal));
  const bareContainerFree = cargo('$holder.containercargo.free');
  ok('bare free still requires a continuation on a known containercargolist path',
    bareContainerFree.length === 1
    && bareContainerFree[0].code === 'scriptproperty.requires_subselector'
    && bareContainerFree[0].segment === 'free', JSON.stringify(bareContainerFree));
  ok('free continuation suggestions retain every literal cargo selector',
    bareContainerFree[0]?.suggestions.length <= 8
    && ['all', 'solid', 'container', 'liquid', 'universal', 'condensate']
      .every(name => bareContainerFree[0]?.suggestions.includes(`free.${name}`)), JSON.stringify(bareContainerFree[0]?.suggestions));
  ok('free refusal detail is path-specific despite a globally bare form',
    bareContainerFree[0]?.detail.includes('matching path requires a sub-selector')
    && !bareContainerFree[0]?.detail.includes('has no bare form in scriptproperties.xml'), JSON.stringify(bareContainerFree[0]?.detail));
  const cargoNotReal = cargo('$pship2.cargo.notreal');
  ok('$pship2.cargo.notreal is unknown at notreal',
    cargoNotReal.length === 1
    && cargoNotReal[0].code === 'scriptproperty.unknown'
    && cargoNotReal[0].segment === 'notreal', JSON.stringify(cargoNotReal));
  const cargoHull = cargo('$pship2.cargo.hullpercentage');
  ok('$pship2.cargo.hullpercentage is location-sensitive unknown',
    cargoHull.length === 1
    && cargoHull[0].code === 'scriptproperty.unknown'
    && cargoHull[0].segment === 'hullpercentage', JSON.stringify(cargoHull));

  for (const expression of [
    '$fc.isclass.ship_xl',
    '$fc.isclass.ship_s',
    '$fc.isclass.sector',
    '$sb.isclass.ship_s',
  ]) {
    ok(`${expression} accepts an unbraced placeholder continuation`,
      cargo(expression).length === 0, JSON.stringify(cargo(expression)));
  }
  ok('$destination.{1}.isclass.sector becomes opaque after an ungrounded selector',
    cargo('$destination.{1}.isclass.sector').length === 0,
    JSON.stringify(cargo('$destination.{1}.isclass.sector')));
  ok('a selector that only partly consumes an authored path becomes opaque',
    cargo('$ship.deferredselector.{nested.value}').length === 0,
    JSON.stringify(cargo('$ship.deferredselector.{nested.value}')));
  ok('a wrong variable type hint does not hide a valid list.count path',
    lintScriptPropertyChains('<do_if value="$Foes.count"/>', idx, { variableTypes: { '$Foes': 'ship' } }).length === 0,
    JSON.stringify(lintScriptPropertyChains('<do_if value="$Foes.count"/>', idx, { variableTypes: { '$Foes': 'ship' } })));
  ok('an unavailable declared result leaves later segments unchecked',
    cargo('$ship.opaquereturn.notreal').length === 0,
    JSON.stringify(cargo('$ship.opaquereturn.notreal')));
  const knownTerminal = cargo('$ship.terminalselector.{fixture.value}.notreal');
  ok('a known terminal datatype still rejects an impossible continuation',
    knownTerminal.length === 1
    && knownTerminal[0].code === 'scriptproperty.unknown'
    && knownTerminal[0].segment === 'notreal', JSON.stringify(knownTerminal));

  // --- typed keyword root ---
  const evBad = lintScriptPropertyChains('<set_value name="$d" exact="event.param4"/>', idx);
  ok('typed keyword check flags event.param4', evBad.some(f => f.segment === 'param4' && f.root === 'event'), JSON.stringify(evBad));
  ok('event.param4 suggests param/param2/param3', evBad[0]?.suggestions.some(s => s.startsWith('param')), JSON.stringify(evBad[0]?.suggestions));
  const evGood = lintScriptPropertyChains('<set_value name="$d" exact="event.param3.$key"/>', idx);
  ok('valid event.param3 passes (dynamic tail skipped)', evGood.length === 0, JSON.stringify(evGood));
  const eventObject = lintScriptPropertyChains('<do_if value="event.object.owner.knownname"/>', idx);
  ok('event.object unavailable return leaves owner.knownname unchecked',
    eventObject.length === 0, JSON.stringify(eventObject));

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
