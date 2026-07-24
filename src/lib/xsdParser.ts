import fs from 'fs';
import os from 'os';
import path from 'path';
import { XMLParser } from 'fast-xml-parser';
import { dataPath } from './dataDir';
import { expandIncludeChain } from './schemaRegistry';
import { schemaLibraryToTemplates, SchemaAttribute, SchemaCategory, SchemaElement, SchemaLibrary } from './schemaTypes';

type AnyNode = Record<string, any>;

const EVENT_GROUPS = new Set(['specificconditions_event', 'commonconditions_event']);
const CONDITION_GROUPS = new Set(['specificconditions_nonevent', 'commonconditions_nonevent']);
const ACTION_GROUPS = new Set(['commonactions']);
const CONTROL_FLOW_TAGS = new Set(['do_if', 'do_else', 'do_elseif', 'do_all', 'do_any', 'do_while', 'do_for_each']);

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  allowBooleanAttributes: true,
  commentPropName: '#comment',
  trimValues: true
});

export interface XsdConfig {
  x4GamePath?: string;
  /** Loose/unpacked X4 corpus used by the read-only reference API and canonical validation. */
  x4ReferenceRoot?: string;
  xsdSchemaPath?: string;
  schemaFiles?: string[];
  modWorkspacePath?: string;
  filesystemPath?: string;
  /** optional user-configured X4 debug log path (debuglog.txt) */
  x4LogPath?: string;
}

export interface ResolvedXsdConfig extends XsdConfig {
  schemaDir: string;
  mdXsdPath: string;
  commonXsdPath: string;
  mdExists: boolean;
  commonExists: boolean;
  /** B51: aiscripts.xsd discovered under the schema/game dir (for AISCRIPT validation). */
  aiscriptsXsdPath?: string;
  aiscriptsExists?: boolean;
  x4ReferenceRoot: string;
  x4ReferenceExists: boolean;
  modWorkspacePath?: string;
  filesystemPath?: string;
}

/** User-requested default; override with X4_REFERENCE_ROOT or config.x4ReferenceRoot. */
export const DEFAULT_X4_REFERENCE_ROOT = 'F:\\Downskies\\x4unpackersuiteV1\\X4 unpacked 9.00';

