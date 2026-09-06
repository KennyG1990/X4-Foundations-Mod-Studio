import {
  buildX4UiCallModel,
  type X4UiCallColorExpression,
  type X4UiColorExpression,
  type X4UiCallRecord,
  type X4UiCallPropertyProjection,
  type X4UiValue,
  type X4UiValueReference
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

interface EnclosingStatementProbe {
  source: X4UiCallRecord['source'];
  deletionSource: X4UiCallRecord['source'];
  terminator: 'none' | 'semicolon';
  kind: string;
  isStandaloneCallStatementRoot: boolean;
}

function sameSourceRange(
  left: X4UiCallRecord['source'] | undefined,
  right: X4UiCallRecord['source'] | undefined
): boolean {
  return Boolean(left && right
    && left.file === right.file
    && left.sourcePath === right.sourcePath
    && left.start.line === right.start.line
    && left.start.column === right.start.column
    && left.start.offset === right.start.offset
    && left.end.line === right.end.line
    && left.end.column === right.end.column
    && left.end.offset === right.end.offset);
}

function sameReferenceIdentity(
  left: X4UiValueReference | undefined,
  right: X4UiValueReference | undefined,
): boolean {
  if (!left || !right) return false;
  const leftIndex = left.index;
  const rightIndex = right.index;
  return left.kind === right.kind
    && left.path === right.path
    && left.origin === right.origin
    && left.parentPath === right.parentPath
    && left.relatedPath === right.relatedPath
    && sameSourceRange(left.source, right.source)
    && left.helperRuntimeAvailability === right.helperRuntimeAvailability
    && ((!left.helperAliasSource && !right.helperAliasSource) || Boolean(
      left.helperAliasSource
        && right.helperAliasSource
        && sameSourceRange(left.helperAliasSource, right.helperAliasSource),
    ))
    && ((!leftIndex && !rightIndex) || Boolean(
      leftIndex
        && rightIndex
        && leftIndex.status === rightIndex.status
        && leftIndex.type === rightIndex.type
        && leftIndex.value === rightIndex.value
        && leftIndex.expression === rightIndex.expression
        && sameSourceRange(leftIndex.location, rightIndex.location),
    ));
}

function frozenSourceLocation(source: X4UiCallRecord['source'] | undefined): boolean {
  return Boolean(source
    && Object.isFrozen(source)
    && Object.isFrozen(source.start)
    && Object.isFrozen(source.end));
}

function enclosingStatement(callRecord: X4UiCallRecord | undefined): EnclosingStatementProbe | undefined {
  return (callRecord as (X4UiCallRecord & { enclosingStatement?: EnclosingStatementProbe }) | undefined)?.enclosingStatement;
}

function callAt(
  model: ReturnType<typeof buildX4UiCallModel>,
  source: string,
  expression: string,
  from = 0
): X4UiCallRecord | undefined {
  const start = source.indexOf(expression, from);
  if (start < 0) return undefined;
  return model.calls.find(candidate => candidate.source.start.offset === start
    && candidate.source.end.offset === start + expression.length);
}

function callContaining(
  model: ReturnType<typeof buildX4UiCallModel>,
  source: string,
  name: X4UiCallRecord['name'],
  fragment: string,
  from = 0
): X4UiCallRecord | undefined {
  return model.calls.find(candidate => candidate.name === name
    && candidate.source.start.offset >= from
    && source.slice(candidate.source.start.offset, candidate.source.end.offset).includes(fragment));
}

function property(callRecord: X4UiCallRecord | undefined, name: string): X4UiCallPropertyProjection | undefined {
  return callRecord?.semantics.properties?.find(candidate => candidate.name === name);
}

function propertyNames(callRecord: X4UiCallRecord | undefined): string[] {
  return callRecord?.semantics.properties?.map(candidate => candidate.name) || [];
}

interface ColorSourceFieldProbe {
  value: number;
  expression: string;
  source: X4UiCallRecord['source'];
  keySource: X4UiCallRecord['source'];
}

function colorEntry(
  model: ReturnType<typeof buildX4UiCallModel>,
  callRecord: X4UiCallRecord | undefined,
  propertyName: string
): X4UiCallColorExpression | undefined {
  return model.colorExpressions.find(candidate => candidate.callName === callRecord?.name
    && candidate.propertyName === propertyName
    && sameSourceRange(candidate.callSource, callRecord?.source));
}

function colorExpression(
  model: ReturnType<typeof buildX4UiCallModel>,
  callRecord: X4UiCallRecord | undefined,
  propertyName: string
): X4UiColorExpression | undefined {
  return colorEntry(model, callRecord, propertyName)?.colorExpression;
}

function colorSourceField(
  expression: X4UiColorExpression | undefined,
  name: 'r' | 'g' | 'b' | 'a' | 'glow'
): ColorSourceFieldProbe | undefined {
  return expression
    ? (expression as unknown as Record<string, ColorSourceFieldProbe | undefined>)[name]
    : undefined;
}

function exactProbeSource(
  source: string,
  expression: X4UiColorExpression | undefined,
  expected: string
): boolean {
  return Boolean(expression
    && expression.source.start.offset >= 0
    && expression.expression === expected
    && expression.source.end.offset === expression.source.start.offset + expected.length
    && source.slice(expression.source.start.offset, expression.source.end.offset) === expected);
}

function exactLocatedText(
  source: string,
  located: { expression?: string; source?: X4UiCallRecord['source'] } | undefined,
  expected: string
): boolean {
  return Boolean(located?.expression === expected
    && located.source
    && located.source.end.offset === located.source.start.offset + expected.length
    && source.slice(located.source.start.offset, located.source.end.offset) === expected);
}

function literalEvidence(
  source: string,
  expression: X4UiColorExpression | undefined,
  useExpression: string,
  declarationExpression: string,
  channels: [number, number, number, number]
): boolean {
  const declaration = expression as (X4UiColorExpression & {
    declarationExpression?: string;
    declarationSource?: X4UiCallRecord['source'];
  }) | undefined;
  const channelNames: Array<'r' | 'g' | 'b' | 'a'> = ['r', 'g', 'b', 'a'];
  return expression?.kind === 'literal-table'
    && exactProbeSource(source, expression, useExpression)
    && declaration?.declarationExpression === declarationExpression
    && exactLocatedText(source, declaration?.declarationSource && {
      expression: declaration.declarationExpression,
      source: declaration.declarationSource
    }, declarationExpression)
    && channelNames.every((name, index) => {
      const field = colorSourceField(expression, name);
      return field?.value === channels[index]
        && field.expression === String(channels[index])
        && exactLocatedText(source, field, field.expression)
        && source.slice(field.keySource.start.offset, field.keySource.end.offset) === name;
    });
}

function closedFrozenData(value: unknown, seen = new WeakSet<object>()): boolean {
  if (value === null || typeof value !== 'object') return true;
  if (seen.has(value)) return true;
  seen.add(value);
  const keys = Reflect.ownKeys(value);
  const enumerableKeys = Object.keys(value);
  const comparableKeys = Array.isArray(value) ? keys.filter(key => key !== 'length') : keys;
  const plain = Array.isArray(value) || Object.getPrototypeOf(value) === Object.prototype;
  const ownKeysClosed = JSON.stringify(comparableKeys) === JSON.stringify(enumerableKeys);
  const record = value as Record<string, unknown>;
  return Object.isFrozen(value)
    && plain
    && ownKeysClosed
    && enumerableKeys.every(key => closedFrozenData(record[key], seen));
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
      'x', 'y', 'width', 'height', 'layer', 'standardButtons', 'blurBackground',
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

  const frameTextureSource = [
    'local textureMenu = { name = "FrameTextures", layer = 1 }',
    'local textureFrame = Helper.createFrameHandle(textureMenu, { width = 100, height = 80 })',
    'textureFrame:setBackground("background-icon", { icon = "background-option", color = { r = 0.11, g = 0.12, b = 0.13, a = 0.14 }, width = 0, height = 0, rotationRate = 1, rotationStart = 2, rotationDuration = 3, rotationInterval = 4, initialScaleFactor = 0.5, scaleDuration = 6, glowfactor = 0.7 })',
    'textureFrame:setBackground2("background2-icon", { icon = "", color = Color["background2"], width = 32, height = 24, rotationRate = 7, rotationStart = 8, rotationDuration = 9, rotationInterval = 10, initialScaleFactor = 1.5, scaleDuration = 11, glowfactor = 0.8 })',
    'textureFrame:setOverlay("overlay-icon", { icon = "overlay-option", color = { r = 0.21, g = 0.22, b = 0.23, a = 0.24 }, width = 48, height = 36, rotationRate = 12, rotationStart = 13, rotationDuration = 14, rotationInterval = 15, initialScaleFactor = 0.75, scaleDuration = 16, glowfactor = 0.9 })',
  ].join('\n');
  const frameTextureModel = buildX4UiCallModel(input(frameTextureSource, 'selftest/frame-texture-setters.lua'));
  const frameTextureSetterNames: readonly X4UiCallRecord['name'][] = ['setBackground', 'setBackground2', 'setOverlay'];
  const frameTextureCalls = frameTextureSetterNames.map(name => call(frameTextureModel, name));
  const frameTexturePropertyNames = ['icon', 'color', 'width', 'height', 'rotationRate', 'rotationStart', 'rotationDuration', 'rotationInterval', 'initialScaleFactor', 'scaleDuration', 'glowfactor'];
  const frameTextureFrameReference = frameTextureCalls[0]?.semantics.frame?.reference;
  check('B119 frame texture setters are tracked in exact source order with one exact frame receiver',
    frameTextureCalls.every((candidate, index) => candidate !== undefined
      && candidate.name === frameTextureSetterNames[index]
      && candidate.method === ':'
      && candidate.source.start.offset < candidate.source.end.offset
      && frameTextureSource.slice(candidate.source.start.offset, candidate.source.end.offset).startsWith(`textureFrame:${candidate.name}`)
      && sameReferenceIdentity(candidate.semantics.frame?.reference, frameTextureFrameReference)
      && sameReferenceIdentity(candidate.result, frameTextureFrameReference)),
    detail(frameTextureCalls));
  check('B119 frame texture setters expose every shipped option field and exact icon/color evidence',
    frameTextureCalls.every((candidate, index) => {
      const expectedIcon = ['background-icon', 'background2-icon', 'overlay-icon'][index];
      const expectedOptionIcon = ['background-option', '', 'overlay-option'][index];
      const iconValue = candidate?.semantics.icon;
      const properties = candidate?.semantics.properties || [];
      const optionIcon = properties.find(propertyValue => propertyValue.name === 'icon');
      const color = colorExpression(frameTextureModel, candidate, 'color');
      const expectedColor = index === 1 ? 'Color["background2"]' : index === 0
        ? '{ r = 0.11, g = 0.12, b = 0.13, a = 0.14 }'
        : '{ r = 0.21, g = 0.22, b = 0.23, a = 0.24 }';
      return staticString(iconValue) === expectedIcon
        && JSON.stringify(properties.map(propertyValue => propertyValue.name)) === JSON.stringify(frameTexturePropertyNames)
        && optionIcon?.value.status === 'static'
        && optionIcon.value.value === expectedOptionIcon
        && properties.filter(propertyValue => propertyValue.name !== 'color').every(propertyValue => propertyValue.value.status === 'static')
        && exactLocatedText(frameTextureSource, { expression: iconValue?.expression, source: iconValue?.location }, `"${expectedIcon}"`)
        && exactProbeSource(frameTextureSource, color, expectedColor)
        && (index === 1 ? color?.kind === 'symbolic-reference' : color?.kind === 'literal-table');
    }),
    detail(frameTextureCalls.map(candidate => ({
      name: candidate?.name,
      icon: candidate?.semantics.icon,
      properties: candidate?.semantics.properties,
      color: colorExpression(frameTextureModel, candidate, 'color'),
    }))));
  const frameTextureExactKeySource = [
    'local exactKeyMenu = { name = "B119FrameTextureExactKeys", layer = 4 }',
    'local exactKeyFrame = Helper.createFrameHandle(exactKeyMenu, { width = 100, height = 80 })',
    'exactKeyFrame:setBackground("background-positional", { Icon = "", rotation_rate = 11, ["rotation rate"] = 12, bogus = 13, width = 21, color = { r = 0.31, g = 0.32, b = 0.33, a = 0.34 } })',
    'exactKeyFrame:setBackground2("background2-positional", { icon = "background2-exact", Width = 22, ["glow factor"] = 23, rotationRate = 24 })',
    'exactKeyFrame:setOverlay("overlay-positional", { icon = "overlay-exact", Height = 33, rotationStart = 34, bogus = 35 })',
  ].join('\n');
  const frameTextureExactKeyModel = buildX4UiCallModel(input(
    frameTextureExactKeySource,
    'selftest/frame-texture-exact-keys.lua',
  ));
  const frameTextureExactKeyCalls = frameTextureSetterNames.map(name =>
    frameTextureExactKeyModel.calls.find(candidate => candidate.name === name));
  const frameTextureExactKeyUnsupported = frameTextureExactKeyCalls.map(candidate =>
    candidate?.semantics.unsupportedProperties?.map(propertyValue => propertyValue.name) || []);
  check('B119 frame texture option projection is exact-key only across all setter families',
    JSON.stringify(frameTextureExactKeyCalls.map(candidate => propertyNames(candidate))) === JSON.stringify([
      ['width', 'color'],
      ['icon', 'rotationRate'],
      ['icon', 'rotationStart'],
    ])
      && JSON.stringify(frameTextureExactKeyUnsupported) === JSON.stringify([
        ['Icon', 'rotation_rate', 'rotation rate', 'bogus'],
        ['Width', 'glow factor'],
        ['Height', 'bogus'],
      ])
      && frameTextureExactKeyCalls[0]?.semantics.properties?.every(propertyValue =>
        frameTextureExactKeySource.slice(propertyValue.source.start.offset, propertyValue.source.end.offset)
          === propertyValue.value.expression)
      && frameTextureExactKeyCalls.every(candidate => candidate?.semantics.unsupportedProperties?.every(propertyValue =>
        frameTextureExactKeySource.slice(propertyValue.source.start.offset, propertyValue.source.end.offset)
          === propertyValue.value.expression))
      && frameTextureExactKeyCalls.every(candidate => candidate?.semantics.unsupportedProperties?.length
        ? frameTextureExactKeyModel.verificationGaps.some(gap => gap.category === 'property'
          && gap.status === 'unsupported'
          && gap.reason.includes(`${candidate.name} property`))
        : false),
    detail({
      properties: frameTextureExactKeyCalls.map(candidate => candidate?.semantics.properties),
      unsupported: frameTextureExactKeyCalls.map(candidate => candidate?.semantics.unsupportedProperties),
      gaps: frameTextureExactKeyModel.verificationGaps.filter(gap => gap.category === 'property'),
    }));
  check('B119 frame texture exact keys preserve positional icon semantics and canonical numeric/color positives',
    staticString(frameTextureExactKeyCalls[0]?.semantics.icon) === 'background-positional'
      && property(frameTextureExactKeyCalls[0], 'icon') === undefined
      && property(frameTextureExactKeyCalls[0], 'width')?.value.value === 21
      && property(frameTextureExactKeyCalls[0], 'color')?.value.status === 'static'
      && colorExpression(frameTextureExactKeyModel, frameTextureExactKeyCalls[0], 'color')?.kind === 'literal-table'
      && staticString(frameTextureExactKeyCalls[1]?.semantics.icon) === 'background2-positional'
      && property(frameTextureExactKeyCalls[1], 'icon')?.value.value === 'background2-exact'
      && property(frameTextureExactKeyCalls[1], 'rotationRate')?.value.value === 24
      && staticString(frameTextureExactKeyCalls[2]?.semantics.icon) === 'overlay-positional'
      && property(frameTextureExactKeyCalls[2], 'icon')?.value.value === 'overlay-exact'
      && property(frameTextureExactKeyCalls[2], 'rotationStart')?.value.value === 34,
    detail(frameTextureExactKeyCalls.map(candidate => ({
      name: candidate?.name,
      icon: candidate?.semantics.icon,
      properties: candidate?.semantics.properties,
      unsupported: candidate?.semantics.unsupportedProperties,
    }))));
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

  const colorSource = [
    'local key = "dynamic-id"',
    'local flag = true',
    'local function makeColor() return { r = 0.7, g = 0.8, b = 0.9, a = 0.25 } end',
    'local colorMenu = { name = "Colors", layer = 1 }',
    'local colorFrame = Helper.createFrameHandle(colorMenu, {})',
    'colorFrame:setBackground("frame-icon", { color = { r = 0.1, g = 0.2, b = 0.3, a = 0.4 } })',
    'local colorTable = colorFrame:addTable(1, { backgroundColor = Color["known.id"] })',
    'local colorRow = colorTable:addRow(true, {})',
    'colorRow[1]:createText("dynamic", { color = Color[key], cellBGColor = (flag and Color["branch.id"]) or makeColor() })',
    'colorRow[2]:createButton({ bgColor = makeColor(), highlightColor = "white", borderColor = { r = 1, g = 2, b = 3, a = 0.5, glow = 0.6 } })',
    'colorRow[3]:createEditBox({ bgColor = Color["unknown.id"] })',
    'colorRow[4]:createIcon("icon", { color = makeColor() })'
  ].join('\n');
  const colorSourceBefore = colorSource;
  const colorModel = buildX4UiCallModel(input(colorSource, 'selftest/color-expressions.lua'));
  const literalColor = colorExpression(colorModel, call(colorModel, 'setBackground'), 'color');
  const symbolicColor = colorExpression(colorModel, call(colorModel, 'addTable'), 'backgroundColor');
  const textColorCall = call(colorModel, 'createText');
  const dynamicColor = colorExpression(colorModel, textColorCall, 'color');
  const conditionalColor = colorExpression(colorModel, textColorCall, 'cellBGColor');
  const buttonColorCall = call(colorModel, 'createButton');
  const functionColor = colorExpression(colorModel, buttonColorCall, 'bgColor');
  const scalarColor = colorExpression(colorModel, buttonColorCall, 'highlightColor');
  const explicitGlowColor = colorExpression(colorModel, buttonColorCall, 'borderColor');
  const editColor = colorExpression(colorModel, call(colorModel, 'createEditBox'), 'bgColor');
  const iconColor = colorExpression(colorModel, call(colorModel, 'createIcon'), 'color');
  const literalExpression = '{ r = 0.1, g = 0.2, b = 0.3, a = 0.4 }';
  const literalStart = colorSource.indexOf(literalExpression);
  const literalFields = ['r', 'g', 'b', 'a'].map(name => colorSourceField(literalColor, name as 'r' | 'g' | 'b' | 'a'));
  check('color literal tables preserve exact channels, UTF-16 ranges, and omitted glow',
    literalColor?.kind === 'literal-table'
      && exactProbeSource(colorSource, literalColor, literalExpression)
      && literalColor.source.start.offset === literalStart
      && literalFields.every((field, index) => field?.value === [0.1, 0.2, 0.3, 0.4][index]
        && field.expression === String([0.1, 0.2, 0.3, 0.4][index])
        && field.source.start.offset < field.source.end.offset
        && field.keySource.start.offset < field.source.start.offset
        && colorSource.slice(field.source.start.offset, field.source.end.offset) === field.expression)
      && explicitGlowColor?.kind === 'literal-table'
      && colorSourceField(explicitGlowColor, 'glow')?.value === 0.6
      && colorSourceField(explicitGlowColor, 'glow')?.expression === '0.6'
      && colorSource.slice(
        colorSourceField(explicitGlowColor, 'glow')?.keySource.start.offset || -1,
        colorSourceField(explicitGlowColor, 'glow')?.keySource.end.offset || -1,
      ) === 'glow'
      && !('glow' in (literalColor || {})),
    detail({ literalColor, literalFields, explicitGlowColor }));
  check('known and unknown Color IDs remain symbolic-only with exact ID provenance',
    symbolicColor?.kind === 'symbolic-reference'
      && symbolicColor.resolution === 'symbolic-only'
      && symbolicColor.id === 'known.id'
      && symbolicColor.base === 'Color'
      && exactProbeSource(colorSource, symbolicColor, 'Color["known.id"]')
      && editColor?.kind === 'symbolic-reference'
      && editColor.resolution === 'symbolic-only'
      && editColor.id === 'unknown.id'
      && exactProbeSource(colorSource, editColor, 'Color["unknown.id"]'),
    detail({ symbolicColor, editColor }));
  check('dynamic Color keys remain unresolved with exact key and expression provenance',
    dynamicColor?.kind === 'dynamic-reference'
      && dynamicColor.resolution === 'unresolved'
      && dynamicColor.base === 'Color'
      && (dynamicColor.key as { expression?: string } | undefined)?.expression === 'key'
      && exactProbeSource(colorSource, dynamicColor, 'Color[key]'),
    detail(dynamicColor));
  check('conditional or logical color expressions remain unresolved as whole expressions',
    conditionalColor?.kind === 'conditional'
      && conditionalColor.resolution === 'unresolved'
      && conditionalColor.operator === 'or'
      && exactProbeSource(colorSource, conditionalColor, '(flag and Color["branch.id"]) or makeColor()'),
    detail(conditionalColor));
  check('function-produced colors remain unresolved with exact call provenance',
    functionColor?.kind === 'function-call'
      && functionColor.resolution === 'unresolved'
      && functionColor.calleeExpression === 'makeColor'
      && exactProbeSource(colorSource, functionColor, 'makeColor()')
      && iconColor?.kind === 'function-call'
      && iconColor.calleeExpression === 'makeColor',
    detail({ functionColor, iconColor }));
  check('ordinary scalar color spelling remains backward-compatible and source-located',
    scalarColor?.kind === 'scalar'
      && scalarColor.status === 'static'
      && scalarColor.type === 'string'
      && scalarColor.value === 'white'
      && exactProbeSource(colorSource, scalarColor, '"white"')
      && property(buttonColorCall, 'highlightColor')?.value.value === 'white',
    detail({ scalarColor, value: property(buttonColorCall, 'highlightColor')?.value }));

  const malformedColorSource = [
    'local malformedMenu = { name = "Malformed", layer = 1 }',
    'local malformedFrame = Helper.createFrameHandle(malformedMenu, {})',
    'local malformedTable = malformedFrame:addTable(1, {})',
    'local malformedRow = malformedTable:addRow(true, {})',
    'local partial = { r = 1, g = 2, b = 3 }',
    'local mutated = { r = 1, g = 2, b = 3, a = 4 }',
    'local validAlias = { r = 1, g = 2, b = 3, a = 4 }',
    'local inlineOptions = { color = { r = 1, g = 2, b = 3, a = 4 } }',
    'mutated.r = 9',
    'inlineOptions.color.r = 9',
    'malformedRow[1]:createText("partial", { color = partial, cellBGColor = { r = 1, g = 2, b = 3, a = 4, extra = 5 } })',
    'malformedRow[2]:createButton({ bgColor = { r = 1, g = 2, b = 3, a = 4, r = 8 } })',
    'malformedRow[3]:createIcon("mutated", { color = mutated })',
    'malformedRow[4]:createIcon("alias", { color = validAlias })',
    'malformedRow[5]:createText("inline", inlineOptions)',
    'malformedRow[6]:createEditBox({ bgColor = { r = 1, g = dynamicValue, b = 3, a = 4 } })'
  ].join('\n');
  const malformedColorModel = buildX4UiCallModel(input(malformedColorSource, 'selftest/color-expression-negatives.lua'));
  const malformedText = call(malformedColorModel, 'createText');
  const malformedTextCalls = malformedColorModel.calls.filter(candidate => candidate.name === 'createText');
  const malformedButton = call(malformedColorModel, 'createButton');
  const malformedIconCalls = malformedColorModel.calls.filter(candidate => candidate.name === 'createIcon');
  const malformedEdit = call(malformedColorModel, 'createEditBox');
  const negativeColors = [
    colorExpression(malformedColorModel, malformedText, 'color'),
    colorExpression(malformedColorModel, malformedText, 'cellBGColor'),
    colorExpression(malformedColorModel, malformedButton, 'bgColor'),
    colorExpression(malformedColorModel, malformedIconCalls[0], 'color'),
    colorExpression(malformedColorModel, malformedTextCalls[1], 'color'),
    colorExpression(malformedColorModel, malformedEdit, 'bgColor')
  ];
  check('partial, duplicate, unknown-key, non-static, and mutated literal tables fail closed',
    negativeColors.every(candidate => candidate?.kind === 'unresolved'
      && candidate.resolution === 'unresolved'
      && typeof candidate.reason === 'string'
      && candidate.source.start.offset < candidate.source.end.offset),
    detail(negativeColors));

  const validAliasColor = colorExpression(malformedColorModel, malformedIconCalls[1], 'color');
  const validAliasExpression = 'validAlias';
  check('unmutated local literal aliases preserve source-owned color evidence',
    validAliasColor?.kind === 'literal-table'
      && exactProbeSource(malformedColorSource, validAliasColor, validAliasExpression)
      && validAliasColor.expression === validAliasExpression,
    detail(validAliasColor));

  const tokSource = [
    'local key = runtimeKey',
    'local flag = true',
    'local TOK = {',
    '  frame = { r = 0.11, g = 0.12, b = 0.13, a = 0.14 },',
    '  table = { r = 0.21, g = 0.22, b = 0.23, a = 0.24 },',
    '  nested = { text = { r = 0.31, g = 0.32, b = 0.33, a = 0.34 } },',
    '  cell = { r = 0.41, g = 0.42, b = 0.43, a = 0.44 },',
    '  button = { r = 0.51, g = 0.52, b = 0.53, a = 0.54 },',
    '  highlight = { r = 0.61, g = 0.62, b = 0.63, a = 0.64 },',
    '  border = { r = 0.71, g = 0.72, b = 0.73, a = 0.74 },',
    '  edit = { r = 0.81, g = 0.82, b = 0.83, a = 0.84 },',
    '  icon = { r = 0.91, g = 0.92, b = 0.93, a = 0.94 }',
    '}',
    'local stableAlias = TOK.button',
    'local tokMenu = { name = "AIC-shaped", layer = 1 }',
    'local tokFrame = Helper.createFrameHandle(tokMenu, {})',
    'tokFrame:setBackground("frame", { color = TOK.frame })',
    'local tokTable = tokFrame:addTable(1, { backgroundColor = TOK["table"] })',
    'local tokRow = tokTable:addRow(true, {})',
    'tokRow[1]:createText("member", { color = TOK.nested.text, cellBGColor = TOK["cell"] })',
    'tokRow[2]:createButton({ bgColor = stableAlias, highlightColor = TOK["highlight"], borderColor = TOK.border })',
    'tokRow[3]:createEditBox({ bgColor = TOK.edit })',
    'tokRow[4]:createIcon("icon", { color = TOK.icon })',
    'local beforeMutation = { r = 1.01, g = 1.02, b = 1.03, a = 1.04 }',
    'tokRow[5]:createIcon("before", { color = beforeMutation })',
    'beforeMutation.r = 1.99',
    'tokRow[6]:createIcon("after", { color = beforeMutation })',
    'local aliasMutation = TOK.button',
    'aliasMutation.g = 1.98',
    'tokRow[7]:createIcon("alias-mutation", { color = aliasMutation })',
    'local branchMutation = { r = 2.01, g = 2.02, b = 2.03, a = 2.04 }',
    'if flag then branchMutation.r = 2.99 end',
    'tokRow[8]:createIcon("branch", { color = branchMutation })',
    'local dynamicMutation = { r = 3.01, g = 3.02, b = 3.03, a = 3.04 }',
    'dynamicMutation[key] = 3.99',
    'tokRow[9]:createIcon("dynamic", { color = dynamicMutation })',
    'local partialTOK = { r = 4.01, g = 4.02, b = 4.03 }',
    'tokRow[10]:createText("partial", { color = partialTOK })',
    'local duplicateTOK = { r = 5.01, g = 5.02, b = 5.03, a = 5.04, r = 5.99 }',
    'tokRow[11]:createText("duplicate", { color = duplicateTOK })',
    'local unknownTOK = { r = 6.01, g = 6.02, b = 6.03, a = 6.04, extra = 6.99 }',
    'tokRow[12]:createText("unknown", { color = unknownTOK })',
    'local nonStaticTOK = { r = key, g = 7.02, b = 7.03, a = 7.04 }',
    'tokRow[13]:createText("non-static", { color = nonStaticTOK })',
    'local dynamicIndex = runtimeKey',
    'tokRow[14]:createIcon("dynamic-index", { color = TOK[dynamicIndex] })',
    'local Color = { ["local.id"] = TOK.frame }',
    'tokRow[15]:createIcon("shadowed-color", { color = Color["local.id"] })',
    'Color = TOK',
    'tokRow[16]:createIcon("reassigned-color", { color = Color["frame"] })'
  ].join('\n');
  const tokModel = buildX4UiCallModel(input(tokSource, 'selftest/aic-shaped-tok.lua'));
  const tokFrameCall = callContaining(tokModel, tokSource, 'setBackground', 'color = TOK.frame');
  const tokTableCall = callContaining(tokModel, tokSource, 'addTable', 'backgroundColor = TOK["table"]');
  const tokTextCall = callContaining(tokModel, tokSource, 'createText', 'color = TOK.nested.text');
  const tokButtonCall = callContaining(tokModel, tokSource, 'createButton', 'bgColor = stableAlias');
  const tokEditCall = callContaining(tokModel, tokSource, 'createEditBox', 'bgColor = TOK.edit');
  const tokIconCall = callContaining(tokModel, tokSource, 'createIcon', 'color = TOK.icon');
  const tokLiteralSpecs = [
    { callRecord: tokFrameCall, propertyName: 'color', use: 'TOK.frame', declaration: '{ r = 0.11, g = 0.12, b = 0.13, a = 0.14 }', channels: [0.11, 0.12, 0.13, 0.14] as [number, number, number, number] },
    { callRecord: tokTableCall, propertyName: 'backgroundColor', use: 'TOK["table"]', declaration: '{ r = 0.21, g = 0.22, b = 0.23, a = 0.24 }', channels: [0.21, 0.22, 0.23, 0.24] as [number, number, number, number] },
    { callRecord: tokTextCall, propertyName: 'color', use: 'TOK.nested.text', declaration: '{ r = 0.31, g = 0.32, b = 0.33, a = 0.34 }', channels: [0.31, 0.32, 0.33, 0.34] as [number, number, number, number] },
    { callRecord: tokTextCall, propertyName: 'cellBGColor', use: 'TOK["cell"]', declaration: '{ r = 0.41, g = 0.42, b = 0.43, a = 0.44 }', channels: [0.41, 0.42, 0.43, 0.44] as [number, number, number, number] },
    { callRecord: tokButtonCall, propertyName: 'bgColor', use: 'stableAlias', declaration: '{ r = 0.51, g = 0.52, b = 0.53, a = 0.54 }', channels: [0.51, 0.52, 0.53, 0.54] as [number, number, number, number] },
    { callRecord: tokButtonCall, propertyName: 'highlightColor', use: 'TOK["highlight"]', declaration: '{ r = 0.61, g = 0.62, b = 0.63, a = 0.64 }', channels: [0.61, 0.62, 0.63, 0.64] as [number, number, number, number] },
    { callRecord: tokButtonCall, propertyName: 'borderColor', use: 'TOK.border', declaration: '{ r = 0.71, g = 0.72, b = 0.73, a = 0.74 }', channels: [0.71, 0.72, 0.73, 0.74] as [number, number, number, number] },
    { callRecord: tokEditCall, propertyName: 'bgColor', use: 'TOK.edit', declaration: '{ r = 0.81, g = 0.82, b = 0.83, a = 0.84 }', channels: [0.81, 0.82, 0.83, 0.84] as [number, number, number, number] },
    { callRecord: tokIconCall, propertyName: 'color', use: 'TOK.icon', declaration: '{ r = 0.91, g = 0.92, b = 0.93, a = 0.94 }', channels: [0.91, 0.92, 0.93, 0.94] as [number, number, number, number] }
  ];
  const tokLiteralEntries = tokLiteralSpecs.map(spec => ({
    ...spec,
    entry: colorEntry(tokModel, spec.callRecord, spec.propertyName),
    expression: colorExpression(tokModel, spec.callRecord, spec.propertyName)
  }));
  check('AIC-shaped TOK member/index uses cover all six color-bearing properties with declaration-owned evidence',
    new Set(tokLiteralSpecs.map(spec => spec.propertyName)).size === 6
      && tokLiteralEntries.every(spec => literalEvidence(
        tokSource,
        spec.expression,
        spec.use,
        spec.declaration,
        spec.channels,
      ))
      && tokLiteralEntries.every(spec => spec.entry?.source.start.offset === spec.expression?.source.start.offset
        && spec.entry?.source.end.offset === spec.expression?.source.end.offset),
    detail(tokLiteralEntries));

  const beforeMutationCall = callContaining(tokModel, tokSource, 'createIcon', 'color = beforeMutation');
  const afterMutationCall = callContaining(tokModel, tokSource, 'createIcon', 'color = beforeMutation', (beforeMutationCall?.source.end.offset || 0) + 1);
  const aliasMutationCall = callContaining(tokModel, tokSource, 'createIcon', 'color = aliasMutation');
  const branchMutationCall = callContaining(tokModel, tokSource, 'createIcon', 'color = branchMutation');
  const dynamicMutationCall = callContaining(tokModel, tokSource, 'createIcon', 'color = dynamicMutation');
  const partialTOKCall = callContaining(tokModel, tokSource, 'createText', 'color = partialTOK');
  const duplicateTOKCall = callContaining(tokModel, tokSource, 'createText', 'color = duplicateTOK');
  const unknownTOKCall = callContaining(tokModel, tokSource, 'createText', 'color = unknownTOK');
  const nonStaticTOKCall = callContaining(tokModel, tokSource, 'createText', 'color = nonStaticTOK');
  const dynamicIndexCall = callContaining(tokModel, tokSource, 'createIcon', 'color = TOK[dynamicIndex]');
  const shadowedColorCall = callContaining(tokModel, tokSource, 'createIcon', 'color = Color["local.id"]');
  const reassignedColorCall = callContaining(tokModel, tokSource, 'createIcon', 'color = Color["frame"]');
  const mutationNegativeExpressions = [
    colorExpression(tokModel, afterMutationCall, 'color'),
    colorExpression(tokModel, aliasMutationCall, 'color'),
    colorExpression(tokModel, branchMutationCall, 'color'),
    colorExpression(tokModel, dynamicMutationCall, 'color'),
    colorExpression(tokModel, partialTOKCall, 'color'),
    colorExpression(tokModel, duplicateTOKCall, 'color'),
    colorExpression(tokModel, unknownTOKCall, 'color'),
    colorExpression(tokModel, nonStaticTOKCall, 'color'),
    colorExpression(tokModel, dynamicIndexCall, 'color'),
    colorExpression(tokModel, shadowedColorCall, 'color'),
    colorExpression(tokModel, reassignedColorCall, 'color')
  ];
  check('use-before-mutation stays exact while pre-use mutation and unsupported TOK/Color shapes remain unresolved',
    literalEvidence(tokSource, colorExpression(tokModel, beforeMutationCall, 'color'), 'beforeMutation', '{ r = 1.01, g = 1.02, b = 1.03, a = 1.04 }', [1.01, 1.02, 1.03, 1.04])
      && mutationNegativeExpressions.every(candidate => candidate?.kind === 'unresolved'
        && candidate.resolution === 'unresolved'
        && typeof candidate.reason === 'string'
        && candidate.source.start.offset < candidate.source.end.offset)
      && exactProbeSource(tokSource, colorExpression(tokModel, dynamicIndexCall, 'color'), 'TOK[dynamicIndex]')
      && exactProbeSource(tokSource, colorExpression(tokModel, shadowedColorCall, 'color'), 'Color["local.id"]')
      && exactProbeSource(tokSource, colorExpression(tokModel, reassignedColorCall, 'color'), 'Color["frame"]'),
    detail({ before: colorExpression(tokModel, beforeMutationCall, 'color'), negatives: mutationNegativeExpressions }));

  const colorEvidence = [literalColor, symbolicColor, dynamicColor, conditionalColor, functionColor, scalarColor, explicitGlowColor, editColor, iconColor];
  const colorSidecar = colorModel.colorExpressions;
  const repeatedColorModel = buildX4UiCallModel(input(colorSource, 'selftest/color-expressions.lua'));
  const repeatedLiteralColor = colorExpression(repeatedColorModel, call(repeatedColorModel, 'setBackground'), 'color');
  const colorProjections = colorModel.calls.flatMap(candidate => candidate.semantics.properties || []);
  const ownershipKeys = colorSidecar.map(entry => [
    entry.callName,
    entry.propertyName,
    entry.callSource.start.offset,
    entry.callSource.end.offset,
    entry.source.start.offset,
    entry.source.end.offset,
  ].join(':'));
  check('color sidecar is the sole enumerable closed authority with frozen serializable deterministic evidence',
    colorEvidence.every(candidate => closedFrozenData(candidate))
      && JSON.stringify(colorModel) === JSON.stringify(repeatedColorModel)
      && JSON.stringify(literalColor) === JSON.stringify(repeatedLiteralColor)
      && colorSidecar.length === 9
      && closedFrozenData(colorSidecar)
      && colorSidecar.every(entry => closedFrozenData(entry)
        && entry.source.start.offset === entry.colorExpression.source.start.offset
        && entry.source.end.offset === entry.colorExpression.source.end.offset)
      && new Set(ownershipKeys).size === ownershipKeys.length
      && colorProjections.every(projection => {
        const reflected = Reflect.ownKeys(projection);
        return JSON.stringify(reflected) === JSON.stringify(Object.keys(projection))
          && !reflected.includes('colorExpression');
      })
      && JSON.stringify(colorSidecar) === JSON.stringify(JSON.parse(JSON.stringify(colorSidecar)))
      && !colorSidecar.some(entry => entry.propertyName === 'backgroundColor'
        && entry.callName === 'createFrameHandle')
      && colorSidecar.some(entry => entry.propertyName === 'color'
        && entry.callName === 'setBackground'
        && entry.colorExpression.kind === 'literal-table')
      && colorSource === colorSourceBefore
      && colorModel.file.text === colorSource,
    detail({ colorEvidence, literalColor, repeatedLiteralColor, colorSidecar, ownershipKeys }));

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

  const localScaleSource = [
    'local menu = { name = "LocalScale", layer = 1 }',
    'local width = Helper.scaleX(530)',
    'local height = Helper.scaleY(436)',
    'local fontSize = Helper.scaleFont("Zekton", 14)',
    'local frame = Helper.createFrameHandle(menu, { width = width, height = height })',
    'local fontFrame = Helper.createFrameHandle(menu, { width = fontSize, height = fontSize })',
  ].join('\n');
  const localScaleModel = buildX4UiCallModel(input(localScaleSource, 'selftest/local-scale-result.lua'));
  const localScaleFrame = localScaleModel.calls.filter(candidate => candidate.name === 'createFrameHandle')[0];
  const localFontFrame = localScaleModel.calls.filter(candidate => candidate.name === 'createFrameHandle')[1];
  const localWidth = property(localScaleFrame, 'width')?.value;
  const localHeight = property(localScaleFrame, 'height')?.value;
  const localFontWidth = property(localFontFrame, 'width')?.value;
  const localWidthIdentity = localWidth?.directHelperScaleResult;
  const localHeightIdentity = localHeight?.directHelperScaleResult;
  check('direct local Helper scale results preserve use spelling/location with separate closed provenance',
    localWidth?.expression === 'width'
      && localHeight?.expression === 'height'
      && exactLocatedText(localScaleSource, { expression: localWidth.expression, source: localWidth.location }, 'width')
      && exactLocatedText(localScaleSource, { expression: localHeight.expression, source: localHeight.location }, 'height')
      && localWidthIdentity?.callName === 'scaleX'
      && localHeightIdentity?.callName === 'scaleY'
      && localWidthIdentity?.callExpression === 'Helper.scaleX(530)'
      && localHeightIdentity?.callExpression === 'Helper.scaleY(436)'
      && localWidthIdentity?.bindingName === 'width'
      && localHeightIdentity?.bindingName === 'height'
      && localScaleModel.aliases.filter(alias => alias.value.directHelperScaleResult).length === 3,
    detail({ width: localWidth, height: localHeight, fontWidth: localFontWidth, aliases: localScaleModel.aliases }));
  check('scaleFont local provenance is explicit and cannot be mistaken for X/Y scale geometry',
    localFontWidth?.expression === 'fontSize'
      && localFontWidth.directHelperScaleResult?.callName === 'scaleFont'
      && localFontWidth.directHelperScaleResult.callExpression === 'Helper.scaleFont("Zekton", 14)',
    detail({ fontWidth: localFontWidth }));

  const numericExpressionSource = [
    'local Helper = rawget(_G, "Helper")',
    'local function refreshHelper()',
    '  if not Helper then Helper = rawget(_G, "Helper") end',
    '  return Helper',
    'end',
    'local menu = { name = "NumericExpression", layer = 1 }',
    'function menu.createFrame()',
    '  refreshHelper()',
    '  local width = Helper.scaleX(530)',
    '  local height = Helper.scaleY(436)',
    '  local fontSize = Helper.scaleFont("Zekton", 14)',
    '  local x = ((Helper.viewWidth or 1920) - width) / 2',
    '  local y = ((Helper.viewHeight or 1080) - height) / 2',
    '  menu.frame = Helper.createFrameHandle(menu, { x = x, y = y, width = width, height = height })',
    'end',
  ].join('\n');
  const numericExpressionModel = buildX4UiCallModel(input(numericExpressionSource, 'selftest/numeric-expression.lua'));
  const numericExpressionFrame = numericExpressionModel.calls.find(candidate => candidate.name === 'createFrameHandle');
  const numericExpressionX = property(numericExpressionFrame, 'x')?.value;
  const numericExpressionY = property(numericExpressionFrame, 'y')?.value;
  const numericXDescriptor = numericExpressionX?.numericExpression;
  const numericYDescriptor = numericExpressionY?.numericExpression;
  const numericXRecord = numericXDescriptor as unknown as Record<string, unknown> | undefined;
  const numericYRecord = numericYDescriptor as unknown as Record<string, unknown> | undefined;
  const numericXLeft = numericXRecord?.left as Record<string, unknown> | undefined;
  const numericYLeft = numericYRecord?.left as Record<string, unknown> | undefined;
  const numericXOr = numericXLeft?.left as Record<string, unknown> | undefined;
  const numericYOr = numericYLeft?.left as Record<string, unknown> | undefined;
  const numericXOrLeft = numericXOr?.left as Record<string, unknown> | undefined;
  const numericYOrLeft = numericYOr?.left as Record<string, unknown> | undefined;
  const numericXRight = numericXLeft?.right as Record<string, unknown> | undefined;
  const numericYRight = numericYLeft?.right as Record<string, unknown> | undefined;
  check('closed numeric expressions preserve exact formula source, Helper pins, and direct scale aliases',
    numericExpressionX?.status === 'unknown'
      && numericExpressionY?.status === 'unknown'
      && numericXDescriptor?.kind === 'binary'
      && numericYDescriptor?.kind === 'binary'
      && numericXDescriptor?.expression === '((Helper.viewWidth or 1920) - width) / 2'
      && numericYDescriptor?.expression === '((Helper.viewHeight or 1080) - height) / 2'
      && numericXRecord?.operator === '/'
      && numericYRecord?.operator === '/'
      && numericXOr?.kind === 'or'
      && numericXOrLeft?.kind === 'helper-constant'
      && numericXOrLeft?.name === 'viewWidth'
      && numericXOrLeft?.receiver
      && (numericXOrLeft.receiver as Record<string, unknown>).origin === 'alias'
      && numericXRight?.kind === 'direct-helper-scale'
      && numericXRight?.identity
      && (numericXRight.identity as Record<string, unknown>).callName === 'scaleX'
      && numericYOr?.kind === 'or'
      && numericYOrLeft?.kind === 'helper-constant'
      && numericYOrLeft?.name === 'viewHeight'
      && numericYRight?.kind === 'direct-helper-scale'
      && (numericYRight.identity as Record<string, unknown>).callName === 'scaleY'
      && exactLocatedText(numericExpressionSource, numericXDescriptor && {
        expression: numericXDescriptor.expression,
        source: numericXDescriptor.source,
      }, numericXDescriptor?.expression || '')
      && exactLocatedText(numericExpressionSource, numericYDescriptor && {
        expression: numericYDescriptor.expression,
        source: numericYDescriptor.source,
      }, numericYDescriptor?.expression || '')
      && closedFrozenData(numericXDescriptor)
      && closedFrozenData(numericYDescriptor)
      && JSON.stringify(numericXDescriptor) === JSON.stringify(JSON.parse(JSON.stringify(numericXDescriptor)))
      && JSON.stringify(numericYDescriptor) === JSON.stringify(JSON.parse(JSON.stringify(numericYDescriptor))),
    detail({ x: numericExpressionX, y: numericExpressionY, helperAliases: numericExpressionModel.helperReceiverAliases }));
  check('numeric expression negative shapes remain unavailable and scaleFont stays non-geometry',
    !numericExpressionModel.aliases.some(alias => alias.name === 'x' && alias.value.numericExpression?.kind === 'direct-helper-scale')
      && !numericExpressionModel.aliases.some(alias => alias.name === 'y' && alias.value.numericExpression?.kind === 'direct-helper-scale')
      && numericExpressionModel.calls.filter(candidate => candidate.name === 'scaleFont')
        .every(candidate => candidate.semantics.scale?.fontsize?.sourceLiteral !== undefined
          && candidate.semantics.scale?.fontsize?.numericExpression === undefined)
      && numericExpressionModel.aliases
        .filter(alias => alias.name === 'fontSize')
        .every(alias => alias.value.directHelperScaleResult?.callName === 'scaleFont'
          && alias.value.numericExpression === undefined),
    detail({ aliases: numericExpressionModel.aliases, calls: numericExpressionModel.calls.filter(candidate => candidate.name === 'scaleFont') }));

  const numericMathSource = [
    'local menu = { name = "NumericMath", layer = 1 }',
    'local LAY = { plateL = 600 / 2560, plateR = 1650 / 2560 }',
    'function menu.display()',
    '  local floorValue = math.floor(Helper.viewWidth * LAY.plateL)',
    '  local ceilValue = math.ceil((Helper.viewHeight * LAY.plateR) + 0.5)',
    '  local minValue = math.min(floorValue, ceilValue, 1000)',
    '  local maxValue = math.max(1, minValue)',
    '  menu.frame = Helper.createFrameHandle(menu, { x = floorValue, y = ceilValue, width = maxValue, height = math.floor(2.5) })',
    'end',
  ].join('\n');
  const numericMathModel = buildX4UiCallModel(input(numericMathSource, 'selftest/numeric-math.lua'));
  const numericMathAliases = ['floorValue', 'ceilValue', 'minValue', 'maxValue']
    .map(name => numericMathModel.aliases.find(alias => alias.name === name)?.value);
  const numericMathKinds = numericMathAliases.map(value => value?.numericExpression?.kind);
  const numericMathNames = numericMathAliases.map(value => {
    const descriptor = value?.numericExpression as { readonly name?: string } | undefined;
    return descriptor?.name;
  });
  const numericMathTableFields: Record<string, unknown>[] = [];
  const collectNumericMathTableFields = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(collectNumericMathTableFields);
      return;
    }
    if (value === null || typeof value !== 'object') return;
    const record = value as Record<string, unknown>;
    if (record.kind === 'table-field') numericMathTableFields.push(record);
    Object.values(record).forEach(collectNumericMathTableFields);
  };
  numericMathAliases.slice(0, 2).forEach(value => collectNumericMathTableFields(value?.numericExpression));
  check('closed numeric math calls preserve every supported function, nested arithmetic, table-field provenance, and deep freeze',
    numericMathKinds.join(',') === 'math-call,math-call,math-call,math-call'
      && numericMathNames.join(',') === 'floor,ceil,min,max'
      && numericMathTableFields.length === 2
      && numericMathTableFields.every(field => field.base === 'LAY' && (field.property === 'plateL' || field.property === 'plateR'))
      && numericMathAliases.every(value => value?.numericExpression !== undefined && closedFrozenData(value.numericExpression))
      && numericMathSource.slice(
        numericMathAliases[0]?.numericExpression?.source.start.offset || 0,
        numericMathAliases[0]?.numericExpression?.source.end.offset || 0,
      ) === 'math.floor(Helper.viewWidth * LAY.plateL)',
    detail({
      kinds: numericMathKinds,
      names: numericMathNames,
      tableFields: numericMathTableFields.map(field => ({ base: field.base, property: field.property })),
      frozen: numericMathAliases.map(value => value?.numericExpression !== undefined && closedFrozenData(value.numericExpression)),
      source: numericMathSource.slice(
        numericMathAliases[0]?.numericExpression?.source.start.offset || 0,
        numericMathAliases[0]?.numericExpression?.source.end.offset || 0,
      ),
    }));

  const overriddenMathSource = [
    'math = { floor = function(v) return 999 end }',
    'local replacedGlobal = math.floor(1.5)',
    'math.floor = customFloor',
    'local replacedMember = math.floor(1.5)',
  ].join('\n');
  const overriddenMathModel = buildX4UiCallModel(input(
    overriddenMathSource,
    'selftest/numeric-math-overridden.lua',
  ));
  const overriddenMathAliases = ['replacedGlobal', 'replacedMember'].map(name =>
    overriddenMathModel.aliases.find(alias => alias.name === name));
  check('numeric math calls reject a source-overridden global math binding and supported member binding',
    overriddenMathAliases.every(alias => alias?.value.numericExpression === undefined),
    detail({
      aliases: overriddenMathAliases,
      gaps: overriddenMathModel.verificationGaps,
    }));

  const numericMathAuthoritySource = (
    mutationLines: readonly string[],
    mutationBeforeUse = true,
  ): string => [
    'local menu = { name = "NumericMathAuthority", layer = 4 }',
    'local customMath = { floor = function(v) return 999 end }',
    'local customFloor = function(v) return 999 end',
    'local function localMutate(t) t.floor = customFloor end',
    'function menu.display()',
    ...(mutationBeforeUse
      ? [...mutationLines.map(line => `  ${line}`), '  local x = math.floor(1.5)']
      : ['  local x = math.floor(1.5)', ...mutationLines.map(line => `  ${line}`)]),
    '  Helper.createFrameHandle(menu, { x = x, width = 80, height = 80, layer = 4 })',
    'end',
  ].join('\n');
  const numericMathAuthorityCases = [
    ['opaque math escape', ['mutate(math)']],
    ['rawset global math', ['rawset(_G, "math", customMath)']],
    ['rawset global math member', ['rawset(_G.math, "floor", customFloor)']],
    ['global math member assignment', ['_G.math.floor = customFloor']],
    ['global indexed math member assignment', ['_G["math"]["floor"] = customFloor']],
    ['math alias escape', ['local m = math', 'mutate(m)']],
    ['math wrapper escape', ['local w = { m = math }', 'mutate(w)']],
    ['same-file math escape', ['localMutate(math)']],
    ['same-file math wrapper escape', ['local w = { m = math }', 'localMutate(w)']],
    ['global environment escape', ['mutate(_G)']],
    ['global environment wrapper escape', ['local w = { g = _G }', 'mutate(w)']],
    ['math alias member assignment', ['local m = math', 'm.floor = customFloor']],
    ['global environment alias member assignment', ['local g = _G', 'g.math.floor = customFloor']],
    ['dynamic global environment assignment', ['_G[runtimeKey] = customMath']],
    ['dynamic math assignment control', ['math[runtimeKey] = customFloor']],
    ['rawget global math member assignment', ['local m = rawget(_G, "math")', 'm.floor = customFloor']],
    ['rawget aliased global math member assignment', ['local g = _G', 'local m = rawget(g, "math")', 'm.floor = customFloor']],
    ['rawget wrapped global math member assignment', ['local w = { _G }', 'local g = w[1]', 'local m = rawget(g, "math")', 'm.floor = customFloor']],
    ['rawget dynamic-wrapped global math member assignment', ['local w = { [runtimeKey] = _G }', 'local g = w[runtimeKey]', 'local m = rawget(g, "math")', 'm.floor = customFloor']],
    ['dynamic global read member assignment', ['local m = _G[runtimeKey]', 'm.floor = customFloor']],
    ['direct dynamic global read member assignment', ['_G[runtimeKey].floor = customFloor']],
    ['dynamic rawget global read member assignment', ['local m = rawget(_G, runtimeKey)', 'm.floor = customFloor']],
    ['rawget global math escape', ['local m = rawget(_G, "math")', 'mutate(m)']],
    ['implicit math wrapper member assignment', ['local w = { math }', 'local m = w[1]', 'm.floor = customFloor']],
    ['implicit global wrapper member assignment', ['local w = { _G }', 'local g = w[1]', 'g.math.floor = customFloor']],
    ['dynamic-key math wrapper member assignment', ['local w = { [runtimeKey] = math }', 'local m = w[runtimeKey]', 'm.floor = customFloor']],
    ['numeric-assignment math wrapper member assignment', ['local w = {}', 'w[1] = math', 'local m = w[1]', 'm.floor = customFloor']],
    ['rawget named math wrapper member assignment', ['local w = { m = math }', 'local m = rawget(w, "m")', 'm.floor = customFloor']],
    ['rawget implicit math wrapper member assignment', ['local w = { math }', 'local m = rawget(w, 1)', 'm.floor = customFloor']],
    ['nested implicit math wrapper member assignment', ['local w = { { math } }', 'local inner = w[1]', 'local m = inner[1]', 'm.floor = customFloor']],
    ['conditional math introduction', ['local m = {}', 'if runtimeCondition then m = math end', 'm.floor = customFloor']],
    ['conditional math removal', ['local m = math', 'if runtimeCondition then m = {} end', 'm.floor = customFloor']],
    ['logical math selection', ['local m = runtimeCondition and math or {}', 'm.floor = customFloor']],
    ['conditional math escape', ['if runtimeCondition then mutate(math) end']],
  ] as const;
  const numericMathAuthorityFrameX = (authorityModel: ReturnType<typeof buildX4UiCallModel>) =>
    authorityModel.calls.find(candidate => candidate.name === 'createFrameHandle')?.semantics.properties
      ?.find(candidate => candidate.name === 'x')?.value;
  const numericMathAuthorityFacts = numericMathAuthorityCases.map(([name, lines]) => {
    const authorityModel = buildX4UiCallModel(input(
      numericMathAuthoritySource(lines),
      `selftest/numeric-math-authority-${name.replaceAll(' ', '-')}.lua`,
    ));
    return {
      name,
      x: numericMathAuthorityFrameX(authorityModel),
    };
  });
  const numericMathPostUseFacts = [
    ['global escape', ['mutate(_G)']],
    ['rawget math mutation', ['local m = rawget(_G, "math")', 'm.floor = customFloor']],
    ['conditional authority mutation', ['local m = {}', 'if runtimeCondition then m = math end', 'm.floor = customFloor']],
  ].map(([name, lines]) => ({
    name,
    x: numericMathAuthorityFrameX(buildX4UiCallModel(input(
      numericMathAuthoritySource(lines as readonly string[], false),
      `selftest/numeric-math-authority-post-use-${String(name).replaceAll(' ', '-')}.lua`,
    ))),
  }));
  const numericMathSafeReadCases = [
    ['exact rawget math', ['local m = rawget(_G, "math")']],
    ['aliased rawget math', ['local g = _G', 'local m = rawget(g, "math")']],
    ['wrapped rawget math', ['local w = { _G }', 'local g = w[1]', 'local m = rawget(g, "math")']],
    ['dynamic global read', ['local m = _G[runtimeKey]']],
    ['dynamic rawget global read', ['local m = rawget(_G, runtimeKey)']],
    ['implicit wrapper read', ['local w = { math }', 'local m = w[1]']],
    ['conditional authority read', ['local m = {}', 'if runtimeCondition then m = math end']],
    ['logical authority read', ['local m = runtimeCondition and math or {}']],
    ['static non-math global read', ['local v = _G["string"]']],
    ['static non-authority wrapper rawget', ['local w = { v = 1 }', 'local v = rawget(w, "v")']],
    ['exact Helper rawget', ['local SafeHelper = rawget(_G, "Helper")']],
  ] as const;
  const numericMathSafeReadFacts = numericMathSafeReadCases.map(([name, lines]) => ({
    name,
    x: numericMathAuthorityFrameX(buildX4UiCallModel(input(
      numericMathAuthoritySource(lines),
      `selftest/numeric-math-authority-safe-read-${name.replaceAll(' ', '-')}.lua`,
    ))),
  }));
  check('source-visible math/_G mutation, alias, wrapper, dynamic-key, and conditional authority paths fail closed in source order',
    numericMathAuthorityFacts.every(candidate =>
      candidate.x !== undefined
        && candidate.x.status !== 'static'
        && candidate.x.numericExpression === undefined)
      && numericMathPostUseFacts.every(candidate =>
        candidate.x?.status === 'static'
          && candidate.x.value === 1
          && candidate.x.numericExpression?.kind === 'math-call'),
    detail({ rejected: numericMathAuthorityFacts, postUse: numericMathPostUseFacts }));
  check('exact, dynamic, wrapper, conditional, non-math, and Helper authority reads stay pure until mutation or escape',
    numericMathSafeReadFacts.every(candidate =>
      candidate.x?.status === 'static'
        && candidate.x.value === 1
        && candidate.x.numericExpression?.kind === 'math-call'),
    detail({ safeReads: numericMathSafeReadFacts }));

  const escapedNumericTableSource = [
    'local LAY = { plateL = 600 / 2560 }',
    'local beforeEscape = math.floor(100 * LAY.plateL)',
    'mutate(LAY)',
    'local afterEscape = math.floor(100 * LAY.plateL)',
  ].join('\n');
  const escapedNumericTableModel = buildX4UiCallModel(input(
    escapedNumericTableSource,
    'selftest/numeric-math-escaped-table.lua',
  ));
  const beforeEscapeAlias = escapedNumericTableModel.aliases.find(alias => alias.name === 'beforeEscape');
  const afterEscapeAlias = escapedNumericTableModel.aliases.find(alias => alias.name === 'afterEscape');
  check('numeric table-field provenance is source-ordered and stops after the source table escapes to an opaque call',
    beforeEscapeAlias?.value.numericExpression?.kind === 'math-call'
      && afterEscapeAlias?.value.numericExpression === undefined,
    detail({ beforeEscape: beforeEscapeAlias, afterEscape: afterEscapeAlias }));

  const localHelperNumericSource = (mutationBeforeUse: boolean): string => [
    'local menu = { name = "LocalHelperNumeric", layer = 4 }',
    'local function mutate(t)',
    '  t.plateL = 0.9',
    'end',
    'local LAY = { plateL = 600 / 2560 }',
    'function menu.display()',
    ...(mutationBeforeUse
      ? [
        '  mutate(LAY)',
        '  local x = math.floor(100 * LAY.plateL)',
      ]
      : [
        '  local x = math.floor(100 * LAY.plateL)',
        '  mutate(LAY)',
      ]),
    '  local frame = Helper.createFrameHandle(menu, { x = x, width = 80, height = 80, layer = 4 })',
    'end',
  ].join('\n');
  const localHelperBeforeUseModel = buildX4UiCallModel(input(
    localHelperNumericSource(true),
    'selftest/numeric-math-local-helper-before-use.lua',
  ));
  const localHelperAfterUseModel = buildX4UiCallModel(input(
    localHelperNumericSource(false),
    'selftest/numeric-math-local-helper-after-use.lua',
  ));
  const frameXValue = (model: typeof localHelperBeforeUseModel) =>
    model.calls.find(candidate => candidate.name === 'createFrameHandle')?.semantics.properties
      ?.find(candidate => candidate.name === 'x')?.value;
  const localHelperBeforeUseX = frameXValue(localHelperBeforeUseModel);
  const localHelperAfterUseX = frameXValue(localHelperAfterUseModel);
  check('same-file local helper numeric-table mutation invalidates only later source uses while preserving earlier x=23',
    (localHelperBeforeUseX?.status === 'dynamic' || localHelperBeforeUseX?.status === 'unknown')
      && localHelperBeforeUseX?.numericExpression === undefined
      && localHelperAfterUseX?.status === 'static'
      && localHelperAfterUseX.value === 23
      && localHelperAfterUseX.numericExpression?.kind === 'math-call'
      && localHelperBeforeUseModel.localInvocations.some(invocation =>
        invocation.calleeExpression === 'mutate'
          && invocation.status === 'supported'),
    detail({
      beforeUse: localHelperBeforeUseX,
      afterUse: localHelperAfterUseX,
      invocations: localHelperBeforeUseModel.localInvocations,
    }));

  const wrappedNumericSource = (
    wrapperExpression: string,
    localHelper: boolean,
    mutationBeforeUse: boolean,
    dynamicAssignment = false,
    layExpression = '{ plateL = 600 / 2560 }',
  ): string => [
    'local menu = { name = "WrappedLocalHelperNumeric", layer = 4 }',
    ...(localHelper
      ? [
        'local function mutate(t)',
        '  t.lay.plateL = 0.9',
        'end',
      ]
      : []),
    `local LAY = ${layExpression}`,
    `local wrapper = ${wrapperExpression}`,
    ...(dynamicAssignment
      ? [
        'wrapper[runtimeKey] = LAY',
        'wrapper.self = wrapper',
      ]
      : []),
    'function menu.display()',
    ...(mutationBeforeUse
      ? [
        '  mutate(wrapper)',
        '  local x = math.floor(100 * LAY.plateL)',
      ]
      : [
        '  local x = math.floor(100 * LAY.plateL)',
        '  mutate(wrapper)',
      ]),
    '  local frame = Helper.createFrameHandle(menu, { x = x, width = 80, height = 80, layer = 4 })',
    'end',
  ].join('\n');
  const wrappedCallCases = [
    {
      name: 'opaque named field',
      model: buildX4UiCallModel(input(
        wrappedNumericSource('{ lay = LAY }', false, true),
        'selftest/numeric-math-opaque-wrapper.lua',
      )),
    },
    {
      name: 'local helper named field',
      model: buildX4UiCallModel(input(
        wrappedNumericSource('{ lay = LAY }', true, true),
        'selftest/numeric-math-local-helper-wrapper.lua',
      )),
    },
    {
      name: 'local helper implicit array',
      model: buildX4UiCallModel(input(
        wrappedNumericSource('{ LAY }', true, true),
        'selftest/numeric-math-local-helper-array-wrapper.lua',
      )),
    },
    {
      name: 'local helper nested array',
      model: buildX4UiCallModel(input(
        wrappedNumericSource('{ { LAY } }', true, true),
        'selftest/numeric-math-local-helper-nested-array-wrapper.lua',
      )),
    },
    {
      name: 'local helper dynamic-key constructor',
      model: buildX4UiCallModel(input(
        wrappedNumericSource('{ [runtimeKey] = LAY }', true, true),
        'selftest/numeric-math-local-helper-dynamic-key-wrapper.lua',
      )),
    },
    {
      name: 'local helper dynamic-key assignment cycle',
      model: buildX4UiCallModel(input(
        wrappedNumericSource('{}', true, true, true),
        'selftest/numeric-math-local-helper-dynamic-assignment-cycle.lua',
      )),
    },
    {
      name: 'opaque name-bearing numeric descendant',
      model: buildX4UiCallModel(input(
        wrappedNumericSource('{ lay = LAY }', false, true, false, '{ name = "LAY", plateL = 600 / 2560 }'),
        'selftest/numeric-math-opaque-name-bearing-wrapper.lua',
      )),
    },
    {
      name: 'local helper name-bearing numeric descendant',
      model: buildX4UiCallModel(input(
        wrappedNumericSource('{ lay = LAY }', true, true, false, '{ name = "LAY", plateL = 600 / 2560 }'),
        'selftest/numeric-math-local-helper-name-bearing-wrapper.lua',
      )),
    },
  ];
  const wrappedCallAfterUseModel = buildX4UiCallModel(input(
    wrappedNumericSource('{ [runtimeKey] = LAY }', true, false),
    'selftest/numeric-math-local-helper-dynamic-key-after-use.lua',
  ));
  const wrappedFrameXValue = (model: ReturnType<typeof buildX4UiCallModel>) =>
    model.calls.find(candidate => candidate.name === 'createFrameHandle')?.semantics.properties
      ?.find(candidate => candidate.name === 'x')?.value;
  const wrappedCallFacts = wrappedCallCases.map(candidate => ({
    name: candidate.name,
    value: wrappedFrameXValue(candidate.model),
    invocation: candidate.model.localInvocations[0]?.status,
  }));
  const wrappedCallAfterUseX = wrappedFrameXValue(wrappedCallAfterUseModel);
  check('opaque and local-helper escapes recursively invalidate named, array, dynamic-key, and cyclic numeric table descendants',
    wrappedCallFacts.every(candidate =>
      (candidate.value?.status === 'dynamic' || candidate.value?.status === 'unknown')
        && candidate.value.numericExpression === undefined)
      && wrappedCallFacts.filter(candidate => candidate.name.startsWith('opaque'))
        .every(candidate => candidate.invocation === 'unsupported')
      && wrappedCallFacts.filter(candidate => !candidate.name.startsWith('opaque'))
        .every(candidate => candidate.invocation === 'supported')
      && wrappedCallAfterUseX?.status === 'static'
      && wrappedCallAfterUseX.value === 23
      && wrappedCallAfterUseX.numericExpression?.kind === 'math-call',
    detail({ beforeUse: wrappedCallFacts, afterUse: wrappedCallAfterUseX }));

  const reachabilitySnapshotSource = [
    'local LAY = { plateL = 600 / 2560 }',
    'local wrapper = { { [runtimeKey] = LAY } }',
    'wrapper.self = wrapper',
    'do',
    '  local LAY = 0',
    '  local function dormantAnalysis()',
    '    mutate(wrapper)',
    '  end',
    'end',
    'local beforeConditionalEscape = math.floor(100 * LAY.plateL)',
    'if runtimeCondition then',
    '  mutate(wrapper)',
    'end',
    'do',
    '  local LAY = 0',
    '  local function unrelatedAnalysis()',
    '    return true',
    '  end',
    'end',
    'local afterConditionalEscape = math.floor(100 * LAY.plateL)',
  ].join('\n');
  const reachabilitySnapshotModel = buildX4UiCallModel(input(
    reachabilitySnapshotSource,
    'selftest/numeric-table-reachability-snapshot.lua',
  ));
  const beforeConditionalEscape = reachabilitySnapshotModel.aliases.find(alias => alias.name === 'beforeConditionalEscape')?.value;
  const afterConditionalEscape = reachabilitySnapshotModel.aliases.find(alias => alias.name === 'afterConditionalEscape')?.value;
  check('reachable-only cyclic descendants restore after dormant function analysis but retain conservative conditional escape state',
    beforeConditionalEscape?.status === 'static'
      && beforeConditionalEscape.value === 23
      && beforeConditionalEscape.numericExpression?.kind === 'math-call'
      && afterConditionalEscape?.status !== 'static'
      && afterConditionalEscape?.numericExpression === undefined,
    detail({ beforeConditionalEscape, afterConditionalEscape }));

  const spacedNumericMathSource = [
    'local spaced = math  .  floor(1.5)',
    'local commented = math --[[ exact global ]] . --[[ exact member ]] floor(1.5)',
  ].join('\n');
  const spacedNumericMathModel = buildX4UiCallModel(input(
    spacedNumericMathSource,
    'selftest/numeric-math-spaced.lua',
  ));
  const spacedNumericMathAliases = ['spaced', 'commented'].map(name =>
    spacedNumericMathModel.aliases.find(alias => alias.name === name)?.value.numericExpression);
  check('numeric math callee authority accepts parser-valid source whitespace and comments without canonical spelling',
    spacedNumericMathModel.parsed
      && spacedNumericMathAliases.every(expression => expression?.kind === 'math-call')
      && spacedNumericMathAliases.map(expression => expression?.calleeExpression).join('|')
        === 'math  .  floor|math --[[ exact global ]] . --[[ exact member ]] floor',
    detail({ parsed: spacedNumericMathModel.parsed, expressions: spacedNumericMathAliases }));

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

  const b119Source = [
    'local menu = { name = "B119", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(1, { width = 100 })',
    'table:setDefaultCellProperties("editbox", { height = 17, scaling = false, x = 0, y = 4, extra = "simple" })',
    'table:setDefaultComplexCellProperties("editbox", "hotkey", { hotkey = "INPUT_STATE_DEFAULT", displayIcon = true, x = 0, y = 5, extra = "complex" })',
    'local row = table:addRow(false, {})',
    'local editbox = row[1]:createEditBox({})',
    'editbox:setHotkey("INPUT_STATE_DIRECT", { hotkey = "", displayIcon = false, x = 0, y = 6, extra = "direct" })',
  ].join('\n');
  const b119 = buildX4UiCallModel(input(b119Source, 'selftest/b119-editbox-height.lua'));
  const b119Calls = b119.calls.filter(candidate =>
    candidate.name === 'setDefaultCellProperties'
      || candidate.name === 'setDefaultComplexCellProperties'
      || candidate.name === 'createEditBox'
      || candidate.name === 'setHotkey');
  const b119Simple = b119Calls.find(candidate => candidate.name === 'setDefaultCellProperties');
  const b119Complex = b119Calls.find(candidate => candidate.name === 'setDefaultComplexCellProperties');
  const b119Create = b119Calls.find(candidate => candidate.name === 'createEditBox');
  const b119Direct = b119Calls.find(candidate => candidate.name === 'setHotkey');
  const b119Unsupported = [b119Simple, b119Complex, b119Direct].map(candidate => candidate?.semantics.unsupportedProperties?.map(property => ({
    name: property.name,
    expression: property.value.expression,
    sourceOrder: property.sourceOrder,
    source: property.source,
  })) || []);
  check('B119 editbox height source calls retain exact ordered ownership and fields',
    b119Calls.map(candidate => candidate.name).join(',') === 'setDefaultCellProperties,setDefaultComplexCellProperties,createEditBox,setHotkey'
      && b119Simple?.semantics.cellType?.value === 'editbox'
      && b119Simple.semantics.height?.value === 17
      && b119Simple.semantics.scaling?.value === false
      && b119Complex?.semantics.cellType?.value === 'editbox'
      && b119Complex.semantics.propertyName?.value === 'hotkey'
      && b119Complex.semantics.hotkey?.value === 'INPUT_STATE_DEFAULT'
      && b119Complex.semantics.displayIcon?.value === true
      && b119Create?.semantics.cell?.reference?.kind === 'cell'
      && b119Direct?.semantics.hotkey?.value === 'INPUT_STATE_DIRECT'
      && b119Direct.semantics.displayIcon?.value === false
      && b119Calls.every(candidate => candidate.source.file === 'selftest/b119-editbox-height.lua'),
    detail(b119Calls));
  check('B119 source retains ordered unmodeled properties without static x/y model gaps',
    JSON.stringify(b119Unsupported.map(properties => properties.map(property => property.name))) === JSON.stringify([
      ['x', 'y', 'extra'],
      ['x', 'y', 'extra'],
      ['x', 'y', 'extra'],
    ])
      && b119Unsupported.flat().every(property => property.sourceOrder === property.source.start.offset)
      && b119Unsupported.flat().every(property => property.expression
        === b119Source.slice(property.source.start.offset, property.source.end.offset))
      && b119Unsupported.every(properties => properties.every((property, index) => index === 0
        || properties[index - 1].sourceOrder < property.sourceOrder))
      && !b119.verificationGaps.some(gap => gap.category === 'property'),
    detail({ unsupported: b119Unsupported, verificationGaps: b119.verificationGaps }));

  const b119BoundarySource = [
    'local menu = { name = "B119Boundary", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(2, { width = 100 })',
    'table:setDefaultCellProperties("button", { height = 99 })',
    'table:setDefaultComplexCellProperties("editbox", "caption", { hotkey = "CAPTION", displayIcon = true })',
    'frame:setDefaultCellProperties("editbox", { height = 99 })',
    'table:setDefaultCellProperties("editbox", { height = getHeight() })',
    'table:setDefaultComplexCellProperties("editbox", getPropertyName(), { hotkey = getHotkey(), displayIcon = getDisplayIcon() })',
    'local row = table:addRow(false, {})',
    'local editbox = row[1]:createEditBox({})',
    'editbox:setHotkey("", {})',
    'editbox:setHotkey(getHotkey(), { displayIcon = false })',
  ].join('\n');
  const b119Boundary = buildX4UiCallModel(input(b119BoundarySource, 'selftest/b119-editbox-boundaries.lua'));
  const boundaryDefaults = b119Boundary.calls.filter(candidate =>
    candidate.name === 'setDefaultCellProperties' || candidate.name === 'setDefaultComplexCellProperties');
  const boundaryDirect = b119Boundary.calls.filter(candidate => candidate.name === 'setHotkey');
  const boundaryWrongReceiver = boundaryDefaults.find(candidate => candidate.receiver?.reference?.path === 'frame');
  const boundaryNonEditbox = boundaryDefaults.find(candidate => candidate.semantics.cellType?.value === 'button');
  const boundaryWrongProperty = boundaryDefaults.find(candidate => candidate.semantics.propertyName?.value === 'caption');
  const boundaryDynamicSimple = boundaryDefaults.find(candidate => candidate.name === 'setDefaultCellProperties'
    && candidate.semantics.height?.status === 'dynamic');
  const boundaryDynamicComplex = boundaryDefaults.find(candidate => candidate.name === 'setDefaultComplexCellProperties'
    && candidate.semantics.propertyName?.status === 'dynamic');
  check('B119 call-model boundaries keep non-editbox, wrong-property, wrong-receiver, and dynamic forms explicit',
    boundaryDefaults.length === 5
      && boundaryDirect.length === 2
      && boundaryNonEditbox?.semantics.cellType?.value === 'button'
      && boundaryWrongProperty?.semantics.propertyName?.value === 'caption'
      && boundaryWrongReceiver?.semantics.cellType?.value === 'editbox'
      && boundaryWrongReceiver.semantics.dataFlow?.status !== 'static'
      && boundaryDynamicSimple?.semantics.height?.status === 'dynamic'
      && boundaryDynamicComplex?.semantics.propertyName?.status === 'dynamic'
      && boundaryDynamicComplex.semantics.hotkey?.status === 'dynamic'
      && boundaryDirect[0]?.semantics.hotkey?.value === ''
      && boundaryDirect[1]?.semantics.hotkey?.status === 'dynamic'
      && boundaryDirect[1]?.semantics.displayIcon?.value === false,
    detail({ defaults: boundaryDefaults, direct: boundaryDirect }));

  const b119IrrelevantDynamicSource = [
    'local menu = { name = "B119IrrelevantDynamic", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(2, { width = 100, scaling = false })',
    'table:setDefaultCellProperties("button", { height = getHeight(), scaling = getScaling() })',
    'table:setDefaultComplexCellProperties("editbox", "caption", { hotkey = getHotkey(), displayIcon = getDisplayIcon() })',
    'local row = table:addRow(false, { scaling = false })',
    'local button = row[1]:createButton({ height = 25, scaling = false })',
    'button:setHotkey(getHotkey(), { displayIcon = getDisplayIcon() })',
    'row[2]:createEditBox({ height = 12, scaling = false })',
  ].join('\n');
  const b119IrrelevantDynamic = buildX4UiCallModel(input(
    b119IrrelevantDynamicSource,
    'selftest/b119-editbox-irrelevant-dynamic.lua',
  ));
  const b119RelevantDynamic = buildX4UiCallModel(input([
    'local menu = { name = "B119RelevantDynamic", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(1, { width = 100, scaling = false })',
    'table:setDefaultCellProperties(getCellType(), { height = getHeight(), scaling = getScaling() })',
    'table:setDefaultComplexCellProperties("editbox", getPropertyName(), { hotkey = getHotkey(), displayIcon = getDisplayIcon() })',
    'local row = table:addRow(false, { scaling = false })',
    'local editbox = row[1]:createEditBox({ height = 12, scaling = false })',
    'editbox:setHotkey(getHotkey(), { displayIcon = getDisplayIcon() })',
  ].join('\n'), 'selftest/b119-editbox-relevant-dynamic.lua'));
  check('B119 dynamic button defaults/hotkeys and literal wrong complex properties add no bounded editbox gaps',
    b119IrrelevantDynamic.verificationGaps.length === 0
      && b119IrrelevantDynamic.calls.filter(candidate => candidate.name === 'setDefaultCellProperties').length === 1
      && b119IrrelevantDynamic.calls.filter(candidate => candidate.name === 'setDefaultComplexCellProperties').length === 1
      && b119IrrelevantDynamic.calls.filter(candidate => candidate.name === 'setHotkey').length === 1,
    detail({ calls: b119IrrelevantDynamic.calls, gaps: b119IrrelevantDynamic.verificationGaps }));
  check('B119 dynamic editbox cell types/properties/hotkeys remain fail-closed model gaps',
    b119RelevantDynamic.verificationGaps.some(gap => gap.expression.includes('getCellType'))
      && b119RelevantDynamic.verificationGaps.some(gap => gap.expression.includes('getHeight'))
      && b119RelevantDynamic.verificationGaps.some(gap => gap.expression.includes('getPropertyName'))
      && b119RelevantDynamic.verificationGaps.some(gap => gap.expression.includes('getHotkey')),
    detail(b119RelevantDynamic.verificationGaps));

  const b119SourceProvenUnknownChainSource = [
    'local table = getTable()',
    'local row = table:addRow()',
    'row[1]:setColSpan(1):createEditBox({ height = 0 }):setText("EDIT", {}):setHotkey("CHAIN", { displayIcon = true })',
  ].join('\n');
  const b119SourceProvenUnknownChain = buildX4UiCallModel(input(
    b119SourceProvenUnknownChainSource,
    'selftest/b119-source-proven-unknown-chain.lua',
  ));
  const b119UnknownChainCreate = b119SourceProvenUnknownChain.calls.find(candidate => candidate.name === 'createEditBox');
  const b119UnknownChainHotkey = b119SourceProvenUnknownChain.calls.find(candidate => candidate.name === 'setHotkey');
  const b119UnknownChainHasExactCellAndStatement = Boolean(
    b119UnknownChainCreate
      && b119UnknownChainHotkey
      && b119UnknownChainCreate.semantics.cell?.status !== 'static'
      && b119UnknownChainHotkey.semantics.cell?.status !== 'static'
      && b119UnknownChainCreate.semantics.cell?.reference?.kind === 'cell'
      && b119UnknownChainHotkey.semantics.cell?.reference?.kind === 'cell'
      && sameReferenceIdentity(
        b119UnknownChainCreate.semantics.cell.reference,
        b119UnknownChainHotkey.semantics.cell.reference,
      )
      && sameSourceRange(enclosingStatement(b119UnknownChainCreate)?.source, enclosingStatement(b119UnknownChainHotkey)?.source)
      && b119UnknownChainHotkey.source.start.offset <= b119UnknownChainCreate.source.start.offset
      && b119UnknownChainHotkey.source.end.offset >= b119UnknownChainCreate.source.end.offset
      && b119SourceProvenUnknownChainSource.slice(
        b119UnknownChainHotkey.source.start.offset,
        b119UnknownChainHotkey.source.end.offset,
      ).includes('createEditBox'),
  );
  check('B119 source-proven chained editbox retains exact non-static cell identity and statement provenance',
    b119UnknownChainHasExactCellAndStatement,
    detail({
      create: b119UnknownChainCreate,
      hotkey: b119UnknownChainHotkey,
      gaps: b119SourceProvenUnknownChain.verificationGaps,
    }));

  const b119ButtonChainSource = [
    'local table = getTable()',
    'local row = table:addRow()',
    'row[1]:createButton({ height = 25 }):setText("BUTTON", {}):setHotkey(getHotkey(), { displayIcon = getDisplayIcon() })',
    'row[2]:createEditBox({})',
  ].join('\n');
  const b119ButtonChain = buildX4UiCallModel(input(
    b119ButtonChainSource,
    'selftest/b119-button-unknown-chain.lua',
  ));
  check('B119 nested button hotkey chain stays irrelevant to editbox model state',
    !b119ButtonChain.verificationGaps.some(gap => gap.category === 'edit-box')
      && !b119ButtonChain.verificationGaps.some(gap => gap.reason.includes('setHotkey receiver is tracked as button'))
      && b119ButtonChain.calls.filter(candidate => candidate.name === 'createButton').length === 1
      && b119ButtonChain.calls.filter(candidate => candidate.name === 'setHotkey').length === 1,
    detail({ calls: b119ButtonChain.calls, gaps: b119ButtonChain.verificationGaps }));

  const b119BranchResolvedButtonSource = [
    'local table = getTable()',
    'local row = table:addRow()',
    'if mode then',
    '  row[1]:createButton({ height = 25 }):setText("BUTTON", {}):setHotkey(getHotkey(), { displayIcon = getDisplayIcon() })',
    'end',
  ].join('\n');
  const b119BranchResolvedButton = buildX4UiCallModel(input(
    b119BranchResolvedButtonSource,
    'selftest/b119-branch-resolved-button.lua',
  ));
  const b119BranchResolvedHotkey = b119BranchResolvedButton.calls.find(candidate => candidate.name === 'setHotkey');
  check('B119 branch-resolved button hotkey retains cell semantics without edit-box receiver gaps',
    b119BranchResolvedHotkey?.semantics.cell?.reference?.kind === 'cell'
      && !b119BranchResolvedHotkey.semantics.dataFlow
      && !b119BranchResolvedButton.verificationGaps.some(gap => gap.category === 'edit-box')
      && !b119BranchResolvedButton.verificationGaps.some(gap => gap.reason.includes('edit-box used for setHotkey')),
    detail({ hotkey: b119BranchResolvedHotkey, gaps: b119BranchResolvedButton.verificationGaps }));

  const b119BranchMergedRowSource = [
    'local table = getTable()',
    'local row = table:addRow()',
    'if mode then',
    '  row = table:addRow()',
    'end',
    'row[1]:createButton({ height = 25 }):setText("BUTTON", {}):setHotkey(getHotkey(), { displayIcon = getDisplayIcon() })',
  ].join('\n');
  const b119BranchMergedRow = buildX4UiCallModel(input(
    b119BranchMergedRowSource,
    'selftest/b119-branch-merged-row.lua',
  ));
  const b119BranchMergedHotkey = b119BranchMergedRow.calls.find(candidate => candidate.name === 'setHotkey');
  check('B119 branch-merged row button chain has narrow button attribution',
    b119BranchMergedHotkey?.semantics.cell?.reference?.kind === 'cell'
      && !b119BranchMergedHotkey.semantics.dataFlow
      && !b119BranchMergedRow.verificationGaps.some(gap => gap.category === 'edit-box')
      && !b119BranchMergedRow.verificationGaps.some(gap => gap.reason.includes('edit-box used for setHotkey')),
    detail({ hotkey: b119BranchMergedHotkey, gaps: b119BranchMergedRow.verificationGaps }));

  const b119BranchMergedRowIconSource = [
    'local table = getTable()',
    'local row = table:addRow()',
    'if mode then',
    '  row = table:addRow()',
    'end',
    'row[1]:createButton({ height = 25 }):setIcon("ICON", {}):setHotkey(getHotkey(), { displayIcon = getDisplayIcon() })',
  ].join('\n');
  const b119BranchMergedRowIcon = buildX4UiCallModel(input(
    b119BranchMergedRowIconSource,
    'selftest/b119-branch-merged-row-icon.lua',
  ));
  const b119BranchMergedIconHotkey = b119BranchMergedRowIcon.calls.find(candidate => candidate.name === 'setHotkey');
  check('B119 branch-merged row setIcon button chain has narrow button attribution',
    b119BranchMergedIconHotkey?.semantics.cell?.reference?.kind === 'cell'
      && !b119BranchMergedIconHotkey.semantics.dataFlow
      && !b119BranchMergedRowIcon.verificationGaps.some(gap => gap.category === 'edit-box')
      && !b119BranchMergedRowIcon.verificationGaps.some(gap => gap.reason.includes('edit-box used for setHotkey'))
      && !b119BranchMergedRowIcon.calls.some(candidate => (candidate.name as string) === 'setIcon'),
    detail({
      hotkey: b119BranchMergedIconHotkey,
      calls: b119BranchMergedRowIcon.calls,
      gaps: b119BranchMergedRowIcon.verificationGaps,
    }));

  const b119BranchMergedRowIcon2Source = [
    'local table = getTable()',
    'local row = table:addRow()',
    'if mode then',
    '  row = table:addRow()',
    'end',
    'row[1]:createButton({ height = 25 }):setIcon2("ICON", {}):setHotkey(getHotkey(), { displayIcon = getDisplayIcon() })',
  ].join('\n');
  const b119BranchMergedRowIcon2 = buildX4UiCallModel(input(
    b119BranchMergedRowIcon2Source,
    'selftest/b119-branch-merged-row-icon2.lua',
  ));
  const b119BranchMergedIcon2Hotkey = b119BranchMergedRowIcon2.calls.find(candidate => candidate.name === 'setHotkey');
  check('B119 branch-merged row setIcon2 button chain has narrow button attribution',
    b119BranchMergedIcon2Hotkey?.semantics.cell?.reference?.kind === 'cell'
      && !b119BranchMergedIcon2Hotkey.semantics.dataFlow
      && !b119BranchMergedRowIcon2.verificationGaps.some(gap => gap.category === 'edit-box')
      && !b119BranchMergedRowIcon2.verificationGaps.some(gap => gap.reason.includes('edit-box used for setHotkey'))
      && !b119BranchMergedRowIcon2.calls.some(candidate => (candidate.name as string) === 'setIcon2'),
    detail({
      hotkey: b119BranchMergedIcon2Hotkey,
      calls: b119BranchMergedRowIcon2.calls,
      gaps: b119BranchMergedRowIcon2.verificationGaps,
    }));

  const b119ButtonChainNegativeSources = [
    {
      name: 'separate statements',
      source: [
        'local row = getRow()',
        'row[1]:createButton({ height = 25 }):setText("BUTTON", {})',
        'row[1]:setHotkey(getHotkey(), { displayIcon = getDisplayIcon() })',
      ].join('\n'),
    },
    {
      name: 'dot createButton call',
      source: [
        'local row = getRow()',
        'row[1].createButton({ height = 25 }):setText("BUTTON", {}):setHotkey(getHotkey(), { displayIcon = getDisplayIcon() })',
      ].join('\n'),
    },
    {
      name: 'unknown factory',
      source: [
        'local row = getRow()',
        'row[1]:makeButton({ height = 25 }):setText("BUTTON", {}):setHotkey(getHotkey(), { displayIcon = getDisplayIcon() })',
      ].join('\n'),
    },
    {
      name: 'sibling branches',
      source: [
        'local row = getRow()',
        'if mode then',
        '  row[1]:createButton({ height = 25 }):setText("BUTTON", {})',
        'else',
        '  row[1]:setHotkey(getHotkey(), { displayIcon = getDisplayIcon() })',
        'end',
      ].join('\n'),
    },
    {
      name: 'same-spelled distinct cells',
      source: [
        'local row = getRow()',
        'row[1]:createButton({ height = 25 }):setText("BUTTON", {})',
        'row[2]:setHotkey(getHotkey(), { displayIcon = getDisplayIcon() })',
      ].join('\n'),
    },
    {
      name: 'forged receiver',
      source: [
        'local row = getRow()',
        'local other = getRow()',
        'row[1]:createButton({ height = 25 }):setText("BUTTON", {})',
        'other[1]:setHotkey(getHotkey(), { displayIcon = getDisplayIcon() })',
      ].join('\n'),
    },
    {
      name: 'later createButton call',
      source: [
        'local row = getRow()',
        'row[1]:createButton({ height = 25 }):setText("BUTTON", {}):createButton({ height = 25 }):setHotkey(getHotkey(), { displayIcon = getDisplayIcon() })',
      ].join('\n'),
    },
    {
      name: 'arbitrary dynamic receiver',
      source: 'getRow()[1]:createButton({ height = 25 }):setText("BUTTON", {}):setHotkey(getHotkey(), { displayIcon = getDisplayIcon() })',
    },
    {
      name: 'arbitrary bound indexed value',
      source: [
        'local value = getRow()',
        'value[1]:createButton({ height = 25 }):setText("BUTTON", {}):setHotkey(getHotkey(), { displayIcon = getDisplayIcon() })',
      ].join('\n'),
    },
    {
      name: 'unknown fluent method',
      source: [
        'local row = getRow()',
        'row[1]:createButton({ height = 25 }):unknownSetter():setHotkey(getHotkey(), { displayIcon = getDisplayIcon() })',
      ].join('\n'),
    },
  ] as const;
  const b119ButtonChainNegatives = b119ButtonChainNegativeSources.map(candidate => ({
    ...candidate,
    model: buildX4UiCallModel(input(candidate.source, `selftest/b119-button-chain-negative-${candidate.name}.lua`)),
  }));
  check('B119 button attribution negatives remain conservative',
    b119ButtonChainNegatives.every(candidate => {
      const hotkey = candidate.model.calls.find(callRecord => callRecord.name === 'setHotkey');
      return Boolean(hotkey)
        && candidate.model.verificationGaps.some(gap => gap.reason.includes('edit-box used for setHotkey'))
        && candidate.model.verificationGaps.some(gap => gap.category === 'edit-box');
    }),
    detail(b119ButtonChainNegatives.map(candidate => ({
      name: candidate.name,
      hotkey: candidate.model.calls.find(callRecord => callRecord.name === 'setHotkey'),
      gaps: candidate.model.verificationGaps,
    }))));

  const b119ConditionalButtonIconSource = [
    'local table = getTable()',
    'local row = table:addRow()',
    'if mode then',
    '  row[1]:createButton({ height = 25 }):setIcon("ICON"):setHotkey(getHotkey(), { displayIcon = getDisplayIcon() })',
    'end',
    'row[2]:createEditBox({})',
  ].join('\n');
  const b119ConditionalButtonIcon = buildX4UiCallModel(input(
    b119ConditionalButtonIconSource,
    'selftest/b119-conditional-button-icon.lua',
  ));
  const b119ConditionalButtonIconHotkey = b119ConditionalButtonIcon.calls.find(candidate => candidate.name === 'setHotkey');
  check('B119 untracked self-returning setIcon preserves the source-proven button receiver',
    b119ConditionalButtonIconHotkey?.semantics.cell?.reference?.kind === 'cell'
      && !b119ConditionalButtonIconHotkey.semantics.dataFlow
      && !b119ConditionalButtonIcon.verificationGaps.some(gap => gap.category === 'edit-box')
      && !b119ConditionalButtonIcon.verificationGaps.some(gap => gap.reason.includes('edit-box used for setHotkey'))
      && !b119ConditionalButtonIcon.calls.some(candidate => (candidate.name as string) === 'setIcon'),
    detail({ hotkey: b119ConditionalButtonIconHotkey, calls: b119ConditionalButtonIcon.calls, gaps: b119ConditionalButtonIcon.verificationGaps }));

  const b119TrackedButtonIconChains = (['setIcon', 'setIcon2'] as const).map(method => {
    const source = [
      'local table = getTable()',
      'local row = table:addRow()',
      'local button = row[1]:createButton({ height = 25 })',
      `button:${method}("ICON", {}):setHotkey(getHotkey(), { displayIcon = getDisplayIcon() })`,
    ].join('\n');
    return {
      method,
      model: buildX4UiCallModel(input(source, `selftest/b119-tracked-button-${method}.lua`)),
    };
  });
  check('B119 tracked buttons preserve shipped setIcon and setIcon2 receivers',
    b119TrackedButtonIconChains.every(candidate => {
      const hotkey = candidate.model.calls.find(callRecord => callRecord.name === 'setHotkey');
      return hotkey?.semantics.cell?.reference?.kind === 'cell'
        && !hotkey.semantics.dataFlow
        && !candidate.model.verificationGaps.some(gap => gap.category === 'edit-box')
        && !candidate.model.verificationGaps.some(gap => gap.reason.includes('edit-box used for setHotkey'))
        && !candidate.model.calls.some(callRecord => (callRecord.name as string) === candidate.method);
    }),
    detail(b119TrackedButtonIconChains.map(candidate => ({
      method: candidate.method,
      hotkey: candidate.model.calls.find(callRecord => callRecord.name === 'setHotkey'),
      calls: candidate.model.calls,
      gaps: candidate.model.verificationGaps,
    }))));

  const b119InvalidEditBoxIconChains = (['setIcon', 'setIcon2'] as const).map(method => {
    const source = [
      'local table = getTable()',
      'local row = table:addRow()',
      `row[1]:createEditBox({ height = 0 }):${method}("ICON", {}):setHotkey("HOT", { displayIcon = true })`,
    ].join('\n');
    return {
      method,
      model: buildX4UiCallModel(input(source, `selftest/b119-invalid-editbox-${method}.lua`)),
    };
  });
  check('B119 editboxes cannot inherit button-only setIcon or setIcon2 receiver identity',
    b119InvalidEditBoxIconChains.every(candidate => {
      const hotkey = candidate.model.calls.find(callRecord => callRecord.name === 'setHotkey');
      return Boolean(hotkey?.semantics.dataFlow)
        && hotkey?.semantics.cell?.reference?.kind !== 'cell'
        && candidate.model.verificationGaps.some(gap => gap.category === 'data-flow'
          && gap.reason.includes('edit-box used for setHotkey'));
    }),
    detail(b119InvalidEditBoxIconChains.map(candidate => ({
      method: candidate.method,
      hotkey: candidate.model.calls.find(callRecord => callRecord.name === 'setHotkey'),
      gaps: candidate.model.verificationGaps,
    }))));

  const b119GenericDescriptorSource = [
    'local descriptor = {}',
    'descriptor.hotkey = getHotkey()',
    'descriptor.displayIcon = getDisplayIcon()',
  ].join('\n');
  const b119GenericDescriptor = buildX4UiCallModel(input(
    b119GenericDescriptorSource,
    'selftest/b119-generic-descriptor.lua',
  ));
  check('generic descriptor hotkey/displayIcon assignments stay outside bounded B119 property tracking',
    b119GenericDescriptor.verificationGaps.length === 0
      && !b119GenericDescriptor.properties.some(record => ['hotkey', 'displayicon'].includes(record.name.replace(/[-_\s]/g, '').toLowerCase())),
    detail({ properties: b119GenericDescriptor.properties, gaps: b119GenericDescriptor.verificationGaps }));
  check('bounded B119 option projection still exposes hotkey/displayIcon source fields',
    b119Complex?.semantics.properties?.some(propertyRecord => propertyRecord.name === 'hotkey') === true
      && b119Complex.semantics.properties?.some(propertyRecord => propertyRecord.name === 'displayIcon') === true,
    detail(b119Complex?.semantics));

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

  const provenanceSource = [
    'table:addRow(false, {}):createText("chain", {});',
    'local localRow = table:addRow(false, {})',
    'assigned = table:addRow(false, {})',
    'consume(table:addRow(false, {}))'
  ].join('\n');
  const provenanceModel = buildX4UiCallModel(input(provenanceSource, 'selftest/statement-provenance.lua'));
  const chainLine = 'table:addRow(false, {}):createText("chain", {});';
  const chainStart = provenanceSource.indexOf(chainLine);
  const chainExpression = chainLine.slice(0, -1);
  const chainEnd = chainStart + chainExpression.length;
  const chainCalls = provenanceModel.calls.filter(candidate => {
    const statement = enclosingStatement(candidate);
    return statement?.source.start.offset === chainStart && statement.source.end.offset === chainEnd;
  });
  const chainStatement = enclosingStatement(chainCalls.find(candidate => candidate.name === 'createText'));
  check('direct and fluent calls share exact immutable standalone-call provenance',
    JSON.stringify(chainCalls.map(candidate => candidate.name)) === JSON.stringify(['addRow', 'createText'])
      && chainStatement?.source.file === 'selftest/statement-provenance.lua'
      && chainStatement.source.sourcePath === 'fixture://selftest/statement-provenance.lua'
      && chainStatement.kind === 'call'
      && chainStatement.source.start.offset === chainStart
      && chainStatement.source.end.offset === chainEnd
      && chainStatement.source.start.line === 1
      && chainStatement.source.start.column === 0
      && chainStatement.source.end.line === 1
      && chainStatement.source.end.column === chainExpression.length
      && provenanceSource.slice(chainStatement.source.start.offset, chainStatement.source.end.offset) === chainExpression
      && provenanceSource[chainStatement.source.end.offset] === ';'
      && chainCalls.every(candidate => {
        const statement = enclosingStatement(candidate);
        return statement
          && statement.source.start.offset <= candidate.source.start.offset
          && statement.source.end.offset >= candidate.source.end.offset
          && Object.isFrozen(statement)
          && Object.isFrozen(statement.source)
          && Object.isFrozen(statement.source.start)
          && Object.isFrozen(statement.source.end);
      })
      && enclosingStatement(chainCalls.find(candidate => candidate.name === 'addRow'))?.isStandaloneCallStatementRoot === false
      && chainStatement.isStandaloneCallStatementRoot === true,
    detail({ chainCalls, chainStatement }));

  const localLine = 'local localRow = table:addRow(false, {})';
  const assignmentLine = 'assigned = table:addRow(false, {})';
  const argumentLine = 'consume(table:addRow(false, {}))';
  const localCall = callAt(provenanceModel, provenanceSource, 'table:addRow(false, {})', provenanceSource.indexOf(localLine));
  const assignmentCall = callAt(provenanceModel, provenanceSource, 'table:addRow(false, {})', provenanceSource.indexOf(assignmentLine));
  const argumentCall = callAt(provenanceModel, provenanceSource, 'table:addRow(false, {})', provenanceSource.indexOf(argumentLine));
  const localStatement = enclosingStatement(localCall);
  const assignmentStatement = enclosingStatement(assignmentCall);
  const argumentStatement = enclosingStatement(argumentCall);
  check('initializers and nested call arguments are never classified as standalone',
    localStatement?.kind === 'local'
      && assignmentStatement?.kind === 'assignment'
      && argumentStatement?.kind === 'call'
      && localStatement.isStandaloneCallStatementRoot === false
      && assignmentStatement.isStandaloneCallStatementRoot === false
      && argumentStatement.isStandaloneCallStatementRoot === false
      && provenanceSource.slice(localStatement.source.start.offset, localStatement.source.end.offset) === localLine
      && provenanceSource.slice(assignmentStatement.source.start.offset, assignmentStatement.source.end.offset) === assignmentLine
      && provenanceSource.slice(argumentStatement.source.start.offset, argumentStatement.source.end.offset) === argumentLine
      && new Set([chainStart, localStatement.source.start.offset, assignmentStatement.source.start.offset, argumentStatement.source.start.offset]).size === 4,
    detail({ localStatement, assignmentStatement, argumentStatement }));

  const contextSource = [
    'local table = {}',
    'local function returns()',
    '  return table:addRow(false, {})',
    'end',
    'if table:addRow(false, {}) then',
    '  table:createText("branch", {})',
    'end',
    'while table:addRow(false, {}) do',
    '  table:createText("loop", {})',
    'end',
    'for index = table:scaleX(1, true), table:scaleX(2, true) do',
    '  table:createText("numeric", {})',
    'end',
    'for key, item in pairs(table:addRow(false, {})) do',
    '  table:createText("generic", {})',
    'end',
    'consume(table:addRow(false, {}))',
    'row[1].handlers.onClick = function()',
    '  table:setText("handler", {})',
    'end'
  ].join('\n');
  const contextModel = buildX4UiCallModel(input(contextSource, 'selftest/statement-contexts.lua'));
  const contextExpectations = [
    { line: '  return table:addRow(false, {})', expression: 'table:addRow(false, {})', kind: 'return', standalone: false },
    { line: 'if table:addRow(false, {}) then', expression: 'table:addRow(false, {})', kind: 'if', standalone: false },
    { line: '  table:createText("branch", {})', expression: 'table:createText("branch", {})', kind: 'call', standalone: true },
    { line: 'while table:addRow(false, {}) do', expression: 'table:addRow(false, {})', kind: 'while', standalone: false },
    { line: '  table:createText("loop", {})', expression: 'table:createText("loop", {})', kind: 'call', standalone: true },
    { line: 'for index = table:scaleX(1, true), table:scaleX(2, true) do', expression: 'table:scaleX(1, true)', kind: 'numeric-for', standalone: false },
    { line: 'for index = table:scaleX(1, true), table:scaleX(2, true) do', expression: 'table:scaleX(2, true)', kind: 'numeric-for', standalone: false },
    { line: 'for key, item in pairs(table:addRow(false, {})) do', expression: 'table:addRow(false, {})', kind: 'generic-for', standalone: false },
    { line: '  table:createText("generic", {})', expression: 'table:createText("generic", {})', kind: 'call', standalone: true },
    { line: 'consume(table:addRow(false, {}))', expression: 'table:addRow(false, {})', kind: 'call', standalone: false },
    { line: '  table:setText("handler", {})', expression: 'table:setText("handler", {})', kind: 'call', standalone: true }
  ];
  const contextResults = contextExpectations.map(expectation => {
    const lineStart = contextSource.indexOf(expectation.line);
    const candidate = callAt(contextModel, contextSource, expectation.expression, lineStart);
    const statement = enclosingStatement(candidate);
    return {
      expectation,
      candidate,
      statement,
      statementText: statement ? contextSource.slice(statement.source.start.offset, statement.source.end.offset) : undefined
    };
  });
  check('return conditions loop bounds iterators arguments and handlers retain local statement provenance',
    contextResults.every(result => result.candidate && result.statement
      && result.statement.kind === result.expectation.kind
      && result.statement.isStandaloneCallStatementRoot === result.expectation.standalone
      && result.statementText?.includes(result.expectation.expression)
      && result.statement.source.start.offset <= result.candidate.source.start.offset
      && result.statement.source.end.offset >= result.candidate.source.end.offset)
      && contextResults[0].candidate?.context.kind === 'function'
      && contextResults[2].candidate?.context.branchPath.length === 1
      && contextResults[4].candidate?.context.loopPath.length === 1
      && contextResults[7].statementText?.startsWith('for key, item in pairs(')
      && contextResults[10].candidate?.context.kind === 'handler',
    detail(contextResults));

  const crlfExpression = 'table:addRow(false, {})';
  const crlfSource = ['-- 😀', `${crlfExpression};`, 'table:createText("crlf", {})'].join('\r\n');
  const crlfModel = buildX4UiCallModel(input(crlfSource, 'selftest/crlf-provenance.lua'));
  const crlfCall = callAt(crlfModel, crlfSource, crlfExpression);
  const crlfStatement = enclosingStatement(crlfCall);
  const crlfStart = crlfSource.indexOf(crlfExpression);
  const crlfEnd = crlfStart + crlfExpression.length;
  check('LF and CRLF locations remain UTF-16 exact and semicolon-bounded',
    crlfCall?.source.start.offset === crlfStart
      && crlfCall.source.end.offset === crlfEnd
      && crlfStatement?.source.start.offset === crlfStart
      && crlfStatement.source.end.offset === crlfEnd
      && crlfStatement.source.start.line === 2
      && crlfStatement.source.start.column === 0
      && crlfStatement.source.end.line === 2
      && crlfStatement.source.end.column === crlfExpression.length
      && crlfSource.slice(crlfStatement.source.start.offset, crlfStatement.source.end.offset) === crlfExpression
      && crlfSource[crlfEnd] === ';'
      && crlfStart === '-- 😀'.length + 2
      && '😀'.length === 2,
    detail({ crlfCall, crlfStatement, crlfStart, crlfEnd }));

  const deletionExpression = 'table:addRow(false, {})';
  const followingExpression = 'table:createText("next", {})';
  const deletionCases = [
    { name: 'immediate semicolon', source: `${deletionExpression};`, suffix: ';', terminator: 'semicolon', hasFollowing: false },
    { name: 'spaced semicolon', source: `${deletionExpression} \t;`, suffix: ' \t;', terminator: 'semicolon', hasFollowing: false },
    { name: 'no semicolon', source: `${deletionExpression}\n${followingExpression}`, suffix: '', terminator: 'none', hasFollowing: true },
    { name: 'same-line next statement', source: `${deletionExpression}; ${followingExpression}`, suffix: ';', terminator: 'semicolon', hasFollowing: true },
    { name: 'doubled semicolon', source: `${deletionExpression};;`, suffix: ';', terminator: 'semicolon', hasFollowing: false },
    { name: 'semicolon then trailing comment', source: `${deletionExpression}; -- keep;\n${followingExpression}`, suffix: ';', terminator: 'semicolon', hasFollowing: true },
    { name: 'comment before semicolon', source: `${deletionExpression} -- keep;\n${followingExpression}`, suffix: '', terminator: 'none', hasFollowing: true },
    { name: 'LF', source: `-- prefix\n${deletionExpression};\n${followingExpression}`, suffix: ';', terminator: 'semicolon', hasFollowing: true },
    { name: 'CRLF', source: `-- prefix\r\n${deletionExpression} \t;\r\n${followingExpression}`, suffix: ' \t;', terminator: 'semicolon', hasFollowing: true },
    { name: 'astral prefix', source: `-- 😀\n${deletionExpression};\n${followingExpression}`, suffix: ';', terminator: 'semicolon', hasFollowing: true }
  ] as const;
  const deletionAnalyses = deletionCases.map(testCase => {
    const model = buildX4UiCallModel(input(testCase.source, `selftest/deletion-${testCase.name}.lua`));
    const candidate = callAt(model, testCase.source, deletionExpression);
    const statement = enclosingStatement(candidate);
    const astStart = testCase.source.indexOf(deletionExpression);
    return { testCase, model, candidate, statement, astStart, astEnd: astStart + deletionExpression.length };
  });
  const deletionBoundaryResults = deletionAnalyses.map(({ testCase, candidate, statement, astStart, astEnd }) => {
    const deletion = statement?.deletionSource;
    const astText = statement ? testCase.source.slice(statement.source.start.offset, statement.source.end.offset) : '';
    const deletionText = deletion ? testCase.source.slice(deletion.start.offset, deletion.end.offset) : '';
    return {
      name: testCase.name,
      pass: Boolean(candidate
        && statement
        && statement.source.start.offset === astStart
        && statement.source.end.offset === astEnd
        && astText === deletionExpression
        && deletion
        && deletion.start.offset === astStart
        && deletion.start.line === statement.source.start.line
        && deletion.start.column === statement.source.start.column
        && deletion.end.offset === astEnd + testCase.suffix.length
        && deletion.end.line === statement.source.end.line
        && deletion.end.column === statement.source.end.column + testCase.suffix.length
        && statement.terminator === testCase.terminator
        && deletionText === `${deletionExpression}${testCase.suffix}`
        && (testCase.terminator === 'none' ? sameSourceRange(statement.source, deletion) : deletion.end.offset > statement.source.end.offset))
    };
  });
  check('statement deletion provenance owns only bounded horizontal trivia plus the first semicolon',
    deletionBoundaryResults.every(result => result.pass),
    detail(deletionBoundaryResults));

  const deletionReparseResults = deletionAnalyses.map(({ testCase, statement, astStart }) => {
    const deletion = statement?.deletionSource;
    if (!statement || !deletion) {
      return { name: testCase.name, pass: false, reason: 'missing deletion provenance' };
    }
    const removed = testCase.source.slice(0, deletion.start.offset) + testCase.source.slice(deletion.end.offset);
    let reparsed: ReturnType<typeof buildX4UiCallModel> | undefined;
    let threw = false;
    try {
      reparsed = buildX4UiCallModel(input(removed, `selftest/reparsed-${testCase.name}.lua`));
    } catch {
      threw = true;
    }
    const selectedRootGone = !reparsed?.calls.some(callRecord =>
      callRecord.name === 'addRow'
        && removed.slice(callRecord.source.start.offset, callRecord.source.end.offset) === deletionExpression);
    const followingCallPreserved = !testCase.hasFollowing || Boolean(reparsed?.calls.some(callRecord =>
      callRecord.name === 'createText'
        && removed.slice(callRecord.source.start.offset, callRecord.source.end.offset) === followingExpression));
    const outsideRangeExact = removed.slice(0, astStart) === testCase.source.slice(0, astStart)
      && removed.slice(astStart) === testCase.source.slice(deletion.end.offset);
    const specifiedTriviaPreserved = testCase.name === 'doubled semicolon'
      ? removed.startsWith(';')
      : testCase.name === 'semicolon then trailing comment' || testCase.name === 'comment before semicolon'
        ? removed.includes('-- keep;')
        : testCase.name === 'no semicolon'
          ? removed.startsWith('\n')
          : testCase.name === 'LF'
            ? removed.includes('\n')
            : testCase.name === 'CRLF'
              ? removed.includes('\r\n')
              : true;
    return {
      name: testCase.name,
      pass: statement.isStandaloneCallStatementRoot
        && !threw
        && reparsed?.parsed === true
        && selectedRootGone
        && followingCallPreserved
        && outsideRangeExact
        && specifiedTriviaPreserved,
      removed
    };
  });
  check('standalone deletion ranges reparse after removing exactly the selected root and preserve outside bytes',
    deletionReparseResults.every(result => result.pass),
    detail(deletionReparseResults));

  const fluentSource = `${deletionExpression}:createText("chain", {});`;
  const fluentModel = buildX4UiCallModel(input(fluentSource, 'selftest/fluent-deletion.lua'));
  const fluentInner = callAt(fluentModel, fluentSource, deletionExpression);
  const fluentOuter = fluentModel.calls.find(candidate => candidate.name === 'createText');
  const fluentInnerStatement = enclosingStatement(fluentInner);
  const fluentOuterStatement = enclosingStatement(fluentOuter);
  check('fluent inner and outer calls share AST/deletion ranges while only the outer root is standalone',
    fluentInnerStatement !== undefined
      && fluentOuterStatement !== undefined
      && sameSourceRange(fluentInnerStatement.source, fluentOuterStatement.source)
      && sameSourceRange(fluentInnerStatement.deletionSource, fluentOuterStatement.deletionSource)
      && fluentInnerStatement.isStandaloneCallStatementRoot === false
      && fluentOuterStatement.isStandaloneCallStatementRoot === true
      && fluentOuterStatement.terminator === 'semicolon'
      && fluentSource.slice(fluentOuterStatement.source.start.offset, fluentOuterStatement.source.end.offset) === fluentSource.slice(0, -1)
      && fluentSource.slice(fluentOuterStatement.deletionSource.start.offset, fluentOuterStatement.deletionSource.end.offset) === fluentSource,
    detail({ fluentInnerStatement, fluentOuterStatement }));

  const nonStandaloneContextStatements = contextResults
    .map(result => result.statement)
    .filter((statement): statement is EnclosingStatementProbe => Boolean(statement && !statement.isStandaloneCallStatementRoot));
  check('all non-standalone contexts retain exact AST/deletion ranges and do not fabricate terminators',
    nonStandaloneContextStatements.length > 0
      && nonStandaloneContextStatements.every(statement =>
        statement.terminator === 'none' && sameSourceRange(statement.source, statement.deletionSource))
      && [localStatement, assignmentStatement, argumentStatement].every(statement =>
        Boolean(statement
          && !statement.isStandaloneCallStatementRoot
          && statement.terminator === 'none'
          && sameSourceRange(statement.source, statement.deletionSource))),
    detail({ nonStandaloneContextStatements, localStatement, assignmentStatement, argumentStatement }));

  const deletionProvenanceFrozen = deletionAnalyses.every(({ statement }) => Boolean(statement
    && Object.isFrozen(statement)
    && frozenSourceLocation(statement.source)
    && frozenSourceLocation(statement.deletionSource)));
  const repeatedDeletionModel = buildX4UiCallModel(input(deletionCases[8].source, 'selftest/deletion-CRLF.lua'));
  check('deletion provenance locations are deeply frozen and deterministic',
    deletionProvenanceFrozen
      && JSON.stringify(deletionAnalyses[8].model) === JSON.stringify(repeatedDeletionModel),
    detail({ deletionProvenanceFrozen, first: deletionAnalyses[8].model, repeated: repeatedDeletionModel }));

  const nulSource = `${deletionExpression}\u0000`;
  let nulModel: ReturnType<typeof buildX4UiCallModel> | undefined;
  let nulThrew = false;
  try {
    nulModel = buildX4UiCallModel(input(nulSource, 'selftest/nul-provenance.lua'));
  } catch {
    nulThrew = true;
  }
  check('malformed and NUL source fail closed without throwing or fabricating a deletion range',
    !nulThrew
      && nulModel?.parsed === false
      && nulModel.calls.length === 0
      && nulModel.verificationGaps.some(gap => gap.category === 'parse'),
    detail({ nulThrew, nulModel }));

  const malformedProvenance = buildX4UiCallModel(input('function broken(', 'selftest/malformed-provenance.lua'));
  check('malformed or unlocatable source fails closed without a fabricated call range',
    !malformedProvenance.parsed
      && malformedProvenance.calls.length === 0
      && malformedProvenance.verificationGaps.some(gap => gap.category === 'parse'),
    detail(malformedProvenance));

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
