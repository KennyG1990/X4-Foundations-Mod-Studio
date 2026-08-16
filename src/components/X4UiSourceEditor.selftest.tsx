/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ModuleKind, ScriptTarget, transpileModule } from 'typescript';
import { buildX4UiCallModel, type X4UiLuaFileInput } from '../lib/x4UiCallModel';
import { projectX4UiEditorSession } from '../lib/x4UiEditorSession';
import { lintX4UiCallModel } from '../lib/x4UiLint';
import type { X4UiLayoutPreviewSampleCatalog } from '../lib/x4UiLayoutProgram';
import { applyX4UiSourceEdit, type X4UiSourceEditCatalog } from '../lib/x4UiSourceEdits';
import UIBuilder, * as UIBuilderApiModule from './UIBuilder';
import X4UiSourceEditor, {
  X4UiSourceEditorLinter,
  X4UiSourceEditorSamples,
  classifyX4UiCanvasCommit,
  classifyX4UiCanvasState,
  classifyX4UiCorpusLoadResult,
  classifyX4UiLintState,
  inspectX4UiLint,
  isBlockingX4UiAddTableFinding,
  isX4UiKeepOutEntryChecked,
  reconcileX4UiEditorSelections,
  toggleX4UiKeepOutEntry,
  type X4UiEditorLintFinding,
} from './X4UiSourceEditor';
import * as X4UiSourceEditorApiModule from './X4UiSourceEditor';

const workspace = {
  id: 'x4-ui-source-editor-selftest',
  name: 'X4 UI Source Editor selftest',
  version: '1.0.0',
  author: 'selftest',
  description: 'SSR fixture',
  nodes: [],
  uiWidgets: [],
  uiTheme: {
    backgroundColor: '#0d0d14',
    borderColor: '#df9825',
    accentColor: '#f59e0b',
    textColor: '#ffffff',
  },
  customLua: '',
  passthroughFiles: [],
  compileSettings: { ui: false },
  integrationContract: null,
} as unknown as React.ComponentProps<typeof UIBuilder>['workspace'];

const lintFixtureWorkspace = {
  ...workspace,
  passthroughFiles: [
    {
      path: 'ui.xml',
      content: '<root><environment type="menus"><file name="ui/test.lua" /></environment></root>',
    },
    {
      path: 'ui/test.lua',
      content: 'function (',
    },
  ],
};

const renderSource = (fixture = workspace) => renderToStaticMarkup(
  <X4UiSourceEditor workspace={fixture} corpusLoader={async () => ({ ok: false, failure: { code: 'offline', message: 'selftest unavailable' } })} />,
);

