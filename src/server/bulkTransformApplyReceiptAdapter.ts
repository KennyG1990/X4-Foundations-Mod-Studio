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
  mapRuntimeReceiptIdentity,
  type RuntimeReceiptIdentity,
  type RuntimeReceiptIdentityInput,
} from '../lib/actionReceiptRuntime';
import type { BulkTransformPlan } from '../lib/bulkCorpusTransform';
import type {
  ActionReceiptTransactionProjection,
  ActionReceiptTransactionStore,
} from '../lib/actionReceiptTransaction';
import {
  DestructiveRecoveryStore,
} from '../lib/destructiveRecovery';
import {
  workspaceReceiptAfter,
  workspaceReceiptResources,
} from '../lib/workspaceActionReceipt';
import {
  workspaceContentHash,
  workspaceSnapshotHash,
} from '../lib/workspaceIdentity';
import type {
  WorkspaceRecord,
  WorkspaceRegistry,
} from '../lib/workspaceRegistry';
import {
  prepareBulkTransformApplyReceiptFacts,
  type BulkTransformApplyPlanBuilder,
  type BulkTransformApplyReceiptFactsInput,
  type BulkTransformApplyReceiptFactsResult,
} from './bulkTransformApplyReceiptFacts';
import type {
  WorkspaceReceiptService,
  WorkspaceReceiptTransactionDescription,
} from './workspaceReceiptService';
import { sanitizeWorkspace, type ModWorkspace } from '../types';

export const BULK_TRANSFORM_APPLY_ROUTE_KEY = 'POST /api/agent/bulk-transform/apply';
export const BULK_TRANSFORM_APPLY_MODE = 'bulk-transform-apply';

const OPERATION_ID_RE = /^[a-zA-Z][a-zA-Z0-9._:-]{0,127}$/;
const WORKSPACE_ID_RE = /^ws_[a-f0-9]{24}$/i;
const LEGACY_HASH_RE = /^[a-f0-9]{16}$/;
const COMPLETE_HASH_RE = /^[a-f0-9]{64}$/;
const AFTER_APPLIED_CODE = 'bulk_transform_applied';
const AFTER_NO_CHANGE_CODE = 'bulk_transform_no_change';
const AFTER_ROLLBACK_CODE = 'bulk_transform_rollback_failed';
const RECOVERY_SUMMARY = 'Bulk transform apply recovery';
const RECEIPT_VALIDATOR = 'bulk-transform-apply';
const RECEIPT_SUMMARY = 'Deterministic bulk transform apply';

export type BulkTransformApplyReceiptAdapterStore = ActionReceiptTransactionStore
  & Required<Pick<ActionReceiptTransactionStore, 'read'>>;

export type BulkTransformApplyMayProceed = () => boolean | Promise<boolean>;

export type BulkTransformApplyProjectionCapture = (
  projection: ActionReceiptTransactionProjection | undefined,
) => void | Promise<void>;

export interface BulkTransformApplyReceiptAdapterDependencies {
  registry: WorkspaceRegistry;
  receiptService: WorkspaceReceiptService;
  recoveryStore: DestructiveRecoveryStore;
  store: BulkTransformApplyReceiptAdapterStore;
  captureProjection?: BulkTransformApplyProjectionCapture;
}

export interface BulkTransformApplyReceiptAdapterInput {
  operationId: unknown;
  workspaceId: unknown;
  identity: RuntimeReceiptIdentityInput;
  rule: unknown;
  expectedPlanHash: unknown;
  expectedHead: unknown;
  expectedSnapshotHash: unknown;
  buildPlan: BulkTransformApplyPlanBuilder;
  mayProceed?: BulkTransformApplyMayProceed;
}

export interface BulkTransformApplyReceiptAdapterSuccess {
  ok: true;
  record: WorkspaceRecord;
  plan: BulkTransformPlan;
  receipt: ActionReceiptTransactionProjection;
  replayed: boolean;
  applied: boolean;
}

export interface BulkTransformApplyReceiptAdapterFailure {
  ok: false;
  code: string;
  receipt?: ActionReceiptTransactionProjection;
  replayed: boolean;
}

export type BulkTransformApplyReceiptAdapterResult =
  | BulkTransformApplyReceiptAdapterSuccess
  | BulkTransformApplyReceiptAdapterFailure;

export interface BulkTransformApplyReceiptExecutionState {
  domainFailureCode?: string;
  committedRecord?: WorkspaceRecord;
  recoveryAttempted?: boolean;
  recoveryPrepared?: boolean;
  recoveryReceiptId?: string;
  forwardCommitAttempted?: boolean;
  rollbackCommitAttempted?: boolean;
  rollbackRestored?: boolean;
}

export interface BulkTransformApplyReceiptExecution {
  description: WorkspaceReceiptTransactionDescription;
  state: BulkTransformApplyReceiptExecutionState;
}

type WorkspaceReceiptResources = ReturnType<typeof workspaceReceiptResources>;
type PreparedFacts = Extract<BulkTransformApplyReceiptFactsResult, { ok: true }>;

interface CurrentWorkspaceState {
  record: WorkspaceRecord;
  workspace: ModWorkspace;
  snapshotHash: string;
  resources: WorkspaceReceiptResources;
}

type CurrentWorkspaceStateResult =
  | { ok: true; state: CurrentWorkspaceState }
  | { ok: false; code: string };

type ExistingReceiptLookup =
  | { ok: true; receipt?: ActionReceipt }
  | { ok: false; code: string };

