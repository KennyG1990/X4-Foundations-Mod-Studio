/** Effective read-only X4 document resolver: base plus official ego_dlc_* overlays. */

import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { DOMParser } from '@xmldom/xmldom';
import { simulateXmlDiff, type DiffFinding } from './diffSimulator';

export interface OverlaySource {
  source: 'base' | `ego_dlc_${string}`;
  path: string;
  mode: 'base' | 'replace' | 'diff';
}

export interface OverlayFinding extends DiffFinding {
  source: string;
  path: string;
}

export interface EffectiveReferenceDocument {
  available: boolean;
  root: string;
  relativePath: string;
  content?: string;
  sources: OverlaySource[];
  findings: OverlayFinding[];
  signature: string;
}

interface DlcInfo {
  folder: string;
  id: `ego_dlc_${string}`;
  root: string;
  dependencies: string[];
}

const cache = new Map<string, EffectiveReferenceDocument>();
const cacheSizes = new Map<string, number>();
let cacheBytes = 0;
const MAX_CACHE_BYTES = 64 * 1024 * 1024;
const MAX_CACHE_ENTRIES = 64;

function cached(key: string, signature: string): EffectiveReferenceDocument | null {
  const value = cache.get(key);
  if (!value || value.signature !== signature) return null;
  // Map insertion order is the LRU order.
  cache.delete(key);
  cache.set(key, value);
  return value;
}

function storeCached(key: string, value: EffectiveReferenceDocument): void {
  const priorSize = cacheSizes.get(key) || 0;
  cacheBytes -= priorSize;
  cache.delete(key);
  cacheSizes.delete(key);
  const size = (value.content?.length || 0) * 2 + JSON.stringify({ sources: value.sources, findings: value.findings }).length * 2;
  // A single oversized document is still returned, but not retained indefinitely.
  if (size > MAX_CACHE_BYTES) return;
  cache.set(key, value);
  cacheSizes.set(key, size);
  cacheBytes += size;
  while (cache.size > MAX_CACHE_ENTRIES || cacheBytes > MAX_CACHE_BYTES) {
    const oldest = cache.keys().next().value as string | undefined;
    if (!oldest) break;
    cache.delete(oldest);
    cacheBytes -= cacheSizes.get(oldest) || 0;
    cacheSizes.delete(oldest);
  }
}

export function getReferenceOverlayCacheStats(): { entries: number; bytes: number; maxBytes: number } {
  return { entries: cache.size, bytes: cacheBytes, maxBytes: MAX_CACHE_BYTES };
}

