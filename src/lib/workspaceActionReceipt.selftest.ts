import {
  hashWorkspaceActionRequestFacts,
  workspaceReceiptAfter,
  workspaceReceiptResources,
  workspaceRegistryReceiptAfter,
  workspaceRegistryReceiptAfterResource,
  workspaceRegistryReceiptHash,
  workspaceRegistryReceiptResource,
  type WorkspaceActionReceiptError,
  type WorkspaceRegistryReceiptRecord,
} from './workspaceActionReceipt';
import type { ModWorkspace } from '../types';
import {
  workspaceContentHash,
  workspaceSnapshotHash,
} from './workspaceIdentity';
import {
  workspaceContentReceiptHash,
  workspaceSnapshotReceiptHash,
} from './workspaceReceiptHash';

const WORKSPACE_A = 'ws_aaaaaaaaaaaaaaaaaaaaaaaa';
const WORKSPACE_B = 'ws_bbbbbbbbbbbbbbbbbbbbbbbb';
const WORKSPACE_C = 'ws_cccccccccccccccccccccccc';
const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);
const HASH_C = 'c'.repeat(64);

interface SelftestCheck {
  name: string;
  pass: boolean;
  detail?: string;
}

export interface WorkspaceActionReceiptSelftestResult {
  allPassed: boolean;
  pass: boolean;
  passed: number;
  total: number;
  failures: string[];
  checks: SelftestCheck[];
}

function expectReject(value: () => unknown, code?: string, secret?: string): boolean {
  try {
    value();
    return false;
  } catch (error) {
    const candidate = error as Partial<WorkspaceActionReceiptError>;
    const message = error instanceof Error ? error.message : '';
    return error instanceof Error
      && (code === undefined || candidate.code === code)
      && (secret === undefined || !message.includes(secret))
      && !/x4fk_|bearer|raw-secret|C:\\secret|\/tmp\/secret/i.test(message);
  }
}

function workspace(name = 'Workspace A'): ModWorkspace {
  return {
    id: 'legacy-workspace',
    name,
    version: '1.0.0',
    author: 'selftest',
    description: 'bounded workspace fixture',
    nodes: [],
    links: [],
    uiWidgets: [],
    uiTheme: {
      backgroundColor: '#000000',
      borderColor: '#111111',
      accentColor: '#222222',
      opacity: 1,
      showIcons: true,
    },
  };
}

function structuralRecord(
  workspaceId: string,
  overrides: Partial<WorkspaceRegistryReceiptRecord> = {},
): WorkspaceRegistryReceiptRecord {
  return {
    workspaceId,
    contentReceiptHash: HASH_A,
    snapshotReceiptHash: HASH_B,
    head: 'a'.repeat(16),
    version: 1,
    createdAt: '2026-08-03T00:00:00.000Z',
    savedAt: '2026-08-03T00:01:00.000Z',
    origin: 'selftest:registry',
    ...overrides,
  };
}

