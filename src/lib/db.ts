/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * SQLite persistence layer (ROADMAP: "SQLite persistence layer (design)").
 *
 * Backend cache + query layer for the expensive, reusable data the studio computes:
 * the packed .cat/.dat object index and the extension manifest/file index. The mod
 * being edited stays in frontend memory; generated XML stays computed on demand; the
 * filesystem remains the source of truth — this DB only *indexes* it.
 *
 * Migration stage: MIRROR-WRITE (stage 2 of 4). The in-memory path remains the source
 * of truth for all reads; this module mirrors results into SQLite and exposes query
 * helpers so reads can be flipped over once /api/agent/db-selftest proves parity.
 *
 * better-sqlite3 is an OPTIONAL native dependency: if it isn't installed, every
 * entry point no-ops and isDbAvailable() reports false (with the reason), so the
 * server runs unchanged. Install with:  npm install better-sqlite3
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { createRequire } from 'module';

// ---------------------------------------------------------------------------
// Optional native module loading (the project is ESM; better-sqlite3 is CJS).
// ---------------------------------------------------------------------------

type SqliteDatabase = any;

let BetterSqlite3: any = null;
let loadError: string | null = null;

function loadDriver(): any {
  if (BetterSqlite3 || loadError) return BetterSqlite3;
  try {
    // B41: in the esbuild CJS production bundle `import.meta.url` compiles to
    // undefined and createRequire(undefined) throws — use __filename there so the
    // optional driver also loads from dist/server.cjs, not only under tsx/ESM.
    const require = createRequire(typeof __filename !== 'undefined' ? __filename : import.meta.url);
    BetterSqlite3 = require('better-sqlite3');
  } catch (err) {
    loadError = err?.message || String(err);
  }
  return BetterSqlite3;
}

export function isDbAvailable(): { available: boolean; reason?: string } {
  loadDriver();
  return BetterSqlite3 ? { available: true } : { available: false, reason: loadError || 'better-sqlite3 not installed' };
}

// ---------------------------------------------------------------------------
// Schema (v1) — exactly the ROADMAP DDL.
// ---------------------------------------------------------------------------

export const SCHEMA_VERSION = 4; // v4: normalized, path-keyed reference manifest

const SCHEMA_DDL = `
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS source_mtime (path TEXT PRIMARY KEY, mtime INTEGER);
CREATE TABLE IF NOT EXISTS object_index (
  kind TEXT, id TEXT, name TEXT, source_mod TEXT, source_file TEXT, macro TEXT, dlc TEXT, detail TEXT,
  PRIMARY KEY (kind, id)
);
CREATE INDEX IF NOT EXISTS idx_obj_kind ON object_index(kind);
CREATE INDEX IF NOT EXISTS idx_obj_id   ON object_index(id);
CREATE TABLE IF NOT EXISTS extensions (
  folder TEXT PRIMARY KEY, content_id TEXT, name TEXT, version TEXT, enabled INTEGER, deps_json TEXT
);
CREATE INDEX IF NOT EXISTS idx_ext_id ON extensions(content_id);
CREATE TABLE IF NOT EXISTS ext_files (
  folder TEXT, rel_path TEXT, is_diff INTEGER, selectors_json TEXT, hash TEXT,
  PRIMARY KEY (folder, rel_path)
);
CREATE INDEX IF NOT EXISTS idx_extfiles_path ON ext_files(rel_path);
CREATE TABLE IF NOT EXISTS reference_generations (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  root_key TEXT NOT NULL,
  root TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  total_files INTEGER NOT NULL DEFAULT 0,
  total_bytes INTEGER NOT NULL DEFAULT 0,
  counts_json TEXT NOT NULL DEFAULT '{}',
  error TEXT
);
CREATE INDEX IF NOT EXISTS idx_refgen_root_status ON reference_generations(root_key, status, completed_at);
CREATE TABLE IF NOT EXISTS reference_classes (
  class_id INTEGER PRIMARY KEY,
  extension TEXT NOT NULL,
  source TEXT NOT NULL,
  domain TEXT NOT NULL,
  role TEXT NOT NULL,
  authority TEXT NOT NULL,
  consumer TEXT NOT NULL,
  schema_role TEXT NOT NULL DEFAULT '',
  UNIQUE(extension, source, domain, role, authority, consumer, schema_role)
);
CREATE TABLE IF NOT EXISTS reference_files (
  generation_seq INTEGER NOT NULL,
  rel_path TEXT NOT NULL,
  class_id INTEGER NOT NULL,
  bytes INTEGER NOT NULL,
  mtime_ms INTEGER NOT NULL,
  sha256 TEXT,
  PRIMARY KEY (generation_seq, rel_path)
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS idx_reffile_gen_class ON reference_files(generation_seq, class_id);
`;

