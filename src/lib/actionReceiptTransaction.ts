/**
 * W3B1 — request-local action-receipt transaction kernel.
 *
 * The kernel deliberately owns no route, policy loader, filesystem writer, or receipt store. A
 * W3B0 resolver result and the already-authoritative ActionReceiptStore are supplied by a later
 * adapter. The only values returned to that adapter are stable failure codes and terminal receipt
 * projections; receipt payloads remain inside the injected transaction callbacks/store.
 */

import {
  assertValidActionReceipt,
  canonicalJson,
  createPreparedActionReceipt,
  type ActionReceipt,
  type ActionReceiptAfter,
  type ActionReceiptPrepareInput,
  type ActionReceiptStatus,
  type ActionReceiptTransitionInput,
} from './actionReceipt';
import type {
  ActionReceiptCoverageRefusalCode,
  ActionReceiptCoverageResolverResult,
} from './actionReceiptCoverage';

export type ActionReceiptTerminalStatus = Exclude<ActionReceiptStatus, 'prepared'>;

/** The only receipt data a transaction caller may receive from this kernel. */
export type ActionReceiptTransactionProjection = Pick<ActionReceipt, 'id' | 'hash' | 'status'>;

export type ActionReceiptTransactionCode =
  | ActionReceiptCoverageRefusalCode
  | 'ACTION_RECEIPT_POLICY_EXEMPT'
  | 'ACTION_RECEIPT_POLICY_SEPARATELY_GOVERNED'
  | 'ACTION_RECEIPT_TRANSACTION_INVALID'
  | 'ACTION_RECEIPT_OPERATION_ID_INVALID'
  | 'ACTION_RECEIPT_PREPARE_INVALID'
  | 'ACTION_RECEIPT_PREPARE_FAILED'
  | 'ACTION_RECEIPT_PREPARE_DISPOSITION_UNAVAILABLE'
  | 'ACTION_RECEIPT_RECOVERY_FAILED'
  | 'ACTION_RECEIPT_MUTATION_FAILED'
  | 'ACTION_RECEIPT_POSTCONDITION_FAILED'
  | 'ACTION_RECEIPT_FINALIZATION_FAILED'
  | 'ACTION_RECEIPT_ROLLBACK_FAILED'
  | 'ACTION_RECEIPT_REPLAY'
  | 'ACTION_RECEIPT_PREPARED_REPLAY'
  | 'ACTION_RECEIPT_DUPLICATE_CONFLICT'
  | 'ACTION_RECEIPT_INCOMPLETE_UNRECORDED'
  | 'ACTION_RECEIPT_STORE_UNAVAILABLE'
  | (string & {});

export interface ActionReceiptTransactionSuccess {
  ok: true;
  receipt: ActionReceiptTransactionProjection;
}

export interface ActionReceiptTransactionFailure {
  ok: false;
  code: ActionReceiptTransactionCode;
  /** A terminal projection is present only when that terminal fact was durably reconciled. */
  receipt?: ActionReceiptTransactionProjection;
}

export type ActionReceiptTransactionResult =
  | ActionReceiptTransactionSuccess
  | ActionReceiptTransactionFailure;

type MaybePromise<T> = T | PromiseLike<T>;

/**
 * Structural store contract. ActionReceiptStore satisfies this interface; no second writer is
 * constructed here. read/tryRead are optional only so a minimal adapter can still execute the
 * happy path; when present they are used to reconcile an ambiguous transition.
 */
export interface ActionReceiptTransactionStore {
  /** Legacy W3A surface retained for non-transaction callers. */
  prepare?: (input: ActionReceiptPrepareInput) => MaybePromise<ActionReceipt | ActionReceiptStoreEnvelope>;
  /** Required by W3B1: one synchronous existence/create decision with an explicit disposition. */
  prepareWithDisposition(input: ActionReceiptPrepareInput): MaybePromise<ActionReceiptPrepareDisposition>;
  transition(id: string, input: ActionReceiptTransitionInput): MaybePromise<ActionReceipt | ActionReceiptStoreEnvelope>;
  read?: (id: string) => MaybePromise<ActionReceipt | ActionReceiptStoreEnvelope>;
  tryRead?: (id: string) => MaybePromise<ActionReceiptStoreResultEnvelope>;
}

