/**
 * schemaRegistry.ts — B46 Phase 1 (2026-07-16): multi-schema discovery + per-domain indexes.
 *
 * The game ships ~37 XSDs (factions, gamestarts, diff, parameters, …) but the Forge historically
 * loaded only md+common(+aiscripts). This registry DISCOVERS every *.xsd under the configured
 * schema folder (and optionally the game folder), resolves each file's xs:include/xs:import
 * chain, and builds a per-domain SchemaIndex on demand through the existing, proven
 * `buildSchemaIndex` (xsdValidate.ts) — no new parser.
 *
 * Deliberate phase-1 bounds:
 *  - Discovery + lazy per-domain indexes + endpoint + oracle ONLY. Nothing routes files to these
 *    schemas yet (phase 2), so this phase cannot introduce validation false positives.
 *  - Parse is lazy: common.xsd is 1.7MB; eagerly indexing ~30 domains would cost seconds.
 *  - The walk mirrors B51's discoverXsd bounds (depth ≤ 6, asset-dir skips, base-over-DLC
 *    preference) so discovery behaves consistently across both features.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { buildSchemaIndex, type SchemaIndex } from './xsdValidate';
import { listReferenceManifestFiles } from './referenceManifest';

export interface SchemaDomainInfo {
  /** basename without .xsd, lowercased — the routing key (factions.xsd → 'factions') */
  domain: string;
  /** absolute path of the chosen copy (base game preferred over DLC copies) */
  path: string;
  sizeBytes: number;
  /** resolved absolute paths of the transitive xs:include/xs:import chain (existing files) */
  includes: string[];
  /** schemaLocation values that could not be resolved to an existing file */
  missingIncludes: string[];
  /** other copies of the same basename that were NOT chosen (DLC/deeper duplicates) */
  shadowedCopies: number;
}

export interface SchemaRegistry {
  roots: string[];
  domains: SchemaDomainInfo[];
}

/** Directories the walk never descends into (mirrors discoverXsd's skip list). */
const SKIP_DIRS = /^(node_modules|\.git|assets|textures|videos|music|sounds|shadergl|particles)$/i;
const MAX_DEPTH = 6;
const MAX_FILES = 500;

/** Enumerate every *.xsd under root (bounded walk). */
function enumerateXsds(root: string): { path: string; depth: number; dlc: boolean }[] {
  const out: { path: string; depth: number; dlc: boolean }[] = [];
  if (!root) return out;
  try { if (!fs.existsSync(root)) return out; } catch { return out; }
  const walk = (dir: string, depth: number) => {
    if (depth > MAX_DEPTH || out.length >= MAX_FILES) return;
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (SKIP_DIRS.test(e.name)) continue;
        walk(full, depth + 1);
      } else if (e.name.toLowerCase().endsWith('.xsd')) {
        out.push({ path: full, depth, dlc: /[\\/]extensions[\\/]/i.test(full) });
      }
    }
  };
  walk(root, 0);
  return out;
}

function enumerateManifestXsds(schemaDir: string): { path: string; depth: number; dlc: boolean }[] | null {
  if (path.basename(schemaDir).toLowerCase() !== 'libraries') return null;
  const manifestRoot = path.dirname(schemaDir);
  const manifest = listReferenceManifestFiles(manifestRoot, { role: 'grammar' }, 1_000);
  if (!manifest?.files.length) return null;
  return manifest.files.map(file => ({
    path: path.join(manifestRoot, ...file.path.split('/')),
    depth: file.path.split('/').length - 1,
    dlc: /^ego_dlc_/i.test(file.source),
  }));
}

/** Pull schemaLocation="…" targets out of an XSD's text (xs:include and xs:import). */
function readIncludeTargets(xsdPath: string): string[] {
  let text: string;
  try { text = fs.readFileSync(xsdPath, 'utf8'); } catch { return []; }
  const targets: string[] = [];
  const re = /<xs:(?:include|import)\b[^>]*schemaLocation="([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) targets.push(m[1]);
  return targets;
}

/**
 * Expand one XSD into itself + its transitive xs:include/xs:import chain, resolving each
 * schemaLocation relative to the file that declares it. Unresolvable targets are skipped
 * (buildSchemaIndex filters non-existent paths anyway).
 *
 * B46 Phase 2 (2026-07-16): the unpacked game's md/md.xsd and aiscripts/aiscripts.xsd are
 * include SHIMS with zero declarations (each just includes ../libraries/<name>.xsd), and
 * buildSchemaIndex does not follow includes — so the legacy md/aiscripts indexes silently
 * lost the entire real vocabulary on unpacked-root configs (reproduced: all 20 MD-only
 * event_* elements missing → the md-audit false positives). Loaders expand through this.
 */
