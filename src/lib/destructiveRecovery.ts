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
  beforeWorkspace: unknown;
  beforeHash: string;
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

function validId(id: string): boolean {
  return /^[a-z0-9][a-z0-9_-]{11,80}$/i.test(String(id || ''));
}

function isRecord(value: unknown): value is DestructiveRecoveryRecord {
  if (!value || typeof value !== 'object') return false;
  const row = value as Partial<DestructiveRecoveryRecord>;
  if (row.schema !== RECOVERY_SCHEMA || !validId(String(row.id || ''))) return false;
  if (!['workspace', 'deploy'].includes(String(row.kind)) || !['preparing', 'ready', 'used'].includes(String(row.status))) return false;
  if (!row.createdAt || !row.expiresAt || !row.expectedCurrentHash || !row.summary) return false;
  if (row.kind === 'workspace') return row.beforeWorkspace !== undefined && typeof row.beforeHash === 'string';
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
    if (!validId(id)) throw new Error('Invalid recovery id.');
    const candidate = path.resolve(this.root, id);
    if (candidate === this.root || !candidate.startsWith(`${this.root}${path.sep}`)) throw new Error('Recovery path escaped its root.');
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

  createWorkspace(input: {
    beforeWorkspace: unknown;
    beforeHash: string;
    expectedCurrentHash: string;
    summary: string;
  }): WorkspaceRecoveryRecord {
    const serialized = JSON.stringify(input.beforeWorkspace);
    const bytes = Buffer.byteLength(serialized, 'utf8');
    if (bytes > this.maxWorkspaceBytes) throw new Error(`Workspace recovery exceeds ${this.maxWorkspaceBytes} bytes.`);
    this.prune();
    const now = this.now();
    const record: WorkspaceRecoveryRecord = {
      schema: RECOVERY_SCHEMA,
      id: this.newId('workspace'),
      kind: 'workspace',
      status: 'ready',
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + this.maxAgeMs).toISOString(),
      summary: input.summary,
      expectedCurrentHash: input.expectedCurrentHash,
      beforeWorkspace: input.beforeWorkspace,
      beforeHash: input.beforeHash,
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
  let now = Date.parse('2026-07-30T00:00:00Z');
  try {
    const store = new DestructiveRecoveryStore({ root, maxEntries: 3, maxAgeMs: 1_000, maxWorkspaceBytes: 256, maxDeployBytes: 64, now: () => now });
    const workspace = store.createWorkspace({ beforeWorkspace: { name: 'before', nodes: [], links: [] }, beforeHash: 'before', expectedCurrentHash: 'after', summary: 'forced overwrite' });
    const readWorkspace = store.read(workspace.id);
    ok('workspace_roundtrip', readWorkspace.ok && readWorkspace.record.kind === 'workspace' && readWorkspace.record.expectedCurrentHash === 'after');
    store.markUsed(workspace.id);
    const usedWorkspace = store.read(workspace.id);
    ok('used_record_is_retained_but_not_ready', usedWorkspace.ok && usedWorkspace.record.status === 'used');
    let replayRejected = false;
    try { store.markUsed(workspace.id); } catch { replayRejected = true; }
    ok('replay_rejected', replayRejected);
    let oversizedRejected = false;
    try { store.createWorkspace({ beforeWorkspace: { huge: 'x'.repeat(300) }, beforeHash: 'a', expectedCurrentHash: 'b', summary: 'large' }); } catch { oversizedRejected = true; }
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
  }
  const passed = checks.filter(check => check.pass).length;
  return { allPassed: passed === checks.length, passed, total: checks.length, checks };
}
