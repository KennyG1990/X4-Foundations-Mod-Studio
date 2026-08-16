import { strict as assert } from 'node:assert';
import {
  buildX4UiSourceBundle,
  projectX4UiSourceBundle,
  spliceX4UiSourceBundle,
  type X4UiSourceBundleInput,
  type X4UiSourceSplice
} from './x4UiSourceBundle';

const firstLua = '\uFEFF-- first\r\nlocal frame = Menus.createFrameHandle()\r\nframe:addTable(2)\r\nframe:addRow()\r\nframe[1][1]:setText("one")\r\n';
const secondLua = '-- second\r\nlocal frame = Menus.createFrameHandle()\r\nlocal count = getCount()\r\nframe:addTable(count)\r\n';
const orphanLua = '-- orphan\r\n';

const orderedInput: X4UiSourceBundleInput = {
  uiXml: '\uFEFF<ui>\r\n  <environment type="menus">\r\n    <file name="ui/second.lua"/>\r\n    <!-- preserve this comment -->\r\n    <file name="ui/first.lua"/>\r\n  </environment>\r\n</ui>\r\n',
  luaFiles: [
    { path: 'ui/first.lua', text: firstLua },
    { path: 'ui/second.lua', text: secondLua },
    { path: 'ui/orphan.lua', text: orphanLua }
  ]
};

function source(bundle: ReturnType<typeof buildX4UiSourceBundle>, path: string) {
  const found = bundle.sourceFiles.find(file => file.path === path);
  assert.ok(found, `source ${path} should be present`);
  return found;
}