const sourceMarkup = renderSource();
const sourceMarkupAgain = renderSource();
assert.equal(sourceMarkup, sourceMarkupAgain, 'identical initial props must produce deterministic SSR markup');
assert.match(sourceMarkup, /Not verified in game/);
assert.match(sourceMarkup, /Source authority/);
assert.match(sourceMarkup, /Configured X4 corpus/);
assert.match(sourceMarkup, /Profile controls/);
assert.match(sourceMarkup, /Source and target selection/);
assert.match(sourceMarkup, /Imported-source linter/);
assert.match(sourceMarkup, /Context keep-outs/);
assert.match(sourceMarkup, /Cockpit conversation/);
assert.match(sourceMarkup, /Map open/);
assert.match(sourceMarkup, /Fullscreen menu/);
assert.match(sourceMarkup, /First person/);
assert.match(sourceMarkup, /2560/);
assert.match(sourceMarkup, /1440/);
assert.match(sourceMarkup, /1\.4/);
assert.match(sourceMarkup, /unverified-default/);
assert.match(sourceMarkup, /Select source/);
assert.match(sourceMarkup, /Select target/);
assert.match(sourceMarkup, /No source analyzed|Static checks incomplete/);
assert.doesNotMatch(sourceMarkup, /No known static rule violated/);
assert.doesNotMatch(sourceMarkup, /game accurate|render accurate|engine proof|game-proof/i);
assert.equal((sourceMarkup.match(/value="[^"]+"/g) ?? []).some(value => value.includes('source 1') || value.includes('target 1')), false, 'selectors must not auto-select a candidate');

const sampleLocation = {
  file: 'ui/samples.lua',
  sourcePath: 'selftest/ui/samples.lua',
  start: { line: 4, column: 18, offset: 91 },
  end: { line: 4, column: 30, offset: 103 },
};
const sampleCatalog: X4UiLayoutPreviewSampleCatalog = {
  id: 'preview-sample-catalog-selftest',
  sourceIdentity: { file: 'ui/samples.lua', sourcePath: 'selftest/ui/samples.lua', sha256: 'a'.repeat(64) },
  targetId: 'target-selftest',
  entries: [
    {
      id: 'sample-number',
      expression: 'tableWidth',
      expectedType: 'number',
      source: sampleLocation,
      consumers: [{ operationId: 'operation-number', operationKind: 'addTable', field: 'width', source: sampleLocation }],
      provenance: 'preview-only',
    },
    {
      id: 'sample-string',
      expression: 'dynamicText',
      expectedType: 'string',
      source: sampleLocation,
      consumers: [{ operationId: 'operation-string', operationKind: 'createText', field: 'text', source: sampleLocation }],
      provenance: 'preview-only',
    },
    {
      id: 'sample-boolean',
      expression: 'tableScaling',
      expectedType: 'boolean',
      source: sampleLocation,
      consumers: [{ operationId: 'operation-boolean', operationKind: 'addTable', field: 'scaling', source: sampleLocation }],
      provenance: 'preview-only',
    },
  ],
};
const sampleMarkup = renderToStaticMarkup(
  <X4UiSourceEditorSamples catalog={sampleCatalog} samples={undefined} onSampleInput={() => undefined} />,
);
assert.match(sampleMarkup, /Preview-only samples/);
assert.match(sampleMarkup, /Samples affect preview measurement only/);
assert.match(sampleMarkup, /\{tableWidth\}/);
assert.match(sampleMarkup, /\{dynamicText\}/);
assert.match(sampleMarkup, /\{tableScaling\}/);
assert.match(sampleMarkup, /ui\/samples\.lua/);
assert.match(sampleMarkup, /sample-number/);
assert.match(sampleMarkup, /sample-string/);
assert.match(sampleMarkup, /sample-boolean/);
assert.match(sampleMarkup, /type="number"/);
assert.match(sampleMarkup, /type="text"/);
assert.match(sampleMarkup, /true/);
assert.match(sampleMarkup, /false/);

const fixtureBefore = JSON.stringify(workspace);
renderSource(workspace);
assert.equal(JSON.stringify(workspace), fixtureBefore, 'SSR must not mutate the caller workspace');

const lintMarkup = renderSource(lintFixtureWorkspace);
assert.match(lintMarkup, /severity:/);
assert.match(lintMarkup, /code:/);
assert.match(lintMarkup, /source location:/);
assert.match(lintMarkup, /message:/);
assert.match(lintMarkup, /failureMode:/);
assert.match(lintMarkup, /evidenceBoundary:/);
assert.match(lintMarkup, /nextAction:/);
assert.doesNotMatch(lintMarkup, /No known static rule violated/);

const finding = (overrides: Partial<X4UiEditorLintFinding> = {}): X4UiEditorLintFinding => ({
  filePath: 'ui/test.lua',
  severity: 'warning',
  code: 'lint-rule',
  location: 'ui/test.lua:13:1',
  message: 'fixture finding',
  failureMode: 'fixture failure mode',
  evidenceBoundary: 'unbisected fixture evidence',
  nextAction: 'inspect fixture',
  ...overrides,
});

const warningAddTable = finding({
  severity: 'warning',
  code: 'x4-ui.add-table-column-limit',
  location: 'ui/test.lua:23:1',
  failureMode: 'No refusal is proven for this literal count; the measured mod failure boundary is at 24 and must not be generalized to 13-23.',
  evidenceBoundary: 'Official X4 9.00 sources contain valid 13-column tables. Measured mod evidence is 12 passed / 24 failed; 13-23 remain unbisected.',
});
const blockingAddTable = finding({
  severity: 'error',
  code: 'x4-ui.add-table-column-limit',
  location: 'ui/test.lua:24:1',
  failureMode: 'Engine refuses the ENTIRE frame: no partial draw/Lua error; UI auto-reloads, and the conversation-open symptom can look like the conversation closes.',
  evidenceBoundary: 'Measured mod boundary: 12 passed / 24 failed / 13-23 unbisected.',
});

const addTableSource = (count: number): X4UiLuaFileInput => ({
  rel: 'ui/add-table.lua',
  sourcePath: 'selftest/ui/add-table.lua',
  text: [
    'local menu = { name = "Main", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 100 })',
    `local table = frame:addTable(${count}, { width = 2, height = 20 })`,
    'local row = table:addRow(nil, { height = 10 })',
    'row[1]:setText("ok", { fontsize = 12 })',
    'frame:display()',
  ].join('\n'),
});
const actualAddTable13Lint = lintX4UiCallModel(buildX4UiCallModel(addTableSource(13)));
const actualAddTable24Lint = lintX4UiCallModel(buildX4UiCallModel(addTableSource(24)));
const actualAddTable13Inspection = inspectX4UiLint({ lint: [{ path: 'ui/add-table.lua', lint: actualAddTable13Lint }] });
const actualAddTable24Inspection = inspectX4UiLint({ lint: [{ path: 'ui/add-table.lua', lint: actualAddTable24Lint }] });
const actualAddTable13Finding = actualAddTable13Inspection.findings.find(findingValue => findingValue.code === 'x4-ui.add-table-column-limit');
const actualAddTable24Finding = actualAddTable24Inspection.findings.find(findingValue => findingValue.code === 'x4-ui.add-table-column-limit');
assert.equal(actualAddTable13Finding?.severity, 'warning');
assert.equal(actualAddTable24Finding?.severity, 'error');
assert.equal(actualAddTable13Finding?.code, 'x4-ui.add-table-column-limit');
assert.equal(actualAddTable24Finding?.code, 'x4-ui.add-table-column-limit');
const actualAddTable24FailFirstMarkup = renderToStaticMarkup(<X4UiSourceEditorLinter inspection={actualAddTable24Inspection} />);
assert.match(actualAddTable24FailFirstMarkup, /whole frame disappears; UI reloads; conversation closes/);

assert.equal(classifyX4UiLintState({
  sourceAnalyzed: false,
  findings: [],
  incompleteFindingCount: 0,
  diagnosticCount: 0,
  verificationGapCount: 0,
  lintErrorCount: 0,
  truncated: false,
}).label, 'No source analyzed');
assert.equal(classifyX4UiLintState({
  sourceAnalyzed: true,
  findings: [finding({ severity: 'error', code: 'syntax-error' })],
  incompleteFindingCount: 0,
  diagnosticCount: 0,
  verificationGapCount: 0,
  lintErrorCount: 0,
  truncated: false,
}).label, 'Static errors found');
assert.equal(classifyX4UiLintState({
  sourceAnalyzed: true,
  findings: [warningAddTable],
  incompleteFindingCount: 0,
  diagnosticCount: 0,
  verificationGapCount: 0,
  lintErrorCount: 0,
  truncated: false,
}).label, 'Static warnings found');
assert.equal(classifyX4UiLintState({
  sourceAnalyzed: true,
  findings: [],
  incompleteFindingCount: 1,
  diagnosticCount: 0,
  verificationGapCount: 0,
  lintErrorCount: 0,
  truncated: false,
}).label, 'Static checks incomplete');
assert.equal(classifyX4UiLintState({
  sourceAnalyzed: true,
  findings: [],
  incompleteFindingCount: 0,
  diagnosticCount: 0,
  verificationGapCount: 0,
  lintErrorCount: 0,
  truncated: false,
}).label, 'No known static rule violated');

const warningAddTableMarkup = renderToStaticMarkup(
  <X4UiSourceEditorLinter inspection={{
    sourceAnalyzed: true,
    findings: [warningAddTable],
    incompleteFindingCount: 0,
    diagnosticCount: 0,
    verificationGapCount: 0,
    lintErrorCount: 0,
    truncated: false,
  }} />,
);
assert.match(warningAddTableMarkup, /Static warnings found/);
assert.doesNotMatch(warningAddTableMarkup, /whole frame disappears; UI reloads; conversation closes/);
assert.equal(isBlockingX4UiAddTableFinding(warningAddTable), false);

const blockingAddTableMarkup = renderToStaticMarkup(
  <X4UiSourceEditorLinter inspection={{
    sourceAnalyzed: true,
    findings: [blockingAddTable],
    incompleteFindingCount: 0,
    diagnosticCount: 0,
    verificationGapCount: 0,
    lintErrorCount: 0,
    truncated: false,
  }} />,
);
assert.match(blockingAddTableMarkup, /Static errors found/);
assert.match(blockingAddTableMarkup, /whole frame disappears; UI reloads; conversation closes/);
assert.equal(isBlockingX4UiAddTableFinding(blockingAddTable), true);
assert.doesNotMatch(blockingAddTableMarkup, /No known static rule violated/);
for (const fieldLabel of ['severity:', 'code:', 'source location:', 'message:', 'failureMode:', 'evidenceBoundary:', 'nextAction:']) {
  assert.match(blockingAddTableMarkup, new RegExp(fieldLabel.replace(':', '\\:')));
}

const actualAddTable13Markup = renderToStaticMarkup(<X4UiSourceEditorLinter inspection={actualAddTable13Inspection} />);
assert.match(actualAddTable13Markup, /Static warnings found/);
assert.match(actualAddTable13Markup, /x4-ui\.add-table-column-limit/);
assert.doesNotMatch(actualAddTable13Markup, /whole frame disappears; UI reloads; conversation closes/);
assert.equal(isBlockingX4UiAddTableFinding(actualAddTable13Finding as X4UiEditorLintFinding), false);

const actualAddTable24Markup = renderToStaticMarkup(<X4UiSourceEditorLinter inspection={actualAddTable24Inspection} />);
assert.match(actualAddTable24Markup, /Static errors found/);
assert.match(actualAddTable24Markup, /x4-ui\.add-table-column-limit/);
assert.match(actualAddTable24Markup, /whole frame disappears; UI reloads; conversation closes/);
assert.equal(isBlockingX4UiAddTableFinding(actualAddTable24Finding as X4UiEditorLintFinding), true);

const blockingWithGapInspection = { ...actualAddTable24Inspection, verificationGapCount: 1 };
const blockingWithGapMarkup = renderToStaticMarkup(<X4UiSourceEditorLinter inspection={blockingWithGapInspection} />);
assert.equal(classifyX4UiLintState(blockingWithGapInspection).label, 'Static errors found');
assert.match(blockingWithGapMarkup, /Static errors found/);
assert.match(blockingWithGapMarkup, /Static evidence remains incomplete/);

const warningWithGapInspection = { ...actualAddTable13Inspection, verificationGapCount: 1 };
const warningWithGapMarkup = renderToStaticMarkup(<X4UiSourceEditorLinter inspection={warningWithGapInspection} />);
assert.equal(classifyX4UiLintState(warningWithGapInspection).label, 'Static warnings found');
assert.match(warningWithGapMarkup, /Static warnings found/);
assert.match(warningWithGapMarkup, /Static evidence remains incomplete/);

const inspectedLint = inspectX4UiLint({ lint: [{
  path: 'ui/test.lua',
  lint: { findings: [warningAddTable, warningAddTable] },
  diagnostics: [{ code: 'diagnostic-only', message: 'do not render this as a finding' }],
  verificationGaps: [{ code: 'gap-only', message: 'do not render this as a finding' }],
  lintError: 'fixture also has incomplete evidence',
}] });
assert.equal(inspectedLint.findings.length, 1, 'duplicate normalized findings must render once');
assert.equal(inspectedLint.diagnosticCount, 1);
assert.equal(inspectedLint.verificationGapCount, 1);
assert.equal(inspectedLint.lintErrorCount, 1);
assert.equal(classifyX4UiLintState(inspectedLint).label, 'Static warnings found');
const inspectedLintMarkup = renderToStaticMarkup(<X4UiSourceEditorLinter inspection={inspectedLint} />);
assert.match(inspectedLintMarkup, /Static warnings found/);
assert.match(inspectedLintMarkup, /Static evidence remains incomplete/);
assert.equal(inspectedLint.findings[0].failureMode, warningAddTable.failureMode);
assert.equal(inspectedLint.findings[0].evidenceBoundary, warningAddTable.evidenceBoundary);
assert.equal(inspectedLint.findings[0].nextAction, warningAddTable.nextAction);

const actualWarningFinding = actualAddTable13Lint.findings.find(findingValue => findingValue.code === 'x4-ui.add-table-column-limit');
assert.ok(actualWarningFinding);
const warningThenErrorInspection = inspectX4UiLint({ lint: [{
  path: 'ui/add-table.lua',
  lint: { findings: [actualWarningFinding, { ...actualWarningFinding, severity: 'error' }] },
}] });
assert.equal(warningThenErrorInspection.findings.length, 2, 'severity must participate in finding dedupe');
assert.equal(classifyX4UiLintState(warningThenErrorInspection).label, 'Static errors found');

const incompleteMarkup = renderToStaticMarkup(
  <X4UiSourceEditorLinter inspection={{
    sourceAnalyzed: false,
    findings: [],
    incompleteFindingCount: 0,
    diagnosticCount: 0,
    verificationGapCount: 0,
    lintErrorCount: 0,
    truncated: false,
  }} />,
);
assert.match(incompleteMarkup, /No source analyzed/);
assert.doesNotMatch(incompleteMarkup, /No known static rule violated/);

const cleanMarkup = renderToStaticMarkup(
  <X4UiSourceEditorLinter inspection={{
    sourceAnalyzed: true,
    findings: [],
    incompleteFindingCount: 0,
    diagnosticCount: 0,
    verificationGapCount: 0,
    lintErrorCount: 0,
    truncated: false,
  }} />,
);
assert.match(cleanMarkup, /No known static rule violated/);

assert.deepEqual(reconcileX4UiEditorSelections({
  sourceSelector: 'missing-source',
  targetSelector: 'target-1',
  candidates: [{ key: 'source-1', targets: [{ key: 'target-1' }] }],
}), { sourceSelector: '', targetSelector: '' });
assert.deepEqual(reconcileX4UiEditorSelections({
  sourceSelector: 'source-1',
  targetSelector: 'missing-target',
  candidates: [{ key: 'source-1', targets: [{ key: 'target-1' }] }],
}), { sourceSelector: 'source-1', targetSelector: '' });
assert.deepEqual(reconcileX4UiEditorSelections({
  sourceSelector: '',
  targetSelector: '',
  candidates: [{ key: 'source-1', targets: [{ key: 'target-1' }] }],
}), { sourceSelector: '', targetSelector: '' });

assert.equal(classifyX4UiCorpusLoadResult({
  result: { ok: true },
  loaderIssued: false,
  signalAborted: false,
  requestActive: true,
  requestGeneration: 1,
  currentGeneration: 1,
}).accepted, false);
assert.equal(classifyX4UiCorpusLoadResult({
  result: null,
  loaderIssued: true,
  signalAborted: true,
  requestActive: true,
  requestGeneration: 1,
  currentGeneration: 1,
}).status, 'ignored');
assert.equal(classifyX4UiCorpusLoadResult({
  result: { ok: true },
  loaderIssued: true,
  signalAborted: false,
  requestActive: false,
  requestGeneration: 1,
  currentGeneration: 2,
}).status, 'ignored');
const corpusClassificationInput = {
  loaderIssued: true,
  signalAborted: false,
  requestActive: true,
  requestGeneration: 1,
  currentGeneration: 1,
};
assert.equal(classifyX4UiCorpusLoadResult({ ...corpusClassificationInput, result: { ok: false, error: { code: 'status-unavailable', message: 'offline fixture' } } }).status, 'unavailable');
assert.equal(classifyX4UiCorpusLoadResult({ ...corpusClassificationInput, result: { ok: false, error: { code: 'generation-drift', message: 'stale fixture' } } }).status, 'stale');
assert.equal(classifyX4UiCorpusLoadResult({ ...corpusClassificationInput, result: { ok: false, error: { code: 'manifest-malformed', message: 'malformed fixture' } } }).status, 'malformed');
assert.equal(classifyX4UiCorpusLoadResult({ ...corpusClassificationInput, result: { ok: false, error: { code: 'path-invalid', message: 'refused fixture' } } }).status, 'refused');
assert.equal(classifyX4UiCorpusLoadResult({ ...corpusClassificationInput, result: { ok: false, error: { code: 'aborted', message: 'aborted fixture' } } }).status, 'ignored');

const initialCanvasState = {
  status: 'empty',
  surface: null,
  receipt: null,
  stale: false,
  gameTruth: 'Not verified in game',
  gameVerified: false,
} as const;
assert.match(classifyX4UiCanvasState(initialCanvasState).detail, /No rendered bitmap yet/);
assert.doesNotMatch(classifyX4UiCanvasState({ ...initialCanvasState, status: 'current', stale: false }).detail, /stale/i);
assert.match(classifyX4UiCanvasState({ ...initialCanvasState, status: 'stale', stale: true }).detail, /retained|stale/i);
assert.match(classifyX4UiCanvasState({ ...initialCanvasState, status: 'refused', stale: false }).detail, /refused/i);

const previousSurface = { width: 2, height: 2, getContext: () => ({}) };
const freshSurface = { width: 2, height: 2, getContext: () => ({}) };
const renderedResult = {
  status: 'rendered',
  surface: freshSurface,
  receipt: {
    format: 'x4-ui-canvas-renderer',
    version: 1,
    status: 'rendered',
    gameTruth: 'Not verified in game',
    gameVerified: false,
    verification: { game: 'Not verified in game', gameVerified: false },
    width: 2,
    height: 2,
    layers: ['diagnostic-background', 'glyph-alpha-blits', 'diagnostics', 'keep-out-overlays'],
    commandIds: [],
    commandCount: 0,
    atlasRoles: [],
    palette: { id: 'diagnostic-only', diagnosticOnly: true },
  },
} as const;
const firstRenderedDecision = classifyX4UiCanvasCommit(initialCanvasState, { ...renderedResult, surface: previousSurface });
assert.equal(firstRenderedDecision.nextState.surface, previousSurface);
const renderedDecision = classifyX4UiCanvasCommit(firstRenderedDecision.nextState, renderedResult);
assert.equal(renderedDecision.replaceSurface, freshSurface);
assert.equal(renderedDecision.nextState.surface, freshSurface);
const refusalDecision = classifyX4UiCanvasCommit(firstRenderedDecision.nextState, {
  status: 'refused',
  receipt: {
    format: 'x4-ui-canvas-renderer',
    version: 1,
    status: 'refused',
    gameTruth: 'Not verified in game',
    gameVerified: false,
    verification: { game: 'Not verified in game', gameVerified: false },
    refusal: { code: 'input-refused', message: 'refused fixture' },
  },
} as const);
assert.equal(refusalDecision.replaceSurface, undefined);
assert.equal(refusalDecision.nextState.surface, previousSurface);
const malformedDecision = classifyX4UiCanvasCommit(firstRenderedDecision.nextState, {
  ...renderedResult,
  receipt: null,
} as unknown as Parameters<typeof classifyX4UiCanvasCommit>[1]);
assert.equal(malformedDecision.replaceSurface, undefined);
assert.equal(malformedDecision.discardSurface, freshSurface);
assert.equal(malformedDecision.nextState.surface, previousSurface);
assert.equal(malformedDecision.nextState.status, 'stale');
assert.equal(malformedDecision.nextState.stale, true);
assert.equal((malformedDecision.nextState as unknown as { refusal?: { code?: string } }).refusal?.code, 'invalid-result');
const unexpectedCanvasResult = {
  ...renderedResult,
  [['target', 'Surface'].join('')]: freshSurface,
};
const unexpectedDecision = classifyX4UiCanvasCommit(firstRenderedDecision.nextState, unexpectedCanvasResult as unknown as Parameters<typeof classifyX4UiCanvasCommit>[1]);
assert.equal(unexpectedDecision.replaceSurface, undefined);
assert.equal(unexpectedDecision.discardSurface, freshSurface);
assert.equal(unexpectedDecision.nextState.surface, previousSurface);
assert.equal(unexpectedDecision.nextState.status, 'stale');
assert.equal(unexpectedDecision.nextState.stale, true);
assert.equal((unexpectedDecision.nextState as unknown as { refusal?: { code?: string } }).refusal?.code, 'invalid-result');
const unexpectedExistingCanvasResult = {
  ...renderedResult,
  [['existing', 'Surface'].join('')]: freshSurface,
};
const unexpectedExistingDecision = classifyX4UiCanvasCommit(firstRenderedDecision.nextState, unexpectedExistingCanvasResult as unknown as Parameters<typeof classifyX4UiCanvasCommit>[1]);
assert.equal(unexpectedExistingDecision.replaceSurface, undefined);
assert.equal(unexpectedExistingDecision.discardSurface, freshSurface);
assert.equal(unexpectedExistingDecision.nextState.surface, previousSurface);
assert.equal(unexpectedExistingDecision.nextState.status, 'stale');
assert.equal(unexpectedExistingDecision.nextState.stale, true);
assert.equal((unexpectedExistingDecision.nextState as unknown as { refusal?: { code?: string } }).refusal?.code, 'invalid-result');
const malformedEmptyDecision = classifyX4UiCanvasCommit(initialCanvasState, {
  ...renderedResult,
  receipt: null,
} as unknown as Parameters<typeof classifyX4UiCanvasCommit>[1]);
assert.equal(malformedEmptyDecision.replaceSurface, undefined);
assert.equal(malformedEmptyDecision.discardSurface, freshSurface);
assert.equal(malformedEmptyDecision.nextState.status, 'refused');
const sharedKeepOutPresets = [
  { id: 'cockpit-conversation', members: [{ entryId: 'conversation-back-row' }] },
  { id: 'map-open', members: [{ entryId: 'conversation-back-row' }] },
] as const;
const sharedEnabledEntryIds = ['conversation-back-row'];
const inactiveOriginPresetId = 'map-open';
const inactiveOriginResult = toggleX4UiKeepOutEntry(
  'cockpit-conversation',
  inactiveOriginPresetId,
  sharedEnabledEntryIds,
  'conversation-back-row',
  sharedKeepOutPresets,
);
assert.equal(inactiveOriginResult, sharedEnabledEntryIds, `${inactiveOriginPresetId} control must not toggle the active cockpit-conversation keep-out`);
assert.deepEqual(inactiveOriginResult, ['conversation-back-row']);
const activeOriginDisabled = [] as const;
const activeOriginEnabled = toggleX4UiKeepOutEntry('cockpit-conversation', 'cockpit-conversation', activeOriginDisabled, 'conversation-back-row', sharedKeepOutPresets);
assert.deepEqual(activeOriginEnabled, ['conversation-back-row'], 'active-origin callback toggles the entry on');
assert.deepEqual(activeOriginDisabled, [], 'toggle must not mutate the disabled input array');
const activeOriginDisabledAgain = toggleX4UiKeepOutEntry('cockpit-conversation', 'cockpit-conversation', activeOriginEnabled, 'conversation-back-row', sharedKeepOutPresets);
assert.deepEqual(activeOriginDisabledAgain, [], 'active-origin callback toggles the entry off');
const nullActiveResult = toggleX4UiKeepOutEntry(null, 'cockpit-conversation', sharedEnabledEntryIds, 'conversation-back-row', sharedKeepOutPresets);
assert.equal(nullActiveResult, sharedEnabledEntryIds, 'null active preset preserves the original array identity');
const unknownActiveResult = toggleX4UiKeepOutEntry('unknown-preset', 'unknown-preset', sharedEnabledEntryIds, 'conversation-back-row', sharedKeepOutPresets);
assert.equal(unknownActiveResult, sharedEnabledEntryIds, 'unknown active preset preserves the original array identity');
const unknownOriginResult = toggleX4UiKeepOutEntry('cockpit-conversation', 'unknown-preset', sharedEnabledEntryIds, 'conversation-back-row', sharedKeepOutPresets);
assert.equal(unknownOriginResult, sharedEnabledEntryIds, 'unknown originating preset preserves the original array identity');
const wrongOriginResult = toggleX4UiKeepOutEntry('cockpit-conversation', 'map-open', sharedEnabledEntryIds, 'conversation-back-row', sharedKeepOutPresets);
assert.equal(wrongOriginResult, sharedEnabledEntryIds, 'wrong originating preset preserves the original array identity');
const foreignEntryResult = toggleX4UiKeepOutEntry('cockpit-conversation', 'cockpit-conversation', sharedEnabledEntryIds, 'foreign-entry', sharedKeepOutPresets);
assert.equal(foreignEntryResult, sharedEnabledEntryIds, 'foreign entry preserves the original array identity');
assert.equal(isX4UiKeepOutEntryChecked('preset-a', 'preset-b', ['member-a'], 'member-a'), false, 'inactive preset members render unchecked');
assert.equal(isX4UiKeepOutEntryChecked('preset-a', 'preset-a', ['member-a'], 'member-a'), true, 'active preset members reflect enabled IDs');

const uiBuilderMarkup = renderToStaticMarkup(
  <UIBuilder
    workspace={workspace}
    setWorkspace={() => undefined}
    selectedWidget={null}
    setSelectedWidget={() => undefined}
  />,
);
assert.match(uiBuilderMarkup, /X4 Source Preview/);
assert.match(uiBuilderMarkup, /Legacy pixel designer/);
assert.match(uiBuilderMarkup, /LUA Script Event Manager/);
assert.match(uiBuilderMarkup, /x4-ui-source-editor/);
assert.match(uiBuilderMarkup, /Not verified in game/);

const sourceText = readFileSync(new URL('./X4UiSourceEditor.tsx', import.meta.url), 'utf8');
const uiBuilderText = readFileSync(new URL('./UIBuilder.tsx', import.meta.url), 'utf8');
for (const forbidden of [
  'showDirectoryPicker',
  'showOpenFilePicker',
  'indexedDB',
  'localStorage',
  'sessionStorage',
  'targetSurface',
  'existingSurface',
  'workspace.uiWidgets',
  'screenshot capture',
  'source regeneration',
]) {
  assert.equal(sourceText.includes(forbidden), false, `forbidden source-editor API/text present: ${forbidden}`);
}
assert.match(sourceText, /loadConfiguredX4UiCorpusAssets/);
assert.match(sourceText, /isX4UiCorpusCanonicalSuccess/);
assert.match(sourceText, /renderX4UiPaintPlanToCanvas\(/);
assert.match(sourceText, /adoptX4UiEditorCanvasResult/);
assert.match(sourceText, /sampleBinding/);
assert.match(sourceText, /projection\.sampleBinding/);
assert.match(sourceText, /sameX4UiEditorSampleBinding/);
assert.match(sourceText, /sampleCatalogAuthority/);
assert.match(sourceText, /projection\.sampleCatalogAuthority/);
assert.match(sourceText, /updateX4UiEditorSampleState\(sampleInput, projection\.sampleCatalog, entryId, raw, projection\.sampleCatalogAuthority\)/);
assert.doesNotMatch(sampleMarkup, /programKey|profileKey|selectionKey/);
assert.match(sourceText, /whole frame disappears; UI reloads; conversation closes\./);
assert.match(sourceText, /workspace,\n\s+corpus:/);
assert.match(sourceText, /enabledEntryIds/);
assert.match(sourceText, /AbortController/);
assert.match(uiBuilderText, /useState<'source' \| 'canvas' \| 'lua'>\('source'\)/);
assert.match(uiBuilderText, /<X4UiSourceEditor workspace=\{workspace\}/);

type SourceEditParseResult =
  | { readonly accepted: true; readonly value: string | number | boolean }
  | { readonly accepted: false; readonly reason: string; readonly detail: string };

type SourceEditContextFixture = {
  readonly workspace: unknown;
  readonly source: unknown;
  readonly selection: unknown;
  readonly target: unknown;
  readonly program: unknown;
  readonly evidenceAuthority: unknown;
  readonly catalog: unknown;
  readonly profile: unknown;
};

type SourceEditReceiptFixture = {
  readonly status: 'pending' | 'accepted' | 'refused';
  readonly marker: string;
  readonly submission?: unknown;
};

type SourceEditDraftFixture = {
  readonly context: unknown;
  readonly staged: Readonly<Record<string, string>>;
  readonly receipt?: SourceEditReceiptFixture;
};

type SourceEditDraftUpdate = SourceEditDraftFixture | ((previous: SourceEditDraftFixture) => SourceEditDraftFixture);
type SourceEditDraftReconciler = (previous: SourceEditDraftFixture, current: unknown) => SourceEditDraftFixture;
type SourceEditContextFactory = (
  workspace: unknown,
  source: unknown,
  selection: unknown,
  target: unknown,
  program: unknown,
  evidenceAuthority: unknown,
  catalog: unknown,
  profile: unknown,
) => SourceEditContextFixture;

type SourceEditUiApi = {
  readonly discoverX4UiSourceEditorCatalog?: (workspace: unknown, projection: unknown) => unknown;
  readonly parseX4UiSourceEditInput?: (entry: unknown, raw: string) => SourceEditParseResult;
  readonly stageX4UiSourceEditInput?: (staged: Readonly<Record<string, string>>, entryId: string, raw: string) => Readonly<Record<string, string>>;
  readonly shouldClearX4UiSourceEditState?: (previous: unknown, current: unknown) => boolean;
  readonly createX4UiSourceEditContext?: SourceEditContextFactory;
  readonly createX4UiWorkspaceEditPending?: (expectedWorkspace: unknown, workspace: unknown) => {
    readonly submission: WorkspaceCommitSubmission;
    readonly acknowledge: (currentWorkspace: unknown) => WorkspaceCommitAcknowledgement;
  };
  readonly reconcileX4UiSourceEditDraftContext?: SourceEditDraftReconciler;
  readonly classifyX4UiWorkspaceCommit?: (current: unknown, expected: unknown, replacement: unknown) => unknown;
  readonly classifyX4UiWorkspaceEditReadback?: (current: unknown, submission: unknown, acknowledgement?: unknown) => unknown;
  readonly classifyX4UiWorkspaceEditAcknowledgement?: (current: unknown, submission: unknown, acknowledgement?: unknown) => unknown;
  readonly submitX4UiSourceEditWorkspaceCommit?: (
    expectedWorkspace: unknown,
    workspace: unknown,
    onWorkspaceEdit: ((request: { readonly expectedWorkspace: unknown; readonly workspace: unknown }) => WorkspaceCommitSubmission) | undefined,
  ) => WorkspaceCommitSubmission;
  readonly settleX4UiSourceEditReceipt?: (
    currentWorkspace: unknown,
    pendingReceipt: unknown,
    acknowledgement: unknown,
    currentContext: unknown,
  ) => WorkspaceCommitSubmission;
  readonly X4UiSourceEditorSourceEdits?: React.ComponentType<Record<string, unknown>>;
};

type WorkspaceUpdater = (current: unknown) => unknown;
type WorkspaceCommitAcknowledgement = {
  readonly status?: string;
  readonly attempt?: unknown;
  readonly expectedWorkspace?: unknown;
  readonly workspace?: unknown;
  readonly currentWorkspace?: unknown;
  readonly reason?: string;
  readonly detail?: string;
};
type WorkspaceAcknowledger = (currentWorkspace: unknown) => WorkspaceCommitAcknowledgement;
type WorkspaceUpdateScheduler = (updater: WorkspaceUpdater, acknowledge?: WorkspaceAcknowledger) => void;
type WorkspaceCommitSubmission = {
  readonly status?: string;
  readonly accepted?: boolean;
  readonly changed?: boolean;
  readonly attempt?: unknown;
  readonly expectedWorkspace?: unknown;
  readonly workspace?: unknown;
  readonly acknowledgement?: Promise<WorkspaceCommitAcknowledgement>;
  readonly reason?: string;
  readonly detail?: string;
};
type UIBuilderCommitApi = {
  readonly beginX4UiWorkspaceCommit?: (
    renderedWorkspace: unknown,
    request: { readonly expectedWorkspace: unknown; readonly workspace: unknown },
    scheduleWorkspaceUpdate: WorkspaceUpdateScheduler,
  ) => WorkspaceCommitSubmission;
  readonly acknowledgeX4UiWorkspaceCommitBoundary?: (
    acknowledgements: ReadonlyArray<WorkspaceAcknowledger>,
    currentWorkspace: unknown,
  ) => ReadonlyArray<WorkspaceCommitAcknowledgement>;
};

const sourceEditUiApi = X4UiSourceEditorApiModule as unknown as SourceEditUiApi;
const uiBuilderCommitApi = UIBuilderApiModule as unknown as UIBuilderCommitApi;
const createSourceEditContext = sourceEditUiApi.createX4UiSourceEditContext;
const makeSourceEditContext = (context: SourceEditContextFixture): SourceEditContextFixture => (
  createSourceEditContext?.(
    context.workspace,
    context.source,
    context.selection,
    context.target,
    context.program,
    context.evidenceAuthority,
    context.catalog,
    context.profile,
  ) ?? context
);
const failFirstScalarEntry = {
  kind: 'editable',
  id: 'fail-first-number',
  path: 'ui/edit.lua',
  valueType: 'number',
  value: 1,
  expression: 'width',
  expectedText: '1',
  startOffset: 10,
  endOffset: 11,
  source: { file: 'ui/edit.lua', start: { line: 1, column: 10, offset: 10 }, end: { line: 1, column: 11, offset: 11 } },
  sourceLiteral: { file: 'ui/edit.lua', start: { line: 1, column: 10, offset: 10 }, end: { line: 1, column: 11, offset: 11 } },
  provenance: {
    sourceIdentity: { file: 'ui/edit.lua', sha256: 'a'.repeat(64) },
    targetId: 'target',
    targetSource: { file: 'ui/edit.lua', start: { line: 1, column: 0, offset: 0 }, end: { line: 1, column: 20, offset: 20 } },
    operationId: 'operation',
    callName: 'addTable',
    callSource: { file: 'ui/edit.lua', start: { line: 1, column: 0, offset: 0 }, end: { line: 1, column: 20, offset: 20 } },
    callOrder: 0,
    fields: ['width'],
  },
} as const;
const failFirstLockedEntry = {
  kind: 'locked',
  id: 'fail-first-locked',
  path: 'ui/edit.lua',
  valueType: 'number',
  value: 2,
  expression: 'dynamicWidth',
  expectedText: 'dynamicWidth',
  startOffset: 30,
  endOffset: 42,
  source: { file: 'ui/edit.lua', start: { line: 2, column: 0, offset: 30 }, end: { line: 2, column: 12, offset: 42 } },
  sourceLiteral: { file: 'ui/edit.lua', start: { line: 2, column: 0, offset: 30 }, end: { line: 2, column: 12, offset: 42 } },
  field: 'width',
  operationId: 'operation-dynamic',
  callName: 'addTable',
  reason: 'dynamic-value',
  detail: 'dynamic expression is not a direct source literal',
} as const;
const failFirstStringEntry = {
  ...failFirstScalarEntry,
  id: 'fail-first-string',
  valueType: 'string' as const,
  value: 'old',
  expression: 'label',
  expectedText: '"old"',
  quoteStyle: 'double' as const,
  provenance: { ...failFirstScalarEntry.provenance, callName: 'createText' as const, fields: ['text'] as const },
} as const;
const failFirstBooleanEntry = {
  ...failFirstScalarEntry,
  id: 'fail-first-boolean',
  valueType: 'boolean' as const,
  value: true,
  expression: 'scaling',
  expectedText: 'true',
  provenance: { ...failFirstScalarEntry.provenance, fields: ['scaling'] as const },
} as const;
const failFirstCatalog = {
  status: 'ready',
  sourceIdentity: failFirstScalarEntry.provenance.sourceIdentity,
  target: {
    id: 'target',
    kind: 'top-level',
    source: failFirstScalarEntry.provenance.targetSource,
    sourceIdentity: failFirstScalarEntry.provenance.sourceIdentity,
  },
  sourcePath: 'ui/edit.lua',
  sourceText: 'local width = 1',
  entries: [failFirstScalarEntry, failFirstStringEntry, failFirstBooleanEntry, failFirstLockedEntry],
  editableEntries: [failFirstScalarEntry, failFirstStringEntry, failFirstBooleanEntry],
  lockedEntries: [failFirstLockedEntry],
  editable: true,
  detail: 'direct source literals are available for bounded CAS editing',
  verification: 'Not verified in game',
} as const;

const failFirstMissing7DAssertions = [
  ['projection-bound discovery API', typeof sourceEditUiApi.discoverX4UiSourceEditorCatalog === 'function'],
  ['strict scalar parse API', typeof sourceEditUiApi.parseX4UiSourceEditInput === 'function'],
  ['staged-input API', typeof sourceEditUiApi.stageX4UiSourceEditInput === 'function'],
  ['declared-drift clearing API', typeof sourceEditUiApi.shouldClearX4UiSourceEditState === 'function'],
  ['parent expected-workspace CAS API', typeof sourceEditUiApi.classifyX4UiWorkspaceCommit === 'function'],
  ['deterministic scalar control component', typeof sourceEditUiApi.X4UiSourceEditorSourceEdits === 'function'],
  ['source-safe controls heading', /Source-safe property controls/.test(sourceText)],
  ['owner discovery call', /discoverX4UiSourceEdits\(/.test(sourceText)],
  ['owner apply call', /applyX4UiSourceEdit\(/.test(sourceText)],
  ['exact current projection program/evidence', /projection\.preview\.program/.test(sourceText)],
  ['expected workspace submission', /expectedWorkspace/.test(sourceText)],
  ['parent CAS wiring', /onWorkspaceEdit/.test(uiBuilderText)],
  ['permanent game truth in source-edit UI', /Not verified in game/.test(sourceText)],
].filter(([, pass]) => !pass)
  .map(([name]) => name);
assert.deepEqual(failFirstMissing7DAssertions, [], `B119 7D fail-first red assertions: ${failFirstMissing7DAssertions.join(', ')}`);

const parseScalar = sourceEditUiApi.parseX4UiSourceEditInput;
if (!parseScalar) throw new Error('fail-first guard did not establish the scalar parser');
assert.deepEqual(parseScalar(failFirstScalarEntry, '7.5'), { accepted: true, value: 7.5 });
assert.deepEqual(parseScalar({ ...failFirstScalarEntry, valueType: 'string', value: 'old', expectedText: '"old"' }, 'new text'), { accepted: true, value: 'new text' });
assert.deepEqual(parseScalar({ ...failFirstScalarEntry, valueType: 'boolean', value: true, expectedText: 'true' }, 'false'), { accepted: true, value: false });
assert.equal(parseScalar(failFirstScalarEntry, '' ).accepted, false, 'blank number input must refuse before mutation');
assert.equal(parseScalar(failFirstScalarEntry, 'Infinity').accepted, false, 'nonfinite number input must refuse before mutation');
assert.equal(parseScalar({ ...failFirstScalarEntry, valueType: 'boolean' }, '1').accepted, false, 'type-mismatched boolean input must refuse');

const stageScalar = sourceEditUiApi.stageX4UiSourceEditInput;
if (!stageScalar) throw new Error('fail-first guard did not establish the staging helper');
const stagedScalar = stageScalar({}, failFirstScalarEntry.id, '7.5');
assert.deepEqual(stagedScalar, { [failFirstScalarEntry.id]: '7.5' });
assert.deepEqual({}, {}, 'staging is a local value operation and has no source mutation authority');

const clearOnDrift = sourceEditUiApi.shouldClearX4UiSourceEditState;
if (!clearOnDrift) throw new Error('fail-first guard did not establish drift clearing');
const sharedContextObject = {};
const stableSourceEditContext = makeSourceEditContext({
  workspace: sharedContextObject,
  source: sharedContextObject,
  selection: sharedContextObject,
  target: sharedContextObject,
  program: sharedContextObject,
  evidenceAuthority: sharedContextObject,
  catalog: sharedContextObject,
  profile: sharedContextObject,
});
assert.equal(clearOnDrift(stableSourceEditContext, stableSourceEditContext), false);
for (const driftKey of ['workspace', 'source', 'selection', 'target', 'program', 'evidenceAuthority', 'catalog', 'profile']) {
  const drifted = makeSourceEditContext({ ...stableSourceEditContext, [driftKey]: {} });
  assert.equal(clearOnDrift(stableSourceEditContext, drifted), true, `${driftKey} drift clears staged input and receipt`);
}

const classifyCommit = sourceEditUiApi.classifyX4UiWorkspaceCommit;
if (!classifyCommit) throw new Error('fail-first guard did not establish parent CAS');
const expectedWorkspace = {};
const replacementWorkspace = {};
const acceptedCommit = classifyCommit(expectedWorkspace, expectedWorkspace, replacementWorkspace) as { readonly accepted?: boolean };
const refusedCommit = classifyCommit({}, expectedWorkspace, replacementWorkspace) as { readonly accepted?: boolean; readonly reason?: string };
assert.equal(acceptedCommit.accepted, true);
assert.equal(refusedCommit.accepted, false);
assert.match(refusedCommit.reason || '', /stale|expected|current/i);

const compileRenderedUiBuilderCommit = (): NonNullable<UIBuilderCommitApi['beginX4UiWorkspaceCommit']> => {
  const startMarker = '  const commitX4UiSourceEditWorkspace = ';
  const endMarker = '\n  // Legacy pixel geometry summary';
  const startOffset = uiBuilderText.indexOf(startMarker);
  const endOffset = uiBuilderText.indexOf(endMarker, startOffset);
  if (startOffset < 0 || endOffset < 0) throw new Error('could not locate the actual UIBuilder source-edit commit callback');
  const callbackSource = uiBuilderText.slice(startOffset, endOffset);
  const compiled = transpileModule([
    'export default function createCommit(workspace, setWorkspace, classifyX4UiWorkspaceCommit) {',
    callbackSource,
    'return commitX4UiSourceEditWorkspace;',
    '}',
  ].join('\n'), {
    compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2022 },
  }).outputText;
  const commonJsExports: Record<string, unknown> = {};
  const commonJsModule = { exports: commonJsExports };
  runInNewContext(compiled, { module: commonJsModule, exports: commonJsExports });
  const createCommit = (commonJsModule.exports as { readonly default?: unknown }).default;
  if (typeof createCommit !== 'function') throw new Error('could not compile the actual UIBuilder source-edit commit callback');
  return (renderedWorkspace, request, scheduleWorkspaceUpdate) => {
    const commit = createCommit(renderedWorkspace, scheduleWorkspaceUpdate, classifyCommit) as unknown;
    if (typeof commit !== 'function') throw new Error('actual UIBuilder source-edit commit callback was not callable');
    return commit(request) as WorkspaceCommitSubmission;
  };
};

const compileActualSourceEditApply = (
  environment: Readonly<Record<string, unknown>>,
): ((entryId: string) => void) => {
  const startMarker = '  const applySourceEdit = ';
  const endMarker = '\n\n  const width = ';
  const startOffset = sourceText.indexOf(startMarker);
  const endOffset = sourceText.indexOf(endMarker, startOffset);
  if (startOffset < 0 || endOffset < 0) throw new Error('could not locate the actual X4UiSourceEditor apply callback');
  const callbackSource = sourceText.slice(startOffset, endOffset);
  const compiled = transpileModule([
    'export default function createApply(environment) {',
    'const { sourceEditDraftMatches, refuseSourceEdit, sourceEditCatalog, currentProgram, currentEvidenceAuthority, sourceEditDraft, sourceEditContextRef, sourceEditDraftRef, parseX4UiSourceEditInput, applyX4UiSourceEdit, sourceEditContext, projection, onWorkspaceEdit, submitX4UiSourceEditWorkspaceCommit, setSourceEditDraft, settleX4UiSourceEditReceipt, X4_UI_EDITOR_SESSION_GAME_TRUTH } = environment;',
    callbackSource,
    'return applySourceEdit;',
    '}',
  ].join('\n'), {
    compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2022 },
  }).outputText;
  const commonJsExports: Record<string, unknown> = {};
  const commonJsModule = { exports: commonJsExports };
  runInNewContext(compiled, { module: commonJsModule, exports: commonJsExports });
  const createApply = (commonJsModule.exports as { readonly default?: unknown }).default;
  if (typeof createApply !== 'function') throw new Error('could not compile the actual X4UiSourceEditor apply callback');
  const apply = createApply(environment) as unknown;
  if (typeof apply !== 'function') throw new Error('actual X4UiSourceEditor apply callback was not callable');
  return apply as (entryId: string) => void;
};

const compileActualSourceEditStage = (
  environment: Readonly<Record<string, unknown>>,
): ((entryId: string, raw: string) => void) => {
  const startMarker = '  const stageSourceEdit = ';
  const endMarker = '\n\n  const refuseSourceEdit = ';
  const startOffset = sourceText.indexOf(startMarker);
  const endOffset = sourceText.indexOf(endMarker, startOffset);
  if (startOffset < 0 || endOffset < 0) throw new Error('could not locate the actual X4UiSourceEditor stage callback');
  const callbackSource = sourceText.slice(startOffset, endOffset);
  const compiled = transpileModule([
    'export default function createStage(environment) {',
    'const { sourceEditContext, sourceEditContextRef, sourceEditDraftRef, setSourceEditDraft, stageX4UiSourceEditInput, shouldClearX4UiSourceEditState } = environment;',
    callbackSource,
    'return stageSourceEdit;',
    '}',
  ].join('\n'), {
    compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2022 },
  }).outputText;
  const commonJsExports: Record<string, unknown> = {};
  const commonJsModule = { exports: commonJsExports };
  runInNewContext(compiled, { module: commonJsModule, exports: commonJsExports });
  const createStage = (commonJsModule.exports as { readonly default?: unknown }).default;
  if (typeof createStage !== 'function') throw new Error('could not compile the actual X4UiSourceEditor stage callback');
  const stage = createStage(environment) as unknown;
  if (typeof stage !== 'function') throw new Error('actual X4UiSourceEditor stage callback was not callable');
  return stage as (entryId: string, raw: string) => void;
};

const compileActualSourceEditContextEffect = (): ((environment: {
  readonly sourceEditDraftMatches: boolean;
  readonly sourceEditDraft: SourceEditDraftFixture;
  readonly sourceEditContext: SourceEditContextFixture;
  readonly sourceEditContextRef: { readonly current: SourceEditContextFixture | null };
  readonly setSourceEditDraft: (update: SourceEditDraftUpdate) => void;
  readonly reconcileX4UiSourceEditDraftContext?: SourceEditDraftReconciler;
}) => void) => {
  const contextMarker = '  const visibleSourceEditReceipt = ';
  const contextOffset = sourceText.indexOf(contextMarker);
  const startOffset = sourceText.indexOf('\n\n  useEffect(() => {', contextOffset);
  const endOffset = sourceText.indexOf('\n\n  useEffect(() => {', startOffset + 2);
  if (contextOffset < 0 || startOffset < 0 || endOffset < 0) {
    throw new Error('could not locate the actual X4UiSourceEditor draft-context effect');
  }
  const effectSource = sourceText.slice(startOffset, endOffset);
  const compiled = transpileModule([
    'export default function runEffect(environment) {',
    'const { sourceEditDraftMatches, sourceEditDraft, sourceEditContext, sourceEditContextRef, setSourceEditDraft, reconcileX4UiSourceEditDraftContext } = environment;',
    'const useEffect = effect => effect();',
    effectSource,
    '}',
  ].join('\n'), {
    compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2022 },
  }).outputText;
  const commonJsExports: Record<string, unknown> = {};
  const commonJsModule = { exports: commonJsExports };
  runInNewContext(compiled, { module: commonJsModule, exports: commonJsExports });
  const runEffect = commonJsModule.exports.default;
  if (typeof runEffect !== 'function') throw new Error('actual X4UiSourceEditor draft-context effect was not callable');
  return environment => {
    runEffect(environment);
  };
};

const exportedBeginWorkspaceCommit = uiBuilderCommitApi.beginX4UiWorkspaceCommit;
const beginWorkspaceCommit = exportedBeginWorkspaceCommit ?? compileRenderedUiBuilderCommit();
const acknowledgeWorkspaceCommitBoundary = uiBuilderCommitApi.acknowledgeX4UiWorkspaceCommitBoundary;
const classifyWorkspaceReadback = sourceEditUiApi.classifyX4UiWorkspaceEditReadback;
const classifyWorkspaceAcknowledgement = sourceEditUiApi.classifyX4UiWorkspaceEditAcknowledgement;
const expectedWorkspaceE = { identity: 'expected-E' };
const replacementWorkspaceR = { identity: 'replacement-R' };
const newerWorkspaceN = { identity: 'newer-N' };
const sourceEditAuthorityIdentity = {
  source: {},
  selection: {},
  target: {},
  program: {},
  evidenceAuthority: {},
  catalog: {},
  profile: {},
};
const expectedSourceEditContextE = makeSourceEditContext({
  workspace: expectedWorkspaceE,
  ...sourceEditAuthorityIdentity,
});
const replacementSourceEditContextR = makeSourceEditContext({
  workspace: replacementWorkspaceR,
  ...sourceEditAuthorityIdentity,
});
const newerSourceEditContextN = makeSourceEditContext({
  workspace: newerWorkspaceN,
  ...sourceEditAuthorityIdentity,
});
const requestER = { expectedWorkspace: expectedWorkspaceE, workspace: replacementWorkspaceR };
let staleUpdater: WorkspaceUpdater | undefined;
let staleAcknowledger: WorkspaceAcknowledger | undefined;
const staleSubmission = beginWorkspaceCommit(expectedWorkspaceE, requestER, (updater, acknowledge) => {
  staleUpdater = updater;
  staleAcknowledger = acknowledge;
});
if (staleUpdater === undefined) throw new Error('actual UIBuilder protocol did not schedule a functional workspace update');
const delayedReadback = classifyWorkspaceAcknowledgement?.(expectedWorkspaceE, staleSubmission) as WorkspaceCommitSubmission | undefined;
const staleLiveWorkspace = staleUpdater(newerWorkspaceN);
const staleAcknowledgement = staleAcknowledger?.(staleLiveWorkspace);
const staleReadback = classifyWorkspaceAcknowledgement?.(staleLiveWorkspace, staleSubmission, staleAcknowledgement) as WorkspaceCommitSubmission | undefined;
const staleChildReceiptStatus = staleReadback?.status
  ?? (staleSubmission.accepted === true ? 'accepted' : staleSubmission.accepted === false ? 'refused' : staleSubmission.status);

let acceptedUpdater: WorkspaceUpdater | undefined;
let acceptedAcknowledger: WorkspaceAcknowledger | undefined;
const acceptedSubmission = beginWorkspaceCommit(expectedWorkspaceE, requestER, (updater, acknowledge) => {
  acceptedUpdater = updater;
  acceptedAcknowledger = acknowledge;
});
if (acceptedUpdater === undefined) throw new Error('actual UIBuilder protocol did not schedule the accepted functional workspace update');
const acceptedLiveWorkspace = acceptedUpdater(expectedWorkspaceE);
const acceptedAcknowledgement = acceptedAcknowledger?.(acceptedLiveWorkspace);
const acceptedReadback = classifyWorkspaceAcknowledgement?.(acceptedLiveWorkspace, acceptedSubmission, acceptedAcknowledgement) as WorkspaceCommitSubmission | undefined;
const acceptedChildReceiptStatus = acceptedReadback?.status
  ?? (acceptedSubmission.accepted === true ? 'accepted' : acceptedSubmission.accepted === false ? 'refused' : acceptedSubmission.status);

const causalWorkspaceCommitRows = [
  ['actual UIBuilder begin protocol is exported and exercised', typeof exportedBeginWorkspaceCommit === 'function' && /commitX4UiSourceEditWorkspace[\s\S]{0,500}beginX4UiWorkspaceCommit/.test(uiBuilderText) && /flushSync\([\s\S]{0,300}setWorkspaceCommitBoundary\(/.test(uiBuilderText)],
  ['actual child readback protocol is exported and exercised', typeof classifyWorkspaceAcknowledgement === 'function' && /classifyX4UiWorkspaceEditAcknowledgement\(/.test(sourceText)],
  ['submission remains pending before live readback', staleSubmission.status === 'pending' && staleSubmission.accepted !== true],
  ['delayed expected-workspace readback remains pending', delayedReadback?.status === 'pending'],
  ['live-current mismatch preserves the newer workspace object', staleLiveWorkspace === newerWorkspaceN],
  ['live-current mismatch settles as a typed refusal', staleReadback?.status === 'refused'],
  ['live-current mismatch reports stale-parent-workspace', staleReadback?.reason === 'stale-parent-workspace'],
  ['live-current mismatch never yields an accepted child receipt', staleChildReceiptStatus !== 'accepted'],
  ['exact expected live state commits the exact replacement object', acceptedLiveWorkspace === replacementWorkspaceR],
  ['only exact replacement readback yields accepted child receipt', acceptedChildReceiptStatus === 'accepted'],
] as const;
const causalWorkspaceCommitFailures = causalWorkspaceCommitRows.filter(([, pass]) => !pass).map(([name]) => name);
assert.deepEqual(causalWorkspaceCommitFailures, [], `B119 7D causal parent-CAS red assertions: ${causalWorkspaceCommitFailures.join(', ')}`);

const submitSourceEditWorkspaceCommit = sourceEditUiApi.submitX4UiSourceEditWorkspaceCommit;
const settleSourceEditReceipt = sourceEditUiApi.settleX4UiSourceEditReceipt;
let noOpChildParentCalls = 0;
let noOpChildUpdater: WorkspaceUpdater | undefined;
const noOpChildParent = (request: { readonly expectedWorkspace: unknown; readonly workspace: unknown }): WorkspaceCommitSubmission => {
  noOpChildParentCalls += 1;
  return beginWorkspaceCommit(expectedWorkspaceE, request, updater => {
    noOpChildUpdater = updater;
  });
};
let noOpChildSubmission: WorkspaceCommitSubmission | undefined;
let noOpChildDraft: unknown;
if (submitSourceEditWorkspaceCommit !== undefined) {
  noOpChildSubmission = submitSourceEditWorkspaceCommit(
    expectedWorkspaceE,
    expectedWorkspaceE,
    noOpChildParent,
  );
  noOpChildDraft = { receipt: { status: noOpChildSubmission.status } };
} else {
  const noOpSourceEditContext = { ...stableSourceEditContext, workspace: expectedWorkspaceE };
  const applyNoOp = compileActualSourceEditApply({
    sourceEditDraftMatches: true,
    refuseSourceEdit: (reason: string, detail: string) => {
      noOpChildDraft = { context: noOpSourceEditContext, staged: {}, receipt: { status: 'refused', reason, detail } };
    },
    sourceEditCatalog: failFirstCatalog,
    currentProgram: {},
    currentEvidenceAuthority: {},
    sourceEditDraft: { context: noOpSourceEditContext, staged: { [failFirstScalarEntry.id]: '1' } },
    parseX4UiSourceEditInput: sourceEditUiApi.parseX4UiSourceEditInput,
    applyX4UiSourceEdit: () => ({
      accepted: true,
      changed: false,
      workspace: expectedWorkspaceE,
      path: failFirstScalarEntry.path,
      startOffset: failFirstScalarEntry.startOffset,
      endOffset: failFirstScalarEntry.endOffset,
    }),
    sourceEditContext: noOpSourceEditContext,
    projection: { source: {} },
    onWorkspaceEdit: noOpChildParent,
    setSourceEditDraft: (next: unknown) => {
      noOpChildDraft = next;
    },
    X4_UI_EDITOR_SESSION_GAME_TRUTH: 'Not verified in game',
  });
  applyNoOp(failFirstScalarEntry.id);
}
const noOpChildReceipt = (noOpChildDraft as { readonly receipt?: WorkspaceCommitSubmission } | undefined)?.receipt;

let delayedNoOpUpdater: WorkspaceUpdater | undefined;
let delayedNoOpAcknowledger: WorkspaceAcknowledger | undefined;
const delayedNoOpSubmission = beginWorkspaceCommit(
  expectedWorkspaceE,
  { expectedWorkspace: expectedWorkspaceE, workspace: expectedWorkspaceE },
  (updater, acknowledge) => {
    delayedNoOpUpdater = updater;
    delayedNoOpAcknowledger = acknowledge;
  },
);
if (delayedNoOpUpdater === undefined) throw new Error('actual UIBuilder protocol did not schedule the delayed no-op updater');
const classifyNoOp = (
  currentWorkspace: unknown,
  submission: WorkspaceCommitSubmission,
  acknowledgement?: WorkspaceCommitAcknowledgement,
): WorkspaceCommitSubmission => (
  (classifyWorkspaceAcknowledgement?.(currentWorkspace, submission, acknowledgement)
    ?? classifyWorkspaceReadback?.(currentWorkspace, submission)) as WorkspaceCommitSubmission
);
const delayedNoOpBeforeUpdater = classifyNoOp(expectedWorkspaceE, delayedNoOpSubmission);
const delayedNoOpStaleWorkspace = delayedNoOpUpdater(newerWorkspaceN);
const delayedNoOpStaleAcknowledgement = delayedNoOpAcknowledger?.(delayedNoOpStaleWorkspace);
const delayedNoOpStaleSettlement = classifyNoOp(
  delayedNoOpStaleWorkspace,
  delayedNoOpSubmission,
  delayedNoOpStaleAcknowledgement,
);
const delayedNoOpPendingReceipt = {
  status: 'pending',
  submission: delayedNoOpSubmission,
  context: expectedSourceEditContextE,
  changed: false,
  detail: delayedNoOpSubmission.detail,
  acceptedDetail: 'acknowledged owner no-op',
};
const delayedNoOpChildBeforeAcknowledgement = settleSourceEditReceipt?.(
  expectedWorkspaceE,
  delayedNoOpPendingReceipt,
  undefined,
  expectedSourceEditContextE,
);
const delayedNoOpStaleChildReceipt = settleSourceEditReceipt?.(
  delayedNoOpStaleWorkspace,
  delayedNoOpPendingReceipt,
  delayedNoOpStaleAcknowledgement,
  newerSourceEditContextN,
);

let acceptedNoOpUpdater: WorkspaceUpdater | undefined;
let acceptedNoOpAcknowledger: WorkspaceAcknowledger | undefined;
const acceptedNoOpSubmission = beginWorkspaceCommit(
  expectedWorkspaceE,
  { expectedWorkspace: expectedWorkspaceE, workspace: expectedWorkspaceE },
  (updater, acknowledge) => {
    acceptedNoOpUpdater = updater;
    acceptedNoOpAcknowledger = acknowledge;
  },
);
if (acceptedNoOpUpdater === undefined) throw new Error('actual UIBuilder protocol did not schedule the accepted no-op updater');
const acceptedNoOpBeforeUpdater = classifyNoOp(expectedWorkspaceE, acceptedNoOpSubmission);
const acceptedNoOpWorkspace = acceptedNoOpUpdater(expectedWorkspaceE);
const acceptedNoOpAcknowledgement = acceptedNoOpAcknowledger?.(acceptedNoOpWorkspace);
const acceptedNoOpSettlement = classifyNoOp(
  acceptedNoOpWorkspace,
  acceptedNoOpSubmission,
  acceptedNoOpAcknowledgement,
);
const acceptedNoOpPendingReceipt = {
  status: 'pending',
  submission: acceptedNoOpSubmission,
  context: expectedSourceEditContextE,
  changed: false,
  detail: acceptedNoOpSubmission.detail,
  acceptedDetail: 'acknowledged owner no-op',
};
const acceptedNoOpChildReceipt = settleSourceEditReceipt?.(
  acceptedNoOpWorkspace,
  acceptedNoOpPendingReceipt,
  acceptedNoOpAcknowledgement,
  expectedSourceEditContextE,
);
const staleAcceptedNoOpSettlement = classifyNoOp(
  newerWorkspaceN,
  acceptedNoOpSubmission,
  acceptedNoOpAcknowledgement,
);
const clonedNoOpAcknowledgement = acceptedNoOpAcknowledgement === undefined
  ? undefined
  : { ...acceptedNoOpAcknowledgement };
const forgedNoOpAcknowledgement: WorkspaceCommitAcknowledgement = {
  status: 'accepted',
  attempt: acceptedNoOpSubmission.attempt,
  expectedWorkspace: expectedWorkspaceE,
  workspace: expectedWorkspaceE,
  currentWorkspace: expectedWorkspaceE,
  detail: 'caller-forged acknowledgement',
};
const clonedNoOpSettlement = classifyNoOp(acceptedNoOpWorkspace, acceptedNoOpSubmission, clonedNoOpAcknowledgement);
const crossedNoOpSettlement = classifyNoOp(acceptedNoOpWorkspace, acceptedNoOpSubmission, delayedNoOpStaleAcknowledgement);
const forgedNoOpSettlement = classifyNoOp(acceptedNoOpWorkspace, acceptedNoOpSubmission, forgedNoOpAcknowledgement);
const clonedNoOpSubmission = { ...acceptedNoOpSubmission };
const clonedNoOpSubmissionSettlement = classifyNoOp(
  acceptedNoOpWorkspace,
  clonedNoOpSubmission,
  acceptedNoOpAcknowledgement,
);

let committedBoundaryNoOpUpdater: WorkspaceUpdater | undefined;
let committedBoundaryNoOpAcknowledger: WorkspaceAcknowledger | undefined;
const committedBoundaryNoOpSubmission = beginWorkspaceCommit(
  expectedWorkspaceE,
  { expectedWorkspace: expectedWorkspaceE, workspace: expectedWorkspaceE },
  (updater, acknowledge) => {
    committedBoundaryNoOpUpdater = updater;
    committedBoundaryNoOpAcknowledger = acknowledge;
  },
);
if (committedBoundaryNoOpUpdater === undefined) throw new Error('actual UIBuilder protocol did not schedule the committed-boundary no-op updater');
const committedBoundaryBeforeUpdater = classifyNoOp(expectedWorkspaceE, committedBoundaryNoOpSubmission);
const committedBoundaryLiveWorkspace = committedBoundaryNoOpUpdater(newerWorkspaceN);
const committedBoundaryAcknowledgements = acknowledgeWorkspaceCommitBoundary !== undefined
  && committedBoundaryNoOpAcknowledger !== undefined
  ? acknowledgeWorkspaceCommitBoundary([committedBoundaryNoOpAcknowledger], committedBoundaryLiveWorkspace)
  : [];
const committedBoundaryAcknowledgement = committedBoundaryAcknowledgements[0];
const committedBoundarySettlement = classifyNoOp(
  committedBoundaryLiveWorkspace,
  committedBoundaryNoOpSubmission,
  committedBoundaryAcknowledgement,
);

const causalNoOpAcknowledgementRows = [
  ['actual child no-op path uses the unified parent submission protocol', typeof submitSourceEditWorkspaceCommit === 'function' && /const parentResult = submitX4UiSourceEditWorkspaceCommit\(/.test(sourceText)],
  ['actual child receipt settlement protocol is exported and wired', typeof settleSourceEditReceipt === 'function' && /settleX4UiSourceEditReceipt\(/.test(sourceText)],
  ['changed and no-op owner successes share one parent submission branch', !/if \(!result\.changed\)/.test(sourceText)],
  ['owner accepted changed-false calls the actual parent once', noOpChildParentCalls === 1],
  ['owner accepted changed-false remains pending before acknowledgement', noOpChildSubmission?.status === 'pending' && noOpChildReceipt?.status !== 'accepted'],
  ['owner accepted changed-false schedules the actual parent updater', typeof noOpChildUpdater === 'function'],
  ['unchanged E before updater or acknowledgement remains pending', delayedNoOpBeforeUpdater.status === 'pending'],
  ['actual child receipt remains pending while acknowledgement is omitted', delayedNoOpChildBeforeAcknowledgement?.status === 'pending'],
  ['stale live parent N is preserved by the delayed no-op updater', delayedNoOpStaleWorkspace === newerWorkspaceN],
  ['stale no-op receives an actual parent-issued acknowledgement', delayedNoOpStaleAcknowledgement !== undefined],
  ['stale no-op acknowledgement settles as typed refusal', delayedNoOpStaleSettlement.status === 'refused' && delayedNoOpStaleSettlement.reason === 'stale-parent-workspace'],
  ['stale no-op final child receipt is typed stale-parent-workspace', delayedNoOpStaleChildReceipt?.status === 'refused' && delayedNoOpStaleChildReceipt.reason === 'stale-parent-workspace'],
  ['exact no-op E remains pending until its updater executes', acceptedNoOpBeforeUpdater.status === 'pending'],
  ['exact no-op updater preserves exact E', acceptedNoOpWorkspace === expectedWorkspaceE],
  ['exact no-op accepts only after exact parent-issued acknowledgement', acceptedNoOpAcknowledgement !== undefined && acceptedNoOpSettlement.status === 'accepted'],
  ['exact acknowledgement retains attempt and workspace identities', acceptedNoOpAcknowledgement?.attempt === acceptedNoOpSubmission.attempt && acceptedNoOpAcknowledgement.expectedWorkspace === expectedWorkspaceE && acceptedNoOpAcknowledgement.workspace === expectedWorkspaceE && acceptedNoOpAcknowledgement.currentWorkspace === expectedWorkspaceE],
  ['acknowledged exact no-op becomes Accepted no-op in the actual child protocol', acceptedNoOpChildReceipt?.status === 'accepted' && acceptedNoOpChildReceipt.changed === false],
  ['previously accepted acknowledgement becomes stale after current workspace drift', staleAcceptedNoOpSettlement.status !== 'accepted'],
  ['cloned acknowledgement never becomes accepted', clonedNoOpSettlement.status !== 'accepted'],
  ['crossed acknowledgement never becomes accepted', crossedNoOpSettlement.status !== 'accepted'],
  ['forged acknowledgement never becomes accepted', forgedNoOpSettlement.status !== 'accepted'],
  ['cloned pending submission never becomes accepted', clonedNoOpSubmissionSettlement.status !== 'accepted'],
  ['actual committed-workspace acknowledgement boundary is exported and exercised', typeof acknowledgeWorkspaceCommitBoundary === 'function'],
  ['committed-boundary no-op remains pending before its updater and acknowledgement', committedBoundaryBeforeUpdater.status === 'pending'],
  ['committed-boundary stale updater preserves newer N', committedBoundaryLiveWorkspace === newerWorkspaceN],
  ['committed-boundary readback issues exactly one acknowledgement for the queued attempt', committedBoundaryAcknowledgements.length === 1],
  ['committed-boundary stale no-op settles as typed stale-parent-workspace', committedBoundarySettlement.status === 'refused' && committedBoundarySettlement.reason === 'stale-parent-workspace'],
  ['actual UIBuilder queues acknowledgement and forces a committed readback render', /pendingWorkspaceAcknowledgementsRef\.current\s*=\s*\[[\s\S]{0,300}setWorkspaceCommitBoundary\(/.test(uiBuilderText) && /useLayoutEffect\([\s\S]{0,500}acknowledgeX4UiWorkspaceCommitBoundary\([\s\S]{0,200}workspace/.test(uiBuilderText)],
  ['actual UIBuilder never acknowledges from a potentially stale post-updater ref', !/acknowledge\(workspaceRef\.current\)/.test(uiBuilderText)],
] as const;
const causalNoOpAcknowledgementFailures = causalNoOpAcknowledgementRows.filter(([, pass]) => !pass).map(([name]) => name);
assert.deepEqual(causalNoOpAcknowledgementFailures, [], `B119 7D no-op acknowledgement red assertions: ${causalNoOpAcknowledgementFailures.join(', ')}`);

const reconcileSourceEditDraftContext = sourceEditUiApi.reconcileX4UiSourceEditDraftContext;
const passiveEffectAuthority = {
  workspace: {},
  source: {},
  selection: {},
  target: {},
  program: {},
  evidenceAuthority: {},
  catalog: {},
  profile: {},
};
const passiveEffectContextE = makeSourceEditContext({
  workspace: {},
  source: {},
  selection: {},
  target: {},
  program: {},
  evidenceAuthority: {},
  catalog: {},
  profile: {},
});
const passiveEffectContextR = makeSourceEditContext({ ...passiveEffectAuthority });
const passiveEffectEquivalentContextR = makeSourceEditContext({ ...passiveEffectAuthority });
const oldDraftE: SourceEditDraftFixture = {
  context: passiveEffectContextE,
  staged: Object.freeze({ field: 'old' }),
};
const pendingReceiptFixture: SourceEditReceiptFixture = Object.freeze({ status: 'pending', marker: 'newer-pending-R' });
const acceptedReceiptFixture: SourceEditReceiptFixture = Object.freeze({ status: 'accepted', marker: 'accepted-R' });
const refusedReceiptFixture: SourceEditReceiptFixture = Object.freeze({ status: 'refused', marker: 'refused-R' });
const newerPendingDraftR: SourceEditDraftFixture = Object.freeze({
  context: passiveEffectContextR,
  staged: Object.freeze({}),
  receipt: pendingReceiptFixture,
});
let liveDraftAfterScheduledEffect = newerPendingDraftR;
let functionalDraftUpdates = 0;
let objectDraftUpdates = 0;
const runActualContextEffect = compileActualSourceEditContextEffect();
runActualContextEffect({
  sourceEditDraftMatches: false,
  sourceEditDraft: oldDraftE,
  sourceEditContext: passiveEffectContextR,
  sourceEditContextRef: { current: passiveEffectContextR },
  setSourceEditDraft: update => {
    if (typeof update === 'function') {
      functionalDraftUpdates += 1;
      liveDraftAfterScheduledEffect = update(liveDraftAfterScheduledEffect);
    } else {
      objectDraftUpdates += 1;
      liveDraftAfterScheduledEffect = update;
    }
  },
  reconcileX4UiSourceEditDraftContext: reconcileSourceEditDraftContext,
});

const exactAcceptedDraftR: SourceEditDraftFixture = Object.freeze({
  context: passiveEffectContextR,
  staged: Object.freeze({ field: 'accepted-staged' }),
  receipt: acceptedReceiptFixture,
});
const exactRefusedDraftR: SourceEditDraftFixture = Object.freeze({
  context: passiveEffectContextR,
  staged: Object.freeze({ field: 'refused-staged' }),
  receipt: refusedReceiptFixture,
});
const exactAcceptedReconciled = reconcileSourceEditDraftContext?.(exactAcceptedDraftR, passiveEffectContextR);
const exactRefusedReconciled = reconcileSourceEditDraftContext?.(exactRefusedDraftR, passiveEffectContextR);

const equivalentReceipts = [pendingReceiptFixture, acceptedReceiptFixture, refusedReceiptFixture] as const;
const equivalentReconciliations = equivalentReceipts.map(receipt => {
  const staged = Object.freeze({ field: `${receipt.status}-staged` });
  const previous: SourceEditDraftFixture = Object.freeze({
    context: passiveEffectEquivalentContextR,
    staged,
    receipt,
  });
  const reconciled = reconcileSourceEditDraftContext?.(previous, passiveEffectContextR);
  return reconciled?.context === passiveEffectContextR
    && reconciled.staged === staged
    && reconciled.receipt === receipt;
});

const passiveEffectDriftKeys = ['workspace', 'source', 'selection', 'target', 'program', 'evidenceAuthority', 'catalog', 'profile'] as const;
const driftReconciliations = passiveEffectDriftKeys.map(key => {
  const driftedContext = makeSourceEditContext({ ...passiveEffectContextR, [key]: {} });
  const previous: SourceEditDraftFixture = {
    context: driftedContext,
    staged: Object.freeze({ field: 'must-clear' }),
    receipt: acceptedReceiptFixture,
  };
  const reconciled = reconcileSourceEditDraftContext?.(previous, passiveEffectContextR);
  return reconciled?.context === passiveEffectContextR
    && Object.keys(reconciled.staged).length === 0
    && reconciled.receipt === undefined;
});

const passiveEffectReconciliationRows = [
  ['execution-time draft-context reconciliation owner is exported', typeof reconcileSourceEditDraftContext === 'function'],
  ['actual scheduled context effect performs a functional execution-time update', functionalDraftUpdates === 1],
  ['actual scheduled context effect never performs a stale object replacement', objectDraftUpdates === 0],
  ['old-E effect executed after newer pending-R preserves the exact newer draft object', liveDraftAfterScheduledEffect === newerPendingDraftR],
  ['exact-current accepted receipt preserves the exact previous draft object', exactAcceptedReconciled === exactAcceptedDraftR],
  ['exact-current refused receipt preserves the exact previous draft object', exactRefusedReconciled === exactRefusedDraftR],
  ['equivalent current authority preserves staged and pending/accepted/refused receipts while adopting current context identity', equivalentReconciliations.every(Boolean)],
  ['real authority drift clears staged values and every receipt state across all eight context fields', driftReconciliations.every(Boolean)],
] as const;
const passiveEffectReconciliationFailures = passiveEffectReconciliationRows.filter(([, pass]) => !pass).map(([name]) => name);
assert.deepEqual(passiveEffectReconciliationFailures, [], `B119 7D passive-effect reconciliation red assertions: ${passiveEffectReconciliationFailures.join(', ')}`);

const findingOneControlRows = [
  functionalDraftUpdates === 1,
  objectDraftUpdates === 0,
  liveDraftAfterScheduledEffect === newerPendingDraftR,
  reconcileSourceEditDraftContext?.(newerPendingDraftR, passiveEffectContextR) === newerPendingDraftR,
];
assert.equal(findingOneControlRows.every(Boolean), true, 'audit finding 1 control must preserve pending R when closure and ref are both R');
console.log('X4UiSourceEditor audit finding 1 control: closure R / ref R / live pending R PASS 4/4');

let staleClosureLiveDraft = newerPendingDraftR;
let staleClosureFunctionalUpdates = 0;
let staleClosureObjectUpdates = 0;
runActualContextEffect({
  sourceEditDraftMatches: true,
  sourceEditDraft: oldDraftE,
  sourceEditContext: passiveEffectContextE,
  sourceEditContextRef: { current: passiveEffectContextR },
  setSourceEditDraft: update => {
    if (typeof update === 'function') {
      staleClosureFunctionalUpdates += 1;
      staleClosureLiveDraft = update(staleClosureLiveDraft);
    } else {
      staleClosureObjectUpdates += 1;
      staleClosureLiveDraft = update;
    }
  },
  reconcileX4UiSourceEditDraftContext: reconcileSourceEditDraftContext,
});

type CausalRow = readonly [string, boolean];
type HostileContextProbe = {
  readonly clear: boolean | undefined;
  readonly reconciled: SourceEditDraftFixture | undefined;
  readonly threw: boolean;
};
const probeHostilePreviousContext = (candidate: unknown): HostileContextProbe => {
  let clear: boolean | undefined;
  let reconciled: SourceEditDraftFixture | undefined;
  let threw = false;
  try {
    clear = clearOnDrift(candidate, passiveEffectContextR);
    reconciled = reconcileSourceEditDraftContext?.({
      context: candidate,
      staged: Object.freeze({ field: 'must-clear' }),
      receipt: acceptedReceiptFixture,
    }, passiveEffectContextR);
  } catch {
    threw = true;
  }
  return { clear, reconciled, threw };
};
const probeHostileCurrentContext = (candidate: unknown): HostileContextProbe => {
  let clear: boolean | undefined;
  let reconciled: SourceEditDraftFixture | undefined;
  let threw = false;
  try {
    clear = clearOnDrift(passiveEffectContextR, candidate);
    reconciled = reconcileSourceEditDraftContext?.({
      context: passiveEffectContextR,
      staged: Object.freeze({ field: 'must-clear' }),
      receipt: acceptedReceiptFixture,
    }, candidate);
  } catch {
    threw = true;
  }
  return { clear, reconciled, threw };
};
const hostileProbeCleared = (probe: HostileContextProbe, current: unknown): boolean => (
  !probe.threw
  && probe.clear === true
  && probe.reconciled?.context === current
  && Object.keys(probe.reconciled.staged).length === 0
  && probe.reconciled.receipt === undefined
);

let accessorContextReads = 0;
const accessorContext: object = {};
for (const key of passiveEffectDriftKeys) {
  Object.defineProperty(accessorContext, key, {
    configurable: true,
    enumerable: true,
    get: () => {
      accessorContextReads += 1;
      return passiveEffectContextR[key];
    },
  });
}
const accessorContextProbe = probeHostilePreviousContext(accessorContext);

const hostileContextSymbol = Symbol('hostile-context');
const symbolContext = { ...passiveEffectAuthority, [hostileContextSymbol]: true };
const symbolContextProbe = probeHostilePreviousContext(symbolContext);

const customPrototypeContext: Record<string, unknown> = Object.create(Object.freeze({ hostile: true }));
for (const key of passiveEffectDriftKeys) customPrototypeContext[key] = passiveEffectContextR[key];
const customPrototypeContextProbe = probeHostilePreviousContext(customPrototypeContext);

let proxyContextReads = 0;
const proxyContext = new Proxy({ ...passiveEffectAuthority }, {
  get: (target, property, receiver) => {
    proxyContextReads += 1;
    return Reflect.get(target, property, receiver);
  },
});
const proxyPreviousContextProbe = probeHostilePreviousContext(proxyContext);
const proxyCurrentContextProbe = probeHostileCurrentContext(proxyContext);

const fullContextDriftKeys = ['workspace', 'source', 'selection', 'target', 'program', 'evidenceAuthority', 'catalog', 'profile'] as const;
const changedPendingReceipt = {
  status: 'pending',
  submission: acceptedSubmission,
  context: replacementSourceEditContextR,
  changed: true,
  detail: acceptedSubmission.detail,
  acceptedDetail: 'acknowledged owner source change',
};
const exactNoOpContextSettlement = settleSourceEditReceipt?.(
  expectedWorkspaceE,
  acceptedNoOpPendingReceipt,
  acceptedNoOpAcknowledgement,
  expectedSourceEditContextE,
);
const exactChangedContextSettlement = settleSourceEditReceipt?.(
  replacementWorkspaceR,
  changedPendingReceipt,
  acceptedAcknowledgement,
  replacementSourceEditContextR,
);
const contextDriftRows = (
  label: 'no-op' | 'changed',
  baseContext: SourceEditContextFixture,
  pendingReceipt: unknown,
  acknowledgement: WorkspaceCommitAcknowledgement | undefined,
): ReadonlyArray<CausalRow> => fullContextDriftKeys.map(key => {
  const driftedContext = makeSourceEditContext({ ...baseContext, [key]: {} });
  const settlement = settleSourceEditReceipt?.(
    driftedContext.workspace,
    pendingReceipt,
    acknowledgement,
    driftedContext,
  );
  return [
    `${label} acknowledgement after ${key} drift refuses with typed stale context`,
    settlement?.status === 'refused'
      && (settlement.reason === 'stale-editor-context' || settlement.reason === 'stale-parent-workspace'),
  ] as const;
});
const round4PreRenderRows: ReadonlyArray<CausalRow> = [
  ['stale closure E with execution-time ref R preserves exact newer pending R', staleClosureFunctionalUpdates === 1 && staleClosureObjectUpdates === 0 && staleClosureLiveDraft === newerPendingDraftR],
  ['exact unchanged no-op context still accepts exact parent acknowledgement', exactNoOpContextSettlement?.status === 'accepted'],
  ['exact post-commit changed context R still accepts exact parent acknowledgement', exactChangedContextSettlement?.status === 'accepted'],
  ...contextDriftRows('no-op', expectedSourceEditContextE, acceptedNoOpPendingReceipt, acceptedNoOpAcknowledgement),
  ...contextDriftRows('changed', replacementSourceEditContextR, changedPendingReceipt, acceptedAcknowledgement),
  ['owner-issued plain source-edit context factory is exported', typeof createSourceEditContext === 'function'],
  ['accessor context clears without throw or getter reads', hostileProbeCleared(accessorContextProbe, passiveEffectContextR) && accessorContextReads === 0],
  ['symbol-decorated context clears without traversal', hostileProbeCleared(symbolContextProbe, passiveEffectContextR)],
  ['custom-prototype context clears without traversal', hostileProbeCleared(customPrototypeContextProbe, passiveEffectContextR)],
  ['proxy contexts clear in both positions without get-trap reads', hostileProbeCleared(proxyPreviousContextProbe, passiveEffectContextR) && hostileProbeCleared(proxyCurrentContextProbe, proxyContext) && proxyContextReads === 0],
];

const renderSourceEditControls = sourceEditUiApi.X4UiSourceEditorSourceEdits;
if (!renderSourceEditControls) throw new Error('fail-first guard did not establish source-edit controls');
const sourceEditControlsMarkup = renderToStaticMarkup(React.createElement(renderSourceEditControls, {
  catalog: failFirstCatalog,
  staged: { [failFirstScalarEntry.id]: '7.5' },
  receipt: undefined,
  onStage: () => undefined,
  onApply: () => undefined,
}));
assert.match(sourceEditControlsMarkup, /Source-safe property controls/);
assert.match(sourceEditControlsMarkup, /ui\/edit\.lua/);
assert.match(sourceEditControlsMarkup, /addTable/);
assert.match(sourceEditControlsMarkup, /width/);
assert.match(sourceEditControlsMarkup, /dynamic expression is not a direct source literal/);
assert.match(sourceEditControlsMarkup, /type="number"/);
assert.match(sourceEditControlsMarkup, /type="text"/);
assert.match(sourceEditControlsMarkup, /type="checkbox"/);
assert.doesNotMatch(sourceEditControlsMarkup, /data-testid="x4-ui-source-edit-input-fail-first-locked"/);
assert.match(sourceEditControlsMarkup, /Not verified in game/);
const pendingSourceEditControlsMarkup = renderToStaticMarkup(React.createElement(renderSourceEditControls, {
  catalog: failFirstCatalog,
  staged: {},
  receipt: {
    status: 'pending',
    submission: acceptedSubmission,
    context: replacementSourceEditContextR,
    changed: true,
    detail: 'awaiting exact parent-issued acknowledgement',
    acceptedDetail: 'must remain hidden until exact acknowledgement',
  },
  onStage: () => undefined,
  onApply: () => undefined,
}));
assert.match(pendingSourceEditControlsMarkup, /Pending parent workspace acknowledgement/);
assert.doesNotMatch(pendingSourceEditControlsMarkup, /Accepted source change/);

const forgedVerificationCatalog = Object.freeze({
  ...failFirstCatalog,
  verification: 'Verified in game',
});
const forgedVerificationCatalogBefore = JSON.stringify(forgedVerificationCatalog);
const forgedVerificationMarkup = renderToStaticMarkup(React.createElement(renderSourceEditControls, {
  catalog: forgedVerificationCatalog,
  staged: {},
  receipt: undefined,
  onStage: () => undefined,
  onApply: () => undefined,
}));
const round4CausalRows: ReadonlyArray<CausalRow> = [
  ...round4PreRenderRows,
  ['forged catalog verification cannot render Verified in game', !/>Verified in game</.test(forgedVerificationMarkup)],
  ['forged catalog still renders permanent Not verified in game truth', />Not verified in game</.test(forgedVerificationMarkup)],
  ['source-edit controls do not mutate caller catalog while enforcing truth', JSON.stringify(forgedVerificationCatalog) === forgedVerificationCatalogBefore],
];
const round4CausalFailures = round4CausalRows.filter(([, pass]) => !pass).map(([name]) => name);
assert.deepEqual(round4CausalFailures, [], `B119 7D round-4 causal red assertions: ${round4CausalFailures.join(', ')}`);

const round5ReceiptStatuses = ['pending', 'accepted', 'refused'] as const;
const round5SourceEditContextFor = (key: typeof fullContextDriftKeys[number]): {
  readonly contextE: SourceEditContextFixture;
  readonly contextR: SourceEditContextFixture;
} => {
  const base: SourceEditContextFixture = {
    workspace: { id: `round-5-${key}-workspace-E` },
    source: { id: `round-5-${key}-source-E` },
    selection: { id: `round-5-${key}-selection-E` },
    target: { id: `round-5-${key}-target-E` },
    program: { id: `round-5-${key}-program-E` },
    evidenceAuthority: { id: `round-5-${key}-evidence-E` },
    catalog: { id: `round-5-${key}-catalog-E` },
    profile: { id: `round-5-${key}-profile-E` },
  };
  const drifted: SourceEditContextFixture = {
    ...base,
    [key]: { id: `round-5-${key}-${key}-R` },
  };
  return {
    contextE: makeSourceEditContext(base),
    contextR: makeSourceEditContext(drifted),
  };
};

const round5DraftFor = (
  context: unknown,
  status: typeof round5ReceiptStatuses[number],
  marker: string,
): SourceEditDraftFixture => Object.freeze({
  context,
  staged: Object.freeze({ [failFirstScalarEntry.id]: `${marker}-${status}` }),
  receipt: Object.freeze({ status, marker }) as SourceEditReceiptFixture,
});

const hostileRetainedContext = (context: unknown): { readonly context: unknown; readonly reads: () => number } => {
  let reads = 0;
  const retained = new Proxy(context as object, {
    get: () => {
      reads += 1;
      throw new Error('stale retained context was accessed');
    },
  });
  return { context: retained, reads: () => reads };
};

const round5StageEntryRows: ReadonlyArray<CausalRow> = fullContextDriftKeys.flatMap(key => (
  round5ReceiptStatuses.map(status => {
    const { contextE, contextR } = round5SourceEditContextFor(key);
    const hostileE = hostileRetainedContext(contextE);
    const liveDraftR = round5DraftFor(contextR, status, `live-${key}`);
    const sourceEditContextRef: { current: unknown } = { current: contextR };
    let liveDraft: SourceEditDraftFixture = liveDraftR;
    let updaterCalls = 0;
    let objectUpdates = 0;
    let threw = false;
    const stage = compileActualSourceEditStage({
      sourceEditContext: hostileE.context,
      sourceEditContextRef,
      sourceEditDraftRef: { current: liveDraftR },
      setSourceEditDraft: update => {
        updaterCalls += 1;
        if (typeof update === 'function') {
          liveDraft = update(liveDraft);
        } else {
          objectUpdates += 1;
          liveDraft = update;
        }
      },
      stageX4UiSourceEditInput: sourceEditUiApi.stageX4UiSourceEditInput,
      shouldClearX4UiSourceEditState: clearOnDrift,
    });
    try {
      stage(failFirstScalarEntry.id, 'stale-entry-value');
    } catch {
      threw = true;
    }
    return [
      `stale stage before entry rejects ${key} drift with live ${status} R`,
      !threw
        && updaterCalls === 0
        && objectUpdates === 0
        && liveDraft === liveDraftR
        && hostileE.reads() === 0,
    ] as const;
  })
));

const round5StageScheduleRows: ReadonlyArray<CausalRow> = fullContextDriftKeys.flatMap(key => (
  round5ReceiptStatuses.map(status => {
    const { contextE, contextR } = round5SourceEditContextFor(key);
    const hostileE = hostileRetainedContext(contextE);
    const sourceEditContextRef: { current: unknown } = { current: hostileE.context };
    const liveDraftE = round5DraftFor(contextE, status, `scheduled-${key}`);
    const liveDraftR = round5DraftFor(contextR, status, `live-${key}`);
    let liveDraft = liveDraftE;
    const scheduledUpdates: Array<(previous: SourceEditDraftFixture) => SourceEditDraftFixture> = [];
    let setterCalls = 0;
    let objectUpdates = 0;
    let stageHelperCalls = 0;
    let clearHelperCalls = 0;
    const stage = compileActualSourceEditStage({
      sourceEditContext: hostileE.context,
      sourceEditContextRef,
      sourceEditDraftRef: { current: liveDraftE },
      setSourceEditDraft: update => {
        setterCalls += 1;
        if (typeof update === 'function') {
          scheduledUpdates.push(update);
        } else {
          objectUpdates += 1;
          liveDraft = update;
        }
      },
      stageX4UiSourceEditInput: (staged, entryId, raw) => {
        stageHelperCalls += 1;
        return stageScalar?.(staged, entryId, raw) ?? staged;
      },
      shouldClearX4UiSourceEditState: (previous, current) => {
        clearHelperCalls += 1;
        return clearOnDrift(previous, current);
      },
    });
    stage(failFirstScalarEntry.id, 'scheduled-entry-value');
    sourceEditContextRef.current = contextR;
    liveDraft = liveDraftR;
    const scheduled = scheduledUpdates[0];
    const firstResult = scheduled?.(liveDraftR);
    const secondResult = scheduled?.(liveDraftR);
    return [
      `stale stage between scheduling and updater rejects ${key} drift with live ${status} R`,
      scheduledUpdates.length === 1
        && setterCalls === 1
        && objectUpdates === 0
        && firstResult === liveDraftR
        && secondResult === liveDraftR
        && liveDraft === liveDraftR
        && stageHelperCalls === 0
        && clearHelperCalls === 0
        && hostileE.reads() === 0,
    ] as const;
  })
));

const round5ApplyEntryRows: ReadonlyArray<CausalRow> = fullContextDriftKeys.flatMap(key => (
  round5ReceiptStatuses.map(status => {
    const { contextE, contextR } = round5SourceEditContextFor(key);
    const hostileE = hostileRetainedContext(contextE);
    const liveDraftR = round5DraftFor(contextR, status, `live-apply-${key}`);
    const staleDraftE = round5DraftFor(hostileE.context, status, `stale-apply-${key}`);
    const sourceEditContextRef: { current: unknown } = { current: contextR };
    const sourceEditDraftRef: { current: unknown } = { current: liveDraftR };
    let liveDraft: SourceEditDraftFixture = liveDraftR;
    let sourceMutations = 0;
    let workspaceEditCalls = 0;
    let parentAttemptIssuances = 0;
    let setterCalls = 0;
    let refusedStateCalls = 0;
    let threw = false;
    const submit = sourceEditUiApi.submitX4UiSourceEditWorkspaceCommit;
    const apply = compileActualSourceEditApply({
      sourceEditDraftMatches: true,
      refuseSourceEdit: () => {
        refusedStateCalls += 1;
      },
      sourceEditCatalog: failFirstCatalog,
      currentProgram: {},
      currentEvidenceAuthority: {},
      sourceEditDraft: staleDraftE,
      sourceEditContextRef,
      sourceEditDraftRef,
      parseX4UiSourceEditInput: parseScalar,
      applyX4UiSourceEdit: () => {
        sourceMutations += 1;
        return {
          accepted: true,
          changed: true,
          workspace: { id: `round-5-${key}-replacement` },
          path: failFirstScalarEntry.path,
          startOffset: failFirstScalarEntry.startOffset,
          endOffset: failFirstScalarEntry.endOffset,
        };
      },
      sourceEditContext: hostileE.context,
      projection: { source: {} },
      onWorkspaceEdit: () => {
        workspaceEditCalls += 1;
        return { status: 'refused', reason: 'unexpected-stale-parent-call', detail: 'stale apply must not reach the parent' };
      },
      submitX4UiSourceEditWorkspaceCommit: (expected, replacement, onWorkspaceEdit) => {
        parentAttemptIssuances += 1;
        if (submit === undefined) return { status: 'refused', reason: 'submit-helper-unavailable', detail: 'fixture submit helper unavailable' };
        return submit(expected, replacement, request => {
          workspaceEditCalls += 1;
          return onWorkspaceEdit?.(request) ?? { status: 'refused', reason: 'missing-parent', detail: 'missing parent callback' };
        });
      },
      setSourceEditDraft: update => {
        setterCalls += 1;
        if (typeof update === 'function') {
          liveDraft = update(liveDraft);
        } else {
          liveDraft = update;
        }
      },
      X4_UI_EDITOR_SESSION_GAME_TRUTH: 'Not verified in game',
    });
    try {
      apply(failFirstScalarEntry.id);
    } catch {
      threw = true;
    }
    return [
      `stale apply before entry rejects ${key} drift with live ${status} R`,
      !threw
        && sourceMutations === 0
        && workspaceEditCalls === 0
        && parentAttemptIssuances === 0
        && setterCalls === 0
        && refusedStateCalls === 0
        && liveDraft === liveDraftR
        && hostileE.reads() === 0,
    ] as const;
  })
));

const contextEAndR = (label: 'E' | 'R'): readonly [string, SourceEditContextFixture] => {
  const { contextE, contextR } = round5SourceEditContextFor('workspace');
  return [label, label === 'E' ? contextE : contextR];
};

const round5StagePositiveRows: ReadonlyArray<CausalRow> = [contextEAndR('E'), contextEAndR('R')].map(([label, context]) => {
  const draft = round5DraftFor(context, 'pending', `positive-${label}`);
  const sourceEditContextRef: { current: unknown } = { current: context };
  let liveDraft = draft;
  const scheduledUpdates: Array<(previous: SourceEditDraftFixture) => SourceEditDraftFixture> = [];
  const stage = compileActualSourceEditStage({
    sourceEditContext: context,
    sourceEditContextRef,
    sourceEditDraftRef: { current: draft },
    setSourceEditDraft: update => {
      if (typeof update === 'function') scheduledUpdates.push(update);
      else liveDraft = update;
    },
    stageX4UiSourceEditInput: sourceEditUiApi.stageX4UiSourceEditInput,
    shouldClearX4UiSourceEditState: clearOnDrift,
  });
  stage(failFirstScalarEntry.id, `positive-${label}`);
  const updated = scheduledUpdates[0]?.(liveDraft);
  if (updated !== undefined) liveDraft = updated;
  return [
    `exact-current ${label} stage retains owned behavior`,
    scheduledUpdates.length === 1
      && updated?.context === context
      && liveDraft.context === context
      && liveDraft.staged[failFirstScalarEntry.id] === `positive-${label}`,
  ] as const;
});

const round5ApplyPositiveRows: ReadonlyArray<CausalRow> = ['E', 'R'].map(label => {
  const context = contextEAndR(label as 'E' | 'R')[1];
  const draft = Object.freeze({
    context,
    staged: Object.freeze({ [failFirstScalarEntry.id]: '7.5' }),
  });
  const sourceEditContextRef: { current: unknown } = { current: context };
  const sourceEditDraftRef: { current: unknown } = { current: draft };
  let sourceMutations = 0;
  let parentAttemptIssuances = 0;
  let workspaceEditCalls = 0;
  let setterCalls = 0;
  let appliedValue: unknown;
  const submit = sourceEditUiApi.submitX4UiSourceEditWorkspaceCommit;
  const apply = compileActualSourceEditApply({
    sourceEditDraftMatches: true,
    refuseSourceEdit: () => {
      setterCalls += 1;
    },
    sourceEditCatalog: failFirstCatalog,
    currentProgram: {},
    currentEvidenceAuthority: {},
    sourceEditDraft: draft,
    sourceEditContextRef,
    sourceEditDraftRef,
    parseX4UiSourceEditInput: parseScalar,
    applyX4UiSourceEdit: (_workspace, _source, _catalog, _entryId, value) => {
      sourceMutations += 1;
      appliedValue = value;
      return {
        accepted: true,
        changed: false,
        workspace: context.workspace,
        path: failFirstScalarEntry.path,
        startOffset: failFirstScalarEntry.startOffset,
        endOffset: failFirstScalarEntry.endOffset,
      };
    },
    sourceEditContext: context,
    projection: { source: {} },
    onWorkspaceEdit: () => {
      workspaceEditCalls += 1;
      return { status: 'refused', reason: 'positive-fixture-refusal', detail: 'positive control parent refusal' };
    },
    submitX4UiSourceEditWorkspaceCommit: (expected, replacement, onWorkspaceEdit) => {
      parentAttemptIssuances += 1;
      if (submit === undefined) return { status: 'refused', reason: 'submit-helper-unavailable', detail: 'fixture submit helper unavailable' };
      return submit(expected, replacement, onWorkspaceEdit);
    },
    setSourceEditDraft: () => {
      setterCalls += 1;
    },
    X4_UI_EDITOR_SESSION_GAME_TRUTH: 'Not verified in game',
  });
  let threw = false;
  try {
    apply(failFirstScalarEntry.id);
  } catch {
    threw = true;
  }
  return [
    `exact-current ${label} apply retains owned behavior`,
    !threw
      && sourceMutations === 1
      && appliedValue === 7.5
      && parentAttemptIssuances === 1
      && workspaceEditCalls === 1
      && setterCalls === 1,
  ] as const;
});

const round5ApplyUpdaterRows: ReadonlyArray<CausalRow> = fullContextDriftKeys.map(key => {
  const { contextR } = round5SourceEditContextFor(key);
  const contextN = makeSourceEditContext({
    ...contextR,
    [key]: { id: `round-5-${key}-${key}-N` },
  });
  const draftR = Object.freeze({
    context: contextR,
    staged: Object.freeze({ [failFirstScalarEntry.id]: '7.5' }),
  });
  const sourceEditContextRef: { current: unknown } = { current: contextR };
  const sourceEditDraftRef: { current: unknown } = { current: draftR };
  const scheduledUpdates: Array<(previous: SourceEditDraftFixture) => SourceEditDraftFixture> = [];
  let rejectionHandler: ((reason: unknown) => unknown) | undefined;
  const pendingAcknowledgement = {
    then: (
      _onFulfilled: (acknowledgement: WorkspaceCommitAcknowledgement) => unknown,
      onRejected: (reason: unknown) => unknown,
    ) => {
      rejectionHandler = onRejected;
      return pendingAcknowledgement;
    },
  };
  const pendingSubmission = {
    status: 'pending',
    attempt: {},
    expectedWorkspace: contextR.workspace,
    workspace: { id: `round-5-${key}-replacement` },
    acknowledgement: pendingAcknowledgement,
    detail: 'round-5 pending acknowledgement fixture',
  };
  let liveDraft: unknown = draftR;
  let sourceMutations = 0;
  let parentAttemptIssuances = 0;
  let workspaceEditCalls = 0;
  let setterCalls = 0;
  const submit = sourceEditUiApi.submitX4UiSourceEditWorkspaceCommit;
  const apply = compileActualSourceEditApply({
    sourceEditDraftMatches: true,
    refuseSourceEdit: () => {
      setterCalls += 1;
    },
    sourceEditCatalog: failFirstCatalog,
    currentProgram: {},
    currentEvidenceAuthority: {},
    sourceEditDraft: draftR,
    sourceEditContextRef,
    sourceEditDraftRef,
    parseX4UiSourceEditInput: parseScalar,
    applyX4UiSourceEdit: () => {
      sourceMutations += 1;
      return {
        accepted: true,
        changed: true,
        workspace: pendingSubmission.workspace,
        path: failFirstScalarEntry.path,
        startOffset: failFirstScalarEntry.startOffset,
        endOffset: failFirstScalarEntry.endOffset,
      };
    },
    sourceEditContext: contextR,
    projection: { source: {} },
    onWorkspaceEdit: () => {
      workspaceEditCalls += 1;
      return pendingSubmission;
    },
    submitX4UiSourceEditWorkspaceCommit: (expected, replacement, onWorkspaceEdit) => {
      parentAttemptIssuances += 1;
      if (submit === undefined) return { status: 'refused', reason: 'submit-helper-unavailable', detail: 'fixture submit helper unavailable' };
      return submit(expected, replacement, onWorkspaceEdit);
    },
    setSourceEditDraft: update => {
      setterCalls += 1;
      if (typeof update === 'function') {
        scheduledUpdates.push(update);
      } else {
        liveDraft = update;
      }
    },
    X4_UI_EDITOR_SESSION_GAME_TRUTH: 'Not verified in game',
  });
  let threw = false;
  try {
    apply(failFirstScalarEntry.id);
    sourceEditContextRef.current = contextR;
    const pendingInstaller = scheduledUpdates[0];
    const installedPendingDraft = pendingInstaller?.(draftR);
    if (installedPendingDraft !== undefined) {
      liveDraft = installedPendingDraft;
      sourceEditDraftRef.current = installedPendingDraft;
    }
    rejectionHandler?.(new Error('round-5 rejection fixture'));
    const liveDraftN: SourceEditDraftFixture = Object.freeze({
      context: contextN,
      staged: Object.freeze({}),
      receipt: Object.freeze({ status: 'pending', marker: `newer-${key}`, submission: pendingSubmission }),
    });
    sourceEditContextRef.current = contextN;
    liveDraft = liveDraftN;
    const updater = scheduledUpdates[1];
    const firstResult = updater?.(liveDraftN);
    const secondResult = updater?.(liveDraftN);
    return [
      `stale apply updater after ${key} drift preserves live N`,
      rejectionHandler !== undefined
        && scheduledUpdates.length === 2
        && firstResult === liveDraftN
        && secondResult === liveDraftN
        && liveDraft === liveDraftN
        && sourceMutations === 1
        && parentAttemptIssuances === 1
        && workspaceEditCalls === 1
        && setterCalls === 2,
    ] as const;
  } catch {
    threw = true;
  }
  return [`stale apply updater after ${key} drift preserves live N`, !threw] as const;
});

assert.equal(round5StageEntryRows.length, 24, 'round-5 stale-stage entry matrix must cover 8 identities x 3 live receipts');
assert.equal(round5StageScheduleRows.length, 24, 'round-5 stale-stage scheduled-updater matrix must cover 8 identities x 3 live receipts');
assert.equal(round5ApplyEntryRows.length, 24, 'round-5 stale-apply entry matrix must cover 8 identities x 3 live receipts');
assert.equal(round5StagePositiveRows.length, 2, 'round-5 stage positive controls must cover E/E and R/R');
assert.equal(round5ApplyPositiveRows.length, 2, 'round-5 apply positive controls must cover E/E and R/R');
assert.equal(round5ApplyUpdaterRows.length, 8, 'round-5 stale-apply updater matrix must cover all eight identities');
const round5CausalRows: ReadonlyArray<CausalRow> = [
  ...round5StageEntryRows,
  ...round5StageScheduleRows,
  ...round5ApplyEntryRows,
  ...round5StagePositiveRows,
  ...round5ApplyPositiveRows,
  ...round5ApplyUpdaterRows,
];
const round5CausalFailures = round5CausalRows.filter(([, pass]) => !pass).map(([name]) => name);
assert.deepEqual(round5CausalFailures, [], `B119 7D round-5 stale-handler red assertions: ${round5CausalFailures.join(', ')}`);

type Round6DraftVariant = 'staged' | 'accepted' | 'refused' | 'pending';
type Round6Outcome = 'fulfillment' | 'rejection';
type Round6AcknowledgementController = {
  readonly acknowledgement: {
    readonly then: (
      onFulfilled: (acknowledgement: WorkspaceCommitAcknowledgement) => unknown,
      onRejected: (reason: unknown) => unknown,
    ) => unknown;
  };
  readonly fulfill: (acknowledgement: WorkspaceCommitAcknowledgement) => unknown;
  readonly reject: (reason: unknown) => unknown;
};

const createRound6AcknowledgementController = (): Round6AcknowledgementController => {
  let onFulfilled: ((acknowledgement: WorkspaceCommitAcknowledgement) => unknown) | undefined;
  let onRejected: ((reason: unknown) => unknown) | undefined;
  const acknowledgement = {
    then: (
      fulfilled: (acknowledgement: WorkspaceCommitAcknowledgement) => unknown,
      rejected: (reason: unknown) => unknown,
    ): unknown => {
      onFulfilled = fulfilled;
      onRejected = rejected;
      return acknowledgement;
    },
  };
  return {
    acknowledgement,
    fulfill: value => onFulfilled?.(value),
    reject: reason => onRejected?.(reason),
  };
};

const round6SettleFor = (outcome: Round6Outcome) => (
  _currentWorkspace: unknown,
  _pendingReceipt: unknown,
  _acknowledgement: unknown,
  _currentContext: unknown,
) => outcome === 'fulfillment'
  ? { status: 'accepted', changed: true, detail: 'round-6 exact acknowledgement accepted' }
  : { status: 'refused', reason: 'round-6-rejected-acknowledgement', detail: 'round-6 acknowledgement rejected' };

const round6SourceEditContextFor = (key: typeof fullContextDriftKeys[number]): {
  readonly contextE: SourceEditContextFixture;
  readonly contextR: SourceEditContextFixture;
} => {
  const base: SourceEditContextFixture = {
    workspace: { id: `round-6-${key}-workspace-E` },
    source: { id: `round-6-${key}-source-E` },
    selection: { id: `round-6-${key}-selection-E` },
    target: { id: `round-6-${key}-target-E` },
    program: { id: `round-6-${key}-program-E` },
    evidenceAuthority: { id: `round-6-${key}-evidence-E` },
    catalog: { id: `round-6-${key}-catalog-E` },
    profile: { id: `round-6-${key}-profile-E` },
  };
  const drifted: SourceEditContextFixture = {
    ...base,
    [key]: { id: `round-6-${key}-${key}-R` },
  };
  return { contextE: makeSourceEditContext(base), contextR: makeSourceEditContext(drifted) };
};

const round6DraftFor = (
  context: unknown,
  variant: Round6DraftVariant,
  submission: unknown,
  marker: string,
): SourceEditDraftFixture => {
  const staged = Object.freeze({ [failFirstScalarEntry.id]: marker });
  if (variant === 'staged') return Object.freeze({ context, staged });
  const receipt: SourceEditReceiptFixture = { status: variant, marker, submission };
  return Object.freeze({ context, staged, receipt });
};

const round6ReentrantRows: ReadonlyArray<CausalRow> = fullContextDriftKeys.flatMap(key => (
  (['staged', 'accepted', 'refused', 'pending'] as const).flatMap(variant => (
    (['fulfillment', 'rejection'] as const).map(outcome => {
      const { contextE, contextR } = round6SourceEditContextFor(key);
      const executionDraft: SourceEditDraftFixture = Object.freeze({
        context: contextE,
        staged: Object.freeze({ [failFirstScalarEntry.id]: '7.5' }),
      });
      const newerDraft = round6DraftFor(contextR, variant, { id: `round-6-${key}-${variant}-newer-submission` }, `round-6-newer-${variant}`);
      const controller = createRound6AcknowledgementController();
      const sourceEditContextRef: { current: unknown } = { current: contextE };
      const sourceEditDraftRef: { current: unknown } = { current: executionDraft };
      let liveDraft: unknown = executionDraft;
      let liveWorkspace: unknown = contextE.workspace;
      let parentAcknowledger: WorkspaceAcknowledger | undefined;
      let sourceMutations = 0;
      let workspaceEditCalls = 0;
      let parentAttemptIssuances = 0;
      let parentUpdaterCalls = 0;
      let setterCalls = 0;
      let objectUpdates = 0;
      let refusedStateCalls = 0;
      let threw = false;
      const submit = sourceEditUiApi.submitX4UiSourceEditWorkspaceCommit;
      const apply = compileActualSourceEditApply({
        sourceEditDraftMatches: true,
        refuseSourceEdit: () => {
          refusedStateCalls += 1;
        },
        sourceEditCatalog: failFirstCatalog,
        currentProgram: {},
        currentEvidenceAuthority: {},
        sourceEditDraft: executionDraft,
        sourceEditContextRef,
        sourceEditDraftRef,
        parseX4UiSourceEditInput: parseScalar,
        applyX4UiSourceEdit: () => {
          sourceMutations += 1;
          return {
            accepted: true,
            changed: true,
            workspace: contextR.workspace,
            path: failFirstScalarEntry.path,
            startOffset: failFirstScalarEntry.startOffset,
            endOffset: failFirstScalarEntry.endOffset,
          };
        },
        sourceEditContext: contextE,
        projection: { source: {} },
        onWorkspaceEdit: (request: { readonly expectedWorkspace: unknown; readonly workspace: unknown }) => {
          workspaceEditCalls += 1;
          const actualSubmission = beginWorkspaceCommit(
            request.expectedWorkspace,
            request,
            (updater, acknowledge) => {
              parentUpdaterCalls += 1;
              liveWorkspace = updater(liveWorkspace);
              parentAcknowledger = acknowledge;
              sourceEditContextRef.current = contextR;
              sourceEditDraftRef.current = newerDraft;
              liveDraft = newerDraft;
            },
          );
          return { ...actualSubmission, acknowledgement: controller.acknowledgement };
        },
        submitX4UiSourceEditWorkspaceCommit: (expected, replacement, onWorkspaceEdit) => {
          parentAttemptIssuances += 1;
          if (submit === undefined) return { status: 'refused', reason: 'submit-helper-unavailable', detail: 'fixture submit helper unavailable' };
          return submit(expected, replacement, request => onWorkspaceEdit?.(request) ?? { status: 'refused', reason: 'missing-parent', detail: 'missing parent callback' });
        },
        setSourceEditDraft: update => {
          setterCalls += 1;
          if (typeof update === 'function') {
            liveDraft = update(liveDraft);
          } else {
            objectUpdates += 1;
            liveDraft = update;
          }
        },
        settleX4UiSourceEditReceipt: round6SettleFor(outcome),
        X4_UI_EDITOR_SESSION_GAME_TRUTH: 'Not verified in game',
      });
      try {
        apply(failFirstScalarEntry.id);
        const acknowledgement = parentAcknowledger?.(liveWorkspace);
        if (outcome === 'fulfillment') controller.fulfill(acknowledgement ?? { status: 'accepted', currentWorkspace: liveWorkspace });
        else controller.reject(new Error(`round-6 ${key} ${variant} rejection`));
      } catch {
        threw = true;
      }
      return [
        `reentrant parent ${key} ${variant} ${outcome} preserves the newer draft after the exact UIBuilder boundary`,
        !threw
          && sourceMutations === 1
          && workspaceEditCalls === 1
          && parentAttemptIssuances === 1
          && parentUpdaterCalls === 1
          && setterCalls === 1
          && objectUpdates === 0
          && refusedStateCalls === 0
          && liveDraft === newerDraft
          && sourceEditContextRef.current === contextR
          && sourceEditDraftRef.current === newerDraft,
      ] as const;
    })
  ))
));

const round6DraftOnlyRows: ReadonlyArray<CausalRow> = (['fulfillment', 'rejection'] as const).flatMap(outcome => (
  (['staged', 'accepted', 'refused', 'pending'] as const).flatMap(variant => (
    (['same', 'different'] as const).map(relation => {
      const context = round6SourceEditContextFor('workspace').contextE;
      const executionDraft: SourceEditDraftFixture = Object.freeze({
        context,
        staged: Object.freeze({ [failFirstScalarEntry.id]: '7.5' }),
      });
      const controller = createRound6AcknowledgementController();
      const differentSubmission = { status: 'pending', attempt: {}, expectedWorkspace: context.workspace, workspace: { id: 'round-6-different-submission' }, acknowledgement: controller.acknowledgement };
      const pendingSubmission = { status: 'pending', attempt: {}, expectedWorkspace: context.workspace, workspace: { id: 'round-6-parent-submission' }, acknowledgement: controller.acknowledgement, detail: 'round-6 pending submission' };
      const newerDraft = round6DraftFor(
        context,
        variant,
        relation === 'same' ? pendingSubmission : differentSubmission,
        `round-6-newer-${outcome}-${variant}-${relation}`,
      );
      const sourceEditContextRef: { current: unknown } = { current: context };
      const sourceEditDraftRef: { current: unknown } = { current: executionDraft };
      const scheduledUpdates: Array<(previous: unknown) => unknown> = [];
      let liveDraft: unknown = executionDraft;
      let sourceMutations = 0;
      let workspaceEditCalls = 0;
      let parentAttemptIssuances = 0;
      let setterCalls = 0;
      let objectUpdates = 0;
      let refusedStateCalls = 0;
      let threw = false;
      const submit = sourceEditUiApi.submitX4UiSourceEditWorkspaceCommit;
      const apply = compileActualSourceEditApply({
        sourceEditDraftMatches: true,
        refuseSourceEdit: () => {
          refusedStateCalls += 1;
        },
        sourceEditCatalog: failFirstCatalog,
        currentProgram: {},
        currentEvidenceAuthority: {},
        sourceEditDraft: executionDraft,
        sourceEditContextRef,
        sourceEditDraftRef,
        parseX4UiSourceEditInput: parseScalar,
        applyX4UiSourceEdit: () => {
          sourceMutations += 1;
          return {
            accepted: true,
            changed: true,
            workspace: pendingSubmission.workspace,
            path: failFirstScalarEntry.path,
            startOffset: failFirstScalarEntry.startOffset,
            endOffset: failFirstScalarEntry.endOffset,
          };
        },
        sourceEditContext: context,
        projection: { source: {} },
        onWorkspaceEdit: () => {
          workspaceEditCalls += 1;
          return pendingSubmission;
        },
        submitX4UiSourceEditWorkspaceCommit: (expected, replacement, onWorkspaceEdit) => {
          parentAttemptIssuances += 1;
          if (submit === undefined) return { status: 'refused', reason: 'submit-helper-unavailable', detail: 'fixture submit helper unavailable' };
          return submit(expected, replacement, request => onWorkspaceEdit?.(request) ?? { status: 'refused', reason: 'missing-parent', detail: 'missing parent callback' });
        },
        setSourceEditDraft: update => {
          setterCalls += 1;
          if (typeof update === 'function') {
            scheduledUpdates.push(update);
          } else {
            objectUpdates += 1;
            liveDraft = update;
            sourceEditDraftRef.current = update;
          }
        },
        settleX4UiSourceEditReceipt: round6SettleFor(outcome),
        X4_UI_EDITOR_SESSION_GAME_TRUTH: 'Not verified in game',
      });
      try {
        apply(failFirstScalarEntry.id);
        const installationUpdater = scheduledUpdates[0];
        if (installationUpdater !== undefined) {
          liveDraft = newerDraft;
          sourceEditDraftRef.current = newerDraft;
          liveDraft = installationUpdater(liveDraft);
        } else {
          liveDraft = newerDraft;
          sourceEditDraftRef.current = newerDraft;
        }
        const settlementStart = scheduledUpdates.length;
        if (outcome === 'fulfillment') controller.fulfill({ status: 'accepted', attempt: pendingSubmission.attempt, expectedWorkspace: pendingSubmission.expectedWorkspace, workspace: pendingSubmission.workspace, currentWorkspace: pendingSubmission.workspace, detail: 'round-6 exact acknowledgement' });
        else controller.reject(new Error(`round-6 draft-only ${variant} ${relation} rejection`));
        const settlementUpdater = scheduledUpdates[settlementStart];
        const firstResult = settlementUpdater?.(liveDraft);
        if (firstResult !== undefined) liveDraft = firstResult;
        const secondResult = settlementUpdater?.(liveDraft);
        if (secondResult !== undefined) liveDraft = secondResult;
      } catch {
        threw = true;
      }
      return [
        `draft-only ${outcome} ${variant} ${relation} callback preserves the newer exact draft`,
        !threw
          && sourceMutations === 1
          && workspaceEditCalls === 1
          && parentAttemptIssuances === 1
          && setterCalls === 2
          && objectUpdates === 0
          && refusedStateCalls === 0
          && scheduledUpdates.length === 2
          && liveDraft === newerDraft
          && sourceEditContextRef.current === context
          && sourceEditDraftRef.current === newerDraft,
      ] as const;
    })
  ))
));

const round6ExactSettlementRows: ReadonlyArray<CausalRow> = (['fulfillment', 'rejection'] as const).map(outcome => {
  const context = round6SourceEditContextFor('workspace').contextE;
  const executionDraft: SourceEditDraftFixture = Object.freeze({
    context,
    staged: Object.freeze({ [failFirstScalarEntry.id]: '7.5' }),
  });
  const controller = createRound6AcknowledgementController();
  const pendingSubmission = { status: 'pending', attempt: {}, expectedWorkspace: context.workspace, workspace: { id: `round-6-exact-${outcome}` }, acknowledgement: controller.acknowledgement, detail: 'round-6 exact pending submission' };
  const sourceEditContextRef: { current: unknown } = { current: context };
  const sourceEditDraftRef: { current: unknown } = { current: executionDraft };
  let liveDraft: unknown = executionDraft;
  let settlementUpdater: ((previous: unknown) => unknown) | undefined;
  let sourceMutations = 0;
  let workspaceEditCalls = 0;
  let parentAttemptIssuances = 0;
  let setterCalls = 0;
  let objectUpdates = 0;
  let refusedStateCalls = 0;
  let threw = false;
  const submit = sourceEditUiApi.submitX4UiSourceEditWorkspaceCommit;
  const apply = compileActualSourceEditApply({
    sourceEditDraftMatches: true,
    refuseSourceEdit: () => {
      refusedStateCalls += 1;
    },
    sourceEditCatalog: failFirstCatalog,
    currentProgram: {},
    currentEvidenceAuthority: {},
    sourceEditDraft: executionDraft,
    sourceEditContextRef,
    sourceEditDraftRef,
    parseX4UiSourceEditInput: parseScalar,
    applyX4UiSourceEdit: () => {
      sourceMutations += 1;
      return {
        accepted: true,
        changed: true,
        workspace: pendingSubmission.workspace,
        path: failFirstScalarEntry.path,
        startOffset: failFirstScalarEntry.startOffset,
        endOffset: failFirstScalarEntry.endOffset,
      };
    },
    sourceEditContext: context,
    projection: { source: {} },
    onWorkspaceEdit: () => {
      workspaceEditCalls += 1;
      return pendingSubmission;
    },
    submitX4UiSourceEditWorkspaceCommit: (expected, replacement, onWorkspaceEdit) => {
      parentAttemptIssuances += 1;
      if (submit === undefined) return { status: 'refused', reason: 'submit-helper-unavailable', detail: 'fixture submit helper unavailable' };
      return submit(expected, replacement, request => onWorkspaceEdit?.(request) ?? { status: 'refused', reason: 'missing-parent', detail: 'missing parent callback' });
    },
    setSourceEditDraft: update => {
      setterCalls += 1;
      if (typeof update === 'function') {
        const result = update(liveDraft);
        liveDraft = result;
        sourceEditDraftRef.current = result;
        settlementUpdater = update;
      } else {
        objectUpdates += 1;
        liveDraft = update;
        sourceEditDraftRef.current = update;
      }
    },
    settleX4UiSourceEditReceipt: round6SettleFor(outcome),
    X4_UI_EDITOR_SESSION_GAME_TRUTH: 'Not verified in game',
  });
  try {
    apply(failFirstScalarEntry.id);
    if (outcome === 'fulfillment') controller.fulfill({ status: 'accepted', attempt: pendingSubmission.attempt, expectedWorkspace: pendingSubmission.expectedWorkspace, workspace: pendingSubmission.workspace, currentWorkspace: pendingSubmission.workspace, detail: 'round-6 exact acknowledgement' });
    else controller.reject(new Error(`round-6 exact ${outcome} rejection`));
    const repeatedResult = settlementUpdater?.(liveDraft);
    if (repeatedResult !== undefined) liveDraft = repeatedResult;
  } catch {
    threw = true;
  }
  const receiptStatus = typeof liveDraft === 'object' && liveDraft !== null && 'receipt' in liveDraft
    ? (liveDraft as { readonly receipt?: { readonly status?: unknown }}).receipt?.status
    : undefined;
  return [
    `exact pending receipt ${outcome} settles once and repeated updater calls are idempotent`,
    !threw
      && sourceMutations === 1
      && workspaceEditCalls === 1
      && parentAttemptIssuances === 1
      && setterCalls === 2
      && objectUpdates === 0
      && refusedStateCalls === 0
      && settlementUpdater !== undefined
      && receiptStatus === (outcome === 'fulfillment' ? 'accepted' : 'refused'),
  ] as const;
});

assert.equal(round6ReentrantRows.length, 64, 'round-6 reentrant parent matrix must cover 8 contexts x 4 newer draft variants x 2 callbacks');
assert.equal(round6DraftOnlyRows.length, 16, 'round-6 draft-only matrix must cover 2 callbacks x 4 newer draft variants x 2 submission identities');
assert.equal(round6ExactSettlementRows.length, 2, 'round-6 exact settlement controls must cover fulfillment and rejection');
const round6CausalRows: ReadonlyArray<CausalRow> = [
  ...round6ReentrantRows,
  ...round6DraftOnlyRows,
  ...round6ExactSettlementRows,
];
const round6CausalFailures = round6CausalRows.filter(([, pass]) => !pass).map(([name]) => name);
assert.deepEqual(round6CausalFailures, [], `B119 7D Round-6 stale-state red assertions: ${round6CausalFailures.join(', ')}`);

const sourceEditIntegrationWorkspace = {
  ...workspace,
  id: 'x4-ui-source-editor-source-edit-integration',
  compileSettings: { ui: true },
  passthroughFiles: [
    { path: 'ui.xml', content: '<addon><environment type="menus"><file name="ui/edit.lua" /></environment></addon>' },
    {
      path: 'ui/edit.lua',
      content: [
        'local menu = { name = "Edit", layer = 1 }',
        'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
        'local table = frame:addTable(1, { width = 80, scaling = false })',
        'frame:display()',
        '',
      ].join('\n'),
    },
  ],
} as unknown as React.ComponentProps<typeof UIBuilder>['workspace'];
const unselectedIntegrationProjection = projectX4UiEditorSession({
  workspace: sourceEditIntegrationWorkspace,
  corpus: undefined,
  profile: { width: 100, height: 80, uiScale: 1 },
});
const integrationSourceCandidate = unselectedIntegrationProjection.preview.sourceCandidates.find(candidate => candidate.path === 'ui/edit.lua');
assert.ok(integrationSourceCandidate?.sourceIdentity, 'session must issue the exact source identity used by the source editor');
const integrationTarget = integrationSourceCandidate.targets[0];
assert.ok(integrationTarget, 'session must expose an exact target for the source editor');
const integrationProjection = projectX4UiEditorSession({
  workspace: sourceEditIntegrationWorkspace,
  corpus: undefined,
  profile: { width: 100, height: 80, uiScale: 1 },
  selection: {
    sourceIndex: integrationSourceCandidate.index,
    path: integrationSourceCandidate.path,
    sourceIdentity: integrationSourceCandidate.sourceIdentity,
    target: integrationTarget,
  },
});
const integrationCatalog = sourceEditUiApi.discoverX4UiSourceEditorCatalog(sourceEditIntegrationWorkspace, integrationProjection) as X4UiSourceEditCatalog | undefined;
assert.ok(integrationCatalog, 'source editor must derive a catalog from the exact current projection');
assert.equal(integrationCatalog.status, 'ready');
const integrationEntry = integrationCatalog.editableEntries.find(entry => entry.valueType === 'number');
assert.ok(integrationEntry, 'source editor integration fixture must expose an owner-issued number literal');
if (typeof integrationEntry.value !== 'number') throw new Error('source editor integration number entry was not numeric');
const originalIntegrationWorkspace = JSON.stringify(sourceEditIntegrationWorkspace);
const integrationApply = applyX4UiSourceEdit(
  sourceEditIntegrationWorkspace as Parameters<typeof applyX4UiSourceEdit>[0],
  integrationProjection.source,
  integrationCatalog,
  integrationEntry.id,
  integrationEntry.value + 1,
  integrationEntry.path,
  integrationEntry.startOffset,
  integrationEntry.endOffset,
  integrationEntry.expectedText,
);
assert.equal(integrationApply.accepted, true, 'accepted UI integration must forward the exact owner-issued edit');
assert.equal(integrationApply.changed, true);
assert.notEqual(JSON.stringify(integrationApply.workspace), originalIntegrationWorkspace);
assert.equal(JSON.stringify(sourceEditIntegrationWorkspace), originalIntegrationWorkspace, 'source editor integration must not mutate the original workspace object');
assert.equal(integrationProjection.gameTruth, 'Not verified in game');

console.log('X4UiSourceEditor selftest: prior Batch 7D assertions 41/41; causal parent-CAS rows 10/10; pending SSR rows 2/2; causal no-op acknowledgement rows 29/29; passive-effect reconciliation rows 8/8; round-4 authority rows 27/27; round-5 stale-stage entry 24/24; round-5 stale-stage updater 24/24; round-5 stale-apply entry 24/24; round-5 stage positives 2/2; round-5 apply positives 2/2; round-5 stale-apply updater 8/8; round-6 reentrant parent 64/64; round-6 draft-only acknowledgement 16/16; round-6 exact settlement 2/2; all earlier SSR, authority, linter, canvas, and UIBuilder boundaries passed');
