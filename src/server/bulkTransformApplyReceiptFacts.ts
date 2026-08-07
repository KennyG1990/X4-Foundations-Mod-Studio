/**
 * Pure W3B1a preparation for one bulk-transform apply operation.
 *
 * This module validates intent, rebuilds the approved plan, derives the complete target
 * workspace, and emits only bounded hashes for receipt persistence. It deliberately performs
 * no I/O and has no receipt-store, recovery, registry-service, serialization, or route-handler
 * dependency.
 */

import { createHash } from 'node:crypto';

import {
  mergeBulkTransformPatches,
  type BulkTransformPlan,
  type BulkTransformRule,
} from '../lib/bulkCorpusTransform';
import {
  combineReceiptResourceBeforeHashes,
  hashBoundedReceiptFacts,
  mapRuntimeReceiptIdentity,
  type RuntimeReceiptIdentity,
} from '../lib/actionReceiptRuntime';
import { workspaceReceiptResources } from '../lib/workspaceActionReceipt';
import type { WorkspaceRecord } from '../lib/workspaceRegistry';
import { sanitizeWorkspace, type ModWorkspace } from '../types';

const OPERATION_ID_RE = /^[a-zA-Z][a-zA-Z0-9._:-]{0,127}$/;
const WORKSPACE_ID_RE = /^ws_[a-f0-9]{24}$/i;
const FULL_HASH_RE = /^[a-f0-9]{64}$/;
const LEGACY_HASH_RE = /^[a-f0-9]{16}$/;

const ROUTE_KEY = 'POST /api/agent/bulk-transform/apply' as const;
const MODE = 'bulk-transform-apply' as const;

const MAX_CANDIDATE_COUNT = 500;
const MAX_OPERATIONS_PER_FILE = 16;
const MAX_ROW_COUNT = MAX_CANDIDATE_COUNT * MAX_OPERATIONS_PER_FILE;
const MAX_FINDING_COUNT = MAX_ROW_COUNT * 2;
const MAX_CORPUS_GENERATION_LENGTH = 4_096;
const MAX_TARGET_FILE_LENGTH = 4_096;
const MAX_SELECTOR_LENGTH = 16_384;
const MAX_SOURCE_SIGNATURE_LENGTH = 4_096;

const INPUT_KEYS = new Set([
  'operationId',
  'workspaceId',
  'identity',
  'rule',
  'expectedPlanHash',
  'expectedHead',
  'expectedSnapshotHash',
  'currentRecord',
  'currentSnapshotHash',
  'buildPlan',
]);

export type BulkTransformApplyPlanBuilder = (
  rule: BulkTransformRule,
  workspace: ModWorkspace,
) => BulkTransformPlan;

export interface BulkTransformApplyReceiptFactsInput {
  operationId: unknown;
  workspaceId: unknown;
  identity: unknown;
  rule: unknown;
  expectedPlanHash: unknown;
  expectedHead: unknown;
  expectedSnapshotHash: unknown;
  currentRecord: WorkspaceRecord;
  currentSnapshotHash: unknown;
  buildPlan: BulkTransformApplyPlanBuilder;
}

/** The only bulk-apply facts safe for durable receipt input. */
export interface BulkTransformApplyReceiptFacts {
  readonly routeKey: typeof ROUTE_KEY;
  readonly mode: typeof MODE;
  readonly operationId: string;
  readonly workspaceId: string;
  readonly expectedPlanHash: string;
  readonly expectedHead: string;
  readonly expectedSnapshotHash: string;
  readonly planHash: string;
  readonly ruleId: string;
  readonly corpusGenerationHash: string;
  readonly selectionHash: string;
  readonly sourceHash: string;
  readonly requestHash: string;
  readonly beforeHash: string;
  readonly proposedContentHash: string;
  readonly proposedSnapshotHash: string;
  readonly candidateCount: number;
  readonly matchedFiles: number;
  readonly rowCount: number;
  readonly changed: boolean;
}

export type BulkTransformApplySafeReceiptFacts = BulkTransformApplyReceiptFacts;

type WorkspaceReceiptResources = ReturnType<typeof workspaceReceiptResources>;

