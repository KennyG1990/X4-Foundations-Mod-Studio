/** Focused W3B1 pure transaction-kernel oracle. */

import path from 'path';
import {
  canonicalizeActionReceiptAuthority,
  canonicalJson,
  createPreparedActionReceipt,
  hashActionReceiptAuthority,
  transitionActionReceipt,
  type ActionReceipt,
  type ActionReceiptAfter,
  type ActionReceiptPrepareInput,
  type ActionReceiptTransitionInput,
} from './actionReceipt';
import {
  runActionReceiptTransaction,
  type ActionReceiptTransactionCallbacks,
  type ActionReceiptTransactionRequest,
  type ActionReceiptTransactionResult,
  type ActionReceiptTransactionStore,
} from './actionReceiptTransaction';

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);
const HASH_C = 'c'.repeat(64);
const PREPARED_AT = '2026-08-02T00:00:00.000Z';
const TRANSITION_AT = Date.parse('2026-08-02T00:10:00.000Z');

export interface ActionReceiptTransactionSelftestCheck {
  name: string;
  pass: boolean;
  detail?: string;
}

export interface ActionReceiptTransactionSelftestResult {
  allPassed: boolean;
  pass: boolean;
  passed: number;
  total: number;
  checks: ActionReceiptTransactionSelftestCheck[];
}

class FakeStoreError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = 'FakeStoreError';
    this.code = code;
  }
}

/** In-memory only: this fake exposes the same single-writer shape as ActionReceiptStore. */
class FakeStore implements ActionReceiptTransactionStore {
  readonly records = new Map<string, ActionReceipt>();
  readonly events: string[] = [];
  failPrepareCode?: string;
  failBeforeTransitionTo?: ActionReceiptTransitionInput['to'];
  failAfterTransitionTo?: ActionReceiptTransitionInput['to'];

  prepareWithDisposition(input: ActionReceiptPrepareInput): { receipt: ActionReceipt; created: boolean } {
    if (this.failPrepareCode !== undefined) throw new FakeStoreError(this.failPrepareCode);
    const candidate = createPreparedActionReceipt(input);
    const existing = this.records.get(candidate.id);
    if (existing !== undefined) {
      if (existing.authorityHash !== candidate.authorityHash) throw new FakeStoreError('RECEIPT_DUPLICATE_CONFLICT');
      return { receipt: existing, created: false };
    }
    this.records.set(candidate.id, candidate);
    this.events.push(`prepared:${candidate.id}`);
    return { receipt: candidate, created: true };
  }

  prepare(input: ActionReceiptPrepareInput): ActionReceipt {
    return this.prepareWithDisposition(input).receipt;
  }

  read(id: string): ActionReceipt {
    const receipt = this.records.get(id);
    if (receipt === undefined) throw new FakeStoreError('RECEIPT_NOT_FOUND');
    return receipt;
  }

  transition(id: string, input: ActionReceiptTransitionInput): ActionReceipt {
    if (this.failBeforeTransitionTo === input.to) {
      this.failBeforeTransitionTo = undefined;
      throw new FakeStoreError('RECEIPT_STORE_WRITE_FAILED');
    }
    const current = this.read(id);
    const next = transitionActionReceipt(current, input);
    this.records.set(id, next);
    this.events.push(`${input.to}:${id}`);
    if (this.failAfterTransitionTo === input.to) {
      this.failAfterTransitionTo = undefined;
      throw new FakeStoreError('RECEIPT_STORE_WRITE_FAILED');
    }
    return next;
  }
}

