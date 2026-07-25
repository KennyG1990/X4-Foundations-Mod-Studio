/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * B86 — persistence for the Agent Action Ledger.
 *
 * Append-only JSONL rows plus a content-addressed blob store, both under the relocatable data
 * root (`X4_DATA_DIR`, B53) so history survives extension updates and can NEVER be written into
 * a game folder — the B70 litter class.
 *
 *   <data>/history/ledger.jsonl        rows (small: summaries + references)
 *   <data>/history/ledger.1.jsonl …    rotated segments, bounded count
 *   <data>/history/blobs/<aa>/<sha256> payload bytes, deduplicated by hash
 *
 * Blobs are hash-keyed, so the same 295 KB Lua file written ten times costs one copy. Rows never
 * inline payloads; that single rule is what keeps a session's history in kilobytes rather than
 * hundreds of megabytes.
 *
 * Every method fails SOFT. A ledger fault must never fail, delay, or alter the request that was
 * being recorded — logging is not allowed to break the thing it logs.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { dataPath } from './dataDir';
import { LedgerRow, decodeRows, encodeRow } from './agentHistory';

/** Rotate a segment once it passes this, keeping history bounded without losing recent detail. */
export const LEDGER_MAX_BYTES = 4 * 1024 * 1024;
/** Retained rotated segments (plus the live one). */
export const LEDGER_MAX_SEGMENTS = 3;

export interface HistoryStoreOptions {
  root?: string;
  maxBytes?: number;
  maxSegments?: number;
}

export class AgentHistoryStore {
  readonly root: string;
  private readonly maxBytes: number;
  private readonly maxSegments: number;
  /** Surfaced in the panel so a silently broken ledger is visible rather than merely absent. */
  failures = 0;
  lastFailure = '';

  constructor(options: HistoryStoreOptions = {}) {
    this.root = options.root || dataPath('history');
    this.maxBytes = options.maxBytes ?? LEDGER_MAX_BYTES;
    this.maxSegments = options.maxSegments ?? LEDGER_MAX_SEGMENTS;
  }

  private get ledgerPath(): string { return path.join(this.root, 'ledger.jsonl'); }
  private get blobDir(): string { return path.join(this.root, 'blobs'); }

  private note(error: unknown): void {
    this.failures++;
    this.lastFailure = error instanceof Error ? error.message : String(error);
  }

  /** Store bytes by content hash and return the ref. Identical content is written once. */
  putBlob(content: Buffer | string): string | undefined {
    try {
      const buffer = Buffer.isBuffer(content) ? content : Buffer.from(String(content), 'utf8');
      const hash = crypto.createHash('sha256').update(buffer).digest('hex');
      const target = path.join(this.blobDir, hash.slice(0, 2), hash);
      if (!fs.existsSync(target)) {
        fs.mkdirSync(path.dirname(target), { recursive: true });
        // Write-then-rename so a crash mid-write can never leave a corrupt blob under a hash
        // that claims to describe it.
        const temp = `${target}.tmp-${process.pid}-${crypto.randomBytes(3).toString('hex')}`;
        fs.writeFileSync(temp, buffer);
        fs.renameSync(temp, target);
      }
      return hash;
    } catch (error) {
      this.note(error);
      return undefined;
    }
  }

  readBlob(hash: string): Buffer | null {
    try {
      if (!/^[a-f0-9]{64}$/i.test(String(hash))) return null;
      const target = path.join(this.blobDir, hash.slice(0, 2), hash);
      return fs.existsSync(target) ? fs.readFileSync(target) : null;
    } catch (error) {
      this.note(error);
      return null;
    }
  }

  append(row: LedgerRow): boolean {
    try {
      fs.mkdirSync(this.root, { recursive: true });
      this.rotateIfNeeded();
      fs.appendFileSync(this.ledgerPath, `${encodeRow(row)}\n`, 'utf8');
      return true;
    } catch (error) {
      this.note(error);
      return false;
    }
  }

  private rotateIfNeeded(): void {
    try {
      if (!fs.existsSync(this.ledgerPath)) return;
      if (fs.statSync(this.ledgerPath).size < this.maxBytes) return;
      // Drop the oldest, shift the rest down, then move the live segment to .1.
      const oldest = path.join(this.root, `ledger.${this.maxSegments}.jsonl`);
      if (fs.existsSync(oldest)) fs.rmSync(oldest, { force: true });
      for (let i = this.maxSegments - 1; i >= 1; i--) {
        const from = path.join(this.root, `ledger.${i}.jsonl`);
        const to = path.join(this.root, `ledger.${i + 1}.jsonl`);
        if (fs.existsSync(from)) fs.renameSync(from, to);
      }
      fs.renameSync(this.ledgerPath, path.join(this.root, 'ledger.1.jsonl'));
    } catch (error) {
      this.note(error);
    }
  }

  /** Oldest-first across retained segments; `filterRows` reverses for display. */
  readAll(): LedgerRow[] {
    try {
      const rows: LedgerRow[] = [];
      for (let i = this.maxSegments; i >= 1; i--) {
        const segment = path.join(this.root, `ledger.${i}.jsonl`);
        if (fs.existsSync(segment)) rows.push(...decodeRows(fs.readFileSync(segment, 'utf8')));
      }
      if (fs.existsSync(this.ledgerPath)) rows.push(...decodeRows(fs.readFileSync(this.ledgerPath, 'utf8')));
      return rows;
    } catch (error) {
      this.note(error);
      return [];
    }
  }

  find(id: string): LedgerRow | null {
    return this.readAll().find(row => row.id === id) || null;
  }

  /** Total bytes on disk — proves in tests that growth tracks changes, not payload size. */
  diskBytes(): number {
    let total = 0;
    const walk = (dir: string) => {
      if (!fs.existsSync(dir)) return;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.isFile()) total += fs.statSync(full).size;
      }
    };
    try { walk(this.root); } catch (error) { this.note(error); }
    return total;
  }
}