export interface BulkTransformApplyPreparedSuccess {
  readonly ok: true;
  readonly status: 'prepared';
  readonly identity: RuntimeReceiptIdentity;
  readonly plan: BulkTransformPlan;
  readonly beforeWorkspace: ModWorkspace;
  readonly nextWorkspace: ModWorkspace;
  readonly beforeResources: WorkspaceReceiptResources;
  readonly targetResources: WorkspaceReceiptResources;
  readonly receiptFacts: BulkTransformApplyReceiptFacts;
}

export type BulkTransformApplyFailureCode =
  | 'BULK_APPLY_RECEIPT_INPUT_INVALID'
  | 'BULK_APPLY_PLAN_CHANGED'
  | 'BULK_APPLY_PLAN_INVALID'
  | 'BULK_APPLY_HEAD_CONFLICT'
  | 'BULK_APPLY_SNAPSHOT_CONFLICT'
  | 'BULK_APPLY_PREPARE_FAILED';

export interface BulkTransformApplyFailure {
  readonly ok: false;
  readonly status: 'failed';
  readonly code: BulkTransformApplyFailureCode;
  readonly error: string;
}

export type BulkTransformApplyReceiptFactsResult =
  | BulkTransformApplyPreparedSuccess
  | BulkTransformApplyFailure;

type PlainRecord = Record<string, unknown>;

interface NormalizedInput {
  operationId: string;
  workspaceId: string;
  identity: RuntimeReceiptIdentity;
  rule: unknown;
  expectedPlanHash: string;
  expectedHead: string;
  expectedSnapshotHash: string;
  currentHead: string;
  currentWorkspace: PlainRecord;
  currentSnapshotHash: string;
  buildPlan: BulkTransformApplyPlanBuilder;
}

const FAILURE_MESSAGES: Readonly<Record<BulkTransformApplyFailureCode, string>> = {
  BULK_APPLY_RECEIPT_INPUT_INVALID: 'Bulk-transform apply receipt input was refused.',
  BULK_APPLY_PLAN_CHANGED: 'The approved bulk-transform plan no longer matches.',
  BULK_APPLY_PLAN_INVALID: 'The rebuilt bulk-transform plan was refused.',
  BULK_APPLY_HEAD_CONFLICT: 'The workspace content head changed before bulk apply.',
  BULK_APPLY_SNAPSHOT_CONFLICT: 'The workspace snapshot changed before bulk apply.',
  BULK_APPLY_PREPARE_FAILED: 'Bulk-transform apply preparation failed.',
};

function failure(code: BulkTransformApplyFailureCode): BulkTransformApplyFailure {
  return Object.freeze({
    ok: false,
    status: 'failed',
    code,
    error: FAILURE_MESSAGES[code],
  });
}

function isPlainObject(value: unknown): value is PlainRecord {
  if (value === null || typeof value !== 'object') return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function strictInputRecord(value: unknown): PlainRecord | undefined {
  if (!isPlainObject(value) || Object.getOwnPropertySymbols(value).length !== 0) return undefined;
  const names = Object.getOwnPropertyNames(value);
  const keys = Object.keys(value);
  if (names.length !== INPUT_KEYS.size || keys.length !== INPUT_KEYS.size) return undefined;
  if (keys.some(key => !INPUT_KEYS.has(key))) return undefined;
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) return undefined;
  }
  return value;
}

function ownDataValue(value: PlainRecord, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) {
    throw new Error('invalid data property');
  }
  return descriptor.value;
}

function validText(value: unknown, pattern: RegExp): value is string {
  return typeof value === 'string' && pattern.test(value);
}

function deterministicWorkspaceCandidate(value: unknown): value is PlainRecord {
  if (!isPlainObject(value)) return false;
  const id = ownDataValue(value, 'id');
  const nodes = ownDataValue(value, 'nodes');
  if (typeof id !== 'string' || id.length === 0 || !Array.isArray(nodes)) return false;
  return nodes.every(node => {
    if (!isPlainObject(node)) return false;
    const nodeId = ownDataValue(node, 'id');
    return typeof nodeId === 'string' && nodeId.length > 0;
  });
}

