/**
 * W3B1a — route-agnostic receipt transaction adapter for the installed sidecar.
 *
 * This module composes the bundled coverage policy, pure runtime identity seams, and the W3B1
 * transaction kernel.  It deliberately does not own a route, a workspace writer, a registry,
 * recovery storage, or any other domain side effect.
 */

import {
  assertValidActionReceipt,
  canonicalJson,
  createPreparedActionReceipt,
  type ActionReceipt,
  type ActionReceiptDeclaredEffect,
  type ActionReceiptPrepareInput,
  type ActionReceiptResourceAuthority,
  type ActionReceiptRollback,
  type ActionReceiptValidation,
} from '../lib/actionReceipt';
import {
  ACTION_RECEIPT_POLICY_BUNDLE_SCHEMA,
  loadActionReceiptPolicyBundle,
  type ActionReceiptPolicyBundle,
  type ActionReceiptPolicyBundleErrorCode,
} from '../lib/actionReceiptPolicyBundle';
import {
  resolveActionReceiptPolicy,
  type DiscoveredActionReceiptCoverageInventory,
  type ActionReceiptCoverageResolverResult,
} from '../lib/actionReceiptCoverage';
import {
  bindDeterministicRecoveryReference,
  hashBoundedReceiptFacts,
  mapRuntimeReceiptIdentity,
  type ActionReceiptRuntimeErrorCode,
} from '../lib/actionReceiptRuntime';
import {
  runActionReceiptTransaction,
  type ActionReceiptMutation,
  type ActionReceiptPostcondition,
  type ActionReceiptRecoveryPreparation,
  type ActionReceiptRollbackCallback,
  type ActionReceiptTransactionCode,
  type ActionReceiptTransactionContext,
  type ActionReceiptTransactionProjection,
  type ActionReceiptTransactionResult,
  type ActionReceiptTransactionStore,
} from '../lib/actionReceiptTransaction';

const OPERATION_ID_RE = /^[a-zA-Z][a-zA-Z0-9._:-]{0,127}$/;
const SERIALIZATION_KEY_RE = /^[a-zA-Z][a-zA-Z0-9._:-]{0,127}$/;
const REVIEW_REF_RE = /^[a-zA-Z][a-zA-Z0-9._:-]{0,127}$/;
const SAFE_STORE_CODE_RE = /^(?:ACTION_RECEIPT|RECEIPT)_[A-Z0-9_]+$/;
const SAFE_POLICY_BUNDLE_CODE_RE = /^ACTION_RECEIPT_POLICY_BUNDLE_[A-Z0-9_]+$/;
const SAFE_RUNTIME_CODE_RE = /^ACTION_RECEIPT_RUNTIME_[A-Z0-9_]+$/;
const NOT_FOUND_CODES = new Set(['RECEIPT_NOT_FOUND', 'ENOENT', 'ENOTDIR']);

export type WorkspaceReceiptServiceCode =
  | ActionReceiptTransactionCode
  | ActionReceiptRuntimeErrorCode
  | ActionReceiptPolicyBundleErrorCode
  | 'ACTION_RECEIPT_COMMITTED'
  | 'ACTION_RECEIPT_POLICY_BUNDLE_UNAVAILABLE'
  | 'ACTION_RECEIPT_POLICY_BUNDLE_INVALID'
  | 'ACTION_RECEIPT_SERIALIZATION_KEY_INVALID'
  | (string & {});

export type WorkspaceReceiptAuthorityInput =
  | {
      scope: 'global';
      requestScope: string;
      resources: readonly ActionReceiptResourceAuthority[];
    }
  | {
      scope: 'profile';
      profileId: string;
      requestScope: string;
      resources: readonly ActionReceiptResourceAuthority[];
    }
  | {
      scope: 'workspace';
      workspaceId: string;
      requestScope: string;
      resources: readonly ActionReceiptResourceAuthority[];
    };

export interface WorkspaceReceiptTransactionCallbacks {
  mutate: ActionReceiptMutation;
  postcondition: ActionReceiptPostcondition;
  rollback?: ActionReceiptRollbackCallback;
  prepareRecovery?: ActionReceiptRecoveryPreparation;
}

