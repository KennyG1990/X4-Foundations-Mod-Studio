import fs from 'node:fs';

import {
  assertValidActionReceipt,
  canonicalJson,
  type ActionReceipt,
  type ActionReceiptAfter,
  type ActionReceiptResourceAuthority,
} from '../lib/actionReceipt';
import {
  combineReceiptResourceBeforeHashes,
  hashBoundedReceiptFacts,
  mapRuntimeReceiptIdentity,
  type RuntimeReceiptIdentityInput,
} from '../lib/actionReceiptRuntime';
import type {
  ActionReceiptTransactionProjection,
  ActionReceiptTransactionStore,
} from '../lib/actionReceiptTransaction';
import {
  hashWorkspaceActionRequestFacts,
  workspaceReceiptAfter,
  workspaceReceiptResources,
} from '../lib/workspaceActionReceipt';
import {
  DestructiveRecoveryStore,
} from '../lib/destructiveRecovery';
import { workspaceSnapshotHash } from '../lib/workspaceIdentity';
import type { WorkspaceRecord, WorkspaceRegistry } from '../lib/workspaceRegistry';
import {
  workspaceContentReceiptHash,
  workspaceSnapshotReceiptHash,
} from '../lib/workspaceReceiptHash';
import { sanitizeWorkspace, type ModWorkspace } from '../types';
import {
  WorkspaceSnapshotSourceError,
  readWorkspaceSnapshotSource,
  type WorkspaceSnapshotFileSource,
} from './workspaceSnapshotSource';
import type {
  WorkspaceReceiptService,
  WorkspaceReceiptTransactionDescription,
} from './workspaceReceiptService';

export const WORKSPACE_SNAPSHOT_RESTORE_ROUTE_KEY = 'POST /api/fs/restore-snapshot';
export const WORKSPACE_SNAPSHOT_RESTORE_MODE = 'restore';

const OPERATION_ID_RE = /^[a-zA-Z][a-zA-Z0-9._:-]{0,127}$/;
const WORKSPACE_ID_RE = /^ws_[a-f0-9]{24}$/i;
const LEGACY_HEAD_RE = /^[a-f0-9]{16}$/i;
const LEGACY_SNAPSHOT_HASH_RE = /^[a-f0-9]{16}$/i;
const COMPLETE_HASH_RE = /^[a-f0-9]{64}$/;
const SAFE_TEXT_MAX = 512;
const RESTORE_AFTER_CODE = 'workspace_snapshot_restored';
const RESTORE_NO_CHANGE_CODE = 'workspace_snapshot_restore_no_change';
const RESTORE_ROLLBACK_CODE = 'workspace_snapshot_restore_rollback_failed';
const RESTORE_RECOVERY_SUMMARY = 'Workspace snapshot restore recovery';

export type WorkspaceSnapshotRestoreReceiptAdapterStore = ActionReceiptTransactionStore
  & Required<Pick<ActionReceiptTransactionStore, 'read'>>;

export type WorkspaceSnapshotRestoreSourceReader = (
  input: unknown,
) => WorkspaceSnapshotFileSource;

export type WorkspaceSnapshotRestoreMayProceed = () => boolean | Promise<boolean>;

export type WorkspaceSnapshotRestoreProjectionCapture = (
  projection: ActionReceiptTransactionProjection | undefined,
) => void | Promise<void>;

export interface WorkspaceSnapshotRestoreReceiptAdapterDependencies {
  registry: WorkspaceRegistry;
  receiptService: WorkspaceReceiptService;
  recoveryStore: DestructiveRecoveryStore;
  store: WorkspaceSnapshotRestoreReceiptAdapterStore;
  readSource?: WorkspaceSnapshotRestoreSourceReader;
  captureProjection?: WorkspaceSnapshotRestoreProjectionCapture;
}

export interface WorkspaceSnapshotRestoreReceiptAdapterInput {
  root: unknown;
  workspaceId: unknown;
  modId: unknown;
  snapshotName: unknown;
  expectedHead: unknown;
  expectedSnapshotHash: unknown;
  expectedVersion?: unknown;
  operationId: unknown;
  identity: RuntimeReceiptIdentityInput;
  mayProceed?: WorkspaceSnapshotRestoreMayProceed;
}

export interface WorkspaceSnapshotRestoreReceiptAdapterSuccess {
  ok: true;
  record: WorkspaceRecord;
  receipt: ActionReceiptTransactionProjection;
  replayed: boolean;
  applied: boolean;
}

export interface WorkspaceSnapshotRestoreReceiptAdapterFailure {
  ok: false;
  code: string;
  receipt?: ActionReceiptTransactionProjection;
  replayed: boolean;
}

export type WorkspaceSnapshotRestoreReceiptAdapterResult =
  | WorkspaceSnapshotRestoreReceiptAdapterSuccess
  | WorkspaceSnapshotRestoreReceiptAdapterFailure;

interface NormalizedSource {
  workspace: ModWorkspace;
  sourceHash: string;
  savedAt: string;
  name: string;
  snapshotModIdHash: string;
  snapshotIdentityHash: string;
}

