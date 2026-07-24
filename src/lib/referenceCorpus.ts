/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Canonical loose/unpacked X4 reference corpus.
 *
 * This deliberately reads ONLY the configured unpacked reference root plus official
 * `extensions/ego_dlc_*` overlays. Mod workspaces and arbitrary extensions never teach
 * these sets. X4 diff payloads are treated as an ID union (base first, then sorted DLCs),
 * which is sufficient for existence checks and preserves first-definition provenance.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { DOMParser } from '@xmldom/xmldom';
import { parseScriptProperties } from './scriptProperties';
import { parseLocalizationXml, resolveLocName, type LocalizationMap } from './x4ObjectIndex';
import { listReferenceManifestFiles } from './referenceManifest';

export type ReferenceSource = 'base' | `ego_dlc_${string}`;
export type FactionCategory = 'political' | 'player' | 'system' | 'hostile';

export interface FactionReference {
  id: string;
  name: string;
  source: ReferenceSource;
  category: FactionCategory;
  /** Derived authoring filter: true only for diplomacy-capable political factions. */
  isreal: boolean;
}

export interface WareReference {
  id: string;
  name: string;
  group: string;
  tags: string[];
  source: ReferenceSource;
}

export interface SectorReference {
  id: string;
  name: string;
  source: ReferenceSource;
}

export interface ScriptPropertyRecord {
  name: string;
  result: string;
  type: string;
}

export interface ScriptPropertyReference {
  kind: 'keyword' | 'datatype';
  name: string;
  parent?: string;
  dynamic: boolean;
  dynamicResultType?: string;
  properties: ScriptPropertyRecord[];
  /** Function-like selector properties; X4 stores these as `<property>` records too. */
  functions: ScriptPropertyRecord[];
}

export interface ReferenceCorpus {
  root: string;
  generatedAt: string;
  signature: string;
  /** Complete all-file manifest generation used for discovery, when available. */
  manifestGeneration?: string;
  sourceFiles: string[];
  factions: FactionReference[];
  wares: WareReference[];
  sectors: SectorReference[];
  scriptProperties: ScriptPropertyReference[];
  references: {
    macros: Set<string>;
    wares: Set<string>;
    factions: Set<string>;
    sectors: Set<string>;
  };
}

type ReferenceFileKind = 'factions' | 'wares' | 'scriptproperties' | 'localization' | 'map' | 'macro-index';
interface ReferenceFile { absolute: string; relative: string; source: ReferenceSource; kind: ReferenceFileKind }

let cache: { root: string; signature: string; corpus: ReferenceCorpus; checkedAt: number } | null = null;
const REFERENCE_SIGNATURE_CHECK_MS = 1000;

function isDirectory(p: string): boolean {
  try { return fs.statSync(p).isDirectory(); } catch { return false; }
}

function isFile(p: string): boolean {
  try { return fs.statSync(p).isFile(); } catch { return false; }
}

function forward(p: string): string { return p.replace(/\\/g, '/'); }

function labelFromId(id: string): string {
  return id.replace(/_macro$/i, '').replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function attrs(el: any, name: string): string {
  return String(el?.getAttribute?.(name) || '');
}

function parseXml(xml: string): any | null {
  try {
    // Several canonical index files begin with a UTF-8 BOM. xmldom otherwise
    // treats the following XML declaration as position 1 and rejects the file.
    const normalized = xml.replace(/^\uFEFF/, '');
    const doc = new DOMParser({ onError: () => { /* tolerate recoverable corpus noise */ } }).parseFromString(normalized, 'text/xml');
    return doc?.documentElement ? doc : null;
  } catch { return null; }
}

function walkXml(dir: string, out: string[]): void {
  let entries: fs.Dirent[];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkXml(full, out);
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.xml')) out.push(full);
  }
}

function referenceKind(relativeInput: string): ReferenceFileKind | null {
  const relative = forward(relativeInput).toLowerCase();
  const parts = relative.split('/');
  const inner = parts[0] === 'extensions' && parts.length > 2 ? parts.slice(2).join('/') : relative;
  if (inner === 'libraries/factions.xml') return 'factions';
  if (inner === 'libraries/wares.xml') return 'wares';
  if (inner === 'libraries/scriptproperties.xml') return 'scriptproperties';
  if (inner === 'index/macros.xml') return 'macro-index';
  if (inner.startsWith('t/') && /-l044\.xml$/i.test(inner)) return 'localization';
  if (inner.startsWith('maps/') && inner.endsWith('.xml')) return 'map';
  return null;
}

