/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * B110-R14 — bounded durable recovery receipts for destructive choices.
 *
 * This store does not perform the destructive operation. It makes the pre-state durable first,
 * binds it to the exact expected post-state hash, and permits one later CAS restore. Deployment
 * payload copying/restoration stays in the server's already-proven regular-tree transaction code.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { atomicWriteJson } from './workspaceState';

export const RECOVERY_SCHEMA = 1;
export const RECOVERY_MAX_ENTRIES = 12;
export const RECOVERY_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export const RECOVERY_MAX_WORKSPACE_BYTES = 32 * 1024 * 1024;
export const RECOVERY_MAX_DEPLOY_BYTES = 512 * 1024 * 1024;
export const RECOVERY_DUPLICATE_CONFLICT = 'RECOVERY_DUPLICATE_CONFLICT';

export type RecoveryKind = 'workspace' | 'deploy';
export type RecoveryStatus = 'preparing' | 'ready' | 'used';

interface RecoveryBase {
  schema: typeof RECOVERY_SCHEMA;
  id: string;
  kind: RecoveryKind;
  status: RecoveryStatus;
  createdAt: string;
  expiresAt: string;
  summary: string;
  expectedCurrentHash: string;
  usedAt?: string;
}

export interface WorkspaceRecoveryRecord extends RecoveryBase {
  kind: 'workspace';
  status: 'ready' | 'used';
  /** ADR-F5 authority. Missing only on pre-migration receipts, which cannot be replayed. */
  workspaceId?: string;
  beforeWorkspace: unknown;
  beforeHash: string;
  /** B116 complete-snapshot guards. Missing on older receipts, which cannot be replayed safely. */
  beforeSnapshotHash?: string;
  expectedCurrentSnapshotHash?: string;
}

export interface DeploymentRecoveryRecord extends RecoveryBase {
  kind: 'deploy';
  priorExisted: boolean;
  targetRoot: string;
  targetPath: string;
  modId: string;
  beforeFingerprint: string;
  beforeBytes: number;
}

export type DestructiveRecoveryRecord = WorkspaceRecoveryRecord | DeploymentRecoveryRecord;

export interface RecoveryStoreOptions {
  root: string;
  maxEntries?: number;
  maxAgeMs?: number;
  maxWorkspaceBytes?: number;
  maxDeployBytes?: number;
  now?: () => number;
}

export class DestructiveRecoveryStoreError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'DestructiveRecoveryStoreError';
    this.code = code;
  }
}

interface WorkspaceRecoveryInput {
  /** Optional caller-owned identity. Omitted values retain the historical random-ID behavior. */
  recoveryId?: string;
  workspaceId: string;
  beforeWorkspace: unknown;
  beforeHash: string;
  beforeSnapshotHash: string;
  expectedCurrentHash: string;
  expectedCurrentSnapshotHash: string;
  summary: string;
}

const EXACT_WORKSPACE_RECOVERY_KEYS = new Set([
  'schema',
  'id',
  'kind',
  'status',
  'createdAt',
  'expiresAt',
  'summary',
  'expectedCurrentHash',
  'expectedCurrentSnapshotHash',
  'workspaceId',
  'beforeWorkspace',
  'beforeHash',
  'beforeSnapshotHash',
]);

function isMissingFilesystemError(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('code' in error)) return false;
  const code = String((error as NodeJS.ErrnoException).code || '');
  return code === 'ENOENT' || code === 'ENOTDIR';
}

/** JSON canonicalization for replay comparison; persisted bytes remain the existing JSON contract. */
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(item => canonicalJson(item)).join(',')}]`;
  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object)
      .sort()
      .filter(key => object[key] !== undefined)
      .map(key => `${JSON.stringify(key)}:${canonicalJson(object[key])}`)
      .join(',')}}`;
  }
  const serialized = JSON.stringify(value);
  return serialized === undefined ? 'null' : serialized;
}

