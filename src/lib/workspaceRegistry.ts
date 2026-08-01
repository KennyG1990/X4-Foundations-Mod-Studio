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