function discoverReferenceFiles(rootInput: string): { files: ReferenceFile[]; manifestGeneration?: string } {
  const root = path.resolve(rootInput);
  if (!isDirectory(root)) return { files: [] };
  const manifest = listReferenceManifestFiles(root, { consumer: 'reference-corpus' }, 10_000);
  if (manifest) {
    const files = manifest.files
      .map(record => {
        const kind = referenceKind(record.path);
        if (!kind || (record.source !== 'base' && !/^ego_dlc_/i.test(record.source))) return null;
        const absolute = path.join(root, ...record.path.split('/'));
        if (!isFile(absolute)) return null;
        return { absolute, relative: record.path, source: record.source as ReferenceSource, kind } satisfies ReferenceFile;
      })
      .filter((file): file is ReferenceFile => Boolean(file))
      .sort((a, b) => (Number(a.source !== 'base') - Number(b.source !== 'base')) || a.source.localeCompare(b.source) || a.relative.localeCompare(b.relative));
    if (files.length) return { files, manifestGeneration: manifest.generation };
  }
  const files: ReferenceFile[] = [];
  const seen = new Set<string>();
  const add = (absolute: string, source: ReferenceSource, kind: ReferenceFileKind) => {
    if (!isFile(absolute)) return;
    const key = absolute.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    files.push({ absolute, relative: forward(path.relative(root, absolute)), source, kind });
  };
  const addTree = (dir: string, source: ReferenceSource, kind: ReferenceFileKind, filter?: (p: string) => boolean) => {
    const found: string[] = [];
    if (isDirectory(dir)) walkXml(dir, found);
    found.sort((a, b) => a.localeCompare(b));
    for (const f of found) if (!filter || filter(f)) add(f, source, kind);
  };
  const addSource = (base: string, source: ReferenceSource) => {
    add(path.join(base, 'libraries', 'factions.xml'), source, 'factions');
    add(path.join(base, 'libraries', 'wares.xml'), source, 'wares');
    add(path.join(base, 'libraries', 'scriptproperties.xml'), source, 'scriptproperties');
    add(path.join(base, 'index', 'macros.xml'), source, 'macro-index');
    addTree(path.join(base, 't'), source, 'localization', p => /-l044\.xml$/i.test(p));
    addTree(path.join(base, 'maps'), source, 'map');
  };

  addSource(root, 'base');
  const extRoot = path.join(root, 'extensions');
  let extensions: fs.Dirent[] = [];
  try { extensions = fs.readdirSync(extRoot, { withFileTypes: true }); } catch { /* no DLC folder */ }
  for (const ext of extensions.filter(e => e.isDirectory() && /^ego_dlc_/i.test(e.name)).sort((a, b) => a.name.localeCompare(b.name))) {
    addSource(path.join(extRoot, ext.name), ext.name.toLowerCase() as ReferenceSource);
  }
  return { files };
}

function signatureFor(files: ReferenceFile[]): string {
  return files.map(f => {
    const s = fs.statSync(f.absolute);
    return `${f.relative.toLowerCase()}|${s.size}|${Math.floor(s.mtimeMs)}|${Math.floor(s.ctimeMs)}`;
  }).join('\n');
}

function factionCategory(id: string, tags: string[]): FactionCategory {
  const tagSet = new Set(tags.map(t => t.toLowerCase()));
  if (id.toLowerCase() === 'player') return 'player';
  if (tagSet.has('hidden')) return 'system';
  if (tagSet.has('nodiplomacyselection') || tagSet.has('aggressive')) return 'hostile';
  return 'political';
}

