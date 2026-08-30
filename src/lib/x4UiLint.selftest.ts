/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Focused deterministic checks for the pure X4 UI semantic linter.  These
 * fixtures intentionally exercise the call-model boundary rather than Lua
 * parsing internals owned by x4UiCallModel.ts.
 */

import {
  buildX4UiCallModel,
  type X4UiCallModel,
  type X4UiLuaFileInput
} from './x4UiCallModel';
import {
  lintX4UiCallModel,
  type X4UiLintResult
} from './x4UiLint';

export interface X4UiLintSelftestCheck {
  name: string;
  pass: boolean;
  detail?: string;
}

export interface X4UiLintSelftestResult {
  allPassed: boolean;
  pass: boolean;
  passed: number;
  total: number;
  checks: X4UiLintSelftestCheck[];
}

function input(text: string, rel = 'selftest/ui.lua'): X4UiLuaFileInput {
  return { rel, sourcePath: `selftest/${rel}`, text };
}

function lint(text: string, rel?: string): X4UiLintResult {
  return lintX4UiCallModel(buildX4UiCallModel(input(text, rel)));
}

function codes(result: X4UiLintResult, severity?: 'error' | 'warning' | 'info'): string[] {
  return result.findings
    .filter(finding => !severity || finding.severity === severity)
    .map(finding => finding.code);
}

function hasCode(result: X4UiLintResult, code: string, severity?: 'error' | 'warning' | 'info'): boolean {
  return result.findings.some(finding => finding.code === code && (!severity || finding.severity === severity));
}

function hasFailureMode(result: X4UiLintResult, code: string, text: string): boolean {
  const expected = text.toLowerCase();
  return result.findings.some(finding => finding.code === code && finding.failureMode.toLowerCase().includes(expected));
}

function detail(result: X4UiLintResult): string {
  return JSON.stringify({
    status: result.status,
    errors: result.errorCount,
    warnings: result.warningCount,
    gaps: result.verificationGapCount,
    codes: codes(result)
  });
}

function baseFrame(tableArgs: string, body = '', frameHeight = 100): string {
  return [
    'local menu = { name = "Main", layer = 1 }',
    `local frame = Helper.createFrameHandle(menu, { width = 100, height = ${frameHeight} })`,
    `local table = frame:addTable(${tableArgs})`,
    body,
    'frame:display()'
  ].filter(Boolean).join('\n');
}

function budgetFrame(frameHeight: number, tableOptions: string, body: string): string {
  return baseFrame(`2, { width = 2, height = ${frameHeight}${tableOptions} }`, body, frameHeight);
}

function editBoxFrame(call: string): string {
  return baseFrame('2, { width = 2, height = 20, scaling = false }', [
    'local row = table:addRow(nil, { borderBelow = false, scaling = false })',
    `row[1]:${call}`,
  ].join('\n'));
}

const CLEAN_TABLE = baseFrame('2, { width = 2, height = 20 }', [
  'local row = table:addRow(nil, { height = 10 })',
  'row[1]:setText("ok", { fontsize = 12 })'
].join('\n'));

const CLEAN_MENU = [
  'local menu = { name = "Main", layer = 1 }',
  'local frame = Helper.createFrameHandle(menu, { width = 100, height = 100 })',
  'local table = frame:addTable(2, { width = 2, height = 20 })',
  'local row = table:addRow(nil, { height = 10 })',
  'row[1]:setText("ok", { fontsize = 12 })',
  'local handlers = {}',
  'handlers.onClick = function()',
  '  dirty = true',
  'end',
  'frame:display()'
].join('\n');

