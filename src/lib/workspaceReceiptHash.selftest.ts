import { createHash } from 'node:crypto';

import type { ModWorkspace } from '../types';
import {
  canonicalWorkspaceContentPayload,
  canonicalWorkspaceContentString,
  canonicalWorkspaceSnapshotString,
  runWorkspaceIdentitySelftest,
  stableStringify,
  workspaceContentHash,
  workspaceSnapshotHash,
} from './workspaceIdentity';
import {
  workspaceContentReceiptHash,
  workspaceSnapshotReceiptHash,
} from './workspaceReceiptHash';

const LEGACY_CONTENT_FIXTURE_HASH = 'c616589ddd4fd2a7';
const LEGACY_SNAPSHOT_FIXTURE_HASH = 'c616589ddd4fd2a7';

interface SelftestCheck {
  name: string;
  pass: boolean;
  detail?: string;
}

export interface WorkspaceReceiptHashSelftestResult {
  allPassed: boolean;
  pass: boolean;
  passed: number;
  total: number;
  failures: string[];
  checks: SelftestCheck[];
}

function sha256Oracle(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function runWorkspaceReceiptHashSelftest(): WorkspaceReceiptHashSelftestResult {
  const checks: SelftestCheck[] = [];
  const check = (name: string, pass: boolean, detail?: string): void => {
    checks.push({ name, pass: !!pass, ...(detail === undefined ? {} : { detail }) });
  };

  const base = {
    name: 'M',
    nodes: [{ id: 'n1', type: 'cue', properties: { name: 'Start', b: 1, a: 2 } }],
    links: [{ sourceNodeId: 'n1', targetNodeId: 'n2' }],
  } as unknown as ModWorkspace;
  const reordered = {
    links: [{ targetNodeId: 'n2', sourceNodeId: 'n1' }],
    nodes: [{ properties: { a: 2, b: 1, name: 'Start' }, type: 'cue', id: 'n1' }],
    name: 'M',
  } as unknown as ModWorkspace;

  const contentCanonical = canonicalWorkspaceContentString(base);
  const snapshotCanonical = canonicalWorkspaceSnapshotString(base);
  const contentReceipt = workspaceContentReceiptHash(base);
  const snapshotReceipt = workspaceSnapshotReceiptHash(base);

  check('existing_workspace_identity_selftest_green', runWorkspaceIdentitySelftest().allPassed);
  check('legacy_content_fixture_regression', workspaceContentHash(base) === LEGACY_CONTENT_FIXTURE_HASH);
  check('legacy_snapshot_fixture_regression', workspaceSnapshotHash(base) === LEGACY_SNAPSHOT_FIXTURE_HASH);
  check(
    'content_receipt_matches_independent_sha256_oracle',
    contentReceipt === sha256Oracle(contentCanonical) && /^[a-f0-9]{64}$/.test(contentReceipt),
    contentReceipt,
  );
  check(
    'snapshot_receipt_matches_independent_sha256_oracle',
    snapshotReceipt === sha256Oracle(snapshotCanonical) && /^[a-f0-9]{64}$/.test(snapshotReceipt),
    snapshotReceipt,
  );
  check(
    'receipts_hash_canonical_strings_not_legacy_short_digests',
    contentReceipt !== sha256Oracle(workspaceContentHash(base))
      && snapshotReceipt !== sha256Oracle(workspaceSnapshotHash(base)),
  );
  check(
    'content_payload_exposes_only_legacy_authority_fields',
    stableStringify(canonicalWorkspaceContentPayload(base)) === contentCanonical,
  );
  check(
    'key_order_is_stable',
    canonicalWorkspaceContentString(reordered) === contentCanonical
      && canonicalWorkspaceSnapshotString(reordered) === snapshotCanonical
      && workspaceContentReceiptHash(reordered) === contentReceipt
      && workspaceSnapshotReceiptHash(reordered) === snapshotReceipt,
  );
  check(
    'json_round_trip_is_stable',
    workspaceContentReceiptHash(JSON.parse(JSON.stringify(base)) as ModWorkspace) === contentReceipt
      && workspaceSnapshotReceiptHash(JSON.parse(JSON.stringify(base)) as ModWorkspace) === snapshotReceipt,
  );

  const withUndefined = { ...base, customLua: undefined } as unknown as ModWorkspace;
  const snapshotWithUndefined = { ...base, transientUiState: undefined } as unknown as ModWorkspace;
  check(
    'undefined_object_fields_follow_stable_stringify',
    workspaceContentReceiptHash(withUndefined) === contentReceipt
      && workspaceSnapshotReceiptHash(snapshotWithUndefined) === snapshotReceipt,
  );
  check(
    'undefined_array_items_follow_stable_stringify',
    stableStringify([undefined]) === stableStringify([null]),
  );

  const editedNode = JSON.parse(JSON.stringify(base)) as ModWorkspace;
  editedNode.nodes[0].properties.name = 'Start2';
  const linkEdit = JSON.parse(JSON.stringify(base)) as ModWorkspace;
  (linkEdit.links as unknown[]).push({ sourceNodeId: 'n2', targetNodeId: 'n3' });
  const renamed = { ...base, name: 'M2' } as ModWorkspace;
  check(
    'content_receipt_detects_each_existing_substance_example',
    workspaceContentReceiptHash(editedNode) !== contentReceipt
      && workspaceContentReceiptHash(linkEdit) !== contentReceipt
      && workspaceContentReceiptHash(renamed) !== contentReceipt,
  );

  const uiChanged = {
    ...base,
    uiTheme: { backgroundColor: '#000', borderColor: '#111', accentColor: '#222', opacity: 1, showIcons: true },
  } as unknown as ModWorkspace;
  const idChanged = { ...uiChanged, id: 'different-legacy-local-id' } as unknown as ModWorkspace;
  check(
    'snapshot_receipt_detects_non_cas_changes_without_content_change',
    workspaceContentReceiptHash(uiChanged) === contentReceipt
      && workspaceContentReceiptHash(idChanged) === contentReceipt
      && workspaceSnapshotReceiptHash(uiChanged) !== snapshotReceipt
      && workspaceSnapshotReceiptHash(idChanged) !== workspaceSnapshotReceiptHash(uiChanged),
  );

  const nullContentString = canonicalWorkspaceContentString(null);
  const undefinedContentString = canonicalWorkspaceContentString(undefined);
  const nullSnapshotString = canonicalWorkspaceSnapshotString(null);
  const undefinedSnapshotString = canonicalWorkspaceSnapshotString(undefined);
  check(
    'null_and_undefined_are_explicit_and_deterministic',
    nullContentString === 'null'
      && undefinedContentString === 'null'
      && nullSnapshotString === 'null'
      && undefinedSnapshotString === 'null'
      && workspaceContentReceiptHash(null) === sha256Oracle('null')
      && workspaceContentReceiptHash(undefined) === workspaceContentReceiptHash(null)
      && workspaceSnapshotReceiptHash(null) === sha256Oracle('null')
      && workspaceSnapshotReceiptHash(undefined) === workspaceSnapshotReceiptHash(null)
      && workspaceContentReceiptHash(null) !== workspaceContentHash(null)
      && workspaceSnapshotReceiptHash(null) !== workspaceSnapshotHash(null),
  );

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

const invokedDirectly = process.argv[1]?.endsWith('workspaceReceiptHash.selftest.ts') === true;
if (invokedDirectly) {
  const result = runWorkspaceReceiptHashSelftest();
  console.log(JSON.stringify(result, null, 2));
  if (!result.allPassed) process.exitCode = 1;
}