interface RestoreFacts {
  workspaceId: string;
  beforeRecord: WorkspaceRecord;
  beforeWorkspace: ModWorkspace;
  beforeResources: ActionReceiptResourceAuthority[];
  targetWorkspace: ModWorkspace;
  targetResources: ActionReceiptResourceAuthority[];
  source: NormalizedSource;
  expectedHead: string;
  expectedSnapshotHash: string;
  expectedVersion?: number;
  requestHash: string;
  beforeHash: string;
  changed: boolean;
}

interface RestoreExecutionState {
  domainFailureCode?: string;
  committedRecord?: WorkspaceRecord;
  recoveryPrepared?: boolean;
  commitAttempted?: boolean;
}

export type WorkspaceSnapshotRestoreReceiptFactsResult =
  | { ok: true; facts: RestoreFacts }
  | { ok: false; code: string };

export interface WorkspaceSnapshotRestoreReceiptExecution {
  description: WorkspaceReceiptTransactionDescription;
  state: RestoreExecutionState;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  if (Object.getOwnPropertySymbols(value).length > 0) return false;
  const names = Object.getOwnPropertyNames(value);
  const keys = Object.keys(value);
  if (names.length !== keys.length) return false;
  return keys.every(key => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor !== undefined && 'value' in descriptor;
  });
}

function hasControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

function safeText(value: unknown): value is string {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= SAFE_TEXT_MAX
    && !hasControlCharacter(value);
}

function safeHash(value: unknown): value is string {
  return typeof value === 'string' && COMPLETE_HASH_RE.test(value);
}

function stableWorkspaceShape(value: unknown): value is ModWorkspace {
  if (!isPlainRecord(value)
    || typeof value.id !== 'string'
    || value.id.length === 0
    || !Array.isArray(value.nodes)) return false;
  return value.nodes.every(node => isPlainRecord(node)
    && typeof node.id === 'string'
    && node.id.length > 0);
}

function safeRuntimeFailureCode(error: unknown): string {
  if (isPlainRecord(error) && typeof error.code === 'string'
    && /^ACTION_RECEIPT_RUNTIME_[A-Z0-9_]+$/.test(error.code)) {
    return error.code;
  }
  return 'ACTION_RECEIPT_RUNTIME_IDENTITY_INVALID';
}

function sourceFailureCode(error: unknown): string {
  if (error instanceof WorkspaceSnapshotSourceError) return error.code;
  if (isPlainRecord(error) && typeof error.code === 'string'
    && /^WORKSPACE_SNAPSHOT_[A-Z0-9_]+$/.test(error.code)) return error.code;
  return 'WORKSPACE_SNAPSHOT_READ_FAILED';
}

function normalizeSource(value: unknown): NormalizedSource | undefined {
  if (!isPlainRecord(value)
    || !stableWorkspaceShape(value.workspace)
    || !safeHash(value.sourceHash)
    || !safeText(value.savedAt)
    || !safeText(value.name)
    || !safeHash(value.snapshotModIdHash)
    || !safeHash(value.snapshotIdentityHash)) return undefined;

  try {
    const workspace = sanitizeWorkspace(value.workspace);
    if (!stableWorkspaceShape(workspace)) return undefined;
    const contentHash = workspaceContentReceiptHash(workspace);
    const snapshotHash = workspaceSnapshotReceiptHash(workspace);
    if (!safeHash(contentHash) || !safeHash(snapshotHash)) return undefined;
    return {
      workspace,
      sourceHash: value.sourceHash,
      savedAt: value.savedAt,
      name: value.name,
      snapshotModIdHash: value.snapshotModIdHash,
      snapshotIdentityHash: value.snapshotIdentityHash,
    };
  } catch {
    return undefined;
  }
}

function normalizedSource(
  dependencies: WorkspaceSnapshotRestoreReceiptAdapterDependencies,
  input: WorkspaceSnapshotRestoreReceiptAdapterInput,
): { ok: true; source: NormalizedSource } | { ok: false; code: string } {
  const reader = dependencies.readSource ?? ((value: unknown) => readWorkspaceSnapshotSource(value));
  try {
    const source = normalizeSource(reader({
      root: input.root,
      modId: input.modId,
      snapshotName: input.snapshotName,
    }));
    return source === undefined
      ? { ok: false, code: 'WORKSPACE_SNAPSHOT_ENVELOPE_INVALID' }
      : { ok: true, source };
  } catch (error) {
    return { ok: false, code: sourceFailureCode(error) };
  }
}

function sameResourceIdentity(
  left: ActionReceiptResourceAuthority,
  right: ActionReceiptResourceAuthority,
): boolean {
  return left.role === right.role
    && left.root === right.root
    && left.relativePath === right.relativePath;
}

function sameResources(left: unknown, right: unknown, includeHashes = true): boolean {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
  return left.every((entry, index) => {
    const other = right[index];
    if (!isPlainRecord(entry) || !isPlainRecord(other)) return false;
    if (!sameResourceIdentity(entry as unknown as ActionReceiptResourceAuthority, other as unknown as ActionReceiptResourceAuthority)) return false;
    return !includeHashes || entry.beforeHash === other.beforeHash;
  });
}