function normalizeInput(input: BulkTransformApplyReceiptFactsInput): NormalizedInput {
  const value = strictInputRecord(input);
  if (!value) throw new Error('invalid input');

  const operationId = ownDataValue(value, 'operationId');
  const workspaceId = ownDataValue(value, 'workspaceId');
  const expectedPlanHash = ownDataValue(value, 'expectedPlanHash');
  const expectedHead = ownDataValue(value, 'expectedHead');
  const expectedSnapshotHash = ownDataValue(value, 'expectedSnapshotHash');
  const currentSnapshotHash = ownDataValue(value, 'currentSnapshotHash');
  const buildPlan = ownDataValue(value, 'buildPlan');

  if (!validText(operationId, OPERATION_ID_RE)) throw new Error('invalid operation id');
  if (!validText(workspaceId, WORKSPACE_ID_RE)) throw new Error('invalid workspace id');
  if (!validText(expectedPlanHash, FULL_HASH_RE)) throw new Error('invalid expected plan hash');
  if (!validText(expectedHead, LEGACY_HASH_RE)) throw new Error('invalid expected head');
  if (!validText(expectedSnapshotHash, LEGACY_HASH_RE)) throw new Error('invalid expected snapshot hash');
  if (!validText(currentSnapshotHash, LEGACY_HASH_RE)) throw new Error('invalid current snapshot hash');
  if (typeof buildPlan !== 'function') throw new Error('invalid plan builder');

  const currentRecord = ownDataValue(value, 'currentRecord');
  if (!isPlainObject(currentRecord)) throw new Error('invalid current record');
  const recordWorkspaceId = ownDataValue(currentRecord, 'workspaceId');
  const recordHead = ownDataValue(currentRecord, 'head');
  const currentWorkspace = ownDataValue(currentRecord, 'workspace');
  if (!validText(recordWorkspaceId, WORKSPACE_ID_RE) || recordWorkspaceId !== workspaceId) {
    throw new Error('invalid current record workspace');
  }
  if (!validText(recordHead, LEGACY_HASH_RE)) throw new Error('invalid current record head');
  if (!deterministicWorkspaceCandidate(currentWorkspace)) throw new Error('invalid current workspace');

  return {
    operationId,
    workspaceId,
    identity: mapRuntimeReceiptIdentity(ownDataValue(value, 'identity')),
    rule: ownDataValue(value, 'rule'),
    expectedPlanHash,
    expectedHead,
    expectedSnapshotHash,
    currentHead: recordHead,
    currentWorkspace,
    currentSnapshotHash,
    buildPlan: buildPlan as BulkTransformApplyPlanBuilder,
  };
}

function cloneJson<T>(value: T): T {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) throw new Error('value is not JSON-cloneable');
  return JSON.parse(serialized) as T;
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value as unknown as PlainRecord)) deepFreeze(child);
  return Object.freeze(value) as T;
}

function boundedInteger(value: unknown, maximum: number): value is number {
  return typeof value === 'number'
    && Number.isSafeInteger(value)
    && value >= 0
    && value <= maximum;
}

function boundedString(value: unknown, maximumLength: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= maximumLength;
}

function cleanFindings(value: unknown): boolean {
  if (!Array.isArray(value) || value.length > MAX_FINDING_COUNT) return false;
  return value.every(finding => {
    if (!isPlainObject(finding)) return false;
    const severity = finding.severity;
    return (severity === 'info' || severity === 'warning')
      && boundedString(finding.code, 256)
      && boundedString(finding.message, 16_384)
      && (finding.path === undefined || boundedString(finding.path, MAX_TARGET_FILE_LENGTH));
  });
}

