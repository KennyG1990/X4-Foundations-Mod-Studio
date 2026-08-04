/**
 * ADR-F5 — immutable, server-owned workspace identity.
 *
 * The registry is the sole persistence authority for mutable canvas workspaces. It deliberately
 * knows nothing about Express, authentication, or editable mod names: callers address records by
 * an opaque workspaceId and ADR-F1 CAS remains a policy in the server mutation chokepoint.
 */

import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { sanitizeWorkspace, type ModWorkspace } from '../types';
import {
  atomicWriteJson,
  atomicWriteFile,
  listParked,
  readActiveState,
  readParked,
  summarizeWorkspaceContent,
  type PersistedWorkspaceState,
} from './workspaceState';
import { workspaceContentHash, workspaceSnapshotHash } from './workspaceIdentity';

const REGISTRY_SCHEMA = 1;
const INDEX_FILE = 'workspace-registry.json';
const RECORD_DIR = 'workspaces';
export const WORKSPACE_REGISTRY_MAX_RECORDS = 50;
export const WORKSPACE_REGISTRY_MAX_BYTES = 16 * 1024 * 1024;

export interface WorkspaceRecord extends PersistedWorkspaceState {
  schema: typeof REGISTRY_SCHEMA;
  workspaceId: string;
  head: string;
  createdAt: string;
}

export interface WorkspaceSummary {
  workspaceId: string;
  name: string;
  version: number;
  workspaceHash: string;
  snapshotHash: string;
  createdAt: string;
  savedAt: string;
  origin: string;
  contentSummary: string;
}

interface WorkspaceRegistryIndex {
  schema: typeof REGISTRY_SCHEMA;
  defaultWorkspaceId: string;
  workspaceIds: string[];
  migratedAt: string;
}

export interface WorkspaceRegistryOptions {
  root: string;
  defaultWorkspace: ModWorkspace;
  maxRecords?: number;
  maxWorkspaceBytes?: number;
  now?: () => number;
  randomHex?: (bytes: number) => string;
}

export type WorkspaceLookup =
  | { ok: true; record: WorkspaceRecord }
  | { ok: false; code: 'WORKSPACE_ID_INVALID' | 'WORKSPACE_NOT_FOUND'; error: string };

export type WorkspaceRegistryCompensationState = 'present' | 'removed' | 'unknown';

export type WorkspaceRegistryCompensationFailureCode =
  | 'WORKSPACE_ID_INVALID'
  | 'WORKSPACE_EXPECTED_HEAD_INVALID'
  | 'WORKSPACE_EXPECTED_SNAPSHOT_HASH_INVALID'
  | 'WORKSPACE_NOT_FOUND'
  | 'WORKSPACE_DEFAULT_REFUSED'
  | 'WORKSPACE_NOT_JUST_CREATED'
  | 'WORKSPACE_STATE_INCONSISTENT'
  | 'WORKSPACE_RECORD_UNAVAILABLE'
  | 'WORKSPACE_HEAD_STALE'
  | 'WORKSPACE_SNAPSHOT_STALE'
  | 'WORKSPACE_COMPENSATION_INDEX_FAILED'
  | 'WORKSPACE_COMPENSATION_CLEANUP_FAILED';

export type WorkspaceRegistryCompensationResult =
  | {
    ok: true;
    status: 'compensated';
    code: 'WORKSPACE_COMPENSATED';
    workspaceId: string;
    index: 'removed';
    record: 'removed';
    memory: 'removed';
    restartVisible: false;
    memoryIndexAgree: true;
  }
  | {
    ok: false;
    status: 'refused' | 'failed' | 'partial';
    code: WorkspaceRegistryCompensationFailureCode;
    error: string;
    workspaceId: string;
    index: WorkspaceRegistryCompensationState;
    record: WorkspaceRegistryCompensationState;
    memory: WorkspaceRegistryCompensationState;
    restartVisible: boolean | 'unknown';
    memoryIndexAgree: boolean;
    indexRestored?: boolean;
  };

export function validWorkspaceId(value: string): boolean {
  return /^ws_[a-f0-9]{24}$/i.test(String(value || ''));
}

function cloneWorkspace<T>(workspace: T): T {
  return JSON.parse(JSON.stringify(workspace));
}

/**
 * Registry records predating ADR-F5 may omit the old workspace-local id even though current
 * authoring surfaces still use it for generated paths. Give those records one stable value
 * derived from their immutable registry authority before hashing or exposing them. Explicit
 * ids remain editable workspace content and are never replaced.
 */
function canonicalWorkspaceForRecord(workspace: ModWorkspace, workspaceId: string): ModWorkspace {
  const cloned = cloneWorkspace(workspace);
  if (typeof cloned.id !== 'string' || cloned.id.length === 0) {
    cloned.id = `workspace_${workspaceId.slice(3)}`;
  }
  return cloned;
}

function contentHead(workspace: unknown): string {
  return workspaceContentHash(sanitizeWorkspace(workspace));
}

function snapshotHead(workspace: unknown): string {
  return workspaceSnapshotHash(sanitizeWorkspace(workspace));
}

function validWorkspaceHash(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{16}$/.test(value);
}

function sameRegistryIndex(left: WorkspaceRegistryIndex, right: WorkspaceRegistryIndex): boolean {
  return left.schema === right.schema && left.defaultWorkspaceId === right.defaultWorkspaceId &&
    left.migratedAt === right.migratedAt && JSON.stringify(left.workspaceIds) === JSON.stringify(right.workspaceIds);
}