function fixture(operationId: string, overrides: Partial<ActionReceiptPrepareInput> = {}): ActionReceiptPrepareInput {
  const resource = {
    role: 'workspace' as const,
    root: 'workspace',
    relativePath: 'state.json',
    beforeHash: HASH_B,
  };
  return {
    actor: { kind: 'agent', id: 'w3b1-selftest' },
    client: { channel: 'harness', id: 'w3b1-selftest', version: '1.0.0' },
    capability: { id: 'forge.test.w3b1-transaction', version: '1.0.0' },
    authority: {
      scope: 'workspace',
      operationId,
      workspaceId: 'ws_111111111111111111111111',
      requestScope: 'w3b1-selftest',
      resources: [resource],
    },
    effects: {
      declared: [{ id: 'effect-write-state', operation: 'update', resource, reversible: true }],
    },
    input: { requestHash: HASH_A, beforeHash: HASH_B },
    validation: { validator: 'forge.w3b1.selftest' },
    rollback: { required: true, mode: 'recovery', reference: 'recovery-w3b1-selftest' },
    metadata: { operation: 'update', message: 'bounded fixture' },
    preparedAt: PREPARED_AT,
    ...overrides,
  };
}

function afterFor(receipt: ActionReceipt, outcome: ActionReceiptAfter['outcome'], hash = HASH_C): ActionReceiptAfter {
  return {
    outcome,
    resources: receipt.authority.resources.map(resource => ({
      role: resource.role,
      root: resource.root,
      relativePath: resource.relativePath,
      hash: outcome === 'no_change' ? resource.beforeHash ?? HASH_B : hash,
    })),
  };
}

function requiredRequest(
  input: ActionReceiptPrepareInput,
  store: FakeStore,
  overrides: Partial<ActionReceiptTransactionCallbacks> = {},
): ActionReceiptTransactionRequest {
  return {
    policy: 'receipt-required',
    prepareInput: input,
    store,
    mutate: () => undefined,
    postcondition: ({ receipt }) => afterFor(receipt, 'applied'),
    rollback: () => undefined,
    now: () => TRANSITION_AT,
    ...overrides,
  };
}

function isFailure(result: ActionReceiptTransactionResult, code?: string): boolean {
  return result.ok === false && (code === undefined || result.code === code);
}

function projectionIsExact(result: ActionReceiptTransactionResult): boolean {
  if (result.receipt === undefined) return false;
  return Object.keys(result.receipt).sort().join(',') === 'hash,id,status'
    && typeof result.receipt.id === 'string'
    && typeof result.receipt.hash === 'string'
    && typeof result.receipt.status === 'string';
}

function serializedStoreValue(store: FakeStore, operationId: string): string {
  const prepared = createPreparedActionReceipt(fixture(operationId));
  return JSON.stringify(store.records.get(prepared.id) ?? null);
}

