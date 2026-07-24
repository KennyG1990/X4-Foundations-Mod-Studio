/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Read-only, generation-swapped inventory of a loose/unpacked X4 corpus.
 * The million-file manifest lives in SQLite under Forge's data directory; vanilla
 * files are never written. A refresh stages a new generation and readers continue
 * using the previous complete generation until the replacement commits.
 */

import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { dataPath } from './dataDir';
import {
  appendReferenceFiles,
  beginReferenceGeneration,
  completeReferenceGeneration,
  failReferenceGeneration,
  isDbAvailable,
  latestReferenceGeneration,
  openStudioDb,
  queryReferenceFiles,
  referenceCoverageRows,
  type DbReferenceFile,
  type DbReferenceGeneration,
  type StudioDb,
} from './db';

export type ReferenceManifestRole = 'grammar' | 'canonical-data' | 'localization' | 'executable-example' | 'asset' | 'signature' | 'unsupported';
export type ReferenceManifestAuthority = 'deterministic' | 'canonical' | 'advisory' | 'existence' | 'none';

export interface ReferenceManifestFile {
  path: string;
  extension: string;
  source: string;
  domain: string;
  role: ReferenceManifestRole;
  authority: ReferenceManifestAuthority;
  consumer: string;
  schemaRole?: string;
  bytes: number;
  mtimeMs: number;
  sha256?: string;
}

export interface ReferenceManifestSummary {
  generation: string;
  root: string;
  generatedAt: string;
  totalFiles: number;
  totalBytes: number;
  counts: Record<string, any>;
}

export interface ReferenceManifestStatus {
  available: boolean;
  state: 'unavailable' | 'idle' | 'scanning' | 'ready' | 'stale' | 'error';
  root: string;
  database?: string;
  current?: ReferenceManifestSummary;
  scanning?: { generation: string; files: number; bytes: number; startedAt: string };
  error?: string;
}

const ASSET_EXTENSIONS = new Set([
  '.ani', '.dds', '.gz', '.jcs', '.jpg', '.jpeg', '.map', '.ogg', '.png', '.psb', '.tga',
  '.wav', '.xac', '.xmf', '.xpm', '.xpl', '.xsm',
]);
const SCRIPT_EXTENSIONS = new Set(['.lua', '.js', '.ts', '.glsl']);
const REFERENCE_CONSUMER_PATHS = new Set([
  'libraries/factions.xml', 'libraries/wares.xml', 'libraries/scriptproperties.xml', 'index/macros.xml',
]);
const scanState = new Map<string, {
  generation: string; startedAt: string; files: number; bytes: number; error?: string; promise: Promise<ReferenceManifestSummary>;
}>();
const lastScanErrors = new Map<string, string>();
let database: StudioDb | null | undefined;

function rootKey(root: string): string { return path.resolve(root).replace(/\\/g, '/').toLowerCase(); }
function normalizedRoot(root: string): string { return path.resolve(String(root || '').trim()); }
function manifestDb(): StudioDb | null {
  if (database !== undefined) return database;
  database = isDbAvailable().available ? openStudioDb(dataPath('reference-manifest')) : null;
  return database;
}

function sourceAndDomain(relative: string): { source: string; domain: string; official: boolean } {
  const parts = relative.split('/');
  if (parts[0]?.toLowerCase() === 'extensions' && parts[1]) {
    const source = parts[1].toLowerCase();
    return { source, domain: (parts[2] || 'root').toLowerCase(), official: /^ego_dlc_/i.test(source) };
  }
  return { source: 'base', domain: (parts[0] || 'root').toLowerCase(), official: true };
}

function schemaRole(relative: string, source: string, domain: string): string | undefined {
  if (!relative.toLowerCase().endsWith('.xsd')) return undefined;
  if (source !== 'base') return /^ego_dlc_/i.test(source) ? 'dlc-variant' : 'extension-schema';
  if (domain === 'libraries') return 'canonical-library';
  if (domain === 'md' || domain === 'aiscripts') return 'include-shim';
  if (relative.toLowerCase().startsWith('ui/core/')) return 'ui-schema';
  return 'base-variant';
}

