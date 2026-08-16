import { strict as assert } from 'node:assert';
import type { ModWorkspace, PassthroughFile } from '../types';
import {
  buildX4UiWorkspaceSource,
  commitX4UiWorkspaceSourceSplice,
  isIssuedX4UiWorkspaceSourcePair,
  NOT_VERIFIED_IN_GAME,
  spliceX4UiWorkspaceSource
} from './x4UiWorkspaceSource';

const firstLua = [
  '-- first',
  'local frame = Menus.createFrameHandle()',
  'frame:addTable(2)',
  'frame:addRow()',
  'frame[1][1]:setText("first")',
  ''
].join('\r\n');
const secondLua = [
  '-- second',
  'local frame = Menus.createFrameHandle()',
  'frame:addTable(3)',
  ''
].join('\n');
const orphanLua = '-- retained but not registered\r\n';
const uiXml = [
  '\uFEFF<?xml version="1.0" encoding="utf-8"?>',
  '<addon name="fixture" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">',
  '  <environment type="menus">',
  '    <!-- registration order is authoritative -->',
  '    <file name="ui/second.lua" />',
  '    <file name="ui/first.lua" />',
  '  </environment>',
  '</addon>',
  ''
].join('\r\n');

function passthrough(path: string, content?: string, extra: Partial<PassthroughFile> = {}): PassthroughFile {
  return {
    path,
    ...(content === undefined ? {} : { content }),
    ...extra
  };
}

function workspace(
  files: PassthroughFile[] = [],
  extra: Partial<ModWorkspace> = {}
): ModWorkspace {
  return {
    id: 'workspace_fixture',
    name: 'Workspace Fixture',
    version: '1.0.0',
    author: 'Forge',
    description: 'B119 workspace source fixture',
    nodes: [],
    links: [],
    uiWidgets: [],
    uiTheme: {
      backgroundColor: '#000000',
      borderColor: '#111111',
      accentColor: '#00ffff',
      opacity: 1,
      showIcons: true
    },
    compileSettings: {
      md: false,
      ui: true,
      ai: false,
      library: false,
      translations: false,
      patches: false
    },
    passthroughFiles: files,
    ...extra
  } as ModWorkspace;
}

function buttonWidget(): ModWorkspace['uiWidgets'][number] {
  return {
    id: 'active_widget',
    type: 'button',
    x: 10,
    y: 10,
    w: 120,
    h: 32,
    label: 'Active',
    properties: {}
  };
}

function fixtureWorkspace(): ModWorkspace {
  return workspace([
    passthrough('content.xml', '<content id="fixture"/>', { reason: 'unknown_domain' }),
    passthrough('ui.xml', uiXml, { reason: 'partial', bytes: uiXml.length }),
    passthrough('ui/first.lua', firstLua, { reason: 'unparsed' }),
    passthrough('README.md', '# retained\n', { reason: 'unknown_domain' }),
    passthrough('ui/second.lua', secondLua, { reason: 'partial' }),
    passthrough('ui/orphan.lua', orphanLua, { reason: 'unknown_domain' })
  ]);
}

function sourceFile(source: ReturnType<typeof buildX4UiWorkspaceSource>, path: string) {
  const file = source.bundle?.sourceFiles.find(candidate => candidate.path === path);
  assert.ok(file, `bundle source ${path} should exist`);
  return file;
}

function deepFreeze<T>(value: T, seen: WeakSet<object> = new WeakSet<object>()): T {
  if (value === null || (typeof value !== 'object' && typeof value !== 'function')) return value;
  const objectValue = value as unknown as object;
  if (seen.has(objectValue)) return value;
  seen.add(objectValue);
  const record = value as unknown as Record<PropertyKey, unknown>;
  for (const key of Reflect.ownKeys(record)) deepFreeze(record[key], seen);
  return Object.freeze(value);
}

function deepCloneAndFreeze<T>(value: T): T {
  return deepFreeze(structuredClone(value) as T);
}

