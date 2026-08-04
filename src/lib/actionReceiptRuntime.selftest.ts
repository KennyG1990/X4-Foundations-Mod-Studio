import {
  bindDeterministicRecoveryReference,
  combineReceiptResourceBeforeHashes,
  hashBoundedReceiptFacts,
  mapRuntimeReceiptIdentity,
  type ActionReceiptRuntimeError,
} from './actionReceiptRuntime';
import {
  createPreparedActionReceipt,
  type ActionReceiptPrepareInput,
} from './actionReceipt';
import type { ActionReceiptCoverageResolverResult } from './actionReceiptCoverage';

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);
const HASH_C = 'c'.repeat(64);
const WORKSPACE_ID = 'ws_111111111111111111111111';

interface SelftestCheck {
  name: string;
  pass: boolean;
  detail?: string;
}

export interface ActionReceiptRuntimeSelftestResult {
  allPassed: boolean;
  pass: boolean;
  passed: number;
  total: number;
  failures: string[];
  checks: SelftestCheck[];
}

function expectReject(value: () => unknown, code?: string): boolean {
  try {
    value();
    return false;
  } catch (error) {
    const candidate = error as Partial<ActionReceiptRuntimeError>;
    return error instanceof Error
      && (code === undefined || candidate.code === code)
      && !/x4fk_|bearer|secret-value|raw-body|C:\\secret|\/tmp\/secret/i.test(error.message);
  }
}

function fixtureInput(required: boolean): ActionReceiptPrepareInput {
  const workspaceResource = {
    role: 'workspace' as const,
    root: 'workspace',
    relativePath: `${WORKSPACE_ID}/content`,
    beforeHash: HASH_A,
  };
  const snapshotResource = {
    role: 'snapshot' as const,
    root: 'workspace',
    relativePath: `${WORKSPACE_ID}/snapshot`,
    beforeHash: HASH_B,
  };
  return {
    actor: { kind: 'agent', id: 'key_runtime_selftest' },
    client: { channel: 'api', id: 'agent_runtime_selftest', version: '1.0.0' },
    capability: { id: 'forge.w3b1a.runtime-selftest', version: '1.0.0' },
    authority: {
      scope: 'workspace',
      operationId: 'runtime-binding-selftest',
      workspaceId: WORKSPACE_ID,
      requestScope: 'w3b1a-runtime-selftest',
      resources: [workspaceResource, snapshotResource],
    },
    effects: {
      declared: [
        { id: 'write-workspace', operation: 'update', resource: workspaceResource, reversible: required },
        { id: 'write-snapshot', operation: 'update', resource: snapshotResource, reversible: required },
      ],
    },
    input: { requestHash: HASH_C, beforeHash: HASH_A },
    validation: { validator: 'forge.w3b1a.runtime-selftest' },
    rollback: required
      ? { required: true, mode: 'recovery', reference: 'legacy-recovery-reference' }
      : { required: false, mode: 'none' },
    preparedAt: '2026-08-03T00:00:00.000Z',
  };
}