function canonicalWorkspaceRecoveryFacts(input: WorkspaceRecoveryInput, expiresAfterMs: number): string {
  return canonicalJson({
    schema: RECOVERY_SCHEMA,
    kind: 'workspace',
    status: 'ready',
    workspaceId: input.workspaceId,
    beforeWorkspace: input.beforeWorkspace,
    beforeHash: input.beforeHash,
    beforeSnapshotHash: input.beforeSnapshotHash,
    expectedCurrentHash: input.expectedCurrentHash,
    expectedCurrentSnapshotHash: input.expectedCurrentSnapshotHash,
    summary: input.summary,
    expiresAfterMs,
  });
}

function validId(id: string): boolean {
  return /^[a-z0-9][a-z0-9_-]{11,80}$/i.test(String(id || ''));
}

function isRecord(value: unknown): value is DestructiveRecoveryRecord {
  if (!value || typeof value !== 'object') return false;
  const row = value as Partial<DestructiveRecoveryRecord>;
  if (row.schema !== RECOVERY_SCHEMA || !validId(String(row.id || ''))) return false;
  if (!['workspace', 'deploy'].includes(String(row.kind)) || !['preparing', 'ready', 'used'].includes(String(row.status))) return false;
  if (!row.createdAt || !row.expiresAt || !row.expectedCurrentHash || !row.summary) return false;
  if (row.kind === 'workspace') return row.beforeWorkspace !== undefined && typeof row.beforeHash === 'string' &&
    (row.beforeSnapshotHash === undefined || typeof row.beforeSnapshotHash === 'string') &&
    (row.expectedCurrentSnapshotHash === undefined || typeof row.expectedCurrentSnapshotHash === 'string') &&
    (row.workspaceId === undefined || /^ws_[a-f0-9]{24}$/i.test(row.workspaceId));
  return typeof row.targetRoot === 'string' && typeof row.targetPath === 'string' && typeof row.modId === 'string'
    && typeof row.beforeFingerprint === 'string' && typeof row.beforeBytes === 'number' && typeof row.priorExisted === 'boolean';
}

function directoryBytes(root: string): number {
  let total = 0;
  if (!fs.existsSync(root)) return total;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) total += directoryBytes(full);
    else if (entry.isFile()) total += fs.statSync(full).size;
  }
  return total;
}

export class DestructiveRecoveryStore {
  readonly root: string;
  private readonly maxEntries: number;
  private readonly maxAgeMs: number;
  private readonly maxWorkspaceBytes: number;
  private readonly maxDeployBytes: number;
  private readonly now: () => number;

  constructor(options: RecoveryStoreOptions) {
    this.root = path.resolve(options.root);
    this.maxEntries = options.maxEntries ?? RECOVERY_MAX_ENTRIES;
    this.maxAgeMs = options.maxAgeMs ?? RECOVERY_MAX_AGE_MS;
    this.maxWorkspaceBytes = options.maxWorkspaceBytes ?? RECOVERY_MAX_WORKSPACE_BYTES;
    this.maxDeployBytes = options.maxDeployBytes ?? RECOVERY_MAX_DEPLOY_BYTES;
    this.now = options.now ?? (() => Date.now());
  }

  private newId(kind: RecoveryKind): string {
    return `${kind}-${this.now().toString(36)}-${crypto.randomBytes(8).toString('hex')}`;
  }

  private entryDir(id: string): string {
    if (typeof id !== 'string' || !validId(id)) {
      throw new DestructiveRecoveryStoreError('RECOVERY_ID_INVALID', 'Invalid recovery id.');
    }
    const candidate = path.resolve(this.root, id);
    if (candidate === this.root || !candidate.startsWith(`${this.root}${path.sep}`)) {
      throw new DestructiveRecoveryStoreError('RECOVERY_PATH_ESCAPE', 'Recovery path escaped its root.');
    }
    return candidate;
  }

  private recordPath(id: string): string {
    return path.join(this.entryDir(id), 'record.json');
  }

  payloadPath(id: string): string {
    return path.join(this.entryDir(id), 'before');
  }

  private write(record: DestructiveRecoveryRecord): void {
    atomicWriteJson(this.recordPath(record.id), record);
  }

  private duplicateConflict(): never {
    throw new DestructiveRecoveryStoreError(
      RECOVERY_DUPLICATE_CONFLICT,
      'A recovery record already occupies this deterministic recovery id and is not an exact ready replay.',
    );
  }