export function runX4UiLintSelftest(): X4UiLintSelftestResult {
  const checks: X4UiLintSelftestCheck[] = [];
  const check = (name: string, pass: boolean, value?: unknown): void => {
    checks.push({
      name,
      pass: !!pass,
      detail: pass || value === undefined
        ? undefined
        : typeof value === 'string' ? value : JSON.stringify(value)
    });
  };

  const table12 = lint(baseFrame('12, { width = 2, height = 20 }'));
  const table13 = lint(baseFrame('13, { width = 2, height = 20 }'));
  const table23 = lint(baseFrame('23, { width = 2, height = 20 }'));
  const table24 = lint(baseFrame('24, { width = 2, height = 20 }'));
  const tableDynamic = lint(baseFrame('#items, { width = 2, height = 20 }').replace(
    'local table =',
    'local items = getItems()\nlocal table ='
  ));
  const vanilla13Counterexamples = [
    lint(baseFrame('13, { width = 2, height = 20 }'), 'ui/addons/ego_detailmonitor/menu_map.lua'),
    lint(baseFrame('13, { width = 2, height = 20 }'), 'ui/addons/ego_detailmonitor/menu_scenario_selection.lua'),
    lint(baseFrame('13, { width = 2, height = 20 }'), 'ui/addons/ego_detailmonitor/menu_ship_comparison.lua')
  ];
  const unreachableTable = lint([
    'local menu = { name = "Main", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 100 })',
    'if false then',
    '  local deadTable = frame:addTable(24, { width = 2, height = 20 })',
    'end',
    'frame:display()'
  ].join('\n'));
  const trueThenOnly = lint([
    'local menu = { name = "Main", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 100 })',
    'if true then',
    '  local liveTable = frame:addTable(24, { width = 2, height = 20 })',
    'elseif mode then',
    '  local deadElseIf = frame:addTable(24, { width = 2, height = 20 })',
    'else',
    '  local deadElse = frame:addTable(24, { width = 2, height = 20 })',
    'end',
    'frame:display()'
  ].join('\n'));
  check('addTable(12) is clean', !table12.hasErrors && !table12.hasWarnings, detail(table12));
  check('addTable(13) is a nonblocking warning', hasCode(table13, 'x4-ui.add-table-column-limit', 'warning') && !hasCode(table13, 'x4-ui.add-table-column-limit', 'error') && table13.findings.some(finding => finding.evidenceBoundary.includes('valid 13-column tables') && finding.nextAction.includes('in-game')), detail(table13));
  check('addTable(23) is a nonblocking warning', hasCode(table23, 'x4-ui.add-table-column-limit', 'warning') && !hasCode(table23, 'x4-ui.add-table-column-limit', 'error'), detail(table23));
  check('official 13-column shapes are counterexample fixtures', vanilla13Counterexamples.every(result => hasCode(result, 'x4-ui.add-table-column-limit', 'warning') && !hasCode(result, 'x4-ui.add-table-column-limit', 'error')), vanilla13Counterexamples.map(detail));
  check('addTable(24) is a calibrated error', hasCode(table24, 'x4-ui.add-table-column-limit', 'error') && !hasCode(table24, 'x4-ui.add-table-column-limit', 'warning') && table24.findings.some(finding => finding.evidenceBoundary.includes('13-23 unbisected')), detail(table24));
  check('dynamic addTable count is a gap, not a fatal guess', tableDynamic.hasVerificationGaps && !hasCode(tableDynamic, 'x4-ui.add-table-column-limit', 'error'), detail(tableDynamic));
  check('addTable failure mode records whole-frame refusal and conversation symptom', hasFailureMode(table24, 'x4-ui.add-table-column-limit', 'entire frame') && hasFailureMode(table24, 'x4-ui.add-table-column-limit', 'conversation closes'), detail(table24));
  check('statically unreachable addTable(24) is ignored', !hasCode(unreachableTable, 'x4-ui.add-table-column-limit', 'error'), detail(unreachableTable));
  check('if true keeps the live arm and ignores elseif/else findings', trueThenOnly.findings.filter(finding => finding.code === 'x4-ui.add-table-column-limit' && finding.severity === 'error').length === 1, detail(trueThenOnly));

  const widthSmall = lint(baseFrame('2, { width = 1, height = 20 }'));
  const populatedWidthSmall = lint(baseFrame('2, { width = 1, height = 20 }', 'table:addRow(nil, { height = 10 })'));
  const widthTwo = lint(baseFrame('2, { width = 2, height = 20 }'));
  const unresolvedWidthSmall = lint([
    'local menu = { name = "Main", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 100 })',
    'local table = frame:addTable(2, { width = 1, height = 20 })',
    'local unknownTable = getTable()',
    'unknownTable:addRow(nil, { height = 10 })',
    'frame:display()'
  ].join('\n'));
  const incompatibleWidthSmall = lint([
    'local menu = { name = "Main", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 100 })',
    'local table = frame:addTable(2, { width = 1, height = 20 })',
    'local function populate() table:addRow(nil, { height = 10 }) end',
    'frame:display()'
  ].join('\n'));
  const widthDynamic = lint([
    'local menu = { name = "Main", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 100 })',
    'local options = getOptions()',
    'local table = frame:addTable(2, options)',
    'frame:display()'
  ].join('\n'));
  check('empty width-one table is clean', !widthSmall.hasErrors && !hasCode(widthSmall, 'x4-ui.table-width-minimum'), detail(widthSmall));
  check('populated width-one table errors', hasCode(populatedWidthSmall, 'x4-ui.table-width-minimum', 'error'), detail(populatedWidthSmall));
  check('unresolved row population is a nonfatal gap', unresolvedWidthSmall.hasVerificationGaps && !hasCode(unresolvedWidthSmall, 'x4-ui.table-width-minimum', 'error'), detail(unresolvedWidthSmall));
  check('incompatible row population is a nonfatal gap', incompatibleWidthSmall.hasVerificationGaps && !hasCode(incompatibleWidthSmall, 'x4-ui.table-width-minimum', 'error'), detail(incompatibleWidthSmall));
  check('table width two is clean', !hasCode(widthTwo, 'x4-ui.table-width-minimum', 'error'), detail(widthTwo));
  check('dynamic table width is unverified', widthDynamic.hasVerificationGaps && !hasCode(widthDynamic, 'x4-ui.table-width-minimum', 'error'), detail(widthDynamic));
  check('table width failure mode records whole-frame refusal', hasFailureMode(populatedWidthSmall, 'x4-ui.table-width-minimum', 'entire frame') && hasFailureMode(populatedWidthSmall, 'x4-ui.table-width-minimum', 'no partial draw'), detail(populatedWidthSmall));

  const indexBad = lint(baseFrame('2, { width = 2, height = 20 }', [
    'table:setColWidth(1, 10)',
    'table:setColWidth(0, 10)',
    'table:setColWidth(-1, 10)',
    'table:setColWidth(3, 10)'
  ].join('\n')));
  const indexGood = lint(baseFrame('2, { width = 2, height = 20 }', 'table:setColWidth(2, 10)'));
  const indexUnknown = lint([
    'local menu = { name = "Main", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 100 })',
    'local table = frame:addTable(2, { width = 2, height = 20 })',
    'local index = getIndex()',
    'unknownTable:setColWidth(index, 10)',
    'frame:display()'
  ].join('\n'));
  check('zero/negative/greater-than-count indices error', indexBad.findings.filter(finding => finding.code === 'x4-ui.column-index' && finding.severity === 'error').length === 3, detail(indexBad));
  check('in-range column index is clean', !hasCode(indexGood, 'x4-ui.column-index', 'error'), detail(indexGood));
  check('unresolved ownership/index is a gap', indexUnknown.hasVerificationGaps && !hasCode(indexUnknown, 'x4-ui.column-index', 'error'), detail(indexUnknown));
  check('column index failure mode records silent misdraw', hasFailureMode(indexBad, 'x4-ui.column-index', 'silent misdraw'), detail(indexBad));

  const widthFreeze = lint(baseFrame('2, { width = 2, height = 20 }', [
    'table:setColWidth(1, 10)',
    'local row = table:addRow(nil, { height = 10 })',
    'table:setColWidth(2, 10)'
  ].join('\n')));
  const widthOtherTable = lint([
    'local menu = { name = "Main", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 100 })',
    'local first = frame:addTable(2, { width = 2, height = 20 })',
    'local second = frame:addTable(2, { width = 2, height = 20 })',
    'first:addRow(nil, { height = 10 })',
    'second:setColWidth(1, 10)',
    'frame:display()'
  ].join('\n'));
  const sameFunctionWidth = lint([
    'local menu = { name = "Main", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 100 })',
    'local table = frame:addTable(2, { width = 2, height = 20 })',
    'local function configure() table:addRow(nil, { height = 10 }) table:setColWidth(1, 10) end',
    'frame:display()'
  ].join('\n'));
  const splitFunctionWidth = lint([
    'local menu = { name = "Main", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 100 })',
    'local table = frame:addTable(2, { width = 2, height = 20 })',
    'local function addRows() table:addRow(nil, { height = 10 }) end',
    'local function configure() table:setColWidth(1, 10) end',
    'frame:display()'
  ].join('\n'));
  const unreachableRowBeforeWidth = lint(baseFrame('2, { width = 2, height = 20 }', [
    'if false then',
    '  table:addRow(nil, { height = 10 })',
    'end',
    'table:setColWidth(1, 10)'
  ].join('\n')));
  const sameBranchWidth = lint(baseFrame('2, { width = 2, height = 20 }', [
    'if mode then',
    '  table:addRow(nil, { height = 10 })',
    '  table:setColWidth(1, 10)',
    'end'
  ].join('\n')));
  check('same-table width after first row errors', hasCode(widthFreeze, 'x4-ui.width-after-first-row', 'error'), detail(widthFreeze));
  check('another table does not contaminate width freeze', !hasCode(widthOtherTable, 'x4-ui.width-after-first-row', 'error'), detail(widthOtherTable));
  check('unresolved width ownership remains a gap', indexUnknown.hasVerificationGaps && !hasCode(indexUnknown, 'x4-ui.width-after-first-row', 'error'), detail(indexUnknown));
  check('width-after-row failure mode records silently ignored change', hasFailureMode(widthFreeze, 'x4-ui.width-after-first-row', 'silently ignored'), detail(widthFreeze));
  check('same-function width ordering still errors', hasCode(sameFunctionWidth, 'x4-ui.width-after-first-row', 'error'), detail(sameFunctionWidth));
  check('split-function width ordering is a gap without fatal', splitFunctionWidth.hasVerificationGaps && !hasCode(splitFunctionWidth, 'x4-ui.width-after-first-row', 'error'), detail(splitFunctionWidth));
  check('statically unreachable row does not freeze a later width', !hasCode(unreachableRowBeforeWidth, 'x4-ui.width-after-first-row', 'error'), detail(unreachableRowBeforeWidth));
  check('same dynamic branch addRow then setColWidth still errors', hasCode(sameBranchWidth, 'x4-ui.width-after-first-row', 'error'), detail(sameBranchWidth));

  const mixedPercent = lint(baseFrame('3, { width = 2, height = 20 }', [
    'table:setColWidthPercent(1, 40)',
    'table:setColWidthPercent(2, 40)'
  ].join('\n')));
  const underPercent = lint(baseFrame('2, { width = 2, height = 20 }', [
    'table:setColWidthPercent(1, 40)',
    'table:setColWidthPercent(2, 40)'
  ].join('\n')));
  const overPercent = lint(baseFrame('2, { width = 2, height = 20 }', [
    'table:setColWidthPercent(1, 60)',
    'table:setColWidthPercent(2, 50)'
  ].join('\n')));
  const exactPercent = lint(baseFrame('2, { width = 2, height = 20 }', [
    'table:setColWidthPercent(1, 50)',
    'table:setColWidthPercent(2, 50)'
  ].join('\n')));
  const duplicatePercent = lint(baseFrame('2, { width = 2, height = 20 }', [
    'table:setColWidthPercent(1, 50)',
    'table:setColWidthPercent(1, 50)'
  ].join('\n')));
  const dynamicPercent = lint(baseFrame('2, { width = 2, height = 20 }', [
    'local p = getPercent()',
    'table:setColWidthPercent(1, p)',
    'table:setColWidthPercent(2, 50)'
  ].join('\n')));
  const splitPercent = lint([
    'local menu = { name = "Main", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 100 })',
    'local table = frame:addTable(2, { width = 2, height = 20 })',
    'local function setFirst() table:setColWidthPercent(1, 60) end',
    'local function setSecond() table:setColWidthPercent(2, 60) end',
    'frame:display()'
  ].join('\n'));
  const exclusivePercent = lint(baseFrame('2, { width = 2, height = 20 }', [
    'if mode then',
    '  table:setColWidthPercent(1, 60)',
    'else',
    '  table:setColWidthPercent(2, 60)',
    'end'
  ].join('\n')));
  const sameBranchPercent = lint(baseFrame('2, { width = 2, height = 20 }', [
    'if mode then',
    '  table:setColWidthPercent(1, 60)',
    '  table:setColWidthPercent(2, 60)',
    'end'
  ].join('\n')));
  const outsideInsidePercent = lint(baseFrame('2, { width = 2, height = 20 }', [
    'table:setColWidthPercent(1, 60)',
    'if mode then',
    '  table:setColWidthPercent(2, 50)',
    'end'
  ].join('\n')));
  const nestedSiblingPercent = lint(baseFrame('3, { width = 2, height = 20 }', [
    'if outerMode then',
    '  if innerMode then',
    '    table:setColWidthPercent(1, 60)',
    '  else',
    '    table:setColWidthPercent(2, 60)',
    '  end',
    'else',
    '  table:setColWidthPercent(3, 60)',
    'end'
  ].join('\n')));
  check('mixed explicit/automatic percentages are clean', !hasCode(mixedPercent, 'x4-ui.column-percentage-total', 'error') && !hasCode(mixedPercent, 'x4-ui.column-percentage-total', 'warning'), detail(mixedPercent));
  check('all-explicit percentages below 100 warn', hasCode(underPercent, 'x4-ui.column-percentage-total', 'warning'), detail(underPercent));
  check('percentage total above 100 errors', hasCode(overPercent, 'x4-ui.column-percentage-total', 'error'), detail(overPercent));
  check('exact percentage total 100 is clean', !hasCode(exactPercent, 'x4-ui.column-percentage-total'), detail(exactPercent));
  check('duplicate percentage ownership is conservative', duplicatePercent.hasVerificationGaps && !hasCode(duplicatePercent, 'x4-ui.column-percentage-total', 'warning') && !hasCode(duplicatePercent, 'x4-ui.column-percentage-total', 'error'), detail(duplicatePercent));
  check('dynamic percentage is conservative', dynamicPercent.hasVerificationGaps && !hasCode(dynamicPercent, 'x4-ui.column-percentage-total', 'error'), detail(dynamicPercent));
  check('split-function percentage total is unverified without fatal', splitPercent.hasVerificationGaps && !hasCode(splitPercent, 'x4-ui.column-percentage-total'), detail(splitPercent));
  check('percentage overflow failure mode records unpredictable distribution', hasFailureMode(overPercent, 'x4-ui.column-percentage-total', 'unpredictable'), detail(overPercent));
  check('contracted percentage failure mode records contracted distribution', hasFailureMode(underPercent, 'x4-ui.column-percentage-total', 'contracts'), detail(underPercent));
  check('mutually exclusive percentages are a percentage gap without a total finding', exclusivePercent.verificationGaps.some(gap => gap.category === 'percentage') && !hasCode(exclusivePercent, 'x4-ui.column-percentage-total'), detail(exclusivePercent));
  check('same dynamic branch percentages still error', hasCode(sameBranchPercent, 'x4-ui.column-percentage-total', 'error'), detail(sameBranchPercent));
  check('outside-branch plus compatible arm percentages still error', hasCode(outsideInsidePercent, 'x4-ui.column-percentage-total', 'error'), detail(outsideInsidePercent));
  check('nested sibling branches do not aggregate percentages', nestedSiblingPercent.verificationGaps.some(gap => gap.category === 'percentage') && !hasCode(nestedSiblingPercent, 'x4-ui.column-percentage-total'), detail(nestedSiblingPercent));

  const colspanGood = lint(baseFrame('3, { width = 2, height = 20 }', [
    'local row = table:addRow(nil, { height = 10 })',
    'row[2]:setColSpan(2)'
  ].join('\n')));
  const colspanBad = lint(baseFrame('3, { width = 2, height = 20 }', [
    'local row = table:addRow(nil, { height = 10 })',
    'row[2]:setColSpan(3)'
  ].join('\n')));
  const colspanDynamic = lint(baseFrame('3, { width = 2, height = 20 }', [
    'local row = table:addRow(nil, { height = 10 })',
    'local start = getIndex()',
    'row[start]:setColSpan(2)'
  ].join('\n')));
  check('colspan within table is clean', !hasCode(colspanGood, 'x4-ui.colspan-overrun', 'error'), detail(colspanGood));
  check('colspan overrun errors', hasCode(colspanBad, 'x4-ui.colspan-overrun', 'error'), detail(colspanBad));
  check('dynamic colspan ownership is a gap', colspanDynamic.hasVerificationGaps && !hasCode(colspanDynamic, 'x4-ui.colspan-overrun', 'error'), detail(colspanDynamic));
  check('colspan failure mode records layout corruption', hasFailureMode(colspanBad, 'x4-ui.colspan-overrun', 'layout corruption'), detail(colspanBad));

  const fontScale = lint(baseFrame('2, { width = 2, height = 20 }', 'table:addRow():createText("x", { fontsize = Helper.scaleX(12) })'));
  const fontScaleY = lint(baseFrame('2, { width = 2, height = 20 }', 'table:addRow():createText("x", { fontsize = Helper.scaleY(12) })'));
  const fontScaleFont = lint(baseFrame('2, { width = 2, height = 20 }', 'table:addRow():createText("x", { fontsize = Helper.scaleFont("Zekton", 12) })'));
  const fontStatic = lint(baseFrame('2, { width = 2, height = 20 }', 'table:addRow():createText("x", { fontsize = 12 })'));
  check('scaleX rendered fontsize errors', hasCode(fontScale, 'x4-ui.font-scale', 'error'), detail(fontScale));
  check('scaleY rendered fontsize errors', hasCode(fontScaleY, 'x4-ui.font-scale', 'error'), detail(fontScaleY));
  check('scaleFont has no font-scale error or fontsize gap', !hasCode(fontScaleFont, 'x4-ui.font-scale') && !fontScaleFont.verificationGaps.some(gap => gap.category === 'fontsize'), detail(fontScaleFont));
  check('ordinary static fontsize is clean', !hasCode(fontStatic, 'x4-ui.font-scale', 'error') && !hasCode(fontStatic, 'x4-ui.font-scale', 'warning'), detail(fontStatic));
  check('scaleX failure mode records doubled overflow', hasFailureMode(fontScale, 'x4-ui.font-scale', 'approximately twice') && hasFailureMode(fontScale, 'x4-ui.font-scale', 'overflows its container'), detail(fontScale));

  const unicode = lint([
    'local menu = { name = "Main", layer = 1, prompt = "é" }',
    '-- rendered text comment: é',
    'local arbitrary = "é"',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 100 })',
    'local table = frame:addTable(2, { width = 2, height = 20 })',
    'local row = table:addRow(nil, { height = 10 })',
    'row[1]:setText("é")',
    'row[2]:createEditBox({ defaultText = "é", description = "é" })',
    'frame:display()'
  ].join('\n'));
  const unicodeClean = lint([
    'local menu = { name = "Main", layer = 1, prompt = "é" }',
    '-- arbitrary comment: é',
    'local arbitrary = "é"',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 100 })',
    'local table = frame:addTable(2, { width = 2, height = 20 })',
    'local row = table:addRow(nil, { height = 10 })',
    'row[1]:setText("ascii")',
    'frame:display()'
  ].join('\n'));
  check('direct rendered non-ASCII warns', unicode.findings.filter(finding => finding.code === 'x4-ui.rendered-non-ascii' && finding.severity === 'warning').length >= 2, detail(unicode));
  check('comments/prompts/arbitrary/non-render strings stay clean', !hasCode(unicodeClean, 'x4-ui.rendered-non-ascii', 'warning'), detail(unicodeClean));
  check('rendered non-ASCII failure mode records Zekton box glyph', hasFailureMode(unicode, 'x4-ui.rendered-non-ascii', 'box glyph'), detail(unicode));

  const ignoredAddRowHeight = lint(budgetFrame(10, ', scaling = false', 'table:addRow(nil, { height = 100, borderBelow = false })'));
  const productionShapedCell = lint(budgetFrame(10, ', scaling = false', 'table:addRow(nil, { borderBelow = false })[1]:createText("x", { height = 11 })'));
  const largeCell = lint(budgetFrame(10, ', scaling = false', 'local row = table:addRow(nil, { borderBelow = false })\nrow[1]:createText("x", { height = 11 })'));
  const maxCellRow = lint(budgetFrame(9, ', scaling = false', [
    'local oddRow = table:addRow(nil, { borderBelow = false })',
    'oddRow[1]:createText("x", { height = 6 })',
    'oddRow[2]:createButton({ height = 8 })'
  ].join('\n')));
  const summedRows = lint(budgetFrame(10, ', scaling = false', [
    'local firstRow = table:addRow(nil, { borderBelow = false })',
    'firstRow[1]:createText("x", { height = 6 })',
    'local secondRow = table:addRow(nil, { borderBelow = false })',
    'secondRow[1]:createText("x", { height = 6 })'
  ].join('\n')));
  const unknownBorderRows = lint(budgetFrame(10, ', scaling = false', [
    'local firstRow = table:addRow(nil, {})',
    'firstRow[1]:createText("x", { height = 5 })',
    'local secondRow = table:addRow(nil, { borderBelow = false })',
    'secondRow[1]:createText("x", { height = 5 })'
  ].join('\n')));
  const paddedRow = lint(budgetFrame(10, ', scaling = false', [
    'local row = table:addRow(nil, { paddingTop = 2, paddingBottom = 1, borderBelow = false })',
    'row[1]:createText("x", { height = 8 })'
  ].join('\n')));
  const tableOverflow = lint(baseFrame('2, { width = 2, height = 30 }', 'table:addRow(nil, { height = 5 })').replace('height = 100', 'height = 20'));
  const budgetEqual = lint(budgetFrame(10, ', scaling = false', [
    'local firstRow = table:addRow(nil, { borderBelow = false })',
    'firstRow[1]:createText("x", { height = 5 })',
    'local secondRow = table:addRow(nil, { borderBelow = false })',
    'secondRow[1]:createText("x", { height = 5 })'
  ].join('\n')));
  const budgetDynamic = lint(budgetFrame(10, ', scaling = false', [
    'local rowHeight = getHeight()',
    'local row = table:addRow(nil, { borderBelow = false })',
    'row[1]:createText("x", { height = rowHeight })'
  ].join('\n')));
  const scalingOmitted = lint(budgetFrame(10, '', [
    'local row = table:addRow(nil, { borderBelow = false })',
    'row[1]:createText("x", { height = 11 })'
  ].join('\n')));
  const scalingTrue = lint(budgetFrame(10, ', scaling = true', [
    'local row = table:addRow(nil, { borderBelow = false })',
    'row[1]:createText("x", { height = 11 })'
  ].join('\n')));
  const tableScalingForcesFalse = lint(budgetFrame(10, ', scaling = false', [
    'local row = table:addRow(nil, { borderBelow = false, scaling = true })',
    'row[1]:createText("x", { height = 11 })'
  ].join('\n')));
  const roundedFractional = lint(budgetFrame(1, ', scaling = false', [
    'local row = table:addRow(nil, { borderBelow = false })',
    'row[1]:createText("x", { height = 0.6, y = 0.6 })'
  ].join('\n')));
  const roundedNegativeY = lint(budgetFrame(1, ', scaling = false', [
    'local row = table:addRow(nil, { borderBelow = false })',
    'row[1]:createText("x", { height = 1.6, y = -0.6 })'
  ].join('\n')));
  const dynamicY = lint(budgetFrame(10, ', scaling = false', [
    'local y = getY()',
    'local row = table:addRow(nil, { borderBelow = false })',
    'row[1]:createText("x", { height = 8, y = y })'
  ].join('\n')));
  const dynamicScaling = lint(budgetFrame(10, '', [
    'local scaling = getScaling()',
    'local row = table:addRow(nil, { borderBelow = false })',
    'row[1]:createText("x", { height = 8, scaling = scaling })'
  ].join('\n')));
  const dynamicOwnership = lint(budgetFrame(10, ', scaling = false', [
    'local row = getRow()',
    'row[1]:createText("x", { height = 20 })'
  ].join('\n')));
  const loopRows = lint(budgetFrame(8, ', scaling = false', [
    'for i = 1, 2 do',
    '  local row = table:addRow(nil, { borderBelow = false })',
    '  row[1]:createText("x", { height = 8 })',
    'end'
  ].join('\n')));
  const splitRows = lint([
    'local menu = { name = "Main", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 100 })',
    'local table = frame:addTable(2, { width = 2, height = 10, scaling = false })',
    'local function addFirst() local row = table:addRow(nil, { borderBelow = false }) row[1]:createText("x", { height = 6, scaling = false }) end',
    'local function addSecond() local row = table:addRow(nil, { borderBelow = false }) row[1]:createText("x", { height = 6, scaling = false }) end',
    'frame:display()'
  ].join('\n'));
  const exclusiveRows = lint(baseFrame('2, { width = 2, height = 10 }', [
    'if mode then',
    '  local row = table:addRow(nil, { borderBelow = false, scaling = false })',
    '  row[1]:createText("x", { height = 8, scaling = false })',
    'else',
    '  local row = table:addRow(nil, { borderBelow = false, scaling = false })',
    '  row[1]:createText("x", { height = 8, scaling = false })',
    'end'
  ].join('\n')).replace('height = 100', 'height = 10'));
  const sameBranchRows = lint(baseFrame('2, { width = 2, height = 10 }', [
    'if mode then',
    '  local firstRow = table:addRow(nil, { borderBelow = false, scaling = false })',
    '  firstRow[1]:createText("x", { height = 8, scaling = false })',
    '  local secondRow = table:addRow(nil, { borderBelow = false, scaling = false })',
    '  secondRow[1]:createText("x", { height = 8, scaling = false })',
    'end'
  ].join('\n')).replace('height = 100', 'height = 10'));
  const maxVisibleClamp = lint(budgetFrame(100, ', maxVisibleHeight = 10, scaling = false', [
    'local row = table:addRow(nil, { borderBelow = false })',
    'row[1]:createText("x", { height = 11 })'
  ].join('\n')));
  const frameTableYOverflow = lint(baseFrame('2, { width = 2, height = 20, y = 5, scaling = false }', [
    'local row = table:addRow(nil, { borderBelow = false })',
    'row[1]:createText("x", { height = 16 })'
  ].join('\n'), 20));
  const tableHeightNotRowBudget = lint(baseFrame('2, { width = 2, height = 2, scaling = false }', [
    'local row = table:addRow(nil, { borderBelow = false })',
    'row[1]:createText("x", { height = 5 })'
  ].join('\n'), 10));
  const buttonDefault = lint(budgetFrame(24, ', scaling = false', 'table:addRow(nil, { borderBelow = false })[1]:createButton()'));
  const baseCellDefaults = lint(budgetFrame(1, ', scaling = false', [
    'local row = table:addRow(nil, { borderBelow = false })',
    'row[1]:createIcon("icon")',
    'row[2]:createEditBox()'
  ].join('\n')));
  const affectRowHeightFalse = lint(budgetFrame(1, '', 'table:addRow(nil, { borderBelow = false })[1]:createIcon("icon", { height = 700, y = 900, affectRowHeight = false })'));
  const buttonAffectRowHeightFalse = lint(budgetFrame(1, '', 'table:addRow(nil, { borderBelow = false })[1]:createButton({ height = 700, y = 900, affectRowHeight = false })'));
  const autoFrameHeightTrue = lint([
    'local menu = { name = "Main", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 10, autoFrameHeight = true })',
    'local table = frame:addTable(2, { width = 2, height = 10, scaling = false })',
    'local row = table:addRow(nil, { borderBelow = false })',
    'row[1]:createText("x", { height = 11 })',
    'frame:display()'
  ].join('\n'));
  const autoFrameHeightDynamic = lint([
    'local menu = { name = "Main", layer = 1 }',
    'local autoFrameHeight = getAutoFrameHeight()',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 10, autoFrameHeight = autoFrameHeight })',
    'local table = frame:addTable(2, { width = 2, height = 10, scaling = false })',
    'local row = table:addRow(nil, { borderBelow = false })',
    'row[1]:createText("x", { height = 11 })',
    'frame:display()'
  ].join('\n'));
  const autoFrameHeightFalse = lint([
    'local menu = { name = "Main", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 10, autoFrameHeight = false })',
    'local table = frame:addTable(2, { width = 2, height = 10, scaling = false })',
    'local row = table:addRow(nil, { borderBelow = false })',
    'row[1]:createText("x", { height = 11 })',
    'frame:display()'
  ].join('\n'));
  const textMetricGap = lint(budgetFrame(100, ', scaling = false', 'table:addRow(nil, { borderBelow = false })[1]:createText("x")'));
  const textZeroMetricGap = lint(budgetFrame(100, ', scaling = false', 'table:addRow(nil, { borderBelow = false })[1]:createText("x", { height = 0 })'));
  const setTextDoesNotResize = lint(budgetFrame(50, ', scaling = false', 'table:addRow(nil, { borderBelow = false })[1]:createButton():setText("x", { height = 100 })'));
  const independentTables = lint([
    'local menu = { name = "Main", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 10 })',
    'local first = frame:addTable(2, { width = 2, height = 10, scaling = false })',
    'local firstRow = first:addRow(nil, { borderBelow = false })',
    'firstRow[1]:createText("x", { height = 11 })',
    'local second = frame:addTable(2, { width = 2, height = 10, scaling = false })',
    'local secondRow = second:addRow(nil, { borderBelow = false })',
    'secondRow[1]:createText("x", { height = 2 })',
    'frame:display()'
  ].join('\n'));
  check('ignored addRow height is visibly ignored and cannot trigger row budget', ignoredAddRowHeight.verificationGaps.some(gap => gap.reason.includes('Helper ignores addRow height')) && !hasCode(ignoredAddRowHeight, 'x4-ui.row-height-budget', 'warning'), detail(ignoredAddRowHeight));
  check('production-shaped addRow()[1] cell height trips the real warning', hasCode(productionShapedCell, 'x4-ui.row-height-budget', 'warning'), detail(productionShapedCell));
  check('one explicit large cell trips row budget', hasCode(largeCell, 'x4-ui.row-height-budget', 'warning'), detail(largeCell));
  check('two cells in one row use the maximum, not a column sum', !hasCode(maxCellRow, 'x4-ui.row-height-budget') && !maxCellRow.hasVerificationGaps, detail(maxCellRow));
  check('two independent rows sum their maxima', hasCode(summedRows, 'x4-ui.row-height-budget', 'warning'), detail(summedRows));
  check('unknown inter-row border is a gap, not an invented border size', unknownBorderRows.verificationGaps.some(gap => gap.reason.includes('border contribution')) && !hasCode(unknownBorderRows, 'x4-ui.row-height-budget', 'warning'), detail(unknownBorderRows));
  check('literal row padding participates in row height', hasCode(paddedRow, 'x4-ui.row-height-budget', 'warning'), detail(paddedRow));
  check('dynamic cell height is a gap, not a fabricated zero', budgetDynamic.verificationGaps.some(gap => gap.category === 'height') && !hasCode(budgetDynamic, 'x4-ui.row-height-budget', 'warning'), detail(budgetDynamic));
  check('omitted scaling is a scale gap without a raw-unit row warning', scalingOmitted.verificationGaps.some(gap => gap.category === 'scale') && !hasCode(scalingOmitted, 'x4-ui.row-height-budget', 'warning'), detail(scalingOmitted));
  check('scaling=true is a scale gap without a raw-unit row warning', scalingTrue.verificationGaps.some(gap => gap.category === 'scale') && !hasCode(scalingTrue, 'x4-ui.row-height-budget', 'warning'), detail(scalingTrue));
  check('table scaling=false forces effective row scaling=false', hasCode(tableScalingForcesFalse, 'x4-ui.row-height-budget', 'warning') && !tableScalingForcesFalse.verificationGaps.some(gap => gap.category === 'scale'), detail(tableScalingForcesFalse));
  check('scaling=false rounds fractional y and height separately', hasCode(roundedFractional, 'x4-ui.row-height-budget', 'warning') && roundedFractional.findings.some(finding => finding.code === 'x4-ui.row-height-budget' && finding.message.includes('row height 2')), detail(roundedFractional));
  check('scaling=false applies Helper.round to negative y', !hasCode(roundedNegativeY, 'x4-ui.row-height-budget') && !roundedNegativeY.hasVerificationGaps, detail(roundedNegativeY));
  check('dynamic y is a height gap without a warning', dynamicY.verificationGaps.some(gap => gap.category === 'height') && !hasCode(dynamicY, 'x4-ui.row-height-budget', 'warning'), detail(dynamicY));
  check('dynamic scaling is a gap without a warning', dynamicScaling.verificationGaps.some(gap => gap.category === 'scale' || gap.category === 'height') && !hasCode(dynamicScaling, 'x4-ui.row-height-budget', 'warning'), detail(dynamicScaling));
  check('dynamic cell ownership remains a gap', dynamicOwnership.hasVerificationGaps && !hasCode(dynamicOwnership, 'x4-ui.row-height-budget', 'warning'), detail(dynamicOwnership));
  check('loop rows are incomplete without invented multiplicity', loopRows.verificationGaps.some(gap => gap.reason.includes('loopPath')) && !hasCode(loopRows, 'x4-ui.row-height-budget', 'warning'), detail(loopRows));
  check('split-function rows are unverified without warning', splitRows.hasVerificationGaps && !hasCode(splitRows, 'x4-ui.row-height-budget', 'warning'), detail(splitRows));
  check('mutually exclusive rows do not aggregate', exclusiveRows.verificationGaps.some(gap => gap.category === 'height') && !hasCode(exclusiveRows, 'x4-ui.row-height-budget', 'warning'), detail(exclusiveRows));
  check('same-branch rows still warn', hasCode(sameBranchRows, 'x4-ui.row-height-budget', 'warning'), detail(sameBranchRows));
  check('maxVisibleHeight is the visible-height clamp', hasCode(maxVisibleClamp, 'x4-ui.row-height-budget', 'warning') && maxVisibleClamp.findings.some(finding => finding.code === 'x4-ui.row-height-budget' && finding.message.includes('maxVisibleHeight')), detail(maxVisibleClamp));
  check('table y participates in frame overflow', hasCode(frameTableYOverflow, 'x4-ui.row-height-budget', 'warning') && frameTableYOverflow.findings.some(finding => finding.code === 'x4-ui.row-height-budget' && finding.message.includes('table y')), detail(frameTableYOverflow));
  check('addTable height is not a fake row budget', !hasCode(tableHeightNotRowBudget, 'x4-ui.row-height-budget'), detail(tableHeightNotRowBudget));
  check('button default is source-pinned Helper.standardButtonHeight 25', hasCode(buttonDefault, 'x4-ui.row-height-budget', 'warning') && buttonDefault.findings.some(finding => finding.code === 'x4-ui.row-height-budget' && finding.cause.includes('standardButtonHeight') && finding.cause.includes('25')), detail(buttonDefault));
  check('icon/edit-box/base outer defaults remain zero', !hasCode(baseCellDefaults, 'x4-ui.row-height-budget') && !baseCellDefaults.hasVerificationGaps, detail(baseCellDefaults));
  check('affectRowHeight=false gives icon the exact boundary-1 contribution and ignores y/height', !hasCode(affectRowHeightFalse, 'x4-ui.row-height-budget') && !affectRowHeightFalse.hasVerificationGaps, detail(affectRowHeightFalse));
  check('affectRowHeight=false gives button the exact boundary-1 contribution and ignores y/height', !hasCode(buttonAffectRowHeightFalse, 'x4-ui.row-height-budget') && !buttonAffectRowHeightFalse.hasVerificationGaps, detail(buttonAffectRowHeightFalse));
  check('autoFrameHeight=true leaves the visible boundary incomplete without a row warning', autoFrameHeightTrue.verificationGaps.some(gap => gap.reason.includes('autoFrameHeight')) && !hasCode(autoFrameHeightTrue, 'x4-ui.row-height-budget', 'warning'), detail(autoFrameHeightTrue));
  check('dynamic autoFrameHeight leaves the visible boundary incomplete without a row warning', autoFrameHeightDynamic.verificationGaps.some(gap => gap.reason.includes('autoFrameHeight')) && !hasCode(autoFrameHeightDynamic, 'x4-ui.row-height-budget', 'warning'), detail(autoFrameHeightDynamic));
  check('autoFrameHeight=false preserves the resolved row boundary', hasCode(autoFrameHeightFalse, 'x4-ui.row-height-budget', 'warning'), detail(autoFrameHeightFalse));
  check('text metrics are not invented', textMetricGap.verificationGaps.some(gap => gap.reason.includes('metrics-dependent')) && !hasCode(textMetricGap, 'x4-ui.row-height-budget', 'warning'), detail(textMetricGap));
  check('zero text height remains metrics-dependent', textZeroMetricGap.verificationGaps.some(gap => gap.reason.includes('metrics-dependent')) && !hasCode(textZeroMetricGap, 'x4-ui.row-height-budget', 'warning'), detail(textZeroMetricGap));
  check('setText does not replace outer cell height', !hasCode(setTextDoesNotResize, 'x4-ui.row-height-budget'), detail(setTextDoesNotResize));
  check('independent tables do not contaminate each other', independentTables.findings.filter(finding => finding.code === 'x4-ui.row-height-budget' && finding.severity === 'warning').length === 1, detail(independentTables));
  check('row overflow failure mode records last table disappearance', hasFailureMode(summedRows, 'x4-ui.row-height-budget', 'last table silently vanish'), detail(summedRows));
  check('table height above frame height warns', hasCode(tableOverflow, 'x4-ui.table-height-budget', 'warning'), detail(tableOverflow));
  check('equal row/table/frame budgets are clean', !hasCode(budgetEqual, 'x4-ui.row-height-budget') && !hasCode(budgetEqual, 'x4-ui.table-height-budget'), detail(budgetEqual));

  const editBoxOmitted = lint(editBoxFrame('createEditBox()'));
  const editBoxFormerPipelineOmitted = lint(editBoxFrame('createEditBox()'), 'ui/pipeline_test.lua');
  const editBoxCurrentPipeline = lint(editBoxFrame('createEditBox({ height = 44 })'), 'ui/pipeline_test.lua');
  const editBoxZero = lint(editBoxFrame('createEditBox({ height = 0 })'));
  const editBoxPositive = lint(editBoxFrame('createEditBox({ height = 12 })'));
  const editBoxDynamic = lint(editBoxFrame('createEditBox({ height = getHeight() })'));
  const editBoxFinding = editBoxOmitted.findings.find(finding => finding.code === 'x4-ui.editbox-height-minimum');
  const editBoxFormerPipelineFinding = editBoxFormerPipelineOmitted.findings.find(finding => finding.code === 'x4-ui.editbox-height-minimum');
  const editBoxZeroFinding = editBoxZero.findings.find(finding => finding.code === 'x4-ui.editbox-height-minimum');
  const hasTruthfulEditBoxFailureMode = (failureMode: string | undefined): boolean => {
    const normalized = failureMode?.toLowerCase() || '';
    return normalized.includes('x4 displays the frame')
      && normalized.includes('height(0 px)')
      && normalized.includes('overlap eachother')
      && normalized.includes('clipped/overlapped')
      && !normalized.includes('reject')
      && !normalized.includes('refus')
      && !normalized.includes('entire frame');
  };
  check('omitted editbox height is a nonblocking calibrated warning', Boolean(
    editBoxFinding
      && editBoxFinding.severity === 'warning'
      && !editBoxOmitted.hasErrors
      && editBoxOmitted.hasWarnings
      && editBoxFinding.cause.includes('base widget height defaults to zero')
      && editBoxFinding.cause.includes('table default cell properties')
      && editBoxFinding.cause.includes('displayed-hotkey minimum handling')
      && editBoxFinding.cause.includes('positive row peers affect row height only')
      && hasTruthfulEditBoxFailureMode(editBoxFinding.failureMode)
      && editBoxFinding.evidenceBoundary.includes('Official X4 9.00 omission counterexamples')
      && editBoxFinding.evidenceBoundary.includes('positive-height row contexts')
      && editBoxFinding.evidenceBoundary.includes('row:getHeight()')
      && editBoxFinding.evidenceBoundary.includes('does not supply the editbox descriptor height')
      && editBoxFinding.evidenceBoundary.includes('only table default cell properties and displayed-hotkey minimum handling')
      && !editBoxFinding.evidenceBoundary.includes('This bounded model does not resolve those descriptor paths')
      && editBoxFinding.evidenceBoundary.includes('Exact statically modeled table default cell properties and displayed-hotkey minimum handling are resolved')
      && editBoxFinding.evidenceBoundary.includes('no such positive source-proven path was found')
      && editBoxFinding.evidenceBoundary.includes('dynamic, conditional, malformed, and unresolved paths remain verification gaps')
      && editBoxFinding.evidenceBoundary.includes('Not verified in game.')
      && editBoxFinding.nextAction.includes('explicit positive')
      && editBoxFinding.nextAction.includes('in-game')
      && editBoxFinding.location.file === 'selftest/ui.lua'
      && editBoxFinding.location.start.line >= 1
  ), detail(editBoxOmitted));
  check('former pipeline omitted editbox fixture is a nonblocking warning', Boolean(
    editBoxFormerPipelineOmitted.status === 'warnings'
      && !editBoxFormerPipelineOmitted.hasErrors
      && editBoxFormerPipelineFinding
      && editBoxFormerPipelineFinding.severity === 'warning'
      && editBoxFormerPipelineFinding.location.file === 'ui/pipeline_test.lua'
  ), detail(editBoxFormerPipelineOmitted));
  check('current height=44 pipeline fixture is clean for the rule', editBoxCurrentPipeline.status === 'clean'
    && !hasCode(editBoxCurrentPipeline, 'x4-ui.editbox-height-minimum'), detail(editBoxCurrentPipeline));
  check('literal-zero editbox height reports the displayed clipped field', Boolean(
    editBoxZeroFinding
      && editBoxZeroFinding.severity === 'error'
      && editBoxZero.hasErrors
      && editBoxZero.status === 'errors'
      && editBoxZeroFinding.cause.includes('overrides table default cell properties')
      && editBoxZeroFinding.cause.includes('absent the separate displayed-hotkey minimum')
      && editBoxZeroFinding.cause.includes('positive row peers affect row height only')
      && editBoxZeroFinding.evidenceBoundary.includes('positive row peers do not alter the editbox descriptor height')
      && hasTruthfulEditBoxFailureMode(editBoxZeroFinding.failureMode)
  ), detail(editBoxZero));
  check('positive static editbox height is clean for the rule', !hasCode(editBoxPositive, 'x4-ui.editbox-height-minimum'), detail(editBoxPositive));
  check('dynamic editbox height is an explicit verification gap', editBoxDynamic.hasVerificationGaps
    && editBoxDynamic.verificationGaps.some(gap => gap.category === 'height' && gap.status === 'dynamic' && gap.expression === 'getHeight()')
    && !hasCode(editBoxDynamic, 'x4-ui.editbox-height-minimum', 'error'), detail(editBoxDynamic));

  const editBoxDefaultFrame = (body: string): string => baseFrame('1, { width = 2, height = 20, scaling = false }', [
    body,
    'local row = table:addRow(nil, { borderBelow = false, scaling = false })',
    'row[1]:createEditBox({})',
  ].join('\n'));
  const editBoxSimpleDefault = lint(editBoxDefaultFrame(
    'table:setDefaultCellProperties("editbox", { height = 12, scaling = false })',
  ));
  const editBoxComplexDefault = lint(editBoxDefaultFrame(
    'table:setDefaultComplexCellProperties("editbox", "hotkey", { hotkey = "DEFAULT", displayIcon = true })',
  ));
  const editBoxZeroDisplayedDefault = lint(baseFrame('1, { width = 2, height = 20, scaling = false }', [
    'table:setDefaultComplexCellProperties("editbox", "hotkey", { hotkey = "DEFAULT", displayIcon = true })',
    'local row = table:addRow(nil, { borderBelow = false, scaling = false })',
    'row[1]:createEditBox({ height = 0 })',
  ].join('\n')));
  const editBoxDirectDisplayed = lint(baseFrame('1, { width = 2, height = 20, scaling = false }', [
    'local row = table:addRow(nil, { borderBelow = false, scaling = false })',
    'local editbox = row[1]:createEditBox({})',
    'editbox:setHotkey("DIRECT", { displayIcon = true })',
  ].join('\n')));
  const editBoxDirectZeroDisplayed = lint(baseFrame('1, { width = 2, height = 20, scaling = false }', [
    'local row = table:addRow(nil, { borderBelow = false, scaling = false })',
    'local editbox = row[1]:createEditBox({ height = 0 })',
    'editbox:setHotkey("DIRECT", { displayIcon = true })',
  ].join('\n')));
  const editBoxDirectEmpty = lint(baseFrame('1, { width = 2, height = 20, scaling = false }', [
    'local row = table:addRow(nil, { borderBelow = false, scaling = false })',
    'local editbox = row[1]:createEditBox({ height = 0 })',
    'editbox:setHotkey("", { displayIcon = false })',
  ].join('\n')));
  const editBoxDynamicDefaultThenStaticEmptyOverride = lint(baseFrame('1, { width = 2, height = 20, scaling = false }', [
    'table:setDefaultComplexCellProperties("editbox", "hotkey", { hotkey = getHotkey(), displayIcon = true })',
    'local row = table:addRow(nil, { borderBelow = false, scaling = false })',
    'local editbox = row[1]:createEditBox({ height = 0 })',
    'editbox:setHotkey("VISIBLE_ARGUMENT", { hotkey = "", displayIcon = false, x = 0 })',
  ].join('\n')));
  const editBoxDynamicDefaultThenStaticVisibleOverride = lint(baseFrame('1, { width = 2, height = 20, scaling = false }', [
    'table:setDefaultComplexCellProperties("editbox", "hotkey", { hotkey = getHotkey(), displayIcon = true })',
    'local row = table:addRow(nil, { borderBelow = false, scaling = false })',
    'local editbox = row[1]:createEditBox({ height = 0 })',
    'editbox:setHotkey("", { hotkey = "VISIBLE_PROPERTY", displayIcon = true })',
  ].join('\n')));
  const editBoxDynamicDefaultThenOmittedIcon = lint(baseFrame('1, { width = 2, height = 20, scaling = false }', [
    'table:setDefaultComplexCellProperties("editbox", "hotkey", { hotkey = getHotkey(), displayIcon = true })',
    'local row = table:addRow(nil, { borderBelow = false, scaling = false })',
    'local editbox = row[1]:createEditBox({ height = 0 })',
    'editbox:setHotkey("", { hotkey = "" })',
  ].join('\n')));
  const editBoxDynamicDefaultThenDynamicIcon = lint(baseFrame('1, { width = 2, height = 20, scaling = false }', [
    'table:setDefaultComplexCellProperties("editbox", "hotkey", { hotkey = getHotkey(), displayIcon = true })',
    'local row = table:addRow(nil, { borderBelow = false, scaling = false })',
    'local editbox = row[1]:createEditBox({ height = 0 })',
    'editbox:setHotkey("", { hotkey = "", displayIcon = getDisplayIcon() })',
  ].join('\n')));
  const editBoxDefaultIconFalse = lint(baseFrame('1, { width = 2, height = 20, scaling = false }', [
    'table:setDefaultComplexCellProperties("editbox", "hotkey", { hotkey = "DEFAULT", displayIcon = false })',
    'local row = table:addRow(nil, { borderBelow = false, scaling = false })',
    'row[1]:createEditBox({ height = 0 })',
  ].join('\n')));
  const editBoxDefaultEmptyHotkey = lint(baseFrame('1, { width = 2, height = 20, scaling = false }', [
    'table:setDefaultComplexCellProperties("editbox", "hotkey", { hotkey = "", displayIcon = true })',
    'local row = table:addRow(nil, { borderBelow = false, scaling = false })',
    'row[1]:createEditBox({ height = 0 })',
  ].join('\n')));
  const editBoxDefaultAfterCreate = lint(baseFrame('1, { width = 2, height = 20, scaling = false }', [
    'local row = table:addRow(nil, { borderBelow = false, scaling = false })',
    'row[1]:createEditBox({})',
    'table:setDefaultCellProperties("editbox", { height = 12, scaling = false })',
  ].join('\n')));
  const editBoxOtherTable = lint([
    'local menu = { name = "Main", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 100 })',
    'local firstTable = frame:addTable(1, { width = 2, height = 20, scaling = false })',
    'firstTable:setDefaultCellProperties("editbox", { height = 20, scaling = false })',
    'local secondTable = frame:addTable(1, { width = 2, height = 20, scaling = false })',
    'local row = secondTable:addRow(nil, { borderBelow = false, scaling = false })',
    'row[1]:createEditBox({})',
    'frame:display()',
  ].join('\n'));
  const editBoxOtherWidget = lint(baseFrame('2, { width = 2, height = 20, scaling = false }', [
    'table:setDefaultCellProperties("button", { height = 20, scaling = false })',
    'local row = table:addRow(nil, { borderBelow = false, scaling = false })',
    'row[1]:createButton({})',
    'row[2]:createEditBox({})',
  ].join('\n')));
  const editBoxWrongReceiver = lint(baseFrame('1, { width = 2, height = 20, scaling = false }', [
    'frame:setDefaultCellProperties("editbox", { height = 20, scaling = false })',
    'local row = table:addRow(nil, { borderBelow = false, scaling = false })',
    'row[1]:createEditBox({})',
  ].join('\n')));
  const editBoxDynamicDefault = lint(baseFrame('1, { width = 2, height = 20, scaling = false }', [
    'local dynamicHeight = getHeight()',
    'table:setDefaultCellProperties("editbox", { height = dynamicHeight })',
    'local row = table:addRow(nil, { borderBelow = false, scaling = false })',
    'row[1]:createEditBox({})',
  ].join('\n')));
  const editBoxConditionalDefault = lint(baseFrame('1, { width = 2, height = 20, scaling = false }', [
    'local row = table:addRow(nil, { borderBelow = false, scaling = false })',
    'if mode then',
    '  table:setDefaultCellProperties("editbox", { height = 20, scaling = false })',
    'end',
    'row[1]:createEditBox({})',
  ].join('\n')));
  const editBoxOtherCellHotkey = lint(baseFrame('2, { width = 2, height = 20, scaling = false }', [
    'local row = table:addRow(nil, { borderBelow = false, scaling = false })',
    'local button = row[1]:createButton({})',
    'button:setHotkey("BUTTON", { displayIcon = true })',
    'row[2]:createEditBox({})',
  ].join('\n')));
  const editBoxIrrelevantDynamic = lint(baseFrame('2, { width = 2, height = 40, scaling = false }', [
    'table:setDefaultCellProperties("button", { height = getHeight(), scaling = getScaling() })',
    'table:setDefaultComplexCellProperties("editbox", "caption", { hotkey = getHotkey(), displayIcon = getDisplayIcon() })',
    'local row = table:addRow(nil, { borderBelow = false, scaling = false })',
    'local button = row[1]:createButton({ height = 25, scaling = false })',
    'button:setHotkey(getHotkey(), { displayIcon = getDisplayIcon() })',
    'row[2]:createEditBox({ height = 12, scaling = false })',
  ].join('\n')));
  const editBoxDynamicHotkey = lint(baseFrame('1, { width = 2, height = 20, scaling = false }', [
    'local row = table:addRow(nil, { borderBelow = false, scaling = false })',
    'local editbox = row[1]:createEditBox({ height = 0 })',
    'editbox:setHotkey(getHotkey(), { displayIcon = true })',
  ].join('\n')));
  const editBoxConditionalHotkey = lint(baseFrame('1, { width = 2, height = 20, scaling = false }', [
    'local row = table:addRow(nil, { borderBelow = false, scaling = false })',
    'local editbox = row[1]:createEditBox({ height = 0 })',
    'if mode then editbox:setHotkey("CONDITIONAL", { displayIcon = true }) end',
  ].join('\n')));
  const editBoxConditionalFluentChain = lint(baseFrame('1, { width = 2, height = 20, scaling = false }', [
    'local row = table:addRow(nil, { borderBelow = false, scaling = false })',
    'if mode then',
    '  row[1]:setColSpan(1):createEditBox({ height = 0 }):setText("EDIT", {}):setHotkey("CHAIN", { displayIcon = true })',
    'end',
  ].join('\n')));
  const editBoxSiblingArmHotkey = lint(baseFrame('1, { width = 2, height = 20, scaling = false }', [
    'local row = table:addRow(nil, { borderBelow = false, scaling = false })',
    'if mode then',
    '  row[1]:createEditBox({ height = 0 })',
    'else',
    '  row[1]:setHotkey("SIBLING", { displayIcon = true })',
    'end',
  ].join('\n')));
  const conditionalButtonIconChain = lint(baseFrame('2, { width = 2, height = 20, scaling = false }', [
    'local row = table:addRow(nil, { borderBelow = false, scaling = false })',
    'row[2]:createEditBox({})',
    'if mode then',
    '  row[1]:createButton({ height = 25 }):setIcon("ICON"):setHotkey("BUTTON", { displayIcon = true })',
    'end',
  ].join('\n')));
  const invalidEditBoxIconChains = (['setIcon', 'setIcon2'] as const).map(method => ({
    method,
    result: lint(baseFrame('1, { width = 2, height = 20, scaling = false }', [
      'local row = table:addRow(nil, { borderBelow = false, scaling = false })',
      `row[1]:createEditBox({ height = 0 }):${method}("ICON", {}):setHotkey("HOT", { displayIcon = true })`,
    ].join('\n'))),
  }));
  const editBoxSourceProvenUnknownChain = lint([
    'local table = getTable()',
    'local row = table:addRow()',
    'row[1]:setColSpan(1):createEditBox({ height = 0 }):setText("EDIT", {}):setHotkey("CHAIN", { displayIcon = true })',
  ].join('\n'));
  const editBoxSourceProvenUnknownOmitted = lint([
    'local table = getTable()',
    'local row = table:addRow()',
    'row[1]:createEditBox({}):setHotkey("CHAIN", { displayIcon = true })',
  ].join('\n'));
  const editBoxDistinctSameSpelling = lint(baseFrame('1, { width = 2, height = 20, scaling = false }', [
    'do',
    '  local row = table:addRow(nil, { borderBelow = false, scaling = false })',
    '  row[1]:createEditBox({ height = 0 })',
    'end',
    'do',
    '  local row = table:addRow(nil, { borderBelow = false, scaling = false })',
    '  row[1]:setHotkey("OTHER", { displayIcon = true })',
    'end',
  ].join('\n')));
  const editBoxButtonUnknownChain = lint([
    'local table = getTable()',
    'local row = table:addRow()',
    'row[1]:createEditBox({})',
    'row[1]:createButton({ height = 25 }):setText("BUTTON", {}):setHotkey(getHotkey(), { displayIcon = getDisplayIcon() })',
  ].join('\n'));
  const editBoxUnknownReceiver = lint(baseFrame('1, { width = 2, height = 20, scaling = false }', [
    'local row = table:addRow(nil, { borderBelow = false, scaling = false })',
    'row[1]:createEditBox({ height = 0 })',
    'local unknownCell = getCell()',
    'unknownCell:setHotkey("UNKNOWN", { displayIcon = true })',
  ].join('\n')));
  const editBoxDotMethod = lint(baseFrame('1, { width = 2, height = 20, scaling = false }', [
    'local row = table:addRow(nil, { borderBelow = false, scaling = false })',
    'row[1].createEditBox({ height = 0 }).setHotkey("DOT", { displayIcon = true })',
  ].join('\n')));
  const editBoxPositiveHeightDynamicHotkey = lint(baseFrame('1, { width = 2, height = 20, scaling = false }', [
    'local row = table:addRow(nil, { borderBelow = false, scaling = false })',
    'local editbox = row[1]:createEditBox({ height = 12 })',
    'editbox:setHotkey(getHotkey(), { displayIcon = true })',
  ].join('\n')));
  const genericDescriptorOptions = lint([
    'local descriptor = {}',
    'descriptor.hotkey = getHotkey()',
    'descriptor.displayIcon = getDisplayIcon()',
  ].join('\n'));
  const editBoxDefaultTrueOverridesFalse = lint(baseFrame('1, { width = 2, height = 10, scaling = false }', [
    'table:setDefaultCellProperties("editbox", { height = 12, scaling = true })',
    'local row = table:addRow(nil, { borderBelow = false, scaling = false })',
    'row[1]:createEditBox({})',
  ].join('\n')));
  const editBoxDefaultFalseExact = lint(baseFrame('1, { width = 2, height = 10, scaling = false }', [
    'table:setDefaultCellProperties("editbox", { height = 12, scaling = false })',
    'local row = table:addRow(nil, { borderBelow = false, scaling = false })',
    'row[1]:createEditBox({})',
  ].join('\n')));
  const editBoxExplicitFalseExact = lint(baseFrame('1, { width = 2, height = 10, scaling = false }', [
    'table:setDefaultCellProperties("editbox", { height = 12, scaling = true })',
    'local row = table:addRow(nil, { borderBelow = false, scaling = false })',
    'row[1]:createEditBox({ height = 12, scaling = false })',
  ].join('\n')));
  check('simple and complex same-table defaults make omitted editboxes clean',
    !hasCode(editBoxSimpleDefault, 'x4-ui.editbox-height-minimum')
      && !hasCode(editBoxComplexDefault, 'x4-ui.editbox-height-minimum')
      && !editBoxSimpleDefault.hasVerificationGaps
      && !editBoxComplexDefault.hasVerificationGaps,
    JSON.stringify({ simple: detail(editBoxSimpleDefault), complex: detail(editBoxComplexDefault) }));
  check('displayed hotkeys make omitted and zero-height editboxes clean',
    !hasCode(editBoxZeroDisplayedDefault, 'x4-ui.editbox-height-minimum')
      && !hasCode(editBoxDirectDisplayed, 'x4-ui.editbox-height-minimum')
      && !hasCode(editBoxDirectZeroDisplayed, 'x4-ui.editbox-height-minimum'),
    JSON.stringify({ defaultZero: detail(editBoxZeroDisplayedDefault), direct: detail(editBoxDirectDisplayed), directZero: detail(editBoxDirectZeroDisplayed) }));
  check('empty or icon-hidden hotkeys do not prove the minimum',
    hasCode(editBoxDirectEmpty, 'x4-ui.editbox-height-minimum', 'error')
      && hasCode(editBoxDefaultIconFalse, 'x4-ui.editbox-height-minimum', 'error')
      && hasCode(editBoxDefaultEmptyHotkey, 'x4-ui.editbox-height-minimum', 'error'),
    JSON.stringify({ directEmpty: detail(editBoxDirectEmpty), iconFalse: detail(editBoxDefaultIconFalse), emptyDefault: detail(editBoxDefaultEmptyHotkey) }));
  check('later source-proven static hotkey and icon overrides clear earlier complex-default uncertainty',
    hasCode(editBoxDynamicDefaultThenStaticEmptyOverride, 'x4-ui.editbox-height-minimum', 'error')
      && !hasCode(editBoxDynamicDefaultThenStaticEmptyOverride, 'x4-ui.editbox-height-minimum', 'warning')
      && !hasCode(editBoxDynamicDefaultThenStaticVisibleOverride, 'x4-ui.editbox-height-minimum')
      && !editBoxDynamicDefaultThenStaticEmptyOverride.verificationGaps.some(gap => gap.category === 'property'),
    JSON.stringify({
      emptyOverride: detail(editBoxDynamicDefaultThenStaticEmptyOverride),
      visibleOverride: detail(editBoxDynamicDefaultThenStaticVisibleOverride),
    }));
  check('omitted or dynamic direct displayIcon keeps the editbox height uncertainty',
    editBoxDynamicDefaultThenOmittedIcon.verificationGaps.some(gap => gap.category === 'edit-box')
      && hasCode(editBoxDynamicDefaultThenOmittedIcon, 'x4-ui.editbox-height-minimum', 'warning')
      && !hasCode(editBoxDynamicDefaultThenOmittedIcon, 'x4-ui.editbox-height-minimum', 'error')
      && editBoxDynamicDefaultThenDynamicIcon.verificationGaps.some(gap => gap.category === 'edit-box')
      && hasCode(editBoxDynamicDefaultThenDynamicIcon, 'x4-ui.editbox-height-minimum', 'warning')
      && !hasCode(editBoxDynamicDefaultThenDynamicIcon, 'x4-ui.editbox-height-minimum', 'error'),
    JSON.stringify({ omitted: detail(editBoxDynamicDefaultThenOmittedIcon), dynamic: detail(editBoxDynamicDefaultThenDynamicIcon) }));
  check('defaults after creation do not mutate the already-created editbox',
    hasCode(editBoxDefaultAfterCreate, 'x4-ui.editbox-height-minimum', 'warning')
      && !hasCode(editBoxDefaultAfterCreate, 'x4-ui.editbox-height-minimum', 'error'),
    detail(editBoxDefaultAfterCreate));
  check('other table, widget, and cell hotkey data cannot clean the editbox rule',
    hasCode(editBoxOtherTable, 'x4-ui.editbox-height-minimum', 'warning')
      && hasCode(editBoxOtherWidget, 'x4-ui.editbox-height-minimum', 'warning')
      && hasCode(editBoxOtherCellHotkey, 'x4-ui.editbox-height-minimum', 'warning')
      && !editBoxOtherWidget.hasVerificationGaps
      && !editBoxOtherCellHotkey.hasVerificationGaps,
    JSON.stringify({ table: detail(editBoxOtherTable), widget: detail(editBoxOtherWidget), cell: detail(editBoxOtherCellHotkey) }));
  check('dynamic button defaults/hotkeys and literal wrong complex properties add no lint gaps or findings',
    !editBoxIrrelevantDynamic.hasVerificationGaps
      && editBoxIrrelevantDynamic.findings.length === 0,
    detail(editBoxIrrelevantDynamic));
  check('wrong receiver and dynamic or conditional defaults remain gaps with warnings',
    editBoxWrongReceiver.hasVerificationGaps
      && hasCode(editBoxWrongReceiver, 'x4-ui.editbox-height-minimum', 'warning')
      && editBoxDynamicDefault.hasVerificationGaps
      && hasCode(editBoxDynamicDefault, 'x4-ui.editbox-height-minimum', 'warning')
      && !hasCode(editBoxDynamicDefault, 'x4-ui.editbox-height-minimum', 'error')
      && editBoxConditionalDefault.hasVerificationGaps
      && hasCode(editBoxConditionalDefault, 'x4-ui.editbox-height-minimum', 'warning')
      && !hasCode(editBoxConditionalDefault, 'x4-ui.editbox-height-minimum', 'error'),
    JSON.stringify({
      wrongReceiver: detail(editBoxWrongReceiver),
      dynamic: {
        summary: detail(editBoxDynamicDefault),
        findings: editBoxDynamicDefault.findings.map(finding => ({ code: finding.code, severity: finding.severity, cause: finding.cause })),
        gaps: editBoxDynamicDefault.verificationGaps.map(gap => ({ category: gap.category, status: gap.status, expression: gap.expression, reason: gap.reason })),
      },
      conditional: detail(editBoxConditionalDefault),
    }));
  check('dynamic or conditional direct hotkeys remain nonblocking gaps',
    editBoxDynamicHotkey.hasVerificationGaps
      && hasCode(editBoxDynamicHotkey, 'x4-ui.editbox-height-minimum', 'warning')
      && !hasCode(editBoxDynamicHotkey, 'x4-ui.editbox-height-minimum', 'error')
      && editBoxConditionalHotkey.hasVerificationGaps
      && hasCode(editBoxConditionalHotkey, 'x4-ui.editbox-height-minimum', 'warning')
      && !hasCode(editBoxConditionalHotkey, 'x4-ui.editbox-height-minimum', 'error'),
    JSON.stringify({ dynamic: detail(editBoxDynamicHotkey), conditional: detail(editBoxConditionalHotkey) }));
  check('same-statement conditional fluent editbox chain proves displayed hotkey without height finding',
    !editBoxConditionalFluentChain.verificationGaps.some(gap => gap.category === 'edit-box')
      && !hasCode(editBoxConditionalFluentChain, 'x4-ui.editbox-height-minimum'),
    detail(editBoxConditionalFluentChain));
  check('incompatible sibling conditional arms remain conservative for editbox hotkeys',
    editBoxSiblingArmHotkey.verificationGaps.some(gap => gap.category === 'edit-box')
      && hasCode(editBoxSiblingArmHotkey, 'x4-ui.editbox-height-minimum', 'warning'),
    detail(editBoxSiblingArmHotkey));
  check('conditional fluent button setIcon chain leaves exactly one omitted-editbox warning',
    conditionalButtonIconChain.findings.filter(finding => finding.code === 'x4-ui.editbox-height-minimum').length === 1
      && conditionalButtonIconChain.findings.some(finding => finding.code === 'x4-ui.editbox-height-minimum' && finding.severity === 'warning')
      && !conditionalButtonIconChain.verificationGaps.some(gap => gap.category === 'edit-box'),
    detail(conditionalButtonIconChain));
  check('button-only setIcon and setIcon2 cannot falsely clean literal-zero editboxes',
    invalidEditBoxIconChains.every(candidate => candidate.result.verificationGaps.some(gap => gap.category === 'data-flow'
      && gap.reason.includes('edit-box used for setHotkey'))
      && candidate.result.verificationGaps.some(gap => gap.category === 'edit-box')
      && candidate.result.findings.filter(finding => finding.code === 'x4-ui.editbox-height-minimum').length === 1
      && hasCode(candidate.result, 'x4-ui.editbox-height-minimum', 'warning')
      && !hasCode(candidate.result, 'x4-ui.editbox-height-minimum', 'error')),
    JSON.stringify(invalidEditBoxIconChains.map(candidate => ({
      method: candidate.method,
      result: detail(candidate.result),
    }))));
  check('same-statement source-proven non-static cell chain proves displayed hotkey without an editbox gap',
    editBoxSourceProvenUnknownChain.hasVerificationGaps
      && !editBoxSourceProvenUnknownChain.verificationGaps.some(gap => gap.category === 'edit-box')
      && !hasCode(editBoxSourceProvenUnknownChain, 'x4-ui.editbox-height-minimum'),
    detail(editBoxSourceProvenUnknownChain));
  check('same-statement source-proven omitted editbox with static displayed hotkey is clean',
    editBoxSourceProvenUnknownOmitted.hasVerificationGaps
      && !editBoxSourceProvenUnknownOmitted.verificationGaps.some(gap => gap.category === 'edit-box')
      && !hasCode(editBoxSourceProvenUnknownOmitted, 'x4-ui.editbox-height-minimum'),
    detail(editBoxSourceProvenUnknownOmitted));
  check('distinct source cells both spelled row[1] cannot cross-clean',
    hasCode(editBoxDistinctSameSpelling, 'x4-ui.editbox-height-minimum', 'error')
      && !editBoxDistinctSameSpelling.verificationGaps.some(gap => gap.category === 'edit-box'),
    detail(editBoxDistinctSameSpelling));
  check('unresolved button chain does not create an editbox hotkey gap or contaminate omitted editbox',
    editBoxButtonUnknownChain.verificationGaps.every(gap => gap.category !== 'edit-box')
      && editBoxButtonUnknownChain.findings.filter(finding => finding.code === 'x4-ui.editbox-height-minimum').length === 1
      && hasCode(editBoxButtonUnknownChain, 'x4-ui.editbox-height-minimum', 'warning'),
    detail(editBoxButtonUnknownChain));
  check('unknown receiver and dot-method hotkeys remain conservative',
    editBoxUnknownReceiver.verificationGaps.some(gap => gap.category === 'edit-box')
      && hasCode(editBoxUnknownReceiver, 'x4-ui.editbox-height-minimum', 'warning')
      && editBoxDotMethod.verificationGaps.some(gap => gap.category === 'edit-box')
      && hasCode(editBoxDotMethod, 'x4-ui.editbox-height-minimum', 'warning'),
    JSON.stringify({ unknownReceiver: detail(editBoxUnknownReceiver), dotMethod: detail(editBoxDotMethod) }));
  check('explicit positive height suppresses unrelated hotkey uncertainty for the height rule',
    !hasCode(editBoxPositiveHeightDynamicHotkey, 'x4-ui.editbox-height-minimum')
      && !editBoxPositiveHeightDynamicHotkey.findings.some(finding => finding.code === 'x4-ui.editbox-height-minimum'),
    detail(editBoxPositiveHeightDynamicHotkey));
  check('generic descriptor hotkey/displayIcon options do not create B119 property gaps',
    !genericDescriptorOptions.hasVerificationGaps
      && !hasCode(genericDescriptorOptions, 'x4-ui.verification-gap'),
    detail(genericDescriptorOptions));
  check('editbox scaling follows table then row then editbox default then call-specific last writer',
    editBoxDefaultTrueOverridesFalse.verificationGaps.some(gap => gap.category === 'scale')
      && !hasCode(editBoxDefaultTrueOverridesFalse, 'x4-ui.row-height-budget', 'warning')
      && !editBoxDefaultFalseExact.verificationGaps.some(gap => gap.category === 'scale')
      && !editBoxExplicitFalseExact.verificationGaps.some(gap => gap.category === 'scale')
      && !hasCode(editBoxDefaultFalseExact, 'x4-ui.editbox-height-minimum')
      && !hasCode(editBoxExplicitFalseExact, 'x4-ui.editbox-height-minimum'),
    JSON.stringify({
      defaultTrue: detail(editBoxDefaultTrueOverridesFalse),
      defaultFalse: detail(editBoxDefaultFalseExact),
      explicitFalse: detail(editBoxExplicitFalseExact),
    }));

  const inlineDisplay = lint([
    'local menu = { name = "Main", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 100 })',
    'local handlers = {}',
    'handlers.onClick = function()',
    '  frame:display()',
    'end'
  ].join('\n'));
  const deferredDisplay = lint(CLEAN_MENU);
  const unreachableDisplay = lint([
    'local menu = { name = "Main", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 100 })',
    'local handlers = {}',
    'if false then',
    '  handlers.onClick = function()',
    '    frame:display()',
    '  end',
    'end'
  ].join('\n'));
  check('direct onClick display warns without error', hasCode(inlineDisplay, 'x4-ui.inline-display', 'warning') && !hasCode(inlineDisplay, 'x4-ui.inline-display', 'error'), detail(inlineDisplay));
  check('top-level/deferred display is clean', !hasCode(deferredDisplay, 'x4-ui.inline-display'), detail(deferredDisplay));
  check('inline display failure mode records one-click-late behavior', hasFailureMode(inlineDisplay, 'x4-ui.inline-display', 'one click late'), detail(inlineDisplay));
  check('unreachable onClick display is ignored', !hasCode(unreachableDisplay, 'x4-ui.inline-display', 'error'), detail(unreachableDisplay));

  const sameLayer = lint([
    'local menu = { name = "Main", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 100 })',
    'menu.onClick = function()',
    '  OpenMenu(menu)',
    'end'
  ].join('\n'));
  const unreachableSameLayer = lint([
    'local menu = { name = "Main", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 100 })',
    'if false then',
    '  menu.onClick = function()',
    '    OpenMenu(menu)',
    '  end',
    'end'
  ].join('\n'));
  const differentLayer = lint([
    'local menu = { name = "Main", layer = 1 }',
    'local target = { name = "Other", layer = 2 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 100 })',
    'menu.onClick = function()',
    '  OpenMenu(target)',
    'end'
  ].join('\n'));
  const unresolvedLayer = lint([
    'local menu = { name = "Main", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 100 })',
    'menu.onClick = function()',
    '  OpenMenu("Other")',
    'end'
  ].join('\n'));
  const dynamicCurrentLayer = lint([
    'local currentLayer = getLayer()',
    'local menu = { name = "Main", layer = currentLayer }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 100 })',
    'menu.onClick = function()',
    '  OpenMenu(menu)',
    'end'
  ].join('\n'));
  const cellSameLayer = lint([
    'local menu = { name = "Main", layer = 1 }',
    'local target = { name = "Other", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 100 })',
    'local t = frame:addTable(2, { width = 2, height = 20 })',
    'local r = t:addRow(nil, { height = 10 })',
    'r[1].handlers.onClick = function()',
    '  OpenMenu(target.name)',
    'end'
  ].join('\n'));
  const cellDifferentLayer = lint([
    'local menu = { name = "Main", layer = 1 }',
    'local target = { name = "Other", layer = 2 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 100 })',
    'local t = frame:addTable(2, { width = 2, height = 20 })',
    'local r = t:addRow(nil, { height = 10 })',
    'r[1].handlers.onClick = function()',
    '  OpenMenu(target.name)',
    'end'
  ].join('\n'));
  const ambiguousTarget = lint([
    'local menu = { name = "Main", layer = 1 }',
    'local targetA = { name = "Other", layer = 1 }',
    'local targetB = { name = "Other", layer = 2 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 100 })',
    'local handlers = {}',
    'handlers.onClick = function()',
    '  OpenMenu("Other")',
    'end'
  ].join('\n'));
  const ambiguousCurrent = lint([
    'local menu = { name = "Main", layer = 1 }',
    'local target = { name = "Other", layer = 1 }',
    'local secondMenu = { name = "Second", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 100 })',
    'local secondFrame = Helper.createFrameHandle(secondMenu, { width = 100, height = 100 })',
    'local handlers = {}',
    'handlers.onClick = function()',
    '  OpenMenu(target.name)',
    'end'
  ].join('\n'));
  const dynamicTargetMutation = lint([
    'local menu = { name = "Main", layer = 1 }',
    'local target = { name = "Other", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 100 })',
    'target.layer = getLayer()',
    'local handlers = {}',
    'handlers.onClick = function()',
    '  OpenMenu(target.name)',
    'end'
  ].join('\n'));
  const dynamicCurrentMutation = lint([
    'local menu = { name = "Main", layer = 1 }',
    'local target = { name = "Other", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 100 })',
    'menu.layer = getLayer()',
    'local handlers = {}',
    'handlers.onClick = function()',
    '  OpenMenu(target.name)',
    'end'
  ].join('\n'));
  check('proven same-layer inline OpenMenu errors', hasCode(sameLayer, 'x4-ui.same-layer-inline-open', 'error'), detail(sameLayer));
  check('unreachable same-layer OpenMenu is ignored', !hasCode(unreachableSameLayer, 'x4-ui.same-layer-inline-open', 'error'), detail(unreachableSameLayer));
  check('different literal layer is clean', !hasCode(differentLayer, 'x4-ui.same-layer-inline-open', 'error') && !hasCode(differentLayer, 'x4-ui.same-layer-inline-open', 'warning'), detail(differentLayer));
  check('unresolved menu/layer is a gap', unresolvedLayer.hasVerificationGaps && !hasCode(unresolvedLayer, 'x4-ui.same-layer-inline-open', 'error'), detail(unresolvedLayer));
  check('dynamic current layer cannot produce a same-layer fatal', dynamicCurrentLayer.hasVerificationGaps && !hasCode(dynamicCurrentLayer, 'x4-ui.same-layer-inline-open', 'error'), detail(dynamicCurrentLayer));
  check('row/cell target.name same-layer OpenMenu errors', hasCode(cellSameLayer, 'x4-ui.same-layer-inline-open', 'error'), detail(cellSameLayer));
  check('row/cell target.name different layer is clean of same-layer fatal', !hasCode(cellDifferentLayer, 'x4-ui.same-layer-inline-open', 'error'), detail(cellDifferentLayer));
  check('ambiguous target name is a gap without fatal', ambiguousTarget.hasVerificationGaps && !hasCode(ambiguousTarget, 'x4-ui.same-layer-inline-open', 'error'), detail(ambiguousTarget));
  check('ambiguous current frame candidate is a gap without fatal', ambiguousCurrent.hasVerificationGaps && !hasCode(ambiguousCurrent, 'x4-ui.same-layer-inline-open', 'error'), detail(ambiguousCurrent));
  check('later dynamic target mutation cannot produce a fatal', dynamicTargetMutation.hasVerificationGaps && !hasCode(dynamicTargetMutation, 'x4-ui.same-layer-inline-open', 'error'), detail(dynamicTargetMutation));
  check('later dynamic current mutation cannot produce a fatal', dynamicCurrentMutation.hasVerificationGaps && !hasCode(dynamicCurrentMutation, 'x4-ui.same-layer-inline-open', 'error'), detail(dynamicCurrentMutation));
  check('same-layer failure mode records paint-over outcome', hasFailureMode(cellSameLayer, 'x4-ui.same-layer-inline-open', 'paint over the second'), detail(cellSameLayer));

  const parseFailure = lint('function broken(');
  const truncatedModel: X4UiCallModel = {
    ...buildX4UiCallModel(input(CLEAN_TABLE, 'selftest/truncated.lua')),
    verificationGapsTruncated: true
  };
  const truncated = lintX4UiCallModel(truncatedModel);
  check('parse failure is not statically verified', !parseFailure.isStaticallyVerified && parseFailure.hasVerificationGaps && parseFailure.status === 'not-statically-verified', detail(parseFailure));
  check('verification gap truncation is not statically verified', !truncated.isStaticallyVerified && truncated.hasTruncatedEvidence && truncated.hasVerificationGaps, detail(truncated));

  const clean = lint(CLEAN_TABLE);
  const repeatedA = lintX4UiCallModel(buildX4UiCallModel(input(CLEAN_TABLE, 'selftest/deterministic.lua')));
  const repeatedModel = buildX4UiCallModel(input(CLEAN_TABLE, 'selftest/deterministic.lua'));
  const repeatedB = lintX4UiCallModel(repeatedModel);
  check('clean aggregate has zero errors and warnings', !clean.hasErrors && !clean.hasWarnings, detail(clean));
  check('every finding is source-located', clean.findings.every(finding => Boolean(finding.location?.file) && finding.location.start.line >= 1 && finding.location.start.column >= 0), detail(clean));
  check('repeated evaluation is byte-for-byte deterministic', JSON.stringify(repeatedA) === JSON.stringify(repeatedB), `${JSON.stringify(repeatedA)} !== ${JSON.stringify(repeatedB)}`);
  check('normal helper/table/menu shapes have no false fatal findings', !lint(CLEAN_MENU).hasErrors && !lint(CLEAN_MENU).hasWarnings, detail(lint(CLEAN_MENU)));

  const passed = checks.filter(item => item.pass).length;
  const allPassed = passed === checks.length;
  return { allPassed, pass: allPassed, passed, total: checks.length, checks };
}

const invokedDirectly = (process.argv[1] || '').toLowerCase().endsWith('x4uilint.selftest.ts');
if (invokedDirectly) {
  const result = runX4UiLintSelftest();
  console.log(JSON.stringify(result, null, 2));
  if (!result.allPassed) process.exitCode = 1;
}