function sameAfter(left: ActionReceiptAfter | undefined, right: ActionReceiptAfter): boolean {
  if (left === undefined || left.outcome !== right.outcome || left.code !== right.code) return false;
  if (!Array.isArray(left.resources) || left.resources.length !== right.resources.length) return false;
  return left.resources.every((entry, index) => {
    const other = right.resources[index];
    return entry.role === other?.role
      && entry.root === other?.root
      && entry.relativePath === other?.relativePath
      && entry.hash === other?.hash;
  });
}

function restoreFailure(
  code: string,
  replayed = false,
  receipt?: ActionReceiptTransactionProjection,
): WorkspaceSnapshotRestoreReceiptAdapterFailure {
  return receipt === undefined ? { ok: false, code, replayed } : { ok: false, code, receipt, replayed };
}

function unwrapStoredReceipt(value: unknown): unknown {
  return isPlainRecord(value) && Object.prototype.hasOwnProperty.call(value, 'receipt')
    ? value.receipt
    : value;
}

/**
 * The shared store intentionally exposes a single-id read API, while restore requires a
 * cross-client/workspace operation-id collision to refuse before a second receipt is created.
 * This is a read-only collision audit: receipt bytes are still parsed and hash-verified by the
 * existing ActionReceiptStore.read owner, and no index, cache, or second writer is introduced.
 */
async function hasConflictingOperationReceipt(
  store: WorkspaceSnapshotRestoreReceiptAdapterStore,
  input: WorkspaceSnapshotRestoreReceiptAdapterInput,
  facts: RestoreFacts,
): Promise<{ ok: true; conflict: boolean } | { ok: false; code: string }> {
  const root = (store as unknown as { root?: unknown }).root;
  if (typeof root !== 'string' || root.length === 0) return { ok: true, conflict: false };
  let entries: fs.Dirent[];
  try {
    if (!fs.existsSync(root)) return { ok: true, conflict: false };
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return { ok: false, code: 'WORKSPACE_SNAPSHOT_RESTORE_RECEIPT_LOOKUP_FAILED' };
  }
  let expectedIdentity: ReturnType<typeof mapRuntimeReceiptIdentity>;
  try {
    expectedIdentity = mapRuntimeReceiptIdentity(input.identity);
  } catch {
    return { ok: false, code: 'ACTION_RECEIPT_RUNTIME_IDENTITY_INVALID' };
  }
  for (const entry of entries) {
    if (!entry.isFile() || !/^ar_[a-f0-9]{64}\.json$/.test(entry.name)) continue;
    const id = entry.name.slice(0, -'.json'.length);
    try {
      const receipt = assertValidActionReceipt(unwrapStoredReceipt(await store.read(id)));
      const capability = receipt.capability;
      if (!('legacyRoute' in capability)
        || capability.legacyRoute !== '/api/fs/restore-snapshot'
        || capability.method !== 'POST'
        || receipt.authority.operationId !== input.operationId) continue;
      const sameCaller = receipt.actor.kind === expectedIdentity.actor.kind
        && receipt.actor.id === expectedIdentity.actor.id
        && receipt.client.channel === expectedIdentity.client.channel
        && receipt.client.id === expectedIdentity.client.id
        && receipt.client.version === expectedIdentity.client.version;
      const sameWorkspace = receipt.authority.scope === 'workspace'
        && receipt.authority.workspaceId === facts.workspaceId;
      const sameIntent = receipt.input.requestHash === facts.requestHash;
      if (!sameCaller || !sameWorkspace || !sameIntent) return { ok: true, conflict: true };
    } catch {
      return { ok: false, code: 'WORKSPACE_SNAPSHOT_RESTORE_RECEIPT_LOOKUP_FAILED' };
    }
  }
  return { ok: true, conflict: false };
}

function sourceFactsHash(source: NormalizedSource): string {
  return hashBoundedReceiptFacts({
    sourceHash: source.sourceHash,
    savedAtHash: hashBoundedReceiptFacts(source.savedAt),
    nameHash: hashBoundedReceiptFacts(source.name),
    snapshotModIdHash: source.snapshotModIdHash,
    snapshotIdentityHash: source.snapshotIdentityHash,
  });
}

function legacyCasSemantic(value: string): Record<string, unknown> {
  return { supplied: true, kind: 'legacy-16', value: value.toLowerCase() };
}

function expectedVersionValue(value: unknown): { ok: true; value?: number } | { ok: false; code: string } {
  if (value === undefined) return { ok: true };
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    return { ok: false, code: 'WORKSPACE_SNAPSHOT_EXPECTED_VERSION_INVALID' };
  }
  return { ok: true, value };
}

