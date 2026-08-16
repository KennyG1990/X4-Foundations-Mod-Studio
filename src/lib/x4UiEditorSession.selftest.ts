import { strict as assert } from 'node:assert';
import type { ModWorkspace, PassthroughFile } from '../types';
import {
  X4_UI_CORPUS_9_00_CONTRACT,
  X4_UI_CORPUS_FILE_URL,
  X4_UI_CORPUS_MANIFEST_URL,
  X4_UI_CORPUS_STATUS_URL,
  isX4UiCorpusCanonicalSuccess,
  loadCanonicalX4UiCorpusAssets,
  type X4UiCorpusCanonicalSuccess,
  type X4UiCorpusFetchResponse,
} from './x4UiCorpusAssets';
import {
  ZEKTON_DDS_HEADER_SIZE,
  ZEKTON_DESCRIPTOR_HEADER_SIZE,
  ZEKTON_DESCRIPTOR_TRAILING_SIZE,
  ZEKTON_RECORD_SIZE,
} from './x4UiFontMetrics';
import { createX4UiLayoutTargetCatalog } from './x4UiLayoutProgram';
import {
  KEEP_OUT_IDS,
  KEEP_OUT_PRESET_IDS,
} from './x4UiKeepOuts';
import {
  X4_UI_EDITOR_DEFAULT_PROFILE,
  X4_UI_EDITOR_EMPTY_CANVAS_STATE,
  X4_UI_EDITOR_SESSION_GAME_TRUTH,
  X4_UI_EDITOR_UNSELECTED_SOURCE,
  adoptX4UiEditorCanvasResult,
  parseX4UiEditorSampleInput,
  projectX4UiEditorSession,
  reconcileX4UiEditorSampleState,
  updateX4UiEditorSampleState,
  type X4UiEditorProfile,
  type X4UiEditorSampleState,
  type X4UiEditorSessionInput,
} from './x4UiEditorSession';
import type { X4UiPreviewSelection } from './x4UiPreviewPipeline';

type JsonRecord = Record<string, unknown>;

function responseHeaders(contentType: string): { get(name: string): string | null } {
  return { get: name => name.toLowerCase() === 'content-type' ? contentType : null };
}

function jsonResponse(body: unknown, status = 200): X4UiCorpusFetchResponse {
  return {
    status,
    headers: responseHeaders('application/json; charset=utf-8'),
    json: async () => body,
  };
}

function bytesResponse(bytes: Uint8Array, status = 200, contentType = 'application/octet-stream'): X4UiCorpusFetchResponse {
  const copied = bytes.slice();
  return {
    status,
    headers: responseHeaders(contentType),
    arrayBuffer: async () => copied.buffer,
  };
}

function hexDigest(hex: string): ArrayBuffer {
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes.buffer;
}