function arrayOf<T>(value: T | T[] | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function cleanText(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value.replace(/\s+/g, ' ').trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(cleanText).filter(Boolean).join(' ');
  if (typeof value === 'object') {
    const node = value as AnyNode;
    if ('#text' in node) return cleanText(node['#text']);
    return Object.values(node).map(cleanText).filter(Boolean).join(' ');
  }
  return '';
}

function documentationOf(node: AnyNode | undefined): string {
  if (!node) return '';
  return cleanText(node['xs:annotation']?.['xs:documentation']);
}

function collectNodesByKey(node: any, key: string, out: AnyNode[] = []): AnyNode[] {
  if (!node || typeof node !== 'object') return out;
  if (Array.isArray(node)) {
    node.forEach(item => collectNodesByKey(item, key, out));
    return out;
  }
  if (node[key]) out.push(...arrayOf(node[key]));
  Object.values(node).forEach(value => collectNodesByKey(value, key, out));
  return out;
}

function collectEnums(node: AnyNode | undefined): string[] {
  if (!node) return [];
  const enums = collectNodesByKey(node, 'xs:enumeration')
    .map(en => en.value)
    .filter((value): value is string => typeof value === 'string' && value.length > 0);
  return Array.from(new Set(enums));
}

function collectSimpleTypes(schemaRoots: AnyNode[]): Record<string, string[]> {
  const simpleTypes: Record<string, string[]> = {};
  schemaRoots.forEach(root => {
    arrayOf(root['xs:schema']?.['xs:simpleType']).forEach((simpleType: AnyNode) => {
      if (!simpleType.name) return;
      const enums = collectEnums(simpleType);
      if (enums.length > 0) simpleTypes[simpleType.name] = enums;
    });
  });
  return simpleTypes;
}

function collectAttributeGroups(schemaRoots: AnyNode[]): Map<string, AnyNode> {
  const groups = new Map<string, AnyNode>();
  schemaRoots.forEach(root => {
    arrayOf(root['xs:schema']?.['xs:attributeGroup']).forEach((group: AnyNode) => {
      if (group.name) groups.set(group.name, group);
    });
  });
  return groups;
}

function attributeType(attr: AnyNode): string {
  if (attr.type) return attr.type;
  const inlineEnums = collectEnums(attr['xs:simpleType']);
  if (inlineEnums.length > 0) return 'enum';
  return 'expression';
}

function attributeToDescriptor(attr: AnyNode, simpleTypes: Record<string, string[]>): SchemaAttribute | null {
  if (!attr?.name) return null;
  const type = attributeType(attr);
  const inlineEnums = collectEnums(attr['xs:simpleType']);
  const enumValues = inlineEnums.length > 0 ? inlineEnums : simpleTypes[type];
  return {
    name: attr.name,
    type,
    required: attr.use === 'required',
    documentation: documentationOf(attr),
    enumValues,
    defaultValue: attr.default
  };
}

function collectAttributes(
  node: AnyNode,
  simpleTypes: Record<string, string[]>,
  attributeGroups: Map<string, AnyNode>,
  seenGroups = new Set<string>()
): SchemaAttribute[] {
  const attrs: SchemaAttribute[] = [];

  collectNodesByKey(node, 'xs:attribute').forEach(attr => {
    const descriptor = attributeToDescriptor(attr, simpleTypes);
    if (descriptor) attrs.push(descriptor);
  });

  collectNodesByKey(node, 'xs:attributeGroup').forEach(groupRef => {
    const ref = groupRef.ref || groupRef.name;
    if (!ref || seenGroups.has(ref)) return;
    const group = attributeGroups.get(ref);
    if (!group) return;
    seenGroups.add(ref);
    attrs.push(...collectAttributes(group, simpleTypes, attributeGroups, seenGroups));
  });

  const byName = new Map<string, SchemaAttribute>();
  attrs.forEach(attr => {
    const existing = byName.get(attr.name);
    byName.set(attr.name, {
      ...existing,
      ...attr,
      required: Boolean(existing?.required || attr.required),
      documentation: attr.documentation || existing?.documentation || ''
    });
  });
  return Array.from(byName.values()).sort((a, b) => Number(b.required) - Number(a.required) || a.name.localeCompare(b.name));
}

function childElementsOf(node: AnyNode, category: SchemaCategory): SchemaElement['childElements'] {
  return collectNodesByKey(node['xs:complexType'] || {}, 'xs:element')
    .map(child => child.name || child.ref)
    .filter((tag): tag is string => typeof tag === 'string' && tag.length > 0)
    .map(tag => ({ tag, category, documentation: '' }))
    .slice(0, 50);
}

function classifyFromGroup(groupName: string, tag: string): SchemaCategory {
  if (CONTROL_FLOW_TAGS.has(tag)) return 'control_flow';
  if (EVENT_GROUPS.has(groupName) || tag.startsWith('event_')) return 'event';
  if (CONDITION_GROUPS.has(groupName)) return 'condition';
  if (ACTION_GROUPS.has(groupName)) return CONTROL_FLOW_TAGS.has(tag) ? 'control_flow' : 'action';
  return tag.startsWith('event_') ? 'event' : 'action';
}

function collectGroupElements(
  schemaRoots: AnyNode[],
  simpleTypes: Record<string, string[]>,
  attributeGroups: Map<string, AnyNode>,
  groupNames: Set<string>
): SchemaElement[] {
  const elements = new Map<string, SchemaElement>();

  schemaRoots.forEach(root => {
    const sourceFile = root.__sourceFile || '';
    arrayOf(root['xs:schema']?.['xs:group']).forEach((group: AnyNode) => {
      if (!group.name || !groupNames.has(group.name)) return;
      collectNodesByKey(group, 'xs:element').forEach(element => {
        const tag = element.name || element.ref;
        if (!tag) return;
        const category = classifyFromGroup(group.name, tag);
        elements.set(tag, {
          tag,
          category,
          documentation: documentationOf(element),
          attributes: collectAttributes(element, simpleTypes, attributeGroups),
          childElements: childElementsOf(element, category),
          sourceFile
        });
      });
    });
  });

  return Array.from(elements.values()).sort((a, b) => a.tag.localeCompare(b.tag));
}

export function getDefaultGamePath(): string {
  if (process.env.X4_GAME_PATH) return process.env.X4_GAME_PATH;
  if (fs.existsSync(configPath())) {
    try {
      const config = readXsdConfig();
      if (config.x4GamePath) return config.x4GamePath;
    } catch {
      // Ignore malformed config here; startup will still report schema load errors.
    }
  }
  // B49: NO machine-specific default. Unconfigured = empty → existence checks fail
  // gracefully, the health card flags it, and the first-run wizard (B18) autodetects.
  return '';
}

export function getDefaultSchemaDir(gamePath = getDefaultGamePath()): string {
  if (process.env.X4_XSD_PATH) return process.env.X4_XSD_PATH;
  if (fs.existsSync(configPath())) {
    try {
      const config = readXsdConfig();
      if (config.xsdSchemaPath) return path.isAbsolute(config.xsdSchemaPath)
        ? config.xsdSchemaPath
        : path.join(gamePath, config.xsdSchemaPath);
    } catch {
      // Ignore malformed config here; startup will still report schema load errors.
    }
  }
  // B49: generic default = the wizard's harvest target (B18 extracts md/common/aiscripts
  // XSDs from the game archives into here) — never a specific mod's folder. B53: via the
  // relocatable data root so it survives extension updates.
  return dataPath('harvested-schemas');
}

function configPath(): string {
  // B51: honor an EXPLICIT config dir (X4_CONFIG_DIR) so the packaged extension can persist the
  // user's Directory Settings OUTSIDE its install dir (which every extension update wipes).
  // Only X4_CONFIG_DIR — deliberately NOT X4_STATE_DIR, which the e2e/ephemeral stack sets for
  // workspace isolation; coupling config to it would move config.json into the throwaway state
  // dir. Unset (dev/standalone) → config.json in cwd, unchanged.
  const dir = process.env.X4_CONFIG_DIR?.trim() || process.cwd();
  return path.resolve(dir, 'config.json');
}

// B51: the game ships its XSDs in SUBDIRECTORIES (md/md.xsd, libraries/common.xsd,
// aiscripts/aiscripts.xsd), and an unpacked-game folder scatters them further (per-DLC copies
// under extensions/). `discoverXsd` finds a schema by basename wherever it lives: conventional
// relative homes first (fast, exact), then a bounded recursive walk preferring base game over
// DLC copies and shallower paths.
const XSD_CONVENTIONAL_HOMES: Record<string, string[]> = {
  'md.xsd': ['md.xsd', 'md/md.xsd', 'libraries/md.xsd'],
  'common.xsd': ['common.xsd', 'libraries/common.xsd', 'md/common.xsd'],
  'aiscripts.xsd': ['aiscripts.xsd', 'aiscripts/aiscripts.xsd', 'libraries/aiscripts.xsd'],
};

export function discoverXsd(root: string, basename: string): string | null {
  if (!root) return null;
  try { if (!fs.existsSync(root)) return null; } catch { return null; }
  const lower = basename.toLowerCase();
  for (const rel of (XSD_CONVENTIONAL_HOMES[lower] || [basename])) {
    const p = path.join(root, ...rel.split('/'));
    try { if (fs.existsSync(p) && fs.statSync(p).isFile()) return p; } catch { /* keep looking */ }
  }
  const matches: { path: string; depth: number; dlc: boolean }[] = [];
  const walk = (dir: string, depth: number) => {
    if (depth > 6 || matches.length > 200) return;
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (/^(node_modules|\.git|assets|textures|videos|music|sounds|shadergl|particles)$/i.test(e.name)) continue;
        walk(full, depth + 1);
      } else if (e.name.toLowerCase() === lower) {
        matches.push({ path: full, depth, dlc: /[\\/]extensions[\\/]/i.test(full) });
      }
    }
  };
  walk(root, 0);
  if (!matches.length) return null;
  matches.sort((a, b) => (Number(a.dlc) - Number(b.dlc)) || (a.depth - b.depth) || a.path.localeCompare(b.path));
  return matches[0].path;
}