function readFacts(
  dependencies: WorkspaceSnapshotRestoreReceiptAdapterDependencies,
  input: WorkspaceSnapshotRestoreReceiptAdapterInput,
): WorkspaceSnapshotRestoreReceiptFactsResult {
  if (typeof input.operationId !== 'string' || !OPERATION_ID_RE.test(input.operationId)) {
    return { ok: false, code: 'ACTION_RECEIPT_OPERATION_ID_INVALID' };
  }
  if (typeof input.workspaceId !== 'string' || !WORKSPACE_ID_RE.test(input.workspaceId)) {
    return { ok: false, code: 'WORKSPACE_ID_INVALID' };
  }
  if (typeof input.expectedHead !== 'string' || !LEGACY_HEAD_RE.test(input.expectedHead)) {
    return { ok: false, code: 'WORKSPACE_SNAPSHOT_EXPECTED_HEAD_INVALID' };
  }
  if (typeof input.expectedSnapshotHash !== 'string' || !LEGACY_SNAPSHOT_HASH_RE.test(input.expectedSnapshotHash)) {
    return { ok: false, code: 'WORKSPACE_SNAPSHOT_EXPECTED_SNAPSHOT_HASH_INVALID' };
  }
  const version = expectedVersionValue(input.expectedVersion);
  if (version.ok === false) return version;

  let mappedIdentity: unknown;
  try {
    mappedIdentity = mapRuntimeReceiptIdentity(input.identity);
  } catch (error) {
    return { ok: false, code: safeRuntimeFailureCode(error) };
  }
  if (mappedIdentity === undefined) return { ok: false, code: 'ACTION_RECEIPT_RUNTIME_IDENTITY_INVALID' };

  const found = dependencies.registry.lookup(input.workspaceId);
  if (found.ok === false) return { ok: false, code: found.code };
  const sourceResult = normalizedSource(dependencies, input);
  if (sourceResult.ok === false) return sourceResult;

  try {
    const beforeWorkspace = sanitizeWorkspace(found.record.workspace);
    if (!stableWorkspaceShape(beforeWorkspace)) {
      return { ok: false, code: 'WORKSPACE_SNAPSHOT_WORKSPACE_INVALID' };
    }
    const beforeResources = workspaceReceiptResources(input.workspaceId, beforeWorkspace);
    const targetWorkspace = sourceResult.source.workspace;
    const targetResources = workspaceReceiptResources(input.workspaceId, targetWorkspace);
    const targetContentHash = targetResources.find(resource => resource.role === 'workspace')?.beforeHash;
    const targetSnapshotHash = targetResources.find(resource => resource.role === 'snapshot')?.beforeHash;
    if (!safeHash(targetContentHash) || !safeHash(targetSnapshotHash)) {
      return { ok: false, code: 'WORKSPACE_SNAPSHOT_RECEIPT_FACTS_INVALID' };
    }

    const requestFacts: Record<string, unknown> = {
      routeKey: WORKSPACE_SNAPSHOT_RESTORE_ROUTE_KEY,
      mode: WORKSPACE_SNAPSHOT_RESTORE_MODE,
      expectedHead: input.expectedHead.toLowerCase(),
      proposedContentHash: targetContentHash,
      proposedSnapshotHash: targetSnapshotHash,
      sourceHash: sourceResult.source.sourceHash,
    };
    if (version.value !== undefined) requestFacts.expectedVersion = version.value;
    const boundedRequestFactsHash = hashWorkspaceActionRequestFacts(requestFacts);
    const requestHash = hashBoundedReceiptFacts({
      boundedRequestFactsHash,
      expectedSnapshotHash: legacyCasSemantic(input.expectedSnapshotHash),
      sourceFactsHash: sourceFactsHash(sourceResult.source),
      workspaceIdHash: hashBoundedReceiptFacts(input.workspaceId),
    });
    const beforeHash = combineReceiptResourceBeforeHashes(beforeResources);
    if (!safeHash(requestHash) || !safeHash(beforeHash)) {
      return { ok: false, code: 'WORKSPACE_SNAPSHOT_RECEIPT_FACTS_INVALID' };
    }
    return {
      ok: true,
      facts: {
        workspaceId: input.workspaceId,
        beforeRecord: found.record,
        beforeWorkspace,
        beforeResources,
        targetWorkspace,
        targetResources,
        source: sourceResult.source,
        expectedHead: input.expectedHead.toLowerCase(),
        expectedSnapshotHash: input.expectedSnapshotHash.toLowerCase(),
        ...(version.value === undefined ? {} : { expectedVersion: version.value }),
        requestHash,
        beforeHash,
        changed: !sameResources(beforeResources, targetResources, true),
      },
    };
  } catch {
    return { ok: false, code: 'WORKSPACE_SNAPSHOT_RECEIPT_FACTS_INVALID' };
  }
}

function currentAfter(
  facts: RestoreFacts,
  record: WorkspaceRecord,
  outcome: 'applied' | 'no_change' | 'partial',
  code: string,
): ActionReceiptAfter | undefined {
  try {
    return workspaceReceiptAfter(
      facts.beforeResources,
      sanitizeWorkspace(record.workspace),
      { outcome, code },
    );
  } catch {
    return undefined;
  }
}