export function runWorkspaceActionReceiptSelftest(): WorkspaceActionReceiptSelftestResult {
  const checks: SelftestCheck[] = [];
  const check = (name: string, pass: boolean, detail?: unknown): void => {
    checks.push({ name, pass: !!pass, ...(detail === undefined ? {} : { detail: String(detail) }) });
  };

  const base = workspace();
  const changed = workspace('Workspace B');
  const resources = workspaceReceiptResources(WORKSPACE_A, base);
  check('workspace_resources_have_exact_paired_authority', resources.length === 2
    && resources.every(resource => resource.root === 'workspace')
    && resources.some(resource => resource.role === 'workspace' && resource.relativePath === `${WORKSPACE_A}/content`)
    && resources.some(resource => resource.role === 'snapshot' && resource.relativePath === `${WORKSPACE_A}/snapshot`));
  check('workspace_resources_use_complete_receipt_hashes', resources.every(resource => /^[a-f0-9]{64}$/.test(resource.beforeHash ?? '')));
  check('workspace_content_receipt_hash_is_not_legacy_marker_hash', resources.find(resource => resource.role === 'workspace')?.beforeHash
    !== workspaceContentHash(base));
  check('workspace_snapshot_receipt_hash_is_not_legacy_marker_hash', resources.find(resource => resource.role === 'snapshot')?.beforeHash
    !== workspaceSnapshotHash(base));
  check('workspace_resource_order_is_deterministic', resources[0]?.role === 'snapshot' && resources[1]?.role === 'workspace'
    && JSON.stringify(resources) === JSON.stringify(workspaceReceiptResources(WORKSPACE_A, JSON.parse(JSON.stringify(base)))));
  check('workspace_receipt_hashes_match_authoritative_helpers', resources.some(resource => resource.role === 'workspace'
    && resource.beforeHash === workspaceContentReceiptHash(base))
    && resources.some(resource => resource.role === 'snapshot'
      && resource.beforeHash === workspaceSnapshotReceiptHash(base)));

  const noChange = workspaceReceiptAfter(resources, base, 'no_change');
  check('workspace_no_change_after_has_exact_two_hashes', noChange.outcome === 'no_change'
    && noChange.resources.length === 2
    && noChange.resources.every((resource, index) => resource.hash === resources[index].beforeHash));
  check('workspace_no_change_is_inferred_when_unchanged', workspaceReceiptAfter(resources, base).outcome === 'no_change');
  const applied = workspaceReceiptAfter(resources, changed, { outcome: 'applied', code: 'workspace_updated' });
  check('workspace_applied_after_has_exact_matching_resources', applied.outcome === 'applied'
    && applied.code === 'workspace_updated'
    && applied.resources.length === 2
    && applied.resources.every(resource => /^[a-f0-9]{64}$/.test(resource.hash)));
  check('workspace_no_change_rejects_changed_state', expectReject(
    () => workspaceReceiptAfter(resources, changed, 'no_change'),
    'WORKSPACE_ACTION_RECEIPT_NO_CHANGE_MISMATCH',
  ));
  check('workspace_resource_identity_is_checked', expectReject(
    () => workspaceReceiptAfter([{ ...resources[0], relativePath: `${WORKSPACE_A}/wrong` }, resources[1]], base),
    'WORKSPACE_ACTION_RECEIPT_RESOURCE_INVALID',
  ));
  check('workspace_id_is_checked', expectReject(
    () => workspaceReceiptResources('not-a-workspace', base),
    'WORKSPACE_ACTION_RECEIPT_ID_INVALID',
  ));

  const recordA = structuralRecord(WORKSPACE_A);
  const recordB = structuralRecord(WORKSPACE_B, { contentReceiptHash: HASH_B, snapshotReceiptHash: HASH_C, head: 'b'.repeat(16), origin: 'selftest:registry:b' });
  const registryRecords = [recordA, recordB];
  const registryHash = workspaceRegistryReceiptHash(WORKSPACE_A, registryRecords);
  check('registry_hash_is_64_hex', /^[a-f0-9]{64}$/.test(registryHash));
  check('registry_hash_is_record_order_stable', registryHash === workspaceRegistryReceiptHash(WORKSPACE_A, [recordB, recordA]));
  check('registry_hash_emits_no_workspace_payload', !registryHash.includes('Workspace A') && !registryHash.includes('selftest'));
  check('registry_hash_includes_default_identity', registryHash !== workspaceRegistryReceiptHash(WORKSPACE_B, registryRecords));
  check('registry_duplicate_id_is_rejected', expectReject(
    () => workspaceRegistryReceiptHash(WORKSPACE_A, [recordA, recordA]),
    'WORKSPACE_ACTION_RECEIPT_REGISTRY_DUPLICATE',
  ));
  check('registry_default_missing_is_rejected', expectReject(
    () => workspaceRegistryReceiptHash(WORKSPACE_C, registryRecords),
    'WORKSPACE_ACTION_RECEIPT_REGISTRY_DEFAULT_MISSING',
  ));
  check('registry_malformed_record_is_rejected', expectReject(
    () => workspaceRegistryReceiptHash(WORKSPACE_A, [{ ...recordA, origin: undefined }]),
    'WORKSPACE_ACTION_RECEIPT_REGISTRY_INVALID',
  ));
  check('registry_legacy_head_must_remain_legacy_width', expectReject(
    () => workspaceRegistryReceiptHash(WORKSPACE_A, [{ ...recordA, head: HASH_A }]),
    'WORKSPACE_ACTION_RECEIPT_REGISTRY_INVALID',
  ));
  check('registry_full_hashes_are_required', expectReject(
    () => workspaceRegistryReceiptHash(WORKSPACE_A, [{ ...recordA, contentReceiptHash: 'a'.repeat(16) }]),
    'WORKSPACE_ACTION_RECEIPT_HASH_INVALID',
  ));
  check('summary_hash_names_cannot_masquerade_as_receipt_hashes', expectReject(
    () => workspaceRegistryReceiptHash(WORKSPACE_A, [{
      workspaceId: WORKSPACE_A,
      workspaceHash: 'a'.repeat(16),
      snapshotHash: 'b'.repeat(16),
      head: 'a'.repeat(16),
      version: 1,
      createdAt: '2026-08-03T00:00:00.000Z',
      savedAt: '2026-08-03T00:01:00.000Z',
      origin: 'selftest:summary-shaped',
    }]),
    'WORKSPACE_ACTION_RECEIPT_REGISTRY_INVALID',
  ));

  const fields: Array<[string, WorkspaceRegistryReceiptRecord]> = [
    ['workspace_id', { ...recordB, workspaceId: WORKSPACE_C }],
    ['content_receipt_hash', { ...recordB, contentReceiptHash: 'd'.repeat(64) }],
    ['snapshot_receipt_hash', { ...recordB, snapshotReceiptHash: 'e'.repeat(64) }],
    ['legacy_head', { ...recordB, head: 'c'.repeat(16) }],
    ['version', { ...recordB, version: 2 }],
    ['created_at', { ...recordB, createdAt: '2026-08-04T00:00:00.000Z' }],
    ['saved_at', { ...recordB, savedAt: '2026-08-04T00:01:00.000Z' }],
    ['origin', { ...recordB, origin: 'selftest:registry:changed' }],
  ];
  for (const [name, changedRecord] of fields) {
    check(`registry_${name}_changes_hash`, registryHash !== workspaceRegistryReceiptHash(WORKSPACE_A, [recordA, changedRecord]));
  }

  const registryResource = workspaceRegistryReceiptResource(WORKSPACE_A, registryRecords);
  check('registry_resource_has_logical_root_and_path', registryResource.role === 'data'
    && registryResource.root === 'workspace-registry'
    && registryResource.relativePath === 'registry'
    && registryResource.beforeHash === registryHash);
  const registryAfter = workspaceRegistryReceiptAfter(registryResource, WORKSPACE_A, registryRecords, 'no_change');
  check('registry_no_change_after_matches_aggregate', registryAfter.outcome === 'no_change'
    && registryAfter.resources.length === 1
    && registryAfter.resources[0].hash === registryHash);
  check('registry_after_resource_helper_matches', workspaceRegistryReceiptAfterResource(registryResource, WORKSPACE_A, registryRecords).hash === registryHash);
  check('registry_no_change_rejects_changed_snapshot', expectReject(
    () => workspaceRegistryReceiptAfter(registryResource, WORKSPACE_A, [recordA, { ...recordB, origin: 'changed' }], 'no_change'),
    'WORKSPACE_ACTION_RECEIPT_NO_CHANGE_MISMATCH',
  ));

  const requestFacts = {
    routeKey: 'POST /api/agent/workspace',
    mode: 'replace',
    expectedHead: 'a'.repeat(16),
    expectedSnapshotHash: HASH_B,
    expectedVersion: 7,
    force: false,
    dryRun: false,
    proposedContentHash: HASH_C,
    proposedSnapshotHash: HASH_A,
    sourceHash: HASH_B,
  };
  const requestReordered = {
    sourceHash: HASH_B,
    proposedSnapshotHash: HASH_A,
    proposedContentHash: HASH_C,
    dryRun: false,
    force: false,
    expectedVersion: 7,
    expectedSnapshotHash: HASH_B,
    expectedHead: 'a'.repeat(16),
    mode: 'replace',
    routeKey: 'POST /api/agent/workspace',
  };
  check('request_facts_hash_is_64_hex', /^[a-f0-9]{64}$/.test(hashWorkspaceActionRequestFacts(requestFacts)));
  check('request_facts_hash_is_key_order_stable', hashWorkspaceActionFactsEqual(requestFacts, requestReordered));
  check('request_facts_detect_material_change', hashWorkspaceActionRequestFacts(requestFacts) !== hashWorkspaceActionRequestFacts({ ...requestFacts, force: true }));
  check('request_facts_reject_unknown_workspace_payload', expectReject(
    () => hashWorkspaceActionRequestFacts({ ...requestFacts, workspace: base }),
    'WORKSPACE_ACTION_RECEIPT_REQUEST_FACTS_UNKNOWN',
  ));
  check('request_facts_reject_raw_body', expectReject(
    () => hashWorkspaceActionRequestFacts({ ...requestFacts, body: 'raw-secret' }),
    'WORKSPACE_ACTION_RECEIPT_REQUEST_FACTS_UNKNOWN',
    'raw-secret',
  ));
  check('request_facts_reject_absolute_path', expectReject(
    () => hashWorkspaceActionRequestFacts({ ...requestFacts, mode: 'C:\\secret\\workspace' }),
    'WORKSPACE_ACTION_RECEIPT_REQUEST_FACTS_INVALID',
  ));
  check('request_facts_reject_nonfull_proposed_hash', expectReject(
    () => hashWorkspaceActionRequestFacts({ ...requestFacts, proposedContentHash: 'a'.repeat(16) }),
    'WORKSPACE_ACTION_RECEIPT_HASH_INVALID',
  ));
  check('request_facts_reject_unpaired_proposed_hash', expectReject(
    () => hashWorkspaceActionRequestFacts({ ...requestFacts, proposedSnapshotHash: undefined }),
    'WORKSPACE_ACTION_RECEIPT_REQUEST_FACTS_INVALID',
  ));
  check('request_facts_reject_secret_field', expectReject(
    () => hashWorkspaceActionRequestFacts({ ...requestFacts, token: 'x4fk_secret-token' }),
    'WORKSPACE_ACTION_RECEIPT_REQUEST_FACTS_UNKNOWN',
    'x4fk_secret-token',
  ));

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

function hashWorkspaceActionFactsEqual(left: unknown, right: unknown): boolean {
  return hashWorkspaceActionRequestFacts(left) === hashWorkspaceActionRequestFacts(right);
}

const invokedDirectly = process.argv[1]?.endsWith('workspaceActionReceipt.selftest.ts') === true;
if (invokedDirectly) {
  const result = runWorkspaceActionReceiptSelftest();
  console.log(JSON.stringify(result, null, 2));
  if (!result.allPassed) process.exitCode = 1;
}