export function runActionReceiptRuntimeSelftest(): ActionReceiptRuntimeSelftestResult {
  const checks: SelftestCheck[] = [];
  const check = (name: string, pass: boolean, detail?: unknown): void => {
    checks.push({ name, pass: !!pass, ...(detail === undefined ? {} : { detail: String(detail) }) });
  };

  const studio = mapRuntimeReceiptIdentity({ kind: 'studio', clientId: 'client_tab12345', version: '0.0.62' });
  check('studio_maps_human_and_tab_client', studio.actor.kind === 'human'
    && studio.actor.id === 'studio'
    && studio.client.channel === 'studio'
    && studio.client.id === 'client_tab12345'
    && studio.client.version === '0.0.62');

  const agentExplicit = mapRuntimeReceiptIdentity({
    kind: 'agent', keyId: 'key_runtime123', clientId: 'agent-worker', version: '1.2.3',
  });
  check('agent_maps_key_record_and_explicit_client', agentExplicit.actor.kind === 'agent'
    && agentExplicit.actor.id === 'key_runtime123'
    && agentExplicit.client.channel === 'api'
    && agentExplicit.client.id === 'agent-worker');

  const agentFallback = mapRuntimeReceiptIdentity({ kind: 'agent', keyId: 'key_runtime123', version: '1.2.3' });
  const agentFallbackAgain = mapRuntimeReceiptIdentity({ kind: 'agent', keyId: 'key_runtime123', version: '1.2.3' });
  check('agent_fallback_is_deterministic_and_nonsecret', agentFallback.client.id === agentFallbackAgain.client.id
    && agentFallback.client.id !== 'key_runtime123'
    && !agentFallback.client.id.includes('runtime123'));

  check('studio_client_id_is_required', expectReject(
    () => mapRuntimeReceiptIdentity({ kind: 'studio', version: '1.0.0' }),
    'ACTION_RECEIPT_RUNTIME_IDENTITY_MISSING',
  ));
  check('studio_client_id_shape_is_checked', expectReject(
    () => mapRuntimeReceiptIdentity({ kind: 'studio', clientId: 'client_short', version: '1.0.0' }),
    'ACTION_RECEIPT_RUNTIME_CLIENT_ID_INVALID',
  ));
  check('agent_key_id_is_required', expectReject(
    () => mapRuntimeReceiptIdentity({ kind: 'agent', version: '1.0.0' }),
    'ACTION_RECEIPT_RUNTIME_IDENTITY_MISSING',
  ));
  check('agent_key_id_shape_is_checked', expectReject(
    () => mapRuntimeReceiptIdentity({ kind: 'agent', keyId: 'x4fk_plaintext-token', version: '1.0.0' }),
    'ACTION_RECEIPT_RUNTIME_KEY_ID_INVALID',
  ));
  check('credential_shaped_client_is_rejected', expectReject(
    () => mapRuntimeReceiptIdentity({ kind: 'agent', keyId: 'key_runtime123', clientId: 'token:value', version: '1.0.0' }),
    'ACTION_RECEIPT_RUNTIME_CLIENT_ID_INVALID',
  ));
  check('version_shape_is_checked', expectReject(
    () => mapRuntimeReceiptIdentity({ kind: 'studio', clientId: 'client_tab12345', version: '1/0' }),
    'ACTION_RECEIPT_RUNTIME_VERSION_INVALID',
  ));
  check('labels_are_not_runtime_identity', expectReject(
    () => mapRuntimeReceiptIdentity({ kind: 'agent', keyId: 'key_runtime123', label: 'friendly label', version: '1.0.0' }),
    'ACTION_RECEIPT_RUNTIME_IDENTITY_INVALID',
  ));
  check('cli_channel_is_not_accepted', expectReject(
    () => mapRuntimeReceiptIdentity({ channel: 'cli', clientId: 'client_tab12345', version: '1.0.0' }),
    'ACTION_RECEIPT_RUNTIME_CHANNEL_UNSUPPORTED',
  ));
  check('source_discriminator_is_supported_without_labels', mapRuntimeReceiptIdentity({
    source: 'studio', clientId: 'client_tab12345', validatedVersion: '1.0.0',
  }).client.channel === 'studio');

  const factsA = { z: 1, a: { b: true, c: null }, list: [1, 'x'] };
  const factsB = { list: [1, 'x'], a: { c: null, b: true }, z: 1 };
  check('bounded_fact_hash_is_64_hex', /^[a-f0-9]{64}$/.test(hashBoundedReceiptFacts(factsA)));
  check('bounded_fact_hash_is_key_order_stable', hashBoundedReceiptFacts(factsA) === hashBoundedReceiptFacts(factsB));
  check('bounded_fact_hash_detects_material_change', hashBoundedReceiptFacts(factsA) !== hashBoundedReceiptFacts({ ...factsA, z: 2 }));
  check('bounded_fact_hash_accepts_json_array', /^[a-f0-9]{64}$/.test(hashBoundedReceiptFacts([null, false, 0, 'x'])));
  check('undefined_is_rejected', expectReject(() => hashBoundedReceiptFacts(undefined), 'ACTION_RECEIPT_RUNTIME_FACTS_INVALID'));
  check('non_plain_object_is_rejected', expectReject(() => hashBoundedReceiptFacts(new Date()), 'ACTION_RECEIPT_RUNTIME_FACTS_INVALID'));
  check('function_is_rejected', expectReject(() => hashBoundedReceiptFacts(() => undefined), 'ACTION_RECEIPT_RUNTIME_FACTS_INVALID'));
  check('symbol_is_rejected', expectReject(() => hashBoundedReceiptFacts(Symbol('secret-value')), 'ACTION_RECEIPT_RUNTIME_FACTS_INVALID'));
  check('bigint_is_rejected', expectReject(() => hashBoundedReceiptFacts(BigInt(1)), 'ACTION_RECEIPT_RUNTIME_FACTS_INVALID'));
  check('nonfinite_is_rejected', expectReject(() => hashBoundedReceiptFacts(Number.NaN), 'ACTION_RECEIPT_RUNTIME_FACTS_INVALID'));
  const cyclic: { self?: unknown } = {};
  cyclic.self = cyclic;
  check('cyclic_facts_are_rejected', expectReject(() => hashBoundedReceiptFacts(cyclic), 'ACTION_RECEIPT_RUNTIME_FACTS_INVALID'));
  const deepFacts = {
    a: {
      b: {
        c: {
          d: {
            e: {
              f: {
                g: {
                  h: { i: 1 },
                },
              },
            },
          },
        },
      },
    },
  };
  check('deep_facts_are_bounded', expectReject(() => hashBoundedReceiptFacts(deepFacts), 'ACTION_RECEIPT_RUNTIME_FACTS_LIMIT'));
  check('large_fact_arrays_are_bounded', expectReject(() => hashBoundedReceiptFacts(Array.from({ length: 129 }, () => 1)), 'ACTION_RECEIPT_RUNTIME_FACTS_LIMIT'));

  const resourceA = { role: 'workspace' as const, root: 'workspace', relativePath: `${WORKSPACE_ID}/content`, beforeHash: HASH_A };
  const resourceB = { role: 'snapshot' as const, root: 'workspace', relativePath: `${WORKSPACE_ID}/snapshot`, beforeHash: HASH_B };
  const resourceHash = combineReceiptResourceBeforeHashes([resourceA, resourceB]);
  check('resource_before_hash_is_64_hex', /^[a-f0-9]{64}$/.test(resourceHash));
  check('resource_before_hash_is_order_stable', resourceHash === combineReceiptResourceBeforeHashes([resourceB, resourceA]));
  check('resource_before_hash_detects_material_change', resourceHash !== combineReceiptResourceBeforeHashes([
    resourceA,
    { ...resourceB, beforeHash: HASH_C },
  ]));
  check('resource_before_hash_rejects_duplicate', expectReject(
    () => combineReceiptResourceBeforeHashes([resourceA, resourceA]),
    'ACTION_RECEIPT_RUNTIME_RESOURCE_DUPLICATE',
  ));
  check('resource_before_hash_rejects_legacy_hash', expectReject(
    () => combineReceiptResourceBeforeHashes([{ ...resourceA, beforeHash: 'a'.repeat(16) }]),
    'ACTION_RECEIPT_RUNTIME_RESOURCE_HASH_INVALID',
  ));
  check('resource_before_hash_rejects_traversal', expectReject(
    () => combineReceiptResourceBeforeHashes([{ ...resourceA, relativePath: `${WORKSPACE_ID}/../content` }]),
    'ACTION_RECEIPT_RUNTIME_RESOURCE_INVALID',
  ));

  const originalPolicy: Extract<ActionReceiptCoverageResolverResult, { policy: 'receipt-required' }> = {
    policy: 'receipt-required',
    prepareInput: fixtureInput(true),
  };
  const originalSerialized = JSON.stringify(originalPolicy);
  const bound = bindDeterministicRecoveryReference(originalPolicy);
  const finalPrepare = bound.policy === 'receipt-required' ? bound.prepareInput : null;
  const finalReceipt = finalPrepare ? createPreparedActionReceipt(finalPrepare) : null;
  check('recovery_reference_is_receipt_id', !!finalPrepare?.rollback.reference
    && /^ar_[a-f0-9]{64}$/.test(finalPrepare.rollback.reference)
    && finalReceipt?.id === finalPrepare.rollback.reference);
  check('recovery_binding_is_non_circular', !!finalPrepare
    && !JSON.stringify(finalPrepare).includes('recovery-pending')
    && finalReceipt?.id === (finalPrepare.rollback.reference ?? ''));
  check('recovery_binding_does_not_mutate_policy', JSON.stringify(originalPolicy) === originalSerialized
    && bound !== originalPolicy
    && bound.policy === 'receipt-required'
    && bound.prepareInput !== originalPolicy.prepareInput);

  const nonRequired: Extract<ActionReceiptCoverageResolverResult, { policy: 'receipt-required' }> = {
    policy: 'receipt-required',
    prepareInput: fixtureInput(false),
  };
  check('nonrequired_recovery_binding_is_semantically_unchanged', bindDeterministicRecoveryReference(nonRequired) === nonRequired);
  const exempt: ActionReceiptCoverageResolverResult = { policy: 'receipt-exempt' };
  const refused: ActionReceiptCoverageResolverResult = {
    policy: 'refused',
    code: 'ACTION_RECEIPT_COVERAGE_POLICY_REFUSED',
    message: 'refused by reviewed policy',
  };
  check('exempt_policy_is_unchanged', bindDeterministicRecoveryReference(exempt) === exempt);
  check('refused_policy_is_unchanged', bindDeterministicRecoveryReference(refused) === refused);

  const failures = checks.filter(item => !item.pass).map(item => item.name);
  const passed = checks.length - failures.length;
  return {
    allPassed: failures.length === 0,
    pass: failures.length === 0,
    passed,
    total: checks.length,
    failures,
    checks,
  };
}

const invokedDirectly = process.argv[1]?.endsWith('actionReceiptRuntime.selftest.ts') === true;
if (invokedDirectly) {
  const result = runActionReceiptRuntimeSelftest();
  console.log(JSON.stringify(result, null, 2));
  if (!result.allPassed) process.exitCode = 1;
}