function readCurrentWorkspace(
  dependencies: WorkspaceSnapshotRestoreReceiptAdapterDependencies,
  facts: RestoreFacts,
  input: WorkspaceSnapshotRestoreReceiptAdapterInput,
): { ok: true; record: WorkspaceRecord; source: NormalizedSource; resources: ActionReceiptResourceAuthority[] }
  | { ok: false; code: string } {
  const sourceResult = normalizedSource(dependencies, input);
  if (sourceResult.ok === false) return sourceResult;
  const found = dependencies.registry.lookup(facts.workspaceId);
  if (found.ok === false) return { ok: false, code: found.code };
  try {
    const currentWorkspace = sanitizeWorkspace(found.record.workspace);
    const resources = workspaceReceiptResources(facts.workspaceId, currentWorkspace);
    if (!sameResources(resources, facts.beforeResources, true)) {
      return { ok: false, code: 'WORKSPACE_SNAPSHOT_WORKSPACE_CHANGED' };
    }
    const targetResources = workspaceReceiptResources(facts.workspaceId, sourceResult.source.workspace);
    if (!sameResources(targetResources, facts.targetResources, true)
      || sourceResult.source.sourceHash !== facts.source.sourceHash
      || sourceResult.source.savedAt !== facts.source.savedAt
      || sourceResult.source.name !== facts.source.name
      || sourceResult.source.snapshotModIdHash !== facts.source.snapshotModIdHash
      || sourceResult.source.snapshotIdentityHash !== facts.source.snapshotIdentityHash) {
      return { ok: false, code: 'WORKSPACE_SNAPSHOT_SOURCE_CHANGED' };
    }
    const currentHead = found.record.head.toLowerCase();
    if (currentHead !== facts.expectedHead) {
      return { ok: false, code: 'WORKSPACE_SNAPSHOT_EXPECTED_HEAD_STALE' };
    }
    const currentSnapshotHash = workspaceSnapshotHash(currentWorkspace).toLowerCase();
    if (currentSnapshotHash !== facts.expectedSnapshotHash) {
      return { ok: false, code: 'WORKSPACE_SNAPSHOT_EXPECTED_SNAPSHOT_HASH_STALE' };
    }
    if (facts.expectedVersion !== undefined && found.record.version !== facts.expectedVersion) {
      return { ok: false, code: 'WORKSPACE_SNAPSHOT_EXPECTED_VERSION_STALE' };
    }
    return { ok: true, record: found.record, source: sourceResult.source, resources };
  } catch {
    return { ok: false, code: 'WORKSPACE_SNAPSHOT_WORKSPACE_INVALID' };
  }
}

function abandonRecovery(
  dependencies: WorkspaceSnapshotRestoreReceiptAdapterDependencies,
  receiptId: string,
): void {
  try { dependencies.recoveryStore.abandon(receiptId); } catch { /* failure truth remains in receipt */ }
}

export function prepareWorkspaceSnapshotRestoreReceiptFacts(
  dependencies: WorkspaceSnapshotRestoreReceiptAdapterDependencies,
  input: WorkspaceSnapshotRestoreReceiptAdapterInput,
): WorkspaceSnapshotRestoreReceiptFactsResult {
  return readFacts(dependencies, input);
}

