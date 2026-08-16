import {
  buildX4UiCallModel,
  type X4UiCallRecord,
  type X4UiCallPropertyProjection,
  type X4UiValue
} from './x4UiCallModel';

interface Check {
  name: string;
  pass: boolean;
  detail?: string;
}

const checks: Check[] = [];

function check(name: string, pass: boolean, detail?: string): void {
  checks.push({ name, pass, detail: pass ? undefined : detail });
}

function input(text: string, rel = 'selftest/b119-call-projection.lua') {
  return { rel, text, sourcePath: `fixture://${rel}` };
}

function call(model: ReturnType<typeof buildX4UiCallModel>, name: X4UiCallRecord['name']): X4UiCallRecord | undefined {
  return model.calls.find(candidate => candidate.name === name);
}

function property(callRecord: X4UiCallRecord | undefined, name: string): X4UiCallPropertyProjection | undefined {
  return callRecord?.semantics.properties?.find(candidate => candidate.name === name);
}

function propertyNames(callRecord: X4UiCallRecord | undefined): string[] {
  return callRecord?.semantics.properties?.map(candidate => candidate.name) || [];
}

function staticString(value: X4UiValue | undefined): string | undefined {
  return value?.status === 'static' && value.type === 'string' ? String(value.value) : undefined;
}

function detail(value: unknown): string {
  return JSON.stringify(value);
}