interface ChangedReplayRecovery {
  record: {
    id: string;
    workspaceId?: string;
    beforeWorkspace: unknown;
    beforeHash: string;
    beforeSnapshotHash?: string;
    expectedCurrentHash: string;
    expectedCurrentSnapshotHash?: string;
    kind: 'workspace';
    status: 'ready' | 'used';
  };
  beforeWorkspace: ModWorkspace;
  beforeResources: WorkspaceReceiptResources;
  targetResources: WorkspaceReceiptResources;
}

interface ChangedReplayRecoveryResult {
  ok: true;
  recovery: ChangedReplayRecovery;
}

interface ChangedReplayRecoveryFailure {
  ok: false;
  code: string;
}

type ChangedReplayRecoveryReadResult = ChangedReplayRecoveryResult | ChangedReplayRecoveryFailure;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function safeRuntimeFailureCode(error: unknown): string {
  const code = isRecord(error) && typeof error.code === 'string' ? error.code : undefined;
  return code !== undefined && /^ACTION_RECEIPT_RUNTIME_[A-Z0-9_]+$/.test(code)
    ? code
    : 'ACTION_RECEIPT_RUNTIME_IDENTITY_INVALID';
}

function adapterFailure(
  code: string,
  replayed = false,
  receipt?: ActionReceiptTransactionProjection,
): BulkTransformApplyReceiptAdapterFailure {
  return receipt === undefined
    ? { ok: false, code, replayed }
    : { ok: false, code, receipt, replayed };
}

function unwrapStoredReceipt(value: unknown): unknown {
  return isRecord(value) && Object.prototype.hasOwnProperty.call(value, 'receipt')
    ? value.receipt
    : value;
}

function safeCompleteHash(value: unknown): value is string {
  return typeof value === 'string' && COMPLETE_HASH_RE.test(value);
}

function safeLegacyHash(value: unknown): value is string {
  return typeof value === 'string' && LEGACY_HASH_RE.test(value);
}

function sameResourceIdentity(
  left: ActionReceiptResourceAuthority,
  right: ActionReceiptResourceAuthority,
): boolean {
  return left.role === right.role
    && left.root === right.root
    && left.relativePath === right.relativePath;
}

function sameResources(
  left: unknown,
  right: unknown,
  includeHashes = true,
): boolean {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
  return left.every((entry, index) => {
    const other = right[index];
    if (!isPlainRecord(entry) || !isPlainRecord(other)) return false;
    if (!sameResourceIdentity(
      entry as unknown as ActionReceiptResourceAuthority,
      other as unknown as ActionReceiptResourceAuthority,
    )) return false;
    return !includeHashes || entry.beforeHash === other.beforeHash;
  });
}

function sameAfterResources(
  after: ActionReceiptAfter | undefined,
  resources: WorkspaceReceiptResources,
): boolean {
  if (after === undefined || !Array.isArray(after.resources) || after.resources.length !== resources.length) {
    return false;
  }
  return after.resources.every((entry, index) => {
    const resource = resources[index];
    return resource !== undefined
      && entry.role === resource.role
      && entry.root === resource.root
      && entry.relativePath === resource.relativePath
      && entry.hash === resource.beforeHash;
  });
}

function resourceForRole(
  resources: WorkspaceReceiptResources,
  role: 'workspace' | 'snapshot',
): ActionReceiptResourceAuthority | undefined {
  return resources.find(resource => resource.role === role);
}

function afterResources(
  after: ActionReceiptAfter | undefined,
): WorkspaceReceiptResources | undefined {
  if (after === undefined || !Array.isArray(after.resources)) return undefined;
  return after.resources.map(resource => ({
    role: resource.role,
    root: resource.root,
    relativePath: resource.relativePath,
    beforeHash: resource.hash,
  }));
}

function expectedMetadata(): Record<string, string> {
  return {
    operation: BULK_TRANSFORM_APPLY_MODE,
    route: BULK_TRANSFORM_APPLY_ROUTE_KEY,
    mode: BULK_TRANSFORM_APPLY_MODE,
  };
}

function receiptFactsMatch(
  receipt: ActionReceipt,
  facts: PreparedFacts,
  identity: RuntimeReceiptIdentity,
  operationId: string,
  workspaceId: string,
): boolean {
  const capability = receipt.capability;
  const effect = receipt.effects.declared[0];
  const workspaceResource = resourceForRole(facts.beforeResources, 'workspace');
  return receipt.schema === 'forge.action-receipt.v1'
    && receipt.actor.kind === identity.actor.kind
    && receipt.actor.id === identity.actor.id
    && receipt.client.channel === identity.client.channel
    && receipt.client.id === identity.client.id
    && receipt.client.version === identity.client.version
    && 'legacyRoute' in capability
    && capability.legacyRoute === '/api/agent/bulk-transform/apply'
    && capability.method === 'POST'
    && capability.reviewed === true
    && typeof capability.reviewRef === 'string'
    && receipt.authority.scope === 'workspace'
    && receipt.authority.operationId === operationId
    && receipt.authority.workspaceId === workspaceId
    && receipt.authority.requestScope === `workspace-${workspaceId}`
    && sameResources(receipt.authority.resources, facts.beforeResources, true)
    && receipt.input.beforeHash === facts.receiptFacts.beforeHash
    && receipt.input.beforeHash === combineReceiptResourceBeforeHashes(receipt.authority.resources)
    && receipt.input.requestHash === facts.receiptFacts.requestHash
    && receipt.effects.declared.length === 1
    && effect !== undefined
    && effect.id === 'workspace-write'
    && effect.operation === BULK_TRANSFORM_APPLY_MODE
    && workspaceResource !== undefined
    && sameResourceIdentity(effect.resource, workspaceResource)
    && effect.resource.beforeHash === workspaceResource.beforeHash
    && effect.reversible === facts.receiptFacts.changed
    && receipt.validation.validator === RECEIPT_VALIDATOR
    && receipt.validation.ruleHash === facts.receiptFacts.ruleId
    && receipt.validation.code === BULK_TRANSFORM_APPLY_MODE
    && receipt.validation.summary === RECEIPT_SUMMARY
    && receipt.metadata !== undefined
    && canonicalJson(receipt.metadata) === canonicalJson(expectedMetadata())
    && receipt.rollback.required === facts.receiptFacts.changed
    && receipt.rollback.mode === (facts.receiptFacts.changed ? 'recovery' : 'none')
    && (facts.receiptFacts.changed
      ? receipt.rollback.reference === receipt.id
      : receipt.rollback.reference === undefined);
}

