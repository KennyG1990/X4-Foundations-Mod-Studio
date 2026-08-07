import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  assertValidActionReceipt,
  canonicalJson,
  serializeActionReceipt,
  type ActionReceipt,
  type ActionReceiptTransitionInput,
  type ActionReceiptPrepareInput,
} from '../lib/actionReceipt';
import { combineReceiptResourceBeforeHashes } from '../lib/actionReceiptRuntime';
import { ActionReceiptStore } from '../lib/actionReceiptStore';
import { DestructiveRecoveryStore } from '../lib/destructiveRecovery';
import {
  createBulkTransformPlan,
  mergeBulkTransformPatches,
  type BulkTransformPlan,
  type BulkTransformRule,
} from '../lib/bulkCorpusTransform';
import type { EffectiveReferenceDocument } from '../lib/referenceOverlay';
import { workspaceReceiptResources } from '../lib/workspaceActionReceipt';
import { workspaceContentHash, workspaceSnapshotHash } from '../lib/workspaceIdentity';
import { WorkspaceRegistry, type WorkspaceRecord } from '../lib/workspaceRegistry';
import { sanitizeWorkspace, type ModWorkspace, type PatchBlock } from '../types';
import {
  executeBulkTransformApplyReceipt,
  BULK_TRANSFORM_APPLY_MODE,
  BULK_TRANSFORM_APPLY_ROUTE_KEY,
  type BulkTransformApplyReceiptAdapterDependencies,
  type BulkTransformApplyReceiptAdapterInput,
  type BulkTransformApplyReceiptAdapterResult,
  type BulkTransformApplyReceiptAdapterStore,
} from './bulkTransformApplyReceiptAdapter';
import {
  prepareBulkTransformApplyReceiptFacts,
} from './bulkTransformApplyReceiptFacts';
import { WorkspaceReceiptService } from './workspaceReceiptService';

const RAW_CORPUS_GENERATION = 'raw-bulk-apply-corpus-marker-b1';
const RAW_TARGET_ROOT = 'assets/raw-bulk-apply-target-marker-b1';
const RAW_SELECTOR = '/macros/macro/properties/hull/@raw_bulk_apply_selector_marker_b1';
const RAW_SOURCE_A = 'raw-bulk-apply-source-marker-b1-a';
const RAW_SOURCE_B = 'raw-bulk-apply-source-marker-b1-b';
const RAW_RULE_ID = 'raw-bulk-apply-rule-marker-b1';
const RAW_XML = 'raw-bulk-apply-xml-marker-b1';
const RAW_WORKSPACE = 'raw-bulk-apply-workspace-marker-b1';
const RAW_TOKEN = 'x4fk_raw_bulk_apply_selftest_token_b1';
const RAW_BEARER = 'Bearer raw-bulk-apply-selftest-token-b1';
const RAW_NATIVE_ERROR_MARKER = 'raw-bulk-apply-native-error-marker-b1';
const RAW_HOST_PATH = 'C:\\raw\\bulk-apply-selftest-marker-b1.xml';
const FIXED_NOW = Date.parse('2026-08-06T12:00:00.000Z');
const HASH64_RE = /^[a-f0-9]{64}$/;

const BASE_RULE: BulkTransformRule = {
  pathPrefix: RAW_TARGET_ROOT,
  selector: RAW_SELECTOR,
  operation: 'add',
  operand: 3,
  rounding: 'none',
  roundingIncrement: 1,
  maxFiles: 2,
  operations: [{
    id: RAW_RULE_ID,
    selector: RAW_SELECTOR,
    operation: 'add',
    operand: 3,
    rounding: 'none',
    roundingIncrement: 1,
  }],
};

const BASE_DOCUMENTS: EffectiveReferenceDocument[] = [
  {
    available: true,
    root: 'selftest-fixture',
    relativePath: `${RAW_TARGET_ROOT}/a.xml`,
    content: `<macros><macro name="${RAW_XML}"><properties><hull raw_bulk_apply_selector_marker_b1="10"/></properties></macro></macros>`,
    sources: [{ source: 'base', path: `${RAW_TARGET_ROOT}/a.xml`, mode: 'base' }],
    findings: [],
    signature: RAW_SOURCE_A,
  },
  {
    available: true,
    root: 'selftest-fixture',
    relativePath: `${RAW_TARGET_ROOT}/b.xml`,
    content: `<macros><macro name="${RAW_XML}"><properties><hull raw_bulk_apply_selector_marker_b1="20"/></properties></macro></macros>`,
    sources: [{ source: 'base', path: `${RAW_TARGET_ROOT}/b.xml`, mode: 'base' }],
    findings: [],
    signature: RAW_SOURCE_B,
  },
];

const MANUAL_PATCH: PatchBlock = {
  id: 'manual-bulk-apply-selftest-marker-b1',
  sel: `/manual/${RAW_WORKSPACE}`,
  action: 'replace',
  content: RAW_XML,
  note: RAW_WORKSPACE,
  targetFile: `${RAW_TARGET_ROOT}/manual.xml`,
  includeInBuild: true,
};

const BASE_WORKSPACE: ModWorkspace = sanitizeWorkspace({
  id: 'workspace-bulk-apply-selftest-marker-b1',
  name: 'Bulk Transform Apply Receipt Selftest',
  version: '1.0.0',
  author: 'Forge Selftest',
  description: 'deterministic raw bulk apply fixture',
  nodes: [],
  links: [],
  uiWidgets: [],
  uiTheme: {
    backgroundColor: '#101820',
    borderColor: '#203040',
    accentColor: '#405060',
    opacity: 1,
    showIcons: true,
  },
  mdOriginal: { path: RAW_HOST_PATH, content: RAW_XML },
  contentOriginal: RAW_XML,
  xmlPatches: [MANUAL_PATCH],
});

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function fixturePlan(
  rule: BulkTransformRule,
  corpusGeneration = RAW_CORPUS_GENERATION,
  documents: EffectiveReferenceDocument[] = BASE_DOCUMENTS,
): BulkTransformPlan {
  const byPath = new Map(documents.map(document => [document.relativePath, document]));
  return createBulkTransformPlan({
    rule,
    logicalPaths: documents.map(document => document.relativePath),
    corpusGeneration,
    resolve: logicalPath => {
      const document = byPath.get(logicalPath);
      if (document === undefined) throw new Error('fixture document missing');
      return document;
    },
  });
}

const BASE_PLAN = fixturePlan(BASE_RULE);

interface Owners {
  registry: WorkspaceRegistry;
  store: ActionReceiptStore;
  recoveryStore: DestructiveRecoveryStore;
  receiptService: WorkspaceReceiptService;
}

interface SelftestCheck {
  name: string;
  pass: boolean;
  detail?: string;
}

export interface BulkTransformApplyReceiptAdapterSelftestResult {
  allPassed: boolean;
  pass: boolean;
  passed: number;
  total: number;
  failures: string[];
  checks: SelftestCheck[];
}

function makeRandomHex(scope: string): (bytes: number) => string {
  let sequence = 0;
  return bytes => {
    let output = '';
    while (output.length < bytes * 2) {
      output += crypto.createHash('sha256')
        .update(`bulk-apply-selftest:${scope}:${sequence++}`, 'utf8')
        .digest('hex');
    }
    return output.slice(0, bytes * 2);
  };
}

function makeOwners(root: string, scope: string, workspace = BASE_WORKSPACE): Owners {
  const scopedRoot = path.join(root, scope);
  const now = () => FIXED_NOW;
  return {
    registry: new WorkspaceRegistry({
      root: path.join(scopedRoot, 'workspace-registry'),
      defaultWorkspace: cloneJson(workspace),
      now,
      randomHex: makeRandomHex(scope),
    }),
    store: new ActionReceiptStore({ root: path.join(scopedRoot, 'action-receipts'), now }),
    recoveryStore: new DestructiveRecoveryStore({ root: path.join(scopedRoot, 'recovery'), now }),
    receiptService: new WorkspaceReceiptService(),
  };
}

function makeInput(
  owners: Owners,
  operationId: unknown,
  overrides: Partial<BulkTransformApplyReceiptAdapterInput> = {},
): BulkTransformApplyReceiptAdapterInput {
  const found = owners.registry.lookup(owners.registry.defaultWorkspaceId);
  if (!found.ok) throw new Error('workspace fixture unavailable');
  const snapshotHash = owners.registry.snapshotHash(found.record);
  return {
    operationId,
    workspaceId: found.record.workspaceId,
    identity: {
      kind: 'agent',
      keyId: 'key_bulk_apply_selftest',
      clientId: 'client_bulk_apply_selftest',
      version: '1.0.0',
    },
    rule: cloneJson(BASE_RULE),
    expectedPlanHash: BASE_PLAN.planHash,
    expectedHead: found.record.head,
    expectedSnapshotHash: snapshotHash,
    buildPlan: (_rule, _workspace) => cloneJson(BASE_PLAN),
    ...overrides,
  };
}

