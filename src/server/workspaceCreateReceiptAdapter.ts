import type {
  WorkspaceReceiptService,
  WorkspaceReceiptTransactionDescription,
} from './workspaceReceiptService';
import {
  assertValidActionReceipt,
  type ActionReceipt,
  type ActionReceiptAfter,
  type ActionReceiptResourceAuthority,
} from '../lib/actionReceipt';
import {
  combineReceiptResourceBeforeHashes,
  hashBoundedReceiptFacts,
  mapRuntimeReceiptIdentity,
} from '../lib/actionReceiptRuntime';
import type { ActionReceiptTransactionProjection, ActionReceiptTransactionStore } from '../lib/actionReceiptTransaction';
import {
  hashWorkspaceActionRequestFacts,
  workspaceRegistryReceiptAfter,
  workspaceRegistryReceiptResource,
} from '../lib/workspaceActionReceipt';
import type {
  WorkspaceRecord,
  WorkspaceRegistry,
  WorkspaceSummary,
} from '../lib/workspaceRegistry';
import {
  workspaceContentReceiptHash,
  workspaceSnapshotReceiptHash,
} from '../lib/workspaceReceiptHash';
import type { RuntimeReceiptIdentityInput } from '../lib/actionReceiptRuntime';
import type { ModWorkspace } from '../types';

const WORKSPACE_ID_RE = /^ws_[a-f0-9]{24}$/i;
const WORKSPACE_HEAD_RE = /^[a-f0-9]{16}$/;
const WORKSPACE_SNAPSHOT_HASH_RE = /^[a-f0-9]{16}$/;
const RECEIPT_HASH_RE = /^[a-f0-9]{64}$/;
const WORKSPACE_CREATE_ROUTE_KEY = 'POST /api/agent/workspaces';
const WORKSPACE_CREATE_MODE = 'create';
const WORKSPACE_SUMMARY_KEYS = new Set([
  'workspaceId', 'name', 'version', 'workspaceHash', 'snapshotHash', 'createdAt', 'savedAt', 'origin', 'contentSummary',
]);

export type WorkspaceCreateRegistryReadErrorCode =
  | 'WORKSPACE_CREATE_REGISTRY_INVALID'
  | 'WORKSPACE_CREATE_REGISTRY_DUPLICATE'
  | 'WORKSPACE_CREATE_REGISTRY_DEFAULT_MISSING'
  | 'WORKSPACE_CREATE_REGISTRY_RECORD_MISSING'
  | 'WORKSPACE_CREATE_REGISTRY_RECORD_MISMATCH';

export type WorkspaceCreateReceiptDomainFailureCode =
  | 'WORKSPACE_CREATE_RESPONSE_DEADLINE'
  | 'WORKSPACE_CREATE_REGISTRY_CONFLICT'
  | 'WORKSPACE_CREATE_LIMIT'
  | 'WORKSPACE_CREATE_FAILED'
  | 'WORKSPACE_CREATE_POSTCONDITION_FAILED'
  | 'WORKSPACE_CREATE_COMPENSATION_FAILED';

export type WorkspaceCreateReceiptAdapterErrorCode =
  | WorkspaceCreateRegistryReadErrorCode
  | WorkspaceCreateReceiptDomainFailureCode
  | 'WORKSPACE_CREATE_RECEIPT_FACTS_INVALID'
  | 'WORKSPACE_CREATE_RECEIPT_EXECUTION_FAILED'
  | 'WORKSPACE_CREATE_RECEIPT_REOPEN_FAILED'
  | 'WORKSPACE_CREATE_RECEIPT_MISMATCH'
  | 'WORKSPACE_CREATE_RESULT_INVALID'
  | 'WORKSPACE_CREATE_REPLAY_STATE_UNAVAILABLE';

export type WorkspaceCreateReceiptAdapterStore = ActionReceiptTransactionStore
  & Required<Pick<ActionReceiptTransactionStore, 'read'>>;

export type WorkspaceCreateMayProceed = () => boolean | Promise<boolean>;
export type WorkspaceCreateProjectionCapture = (
  projection: ActionReceiptTransactionProjection | undefined,
) => void | Promise<void>;