function validRecord(value: unknown, expectedId?: string): value is WorkspaceRecord {
  if (!value || typeof value !== 'object') return false;
  const row = value as Partial<WorkspaceRecord>;
  return row.schema === REGISTRY_SCHEMA && validWorkspaceId(String(row.workspaceId || '')) &&
    (!expectedId || row.workspaceId === expectedId) && !!row.workspace && typeof row.workspace === 'object' &&
    typeof (row.workspace as any).name === 'string' && Array.isArray((row.workspace as any).nodes) &&
    typeof row.head === 'string' && row.head === contentHead(row.workspace) &&
    Number.isFinite(row.version) && typeof row.savedAt === 'string' && typeof row.origin === 'string' &&
    typeof row.createdAt === 'string';
}

function validIndex(value: unknown): value is WorkspaceRegistryIndex {
  if (!value || typeof value !== 'object') return false;
  const row = value as Partial<WorkspaceRegistryIndex>;
  return row.schema === REGISTRY_SCHEMA && validWorkspaceId(String(row.defaultWorkspaceId || '')) &&
    Array.isArray(row.workspaceIds) && row.workspaceIds.length > 0 &&
    row.workspaceIds.every(id => validWorkspaceId(String(id))) &&
    new Set(row.workspaceIds).size === row.workspaceIds.length &&
    row.workspaceIds.includes(row.defaultWorkspaceId!) && typeof row.migratedAt === 'string';
}

export class WorkspaceRegistry {
  readonly root: string;
  private readonly maxRecords: number;
  private readonly maxWorkspaceBytes: number;
  private readonly now: () => number;
  private readonly randomHex: (bytes: number) => string;
  private readonly records = new Map<string, WorkspaceRecord>();
  /** Complete polling digests are runtime indexes, not persisted CAS heads. */
  private readonly snapshotHeads = new Map<string, string>();
  private readonly persistedAtBoot = new Set<string>();
  private readonly committedSinceBoot = new Set<string>();
  private index!: WorkspaceRegistryIndex;

  constructor(options: WorkspaceRegistryOptions) {
    this.root = path.resolve(options.root);
    this.maxRecords = options.maxRecords ?? WORKSPACE_REGISTRY_MAX_RECORDS;
    this.maxWorkspaceBytes = options.maxWorkspaceBytes ?? WORKSPACE_REGISTRY_MAX_BYTES;
    this.now = options.now ?? (() => Date.now());
    this.randomHex = options.randomHex ?? (bytes => crypto.randomBytes(bytes).toString('hex'));
    this.loadOrMigrate(options.defaultWorkspace);
  }

  private get indexPath(): string { return path.join(this.root, INDEX_FILE); }
  private recordPath(workspaceId: string): string { return path.join(this.root, RECORD_DIR, `${workspaceId}.json`); }
  private timestamp(): string { return new Date(this.now()).toISOString(); }