function captureRegistry(registry: WorkspaceRegistry): string {
  return JSON.stringify({
    defaultWorkspaceId: registry.defaultWorkspaceId,
    list: registry.list(),
    records: registry.list().map(summary => {
      const found = registry.lookup(summary.workspaceId);
      return found.ok ? found.record : found;
    }),
  });
}

function receiptFileCount(store: ActionReceiptStore): number {
  if (!fs.existsSync(store.root)) return 0;
  return fs.readdirSync(store.root, { withFileTypes: true })
    .filter(entry => entry.isFile() && /^ar_[a-f0-9]{64}\.json$/.test(entry.name))
    .length;
}

function directoryDigest(directory: string): string {
  if (!fs.existsSync(directory)) return '[]';
  const rows: Array<{ relative: string; bytes: string }> = [];
  const visit = (current: string): void => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile()) {
        rows.push({
          relative: path.relative(directory, absolute).replace(/\\/g, '/'),
          bytes: fs.readFileSync(absolute).toString('base64'),
        });
      }
    }
  };
  visit(directory);
  rows.sort((left, right) => left.relative.localeCompare(right.relative));
  return JSON.stringify(rows);
}

function recoveryEntryCount(store: DestructiveRecoveryStore): number {
  if (!fs.existsSync(store.root)) return 0;
  return fs.readdirSync(store.root, { withFileTypes: true })
    .filter(entry => entry.isDirectory()).length;
}

function receiptReadback(store: ActionReceiptStore, id: string): ActionReceipt | undefined {
  try {
    const receipt = assertValidActionReceipt(store.read(id));
    return fs.readFileSync(store.pathFor(id), 'utf8') === serializeActionReceipt(receipt)
      ? receipt
      : undefined;
  } catch {
    return undefined;
  }
}

function soleCanonicalReceipt(
  store: ActionReceiptStore,
): { id: string; receipt: ActionReceipt } | undefined {
  if (!fs.existsSync(store.root)) return undefined;
  const ids = fs.readdirSync(store.root, { withFileTypes: true })
    .filter(entry => entry.isFile() && /^ar_[a-f0-9]{64}\.json$/.test(entry.name))
    .map(entry => entry.name.slice(0, -'.json'.length));
  if (ids.length !== 1) return undefined;
  const id = ids[0]!;
  const receipt = receiptReadback(store, id);
  return receipt === undefined ? undefined : { id, receipt };
}

function workspaceState(owners: Owners): WorkspaceRecord {
  const found = owners.registry.lookup(owners.registry.defaultWorkspaceId);
  if (!found.ok) throw new Error('workspace state unavailable');
  return found.record;
}

function workspaceSnapshot(owners: Owners): string {
  return owners.registry.snapshotHash(workspaceState(owners));
}

function sameWorkspaceState(left: WorkspaceRecord, right: WorkspaceRecord): boolean {
  return left.workspaceId === right.workspaceId
    && left.head === right.head
    && left.version === right.version
    && JSON.stringify(left.workspace) === JSON.stringify(right.workspace)
    && workspaceSnapshotHash(left.workspace) === workspaceSnapshotHash(right.workspace);
}

function samePairedWorkspaceState(left: WorkspaceRecord, right: WorkspaceRecord): boolean {
  return left.workspaceId === right.workspaceId
    && left.head === right.head
    && JSON.stringify(left.workspace) === JSON.stringify(right.workspace)
    && workspaceSnapshotHash(left.workspace) === workspaceSnapshotHash(right.workspace);
}

function differentLegacyHash(value: string): string {
  return value[0] === '0' ? `1${value.slice(1)}` : `0${value.slice(1)}`;
}