export function buildWorkspaceSnapshotRestoreReceiptExecution(
  dependencies: WorkspaceSnapshotRestoreReceiptAdapterDependencies,
  input: WorkspaceSnapshotRestoreReceiptAdapterInput,
  facts: RestoreFacts,
): WorkspaceSnapshotRestoreReceiptExecution {
  const state: RestoreExecutionState = {};
  const receiptRecoveryRequired = facts.changed;
  const effectResource = facts.beforeResources.find(resource => resource.role === 'workspace');
  if (effectResource === undefined) {
    state.domainFailureCode = 'WORKSPACE_SNAPSHOT_RECEIPT_FACTS_INVALID';
  }

  const canProceed = async (): Promise<boolean> => {
    if (input.mayProceed === undefined) return true;
    try {
      return await input.mayProceed();
    } catch {
      return false;
    }
  };

  const description: WorkspaceReceiptTransactionDescription = {
    routeKey: WORKSPACE_SNAPSHOT_RESTORE_ROUTE_KEY,
    operationId: input.operationId,
    identity: input.identity,
    authority: {
      scope: 'workspace',
      workspaceId: facts.workspaceId,
      requestScope: `workspace-${facts.workspaceId}`,
      resources: facts.beforeResources,
    },
    declaredEffects: [{
      id: 'workspace-write',
      operation: WORKSPACE_SNAPSHOT_RESTORE_MODE,
      resource: effectResource!,
      reversible: receiptRecoveryRequired,
    }],
    requestHash: facts.requestHash,
    beforeHash: facts.beforeHash,
    validation: {
      validator: 'workspace-snapshot-restore',
      code: 'workspace-snapshot-restore',
      summary: 'Contained workspace snapshot restore',
    },
    rollback: receiptRecoveryRequired
      ? { required: true, mode: 'recovery', status: 'prepared' }
      : { required: false, mode: 'none', status: 'not_required' },
    metadata: {
      operation: WORKSPACE_SNAPSHOT_RESTORE_MODE,
      route: WORKSPACE_SNAPSHOT_RESTORE_ROUTE_KEY,
      mode: WORKSPACE_SNAPSHOT_RESTORE_MODE,
    },
    store: dependencies.store,
    serializationKey: `workspace:${facts.workspaceId}`,
    mayMutate: async ({ receipt }) => {
      if (!await canProceed()) {
        state.domainFailureCode = 'WORKSPACE_SNAPSHOT_RESTORE_RESPONSE_DEADLINE';
        if (receiptRecoveryRequired) abandonRecovery(dependencies, receipt.id);
        return false;
      }
      return true;
    },
    callbacks: {
      prepareRecovery: async ({ receipt }) => {
        if (!receiptRecoveryRequired) return true;
        try {
          dependencies.recoveryStore.createWorkspace({
            recoveryId: receipt.id,
            workspaceId: facts.workspaceId,
            beforeWorkspace: facts.beforeWorkspace,
            beforeHash: facts.beforeRecord.head,
            beforeSnapshotHash: workspaceSnapshotHash(facts.beforeWorkspace),
            expectedCurrentHash: facts.targetResources.find(resource => resource.role === 'workspace')!.beforeHash!,
            expectedCurrentSnapshotHash: facts.targetResources.find(resource => resource.role === 'snapshot')!.beforeHash!,
            summary: RESTORE_RECOVERY_SUMMARY,
          });
          state.recoveryPrepared = true;
          return true;
        } catch {
          state.domainFailureCode = 'WORKSPACE_SNAPSHOT_RESTORE_RECOVERY_FAILED';
          return false;
        }
      },
      mutate: async ({ receipt }) => {
        if (state.commitAttempted) {
          state.domainFailureCode = 'WORKSPACE_SNAPSHOT_RESTORE_DOMAIN_COMMIT_FAILED';
          return { ok: false, changed: true };
        }
        if (!await canProceed()) {
          state.domainFailureCode = 'WORKSPACE_SNAPSHOT_RESTORE_RESPONSE_DEADLINE';
          if (receiptRecoveryRequired) abandonRecovery(dependencies, receipt.id);
          return { ok: false, changed: false };
        }

        // This is the authoritative boundary read.  It intentionally repeats the contained
        // source read and both paired-CAS checks immediately before the one commit below.
        const boundary = readCurrentWorkspace(dependencies, facts, input);
        if (boundary.ok === false) {
          state.domainFailureCode = boundary.code;
          if (receiptRecoveryRequired) abandonRecovery(dependencies, receipt.id);
          return { ok: false, changed: false };
        }
        if (!facts.changed) {
          return { ok: true, changed: false };
        }
        if (!await canProceed()) {
          state.domainFailureCode = 'WORKSPACE_SNAPSHOT_RESTORE_RESPONSE_DEADLINE';
          abandonRecovery(dependencies, receipt.id);
          return { ok: false, changed: false };
        }

        state.commitAttempted = true;
        try {
          // No filesystem snapshot path or raw envelope enters this call; the contained reader's
          // sanitized target is the only domain value passed to the registry owner.
          state.committedRecord = dependencies.registry.commit(
            facts.workspaceId,
            facts.targetWorkspace,
            'restore-snapshot',
          );
          return { ok: true, changed: true };
        } catch {
          state.domainFailureCode = 'WORKSPACE_SNAPSHOT_RESTORE_DOMAIN_COMMIT_FAILED';
          return { ok: false, changed: true };
        }
      },
      postcondition: () => {
        const current = dependencies.registry.lookup(facts.workspaceId);
        if (current.ok === false) {
          state.domainFailureCode = 'WORKSPACE_SNAPSHOT_RESTORE_POSTCONDITION_FAILED';
          throw new Error('Workspace snapshot restore postcondition failed.');
        }
        try {
          const resources = workspaceReceiptResources(facts.workspaceId, sanitizeWorkspace(current.record.workspace));
          if (!sameResources(resources, facts.targetResources, true)) {
            state.domainFailureCode = 'WORKSPACE_SNAPSHOT_RESTORE_POSTCONDITION_FAILED';
            throw new Error('Workspace snapshot restore postcondition failed.');
          }
          const after = workspaceReceiptAfter(
            facts.beforeResources,
            sanitizeWorkspace(current.record.workspace),
            facts.changed
              ? { outcome: 'applied', code: RESTORE_AFTER_CODE }
              : { outcome: 'no_change', code: RESTORE_NO_CHANGE_CODE },
          );
          return after;
        } catch {
          state.domainFailureCode = 'WORKSPACE_SNAPSHOT_RESTORE_POSTCONDITION_FAILED';
          throw new Error('Workspace snapshot restore postcondition failed.');
        }
      },
      rollback: ({ receipt }) => {
        const observed = dependencies.registry.lookup(facts.workspaceId);
        if (observed.ok === false) {
          state.domainFailureCode = RESTORE_ROLLBACK_CODE;
          return { ok: false };
        }

        let observedResources: ActionReceiptResourceAuthority[];
        try {
          observedResources = workspaceReceiptResources(
            facts.workspaceId,
            sanitizeWorkspace(observed.record.workspace),
          );
        } catch {
          state.domainFailureCode = RESTORE_ROLLBACK_CODE;
          return { ok: false };
        }
        if (sameResources(observedResources, facts.beforeResources, true)) {
          if (receiptRecoveryRequired) abandonRecovery(dependencies, receipt.id);
          const after = currentAfter(facts, observed.record, 'no_change', RESTORE_NO_CHANGE_CODE);
          if (after === undefined) {
            state.domainFailureCode = RESTORE_ROLLBACK_CODE;
            return { ok: false };
          }
          return { ok: true, after };
        }
        if (!sameResources(observedResources, facts.targetResources, true)) {
          state.domainFailureCode = RESTORE_ROLLBACK_CODE;
          const partial = currentAfter(facts, observed.record, 'partial', RESTORE_ROLLBACK_CODE);
          return partial === undefined ? { ok: false } : { ok: false, partialAfter: partial };
        }

        const recovery = dependencies.recoveryStore.read(receipt.id);
        if (!recovery.ok || recovery.record.kind !== 'workspace' || recovery.record.status !== 'ready'
          || recovery.record.workspaceId !== facts.workspaceId
          || recovery.record.beforeHash !== facts.beforeRecord.head
          || recovery.record.beforeSnapshotHash !== workspaceSnapshotHash(facts.beforeWorkspace)
          || recovery.record.expectedCurrentHash !== facts.targetResources.find(resource => resource.role === 'workspace')?.beforeHash
          || recovery.record.expectedCurrentSnapshotHash !== facts.targetResources.find(resource => resource.role === 'snapshot')?.beforeHash) {
          state.domainFailureCode = RESTORE_ROLLBACK_CODE;
          const partial = currentAfter(facts, observed.record, 'partial', RESTORE_ROLLBACK_CODE);
          return partial === undefined ? { ok: false } : { ok: false, partialAfter: partial };
        }

        try {
          const recoveryWorkspace = sanitizeWorkspace(recovery.record.beforeWorkspace);
          const recoveryResources = workspaceReceiptResources(facts.workspaceId, recoveryWorkspace);
          if (!sameResources(recoveryResources, facts.beforeResources, true)) throw new Error('recovery state mismatch');

          // Re-open the authoritative target paired state immediately before compensation.
          const beforeCompensation = dependencies.registry.lookup(facts.workspaceId);
          if (beforeCompensation.ok === false) throw new Error('workspace unavailable');
          const beforeCompensationResources = workspaceReceiptResources(
            facts.workspaceId,
            sanitizeWorkspace(beforeCompensation.record.workspace),
          );
          if (!sameResources(beforeCompensationResources, facts.targetResources, true)) throw new Error('target state changed');

          dependencies.registry.commit(facts.workspaceId, recoveryWorkspace, 'restore-snapshot:rollback');
          const restored = dependencies.registry.lookup(facts.workspaceId);
          if (restored.ok === false) throw new Error('restored workspace unavailable');
          const restoredResources = workspaceReceiptResources(
            facts.workspaceId,
            sanitizeWorkspace(restored.record.workspace),
          );
          if (!sameResources(restoredResources, facts.beforeResources, true)) throw new Error('restored state mismatch');
          abandonRecovery(dependencies, receipt.id);
          const after = currentAfter(facts, restored.record, 'no_change', RESTORE_NO_CHANGE_CODE);
          if (after === undefined) throw new Error('restored after-state unavailable');
          return { ok: true, after };
        } catch {
          state.domainFailureCode = RESTORE_ROLLBACK_CODE;
          const current = dependencies.registry.lookup(facts.workspaceId);
          if (current.ok === false) return { ok: false };
          const partial = currentAfter(facts, current.record, 'partial', RESTORE_ROLLBACK_CODE);
          return partial === undefined ? { ok: false } : { ok: false, partialAfter: partial };
        }
      },
    },
  };

  return { description, state };
}