  private newId(): string {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const id = `ws_${this.randomHex(12).slice(0, 24).toLowerCase()}`;
      if (validWorkspaceId(id) && !this.records.has(id)) return id;
    }
    throw new Error('Could not allocate a unique workspace id.');
  }

  private assertWorkspaceSize(workspace: unknown): void {
    const bytes = Buffer.byteLength(JSON.stringify(workspace), 'utf8');
    if (bytes > this.maxWorkspaceBytes) {
      throw new Error(`Workspace exceeds the ${this.maxWorkspaceBytes}-byte registry limit.`);
    }
  }

  private persistIndex(index: WorkspaceRegistryIndex): void {
    atomicWriteJson(this.indexPath, index);
  }

  private persistRecord(record: WorkspaceRecord): void {
    this.assertWorkspaceSize(record.workspace);
    atomicWriteJson(this.recordPath(record.workspaceId), record);
  }

  private loadOrMigrate(defaultWorkspace: ModWorkspace): void {
    if (fs.existsSync(this.indexPath)) {
      let parsed: unknown;
      try { parsed = JSON.parse(fs.readFileSync(this.indexPath, 'utf8')); }
      catch (error) { throw new Error(`Workspace registry index is unreadable; refusing fallback: ${error instanceof Error ? error.message : String(error)}`); }
      if (!validIndex(parsed)) throw new Error('Workspace registry index is corrupt or unsupported; refusing fallback.');
      if (parsed.workspaceIds.length > this.maxRecords) throw new Error('Workspace registry exceeds its record limit.');
      for (const id of parsed.workspaceIds) {
        let record: unknown;
        try { record = JSON.parse(fs.readFileSync(this.recordPath(id), 'utf8')); }
        catch (error) { throw new Error(`Workspace record ${id} is unreadable; refusing fallback: ${error instanceof Error ? error.message : String(error)}`); }
        if (!validRecord(record, id)) throw new Error(`Workspace record ${id} is corrupt or unsupported; refusing fallback.`);
        const normalizedRecord: WorkspaceRecord = {
          ...record,
          workspace: canonicalWorkspaceForRecord(record.workspace, id),
        };
        this.assertWorkspaceSize(normalizedRecord.workspace);
        this.records.set(id, normalizedRecord);
        this.snapshotHeads.set(id, snapshotHead(normalizedRecord.workspace));
        this.persistedAtBoot.add(id);
      }
      this.index = parsed;
      return;
    }

    const candidates: Array<{ state: PersistedWorkspaceState; origin: string }> = [];
    const active = readActiveState(this.root);
    if (active) candidates.push({ state: active, origin: `migrated:${active.origin || 'active'}` });
    for (const parked of listParked(this.root)) {
      const state = readParked(this.root, parked.name);
      if (state) candidates.push({ state, origin: `migrated:${state.origin || 'parked'}` });
    }
    if (candidates.length === 0) {
      candidates.push({
        state: { workspace: cloneWorkspace(defaultWorkspace), version: this.now(), savedAt: this.timestamp(), origin: 'boot-default' },
        origin: 'boot-default',
      });
    }
    if (candidates.length > this.maxRecords) throw new Error('Legacy workspace migration exceeds the registry record limit.');

    const migratedAt = this.timestamp();
    const ids: string[] = [];
    for (const candidate of candidates) {
      const workspaceId = this.newId();
      const workspace = canonicalWorkspaceForRecord(candidate.state.workspace, workspaceId);
      const record: WorkspaceRecord = {
        schema: REGISTRY_SCHEMA,
        workspaceId,
        workspace,
        head: contentHead(workspace),
        version: Number(candidate.state.version) || this.now(),
        createdAt: migratedAt,
        savedAt: candidate.state.savedAt || migratedAt,
        origin: candidate.origin,
      };
      this.persistRecord(record);
      this.records.set(workspaceId, record);
      this.snapshotHeads.set(workspaceId, snapshotHead(record.workspace));
      ids.push(workspaceId);
      // A real legacy record existed before this process. The generated boot default did not.
      if (active || candidates.length > 1 || candidate.origin.startsWith('migrated:')) this.persistedAtBoot.add(workspaceId);
    }
    this.index = { schema: REGISTRY_SCHEMA, defaultWorkspaceId: ids[0], workspaceIds: ids, migratedAt };
    this.persistIndex(this.index);
  }

  get defaultWorkspaceId(): string { return this.index.defaultWorkspaceId; }

  lookup(workspaceId: string): WorkspaceLookup {
    if (!validWorkspaceId(workspaceId)) return { ok: false, code: 'WORKSPACE_ID_INVALID', error: 'workspaceId is malformed.' };
    const record = this.records.get(workspaceId);
    return record
      ? { ok: true, record }
      : { ok: false, code: 'WORKSPACE_NOT_FOUND', error: `Workspace ${workspaceId} was not found.` };
  }

  list(): WorkspaceSummary[] {
    return this.index.workspaceIds.map(workspaceId => this.summary(this.records.get(workspaceId)!));
  }

  summary(record: WorkspaceRecord): WorkspaceSummary {
    return {
      workspaceId: record.workspaceId,
      name: String((record.workspace as any)?.name || 'Untitled'),
      version: record.version,
      workspaceHash: record.head,
      snapshotHash: this.snapshotHash(record),
      createdAt: record.createdAt,
      savedAt: record.savedAt,
      origin: record.origin,
      contentSummary: summarizeWorkspaceContent(record.workspace),
    };
  }

  create(workspace: ModWorkspace, origin: string): WorkspaceRecord {
    if (this.records.size >= this.maxRecords) throw new Error(`Workspace registry is full (${this.maxRecords} records).`);
    const workspaceId = this.newId();
    const canonicalWorkspace = canonicalWorkspaceForRecord(workspace, workspaceId);
    this.assertWorkspaceSize(canonicalWorkspace);
    const now = this.timestamp();
    const record: WorkspaceRecord = {
      schema: REGISTRY_SCHEMA,
      workspaceId,
      workspace: canonicalWorkspace,
      head: contentHead(canonicalWorkspace),
      version: this.now(),
      createdAt: now,
      savedAt: now,
      origin,
    };
    const nextIndex = { ...this.index, workspaceIds: [...this.index.workspaceIds, record.workspaceId] };
    this.persistRecord(record);
    try { this.persistIndex(nextIndex); }
    catch (error) {
      try { fs.rmSync(this.recordPath(record.workspaceId), { force: true }); } catch { /* index remains authoritative */ }
      throw error;
    }
    this.records.set(record.workspaceId, record);
    this.snapshotHeads.set(record.workspaceId, snapshotHead(record.workspace));
    this.index = nextIndex;
    return record;
  }

  commit(workspaceId: string, workspace: ModWorkspace, origin: string): WorkspaceRecord {
    const found = this.lookup(workspaceId);
    if (found.ok === false) throw new Error(found.error);
    const canonicalWorkspace = canonicalWorkspaceForRecord(workspace, workspaceId);
    this.assertWorkspaceSize(canonicalWorkspace);
    const next: WorkspaceRecord = {
      ...found.record,
      workspace: canonicalWorkspace,
      head: contentHead(canonicalWorkspace),
      version: Math.max(found.record.version + 1, this.now()),
      savedAt: this.timestamp(),
      origin,
    };
    // Durable promotion precedes memory publication; a failed write cannot report success.
    this.persistRecord(next);
    this.records.set(workspaceId, next);
    this.snapshotHeads.set(workspaceId, snapshotHead(next.workspace));
    this.committedSinceBoot.add(workspaceId);
    return next;
  }

  /**
   * Compensate a receipt-finalization failure for one record created by this process.
   *
   * This is deliberately narrower than workspace deletion: both paired identities must match,
   * the record must still be a first-contact create, and the default can never be addressed.
   * The index is promoted first so restart authority is changed only after all guards pass; a
   * cleanup failure restores the exact prior index before memory is published.
   */
  compensateCreate(workspaceId: string, expectedHead: string, expectedSnapshotHash: string): WorkspaceRegistryCompensationResult {
    const id = typeof workspaceId === 'string' ? workspaceId : String(workspaceId || '');
    const failure = (
      code: WorkspaceRegistryCompensationFailureCode,
      error: string,
      status: 'refused' | 'failed' | 'partial',
      state: {
        index: WorkspaceRegistryCompensationState;
        record: WorkspaceRegistryCompensationState;
        memory: WorkspaceRegistryCompensationState;
        restartVisible: boolean | 'unknown';
        memoryIndexAgree: boolean;
        indexRestored?: boolean;
      },
    ): WorkspaceRegistryCompensationResult => ({
      ok: false,
      status,
      code,
      error,
      workspaceId: id,
      ...state,
    });
    const absent = {
      index: 'unknown' as const,
      record: 'unknown' as const,
      memory: 'unknown' as const,
      restartVisible: false as const,
      memoryIndexAgree: true,
    };
    const present = {
      index: 'present' as const,
      record: 'present' as const,
      memory: 'present' as const,
      restartVisible: true as const,
      memoryIndexAgree: true,
    };

    if (!validWorkspaceId(id)) {
      return failure('WORKSPACE_ID_INVALID', 'workspaceId is malformed.', 'refused', absent);
    }
    if (!validWorkspaceHash(expectedHead)) {
      return failure('WORKSPACE_EXPECTED_HEAD_INVALID', 'expected workspace head is malformed.', 'refused', absent);
    }
    if (!validWorkspaceHash(expectedSnapshotHash)) {
      return failure('WORKSPACE_EXPECTED_SNAPSHOT_HASH_INVALID', 'expected snapshot hash is malformed.', 'refused', absent);
    }
    if (id === this.index.defaultWorkspaceId) {
      return failure('WORKSPACE_DEFAULT_REFUSED', 'The default workspace cannot be compensated.', 'refused', present);
    }

    const record = this.records.get(id);
    const listed = this.index.workspaceIds.filter(candidate => candidate === id);
    if (!record && listed.length === 0) {
      return failure('WORKSPACE_NOT_FOUND', 'The workspace was not found.', 'refused', absent);
    }
    if (!record || listed.length !== 1) {
      return failure('WORKSPACE_STATE_INCONSISTENT', 'The workspace registry state is inconsistent; compensation was refused.', 'refused', {
        index: listed.length === 1 ? 'present' : 'unknown',
        record: record ? 'present' : 'unknown',
        memory: record ? 'present' : 'unknown',
        restartVisible: listed.length === 1 ? 'unknown' : false,
        memoryIndexAgree: false,
      });
    }
    if (!this.isLegacyFirstContact(id)) {
      return failure('WORKSPACE_NOT_JUST_CREATED', 'Only an uncommitted workspace created by this process can be compensated.', 'refused', present);
    }
    if (record.head !== expectedHead) {
      return failure('WORKSPACE_HEAD_STALE', 'The workspace head is stale.', 'refused', present);
    }
    if (this.snapshotHash(record) !== expectedSnapshotHash) {
      return failure('WORKSPACE_SNAPSHOT_STALE', 'The workspace snapshot hash is stale.', 'refused', present);
    }

    let originalIndexBytes: Buffer;
    let durableIndex: unknown;
    let durableRecord: unknown;
    try {
      const indexStat = fs.lstatSync(this.indexPath);
      if (!indexStat.isFile() || indexStat.isSymbolicLink()) throw new Error('index file is not a regular file');
      originalIndexBytes = fs.readFileSync(this.indexPath);
      durableIndex = JSON.parse(originalIndexBytes.toString('utf8'));
      const recordStat = fs.lstatSync(this.recordPath(id));
      if (!recordStat.isFile() || recordStat.isSymbolicLink()) throw new Error('record file is not a regular file');
      durableRecord = JSON.parse(fs.readFileSync(this.recordPath(id), 'utf8'));
    } catch {
      return failure('WORKSPACE_RECORD_UNAVAILABLE', 'The durable workspace record could not be verified.', 'refused', {
        ...present,
        record: 'unknown',
        restartVisible: 'unknown',
        memoryIndexAgree: false,
      });
    }
    if (!validIndex(durableIndex) || !sameRegistryIndex(durableIndex, this.index)) {
      return failure('WORKSPACE_STATE_INCONSISTENT', 'The durable workspace index changed or is invalid; compensation was refused.', 'refused', {
        ...present,
        restartVisible: 'unknown',
        memoryIndexAgree: false,
      });
    }
    if (!validRecord(durableRecord, id)) {
      return failure('WORKSPACE_RECORD_UNAVAILABLE', 'The durable workspace record is corrupt or unsupported.', 'refused', {
        ...present,
        record: 'unknown',
        restartVisible: 'unknown',
        memoryIndexAgree: false,
      });
    }
    const durableWorkspace = canonicalWorkspaceForRecord(durableRecord.workspace, id);
    if (contentHead(durableWorkspace) !== expectedHead) {
      return failure('WORKSPACE_HEAD_STALE', 'The durable workspace head is stale.', 'refused', present);
    }
    if (snapshotHead(durableWorkspace) !== expectedSnapshotHash) {
      return failure('WORKSPACE_SNAPSHOT_STALE', 'The durable workspace snapshot hash is stale.', 'refused', present);
    }

    const previousIndex = this.index;
    const nextIndex: WorkspaceRegistryIndex = {
      ...previousIndex,
      workspaceIds: previousIndex.workspaceIds.filter(candidate => candidate !== id),
    };
    const readDurableIndex = (): WorkspaceRegistryIndex | null => {
      try {
        const parsed = JSON.parse(fs.readFileSync(this.indexPath, 'utf8'));
        return validIndex(parsed) ? parsed : null;
      } catch {
        return null;
      }
    };
    const restoreIndex = (): boolean => {
      try {
        atomicWriteFile(this.indexPath, originalIndexBytes);
        return true;
      } catch {
        return false;
      }
    };
    const publishRemoved = (): void => {
      this.records.delete(id);
      this.snapshotHeads.delete(id);
      this.persistedAtBoot.delete(id);
      this.committedSinceBoot.delete(id);
      this.index = nextIndex;
    };
    const successfulCompensation = (): WorkspaceRegistryCompensationResult => {
      publishRemoved();
      return {
        ok: true,
        status: 'compensated',
        code: 'WORKSPACE_COMPENSATED',
        workspaceId: id,
        index: 'removed',
        record: 'removed',
        memory: 'removed',
        restartVisible: false,
        memoryIndexAgree: true,
      };
    };
    const reportPromotionFailure = (): WorkspaceRegistryCompensationResult => {
      const restored = restoreIndex();
      if (restored) {
        return failure('WORKSPACE_COMPENSATION_INDEX_FAILED', 'The durable workspace index promotion failed; no compensation was applied.', 'failed', {
          ...present,
          indexRestored: true,
        });
      }
      const observed = readDurableIndex();
      if (observed && sameRegistryIndex(observed, previousIndex)) {
        return failure('WORKSPACE_COMPENSATION_INDEX_FAILED', 'The durable workspace index promotion failed; the original index remains authoritative.', 'failed', {
          ...present,
          indexRestored: false,
        });
      }
      if (observed && sameRegistryIndex(observed, nextIndex)) {
        publishRemoved();
        return failure('WORKSPACE_COMPENSATION_INDEX_FAILED', 'The durable workspace index changed but compensation could not complete.', 'partial', {
          index: 'removed',
          record: 'present',
          memory: 'removed',
          restartVisible: false,
          memoryIndexAgree: true,
          indexRestored: false,
        });
      }
      return failure('WORKSPACE_COMPENSATION_INDEX_FAILED', 'The durable workspace index could not be reconciled after promotion failure.', 'partial', {
        index: 'unknown',
        record: 'present',
        memory: 'present',
        restartVisible: 'unknown',
        memoryIndexAgree: false,
        indexRestored: false,
      });
    };

    try {
      this.persistIndex(nextIndex);
      const promoted = readDurableIndex();
      if (!promoted || !sameRegistryIndex(promoted, nextIndex)) return reportPromotionFailure();
    } catch {
      return reportPromotionFailure();
    }

    try {
      fs.unlinkSync(this.recordPath(id));
    } catch {
      const observed = readDurableIndex();
      const recordPresence = (() => {
        try {
          fs.lstatSync(this.recordPath(id));
          return 'present' as const;
        } catch (error) {
          const code = error && typeof error === 'object' && 'code' in error
            ? (error as NodeJS.ErrnoException).code
            : undefined;
          return code === 'ENOENT' || code === 'ENOTDIR' ? 'absent' as const : 'unknown' as const;
        }
      })();
      if (observed && sameRegistryIndex(observed, nextIndex) && recordPresence === 'absent') {
        return successfulCompensation();
      }
      if (recordPresence === 'present') {
        const restored = restoreIndex();
        if (restored) {
          return failure('WORKSPACE_COMPENSATION_CLEANUP_FAILED', 'The workspace record cleanup failed; the durable index was restored.', 'failed', {
            ...present,
            indexRestored: true,
          });
        }
        const afterRestore = readDurableIndex();
        if (afterRestore && sameRegistryIndex(afterRestore, previousIndex)) {
          return failure('WORKSPACE_COMPENSATION_CLEANUP_FAILED', 'The workspace record cleanup failed; the original index remains authoritative.', 'failed', {
            ...present,
            indexRestored: false,
          });
        }
        if (afterRestore && sameRegistryIndex(afterRestore, nextIndex)) {
          publishRemoved();
          return failure('WORKSPACE_COMPENSATION_CLEANUP_FAILED', 'The workspace record cleanup failed after index promotion; the record remains durable but is no longer listed.', 'partial', {
            index: 'removed',
            record: 'present',
            memory: 'removed',
            restartVisible: false,
            memoryIndexAgree: true,
            indexRestored: false,
          });
        }
        return failure('WORKSPACE_COMPENSATION_CLEANUP_FAILED', 'The workspace record cleanup and index restoration could not be reconciled.', 'partial', {
          index: 'unknown',
          record: 'present',
          memory: 'present',
          restartVisible: 'unknown',
          memoryIndexAgree: false,
          indexRestored: false,
        });
      }
      return failure('WORKSPACE_COMPENSATION_CLEANUP_FAILED', 'The workspace record cleanup and index restoration could not be reconciled.', 'partial', {
        index: observed && sameRegistryIndex(observed, nextIndex) ? 'removed' : observed && sameRegistryIndex(observed, previousIndex) ? 'present' : 'unknown',
        record: recordPresence === 'absent' ? 'removed' : 'unknown',
        memory: 'present',
        restartVisible: 'unknown',
        memoryIndexAgree: false,
        indexRestored: false,
      });
    }

    return successfulCompensation();
  }

  snapshotHash(record: WorkspaceRecord): string {
    const cached = this.snapshotHeads.get(record.workspaceId);
    if (cached) return cached;
    const computed = snapshotHead(record.workspace);
    this.snapshotHeads.set(record.workspaceId, computed);
    return computed;
  }

  isLegacyFirstContact(workspaceId: string): boolean {
    return !this.persistedAtBoot.has(workspaceId) && !this.committedSinceBoot.has(workspaceId);
  }
}

