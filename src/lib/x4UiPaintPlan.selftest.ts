import type { ModWorkspace, PassthroughFile } from '../types';
import {
  buildX4UiWorkspaceSource,
  type X4UiWorkspaceSource,
} from './x4UiWorkspaceSource';
import { createX4UiLayoutTargetCatalog } from './x4UiLayoutProgram';
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
import {
  KEEP_OUT_IDS,
  KEEP_OUT_PRESET_IDS,
  projectBuiltInKeepOut,
} from './x4UiKeepOuts';
import {
  buildX4UiPreviewProfile,
  projectX4UiPreviewPipeline,
  type X4UiPreviewSelection,
  type X4UiPreviewPipelineResult,
} from './x4UiPreviewPipeline';
import {
  projectX4UiPaintPlan as projectX4UiPaintPlanDirect,
  type X4UiPaintPlanInput,
  type X4UiPaintPlanResult,
} from './x4UiPaintPlan';
import type { X4UiScene } from './x4UiScene';

type Check = { readonly name: string; readonly pass: boolean; readonly detail?: unknown };
type JsonRecord = Record<string, unknown>;
type PaintTestInput = Omit<X4UiPaintPlanInput, 'previewAuthority'> & { readonly previewAuthority?: unknown };
const checks: Check[] = [];

let issuedPreviewAuthority: X4UiPreviewPipelineResult | undefined;

function asRecord(value: unknown): JsonRecord | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : undefined;
}

function alternateCodePointFor(
  canonical: X4UiCorpusCanonicalSuccess,
  text: JsonRecord,
  glyph: JsonRecord,
): number | undefined {
  const font = text.font === 'Zekton Bold' ? canonical.fonts.bold : canonical.fonts.regular;
  if (typeof glyph.codePoint !== 'number' || typeof glyph.glyphIndex !== 'number') return undefined;
  const alternate = font.descriptor.codePointToGlyphIndex.findIndex((index, codePoint) => codePoint !== glyph.codePoint && index === glyph.glyphIndex);
  return alternate < 0 ? undefined : alternate;
}

function projectX4UiPaintPlan(input: PaintTestInput): X4UiPaintPlanResult {
  const authorityInput = {
    ...input,
    previewAuthority: input.previewAuthority ?? issuedPreviewAuthority,
  } as X4UiPaintPlanInput;
  return projectX4UiPaintPlanDirect(authorityInput);
}