export function readXsdConfig(): XsdConfig {
  const fullPath = configPath();
  if (!fs.existsSync(fullPath)) return {};
  // B64-SEC3 (2026-07-18): a corrupt/partially-written config.json must NOT throw.
  // readXsdConfig is called at the top of ~40 route handlers (several before their try
  // block); an unhandled JSON.parse threw an opaque 500 across the whole API. Degrade to
  // "unconfigured" (same as file-absent) with a visible warning, so the app falls back to
  // the first-run wizard instead of dying (mirrors B45's non-fatal schema-absence policy).
  let raw: string;
  try { raw = fs.readFileSync(fullPath, 'utf8'); }
  catch (e) { console.warn(`[config] could not read ${fullPath}: ${(e as Error).message} — treating as unconfigured`); return {}; }
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as XsdConfig : {};
  } catch (e) {
    console.warn(`[config] ${fullPath} is not valid JSON (${(e as Error).message}) — treating as unconfigured; fix or delete it via Directory Settings`);
    return {};
  }
}

export function writeXsdConfig(config: XsdConfig): void {
  fs.writeFileSync(configPath(), `${JSON.stringify(config, null, 2)}\n`, 'utf8');
}

export function resolveXsdConfig(config = readXsdConfig()): ResolvedXsdConfig {
  const gamePath = process.env.X4_GAME_PATH || config.x4GamePath || '';
  const x4ReferenceRoot = path.resolve(
    process.env.X4_REFERENCE_ROOT?.trim()
      || config.x4ReferenceRoot?.trim()
      || DEFAULT_X4_REFERENCE_ROOT,
  );
  const referenceLibraries = path.join(x4ReferenceRoot, 'libraries');
  const schemaDir = process.env.X4_XSD_PATH
    || (config.xsdSchemaPath
      ? (path.isAbsolute(config.xsdSchemaPath) ? config.xsdSchemaPath : path.join(gamePath, config.xsdSchemaPath))
      : (fs.existsSync(path.join(referenceLibraries, 'md.xsd'))
          ? referenceLibraries
          : dataPath('harvested-schemas')));

  const files = config.schemaFiles?.length ? config.schemaFiles : ['md.xsd', 'common.xsd'];
  // An explicit ABSOLUTE path in schemaFiles always wins (a user who set an exact file). Else
  // discover the schema under the configured schema dir (subdir-aware), then under the game
  // dir, and only fall back to the naive top-level join if discovery finds nothing.
  const explicitAbs = (base: string) => files.find(f => path.basename(f).toLowerCase() === base && path.isAbsolute(f));
  const discover = (base: string) =>
    explicitAbs(base)
    || discoverXsd(schemaDir, base)
    || (gamePath ? discoverXsd(gamePath, base) : null);

  const mdXsdPath = discover('md.xsd') || path.join(schemaDir, 'md.xsd');
  const commonXsdPath = discover('common.xsd') || path.join(schemaDir, 'common.xsd');
  const aiscriptsXsdPath = discover('aiscripts.xsd') || undefined;

  return {
    ...config,
    x4GamePath: gamePath,
    xsdSchemaPath: config.xsdSchemaPath || schemaDir,
    schemaFiles: files,
    schemaDir,
    mdXsdPath,
    commonXsdPath,
    aiscriptsXsdPath,
    x4ReferenceRoot,
    x4ReferenceExists: fs.existsSync(x4ReferenceRoot) && fs.statSync(x4ReferenceRoot).isDirectory(),
    mdExists: fs.existsSync(mdXsdPath),
    commonExists: fs.existsSync(commonXsdPath),
    aiscriptsExists: !!aiscriptsXsdPath && fs.existsSync(aiscriptsXsdPath),
  };
}