function normalizeRelative(relativeInput: string): string {
  const raw = String(relativeInput || '').replace(/\\/g, '/').replace(/^\.\//, '');
  if (!raw || path.posix.isAbsolute(raw) || /^[A-Za-z]:/.test(raw)) throw new Error('Invalid request: a vanilla-relative path is required.');
  const normalized = path.posix.normalize(raw);
  if (normalized === '..' || normalized.startsWith('../') || normalized.includes('/../')) throw new Error('Directory traversal detected.');
  return normalized;
}

function safeJoin(root: string, relative: string): string {
  const target = path.resolve(root, ...relative.split('/'));
  const rel = path.relative(path.resolve(root), target);
  if (rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) throw new Error('Directory traversal detected.');
  return target;
}

function sniffRoot(xml: string): string | null {
  const match = /<(?!\?|!)([A-Za-z_][\w.:-]*)/.exec(xml.slice(0, 32768).replace(/<!--[\s\S]*?-->/g, ''));
  return match ? match[1].toLowerCase() : null;
}

function readDlcInfo(extensionRoot: string, folder: string): DlcInfo {
  const root = path.join(extensionRoot, folder);
  const contentPath = path.join(root, 'content.xml');
  let id = folder.toLowerCase();
  const dependencies: string[] = [];
  try {
    const xml = fs.readFileSync(contentPath, 'utf8').replace(/^\uFEFF/, '');
    const document = new DOMParser({ onError: () => undefined }).parseFromString(xml, 'text/xml');
    const content = document.documentElement;
    if (content?.getAttribute('id')) id = content.getAttribute('id')!.toLowerCase();
    const nodes = content?.getElementsByTagName('dependency') || [];
    for (let index = 0; index < nodes.length; index++) {
      const dependency = nodes[index].getAttribute('id');
      if (dependency) dependencies.push(dependency.toLowerCase());
    }
  } catch { /* a missing content.xml falls back to deterministic folder order */ }
  return { folder, id: id as `ego_dlc_${string}`, root, dependencies };
}

/** content.xml dependencies are explicitly documented by Egosoft as extension load order. */
export function discoverOfficialDlcOrder(referenceRoot: string): DlcInfo[] {
  const extensionRoot = path.join(referenceRoot, 'extensions');
  let folders: string[] = [];
  try {
    folders = fs.readdirSync(extensionRoot, { withFileTypes: true })
      .filter(entry => entry.isDirectory() && /^ego_dlc_/i.test(entry.name))
      .map(entry => entry.name)
      .sort((a, b) => a.localeCompare(b));
  } catch { return []; }
  const infos = folders.map(folder => readDlcInfo(extensionRoot, folder));
  const byId = new Map<string, DlcInfo>(infos.map(info => [info.id, info]));
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const ordered: DlcInfo[] = [];
  const visit = (info: DlcInfo) => {
    if (visited.has(info.id)) return;
    if (visiting.has(info.id)) return; // corrupt cycle: deterministic lexical fallback finishes it
    visiting.add(info.id);
    for (const dependency of info.dependencies) {
      const local = byId.get(dependency);
      if (local) visit(local);
    }
    visiting.delete(info.id);
    visited.add(info.id);
    ordered.push(info);
  };
  for (const info of infos) visit(info);
  return ordered;
}

function signatureFor(paths: string[]): string {
  const parts: string[] = [];
  for (const file of paths) {
    try {
      const stat = fs.statSync(file);
      parts.push(`${file.toLowerCase()}|${stat.size}|${Math.floor(stat.mtimeMs)}|${Math.floor(stat.ctimeMs)}`);
    } catch { parts.push(`${file.toLowerCase()}|missing`); }
  }
  return crypto.createHash('sha256').update(parts.join('\n')).digest('hex');
}

export function resolveEffectiveReferenceDocument(referenceRootInput: string, relativeInput: string, force = false): EffectiveReferenceDocument {
  const root = path.resolve(referenceRootInput);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) throw new Error(`Reference root unavailable or not a directory: ${root}`);
  const relativePath = normalizeRelative(relativeInput);
  const dlcs = discoverOfficialDlcOrder(root);
  const basePath = safeJoin(root, relativePath);
  const candidatePaths = [basePath, ...dlcs.flatMap(dlc => [path.join(dlc.root, 'content.xml'), safeJoin(dlc.root, relativePath)])];
  const signature = signatureFor(candidatePaths);
  const key = `${root.toLowerCase()}|${relativePath.toLowerCase()}`;
  const previous = !force ? cached(key, signature) : null;
  if (previous) return previous;

  let content: string | undefined;
  const sources: OverlaySource[] = [];
  const findings: OverlayFinding[] = [];
  if (fs.existsSync(basePath) && fs.statSync(basePath).isFile()) {
    content = fs.readFileSync(basePath, 'utf8');
    sources.push({ source: 'base', path: relativePath, mode: 'base' });
  }
  for (const dlc of dlcs) {
    const absolute = safeJoin(dlc.root, relativePath);
    if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) continue;
    const overlay = fs.readFileSync(absolute, 'utf8');
    const sourcePath = `extensions/${dlc.folder}/${relativePath}`;
    if (sniffRoot(overlay) === 'diff') {
      if (content === undefined) {
        findings.push({
          severity: 'warning', code: 'DIFF_SELECTOR_ZERO', source: dlc.id, path: sourcePath,
          message: `${dlc.id} supplies a diff for ${relativePath}, but no earlier base document exists.`,
        });
        continue;
      }
      const result = simulateXmlDiff(content, overlay);
      content = result.content;
      sources.push({ source: dlc.id, path: sourcePath, mode: 'diff' });
      findings.push(...result.findings.map(finding => ({ ...finding, source: dlc.id, path: sourcePath })));
    } else {
      const hadContent = content !== undefined;
      content = overlay;
      sources.push({ source: dlc.id, path: sourcePath, mode: hadContent ? 'replace' : 'base' });
    }
  }

  const result: EffectiveReferenceDocument = {
    available: content !== undefined,
    root,
    relativePath,
    content,
    sources,
    findings,
    signature,
  };
  storeCached(key, result);
  return result;
}