export type WorkspaceReceiptMayMutate = (
  context: ActionReceiptTransactionContext,
) => boolean | { ok?: boolean } | Promise<boolean | { ok?: boolean }>;

/**
 * Logical, hash-only transaction description supplied by a later route/domain adapter.
 * `operationId` remains caller-owned and is intentionally not inferred by this service.
 */
export interface WorkspaceReceiptTransactionDescription {
  routeKey: string;
  operationId: unknown;
  identity: unknown;
  authority: WorkspaceReceiptAuthorityInput;
  declaredEffects: readonly ActionReceiptDeclaredEffect[];
  requestHash: string;
  beforeHash: string;
  validation: Omit<ActionReceiptValidation, 'status'>;
  rollback: Omit<ActionReceiptRollback, 'status'> & { status?: ActionReceiptRollback['status'] };
  metadata?: unknown;
  store: ActionReceiptTransactionStore;
  callbacks: WorkspaceReceiptTransactionCallbacks;
  now?: () => number | string;
  mayMutate?: WorkspaceReceiptMayMutate;
  /** Same logical key serializes the complete transaction, including rollback/finalization. */
  serializationKey: unknown;
}

export interface WorkspaceReceiptServiceSuccess {
  ok: true;
  code: 'ACTION_RECEIPT_COMMITTED';
  receipt: ActionReceiptTransactionProjection;
  replayed: boolean;
}

export interface WorkspaceReceiptServiceFailure {
  ok: false;
  code: WorkspaceReceiptServiceCode;
  receipt?: ActionReceiptTransactionProjection;
  replayed: boolean;
}

export type WorkspaceReceiptServiceResult = WorkspaceReceiptServiceSuccess | WorkspaceReceiptServiceFailure;

export interface WorkspaceReceiptServiceOptions {
  /** An already validated, immutable bundle supplied by the host. */
  policyBundle?: ActionReceiptPolicyBundle;
  /** Synchronous injection seam for unavailable/invalid-policy tests and host bootstrapping. */
  policyBundleLoader?: () => ActionReceiptPolicyBundle;
}

interface QueueEntry {
  tail: Promise<void>;
  pending: number;
}

interface PreparedFacts {
  candidate: ActionReceipt;
  prepareInput: ActionReceiptPrepareInput;
}

type ReadResult =
  | { kind: 'missing' }
  | { kind: 'present'; receipt: ActionReceipt }
  | { kind: 'error'; code: WorkspaceReceiptServiceCode };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

function errorCode(value: unknown): string | undefined {
  return isRecord(value) && typeof value.code === 'string' ? value.code : undefined;
}

function safeErrorCode(value: unknown, fallback: WorkspaceReceiptServiceCode): WorkspaceReceiptServiceCode {
  const code = errorCode(value);
  return code !== undefined && SAFE_STORE_CODE_RE.test(code) ? code : fallback;
}

function isOperationId(value: unknown): value is string {
  return typeof value === 'string' && OPERATION_ID_RE.test(value);
}

function serializationKeyHash(value: unknown): string | undefined {
  if (typeof value !== 'string' || !SERIALIZATION_KEY_RE.test(value)) return undefined;
  try {
    return hashBoundedReceiptFacts(value);
  } catch {
    return undefined;
  }
}

function projection(receipt: ActionReceipt): ActionReceiptTransactionProjection {
  const validated = assertValidActionReceipt(receipt);
  if (validated.status === 'prepared') throw new Error('terminal projection required');
  return { id: validated.id, hash: validated.hash, status: validated.status };
}

function failure(
  code: WorkspaceReceiptServiceCode,
  replayed = false,
  receipt?: ActionReceiptTransactionProjection,
): WorkspaceReceiptServiceFailure {
  return { ok: false, code, ...(receipt === undefined ? {} : { receipt }), replayed };
}