function makeCanonicalAbc(advance: number): Uint8Array {
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
  for (let codepoint = 0; codepoint <= maxCodepoint; codepoint += 1) {
    view.setUint16(ZEKTON_DESCRIPTOR_HEADER_SIZE + codepoint * 2, 1, true);
  }
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

function makeCanonicalDds(): Uint8Array {
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

async function withCanonicalPlatformHash<T>(expectedHashes: readonly string[], run: () => Promise<T>): Promise<T> {
  const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  let hashIndex = 0;
  const fakeCrypto = {
    subtle: {
      digest: async (): Promise<ArrayBuffer> => {
        const expected = expectedHashes[hashIndex++];
        if (expected === undefined) throw new Error('editor-session canonical hash count mismatch');
        return hexDigest(expected);
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

function pathFromQuery(url: string, key: string): string {
  const pair = url.slice(url.indexOf('?') + 1).split('&').find(part => part.startsWith(`${key}=`));
  if (!pair) throw new Error(`missing query ${key}`);
  return decodeURIComponent(pair.slice(key.length + 1));
}

function manifestStatus(root: string, generation: string): JsonRecord {
  return {
    available: true,
    state: 'ready',
    root,
    current: { generation, root, generatedAt: '2026-08-14T00:00:00.000Z' },
  };
}

async function loadCanonicalFixture(): Promise<X4UiCorpusCanonicalSuccess> {
  const root = 'editor-session-canonical-root';
  const generation = 'editor-session-canonical-generation';
  const contract = X4_UI_CORPUS_9_00_CONTRACT;
  const buffers = new Map<string, Uint8Array>([
    [contract.helper.relativePath, new TextEncoder().encode('-- editor session canonical helper\n')],
    [contract.widget.relativePath, new TextEncoder().encode('-- editor session canonical widget\n')],
    [contract.regular.descriptor.relativePath, makeCanonicalAbc(8)],
    [contract.regular.atlas.relativePath, makeCanonicalDds()],
    [contract.bold.descriptor.relativePath, makeCanonicalAbc(8)],
    [contract.bold.atlas.relativePath, makeCanonicalDds()],
  ]);
  const expectedHashes = [
    contract.helper.sha256,
    contract.widget.sha256,
    contract.regular.descriptor.sha256,
    contract.regular.atlas.sha256,
    contract.bold.descriptor.sha256,
    contract.bold.atlas.sha256,
  ];
  const status = {
    available: true,
    root,
    generatedAt: '2026-08-14T00:00:00.000Z',
    manifestGeneration: generation,
    manifest: { available: true, state: 'ready', root, current: { generation, root, generatedAt: '2026-08-14T00:00:00.000Z' } },
  };
  const transport = async (url: string): Promise<X4UiCorpusFetchResponse> => {
    if (url === X4_UI_CORPUS_STATUS_URL) return jsonResponse(status);
    if (url.startsWith(`${X4_UI_CORPUS_MANIFEST_URL}?`)) {
      const path = pathFromQuery(url, 'q');
      const bytes = buffers.get(path);
      if (!bytes) throw new Error(`unknown canonical manifest path ${path}`);
      return jsonResponse({ status: manifestStatus(root, generation), generation, total: 1, limit: 500, offset: 0, files: [{ path, bytes: bytes.byteLength }] });
    }
    if (url.startsWith(`${X4_UI_CORPUS_FILE_URL}?`)) {
      const path = pathFromQuery(url, 'path');
      const bytes = buffers.get(path);
      if (!bytes) throw new Error(`unknown canonical file path ${path}`);
      return bytesResponse(bytes, 200, path.endsWith('.lua') ? 'text/plain' : 'application/octet-stream');
    }
    throw new Error(`unexpected canonical URL ${url}`);
  };
  const result = await withCanonicalPlatformHash(expectedHashes, () => loadCanonicalX4UiCorpusAssets({ transport }));
  assert.equal(isX4UiCorpusCanonicalSuccess(result), true, 'canonical fixture must be loader-issued');
  return result as X4UiCorpusCanonicalSuccess;
}

function passthrough(path: string, content: string, extra: Partial<PassthroughFile> = {}): PassthroughFile {
  return { path, content, ...extra };
}

function workspace(files: PassthroughFile[], extra: Partial<ModWorkspace> = {}): ModWorkspace {
  return {
    id: 'batch-7a-editor-session',
    name: 'Batch 7A editor session fixture',
    version: '1.0.0',
    author: 'Forge',
    description: 'source-backed editor session fixture',
    nodes: [],
    links: [],
    uiWidgets: [],
    uiTheme: { backgroundColor: '#000000', borderColor: '#111111', accentColor: '#00ffff', opacity: 1, showIcons: true },
    compileSettings: { md: false, ui: true, ai: false, library: false, translations: false, patches: false },
    passthroughFiles: files,
    ...extra,
  } as ModWorkspace;
}

const sourceLua = [
  'local menu = { name = "EditorSession", layer = 1 }',
  'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80, layer = 1 })',
  'local table = frame:addTable(4, { width = 100, reserveScrollBar = false, scaling = false })',
  'table:setColWidth(1, 20, false)',
  'table:setColWidth(2, 20, false)',
  'table:setColWidth(3, 20, false)',
  'table:setColWidth(4, 20, false)',
  'local row = table:addRow(false, { paddingTop = 1, paddingBottom = 1, borderBelow = false, fixed = false })',
  'row[1]:setColSpan(2):createText("session", { height = 12, minRowHeight = 10 })',
  'row[3]:createButton({ height = 0, affectRowHeight = false }):setText("button", { x = 0, y = 0 }):setText2("bold", { x = 0, y = 0, halign = "right", font = "Zekton Bold", fontsize = 16 })',
  'row[4]:createIcon("solid", { height = 8, affectRowHeight = false })',
  'local secondaryMenu = { name = "Secondary", layer = 0 }',
  'local secondaryFrame = Helper.createFrameHandle(secondaryMenu, { width = 100, height = 80, layer = 0 })',
  'local secondaryTable = secondaryFrame:addTable(1, { width = 40, reserveScrollBar = false, scaling = false })',
  'secondaryTable:setColWidth(1, 40, false)',
  'local secondaryRow = secondaryTable:addRow(false, {})',
  'secondaryRow[1]:createText("secondary", { height = 8 })',
  'secondaryFrame:display()',
  'frame:display()',
  '',
].join('\n');

const importedLua = [
  'local importedFrame = Helper.createFrameHandle({ name = "Imported" }, { width = 100, height = 80 })',
  'local importedTable = importedFrame:addTable(24, { width = 100, reserveScrollBar = false, scaling = false })',
  'importedFrame:display()',
  '',
].join('\n');

function sourceFixture(includeImported = true, extra: Partial<ModWorkspace> = {}): ModWorkspace {
  const files: PassthroughFile[] = [
    passthrough('ui.xml', [
      '<?xml version="1.0" encoding="utf-8"?>',
      '<addon name="editor-session-fixture">',
      '  <environment type="menus">',
      '    <file name="ui/session.lua" />',
      '    <file name="ui/imported.lua" />',
      '  </environment>',
      '</addon>',
      '',
    ].join('\n')),
    passthrough('ui/session.lua', sourceLua, { reason: 'unparsed' }),
  ];
  if (includeImported) files.push(passthrough('ui/imported.lua', importedLua, { reason: 'unparsed' }));
  return workspace(files, extra);
}

function sampleWorkspace(): ModWorkspace {
  return workspace([
    passthrough('ui.xml', [
      '<?xml version="1.0" encoding="utf-8"?>',
      '<addon name="editor-session-samples">',
      '  <environment type="menus">',
      '    <file name="ui/samples.lua" />',
      '  </environment>',
      '</addon>',
      '',
    ].join('\n')),
    passthrough('ui/samples.lua', [
      'local menu = { name = "Samples", layer = 1 }',
      'function menu.display(columnCount, tableWidth, tableScaling, dynamicText)',
      '  local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
      '  local table = frame:addTable(columnCount, { width = tableWidth, reserveScrollBar = false, scaling = tableScaling })',
      '  local row = table:addRow(false, {})',
      '  row[1]:createText(dynamicText, { height = 10 })',
      'end',
      '',
    ].join('\n'), { reason: 'unparsed' }),
  ]);
}

function selectionFor(source: ReturnType<typeof import('./x4UiWorkspaceSource')['buildX4UiWorkspaceSource']>, path = 'ui/session.lua', targetKind: 'top-level' | 'function' | 'handler' = 'top-level'): X4UiPreviewSelection {
  const file = source.bundle?.sourceFiles.find(candidate => candidate.path === path);
  assert.ok(file, `source file ${path} should be materialized`);
  const catalog = createX4UiLayoutTargetCatalog(file.callModel);
  const target = catalog.targets.find(candidate => candidate.kind === targetKind);
  assert.ok(target, `top-level target for ${path} should exist`);
  return { sourceIndex: file.index, path: file.path, sourceIdentity: catalog.sourceIdentity, target: { ...target, id: target.id } };
}

function hasOwn(value: unknown, key: string): boolean {
  return value !== null && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, key);
}

function assertFrozenGraph(value: unknown, seen = new WeakSet<object>()): void {
  if (value === null || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  assert.equal(Object.isFrozen(value), true, 'returned adapter data must be recursively frozen');
  for (const child of Object.values(value as JsonRecord)) assertFrozenGraph(child, seen);
}

function fakeSurface(): { width: number; height: number; mutable: number; getContext(): null } {
  return { width: 2560, height: 1440, mutable: 0, getContext: () => null };
}

function renderedResult(surface: ReturnType<typeof fakeSurface>): unknown {
  return {
    status: 'rendered',
    surface,
    receipt: {
      format: 'x4-ui-canvas-renderer',
      version: 1,
      status: 'rendered',
      width: surface.width,
      height: surface.height,
      layers: ['diagnostic-background', 'glyph-alpha-blits', 'diagnostics', 'keep-out-overlays'],
      commandIds: [],
      commandCount: 0,
      atlasRoles: [],
      palette: { id: 'diagnostic-only', diagnosticOnly: true },
      gameTruth: X4_UI_EDITOR_SESSION_GAME_TRUTH,
      gameVerified: false,
      verification: { game: X4_UI_EDITOR_SESSION_GAME_TRUTH, gameVerified: false },
    },
  };
}

function cloneJsonRecord(value: JsonRecord): JsonRecord {
  return JSON.parse(JSON.stringify(value)) as JsonRecord;
}

function renderedResultRecord(surface: ReturnType<typeof fakeSurface>): JsonRecord {
  const result = renderedResult(surface) as JsonRecord;
  return { ...result, receipt: cloneJsonRecord(result.receipt as JsonRecord) };
}

function refusedResultRecord(code = 'input-refused', message = 'test refusal'): JsonRecord {
  return {
    status: 'refused',
    receipt: {
      format: 'x4-ui-canvas-renderer',
      version: 1,
      status: 'refused',
      refusal: { code, message },
      gameTruth: X4_UI_EDITOR_SESSION_GAME_TRUTH,
      gameVerified: false,
      verification: { game: X4_UI_EDITOR_SESSION_GAME_TRUTH, gameVerified: false },
    },
  };
}

function resultReceipt(result: JsonRecord): JsonRecord {
  return result.receipt as JsonRecord;
}

function assertInvalidAdoption(previous: unknown, result: JsonRecord, expectedSurface: unknown): void {
  const adopted = adoptX4UiEditorCanvasResult(previous as never, result as never);
  assert.equal(adopted.status, expectedSurface === null ? 'refused' : 'stale');
  assert.equal(adopted.surface, expectedSurface);
  assert.equal(adopted.stale, expectedSurface !== null);
  assert.equal(adopted.receipt, null);
  assert.deepEqual(adopted.refusal, {
    code: 'invalid-result',
    message: 'renderer result was refused or malformed',
  });
  assert.equal(adopted.gameTruth, X4_UI_EDITOR_SESSION_GAME_TRUTH);
  assert.equal(adopted.gameVerified, false);
  assert.equal(hasOwn(adopted, 'target'), false);
  assert.equal(hasOwn(adopted, 'existingSurface'), false);
  assert.equal(Object.isFrozen(adopted), true);
  assertFrozenGraph(adopted.refusal);
}

async function run(): Promise<void> {
  assert.equal(X4_UI_EDITOR_SESSION_GAME_TRUTH, 'Not verified in game');
  assert.equal(X4_UI_EDITOR_DEFAULT_PROFILE.drawable.width, 2560);
  assert.equal(X4_UI_EDITOR_DEFAULT_PROFILE.drawable.height, 1440);
  assert.equal(X4_UI_EDITOR_DEFAULT_PROFILE.uiScale, 1.4);
  assert.equal(X4_UI_EDITOR_DEFAULT_PROFILE.truthGrade, 'unverified-default');
  assert.deepEqual(X4_UI_EDITOR_UNSELECTED_SOURCE, {
    file: 'unselected.lua',
    sourcePath: 'fixture://unselected.lua',
    sha256: '0'.repeat(64),
  });
  assertFrozenGraph(X4_UI_EDITOR_DEFAULT_PROFILE);

  const originalWorkspace = sourceFixture();
  const originalWorkspaceJson = JSON.stringify(originalWorkspace);
  const canonical = await loadCanonicalFixture();
  const noSelectionInput: X4UiEditorSessionInput = { workspace: originalWorkspace, corpus: undefined, profile: X4_UI_EDITOR_DEFAULT_PROFILE };
  const noSelection = projectX4UiEditorSession(noSelectionInput);
  assert.equal(noSelection.gameTruth, X4_UI_EDITOR_SESSION_GAME_TRUTH);
  assert.equal(noSelection.gameVerified, false);
  assert.equal(noSelection.preview.selection.status, 'needs-selection');
  assert.equal(noSelection.preview.selectedSource, undefined);
  assert.equal(noSelection.preview.selectedTarget, undefined);
  assert.equal(noSelection.preview.sourceCandidates.length, 2);
  assert.equal(noSelection.preview.lint.length, 2);
  assertFrozenGraph(noSelection);
  assert.equal(JSON.stringify(originalWorkspace), originalWorkspaceJson, 'session projection must not mutate workspace');

  const importedLint = noSelection.preview.lint.find(file => file.path === 'ui/imported.lua');
  assert.ok(importedLint?.lint, 'imported-file lint must materialize before corpus');
  const importedFinding = JSON.stringify(importedLint?.lint);
  for (const token of ['addTable', 'severity', 'location', 'message', 'failureMode', 'evidenceBoundary', 'nextAction']) {
    assert.match(importedFinding, new RegExp(token), `imported lint must expose ${token}`);
  }
  assert.match(importedFinding, /24/);
  assert.match(importedFinding, /whole-frame|conversation-close|conversation/);

  const source = noSelection.source;
  const selection = selectionFor(source);
  const canonicalWorkspace = sourceFixture(false);
  const canonicalSource = projectX4UiEditorSession({ workspace: canonicalWorkspace, corpus: undefined, profile: X4_UI_EDITOR_DEFAULT_PROFILE }).source;
  const canonicalSelection = selectionFor(canonicalSource);
  const exact: X4UiEditorSessionInput = {
    workspace: canonicalWorkspace,
    corpus: canonical,
    profile: {
      id: 'editor-session-profile',
      provenance: 'Batch 7A source-backed selftest',
      truthGrade: 'supplied',
      source: canonicalSelection.sourceIdentity,
      drawable: { width: 100, height: 80 },
      uiScale: 1,
      minTextHeight: 10,
    },
    selection: canonicalSelection,
  };
  const projected = projectX4UiEditorSession(exact);
  assert.ok(projected.preview.status === 'projected' || projected.preview.status === 'partial');
  assert.equal(projected.canRender, true);
  const projectedPaint = projected.paint;
  assert.ok(projectedPaint && (projectedPaint.status === 'projected' || projectedPaint.status === 'partial'));
  if (projectedPaint) {
    assert.equal(projectedPaint.plan.gameTruth, X4_UI_EDITOR_SESSION_GAME_TRUTH);
    assert.equal(projectedPaint.verification.gameVerified, false);
    assert.equal(projectedPaint.plan.source.file, selection.sourceIdentity.file);
    assert.equal(projectedPaint.plan.logicalDrawable.width, 100);
    assert.equal(projectedPaint.plan.logicalDrawable.height, 80);
  }

  const sampleWorkspaceValue = sampleWorkspace();
  const sampleWorkspaceObject = sampleWorkspaceValue;
  const sampleSourceFileObject = sampleWorkspaceValue.passthroughFiles[1];
  const sampleWorkspaceJson = JSON.stringify(sampleWorkspaceValue);
  const sampleBaseline = projectX4UiEditorSession({
    workspace: sampleWorkspaceValue,
    corpus: undefined,
    profile: X4_UI_EDITOR_DEFAULT_PROFILE,
  });
  const sampleSelection = selectionFor(sampleBaseline.source, 'ui/samples.lua', 'function');
  const sampleUnprojected = projectX4UiEditorSession({
    workspace: sampleWorkspaceValue,
    corpus: undefined,
    profile: X4_UI_EDITOR_DEFAULT_PROFILE,
    selection: sampleSelection,
  });
  const sampleProgramResult = sampleUnprojected.preview.program;
  assert.ok(sampleProgramResult && sampleProgramResult.status !== 'refused', `sample fixture program must expose a catalog: ${JSON.stringify(sampleUnprojected.preview)}`);
  const sampleCatalog = sampleUnprojected.sampleCatalog;
  assert.ok(sampleCatalog, 'sample fixture projection must expose the exact catalog issued with its authority');
  const sampleCatalogAuthority = sampleUnprojected.sampleCatalogAuthority;
  assert.ok(sampleCatalogAuthority, 'unprojected sample session must issue a catalog authority');
  const numberEntry = sampleCatalog.entries.find(entry => entry.expectedType === 'number');
  const stringEntry = sampleCatalog.entries.find(entry => entry.expectedType === 'string');
  const booleanEntry = sampleCatalog.entries.find(entry => entry.expectedType === 'boolean');
  assert.ok(numberEntry && stringEntry && booleanEntry, 'sample fixture must expose number/string/boolean entries');
  assert.deepEqual(parseX4UiEditorSampleInput('number', '80'), { status: 'accepted', value: 80 });
  assert.deepEqual(parseX4UiEditorSampleInput('string', 'Preview text'), { status: 'accepted', value: 'Preview text' });
  assert.deepEqual(parseX4UiEditorSampleInput('boolean', 'false'), { status: 'accepted', value: false });
  assert.equal(parseX4UiEditorSampleInput('number', 'Infinity').status, 'refused');
  assert.equal(parseX4UiEditorSampleInput('boolean', '1').status, 'refused');
  assert.equal(parseX4UiEditorSampleInput('number', '').status, 'reset');
  const sampleState: X4UiEditorSampleState = {
    catalogId: sampleCatalog.id,
    source: sampleCatalog.sourceIdentity,
    values: sampleCatalog.entries.map(entry => ({
      id: entry.id,
      value: entry.expectedType === 'number'
        ? (entry.consumers.some(consumer => consumer.field === 'count') ? 2 : 80)
        : entry.expectedType === 'string'
          ? 'Preview text'
      : true,
    })),
  };
  const sampleExactProfile: X4UiEditorProfile = {
    id: 'editor-session-samples-profile',
    provenance: 'Batch 7C source-backed selftest',
    truthGrade: 'supplied',
    source: sampleSelection.sourceIdentity,
    drawable: { width: 100, height: 80 },
    uiScale: 1,
    minTextHeight: 10,
  };
  const sampleExactUnprojected = projectX4UiEditorSession({
    workspace: sampleWorkspaceValue,
    corpus: canonical,
    profile: sampleExactProfile,
    selection: sampleSelection,
  });
  const sampleBinding = sampleExactUnprojected.sampleBinding;
  const sampleExactCatalogAuthority = sampleExactUnprojected.sampleCatalogAuthority;
  assert.ok(sampleBinding, 'unprojected sample session must issue an editor-only binding');
  assert.ok(sampleExactCatalogAuthority, 'exact sample session must issue a catalog authority');
  const reconcileWithTwoArguments = reconcileX4UiEditorSampleState as unknown as (
    samples: unknown,
    catalog: unknown,
  ) => ReturnType<typeof reconcileX4UiEditorSampleState>;
  const forgedTargetCatalog = { ...sampleCatalog, targetId: 'forged-target' };
  const forgedTargetTwoArgumentResult = reconcileWithTwoArguments(sampleState, forgedTargetCatalog);
  assert.equal(forgedTargetTwoArgumentResult.status, 'refused', 'two-argument public reconcile must require session-issued catalog authority');
  assert.equal(forgedTargetTwoArgumentResult.samples, undefined, 'two-argument forged target must not leave forwardable samples');
  const reconciledSamples = reconcileX4UiEditorSampleState(sampleState, sampleCatalog, sampleCatalogAuthority);
  assert.equal(reconciledSamples.status, 'accepted');
  assert.equal(reconciledSamples.samples, sampleState, 'valid unchanged sample state preserves identity');
  const forwarded = projectX4UiEditorSession({
    workspace: sampleWorkspaceValue,
    corpus: canonical,
    profile: sampleExactProfile,
    selection: sampleSelection,
    samples: sampleState,
    sampleBinding,
    sampleCatalogAuthority: sampleExactCatalogAuthority,
  });
  assert.equal(forwarded.samples, sampleState, 'session must retain exact reconciled sample input');
  assert.deepEqual(Reflect.ownKeys(forwarded.samples as object).sort(), ['catalogId', 'source', 'values'], 'forwarded samples must remain the canonical layout input shape');
  assert.equal(forwarded.preview.program?.status === 'refused', false);
  const forwardedProgram = forwarded.preview.program;
  assert.ok(forwardedProgram && forwardedProgram.status !== 'refused');
  assert.equal(hasOwn(forwarded.preview as unknown, 'sampleBinding'), false, 'editor-only sample binding must not enter preview');
  assert.equal(hasOwn(forwarded.preview as unknown, 'sampleCatalogAuthority'), false, 'editor-only sample authority must not enter preview');
  assert.equal(hasOwn(forwardedProgram.program as unknown, 'sampleBinding'), false, 'editor-only sample binding must not enter the layout program');
  assert.equal(hasOwn(forwardedProgram.program as unknown, 'sampleCatalogAuthority'), false, 'editor-only sample authority must not enter the layout program');
  assert.equal(forwardedProgram.program.previewSampleBindings.every(binding => binding.status === 'consumed'), true);
  const widthEntry = sampleCatalog.entries.find(entry => entry.consumers.some(consumer => consumer.field === 'width'));
  assert.ok(widthEntry);
  const forwardedWidth = forwardedProgram.program.tables[0]?.requestedWidth;
  assert.equal(forwardedWidth, 80);
  const geometryChangedState = updateX4UiEditorSampleState(sampleState, sampleCatalog, widthEntry.id, '90', sampleCatalogAuthority);
  assert.equal(geometryChangedState.status, 'accepted');
  const geometryChanged = projectX4UiEditorSession({ workspace: sampleWorkspaceValue, corpus: canonical, profile: sampleExactProfile, selection: sampleSelection, samples: geometryChangedState.samples, sampleBinding, sampleCatalogAuthority: sampleExactCatalogAuthority });
  const geometryChangedProgram = geometryChanged.preview.program;
  assert.ok(geometryChangedProgram && geometryChangedProgram.status !== 'refused');
  assert.equal(geometryChangedProgram.program.tables[0]?.requestedWidth, 90);
  const invalidForwarded = projectX4UiEditorSession({
    workspace: sampleWorkspaceValue,
    corpus: canonical,
    profile: sampleExactProfile,
    selection: sampleSelection,
    samples: {
      ...sampleState,
      values: sampleState.values.map(value => value.id === numberEntry.id ? { ...value, value: Number.POSITIVE_INFINITY } : value),
    },
    sampleBinding,
  });
  assert.equal(invalidForwarded.sampleReconciliation.status, 'refused');
  assert.equal(invalidForwarded.samples, undefined, 'invalid samples must not be forwarded to preview');
  assert.equal(sampleWorkspaceValue, sampleWorkspaceObject);
  assert.equal(sampleWorkspaceValue.passthroughFiles[1], sampleSourceFileObject);
  assert.equal(JSON.stringify(sampleWorkspaceValue), sampleWorkspaceJson, 'sample actions must not mutate workspace bytes or identity');
  const changedSample = updateX4UiEditorSampleState(sampleState, sampleCatalog, numberEntry.id, '90', sampleCatalogAuthority);
  assert.equal(changedSample.status, 'accepted');
  assert.equal(changedSample.samples?.values.find(value => value.id === numberEntry.id)?.value, 90);
  const resetSample = updateX4UiEditorSampleState(changedSample.samples, sampleCatalog, numberEntry.id, '', sampleCatalogAuthority);
  assert.equal(resetSample.status, 'reset');
  assert.equal(resetSample.samples?.values.some(value => value.id === numberEntry.id), false);
  const refusedSample = updateX4UiEditorSampleState(sampleState, sampleCatalog, numberEntry.id, 'NaN', sampleCatalogAuthority);
  assert.equal(refusedSample.status, 'refused');
  assert.equal(refusedSample.samples?.values.some(value => value.id === numberEntry.id), false, 'refused input cannot forward the stale value');
  const staleSample = reconcileX4UiEditorSampleState(sampleState, {
    ...sampleCatalog,
    id: `${sampleCatalog.id}:stale`,
  }, sampleCatalogAuthority);
  assert.equal(staleSample.status, 'refused');
  assert.equal(staleSample.samples, undefined);
  const staleSourceSample = reconcileX4UiEditorSampleState(sampleState, {
    ...sampleCatalog,
    sourceIdentity: { ...sampleCatalog.sourceIdentity, sha256: 'b'.repeat(64) },
  }, sampleCatalogAuthority);
  assert.equal(staleSourceSample.status, 'refused');
  const unknownSample = reconcileX4UiEditorSampleState({
    ...sampleState,
    values: [...sampleState.values, { id: 'unknown-sample', value: 1 }],
  }, sampleCatalog, sampleCatalogAuthority);
  assert.equal(unknownSample.status, 'refused');
  assert.equal(unknownSample.code, 'unknown-sample');
  const typeMismatchSample = reconcileX4UiEditorSampleState({
    ...sampleState,
    values: sampleState.values.map(value => value.id === numberEntry.id ? { ...value, value: 'wrong' } : value),
  }, sampleCatalog, sampleCatalogAuthority);
  assert.equal(typeMismatchSample.status, 'refused');
  assert.equal(typeMismatchSample.code, 'sample-type-mismatch');
  const nonFiniteSample = reconcileX4UiEditorSampleState({
    ...sampleState,
    values: sampleState.values.map(value => value.id === numberEntry.id ? { ...value, value: Number.POSITIVE_INFINITY } : value),
  }, sampleCatalog, sampleCatalogAuthority);
  assert.equal(nonFiniteSample.status, 'refused');
  assert.equal(nonFiniteSample.code, 'nonfinite-sample');
  const duplicateCatalog = {
    ...sampleCatalog,
    entries: [...sampleCatalog.entries, sampleCatalog.entries[0]],
  };
  assert.equal(reconcileX4UiEditorSampleState(sampleState, duplicateCatalog, sampleCatalogAuthority).status, 'refused');

  const expectSampleRefusal = (name: string, result: ReturnType<typeof reconcileX4UiEditorSampleState>): void => {
    assert.equal(result.status, 'refused', `${name} must be refused`);
    assert.equal(result.samples, undefined, `${name} must not leave a forwardable sample state`);
  };
  const firstCatalogEntry = sampleCatalog.entries[0];
  assert.ok(firstCatalogEntry);
  const catalogMutationCases: readonly [string, unknown][] = [
    ['catalog extra key', { ...sampleCatalog, extra: true }],
    ['catalog inherited fields', Object.create(sampleCatalog) as unknown],
    ['catalog custom prototype', Object.assign(Object.create({ inherited: true }), sampleCatalog)],
    ['catalog accessor field', (() => {
      const candidate = { ...sampleCatalog } as JsonRecord;
      Object.defineProperty(candidate, 'targetId', { enumerable: true, configurable: true, get: () => sampleCatalog.targetId });
      return candidate;
    })()],
    ['catalog symbol field', (() => {
      const candidate = { ...sampleCatalog } as JsonRecord;
      Object.defineProperty(candidate, Symbol('catalog-extra'), { enumerable: true, value: true });
      return candidate;
    })()],
    ['decorated catalog entries array', (() => {
      const entries = [...sampleCatalog.entries] as unknown[] & JsonRecord;
      entries.decorated = true;
      return { ...sampleCatalog, entries };
    })()],
    ['entry inherited fields', (() => {
      const entry = Object.create(firstCatalogEntry) as JsonRecord;
      return { ...sampleCatalog, entries: [entry, ...sampleCatalog.entries.slice(1)] };
    })()],
    ['entry custom prototype', (() => {
      const entry = Object.assign(Object.create({ inherited: true }), firstCatalogEntry);
      return { ...sampleCatalog, entries: [entry, ...sampleCatalog.entries.slice(1)] };
    })()],
    ['entry accessor field', (() => {
      const entry = { ...firstCatalogEntry } as JsonRecord;
      Object.defineProperty(entry, 'expression', { enumerable: true, configurable: true, get: () => firstCatalogEntry.expression });
      return { ...sampleCatalog, entries: [entry, ...sampleCatalog.entries.slice(1)] };
    })()],
    ['entry symbol field', (() => {
      const entry = { ...firstCatalogEntry } as JsonRecord;
      Object.defineProperty(entry, Symbol('entry-extra'), { enumerable: true, value: true });
      return { ...sampleCatalog, entries: [entry, ...sampleCatalog.entries.slice(1)] };
    })()],
    ['empty consumer array', {
      ...sampleCatalog,
      entries: [{ ...firstCatalogEntry, consumers: [] }, ...sampleCatalog.entries.slice(1)],
    }],
    ['foreign entry source file', {
      ...sampleCatalog,
      entries: [{ ...firstCatalogEntry, source: { ...firstCatalogEntry.source, file: 'ui/foreign.lua' } }, ...sampleCatalog.entries.slice(1)],
    }],
    ['foreign entry source path', {
      ...sampleCatalog,
      entries: [{ ...firstCatalogEntry, source: { ...firstCatalogEntry.source, sourcePath: 'foreign/ui.lua' } }, ...sampleCatalog.entries.slice(1)],
    }],
    ['foreign entry source hash field', {
      ...sampleCatalog,
      entries: [{ ...firstCatalogEntry, source: { ...firstCatalogEntry.source, sha256: 'b'.repeat(64) } }, ...sampleCatalog.entries.slice(1)],
    }],
    ['reversed entry range', {
      ...sampleCatalog,
      entries: [{ ...firstCatalogEntry, source: { ...firstCatalogEntry.source, start: { ...firstCatalogEntry.source.end }, end: { ...firstCatalogEntry.source.start } } }, ...sampleCatalog.entries.slice(1)],
    }],
    ['out-of-document entry range', {
      ...sampleCatalog,
      entries: [{ ...firstCatalogEntry, source: { ...firstCatalogEntry.source, start: { line: 9999, column: 0, offset: 999999 }, end: { line: 9999, column: 1, offset: 1000000 } } }, ...sampleCatalog.entries.slice(1)],
    }],
    ['unknown consumer operation', {
      ...sampleCatalog,
      entries: [{ ...firstCatalogEntry, consumers: [{ ...firstCatalogEntry.consumers[0], operationId: 'unknown-operation' }] }, ...sampleCatalog.entries.slice(1)],
    }],
    ['duplicate consumer identity', {
      ...sampleCatalog,
      entries: [{ ...firstCatalogEntry, consumers: [...firstCatalogEntry.consumers, firstCatalogEntry.consumers[0]] }, ...sampleCatalog.entries.slice(1)],
    }],
    ['invalid consumer operation kind', {
      ...sampleCatalog,
      entries: [{ ...firstCatalogEntry, consumers: [{ ...firstCatalogEntry.consumers[0], operationKind: 'not-a-layout-operation' }] }, ...sampleCatalog.entries.slice(1)],
    }],
    ['cloned catalog with unchanged data', {
      ...sampleCatalog,
      entries: [...sampleCatalog.entries],
    }],
    ['catalog expression drift', {
      ...sampleCatalog,
      entries: [{ ...firstCatalogEntry, expression: `${firstCatalogEntry.expression}:drift` }, ...sampleCatalog.entries.slice(1)],
    }],
    ['catalog unknown entry', {
      ...sampleCatalog,
      entries: [...sampleCatalog.entries, { ...firstCatalogEntry, id: 'unknown-catalog-entry' }],
    }],
    ['missing catalog source hash', (() => {
      const sourceIdentity = { ...sampleCatalog.sourceIdentity } as JsonRecord;
      delete sourceIdentity.sha256;
      return { ...sampleCatalog, sourceIdentity };
    })()],
    ['missing entry provenance', (() => {
      const entry = { ...firstCatalogEntry } as JsonRecord;
      delete entry.provenance;
      return { ...sampleCatalog, entries: [entry, ...sampleCatalog.entries.slice(1)] };
    })()],
    ['missing consumer field', (() => {
      const consumer = { ...firstCatalogEntry.consumers[0] } as JsonRecord;
      delete consumer.field;
      return { ...sampleCatalog, entries: [{ ...firstCatalogEntry, consumers: [consumer] }, ...sampleCatalog.entries.slice(1)] };
    })()],
    ['target ID drift against selected program', { ...sampleCatalog, targetId: 'target-drift' }],
  ];
  for (const [name, candidate] of catalogMutationCases) {
    const result = reconcileX4UiEditorSampleState(sampleState, candidate, sampleCatalogAuthority);
    expectSampleRefusal(name, result);
  }

  const sampleExtraKey = { ...sampleState, extra: true } as unknown;
  expectSampleRefusal('sample extra key', reconcileX4UiEditorSampleState(sampleExtraKey, sampleCatalog, sampleCatalogAuthority));
  const sampleInherited = Object.create(sampleState) as unknown;
  expectSampleRefusal('sample inherited fields', reconcileX4UiEditorSampleState(sampleInherited, sampleCatalog, sampleCatalogAuthority));
  const sampleCustomPrototype = Object.assign(Object.create({ inherited: true }), sampleState) as unknown;
  expectSampleRefusal('sample custom prototype', reconcileX4UiEditorSampleState(sampleCustomPrototype, sampleCatalog, sampleCatalogAuthority));
  const sampleAccessor = { ...sampleState } as JsonRecord;
  Object.defineProperty(sampleAccessor, 'catalogId', { enumerable: true, configurable: true, get: () => sampleState.catalogId });
  expectSampleRefusal('sample accessor field', reconcileX4UiEditorSampleState(sampleAccessor, sampleCatalog, sampleCatalogAuthority));
  const sampleSymbol = { ...sampleState } as JsonRecord;
  Object.defineProperty(sampleSymbol, Symbol('sample-extra'), { enumerable: true, value: true });
  expectSampleRefusal('sample symbol field', reconcileX4UiEditorSampleState(sampleSymbol, sampleCatalog, sampleCatalogAuthority));
  const decoratedValues = [...sampleState.values] as unknown[] & JsonRecord;
  decoratedValues.decorated = true;
  expectSampleRefusal('decorated sample values array', reconcileX4UiEditorSampleState({ ...sampleState, values: decoratedValues }, sampleCatalog, sampleCatalogAuthority));
  const sampleValue = sampleState.values[0];
  assert.ok(sampleValue);
  const sampleValueExtra = { ...sampleValue, extra: true };
  expectSampleRefusal('sample value extra key', reconcileX4UiEditorSampleState({ ...sampleState, values: [sampleValueExtra, ...sampleState.values.slice(1)] }, sampleCatalog, sampleCatalogAuthority));
  const sampleValueAccessor = { ...sampleValue } as JsonRecord;
  Object.defineProperty(sampleValueAccessor, 'value', { enumerable: true, configurable: true, get: () => sampleValue.value });
  expectSampleRefusal('sample value accessor', reconcileX4UiEditorSampleState({ ...sampleState, values: [sampleValueAccessor, ...sampleState.values.slice(1)] }, sampleCatalog, sampleCatalogAuthority));
  const missingSampleValue = { id: sampleValue.id };
  expectSampleRefusal('sample value missing scalar', reconcileX4UiEditorSampleState({ ...sampleState, values: [missingSampleValue, ...sampleState.values.slice(1)] }, sampleCatalog, sampleCatalogAuthority));

  const profileDrifted = projectX4UiEditorSession({
    workspace: sampleWorkspaceValue,
    corpus: canonical,
    profile: { ...sampleExactProfile, drawable: { width: 1280, height: 720 }, uiScale: 1.1 },
    selection: sampleSelection,
    samples: sampleState,
    sampleBinding,
    sampleCatalogAuthority: sampleExactCatalogAuthority,
  });
  assert.equal(profileDrifted.sampleCatalog?.id, sampleCatalog.id, 'profile drift fixture must retain the catalog ID');
  assert.deepEqual(profileDrifted.sampleCatalog?.sourceIdentity, sampleCatalog.sourceIdentity, 'profile drift fixture must retain catalog source identity');
  assert.equal(profileDrifted.sampleCatalog?.targetId, sampleCatalog.targetId, 'profile drift fixture must retain catalog target identity');
  assert.equal(profileDrifted.samples, undefined, 'full selected program/profile drift must clear same-catalog samples before preview');
  assert.equal(profileDrifted.sampleReconciliation.status, 'cleared');

  const staleSelectionProjection = projectX4UiEditorSession({
    workspace: sampleWorkspaceValue,
    corpus: canonical,
    profile: exact.profile,
    selection: { ...sampleSelection, target: { ...sampleSelection.target, id: 'stale-target' } },
    samples: sampleState,
  });
  assert.equal(staleSelectionProjection.samples, undefined, 'stale selection must clear samples before projection');

  const resized = projectX4UiEditorSession({
    ...exact,
    profile: { ...(exact.profile as X4UiEditorProfile), drawable: { width: 1280, height: 720 }, uiScale: 1.1 },
  });
  assert.equal(resized.normalizedProfile.drawable.width, 1280);
  assert.equal(resized.normalizedProfile.drawable.height, 720);
  assert.equal(resized.normalizedProfile.uiScale, 1.1);
  assert.equal(resized.preview.profile.layout?.frame.width, 1280);
  assert.equal(resized.preview.profile.layout?.frame.height, 720);
  assert.equal(resized.paint, null, 'the accepted pipeline must expose the source/profile mismatch instead of painting stale geometry');
  assert.equal(resized.canRender, false);

  const staleSource = projectX4UiEditorSession({
    ...exact,
    workspace: sourceFixture(),
    selection: { ...selection, sourceIdentity: { ...selection.sourceIdentity, sha256: 'f'.repeat(64) } },
  });
  assert.equal(staleSource.canRender, false);
  assert.equal(staleSource.preview.selection.reason, 'source-selection-is-stale-or-ambiguous');
  const staleTarget = projectX4UiEditorSession({
    ...exact,
    selection: { ...selection, target: { ...selection.target, id: 'stale-target' } },
  });
  assert.equal(staleTarget.canRender, false);
  assert.equal(staleTarget.preview.selection.reason, 'target-selection-is-stale-or-ambiguous');

  const generatedShadow = projectX4UiEditorSession({ ...exact, workspace: sourceFixture(true, { uiWidgets: [{ id: 'generated', type: 'button', x: 1, y: 1, w: 2, h: 2, label: 'generated', properties: {} }] }) });
  assert.equal(generatedShadow.source.status, 'generated-shadowing-source');
  assert.equal(generatedShadow.gameVerified, false);

  const missing = projectX4UiEditorSession({ workspace: workspace([]), corpus: undefined, profile: X4_UI_EDITOR_DEFAULT_PROFILE });
  assert.equal(missing.canRender, false);
  assert.equal(missing.preview.source.status, 'unavailable');
  const ambiguous = projectX4UiEditorSession({ workspace: workspace([passthrough('ui.xml', '<addon/>'), passthrough('ui.xml', '<addon/>')]), corpus: undefined, profile: X4_UI_EDITOR_DEFAULT_PROFILE });
  assert.equal(ambiguous.canRender, false);
  assert.equal(ambiguous.source.status, 'unavailable');
  const invalidProfile = projectX4UiEditorSession({ ...exact, profile: { width: 0, height: 720, uiScale: 1.1 } as never });
  assert.equal(invalidProfile.canRender, false);
  assert.equal(invalidProfile.status, 'refused');
  for (const corpus of [undefined, { ok: true, evidenceKind: 'synthetic' }, { malformed: true }, null]) {
    const result = projectX4UiEditorSession({ ...exact, corpus });
    assert.equal(result.canRender, false);
    assert.equal(result.paint, null);
    assert.notEqual(result.preview.status, 'projected');
    assert.equal(result.gameVerified, false);
  }
  const malformed = projectX4UiEditorSession({ workspace: null, corpus: { cycle: undefined }, profile: null } as never);
  assert.equal(malformed.canRender, false);
  assert.equal(malformed.status, 'refused');
  assertFrozenGraph(malformed);

  const presetAll = projectX4UiEditorSession({ ...exact, activePresetId: KEEP_OUT_PRESET_IDS.cockpitConversation });
  assert.equal(presetAll.keepOutPresets.length, 4);
  assert.equal(presetAll.activePreset?.members.length, 5);
  const measured = presetAll.activePreset?.members.filter(member => member.entryId !== KEEP_OUT_IDS.missionMessagesTicker && member.entryId !== KEEP_OUT_IDS.topHudStrip);
  assert.deepEqual(measured?.map(member => member.entry.geometry), [
    { kind: 'horizontal-guide', axis: 'y', y: 0.788 },
    { kind: 'horizontal-guide', axis: 'y', y: 0.74 },
    { kind: 'vertical-guide', axis: 'x', x: 0.664 },
  ]);
  const ticker = presetAll.activePreset?.members.find(member => member.entryId === KEEP_OUT_IDS.missionMessagesTicker);
  const hud = presetAll.activePreset?.members.find(member => member.entryId === KEEP_OUT_IDS.topHudStrip);
  assert.equal(ticker?.projection.status, 'unavailable');
  assert.equal(hud?.projection.status, 'unavailable');
  const presetPaint = presetAll.paint;
  assert.ok(presetPaint && 'plan' in presetPaint);
  if (presetPaint && 'plan' in presetPaint) {
    assert.equal(presetPaint.plan.keepOuts.length, 5);
    assert.equal(new Set(presetPaint.plan.keepOuts.map(item => item.entryId)).size, presetPaint.plan.keepOuts.length);
  }
  const toggled = projectX4UiEditorSession({ ...exact, activePresetId: KEEP_OUT_PRESET_IDS.cockpitConversation, enabledEntryIds: [KEEP_OUT_IDS.conversationBackRow] });
  assert.ok(toggled.paint && 'plan' in toggled.paint);
  if (toggled.paint && 'plan' in toggled.paint) assert.deepEqual(toggled.paint.plan.keepOuts.map(item => item.entryId), [KEEP_OUT_IDS.conversationBackRow]);
  const disabled = projectX4UiEditorSession({ ...exact, activePresetId: KEEP_OUT_PRESET_IDS.cockpitConversation, enabledEntryIds: [] });
  assert.ok(disabled.paint && 'plan' in disabled.paint);
  if (disabled.paint && 'plan' in disabled.paint) assert.equal(disabled.paint.plan.keepOuts.length, 0);
  const replayA = projectX4UiEditorSession(exact);
  const replayB = projectX4UiEditorSession(exact);
  assert.deepEqual(replayA, replayB);

  const empty = X4_UI_EDITOR_EMPTY_CANVAS_STATE;
  assert.equal(empty.status, 'empty');
  assert.equal(empty.surface, null);
  assert.equal(empty.stale, false);
  assertFrozenGraph(empty);
  const surface = fakeSurface();
  const rendered = renderedResult(surface);
  const current = adoptX4UiEditorCanvasResult(empty, rendered as never);
  assert.equal(current.status, 'current');
  assert.equal(current.surface, surface);
  assert.equal(current.stale, false);
  assertFrozenGraph(current.receipt);

  const renderedInvalidCases: readonly [string, (result: JsonRecord) => void][] = [
    ['missing-format', result => { delete resultReceipt(result).format; }],
    ['wrong-format', result => { resultReceipt(result).format = 'other-renderer'; }],
    ['wrong-version', result => { resultReceipt(result).version = 2; }],
    ['forged-game-truth', result => { resultReceipt(result).gameTruth = 'Verified in game'; }],
    ['forged-game-verification', result => { resultReceipt(result).gameVerified = true; }],
    ['forged-verification-truth', result => { (resultReceipt(result).verification as JsonRecord).game = 'Verified in game'; }],
    ['forged-verification-flag', result => { (resultReceipt(result).verification as JsonRecord).gameVerified = true; }],
    ['invalid-layers', result => { resultReceipt(result).layers = ['diagnostics', 'diagnostic-background', 'glyph-alpha-blits', 'keep-out-overlays']; }],
    ['extra-layer', result => { resultReceipt(result).layers = ['diagnostic-background', 'glyph-alpha-blits', 'diagnostics', 'keep-out-overlays', 'extra']; }],
    ['zero-width', result => { resultReceipt(result).width = 0; }],
    ['infinite-height', result => { resultReceipt(result).height = Number.POSITIVE_INFINITY; }],
    ['receipt-surface-mismatch', result => { resultReceipt(result).width = surface.width + 1; }],
    ['empty-command-id', result => { resultReceipt(result).commandIds = ['']; }],
    ['duplicate-command-id', result => { resultReceipt(result).commandIds = ['command-1', 'command-1']; resultReceipt(result).commandCount = 2; }],
    ['command-count-mismatch', result => { resultReceipt(result).commandIds = ['command-1']; resultReceipt(result).commandCount = 0; }],
    ['sparse-command-ids', result => { const sparse: unknown[] = []; sparse.length = 1; resultReceipt(result).commandIds = sparse; }],
    ['invalid-atlas-role', result => { resultReceipt(result).atlasRoles = ['italic']; }],
    ['duplicate-atlas-role', result => { resultReceipt(result).atlasRoles = ['regular', 'regular']; }],
    ['invalid-palette-id', result => { resultReceipt(result).palette = { id: 'x', diagnosticOnly: true }; }],
    ['invalid-palette-truth', result => { resultReceipt(result).palette = { id: 'diagnostic-only', diagnosticOnly: false }; }],
    ['extra-palette-field', result => { resultReceipt(result).palette = { id: 'diagnostic-only', diagnosticOnly: true, extra: true }; }],
    ['extra-receipt-target', result => { resultReceipt(result).target = { shouldNotEnter: true }; }],
    ['extra-result-target', result => { result.target = { shouldNotEnter: true }; }],
    ['extra-result-existing-surface', result => { result.existingSurface = { shouldNotEnter: true }; }],
    ['missing-surface', result => { delete result.surface; }],
    ['missing-receipt', result => { delete result.receipt; }],
  ];
  for (const [name, mutate] of renderedInvalidCases) {
    const invalid = renderedResultRecord(surface);
    mutate(invalid);
    assertInvalidAdoption(current, invalid, surface);
    assert.equal(name.length > 0, true);
  }

  surface.mutable = 1;
  assert.equal(surface.mutable, 1, 'renderer-owned surface remains mutable');
  const refused = adoptX4UiEditorCanvasResult(current, refusedResultRecord() as never);
  assert.equal(refused.status, 'stale');
  assert.equal(refused.surface, surface);
  assert.equal(refused.stale, true);
  assert.equal(refused.receipt?.status, 'refused');
  assert.equal(refused.receipt?.refusal?.code, 'input-refused');
  assert.equal(hasOwn(refused, 'target'), false);
  assert.equal(hasOwn(refused, 'existingSurface'), false);
  assertFrozenGraph(refused.receipt);
  assert.equal(refused.gameTruth, X4_UI_EDITOR_SESSION_GAME_TRUTH);
  assert.equal(refused.gameVerified, false);

  const refusedInvalidCases: readonly [string, (result: JsonRecord) => void][] = [
    ['missing-format', result => { delete resultReceipt(result).format; }],
    ['wrong-format', result => { resultReceipt(result).format = 'other-renderer'; }],
    ['wrong-version', result => { resultReceipt(result).version = 2; }],
    ['wrong-status', result => { resultReceipt(result).status = 'rendered'; }],
    ['missing-refusal', result => { delete resultReceipt(result).refusal; }],
    ['unknown-refusal-code', result => { (resultReceipt(result).refusal as JsonRecord).code = 'unknown-code'; }],
    ['empty-refusal-message', result => { (resultReceipt(result).refusal as JsonRecord).message = '   '; }],
    ['forged-game-truth', result => { resultReceipt(result).gameTruth = 'Verified in game'; }],
    ['forged-game-verification', result => { resultReceipt(result).gameVerified = true; }],
    ['forged-verification-truth', result => { (resultReceipt(result).verification as JsonRecord).game = 'Verified in game'; }],
    ['forged-verification-flag', result => { (resultReceipt(result).verification as JsonRecord).gameVerified = true; }],
    ['extra-refusal-field', result => { (resultReceipt(result).refusal as JsonRecord).extra = true; }],
    ['extra-receipt-target', result => { resultReceipt(result).target = { shouldNotEnter: true }; }],
    ['extra-result-target', result => { result.target = { shouldNotEnter: true }; }],
    ['extra-result-existing-surface', result => { result.existingSurface = { shouldNotEnter: true }; }],
    ['result-surface', result => { result.surface = surface; }],
  ];
  for (const [name, mutate] of refusedInvalidCases) {
    const invalid = refusedResultRecord();
    mutate(invalid);
    assertInvalidAdoption(current, invalid, surface);
    assert.equal(name.length > 0, true);
  }

  const invalidNoPrior = renderedResultRecord(surface);
  delete resultReceipt(invalidNoPrior).format;
  assertInvalidAdoption(empty, invalidNoPrior, null);
  const poisonedPrevious = { ...empty, status: 'empty', surface };
  assertInvalidAdoption(poisonedPrevious, invalidNoPrior, null);

  const noPriorRefusal = adoptX4UiEditorCanvasResult(empty, refusedResultRecord() as never);
  assert.equal(noPriorRefusal.status, 'refused');
  assert.equal(noPriorRefusal.surface, null);
  assert.equal(noPriorRefusal.stale, false);
  assert.equal(noPriorRefusal.receipt?.status, 'refused');
  assert.equal(noPriorRefusal.receipt?.refusal?.code, 'input-refused');
  assertFrozenGraph(noPriorRefusal);
  assert.equal(X4_UI_EDITOR_SESSION_GAME_TRUTH, noPriorRefusal.gameTruth);
  assert.equal(noPriorRefusal.gameVerified, false);

  console.log('x4UiEditorSession.selftest: PASS');
}

void run().catch(error => {
  console.error('x4UiEditorSession.selftest: FAIL');
  console.error(error);
  process.exitCode = 1;
});