export interface WorkspaceCreateReceiptAdapterDependencies {
  registry: WorkspaceRegistry;
  receiptService: WorkspaceReceiptService;
  store: WorkspaceCreateReceiptAdapterStore;
  captureProjection?: WorkspaceCreateProjectionCapture;
}

export interface WorkspaceCreateReceiptAdapterInput {
  requestedWorkspace: ModWorkspace;
  origin: string;
  operationId: string;
  identity: RuntimeReceiptIdentityInput;
  mayProceed?: WorkspaceCreateMayProceed;
}

export interface WorkspaceCreateReceiptAdapterSuccess {
  ok: true;
  record: WorkspaceRecord;
  receipt: ActionReceiptTransactionProjection;
  replayed: boolean;
}

export interface WorkspaceCreateReceiptAdapterFailure {
  ok: false;
  code: string;
  receipt?: ActionReceiptTransactionProjection;
  replayed: boolean;
}

export type WorkspaceCreateReceiptAdapterResult =
  | WorkspaceCreateReceiptAdapterSuccess
  | WorkspaceCreateReceiptAdapterFailure;

export interface WorkspaceCreateReceiptFactsSuccess {
  ok: true;
  defaultWorkspaceId: string;
  records: WorkspaceRecord[];
  resource: ActionReceiptResourceAuthority;
  requestHash: string;
  beforeHash: string;
  proposedContentHash: string;
  proposedSnapshotHash: string;
}

export interface WorkspaceCreateReceiptAdapterReadSuccess {
  ok: true;
  defaultWorkspaceId: string;
  records: WorkspaceRecord[];
}

export interface WorkspaceCreateReceiptAdapterReadFailure {
  ok: false;
  code: WorkspaceCreateRegistryReadErrorCode;
}

export type WorkspaceCreateReceiptAdapterReadResult =
  | WorkspaceCreateReceiptAdapterReadSuccess
  | WorkspaceCreateReceiptAdapterReadFailure;

export interface WorkspaceCreateReceiptFactsFailure {
  ok: false;
  code: WorkspaceCreateReceiptAdapterErrorCode;
}

export type WorkspaceCreateReceiptFactsResult =
  | WorkspaceCreateReceiptFactsSuccess
  | WorkspaceCreateReceiptFactsFailure;

export interface WorkspaceCreateReceiptExecutionState {
  domainFailureCode?: WorkspaceCreateReceiptAdapterErrorCode;
  createdRecord?: WorkspaceRecord;
}

export interface WorkspaceCreateReceiptExecution {
  description: WorkspaceReceiptTransactionDescription;
  state: WorkspaceCreateReceiptExecutionState;
}

export type WorkspaceCreateRegistryMatchResult =
  | {
      ok: true;
      matches: boolean;
      currentRead: WorkspaceCreateReceiptAdapterReadSuccess;
      resource: ActionReceiptResourceAuthority;
    }
  | {
      ok: false;
      code: WorkspaceCreateRegistryReadErrorCode;
    };

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

function isWorkspaceSummary(value: unknown): value is WorkspaceSummary {
  if (!isPlainRecord(value)) return false;
  const keys = Object.keys(value);
  if (keys.length !== WORKSPACE_SUMMARY_KEYS.size || keys.some(key => !WORKSPACE_SUMMARY_KEYS.has(key))) return false;
  return typeof value.workspaceId === 'string'
    && WORKSPACE_ID_RE.test(value.workspaceId)
    && typeof value.name === 'string'
    && typeof value.version === 'number'
    && Number.isFinite(value.version)
    && typeof value.workspaceHash === 'string'
    && WORKSPACE_HEAD_RE.test(value.workspaceHash)
    && typeof value.snapshotHash === 'string'
    && WORKSPACE_SNAPSHOT_HASH_RE.test(value.snapshotHash)
    && typeof value.createdAt === 'string'
    && typeof value.savedAt === 'string'
    && typeof value.origin === 'string'
    && typeof value.contentSummary === 'string';
}

