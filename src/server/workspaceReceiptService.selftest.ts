/** Focused W3B1a service oracle. */

import path from 'node:path';
import {
  assertValidActionReceipt,
  canonicalJson,
  createPreparedActionReceipt,
  transitionActionReceipt,
  type ActionReceipt,
  type ActionReceiptAfter,
  type ActionReceiptPrepareInput,
  type ActionReceiptTransitionInput,
} from '../lib/actionReceipt';
import {
  bindDeterministicRecoveryReference,
  hashBoundedReceiptFacts,
  mapRuntimeReceiptIdentity,
} from '../lib/actionReceiptRuntime';
import {
  loadActionReceiptPolicyBundle,
} from '../lib/actionReceiptPolicyBundle';
import {
  resolveActionReceiptPolicy,
  type DiscoveredActionReceiptCoverageInventory,
} from '../lib/actionReceiptCoverage';
import type {
  ActionReceiptTransactionStore,
} from '../lib/actionReceiptTransaction';
import {
  WorkspaceReceiptService,
  runWorkspaceReceiptTransaction,
  type WorkspaceReceiptAuthorityInput,
  type WorkspaceReceiptServiceResult,
  type WorkspaceReceiptTransactionDescription,
} from './workspaceReceiptService';

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);
const HASH_C = 'c'.repeat(64);
const HASH_D = 'd'.repeat(64);
const ROUTE_KEY = 'POST /api/agent/history/:id/revert';
const WORKSPACE_REPLACE_ROUTE_KEY = 'POST /api/agent/workspace';
const WORKSPACE_ID = 'ws_111111111111111111111111';

export interface WorkspaceReceiptServiceSelftestCheck {
  name: string;
  pass: boolean;
  detail?: string;
}

export interface WorkspaceReceiptServiceSelftestResult {
  allPassed: boolean;
  pass: boolean;
  passed: number;
  total: number;
  checks: WorkspaceReceiptServiceSelftestCheck[];
}

class MemoryReceiptStore implements ActionReceiptTransactionStore {
  readonly records = new Map<string, ActionReceipt>();
  failPrepareCode?: string;
  failBeforeTransitionTo?: ActionReceiptTransitionInput['to'];
  failAfterTransitionTo?: ActionReceiptTransitionInput['to'];

  prepareWithDisposition(input: ActionReceiptPrepareInput): { receipt: ActionReceipt; created: boolean } {
    if (this.failPrepareCode !== undefined) throw fixtureError(this.failPrepareCode);
    const candidate = createPreparedActionReceipt(input);
    const existing = this.records.get(candidate.id);
    if (existing !== undefined) {
      if (existing.authorityHash !== candidate.authorityHash) throw fixtureError('RECEIPT_DUPLICATE_CONFLICT');
      return { receipt: existing, created: false };
    }
    this.records.set(candidate.id, candidate);
    return { receipt: candidate, created: true };
  }

  read(id: string): ActionReceipt {
    const receipt = this.records.get(id);
    if (receipt === undefined) throw fixtureError('RECEIPT_NOT_FOUND');
    return receipt;
  }

  transition(id: string, input: ActionReceiptTransitionInput): ActionReceipt {
    if (this.failBeforeTransitionTo === input.to) throw fixtureError('RECEIPT_STORE_WRITE_FAILED');
    const current = this.read(id);
    const next = transitionActionReceipt(current, input);
    this.records.set(id, next);
    if (this.failAfterTransitionTo === input.to) throw fixtureError('RECEIPT_STORE_WRITE_FAILED');
    return next;
  }
}

function fixtureError(code: string): Error & { code: string } {
  const error = new Error('fixture failure') as Error & { code: string };
  error.code = code;
  return error;
}

function resource(beforeHash: string) {
  return {
    role: 'workspace' as const,
    root: 'workspace',
    relativePath: 'state.json',
    beforeHash,
  };
}

