/** Focused W3A oracle for the action-receipt schema, hash contract, and durable store. */

import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  attachActionReceiptToLedgerRow,
  projectActionReceiptToLedger,
} from './actionReceiptHistory';
import {
  ACTION_RECEIPT_SCHEMA,
  canonicalJson,
  canonicalizeActionReceiptAuthority,
  hashActionReceiptOperationIdentity,
  createPreparedActionReceipt,
  hashActionReceipt,
  hashActionReceiptAuthority,
  serializeActionReceipt,
  validateActionReceipt,
  type ActionReceipt,
  type ActionReceiptPrepareInput,
} from './actionReceipt';
import { encodeRow, decodeRows, type LedgerRow } from './agentHistory';
import { AgentHistoryStore } from './agentHistoryStore';
import { ActionReceiptStore } from './actionReceiptStore';

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);
const HASH_C = 'c'.repeat(64);
const HASH_D = 'd'.repeat(64);

export interface ActionReceiptSelftestCheck {
  name: string;
  pass: boolean;
  detail?: string;
}

export interface ActionReceiptSelftestResult {
  allPassed: boolean;
  pass: boolean;
  passed: number;
  total: number;
  checks: ActionReceiptSelftestCheck[];
}

type FixtureScope = 'global' | 'profile' | 'workspace';

function fixture(scope: FixtureScope = 'workspace', overrides: Partial<ActionReceiptPrepareInput> = {}): ActionReceiptPrepareInput {
  const resource = {
    role: scope === 'global' ? 'data' as const : scope === 'profile' ? 'profile' as const : 'workspace' as const,
    root: scope === 'global' ? 'data' : scope === 'profile' ? 'profile' : 'workspace',
    relativePath: 'canvas.json',
    beforeHash: HASH_B,
  };
  const authority: ActionReceiptPrepareInput['authority'] = scope === 'global'
    ? {
      scope,
      operationId: `op-${scope}-selftest`,
      requestScope: 'w3a-selftest',
      resources: [resource],
    }
    : scope === 'profile'
      ? {
        scope,
        operationId: `op-${scope}-selftest`,
        profileId: 'default',
        requestScope: 'w3a-selftest',
        resources: [resource],
      }
      : {
        scope,
        operationId: `op-${scope}-selftest`,
        workspaceId: 'ws_111111111111111111111111',
        requestScope: 'w3a-selftest',
        resources: [resource],
      };
  return {
    actor: { kind: 'agent', id: 'luna-executor' },
    client: { channel: 'harness', id: 'w3a-selftest', version: '1.0.0' },
    capability: { id: 'forge.test.action-receipt', version: '1.0.0' },
    authority,
    effects: {
      declared: [{ id: 'effect-update-canvas', operation: 'update', resource, reversible: true }],
    },
    input: { requestHash: HASH_A, beforeHash: HASH_B },
    validation: { validator: 'forge.w3a.selftest' },
    rollback: { required: true, mode: 'recovery', reference: 'recovery-w3a-selftest' },
    metadata: { operation: 'update', mode: 'selftest', message: 'bounded fixture' },
    preparedAt: '2026-08-02T00:00:00.000Z',
    ...overrides,
  };
}

function multiResourceFixture(): ActionReceiptPrepareInput {
  const resources = [
    { role: 'data' as const, root: 'workspace', relativePath: 'b.json', beforeHash: HASH_B },
    { role: 'data' as const, root: 'workspace', relativePath: 'a.json', beforeHash: HASH_A },
  ];
  return {
    ...fixture('workspace'),
    authority: {
      scope: 'workspace',
      operationId: 'op-multi-resource',
      workspaceId: 'ws_111111111111111111111111',
      requestScope: 'w3a-selftest',
      resources,
    },
    effects: {
      declared: resources.map((resource, index) => ({
        id: `effect-${index + 1}`,
        operation: 'update',
        resource,
        reversible: true,
      })),
    },
  };
}

function afterFor(receipt: ActionReceipt, outcome: 'applied' | 'no_change' | 'partial', hashes: string[]): ActionReceipt['after'] {
  return {
    outcome,
    resources: receipt.authority.resources.map((resource, index) => ({
      role: resource.role,
      root: resource.root,
      relativePath: resource.relativePath,
      hash: hashes[index] ?? HASH_C,
    })),
  };
}

function expectRejected(fn: () => unknown): boolean {
  try {
    fn();
    return false;
  } catch {
    return true;
  }
}

function expectInvalid(value: unknown): boolean {
  return validateActionReceipt(value).ok === false;
}