export interface StudioDb {
  raw: SqliteDatabase;
  path: string;
}

/**
 * Open (creating/migrating as needed) the studio cache DB. Returns null when the
 * driver is unavailable or the file can't be opened — callers must treat null as
 * "no cache" and stay on the in-memory path.
 */
export function openStudioDb(cacheDir?: string): StudioDb | null {
  if (!loadDriver()) return null;
  try {
    const dir = cacheDir || path.join(os.tmpdir(), 'x4-studio-cache');
    fs.mkdirSync(dir, { recursive: true });
    const dbPath = path.join(dir, 'index.db');
    const raw = new BetterSqlite3(dbPath);
    raw.pragma('journal_mode = WAL');
    // Read the version before applying the complete DDL. A prior cache can have
    // tables with the same names but an older column layout, and CREATE INDEX
    // against that layout would fail before we get a chance to migrate it.
    raw.exec('CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);');
    const existing = getMeta(raw, 'schema_version');
    if (existing !== String(SCHEMA_VERSION)) {
      if (existing !== null) {
        // It's a cache, not a store: on any schema change drop + recreate the data
        // tables (DDL above runs IF NOT EXISTS, so recreate explicitly).
        raw.exec('DROP TABLE IF EXISTS object_index; DROP TABLE IF EXISTS extensions; DROP TABLE IF EXISTS ext_files; DROP TABLE IF EXISTS reference_files; DROP TABLE IF EXISTS reference_classes; DROP TABLE IF EXISTS reference_generations; DELETE FROM source_mtime; DELETE FROM meta;');
      }
      raw.exec(SCHEMA_DDL);
      setMeta(raw, 'schema_version', String(SCHEMA_VERSION));
      if (existing !== null) {
        // This is a disposable cache migration. Reclaim pages held by the old
        // million-row manifest now so the compact layout has a real disk win.
        raw.pragma('wal_checkpoint(TRUNCATE)');
        raw.exec('VACUUM');
      }
    } else {
      raw.exec(SCHEMA_DDL);
    }
    return { raw, path: dbPath };
  } catch (err) {
    console.warn('[studio-db] open failed, continuing without SQLite cache:', err);
    return null;
  }
}

function getMeta(raw: SqliteDatabase, key: string): string | null {
  const row = raw.prepare('SELECT value FROM meta WHERE key = ?').get(key);
  return row ? row.value : null;
}