function parseFactions(files: ReferenceFile[], loc: LocalizationMap): FactionReference[] {
  const found = new Map<string, FactionReference>();
  for (const file of files.filter(f => f.kind === 'factions')) {
    const doc = parseXml(fs.readFileSync(file.absolute, 'utf8'));
    if (!doc) continue;
    const nodes = doc.getElementsByTagName('faction');
    for (let i = 0; i < nodes.length; i++) {
      const el = nodes[i];
      const id = attrs(el, 'id').trim().toLowerCase();
      if (!id || found.has(id)) continue; // base/first introducing DLC owns provenance
      const tags = attrs(el, 'tags').split(/\s+/).filter(Boolean);
      const category = factionCategory(id, tags);
      const rawName = attrs(el, 'name');
      found.set(id, {
        id,
        name: resolveLocName(rawName, loc) || (rawName && !/^\{\s*\d+\s*,/.test(rawName) ? rawName : labelFromId(id)),
        source: file.source,
        category,
        isreal: category === 'political',
      });
    }
  }
  return [...found.values()].sort((a, b) => a.id.localeCompare(b.id));
}

function parseWares(files: ReferenceFile[], loc: LocalizationMap): WareReference[] {
  const found = new Map<string, WareReference>();
  for (const file of files.filter(f => f.kind === 'wares')) {
    const doc = parseXml(fs.readFileSync(file.absolute, 'utf8'));
    if (!doc) continue;
    const nodes = doc.getElementsByTagName('ware');
    for (let i = 0; i < nodes.length; i++) {
      const el = nodes[i];
      const id = attrs(el, 'id').trim().toLowerCase();
      if (!id || found.has(id)) continue;
      const rawName = attrs(el, 'name');
      found.set(id, {
        id,
        name: resolveLocName(rawName, loc) || (rawName && !/^\{\s*\d+\s*,/.test(rawName) ? rawName : labelFromId(id)),
        group: attrs(el, 'group'),
        tags: attrs(el, 'tags').split(/\s+/).filter(Boolean),
        source: file.source,
      });
    }
  }
  return [...found.values()].sort((a, b) => a.id.localeCompare(b.id));
}

function parseSectorsAndMacros(files: ReferenceFile[], loc: LocalizationMap): { sectors: SectorReference[]; macros: Set<string> } {
  const sectors = new Map<string, SectorReference>();
  const macros = new Set<string>();
  for (const file of files.filter(f => f.kind === 'macro-index' || f.kind === 'map')) {
    const doc = parseXml(fs.readFileSync(file.absolute, 'utf8'));
    if (!doc) continue;
    if (file.kind === 'macro-index') {
      const entries = doc.getElementsByTagName('entry');
      for (let i = 0; i < entries.length; i++) {
        const id = attrs(entries[i], 'name').trim().toLowerCase();
        if (id) macros.add(id);
      }
    }
    const nodes = doc.getElementsByTagName('macro');
    for (let i = 0; i < nodes.length; i++) {
      const el = nodes[i];
      const id = attrs(el, 'name').trim().toLowerCase();
      if (!id) continue;
      macros.add(id);
      if (attrs(el, 'class').toLowerCase() !== 'sector' || sectors.has(id)) continue;
      const identifications = el.getElementsByTagName('identification');
      const rawName = identifications.length ? attrs(identifications[0], 'name') : '';
      sectors.set(id, {
        id,
        name: resolveLocName(rawName, loc) || labelFromId(id),
        source: file.source,
      });
    }
  }
  return { sectors: [...sectors.values()].sort((a, b) => a.id.localeCompare(b.id)), macros };
}

function parsePropertyReferences(files: ReferenceFile[]): ScriptPropertyReference[] {
  const found = new Map<string, ScriptPropertyReference>();
  const merge = (
    kind: ScriptPropertyReference['kind'],
    nameInput: string,
    propertiesInput: ScriptPropertyRecord[],
    parent?: string,
    dynamic = false,
    dynamicResultType?: string,
  ) => {
    const name = nameInput.trim().toLowerCase();
    if (!name) return;
    const key = `${kind}:${name}`;
    const existing = found.get(key);
    const propertyMap = new Map((existing?.properties || []).map(property => [property.name, property]));
    for (const property of propertiesInput) propertyMap.set(property.name, { ...property });
    const properties = [...propertyMap.values()];
    found.set(key, existing ? {
      ...existing,
      parent: parent || existing.parent,
      dynamic: existing.dynamic || dynamic,
      dynamicResultType: dynamicResultType || existing.dynamicResultType,
      properties,
      functions: properties.filter(property => /[.<{]/.test(property.name)),
    } : {
      kind,
      name,
      parent,
      dynamic,
      dynamicResultType,
      properties,
      functions: properties.filter(property => /[.<{]/.test(property.name)),
    });
  };
  for (const file of files.filter(f => f.kind === 'scriptproperties')) {
    const xml = fs.readFileSync(file.absolute, 'utf8');
    const model = parseScriptProperties(xml);
    for (const entry of [...model.keywords.values(), ...model.datatypes.values()]) {
      merge(entry.kind, entry.name, entry.properties, entry.parent, entry.dynamic, entry.dynamicResultType);
    }
    // DLC diffs commonly add properties directly to an existing datatype/keyword,
    // with the owner present only in the selector rather than as a payload element.
    const document = parseXml(xml);
    if (!document) continue;
    for (const patchTag of ['add', 'replace']) {
      const patches = document.getElementsByTagName(patchTag);
      for (let i = 0; i < patches.length; i++) {
        const selector = attrs(patches[i], 'sel');
        const owner = selector.match(/(?:^|\/)(datatype|keyword)\s*\[\s*@name\s*=\s*(['"])([^'"]+)\2\s*\]/i);
        if (!owner) continue;
        const propertyNodes = patches[i].getElementsByTagName('property');
        const properties: ScriptPropertyRecord[] = [];
        for (let j = 0; j < propertyNodes.length; j++) {
          const name = attrs(propertyNodes[j], 'name').trim();
          if (name) properties.push({ name, result: attrs(propertyNodes[j], 'result'), type: attrs(propertyNodes[j], 'type') });
        }
        if (properties.length) merge(owner[1].toLowerCase() as ScriptPropertyReference['kind'], owner[3], properties);
      }
    }
  }
  return [...found.values()].sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));
}

function buildCorpus(root: string, files: ReferenceFile[], signature: string, manifestGeneration?: string): ReferenceCorpus {
  const loc: LocalizationMap = new Map();
  for (const file of files.filter(f => f.kind === 'localization')) {
    try { parseLocalizationXml(fs.readFileSync(file.absolute, 'utf8'), loc); } catch { /* one bad language file cannot erase IDs */ }
  }
  const factions = parseFactions(files, loc);
  const wares = parseWares(files, loc);
  const { sectors, macros } = parseSectorsAndMacros(files, loc);
  const factionIds = new Set<string>();
  for (const f of factions) { factionIds.add(f.id); factionIds.add(`faction.${f.id}`); }
  return {
    root,
    generatedAt: new Date().toISOString(),
    signature,
    ...(manifestGeneration ? { manifestGeneration } : {}),
    sourceFiles: files.map(f => f.relative),
    factions,
    wares,
    sectors,
    scriptProperties: parsePropertyReferences(files),
    references: {
      macros,
      wares: new Set(wares.map(w => w.id)),
      factions: factionIds,
      sectors: new Set(sectors.map(s => s.id)),
    },
  };
}

export function clearReferenceCorpusCache(): void { cache = null; }

export function getReferenceCorpus(rootInput: string, force = false): ReferenceCorpus {
  const root = path.resolve(String(rootInput || '').trim());
  if (!isDirectory(root)) throw new Error(`X4 unpacked reference root does not exist or is not a directory: ${root}`);
  const now = Date.now();
  if (!force && cache && cache.root.toLowerCase() === root.toLowerCase() && now - cache.checkedAt < REFERENCE_SIGNATURE_CHECK_MS) {
    return cache.corpus;
  }
  const discovery = discoverReferenceFiles(root);
  const files = discovery.files;
  const signature = signatureFor(files);
  if (!force && cache && cache.root.toLowerCase() === root.toLowerCase() && cache.signature === signature
    && cache.corpus.manifestGeneration === discovery.manifestGeneration) {
    cache.checkedAt = now;
    return cache.corpus;
  }
  const corpus = buildCorpus(root, files, signature, discovery.manifestGeneration);
  cache = { root, signature, corpus, checkedAt: now };
  return corpus;
}

/** Resolve one reference-root-relative file with traversal, absolute-path and symlink containment checks. */
export function resolveReferenceFile(rootInput: string, relativeInput: string): string {
  const root = path.resolve(String(rootInput || '').trim());
  const relative = String(relativeInput || '').trim().replace(/\\/g, '/');
  if (!relative) throw new Error('Missing path parameter.');
  if (path.isAbsolute(relative) || /^[A-Za-z]:/.test(relative) || relative.split('/').includes('..')) {
    throw new Error('Forbidden: Directory traversal detected.');
  }
  if (!isDirectory(root)) throw new Error('X4 unpacked reference root is unavailable.');
  const candidate = path.resolve(root, ...relative.split('/'));
  if (!isFile(candidate)) throw new Error('File not found.');
  const realRoot = fs.realpathSync(root);
  const realCandidate = fs.realpathSync(candidate);
  const rel = path.relative(realRoot, realCandidate);
  if (rel.startsWith('..') || path.isAbsolute(rel)) throw new Error('Forbidden: Directory traversal detected.');
  return realCandidate;
}

/** Synthetic deterministic oracle: no dependency on Ken's installed/unpacked corpus. */
export function runReferenceCorpusSelftest(): {
  allPassed: boolean; pass: boolean; passed: number; total: number;
  checks: Array<{ name: string; pass: boolean; detail?: string }>;
} {
  const checks: Array<{ name: string; pass: boolean; detail?: string }> = [];
  const ok = (name: string, pass: boolean, detail?: string) => checks.push({ name, pass: !!pass, detail });
  const tmp = path.join(os.tmpdir(), `x4-reference-corpus-${process.pid}-${Date.now()}`);
  const write = (rel: string, content: string) => {
    const p = path.join(tmp, ...rel.split('/')); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, content, 'utf8');
  };
  try {
    write('t/0001-l044.xml', '<language id="44"><page id="1"><t id="1">Argon Federation</t><t id="2">Energy Cells</t><t id="3">Test Sector</t></page></language>');
    write('libraries/factions.xml', '<factions><faction id="argon" name="{1,1}" tags="claimspace economic"/><faction id="ownerless" tags="hidden"/></factions>');
    write('libraries/wares.xml', '<wares><ware id="energycells" name="{1,2}" group="energy" tags="economy container"/></wares>');
    write('libraries/scriptproperties.xml', '<scriptproperties><datatype name="faction" type="dbdata"><property name="id" result="ID" type="string"/><property name="name" result="Name" type="string"/></datatype></scriptproperties>');
    write('index/macros.xml', '\uFEFF<?xml version="1.0" encoding="utf-8"?><index><entry name="ship_test_macro" value="assets/ship_test"/></index>');
    write('maps/test/sectors.xml', '<macros><macro name="Cluster_Test_Sector001_macro" class="sector"><properties><identification name="{1,3}"/></properties></macro></macros>');
    clearReferenceCorpusCache();
    const first = getReferenceCorpus(tmp);
    const second = getReferenceCorpus(tmp);
    ok('cache reused while signature unchanged', first === second);
    ok('base faction + derived category', first.factions.find(f => f.id === 'argon')?.isreal === true && first.factions.find(f => f.id === 'ownerless')?.category === 'system');
    ok('localized ware + sector', first.wares[0]?.name === 'Energy Cells' && first.sectors[0]?.name === 'Test Sector');
    ok('macro catalog indexed', first.references.macros.has('ship_test_macro'));
    ok('faction datatype exposes id', first.scriptProperties.find(p => p.kind === 'datatype' && p.name === 'faction')?.properties.some(p => p.name === 'id' && p.type === 'string') === true);
    write('extensions/ego_dlc_test/libraries/factions.xml', '<diff><add sel="/factions"><faction id="dlcfaction" name="DLC" tags="economic"/></add></diff>');
    write('extensions/ego_dlc_test/libraries/scriptproperties.xml', '<diff><add sel="/scriptproperties/datatype[@name=\'faction\']"><property name="dlcproperty" result="DLC value" type="string"/></add></diff>');
    const added = getReferenceCorpus(tmp, true);
    ok('DLC add appears after cache refresh', added !== second && added.factions.some(f => f.id === 'dlcfaction' && f.source === 'ego_dlc_test'));
    ok('DLC scriptproperty overlays base datatype', added.scriptProperties.find(p => p.kind === 'datatype' && p.name === 'faction')?.properties.some(p => p.name === 'dlcproperty' && p.type === 'string') === true);
    fs.rmSync(path.join(tmp, 'extensions', 'ego_dlc_test'), { recursive: true, force: true });
    const removed = getReferenceCorpus(tmp, true);
    ok('DLC removal appears after cache refresh', removed !== added && !removed.factions.some(f => f.id === 'dlcfaction'));
    ok('safe file resolves', resolveReferenceFile(tmp, 'libraries/factions.xml').endsWith(path.join('libraries', 'factions.xml')));
    let traversal = false; try { resolveReferenceFile(tmp, '../outside.xml'); } catch (e) { traversal = /traversal/i.test(String(e)); }
    ok('traversal rejected', traversal);
    let missingRoot = false; try { getReferenceCorpus(path.join(tmp, 'missing-root'), true); } catch (e) { missingRoot = /does not exist/i.test(String(e)); }
    ok('missing reference root fails explicitly', missingRoot);
  } finally {
    clearReferenceCorpusCache();
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* temp cleanup only */ }
  }
  const passed = checks.filter(c => c.pass).length;
  return { allPassed: passed === checks.length, pass: passed === checks.length, passed, total: checks.length, checks };
}
