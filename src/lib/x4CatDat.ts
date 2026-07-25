/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * X4 Foundations packed archive (.cat / .dat) reader.
 *
 * Format (same as X Rebirth):
 *   - A `.cat` file is a UTF-8 manifest. Each non-empty line describes one
 *     packed file as:  `<relative/path> <byteSize> <unixTimestamp> <md5hash>`
 *     The path may itself contain spaces, so the three trailing tokens
 *     (size, timestamp, hash) are parsed from the RIGHT.
 *   - The paired `.dat` file (same basename) is the raw concatenation of every
 *     listed file's bytes, in manifest order, with no separators or headers.
 *     The byte offset of entry N is the sum of all preceding entry sizes.
 *
 * We never read a whole `.dat` into memory — only the exact byte range of the
 * entries we want (via a positioned `fs.readSync`).
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import zlib from 'zlib';
import crypto from 'node:crypto';

export interface CatEntry {
  /** forward-slash normalized relative path, e.g. "libraries/wares.xml" */
  name: string;
  size: number;
  offset: number;
  timestamp?: number;
  md5?: string;
}

export interface CatDatArchive {
  catPath: string;
  datPath: string;
  entries: CatEntry[];
}

/** Parse a single `.cat` manifest into entries with computed byte offsets. */
export function parseCat(catPath: string): CatEntry[] {
  const text = fs.readFileSync(catPath, 'utf8');
  const lines = text.split(/\r?\n/);
  const entries: CatEntry[] = [];
  let offset = 0;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const parts = line.split(' ');
    if (parts.length < 4) continue;
    const size = parseInt(parts[parts.length - 3], 10);
    if (!Number.isFinite(size) || size < 0) continue;
    const name = parts.slice(0, parts.length - 3).join(' ').replace(/\\/g, '/');
    const timestamp = parseInt(parts[parts.length - 2], 10);
    const md5 = parts[parts.length - 1].toLowerCase();
    entries.push({
      name,
      size,
      offset,
      ...(Number.isFinite(timestamp) ? { timestamp } : {}),
      ...(/^[0-9a-f]{32}$/.test(md5) ? { md5 } : {}),
    });
    offset += size;
  }
  return entries;
}

export interface CatDatPackEntry {
  name: string;
  size: number;
  sourcePath?: string;
  content?: string | Buffer;
  expectedSha256?: string;
  timestamp?: number;
}

export interface CatDatPackedEntry {
  name: string;
  size: number;
  md5: string;
  sha256: string;
  timestamp: number;
}

export interface CatDatPackedVolume {
  index: number;
  catPath: string;
  datPath: string;
  bytes: number;
  entries: CatDatPackedEntry[];
}

export interface CatDatPackResult {
  ok: boolean;
  volumes: CatDatPackedVolume[];
  errors: string[];
}

