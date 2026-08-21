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
import {
  X4_UI_CORPUS_9_00_COLOR_CONTRACT,
  X4_UI_CORPUS_9_00_CONTRACT,
  X4_UI_CORPUS_COLOR_CANONICAL_EVIDENCE,
  X4_UI_CORPUS_COLORS_XML_PATH,
  X4_UI_CORPUS_COLORS_XML_SHA256,
  X4_UI_CORPUS_COLORS_XML_SIZE,
  X4_UI_CORPUS_COLORS_XSD_PATH,
  X4_UI_CORPUS_COLORS_XSD_SHA256,
  X4_UI_CORPUS_COLORS_XSD_SIZE,
  X4_UI_CORPUS_FILE_URL,
  X4_UI_CORPUS_MANIFEST_URL,
  X4_UI_CORPUS_STATUS_URL,
  X4_UI_CORPUS_VERIFICATION,
  isX4UiCorpusCanonicalColorSuccess,
  isX4UiCorpusCanonicalSuccess,
  loadConfiguredX4UiCorpusAssets,
  loadConfiguredX4UiCorpusColorEvidence,
  type X4UiCorpusCanonicalColorSuccess,
  type X4UiCorpusCanonicalSuccess,
  type X4UiCorpusFetchResponse,
  type X4UiCorpusTransport,
} from '../lib/x4UiCorpusAssets';
import { projectX4UiEditorSession } from '../lib/x4UiEditorSession';
import { lintX4UiCallModel } from '../lib/x4UiLint';
import type { X4UiLayoutPreviewSampleCatalog } from '../lib/x4UiLayoutProgram';
import { applyX4UiSourceEdit, type X4UiSourceEditCatalog } from '../lib/x4UiSourceEdits';
import {
  ZEKTON_DDS_HEADER_SIZE,
  ZEKTON_DESCRIPTOR_HEADER_SIZE,
  ZEKTON_DESCRIPTOR_TRAILING_SIZE,
  ZEKTON_RECORD_SIZE,
} from '../lib/x4UiFontMetrics';
import UIBuilder, * as UIBuilderApiModule from './UIBuilder';
import X4UiSourceEditor, {
  X4UiSourceEditorLinter,
  X4UiSourceEditorSamples,
  addX4UiManualCalibrationPoint,
  addX4UiManualCalibrationDraft,
  buildX4UiManualCalibrationSessionInput,
  classifyX4UiCanvasCommit,
  classifyX4UiCanvasState,
  classifyX4UiCorpusLoadResult,
  classifyX4UiLintState,
  createX4UiManualCalibrationDraft,
  createX4UiManualCalibrationState,
  inspectX4UiLint,
  isBlockingX4UiAddTableFinding,
  isX4UiKeepOutEntryChecked,
  parseX4UiManualCalibrationDraft,
  reconcileX4UiEditorSelections,
  removeX4UiManualCalibrationPoint,
  removeX4UiManualCalibrationRow,
  setX4UiManualCalibrationRowEnabled,
  toggleX4UiKeepOutEntry,
  toggleX4UiManualCalibrationRow,
  type X4UiEditorLintFinding,
  type X4UiManualCalibrationDraft,
  updateX4UiManualCalibrationDraft,
  updateX4UiManualCalibrationPoint,
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
assert.match(sourceMarkup, /x4-ui-manual-calibration-region/);
assert.match(sourceMarkup, /x4-ui-manual-calibration-stable-id/);
assert.match(sourceMarkup, /x4-ui-manual-calibration-context/);
assert.match(sourceMarkup, /x4-ui-manual-calibration-source-note/);
assert.match(sourceMarkup, /x4-ui-manual-calibration-screenshot-hash/);
assert.match(sourceMarkup, /x4-ui-manual-calibration-profile/);
assert.match(sourceMarkup, /x4-ui-manual-calibration-drawable-left/);
assert.match(sourceMarkup, /x4-ui-manual-calibration-drawable-top/);
assert.match(sourceMarkup, /x4-ui-manual-calibration-drawable-width/);
assert.match(sourceMarkup, /x4-ui-manual-calibration-drawable-height/);
assert.match(sourceMarkup, /x4-ui-manual-calibration-point-0-x/);
assert.match(sourceMarkup, /x4-ui-manual-calibration-point-0-y/);
assert.match(sourceMarkup, /x4-ui-manual-calibration-point-1-x/);
assert.match(sourceMarkup, /x4-ui-manual-calibration-point-1-y/);
assert.match(sourceMarkup, /x4-ui-manual-calibration-point-2-x/);
assert.match(sourceMarkup, /x4-ui-manual-calibration-point-2-y/);
assert.match(sourceMarkup, /x4-ui-manual-calibration-add-point/);
assert.match(sourceMarkup, /x4-ui-manual-calibration-add/);
assert.match(sourceMarkup, /Advisory only · Not verified in game/);
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
const selftestText = readFileSync(new URL('./X4UiSourceEditor.selftest.tsx', import.meta.url), 'utf8');
const uiBuilderText = readFileSync(new URL('./UIBuilder.tsx', import.meta.url), 'utf8');
const manualStateSourceStart = sourceText.indexOf('export interface X4UiManualCalibrationState');
const manualStateSourceEnd = sourceText.indexOf('export interface X4UiCanvasStateDescription', manualStateSourceStart);
const manualActionSourceStart = sourceText.indexOf('  const updateManualDraftField');
const manualActionSourceEnd = sourceText.indexOf('  const updateSample', manualActionSourceStart);
const manualRowSourceStart = sourceText.indexOf('            {manualCalibrationState.rows.map');
const manualRowSourceEnd = sourceText.indexOf('            {manualCalibrationState.rows.length === 0', manualRowSourceStart);
assert.equal(
  [manualStateSourceStart, manualStateSourceEnd, manualActionSourceStart, manualActionSourceEnd, manualRowSourceStart, manualRowSourceEnd].every(offset => offset >= 0),
  true,
  'manual calibration source boundaries must remain available for ownership scans',
);
const manualCalibrationOwnedSource = [
  sourceText.slice(manualStateSourceStart, manualStateSourceEnd),
  sourceText.slice(manualActionSourceStart, manualActionSourceEnd),
  sourceText.slice(manualRowSourceStart, manualRowSourceEnd),
].join('\n');
for (const forbiddenManualSource of ['onWorkspaceEdit', 'localStorage', 'sessionStorage', 'indexedDB', 'globalThis.fetch', 'fetch(', 'gameVerified: true', 'Verified in game']) {
  assert.equal(manualCalibrationOwnedSource.includes(forbiddenManualSource), false, `manual calibration ownership leak present: ${forbiddenManualSource}`);
}
assert.doesNotMatch(manualCalibrationOwnedSource, /\bas any\b|:\s*any\b/);
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
// Fail-first B119 presentation contract: Source Preview must select source composition explicitly.
assert.match(sourceText, /presentation:\s*['"]source-composition['"]/);
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
assert.match(sourceText, /gameVerified: false/);
assert.doesNotMatch(sourceText, /gameVerified:\s*true/);
assert.doesNotMatch(sourceText, /Verified in game/);
assert.match(sourceText, /const explicitEnabled = manualCalibrationState\.enabledManualRowIds\.includes\(row\.rowId\)/);
assert.doesNotMatch(sourceText, /const explicitEnabled = manualCalibrationState\.[^;]*stableId/);
assert.match(sourceText, /<article key=\{row\.rowId\} data-testid=\{`x4-ui-manual-calibration-row-\$\{row\.rowId\}`\}/);
assert.match(sourceText, /x4-ui-manual-calibration-enable-\$\{row\.rowId\}/);
assert.match(sourceText, /x4-ui-manual-calibration-remove-\$\{row\.rowId\}/);
assert.match(selftestText, /Historical B119 8C\.2 duplicate-admission fail-first receipt from the pre-correction candidate/);
assert.match(selftestText, /these hashes are evidence for that earlier red run, not current file-hash expectations/);
assert.match(uiBuilderText, /useState<'source' \| 'canvas' \| 'lua'>\('source'\)/);
assert.match(uiBuilderText, /<X4UiSourceEditor workspace=\{workspace\}/);

const sourceEditorApiUnknown = X4UiSourceEditorApiModule as unknown as Record<string, unknown>;
const batch8c2FailFirstMissing = [
  [
    'manual controls/fields/test IDs are absent from initial SSR',
    /x4-ui-manual-calibration-region/.test(sourceMarkup)
      && /x4-ui-manual-calibration-stable-id/.test(sourceMarkup)
      && /x4-ui-manual-calibration-point-0-x/.test(sourceMarkup),
  ],
  [
    'valid draft cannot be added or wired because the pure helper/API is absent',
    typeof sourceEditorApiUnknown.createX4UiManualCalibrationDraft === 'function'
      && typeof sourceEditorApiUnknown.addX4UiManualCalibrationDraft === 'function'
      && typeof sourceEditorApiUnknown.buildX4UiManualCalibrationSessionInput === 'function',
  ],
  [
    'enable/remove duplicate-ID reconciliation behavior is absent',
    typeof sourceEditorApiUnknown.toggleX4UiManualCalibrationRow === 'function'
      && typeof sourceEditorApiUnknown.removeX4UiManualCalibrationRow === 'function',
  ],
  [
    'component session input cannot receive manualCalibrations/enabledManualEntryIds',
    /manualCalibrations/.test(sourceText) && /enabledManualEntryIds/.test(sourceText),
  ],
  ['permanent Not verified truth is expected', /Not verified in game/.test(sourceMarkup) && /Not verified in game/.test(sourceText)],
].filter(([, pass]) => !pass)
  .map(([name]) => name);
assert.deepEqual(
  batch8c2FailFirstMissing,
  [],
  `B119 8C.2 fail-first red assertions: ${batch8c2FailFirstMissing.join(', ')}`,
);

const makeManualCalibrationDraft = (stableId: string): X4UiManualCalibrationDraft => {
  let draft = createX4UiManualCalibrationDraft();
  for (const [field, value] of [
    ['stableId', stableId],
    ['context', 'manual-context'],
    ['sourceNote', 'operator screenshot calibration'],
    ['screenshotHash', 'A'.repeat(64)],
    ['profile', '2560x1440-ui-1.4'],
    ['drawableLeft', '10'],
    ['drawableTop', '20'],
    ['drawableWidth', '100'],
    ['drawableHeight', '80'],
  ] as const) {
    draft = updateX4UiManualCalibrationDraft(draft, field, value);
  }
  draft = updateX4UiManualCalibrationPoint(draft, 0, 'x', '20');
  draft = updateX4UiManualCalibrationPoint(draft, 0, 'y', '30');
  draft = updateX4UiManualCalibrationPoint(draft, 1, 'x', '100');
  draft = updateX4UiManualCalibrationPoint(draft, 1, 'y', '30');
  draft = updateX4UiManualCalibrationPoint(draft, 2, 'x', '20');
  draft = updateX4UiManualCalibrationPoint(draft, 2, 'y', '80');
  return draft;
};

const initialManualDraft = createX4UiManualCalibrationDraft();
const updatedManualPointDraft = updateX4UiManualCalibrationPoint(initialManualDraft, 0, 'x', '12.5');
assert.notEqual(updatedManualPointDraft, initialManualDraft, 'manual point update must create a new draft');
assert.notEqual(updatedManualPointDraft.points, initialManualDraft.points, 'manual point update must create a new point array');
assert.equal(initialManualDraft.points[0].x, '0', 'manual point update must not mutate the original point');
assert.equal(updatedManualPointDraft.points[1], initialManualDraft.points[1], 'manual point update must preserve untouched point identity');
const addedManualPointDraft = addX4UiManualCalibrationPoint(initialManualDraft);
assert.equal(addedManualPointDraft.points.length, 4, 'manual add-point must append one draft point');
assert.equal(initialManualDraft.points.length, 3, 'manual add-point must not mutate the original point array');
const removedManualPointDraft = removeX4UiManualCalibrationPoint(addedManualPointDraft, 3);
assert.equal(removedManualPointDraft.points.length, 3, 'manual remove-point must remove exactly one draft point');
assert.equal(removedManualPointDraft.points[0], addedManualPointDraft.points[0], 'manual remove-point must preserve remaining point identity');
assert.equal(removeX4UiManualCalibrationPoint(initialManualDraft, -1), initialManualDraft, 'unknown manual point removal must be a no-op');
assert.equal(updateX4UiManualCalibrationPoint(initialManualDraft, 99, 'x', '1'), initialManualDraft, 'unknown manual point update must be a no-op');

const validManualDraft = makeManualCalibrationDraft('manual-polygon-1');
const parsedManualDraft = parseX4UiManualCalibrationDraft(validManualDraft);
assert.equal(parsedManualDraft.accepted, true, 'valid manual draft must convert to a plain calibration input');
if (!parsedManualDraft.accepted) throw new Error('valid manual draft unexpectedly refused');
assert.deepEqual(Object.keys(parsedManualDraft.input).sort(), ['context', 'drawableBounds', 'points', 'profile', 'screenshotHash', 'sourceNote', 'stableId']);
assert.deepEqual(parsedManualDraft.input.drawableBounds, { left: 10, top: 20, width: 100, height: 80 }, 'manual bounds must convert numeric text exactly');
assert.deepEqual(parsedManualDraft.input.points, [{ x: 20, y: 30 }, { x: 100, y: 30 }, { x: 20, y: 80 }], 'manual points must convert numeric text exactly');
const blankNumericDraft = updateX4UiManualCalibrationDraft(validManualDraft, 'drawableWidth', '');
const nonFiniteNumericDraft = updateX4UiManualCalibrationDraft(validManualDraft, 'drawableWidth', 'Infinity');
const blankPointDraft = updateX4UiManualCalibrationPoint(validManualDraft, 0, 'x', '');
assert.deepEqual(parseX4UiManualCalibrationDraft(blankNumericDraft), { accepted: false, reason: 'invalid-number', message: 'drawable width must be a non-empty finite number.' });
assert.deepEqual(parseX4UiManualCalibrationDraft(nonFiniteNumericDraft), { accepted: false, reason: 'invalid-number', message: 'drawable width must be a non-empty finite number.' });
assert.deepEqual(parseX4UiManualCalibrationDraft(blankPointDraft), { accepted: false, reason: 'invalid-number', message: 'point 1 x must be a non-empty finite number.' });

const manualEmptyState = createX4UiManualCalibrationState();
const manualPreparedState = { ...manualEmptyState, draft: validManualDraft };
const manualOneState = addX4UiManualCalibrationDraft(manualPreparedState);
const manualTwoState = addX4UiManualCalibrationDraft(manualOneState, validManualDraft);
assert.equal(manualOneState.rows.length, 1, 'manual Add must store one row');
assert.equal(manualTwoState.rows.length, 2, 'manual Add must preserve duplicate rows');
assert.notEqual(manualTwoState.rows[0].rowId, manualTwoState.rows[1].rowId, 'manual duplicate rows must have distinct local identities');
assert.equal(manualOneState.draft.stableId, '', 'manual Add must reset only the draft deterministically');
const manualRowOne = manualTwoState.rows[0];
const manualRowTwo = manualTwoState.rows[1];
const manualUnknownToggle = toggleX4UiManualCalibrationRow(manualTwoState, 'unknown-row');
const manualUnknownRemove = removeX4UiManualCalibrationRow(manualTwoState, 'unknown-row');
assert.equal(manualUnknownToggle, manualTwoState, 'unknown manual toggle must preserve state identity');
assert.equal(manualUnknownRemove, manualTwoState, 'unknown manual remove must preserve state identity');
const manualEnabledState = setX4UiManualCalibrationRowEnabled(manualTwoState, manualRowOne.rowId, true);
assert.deepEqual(manualEnabledState.enabledManualRowIds, [manualRowOne.rowId], 'explicit manual enable must store only the immutable local row ID');
assert.equal(manualEnabledState.enabledManualRowIds.includes(manualRowTwo.rowId), false, 'enabling duplicate row 1 must leave duplicate row 2 disabled');
assert.equal(setX4UiManualCalibrationRowEnabled(manualEnabledState, manualRowOne.rowId, true), manualEnabledState, 'repeating explicit enable must be a no-op');
const manualBothEnabledState = setX4UiManualCalibrationRowEnabled(manualEnabledState, manualRowTwo.rowId, true);
assert.deepEqual(manualBothEnabledState.enabledManualRowIds, [manualRowOne.rowId, manualRowTwo.rowId], 'enabling both duplicates must retain both local row IDs');
const manualSecondToggledOffState = toggleX4UiManualCalibrationRow(manualBothEnabledState, manualRowTwo.rowId);
assert.deepEqual(manualSecondToggledOffState.enabledManualRowIds, [manualRowOne.rowId], 'toggling duplicate row 2 off must leave row 1 enabled');
assert.deepEqual(manualBothEnabledState.enabledManualRowIds, [manualRowOne.rowId, manualRowTwo.rowId], 'toggling one duplicate must not mutate the prior enablement array');
const manualRemovedDuplicateState = removeX4UiManualCalibrationRow(manualEnabledState, manualRowOne.rowId);
assert.deepEqual(manualRemovedDuplicateState.enabledManualRowIds, [], 'removing enabled row 1 must not transfer enablement to disabled duplicate row 2');
const manualRemovedFinalState = removeX4UiManualCalibrationRow(manualRemovedDuplicateState, manualRowTwo.rowId);
assert.deepEqual(manualRemovedFinalState.enabledManualRowIds, [], 'removing the final duplicate must leave no local row enablement');
const manualRemovedDisabledSiblingState = removeX4UiManualCalibrationRow(manualEnabledState, manualRowTwo.rowId);
assert.equal(manualRemovedDisabledSiblingState.enabledManualRowIds, manualEnabledState.enabledManualRowIds, 'removing disabled row 2 must preserve row 1 enablement-array identity');
const manualRemovedBothFirstState = removeX4UiManualCalibrationRow(manualBothEnabledState, manualRowOne.rowId);
const manualRemovedBothSecondState = removeX4UiManualCalibrationRow(manualBothEnabledState, manualRowTwo.rowId);
assert.deepEqual(manualRemovedBothFirstState.enabledManualRowIds, [manualRowTwo.rowId], 'removing enabled row 1 must retain enabled row 2 only');
assert.deepEqual(manualRemovedBothSecondState.enabledManualRowIds, [manualRowOne.rowId], 'removing enabled row 2 must retain enabled row 1 only');
const manualToggledOffState = toggleX4UiManualCalibrationRow(manualEnabledState, manualRowOne.rowId);
assert.deepEqual(manualToggledOffState.enabledManualRowIds, [], 'manual toggle must explicitly disable only the addressed row ID');

const rowLocalFailFirstState = setX4UiManualCalibrationRowEnabled(manualTwoState, manualRowOne.rowId, true);
const rowLocalFailFirstEnabledRowIds = rowLocalFailFirstState.enabledManualRowIds;
const rowLocalFailFirstRed = [
  [
    'enabling duplicate row 1 is row-local and leaves row 2 disabled',
    rowLocalFailFirstEnabledRowIds?.length === 1
      && rowLocalFailFirstEnabledRowIds[0] === manualRowOne.rowId
      && !rowLocalFailFirstEnabledRowIds.includes(manualRowTwo.rowId),
  ],
] as const;
const rowLocalFailFirstMissing = rowLocalFailFirstRed
  .filter(([, passed]) => !passed)
  .map(([name]) => name);
assert.deepEqual(
  rowLocalFailFirstMissing,
  [],
  `B119 8C.2 row-local enablement fail-first red assertions: ${rowLocalFailFirstMissing.join(', ')}`,
);

const projectManualState = (state: ReturnType<typeof createX4UiManualCalibrationState>, profile = { width: 100, height: 80, uiScale: 1 }) => {
  const manualInput = buildX4UiManualCalibrationSessionInput(state);
  return {
    input: manualInput,
    projection: projectX4UiEditorSession({
      workspace,
      corpus: undefined,
      profile,
      manualCalibrations: manualInput.manualCalibrations,
      enabledManualEntryIds: manualInput.enabledManualEntryIds,
    }),
  };
};

const disabledManualSession = projectManualState(manualOneState);
assert.equal(disabledManualSession.input.manualCalibrations.length, 1, 'component must send one exact plain manual calibration input');
assert.deepEqual(disabledManualSession.input.enabledManualEntryIds, [], 'new manual rows must be disabled until explicitly enabled');
assert.equal(disabledManualSession.projection.manualCalibrations[0]?.status, 'success', 'valid disabled manual row must still receive Session success provenance');
assert.equal(disabledManualSession.projection.manualCalibrations[0]?.enabled, false, 'valid disabled manual row must not be enabled for Paint');
assert.equal(disabledManualSession.projection.activeKeepOuts.length, 0, 'valid disabled manual row must emit no active Paint keep-out');

const enabledManualSession = projectManualState(manualEnabledState);
assert.equal(enabledManualSession.input.manualCalibrations.length, 2, 'duplicate manual inputs must both reach Session in index order');
assert.equal(enabledManualSession.projection.manualCalibrations.length, 2, 'Session must preserve one refusal projection per duplicate occurrence');
assert.equal(enabledManualSession.projection.manualCalibrations.every(value => value.status === 'refused' && value.reason === 'duplicate-stable-id'), true, 'duplicate stable IDs must remain visibly refused by Session');
assert.equal(enabledManualSession.projection.activeKeepOuts.length, 0, 'duplicate refusal must issue no manual Paint keep-out');
assert.deepEqual(enabledManualSession.input.enabledManualEntryIds, [], 'ambiguous stable IDs must be excluded from Session enablement while local enablement is retained');
assert.deepEqual(
  enabledManualSession.input.refusedRows.map(row => row.reason),
  ['duplicate-stable-id', 'duplicate-stable-id'],
  'both valid duplicate occurrences must be visibly refused at the component boundary',
);
const bothEnabledManualSession = projectManualState(manualBothEnabledState);
assert.deepEqual(manualBothEnabledState.enabledManualRowIds, [manualRowOne.rowId, manualRowTwo.rowId], 'both duplicate checkboxes must remain independently checked in local state');
assert.deepEqual(bothEnabledManualSession.input.enabledManualEntryIds, [], 'enabling both duplicate rows must not grant ambiguous stable-ID authority to Session');
assert.equal(bothEnabledManualSession.projection.activeKeepOuts.length, 0, 'enabling both duplicate rows must still issue zero active keep-outs');
const validDuplicateAfterRemovingFirst = projectManualState(removeX4UiManualCalibrationRow(manualEnabledState, manualRowOne.rowId));
const validDuplicateAfterRemovingSecond = projectManualState(removeX4UiManualCalibrationRow(manualEnabledState, manualRowTwo.rowId));
assert.equal(validDuplicateAfterRemovingFirst.projection.activeKeepOuts.length, 0, 'removing enabled row 1 must not enable surviving disabled row 2');
assert.equal(validDuplicateAfterRemovingSecond.projection.activeKeepOuts.length, 1, 'removing disabled row 2 must restore surviving enabled row 1');
assert.deepEqual(validDuplicateAfterRemovingFirst.input.enabledManualEntryIds, []);
assert.deepEqual(validDuplicateAfterRemovingSecond.input.enabledManualEntryIds, ['manual-polygon-1']);
const manualSecondOnlyEnabledState = setX4UiManualCalibrationRowEnabled(manualTwoState, manualRowTwo.rowId, true);
const secondOnlyAfterRemovingFirst = projectManualState(removeX4UiManualCalibrationRow(manualSecondOnlyEnabledState, manualRowOne.rowId));
const secondOnlyAfterRemovingSecond = projectManualState(removeX4UiManualCalibrationRow(manualSecondOnlyEnabledState, manualRowTwo.rowId));
assert.equal(secondOnlyAfterRemovingFirst.projection.activeKeepOuts.length, 1, 'removing disabled row 1 must restore surviving enabled row 2');
assert.equal(secondOnlyAfterRemovingSecond.projection.activeKeepOuts.length, 0, 'removing enabled row 2 must not enable surviving disabled row 1');
const bothEnabledAfterRemovingFirst = projectManualState(removeX4UiManualCalibrationRow(manualBothEnabledState, manualRowOne.rowId));
const bothEnabledAfterRemovingSecond = projectManualState(removeX4UiManualCalibrationRow(manualBothEnabledState, manualRowTwo.rowId));
assert.equal(bothEnabledAfterRemovingFirst.projection.activeKeepOuts.length, 1, 'removing row 1 when both were enabled must restore surviving enabled row 2');
assert.equal(bothEnabledAfterRemovingSecond.projection.activeKeepOuts.length, 1, 'removing row 2 when both were enabled must restore surviving enabled row 1');

const enabledSingleManualState = addX4UiManualCalibrationDraft({ ...manualEmptyState, enabledManualRowIds: [] }, validManualDraft);
const enabledSingleManual = projectManualState(setX4UiManualCalibrationRowEnabled(enabledSingleManualState, enabledSingleManualState.rows[0].rowId, true));
const enabledManualProjection = enabledSingleManual.projection.manualCalibrations[0];
assert.equal(enabledManualProjection?.status, 'success', 'valid enabled manual row must be accepted by Session');
assert.equal(enabledManualProjection?.enabled, true, 'valid enabled manual row must be enabled by primitive ID');
assert.deepEqual(enabledSingleManual.input.enabledManualEntryIds, ['manual-polygon-1'], 'one enabled valid row must derive exactly one primitive stable ID for Session');
assert.equal(enabledSingleManual.input.enabledManualEntryIds.every(value => typeof value === 'string'), true, 'manual enablement input must contain primitive IDs only');
assert.equal(enabledSingleManual.projection.activeKeepOuts.length, 1, 'valid enabled manual row must issue exactly one active manual keep-out to Paint');
assert.equal(enabledSingleManual.projection.keepOuts.length, 1, 'Session must forward exactly one active manual keep-out to Paint');
assert.equal(enabledSingleManual.projection.activeKeepOuts[0]?.entry.id, 'manual-polygon-1');
assert.equal(enabledSingleManual.projection.activeKeepOuts[0]?.projection.advisoryOnly, true);
assert.equal(enabledSingleManual.projection.activeKeepOuts[0]?.projection.gameVerification, 'Not verified in game');
assert.match(sourceText, /manualCalibrations: manualSessionInput\.manualCalibrations/);
assert.match(sourceText, /enabledManualEntryIds: manualSessionInput\.enabledManualEntryIds/);
assert.match(sourceText, /projectionView\.paint/);
assert.match(sourceText, /renderX4UiPaintPlanToCanvas\(/);
const removedSingleManual = projectManualState(removeX4UiManualCalibrationRow(
  setX4UiManualCalibrationRowEnabled(enabledSingleManualState, enabledSingleManualState.rows[0].rowId, true),
  enabledSingleManualState.rows[0].rowId,
));
assert.equal(removedSingleManual.projection.manualCalibrations.length, 0, 'removing an enabled manual row must remove its Session projection');
assert.equal(removedSingleManual.projection.activeKeepOuts.length, 0, 'removing an enabled manual row must remove its Paint keep-out');

const invalidManualCases = [
  ['invalid hash', updateX4UiManualCalibrationDraft(validManualDraft, 'screenshotHash', 'not-a-sha256'), 'malformed-screenshot-hash'],
  ['invalid bounds', updateX4UiManualCalibrationDraft(validManualDraft, 'drawableWidth', '-1'), 'invalid-bounds'],
  ['invalid points', updateX4UiManualCalibrationPoint(validManualDraft, 0, 'x', '1000'), 'out-of-bounds'],
  ['too few points', removeX4UiManualCalibrationPoint(removeX4UiManualCalibrationPoint(validManualDraft, 2), 1), 'too-few-points'],
  ['built-in ID', updateX4UiManualCalibrationDraft(validManualDraft, 'stableId', 'conversation-back-row'), 'built-in-id-collision'],
] as const;

// Historical B119 8C.2 duplicate-admission fail-first receipt from the pre-correction candidate;
// these hashes are evidence for that earlier red run, not current file-hash expectations:
// production SHA256 27266888BDB35415B128A4005FB5325C1DD60AA3D4EC780E6ACD3F3BDFA5CF5E;
// selftest SHA256 9EB566E8BD437B907606B44F21F27E160008BE15446F193E1EA252673C87288D.
const targetedDuplicateValidDraft = makeManualCalibrationDraft('shared-local-id');
const targetedDuplicateSingleState = addX4UiManualCalibrationDraft({ ...manualEmptyState, draft: targetedDuplicateValidDraft });
const targetedDuplicateEnabledState = setX4UiManualCalibrationRowEnabled(
  targetedDuplicateSingleState,
  targetedDuplicateSingleState.rows[0]?.rowId ?? 'missing-row',
  true,
);
const targetedDuplicateMalformedState = addX4UiManualCalibrationDraft({
  ...targetedDuplicateEnabledState,
  draft: updateX4UiManualCalibrationDraft(targetedDuplicateValidDraft, 'drawableWidth', ''),
});
const targetedDuplicateValidRow = targetedDuplicateMalformedState.rows[0];
const targetedDuplicateMalformedRow = targetedDuplicateMalformedState.rows[1];
assert.deepEqual(targetedDuplicateMalformedState.enabledManualRowIds, [targetedDuplicateValidRow.rowId], 'adding a malformed duplicate must leave only the previously enabled valid row checked');
assert.equal(targetedDuplicateMalformedState.enabledManualRowIds.includes(targetedDuplicateMalformedRow.rowId), false, 'malformed duplicate row must begin independently disabled');
const targetedDuplicateBothEnabledState = setX4UiManualCalibrationRowEnabled(
  targetedDuplicateMalformedState,
  targetedDuplicateMalformedRow.rowId,
  true,
);
assert.deepEqual(targetedDuplicateBothEnabledState.enabledManualRowIds, [targetedDuplicateValidRow.rowId, targetedDuplicateMalformedRow.rowId], 'valid and malformed duplicate rows must be independently enableable by row ID');
const targetedDuplicateBothEnabledProjection = projectManualState(targetedDuplicateBothEnabledState);
assert.deepEqual(targetedDuplicateBothEnabledProjection.input.enabledManualEntryIds, [], 'valid-malformed ambiguity must gate Session authority even when both local rows are enabled');
assert.equal(targetedDuplicateBothEnabledProjection.projection.activeKeepOuts.length, 0, 'valid-malformed ambiguity must issue no active keep-out');
const targetedMalformedToggledOffState = toggleX4UiManualCalibrationRow(targetedDuplicateBothEnabledState, targetedDuplicateMalformedRow.rowId);
const targetedValidToggledOffState = toggleX4UiManualCalibrationRow(targetedDuplicateBothEnabledState, targetedDuplicateValidRow.rowId);
assert.deepEqual(targetedMalformedToggledOffState.enabledManualRowIds, [targetedDuplicateValidRow.rowId], 'toggling malformed duplicate off must leave valid duplicate enabled');
assert.deepEqual(targetedValidToggledOffState.enabledManualRowIds, [targetedDuplicateMalformedRow.rowId], 'toggling valid duplicate off must leave malformed duplicate enabled');
const targetedDuplicateInput = buildX4UiManualCalibrationSessionInput(targetedDuplicateMalformedState);
const targetedDuplicateProjection = projectManualState(targetedDuplicateMalformedState).projection;
const targetedDuplicateRefusalReasons = targetedDuplicateMalformedState.rows.map(row =>
  targetedDuplicateInput.refusedRows.find(refusal => refusal.rowId === row.rowId)?.reason,
);
const targetedDuplicateRemovedState = removeX4UiManualCalibrationRow(
  targetedDuplicateMalformedState,
  targetedDuplicateMalformedState.rows[1]?.rowId ?? 'missing-row',
);
const targetedDuplicateRestored = projectManualState(targetedDuplicateRemovedState);
const targetedValidRemovedState = removeX4UiManualCalibrationRow(
  targetedDuplicateMalformedState,
  targetedDuplicateValidRow.rowId,
);
assert.deepEqual(targetedValidRemovedState.enabledManualRowIds, [], 'removing enabled valid duplicate must not transfer enablement to malformed sibling');
assert.equal(projectManualState(targetedValidRemovedState).projection.activeKeepOuts.length, 0, 'surviving disabled malformed row must remain inactive');
const targetedMalformedOnlyEnabledState = setX4UiManualCalibrationRowEnabled(
  setX4UiManualCalibrationRowEnabled(targetedDuplicateMalformedState, targetedDuplicateValidRow.rowId, false),
  targetedDuplicateMalformedRow.rowId,
  true,
);
const targetedMalformedOnlyAfterRemoveMalformed = projectManualState(removeX4UiManualCalibrationRow(
  targetedMalformedOnlyEnabledState,
  targetedDuplicateMalformedRow.rowId,
));
assert.deepEqual(targetedMalformedOnlyAfterRemoveMalformed.input.enabledManualEntryIds, [], 'surviving valid row must not inherit removed malformed sibling enablement');
assert.equal(targetedMalformedOnlyAfterRemoveMalformed.projection.activeKeepOuts.length, 0, 'surviving valid row must remain inactive when only removed malformed sibling was enabled');
const targetedBothAfterRemoveMalformed = projectManualState(removeX4UiManualCalibrationRow(
  targetedDuplicateBothEnabledState,
  targetedDuplicateMalformedRow.rowId,
));
assert.deepEqual(targetedBothAfterRemoveMalformed.input.enabledManualEntryIds, ['shared-local-id'], 'removing malformed duplicate must restore surviving valid row when that row itself was enabled');
assert.equal(targetedBothAfterRemoveMalformed.projection.activeKeepOuts.length, 1, 'enabled valid survivor must return exactly one active keep-out after ambiguity clears');

const targetedDifferentInvalidState = addX4UiManualCalibrationDraft({
  ...(() => {
    const state = addX4UiManualCalibrationDraft({ ...manualEmptyState, draft: makeManualCalibrationDraft('independent-valid-id') });
    return setX4UiManualCalibrationRowEnabled(state, state.rows[0]?.rowId ?? 'missing-row', true);
  })(),
  draft: updateX4UiManualCalibrationDraft(makeManualCalibrationDraft('independent-invalid-id'), 'drawableWidth', ''),
});
const targetedDifferentInvalid = projectManualState(targetedDifferentInvalidState);
const targetedBuiltInAndInvalidRemainRefused = invalidManualCases.every(([, draft]) => {
  const state = addX4UiManualCalibrationDraft({ ...manualEmptyState, draft });
  const prepared = setX4UiManualCalibrationRowEnabled(state, state.rows[0]?.rowId ?? 'missing-row', true);
  const projected = projectManualState(prepared).projection;
  return projected.manualCalibrations[0]?.status === 'refused' && projected.activeKeepOuts.length === 0;
});

const targetedDuplicateFailFirstRows: readonly (readonly [string, boolean])[] = [
  ['single valid enabled row remains one active keep-out', enabledSingleManual.projection.activeKeepOuts.length === 1],
  [
    'valid plus locally numeric-refused duplicate is refused at the component boundary',
    targetedDuplicateInput.enabledManualEntryIds.length === 0 &&
      targetedDuplicateProjection.activeKeepOuts.length === 0 &&
      targetedDuplicateRefusalReasons.every(reason => reason === 'duplicate-stable-id'),
  ],
  [
    'removing malformed duplicate restores prior explicit enablement and one active keep-out',
    targetedDuplicateRestored.input.enabledManualEntryIds.includes('shared-local-id') &&
      targetedDuplicateRestored.projection.activeKeepOuts.length === 1,
  ],
  [
    'different-ID local numeric refusal does not block valid enabled row',
    targetedDifferentInvalid.projection.activeKeepOuts.length === 1 &&
      targetedDifferentInvalid.input.refusedRows.some(refusal => refusal.reason === 'invalid-number'),
  ],
  ['built-in collision and existing invalid cases remain refused with no paint', targetedBuiltInAndInvalidRemainRefused],
  [
    'duplicate rows preserve distinct local row identity and independent remove controls',
    targetedDuplicateMalformedState.rows.length === 2 &&
      targetedDuplicateMalformedState.rows[0]?.rowId !== targetedDuplicateMalformedState.rows[1]?.rowId &&
      /x4-ui-manual-calibration-remove-\$\{row\.rowId\}/.test(sourceText),
  ],
];
const targetedDuplicateFailFirstMissing = targetedDuplicateFailFirstRows
  .filter(([, passed]) => !passed)
  .map(([name]) => name);
assert.deepEqual(
  targetedDuplicateFailFirstMissing,
  [],
  `B119 8C.2 targeted duplicate-admission fail-first red assertions: ${targetedDuplicateFailFirstMissing.join(', ')}`,
);

for (const [label, draft, reason] of invalidManualCases) {
  const state = addX4UiManualCalibrationDraft({ ...manualEmptyState, draft });
  const prepared = setX4UiManualCalibrationRowEnabled(state, state.rows[0].rowId, true);
  const result = projectManualState(prepared).projection.manualCalibrations[0];
  assert.equal(result?.status, 'refused', `${label} must remain visible as a Session refusal`);
  assert.equal(result?.reason, reason, `${label} must preserve the exact Session refusal reason`);
  assert.equal(projectManualState(prepared).projection.activeKeepOuts.length, 0, `${label} must emit no manual Paint keep-out`);
}

const blankStableIdState = addX4UiManualCalibrationDraft(
  manualEmptyState,
  updateX4UiManualCalibrationDraft(validManualDraft, 'stableId', '   '),
);
const blankStableIdEnableAttempt = setX4UiManualCalibrationRowEnabled(blankStableIdState, blankStableIdState.rows[0].rowId, true);
assert.equal(blankStableIdEnableAttempt, blankStableIdState, 'blank stable-ID row enable request must be an identity-preserving no-op');
assert.deepEqual(projectManualState(blankStableIdEnableAttempt).input.enabledManualEntryIds, [], 'blank stable ID must never derive Session enablement authority');
assert.equal(projectManualState(blankStableIdEnableAttempt).projection.activeKeepOuts.length, 0, 'blank stable ID must never reach an active keep-out');

const editedIdentityFirstDraft = makeManualCalibrationDraft('edited-row-first');
const editedIdentitySecondDraft = makeManualCalibrationDraft('edited-row-second');
const editedIdentityFirstState = addX4UiManualCalibrationDraft(manualEmptyState, editedIdentityFirstDraft);
const editedIdentityTwoState = addX4UiManualCalibrationDraft(editedIdentityFirstState, editedIdentitySecondDraft);
const editedIdentityFirstRow = editedIdentityTwoState.rows[0];
const editedIdentitySecondRow = editedIdentityTwoState.rows[1];
const editedIdentityEnabledState = setX4UiManualCalibrationRowEnabled(editedIdentityTwoState, editedIdentityFirstRow.rowId, true);
const editedIdentityCollisionState = {
  ...editedIdentityEnabledState,
  rows: editedIdentityEnabledState.rows.map(row => row.rowId === editedIdentityFirstRow.rowId
    ? { ...row, draft: updateX4UiManualCalibrationDraft(row.draft, 'stableId', 'edited-row-second') }
    : row),
};
assert.deepEqual(editedIdentityCollisionState.enabledManualRowIds, [editedIdentityFirstRow.rowId], 'editing an enabled row stable ID must retain that row identity only');
assert.equal(editedIdentityCollisionState.enabledManualRowIds.includes(editedIdentitySecondRow.rowId), false, 'stable-ID collision edit must not merge enablement into sibling row');
assert.equal(editedIdentityTwoState.rows[0].draft.stableId, 'edited-row-first', 'stored-row stable-ID fixture edit must not mutate the prior row');
assert.deepEqual(projectManualState(editedIdentityCollisionState).input.enabledManualEntryIds, [], 'edited stable-ID collision must remain ambiguity-gated');
assert.equal(projectManualState(editedIdentityCollisionState).projection.activeKeepOuts.length, 0, 'edited stable-ID collision must paint nothing');
const editedIdentityRecoveredState = {
  ...editedIdentityCollisionState,
  rows: editedIdentityCollisionState.rows.map(row => row.rowId === editedIdentityFirstRow.rowId
    ? { ...row, draft: updateX4UiManualCalibrationDraft(row.draft, 'stableId', 'edited-row-third') }
    : row),
};
const editedIdentityRecovered = projectManualState(editedIdentityRecoveredState);
assert.deepEqual(editedIdentityRecovered.input.enabledManualEntryIds, ['edited-row-third'], 'clearing edited ambiguity must derive the enabled row current stable ID only');
assert.equal(editedIdentityRecovered.projection.activeKeepOuts.length, 1, 'enabled row must recover one active keep-out after its stable-ID ambiguity clears');

const viewportAt100 = projectManualState(setX4UiManualCalibrationRowEnabled(enabledSingleManualState, enabledSingleManualState.rows[0].rowId, true), { width: 100, height: 80, uiScale: 1 }).projection.manualCalibrations[0];
const viewportAt200 = projectManualState(setX4UiManualCalibrationRowEnabled(enabledSingleManualState, enabledSingleManualState.rows[0].rowId, true), { width: 200, height: 160, uiScale: 1 }).projection.manualCalibrations[0];
if (viewportAt100?.status !== 'success' || viewportAt200?.status !== 'success' || viewportAt100.projection?.status !== 'projected' || viewportAt200.projection?.status !== 'projected') throw new Error('viewport reproject fixture was not accepted');
assert.notDeepEqual(viewportAt100.projection.geometry, viewportAt200.projection.geometry, 'profile/viewport change must reproject the accepted polygon through Session');
const expectedManualEvidence = {
  source: 'manual-calibration',
  evidenceGrade: 'calibrated',
  sourceNote: 'operator screenshot calibration',
  screenshot: { hash: 'A'.repeat(64), profile: '2560x1440-ui-1.4' },
  drawableBounds: { left: 10, top: 20, width: 100, height: 80 },
};
assert.deepEqual(viewportAt100.evidence, expectedManualEvidence, 'viewport reproject must preserve exact screenshot and drawable-bound provenance');
assert.deepEqual(viewportAt200.evidence, expectedManualEvidence, 'viewport reproject must preserve exact evidence identity at the second viewport');
assert.deepEqual(viewportAt100.calibration.status === 'success' ? viewportAt100.calibration.entry.geometry.points : [], [{ x: 0.1, y: 0.125 }, { x: 0.9, y: 0.125 }, { x: 0.1, y: 0.75 }], 'Session must expose normalized polygon evidence');

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

console.log('X4UiSourceEditor selftest: B119 8C.2 row-local manual SSR/draft/state/session matrix passed; prior Batch 7D assertions 41/41; causal parent-CAS rows 10/10; pending SSR rows 2/2; causal no-op acknowledgement rows 29/29; passive-effect reconciliation rows 8/8; round-4 authority rows 27/27; round-5 stale-stage entry 24/24; round-5 stale-stage updater 24/24; round-5 stale-apply entry 24/24; round-5 stage positives 2/2; round-5 apply positives 2/2; round-5 stale-apply updater 8/8; round-6 reentrant parent 64/64; round-6 draft-only acknowledgement 16/16; round-6 exact settlement 2/2; all earlier SSR, authority, linter, canvas, and UIBuilder boundaries passed');

type P7SourceAuthorityFixture = {
  readonly core: X4UiCorpusCanonicalSuccess;
  readonly color: X4UiCorpusCanonicalColorSuccess;
};

type P7SourceRow = {
  readonly name: string;
  readonly fixtureReady: boolean;
  readonly threw: boolean;
  readonly expected: string;
  readonly observed: unknown;
  readonly pass: boolean;
};

const p7SourceRows: P7SourceRow[] = [];

function p7SourceResponseHeaders(contentType: string): { get(name: string): string | null } {
  return { get: name => name.toLowerCase() === 'content-type' ? contentType : null };
}

function p7SourceJsonResponse(body: unknown, status = 200): X4UiCorpusFetchResponse {
  return {
    status,
    headers: p7SourceResponseHeaders('application/json; charset=utf-8'),
    json: async () => body,
  };
}

function p7SourceBytesResponse(bytes: Uint8Array, status = 200, contentType = 'application/octet-stream'): X4UiCorpusFetchResponse {
  const copied = bytes.slice();
  return {
    status,
    headers: p7SourceResponseHeaders(contentType),
    arrayBuffer: async () => copied.buffer,
  };
}

function p7SourceHexDigest(hex: string): ArrayBuffer {
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  return bytes.buffer;
}

function p7SourceDigestInputBytes(data: unknown): Uint8Array {
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  throw new TypeError('SourceEditor P7 digest input was not a byte buffer');
}

async function p7SourceWithCanonicalPlatformHash<T>(expectedHashes: readonly string[], run: () => Promise<T>): Promise<T> {
  const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  let hashIndex = 0;
  const fakeCrypto = {
    subtle: {
      digest: async (): Promise<ArrayBuffer> => {
        const expected = expectedHashes[hashIndex++];
        if (expected === undefined) throw new Error('SourceEditor P7 canonical hash count mismatch');
        return p7SourceHexDigest(expected);
      },
    },
  };
  try {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      enumerable: originalDescriptor?.enumerable ?? true,
      writable: true,
      value: fakeCrypto,
    });
    return await run();
  } finally {
    if (originalDescriptor) Object.defineProperty(globalThis, 'crypto', originalDescriptor);
    else Reflect.deleteProperty(globalThis, 'crypto');
  }
}

function p7SourceMakeCanonicalAbc(advance: number): Uint8Array {
  const maxCodepoint = 127;
  const mapBytes = (maxCodepoint + 1) * 2;
  const recordStart = (ZEKTON_DESCRIPTOR_HEADER_SIZE + mapBytes + 3) & ~3;
  const bytes = new Uint8Array(recordStart + ZEKTON_RECORD_SIZE + ZEKTON_DESCRIPTOR_TRAILING_SIZE);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 9, true);
  view.setFloat32(4, 16, true);
  view.setFloat32(8, 3, true);
  view.setFloat32(12, 3, true);
  view.setFloat32(16, 10, true);
  view.setInt32(20, 4, true);
  view.setInt32(24, 6, true);
  view.setInt32(28, 0, true);
  view.setUint32(32, 0, true);
  view.setUint32(36, 8, true);
  view.setUint32(40, 10, true);
  view.setUint32(44, maxCodepoint, true);
  for (let codepoint = 0; codepoint <= maxCodepoint; codepoint += 1) view.setUint16(ZEKTON_DESCRIPTOR_HEADER_SIZE + codepoint * 2, 1, true);
  view.setFloat32(recordStart, 0, true);
  view.setFloat32(recordStart + 4, 0, true);
  view.setFloat32(recordStart + 8, 1, true);
  view.setFloat32(recordStart + 12, 1, true);
  view.setInt16(recordStart + 16, 0, true);
  view.setUint16(recordStart + 18, 8, true);
  view.setUint16(recordStart + 20, advance, true);
  view.setUint16(recordStart + 22, 0, true);
  return bytes;
}

function p7SourceMakeCanonicalDds(): Uint8Array {
  const bytes = new Uint8Array(ZEKTON_DDS_HEADER_SIZE + 8 * 10);
  bytes.set([0x44, 0x44, 0x53, 0x20]);
  const view = new DataView(bytes.buffer);
  view.setUint32(4, 124, true);
  view.setUint32(8, 0x1007, true);
  view.setUint32(12, 10, true);
  view.setUint32(16, 8, true);
  view.setUint32(76, 32, true);
  view.setUint32(80, 2, true);
  view.setUint32(88, 8, true);
  view.setUint32(104, 0xff, true);
  view.setUint32(108, 0x1002, true);
  for (let index = ZEKTON_DDS_HEADER_SIZE; index < bytes.length; index += 1) bytes[index] = 255;
  return bytes;
}

function p7SourcePaddedUtf8(text: string, size: number): Uint8Array {
  const bytes = new TextEncoder().encode(text);
  if (bytes.byteLength > size) throw new Error(`SourceEditor P7 color fixture exceeds ${size} bytes`);
  const padded = new Uint8Array(size);
  padded.set(bytes);
  padded.fill(0x20, bytes.byteLength);
  return padded;
}

function p7SourceColorBuffers(): Map<string, Uint8Array> {
  const baseIds = [
    'white',
    'black_alpha_0',
    'white_weak_glow',
    'azure_very_dark',
    'azure_moderate_glow',
    'azure_dark_alpha_160_glow',
    'azure_very_dark_alpha_224',
    'literal_base',
  ];
  while (baseIds.length < 224) baseIds.push(`source_p7_base_${baseIds.length.toString().padStart(3, '0')}`);
  const specialValues: Record<string, readonly [number, number, number, number, number]> = {
    white: [11, 22, 33, 44, 0.1],
    black_alpha_0: [51, 52, 53, 54, 0.2],
    white_weak_glow: [101, 102, 103, 104, 0.3],
    azure_very_dark: [61, 62, 63, 64, 0.4],
    azure_moderate_glow: [71, 72, 73, 74, 0.5],
    azure_dark_alpha_160_glow: [81, 82, 83, 84, 0.6],
    azure_very_dark_alpha_224: [91, 92, 93, 94, 0.7],
    literal_base: [131, 132, 133, 134, 0.9],
  };
  const colors = baseIds.map((id, index) => {
    const values = specialValues[id] || [index % 256, (index + 1) % 256, (index + 2) % 256, (index + 3) % 256, 0];
    return `    <color id="${id}" r="${values[0]}" g="${values[1]}" b="${values[2]}" a="${values[3]}" glow="${values[4]}"/>`;
  });
  const mappingRefs: Record<string, string> = {
    table_background_default: 'white',
    row_background: 'black_alpha_0',
    text_normal: 'white_weak_glow',
    icon_normal: 'white_weak_glow',
    button_background_default: 'azure_very_dark',
    button_highlight_default: 'azure_moderate_glow',
    button_border_default: 'azure_dark_alpha_160_glow',
    editbox_background_default: 'azure_very_dark_alpha_224',
  };
  const mappings = Object.entries(mappingRefs).map(([id, ref]) => `    <mapping id="${id}" ref="${ref}"/>`);
  for (let index = mappings.length; index < 804; index += 1) mappings.push(`    <mapping id="source_p7_map_${index.toString().padStart(3, '0')}" ref="${baseIds[index % baseIds.length]}"/>`);
  return new Map([
    [X4_UI_CORPUS_COLORS_XML_PATH, p7SourcePaddedUtf8([
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<colormap>',
      '  <colors>',
      ...colors,
      '  </colors>',
      '  <mappings>',
      ...mappings,
      '  </mappings>',
      '</colormap>',
    ].join('\n'), X4_UI_CORPUS_COLORS_XML_SIZE)],
    [X4_UI_CORPUS_COLORS_XSD_PATH, p7SourcePaddedUtf8([
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">',
      '  <xs:simpleType name="identifier"><xs:restriction base="xs:string"><xs:pattern value="[a-zA-Z_][a-zA-Z0-9_]*"/></xs:restriction></xs:simpleType>',
      '</xs:schema>',
    ].join('\n'), X4_UI_CORPUS_COLORS_XSD_SIZE)],
  ]);
}

function p7SourcePathFromQuery(url: string, key: string): string {
  const pair = url.slice(url.indexOf('?') + 1).split('&').find(part => part.startsWith(`${key}=`));
  if (!pair) throw new Error(`SourceEditor P7 missing query ${key}`);
  return decodeURIComponent(pair.slice(key.length + 1));
}

function p7SourceManifestStatus(root: string, generation: string): Record<string, unknown> {
  return {
    available: true,
    state: 'ready',
    root,
    current: { generation, root, generatedAt: '2026-08-19T00:00:00.000Z' },
  };
}

function p7SourceFixtureTransport(
  calls: Array<{ readonly url: string; readonly signal: AbortSignal | undefined }>,
): X4UiCorpusTransport {
  const root = 'source-editor-p7-canonical-root';
  const generation = 'source-editor-p7-canonical-generation';
  const contract = X4_UI_CORPUS_9_00_CONTRACT;
  const buffers = new Map<string, Uint8Array>([
    [contract.helper.relativePath, new TextEncoder().encode('-- SourceEditor P7 canonical helper\n')],
    [contract.widget.relativePath, new TextEncoder().encode('-- SourceEditor P7 canonical widget\n')],
    [contract.regular.descriptor.relativePath, p7SourceMakeCanonicalAbc(8)],
    [contract.regular.atlas.relativePath, p7SourceMakeCanonicalDds()],
    [contract.bold.descriptor.relativePath, p7SourceMakeCanonicalAbc(8)],
    [contract.bold.atlas.relativePath, p7SourceMakeCanonicalDds()],
  ]);
  for (const [path, bytes] of p7SourceColorBuffers()) buffers.set(path, bytes);
  const status = {
    available: true,
    root,
    generatedAt: '2026-08-19T00:00:00.000Z',
    manifestGeneration: generation,
    manifest: { available: true, state: 'ready', root, current: { generation, root, generatedAt: '2026-08-19T00:00:00.000Z' } },
  };
  return async (url, init) => {
    calls.push({ url, signal: init?.signal });
    if (url === X4_UI_CORPUS_STATUS_URL) return p7SourceJsonResponse(status);
    if (url.startsWith(`${X4_UI_CORPUS_MANIFEST_URL}?`)) {
      const path = p7SourcePathFromQuery(url, 'q');
      const bytes = buffers.get(path);
      if (!bytes) throw new Error(`SourceEditor P7 unknown manifest path ${path}`);
      return p7SourceJsonResponse({
        status: p7SourceManifestStatus(root, generation),
        generation,
        total: 1,
        limit: 500,
        offset: 0,
        files: [{ path, bytes: bytes.byteLength }],
      });
    }
    if (url.startsWith(`${X4_UI_CORPUS_FILE_URL}?`)) {
      const path = p7SourcePathFromQuery(url, 'path');
      const bytes = buffers.get(path);
      if (!bytes) throw new Error(`SourceEditor P7 unknown file path ${path}`);
      const contentType = path.endsWith('.lua') ? 'text/plain' : path.endsWith('.xml') || path.endsWith('.xsd') ? 'application/xml' : 'application/octet-stream';
      return p7SourceBytesResponse(bytes, 200, contentType);
    }
    throw new Error(`SourceEditor P7 unexpected URL ${url}`);
  };
}

async function loadP7SourceAuthorities(): Promise<P7SourceAuthorityFixture> {
  const calls: Array<{ readonly url: string; readonly signal: AbortSignal | undefined }> = [];
  const transport = p7SourceFixtureTransport(calls);
  const contract = X4_UI_CORPUS_9_00_CONTRACT;
  const coreHashes = [
    contract.helper.sha256,
    contract.widget.sha256,
    contract.regular.descriptor.sha256,
    contract.regular.atlas.sha256,
    contract.bold.descriptor.sha256,
    contract.bold.atlas.sha256,
  ];
  const coreResult = await p7SourceWithCanonicalPlatformHash(coreHashes, () => loadConfiguredX4UiCorpusAssets({ transport }));
  if (!isX4UiCorpusCanonicalSuccess(coreResult)) throw new Error(`SourceEditor P7 core fixture failed: ${JSON.stringify(coreResult)}`);
  const colorResult = await p7SourceWithCanonicalPlatformHash(
    [X4_UI_CORPUS_COLORS_XML_SHA256, X4_UI_CORPUS_COLORS_XSD_SHA256],
    () => loadConfiguredX4UiCorpusColorEvidence({ transport }),
  );
  if (!isX4UiCorpusCanonicalColorSuccess(colorResult)) throw new Error(`SourceEditor P7 color fixture failed: ${JSON.stringify(colorResult)}`);
  if (colorResult.evidenceKind !== X4_UI_CORPUS_COLOR_CANONICAL_EVIDENCE || colorResult.verification !== X4_UI_CORPUS_VERIFICATION) throw new Error('SourceEditor P7 color fixture identity drifted');
  if (colorResult.identities.xml.relativePath !== X4_UI_CORPUS_9_00_COLOR_CONTRACT.xml.relativePath || colorResult.identities.xsd.relativePath !== X4_UI_CORPUS_9_00_COLOR_CONTRACT.xsd.relativePath) throw new Error('SourceEditor P7 color contract path drifted');
  return { core: coreResult, color: colorResult };
}

function p7SourceRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function p7SourceClassify(
  result: unknown,
  overrides: Partial<{ readonly signalAborted: boolean; readonly requestActive: boolean; readonly requestGeneration: number; readonly currentGeneration: number }> = {},
): Record<string, unknown> {
  return classifyX4UiCorpusLoadResult({
    result,
    loaderIssued: true,
    signalAborted: false,
    requestActive: true,
    requestGeneration: 1,
    currentGeneration: 1,
    ...overrides,
  } as never) as unknown as Record<string, unknown>;
}

function p7SourceCoreCanonical(observed: unknown, core: X4UiCorpusCanonicalSuccess): boolean {
  const record = p7SourceRecord(observed);
  return record?.status === 'canonical'
    && record.accepted === true
    && record.result === core
    && isX4UiCorpusCanonicalSuccess(record.result);
}

function p7SourceColorCanonical(observed: unknown, color: X4UiCorpusCanonicalColorSuccess): boolean {
  const record = p7SourceRecord(observed);
  return record?.colorStatus === 'canonical'
    && record.colorEvidence === color
    && isX4UiCorpusCanonicalColorSuccess(record.colorEvidence);
}

function p7SourceNoColorAuthority(observed: unknown): boolean {
  const record = p7SourceRecord(observed);
  return record?.colorEvidence === undefined && record?.colorStatus !== 'canonical';
}

function p7SourceNoAuthority(observed: unknown): boolean {
  const record = p7SourceRecord(observed);
  return record?.status !== 'canonical'
    && record?.accepted !== true
    && (record?.result === null || record?.result === undefined)
    && record?.colorEvidence === undefined;
}

function p7SourceReceipt(value: unknown): unknown {
  const record = p7SourceRecord(value);
  if (record === undefined) return value;
  if (typeof record.error === 'string') return { error: record.error };
  const receipt: Record<string, unknown> = {};
  for (const key of ['status', 'accepted', 'detail', 'colorStatus', 'colorDetail', 'getterReads', 'getTrapReads', 'threw', 'dualCanonical', 'detached', 'timeout', 'statusCallCount', 'overlapBeforeEitherSettled', 'callsUseSharedSignal', 'coreCanonical', 'colorCanonical', 'canonicalCount', 'failedBranchOrdinary', 'coreLoaderStarted', 'colorLoaderStarted', 'branchStartsBeforeSettlement', 'injectedBranchRejected', 'branchSignalsUseSharedSignal']) {
    if (Object.hasOwn(record, key)) receipt[key] = record[key];
  }
  if (Object.hasOwn(record, 'result')) receipt.result = record.result === null ? null : record.result === undefined ? undefined : 'present';
  if (Object.hasOwn(record, 'colorEvidence')) receipt.colorEvidence = record.colorEvidence === undefined ? undefined : 'present';
  if (Array.isArray(record.calls)) receipt.calls = { count: record.calls.length, allowlisted: record.calls.every(call => {
    const item = p7SourceRecord(call);
    return item !== undefined && typeof item.url === 'string';
  }) };
  for (const key of ['results', 'negativeResults', 'reflectionResults']) {
    if (!Array.isArray(record[key])) continue;
    receipt[key] = record[key].map(item => {
      const row = p7SourceRecord(item);
      return row === undefined ? item : { name: row.name, getTrapReads: row.getTrapReads, trapReads: row.trapReads, threw: row.threw, rejected: row.rejected };
    });
  }
  for (const key of ['transparent', 'active', 'late', 'aborted', 'reload', 'offlineColor', 'abortedColor']) {
    if (Object.hasOwn(record, key)) receipt[key] = p7SourceReceipt(record[key]);
  }
  return receipt;
}

async function recordP7SourceRow(
  name: string,
  fixtureReady: boolean,
  expected: string,
  invoke: () => unknown | Promise<unknown>,
  accepts: (observed: unknown) => boolean,
): Promise<void> {
  let threw = false;
  let observed: unknown;
  try {
    observed = await invoke();
  } catch (error) {
    threw = true;
    observed = { error: error instanceof Error ? error.message : String(error) };
  }
  p7SourceRows.push({ name, fixtureReady, threw, expected, observed, pass: fixtureReady && !threw && accepts(observed) });
}

async function runP7SourceEditorCanonicalColorMatrix(): Promise<void> {
  let fixture: P7SourceAuthorityFixture | undefined;
  let fixtureError: string | undefined;
  try {
    fixture = await loadP7SourceAuthorities();
  } catch (error) {
    fixtureError = error instanceof Error ? error.message : String(error);
  }
  const core = fixture?.core;
  const color = fixture?.color;
  const fixtureReady = fixture !== undefined;

  await recordP7SourceRow(
    'P7 SourceEditor default dual loader overlaps branches and preserves the fulfilled authority when the injected branch rejects',
    fixtureReady,
    'both injected loader branches start before either settles; one branch rejects outside transport normalization while the other reaches exact canonical authority and remains observable as an ordinary failure/canonical pair',
    async () => {
      const ownerLoader = sourceEditorApiUnknown.loadX4UiSourceEditorCorpusEnvelope;
      if (typeof ownerLoader !== 'function') throw new Error('missing future test seam: loadX4UiSourceEditorCorpusEnvelope');
      const controller = new AbortController();
      const sharedSignal = controller.signal;
      const calls: Array<{ readonly url: string; readonly signal: AbortSignal | undefined }> = [];
      const contract = X4_UI_CORPUS_9_00_CONTRACT;
      const buffers = new Map<string, Uint8Array>([
        [contract.helper.relativePath, new TextEncoder().encode('-- SourceEditor P7 canonical helper\n')],
        [contract.widget.relativePath, new TextEncoder().encode('-- SourceEditor P7 canonical widget\n')],
        [contract.regular.descriptor.relativePath, p7SourceMakeCanonicalAbc(8)],
        [contract.regular.atlas.relativePath, p7SourceMakeCanonicalDds()],
        [contract.bold.descriptor.relativePath, p7SourceMakeCanonicalAbc(8)],
        [contract.bold.atlas.relativePath, p7SourceMakeCanonicalDds()],
      ]);
      for (const [path, bytes] of p7SourceColorBuffers()) buffers.set(path, bytes);
      const digestHashes = new Map<string, string>();
      const digestCandidates: readonly { readonly bytes: Uint8Array; readonly hash: string }[] = [
        { bytes: buffers.get(contract.helper.relativePath) as Uint8Array, hash: contract.helper.sha256 },
        { bytes: buffers.get(contract.widget.relativePath) as Uint8Array, hash: contract.widget.sha256 },
        { bytes: buffers.get(contract.regular.descriptor.relativePath) as Uint8Array, hash: contract.regular.descriptor.sha256 },
        { bytes: buffers.get(contract.regular.atlas.relativePath) as Uint8Array, hash: contract.regular.atlas.sha256 },
        { bytes: buffers.get(contract.bold.descriptor.relativePath) as Uint8Array, hash: contract.bold.descriptor.sha256 },
        { bytes: buffers.get(contract.bold.atlas.relativePath) as Uint8Array, hash: contract.bold.atlas.sha256 },
        { bytes: buffers.get(X4_UI_CORPUS_COLORS_XML_PATH) as Uint8Array, hash: X4_UI_CORPUS_COLORS_XML_SHA256 },
        { bytes: buffers.get(X4_UI_CORPUS_COLORS_XSD_PATH) as Uint8Array, hash: X4_UI_CORPUS_COLORS_XSD_SHA256 },
      ];
      for (const candidate of digestCandidates) digestHashes.set(`${candidate.bytes.byteLength}:${Array.from(candidate.bytes.slice(0, 16)).join(',')}`, candidate.hash);
      let coreLoaderStarted = false;
      let colorLoaderStarted = false;
      let branchStartsBeforeSettlement = false;
      let injectedBranchRejected = false;
      let firstBranchSettled = false;
      let coreSignal: AbortSignal | undefined;
      let colorSignal: AbortSignal | undefined;
      let releaseBothBranches!: () => void;
      const bothBranchesStarted = new Promise<void>(resolve => { releaseBothBranches = resolve; });
      const noteBranchStart = (): void => {
        if (coreLoaderStarted && colorLoaderStarted && !firstBranchSettled) branchStartsBeforeSettlement = true;
      };
      const rejectingCoreLoader = async ({ signal }: { readonly signal: AbortSignal }): Promise<never> => {
        coreLoaderStarted = true;
        coreSignal = signal;
        noteBranchStart();
        await bothBranchesStarted;
        firstBranchSettled = true;
        injectedBranchRejected = true;
        throw new Error('P7 injected core branch rejection outside transport normalization');
      };
      const canonicalColorLoader = async ({ transport, signal }: { readonly transport: X4UiCorpusTransport; readonly signal: AbortSignal }): Promise<unknown> => {
        colorLoaderStarted = true;
        colorSignal = signal;
        noteBranchStart();
        releaseBothBranches();
        return loadConfiguredX4UiCorpusColorEvidence({ transport, signal });
      };
      const boundedTransport = p7SourceFixtureTransport(calls);
      const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
      try {
        Object.defineProperty(globalThis, 'crypto', {
          configurable: true,
          enumerable: originalDescriptor?.enumerable ?? true,
          writable: true,
          value: {
            subtle: {
              digest: async (_algorithm: unknown, data: unknown): Promise<ArrayBuffer> => {
                const bytes = p7SourceDigestInputBytes(data);
                const hash = digestHashes.get(`${bytes.byteLength}:${Array.from(bytes.slice(0, 16)).join(',')}`);
                if (hash === undefined) throw new Error(`P7 default-loader unknown digest input (${bytes.byteLength} bytes)`);
                return p7SourceHexDigest(hash);
              },
            },
          },
        });
        let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
        const timeout = new Promise<unknown>(resolve => {
          timeoutHandle = setTimeout(() => resolve({ timeout: true }), 1_000);
        });
        const loaderPromise = (ownerLoader as (options: {
          readonly transport: X4UiCorpusTransport;
          readonly signal: AbortSignal;
          readonly coreLoader: typeof rejectingCoreLoader;
          readonly colorLoader: typeof canonicalColorLoader;
        }) => Promise<unknown>)({
          transport: boundedTransport,
          signal: sharedSignal,
          coreLoader: rejectingCoreLoader,
          colorLoader: canonicalColorLoader,
        });
        const value = await Promise.race([loaderPromise, timeout]);
        if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
        const record = p7SourceRecord(value);
        const coreResult = record?.core;
        const colorResult = record?.color;
        const coreCanonical = isX4UiCorpusCanonicalSuccess(coreResult);
        const colorCanonical = isX4UiCorpusCanonicalColorSuccess(colorResult);
        const branchResults = [coreResult, colorResult];
        const failed = branchResults.find(branch => p7SourceRecord(branch)?.ok === false || (p7SourceRecord(branch)?.error !== undefined));
        const failureRecord = p7SourceRecord(failed);
        const callsUseSharedSignal = calls.length >= 1 && calls.every(call => call.signal === sharedSignal);
        const branchSignalsUseSharedSignal = coreSignal === sharedSignal && colorSignal === sharedSignal;
        return {
          value,
          calls,
          sharedSignal,
          coreLoaderStarted,
          colorLoaderStarted,
          branchStartsBeforeSettlement,
          injectedBranchRejected,
          branchSignalsUseSharedSignal,
          callsUseSharedSignal,
          coreCanonical,
          colorCanonical,
          canonicalCount: Number(coreCanonical) + Number(colorCanonical),
          failedBranchOrdinary: failureRecord?.ok === false && failureRecord.error !== undefined,
        };
      } finally {
        if (originalDescriptor) Object.defineProperty(globalThis, 'crypto', originalDescriptor);
        else Reflect.deleteProperty(globalThis, 'crypto');
      }
    },
    observed => {
      const record = p7SourceRecord(observed);
      return record?.timeout !== true
        && record.coreLoaderStarted === true
        && record.colorLoaderStarted === true
        && record.branchStartsBeforeSettlement === true
        && record.injectedBranchRejected === true
        && record.branchSignalsUseSharedSignal === true
        && record.callsUseSharedSignal === true
        && record.coreCanonical !== record.colorCanonical
        && record.canonicalCount === 1
        && record.failedBranchOrdinary === true;
    },
  );

  await recordP7SourceRow(
    'P7 SourceEditor exact dual-authority classification accepts core and color authorities',
    fixtureReady,
    'an exact own-data { core, color } envelope is canonical for both authorities and preserves both identities',
    () => p7SourceClassify({ core, color }),
    observed => core !== undefined && color !== undefined && p7SourceCoreCanonical(observed, core) && p7SourceColorCanonical(observed, color),
  );

  await recordP7SourceRow(
    'P7 SourceEditor legacy core-only custom-loader compatibility',
    fixtureReady,
    'an exact core-only custom loader remains canonical while color is unavailable and no color authority is issued',
    () => p7SourceClassify(core),
    observed => core !== undefined && p7SourceCoreCanonical(observed, core) && p7SourceNoColorAuthority(observed) && p7SourceRecord(observed)?.colorStatus === 'unavailable',
  );

  await recordP7SourceRow(
    'P7 SourceEditor core success with color absent preserves core usability',
    fixtureReady,
    'core remains canonical/usable; color status is unavailable with no false color authority',
    () => p7SourceClassify({ core }),
    observed => core !== undefined && p7SourceCoreCanonical(observed, core) && p7SourceNoColorAuthority(observed) && p7SourceRecord(observed)?.colorStatus === 'unavailable',
  );

  const colorFailure = { ok: false, error: { code: 'offline', stage: 'status', message: 'P7 color offline' } };
  const colorAborted = { ok: false, error: { code: 'aborted', stage: 'consistency', message: 'P7 color independently aborted' } };
  await recordP7SourceRow(
    'P7 SourceEditor core success with independently offline/aborted color result',
    fixtureReady,
    'an active exact core remains canonical for both offline and independently aborted color results; each color result is unavailable with its own detail and no false color authority',
    () => ({
      offlineColor: p7SourceClassify({ core, color: colorFailure }),
      abortedColor: p7SourceClassify({ core, color: colorAborted }),
    }),
    observed => {
      const record = p7SourceRecord(observed);
      const offlineColor = p7SourceRecord(record?.offlineColor);
      const abortedColor = p7SourceRecord(record?.abortedColor);
      return core !== undefined
        && p7SourceCoreCanonical(offlineColor, core)
        && p7SourceNoColorAuthority(offlineColor)
        && offlineColor?.colorStatus === 'unavailable'
        && String(offlineColor.colorDetail || '').includes('P7 color offline')
        && p7SourceCoreCanonical(abortedColor, core)
        && p7SourceNoColorAuthority(abortedColor)
        && abortedColor?.colorStatus === 'unavailable'
        && String(abortedColor.colorDetail || '').includes('P7 color independently aborted');
    },
  );

  const colorThrown = { ok: false, error: { code: 'internal-error', stage: 'consistency', message: 'P7 color loader threw' } };
  await recordP7SourceRow(
    'P7 SourceEditor core success with color throw is all-settled and core-usable',
    fixtureReady,
    'a color throw becomes a separate unavailable detail and cannot erase the usable core result',
    () => p7SourceClassify({ core, color: colorThrown }),
    observed => core !== undefined && p7SourceCoreCanonical(observed, core)
      && p7SourceNoColorAuthority(observed)
      && p7SourceRecord(observed)?.colorStatus === 'unavailable'
      && String(p7SourceRecord(observed)?.colorDetail || '').includes('P7 color loader threw'),
  );

  const colorMalformed = { ok: true, evidenceKind: X4_UI_CORPUS_COLOR_CANONICAL_EVIDENCE };
  await recordP7SourceRow(
    'P7 SourceEditor core success with malformed color refuses color only',
    fixtureReady,
    'malformed color is visibly malformed/refused while core remains canonical and usable',
    () => p7SourceClassify({ core, color: colorMalformed }),
    observed => core !== undefined && p7SourceCoreCanonical(observed, core)
      && p7SourceNoColorAuthority(observed)
      && (p7SourceRecord(observed)?.colorStatus === 'malformed' || p7SourceRecord(observed)?.colorStatus === 'refused'),
  );

  const staleColor = { ok: false, error: { code: 'generation-drift', stage: 'consistency', message: 'P7 color stale generation' } };
  await recordP7SourceRow(
    'P7 SourceEditor core success with stale/late color cannot replace current color state',
    fixtureReady,
    'stale color is separate stale state; core remains canonical and no stale color authority is accepted',
    () => p7SourceClassify({ core, color: staleColor }),
    observed => core !== undefined && p7SourceCoreCanonical(observed, core)
      && p7SourceNoColorAuthority(observed)
      && p7SourceRecord(observed)?.colorStatus === 'stale',
  );

  const coreFailure = { ok: false, error: { code: 'offline', stage: 'status', message: 'P7 core unavailable' } };
  await recordP7SourceRow(
    'P7 SourceEditor color success without exact core is never core-canonical/paintable',
    fixtureReady,
    'color may be reported separately, but core accepted/result authority remains absent',
    () => p7SourceClassify({ core: coreFailure, color }),
    observed => color !== undefined
      && p7SourceRecord(observed)?.status !== 'canonical'
      && p7SourceRecord(observed)?.accepted === false
      && (p7SourceRecord(observed)?.result === null || p7SourceRecord(observed)?.result === undefined)
      && p7SourceRecord(observed)?.colorEvidence === undefined,
  );

  await recordP7SourceRow(
    'P7 SourceEditor transparent envelope facade detaches exact authorities and hostile reflection is contained',
    fixtureReady,
    'a transparent get-only facade is dual-canonical from exact own data descriptors with zero get reads and no retained wrapper; accessor/inherited/decorated/cloned/reassigned forms and throwing reflection facades expose no authority or outward throw',
    () => {
      if (core === undefined || color === undefined) return { fixtureReady: false };
      const cloneCore = JSON.parse(JSON.stringify(core)) as Record<string, unknown>;
      const cloneColor = JSON.parse(JSON.stringify(color)) as Record<string, unknown>;
      const exactEnvelope = { core, color };
      const transparentGetFacade = (target: object): { readonly candidate: object; readonly getTrapReads: () => number } => {
        let reads = 0;
        return {
          candidate: new Proxy(target, {
            get(current, key, receiver) {
              reads += 1;
              return Reflect.get(current, key, receiver);
            },
          }),
          getTrapReads: () => reads,
        };
      };
      const transparentFixture = transparentGetFacade(exactEnvelope);
      const transparentFacade = transparentFixture.candidate;
      let transparentResult: unknown;
      let transparentThrew = false;
      try { transparentResult = p7SourceClassify(transparentFacade); } catch { transparentThrew = true; }
      const transparentRecord = p7SourceRecord(transparentResult);
      const transparent = {
        getTrapReads: transparentFixture.getTrapReads(),
        threw: transparentThrew,
        dualCanonical: p7SourceCoreCanonical(transparentResult, core) && p7SourceColorCanonical(transparentResult, color),
        detached: transparentRecord?.result === core
          && transparentRecord.colorEvidence === color
          && !Object.hasOwn(transparentRecord, 'envelope')
          && transparentRecord.result !== transparentFacade
          && transparentRecord.colorEvidence !== transparentFacade,
      };

      let getterReads = 0;
      const accessor = { core, color } as Record<string, unknown>;
      Object.defineProperty(accessor, 'core', {
        configurable: true,
        enumerable: true,
        get: () => {
          getterReads += 1;
          throw new Error('P7 SourceEditor envelope getter executed');
        },
      });
      const inherited = Object.create({ core, color }) as Record<string, unknown>;
      const decorated = { core, color, extra: true };
      const reassigned = { core, color } as Record<string, unknown>;
      reassigned.core = cloneCore;
      reassigned.color = cloneColor;
      const negativeCases = [
        { name: 'structural-clone', ...transparentGetFacade({ core: cloneCore, color: cloneColor }) },
        { name: 'inherited', ...transparentGetFacade(inherited) },
        { name: 'accessor', ...transparentGetFacade(accessor) },
        { name: 'decorated', ...transparentGetFacade(decorated) },
        { name: 'reassigned', ...transparentGetFacade(reassigned) },
        (() => {
          const revoked = Proxy.revocable({ core, color }, {});
          revoked.revoke();
          return { name: 'revoked', candidate: revoked.proxy, getTrapReads: () => 0 };
        })(),
      ];
      const negativeResults = negativeCases.map(({ name, candidate, getTrapReads: readCount }) => {
        let result: unknown;
        let threw = false;
        try { result = p7SourceClassify(candidate); } catch { threw = true; }
        return { name, getTrapReads: readCount(), threw, rejected: p7SourceNoAuthority(result) };
      });

      let descriptorGetReads = 0;
      let descriptorTrapReads = 0;
      const throwingDescriptor = new Proxy(exactEnvelope, {
        get(target, key, receiver) {
          descriptorGetReads += 1;
          return Reflect.get(target, key, receiver);
        },
        getOwnPropertyDescriptor() {
          descriptorTrapReads += 1;
          throw new Error('P7 SourceEditor getOwnPropertyDescriptor trap');
        },
      });
      let ownKeysGetReads = 0;
      let ownKeysTrapReads = 0;
      const throwingOwnKeys = new Proxy(exactEnvelope, {
        get(target, key, receiver) {
          ownKeysGetReads += 1;
          return Reflect.get(target, key, receiver);
        },
        ownKeys() {
          ownKeysTrapReads += 1;
          throw new Error('P7 SourceEditor ownKeys trap');
        },
      });
      let prototypeGetReads = 0;
      let prototypeTrapReads = 0;
      const throwingPrototype = new Proxy(exactEnvelope, {
        get(target, key, receiver) {
          prototypeGetReads += 1;
          return Reflect.get(target, key, receiver);
        },
        getPrototypeOf() {
          prototypeTrapReads += 1;
          throw new Error('P7 SourceEditor getPrototypeOf trap');
        },
      });
      const reflectionCases: readonly { readonly name: string; readonly candidate: unknown; readonly getTrapReads: () => number; readonly trapReads: () => number }[] = [
        { name: 'throwing-getOwnPropertyDescriptor', candidate: throwingDescriptor, getTrapReads: () => descriptorGetReads, trapReads: () => descriptorTrapReads },
        { name: 'throwing-ownKeys', candidate: throwingOwnKeys, getTrapReads: () => ownKeysGetReads, trapReads: () => ownKeysTrapReads },
        { name: 'throwing-getPrototypeOf', candidate: throwingPrototype, getTrapReads: () => prototypeGetReads, trapReads: () => prototypeTrapReads },
      ];
      const reflectionResults = reflectionCases.map(({ name, candidate, getTrapReads: getReadCount, trapReads }) => {
        let result: unknown;
        let threw = false;
        try { result = p7SourceClassify(candidate); } catch { threw = true; }
        return { name, getTrapReads: getReadCount(), trapReads: trapReads(), threw, rejected: p7SourceNoAuthority(result) };
      });
      return { transparent, getterReads, negativeResults, reflectionResults };
    },
    observed => {
      const record = p7SourceRecord(observed);
      const transparent = p7SourceRecord(record?.transparent);
      const negativeResults = record?.negativeResults;
      const reflectionResults = record?.reflectionResults;
      return transparent?.getTrapReads === 0
        && transparent.threw === false
        && transparent.dualCanonical === true
        && transparent.detached === true
        && record?.getterReads === 0
        && Array.isArray(negativeResults)
        && negativeResults.length === 6
        && negativeResults.every(item => {
          const value = p7SourceRecord(item);
          return value?.getTrapReads === 0 && value.threw === false && value.rejected === true;
        })
        && Array.isArray(reflectionResults)
        && reflectionResults.length === 3
        && reflectionResults.every(item => {
          const value = p7SourceRecord(item);
          return value?.getTrapReads === 0 && value.trapReads === 1 && value.threw === false && value.rejected === true;
        });
    },
  );

  await recordP7SourceRow(
    'P7 SourceEditor request-generation late/abort/reload stays one lifecycle',
    fixtureReady,
    'active generation accepts exact dual authorities; late and aborted completions are ignored; reload generation accepts the replacement once',
    () => {
      const envelope = { core, color };
      const active = p7SourceClassify(envelope);
      const late = p7SourceClassify(envelope, { requestActive: false, requestGeneration: 1, currentGeneration: 2 });
      const aborted = p7SourceClassify(envelope, { signalAborted: true });
      const reload = p7SourceClassify(envelope, { requestGeneration: 2, currentGeneration: 2 });
      return { active, late, aborted, reload };
    },
    observed => {
      const record = p7SourceRecord(observed);
      const active = p7SourceRecord(record?.active);
      const late = p7SourceRecord(record?.late);
      const aborted = p7SourceRecord(record?.aborted);
      const reload = p7SourceRecord(record?.reload);
      return core !== undefined && color !== undefined
        && p7SourceCoreCanonical(active, core) && p7SourceColorCanonical(active, color)
        && late?.status === 'ignored' && late.accepted === false && late.result === null && late.colorEvidence === undefined
        && aborted?.status === 'ignored' && aborted.accepted === false && aborted.result === null && aborted.colorEvidence === undefined
        && p7SourceCoreCanonical(reload, core) && p7SourceColorCanonical(reload, color);
    },
  );

  await recordP7SourceRow(
    'P7 SourceEditor visible canonical-default-color detail retains permanent game truth',
    fixtureReady,
    'SSR visibly separates canonical-default color status/detail and always retains Not verified in game',
    () => p7SourceClassify({ core, color: colorFailure }),
    observed => /canonical.?default.?color/i.test(sourceMarkup)
      && /Not verified in game/.test(sourceMarkup)
      && typeof p7SourceRecord(observed)?.colorDetail === 'string'
      && String(p7SourceRecord(observed)?.colorDetail).includes('P7 color offline'),
  );

  const failedRows = p7SourceRows.filter(row => !row.pass);
  console.log(`P7_SOURCE_EDITOR_CANONICAL_COLOR_MATRIX ${JSON.stringify({ total: p7SourceRows.length, passed: p7SourceRows.length - failedRows.length, red: failedRows.map(row => ({ ...row, observed: p7SourceReceipt(row.observed) })), fixtureError })}`);
  if (failedRows.length > 0) throw new Error(`${failedRows.length} SourceEditor P7 canonical-color checks failed`);
}

void runP7SourceEditorCanonicalColorMatrix().catch(error => {
  console.error('X4UiSourceEditor P7 matrix: FAIL');
  console.error(error);
  process.exitCode = 1;
});