/**
 * B51 oracle: schema discovery finds XSDs in the game's real subdirectory layout, prefers base
 * game over DLC copies, keeps the flat harvested-schemas layout working, and recurses as a
 * fallback. Uses a temp fixture (no game install needed).
 */
export function runSchemaDiscoverySelftest(): { pass: boolean; checks: Array<{ name: string; pass: boolean; detail?: string }> } {
  const checks: Array<{ name: string; pass: boolean; detail?: string }> = [];
  const ok = (name: string, pass: boolean, detail?: string) => checks.push({ name, pass, detail });
  const tmp = path.join(os.tmpdir(), `x4-xsd-discover-${process.pid}`);
  const mk = (rel: string) => { const p = path.join(tmp, ...rel.split('/')); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, '<xs:schema/>'); return p; };
  try {
    fs.rmSync(tmp, { recursive: true, force: true });
    mk('md/md.xsd'); mk('libraries/common.xsd'); mk('aiscripts/aiscripts.xsd'); mk('extensions/ego_dlc/md/md.xsd');
    ok('md found in md/ subdir', discoverXsd(tmp, 'md.xsd') === path.join(tmp, 'md', 'md.xsd'), discoverXsd(tmp, 'md.xsd') || 'null');
    ok('common found in libraries/', discoverXsd(tmp, 'common.xsd') === path.join(tmp, 'libraries', 'common.xsd'));
    ok('aiscripts found in aiscripts/', discoverXsd(tmp, 'aiscripts.xsd') === path.join(tmp, 'aiscripts', 'aiscripts.xsd'));
    ok('base preferred over DLC copy', !(discoverXsd(tmp, 'md.xsd') || '').includes('extensions'));
    ok('missing file → null', discoverXsd(tmp, 'nonexistent.xsd') === null);
    ok('nonexistent root → null', discoverXsd(path.join(tmp, 'nope'), 'md.xsd') === null);

    const flat = path.join(tmp, 'flat'); fs.mkdirSync(flat, { recursive: true }); fs.writeFileSync(path.join(flat, 'md.xsd'), '<xs:schema/>');
    ok('flat harvested layout still works', discoverXsd(flat, 'md.xsd') === path.join(flat, 'md.xsd'));

    const deep = path.join(tmp, 'weird'); fs.mkdirSync(path.join(deep, 'a', 'b', 'schemas'), { recursive: true }); fs.writeFileSync(path.join(deep, 'a', 'b', 'schemas', 'md.xsd'), '<xs:schema/>');
    ok('recursive fallback finds deep md', (discoverXsd(deep, 'md.xsd') || '').endsWith(path.join('schemas', 'md.xsd')));

    const r = resolveXsdConfig({ xsdSchemaPath: tmp });
    ok('resolveXsdConfig reports all present', r.mdExists === true && r.commonExists === true && r.aiscriptsExists === true);

    const corpus = path.join(tmp, 'corpus');
    mk('corpus/libraries/md.xsd'); mk('corpus/libraries/common.xsd'); mk('corpus/libraries/aiscripts.xsd');
    const fromCorpus = resolveXsdConfig({ x4ReferenceRoot: corpus });
    ok('unpacked root derives schema directory', fromCorpus.schemaDir === path.join(corpus, 'libraries'), fromCorpus.schemaDir);
    ok('derived corpus schemas report present', fromCorpus.mdExists && fromCorpus.commonExists && fromCorpus.aiscriptsExists);

    // B64-SEC3: a corrupt config.json degrades to {} (unconfigured) and never throws.
    const cfgDir = path.join(tmp, 'cfg'); fs.mkdirSync(cfgDir, { recursive: true });
    const prevCfgDir = process.env.X4_CONFIG_DIR;
    process.env.X4_CONFIG_DIR = cfgDir;
    try {
      fs.writeFileSync(configPath(), '{ this is not valid json ,,', 'utf8');
      let threw = false, val: XsdConfig | null = null;
      try { val = readXsdConfig(); } catch { threw = true; }
      ok('corrupt config.json does not throw', threw === false);
      ok('corrupt config.json degrades to empty', !!val && Object.keys(val as object).length === 0);
      // a VALID config still parses through unchanged
      fs.writeFileSync(configPath(), JSON.stringify({ x4GamePath: 'X:/game' }), 'utf8');
      ok('valid config.json still parses', readXsdConfig().x4GamePath === 'X:/game');
    } finally {
      if (prevCfgDir === undefined) delete process.env.X4_CONFIG_DIR; else process.env.X4_CONFIG_DIR = prevCfgDir;
    }
  } catch (e) {
    ok('selftest ran without error', false, String(e));
  } finally {
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* ignore */ }
  }
  return { pass: checks.every(c => c.pass), checks };
}