function sameSummary(left: WorkspaceSummary, right: WorkspaceSummary): boolean {
  return left.workspaceId === right.workspaceId
    && left.name === right.name
    && left.version === right.version
    && left.workspaceHash === right.workspaceHash
    && left.snapshotHash === right.snapshotHash
    && left.createdAt === right.createdAt
    && left.savedAt === right.savedAt
    && left.origin === right.origin
    && left.contentSummary === right.contentSummary;
}

/**
 * Read the complete registry through its public index and record authorities.
 * Any disagreement is a bounded failure; callers never receive a partial snapshot.
 */
export function readAuthoritativeWorkspaceRecords(
  registry: WorkspaceRegistry,
): WorkspaceCreateReceiptAdapterReadResult {
  try {
    const listed = registry.list();
    if (!Array.isArray(listed) || listed.length === 0) {
      return { ok: false, code: 'WORKSPACE_CREATE_REGISTRY_INVALID' };
    }
    if (!listed.every(isWorkspaceSummary)) {
      return { ok: false, code: 'WORKSPACE_CREATE_REGISTRY_INVALID' };
    }

    const defaultWorkspaceId = registry.defaultWorkspaceId;
    const listedIds = listed.map(summary => summary?.workspaceId);
    if (typeof defaultWorkspaceId !== 'string' || !WORKSPACE_ID_RE.test(defaultWorkspaceId)) {
      return { ok: false, code: 'WORKSPACE_CREATE_REGISTRY_INVALID' };
    }
    const normalizedListedIds = listedIds.map(id => id.toLowerCase());
    if (new Set(normalizedListedIds).size !== normalizedListedIds.length) {
      return { ok: false, code: 'WORKSPACE_CREATE_REGISTRY_DUPLICATE' };
    }
    if (listedIds.filter(id => id.toLowerCase() === defaultWorkspaceId.toLowerCase()).length !== 1) {
      return { ok: false, code: 'WORKSPACE_CREATE_REGISTRY_DEFAULT_MISSING' };
    }

    const records: WorkspaceRecord[] = [];
    for (const summary of listed) {
      const found = registry.lookup(summary.workspaceId);
      if (!found.ok) return { ok: false, code: 'WORKSPACE_CREATE_REGISTRY_RECORD_MISSING' };
      if (found.record.workspaceId !== summary.workspaceId || !sameSummary(summary, registry.summary(found.record))) {
        return { ok: false, code: 'WORKSPACE_CREATE_REGISTRY_RECORD_MISMATCH' };
      }
      records.push(found.record);
    }

    records.sort((left, right) => left.workspaceId === right.workspaceId ? 0 : left.workspaceId < right.workspaceId ? -1 : 1);
    return { ok: true, defaultWorkspaceId, records };
  } catch {
    return { ok: false, code: 'WORKSPACE_CREATE_REGISTRY_INVALID' };
  }
}

/**
 * Prepare the bounded, hash-only facts needed before a workspace-create mutation.
 * The requested workspace itself is intentionally not returned or embedded in the request facts.
 */
export function prepareWorkspaceCreateReceiptFacts(
  registry: WorkspaceRegistry,
  requestedWorkspace: ModWorkspace,
): WorkspaceCreateReceiptFactsResult {
  const current = readAuthoritativeWorkspaceRecords(registry);
  if (current.ok === false) return current;

  try {
    const proposedContentHash = workspaceContentReceiptHash(requestedWorkspace);
    const proposedSnapshotHash = workspaceSnapshotReceiptHash(requestedWorkspace);
    if (!RECEIPT_HASH_RE.test(proposedContentHash) || !RECEIPT_HASH_RE.test(proposedSnapshotHash)) {
      return { ok: false, code: 'WORKSPACE_CREATE_RECEIPT_FACTS_INVALID' };
    }
    const boundedRequestFactsHash = hashWorkspaceActionRequestFacts({
      routeKey: WORKSPACE_CREATE_ROUTE_KEY,
      mode: WORKSPACE_CREATE_MODE,
      proposedContentHash,
      proposedSnapshotHash,
    });
    const requestHash = hashBoundedReceiptFacts({ boundedRequestFactsHash });
    const resource = workspaceRegistryReceiptResource(current.defaultWorkspaceId, current.records);
    const beforeHash = combineReceiptResourceBeforeHashes([resource]);
    if (!RECEIPT_HASH_RE.test(requestHash) || !RECEIPT_HASH_RE.test(beforeHash)) {
      return { ok: false, code: 'WORKSPACE_CREATE_RECEIPT_FACTS_INVALID' };
    }

    return {
      ok: true,
      defaultWorkspaceId: current.defaultWorkspaceId,
      records: current.records,
      resource,
      requestHash,
      beforeHash,
      proposedContentHash,
      proposedSnapshotHash,
    };
  } catch {
    return { ok: false, code: 'WORKSPACE_CREATE_RECEIPT_FACTS_INVALID' };
  }
}