function unwrapReceipt(value: unknown): ActionReceipt {
  if (isRecord(value) && value.ok === false) {
    const code = typeof value.code === 'string' ? value.code : 'RECEIPT_STORE_UNAVAILABLE';
    throw Object.assign(new Error('receipt store read failed'), { code });
  }
  if (isRecord(value) && 'receipt' in value) return assertValidActionReceipt(value.receipt);
  return assertValidActionReceipt(value);
}

async function readExisting(store: ActionReceiptTransactionStore, id: string): Promise<ReadResult> {
  if (store.read === undefined && store.tryRead === undefined) {
    return { kind: 'error', code: 'ACTION_RECEIPT_STORE_UNAVAILABLE' };
  }

  try {
    if (store.read !== undefined) {
      try {
        return { kind: 'present', receipt: unwrapReceipt(await store.read(id)) };
      } catch (error) {
        if (NOT_FOUND_CODES.has(errorCode(error) ?? '')) return { kind: 'missing' };
        return { kind: 'error', code: safeErrorCode(error, 'ACTION_RECEIPT_STORE_UNAVAILABLE') };
      }
    }

    const result = await store.tryRead!(id);
    if (isRecord(result) && result.ok === false) {
      const code = typeof result.code === 'string' ? result.code : 'RECEIPT_STORE_UNAVAILABLE';
      return NOT_FOUND_CODES.has(code)
        ? { kind: 'missing' }
        : { kind: 'error', code: safeErrorCode({ code }, 'ACTION_RECEIPT_STORE_UNAVAILABLE') };
    }
    return { kind: 'present', receipt: unwrapReceipt(result) };
  } catch (error) {
    return { kind: 'error', code: safeErrorCode(error, 'ACTION_RECEIPT_STORE_UNAVAILABLE') };
  }
}

function stableResource(resource: ActionReceiptResourceAuthority): Record<string, string> {
  // A replay may arrive after the current workspace pre-state has changed.  Logical resource
  // identity is stable material; its beforeHash is deliberately lifecycle/current-state input.
  return { role: resource.role, root: resource.root, relativePath: resource.relativePath };
}

function stableAuthority(receipt: ActionReceipt): Record<string, unknown> {
  const authority = receipt.authority;
  return {
    scope: authority.scope,
    ...(authority.scope === 'profile' ? { profileId: authority.profileId } : {}),
    ...(authority.scope === 'workspace' ? { workspaceId: authority.workspaceId } : {}),
    operationId: authority.operationId,
    requestScope: authority.requestScope,
    resources: authority.resources.map(stableResource),
  };
}

function stableEffects(receipt: ActionReceipt): Record<string, unknown> {
  return {
    declared: receipt.effects.declared.map(effect => ({
      id: effect.id,
      operation: effect.operation,
      resource: stableResource(effect.resource),
    })),
  };
}

function stableValidation(receipt: ActionReceipt): Record<string, unknown> {
  return {
    validator: receipt.validation.validator,
    ...(receipt.validation.ruleHash === undefined ? {} : { ruleHash: receipt.validation.ruleHash }),
    ...(receipt.validation.code === undefined ? {} : { code: receipt.validation.code }),
    ...(receipt.validation.summary === undefined ? {} : { summary: receipt.validation.summary }),
  };
}

/**
 * Compare the immutable operation facts that make a receipt replayable.  Full pre-state hashes
 * are excluded because they describe the state observed by the original attempt, not a new
 * mutation intent. Effect reversibility and rollback declarations are likewise first-execution
 * lifecycle facts derived from that observed state; the stored receipt remains authoritative for
 * them on replay. Request hash, effect identity/operation, and logical resource identity remain
 * part of the comparison.
 */
function sameReplayFacts(left: ActionReceipt, right: ActionReceipt): boolean {
  return canonicalJson({
    actor: left.actor,
    client: left.client,
    capability: left.capability,
    authority: stableAuthority(left),
    effects: stableEffects(left),
    input: { requestHash: left.input.requestHash },
    validation: stableValidation(left),
    metadata: left.metadata === undefined ? null : left.metadata,
  }) === canonicalJson({
    actor: right.actor,
    client: right.client,
    capability: right.capability,
    authority: stableAuthority(right),
    effects: stableEffects(right),
    input: { requestHash: right.input.requestHash },
    validation: stableValidation(right),
    metadata: right.metadata === undefined ? null : right.metadata,
  });
}