export interface ReferenceOverlayCheck { name: string; pass: boolean; detail?: string }

export function runReferenceOverlaySelftest(): { pass: boolean; allPassed: boolean; passed: number; total: number; checks: ReferenceOverlayCheck[] } {
  const checks: ReferenceOverlayCheck[] = [];
  const check = (name: string, pass: boolean, detail?: string) => checks.push({ name, pass, detail });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'x4forge-overlay-'));
  const write = (relative: string, content: string) => {
    const absolute = path.join(tmp, ...relative.split('/'));
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, content, 'utf8');
  };
  try {
    write('libraries/test.xml', '<root><item id="base"/><item id="remove"/></root>');
    write('extensions/ego_dlc_a/content.xml', '<content id="ego_dlc_a"/>');
    write('extensions/ego_dlc_a/libraries/test.xml', '<diff><add sel="/root"><item id="a"/></add><remove sel="/root/item[@id=\'remove\']"/></diff>');
    write('extensions/ego_dlc_b/content.xml', '<content id="ego_dlc_b"><dependency id="ego_dlc_a" optional="true"/></content>');
    write('extensions/ego_dlc_b/libraries/test.xml', '<diff><add sel="/root/item[@id=\'a\']" pos="after"><item id="b"/></add></diff>');
    write('extensions/community/libraries/test.xml', '<diff><add sel="/root"><item id="wrong"/></add></diff>');
    const before = fs.statSync(path.join(tmp, 'libraries', 'test.xml')).mtimeMs;
    const effective = resolveEffectiveReferenceDocument(tmp, 'libraries/test.xml', true);
    const after = fs.statSync(path.join(tmp, 'libraries', 'test.xml')).mtimeMs;
    check('base plus dependency-ordered DLC diffs', effective.available && /id="base"/.test(effective.content || '')
      && /id="a"/.test(effective.content || '') && /id="b"/.test(effective.content || '') && !/id="remove"/.test(effective.content || ''));
    check('community extensions excluded', !/id="wrong"/.test(effective.content || ''));
    check('resolver is read-only', before === after);
    check('source provenance', effective.sources.map(source => source.source).join(',') === 'base,ego_dlc_a,ego_dlc_b');
    fs.rmSync(path.join(tmp, 'extensions', 'ego_dlc_b'), { recursive: true, force: true });
    const refreshed = resolveEffectiveReferenceDocument(tmp, 'libraries/test.xml');
    check('DLC removal invalidates cache', !/id="b"/.test(refreshed.content || '') && effective.signature !== refreshed.signature);
    const stats = getReferenceOverlayCacheStats();
    check('effective document cache stays byte bounded', stats.bytes <= stats.maxBytes && stats.entries <= MAX_CACHE_ENTRIES, JSON.stringify(stats));
    let traversal = false;
    try { resolveEffectiveReferenceDocument(tmp, '../outside.xml'); } catch (error) { traversal = /traversal/i.test(String(error)); }
    check('traversal rejected', traversal);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  const passed = checks.filter(entry => entry.pass).length;
  return { pass: passed === checks.length, allPassed: passed === checks.length, passed, total: checks.length, checks };
}