export function classifyReferencePath(relativeInput: string): Omit<ReferenceManifestFile, 'bytes' | 'mtimeMs' | 'sha256'> {
  const relative = relativeInput.replace(/\\/g, '/').replace(/^\/+/, '');
  const lower = relative.toLowerCase();
  const extension = path.posix.extname(lower);
  const { source, domain, official } = sourceAndDomain(relative);
  const xsdRole = schemaRole(relative, source, domain);
  let role: ReferenceManifestRole = 'unsupported';
  let authority: ReferenceManifestAuthority = 'none';
  let consumer = 'unconsumed';

  if (extension === '.xsd') {
    role = 'grammar'; authority = 'deterministic';
    consumer = xsdRole === 'canonical-library' || xsdRole === 'ui-schema' ? 'schema-registry' : 'schema-variant';
  } else if (extension === '.sig') {
    role = 'signature'; authority = 'none';
  } else if (extension === '.xml' && domain === 't') {
    role = 'localization'; authority = official ? 'canonical' : 'advisory';
    consumer = official && /-l044\.xml$/i.test(lower) ? 'reference-corpus' : 'unconsumed';
  } else if (extension === '.xml' && official && (domain === 'libraries' || domain === 'maps' || domain === 'index')) {
    role = 'canonical-data'; authority = 'canonical';
    const sourceRelative = source === 'base' ? lower : lower.split('/').slice(2).join('/');
    consumer = REFERENCE_CONSUMER_PATHS.has(sourceRelative) || domain === 'maps' ? 'reference-corpus' : 'unconsumed';
  } else if (extension === '.xml' || SCRIPT_EXTENSIONS.has(extension)) {
    role = 'executable-example'; authority = 'advisory';
  } else if (ASSET_EXTENSIONS.has(extension)) {
    role = 'asset'; authority = 'existence'; consumer = 'asset-index';
  }

  return { path: relative, extension, source, domain, role, authority, consumer, schemaRole: xsdRole };
}

function generationSummary(row: DbReferenceGeneration): ReferenceManifestSummary {
  let counts: Record<string, any> = {};
  try { counts = JSON.parse(row.counts_json || '{}'); } catch { counts = {}; }
  return {
    generation: row.id, root: row.root, generatedAt: row.completed_at || row.started_at,
    totalFiles: Number(row.total_files), totalBytes: Number(row.total_bytes), counts,
  };
}

function toPublicFile(row: DbReferenceFile): ReferenceManifestFile {
  return {
    path: row.rel_path, extension: row.extension, source: row.source, domain: row.domain,
    role: row.role as ReferenceManifestRole, authority: row.authority as ReferenceManifestAuthority,
    consumer: row.consumer, ...(row.schema_role ? { schemaRole: row.schema_role } : {}),
    bytes: Number(row.bytes), mtimeMs: Number(row.mtime_ms), ...(row.sha256 ? { sha256: row.sha256 } : {}),
  };
}

async function hashFile(file: string): Promise<string> {
  const content = await fsp.readFile(file);
  return crypto.createHash('sha256').update(content).digest('hex');
}