function validPlan(plan: unknown): plan is BulkTransformPlan {
  if (!isPlainObject(plan)) return false;
  if (!validText(plan.planHash, FULL_HASH_RE) || !validText(plan.ruleId, FULL_HASH_RE)) return false;
  if (plan.ok !== true || !isPlainObject(plan.rule)) return false;
  if (!boundedString(plan.corpusGeneration, MAX_CORPUS_GENERATION_LENGTH)) return false;
  if (!boundedInteger(plan.candidateCount, MAX_CANDIDATE_COUNT)) return false;
  if (!boundedInteger(plan.matchedFiles, MAX_CANDIDATE_COUNT) || plan.matchedFiles === 0) return false;
  if (!boundedInteger(plan.skippedFiles, MAX_CANDIDATE_COUNT)) return false;
  if (!boundedInteger(plan.droppedCount, MAX_CANDIDATE_COUNT) || plan.droppedCount !== 0) return false;
  if (plan.matchedFiles > plan.candidateCount) return false;
  if (plan.matchedFiles + plan.skippedFiles !== plan.candidateCount) return false;
  if (!cleanFindings(plan.findings)) return false;
  if (!Array.isArray(plan.conflicts) || plan.conflicts.length !== 0) return false;

  if (!Array.isArray(plan.files) || plan.files.length !== plan.candidateCount) return false;
  let matchedFileCount = 0;
  let skippedFileCount = 0;
  for (const file of plan.files) {
    if (!isPlainObject(file) || !boundedString(file.targetFile, MAX_TARGET_FILE_LENGTH)) return false;
    if (file.status === 'matched') matchedFileCount += 1;
    else if (file.status === 'skipped') skippedFileCount += 1;
    else return false;
    if (!boundedInteger(file.matchCount, MAX_OPERATIONS_PER_FILE)) return false;
    if (!cleanFindings(file.findings)) return false;
  }
  if (matchedFileCount !== plan.matchedFiles || skippedFileCount !== plan.skippedFiles) return false;

  if (!Array.isArray(plan.rows) || plan.rows.length === 0 || plan.rows.length > MAX_ROW_COUNT) return false;
  if (plan.rows.length < plan.matchedFiles || plan.rows.length > plan.matchedFiles * MAX_OPERATIONS_PER_FILE) {
    return false;
  }
  for (const row of plan.rows) {
    if (!isPlainObject(row)) return false;
    if (!boundedString(row.targetFile, MAX_TARGET_FILE_LENGTH)) return false;
    if (!boundedString(row.selector, MAX_SELECTOR_LENGTH)) return false;
    if (!boundedString(row.sourceSignature, MAX_SOURCE_SIGNATURE_LENGTH)) return false;
    if (row.simulationOk !== true || !cleanFindings(row.findings)) return false;
    if (!isPlainObject(row.patch)) return false;
    if (row.patch.action !== 'replace'
      || row.patch.targetFile !== row.targetFile
      || row.patch.sel !== row.selector
      || row.patch.sourceSignature !== row.sourceSignature
      || row.patch.generatedRuleId !== plan.ruleId
      || row.patch.generatedPlanHash !== plan.planHash) {
      return false;
    }
  }
  return true;
}