export interface ActionReceiptStoreEnvelope {
  receipt: ActionReceipt;
  /** A store may expose this to distinguish an idempotent replay from a new prepare. */
  created?: boolean;
}

export interface ActionReceiptPrepareDisposition {
  receipt: ActionReceipt;
  created: boolean;
}

export type ActionReceiptStoreResultEnvelope =
  | ActionReceiptStoreEnvelope & { ok: true }
  | { ok: false; code?: string };

export interface ActionReceiptTransactionContext {
  /** The validated prepared receipt is callback-local and is never returned by the kernel. */
  receipt: ActionReceipt;
}

export type ActionReceiptMutationResult =
  | void
  | boolean
  | {
      ok?: true | false;
      /** False means the adapter has proved that no state write occurred. */
      changed?: boolean;
      after?: ActionReceiptAfter;
      partialAfter?: ActionReceiptAfter;
    };

export type ActionReceiptMutation = (
  context: ActionReceiptTransactionContext,
) => MaybePromise<ActionReceiptMutationResult>;

export type ActionReceiptTransactionPhase = 'postcondition' | 'rollback-observation';

export interface ActionReceiptPostconditionContext extends ActionReceiptTransactionContext {
  phase: ActionReceiptTransactionPhase;
}

export type ActionReceiptPostconditionResult =
  | ActionReceiptAfter
  | { ok?: true; after: ActionReceiptAfter }
  | { ok: false; after?: ActionReceiptAfter; partialAfter?: ActionReceiptAfter };

export type ActionReceiptPostcondition = (
  context: ActionReceiptPostconditionContext,
) => MaybePromise<ActionReceiptPostconditionResult>;

export type ActionReceiptRollbackReason = 'mutation-failed' | 'postcondition-failed' | 'receipt-finalization-failed';

export interface ActionReceiptRollbackContext extends ActionReceiptTransactionContext {
  reason: ActionReceiptRollbackReason;
}

export type ActionReceiptRollbackResult =
  | void
  | true
  | false
  | ActionReceiptAfter
  | { ok: true; after?: ActionReceiptAfter }
  | { ok: false; after?: ActionReceiptAfter; partialAfter?: ActionReceiptAfter };

export interface ActionReceiptRollbackCallback {
  (context: ActionReceiptRollbackContext): MaybePromise<ActionReceiptRollbackResult>;
  /** Optional pre-mutation recovery preparation hook. */
  prepare?: (context: ActionReceiptTransactionContext) => MaybePromise<void | true | false | { ok?: true | false }>;
}

export type ActionReceiptRecoveryPreparation = (
  context: ActionReceiptTransactionContext,
) => MaybePromise<void | true | false | { ok?: true | false }>;

export interface ActionReceiptTransactionCallbacks {
  store: ActionReceiptTransactionStore;
  mutate: ActionReceiptMutation;
  postcondition: ActionReceiptPostcondition;
  rollback?: ActionReceiptRollbackCallback;
  /** Optional when the adapter has already durably prepared the W3A rollback reference. */
  prepareRecovery?: ActionReceiptRecoveryPreparation;
  /** Injectable lifecycle clock; timestamps are lifecycle facts, never operation identity input. */
  now?: () => number | string;
}

type ReceiptRequiredPolicy = Extract<ActionReceiptCoverageResolverResult, { policy: 'receipt-required' }>;
type NonRequiredPolicy = Exclude<ActionReceiptCoverageResolverResult, ReceiptRequiredPolicy>;

export type ActionReceiptTransactionRequest =
  | (ReceiptRequiredPolicy & ActionReceiptTransactionCallbacks)
  | (NonRequiredPolicy & Partial<ActionReceiptTransactionCallbacks>);