function pathMarkers(root: string): string[] {
  const forward = root.replace(/\\/g, '/');
  const back = root.replace(/\//g, '\\');
  return [forward, back, JSON.stringify(back).slice(1, -1)];
}

function redacted(value: unknown, markers: readonly string[]): boolean {
  let serialized: string;
  try {
    serialized = typeof value === 'string' ? value : JSON.stringify(value);
  } catch {
    return false;
  }
  if (serialized === undefined) return false;
  return markers.every(marker => marker.length === 0 || !serialized.includes(marker))
    && !/[A-Za-z]:[\\/]/.test(serialized)
    && !/\\\\/.test(serialized)
    && !/(?:bearer\s+|x4fk_|sk-|pk-|rk-|ghp_|github_pat_|AIza)/i.test(serialized);
}

function rawMarkers(root: string): string[] {
  return [
    ...pathMarkers(root),
    RAW_CORPUS_GENERATION,
    RAW_TARGET_ROOT,
    RAW_SELECTOR,
    RAW_SOURCE_A,
    RAW_SOURCE_B,
    RAW_RULE_ID,
    RAW_XML,
    RAW_WORKSPACE,
    RAW_NATIVE_ERROR_MARKER,
    RAW_TOKEN,
    RAW_BEARER,
    RAW_HOST_PATH,
    JSON.stringify(BASE_RULE),
  ];
}

function allStoredReceiptBytesRedacted(store: ActionReceiptStore, markers: readonly string[]): boolean {
  if (!fs.existsSync(store.root)) return true;
  return fs.readdirSync(store.root, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.json'))
    .every(entry => redacted(fs.readFileSync(path.join(store.root, entry.name), 'utf8'), markers));
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function safePlanBuilder(
  plan: BulkTransformPlan = BASE_PLAN,
): BulkTransformApplyReceiptAdapterInput['buildPlan'] {
  return (_rule, _workspace) => cloneJson(plan);
}

function prepareFactsForOwner(
  owners: Owners,
  input: BulkTransformApplyReceiptAdapterInput,
): Extract<ReturnType<typeof prepareBulkTransformApplyReceiptFacts>, { ok: true }> | undefined {
  const current = workspaceState(owners);
  const prepared = prepareBulkTransformApplyReceiptFacts({
    operationId: input.operationId,
    workspaceId: input.workspaceId,
    identity: input.identity,
    rule: input.rule,
    expectedPlanHash: input.expectedPlanHash,
    expectedHead: current.head,
    expectedSnapshotHash: input.expectedSnapshotHash,
    currentRecord: current,
    currentSnapshotHash: workspaceSnapshot(owners),
    buildPlan: input.buildPlan,
  });
  return prepared.ok ? prepared : undefined;
}

function dependencies(
  owners: Owners,
  projections: unknown[] = [],
  store: BulkTransformApplyReceiptAdapterStore = owners.store,
  recoveryStore: DestructiveRecoveryStore = owners.recoveryStore,
): BulkTransformApplyReceiptAdapterDependencies {
  return {
    registry: owners.registry,
    store,
    recoveryStore,
    receiptService: owners.receiptService,
    captureProjection: projection => {
      projections.push(projection === undefined ? undefined : cloneJson(projection));
    },
  };
}

function wrapStore(
  store: ActionReceiptStore,
  hooks: {
    read?: (id: string, delegate: (id: string) => ActionReceipt) => ActionReceipt;
    prepare?: (input: ActionReceiptPrepareInput, delegate: (input: ActionReceiptPrepareInput) => { receipt: ActionReceipt; created: boolean }) => { receipt: ActionReceipt; created: boolean };
    transition?: (id: string, input: ActionReceiptTransitionInput, delegate: (id: string, input: ActionReceiptTransitionInput) => ActionReceipt) => ActionReceipt;
  } = {},
): BulkTransformApplyReceiptAdapterStore {
  return {
    root: store.root,
    read: id => hooks.read === undefined ? store.read(id) : hooks.read(id, value => store.read(value)),
    prepareWithDisposition: input => hooks.prepare === undefined
      ? store.prepareWithDisposition(input)
      : hooks.prepare(input, value => store.prepareWithDisposition(value)),
    transition: (id, input) => hooks.transition === undefined
      ? store.transition(id, input)
      : hooks.transition(id, input, (value, transition) => store.transition(value, transition)),
  } as BulkTransformApplyReceiptAdapterStore;
}

function wrapRecoveryStore(
  store: DestructiveRecoveryStore,
  hooks: {
    createWorkspace?: (
      input: Parameters<DestructiveRecoveryStore['createWorkspace']>[0],
      delegate: (input: Parameters<DestructiveRecoveryStore['createWorkspace']>[0]) => ReturnType<DestructiveRecoveryStore['createWorkspace']>,
    ) => ReturnType<DestructiveRecoveryStore['createWorkspace']>;
    abandon?: (id: string, delegate: (id: string) => void) => void;
  } = {},
): DestructiveRecoveryStore {
  return {
    root: store.root,
    read: id => store.read(id),
    createWorkspace: input => hooks.createWorkspace === undefined
      ? store.createWorkspace(input)
      : hooks.createWorkspace(input, value => store.createWorkspace(value)),
    abandon: id => hooks.abandon === undefined
      ? store.abandon(id)
      : hooks.abandon(id, value => store.abandon(value)),
  } as unknown as DestructiveRecoveryStore;
}

type ObservedReceiptStatus = ActionReceipt['status'] | 'absent' | 'unavailable';

function authoritativeReceiptStatus(store: ActionReceiptStore, id: string): ObservedReceiptStatus {
  try {
    return assertValidActionReceipt(store.read(id)).status;
  } catch {
    return fs.existsSync(store.pathFor(id)) ? 'unavailable' : 'absent';
  }
}

function recoveryStoreWithCleanupObservation(
  owners: Owners,
  statuses: ObservedReceiptStatus[],
): DestructiveRecoveryStore {
  return wrapRecoveryStore(owners.recoveryStore, {
    abandon: (id, delegate) => {
      statuses.push(authoritativeReceiptStatus(owners.store, id));
      delegate(id);
    },
  });
}

function patchRegistryLookup(
  registry: WorkspaceRegistry,
  handler: (
    workspaceId: string,
    delegate: WorkspaceRegistry['lookup'],
  ) => ReturnType<WorkspaceRegistry['lookup']>,
): { restore: () => void } {
  const original = registry.lookup;
  const seam = registry as unknown as { lookup: WorkspaceRegistry['lookup'] };
  seam.lookup = workspaceId => handler(workspaceId, original.bind(registry));
  return { restore: () => { seam.lookup = original; } };
}

interface CommitCall {
  origin: string;
  workspaceId: string;
}

function patchRegistryCommit(
  registry: WorkspaceRegistry,
  handler: (workspaceId: string, workspace: ModWorkspace, origin: string, delegate: WorkspaceRegistry['commit']) => WorkspaceRecord,
): { calls: CommitCall[]; restore: () => void } {
  const calls: CommitCall[] = [];
  const original = registry.commit;
  const seam = registry as unknown as { commit: WorkspaceRegistry['commit'] };
  seam.commit = (workspaceId, workspace, origin) => {
    calls.push({ workspaceId, origin });
    return handler(workspaceId, workspace, origin, original.bind(registry));
  };
  return { calls, restore: () => { seam.commit = original; } };
}

function summarize(checks: SelftestCheck[]): BulkTransformApplyReceiptAdapterSelftestResult {
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

async function checkAsync(
  checks: SelftestCheck[],
  name: string,
  assertion: () => Promise<boolean>,
): Promise<void> {
  try {
    checks.push({ name, pass: await assertion() });
  } catch (error) {
    checks.push({ name, pass: false, detail: error instanceof Error ? error.message : String(error) });
  }
}

function resourceHash(
  resources: readonly { role: string; beforeHash?: string }[],
  role: string,
): string | undefined {
  return resources.find(resource => resource.role === role)?.beforeHash;
}

function afterResourceHash(
  receipt: ActionReceipt | undefined,
  role: string,
): string | undefined {
  return receipt?.after?.resources.find(resource => resource.role === role)?.hash;
}

function terminalReceipt(
  result: BulkTransformApplyReceiptAdapterResult,
  store: ActionReceiptStore,
): ActionReceipt | undefined {
  return result.receipt === undefined ? undefined : receiptReadback(store, result.receipt.id);
}

function forwardCommitCount(calls: readonly CommitCall[]): number {
  return calls.filter(call => call.origin === BULK_TRANSFORM_APPLY_MODE).length;
}

export async function runBulkTransformApplyReceiptAdapterSelftest(): Promise<BulkTransformApplyReceiptAdapterSelftestResult> {
  const checks: SelftestCheck[] = [];
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'x4forge-bulk-apply-receipt-adapter-'));
  let cleanupPass = false;

  try {
    await checkAsync(checks, 'changed_first_execution_exact_receipt_recovery_and_projection', async () => {
      const owners = makeOwners(root, 'changed-first');
      const projections: unknown[] = [];
      const input = makeInput(owners, 'bulk-apply.changed.first');
      const facts = prepareFactsForOwner(owners, input);
      if (facts === undefined) return false;
      const before = workspaceState(owners);
      const beforeSnapshotHash = workspaceSnapshot(owners);
      const commit = patchRegistryCommit(owners.registry, (workspaceId, workspace, origin, delegate) => (
        delegate(workspaceId, workspace, origin)
      ));
      try {
        const result = await executeBulkTransformApplyReceipt(
          dependencies(owners, projections),
          input,
        );
        const current = workspaceState(owners);
        const receipt = terminalReceipt(result, owners.store);
        const recovery = result.ok ? owners.recoveryStore.read(result.receipt.id) : undefined;
        const targetWorkspaceHash = resourceHash(facts.targetResources, 'workspace');
        const targetSnapshotHash = resourceHash(facts.targetResources, 'snapshot');
        const expectedEffectResource = facts.beforeResources.find(resource => resource.role === 'workspace');
        const expectedAfter = facts.targetResources.map(resource => ({
          role: resource.role,
          root: resource.root,
          relativePath: resource.relativePath,
          hash: resource.beforeHash,
        }));
        const pass = result.ok
          && result.applied
          && !result.replayed
          && result.receipt.status === 'committed'
          && sameJson(result.plan, BASE_PLAN)
          && result.record.workspaceId === owners.registry.defaultWorkspaceId
          && current.version === before.version + 1
          && result.record.version === current.version
          && forwardCommitCount(commit.calls) === 1
          && commit.calls.length === 1
          && receipt !== undefined
          && receipt.status === 'committed'
          && receipt.id === result.receipt.id
          && receipt.hash === result.receipt.hash
          && receipt.schema === 'forge.action-receipt.v1'
          && receipt.actor.kind === 'agent'
          && receipt.actor.id === 'key_bulk_apply_selftest'
          && receipt.client.channel === 'api'
          && receipt.client.id === 'client_bulk_apply_selftest'
          && receipt.client.version === '1.0.0'
          && 'legacyRoute' in receipt.capability
          && receipt.capability.legacyRoute === BULK_TRANSFORM_APPLY_ROUTE_KEY.replace('POST ', '')
          && receipt.capability.method === 'POST'
          && receipt.capability.reviewed === true
          && receipt.authority.scope === 'workspace'
          && receipt.authority.operationId === input.operationId
          && receipt.authority.workspaceId === owners.registry.defaultWorkspaceId
          && receipt.authority.requestScope === `workspace-${owners.registry.defaultWorkspaceId}`
          && sameJson(receipt.authority.resources, facts.beforeResources)
          && receipt.input.beforeHash === facts.receiptFacts.beforeHash
          && receipt.input.requestHash === facts.receiptFacts.requestHash
          && receipt.input.beforeHash === combineReceiptResourceBeforeHashes(receipt.authority.resources)
          && receipt.effects.declared.length === 1
          && receipt.effects.declared[0]?.id === 'workspace-write'
          && receipt.effects.declared[0]?.operation === BULK_TRANSFORM_APPLY_MODE
          && sameJson(receipt.effects.declared[0]?.resource, expectedEffectResource)
          && receipt.effects.declared[0]?.resource.beforeHash === resourceHash(facts.beforeResources, 'workspace')
          && receipt.effects.declared[0]?.reversible === true
          && receipt.validation.validator === 'bulk-transform-apply'
          && receipt.validation.ruleHash === facts.receiptFacts.ruleId
          && receipt.validation.code === BULK_TRANSFORM_APPLY_MODE
          && receipt.validation.summary === 'Deterministic bulk transform apply'
          && canonicalJson(receipt.metadata) === canonicalJson({
            operation: BULK_TRANSFORM_APPLY_MODE,
            route: BULK_TRANSFORM_APPLY_ROUTE_KEY,
            mode: BULK_TRANSFORM_APPLY_MODE,
          })
          && receipt.rollback.required
          && receipt.rollback.mode === 'recovery'
          && receipt.rollback.reference === receipt.id
          && receipt.after?.outcome === 'applied'
          && sameJson(receipt.after.resources, expectedAfter)
          && current.head !== before.head
          && current.head === workspaceContentHash(current.workspace)
          && owners.registry.snapshotHash(current) === workspaceSnapshotHash(current.workspace)
          && targetWorkspaceHash !== undefined
          && targetSnapshotHash !== undefined
          && afterResourceHash(receipt, 'workspace') === targetWorkspaceHash
          && afterResourceHash(receipt, 'snapshot') === targetSnapshotHash
          && HASH64_RE.test(targetWorkspaceHash)
          && HASH64_RE.test(targetSnapshotHash)
          && recovery !== undefined
          && recovery.ok
          && recovery.record.kind === 'workspace'
          && recovery.record.status === 'ready'
          && recovery.record.id === receipt.id
          && recovery.record.workspaceId === owners.registry.defaultWorkspaceId
          && recovery.record.beforeHash === before.head
          && recovery.record.beforeSnapshotHash === beforeSnapshotHash
          && recovery.record.expectedCurrentHash === targetWorkspaceHash
          && recovery.record.expectedCurrentSnapshotHash === targetSnapshotHash
          && workspaceContentHash(recovery.record.beforeWorkspace as ModWorkspace) === before.head
          && workspaceSnapshotHash(recovery.record.beforeWorkspace as ModWorkspace) === beforeSnapshotHash
          && projections.length === 1
          && sameJson(projections[0], result.receipt);
        return pass;
      } finally {
        commit.restore();
      }
    });

    await checkAsync(checks, 'changed_replay_is_exact_without_forward_commit', async () => {
      const owners = makeOwners(root, 'changed-replay');
      const projections: unknown[] = [];
      const input = makeInput(owners, 'bulk-apply.changed.replay');
      const commit = patchRegistryCommit(owners.registry, (workspaceId, workspace, origin, delegate) => (
        delegate(workspaceId, workspace, origin)
      ));
      try {
        const first = await executeBulkTransformApplyReceipt(dependencies(owners, projections), input);
        if (!first.ok) return false;
        const registryBeforeReplay = captureRegistry(owners.registry);
        const receiptBytesBeforeReplay = directoryDigest(owners.store.root);
        const recoveryBytesBeforeReplay = directoryDigest(owners.recoveryStore.root);
        const replay = await executeBulkTransformApplyReceipt(dependencies(owners, projections), input);
        const receipt = terminalReceipt(replay, owners.store);
        return replay.ok
          && replay.replayed
          && !replay.applied
          && replay.receipt.id === first.receipt.id
          && replay.receipt.hash === first.receipt.hash
          && replay.record.version === first.record.version
          && sameJson(replay.receipt, first.receipt)
          && captureRegistry(owners.registry) === registryBeforeReplay
          && directoryDigest(owners.store.root) === receiptBytesBeforeReplay
          && directoryDigest(owners.recoveryStore.root) === recoveryBytesBeforeReplay
          && forwardCommitCount(commit.calls) === 1
          && receiptFileCount(owners.store) === 1
          && recoveryEntryCount(owners.recoveryStore) === 1
          && receipt !== undefined
          && receipt.status === 'committed'
          && projections.length === 2
          && sameJson(projections[0], first.receipt)
          && sameJson(projections[1], first.receipt);
      } finally {
        commit.restore();
      }
    });

    await checkAsync(checks, 'material_conflicts_are_rejected_without_mutation', async () => {
      const scenarios: Array<{
        label: string;
        input: (base: BulkTransformApplyReceiptAdapterInput) => BulkTransformApplyReceiptAdapterInput;
      }> = [];
      const changedRule: BulkTransformRule = {
        ...cloneJson(BASE_RULE),
        operand: 4,
        operations: [{
          ...cloneJson(BASE_RULE.operations[0]!),
          operand: 4,
        }],
      };
      const changedRulePlan = fixturePlan(changedRule);
      const changedCorpusPlan = fixturePlan(BASE_RULE, `${RAW_CORPUS_GENERATION}-changed`);
      const changedSourceDocuments = BASE_DOCUMENTS.map(document => ({
        ...cloneJson(document),
        signature: `${document.signature}-changed`,
      }));
      const changedSourcePlan = fixturePlan(BASE_RULE, RAW_CORPUS_GENERATION, changedSourceDocuments);
      scenarios.push(
        {
          label: 'rule',
          input: base => ({
            ...base,
            rule: cloneJson(changedRule),
            expectedPlanHash: changedRulePlan.planHash,
            buildPlan: safePlanBuilder(changedRulePlan),
          }),
        },
        {
          label: 'corpus',
          input: base => ({
            ...base,
            expectedPlanHash: changedCorpusPlan.planHash,
            buildPlan: safePlanBuilder(changedCorpusPlan),
          }),
        },
        {
          label: 'source',
          input: base => ({
            ...base,
            expectedPlanHash: changedSourcePlan.planHash,
            buildPlan: safePlanBuilder(changedSourcePlan),
          }),
        },
        {
          label: 'expected-plan',
          input: base => ({ ...base, expectedPlanHash: 'f'.repeat(64) }),
        },
        {
          label: 'client',
          input: base => ({
            ...base,
            identity: {
              kind: 'agent',
              keyId: 'key_bulk_apply_selftest',
              clientId: 'client_bulk_apply_other',
              version: '1.0.0',
            },
          }),
        },
        {
          label: 'workspace',
          input: base => ({ ...base, workspaceId: 'ws_ffffffffffffffffffffffff' }),
        },
      );

      for (const scenario of scenarios) {
        const owners = makeOwners(root, `material-conflict-${scenario.label}`);
        const baseInput = makeInput(owners, `bulk-apply.material.${scenario.label}`);
        const first = await executeBulkTransformApplyReceipt(dependencies(owners), baseInput);
        if (!first.ok) return false;
        const registryBefore = captureRegistry(owners.registry);
        const receiptBytesBefore = directoryDigest(owners.store.root);
        const recoveryBytesBefore = directoryDigest(owners.recoveryStore.root);
        const conflict = await executeBulkTransformApplyReceipt(
          dependencies(owners),
          scenario.input(baseInput),
        );
        if (conflict.ok === true) return false;
        if (conflict.code !== 'ACTION_RECEIPT_DUPLICATE_CONFLICT'
          || conflict.replayed
          || conflict.receipt !== undefined
          || captureRegistry(owners.registry) !== registryBefore
          || directoryDigest(owners.store.root) !== receiptBytesBefore
          || directoryDigest(owners.recoveryStore.root) !== recoveryBytesBefore
          || receiptFileCount(owners.store) !== 1
          || recoveryEntryCount(owners.recoveryStore) !== 1) {
          return false;
        }
      }
      return true;
    });

    await checkAsync(checks, 'no_change_first_and_replay_have_no_recovery_or_commit', async () => {
      const noChangeWorkspace = sanitizeWorkspace({
        ...cloneJson(BASE_WORKSPACE),
        xmlPatches: mergeBulkTransformPatches(BASE_WORKSPACE.xmlPatches || [], BASE_PLAN),
      });
      const owners = makeOwners(root, 'no-change', noChangeWorkspace);
      const projections: unknown[] = [];
      const input = makeInput(owners, 'bulk-apply.no-change');
      const facts = prepareFactsForOwner(owners, input);
      if (facts === undefined || facts.receiptFacts.changed) return false;
      const before = workspaceState(owners);
      const registryBefore = captureRegistry(owners.registry);
      const commit = patchRegistryCommit(owners.registry, (workspaceId, workspace, origin, delegate) => (
        delegate(workspaceId, workspace, origin)
      ));
      try {
        const first = await executeBulkTransformApplyReceipt(dependencies(owners, projections), input);
        const receipt = terminalReceipt(first, owners.store);
        if (!first.ok || first.applied || first.replayed || receipt === undefined) return false;
        const registryAfterFirst = captureRegistry(owners.registry);
        const replay = await executeBulkTransformApplyReceipt(dependencies(owners, projections), input);
        const replayReceipt = terminalReceipt(replay, owners.store);
        const current = workspaceState(owners);
        const expectedAfter = facts.beforeResources.map(resource => ({
          role: resource.role,
          root: resource.root,
          relativePath: resource.relativePath,
          hash: resource.beforeHash,
        }));
        return receipt.status === 'committed'
          && receipt.after?.outcome === 'no_change'
          && sameJson(receipt.authority.resources, facts.beforeResources)
          && sameJson(receipt.after.resources, expectedAfter)
          && receipt.rollback.required === false
          && receipt.rollback.mode === 'none'
          && receipt.rollback.status === 'not_required'
          && current.version === before.version
          && sameJson(current.workspace, before.workspace)
          && captureRegistry(owners.registry) === registryAfterFirst
          && registryAfterFirst === registryBefore
          && forwardCommitCount(commit.calls) === 0
          && recoveryEntryCount(owners.recoveryStore) === 0
          && receiptFileCount(owners.store) === 1
          && replay.ok
          && replay.replayed
          && !replay.applied
          && replay.receipt.id === first.receipt.id
          && replay.receipt.hash === first.receipt.hash
          && replayReceipt !== undefined
          && sameJson(replayReceipt, receipt)
          && projections.length === 2
          && sameJson(projections[0], first.receipt)
          && sameJson(projections[1], first.receipt);
      } finally {
        commit.restore();
      }
    });

    await checkAsync(checks, 'initial_refusals_are_terminal_and_do_not_prepare_receipts', async () => {
      const owners = makeOwners(root, 'initial-refusals');
      const malformedPlan = cloneJson(BASE_PLAN);
      malformedPlan.rows = [];
      const uncleanPlan = cloneJson(BASE_PLAN);
      uncleanPlan.rows[0]!.simulationOk = false;
      const overbroadPlan = cloneJson(BASE_PLAN);
      overbroadPlan.candidateCount = 501;
      const scenarios: Array<{
        operationId: unknown;
        overrides?: Partial<BulkTransformApplyReceiptAdapterInput>;
        code: string;
      }> = [
        { operationId: undefined, code: 'ACTION_RECEIPT_OPERATION_ID_INVALID' },
        { operationId: 'bad/operation', code: 'ACTION_RECEIPT_OPERATION_ID_INVALID' },
        {
          operationId: 'bulk-apply.initial.stale-head',
          overrides: { expectedHead: differentLegacyHash(workspaceState(owners).head) },
          code: 'BULK_APPLY_HEAD_CONFLICT',
        },
        {
          operationId: 'bulk-apply.initial.stale-snapshot',
          overrides: { expectedSnapshotHash: differentLegacyHash(workspaceSnapshot(owners)) },
          code: 'BULK_APPLY_SNAPSHOT_CONFLICT',
        },
        {
          operationId: 'bulk-apply.initial.invalid-rule',
          overrides: {
            rule: null,
            buildPlan: (_rule, _workspace) => {
              throw new Error(`${RAW_RULE_ID} ${RAW_XML} ${RAW_HOST_PATH} ${RAW_TOKEN} ${RAW_BEARER}`);
            },
          },
          code: 'BULK_APPLY_PREPARE_FAILED',
        },
        {
          operationId: 'bulk-apply.initial.empty-plan',
          overrides: { buildPlan: safePlanBuilder(malformedPlan) },
          code: 'BULK_APPLY_PLAN_INVALID',
        },
        {
          operationId: 'bulk-apply.initial.unclean-plan',
          overrides: { buildPlan: safePlanBuilder(uncleanPlan) },
          code: 'BULK_APPLY_PLAN_INVALID',
        },
        {
          operationId: 'bulk-apply.initial.overbroad-plan',
          overrides: { buildPlan: safePlanBuilder(overbroadPlan) },
          code: 'BULK_APPLY_PLAN_INVALID',
        },
        {
          operationId: 'bulk-apply.initial.throwing-plan',
          overrides: {
            buildPlan: (_rule, _workspace) => {
              throw new Error(`${RAW_RULE_ID} ${RAW_XML} ${RAW_HOST_PATH} ${RAW_TOKEN} ${RAW_BEARER}`);
            },
          },
          code: 'BULK_APPLY_PREPARE_FAILED',
        },
      ];
      const registryBefore = captureRegistry(owners.registry);
      for (const scenario of scenarios) {
        const input = makeInput(owners, scenario.operationId, scenario.overrides);
        const result = await executeBulkTransformApplyReceipt(dependencies(owners), input);
        if (result.ok === true
          || result.code !== scenario.code
          || result.replayed
          || result.receipt !== undefined
          || captureRegistry(owners.registry) !== registryBefore
          || receiptFileCount(owners.store) !== 0
          || recoveryEntryCount(owners.recoveryStore) !== 0) {
          return false;
        }
      }
      return true;
    });

    await checkAsync(checks, 'boundary_cas_drift_is_refused_and_recovery_cleaned', async () => {
      const owners = makeOwners(root, 'boundary-cas');
      const before = workspaceState(owners);
      const projections: unknown[] = [];
      let drifted = false;
      const input = makeInput(owners, 'bulk-apply.boundary.cas', {
        mayProceed: () => {
          if (!drifted) {
            drifted = true;
            const current = workspaceState(owners);
            owners.registry.commit(
              current.workspaceId,
              sanitizeWorkspace({ ...cloneJson(current.workspace), name: 'third-party-boundary-drift' }),
              'selftest:third-party-boundary-drift',
            );
          }
          return true;
        },
      });
      const commit = patchRegistryCommit(owners.registry, (workspaceId, workspace, origin, delegate) => (
        delegate(workspaceId, workspace, origin)
      ));
      try {
        const result = await executeBulkTransformApplyReceipt(dependencies(owners, projections), input);
        const current = workspaceState(owners);
        const receipt = terminalReceipt(result, owners.store);
        return result.ok === false
          && result.code === 'BULK_APPLY_BOUNDARY_FACTS_CHANGED'
          && !result.replayed
          && result.receipt !== undefined
          && receipt !== undefined
          && receipt.status === 'failed'
          && drifted
          && sameJson(current.workspace.name, 'third-party-boundary-drift')
          && current.version === before.version + 1
          && forwardCommitCount(commit.calls) === 0
          && commit.calls.length === 1
          && commit.calls[0]?.origin === 'selftest:third-party-boundary-drift'
          && receiptFileCount(owners.store) === 1
          && recoveryEntryCount(owners.recoveryStore) === 0
          && projections.length === 1
          && sameJson(projections[0], result.receipt);
      } finally {
        commit.restore();
      }
    });

    await checkAsync(checks, 'boundary_plan_corpus_and_source_drift_are_refused_without_adapter_commit', async () => {
      const driftPlans: Array<{ label: string; plan: BulkTransformPlan }> = [
        { label: 'corpus', plan: fixturePlan(BASE_RULE, `${RAW_CORPUS_GENERATION}-boundary`) },
        {
          label: 'source',
          plan: fixturePlan(
            BASE_RULE,
            RAW_CORPUS_GENERATION,
            BASE_DOCUMENTS.map(document => ({ ...cloneJson(document), signature: `${document.signature}-boundary` })),
          ),
        },
      ];
      for (const drift of driftPlans) {
        const owners = makeOwners(root, `boundary-${drift.label}`);
        const before = workspaceState(owners);
        let drifted = false;
        const input = makeInput(owners, `bulk-apply.boundary.${drift.label}`, {
          buildPlan: (_rule, _workspace) => cloneJson(drifted ? drift.plan : BASE_PLAN),
          mayProceed: () => {
            drifted = true;
            return true;
          },
        });
        const projections: unknown[] = [];
        const commit = patchRegistryCommit(owners.registry, (workspaceId, workspace, origin, delegate) => (
          delegate(workspaceId, workspace, origin)
        ));
        try {
          const result = await executeBulkTransformApplyReceipt(dependencies(owners, projections), input);
          const receipt = terminalReceipt(result, owners.store);
          const current = workspaceState(owners);
          if (result.ok === true
            || result.code !== 'BULK_APPLY_PLAN_CHANGED'
            || result.replayed
            || receipt === undefined
            || receipt.status !== 'failed'
            || !sameWorkspaceState(current, before)
            || forwardCommitCount(commit.calls) !== 0
            || receiptFileCount(owners.store) !== 1
            || recoveryEntryCount(owners.recoveryStore) !== 0
            || projections.length !== 1
            || !sameJson(projections[0], result.receipt)) {
            return false;
          }
        } finally {
          commit.restore();
        }
      }
      return true;
    });

    await checkAsync(checks, 'response_deadline_refuses_before_domain_write', async () => {
      const owners = makeOwners(root, 'deadline');
      const before = workspaceState(owners);
      const projections: unknown[] = [];
      const cleanupStatuses: ObservedReceiptStatus[] = [];
      let mayProceedCalls = 0;
      const recoveryStore = recoveryStoreWithCleanupObservation(owners, cleanupStatuses);
      const input = makeInput(owners, 'bulk-apply.response-deadline', {
        mayProceed: () => {
          mayProceedCalls += 1;
          return mayProceedCalls === 1;
        },
      });
      const commit = patchRegistryCommit(owners.registry, (workspaceId, workspace, origin, delegate) => (
        delegate(workspaceId, workspace, origin)
      ));
      try {
        const result = await executeBulkTransformApplyReceipt(
          dependencies(owners, projections, owners.store, recoveryStore),
          input,
        );
        const receipt = terminalReceipt(result, owners.store);
        return result.ok === false
          && result.code === 'BULK_APPLY_RESPONSE_DEADLINE'
          && !result.replayed
          && result.receipt !== undefined
          && receipt !== undefined
          && receipt.status === 'failed'
          && samePairedWorkspaceState(workspaceState(owners), before)
          && forwardCommitCount(commit.calls) === 0
          && receiptFileCount(owners.store) === 1
          && recoveryEntryCount(owners.recoveryStore) === 0
          && mayProceedCalls === 2
          && cleanupStatuses.length === 1
          && cleanupStatuses[0] === 'failed'
          && projections.length === 1
          && sameJson(projections[0], result.receipt);
      } finally {
        commit.restore();
      }
    });

    await checkAsync(checks, 'recovery_creation_failure_has_no_receipt_or_domain_write', async () => {
      const owners = makeOwners(root, 'fault-recovery-create');
      const before = workspaceState(owners);
      const projections: unknown[] = [];
      const cleanupStatuses: ObservedReceiptStatus[] = [];
      let recoveryWritten = false;
      let recoveryId: string | undefined;
      let prepareCalls = 0;
      const recoveryStore = wrapRecoveryStore(owners.recoveryStore, {
        createWorkspace: input => {
          recoveryId = input.recoveryId;
          const record = owners.recoveryStore.createWorkspace(input);
          recoveryWritten = record.id === input.recoveryId && record.status === 'ready';
          throw new Error(`${RAW_NATIVE_ERROR_MARKER} ${RAW_TOKEN} ${RAW_HOST_PATH}`);
        },
        abandon: (id, delegate) => {
          cleanupStatuses.push(authoritativeReceiptStatus(owners.store, id));
          delegate(id);
        },
      });
      const store = wrapStore(owners.store, {
        prepare: (input, delegate) => {
          prepareCalls += 1;
          return delegate(input);
        },
      });
      const input = makeInput(owners, 'bulk-apply.fault.recovery-create');
      const commit = patchRegistryCommit(owners.registry, (workspaceId, workspace, origin, delegate) => (
        delegate(workspaceId, workspace, origin)
      ));
      try {
        const result = await executeBulkTransformApplyReceipt(
          dependencies(owners, projections, store, recoveryStore),
          input,
        );
        return result.ok === false
          && result.code === 'BULK_APPLY_RECOVERY_FAILED'
          && !result.replayed
          && result.receipt === undefined
          && samePairedWorkspaceState(workspaceState(owners), before)
          && forwardCommitCount(commit.calls) === 0
          && receiptFileCount(owners.store) === 0
          && recoveryEntryCount(owners.recoveryStore) === 0
          && recoveryWritten
          && recoveryId !== undefined
          && authoritativeReceiptStatus(owners.store, recoveryId) === 'absent'
          && owners.recoveryStore.read(recoveryId).ok === false
          && prepareCalls === 0
          && cleanupStatuses.length === 1
          && cleanupStatuses[0] === 'absent'
          && projections.length === 1
          && projections[0] === undefined;
      } finally {
        commit.restore();
      }
    });

    await checkAsync(checks, 'receipt_prepare_failure_cleans_recovery_without_domain_write', async () => {
      const owners = makeOwners(root, 'fault-receipt-prepare');
      const before = workspaceState(owners);
      const projections: unknown[] = [];
      const store = wrapStore(owners.store, {
        prepare: (_input, _delegate) => {
          const error = new Error(`${RAW_NATIVE_ERROR_MARKER} ${RAW_TOKEN} ${RAW_HOST_PATH}`) as Error & { code: string };
          error.code = 'RECEIPT_STORE_WRITE_FAILED';
          throw error;
        },
      });
      const input = makeInput(owners, 'bulk-apply.fault.receipt-prepare');
      const commit = patchRegistryCommit(owners.registry, (workspaceId, workspace, origin, delegate) => (
        delegate(workspaceId, workspace, origin)
      ));
      try {
        const result = await executeBulkTransformApplyReceipt(
          dependencies(owners, projections, store),
          input,
        );
        return result.ok === false
          && result.code === 'RECEIPT_STORE_WRITE_FAILED'
          && !result.replayed
          && result.receipt === undefined
          && samePairedWorkspaceState(workspaceState(owners), before)
          && forwardCommitCount(commit.calls) === 0
          && receiptFileCount(owners.store) === 0
          && recoveryEntryCount(owners.recoveryStore) === 0
          && projections.length === 1
          && projections[0] === undefined;
      } finally {
        commit.restore();
      }
    });

    await checkAsync(checks, 'receipt_prepare_write_then_throw_preserves_prepared_replay_and_recovery', async () => {
      const owners = makeOwners(root, 'fault-receipt-prepare-write-then-throw');
      const before = workspaceState(owners);
      const projections: unknown[] = [];
      let preparedId: string | undefined;
      let persistedAtThrow = false;
      const store = wrapStore(owners.store, {
        prepare: (input, delegate) => {
          const stored = delegate(input);
          const id = stored.receipt.id;
          preparedId = id;
          const persisted = soleCanonicalReceipt(owners.store);
          persistedAtThrow = persisted?.id === id && persisted.receipt.id === id;
          const error = new Error(`${RAW_NATIVE_ERROR_MARKER} ${RAW_TOKEN} ${RAW_HOST_PATH}`) as Error & { code: string };
          error.code = 'RECEIPT_STORE_WRITE_FAILED';
          throw error;
        },
      });
      const input = makeInput(owners, 'bulk-apply.fault.receipt-prepare-write-then-throw');
      const commit = patchRegistryCommit(owners.registry, (workspaceId, workspace, origin, delegate) => (
        delegate(workspaceId, workspace, origin)
      ));
      try {
        const first = await executeBulkTransformApplyReceipt(
          dependencies(owners, projections, store),
          input,
        );
        if (preparedId === undefined) return false;
        const preparedEntry = soleCanonicalReceipt(owners.store);
        const prepared = preparedEntry?.receipt;
        const recovery = owners.recoveryStore.read(preparedId);
        if (preparedEntry === undefined
          || preparedEntry.id !== preparedId
          || prepared === undefined
          || !recovery.ok
          || prepared.id !== preparedId
          || prepared.status !== 'prepared'
          || prepared.rollback.required !== true
          || prepared.rollback.status !== 'prepared'
          || prepared.rollback.reference !== prepared.id
          || recovery.record.id !== preparedId
          || recovery.record.status !== 'ready'
          || !persistedAtThrow) {
          return false;
        }

        const registryBeforeRetry = captureRegistry(owners.registry);
        const receiptBytesBeforeRetry = directoryDigest(owners.store.root);
        const recoveryBytesBeforeRetry = directoryDigest(owners.recoveryStore.root);
        const retry = await executeBulkTransformApplyReceipt(
          dependencies(owners),
          input,
        );
        const preparedAfterRetry = soleCanonicalReceipt(owners.store);
        const recoveryAfterRetry = owners.recoveryStore.read(preparedId);
        return first.ok === false
          && first.code === 'RECEIPT_STORE_WRITE_FAILED'
          && !first.replayed
          && first.receipt === undefined
          && samePairedWorkspaceState(workspaceState(owners), before)
          && workspaceState(owners).version === before.version
          && forwardCommitCount(commit.calls) === 0
          && commit.calls.length === 0
          && receiptFileCount(owners.store) === 1
          && recoveryEntryCount(owners.recoveryStore) === 1
          && retry.ok === false
          && retry.code === 'ACTION_RECEIPT_PREPARED_REPLAY'
          && retry.replayed
          && retry.receipt === undefined
          && captureRegistry(owners.registry) === registryBeforeRetry
          && directoryDigest(owners.store.root) === receiptBytesBeforeRetry
          && directoryDigest(owners.recoveryStore.root) === recoveryBytesBeforeRetry
          && preparedAfterRetry !== undefined
          && preparedAfterRetry.id === preparedId
          && sameJson(preparedAfterRetry.receipt, prepared)
          && recoveryAfterRetry.ok
          && sameJson(recoveryAfterRetry.record, recovery.record)
          && projections.length === 1
          && projections[0] === undefined;
      } finally {
        commit.restore();
      }
    });

    await checkAsync(checks, 'domain_commit_throw_before_write_rolls_back_without_retry', async () => {
      const owners = makeOwners(root, 'fault-domain-before-write');
      const before = workspaceState(owners);
      const projections: unknown[] = [];
      const commit = patchRegistryCommit(owners.registry, (workspaceId, workspace, origin, delegate) => {
        if (origin === BULK_TRANSFORM_APPLY_MODE) {
          throw new Error(`${RAW_NATIVE_ERROR_MARKER} ${RAW_TOKEN} ${RAW_HOST_PATH}`);
        }
        return delegate(workspaceId, workspace, origin);
      });
      try {
        const result = await executeBulkTransformApplyReceipt(
          dependencies(owners, projections),
          makeInput(owners, 'bulk-apply.fault.domain-before-write'),
        );
        const receipt = terminalReceipt(result, owners.store);
        return result.ok === false
          && result.code === 'BULK_APPLY_COMMIT_FAILED'
          && !result.replayed
          && result.receipt !== undefined
          && receipt !== undefined
          && receipt.status === 'rolled_back'
          && samePairedWorkspaceState(workspaceState(owners), before)
          && forwardCommitCount(commit.calls) === 1
          && commit.calls.filter(call => call.origin === `${BULK_TRANSFORM_APPLY_MODE}:rollback`).length === 0
          && commit.calls.length === 1
          && receiptFileCount(owners.store) === 1
          && recoveryEntryCount(owners.recoveryStore) === 0
          && projections.length === 1
          && sameJson(projections[0], result.receipt);
      } finally {
        commit.restore();
      }
    });

    await checkAsync(checks, 'domain_commit_write_then_throw_rolls_back_without_retry', async () => {
      const owners = makeOwners(root, 'fault-domain-write-then-throw');
      const before = workspaceState(owners);
      const projections: unknown[] = [];
      const commit = patchRegistryCommit(owners.registry, (workspaceId, workspace, origin, delegate) => {
        const committed = delegate(workspaceId, workspace, origin);
        if (origin === BULK_TRANSFORM_APPLY_MODE) {
          throw new Error(`${RAW_NATIVE_ERROR_MARKER} ${RAW_TOKEN} ${RAW_HOST_PATH}`);
        }
        return committed;
      });
      try {
        const result = await executeBulkTransformApplyReceipt(
          dependencies(owners, projections),
          makeInput(owners, 'bulk-apply.fault.domain-write-then-throw'),
        );
        const receipt = terminalReceipt(result, owners.store);
        return result.ok === false
          && result.code === 'BULK_APPLY_COMMIT_FAILED'
          && !result.replayed
          && result.receipt !== undefined
          && receipt !== undefined
          && receipt.status === 'rolled_back'
          && samePairedWorkspaceState(workspaceState(owners), before)
          && forwardCommitCount(commit.calls) === 1
          && commit.calls.filter(call => call.origin === `${BULK_TRANSFORM_APPLY_MODE}:rollback`).length === 1
          && commit.calls.length === 2
          && receiptFileCount(owners.store) === 1
          && recoveryEntryCount(owners.recoveryStore) === 0
          && projections.length === 1
          && sameJson(projections[0], result.receipt);
      } finally {
        commit.restore();
      }
    });

    await checkAsync(checks, 'postcondition_lookup_failure_rolls_back_exact_prior_paired_state', async () => {
      const owners = makeOwners(root, 'fault-postcondition-lookup');
      const before = workspaceState(owners);
      const projections: unknown[] = [];
      const cleanupStatuses: ObservedReceiptStatus[] = [];
      let failNextLookup = false;
      let postconditionLookupFailures = 0;
      const lookup = patchRegistryLookup(owners.registry, (workspaceId, delegate) => {
        if (failNextLookup) {
          failNextLookup = false;
          postconditionLookupFailures += 1;
          return {
            ok: false,
            code: 'WORKSPACE_NOT_FOUND',
            error: 'selftest one-shot postcondition lookup failure',
          };
        }
        return delegate(workspaceId);
      });
      const recoveryStore = recoveryStoreWithCleanupObservation(owners, cleanupStatuses);
      const commit = patchRegistryCommit(owners.registry, (workspaceId, workspace, origin, delegate) => {
        const committed = delegate(workspaceId, workspace, origin);
        if (origin === BULK_TRANSFORM_APPLY_MODE) failNextLookup = true;
        return committed;
      });
      try {
        const result = await executeBulkTransformApplyReceipt(
          dependencies(owners, projections, owners.store, recoveryStore),
          makeInput(owners, 'bulk-apply.fault.postcondition-lookup'),
        );
        const receipt = terminalReceipt(result, owners.store);
        const current = workspaceState(owners);
        return result.ok === false
          && result.code === 'BULK_APPLY_POSTCONDITION_FAILED'
          && !result.replayed
          && result.receipt !== undefined
          && receipt !== undefined
          && receipt.id === result.receipt.id
          && receipt.hash === result.receipt.hash
          && receipt.status === result.receipt.status
          && receipt.status === 'rolled_back'
          && receipt.rollback.status === 'performed'
          && postconditionLookupFailures === 1
          && !failNextLookup
          && samePairedWorkspaceState(current, before)
          && current.version === before.version + 2
          && forwardCommitCount(commit.calls) === 1
          && commit.calls.filter(call => call.origin === `${BULK_TRANSFORM_APPLY_MODE}:rollback`).length === 1
          && commit.calls.length === 2
          && recoveryEntryCount(owners.recoveryStore) === 0
          && cleanupStatuses.length === 1
          && cleanupStatuses[0] === 'rolled_back'
          && projections.length === 1
          && sameJson(projections[0], result.receipt);
      } finally {
        commit.restore();
        lookup.restore();
      }
    });

    await checkAsync(checks, 'finalization_failure_rolls_back_exact_prior_state', async () => {
      const owners = makeOwners(root, 'fault-finalization');
      const before = workspaceState(owners);
      const projections: unknown[] = [];
      const store = wrapStore(owners.store, {
        transition: (id, input, delegate) => {
          if (input.to === 'committed') {
            throw new Error(`${RAW_NATIVE_ERROR_MARKER} ${RAW_TOKEN} ${RAW_HOST_PATH}`);
          }
          return delegate(id, input);
        },
      });
      const commit = patchRegistryCommit(owners.registry, (workspaceId, workspace, origin, delegate) => (
        delegate(workspaceId, workspace, origin)
      ));
      try {
        const result = await executeBulkTransformApplyReceipt(
          dependencies(owners, projections, store),
          makeInput(owners, 'bulk-apply.fault.finalization'),
        );
        const receipt = terminalReceipt(result, owners.store);
        return result.ok === false
          && result.code === 'ACTION_RECEIPT_FINALIZATION_FAILED'
          && !result.replayed
          && result.receipt !== undefined
          && receipt !== undefined
          && receipt.status === 'rolled_back'
          && samePairedWorkspaceState(workspaceState(owners), before)
          && forwardCommitCount(commit.calls) === 1
          && commit.calls.filter(call => call.origin === `${BULK_TRANSFORM_APPLY_MODE}:rollback`).length === 1
          && commit.calls.length === 2
          && receiptFileCount(owners.store) === 1
          && recoveryEntryCount(owners.recoveryStore) === 0
          && projections.length === 1
          && sameJson(projections[0], result.receipt);
      } finally {
        commit.restore();
      }
    });

    await checkAsync(checks, 'rollback_guard_preserves_third_party_state_and_ready_recovery', async () => {
      const owners = makeOwners(root, 'fault-rollback-third-party');
      const before = workspaceState(owners);
      const projections: unknown[] = [];
      const store = wrapStore(owners.store, {
        transition: (id, input, delegate) => {
          if (input.to === 'committed') {
            const current = workspaceState(owners);
            owners.registry.commit(
              current.workspaceId,
              sanitizeWorkspace({ ...cloneJson(current.workspace), name: 'third-party-after-forward' }),
              'selftest:third-party-after-forward',
            );
            throw new Error(`${RAW_NATIVE_ERROR_MARKER} ${RAW_TOKEN} ${RAW_HOST_PATH}`);
          }
          return delegate(id, input);
        },
      });
      const commit = patchRegistryCommit(owners.registry, (workspaceId, workspace, origin, delegate) => (
        delegate(workspaceId, workspace, origin)
      ));
      try {
        const input = makeInput(owners, 'bulk-apply.fault.rollback-third-party');
        const result = await executeBulkTransformApplyReceipt(
          dependencies(owners, projections, store),
          input,
        );
        const receipt = terminalReceipt(result, owners.store);
        const recovery = result.receipt === undefined ? undefined : owners.recoveryStore.read(result.receipt.id);
        const current = workspaceState(owners);
        return result.ok === false
          && result.code === 'BULK_APPLY_ROLLBACK_FAILED'
          && !result.replayed
          && result.receipt !== undefined
          && receipt !== undefined
          && receipt.status === 'incomplete'
          && receipt.after?.outcome === 'partial'
          && current.workspace.name === 'third-party-after-forward'
          && current.version === before.version + 2
          && forwardCommitCount(commit.calls) === 1
          && commit.calls.filter(call => call.origin === 'selftest:third-party-after-forward').length === 1
          && commit.calls.filter(call => call.origin === `${BULK_TRANSFORM_APPLY_MODE}:rollback`).length === 0
          && recovery !== undefined
          && recovery.ok
          && recovery.record.status === 'ready'
          && recovery.record.id === receipt.id
          && receiptFileCount(owners.store) === 1
          && recoveryEntryCount(owners.recoveryStore) === 1
          && projections.length === 1
          && sameJson(projections[0], result.receipt);
      } finally {
        commit.restore();
      }
    });

    await checkAsync(checks, 'rollback_commit_failure_preserves_target_and_partial_truth', async () => {
      const owners = makeOwners(root, 'fault-rollback-commit');
      const before = workspaceState(owners);
      const input = makeInput(owners, 'bulk-apply.fault.rollback-commit');
      const facts = prepareFactsForOwner(owners, input);
      if (facts === undefined) return false;
      const projections: unknown[] = [];
      const commit = patchRegistryCommit(owners.registry, (workspaceId, workspace, origin, delegate) => {
        if (origin === `${BULK_TRANSFORM_APPLY_MODE}:rollback`) {
          throw new Error(`${RAW_NATIVE_ERROR_MARKER} ${RAW_TOKEN} ${RAW_HOST_PATH}`);
        }
        return delegate(workspaceId, workspace, origin);
      });
      const store = wrapStore(owners.store, {
        transition: (id, transition, delegate) => {
          if (transition.to === 'committed') {
            throw new Error(`${RAW_NATIVE_ERROR_MARKER} ${RAW_TOKEN} ${RAW_HOST_PATH}`);
          }
          return delegate(id, transition);
        },
      });
      try {
        const result = await executeBulkTransformApplyReceipt(
          dependencies(owners, projections, store),
          input,
        );
        const receipt = terminalReceipt(result, owners.store);
        const recovery = result.receipt === undefined ? undefined : owners.recoveryStore.read(result.receipt.id);
        const current = workspaceState(owners);
        const currentResources = workspaceReceiptResources(current.workspaceId, current.workspace);
        return result.ok === false
          && result.code === 'BULK_APPLY_ROLLBACK_FAILED'
          && !result.replayed
          && result.receipt !== undefined
          && receipt !== undefined
          && receipt.status === 'incomplete'
          && receipt.after?.outcome === 'partial'
          && !sameWorkspaceState(current, before)
          && sameJson(currentResources, facts.targetResources)
          && forwardCommitCount(commit.calls) === 1
          && commit.calls.filter(call => call.origin === `${BULK_TRANSFORM_APPLY_MODE}:rollback`).length === 1
          && recovery !== undefined
          && recovery.ok
          && recovery.record.status === 'ready'
          && recovery.record.id === receipt.id
          && receiptFileCount(owners.store) === 1
          && recoveryEntryCount(owners.recoveryStore) === 1
          && projections.length === 1
          && sameJson(projections[0], result.receipt);
      } finally {
        commit.restore();
      }
    });

    await checkAsync(checks, 'authoritative_reopen_failure_is_non_success', async () => {
      const owners = makeOwners(root, 'fault-authoritative-reopen');
      const projections: unknown[] = [];
      let faultArmed = false;
      const store = wrapStore(owners.store, {
        read: (id, delegate) => {
          if (faultArmed) {
            faultArmed = false;
            throw new Error(`${RAW_NATIVE_ERROR_MARKER} ${RAW_TOKEN} ${RAW_HOST_PATH}`);
          }
          return delegate(id);
        },
        transition: (id, input, delegate) => {
          const result = delegate(id, input);
          if (input.to === 'committed') faultArmed = true;
          return result;
        },
      });
      const commit = patchRegistryCommit(owners.registry, (workspaceId, workspace, origin, delegate) => (
        delegate(workspaceId, workspace, origin)
      ));
      try {
        const result = await executeBulkTransformApplyReceipt(
          dependencies(owners, projections, store),
          makeInput(owners, 'bulk-apply.fault.authoritative-reopen'),
        );
        const receipt = result.receipt === undefined ? undefined : receiptReadback(owners.store, result.receipt.id);
        const recovery = result.receipt === undefined ? undefined : owners.recoveryStore.read(result.receipt.id);
        return result.ok === false
          && result.code === 'BULK_APPLY_RECEIPT_REOPEN_FAILED'
          && !result.replayed
          && result.receipt !== undefined
          && receipt !== undefined
          && receipt.status === 'committed'
          && receipt.id === result.receipt.id
          && receipt.hash === result.receipt.hash
          && receipt.status === result.receipt.status
          && forwardCommitCount(commit.calls) === 1
          && recovery !== undefined
          && recovery.ok
          && recovery.record.status === 'ready'
          && receiptFileCount(owners.store) === 1
          && recoveryEntryCount(owners.recoveryStore) === 1
          && projections.length === 1
          && sameJson(projections[0], result.receipt);
      } finally {
        commit.restore();
      }
    });

    await checkAsync(checks, 'projection_capture_failure_is_fail_soft_after_terminal_truth', async () => {
      const owners = makeOwners(root, 'fault-projection-capture');
      let attempts = 0;
      const captureFailureDependencies: BulkTransformApplyReceiptAdapterDependencies = {
        registry: owners.registry,
        store: owners.store,
        recoveryStore: owners.recoveryStore,
        receiptService: owners.receiptService,
        captureProjection: () => {
          attempts += 1;
          throw new Error(`${RAW_NATIVE_ERROR_MARKER} ${RAW_TOKEN} ${RAW_HOST_PATH}`);
        },
      };
      const result = await executeBulkTransformApplyReceipt(
        captureFailureDependencies,
        makeInput(owners, 'bulk-apply.fault.projection-capture'),
      );
      const receipt = terminalReceipt(result, owners.store);
      const recovery = result.ok ? owners.recoveryStore.read(result.receipt.id) : undefined;
      return result.ok
        && result.applied
        && !result.replayed
        && receipt !== undefined
        && receipt.status === 'committed'
        && attempts === 1
        && recovery !== undefined
        && recovery.ok
        && recovery.record.status === 'ready'
        && receiptFileCount(owners.store) === 1
        && recoveryEntryCount(owners.recoveryStore) === 1;
    });

    await checkAsync(checks, 'same_workspace_concurrency_serializes_stale_applies', async () => {
      const owners = makeOwners(root, 'concurrency');
      const inputA = makeInput(owners, 'bulk-apply.concurrent.a');
      const inputB = makeInput(owners, 'bulk-apply.concurrent.b');
      const before = workspaceState(owners);
      const commit = patchRegistryCommit(owners.registry, (workspaceId, workspace, origin, delegate) => (
        delegate(workspaceId, workspace, origin)
      ));
      try {
        const [first, second] = await Promise.all([
          executeBulkTransformApplyReceipt(dependencies(owners), inputA),
          executeBulkTransformApplyReceipt(dependencies(owners), inputB),
        ]);
        const results = [first, second];
        const winner = results.find(
          (result): result is Extract<BulkTransformApplyReceiptAdapterResult, { ok: true }> => result.ok === true,
        );
        const loser = results.find(
          (result): result is Extract<BulkTransformApplyReceiptAdapterResult, { ok: false }> => result.ok === false,
        );
        if (winner === undefined || loser === undefined) return false;
        const loserReceipt = terminalReceipt(loser, owners.store);
        const current = workspaceState(owners);
        return winner.applied
          && !winner.replayed
          && !loser.replayed
          && loser.code === 'BULK_APPLY_BOUNDARY_FACTS_CHANGED'
          && loser.receipt !== undefined
          && loserReceipt !== undefined
          && loserReceipt.status === 'failed'
          && current.version === before.version + 1
          && forwardCommitCount(commit.calls) === 1
          && commit.calls.length === 1
          && receiptFileCount(owners.store) === 2
          && recoveryEntryCount(owners.recoveryStore) === 1
          && results.every(result => result.receipt !== undefined);
      } finally {
        commit.restore();
      }
    });

    await checkAsync(checks, 'receipts_projections_failures_are_redacted_and_scopes_are_isolated', async () => {
      const ownerA = makeOwners(root, 'isolation-a');
      const ownerB = makeOwners(root, 'isolation-b');
      const markers = rawMarkers(root);
      const projectionsA: unknown[] = [];
      const first = await executeBulkTransformApplyReceipt(
        dependencies(ownerA, projectionsA),
        makeInput(ownerA, 'bulk-apply.isolation'),
      );
      if (!first.ok) return false;
      const ownerBStoreBefore = directoryDigest(ownerB.store.root);
      const ownerBRecoveryBefore = directoryDigest(ownerB.recoveryStore.root);
      const ownerBRegistryBefore = directoryDigest(ownerB.registry.root);
      const failure = await executeBulkTransformApplyReceipt(
        dependencies(ownerA, projectionsA),
        makeInput(ownerA, 'bulk-apply.isolation', {
          rule: cloneJson({ ...BASE_RULE, operand: 4 }),
          expectedPlanHash: 'f'.repeat(64),
        }),
      );
      const second = await executeBulkTransformApplyReceipt(
        dependencies(ownerB),
        makeInput(ownerB, 'bulk-apply.isolation'),
      );
      const firstReceipt = terminalReceipt(first, ownerA.store);
      const secondReceipt = terminalReceipt(second, ownerB.store);
      return second.ok
        && firstReceipt !== undefined
        && secondReceipt !== undefined
        && redacted(firstReceipt, markers)
        && redacted(secondReceipt, markers)
        && redacted(first.receipt, markers)
        && redacted(second.receipt, markers)
        && redacted(failure, markers)
        && redacted(projectionsA, markers)
        && allStoredReceiptBytesRedacted(ownerA.store, markers)
        && allStoredReceiptBytesRedacted(ownerB.store, markers)
        && directoryDigest(ownerB.store.root) !== ownerBStoreBefore
        && directoryDigest(ownerB.recoveryStore.root) !== ownerBRecoveryBefore
        && directoryDigest(ownerB.registry.root) !== ownerBRegistryBefore
        && receiptFileCount(ownerA.store) === 1
        && receiptFileCount(ownerB.store) === 1
        && recoveryEntryCount(ownerA.recoveryStore) === 1
        && recoveryEntryCount(ownerB.recoveryStore) === 1
        && path.relative(root, ownerA.store.root).startsWith('isolation-a')
        && path.relative(root, ownerB.store.root).startsWith('isolation-b')
        && ownerA.store.root !== ownerB.store.root
        && ownerA.recoveryStore.root !== ownerB.recoveryStore.root
        && failure.ok === false
        && failure.code === 'ACTION_RECEIPT_DUPLICATE_CONFLICT';
    });

  } finally {
    let cleanupError: unknown;
    try {
      fs.rmSync(root, { recursive: true, force: true });
    } catch (error) {
      cleanupError = error;
    }
    cleanupPass = !fs.existsSync(root);
    checks.push({
      name: 'temporary_root_is_removed',
      pass: cleanupPass,
      ...(cleanupError === undefined ? {} : {
        detail: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
      }),
    });
  }

  return summarize(checks);
}

const invokedDirectly = path.basename(process.argv[1] ?? '') === 'bulkTransformApplyReceiptAdapter.selftest.ts';
if (invokedDirectly) {
  void runBulkTransformApplyReceiptAdapterSelftest().then(result => {
    for (const item of result.checks) {
      const detail = item.detail === undefined ? '' : `: ${item.detail}`;
      console.log(`${item.pass ? 'PASS' : 'FAIL'} ${item.name}${detail}`);
    }
    console.log(`SUMMARY ${result.passed}/${result.total} passed`);
    if (!result.allPassed) process.exitCode = 1;
  }).catch(error => {
    console.error(`FAIL bulk-transform-apply-receipt-adapter-selftest: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
