/**
 * schemaRouting.ts — B46 Phase 2 (2026-07-16): file→schema routing.
 *
 * Routes each project/emitted file to the game schema that actually governs it, using the
 * B46 Phase 1 registry (schemaRegistry.ts) for domain discovery + include chains. Scope is
 * Ken's modding-relevant SUBSET only (plan: docs/plans/2026-07-15-full-corpus-validation.md):
 *   libraries/factions.xml → factions.xsd  ·  libraries/gamestarts.xml → gamestarts.xsd
 *   libraries/wares.xml, jobs.xml → libraries.xsd  ·  ui XML (root addon/coreaddon) →
 *   ui/core/addon.xsd / coreaddon.xsd  ·  t/*.xml → structural page/entry lint (the game
 *   ships NO t-file XSD — grounded against the unpacked 9.00 tree, 2026-07-16)  ·  any
 *   routed file with root <diff> → MERGED index (diff.xsd chain + domain chain), so both the
 *   patch wrapper and the payload vocabulary are legal. Plain md/ and aiscripts/ documents remain
 *   owned by their existing handlers; their diff-rooted patches use this merged path. The ~29
 *   niche domains remain UNROUTED.
 *
 * Cry-wolf gate (the #1 historical failure mode of this surface): findings for a domain that
 * has not been corpus-proven zero-false-positive against the unpacked vanilla game are
 * severity-capped to WARNING. Promote a domain into CORPUS_PROVEN_DOMAINS only with recorded
 * corpus evidence (see the B46 Phase 2 ROADMAP close).
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { buildSchemaIndex, validateXmlAgainstSchema, type SchemaIndex, type XsdDiagnostic } from './xsdValidate';
import type { SchemaRegistry, SchemaDomainInfo } from './schemaRegistry';

export interface SchemaRoute {
  /** 'schema' = validate against a registry domain; 'tfile' = structural page/entry lint */
  kind: 'schema' | 'tfile';
  /** registry domain key (basename sans .xsd) when kind === 'schema' */
  domain?: string;
  /** 'diff' = the file is a <diff> patch document; index is merged diff+domain */
  wrapper: 'plain' | 'diff';
  rootElement: string | null;
}

export interface RoutedFileResult {
  path: string;
  route: SchemaRoute;
  /** false when the registry has no schema for the routed domain (honest degrade, no findings) */
  domainAvailable: boolean;
  /** true when findings were severity-capped because the domain is not corpus-proven */
  severityCapped: boolean;
  findings: XsdDiagnostic[];
}

/**
 * Domains proven zero-false-positive against the unpacked vanilla corpus. A domain outside
 * this set reports every finding as WARNING regardless of its natural severity.
 * Populated ONLY from a recorded corpus run — never by assumption.
 *
 * Evidence (B46 Phase 2 corpus sweep vs `X4 unpacked 9.00`, base + 21 DLC roots, 2026-07-16,
 * ROADMAP close): 124 routed vanilla files → 0 findings. factions 1 plain + 5 diff ·
 * gamestarts 1 plain + 6 diff · addon 11 plain · diff wrapper 37 instances (incl. 11
 * wrapper-only wares/jobs patches) · t structural lint 74 files clean.
 * NOT proven: coreaddon (zero instances exist in the vanilla corpus) — stays warning-capped.
 */
export const CORPUS_PROVEN_DOMAINS = new Set<string>(['factions', 'gamestarts', 'addon', 'diff']);

/**
 * libraries/<basename> → registry domain (the modding-relevant subset).
 * CORPUS-FALSIFIED (2026-07-16): wares.xml/jobs.xml must NOT route to libraries.xsd — the
 * vanilla files produce 26,835 findings against it (its <ware>/<production> declarations
 * govern a different usage; the game ships no schema for wares/jobs content). They map to
 * null here; diff-rooted wares/jobs patches still get wrapper-only diff.xsd validation.
 */
const LIBRARY_BASENAME_DOMAINS: Record<string, string | null> = {
  'factions.xml': 'factions',
  'gamestarts.xml': 'gamestarts',
  'wares.xml': null,
  'jobs.xml': null,
};