/** Re-read and compare the complete aggregate registry authority without mutating it. */
export function readWorkspaceCreateRegistryMatch(
  registry: WorkspaceRegistry,
  facts: WorkspaceCreateReceiptFactsSuccess,
): WorkspaceCreateRegistryMatchResult {
  const currentRead = readAuthoritativeWorkspaceRecords(registry);
  if (currentRead.ok === false) return currentRead;

  try {
    const resource = workspaceRegistryReceiptResource(currentRead.defaultWorkspaceId, currentRead.records);
    return {
      ok: true,
      matches: currentRead.defaultWorkspaceId === facts.defaultWorkspaceId
        && resource.beforeHash === facts.resource.beforeHash,
      currentRead,
      resource,
    };
  } catch {
    return { ok: false, code: 'WORKSPACE_CREATE_REGISTRY_INVALID' };
  }
}

/** Prove that the current authoritative registry is exactly one successful create beyond `facts`. */
export function validateWorkspaceCreateDelta(
  facts: WorkspaceCreateReceiptFactsSuccess,
  createdRecord: WorkspaceRecord,
  currentRead: WorkspaceCreateReceiptAdapterReadSuccess,
  registry: WorkspaceRegistry,
): boolean {
  try {
    if (currentRead.defaultWorkspaceId !== facts.defaultWorkspaceId) return false;
    if (currentRead.records.length !== facts.records.length + 1) return false;
    if (!WORKSPACE_ID_RE.test(createdRecord.workspaceId)) return false;

    const preparedIds = new Set(facts.records.map(record => record.workspaceId.toLowerCase()));
    const createdId = createdRecord.workspaceId.toLowerCase();
    if (preparedIds.has(createdId)) return false;
    const currentCreated = currentRead.records.filter(record => record.workspaceId.toLowerCase() === createdId);
    if (currentCreated.length !== 1) return false;
    const currentIds = new Set(currentRead.records.map(record => record.workspaceId.toLowerCase()));
    if ([...preparedIds].some(id => !currentIds.has(id))) return false;

    const lookup = registry.lookup(createdRecord.workspaceId);
    if (lookup.ok === false) return false;
    const currentRecord = currentCreated[0];
    const fieldsMatch = lookup.record.workspaceId === createdRecord.workspaceId
      && currentRecord.workspaceId === createdRecord.workspaceId
      && lookup.record.head === createdRecord.head
      && currentRecord.head === createdRecord.head
      && lookup.record.version === createdRecord.version
      && currentRecord.version === createdRecord.version
      && lookup.record.createdAt === createdRecord.createdAt
      && currentRecord.createdAt === createdRecord.createdAt
      && lookup.record.savedAt === createdRecord.savedAt
      && currentRecord.savedAt === createdRecord.savedAt
      && lookup.record.origin === createdRecord.origin
      && currentRecord.origin === createdRecord.origin;
    if (!fieldsMatch) return false;

    const createdSnapshotHash = registry.snapshotHash(createdRecord);
    return WORKSPACE_SNAPSHOT_HASH_RE.test(createdSnapshotHash)
      && registry.snapshotHash(lookup.record) === createdSnapshotHash
      && registry.snapshotHash(currentRecord) === createdSnapshotHash;
  } catch {
    return false;
  }
}