async function scan(root: string, db: StudioDb, state: ReturnType<typeof scanState.get> & {}): Promise<ReferenceManifestSummary> {
  const generation = state.generation;
  beginReferenceGeneration(db, { id: generation, root_key: rootKey(root), root, started_at: state.startedAt });
  const queue = [root];
  const batch: DbReferenceFile[] = [];
  const byExtension: Record<string, number> = {};
  const byDomain: Record<string, number> = {};
  const byRole: Record<string, number> = {};
  const bySource: Record<string, number> = {};
  const byConsumer: Record<string, number> = {};
  const inc = (record: Record<string, number>, key: string) => { record[key || '(none)'] = (record[key || '(none)'] || 0) + 1; };
  const flush = async () => {
    if (!batch.length) return;
    appendReferenceFiles(db, batch.splice(0, batch.length));
    await new Promise<void>(resolve => setImmediate(resolve));
  };

  try {
    while (queue.length) {
      const dir = queue.shift()!;
      let entries: fs.Dirent[];
      try { entries = await fsp.readdir(dir, { withFileTypes: true }); } catch { continue; }
      const files: fs.Dirent[] = [];
      for (const entry of entries) {
        const absolute = path.join(dir, entry.name);
        if (entry.isDirectory()) queue.push(absolute);
        else if (entry.isFile()) files.push(entry);
      }
      for (let start = 0; start < files.length; start += 128) {
        const chunk = files.slice(start, start + 128);
        const rows = await Promise.all(chunk.map(async entry => {
          const absolute = path.join(dir, entry.name);
          try {
            const stat = await fsp.stat(absolute);
            const relative = path.relative(root, absolute).replace(/\\/g, '/');
            const classified = classifyReferencePath(relative);
            const sha256 = classified.extension === '.xsd' ? await hashFile(absolute) : undefined;
            return { generation_id: generation, rel_path: classified.path, extension: classified.extension,
              source: classified.source, domain: classified.domain, role: classified.role, authority: classified.authority,
              consumer: classified.consumer, schema_role: classified.schemaRole, bytes: stat.size,
              mtime_ms: stat.mtimeMs, sha256 } satisfies DbReferenceFile;
          } catch { return null; }
        }));
        for (const row of rows) {
          if (!row) continue;
          batch.push(row); state.files++; state.bytes += row.bytes;
          inc(byExtension, row.extension); inc(byDomain, row.domain); inc(byRole, row.role);
          inc(bySource, row.source); inc(byConsumer, row.consumer);
        }
        if (batch.length >= 4096) await flush();
      }
    }
    await flush();
    const completedAt = new Date().toISOString();
    const counts = { byExtension, byDomain, byRole, bySource, byConsumer };
    completeReferenceGeneration(db, generation, completedAt, state.files, state.bytes, counts);
    const summary = { generation, root, generatedAt: completedAt, totalFiles: state.files, totalBytes: state.bytes, counts };
    lastScanErrors.delete(rootKey(root));
    scanState.delete(rootKey(root));
    return summary;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    state.error = message;
    lastScanErrors.set(rootKey(root), message);
    failReferenceGeneration(db, generation, new Date().toISOString(), message);
    scanState.delete(rootKey(root));
    throw error;
  }
}

export function scheduleReferenceManifest(rootInput: string, force = false): ReferenceManifestStatus {
  const root = normalizedRoot(rootInput);
  const key = rootKey(root);
  let validRoot = false;
  try { validRoot = Boolean(rootInput.trim() && fs.existsSync(root) && fs.statSync(root).isDirectory()); } catch { validRoot = false; }
  if (!validRoot) {
    return { available: false, state: 'unavailable', root, error: `X4 unpacked root is not a directory: ${root}` };
  }
  const db = manifestDb();
  if (!db) return { available: false, state: 'unavailable', root, error: isDbAvailable().reason || 'SQLite unavailable' };
  const currentRow = latestReferenceGeneration(db, key);
  let active = scanState.get(key);
  if ((!currentRow || force) && !active) {
    const generation = `${Date.now()}-${crypto.randomBytes(5).toString('hex')}`;
    const startedAt = new Date().toISOString();
    const placeholder: any = { generation, startedAt, files: 0, bytes: 0, promise: null };
    placeholder.promise = scan(root, db, placeholder);
    // Status/startup callers deliberately do not await background scans. Attach a rejection
    // observer so a filesystem failure becomes manifest status instead of an unhandled promise;
    // refreshReferenceManifest still awaits the original promise and receives the rejection.
    void placeholder.promise.catch(() => undefined);
    active = placeholder;
    scanState.set(key, active!);
  }
  const current = currentRow ? generationSummary(currentRow) : undefined;
  if (active) return {
    available: Boolean(current), state: current ? 'stale' : 'scanning', root, database: db.path, current,
    scanning: { generation: active.generation, files: active.files, bytes: active.bytes, startedAt: active.startedAt },
    ...(active.error ? { error: active.error } : {}),
  };
  const lastError = lastScanErrors.get(key);
  if (lastError) return { available: Boolean(current), state: current ? 'stale' : 'error', root, database: db.path, current, error: lastError };
  return { available: true, state: 'ready', root, database: db.path, current };
}

