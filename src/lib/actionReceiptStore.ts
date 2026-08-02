/**
 * B115 W3A — atomic, content-verified persistence for authoritative action receipts.
 *
 * The store owns only receipts.  Agent History remains an optional projection and is deliberately
 * not imported here.  A store failure is therefore visible to a future mutating caller instead of
 * being converted into an ordinary success or a fail-soft audit row.
 */

import fs from 'fs';
import path from 'path';
import { randomBytes } from 'crypto';
import { dataPath } from './dataDir';
import {
  assertValidActionReceipt,
  canonicalizeActionReceiptAuthority,
  createPreparedActionReceipt,
  serializeActionReceipt,
  transitionActionReceipt,
  type ActionReceipt,
  type ActionReceiptPrepareInput,
  type ActionReceiptStatus,
  type ActionReceiptTransitionInput,
  ActionReceiptValidationError,
} from './actionReceipt';

export const ACTION_RECEIPT_STORE_DIR = 'action-receipts';
export const ACTION_RECEIPT_MAX_BYTES = 1024 * 1024;

export interface ActionReceiptStoreOptions {
  root?: string;
  now?: () => number;
}

export interface ActionReceiptStoreSuccess {
  ok: true;
  receipt: ActionReceipt;
}

export interface ActionReceiptStoreFailure {
  ok: false;
  code: string;
  error: string;
}

export type ActionReceiptStoreResult = ActionReceiptStoreSuccess | ActionReceiptStoreFailure;

export class ActionReceiptStoreError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'ActionReceiptStoreError';
    this.code = code;
  }
}

function samePath(left: string, right: string): boolean {
  const a = path.normalize(left);
  const b = path.normalize(right);
  return process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
}

function contained(root: string, candidate: string): boolean {
  const normalizedRoot = path.normalize(root);
  const normalizedCandidate = path.normalize(candidate);
  if (samePath(normalizedRoot, normalizedCandidate)) return true;
  const prefix = normalizedRoot.endsWith(path.sep) ? normalizedRoot : `${normalizedRoot}${path.sep}`;
  return process.platform === 'win32'
    ? normalizedCandidate.toLowerCase().startsWith(prefix.toLowerCase())
    : normalizedCandidate.startsWith(prefix);
}

function validReceiptId(id: string): boolean {
  return /^ar_[a-f0-9]{64}$/.test(String(id || ''));
}

function errorDetails(error: unknown): { code: string; error: string } {
  if (error instanceof ActionReceiptStoreError) return { code: error.code, error: error.message };
  if (error instanceof ActionReceiptValidationError) return { code: error.code, error: error.message };
  return { code: 'RECEIPT_STORE_UNAVAILABLE', error: error instanceof Error ? error.message : String(error) };
}

function isMissingFilesystemEntry(error: unknown): boolean {
  const code = error && typeof error === 'object' && 'code' in error
    ? (error as NodeJS.ErrnoException).code
    : undefined;
  return code === 'ENOENT' || code === 'ENOTDIR';
}

function transitionAt(input: Omit<ActionReceiptTransitionInput, 'to' | 'at'> & { at?: string }, now: () => number): string {
  return input.at ?? new Date(now()).toISOString();
}

export class ActionReceiptStore {
  readonly root: string;
  private readonly now: () => number;

  constructor(options: ActionReceiptStoreOptions = {}) {
    this.root = path.resolve(options.root ?? dataPath(ACTION_RECEIPT_STORE_DIR));
    if (samePath(this.root, path.parse(this.root).root)) {
      throw new ActionReceiptStoreError('RECEIPT_ROOT_INVALID', 'Receipt store root may not be a filesystem root.');
    }
    this.now = options.now ?? (() => Date.now());
  }

  /** Exposed for focused fixtures; it still rejects traversal before constructing a path. */
  pathFor(id: string): string {
    if (!validReceiptId(id)) throw new ActionReceiptStoreError('RECEIPT_ID_INVALID', 'Receipt id is malformed.');
    const candidate = path.resolve(this.root, `${id}.json`);
    if (!contained(this.root, candidate) || samePath(this.root, candidate)) {
      throw new ActionReceiptStoreError('RECEIPT_PATH_ESCAPE', 'Receipt id escaped its store root.');
    }
    return candidate;
  }

  receiptPath(id: string): string {
    return this.pathFor(id);
  }