function prepareInputFromCandidate(candidate: ActionReceipt): ActionReceiptPrepareInput {
  const validation: Omit<ActionReceiptValidation, 'status'> = {
    validator: candidate.validation.validator,
    ...(candidate.validation.ruleHash === undefined ? {} : { ruleHash: candidate.validation.ruleHash }),
    ...(candidate.validation.code === undefined ? {} : { code: candidate.validation.code }),
    ...(candidate.validation.summary === undefined ? {} : { summary: candidate.validation.summary }),
  };
  return {
    actor: candidate.actor,
    client: candidate.client,
    capability: candidate.capability,
    authority: candidate.authority,
    effects: candidate.effects,
    input: candidate.input,
    validation,
    rollback: candidate.rollback,
    ...(candidate.metadata === undefined ? {} : { metadata: candidate.metadata }),
    preparedAt: candidate.times.preparedAt,
  };
}

function isPolicyBundleShape(value: unknown): value is ActionReceiptPolicyBundle {
  if (!isRecord(value)) return false;
  if (value.schema !== ACTION_RECEIPT_POLICY_BUNDLE_SCHEMA) return false;
  if (!isRecord(value.manifest) || !Array.isArray(value.manifest.routes) || !Array.isArray(value.manifest.surfaces)) return false;
  if (!isRecord(value.inventory) || !Array.isArray(value.inventory.routes) || !Array.isArray(value.inventory.surfaces)) return false;
  return typeof value.manifestSha256 === 'string'
    && typeof value.reviewedManifestSha256 === 'string'
    && typeof value.routeCount === 'number'
    && typeof value.surfaceCount === 'number';
}

function policyBundleFailure(error: unknown): WorkspaceReceiptServiceCode {
  const code = errorCode(error);
  if (code !== undefined && SAFE_POLICY_BUNDLE_CODE_RE.test(code)) return code;
  return 'ACTION_RECEIPT_POLICY_BUNDLE_UNAVAILABLE';
}

function policyResultFailure(result: Exclude<ActionReceiptCoverageResolverResult, { policy: 'receipt-required' }>): WorkspaceReceiptServiceFailure {
  if (result.policy === 'refused') return failure(result.code);
  return failure(result.policy === 'receipt-exempt'
    ? 'ACTION_RECEIPT_POLICY_EXEMPT'
    : 'ACTION_RECEIPT_POLICY_SEPARATELY_GOVERNED');
}

function guardAllowed(value: unknown): boolean {
  return value !== false && !(isRecord(value) && value.ok === false);
}

function kernelResult(
  result: ActionReceiptTransactionResult,
): WorkspaceReceiptServiceResult {
  if (result.ok) {
    return { ok: true, code: 'ACTION_RECEIPT_COMMITTED', receipt: result.receipt, replayed: false };
  }
  const failed = result as Extract<ActionReceiptTransactionResult, { ok: false }>;
  return failure(failed.code, false, failed.receipt);
}

export class WorkspaceReceiptService {
  private readonly policyBundleLoader: () => ActionReceiptPolicyBundle;
  private policyBundle?: ActionReceiptPolicyBundle;
  private policyBundleFailure?: WorkspaceReceiptServiceCode;
  private readonly queues = new Map<string, QueueEntry>();

  constructor(options: WorkspaceReceiptServiceOptions = {}) {
    this.policyBundleLoader = options.policyBundleLoader ?? loadActionReceiptPolicyBundle;
    if (options.policyBundle !== undefined) this.policyBundle = options.policyBundle;
  }