export function expandIncludeChain(xsdPath: string): string[] {
  const out: string[] = [];
  const visited = new Set<string>();
  const queue = [xsdPath];
  while (queue.length) {
    const current = queue.shift()!;
    let real: string;
    try { real = path.resolve(current); } catch { continue; }
    const key = real.toLowerCase();
    if (visited.has(key)) continue;
    try { if (!fs.existsSync(real) || !fs.statSync(real).isFile()) continue; } catch { continue; }
    visited.add(key);
    out.push(real);
    for (const target of readIncludeTargets(real)) {
      queue.push(path.resolve(path.dirname(real), target));
    }
  }
  return out;
}

// Registry cache: the bounded walk over a full unpacked-game tree measured 25.6s cold
// (9,884-file corpus, 2026-07-16) — far too slow per GET. Discovery results change only when
// schema files are added/moved, so cache per root-set with a TTL; callers pass refresh=true
// (endpoint ?refresh=1) after changing schema folders.
const REGISTRY_TTL_MS = 5 * 60_000;
const registryCache = new Map<string, { at: number; registry: SchemaRegistry }>();

/**
 * Discover the schema registry: every *.xsd under the given roots, one chosen copy per
 * basename (non-DLC then shallower wins — same preference as discoverXsd), with each
 * domain's transitive include chain resolved.
 */
export function discoverSchemaRegistry(schemaDir: string, gamePath?: string, opts?: { refresh?: boolean; signature?: string }): SchemaRegistry {
  const cacheKey = `${schemaDir}|${gamePath || ''}|${opts?.signature || ''}`.toLowerCase();
  const hit = registryCache.get(cacheKey);
  if (!opts?.refresh && hit && Date.now() - hit.at < REGISTRY_TTL_MS) return hit.registry;
  const registry = discoverSchemaRegistryUncached(schemaDir, gamePath);
  registryCache.set(cacheKey, { at: Date.now(), registry });
  return registry;
}

/** Cheap deterministic signature for a bounded schema directory (used by the canonical reference root). */
export function schemaFilesSignature(schemaDir: string): string {
  return enumerateXsds(schemaDir)
    .map(hit => {
      try {
        const stat = fs.statSync(hit.path);
        return `${path.relative(schemaDir, hit.path).replace(/\\/g, '/').toLowerCase()}:${stat.size}:${stat.mtimeMs}`;
      } catch { return `${hit.path.toLowerCase()}:missing`; }
    })
    .sort()
    .join('|');
}

function discoverSchemaRegistryUncached(schemaDir: string, gamePath?: string): SchemaRegistry {
  // dedupe roots while preserving order (schemaDir outranks gamePath on basename ties)
  const uniqueRoots = Array.from(new Set([schemaDir, gamePath].filter((r): r is string => !!r)));

  // Collect all copies grouped by basename. Earlier roots win ties (schemaDir over gamePath).
  const byBase = new Map<string, { path: string; depth: number; dlc: boolean; rootRank: number }[]>();
  uniqueRoots.forEach((root, rootRank) => {
    const hits = enumerateManifestXsds(root) || enumerateXsds(root);
    for (const hit of hits) {
      const base = path.basename(hit.path).toLowerCase();
      const list = byBase.get(base) || [];
      list.push({ ...hit, rootRank });
      byBase.set(base, list);
    }
  });

  // Resolve one include target to an existing absolute path.
  const resolveInclude = (fromXsd: string, target: string): string | null => {
    const local = path.resolve(path.dirname(fromXsd), target);
    try { if (fs.existsSync(local) && fs.statSync(local).isFile()) return local; } catch { /* fall through */ }
    const base = path.basename(target).toLowerCase();
    const candidates = byBase.get(base);
    if (!candidates?.length) return null;
    return pickBest(candidates).path;
  };

  const pickBest = (list: { path: string; depth: number; dlc: boolean; rootRank: number }[]) =>
    [...list].sort((a, b) =>
      (Number(a.dlc) - Number(b.dlc)) || (a.rootRank - b.rootRank) || (a.depth - b.depth) || a.path.localeCompare(b.path))[0];

  const domains: SchemaDomainInfo[] = [];
  for (const [base, copies] of byBase) {
    const chosen = pickBest(copies);
    // Transitive include chase with a visited set (real graph: diplomacy→aiscripts→common).
    const includes: string[] = [];
    const missingIncludes: string[] = [];
    const visited = new Set<string>([chosen.path.toLowerCase()]);
    const queue = [chosen.path];
    while (queue.length) {
      const current = queue.shift()!;
      for (const target of readIncludeTargets(current)) {
        const resolved = resolveInclude(current, target);
        if (!resolved) { if (!missingIncludes.includes(target)) missingIncludes.push(target); continue; }
        const key = resolved.toLowerCase();
        if (visited.has(key)) continue;
        visited.add(key);
        includes.push(resolved);
        queue.push(resolved);
      }
    }
    let sizeBytes = 0;
    try { sizeBytes = fs.statSync(chosen.path).size; } catch { /* stat is best-effort */ }
    domains.push({
      domain: base.replace(/\.xsd$/, ''),
      path: chosen.path,
      sizeBytes,
      includes,
      missingIncludes,
      shadowedCopies: copies.length - 1,
    });
  }
  domains.sort((a, b) => a.domain.localeCompare(b.domain));
  return { roots: uniqueRoots, domains };
}