  private assertPhysicalDirectory(candidate: string, stat: fs.Stats): void {
    if (!stat.isDirectory() || stat.isSymbolicLink()) {
      throw new ActionReceiptStoreError('RECEIPT_ROOT_ESCAPE', 'Receipt store root contains a non-directory or symbolic-link segment.');
    }
    const realCandidate = fs.realpathSync.native(candidate);
    if (!samePath(realCandidate, candidate)) {
      throw new ActionReceiptStoreError('RECEIPT_ROOT_ESCAPE', 'Receipt store root contains a junction or symlink ancestor.');
    }
  }

  private ensureRoot(create: boolean): boolean {
    try {
      const parsed = path.parse(this.root);
      const relative = path.relative(parsed.root, this.root);
      let current = parsed.root;
      for (const segment of relative.split(path.sep).filter(Boolean)) {
        current = path.join(current, segment);
        let stat: fs.Stats;
        try {
          stat = fs.lstatSync(current);
        } catch (error) {
          if (!isMissingFilesystemEntry(error)) throw error;
          if (!create) return false;
          // Create one segment only after every existing ancestor has been checked.  Recursive
          // mkdir would follow a junction ancestor and write outside the declared root first.
          try { fs.mkdirSync(current); } catch (mkdirError) {
            if (!isMissingFilesystemEntry(mkdirError) && (mkdirError as NodeJS.ErrnoException).code !== 'EEXIST') throw mkdirError;
          }
          stat = fs.lstatSync(current);
        }
        this.assertPhysicalDirectory(current, stat);
      }
      return true;
    } catch (error) {
      if (error instanceof ActionReceiptStoreError) throw error;
      throw new ActionReceiptStoreError('RECEIPT_ROOT_UNAVAILABLE', `Receipt store root is unavailable: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private assertEntrySafe(file: string): void {
    if (!contained(this.root, file) || samePath(this.root, file)) {
      throw new ActionReceiptStoreError('RECEIPT_PATH_ESCAPE', 'Receipt path escaped its store root.');
    }
    const realRoot = fs.realpathSync.native(this.root);
    if (fs.existsSync(file)) {
      const stat = fs.lstatSync(file);
      if (stat.isSymbolicLink() || !stat.isFile()) {
        throw new ActionReceiptStoreError('RECEIPT_PATH_ESCAPE', 'Receipt path is not a regular file.');
      }
      const realFile = fs.realpathSync.native(file);
      if (!contained(realRoot, realFile)) {
        throw new ActionReceiptStoreError('RECEIPT_PATH_ESCAPE', 'Receipt file resolves outside its store root.');
      }
    }
  }

  private atomicWrite(file: string, bytes: Buffer): void {
    this.assertEntrySafe(file);
    const temporary = path.join(this.root, `.${path.basename(file)}.${process.pid}.${randomBytes(8).toString('hex')}.tmp`);
    let descriptor: number | undefined;
    try {
      descriptor = fs.openSync(temporary, 'wx', 0o600);
      fs.writeFileSync(descriptor, bytes);
      fs.fsyncSync(descriptor);
      fs.closeSync(descriptor);
      descriptor = undefined;
      const tempStat = fs.lstatSync(temporary);
      if (tempStat.isSymbolicLink() || !tempStat.isFile()) throw new ActionReceiptStoreError('RECEIPT_PATH_ESCAPE', 'Receipt temporary path is not a regular file.');
      fs.renameSync(temporary, file);
    } catch (error) {
      if (error instanceof ActionReceiptStoreError) throw error;
      throw new ActionReceiptStoreError('RECEIPT_STORE_WRITE_FAILED', `Receipt atomic write failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      if (descriptor !== undefined) {
        try { fs.closeSync(descriptor); } catch { /* best effort */ }
      }
      try { fs.rmSync(temporary, { force: true }); } catch { /* best effort */ }
    }
  }

  private readChecked(id: string): ActionReceipt {
    const file = this.pathFor(id);
    if (!this.ensureRoot(false) || !fs.existsSync(file)) {
      throw new ActionReceiptStoreError('RECEIPT_NOT_FOUND', 'Receipt was not found.');
    }
    this.assertEntrySafe(file);
    let raw: string;
    try {
      const bytes = fs.readFileSync(file);
      if (bytes.length > ACTION_RECEIPT_MAX_BYTES) throw new ActionReceiptStoreError('RECEIPT_CORRUPT', 'Receipt exceeds the supported size limit.');
      raw = bytes.toString('utf8');
    } catch (error) {
      if (error instanceof ActionReceiptStoreError) throw error;
      throw new ActionReceiptStoreError('RECEIPT_CORRUPT', `Receipt bytes are unavailable: ${error instanceof Error ? error.message : String(error)}`);
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      throw new ActionReceiptStoreError('RECEIPT_CORRUPT', `Receipt JSON is corrupt: ${error instanceof Error ? error.message : String(error)}`);
    }
    const checked = (() => {
      try { return assertValidActionReceipt(parsed); }
      catch (error) { throw new ActionReceiptStoreError('RECEIPT_CORRUPT', `Receipt schema or hash verification failed: ${error instanceof Error ? error.message : String(error)}`); }
    })();
    // The authoritative writer emits canonical bytes.  Requiring the exact canonical form also
    // rejects duplicate JSON keys, hidden whitespace changes, and other byte-level tampering that
    // JSON.parse alone would erase.
    let canonical: string;
    try { canonical = serializeActionReceipt(checked); }
    catch (error) { throw new ActionReceiptStoreError('RECEIPT_CORRUPT', `Receipt canonicalization failed: ${error instanceof Error ? error.message : String(error)}`); }
    if (raw !== canonical) throw new ActionReceiptStoreError('RECEIPT_CORRUPT', 'Receipt bytes are not canonical.');
    return checked;
  }

  read(id: string): ActionReceipt {
    return this.readChecked(id);
  }

  tryRead(id: string): ActionReceiptStoreResult {
    try { return { ok: true, receipt: this.readChecked(id) }; }
    catch (error) { const detail = errorDetails(error); return { ok: false, ...detail }; }
  }

  prepare(input: ActionReceiptPrepareInput): ActionReceipt {
    const candidate = createPreparedActionReceipt({
      ...input,
      preparedAt: input.preparedAt ?? new Date(this.now()).toISOString(),
    });
    this.ensureRoot(true);
    const file = this.pathFor(candidate.id);
    if (fs.existsSync(file)) {
      const existing = this.readChecked(candidate.id);
      const existingAuthority = canonicalizeActionReceiptAuthority(existing);
      const candidateAuthority = canonicalizeActionReceiptAuthority(candidate);
      if (existing.authorityHash === candidate.authorityHash && existingAuthority === candidateAuthority) {
        return existing;
      }
      throw new ActionReceiptStoreError('RECEIPT_DUPLICATE_CONFLICT', 'A materially different receipt already occupies this deterministic receipt id.');
    }
    const bytes = Buffer.from(serializeActionReceipt(candidate), 'utf8');
    this.atomicWrite(file, bytes);
    return this.readChecked(candidate.id);
  }

  tryPrepare(input: ActionReceiptPrepareInput): ActionReceiptStoreResult {
    try { return { ok: true, receipt: this.prepare(input) }; }
    catch (error) { const detail = errorDetails(error); return { ok: false, ...detail }; }
  }

  transition(id: string, input: ActionReceiptTransitionInput): ActionReceipt {
    const current = this.readChecked(id);
    const next = transitionActionReceipt(current, input);
    if (next.hash === current.hash) return current;
    this.ensureRoot(false);
    this.atomicWrite(this.pathFor(id), Buffer.from(serializeActionReceipt(next), 'utf8'));
    return this.readChecked(id);
  }

  tryTransition(id: string, input: ActionReceiptTransitionInput): ActionReceiptStoreResult {
    try { return { ok: true, receipt: this.transition(id, input) }; }
    catch (error) { const detail = errorDetails(error); return { ok: false, ...detail }; }
  }

  commit(id: string, input: Omit<ActionReceiptTransitionInput, 'to' | 'at'> & { at?: string }): ActionReceipt {
    return this.transition(id, { ...input, to: 'committed', at: transitionAt(input, this.now) });
  }

  fail(id: string, input: Omit<ActionReceiptTransitionInput, 'to' | 'at'> & { at?: string }): ActionReceipt {
    return this.transition(id, { ...input, to: 'failed', at: transitionAt(input, this.now) });
  }

  rollBack(id: string, input: Omit<ActionReceiptTransitionInput, 'to' | 'at'> & { at?: string }): ActionReceipt {
    return this.transition(id, { ...input, to: 'rolled_back', at: transitionAt(input, this.now) });
  }

  compensate(id: string, input: Omit<ActionReceiptTransitionInput, 'to' | 'at'> & { at?: string }): ActionReceipt {
    return this.transition(id, { ...input, to: 'compensated', at: transitionAt(input, this.now) });
  }

  /** Small audit seam used by the selftest to show the store has no retention side channel. */
  status(id: string): ActionReceiptStatus {
    return this.readChecked(id).status;
  }
}