export async function refreshReferenceManifest(rootInput: string): Promise<ReferenceManifestSummary> {
  const status = scheduleReferenceManifest(rootInput, true);
  const active = scanState.get(rootKey(normalizedRoot(rootInput)));
  if (!active) {
    if (status.current) return status.current;
    throw new Error(status.error || 'Reference manifest scan did not start.');
  }
  return active.promise;
}

export function getReferenceManifestStatus(rootInput: string): ReferenceManifestStatus {
  const root = normalizedRoot(rootInput);
  const key = rootKey(root);
  let validRoot = false;
  try { validRoot = Boolean(rootInput.trim() && fs.existsSync(root) && fs.statSync(root).isDirectory()); } catch { validRoot = false; }
  if (!validRoot) return { available: false, state: 'unavailable', root, error: `X4 unpacked root is not a directory: ${root}` };
  const db = manifestDb();
  if (!db) return { available: false, state: 'unavailable', root, error: isDbAvailable().reason || 'SQLite unavailable' };
  const currentRow = latestReferenceGeneration(db, key);
  const current = currentRow ? generationSummary(currentRow) : undefined;
  const active = scanState.get(key);
  if (active) return {
    available: Boolean(current), state: current ? 'stale' : 'scanning', root, database: db.path, current,
    scanning: { generation: active.generation, files: active.files, bytes: active.bytes, startedAt: active.startedAt },
    ...(active.error ? { error: active.error } : {}),
  };
  const lastError = lastScanErrors.get(key);
  if (lastError) return { available: Boolean(current), state: current ? 'stale' : 'error', root, database: db.path, current, error: lastError };
  if (!current) return { available: false, state: 'idle', root, database: db.path };
  return { available: true, state: 'ready', root, database: db.path, current };
}

export function queryReferenceManifest(rootInput: string, filters: {
  q?: string; extension?: string; source?: string; domain?: string; role?: string; authority?: string; consumer?: string; limit?: number; offset?: number;
}): { generation: string; total: number; limit: number; offset: number; files: ReferenceManifestFile[] } | null {
  const root = normalizedRoot(rootInput);
  const db = manifestDb();
  if (!db) return null;
  const current = latestReferenceGeneration(db, rootKey(root));
  if (!current) return null;
  const result = queryReferenceFiles(db, current.id, filters);
  const requestedLimit = Number.isFinite(filters.limit) ? Number(filters.limit) : 100;
  const requestedOffset = Number.isFinite(filters.offset) ? Number(filters.offset) : 0;
  const limit = Math.max(1, Math.min(requestedLimit, 500));
  const offset = Math.max(0, Math.min(requestedOffset, 5_000_000));
  return { generation: current.id, total: result.total, limit, offset, files: result.files.map(toPublicFile) };
}

/** Internal bounded bulk read for manifest consumers. A filter is required so callers
 * cannot accidentally materialize the million-file corpus in the Node heap. */
export function listReferenceManifestFiles(
  rootInput: string,
  filters: { extension?: string; source?: string; domain?: string; role?: string; authority?: string; consumer?: string },
  max = 100_000,
): { generation: string; files: ReferenceManifestFile[] } | null {
  if (!Object.values(filters).some(Boolean)) throw new Error('Reference manifest bulk reads require a filter.');
  const files: ReferenceManifestFile[] = [];
  let generation = '';
  for (let offset = 0; offset < max; offset += 500) {
    const page = queryReferenceManifest(rootInput, { ...filters, limit: 500, offset });
    if (!page) return null;
    generation = page.generation;
    files.push(...page.files);
    if (files.length >= page.total || page.files.length < 500) break;
  }
  return { generation, files: files.slice(0, max) };
}