export function runWorkspaceRegistrySelftest(): {
  pass: boolean;
  passed: number;
  total: number;
  checks: Array<{ name: string; pass: boolean; detail?: string }>;
} {
  const checks: Array<{ name: string; pass: boolean; detail?: string }> = [];
  const ok = (name: string, pass: boolean, detail?: unknown) => checks.push({ name, pass, ...(detail === undefined ? {} : { detail: String(detail) }) });
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'x4forge-workspace-registry-'));
  const legacy = { name: 'Same_Name', nodes: [{ id: 'legacy' }], links: [] } as unknown as ModWorkspace;
  let now = Date.parse('2026-07-31T12:00:00Z');
  let seed = 1;
  const randomHex = (bytes: number) => (seed++).toString(16).padStart(bytes * 2, '0');
  try {
    atomicWriteJson(path.join(root, 'active.json'), { workspace: legacy, version: 7, savedAt: '2026-07-30T00:00:00Z', origin: 'legacy-active' });
    const registry = new WorkspaceRegistry({ root, defaultWorkspace: legacy, now: () => now, randomHex, maxRecords: 3, maxWorkspaceBytes: 2048 });
    const migrated = registry.list()[0];
    const migratedRecord = registry.lookup(migrated.workspaceId);
    ok('legacy_active_migrated', registry.list().length === 1 && migrated.name === 'Same_Name');
    ok('migration_preserves_content_hash', migrated.workspaceHash === contentHead(legacy));
    ok('migration_indexes_complete_snapshot_hash', migratedRecord.ok && migrated.snapshotHash === snapshotHead(migratedRecord.record.workspace));
    const canonicalLegacyId = migratedRecord.ok ? migratedRecord.record.workspace.id : '';
    ok('workspace_id_is_server_owned', validWorkspaceId(migrated.workspaceId));
    ok('legacy_missing_local_id_is_canonicalized', canonicalLegacyId === `workspace_${migrated.workspaceId.slice(3)}`);
    const duplicate = registry.create({ ...legacy, nodes: [{ id: 'other' }] } as ModWorkspace, 'selftest:create');
    ok('duplicate_names_get_distinct_ids', duplicate.workspace.name === legacy.name && duplicate.workspaceId !== migrated.workspaceId);
    ok('idless_creates_get_distinct_canonical_local_ids', duplicate.workspace.id === `workspace_${duplicate.workspaceId.slice(3)}` && duplicate.workspace.id !== canonicalLegacyId);
    const explicitDuplicate = registry.commit(duplicate.workspaceId, { ...duplicate.workspace, id: 'explicit-local-id' }, 'selftest:explicit-id');
    ok('explicit_local_id_survives_commit', explicitDuplicate.workspace.id === 'explicit-local-id');
    const beforeOther = explicitDuplicate.head;
    now += 10;
    const committed = registry.commit(migrated.workspaceId, { ...legacy, nodes: [{ id: 'changed' }] } as ModWorkspace, 'selftest:commit');
    ok('commit_advances_only_addressed_record', committed.version > migrated.version && (registry.lookup(duplicate.workspaceId) as any).record.head === beforeOther);
    ok('idless_commit_preserves_canonical_local_id', committed.workspace.id === canonicalLegacyId);
    const beforeThemeSummary = registry.summary(committed);
    now += 10;
    const themeCommitted = registry.commit(migrated.workspaceId, {
      ...committed.workspace,
      uiTheme: { backgroundColor: '#000', borderColor: '#111', accentColor: '#abc', opacity: 1, showIcons: true },
    }, 'selftest:theme-commit');
    const afterThemeSummary = registry.summary(themeCommitted);
    ok('non_cas_commit_invalidates_snapshot_hash_only',
      afterThemeSummary.workspaceHash === beforeThemeSummary.workspaceHash
      && afterThemeSummary.snapshotHash !== beforeThemeSummary.snapshotHash);
    ok('repeated_summary_reuses_stable_snapshot_hash', registry.summary(themeCommitted).snapshotHash === afterThemeSummary.snapshotHash);
    ok('legacy_migrated_record_not_first_contact', registry.isLegacyFirstContact(migrated.workspaceId) === false);
    const idlessRecordPath = path.join(root, RECORD_DIR, `${migrated.workspaceId}.json`);
    const idlessRecord = JSON.parse(fs.readFileSync(idlessRecordPath, 'utf8'));
    delete idlessRecord.workspace.id;
    atomicWriteJson(idlessRecordPath, idlessRecord);
    const idlessBytesBeforeLoad = fs.readFileSync(idlessRecordPath, 'utf8');
    const restarted = new WorkspaceRegistry({ root, defaultWorkspace: legacy, now: () => now + 100, randomHex });
    ok('restart_preserves_ids_and_heads', JSON.stringify(restarted.list().map(row => [row.workspaceId, row.workspaceHash, row.snapshotHash])) === JSON.stringify(registry.list().map(row => [row.workspaceId, row.workspaceHash, row.snapshotHash])));
    const restartedMigrated = restarted.lookup(migrated.workspaceId);
    ok('accepted_idless_record_rehydrates_stable_local_id', restartedMigrated.ok && restartedMigrated.record.workspace.id === canonicalLegacyId);
    ok('idless_record_load_is_read_only', fs.readFileSync(idlessRecordPath, 'utf8') === idlessBytesBeforeLoad);
    const restartedDuplicate = restarted.lookup(duplicate.workspaceId);
    ok('explicit_local_id_survives_restart', restartedDuplicate.ok && restartedDuplicate.record.workspace.id === 'explicit-local-id');
    ok('unknown_id_fails_closed', restarted.lookup('ws_ffffffffffffffffffffffff').ok === false);

    const compensationRoot = path.join(root, 'compensation');
    const compensationRegistry = new WorkspaceRegistry({
      root: compensationRoot,
      defaultWorkspace: { ...legacy, name: 'Compensation_Default' } as ModWorkspace,
      now: () => now,
      randomHex,
      maxRecords: 4,
      maxWorkspaceBytes: 2048,
    });
    const createdForCompensation = compensationRegistry.create({ ...legacy, name: 'Compensation_Target' } as ModWorkspace, 'selftest:compensation');
    const unrelatedForCompensation = compensationRegistry.create({ ...legacy, name: 'Compensation_Unrelated' } as ModWorkspace, 'selftest:unrelated');
    const committedForCompensation = compensationRegistry.create({ ...legacy, name: 'Compensation_Committed' } as ModWorkspace, 'selftest:committed-create');
    const committedAfterCommit = compensationRegistry.commit(committedForCompensation.workspaceId, {
      ...committedForCompensation.workspace,
      description: 'committed once',
    } as ModWorkspace, 'selftest:committed-once');
    const expectedCompensationHead = createdForCompensation.head;
    const expectedCompensationSnapshotHash = compensationRegistry.snapshotHash(createdForCompensation);
    const defaultForCompensation = compensationRegistry.lookup(compensationRegistry.defaultWorkspaceId);
    const unrelatedRecordPath = path.join(compensationRoot, RECORD_DIR, `${unrelatedForCompensation.workspaceId}.json`);
    const committedRecordPath = path.join(compensationRoot, RECORD_DIR, `${committedForCompensation.workspaceId}.json`);
    const targetRecordPath = path.join(compensationRoot, RECORD_DIR, `${createdForCompensation.workspaceId}.json`);
    const compensationIndexPath = path.join(compensationRoot, INDEX_FILE);
    const committedGuardIndexBytes = fs.readFileSync(compensationIndexPath);
    const committedGuardRecordBytes = fs.readFileSync(committedRecordPath);
    const committedGuardList = JSON.stringify(compensationRegistry.list());
    const committedGuardMemory = JSON.stringify(compensationRegistry.lookup(committedForCompensation.workspaceId));
    const committedGuardDefaultId = compensationRegistry.defaultWorkspaceId;
    const committedGuardUnrelatedBytes = fs.readFileSync(unrelatedRecordPath);
    const committedGuard = compensationRegistry.compensateCreate(
      committedForCompensation.workspaceId,
      committedAfterCommit.head,
      compensationRegistry.snapshotHash(committedAfterCommit),
    );
    ok('compensation_committed_record_refused_and_preserved',
      committedGuard.ok === false && committedGuard.code === 'WORKSPACE_NOT_JUST_CREATED' &&
      fs.readFileSync(compensationIndexPath).equals(committedGuardIndexBytes) &&
      fs.readFileSync(committedRecordPath).equals(committedGuardRecordBytes) &&
      JSON.stringify(compensationRegistry.list()) === committedGuardList &&
      JSON.stringify(compensationRegistry.lookup(committedForCompensation.workspaceId)) === committedGuardMemory &&
      compensationRegistry.defaultWorkspaceId === committedGuardDefaultId &&
      fs.readFileSync(unrelatedRecordPath).equals(committedGuardUnrelatedBytes));
    const targetIndexBytesBeforeFailure = fs.readFileSync(compensationIndexPath);
    const targetRecordBytesBeforeFailure = fs.readFileSync(targetRecordPath);
    const targetListBeforeFailure = JSON.stringify(compensationRegistry.list());
    const targetMemoryBeforeFailure = JSON.stringify(compensationRegistry.lookup(createdForCompensation.workspaceId));
    const unrelatedBytesBeforeSuccess = fs.readFileSync(unrelatedRecordPath).toString('utf8');
    const defaultIdBeforeCompensation = compensationRegistry.defaultWorkspaceId;
    const scanTmpFiles = (dir: string): string[] => {
      const found: string[] = [];
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) found.push(...scanTmpFiles(full));
        else if (entry.name.endsWith('.tmp')) found.push(entry.name);
      }
      return found;
    };

    const malformedCompensation = compensationRegistry.compensateCreate('not-a-workspace', expectedCompensationHead, expectedCompensationSnapshotHash);
    ok('compensation_malformed_identity_refused', malformedCompensation.ok === false && malformedCompensation.code === 'WORKSPACE_ID_INVALID');
    const staleHeadCompensation = compensationRegistry.compensateCreate(createdForCompensation.workspaceId, '0000000000000000', expectedCompensationSnapshotHash);
    ok('compensation_stale_head_refused', staleHeadCompensation.ok === false && staleHeadCompensation.code === 'WORKSPACE_HEAD_STALE');
    const staleSnapshotCompensation = compensationRegistry.compensateCreate(createdForCompensation.workspaceId, expectedCompensationHead, '0000000000000000');
    ok('compensation_stale_snapshot_refused', staleSnapshotCompensation.ok === false && staleSnapshotCompensation.code === 'WORKSPACE_SNAPSHOT_STALE');
    const defaultCompensation = defaultForCompensation.ok
      ? compensationRegistry.compensateCreate(defaultForCompensation.record.workspaceId, defaultForCompensation.record.head, compensationRegistry.snapshotHash(defaultForCompensation.record))
      : null;
    ok('compensation_default_refused', defaultCompensation?.ok === false && defaultCompensation.code === 'WORKSPACE_DEFAULT_REFUSED');
    const unknownCompensation = compensationRegistry.compensateCreate('ws_ffffffffffffffffffffffff', expectedCompensationHead, expectedCompensationSnapshotHash);
    ok('compensation_unknown_identity_refused', unknownCompensation.ok === false && unknownCompensation.code === 'WORKSPACE_NOT_FOUND');

    const registryWithPersistIndexSeam = compensationRegistry as unknown as { persistIndex: (index: WorkspaceRegistryIndex) => void };
    const originalPersistIndex = registryWithPersistIndexSeam.persistIndex;
    registryWithPersistIndexSeam.persistIndex = () => { throw new Error('injected index promotion failure'); };
    let injectedIndexFailure: WorkspaceRegistryCompensationResult;
    try {
      injectedIndexFailure = compensationRegistry.compensateCreate(createdForCompensation.workspaceId, expectedCompensationHead, expectedCompensationSnapshotHash);
    } finally {
      registryWithPersistIndexSeam.persistIndex = originalPersistIndex;
    }
    ok('compensation_index_failure_preserves_exact_state_and_no_temp_debris',
      injectedIndexFailure!.ok === false && injectedIndexFailure!.code === 'WORKSPACE_COMPENSATION_INDEX_FAILED' &&
      injectedIndexFailure!.indexRestored === true &&
      fs.readFileSync(compensationIndexPath).equals(targetIndexBytesBeforeFailure) &&
      fs.readFileSync(targetRecordPath).equals(targetRecordBytesBeforeFailure) &&
      JSON.stringify(compensationRegistry.list()) === targetListBeforeFailure &&
      JSON.stringify(compensationRegistry.lookup(createdForCompensation.workspaceId)) === targetMemoryBeforeFailure &&
      compensationRegistry.defaultWorkspaceId === defaultIdBeforeCompensation && scanTmpFiles(compensationRoot).length === 0);

    const fsWithUnlinkSeam = fs as unknown as { unlinkSync: (candidate: string) => void };
    const originalUnlink = fsWithUnlinkSeam.unlinkSync;
    fsWithUnlinkSeam.unlinkSync = (candidate: string) => {
      const result = originalUnlink(candidate);
      if (path.resolve(candidate) === path.resolve(targetRecordPath)) throw new Error('injected post-unlink cleanup failure');
      return result;
    };
    let injectedCleanupFailure: WorkspaceRegistryCompensationResult;
    try {
      injectedCleanupFailure = compensationRegistry.compensateCreate(createdForCompensation.workspaceId, expectedCompensationHead, expectedCompensationSnapshotHash);
    } finally {
      fsWithUnlinkSeam.unlinkSync = originalUnlink;
    }
    ok('compensation_successfully_removes_just_created_workspace',
      injectedCleanupFailure!.ok && injectedCleanupFailure!.code === 'WORKSPACE_COMPENSATED' &&
      injectedCleanupFailure!.index === 'removed' && injectedCleanupFailure!.record === 'removed' &&
      injectedCleanupFailure!.memory === 'removed' && injectedCleanupFailure!.restartVisible === false &&
      !fs.existsSync(targetRecordPath));
    ok('compensation_post_unlink_throw_reports_success',
      injectedCleanupFailure!.ok && injectedCleanupFailure!.code === 'WORKSPACE_COMPENSATED' &&
      injectedCleanupFailure!.index === 'removed' && injectedCleanupFailure!.record === 'removed' &&
      injectedCleanupFailure!.memory === 'removed' && injectedCleanupFailure!.restartVisible === false &&
      !fs.existsSync(targetRecordPath) && scanTmpFiles(compensationRoot).length === 0);
    ok('compensation_preserves_unrelated_record_and_default',
      compensationRegistry.defaultWorkspaceId === defaultIdBeforeCompensation &&
      !compensationRegistry.list().some(row => row.workspaceId === createdForCompensation.workspaceId) &&
      (() => {
        const preserved = compensationRegistry.lookup(unrelatedForCompensation.workspaceId);
        return preserved.ok && JSON.stringify(preserved.record) === JSON.stringify(unrelatedForCompensation);
      })() &&
      fs.readFileSync(unrelatedRecordPath).toString('utf8') === unrelatedBytesBeforeSuccess);
    const restartedCompensationRegistry = new WorkspaceRegistry({
      root: compensationRoot,
      defaultWorkspace: { ...legacy, name: 'Compensation_Default' } as ModWorkspace,
      now: () => now + 100,
      randomHex,
      maxRecords: 4,
      maxWorkspaceBytes: 2048,
    });
    const restartedDefault = restartedCompensationRegistry.lookup(defaultIdBeforeCompensation);
    const restartedUnrelated = restartedCompensationRegistry.lookup(unrelatedForCompensation.workspaceId);
    ok('compensation_restart_proof_hides_removed_workspace',
      restartedCompensationRegistry.defaultWorkspaceId === defaultIdBeforeCompensation &&
      !restartedCompensationRegistry.list().some(row => row.workspaceId === createdForCompensation.workspaceId) &&
      restartedCompensationRegistry.lookup(createdForCompensation.workspaceId).ok === false &&
      restartedCompensationRegistry.lookup(unrelatedForCompensation.workspaceId).ok === true &&
      restartedCompensationRegistry.lookup(committedForCompensation.workspaceId).ok === true &&
      restartedDefault.ok && defaultForCompensation.ok && JSON.stringify(restartedDefault.record) === JSON.stringify(defaultForCompensation.record) &&
      restartedUnrelated.ok && JSON.stringify(restartedUnrelated) === JSON.stringify(compensationRegistry.lookup(unrelatedForCompensation.workspaceId)) &&
      fs.readFileSync(unrelatedRecordPath).toString('utf8') === unrelatedBytesBeforeSuccess &&
      !fs.existsSync(targetRecordPath));
    const replayCompensation = compensationRegistry.compensateCreate(createdForCompensation.workspaceId, expectedCompensationHead, expectedCompensationSnapshotHash);
    ok('compensation_replay_refused', replayCompensation.ok === false && replayCompensation.code === 'WORKSPACE_NOT_FOUND');

    let capRejected = false;
    try { registry.create({ ...legacy, name: 'Third' } as ModWorkspace, 'selftest'); registry.create({ ...legacy, name: 'Fourth' } as ModWorkspace, 'selftest'); } catch { capRejected = true; }
    ok('record_cap_rejected', capRejected && registry.list().length === 3);
    let oversizedRejected = false;
    try { new WorkspaceRegistry({ root: path.join(root, 'oversized'), defaultWorkspace: { ...legacy, description: 'x'.repeat(4096) } as ModWorkspace, maxWorkspaceBytes: 100, randomHex }); } catch { oversizedRejected = true; }
    ok('payload_cap_rejected', oversizedRejected);
    const corruptRoot = path.join(root, 'corrupt');
    fs.mkdirSync(corruptRoot, { recursive: true });
    fs.writeFileSync(path.join(corruptRoot, INDEX_FILE), '{nope', 'utf8');
    let corruptRejected = false;
    try { new WorkspaceRegistry({ root: corruptRoot, defaultWorkspace: legacy, randomHex }); } catch { corruptRejected = true; }
    ok('corrupt_index_refuses_fallback', corruptRejected);
  } finally {
    try { fs.rmSync(root, { recursive: true, force: true }); } catch { /* test cleanup */ }
  }
  const passed = checks.filter(check => check.pass).length;
  return { pass: passed === checks.length, passed, total: checks.length, checks };
}