const OPERATION_ID_RE = /^[a-zA-Z][a-zA-Z0-9._:-]{0,127}$/;
const SAFE_STORE_CODE_RE = /^(?:ACTION_RECEIPT|RECEIPT)_[A-Z0-9_]+$/;
const NOT_FOUND_CODES = new Set(['RECEIPT_NOT_FOUND', 'ENOENT', 'ENOTDIR']);

class CallbackFailure extends Error {
  readonly after?: ActionReceiptAfter;
  readonly partialAfter?: ActionReceiptAfter;

  constructor(after?: ActionReceiptAfter, partialAfter?: ActionReceiptAfter) {
    super('callback failed');
    this.name = 'CallbackFailure';
    this.after = after;
    this.partialAfter = partialAfter;
  }
}

class StoreEnvelopeFailure extends Error {
  readonly code: string;

  constructor(code: string) {
    super('receipt store operation failed');
    this.name = 'StoreEnvelopeFailure';
    this.code = code;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

function errorCode(error: unknown): string | undefined {
  if (!isRecord(error) || typeof error.code !== 'string') return undefined;
  return error.code;
}

function isNotFound(error: unknown): boolean {
  const code = errorCode(error);
  return code !== undefined && NOT_FOUND_CODES.has(code);
}

function stableStoreCode(error: unknown, fallback: ActionReceiptTransactionCode): ActionReceiptTransactionCode {
  const code = errorCode(error);
  if (code === 'RECEIPT_DUPLICATE_CONFLICT') return code;
  if (code === 'ACTION_RECEIPT_INVALID') return code;
  if (code !== undefined && SAFE_STORE_CODE_RE.test(code)) return code;
  return fallback;
}

function isAfter(value: unknown): value is ActionReceiptAfter {
  return isRecord(value) && typeof value.outcome === 'string' && Array.isArray(value.resources);
}

function extractAfter(value: unknown): ActionReceiptAfter | undefined {
  if (isAfter(value)) return value;
  if (!isRecord(value)) return undefined;
  if (isAfter(value.partialAfter)) return value.partialAfter;
  if (isAfter(value.after)) return value.after;
  return undefined;
}

function extractPartialAfter(value: unknown): ActionReceiptAfter | undefined {
  if (!isRecord(value)) return undefined;
  if (isAfter(value.partialAfter)) return value.partialAfter;
  const after = isAfter(value.after) ? value.after : isAfter(value) ? value : undefined;
  return after;
}

function callbackReportedFailure(value: unknown): boolean {
  return value === false || (isRecord(value) && value.ok === false);
}

function mutationFailureKnownNoChange(value: unknown): boolean {
  return isRecord(value) && value.changed === false;
}

function unwrapStoreReceipt(value: unknown): { receipt: ActionReceipt; created?: boolean } {
  if (isRecord(value) && value.ok === false) {
    throw new StoreEnvelopeFailure(typeof value.code === 'string' ? value.code : 'RECEIPT_STORE_UNAVAILABLE');
  }
  if (isRecord(value) && 'receipt' in value) {
    return {
      receipt: assertValidActionReceipt(value.receipt),
      created: typeof value.created === 'boolean' ? value.created : undefined,
    };
  }
  return { receipt: assertValidActionReceipt(value) };
}

function unwrapPrepareDisposition(value: unknown): ActionReceiptPrepareDisposition {
  const unwrapped = unwrapStoreReceipt(value);
  if (unwrapped.created === undefined) {
    throw new StoreEnvelopeFailure('ACTION_RECEIPT_PREPARE_DISPOSITION_UNAVAILABLE');
  }
  return { receipt: unwrapped.receipt, created: unwrapped.created };
}

async function readReceipt(
  store: ActionReceiptTransactionStore,
  id: string,
): Promise<ActionReceipt | undefined> {
  if (store.read !== undefined) {
    try {
      return unwrapStoreReceipt(await store.read(id)).receipt;
    } catch (error) {
      if (isNotFound(error)) return undefined;
      throw error;
    }
  }
  if (store.tryRead !== undefined) {
    const result = await store.tryRead(id);
    if (result.ok === false) {
      if (result.code !== undefined && NOT_FOUND_CODES.has(result.code)) return undefined;
      throw new StoreEnvelopeFailure(result.code ?? 'RECEIPT_STORE_UNAVAILABLE');
    }
    return unwrapStoreReceipt(result).receipt;
  }
  return undefined;
}

interface TransitionAttempt {
  receipt?: ActionReceipt;
  callError?: unknown;
  readError?: unknown;
  reconciledExact: boolean;
}

function transitionMatches(receipt: ActionReceipt, input: ActionReceiptTransitionInput): boolean {
  if (receipt.status !== input.to || receipt.transition.at !== input.at) return false;
  if (input.validation !== undefined && canonicalJson(receipt.validation) !== canonicalJson(input.validation)) return false;
  if (input.rollbackStatus !== undefined && receipt.rollback.status !== input.rollbackStatus) return false;
  if (input.after !== undefined && (receipt.after === undefined || canonicalJson(receipt.after) !== canonicalJson(input.after))) return false;
  if (input.failure !== undefined && (receipt.failure === undefined || canonicalJson(receipt.failure) !== canonicalJson(input.failure))) return false;
  return true;
}

/** Re-read after every failed transition so a write-then-throw is never treated as absent truth. */
async function attemptTransition(
  store: ActionReceiptTransactionStore,
  id: string,
  input: ActionReceiptTransitionInput,
): Promise<TransitionAttempt> {
  try {
    return { receipt: unwrapStoreReceipt(await store.transition(id, input)).receipt, reconciledExact: false };
  } catch (callError) {
    try {
      const receipt = await readReceipt(store, id);
      return { receipt, callError, reconciledExact: receipt !== undefined && transitionMatches(receipt, input) };
    } catch (readError) {
      return { callError, readError, reconciledExact: false };
    }
  }
}

function projection(receipt: ActionReceipt | undefined): ActionReceiptTransactionProjection | undefined {
  if (receipt === undefined) return undefined;
  const validated = assertValidActionReceipt(receipt);
  if (validated.status === 'prepared') return undefined;
  return { id: validated.id, hash: validated.hash, status: validated.status };
}

function success(receipt: ActionReceipt): ActionReceiptTransactionSuccess {
  const projected = projection(receipt);
  if (projected === undefined) throw new Error('terminal receipt projection required');
  return { ok: true, receipt: projected };
}

function failure(
  code: ActionReceiptTransactionCode,
  receipt?: ActionReceipt,
): ActionReceiptTransactionFailure {
  const projected = projection(receipt);
  return projected === undefined ? { ok: false, code } : { ok: false, code, receipt: projected };
}

function operationIdIsValid(input: unknown): boolean {
  if (!isRecord(input) || !isRecord(input.authority)) return false;
  const operationId = input.authority.operationId;
  return typeof operationId === 'string' && OPERATION_ID_RE.test(operationId);
}

function lifecycleAt(
  preparedAt: string,
  now: (() => number | string) | undefined,
): string {
  const floor = Date.parse(preparedAt);
  const raw = now === undefined ? Date.now() : now();
  const candidate = typeof raw === 'number' ? raw : Date.parse(raw);
  if (!Number.isFinite(floor) || !Number.isFinite(candidate)) throw new Error('invalid lifecycle clock');
  return new Date(Math.max(floor, candidate)).toISOString();
}

function failureValidation(receipt: ActionReceipt): ActionReceipt['validation'] {
  return { ...receipt.validation, status: 'failed' };
}

function passedValidation(receipt: ActionReceipt): ActionReceipt['validation'] {
  return { ...receipt.validation, status: 'passed' };
}

function rollbackStatusFor(receipt: ActionReceipt, status: 'prepared' | 'available' | 'performed' | 'failed'): ActionReceipt['rollback']['status'] {
  return receipt.rollback.required ? status : 'not_required';
}

function transitionFailureCode(error: unknown): ActionReceiptTransactionCode {
  return stableStoreCode(error, 'ACTION_RECEIPT_STORE_UNAVAILABLE');
}

async function recordFailed(
  request: ReceiptRequiredPolicy & ActionReceiptTransactionCallbacks,
  receipt: ActionReceipt,
  code: ActionReceiptTransactionCode,
): Promise<ActionReceipt | undefined> {
  let at: string;
  try {
    at = lifecycleAt(receipt.times.preparedAt, request.now);
  } catch {
    at = receipt.times.preparedAt;
  }
  const attempt = await attemptTransition(request.store, receipt.id, {
    to: 'failed',
    at,
    validation: failureValidation(receipt),
    rollbackStatus: rollbackStatusFor(receipt, 'prepared'),
    failure: { code },
  });
  return attempt.receipt;
}

function toPartialAfter(after: ActionReceiptAfter | undefined): ActionReceiptAfter | undefined {
  if (after === undefined) return undefined;
  if (after.outcome === 'partial') return after;
  return { ...after, outcome: 'partial', code: 'ACTION_RECEIPT_PARTIAL_AFTER' };
}

async function observePartialAfter(
  request: ReceiptRequiredPolicy & ActionReceiptTransactionCallbacks,
  receipt: ActionReceipt,
  initial: ActionReceiptAfter | undefined,
): Promise<ActionReceiptAfter | undefined> {
  const fromInitial = toPartialAfter(initial);
  if (fromInitial !== undefined) return fromInitial;
  try {
    const result = await request.postcondition({ receipt, phase: 'rollback-observation' });
    return toPartialAfter(extractAfter(result));
  } catch (error) {
    return toPartialAfter(extractPartialAfter(error));
  }
}

interface RollbackAttempt {
  succeeded: boolean;
  partialAfter?: ActionReceiptAfter;
}

async function attemptRollback(
  request: ReceiptRequiredPolicy & ActionReceiptTransactionCallbacks,
  receipt: ActionReceipt,
  reason: ActionReceiptRollbackReason,
  initialAfter: ActionReceiptAfter | undefined,
): Promise<RollbackAttempt> {
  if (!receipt.rollback.required || request.rollback === undefined) {
    return { succeeded: false, partialAfter: toPartialAfter(initialAfter) };
  }
  try {
    const result = await request.rollback({ receipt, reason });
    if (callbackReportedFailure(result)) {
      return { succeeded: false, partialAfter: toPartialAfter(extractPartialAfter(result) ?? initialAfter) };
    }
    const after = extractAfter(result);
    if (after?.outcome === 'partial') return { succeeded: false, partialAfter: after };
    return { succeeded: true };
  } catch (error) {
    return { succeeded: false, partialAfter: toPartialAfter(extractPartialAfter(error) ?? initialAfter) };
  }
}

interface FailureRecoveryPlan {
  reason: ActionReceiptRollbackReason;
  resultCode: ActionReceiptTransactionCode;
  successfulRollbackReceiptCode: ActionReceiptTransactionCode;
  failedRollbackReceiptCode: ActionReceiptTransactionCode;
  unrecordedCode: ActionReceiptTransactionCode;
  compensateCommitted: boolean;
}

const FINALIZATION_RECOVERY_PLAN: FailureRecoveryPlan = {
  reason: 'receipt-finalization-failed',
  resultCode: 'ACTION_RECEIPT_FINALIZATION_FAILED',
  successfulRollbackReceiptCode: 'ACTION_RECEIPT_FINALIZATION_FAILED',
  failedRollbackReceiptCode: 'ACTION_RECEIPT_ROLLBACK_FAILED',
  unrecordedCode: 'ACTION_RECEIPT_INCOMPLETE_UNRECORDED',
  compensateCommitted: true,
};

const MUTATION_RECOVERY_PLAN: FailureRecoveryPlan = {
  reason: 'mutation-failed',
  resultCode: 'ACTION_RECEIPT_MUTATION_FAILED',
  successfulRollbackReceiptCode: 'ACTION_RECEIPT_MUTATION_FAILED',
  failedRollbackReceiptCode: 'ACTION_RECEIPT_MUTATION_FAILED',
  unrecordedCode: 'ACTION_RECEIPT_INCOMPLETE_UNRECORDED',
  compensateCommitted: false,
};

async function reconcileAfterFailure(
  request: ReceiptRequiredPolicy & ActionReceiptTransactionCallbacks,
  receipt: ActionReceipt,
  plan: FailureRecoveryPlan,
  initialAfter: ActionReceiptAfter | undefined,
): Promise<ActionReceiptTransactionResult> {
  const rollback = await attemptRollback(request, receipt, plan.reason, initialAfter);
  let current: ActionReceipt | undefined;
  let readFailed = false;
  try {
    current = await readReceipt(request.store, receipt.id);
  } catch {
    readFailed = true;
  }

  if (rollback.succeeded) {
    if (current?.status === 'committed' && plan.compensateCommitted) {
      // A commit that threw after being written is already terminal. Preserve it and record the
      // domain rollback as W3A compensation; this branch is only for an ambiguous commit, never a
      // proven-good commit transition.
      let at: string;
      try { at = lifecycleAt(current.times.committedAt ?? current.times.preparedAt, request.now); }
      catch { at = current.times.committedAt ?? current.times.preparedAt; }
      const compensation = await attemptTransition(request.store, current.id, {
        to: 'compensated',
        at,
        validation: current.validation,
        rollbackStatus: 'performed',
        after: current.after,
      });
      return failure(plan.resultCode, compensation.receipt ?? current);
    }
    if (current?.status === 'committed') return failure(plan.resultCode, current);
    if (current === undefined && readFailed) {
      return failure(plan.resultCode);
    }
    if (current === undefined || current.status === 'prepared') {
      let at: string;
      try { at = lifecycleAt(receipt.times.preparedAt, request.now); }
      catch { at = receipt.times.preparedAt; }
      const rolledBack = await attemptTransition(request.store, receipt.id, {
        to: 'rolled_back',
        at,
        validation: failureValidation(receipt),
        rollbackStatus: 'performed',
        failure: { code: plan.successfulRollbackReceiptCode },
      });
      return failure(plan.resultCode, rolledBack.receipt);
    }
    return failure(plan.resultCode, current);
  }

  const partialAfter = await observePartialAfter(request, receipt, rollback.partialAfter);
  if (current?.status === 'committed') {
    // W3A intentionally forbids rewriting committed facts to incomplete. Returning the exact
    // committed projection with a non-success result is safer than fabricating a second receipt.
    return failure(plan.failedRollbackReceiptCode, current);
  }
  if (current === undefined && readFailed) {
    return failure(plan.unrecordedCode);
  }
  if (partialAfter !== undefined && (current === undefined || current.status === 'prepared')) {
    let at: string;
    try { at = lifecycleAt(receipt.times.preparedAt, request.now); }
    catch { at = receipt.times.preparedAt; }
    const incomplete = await attemptTransition(request.store, receipt.id, {
      to: 'incomplete',
      at,
      validation: failureValidation(receipt),
      rollbackStatus: rollbackStatusFor(receipt, 'failed'),
      after: partialAfter,
      failure: { code: plan.failedRollbackReceiptCode },
    });
    if (incomplete.receipt !== undefined) return failure(plan.failedRollbackReceiptCode, incomplete.receipt);
  }
  if (current === undefined || current.status === 'prepared') {
    // A failed rollback without an observable after-state cannot honestly claim incomplete facts,
    // but it still must not leave the prepared receipt looking runnable on the next call.
    const failed = await recordFailed(request, receipt, plan.failedRollbackReceiptCode);
    return failure(plan.failedRollbackReceiptCode, failed);
  }
  return failure(plan.resultCode, current);
}

function replayResult(receipt: ActionReceipt): ActionReceiptTransactionResult {
  if (receipt.status === 'committed') return success(receipt);
  if (receipt.status === 'prepared') return failure('ACTION_RECEIPT_PREPARED_REPLAY');
  return failure('ACTION_RECEIPT_REPLAY', receipt);
}

function policyResult(policy: NonRequiredPolicy): ActionReceiptTransactionFailure {
  if (policy.policy === 'refused') return { ok: false, code: policy.code };
  return {
    ok: false,
    code: policy.policy === 'receipt-exempt'
      ? 'ACTION_RECEIPT_POLICY_EXEMPT'
      : 'ACTION_RECEIPT_POLICY_SEPARATELY_GOVERNED',
  };
}

function normalizeRequest(
  requestOrPolicy: ActionReceiptTransactionRequest | ActionReceiptCoverageResolverResult,
  callbacks?: ActionReceiptTransactionCallbacks,
): ActionReceiptTransactionRequest {
  if (callbacks === undefined) return requestOrPolicy as ActionReceiptTransactionRequest;
  return { ...requestOrPolicy, ...callbacks } as ActionReceiptTransactionRequest;
}

/**
 * Execute one receipt-required action. The overload accepting policy plus callbacks is a convenience
 * for the later bundled-extension backend adapter; both forms share this one discriminated kernel
 * implementation.
 */
export function runActionReceiptTransaction(
  request: ActionReceiptTransactionRequest,
): Promise<ActionReceiptTransactionResult>;
export function runActionReceiptTransaction(
  policy: ActionReceiptCoverageResolverResult,
  callbacks: ActionReceiptTransactionCallbacks,
): Promise<ActionReceiptTransactionResult>;
export async function runActionReceiptTransaction(
  requestOrPolicy: ActionReceiptTransactionRequest | ActionReceiptCoverageResolverResult,
  callbacks?: ActionReceiptTransactionCallbacks,
): Promise<ActionReceiptTransactionResult> {
  const request = normalizeRequest(requestOrPolicy, callbacks);
  if (request.policy !== 'receipt-required') return policyResult(request as NonRequiredPolicy);

  const required = request as ReceiptRequiredPolicy & Partial<ActionReceiptTransactionCallbacks>;
  if (required.store === undefined || required.mutate === undefined || required.postcondition === undefined) {
    return { ok: false, code: 'ACTION_RECEIPT_TRANSACTION_INVALID' };
  }
  const executable = required as ReceiptRequiredPolicy & ActionReceiptTransactionCallbacks;

  if (!operationIdIsValid(executable.prepareInput)) {
    return { ok: false, code: 'ACTION_RECEIPT_OPERATION_ID_INVALID' };
  }

  let candidate: ActionReceipt;
  try {
    // This validates the complete W3A prepare contract before any store or callback side effect.
    // The candidate is never returned and its generated id depends on the caller operation id,
    // actor, client, capability, and authority scope—not time or request-body serialization.
    candidate = createPreparedActionReceipt(executable.prepareInput);
  } catch {
    return { ok: false, code: 'ACTION_RECEIPT_PREPARE_INVALID' };
  }

  let existing: ActionReceipt | undefined;
  try {
    existing = await readReceipt(executable.store, candidate.id);
  } catch (error) {
    return failure(transitionFailureCode(error));
  }
  if (existing !== undefined) {
    if (existing.authorityHash !== candidate.authorityHash) return failure('ACTION_RECEIPT_DUPLICATE_CONFLICT');
    return replayResult(existing);
  }

  if (executable.store.prepareWithDisposition === undefined) {
    return { ok: false, code: 'ACTION_RECEIPT_PREPARE_DISPOSITION_UNAVAILABLE' };
  }

  if (candidate.rollback.required) {
    if (executable.rollback === undefined) {
      return { ok: false, code: 'ACTION_RECEIPT_RECOVERY_FAILED' };
    }
    const prepareRecovery = executable.prepareRecovery ?? executable.rollback.prepare;
    if (prepareRecovery !== undefined) {
      try {
        const result = await prepareRecovery({ receipt: candidate });
        if (callbackReportedFailure(result)) throw new CallbackFailure();
      } catch {
        // The hook runs before store prepare, so a failed recovery never leaves a receipt that
        // falsely claims rollback.status=prepared. If omitted, the adapter owns the durable
        // recovery reference already named by the candidate.
        return { ok: false, code: 'ACTION_RECEIPT_RECOVERY_FAILED' };
      }
    }
  }

  let prepared: ActionReceipt;
  let created: boolean;
  try {
    const stored = unwrapPrepareDisposition(await executable.store.prepareWithDisposition(executable.prepareInput));
    prepared = stored.receipt;
    created = stored.created;
  } catch (error) {
    const code = stableStoreCode(error, 'ACTION_RECEIPT_PREPARE_FAILED');
    return failure(code === 'RECEIPT_DUPLICATE_CONFLICT' ? 'ACTION_RECEIPT_DUPLICATE_CONFLICT' : code);
  }
  if (prepared.id !== candidate.id || prepared.authorityHash !== candidate.authorityHash) {
    return failure('ACTION_RECEIPT_DUPLICATE_CONFLICT');
  }
  if (!created || prepared.status !== 'prepared') return replayResult(prepared);

  let mutationFailureValue: unknown;
  try {
    const result = await executable.mutate({ receipt: prepared });
    mutationFailureValue = result;
    if (callbackReportedFailure(result)) throw new CallbackFailure(extractAfter(result), extractPartialAfter(result));
  } catch (error) {
    const knownNoChange = mutationFailureKnownNoChange(mutationFailureValue) || mutationFailureKnownNoChange(error);
    const observedAfter = extractPartialAfter(error) ?? extractPartialAfter(mutationFailureValue);
    if (prepared.rollback.required && !knownNoChange) {
      return reconcileAfterFailure(executable, prepared, MUTATION_RECOVERY_PLAN, observedAfter);
    }
    const failed = await recordFailed(executable, prepared, 'ACTION_RECEIPT_MUTATION_FAILED');
    return failure('ACTION_RECEIPT_MUTATION_FAILED', failed);
  }

  let after: ActionReceiptAfter;
  try {
    const result = await executable.postcondition({ receipt: prepared, phase: 'postcondition' });
    if (callbackReportedFailure(result)) throw new CallbackFailure(extractAfter(result), extractPartialAfter(result));
    const resolved = extractAfter(result);
    if (resolved === undefined) throw new CallbackFailure();
    after = resolved;
    if (after.outcome === 'partial') throw new CallbackFailure(after, after);
  } catch (error) {
    return reconcileAfterFailure(
      executable,
      prepared,
      FINALIZATION_RECOVERY_PLAN,
      extractPartialAfter(error),
    );
  }

  let commitAt: string;
  try {
    commitAt = lifecycleAt(prepared.times.preparedAt, executable.now);
  } catch {
    return reconcileAfterFailure(executable, prepared, FINALIZATION_RECOVERY_PLAN, after);
  }
  const committed = await attemptTransition(executable.store, prepared.id, {
    to: 'committed',
    at: commitAt,
    validation: passedValidation(prepared),
    rollbackStatus: rollbackStatusFor(prepared, 'available'),
    after,
  });
  if (committed.callError !== undefined) {
    if (committed.reconciledExact && committed.receipt?.status === 'committed') return success(committed.receipt);
    return reconcileAfterFailure(executable, prepared, FINALIZATION_RECOVERY_PLAN, committed.receipt?.after ?? after);
  }
  if (committed.receipt?.status !== 'committed') {
    return reconcileAfterFailure(executable, prepared, FINALIZATION_RECOVERY_PLAN, after);
  }
  return success(committed.receipt);
}