  private assertPhysicalContained(candidate: string): void {
    let realRoot: string;
    let realCandidate: string;
    try {
      realRoot = fs.realpathSync.native(this.root);
      realCandidate = fs.realpathSync.native(candidate);
    } catch (error) {
      if (isMissingFilesystemError(error)) {
        throw new DestructiveRecoveryStoreError('RECOVERY_PATH_ESCAPE', 'Recovery path could not be resolved safely.');
      }
      throw error;
    }
    const comparableRoot = process.platform === 'win32' ? realRoot.toLowerCase() : realRoot;
    const comparableCandidate = process.platform === 'win32' ? realCandidate.toLowerCase() : realCandidate;
    if (comparableCandidate === comparableRoot || !comparableCandidate.startsWith(`${comparableRoot}${path.sep}`)) {
      throw new DestructiveRecoveryStoreError('RECOVERY_PATH_ESCAPE', 'Recovery path resolves outside its root.');
    }
  }

  private isExactWorkspaceReplay(record: DestructiveRecoveryRecord, input: WorkspaceRecoveryInput): record is WorkspaceRecoveryRecord {
    if (record.kind !== 'workspace' || record.status !== 'ready' || record.id !== input.recoveryId) return false;
    if (record.usedAt !== undefined || Object.keys(record).some(key => !EXACT_WORKSPACE_RECOVERY_KEYS.has(key))) return false;
    if (typeof record.createdAt !== 'string' || typeof record.expiresAt !== 'string'
      || typeof record.workspaceId !== 'string' || typeof record.beforeHash !== 'string'
      || typeof record.beforeSnapshotHash !== 'string' || typeof record.expectedCurrentHash !== 'string'
      || typeof record.expectedCurrentSnapshotHash !== 'string' || typeof record.summary !== 'string'
      || record.beforeWorkspace === undefined) return false;
    const createdAt = Date.parse(record.createdAt);
    const expiresAt = Date.parse(record.expiresAt);
    if (!Number.isFinite(createdAt) || !Number.isFinite(expiresAt) || expiresAt - createdAt !== this.maxAgeMs) return false;
    return canonicalWorkspaceRecoveryFacts(input, this.maxAgeMs) === canonicalWorkspaceRecoveryFacts({
      recoveryId: record.id,
      workspaceId: record.workspaceId,
      beforeWorkspace: record.beforeWorkspace,
      beforeHash: record.beforeHash,
      beforeSnapshotHash: record.beforeSnapshotHash,
      expectedCurrentHash: record.expectedCurrentHash,
      expectedCurrentSnapshotHash: record.expectedCurrentSnapshotHash,
      summary: record.summary,
    }, expiresAt - createdAt);
  }

  private findExplicitWorkspaceReplay(input: WorkspaceRecoveryInput): WorkspaceRecoveryRecord | undefined {
    if (input.recoveryId === undefined) return undefined;
    const id = input.recoveryId;
    const directory = this.entryDir(id);
    let directoryStat: fs.Stats | undefined;
    try { directoryStat = fs.lstatSync(directory); } catch (error) {
      if (isMissingFilesystemError(error)) return undefined;
      throw error;
    }
    if (directoryStat.isSymbolicLink()) {
      throw new DestructiveRecoveryStoreError('RECOVERY_PATH_ESCAPE', 'Recovery entry resolves through a link.');
    }
    if (!directoryStat.isDirectory()) this.duplicateConflict();
    this.assertPhysicalContained(directory);

    const entries = fs.readdirSync(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === 'record.json') continue;
      if (entry.isSymbolicLink()) {
        throw new DestructiveRecoveryStoreError('RECOVERY_PATH_ESCAPE', 'Recovery entry contains a linked path.');
      }
      this.duplicateConflict();
    }

    const recordFile = path.join(directory, 'record.json');
    let recordStat: fs.Stats | undefined;
    try { recordStat = fs.lstatSync(recordFile); } catch (error) {
      if (isMissingFilesystemError(error)) this.duplicateConflict();
      throw error;
    }
    if (recordStat.isSymbolicLink()) {
      throw new DestructiveRecoveryStoreError('RECOVERY_PATH_ESCAPE', 'Recovery record resolves through a link.');
    }
    if (!recordStat.isFile()) this.duplicateConflict();
    this.assertPhysicalContained(recordFile);

