import {
  createBulkTransformPlan,
  mergeBulkTransformPatches,
  type BulkTransformPlan,
  type BulkTransformRule,
} from '../lib/bulkCorpusTransform';
import type { EffectiveReferenceDocument } from '../lib/referenceOverlay';
import {
  prepareBulkTransformApplyReceiptFacts,
  type BulkTransformApplyPlanBuilder,
  type BulkTransformApplyReceiptFactsResult,
} from './bulkTransformApplyReceiptFacts';
import { workspaceContentHash, workspaceSnapshotHash } from '../lib/workspaceIdentity';
import type { WorkspaceRecord } from '../lib/workspaceRegistry';
import { sanitizeWorkspace, type ModWorkspace, type PatchBlock } from '../types';

const WORKSPACE_ID = 'ws_0123456789abcdef01234567';
const OPERATION_ID = 'bulk-apply-selftest-operation';
const RAW_CORPUS_GENERATION = 'raw-corpus-generation-marker-b1';
const RAW_TARGET_ROOT = 'assets/raw-target-path-marker-b1';
const RAW_SELECTOR = '/macros/macro/properties/hull/@raw_selector_marker_b1';
const RAW_SOURCE_A = 'raw-source-signature-marker-b1-a';
const RAW_SOURCE_B = 'raw-source-signature-marker-b1-b';
const RAW_RULE_ID = 'raw-rule-identity-marker-b1';
const RAW_XML = 'raw-xml-marker-b1';
const RAW_WORKSPACE_MARKER = 'raw-workspace-content-marker-b1';
const RAW_ABSOLUTE_PATH = 'C:\\raw\\bulk-apply-selftest-marker-b1.xml';
const RAW_TOKEN = 'x4fk_bulk_apply_selftest_token_marker_b1';
const RAW_BEARER = 'Bearer bulk-apply-selftest-token-marker-b1';

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
    content: `<macros><macro name="${RAW_XML}"><properties><hull raw_selector_marker_b1="10"/></properties></macro></macros>`,
    sources: [{ source: 'base', path: `${RAW_TARGET_ROOT}/a.xml`, mode: 'base' }],
    findings: [],
    signature: RAW_SOURCE_A,
  },
  {
    available: true,
    root: 'selftest-fixture',
    relativePath: `${RAW_TARGET_ROOT}/b.xml`,
    content: `<macros><macro name="${RAW_XML}"><properties><hull raw_selector_marker_b1="20"/></properties></macro></macros>`,
    sources: [{ source: 'base', path: `${RAW_TARGET_ROOT}/b.xml`, mode: 'base' }],
    findings: [],
    signature: RAW_SOURCE_B,
  },
];

const MANUAL_PATCH: PatchBlock = {
  id: 'manual-selftest-marker-b1',
  sel: `/manual/${RAW_WORKSPACE_MARKER}`,
  action: 'replace',
  content: RAW_XML,
  note: RAW_WORKSPACE_MARKER,
  targetFile: `${RAW_TARGET_ROOT}/manual.xml`,
  includeInBuild: true,
};

const BASE_WORKSPACE: ModWorkspace = sanitizeWorkspace({
  id: 'workspace-local-selftest-marker-b1',
  name: 'Bulk Apply Receipt Selftest',
  version: '1.0.0',
  author: 'selftest',
  description: 'deterministic raw marker fixture',
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
  mdOriginal: { path: RAW_ABSOLUTE_PATH, content: RAW_XML },
  contentOriginal: RAW_XML,
  xmlPatches: [MANUAL_PATCH],
});

const BASE_HEAD = workspaceContentHash(BASE_WORKSPACE);
const BASE_SNAPSHOT = workspaceSnapshotHash(BASE_WORKSPACE);
const BASE_IDENTITY = {
  kind: 'agent',
  keyId: 'key_bulk_apply_selftest',
  clientId: 'agent_bulk_apply_selftest',
  version: '1.0.0',
};