/** Build the receipt description and request-local callbacks without executing the service. */
export function buildWorkspaceCreateReceiptExecution(
  dependencies: WorkspaceCreateReceiptAdapterDependencies,
  input: WorkspaceCreateReceiptAdapterInput,
  facts: WorkspaceCreateReceiptFactsSuccess,
): WorkspaceCreateReceiptExecution {
  const { registry } = dependencies;
  const state: WorkspaceCreateReceiptExecutionState = {};
  let createAttempted = false;
  let createdHead: string | undefined;
  let createdSnapshotHash: string | undefined;

  const partialAfter = (): ActionReceiptAfter | undefined => {
    const currentRead = readAuthoritativeWorkspaceRecords(registry);
    if (currentRead.ok === false) return undefined;
    try {
      return workspaceRegistryReceiptAfter(
        facts.resource,
        currentRead.defaultWorkspaceId,
        currentRead.records,
        { outcome: 'partial', code: 'workspace_create_compensation_failed' },
      );
    } catch {
      return undefined;
    }
  };

  const description: WorkspaceReceiptTransactionDescription = {
    routeKey: WORKSPACE_CREATE_ROUTE_KEY,
    operationId: input.operationId,
    identity: input.identity,
    authority: {
      scope: 'global',
      requestScope: 'workspace-registry',
      resources: [facts.resource],
    },
    declaredEffects: [{
      id: 'workspace-write',
      operation: WORKSPACE_CREATE_MODE,
      resource: facts.resource,
      reversible: true,
    }],
    requestHash: facts.requestHash,
    beforeHash: facts.beforeHash,
    validation: {
      validator: 'workspace-registry-create',
      code: 'workspace-create',
      summary: 'Workspace registry create',
    },
    rollback: {
      required: true,
      mode: 'recovery',
      status: 'prepared',
    },
    metadata: {
      operation: WORKSPACE_CREATE_MODE,
      route: WORKSPACE_CREATE_ROUTE_KEY,
      mode: WORKSPACE_CREATE_MODE,
    },
    store: dependencies.store,
    serializationKey: 'workspace-registry',
    mayMutate: async () => {
      if (input.mayProceed !== undefined) {
        try {
          if (!await input.mayProceed()) {
            state.domainFailureCode = 'WORKSPACE_CREATE_RESPONSE_DEADLINE';
            return false;
          }
        } catch {
          state.domainFailureCode = 'WORKSPACE_CREATE_RESPONSE_DEADLINE';
          return false;
        }
      }

      const match = readWorkspaceCreateRegistryMatch(registry, facts);
      if (match.ok === false) {
        state.domainFailureCode = match.code;
        return false;
      }
      if (!match.matches) {
        state.domainFailureCode = 'WORKSPACE_CREATE_REGISTRY_CONFLICT';
        return false;
      }
      return true;
    },
    callbacks: {
      mutate: () => {
        if (createAttempted) {
          state.domainFailureCode = 'WORKSPACE_CREATE_FAILED';
          return { ok: false, changed: state.createdRecord !== undefined };
        }
        createAttempted = true;

        try {
          state.createdRecord = registry.create(input.requestedWorkspace, input.origin);
        } catch (error) {
          const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
          state.domainFailureCode = /full|limit|exceeds/i.test(message)
            ? 'WORKSPACE_CREATE_LIMIT'
            : 'WORKSPACE_CREATE_FAILED';
          return { ok: false, changed: false };
        }

        try {
          createdHead = state.createdRecord.head;
          createdSnapshotHash = registry.snapshotHash(state.createdRecord);
          if (!WORKSPACE_HEAD_RE.test(createdHead) || !WORKSPACE_SNAPSHOT_HASH_RE.test(createdSnapshotHash)) {
            state.domainFailureCode = 'WORKSPACE_CREATE_FAILED';
            return { ok: false, changed: true };
          }
          return { ok: true, changed: true };
        } catch {
          state.domainFailureCode = 'WORKSPACE_CREATE_FAILED';
          return { ok: false, changed: true };
        }
      },
      postcondition: () => {
        try {
          if (state.createdRecord === undefined) throw new Error('workspace create state unavailable');
          const currentRead = readAuthoritativeWorkspaceRecords(registry);
          if (currentRead.ok === false
            || !validateWorkspaceCreateDelta(facts, state.createdRecord, currentRead, registry)) {
            throw new Error('workspace create delta invalid');
          }
          return workspaceRegistryReceiptAfter(
            facts.resource,
            currentRead.defaultWorkspaceId,
            currentRead.records,
            {
              outcome: 'applied',
              code: `workspace_created_${state.createdRecord.workspaceId}`,
            },
          );
        } catch {
          state.domainFailureCode = 'WORKSPACE_CREATE_POSTCONDITION_FAILED';
          throw new Error('Workspace create postcondition failed.');
        }
      },
      rollback: () => {
        if (state.createdRecord === undefined || createdHead === undefined || createdSnapshotHash === undefined) {
          return false;
        }

        let compensated: ReturnType<WorkspaceRegistry['compensateCreate']>;
        try {
          compensated = registry.compensateCreate(
            state.createdRecord.workspaceId,
            createdHead,
            createdSnapshotHash,
          );
        } catch {
          state.domainFailureCode = 'WORKSPACE_CREATE_COMPENSATION_FAILED';
          const observed = partialAfter();
          return observed === undefined ? { ok: false } : { ok: false, partialAfter: observed };
        }

        if (compensated.ok === false) {
          state.domainFailureCode = 'WORKSPACE_CREATE_COMPENSATION_FAILED';
          const observed = partialAfter();
          return observed === undefined ? { ok: false } : { ok: false, partialAfter: observed };
        }

        const currentRead = readAuthoritativeWorkspaceRecords(registry);
        if (currentRead.ok === false) {
          state.domainFailureCode = 'WORKSPACE_CREATE_COMPENSATION_FAILED';
          return { ok: false };
        }
        try {
          const after = workspaceRegistryReceiptAfter(
            facts.resource,
            currentRead.defaultWorkspaceId,
            currentRead.records,
            'no_change',
          );
          return { ok: true, after };
        } catch {
          state.domainFailureCode = 'WORKSPACE_CREATE_COMPENSATION_FAILED';
          const observed = partialAfter();
          return observed === undefined ? { ok: false } : { ok: false, partialAfter: observed };
        }
      },
    },
  };

  return { description, state };
}