function run(): { allPassed: boolean; pass: boolean; passed: number; total: number; checks: Check[] } {
  const source = [
    'local menu = { name = "B119", layer = 2 }',
    'local frame = Helper.createFrameHandle(menu, { x = 1, y = 2, width = 100, height = 200, layer = 2, standardButtons = {}, backgroundID = "frame", backgroundColor = "red", blurBackground = true, autoFrameHeight = false })',
    'local table = frame:addTable(4, { x = 3, y = 4, width = 100, tabOrder = 7, backgroundID = "table", backgroundColor = "blue", highlightMode = "off", maxVisibleHeight = 180, reserveScrollBar = true, scaling = false })',
    'table:setColWidth(1, 50, false)',
    'local row = table:addRow(true, { height = 20, paddingTop = 1, paddingBottom = 2, borderBelow = true, fixed = false, scaling = true, interactive = false })',
    'row[1]:setColSpan(2):createButton({ active = true, bgColor = "black", highlightColor = "white", borderColor = "gray", width = 80, height = 21, x = 5, y = 6, scaling = false, affectRowHeight = false }):setText("GO", { color = "white", fontsize = 12, halign = "center", wordwrap = false, font = "Zekton", cellBGColor = "cell", x = 1, y = 2, width = 99, height = 19, scaling = true }):setText2("SECOND", { color = "yellow", fontsize = 10, halign = "right", font = "Zekton", x = 4, y = 5, scaling = true })',
    'row[2]:createText("TEXT", { color = "white", fontsize = 11, halign = "left", wordwrap = true, font = "Zekton", cellBGColor = "cell", x = 2, y = 3, width = 90, height = 18, scaling = false, minRowHeight = 17 })',
    'row[3]:createIcon("solid", { width = 24, height = 24, color = "green", affectRowHeight = true, x = 7, y = 8, scaling = false })',
    'row[4]:createEditBox({ x = 9, y = 10, width = 70, height = 22, defaultText = "input", description = "describe", maxChars = 32, selectTextOnActivation = true, active = false, bgColor = "edit", scaling = true })',
    'local sx = Helper.scaleX(12, false)',
    'local sy = Helper.scaleY(13, true)',
    'local sf = Helper.scaleFont("Zekton", 14, false)',
    'frame:display()'
  ].join('\n');
  const model = buildX4UiCallModel(input(source));

  const expectedCalls = [
    'createFrameHandle', 'addTable', 'setColWidth', 'addRow', 'setColSpan', 'createButton',
    'setText', 'setText2', 'createText', 'createIcon', 'createEditBox', 'scaleX', 'scaleY',
    'scaleFont', 'display'
  ];
  check('v1 calls are all present in source order',
    JSON.stringify(model.calls.map(candidate => candidate.name)) === JSON.stringify(expectedCalls),
    detail(model.calls.map(candidate => candidate.name)));
  check('every v1 call is source-located and ordered',
    model.calls.every(candidate => candidate.source.file === 'selftest/b119-call-projection.lua'
      && source.slice(candidate.source.start.offset, candidate.source.end.offset).includes(candidate.callee)
      && candidate.source.start.offset >= 0
      && candidate.source.end.offset <= source.length
      && candidate.order === model.records.indexOf(candidate)),
    detail(model.calls.map(candidate => ({ name: candidate.name, source: candidate.source }))));
  check('ordered records retain source order',
    model.records.every((record, index) => record.order === index)
      && model.records.every((record, index) => index === 0 || record.sourceOrder >= model.records[index - 1].sourceOrder),
    detail(model.records.map(record => ({ type: record.recordType, order: record.order, sourceOrder: record.sourceOrder }))));

  const frame = call(model, 'createFrameHandle');
  const table = call(model, 'addTable');
  const row = call(model, 'addRow');
  const setWidth = call(model, 'setColWidth');
  const setSpan = call(model, 'setColSpan');
  const button = call(model, 'createButton');
  const setText = model.calls.find(candidate => candidate.name === 'setText');
  const setText2 = model.calls.find(candidate => candidate.name === 'setText2');
  const text = call(model, 'createText');
  const editBox = call(model, 'createEditBox');
  const icon = call(model, 'createIcon');

  check('frame property family is exact and complete',
    JSON.stringify(propertyNames(frame)) === JSON.stringify([
      'x', 'y', 'width', 'height', 'layer', 'standardButtons', 'backgroundID', 'backgroundColor', 'blurBackground',
      'autoFrameHeight'
    ]), detail(propertyNames(frame)));
  check('table property family is exact and complete',
    JSON.stringify(propertyNames(table)) === JSON.stringify([
      'x', 'y', 'width', 'tabOrder', 'backgroundID', 'backgroundColor', 'highlightMode', 'maxVisibleHeight',
      'reserveScrollBar', 'scaling'
    ]), detail(propertyNames(table)));
  check('rowdata and row interactive property are distinct exact evidence',
    JSON.stringify(propertyNames(row)) === JSON.stringify(['height', 'paddingTop', 'paddingBottom', 'borderBelow', 'fixed', 'scaling', 'interactive'])
      && row?.semantics.rowData?.value === true
      && !('interactive' in row.semantics)
      && property(row, 'interactive')?.value.value === false
      && !model.verificationGaps.some(gap => gap.reason.includes('interactive flag')),
    detail(row?.semantics));
  check('text property family is exact and complete',
    JSON.stringify(propertyNames(text)) === JSON.stringify([
      'color', 'fontsize', 'halign', 'wordwrap', 'font', 'cellBGColor', 'x', 'y', 'width', 'height', 'scaling',
      'minRowHeight'
    ]), detail(propertyNames(text)));
  check('nested text property family excludes unsupported text-cell fields while preserving raw source',
    JSON.stringify(propertyNames(setText)) === JSON.stringify(['color', 'fontsize', 'halign', 'font', 'x', 'y', 'scaling'])
      && JSON.stringify(propertyNames(setText2)) === JSON.stringify(['color', 'fontsize', 'halign', 'font', 'x', 'y', 'scaling'])
      && JSON.stringify(setText?.semantics.unsupportedProperties?.map(candidate => candidate.name))
        === JSON.stringify(['wordwrap', 'cellBGColor', 'width', 'height'])
      && setText?.semantics.options?.expression.includes('wordwrap = false')
      && setText.semantics.unsupportedProperties?.every(candidate =>
        source.slice(candidate.source.start.offset, candidate.source.end.offset) === candidate.value.expression)
      && model.verificationGaps.filter(gap => gap.reason.includes('not part of shipped textproperty')).length === 4,
    detail({ properties: setText?.semantics.properties, unsupported: setText?.semantics.unsupportedProperties }));
  check('button property family is exact and complete',
    JSON.stringify(propertyNames(button)) === JSON.stringify([
      'active', 'bgColor', 'highlightColor', 'borderColor', 'width', 'height', 'x', 'y', 'scaling', 'affectRowHeight'
    ]), detail(propertyNames(button)));
  check('edit-box property family is exact and complete',
    JSON.stringify(propertyNames(editBox)) === JSON.stringify([
      'x', 'y', 'width', 'height', 'defaultText', 'description', 'maxChars', 'selectTextOnActivation', 'active',
      'bgColor', 'scaling'
    ]),
    detail(propertyNames(editBox)));
  check('text and edit-box inherited geometry stays source-ranged and receiver-owned',
    property(text, 'width')?.value.value === 90
      && property(editBox, 'x')?.value.value === 9
      && property(editBox, 'y')?.value.value === 10
      && property(editBox, 'width')?.value.value === 70
      && property(editBox, 'width')?.source.start.offset === property(editBox, 'width')?.value.location.start.offset
      && editBox?.semantics.cell?.reference?.path === editBox?.receiver?.reference?.path,
    detail({ textWidth: property(text, 'width'), editBox: editBox?.semantics }));
  check('icon property family and icon argument are exposed',
    JSON.stringify(propertyNames(icon)) === JSON.stringify(['width', 'height', 'color', 'affectRowHeight', 'x', 'y', 'scaling'])
      && staticString(icon?.semantics.icon) === 'solid',
    detail(icon?.semantics));
  check('setColWidth exposes optional scaling', setWidth?.semantics.scaling?.value === false, detail(setWidth?.semantics));
  check('button affectRowHeight is projected with static source identity',
    property(button, 'affectRowHeight')?.value.status === 'static'
      && property(button, 'affectRowHeight')?.value.value === false
      && property(button, 'affectRowHeight')?.value.expression === 'false',
    detail(property(button, 'affectRowHeight')));

  const projectedValues = model.calls.flatMap(candidate => candidate.semantics.properties || []);
  check('projected values preserve exact locations and source spelling',
    projectedValues.every(projected => source.slice(projected.source.start.offset, projected.source.end.offset) === projected.value.expression
      && projected.source.file === 'selftest/b119-call-projection.lua'
      && projected.normalizedName === projected.name.replace(/[-_\s]/g, '').toLowerCase()),
    detail(projectedValues));
  check('projected property values retain static status',
    projectedValues.every(projected => projected.value.status === 'static'),
    detail(projectedValues.filter(projected => projected.value.status !== 'static')));

  const spanCell = setSpan?.semantics.cell?.reference?.path;
  const buttonCell = button?.semantics.cell?.reference?.path;
  const setTextCell = setText?.semantics.cell?.reference?.path;
  check('fluent colspan/button/text chain retains one tracked cell',
    Boolean(spanCell) && spanCell === buttonCell && spanCell === setTextCell,
    detail({ spanCell, buttonCell, setTextCell }));
  check('specialized helpers return the tracked receiver',
    button?.result?.path === spanCell && icon?.result?.path === icon?.semantics.cell?.reference?.path,
    detail({ button: button?.result, icon: icon?.result, spanCell, iconCell: icon?.semantics.cell }));

  const scaleX = call(model, 'scaleX');
  const scaleY = call(model, 'scaleY');
  const scaleFont = call(model, 'scaleFont');
  check('scale calls retain exact arguments and enabled flags',
    scaleX?.semantics.scale?.input?.value === 12
      && scaleX?.semantics.scale.enabled?.value === false
      && scaleY?.semantics.scale?.input?.value === 13
      && scaleY?.semantics.scale.enabled?.value === true
      && scaleFont?.semantics.scale?.fontname?.value === 'Zekton'
      && scaleFont?.semantics.scale.fontsize?.value === 14
      && scaleFont?.semantics.scale.enabled?.value === false
      && !scaleX?.result && !scaleY?.result && !scaleFont?.result,
    detail({ scaleX: scaleX?.semantics, scaleY: scaleY?.semantics, scaleFont: scaleFont?.semantics }));
  check('Helper scale calls are statically associated with Helper',
    !scaleX?.semantics.dataFlow && !scaleY?.semantics.dataFlow && !scaleFont?.semantics.dataFlow,
    detail({ scaleX: scaleX?.semantics.dataFlow, scaleY: scaleY?.semantics.dataFlow, scaleFont: scaleFont?.semantics.dataFlow }));

  const constantsSource = [
    'local menu = { name = "Constants", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = Helper.viewWidth, height = Helper.viewHeight })',
    'local table = frame:addTable(1, { width = Helper.borderSize })',
    'table:addRow(true, { height = Helper.standardButtonHeight })[1]:createText("x", { height = Helper.standardTextHeight, x = Helper.borderSize, minRowHeight = Helper.standardTextHeight })'
  ].join('\n');
  const constants = buildX4UiCallModel(input(constantsSource, 'selftest/constants.lua'));
  const constantValues = constants.calls.flatMap(candidate => candidate.semantics.properties || []);
  const constantSymbols = constantValues.map(candidate => candidate.value.symbol).filter(Boolean);
  check('Helper constants retain symbol/expression identity without numeric values',
    JSON.stringify(constantSymbols) === JSON.stringify([
      'Helper.viewWidth', 'Helper.viewHeight', 'Helper.borderSize', 'Helper.standardButtonHeight',
      'Helper.standardTextHeight', 'Helper.borderSize', 'Helper.standardTextHeight'
    ])
      && constantValues.every(candidate => candidate.value.status === 'unknown' && candidate.value.type === 'number'
        && candidate.value.value === undefined && candidate.value.expression.startsWith('Helper.')),
    detail(constantValues));

  const omittedSource = [
    'local menu = { name = "Omitted", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu)',
    'local table = frame:addTable(1)',
    'table:addRow() [1]:createButton({ active = true })'
  ].join('\n');
  const omitted = buildX4UiCallModel(input(omittedSource, 'selftest/omitted.lua'));
  const omittedButton = call(omitted, 'createButton');
  const omittedRow = call(omitted, 'addRow');
  check('omitted option properties stay omitted with no defaults',
    JSON.stringify(propertyNames(omittedButton)) === JSON.stringify(['active'])
      && !property(omittedButton, 'height') && !property(omittedButton, 'scaling')
      && !omittedRow?.semantics.rowData
      && !property(omittedRow, 'interactive'),
    detail({ button: omittedButton?.semantics, row: omittedRow?.semantics }));

  const rowDataSource = [
    'local menu = { name = "RowData", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 80, height = 60 })',
    'local table = frame:addTable(1, { width = 80 })',
    'table:addRow(nil, {})',
    'table:addRow(false, {})',
    'table:addRow(true, { interactive = false })',
    'table:addRow(0, {})',
    'table:addRow("", {})',
    'table:addRow({}, {})',
  ].join('\n');
  const rowDataModel = buildX4UiCallModel(input(rowDataSource, 'selftest/rowdata.lua'));
  const rowDataCalls = rowDataModel.calls.filter(candidate => candidate.name === 'addRow');
  check('rowdata literals retain exact Lua value kinds while row interactive remains an option property',
    rowDataCalls.map(candidate => candidate.semantics.rowData?.type).join(',') === 'nil,boolean,boolean,number,string,reference'
      && rowDataCalls.map(candidate => candidate.semantics.rowData?.expression).join('|') === 'nil|false|true|0|""|{}'
      && property(rowDataCalls[2], 'interactive')?.value.value === false
      && rowDataCalls.every(candidate => !('interactive' in candidate.semantics))
      && rowDataCalls[5].semantics.rowData?.reference?.kind === 'object',
    detail(rowDataCalls.map(candidate => candidate.semantics)));

  const dynamicSource = [
    'local menu = { name = "Dynamic", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, getFrameOptions())',
    'local table = frame:addTable(1, { width = getWidth() })',
    'local row = table:addRow(getRowData(), getRowOptions())',
    'row[1]:createIcon(getIcon(), getIconOptions())',
    'local other = {}',
    'other:createButton({ active = true })',
    'other:scaleX(getValue(), getEnabled())'
  ].join('\n');
  const dynamic = buildX4UiCallModel(input(dynamicSource, 'selftest/dynamic.lua'));
  const dynamicFrame = call(dynamic, 'createFrameHandle');
  const dynamicRow = call(dynamic, 'addRow');
  const dynamicIcon = call(dynamic, 'createIcon');
  const unrelatedButton = call(dynamic, 'createButton');
  const unrelatedScale = call(dynamic, 'scaleX');
  check('dynamic option tables remain explicit gaps without invented properties',
    dynamicFrame?.semantics.options?.status === 'dynamic'
      && !dynamicFrame.semantics.properties
      && dynamicRow?.semantics.options?.status === 'dynamic'
      && !dynamicRow.semantics.properties
      && dynamicIcon?.semantics.options?.status === 'dynamic'
      && !dynamicIcon.semantics.properties
      && dynamic.verificationGaps.some(gap => gap.category === 'property' && gap.status === 'dynamic'),
    detail({ frame: dynamicFrame?.semantics, row: dynamicRow?.semantics, icon: dynamicIcon?.semantics, gaps: dynamic.verificationGaps }));
  check('dynamic rowdata/icon values retain their status without conflating row interactive',
    dynamicRow?.semantics.rowData?.status === 'dynamic'
      && !('interactive' in dynamicRow.semantics)
      && dynamicIcon?.semantics.icon?.status === 'dynamic',
    detail({ row: dynamicRow?.semantics, icon: dynamicIcon?.semantics.icon }));

  const dynamicButtonSource = [
    'local menu = { name = "DynamicButton", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 100 })',
    'local table = frame:addTable(1, { scaling = false })',
    'local row = table:addRow(false, { scaling = false })',
    'row[1]:createButton({ affectRowHeight = getAffectRowHeight() })'
  ].join('\n');
  const dynamicButtonModel = buildX4UiCallModel(input(dynamicButtonSource, 'selftest/dynamic-button.lua'));
  const dynamicButtonAffect = property(call(dynamicButtonModel, 'createButton'), 'affectRowHeight');
  check('button affectRowHeight preserves dynamic status, expression, and location',
    dynamicButtonAffect?.value.status === 'dynamic'
      && dynamicButtonAffect.value.expression === 'getAffectRowHeight()'
      && dynamicButtonSource.slice(dynamicButtonAffect.source.start.offset, dynamicButtonAffect.source.end.offset) === dynamicButtonAffect.value.expression,
    detail(dynamicButtonAffect));
  check('unrelated receivers remain represented with data-flow gaps',
    unrelatedButton?.semantics.dataFlow?.status === 'dynamic'
      && unrelatedScale?.semantics.dataFlow?.status === 'dynamic'
      && dynamic.verificationGaps.some(gap => gap.category === 'data-flow'),
    detail({ button: unrelatedButton?.semantics, scale: unrelatedScale?.semantics }));

  const unsupportedTextSource = [
    'local menu = { name = "UnsupportedText", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(2, { width = 100 })',
    'local row = table:addRow(false, {})',
    'row[1]:createText("text", {}):setText("bad", {})',
    'row[2]:createEditBox({}):setText2("bad2", {})'
  ].join('\n');
  const unsupportedText = buildX4UiCallModel(input(unsupportedTextSource, 'selftest/unsupported-text-setters.lua'));
  check('unsupported nested text receivers are source-located call-model gaps',
    unsupportedText.verificationGaps.filter(gap => gap.status === 'unsupported'
      && gap.reason.includes('is not implemented by shipped')).length === 2
      && unsupportedText.verificationGaps.filter(gap => gap.reason.includes('is not implemented by shipped')).every(gap =>
        unsupportedTextSource.slice(gap.source.start.offset, gap.source.end.offset).includes('setText')),
    detail(unsupportedText.verificationGaps));

  const loopSetup = [
    'local menu = { name = "Loops", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 100 })',
    'local table = frame:addTable(1, { width = 100 })'
  ];
  const whileLoop = [
    'while keepGoing() do',
    '  table:addRow(false, { height = 10 })',
    'end'
  ].join('\n');
  const repeatLoop = [
    'repeat',
    '  table:addRow(false, { height = 11 })',
    'until finished()'
  ].join('\n');
  const numericForLoop = [
    'for index = 1, 2 do',
    '  table:addRow(false, { height = index })',
    'end'
  ].join('\n');
  const genericForLoop = [
    'for key, item in pairs(items) do',
    '  table:addRow(false, { height = item.height })',
    'end'
  ].join('\n');
  const loopStatements = [whileLoop, repeatLoop, numericForLoop, genericForLoop];
  const loopSource = [...loopSetup, ...loopStatements].join('\n');
  const loops = buildX4UiCallModel(input(loopSource, 'selftest/loops.lua'));
  const loopRows = loops.calls.filter(candidate => candidate.name === 'addRow');
  const loopMetadata = loopRows.map(candidate => candidate.context.loopPath.map(segment => ({
    kind: segment.kind,
    multiplicity: segment.multiplicity
  })));
  check('all four loop kinds carry conservative multiplicity',
    JSON.stringify(loopMetadata) === JSON.stringify([
      [{ kind: 'while', multiplicity: 'zero-or-more' }],
      [{ kind: 'repeat', multiplicity: 'one-or-more' }],
      [{ kind: 'numeric-for', multiplicity: 'zero-or-more' }],
      [{ kind: 'generic-for', multiplicity: 'zero-or-more' }]
    ]), detail(loopMetadata));
  check('loop segments retain exact whole-statement source ranges',
    loopRows.length === loopStatements.length && loopRows.every((rowCall, index) => {
      const segment = rowCall.context.loopPath[0];
      const expectedStart = loopSource.indexOf(loopStatements[index]);
      return segment?.source.file === 'selftest/loops.lua'
        && segment.source.start.offset === expectedStart
        && segment.source.end.offset === expectedStart + loopStatements[index].length
        && loopSource.slice(segment.source.start.offset, segment.source.end.offset) === loopStatements[index];
    }), detail(loopRows.map(candidate => candidate.context.loopPath)));
  check('repeat loop ancestry is explicitly one-or-more',
    loopRows[1]?.context.loopPath[0]?.kind === 'repeat'
      && loopRows[1].context.loopPath[0].multiplicity === 'one-or-more'
      && loopRows.filter((_, index) => index !== 1).every(candidate => candidate.context.loopPath[0]?.multiplicity === 'zero-or-more'),
    detail(loopMetadata));

  const nestedInnerLoop = [
    'for index = 1, 2 do',
    '    table:addRow(false, { height = index })',
    '  end'
  ].join('\n');
  const nestedOuterLoop = [
    'while outerReady() do',
    `  ${nestedInnerLoop}`,
    'end'
  ].join('\n');
  const nestedSource = [...loopSetup, nestedOuterLoop].join('\n');
  const nested = buildX4UiCallModel(input(nestedSource, 'selftest/nested-loops.lua'));
  const nestedRow = nested.calls.find(candidate => candidate.name === 'addRow');
  const nestedPath = nestedRow?.context.loopPath;
  check('nested loop paths are outer-to-inner with exact ranges',
    JSON.stringify(nestedPath?.map(segment => segment.kind)) === JSON.stringify(['while', 'numeric-for'])
      && nestedPath?.[0]?.source.start.offset === nestedSource.indexOf(nestedOuterLoop)
      && nestedPath[0].source.end.offset === nestedSource.indexOf(nestedOuterLoop) + nestedOuterLoop.length
      && nestedPath[1]?.source.start.offset === nestedSource.indexOf(nestedInnerLoop)
      && nestedPath[1].source.end.offset === nestedSource.indexOf(nestedInnerLoop) + nestedInnerLoop.length
      && nestedSource.slice(nestedPath[0].source.start.offset, nestedPath[0].source.end.offset) === nestedOuterLoop
      && nestedSource.slice(nestedPath[1].source.start.offset, nestedPath[1].source.end.offset) === nestedInnerLoop,
    detail(nestedPath));

  const branchLoop = [
    'while running do',
    '  if choice then',
    '    table:addRow(false, { height = 12 })',
    '  end',
    'end'
  ].join('\n');
  const branchLoopSource = [...loopSetup, branchLoop].join('\n');
  const branchLoopModel = buildX4UiCallModel(input(branchLoopSource, 'selftest/loop-branch.lua'));
  const branchLoopRow = branchLoopModel.calls.find(candidate => candidate.name === 'addRow');
  check('loop and branch ancestry remain independent',
    branchLoopRow?.context.loopPath.length === 1
      && branchLoopRow.context.loopPath[0].kind === 'while'
      && branchLoopRow.context.branchPath.length === 1
      && branchLoopRow.context.branchPath[0].arm === 'then'
      && branchLoopRow.context.reachability === 'conditional',
    detail(branchLoopRow?.context));

  const inheritedLoop = [
    'while running do',
    '  local row = table:addRow(true, { height = 20 })',
    '  row[1].handlers.onClick = function()',
    '    row[1]:setText("clicked", { fontsize = 11 })',
    '  end',
    '  local function addLater()',
    '    table:addRow(false, { height = 21 })',
    '  end',
    'end'
  ].join('\n');
  const inheritedSource = [...loopSetup, inheritedLoop].join('\n');
  const inherited = buildX4UiCallModel(input(inheritedSource, 'selftest/inherited-loop.lua'));
  const inheritedRecords = inherited.records.filter(record => record.context.loopPath.length > 0);
  const inheritedTypes = [...new Set(inheritedRecords.map(record => record.recordType))].sort();
  const inheritedFunctionRow = inherited.calls.filter(candidate => candidate.name === 'addRow')[1];
  const inheritedHandlerCall = inherited.calls.find(candidate => candidate.name === 'setText');
  check('calls properties handlers aliases and nested functions inherit lexical loop ancestry',
    JSON.stringify(inheritedTypes) === JSON.stringify(['alias', 'call', 'handler', 'property'])
      && inheritedRecords.every(record => record.context.loopPath.length === 1 && record.context.loopPath[0].kind === 'while')
      && inheritedFunctionRow?.context.kind === 'function'
      && inheritedFunctionRow.context.loopPath[0]?.kind === 'while'
      && inheritedHandlerCall?.context.kind === 'handler'
      && inheritedHandlerCall.context.loopPath[0]?.kind === 'while',
    detail({ inheritedTypes, records: inheritedRecords.map(record => ({ type: record.recordType, context: record.context })) }));

  const doBlock = [
    'do',
    '  table:addRow(false, { height = 30 })',
    'end'
  ].join('\n');
  const doSource = [...loopSetup, doBlock, 'table:addRow(false, { height = 31 })'].join('\n');
  const doModel = buildX4UiCallModel(input(doSource, 'selftest/plain-do.lua'));
  const emptyLoopPaths = doModel.records.map(record => record.context.loopPath);
  check('plain do and non-loop contexts use the frozen empty path',
    doModel.calls.filter(candidate => candidate.name === 'addRow').length === 2
      && emptyLoopPaths.every(path => path.length === 0 && Object.isFrozen(path))
      && new Set(emptyLoopPaths).size === 1,
    detail(emptyLoopPaths));

  const repeatedLoops = buildX4UiCallModel(input(loopSource, 'selftest/loops.lua'));
  const loopPathsFrozen = loops.records.every(record => Object.isFrozen(record.context.loopPath)
    && record.context.loopPath.every(segment => Object.isFrozen(segment)
      && Object.isFrozen(segment.source)
      && Object.isFrozen(segment.source.start)
      && Object.isFrozen(segment.source.end)));
  check('loop context values are frozen and deterministic',
    loopPathsFrozen && JSON.stringify(loops) === JSON.stringify(repeatedLoops),
    detail({ loopPathsFrozen }));

  const localHelperSource = [
    'local Helper = rawget(_G, "Helper")',
    'local function refreshHelper() if not Helper then Helper = rawget(_G, "Helper") end return Helper end',
    'local function addPanel(frame, count, label)',
    '  local table = frame:addTable(count, { width = 80 })',
    '  local row = table:addRow(false, {})',
    '  row[1]:createText(label, { height = 12 })',
    '  return count',
    'end',
    'local panelAlias = addPanel',
    'local function display()',
    '  local menu = { name = "Helpers", layer = 1 }',
    '  local frame = Helper.createFrameHandle(menu, { width = 80, height = 60 })',
    '  addPanel(frame, 2, "direct")',
    '  local consumed = panelAlias(frame, 3, "alias")',
    'end',
  ].join('\n');
  const localHelpers = buildX4UiCallModel(input(localHelperSource, 'selftest/local-helpers.lua'));
  const panelDeclaration = localHelpers.localFunctions.find(candidate => candidate.name === 'addPanel');
  const helperInvocations = localHelpers.localInvocations.filter(candidate => candidate.calleeDeclarationId === panelDeclaration?.id);
  const helperTableCall = localHelpers.calls.find(candidate => candidate.name === 'addTable'
    && candidate.context.source?.start.offset === panelDeclaration?.source.start.offset);
  const helperTextCall = localHelpers.calls.find(candidate => candidate.name === 'createText'
    && candidate.context.source?.start.offset === panelDeclaration?.source.start.offset);
  check('local declarations expose exact immutable declaration, body, and parameter ranges',
    panelDeclaration?.parameters.map(parameter => parameter.name).join(',') === 'frame,count,label'
      && panelDeclaration.parameters.every((parameter, index) => parameter.index === index
        && parameter.declarationId === panelDeclaration.id
        && localHelperSource.slice(parameter.source.start.offset, parameter.source.end.offset) === parameter.name)
      && panelDeclaration.bodySource.start.offset >= panelDeclaration.source.start.offset
      && panelDeclaration.bodySource.end.offset <= panelDeclaration.source.end.offset
      && Object.isFrozen(localHelpers.localFunctions)
      && Object.isFrozen(panelDeclaration)
      && Object.isFrozen(panelDeclaration.parameters),
    detail(panelDeclaration));
  check('direct parameter uses retain declaration-range identity rather than spelling',
    helperTableCall?.receiver?.parameter?.id === panelDeclaration?.parameters[0]?.id
      && helperTableCall.semantics.count?.parameter?.id === panelDeclaration?.parameters[1]?.id
      && helperTextCall?.semantics.text?.parameter?.id === panelDeclaration?.parameters[2]?.id,
    detail({ table: helperTableCall, text: helperTextCall }));
  check('direct and exact local aliases resolve to one declaration with ordered arguments and consumed state',
    helperInvocations.length === 2
      && helperInvocations[0].resolution === 'direct'
      && helperInvocations[0].resultConsumed === false
      && helperInvocations[1].resolution === 'alias'
      && helperInvocations[1].resultConsumed === true
      && helperInvocations.every(invocation => invocation.status === 'supported'
        && invocation.arguments.length === 3
        && localHelperSource.slice(invocation.source.start.offset, invocation.source.end.offset).includes(invocation.calleeExpression))
      && Object.isFrozen(localHelpers.localInvocations)
      && Object.isFrozen(helperInvocations[0]?.arguments),
    detail(helperInvocations));
  check('exact rawget Helper binding and lazy same-expression reassignment preserve preview receiver identity',
    localHelpers.helperReceiverAliases.map(fact => fact.status).join(',') === 'bound,preserved'
      && localHelpers.helperReceiverAliases.every(fact => fact.runtimeAvailability === 'unverified'
        && fact.callSource
        && localHelperSource.slice(fact.callSource.start.offset, fact.callSource.end.offset) === 'rawget(_G, "Helper")')
      && localHelpers.calls.find(candidate => candidate.name === 'createFrameHandle')?.receiver?.reference?.helperRuntimeAvailability === 'unverified'
      && Object.isFrozen(localHelpers.helperReceiverAliases),
    detail(localHelpers.helperReceiverAliases));

  const invocationNegativeSource = [
    'local function same(a) return a end',
    'local first = same',
    'local function same(a) return a end',
    'first(1)',
    'same()',
    'same(1, 2)',
    'globalCall(1)',
    'holder.same(1)',
    'holder:same(1)',
    'local function variadic(...) return ... end',
    'variadic(1)',
  ].join('\n');
  const invocationNegatives = buildX4UiCallModel(input(invocationNegativeSource, 'selftest/local-helper-negatives.lua'));
  const sameDeclarations = invocationNegatives.localFunctions.filter(candidate => candidate.name === 'same');
  const firstCall = invocationNegatives.localInvocations.find(candidate => candidate.calleeExpression === 'first');
  const secondSameCalls = invocationNegatives.localInvocations.filter(
    candidate => candidate.calleeExpression === 'same' && candidate.method === 'direct');
  const unsupportedGlobal = invocationNegatives.localInvocations.find(candidate => candidate.calleeExpression === 'globalCall');
  const unsupportedMethods = invocationNegatives.localInvocations.filter(
    candidate => candidate.method === '.' || candidate.method === ':');
  const unsupportedVararg = invocationNegatives.localInvocations.find(candidate => candidate.calleeExpression === 'variadic');
  check('same names never replace declaration identity and invalid invocation shapes stay source-located',
    sameDeclarations.length === 2
      && sameDeclarations[0].id !== sameDeclarations[1].id
      && firstCall?.calleeDeclarationId === sameDeclarations[0].id
      && secondSameCalls.every(candidate => candidate.calleeDeclarationId === sameDeclarations[1].id && candidate.status === 'unsupported')
      && unsupportedGlobal?.status === 'unsupported'
      && unsupportedMethods.length === 2
      && unsupportedMethods.every(candidate => candidate.status === 'unsupported')
      && unsupportedVararg?.status === 'unsupported'
      && invocationNegatives.localInvocations.every(candidate => candidate.source.file === 'selftest/local-helper-negatives.lua'),
    detail({ declarations: sameDeclarations, invocations: invocationNegatives.localInvocations }));

  const rawgetNegativeSource = [
    'local Good = rawget(_G, "Helper")',
    'Good = nil',
    'local Copied = Good',
    'local function shadowGlobal(_G) local BadGlobal = rawget(_G, "Helper") end',
    'local key = "Helper"',
    'local BadKey = rawget(_G, key)',
    'local BadName = rawget(_G, "Other")',
    'local rawget = function() return nil end',
    'local BadShadow = rawget(_G, "Helper")',
  ].join('\n');
  const rawgetNegatives = buildX4UiCallModel(input(rawgetNegativeSource, 'selftest/helper-alias-negatives.lua'));
  check('shadowed rawget/_G, dynamic keys, non-Helper keys, reassignment, and copied aliases never prove Helper identity',
    rawgetNegatives.helperReceiverAliases.some(fact => fact.reason.includes('shadowed rawget'))
      && rawgetNegatives.helperReceiverAliases.some(fact => fact.reason.includes('shadowed _G'))
      && rawgetNegatives.helperReceiverAliases.some(fact => fact.reason.includes('exact static string'))
      && rawgetNegatives.helperReceiverAliases.some(fact => fact.status === 'invalidated')
      && !rawgetNegatives.aliases.find(candidate => candidate.name === 'Copied')?.value.reference,
    detail(rawgetNegatives.helperReceiverAliases));

  const conditionalInvalidationSource = [
    'local Helper = rawget(_G, "Helper")',
    'if reset then Helper = {} end',
    'local menu = { name = "Invalidated", layer = 1 }',
    'Helper.createFrameHandle(menu, { width = 80, height = 60 })',
  ].join('\n');
  const conditionalInvalidation = buildX4UiCallModel(input(
    conditionalInvalidationSource,
    'selftest/helper-conditional-invalidation.lua',
  ));
  const invalidatedFrame = conditionalInvalidation.calls.find(candidate => candidate.name === 'createFrameHandle');
  check('a conflicting conditional reassignment invalidates Helper identity after the branch boundary',
    conditionalInvalidation.helperReceiverAliases.map(fact => fact.status).join(',') === 'bound,invalidated'
      && invalidatedFrame?.receiver?.reference?.path !== 'Helper'
      && invalidatedFrame?.receiver?.reason?.includes('may be reassigned in a control-flow block') === true,
    detail({ aliases: conditionalInvalidation.helperReceiverAliases, frame: invalidatedFrame }));

  const malformed = buildX4UiCallModel(input('function broken(', 'selftest/malformed.lua'));
  check('malformed Lua is a parse gap', !malformed.parsed && malformed.verificationGaps.some(gap => gap.category === 'parse'), detail(malformed));

  const before = source;
  const repeatedA = buildX4UiCallModel(input(source));
  const repeatedB = buildX4UiCallModel(input(source));
  check('analysis is deterministic', JSON.stringify(repeatedA) === JSON.stringify(repeatedB), 'repeated models differ');
  check('analysis does not mutate caller source', source === before && model.file.text === before, 'source text changed');

  const passed = checks.filter(item => item.pass).length;
  const allPassed = passed === checks.length;
  return { allPassed, pass: allPassed, passed, total: checks.length, checks };
}

const result = run();
console.log(JSON.stringify(result, null, 2));
if (!result.allPassed) process.exitCode = 1;