/** First real element name in the document (comments/PIs/doctype stripped). */
export function sniffRootElement(xml: string): string | null {
  const head = String(xml || '').slice(0, 16384).replace(/<!--[\s\S]*?-->/g, '');
  const m = /<(?!\?|!)([A-Za-z_][\w.:-]*)/.exec(head);
  return m ? m[1].toLowerCase() : null;
}

/**
 * Route one file. Returns null for everything outside the subset — plain md/, plain aiscripts/,
 * content.xml, unknown library basenames, ui files with unrecognized roots, niche domains.
 */
export function routeProjectFile(filePath: string, xml: string): SchemaRoute | null {
  const p = String(filePath || '').replace(/\\/g, '/').toLowerCase();
  if (!p.endsWith('.xml')) return null;
  if (p === 'content.xml' || p.endsWith('/content.xml')) return null;

  const root = sniffRootElement(xml);
  const wrapper: SchemaRoute['wrapper'] = root === 'diff' ? 'diff' : 'plain';

  // Plain md/ and aiscripts/ documents are owned by the dedicated validators. A diff patch
  // still needs the shared wrapper+payload index so its <add>/<replace>/<remove> selectors
  // and script payload vocabulary are checked together exactly once.
  const scriptMatch = /(^|\/)(md|aiscripts)\//.exec(p);
  if (scriptMatch) {
    if (wrapper !== 'diff') return null;
    return {
      kind: 'schema',
      domain: scriptMatch[2] === 'md' ? 'md' : 'aiscripts',
      wrapper,
      rootElement: root,
    };
  }

  if (/(^|\/)t\/[^/]+\.xml$/.test(p)) {
    return { kind: 'tfile', wrapper, rootElement: root };
  }

  const libMatch = /(^|\/)libraries\/([^/]+\.xml)$/.exec(p);
  if (libMatch) {
    if (!(libMatch[2] in LIBRARY_BASENAME_DOMAINS)) return null; // niche domains stay unrouted
    const domain = LIBRARY_BASENAME_DOMAINS[libMatch[2]];
    if (domain) return { kind: 'schema', domain, wrapper, rootElement: root };
    // No content schema exists (wares/jobs) — validate the <diff> wrapper only.
    return wrapper === 'diff' ? { kind: 'schema', domain: 'diff', wrapper, rootElement: root } : null;
  }

  if (/(^|\/)ui\/.+\.xml$/.test(p)) {
    if (root === 'addon') return { kind: 'schema', domain: 'addon', wrapper, rootElement: root };
    if (root === 'coreaddon') return { kind: 'schema', domain: 'coreaddon', wrapper, rootElement: root };
    // A ui diff patch can't name its target root — validate the wrapper + both ui vocabularies.
    if (root === 'diff') return { kind: 'schema', domain: 'addon', wrapper, rootElement: root };
    return null;
  }

  return null;
}