function currentAfter(
  facts: PreparedFacts,
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

function readCurrentWorkspaceState(
  dependencies: BulkTransformApplyReceiptAdapterDependencies,
  workspaceId: string,
): CurrentWorkspaceStateResult {
  let found: ReturnType<WorkspaceRegistry['lookup']>;
  try {
    found = dependencies.registry.lookup(workspaceId);
  } catch {
    return { ok: false, code: 'BULK_APPLY_CURRENT_STATE_READ_FAILED' };
  }
  if (found.ok === false) return { ok: false, code: found.code };

  try {
    const workspace = sanitizeWorkspace(found.record.workspace);
    const snapshotHash = dependencies.registry.snapshotHash(found.record);
    if (!safeLegacyHash(found.record.head) || !safeLegacyHash(snapshotHash)) {
      return { ok: false, code: 'BULK_APPLY_CURRENT_STATE_READ_FAILED' };
    }
    if (workspaceContentHash(workspace) !== found.record.head
      || workspaceSnapshotHash(workspace) !== snapshotHash) {
      return { ok: false, code: 'BULK_APPLY_CURRENT_STATE_READ_FAILED' };
    }
    const resources = workspaceReceiptResources(workspaceId, workspace);
    return { ok: true, state: { record: found.record, workspace, snapshotHash, resources } };
  } catch {
    return { ok: false, code: 'BULK_APPLY_CURRENT_STATE_READ_FAILED' };
  }
}

function prepareFactsForRecord(
  input: BulkTransformApplyReceiptAdapterInput,
  record: WorkspaceRecord,
  currentSnapshotHash: string,
  expectedHead: unknown = input.expectedHead,
  expectedSnapshotHash: unknown = input.expectedSnapshotHash,
): BulkTransformApplyReceiptFactsResult {
  const factsInput: BulkTransformApplyReceiptFactsInput = {
    operationId: input.operationId,
    workspaceId: input.workspaceId,
    identity: input.identity,
    rule: input.rule,
    expectedPlanHash: input.expectedPlanHash,
    expectedHead,
    expectedSnapshotHash,
    currentRecord: record,
    currentSnapshotHash,
    buildPlan: input.buildPlan,
  };
  return prepareBulkTransformApplyReceiptFacts(factsInput);
}

async function findExistingOperationReceipt(
  store: BulkTransformApplyReceiptAdapterStore,
  operationId: string,
): Promise<ExistingReceiptLookup> {
  const root = (store as unknown as { root?: unknown }).root;
  if (typeof root !== 'string' || root.length === 0) return { ok: true };

  try {
    if (!fs.existsSync(root)) return { ok: true };
    const entries = fs.readdirSync(root, { withFileTypes: true });
    let found: ActionReceipt | undefined;
    for (const entry of entries) {
      if (!entry.isFile() || !/^ar_[a-f0-9]{64}\.json$/.test(entry.name)) continue;
      const id = entry.name.slice(0, -'.json'.length);
      const receipt = assertValidActionReceipt(unwrapStoredReceipt(await store.read(id)));
      const capability = receipt.capability;
      if (!('legacyRoute' in capability)
        || capability.legacyRoute !== '/api/agent/bulk-transform/apply'
        || capability.method !== 'POST'
        || receipt.authority.operationId !== operationId) continue;
      if (found !== undefined) return { ok: false, code: 'BULK_APPLY_RECEIPT_LOOKUP_FAILED' };
      found = receipt;
    }
    return { ok: true, ...(found === undefined ? {} : { receipt: found }) };
  } catch {
    return { ok: false, code: 'BULK_APPLY_RECEIPT_LOOKUP_FAILED' };
  }
}

function receiptIdentityMatches(
  receipt: ActionReceipt,
  identity: RuntimeReceiptIdentity,
  operationId: string,
  workspaceId: string,
): boolean {
  return receipt.authority.scope === 'workspace'
    && receipt.authority.operationId === operationId
    && receipt.authority.workspaceId === workspaceId
    && receipt.actor.kind === identity.actor.kind
    && receipt.actor.id === identity.actor.id
    && receipt.client.channel === identity.client.channel
    && receipt.client.id === identity.client.id
    && receipt.client.version === identity.client.version;
}

function validateReadyRecovery(
  dependencies: BulkTransformApplyReceiptAdapterDependencies,
  receipt: ActionReceipt,
  workspaceId: string,
  targetResources: WorkspaceReceiptResources,
): ChangedReplayRecoveryReadResult {
  let found: ReturnType<DestructiveRecoveryStore['read']>;
  try {
    found = dependencies.recoveryStore.read(receipt.id);
  } catch {
    return { ok: false, code: 'BULK_APPLY_REPLAY_RECOVERY_UNAVAILABLE' };
  }
  if (found.ok === false) return { ok: false, code: 'BULK_APPLY_REPLAY_RECOVERY_UNAVAILABLE' };
  const record = found.record;
  if (record.kind !== 'workspace'
    || record.status !== 'ready'
    || record.id !== receipt.id
    || record.workspaceId !== workspaceId
    || !safeLegacyHash(record.beforeHash)
    || !safeLegacyHash(record.beforeSnapshotHash)
    || !safeCompleteHash(record.expectedCurrentHash)
    || !safeCompleteHash(record.expectedCurrentSnapshotHash)
    || receipt.authority.scope !== 'workspace'
    || receipt.authority.workspaceId !== workspaceId
    || receipt.rollback.required !== true
    || receipt.rollback.mode !== 'recovery'
    || receipt.rollback.reference !== receipt.id) {
    return { ok: false, code: 'BULK_APPLY_REPLAY_RECOVERY_INVALID' };
  }

  try {
    const beforeWorkspace = sanitizeWorkspace(record.beforeWorkspace);
    const beforeResources = workspaceReceiptResources(workspaceId, beforeWorkspace);
    const beforeWorkspaceResource = resourceForRole(beforeResources, 'workspace');
    const beforeSnapshotResource = resourceForRole(beforeResources, 'snapshot');
    const targetWorkspaceResource = resourceForRole(targetResources, 'workspace');
    const targetSnapshotResource = resourceForRole(targetResources, 'snapshot');
    const receiptBeforeResources = receipt.authority.resources;
    if (beforeWorkspaceResource === undefined
      || beforeSnapshotResource === undefined
      || targetWorkspaceResource === undefined
      || targetSnapshotResource === undefined
      || !sameResources(beforeResources, receiptBeforeResources, true)
      || !sameResources(beforeResources, targetResources, false)
      || receipt.input.beforeHash !== combineReceiptResourceBeforeHashes(receiptBeforeResources)
      || workspaceContentHash(beforeWorkspace) !== record.beforeHash
      || workspaceSnapshotHash(beforeWorkspace) !== record.beforeSnapshotHash
      || beforeWorkspaceResource.beforeHash !== receiptBeforeResources.find(resource => resource.role === 'workspace')?.beforeHash
      || beforeSnapshotResource.beforeHash !== receiptBeforeResources.find(resource => resource.role === 'snapshot')?.beforeHash
      || targetWorkspaceResource.beforeHash !== record.expectedCurrentHash
      || targetSnapshotResource.beforeHash !== record.expectedCurrentSnapshotHash) {
      return { ok: false, code: 'BULK_APPLY_REPLAY_RECOVERY_INVALID' };
    }
    return {
      ok: true,
      recovery: {
        record,
        beforeWorkspace,
        beforeResources,
        targetResources,
      },
    };
  } catch {
    return { ok: false, code: 'BULK_APPLY_REPLAY_RECOVERY_INVALID' };
  }
}

function validateChangedReplayRecovery(
  dependencies: BulkTransformApplyReceiptAdapterDependencies,
  receipt: ActionReceipt,
  workspaceId: string,
): ChangedReplayRecoveryReadResult {
  if (receipt.status !== 'committed'
    || receipt.after?.outcome !== 'applied'
    || receipt.rollback.status !== 'available') {
    return { ok: false, code: 'BULK_APPLY_REPLAY_RECOVERY_INVALID' };
  }
  const targetResources = afterResources(receipt.after);
  if (targetResources === undefined) {
    return { ok: false, code: 'BULK_APPLY_REPLAY_RECOVERY_INVALID' };
  }
  const recovery = validateReadyRecovery(
    dependencies,
    receipt,
    workspaceId,
    targetResources,
  );
  if ('code' in recovery) return recovery;
  return sameAfterResources(receipt.after, recovery.recovery.targetResources)
    ? recovery
    : { ok: false, code: 'BULK_APPLY_REPLAY_RECOVERY_INVALID' };
}

function samePreparedFacts(left: PreparedFacts, right: PreparedFacts): boolean {
  return canonicalJson(left.receiptFacts) === canonicalJson(right.receiptFacts)
    && sameResources(left.beforeResources, right.beforeResources, true)
    && sameResources(left.targetResources, right.targetResources, true);
}

function classifyReplayPreparationFailure(code: string): string {
  return code === 'BULK_APPLY_HEAD_CONFLICT' || code === 'BULK_APPLY_SNAPSHOT_CONFLICT'
    ? 'BULK_APPLY_REPLAY_STATE_CONFLICT'
    : 'ACTION_RECEIPT_DUPLICATE_CONFLICT';
}

function recoveryExistsFailure(
  dependencies: BulkTransformApplyReceiptAdapterDependencies,
  receiptId: string,
): string | undefined {
  try {
    const found = dependencies.recoveryStore.read(receiptId);
    if (found.ok) return 'BULK_APPLY_RECEIPT_MISMATCH';
    if ('code' in found && found.code !== 'RECOVERY_NOT_FOUND') return 'BULK_APPLY_REPLAY_RECOVERY_UNAVAILABLE';
    return undefined;
  } catch {
    return 'BULK_APPLY_REPLAY_RECOVERY_UNAVAILABLE';
  }
}

function isCommittedChangedReceipt(receipt: ActionReceipt): boolean {
  return receipt.status === 'committed' && receipt.after?.outcome === 'applied';
}

function isCommittedNoChangeReceipt(receipt: ActionReceipt): boolean {
  return receipt.status === 'committed' && receipt.after?.outcome === 'no_change';
}

function validateCommittedReceipt(
  receipt: ActionReceipt,
  result: ActionReceiptTransactionProjection,
  facts: PreparedFacts,
  identity: RuntimeReceiptIdentity,
  operationId: string,
  workspaceId: string,
  current: CurrentWorkspaceState,
  replayed: boolean,
): boolean {
  if (receipt.status !== 'committed'
    || receipt.id !== result.id
    || receipt.hash !== result.hash
    || result.status !== 'committed'
    || !receiptIdentityMatches(receipt, identity, operationId, workspaceId)
    || !receiptFactsMatch(receipt, facts, identity, operationId, workspaceId)
    || !sameResources(current.resources, facts.targetResources, true)) return false;

  const expectedOutcome = facts.receiptFacts.changed ? 'applied' : 'no_change';
  const expectedCode = facts.receiptFacts.changed ? AFTER_APPLIED_CODE : AFTER_NO_CHANGE_CODE;
  const expectedAfter = currentAfter(facts, current.record, expectedOutcome, expectedCode);
  if (expectedAfter === undefined || !sameAfterResources(receipt.after, facts.targetResources)) return false;
  if (receipt.after?.outcome !== expectedAfter.outcome || receipt.after.code !== expectedAfter.code) return false;
  if (!sameAfterResources(receipt.after, afterResources(expectedAfter) ?? [])) return false;
  if (facts.receiptFacts.changed) {
    if (receipt.rollback.status !== 'available') return false;
  } else if (receipt.rollback.status !== 'not_required') {
    return false;
  }
  if (!replayed && receipt.input.beforeHash !== facts.receiptFacts.beforeHash) return false;
  return true;
}

function errorCode(error: unknown): string | undefined {
  return isRecord(error) && typeof error.code === 'string' ? error.code : undefined;
}

function matchesTerminalReceiptProjection(
  receipt: ActionReceipt,
  recoveryReceiptId: string,
  projection: ActionReceiptTransactionProjection | undefined,
): boolean {
  return receipt.id === recoveryReceiptId
    && receipt.status !== 'prepared'
    && receipt.status !== 'committed'
    && (projection === undefined
      || (receipt.id === projection.id
        && receipt.hash === projection.hash
        && receipt.status === projection.status));
}

async function reconcileRecoveryAfterExecution(
  dependencies: BulkTransformApplyReceiptAdapterDependencies,
  state: BulkTransformApplyReceiptExecutionState,
  terminalProjection?: ActionReceiptTransactionProjection,
): Promise<void> {
  if (state.recoveryAttempted !== true
    || state.recoveryReceiptId === undefined
    || (state.forwardCommitAttempted === true && state.rollbackRestored !== true)) return;

  const recoveryReceiptId = state.recoveryReceiptId;
  let cleanupEligible = false;
  try {
    const receipt = assertValidActionReceipt(
      unwrapStoredReceipt(await dependencies.store.read(recoveryReceiptId)),
    );
    if (matchesTerminalReceiptProjection(receipt, recoveryReceiptId, terminalProjection)) {
      cleanupEligible = true;
    } else {
      return;
    }
  } catch (error) {
    if (errorCode(error) !== 'RECEIPT_NOT_FOUND' || terminalProjection !== undefined) return;
    cleanupEligible = true;
  }

  if (!cleanupEligible) return;
  try {
    dependencies.recoveryStore.abandon(recoveryReceiptId);
  } catch {
    // Verify the authoritative recovery state even when the abandon call itself throws.
  }

  let recovery: ReturnType<DestructiveRecoveryStore['read']>;
  try {
    recovery = dependencies.recoveryStore.read(recoveryReceiptId);
  } catch {
    return;
  }
  if (recovery.ok === false && recovery.code === 'RECOVERY_NOT_FOUND') {
    state.recoveryPrepared = false;
    state.recoveryAttempted = false;
  }
}

export function buildBulkTransformApplyReceiptExecution(
  dependencies: BulkTransformApplyReceiptAdapterDependencies,
  input: BulkTransformApplyReceiptAdapterInput,
  facts: PreparedFacts,
): BulkTransformApplyReceiptExecution {
  const state: BulkTransformApplyReceiptExecutionState = {};
  const recoveryRequired = facts.receiptFacts.changed;
  const workspaceResource = resourceForRole(facts.beforeResources, 'workspace');
  if (workspaceResource === undefined) state.domainFailureCode = 'BULK_APPLY_RECEIPT_FACTS_INVALID';

  const canProceed = async (): Promise<boolean> => {
    if (input.mayProceed === undefined) return true;
    try {
      return await input.mayProceed();
    } catch {
      return false;
    }
  };

  const boundaryPreparation = (): CurrentWorkspaceStateResult | { ok: true; state: CurrentWorkspaceState; facts: PreparedFacts }
    | { ok: false; code: string } => {
    const current = readCurrentWorkspaceState(dependencies, facts.receiptFacts.workspaceId);
    if (!current.ok) return current;
    const boundaryFacts = prepareFactsForRecord(
      input,
      current.state.record,
      current.state.snapshotHash,
      current.state.record.head,
      current.state.snapshotHash,
    );
    if (boundaryFacts.ok === false) return { ok: false, code: boundaryFacts.code };
    return { ok: true, state: current.state, facts: boundaryFacts };
  };

  const description: WorkspaceReceiptTransactionDescription = {
    routeKey: BULK_TRANSFORM_APPLY_ROUTE_KEY,
    operationId: input.operationId,
    identity: input.identity,
    authority: {
      scope: 'workspace',
      workspaceId: facts.receiptFacts.workspaceId,
      requestScope: `workspace-${facts.receiptFacts.workspaceId}`,
      resources: facts.beforeResources,
    },
    declaredEffects: [{
      id: 'workspace-write',
      operation: BULK_TRANSFORM_APPLY_MODE,
      resource: workspaceResource!,
      reversible: recoveryRequired,
    }],
    requestHash: facts.receiptFacts.requestHash,
    beforeHash: facts.receiptFacts.beforeHash,
    validation: {
      validator: RECEIPT_VALIDATOR,
      ruleHash: facts.receiptFacts.ruleId,
      code: BULK_TRANSFORM_APPLY_MODE,
      summary: RECEIPT_SUMMARY,
    },
    rollback: recoveryRequired
      ? { required: true, mode: 'recovery', status: 'prepared' }
      : { required: false, mode: 'none', status: 'not_required' },
    metadata: expectedMetadata(),
    store: dependencies.store,
    serializationKey: `workspace:${facts.receiptFacts.workspaceId}`,
    mayMutate: async () => {
      if (!await canProceed()) {
        state.domainFailureCode = 'BULK_APPLY_RESPONSE_DEADLINE';
        return false;
      }
      const boundary = boundaryPreparation();
      if ('code' in boundary) {
        const boundaryCode = boundary.code;
        state.domainFailureCode = boundaryCode === 'BULK_APPLY_HEAD_CONFLICT'
          || boundaryCode === 'BULK_APPLY_SNAPSHOT_CONFLICT'
          ? 'BULK_APPLY_BOUNDARY_CAS_CONFLICT'
          : boundaryCode;
        return false;
      }
      if (!('facts' in boundary)) {
        state.domainFailureCode = 'BULK_APPLY_BOUNDARY_FACTS_CHANGED';
        return false;
      }
      if (!samePreparedFacts(facts, boundary.facts)) {
        state.domainFailureCode = 'BULK_APPLY_BOUNDARY_FACTS_CHANGED';
        return false;
      }
      return true;
    },
    callbacks: {
      prepareRecovery: async ({ receipt }) => {
        if (!recoveryRequired) return true;
        const targetWorkspace = resourceForRole(facts.targetResources, 'workspace');
        const targetSnapshot = resourceForRole(facts.targetResources, 'snapshot');
        if (targetWorkspace === undefined || targetSnapshot === undefined) {
          state.domainFailureCode = 'BULK_APPLY_RECEIPT_FACTS_INVALID';
          return false;
        }
        state.recoveryPrepared = false;
        state.recoveryAttempted = true;
        state.recoveryReceiptId = receipt.id;
        try {
          const recovery = dependencies.recoveryStore.createWorkspace({
            recoveryId: receipt.id,
            workspaceId: facts.receiptFacts.workspaceId,
            beforeWorkspace: facts.beforeWorkspace,
            beforeHash: workspaceContentHash(facts.beforeWorkspace),
            beforeSnapshotHash: workspaceSnapshotHash(facts.beforeWorkspace),
            expectedCurrentHash: targetWorkspace.beforeHash!,
            expectedCurrentSnapshotHash: targetSnapshot.beforeHash!,
            summary: RECOVERY_SUMMARY,
          });
          if (recovery.id !== receipt.id) {
            state.domainFailureCode = 'BULK_APPLY_RECOVERY_FAILED';
            return false;
          }
          state.recoveryReceiptId = receipt.id;
          state.recoveryPrepared = true;
          return true;
        } catch {
          state.domainFailureCode = 'BULK_APPLY_RECOVERY_FAILED';
          return false;
        }
      },
      mutate: async () => {
        if (state.forwardCommitAttempted) {
          state.domainFailureCode = 'BULK_APPLY_COMMIT_FAILED';
          return { ok: false, changed: true };
        }
        if (!await canProceed()) {
          state.domainFailureCode = 'BULK_APPLY_RESPONSE_DEADLINE';
          return { ok: false, changed: false };
        }

        const boundary = boundaryPreparation();
        if ('code' in boundary) {
          const boundaryCode = boundary.code;
          state.domainFailureCode = boundaryCode === 'BULK_APPLY_HEAD_CONFLICT'
            || boundaryCode === 'BULK_APPLY_SNAPSHOT_CONFLICT'
            ? 'BULK_APPLY_BOUNDARY_CAS_CONFLICT'
            : boundaryCode;
          return { ok: false, changed: false };
        }
        if (!('facts' in boundary)) {
          state.domainFailureCode = 'BULK_APPLY_BOUNDARY_FACTS_CHANGED';
          return { ok: false, changed: false };
        }
        if (!samePreparedFacts(facts, boundary.facts)) {
          state.domainFailureCode = 'BULK_APPLY_BOUNDARY_FACTS_CHANGED';
          return { ok: false, changed: false };
        }
        if (!await canProceed()) {
          state.domainFailureCode = 'BULK_APPLY_RESPONSE_DEADLINE';
          return { ok: false, changed: false };
        }
        if (!facts.receiptFacts.changed) return { ok: true, changed: false };

        state.forwardCommitAttempted = true;
        try {
          state.committedRecord = dependencies.registry.commit(
            facts.receiptFacts.workspaceId,
            facts.nextWorkspace,
            BULK_TRANSFORM_APPLY_MODE,
          );
          return { ok: true, changed: true };
        } catch {
          state.domainFailureCode = 'BULK_APPLY_COMMIT_FAILED';
          return { ok: false, changed: true };
        }
      },
      postcondition: () => {
        const current = readCurrentWorkspaceState(dependencies, facts.receiptFacts.workspaceId);
        if (!current.ok || !sameResources(current.state.resources, facts.targetResources, true)) {
          state.domainFailureCode = 'BULK_APPLY_POSTCONDITION_FAILED';
          throw new Error('Bulk transform apply postcondition failed.');
        }
        const after = currentAfter(
          facts,
          current.state.record,
          facts.receiptFacts.changed ? 'applied' : 'no_change',
          facts.receiptFacts.changed ? AFTER_APPLIED_CODE : AFTER_NO_CHANGE_CODE,
        );
        if (after === undefined) {
          state.domainFailureCode = 'BULK_APPLY_POSTCONDITION_FAILED';
          throw new Error('Bulk transform apply postcondition failed.');
        }
        return after;
      },
      rollback: ({ receipt }) => {
        if (!recoveryRequired || state.rollbackCommitAttempted) return { ok: false };

        const observed = readCurrentWorkspaceState(dependencies, facts.receiptFacts.workspaceId);
        if (!observed.ok) {
          state.domainFailureCode = 'BULK_APPLY_ROLLBACK_FAILED';
          return { ok: false };
        }
        if (sameResources(observed.state.resources, facts.beforeResources, true)) {
          const after = currentAfter(facts, observed.state.record, 'no_change', AFTER_NO_CHANGE_CODE);
          if (after === undefined) return { ok: false };
          state.rollbackRestored = true;
          return { ok: true, after };
        }
        if (!sameResources(observed.state.resources, facts.targetResources, true)) {
          state.domainFailureCode = 'BULK_APPLY_ROLLBACK_FAILED';
          const partial = currentAfter(facts, observed.state.record, 'partial', AFTER_ROLLBACK_CODE);
          return partial === undefined ? { ok: false } : { ok: false, partialAfter: partial };
        }

        if (receipt.status !== 'prepared' || receipt.rollback.status !== 'prepared') {
          state.domainFailureCode = 'BULK_APPLY_ROLLBACK_FAILED';
          const partial = currentAfter(facts, observed.state.record, 'partial', AFTER_ROLLBACK_CODE);
          return partial === undefined ? { ok: false } : { ok: false, partialAfter: partial };
        }

        const recovery = validateReadyRecovery(
          dependencies,
          receipt,
          facts.receiptFacts.workspaceId,
          facts.targetResources,
        );
        if ('code' in recovery) {
          state.domainFailureCode = 'BULK_APPLY_ROLLBACK_FAILED';
          const partial = currentAfter(facts, observed.state.record, 'partial', AFTER_ROLLBACK_CODE);
          return partial === undefined ? { ok: false } : { ok: false, partialAfter: partial };
        }
        if (!sameResources(recovery.recovery.beforeResources, facts.beforeResources, true)
          || !sameResources(recovery.recovery.targetResources, facts.targetResources, true)) {
          state.domainFailureCode = 'BULK_APPLY_ROLLBACK_FAILED';
          const partial = currentAfter(facts, observed.state.record, 'partial', AFTER_ROLLBACK_CODE);
          return partial === undefined ? { ok: false } : { ok: false, partialAfter: partial };
        }

        // Re-open the authoritative target immediately before the one compensating commit.
        const beforeCompensation = readCurrentWorkspaceState(dependencies, facts.receiptFacts.workspaceId);
        if (!beforeCompensation.ok
          || !sameResources(beforeCompensation.state.resources, facts.targetResources, true)) {
          state.domainFailureCode = 'BULK_APPLY_ROLLBACK_FAILED';
          const partial = beforeCompensation.ok
            ? currentAfter(facts, beforeCompensation.state.record, 'partial', AFTER_ROLLBACK_CODE)
            : undefined;
          return partial === undefined ? { ok: false } : { ok: false, partialAfter: partial };
        }

        state.rollbackCommitAttempted = true;
        try {
          dependencies.registry.commit(
            facts.receiptFacts.workspaceId,
            recovery.recovery.beforeWorkspace,
            `${BULK_TRANSFORM_APPLY_MODE}:rollback`,
          );
        } catch {
          // A write-then-throw is reconciled by the authoritative read below; no retry is allowed.
        }

        const restored = readCurrentWorkspaceState(dependencies, facts.receiptFacts.workspaceId);
        if (!restored.ok || !sameResources(restored.state.resources, facts.beforeResources, true)) {
          state.domainFailureCode = 'BULK_APPLY_ROLLBACK_FAILED';
          const partial = restored.ok
            ? currentAfter(facts, restored.state.record, 'partial', AFTER_ROLLBACK_CODE)
            : undefined;
          return partial === undefined ? { ok: false } : { ok: false, partialAfter: partial };
        }
        const after = currentAfter(facts, restored.state.record, 'no_change', AFTER_NO_CHANGE_CODE);
        if (after === undefined) {
          state.domainFailureCode = 'BULK_APPLY_ROLLBACK_FAILED';
          return { ok: false };
        }
        state.rollbackRestored = true;
        return { ok: true, after };
      },
    },
  };

  return { description, state };
}

export async function executeBulkTransformApplyReceipt(
  dependencies: BulkTransformApplyReceiptAdapterDependencies,
  input: BulkTransformApplyReceiptAdapterInput,
): Promise<BulkTransformApplyReceiptAdapterResult> {
  if (typeof input.operationId !== 'string' || !OPERATION_ID_RE.test(input.operationId)) {
    return adapterFailure('ACTION_RECEIPT_OPERATION_ID_INVALID');
  }
  if (typeof input.workspaceId !== 'string' || !WORKSPACE_ID_RE.test(input.workspaceId)) {
    return adapterFailure('WORKSPACE_ID_INVALID');
  }

  let identity: RuntimeReceiptIdentity;
  try {
    identity = mapRuntimeReceiptIdentity(input.identity);
  } catch (error) {
    return adapterFailure(safeRuntimeFailureCode(error));
  }

  const existingLookup = await findExistingOperationReceipt(dependencies.store, input.operationId);
  if (existingLookup.ok === false) return adapterFailure(existingLookup.code);
  const existing = existingLookup.receipt;
  if (existing !== undefined
    && !receiptIdentityMatches(existing, identity, input.operationId, input.workspaceId)) {
    return adapterFailure('ACTION_RECEIPT_DUPLICATE_CONFLICT');
  }

  let facts: PreparedFacts;
  if (existing !== undefined && isCommittedChangedReceipt(existing)) {
    const recovery = validateChangedReplayRecovery(dependencies, existing, input.workspaceId);
    if ('code' in recovery) return adapterFailure(recovery.code);
    if (input.expectedHead !== recovery.recovery.record.beforeHash
      || input.expectedSnapshotHash !== recovery.recovery.record.beforeSnapshotHash) {
      return adapterFailure('ACTION_RECEIPT_DUPLICATE_CONFLICT');
    }
    const current = readCurrentWorkspaceState(dependencies, input.workspaceId);
    if (!current.ok) return adapterFailure('BULK_APPLY_REPLAY_STATE_UNAVAILABLE');
    if (!sameResources(current.state.resources, recovery.recovery.targetResources, true)) {
      return adapterFailure('BULK_APPLY_REPLAY_STATE_CONFLICT');
    }
    const recoveredRecord: WorkspaceRecord = {
      ...current.state.record,
      workspace: recovery.recovery.beforeWorkspace,
      head: recovery.recovery.record.beforeHash,
    };
    const recoveredFacts = prepareFactsForRecord(
      input,
      recoveredRecord,
      recovery.recovery.record.beforeSnapshotHash!,
      recovery.recovery.record.beforeHash,
      recovery.recovery.record.beforeSnapshotHash,
    );
    if (recoveredFacts.ok === false) return adapterFailure('ACTION_RECEIPT_DUPLICATE_CONFLICT');
    if (!recoveredFacts.receiptFacts.changed
      || !samePreparedFacts(recoveredFacts, {
        ...recoveredFacts,
        beforeResources: recovery.recovery.beforeResources,
        targetResources: recovery.recovery.targetResources,
      })
      || !receiptFactsMatch(
        existing,
        recoveredFacts,
        identity,
        input.operationId,
        input.workspaceId,
      )) {
      return adapterFailure('ACTION_RECEIPT_DUPLICATE_CONFLICT');
    }
    facts = recoveredFacts;
  } else {
    const current = readCurrentWorkspaceState(dependencies, input.workspaceId);
    if ('code' in current) return adapterFailure(current.code);
    const prepared = prepareFactsForRecord(input, current.state.record, current.state.snapshotHash);
    if (prepared.ok === false) {
      if (existing !== undefined) {
        return adapterFailure(classifyReplayPreparationFailure(prepared.code));
      }
      return adapterFailure(prepared.code);
    }
    facts = prepared;

    if (existing !== undefined) {
      if (!receiptFactsMatch(existing, facts, identity, input.operationId, input.workspaceId)) {
        return adapterFailure('ACTION_RECEIPT_DUPLICATE_CONFLICT');
      }
      if (isCommittedNoChangeReceipt(existing)) {
        const existingAfter = afterResources(existing.after);
        if (facts.receiptFacts.changed
          || existingAfter === undefined
          || !sameResources(current.state.resources, existingAfter, true)) {
          return adapterFailure('BULK_APPLY_REPLAY_STATE_CONFLICT');
        }
        const recoveryFailure = recoveryExistsFailure(dependencies, existing.id);
        if (recoveryFailure !== undefined) return adapterFailure(recoveryFailure);
      }
    }
  }

  const execution = buildBulkTransformApplyReceiptExecution(dependencies, input, facts);
  let result: Awaited<ReturnType<WorkspaceReceiptService['execute']>>;
  try {
    result = await dependencies.receiptService.execute(execution.description);
  } catch {
    await reconcileRecoveryAfterExecution(dependencies, execution.state);
    return adapterFailure('BULK_APPLY_RECEIPT_EXECUTION_FAILED', false);
  }

  if (dependencies.captureProjection !== undefined) {
    try {
      await dependencies.captureProjection(result.receipt);
    } catch {
      // History/projection capture is deliberately fail-soft.
    }
  }

  if (result.ok === false) {
    await reconcileRecoveryAfterExecution(dependencies, execution.state, result.receipt);
    return adapterFailure(
      execution.state.domainFailureCode ?? result.code,
      result.replayed,
      result.receipt,
    );
  }

  let receipt: ActionReceipt;
  try {
    receipt = assertValidActionReceipt(unwrapStoredReceipt(await dependencies.store.read(result.receipt.id)));
  } catch {
    return adapterFailure('BULK_APPLY_RECEIPT_REOPEN_FAILED', result.replayed, result.receipt);
  }

  const current = readCurrentWorkspaceState(dependencies, input.workspaceId);
  if (!current.ok) return adapterFailure('BULK_APPLY_REPLAY_STATE_UNAVAILABLE', result.replayed, result.receipt);
  if (!validateCommittedReceipt(
    receipt,
    result.receipt,
    facts,
    identity,
    input.operationId,
    input.workspaceId,
    current.state,
    result.replayed,
  )) {
    return adapterFailure('BULK_APPLY_RECEIPT_MISMATCH', result.replayed, result.receipt);
  }

  if (facts.receiptFacts.changed) {
    const recovery = validateChangedReplayRecovery(dependencies, receipt, input.workspaceId);
    if (!recovery.ok
      || !sameResources(recovery.recovery.beforeResources, facts.beforeResources, true)
      || !sameResources(recovery.recovery.targetResources, facts.targetResources, true)
      || !sameResources(current.state.resources, recovery.recovery.targetResources, true)) {
      return adapterFailure('BULK_APPLY_RECEIPT_RECOVERY_REOPEN_FAILED', result.replayed, result.receipt);
    }
  } else {
    const recoveryFailure = recoveryExistsFailure(dependencies, receipt.id);
    if (recoveryFailure !== undefined) {
      return adapterFailure('BULK_APPLY_RECEIPT_RECOVERY_REOPEN_FAILED', result.replayed, result.receipt);
    }
  }

  return {
    ok: true,
    record: current.state.record,
    plan: facts.plan,
    receipt: result.receipt,
    replayed: result.replayed,
    applied: !result.replayed && receipt.after?.outcome === 'applied',
  };
}