function run(): void {
  const ordered = buildX4UiSourceBundle(orderedInput);
  assert.equal(ordered.xml.status, 'parsed');
  assert.deepEqual(
    ordered.orderedFiles.map(file => file.path),
    ['ui/second.lua', 'ui/first.lua'],
    'registered sources must follow ui.xml order'
  );
  const bomSource = source(ordered, 'ui/first.lua');
  assert.equal(bomSource.parseStatus, 'parsed', 'a valid leading-BOM Lua source must parse');
  assert.equal(bomSource.callModel.file.text, firstLua, 'the public call-model source text must remain raw');
  const bomAddTable = bomSource.callModel.calls.find(call => call.name === 'addTable');
  assert.ok(bomAddTable, 'the BOM-prefixed addTable call must remain visible');
  assert.equal(
    bomAddTable.source.start.offset,
    firstLua.indexOf('frame:addTable'),
    'parser offsets must stay aligned after the one-code-unit BOM sentinel'
  );
  assert.equal(ordered.orderedFiles.includes(source(ordered, 'ui/orphan.lua')), false);
  assert.equal(source(ordered, 'ui/orphan.lua').unregistered, true);
  assert.equal(ordered.unregisteredFiles.map(file => file.path).join(','), 'ui/orphan.lua');

  const orderedProjection = projectX4UiSourceBundle(ordered);
  assert.equal(orderedProjection.uiXml, orderedInput.uiXml, 'ui.xml must round-trip exactly');
  assert.deepEqual(
    orderedProjection.luaFiles.map(file => ({ path: file.path, text: file.text })),
    [
      { path: 'ui/first.lua', text: firstLua },
      { path: 'ui/second.lua', text: secondLua },
      { path: 'ui/orphan.lua', text: orphanLua }
    ],
    'all caller Lua strings must round-trip exactly, including BOM and CRLF'
  );

  const bomValueOffset = firstLua.indexOf('2');
  const bomSplice = spliceX4UiSourceBundle(ordered, {
    path: 'ui/first.lua',
    startOffset: bomValueOffset,
    endOffset: bomValueOffset + 1,
    expectedText: '2',
    replacement: '3'
  });
  assert.equal(bomSplice.accepted, true, 'a CAS splice after the BOM must be accepted');
  const bomSpliceProjection = projectX4UiSourceBundle(bomSplice.bundle);
  assert.equal(
    bomSpliceProjection.luaFiles[0].text,
    firstLua.slice(0, bomValueOffset) + '3' + firstLua.slice(bomValueOffset + 1),
    'the BOM and every raw offset before and after the splice must be preserved'
  );
  assert.equal(bomSpliceProjection.luaFiles[1].text, secondLua);
  assert.equal(bomSpliceProjection.uiXml, orderedInput.uiXml);

  const dynamicSource = source(ordered, 'ui/second.lua');
  assert.equal(dynamicSource.verificationStatus, 'unverified');
  assert.ok(dynamicSource.callModel.verificationGaps.length > 0, 'dynamic call-model gaps must remain visible');
  assert.ok(
    ordered.diagnostics.some(diagnostic => diagnostic.code === 'dynamic-call-model-gap' && diagnostic.sourceIndex === dynamicSource.index),
    'dynamic gaps must be explicit diagnostics'
  );

  const edgeCases = buildX4UiSourceBundle({
    uiXml: '<ui><environment type="menus"><file name="ui/a.lua"/><file name="ui/a.lua"/><file name="missing.lua"/><file name="../escape.lua"/><file name="/absolute.lua"/><file name="C:\\absolute.lua"/></environment></ui>',
    luaFiles: [
      { path: 'ui/a.lua', text: 'local frame = Menus.createFrameHandle()\nframe:addTable(1)\n' },
      { path: 'ui/unregistered.lua', text: '-- unregistered\n' }
    ]
  });
  assert.deepEqual(
    edgeCases.registrations.map(registration => registration.resolution),
    ['duplicate-registration', 'duplicate-registration', 'missing-file', 'unsafe-traversal', 'unsafe-absolute', 'unsafe-absolute']
  );
  assert.equal(edgeCases.registrations[0].rawPath, 'ui/a.lua');
  assert.equal(edgeCases.registrations[0].lookupKey, 'ui/a.lua');
  assert.equal(edgeCases.registrations[0].duplicate, true);
  assert.ok(edgeCases.diagnostics.some(diagnostic => diagnostic.code === 'duplicate-registration'));
  assert.ok(edgeCases.diagnostics.some(diagnostic => diagnostic.code === 'missing-lua-file'));
  assert.ok(edgeCases.diagnostics.some(diagnostic => diagnostic.code === 'unsafe-traversal-registration'));
  assert.ok(edgeCases.diagnostics.some(diagnostic => diagnostic.code === 'unsafe-absolute-registration'));
  assert.equal(source(edgeCases, 'ui/unregistered.lua').unregistered, true);

  const parseLocked = buildX4UiSourceBundle({
    uiXml: '<ui><environment type="menus"><file name="ui/bad.lua"/></environment></ui>',
    luaFiles: [{ path: 'ui/bad.lua', text: 'local = syntax error\n' }]
  });
  assert.equal(source(parseLocked, 'ui/bad.lua').parseStatus, 'locked');
  assert.equal(source(parseLocked, 'ui/bad.lua').verificationStatus, 'locked');
  assert.ok(parseLocked.diagnostics.some(diagnostic => diagnostic.code === 'lua-parse-failure'));

  const malformed = buildX4UiSourceBundle({
    uiXml: '<ui><environment type="menus"><file name="ui/a.lua"></ui>',
    luaFiles: [{ path: 'ui/a.lua', text: 'local value = 1\n' }]
  });
  assert.equal(malformed.xml.status, 'malformed');
  assert.equal(malformed.xml.parsed, false);
  assert.equal(malformed.orderedFiles.length, 0);
  assert.ok(malformed.diagnostics.some(diagnostic => diagnostic.code === 'malformed-xml'));

  const editableInput: X4UiSourceBundleInput = {
    uiXml: '<ui>\r\n  <environment type="menus">\r\n    <file name="ui/edit.lua"/>\r\n    <file name="ui/other.lua"/>\r\n  </environment>\r\n</ui>\r\n',
    luaFiles: [
      { path: 'ui/edit.lua', text: 'local count = 2\r\nlocal frame = Menus.createFrameHandle()\r\nframe:addTable(count)\r\n' },
      { path: 'ui/other.lua', text: '-- unchanged\r\n' }
    ]
  };
  const editable = buildX4UiSourceBundle(editableInput);
  const editableSource = source(editable, 'ui/edit.lua');
  assert.equal(editableSource.editable, true);
  const valueOffset = editableSource.text.indexOf('2');
  assert.ok(valueOffset >= 0);
  const edit: X4UiSourceSplice = {
    path: 'ui/edit.lua',
    startOffset: valueOffset,
    endOffset: valueOffset + 1,
    expectedText: '2',
    replacement: '3'
  };
  const accepted = spliceX4UiSourceBundle(editable, edit);
  assert.equal(accepted.accepted, true);
  assert.notEqual(accepted.bundle, editable);
  const acceptedProjection = projectX4UiSourceBundle(accepted.bundle);
  const beforeProjection = projectX4UiSourceBundle(editable);
  assert.equal(acceptedProjection.uiXml, beforeProjection.uiXml);
  assert.equal(acceptedProjection.luaFiles[1].text, beforeProjection.luaFiles[1].text);
  assert.equal(
    acceptedProjection.luaFiles[0].text,
    beforeProjection.luaFiles[0].text.slice(0, valueOffset) + '3' + beforeProjection.luaFiles[0].text.slice(valueOffset + 1)
  );

  const stale = spliceX4UiSourceBundle(editable, { ...edit, expectedText: '9' });
  assert.equal(stale.accepted, false);
  assert.equal(stale.reason, 'expected-text-mismatch');
  assert.equal(stale.bundle, editable, 'CAS refusal must return the original bundle unchanged');

  const outOfRange = spliceX4UiSourceBundle(editable, {
    ...edit,
    startOffset: editableSource.text.length + 1,
    endOffset: editableSource.text.length + 1,
    expectedText: ''
  });
  assert.equal(outOfRange.accepted, false);
  assert.equal(outOfRange.reason, 'invalid-range');
  assert.equal(outOfRange.bundle, editable);

  const syntaxBreak = spliceX4UiSourceBundle(editable, { ...edit, replacement: '(' });
  assert.equal(syntaxBreak.accepted, false);
  assert.equal(syntaxBreak.reason, 'replacement-parse-failure');
  assert.equal(syntaxBreak.bundle, editable);

  assert.deepEqual(
    buildX4UiSourceBundle(orderedInput),
    buildX4UiSourceBundle(orderedInput),
    'identical inputs must produce deterministic output'
  );
  assert.equal(
    spliceX4UiSourceBundle(editable, { ...edit, expectedText: 'stale' }).reason,
    spliceX4UiSourceBundle(editable, { ...edit, expectedText: 'stale' }).reason,
    'identical refusal inputs must produce a deterministic reason'
  );

  console.log('x4UiSourceBundle selftest: PASS');
}

run();