export function getReferenceCoverage(rootInput: string): (ReferenceManifestSummary & ReturnType<typeof referenceCoverageRows>) | null {
  const root = normalizedRoot(rootInput);
  const db = manifestDb();
  if (!db) return null;
  const current = latestReferenceGeneration(db, rootKey(root));
  if (!current) return null;
  return { ...generationSummary(current), ...referenceCoverageRows(db, current.id) };
}

export async function runReferenceManifestSelftest(): Promise<{ pass: boolean; checks: Array<{ name: string; pass: boolean; detail?: string }> }> {
  const os = await import('os');
  const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'x4-reference-manifest-'));
  const corpusRoot = path.join(tmp, 'corpus');
  const previousDatabase = database;
  const testDatabase = openStudioDb(path.join(tmp, 'cache'));
  if (!testDatabase) return { pass: false, checks: [{ name: 'isolated SQLite opens', pass: false }] };
  database = testDatabase;
  const checks: Array<{ name: string; pass: boolean; detail?: string }> = [];
  const ok = (name: string, pass: boolean, detail?: string) => checks.push({ name, pass, detail });
  try {
    const write = async (rel: string, content = '<root/>') => {
      const file = path.join(corpusRoot, ...rel.split('/')); await fsp.mkdir(path.dirname(file), { recursive: true }); await fsp.writeFile(file, content);
    };
    await write('libraries/md.xsd', '<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema"/>');
    await write('libraries/factions.xml');
    await write('md/example.xml');
    await write('extensions/ego_dlc_test/libraries/wares.xml');
    await write('extensions/community_mod/libraries/wares.xml');
    await write('assets/sound.ogg', 'x');
    const summary = await refreshReferenceManifest(corpusRoot);
    const all = queryReferenceManifest(corpusRoot, { limit: 100 });
    ok('all files discovered', summary.totalFiles === 6 && all?.total === 6, `${summary.totalFiles}/${all?.total}`);
    const schema = queryReferenceManifest(corpusRoot, { role: 'grammar', limit: 10 })?.files[0];
    ok('canonical schema classified', schema?.schemaRole === 'canonical-library' && schema.authority === 'deterministic');
    const dlc = queryReferenceManifest(corpusRoot, { source: 'ego_dlc_test', limit: 10 })?.files[0];
    ok('official DLC canonical', dlc?.role === 'canonical-data' && dlc.authority === 'canonical');
    const community = queryReferenceManifest(corpusRoot, { source: 'community_mod', limit: 10 })?.files[0];
    ok('third-party content advisory', community?.role === 'executable-example' && community.authority === 'advisory');
    const asset = queryReferenceManifest(corpusRoot, { role: 'asset', limit: 10 })?.files[0];
    ok('asset existence-only', asset?.authority === 'existence' && asset.consumer === 'asset-index');
    const firstGeneration = summary.generation;
    await write('aiscripts/new.xml');
    const refreshed = await refreshReferenceManifest(corpusRoot);
    ok('refresh swaps generation', refreshed.generation !== firstGeneration && refreshed.totalFiles === 7);
    const coverage = getReferenceCoverage(corpusRoot);
    ok('coverage indexed', Boolean(coverage?.byRole.some(row => row.key === 'grammar' && row.count === 1)));
  } finally {
    scanState.delete(rootKey(corpusRoot));
    lastScanErrors.delete(rootKey(corpusRoot));
    try { testDatabase.raw.close(); } catch { /* best effort */ }
    database = previousDatabase;
    await fsp.rm(tmp, { recursive: true, force: true });
  }
  return { pass: checks.every(check => check.pass), checks };
}