const CHECK_NAMES = [
  'changed_success_and_builder_called_once',
  'exact_deterministic_repeat',
  'no_change_with_existing_owned_patches',
  'receipt_facts_have_exact_safe_keys_and_hash_types',
  'raw_markers_absent_from_receipt_facts_and_failures',
  'returned_values_are_cloned_and_frozen',
  'malformed_exact_key_input_is_refused_without_builder',
  'invalid_identity_is_refused_without_builder',
  'stale_head_is_refused_without_builder',
  'stale_snapshot_is_refused_without_builder',
  'changed_plan_is_refused_after_one_builder_call',
  'builder_throw_is_prepare_failed_after_one_call',
] as const;

interface SelftestCheck {
  name: string;
  pass: boolean;
}

export interface BulkTransformApplyReceiptFactsSelftestResult {
  pass: boolean;
  allPassed: boolean;
  passed: number;
  total: number;
  checks: SelftestCheck[];
}

interface BuilderSpy {
  calls: number;
  frozenWorkspace: boolean;
  mutationBlocked: boolean;
  build: BulkTransformApplyPlanBuilder;
}

interface Invocation {
  threw: boolean;
  result?: BulkTransformApplyReceiptFactsResult;
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function fixturePlan(rule: BulkTransformRule, corpusGeneration = RAW_CORPUS_GENERATION): BulkTransformPlan {
  const documents = new Map(BASE_DOCUMENTS.map(document => [document.relativePath, document]));
  return createBulkTransformPlan({
    rule,
    logicalPaths: BASE_DOCUMENTS.map(document => document.relativePath),
    corpusGeneration,
    resolve: logicalPath => {
      const document = documents.get(logicalPath);
      if (!document) throw new Error('fixture document missing');
      return document;
    },
  });
}

const BASE_PLAN = fixturePlan(BASE_RULE);
const RAW_RULE_JSON = JSON.stringify(BASE_RULE);

function makeRecord(workspace: ModWorkspace): WorkspaceRecord {
  return {
    schema: 1,
    workspaceId: WORKSPACE_ID,
    head: workspaceContentHash(workspace),
    workspace,
    version: 1,
    savedAt: '2026-08-06T12:00:00.000Z',
    origin: 'selftest:bulk-transform',
    createdAt: '2026-08-06T11:00:00.000Z',
  };
}

function makeBuilder(options: { corpusGeneration?: string; throws?: boolean } = {}): BuilderSpy {
  const spy: BuilderSpy = {
    calls: 0,
    frozenWorkspace: false,
    mutationBlocked: false,
    build: (_rule, _workspace) => BASE_PLAN,
  };
  spy.build = (rule, workspace) => {
    spy.calls += 1;
    spy.frozenWorkspace = Object.isFrozen(workspace) && Object.isFrozen(workspace.nodes);
    const originalName = workspace.name;
    try {
      workspace.name = RAW_WORKSPACE_MARKER;
    } catch {
      // The helper is expected to freeze the builder boundary.
    }
    spy.mutationBlocked = workspace.name === originalName;
    if (options.throws) throw new Error(`${RAW_RULE_JSON} ${RAW_XML} ${RAW_ABSOLUTE_PATH} ${RAW_TOKEN} ${RAW_BEARER}`);
    return fixturePlan(rule, options.corpusGeneration);
  };
  return spy;
}

function makeInput(
  builder: BuilderSpy,
  workspace = BASE_WORKSPACE,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  const inputWorkspace = cloneJson(workspace);
  const currentRecord = makeRecord(inputWorkspace);
  const snapshotHash = workspaceSnapshotHash(inputWorkspace);
  return {
    operationId: OPERATION_ID,
    workspaceId: WORKSPACE_ID,
    identity: cloneJson(BASE_IDENTITY),
    rule: cloneJson(BASE_RULE),
    expectedPlanHash: BASE_PLAN.planHash,
    expectedHead: currentRecord.head,
    expectedSnapshotHash: snapshotHash,
    currentRecord,
    currentSnapshotHash: snapshotHash,
    buildPlan: builder.build,
    ...overrides,
  };
}

function invoke(input: unknown): Invocation {
  try {
    return { threw: false, result: prepareBulkTransformApplyReceiptFacts(input as never) };
  } catch {
    return { threw: true };
  }
}

function isFailure(invocation: Invocation, code: string): boolean {
  return !invocation.threw
    && invocation.result?.ok === false
    && invocation.result.code === code;
}

function prepared(invocation: Invocation): Extract<BulkTransformApplyReceiptFactsResult, { ok: true }> | undefined {
  return !invocation.threw && invocation.result?.ok === true ? invocation.result : undefined;
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function tryMutate(action: () => void): void {
  try {
    action();
  } catch {
    // Frozen values are the expected result of the mutation attempt.
  }
}

function safeAgainstRawMarkers(value: unknown, markers: readonly string[]): boolean {
  let serialized: string;
  try {
    serialized = JSON.stringify(value);
  } catch {
    return false;
  }
  return markers.every(marker => !serialized.includes(marker))
    && !/[A-Za-z]:[\\/]/.test(serialized)
    && !/x4fk_|bearer\s+/i.test(serialized);
}

function legacyDifferent(value: string): string {
  return value === '0'.repeat(16) ? '1'.repeat(16) : '0'.repeat(16);
}

function summarize(checks: SelftestCheck[]): BulkTransformApplyReceiptFactsSelftestResult {
  const passed = checks.filter(check => check.pass).length;
  const allPassed = passed === checks.length;
  return { pass: allPassed, allPassed, passed, total: checks.length, checks };
}

function fallbackResult(): BulkTransformApplyReceiptFactsSelftestResult {
  return summarize(CHECK_NAMES.map(name => ({ name, pass: false })));
}

function runInternal(): BulkTransformApplyReceiptFactsSelftestResult {
  const checks: SelftestCheck[] = [];
  const check = (name: string, pass: boolean): void => {
    checks.push({ name, pass: !!pass });
  };
  const rawMarkers = [
    RAW_CORPUS_GENERATION,
    RAW_TARGET_ROOT,
    RAW_SELECTOR,
    RAW_SOURCE_A,
    RAW_SOURCE_B,
    RAW_RULE_ID,
    RAW_XML,
    RAW_WORKSPACE_MARKER,
    RAW_ABSOLUTE_PATH,
    RAW_TOKEN,
    RAW_BEARER,
    RAW_RULE_JSON,
  ];

  const firstBuilder = makeBuilder();
  const firstInput = makeInput(firstBuilder);
  const firstInvocation = invoke(firstInput);
  const first = prepared(firstInvocation);

  const repeatBuilderA = makeBuilder();
  const repeatBuilderB = makeBuilder();
  const repeatA = invoke(makeInput(repeatBuilderA));
  const repeatB = invoke(makeInput(repeatBuilderB));
  const repeatPreparedA = prepared(repeatA);
  const repeatPreparedB = prepared(repeatB);

  const ownedPatchesWorkspace = sanitizeWorkspace({
    ...BASE_WORKSPACE,
    xmlPatches: [
      ...(BASE_WORKSPACE.xmlPatches || []).map(patch => cloneJson(patch)),
      ...BASE_PLAN.rows.map(row => cloneJson(row.patch)),
    ],
  });
  const noChangeBuilder = makeBuilder();
  const noChangeInvocation = invoke(makeInput(noChangeBuilder, ownedPatchesWorkspace));
  const noChange = prepared(noChangeInvocation);

  const driftBuilder = makeBuilder({ corpusGeneration: `${RAW_CORPUS_GENERATION}-drift` });
  const driftInvocation = invoke(makeInput(driftBuilder));

  const throwingBuilder = makeBuilder({ throws: true });
  const throwingInvocation = invoke(makeInput(throwingBuilder));

  check('changed_success_and_builder_called_once', !!first
    && firstInvocation.threw === false
    && first.receiptFacts.changed === true
    && firstBuilder.calls === 1
    && firstBuilder.frozenWorkspace
    && firstBuilder.mutationBlocked
    && sameJson(
      first.nextWorkspace,
      sanitizeWorkspace({
        ...first.beforeWorkspace,
        xmlPatches: mergeBulkTransformPatches(first.beforeWorkspace.xmlPatches || [], first.plan),
      }),
    ));

  check('exact_deterministic_repeat', !!repeatPreparedA && !!repeatPreparedB
    && repeatA.threw === false
    && repeatB.threw === false
    && repeatBuilderA.calls === 1
    && repeatBuilderB.calls === 1
    && sameJson(repeatPreparedA, repeatPreparedB)
    && sameJson(first, repeatPreparedA));

  check('no_change_with_existing_owned_patches', !!noChange
    && noChangeInvocation.threw === false
    && noChange.receiptFacts.changed === false
    && noChangeBuilder.calls === 1
    && sameJson(noChange.beforeWorkspace, noChange.nextWorkspace)
    && sameJson(noChange.beforeResources, noChange.targetResources)
    && sameJson(
      noChange.nextWorkspace.xmlPatches,
      mergeBulkTransformPatches(noChange.beforeWorkspace.xmlPatches || [], noChange.plan),
    ));

  const facts = first?.receiptFacts;
  const factKeys = [
    'beforeHash', 'candidateCount', 'changed', 'corpusGenerationHash', 'expectedHead',
    'expectedPlanHash', 'expectedSnapshotHash', 'matchedFiles', 'mode', 'operationId',
    'planHash', 'proposedContentHash', 'proposedSnapshotHash', 'requestHash', 'routeKey',
    'rowCount', 'ruleId', 'selectionHash', 'sourceHash', 'workspaceId',
  ].sort();
  const hashKeys = [
    'beforeHash', 'corpusGenerationHash', 'planHash', 'proposedContentHash',
    'proposedSnapshotHash', 'requestHash', 'ruleId', 'selectionHash', 'sourceHash',
  ];
  const stringKeys = [
    'beforeHash', 'corpusGenerationHash', 'expectedHead', 'expectedPlanHash',
    'expectedSnapshotHash', 'mode', 'operationId', 'planHash', 'proposedContentHash',
    'proposedSnapshotHash', 'requestHash', 'routeKey', 'ruleId', 'selectionHash',
    'sourceHash', 'workspaceId',
  ];
  const numberKeys = ['candidateCount', 'matchedFiles', 'rowCount'];
  check('receipt_facts_have_exact_safe_keys_and_hash_types', !!facts
    && sameJson(Object.keys(facts).sort(), factKeys)
    && stringKeys.every(key => typeof facts[key as keyof typeof facts] === 'string')
    && numberKeys.every(key => typeof facts[key as keyof typeof facts] === 'number')
    && typeof facts.changed === 'boolean'
    && hashKeys.every(key => /^[a-f0-9]{64}$/.test(String(facts[key as keyof typeof facts])))
    && first?.beforeResources.length === 2
    && first.targetResources.length === 2
    && [...first.beforeResources, ...first.targetResources].every(resource => /^[a-f0-9]{64}$/.test(resource.beforeHash || ''))
    && [...first.beforeResources, ...first.targetResources].every(resource => resource.root === 'workspace'));

  check('raw_markers_absent_from_receipt_facts_and_failures', !!facts
    && safeAgainstRawMarkers(facts, rawMarkers)
    && !!driftInvocation.result
    && safeAgainstRawMarkers(driftInvocation.result, rawMarkers)
    && !!throwingInvocation.result
    && safeAgainstRawMarkers(throwingInvocation.result, rawMarkers));

  let clonedAndFrozen = false;
  if (first) {
    const resultBeforeMutation = JSON.stringify(first);
    const callerRecord = firstInput.currentRecord as WorkspaceRecord;
    const callerRule = firstInput.rule as BulkTransformRule;
    tryMutate(() => { callerRecord.workspace.name = RAW_WORKSPACE_MARKER; });
    tryMutate(() => { callerRule.operand = 999; });
    tryMutate(() => { first.plan.rule.operand = 999; });
    tryMutate(() => { first.beforeWorkspace.name = RAW_WORKSPACE_MARKER; });
    tryMutate(() => { first.nextWorkspace.xmlPatches?.push(MANUAL_PATCH); });
    tryMutate(() => { first.beforeResources.push(first.beforeResources[0]); });
    tryMutate(() => {
      (first.receiptFacts as unknown as Record<string, unknown>).operationId = RAW_OPERATION_ID_MUTATION;
    });
    clonedAndFrozen = JSON.stringify(first) === resultBeforeMutation
      && first.beforeWorkspace.name !== RAW_WORKSPACE_MARKER
      && first.plan.rule.operand === BASE_RULE.operand
      && Object.isFrozen(first)
      && Object.isFrozen(first.plan)
      && Object.isFrozen(first.beforeWorkspace)
      && Object.isFrozen(first.nextWorkspace)
      && Object.isFrozen(first.beforeResources)
      && Object.isFrozen(first.targetResources)
      && Object.isFrozen(first.receiptFacts);
  }
  check('returned_values_are_cloned_and_frozen', clonedAndFrozen);

  const extraBuilder = makeBuilder();
  const extraInput = makeInput(extraBuilder);
  extraInput.extra = RAW_TOKEN;
  const missingBuilder = makeBuilder();
  const missingInput = makeInput(missingBuilder);
  delete missingInput.expectedPlanHash;
  const accessorBuilder = makeBuilder();
  const accessorInput = makeInput(accessorBuilder);
  Object.defineProperty(accessorInput, 'operationId', {
    configurable: true,
    enumerable: true,
    get: () => OPERATION_ID,
  });
  const symbolBuilder = makeBuilder();
  const symbolInput = makeInput(symbolBuilder);
  Object.defineProperty(symbolInput, Symbol('raw-input-marker'), { value: RAW_TOKEN });
  check('malformed_exact_key_input_is_refused_without_builder', [
    [invoke(extraInput), extraBuilder],
    [invoke(missingInput), missingBuilder],
    [invoke(accessorInput), accessorBuilder],
    [invoke(symbolInput), symbolBuilder],
  ].every(([invocation, builder]) => isFailure(invocation as Invocation, 'BULK_APPLY_RECEIPT_INPUT_INVALID')
    && (builder as BuilderSpy).calls === 0
    && !(invocation as Invocation).threw));

  const identityBuilder = makeBuilder();
  const identityInvocation = invoke(makeInput(identityBuilder, BASE_WORKSPACE, { identity: null }));
  check('invalid_identity_is_refused_without_builder', isFailure(identityInvocation, 'BULK_APPLY_RECEIPT_INPUT_INVALID')
    && identityBuilder.calls === 0
    && identityInvocation.threw === false);

  const staleHeadBuilder = makeBuilder();
  const staleHeadInvocation = invoke(makeInput(staleHeadBuilder, BASE_WORKSPACE, {
    expectedHead: legacyDifferent(BASE_HEAD),
  }));
  check('stale_head_is_refused_without_builder', isFailure(staleHeadInvocation, 'BULK_APPLY_HEAD_CONFLICT')
    && staleHeadBuilder.calls === 0
    && staleHeadInvocation.threw === false);

  const staleSnapshotBuilder = makeBuilder();
  const staleSnapshotInvocation = invoke(makeInput(staleSnapshotBuilder, BASE_WORKSPACE, {
    expectedSnapshotHash: legacyDifferent(BASE_SNAPSHOT),
  }));
  check('stale_snapshot_is_refused_without_builder', isFailure(staleSnapshotInvocation, 'BULK_APPLY_SNAPSHOT_CONFLICT')
    && staleSnapshotBuilder.calls === 0
    && staleSnapshotInvocation.threw === false);

  check('changed_plan_is_refused_after_one_builder_call', isFailure(driftInvocation, 'BULK_APPLY_PLAN_CHANGED')
    && driftBuilder.calls === 1
    && driftInvocation.threw === false);

  check('builder_throw_is_prepare_failed_after_one_call', isFailure(throwingInvocation, 'BULK_APPLY_PREPARE_FAILED')
    && throwingBuilder.calls === 1
    && throwingInvocation.threw === false);

  return summarize(checks);
}

const RAW_OPERATION_ID_MUTATION = 'raw-operation-id-mutation-marker-b1';

export function runBulkTransformApplyReceiptFactsSelftest(): BulkTransformApplyReceiptFactsSelftestResult {
  try {
    return runInternal();
  } catch {
    return fallbackResult();
  }
}

const invokedDirectly = process.argv[1]?.endsWith('bulkTransformApplyReceiptFacts.selftest.ts') === true;
if (invokedDirectly) {
  const result = runBulkTransformApplyReceiptFactsSelftest();
  for (const check of result.checks) console.log(`${check.pass ? 'PASS' : 'FAIL'} ${check.name}`);
  console.log(`SUMMARY ${result.passed}/${result.total} passed`);
  if (!result.allPassed) process.exitCode = 1;
}
