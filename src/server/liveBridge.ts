/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Bridge live-state I/O (Play-In-Editor slice 2) — fetches an optional runtime's
 * /health and reads its telemetry SQLite (READ-ONLY) to tell the editor whether the
 * game←→bridge chain is alive right now. Cached ~10s so canvas polling stays cheap.
 * Pure normalization lives in src/lib/bridgeLiveState.ts.
 */

import fs from "fs";
import { createRequire } from "module";
import { normalizeBridgeLiveState, type BridgeEventRow, type BridgeLiveState } from "../lib/bridgeLiveState";

// B49: better-sqlite3 is an OPTIONAL native module. A static import made the entire server
// bundle crash at require-time on any machine where the prebuilt binding can't load (wrong
// OS/ABI) — a marketplace-portability killer. Lazy-load with the same __filename-safe
// pattern as src/lib/db.ts; when unavailable, telemetry reads degrade to "no events".
type SqliteCtor = new (path: string, opts: { readonly: boolean; fileMustExist: boolean }) => {
  prepare(sql: string): { all(...args: unknown[]): unknown[] };
  close(): void;
};
let Sqlite: SqliteCtor | null | undefined; // undefined = not attempted
function getSqlite(): SqliteCtor | null {
  if (Sqlite !== undefined) return Sqlite;
  try {
    const req = createRequire(typeof __filename !== 'undefined' ? __filename : import.meta.url);
    Sqlite = req('better-sqlite3') as SqliteCtor;
  } catch {
    Sqlite = null; // optional dependency absent/incompatible — bridge telemetry degrades
  }
  return Sqlite;
}

const BRIDGE_URL = process.env.FORGE_BRIDGE_URL || "http://127.0.0.1:8713";
const CACHE_MS = 10_000;

let cache: { at: number; state: BridgeLiveState } | null = null;

async function fetchHealth(): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2500);
  try {
    const res = await fetch(`${BRIDGE_URL}/health`, { signal: controller.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function readRecentEvents(telemetryDbPath: string): BridgeEventRow[] {
  try {
    if (!telemetryDbPath || !fs.existsSync(telemetryDbPath)) return [];
    const Database = getSqlite();
    if (!Database) return []; // driver unavailable → honest empty, never a crash
    const db = new Database(telemetryDbPath, { readonly: true, fileMustExist: true });
    try {
      const cutoff = Date.now() - 2 * 3_600_000;
      return db.prepare("SELECT ts_ms, kind, status FROM bridge_events WHERE ts_ms >= ? ORDER BY ts_ms DESC LIMIT 500")
        .all(cutoff) as BridgeEventRow[];
    } finally {
      db.close();
    }
  } catch {
    return []; // locked/missing table → honest empty (state degrades to "no events")
  }
}

/** Live bridge/game state, cached ~10s. Never throws. */
export async function getBridgeLiveState(): Promise<BridgeLiveState> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.state;
  const health = await fetchHealth();
  const telemetryDb = (() => {
    const h = health as { bridge?: { telemetry_db?: string } } | null;
    return h?.bridge?.telemetry_db || "";
  })();
  const events = telemetryDb ? readRecentEvents(telemetryDb) : [];
  const state = normalizeBridgeLiveState(health, events, Date.now());
  cache = { at: Date.now(), state };
  return state;
}