    const found = this.read(id);
    if (found.ok === false || !this.isExactWorkspaceReplay(found.record, input)) this.duplicateConflict();
    return found.record;
  }

  read(id: string): { ok: true; record: DestructiveRecoveryRecord } | { ok: false; code: string; error: string } {
    try {
      const file = this.recordPath(id);
      if (!fs.existsSync(file)) return { ok: false, code: 'RECOVERY_NOT_FOUND', error: 'Recovery record was not found.' };
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (!isRecord(parsed)) return { ok: false, code: 'RECOVERY_CORRUPT', error: 'Recovery record is corrupt or unsupported.' };
      if (Date.parse(parsed.expiresAt) <= this.now()) return { ok: false, code: 'RECOVERY_EXPIRED', error: 'Recovery record has expired.' };
      return { ok: true, record: parsed };
    } catch (error) {
      return { ok: false, code: 'RECOVERY_CORRUPT', error: `Recovery record is unavailable: ${error instanceof Error ? error.message : String(error)}` };
    }
  }

  createWorkspace(input: WorkspaceRecoveryInput): WorkspaceRecoveryRecord {
    if (input.recoveryId !== undefined) this.entryDir(input.recoveryId);
    if (!/^ws_[a-f0-9]{24}$/i.test(input.workspaceId)) throw new Error('Workspace recovery workspaceId is malformed.');
    const serialized = JSON.stringify(input.beforeWorkspace);
    const bytes = Buffer.byteLength(serialized, 'utf8');
    if (bytes > this.maxWorkspaceBytes) throw new Error(`Workspace recovery exceeds ${this.maxWorkspaceBytes} bytes.`);

    const replay = this.findExplicitWorkspaceReplay(input);
    if (replay) return replay;
    this.prune();
    const now = this.now();
    const record: WorkspaceRecoveryRecord = {
      schema: RECOVERY_SCHEMA,
      id: input.recoveryId ?? this.newId('workspace'),
      kind: 'workspace',
      status: 'ready',
      workspaceId: input.workspaceId,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + this.maxAgeMs).toISOString(),
      summary: input.summary,
      expectedCurrentHash: input.expectedCurrentHash,
      expectedCurrentSnapshotHash: input.expectedCurrentSnapshotHash,
      beforeWorkspace: input.beforeWorkspace,
      beforeHash: input.beforeHash,
      beforeSnapshotHash: input.beforeSnapshotHash,
    };
    this.write(record);
    return record;
  }

  prepareDeployment(input: {
    priorExisted: boolean;
    targetRoot: string;
    targetPath: string;
    modId: string;
    beforeFingerprint: string;
    beforeBytes: number;
    expectedCurrentHash?: string;
    summary: string;
  }): DeploymentRecoveryRecord {
    if (input.beforeBytes > this.maxDeployBytes) throw new Error(`Deployment recovery exceeds ${this.maxDeployBytes} bytes.`);
    this.prune();
    const now = this.now();
    const record: DeploymentRecoveryRecord = {
      schema: RECOVERY_SCHEMA,
      id: this.newId('deploy'),
      kind: 'deploy',
      status: 'preparing',
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + this.maxAgeMs).toISOString(),
      summary: input.summary,
      expectedCurrentHash: input.expectedCurrentHash || 'pending',
      priorExisted: input.priorExisted,
      targetRoot: path.resolve(input.targetRoot),
      targetPath: path.resolve(input.targetPath),
      modId: input.modId,
      beforeFingerprint: input.beforeFingerprint,
      beforeBytes: input.beforeBytes,
    };
    this.write(record);
    return record;
  }

  finalizeDeployment(id: string, expectedCurrentHash: string): DeploymentRecoveryRecord {
    const found = this.read(id);
    if (found.ok === false) throw new Error(found.error);
    if (found.record.kind !== 'deploy') throw new Error('Recovery kind mismatch.');
    if (found.record.status !== 'preparing') throw new Error('Deployment recovery is not preparing.');
    const record: DeploymentRecoveryRecord = { ...found.record, status: 'ready', expectedCurrentHash };
    this.write(record);
    return record;
  }

  markUsed(id: string): DestructiveRecoveryRecord {
    const found = this.read(id);
    if (found.ok === false) throw new Error(found.error);
    if (found.record.status !== 'ready') throw new Error('Recovery has already been used or is not ready.');
    const record = { ...found.record, status: 'used' as const, usedAt: new Date(this.now()).toISOString() } as DestructiveRecoveryRecord;
    this.write(record);
    return record;
  }

  abandon(id: string): void {
    try { fs.rmSync(this.entryDir(id), { recursive: true, force: true }); } catch { /* caller reports the owning operation */ }
  }

  prune(): void {
    fs.mkdirSync(this.root, { recursive: true });
    const rows = fs.readdirSync(this.root, { withFileTypes: true })
      .filter(entry => entry.isDirectory() && validId(entry.name))
      .map(entry => {
        const dir = path.join(this.root, entry.name);
        const read = this.read(entry.name);
        const created = read.ok ? Date.parse(read.record.createdAt) : fs.statSync(dir).mtimeMs;
        const expired = !read.ok || Date.parse(read.record.expiresAt) <= this.now();
        return { id: entry.name, dir, created, expired, bytes: directoryBytes(dir) };
      })
      .sort((a, b) => a.created - b.created);
    for (const row of rows.filter(row => row.expired)) fs.rmSync(row.dir, { recursive: true, force: true });
    const survivors = rows.filter(row => !row.expired);
    for (let i = 0; i < Math.max(0, survivors.length - this.maxEntries + 1); i += 1) {
      fs.rmSync(survivors[i].dir, { recursive: true, force: true });
    }
  }
}