export function runActionReceiptSelftest(): ActionReceiptSelftestResult {
  const checks: ActionReceiptSelftestCheck[] = [];
  const ok = (name: string, pass: boolean, detail?: unknown) => checks.push({ name, pass, ...(detail === undefined ? {} : { detail: String(detail) }) });
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forge-action-receipt-selftest-'));
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'forge-action-receipt-outside-'));
  const store = new ActionReceiptStore({ root, now: () => Date.parse('2026-08-02T00:10:00.000Z') });
  const historyRoot = path.join(outside, 'history');
  let outsideCleaned = false;
  const removeOutsideFixture = () => {
    if (outsideCleaned) return;
    try {
      fs.rmSync(outside, { recursive: true, force: true });
      outsideCleaned = true;
    } catch { /* best effort; the finalizer retries */ }
  };
  let prepared: ActionReceipt | undefined;
  let originalBytes = '';

  try {
    const input = fixture();
    prepared = createPreparedActionReceipt(input);
    originalBytes = serializeActionReceipt(prepared);

    ok('complete_v1_record_validates', validateActionReceipt(prepared).ok && prepared.schema === ACTION_RECEIPT_SCHEMA);
    ok('global_scope_validates_without_profile_or_workspace_id', validateActionReceipt(createPreparedActionReceipt(fixture('global'))).ok);
    ok('profile_scope_validates_with_profile_id', validateActionReceipt(createPreparedActionReceipt(fixture('profile'))).ok);
    ok('workspace_scope_validates_with_workspace_id', validateActionReceipt(prepared).ok);
    const ordinaryIdentityReceipt = createPreparedActionReceipt({
      ...input,
      actor: { kind: 'agent', id: 'environment-agent' },
      client: { channel: 'harness', id: 'credential-client', version: '1.0.0' },
    });
    ok('ordinary_policy_words_in_actor_client_allowed', ordinaryIdentityReceipt.actor.id === 'environment-agent' && ordinaryIdentityReceipt.client.id === 'credential-client');
    ok('credential_value_in_actor_rejected', expectRejected(() => createPreparedActionReceipt({ ...input, actor: { kind: 'agent', id: 'x4fk_fixture_secret_12345' } })));
    ok('credential_value_in_client_rejected', expectRejected(() => createPreparedActionReceipt({ ...input, client: { channel: 'harness', id: 'Bearer-x4fk_fixture_secret_12345', version: '1.0.0' } })));
    const legacyGetInput: ActionReceiptPrepareInput = {
      ...input,
      capability: { legacyRoute: '/api/agent/action-receipt-selftest', method: 'GET', reviewed: true, reviewRef: 'w3a-route-review' },
    };
    const legacyPostInput: ActionReceiptPrepareInput = {
      ...legacyGetInput,
      capability: { legacyRoute: '/api/agent/action-receipt-selftest', method: 'POST', reviewed: true, reviewRef: 'w3a-route-review' },
    };
    const legacyGet = createPreparedActionReceipt(legacyGetInput);
    const legacyPost = createPreparedActionReceipt(legacyPostInput);
    ok('legacy_route_method_is_persisted_and_valid', validateActionReceipt(legacyGet).ok && 'method' in legacyGet.capability && legacyGet.capability.method === 'GET');
    ok('legacy_route_method_changes_authority_hash_and_id', hashActionReceiptAuthority(legacyGetInput) !== hashActionReceiptAuthority(legacyPostInput) && legacyGet.id !== legacyPost.id);
    ok('legacy_route_lowercase_method_rejected', expectRejected(() => createPreparedActionReceipt({ ...legacyGetInput, capability: { ...legacyGetInput.capability, method: 'get' } as unknown as ActionReceiptPrepareInput['capability'] })));
    ok('legacy_route_missing_method_rejected', expectRejected(() => createPreparedActionReceipt({ ...legacyGetInput, capability: { legacyRoute: '/api/agent/action-receipt-selftest', reviewed: true, reviewRef: 'w3a-route-review' } as unknown as ActionReceiptPrepareInput['capability'] })));
    const legacyStored = store.prepare(legacyGetInput);
    const persistedLegacy = store.read(legacyStored.id);
    ok('persisted_legacy_method_roundtrip_is_exact', 'method' in persistedLegacy.capability && persistedLegacy.capability.method === 'GET' && 'legacyRoute' in persistedLegacy.capability && persistedLegacy.capability.legacyRoute === '/api/agent/action-receipt-selftest');
    ok('unknown_schema_rejected', expectInvalid({ ...prepared, schema: 'forge.action-receipt.v2' }));
    ok('malformed_id_rejected', expectInvalid({ ...prepared, id: 'receipt/../escape' }));
    ok('malformed_hash_rejected', expectInvalid({ ...prepared, authorityHash: 'not-a-sha256' }));
    ok('malformed_actor_rejected', expectInvalid({ ...prepared, actor: { kind: 'agent', id: '' } }));
    ok('malformed_authority_rejected', expectInvalid({ ...prepared, authority: { ...prepared.authority, requestScope: '../escape' } }));
    const malformedPrepare = store.tryPrepare({
      ...input,
      authority: { ...input.authority, requestScope: '../escape' },
    });
    ok('try_prepare_validation_error_preserves_code', malformedPrepare.ok === false && malformedPrepare.code === 'ACTION_RECEIPT_INVALID');
    ok('global_extraneous_workspace_id_rejected', expectRejected(() => createPreparedActionReceipt({
      ...fixture('global'),
      authority: { ...fixture('global').authority, workspaceId: 'ws_222222222222222222222222' } as unknown as ActionReceiptPrepareInput['authority'],
    })));
    ok('profile_missing_profile_id_rejected', expectRejected(() => createPreparedActionReceipt({
      ...fixture('profile'),
      authority: (() => {
        const profileAuthority = fixture('profile').authority as Extract<ActionReceiptPrepareInput['authority'], { scope: 'profile' }>;
        return {
          scope: profileAuthority.scope,
          operationId: profileAuthority.operationId,
          requestScope: profileAuthority.requestScope,
          resources: profileAuthority.resources,
        } as ActionReceiptPrepareInput['authority'];
      })(),
    })));
    ok('workspace_extraneous_profile_id_rejected', expectRejected(() => createPreparedActionReceipt({
      ...input,
      authority: { ...input.authority, profileId: 'profile-2' } as unknown as ActionReceiptPrepareInput['authority'],
    })));
    const policyWordResource = { ...input.authority.resources[0], root: 'credential-store', relativePath: 'config/credentials.json' };
    ok('policy_words_in_legitimate_identity_allowed', createPreparedActionReceipt({
      ...input,
      authority: { ...input.authority, operationId: 'environment-config', requestScope: 'environment', resources: [policyWordResource] },
      effects: { declared: [{ ...input.effects.declared[0], resource: policyWordResource }] },
    }).authority.resources[0].relativePath === 'config/credentials.json');
    ok('undeclared_effect_rejected', expectRejected(() => createPreparedActionReceipt({
      ...input,
      effects: {
        declared: [{ ...input.effects.declared[0], resource: { ...input.effects.declared[0].resource, relativePath: 'other.json' } }],
      },
    })));
    ok('effect_before_hash_mismatch_rejected', expectRejected(() => createPreparedActionReceipt({
      ...input,
      effects: {
        declared: [{ ...input.effects.declared[0], resource: { ...input.effects.declared[0].resource, beforeHash: HASH_C } }],
      },
    })));
    ok('resource_after_hash_removed_from_authority', expectRejected(() => createPreparedActionReceipt({
      ...input,
      authority: { ...input.authority, resources: [{ ...input.authority.resources[0], afterHash: HASH_C }] } as unknown as ActionReceiptPrepareInput['authority'],
    })));
    ok('malformed_validation_rejected', expectInvalid({ ...prepared, validation: { ...prepared.validation, status: 'unknown' } }));
    ok('malformed_rollback_rejected', expectInvalid({ ...prepared, rollback: { required: true, mode: 'none', status: 'prepared' } }));
    ok('prepared_reversible_rolls_back_only_from_prepared_recovery', prepared.rollback.status === 'prepared');
    for (const status of ['performed', 'available', 'failed'] as const) {
      ok(`prepared_reversible_${status}_rollback_rejected`, expectRejected(() => createPreparedActionReceipt({
        ...input,
        rollback: { required: true, mode: 'recovery', reference: 'recovery-w3a-selftest', status },
      })));
    }
    ok('malformed_time_rejected', expectInvalid({ ...prepared, times: { ...prepared.times, preparedAt: 'tomorrow' } }));
    ok('malformed_transition_rejected', expectInvalid({ ...prepared, transition: { ...prepared.transition, from: 'committed' } }));

    const reorderedInput: ActionReceiptPrepareInput = {
      ...input,
      actor: { id: input.actor.id, kind: input.actor.kind },
      client: { version: input.client.version, id: input.client.id, channel: input.client.channel },
      authority: {
        resources: input.authority.resources.map(resource => ({ relativePath: resource.relativePath, root: resource.root, role: resource.role, beforeHash: resource.beforeHash })),
        requestScope: input.authority.requestScope,
        operationId: input.authority.operationId,
        scope: input.authority.scope,
        workspaceId: input.authority.scope === 'workspace' ? input.authority.workspaceId : undefined,
      } as unknown as ActionReceiptPrepareInput['authority'],
      input: { beforeHash: input.input.beforeHash, requestHash: input.input.requestHash },
      effects: { declared: input.effects.declared.map(effect => ({ reversible: effect.reversible, resource: effect.resource, operation: effect.operation, id: effect.id })) },
    };
    ok('property_order_does_not_change_authority_hash', hashActionReceiptAuthority(input) === hashActionReceiptAuthority(reorderedInput));
    const ordinalResources = [
      { role: 'data' as const, root: 'workspace', relativePath: 'a.json', beforeHash: HASH_A },
      { role: 'data' as const, root: 'workspace', relativePath: 'A.json', beforeHash: HASH_B },
      { role: 'data' as const, root: 'workspace', relativePath: 'a-json.json', beforeHash: HASH_C },
    ];
    const ordinalInput: ActionReceiptPrepareInput = {
      ...input,
      authority: { ...input.authority, operationId: 'op-ordinal-order', resources: ordinalResources },
      effects: {
        declared: [
          { id: 'effect.a', operation: 'update', resource: ordinalResources[0], reversible: true },
          { id: 'Effect-A', operation: 'update', resource: ordinalResources[1], reversible: true },
          { id: 'effect-A', operation: 'update', resource: ordinalResources[2], reversible: true },
        ],
      },
    };
    const ordinalReordered: ActionReceiptPrepareInput = {
      ...ordinalInput,
      authority: { ...ordinalInput.authority, resources: [...ordinalResources].reverse() },
      effects: { declared: [...ordinalInput.effects.declared].reverse() },
    };
    const ordinalCanonical = canonicalizeActionReceiptAuthority(ordinalInput);
    ok('ordinal_resource_and_effect_order_is_locale_independent',
      ordinalCanonical.indexOf('"relativePath":"A.json"') < ordinalCanonical.indexOf('"relativePath":"a-json.json"')
      && ordinalCanonical.indexOf('"relativePath":"a-json.json"') < ordinalCanonical.indexOf('"relativePath":"a.json"')
      && ordinalCanonical.indexOf('"id":"Effect-A"') < ordinalCanonical.indexOf('"id":"effect-A"')
      && ordinalCanonical.indexOf('"id":"effect-A"') < ordinalCanonical.indexOf('"id":"effect.a"')
      && hashActionReceiptAuthority(ordinalInput) === hashActionReceiptAuthority(ordinalReordered));
    ok('timestamp_excluded_from_authority_hash', hashActionReceiptAuthority(input) === hashActionReceiptAuthority({ ...input, preparedAt: '2036-12-31T23:59:59-05:00' }));
    ok('different_operation_identity_changes_receipt_id', createPreparedActionReceipt({
      ...input,
      authority: { ...input.authority, operationId: 'op-different-identity' },
    }).id !== prepared.id);
    ok('timezone_normalized_for_record_hash', hashActionReceipt(prepared) === hashActionReceipt({ ...prepared, times: { preparedAt: '2026-08-01T20:00:00-04:00' }, transition: { ...prepared.transition, at: '2026-08-01T20:00:00-04:00' } }));
    ok('absolute_posix_path_rejected', expectRejected(() => hashActionReceiptAuthority({
      ...input,
      authority: { ...input.authority, resources: [{ ...input.authority.resources[0], relativePath: '/tmp/canvas.json' }] },
    })));
    ok('absolute_windows_path_rejected', expectRejected(() => hashActionReceiptAuthority({
      ...input,
      authority: { ...input.authority, resources: [{ ...input.authority.resources[0], relativePath: 'C:\\project\\canvas.json' }] },
    })));
    ok('relative_traversal_rejected', expectRejected(() => hashActionReceiptAuthority({
      ...input,
      authority: { ...input.authority, resources: [{ ...input.authority.resources[0], relativePath: '../canvas.json' }] },
    })));
    ok('secret_resource_root_rejected', expectRejected(() => createPreparedActionReceipt({
      ...input,
      authority: { ...input.authority, resources: [{ ...input.authority.resources[0], root: 'x4fk_fixture_secret_12345' }] },
    })));
    ok('secret_resource_relative_path_rejected', expectRejected(() => createPreparedActionReceipt({
      ...input,
      authority: { ...input.authority, resources: [{ ...input.authority.resources[0], relativePath: 'fixtures/x4fk_fixture_secret_12345.json' }] },
    })));
    ok('canonical_json_sorts_object_keys', canonicalJson({ z: 1, a: { d: true, c: null } }) === '{"a":{"c":null,"d":true},"z":1}');

    const stored = store.prepare(input);
    prepared = stored;
    originalBytes = fs.readFileSync(store.pathFor(stored.id), 'utf8');
    ok('store_roundtrip_verifies_bytes', store.read(stored.id).hash === stored.hash && fs.readFileSync(store.pathFor(stored.id), 'utf8') === originalBytes);
    ok('store_atomic_write_leaves_no_temp', !fs.readdirSync(root).some(name => name.endsWith('.tmp')));
    const replayPrepare = store.prepare({ ...input, preparedAt: '2026-08-02T00:09:00-04:00' });
    ok('prepare_is_idempotent_across_timestamp', replayPrepare.hash === stored.hash && fs.readFileSync(store.pathFor(stored.id), 'utf8') === originalBytes);
    ok('receipt_id_matches_operation_identity_hash', stored.id === `ar_${hashActionReceiptOperationIdentity(input)}`);
    ok('operation_identity_excludes_full_authority_facts', hashActionReceiptOperationIdentity(input) === hashActionReceiptOperationIdentity({ ...input, input: { requestHash: HASH_C, beforeHash: HASH_B } }) && hashActionReceiptAuthority(input) !== hashActionReceiptAuthority({ ...input, input: { requestHash: HASH_C, beforeHash: HASH_B } }));
    const arbitraryId = { ...stored, id: `ar_${'f'.repeat(64)}`, hash: '' };
    arbitraryId.hash = hashActionReceipt(arbitraryId);
    ok('arbitrary_well_shaped_id_rejected', expectInvalid(arbitraryId));

    const conflictBytes = fs.readFileSync(store.pathFor(stored.id), 'utf8');
    const requestConflict = { ...input, input: { requestHash: HASH_C, beforeHash: HASH_B } };
    const conflict = store.tryPrepare(requestConflict);
    ok('natural_same_operation_changed_request_conflicts', conflict.ok === false && conflict.code === 'RECEIPT_DUPLICATE_CONFLICT' && fs.readFileSync(store.pathFor(stored.id), 'utf8') === conflictBytes);
    const resourceConflictResource = { ...input.authority.resources[0], relativePath: 'other.json' };
    const resourceConflict = {
      ...input,
      authority: { ...input.authority, resources: [resourceConflictResource] },
      effects: { declared: [{ ...input.effects.declared[0], resource: resourceConflictResource }] },
    };
    const effectConflict = { ...input, effects: { declared: [{ ...input.effects.declared[0], operation: 'replace' }] } };
    const metadataConflict = { ...input, metadata: { operation: 'replace', mode: 'selftest', message: 'changed authority' } };
    const rollbackConflict = { ...input, rollback: { required: true, mode: 'recovery' as const, reference: 'recovery-other' } };
    ok('natural_same_operation_changed_resources_conflicts', store.tryPrepare(resourceConflict).ok === false);
    ok('natural_same_operation_changed_effects_conflicts', store.tryPrepare(effectConflict).ok === false);
    ok('natural_same_operation_changed_metadata_conflicts', store.tryPrepare(metadataConflict).ok === false);
    ok('natural_same_operation_changed_rollback_conflicts', store.tryPrepare(rollbackConflict).ok === false);

    fs.writeFileSync(store.pathFor(stored.id), originalBytes.replace('"status":"prepared"', '"status":"failed"'), 'utf8');
    const tamperedRead = store.tryRead(stored.id);
    ok('tampered_bytes_fail_closed', tamperedRead.ok === false && tamperedRead.code === 'RECEIPT_CORRUPT');
    fs.writeFileSync(store.pathFor(stored.id), originalBytes, 'utf8');
    fs.writeFileSync(store.pathFor(stored.id), '{broken json', 'utf8');
    const corruptRead = store.tryRead(stored.id);
    ok('corrupt_json_fails_closed', corruptRead.ok === false && corruptRead.code === 'RECEIPT_CORRUPT');
    fs.writeFileSync(store.pathFor(stored.id), originalBytes, 'utf8');

    const invalidTransition = store.tryTransition(stored.id, { to: 'compensated', at: '2026-08-02T00:01:00.000Z' });
    ok('invalid_transition_rejected', invalidTransition.ok === false && invalidTransition.code === 'ACTION_RECEIPT_INVALID');
    const noChange = store.prepare({ ...input, authority: { ...input.authority, operationId: 'op-no-change' } });
    const noChangeDifferent = store.prepare({ ...input, authority: { ...input.authority, operationId: 'op-no-change-different' } });
    ok('no_change_with_different_after_hash_rejected', store.tryTransition(noChangeDifferent.id, {
      to: 'committed',
      at: '2026-08-02T00:00:30.000Z',
      validation: { status: 'passed', validator: 'forge.w3a.selftest' },
      rollbackStatus: 'available',
      after: afterFor(noChangeDifferent, 'no_change', [HASH_C]),
    }).ok === false);
    ok('no_change_with_matching_before_hashes_allowed', store.tryTransition(noChange.id, {
      to: 'committed',
      at: '2026-08-02T00:00:30.000Z',
      validation: { status: 'passed', validator: 'forge.w3a.selftest' },
      rollbackStatus: 'available',
      after: afterFor(noChange, 'no_change', [HASH_B]),
    }).ok);
    const noBeforeResource = {
      role: input.authority.resources[0].role,
      root: input.authority.resources[0].root,
      relativePath: input.authority.resources[0].relativePath,
    };
    const noBefore = store.prepare({
      ...input,
      authority: { ...input.authority, operationId: 'op-no-change-no-before', resources: [noBeforeResource] },
      effects: { declared: [{ ...input.effects.declared[0], resource: noBeforeResource }] },
    });
    ok('no_change_without_before_hash_rejected', store.tryTransition(noBefore.id, {
      to: 'committed',
      at: '2026-08-02T00:00:31.000Z',
      validation: { status: 'passed', validator: 'forge.w3a.selftest' },
      rollbackStatus: 'available',
      after: afterFor(noBefore, 'no_change', [HASH_C]),
    }).ok === false);
    const committed = store.commit(stored.id, {
      at: '2026-08-02T00:01:00.000Z',
      validation: { status: 'passed', validator: 'forge.w3a.selftest', summary: 'validated fixture' },
      rollbackStatus: 'available',
      after: afterFor(stored, 'applied', [HASH_C]),
    });
    ok('prepared_to_committed_with_per_resource_after_allowed', committed.status === 'committed' && committed.after?.resources.length === 1 && committed.after.resources[0].hash === HASH_C);
    const committedReplay = store.commit(stored.id, {
      at: '2026-08-02T00:01:00.000Z',
      validation: { status: 'passed', validator: 'forge.w3a.selftest', summary: 'validated fixture' },
      rollbackStatus: 'available',
      after: afterFor(stored, 'applied', [HASH_C]),
    });
    ok('identical_commit_replay_is_safe', committedReplay.hash === committed.hash);

    const historyPrepared = store.prepare({
      ...input,
      authority: { ...input.authority, operationId: 'op-history-link' },
    });
    const historyReceipt = store.commit(historyPrepared.id, {
      at: '2026-08-02T00:01:05.000Z',
      validation: { status: 'passed', validator: 'forge.w3a.selftest', summary: 'history link fixture' },
      rollbackStatus: 'available',
      after: afterFor(historyPrepared, 'applied', [HASH_C]),
    });
    const receiptPath = store.pathFor(historyReceipt.id);
    const committedBytes = fs.readFileSync(receiptPath, 'utf8');
    const ledgerBase: LedgerRow = {
      id: 'receipt-history-row',
      ts: historyReceipt.times.committedAt!,
      agent: { kind: 'agent', label: 'luna-executor' },
      kind: 'action',
      title: 'Action receipt committed',
      files: [],
      outcome: { status: 'ok' },
      durationMs: 1,
      revertible: false,
    };
    const projection = projectActionReceiptToLedger(historyReceipt);
    const repeatedProjection = projectActionReceiptToLedger(historyReceipt);
    const projectedRow = attachActionReceiptToLedgerRow(ledgerBase, historyReceipt);
    const fakeReceiptLinkRow: LedgerRow = {
      ...ledgerBase,
      receiptId: 'receipt-fake',
      receiptHash: HASH_A,
      receiptStatus: 'failed',
    };
    const overwrittenReceiptLinkRow = attachActionReceiptToLedgerRow(fakeReceiptLinkRow, historyReceipt);
    ok('terminal_receipt_projects_deterministically',
      JSON.stringify(projection) === JSON.stringify(repeatedProjection) &&
      projection.receiptId === historyReceipt.id && projection.receiptHash === historyReceipt.hash && projection.receiptStatus === 'committed');
    ok('receipt_projection_overwrites_caller_supplied_fake_link',
      overwrittenReceiptLinkRow.receiptId === historyReceipt.id &&
      overwrittenReceiptLinkRow.receiptHash === historyReceipt.hash &&
      overwrittenReceiptLinkRow.receiptStatus === 'committed');
    ok('receipt_projection_contains_only_id_hash_status',
      Object.keys(projection).sort().join('|') === 'receiptHash|receiptId|receiptStatus');
    ok('receipt_projection_round_trips_through_jsonl', (() => {
      const decoded = decodeRows(encodeRow(projectedRow))[0];
      return JSON.stringify(decoded) === JSON.stringify(projectedRow);
    })());
    const legacyRow: LedgerRow = {
      id: 'legacy-history-row',
      ts: new Date(0).toISOString(),
      agent: { kind: 'studio', label: 'studio' },
      kind: 'validate',
      title: 'Validated legacy row',
      files: ['a.xml'],
      outcome: { status: 'ok' },
      durationMs: 1,
      revertible: false,
    };
    const legacyDecoded = decodeRows(encodeRow(legacyRow))[0];
    ok('legacy_row_without_receipt_fields_round_trips_unchanged',
      JSON.stringify(legacyDecoded) === JSON.stringify(legacyRow) &&
      !Object.hasOwn(legacyDecoded || {}, 'receiptId') && !Object.hasOwn(legacyDecoded || {}, 'receiptHash') && !Object.hasOwn(legacyDecoded || {}, 'receiptStatus'));
    ok('prepared_receipt_cannot_project_as_terminal_history', expectRejected(() => projectActionReceiptToLedger(stored)));
    ok('tampered_receipt_cannot_project_as_valid_history', expectRejected(() => projectActionReceiptToLedger({ ...historyReceipt, status: 'failed' as const, hash: HASH_A })));

    const secretPrepared = store.prepare({
      ...input,
      authority: { ...input.authority, operationId: 'op-history-secret' },
      metadata: { message: 'Bearer x4fk_fixture_secret_12345' },
    });
    const secretCommitted = store.commit(secretPrepared.id, {
      at: '2026-08-02T00:01:10.000Z',
      validation: { status: 'passed', validator: 'forge.w3a.selftest' },
      rollbackStatus: 'available',
      after: afterFor(secretPrepared, 'applied', [HASH_C]),
    });
    const projectedSecretBytes = encodeRow(attachActionReceiptToLedgerRow({ ...ledgerBase, id: 'receipt-history-secret-row' }, secretCommitted));
    ok('history_projection_omits_payload_metadata_and_secret',
      !projectedSecretBytes.includes('x4fk_fixture_secret_12345') &&
      !projectedSecretBytes.includes('Bearer') &&
      !projectedSecretBytes.includes('"authority"') &&
      !projectedSecretBytes.includes('"effects"') &&
      !projectedSecretBytes.includes('"input"') &&
      !projectedSecretBytes.includes('"metadata"'));

    const history = new AgentHistoryStore({ root: historyRoot });
    ok('history_receipt_link_append_is_optional', history.append(projectedRow));
    const failedHistory = new AgentHistoryStore({ root: receiptPath });
    const failuresBefore = failedHistory.failures;
    const failedAppend = failedHistory.append(projectedRow);
    const receiptAfterHistoryFailure = store.read(historyReceipt.id);
    ok('history_append_failure_is_fail_soft_and_cannot_change_receipt',
      failedAppend === false && failedHistory.failures === failuresBefore + 1 &&
      receiptAfterHistoryFailure.status === 'committed' && receiptAfterHistoryFailure.hash === historyReceipt.hash &&
      fs.readFileSync(receiptPath, 'utf8') === committedBytes);
    const rotatingHistory = new AgentHistoryStore({ root: historyRoot, maxBytes: 1, maxSegments: 1 });
    rotatingHistory.append({ ...projectedRow, id: 'receipt-history-rotation-a' });
    rotatingHistory.append({ ...projectedRow, id: 'receipt-history-rotation-b' });
    const reopenedHistory = new AgentHistoryStore({ root: historyRoot });
    const receiptAfterRotation = store.read(historyReceipt.id);
    ok('history_rotation_and_reopen_preserve_receipt_authority',
      reopenedHistory.readAll().some(row => row.receiptId === historyReceipt.id && row.receiptHash === historyReceipt.hash && row.receiptStatus === 'committed') &&
      receiptAfterRotation.status === 'committed' && receiptAfterRotation.hash === historyReceipt.hash &&
      fs.readFileSync(receiptPath, 'utf8') === committedBytes);
    ok('committed_to_failed_rejected', store.tryTransition(stored.id, {
      to: 'failed',
      at: '2026-08-02T00:02:00.000Z',
      validation: { status: 'failed', validator: 'forge.w3a.selftest', code: 'late-failure' },
      failure: { code: 'LATE_FAILURE' },
    }).ok === false);
    const compensationGuard = store.prepare({ ...input, authority: { ...input.authority, operationId: 'op-compensation-guard' } });
    const guardCommitted = store.commit(compensationGuard.id, {
      at: '2026-08-02T00:02:30.000Z',
      validation: { status: 'passed', validator: 'forge.w3a.selftest', summary: 'committed validation' },
      rollbackStatus: 'available',
      after: afterFor(compensationGuard, 'applied', [HASH_C]),
    });
    ok('compensation_changed_validation_rejected', store.tryTransition(guardCommitted.id, {
      to: 'compensated',
      at: '2026-08-02T00:02:31.000Z',
      validation: { status: 'failed', validator: 'forge.w3a.selftest', code: 'changed_validation' },
      rollbackStatus: 'performed',
    }).ok === false);
    ok('compensation_changed_after_rejected', store.tryTransition(guardCommitted.id, {
      to: 'compensated',
      at: '2026-08-02T00:02:32.000Z',
      rollbackStatus: 'performed',
      after: afterFor(guardCommitted, 'applied', [HASH_D]),
    }).ok === false);
    const persistedGuard = store.read(guardCommitted.id);
    ok('rejected_compensation_preserves_persisted_committed_facts', persistedGuard.status === 'committed' && persistedGuard.validation.status === 'passed' && persistedGuard.validation.summary === 'committed validation' && persistedGuard.after?.resources[0].hash === HASH_C);
    const guardCompensated = store.compensate(guardCommitted.id, { at: '2026-08-02T00:02:33.000Z', rollbackStatus: 'performed' });
    const persistedCompensatedGuard = store.read(guardCommitted.id);
    ok('persisted_compensation_preserves_committed_facts', guardCompensated.status === 'compensated' && persistedCompensatedGuard.validation.status === 'passed' && persistedCompensatedGuard.validation.summary === 'committed validation' && persistedCompensatedGuard.after?.resources[0].hash === HASH_C);
    const compensated = store.compensate(stored.id, { at: '2026-08-02T00:03:00.000Z', rollbackStatus: 'performed' });
    ok('committed_to_compensated_allowed', compensated.status === 'compensated' && compensated.validation.status === 'passed' && compensated.rollback.status === 'performed' && compensated.after?.resources[0].hash === HASH_C);
    ok('terminal_rewrite_rejected', store.tryTransition(stored.id, { to: 'committed', at: '2026-08-02T00:04:00.000Z' }).ok === false);
    ok('identical_compensation_replay_is_safe', store.compensate(stored.id, { at: '2026-08-02T00:03:00.000Z', rollbackStatus: 'performed' }).hash === compensated.hash);

    const multi = store.prepare(multiResourceFixture());
    const validAfter = afterFor(multi, 'applied', [HASH_C, HASH_D]);
    const multiCommitInput = {
      to: 'committed' as const,
      at: '2026-08-02T00:11:00.000Z',
      validation: { status: 'passed' as const, validator: 'forge.w3a.selftest' },
      rollbackStatus: 'available' as const,
      after: validAfter,
    };
    const missingAfter = { ...validAfter, resources: validAfter.resources.slice(0, 1) };
    const extraAfter = { ...validAfter, resources: [...validAfter.resources, { ...validAfter.resources[0], relativePath: 'extra.json', hash: HASH_A }] };
    const mismatchAfter = { ...validAfter, resources: validAfter.resources.map((resource, index) => index === 0 ? { ...resource, relativePath: 'mismatch.json' } : resource) };
    const duplicateAfter = { ...validAfter, resources: [validAfter.resources[0], validAfter.resources[0]] };
    const reorderedAfter = { ...validAfter, resources: [...validAfter.resources].reverse() };
    ok('missing_after_resource_rejected', store.tryTransition(multi.id, { ...multiCommitInput, after: missingAfter }).ok === false);
    ok('extra_after_resource_rejected', store.tryTransition(multi.id, { ...multiCommitInput, after: extraAfter }).ok === false);
    ok('mismatched_after_resource_rejected', store.tryTransition(multi.id, { ...multiCommitInput, after: mismatchAfter }).ok === false);
    ok('duplicate_after_resource_rejected', store.tryTransition(multi.id, { ...multiCommitInput, after: duplicateAfter }).ok === false);
    ok('reordered_after_resource_rejected', store.tryTransition(multi.id, { ...multiCommitInput, after: reorderedAfter }).ok === false);
    const multiCommitted = store.transition(multi.id, multiCommitInput);
    ok('committed_records_exact_after_resources', multiCommitted.after?.resources.length === 2 && multiCommitted.after.resources[0].hash === HASH_C && multiCommitted.after.resources[1].hash === HASH_D);

    const mixedBase = multiResourceFixture();
    const mixedEffects = mixedBase.effects.declared.map((effect, index) => ({ ...effect, reversible: index === 0 }));
    const mixedPrepared = store.prepare({
      ...mixedBase,
      authority: { ...mixedBase.authority, operationId: 'op-mixed-prepared' },
      effects: { declared: mixedEffects },
    });
    ok('mixed_reversibility_prepare_remains_representable', mixedPrepared.rollback.required && mixedPrepared.effects.declared.some(effect => effect.reversible) && mixedPrepared.effects.declared.some(effect => !effect.reversible));
    ok('mixed_reversibility_prepared_to_rolled_back_rejected', store.tryTransition(mixedPrepared.id, {
      to: 'rolled_back',
      at: '2026-08-02T00:11:30.000Z',
      validation: { status: 'failed', validator: 'forge.w3a.selftest', code: 'mixed_failure' },
      rollbackStatus: 'performed',
      failure: { code: 'MIXED_FAILURE' },
    }).ok === false);
    const mixedCommitted = store.commit(store.prepare({
      ...mixedBase,
      authority: { ...mixedBase.authority, operationId: 'op-mixed-committed' },
      effects: { declared: mixedEffects },
    }).id, {
      at: '2026-08-02T00:11:31.000Z',
      validation: { status: 'passed', validator: 'forge.w3a.selftest' },
      rollbackStatus: 'available',
      after: afterFor(mixedPrepared, 'applied', [HASH_C, HASH_D]),
    });
    ok('mixed_reversibility_commit_remains_representable', mixedCommitted.status === 'committed');
    ok('mixed_reversibility_committed_to_compensated_rejected', store.tryTransition(mixedCommitted.id, {
      to: 'compensated',
      at: '2026-08-02T00:11:32.000Z',
      rollbackStatus: 'performed',
    }).ok === false && store.read(mixedCommitted.id).status === 'committed');

    const irreversibleResource = { ...input.authority.resources[0] };
    const irreversible = store.prepare({
      ...input,
      authority: { ...input.authority, operationId: 'op-irreversible' },
      effects: { declared: [{ ...input.effects.declared[0], resource: irreversibleResource, reversible: false }] },
      rollback: { required: false, mode: 'none' },
    });
    ok('irreversible_prepared_rollback_is_not_required', irreversible.rollback.status === 'not_required');
    ok('irreversible_prepared_to_rolled_back_rejected', store.tryTransition(irreversible.id, {
      to: 'rolled_back',
      at: '2026-08-02T00:12:00.000Z',
      validation: { status: 'failed', validator: 'forge.w3a.selftest', code: 'mutation_failed' },
      failure: { code: 'MUTATION_FAILED' },
    }).ok === false);
    const irreversibleCommitted = store.commit(irreversible.id, {
      at: '2026-08-02T00:12:01.000Z',
      validation: { status: 'passed', validator: 'forge.w3a.selftest' },
      after: afterFor(irreversible, 'applied', [HASH_C]),
    });
    ok('irreversible_committed_to_compensated_rejected', store.tryTransition(irreversibleCommitted.id, {
      to: 'compensated',
      at: '2026-08-02T00:12:02.000Z',
    }).ok === false);

    const failed = store.prepare({ ...input, authority: { ...input.authority, operationId: 'op-failed' }, input: { requestHash: HASH_C, beforeHash: HASH_B }, preparedAt: '2026-08-02T00:04:00.000Z' });
    const failedResult = store.fail(failed.id, {
      at: '2026-08-02T00:05:00.000Z',
      validation: { status: 'failed', validator: 'forge.w3a.selftest', code: 'validation_failed' },
      rollbackStatus: 'available',
      failure: { code: 'VALIDATION_FAILED', message: 'fixture validation failed' },
    });
    ok('prepared_to_failed_allowed', failedResult.status === 'failed' && failedResult.failure?.code === 'VALIDATION_FAILED');
    ok('failed_terminal_rewrite_rejected', store.tryTransition(failed.id, { to: 'committed', at: '2026-08-02T00:06:00.000Z' }).ok === false);
    const failedPerformedRecovery = store.prepare({ ...input, authority: { ...input.authority, operationId: 'op-failed-performed-recovery' } });
    ok('failed_with_performed_recovery_rejected', store.tryTransition(failedPerformedRecovery.id, {
      to: 'failed',
      at: '2026-08-02T00:06:30.000Z',
      validation: { status: 'failed', validator: 'forge.w3a.selftest', code: 'mutation_failed' },
      rollbackStatus: 'performed',
      failure: { code: 'MUTATION_FAILED' },
    }).ok === false);
    const failedRecoveryFailure = store.prepare({ ...input, authority: { ...input.authority, operationId: 'op-failed-recovery-failed' } });
    ok('failed_with_failed_recovery_rejected', store.tryTransition(failedRecoveryFailure.id, {
      to: 'failed',
      at: '2026-08-02T00:06:31.000Z',
      validation: { status: 'failed', validator: 'forge.w3a.selftest', code: 'recovery_failed' },
      rollbackStatus: 'failed',
      failure: { code: 'RECOVERY_FAILED' },
    }).ok === false);

    const rolledBack = store.prepare({ ...input, authority: { ...input.authority, operationId: 'op-rolled-back' }, input: { requestHash: HASH_D, beforeHash: HASH_B }, preparedAt: '2026-08-02T00:07:00.000Z' });
    const rolledBackResult = store.rollBack(rolledBack.id, {
      at: '2026-08-02T00:08:00.000Z',
      validation: { status: 'failed', validator: 'forge.w3a.selftest', code: 'mutation_failed' },
      rollbackStatus: 'performed',
      failure: { code: 'MUTATION_FAILED' },
    });
    ok('prepared_to_rolled_back_allowed', rolledBackResult.status === 'rolled_back' && rolledBackResult.rollback.status === 'performed');

    const incomplete = store.prepare({ ...input, authority: { ...input.authority, operationId: 'op-incomplete' }, input: { requestHash: 'e'.repeat(64), beforeHash: HASH_B }, preparedAt: '2026-08-02T00:09:00.000Z' });
    const partialAfter = afterFor(incomplete, 'partial', [HASH_D]);
    const incompleteResult = store.transition(incomplete.id, {
      to: 'incomplete',
      at: '2026-08-02T00:10:00.000Z',
      validation: { status: 'failed', validator: 'forge.w3a.selftest', code: 'finalization_failed' },
      rollbackStatus: 'available',
      after: partialAfter,
      failure: { code: 'PARTIAL_FINALIZATION', message: 'fixture observed partial after-state' },
    });
    ok('prepared_to_incomplete_records_partial_after_and_recovery', incompleteResult.status === 'incomplete' && incompleteResult.after?.outcome === 'partial' && incompleteResult.after.resources[0].hash === HASH_D && incompleteResult.rollback.status === 'available');
    ok('incomplete_without_partial_after_rejected', store.tryTransition(store.prepare({ ...input, authority: { ...input.authority, operationId: 'op-incomplete-no-partial' } }).id, {
      to: 'incomplete', at: '2026-08-02T00:10:00.000Z', validation: { status: 'failed', validator: 'forge.w3a.selftest' }, rollbackStatus: 'available', after: afterFor(incomplete, 'applied', [HASH_D]), failure: { code: 'PARTIAL_FINALIZATION' },
    }).ok === false);
    ok('incomplete_with_passed_validation_rejected', store.tryTransition(store.prepare({ ...input, authority: { ...input.authority, operationId: 'op-incomplete-passed' } }).id, {
      to: 'incomplete', at: '2026-08-02T00:10:00.000Z', validation: { status: 'passed', validator: 'forge.w3a.selftest' }, rollbackStatus: 'available', after: partialAfter, failure: { code: 'PARTIAL_FINALIZATION' },
    }).ok === false);
    ok('incomplete_without_failure_rejected', store.tryTransition(store.prepare({ ...input, authority: { ...input.authority, operationId: 'op-incomplete-no-failure' } }).id, {
      to: 'incomplete', at: '2026-08-02T00:10:00.000Z', validation: { status: 'failed', validator: 'forge.w3a.selftest' }, rollbackStatus: 'available', after: partialAfter,
    }).ok === false);
    ok('incomplete_with_invalid_rollback_rejected', store.tryTransition(store.prepare({ ...input, authority: { ...input.authority, operationId: 'op-incomplete-bad-rollback' } }).id, {
      to: 'incomplete', at: '2026-08-02T00:10:00.000Z', validation: { status: 'failed', validator: 'forge.w3a.selftest' }, rollbackStatus: 'prepared', after: partialAfter, failure: { code: 'PARTIAL_FINALIZATION' },
    }).ok === false);
    ok('incomplete_terminal_rewrite_rejected', store.tryTransition(incomplete.id, { to: 'committed', at: '2026-08-02T00:11:00.000Z', validation: { status: 'passed', validator: 'forge.w3a.selftest' }, rollbackStatus: 'available', after: afterFor(incomplete, 'applied', [HASH_C]) }).ok === false);
    ok('incomplete_exact_replay_rejected_as_terminal', store.tryTransition(incomplete.id, {
      to: 'incomplete',
      at: '2026-08-02T00:10:00.000Z',
      validation: { status: 'failed', validator: 'forge.w3a.selftest', code: 'finalization_failed' },
      rollbackStatus: 'available',
      after: partialAfter,
      failure: { code: 'PARTIAL_FINALIZATION', message: 'fixture observed partial after-state' },
    }).ok === false);

    const traversalRead = store.tryRead('../escape');
    ok('id_traversal_rejected', traversalRead.ok === false && traversalRead.code === 'RECEIPT_ID_INVALID');
    const linkRoot = path.join(root, 'junction-root');
    fs.symlinkSync(outside, linkRoot, process.platform === 'win32' ? 'junction' : 'dir');
    const linkStore = new ActionReceiptStore({ root: linkRoot });
    ok('junction_root_escape_refused', linkStore.tryPrepare(input).ok === false);
    const descendantRoot = path.join(linkRoot, 'missing', 'leaf');
    const outsideDescendant = path.join(outside, 'missing', 'leaf');
    const descendantResult = new ActionReceiptStore({ root: descendantRoot }).tryPrepare(input);
    ok('nonexistent_descendant_under_junction_refused_before_write', descendantResult.ok === false && !fs.existsSync(outsideDescendant));

    const secretFixture = { ...input, metadata: { message: 'Bearer x4fk_fixture_secret_12345' } };
    const redacted = createPreparedActionReceipt(secretFixture);
    const redactedBytes = serializeActionReceipt(redacted);
    ok('secret_metadata_redacted_before_persistence', !redactedBytes.includes('x4fk_fixture_secret_12345') && redactedBytes.includes('[redacted]'));
    ok('secret_metadata_key_rejected', expectRejected(() => createPreparedActionReceipt({ ...input, metadata: { apiKey: 'fixture-secret' } })));
    ok('raw_body_metadata_key_rejected', expectRejected(() => createPreparedActionReceipt({ ...input, metadata: { requestBody: 'fixture-secret' } })));
    const fileRoot = path.join(historyRoot, 'ledger.jsonl');
    const corruptHistoryMarker = 'history-corrupt-fake';
    fs.writeFileSync(fileRoot, `{"id":"${corruptHistoryMarker}"`, 'utf8');
    const corruptedHistoryRows = new AgentHistoryStore({ root: historyRoot }).readAll();
    const receiptAfterCorruptHistory = store.read(historyReceipt.id);
    ok('corrupt_history_is_fail_soft_and_receipt_unchanged',
      corruptedHistoryRows.every(row => row.id !== corruptHistoryMarker) && receiptAfterCorruptHistory.status === 'committed' &&
      receiptAfterCorruptHistory.hash === historyReceipt.hash && fs.readFileSync(receiptPath, 'utf8') === committedBytes,
      `rows=${corruptedHistoryRows.length} malformedDecoded=${corruptedHistoryRows.some(row => row.id === corruptHistoryMarker)}`);
    const unavailableStoreRoot = new ActionReceiptStore({ root: fileRoot }).tryPrepare(input);
    ok('unavailable_store_root_rejected', unavailableStoreRoot.ok === false, unavailableStoreRoot.ok ? 'unexpected success' : ('code' in unavailableStoreRoot ? unavailableStoreRoot.code : 'unknown failure'));
    removeOutsideFixture();
    const receiptAfterHistoryDelete = store.read(historyReceipt.id);
    const historyAfterDeleteRows = new AgentHistoryStore({ root: historyRoot }).readAll();
    ok('history_delete_cannot_delete_or_alter_receipt',
      historyAfterDeleteRows.length === 0 &&
      receiptAfterHistoryDelete.status === 'committed' && receiptAfterHistoryDelete.hash === historyReceipt.hash &&
      fs.readFileSync(receiptPath, 'utf8') === committedBytes,
      `rows=${historyAfterDeleteRows.length} status=${receiptAfterHistoryDelete.status} hash=${receiptAfterHistoryDelete.hash === historyReceipt.hash} bytes=${fs.readFileSync(receiptPath, 'utf8') === committedBytes}`);
  } catch (error) {
    ok('selftest_unexpected_exception', false, error instanceof Error ? error.message : String(error));
  } finally {
    try { fs.rmSync(root, { recursive: true, force: true }); } catch { /* test cleanup */ }
    removeOutsideFixture();
  }

  const passed = checks.filter(check => check.pass).length;
  return { allPassed: passed === checks.length, pass: passed === checks.length, passed, total: checks.length, checks };
}

// The server production bundle is CommonJS, where import.meta.url is empty.  The source oracle
// remains directly runnable through `npx tsx src/lib/actionReceipt.selftest.ts` without making
// server imports execute the oracle.
const invokedDirectly = path.basename(process.argv[1] ?? '') === 'actionReceipt.selftest.ts';
if (invokedDirectly) {
  const result = runActionReceiptSelftest();
  console.log(JSON.stringify(result, null, 2));
  if (!result.allPassed) process.exitCode = 1;
}