function receiptMatchesResult(
  receipt: ActionReceipt,
  result: ActionReceiptTransactionProjection,
  input: WorkspaceSnapshotRestoreReceiptAdapterInput,
  facts: RestoreFacts,
  replayed: boolean,
): boolean {
  try {
    const expectedIdentity = mapRuntimeReceiptIdentity(input.identity);
    const effectResource = facts.beforeResources.find(resource => resource.role === 'workspace');
    const expectedAfter = workspaceReceiptAfter(
      facts.beforeResources,
      facts.targetWorkspace,
      replayed
        ? receipt.after?.outcome === 'applied'
          ? { outcome: 'applied', code: RESTORE_AFTER_CODE }
          : { outcome: 'no_change', code: RESTORE_NO_CHANGE_CODE }
        : facts.changed
          ? { outcome: 'applied', code: RESTORE_AFTER_CODE }
          : { outcome: 'no_change', code: RESTORE_NO_CHANGE_CODE },
    );
    const capability = receipt.capability;
    const capabilityMatches = 'legacyRoute' in capability
      && capability.legacyRoute === '/api/fs/restore-snapshot'
      && capability.method === 'POST'
      && capability.reviewed === true
      && typeof capability.reviewRef === 'string';
    const effect = receipt.effects.declared[0];
    const stableMatches = receipt.schema === 'forge.action-receipt.v1'
      && receipt.status === 'committed'
      && receipt.id === result.id
      && receipt.hash === result.hash
      && receipt.actor.kind === expectedIdentity.actor.kind
      && receipt.actor.id === expectedIdentity.actor.id
      && receipt.client.channel === expectedIdentity.client.channel
      && receipt.client.id === expectedIdentity.client.id
      && receipt.client.version === expectedIdentity.client.version
      && capabilityMatches
      && receipt.authority.scope === 'workspace'
      && receipt.authority.operationId === input.operationId
      && receipt.authority.workspaceId === facts.workspaceId
      && receipt.authority.requestScope === `workspace-${facts.workspaceId}`
      && sameResources(receipt.authority.resources, facts.beforeResources, false)
      && receipt.input.beforeHash === combineReceiptResourceBeforeHashes(receipt.authority.resources)
      && receipt.input.requestHash === facts.requestHash
      && receipt.effects.declared.length === 1
      && effect !== undefined
      && effect.id === 'workspace-write'
      && effect.operation === WORKSPACE_SNAPSHOT_RESTORE_MODE
      && effectResource !== undefined
      && sameResourceIdentity(effect.resource, effectResource)
      && receipt.validation.validator === 'workspace-snapshot-restore'
      && receipt.validation.code === 'workspace-snapshot-restore'
      && receipt.validation.summary === 'Contained workspace snapshot restore'
      && receipt.metadata !== undefined
      && canonicalJson(receipt.metadata) === canonicalJson({
        operation: WORKSPACE_SNAPSHOT_RESTORE_MODE,
        route: WORKSPACE_SNAPSHOT_RESTORE_ROUTE_KEY,
        mode: WORKSPACE_SNAPSHOT_RESTORE_MODE,
      })
      && receipt.after !== undefined
      && sameAfter(receipt.after, expectedAfter);
    if (!stableMatches) return false;
    if (!replayed) {
      if (receipt.rollback.required !== facts.changed
        || receipt.rollback.mode !== (facts.changed ? 'recovery' : 'none')
        || receipt.effects.declared[0]?.reversible !== facts.changed
        || receipt.input.beforeHash !== facts.beforeHash) return false;
      if (facts.changed && receipt.rollback.reference !== receipt.id) return false;
      if (!facts.changed && receipt.rollback.reference !== undefined) return false;
    }
    return true;
  } catch {
    return false;
  }
}

