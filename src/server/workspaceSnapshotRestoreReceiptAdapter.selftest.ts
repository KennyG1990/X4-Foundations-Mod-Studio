import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  assertValidActionReceipt,
  hashActionReceiptOperationIdentity,
  serializeActionReceipt,
  type ActionReceipt,
} from '../lib/actionReceipt';
import { mapRuntimeReceiptIdentity } from '../lib/actionReceiptRuntime';
import { ActionReceiptStore } from '../lib/actionReceiptStore';
import { DestructiveRecoveryStore } from '../lib/destructiveRecovery';
import { WorkspaceRegistry } from '../lib/workspaceRegistry';
import {
  workspaceContentReceiptHash,
  workspaceSnapshotReceiptHash,
} from '../lib/workspaceReceiptHash';
import { sanitizeWorkspace, type ModWorkspace } from '../types';
import {
  executeWorkspaceSnapshotRestoreReceipt,
  prepareWorkspaceSnapshotRestoreReceiptFacts,
  type WorkspaceSnapshotRestoreReceiptAdapterDependencies,
  type WorkspaceSnapshotRestoreReceiptAdapterInput,
  type WorkspaceSnapshotRestoreReceiptAdapterResult,
} from './workspaceSnapshotRestoreReceiptAdapter';
import {
  WorkspaceSnapshotSourceError,
  readWorkspaceSnapshotSource,
  type WorkspaceSnapshotFileSource,
} from './workspaceSnapshotSource';
import { WorkspaceReceiptService } from './workspaceReceiptService';

const RAW_BODY_MARKER = 'snapshot-restore-selftest-raw-body-5e2f77';
const RAW_TOKEN_MARKER = 'token_snapshot_restore_selftest_4e0a91';
const RAW_NATIVE_ERROR_MARKER = 'native-snapshot-restore-selftest-error-91d4c2';
const SOURCE_SAVED_AT = '2026-08-06T12:34:56.000Z';
const SOURCE_MOD_ID = 'mod_snapshot_restore_selftest';
const SOURCE_NAME = 'Snapshot Restore Selftest';
const SNAPSHOT_NAME = 'snapshot_restore_selftest.json';
const FIXED_NOW = Date.parse('2026-08-06T12:00:00.000Z');

export interface WorkspaceSnapshotRestoreReceiptAdapterSelftestCheck {
  name: string;
  pass: boolean;
  detail?: string;
}

export interface WorkspaceSnapshotRestoreReceiptAdapterSelftestResult {
  allPassed: boolean;
  pass: boolean;
  passed: number;
  total: number;
  failures: string[];
  checks: WorkspaceSnapshotRestoreReceiptAdapterSelftestCheck[];
}

function workspaceFixture(id: string, name: string, description: string, nodeSuffix = 'one'): ModWorkspace {
  return {
    id,
    name,
    version: '1.0.0',
    author: 'Forge Selftest',
    description,
    nodes: [{
      id: `${id}_node_${nodeSuffix}`,
      type: 'cue',
      label: 'Snapshot Restore Cue',
      xmlTag: 'cue',
      x: 100,
      y: 100,
      properties: { text: 'stable snapshot fixture' },
      propertiesSchema: [],
      inputs: [],
      outputs: [],
    }],
    links: [],
    uiWidgets: [],
    uiTheme: {
      backgroundColor: '#101820',
      borderColor: '#204060',
      accentColor: '#40a0c0',
      opacity: 0.95,
      showIcons: true,
    },
    templates: [],
  };
}

function sourceEnvelope(workspace: ModWorkspace, body = RAW_BODY_MARKER): Record<string, unknown> {
  return {
    savedAt: SOURCE_SAVED_AT,
    name: SOURCE_NAME,
    modId: SOURCE_MOD_ID,
    workspace: {
      ...workspace,
      description: body,
    },
  };
}

function snapshotBytes(workspace: ModWorkspace, body = RAW_BODY_MARKER): Buffer {
  return Buffer.from(JSON.stringify(sourceEnvelope(workspace, body)), 'utf8');
}

function writeSnapshot(root: string, workspace: ModWorkspace, body = RAW_BODY_MARKER): string {
  const directory = path.join(root, SOURCE_MOD_ID, '.snapshots');
  fs.mkdirSync(directory, { recursive: true });
  const target = path.join(directory, SNAPSHOT_NAME);
  fs.writeFileSync(target, snapshotBytes(workspace, body));
  return target;
}

function summarize(
  checks: WorkspaceSnapshotRestoreReceiptAdapterSelftestCheck[],
): WorkspaceSnapshotRestoreReceiptAdapterSelftestResult {
  const failures = checks.filter(check => !check.pass).map(check => check.name);
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

function check(
  checks: WorkspaceSnapshotRestoreReceiptAdapterSelftestCheck[],
  name: string,
  assertion: () => boolean,
): void {
  try {
    checks.push({ name, pass: assertion() });
  } catch {
    checks.push({ name, pass: false });
  }
}

function checkAsync(
  checks: WorkspaceSnapshotRestoreReceiptAdapterSelftestCheck[],
  name: string,
  assertion: () => Promise<boolean>,
): Promise<void> {
  return assertion()
    .then(pass => { checks.push({ name, pass }); })
    .catch(() => { checks.push({ name, pass: false }); });
}

interface RegistryEvidenceEntry {
  workspaceId: string;
  version: number;
  head: string;
  snapshotHash: string;
  recordJson: string;
  summaryJson: string;
}

interface RegistryEvidence {
  defaultWorkspaceId: string;
  entries: RegistryEvidenceEntry[];
}

function captureRegistry(registry: WorkspaceRegistry): RegistryEvidence {
  return {
    defaultWorkspaceId: registry.defaultWorkspaceId,
    entries: registry.list().map(summary => {
      const found = registry.lookup(summary.workspaceId);
      if (!found.ok) throw new Error('registry evidence unavailable');
      return {
        workspaceId: summary.workspaceId,
        version: found.record.version,
        head: found.record.head,
        snapshotHash: summary.snapshotHash,
        recordJson: JSON.stringify(found.record),
        summaryJson: JSON.stringify(summary),
      };
    }),
  };
}

function sameRegistry(left: RegistryEvidence, right: RegistryEvidence): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function directoryBytes(directory: string): string {
  if (!fs.existsSync(directory)) return '[]';
  const entries: Array<{ relative: string; bytes: string }> = [];
  const visit = (current: string): void => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile()) {
        entries.push({
          relative: path.relative(directory, absolute).replace(/\\/g, '/'),
          bytes: fs.readFileSync(absolute).toString('base64'),
        });
      } else throw new Error('directory evidence unavailable');
    }
  };
  visit(directory);
  entries.sort((left, right) => left.relative.localeCompare(right.relative));
  return JSON.stringify(entries);
}

function receiptFileCount(store: ActionReceiptStore): number {
  if (!fs.existsSync(store.root)) return 0;
  return fs.readdirSync(store.root, { withFileTypes: true })
    .filter(entry => entry.isFile() && /^ar_[a-f0-9]{64}\.json$/.test(entry.name))
    .length;
}

function recoveryEntryCount(store: DestructiveRecoveryStore): number {
  if (!fs.existsSync(store.root)) return 0;
  return fs.readdirSync(store.root, { withFileTypes: true })
    .filter(entry => entry.isDirectory()).length;
}