function afterFor(receipt: ActionReceipt, outcome: ActionReceiptAfter['outcome'], hash = HASH_C): ActionReceiptAfter {
  return {
    outcome,
    resources: receipt.authority.resources.map(item => ({
      role: item.role,
      root: item.root,
      relativePath: item.relativePath,
      hash: outcome === 'no_change' ? item.beforeHash ?? HASH_B : hash,
    })),
  };
}

function authorityFor(beforeHash: string): WorkspaceReceiptAuthorityInput {
  return {
    scope: 'workspace',
    workspaceId: WORKSPACE_ID,
    requestScope: 'w3b1a-selftest',
    resources: [resource(beforeHash)],
  };
}

function fixture(
  store: MemoryReceiptStore,
  operationId: unknown,
  options: {
    beforeHash?: string;
    requestHash?: string;
    metadataMessage?: string;
    effectOperation?: string;
    effectReversible?: boolean;
    rollback?: WorkspaceReceiptTransactionDescription['rollback'];
    routeKey?: string;
    declaredEffectIds?: string[];
    serializationKey?: string;
    callbacks?: Partial<WorkspaceReceiptTransactionDescription['callbacks']>;
    mayMutate?: WorkspaceReceiptTransactionDescription['mayMutate'];
  } = {},
): WorkspaceReceiptTransactionDescription {
  const beforeHash = options.beforeHash ?? HASH_B;
  const requestHash = options.requestHash ?? HASH_A;
  const authority = authorityFor(beforeHash);
  const effectResource = resource(beforeHash);
  const callbacks = {
    mutate: async () => undefined,
    postcondition: async ({ receipt }: { receipt: ActionReceipt }) => afterFor(receipt, 'applied'),
    rollback: async () => undefined,
    ...options.callbacks,
  };
  return {
    routeKey: options.routeKey ?? ROUTE_KEY,
    operationId,
    identity: { kind: 'agent', keyId: 'key_w3b1a_selftest', version: '1.0.0' },
    authority,
    declaredEffects: (options.declaredEffectIds ?? [
      'workspace-write',
      'filesystem-write',
      'deploy',
      'delete',
      'audit-write',
      'audit-retention-delete',
    ]).map(id => ({
      id,
      operation: options.effectOperation ?? 'replace',
      resource: effectResource,
      reversible: options.effectReversible ?? true,
    })),
    requestHash,
    beforeHash,
    validation: { validator: 'forge.w3b1a.service-selftest', ruleHash: HASH_D },
    rollback: options.rollback ?? { required: true, mode: 'recovery' },
    metadata: { operation: 'update', message: options.metadataMessage ?? 'service fixture' },
    store,
    callbacks,
    now: () => Date.parse('2026-08-03T00:10:00.000Z'),
    ...(options.mayMutate === undefined ? {} : { mayMutate: options.mayMutate }),
    serializationKey: options.serializationKey ?? 'workspace-w3b1a',
  };
}