function setMeta(raw: SqliteDatabase, key: string, value: string) {
  raw.prepare('INSERT INTO meta(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
}

export function getDbMeta(db: StudioDb, key: string): string | null {
  return getMeta(db.raw, key);
}

export function setDbMeta(db: StudioDb, key: string, value: string) {
  setMeta(db.raw, key, value);
}

// ---------------------------------------------------------------------------
// Invalidation — source mtimes + game-path binding.
// ---------------------------------------------------------------------------

/**
 * If the configured game path changed since the cache was built, wipe everything
 * (per ROADMAP: "Store game_path in meta — wipe + rebuild if it changes").
 */
export function bindGamePath(db: StudioDb, gamePath: string) {
  const prev = getMeta(db.raw, 'game_path');
  if (prev !== null && prev !== gamePath) {
    db.raw.exec('DELETE FROM object_index; DELETE FROM extensions; DELETE FROM ext_files; DELETE FROM source_mtime;');
  }
  setMeta(db.raw, 'game_path', gamePath);
}

export interface SourceStamp { path: string; mtime: number; }

/** True when every given source file's mtime matches what the cache last saw. */
export function sourcesUnchanged(db: StudioDb, stamps: SourceStamp[]): boolean {
  const stmt = db.raw.prepare('SELECT mtime FROM source_mtime WHERE path = ?');
  for (const s of stamps) {
    const row = stmt.get(s.path);
    if (!row || Number(row.mtime) !== s.mtime) return false;
  }
  return true;
}

export function recordSourceStamps(db: StudioDb, stamps: SourceStamp[]) {
  const stmt = db.raw.prepare('INSERT INTO source_mtime(path, mtime) VALUES (?, ?) ON CONFLICT(path) DO UPDATE SET mtime = excluded.mtime');
  const tx = db.raw.transaction((rows: SourceStamp[]) => {
    for (const r of rows) stmt.run(r.path, r.mtime);
  });
  tx(stamps);
}

// ---------------------------------------------------------------------------
// Object index cache (x4ObjectIndex / x4CatDat decode results).
// ---------------------------------------------------------------------------

export interface DbObjectRow {
  kind: string; id: string; name: string;
  source_mod?: string | null; source_file?: string | null; macro?: string | null; dlc?: string | null;
  detail?: string | null;
}

/** Replace the cached object index in one transaction. */
export function cacheObjectIndex(db: StudioDb, rows: DbObjectRow[], builtAt?: string) {
  const insert = db.raw.prepare(
    'INSERT INTO object_index(kind, id, name, source_mod, source_file, macro, dlc, detail) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ' +
    'ON CONFLICT(kind, id) DO UPDATE SET name = excluded.name, source_mod = excluded.source_mod, source_file = excluded.source_file, macro = excluded.macro, dlc = excluded.dlc, detail = excluded.detail'
  );
  const tx = db.raw.transaction((all: DbObjectRow[]) => {
    db.raw.exec('DELETE FROM object_index;');
    for (const r of all) {
      insert.run(r.kind, r.id, r.name, r.source_mod ?? null, r.source_file ?? null, r.macro ?? null, r.dlc ?? null, r.detail ?? null);
    }
  });
  tx(rows);
  setMeta(db.raw, 'object_index_built_at', builtAt || new Date().toISOString());
}

/** Full table read backing the cold-boot restore path. */
export function readAllObjects(db: StudioDb): DbObjectRow[] {
  return db.raw.prepare('SELECT kind, id, name, source_mod, source_file, macro, dlc, detail FROM object_index').all();
}

export function objectIndexCounts(db: StudioDb): Record<string, number> {
  const out: Record<string, number> = {};
  for (const row of db.raw.prepare('SELECT kind, COUNT(*) AS n FROM object_index GROUP BY kind').all()) {
    out[row.kind] = Number(row.n);
  }
  return out;
}

/** Indexed point/prefix query — the read path that will replace the in-memory filter. */
export function queryObjectIndex(db: StudioDb, opts: { q?: string; kind?: string; limit?: number }): DbObjectRow[] {
  const limit = Math.max(1, Math.min(opts.limit ?? 100, 2000));
  const clauses: string[] = [];
  const params: any[] = [];
  if (opts.kind) { clauses.push('kind = ?'); params.push(opts.kind); }
  if (opts.q) { clauses.push('(id LIKE ? OR name LIKE ?)'); params.push(`%${opts.q}%`, `%${opts.q}%`); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  return db.raw.prepare(`SELECT kind, id, name, source_mod, source_file, macro, dlc, detail FROM object_index ${where} ORDER BY kind, id LIMIT ?`).all(...params, limit);
}

/** O(1) existence checks backing reference validation (macroname/warename/faction). */
export function objectExists(db: StudioDb, kind: string, id: string): boolean {
  return !!db.raw.prepare('SELECT 1 FROM object_index WHERE kind = ? AND id = ?').get(kind, id);
}

// ---------------------------------------------------------------------------
// Extension manifest / file index cache (Extension Doctor data).
// ---------------------------------------------------------------------------

export interface DbExtensionRow {
  folder: string; content_id: string; name?: string | null; version?: string | null;
  enabled: boolean; deps: { id: string; optional: boolean; name?: string }[];
}

export interface DbExtFileRow {
  folder: string; rel_path: string; is_diff: boolean; selectors: string[]; hash?: string | null;
}

export function cacheExtensions(db: StudioDb, exts: DbExtensionRow[], files: DbExtFileRow[]) {
  const insExt = db.raw.prepare(
    'INSERT INTO extensions(folder, content_id, name, version, enabled, deps_json) VALUES (?, ?, ?, ?, ?, ?) ' +
    'ON CONFLICT(folder) DO UPDATE SET content_id = excluded.content_id, name = excluded.name, version = excluded.version, enabled = excluded.enabled, deps_json = excluded.deps_json'
  );
  const insFile = db.raw.prepare(
    'INSERT INTO ext_files(folder, rel_path, is_diff, selectors_json, hash) VALUES (?, ?, ?, ?, ?) ' +
    'ON CONFLICT(folder, rel_path) DO UPDATE SET is_diff = excluded.is_diff, selectors_json = excluded.selectors_json, hash = excluded.hash'
  );
  const tx = db.raw.transaction(() => {
    db.raw.exec('DELETE FROM extensions; DELETE FROM ext_files;');
    for (const e of exts) insExt.run(e.folder, e.content_id, e.name ?? null, e.version ?? null, e.enabled ? 1 : 0, JSON.stringify(e.deps || []));
    for (const f of files) insFile.run(f.folder, f.rel_path, f.is_diff ? 1 : 0, JSON.stringify(f.selectors || []), f.hash ?? null);
  });
  tx();
  setMeta(db.raw, 'extensions_built_at', new Date().toISOString());
}

/** The Extension Doctor "check 3" as a single indexed GROUP BY (per ROADMAP). */
// Separator: ASCII unit separator (0x1F) via SQLite char(31) — cannot appear in folder names.
const FOLDER_SEP = String.fromCharCode(31);
export function contestedPaths(db: StudioDb): { rel_path: string; folders: string[] }[] {
  const rows = db.raw.prepare(
    `SELECT rel_path, GROUP_CONCAT(folder, char(31)) AS folders
     FROM ext_files GROUP BY rel_path HAVING COUNT(DISTINCT folder) > 1`
  ).all();
  return rows.map((r: any) => ({ rel_path: r.rel_path, folders: String(r.folders).split(FOLDER_SEP) }));
}

/** Dependency check as a join on extensions.content_id (per ROADMAP). */
export function unresolvedDependencies(db: StudioDb): { folder: string; dep_id: string; optional: boolean }[] {
  const exts = db.raw.prepare('SELECT folder, deps_json FROM extensions').all();
  const ids = new Set(db.raw.prepare('SELECT content_id FROM extensions').all().map((r: any) => String(r.content_id).toLowerCase()));
  const out: { folder: string; dep_id: string; optional: boolean }[] = [];
  for (const e of exts) {
    let deps: any[] = [];
    try { deps = JSON.parse(e.deps_json || '[]'); } catch { deps = []; }
    for (const d of deps) {
      if (d?.id && !ids.has(String(d.id).toLowerCase())) {
        out.push({ folder: e.folder, dep_id: d.id, optional: !!d.optional });
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Unpacked-reference manifest — million-file inventory, generation-swapped.
// ---------------------------------------------------------------------------

export interface DbReferenceGeneration {
  seq: number;
  id: string;
  root_key: string;
  root: string;
  status: 'scanning' | 'ready' | 'error';
  started_at: string;
  completed_at?: string | null;
  total_files: number;
  total_bytes: number;
  counts_json: string;
  error?: string | null;
}

export interface DbReferenceFile {
  generation_id: string;
  rel_path: string;
  extension: string;
  source: string;
  domain: string;
  role: string;
  authority: string;
  consumer: string;
  schema_role?: string | null;
  bytes: number;
  mtime_ms: number;
  sha256?: string | null;
}

export function beginReferenceGeneration(db: StudioDb, row: Pick<DbReferenceGeneration, 'id' | 'root_key' | 'root' | 'started_at'>): void {
  db.raw.prepare(
    `INSERT INTO reference_generations(id, root_key, root, status, started_at, counts_json)
     VALUES (?, ?, ?, 'scanning', ?, '{}')`,
  ).run(row.id, row.root_key, row.root, row.started_at);
}

export function appendReferenceFiles(db: StudioDb, rows: DbReferenceFile[]): void {
  if (!rows.length) return;
  const generationId = rows[0].generation_id;
  const generation = db.raw.prepare('SELECT seq FROM reference_generations WHERE id = ?').get(generationId) as { seq: number } | undefined;
  if (!generation) throw new Error(`Reference generation not found: ${generationId}`);
  const insertClass = db.raw.prepare(
    `INSERT OR IGNORE INTO reference_classes(
       extension, source, domain, role, authority, consumer, schema_role
     ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const selectClass = db.raw.prepare(
    `SELECT class_id FROM reference_classes
     WHERE extension = ? AND source = ? AND domain = ? AND role = ?
       AND authority = ? AND consumer = ? AND schema_role = ?`,
  );
  const insertFile = db.raw.prepare(
    `INSERT INTO reference_files(
       generation_seq, rel_path, class_id, bytes, mtime_ms, sha256
     ) VALUES (?, ?, ?, ?, ?, ?)`,
  );
  const tx = db.raw.transaction((all: DbReferenceFile[]) => {
    const classIds = new Map<string, number>();
    for (const row of all) {
      const values = [
        row.extension, row.source, row.domain, row.role, row.authority,
        row.consumer, row.schema_role ?? '',
      ] as const;
      const key = JSON.stringify(values);
      let classId = classIds.get(key);
      if (classId === undefined) {
        insertClass.run(...values);
        const found = selectClass.get(...values) as { class_id: number } | undefined;
        if (!found) throw new Error(`Reference classification could not be stored: ${key}`);
        classId = found.class_id;
        classIds.set(key, classId);
      }
      insertFile.run(generation.seq, row.rel_path, classId, row.bytes, row.mtime_ms, row.sha256 ?? null);
    }
  });
  tx(rows);
}

export function completeReferenceGeneration(
  db: StudioDb,
  id: string,
  completedAt: string,
  totalFiles: number,
  totalBytes: number,
  counts: Record<string, unknown>,
): void {
  db.raw.prepare(
    `UPDATE reference_generations
     SET status = 'ready', completed_at = ?, total_files = ?, total_bytes = ?, counts_json = ?, error = NULL
     WHERE id = ?`,
  ).run(completedAt, totalFiles, totalBytes, JSON.stringify(counts), id);
  const row = db.raw.prepare('SELECT seq, root_key FROM reference_generations WHERE id = ?').get(id) as
    { seq: number; root_key: string } | undefined;
  if (!row) return;
  const old = db.raw.prepare(
    `SELECT id FROM reference_generations
     WHERE root_key = ? AND status = 'ready' AND id <> ?
     ORDER BY completed_at DESC`,
  ).all(row.root_key, id) as Array<{ id: string }>;
  const dropFiles = db.raw.prepare('DELETE FROM reference_files WHERE generation_seq = ?');
  const dropGeneration = db.raw.prepare('DELETE FROM reference_generations WHERE id = ?');
  db.raw.transaction((ids: Array<{ id: string }>) => {
    for (const previous of ids) {
      const seq = db.raw.prepare('SELECT seq FROM reference_generations WHERE id = ?').get(previous.id) as { seq: number } | undefined;
      if (seq) dropFiles.run(seq.seq);
      dropGeneration.run(previous.id);
    }
    db.raw.prepare(
      `DELETE FROM reference_classes
       WHERE class_id NOT IN (SELECT DISTINCT class_id FROM reference_files)`,
    ).run();
  })(old);
}

export function failReferenceGeneration(db: StudioDb, id: string, completedAt: string, error: string): void {
  db.raw.prepare(
    `UPDATE reference_generations SET status = 'error', completed_at = ?, error = ? WHERE id = ?`,
  ).run(completedAt, error, id);
  const row = db.raw.prepare('SELECT seq FROM reference_generations WHERE id = ?').get(id) as { seq: number } | undefined;
  if (row) db.raw.prepare('DELETE FROM reference_files WHERE generation_seq = ?').run(row.seq);
}

export function latestReferenceGeneration(db: StudioDb, rootKey: string): DbReferenceGeneration | null {
  const row = db.raw.prepare(
    `SELECT * FROM reference_generations
     WHERE root_key = ? AND status = 'ready'
     ORDER BY completed_at DESC LIMIT 1`,
  ).get(rootKey) as DbReferenceGeneration | undefined;
  return row || null;
}

export function queryReferenceFiles(
  db: StudioDb,
  generationId: string,
  filters: { q?: string; extension?: string; source?: string; domain?: string; role?: string; authority?: string; consumer?: string; limit?: number; offset?: number },
): { total: number; files: DbReferenceFile[] } {
  const generation = db.raw.prepare('SELECT seq FROM reference_generations WHERE id = ?').get(generationId) as { seq: number } | undefined;
  if (!generation) return { total: 0, files: [] };
  const clauses = ['f.generation_seq = ?'];
  const params: unknown[] = [generation.seq];
  for (const [column, value] of [
    ['extension', filters.extension], ['source', filters.source], ['domain', filters.domain],
    ['role', filters.role], ['authority', filters.authority], ['consumer', filters.consumer],
  ] as Array<[string, string | undefined]>) {
    if (value) { clauses.push(`c.${column} = ?`); params.push(value); }
  }
  if (filters.q) { clauses.push('f.rel_path LIKE ?'); params.push(`%${filters.q}%`); }
  const where = clauses.join(' AND ');
  const total = Number(db.raw.prepare(
    `SELECT COUNT(*) AS n FROM reference_files f
     JOIN reference_classes c ON c.class_id = f.class_id WHERE ${where}`,
  ).get(...params).n);
  const requestedLimit = Number.isFinite(filters.limit) ? Number(filters.limit) : 100;
  const requestedOffset = Number.isFinite(filters.offset) ? Number(filters.offset) : 0;
  const limit = Math.max(1, Math.min(requestedLimit, 500));
  const offset = Math.max(0, Math.min(requestedOffset, 5_000_000));
  const files = db.raw.prepare(
    `SELECT ? AS generation_id, f.rel_path, c.extension, c.source, c.domain, c.role,
            c.authority, c.consumer, NULLIF(c.schema_role, '') AS schema_role,
            f.bytes, f.mtime_ms, f.sha256
     FROM reference_files f JOIN reference_classes c ON c.class_id = f.class_id
     WHERE ${where} ORDER BY f.rel_path LIMIT ? OFFSET ?`,
  ).all(generationId, ...params, limit, offset) as DbReferenceFile[];
  return { total, files };
}

export function referenceCoverageRows(db: StudioDb, generationId: string): {
  byExtension: Array<{ key: string; count: number }>;
  byDomain: Array<{ key: string; count: number }>;
  byRole: Array<{ key: string; count: number }>;
  bySource: Array<{ key: string; count: number }>;
  byConsumer: Array<{ key: string; count: number }>;
} {
  const generation = db.raw.prepare('SELECT seq FROM reference_generations WHERE id = ?').get(generationId) as { seq: number } | undefined;
  if (!generation) return { byExtension: [], byDomain: [], byRole: [], bySource: [], byConsumer: [] };
  const group = (column: string) => db.raw.prepare(
    `SELECT c.${column} AS key, COUNT(*) AS count
     FROM reference_files f JOIN reference_classes c ON c.class_id = f.class_id
     WHERE f.generation_seq = ? GROUP BY c.${column} ORDER BY count DESC, key`,
  ).all(generation.seq).map((row: any) => ({ key: String(row.key), count: Number(row.count) }));
  return {
    byExtension: group('extension'), byDomain: group('domain'), byRole: group('role'),
    bySource: group('source'), byConsumer: group('consumer'),
  };
}

// ---------------------------------------------------------------------------
// Self-test — builds a throwaway DB and asserts the query layer matches a known
// in-memory fixture (migration step 4's oracle).
// ---------------------------------------------------------------------------

export function dbSelfTest(): { available: boolean; reason?: string; pass?: boolean; checks?: Record<string, boolean> } {
  const avail = isDbAvailable();
  if (!avail.available) return avail;

  let tmp = '';
  try {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'x4db-'));
    const db = openStudioDb(tmp);
    if (!db) return { available: true, pass: false, checks: { open: false } };

    bindGamePath(db, 'G:/test/X4');

    // Fixture mirrors of the in-memory structures.
    cacheObjectIndex(db, [
      { kind: 'ship', id: 'ship_arg_s_fighter_01_macro', name: 'Eclipse' },
      { kind: 'ship', id: 'ship_par_s_fighter_02_macro', name: 'Pulsar' },
      { kind: 'ware', id: 'energycells', name: 'Energy Cells' },
      { kind: 'faction', id: 'argon', name: 'Argon Federation' }
    ]);
    cacheExtensions(db,
      [
        { folder: 'mod_a', content_id: 'mod_a', enabled: true, deps: [{ id: 'ghost_dep', optional: false }] },
        { folder: 'mod_b', content_id: 'mod_b', enabled: true, deps: [] }
      ],
      [
        { folder: 'mod_a', rel_path: 'libraries/jobs.xml', is_diff: true, selectors: ['/jobs'] },
        { folder: 'mod_b', rel_path: 'libraries/jobs.xml', is_diff: true, selectors: ['/jobs'] },
        { folder: 'mod_b', rel_path: 'md/only_b.xml', is_diff: false, selectors: [] }
      ]
    );
    recordSourceStamps(db, [{ path: '01.cat', mtime: 12345 }]);

    const counts = objectIndexCounts(db);
    const q = queryObjectIndex(db, { kind: 'ship', q: 'fighter', limit: 10 });
    const contested = contestedPaths(db);
    const missing = unresolvedDependencies(db);

    const checks: Record<string, boolean> = {
      counts: counts['ship'] === 2 && counts['ware'] === 1 && counts['faction'] === 1,
      query: q.length === 2 && q.every(r => r.kind === 'ship'),
      pointLookup: objectExists(db, 'faction', 'argon') && !objectExists(db, 'faction', 'nope'),
      contested: contested.length === 1 && contested[0].rel_path === 'libraries/jobs.xml' && contested[0].folders.length === 2,
      missingDep: missing.length === 1 && missing[0].dep_id === 'ghost_dep' && !missing[0].optional,
      mtimeHit: sourcesUnchanged(db, [{ path: '01.cat', mtime: 12345 }]),
      mtimeMiss: !sourcesUnchanged(db, [{ path: '01.cat', mtime: 99999 }]),
      gamePathWipe: (() => {
        bindGamePath(db, 'H:/other/X4'); // changed path must wipe the cache
        return objectIndexCounts(db)['ship'] === undefined;
      })()
    };
    db.raw.close();
    return { available: true, pass: Object.values(checks).every(Boolean), checks };
  } catch (err) {
    return { available: true, pass: false, checks: { exception: false }, reason: err?.message || String(err) };
  } finally {
    if (tmp) { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* best effort */ } }
  }
}