/** Build the (cached-by-path-set) index for a route: domain chain, plus diff chain when wrapped. */
function buildRouteIndex(route: SchemaRoute, byDomain: Map<string, SchemaDomainInfo>): SchemaIndex | null {
  const paths: string[] = [];
  const add = (info?: SchemaDomainInfo) => { if (info) paths.push(info.path, ...info.includes); };
  if (route.wrapper === 'diff') add(byDomain.get('diff'));
  add(route.domain ? byDomain.get(route.domain) : undefined);
  // ui diff patches: include both addon vocabularies (payload target is unknowable from the root).
  if (route.wrapper === 'diff' && route.domain === 'addon') add(byDomain.get('coreaddon'));
  if (!paths.length) return null;
  try {
    const index = buildSchemaIndex(Array.from(new Set(paths)));
    return index.loaded && index.elements.size > 0 ? index : null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ *
 * t-file structural lint (no game XSD exists for t/*.xml).
 * Warnings only — structure facts grounded against the vanilla corpus.
 * ------------------------------------------------------------------ */

export function lintTFileStructure(xml: string, filePath?: string): XsdDiagnostic[] {
  const out: XsdDiagnostic[] = [];
  const warn = (line: number, code: string, sourceRef: string, message: string) =>
    out.push({ severity: 'warning', domain: 't', filePath, line, sourceRef, code, message });

  const root = sniffRootElement(xml);
  if (root === 'diff') return out; // a t diff patch is validated by the diff route, not here
  if (root !== 'language') {
    warn(1, 'TFILE_ROOT', root || '(none)', `t-file root element is <${root || '?'}> — the game expects <language id="…"> (see vanilla t/0001-l044.xml).`);
    return out;
  }

  const text = String(xml || '').replace(/<!--[\s\S]*?-->/g, m => m.replace(/[^\n]/g, ' '));
  const lineOf = (offset: number) => text.slice(0, offset).split('\n').length;

  // NOTE: no <language id> check — CORPUS-FALSIFIED 2026-07-16 (26/74 vanilla t-files
  // legitimately omit it; the game resolves language by filename suffix).
  const tagRe = /<(page|t)\b([^>]*?)\/?>/g;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(text)) !== null) {
    if (!/\bid\s*=\s*"/.test(m[2])) {
      warn(lineOf(m.index), m[1] === 'page' ? 'TFILE_PAGE_ID' : 'TFILE_ENTRY_ID', m[1],
        `<${m[1]}> is missing its id attribute — the game resolves {page,id} references by these ids.`);
    }
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * The shared entry point both validators consume.
 * ------------------------------------------------------------------ */

export interface RoutedValidationOptions {
  references?: { macros?: Set<string>; wares?: Set<string>; factions?: Set<string>; sectors?: Set<string> };
  /** override the corpus-proven set (tests + corpus-proof runs); defaults to CORPUS_PROVEN_DOMAINS */
  provenDomains?: Set<string>;
  strictStructure?: boolean;
}

/**
 * Validate every routable file against its routed schema. Files outside the subset are
 * ignored; a routed domain missing from the registry degrades to domainAvailable:false with
 * zero findings (never wrong-schema noise). Unproven domains report warnings only.
 */
export function validateRoutedFiles(
  files: Array<{ path: string; content: string }>,
  registry: SchemaRegistry | null,
  opts: RoutedValidationOptions = {},
): RoutedFileResult[] {
  const results: RoutedFileResult[] = [];
  const byDomain = new Map((registry?.domains || []).map(d => [d.domain, d]));
  const proven = opts.provenDomains ?? CORPUS_PROVEN_DOMAINS;
  const cap = (domain: string, findings: XsdDiagnostic[]): XsdDiagnostic[] =>
    proven.has(domain)
      ? findings
      : findings.map(f => f.severity === 'error'
        ? { ...f, severity: 'warning' as const, message: `${f.message} [reported as warning: '${domain}' schema routing not yet corpus-proven]` }
        : f);

  for (const f of files) {
    if (typeof f.content !== 'string') continue;
    const route = routeProjectFile(f.path, f.content);
    if (!route) continue;

    if (route.kind === 'tfile') {
      if (route.wrapper === 'diff') {
        // Validate the patch wrapper against diff.xsd when available (payload has no t schema).
        const diffIndex = buildRouteIndex({ kind: 'schema', wrapper: 'diff', rootElement: 'diff' }, byDomain);
        const findings = diffIndex
          ? cap('diff', validateXmlAgainstSchema(f.content, diffIndex, {
              filePath: f.path, domain: 'diff', reportUnknownElements: false, references: opts.references,
              strictStructure: opts.strictStructure,
            }))
          : [];
        results.push({ path: f.path, route, domainAvailable: !!diffIndex, severityCapped: !proven.has('diff'), findings });
      } else {
        results.push({ path: f.path, route, domainAvailable: true, severityCapped: false, findings: lintTFileStructure(f.content, f.path) });
      }
      continue;
    }

    const index = buildRouteIndex(route, byDomain);
    if (!index) {
      results.push({ path: f.path, route, domainAvailable: false, severityCapped: false, findings: [] });
      continue;
    }
    const domainKey = route.domain!;
    const isProven = proven.has(domainKey) && (route.wrapper !== 'diff' || proven.has('diff'));
    const raw = validateXmlAgainstSchema(f.content, index, {
      filePath: f.path,
      domain: domainKey,
      // Unknown-element reporting needs the FULL domain vocabulary to be reliable; routed
      // domains get attribute/enum/required checks only until reference-set work (phase 3).
      reportUnknownElements: false,
      references: opts.references,
      strictStructure: opts.strictStructure,
    });
    results.push({
      path: f.path,
      route,
      domainAvailable: true,
      severityCapped: !isProven,
      findings: isProven ? raw : cap(domainKey, raw),
    });
  }
  return results;
}

/* ------------------------------------------------------------------ *
 * Oracle — synthetic fixtures only (house pattern; env-dependent proof
 * against the real unpacked game is a VALIDATION step, not the oracle).
 * ------------------------------------------------------------------ */

export function runSchemaRoutingSelftest() {
  const checks: { name: string; pass: boolean; detail?: string }[] = [];
  const ok = (name: string, pass: boolean, detail?: string) => checks.push({ name, pass, ...(detail ? { detail } : {}) });

  // --- routing decisions (pure) ---
  const factionsPlain = '<?xml version="1.0"?>\n<!-- header -->\n<factions><faction id="argon"/></factions>';
  const factionsDiff = '<?xml version="1.0"?>\n<diff><add sel="/factions"><faction id="x"/></add></diff>';
  ok('factions_plain_routed', JSON.stringify(routeProjectFile('libraries/factions.xml', factionsPlain)) === JSON.stringify({ kind: 'schema', domain: 'factions', wrapper: 'plain', rootElement: 'factions' }));
  ok('factions_diff_wrapped', routeProjectFile('libraries/factions.xml', factionsDiff)?.wrapper === 'diff');
  ok('wares_plain_unrouted_no_schema', routeProjectFile('libraries/wares.xml', '<wares/>') === null);
  ok('jobs_plain_unrouted_no_schema', routeProjectFile('libraries/jobs.xml', '<jobs/>') === null);
  const waresDiff = routeProjectFile('libraries/wares.xml', '<diff><replace sel="x"/></diff>');
  ok('wares_diff_wrapper_only', waresDiff?.domain === 'diff' && waresDiff?.wrapper === 'diff');
  ok('ui_addon_by_root', routeProjectFile('ui/addons/x/ui.xml', '<addon/>')?.domain === 'addon');
  ok('ui_coreaddon_by_root', routeProjectFile('ui/core/x.xml', '<coreaddon/>')?.domain === 'coreaddon');
  ok('tfile_routed', routeProjectFile('t/0001.xml', '<language id="44"/>')?.kind === 'tfile');
  ok('md_unrouted', routeProjectFile('md/story.xml', '<mdscript/>') === null);
  ok('aiscripts_unrouted', routeProjectFile('aiscripts/x.xml', '<aiscript/>') === null);
  const mdDiff = routeProjectFile('md/story.xml', '<diff><add sel="/mdscript"/></diff>');
  ok('md_diff_routes_to_md', mdDiff?.kind === 'schema' && mdDiff.domain === 'md' && mdDiff.wrapper === 'diff' && mdDiff.rootElement === 'diff');
  const aiscriptsDiff = routeProjectFile('aiscripts/x.xml', '<diff><add sel="/aiscript"/></diff>');
  ok('aiscripts_diff_routes_to_aiscripts', aiscriptsDiff?.kind === 'schema' && aiscriptsDiff.domain === 'aiscripts' && aiscriptsDiff.wrapper === 'diff' && aiscriptsDiff.rootElement === 'diff');
  ok('content_unrouted', routeProjectFile('content.xml', '<content/>') === null);
  ok('niche_library_unrouted', routeProjectFile('libraries/voicesequences.xml', '<voicesequences/>') === null);
  ok('comment_root_sniff', sniffRootElement('<!-- a <fake> tag --><?pi x?>\n<real/>') === 'real');

  // --- validation through a synthetic registry (no game install) ---
  const xsd = (body: string) =>
    `<?xml version="1.0" encoding="utf-8"?>\n<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">\n${body}\n</xs:schema>`;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'x4forge-routing-'));
  try {
    const write = (name: string, content: string) => { const p = path.join(tmp, name); fs.writeFileSync(p, content, 'utf8'); return p; };
    const factionsXsd = write('factions_fixture.xsd', xsd(`
      <xs:element name="factions"><xs:complexType><xs:sequence><xs:element ref="faction" minOccurs="0" maxOccurs="unbounded"/></xs:sequence></xs:complexType></xs:element>
      <xs:element name="faction"><xs:complexType>
        <xs:attribute name="id" use="required"/>
        <xs:attribute name="tier"><xs:simpleType><xs:restriction base="xs:string"><xs:enumeration value="major"/><xs:enumeration value="minor"/></xs:restriction></xs:simpleType></xs:attribute>
      </xs:complexType></xs:element>`));
    const diffXsd = write('diff_fixture.xsd', xsd(`
      <xs:element name="diff"><xs:complexType><xs:sequence><xs:element ref="add" minOccurs="0" maxOccurs="unbounded"/></xs:sequence></xs:complexType></xs:element>
      <xs:element name="add"><xs:complexType><xs:attribute name="sel" use="required"/></xs:complexType></xs:element>`));
    const registry: SchemaRegistry = {
      roots: [tmp],
      domains: [
        { domain: 'factions', path: factionsXsd, sizeBytes: 1, includes: [], missingIncludes: [], shadowedCopies: 0 },
        { domain: 'diff', path: diffXsd, sizeBytes: 1, includes: [], missingIncludes: [], shadowedCopies: 0 },
      ],
    };

    const good = validateRoutedFiles([{ path: 'libraries/factions.xml', content: '<factions><faction id="argon" tier="major"/></factions>' }], registry);
    ok('vanilla_shaped_passes', good.length === 1 && good[0].domainAvailable && good[0].findings.length === 0, JSON.stringify(good[0]?.findings));

    const bad = validateRoutedFiles([{ path: 'libraries/factions.xml', content: '<factions><faction id="argon" tier="galactic"/></factions>' }], registry, { provenDomains: new Set() });
    ok('malformed_flagged', bad[0]?.findings.some(f => f.code === 'XSD_ENUM_VIOLATION'), JSON.stringify(bad[0]?.findings.map(f => f.code)));
    ok('unproven_domain_capped_to_warning', bad[0]?.findings.every(f => f.severity !== 'error') && bad[0]?.severityCapped === true);
    const badProven = validateRoutedFiles([{ path: 'libraries/factions.xml', content: '<factions><faction id="argon" tier="galactic"/></factions>' }], registry, { provenDomains: new Set(['factions', 'diff']) });
    ok('proven_domain_keeps_error_severity', badProven[0]?.findings.some(f => f.severity === 'error') && badProven[0]?.severityCapped === false);

    const wrapped = validateRoutedFiles([{ path: 'libraries/factions.xml', content: '<diff><add sel="/factions"><faction id="x" tier="major"/></add></diff>' }], registry);
    ok('diff_merged_index_clean', wrapped[0]?.findings.length === 0, JSON.stringify(wrapped[0]?.findings));
    const wrappedBad = validateRoutedFiles([{ path: 'libraries/factions.xml', content: '<diff><add><faction id="x"/></add></diff>' }], registry);
    ok('diff_wrapper_missing_sel_flagged', wrappedBad[0]?.findings.some(f => f.code === 'XSD_MISSING_REQUIRED' || /required/i.test(f.message)), JSON.stringify(wrappedBad[0]?.findings.map(f => f.code)));

    const missing = validateRoutedFiles([{ path: 'libraries/gamestarts.xml', content: '<gamestarts/>' }], registry);
    ok('missing_domain_degrades_silent', missing[0]?.domainAvailable === false && missing[0]?.findings.length === 0);

    const noRegistry = validateRoutedFiles([{ path: 'libraries/factions.xml', content: '<factions/>' }], null);
    ok('no_registry_degrades_silent', noRegistry.length === 1 && noRegistry[0].domainAvailable === false && noRegistry[0].findings.length === 0);
  } finally {
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* best-effort cleanup */ }
  }

  // --- t-file lint ---
  const goodT = lintTFileStructure('<language id="44"><page id="1001"><t id="1">Hello</t></page></language>');
  ok('tfile_good_clean', goodT.length === 0, JSON.stringify(goodT));
  const badT = lintTFileStructure('<language id="44"><page><t id="1">x</t></page></language>');
  ok('tfile_missing_page_id_flagged', badT.length === 1 && badT[0].code === 'TFILE_PAGE_ID' && badT[0].severity === 'warning');
  const wrongRoot = lintTFileStructure('<pages/>');
  ok('tfile_wrong_root_flagged', wrongRoot.length === 1 && wrongRoot[0].code === 'TFILE_ROOT');

  const passed = checks.filter(c => c.pass).length;
  const allPassed = passed === checks.length;
  return { allPassed, pass: allPassed, passed, total: checks.length, checks };
}