function pathMarkers(root: string): string[] {
  const forward = root.replace(/\\/g, '/');
  const back = root.replace(/\//g, '\\');
  return [forward, back, JSON.stringify(back).slice(1, -1)];
}

function noRawValues(value: unknown, values: readonly string[]): boolean {
  const serialized = typeof value === 'string' ? value : JSON.stringify(value);
  return serialized !== undefined && values.every(marker => marker.length === 0 || !serialized.includes(marker));
}

function allStoredReceiptBytesAreRedacted(store: ActionReceiptStore, markers: readonly string[]): boolean {
  if (!fs.existsSync(store.root)) return true;
  for (const entry of fs.readdirSync(store.root, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    const bytes = fs.readFileSync(path.join(store.root, entry.name), 'utf8');
    if (!noRawValues(bytes, markers)) return false;
  }
  return true;
}

function receiptReadback(store: ActionReceiptStore, id: string): ActionReceipt | undefined {
  try {
    const receipt = assertValidActionReceipt(store.read(id));
    const bytes = fs.readFileSync(store.pathFor(id), 'utf8');
    return bytes === serializeActionReceipt(receipt) ? receipt : undefined;
  } catch {
    return undefined;
  }
}

function asFailure(
  result: WorkspaceSnapshotRestoreReceiptAdapterResult,
  code: string,
): boolean {
  return result.ok === false && result.code === code && result.replayed === false;
}

function differentLegacyHash(value: string): string {
  return `${value.startsWith('0') ? 'f' : '0'}${value.slice(1)}`;
}

function hasSingleTerminalFailureReceipt(
  result: WorkspaceSnapshotRestoreReceiptAdapterResult,
  store: ActionReceiptStore,
  projections: readonly unknown[],
): boolean {
  if (result.ok || result.receipt === undefined) return false;
  const reopened = receiptReadback(store, result.receipt.id);
  return receiptFileCount(store) === 1
    && projections.length === 1
    && JSON.stringify(projections[0]) === JSON.stringify(result.receipt)
    && result.receipt.status !== 'committed'
    && reopened !== undefined
    && reopened.status !== 'committed'
    && reopened.id === result.receipt.id
    && reopened.hash === result.receipt.hash;
}

function makeOwners(
  root: string,
  scope: string,
  workspace: ModWorkspace,
  now: () => number,
  randomHex: (bytes: number) => string,
): {
  registry: WorkspaceRegistry;
  store: ActionReceiptStore;
  recoveryStore: DestructiveRecoveryStore;
  receiptService: WorkspaceReceiptService;
} {
  const scopedRoot = path.join(root, scope);
  return {
    registry: new WorkspaceRegistry({
      root: path.join(scopedRoot, 'workspace-registry'),
      defaultWorkspace: workspace,
      now,
      randomHex,
    }),
    store: new ActionReceiptStore({ root: path.join(scopedRoot, 'action-receipts'), now }),
    recoveryStore: new DestructiveRecoveryStore({ root: path.join(scopedRoot, 'recovery'), now }),
    receiptService: new WorkspaceReceiptService(),
  };
}

function makeInput(
  owners: ReturnType<typeof makeOwners>,
  root: string,
  operationId: unknown,
  overrides: Partial<WorkspaceSnapshotRestoreReceiptAdapterInput> = {},
): WorkspaceSnapshotRestoreReceiptAdapterInput {
  const found = owners.registry.lookup(owners.registry.defaultWorkspaceId);
  if (!found.ok) throw new Error('workspace fixture unavailable');
  return {
    root,
    workspaceId: owners.registry.defaultWorkspaceId,
    modId: SOURCE_MOD_ID,
    snapshotName: SNAPSHOT_NAME,
    expectedHead: found.record.head,
    expectedSnapshotHash: owners.registry.snapshotHash(found.record),
    operationId,
    identity: {
      kind: 'studio',
      clientId: 'client_snapshot_restore_selftest',
      version: '1.0.0',
    },
    ...overrides,
    ...(overrides.root === undefined && root !== undefined ? { root } : {}),
    ...(overrides.workspaceId === undefined ? { workspaceId: owners.registry.defaultWorkspaceId } : {}),
    ...(overrides.modId === undefined ? { modId: SOURCE_MOD_ID } : {}),
    ...(overrides.snapshotName === undefined ? { snapshotName: SNAPSHOT_NAME } : {}),
    ...(overrides.expectedHead === undefined ? { expectedHead: found.record.head } : {}),
    ...(overrides.expectedSnapshotHash === undefined ? { expectedSnapshotHash: owners.registry.snapshotHash(found.record) } : {}),
    ...(overrides.identity === undefined ? {
      identity: {
        kind: 'studio',
        clientId: 'client_snapshot_restore_selftest',
        version: '1.0.0',
      },
    } : {}),
  };
}

function validSource(root: string, workspace: ModWorkspace, body = RAW_BODY_MARKER): WorkspaceSnapshotFileSource {
  writeSnapshot(root, workspace, body);
  return readWorkspaceSnapshotSource({
    root,
    modId: SOURCE_MOD_ID,
    snapshotName: SNAPSHOT_NAME,
  });
}

export async function runWorkspaceSnapshotRestoreReceiptAdapterSelftest(): Promise<WorkspaceSnapshotRestoreReceiptAdapterSelftestResult> {
  const checks: WorkspaceSnapshotRestoreReceiptAdapterSelftestCheck[] = [];
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'x4forge-snapshot-restore-receipt-adapter-'));
  let currentNow = FIXED_NOW;
  let randomSequence = 1;
  const randomHex = (bytes: number): string => {
    let output = '';
    while (output.length < bytes * 2) {
      output += crypto.createHash('sha256')
        .update(`workspace-snapshot-restore-selftest:${randomSequence++}`, 'utf8')
        .digest('hex');
    }
    return output.slice(0, bytes * 2);
  };
  const observedFailureResults: WorkspaceSnapshotRestoreReceiptAdapterResult[] = [];
  const observedProjectionChannels: unknown[] = [];
  const observedReceiptStores: ActionReceiptStore[] = [];
  const observedIsolation: boolean[] = [];
  const boundaryFailureResults: WorkspaceSnapshotRestoreReceiptAdapterResult[] = [];
  const boundaryProjectionChannels: unknown[] = [];
  const boundaryReceiptStores: ActionReceiptStore[] = [];
  const boundaryIsolation: boolean[] = [];

  try {
    const beforeWorkspace = workspaceFixture(
      'workspace_before_snapshot_restore',
      'Before Snapshot Restore',
      'before snapshot restore state',
      'before',
    );
    const explicitTargetId = 'workspace_explicit_snapshot_target';
    const targetWorkspace = workspaceFixture(
      explicitTargetId,
      'Explicit Snapshot Target',
      'target snapshot restore state',
      'target',
    );
    const sensitiveBody = [RAW_BODY_MARKER, RAW_TOKEN_MARKER, RAW_NATIVE_ERROR_MARKER].join('|');
    const owners = makeOwners(root, 'core', beforeWorkspace, () => currentNow, randomHex);
    const addressedWorkspaceId = owners.registry.defaultWorkspaceId;
    const beforeLookup = owners.registry.lookup(addressedWorkspaceId);
    if (!beforeLookup.ok) throw new Error('selftest workspace unavailable');
    const beforeRecord = beforeLookup.record;
    const beforeSnapshotHash = owners.registry.snapshotHash(beforeRecord);
    const source = validSource(root, targetWorkspace, sensitiveBody);
    const snapshotDirectory = path.join(root, SOURCE_MOD_ID, '.snapshots');
    const snapshotDirectoryBefore = directoryBytes(snapshotDirectory);
    const capturedProjections: unknown[] = [];
    const dependencies: WorkspaceSnapshotRestoreReceiptAdapterDependencies = {
      registry: owners.registry,
      store: owners.store,
      recoveryStore: owners.recoveryStore,
      receiptService: owners.receiptService,
      captureProjection: projection => {
        capturedProjections.push(projection === undefined
          ? undefined
          : JSON.parse(JSON.stringify(projection)) as unknown);
      },
    };
    const operationId = 'workspace.snapshot.restore.selftest';
    const input = makeInput(owners, root, operationId);
    const factsResult = prepareWorkspaceSnapshotRestoreReceiptFacts(dependencies, input);
    const hash64 = /^[a-f0-9]{64}$/;

    check(checks, 'source_and_facts_bind_explicit_target_to_addressed_workspace', () => {
      if (!factsResult.ok) return false;
      const targetContent = factsResult.facts.targetResources.find(resource => resource.role === 'workspace');
      const targetSnapshot = factsResult.facts.targetResources.find(resource => resource.role === 'snapshot');
      return /^ws_[a-f0-9]{24}$/i.test(addressedWorkspaceId)
        && explicitTargetId !== addressedWorkspaceId
        && source.workspace.id === explicitTargetId
        && factsResult.facts.workspaceId === addressedWorkspaceId
        && factsResult.facts.targetWorkspace.id === explicitTargetId
        && factsResult.facts.changed
        && targetContent?.beforeHash === workspaceContentReceiptHash(source.workspace)
        && targetSnapshot?.beforeHash === workspaceSnapshotReceiptHash(source.workspace)
        && hash64.test(targetContent.beforeHash)
        && hash64.test(targetSnapshot.beforeHash);
    });

    currentNow += 1;
    const first = await executeWorkspaceSnapshotRestoreReceipt(dependencies, input);
    const afterFirstLookup = owners.registry.lookup(addressedWorkspaceId);
    const receiptsAfterFirst = receiptFileCount(owners.store);
    const recoveriesAfterFirst = recoveryEntryCount(owners.recoveryStore);

    check(checks, 'first_execution_commits_once_and_preserves_explicit_target_id', () => (
      first.ok
      && first.applied
      && !first.replayed
      && first.receipt.status === 'committed'
      && first.record.workspaceId === addressedWorkspaceId
      && first.record.workspace.id === explicitTargetId
      && first.record.workspace.description === sensitiveBody
      && first.record.version === beforeRecord.version + 1
      && afterFirstLookup.ok
      && afterFirstLookup.record.version === first.record.version
      && afterFirstLookup.record.workspace.id === explicitTargetId
      && capturedProjections.length === 1
      && JSON.stringify(capturedProjections[0]) === JSON.stringify(first.receipt)
      && receiptsAfterFirst === 1
      && recoveriesAfterFirst === 1
    ));

    const reopened = first.ok ? receiptReadback(owners.store, first.receipt.id) : undefined;
    const actualTargetContentHash = first.ok ? workspaceContentReceiptHash(first.record.workspace) : '';
    const actualTargetSnapshotHash = first.ok ? workspaceSnapshotReceiptHash(first.record.workspace) : '';

    check(checks, 'authoritative_receipt_binds_addressed_resources_and_complete_target_hashes', () => {
      if (!first.ok || reopened === undefined || !factsResult.ok) return false;
      const expectedPath = (role: string): string | undefined => role === 'workspace'
        ? `${addressedWorkspaceId}/content`
        : role === 'snapshot'
          ? `${addressedWorkspaceId}/snapshot`
          : undefined;
      const authorityPathsMatch = reopened.authority.resources.length === 2
        && reopened.authority.resources.every(resource => resource.root === 'workspace'
          && resource.relativePath === expectedPath(resource.role));
      const afterPathsMatch = reopened.after?.resources.length === 2
        && reopened.after.resources.every(resource => resource.root === 'workspace'
          && resource.relativePath === expectedPath(resource.role));
      const beforeWorkspaceResource = reopened.authority.resources.find(resource => resource.role === 'workspace');
      const beforeSnapshotResource = reopened.authority.resources.find(resource => resource.role === 'snapshot');
      const expectedBeforeWorkspaceResource = factsResult.facts.beforeResources.find(resource => resource.role === 'workspace');
      const expectedBeforeSnapshotResource = factsResult.facts.beforeResources.find(resource => resource.role === 'snapshot');
      const targetWorkspaceResource = factsResult.facts.targetResources.find(resource => resource.role === 'workspace');
      const targetSnapshotResource = factsResult.facts.targetResources.find(resource => resource.role === 'snapshot');
      const afterWorkspaceResource = reopened.after?.resources.find(resource => resource.role === 'workspace');
      const afterSnapshotResource = reopened.after?.resources.find(resource => resource.role === 'snapshot');
      return reopened.id === first.receipt.id
        && reopened.hash === first.receipt.hash
        && reopened.status === 'committed'
        && reopened.authority.scope === 'workspace'
        && reopened.authority.workspaceId === addressedWorkspaceId
        && reopened.authority.operationId === operationId
        && reopened.authority.requestScope === `workspace-${addressedWorkspaceId}`
        && authorityPathsMatch
        && afterPathsMatch
        && beforeWorkspaceResource?.beforeHash === expectedBeforeWorkspaceResource?.beforeHash
        && beforeSnapshotResource?.beforeHash === expectedBeforeSnapshotResource?.beforeHash
        && targetWorkspaceResource?.beforeHash === actualTargetContentHash
        && targetSnapshotResource?.beforeHash === actualTargetSnapshotHash
        && afterWorkspaceResource?.hash === actualTargetContentHash
        && afterSnapshotResource?.hash === actualTargetSnapshotHash
        && hash64.test(actualTargetContentHash)
        && hash64.test(actualTargetSnapshotHash)
        && reopened.after?.outcome === 'applied'
        && reopened.rollback.required
        && reopened.rollback.mode === 'recovery'
        && reopened.rollback.reference === reopened.id;
    });

    const recovery = first.ok ? owners.recoveryStore.read(first.receipt.id) : undefined;
    check(checks, 'recovery_is_ready_with_exact_paired_before_and_target_guards', () => (
      first.ok
      && factsResult.ok
      && recovery !== undefined
      && recovery.ok
      && recovery.record.kind === 'workspace'
      && recovery.record.status === 'ready'
      && recovery.record.id === first.receipt.id
      && recovery.record.workspaceId === addressedWorkspaceId
      && recovery.record.beforeHash === beforeRecord.head
      && recovery.record.beforeSnapshotHash === beforeSnapshotHash
      && recovery.record.expectedCurrentHash === actualTargetContentHash
      && recovery.record.expectedCurrentSnapshotHash === actualTargetSnapshotHash
      && workspaceContentReceiptHash(recovery.record.beforeWorkspace as ModWorkspace)
        === factsResult.facts.beforeResources.find(resource => resource.role === 'workspace')?.beforeHash
      && workspaceSnapshotReceiptHash(recovery.record.beforeWorkspace as ModWorkspace)
        === factsResult.facts.beforeResources.find(resource => resource.role === 'snapshot')?.beforeHash
    ));

    const registryBeforeReplay = captureRegistry(owners.registry);
    const receiptCountBeforeReplay = receiptFileCount(owners.store);
    const recoveryCountBeforeReplay = recoveryEntryCount(owners.recoveryStore);
    const replay = await executeWorkspaceSnapshotRestoreReceipt(dependencies, input);
    const registryAfterReplay = captureRegistry(owners.registry);

    check(checks, 'exact_replay_reuses_receipt_without_second_version_advance', () => (
      first.ok
      && replay.ok
      && replay.replayed
      && !replay.applied
      && replay.receipt.status === 'committed'
      && replay.receipt.id === first.receipt.id
      && replay.receipt.hash === first.receipt.hash
      && replay.record.version === first.record.version
      && replay.record.workspace.id === explicitTargetId
      && sameRegistry(registryBeforeReplay, registryAfterReplay)
      && receiptFileCount(owners.store) === receiptCountBeforeReplay
      && recoveryEntryCount(owners.recoveryStore) === recoveryCountBeforeReplay
      && directoryBytes(snapshotDirectory) === snapshotDirectoryBefore
      && capturedProjections.length === 2
      && JSON.stringify(capturedProjections[1]) === JSON.stringify(first.receipt)
    ));

    await checkAsync(checks, 'receipt_projection_failure_and_check_details_are_redacted', async () => {
      const markers = [
        ...pathMarkers(root),
        RAW_BODY_MARKER,
        RAW_TOKEN_MARKER,
        RAW_NATIVE_ERROR_MARKER,
      ];
      const failureProjections: unknown[] = [];
      const failureDependencies: WorkspaceSnapshotRestoreReceiptAdapterDependencies = {
        ...dependencies,
        readSource: () => {
          throw new Error(`${RAW_NATIVE_ERROR_MARKER}|${RAW_TOKEN_MARKER}|${root}`);
        },
        captureProjection: projection => {
          failureProjections.push(projection);
        },
      };
      const failureInput = makeInput(
        owners,
        root,
        'workspace.snapshot.restore.redaction.failure',
      );
      const registryBeforeFailure = captureRegistry(owners.registry);
      const receiptCountBeforeFailure = receiptFileCount(owners.store);
      const recoveryCountBeforeFailure = recoveryEntryCount(owners.recoveryStore);
      const failure = await executeWorkspaceSnapshotRestoreReceipt(failureDependencies, failureInput);
      const detailChannelsAreRedacted = checks.every(existing => noRawValues(existing.detail ?? '', markers));
      return first.ok
        && first.record.workspace.description === sensitiveBody
        && asFailure(failure, 'WORKSPACE_SNAPSHOT_READ_FAILED')
        && !('receipt' in failure)
        && failureProjections.length === 0
        && noRawValues(first.receipt, markers)
        && noRawValues(replay.ok ? replay.receipt : replay, markers)
        && noRawValues(capturedProjections, markers)
        && noRawValues(failure, markers)
        && noRawValues(reopened, markers)
        && allStoredReceiptBytesAreRedacted(owners.store, markers)
        && detailChannelsAreRedacted
        && sameRegistry(registryBeforeFailure, captureRegistry(owners.registry))
        && receiptFileCount(owners.store) === receiptCountBeforeFailure
        && recoveryEntryCount(owners.recoveryStore) === recoveryCountBeforeFailure;
    });

    await checkAsync(checks, 'no_change_restore_commits_without_version_or_recovery_and_replays_exactly', async () => {
      const scope = 'no-change';
      const unchangedWorkspace = workspaceFixture(
        'workspace_no_change_restore',
        'No Change Restore',
        'semantic workspace remains unchanged',
        'unchanged',
      );
      const scenarioOwners = makeOwners(root, scope, unchangedWorkspace, () => currentNow, randomHex);
      const sourceRoot = path.join(root, scope, 'source');
      const beforeLookup = scenarioOwners.registry.lookup(scenarioOwners.registry.defaultWorkspaceId);
      if (!beforeLookup.ok) return false;
      validSource(
        sourceRoot,
        beforeLookup.record.workspace,
        beforeLookup.record.workspace.description,
      );
      const projections: unknown[] = [];
      const scenarioDependencies: WorkspaceSnapshotRestoreReceiptAdapterDependencies = {
        registry: scenarioOwners.registry,
        store: scenarioOwners.store,
        recoveryStore: scenarioOwners.recoveryStore,
        receiptService: scenarioOwners.receiptService,
        captureProjection: projection => { projections.push(projection); },
      };
      const scenarioInput = makeInput(
        scenarioOwners,
        sourceRoot,
        'workspace.snapshot.restore.no.change',
      );
      const noChangeFacts = prepareWorkspaceSnapshotRestoreReceiptFacts(
        scenarioDependencies,
        scenarioInput,
      );
      const registryBefore = captureRegistry(scenarioOwners.registry);
      const firstNoChange = await executeWorkspaceSnapshotRestoreReceipt(
        scenarioDependencies,
        scenarioInput,
      );
      const registryAfterFirst = captureRegistry(scenarioOwners.registry);
      const replayNoChange = await executeWorkspaceSnapshotRestoreReceipt(
        scenarioDependencies,
        scenarioInput,
      );
      const registryAfterReplay = captureRegistry(scenarioOwners.registry);
      const reopenedNoChange = firstNoChange.ok
        ? receiptReadback(scenarioOwners.store, firstNoChange.receipt.id)
        : undefined;
      const isolated = sameRegistry(registryBefore, registryAfterFirst)
        && sameRegistry(registryBefore, registryAfterReplay)
        && receiptFileCount(scenarioOwners.store) === 1
        && recoveryEntryCount(scenarioOwners.recoveryStore) === 0;
      observedReceiptStores.push(scenarioOwners.store);
      observedProjectionChannels.push(projections);
      observedIsolation.push(isolated);
      return noChangeFacts.ok
        && !noChangeFacts.facts.changed
        && JSON.stringify(noChangeFacts.facts.beforeResources)
          === JSON.stringify(noChangeFacts.facts.targetResources)
        && firstNoChange.ok
        && !firstNoChange.applied
        && !firstNoChange.replayed
        && firstNoChange.record.version === beforeLookup.record.version
        && reopenedNoChange?.status === 'committed'
        && reopenedNoChange.after?.outcome === 'no_change'
        && reopenedNoChange.after.code === 'workspace_snapshot_restore_no_change'
        && !reopenedNoChange.rollback.required
        && reopenedNoChange.rollback.mode === 'none'
        && replayNoChange.ok
        && replayNoChange.replayed
        && !replayNoChange.applied
        && replayNoChange.record.version === beforeLookup.record.version
        && replayNoChange.receipt.id === firstNoChange.receipt.id
        && replayNoChange.receipt.hash === firstNoChange.receipt.hash
        && projections.length === 2
        && JSON.stringify(projections[0]) === JSON.stringify(firstNoChange.receipt)
        && JSON.stringify(projections[1]) === JSON.stringify(firstNoChange.receipt)
        && isolated;
    });

    await checkAsync(checks, 'malformed_restore_preconditions_fail_before_all_side_effects', async () => {
      const scope = 'invalid-preconditions';
      const scenarioOwners = makeOwners(
        root,
        scope,
        workspaceFixture('workspace_invalid_preconditions', 'Invalid Preconditions', 'unchanged', 'invalid'),
        () => currentNow,
        randomHex,
      );
      let sourceReads = 0;
      const projections: unknown[] = [];
      const scenarioDependencies: WorkspaceSnapshotRestoreReceiptAdapterDependencies = {
        registry: scenarioOwners.registry,
        store: scenarioOwners.store,
        recoveryStore: scenarioOwners.recoveryStore,
        receiptService: scenarioOwners.receiptService,
        readSource: () => {
          sourceReads += 1;
          throw new Error(RAW_NATIVE_ERROR_MARKER);
        },
        captureProjection: projection => { projections.push(projection); },
      };
      const baseInput = makeInput(
        scenarioOwners,
        path.join(root, scope, 'source'),
        'workspace.snapshot.restore.invalid.base',
      );
      const { operationId: omittedOperationId, ...missingOperationFields } = baseInput;
      void omittedOperationId;
      const cases: Array<{
        input: WorkspaceSnapshotRestoreReceiptAdapterInput;
        code: string;
      }> = [
        {
          input: missingOperationFields as WorkspaceSnapshotRestoreReceiptAdapterInput,
          code: 'ACTION_RECEIPT_OPERATION_ID_INVALID',
        },
        {
          input: { ...baseInput, operationId: `invalid operation ${RAW_TOKEN_MARKER}` },
          code: 'ACTION_RECEIPT_OPERATION_ID_INVALID',
        },
        {
          input: {
            ...baseInput,
            operationId: 'workspace.snapshot.restore.invalid.head',
            expectedHead: RAW_TOKEN_MARKER,
          },
          code: 'WORKSPACE_SNAPSHOT_EXPECTED_HEAD_INVALID',
        },
        {
          input: {
            ...baseInput,
            operationId: 'workspace.snapshot.restore.invalid.snapshot',
            expectedSnapshotHash: RAW_NATIVE_ERROR_MARKER,
          },
          code: 'WORKSPACE_SNAPSHOT_EXPECTED_SNAPSHOT_HASH_INVALID',
        },
        {
          input: {
            ...baseInput,
            operationId: 'workspace.snapshot.restore.invalid.version',
            expectedVersion: RAW_BODY_MARKER,
          },
          code: 'WORKSPACE_SNAPSHOT_EXPECTED_VERSION_INVALID',
        },
      ];
      const registryBefore = captureRegistry(scenarioOwners.registry);
      const failures: WorkspaceSnapshotRestoreReceiptAdapterResult[] = [];
      for (const item of cases) {
        failures.push(await executeWorkspaceSnapshotRestoreReceipt(
          scenarioDependencies,
          item.input,
        ));
      }
      const isolated = sameRegistry(registryBefore, captureRegistry(scenarioOwners.registry))
        && sourceReads === 0
        && projections.length === 0
        && receiptFileCount(scenarioOwners.store) === 0
        && recoveryEntryCount(scenarioOwners.recoveryStore) === 0;
      observedFailureResults.push(...failures);
      observedProjectionChannels.push(projections);
      observedReceiptStores.push(scenarioOwners.store);
      observedIsolation.push(isolated);
      return failures.length === cases.length
        && failures.every((failure, index) => asFailure(failure, cases[index]!.code)
          && !('receipt' in failure))
        && isolated;
    });

    await checkAsync(checks, 'stale_head_and_snapshot_fail_distinctly_without_mutation_or_ready_recovery', async () => {
      const runStaleCase = async (
        scope: string,
        staleKind: 'head' | 'snapshot',
        expectedCode: string,
      ): Promise<boolean> => {
        const scenarioOwners = makeOwners(
          root,
          scope,
          workspaceFixture(`workspace_${staleKind}_before`, `Stale ${staleKind}`, 'before stale refusal', 'before'),
          () => currentNow,
          randomHex,
        );
        const beforeLookup = scenarioOwners.registry.lookup(scenarioOwners.registry.defaultWorkspaceId);
        if (!beforeLookup.ok) return false;
        const source = validSource(
          path.join(root, scope, 'source'),
          workspaceFixture(`workspace_${staleKind}_target`, `Stale ${staleKind} target`, 'changed target', 'target'),
          `changed ${staleKind} target`,
        );
        const projections: unknown[] = [];
        const scenarioDependencies: WorkspaceSnapshotRestoreReceiptAdapterDependencies = {
          registry: scenarioOwners.registry,
          store: scenarioOwners.store,
          recoveryStore: scenarioOwners.recoveryStore,
          receiptService: scenarioOwners.receiptService,
          readSource: () => source,
          captureProjection: projection => { projections.push(projection); },
        };
        const currentSnapshotHash = scenarioOwners.registry.snapshotHash(beforeLookup.record);
        const scenarioInput = makeInput(
          scenarioOwners,
          path.join(root, scope, 'source'),
          `workspace.snapshot.restore.stale.${staleKind}`,
          staleKind === 'head'
            ? { expectedHead: differentLegacyHash(beforeLookup.record.head) }
            : { expectedSnapshotHash: differentLegacyHash(currentSnapshotHash) },
        );
        const untouchedGuardMatches = staleKind === 'head'
          ? scenarioInput.expectedSnapshotHash === currentSnapshotHash
          : scenarioInput.expectedHead === beforeLookup.record.head;
        const registryBefore = captureRegistry(scenarioOwners.registry);
        const failure = await executeWorkspaceSnapshotRestoreReceipt(
          scenarioDependencies,
          scenarioInput,
        );
        const recoveryNotReady = failure.ok === false
          && (failure.receipt === undefined
            || (() => {
              const recoveryResult = scenarioOwners.recoveryStore.read(failure.receipt!.id);
              return recoveryResult.ok === false || recoveryResult.record.status !== 'ready';
            })());
        const isolated = sameRegistry(registryBefore, captureRegistry(scenarioOwners.registry))
          && recoveryEntryCount(scenarioOwners.recoveryStore) === 0
          && recoveryNotReady;
        observedFailureResults.push(failure);
        observedProjectionChannels.push(projections);
        observedReceiptStores.push(scenarioOwners.store);
        observedIsolation.push(isolated);
        return untouchedGuardMatches
          && asFailure(failure, expectedCode)
          && isolated;
      };

      return await runStaleCase(
        'stale-head',
        'head',
        'WORKSPACE_SNAPSHOT_EXPECTED_HEAD_STALE',
      ) && await runStaleCase(
        'stale-snapshot',
        'snapshot',
        'WORKSPACE_SNAPSHOT_EXPECTED_SNAPSHOT_HASH_STALE',
      );
    });

    await checkAsync(checks, 'fixed_reader_errors_propagate_redacted_without_side_effects', async () => {
      const scope = 'reader-errors';
      const scenarioOwners = makeOwners(
        root,
        scope,
        workspaceFixture('workspace_reader_errors', 'Reader Errors', 'unchanged', 'reader'),
        () => currentNow,
        randomHex,
      );
      const projections: unknown[] = [];
      const cases = [
        ['WORKSPACE_SNAPSHOT_PATH_UNSAFE', 'Workspace snapshot path is unsafe.'],
        ['WORKSPACE_SNAPSHOT_NOT_FOUND', 'Workspace snapshot was not found.'],
        ['WORKSPACE_SNAPSHOT_JSON_INVALID', 'Workspace snapshot JSON is invalid.'],
        ['WORKSPACE_SNAPSHOT_ENVELOPE_INVALID', 'Workspace snapshot envelope is invalid.'],
      ] as const;
      const registryBefore = captureRegistry(scenarioOwners.registry);
      const failures: WorkspaceSnapshotRestoreReceiptAdapterResult[] = [];
      let fixedMessages = true;
      for (const [index, [code, message]] of cases.entries()) {
        const scenarioDependencies: WorkspaceSnapshotRestoreReceiptAdapterDependencies = {
          registry: scenarioOwners.registry,
          store: scenarioOwners.store,
          recoveryStore: scenarioOwners.recoveryStore,
          receiptService: scenarioOwners.receiptService,
          readSource: () => {
            const error = new WorkspaceSnapshotSourceError(code);
            fixedMessages = fixedMessages && error.message === message;
            Object.defineProperty(error, 'rawMarker', {
              value: `${RAW_NATIVE_ERROR_MARKER}|${RAW_TOKEN_MARKER}|${root}`,
              enumerable: true,
            });
            throw error;
          },
          captureProjection: projection => { projections.push(projection); },
        };
        failures.push(await executeWorkspaceSnapshotRestoreReceipt(
          scenarioDependencies,
          makeInput(
            scenarioOwners,
            path.join(root, scope, 'source'),
            `workspace.snapshot.restore.reader.failure.${index}`,
          ),
        ));
      }
      const markers = [
        ...pathMarkers(root),
        RAW_BODY_MARKER,
        RAW_TOKEN_MARKER,
        RAW_NATIVE_ERROR_MARKER,
      ];
      const isolated = sameRegistry(registryBefore, captureRegistry(scenarioOwners.registry))
        && projections.length === 0
        && receiptFileCount(scenarioOwners.store) === 0
        && recoveryEntryCount(scenarioOwners.recoveryStore) === 0;
      observedFailureResults.push(...failures);
      observedProjectionChannels.push(projections);
      observedReceiptStores.push(scenarioOwners.store);
      observedIsolation.push(isolated);
      return fixedMessages
        && failures.every((failure, index) => asFailure(failure, cases[index]![0])
          && !('receipt' in failure))
        && noRawValues(failures, markers)
        && isolated;
    });

    await checkAsync(checks, 'deadline_refusal_prevents_registry_mutation_and_ready_recovery', async () => {
      const scope = 'deadline';
      const scenarioOwners = makeOwners(
        root,
        scope,
        workspaceFixture('workspace_deadline_before', 'Deadline Before', 'before deadline', 'before'),
        () => currentNow,
        randomHex,
      );
      const source = validSource(
        path.join(root, scope, 'source'),
        workspaceFixture('workspace_deadline_target', 'Deadline Target', 'deadline target', 'target'),
        'deadline target changed',
      );
      const projections: unknown[] = [];
      const scenarioDependencies: WorkspaceSnapshotRestoreReceiptAdapterDependencies = {
        registry: scenarioOwners.registry,
        store: scenarioOwners.store,
        recoveryStore: scenarioOwners.recoveryStore,
        receiptService: scenarioOwners.receiptService,
        readSource: () => source,
        captureProjection: projection => { projections.push(projection); },
      };
      const scenarioInput = makeInput(
        scenarioOwners,
        path.join(root, scope, 'source'),
        'workspace.snapshot.restore.deadline',
        { mayProceed: () => false },
      );
      const registryBefore = captureRegistry(scenarioOwners.registry);
      const failure = await executeWorkspaceSnapshotRestoreReceipt(
        scenarioDependencies,
        scenarioInput,
      );
      const recoveryNotReady = failure.ok === false
        && (failure.receipt === undefined
          || (() => {
            const recoveryResult = scenarioOwners.recoveryStore.read(failure.receipt!.id);
            return recoveryResult.ok === false || recoveryResult.record.status !== 'ready';
          })());
      const isolated = sameRegistry(registryBefore, captureRegistry(scenarioOwners.registry))
        && recoveryEntryCount(scenarioOwners.recoveryStore) === 0
        && recoveryNotReady;
      observedFailureResults.push(failure);
      observedProjectionChannels.push(projections);
      observedReceiptStores.push(scenarioOwners.store);
      observedIsolation.push(isolated);
      return asFailure(failure, 'WORKSPACE_SNAPSHOT_RESTORE_RESPONSE_DEADLINE')
        && isolated;
    });

    check(checks, 'adversarial_failure_channels_are_redacted_and_state_isolated', () => {
      const markers = [
        ...pathMarkers(root),
        RAW_BODY_MARKER,
        RAW_TOKEN_MARKER,
        RAW_NATIVE_ERROR_MARKER,
      ];
      return observedFailureResults.length === 12
        && observedIsolation.length === 6
        && observedIsolation.every(Boolean)
        && noRawValues(observedFailureResults, markers)
        && noRawValues(observedProjectionChannels, markers)
        && observedReceiptStores.every(store => allStoredReceiptBytesAreRedacted(store, markers))
        && checks.every(existing => noRawValues(existing.detail ?? '', markers));
    });

    await checkAsync(checks, 'boundary_source_reread_drift_refuses_without_mutation_or_ready_recovery', async () => {
      const scope = 'boundary-source-drift';
      const scenarioOwners = makeOwners(
        root,
        scope,
        workspaceFixture('workspace_boundary_source_before', 'Boundary Source Before', 'initial state', 'before'),
        () => currentNow,
        randomHex,
      );
      const sourceA = validSource(
        path.join(root, scope, 'source-a'),
        workspaceFixture('workspace_boundary_source_a', 'Boundary Source A', 'target A', 'source-a'),
        `${RAW_BODY_MARKER}|source-a`,
      );
      const sourceB = validSource(
        path.join(root, scope, 'source-b'),
        workspaceFixture('workspace_boundary_source_b', 'Boundary Source B', 'target B', 'source-b'),
        `${RAW_TOKEN_MARKER}|${RAW_NATIVE_ERROR_MARKER}|source-b`,
      );
      const projections: unknown[] = [];
      let sourceReads = 0;
      const scenarioDependencies: WorkspaceSnapshotRestoreReceiptAdapterDependencies = {
        registry: scenarioOwners.registry,
        store: scenarioOwners.store,
        recoveryStore: scenarioOwners.recoveryStore,
        receiptService: scenarioOwners.receiptService,
        readSource: () => {
          sourceReads += 1;
          return sourceReads === 1 ? sourceA : sourceB;
        },
        captureProjection: projection => { projections.push(projection); },
      };
      const scenarioInput = makeInput(
        scenarioOwners,
        path.join(root, scope, 'requested-source'),
        'workspace.snapshot.restore.boundary.source.drift',
      );
      const registryBefore = captureRegistry(scenarioOwners.registry);
      const beforeLookup = scenarioOwners.registry.lookup(scenarioOwners.registry.defaultWorkspaceId);
      if (!beforeLookup.ok) return false;
      const failure = await executeWorkspaceSnapshotRestoreReceipt(
        scenarioDependencies,
        scenarioInput,
      );
      const registryAfter = captureRegistry(scenarioOwners.registry);
      const afterLookup = scenarioOwners.registry.lookup(scenarioOwners.registry.defaultWorkspaceId);
      const markers = [
        ...pathMarkers(root),
        RAW_BODY_MARKER,
        RAW_TOKEN_MARKER,
        RAW_NATIVE_ERROR_MARKER,
      ];
      const materiallyDifferent = sourceA.sourceHash !== sourceB.sourceHash
        && workspaceContentReceiptHash(sourceA.workspace) !== workspaceContentReceiptHash(sourceB.workspace)
        && workspaceSnapshotReceiptHash(sourceA.workspace) !== workspaceSnapshotReceiptHash(sourceB.workspace);
      const isolated = sourceReads === 2
        && sameRegistry(registryBefore, registryAfter)
        && afterLookup.ok
        && afterLookup.record.workspace.id === beforeLookup.record.workspace.id
        && afterLookup.record.workspace.id !== sourceA.workspace.id
        && afterLookup.record.workspace.id !== sourceB.workspace.id
        && recoveryEntryCount(scenarioOwners.recoveryStore) === 0
        && hasSingleTerminalFailureReceipt(failure, scenarioOwners.store, projections);
      boundaryFailureResults.push(failure);
      boundaryProjectionChannels.push(projections);
      boundaryReceiptStores.push(scenarioOwners.store);
      boundaryIsolation.push(isolated);
      return materiallyDifferent
        && asFailure(failure, 'WORKSPACE_SNAPSHOT_SOURCE_CHANGED')
        && noRawValues(failure, markers)
        && noRawValues(projections, markers)
        && allStoredReceiptBytesAreRedacted(scenarioOwners.store, markers)
        && isolated;
    });

    let concurrentBoundaryDetail = 'boundary result unavailable';
    await checkAsync(checks, 'boundary_concurrent_workspace_change_is_preserved_without_adapter_overwrite', async () => {
      const scope = 'boundary-workspace-change';
      const scenarioOwners = makeOwners(
        root,
        scope,
        workspaceFixture('workspace_boundary_change_before', 'Boundary Change Before', 'initial state', 'before'),
        () => currentNow,
        randomHex,
      );
      const sourceB = validSource(
        path.join(root, scope, 'source-b'),
        workspaceFixture('workspace_boundary_change_target_b', 'Boundary Target B', 'adapter target B', 'target-b'),
        `${RAW_BODY_MARKER}|${RAW_TOKEN_MARKER}|target-b`,
      );
      const thirdPartyWorkspaceC = workspaceFixture(
        'workspace_boundary_change_external_c',
        'Boundary External C',
        'third-party committed state C',
        'external-c',
      );
      const beforeLookup = scenarioOwners.registry.lookup(scenarioOwners.registry.defaultWorkspaceId);
      if (!beforeLookup.ok) return false;
      const projections: unknown[] = [];
      let sourceReads = 0;
      let externalCommits = 0;
      let externalRecordJson: string | undefined;
      let registryAfterExternalCommit: RegistryEvidence | undefined;
      const scenarioDependencies: WorkspaceSnapshotRestoreReceiptAdapterDependencies = {
        registry: scenarioOwners.registry,
        store: scenarioOwners.store,
        recoveryStore: scenarioOwners.recoveryStore,
        receiptService: scenarioOwners.receiptService,
        readSource: () => {
          sourceReads += 1;
          if (sourceReads === 2) {
            externalCommits += 1;
            const externalRecord = scenarioOwners.registry.commit(
              scenarioOwners.registry.defaultWorkspaceId,
              thirdPartyWorkspaceC,
              'selftest:third-party-boundary-commit',
            );
            externalRecordJson = JSON.stringify(externalRecord);
            registryAfterExternalCommit = captureRegistry(scenarioOwners.registry);
          }
          return sourceB;
        },
        captureProjection: projection => { projections.push(projection); },
      };
      const scenarioInput = makeInput(
        scenarioOwners,
        path.join(root, scope, 'requested-source'),
        'workspace.snapshot.restore.boundary.workspace.change',
      );
      const failure = await executeWorkspaceSnapshotRestoreReceipt(
        scenarioDependencies,
        scenarioInput,
      );
      concurrentBoundaryDetail = failure.ok === false
        ? `observed ${failure.code}`
        : 'observed unexpected success';
      const finalEvidence = captureRegistry(scenarioOwners.registry);
      const finalLookup = scenarioOwners.registry.lookup(scenarioOwners.registry.defaultWorkspaceId);
      const markers = [
        ...pathMarkers(root),
        RAW_BODY_MARKER,
        RAW_TOKEN_MARKER,
        RAW_NATIVE_ERROR_MARKER,
      ];
      const isolated = sourceReads === 2
        && externalCommits === 1
        && registryAfterExternalCommit !== undefined
        && sameRegistry(registryAfterExternalCommit, finalEvidence)
        && finalLookup.ok
        && JSON.stringify(finalLookup.record) === externalRecordJson
        && finalLookup.record.version === beforeLookup.record.version + 1
        && finalLookup.record.workspace.id === thirdPartyWorkspaceC.id
        && finalLookup.record.workspace.id !== sourceB.workspace.id
        && recoveryEntryCount(scenarioOwners.recoveryStore) === 0
        && hasSingleTerminalFailureReceipt(failure, scenarioOwners.store, projections);
      boundaryFailureResults.push(failure);
      boundaryProjectionChannels.push(projections);
      boundaryReceiptStores.push(scenarioOwners.store);
      boundaryIsolation.push(isolated);
      return asFailure(failure, 'WORKSPACE_SNAPSHOT_WORKSPACE_CHANGED')
        && noRawValues(failure, markers)
        && noRawValues(projections, markers)
        && allStoredReceiptBytesAreRedacted(scenarioOwners.store, markers)
        && isolated;
    });
    const concurrentBoundaryCheck = checks[checks.length - 1];
    if (concurrentBoundaryCheck !== undefined && !concurrentBoundaryCheck.pass) {
      concurrentBoundaryCheck.detail = concurrentBoundaryDetail;
    }

    check(checks, 'boundary_failure_channels_are_redacted_and_state_isolated', () => {
      const markers = [
        ...pathMarkers(root),
        RAW_BODY_MARKER,
        RAW_TOKEN_MARKER,
        RAW_NATIVE_ERROR_MARKER,
      ];
      return boundaryFailureResults.length === 2
        && boundaryFailureResults.every(result => result.ok === false)
        && boundaryIsolation.length === 2
        && boundaryIsolation.every(Boolean)
        && boundaryReceiptStores.length === 2
        && noRawValues(boundaryFailureResults, markers)
        && noRawValues(boundaryProjectionChannels, markers)
        && boundaryReceiptStores.every(store => allStoredReceiptBytesAreRedacted(store, markers))
        && checks.every(existing => noRawValues(existing.detail ?? '', markers));
    });

    await checkAsync(checks, 'canonical_operation_conflicts_preserve_original_receipt_recovery_and_both_workspaces', async () => {
      const scope = 'canonical-operation-conflicts';
      const scenarioOwners = makeOwners(
        root,
        scope,
        workspaceFixture('workspace_conflict_primary_before', 'Conflict Primary Before', 'primary before', 'primary'),
        () => currentNow,
        randomHex,
      );
      const secondRecord = scenarioOwners.registry.create(
        workspaceFixture('workspace_conflict_second', 'Conflict Second', 'second remains exact', 'second'),
        'selftest:canonical-conflict-second-workspace',
      );
      const primaryBefore = scenarioOwners.registry.lookup(scenarioOwners.registry.defaultWorkspaceId);
      const secondBefore = scenarioOwners.registry.lookup(secondRecord.workspaceId);
      if (!primaryBefore.ok || !secondBefore.ok) return false;

      const sourceRoot = path.join(root, scope, 'source');
      const originalTarget = workspaceFixture(
        'workspace_conflict_original_target',
        'Conflict Original Target',
        'original target',
        'original-target',
      );
      const changedTarget = workspaceFixture(
        'workspace_conflict_changed_target',
        'Conflict Changed Target',
        'changed target',
        'changed-target',
      );
      const originalBody = [RAW_BODY_MARKER, RAW_TOKEN_MARKER, RAW_NATIVE_ERROR_MARKER, 'original'].join('|');
      const changedBody = [RAW_NATIVE_ERROR_MARKER, RAW_TOKEN_MARKER, 'changed'].join('|');
      const originalBytes = snapshotBytes(originalTarget, originalBody);
      const changedBytes = snapshotBytes(changedTarget, changedBody);
      const snapshotPath = writeSnapshot(sourceRoot, originalTarget, originalBody);
      const snapshotDirectory = path.dirname(snapshotPath);
      const snapshotDirectoryBefore = directoryBytes(snapshotDirectory);
      const projections: unknown[] = [];
      let sourceReads = 0;
      const scenarioDependencies: WorkspaceSnapshotRestoreReceiptAdapterDependencies = {
        registry: scenarioOwners.registry,
        store: scenarioOwners.store,
        recoveryStore: scenarioOwners.recoveryStore,
        receiptService: scenarioOwners.receiptService,
        readSource: value => {
          sourceReads += 1;
          return readWorkspaceSnapshotSource(value);
        },
        captureProjection: projection => { projections.push(projection); },
      };
      const operationId = 'workspace.snapshot.restore.canonical.conflict.v1';
      const originalInput = makeInput(scenarioOwners, sourceRoot, operationId);
      const registryBefore = captureRegistry(scenarioOwners.registry);
      const first = await executeWorkspaceSnapshotRestoreReceipt(scenarioDependencies, originalInput);
      const readsAfterFirst = sourceReads;
      const registryAfterFirst = captureRegistry(scenarioOwners.registry);
      const primaryAfterFirst = scenarioOwners.registry.lookup(scenarioOwners.registry.defaultWorkspaceId);
      const secondAfterFirst = scenarioOwners.registry.lookup(secondRecord.workspaceId);
      const reopenedAfterFirst = first.ok ? receiptReadback(scenarioOwners.store, first.receipt.id) : undefined;
      const receiptBytesAfterFirst = first.ok
        ? fs.readFileSync(scenarioOwners.store.pathFor(first.receipt.id))
        : Buffer.alloc(0);
      const receiptDirectoryAfterFirst = directoryBytes(scenarioOwners.store.root);
      const recoveryDirectoryAfterFirst = directoryBytes(scenarioOwners.recoveryStore.root);
      const recoveryAfterFirst = first.ok
        ? scenarioOwners.recoveryStore.read(first.receipt.id)
        : undefined;
      const firstCommittedExactlyOnce = first.ok
        && first.applied
        && !first.replayed
        && readsAfterFirst === 2
        && primaryAfterFirst.ok
        && primaryAfterFirst.record.version === primaryBefore.record.version + 1
        && primaryAfterFirst.record.workspace.id === originalTarget.id
        && primaryAfterFirst.record.workspace.description === originalBody
        && secondAfterFirst.ok
        && JSON.stringify(secondAfterFirst.record) === JSON.stringify(secondBefore.record)
        && receiptFileCount(scenarioOwners.store) === 1
        && recoveryEntryCount(scenarioOwners.recoveryStore) === 1
        && reopenedAfterFirst?.status === 'committed'
        && recoveryAfterFirst?.ok === true
        && recoveryAfterFirst.record.status === 'ready'
        && Buffer.compare(fs.readFileSync(snapshotPath), originalBytes) === 0
        && projections.length === 1
        && JSON.stringify(projections[0]) === JSON.stringify(first.receipt);

      fs.writeFileSync(snapshotPath, changedBytes);
      const changedSourceConflict = await executeWorkspaceSnapshotRestoreReceipt(
        scenarioDependencies,
        originalInput,
      );
      const readsAfterChangedSource = sourceReads;
      const registryAfterChangedSource = captureRegistry(scenarioOwners.registry);
      const changedSourcePreservedState = asFailure(
        changedSourceConflict,
        'ACTION_RECEIPT_DUPLICATE_CONFLICT',
      )
        && !('receipt' in changedSourceConflict)
        && readsAfterChangedSource === 3
        && sameRegistry(registryAfterFirst, registryAfterChangedSource)
        && receiptFileCount(scenarioOwners.store) === 1
        && recoveryEntryCount(scenarioOwners.recoveryStore) === 1
        && projections.length === 1
        && Buffer.compare(fs.readFileSync(snapshotPath), changedBytes) === 0
        && Buffer.compare(originalBytes, changedBytes) !== 0
        && crypto.createHash('sha256').update(originalBytes).digest('hex')
          !== crypto.createHash('sha256').update(changedBytes).digest('hex')
        && workspaceContentReceiptHash(originalTarget) !== workspaceContentReceiptHash(changedTarget)
        && workspaceSnapshotReceiptHash(originalTarget) !== workspaceSnapshotReceiptHash(changedTarget);

      fs.writeFileSync(snapshotPath, originalBytes);
      const alternateIdentity = {
        kind: 'studio' as const,
        clientId: 'client_snapshot_restore_conflict_alternate',
        version: '2.0.0',
      };
      const mappedAlternateIdentity = mapRuntimeReceiptIdentity(alternateIdentity);
      const alternateReceiptIdentity = reopenedAfterFirst === undefined
        ? undefined
        : {
            ...reopenedAfterFirst,
            actor: mappedAlternateIdentity.actor,
            client: mappedAlternateIdentity.client,
          } as ActionReceipt;
      const alternateCandidateId = alternateReceiptIdentity === undefined
        ? ''
        : `ar_${hashActionReceiptOperationIdentity(alternateReceiptIdentity)}`;
      const alternateCandidateIdReplay = alternateReceiptIdentity === undefined
        ? ''
        : `ar_${hashActionReceiptOperationIdentity(alternateReceiptIdentity)}`;
      const changedClientConflict = await executeWorkspaceSnapshotRestoreReceipt(
        scenarioDependencies,
        { ...originalInput, identity: alternateIdentity },
      );
      const readsAfterChangedClient = sourceReads;
      const registryAfterChangedClient = captureRegistry(scenarioOwners.registry);
      const changedClientPreservedState = asFailure(
        changedClientConflict,
        'ACTION_RECEIPT_DUPLICATE_CONFLICT',
      )
        && !('receipt' in changedClientConflict)
        && readsAfterChangedClient === 4
        && /^ar_[a-f0-9]{64}$/.test(alternateCandidateId)
        && alternateCandidateId === alternateCandidateIdReplay
        && first.ok
        && alternateCandidateId !== first.receipt.id
        && sameRegistry(registryAfterFirst, registryAfterChangedClient)
        && receiptFileCount(scenarioOwners.store) === 1
        && recoveryEntryCount(scenarioOwners.recoveryStore) === 1
        && projections.length === 1
        && Buffer.compare(fs.readFileSync(snapshotPath), originalBytes) === 0;

      const secondWorkspaceInput: WorkspaceSnapshotRestoreReceiptAdapterInput = {
        ...originalInput,
        workspaceId: secondBefore.record.workspaceId,
        expectedHead: secondBefore.record.head,
        expectedSnapshotHash: scenarioOwners.registry.snapshotHash(secondBefore.record),
      };
      const secondWorkspaceConflict = await executeWorkspaceSnapshotRestoreReceipt(
        scenarioDependencies,
        secondWorkspaceInput,
      );
      const readsAfterSecondWorkspace = sourceReads;
      const registryAfterSecondWorkspace = captureRegistry(scenarioOwners.registry);
      const primaryFinal = scenarioOwners.registry.lookup(scenarioOwners.registry.defaultWorkspaceId);
      const secondFinal = scenarioOwners.registry.lookup(secondRecord.workspaceId);
      const secondWorkspacePreservedState = asFailure(
        secondWorkspaceConflict,
        'ACTION_RECEIPT_DUPLICATE_CONFLICT',
      )
        && !('receipt' in secondWorkspaceConflict)
        && readsAfterSecondWorkspace === 5
        && secondWorkspaceInput.expectedHead === secondBefore.record.head
        && secondWorkspaceInput.expectedSnapshotHash === scenarioOwners.registry.snapshotHash(secondBefore.record)
        && sameRegistry(registryAfterFirst, registryAfterSecondWorkspace)
        && primaryFinal.ok
        && primaryAfterFirst.ok
        && JSON.stringify(primaryFinal.record) === JSON.stringify(primaryAfterFirst.record)
        && secondFinal.ok
        && JSON.stringify(secondFinal.record) === JSON.stringify(secondBefore.record)
        && receiptFileCount(scenarioOwners.store) === 1
        && recoveryEntryCount(scenarioOwners.recoveryStore) === 1
        && projections.length === 1;

      const finalReopened = first.ok ? receiptReadback(scenarioOwners.store, first.receipt.id) : undefined;
      const finalReceiptBytes = first.ok
        ? fs.readFileSync(scenarioOwners.store.pathFor(first.receipt.id))
        : Buffer.alloc(0);
      const finalRecovery = first.ok
        ? scenarioOwners.recoveryStore.read(first.receipt.id)
        : undefined;
      const markers = [
        ...pathMarkers(root),
        RAW_BODY_MARKER,
        RAW_TOKEN_MARKER,
        RAW_NATIVE_ERROR_MARKER,
      ];
      const failureChannels = [
        changedSourceConflict,
        changedClientConflict,
        secondWorkspaceConflict,
      ];
      return firstCommittedExactlyOnce
        && !sameRegistry(registryBefore, registryAfterFirst)
        && changedSourcePreservedState
        && changedClientPreservedState
        && secondWorkspacePreservedState
        && first.ok
        && finalReopened !== undefined
        && finalReopened.status === 'committed'
        && finalReopened.id === first.receipt.id
        && finalReopened.hash === first.receipt.hash
        && Buffer.compare(receiptBytesAfterFirst, finalReceiptBytes) === 0
        && directoryBytes(scenarioOwners.store.root) === receiptDirectoryAfterFirst
        && directoryBytes(scenarioOwners.recoveryStore.root) === recoveryDirectoryAfterFirst
        && finalRecovery?.ok === true
        && finalRecovery.record.status === 'ready'
        && directoryBytes(snapshotDirectory) === snapshotDirectoryBefore
        && noRawValues(failureChannels, markers)
        && noRawValues(projections, markers)
        && noRawValues(finalReopened, markers)
        && noRawValues(finalReceiptBytes.toString('utf8'), markers)
        && allStoredReceiptBytesAreRedacted(scenarioOwners.store, markers)
        && checks.every(existing => noRawValues(existing.detail ?? '', markers));
    });

    const faultFailureResults: WorkspaceSnapshotRestoreReceiptAdapterResult[] = [];
    const faultProjectionChannels: unknown[] = [];
    const faultReceiptStores: ActionReceiptStore[] = [];
    const faultIsolation: boolean[] = [];

    await checkAsync(checks, 'recovery_creation_fault_refuses_before_receipt_or_registry_mutation', async () => {
      const scope = 'fault-recovery-create';
      const scenarioOwners = makeOwners(
        root,
        scope,
        workspaceFixture('workspace_recovery_fault_before', 'Recovery Fault Before', 'unchanged', 'before'),
        () => currentNow,
        randomHex,
      );
      const source = validSource(
        path.join(root, scope, 'source'),
        workspaceFixture('workspace_recovery_fault_target', 'Recovery Fault Target', 'changed target', 'target'),
        'recovery fault target',
      );
      const projections: unknown[] = [];
      let sourceReads = 0;
      let createAttempts = 0;
      const recoverySeam = scenarioOwners.recoveryStore as unknown as {
        createWorkspace: DestructiveRecoveryStore['createWorkspace'];
      };
      const originalCreateWorkspace = recoverySeam.createWorkspace;
      const scenarioDependencies: WorkspaceSnapshotRestoreReceiptAdapterDependencies = {
        registry: scenarioOwners.registry,
        store: scenarioOwners.store,
        recoveryStore: scenarioOwners.recoveryStore,
        receiptService: scenarioOwners.receiptService,
        readSource: () => {
          sourceReads += 1;
          return source;
        },
        captureProjection: projection => { projections.push(projection); },
      };
      const registryBefore = captureRegistry(scenarioOwners.registry);
      let failure: WorkspaceSnapshotRestoreReceiptAdapterResult;
      recoverySeam.createWorkspace = () => {
        createAttempts += 1;
        throw new Error(`${RAW_NATIVE_ERROR_MARKER}|${RAW_TOKEN_MARKER}|${root}`);
      };
      try {
        failure = await executeWorkspaceSnapshotRestoreReceipt(
          scenarioDependencies,
          makeInput(
            scenarioOwners,
            path.join(root, scope, 'source'),
            'workspace.snapshot.restore.fault.recovery.create',
          ),
        );
      } finally {
        recoverySeam.createWorkspace = originalCreateWorkspace;
      }
      const isolated = sameRegistry(registryBefore, captureRegistry(scenarioOwners.registry))
        && recoverySeam.createWorkspace === originalCreateWorkspace
        && createAttempts === 1
        && sourceReads === 1
        && receiptFileCount(scenarioOwners.store) === 0
        && recoveryEntryCount(scenarioOwners.recoveryStore) === 0
        && projections.length === 1
        && projections[0] === undefined;
      faultFailureResults.push(failure);
      faultProjectionChannels.push(projections);
      faultReceiptStores.push(scenarioOwners.store);
      faultIsolation.push(isolated);
      return asFailure(failure, 'WORKSPACE_SNAPSHOT_RESTORE_RECOVERY_FAILED')
        && !('receipt' in failure)
        && isolated;
    });

    await checkAsync(checks, 'domain_commit_fault_preserves_prior_state_and_terminal_failure_truth', async () => {
      const scope = 'fault-domain-commit';
      const scenarioOwners = makeOwners(
        root,
        scope,
        workspaceFixture('workspace_commit_fault_before', 'Commit Fault Before', 'unchanged', 'before'),
        () => currentNow,
        randomHex,
      );
      const source = validSource(
        path.join(root, scope, 'source'),
        workspaceFixture('workspace_commit_fault_target', 'Commit Fault Target', 'changed target', 'target'),
        'commit fault target',
      );
      const projections: unknown[] = [];
      let sourceReads = 0;
      let commitAttempts = 0;
      const registrySeam = scenarioOwners.registry as unknown as {
        commit: WorkspaceRegistry['commit'];
      };
      const originalCommit = registrySeam.commit;
      const scenarioDependencies: WorkspaceSnapshotRestoreReceiptAdapterDependencies = {
        registry: scenarioOwners.registry,
        store: scenarioOwners.store,
        recoveryStore: scenarioOwners.recoveryStore,
        receiptService: scenarioOwners.receiptService,
        readSource: () => {
          sourceReads += 1;
          return source;
        },
        captureProjection: projection => { projections.push(projection); },
      };
      const registryBefore = captureRegistry(scenarioOwners.registry);
      let failure: WorkspaceSnapshotRestoreReceiptAdapterResult;
      registrySeam.commit = () => {
        commitAttempts += 1;
        throw new Error(`${RAW_NATIVE_ERROR_MARKER}|${RAW_BODY_MARKER}|${root}`);
      };
      try {
        failure = await executeWorkspaceSnapshotRestoreReceipt(
          scenarioDependencies,
          makeInput(
            scenarioOwners,
            path.join(root, scope, 'source'),
            'workspace.snapshot.restore.fault.domain.commit',
          ),
        );
      } finally {
        registrySeam.commit = originalCommit;
      }
      const isolated = sameRegistry(registryBefore, captureRegistry(scenarioOwners.registry))
        && registrySeam.commit === originalCommit
        && commitAttempts === 1
        && sourceReads === 2
        && recoveryEntryCount(scenarioOwners.recoveryStore) === 0
        && hasSingleTerminalFailureReceipt(failure, scenarioOwners.store, projections);
      faultFailureResults.push(failure);
      faultProjectionChannels.push(projections);
      faultReceiptStores.push(scenarioOwners.store);
      faultIsolation.push(isolated);
      return asFailure(failure, 'WORKSPACE_SNAPSHOT_RESTORE_DOMAIN_COMMIT_FAILED')
        && isolated;
    });

    await checkAsync(checks, 'projection_capture_fault_is_fail_soft_after_successful_commit', async () => {
      const scope = 'fault-projection-capture';
      const scenarioOwners = makeOwners(
        root,
        scope,
        workspaceFixture('workspace_projection_fault_before', 'Projection Fault Before', 'before projection fault', 'before'),
        () => currentNow,
        randomHex,
      );
      const target = workspaceFixture(
        'workspace_projection_fault_target',
        'Projection Fault Target',
        'projection fault target',
        'target',
      );
      const source = validSource(path.join(root, scope, 'source'), target, 'projection fault target');
      let sourceReads = 0;
      let captureAttempts = 0;
      const scenarioDependencies: WorkspaceSnapshotRestoreReceiptAdapterDependencies = {
        registry: scenarioOwners.registry,
        store: scenarioOwners.store,
        recoveryStore: scenarioOwners.recoveryStore,
        receiptService: scenarioOwners.receiptService,
        readSource: () => {
          sourceReads += 1;
          return source;
        },
        captureProjection: () => {
          captureAttempts += 1;
          throw new Error(`${RAW_NATIVE_ERROR_MARKER}|${RAW_TOKEN_MARKER}|${root}`);
        },
      };
      const beforeLookup = scenarioOwners.registry.lookup(scenarioOwners.registry.defaultWorkspaceId);
      if (!beforeLookup.ok) return false;
      const registryBefore = captureRegistry(scenarioOwners.registry);
      const success = await executeWorkspaceSnapshotRestoreReceipt(
        scenarioDependencies,
        makeInput(
          scenarioOwners,
          path.join(root, scope, 'source'),
          'workspace.snapshot.restore.fault.projection.capture',
        ),
      );
      const finalLookup = scenarioOwners.registry.lookup(scenarioOwners.registry.defaultWorkspaceId);
      const reopened = success.ok ? receiptReadback(scenarioOwners.store, success.receipt.id) : undefined;
      const recovery = success.ok ? scenarioOwners.recoveryStore.read(success.receipt.id) : undefined;
      const isolated = success.ok
        && success.applied
        && !success.replayed
        && captureAttempts === 1
        && sourceReads === 2
        && finalLookup.ok
        && finalLookup.record.version === beforeLookup.record.version + 1
        && finalLookup.record.workspace.id === target.id
        && !sameRegistry(registryBefore, captureRegistry(scenarioOwners.registry))
        && receiptFileCount(scenarioOwners.store) === 1
        && recoveryEntryCount(scenarioOwners.recoveryStore) === 1
        && reopened?.status === 'committed'
        && reopened.id === success.receipt.id
        && reopened.hash === success.receipt.hash
        && recovery?.ok === true
        && recovery.record.status === 'ready';
      faultProjectionChannels.push([]);
      faultReceiptStores.push(scenarioOwners.store);
      faultIsolation.push(isolated);
      return isolated;
    });

    await checkAsync(checks, 'authoritative_reopen_fault_reports_failure_without_undoing_committed_truth', async () => {
      const scope = 'fault-authoritative-reopen';
      const scenarioOwners = makeOwners(
        root,
        scope,
        workspaceFixture('workspace_reopen_fault_before', 'Reopen Fault Before', 'before reopen fault', 'before'),
        () => currentNow,
        randomHex,
      );
      const target = workspaceFixture(
        'workspace_reopen_fault_target',
        'Reopen Fault Target',
        'reopen fault target',
        'target',
      );
      const source = validSource(path.join(root, scope, 'source'), target, 'reopen fault target');
      const projections: unknown[] = [];
      let sourceReads = 0;
      let captureAttempts = 0;
      let failNextRead = false;
      let injectedReadFaults = 0;
      const wrappedStore: WorkspaceSnapshotRestoreReceiptAdapterDependencies['store'] & { root: string } = {
        root: scenarioOwners.store.root,
        prepareWithDisposition: input => scenarioOwners.store.prepareWithDisposition(input),
        transition: (id, input) => scenarioOwners.store.transition(id, input),
        read: id => {
          if (failNextRead) {
            failNextRead = false;
            injectedReadFaults += 1;
            throw new Error(`${RAW_NATIVE_ERROR_MARKER}|${RAW_TOKEN_MARKER}|${root}`);
          }
          return scenarioOwners.store.read(id);
        },
      };
      const scenarioDependencies: WorkspaceSnapshotRestoreReceiptAdapterDependencies = {
        registry: scenarioOwners.registry,
        store: wrappedStore,
        recoveryStore: scenarioOwners.recoveryStore,
        receiptService: scenarioOwners.receiptService,
        readSource: () => {
          sourceReads += 1;
          return source;
        },
        captureProjection: projection => {
          captureAttempts += 1;
          projections.push(projection);
          failNextRead = true;
        },
      };
      const beforeLookup = scenarioOwners.registry.lookup(scenarioOwners.registry.defaultWorkspaceId);
      if (!beforeLookup.ok) return false;
      const failure = await executeWorkspaceSnapshotRestoreReceipt(
        scenarioDependencies,
        makeInput(
          scenarioOwners,
          path.join(root, scope, 'source'),
          'workspace.snapshot.restore.fault.authoritative.reopen',
        ),
      );
      const finalLookup = scenarioOwners.registry.lookup(scenarioOwners.registry.defaultWorkspaceId);
      const reopened = failure.ok === false && failure.receipt !== undefined
        ? receiptReadback(scenarioOwners.store, failure.receipt.id)
        : undefined;
      const recovery = failure.ok === false && failure.receipt !== undefined
        ? scenarioOwners.recoveryStore.read(failure.receipt.id)
        : undefined;
      const isolated = asFailure(failure, 'WORKSPACE_SNAPSHOT_RESTORE_RECEIPT_REOPEN_FAILED')
        && failure.receipt !== undefined
        && failure.receipt.status === 'committed'
        && captureAttempts === 1
        && injectedReadFaults === 1
        && !failNextRead
        && sourceReads === 2
        && finalLookup.ok
        && finalLookup.record.version === beforeLookup.record.version + 1
        && finalLookup.record.workspace.id === target.id
        && receiptFileCount(scenarioOwners.store) === 1
        && recoveryEntryCount(scenarioOwners.recoveryStore) === 1
        && projections.length === 1
        && JSON.stringify(projections[0]) === JSON.stringify(failure.receipt)
        && reopened?.status === 'committed'
        && reopened.id === failure.receipt.id
        && reopened.hash === failure.receipt.hash
        && recovery?.ok === true
        && recovery.record.status === 'ready';
      faultFailureResults.push(failure);
      faultProjectionChannels.push(projections);
      faultReceiptStores.push(scenarioOwners.store);
      faultIsolation.push(isolated);
      return isolated;
    });

    check(checks, 'fault_injection_failure_channels_are_redacted_and_states_are_isolated', () => {
      const markers = [
        ...pathMarkers(root),
        RAW_BODY_MARKER,
        RAW_TOKEN_MARKER,
        RAW_NATIVE_ERROR_MARKER,
      ];
      return faultFailureResults.length === 3
        && faultFailureResults.every(result => result.ok === false)
        && faultProjectionChannels.length === 4
        && faultReceiptStores.length === 4
        && faultIsolation.length === 4
        && faultIsolation.every(Boolean)
        && noRawValues(faultFailureResults, markers)
        && noRawValues(faultProjectionChannels, markers)
        && faultReceiptStores.every(store => allStoredReceiptBytesAreRedacted(store, markers))
        && checks.every(existing => noRawValues(existing.detail ?? '', markers));
    });

    const rollbackFailureResults: WorkspaceSnapshotRestoreReceiptAdapterResult[] = [];
    const rollbackProjectionChannels: unknown[] = [];
    const rollbackReceiptStores: ActionReceiptStore[] = [];
    const rollbackIsolation: boolean[] = [];

    await checkAsync(checks, 'postcondition_lookup_fault_rolls_back_exact_prior_workspace', async () => {
      const scope = 'fault-postcondition-rollback';
      const priorWorkspace = workspaceFixture(
        'workspace_postcondition_prior',
        'Postcondition Prior',
        'prior semantic workspace',
        'prior',
      );
      const targetWorkspace = workspaceFixture(
        'workspace_postcondition_target',
        'Postcondition Target',
        'target must be rolled back',
        'target',
      );
      const scenarioOwners = makeOwners(root, scope, priorWorkspace, () => currentNow, randomHex);
      const source = validSource(
        path.join(root, scope, 'source'),
        targetWorkspace,
        'postcondition target',
      );
      const beforeLookup = scenarioOwners.registry.lookup(scenarioOwners.registry.defaultWorkspaceId);
      if (!beforeLookup.ok) return false;
      const exactPriorWorkspace = sanitizeWorkspace(beforeLookup.record.workspace);
      const priorContentHash = workspaceContentReceiptHash(exactPriorWorkspace);
      const priorSnapshotHash = workspaceSnapshotReceiptHash(exactPriorWorkspace);
      const targetContentHash = workspaceContentReceiptHash(source.workspace);
      const targetSnapshotHash = workspaceSnapshotReceiptHash(source.workspace);
      const projections: unknown[] = [];
      let sourceReads = 0;
      let lookupCalls = 0;
      let lookupFaults = 0;
      let commitCalls = 0;
      const committedWorkspaceIds: string[] = [];
      const registrySeam = scenarioOwners.registry as unknown as {
        lookup: WorkspaceRegistry['lookup'];
        commit: WorkspaceRegistry['commit'];
      };
      const originalLookup = registrySeam.lookup;
      const originalCommit = registrySeam.commit;
      const scenarioDependencies: WorkspaceSnapshotRestoreReceiptAdapterDependencies = {
        registry: scenarioOwners.registry,
        store: scenarioOwners.store,
        recoveryStore: scenarioOwners.recoveryStore,
        receiptService: scenarioOwners.receiptService,
        readSource: () => {
          sourceReads += 1;
          return source;
        },
        captureProjection: projection => { projections.push(projection); },
      };
      const scenarioInput = makeInput(
        scenarioOwners,
        path.join(root, scope, 'source'),
        'workspace.snapshot.restore.fault.postcondition.rollback',
      );
      registrySeam.lookup = workspaceId => {
        lookupCalls += 1;
        if (lookupCalls === 4) {
          lookupFaults += 1;
          return {
            ok: false,
            code: 'WORKSPACE_NOT_FOUND',
            error: `${RAW_NATIVE_ERROR_MARKER}|${RAW_TOKEN_MARKER}|${root}`,
          };
        }
        return originalLookup.call(scenarioOwners.registry, workspaceId);
      };
      registrySeam.commit = (workspaceId, workspace, origin) => {
        commitCalls += 1;
        committedWorkspaceIds.push(workspace.id);
        return originalCommit.call(scenarioOwners.registry, workspaceId, workspace, origin);
      };
      let failure: WorkspaceSnapshotRestoreReceiptAdapterResult;
      try {
        failure = await executeWorkspaceSnapshotRestoreReceipt(
          scenarioDependencies,
          scenarioInput,
        );
      } finally {
        registrySeam.lookup = originalLookup;
        registrySeam.commit = originalCommit;
      }
      const finalLookup = scenarioOwners.registry.lookup(scenarioOwners.registry.defaultWorkspaceId);
      const reopenedRegistry = new WorkspaceRegistry({
        root: scenarioOwners.registry.root,
        defaultWorkspace: priorWorkspace,
        now: () => currentNow,
        randomHex: bytes => 'a'.repeat(bytes * 2),
      });
      const durableLookup = reopenedRegistry.lookup(scenarioOwners.registry.defaultWorkspaceId);
      const reopenedReceipt = failure.ok === false && failure.receipt !== undefined
        ? receiptReadback(scenarioOwners.store, failure.receipt.id)
        : undefined;
      const recovery = failure.ok === false && failure.receipt !== undefined
        ? scenarioOwners.recoveryStore.read(failure.receipt.id)
        : undefined;
      const finalContentHash = finalLookup.ok
        ? workspaceContentReceiptHash(finalLookup.record.workspace)
        : '';
      const finalSnapshotHash = finalLookup.ok
        ? workspaceSnapshotReceiptHash(finalLookup.record.workspace)
        : '';
      const durableContentHash = durableLookup.ok
        ? workspaceContentReceiptHash(durableLookup.record.workspace)
        : '';
      const durableSnapshotHash = durableLookup.ok
        ? workspaceSnapshotReceiptHash(durableLookup.record.workspace)
        : '';
      const isolated = asFailure(failure, 'WORKSPACE_SNAPSHOT_RESTORE_POSTCONDITION_FAILED')
        && registrySeam.lookup === originalLookup
        && registrySeam.commit === originalCommit
        && sourceReads === 2
        && lookupFaults === 1
        && lookupCalls === 8
        && commitCalls === 2
        && JSON.stringify(committedWorkspaceIds) === JSON.stringify([
          targetWorkspace.id,
          exactPriorWorkspace.id,
        ])
        && finalLookup.ok
        && finalLookup.record.version === beforeLookup.record.version + 2
        && finalLookup.record.workspace.id === exactPriorWorkspace.id
        && JSON.stringify(finalLookup.record.workspace) === JSON.stringify(exactPriorWorkspace)
        && finalContentHash === priorContentHash
        && finalSnapshotHash === priorSnapshotHash
        && finalContentHash !== targetContentHash
        && finalSnapshotHash !== targetSnapshotHash
        && /^[a-f0-9]{64}$/.test(finalContentHash)
        && /^[a-f0-9]{64}$/.test(finalSnapshotHash)
        && durableLookup.ok
        && durableLookup.record.version === finalLookup.record.version
        && durableLookup.record.workspace.id === exactPriorWorkspace.id
        && JSON.stringify(durableLookup.record.workspace) === JSON.stringify(exactPriorWorkspace)
        && durableContentHash === priorContentHash
        && durableSnapshotHash === priorSnapshotHash
        && receiptFileCount(scenarioOwners.store) === 1
        && recoveryEntryCount(scenarioOwners.recoveryStore) === 0
        && recovery?.ok === false
        && hasSingleTerminalFailureReceipt(failure, scenarioOwners.store, projections)
        && reopenedReceipt?.status === 'rolled_back'
        && reopenedReceipt.rollback.required
        && reopenedReceipt.rollback.status === 'performed'
        && reopenedReceipt.validation.status === 'failed'
        && reopenedReceipt.after === undefined
        && reopenedReceipt.failure?.code === 'ACTION_RECEIPT_FINALIZATION_FAILED';
      rollbackFailureResults.push(failure);
      rollbackProjectionChannels.push(projections);
      rollbackReceiptStores.push(scenarioOwners.store);
      rollbackIsolation.push(isolated);
      return isolated;
    });

    await checkAsync(checks, 'receipt_commit_transition_fault_rolls_back_exact_prior_workspace', async () => {
      const scope = 'fault-receipt-finalization-rollback';
      const priorWorkspace = workspaceFixture(
        'workspace_finalization_prior',
        'Finalization Prior',
        'prior semantic workspace',
        'prior',
      );
      const targetWorkspace = workspaceFixture(
        'workspace_finalization_target',
        'Finalization Target',
        'target must be rolled back',
        'target',
      );
      const scenarioOwners = makeOwners(root, scope, priorWorkspace, () => currentNow, randomHex);
      const source = validSource(
        path.join(root, scope, 'source'),
        targetWorkspace,
        'finalization target',
      );
      const beforeLookup = scenarioOwners.registry.lookup(scenarioOwners.registry.defaultWorkspaceId);
      if (!beforeLookup.ok) return false;
      const exactPriorWorkspace = sanitizeWorkspace(beforeLookup.record.workspace);
      const priorContentHash = workspaceContentReceiptHash(exactPriorWorkspace);
      const priorSnapshotHash = workspaceSnapshotReceiptHash(exactPriorWorkspace);
      const targetContentHash = workspaceContentReceiptHash(source.workspace);
      const targetSnapshotHash = workspaceSnapshotReceiptHash(source.workspace);
      const projections: unknown[] = [];
      let sourceReads = 0;
      let commitCalls = 0;
      let committedTransitionFaults = 0;
      let rolledBackTransitions = 0;
      const committedWorkspaceIds: string[] = [];
      const registrySeam = scenarioOwners.registry as unknown as {
        commit: WorkspaceRegistry['commit'];
      };
      const storeSeam = scenarioOwners.store as unknown as {
        transition: ActionReceiptStore['transition'];
      };
      const originalCommit = registrySeam.commit;
      const originalTransition = storeSeam.transition;
      const scenarioDependencies: WorkspaceSnapshotRestoreReceiptAdapterDependencies = {
        registry: scenarioOwners.registry,
        store: scenarioOwners.store,
        recoveryStore: scenarioOwners.recoveryStore,
        receiptService: scenarioOwners.receiptService,
        readSource: () => {
          sourceReads += 1;
          return source;
        },
        captureProjection: projection => { projections.push(projection); },
      };
      registrySeam.commit = (workspaceId, workspace, origin) => {
        commitCalls += 1;
        committedWorkspaceIds.push(workspace.id);
        return originalCommit.call(scenarioOwners.registry, workspaceId, workspace, origin);
      };
      storeSeam.transition = (id, input) => {
        if (input.to === 'committed') {
          committedTransitionFaults += 1;
          throw new Error(`${RAW_NATIVE_ERROR_MARKER}|${RAW_TOKEN_MARKER}|${root}`);
        }
        if (input.to === 'rolled_back') rolledBackTransitions += 1;
        return originalTransition.call(scenarioOwners.store, id, input);
      };
      let failure: WorkspaceSnapshotRestoreReceiptAdapterResult;
      try {
        failure = await executeWorkspaceSnapshotRestoreReceipt(
          scenarioDependencies,
          makeInput(
            scenarioOwners,
            path.join(root, scope, 'source'),
            'workspace.snapshot.restore.fault.finalization.rollback',
          ),
        );
      } finally {
        registrySeam.commit = originalCommit;
        storeSeam.transition = originalTransition;
      }
      const finalLookup = scenarioOwners.registry.lookup(scenarioOwners.registry.defaultWorkspaceId);
      const reopenedRegistry = new WorkspaceRegistry({
        root: scenarioOwners.registry.root,
        defaultWorkspace: priorWorkspace,
        now: () => currentNow,
        randomHex: bytes => 'b'.repeat(bytes * 2),
      });
      const durableLookup = reopenedRegistry.lookup(scenarioOwners.registry.defaultWorkspaceId);
      const reopenedReceipt = failure.ok === false && failure.receipt !== undefined
        ? receiptReadback(scenarioOwners.store, failure.receipt.id)
        : undefined;
      const recovery = failure.ok === false && failure.receipt !== undefined
        ? scenarioOwners.recoveryStore.read(failure.receipt.id)
        : undefined;
      const finalContentHash = finalLookup.ok
        ? workspaceContentReceiptHash(finalLookup.record.workspace)
        : '';
      const finalSnapshotHash = finalLookup.ok
        ? workspaceSnapshotReceiptHash(finalLookup.record.workspace)
        : '';
      const durableContentHash = durableLookup.ok
        ? workspaceContentReceiptHash(durableLookup.record.workspace)
        : '';
      const durableSnapshotHash = durableLookup.ok
        ? workspaceSnapshotReceiptHash(durableLookup.record.workspace)
        : '';
      const isolated = asFailure(failure, 'ACTION_RECEIPT_FINALIZATION_FAILED')
        && registrySeam.commit === originalCommit
        && storeSeam.transition === originalTransition
        && sourceReads === 2
        && commitCalls === 2
        && committedTransitionFaults === 1
        && rolledBackTransitions === 1
        && JSON.stringify(committedWorkspaceIds) === JSON.stringify([
          targetWorkspace.id,
          exactPriorWorkspace.id,
        ])
        && finalLookup.ok
        && finalLookup.record.version === beforeLookup.record.version + 2
        && finalLookup.record.workspace.id === exactPriorWorkspace.id
        && JSON.stringify(finalLookup.record.workspace) === JSON.stringify(exactPriorWorkspace)
        && finalContentHash === priorContentHash
        && finalSnapshotHash === priorSnapshotHash
        && finalContentHash !== targetContentHash
        && finalSnapshotHash !== targetSnapshotHash
        && /^[a-f0-9]{64}$/.test(finalContentHash)
        && /^[a-f0-9]{64}$/.test(finalSnapshotHash)
        && durableLookup.ok
        && durableLookup.record.version === finalLookup.record.version
        && durableLookup.record.workspace.id === exactPriorWorkspace.id
        && JSON.stringify(durableLookup.record.workspace) === JSON.stringify(exactPriorWorkspace)
        && durableContentHash === priorContentHash
        && durableSnapshotHash === priorSnapshotHash
        && receiptFileCount(scenarioOwners.store) === 1
        && recoveryEntryCount(scenarioOwners.recoveryStore) === 0
        && recovery?.ok === false
        && hasSingleTerminalFailureReceipt(failure, scenarioOwners.store, projections)
        && reopenedReceipt?.status === 'rolled_back'
        && reopenedReceipt.rollback.required
        && reopenedReceipt.rollback.status === 'performed'
        && reopenedReceipt.validation.status === 'failed'
        && reopenedReceipt.after === undefined
        && reopenedReceipt.failure?.code === 'ACTION_RECEIPT_FINALIZATION_FAILED';
      rollbackFailureResults.push(failure);
      rollbackProjectionChannels.push(projections);
      rollbackReceiptStores.push(scenarioOwners.store);
      rollbackIsolation.push(isolated);
      return isolated;
    });

    check(checks, 'rollback_success_failure_channels_are_redacted_and_states_are_isolated', () => {
      const markers = [
        ...pathMarkers(root),
        RAW_BODY_MARKER,
        RAW_TOKEN_MARKER,
        RAW_NATIVE_ERROR_MARKER,
      ];
      return rollbackFailureResults.length === 2
        && rollbackFailureResults.every(result => result.ok === false)
        && rollbackProjectionChannels.length === 2
        && rollbackReceiptStores.length === 2
        && rollbackIsolation.length === 2
        && rollbackIsolation.every(Boolean)
        && noRawValues(rollbackFailureResults, markers)
        && noRawValues(rollbackProjectionChannels, markers)
        && rollbackReceiptStores.every(store => allStoredReceiptBytesAreRedacted(store, markers))
        && checks.every(existing => noRawValues(existing.detail ?? '', markers));
    });

    const rollbackRefusalResults: WorkspaceSnapshotRestoreReceiptAdapterResult[] = [];
    const rollbackRefusalProjectionChannels: unknown[] = [];
    const rollbackRefusalReceiptStores: ActionReceiptStore[] = [];
    const rollbackRefusalIsolation: boolean[] = [];

    await checkAsync(checks, 'rollback_guard_refuses_compensation_after_third_party_workspace_change', async () => {
      const scope = 'fault-rollback-third-party-change';
      const priorWorkspace = workspaceFixture(
        'workspace_rollback_guard_prior',
        'Rollback Guard Prior',
        'prior semantic workspace',
        'prior',
      );
      const targetWorkspace = workspaceFixture(
        'workspace_rollback_guard_target',
        'Rollback Guard Target',
        'target semantic workspace',
        'target',
      );
      const thirdPartyWorkspace = sanitizeWorkspace(workspaceFixture(
        'workspace_rollback_guard_third_party',
        'Rollback Guard Third Party',
        'third-party semantic workspace',
        'third-party',
      ));
      const scenarioOwners = makeOwners(root, scope, priorWorkspace, () => currentNow, randomHex);
      const sourceRoot = path.join(root, scope, 'source');
      const source = validSource(sourceRoot, targetWorkspace);
      const beforeLookup = scenarioOwners.registry.lookup(scenarioOwners.registry.defaultWorkspaceId);
      if (!beforeLookup.ok) return false;
      const exactPriorWorkspace = sanitizeWorkspace(beforeLookup.record.workspace);
      const beforeLegacySnapshotHash = scenarioOwners.registry.snapshotHash(beforeLookup.record);
      const priorContentHash = workspaceContentReceiptHash(exactPriorWorkspace);
      const priorSnapshotHash = workspaceSnapshotReceiptHash(exactPriorWorkspace);
      const targetContentHash = workspaceContentReceiptHash(source.workspace);
      const targetSnapshotHash = workspaceSnapshotReceiptHash(source.workspace);
      const thirdPartyContentHash = workspaceContentReceiptHash(thirdPartyWorkspace);
      const thirdPartySnapshotHash = workspaceSnapshotReceiptHash(thirdPartyWorkspace);
      const projections: unknown[] = [];
      let sourceReads = 0;
      let commitCalls = 0;
      let thirdPartyCommits = 0;
      let committedTransitionFaults = 0;
      let incompleteTransitions = 0;
      const committedWorkspaceIds: string[] = [];
      const registrySeam = scenarioOwners.registry as unknown as {
        commit: WorkspaceRegistry['commit'];
      };
      const storeSeam = scenarioOwners.store as unknown as {
        transition: ActionReceiptStore['transition'];
      };
      const originalCommit = registrySeam.commit;
      const originalTransition = storeSeam.transition;
      const scenarioDependencies: WorkspaceSnapshotRestoreReceiptAdapterDependencies = {
        registry: scenarioOwners.registry,
        store: scenarioOwners.store,
        recoveryStore: scenarioOwners.recoveryStore,
        receiptService: scenarioOwners.receiptService,
        readSource: () => {
          sourceReads += 1;
          return source;
        },
        captureProjection: projection => { projections.push(projection); },
      };
      registrySeam.commit = (workspaceId, workspace, origin) => {
        commitCalls += 1;
        committedWorkspaceIds.push(workspace.id);
        return originalCommit.call(scenarioOwners.registry, workspaceId, workspace, origin);
      };
      storeSeam.transition = (id, input) => {
        if (input.to === 'committed') {
          committedTransitionFaults += 1;
          if (thirdPartyCommits !== 0) {
            throw new Error(`${RAW_NATIVE_ERROR_MARKER}|duplicate-third-party-commit`);
          }
          thirdPartyCommits += 1;
          scenarioOwners.registry.commit(
            scenarioOwners.registry.defaultWorkspaceId,
            thirdPartyWorkspace,
            'selftest:third-party-rollback-guard',
          );
          throw new Error(`${RAW_NATIVE_ERROR_MARKER}|${RAW_TOKEN_MARKER}|${root}`);
        }
        if (input.to === 'incomplete') incompleteTransitions += 1;
        return originalTransition.call(scenarioOwners.store, id, input);
      };
      let failure: WorkspaceSnapshotRestoreReceiptAdapterResult;
      try {
        failure = await executeWorkspaceSnapshotRestoreReceipt(
          scenarioDependencies,
          makeInput(
            scenarioOwners,
            sourceRoot,
            'workspace.snapshot.restore.fault.rollback.third-party-change',
          ),
        );
      } finally {
        registrySeam.commit = originalCommit;
        storeSeam.transition = originalTransition;
      }
      const finalLookup = scenarioOwners.registry.lookup(scenarioOwners.registry.defaultWorkspaceId);
      const reopenedRegistry = new WorkspaceRegistry({
        root: scenarioOwners.registry.root,
        defaultWorkspace: priorWorkspace,
        now: () => currentNow,
        randomHex: bytes => 'c'.repeat(bytes * 2),
      });
      const durableLookup = reopenedRegistry.lookup(scenarioOwners.registry.defaultWorkspaceId);
      const reopenedReceipt = failure.ok === false && failure.receipt !== undefined
        ? receiptReadback(scenarioOwners.store, failure.receipt.id)
        : undefined;
      const recovery = failure.ok === false && failure.receipt !== undefined
        ? scenarioOwners.recoveryStore.read(failure.receipt.id)
        : undefined;
      const afterWorkspaceResource = reopenedReceipt?.after?.resources
        .find(resource => resource.role === 'workspace');
      const afterSnapshotResource = reopenedReceipt?.after?.resources
        .find(resource => resource.role === 'snapshot');
      const finalContentHash = finalLookup.ok
        ? workspaceContentReceiptHash(finalLookup.record.workspace)
        : '';
      const finalSnapshotHash = finalLookup.ok
        ? workspaceSnapshotReceiptHash(finalLookup.record.workspace)
        : '';
      const durableContentHash = durableLookup.ok
        ? workspaceContentReceiptHash(durableLookup.record.workspace)
        : '';
      const durableSnapshotHash = durableLookup.ok
        ? workspaceSnapshotReceiptHash(durableLookup.record.workspace)
        : '';
      const recoveryIsReady = recovery !== undefined
        && recovery.ok
        && recovery.record.kind === 'workspace'
        && recovery.record.status === 'ready'
        && recovery.record.workspaceId === scenarioOwners.registry.defaultWorkspaceId
        && recovery.record.beforeHash === beforeLookup.record.head
        && recovery.record.beforeSnapshotHash === beforeLegacySnapshotHash
        && recovery.record.expectedCurrentHash === targetContentHash
        && recovery.record.expectedCurrentSnapshotHash === targetSnapshotHash
        && workspaceContentReceiptHash(recovery.record.beforeWorkspace as ModWorkspace)
          === priorContentHash
        && workspaceSnapshotReceiptHash(recovery.record.beforeWorkspace as ModWorkspace)
          === priorSnapshotHash;
      const isolated = asFailure(failure, 'workspace_snapshot_restore_rollback_failed')
        && registrySeam.commit === originalCommit
        && storeSeam.transition === originalTransition
        && sourceReads === 2
        && commitCalls === 2
        && thirdPartyCommits === 1
        && committedTransitionFaults === 1
        && incompleteTransitions === 1
        && JSON.stringify(committedWorkspaceIds) === JSON.stringify([
          source.workspace.id,
          thirdPartyWorkspace.id,
        ])
        && finalLookup.ok
        && finalLookup.record.version === beforeLookup.record.version + 2
        && finalLookup.record.workspace.id === thirdPartyWorkspace.id
        && JSON.stringify(finalLookup.record.workspace) === JSON.stringify(thirdPartyWorkspace)
        && finalContentHash === thirdPartyContentHash
        && finalSnapshotHash === thirdPartySnapshotHash
        && finalContentHash !== priorContentHash
        && finalSnapshotHash !== priorSnapshotHash
        && finalContentHash !== targetContentHash
        && finalSnapshotHash !== targetSnapshotHash
        && /^[a-f0-9]{64}$/.test(finalContentHash)
        && /^[a-f0-9]{64}$/.test(finalSnapshotHash)
        && durableLookup.ok
        && durableLookup.record.version === finalLookup.record.version
        && durableLookup.record.workspace.id === thirdPartyWorkspace.id
        && JSON.stringify(durableLookup.record.workspace) === JSON.stringify(thirdPartyWorkspace)
        && durableContentHash === thirdPartyContentHash
        && durableSnapshotHash === thirdPartySnapshotHash
        && receiptFileCount(scenarioOwners.store) === 1
        && recoveryEntryCount(scenarioOwners.recoveryStore) === 1
        && recoveryIsReady
        && hasSingleTerminalFailureReceipt(failure, scenarioOwners.store, projections)
        && failure.ok === false
        && failure.receipt?.status === 'incomplete'
        && reopenedReceipt?.status === 'incomplete'
        && reopenedReceipt.rollback.required
        && reopenedReceipt.rollback.status === 'failed'
        && reopenedReceipt.validation.status === 'failed'
        && reopenedReceipt.after?.outcome === 'partial'
        && reopenedReceipt.after.code === 'workspace_snapshot_restore_rollback_failed'
        && reopenedReceipt.after.resources.length === 2
        && afterWorkspaceResource?.hash === thirdPartyContentHash
        && afterSnapshotResource?.hash === thirdPartySnapshotHash
        && reopenedReceipt.failure?.code === 'ACTION_RECEIPT_ROLLBACK_FAILED';
      rollbackRefusalResults.push(failure);
      rollbackRefusalProjectionChannels.push(projections);
      rollbackRefusalReceiptStores.push(scenarioOwners.store);
      rollbackRefusalIsolation.push(isolated);
      return isolated;
    });

    await checkAsync(checks, 'rollback_domain_commit_failure_preserves_target_and_incomplete_truth', async () => {
      const scope = 'fault-rollback-domain-commit';
      const priorWorkspace = workspaceFixture(
        'workspace_rollback_commit_prior',
        'Rollback Commit Prior',
        'prior semantic workspace',
        'prior',
      );
      const targetWorkspace = workspaceFixture(
        'workspace_rollback_commit_target',
        'Rollback Commit Target',
        'target semantic workspace',
        'target',
      );
      const scenarioOwners = makeOwners(root, scope, priorWorkspace, () => currentNow, randomHex);
      const sourceRoot = path.join(root, scope, 'source');
      const source = validSource(sourceRoot, targetWorkspace);
      const beforeLookup = scenarioOwners.registry.lookup(scenarioOwners.registry.defaultWorkspaceId);
      if (!beforeLookup.ok) return false;
      const exactPriorWorkspace = sanitizeWorkspace(beforeLookup.record.workspace);
      const beforeLegacySnapshotHash = scenarioOwners.registry.snapshotHash(beforeLookup.record);
      const priorContentHash = workspaceContentReceiptHash(exactPriorWorkspace);
      const priorSnapshotHash = workspaceSnapshotReceiptHash(exactPriorWorkspace);
      const targetContentHash = workspaceContentReceiptHash(source.workspace);
      const targetSnapshotHash = workspaceSnapshotReceiptHash(source.workspace);
      const projections: unknown[] = [];
      let sourceReads = 0;
      let commitCalls = 0;
      let delegatedCommitCalls = 0;
      let committedTransitionFaults = 0;
      let incompleteTransitions = 0;
      const committedWorkspaceIds: string[] = [];
      const registrySeam = scenarioOwners.registry as unknown as {
        commit: WorkspaceRegistry['commit'];
      };
      const storeSeam = scenarioOwners.store as unknown as {
        transition: ActionReceiptStore['transition'];
      };
      const originalCommit = registrySeam.commit;
      const originalTransition = storeSeam.transition;
      const scenarioDependencies: WorkspaceSnapshotRestoreReceiptAdapterDependencies = {
        registry: scenarioOwners.registry,
        store: scenarioOwners.store,
        recoveryStore: scenarioOwners.recoveryStore,
        receiptService: scenarioOwners.receiptService,
        readSource: () => {
          sourceReads += 1;
          return source;
        },
        captureProjection: projection => { projections.push(projection); },
      };
      registrySeam.commit = (workspaceId, workspace, origin) => {
        commitCalls += 1;
        committedWorkspaceIds.push(workspace.id);
        if (commitCalls === 2) {
          throw new Error(`${RAW_NATIVE_ERROR_MARKER}|${RAW_TOKEN_MARKER}|${root}`);
        }
        delegatedCommitCalls += 1;
        return originalCommit.call(scenarioOwners.registry, workspaceId, workspace, origin);
      };
      storeSeam.transition = (id, input) => {
        if (input.to === 'committed') {
          committedTransitionFaults += 1;
          throw new Error(`${RAW_NATIVE_ERROR_MARKER}|${RAW_TOKEN_MARKER}|${root}`);
        }
        if (input.to === 'incomplete') incompleteTransitions += 1;
        return originalTransition.call(scenarioOwners.store, id, input);
      };
      let failure: WorkspaceSnapshotRestoreReceiptAdapterResult;
      try {
        failure = await executeWorkspaceSnapshotRestoreReceipt(
          scenarioDependencies,
          makeInput(
            scenarioOwners,
            sourceRoot,
            'workspace.snapshot.restore.fault.rollback.domain-commit',
          ),
        );
      } finally {
        registrySeam.commit = originalCommit;
        storeSeam.transition = originalTransition;
      }
      const finalLookup = scenarioOwners.registry.lookup(scenarioOwners.registry.defaultWorkspaceId);
      const reopenedRegistry = new WorkspaceRegistry({
        root: scenarioOwners.registry.root,
        defaultWorkspace: priorWorkspace,
        now: () => currentNow,
        randomHex: bytes => 'd'.repeat(bytes * 2),
      });
      const durableLookup = reopenedRegistry.lookup(scenarioOwners.registry.defaultWorkspaceId);
      const reopenedReceipt = failure.ok === false && failure.receipt !== undefined
        ? receiptReadback(scenarioOwners.store, failure.receipt.id)
        : undefined;
      const recovery = failure.ok === false && failure.receipt !== undefined
        ? scenarioOwners.recoveryStore.read(failure.receipt.id)
        : undefined;
      const afterWorkspaceResource = reopenedReceipt?.after?.resources
        .find(resource => resource.role === 'workspace');
      const afterSnapshotResource = reopenedReceipt?.after?.resources
        .find(resource => resource.role === 'snapshot');
      const finalContentHash = finalLookup.ok
        ? workspaceContentReceiptHash(finalLookup.record.workspace)
        : '';
      const finalSnapshotHash = finalLookup.ok
        ? workspaceSnapshotReceiptHash(finalLookup.record.workspace)
        : '';
      const durableContentHash = durableLookup.ok
        ? workspaceContentReceiptHash(durableLookup.record.workspace)
        : '';
      const durableSnapshotHash = durableLookup.ok
        ? workspaceSnapshotReceiptHash(durableLookup.record.workspace)
        : '';
      const recoveryIsReady = recovery !== undefined
        && recovery.ok
        && recovery.record.kind === 'workspace'
        && recovery.record.status === 'ready'
        && recovery.record.workspaceId === scenarioOwners.registry.defaultWorkspaceId
        && recovery.record.beforeHash === beforeLookup.record.head
        && recovery.record.beforeSnapshotHash === beforeLegacySnapshotHash
        && recovery.record.expectedCurrentHash === targetContentHash
        && recovery.record.expectedCurrentSnapshotHash === targetSnapshotHash
        && workspaceContentReceiptHash(recovery.record.beforeWorkspace as ModWorkspace)
          === priorContentHash
        && workspaceSnapshotReceiptHash(recovery.record.beforeWorkspace as ModWorkspace)
          === priorSnapshotHash;
      const isolated = asFailure(failure, 'workspace_snapshot_restore_rollback_failed')
        && registrySeam.commit === originalCommit
        && storeSeam.transition === originalTransition
        && sourceReads === 2
        && commitCalls === 2
        && delegatedCommitCalls === 1
        && committedTransitionFaults === 1
        && incompleteTransitions === 1
        && JSON.stringify(committedWorkspaceIds) === JSON.stringify([
          source.workspace.id,
          exactPriorWorkspace.id,
        ])
        && finalLookup.ok
        && finalLookup.record.version === beforeLookup.record.version + 1
        && finalLookup.record.workspace.id === source.workspace.id
        && JSON.stringify(finalLookup.record.workspace) === JSON.stringify(source.workspace)
        && finalContentHash === targetContentHash
        && finalSnapshotHash === targetSnapshotHash
        && finalContentHash !== priorContentHash
        && finalSnapshotHash !== priorSnapshotHash
        && /^[a-f0-9]{64}$/.test(finalContentHash)
        && /^[a-f0-9]{64}$/.test(finalSnapshotHash)
        && durableLookup.ok
        && durableLookup.record.version === finalLookup.record.version
        && durableLookup.record.workspace.id === source.workspace.id
        && JSON.stringify(durableLookup.record.workspace) === JSON.stringify(source.workspace)
        && durableContentHash === targetContentHash
        && durableSnapshotHash === targetSnapshotHash
        && receiptFileCount(scenarioOwners.store) === 1
        && recoveryEntryCount(scenarioOwners.recoveryStore) === 1
        && recoveryIsReady
        && hasSingleTerminalFailureReceipt(failure, scenarioOwners.store, projections)
        && failure.ok === false
        && failure.receipt?.status === 'incomplete'
        && reopenedReceipt?.status === 'incomplete'
        && reopenedReceipt.rollback.required
        && reopenedReceipt.rollback.status === 'failed'
        && reopenedReceipt.validation.status === 'failed'
        && reopenedReceipt.after?.outcome === 'partial'
        && reopenedReceipt.after.code === 'workspace_snapshot_restore_rollback_failed'
        && reopenedReceipt.after.resources.length === 2
        && afterWorkspaceResource?.hash === targetContentHash
        && afterSnapshotResource?.hash === targetSnapshotHash
        && reopenedReceipt.failure?.code === 'ACTION_RECEIPT_ROLLBACK_FAILED';
      rollbackRefusalResults.push(failure);
      rollbackRefusalProjectionChannels.push(projections);
      rollbackRefusalReceiptStores.push(scenarioOwners.store);
      rollbackRefusalIsolation.push(isolated);
      return isolated;
    });

    check(checks, 'rollback_failure_channels_are_redacted_and_states_are_isolated', () => {
      const markers = [
        ...pathMarkers(root),
        RAW_BODY_MARKER,
        RAW_TOKEN_MARKER,
        RAW_NATIVE_ERROR_MARKER,
      ];
      return rollbackRefusalResults.length === 2
        && rollbackRefusalResults.every(result => result.ok === false)
        && rollbackRefusalProjectionChannels.length === 2
        && rollbackRefusalReceiptStores.length === 2
        && rollbackRefusalIsolation.length === 2
        && rollbackRefusalIsolation.every(Boolean)
        && noRawValues(rollbackRefusalResults, markers)
        && noRawValues(rollbackRefusalProjectionChannels, markers)
        && rollbackRefusalReceiptStores.every(
          store => allStoredReceiptBytesAreRedacted(store, markers),
        )
        && checks.every(existing => noRawValues(existing.detail ?? '', markers));
    });
  } catch {
    checks.push({
      name: 'real_owner_snapshot_restore_scenario_completed',
      pass: false,
      detail: 'unexpected selftest failure',
    });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }

  return summarize(checks);
}

const invokedDirectly = path.basename(process.argv[1] ?? '')
  === 'workspaceSnapshotRestoreReceiptAdapter.selftest.ts';
if (invokedDirectly) {
  void runWorkspaceSnapshotRestoreReceiptAdapterSelftest()
    .then(result => {
      for (const item of result.checks) {
        console.log(`${item.pass ? 'PASS' : 'FAIL'} ${item.name}${item.detail === undefined ? '' : `: ${item.detail}`}`);
      }
      console.log(`${result.passed}/${result.total} checks passed`);
      if (!result.allPassed) process.exitCode = 1;
    })
    .catch(() => {
      console.error('workspace snapshot restore receipt adapter selftest failed unexpectedly');
      process.exitCode = 1;
    });
}