export function loadSchemaLibrary(schemaDir = getDefaultSchemaDir(), files = ['md.xsd', 'common.xsd']): SchemaLibrary {
  // B56 unit-0 (2026-07-17): expand each root XSD through its transitive xs:include chain —
  // the unpacked game's md/md.xsd is a ZERO-DECLARATION include shim, and without expansion
  // the palette silently lost all 20 MD-only events (382 vs 402 — the stale count was
  // user-visible in the XML-patching meta panel). Same fix class as B55P1's validator loaders.
  const expandedPaths = Array.from(new Set(
    files.flatMap(file => expandIncludeChain(path.isAbsolute(file) ? file : path.join(schemaDir, file)))
  ));
  const schemaRoots = (expandedPaths.length ? expandedPaths : files.map(f => path.isAbsolute(f) ? f : path.join(schemaDir, f))).map(fullPath => {
    const parsed = parser.parse(fs.readFileSync(fullPath, 'utf8'));
    parsed.__sourceFile = fullPath;
    return parsed;
  });

  const simpleTypes = collectSimpleTypes(schemaRoots);
  const attributeGroups = collectAttributeGroups(schemaRoots);

  const events = collectGroupElements(schemaRoots, simpleTypes, attributeGroups, EVENT_GROUPS);
  const conditions = collectGroupElements(schemaRoots, simpleTypes, attributeGroups, CONDITION_GROUPS);
  const actionLike = collectGroupElements(schemaRoots, simpleTypes, attributeGroups, ACTION_GROUPS);
  const controlFlow = actionLike.filter(element => element.category === 'control_flow');
  const actions = actionLike.filter(element => element.category !== 'control_flow');

  const libraryBase = {
    events,
    conditions,
    actions,
    controlFlow,
    simpleTypes,
    sourceFiles: expandedPaths.length ? expandedPaths : files.map(file => path.isAbsolute(file) ? file : path.join(schemaDir, file)),
    loaded: true
  };

  return {
    ...libraryBase,
    templates: schemaLibraryToTemplates(libraryBase)
  };
}

export function createEmptySchemaLibrary(error?: string): SchemaLibrary {
  return {
    events: [],
    conditions: [],
    actions: [],
    controlFlow: [],
    simpleTypes: {},
    templates: [],
    sourceFiles: [],
    loaded: false,
    error
  };
}
