import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  assertValidActionReceipt,
  serializeActionReceipt,
} from '../lib/actionReceipt';
import { ActionReceiptStore } from '../lib/actionReceiptStore';
import { WorkspaceRegistry } from '../lib/workspaceRegistry';
import type { ModWorkspace } from '../types';
import {
  executeWorkspaceCreateReceipt,
  prepareWorkspaceCreateReceiptFacts,
  readAuthoritativeWorkspaceRecords,
  type WorkspaceCreateReceiptAdapterResult,
} from './workspaceCreateReceiptAdapter';
import { WorkspaceReceiptService } from './workspaceReceiptService';

export interface WorkspaceCreateReceiptAdapterSelftestCheck {
  name: string;
  pass: boolean;
  detail?: string;
}

export interface WorkspaceCreateReceiptAdapterSelftestResult {
  allPassed: boolean;
  pass: boolean;
  passed: number;
  total: number;
  failures: string[];
  checks: WorkspaceCreateReceiptAdapterSelftestCheck[];
}

function workspaceFixture(id: string, name: string, description: string): ModWorkspace {
  return {
    id,
    name,
    version: '1.0.0',
    author: 'Forge Selftest',
    description,
    nodes: [{
      id: `${id}_node_1`,
      type: 'cue',
      label: 'Selftest Cue',
      xmlTag: 'cue',
      x: 100,
      y: 100,
      properties: {},
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

function summarize(checks: WorkspaceCreateReceiptAdapterSelftestCheck[]): WorkspaceCreateReceiptAdapterSelftestResult {
  const passed = checks.filter(check => check.pass).length;
  const failures = checks.filter(check => !check.pass).map(check => check.name);
  return {
    allPassed: failures.length === 0,
    pass: failures.length === 0,
    passed,
    total: checks.length,
    failures,
    checks,
  };
}

interface WorkspaceRegistryEvidenceEntry {
  workspaceId: string;
  version: number;
  head: string;
  snapshotHash: string;
  recordJson: string;
  summaryJson: string;
}

interface WorkspaceRegistryEvidence {
  defaultWorkspaceId: string;
  entries: WorkspaceRegistryEvidenceEntry[];
}

function captureWorkspaceRegistryEvidence(registry: WorkspaceRegistry): WorkspaceRegistryEvidence {
  return {
    defaultWorkspaceId: registry.defaultWorkspaceId,
    entries: registry.list().map(summary => {
      const found = registry.lookup(summary.workspaceId);
      if (found.ok === false) throw new Error('workspace registry evidence unavailable');
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

function sameWorkspaceRegistryEvidence(
  left: WorkspaceRegistryEvidence,
  right: WorkspaceRegistryEvidence,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function preservesWorkspaceRegistryEvidence(
  before: WorkspaceRegistryEvidence,
  after: WorkspaceRegistryEvidence,
): boolean {
  if (before.defaultWorkspaceId !== after.defaultWorkspaceId) return false;
  return before.entries.every(entry => {
    const current = after.entries.find(candidate => candidate.workspaceId === entry.workspaceId);
    return current !== undefined
      && current.version === entry.version
      && current.head === entry.head
      && current.snapshotHash === entry.snapshotHash
      && current.recordJson === entry.recordJson
      && current.summaryJson === entry.summaryJson;
  });
}

function captureDirectoryBytes(directory: string): string {
  if (!fs.existsSync(directory)) return '[]';
  const entries: Array<{ path: string; bytes: string }> = [];
  const visit = (current: string): void => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) {
        visit(absolute);
      } else if (entry.isFile()) {
        entries.push({
          path: path.relative(directory, absolute).replace(/\\/g, '/'),
          bytes: fs.readFileSync(absolute).toString('base64'),
        });
      } else {
        throw new Error('workspace registry evidence unavailable');
      }
    }
  };
  visit(directory);
  entries.sort((left, right) => left.path.localeCompare(right.path));
  return JSON.stringify(entries);
}

function actionReceiptFileCount(store: ActionReceiptStore): number {
  if (!fs.existsSync(store.root)) return 0;
  return fs.readdirSync(store.root, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.json'))
    .length;
}

function terminalFailedReadbackMatches(
  store: ActionReceiptStore,
  result: WorkspaceCreateReceiptAdapterResult,
): boolean {
  if (result.ok || result.receipt === undefined || result.receipt.status !== 'failed') return false;
  try {
    const stored = assertValidActionReceipt(store.read(result.receipt.id));
    return stored.status === 'failed'
      && stored.id === result.receipt.id
      && stored.hash === result.receipt.hash;
  } catch {
    return false;
  }
}

function boundedResultBytes(result: WorkspaceCreateReceiptAdapterResult): string {
  // Success intentionally returns the exact WorkspaceRecord; receipt/failure metadata is the
  // bounded surface that must not repeat raw request material.
  return result.ok
    ? JSON.stringify({ ok: true, receipt: result.receipt, replayed: result.replayed })
    : JSON.stringify(result);
}

function excludesRawValues(bytes: string, values: readonly string[]): boolean {
  return values.every(value => value.length > 0 && !bytes.includes(value));
}

function rawFixtureValues(root: string, ...markers: string[]): string[] {
  const backslashRoot = root.replace(/\//g, '\\');
  const forwardSlashRoot = root.replace(/\\/g, '/');
  return [...new Set([
    ...markers,
    backslashRoot,
    forwardSlashRoot,
    JSON.stringify(backslashRoot).slice(1, -1),
  ])];
}

function isWorkspaceCreateSuccess(
  result: WorkspaceCreateReceiptAdapterResult,
): result is Extract<WorkspaceCreateReceiptAdapterResult, { ok: true }> {
  return result.ok;
}

function isWorkspaceCreateFailure(
  result: WorkspaceCreateReceiptAdapterResult,
): result is Extract<WorkspaceCreateReceiptAdapterResult, { ok: false }> {
  return !result.ok;
}

function wrapActionReceiptStore(
  store: ActionReceiptStore,
  overrides: {
    read?: ActionReceiptStore['read'];
    transition?: ActionReceiptStore['transition'];
  },
): ActionReceiptStore {
  return new Proxy(store, {
    get(target, property) {
      if (property === 'read' && overrides.read !== undefined) return overrides.read;
      if (property === 'transition' && overrides.transition !== undefined) return overrides.transition;
      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

function canonicalReceiptBytes(store: ActionReceiptStore, receiptId: string): {
  receipt: ReturnType<typeof assertValidActionReceipt>;
  bytes: string;
  canonical: boolean;
} {
  const receipt = assertValidActionReceipt(store.read(receiptId));
  const bytes = fs.readFileSync(store.pathFor(receiptId), 'utf8');
  return {
    receipt,
    bytes,
    canonical: bytes === serializeActionReceipt(receipt),
  };
}

export async function runWorkspaceCreateReceiptAdapterSelftest(): Promise<WorkspaceCreateReceiptAdapterSelftestResult> {
  const checks: WorkspaceCreateReceiptAdapterSelftestCheck[] = [];
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'x4forge-workspace-create-receipt-adapter-'));
  let now = Date.parse('2026-08-04T12:00:00.000Z');
  let sequence = 1;
  const randomHex = (bytes: number): string => (sequence++)
    .toString(16)
    .padStart(bytes * 2, '0')
    .slice(-bytes * 2);
  const createIsolatedOwners = (scope: string, maxRecords?: number) => {
    const registry = new WorkspaceRegistry({
      root: path.join(root, scope, 'workspace-registry'),
      defaultWorkspace: workspaceFixture(
        `workspace_${scope}_default`,
        `${scope} Default`,
        `${scope} default workspace`,
      ),
      now: () => now,
      randomHex,
      ...(maxRecords === undefined ? {} : { maxRecords }),
    });
    const store = new ActionReceiptStore({
      root: path.join(root, scope, 'action-receipts'),
      now: () => now,
    });
    return {
      registry,
      store,
      receiptService: new WorkspaceReceiptService(),
    };
  };

  try {
    const registry = new WorkspaceRegistry({
      root: path.join(root, 'workspace-registry'),
      defaultWorkspace: workspaceFixture('workspace_default_selftest', 'Default Selftest', 'Default workspace'),
      now: () => now,
      randomHex,
    });
    const store = new ActionReceiptStore({
      root: path.join(root, 'action-receipts'),
      now: () => now,
    });
    const service = new WorkspaceReceiptService();
    const unrelatedRecord = registry.create(
      workspaceFixture('workspace_unrelated_selftest', 'Unrelated Selftest', 'Unrelated workspace'),
      'selftest:unrelated',
    );
    const registryBeforeCreate = captureWorkspaceRegistryEvidence(registry);
    const unrelatedBeforeCreate = registryBeforeCreate.entries.find(
      entry => entry.workspaceId === unrelatedRecord.workspaceId,
    );
    if (unrelatedBeforeCreate === undefined) {
      checks.push({
        name: 'first_create_preserves_default_and_unrelated_record',
        pass: false,
      });
      return summarize(checks);
    }
    const descriptionMarker = 'workspace-description-marker-8f42d10bc79a';
    const originMarker = 'workspace-origin-marker-61ae2530f84c';
    const operationId = 'workspace.create.selftest';
    const clientId = 'client_workspace_create_selftest';
    const clientVersion = '1.0.0';
    const requestedWorkspace = workspaceFixture(
      'workspace_created_selftest',
      'Created Selftest',
      descriptionMarker,
    );
    const registryRead = readAuthoritativeWorkspaceRecords(registry);
    const facts = prepareWorkspaceCreateReceiptFacts(registry, requestedWorkspace);
    if (registryRead.ok === false) {
      checks.push({
        name: 'real_registry_summaries_and_create_facts_use_bounded_hashes',
        pass: false,
        detail: registryRead.code,
      });
      return summarize(checks);
    }
    if (facts.ok === false) {
      checks.push({
        name: 'real_registry_summaries_and_create_facts_use_bounded_hashes',
        pass: false,
        detail: facts.code,
      });
      return summarize(checks);
    }
    const hash64 = /^[a-f0-9]{64}$/;
    const factsPass = registry.list().every(summary => /^[a-f0-9]{16}$/.test(summary.snapshotHash))
      && registryRead.records.length === registry.list().length
      && facts.resource.role === 'data'
      && facts.resource.root === 'workspace-registry'
      && facts.resource.relativePath === 'registry'
      && typeof facts.resource.beforeHash === 'string'
      && hash64.test(facts.resource.beforeHash)
      && hash64.test(facts.proposedContentHash)
      && hash64.test(facts.proposedSnapshotHash)
      && hash64.test(facts.requestHash)
      && hash64.test(facts.beforeHash);
    checks.push({
      name: 'real_registry_summaries_and_create_facts_use_bounded_hashes',
      pass: factsPass,
    });

    let captureProjectionCalls = 0;
    const dependencies = {
      registry,
      receiptService: service,
      store,
      captureProjection: () => {
        captureProjectionCalls += 1;
        throw new Error('expected selftest projection capture failure');
      },
    };
    const input = {
      requestedWorkspace,
      origin: originMarker,
      operationId,
      identity: {
        kind: 'studio',
        clientId,
        version: clientVersion,
      },
    };
    now += 1_000;

    const result = await executeWorkspaceCreateReceipt(dependencies, input);

    const registryAfterCreate = captureWorkspaceRegistryEvidence(registry);
    const unrelatedAfterCreate = registryAfterCreate.entries.find(
      entry => entry.workspaceId === unrelatedRecord.workspaceId,
    );
    const createdEntries = registryAfterCreate.entries.filter(
      entry => !registryBeforeCreate.entries.some(before => before.workspaceId === entry.workspaceId),
    );
    const pass = result.ok
      && result.receipt.status === 'committed'
      && result.replayed === false
      && registryAfterCreate.defaultWorkspaceId === registryBeforeCreate.defaultWorkspaceId
      && registryAfterCreate.entries.length === registryBeforeCreate.entries.length + 1
      && unrelatedAfterCreate?.recordJson === unrelatedBeforeCreate.recordJson
      && unrelatedAfterCreate.summaryJson === unrelatedBeforeCreate.summaryJson
      && createdEntries.length === 1
      && createdEntries[0].workspaceId === result.record.workspaceId
      && captureProjectionCalls === 1
      && registry.lookup(result.record.workspaceId).ok;
    let detail: string | undefined;
    if (!pass) {
      detail = 'code' in result
        ? `code=${result.code}`
        : `status=${result.receipt.status}`;
    }
    checks.push({
      name: 'real_owner_studio_create_commits_one_record',
      pass,
      ...(detail === undefined ? {} : { detail }),
    });
    if (result.ok === false) return summarize(checks);

    const reopened = assertValidActionReceipt(store.read(result.receipt.id));
    const receiptBytes = fs.readFileSync(store.pathFor(result.receipt.id), 'utf8');
    const canonicalBytes = serializeActionReceipt(reopened);
    const beforeResource = reopened.authority.resources[0];
    const afterResource = reopened.after?.resources[0];
    const expectedAfterCode = `workspace_created_${result.record.workspaceId}`;
    const receiptPass = receiptBytes === canonicalBytes
      && reopened.id === result.receipt.id
      && reopened.hash === result.receipt.hash
      && reopened.status === result.receipt.status
      && reopened.status === 'committed'
      && reopened.authority.scope === 'global'
      && reopened.authority.operationId === operationId
      && reopened.authority.requestScope === 'workspace-registry'
      && reopened.actor.kind === 'human'
      && reopened.actor.id === 'studio'
      && reopened.client.channel === 'studio'
      && reopened.client.id === clientId
      && reopened.client.version === clientVersion
      && reopened.input.requestHash === facts.requestHash
      && reopened.input.beforeHash === facts.beforeHash
      && reopened.authority.resources.length === 1
      && beforeResource?.role === facts.resource.role
      && beforeResource.root === facts.resource.root
      && beforeResource.relativePath === facts.resource.relativePath
      && beforeResource.beforeHash === facts.resource.beforeHash
      && reopened.after?.resources.length === 1
      && afterResource?.role === 'data'
      && afterResource.root === 'workspace-registry'
      && afterResource.relativePath === 'registry'
      && hash64.test(afterResource.hash)
      && reopened.after.outcome === 'applied'
      && reopened.after.code === expectedAfterCode
      && /^workspace_created_(ws_[a-f0-9]{24})$/i.test(reopened.after.code);
    checks.push({
      name: 'authoritative_receipt_is_canonical_global_and_applied',
      pass: receiptPass,
    });

    const projectionBytes = JSON.stringify(result.receipt);
    const tempRootBackslash = root.replace(/\//g, '\\');
    const tempRootForwardSlash = root.replace(/\\/g, '/');
    const escapedTempRoot = JSON.stringify(tempRootBackslash).slice(1, -1);
    const forbiddenValues = new Set([
      descriptionMarker,
      originMarker,
      tempRootBackslash,
      tempRootForwardSlash,
      escapedTempRoot,
    ]);
    const redactionPass = [...forbiddenValues].every(value =>
      !receiptBytes.includes(value) && !projectionBytes.includes(value));
    checks.push({
      name: 'receipt_and_projection_exclude_raw_workspace_origin_and_paths',
      pass: redactionPass,
    });

    const registryBeforeReplay = captureWorkspaceRegistryEvidence(registry);
    const replay = await executeWorkspaceCreateReceipt(dependencies, input);
    const registryAfterReplay = captureWorkspaceRegistryEvidence(registry);
    if (replay.ok === false) {
      checks.push({
        name: 'exact_replay_returns_same_projection_without_registry_change',
        pass: false,
        detail: replay.code,
      });
    } else {
      const replayPass = replay.replayed
        && replay.record.workspaceId === result.record.workspaceId
        && JSON.stringify(replay.receipt) === projectionBytes
        && sameWorkspaceRegistryEvidence(registryBeforeReplay, registryAfterReplay);
      checks.push({
        name: 'exact_replay_returns_same_projection_without_registry_change',
        pass: replayPass,
      });
    }

    now += 1_000;
    const originChangedRecord = registry.commit(
      result.record.workspaceId,
      result.record.workspace,
      'selftest:origin-change',
    );
    const registryBeforeOriginReplay = captureWorkspaceRegistryEvidence(registry);
    const originReplay = await executeWorkspaceCreateReceipt(dependencies, input);
    const registryAfterOriginReplay = captureWorkspaceRegistryEvidence(registry);
    if (originReplay.ok === false) {
      checks.push({
        name: 'replay_returns_current_record_after_origin_change',
        pass: false,
        detail: originReplay.code,
      });
    } else {
      const originReplayPass = originReplay.replayed
        && originReplay.record.workspaceId === result.record.workspaceId
        && originReplay.record.origin === 'selftest:origin-change'
        && originReplay.record.version === originChangedRecord.version
        && JSON.stringify(originReplay.receipt) === projectionBytes
        && sameWorkspaceRegistryEvidence(registryBeforeOriginReplay, registryAfterOriginReplay);
      checks.push({
        name: 'replay_returns_current_record_after_origin_change',
        pass: originReplayPass,
      });
    }

    const registryBeforeConflict = captureWorkspaceRegistryEvidence(registry);
    const currentBeforeConflict = registry.lookup(result.record.workspaceId);
    const conflict = await executeWorkspaceCreateReceipt(dependencies, {
      ...input,
      requestedWorkspace: {
        ...requestedWorkspace,
        description: `${descriptionMarker}-changed`,
      },
    });
    const registryAfterConflict = captureWorkspaceRegistryEvidence(registry);
    const currentAfterConflict = registry.lookup(result.record.workspaceId);
    const conflictPass = conflict.ok === false
      && conflict.code === 'ACTION_RECEIPT_DUPLICATE_CONFLICT'
      && !('receipt' in conflict)
      && sameWorkspaceRegistryEvidence(registryBeforeConflict, registryAfterConflict)
      && currentBeforeConflict.ok
      && currentAfterConflict.ok
      && JSON.stringify(currentBeforeConflict.record) === JSON.stringify(currentAfterConflict.record)
      && JSON.stringify(result.receipt) === projectionBytes;
    checks.push({
      name: 'changed_workspace_facts_duplicate_conflict_without_state_change',
      pass: conflictPass,
    });

    const registryBeforeDifferentClient = captureWorkspaceRegistryEvidence(registry);
    const differentClient = await executeWorkspaceCreateReceipt(dependencies, {
      ...input,
      identity: {
        kind: 'studio',
        clientId: 'client_workspace_create_selftest_distinct',
        version: clientVersion,
      },
    });
    const registryAfterDifferentClient = captureWorkspaceRegistryEvidence(registry);
    if (differentClient.ok === false) {
      checks.push({
        name: 'different_studio_client_is_distinct_operation_identity',
        pass: false,
        detail: differentClient.code,
      });
    } else {
      const differentClientEntries = registryAfterDifferentClient.entries.filter(
        entry => !registryBeforeDifferentClient.entries.some(before => before.workspaceId === entry.workspaceId),
      );
      const differentClientPass = !differentClient.replayed
        && differentClient.receipt.status === 'committed'
        && differentClient.receipt.id !== result.receipt.id
        && differentClient.record.workspaceId !== result.record.workspaceId
        && registryAfterDifferentClient.entries.length === registryBeforeDifferentClient.entries.length + 1
        && differentClientEntries.length === 1
        && differentClientEntries[0].workspaceId === differentClient.record.workspaceId
        && preservesWorkspaceRegistryEvidence(registryBeforeDifferentClient, registryAfterDifferentClient);
      checks.push({
        name: 'different_studio_client_is_distinct_operation_identity',
        pass: differentClientPass,
      });
    }

    const runInvalidOperationCheck = async (
      scope: string,
      operationIdValue: string,
      checkName: string,
    ): Promise<void> => {
      const owners = createIsolatedOwners(scope);
      const description = `${scope}-description-marker-3c79b8`;
      const origin = `${scope}-origin-marker-8d25f1`;
      const unrelated = owners.registry.create(
        workspaceFixture(`workspace_${scope}_unrelated`, `${scope} Unrelated`, `${scope} unrelated workspace`),
        `${scope}:unrelated`,
      );
      const before = captureWorkspaceRegistryEvidence(owners.registry);
      const receiptCountBefore = actionReceiptFileCount(owners.store);
      now += 1_000;
      const refusal = await executeWorkspaceCreateReceipt(owners, {
        requestedWorkspace: workspaceFixture(`workspace_${scope}_requested`, `${scope} Requested`, description),
        origin,
        operationId: operationIdValue,
        identity: {
          kind: 'studio',
          clientId: `client_workspace_create_${scope}`,
          version: '1.0.0',
        },
      });
      const after = captureWorkspaceRegistryEvidence(owners.registry);
      const refusalPass = refusal.ok === false
        && refusal.code === 'ACTION_RECEIPT_OPERATION_ID_INVALID'
        && refusal.replayed === false
        && refusal.receipt === undefined
        && before.entries.length === 2
        && before.entries.some(entry => entry.workspaceId === unrelated.workspaceId)
        && sameWorkspaceRegistryEvidence(before, after)
        && actionReceiptFileCount(owners.store) === receiptCountBefore
        && excludesRawValues(
          boundedResultBytes(refusal),
          rawFixtureValues(root, description, origin),
        );
      checks.push({
        name: checkName,
        pass: refusalPass,
        ...(refusalPass ? {} : { detail: isWorkspaceCreateFailure(refusal) ? refusal.code : 'unexpected_success' }),
      });
    };

    await runInvalidOperationCheck(
      'invalid_empty_operation',
      '',
      'empty_operation_id_refuses_without_receipt_or_registry_change',
    );
    await runInvalidOperationCheck(
      'invalid_malformed_operation',
      'workspace/create malformed',
      'malformed_operation_id_refuses_without_receipt_or_registry_change',
    );

    const deadlineOwners = createIsolatedOwners('deadline_refusal');
    const deadlineDescription = 'deadline-description-marker-5b827c';
    const deadlineOrigin = 'deadline-origin-marker-4a19ed';
    const deadlineUnrelated = deadlineOwners.registry.create(
      workspaceFixture('workspace_deadline_unrelated', 'Deadline Unrelated', 'Deadline unrelated workspace'),
      'deadline:unrelated',
    );
    const deadlineBefore = captureWorkspaceRegistryEvidence(deadlineOwners.registry);
    const deadlineReceiptCountBefore = actionReceiptFileCount(deadlineOwners.store);
    let mayProceedCalls = 0;
    now += 1_000;
    const deadlineResult = await executeWorkspaceCreateReceipt(deadlineOwners, {
      requestedWorkspace: workspaceFixture(
        'workspace_deadline_requested',
        'Deadline Requested',
        deadlineDescription,
      ),
      origin: deadlineOrigin,
      operationId: 'workspace.create.deadline-refusal',
      identity: {
        kind: 'studio',
        clientId: 'client_workspace_create_deadline',
        version: '1.0.0',
      },
      mayProceed: () => {
        mayProceedCalls += 1;
        return false;
      },
    });
    const deadlineAfter = captureWorkspaceRegistryEvidence(deadlineOwners.registry);
    const deadlinePass = deadlineResult.ok === false
      && deadlineResult.code === 'WORKSPACE_CREATE_RESPONSE_DEADLINE'
      && deadlineResult.replayed === false
      && mayProceedCalls === 1
      && deadlineBefore.entries.length === 2
      && deadlineBefore.entries.some(entry => entry.workspaceId === deadlineUnrelated.workspaceId)
      && sameWorkspaceRegistryEvidence(deadlineBefore, deadlineAfter)
      && terminalFailedReadbackMatches(deadlineOwners.store, deadlineResult)
      && actionReceiptFileCount(deadlineOwners.store) === deadlineReceiptCountBefore + 1
      && excludesRawValues(
        boundedResultBytes(deadlineResult),
        rawFixtureValues(root, deadlineDescription, deadlineOrigin),
      );
    checks.push({
      name: 'may_proceed_false_records_deadline_failure_without_registry_change',
      pass: deadlinePass,
      ...(deadlinePass ? {} : {
        detail: isWorkspaceCreateFailure(deadlineResult) ? deadlineResult.code : 'unexpected_success',
      }),
    });

    const fullOwners = createIsolatedOwners('full_registry', 1);
    const fullDescription = 'full-description-marker-c21a64';
    const fullOrigin = 'full-origin-marker-a9307e';
    const fullBefore = captureWorkspaceRegistryEvidence(fullOwners.registry);
    const fullBytesBefore = captureDirectoryBytes(fullOwners.registry.root);
    const fullReceiptCountBefore = actionReceiptFileCount(fullOwners.store);
    now += 1_000;
    const fullResult = await executeWorkspaceCreateReceipt(fullOwners, {
      requestedWorkspace: workspaceFixture('workspace_full_requested', 'Full Requested', fullDescription),
      origin: fullOrigin,
      operationId: 'workspace.create.full-registry',
      identity: {
        kind: 'studio',
        clientId: 'client_workspace_create_full_registry',
        version: '1.0.0',
      },
    });
    const fullAfter = captureWorkspaceRegistryEvidence(fullOwners.registry);
    const fullBytesAfter = captureDirectoryBytes(fullOwners.registry.root);
    const fullPass = fullResult.ok === false
      && fullResult.code === 'WORKSPACE_CREATE_LIMIT'
      && fullResult.replayed === false
      && fullBefore.entries.length === 1
      && sameWorkspaceRegistryEvidence(fullBefore, fullAfter)
      && fullBytesBefore === fullBytesAfter
      && terminalFailedReadbackMatches(fullOwners.store, fullResult)
      && actionReceiptFileCount(fullOwners.store) === fullReceiptCountBefore + 1
      && excludesRawValues(
        boundedResultBytes(fullResult),
        rawFixtureValues(root, fullDescription, fullOrigin),
      );
    checks.push({
      name: 'full_registry_returns_limit_without_registry_change',
      pass: fullPass,
      ...(fullPass ? {} : { detail: isWorkspaceCreateFailure(fullResult) ? fullResult.code : 'unexpected_success' }),
    });

    const concurrentOwners = createIsolatedOwners('concurrent_create');
    const concurrentDescription = 'concurrent-description-marker-2db7c5';
    const concurrentOrigin = 'concurrent-origin-marker-1f843a';
    const concurrentUnrelated = concurrentOwners.registry.create(
      workspaceFixture(
        'workspace_concurrent_unrelated',
        'Concurrent Unrelated',
        'Concurrent unrelated workspace',
      ),
      'concurrent:unrelated',
    );
    const concurrentBefore = captureWorkspaceRegistryEvidence(concurrentOwners.registry);
    const concurrentReceiptCountBefore = actionReceiptFileCount(concurrentOwners.store);
    const concurrentInput = {
      requestedWorkspace: workspaceFixture(
        'workspace_concurrent_requested',
        'Concurrent Requested',
        concurrentDescription,
      ),
      origin: concurrentOrigin,
      identity: {
        kind: 'studio',
        clientId: 'client_workspace_create_concurrent',
        version: '1.0.0',
      },
    };
    now += 1_000;
    const concurrentResults = await Promise.all([
      executeWorkspaceCreateReceipt(concurrentOwners, {
        ...concurrentInput,
        operationId: 'workspace.create.concurrent-a',
      }),
      executeWorkspaceCreateReceipt(concurrentOwners, {
        ...concurrentInput,
        operationId: 'workspace.create.concurrent-b',
      }),
    ]);
    const concurrentAfter = captureWorkspaceRegistryEvidence(concurrentOwners.registry);
    const concurrentSuccesses = concurrentResults.filter(isWorkspaceCreateSuccess);
    const concurrentFailures = concurrentResults.filter(isWorkspaceCreateFailure);
    const concurrentSuccess = concurrentSuccesses[0];
    const concurrentFailure = concurrentFailures[0];
    const concurrentCreatedEntries = concurrentAfter.entries.filter(
      entry => !concurrentBefore.entries.some(before => before.workspaceId === entry.workspaceId),
    );
    const concurrentRawValues = rawFixtureValues(root, concurrentDescription, concurrentOrigin);
    const concurrentPass = concurrentSuccesses.length === 1
      && concurrentFailures.length === 1
      && concurrentSuccess !== undefined
      && concurrentFailure !== undefined
      && !concurrentSuccess.replayed
      && concurrentSuccess.receipt.status === 'committed'
      && concurrentFailure.code === 'WORKSPACE_CREATE_REGISTRY_CONFLICT'
      && !concurrentFailure.replayed
      && terminalFailedReadbackMatches(concurrentOwners.store, concurrentFailure)
      && concurrentBefore.entries.length === 2
      && concurrentBefore.entries.some(entry => entry.workspaceId === concurrentUnrelated.workspaceId)
      && preservesWorkspaceRegistryEvidence(concurrentBefore, concurrentAfter)
      && concurrentAfter.entries.length === concurrentBefore.entries.length + 1
      && concurrentCreatedEntries.length === 1
      && concurrentCreatedEntries[0].workspaceId === concurrentSuccess.record.workspaceId
      && actionReceiptFileCount(concurrentOwners.store) === concurrentReceiptCountBefore + 2
      && concurrentResults.every(resultValue => excludesRawValues(
        boundedResultBytes(resultValue),
        concurrentRawValues,
      ));
    const concurrentDetail = concurrentResults
      .map(resultValue => isWorkspaceCreateFailure(resultValue) ? resultValue.code : resultValue.receipt.status)
      .join(',');
    checks.push({
      name: 'global_serialization_allows_one_create_and_refuses_stale_concurrent_prestate',
      pass: concurrentPass,
      ...(concurrentPass ? {} : { detail: concurrentDetail }),
    });

    const finalizationOwners = createIsolatedOwners('finalization_rollback');
    const finalizationDescription = 'finalization-description-marker-6c21b8';
    const finalizationOrigin = 'finalization-origin-marker-3f8a4d';
    const finalizationRequestedWorkspace = workspaceFixture(
      'workspace_finalization_requested',
      'Finalization Requested',
      finalizationDescription,
    );
    const finalizationUnrelated = finalizationOwners.registry.create(
      workspaceFixture(
        'workspace_finalization_unrelated',
        'Finalization Unrelated',
        'Finalization unrelated workspace',
      ),
      'finalization:unrelated',
    );
    const finalizationBefore = captureWorkspaceRegistryEvidence(finalizationOwners.registry);
    const finalizationBytesBefore = captureDirectoryBytes(finalizationOwners.registry.root);
    const finalizationReceiptCountBefore = actionReceiptFileCount(finalizationOwners.store);
    const realFinalizationCreate = finalizationOwners.registry.create.bind(finalizationOwners.registry);
    const realFinalizationCompensate = finalizationOwners.registry.compensateCreate.bind(finalizationOwners.registry);
    let finalizationCreateCalls = 0;
    let finalizationCompensateCalls = 0;
    let finalizationCreatedRecord: ReturnType<WorkspaceRegistry['create']> | undefined;
    let finalizationCreatedSnapshotHash: string | undefined;
    let finalizationCompensationArgs: {
      workspaceId: string;
      head: string;
      snapshotHash: string;
    } | undefined;
    finalizationOwners.registry.create = ((workspace, origin) => {
      finalizationCreateCalls += 1;
      const created = realFinalizationCreate(workspace, origin);
      finalizationCreatedRecord = created;
      finalizationCreatedSnapshotHash = finalizationOwners.registry.snapshotHash(created);
      return created;
    }) as WorkspaceRegistry['create'];
    finalizationOwners.registry.compensateCreate = ((workspaceId, head, snapshotHash) => {
      finalizationCompensateCalls += 1;
      finalizationCompensationArgs = { workspaceId, head, snapshotHash };
      return realFinalizationCompensate(workspaceId, head, snapshotHash);
    }) as WorkspaceRegistry['compensateCreate'];
    const realFinalizationTransition = finalizationOwners.store.transition.bind(finalizationOwners.store);
    let finalizationCommitFaults = 0;
    let finalizationRolledBackTransitions = 0;
    const finalizationFaultStore = wrapActionReceiptStore(finalizationOwners.store, {
      transition: (receiptId, transitionInput) => {
        if (transitionInput.to === 'committed' && finalizationCommitFaults === 0) {
          finalizationCommitFaults += 1;
          throw new Error('injected committed transition failure');
        }
        if (transitionInput.to === 'rolled_back') finalizationRolledBackTransitions += 1;
        return realFinalizationTransition(receiptId, transitionInput);
      },
    });
    now += 1_000;
    const finalizationResult = await executeWorkspaceCreateReceipt({
      registry: finalizationOwners.registry,
      receiptService: finalizationOwners.receiptService,
      store: finalizationFaultStore,
    }, {
      requestedWorkspace: finalizationRequestedWorkspace,
      origin: finalizationOrigin,
      operationId: 'workspace.create.finalization-rollback',
      identity: {
        kind: 'studio',
        clientId: 'client_workspace_create_finalization',
        version: '1.0.0',
      },
    });
    const finalizationAfter = captureWorkspaceRegistryEvidence(finalizationOwners.registry);
    const finalizationBytesAfter = captureDirectoryBytes(finalizationOwners.registry.root);
    let finalizationReceiptPass = false;
    if (finalizationResult.ok === false && finalizationResult.receipt !== undefined) {
      const stored = canonicalReceiptBytes(finalizationOwners.store, finalizationResult.receipt.id);
      finalizationReceiptPass = stored.canonical
        && stored.receipt.status === 'rolled_back'
        && stored.receipt.id === finalizationResult.receipt.id
        && stored.receipt.hash === finalizationResult.receipt.hash
        && stored.receipt.rollback.status === 'performed'
        && stored.receipt.failure?.code === 'ACTION_RECEIPT_FINALIZATION_FAILED'
        && stored.receipt.after === undefined
        && excludesRawValues(
          stored.bytes,
          rawFixtureValues(root, finalizationDescription, finalizationOrigin),
        );
    }
    const finalizationCreatedAbsent = finalizationCreatedRecord !== undefined
      && finalizationOwners.registry.lookup(finalizationCreatedRecord.workspaceId).ok === false;
    const finalizationExactCompensation = finalizationCreatedRecord !== undefined
      && finalizationCreatedSnapshotHash !== undefined
      && finalizationCompensationArgs !== undefined
      && finalizationCompensationArgs.workspaceId === finalizationCreatedRecord.workspaceId
      && finalizationCompensationArgs.head === finalizationCreatedRecord.head
      && finalizationCompensationArgs.snapshotHash === finalizationCreatedSnapshotHash;
    const finalizationPass = finalizationResult.ok === false
      && finalizationResult.code === 'ACTION_RECEIPT_FINALIZATION_FAILED'
      && finalizationResult.receipt?.status === 'rolled_back'
      && finalizationCreateCalls === 1
      && finalizationCompensateCalls === 1
      && finalizationCommitFaults === 1
      && finalizationRolledBackTransitions === 1
      && finalizationExactCompensation
      && finalizationCreatedAbsent
      && finalizationBefore.entries.length === 2
      && finalizationBefore.entries.some(entry => entry.workspaceId === finalizationUnrelated.workspaceId)
      && sameWorkspaceRegistryEvidence(finalizationBefore, finalizationAfter)
      && finalizationBytesBefore === finalizationBytesAfter
      && finalizationReceiptPass
      && actionReceiptFileCount(finalizationOwners.store) === finalizationReceiptCountBefore + 1
      && excludesRawValues(
        boundedResultBytes(finalizationResult),
        rawFixtureValues(root, finalizationDescription, finalizationOrigin),
      );
    checks.push({
      name: 'committed_transition_failure_compensates_exact_create_and_rolls_back_receipt',
      pass: finalizationPass,
      ...(finalizationPass ? {} : {
        detail: isWorkspaceCreateFailure(finalizationResult)
          ? `${finalizationResult.code}:${finalizationResult.receipt?.status ?? 'none'}`
          : 'unexpected_success',
      }),
    });

    const compensationOwners = createIsolatedOwners('compensation_failure');
    const compensationDescription = 'compensation-description-marker-4e8d62';
    const compensationOrigin = 'compensation-origin-marker-7b13ac';
    const compensationRequestedWorkspace = workspaceFixture(
      'workspace_compensation_requested',
      'Compensation Requested',
      compensationDescription,
    );
    const compensationUnrelated = compensationOwners.registry.create(
      workspaceFixture(
        'workspace_compensation_unrelated',
        'Compensation Unrelated',
        'Compensation unrelated workspace',
      ),
      'compensation:unrelated',
    );
    const compensationBefore = captureWorkspaceRegistryEvidence(compensationOwners.registry);
    const compensationBytesBefore = captureDirectoryBytes(compensationOwners.registry.root);
    const compensationReceiptCountBefore = actionReceiptFileCount(compensationOwners.store);
    const createDescriptor = Object.getOwnPropertyDescriptor(compensationOwners.registry, 'create');
    const compensateDescriptor = Object.getOwnPropertyDescriptor(compensationOwners.registry, 'compensateCreate');
    const realCompensationCreate = compensationOwners.registry.create.bind(compensationOwners.registry);
    const realCompensationCompensate = compensationOwners.registry.compensateCreate.bind(compensationOwners.registry);
    let compensationCreateCalls = 0;
    let compensationCalls = 0;
    let compensationCreatedRecord: ReturnType<WorkspaceRegistry['create']> | undefined;
    let compensationCreatedSnapshotHash: string | undefined;
    let compensationRefusal: ReturnType<WorkspaceRegistry['compensateCreate']> | undefined;
    const realCompensationTransition = compensationOwners.store.transition.bind(compensationOwners.store);
    let compensationCommitFaults = 0;
    let compensationIncompleteTransitions = 0;
    const compensationFaultStore = wrapActionReceiptStore(compensationOwners.store, {
      transition: (receiptId, transitionInput) => {
        if (transitionInput.to === 'committed' && compensationCommitFaults === 0) {
          compensationCommitFaults += 1;
          throw new Error('injected committed transition failure');
        }
        if (transitionInput.to === 'incomplete') compensationIncompleteTransitions += 1;
        return realCompensationTransition(receiptId, transitionInput);
      },
    });
    let compensationResult: WorkspaceCreateReceiptAdapterResult | undefined;
    try {
      compensationOwners.registry.create = ((workspace, origin) => {
        compensationCreateCalls += 1;
        const created = realCompensationCreate(workspace, origin);
        compensationCreatedRecord = created;
        compensationCreatedSnapshotHash = compensationOwners.registry.snapshotHash(created);
        return created;
      }) as WorkspaceRegistry['create'];
      compensationOwners.registry.compensateCreate = ((workspaceId, head, snapshotHash) => {
        compensationCalls += 1;
        const staleHead = head === '0000000000000000' ? '1111111111111111' : '0000000000000000';
        compensationRefusal = realCompensationCompensate(workspaceId, staleHead, snapshotHash);
        return compensationRefusal;
      }) as WorkspaceRegistry['compensateCreate'];
      now += 1_000;
      compensationResult = await executeWorkspaceCreateReceipt({
        registry: compensationOwners.registry,
        receiptService: compensationOwners.receiptService,
        store: compensationFaultStore,
      }, {
        requestedWorkspace: compensationRequestedWorkspace,
        origin: compensationOrigin,
        operationId: 'workspace.create.compensation-failure',
        identity: {
          kind: 'studio',
          clientId: 'client_workspace_create_compensation',
          version: '1.0.0',
        },
      });
    } finally {
      if (createDescriptor === undefined) Reflect.deleteProperty(compensationOwners.registry, 'create');
      else Object.defineProperty(compensationOwners.registry, 'create', createDescriptor);
      if (compensateDescriptor === undefined) Reflect.deleteProperty(compensationOwners.registry, 'compensateCreate');
      else Object.defineProperty(compensationOwners.registry, 'compensateCreate', compensateDescriptor);
    }
    if (compensationResult === undefined) throw new Error('compensation fixture result unavailable');

    const compensationAfter = captureWorkspaceRegistryEvidence(compensationOwners.registry);
    const compensationBytesAfter = captureDirectoryBytes(compensationOwners.registry.root);
    const compensationCurrentFacts = prepareWorkspaceCreateReceiptFacts(
      compensationOwners.registry,
      compensationRequestedWorkspace,
    );
    let compensationReceiptPass = false;
    if (compensationResult.ok === false && compensationResult.receipt !== undefined) {
      const stored = canonicalReceiptBytes(compensationOwners.store, compensationResult.receipt.id);
      const afterResource = stored.receipt.after?.resources[0];
      compensationReceiptPass = stored.canonical
        && stored.receipt.status === 'incomplete'
        && stored.receipt.id === compensationResult.receipt.id
        && stored.receipt.hash === compensationResult.receipt.hash
        && stored.receipt.status === compensationResult.receipt.status
        && stored.receipt.rollback.status === 'failed'
        && stored.receipt.failure?.code === 'ACTION_RECEIPT_ROLLBACK_FAILED'
        && stored.receipt.after?.outcome === 'partial'
        && stored.receipt.after.code === 'workspace_create_compensation_failed'
        && stored.receipt.after.resources.length === 1
        && compensationCurrentFacts.ok
        && afterResource?.hash === compensationCurrentFacts.resource.beforeHash
        && excludesRawValues(
          stored.bytes,
          rawFixtureValues(root, compensationDescription, compensationOrigin),
        );
    }
    const compensationCreatedLookup = compensationCreatedRecord === undefined
      ? undefined
      : compensationOwners.registry.lookup(compensationCreatedRecord.workspaceId);
    const compensationCreatedEntries = compensationAfter.entries.filter(
      entry => !compensationBefore.entries.some(before => before.workspaceId === entry.workspaceId),
    );
    const compensationRefusedTruthfully = compensationRefusal !== undefined
      && compensationRefusal.ok === false
      && compensationRefusal.status === 'refused'
      && compensationRefusal.code === 'WORKSPACE_HEAD_STALE'
      && compensationRefusal.index === 'present'
      && compensationRefusal.record === 'present'
      && compensationRefusal.memory === 'present'
      && compensationRefusal.memoryIndexAgree;
    const compensationPass = compensationResult.ok === false
      && compensationResult.code === 'ACTION_RECEIPT_ROLLBACK_FAILED'
      && compensationResult.receipt?.status === 'incomplete'
      && compensationCreateCalls === 1
      && compensationCalls === 1
      && compensationCommitFaults === 1
      && compensationIncompleteTransitions === 1
      && compensationCreatedRecord !== undefined
      && compensationCreatedSnapshotHash !== undefined
      && compensationCreatedLookup?.ok === true
      && compensationCreatedLookup.record.head === compensationCreatedRecord.head
      && compensationOwners.registry.snapshotHash(compensationCreatedLookup.record) === compensationCreatedSnapshotHash
      && compensationRefusedTruthfully
      && compensationBefore.entries.length === 2
      && compensationBefore.entries.some(entry => entry.workspaceId === compensationUnrelated.workspaceId)
      && preservesWorkspaceRegistryEvidence(compensationBefore, compensationAfter)
      && compensationAfter.entries.length === compensationBefore.entries.length + 1
      && compensationCreatedEntries.length === 1
      && compensationCreatedEntries[0].workspaceId === compensationCreatedRecord.workspaceId
      && compensationBytesAfter !== compensationBytesBefore
      && compensationReceiptPass
      && actionReceiptFileCount(compensationOwners.store) === compensationReceiptCountBefore + 1
      && excludesRawValues(
        boundedResultBytes(compensationResult),
        rawFixtureValues(root, compensationDescription, compensationOrigin),
      );
    checks.push({
      name: 'compensation_refusal_preserves_created_record_and_records_incomplete_receipt',
      pass: compensationPass,
      ...(compensationPass ? {} : {
        detail: isWorkspaceCreateFailure(compensationResult)
          ? `${compensationResult.code}:${compensationResult.receipt?.status ?? 'none'}`
          : 'unexpected_success',
      }),
    });

    const reopenOwners = createIsolatedOwners('authoritative_reopen_failure');
    const reopenDescription = 'reopen-description-marker-9a4c72';
    const reopenOrigin = 'reopen-origin-marker-2e68b1';
    const reopenRequestedWorkspace = workspaceFixture(
      'workspace_reopen_requested',
      'Reopen Requested',
      reopenDescription,
    );
    const reopenUnrelated = reopenOwners.registry.create(
      workspaceFixture(
        'workspace_reopen_unrelated',
        'Reopen Unrelated',
        'Reopen unrelated workspace',
      ),
      'reopen:unrelated',
    );
    const reopenBefore = captureWorkspaceRegistryEvidence(reopenOwners.registry);
    const reopenBytesBefore = captureDirectoryBytes(reopenOwners.registry.root);
    const reopenReceiptCountBefore = actionReceiptFileCount(reopenOwners.store);
    const reopenCreateDescriptor = Object.getOwnPropertyDescriptor(reopenOwners.registry, 'create');
    const reopenCompensateDescriptor = Object.getOwnPropertyDescriptor(reopenOwners.registry, 'compensateCreate');
    const realReopenCreate = reopenOwners.registry.create.bind(reopenOwners.registry);
    const realReopenCompensate = reopenOwners.registry.compensateCreate.bind(reopenOwners.registry);
    const realReopenRead = reopenOwners.store.read.bind(reopenOwners.store);
    const realReopenTransition = reopenOwners.store.transition.bind(reopenOwners.store);
    let reopenCreateCalls = 0;
    let reopenCompensateCalls = 0;
    let reopenCreatedRecord: ReturnType<WorkspaceRegistry['create']> | undefined;
    let reopenCommittedTransitionWritten = false;
    let reopenCommittedTransitions = 0;
    let reopenDelegatedReadsBeforeCommit = 0;
    let reopenReadFaults = 0;
    const reopenFaultStore = wrapActionReceiptStore(reopenOwners.store, {
      read: receiptId => {
        if (reopenCommittedTransitionWritten && reopenReadFaults === 0) {
          reopenReadFaults += 1;
          throw new Error('injected authoritative reopen failure');
        }
        if (!reopenCommittedTransitionWritten) reopenDelegatedReadsBeforeCommit += 1;
        return realReopenRead(receiptId);
      },
      transition: (receiptId, transitionInput) => {
        const transitioned = realReopenTransition(receiptId, transitionInput);
        if (transitionInput.to === 'committed') {
          reopenCommittedTransitions += 1;
          reopenCommittedTransitionWritten = true;
        }
        return transitioned;
      },
    });
    let reopenResult: WorkspaceCreateReceiptAdapterResult | undefined;
    try {
      reopenOwners.registry.create = ((workspace, origin) => {
        reopenCreateCalls += 1;
        const created = realReopenCreate(workspace, origin);
        reopenCreatedRecord = created;
        return created;
      }) as WorkspaceRegistry['create'];
      reopenOwners.registry.compensateCreate = ((workspaceId, head, snapshotHash) => {
        reopenCompensateCalls += 1;
        return realReopenCompensate(workspaceId, head, snapshotHash);
      }) as WorkspaceRegistry['compensateCreate'];
      now += 1_000;
      reopenResult = await executeWorkspaceCreateReceipt({
        registry: reopenOwners.registry,
        receiptService: reopenOwners.receiptService,
        store: reopenFaultStore,
      }, {
        requestedWorkspace: reopenRequestedWorkspace,
        origin: reopenOrigin,
        operationId: 'workspace.create.authoritative-reopen-failure',
        identity: {
          kind: 'studio',
          clientId: 'client_workspace_create_reopen_failure',
          version: '1.0.0',
        },
      });
    } finally {
      if (reopenCreateDescriptor === undefined) Reflect.deleteProperty(reopenOwners.registry, 'create');
      else Object.defineProperty(reopenOwners.registry, 'create', reopenCreateDescriptor);
      if (reopenCompensateDescriptor === undefined) Reflect.deleteProperty(reopenOwners.registry, 'compensateCreate');
      else Object.defineProperty(reopenOwners.registry, 'compensateCreate', reopenCompensateDescriptor);
    }
    if (reopenResult === undefined) throw new Error('authoritative reopen fixture result unavailable');

    const reopenAfter = captureWorkspaceRegistryEvidence(reopenOwners.registry);
    const reopenBytesAfter = captureDirectoryBytes(reopenOwners.registry.root);
    const reopenCreatedEntries = reopenAfter.entries.filter(
      entry => !reopenBefore.entries.some(before => before.workspaceId === entry.workspaceId),
    );
    let reopenReceiptPass = false;
    if (reopenResult.ok === false && reopenResult.receipt !== undefined) {
      const stored = canonicalReceiptBytes(reopenOwners.store, reopenResult.receipt.id);
      reopenReceiptPass = stored.canonical
        && stored.receipt.status === 'committed'
        && stored.receipt.id === reopenResult.receipt.id
        && stored.receipt.hash === reopenResult.receipt.hash
        && stored.receipt.status === reopenResult.receipt.status
        && stored.receipt.after?.outcome === 'applied'
        && reopenCreatedRecord !== undefined
        && stored.receipt.after.code === `workspace_created_${reopenCreatedRecord.workspaceId}`
        && /^workspace_created_(ws_[a-f0-9]{24})$/i.test(stored.receipt.after.code)
        && excludesRawValues(
          stored.bytes,
          rawFixtureValues(root, reopenDescription, reopenOrigin),
        );
    }
    const reopenCreatedLookup = reopenCreatedRecord === undefined
      ? undefined
      : reopenOwners.registry.lookup(reopenCreatedRecord.workspaceId);
    const reopenPass = reopenResult.ok === false
      && reopenResult.code === 'WORKSPACE_CREATE_RECEIPT_REOPEN_FAILED'
      && reopenResult.receipt?.status === 'committed'
      && !reopenResult.replayed
      && reopenCreateCalls === 1
      && reopenCompensateCalls === 0
      && reopenCommittedTransitions === 1
      && reopenCommittedTransitionWritten
      && reopenDelegatedReadsBeforeCommit > 0
      && reopenReadFaults === 1
      && reopenCreatedRecord !== undefined
      && reopenCreatedLookup?.ok === true
      && reopenCreatedLookup.record.workspaceId === reopenCreatedRecord.workspaceId
      && reopenBefore.entries.length === 2
      && reopenBefore.entries.some(entry => entry.workspaceId === reopenUnrelated.workspaceId)
      && preservesWorkspaceRegistryEvidence(reopenBefore, reopenAfter)
      && reopenAfter.entries.length === reopenBefore.entries.length + 1
      && reopenCreatedEntries.length === 1
      && reopenCreatedEntries[0].workspaceId === reopenCreatedRecord.workspaceId
      && reopenBytesAfter !== reopenBytesBefore
      && reopenReceiptPass
      && actionReceiptFileCount(reopenOwners.store) === reopenReceiptCountBefore + 1
      && excludesRawValues(
        boundedResultBytes(reopenResult),
        rawFixtureValues(root, reopenDescription, reopenOrigin),
      );
    checks.push({
      name: 'authoritative_reopen_failure_returns_committed_projection_without_false_success',
      pass: reopenPass,
      ...(reopenPass ? {} : {
        detail: isWorkspaceCreateFailure(reopenResult)
          ? `${reopenResult.code}:${reopenResult.receipt?.status ?? 'none'}`
          : 'unexpected_success',
      }),
    });

  } catch (error) {
    checks.push({
      name: 'real_owner_studio_create_commits_one_record',
      pass: false,
      detail: 'unexpected selftest failure',
    });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }

  return summarize(checks);
}

const invokedDirectly = path.basename(process.argv[1] ?? '') === 'workspaceCreateReceiptAdapter.selftest.ts';
if (invokedDirectly) {
  void runWorkspaceCreateReceiptAdapterSelftest()
    .then(result => {
      for (const check of result.checks) {
        console.log(`${check.pass ? 'PASS' : 'FAIL'} ${check.name}${check.detail === undefined ? '' : `: ${check.detail}`}`);
      }
      console.log(`${result.passed}/${result.total} checks passed`);
      if (!result.allPassed) process.exitCode = 1;
    })
    .catch(() => {
      console.error('workspace create receipt adapter selftest failed unexpectedly');
      process.exitCode = 1;
    });
}