function sha256Text(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function hashParts(domain: string, parts: readonly string[]): string {
  const hash = createHash('sha256');
  const writePart = (part: string) => {
    hash.update(String(Buffer.byteLength(part, 'utf8')), 'utf8');
    hash.update(':', 'utf8');
    hash.update(part, 'utf8');
  };
  writePart(domain);
  for (const part of parts) writePart(part);
  return hash.digest('hex');
}

function planSourceFacts(plan: BulkTransformPlan): {
  corpusGenerationHash: string;
  selectionHash: string;
  sourceHash: string;
} {
  const selectionRowHashes: string[] = [];
  const sourceRowHashes: string[] = [];
  for (const row of plan.rows) {
    const targetFileHash = sha256Text(row.targetFile);
    const selectorHash = sha256Text(row.selector);
    const sourceSignatureHash = sha256Text(row.sourceSignature);
    selectionRowHashes.push(hashParts('bulk-transform-selection-row-v1', [targetFileHash, selectorHash]));
    sourceRowHashes.push(hashParts(
      'bulk-transform-source-row-v1',
      [targetFileHash, selectorHash, sourceSignatureHash],
    ));
  }

  const corpusGenerationHash = sha256Text(plan.corpusGeneration);
  const selectionHash = hashParts(
    'bulk-transform-selection-v1',
    [String(plan.rows.length), ...selectionRowHashes],
  );
  const sourceHash = hashParts('bulk-transform-source-v1', [
    plan.planHash,
    plan.ruleId,
    corpusGenerationHash,
    selectionHash,
    String(plan.candidateCount),
    String(plan.matchedFiles),
    String(plan.rows.length),
    ...sourceRowHashes,
  ]);
  return { corpusGenerationHash, selectionHash, sourceHash };
}

function resourceHash(
  resources: WorkspaceReceiptResources,
  role: 'workspace' | 'snapshot',
): string {
  const matching = resources.filter(resource => resource.role === role);
  const hash = matching[0]?.beforeHash;
  if (matching.length !== 1 || !validText(hash, FULL_HASH_RE)) {
    throw new Error('invalid workspace receipt resource');
  }
  return hash;
}

function resourcesChanged(
  beforeResources: WorkspaceReceiptResources,
  targetResources: WorkspaceReceiptResources,
): boolean {
  if (beforeResources.length !== targetResources.length) return true;
  return beforeResources.some((before, index) => {
    const target = targetResources[index];
    return !target
      || before.role !== target.role
      || before.root !== target.root
      || before.relativePath !== target.relativePath
      || before.beforeHash !== target.beforeHash;
  });
}

/**
 * Prepare one deterministic bulk-apply execution and its redacted receipt facts.
 *
 * The injected builder is invoked exactly once after identity and paired-CAS validation. Raw
 * rule and plan source strings remain transient and are never copied into `receiptFacts`.
 */
export function prepareBulkTransformApplyReceiptFacts(
  input: BulkTransformApplyReceiptFactsInput,
): BulkTransformApplyReceiptFactsResult {
  let normalized: NormalizedInput;
  try {
    normalized = normalizeInput(input);
  } catch {
    return failure('BULK_APPLY_RECEIPT_INPUT_INVALID');
  }

  if (normalized.expectedHead !== normalized.currentHead) return failure('BULK_APPLY_HEAD_CONFLICT');
  if (normalized.expectedSnapshotHash !== normalized.currentSnapshotHash) {
    return failure('BULK_APPLY_SNAPSHOT_CONFLICT');
  }

  let beforeWorkspace: ModWorkspace;
  try {
    beforeWorkspace = deepFreeze(cloneJson(sanitizeWorkspace(cloneJson(normalized.currentWorkspace))));
  } catch {
    return failure('BULK_APPLY_PREPARE_FAILED');
  }

  let builtPlan: BulkTransformPlan;
  try {
    builtPlan = normalized.buildPlan(normalized.rule as BulkTransformRule, beforeWorkspace);
  } catch {
    return failure('BULK_APPLY_PREPARE_FAILED');
  }

  let plan: BulkTransformPlan;
  try {
    plan = cloneJson(builtPlan);
  } catch {
    return failure('BULK_APPLY_PLAN_INVALID');
  }
  if (!validPlan(plan)) return failure('BULK_APPLY_PLAN_INVALID');
  if (plan.planHash !== normalized.expectedPlanHash) return failure('BULK_APPLY_PLAN_CHANGED');
  deepFreeze(plan);

  try {
    const xmlPatches = mergeBulkTransformPatches(beforeWorkspace.xmlPatches || [], plan);
    const nextWorkspace = deepFreeze(cloneJson(sanitizeWorkspace({ ...beforeWorkspace, xmlPatches })));
    const beforeResources = workspaceReceiptResources(normalized.workspaceId, beforeWorkspace);
    const targetResources = workspaceReceiptResources(normalized.workspaceId, nextWorkspace);
    const beforeHash = combineReceiptResourceBeforeHashes(beforeResources);
    const proposedContentHash = resourceHash(targetResources, 'workspace');
    const proposedSnapshotHash = resourceHash(targetResources, 'snapshot');
    const changed = resourcesChanged(beforeResources, targetResources);
    const sourceFacts = planSourceFacts(plan);

    const requestFactsCandidate: Omit<BulkTransformApplyReceiptFacts, 'requestHash'> = {
      routeKey: ROUTE_KEY,
      mode: MODE,
      operationId: normalized.operationId,
      workspaceId: normalized.workspaceId,
      expectedPlanHash: normalized.expectedPlanHash,
      expectedHead: normalized.expectedHead,
      expectedSnapshotHash: normalized.expectedSnapshotHash,
      planHash: plan.planHash,
      ruleId: plan.ruleId,
      corpusGenerationHash: sourceFacts.corpusGenerationHash,
      selectionHash: sourceFacts.selectionHash,
      sourceHash: sourceFacts.sourceHash,
      beforeHash,
      proposedContentHash,
      proposedSnapshotHash,
      candidateCount: plan.candidateCount,
      matchedFiles: plan.matchedFiles,
      rowCount: plan.rows.length,
      changed,
    };
    const receiptFacts = deepFreeze({
      ...requestFactsCandidate,
      requestHash: hashBoundedReceiptFacts(requestFactsCandidate),
    });

    return deepFreeze({
      ok: true,
      status: 'prepared',
      identity: cloneJson(normalized.identity),
      plan,
      beforeWorkspace,
      nextWorkspace,
      beforeResources: cloneJson(beforeResources),
      targetResources: cloneJson(targetResources),
      receiptFacts,
    });
  } catch {
    return failure('BULK_APPLY_PREPARE_FAILED');
  }
}