function inputForCandidate(description: WorkspaceReceiptTransactionDescription): ActionReceiptPrepareInput {
  const identity = mapRuntimeReceiptIdentity(description.identity);
  const bundle = loadActionReceiptPolicyBundle();
  const authority = description.authority.scope === 'global'
    ? {
        scope: 'global' as const,
        operationId: description.operationId as string,
        requestScope: description.authority.requestScope,
        resources: [...description.authority.resources],
      }
    : description.authority.scope === 'profile'
      ? {
          scope: 'profile' as const,
          operationId: description.operationId as string,
          profileId: description.authority.profileId,
          requestScope: description.authority.requestScope,
          resources: [...description.authority.resources],
        }
      : {
          scope: 'workspace' as const,
          operationId: description.operationId as string,
          workspaceId: description.authority.workspaceId,
          requestScope: description.authority.requestScope,
          resources: [...description.authority.resources],
        };
  const resolved = resolveActionReceiptPolicy(bundle.manifest, {
    inventory: bundle.inventory as unknown as DiscoveredActionReceiptCoverageInventory,
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
  if (resolved.policy !== 'receipt-required') throw new Error('fixture policy is not receipt-required');
  const bound = bindDeterministicRecoveryReference(resolved);
  if (bound.policy !== 'receipt-required') throw new Error('fixture recovery policy is not receipt-required');
  return bound.prepareInput;
}

function candidateFor(description: WorkspaceReceiptTransactionDescription): ActionReceipt {
  return createPreparedActionReceipt(inputForCandidate(description));
}

function projectionKeys(result: WorkspaceReceiptServiceResult): boolean {
  if (result.receipt === undefined) return false;
  return Object.keys(result.receipt).sort().join(',') === 'hash,id,status';
}

function sameProjection(left: WorkspaceReceiptServiceResult, right: WorkspaceReceiptServiceResult): boolean {
  return canonicalJson(left.receipt ?? null) === canonicalJson(right.receipt ?? null);
}

function delay(milliseconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function withTimeout<T>(promise: Promise<T>, milliseconds = 1500): Promise<T | undefined> {
  return Promise.race([
    promise,
    delay(milliseconds).then(() => undefined),
  ]);
}

export async function runWorkspaceReceiptServiceSelftest(): Promise<WorkspaceReceiptServiceSelftestResult> {
  const checks: WorkspaceReceiptServiceSelftestCheck[] = [];
  const ok = (name: string, pass: boolean, detail?: unknown) => checks.push({
    name,
    pass,
    ...(detail === undefined ? {} : { detail: String(detail) }),
  });

  try {
    let unavailableCallbacks = 0;
    const unavailable = new WorkspaceReceiptService({
      policyBundleLoader: () => { throw new Error('policy unavailable'); },
    });
    const unavailableResult = await unavailable.execute(fixture(new MemoryReceiptStore(), 'w3b1a-policy-unavailable', {
      callbacks: { mutate: async () => { unavailableCallbacks += 1; } },
    }));
    ok('policy_unavailable_is_fail_closed_before_callbacks', unavailableResult.ok === false
      && unavailableResult.code === 'ACTION_RECEIPT_POLICY_BUNDLE_UNAVAILABLE'
      && unavailableCallbacks === 0);

    let invalidOperationCallbacks = 0;
    const invalidOperationService = new WorkspaceReceiptService();
    for (const [caseName, operationId] of [
      ['missing', undefined],
      ['empty', ''],
      ['malformed_path', 'operation/with/path'],
    ] as const) {
      const result = await invalidOperationService.execute(fixture(new MemoryReceiptStore(), operationId, {
        callbacks: { mutate: async () => { invalidOperationCallbacks += 1; } },
      }));
      ok(`operation_id_${caseName}_is_refused`, result.ok === false
        && result.code === 'ACTION_RECEIPT_OPERATION_ID_INVALID');
    }
    ok('invalid_operation_ids_do_not_call_callbacks', invalidOperationCallbacks === 0);

    let invalidKeyCallbacks = 0;
    const invalidKeyResult = await new WorkspaceReceiptService().execute(fixture(new MemoryReceiptStore(), 'w3b1a-invalid-key', {
      serializationKey: 'workspace/key',
      callbacks: { mutate: async () => { invalidKeyCallbacks += 1; } },
    }));
    ok('malformed_serialization_key_fails_before_callbacks', invalidKeyResult.ok === false
      && invalidKeyResult.code === 'ACTION_RECEIPT_SERIALIZATION_KEY_INVALID'
      && invalidKeyCallbacks === 0);

    let invalidBundleCallbacks = 0;
    const invalidBundleService = new WorkspaceReceiptService({
      policyBundle: { schema: 'invalid' } as never,
    });
    const invalidBundleResult = await invalidBundleService.execute(fixture(new MemoryReceiptStore(), 'w3b1a-invalid-bundle', {
      callbacks: { mutate: async () => { invalidBundleCallbacks += 1; } },
    }));
    ok('malformed_injected_policy_bundle_fails_closed_before_callbacks', invalidBundleResult.ok === false
      && invalidBundleResult.code === 'ACTION_RECEIPT_POLICY_BUNDLE_INVALID'
      && invalidBundleCallbacks === 0);

    const currentBundle = loadActionReceiptPolicyBundle();
    const currentWorkspaceRoute = currentBundle.manifest.routes.find(route => route.routeKey === WORKSPACE_REPLACE_ROUTE_KEY);
    if (currentWorkspaceRoute?.capability.kind !== 'reviewed-legacy') {
      throw new Error('workspace replace route is not reviewed-legacy');
    }
    const currentReviewRef = currentWorkspaceRoute.capability.reviewRef;
    const normalizedReviewRef = `review_${hashBoundedReceiptFacts({ kind: 'review-ref', value: currentReviewRef })}`;
    const normalizedReviewStore = new MemoryReceiptStore();
    const normalizedReviewResult = await new WorkspaceReceiptService({ policyBundle: currentBundle }).execute(fixture(
      normalizedReviewStore,
      'w3b1a-review-ref-normalized',
      { routeKey: WORKSPACE_REPLACE_ROUTE_KEY, declaredEffectIds: ['workspace-write'] },
    ));
    const normalizedReviewReceipt = normalizedReviewResult.receipt === undefined
      ? undefined
      : normalizedReviewStore.read(normalizedReviewResult.receipt.id);
    ok('invalid_reviewed_legacy_review_ref_is_deterministically_normalized',
      !/^[a-zA-Z][a-zA-Z0-9._:-]{0,127}$/.test(currentReviewRef)
      && /^review_[a-f0-9]{64}$/.test(normalizedReviewRef)
      && normalizedReviewResult.ok
      && normalizedReviewReceipt?.status === 'committed'
      && 'legacyRoute' in normalizedReviewReceipt.capability
      && normalizedReviewReceipt.capability.reviewRef === normalizedReviewRef);

    const validReviewRef = 'review_workspace_replace.v1';
    const validReviewBundle = {
      ...currentBundle,
      manifest: {
        ...currentBundle.manifest,
        routes: currentBundle.manifest.routes.map(route =>
          route.routeKey === WORKSPACE_REPLACE_ROUTE_KEY
            && route.capability.kind === 'reviewed-legacy'
            ? {
                ...route,
                capability: {
                  ...route.capability,
                  reviewRef: validReviewRef,
                },
              }
            : route),
      },
    };
    const preservedReviewStore = new MemoryReceiptStore();
    const preservedReviewResult = await new WorkspaceReceiptService({ policyBundle: validReviewBundle }).execute(fixture(
      preservedReviewStore,
      'w3b1a-review-ref-preserved',
      { routeKey: WORKSPACE_REPLACE_ROUTE_KEY, declaredEffectIds: ['workspace-write'] },
    ));
    const preservedReviewReceipt = preservedReviewResult.receipt === undefined
      ? undefined
      : preservedReviewStore.read(preservedReviewResult.receipt.id);
    ok('valid_reviewed_legacy_review_ref_is_preserved_exactly',
      preservedReviewResult.ok
      && preservedReviewReceipt?.status === 'committed'
      && 'legacyRoute' in preservedReviewReceipt.capability
      && preservedReviewReceipt.capability.reviewRef === validReviewRef);

    const service = new WorkspaceReceiptService();
    const successStore = new MemoryReceiptStore();
    let successMutations = 0;
    const success = await runWorkspaceReceiptTransaction(fixture(successStore, 'w3b1a-service-success', {
      callbacks: { mutate: async () => { successMutations += 1; } },
    }), service);
    const reopened = success.ok ? assertValidActionReceipt(successStore.read(success.receipt.id)) : undefined;
    ok('successful_transaction_returns_committed_projection_and_reopens_exactly', success.ok
      && success.code === 'ACTION_RECEIPT_COMMITTED'
      && success.replayed === false
      && success.receipt.status === 'committed'
      && reopened !== undefined
      && reopened.id === success.receipt.id
      && reopened.hash === success.receipt.hash
      && reopened.status === success.receipt.status
      && successMutations === 1
      && projectionKeys(success));

    let replayMutations = 0;
    let replayRecovery = 0;
    const replayStore = new MemoryReceiptStore();
    const firstReplay = await service.execute(fixture(replayStore, 'w3b1a-exact-replay', {
      callbacks: {
        mutate: async () => { replayMutations += 1; },
        rollback: async () => { replayRecovery += 1; },
      },
    }));
    const secondReplay = await service.execute(fixture(replayStore, 'w3b1a-exact-replay', {
      beforeHash: HASH_C,
      effectReversible: false,
      rollback: { required: false, mode: 'none' },
      callbacks: {
        mutate: async () => { replayMutations += 1; },
        rollback: async () => { replayRecovery += 1; },
      },
    }));
    const firstReplayReceipt = firstReplay.receipt === undefined
      ? undefined
      : replayStore.read(firstReplay.receipt.id);
    ok('exact_replay_ignores_changed_current_before_and_lifecycle_facts', firstReplay.ok
      && secondReplay.ok
      && secondReplay.replayed
      && sameProjection(firstReplay, secondReplay)
      && replayMutations === 1
      && replayRecovery === 0);
    ok('first_execution_retains_truthful_recovery_lifecycle', firstReplayReceipt?.effects.declared.every(effect => effect.reversible)
      && firstReplayReceipt.rollback.required
      && firstReplayReceipt.rollback.mode === 'recovery'
      && firstReplayReceipt.rollback.status === 'available');

    const requestConflict = await service.execute(fixture(replayStore, 'w3b1a-exact-replay', {
      beforeHash: HASH_C,
      requestHash: HASH_D,
      effectReversible: false,
      rollback: { required: false, mode: 'none' },
    }));
    const effectConflict = await service.execute(fixture(replayStore, 'w3b1a-exact-replay', {
      beforeHash: HASH_C,
      effectOperation: 'merge',
    }));
    const metadataConflict = await service.execute(fixture(replayStore, 'w3b1a-exact-replay', {
      beforeHash: HASH_C,
      metadataMessage: 'changed metadata',
    }));
    ok('same_operation_changed_request_hash_conflicts', requestConflict.ok === false
      && requestConflict.code === 'ACTION_RECEIPT_DUPLICATE_CONFLICT'
      && requestConflict.replayed === false);
    ok('same_operation_changed_effect_conflicts', effectConflict.ok === false
      && effectConflict.code === 'ACTION_RECEIPT_DUPLICATE_CONFLICT');
    ok('same_operation_changed_metadata_conflicts', metadataConflict.ok === false
      && metadataConflict.code === 'ACTION_RECEIPT_DUPLICATE_CONFLICT');

    const preparedStore = new MemoryReceiptStore();
    const preparedDescription = fixture(preparedStore, 'w3b1a-prepared-replay');
    const prepared = candidateFor(preparedDescription);
    preparedStore.records.set(prepared.id, prepared);
    let preparedMutations = 0;
    const preparedReplay = await service.execute(fixture(preparedStore, 'w3b1a-prepared-replay', {
      callbacks: { mutate: async () => { preparedMutations += 1; } },
    }));
    ok('existing_prepared_is_stable_non_success_without_mutation', preparedReplay.ok === false
      && preparedReplay.code === 'ACTION_RECEIPT_PREPARED_REPLAY'
      && preparedReplay.replayed
      && preparedReplay.receipt === undefined
      && preparedMutations === 0);

    const failedReplayStore = new MemoryReceiptStore();
    let failedFirstMutations = 0;
    let failedSecondMutations = 0;
    const failedFirst = await service.execute(fixture(failedReplayStore, 'w3b1a-failed-replay', {
      mayMutate: () => false,
      callbacks: { mutate: async () => { failedFirstMutations += 1; } },
    }));
    const failedSecond = await service.execute(fixture(failedReplayStore, 'w3b1a-failed-replay', {
      callbacks: { mutate: async () => { failedSecondMutations += 1; } },
    }));
    ok('failed_terminal_replay_returns_exact_projection_without_mutation', failedFirst.ok === false
      && failedFirst.receipt?.status === 'failed'
      && failedSecond.ok === false
      && failedSecond.code === 'ACTION_RECEIPT_REPLAY'
      && failedSecond.replayed
      && sameProjection(failedFirst, failedSecond)
      && failedFirstMutations === 0
      && failedSecondMutations === 0);

    const concurrentStore = new MemoryReceiptStore();
    let concurrentMutations = 0;
    const concurrentDescription = (suffix: string) => fixture(concurrentStore, 'w3b1a-same-operation', {
      callbacks: {
        mutate: async () => {
          concurrentMutations += 1;
          await delay(5);
        },
        postcondition: async ({ receipt }) => afterFor(receipt, 'applied'),
      },
      metadataMessage: suffix,
    });
    const concurrentResults = await Promise.all([
      service.execute(concurrentDescription('same')),
      service.execute(concurrentDescription('same')),
    ]);
    ok('same_operation_concurrency_mutates_exactly_once', concurrentMutations === 1
      && concurrentResults.filter(result => !result.replayed).length === 1
      && concurrentResults.some(result => result.replayed)
      && concurrentResults.every(result => result.ok || result.code === 'ACTION_RECEIPT_REPLAY'));

    const serialStore = new MemoryReceiptStore();
    let releaseFirst!: () => void;
    let signalFirst!: () => void;
    const firstEntered = new Promise<boolean>(resolve => { signalFirst = () => resolve(true); });
    const firstRelease = new Promise<void>(resolve => { releaseFirst = resolve; });
    let secondPostconditionEntered = false;
    const serialFirst = fixture(serialStore, 'w3b1a-serial-a', {
      callbacks: {
        postcondition: async ({ receipt }) => {
          signalFirst();
          await firstRelease;
          return afterFor(receipt, 'applied');
        },
      },
      serializationKey: 'workspace-serial',
    });
    const serialSecond = fixture(serialStore, 'w3b1a-serial-b', {
      callbacks: {
        postcondition: async ({ receipt }) => {
          secondPostconditionEntered = true;
          return afterFor(receipt, 'applied');
        },
      },
      serializationKey: 'workspace-serial',
    });
    const serialFirstPromise = service.execute(serialFirst);
    const firstObserved = await withTimeout(firstEntered);
    const serialSecondPromise = service.execute(serialSecond);
    await delay(10);
    const secondWasHeld = !secondPostconditionEntered;
    releaseFirst();
    const serialResults = await Promise.all([serialFirstPromise, serialSecondPromise]);
    ok('different_operations_same_key_serialize_through_postcondition', firstObserved === true
      && secondWasHeld
      && serialResults.every(result => result.ok));

    const independentStore = new MemoryReceiptStore();
    let independentEntered = 0;
    let releaseIndependent!: () => void;
    let signalBoth!: () => void;
    const bothEntered = new Promise<boolean>(resolve => { signalBoth = () => resolve(true); });
    const independentRelease = new Promise<void>(resolve => { releaseIndependent = resolve; });
    const independentPostcondition = async ({ receipt }: { receipt: ActionReceipt }) => {
      independentEntered += 1;
      if (independentEntered === 2) signalBoth();
      await independentRelease;
      return afterFor(receipt, 'applied');
    };
    const independentA = service.execute(fixture(independentStore, 'w3b1a-independent-a', {
      callbacks: { postcondition: independentPostcondition },
      serializationKey: 'workspace-independent-a',
    }));
    const independentB = service.execute(fixture(independentStore, 'w3b1a-independent-b', {
      callbacks: { postcondition: independentPostcondition },
      serializationKey: 'workspace-independent-b',
    }));
    const bothObserved = await withTimeout(bothEntered);
    releaseIndependent();
    const independentResults = await Promise.all([independentA, independentB]);
    ok('different_keys_can_overlap', bothObserved === true
      && independentEntered === 2
      && independentResults.every(result => result.ok));

    const guardStore = new MemoryReceiptStore();
    let guardMutations = 0;
    let guardRecovery = 0;
    const guardResult = await service.execute(fixture(guardStore, 'w3b1a-may-mutate-refused', {
      mayMutate: () => false,
      callbacks: {
        mutate: async () => { guardMutations += 1; },
        rollback: async () => { guardRecovery += 1; },
      },
    }));
    ok('may_mutate_false_is_failed_with_zero_domain_change', guardResult.ok === false
      && guardResult.code === 'ACTION_RECEIPT_MUTATION_FAILED'
      && guardResult.receipt?.status === 'failed'
      && guardMutations === 0
      && guardRecovery === 0);

    const prepareFailureStore = new MemoryReceiptStore();
    prepareFailureStore.failPrepareCode = 'RECEIPT_STORE_WRITE_FAILED';
    let prepareFailureMutations = 0;
    const prepareFailure = await service.execute(fixture(prepareFailureStore, 'w3b1a-prepare-failure', {
      callbacks: { mutate: async () => { prepareFailureMutations += 1; } },
    }));
    ok('store_prepare_failure_has_zero_mutation', prepareFailure.ok === false
      && prepareFailureMutations === 0
      && prepareFailure.code === 'RECEIPT_STORE_WRITE_FAILED');

    const finalizationStore = new MemoryReceiptStore();
    finalizationStore.failBeforeTransitionTo = 'committed';
    let finalizationRecovery = 0;
    const finalization = await service.execute(fixture(finalizationStore, 'w3b1a-finalization-failure', {
      callbacks: {
        rollback: async () => { finalizationRecovery += 1; },
      },
    }));
    ok('finalization_failure_delegates_to_successful_rollback', finalization.ok === false
      && finalization.code === 'ACTION_RECEIPT_FINALIZATION_FAILED'
      && finalization.receipt?.status === 'rolled_back'
      && finalizationRecovery === 1);

    const rollbackFailureStore = new MemoryReceiptStore();
    rollbackFailureStore.failBeforeTransitionTo = 'committed';
    let rollbackFailureCalls = 0;
    const rollbackFailure = await service.execute(fixture(rollbackFailureStore, 'w3b1a-rollback-failure', {
      callbacks: {
        rollback: async ({ receipt }) => {
          rollbackFailureCalls += 1;
          return { ok: false, partialAfter: afterFor(receipt, 'partial') };
        },
      },
    }));
    ok('rollback_failure_delegates_to_incomplete_terminal', rollbackFailure.ok === false
      && rollbackFailure.code === 'ACTION_RECEIPT_ROLLBACK_FAILED'
      && rollbackFailure.receipt?.status === 'incomplete'
      && rollbackFailureCalls === 1);

    const resultShape = JSON.stringify(success);
    ok('result_contains_only_projection_and_no_receipt_payload', !resultShape.includes('actor')
      && !resultShape.includes('workspaceId')
      && !resultShape.includes('resources')
      && !resultShape.includes('metadata')
      && (success.receipt === undefined || Object.keys(success.receipt).sort().join(',') === 'hash,id,status'));
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

const invokedDirectly = path.basename(process.argv[1] ?? '') === 'workspaceReceiptService.selftest.ts';
if (invokedDirectly) {
  void runWorkspaceReceiptServiceSelftest()
    .then(result => {
      console.log(JSON.stringify(result, null, 2));
      if (!result.allPassed) process.exitCode = 1;
    })
    .catch(error => {
      console.log(JSON.stringify({
        allPassed: false,
        pass: false,
        passed: 0,
        total: 1,
        checks: [{
          name: 'selftest_unexpected_rejection',
          pass: false,
          detail: error instanceof Error ? error.message : String(error),
        }],
      }, null, 2));
      process.exitCode = 1;
    });
}