  private getPolicyBundle(): { bundle?: ActionReceiptPolicyBundle; code?: WorkspaceReceiptServiceCode } {
    if (this.policyBundle !== undefined) {
      return isPolicyBundleShape(this.policyBundle)
        ? { bundle: this.policyBundle }
        : { code: 'ACTION_RECEIPT_POLICY_BUNDLE_INVALID' };
    }
    if (this.policyBundleFailure !== undefined) return { code: this.policyBundleFailure };

    try {
      const bundle = this.policyBundleLoader();
      if (!isPolicyBundleShape(bundle)) {
        this.policyBundleFailure = 'ACTION_RECEIPT_POLICY_BUNDLE_INVALID';
        return { code: this.policyBundleFailure };
      }
      this.policyBundle = bundle;
      return { bundle };
    } catch (error) {
      this.policyBundleFailure = policyBundleFailure(error);
      return { code: this.policyBundleFailure };
    }
  }

  private async withSerializationKey<T>(key: string, task: () => Promise<T>): Promise<T> {
    const queueKey = hashBoundedReceiptFacts(key);
    const current = this.queues.get(queueKey);
    const entry: QueueEntry = current ?? { tail: Promise.resolve(), pending: 0 };
    if (current === undefined) this.queues.set(queueKey, entry);

    const predecessor = entry.tail;
    let release!: () => void;
    entry.tail = new Promise<void>(resolve => { release = resolve; });
    entry.pending += 1;

    try {
      await predecessor;
      return await task();
    } finally {
      release();
      entry.pending -= 1;
      if (entry.pending === 0 && this.queues.get(queueKey) === entry) this.queues.delete(queueKey);
    }
  }

  private replayResult(existing: ActionReceipt): WorkspaceReceiptServiceResult {
    if (existing.status === 'prepared') return failure('ACTION_RECEIPT_PREPARED_REPLAY', true);
    const terminal = projection(existing);
    if (existing.status === 'committed') {
      return { ok: true, code: 'ACTION_RECEIPT_COMMITTED', receipt: terminal, replayed: true };
    }
    return failure('ACTION_RECEIPT_REPLAY', true, terminal);
  }