function check(name: string, pass: boolean, detail?: unknown): void {
  checks.push({ name, pass, ...(detail === undefined ? {} : { detail }) });
}

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
  for (let index = 0; index < bytes.length; index += 1) bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
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
  const originalValue = (globalThis as unknown as { crypto?: unknown }).crypto;
  let hashIndex = 0;
  const fakeCrypto = {
    subtle: {
      digest: async (): Promise<ArrayBuffer> => {
        const expected = expectedHashes[hashIndex++];
        if (expected === undefined) throw new Error('paint-plan canonical hash count mismatch');
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
    check('canonical loader restores platform crypto', (globalThis as unknown as { crypto?: unknown }).crypto === originalValue);
  }
}

function pathFromQuery(url: string, key: string): string {
  const query = url.slice(url.indexOf('?') + 1).split('&');
  const pair = query.find(part => part.startsWith(`${key}=`));
  if (!pair) throw new Error(`missing query ${key}`);
  return decodeURIComponent(pair.slice(key.length + 1));
}

function manifestStatus(root: string, generation: string): JsonRecord {
  return {
    available: true,
    state: 'ready',
    root,
    current: { generation, root, generatedAt: '2026-08-12T00:00:00.000Z' },
  };
}

async function loadCanonicalFixture(): Promise<X4UiCorpusCanonicalSuccess> {
  const root = 'paint-plan-canonical-root';
  const generation = 'paint-plan-canonical-generation';
  const contract = X4_UI_CORPUS_9_00_CONTRACT;
  const buffers = new Map<string, Uint8Array>([
    [contract.helper.relativePath, new TextEncoder().encode('-- paint plan canonical helper\n')],
    [contract.widget.relativePath, new TextEncoder().encode('-- paint plan canonical widget\n')],
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
    generatedAt: '2026-08-12T00:00:00.000Z',
    manifestGeneration: generation,
    manifest: { available: true, state: 'ready', root, current: { generation, root, generatedAt: '2026-08-12T00:00:00.000Z' } },
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
  if (!isX4UiCorpusCanonicalSuccess(result)) throw new Error('canonical loader did not issue canonical success');
  return result;
}

function passthrough(path: string, content: string, extra: Partial<PassthroughFile> = {}): PassthroughFile {
  return { path, content, ...extra };
}

function workspace(files: PassthroughFile[]): ModWorkspace {
  return {
    id: 'batch6b-selftest',
    name: 'Batch 6B selftest',
    version: '1.0.0',
    author: 'Forge',
    description: 'source-pinned preview pipeline fixture',
    nodes: [],
    links: [],
    uiWidgets: [],
    uiTheme: { backgroundColor: '#000000', borderColor: '#111111', accentColor: '#00ffff', opacity: 1, showIcons: true },
    compileSettings: { md: false, ui: true, ai: false, library: false, translations: false, patches: false },
    passthroughFiles: files,
  } as ModWorkspace;
}

function sourceFixture(): X4UiWorkspaceSource {
  const lua = [
    'local menu = { name = "Canonical", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80, layer = 1 })',
    'local table = frame:addTable(4, { width = 100, reserveScrollBar = false, scaling = false })',
    'table:setColWidth(1, 20, false)',
    'table:setColWidth(2, 20, false)',
    'table:setColWidth(3, 20, false)',
    'table:setColWidth(4, 20, false)',
    'local row = table:addRow(false, { paddingTop = 1, paddingBottom = 1, borderBelow = false, fixed = false })',
    'row[1]:setColSpan(2):createText("canonical", { height = 12, minRowHeight = 10 })',
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
  return buildX4UiWorkspaceSource(workspace([
    passthrough('ui.xml', [
      '<?xml version="1.0" encoding="utf-8"?>',
      '<addon name="canonical-fixture">',
      '  <environment type="menus">',
      '    <file name="ui/canonical.lua" />',
      '  </environment>',
      '</addon>',
      '',
    ].join('\n')),
    passthrough('ui/canonical.lua', lua, { reason: 'unparsed' }),
  ]));
}

function closedDomainSourceFixture(): X4UiWorkspaceSource {
  const lua = [
    'local menu = { name = "ClosedDomain" }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(1, { width = 100, reserveScrollBar = false, scaling = false })',
    'table:setColWidth(1, 100, false)',
    'local row = table:addRow(false, {})',
    'row[1]:createText("primary", { height = 8 })',
    'local secondaryMenu = { name = "ClosedDomainSecondary", layer = 1 }',
    'local secondaryFrame = Helper.createFrameHandle(secondaryMenu, { width = 100, height = 80, layer = 1 })',
    'local secondaryTable = secondaryFrame:addTable(1, { width = 20, reserveScrollBar = false, scaling = false })',
    'secondaryTable:setColWidth(1, 20, false)',
    'local secondaryRow = secondaryTable:addRow(false, {})',
    'secondaryRow[1]:createText("secondary", { height = 8 })',
    'secondaryFrame:display()',
    'frame:display()',
    '',
  ].join('\n');
  return buildX4UiWorkspaceSource(workspace([
    passthrough('ui.xml', [
      '<?xml version="1.0" encoding="utf-8"?>',
      '<addon name="closed-domain-fixture">',
      '  <environment type="menus">',
      '    <file name="ui/closed-domain.lua" />',
      '  </environment>',
      '</addon>',
      '',
    ].join('\n')),
    passthrough('ui/closed-domain.lua', lua, { reason: 'unparsed' }),
  ]));
}

function selectionFor(source: X4UiWorkspaceSource, path = 'ui/canonical.lua'): X4UiPreviewSelection {
  const file = source.bundle?.sourceFiles.find(candidate => candidate.path === path);
  if (!file) throw new Error('paint source file missing');
  const catalog = createX4UiLayoutTargetCatalog(file.callModel);
  const target = catalog.targets.find(candidate => candidate.kind === 'top-level');
  if (!target) throw new Error('paint top-level target missing');
  return { sourceIndex: file.index, path: file.path, sourceIdentity: catalog.sourceIdentity, target: { ...target, id: target.id } };
}

function clonedScene(scene: X4UiScene): X4UiScene {
  return JSON.parse(JSON.stringify(scene)) as X4UiScene;
}

type PaintSceneNode = X4UiScene['frames'][number]
  | X4UiScene['tables'][number]
  | X4UiScene['rows'][number]
  | X4UiScene['cells'][number]
  | X4UiScene['widgets'][number]
  | X4UiScene['texts'][number]
  | X4UiScene['glyphs'][number];

const paintSceneNodes = (scene: X4UiScene): readonly PaintSceneNode[] => [
  ...scene.frames,
  ...scene.tables,
  ...scene.rows,
  ...scene.cells,
  ...scene.widgets,
  ...scene.texts,
  ...scene.glyphs,
];

const ownsSceneField = (node: PaintSceneNode, field: string): boolean => Object.prototype.hasOwnProperty.call(node, field);

const noOwnGeometryField = (node: PaintSceneNode): boolean =>
  !ownsSceneField(node, 'rect') && !ownsSceneField(node, 'outerRect') && !ownsSceneField(node, 'naturalRect');

const withObjectPrototypePollution = <T>(field: string, value: unknown, run: () => T): T => {
  const original = Object.getOwnPropertyDescriptor(Object.prototype, field);
  try {
    Object.defineProperty(Object.prototype, field, {
      configurable: true,
      enumerable: false,
      writable: true,
      value,
    });
    return run();
  } finally {
    if (original === undefined) Reflect.deleteProperty(Object.prototype, field);
    else Object.defineProperty(Object.prototype, field, original);
  }
};

const paintResultSignature = (result: X4UiPaintPlanResult): string => JSON.stringify(result);

const paintGeometryCommandDetail = (result: X4UiPaintPlanResult | undefined, nodeId: string | undefined): unknown => {
  if (result === undefined || nodeId === undefined || result.status === 'refused') return undefined;
  const command = result.plan.layers[0]?.commands.find(candidate => candidate.nodeId === nodeId);
  if (command === undefined) return undefined;
  const record = command as unknown as JsonRecord;
  return {
    id: command.id,
    order: command.order,
    style: record.style,
    geometry: record.geometry,
    clipRect: record.clipRect,
  };
};

function clonedSource(source: X4UiScene['frames'][number]['source']): X4UiScene['frames'][number]['source'] {
  return JSON.parse(JSON.stringify(source)) as X4UiScene['frames'][number]['source'];
}

function frameForNode(node: X4UiScene['frames'][number] | X4UiScene['tables'][number] | X4UiScene['rows'][number] | X4UiScene['cells'][number] | X4UiScene['widgets'][number] | X4UiScene['texts'][number], byId: ReadonlyMap<string, typeof node>): X4UiScene['frames'][number] | undefined {
  const visited = new Set<string>();
  let current: typeof node | undefined = node;
  while (current !== undefined && !visited.has(current.id)) {
    visited.add(current.id);
    if (current.kind === 'frame') return current;
    current = current.parentId === undefined ? undefined : byId.get(current.parentId);
  }
  return undefined;
}

function projectedPlan(input: PaintTestInput): Extract<X4UiPaintPlanResult, { readonly status: 'projected' | 'partial' }> | undefined {
  const result = projectX4UiPaintPlan(input);
  return result.status === 'projected' || result.status === 'partial' ? result : undefined;
}

type MutationProof = Readonly<Record<string, unknown>> & { readonly changed: boolean };

type PrototypeSceneField = 'rect' | 'zOrder' | 'outerRect' | 'naturalRect' | 'clipRect';

function prototypeObjectPollutionCase(
  name: string,
  scene: X4UiScene | undefined,
  corpus: X4UiCorpusCanonicalSuccess | undefined,
  authority: X4UiPreviewPipelineResult | undefined,
  field: PrototypeSceneField,
  target: PaintSceneNode | undefined,
  value: unknown,
  extraFixtureReady = true,
): void {
  const baseline = scene === undefined || corpus === undefined || authority === undefined
    ? undefined
    : projectX4UiPaintPlan({ scene, corpus, previewAuthority: authority });
  const baselineAccepted = baseline?.status === 'projected' || baseline?.status === 'partial';
  const fixtureReady = baselineAccepted && target !== undefined && extraFixtureReady;
  let polluted: X4UiPaintPlanResult | undefined;
  let threw = false;
  let error: string | undefined;
  if (fixtureReady && scene !== undefined && corpus !== undefined && authority !== undefined) {
    try {
      polluted = withObjectPrototypePollution(field, value, () => projectX4UiPaintPlan({ scene, corpus, previewAuthority: authority }));
    } catch (caught) {
      threw = true;
      error = caught instanceof Error ? caught.message : String(caught);
    }
  }
  const accepted = polluted?.status === 'projected' || polluted?.status === 'partial';
  const statusMatches = baseline !== undefined && polluted !== undefined && polluted.status === baseline.status;
  const changed = baseline !== undefined && polluted !== undefined && paintResultSignature(baseline) !== paintResultSignature(polluted);
  check(name, fixtureReady && !threw && statusMatches && !changed, {
    fixtureReady,
    field,
    target: target === undefined ? undefined : { id: target.id, kind: target.kind, ownKeys: Object.keys(target) },
    threw,
    error,
    baselineStatus: baseline?.status,
    pollutedStatus: polluted?.status,
    inheritedValue: value,
    causalAcceptedWithChangedPaint: accepted && changed,
    causalPrototypeEffect: changed,
    baselineGeometry: paintGeometryCommandDetail(baseline, target?.id),
    pollutedGeometry: paintGeometryCommandDetail(polluted, target?.id),
  });
}

function customPrototypeRefusalCase(
  name: string,
  scene: X4UiScene | undefined,
  corpus: X4UiCorpusCanonicalSuccess | undefined,
  authority: X4UiPreviewPipelineResult | undefined,
  inheritedField: PrototypeSceneField,
): void {
  const baseline = scene === undefined || corpus === undefined || authority === undefined
    ? undefined
    : projectX4UiPaintPlan({ scene, corpus, previewAuthority: authority });
  const candidate = scene === undefined ? undefined : clonedScene(scene);
  const target = candidate === undefined ? undefined : paintSceneNodes(candidate).find(node => node.kind !== 'glyph');
  const fixtureReady = (baseline?.status === 'projected' || baseline?.status === 'partial') && target !== undefined;
  let result: X4UiPaintPlanResult | undefined;
  let threw = false;
  let error: string | undefined;
  let restored = false;
  if (fixtureReady && candidate !== undefined && corpus !== undefined && authority !== undefined && target !== undefined) {
    const originalPrototype = Object.getPrototypeOf(target);
    try {
      Object.setPrototypeOf(target, { [inheritedField]: { x: 0, y: 0, width: 1, height: 1 } });
      result = projectX4UiPaintPlan({ scene: candidate, corpus, previewAuthority: authority });
    } catch (caught) {
      threw = true;
      error = caught instanceof Error ? caught.message : String(caught);
    } finally {
      Object.setPrototypeOf(target, originalPrototype);
      restored = Object.getPrototypeOf(target) === originalPrototype;
    }
  }
  check(name, fixtureReady && !threw && restored && result?.status === 'refused' && result.refusal.code === 'invalid-scene', {
    fixtureReady,
    target: target === undefined ? undefined : { id: target.id, kind: target.kind },
    inheritedField,
    threw,
    error,
    restored,
    baselineStatus: baseline?.status,
    resultStatus: result?.status,
    refusal: result?.status === 'refused' ? result.refusal : undefined,
  });
}

function prototypeDescriptorRestored(field: string, original: PropertyDescriptor | undefined): boolean {
  const restored = Object.getOwnPropertyDescriptor(Object.prototype, field);
  return original === undefined
    ? restored === undefined
    : restored?.configurable === original.configurable
      && restored?.enumerable === original.enumerable
      && restored?.writable === original.writable
      && restored?.value === original.value
      && restored?.get === original.get
      && restored?.set === original.set;
}

function closedDomainScenePollutionCase(
  name: string,
  input: PaintTestInput | undefined,
  field: string,
  inheritedValue: unknown,
  target: object | undefined,
): void {
  const baseline = input === undefined ? undefined : projectX4UiPaintPlan(input);
  const baselineAccepted = baseline?.status === 'projected' || baseline?.status === 'partial';
  const fixtureReady = baselineAccepted && target !== undefined && !Object.prototype.hasOwnProperty.call(target, field);
  const original = Object.getOwnPropertyDescriptor(Object.prototype, field);
  let polluted: X4UiPaintPlanResult | undefined;
  let threw = false;
  let error: string | undefined;
  if (fixtureReady && input !== undefined) {
    try {
      polluted = withObjectPrototypePollution(field, inheritedValue, () => projectX4UiPaintPlan(input));
    } catch (caught) {
      threw = true;
      error = caught instanceof Error ? caught.message : String(caught);
    }
  }
  const restored = prototypeDescriptorRestored(field, original);
  const changed = baseline !== undefined && polluted !== undefined && paintResultSignature(baseline) !== paintResultSignature(polluted);
  check(name, fixtureReady && !threw && restored && polluted !== undefined && paintResultSignature(polluted) === paintResultSignature(baseline), {
    fixtureReady,
    field,
    targetOwnKeys: target === undefined ? undefined : Object.keys(target),
    baselineStatus: baseline?.status,
    pollutedStatus: polluted?.status,
    causalPrototypeEffect: changed,
    changedAcceptance: baseline?.status !== polluted?.status,
    threw,
    error,
    restored,
  });
}

function closedDomainInputPollutionCase(
  name: string,
  scene: X4UiScene | undefined,
  corpus: X4UiCorpusCanonicalSuccess | undefined,
  authority: X4UiPreviewPipelineResult | undefined,
  field: 'keepOuts' | 'selection',
  inheritedValue: unknown,
): void {
  const input = scene === undefined || corpus === undefined || authority === undefined
    ? undefined
    : { scene, corpus, previewAuthority: authority };
  const baseline = input === undefined ? undefined : projectX4UiPaintPlanDirect(input);
  const baselineAccepted = baseline?.status === 'projected' || baseline?.status === 'partial';
  const fixtureReady = baselineAccepted && input !== undefined && !Object.prototype.hasOwnProperty.call(input, field);
  const original = Object.getOwnPropertyDescriptor(Object.prototype, field);
  let polluted: X4UiPaintPlanResult | undefined;
  let threw = false;
  let error: string | undefined;
  if (fixtureReady && input !== undefined) {
    try {
      polluted = withObjectPrototypePollution(field, inheritedValue, () => projectX4UiPaintPlanDirect(input));
    } catch (caught) {
      threw = true;
      error = caught instanceof Error ? caught.message : String(caught);
    }
  }
  const restored = prototypeDescriptorRestored(field, original);
  const changed = baseline !== undefined && polluted !== undefined && paintResultSignature(baseline) !== paintResultSignature(polluted);
  check(name, fixtureReady && !threw && restored && polluted !== undefined && paintResultSignature(polluted) === paintResultSignature(baseline), {
    fixtureReady,
    field,
    baselineStatus: baseline?.status,
    pollutedStatus: polluted?.status,
    baselineSelectedNodeIds: baseline?.status === 'refused' ? undefined : baseline?.plan.selectedNodeIds,
    pollutedSelectedNodeIds: polluted?.status === 'refused' ? undefined : polluted?.plan.selectedNodeIds,
    baselineKeepOuts: baseline?.status === 'refused' ? undefined : baseline?.plan.keepOuts.map(item => item.entryId),
    pollutedKeepOuts: polluted?.status === 'refused' ? undefined : polluted?.plan.keepOuts.map(item => item.entryId),
    causalPrototypeEffect: changed,
    changedAcceptance: baseline?.status !== polluted?.status,
    threw,
    error,
    restored,
  });
}

function closedDomainCustomPrototypeRefusal(
  name: string,
  scene: X4UiScene | undefined,
  corpus: X4UiCorpusCanonicalSuccess | undefined,
  authority: X4UiPreviewPipelineResult | undefined,
  targetFor: (candidate: X4UiScene) => object | undefined,
  inheritedValues: Readonly<Record<string, unknown>>,
): void {
  const baseline = scene === undefined || corpus === undefined || authority === undefined
    ? undefined
    : projectX4UiPaintPlan({ scene, corpus, previewAuthority: authority });
  const candidate = scene === undefined ? undefined : clonedScene(scene);
  const target = candidate === undefined ? undefined : targetFor(candidate);
  const fixtureReady = (baseline?.status === 'projected' || baseline?.status === 'partial') && candidate !== undefined && target !== undefined;
  let result: X4UiPaintPlanResult | undefined;
  let threw = false;
  let error: string | undefined;
  let restored = false;
  if (fixtureReady && candidate !== undefined && target !== undefined && corpus !== undefined && authority !== undefined) {
    const originalPrototype = Object.getPrototypeOf(target);
    try {
      Object.setPrototypeOf(target, inheritedValues);
      result = projectX4UiPaintPlan({ scene: candidate, corpus, previewAuthority: authority });
    } catch (caught) {
      threw = true;
      error = caught instanceof Error ? caught.message : String(caught);
    } finally {
      Object.setPrototypeOf(target, originalPrototype);
      restored = Object.getPrototypeOf(target) === originalPrototype;
    }
  }
  check(name, fixtureReady && !threw && restored && result?.status === 'refused', {
    fixtureReady,
    inheritedFields: Object.keys(inheritedValues),
    baselineStatus: baseline?.status,
    resultStatus: result?.status,
    refusal: result?.status === 'refused' ? result.refusal : undefined,
    threw,
    error,
    restored,
  });
}

function closedDomainEquivalentInheritedFieldsRefusal(
  name: string,
  scene: X4UiScene | undefined,
  corpus: X4UiCorpusCanonicalSuccess | undefined,
  authority: X4UiPreviewPipelineResult | undefined,
  targetFor: (candidate: X4UiScene) => JsonRecord | undefined,
  fields: readonly string[],
): void {
  const baseline = scene === undefined || corpus === undefined || authority === undefined
    ? undefined
    : projectX4UiPaintPlan({ scene, corpus, previewAuthority: authority });
  const candidate = scene === undefined ? undefined : clonedScene(scene);
  const target = candidate === undefined ? undefined : targetFor(candidate);
  const descriptors = target === undefined
    ? []
    : fields.map(field => [field, Object.getOwnPropertyDescriptor(target, field)] as const);
  const fixtureReady = (baseline?.status === 'projected' || baseline?.status === 'partial')
    && candidate !== undefined
    && target !== undefined
    && descriptors.every(([, descriptor]) => descriptor !== undefined && Object.prototype.hasOwnProperty.call(descriptor, 'value'));
  let result: X4UiPaintPlanResult | undefined;
  let threw = false;
  let error: string | undefined;
  let restored = false;
  if (fixtureReady && candidate !== undefined && target !== undefined && corpus !== undefined && authority !== undefined) {
    const originalPrototype = Object.getPrototypeOf(target);
    const inheritedValues: JsonRecord = {};
    for (const [field, descriptor] of descriptors) inheritedValues[field] = descriptor?.value;
    try {
      for (const [field] of descriptors) Reflect.deleteProperty(target, field);
      Object.setPrototypeOf(target, inheritedValues);
      result = projectX4UiPaintPlan({ scene: candidate, corpus, previewAuthority: authority });
    } catch (caught) {
      threw = true;
      error = caught instanceof Error ? caught.message : String(caught);
    } finally {
      Object.setPrototypeOf(target, originalPrototype);
      for (const [field, descriptor] of descriptors) {
        if (descriptor !== undefined) Object.defineProperty(target, field, descriptor);
      }
      restored = Object.getPrototypeOf(target) === originalPrototype
        && descriptors.every(([field, descriptor]) => {
          const current = Object.getOwnPropertyDescriptor(target, field);
          return current?.value === descriptor?.value;
        });
    }
  }
  check(name, fixtureReady && !threw && restored && result?.status === 'refused', {
    fixtureReady,
    fields,
    baselineStatus: baseline?.status,
    resultStatus: result?.status,
    refusal: result?.status === 'refused' ? result.refusal : undefined,
    changedAcceptance: baseline?.status !== result?.status,
    threw,
    error,
    restored,
  });
}

function clonedPaintInput(input: PaintTestInput): PaintTestInput {
  return {
    ...input,
    scene: clonedScene(input.scene as X4UiScene),
    ...(input.keepOuts === undefined ? {} : { keepOuts: JSON.parse(JSON.stringify(input.keepOuts)) as X4UiPaintPlanInput['keepOuts'] }),
    ...(input.selection === undefined ? {} : { selection: JSON.parse(JSON.stringify(input.selection)) as X4UiPaintPlanInput['selection'] }),
  };
}

function phase6SceneAttack(
  name: string,
  scene: X4UiScene,
  canonical: X4UiCorpusCanonicalSuccess,
  mutate: (candidate: X4UiScene) => MutationProof,
): void {
  const baseline = projectX4UiPaintPlan({ scene, corpus: canonical });
  const candidate = clonedScene(scene);
  const before = JSON.stringify(candidate);
  let proof: MutationProof = { changed: false };
  let result: X4UiPaintPlanResult | undefined;
  let threw = false;
  let error: string | undefined;
  try {
    proof = mutate(candidate);
    result = projectX4UiPaintPlan({ scene: candidate, corpus: canonical });
  } catch (caught) {
    threw = true;
    error = caught instanceof Error ? caught.message : String(caught);
  }
  const after = JSON.stringify(candidate);
  const fixtureReady = baseline.status !== 'refused' && proof.changed === true && before !== after;
  check(name, fixtureReady && !threw && result?.status === 'refused', {
    fixtureReady,
    changed: before !== after,
    proof,
    threw,
    error,
    validation: result === undefined ? undefined : { status: result.status, refusal: result.status === 'refused' ? result.refusal : undefined },
  });
}

function phase6InputAttack(
  name: string,
  input: PaintTestInput,
  mutate: (candidate: PaintTestInput) => MutationProof,
): void {
  const baseline = projectX4UiPaintPlan(input);
  const candidate = clonedPaintInput(input);
  const before = JSON.stringify(candidate);
  let proof: MutationProof = { changed: false };
  let result: X4UiPaintPlanResult | undefined;
  let threw = false;
  let error: string | undefined;
  try {
    proof = mutate(candidate);
    result = projectX4UiPaintPlan(candidate);
  } catch (caught) {
    threw = true;
    error = caught instanceof Error ? caught.message : String(caught);
  }
  const after = JSON.stringify(candidate);
  const fixtureReady = baseline.status !== 'refused' && proof.changed === true && before !== after;
  check(name, fixtureReady && !threw && result?.status === 'refused', {
    fixtureReady,
    changed: before !== after,
    proof,
    threw,
    error,
    validation: result === undefined ? undefined : { status: result.status, refusal: result.status === 'refused' ? result.refusal : undefined },
  });
}

function phaseCSceneAttack(
  name: string,
  input: PaintTestInput,
  mutate: (candidate: X4UiScene) => MutationProof,
): void {
  const baseline = projectX4UiPaintPlan(input);
  const candidateInput = clonedPaintInput(input);
  const candidate = candidateInput.scene as X4UiScene;
  const before = JSON.stringify(candidate);
  let proof: MutationProof = { changed: false };
  let result: X4UiPaintPlanResult | undefined;
  let threw = false;
  let error: string | undefined;
  try {
    proof = mutate(candidate);
    result = projectX4UiPaintPlan(candidateInput);
  } catch (caught) {
    threw = true;
    error = caught instanceof Error ? caught.message : String(caught);
  }
  const after = JSON.stringify(candidate);
  const fixtureReady = baseline.status !== 'refused' && proof.changed === true && before !== after;
  check(name, fixtureReady && !threw && result?.status === 'refused', {
    fixtureReady,
    changed: before !== after,
    proof,
    threw,
    error,
    validation: result === undefined ? undefined : { status: result.status, refusal: result.status === 'refused' ? result.refusal : undefined },
  });
}

async function main(): Promise<void> {
  let canonical: X4UiCorpusCanonicalSuccess | undefined;
  let scene: X4UiScene | undefined;
  let baseInput: PaintTestInput | undefined;
  try {
    canonical = await loadCanonicalFixture();
    const source = sourceFixture();
    const selection = selectionFor(source);
    const profile = buildX4UiPreviewProfile({
      id: 'paint-profile',
      provenance: 'Batch 6C source-backed selftest',
      truthGrade: 'supplied',
      source: selection.sourceIdentity,
      drawable: { width: 100, height: 80 },
      uiScale: 1,
      minTextHeight: 10,
    });
    const pipeline = projectX4UiPreviewPipeline({ source, corpus: canonical, profile: {
      id: profile.id,
      provenance: profile.provenance,
      truthGrade: 'supplied',
      source: selection.sourceIdentity,
      drawable: { width: 100, height: 80 },
      uiScale: 1,
      minTextHeight: 10,
    }, selection });
    issuedPreviewAuthority = pipeline;
    scene = pipeline.scene && (pipeline.scene.status === 'projected' || pipeline.scene.status === 'partial')
      ? pipeline.scene.scene
      : undefined;
    baseInput = scene === undefined ? undefined : { scene, corpus: canonical };
    check('loader-issued canonical corpus and source-backed Scene fixture', canonical !== undefined && scene !== undefined, { pipelineStatus: pipeline.status, sceneStatus: pipeline.scene?.status, sceneRefusal: pipeline.scene && pipeline.scene.status === 'refused' ? pipeline.scene.refusal : undefined, programStatus: pipeline.program?.status, operationCount: pipeline.program && 'program' in pipeline.program ? pipeline.program.program.operations.length : undefined, gaps: pipeline.gaps, selection: pipeline.selection, source: pipeline.source.status, corpus: pipeline.corpus.status });
  } catch (error) {
    check('loader-issued canonical corpus and source-backed Scene fixture', false, { error: error instanceof Error ? error.message : String(error) });
  }

  if (baseInput === undefined || scene === undefined || canonical === undefined) {
    check('fixture-dependent paint plan cases have a usable baseline', false);
  } else {
    const viewport = { width: scene.drawableRect.width, height: scene.drawableRect.height };
    let closedDomainAuthority: X4UiPreviewPipelineResult | undefined;
    let closedDomainScene: X4UiScene | undefined;
    let closedDomainFixtureError: string | undefined;
    try {
      const closedSource = closedDomainSourceFixture();
      const closedSelection = selectionFor(closedSource, 'ui/closed-domain.lua');
      closedDomainAuthority = projectX4UiPreviewPipeline({
        source: closedSource,
        corpus: canonical,
        profile: {
          id: 'closed-domain-paint-profile',
          provenance: 'Batch 6C.2 closed-domain selftest',
          truthGrade: 'supplied',
          source: closedSelection.sourceIdentity,
          drawable: { width: 100, height: 80 },
          uiScale: 1,
          minTextHeight: 10,
        },
        selection: closedSelection,
      });
      closedDomainScene = closedDomainAuthority.scene !== undefined
        && (closedDomainAuthority.scene.status === 'projected' || closedDomainAuthority.scene.status === 'partial')
        ? closedDomainAuthority.scene.scene
        : undefined;
    } catch (caught) {
      closedDomainFixtureError = caught instanceof Error ? caught.message : String(caught);
    }
    const closedDomainBaseline = closedDomainScene === undefined || closedDomainAuthority === undefined
      ? undefined
      : projectX4UiPaintPlan({ scene: closedDomainScene, corpus: canonical, previewAuthority: closedDomainAuthority });
    check('closed-domain-real-issued-partial-fixture-is-ready',
      closedDomainScene !== undefined
      && closedDomainAuthority !== undefined
      && (closedDomainBaseline?.status === 'projected' || closedDomainBaseline?.status === 'partial'), {
        fixtureReady: closedDomainScene !== undefined && closedDomainAuthority !== undefined,
        error: closedDomainFixtureError,
        pipelineStatus: closedDomainAuthority?.status,
        sceneStatus: closedDomainScene?.status,
        paintStatus: closedDomainBaseline?.status,
        refusal: closedDomainBaseline?.status === 'refused' ? closedDomainBaseline.refusal : undefined,
        counts: closedDomainScene === undefined ? undefined : {
          frames: closedDomainScene.frames.length,
          texts: closedDomainScene.texts.length,
          gaps: closedDomainScene.gaps.length,
        },
        textFacts: closedDomainScene?.texts.map(text => ({
          id: text.id,
          ownKeys: Object.keys(text),
          contentSelection: text.contentSelection,
          font: text.font,
          hasLayout: text.layout !== undefined,
          lines: text.lines.map(line => ({ glyphIds: line.glyphIds.length, displayedText: line.displayedText })),
        })),
      });
    const missingAuthorityResult = projectX4UiPaintPlanDirect({ scene, corpus: canonical } as unknown as X4UiPaintPlanInput);
    check('phaseC-authority-missing-refuses', missingAuthorityResult.status === 'refused', {
      fixtureReady: scene !== undefined && canonical !== undefined,
      status: missingAuthorityResult.status,
      refusal: missingAuthorityResult.status === 'refused' ? missingAuthorityResult.refusal : undefined,
    });
    const clonedAuthority = issuedPreviewAuthority === undefined ? undefined : JSON.parse(JSON.stringify(issuedPreviewAuthority));
    const clonedAuthorityResult = projectX4UiPaintPlan({ ...baseInput, previewAuthority: clonedAuthority });
    check('phaseC-authority-clone-refuses', clonedAuthority !== undefined && clonedAuthorityResult.status === 'refused', {
      fixtureReady: issuedPreviewAuthority !== undefined && clonedAuthority !== undefined,
      status: clonedAuthorityResult.status,
      refusal: clonedAuthorityResult.status === 'refused' ? clonedAuthorityResult.refusal : undefined,
    });
    const staleAuthority = issuedPreviewAuthority === undefined ? undefined : { ...JSON.parse(JSON.stringify(issuedPreviewAuthority)), status: 'needs-selection' };
    const staleAuthorityResult = projectX4UiPaintPlan({ ...baseInput, previewAuthority: staleAuthority });
    check('phaseC-authority-stale-refuses', staleAuthority !== undefined && staleAuthorityResult.status === 'refused', {
      fixtureReady: issuedPreviewAuthority !== undefined && staleAuthority !== undefined,
      status: staleAuthorityResult.status,
      refusal: staleAuthorityResult.status === 'refused' ? staleAuthorityResult.refusal : undefined,
    });

    const prototypeGeometryScene = scene;
    const prototypeGeometryAuthority = issuedPreviewAuthority;
    const prototypeGeometryTarget = prototypeGeometryScene === undefined
      ? undefined
      : paintSceneNodes(prototypeGeometryScene).find(node => node.kind !== 'glyph' && noOwnGeometryField(node));
    const prototypeGeometryValue = prototypeGeometryScene === undefined
      ? undefined
      : {
        x: prototypeGeometryScene.drawableRect.x,
        y: prototypeGeometryScene.drawableRect.y,
        width: prototypeGeometryScene.drawableRect.width,
        height: prototypeGeometryScene.drawableRect.height,
      };
    prototypeObjectPollutionCase('prototype-boundary-inherited-rect-cannot-change-accepted-paint', prototypeGeometryScene, canonical, prototypeGeometryAuthority, 'rect', prototypeGeometryTarget, prototypeGeometryValue);
    prototypeObjectPollutionCase('prototype-boundary-inherited-outerRect-cannot-change-accepted-paint', prototypeGeometryScene, canonical, prototypeGeometryAuthority, 'outerRect', prototypeGeometryTarget, prototypeGeometryValue);
    prototypeObjectPollutionCase('prototype-boundary-inherited-naturalRect-cannot-change-accepted-paint', prototypeGeometryScene, canonical, prototypeGeometryAuthority, 'naturalRect', prototypeGeometryTarget, prototypeGeometryValue);

    const prototypeZOrderTarget = paintSceneNodes(scene).find(node => !ownsSceneField(node, 'zOrder'));
    const prototypeZOrderAnchor = scene.frames.find(node => ownsSceneField(node, 'zOrder'));
    prototypeObjectPollutionCase('prototype-boundary-inherited-zOrder-cannot-change-paint-order', scene, canonical, issuedPreviewAuthority, 'zOrder', prototypeZOrderTarget, Number.MAX_SAFE_INTEGER, prototypeZOrderAnchor !== undefined);

    const prototypeClipTarget = paintSceneNodes(scene).find(node => !ownsSceneField(node, 'clipRect'));
    prototypeObjectPollutionCase('prototype-boundary-inherited-clipRect-cannot-change-paint-clipping', scene, canonical, issuedPreviewAuthority, 'clipRect', prototypeClipTarget, { x: -1, y: 0, width: 1, height: 1 });
    customPrototypeRefusalCase('prototype-boundary-custom-nonplain-node-refuses-deterministically', scene, canonical, issuedPreviewAuthority, 'rect');

    phaseCSceneAttack('phaseC-layout-line-source-codepoint-range', baseInput, candidate => {
      const text = candidate.texts.find(item => item.lines.length > 0);
      const line = text?.lines[0];
      if (!line) return { changed: false };
      const range = (line as unknown as JsonRecord).sourceCodePointRange as JsonRecord;
      const before = range.end;
      range.end = (before as number) + 1;
      return { changed: range.end !== before, textId: text.id, lineIndex: line.lineIndex, before, after: range.end };
    });
    for (const [field, delta] of [['x', 1], ['y', 1], ['lineBoxY', 1]] as const) {
      phaseCSceneAttack(`phaseC-layout-glyph-quad-${field}`, baseInput, candidate => {
        const glyph = candidate.glyphs[0];
        if (!glyph) return { changed: false };
        const quad = glyph.quad as unknown as JsonRecord;
        const before = quad[field];
        if (typeof before !== 'number') return { changed: false, before };
        quad[field] = before + delta;
        return { changed: quad[field] !== before, glyphId: glyph.id, field, before, after: quad[field] };
      });
    }
    phaseCSceneAttack('phaseC-source-coherent-file-rewrite', baseInput, candidate => {
      const before = candidate.profile.source.file;
      const after = `${before}.coherent-rewrite`;
      const seen = new Set<object>();
      const rewrite = (value: unknown): void => {
        if (value === null || typeof value !== 'object' || seen.has(value)) return;
        seen.add(value);
        if (Array.isArray(value)) {
          value.forEach(rewrite);
          return;
        }
        const record = value as JsonRecord;
        for (const [key, child] of Object.entries(record)) {
          if ((key === 'source' || key === 'sourceIdentity') && asRecord(child)?.file === before) asRecord(child)!.file = after;
          rewrite(child);
        }
      };
      rewrite(candidate);
      return { changed: candidate.profile.source.file === after && candidate.frames.every(frame => frame.source.file === after), before, after };
    });

    phaseCSceneAttack('phaseT-paint-cell-geometry-drift', baseInput, candidate => {
      const cell = candidate.cells.find(item => item.rect !== undefined);
      if (cell?.rect === undefined) return { changed: false };
      const record = cell.rect as unknown as JsonRecord;
      const before = record.x;
      if (typeof before !== 'number') return { changed: false, before };
      record.x = before + 1;
      return { changed: record.x !== before, cellId: cell.id, before, after: record.x };
    });

    phaseCSceneAttack('phaseT-paint-coherent-drawable-profile-width-drift', baseInput, candidate => {
      const drawable = candidate.drawableRect as unknown as JsonRecord;
      const profileDrawable = candidate.profile.drawable as unknown as JsonRecord;
      const before = { drawable: drawable.width, profile: profileDrawable.width };
      if (typeof before.drawable !== 'number' || typeof before.profile !== 'number') return { changed: false, before };
      drawable.width = before.drawable + 1;
      profileDrawable.width = before.profile + 1;
      return { changed: drawable.width !== before.drawable && profileDrawable.width !== before.profile, before, after: { drawable: drawable.width, profile: profileDrawable.width } };
    });

    phaseCSceneAttack('phaseT-paint-frame-layer-drift', baseInput, candidate => {
      const frame = candidate.frames[0];
      if (frame === undefined || typeof frame.layer !== 'number') return { changed: false };
      const before = frame.layer;
      (frame as unknown as JsonRecord).layer = before + 1;
      return { changed: frame.layer !== before, frameId: frame.id, before, after: frame.layer };
    });

    phaseCSceneAttack('phaseT-paint-reciprocal-table-frame-reassignment', baseInput, candidate => {
      const frameA = candidate.frames[0];
      const frameB = candidate.frames.find(frame => frame.id !== frameA?.id);
      const tableA = candidate.tables.find(table => table.frameId === frameA?.id);
      if (frameA === undefined || frameB === undefined || tableA === undefined || frameB.tableIds.includes(tableA.id)) return { changed: false };
      const before = { frameA: [...frameA.tableIds], frameB: [...frameB.tableIds], tableFrameId: tableA.frameId, tableParentId: tableA.parentId };
      (frameA as unknown as JsonRecord).tableIds = frameA.tableIds.filter(id => id !== tableA.id);
      (frameB as unknown as JsonRecord).tableIds = [tableA.id, ...frameB.tableIds];
      (tableA as unknown as JsonRecord).frameId = frameB.id;
      (tableA as unknown as JsonRecord).parentId = frameB.id;
      return { changed: tableA.frameId === frameB.id && tableA.parentId === frameB.id && !frameA.tableIds.includes(tableA.id) && frameB.tableIds.includes(tableA.id), before, after: { frameA: frameA.tableIds, frameB: frameB.tableIds, tableFrameId: tableA.frameId, tableParentId: tableA.parentId }, frameA: frameA.id, frameB: frameB.id, tableId: tableA.id };
    });

    phaseCSceneAttack('phaseT-paint-paired-glyph-layout-x-drift', baseInput, candidate => {
      const text = candidate.texts.find(item => item.layout !== undefined && item.lines.length > 0);
      const line = text?.layout?.lines.find(item => item.lineIndex === text.lines[0]?.lineIndex);
      const layoutQuad = line?.glyphQuads[0];
      const glyph = text !== undefined && layoutQuad !== undefined
        ? candidate.glyphs.find(item => item.textId === text.id && item.lineIndex === line.lineIndex && item.glyphIndex === layoutQuad.glyphIndex)
        : undefined;
      if (glyph === undefined || layoutQuad === undefined) return { changed: false };
      const before = { glyph: glyph.quad.x, layout: layoutQuad.x };
      (glyph.quad as unknown as JsonRecord).x = before.glyph + 1;
      (layoutQuad as unknown as JsonRecord).x = before.layout + 1;
      return { changed: glyph.quad.x !== before.glyph && layoutQuad.x !== before.layout, glyphId: glyph.id, before, after: { glyph: glyph.quad.x, layout: layoutQuad.x } };
    });

    phaseCSceneAttack('phaseT-paint-paired-glyph-layout-code-point-drift', baseInput, candidate => {
      const text = candidate.texts.find(item => item.layout !== undefined && item.lines.length > 0);
      const line = text?.layout?.lines.find(item => item.lineIndex === text.lines[0]?.lineIndex);
      const layoutQuad = line?.glyphQuads[0];
      const glyph = text !== undefined && layoutQuad !== undefined
        ? candidate.glyphs.find(item => item.textId === text.id && item.lineIndex === line.lineIndex && item.glyphIndex === layoutQuad.glyphIndex)
        : undefined;
      const alternate = text !== undefined && glyph !== undefined ? alternateCodePointFor(canonical, text as unknown as JsonRecord, glyph as unknown as JsonRecord) : undefined;
      if (glyph === undefined || layoutQuad === undefined || alternate === undefined) return { changed: false, alternate };
      const before = { glyph: glyph.codePoint, layout: layoutQuad.codePoint };
      (glyph as unknown as JsonRecord).codePoint = alternate;
      (layoutQuad as unknown as JsonRecord).codePoint = alternate;
      return { changed: glyph.codePoint !== before.glyph && layoutQuad.codePoint !== before.layout, glyphId: glyph.id, before, after: { glyph: glyph.codePoint, layout: layoutQuad.codePoint }, alternate };
    });

    phaseCSceneAttack('phaseT-paint-table-z-order-drift', baseInput, candidate => {
      const table = candidate.tables[0];
      if (table === undefined) return { changed: false };
      const before = table.zOrder;
      const after = before === -10 ? -11 : -10;
      (table as unknown as JsonRecord).zOrder = after;
      return { changed: before !== after, tableId: table.id, before, after };
    });

    phaseCSceneAttack('phaseT-paint-node-completeness-drift-guard', baseInput, candidate => {
      const frame = candidate.frames[0];
      if (frame === undefined) return { changed: false };
      const before = frame.completeness;
      const after = before === 'complete' ? 'partial' : 'complete';
      (frame as unknown as JsonRecord).completeness = after;
      return { changed: before !== after, frameId: frame.id, before, after };
    });
    phaseCSceneAttack('phaseC-gap-source-order-identity', baseInput, candidate => {
      const gaps = candidate.gaps;
      if (gaps.length < 2) return { changed: false, count: gaps.length };
      const before = gaps.map(gap => gap.id);
      const reversed = [...gaps].reverse();
      (candidate as unknown as JsonRecord).gaps = reversed;
      const after = reversed.map(gap => gap.id);
      return { changed: JSON.stringify(before) !== JSON.stringify(after), before, after, count: gaps.length };
    });

    const keepOuts: X4UiPaintPlanInput['keepOuts'] = [
      { context: KEEP_OUT_PRESET_IDS.cockpitConversation, projection: projectBuiltInKeepOut(KEEP_OUT_IDS.conversationBackRow, viewport) },
      { context: KEEP_OUT_PRESET_IDS.mapOpen, projection: projectBuiltInKeepOut(KEEP_OUT_IDS.informationPanelLeftEdge, viewport) },
      { context: KEEP_OUT_PRESET_IDS.fullscreenMenu, projection: projectBuiltInKeepOut(KEEP_OUT_IDS.missionMessagesTicker, viewport) },
      { context: KEEP_OUT_PRESET_IDS.firstPerson, projection: projectBuiltInKeepOut(KEEP_OUT_IDS.topHudStrip, viewport) },
    ];
    const selectedId = scene.widgets[0]?.id;
    const withContext: PaintTestInput = { ...baseInput, keepOuts, selection: selectedId === undefined ? undefined : { nodeIds: [selectedId] } };

    const parentPrototypeTarget = scene.frames.find(frame => !Object.prototype.hasOwnProperty.call(frame, 'parentId'));
    closedDomainScenePollutionCase(
      'closed-domain-inherited-parent-ancestry-cannot-affect-accepted-paint',
      baseInput,
      'parentId',
      'inherited:missing-parent',
      parentPrototypeTarget,
    );

    const sourcePathPrototypeTarget = [
      scene.profile.source,
      ...paintSceneNodes(scene).map(node => node.source),
      ...scene.gaps.map(gap => gap.source),
    ].find(sourceLocation => !Object.prototype.hasOwnProperty.call(sourceLocation, 'sourcePath'));
    closedDomainScenePollutionCase(
      'closed-domain-inherited-sourcePath-cannot-alter-source-output-or-acceptance',
      baseInput,
      'sourcePath',
      'inherited://paint-source',
      sourcePathPrototypeTarget,
    );

    const operationPrototypeTarget = [
      ...scene.gaps,
      ...paintSceneNodes(scene).flatMap(node => node.provenanceLinks),
    ].find(record => !Object.prototype.hasOwnProperty.call(record, 'operationId'));
    closedDomainScenePollutionCase(
      'closed-domain-inherited-provenance-gap-operationId-cannot-affect-paint',
      baseInput,
      'operationId',
      'inherited-operation',
      operationPrototypeTarget,
    );

    closedDomainEquivalentInheritedFieldsRefusal(
      'closed-domain-inherited-gap-nodeId-on-custom-record-refuses',
      scene,
      canonical,
      issuedPreviewAuthority,
      candidate => asRecord(candidate.gaps.find(gap => Object.prototype.hasOwnProperty.call(gap, 'nodeId'))),
      ['nodeId'],
    );

    const tableViewPrototypeTarget = scene.tables.find(table => !Object.prototype.hasOwnProperty.call(table, 'viewState'));
    closedDomainScenePollutionCase(
      'closed-domain-inherited-table-view-optionals-cannot-change-acceptance',
      baseInput,
      'viewState',
      { topRow: 'inherited-invalid-row' },
      tableViewPrototypeTarget,
    );

    const widgetOptionPrototypeTarget = scene.widgets.find(widget => !Object.prototype.hasOwnProperty.call(widget, 'configuredActive'));
    closedDomainScenePollutionCase(
      'closed-domain-inherited-widget-optionals-cannot-change-acceptance',
      baseInput,
      'configuredActive',
      'inherited-invalid-active',
      widgetOptionPrototypeTarget,
    );

    closedDomainEquivalentInheritedFieldsRefusal(
      'closed-domain-inherited-text-font-on-custom-record-refuses',
      scene,
      canonical,
      issuedPreviewAuthority,
      candidate => asRecord(candidate.texts.find(text => Object.prototype.hasOwnProperty.call(text, 'font'))),
      ['font'],
    );
    closedDomainEquivalentInheritedFieldsRefusal(
      'closed-domain-inherited-text-layout-on-custom-record-refuses',
      scene,
      canonical,
      issuedPreviewAuthority,
      candidate => asRecord(candidate.texts.find(text => Object.prototype.hasOwnProperty.call(text, 'layout'))),
      ['layout'],
    );
    closedDomainEquivalentInheritedFieldsRefusal(
      'closed-domain-inherited-frame-layer-on-custom-record-refuses',
      scene,
      canonical,
      issuedPreviewAuthority,
      candidate => asRecord(candidate.frames.find(frame => Object.prototype.hasOwnProperty.call(frame, 'layer'))),
      ['layer'],
    );

    closedDomainCustomPrototypeRefusal(
      'closed-domain-custom-node-prototype-with-owner-and-layer-fields-refuses',
      scene,
      canonical,
      issuedPreviewAuthority,
      candidate => candidate.frames[0],
      {
        frameId: 'inherited-frame',
        tableId: 'inherited-table',
        rowId: 'inherited-row',
        widgetId: 'inherited-widget',
        layer: 99,
      },
    );
    closedDomainCustomPrototypeRefusal(
      'closed-domain-custom-identity-pin-prototype-refuses-relativePath-sha256-inheritance',
      scene,
      canonical,
      issuedPreviewAuthority,
      candidate => candidate.profile.fonts.Zekton.descriptor,
      { relativePath: 'inherited://descriptor', sha256: 'F'.repeat(64) },
    );

    closedDomainInputPollutionCase(
      'closed-domain-inherited-input-keepOuts-are-absent',
      scene,
      canonical,
      issuedPreviewAuthority,
      'keepOuts',
      [keepOuts[0]],
    );
    closedDomainInputPollutionCase(
      'closed-domain-inherited-input-selection-is-absent',
      scene,
      canonical,
      issuedPreviewAuthority,
      'selection',
      selectedId === undefined ? { nodeIds: [] } : { nodeIds: [selectedId] },
    );

    let keepOutAccessorReads = 0;
    const accessorInput: JsonRecord = {
      scene,
      corpus: canonical,
      previewAuthority: issuedPreviewAuthority,
    };
    let accessorInputResult: X4UiPaintPlanResult | undefined;
    let accessorInputThrew = false;
    let accessorInputError: string | undefined;
    let accessorInputRestored = false;
    try {
      Object.defineProperty(accessorInput, 'keepOuts', {
        configurable: true,
        enumerable: true,
        get: () => {
          keepOutAccessorReads += 1;
          return keepOuts;
        },
      });
      accessorInputResult = projectX4UiPaintPlanDirect(accessorInput as unknown as X4UiPaintPlanInput);
    } catch (caught) {
      accessorInputThrew = true;
      accessorInputError = caught instanceof Error ? caught.message : String(caught);
    } finally {
      accessorInputRestored = Reflect.deleteProperty(accessorInput, 'keepOuts');
    }
    check('closed-domain-own-input-accessors-refuse-without-invocation',
      !accessorInputThrew
      && accessorInputRestored
      && keepOutAccessorReads === 0
      && accessorInputResult?.status === 'refused', {
        fixtureReady: issuedPreviewAuthority !== undefined,
        getterReads: keepOutAccessorReads,
        resultStatus: accessorInputResult?.status,
        refusal: accessorInputResult?.status === 'refused' ? accessorInputResult.refusal : undefined,
        threw: accessorInputThrew,
        error: accessorInputError,
        restored: accessorInputRestored,
      });

    const customSelectionPrototype = { inheritedSelectionField: true };
    const customSelection = Object.create(customSelectionPrototype) as JsonRecord;
    customSelection.nodeIds = selectedId === undefined ? [] : [selectedId];
    let customSelectionResult: X4UiPaintPlanResult | undefined;
    let customSelectionThrew = false;
    let customSelectionError: string | undefined;
    let customSelectionRestored = false;
    try {
      customSelectionResult = projectX4UiPaintPlanDirect({
        scene,
        corpus: canonical,
        previewAuthority: issuedPreviewAuthority,
        selection: customSelection as unknown as X4UiPaintPlanInput['selection'],
      });
    } catch (caught) {
      customSelectionThrew = true;
      customSelectionError = caught instanceof Error ? caught.message : String(caught);
    } finally {
      Object.setPrototypeOf(customSelection, Object.prototype);
      customSelectionRestored = Object.getPrototypeOf(customSelection) === Object.prototype;
    }
    check('closed-domain-own-custom-prototype-selection-refuses-deterministically',
      !customSelectionThrew
      && customSelectionRestored
      && customSelectionResult?.status === 'refused', {
        fixtureReady: selectedId !== undefined && issuedPreviewAuthority !== undefined,
        resultStatus: customSelectionResult?.status,
        refusal: customSelectionResult?.status === 'refused' ? customSelectionResult.refusal : undefined,
        threw: customSelectionThrew,
        error: customSelectionError,
        restored: customSelectionRestored,
      });

    let sceneWrapperReads = 0;
    const accessorSceneWrapper: JsonRecord = {
      status: scene.status,
      verification: { game: 'Not verified in game', gameVerified: false },
    };
    let accessorSceneResult: X4UiPaintPlanResult | undefined;
    let accessorSceneThrew = false;
    let accessorSceneError: string | undefined;
    let accessorSceneRestored = false;
    try {
      Object.defineProperty(accessorSceneWrapper, 'scene', {
        configurable: true,
        enumerable: true,
        get: () => {
          sceneWrapperReads += 1;
          return scene;
        },
      });
      accessorSceneResult = projectX4UiPaintPlanDirect({
        scene: accessorSceneWrapper as unknown as X4UiPaintPlanInput['scene'],
        corpus: canonical,
        previewAuthority: issuedPreviewAuthority,
      });
    } catch (caught) {
      accessorSceneThrew = true;
      accessorSceneError = caught instanceof Error ? caught.message : String(caught);
    } finally {
      accessorSceneRestored = Reflect.deleteProperty(accessorSceneWrapper, 'scene');
    }
    check('closed-domain-Scene-result-wrapper-accessors-refuse-without-invocation',
      !accessorSceneThrew
      && accessorSceneRestored
      && sceneWrapperReads === 0
      && accessorSceneResult?.status === 'refused', {
        fixtureReady: issuedPreviewAuthority !== undefined,
        getterReads: sceneWrapperReads,
        resultStatus: accessorSceneResult?.status,
        refusal: accessorSceneResult?.status === 'refused' ? accessorSceneResult.refusal : undefined,
        threw: accessorSceneThrew,
        error: accessorSceneError,
        restored: accessorSceneRestored,
      });

    const customKeepOuts = JSON.parse(JSON.stringify([keepOuts[0]])) as X4UiPaintPlanInput['keepOuts'];
    const customProjectionTarget = customKeepOuts[0]?.projection as object | undefined;
    let customKeepOutResult: X4UiPaintPlanResult | undefined;
    let customKeepOutThrew = false;
    let customKeepOutError: string | undefined;
    let customKeepOutRestored = false;
    if (customProjectionTarget !== undefined) {
      const originalProjectionPrototype = Object.getPrototypeOf(customProjectionTarget);
      try {
        Object.setPrototypeOf(customProjectionTarget, { inheritedProjectionField: true });
        customKeepOutResult = projectX4UiPaintPlanDirect({
          scene,
          corpus: canonical,
          previewAuthority: issuedPreviewAuthority,
          keepOuts: customKeepOuts,
        });
      } catch (caught) {
        customKeepOutThrew = true;
        customKeepOutError = caught instanceof Error ? caught.message : String(caught);
      } finally {
        Object.setPrototypeOf(customProjectionTarget, originalProjectionPrototype);
        customKeepOutRestored = Object.getPrototypeOf(customProjectionTarget) === originalProjectionPrototype;
      }
    }
    check('closed-domain-own-custom-prototype-keepOuts-refuse-deterministically',
      customProjectionTarget !== undefined
      && !customKeepOutThrew
      && customKeepOutRestored
      && customKeepOutResult?.status === 'refused', {
        fixtureReady: customProjectionTarget !== undefined && issuedPreviewAuthority !== undefined,
        resultStatus: customKeepOutResult?.status,
        refusal: customKeepOutResult?.status === 'refused' ? customKeepOutResult.refusal : undefined,
        threw: customKeepOutThrew,
        error: customKeepOutError,
        restored: customKeepOutRestored,
      });

    const beforeScene = JSON.stringify(scene);
    const first = projectedPlan(withContext);
    const second = projectedPlan(withContext);
    const firstRaw = projectX4UiPaintPlan(withContext);
    const rawCommands = firstRaw.status === 'refused' ? [] : firstRaw.plan.layers.flatMap(layer => layer.commands);
    const rawOrders = rawCommands.map(command => command.order);
    const rawOrderSet = new Set(rawOrders);
    const rawOrderVectorIsFlattened = rawCommands.every((command, index) => command.order === index);
    const rawOrderVectorIsUniqueAndContiguous = rawOrders.length > 0
      && rawOrderSet.size === rawOrders.length
      && rawOrders.every((_order, index) => rawOrderSet.has(index));
    const rawDiagnostics = firstRaw.status === 'refused' ? [] : firstRaw.plan.layers[2].commands;
    const rawKeepOuts = firstRaw.status === 'refused' ? [] : firstRaw.plan.layers[3].commands;
    check('causal-raw-output-issues-exact-flattened-command-orders', firstRaw.status !== 'refused' && rawOrderVectorIsFlattened, {
      fixtureReady: firstRaw.status !== 'refused',
      validatorExceptions: 0,
      commandCount: rawCommands.length,
      rawOrderVector: rawOrders,
      expectedOrderVector: rawCommands.map((_command, index) => index),
    });
    check('causal-raw-output-command-orders-are-unique-and-contiguous', firstRaw.status !== 'refused' && rawOrderVectorIsUniqueAndContiguous, {
      fixtureReady: firstRaw.status !== 'refused',
      validatorExceptions: 0,
      commandCount: rawCommands.length,
      uniqueOrderCount: rawOrderSet.size,
      rawOrderVector: rawOrders,
    });
    check('causal-diagnostics-retain-exact-issued-layer-command-identity', firstRaw.status !== 'refused'
      && rawDiagnostics.length === firstRaw.plan.diagnostics.length
      && firstRaw.plan.diagnostics.every((command, index) => command === rawDiagnostics[index]), {
      fixtureReady: firstRaw.status !== 'refused',
      validatorExceptions: 0,
      diagnosticsCount: rawDiagnostics.length,
      exactIdentity: firstRaw.status !== 'refused' && firstRaw.plan.diagnostics.every((command, index) => command === rawDiagnostics[index]),
    });
    check('causal-keep-outs-retain-exact-issued-layer-command-identity', firstRaw.status !== 'refused'
      && rawKeepOuts.length === firstRaw.plan.keepOuts.length
      && firstRaw.plan.keepOuts.every((command, index) => command === rawKeepOuts[index]), {
      fixtureReady: firstRaw.status !== 'refused',
      validatorExceptions: 0,
      keepOutCount: rawKeepOuts.length,
      exactIdentity: firstRaw.status !== 'refused' && firstRaw.plan.keepOuts.every((command, index) => command === rawKeepOuts[index]),
    });
    const primaryFrameFromFixture = scene.frames.find(frame => frame.source.start.line === 2);
    const secondaryFrameFromFixture = scene.frames.find(frame => frame.source.start.line === 13);
    const independentlyDeclaredFrameOrder = [secondaryFrameFromFixture?.id, primaryFrameFromFixture?.id].filter((id): id is string => id !== undefined);
    const observedFrameLayers = [primaryFrameFromFixture?.layer, secondaryFrameFromFixture?.layer];
    const observedFrameOrder = first?.plan.layers[0].commands
      .map(command => command.frameId)
      .filter((id, index, all): id is string => id !== undefined && all.indexOf(id) === index) || [];
    check('phaseC-independent frame layers and source-declared draw order are distinct',
      first !== undefined
      && independentlyDeclaredFrameOrder.length === 2
      && new Set(observedFrameLayers).size === 2
      && JSON.stringify(observedFrameOrder) === JSON.stringify(independentlyDeclaredFrameOrder), {
      fixtureReady: first !== undefined && independentlyDeclaredFrameOrder.length === 2,
      observedFrameLayers,
      independentlyDeclaredFrameOrder,
      observedFrameOrder,
    });
    const allSceneNodes = [...scene.frames, ...scene.tables, ...scene.rows, ...scene.cells, ...scene.widgets, ...scene.texts, ...scene.glyphs];
    const sceneIds = new Set(allSceneNodes.map(node => node.id));
    const relationAudit = { parentMissing: allSceneNodes.filter(node => node.parentId !== undefined && !sceneIds.has(node.parentId)).map(node => node.id), frameTables: scene.frames.flatMap(frame => frame.tableIds.filter(id => !scene.tables.some(table => table.id === id))), tableRows: scene.tables.flatMap(table => table.rowIds.filter(id => !scene.rows.some(row => row.id === id))), rowCells: scene.rows.flatMap(row => row.cellIds.filter(id => !scene.cells.some(cell => cell.id === id))), cellWidgets: scene.cells.flatMap(cell => cell.widgetIds.filter(id => !scene.widgets.some(widget => widget.id === id))), widgetTexts: scene.widgets.flatMap(widget => widget.textIds.filter(id => !scene.texts.some(text => text.id === id))), lineGlyphs: scene.texts.flatMap(text => text.lines.flatMap(line => line.glyphIds.filter(id => !scene.glyphs.some(glyph => glyph.id === id)))) };
    check('accepted Scene projects with all four keep-out contexts', first !== undefined && first.plan.layers.length === 4 && first.plan.keepOuts.length === 4 && first.plan.status === 'partial', { status: firstRaw.status, refusal: firstRaw.status === 'refused' ? firstRaw.refusal : undefined, keepOuts: first?.plan.keepOuts.map(item => ({ context: item.context, status: item.status, entryId: item.entryId })), sceneKeys: Object.keys(scene), profile: scene.profile, counts: { frames: scene.frames.length, tables: scene.tables.length, rows: scene.rows.length, cells: scene.cells.length, widgets: scene.widgets.length, texts: scene.texts.length, glyphs: scene.glyphs.length }, relationAudit, fonts: ['regular', 'bold'].map(name => { const font = canonical?.fonts[name as 'regular' | 'bold']; const descriptor = font?.descriptor; const atlas = font?.atlas; const record = descriptor?.glyphRecords?.[0]; return { name, format: font?.format, descriptor: { width: descriptor?.atlasWidth, height: descriptor?.atlasHeight, records: descriptor?.glyphRecords.length, map: descriptor?.codePointToGlyphIndex[65] }, atlas: { width: atlas?.width, height: atlas?.height, payload: atlas?.payloadLength, bytes: atlas?.alphaBytes.byteLength }, record: record?.pixelBounds }; }) });
    check('explicit layer order and deterministic replay', first !== undefined && second !== undefined && JSON.stringify(first) === JSON.stringify(second)
      && JSON.stringify(first.plan.layers.map(layer => layer.kind)) === JSON.stringify(['diagnostic-background', 'glyph-alpha-blits', 'diagnostics', 'keep-out-overlays']));
    const expectedFrameOrder = [...scene.frames].sort((left, right) => (left.layer ?? 0) - (right.layer ?? 0) || left.sourceOrder - right.sourceOrder || left.id.localeCompare(right.id)).map(frame => frame.id);
    const actualFrameOrder = first?.plan.layers[0].commands.map(command => command.frameId).filter((id, index, all): id is string => id !== undefined && all.indexOf(id) === index) || [];
    const sceneNodes = [...scene.frames, ...scene.tables, ...scene.rows, ...scene.cells, ...scene.widgets, ...scene.texts];
    const sceneNodeById = new Map(sceneNodes.map(node => [node.id, node]));
    const expectedDrawableOrder = [...sceneNodes].sort((left, right) => {
      const leftFrame = frameForNode(left, sceneNodeById);
      const rightFrame = frameForNode(right, sceneNodeById);
      return (leftFrame?.layer ?? 0) - (rightFrame?.layer ?? 0)
        || (left.zOrder ?? 0) - (right.zOrder ?? 0)
        || left.sourceOrder - right.sourceOrder
        || left.id.localeCompare(right.id);
    }).map(node => node.id);
    const actualDrawableOrder = first?.plan.layers[0].commands.map(command => command.nodeId).filter((id): id is string => id !== undefined) || [];
    const drawableCommands = first === undefined ? [] : [
      ...first.plan.layers[0].commands,
      ...first.plan.layers[1].commands,
      ...first.plan.layers[2].commands.filter(command => command.kind !== 'keep-out' && 'geometry' in command && command.geometry !== undefined),
    ];
    const drawableClipRows = drawableCommands.map(command => {
      if (command.kind === 'glyph-alpha-blit') return command.clipRect !== undefined
        && command.destinationRect.x >= command.clipRect.x && command.destinationRect.y >= command.clipRect.y
        && command.destinationRect.x + command.destinationRect.width <= command.clipRect.x + command.clipRect.width
        && command.destinationRect.y + command.destinationRect.height <= command.clipRect.y + command.clipRect.height;
      if (command.kind !== 'keep-out' && 'geometry' in command && command.geometry !== undefined) return command.clipRect !== undefined
        && command.geometry.x >= command.clipRect.x && command.geometry.y >= command.clipRect.y
        && command.geometry.x + command.geometry.width <= command.clipRect.x + command.clipRect.width
        && command.geometry.y + command.geometry.height <= command.clipRect.y + command.clipRect.height;
      return true;
    });
    check('multi-frame layer/z/source-order coverage is deterministic', first !== undefined && expectedFrameOrder.length >= 2 && JSON.stringify(actualFrameOrder) === JSON.stringify(expectedFrameOrder) && JSON.stringify(actualDrawableOrder) === JSON.stringify(expectedDrawableOrder) && actualDrawableOrder.every(id => sceneNodeById.has(id)));
    check('every drawable command carries an accepted effective clip', drawableClipRows.every(Boolean));
    check('logical plan is deeply frozen and JSON serializable', first !== undefined && Object.isFrozen(first.plan) && Object.isFrozen(first.plan.layers) && first.plan.layers.every(layer => Object.isFrozen(layer) && Object.isFrozen(layer.commands)) && JSON.stringify(first).includes('Not verified in game'));
    check('source linkage, selection, and game truth are retained', first !== undefined && first.plan.source.file === scene.profile.source.file && first.plan.selectedNodeIds[0] === selectedId && first.plan.gameVerified === false && first.plan.verification.game === 'Not verified in game');
    check('keep-out guides preserve exact built-in normalized projections', first !== undefined && first.plan.keepOuts.some(item => item.entryId === KEEP_OUT_IDS.conversationBackRow && item.geometry !== null && item.geometry.kind === 'horizontal-guide' && item.geometry.y === viewport.height * 0.788) && first.plan.keepOuts.some(item => item.entryId === KEEP_OUT_IDS.informationPanelLeftEdge && item.geometry !== null && item.geometry.kind === 'vertical-guide' && item.geometry.x === viewport.width * 0.664));
    check('keep-outs do not mutate Scene geometry or ordering', JSON.stringify(scene) === beforeScene && first !== undefined && first.plan.layers[0].commands.length > 0);
    const rasterCommands = first?.plan.layers[1].commands.filter(command => command.kind === 'glyph-alpha-blit') || [];
    check('regular glyphs use canonical descriptor/atlas bounds and JSON-safe alpha commands', rasterCommands.length > 0 && rasterCommands.every(command => command.kind === 'glyph-alpha-blit' && command.atlas.width > 0 && command.atlas.height > 0 && command.sourceRect.width > 0 && command.destinationRect.width > 0 && command.atlas.relativePath.endsWith('.dds')));
    check('unsupported runtime paint remains diagnostic-only', first !== undefined && first.plan.diagnostics.some(diagnostic => diagnostic.kind === 'unsupported-runtime-paint'));
    check('selected node produces a diagnostic command', first !== undefined && first.plan.diagnostics.some(diagnostic => diagnostic.kind === 'selection' && diagnostic.nodeId === selectedId));

    const textId = scene.texts[0]?.id;
    const glyph = scene.glyphs[0];
    if (textId !== undefined && glyph !== undefined) {
      const partial = clonedScene(scene);
      const text = partial.texts.find(candidate => candidate.id === textId);
       if (text) (text as unknown as JsonRecord).clipRect = { x: glyph.quad.x + glyph.quad.width / 2, y: 0, width: glyph.quad.width, height: glyph.quad.height };
      const clippedPlan = projectedPlan({ scene: partial, corpus: canonical });
      const clippedGlyph = clippedPlan?.plan.layers[1].commands.find(command => command.kind === 'glyph-alpha-blit' && command.textId === textId);
      check('partial hierarchical clip adjusts source and destination', clippedGlyph !== undefined && clippedGlyph.kind === 'glyph-alpha-blit' && clippedGlyph.destinationRect.width < glyph.quad.width && clippedGlyph.sourceRect.width < glyph.quad.bitmapBounds.right - glyph.quad.bitmapBounds.left);
      const zero = clonedScene(scene);
      const zeroText = zero.texts.find(candidate => candidate.id === textId);
       if (zeroText) (zeroText as unknown as JsonRecord).clipRect = { x: Math.max(0, glyph.quad.x), y: 0, width: 0, height: 0 };
      const zeroPlan = projectedPlan({ scene: zero, corpus: canonical });
      check('zero clip emits diagnostic and no raster command', zeroPlan !== undefined && zeroPlan.plan.layers[1].commands.filter(command => command.kind === 'glyph-alpha-blit' && command.textId === textId).length === 0 && zeroPlan.plan.diagnostics.some(diagnostic => diagnostic.kind === 'empty-clip' && diagnostic.nodeId === glyph.id));
      const boldText = scene.texts.find(candidate => candidate.font === 'Zekton Bold');
      const boldPlan = projectedPlan({ scene, corpus: canonical });
      check('source-derived bold text retains exact layout and atlas identity', boldText !== undefined && boldText.layout !== undefined && boldPlan !== undefined && boldPlan.plan.layers[1].commands.some(command => command.kind === 'glyph-alpha-blit' && command.textId === boldText.id && command.descriptor.relativePath.includes('bold')), { boldText: boldText === undefined ? undefined : { id: boldText.id, font: boldText.font, hasLayout: boldText.layout !== undefined }, boldCommands: boldPlan?.plan.layers[1].commands.filter(command => command.kind === 'glyph-alpha-blit').map(command => ({ textId: command.textId, descriptor: command.descriptor.relativePath })) });

      const partialCell = clonedScene(scene);
      const cell = partialCell.cells.find(candidate => candidate.rect !== undefined);
      if (cell?.rect) (cell as unknown as JsonRecord).clipRect = { x: cell.rect.x + cell.rect.width / 2, y: cell.rect.y, width: cell.rect.width, height: cell.rect.height };
      const partialCellPlan = projectedPlan({ scene: partialCell, corpus: canonical });
      const cellGeometry = partialCellPlan?.plan.layers[0].commands.find(command => command.id === `geometry:${cell?.id}`);
      check('partial cell geometry is clipped before paint', cell !== undefined && partialCellPlan !== undefined && cellGeometry !== undefined && cellGeometry.kind === 'node-geometry' && cellGeometry.geometry !== undefined && cellGeometry.clipRect !== undefined && cellGeometry.geometry.width < (cell.rect?.width ?? 0));

      const partialWidget = clonedScene(scene);
      const widget = partialWidget.widgets.find(candidate => candidate.kind === 'button' && candidate.outerRect !== undefined);
      if (widget?.outerRect) (widget as unknown as JsonRecord).clipRect = { x: widget.outerRect.x + widget.outerRect.width / 2, y: widget.outerRect.y, width: widget.outerRect.width, height: widget.outerRect.height };
      const partialWidgetPlan = projectedPlan({ scene: partialWidget, corpus: canonical });
      const widgetGeometry = partialWidgetPlan?.plan.layers[0].commands.find(command => command.id === `geometry:${widget?.id}`);
      const widgetDiagnostic = partialWidgetPlan?.plan.diagnostics.find(command => command.id === `runtime-paint:${widget?.id}`);
      check('partial widget geometry and unsupported paint diagnostics are clipped', widget !== undefined && partialWidgetPlan !== undefined && widgetGeometry !== undefined && widgetGeometry.kind === 'node-geometry' && widgetGeometry.geometry !== undefined && widgetGeometry.clipRect !== undefined && widgetGeometry.geometry.width < (widget.outerRect?.width ?? 0) && widgetDiagnostic !== undefined && widgetDiagnostic.geometry !== undefined && widgetDiagnostic.clipRect !== undefined && widgetDiagnostic.geometry.width < (widget.outerRect?.width ?? 0));
    }

    const partialScene = clonedScene(scene);
    (partialScene as unknown as JsonRecord).status = 'partial';
    (partialScene as unknown as JsonRecord).programStatus = 'projected';
    const partialPlan = projectedPlan({ scene: partialScene, corpus: canonical });
    check('projected program with conservative partial Scene remains valid', partialPlan !== undefined && partialPlan.plan.status === 'partial' && partialPlan.plan.sceneStatus === 'partial');

    const badParent = clonedScene(scene);
    const badParentNode = badParent.widgets[0];
    if (badParentNode) (badParentNode as unknown as JsonRecord).parentId = 'missing-parent';
    const badParentResult = projectX4UiPaintPlan({ scene: badParent, corpus: canonical });
    check('unknown parent hierarchy refuses without throw', badParentResult.status === 'refused' && badParentResult.refusal.code === 'invalid-scene');
    const badClip = clonedScene(scene);
    const badClipNode = badClip.frames[0];
    if (badClipNode) (badClipNode as unknown as JsonRecord).clipRect = { x: -1, y: 0, width: 5, height: 5 };
    const badClipResult = projectX4UiPaintPlan({ scene: badClip, corpus: canonical });
    check('out-of-bounds clip hierarchy refuses without throw', badClipResult.status === 'refused' && badClipResult.refusal.code === 'invalid-scene');
    const wrapperParent = { status: badParent.status, scene: badParent, verification: { game: 'Not verified in game', gameVerified: false as const } };
    const wrapperParentResult = projectX4UiPaintPlan({ scene: wrapperParent as unknown as X4UiPaintPlanInput['scene'], corpus: canonical });
    check('Scene-result wrapper preserves parent refusal', wrapperParentResult.status === 'refused' && wrapperParentResult.refusal.code === 'invalid-scene');
    const wrapperClip = { status: badClip.status, scene: badClip, verification: { game: 'Not verified in game', gameVerified: false as const } };
    const wrapperClipResult = projectX4UiPaintPlan({ scene: wrapperClip as unknown as X4UiPaintPlanInput['scene'], corpus: canonical });
    check('Scene-result wrapper preserves clip refusal', wrapperClipResult.status === 'refused' && wrapperClipResult.refusal.code === 'invalid-scene');
    const badTruth = clonedScene(scene);
    (badTruth as unknown as JsonRecord).gameTruth = 'Engine accepted';
    const badTruthResult = projectX4UiPaintPlan({ scene: badTruth, corpus: canonical });
    check('direct Scene engine/game truth injection refuses', badTruthResult.status === 'refused' && badTruthResult.refusal.code === 'invalid-scene');
    const badVerification = clonedScene(scene);
    (badVerification.verification as unknown as JsonRecord).gameVerified = true;
    const badVerificationResult = projectX4UiPaintPlan({ scene: badVerification, corpus: canonical });
    check('direct Scene game verification injection refuses', badVerificationResult.status === 'refused' && badVerificationResult.refusal.code === 'invalid-scene');
    const wrapperTruth = { status: scene.status, scene, verification: { game: 'Engine accepted', gameVerified: true } };
    const wrapperTruthResult = projectX4UiPaintPlan({ scene: wrapperTruth as unknown as X4UiPaintPlanInput['scene'], corpus: canonical });
    check('Scene-result wrapper engine/game truth injection refuses', wrapperTruthResult.status === 'refused' && wrapperTruthResult.refusal.code === 'invalid-scene');
    const staleCorpus = { ...canonical };
    const staleResult = projectX4UiPaintPlan({ scene, corpus: staleCorpus });
    check('structural corpus clone is not accepted as canonical authority', staleResult.status === 'refused' && staleResult.refusal.code === 'invalid-corpus');
    const badAtlas = clonedScene(scene);
    const badGlyph = badAtlas.glyphs[0];
    if (badGlyph) ((badGlyph.quad as unknown as JsonRecord).bitmapBounds as JsonRecord).right = badGlyph.quad.bitmapBounds.right + 1;
    const badAtlasResult = projectX4UiPaintPlan({ scene: badAtlas, corpus: canonical });
    check('out-of-bounds or stale atlas source refuses without throw', badAtlasResult.status === 'refused' && (badAtlasResult.refusal.code === 'invalid-atlas' || badAtlasResult.refusal.code === 'invalid-scene'));
    const badDimension = clonedScene(scene);
    (badDimension.drawableRect as unknown as JsonRecord).width = Number.POSITIVE_INFINITY;
    const badDimensionResult = projectX4UiPaintPlan({ scene: badDimension, corpus: canonical });
    check('unsafe drawable dimension refuses without throw', badDimensionResult.status === 'refused');
    const duplicate = clonedScene(scene);
    if (duplicate.frames[0] && duplicate.tables[0]) (duplicate.tables[0] as unknown as JsonRecord).id = duplicate.frames[0].id;
    const duplicateResult = projectX4UiPaintPlan({ scene: duplicate, corpus: canonical });
    check('duplicate Scene node identity refuses without throw', duplicateResult.status === 'refused' && duplicateResult.refusal.code === 'invalid-scene');
    const partialInput = { scene: partialScene, corpus: canonical };
    const partialAgain = projectedPlan(partialInput);
    check('partial output remains immutable and truthful', partialAgain !== undefined && partialAgain.plan.status === 'partial' && partialAgain.plan.verification.gameVerified === false && JSON.stringify(partialAgain).includes('Not verified in game'));

    const phase6FrameA = scene.frames[0]!;
    const phase6FrameB = scene.frames.find(candidate => candidate.id !== phase6FrameA.id)!;
    const phase6TableA = scene.tables.find(candidate => candidate.frameId === phase6FrameA.id) || scene.tables[0]!;
    const phase6TableB = scene.tables.find(candidate => candidate.id !== phase6TableA.id && candidate.frameId === phase6FrameB?.id) || scene.tables.find(candidate => candidate.id !== phase6TableA.id)!;
    const phase6RowA = scene.rows.find(candidate => candidate.tableId === phase6TableA.id) || scene.rows[0]!;
    const phase6RowB = scene.rows.find(candidate => candidate.id !== phase6RowA.id && candidate.tableId === phase6TableB?.id) || scene.rows.find(candidate => candidate.id !== phase6RowA.id)!;
    const phase6CellA = scene.cells.find(candidate => candidate.rowId === phase6RowA.id) || scene.cells[0]!;
    const phase6CellB = scene.cells.find(candidate => candidate.id !== phase6CellA.id && candidate.rowId === phase6RowB?.id) || scene.cells.find(candidate => candidate.id !== phase6CellA.id)!;
    const phase6WidgetA = scene.widgets.find(candidate => candidate.cellId === phase6CellA.id) || scene.widgets[0]!;
    const phase6WidgetB = scene.widgets.find(candidate => candidate.id !== phase6WidgetA.id && candidate.cellId === phase6CellB?.id) || scene.widgets.find(candidate => candidate.id !== phase6WidgetA.id)!;
    const phase6TextA = scene.texts.find(candidate => candidate.widgetId === phase6WidgetA.id) || scene.texts[0]!;
    const phase6TextB = scene.texts.find(candidate => candidate.id !== phase6TextA.id && candidate.widgetId === phase6WidgetB?.id) || scene.texts.find(candidate => candidate.id !== phase6TextA.id)!;
    const phase6GlyphA = scene.glyphs.find(candidate => candidate.textId === phase6TextA.id) || scene.glyphs[0]!;
    const phase6GlyphB = scene.glyphs.find(candidate => candidate.id !== phase6GlyphA.id && candidate.textId === phase6TextB?.id) || scene.glyphs.find(candidate => candidate.id !== phase6GlyphA.id)!;

    // Phase 6C fail-first: each case starts from the real accepted Scene and
    // changes one source-backed relationship. The current candidate accepts
    // these coherent mutations; production must make each predicate refuse.
    phase6SceneAttack('phase6C-escape-ancestry-frame-table-membership-removal', scene, canonical, candidate => {
      const node = candidate.frames.find(item => item.id === phase6FrameA.id)!;
      const record = node as unknown as JsonRecord;
      const before = [...node.tableIds];
      record.tableIds = before.filter(id => id !== phase6TableA.id);
      return { changed: before.includes(phase6TableA.id) && JSON.stringify(before) !== JSON.stringify(record.tableIds), ownerId: node.id, childId: phase6TableA.id, before, after: record.tableIds };
    });
    phase6SceneAttack('phase6C-escape-ancestry-table-frame-reassignment', scene, canonical, candidate => {
      const node = candidate.tables.find(item => item.id === phase6TableA.id)!;
      const record = node as unknown as JsonRecord;
      const before = node.frameId;
      record.frameId = phase6FrameB.id;
      return { changed: before !== record.frameId && phase6FrameA.id !== phase6FrameB.id, tableId: node.id, before, after: record.frameId, targetExists: candidate.frames.some(item => item.id === record.frameId) };
    });
    phase6SceneAttack('phase6C-escape-ancestry-table-parent-frame-drift', scene, canonical, candidate => {
      const node = candidate.tables.find(item => item.id === phase6TableA.id)!;
      const record = node as unknown as JsonRecord;
      const before = node.parentId;
      record.parentId = phase6FrameB.id;
      return { changed: before !== record.parentId && phase6FrameA.id !== phase6FrameB.id, tableId: node.id, before, after: record.parentId, frameId: node.frameId };
    });
    phase6SceneAttack('phase6C-escape-ancestry-table-row-membership-removal', scene, canonical, candidate => {
      const node = candidate.tables.find(item => item.id === phase6TableA.id)!;
      const record = node as unknown as JsonRecord;
      const before = [...node.rowIds];
      record.rowIds = before.filter(id => id !== phase6RowA.id);
      return { changed: before.includes(phase6RowA.id) && JSON.stringify(before) !== JSON.stringify(record.rowIds), ownerId: node.id, childId: phase6RowA.id, before, after: record.rowIds };
    });
    phase6SceneAttack('phase6C-escape-ancestry-row-table-reassignment', scene, canonical, candidate => {
      const node = candidate.rows.find(item => item.id === phase6RowA.id)!;
      const record = node as unknown as JsonRecord;
      const before = node.tableId;
      record.tableId = phase6TableB.id;
      return { changed: before !== record.tableId && phase6TableA.id !== phase6TableB.id, rowId: node.id, before, after: record.tableId, targetExists: candidate.tables.some(item => item.id === record.tableId) };
    });
    phase6SceneAttack('phase6C-escape-ancestry-row-parent-table-drift', scene, canonical, candidate => {
      const node = candidate.rows.find(item => item.id === phase6RowA.id)!;
      const record = node as unknown as JsonRecord;
      const before = node.parentId;
      record.parentId = phase6TableB.id;
      return { changed: before !== record.parentId && phase6TableA.id !== phase6TableB.id, rowId: node.id, before, after: record.parentId, tableId: node.tableId };
    });
    phase6SceneAttack('phase6C-escape-ancestry-row-cell-membership-removal', scene, canonical, candidate => {
      const node = candidate.rows.find(item => item.id === phase6RowA.id)!;
      const record = node as unknown as JsonRecord;
      const before = [...node.cellIds];
      record.cellIds = before.filter(id => id !== phase6CellA.id);
      return { changed: before.includes(phase6CellA.id) && JSON.stringify(before) !== JSON.stringify(record.cellIds), ownerId: node.id, childId: phase6CellA.id, before, after: record.cellIds };
    });
    phase6SceneAttack('phase6C-escape-ancestry-cell-row-reassignment', scene, canonical, candidate => {
      const node = candidate.cells.find(item => item.id === phase6CellA.id)!;
      const record = node as unknown as JsonRecord;
      const before = node.rowId;
      record.rowId = phase6RowB.id;
      return { changed: before !== record.rowId && phase6RowA.id !== phase6RowB.id, cellId: node.id, before, after: record.rowId, targetExists: candidate.rows.some(item => item.id === record.rowId) };
    });
    phase6SceneAttack('phase6C-escape-ancestry-cell-parent-row-drift', scene, canonical, candidate => {
      const node = candidate.cells.find(item => item.id === phase6CellA.id)!;
      const record = node as unknown as JsonRecord;
      const before = node.parentId;
      record.parentId = phase6RowB.id;
      return { changed: before !== record.parentId && phase6RowA.id !== phase6RowB.id, cellId: node.id, before, after: record.parentId, rowId: node.rowId };
    });
    phase6SceneAttack('phase6C-escape-ancestry-cell-widget-membership-removal', scene, canonical, candidate => {
      const node = candidate.cells.find(item => item.id === phase6CellA.id)!;
      const record = node as unknown as JsonRecord;
      const before = [...node.widgetIds];
      const removed = before[0];
      record.widgetIds = removed === undefined ? [] : before.filter(id => id !== removed);
      return { changed: removed !== undefined && JSON.stringify(before) !== JSON.stringify(record.widgetIds), ownerId: node.id, childId: removed, before, after: record.widgetIds };
    });
    phase6SceneAttack('phase6C-escape-ancestry-widget-cell-reassignment', scene, canonical, candidate => {
      const node = candidate.widgets.find(item => item.id === phase6WidgetA.id)!;
      const record = node as unknown as JsonRecord;
      const before = node.cellId;
      record.cellId = phase6CellB.id;
      return { changed: before !== record.cellId && phase6CellA.id !== phase6CellB.id, widgetId: node.id, before, after: record.cellId, targetExists: candidate.cells.some(item => item.id === record.cellId) };
    });
    phase6SceneAttack('phase6C-escape-ancestry-widget-parent-cell-drift', scene, canonical, candidate => {
      const node = candidate.widgets.find(item => item.id === phase6WidgetA.id)!;
      const record = node as unknown as JsonRecord;
      const before = node.parentId;
      record.parentId = phase6CellB.id;
      return { changed: before !== record.parentId && phase6CellA.id !== phase6CellB.id, widgetId: node.id, before, after: record.parentId, cellId: node.cellId };
    });
    phase6SceneAttack('phase6C-escape-ancestry-widget-text-membership-removal', scene, canonical, candidate => {
      const node = candidate.widgets.find(item => item.id === phase6WidgetA.id)!;
      const record = node as unknown as JsonRecord;
      const before = [...node.textIds];
      const removed = before[0];
      record.textIds = removed === undefined ? [] : before.filter(id => id !== removed);
      return { changed: removed !== undefined && JSON.stringify(before) !== JSON.stringify(record.textIds), ownerId: node.id, childId: removed, before, after: record.textIds };
    });
    phase6SceneAttack('phase6C-escape-ancestry-text-widget-reassignment', scene, canonical, candidate => {
      const node = candidate.texts.find(item => item.id === phase6TextA.id)!;
      const record = node as unknown as JsonRecord;
      const before = node.widgetId;
      record.widgetId = phase6WidgetB.id;
      return { changed: before !== record.widgetId && phase6WidgetA.id !== phase6WidgetB.id, textId: node.id, before, after: record.widgetId, targetExists: candidate.widgets.some(item => item.id === record.widgetId) };
    });
    phase6SceneAttack('phase6C-escape-ancestry-text-glyph-membership-removal', scene, canonical, candidate => {
      const node = candidate.texts.find(item => item.id === phase6TextA.id)!;
      const record = node.lines[0] as unknown as JsonRecord;
      const before = [...node.lines[0]!.glyphIds];
      record.glyphIds = before.slice(1);
      return { changed: before.length > 0 && JSON.stringify(before) !== JSON.stringify(record.glyphIds), textId: node.id, lineIndex: node.lines[0]!.lineIndex, before, after: record.glyphIds };
    });
    phase6SceneAttack('phase6C-escape-ancestry-glyph-text-reassignment', scene, canonical, candidate => {
      const node = candidate.glyphs.find(item => item.id === phase6GlyphA.id)!;
      const record = node as unknown as JsonRecord;
      const before = node.textId;
      record.textId = phase6TextB.id;
      return { changed: before !== record.textId && phase6TextA.id !== phase6TextB.id, glyphId: node.id, before, after: record.textId, targetExists: candidate.texts.some(item => item.id === record.textId) };
    });

    const phase6TextWithLayout = scene.texts.find(item => item.layout !== undefined) || phase6TextA;
    phase6SceneAttack('phase6C-escape-text-layout-missing', scene, canonical, candidate => {
      const node = candidate.texts.find(item => item.id === phase6TextWithLayout.id)!;
      const record = node as unknown as JsonRecord;
      const hadLayout = record.layout !== undefined;
      delete record.layout;
      return { changed: hadLayout && record.layout === undefined, textId: node.id, hadLayout };
    });
    phase6SceneAttack('phase6C-escape-text-line-foreign-glyph', scene, canonical, candidate => {
      const node = candidate.texts.find(item => item.id === phase6TextA.id)!;
      const line = node.lines[0]!;
      const record = line as unknown as JsonRecord;
      const foreign = candidate.glyphs.find(item => item.textId !== node.id) || phase6GlyphB;
      const before = [...line.glyphIds];
      record.glyphIds = [...before, foreign.id];
      return { changed: !before.includes(foreign.id) && JSON.stringify(before) !== JSON.stringify(record.glyphIds), textId: node.id, lineIndex: line.lineIndex, foreignGlyphId: foreign.id, before, after: record.glyphIds };
    });
    phase6SceneAttack('phase6C-escape-glyph-impossible-line-index', scene, canonical, candidate => {
      const node = candidate.glyphs.find(item => item.id === phase6GlyphA.id)!;
      const record = node as unknown as JsonRecord;
      const before = node.lineIndex;
      record.lineIndex = candidate.texts.find(item => item.id === node.textId)?.lines.length ?? before + 1;
      return { changed: before !== record.lineIndex, glyphId: node.id, textId: node.textId, before, after: record.lineIndex };
    });
    phase6SceneAttack('phase6C-escape-glyph-source-range-drift', scene, canonical, candidate => {
      const node = candidate.glyphs.find(item => item.id === phase6GlyphA.id)!;
      const record = node.sourceRange as unknown as JsonRecord;
      const before = node.sourceRange.start;
      record.start = before + 1;
      return { changed: before !== record.start, glyphId: node.id, before, after: record.start };
    });
    phase6SceneAttack('phase6C-escape-glyph-codepoint-range-drift', scene, canonical, candidate => {
      const node = candidate.glyphs.find(item => item.id === phase6GlyphA.id)!;
      const record = node.sourceCodePointRange as unknown as JsonRecord;
      const before = node.sourceCodePointRange.end;
      record.end = before + 1;
      return { changed: before !== record.end, glyphId: node.id, before, after: record.end };
    });
    phase6SceneAttack('phase6C-escape-glyph-invalid-uv-quad', scene, canonical, candidate => {
      const node = candidate.glyphs.find(item => item.id === phase6GlyphA.id)!;
      const uv = node.quad.uv as unknown as JsonRecord;
      const before = uv.u1;
      uv.u1 = 2;
      return { changed: before !== uv.u1, glyphId: node.id, before, after: uv.u1 };
    });
    phase6SceneAttack('phase6C-escape-glyph-codepoint-drift', scene, canonical, candidate => {
      const node = candidate.glyphs.find(item => item.id === phase6GlyphA.id)!;
      const record = node as unknown as JsonRecord;
      const before = node.codePoint;
      record.codePoint = (before + 1) % 128;
      return { changed: before !== record.codePoint, glyphId: node.id, before, after: record.codePoint };
    });
    phase6SceneAttack('phase6C-control-glyph-bitmap-bounds-already-refused', scene, canonical, candidate => {
      const node = candidate.glyphs.find(item => item.id === phase6GlyphA.id)!;
      const bounds = node.quad.bitmapBounds as unknown as JsonRecord;
      const before = Number(bounds.right);
      bounds.right = before + 1;
      return { changed: before !== bounds.right, glyphId: node.id, before, after: bounds.right };
    });

    phase6SceneAttack('phase6C-escape-source-profile-file-drift', scene, canonical, candidate => {
      const source = candidate.profile.source as unknown as JsonRecord;
      const before = source.file;
      source.file = `${String(before)}.drift`;
      return { changed: before !== source.file, before, after: source.file };
    });
    phase6SceneAttack('phase6C-escape-source-profile-source-path-drift', scene, canonical, candidate => {
      const source = candidate.profile.source as unknown as JsonRecord;
      const before = source.sourcePath;
      source.sourcePath = `${String(before || source.file)}.drift`;
      return { changed: before !== source.sourcePath, before, after: source.sourcePath };
    });
    phase6SceneAttack('phase6C-escape-source-profile-sha-drift', scene, canonical, candidate => {
      const source = candidate.profile.source as unknown as JsonRecord;
      const before = source.sha256;
      source.sha256 = '0'.repeat(64);
      return { changed: before !== source.sha256, before, after: source.sha256 };
    });
    phase6InputAttack('phase6C-escape-selection-primitive', { scene, corpus: canonical }, candidate => {
      const before = candidate.selection;
      (candidate as unknown as JsonRecord).selection = 7;
      return { changed: before !== (candidate as unknown as JsonRecord).selection, before, after: (candidate as unknown as JsonRecord).selection };
    });
    phase6InputAttack('phase6C-escape-selection-source-file-drift', { scene, corpus: canonical, selection: { nodeIds: [phase6WidgetA.id], source: clonedSource(phase6WidgetA.source) } }, candidate => {
      const source = (candidate.selection?.source as unknown as JsonRecord);
      const before = source.file;
      source.file = `${String(before)}.selection-drift`;
      return { changed: before !== source.file, before, after: source.file, selected: candidate.selection?.nodeIds };
    });
    phase6InputAttack('phase6C-escape-selection-source-range-drift', { scene, corpus: canonical, selection: { nodeIds: [phase6WidgetA.id], source: clonedSource(phase6WidgetA.source) } }, candidate => {
      const source = candidate.selection?.source;
      const start = source?.start as unknown as JsonRecord;
      const before = Number(start.offset);
      start.offset = before + 1;
      return { changed: before !== start.offset, before, after: start.offset, selected: candidate.selection?.nodeIds };
    });
    phase6InputAttack('phase6C-escape-selection-game-truth-key', { scene, corpus: canonical, selection: { nodeIds: [phase6WidgetA.id] } }, candidate => {
      const selection = candidate.selection as unknown as JsonRecord;
      selection.gameVerified = true;
      return { changed: selection.gameVerified === true, selected: candidate.selection?.nodeIds, gameVerified: selection.gameVerified };
    });

    phase6InputAttack('phase6C-escape-keepout-unknown-entry', withContext, candidate => {
      const projection = (candidate.keepOuts![0].projection as unknown as JsonRecord);
      const before = projection.entryId;
      projection.entryId = 'unknown-keepout-entry';
      return { changed: before !== projection.entryId, before, after: projection.entryId };
    });
    phase6InputAttack('phase6C-escape-keepout-invented-grade', withContext, candidate => {
      const projection = (candidate.keepOuts![0].projection as unknown as JsonRecord);
      const before = projection.evidenceGrade;
      projection.evidenceGrade = 'invented-grade';
      return { changed: before !== projection.evidenceGrade, before, after: projection.evidenceGrade };
    });
    phase6InputAttack('phase6C-escape-keepout-context-member-mismatch', withContext, candidate => {
      const entry = candidate.keepOuts![0] as unknown as JsonRecord;
      const projection = entry.projection as JsonRecord;
      const beforeContext = entry.context;
      const beforeKind = (projection.geometry as JsonRecord).kind;
      entry.context = KEEP_OUT_PRESET_IDS.mapOpen;
      (projection.geometry as JsonRecord).kind = 'vertical-guide';
      (projection.geometry as JsonRecord).x = 1;
      return { changed: beforeContext !== entry.context && beforeKind !== (projection.geometry as JsonRecord).kind, beforeContext, afterContext: entry.context, beforeKind, afterKind: (projection.geometry as JsonRecord).kind };
    });
    phase6InputAttack('phase6C-escape-keepout-out-of-viewport-guide', withContext, candidate => {
      const geometry = ((candidate.keepOuts![0].projection as unknown as JsonRecord).geometry as JsonRecord);
      const before = geometry.y;
      geometry.y = viewport.height + 1;
      return { changed: before !== geometry.y, before, after: geometry.y, viewport };
    });
    phase6InputAttack('phase6C-escape-keepout-duplicate-entry-across-contexts', withContext, candidate => {
      const firstProjection = candidate.keepOuts![0].projection as unknown as JsonRecord;
      const secondProjection = candidate.keepOuts![1].projection as unknown as JsonRecord;
      const before = secondProjection.entryId;
      secondProjection.entryId = firstProjection.entryId;
      return { changed: before !== secondProjection.entryId, first: firstProjection.entryId, secondBefore: before, secondAfter: secondProjection.entryId, contexts: candidate.keepOuts!.map(item => item.context) };
    });
    phase6InputAttack('phase6C-escape-keepout-malformed-projected-reason', withContext, candidate => {
      const projection = candidate.keepOuts![0].projection as unknown as JsonRecord;
      projection.reason = 'unexpected-projected-reason';
      return { changed: projection.reason === 'unexpected-projected-reason', status: projection.status, reason: projection.reason };
    });
    phase6InputAttack('phase6C-escape-keepout-unknown-key', withContext, candidate => {
      const projection = candidate.keepOuts![0].projection as unknown as JsonRecord;
      projection.unknownEvidenceField = 'defined';
      return { changed: projection.unknownEvidenceField === 'defined', key: 'unknownEvidenceField' };
    });
    phase6InputAttack('phase6C-escape-keepout-nested-truth', withContext, candidate => {
      const projection = candidate.keepOuts![0].projection as unknown as JsonRecord;
      projection.verification = { game: 'Engine accepted', gameVerified: true };
      return { changed: projection.verification !== undefined, verification: projection.verification };
    });

    phase6SceneAttack('phase6C-escape-order-source-order-drift', scene, canonical, candidate => {
      const node = candidate.frames.find(item => item.id === phase6FrameA.id)!;
      const record = node as unknown as JsonRecord;
      const before = node.sourceOrder;
      record.sourceOrder = before + 1;
      return { changed: before !== record.sourceOrder, nodeId: node.id, before, after: record.sourceOrder, sourceOffset: node.source.start.offset };
    });
    phase6SceneAttack('phase6C-escape-order-malformed-layer', scene, canonical, candidate => {
      const node = candidate.frames.find(item => item.id === phase6FrameA.id)!;
      const record = node as unknown as JsonRecord;
      const before = node.layer;
      record.layer = 'malformed-layer';
      return { changed: before !== record.layer, frameId: node.id, before, after: record.layer };
    });
    phase6SceneAttack('phase6C-escape-order-unsafe-z-order', scene, canonical, candidate => {
      const node = candidate.tables.find(item => item.id === phase6TableA.id)!;
      const record = node as unknown as JsonRecord;
      const before = node.zOrder;
      record.zOrder = Number.MAX_SAFE_INTEGER + 1;
      return { changed: before !== record.zOrder, nodeId: node.id, before, after: record.zOrder };
    });
    phase6SceneAttack('phase6C-escape-order-reversed-gaps', scene, canonical, candidate => {
      const record = candidate as unknown as JsonRecord;
      const before = [...candidate.gaps];
      record.gaps = [...before].reverse();
      return { changed: before.length > 1 && JSON.stringify(before) !== JSON.stringify(record.gaps), count: before.length, beforeIds: before.map(gap => gap.id), afterIds: (record.gaps as X4UiScene['gaps']).map(gap => gap.id) };
    });

    const linkedPhase6Gaps = scene.gaps.filter(gap => gap.nodeId !== undefined && allSceneNodes.some(node => node.id === gap.nodeId)).slice(0, 4);
    for (const [index, gap] of linkedPhase6Gaps.entries()) {
      phase6SceneAttack(`phase6C-escape-gap-source-file-${index + 1}`, scene, canonical, candidate => {
        const node = candidate.gaps.find(item => item.id === gap.id)!;
        const source = node.source as unknown as JsonRecord;
        const before = source.file;
        source.file = `${String(before)}.gap-drift`;
        return { changed: before !== source.file, gapId: node.id, nodeId: node.nodeId, before, after: source.file };
      });
    }

    const phase6TruthNode = allSceneNodes.find(node => node.provenanceLinks.length > 0) || phase6FrameA;
    phase6SceneAttack('phase6C-escape-truth-preview-game-verified', scene, canonical, candidate => {
      const preview = candidate.preview as unknown as JsonRecord;
      preview.gameVerified = true;
      return { changed: preview.gameVerified === true, field: 'preview.gameVerified' };
    });
    phase6SceneAttack('phase6C-escape-truth-diagnostic-engine-color', scene, canonical, candidate => {
      const style = candidate.diagnosticStyle as unknown as JsonRecord;
      style.engineColor = '#ffffff';
      return { changed: style.engineColor === '#ffffff', field: 'diagnosticStyle.engineColor' };
    });
    phase6SceneAttack('phase6C-escape-truth-gap-game-verified', scene, canonical, candidate => {
      const gap = candidate.gaps[0]! as unknown as JsonRecord;
      gap.gameVerified = true;
      return { changed: gap.gameVerified === true, gapId: gap.id, field: 'gap.gameVerified' };
    });
    phase6SceneAttack('phase6C-escape-truth-provenance-engine-accepted', scene, canonical, candidate => {
      const node = [...candidate.frames, ...candidate.tables, ...candidate.rows, ...candidate.cells, ...candidate.widgets, ...candidate.texts, ...candidate.glyphs].find(item => item.id === phase6TruthNode.id)! as unknown as JsonRecord;
      const links = node.provenanceLinks as unknown as JsonRecord[];
      const link = links[0];
      link.engineAccepted = true;
      return { changed: link.engineAccepted === true, nodeId: node.id, field: 'provenanceLinks[0].engineAccepted' };
    });
    phase6SceneAttack('phase6C-escape-truth-node-engine-accepted', scene, canonical, candidate => {
      const node = candidate.frames.find(item => item.id === phase6FrameA.id)! as unknown as JsonRecord;
      node.engineAccepted = true;
      return { changed: node.engineAccepted === true, nodeId: node.id, field: 'node.engineAccepted' };
    });

    phase6SceneAttack('phase6C-control-drawable-zero-width-already-refused', scene, canonical, candidate => {
      const drawable = candidate.drawableRect as unknown as JsonRecord;
      const profileDrawable = candidate.profile.drawable as unknown as JsonRecord;
      const before = { drawable: drawable.width, profile: profileDrawable.width };
      drawable.width = 0;
      profileDrawable.width = 0;
      return { changed: before.drawable !== drawable.width && before.profile !== profileDrawable.width, before, after: { drawable: drawable.width, profile: profileDrawable.width } };
    });
    phase6SceneAttack('phase6C-control-drawable-zero-height-already-refused', scene, canonical, candidate => {
      const drawable = candidate.drawableRect as unknown as JsonRecord;
      const profileDrawable = candidate.profile.drawable as unknown as JsonRecord;
      const before = { drawable: drawable.height, profile: profileDrawable.height };
      drawable.height = 0;
      profileDrawable.height = 0;
      return { changed: before.drawable !== drawable.height && before.profile !== profileDrawable.height, before, after: { drawable: drawable.height, profile: profileDrawable.height } };
    });
  }
}

void main().then(() => {
  const passed = checks.filter(checkResult => checkResult.pass).length;
  const failed = checks.filter(checkResult => !checkResult.pass);
  const phase6Escapes = checks.filter(checkResult => checkResult.name.startsWith('phase6C-escape-'));
  const phase6Controls = checks.filter(checkResult => checkResult.name.startsWith('phase6C-control-'));
  const phase6Detail = (checkResult: Check): JsonRecord => checkResult.detail !== null && typeof checkResult.detail === 'object' && !Array.isArray(checkResult.detail) ? checkResult.detail as JsonRecord : {};
  const phase6FixtureNotReady = [...phase6Escapes, ...phase6Controls].filter(checkResult => phase6Detail(checkResult).fixtureReady === false).length;
  const phase6ValidatorExceptions = [...phase6Escapes, ...phase6Controls].filter(checkResult => phase6Detail(checkResult).threw === true).length;
  const phase6IntendedValidControlNames = [
    'accepted Scene projects with all four keep-out contexts',
    'regular glyphs use canonical descriptor/atlas bounds and JSON-safe alpha commands',
    'source-derived bold text retains exact layout and atlas identity',
    'partial hierarchical clip adjusts source and destination',
    'zero clip emits diagnostic and no raster command',
    'partial cell geometry is clipped before paint',
    'partial widget geometry and unsupported paint diagnostics are clipped',
  ] as const;
  const phase6IntendedValidControls = phase6IntendedValidControlNames.map(name => ({ name, pass: checks.find(checkResult => checkResult.name === name)?.pass === true }));
  const phase6FamilyPrefixes = {
    ancestry: 'phase6C-escape-ancestry-',
    textLayoutGlyph: 'phase6C-escape-text-',
    glyph: 'phase6C-escape-glyph-',
    sourceSelection: 'phase6C-escape-source-',
    selection: 'phase6C-escape-selection-',
    keepout: 'phase6C-escape-keepout-',
    ordering: 'phase6C-escape-order-',
    gapSource: 'phase6C-escape-gap-source-',
    truth: 'phase6C-escape-truth-',
  } as const;
  const phase6FamilyCounts = Object.fromEntries(Object.entries(phase6FamilyPrefixes).map(([family, prefix]) => [family, phase6Escapes.filter(checkResult => checkResult.name.startsWith(prefix)).length]));
  const phase6C = {
    total: phase6Escapes.length,
    passed: phase6Escapes.filter(checkResult => checkResult.pass).length,
    failed: phase6Escapes.filter(checkResult => !checkResult.pass).length,
    familyCounts: phase6FamilyCounts,
    negativeControlsGreen: phase6Controls.filter(checkResult => checkResult.pass).length,
    intendedValidControls: {
      total: phase6IntendedValidControls.length,
      passed: phase6IntendedValidControls.filter(control => control.pass).length,
      checks: phase6IntendedValidControls,
    },
    fixtureNotReady: phase6FixtureNotReady,
    validatorExceptions: phase6ValidatorExceptions,
    mutationCensus: {
      inconsistentRefused: phase6Escapes.filter(checkResult => phase6Detail(checkResult).validation && (phase6Detail(checkResult).validation as JsonRecord).status === 'refused').length,
      negativeControlsGreen: phase6Controls.filter(checkResult => checkResult.pass).length,
      intendedValidControls: phase6IntendedValidControls.filter(control => control.pass).length,
    },
  };
  const phaseCChecks = checks.filter(checkResult => checkResult.name.startsWith('phaseC-'));
  const phaseCDetail = (checkResult: Check): JsonRecord => checkResult.detail !== null && typeof checkResult.detail === 'object' && !Array.isArray(checkResult.detail) ? checkResult.detail as JsonRecord : {};
  const phaseCFamilies = {
    authority: 'phaseC-authority-',
    layout: 'phaseC-layout-',
    gap: 'phaseC-gap-',
    source: 'phaseC-source-',
    ordering: 'phaseC-independent',
  } as const;
  const phaseC = {
    total: phaseCChecks.length,
    passed: phaseCChecks.filter(checkResult => checkResult.pass).length,
    failed: phaseCChecks.filter(checkResult => !checkResult.pass).length,
    familyCounts: Object.fromEntries(Object.entries(phaseCFamilies).map(([family, prefix]) => [family, phaseCChecks.filter(checkResult => checkResult.name.startsWith(prefix)).length])),
    fixtureNotReady: phaseCChecks.filter(checkResult => phaseCDetail(checkResult).fixtureReady === false).length,
    validatorExceptions: phaseCChecks.filter(checkResult => phaseCDetail(checkResult).threw === true).length,
  };
  const phaseTChecks = checks.filter(checkResult => checkResult.name.startsWith('phaseT-'));
  const phaseTDetail = (checkResult: Check): JsonRecord => checkResult.detail !== null && typeof checkResult.detail === 'object' && !Array.isArray(checkResult.detail) ? checkResult.detail as JsonRecord : {};
  const phaseT = {
    total: phaseTChecks.length,
    passed: phaseTChecks.filter(checkResult => checkResult.pass).length,
    failed: phaseTChecks.filter(checkResult => !checkResult.pass).length,
    fixtureNotReady: phaseTChecks.filter(checkResult => phaseTDetail(checkResult).fixtureReady === false).length,
    validatorExceptions: phaseTChecks.filter(checkResult => phaseTDetail(checkResult).threw === true).length,
    details: phaseTChecks.map(checkResult => ({ name: checkResult.name, pass: checkResult.pass, detail: checkResult.detail })),
  };
  const prototypeChecks = checks.filter(checkResult => checkResult.name.startsWith('prototype-boundary-'));
  const prototypeDetails = prototypeChecks.map(checkResult => checkResult.detail !== null && typeof checkResult.detail === 'object' && !Array.isArray(checkResult.detail) ? checkResult.detail as JsonRecord : {});
  const prototypeBoundary = {
    total: prototypeChecks.length,
    passed: prototypeChecks.filter(checkResult => checkResult.pass).length,
    failed: prototypeChecks.filter(checkResult => !checkResult.pass).length,
    objectPrototype: prototypeChecks.filter(checkResult => checkResult.name.includes('inherited-')).length,
    customPrototype: prototypeChecks.filter(checkResult => checkResult.name.includes('custom-nonplain')).length,
    fixtureNotReady: prototypeDetails.filter(detail => detail.fixtureReady === false).length,
    validatorExceptions: prototypeDetails.filter(detail => detail.threw === true).length,
    names: prototypeChecks.map(checkResult => checkResult.name),
  };
  const closedDomainChecks = checks.filter(checkResult => checkResult.name.startsWith('closed-domain-'));
  const closedDomainDetails = closedDomainChecks.map(checkResult => checkResult.detail !== null && typeof checkResult.detail === 'object' && !Array.isArray(checkResult.detail) ? checkResult.detail as JsonRecord : {});
  const closedDomain = {
    total: closedDomainChecks.length,
    passed: closedDomainChecks.filter(checkResult => checkResult.pass).length,
    failed: closedDomainChecks.filter(checkResult => !checkResult.pass).length,
    fixtureNotReady: closedDomainDetails.filter(detail => detail.fixtureReady === false).length,
    validatorExceptions: closedDomainDetails.filter(detail => detail.threw === true).length,
    causalPrototypeEffects: closedDomainDetails.filter(detail => detail.causalPrototypeEffect === true).length,
    names: closedDomainChecks.map(checkResult => checkResult.name),
  };
  const causalChecks = checks.filter(checkResult => checkResult.name.startsWith('causal-'));
  const causal = {
    total: causalChecks.length,
    passed: causalChecks.filter(checkResult => checkResult.pass).length,
    failed: causalChecks.filter(checkResult => !checkResult.pass).length,
    names: causalChecks.map(checkResult => checkResult.name),
  };
  console.log(JSON.stringify({ allPassed: failed.length === 0, passed, total: checks.length, phase6C, phaseC, phaseT, prototypeBoundary, closedDomain, causal, failed }));
  if (failed.length > 0) process.exitCode = 1;
}).catch(error => {
  console.log(JSON.stringify({ allPassed: false, passed: 0, total: checks.length + 1, failed: [...checks.filter(checkResult => !checkResult.pass), { name: 'paint-plan selftest runner', pass: false, detail: error instanceof Error ? error.message : String(error) }] }));
  process.exitCode = 1;
});