function run(): void {
  const original = fixtureWorkspace();
  const originalFiles = original.passthroughFiles!;
  const originalJson = JSON.stringify(original);
  const source = buildX4UiWorkspaceSource(original);

  assert.equal(source.status, 'source-owned');
  assert.equal(source.reason, 'source-owned');
  assert.equal(source.verification, NOT_VERIFIED_IN_GAME);
  assert.equal(source.bundle?.xml.status, 'parsed');
  assert.deepEqual(
    source.bundle?.orderedFiles.map(file => file.path),
    ['ui/second.lua', 'ui/first.lua'],
    'registered Lua must materialize in ui.xml registration order'
  );
  assert.deepEqual(
    source.projection?.luaFiles.map(file => file.path),
    ['ui/first.lua', 'ui/second.lua', 'ui/orphan.lua'],
    'no-edit projection must retain passthrough input order including unregistered Lua'
  );
  assert.equal(source.bundle?.unregisteredFiles[0].path, 'ui/orphan.lua');
  assert.equal(source.luaFiles[0].path, 'ui/first.lua');
  assert.equal(source.luaFiles[0].reason, 'unparsed');
  assert.equal(source.rootFile?.path, 'ui.xml');
  assert.equal(source.rootFile?.reason, 'partial');
  assert.equal(source.projection?.uiXml, uiXml);
  assert.equal(source.projection?.luaFiles[0].text, firstLua);
  assert.equal(source.projection?.luaFiles[1].text, secondLua);
  assert.equal(source.projection?.luaFiles[2].text, orphanLua);
  assert.equal(source.compile.generatedRootUiXml, false);
  assert.equal(source.compile.authority, 'source-owned');
  assert.equal(source.compile.shippable, true);
  assert.equal(source.shippable, true);
  assert.equal(source.editable, true);
  assert.equal(JSON.stringify(original), originalJson, 'projection must not mutate workspace input');
  assert.equal(original.passthroughFiles, originalFiles, 'input array identity must remain intact');
  assert.ok(Object.isFrozen(source));
  assert.ok(Object.isFrozen(source.cas));
  assert.ok(Object.isFrozen(source.cas.passthroughFiles));
  assert.ok(Object.isFrozen(source.bundle));
  assert.ok(Object.isFrozen(source.projection));
  assert.deepEqual(
    buildX4UiWorkspaceSource(original),
    buildX4UiWorkspaceSource(original),
    'identical workspace inputs must produce deterministic adapter results'
  );

  const secondWorkspace = fixtureWorkspace();
  const secondSource = buildX4UiWorkspaceSource(secondWorkspace);
  assert.equal(isIssuedX4UiWorkspaceSourcePair(original, source), true, 'exact source pair must be issued');
  assert.equal(isIssuedX4UiWorkspaceSourcePair(secondWorkspace, secondSource), true, 'each build must issue its exact pair');

  const clonedWorkspace = deepCloneAndFreeze(original);
  const clonedSource = deepCloneAndFreeze(source);
  assert.ok(Object.isFrozen(clonedWorkspace));
  assert.ok(Object.isFrozen(clonedWorkspace.passthroughFiles));
  assert.ok(Object.isFrozen(clonedSource));
  assert.ok(Object.isFrozen(clonedSource.cas));
  assert.equal(
    isIssuedX4UiWorkspaceSourcePair(clonedWorkspace, clonedSource),
    false,
    'a deeply cloned and frozen coherent pair must fail closed'
  );
  assert.equal(isIssuedX4UiWorkspaceSourcePair(clonedWorkspace, source), false, 'workspace clones must fail');
  assert.equal(isIssuedX4UiWorkspaceSourcePair(original, clonedSource), false, 'source clones must fail');
  assert.equal(isIssuedX4UiWorkspaceSourcePair(original, secondSource), false, 'cross-build source pairs must fail');
  assert.equal(isIssuedX4UiWorkspaceSourcePair(secondWorkspace, source), false, 'cross-build workspace pairs must fail');

  const statusCases = [
    [workspace(originalFiles, { uiWidgets: [buttonWidget()] }), 'generated-shadowing-source'],
    [workspace([]), 'unavailable'],
    [workspace([
      passthrough('ui.xml', '<addon><environment type="menus"><file name="ui/missing.lua"/></environment></addon>')
    ]), 'locked']
  ] as const;
  for (const [statusWorkspace, expectedStatus] of statusCases) {
    const statusSource = buildX4UiWorkspaceSource(statusWorkspace);
    assert.equal(statusSource.status, expectedStatus);
    assert.equal(isIssuedX4UiWorkspaceSourcePair(statusWorkspace, statusSource), true);
  }

  let observableProxyReads = 0;
  const proxyHandler: ProxyHandler<object> = {
    get() {
      observableProxyReads += 1;
      throw new Error('proxy get trap should not run');
    },
    has() {
      observableProxyReads += 1;
      throw new Error('proxy has trap should not run');
    },
    ownKeys() {
      observableProxyReads += 1;
      throw new Error('proxy ownKeys trap should not run');
    },
    getOwnPropertyDescriptor() {
      observableProxyReads += 1;
      throw new Error('proxy descriptor trap should not run');
    },
    getPrototypeOf() {
      observableProxyReads += 1;
      throw new Error('proxy prototype trap should not run');
    }
  };
  const proxyWorkspace = new Proxy(original, proxyHandler);
  const proxySource = new Proxy(source, proxyHandler);
  assert.doesNotThrow(() => isIssuedX4UiWorkspaceSourcePair(proxyWorkspace, source));
  assert.equal(isIssuedX4UiWorkspaceSourcePair(proxyWorkspace, source), false);
  assert.doesNotThrow(() => isIssuedX4UiWorkspaceSourcePair(original, proxySource));
  assert.equal(isIssuedX4UiWorkspaceSourcePair(original, proxySource), false);
  assert.equal(observableProxyReads, 0, 'proxy traps must not be observed');

  let observableGetterReads = 0;
  const accessorWorkspace = Object.defineProperty({}, 'workspace', {
    get() {
      observableGetterReads += 1;
      throw new Error('workspace getter should not run');
    }
  });
  const accessorSource = Object.defineProperty({}, 'source', {
    get() {
      observableGetterReads += 1;
      throw new Error('source getter should not run');
    }
  });
  assert.doesNotThrow(() => isIssuedX4UiWorkspaceSourcePair(accessorWorkspace, source));
  assert.equal(isIssuedX4UiWorkspaceSourcePair(accessorWorkspace, source), false);
  assert.doesNotThrow(() => isIssuedX4UiWorkspaceSourcePair(original, accessorSource));
  assert.equal(isIssuedX4UiWorkspaceSourcePair(original, accessorSource), false);
  assert.equal(observableGetterReads, 0, 'accessors must not be observed');

  const primitiveCandidates: readonly [unknown, unknown][] = [
    [null, source],
    [undefined, source],
    [0, source],
    ['workspace', source],
    [original, null],
    [original, undefined],
    [original, 0],
    [original, 'source']
  ];
  for (const [workspaceCandidate, sourceCandidate] of primitiveCandidates) {
    assert.doesNotThrow(() => isIssuedX4UiWorkspaceSourcePair(workspaceCandidate, sourceCandidate));
    assert.equal(isIssuedX4UiWorkspaceSourcePair(workspaceCandidate, sourceCandidate), false);
  }

  const first = sourceFile(source, 'ui/first.lua');
  const firstOffset = first.text.indexOf('2');
  assert.ok(firstOffset >= 0);
  const accepted = commitX4UiWorkspaceSourceSplice(original, source, {
    path: 'ui/first.lua',
    startOffset: firstOffset,
    endOffset: firstOffset + 1,
    expectedText: '2',
    replacement: '4'
  });
  assert.equal(accepted.accepted, true);
  assert.equal(accepted.reason, null);
  assert.notEqual(accepted.workspace, original);
  assert.equal(accepted.workspace.passthroughFiles![1], originalFiles[1], 'root record must retain identity');
  assert.equal(accepted.workspace.passthroughFiles![2].path, 'ui/first.lua');
  assert.equal(accepted.workspace.passthroughFiles![2].content, firstLua.replace('addTable(2)', 'addTable(4)'));
  assert.notEqual(accepted.workspace.passthroughFiles![2], originalFiles[2], 'exactly one record must be replaced');
  assert.equal(accepted.workspace.passthroughFiles![3], originalFiles[3], 'unrelated records must retain identity');
  assert.equal(accepted.workspace.passthroughFiles![4], originalFiles[4], 'registered sibling must retain identity');
  assert.equal(originalFiles[2].content, firstLua, 'source workspace must remain unchanged');
  assert.equal(accepted.source.status, 'source-owned');
  assert.equal(
    isIssuedX4UiWorkspaceSourcePair(accepted.workspace, accepted.source),
    true,
    'successful splice output must issue its exact next pair'
  );

  const staleTextFiles = originalFiles.map((file, index) => index === 2
    ? { ...file, content: `${file.content}-- concurrent edit\n` }
    : file);
  const staleTextWorkspace = workspace(staleTextFiles);
  const staleText = spliceX4UiWorkspaceSource(staleTextWorkspace, source, {
    path: 'ui/first.lua',
    startOffset: firstOffset,
    endOffset: firstOffset + 1,
    expectedText: '2',
    replacement: '4'
  });
  assert.equal(staleText.accepted, false);
  assert.equal(staleText.reason, 'concurrent-passthrough-change');
  assert.equal(staleText.workspace, staleTextWorkspace, 'stale target must return exact workspace identity');

  const unrelatedChangedWorkspace = workspace(originalFiles.map((file, index) => index === 3
    ? { ...file, content: '# concurrently changed\n' }
    : file));
  const unrelatedChanged = spliceX4UiWorkspaceSource(unrelatedChangedWorkspace, source, {
    path: 'ui/first.lua',
    startOffset: firstOffset,
    endOffset: firstOffset + 1,
    expectedText: '2',
    replacement: '4'
  });
  assert.equal(unrelatedChanged.accepted, false);
  assert.equal(unrelatedChanged.reason, 'concurrent-passthrough-change');
  assert.equal(unrelatedChanged.workspace, unrelatedChangedWorkspace);

  const staleExpected = spliceX4UiWorkspaceSource(original, source, {
    path: 'ui/first.lua',
    startOffset: firstOffset,
    endOffset: firstOffset + 1,
    expectedText: '9',
    replacement: '4'
  });
  assert.equal(staleExpected.accepted, false);
  assert.equal(staleExpected.reason, 'expected-text-mismatch');
  assert.equal(staleExpected.workspace, original);

  const activeWidgets = buildX4UiWorkspaceSource(
    workspace(originalFiles, { uiWidgets: [buttonWidget()] })
  );
  assert.equal(activeWidgets.status, 'generated-shadowing-source');
  assert.equal(activeWidgets.reason, 'generated-root-ui-xml');
  assert.equal(activeWidgets.compile.generatedRootUiXml, true);
  assert.deepEqual(activeWidgets.compile.generatedCollisions, ['ui.xml']);
  assert.equal(activeWidgets.projection, null, 'shadowed source must never be shippable projection');
  assert.equal(activeWidgets.compile.shippableProjection, null);
  assert.equal(activeWidgets.shippable, false);
  assert.equal(spliceX4UiWorkspaceSource(workspace(originalFiles, { uiWidgets: [buttonWidget()] }), activeWidgets, {
    path: 'ui/first.lua', startOffset: firstOffset, endOffset: firstOffset + 1, expectedText: '2', replacement: '4'
  }).reason, 'generated-shadowing-source');

  const activeCustomLua = buildX4UiWorkspaceSource(
    workspace(originalFiles, { customLua: '-- generated custom UI\n' })
  );
  assert.equal(activeCustomLua.status, 'generated-shadowing-source');
  assert.equal(activeCustomLua.compile.activeCustomLua, true);
  assert.equal(activeCustomLua.compile.generatedRootUiXml, true);

  const disabledUi = buildX4UiWorkspaceSource(
    workspace(originalFiles, {
      uiWidgets: [buttonWidget()],
      customLua: 'return true\n',
      compileSettings: { md: false, ui: false, ai: false, library: false, translations: false, patches: false }
    })
  );
  assert.equal(disabledUi.status, 'source-owned', 'disabled UI compile must not invent generated output');
  assert.equal(disabledUi.compile.uiCompileEnabled, false);
  assert.equal(disabledUi.compile.generatedRootUiXml, false);
  assert.equal(disabledUi.compile.shippable, true);

  const generatedPathCollision = buildX4UiWorkspaceSource(original, {
    generatedPaths: ['ui/first.lua']
  });
  assert.equal(generatedPathCollision.status, 'generated-shadowing-source');
  assert.equal(generatedPathCollision.reason, 'generated-path-collision');
  assert.deepEqual(generatedPathCollision.compile.generatedCollisions, ['ui/first.lua']);
  assert.equal(generatedPathCollision.projection, null);

  const noSource = buildX4UiWorkspaceSource(workspace([]));
  assert.equal(noSource.status, 'unavailable');
  assert.equal(noSource.reason, 'no-root-ui-xml');
  assert.equal(noSource.bundle, null);

  const duplicateRootWorkspace = workspace([
    passthrough('ui.xml', uiXml),
    passthrough('UI.XML', uiXml),
    passthrough('ui/first.lua', firstLua),
    passthrough('ui/second.lua', secondLua)
  ]);
  const duplicateRoot = buildX4UiWorkspaceSource(duplicateRootWorkspace);
  assert.equal(duplicateRoot.status, 'unavailable');
  assert.equal(duplicateRoot.reason, 'duplicate-root-ui-xml');
  assert.equal(duplicateRoot.rootCandidates.length, 2);
  assert.equal(duplicateRoot.bundle, null, 'duplicate roots must never choose a winner');

  const omittedRoot = buildX4UiWorkspaceSource(workspace([
    passthrough('ui.xml', undefined, { omitted: true, bytes: uiXml.length }),
    passthrough('ui/first.lua', firstLua)
  ]));
  assert.equal(omittedRoot.status, 'unavailable');
  assert.equal(omittedRoot.reason, 'omitted-root-ui-xml');

  const missingLua = buildX4UiWorkspaceSource(workspace([
    passthrough('ui.xml', '<addon><environment type="menus"><file name="ui/missing.lua"/></environment></addon>')
  ]));
  assert.equal(missingLua.status, 'locked');
  assert.ok(missingLua.reasons.includes('missing-registered-lua'));

  const omittedLua = buildX4UiWorkspaceSource(workspace([
    passthrough('ui.xml', '<addon><environment type="menus"><file name="ui/missing.lua"/></environment></addon>'),
    passthrough('ui/missing.lua', undefined, { omitted: true, bytes: 99 })
  ]));
  assert.equal(omittedLua.status, 'locked');
  assert.ok(omittedLua.reasons.includes('omitted-lua-source'));
  assert.ok(omittedLua.reasons.includes('missing-registered-lua'));

  const duplicateRegistration = buildX4UiWorkspaceSource(workspace([
    passthrough('ui.xml', '<addon><environment type="menus"><file name="ui/first.lua"/><file name="ui/first.lua"/></environment></addon>'),
    passthrough('ui/first.lua', firstLua)
  ]));
  assert.equal(duplicateRegistration.status, 'locked');
  assert.ok(duplicateRegistration.reasons.includes('duplicate-registered-lua'));

  const ambiguousLua = buildX4UiWorkspaceSource(workspace([
    passthrough('ui.xml', '<addon><environment type="menus"><file name="ui/first.lua"/></environment></addon>'),
    passthrough('ui/first.lua', firstLua),
    passthrough('ui/first.lua', firstLua)
  ]));
  assert.equal(ambiguousLua.status, 'locked');
  assert.ok(ambiguousLua.reasons.includes('ambiguous-registered-lua'));

  const unsafePaths = buildX4UiWorkspaceSource(workspace([
    passthrough('ui.xml', [
      '<addon><environment type="menus">',
      '<file name="../escape.lua"/>',
      '<file name="/absolute.lua"/>',
      '<file name="C:\\absolute.lua"/>',
      '<file name="ui/unsafe\u0000.lua"/>',
      '<file name="ui\\safe-spelling.lua"/>',
      '</environment></addon>'
    ].join('')),
    passthrough('../escape.lua', '-- escape\n'),
    passthrough('/absolute.lua', '-- absolute\n'),
    passthrough('C:\\absolute.lua', '-- absolute\n'),
    passthrough('ui/unsafe\u0000.lua', '-- nul\n'),
    passthrough('ui\\safe-spelling.lua', '-- backslash spelling\n')
  ]));
  assert.equal(unsafePaths.status, 'locked');
  assert.ok(unsafePaths.reasons.includes('unsafe-source-path'));
  assert.ok(unsafePaths.bundle?.registrations.some(registration => registration.resolution === 'unsafe-traversal'));
  assert.ok(unsafePaths.bundle?.registrations.some(registration => registration.resolution === 'unsafe-absolute'));
  assert.ok(unsafePaths.bundle?.registrations.some(registration => registration.resolution === 'invalid-path'));

  const malformedXml = buildX4UiWorkspaceSource(workspace([
    passthrough('ui.xml', '<addon><environment type="menus"><file name="ui/first.lua"></addon>'),
    passthrough('ui/first.lua', firstLua)
  ]));
  assert.equal(malformedXml.status, 'locked');
  assert.ok(malformedXml.reasons.includes('malformed-xml'));

  const malformedLua = buildX4UiWorkspaceSource(workspace([
    passthrough('ui.xml', '<addon><environment type="menus"><file name="ui/bad.lua"/></environment></addon>'),
    passthrough('ui/bad.lua', 'local = syntax error\n')
  ]));
  assert.equal(malformedLua.status, 'locked');
  assert.ok(malformedLua.reasons.includes('malformed-lua'));

  const directOptions = buildX4UiWorkspaceSource(
    original,
    { passthroughLuaFiles: [originalFiles[2], originalFiles[4], originalFiles[5]] }
  );
  assert.equal(directOptions.status, 'source-owned');
  assert.deepEqual(directOptions.projection?.luaFiles.map(file => file.path), [
    'ui/first.lua', 'ui/second.lua', 'ui/orphan.lua'
  ]);

  const noOp = spliceX4UiWorkspaceSource(original, source, {
    path: 'ui/first.lua', startOffset: firstOffset, endOffset: firstOffset + 1, expectedText: '2', replacement: '2'
  });
  assert.equal(noOp.accepted, true);
  assert.equal(noOp.workspace, original, 'same-text splice must preserve workspace identity');

  console.log('x4UiWorkspaceSource selftest: PASS');
}

run();