/**
 * Build (lazily, via the shared cached builder) the SchemaIndex for one domain.
 * A junk/truncated XSD degrades to an empty index — it never throws.
 */
export function getDomainIndex(info: SchemaDomainInfo): SchemaIndex {
  try {
    return buildSchemaIndex([info.path, ...info.includes]);
  } catch {
    return { elements: new Map(), loaded: false, sourceFiles: [info.path], elementCount: 0 };
  }
}

/* ------------------------------------------------------------------ *
 * Oracle — synthetic fixtures only (no game install needed anywhere).
 * ------------------------------------------------------------------ */

export function runSchemaRegistrySelftest() {
  const checks: { name: string; pass: boolean; detail?: string }[] = [];
  const ok = (name: string, pass: boolean, detail?: string) => checks.push({ name, pass, ...(detail ? { detail } : {}) });

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'x4forge-schemareg-'));
  try {
    const write = (rel: string, content: string) => {
      const p = path.join(tmp, ...rel.split('/'));
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, content, 'utf8');
    };
    const xsd = (body: string, includes: string[] = []) =>
      `<?xml version="1.0" encoding="utf-8"?>\n<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">\n` +
      includes.map(i => `  <xs:include schemaLocation="${i}" />\n`).join('') + body + `\n</xs:schema>`;

    // Fixture layout: an include chain a→shared, a transitive chain c→a→shared, a junk file,
    // a missing include, a subdir schema, and a DLC shadow copy of a.xsd.
    write('shared_test.xsd', xsd(`  <xs:element name="sharedthing"><xs:complexType><xs:attribute name="id" use="required"/></xs:complexType></xs:element>`));
    write('a.xsd', xsd(`  <xs:element name="alpha"><xs:complexType><xs:attribute name="name" use="required"/></xs:complexType></xs:element>`, ['shared_test.xsd']));
    write('c.xsd', xsd(`  <xs:element name="gamma"><xs:complexType><xs:attribute name="ref"/></xs:complexType></xs:element>`, ['a.xsd']));
    write('broken.xsd', xsd(`  <xs:element name="beta"/>`, ['does_not_exist.xsd']));
    write('junk.xsd', 'this is not xml at all {{{');
    write('libraries/subdir_test.xsd', xsd(`  <xs:element name="subthing"/>`));
    write('extensions/some_dlc/a.xsd', xsd(`  <xs:element name="alpha_dlc_copy"/>`));

    const reg = discoverSchemaRegistry(tmp);
    const byDomain = new Map(reg.domains.map(d => [d.domain, d]));

    ok('discovers_all_domains', reg.domains.length === 6, `got ${reg.domains.length}: ${reg.domains.map(d => d.domain).join(',')}`);
    ok('subdir_schema_found', byDomain.has('subdir_test'));

    const a = byDomain.get('a');
    ok('base_preferred_over_dlc_copy', !!a && !/[\\/]extensions[\\/]/i.test(a.path), a?.path);
    ok('shadowed_copy_counted', (a?.shadowedCopies ?? 0) === 1, String(a?.shadowedCopies));
    ok('include_resolved', !!a && a.includes.length === 1 && a.includes[0].toLowerCase().endsWith('shared_test.xsd'));

    const c = byDomain.get('c');
    ok('transitive_include_chain', !!c && c.includes.length === 2, c?.includes.map(p => path.basename(p)).join(','));

    const broken = byDomain.get('broken');
    ok('missing_include_reported', !!broken && broken.missingIncludes.length === 1 && broken.missingIncludes[0] === 'does_not_exist.xsd');

    const aIndex = a ? getDomainIndex(a) : null;
    ok('domain_index_builds', !!aIndex?.loaded && (aIndex?.elementCount ?? 0) >= 2, `elements=${aIndex?.elementCount}`);
    ok('index_merges_include_elements', !!aIndex?.elements.has('sharedthing'));

    const junk = byDomain.get('junk');
    const junkIndex = junk ? getDomainIndex(junk) : null;
    ok('junk_xsd_degrades_not_throws', !!junk && !!junkIndex && junkIndex.elementCount === 0, `elements=${junkIndex?.elementCount}`);

    const beforeSignature = schemaFilesSignature(tmp);
    write('added_after_cache.xsd', xsd(`  <xs:element name="fresh"/>`));
    const afterSignature = schemaFilesSignature(tmp);
    const refreshed = discoverSchemaRegistry(tmp, undefined, { signature: afterSignature });
    ok('schema_signature_changes_on_add', beforeSignature !== afterSignature);
    ok('signature_cache_key_discovers_added_schema', refreshed.domains.some(domain => domain.domain === 'added_after_cache'));

    ok('missing_root_returns_empty', discoverSchemaRegistry(path.join(tmp, 'nope')).domains.length === 0);
  } finally {
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* best-effort cleanup */ }
  }

  const passed = checks.filter(c => c.pass).length;
  const allPassed = passed === checks.length;
  return { allPassed, pass: allPassed, passed, total: checks.length, checks };
}