export function runDestructiveRecoverySelftest(): {
  allPassed: boolean;
  passed: number;
  total: number;
  checks: Array<{ name: string; pass: boolean; detail?: string }>;
} {
  const checks: Array<{ name: string; pass: boolean; detail?: string }> = [];
  const ok = (name: string, pass: boolean, detail?: unknown) => checks.push({ name, pass, ...(detail === undefined ? {} : { detail: String(detail) }) });
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'x4forge-recovery-selftest-'));
  const deterministicRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'x4forge-recovery-deterministic-selftest-'));
  const collisionRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'x4forge-recovery-collision-selftest-'));
  let now = Date.parse('2026-07-30T00:00:00Z');
  try {
    const store = new DestructiveRecoveryStore({ root, maxEntries: 3, maxAgeMs: 1_000, maxWorkspaceBytes: 256, maxDeployBytes: 64, now: () => now });
    const deterministicStore = new DestructiveRecoveryStore({ root: deterministicRoot, maxEntries: 3, maxAgeMs: 1_000, maxWorkspaceBytes: 256, maxDeployBytes: 64, now: () => now });
    const collisionStore = new DestructiveRecoveryStore({ root: collisionRoot, maxEntries: 12, maxAgeMs: 1_000, maxWorkspaceBytes: 256, maxDeployBytes: 64, now: () => now });
    const deterministicInput: WorkspaceRecoveryInput = {
      recoveryId: `ar_${'a'.repeat(64)}`,
      workspaceId: 'ws_222222222222222222222222',
      beforeWorkspace: { name: 'before', nodes: [], links: [] },
      beforeHash: 'deterministic-before',
      beforeSnapshotHash: 'deterministic-before-snapshot',
      expectedCurrentHash: 'deterministic-after',
      expectedCurrentSnapshotHash: 'deterministic-after-snapshot',
      summary: 'deterministic overwrite',
    };
    const deterministic = deterministicStore.createWorkspace(deterministicInput);
    const deterministicRecordPath = path.join(deterministicRoot, deterministic.id, 'record.json');
    const deterministicBytesBefore = fs.readFileSync(deterministicRecordPath);
    const deterministicStatBefore = fs.statSync(deterministicRecordPath).mtimeMs;
    const unrelatedOne = deterministicStore.prepareDeployment({ priorExisted: true, targetRoot: root, targetPath: path.join(root, 'one'), modId: 'one', beforeFingerprint: 'one-before', beforeBytes: 1, summary: 'one' });
    const unrelatedTwo = deterministicStore.prepareDeployment({ priorExisted: true, targetRoot: root, targetPath: path.join(root, 'two'), modId: 'two', beforeFingerprint: 'two-before', beforeBytes: 1, summary: 'two' });
    const directoriesBeforeReplay = fs.readdirSync(deterministicRoot).sort();
    const deterministicReplay = deterministicStore.createWorkspace({
      ...deterministicInput,
      beforeWorkspace: { links: [], nodes: [], name: 'before' },
    });
    const deterministicBytesAfter = fs.readFileSync(deterministicRecordPath);
    const deterministicStatAfter = fs.statSync(deterministicRecordPath).mtimeMs;
    const directoriesAfterReplay = fs.readdirSync(deterministicRoot).sort();
    ok('explicit_id_creation_uses_requested_identity', deterministic.id === deterministicInput.recoveryId && deterministic.status === 'ready');
    ok('exact_replay_is_byte_and_timestamp_identical', deterministicReplay.id === deterministic.id
      && Buffer.compare(deterministicBytesBefore, deterministicBytesAfter) === 0
      && deterministicStatBefore === deterministicStatAfter);
    ok('exact_replay_does_not_prune_or_allocate', JSON.stringify(directoriesBeforeReplay) === JSON.stringify(directoriesAfterReplay)
      && deterministicStore.read(unrelatedOne.id).ok && deterministicStore.read(unrelatedTwo.id).ok);
    const restartedStore = new DestructiveRecoveryStore({ root: deterministicRoot, maxEntries: 3, maxAgeMs: 1_000, maxWorkspaceBytes: 256, maxDeployBytes: 64, now: () => now });
    const restartedReplay = restartedStore.createWorkspace(deterministicInput);
    ok('exact_replay_survives_restart', restartedReplay.id === deterministic.id
      && Buffer.compare(deterministicBytesBefore, fs.readFileSync(deterministicRecordPath)) === 0);

    const changedFacts = [
      { beforeHash: 'changed-before' },
      { beforeWorkspace: { name: 'changed' } },
      { workspaceId: 'ws_333333333333333333333333' },
      { expectedCurrentHash: 'changed-after' },
      { expectedCurrentSnapshotHash: 'changed-after-snapshot' },
      { summary: 'changed summary' },
    ];
    let changedFactsRejected = true;
    for (const change of changedFacts) {
      try { deterministicStore.createWorkspace({ ...deterministicInput, ...change }); changedFactsRejected = false; } catch (error) {
        changedFactsRejected = changedFactsRejected && error instanceof DestructiveRecoveryStoreError && error.code === RECOVERY_DUPLICATE_CONFLICT;
      }
    }
    ok('changed_fact_duplicate_conflicts_without_overwrite', changedFactsRejected
      && Buffer.compare(deterministicBytesBefore, fs.readFileSync(deterministicRecordPath)) === 0);

    const usedInput: WorkspaceRecoveryInput = { ...deterministicInput, recoveryId: `ar_${'b'.repeat(64)}` };
    const usedRecord = collisionStore.createWorkspace(usedInput);
    const usedRecordPath = path.join(collisionRoot, usedRecord.id, 'record.json');
    collisionStore.markUsed(usedRecord.id);
    const usedBytes = fs.readFileSync(usedRecordPath);
    let usedConflict = false;
    try { collisionStore.createWorkspace(usedInput); } catch (error) {
      usedConflict = error instanceof DestructiveRecoveryStoreError && error.code === RECOVERY_DUPLICATE_CONFLICT;
    }
    ok('used_replay_conflicts_without_overwrite', usedConflict && Buffer.compare(usedBytes, fs.readFileSync(usedRecordPath)) === 0);

    const expiryInput: WorkspaceRecoveryInput = { ...deterministicInput, recoveryId: `ar_${'c'.repeat(64)}` };
    const expiryRecord = collisionStore.createWorkspace(expiryInput);
    const expiryRecordPath = path.join(collisionRoot, expiryRecord.id, 'record.json');
    const expiryBytes = fs.readFileSync(expiryRecordPath);
    const changedExpiryStore = new DestructiveRecoveryStore({ root: collisionRoot, maxEntries: 12, maxAgeMs: 2_000, maxWorkspaceBytes: 256, maxDeployBytes: 64, now: () => now });
    let expirySemanticsConflict = false;
    try { changedExpiryStore.createWorkspace(expiryInput); } catch (error) {
      expirySemanticsConflict = error instanceof DestructiveRecoveryStoreError && error.code === RECOVERY_DUPLICATE_CONFLICT;
    }
    ok('changed_expiry_semantics_conflict', expirySemanticsConflict && Buffer.compare(expiryBytes, fs.readFileSync(expiryRecordPath)) === 0);

    const focusedCorruptId = `ar_${'d'.repeat(64)}`;
    const focusedCorruptDir = path.join(collisionRoot, focusedCorruptId);
    fs.mkdirSync(focusedCorruptDir, { recursive: true });
    const focusedCorruptPath = path.join(focusedCorruptDir, 'record.json');
    fs.writeFileSync(focusedCorruptPath, '{nope', 'utf8');
    let focusedCorruptConflict = false;
    try { collisionStore.createWorkspace({ ...deterministicInput, recoveryId: focusedCorruptId }); } catch (error) {
      focusedCorruptConflict = error instanceof DestructiveRecoveryStoreError && error.code === RECOVERY_DUPLICATE_CONFLICT;
    }
    ok('corrupt_replay_conflicts_without_overwrite', focusedCorruptConflict && fs.readFileSync(focusedCorruptPath, 'utf8') === '{nope');

    const partialId = `ar_${'e'.repeat(64)}`;
    const partialDir = path.join(collisionRoot, partialId);
    fs.mkdirSync(partialDir, { recursive: true });
    let partialConflict = false;
    try { collisionStore.createWorkspace({ ...deterministicInput, recoveryId: partialId }); } catch (error) {
      partialConflict = error instanceof DestructiveRecoveryStoreError && error.code === RECOVERY_DUPLICATE_CONFLICT;
    }
    ok('partial_replay_conflicts_without_record_creation', partialConflict && fs.readdirSync(partialDir).length === 0);

    const wrongKindId = `ar_${'f'.repeat(64)}`;
    const wrongKind = collisionStore.prepareDeployment({ priorExisted: true, targetRoot: root, targetPath: path.join(root, 'wrong'), modId: 'wrong', beforeFingerprint: 'wrong-before', beforeBytes: 1, summary: 'wrong kind' });
    const wrongKindDir = path.join(collisionRoot, wrongKindId);
    fs.renameSync(path.join(collisionRoot, wrongKind.id), wrongKindDir);
    const wrongKindPath = path.join(wrongKindDir, 'record.json');
    const wrongKindRecord = JSON.parse(fs.readFileSync(wrongKindPath, 'utf8'));
    wrongKindRecord.id = wrongKindId;
    fs.writeFileSync(wrongKindPath, JSON.stringify(wrongKindRecord), 'utf8');
    const wrongKindBytes = fs.readFileSync(wrongKindPath);
    let wrongKindConflict = false;
    try { collisionStore.createWorkspace({ ...deterministicInput, recoveryId: wrongKindId }); } catch (error) {
      wrongKindConflict = error instanceof DestructiveRecoveryStoreError && error.code === RECOVERY_DUPLICATE_CONFLICT;
    }
    ok('wrong_kind_collision_conflicts_without_overwrite', wrongKindConflict && Buffer.compare(wrongKindBytes, fs.readFileSync(wrongKindPath)) === 0);

    const malformedEntries = fs.readdirSync(collisionRoot).sort();
    let malformedIdentityRejected = false;
    try { collisionStore.createWorkspace({ ...deterministicInput, recoveryId: '../escape' }); } catch (error) {
      malformedIdentityRejected = error instanceof DestructiveRecoveryStoreError && error.code === 'RECOVERY_ID_INVALID';
    }
    ok('malformed_identity_rejected_before_mutation', malformedIdentityRejected
      && JSON.stringify(malformedEntries) === JSON.stringify(fs.readdirSync(collisionRoot).sort()));

    now += 2_000;
    let expiredConflict = false;
    try { collisionStore.createWorkspace(expiryInput); } catch (error) {
      expiredConflict = error instanceof DestructiveRecoveryStoreError && error.code === RECOVERY_DUPLICATE_CONFLICT;
    }
    ok('expired_replay_conflicts_without_overwrite', expiredConflict && Buffer.compare(expiryBytes, fs.readFileSync(expiryRecordPath)) === 0);

    const workspace = store.createWorkspace({
      workspaceId: 'ws_111111111111111111111111',
      beforeWorkspace: { name: 'before', nodes: [], links: [] },
      beforeHash: 'before',
      beforeSnapshotHash: 'before-snapshot',
      expectedCurrentHash: 'after',
      expectedCurrentSnapshotHash: 'after-snapshot',
      summary: 'forced overwrite',
    });
    const readWorkspace = store.read(workspace.id);
    ok('workspace_roundtrip', readWorkspace.ok && readWorkspace.record.kind === 'workspace'
      && readWorkspace.record.expectedCurrentHash === 'after'
      && readWorkspace.record.beforeSnapshotHash === 'before-snapshot'
      && readWorkspace.record.expectedCurrentSnapshotHash === 'after-snapshot');
    store.markUsed(workspace.id);
    const usedWorkspace = store.read(workspace.id);
    ok('used_record_is_retained_but_not_ready', usedWorkspace.ok && usedWorkspace.record.status === 'used');
    let replayRejected = false;
    try { store.markUsed(workspace.id); } catch { replayRejected = true; }
    ok('replay_rejected', replayRejected);
    let oversizedRejected = false;
    try {
      store.createWorkspace({
        workspaceId: 'ws_111111111111111111111111',
        beforeWorkspace: { huge: 'x'.repeat(300) },
        beforeHash: 'a',
        beforeSnapshotHash: 'as',
        expectedCurrentHash: 'b',
        expectedCurrentSnapshotHash: 'bs',
        summary: 'large',
      });
    } catch { oversizedRejected = true; }
    ok('oversized_workspace_rejected', oversizedRejected);

    const deploy = store.prepareDeployment({ priorExisted: true, targetRoot: root, targetPath: path.join(root, 'mod'), modId: 'mod', beforeFingerprint: 'old', beforeBytes: 12, summary: 'deploy mod' });
    fs.mkdirSync(store.payloadPath(deploy.id), { recursive: true });
    fs.writeFileSync(path.join(store.payloadPath(deploy.id), 'content.xml'), '<content/>');
    const finalized = store.finalizeDeployment(deploy.id, 'new');
    ok('deploy_prepare_finalize', finalized.status === 'ready' && finalized.expectedCurrentHash === 'new');
    const abandoned = store.prepareDeployment({ priorExisted: false, targetRoot: root, targetPath: path.join(root, 'newmod'), modId: 'newmod', beforeFingerprint: 'absent', beforeBytes: 0, summary: 'first deploy' });
    store.abandon(abandoned.id);
    ok('abandon_removes_entry', !store.read(abandoned.id).ok);

    const corruptId = 'workspace-corrupt-123456';
    fs.mkdirSync(path.join(root, corruptId), { recursive: true });
    fs.writeFileSync(path.join(root, corruptId, 'record.json'), '{nope', 'utf8');
    const corrupt = store.read(corruptId);
    ok('corrupt_record_fails_closed', corrupt.ok === false && corrupt.code === 'RECOVERY_CORRUPT');

    now += 2_000;
    const expired = store.read(deploy.id);
    ok('expired_record_unavailable', expired.ok === false && expired.code === 'RECOVERY_EXPIRED');
    store.prune();
    ok('prune_removes_expired', !fs.existsSync(path.join(root, deploy.id)));
    let invalidRejected = false;
    try { store.payloadPath('../escape'); } catch { invalidRejected = true; }
    ok('invalid_id_rejected', invalidRejected);
  } finally {
    try { fs.rmSync(root, { recursive: true, force: true }); } catch { /* test cleanup */ }
    try { fs.rmSync(deterministicRoot, { recursive: true, force: true }); } catch { /* test cleanup */ }
    try { fs.rmSync(collisionRoot, { recursive: true, force: true }); } catch { /* test cleanup */ }
  }
  const passed = checks.filter(check => check.pass).length;
  return { allPassed: passed === checks.length, passed, total: checks.length, checks };
}