function safeCatalogName(input: string): string | null {
  const normalized = String(input || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalized || normalized.includes('\0') || /[\r\n]/.test(normalized) || /^[a-zA-Z]:\//.test(normalized)) return null;
  const parts = normalized.split('/');
  if (parts.some(part => !part || part === '.' || part === '..')) return null;
  return parts.join('/');
}

function writeAll(fd: number, buffer: Buffer): void {
  let offset = 0;
  while (offset < buffer.length) {
    const written = fs.writeSync(fd, buffer, offset, buffer.length - offset);
    if (written <= 0) throw new Error('catalog data write made no progress');
    offset += written;
  }
}

function appendPackEntry(fd: number, entry: CatDatPackEntry): CatDatPackedEntry {
  const md5 = crypto.createHash('md5');
  const sha256 = crypto.createHash('sha256');
  let written = 0;
  const consume = (chunk: Buffer) => {
    writeAll(fd, chunk);
    md5.update(chunk);
    sha256.update(chunk);
    written += chunk.length;
  };

  if (entry.content !== undefined) {
    consume(Buffer.isBuffer(entry.content) ? entry.content : Buffer.from(entry.content, 'utf8'));
  } else if (entry.sourcePath) {
    const sourceStat = fs.lstatSync(entry.sourcePath);
    if (sourceStat.isSymbolicLink() || !sourceStat.isFile()) throw new Error('catalog source is not a regular file');
    const sourceFd = fs.openSync(entry.sourcePath, 'r');
    const buffer = Buffer.allocUnsafe(1024 * 1024);
    try {
      while (true) {
        const read = fs.readSync(sourceFd, buffer, 0, buffer.length, null);
        if (read <= 0) break;
        consume(buffer.subarray(0, read));
      }
    } finally {
      fs.closeSync(sourceFd);
    }
  } else {
    throw new Error('entry has neither content nor sourcePath');
  }

  if (written !== entry.size) throw new Error(`source size changed (${entry.size} planned, ${written} read)`);
  const sha = sha256.digest('hex');
  if (entry.expectedSha256 && sha !== entry.expectedSha256) {
    throw new Error(`source hash changed (${entry.expectedSha256} planned, ${sha} read)`);
  }
  return {
    name: entry.name,
    size: written,
    md5: md5.digest('hex'),
    sha256: sha,
    timestamp: entry.timestamp ?? 0,
  };
}

/**
 * Stream arbitrary regular files into deterministic X4 extension catalogs.
 * The caller decides which paths remain loose; this function only packs the
 * entries supplied to it. No entry is loaded wholesale unless it was already
 * supplied as generated in-memory content.
 */
export function writeCatDatCatalogs(
  entriesInput: CatDatPackEntry[],
  outputRootInput: string,
  options: { baseName?: string; maxVolumeBytes?: number; startIndex?: number } = {},
): CatDatPackResult {
  const outputRoot = path.resolve(outputRootInput);
  const baseName = String(options.baseName || 'ext').trim();
  const maxVolumeBytes = options.maxVolumeBytes ?? (2 * 1024 * 1024 * 1024);
  const startIndex = options.startIndex ?? 1;
  const errors: string[] = [];
  const volumes: CatDatPackedVolume[] = [];
  if (!/^[a-zA-Z0-9_-]+$/.test(baseName)) errors.push(`Unsafe catalog base name: ${baseName}`);
  if (!Number.isSafeInteger(maxVolumeBytes) || maxVolumeBytes <= 0) errors.push(`Invalid maxVolumeBytes: ${maxVolumeBytes}`);
  if (!Number.isSafeInteger(startIndex) || startIndex < 1 || startIndex > 99) errors.push(`Invalid catalog startIndex: ${startIndex}`);

  const seen = new Map<string, string>();
  const entries: CatDatPackEntry[] = [];
  for (const input of entriesInput) {
    const name = safeCatalogName(input.name);
    if (!name) {
      errors.push(`Unsafe catalog entry path: ${input.name}`);
      continue;
    }
    if (!Number.isSafeInteger(input.size) || input.size < 0) {
      errors.push(`Invalid catalog entry size for ${name}: ${input.size}`);
      continue;
    }
    const key = name.toLocaleLowerCase('en-US');
    const prior = seen.get(key);
    if (prior) {
      errors.push(`Catalog entries collide after case normalization: ${prior} and ${name}`);
      continue;
    }
    seen.set(key, name);
    entries.push({ ...input, name });
  }
  entries.sort((left, right) => left.name.localeCompare(right.name));
  if (errors.length > 0) return { ok: false, volumes, errors };
  fs.mkdirSync(outputRoot, { recursive: true });

  const partitions: CatDatPackEntry[][] = [];
  let current: CatDatPackEntry[] = [];
  let currentBytes = 0;
  for (const entry of entries) {
    if (current.length > 0 && currentBytes + entry.size > maxVolumeBytes) {
      partitions.push(current);
      current = [];
      currentBytes = 0;
    }
    current.push(entry);
    currentBytes += entry.size;
  }
  if (current.length > 0) partitions.push(current);

  for (let index = 0; index < partitions.length; index++) {
    const volumeIndex = startIndex + index;
    if (volumeIndex > 99) {
      errors.push(`Catalog volume index exceeds ext_99: ${volumeIndex}`);
      break;
    }
    const suffix = String(volumeIndex).padStart(2, '0');
    const catPath = path.join(outputRoot, `${baseName}_${suffix}.cat`);
    const datPath = path.join(outputRoot, `${baseName}_${suffix}.dat`);
    const catTemp = `${catPath}.tmp-${process.pid}`;
    const datTemp = `${datPath}.tmp-${process.pid}`;
    if (fs.existsSync(catPath) || fs.existsSync(datPath)) {
      errors.push(`Catalog output already exists: ${catPath} or ${datPath}`);
      break;
    }
    let datFd: number | undefined;
    try {
      datFd = fs.openSync(datTemp, 'wx');
      const packed: CatDatPackedEntry[] = [];
      for (const entry of partitions[index]) packed.push(appendPackEntry(datFd, entry));
      fs.closeSync(datFd);
      datFd = undefined;
      const manifest = packed.map(entry => `${entry.name} ${entry.size} ${entry.timestamp} ${entry.md5}`).join('\n') + '\n';
      fs.writeFileSync(catTemp, manifest, { encoding: 'utf8', flag: 'wx' });
      fs.renameSync(datTemp, datPath);
      fs.renameSync(catTemp, catPath);
      volumes.push({
        index: volumeIndex,
        catPath,
        datPath,
        bytes: packed.reduce((sum, entry) => sum + entry.size, 0),
        entries: packed,
      });
    } catch (error) {
      if (datFd !== undefined) fs.closeSync(datFd);
      for (const candidate of [catTemp, datTemp, catPath, datPath]) {
        try { fs.rmSync(candidate, { force: true }); } catch { /* best effort rollback */ }
      }
      errors.push(`Failed to write catalog volume ${volumeIndex}: ${error instanceof Error ? error.message : String(error)}`);
      break;
    }
  }
  if (errors.length > 0) {
    for (const volume of volumes) {
      for (const outputPath of [volume.catPath, volume.datPath]) {
        try { fs.rmSync(outputPath, { force: true }); } catch { /* best effort rollback */ }
      }
    }
    volumes.length = 0;
  }
  return { ok: errors.length === 0 && volumes.length === partitions.length, volumes, errors };
}

function hashEntryRange(datPath: string, entry: CatEntry, algorithm: 'md5' | 'sha256'): string {
  const hash = crypto.createHash(algorithm);
  const fd = fs.openSync(datPath, 'r');
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  let offset = 0;
  try {
    while (offset < entry.size) {
      const wanted = Math.min(buffer.length, entry.size - offset);
      const read = fs.readSync(fd, buffer, 0, wanted, entry.offset + offset);
      if (read <= 0) throw new Error(`catalog data ended after ${offset}/${entry.size} bytes`);
      hash.update(buffer.subarray(0, read));
      offset += read;
    }
  } finally {
    fs.closeSync(fd);
  }
  return hash.digest('hex');
}

/** Reopen written catalogs through the reader and verify names, sizes, and hashes. */
export function verifyCatDatCatalogs(result: CatDatPackResult): { ok: boolean; checked: number; errors: string[] } {
  const errors = [...result.errors];
  let checked = 0;
  if (!result.ok) return { ok: false, checked, errors };
  for (const volume of result.volumes) {
    try {
      const actual = parseCat(volume.catPath);
      if (actual.length !== volume.entries.length) errors.push(`Catalog entry count mismatch in ${volume.catPath}: ${actual.length} != ${volume.entries.length}`);
      const datSize = fs.statSync(volume.datPath).size;
      if (datSize !== volume.bytes) errors.push(`Catalog data size mismatch in ${volume.datPath}: ${datSize} != ${volume.bytes}`);
      for (let index = 0; index < volume.entries.length; index++) {
        const expected = volume.entries[index];
        const entry = actual[index];
        if (!entry) continue;
        if (entry.name !== expected.name || entry.size !== expected.size) {
          errors.push(`Catalog manifest mismatch at ${volume.index}:${index}: ${entry.name}/${entry.size} != ${expected.name}/${expected.size}`);
          continue;
        }
        if (entry.md5 !== expected.md5) errors.push(`Catalog manifest MD5 mismatch for ${entry.name}`);
        const md5 = hashEntryRange(volume.datPath, entry, 'md5');
        const sha256 = hashEntryRange(volume.datPath, entry, 'sha256');
        if (md5 !== expected.md5) errors.push(`Catalog data MD5 mismatch for ${entry.name}: ${md5} != ${expected.md5}`);
        if (sha256 !== expected.sha256) errors.push(`Catalog data SHA-256 mismatch for ${entry.name}: ${sha256} != ${expected.sha256}`);
        checked++;
      }
    } catch (error) {
      errors.push(`Could not verify catalog ${volume.catPath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return { ok: errors.length === 0 && checked === result.volumes.reduce((sum, volume) => sum + volume.entries.length, 0), checked, errors };
}

/**
 * Enumerate usable `.cat`/`.dat` archive pairs under the given roots.
 * Looks at each root directory itself (base game `01.cat`..`NN.cat`) and one
 * level of `extensions/<id>/` subfolders (DLC `ext_NN.cat`).
 *
 * @param includeSubst include `subst_*.cat` substitution archives (default false).
 */
export function findCatDatArchives(roots: string[], includeSubst = false): CatDatArchive[] {
  const archives: CatDatArchive[] = [];
  const seenCat = new Set<string>();

  const collectFromDir = (dir: string) => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (!e.isFile()) continue;
      const lower = e.name.toLowerCase();
      if (!lower.endsWith('.cat')) continue;
      if (!includeSubst && lower.startsWith('subst_')) continue;
      const catPath = path.join(dir, e.name);
      const datPath = catPath.slice(0, -4) + '.dat';
      const key = catPath.toLowerCase();
      if (seenCat.has(key)) continue;
      if (!fs.existsSync(datPath)) continue;
      seenCat.add(key);
      archives.push({ catPath, datPath, entries: [] });
    }
  };

  for (const root of roots) {
    if (!root) continue;
    let stat: fs.Stats | undefined;
    try {
      stat = fs.statSync(root);
    } catch {
      continue;
    }
    if (!stat.isDirectory()) continue;
    // Base archives in the root itself.
    collectFromDir(root);
    // One level of extension archives.
    const extRoot = path.join(root, 'extensions');
    try {
      if (fs.existsSync(extRoot) && fs.statSync(extRoot).isDirectory()) {
        for (const ext of fs.readdirSync(extRoot, { withFileTypes: true })) {
          if (ext.isDirectory()) collectFromDir(path.join(extRoot, ext.name));
        }
      }
    } catch {
      /* ignore */
    }
  }

  // Sort so lower-numbered base archives come first, archives are deterministic.
  archives.sort((a, b) => a.catPath.toLowerCase().localeCompare(b.catPath.toLowerCase()));
  return archives;
}

/** Read the raw bytes of one entry from its `.dat` using a positioned read. */
export function readEntryBytes(datPath: string, entry: CatEntry): Buffer {
  const fd = fs.openSync(datPath, 'r');
  try {
    const buf = Buffer.allocUnsafe(entry.size);
    let read = 0;
    while (read < entry.size) {
      const n = fs.readSync(fd, buf, read, entry.size - read, entry.offset + read);
      if (n <= 0) break;
      read += n;
    }
    return read === entry.size ? buf : buf.subarray(0, read);
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * Magic-sniffing decoder for packed entry bytes. X4 stores most entries as
 * plain UTF-8, but `.pck` entries (and some others) are gzip- or zlib-
 * compressed. Defensive by design: the cat/dat format is community-documented,
 * not an Egosoft public contract — on any decompression failure we fall back
 * to returning the raw bytes as UTF-8 rather than throwing.
 */
export function decodeEntryBuffer(buf: Buffer): { text: string; encoding: 'plain' | 'gzip' | 'zlib' } {
  if (buf.length >= 2) {
    if (buf[0] === 0x1f && buf[1] === 0x8b) {
      try { return { text: zlib.gunzipSync(buf).toString('utf8'), encoding: 'gzip' }; } catch { /* fall through to raw */ }
    }
    if (buf[0] === 0x78 && ((buf[0] << 8) + buf[1]) % 31 === 0) {
      try { return { text: zlib.inflateSync(buf).toString('utf8'), encoding: 'zlib' }; } catch { /* fall through to raw */ }
    }
  }
  return { text: buf.toString('utf8'), encoding: 'plain' };
}

/** Read one entry as UTF-8 text, transparently decompressing gzip/zlib (.pck) entries. */
export function readEntryText(datPath: string, entry: CatEntry): string {
  return decodeEntryBuffer(readEntryBytes(datPath, entry)).text;
}

export interface ExtractMatch {
  name: string;
  text: string;
  catPath: string;
}

/**
 * Walk all archives under `roots` and extract the text of every entry whose
 * normalized name satisfies `wanted(name)`. Later archives (DLC/patches) take
 * precedence for an identical path, mirroring X4's override order.
 *
 * @param maxBytesPerEntry skip entries larger than this (default 48 MB).
 */
export function extractEntries(
  roots: string[],
  wanted: (name: string) => boolean,
  options: { maxBytesPerEntry?: number; includeSubst?: boolean; dedupeByName?: boolean } = {}
): { matches: ExtractMatch[]; archiveCount: number; entryCount: number } {
  const maxBytes = options.maxBytesPerEntry ?? 48 * 1024 * 1024;
  // Default true: one result per path (last archive wins) — correct for fetching
  // a single base file. Pass false to accumulate EVERY archive's copy, which is
  // required for additive catalogs (each DLC ships its own index/macros.xml and
  // libraries/factions.xml containing only that DLC's additions).
  const dedupe = options.dedupeByName !== false;
  const archives = findCatDatArchives(roots, options.includeSubst);
  const byName = new Map<string, ExtractMatch>();
  const all: ExtractMatch[] = [];
  let entryCount = 0;

  for (const archive of archives) {
    let entries: CatEntry[];
    try {
      entries = parseCat(archive.catPath);
    } catch {
      continue;
    }
    for (const entry of entries) {
      entryCount++;
      if (entry.size <= 0 || entry.size > maxBytes) continue;
      const lname = entry.name.toLowerCase();
      if (!wanted(lname)) continue;
      try {
        const text = readEntryText(archive.datPath, entry);
        const match = { name: entry.name, text, catPath: archive.catPath };
        if (dedupe) {
          byName.set(lname, match); // archives are sorted ascending; later wins
        } else {
          all.push(match);
        }
      } catch {
        /* unreadable entry — skip */
      }
    }
  }

  return { matches: dedupe ? [...byName.values()] : all, archiveCount: archives.length, entryCount };
}

/**
 * Diagnostic helper: enumerate archives under the given roots and, for each,
 * report entry count, whether the key catalog/library files are present, and a
 * small sample of entry names. Used to debug why an install indexes few rows.
 */
export function debugScan(roots: string[], includeSubst = false) {
  const archives = findCatDatArchives(roots, includeSubst);
  const wantedNames = ['index/macros.xml', 'index/components.xml', 'libraries/factions.xml', 'libraries/wares.xml', 'libraries/jobs.xml'];
  const report = archives.map(a => {
    let entries: CatEntry[] = [];
    let parseError: string | null = null;
    try {
      entries = parseCat(a.catPath);
    } catch (e) {
      parseError = String(e?.message || e);
    }
    const names = entries.map(e => e.name.toLowerCase());
    const found: Record<string, boolean> = {};
    for (const w of wantedNames) found[w] = names.includes(w);
    return {
      catPath: a.catPath,
      datExists: fs.existsSync(a.datPath),
      entryCount: entries.length,
      parseError,
      found,
      sampleNames: entries.slice(0, 6).map(e => e.name),
      firstLineRaw: (() => { try { return fs.readFileSync(a.catPath, 'utf8').split(/\r?\n/)[0].slice(0, 160); } catch { return null; } })()
    };
  });
  return { roots, archiveCount: archives.length, archives: report };
}

/**
 * Locate and extract a single game file by its relative path (case-insensitive),
 * e.g. "libraries/wares.xml". Returns the merged/overridden content (last
 * archive wins) or null if not found in any archive.
 */
/**
 * Candidate packed names for a requested path: X4 ships some files as
 * compressed `.pck` siblings of their logical name (e.g. `t/0001.xml` may be
 * stored as `t/0001.pck`). The exact name always wins over an alias.
 */
function pckAliases(target: string): Set<string> {
  const out = new Set<string>([target]);
  out.add(target + '.pck');
  if (/\.(xml|lua)$/.test(target)) out.add(target.replace(/\.(xml|lua)$/, '.pck'));
  return out;
}

export function extractGameFile(roots: string[], relativePath: string): ExtractMatch | null {
  const target = relativePath.replace(/\\/g, '/').toLowerCase().replace(/^\/+/, '');
  const candidates = pckAliases(target);
  const result = extractEntries(roots, name => candidates.has(name), { includeSubst: true });
  const exact = result.matches.find(m => m.name.toLowerCase() === target);
  return exact || result.matches[0] || null;
}

/**
 * Extract a single file from the BASE-GAME archives only — i.e. `.cat`/`.dat`
 * pairs that live directly in the game root, ignoring `extensions/<dlc>/`
 * archives whose copies are additive/partial. This yields the canonical full
 * base file (e.g. the complete `libraries/wares.xml`) that XML `<diff>` patches
 * are authored against. Returns the highest-numbered base archive's copy
 * (later base archives patch earlier ones) or null.
 */
export function extractBaseGameFile(gameRoot: string, relativePath: string): ExtractMatch | null {
  if (!gameRoot) return null;
  const target = relativePath.replace(/\\/g, '/').toLowerCase().replace(/^\/+/, '');
  const candidates = pckAliases(target);
  let stat: fs.Stats | undefined;
  try {
    stat = fs.statSync(gameRoot);
  } catch {
    return null;
  }
  if (!stat.isDirectory()) return null;

  let entriesDir: fs.Dirent[];
  try {
    entriesDir = fs.readdirSync(gameRoot, { withFileTypes: true });
  } catch {
    return null;
  }
  // Root-level .cat files only, sorted ascending so the last (highest patch) wins.
  const cats = entriesDir
    .filter(e => e.isFile() && e.name.toLowerCase().endsWith('.cat') && !e.name.toLowerCase().startsWith('subst_'))
    .map(e => e.name)
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

  let found: ExtractMatch | null = null;
  for (const catName of cats) {
    const catPath = path.join(gameRoot, catName);
    const datPath = catPath.slice(0, -4) + '.dat';
    if (!fs.existsSync(datPath)) continue;
    let entries: CatEntry[];
    try {
      entries = parseCat(catPath);
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!candidates.has(entry.name.toLowerCase())) continue;
      try {
        found = { name: entry.name, text: readEntryText(datPath, entry), catPath };
      } catch {
        /* skip */
      }
    }
  }
  return found;
}

// ---------------------------------------------------------------------------
// T4.1 Inc 0 — spike oracle: prove the cat parse → positioned dat read →
// decompress round-trip against a SYNTHETIC fixture built in os.tmpdir()
// (never a shipped game file). Covers: right-tokenized paths with spaces,
// malformed manifest lines, cumulative offsets, plain/gzip/zlib entries,
// truncated-compressed graceful fallback, cat-without-dat discovery, archive
// override order, and .pck alias resolution.
// ---------------------------------------------------------------------------

export interface CatDatSelftestCheck { name: string; pass: boolean; detail?: string }

export function runCatDatSelftest(): { pass: boolean; checks: CatDatSelftestCheck[] } {
  const checks: CatDatSelftestCheck[] = [];
  const ok = (name: string, pass: boolean, detail?: string) => checks.push({ name, pass, detail });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'x4catdat-selftest-'));
  try {
    const plainV1 = '<wares note="v1"><ware id="a"/></wares>';
    const plainV2 = '<wares note="v2"><ware id="a"/><ware id="b"/></wares>';
    const mdText = '<mdscript name="Packed"><cues><cue name="C1"/></cues></mdscript>';
    const tText = '<language id="44"><t id="1">Hello</t></language>';
    const spacesText = '<doc kind="spaces in path"/>';

    const gz = zlib.gzipSync(Buffer.from(mdText, 'utf8'));
    const zl = zlib.deflateSync(Buffer.from(tText, 'utf8'));
    const corrupt = zlib.gzipSync(Buffer.from('boom', 'utf8')).subarray(0, 8); // truncated gzip

    // 01.cat/.dat — plain v1 + gzip + zlib(.pck) + spaces path + corrupt, then a malformed line.
    const parts1 = [
      { name: 'libraries/plain.xml', data: Buffer.from(plainV1, 'utf8') },
      { name: 'md/packed.xml', data: gz },
      { name: 't/0001.pck', data: zl },
      { name: 'path with spaces/file.xml', data: Buffer.from(spacesText, 'utf8') },
      { name: 'broken/corrupt.xml', data: corrupt }
    ];
    let catLines = '';
    for (const p of parts1) catLines += p.name + ' ' + p.data.length + ' 1700000000 ' + '0'.repeat(32) + '\n';
    catLines += 'malformed line\n';
    fs.writeFileSync(path.join(tmp, '01.cat'), catLines);
    fs.writeFileSync(path.join(tmp, '01.dat'), Buffer.concat(parts1.map(p => p.data)));

    // 02.cat/.dat — overrides libraries/plain.xml (later archive must win).
    const d2 = Buffer.from(plainV2, 'utf8');
    fs.writeFileSync(path.join(tmp, '02.cat'), 'libraries/plain.xml ' + d2.length + ' 1700000001 ' + '1'.repeat(32) + '\n');
    fs.writeFileSync(path.join(tmp, '02.dat'), d2);

    // 03.cat with no paired .dat — discovery must ignore it.
    fs.writeFileSync(path.join(tmp, '03.cat'), 'ghost/file.xml 4 1700000002 ' + '2'.repeat(32) + '\n');

    const entries = parseCat(path.join(tmp, '01.cat'));
    ok('parseCat: 5 entries, malformed line skipped', entries.length === 5, 'got ' + entries.length);
    const offsetsOk = entries.length === 5 && entries.every((e, i) =>
      e.size === parts1[i].data.length &&
      e.offset === parts1.slice(0, i).reduce((s, p) => s + p.data.length, 0));
    ok('parseCat: cumulative offsets and sizes correct', offsetsOk);
    ok('parseCat: spaces-in-path name tokenized from the right',
      entries.length === 5 && entries[3].name === 'path with spaces/file.xml', entries[3] && entries[3].name);

    const datPath = path.join(tmp, '01.dat');
    ok('positioned read: plain entry byte-identical', readEntryBytes(datPath, entries[0]).equals(parts1[0].data));

    const dPlain = decodeEntryBuffer(readEntryBytes(datPath, entries[0]));
    ok('decode: plain entry stays plain', dPlain.encoding === 'plain' && dPlain.text === plainV1, dPlain.encoding);
    const dGz = decodeEntryBuffer(readEntryBytes(datPath, entries[1]));
    ok('decode: gzip entry round-trips to original XML', dGz.encoding === 'gzip' && dGz.text === mdText, dGz.encoding);
    const dZl = decodeEntryBuffer(readEntryBytes(datPath, entries[2]));
    ok('decode: zlib .pck entry round-trips to original XML', dZl.encoding === 'zlib' && dZl.text === tText, dZl.encoding);
    const dBad = decodeEntryBuffer(readEntryBytes(datPath, entries[4]));
    ok('decode: truncated gzip degrades to raw bytes without throwing', dBad.encoding === 'plain');

    const arcs = findCatDatArchives([tmp]);
    ok('discovery: cat without dat ignored (2 archives found)', arcs.length === 2, 'got ' + arcs.length);

    const over = extractGameFile([tmp], 'libraries/plain.xml');
    ok('override order: later archive wins for a shared path',
      !!over && over.text === plainV2 && /02\.cat$/i.test(over.catPath), over ? over.catPath : 'no match');

    const viaAlias = extractGameFile([tmp], 't/0001.xml');
    ok('pck alias: t/0001.xml resolves to stored t/0001.pck, decompressed',
      !!viaAlias && viaAlias.name === 't/0001.pck' && viaAlias.text === tText, viaAlias ? viaAlias.name : 'no match');

    const baseHit = extractBaseGameFile(tmp, 'md/packed.xml');
    ok('extractBaseGameFile: gzip md entry decompressed from root archives',
      !!baseHit && baseHit.text === mdText);
  } catch (e) {
    ok('selftest harness error: ' + String((e && e.message) || e), false);
  } finally {
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* ignore */ }
  }
  return { pass: checks.every(c => c.pass), checks };
}