export async function runActionReceiptTransactionSelftest(): Promise<ActionReceiptTransactionSelftestResult> {
  const checks: ActionReceiptTransactionSelftestCheck[] = [];
  const ok = (name: string, pass: boolean, detail?: unknown) => checks.push({
    name,
    pass,
    ...(detail === undefined ? {} : { detail: String(detail) }),
  });

  try {
    const propertyOrderA = fixture('tx-canonical-a', { metadata: { operation: 'update', message: 'bounded fixture' } });
    const propertyOrderB = {
      ...propertyOrderA,
      actor: { id: propertyOrderA.actor.id, kind: propertyOrderA.actor.kind },
      client: { version: propertyOrderA.client.version, id: propertyOrderA.client.id, channel: propertyOrderA.client.channel },
      authority: {
        ...propertyOrderA.authority,
        resources: [{ ...propertyOrderA.authority.resources[0] }],
      },
      metadata: { message: 'bounded fixture', operation: 'update' },
    };
    ok('canonical_hash_is_property_order_stable', hashActionReceiptAuthority(propertyOrderA) === hashActionReceiptAuthority(propertyOrderB)
      && canonicalizeActionReceiptAuthority(propertyOrderA) === canonicalizeActionReceiptAuthority(propertyOrderB));
    ok('canonical_json_has_sorted_object_keys', canonicalJson({ z: 1, a: { y: true, b: null } }) === '{"a":{"b":null,"y":true},"z":1}');

    let policyMutations = 0;
    const policyResult = await runActionReceiptTransaction({
      policy: 'refused',
      code: 'ACTION_RECEIPT_COVERAGE_POLICY_REFUSED',
      message: 'fixture refusal',
      mutate: () => { policyMutations += 1; },
    });
    ok('stable_policy_refusal_skips_mutation', isFailure(policyResult, 'ACTION_RECEIPT_COVERAGE_POLICY_REFUSED') && policyMutations === 0);

    const missingOperation = fixture('tx-missing-operation');
    delete (missingOperation.authority as unknown as Record<string, unknown>).operationId;
    let missingMutations = 0;
    const missingResult = await runActionReceiptTransaction(requiredRequest(missingOperation, new FakeStore(), {
      mutate: () => { missingMutations += 1; },
    }));
    ok('missing_operation_id_rejected_before_mutation', isFailure(missingResult, 'ACTION_RECEIPT_OPERATION_ID_INVALID') && missingMutations === 0);

    const malformedOperation = fixture('tx-malformed-operation');
    (malformedOperation.authority as { operationId: string }).operationId = 'not valid';
    let malformedMutations = 0;
    const malformedResult = await runActionReceiptTransaction(requiredRequest(malformedOperation, new FakeStore(), {
      mutate: () => { malformedMutations += 1; },
    }));
    ok('malformed_operation_id_rejected_before_mutation', isFailure(malformedResult, 'ACTION_RECEIPT_OPERATION_ID_INVALID') && malformedMutations === 0);

    const storeUnavailable = new FakeStore();
    storeUnavailable.failPrepareCode = 'RECEIPT_ROOT_UNAVAILABLE';
    let unavailableMutations = 0;
    const unavailableResult = await runActionReceiptTransaction(requiredRequest(fixture('tx-store-unavailable'), storeUnavailable, {
      mutate: () => { unavailableMutations += 1; },
    }));
    ok('store_unavailable_skips_mutation', isFailure(unavailableResult, 'RECEIPT_ROOT_UNAVAILABLE') && unavailableMutations === 0);

    const recoveryStore = new FakeStore();
    let recoveryMutations = 0;
    const recoveryResult = await runActionReceiptTransaction(requiredRequest(fixture('tx-recovery-failure'), recoveryStore, {
      mutate: () => { recoveryMutations += 1; },
      prepareRecovery: () => { throw new Error('recovery fixture failure'); },
    }));
    ok('recovery_failure_records_failed_and_skips_mutation', isFailure(recoveryResult, 'ACTION_RECEIPT_RECOVERY_FAILED')
      && recoveryResult.receipt === undefined && recoveryStore.records.size === 0 && recoveryMutations === 0);

    const mutationStore = new FakeStore();
    let mutationCount = 0;
    let mutationPostconditionCount = 0;
    let mutationRollbackCount = 0;
    const mutationResult = await runActionReceiptTransaction(requiredRequest(fixture('tx-mutation-failure'), mutationStore, {
      mutate: () => {
        mutationCount += 1;
        return { ok: false, changed: false };
      },
      postcondition: () => {
        mutationPostconditionCount += 1;
        return afterFor(createPreparedActionReceipt(fixture('tx-mutation-failure')), 'applied');
      },
      rollback: () => { mutationRollbackCount += 1; },
    }));
    ok('mutation_failure_records_failed_and_returns_non_success', isFailure(mutationResult, 'ACTION_RECEIPT_MUTATION_FAILED')
      && mutationResult.receipt?.status === 'failed' && projectionIsExact(mutationResult)
      && mutationCount === 1 && mutationPostconditionCount === 0 && mutationRollbackCount === 0);

    const noChangeStore = new FakeStore();
    const noChangeInput = fixture('tx-no-change');
    const noChangeResult = await runActionReceiptTransaction(requiredRequest(noChangeInput, noChangeStore, {
      postcondition: ({ receipt }) => afterFor(receipt, 'no_change'),
    }));
    const noChangePrepared = createPreparedActionReceipt(noChangeInput);
    const noChangeReceipt = noChangeStore.records.get(noChangePrepared.id);
    ok('no_change_is_committed_with_exact_before_hashes', noChangeResult.ok
      && noChangeReceipt?.status === 'committed'
      && noChangeReceipt.after?.outcome === 'no_change'
      && noChangeReceipt.after.resources.every((resource, index) => resource.hash === noChangeReceipt.authority.resources[index].beforeHash));
    ok('committed_projection_is_exact', noChangeResult.ok && projectionIsExact(noChangeResult));
    ok('success_persists_commit_before_return', noChangeResult.ok && noChangeStore.events.some(event => event.startsWith('committed:')));

    const payloadStore = new FakeStore();
    const payloadInput = fixture('tx-redaction', { metadata: { message: 'Bearer x4fk_fixture_secret_12345' } });
    const payloadResult = await runActionReceiptTransaction(requiredRequest(payloadInput, payloadStore, {
      mutate: () => ({ payload: 'RAW_PAYLOAD_SHOULD_NOT_BE_STORED' } as unknown as { ok: true }),
      postcondition: ({ receipt }) => afterFor(receipt, 'applied'),
    }));
    const payloadBytes = serializedStoreValue(payloadStore, 'tx-redaction');
    ok('redaction_and_no_payload_storage', payloadResult.ok
      && !payloadBytes.includes('RAW_PAYLOAD_SHOULD_NOT_BE_STORED')
      && !payloadBytes.includes('x4fk_fixture_secret_12345')
      && !JSON.stringify(payloadResult).includes('RAW_PAYLOAD_SHOULD_NOT_BE_STORED'));

    const duplicateStore = new FakeStore();
    const duplicateInput = fixture('tx-duplicate');
    const firstDuplicate = await runActionReceiptTransaction(requiredRequest(duplicateInput, duplicateStore, {
      postcondition: ({ receipt }) => afterFor(receipt, 'applied'),
    }));
    const conflictingInput = { ...duplicateInput, input: { requestHash: HASH_C, beforeHash: HASH_B } };
    let duplicateMutations = 0;
    const duplicateResult = await runActionReceiptTransaction(requiredRequest(conflictingInput, duplicateStore, {
      mutate: () => { duplicateMutations += 1; },
    }));
    ok('duplicate_operation_conflict_is_rejected_without_mutation', firstDuplicate.ok
      && isFailure(duplicateResult, 'ACTION_RECEIPT_DUPLICATE_CONFLICT') && duplicateMutations === 0);

    const replayStore = new FakeStore();
    const replayInput = fixture('tx-replay');
    await runActionReceiptTransaction(requiredRequest(replayInput, replayStore));
    let replayMutations = 0;
    const replayResult = await runActionReceiptTransaction(requiredRequest(replayInput, replayStore, {
      mutate: () => { replayMutations += 1; },
    }));
    ok('same_terminal_operation_reconciles_without_repeating_mutation', replayResult.ok && replayMutations === 0);

    const rollbackStore = new FakeStore();
    let rollbackMutations = 0;
    let rollbackCalls = 0;
    const rollbackResult = await runActionReceiptTransaction(requiredRequest(fixture('tx-finalization-rollback'), rollbackStore, {
      mutate: () => { rollbackMutations += 1; },
      postcondition: () => { throw new Error('postcondition fixture failure'); },
      rollback: () => { rollbackCalls += 1; },
    }));
    ok('finalization_failure_rolls_back_and_records_rolled_back', isFailure(rollbackResult, 'ACTION_RECEIPT_FINALIZATION_FAILED')
      && rollbackResult.receipt?.status === 'rolled_back' && projectionIsExact(rollbackResult)
      && rollbackMutations === 1 && rollbackCalls === 1);

    const incompleteStore = new FakeStore();
    const incompleteResult = await runActionReceiptTransaction(requiredRequest(fixture('tx-rollback-failure'), incompleteStore, {
      postcondition: () => { throw new Error('finalization fixture failure'); },
      rollback: ({ receipt }) => ({
        ok: false,
        partialAfter: afterFor(receipt, 'partial', HASH_C),
      }),
    }));
    const incompletePrepared = createPreparedActionReceipt(fixture('tx-rollback-failure'));
    const incompleteReceipt = incompleteStore.records.get(incompletePrepared.id);
    ok('rollback_failure_records_incomplete_partial_after', isFailure(incompleteResult, 'ACTION_RECEIPT_ROLLBACK_FAILED')
      && incompleteResult.receipt?.status === 'incomplete'
      && projectionIsExact(incompleteResult)
      && incompleteReceipt?.after?.outcome === 'partial'
      && incompleteReceipt.after.resources[0].hash === HASH_C);

    const reconcileFailureStore = new FakeStore();
    reconcileFailureStore.failAfterTransitionTo = 'failed';
    const reconcileFailureResult = await runActionReceiptTransaction(requiredRequest(fixture('tx-transition-reconcile-failed'), reconcileFailureStore, {
      mutate: () => ({ ok: false, changed: false }),
    }));
    ok('failed_transition_write_then_throw_is_read_reconciled', isFailure(reconcileFailureResult, 'ACTION_RECEIPT_MUTATION_FAILED')
      && reconcileFailureResult.receipt?.status === 'failed');

    const reconcileFinalizationStore = new FakeStore();
    reconcileFinalizationStore.failAfterTransitionTo = 'committed';
    let reconciledRollbackCalls = 0;
    const reconcileFinalizationResult = await runActionReceiptTransaction(requiredRequest(fixture('tx-transition-reconcile-commit'), reconcileFinalizationStore, {
      rollback: () => { reconciledRollbackCalls += 1; },
    }));
    ok('commit_write_then_throw_exact_reconciliation_is_success', reconcileFinalizationResult.ok
      && reconcileFinalizationResult.receipt?.status === 'committed' && reconciledRollbackCalls === 0);

    const failBeforeCommitStore = new FakeStore();
    failBeforeCommitStore.failBeforeTransitionTo = 'committed';
    let preState = 'before';
    let failBeforeRollbackCalls = 0;
    const failBeforeCommitResult = await runActionReceiptTransaction(requiredRequest(fixture('tx-finalization-fail-before'), failBeforeCommitStore, {
      mutate: () => { preState = 'after'; },
      rollback: () => {
        failBeforeRollbackCalls += 1;
        preState = 'before';
      },
    }));
    ok('commit_fail_before_write_rolls_back_exact_pre_state', isFailure(failBeforeCommitResult, 'ACTION_RECEIPT_FINALIZATION_FAILED')
      && failBeforeCommitResult.receipt?.status === 'rolled_back'
      && preState === 'before' && failBeforeRollbackCalls === 1);

    const mutationWriteStore = new FakeStore();
    let mutationState = 'before';
    let mutationWriteRollbackCalls = 0;
    const mutationWriteResult = await runActionReceiptTransaction(requiredRequest(fixture('tx-mutation-write-then-throw'), mutationWriteStore, {
      mutate: () => {
        mutationState = 'after';
        throw new Error('mutation wrote before throwing');
      },
      rollback: () => {
        mutationWriteRollbackCalls += 1;
        mutationState = 'before';
      },
    }));
    const mutationWritePrepared = createPreparedActionReceipt(fixture('tx-mutation-write-then-throw'));
    const mutationWriteReceipt = mutationWriteStore.records.get(mutationWritePrepared.id);
    ok('mutation_throw_after_write_rolls_back_exact_pre_state', isFailure(mutationWriteResult, 'ACTION_RECEIPT_MUTATION_FAILED')
      && mutationWriteResult.receipt?.status === 'rolled_back'
      && mutationWriteReceipt?.failure?.code === 'ACTION_RECEIPT_MUTATION_FAILED'
      && mutationState === 'before' && mutationWriteRollbackCalls === 1);

    const mutationIncompleteStore = new FakeStore();
    let partialMutationState = 'before';
    const mutationIncompleteResult = await runActionReceiptTransaction(requiredRequest(fixture('tx-mutation-rollback-failure'), mutationIncompleteStore, {
      mutate: () => {
        partialMutationState = 'after';
        throw new Error('mutation partial fixture failure');
      },
      rollback: ({ receipt }) => ({
        ok: false,
        partialAfter: afterFor(receipt, 'partial', HASH_C),
      }),
    }));
    ok('mutation_rollback_failure_records_incomplete_observed_state', isFailure(mutationIncompleteResult, 'ACTION_RECEIPT_MUTATION_FAILED')
      && mutationIncompleteResult.receipt?.status === 'incomplete'
      && partialMutationState === 'after');

    const sameOperationStore = new FakeStore();
    let sameOperationMutations = 0;
    const sameOperationInput = fixture('tx-same-operation-race');
    const sameOperationRequest = () => requiredRequest(sameOperationInput, sameOperationStore, {
      mutate: async () => {
        sameOperationMutations += 1;
        await Promise.resolve();
      },
    });
    const [sameOperationA, sameOperationB] = await Promise.all([
      runActionReceiptTransaction(sameOperationRequest()),
      runActionReceiptTransaction(sameOperationRequest()),
    ]);
    const sameOperationResults = [sameOperationA, sameOperationB];
    ok('same_operation_race_mutates_exactly_once', sameOperationMutations === 1
      && sameOperationResults.filter(result => result.ok).length === 1
      && sameOperationResults.some(result => isFailure(result, 'ACTION_RECEIPT_PREPARED_REPLAY')));

    const interleaveStore = new FakeStore();
    const interleaveReady: Record<string, () => void> = {};
    const interleaveWaiters: Record<string, Promise<void>> = {};
    for (const operationId of ['tx-interleave-a', 'tx-interleave-b']) {
      interleaveWaiters[operationId] = new Promise<void>(resolve => { interleaveReady[operationId] = resolve; });
    }
    const seenPhases: string[] = [];
    const interleaved = (operationId: string) => runActionReceiptTransaction(requiredRequest(fixture(operationId), interleaveStore, {
      postcondition: async ({ receipt }) => {
        seenPhases.push(`${operationId}:${receipt.authority.operationId}`);
        await interleaveWaiters[operationId];
        return afterFor(receipt, 'applied', operationId.endsWith('a') ? HASH_A : HASH_C);
      },
    }));
    const interleavedA = interleaved('tx-interleave-a');
    const interleavedB = interleaved('tx-interleave-b');
    await Promise.resolve();
    await Promise.resolve();
    interleaveReady['tx-interleave-b']();
    interleaveReady['tx-interleave-a']();
    const [interleaveResultA, interleaveResultB] = await Promise.all([interleavedA, interleavedB]);
    ok('interleaved_transactions_keep_request_local_receipts', interleaveResultA.ok && interleaveResultB.ok
      && interleaveResultA.receipt.id !== interleaveResultB.receipt.id
      && interleaveResultA.receipt.hash !== interleaveResultB.receipt.hash
      && seenPhases.includes('tx-interleave-a:tx-interleave-a')
      && seenPhases.includes('tx-interleave-b:tx-interleave-b'));
  } catch (error) {
    ok('selftest_unexpected_exception', false, error instanceof Error ? error.message : String(error));
  }

  const passed = checks.filter(check => check.pass).length;
  return {
    allPassed: passed === checks.length,
    pass: passed === checks.length,
    passed,
    total: checks.length,
    checks,
  };
}

const invokedDirectly = path.basename(process.argv[1] ?? '') === 'actionReceiptTransaction.selftest.ts';
if (invokedDirectly) {
  const result = await runActionReceiptTransactionSelftest();
  console.log(JSON.stringify(result, null, 2));
  if (!result.allPassed) process.exitCode = 1;
}