function sameWorkspaceCreateReceiptResource(
  left: ActionReceiptResourceAuthority,
  right: ActionReceiptResourceAuthority,
): boolean {
  return sameWorkspaceCreateReceiptResourceIdentity(left, right)
    && left.beforeHash === right.beforeHash;
}

function sameWorkspaceCreateReceiptResourceIdentity(
  left: ActionReceiptResourceAuthority,
  right: ActionReceiptResourceAuthority,
): boolean {
  return left.role === right.role
    && left.root === right.root
    && left.relativePath === right.relativePath;
}

function unwrapWorkspaceCreateStoredReceipt(value: unknown): unknown {
  if (isPlainRecord(value) && Object.prototype.hasOwnProperty.call(value, 'receipt')) {
    return value.receipt;
  }
  return value;
}

function workspaceCreateFailure(
  code: string,
  replayed: boolean,
  receipt?: ActionReceiptTransactionProjection,
): WorkspaceCreateReceiptAdapterFailure {
  return receipt === undefined
    ? { ok: false, code, replayed }
    : { ok: false, code, receipt, replayed };
}

/** Execute one create transaction, then reopen the authoritative committed receipt. */
export async function executeWorkspaceCreateReceipt(
  dependencies: WorkspaceCreateReceiptAdapterDependencies,
  input: WorkspaceCreateReceiptAdapterInput,
): Promise<WorkspaceCreateReceiptAdapterResult> {
  const facts = prepareWorkspaceCreateReceiptFacts(dependencies.registry, input.requestedWorkspace);
  if (facts.ok === false) return workspaceCreateFailure(facts.code, false);

  const execution = buildWorkspaceCreateReceiptExecution(dependencies, input, facts);
  let result: Awaited<ReturnType<WorkspaceReceiptService['execute']>>;
  try {
    result = await dependencies.receiptService.execute(execution.description);
  } catch {
    return workspaceCreateFailure('WORKSPACE_CREATE_RECEIPT_EXECUTION_FAILED', false);
  }

  if (dependencies.captureProjection !== undefined) {
    try {
      await dependencies.captureProjection(result.receipt);
    } catch {
      // Projection capture is deliberately fail-soft and cannot change receipt truth.
    }
  }

  if (result.ok === false) {
    const code = result.code === 'ACTION_RECEIPT_MUTATION_FAILED'
      && execution.state.domainFailureCode !== undefined
      ? execution.state.domainFailureCode
      : result.code;
    return workspaceCreateFailure(code, result.replayed, result.receipt);
  }

  let receipt: ActionReceipt;
  try {
    const stored = await dependencies.store.read(result.receipt.id);
    receipt = assertValidActionReceipt(unwrapWorkspaceCreateStoredReceipt(stored));
  } catch {
    return workspaceCreateFailure(
      'WORKSPACE_CREATE_RECEIPT_REOPEN_FAILED',
      result.replayed,
      result.receipt,
    );
  }

  if (receipt.status !== 'committed'
    || receipt.id !== result.receipt.id
    || receipt.hash !== result.receipt.hash
    || receipt.status !== result.receipt.status) {
    return workspaceCreateFailure(
      'WORKSPACE_CREATE_RECEIPT_MISMATCH',
      result.replayed,
      result.receipt,
    );
  }

  let expectedIdentity: ReturnType<typeof mapRuntimeReceiptIdentity>;
  let storedBeforeHashMatches = false;
  try {
    expectedIdentity = mapRuntimeReceiptIdentity(input.identity);
    storedBeforeHashMatches = receipt.input.beforeHash
      === combineReceiptResourceBeforeHashes(receipt.authority.resources);
  } catch {
    return workspaceCreateFailure(
      'WORKSPACE_CREATE_RECEIPT_MISMATCH',
      result.replayed,
      result.receipt,
    );
  }

  const receiptResource = receipt.authority.resources[0];
  const stableAuthorityMatches = receipt.authority.scope === 'global'
    && receipt.authority.operationId === input.operationId
    && receipt.authority.requestScope === 'workspace-registry'
    && receipt.authority.resources.length === 1
    && receiptResource !== undefined
    && sameWorkspaceCreateReceiptResourceIdentity(receiptResource, facts.resource)
    && receipt.input.requestHash === facts.requestHash
    && storedBeforeHashMatches
    && receipt.actor.kind === expectedIdentity.actor.kind
    && receipt.actor.id === expectedIdentity.actor.id
    && receipt.client.channel === expectedIdentity.client.channel
    && receipt.client.id === expectedIdentity.client.id
    && receipt.client.version === expectedIdentity.client.version;
  const lifecycleBeforeMatches = result.replayed
    ? true
    : receiptResource !== undefined
      && sameWorkspaceCreateReceiptResource(receiptResource, facts.resource)
      && receipt.input.beforeHash === facts.beforeHash;
  const authorityMatches = stableAuthorityMatches && lifecycleBeforeMatches;
  if (!authorityMatches) {
    return workspaceCreateFailure(
      'WORKSPACE_CREATE_RECEIPT_MISMATCH',
      result.replayed,
      result.receipt,
    );
  }

  const afterCode = receipt.after?.code;
  const createdMatch = typeof afterCode === 'string'
    ? /^workspace_created_(ws_[a-f0-9]{24})$/i.exec(afterCode)
    : null;
  if (receipt.after === undefined
    || receipt.after.outcome !== 'applied'
    || createdMatch === null) {
    return workspaceCreateFailure(
      'WORKSPACE_CREATE_RESULT_INVALID',
      result.replayed,
      result.receipt,
    );
  }

  const createdWorkspaceId = createdMatch[1];
  if (execution.state.createdRecord !== undefined
    && execution.state.createdRecord.workspaceId !== createdWorkspaceId) {
    return workspaceCreateFailure(
      'WORKSPACE_CREATE_RESULT_INVALID',
      result.replayed,
      result.receipt,
    );
  }

  const current = dependencies.registry.lookup(createdWorkspaceId);
  if (current.ok === false) {
    return workspaceCreateFailure(
      'WORKSPACE_CREATE_REPLAY_STATE_UNAVAILABLE',
      result.replayed,
      result.receipt,
    );
  }

  return {
    ok: true,
    record: current.record,
    receipt: result.receipt,
    replayed: result.replayed,
  };
}