export async function executeWorkspaceSnapshotRestoreReceipt(
  dependencies: WorkspaceSnapshotRestoreReceiptAdapterDependencies,
  input: WorkspaceSnapshotRestoreReceiptAdapterInput,
): Promise<WorkspaceSnapshotRestoreReceiptAdapterResult> {
  const factsResult = readFacts(dependencies, input);
  if (factsResult.ok === false) return restoreFailure(factsResult.code);
  const operationCollision = await hasConflictingOperationReceipt(
    dependencies.store,
    input,
    factsResult.facts,
  );
  if (operationCollision.ok === false) return restoreFailure(operationCollision.code);
  if (operationCollision.conflict) return restoreFailure('ACTION_RECEIPT_DUPLICATE_CONFLICT');
  const execution = buildWorkspaceSnapshotRestoreReceiptExecution(dependencies, input, factsResult.facts);

  let result: Awaited<ReturnType<WorkspaceReceiptService['execute']>>;
  try {
    result = await dependencies.receiptService.execute(execution.description);
  } catch {
    return restoreFailure('WORKSPACE_SNAPSHOT_RESTORE_RECEIPT_EXECUTION_FAILED');
  }

  if (dependencies.captureProjection !== undefined) {
    try { await dependencies.captureProjection(result.receipt); } catch { /* history is fail-soft */ }
  }

  if (result.ok === false) {
    return restoreFailure(
      execution.state.domainFailureCode ?? result.code,
      result.replayed,
      result.receipt,
    );
  }

  let receipt: ActionReceipt;
  try {
    receipt = assertValidActionReceipt(unwrapStoredReceipt(await dependencies.store.read(result.receipt.id)));
  } catch {
    return restoreFailure('WORKSPACE_SNAPSHOT_RESTORE_RECEIPT_REOPEN_FAILED', result.replayed, result.receipt);
  }
  if (!receiptMatchesResult(receipt, result.receipt, input, factsResult.facts, result.replayed)) {
    return restoreFailure('WORKSPACE_SNAPSHOT_RESTORE_RECEIPT_MISMATCH', result.replayed, result.receipt);
  }

  const current = dependencies.registry.lookup(factsResult.facts.workspaceId);
  if (current.ok === false) {
    return restoreFailure('WORKSPACE_SNAPSHOT_RESTORE_REPLAY_STATE_UNAVAILABLE', result.replayed, result.receipt);
  }
  return {
    ok: true,
    record: current.record,
    receipt: result.receipt,
    replayed: result.replayed,
    applied: !result.replayed && receipt.after?.outcome === 'applied',
  };
}