  async execute(description: WorkspaceReceiptTransactionDescription): Promise<WorkspaceReceiptServiceResult> {
    if (!isOperationId(description.operationId)) return failure('ACTION_RECEIPT_OPERATION_ID_INVALID');

    const queueKey = serializationKeyHash(description.serializationKey);
    if (queueKey === undefined) return failure('ACTION_RECEIPT_SERIALIZATION_KEY_INVALID');

    let identity: ReturnType<typeof mapRuntimeReceiptIdentity>;
    try {
      identity = mapRuntimeReceiptIdentity(description.identity);
    } catch (error) {
      const code = errorCode(error);
      return failure(code !== undefined && SAFE_RUNTIME_CODE_RE.test(code)
        ? code as ActionReceiptRuntimeErrorCode
        : 'ACTION_RECEIPT_RUNTIME_IDENTITY_INVALID');
    }

    const loaded = this.getPolicyBundle();
    if (loaded.bundle === undefined) return failure(loaded.code ?? 'ACTION_RECEIPT_POLICY_BUNDLE_UNAVAILABLE');

    const authority = description.authority.scope === 'global'
      ? {
          scope: 'global' as const,
          operationId: description.operationId,
          requestScope: description.authority.requestScope,
          resources: [...description.authority.resources],
        }
      : description.authority.scope === 'profile'
        ? {
            scope: 'profile' as const,
            operationId: description.operationId,
            profileId: description.authority.profileId,
            requestScope: description.authority.requestScope,
            resources: [...description.authority.resources],
          }
        : {
            scope: 'workspace' as const,
            operationId: description.operationId,
            workspaceId: description.authority.workspaceId,
            requestScope: description.authority.requestScope,
            resources: [...description.authority.resources],
          };

    let resolved: ActionReceiptCoverageResolverResult;
    try {
      resolved = resolveActionReceiptPolicy(loaded.bundle.manifest, {
        inventory: loaded.bundle.inventory as unknown as DiscoveredActionReceiptCoverageInventory,
        routeKey: description.routeKey,
        actor: identity.actor,
        client: identity.client,
        authority,
        declaredEffects: [...description.declaredEffects],
        input: { requestHash: description.requestHash, beforeHash: description.beforeHash },
        validation: description.validation,
        rollback: description.rollback,
        ...(description.metadata === undefined ? {} : { metadata: description.metadata }),
      });
    } catch {
      return failure('ACTION_RECEIPT_COVERAGE_MANIFEST_INVALID');
    }

    if (resolved.policy !== 'receipt-required') return policyResultFailure(resolved);

    let preparedFacts: PreparedFacts;
    try {
      const originalReviewRef = 'legacyRoute' in resolved.prepareInput.capability
        ? resolved.prepareInput.capability.reviewRef
        : undefined;
      const recoveryInput = originalReviewRef === undefined || REVIEW_REF_RE.test(originalReviewRef)
        ? resolved
        : {
            ...resolved,
            prepareInput: {
              ...resolved.prepareInput,
              capability: {
                ...resolved.prepareInput.capability,
                reviewRef: `review_${hashBoundedReceiptFacts({
                  kind: 'review-ref',
                  value: originalReviewRef,
                })}`,
              },
            },
          };
      const bound = bindDeterministicRecoveryReference(recoveryInput);
      if (bound.policy !== 'receipt-required') return policyResultFailure(bound);
      const candidate = createPreparedActionReceipt(bound.prepareInput);
      preparedFacts = { candidate, prepareInput: prepareInputFromCandidate(candidate) };
    } catch (error) {
      const code = errorCode(error);
      return failure(code !== undefined && SAFE_RUNTIME_CODE_RE.test(code)
        ? code
        : 'ACTION_RECEIPT_PREPARE_INVALID');
    }

    const callbacks = description.callbacks;
    if (!isRecord(callbacks)
      || typeof callbacks.mutate !== 'function'
      || typeof callbacks.postcondition !== 'function'
      || !isRecord(description.store)
      || typeof description.store.prepareWithDisposition !== 'function'
      || typeof description.store.transition !== 'function') {
      return failure('ACTION_RECEIPT_TRANSACTION_INVALID');
    }

    return this.withSerializationKey(queueKey, async () => {
      const existing = await readExisting(description.store, preparedFacts.candidate.id);
      if (existing.kind === 'error') return failure(existing.code);
      if (existing.kind === 'present') {
        if (!sameReplayFacts(existing.receipt, preparedFacts.candidate)) {
          return failure('ACTION_RECEIPT_DUPLICATE_CONFLICT');
        }
        return this.replayResult(existing.receipt);
      }

      const guardedMutate: ActionReceiptMutation = async context => {
        if (description.mayMutate !== undefined) {
          let decision: unknown;
          try {
            decision = await description.mayMutate(context);
          } catch {
            return { ok: false, changed: false };
          }
          if (!guardAllowed(decision)) return { ok: false, changed: false };
        }
        return callbacks.mutate(context);
      };

      try {
        const result = await runActionReceiptTransaction({
          policy: 'receipt-required',
          prepareInput: preparedFacts.prepareInput,
          store: description.store,
          mutate: guardedMutate,
          postcondition: callbacks.postcondition,
          ...(callbacks.rollback === undefined ? {} : { rollback: callbacks.rollback }),
          ...(callbacks.prepareRecovery === undefined ? {} : { prepareRecovery: callbacks.prepareRecovery }),
          ...(description.now === undefined ? {} : { now: description.now }),
        });
        return kernelResult(result);
      } catch (error) {
        return failure(safeErrorCode(error, 'ACTION_RECEIPT_TRANSACTION_INVALID'));
      }
    });
  }
}

export function createWorkspaceReceiptService(options: WorkspaceReceiptServiceOptions = {}): WorkspaceReceiptService {
  return new WorkspaceReceiptService(options);
}

export async function runWorkspaceReceiptTransaction(
  description: WorkspaceReceiptTransactionDescription,
  service: WorkspaceReceiptService,
): Promise<WorkspaceReceiptServiceResult> {
  return service.execute(description);
}
