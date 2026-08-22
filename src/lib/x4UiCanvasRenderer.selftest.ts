import type { ModWorkspace, PassthroughFile } from '../types';
import { createX4UiLayoutTargetCatalog } from './x4UiLayoutProgram';
import {
  X4_UI_CORPUS_9_00_CONTRACT,
  X4_UI_CORPUS_FILE_URL,
  X4_UI_CORPUS_MANIFEST_URL,
  X4_UI_CORPUS_STATUS_URL,
  X4_UI_CORPUS_9_00_COLOR_CONTRACT,
  isX4UiCorpusCanonicalSuccess,
  isX4UiCorpusCanonicalColorSuccess,
  loadCanonicalX4UiCorpusAssets,
  loadCanonicalX4UiCorpusColorEvidence,
  type X4UiCorpusCanonicalSuccess,
  type X4UiCorpusCanonicalColorSuccess,
  type X4UiCorpusFetchResponse,
} from './x4UiCorpusAssets';
import {
  applyZektonSdfAlpha,
  ZEKTON_DDS_HEADER_SIZE,
  ZEKTON_DESCRIPTOR_HEADER_SIZE,
  ZEKTON_DESCRIPTOR_TRAILING_SIZE,
  ZEKTON_RECORD_SIZE,
} from './x4UiFontMetrics';
import {
  KEEP_OUT_IDS,
  KEEP_OUT_PRESET_IDS,
  NOT_VERIFIED_IN_GAME,
  calibrateKeepOutPolygon,
  getBuiltInKeepOut,
  projectBuiltInKeepOut,
  projectKeepOut,
} from './x4UiKeepOuts';
import {
  buildX4UiPreviewProfile,
  projectX4UiPreviewPipeline,
  type X4UiPreviewPipelineResult,
} from './x4UiPreviewPipeline';
import {
  projectX4UiPaintPlan,
  type X4UiPaintPlan,
  type X4UiPaintPlanResult,
} from './x4UiPaintPlan';
import { buildX4UiWorkspaceSource, type X4UiWorkspaceSource } from './x4UiWorkspaceSource';
import type { X4UiScene } from './x4UiScene';
import {
  X4_UI_CANVAS_DIAGNOSTIC_PALETTE,
  renderX4UiPaintPlanToCanvas,
  type X4UiCanvasRenderOptions,
  type X4UiCanvasRenderReceipt,
  type X4UiCanvasRenderResult,
  type X4UiCanvasSurface,
  type X4UiCanvasSurfaceFactory,
} from './x4UiCanvasRenderer';

type JsonRecord = Record<string, unknown>;
type CheckFamily = 'prior-44' | 'callback-isolation' | 'pre-allocation' | 'emitted-trace' | 'freeze-truth' | 'oracle-sensitivity' | 'batch-6d-causal' | 'stage-b-causal';
type Check = { readonly family: CheckFamily; readonly name: string; readonly pass: boolean; readonly detail?: unknown };
const checks: Check[] = [];

function asRecord(value: unknown): JsonRecord | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : undefined;
}

const COLOR_FACT_FIELDS = ['field', 'slot', 'value', 'domain', 'provenance', 'expression', 'source', 'sourcePin', 'sampleId', 'gameVerification'] as const;

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(item => stableJson(item)).join(',')}]`;
  const record = asRecord(value);
  if (record !== undefined) return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

function colorFactSignature(value: unknown): string | undefined {
  const record = asRecord(value);
  if (record === undefined) return undefined;
  const copy: JsonRecord = {};
  for (const field of COLOR_FACT_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(record, field)) copy[field] = record[field];
  }
  return stableJson(copy);
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

function check(name: string, pass: boolean, detail?: unknown): void {
  checks.push({ family: 'prior-44', name, pass, ...(detail === undefined ? {} : { detail }) });
}

function familyCheck(family: Exclude<CheckFamily, 'prior-44'>, name: string, pass: boolean, detail?: unknown): void {
  checks.push({ family, name, pass, ...(detail === undefined ? {} : { detail }) });
}

function responseHeaders(contentType: string): { get(name: string): string | null } {
  return { get: name => name.toLowerCase() === 'content-type' ? contentType : null };
}

function jsonResponse(body: unknown): X4UiCorpusFetchResponse {
  return { status: 200, headers: responseHeaders('application/json; charset=utf-8'), json: async () => body };
}

function bytesResponse(bytes: Uint8Array, contentType = 'application/octet-stream'): X4UiCorpusFetchResponse {
  const copy = bytes.slice();
  return { status: 200, headers: responseHeaders(contentType), arrayBuffer: async () => copy.buffer };
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
  // A compact A8 glyph-shaped fixture: 255 is the shipped empty field and 91 is interior glyph coverage.
  for (let y = 1; y < 9; y += 1) {
    for (let x = 2; x < 6; x += 1) bytes[ZEKTON_DDS_HEADER_SIZE + y * 8 + x] = 91;
  }
  return bytes;
}

async function withCanonicalPlatformHash<T>(expectedHashes: readonly string[], run: () => Promise<T>, recordRestoreCheck = true): Promise<T> {
  const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  const originalValue = (globalThis as unknown as { crypto?: unknown }).crypto;
  let hashIndex = 0;
  try {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      enumerable: originalDescriptor?.enumerable ?? true,
      writable: true,
      value: { subtle: { digest: async (): Promise<ArrayBuffer> => hexDigest(expectedHashes[hashIndex++] ?? '') } },
    });
    return await run();
  } finally {
    if (originalDescriptor) Object.defineProperty(globalThis, 'crypto', originalDescriptor);
    else Reflect.deleteProperty(globalThis, 'crypto');
    if (recordRestoreCheck) check('canonical loader restores platform crypto', (globalThis as unknown as { crypto?: unknown }).crypto === originalValue);
  }
}

function pathFromQuery(url: string, key: string): string {
  const pair = url.slice(url.indexOf('?') + 1).split('&').find(item => item.startsWith(`${key}=`));
  if (pair === undefined) throw new Error(`missing query ${key}`);
  return decodeURIComponent(pair.slice(key.length + 1));
}

async function loadCanonicalFixture(): Promise<X4UiCorpusCanonicalSuccess> {
  const root = 'canvas-renderer-canonical-root';
  const generation = 'canvas-renderer-canonical-generation';
  const contract = X4_UI_CORPUS_9_00_CONTRACT;
  const buffers = new Map<string, Uint8Array>([
    [contract.helper.relativePath, new TextEncoder().encode('-- canvas renderer helper\n')],
    [contract.widget.relativePath, new TextEncoder().encode('-- canvas renderer widget\n')],
    [contract.regular.descriptor.relativePath, makeCanonicalAbc(8)],
    [contract.regular.atlas.relativePath, makeCanonicalDds()],
    [contract.bold.descriptor.relativePath, makeCanonicalAbc(8)],
    [contract.bold.atlas.relativePath, makeCanonicalDds()],
  ]);
  const status = {
    available: true,
    root,
    generatedAt: '2026-08-13T00:00:00.000Z',
    manifestGeneration: generation,
    manifest: { available: true, state: 'ready', root, current: { generation, root, generatedAt: '2026-08-13T00:00:00.000Z' } },
  };
  const transport = async (url: string): Promise<X4UiCorpusFetchResponse> => {
    if (url === X4_UI_CORPUS_STATUS_URL) return jsonResponse(status);
    if (url.startsWith(`${X4_UI_CORPUS_MANIFEST_URL}?`)) {
      const path = pathFromQuery(url, 'q');
      const bytes = buffers.get(path);
      if (bytes === undefined) throw new Error(`unknown manifest path ${path}`);
      return jsonResponse({ status: { available: true, state: 'ready', root, current: { generation, root, generatedAt: status.generatedAt } }, generation, total: 1, limit: 500, offset: 0, files: [{ path, bytes: bytes.byteLength }] });
    }
    if (url.startsWith(`${X4_UI_CORPUS_FILE_URL}?`)) {
      const path = pathFromQuery(url, 'path');
      const bytes = buffers.get(path);
      if (bytes === undefined) throw new Error(`unknown file path ${path}`);
      return bytesResponse(bytes, path.endsWith('.lua') ? 'text/plain' : 'application/octet-stream');
    }
    throw new Error(`unexpected corpus URL ${url}`);
  };
  const expectedHashes = [
    contract.helper.sha256,
    contract.widget.sha256,
    contract.regular.descriptor.sha256,
    contract.regular.atlas.sha256,
    contract.bold.descriptor.sha256,
    contract.bold.atlas.sha256,
  ];
  const result = await withCanonicalPlatformHash(expectedHashes, () => loadCanonicalX4UiCorpusAssets({ transport }));
  if (!isX4UiCorpusCanonicalSuccess(result)) throw new Error(`canonical loader did not issue canonical success: ${JSON.stringify(result)}`);
  return result;
}

async function loadCanonicalColorFixture(): Promise<X4UiCorpusCanonicalColorSuccess> {
  const root = 'canvas-renderer-color-canonical-root';
  const generation = 'canvas-renderer-color-canonical-generation';
  const contract = X4_UI_CORPUS_9_00_COLOR_CONTRACT;
  const colorDefinitions = Array.from({ length: 224 }, (_unused, index) => `<color id="paint_color_${String(index)}" r="${String(index % 256)}" g="${String((index + 1) % 256)}" b="${String((index + 2) % 256)}" a="255" glow="0" />`).join('');
  const colorMappings = Array.from({ length: 804 }, (_unused, index) => `<mapping id="paint_mapping_${String(index)}" ref="paint_color_${String(index % 224)}" />`).join('');
  const xmlText = `<colormap><colors>${colorDefinitions}</colors><mappings>${colorMappings}</mappings></colormap>`;
  const xsdText = '<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema"><xs:simpleType name="colorId"><xs:restriction base="xs:string"><xs:pattern value="[a-zA-Z_][a-zA-Z0-9_]*"/></xs:restriction></xs:simpleType><xs:simpleType name="colorid"><xs:restriction base="xs:string"><xs:pattern value="[a-zA-Z_][a-zA-Z0-9_]*"/></xs:restriction></xs:simpleType><xs:element name="colormap"><xs:complexType><xs:sequence><xs:choice minOccurs="0" maxOccurs="unbounded"><xs:element name="color"><xs:complexType><xs:attribute name="id" type="colorId" use="required"/><xs:attribute name="r" type="xs:unsignedByte"/><xs:attribute name="g" type="xs:unsignedByte"/><xs:attribute name="b" type="xs:unsignedByte"/><xs:attribute name="a" type="xs:unsignedByte"/><xs:attribute name="glow" type="xs:unsignedByte"/></xs:complexType></xs:element><xs:element name="mapping"><xs:complexType><xs:attribute name="id" type="colorId" use="required"/><xs:attribute name="ref" type="colorId" use="required"/></xs:complexType></xs:element></xs:choice></xs:sequence></xs:complexType></xs:element></xs:schema>';
  const padToSize = (value: string, size: number): Uint8Array => new TextEncoder().encode(`${value}${' '.repeat(size - new TextEncoder().encode(value).byteLength)}`);
  const buffers = new Map<string, Uint8Array>([
    [contract.xml.relativePath, padToSize(xmlText, contract.xml.size)],
    [contract.xsd.relativePath, padToSize(xsdText, contract.xsd.size)],
  ]);
  const expectedHashes = [contract.xml.sha256, contract.xsd.sha256];
  const status = {
    available: true,
    root,
    generatedAt: '2026-08-13T00:00:00.000Z',
    manifestGeneration: generation,
    manifest: { available: true, state: 'ready', root, current: { generation, root, generatedAt: '2026-08-13T00:00:00.000Z' } },
  };
  const transport = async (url: string): Promise<X4UiCorpusFetchResponse> => {
    if (url === X4_UI_CORPUS_STATUS_URL) return jsonResponse(status);
    if (url.startsWith(`${X4_UI_CORPUS_MANIFEST_URL}?`)) {
      const path = pathFromQuery(url, 'q');
      const bytes = buffers.get(path);
      if (bytes === undefined) throw new Error(`unknown color manifest path ${path}`);
      return jsonResponse({ status: { available: true, state: 'ready', root, current: { generation, root, generatedAt: status.generatedAt } }, generation, total: 1, limit: 500, offset: 0, files: [{ path, bytes: bytes.byteLength }] });
    }
    if (url.startsWith(`${X4_UI_CORPUS_FILE_URL}?`)) {
      const path = pathFromQuery(url, 'path');
      const bytes = buffers.get(path);
      if (bytes === undefined) throw new Error(`unknown color file path ${path}`);
      return bytesResponse(bytes, 'application/xml');
    }
    throw new Error(`unexpected canonical color URL ${url}`);
  };
  const result = await withCanonicalPlatformHash(expectedHashes, () => loadCanonicalX4UiCorpusColorEvidence({ transport }), false);
  if (!isX4UiCorpusCanonicalColorSuccess(result)) throw new Error(`canonical color loader did not issue canonical success: ${JSON.stringify(result)}`);
  return result;
}

function passthrough(path: string, content: string, extra: Partial<PassthroughFile> = {}): PassthroughFile {
  return { path, content, ...extra };
}

function workspace(files: PassthroughFile[]): ModWorkspace {
  return {
    id: 'batch6d-canvas-selftest',
    name: 'Batch 6D Canvas renderer',
    version: '1.0.0',
    author: 'Forge',
    description: 'pure Canvas renderer fixture',
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
    'local menu = { name = "Canvas", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80, layer = 1 })',
    'local table = frame:addTable(4, { width = 100, reserveScrollBar = false, scaling = false })',
    'table:setColWidth(1, 20, false)',
    'table:setColWidth(2, 20, false)',
    'table:setColWidth(3, 20, false)',
    'table:setColWidth(4, 20, false)',
    'local row = table:addRow(false, { paddingTop = 1, paddingBottom = 1, borderBelow = false, fixed = false })',
    'row[1]:setColSpan(2):createText("regular", { height = 12, minRowHeight = 10 })',
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
    passthrough('ui.xml', '<?xml version="1.0" encoding="utf-8"?>\n<addon name="canvas-fixture"><environment type="menus"><file name="ui/canvas.lua" /></environment></addon>\n'),
    passthrough('ui/canvas.lua', lua, { reason: 'unparsed' }),
  ]));
}

function colorSourceFixture(): X4UiWorkspaceSource {
  const lua = [
    'local menu = { name = "ColorCanonical", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80, layer = 1 })',
    'local table = frame:addTable(4, { width = 100, reserveScrollBar = false, scaling = false, backgroundID = "solid", backgroundColor = Color["paint_color_0"] })',
    'table:setColWidth(1, 20, false)',
    'table:setColWidth(2, 20, false)',
    'table:setColWidth(3, 20, false)',
    'table:setColWidth(4, 20, false)',
    'local row = table:addRow(false, { paddingTop = 1, paddingBottom = 1, borderBelow = false, fixed = false })',
    'row[1]:setColSpan(2):createText("direct", { height = 12, minRowHeight = 10, color = { r = 11, g = 21, b = 31, a = 41 }, cellbgcolor = { r = 12, g = 22, b = 32, a = 42 } })',
    'row[3]:createButton({ height = 0, affectRowHeight = false, bgcolor = { r = 13, g = 23, b = 33, a = 43 }, highlightcolor = { r = 14, g = 24, b = 34, a = 44 }, bordercolor = { r = 15, g = 25, b = 35, a = 45 } }):setText("button", { x = 0, y = 0, color = { r = 16, g = 26, b = 36, a = 46 } }):setText2("bold", { x = 0, y = 0, halign = "right", font = "Zekton Bold", fontsize = 16, color = { r = 17, g = 27, b = 37, a = 47 } })',
    'row[4]:createIcon("solid", { height = 8, affectRowHeight = false, color = { r = 19, g = 29, b = 39, a = 49 } })',
    'local editRow = table:addRow(false, { paddingTop = 1, paddingBottom = 1, borderBelow = false, fixed = false })',
    'editRow[1]:createEditBox({ height = 8, affectRowHeight = false, bgcolor = { r = 18, g = 28, b = 38, a = 48 } })',
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
      '<addon name="color-canonical-fixture">',
      '  <environment type="menus">',
      '    <file name="ui/color.lua" />',
      '  </environment>',
      '',
    ].join('\n')),
    passthrough('ui/color.lua', lua, { reason: 'unparsed' }),
  ]));
}

function boundedCompositionSourceFixture(): X4UiWorkspaceSource {
  const lua = [
    'local menu = { name = "BoundedComposition", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80, layer = 1 })',
    'local active = frame:addTable(1, { x = 8, y = 4, width = 24, reserveScrollBar = false, scaling = false, backgroundID = "solid", backgroundColor = Color["paint_color_0"] })',
    'active:setColWidthMin(1, 1, 1, false)',
    'local activeRow = active:addRow(false, { paddingTop = 0, paddingBottom = 0, borderBelow = false, fixed = false, scaling = false })',
    'activeRow[1]:createText("bounded", { height = 8, minRowHeight = 8 })',
    'local empty = frame:addTable(1, { x = 50, y = 4, width = 18, reserveScrollBar = false, scaling = false, backgroundColor = Color["paint_color_0"] })',
    'empty:setColWidthMin(1, 1, 1, false)',
    'local emptyRow = empty:addRow(false, { paddingTop = 0, paddingBottom = 0, borderBelow = false, fixed = false, scaling = false })',
    'emptyRow[1]:createText("default", { height = 8, minRowHeight = 8 })',
    'local buttonTable = frame:addTable(1, { x = 8, y = 30, width = 24, reserveScrollBar = false, scaling = false, backgroundID = "solid", backgroundColor = Color["paint_color_0"] })',
    'buttonTable:setColWidthMin(1, 1, 1, false)',
    'local buttonRow = buttonTable:addRow(false, { paddingTop = 0, paddingBottom = 0, borderBelow = false, fixed = false, scaling = false })',
    'buttonRow[1]:createButton({ height = 8, affectRowHeight = true, bgcolor = { r = 13, g = 23, b = 33, a = 43 }, bordercolor = { r = 15, g = 25, b = 35, a = 45 } }):setText("button", { x = 0, y = 0, color = { r = 16, g = 26, b = 36, a = 46 } })',
    'frame:display()',
    '',
  ].join('\n');
  return buildX4UiWorkspaceSource(workspace([
    passthrough('ui.xml', '<?xml version="1.0" encoding="utf-8"?>\n<addon name="bounded-canvas-fixture"><environment type="menus"><file name="ui/bounded.lua" /></environment></addon>\n'),
    passthrough('ui/bounded.lua', lua, { reason: 'unparsed' }),
  ]));
}

function acceptedPlan(corpus: X4UiCorpusCanonicalSuccess): { readonly corpus: X4UiCorpusCanonicalSuccess; readonly preview: X4UiPreviewPipelineResult; readonly paint: Extract<X4UiPaintPlanResult, { readonly status: 'projected' | 'partial' }> } {
  const source = sourceFixture();
  const sourceFile = source.bundle?.sourceFiles.find(file => file.path === 'ui/canvas.lua');
  if (sourceFile === undefined) throw new Error('source fixture did not produce ui/canvas.lua');
  const catalog = createX4UiLayoutTargetCatalog(sourceFile.callModel);
  const target = catalog.targets.find(candidate => candidate.kind === 'top-level');
  if (target === undefined) throw new Error('source fixture has no top-level layout target');
  const selection = { sourceIndex: sourceFile.index, path: sourceFile.path, sourceIdentity: catalog.sourceIdentity, target: { ...target, id: target.id } };
  const profile = buildX4UiPreviewProfile({ id: 'canvas-preview', provenance: 'Batch 6D renderer selftest', truthGrade: 'supplied', source: selection.sourceIdentity, drawable: { width: 100, height: 80 }, uiScale: 1, minTextHeight: 10 });
  const preview = projectX4UiPreviewPipeline({
    source,
    corpus,
    profile: { id: profile.id, provenance: profile.provenance, truthGrade: 'supplied', source: selection.sourceIdentity, drawable: { width: 100, height: 80 }, uiScale: 1, minTextHeight: 10 },
    selection,
  });
  if (preview.scene === undefined || (preview.scene.status !== 'projected' && preview.scene.status !== 'partial')) throw new Error(`preview fixture refused: ${JSON.stringify(preview.scene)}`);
  const viewport = { width: 100, height: 80 };
  const keepOuts = [
    { context: KEEP_OUT_PRESET_IDS.cockpitConversation, entry: getBuiltInKeepOut(KEEP_OUT_IDS.conversationBackRow)!, projection: projectBuiltInKeepOut(KEEP_OUT_IDS.conversationBackRow, viewport) },
    { context: KEEP_OUT_PRESET_IDS.cockpitConversation, entry: getBuiltInKeepOut(KEEP_OUT_IDS.conversationOptionStackStart)!, projection: projectBuiltInKeepOut(KEEP_OUT_IDS.conversationOptionStackStart, viewport) },
    { context: KEEP_OUT_PRESET_IDS.mapOpen, entry: getBuiltInKeepOut(KEEP_OUT_IDS.informationPanelLeftEdge)!, projection: projectBuiltInKeepOut(KEEP_OUT_IDS.informationPanelLeftEdge, viewport) },
    { context: KEEP_OUT_PRESET_IDS.fullscreenMenu, entry: getBuiltInKeepOut(KEEP_OUT_IDS.missionMessagesTicker)!, projection: projectBuiltInKeepOut(KEEP_OUT_IDS.missionMessagesTicker, viewport) },
    { context: KEEP_OUT_PRESET_IDS.firstPerson, entry: getBuiltInKeepOut(KEEP_OUT_IDS.topHudStrip)!, projection: projectBuiltInKeepOut(KEEP_OUT_IDS.topHudStrip, viewport) },
  ] as const;
  const selectedNode = preview.scene.scene.widgets[0]?.id;
  const paintResult = projectX4UiPaintPlan({ scene: preview.scene.scene, corpus, previewAuthority: preview, keepOuts, selection: selectedNode === undefined ? undefined : { nodeIds: [selectedNode] } });
  if (paintResult.status === 'refused') throw new Error(`paint fixture refused: ${JSON.stringify(paintResult)}`);
  return { corpus, preview, paint: paintResult };
}

type TraceEntry = { readonly role: string; readonly name: string; readonly args: readonly unknown[] };

interface TraceContextHooks {
  readonly beforeCreateImageData?: () => void;
  readonly captureImageData?: (data: Uint8ClampedArray) => void;
  readonly failDrawImage?: boolean;
  readonly afterOperation?: (role: string, name: string, args: readonly unknown[]) => void;
}

function makeTraceContext(trace: TraceEntry[], role: string, allowImageData: boolean, failImageData = false, hooks: TraceContextHooks = {}): JsonRecord {
  const recordOperation = (name: string, args: readonly unknown[]): void => {
    trace.push({ role, name, args });
    hooks.afterOperation?.(role, name, args);
  };
  let fillStyle = '';
  let strokeStyle = '';
  const record: JsonRecord = {
    save: (...args: unknown[]) => { recordOperation('save', args); },
    restore: (...args: unknown[]) => { recordOperation('restore', args); },
    beginPath: (...args: unknown[]) => { recordOperation('beginPath', args); },
    rect: (...args: unknown[]) => { recordOperation('rect', args); },
    clip: (...args: unknown[]) => { recordOperation('clip', args); },
    fillRect: (...args: unknown[]) => { recordOperation('fillRect', args); },
    moveTo: (...args: unknown[]) => { recordOperation('moveTo', args); },
    lineTo: (...args: unknown[]) => { recordOperation('lineTo', args); },
    closePath: (...args: unknown[]) => { recordOperation('closePath', args); },
    stroke: (...args: unknown[]) => { recordOperation('stroke', args); },
    drawImage: (...args: unknown[]) => {
      const source = args[0] as JsonRecord | undefined;
      recordOperation('drawImage', [source?.role ?? 'surface', ...args.slice(1)]);
      if (hooks.failDrawImage === true) throw new Error('selftest target draw failure');
    },
  };
  Object.defineProperties(record, {
    fillStyle: {
      configurable: true,
      enumerable: true,
      get: () => fillStyle,
      set: (value: unknown) => {
        fillStyle = String(value);
        recordOperation('setFillStyle', [value]);
      },
    },
    strokeStyle: {
      configurable: true,
      enumerable: true,
      get: () => strokeStyle,
      set: (value: unknown) => {
        strokeStyle = String(value);
        recordOperation('setStrokeStyle', [value]);
      },
    },
  });
  if (allowImageData) {
    record.createImageData = (width: unknown, height: unknown) => {
      recordOperation('createImageData', [width, height]);
      if (failImageData) return null;
      hooks.beforeCreateImageData?.();
      return { data: new Uint8ClampedArray(Number(width) * Number(height) * 4) };
    };
    record.putImageData = (...args: unknown[]) => {
      const imageData = args[0] as JsonRecord | undefined;
      const pixels = imageData?.data instanceof Uint8ClampedArray ? Array.from(imageData.data) : undefined;
      recordOperation('putImageData', [args[1], args[2], pixels]);
      if (imageData?.data instanceof Uint8ClampedArray) hooks.captureImageData?.(imageData.data);
    };
  }
  return record;
}

function makeFactory(traces: TraceEntry[], allowImageData = true, failRole?: string, failImageData = false): X4UiCanvasSurfaceFactory {
  return (width, height, role) => {
    if (role === failRole) return null;
    const localTrace = traces;
    const context = makeTraceContext(localTrace, role, allowImageData, failImageData);
    const surface: JsonRecord & X4UiCanvasSurface = {
      role,
      width,
      height,
      getContext: (_kind: '2d') => context,
    };
    return surface;
  };
}

type RasterRect = { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
type RasterRgba = readonly [number, number, number, number];

interface RasterSurfaceState {
  readonly role: string;
  readonly width: number;
  readonly height: number;
  readonly pixels: Uint8ClampedArray;
}

interface RasterOutput {
  surface?: X4UiCanvasSurface;
  state?: RasterSurfaceState;
}

const rasterSurfaceStates = new WeakMap<object, RasterSurfaceState>();

function rasterIntersection(left: RasterRect | undefined, right: RasterRect | undefined): RasterRect | undefined {
  if (left === undefined) return right;
  if (right === undefined) return left;
  const x = Math.max(left.x, right.x);
  const y = Math.max(left.y, right.y);
  const rightEdge = Math.min(left.x + left.width, right.x + right.width);
  const bottomEdge = Math.min(left.y + left.height, right.y + right.height);
  return rightEdge <= x || bottomEdge <= y ? undefined : { x, y, width: rightEdge - x, height: bottomEdge - y };
}

function rasterContains(rect: RasterRect | undefined, x: number, y: number): boolean {
  return rect !== undefined && x >= rect.x && x < rect.x + rect.width && y >= rect.y && y < rect.y + rect.height;
}

function rasterStyle(value: unknown): RasterRgba | undefined {
  if (typeof value !== 'string') return undefined;
  if (/^#[0-9a-f]{6}$/i.test(value)) {
    return [Number.parseInt(value.slice(1, 3), 16), Number.parseInt(value.slice(3, 5), 16), Number.parseInt(value.slice(5, 7), 16), 255];
  }
  const match = /^rgba\(([^)]+)\)$/.exec(value);
  if (match === null) return undefined;
  const values = match[1]?.split(',').map(part => Number(part.trim())) ?? [];
  if (values.length !== 4 || values.some(part => !Number.isFinite(part))) return undefined;
  return [values[0] ?? 0, values[1] ?? 0, values[2] ?? 0, Math.max(0, Math.min(255, (values[3] ?? 0) * 255))];
}

function rasterBlend(pixels: Uint8ClampedArray, width: number, x: number, y: number, source: RasterRgba): void {
  if (x < 0 || y < 0 || x >= width) return;
  const offset = (y * width + x) * 4;
  const sourceAlpha = source[3] / 255;
  const destinationAlpha = pixels[offset + 3]! / 255;
  const outputAlpha = sourceAlpha + destinationAlpha * (1 - sourceAlpha);
  if (outputAlpha <= 0) return;
  pixels[offset] = Math.round((source[0] * sourceAlpha + pixels[offset]! * destinationAlpha * (1 - sourceAlpha)) / outputAlpha);
  pixels[offset + 1] = Math.round((source[1] * sourceAlpha + pixels[offset + 1]! * destinationAlpha * (1 - sourceAlpha)) / outputAlpha);
  pixels[offset + 2] = Math.round((source[2] * sourceAlpha + pixels[offset + 2]! * destinationAlpha * (1 - sourceAlpha)) / outputAlpha);
  pixels[offset + 3] = Math.round(outputAlpha * 255);
}

function rasterFill(state: RasterSurfaceState, clip: RasterRect | undefined, rect: RasterRect, style: RasterRgba | undefined): void {
  const visible = rasterIntersection(clip, rect);
  if (visible === undefined || style === undefined) return;
  const left = Math.max(0, Math.floor(visible.x));
  const top = Math.max(0, Math.floor(visible.y));
  const right = Math.min(state.width, Math.ceil(visible.x + visible.width));
  const bottom = Math.min(state.height, Math.ceil(visible.y + visible.height));
  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) rasterBlend(state.pixels, state.width, x, y, style);
  }
}

function rasterDrawImage(
  destinationState: RasterSurfaceState,
  clip: RasterRect | undefined,
  sourceSurface: unknown,
  sourceX: number,
  sourceY: number,
  sourceWidth: number,
  sourceHeight: number,
  destinationX: number,
  destinationY: number,
  destinationWidth: number,
  destinationHeight: number,
): void {
  if (sourceSurface === null || typeof sourceSurface !== 'object') return;
  const sourceState = rasterSurfaceStates.get(sourceSurface);
  if (sourceState === undefined) return;
  const destination = rasterIntersection(clip, { x: destinationX, y: destinationY, width: destinationWidth, height: destinationHeight });
  if (destination === undefined) return;
  const left = Math.max(0, Math.floor(destination.x));
  const top = Math.max(0, Math.floor(destination.y));
  const right = Math.min(destinationState.width, Math.ceil(destination.x + destination.width));
  const bottom = Math.min(destinationState.height, Math.ceil(destination.y + destination.height));
  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) {
      const sourceSampleX = Math.min(sourceState.width - 1, Math.max(0, Math.floor(sourceX + ((x + 0.5 - destinationX) * sourceWidth) / destinationWidth)));
      const sourceSampleY = Math.min(sourceState.height - 1, Math.max(0, Math.floor(sourceY + ((y + 0.5 - destinationY) * sourceHeight) / destinationHeight)));
      const sourceOffset = (sourceSampleY * sourceState.width + sourceSampleX) * 4;
      rasterBlend(destinationState.pixels, destinationState.width, x, y, [
        sourceState.pixels[sourceOffset]!,
        sourceState.pixels[sourceOffset + 1]!,
        sourceState.pixels[sourceOffset + 2]!,
        sourceState.pixels[sourceOffset + 3]!,
      ]);
    }
  }
}

function makeRasterFactory(traces: TraceEntry[], output: RasterOutput): X4UiCanvasSurfaceFactory {
  return (width, height, role) => {
    const state: RasterSurfaceState = { role, width, height, pixels: new Uint8ClampedArray(width * height * 4) };
    let currentClip: RasterRect | undefined;
    let pendingRect: RasterRect | undefined;
    let currentStyle: RasterRgba | undefined;
    const savedClips: (RasterRect | undefined)[] = [];
    const context = makeTraceContext(traces, role, true, false, {
      afterOperation: (_operationRole, name, args) => {
        if (name === 'save') savedClips.push(currentClip);
        else if (name === 'restore') currentClip = savedClips.pop();
        else if (name === 'setFillStyle') currentStyle = rasterStyle(args[0]);
        else if (name === 'rect') {
          const values = args.map(value => Number(value));
          if (values.length === 4 && values.every(value => Number.isFinite(value))) pendingRect = { x: values[0]!, y: values[1]!, width: values[2]!, height: values[3]! };
        } else if (name === 'clip') currentClip = rasterIntersection(currentClip, pendingRect);
        else if (name === 'fillRect') {
          const values = args.map(value => Number(value));
          if (values.length === 4 && values.every(value => Number.isFinite(value))) rasterFill(state, currentClip, { x: values[0]!, y: values[1]!, width: values[2]!, height: values[3]! }, currentStyle);
        } else if (name === 'drawImage') {
          const source = args[0];
          const values = args.slice(1).map(value => Number(value));
          if (values.length === 8 && values.every(value => Number.isFinite(value))) rasterDrawImage(state, currentClip, source, values[0]!, values[1]!, values[2]!, values[3]!, values[4]!, values[5]!, values[6]!, values[7]!);
        } else if (name === 'putImageData') {
          const imageData = args[0] as JsonRecord | undefined;
          if (imageData?.data instanceof Uint8ClampedArray && imageData.data.length === state.pixels.length) state.pixels.set(imageData.data);
        }
      },
    });
    const surface = { role, width, height, getContext: (_kind: '2d') => context } as JsonRecord & X4UiCanvasSurface;
    rasterSurfaceStates.set(surface, state);
    if (role === 'composite') {
      output.surface = surface;
      output.state = state;
    }
    return surface;
  };
}

interface ActivityLedger {
  readonly factory: TraceEntry[];
  readonly dimensions: TraceEntry[];
  readonly contexts: TraceEntry[];
  readonly paint: TraceEntry[];
}

interface ObservedFactoryHooks {
  readonly afterFactory?: (role: string) => void;
  readonly afterDimensionWrite?: (role: string, dimension: 'width' | 'height', value: number) => void;
  readonly afterDimensionRead?: (role: string, dimension: 'width' | 'height', value: number) => void;
  readonly afterGetContext?: (role: string) => void;
  readonly contextHooks?: (role: string) => TraceContextHooks;
}

function emptyActivityLedger(): ActivityLedger {
  return { factory: [], dimensions: [], contexts: [], paint: [] };
}

function makeObservedFactory(activity: ActivityLedger, hooks: ObservedFactoryHooks = {}): X4UiCanvasSurfaceFactory {
  return (requestedWidth, requestedHeight, role) => {
    activity.factory.push({ role, name: 'factory', args: [requestedWidth, requestedHeight] });
    hooks.afterFactory?.(role);
    let width = 0;
    let height = 0;
    const contextHooks = hooks.contextHooks?.(role) ?? {};
    const context = makeTraceContext(activity.paint, role, true, false, contextHooks);
    const surface = { role } as unknown as JsonRecord & X4UiCanvasSurface;
    Object.defineProperties(surface, {
      width: {
        configurable: true,
        enumerable: true,
        get: () => {
          activity.dimensions.push({ role, name: 'getWidth', args: [width] });
          hooks.afterDimensionRead?.(role, 'width', width);
          return width;
        },
        set: (value: number) => {
          width = value;
          activity.dimensions.push({ role, name: 'setWidth', args: [value] });
          hooks.afterDimensionWrite?.(role, 'width', value);
        },
      },
      height: {
        configurable: true,
        enumerable: true,
        get: () => {
          activity.dimensions.push({ role, name: 'getHeight', args: [height] });
          hooks.afterDimensionRead?.(role, 'height', height);
          return height;
        },
        set: (value: number) => {
          height = value;
          activity.dimensions.push({ role, name: 'setHeight', args: [value] });
          hooks.afterDimensionWrite?.(role, 'height', value);
        },
      },
      getContext: {
        configurable: true,
        enumerable: true,
        writable: true,
        value: (_kind: '2d') => {
          activity.contexts.push({ role, name: 'getContext', args: ['2d'] });
          hooks.afterGetContext?.(role);
          return context;
        },
      },
    });
    return surface;
  };
}

function activitySignature(activity: ActivityLedger): string {
  return JSON.stringify({
    factory: activity.factory,
    dimensions: activity.dimensions,
    contexts: activity.contexts,
    paint: activity.paint,
  });
}

function activityIsZero(activity: ActivityLedger): boolean {
  return activity.factory.length === 0 && activity.dimensions.length === 0 && activity.contexts.length === 0 && activity.paint.length === 0;
}

function traceSignature(trace: readonly TraceEntry[]): string {
  return JSON.stringify(trace.map(entry => ({ role: entry.role, name: entry.name, args: entry.args })));
}

function traceEquals(left: readonly TraceEntry[], right: readonly TraceEntry[]): boolean {
  return traceSignature(left) === traceSignature(right);
}

function traceContainsSequence(trace: readonly TraceEntry[], expected: readonly TraceEntry[]): boolean {
  if (expected.length === 0 || expected.length > trace.length) return false;
  for (let start = 0; start <= trace.length - expected.length; start += 1) {
    if (traceEquals(trace.slice(start, start + expected.length), expected)) return true;
  }
  return false;
}

function traceEntry(role: string, name: string, ...args: unknown[]): TraceEntry {
  return { role, name, args };
}

function dataRecord(value: unknown): JsonRecord | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : undefined;
}

function rectangleArguments(value: unknown): readonly number[] | undefined {
  const rectangle = dataRecord(value);
  if (rectangle === undefined) return undefined;
  const values = [rectangle.x, rectangle.y, rectangle.width, rectangle.height];
  return values.every(item => typeof item === 'number') ? values as number[] : undefined;
}

function rasterRect(value: unknown): RasterRect | undefined {
  const values = rectangleArguments(value);
  return values === undefined ? undefined : { x: values[0]!, y: values[1]!, width: values[2]!, height: values[3]! };
}

function effectiveCommandRect(command: JsonRecord, field: 'geometry' | 'destinationRect'): RasterRect | undefined {
  const base = rasterRect(command[field]);
  const clip = rasterRect(command.clipRect);
  return rasterIntersection(base, clip);
}

function rasterPixel(output: RasterOutput, x: number, y: number): RasterRgba | undefined {
  const state = output.state;
  if (state === undefined || x < 0 || y < 0 || x >= state.width || y >= state.height) return undefined;
  const offset = (Math.floor(y) * state.width + Math.floor(x)) * 4;
  return [state.pixels[offset]!, state.pixels[offset + 1]!, state.pixels[offset + 2]!, state.pixels[offset + 3]!];
}

function traceHasOpaqueFill(trace: readonly TraceEntry[], color: string, rect: RasterRect): boolean {
  let activeColor: unknown;
  return trace.some(entry => {
    if (entry.name === 'setFillStyle') {
      activeColor = entry.args[0];
      return false;
    }
    if (entry.name !== 'fillRect' || activeColor !== color || entry.args.length !== 4) return false;
    return entry.args.every((value, index) => value === [rect.x, rect.y, rect.width, rect.height][index]);
  });
}

function traceHasDiagnosticBoundary(trace: readonly TraceEntry[], color: string, region: RasterRect): boolean {
  let activeStrokeStyle: unknown;
  let pendingRect: RasterRect | undefined;
  let activeClip: RasterRect | undefined;
  const savedClips: (RasterRect | undefined)[] = [];
  for (const entry of trace) {
    if (entry.name === 'setStrokeStyle') {
      activeStrokeStyle = entry.args[0];
      continue;
    }
    if (entry.name === 'save') {
      savedClips.push(activeClip);
      continue;
    }
    if (entry.name === 'restore') {
      activeClip = savedClips.pop();
      continue;
    }
    if (entry.name === 'beginPath') {
      pendingRect = undefined;
      continue;
    }
    if (entry.name === 'rect' && entry.args.length === 4 && entry.args.every(value => typeof value === 'number')) {
      pendingRect = { x: Number(entry.args[0]), y: Number(entry.args[1]), width: Number(entry.args[2]), height: Number(entry.args[3]) };
      continue;
    }
    if (entry.name === 'clip') {
      activeClip = rasterIntersection(activeClip, pendingRect);
      continue;
    }
    if (entry.name === 'stroke'
      && activeStrokeStyle === color
      && rasterIntersection(pendingRect, activeClip) !== undefined
      && rasterIntersection(pendingRect, region) !== undefined) return true;
  }
  return false;
}

function expectedClippedTrace(clipValue: unknown, terminal: readonly TraceEntry[]): TraceEntry[] {
  const clip = rectangleArguments(clipValue);
  if (clip === undefined) return [...terminal];
  return [
    traceEntry('composite', 'save'),
    traceEntry('composite', 'beginPath'),
    traceEntry('composite', 'rect', ...clip),
    traceEntry('composite', 'clip'),
    ...terminal,
    traceEntry('composite', 'restore'),
  ];
}

function diagnosticColor(kind: unknown): string {
  switch (kind) {
    case 'selection': return X4_UI_CANVAS_DIAGNOSTIC_PALETTE.selection;
    case 'gap': return X4_UI_CANVAS_DIAGNOSTIC_PALETTE.gap;
    case 'unsupported-runtime-paint': return X4_UI_CANVAS_DIAGNOSTIC_PALETTE.unsupported;
    case 'unavailable-node': return X4_UI_CANVAS_DIAGNOSTIC_PALETTE.unavailable;
    case 'empty-clip': return X4_UI_CANVAS_DIAGNOSTIC_PALETTE.emptyClip;
    case 'invalid-raster-candidate': return X4_UI_CANVAS_DIAGNOSTIC_PALETTE.invalidRaster;
    default: return X4_UI_CANVAS_DIAGNOSTIC_PALETTE.background;
  }
}

function expectedCommandTrace(command: JsonRecord, plan: X4UiPaintPlan, corpus: X4UiCorpusCanonicalSuccess): TraceEntry[] {
  const kind = command.kind;
  if (kind === 'node-geometry') {
    const color = command.style === 'unavailable' || command.completeness !== 'complete'
      ? X4_UI_CANVAS_DIAGNOSTIC_PALETTE.unavailable
      : X4_UI_CANVAS_DIAGNOSTIC_PALETTE.geometry;
    const trace = [traceEntry('composite', 'setFillStyle', color)];
    const geometry = rectangleArguments(command.geometry);
    return geometry === undefined ? trace : [...trace, ...expectedClippedTrace(command.clipRect, [traceEntry('composite', 'fillRect', ...geometry)])];
  }
  if (kind === 'glyph-alpha-blit') {
    const source = rectangleArguments(command.sourceRect);
    const destination = rectangleArguments(command.destinationRect);
    const descriptor = dataRecord(command.descriptor);
    if (source === undefined || destination === undefined || descriptor === undefined) return [];
    const atlasRole = descriptor.relativePath === corpus.fonts.regular.descriptorIdentity.relativePath ? 'regular-atlas' : 'bold-atlas';
    return expectedClippedTrace(command.clipRect, [
      traceEntry('composite', 'setFillStyle', X4_UI_CANVAS_DIAGNOSTIC_PALETTE.glyph),
      traceEntry('composite', 'drawImage', atlasRole, ...source, ...destination),
    ]);
  }
  if (kind === 'keep-out') {
    const geometry = dataRecord(command.geometry);
    const trace = [traceEntry('composite', 'setStrokeStyle', geometry === undefined ? X4_UI_CANVAS_DIAGNOSTIC_PALETTE.unavailableKeepOut : X4_UI_CANVAS_DIAGNOSTIC_PALETTE.keepOut)];
    if (geometry === undefined) return trace;
    if (geometry.kind === 'horizontal-guide' && typeof geometry.y === 'number') {
      return [...trace, traceEntry('composite', 'beginPath'), traceEntry('composite', 'moveTo', 0, geometry.y), traceEntry('composite', 'lineTo', plan.logicalDrawable.width, geometry.y), traceEntry('composite', 'stroke')];
    }
    if (geometry.kind === 'vertical-guide' && typeof geometry.x === 'number') {
      return [...trace, traceEntry('composite', 'beginPath'), traceEntry('composite', 'moveTo', geometry.x, 0), traceEntry('composite', 'lineTo', geometry.x, plan.logicalDrawable.height), traceEntry('composite', 'stroke')];
    }
    const points = Array.isArray(geometry.points) ? geometry.points.map(dataRecord) : [];
    const first = points[0];
    if (geometry.kind !== 'polygon' || first === undefined || typeof first.x !== 'number' || typeof first.y !== 'number') return [];
    const polygonTrace = [...trace, traceEntry('composite', 'beginPath'), traceEntry('composite', 'moveTo', first.x, first.y)];
    for (const point of points.slice(1)) {
      if (point === undefined || typeof point.x !== 'number' || typeof point.y !== 'number') return [];
      polygonTrace.push(traceEntry('composite', 'lineTo', point.x, point.y));
    }
    polygonTrace.push(traceEntry('composite', 'closePath'), traceEntry('composite', 'stroke'));
    return polygonTrace;
  }
  const geometry = rectangleArguments(command.geometry) ?? rectangleArguments(command.clipRect);
  const trace = [traceEntry('composite', 'setFillStyle', diagnosticColor(kind))];
  return geometry === undefined ? trace : [...trace, ...expectedClippedTrace(command.clipRect, [traceEntry('composite', 'fillRect', ...geometry)])];
}

function expectedCompositeTrace(plan: X4UiPaintPlan, corpus: X4UiCorpusCanonicalSuccess): TraceEntry[] {
  return plan.layers.flatMap(layer => layer.commands.flatMap(command => expectedCommandTrace(command as unknown as JsonRecord, plan, corpus)));
}

const CANONICAL_COMPOSITE_TRACE: readonly TraceEntry[] = [
  // Literal golden: curated from the canonical fixture's emitted operation receipt; do not derive from renderer mapping logic.
  traceEntry('composite', "setFillStyle", "#64748b"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 0, 0, 100, 80),
  traceEntry('composite', "clip"),
  traceEntry('composite', "fillRect", 0, 0, 100, 80),
  traceEntry('composite', "restore"),
  traceEntry('composite', "setFillStyle", "#6b7280"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 0, 0, 40, 8),
  traceEntry('composite', "clip"),
  traceEntry('composite', "fillRect", 0, 0, 40, 8),
  traceEntry('composite', "restore"),
  traceEntry('composite', "setFillStyle", "#64748b"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 0, 0, 40, 8),
  traceEntry('composite', "clip"),
  traceEntry('composite', "fillRect", 0, 0, 40, 8),
  traceEntry('composite', "restore"),
  traceEntry('composite', "setFillStyle", "#64748b"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 0, 0, 40, 8),
  traceEntry('composite', "clip"),
  traceEntry('composite', "fillRect", 0, 0, 40, 8),
  traceEntry('composite', "restore"),
  traceEntry('composite', "setFillStyle", "#64748b"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 5, 0, 35, 8),
  traceEntry('composite', "clip"),
  traceEntry('composite', "fillRect", 5, 0, 35, 8),
  traceEntry('composite', "restore"),
  traceEntry('composite', "setFillStyle", "#64748b"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 5, 0, 35, 8),
  traceEntry('composite', "clip"),
  traceEntry('composite', "fillRect", 5, 1.75, 20.25, 4.5),
  traceEntry('composite', "restore"),
  traceEntry('composite', "setFillStyle", "#6b7280"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 0, 0, 86, 14),
  traceEntry('composite', "clip"),
  traceEntry('composite', "fillRect", 0, 0, 86, 14),
  traceEntry('composite', "restore"),
  traceEntry('composite', "setFillStyle", "#6b7280"),
  traceEntry('composite', "setFillStyle", "#64748b"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 0, 1, 86, 12),
  traceEntry('composite', "clip"),
  traceEntry('composite', "fillRect", 0, 1, 86, 12),
  traceEntry('composite', "restore"),
  traceEntry('composite', "setFillStyle", "#64748b"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 0, 1, 42, 12),
  traceEntry('composite', "clip"),
  traceEntry('composite', "fillRect", 0, 1, 42, 12),
  traceEntry('composite', "restore"),
  traceEntry('composite', "setFillStyle", "#64748b"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 5, 1, 37, 12),
  traceEntry('composite', "clip"),
  traceEntry('composite', "fillRect", 5, 1, 37, 12),
  traceEntry('composite', "restore"),
  traceEntry('composite', "setFillStyle", "#64748b"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 5, 1, 37, 12),
  traceEntry('composite', "clip"),
  traceEntry('composite', "fillRect", 5, 4.75, 15.75, 4.5),
  traceEntry('composite', "restore"),
  traceEntry('composite', "setFillStyle", "#64748b"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 44, 1, 20, 12),
  traceEntry('composite', "clip"),
  traceEntry('composite', "fillRect", 44, 1, 20, 12),
  traceEntry('composite', "restore"),
  traceEntry('composite', "setFillStyle", "#6b7280"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 44, 1, 20, 12),
  traceEntry('composite', "clip"),
  traceEntry('composite', "fillRect", 44, 1, 20, 12),
  traceEntry('composite', "restore"),
  traceEntry('composite', "setFillStyle", "#64748b"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 44, 1, 20, 12),
  traceEntry('composite', "clip"),
  traceEntry('composite', "fillRect", 46, 4.75, 13.5, 4.5),
  traceEntry('composite', "restore"),
  traceEntry('composite', "setFillStyle", "#64748b"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 44, 1, 20, 12),
  traceEntry('composite', "clip"),
  traceEntry('composite', "fillRect", 46, 3, 16, 8),
  traceEntry('composite', "restore"),
  traceEntry('composite', "setFillStyle", "#64748b"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 66, 1, 20, 12),
  traceEntry('composite', "clip"),
  traceEntry('composite', "fillRect", 66, 1, 20, 12),
  traceEntry('composite', "restore"),
  traceEntry('composite', "setFillStyle", "#6b7280"),
  traceEntry('composite', "setFillStyle", "#6b7280"),
  traceEntry('composite', "setFillStyle", "#6b7280"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 66, 3, 20, 8),
  traceEntry('composite', "clip"),
  traceEntry('composite', "fillRect", 66, 3, 20, 8),
  traceEntry('composite', "restore"),
  traceEntry('composite', "setFillStyle", "#64748b"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 0, 0, 100, 80),
  traceEntry('composite', "clip"),
  traceEntry('composite', "fillRect", 0, 0, 100, 80),
  traceEntry('composite', "restore"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 5, 2.59375, 2.25, 2.8125),
  traceEntry('composite', "clip"),
  traceEntry('composite', "setFillStyle", "#e5e7eb"),
  traceEntry('composite', "drawImage", "regular-atlas", 0, 0, 8, 10, 5, 2.59375, 2.25, 2.8125),
  traceEntry('composite', "restore"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 7.25, 2.59375, 2.25, 2.8125),
  traceEntry('composite', "clip"),
  traceEntry('composite', "setFillStyle", "#e5e7eb"),
  traceEntry('composite', "drawImage", "regular-atlas", 0, 0, 8, 10, 7.25, 2.59375, 2.25, 2.8125),
  traceEntry('composite', "restore"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 9.5, 2.59375, 2.25, 2.8125),
  traceEntry('composite', "clip"),
  traceEntry('composite', "setFillStyle", "#e5e7eb"),
  traceEntry('composite', "drawImage", "regular-atlas", 0, 0, 8, 10, 9.5, 2.59375, 2.25, 2.8125),
  traceEntry('composite', "restore"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 11.75, 2.59375, 2.25, 2.8125),
  traceEntry('composite', "clip"),
  traceEntry('composite', "setFillStyle", "#e5e7eb"),
  traceEntry('composite', "drawImage", "regular-atlas", 0, 0, 8, 10, 11.75, 2.59375, 2.25, 2.8125),
  traceEntry('composite', "restore"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 14, 2.59375, 2.25, 2.8125),
  traceEntry('composite', "clip"),
  traceEntry('composite', "setFillStyle", "#e5e7eb"),
  traceEntry('composite', "drawImage", "regular-atlas", 0, 0, 8, 10, 14, 2.59375, 2.25, 2.8125),
  traceEntry('composite', "restore"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 16.25, 2.59375, 2.25, 2.8125),
  traceEntry('composite', "clip"),
  traceEntry('composite', "setFillStyle", "#e5e7eb"),
  traceEntry('composite', "drawImage", "regular-atlas", 0, 0, 8, 10, 16.25, 2.59375, 2.25, 2.8125),
  traceEntry('composite', "restore"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 18.5, 2.59375, 2.25, 2.8125),
  traceEntry('composite', "clip"),
  traceEntry('composite', "setFillStyle", "#e5e7eb"),
  traceEntry('composite', "drawImage", "regular-atlas", 0, 0, 8, 10, 18.5, 2.59375, 2.25, 2.8125),
  traceEntry('composite', "restore"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 20.75, 2.59375, 2.25, 2.8125),
  traceEntry('composite', "clip"),
  traceEntry('composite', "setFillStyle", "#e5e7eb"),
  traceEntry('composite', "drawImage", "regular-atlas", 0, 0, 8, 10, 20.75, 2.59375, 2.25, 2.8125),
  traceEntry('composite', "restore"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 23, 2.59375, 2.25, 2.8125),
  traceEntry('composite', "clip"),
  traceEntry('composite', "setFillStyle", "#e5e7eb"),
  traceEntry('composite', "drawImage", "regular-atlas", 0, 0, 8, 10, 23, 2.59375, 2.25, 2.8125),
  traceEntry('composite', "restore"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 5, 5.59375, 2.25, 2.8125),
  traceEntry('composite', "clip"),
  traceEntry('composite', "setFillStyle", "#e5e7eb"),
  traceEntry('composite', "drawImage", "regular-atlas", 0, 0, 8, 10, 5, 5.59375, 2.25, 2.8125),
  traceEntry('composite', "restore"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 7.25, 5.59375, 2.25, 2.8125),
  traceEntry('composite', "clip"),
  traceEntry('composite', "setFillStyle", "#e5e7eb"),
  traceEntry('composite', "drawImage", "regular-atlas", 0, 0, 8, 10, 7.25, 5.59375, 2.25, 2.8125),
  traceEntry('composite', "restore"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 9.5, 5.59375, 2.25, 2.8125),
  traceEntry('composite', "clip"),
  traceEntry('composite', "setFillStyle", "#e5e7eb"),
  traceEntry('composite', "drawImage", "regular-atlas", 0, 0, 8, 10, 9.5, 5.59375, 2.25, 2.8125),
  traceEntry('composite', "restore"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 11.75, 5.59375, 2.25, 2.8125),
  traceEntry('composite', "clip"),
  traceEntry('composite', "setFillStyle", "#e5e7eb"),
  traceEntry('composite', "drawImage", "regular-atlas", 0, 0, 8, 10, 11.75, 5.59375, 2.25, 2.8125),
  traceEntry('composite', "restore"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 14, 5.59375, 2.25, 2.8125),
  traceEntry('composite', "clip"),
  traceEntry('composite', "setFillStyle", "#e5e7eb"),
  traceEntry('composite', "drawImage", "regular-atlas", 0, 0, 8, 10, 14, 5.59375, 2.25, 2.8125),
  traceEntry('composite', "restore"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 16.25, 5.59375, 2.25, 2.8125),
  traceEntry('composite', "clip"),
  traceEntry('composite', "setFillStyle", "#e5e7eb"),
  traceEntry('composite', "drawImage", "regular-atlas", 0, 0, 8, 10, 16.25, 5.59375, 2.25, 2.8125),
  traceEntry('composite', "restore"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 18.5, 5.59375, 2.25, 2.8125),
  traceEntry('composite', "clip"),
  traceEntry('composite', "setFillStyle", "#e5e7eb"),
  traceEntry('composite', "drawImage", "regular-atlas", 0, 0, 8, 10, 18.5, 5.59375, 2.25, 2.8125),
  traceEntry('composite', "restore"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 46, 5.59375, 2.25, 2.8125),
  traceEntry('composite', "clip"),
  traceEntry('composite', "setFillStyle", "#e5e7eb"),
  traceEntry('composite', "drawImage", "regular-atlas", 0, 0, 8, 10, 46, 5.59375, 2.25, 2.8125),
  traceEntry('composite', "restore"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 48.25, 5.59375, 2.25, 2.8125),
  traceEntry('composite', "clip"),
  traceEntry('composite', "setFillStyle", "#e5e7eb"),
  traceEntry('composite', "drawImage", "regular-atlas", 0, 0, 8, 10, 48.25, 5.59375, 2.25, 2.8125),
  traceEntry('composite', "restore"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 50.5, 5.59375, 2.25, 2.8125),
  traceEntry('composite', "clip"),
  traceEntry('composite', "setFillStyle", "#e5e7eb"),
  traceEntry('composite', "drawImage", "regular-atlas", 0, 0, 8, 10, 50.5, 5.59375, 2.25, 2.8125),
  traceEntry('composite', "restore"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 52.75, 5.59375, 2.25, 2.8125),
  traceEntry('composite', "clip"),
  traceEntry('composite', "setFillStyle", "#e5e7eb"),
  traceEntry('composite', "drawImage", "regular-atlas", 0, 0, 8, 10, 52.75, 5.59375, 2.25, 2.8125),
  traceEntry('composite', "restore"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 55, 5.59375, 2.25, 2.8125),
  traceEntry('composite', "clip"),
  traceEntry('composite', "setFillStyle", "#e5e7eb"),
  traceEntry('composite', "drawImage", "regular-atlas", 0, 0, 8, 10, 55, 5.59375, 2.25, 2.8125),
  traceEntry('composite', "restore"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 57.25, 5.59375, 2.25, 2.8125),
  traceEntry('composite', "clip"),
  traceEntry('composite', "setFillStyle", "#e5e7eb"),
  traceEntry('composite', "drawImage", "regular-atlas", 0, 0, 8, 10, 57.25, 5.59375, 2.25, 2.8125),
  traceEntry('composite', "restore"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 46, 4.5, 4, 5),
  traceEntry('composite', "clip"),
  traceEntry('composite', "setFillStyle", "#e5e7eb"),
  traceEntry('composite', "drawImage", "bold-atlas", 0, 0, 8, 10, 46, 4.5, 4, 5),
  traceEntry('composite', "restore"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 50, 4.5, 4, 5),
  traceEntry('composite', "clip"),
  traceEntry('composite', "setFillStyle", "#e5e7eb"),
  traceEntry('composite', "drawImage", "bold-atlas", 0, 0, 8, 10, 50, 4.5, 4, 5),
  traceEntry('composite', "restore"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 54, 4.5, 4, 5),
  traceEntry('composite', "clip"),
  traceEntry('composite', "setFillStyle", "#e5e7eb"),
  traceEntry('composite', "drawImage", "bold-atlas", 0, 0, 8, 10, 54, 4.5, 4, 5),
  traceEntry('composite', "restore"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 58, 4.5, 4, 5),
  traceEntry('composite', "clip"),
  traceEntry('composite', "setFillStyle", "#e5e7eb"),
  traceEntry('composite', "drawImage", "bold-atlas", 0, 0, 8, 10, 58, 4.5, 4, 5),
  traceEntry('composite', "restore"),
  traceEntry('composite', "setFillStyle", "#6b7280"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 0, 0, 40, 8),
  traceEntry('composite', "clip"),
  traceEntry('composite', "fillRect", 0, 0, 40, 8),
  traceEntry('composite', "restore"),
  traceEntry('composite', "setFillStyle", "#6b7280"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 0, 0, 86, 14),
  traceEntry('composite', "clip"),
  traceEntry('composite', "fillRect", 0, 0, 86, 14),
  traceEntry('composite', "restore"),
  traceEntry('composite', "setFillStyle", "#6b7280"),
  traceEntry('composite', "setFillStyle", "#6b7280"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 44, 1, 20, 12),
  traceEntry('composite', "clip"),
  traceEntry('composite', "fillRect", 44, 1, 20, 12),
  traceEntry('composite', "restore"),
  traceEntry('composite', "setFillStyle", "#a855f7"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 44, 1, 20, 12),
  traceEntry('composite', "clip"),
  traceEntry('composite', "fillRect", 44, 1, 20, 12),
  traceEntry('composite', "restore"),
  traceEntry('composite', "setFillStyle", "#6b7280"),
  traceEntry('composite', "setFillStyle", "#6b7280"),
  traceEntry('composite', "setFillStyle", "#6b7280"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 66, 3, 20, 8),
  traceEntry('composite', "clip"),
  traceEntry('composite', "fillRect", 66, 3, 20, 8),
  traceEntry('composite', "restore"),
  traceEntry('composite', "setFillStyle", "#a855f7"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 66, 3, 20, 8),
  traceEntry('composite', "clip"),
  traceEntry('composite', "fillRect", 66, 3, 20, 8),
  traceEntry('composite', "restore"),
  traceEntry('composite', "setFillStyle", "#ef4444"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 0, 0, 86, 14),
  traceEntry('composite', "clip"),
  traceEntry('composite', "fillRect", 0, 0, 86, 14),
  traceEntry('composite', "restore"),
  traceEntry('composite', "setFillStyle", "#ef4444"),
  traceEntry('composite', "setFillStyle", "#ef4444"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 44, 1, 20, 12),
  traceEntry('composite', "clip"),
  traceEntry('composite', "fillRect", 44, 1, 20, 12),
  traceEntry('composite', "restore"),
  traceEntry('composite', "setFillStyle", "#ef4444"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 66, 3, 20, 8),
  traceEntry('composite', "clip"),
  traceEntry('composite', "fillRect", 66, 3, 20, 8),
  traceEntry('composite', "restore"),
  traceEntry('composite', "setFillStyle", "#ef4444"),
  traceEntry('composite', "setFillStyle", "#ef4444"),
  traceEntry('composite', "setFillStyle", "#ef4444"),
  traceEntry('composite', "setFillStyle", "#ef4444"),
  traceEntry('composite', "setFillStyle", "#ef4444"),
  traceEntry('composite', "setFillStyle", "#ef4444"),
  traceEntry('composite', "setFillStyle", "#ef4444"),
  traceEntry('composite', "setFillStyle", "#ef4444"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 0, 0, 40, 8),
  traceEntry('composite', "clip"),
  traceEntry('composite', "fillRect", 0, 0, 40, 8),
  traceEntry('composite', "restore"),
  traceEntry('composite', "setFillStyle", "#ef4444"),
  traceEntry('composite', "setFillStyle", "#f59e0b"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 5, 1, 37, 12),
  traceEntry('composite', "clip"),
  traceEntry('composite', "fillRect", 5, 1, 37, 12),
  traceEntry('composite', "restore"),
  traceEntry('composite', "setStrokeStyle", "#22d3ee"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "moveTo", 0, 63.040000000000006),
  traceEntry('composite', "lineTo", 100, 63.040000000000006),
  traceEntry('composite', "stroke"),
  traceEntry('composite', "setStrokeStyle", "#22d3ee"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "moveTo", 0, 59.2),
  traceEntry('composite', "lineTo", 100, 59.2),
  traceEntry('composite', "stroke"),
  traceEntry('composite', "setStrokeStyle", "#22d3ee"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "moveTo", 66.4, 0),
  traceEntry('composite', "lineTo", 66.4, 80),
  traceEntry('composite', "stroke"),
  traceEntry('composite', "setStrokeStyle", "#fb7185"),
  traceEntry('composite', "setStrokeStyle", "#fb7185"),
];
const CANONICAL_POLYGON_COMPOSITE_TRACE: readonly TraceEntry[] = [
  // Literal golden: curated from the canonical fixture's emitted operation receipt; do not derive from renderer mapping logic.
  traceEntry('composite', "setFillStyle", "#64748b"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 0, 0, 100, 80),
  traceEntry('composite', "clip"),
  traceEntry('composite', "fillRect", 0, 0, 100, 80),
  traceEntry('composite', "restore"),
  traceEntry('composite', "setFillStyle", "#6b7280"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 0, 0, 40, 8),
  traceEntry('composite', "clip"),
  traceEntry('composite', "fillRect", 0, 0, 40, 8),
  traceEntry('composite', "restore"),
  traceEntry('composite', "setFillStyle", "#64748b"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 0, 0, 40, 8),
  traceEntry('composite', "clip"),
  traceEntry('composite', "fillRect", 0, 0, 40, 8),
  traceEntry('composite', "restore"),
  traceEntry('composite', "setFillStyle", "#64748b"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 0, 0, 40, 8),
  traceEntry('composite', "clip"),
  traceEntry('composite', "fillRect", 0, 0, 40, 8),
  traceEntry('composite', "restore"),
  traceEntry('composite', "setFillStyle", "#64748b"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 5, 0, 35, 8),
  traceEntry('composite', "clip"),
  traceEntry('composite', "fillRect", 5, 0, 35, 8),
  traceEntry('composite', "restore"),
  traceEntry('composite', "setFillStyle", "#64748b"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 5, 0, 35, 8),
  traceEntry('composite', "clip"),
  traceEntry('composite', "fillRect", 5, 1.75, 20.25, 4.5),
  traceEntry('composite', "restore"),
  traceEntry('composite', "setFillStyle", "#6b7280"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 0, 0, 86, 14),
  traceEntry('composite', "clip"),
  traceEntry('composite', "fillRect", 0, 0, 86, 14),
  traceEntry('composite', "restore"),
  traceEntry('composite', "setFillStyle", "#6b7280"),
  traceEntry('composite', "setFillStyle", "#64748b"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 0, 1, 86, 12),
  traceEntry('composite', "clip"),
  traceEntry('composite', "fillRect", 0, 1, 86, 12),
  traceEntry('composite', "restore"),
  traceEntry('composite', "setFillStyle", "#64748b"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 0, 1, 42, 12),
  traceEntry('composite', "clip"),
  traceEntry('composite', "fillRect", 0, 1, 42, 12),
  traceEntry('composite', "restore"),
  traceEntry('composite', "setFillStyle", "#64748b"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 5, 1, 37, 12),
  traceEntry('composite', "clip"),
  traceEntry('composite', "fillRect", 5, 1, 37, 12),
  traceEntry('composite', "restore"),
  traceEntry('composite', "setFillStyle", "#64748b"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 5, 1, 37, 12),
  traceEntry('composite', "clip"),
  traceEntry('composite', "fillRect", 5, 4.75, 15.75, 4.5),
  traceEntry('composite', "restore"),
  traceEntry('composite', "setFillStyle", "#64748b"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 44, 1, 20, 12),
  traceEntry('composite', "clip"),
  traceEntry('composite', "fillRect", 44, 1, 20, 12),
  traceEntry('composite', "restore"),
  traceEntry('composite', "setFillStyle", "#6b7280"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 44, 1, 20, 12),
  traceEntry('composite', "clip"),
  traceEntry('composite', "fillRect", 44, 1, 20, 12),
  traceEntry('composite', "restore"),
  traceEntry('composite', "setFillStyle", "#64748b"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 44, 1, 20, 12),
  traceEntry('composite', "clip"),
  traceEntry('composite', "fillRect", 46, 4.75, 13.5, 4.5),
  traceEntry('composite', "restore"),
  traceEntry('composite', "setFillStyle", "#64748b"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 44, 1, 20, 12),
  traceEntry('composite', "clip"),
  traceEntry('composite', "fillRect", 46, 3, 16, 8),
  traceEntry('composite', "restore"),
  traceEntry('composite', "setFillStyle", "#64748b"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 66, 1, 20, 12),
  traceEntry('composite', "clip"),
  traceEntry('composite', "fillRect", 66, 1, 20, 12),
  traceEntry('composite', "restore"),
  traceEntry('composite', "setFillStyle", "#6b7280"),
  traceEntry('composite', "setFillStyle", "#6b7280"),
  traceEntry('composite', "setFillStyle", "#6b7280"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 66, 3, 20, 8),
  traceEntry('composite', "clip"),
  traceEntry('composite', "fillRect", 66, 3, 20, 8),
  traceEntry('composite', "restore"),
  traceEntry('composite', "setFillStyle", "#64748b"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 0, 0, 100, 80),
  traceEntry('composite', "clip"),
  traceEntry('composite', "fillRect", 0, 0, 100, 80),
  traceEntry('composite', "restore"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 5, 2.59375, 2.25, 2.8125),
  traceEntry('composite', "clip"),
  traceEntry('composite', "setFillStyle", "#e5e7eb"),
  traceEntry('composite', "drawImage", "regular-atlas", 0, 0, 8, 10, 5, 2.59375, 2.25, 2.8125),
  traceEntry('composite', "restore"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 7.25, 2.59375, 2.25, 2.8125),
  traceEntry('composite', "clip"),
  traceEntry('composite', "setFillStyle", "#e5e7eb"),
  traceEntry('composite', "drawImage", "regular-atlas", 0, 0, 8, 10, 7.25, 2.59375, 2.25, 2.8125),
  traceEntry('composite', "restore"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 9.5, 2.59375, 2.25, 2.8125),
  traceEntry('composite', "clip"),
  traceEntry('composite', "setFillStyle", "#e5e7eb"),
  traceEntry('composite', "drawImage", "regular-atlas", 0, 0, 8, 10, 9.5, 2.59375, 2.25, 2.8125),
  traceEntry('composite', "restore"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 11.75, 2.59375, 2.25, 2.8125),
  traceEntry('composite', "clip"),
  traceEntry('composite', "setFillStyle", "#e5e7eb"),
  traceEntry('composite', "drawImage", "regular-atlas", 0, 0, 8, 10, 11.75, 2.59375, 2.25, 2.8125),
  traceEntry('composite', "restore"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 14, 2.59375, 2.25, 2.8125),
  traceEntry('composite', "clip"),
  traceEntry('composite', "setFillStyle", "#e5e7eb"),
  traceEntry('composite', "drawImage", "regular-atlas", 0, 0, 8, 10, 14, 2.59375, 2.25, 2.8125),
  traceEntry('composite', "restore"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 16.25, 2.59375, 2.25, 2.8125),
  traceEntry('composite', "clip"),
  traceEntry('composite', "setFillStyle", "#e5e7eb"),
  traceEntry('composite', "drawImage", "regular-atlas", 0, 0, 8, 10, 16.25, 2.59375, 2.25, 2.8125),
  traceEntry('composite', "restore"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 18.5, 2.59375, 2.25, 2.8125),
  traceEntry('composite', "clip"),
  traceEntry('composite', "setFillStyle", "#e5e7eb"),
  traceEntry('composite', "drawImage", "regular-atlas", 0, 0, 8, 10, 18.5, 2.59375, 2.25, 2.8125),
  traceEntry('composite', "restore"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 20.75, 2.59375, 2.25, 2.8125),
  traceEntry('composite', "clip"),
  traceEntry('composite', "setFillStyle", "#e5e7eb"),
  traceEntry('composite', "drawImage", "regular-atlas", 0, 0, 8, 10, 20.75, 2.59375, 2.25, 2.8125),
  traceEntry('composite', "restore"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 23, 2.59375, 2.25, 2.8125),
  traceEntry('composite', "clip"),
  traceEntry('composite', "setFillStyle", "#e5e7eb"),
  traceEntry('composite', "drawImage", "regular-atlas", 0, 0, 8, 10, 23, 2.59375, 2.25, 2.8125),
  traceEntry('composite', "restore"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 5, 5.59375, 2.25, 2.8125),
  traceEntry('composite', "clip"),
  traceEntry('composite', "setFillStyle", "#e5e7eb"),
  traceEntry('composite', "drawImage", "regular-atlas", 0, 0, 8, 10, 5, 5.59375, 2.25, 2.8125),
  traceEntry('composite', "restore"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 7.25, 5.59375, 2.25, 2.8125),
  traceEntry('composite', "clip"),
  traceEntry('composite', "setFillStyle", "#e5e7eb"),
  traceEntry('composite', "drawImage", "regular-atlas", 0, 0, 8, 10, 7.25, 5.59375, 2.25, 2.8125),
  traceEntry('composite', "restore"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 9.5, 5.59375, 2.25, 2.8125),
  traceEntry('composite', "clip"),
  traceEntry('composite', "setFillStyle", "#e5e7eb"),
  traceEntry('composite', "drawImage", "regular-atlas", 0, 0, 8, 10, 9.5, 5.59375, 2.25, 2.8125),
  traceEntry('composite', "restore"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 11.75, 5.59375, 2.25, 2.8125),
  traceEntry('composite', "clip"),
  traceEntry('composite', "setFillStyle", "#e5e7eb"),
  traceEntry('composite', "drawImage", "regular-atlas", 0, 0, 8, 10, 11.75, 5.59375, 2.25, 2.8125),
  traceEntry('composite', "restore"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 14, 5.59375, 2.25, 2.8125),
  traceEntry('composite', "clip"),
  traceEntry('composite', "setFillStyle", "#e5e7eb"),
  traceEntry('composite', "drawImage", "regular-atlas", 0, 0, 8, 10, 14, 5.59375, 2.25, 2.8125),
  traceEntry('composite', "restore"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 16.25, 5.59375, 2.25, 2.8125),
  traceEntry('composite', "clip"),
  traceEntry('composite', "setFillStyle", "#e5e7eb"),
  traceEntry('composite', "drawImage", "regular-atlas", 0, 0, 8, 10, 16.25, 5.59375, 2.25, 2.8125),
  traceEntry('composite', "restore"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 18.5, 5.59375, 2.25, 2.8125),
  traceEntry('composite', "clip"),
  traceEntry('composite', "setFillStyle", "#e5e7eb"),
  traceEntry('composite', "drawImage", "regular-atlas", 0, 0, 8, 10, 18.5, 5.59375, 2.25, 2.8125),
  traceEntry('composite', "restore"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 46, 5.59375, 2.25, 2.8125),
  traceEntry('composite', "clip"),
  traceEntry('composite', "setFillStyle", "#e5e7eb"),
  traceEntry('composite', "drawImage", "regular-atlas", 0, 0, 8, 10, 46, 5.59375, 2.25, 2.8125),
  traceEntry('composite', "restore"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 48.25, 5.59375, 2.25, 2.8125),
  traceEntry('composite', "clip"),
  traceEntry('composite', "setFillStyle", "#e5e7eb"),
  traceEntry('composite', "drawImage", "regular-atlas", 0, 0, 8, 10, 48.25, 5.59375, 2.25, 2.8125),
  traceEntry('composite', "restore"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 50.5, 5.59375, 2.25, 2.8125),
  traceEntry('composite', "clip"),
  traceEntry('composite', "setFillStyle", "#e5e7eb"),
  traceEntry('composite', "drawImage", "regular-atlas", 0, 0, 8, 10, 50.5, 5.59375, 2.25, 2.8125),
  traceEntry('composite', "restore"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 52.75, 5.59375, 2.25, 2.8125),
  traceEntry('composite', "clip"),
  traceEntry('composite', "setFillStyle", "#e5e7eb"),
  traceEntry('composite', "drawImage", "regular-atlas", 0, 0, 8, 10, 52.75, 5.59375, 2.25, 2.8125),
  traceEntry('composite', "restore"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 55, 5.59375, 2.25, 2.8125),
  traceEntry('composite', "clip"),
  traceEntry('composite', "setFillStyle", "#e5e7eb"),
  traceEntry('composite', "drawImage", "regular-atlas", 0, 0, 8, 10, 55, 5.59375, 2.25, 2.8125),
  traceEntry('composite', "restore"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 57.25, 5.59375, 2.25, 2.8125),
  traceEntry('composite', "clip"),
  traceEntry('composite', "setFillStyle", "#e5e7eb"),
  traceEntry('composite', "drawImage", "regular-atlas", 0, 0, 8, 10, 57.25, 5.59375, 2.25, 2.8125),
  traceEntry('composite', "restore"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 46, 4.5, 4, 5),
  traceEntry('composite', "clip"),
  traceEntry('composite', "setFillStyle", "#e5e7eb"),
  traceEntry('composite', "drawImage", "bold-atlas", 0, 0, 8, 10, 46, 4.5, 4, 5),
  traceEntry('composite', "restore"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 50, 4.5, 4, 5),
  traceEntry('composite', "clip"),
  traceEntry('composite', "setFillStyle", "#e5e7eb"),
  traceEntry('composite', "drawImage", "bold-atlas", 0, 0, 8, 10, 50, 4.5, 4, 5),
  traceEntry('composite', "restore"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 54, 4.5, 4, 5),
  traceEntry('composite', "clip"),
  traceEntry('composite', "setFillStyle", "#e5e7eb"),
  traceEntry('composite', "drawImage", "bold-atlas", 0, 0, 8, 10, 54, 4.5, 4, 5),
  traceEntry('composite', "restore"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 58, 4.5, 4, 5),
  traceEntry('composite', "clip"),
  traceEntry('composite', "setFillStyle", "#e5e7eb"),
  traceEntry('composite', "drawImage", "bold-atlas", 0, 0, 8, 10, 58, 4.5, 4, 5),
  traceEntry('composite', "restore"),
  traceEntry('composite', "setFillStyle", "#6b7280"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 0, 0, 40, 8),
  traceEntry('composite', "clip"),
  traceEntry('composite', "fillRect", 0, 0, 40, 8),
  traceEntry('composite', "restore"),
  traceEntry('composite', "setFillStyle", "#6b7280"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 0, 0, 86, 14),
  traceEntry('composite', "clip"),
  traceEntry('composite', "fillRect", 0, 0, 86, 14),
  traceEntry('composite', "restore"),
  traceEntry('composite', "setFillStyle", "#6b7280"),
  traceEntry('composite', "setFillStyle", "#6b7280"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 44, 1, 20, 12),
  traceEntry('composite', "clip"),
  traceEntry('composite', "fillRect", 44, 1, 20, 12),
  traceEntry('composite', "restore"),
  traceEntry('composite', "setFillStyle", "#a855f7"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 44, 1, 20, 12),
  traceEntry('composite', "clip"),
  traceEntry('composite', "fillRect", 44, 1, 20, 12),
  traceEntry('composite', "restore"),
  traceEntry('composite', "setFillStyle", "#6b7280"),
  traceEntry('composite', "setFillStyle", "#6b7280"),
  traceEntry('composite', "setFillStyle", "#6b7280"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 66, 3, 20, 8),
  traceEntry('composite', "clip"),
  traceEntry('composite', "fillRect", 66, 3, 20, 8),
  traceEntry('composite', "restore"),
  traceEntry('composite', "setFillStyle", "#a855f7"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 66, 3, 20, 8),
  traceEntry('composite', "clip"),
  traceEntry('composite', "fillRect", 66, 3, 20, 8),
  traceEntry('composite', "restore"),
  traceEntry('composite', "setFillStyle", "#ef4444"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 0, 0, 86, 14),
  traceEntry('composite', "clip"),
  traceEntry('composite', "fillRect", 0, 0, 86, 14),
  traceEntry('composite', "restore"),
  traceEntry('composite', "setFillStyle", "#ef4444"),
  traceEntry('composite', "setFillStyle", "#ef4444"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 44, 1, 20, 12),
  traceEntry('composite', "clip"),
  traceEntry('composite', "fillRect", 44, 1, 20, 12),
  traceEntry('composite', "restore"),
  traceEntry('composite', "setFillStyle", "#ef4444"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 66, 3, 20, 8),
  traceEntry('composite', "clip"),
  traceEntry('composite', "fillRect", 66, 3, 20, 8),
  traceEntry('composite', "restore"),
  traceEntry('composite', "setFillStyle", "#ef4444"),
  traceEntry('composite', "setFillStyle", "#ef4444"),
  traceEntry('composite', "setFillStyle", "#ef4444"),
  traceEntry('composite', "setFillStyle", "#ef4444"),
  traceEntry('composite', "setFillStyle", "#ef4444"),
  traceEntry('composite', "setFillStyle", "#ef4444"),
  traceEntry('composite', "setFillStyle", "#ef4444"),
  traceEntry('composite', "setFillStyle", "#ef4444"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 0, 0, 40, 8),
  traceEntry('composite', "clip"),
  traceEntry('composite', "fillRect", 0, 0, 40, 8),
  traceEntry('composite', "restore"),
  traceEntry('composite', "setFillStyle", "#ef4444"),
  traceEntry('composite', "setStrokeStyle", "#22d3ee"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "moveTo", 0, 63.040000000000006),
  traceEntry('composite', "lineTo", 100, 63.040000000000006),
  traceEntry('composite', "stroke"),
  traceEntry('composite', "setStrokeStyle", "#22d3ee"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "moveTo", 10, 10),
  traceEntry('composite', "lineTo", 20, 10),
  traceEntry('composite', "lineTo", 15, 20),
  traceEntry('composite', "closePath"),
  traceEntry('composite', "stroke"),
  traceEntry('composite', "setStrokeStyle", "#22d3ee"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "moveTo", 66.4, 0),
  traceEntry('composite', "lineTo", 66.4, 80),
  traceEntry('composite', "stroke"),
  traceEntry('composite', "setStrokeStyle", "#fb7185"),
  traceEntry('composite', "setStrokeStyle", "#fb7185"),
];

function successfulBoundaryIsComplete(result: X4UiCanvasRenderResult): boolean {
  if (result.status !== 'rendered') return false;
  const receipt = result.receipt;
  return Object.isFrozen(result)
    && Object.isFrozen(receipt)
    && Object.isFrozen(receipt.verification)
    && Object.isFrozen(receipt.layers)
    && Object.isFrozen(receipt.commandIds)
    && Object.isFrozen(receipt.atlasRoles)
    && Object.isFrozen(receipt.palette)
    && receipt.gameTruth === 'Not verified in game'
    && receipt.gameVerified === false
    && receipt.verification.game === 'Not verified in game'
    && receipt.verification.gameVerified === false
    && !Object.isFrozen(result.surface);
}

function refusalBoundaryIsComplete(result: X4UiCanvasRenderResult): boolean {
  if (result.status !== 'refused') return false;
  return Object.isFrozen(result)
    && Object.isFrozen(result.receipt)
    && Object.isFrozen(result.receipt.refusal)
    && Object.isFrozen(result.receipt.verification)
    && result.receipt.gameTruth === 'Not verified in game'
    && result.receipt.gameVerified === false
    && result.receipt.verification.game === 'Not verified in game'
    && result.receipt.verification.gameVerified === false
    && !Object.prototype.hasOwnProperty.call(result, 'surface');
}

type RenderAttempt =
  | { readonly threw: false; readonly result: X4UiCanvasRenderResult }
  | { readonly threw: true; readonly error: unknown };

function attemptRender(result: X4UiPaintPlanResult, corpus: X4UiCorpusCanonicalSuccess, factory: X4UiCanvasSurfaceFactory): RenderAttempt {
  try {
    return { threw: false, result: renderX4UiPaintPlanToCanvas(result, corpus, { surfaceFactory: factory }) };
  } catch (error) {
    return { threw: true, error };
  }
}

function attemptRenderWithOptions(result: X4UiPaintPlanResult, corpus: X4UiCorpusCanonicalSuccess, options: X4UiCanvasRenderOptions): RenderAttempt {
  try {
    return { threw: false, result: renderX4UiPaintPlanToCanvas(result, corpus, options) };
  } catch (error) {
    return { threw: true, error };
  }
}

function completedResult(attempt: RenderAttempt | undefined): X4UiCanvasRenderResult | undefined {
  return attempt !== undefined && 'result' in attempt ? attempt.result : undefined;
}

function firstTraceDifference(left: readonly TraceEntry[], right: readonly TraceEntry[]): { readonly index: number; readonly left?: TraceEntry; readonly right?: TraceEntry } | undefined {
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    if (JSON.stringify(left[index]) !== JSON.stringify(right[index])) return { index, ...(left[index] === undefined ? {} : { left: left[index] }), ...(right[index] === undefined ? {} : { right: right[index] }) };
  }
  return undefined;
}

function receiptSummary(receipt: X4UiCanvasRenderReceipt | undefined): unknown {
  if (receipt === undefined) return undefined;
  return receipt.status === 'refused'
    ? { status: receipt.status, refusal: receipt.refusal }
    : { status: receipt.status, width: receipt.width, height: receipt.height, commandCount: receipt.commandCount };
}

function layerOrdersAreStrictlyIncreasing(plan: X4UiPaintPlan): boolean {
  return plan.layers.every(layer => layer.commands.every((command, index) => index === 0 || command.order > (layer.commands[index - 1]?.order ?? Number.MAX_SAFE_INTEGER)));
}

function issuedOrders(plan: X4UiPaintPlan): number[] {
  return commandList(plan).map(command => Number(command.order));
}

function commandList(plan: X4UiPaintPlan): readonly JsonRecord[] {
  return plan.layers.flatMap(layer => layer.commands).map(command => command as unknown as JsonRecord);
}

type MutableLayer = JsonRecord & { readonly kind: string; readonly commands: JsonRecord[] };

function forgedResult(
  result: Extract<X4UiPaintPlanResult, { readonly status: 'projected' | 'partial' }>,
  mutate: (plan: X4UiPaintPlan, layers: MutableLayer[]) => void,
): Extract<X4UiPaintPlanResult, { readonly status: 'projected' | 'partial' }> {
  const layers = result.plan.layers.map(layer => ({ ...layer, commands: layer.commands.map(command => JSON.parse(JSON.stringify(command)) as JsonRecord) })) as unknown as MutableLayer[];
  const plan = { ...result.plan, logicalDrawable: { ...result.plan.logicalDrawable }, layers } as unknown as X4UiPaintPlan;
  mutate(plan, layers);
  const mutated = {
    ...plan,
    layers: layers as unknown as X4UiPaintPlan['layers'],
    diagnostics: layers[2]?.commands as unknown as X4UiPaintPlan['diagnostics'],
    keepOuts: layers[3]?.commands as unknown as X4UiPaintPlan['keepOuts'],
  } as X4UiPaintPlan;
  return { status: result.status, plan: mutated, verification: result.verification };
}

function renderCase(
  label: string,
  result: X4UiPaintPlanResult,
  corpus: X4UiCorpusCanonicalSuccess,
  expectedCode: string,
  factory?: X4UiCanvasSurfaceFactory,
): void {
  const activity = factory === undefined ? emptyActivityLedger() : undefined;
  const attempt = attemptRender(result, corpus, factory ?? makeObservedFactory(activity as ActivityLedger));
  const resultValue = completedResult(attempt);
  const refusalMatches = resultValue?.status === 'refused'
    && resultValue.receipt.refusal.code === expectedCode
    && refusalBoundaryIsComplete(resultValue);
  check(
    label,
    refusalMatches && (activity === undefined || activityIsZero(activity)),
    {
      threw: attempt.threw,
      result: resultValue === undefined ? undefined : {
        status: resultValue.status,
        receipt: receiptSummary(resultValue.receipt),
        completeRefusalBoundary: refusalBoundaryIsComplete(resultValue),
        hasSurface: Object.prototype.hasOwnProperty.call(resultValue, 'surface'),
      },
      preAllocationActivity: activity === undefined ? 'allocation-path-case' : {
        zero: activityIsZero(activity),
        factory: activity.factory.length,
        dimensions: activity.dimensions.length,
        contexts: activity.contexts.length,
        paint: activity.paint.length,
      },
    },
  );
}

function preAllocationFamilyCase(
  label: string,
  result: X4UiPaintPlanResult,
  corpus: X4UiCorpusCanonicalSuccess,
  expectedCode: string,
  fixtureChanged: boolean | (() => boolean),
  detail?: unknown,
): void {
  const activity = emptyActivityLedger();
  const attempt = attemptRender(result, corpus, makeObservedFactory(activity));
  const resultValue = completedResult(attempt);
  const changed = typeof fixtureChanged === 'function' ? fixtureChanged() : fixtureChanged;
  const refused = resultValue?.status === 'refused'
    && resultValue.receipt.refusal.code === expectedCode
    && refusalBoundaryIsComplete(resultValue);
  familyCheck(
    'pre-allocation',
    label,
    changed && refused && activityIsZero(activity),
    {
      fixtureChanged: changed,
      threw: attempt.threw,
      receipt: receiptSummary(resultValue?.receipt),
      activity: {
        factory: activity.factory.length,
        dimensions: activity.dimensions.length,
        contexts: activity.contexts.length,
        paint: activity.paint.length,
      },
      detail,
    },
  );
}

async function main(): Promise<void> {
  let fixture: ReturnType<typeof acceptedPlan>;
  try {
    fixture = acceptedPlan(await loadCanonicalFixture());
    check('real loader-issued canonical and accepted paint fixtures are ready', isX4UiCorpusCanonicalSuccess(fixture.corpus) && fixture.paint.plan.logicalDrawable.width === 100 && fixture.paint.plan.logicalDrawable.height === 80, {
      previewStatus: fixture.preview.status,
      paintStatus: fixture.paint.status,
      layers: fixture.paint.plan.layers.map(layer => ({ kind: layer.kind, count: layer.commands.length })),
    });
  } catch (error) {
    check('real loader-issued canonical and accepted paint fixtures are ready', false, error instanceof Error ? error.message : String(error));
    fixture = undefined as never;
  }
  if (fixture === undefined) throw new Error('fixture setup failed');

  const { corpus, paint } = fixture;
  try {
    const colorEvidence = await loadCanonicalColorFixture();
    const colorSource = colorSourceFixture();
    const colorSourceFile = colorSource.bundle?.sourceFiles.find(file => file.path === 'ui/color.lua');
    if (colorSourceFile === undefined) throw new Error('color source fixture did not produce ui/color.lua');
    const colorCatalog = createX4UiLayoutTargetCatalog(colorSourceFile.callModel);
    const colorTarget = colorCatalog.targets.find(candidate => candidate.kind === 'top-level');
    if (colorTarget === undefined) throw new Error('color source fixture has no top-level layout target');
    const colorSelection = {
      sourceIndex: colorSourceFile.index,
      path: colorSourceFile.path,
      sourceIdentity: colorCatalog.sourceIdentity,
      target: { ...colorTarget, id: colorTarget.id },
    };
    const colorPipeline = projectX4UiPreviewPipeline({
      source: colorSource,
      corpus,
      colorEvidence,
      profile: {
        id: 'canvas-color-profile',
        provenance: 'B119 P5 public color-bearing Preview fixture',
        truthGrade: 'supplied',
        source: colorSelection.sourceIdentity,
        drawable: { width: 100, height: 80 },
        uiScale: 1,
        minTextHeight: 10,
      },
      selection: colorSelection,
    });
    const colorScene = colorPipeline.scene !== undefined
      && (colorPipeline.scene.status === 'projected' || colorPipeline.scene.status === 'partial')
      ? colorPipeline.scene.scene
      : undefined;
    const colorFacts = colorScene === undefined
      ? []
      : paintSceneNodes(colorScene).flatMap(node => {
        const facts = (node as unknown as JsonRecord).colorFacts;
        return Array.isArray(facts) ? facts.map(fact => ({ nodeId: node.id, kind: node.kind, fact })) : [];
      });
    const colorPaint = colorScene === undefined
      ? undefined
      : projectX4UiPaintPlan({ scene: colorScene, corpus, previewAuthority: colorPipeline });
    const colorPaintCommands = colorPaint !== undefined && colorPaint.status !== 'refused'
      ? commandList(colorPaint.plan)
      : [];
    const colorGeometryCommands = colorPaintCommands.filter(command => command.kind === 'node-geometry');
    const colorGeometryTints = colorGeometryCommands.flatMap(command => {
      const tints = command.basePreviewTints;
      return Array.isArray(tints) ? tints : [];
    });
    const expectedColorOwners = [
      'table:backgroundColor:table-background',
      'cell:cellbgcolor:cell-background',
      'button:bgcolor:widget-background',
      'button:highlightcolor:widget-highlight',
      'button:bordercolor:widget-border',
      'editbox:bgcolor:widget-background',
      'icon:color:widget-icon',
      'text:color:primary-text',
      'text:color:primary-text',
      'text:color:secondary-text',
    ].sort();
    const actualColorOwners = colorFacts.map(item => {
      const fact = item.fact as JsonRecord;
      return `${item.kind}:${String(fact.field)}:${String(fact.slot)}`;
    }).sort();
    const colorTints = colorPaintCommands.flatMap(command => {
      const tints = command.basePreviewTints;
      return Array.isArray(tints) ? tints : [];
    });
    const publicColorReady = isX4UiCorpusCanonicalColorSuccess(colorEvidence)
      && colorScene !== undefined
      && (colorPaint?.status === 'projected' || colorPaint?.status === 'partial')
      && stableJson(actualColorOwners) === stableJson(expectedColorOwners)
      && colorFacts.length === 10
      && colorGeometryTints.length === 10
      && colorTints.length >= 10;
    familyCheck('stage-b-causal', 'loader-issued color evidence reaches top-level Preview and exact public Paint owner census', publicColorReady, {
      colorEvidence: {
        status: asRecord(colorEvidence)?.status,
        canonicalIdentity: colorEvidence.canonicalIdentity,
        manifestGeneration: asRecord(colorEvidence)?.manifestGeneration,
        gameVerification: colorEvidence.verification,
      },
      previewStatus: colorPipeline.status,
      sceneStatus: colorPipeline.scene?.status,
      paintStatus: colorPaint?.status,
      factCount: colorFacts.length,
      tintCount: colorTints.length,
      geometryTintCount: colorGeometryTints.length,
      expectedOwners: expectedColorOwners,
      actualOwners: actualColorOwners,
    });
    if (publicColorReady && colorPaint !== undefined) {
      const acceptedColorPaint = colorPaint as Extract<X4UiPaintPlanResult, { readonly status: 'projected' | 'partial' }>;
      const tintValue = (tint: unknown): JsonRecord | undefined => {
        const record = asRecord(tint);
        return record === undefined ? undefined : asRecord(record.value);
      };
      const tintAlphaScale = (tint: unknown): number | undefined => {
        const record = asRecord(tint);
        const value = tintValue(tint);
        if (record === undefined || value === undefined || typeof value.a !== 'number') return undefined;
        if (record.domain === 'source-literal-percent-alpha') return value.a / 100;
        if (record.domain === 'canonical-xml-byte-alpha') return value.a / 255;
        return undefined;
      };
      const tintCss = (tint: unknown): string | undefined => {
        const value = tintValue(tint);
        const alpha = tintAlphaScale(tint);
        if (value === undefined || alpha === undefined || typeof value.r !== 'number' || typeof value.g !== 'number' || typeof value.b !== 'number') return undefined;
        return `rgba(${String(value.r)}, ${String(value.g)}, ${String(value.b)}, ${String(alpha)})`;
      };
      const glyphCommands = colorPaintCommands.filter(command => command.kind === 'glyph-alpha-blit');
      const glyphTintKey = (command: JsonRecord): string => {
        const tints = command.basePreviewTints;
        const descriptor = command.descriptor ?? command.atlas;
        return `${stableJson(descriptor)}|${Array.isArray(tints) && tints.length === 1 ? colorFactSignature(tints[0]) : 'diagnostic'}`;
      };
      const expectedGlyphSurfaceKeys = new Set(glyphCommands.map(glyphTintKey));
      const glyphKeyCounts = new Map<string, number>();
      for (const command of glyphCommands) glyphKeyCounts.set(glyphTintKey(command), (glyphKeyCounts.get(glyphTintKey(command)) ?? 0) + 1);
      const repeatedGlyphTint = [...glyphKeyCounts.values()].some(count => count > 1);
      const colorActivity = emptyActivityLedger();
      const colorAtlasRgba: Uint8ClampedArray[] = [];
      const colorAttempt = attemptRender(acceptedColorPaint, corpus, makeObservedFactory(colorActivity, {
        contextHooks: role => role.endsWith('-atlas') ? { captureImageData: data => colorAtlasRgba.push(data.slice()) } : {},
      }));
      const colorResult = completedResult(colorAttempt);
      const colorRendered = colorResult?.status === 'rendered';
      const sourceFillCommands = colorPaintCommands.filter(command => {
        if (command.kind !== 'node-geometry' || effectiveCommandRect(command, 'geometry') === undefined) return false;
        const tints = command.basePreviewTints;
        return Array.isArray(tints) && tints.some(tint => {
          const slot = asRecord(tint)?.slot;
          return slot === 'table-background' || slot === 'cell-background' || slot === 'widget-background';
        });
      });
      const sourceGlyphCommands = colorPaintCommands.filter(command => command.kind === 'glyph-alpha-blit' && effectiveCommandRect(command, 'destinationRect') !== undefined && Array.isArray(command.basePreviewTints) && command.basePreviewTints.length === 1);
      const sourceDiagnosticCommands = colorPaintCommands.filter(command => {
        if (!['gap', 'unsupported-runtime-paint', 'unavailable-node'].includes(String(command.kind))) return false;
        return (effectiveCommandRect(command, 'geometry') ?? rasterRect(command.clipRect)) !== undefined;
      });
      const paintDiagnosticCommands = commandList(paint.plan).filter(command => {
        if (!['gap', 'unsupported-runtime-paint', 'unavailable-node'].includes(String(command.kind))) return false;
        return (effectiveCommandRect(command, 'geometry') ?? rasterRect(command.clipRect)) !== undefined;
      });
      const paintCoverageCommands = commandList(paint.plan).filter(command => {
        if (command.kind === 'glyph-alpha-blit') return effectiveCommandRect(command, 'destinationRect') !== undefined;
        if (command.kind !== 'node-geometry') return false;
        const tints = command.basePreviewTints;
        return Array.isArray(tints) && tints.some(tint => {
          const slot = asRecord(tint)?.slot;
          return slot === 'table-background' || slot === 'cell-background' || slot === 'widget-background' || slot === 'widget-border';
        });
      });
      const paintCoverageRect = (command: JsonRecord): RasterRect | undefined => effectiveCommandRect(command, command.kind === 'glyph-alpha-blit' ? 'destinationRect' : 'geometry');
      const paintCoverageContains = (x: number, y: number): boolean => paintCoverageCommands.some(command => rasterContains(paintCoverageRect(command), x, y));
      const paintDiagnosticInteriorTarget = (() => {
        for (const diagnostic of paintDiagnosticCommands) {
          const visible = effectiveCommandRect(diagnostic, 'geometry') ?? rasterRect(diagnostic.clipRect);
          if (visible === undefined) continue;
          const left = Math.ceil(visible.x + 1);
          const top = Math.ceil(visible.y + 1);
          const right = Math.floor(visible.x + visible.width - 1);
          const bottom = Math.floor(visible.y + visible.height - 1);
          for (let y = top; y < bottom; y += 1) {
            for (let x = left; x < right; x += 1) {
              if (rasterContains(visible, x, y) && !paintCoverageContains(x, y)) {
                const finalDiagnostic = paintDiagnosticCommands
                  .filter(candidate => rasterContains(effectiveCommandRect(candidate, 'geometry') ?? rasterRect(candidate.clipRect), x, y))
                  .sort((leftCommand, rightCommand) => Number(leftCommand.order) - Number(rightCommand.order))
                  .at(-1);
                return { diagnostic: finalDiagnostic ?? diagnostic, visible, x, y };
              }
            }
          }
        }
        return undefined;
      })();
      const sourceTintCss = (tint: unknown): string | undefined => {
        const tintRecord = asRecord(tint);
        const value = tintRecord === undefined ? undefined : asRecord(tintRecord.value);
        const alphaValue = value?.a;
        const alpha = typeof alphaValue === 'number'
          ? tintRecord?.domain === 'source-literal-percent-alpha' ? alphaValue / 100 : tintRecord?.domain === 'canonical-xml-byte-alpha' ? alphaValue / 255 : undefined
          : undefined;
        if (value === undefined || alpha === undefined || typeof value.r !== 'number' || typeof value.g !== 'number' || typeof value.b !== 'number') return undefined;
        return `rgba(${String(value.r)}, ${String(value.g)}, ${String(value.b)}, ${String(alpha)})`;
      };
      const sourceFillTarget = (() => {
        for (const geometry of sourceFillCommands) {
          const geometryRect = effectiveCommandRect(geometry, 'geometry');
          if (geometryRect === undefined) continue;
          for (const diagnostic of sourceDiagnosticCommands) {
            const diagnosticRect = effectiveCommandRect(diagnostic, 'geometry') ?? rasterRect(diagnostic.clipRect);
            const overlap = rasterIntersection(geometryRect, diagnosticRect);
            if (overlap === undefined) continue;
            const x = Math.floor(overlap.x + overlap.width / 2);
            const y = Math.floor(overlap.y + overlap.height / 2);
            if (rasterContains(geometryRect, x, y) && rasterContains(diagnosticRect, x, y)) return { geometry, diagnostic, x, y };
          }
        }
        return undefined;
      })();
      const sourceGlyphTarget = (() => {
        for (const glyph of sourceGlyphCommands) {
          const glyphRect = effectiveCommandRect(glyph, 'destinationRect');
          if (glyphRect === undefined) continue;
          for (const diagnostic of sourceDiagnosticCommands) {
            const diagnosticRect = effectiveCommandRect(diagnostic, 'geometry') ?? rasterRect(diagnostic.clipRect);
            const overlap = rasterIntersection(glyphRect, diagnosticRect);
            if (overlap === undefined) continue;
            const x = Math.floor(overlap.x + overlap.width / 2);
            const y = Math.floor(overlap.y + overlap.height / 2);
            if (rasterContains(glyphRect, x, y) && rasterContains(diagnosticRect, x, y)) return { glyph, diagnostic, x, y };
          }
        }
        return undefined;
      })();
      const diagnosticRasterOutput: RasterOutput = {};
      const diagnosticRasterTrace: TraceEntry[] = [];
      const diagnosticRasterAttempt = attemptRenderWithOptions(acceptedColorPaint, corpus, { surfaceFactory: makeRasterFactory(diagnosticRasterTrace, diagnosticRasterOutput) });
      const sourceRasterOutput: RasterOutput = {};
      const sourceRasterTrace: TraceEntry[] = [];
      const sourceRasterAttempt = attemptRenderWithOptions(acceptedColorPaint, corpus, {
        surfaceFactory: makeRasterFactory(sourceRasterTrace, sourceRasterOutput),
        presentation: 'source-composition',
      } as unknown as X4UiCanvasRenderOptions);
      const paintDiagnosticMapRasterOutput: RasterOutput = {};
      const paintDiagnosticMapRasterTrace: TraceEntry[] = [];
      const paintDiagnosticMapRasterAttempt = attemptRenderWithOptions(paint, corpus, { surfaceFactory: makeRasterFactory(paintDiagnosticMapRasterTrace, paintDiagnosticMapRasterOutput) });
      const paintSourceRasterOutput: RasterOutput = {};
      const paintSourceRasterTrace: TraceEntry[] = [];
      const paintSourceRasterAttempt = attemptRenderWithOptions(paint, corpus, { surfaceFactory: makeRasterFactory(paintSourceRasterTrace, paintSourceRasterOutput), presentation: 'source-composition' });
      const diagnosticRasterResult = completedResult(diagnosticRasterAttempt);
      const sourceRasterResult = completedResult(sourceRasterAttempt);
      const paintDiagnosticMapRasterResult = completedResult(paintDiagnosticMapRasterAttempt);
      const paintSourceRasterResult = completedResult(paintSourceRasterAttempt);
      const sourceFillTint = sourceFillTarget === undefined || !Array.isArray(sourceFillTarget.geometry.basePreviewTints)
        ? undefined
        : sourceFillTarget.geometry.basePreviewTints.find(tint => {
          const slot = asRecord(tint)?.slot;
          return slot === 'table-background' || slot === 'cell-background' || slot === 'widget-background';
        });
      const sourceFillStyle = sourceFillTint === undefined ? undefined : sourceTintCss(sourceFillTint);
      const sourceFillRgba = rasterStyle(sourceFillStyle);
      const finalDiagnosticForPoint = (x: number, y: number): JsonRecord | undefined => sourceDiagnosticCommands
        .filter(command => rasterContains(effectiveCommandRect(command, 'geometry') ?? rasterRect(command.clipRect), x, y))
        .sort((left, right) => Number(left.order) - Number(right.order))
        .at(-1);
      const sourceFillFinalDiagnostic = sourceFillTarget === undefined ? undefined : finalDiagnosticForPoint(sourceFillTarget.x, sourceFillTarget.y);
      const sourceFillDiagnosticRgba = rasterStyle(sourceFillFinalDiagnostic === undefined ? undefined : diagnosticColor(String(sourceFillFinalDiagnostic.kind)));
      const sourceFillPixel = sourceFillTarget === undefined ? undefined : rasterPixel(sourceRasterOutput, sourceFillTarget.x, sourceFillTarget.y);
      const diagnosticFillPixel = sourceFillTarget === undefined ? undefined : rasterPixel(diagnosticRasterOutput, sourceFillTarget.x, sourceFillTarget.y);
      const sourceGlyphTint = sourceGlyphTarget === undefined || !Array.isArray(sourceGlyphTarget.glyph.basePreviewTints) ? undefined : sourceGlyphTarget.glyph.basePreviewTints[0];
      const sourceGlyphStyle = sourceGlyphTint === undefined ? undefined : sourceTintCss(sourceGlyphTint);
      const sourceGlyphRgba = rasterStyle(sourceGlyphStyle);
      const sourceGlyphFinalDiagnostic = sourceGlyphTarget === undefined ? undefined : finalDiagnosticForPoint(sourceGlyphTarget.x, sourceGlyphTarget.y);
      const sourceGlyphDiagnosticRgba = rasterStyle(sourceGlyphFinalDiagnostic === undefined ? undefined : diagnosticColor(String(sourceGlyphFinalDiagnostic.kind)));
      const sourceGlyphPixel = sourceGlyphTarget === undefined ? undefined : rasterPixel(sourceRasterOutput, sourceGlyphTarget.x, sourceGlyphTarget.y);
      const diagnosticGlyphPixel = sourceGlyphTarget === undefined ? undefined : rasterPixel(diagnosticRasterOutput, sourceGlyphTarget.x, sourceGlyphTarget.y);
      const sourceFillCommandRect = sourceFillTarget === undefined ? undefined : rasterRect(sourceFillTarget.geometry.geometry);
      const sourceFillTraceHasTint = sourceFillStyle !== undefined && sourceRasterTrace.some(entry => entry.name === 'setFillStyle' && entry.args[0] === sourceFillStyle)
        && sourceFillCommandRect !== undefined
        && sourceRasterTrace.some(entry => entry.name === 'fillRect' && JSON.stringify(entry.args) === JSON.stringify([sourceFillCommandRect.x, sourceFillCommandRect.y, sourceFillCommandRect.width, sourceFillCommandRect.height]));
      const sourceGlyphTraceHasTint = sourceGlyphStyle !== undefined && sourceRasterTrace.some(entry => entry.name === 'setFillStyle' && entry.args[0] === sourceGlyphStyle)
        && sourceRasterTrace.some(entry => entry.name === 'drawImage');
      const sourceFillSurvives = sourceFillPixel !== undefined && sourceFillRgba !== undefined && sourceFillDiagnosticRgba !== undefined
        && sourceFillPixel[3] > 0
        && JSON.stringify(sourceFillPixel) !== JSON.stringify(sourceFillDiagnosticRgba)
        && diagnosticFillPixel !== undefined
        && JSON.stringify(diagnosticFillPixel) === JSON.stringify(sourceFillDiagnosticRgba);
      const sourceGlyphSurvives = sourceGlyphPixel !== undefined && sourceGlyphRgba !== undefined && sourceGlyphDiagnosticRgba !== undefined
        && sourceGlyphPixel[3] > 0
        && JSON.stringify(sourceGlyphPixel) !== JSON.stringify(sourceGlyphDiagnosticRgba)
        && diagnosticGlyphPixel !== undefined
        && JSON.stringify(diagnosticGlyphPixel) === JSON.stringify(sourceGlyphDiagnosticRgba);
      const paintDiagnosticInteriorPixel = paintDiagnosticInteriorTarget === undefined ? undefined : rasterPixel(paintSourceRasterOutput, paintDiagnosticInteriorTarget.x, paintDiagnosticInteriorTarget.y);
      const paintDiagnosticMapInteriorPixel = paintDiagnosticInteriorTarget === undefined ? undefined : rasterPixel(paintDiagnosticMapRasterOutput, paintDiagnosticInteriorTarget.x, paintDiagnosticInteriorTarget.y);
      const paintDiagnosticInteriorRgba = paintDiagnosticInteriorTarget === undefined ? undefined : rasterStyle(diagnosticColor(String(paintDiagnosticInteriorTarget.diagnostic.kind)));
      const sourceCompositionInteriorOpaque = paintDiagnosticInteriorPixel !== undefined
        && paintDiagnosticInteriorRgba !== undefined
        && JSON.stringify(paintDiagnosticInteriorPixel) === JSON.stringify(paintDiagnosticInteriorRgba);
      const diagnosticMapInteriorOpaque = paintDiagnosticMapInteriorPixel !== undefined
        && paintDiagnosticInteriorRgba !== undefined
        && JSON.stringify(paintDiagnosticMapInteriorPixel) === JSON.stringify(paintDiagnosticInteriorRgba);
      const sourceBoundaryIndicator = paintDiagnosticInteriorTarget !== undefined
        && traceHasDiagnosticBoundary(paintSourceRasterTrace, diagnosticColor(String(paintDiagnosticInteriorTarget.diagnostic.kind)), paintDiagnosticInteriorTarget.visible);
      const diagnosticTraceDeterministic = paintDiagnosticMapRasterResult?.status === 'rendered'
        && paintSourceRasterResult?.status === 'rendered'
        && paintDiagnosticMapRasterAttempt.threw === false
        && paintSourceRasterAttempt.threw === false;
      const sourceCompositionTraceDeterministic = sourceRasterResult?.status === 'rendered'
        && diagnosticRasterResult?.status === 'rendered'
        && sourceRasterAttempt.threw === false
        && diagnosticRasterAttempt.threw === false;
      familyCheck('stage-b-causal', 'B119 source-composition preserves a real source-tinted rectangle and glyph after later opaque diagnostics', sourceCompositionTraceDeterministic && sourceFillTarget !== undefined && sourceGlyphTarget !== undefined && sourceFillTraceHasTint && sourceGlyphTraceHasTint && sourceFillSurvives && sourceGlyphSurvives, {
        sourceFillTarget: sourceFillTarget === undefined ? undefined : { id: sourceFillTarget.geometry.id, diagnostic: sourceFillTarget.diagnostic.kind, point: [sourceFillTarget.x, sourceFillTarget.y] },
        sourceFillStyle,
        sourceFillPixel,
        diagnosticFillPixel,
        sourceFillFinalDiagnostic: sourceFillFinalDiagnostic?.kind,
        sourceGlyphTarget: sourceGlyphTarget === undefined ? undefined : { id: sourceGlyphTarget.glyph.id, diagnostic: sourceGlyphTarget.diagnostic.kind, point: [sourceGlyphTarget.x, sourceGlyphTarget.y] },
        sourceGlyphStyle,
        sourceGlyphPixel,
        diagnosticGlyphPixel,
        sourceGlyphFinalDiagnostic: sourceGlyphFinalDiagnostic?.kind,
        sourceFillTraceHasTint,
        sourceGlyphTraceHasTint,
        sourceRasterReceipt: receiptSummary(sourceRasterResult?.receipt),
        sourceRasterTraceLength: sourceRasterTrace.length,
      });
      familyCheck('stage-b-causal', 'B119 source-composition keeps diagnostic interiors transparent but restores clipped boundary indicators while diagnostic-map retains opaque interiors', paintDiagnosticInteriorTarget !== undefined
        && diagnosticTraceDeterministic
        && diagnosticMapInteriorOpaque
        && !sourceCompositionInteriorOpaque
        && sourceBoundaryIndicator
        && sourceFillSurvives
        && sourceGlyphSurvives, {
        paintDiagnosticInteriorTarget: paintDiagnosticInteriorTarget === undefined ? undefined : {
          id: paintDiagnosticInteriorTarget.diagnostic.id,
          kind: paintDiagnosticInteriorTarget.diagnostic.kind,
          visible: paintDiagnosticInteriorTarget.visible,
          point: [paintDiagnosticInteriorTarget.x, paintDiagnosticInteriorTarget.y],
        },
        paintDiagnosticInteriorPixel,
        paintDiagnosticMapInteriorPixel,
        expectedDiagnosticInteriorPixel: paintDiagnosticInteriorRgba,
        sourceCompositionInteriorOpaque,
        diagnosticMapInteriorOpaque,
        sourceBoundaryIndicator,
        diagnosticTraceDeterministic,
        sourceFillSurvives,
        sourceGlyphSurvives,
      });
      const structuralGeometry = colorPaintCommands.find(command => command.kind === 'node-geometry' && !Array.isArray(command.basePreviewTints) && effectiveCommandRect(command, 'geometry') !== undefined);
      const structuralRect = structuralGeometry === undefined ? undefined : effectiveCommandRect(structuralGeometry, 'geometry');
      const structuralDiagnosticMapFill = structuralRect === undefined ? false : traceHasOpaqueFill(diagnosticRasterTrace, X4_UI_CANVAS_DIAGNOSTIC_PALETTE.geometry, structuralRect)
        || traceHasOpaqueFill(diagnosticRasterTrace, X4_UI_CANVAS_DIAGNOSTIC_PALETTE.unavailable, structuralRect);
      const sourceStructuralFillAbsent = structuralRect === undefined || !traceHasOpaqueFill(sourceRasterTrace, X4_UI_CANVAS_DIAGNOSTIC_PALETTE.geometry, structuralRect) && !traceHasOpaqueFill(sourceRasterTrace, X4_UI_CANVAS_DIAGNOSTIC_PALETTE.unavailable, structuralRect);
      familyCheck('stage-b-causal', 'B119 source-composition leaves untinted structural containers non-opaque while diagnostic-map retains them', structuralGeometry !== undefined && structuralDiagnosticMapFill && sourceStructuralFillAbsent, {
        structuralGeometry: structuralGeometry === undefined ? undefined : { id: structuralGeometry.id, rect: structuralRect },
        diagnosticMapFill: structuralDiagnosticMapFill,
        sourceStructuralFillAbsent,
      });
      const colorStyles = colorActivity.paint.filter(entry => entry.name === 'setFillStyle' || entry.name === 'setStrokeStyle').map(entry => String(entry.args[0]));
      const atlasPixelMatches = (tint: unknown): boolean => {
        const value = tintValue(tint);
        const alpha = tintAlphaScale(tint);
        if (value === undefined || alpha === undefined || typeof value.r !== 'number' || typeof value.g !== 'number' || typeof value.b !== 'number') return false;
        const expectedAlpha = applyZektonSdfAlpha(91, alpha);
        return colorAtlasRgba.some(bytes => {
          for (let offset = 0; offset + 3 < bytes.length; offset += 4) {
            if (bytes[offset] === value.r && bytes[offset + 1] === value.g && bytes[offset + 2] === value.b && bytes[offset + 3] === expectedAlpha) return true;
          }
          return false;
        });
      };
      const canonicalTint = colorTints.find(tint => asRecord(tint)?.domain === 'canonical-xml-byte-alpha');
      const literalTint = colorTints.find(tint => asRecord(tint)?.domain === 'source-literal-percent-alpha');
      const primaryTint = colorTints.find(tint => asRecord(tint)?.slot === 'primary-text');
      const secondaryTint = colorTints.find(tint => asRecord(tint)?.slot === 'secondary-text');
      const literalGlyphTint = primaryTint ?? literalTint;
      familyCheck('stage-b-causal', 'P6 owner-linked public color plan is consumed by Canvas instead of structurally refused', colorRendered, {
        threw: colorAttempt.threw,
        result: colorResult === undefined ? undefined : receiptSummary(colorResult.receipt),
        activity: activitySignature(colorActivity),
        colorCommandCount: colorPaintCommands.length,
        tintCount: colorTints.length,
        geometryTintCount: colorGeometryTints.length,
      });
      familyCheck('stage-b-causal', 'P6 typed alpha consumes source-literal percent and canonical XML byte domains', colorRendered
        && canonicalTint !== undefined
        && literalGlyphTint !== undefined
        && colorStyles.includes(tintCss(canonicalTint) ?? '')
        && atlasPixelMatches(literalGlyphTint), {
        result: colorResult === undefined ? undefined : receiptSummary(colorResult.receipt),
        canonicalDomain: asRecord(canonicalTint)?.domain,
        canonicalStyle: tintCss(canonicalTint),
        canonicalStyleObserved: colorStyles.includes(tintCss(canonicalTint) ?? ''),
        literalDomain: asRecord(literalGlyphTint)?.domain,
        literalExpectedAlpha: tintAlphaScale(literalGlyphTint) === undefined ? undefined : applyZektonSdfAlpha(91, tintAlphaScale(literalGlyphTint) as number),
        literalPixelObserved: atlasPixelMatches(literalGlyphTint),
      });
      familyCheck('stage-b-causal', 'P6 staged tint pixels preserve raw RGB and typed alpha on glyph atlas bytes', colorRendered
        && primaryTint !== undefined
        && secondaryTint !== undefined
        && atlasPixelMatches(primaryTint)
        && atlasPixelMatches(secondaryTint)
        && tintValue(primaryTint)?.r !== tintValue(secondaryTint)?.r, {
        result: colorResult === undefined ? undefined : receiptSummary(colorResult.receipt),
        primaryPixelObserved: atlasPixelMatches(primaryTint),
        secondaryPixelObserved: atlasPixelMatches(secondaryTint),
        primaryRgb: tintValue(primaryTint) === undefined ? undefined : [tintValue(primaryTint)?.r, tintValue(primaryTint)?.g, tintValue(primaryTint)?.b],
        secondaryRgb: tintValue(secondaryTint) === undefined ? undefined : [tintValue(secondaryTint)?.r, tintValue(secondaryTint)?.g, tintValue(secondaryTint)?.b],
        atlasCaptures: colorAtlasRgba.length,
      });
      familyCheck('stage-b-causal', 'P6 distinct drawable tints do not alias and identical glyph tints reuse renderer-owned atlas surfaces', colorRendered
        && expectedGlyphSurfaceKeys.size > 1
        && repeatedGlyphTint
        && colorActivity.factory.filter(entry => String(entry.role).endsWith('-atlas')).length === expectedGlyphSurfaceKeys.size, {
        result: colorResult === undefined ? undefined : receiptSummary(colorResult.receipt),
        expectedDistinctSurfaces: expectedGlyphSurfaceKeys.size,
        actualAtlasAllocations: colorActivity.factory.filter(entry => String(entry.role).endsWith('-atlas')).length,
        repeatedGlyphTint,
        glyphCommandCount: glyphCommands.length,
      });
      const withheldTints = colorTints.filter(tint => {
        const slot = asRecord(tint)?.slot;
        return slot === 'widget-highlight' || slot === 'widget-icon';
      });
      const withheldStylesAbsent = withheldTints.every(tint => {
        const style = tintCss(tint);
        return style === undefined || !colorStyles.includes(style);
      });
      const withheldPixelsAbsent = withheldTints.every(tint => !atlasPixelMatches(tint));
      familyCheck('stage-b-causal', 'P6 highlight and icon tint facts remain retained diagnostics without active/base source paint', colorRendered
        && withheldTints.length === 2
        && withheldStylesAbsent
        && withheldPixelsAbsent, {
        result: colorResult === undefined ? undefined : receiptSummary(colorResult.receipt),
        withheldSlots: withheldTints.map(tint => asRecord(tint)?.slot),
        withheldStylesAbsent,
        withheldPixelsAbsent,
      });
      const firstTintCommand = (layers: MutableLayer[]): JsonRecord | undefined => layers.flatMap(layer => layer.commands).find(command => Array.isArray(command.basePreviewTints));
      const hostileRender = (mutate: (plan: X4UiPaintPlan, layers: MutableLayer[]) => void): { readonly attempt: RenderAttempt; readonly activity: ActivityLedger } => {
        const candidate = forgedResult(acceptedColorPaint, mutate);
        const activity = emptyActivityLedger();
        return { attempt: attemptRender(candidate, corpus, makeObservedFactory(activity)), activity };
      };
      const sourceLiteralTopology = (layers: MutableLayer[]): {
        readonly tint: JsonRecord;
        readonly useSite: JsonRecord;
        readonly declaration: JsonRecord;
      } | undefined => {
        for (const layer of layers) {
          for (const command of layer.commands) {
            const commandSource = asRecord(command.source);
            const tints = command.basePreviewTints;
            if (commandSource === undefined || !Array.isArray(tints)) continue;
            for (const tintValue of tints) {
              const tint = asRecord(tintValue);
              const color = tint === undefined ? undefined : asRecord(tint.value);
              const declaration = color === undefined ? undefined : asRecord(color.declarationSource);
              if (tint?.domain !== 'source-literal-percent-alpha' || declaration === undefined) continue;
              return { tint, useSite: commandSource, declaration };
            }
          }
        }
        return undefined;
      };
      const sourceIdentityMatches = (left: JsonRecord, right: JsonRecord): boolean => left.file === right.file && left.sourcePath === right.sourcePath;
      const sourceRangeContains = (outer: JsonRecord, inner: JsonRecord): boolean => {
        const outerStart = asRecord(outer.start);
        const outerEnd = asRecord(outer.end);
        const innerStart = asRecord(inner.start);
        const innerEnd = asRecord(inner.end);
        return typeof outerStart?.offset === 'number'
          && typeof outerEnd?.offset === 'number'
          && typeof innerStart?.offset === 'number'
          && typeof innerEnd?.offset === 'number'
          && outerStart.offset <= innerStart.offset
          && innerEnd.offset <= outerEnd.offset;
      };
      let separatedDeclarationTopologyApplied = false;
      let separatedDeclarationEvidence: unknown;
      const separatedDeclarationTopology = hostileRender((_plan, layers) => {
        const topology = sourceLiteralTopology(layers);
        if (topology === undefined) return;
        const useSite = JSON.parse(JSON.stringify(topology.useSite)) as JsonRecord;
        topology.tint.source = useSite;
        const sameIdentity = sourceIdentityMatches(useSite, topology.declaration);
        const declarationContained = sourceRangeContains(useSite, topology.declaration);
        separatedDeclarationEvidence = { field: topology.tint.field, slot: topology.tint.slot, useSite, declaration: topology.declaration, sameIdentity, declarationContained };
        separatedDeclarationTopologyApplied = sameIdentity
          && !declarationContained
          && topology.tint.source !== topology.declaration;
      });
      let crossFileTopologyApplied = false;
      const hostileCrossFileTopology = hostileRender((_plan, layers) => {
        const topology = sourceLiteralTopology(layers);
        if (topology === undefined) return;
        const crossFileUseSite = JSON.parse(JSON.stringify(topology.useSite)) as JsonRecord;
        crossFileUseSite.file = 'ui/other-color.lua';
        crossFileUseSite.sourcePath = 'ui/other-color.lua';
        topology.tint.source = crossFileUseSite;
        crossFileTopologyApplied = crossFileUseSite.file !== topology.declaration.file
          && crossFileUseSite.sourcePath !== topology.declaration.sourcePath;
      });
      let sourcePathTopologyApplied = false;
      const hostileSourcePathTopology = hostileRender((_plan, layers) => {
        const topology = sourceLiteralTopology(layers);
        if (topology === undefined) return;
        const mismatchedSourcePath = JSON.parse(JSON.stringify(topology.useSite)) as JsonRecord;
        mismatchedSourcePath.sourcePath = 'ui/other-color.lua';
        topology.tint.source = mismatchedSourcePath;
        sourcePathTopologyApplied = mismatchedSourcePath.file === topology.declaration.file
          && mismatchedSourcePath.sourcePath !== topology.declaration.sourcePath;
      });
      const hostileExtra = hostileRender((_plan, layers) => {
        const command = firstTintCommand(layers);
        const tints = command?.basePreviewTints as JsonRecord[] | undefined;
        const tint = tints?.[0];
        if (tint !== undefined) tint.hostileExtra = true;
      });
      const hostileAccessor = hostileRender((_plan, layers) => {
        const command = firstTintCommand(layers);
        if (command !== undefined) Object.defineProperty(command, 'basePreviewTints', { configurable: true, enumerable: true, get: () => [] });
      });
      const hostilePrototype = hostileRender((_plan, layers) => {
        const command = firstTintCommand(layers);
        const tints = command?.basePreviewTints as JsonRecord[] | undefined;
        if (tints?.[0] !== undefined) Object.setPrototypeOf(tints[0], { hostilePrototype: true });
      });
      const hostileSparse = hostileRender((_plan, layers) => {
        const command = firstTintCommand(layers);
        const tints = command?.basePreviewTints as JsonRecord[] | undefined;
        if (tints !== undefined) delete tints[0];
      });
      const hostileSymbol = hostileRender((_plan, layers) => {
        const command = firstTintCommand(layers);
        const tints = command?.basePreviewTints as JsonRecord[] | undefined;
        if (tints?.[0] !== undefined) Reflect.defineProperty(tints[0], Symbol('stage-b-hostile'), { configurable: true, enumerable: true, value: true });
      });
      const hostileProxy = hostileRender((_plan, layers) => {
        const command = firstTintCommand(layers);
        const tints = command?.basePreviewTints as JsonRecord[] | undefined;
        if (command !== undefined && tints !== undefined) command.basePreviewTints = new Proxy(tints, { getPrototypeOf: () => ({ hostileProxy: true }) });
      });
      const allTintRecords = (layers: MutableLayer[]): JsonRecord[] => layers.flatMap(layer => layer.commands).flatMap(command => {
        const tints = command.basePreviewTints;
        if (!Array.isArray(tints)) return [];
        return tints.flatMap(tint => {
          const record = asRecord(tint);
          return record === undefined ? [] : [record];
        });
      });
      const renderForgedCandidate = (mutate: (plan: X4UiPaintPlan, layers: MutableLayer[]) => void, atlasRgba?: Uint8ClampedArray[]): { readonly attempt: RenderAttempt; readonly activity: ActivityLedger } => {
        const candidate = forgedResult(acceptedColorPaint, mutate);
        const activity = emptyActivityLedger();
        const factory = atlasRgba === undefined
          ? makeObservedFactory(activity)
          : makeObservedFactory(activity, {
            contextHooks: role => role.endsWith('-atlas') ? { captureImageData: data => atlasRgba.push(data.slice()) } : {},
          });
        return { attempt: attemptRender(candidate, corpus, factory), activity };
      };
      const fractionalAtlasRgba: Uint8ClampedArray[] = [];
      let fractionalGeometryDrawableSeen = false;
      let literalExactPinCount = 0;
      let literalSampleIdCount = 0;
      const acceptedLiteralSchema = renderForgedCandidate((_plan, layers) => {
        let literalCount = 0;
        for (const layer of layers) {
          for (const command of layer.commands) {
            const commandTints = command.basePreviewTints;
            if (!Array.isArray(commandTints)) continue;
            for (const tintValue of commandTints) {
              const tint = asRecord(tintValue);
              if (tint === undefined || tint.domain !== 'source-literal-percent-alpha') continue;
              const color = asRecord(tint.value);
              const channels = color === undefined ? undefined : asRecord(color.channels);
              const source = asRecord(tint.source);
              if (color === undefined || channels === undefined || source === undefined) continue;
              const sourceStart = asRecord(source.start);
              const sourceEnd = asRecord(source.end);
              const sourcePath = typeof source.sourcePath === 'string' ? source.sourcePath : source.file;
              if (typeof sourcePath !== 'string' || typeof sourceStart?.line !== 'number' || typeof sourceEnd?.line !== 'number') continue;
              tint.sourcePin = { sourcePath, lineStart: sourceStart.line, lineEnd: sourceEnd.line };
              tint.sampleId = 'stage-b-public-color-sample';
              const sourcePin = asRecord(tint.sourcePin);
              if (sourcePin !== undefined
                && stableJson(Object.keys(sourcePin).sort()) === stableJson(['lineEnd', 'lineStart', 'sourcePath'])
                && sourcePin.sourcePath === sourcePath
                && sourcePin.lineStart === sourceStart.line
                && sourcePin.lineEnd === sourceEnd.line) literalExactPinCount += 1;
              if (tint.sampleId === 'stage-b-public-color-sample') literalSampleIdCount += 1;
              const fractionalChannels: Record<string, number> = { r: 12.25, g: 22.5, b: 32.75, a: 42.5 };
              for (const [channelName, channelValue] of Object.entries(fractionalChannels)) {
                color[channelName] = channelValue;
                const evidence = asRecord(channels[channelName]);
                if (evidence !== undefined) evidence.value = channelValue;
              }
              const redEvidence = asRecord(channels.r);
              if (redEvidence !== undefined) channels.glow = { ...redEvidence, expression: '0.5', value: 0.5 };
              color.glow = 0.5;
              if (command.kind === 'node-geometry' && (tint.slot === 'table-background' || tint.slot === 'cell-background' || tint.slot === 'widget-background' || tint.slot === 'widget-border')) fractionalGeometryDrawableSeen = true;
              literalCount += 1;
            }
          }
        }
        if (literalCount === 0) throw new Error('accepted source-literal schema fixture had no literal tint');
      }, fractionalAtlasRgba);
      let canonicalMappingCount = 0;
      const acceptedCanonicalMapping = renderForgedCandidate((_plan, layers) => {
        for (const tint of allTintRecords(layers)) {
          if (tint.domain !== 'canonical-xml-byte-alpha') continue;
          const color = asRecord(tint.value);
          if (color === undefined || typeof color.resolvedBaseId !== 'string') continue;
          const requestedId = 'paint_mapping_0';
          color.requestedId = requestedId;
          color.mappingSource = {
            id: requestedId,
            index: 0,
            path: X4_UI_CORPUS_9_00_COLOR_CONTRACT.xml.relativePath,
          };
          if (requestedId !== color.resolvedBaseId) canonicalMappingCount += 1;
        }
        if (canonicalMappingCount === 0) throw new Error('accepted canonical mapping schema fixture had no canonical tint');
      });
      const canonicalGlowRgba: Uint8ClampedArray[] = [];
      let canonicalGlowCount = 0;
      const acceptedCanonicalGlow = renderForgedCandidate((_plan, layers) => {
        for (const tint of allTintRecords(layers)) {
          if (tint.domain !== 'canonical-xml-byte-alpha') continue;
          const color = asRecord(tint.value);
          if (color === undefined) continue;
          color.glow = 0.5;
          canonicalGlowCount += 1;
        }
      }, canonicalGlowRgba);
      const literalTintParts = (layers: MutableLayer[]): { readonly tint: JsonRecord; readonly color: JsonRecord; readonly channels: JsonRecord } | undefined => {
        const tint = allTintRecords(layers).find(candidate => candidate.domain === 'source-literal-percent-alpha');
        const color = tint === undefined ? undefined : asRecord(tint.value);
        const channels = color === undefined ? undefined : asRecord(color.channels);
        return tint === undefined || color === undefined || channels === undefined ? undefined : { tint, color, channels };
      };
      const literalProvenanceSources = (parts: { readonly tint: JsonRecord; readonly color: JsonRecord; readonly channels: JsonRecord }): {
        readonly outer: JsonRecord;
        readonly declaration: JsonRecord;
        readonly channelPairs: readonly { readonly source: JsonRecord; readonly keySource: JsonRecord }[];
      } | undefined => {
        const outer = asRecord(parts.tint.source);
        const declaration = asRecord(parts.color.declarationSource);
        const channelPairs: { readonly source: JsonRecord; readonly keySource: JsonRecord }[] = [];
        if (outer === undefined || declaration === undefined) return undefined;
        for (const channelValue of Object.values(parts.channels)) {
          const channel = asRecord(channelValue);
          const source = channel === undefined ? undefined : asRecord(channel.source);
          const keySource = channel === undefined ? undefined : asRecord(channel.keySource);
          if (source === undefined || keySource === undefined) return undefined;
          channelPairs.push({ source, keySource });
        }
        return { outer, declaration, channelPairs };
      };
      const sourceCoordinates = (sources: readonly JsonRecord[]): string => stableJson(sources.map(source => ({
        file: source.file,
        start: source.start,
        end: source.end,
      })));
      const setSourcePaths = (sources: readonly JsonRecord[], sourcePath: string): void => {
        for (const source of sources) source.sourcePath = sourcePath;
      };
      let stringSourcePinApplied = false;
      const hostileStringSourcePin = hostileRender((_plan, layers) => {
        const parts = literalTintParts(layers);
        if (parts === undefined) return;
        parts.tint.sourcePin = 'ui/color.lua';
        stringSourcePinApplied = parts.tint.sourcePin === 'ui/color.lua';
      });
      let fullSourcePinApplied = false;
      const hostileFullSourcePin = hostileRender((_plan, layers) => {
        const parts = literalTintParts(layers);
        const source = parts === undefined ? undefined : asRecord(parts.tint.source);
        if (parts === undefined || source === undefined) return;
        const fullSource = JSON.parse(JSON.stringify(source)) as JsonRecord;
        parts.tint.sourcePin = fullSource;
        fullSourcePinApplied = Object.prototype.hasOwnProperty.call(fullSource, 'file')
          && Object.prototype.hasOwnProperty.call(fullSource, 'start')
          && Object.prototype.hasOwnProperty.call(fullSource, 'end')
          && !Object.prototype.hasOwnProperty.call(fullSource, 'lineStart')
          && !Object.prototype.hasOwnProperty.call(fullSource, 'lineEnd');
      });
      let declarationSourcePathDriftApplied = false;
      const hostileDeclarationSourcePath = hostileRender((_plan, layers) => {
        const parts = literalTintParts(layers);
        const sources = parts === undefined ? undefined : literalProvenanceSources(parts);
        if (sources === undefined || typeof sources.outer.file !== 'string') return;
        const basePath = sources.outer.file;
        const driftPath = `${basePath}:drift`;
        const descendants = [sources.declaration, ...sources.channelPairs.flatMap(pair => [pair.source, pair.keySource])];
        const allSources = [sources.outer, ...descendants];
        const coordinatesBefore = sourceCoordinates(allSources);
        sources.outer.sourcePath = basePath;
        setSourcePaths(descendants, driftPath);
        declarationSourcePathDriftApplied = sources.outer.sourcePath === basePath
          && descendants.every(source => source.sourcePath === driftPath)
          && coordinatesBefore === sourceCoordinates(allSources);
      });
      let channelSourcePathDriftApplied = false;
      const hostileChannelSourcePath = hostileRender((_plan, layers) => {
        const parts = literalTintParts(layers);
        const sources = parts === undefined ? undefined : literalProvenanceSources(parts);
        const target = sources?.channelPairs[0]?.source;
        if (sources === undefined || target === undefined || typeof sources.outer.file !== 'string') return;
        const basePath = sources.outer.file;
        const allSources = [sources.outer, sources.declaration, ...sources.channelPairs.flatMap(pair => [pair.source, pair.keySource])];
        const coordinatesBefore = sourceCoordinates(allSources);
        setSourcePaths(allSources, basePath);
        target.sourcePath = `${basePath}:drift`;
        channelSourcePathDriftApplied = target.sourcePath === `${basePath}:drift`
          && allSources.filter(source => source !== target).every(source => source.sourcePath === basePath)
          && coordinatesBefore === sourceCoordinates(allSources);
      });
      let channelKeySourcePathDriftApplied = false;
      const hostileChannelKeySourcePath = hostileRender((_plan, layers) => {
        const parts = literalTintParts(layers);
        const sources = parts === undefined ? undefined : literalProvenanceSources(parts);
        const target = sources?.channelPairs[0]?.keySource;
        if (sources === undefined || target === undefined || typeof sources.outer.file !== 'string') return;
        const basePath = sources.outer.file;
        const allSources = [sources.outer, sources.declaration, ...sources.channelPairs.flatMap(pair => [pair.source, pair.keySource])];
        const coordinatesBefore = sourceCoordinates(allSources);
        setSourcePaths(allSources, basePath);
        target.sourcePath = `${basePath}:drift`;
        channelKeySourcePathDriftApplied = target.sourcePath === `${basePath}:drift`
          && allSources.filter(source => source !== target).every(source => source.sourcePath === basePath)
          && coordinatesBefore === sourceCoordinates(allSources);
      });
      let directMappingApplied = false;
      const hostileDirectCanonicalMapping = hostileRender((_plan, layers) => {
        const tint = allTintRecords(layers).find(candidate => candidate.domain === 'canonical-xml-byte-alpha');
        const color = tint === undefined ? undefined : asRecord(tint.value);
        if (color === undefined || typeof color.resolvedBaseId !== 'string') return;
        color.requestedId = color.resolvedBaseId;
        color.mappingSource = {
          id: color.resolvedBaseId,
          index: 0,
          path: X4_UI_CORPUS_9_00_COLOR_CONTRACT.xml.relativePath,
        };
        directMappingApplied = color.requestedId === color.resolvedBaseId && asRecord(color.mappingSource)?.id === color.requestedId;
      });
      let declarationOffsetEscapeApplied = false;
      const hostileDeclarationOffsetEscape = hostileRender((_plan, layers) => {
        const parts = literalTintParts(layers);
        const declarationSource = parts === undefined ? undefined : asRecord(parts.color.declarationSource);
        const channel = parts === undefined ? undefined : asRecord(parts.channels.r);
        const channelSource = channel === undefined ? undefined : asRecord(channel.source);
        const channelEnd = channelSource === undefined ? undefined : asRecord(channelSource.end);
        const declarationStart = declarationSource === undefined ? undefined : asRecord(declarationSource.start);
        const declarationEnd = declarationSource === undefined ? undefined : asRecord(declarationSource.end);
        if (channelEnd === undefined || declarationStart === undefined || declarationEnd === undefined
          || typeof channelEnd.offset !== 'number' || typeof channelEnd.column !== 'number' || typeof channelEnd.line !== 'number') return;
        const channelEndOffset = channelEnd.offset as number;
        declarationStart.offset = channelEndOffset + 1;
        declarationStart.column = channelEnd.column + 1;
        declarationStart.line = channelEnd.line;
        declarationEnd.offset = declarationStart.offset;
        declarationEnd.column = declarationStart.column;
        declarationEnd.line = declarationStart.line;
        declarationOffsetEscapeApplied = declarationStart.offset === channelEndOffset + 1;
      });
      let channelOffsetEscapeApplied = false;
      const hostileChannelOffsetEscape = hostileRender((_plan, layers) => {
        const parts = literalTintParts(layers);
        const declarationSource = parts === undefined ? undefined : asRecord(parts.color.declarationSource);
        const declarationEnd = declarationSource === undefined ? undefined : asRecord(declarationSource.end);
        const channel = parts === undefined ? undefined : asRecord(parts.channels.r);
        const channelSource = channel === undefined ? undefined : asRecord(channel.source);
        const channelEnd = channelSource === undefined ? undefined : asRecord(channelSource.end);
        if (declarationEnd === undefined || channelEnd === undefined || typeof declarationEnd.offset !== 'number' || typeof declarationEnd.column !== 'number') return;
        channelEnd.offset = declarationEnd.offset + 1;
        channelEnd.column = declarationEnd.column + 1;
        channelEnd.line = declarationEnd.line;
        const updatedOffset = channelEnd.offset;
        channelOffsetEscapeApplied = typeof updatedOffset === 'number' && updatedOffset > declarationEnd.offset;
      });
      let keySourceOffsetEscapeApplied = false;
      const hostileKeySourceOffsetEscape = hostileRender((_plan, layers) => {
        const parts = literalTintParts(layers);
        const declarationSource = parts === undefined ? undefined : asRecord(parts.color.declarationSource);
        const declarationEnd = declarationSource === undefined ? undefined : asRecord(declarationSource.end);
        const channel = parts === undefined ? undefined : asRecord(parts.channels.r);
        const keySource = channel === undefined ? undefined : asRecord(channel.keySource);
        const keyEnd = keySource === undefined ? undefined : asRecord(keySource.end);
        if (declarationEnd === undefined || keyEnd === undefined || typeof declarationEnd.offset !== 'number' || typeof declarationEnd.column !== 'number') return;
        keyEnd.offset = declarationEnd.offset + 1;
        keyEnd.column = declarationEnd.column + 1;
        keyEnd.line = declarationEnd.line;
        const updatedOffset = keyEnd.offset;
        keySourceOffsetEscapeApplied = typeof updatedOffset === 'number' && updatedOffset > declarationEnd.offset;
      });
      let duplicateTintFactApplied = false;
      const hostileDuplicateTintFact = hostileRender((_plan, layers) => {
        const command = firstTintCommand(layers);
        const tints = command?.basePreviewTints as JsonRecord[] | undefined;
        const original = tints?.[0];
        if (tints === undefined || original === undefined) return;
        const duplicate = JSON.parse(JSON.stringify(original)) as JsonRecord;
        tints.push(duplicate);
        duplicateTintFactApplied = colorFactSignature(original) === colorFactSignature(duplicate) && tints.length >= 2;
      });
      let reassignedTintOwnerApplied = false;
      const hostileReassignedTintOwner = hostileRender((_plan, layers) => {
        const geometryCommands = layers.flatMap(layer => layer.commands).filter(command => command.kind === 'node-geometry');
        const sourceCommand = geometryCommands.find(command => Array.isArray(command.basePreviewTints) && command.basePreviewTints.length > 0);
        const sourceTints = sourceCommand?.basePreviewTints as JsonRecord[] | undefined;
        const sourceTint = sourceTints?.[0];
        const sourceOwner = sourceCommand?.nodeId ?? sourceCommand?.id;
        const targetCommand = geometryCommands.find(command => (command.nodeId ?? command.id) !== sourceOwner);
        const targetOwner = targetCommand?.nodeId ?? targetCommand?.id;
        if (sourceTint === undefined || targetCommand === undefined || typeof sourceOwner !== 'string' || typeof targetOwner !== 'string') return;
        const reassigned = JSON.parse(JSON.stringify(sourceTint)) as JsonRecord;
        targetCommand.basePreviewTints = [reassigned];
        reassignedTintOwnerApplied = sourceOwner !== targetOwner && colorFactSignature(sourceTint) === colorFactSignature(reassigned);
      });
      let duplicateTintSlotApplied = false;
      const hostileDuplicateTintSlot = hostileRender((_plan, layers) => {
        const command = firstTintCommand(layers);
        const tints = command?.basePreviewTints as JsonRecord[] | undefined;
        const original = tints?.[0];
        if (tints === undefined || original === undefined) return;
        const duplicate = JSON.parse(JSON.stringify(original)) as JsonRecord;
        const duplicateSource = asRecord(duplicate.source);
        const duplicateEnd = duplicateSource === undefined ? undefined : asRecord(duplicateSource.end);
        if (duplicateEnd === undefined || typeof duplicateEnd.offset !== 'number' || typeof duplicateEnd.column !== 'number') return;
        duplicateEnd.offset += 1;
        duplicateEnd.column += 1;
        tints.push(duplicate);
        duplicateTintSlotApplied = original.slot === duplicate.slot
          && colorFactSignature(original) !== colorFactSignature(duplicate)
          && tints.length >= 2;
      });
      const hostileAccepted = (attempt: RenderAttempt, activity: ActivityLedger): boolean => {
        const result = completedResult(attempt);
        return colorRendered
          && result?.status === 'refused'
          && result.receipt.refusal.code === 'invalid-command'
          && refusalBoundaryIsComplete(result)
          && activityIsZero(activity);
      };
      const acceptedLiteralResult = completedResult(acceptedLiteralSchema.attempt);
      const acceptedCanonicalMappingResult = completedResult(acceptedCanonicalMapping.attempt);
      const acceptedCanonicalGlowResult = completedResult(acceptedCanonicalGlow.attempt);
      const separatedDeclarationResult = completedResult(separatedDeclarationTopology.attempt);
      const hostileCrossFileResult = completedResult(hostileCrossFileTopology.attempt);
      const hostileSourcePathResult = completedResult(hostileSourcePathTopology.attempt);
      const sampledLiteralDeclarationExpression = '{ r =   3, g =   6, b =  11, a =  85 }';
      let sampledLiteralDeclarationApplied = 0;
      const sampledLiteralDeclaration = hostileRender((_plan, layers) => {
        const sampledChannelValues: Record<'r' | 'g' | 'b' | 'a', number> = { r: 3, g: 6, b: 11, a: 85 };
        for (const layer of layers) {
          for (const command of layer.commands) {
            const tints = command.basePreviewTints;
            if (!Array.isArray(tints)) continue;
            for (const tintValue of tints) {
              const tint = asRecord(tintValue);
              const color = tint === undefined ? undefined : asRecord(tint.value);
              const channels = color === undefined ? undefined : asRecord(color.channels);
              if (tint?.domain !== 'source-literal-percent-alpha' || color === undefined || channels === undefined) continue;
              tint.expression = 'TOK.plate';
              color.declarationExpression = sampledLiteralDeclarationExpression;
              for (const [channel, value] of Object.entries(sampledChannelValues)) {
                color[channel] = value;
                const evidence = asRecord(channels[channel]);
                if (evidence !== undefined) evidence.value = value;
              }
              sampledLiteralDeclarationApplied += 1;
            }
          }
        }
      });
      const sampledLiteralDeclarationResult = completedResult(sampledLiteralDeclaration.attempt);
      familyCheck('stage-b-causal', 'P6 source-literal use-site may be separate from same-file declaration evidence', publicColorReady
        && separatedDeclarationTopologyApplied
        && separatedDeclarationResult?.status === 'rendered'
        && !separatedDeclarationTopology.attempt.threw
        && activityIsZero(separatedDeclarationTopology.activity) === false, {
        upstream: { preview: colorPipeline.status, scene: colorPipeline.scene?.status, paint: colorPaint?.status, colorFacts: colorFacts.length, tints: colorTints.length },
        applied: separatedDeclarationTopologyApplied,
        topology: separatedDeclarationEvidence,
        result: receiptSummary(separatedDeclarationResult?.receipt),
        activity: activitySignature(separatedDeclarationTopology.activity),
      });
      familyCheck('stage-b-causal', 'P6 sampled source-literal use-site may reference a same-source literal declaration expression', colorRendered
        && sampledLiteralDeclarationApplied > 0
        && sampledLiteralDeclarationResult?.status === 'rendered'
        && !sampledLiteralDeclaration.attempt.threw
        && activityIsZero(sampledLiteralDeclaration.activity) === false, {
        sampledUseExpression: 'TOK.plate',
        sampledDeclarationExpression: sampledLiteralDeclarationExpression,
        sampledChannelValues: { r: 3, g: 6, b: 11, a: 85 },
        appliedCount: sampledLiteralDeclarationApplied,
        result: receiptSummary(sampledLiteralDeclarationResult?.receipt),
        activity: activitySignature(sampledLiteralDeclaration.activity),
      });
      familyCheck('stage-b-causal', 'P6 source-literal use-site cross-file identity refuses before allocation', crossFileTopologyApplied && hostileAccepted(hostileCrossFileTopology.attempt, hostileCrossFileTopology.activity), {
        mutationApplied: crossFileTopologyApplied,
        result: receiptSummary(hostileCrossFileResult?.receipt),
        activity: activitySignature(hostileCrossFileTopology.activity),
      });
      familyCheck('stage-b-causal', 'P6 source-literal use-site mismatched sourcePath refuses before allocation', sourcePathTopologyApplied && hostileAccepted(hostileSourcePathTopology.attempt, hostileSourcePathTopology.activity), {
        mutationApplied: sourcePathTopologyApplied,
        result: receiptSummary(hostileSourcePathResult?.receipt),
        activity: activitySignature(hostileSourcePathTopology.activity),
      });
      const canonicalGlowPixelsUnchanged = canonicalGlowRgba.length === colorAtlasRgba.length
        && canonicalGlowRgba.every((bytes, captureIndex) => {
          const baselineBytes = colorAtlasRgba[captureIndex];
          return baselineBytes !== undefined
            && bytes.length === baselineBytes.length
            && bytes.every((byte, byteIndex) => byte === baselineBytes[byteIndex]);
        });
      const canonicalGlowTraceUnchanged = activitySignature(acceptedCanonicalGlow.activity) === activitySignature(colorActivity);
      const fractionalCssExpected = 'rgba(12.25, 22.5, 32.75, 0.425)';
      const fractionalCssObserved = acceptedLiteralSchema.activity.paint.some(entry => (entry.name === 'setFillStyle' || entry.name === 'setStrokeStyle') && entry.args[0] === fractionalCssExpected);
      const fractionalAtlasPixelObserved = fractionalAtlasRgba.some(bytes => {
        for (let offset = 0; offset + 3 < bytes.length; offset += 4) {
          if (bytes[offset] === 12 && bytes[offset + 1] === 23 && bytes[offset + 2] === 33 && bytes[offset + 3] === 108) return true;
        }
        return false;
      });
      familyCheck('stage-b-causal', 'P6 accepted source-literal fractional channels, optional glow channels, and sourcePin/sampleId render', colorRendered
        && acceptedLiteralResult?.status === 'rendered'
        && !acceptedLiteralSchema.attempt.threw
        && literalExactPinCount > 0
        && literalSampleIdCount === literalExactPinCount
        && activityIsZero(acceptedLiteralSchema.activity) === false, {
        result: acceptedLiteralResult === undefined ? undefined : receiptSummary(acceptedLiteralResult.receipt),
        literalExactPinCount,
        literalSampleIdCount,
        activity: activitySignature(acceptedLiteralSchema.activity),
      });
      familyCheck('stage-b-causal', 'P6 fractional source RGB uses explicit half-up atlas bytes while geometry CSS retains raw values', colorRendered
        && acceptedLiteralResult?.status === 'rendered'
        && fractionalGeometryDrawableSeen
        && fractionalCssObserved
        && fractionalAtlasPixelObserved, {
        expectedCss: fractionalCssExpected,
        fractionalGeometryDrawableSeen,
        fractionalCssObserved,
        fractionalAtlasPixelObserved,
        expectedAtlasPixel: [12, 23, 33, 108],
      });
      familyCheck('stage-b-causal', 'P6 accepted canonical mappingSource id/index/path and resolved identity render', colorRendered
        && acceptedCanonicalMappingResult?.status === 'rendered'
        && !acceptedCanonicalMapping.attempt.threw
        && canonicalMappingCount > 0
        && activityIsZero(acceptedCanonicalMapping.activity) === false, {
        result: acceptedCanonicalMappingResult === undefined ? undefined : receiptSummary(acceptedCanonicalMappingResult.receipt),
        canonicalMappingCount,
        activity: activitySignature(acceptedCanonicalMapping.activity),
      });
      familyCheck('stage-b-causal', 'P6 accepted canonical glow 0.5 remains non-drawable and leaves trace and pixels unchanged', colorRendered
        && acceptedCanonicalGlowResult?.status === 'rendered'
        && canonicalGlowCount > 0
        && canonicalGlowTraceUnchanged
        && canonicalGlowPixelsUnchanged, {
        result: acceptedCanonicalGlowResult === undefined ? undefined : receiptSummary(acceptedCanonicalGlowResult.receipt),
        canonicalGlowCount,
        canonicalGlowTraceUnchanged,
        canonicalGlowPixelsUnchanged,
      });
      familyCheck('stage-b-causal', 'P6 hostile extra-key tint payload refuses before allocation after valid baseline acceptance', hostileAccepted(hostileExtra.attempt, hostileExtra.activity), { baseline: colorResult === undefined ? undefined : receiptSummary(colorResult.receipt), hostile: receiptSummary(completedResult(hostileExtra.attempt)?.receipt), activity: activitySignature(hostileExtra.activity) });
      familyCheck('stage-b-causal', 'P6 hostile accessor tint payload refuses before allocation after valid baseline acceptance', hostileAccepted(hostileAccessor.attempt, hostileAccessor.activity), { baseline: colorResult === undefined ? undefined : receiptSummary(colorResult.receipt), hostile: receiptSummary(completedResult(hostileAccessor.attempt)?.receipt), activity: activitySignature(hostileAccessor.activity) });
      familyCheck('stage-b-causal', 'P6 hostile prototype tint payload refuses before allocation after valid baseline acceptance', hostileAccepted(hostilePrototype.attempt, hostilePrototype.activity), { baseline: colorResult === undefined ? undefined : receiptSummary(colorResult.receipt), hostile: receiptSummary(completedResult(hostilePrototype.attempt)?.receipt), activity: activitySignature(hostilePrototype.activity) });
      familyCheck('stage-b-causal', 'P6 hostile sparse tint payload refuses before allocation after valid baseline acceptance', hostileAccepted(hostileSparse.attempt, hostileSparse.activity), { baseline: colorResult === undefined ? undefined : receiptSummary(colorResult.receipt), hostile: receiptSummary(completedResult(hostileSparse.attempt)?.receipt), activity: activitySignature(hostileSparse.activity) });
      familyCheck('stage-b-causal', 'P6 hostile symbol tint payload refuses before allocation after valid baseline acceptance', hostileAccepted(hostileSymbol.attempt, hostileSymbol.activity), { baseline: colorResult === undefined ? undefined : receiptSummary(colorResult.receipt), hostile: receiptSummary(completedResult(hostileSymbol.attempt)?.receipt), activity: activitySignature(hostileSymbol.activity) });
      familyCheck('stage-b-causal', 'P6 hostile proxy tint payload refuses before allocation after valid baseline acceptance', hostileAccepted(hostileProxy.attempt, hostileProxy.activity), { baseline: colorResult === undefined ? undefined : receiptSummary(colorResult.receipt), hostile: receiptSummary(completedResult(hostileProxy.attempt)?.receipt), activity: activitySignature(hostileProxy.activity) });
      familyCheck('stage-b-causal', 'P6 hostile string sourcePin refuses before allocation', stringSourcePinApplied && hostileAccepted(hostileStringSourcePin.attempt, hostileStringSourcePin.activity), { mutationApplied: stringSourcePinApplied, hostile: receiptSummary(completedResult(hostileStringSourcePin.attempt)?.receipt), activity: activitySignature(hostileStringSourcePin.activity) });
      familyCheck('stage-b-causal', 'P6 hostile full source-location sourcePin refuses before allocation', fullSourcePinApplied && hostileAccepted(hostileFullSourcePin.attempt, hostileFullSourcePin.activity), { mutationApplied: fullSourcePinApplied, hostile: receiptSummary(completedResult(hostileFullSourcePin.attempt)?.receipt), activity: activitySignature(hostileFullSourcePin.activity) });
      familyCheck('stage-b-causal', 'P6 declarationSource sourcePath drift with identical file and offsets refuses before allocation', declarationSourcePathDriftApplied && hostileAccepted(hostileDeclarationSourcePath.attempt, hostileDeclarationSourcePath.activity), { mutationApplied: declarationSourcePathDriftApplied, hostile: receiptSummary(completedResult(hostileDeclarationSourcePath.attempt)?.receipt), activity: activitySignature(hostileDeclarationSourcePath.activity) });
      familyCheck('stage-b-causal', 'P6 channel source sourcePath drift with identical file and offsets refuses before allocation', channelSourcePathDriftApplied && hostileAccepted(hostileChannelSourcePath.attempt, hostileChannelSourcePath.activity), { mutationApplied: channelSourcePathDriftApplied, hostile: receiptSummary(completedResult(hostileChannelSourcePath.attempt)?.receipt), activity: activitySignature(hostileChannelSourcePath.activity) });
      familyCheck('stage-b-causal', 'P6 channel keySource sourcePath drift with identical file and offsets refuses before allocation', channelKeySourcePathDriftApplied && hostileAccepted(hostileChannelKeySourcePath.attempt, hostileChannelKeySourcePath.activity), { mutationApplied: channelKeySourcePathDriftApplied, hostile: receiptSummary(completedResult(hostileChannelKeySourcePath.attempt)?.receipt), activity: activitySignature(hostileChannelKeySourcePath.activity) });
      familyCheck('stage-b-causal', 'P6 mappingSource present for direct requested/resolved identity refuses before allocation', directMappingApplied && hostileAccepted(hostileDirectCanonicalMapping.attempt, hostileDirectCanonicalMapping.activity), { mutationApplied: directMappingApplied, hostile: receiptSummary(completedResult(hostileDirectCanonicalMapping.attempt)?.receipt), activity: activitySignature(hostileDirectCanonicalMapping.activity) });
      familyCheck('stage-b-causal', 'P6 declarationSource that does not contain channel ranges refuses before allocation strengthening', declarationOffsetEscapeApplied && hostileAccepted(hostileDeclarationOffsetEscape.attempt, hostileDeclarationOffsetEscape.activity), { mutationApplied: declarationOffsetEscapeApplied, hostile: receiptSummary(completedResult(hostileDeclarationOffsetEscape.attempt)?.receipt), activity: activitySignature(hostileDeclarationOffsetEscape.activity) });
      familyCheck('stage-b-causal', 'P6 out-of-declaration channel source offsets refuse before allocation strengthening', channelOffsetEscapeApplied && hostileAccepted(hostileChannelOffsetEscape.attempt, hostileChannelOffsetEscape.activity), { mutationApplied: channelOffsetEscapeApplied, hostile: receiptSummary(completedResult(hostileChannelOffsetEscape.attempt)?.receipt), activity: activitySignature(hostileChannelOffsetEscape.activity) });
      familyCheck('stage-b-causal', 'P6 out-of-declaration channel keySource offsets refuse before allocation strengthening', keySourceOffsetEscapeApplied && hostileAccepted(hostileKeySourceOffsetEscape.attempt, hostileKeySourceOffsetEscape.activity), { mutationApplied: keySourceOffsetEscapeApplied, hostile: receiptSummary(completedResult(hostileKeySourceOffsetEscape.attempt)?.receipt), activity: activitySignature(hostileKeySourceOffsetEscape.activity) });
      familyCheck('stage-b-causal', 'P6 duplicate exact tint fact refuses before allocation strengthening', duplicateTintFactApplied && hostileAccepted(hostileDuplicateTintFact.attempt, hostileDuplicateTintFact.activity), { mutationApplied: duplicateTintFactApplied, hostile: receiptSummary(completedResult(hostileDuplicateTintFact.attempt)?.receipt), activity: activitySignature(hostileDuplicateTintFact.activity) });
      familyCheck('stage-b-causal', 'P6 tint fact reassigned across distinct geometry owners refuses before allocation strengthening', reassignedTintOwnerApplied && hostileAccepted(hostileReassignedTintOwner.attempt, hostileReassignedTintOwner.activity), { mutationApplied: reassignedTintOwnerApplied, hostile: receiptSummary(completedResult(hostileReassignedTintOwner.attempt)?.receipt), activity: activitySignature(hostileReassignedTintOwner.activity) });
      familyCheck('stage-b-causal', 'P6 duplicate slot with distinct tint fact refuses before allocation strengthening', duplicateTintSlotApplied && hostileAccepted(hostileDuplicateTintSlot.attempt, hostileDuplicateTintSlot.activity), { mutationApplied: duplicateTintSlotApplied, hostile: receiptSummary(completedResult(hostileDuplicateTintSlot.attempt)?.receipt), activity: activitySignature(hostileDuplicateTintSlot.activity) });
      const hostileSourceFractionalBoundary = hostileRender((_plan, layers) => {
        const tint = allTintRecords(layers).find(candidate => candidate.domain === 'source-literal-percent-alpha');
        const color = tint === undefined ? undefined : asRecord(tint.value);
        const channels = color === undefined ? undefined : asRecord(color.channels);
        if (color !== undefined && channels !== undefined) {
          color.r = 255.0001;
          const redEvidence = asRecord(channels.r);
          if (redEvidence !== undefined) redEvidence.value = 255.0001;
        }
      });
      const hostileSourceGlowBoundary = hostileRender((_plan, layers) => {
        const tint = allTintRecords(layers).find(candidate => candidate.domain === 'source-literal-percent-alpha');
        const color = tint === undefined ? undefined : asRecord(tint.value);
        const channels = color === undefined ? undefined : asRecord(color.channels);
        const redEvidence = channels === undefined ? undefined : asRecord(channels.r);
        if (color !== undefined && channels !== undefined && redEvidence !== undefined) {
          color.glow = 1.0001;
          channels.glow = { ...redEvidence, expression: '1.0001', value: 1.0001 };
        }
      });
      const hostileCanonicalBaseBoundary = hostileRender((_plan, layers) => {
        const tint = allTintRecords(layers).find(candidate => candidate.domain === 'canonical-xml-byte-alpha');
        const color = tint === undefined ? undefined : asRecord(tint.value);
        const baseSource = color === undefined ? undefined : asRecord(color.baseSource);
        if (baseSource !== undefined) baseSource.index = 224;
      });
      const hostileCanonicalFractionalChannel = hostileRender((_plan, layers) => {
        const tint = allTintRecords(layers).find(candidate => candidate.domain === 'canonical-xml-byte-alpha');
        const color = tint === undefined ? undefined : asRecord(tint.value);
        if (color !== undefined) color.r = 10.5;
      });
      const hostileCanonicalGlowBoundary = hostileRender((_plan, layers) => {
        const tint = allTintRecords(layers).find(candidate => candidate.domain === 'canonical-xml-byte-alpha');
        const color = tint === undefined ? undefined : asRecord(tint.value);
        if (color !== undefined) color.glow = 1.0001;
      });
      const hostileCanonicalMappingBoundary = hostileRender((_plan, layers) => {
        const tint = allTintRecords(layers).find(candidate => candidate.domain === 'canonical-xml-byte-alpha');
        const color = tint === undefined ? undefined : asRecord(tint.value);
        if (color !== undefined) {
          color.requestedId = 'paint_mapping_0';
          color.mappingSource = { id: 'paint_mapping_0', index: 804, path: X4_UI_CORPUS_9_00_COLOR_CONTRACT.xml.relativePath };
        }
      });
      const hostileCanonicalMappingExtra = hostileRender((_plan, layers) => {
        const tint = allTintRecords(layers).find(candidate => candidate.domain === 'canonical-xml-byte-alpha');
        const color = tint === undefined ? undefined : asRecord(tint.value);
        if (color !== undefined) {
          color.requestedId = 'paint_mapping_0';
          color.mappingSource = { id: 'paint_mapping_0', index: 0, path: X4_UI_CORPUS_9_00_COLOR_CONTRACT.xml.relativePath, ref: 'paint_color_0' };
        }
      });
      const hostileCanonicalIdentityMismatch = hostileRender((_plan, layers) => {
        const tint = allTintRecords(layers).find(candidate => candidate.domain === 'canonical-xml-byte-alpha');
        const color = tint === undefined ? undefined : asRecord(tint.value);
        if (color !== undefined && typeof color.resolvedBaseId === 'string') {
          color.requestedId = `${color.resolvedBaseId}-mismatch`;
          delete color.mappingSource;
        }
      });
      const hostileSourceGlowMissing = hostileRender((_plan, layers) => {
        const tint = allTintRecords(layers).find(candidate => candidate.domain === 'source-literal-percent-alpha');
        const color = tint === undefined ? undefined : asRecord(tint.value);
        const channels = color === undefined ? undefined : asRecord(color.channels);
        if (color !== undefined && channels !== undefined) {
          color.glow = 0.5;
          delete channels.glow;
        }
      });
      familyCheck('stage-b-causal', 'P6 hostile source fractional channel boundary refuses before allocation', hostileAccepted(hostileSourceFractionalBoundary.attempt, hostileSourceFractionalBoundary.activity), { hostile: receiptSummary(completedResult(hostileSourceFractionalBoundary.attempt)?.receipt), activity: activitySignature(hostileSourceFractionalBoundary.activity) });
      familyCheck('stage-b-causal', 'P6 hostile source optional glow boundary refuses before allocation', hostileAccepted(hostileSourceGlowBoundary.attempt, hostileSourceGlowBoundary.activity), { hostile: receiptSummary(completedResult(hostileSourceGlowBoundary.attempt)?.receipt), activity: activitySignature(hostileSourceGlowBoundary.activity) });
      familyCheck('stage-b-causal', 'P6 hostile canonical baseSource index 224 refuses before allocation', hostileAccepted(hostileCanonicalBaseBoundary.attempt, hostileCanonicalBaseBoundary.activity), { hostile: receiptSummary(completedResult(hostileCanonicalBaseBoundary.attempt)?.receipt), activity: activitySignature(hostileCanonicalBaseBoundary.activity) });
      familyCheck('stage-b-causal', 'P6 hostile canonical fractional RGB channel refuses before allocation', hostileAccepted(hostileCanonicalFractionalChannel.attempt, hostileCanonicalFractionalChannel.activity), { hostile: receiptSummary(completedResult(hostileCanonicalFractionalChannel.attempt)?.receipt), activity: activitySignature(hostileCanonicalFractionalChannel.activity) });
      familyCheck('stage-b-causal', 'P6 hostile canonical glow boundary refuses before allocation', hostileAccepted(hostileCanonicalGlowBoundary.attempt, hostileCanonicalGlowBoundary.activity), { hostile: receiptSummary(completedResult(hostileCanonicalGlowBoundary.attempt)?.receipt), activity: activitySignature(hostileCanonicalGlowBoundary.activity) });
      familyCheck('stage-b-causal', 'P6 hostile canonical mappingSource index 804 refuses before allocation', hostileAccepted(hostileCanonicalMappingBoundary.attempt, hostileCanonicalMappingBoundary.activity), { hostile: receiptSummary(completedResult(hostileCanonicalMappingBoundary.attempt)?.receipt), activity: activitySignature(hostileCanonicalMappingBoundary.activity) });
      familyCheck('stage-b-causal', 'P6 hostile canonical mappingSource ref extra key refuses before allocation', hostileAccepted(hostileCanonicalMappingExtra.attempt, hostileCanonicalMappingExtra.activity), { hostile: receiptSummary(completedResult(hostileCanonicalMappingExtra.attempt)?.receipt), activity: activitySignature(hostileCanonicalMappingExtra.activity) });
      familyCheck('stage-b-causal', 'P6 hostile canonical requested/resolved identity mismatch refuses before allocation', hostileAccepted(hostileCanonicalIdentityMismatch.attempt, hostileCanonicalIdentityMismatch.activity), { hostile: receiptSummary(completedResult(hostileCanonicalIdentityMismatch.attempt)?.receipt), activity: activitySignature(hostileCanonicalIdentityMismatch.activity) });
      familyCheck('stage-b-causal', 'P6 hostile source glow without matching channels.glow refuses before allocation', hostileAccepted(hostileSourceGlowMissing.attempt, hostileSourceGlowMissing.activity), { hostile: receiptSummary(completedResult(hostileSourceGlowMissing.attempt)?.receipt), activity: activitySignature(hostileSourceGlowMissing.activity) });
      const callbackPlan = forgedResult(acceptedColorPaint, () => undefined);
      const callbackCommand = commandList(callbackPlan.plan).find(command => Array.isArray(command.basePreviewTints));
      const callbackTints = callbackCommand?.basePreviewTints as JsonRecord[] | undefined;
      const callbackValue = callbackTints?.[0] === undefined ? undefined : asRecord(callbackTints[0].value);
      const callbackOriginalRed = callbackValue?.r;
      let callbackReached = false;
      let callbackChanged = false;
      const callbackActivity = emptyActivityLedger();
      const callbackAttempt = attemptRender(callbackPlan, corpus, makeObservedFactory(callbackActivity, {
        afterFactory: () => {
          if (callbackReached || callbackValue === undefined || typeof callbackOriginalRed !== 'number') return;
          callbackReached = true;
          callbackValue.r = callbackOriginalRed === 0 ? 1 : callbackOriginalRed - 1;
          callbackChanged = callbackValue.r !== callbackOriginalRed;
        },
      }));
      const callbackResult = completedResult(callbackAttempt);
      familyCheck('stage-b-causal', 'P6 callback mutation still refuses after detached color validation with no returned surface', colorRendered
        && callbackReached
        && callbackChanged
        && callbackResult?.status === 'refused'
        && callbackResult.receipt.refusal.code === 'post-validation-mutation'
        && refusalBoundaryIsComplete(callbackResult), {
        baseline: colorResult === undefined ? undefined : receiptSummary(colorResult.receipt),
        callback: receiptSummary(callbackResult?.receipt),
        callbackReached,
        callbackChanged,
        activity: activitySignature(callbackActivity),
      });
    }
    const boundedSource = boundedCompositionSourceFixture();
    const boundedSourceFile = boundedSource.bundle?.sourceFiles.find(file => file.path === 'ui/bounded.lua');
    const boundedCatalog = boundedSourceFile === undefined ? undefined : createX4UiLayoutTargetCatalog(boundedSourceFile.callModel);
    const boundedTarget = boundedCatalog?.targets.find(candidate => candidate.kind === 'top-level');
    const boundedSelection = boundedSourceFile !== undefined && boundedCatalog !== undefined && boundedTarget !== undefined
      ? {
        sourceIndex: boundedSourceFile.index,
        path: boundedSourceFile.path,
        sourceIdentity: boundedCatalog.sourceIdentity,
        target: { ...boundedTarget, id: boundedTarget.id },
      }
      : undefined;
    const boundedPipeline = boundedSelection === undefined ? undefined : projectX4UiPreviewPipeline({
      source: boundedSource,
      corpus,
      colorEvidence,
      profile: {
        id: 'canvas-bounded-composition-profile',
        provenance: 'B119 bounded source-composition causal renderer fixture',
        truthGrade: 'supplied',
        source: boundedSelection.sourceIdentity,
        drawable: { width: 100, height: 80 },
        uiScale: 1,
        minTextHeight: 10,
      },
      selection: boundedSelection,
    });
    const boundedScene = boundedPipeline?.scene !== undefined
      && (boundedPipeline.scene.status === 'projected' || boundedPipeline.scene.status === 'partial')
      ? boundedPipeline.scene.scene
      : undefined;
    const boundedNoKeepOutResult = boundedScene === undefined
      ? undefined
      : projectX4UiPaintPlan({ scene: boundedScene, corpus, previewAuthority: boundedPipeline! });
    const boundedKeepOutEntry = getBuiltInKeepOut(KEEP_OUT_IDS.conversationBackRow);
    const boundedKeepOutProjection = boundedKeepOutEntry === undefined ? undefined : projectBuiltInKeepOut(KEEP_OUT_IDS.conversationBackRow, { width: 100, height: 80 });
    const boundedCockpitResult = boundedScene === undefined || boundedKeepOutEntry === undefined || boundedKeepOutProjection === undefined
      ? undefined
      : projectX4UiPaintPlan({
        scene: boundedScene,
        corpus,
        previewAuthority: boundedPipeline!,
        keepOuts: [{ context: KEEP_OUT_PRESET_IDS.cockpitConversation, entry: boundedKeepOutEntry, projection: boundedKeepOutProjection }],
      });
    const boundedNoKeepOut = boundedNoKeepOutResult !== undefined && boundedNoKeepOutResult.status !== 'refused' ? boundedNoKeepOutResult : undefined;
    const boundedCockpit = boundedCockpitResult !== undefined && boundedCockpitResult.status !== 'refused' ? boundedCockpitResult : undefined;
    const boundedActiveTable = boundedScene?.tables.find(table => table.source.start.offset === boundedScene.tables[0]?.source.start.offset);
    const boundedEmptyTable = boundedScene?.tables.find(table => table.source.start.offset === boundedScene.tables[1]?.source.start.offset);
    const boundedActiveCommand = boundedNoKeepOut === undefined || boundedActiveTable === undefined ? undefined : commandList(boundedNoKeepOut.plan).find(command => command.kind === 'node-geometry' && command.nodeId === boundedActiveTable.id);
    const boundedEmptyCommand = boundedNoKeepOut === undefined || boundedEmptyTable === undefined ? undefined : commandList(boundedNoKeepOut.plan).find(command => command.kind === 'node-geometry' && command.nodeId === boundedEmptyTable.id);
    const boundedCommands = boundedNoKeepOut === undefined ? [] : commandList(boundedNoKeepOut.plan);
    const boundedUnavailableNodeCommands = boundedCommands.filter(command => command.kind === 'unavailable-node');
    const boundedButtonCommand = boundedCommands.find(command => command.kind === 'node-geometry'
      && typeof command.nodeId === 'string'
      && command.nodeId.includes(':button')
      && Array.isArray(command.basePreviewTints)
      && command.basePreviewTints.some(tint => String(asRecord(tint)?.slot) === 'widget-border'));
    const boundedButtonBorderTint = boundedButtonCommand === undefined || !Array.isArray(boundedButtonCommand.basePreviewTints)
      ? undefined
      : boundedButtonCommand.basePreviewTints.find(tint => String(asRecord(tint)?.slot) === 'widget-border');
    const boundedButtonBorderValue = boundedButtonBorderTint === undefined ? undefined : asRecord(asRecord(boundedButtonBorderTint)?.value);
    const boundedButtonBorderStyle = boundedButtonBorderValue !== undefined
      && typeof boundedButtonBorderValue.r === 'number'
      && typeof boundedButtonBorderValue.g === 'number'
      && typeof boundedButtonBorderValue.b === 'number'
      && typeof boundedButtonBorderValue.a === 'number'
      ? `rgba(${String(boundedButtonBorderValue.r)}, ${String(boundedButtonBorderValue.g)}, ${String(boundedButtonBorderValue.b)}, ${String(boundedButtonBorderValue.a / 100)})`
      : undefined;
    const boundedActiveRect = boundedActiveCommand === undefined ? undefined : rasterRect(boundedActiveCommand.geometry);
    const boundedEmptyRect = boundedEmptyCommand === undefined ? undefined : rasterRect(boundedEmptyCommand.geometry);
    const boundedNoKeepOutOutput: RasterOutput = {};
    const boundedNoKeepOutTrace: TraceEntry[] = [];
    const boundedCockpitOutput: RasterOutput = {};
    const boundedCockpitTrace: TraceEntry[] = [];
    const boundedNoKeepOutAttempt = boundedNoKeepOut === undefined
      ? undefined
      : attemptRenderWithOptions(boundedNoKeepOut, corpus, { surfaceFactory: makeRasterFactory(boundedNoKeepOutTrace, boundedNoKeepOutOutput), presentation: 'source-composition' });
    const boundedCockpitAttempt = boundedCockpit === undefined
      ? undefined
      : attemptRenderWithOptions(boundedCockpit, corpus, { surfaceFactory: makeRasterFactory(boundedCockpitTrace, boundedCockpitOutput), presentation: 'source-composition' });
    const boundedNoKeepOutRendered = completedResult(boundedNoKeepOutAttempt)?.status === 'rendered';
    const boundedCockpitRendered = completedResult(boundedCockpitAttempt)?.status === 'rendered';
    const boundedSourceDiagnosticStyles = new Set<string>([
      X4_UI_CANVAS_DIAGNOSTIC_PALETTE.geometry,
      X4_UI_CANVAS_DIAGNOSTIC_PALETTE.selection,
      X4_UI_CANVAS_DIAGNOSTIC_PALETTE.gap,
      X4_UI_CANVAS_DIAGNOSTIC_PALETTE.unsupported,
      X4_UI_CANVAS_DIAGNOSTIC_PALETTE.unavailable,
      X4_UI_CANVAS_DIAGNOSTIC_PALETTE.emptyClip,
      X4_UI_CANVAS_DIAGNOSTIC_PALETTE.invalidRaster,
    ]);
    const boundedSourceDiagnosticPaint = boundedNoKeepOutTrace.some(entry =>
      (entry.name === 'setFillStyle' || entry.name === 'setStrokeStyle') && boundedSourceDiagnosticStyles.has(String(entry.args[0])));
    const boundedUnavailableGrayStroke = boundedNoKeepOutTrace.some(entry => entry.name === 'setStrokeStyle' && entry.args[0] === X4_UI_CANVAS_DIAGNOSTIC_PALETTE.unavailable)
      && boundedNoKeepOutTrace.some(entry => entry.name === 'stroke');
    const boundedUnavailableGrayFill = boundedNoKeepOutTrace.some(entry => entry.name === 'setFillStyle' && entry.args[0] === X4_UI_CANVAS_DIAGNOSTIC_PALETTE.unavailable);
    const boundedUnavailableBoundaryIndicator = boundedUnavailableNodeCommands.some(command => {
      const visible = effectiveCommandRect(command, 'geometry') ?? rasterRect(command.clipRect);
      return visible !== undefined && traceHasDiagnosticBoundary(boundedNoKeepOutTrace, X4_UI_CANVAS_DIAGNOSTIC_PALETTE.unavailable, visible);
    });
    const boundedButtonBorderStroke = boundedButtonBorderStyle !== undefined
      && boundedNoKeepOutTrace.some(entry => entry.name === 'setStrokeStyle' && entry.args[0] === boundedButtonBorderStyle)
      && boundedNoKeepOutTrace.some(entry => entry.name === 'stroke');
    const boundedActivePoint = boundedActiveRect === undefined
      ? undefined
      : { x: Math.floor(boundedActiveRect.x + boundedActiveRect.width - 1), y: Math.floor(boundedActiveRect.y + boundedActiveRect.height - 1) };
    const boundedEmptyPoint = boundedEmptyRect === undefined
      ? undefined
      : { x: Math.floor(boundedEmptyRect.x + boundedEmptyRect.width - 1), y: Math.floor(boundedEmptyRect.y + boundedEmptyRect.height - 1) };
    const boundedActivePixel = boundedActivePoint === undefined ? undefined : rasterPixel(boundedNoKeepOutOutput, boundedActivePoint.x, boundedActivePoint.y);
    const boundedEmptyPixel = boundedEmptyPoint === undefined ? undefined : rasterPixel(boundedNoKeepOutOutput, boundedEmptyPoint.x, boundedEmptyPoint.y);
    const boundedCockpitActivePixel = boundedActivePoint === undefined ? undefined : rasterPixel(boundedCockpitOutput, boundedActivePoint.x, boundedActivePoint.y);
    const boundedActiveFillTrace = boundedActiveRect !== undefined && boundedNoKeepOutTrace.some(entry => entry.name === 'fillRect' && JSON.stringify(entry.args) === JSON.stringify([boundedActiveRect.x, boundedActiveRect.y, boundedActiveRect.width, boundedActiveRect.height]));
    const boundedEmptyFillTrace = boundedEmptyRect !== undefined && boundedNoKeepOutTrace.some(entry => entry.name === 'fillRect' && JSON.stringify(entry.args) === JSON.stringify([boundedEmptyRect.x, boundedEmptyRect.y, boundedEmptyRect.width, boundedEmptyRect.height]));
    const boundedEmptyHasFillTint = Array.isArray(boundedEmptyCommand?.basePreviewTints)
      && boundedEmptyCommand.basePreviewTints.some(tint => ['table-background', 'cell-background', 'widget-background'].includes(String(asRecord(tint)?.slot)));
    const boundedKeepOutCommand = boundedCockpit?.plan.keepOuts.find(command => command.entryId === KEEP_OUT_IDS.conversationBackRow);
    const boundedKeepOutTrace = boundedCockpitTrace.filter(entry => entry.role === 'composite');
    const boundedKeepOutExpectedTrace = boundedKeepOutCommand === undefined ? [] : expectedCommandTrace(boundedKeepOutCommand as unknown as JsonRecord, boundedCockpit.plan, corpus);
    const boundedGuideStart = boundedKeepOutTrace.findIndex(entry => entry.name === 'setStrokeStyle' && entry.args[0] === X4_UI_CANVAS_DIAGNOSTIC_PALETTE.keepOut);
    const boundedGuideOperations = boundedGuideStart < 0 ? [] : boundedKeepOutTrace.slice(boundedGuideStart);
    const boundedKeepOutOnlyStrokes = boundedGuideOperations.length > 0
      && boundedGuideOperations.every(entry => ['setStrokeStyle', 'beginPath', 'moveTo', 'lineTo', 'closePath', 'stroke'].includes(entry.name))
      && boundedGuideOperations.some(entry => entry.name === 'stroke');
    const boundedSourceTraceEquivalent = boundedGuideStart >= 0
      && traceEquals(boundedNoKeepOutTrace.filter(entry => entry.role === 'composite'), boundedKeepOutTrace.slice(0, boundedGuideStart));
    const boundedGuideCoversPixel = (x: number, y: number): boolean => {
      const geometry = boundedKeepOutCommand?.geometry;
      if (geometry?.kind === 'horizontal-guide' && typeof geometry.y === 'number') return Math.abs(y - geometry.y) <= 1;
      if (geometry?.kind === 'vertical-guide' && typeof geometry.x === 'number') return Math.abs(x - geometry.x) <= 1;
      return false;
    };
    const boundedRasterOutsideGuideMatches = (() => {
      const left = boundedNoKeepOutOutput.state;
      const right = boundedCockpitOutput.state;
      if (left === undefined || right === undefined || left.width !== right.width || left.height !== right.height || left.pixels.length !== right.pixels.length) return false;
      for (let y = 0; y < left.height; y += 1) {
        for (let x = 0; x < left.width; x += 1) {
          if (boundedGuideCoversPixel(x, y)) continue;
          const offset = (y * left.width + x) * 4;
          for (let channel = 0; channel < 4; channel += 1) {
            if (left.pixels[offset + channel] !== right.pixels[offset + channel]) return false;
          }
        }
      }
      return true;
    })();
    familyCheck('stage-b-causal', 'B119 bounded source composition preserves explicit table bounds, suppresses empty-ID fills, and keeps cockpit guides additive', boundedNoKeepOutRendered
      && boundedCockpitRendered
      && boundedActiveRect?.x === 8
      && boundedActiveRect.y === 4
      && boundedActiveRect.width === 24
      && boundedEmptyRect?.x === 50
      && boundedEmptyRect.y === 4
      && boundedEmptyRect.width === 18
      && boundedActiveFillTrace
      && boundedActivePixel !== undefined
      && boundedActivePixel[3] > 0
      && !boundedEmptyHasFillTint
      && !boundedEmptyFillTrace
      && boundedEmptyPixel !== undefined
      && boundedEmptyPixel[3] === 0
      && boundedCockpitActivePixel !== undefined
      && JSON.stringify(boundedCockpitActivePixel) === JSON.stringify(boundedActivePixel)
      && boundedSourceTraceEquivalent
      && boundedRasterOutsideGuideMatches
      && boundedKeepOutCommand?.status === 'projected'
      && traceContainsSequence(boundedKeepOutTrace, boundedKeepOutExpectedTrace)
      && boundedKeepOutOnlyStrokes, {
      previewStatus: boundedPipeline?.status,
      sceneStatus: boundedPipeline?.scene?.status,
      noKeepOutPaintStatus: boundedNoKeepOutResult?.status,
      cockpitPaintStatus: boundedCockpitResult?.status,
      tables: {
        active: boundedActiveRect,
        empty: boundedEmptyRect,
      },
      commands: {
        activeHasFill: boundedActiveFillTrace,
        emptyHasFill: boundedEmptyFillTrace,
        emptyHasFillTint: boundedEmptyHasFillTint,
      },
      pixels: {
        active: boundedActivePixel,
        empty: boundedEmptyPixel,
        cockpitActive: boundedCockpitActivePixel,
      },
      sourceTraceEquivalent: boundedSourceTraceEquivalent,
      rasterOutsideGuideMatches: boundedRasterOutsideGuideMatches,
      keepOut: {
        status: boundedKeepOutCommand?.status,
        expected: boundedKeepOutExpectedTrace,
        observed: boundedKeepOutTrace,
        onlyStrokes: boundedKeepOutOnlyStrokes,
      },
    });
    familyCheck('stage-b-causal', 'B119 bounded source composition emits unavailable-node boundary strokes while retaining an explicitly sourced button border', boundedNoKeepOutRendered
      && boundedUnavailableNodeCommands.length > 0
      && boundedUnavailableGrayStroke
      && boundedUnavailableBoundaryIndicator
      && boundedUnavailableGrayFill === false
      && boundedSourceDiagnosticPaint
      && boundedButtonCommand !== undefined
      && boundedButtonBorderStroke, {
      unavailableNodeCount: boundedUnavailableNodeCommands.length,
      unavailableNodeOwners: boundedUnavailableNodeCommands.map(command => command.nodeId),
      unavailableDiagnosticColor: X4_UI_CANVAS_DIAGNOSTIC_PALETTE.unavailable,
      unavailableGrayStroke: boundedUnavailableGrayStroke,
      unavailableBoundaryIndicator: boundedUnavailableBoundaryIndicator,
      unavailableGrayFill: boundedUnavailableGrayFill,
      sourceDiagnosticPaint: boundedSourceDiagnosticPaint,
      buttonCommand: boundedButtonCommand === undefined ? undefined : { id: boundedButtonCommand.id, nodeId: boundedButtonCommand.nodeId, geometry: boundedButtonCommand.geometry },
      buttonBorderTint: boundedButtonBorderTint,
      buttonBorderStyle: boundedButtonBorderStyle,
      buttonBorderStroke: boundedButtonBorderStroke,
      trace: boundedNoKeepOutTrace.filter(entry => entry.name === 'setFillStyle' || entry.name === 'setStrokeStyle' || entry.name === 'stroke'),
    });
  } catch (error) {
    familyCheck('stage-b-causal', 'loader-issued color evidence reaches top-level Preview and exact public Paint owner census', false, { error: error instanceof Error ? error.message : String(error) });
  }
  const viewport = { width: 100, height: 80 };
  const baselinePlanJson = JSON.stringify(paint.plan);
  const regularBytes = Array.from(corpus.fonts.regular.atlas.alphaBytes);
  const boldBytes = Array.from(corpus.fonts.bold.atlas.alphaBytes);

  const firstFactoryTraces: TraceEntry[] = [];
  const firstResult = renderX4UiPaintPlanToCanvas(paint, corpus, { surfaceFactory: makeFactory(firstFactoryTraces) });
  const firstReceipt = firstResult.receipt;
  const firstCompositeTrace = firstFactoryTraces.filter(entry => entry.role === 'composite');
  const expectedFirstCompositeTrace = CANONICAL_COMPOSITE_TRACE;
  const rawFactoryTrace: TraceEntry[] = [];
  const rawAttempt = attemptRender(paint, corpus, makeFactory(rawFactoryTrace));
  const rawResult = completedResult(rawAttempt);
  const rawCompositeTrace = rawFactoryTrace.filter(entry => entry.role === 'composite');
  const rawOrderVector = commandList(paint.plan).map(command => Number(command.order));
  const rawCommandCounts = paint.plan.layers.map(layer => ({ kind: layer.kind, count: layer.commands.length }));
  const rawIssuedIds = commandList(paint.plan).map(command => command.id);
  const rawOrdersAreFlattened = rawOrderVector.every((order, index) => order === index);
  const rawRefusalCode = rawResult?.status === 'refused' ? rawResult.receipt.refusal.code : undefined;
  familyCheck(
    'batch-6d-causal',
    'raw paint result renders directly through strict Canvas with exact order and trace',
    !rawAttempt.threw
      && rawResult?.status === 'rendered'
      && rawResult.receipt.status === 'rendered'
      && rawResult.receipt.commandCount === rawOrderVector.length
      && rawOrdersAreFlattened
      && JSON.stringify(rawResult.receipt.commandIds) === JSON.stringify(rawIssuedIds)
      && traceEquals(rawCompositeTrace, expectedFirstCompositeTrace),
    {
      threw: rawAttempt.threw,
      validatorExceptions: rawAttempt.threw ? 1 : 0,
      renderStatus: rawResult?.status,
      commandCount: rawOrderVector.length,
      familyCounts: rawCommandCounts,
      rawOrdersAreFlattened,
      rawOrderVector,
      refusalCode: rawRefusalCode,
      rawTraceOperations: rawCompositeTrace.length,
      expectedTraceOperations: expectedFirstCompositeTrace.length,
      activity: {
        factory: rawFactoryTrace.filter(entry => entry.name === 'factory').length,
        operations: rawFactoryTrace.length,
      },
    },
  );
  const manualCalibration = calibrateKeepOutPolygon({
    stableId: 'canvas-manual-polygon-1',
    context: 'canvas-manual-context',
    sourceNote: 'Canvas renderer manual calibration authority selftest.',
    screenshotHash: `sha256:${'d'.repeat(64)}`,
    profile: 'canvas-screenshot-profile',
    drawableBounds: { left: 10, top: 20, width: 1000, height: 500 },
    points: [{ x: 10, y: 20 }, { x: 510, y: 20 }, { x: 10, y: 270 }],
  });
  const manualEntry = manualCalibration.status === 'success' ? manualCalibration.entry : undefined;
  const manualProjection = manualEntry === undefined ? undefined : projectKeepOut(manualEntry, { width: 100, height: 80 });
  let manualPaintSeamReached = false;
  let manualPaintThrew = false;
  let manualPaint: X4UiPaintPlanResult | undefined;
  try {
    manualPaintSeamReached = true;
    manualPaint = fixture.preview.scene === undefined || manualEntry === undefined || manualProjection === undefined
      ? undefined
      : projectX4UiPaintPlan({
        scene: fixture.preview.scene,
        corpus,
        previewAuthority: fixture.preview,
        keepOuts: [{ context: manualEntry.context, entry: manualEntry, projection: manualProjection }],
      });
  } catch {
    manualPaintThrew = true;
  }
  const manualTrace: TraceEntry[] = [];
  let manualCanvasSeamReached = false;
  let manualCanvasAttempt: RenderAttempt | undefined;
  if (manualPaint !== undefined) {
    manualCanvasSeamReached = true;
    manualCanvasAttempt = attemptRender(manualPaint, corpus, makeFactory(manualTrace));
  }
  const manualCanvasResult = completedResult(manualCanvasAttempt);
  const manualCommand = manualPaint?.status !== 'refused' ? manualPaint?.plan.keepOuts[0] : undefined;
  const manualExpectedTrace = manualPaint?.status !== 'refused' ? expectedCompositeTrace(manualPaint.plan, corpus) : [];
  const manualPolygonTrace = [
    traceEntry('composite', 'setStrokeStyle', X4_UI_CANVAS_DIAGNOSTIC_PALETTE.keepOut),
    traceEntry('composite', 'beginPath'),
    traceEntry('composite', 'moveTo', 0, 0),
    traceEntry('composite', 'lineTo', 50, 0),
    traceEntry('composite', 'lineTo', 0, 40),
    traceEntry('composite', 'closePath'),
    traceEntry('composite', 'stroke'),
  ];
  familyCheck(
    'batch-6d-causal',
    'causal valid manual calibration reaches Canvas with the exact polygon trace',
    manualCalibration.status === 'success'
      && manualEntry !== undefined
      && manualProjection?.status === 'projected'
      && manualPaintSeamReached
      && !manualPaintThrew
      && manualPaint?.status !== 'refused'
      && manualCanvasSeamReached
      && manualCanvasAttempt?.threw === false
      && manualCanvasResult?.status === 'rendered'
      && manualCommand?.entryId === 'canvas-manual-polygon-1'
      && manualCommand.context === 'canvas-manual-context'
      && manualCommand.status === 'projected'
      && manualCommand.evidenceGrade === 'calibrated'
      && manualCommand.advisoryOnly === true
      && manualCommand.gameVerification === NOT_VERIFIED_IN_GAME
      && manualCommand.geometry?.kind === 'polygon'
      && traceEquals(manualTrace.filter(entry => entry.role === 'composite'), manualExpectedTrace)
      && traceContainsSequence(manualTrace.filter(entry => entry.role === 'composite'), manualPolygonTrace),
    {
      fixtureReady: fixture.paint.plan.logicalDrawable.width === 100 && fixture.paint.plan.logicalDrawable.height === 80,
      paintSeamReached: manualPaintSeamReached,
      canvasSeamReached: manualCanvasSeamReached,
      threw: manualPaintThrew || manualCanvasAttempt?.threw === true,
      expected: { paint: 'projected-or-partial', canvas: 'rendered', polygonTrace: manualPolygonTrace },
      observed: {
        calibration: manualCalibration.status,
        projection: manualProjection?.status,
        paint: manualPaint?.status,
        paintRefusal: manualPaint?.status === 'refused' ? manualPaint.refusal : undefined,
        canvas: manualCanvasResult?.status,
        canvasRefusal: manualCanvasResult?.status === 'refused' ? manualCanvasResult.receipt.refusal : undefined,
        command: manualCommand,
        traceOperations: manualTrace.filter(entry => entry.role === 'composite').length,
        expectedTraceOperations: manualExpectedTrace.length,
        firstTraceDifference: firstTraceDifference(manualExpectedTrace, manualTrace.filter(entry => entry.role === 'composite')),
      },
    },
  );
  const manualProjectedWithReason = manualPaint !== undefined && manualPaint.status !== 'refused'
    ? forgedResult(manualPaint, (_plan, layers) => {
      const command = layers[3]?.commands.find(candidate => candidate.entryId === 'canvas-manual-polygon-1');
      if (command !== undefined) command.reason = 'injected-reason';
    })
    : undefined;
  const manualProjectedWithReasonAttempt = manualProjectedWithReason === undefined
    ? undefined
    : attemptRender(manualProjectedWithReason, corpus, makeFactory([]));
  const manualProjectedWithReasonResult = completedResult(manualProjectedWithReasonAttempt);
  familyCheck(
    'batch-6d-causal',
    'causal projected manual keep-out reason injection refuses before Canvas paint',
    manualProjectedWithReason !== undefined
      && manualProjectedWithReasonAttempt?.threw === false
      && manualProjectedWithReasonResult?.status === 'refused'
      && manualProjectedWithReasonResult.receipt.refusal.code === 'invalid-keepout'
      && refusalBoundaryIsComplete(manualProjectedWithReasonResult),
    {
      fixtureReady: manualProjectedWithReason !== undefined,
      seamReached: manualProjectedWithReasonAttempt !== undefined,
      threw: manualProjectedWithReasonAttempt?.threw === true,
      expected: { status: 'refused', code: 'invalid-keepout', reason: 'projected commands must omit reason' },
      observed: manualProjectedWithReasonResult?.status === 'refused'
        ? { status: manualProjectedWithReasonResult.status, refusal: manualProjectedWithReasonResult.receipt.refusal }
      : { status: manualProjectedWithReasonResult?.status },
    },
  );
  const productionProjectedWithReason = forgedResult(paint, (_plan, layers) => {
    const command = layers[3]?.commands.find(candidate => candidate.entryId === KEEP_OUT_IDS.conversationBackRow);
    if (command !== undefined) command.reason = 'injected-reason';
  });
  const productionProjectedWithReasonAttempt = attemptRender(productionProjectedWithReason, corpus, makeFactory([]));
  const productionProjectedWithReasonResult = completedResult(productionProjectedWithReasonAttempt);
  familyCheck(
    'batch-6d-causal',
    'causal projected production keep-out reason injection refuses before Canvas paint',
    productionProjectedWithReasonAttempt.threw === false
      && productionProjectedWithReasonResult?.status === 'refused'
      && productionProjectedWithReasonResult.receipt.refusal.code === 'invalid-keepout'
      && refusalBoundaryIsComplete(productionProjectedWithReasonResult),
    {
      fixtureReady: paint.plan.keepOuts.some(command => command.entryId === KEEP_OUT_IDS.conversationBackRow && command.status === 'projected'),
      seamReached: true,
      threw: productionProjectedWithReasonAttempt.threw,
      expected: { status: 'refused', code: 'invalid-keepout', reason: 'projected commands must omit reason' },
      observed: productionProjectedWithReasonResult?.status === 'refused'
        ? { status: productionProjectedWithReasonResult.status, refusal: productionProjectedWithReasonResult.receipt.refusal }
        : { status: productionProjectedWithReasonResult?.status },
    },
  );
  const unavailableReasonOmitted = forgedResult(paint, (_plan, layers) => {
    const command = layers[3]?.commands.find(candidate => candidate.entryId === KEEP_OUT_IDS.missionMessagesTicker);
    if (command !== undefined) Reflect.deleteProperty(command, 'reason');
  });
  const unavailableReasonOmittedAttempt = attemptRender(unavailableReasonOmitted, corpus, makeFactory([]));
  const unavailableReasonOmittedResult = completedResult(unavailableReasonOmittedAttempt);
  familyCheck(
    'batch-6d-causal',
    'causal unavailable production keep-out reason omission refuses before Canvas paint',
    unavailableReasonOmittedAttempt.threw === false
      && unavailableReasonOmittedResult?.status === 'refused'
      && unavailableReasonOmittedResult.receipt.refusal.code === 'invalid-keepout'
      && refusalBoundaryIsComplete(unavailableReasonOmittedResult),
    {
      fixtureReady: paint.plan.keepOuts.some(command => command.entryId === KEEP_OUT_IDS.missionMessagesTicker && command.status === 'unavailable'),
      seamReached: true,
      threw: unavailableReasonOmittedAttempt.threw,
      expected: { status: 'refused', code: 'invalid-keepout', reason: 'unavailable commands require reference-unmeasured' },
      observed: unavailableReasonOmittedResult?.status === 'refused'
        ? { status: unavailableReasonOmittedResult.status, refusal: unavailableReasonOmittedResult.receipt.refusal }
        : { status: unavailableReasonOmittedResult?.status },
    },
  );
  const unavailableWrongReason = forgedResult(paint, (_plan, layers) => {
    const command = layers[3]?.commands.find(candidate => candidate.entryId === KEEP_OUT_IDS.missionMessagesTicker);
    if (command !== undefined) command.reason = 'wrong-reason';
  });
  const unavailableWrongReasonAttempt = attemptRender(unavailableWrongReason, corpus, makeFactory([]));
  const unavailableWrongReasonResult = completedResult(unavailableWrongReasonAttempt);
  familyCheck(
    'batch-6d-causal',
    'causal unavailable production keep-out wrong reason refuses before Canvas paint',
    unavailableWrongReasonAttempt.threw === false
      && unavailableWrongReasonResult?.status === 'refused'
      && unavailableWrongReasonResult.receipt.refusal.code === 'invalid-keepout'
      && refusalBoundaryIsComplete(unavailableWrongReasonResult),
    {
      fixtureReady: paint.plan.keepOuts.some(command => command.entryId === KEEP_OUT_IDS.missionMessagesTicker && command.status === 'unavailable'),
      seamReached: true,
      threw: unavailableWrongReasonAttempt.threw,
      expected: { status: 'refused', code: 'invalid-keepout', reason: 'unavailable commands require exact reference-unmeasured' },
      observed: unavailableWrongReasonResult?.status === 'refused'
        ? { status: unavailableWrongReasonResult.status, refusal: unavailableWrongReasonResult.receipt.refusal }
        : { status: unavailableWrongReasonResult?.status },
    },
  );
  const regularStagedRgba: Uint8ClampedArray[] = [];
  const boldStagedRgba: Uint8ClampedArray[] = [];
  const atlasRgbaActivity = emptyActivityLedger();
  const atlasRgbaAttempt = attemptRender(paint, corpus, makeObservedFactory(atlasRgbaActivity, {
    contextHooks: role => role === 'regular-atlas'
      ? { captureImageData: data => regularStagedRgba.push(new Uint8ClampedArray(data)) }
      : role === 'bold-atlas'
        ? { captureImageData: data => boldStagedRgba.push(new Uint8ClampedArray(data)) }
        : {},
  }));
  const atlasRgbaResult = completedResult(atlasRgbaAttempt);
  const shapedCornerAlpha = regularStagedRgba[0]?.[3];
  const shapedInteriorAlpha = regularStagedRgba[0]?.[(1 * 8 + 2) * 4 + 3];
  familyCheck(
    'batch-6d-causal',
    'shipped-shaped glyph empty corners are transparent while interior coverage remains nonzero',
    atlasRgbaResult?.status === 'rendered'
      && shapedCornerAlpha === 0
      && shapedInteriorAlpha !== undefined
      && shapedInteriorAlpha > 0,
    {
      threw: atlasRgbaAttempt.threw,
      result: receiptSummary(atlasRgbaResult?.receipt),
      shapedCornerAlpha,
      shapedInteriorAlpha,
      expected: { corner: 0, interior: '>0' },
    },
  );
  const rgbaMatchesDetachedA8 = (rgba: Uint8ClampedArray[] | undefined, alpha: readonly number[]): boolean => {
    if (rgba?.length !== 1 || rgba[0] === undefined || rgba[0].length !== alpha.length * 4) return false;
    const pixels = rgba[0];
    for (let index = 0; index < alpha.length; index += 1) {
      const offset = index * 4;
      if (pixels[offset] !== 229 || pixels[offset + 1] !== 231 || pixels[offset + 2] !== 235 || pixels[offset + 3] !== applyZektonSdfAlpha(alpha[index] as number)) return false;
    }
    return true;
  };
  const wrongRgb = regularStagedRgba[0]?.slice();
  if (wrongRgb !== undefined) wrongRgb[0] = wrongRgb[0] === 229 ? 228 : 229;
  const wrongAlpha = boldStagedRgba[0]?.slice();
  const expectedBoldAlpha = applyZektonSdfAlpha(boldBytes[0] as number);
  if (wrongAlpha !== undefined) wrongAlpha[3] = expectedBoldAlpha === 255 ? 254 : expectedBoldAlpha + 1;
  familyCheck(
    'batch-6d-causal',
    'regular and bold atlas staging emits literal diagnostic RGB with shipped SDF alpha from detached A8 data',
    atlasRgbaResult?.status === 'rendered'
      && !atlasRgbaAttempt.threw
      && rgbaMatchesDetachedA8(regularStagedRgba, regularBytes)
      && rgbaMatchesDetachedA8(boldStagedRgba, boldBytes)
      && regularStagedRgba[0] !== boldStagedRgba[0]
      && wrongRgb !== undefined
      && wrongAlpha !== undefined
      && !rgbaMatchesDetachedA8([wrongRgb], regularBytes)
      && !rgbaMatchesDetachedA8([wrongAlpha], boldBytes),
    {
      threw: atlasRgbaAttempt.threw,
      result: receiptSummary(atlasRgbaResult?.receipt),
      regular: { captures: regularStagedRgba.length, length: regularStagedRgba[0]?.length, expectedLength: regularBytes.length * 4 },
      bold: { captures: boldStagedRgba.length, length: boldStagedRgba[0]?.length, expectedLength: boldBytes.length * 4 },
      roleSeparated: regularStagedRgba[0] !== boldStagedRgba[0],
      activity: { factory: atlasRgbaActivity.factory.length, dimensions: atlasRgbaActivity.dimensions.length, contexts: atlasRgbaActivity.contexts.length, paint: atlasRgbaActivity.paint.length },
    },
  );
  check('renderer-owned returned surface has exact backing-store size and four issued layers', firstResult.status === 'rendered' && firstReceipt.status === 'rendered' && firstReceipt.width === 100 && firstReceipt.height === 80 && firstResult.surface.width === 100 && firstResult.surface.height === 80 && (firstResult.surface as unknown as JsonRecord).role === 'composite' && JSON.stringify(firstReceipt.layers) === JSON.stringify(['diagnostic-background', 'glyph-alpha-blits', 'diagnostics', 'keep-out-overlays']), { result: firstResult.status, receipt: receiptSummary(firstReceipt), surface: firstResult.status === 'rendered' ? { width: firstResult.surface.width, height: firstResult.surface.height, role: (firstResult.surface as unknown as JsonRecord).role } : undefined });
  const issuedIds = commandList(paint.plan).map(command => command.id);
  check('exact command order and independent layer semantics', firstReceipt.status === 'rendered' && JSON.stringify(firstReceipt.commandIds) === JSON.stringify(issuedIds) && firstReceipt.commandCount === issuedIds.length && new Set(firstReceipt.commandIds).size === firstReceipt.commandIds.length, { issuedIds, receipt: firstReceipt });
  check('truth boundary and diagnostic palette receipt are literal', firstReceipt.status === 'rendered' && firstReceipt.gameTruth === 'Not verified in game' && firstReceipt.gameVerified === false && firstReceipt.verification.gameVerified === false && firstReceipt.palette.id === X4_UI_CANVAS_DIAGNOSTIC_PALETTE.id && firstReceipt.palette.diagnosticOnly === true, firstReceipt);
  const drawEntries = firstCompositeTrace.filter(entry => entry.name === 'drawImage');
  const expectedDrawEntries = expectedFirstCompositeTrace.filter(entry => entry.name === 'drawImage');
  check('regular and bold A8 atlas selection with scaled blit trace', firstResult.status === 'rendered' && firstReceipt.status === 'rendered' && firstReceipt.atlasRoles.includes('regular') && firstReceipt.atlasRoles.includes('bold') && drawEntries.some(entry => entry.args[0] === 'regular-atlas') && drawEntries.some(entry => entry.args[0] === 'bold-atlas') && traceEquals(drawEntries, expectedDrawEntries), { atlasRoles: firstReceipt.status === 'rendered' ? firstReceipt.atlasRoles : [], drawEntries, expectedDrawEntries, firstDifference: firstTraceDifference(expectedDrawEntries, drawEntries) });
  const mutableSurfaceProof = firstResult.status === 'rendered' && (() => {
    const surface = firstResult.surface as unknown as JsonRecord;
    surface.selftestMutable = 'changed';
    const changed = surface.selftestMutable === 'changed';
    Reflect.deleteProperty(surface, 'selftestMutable');
    return changed;
  })();
  check('success wrapper and receipt are frozen separately from the mutable renderer-owned surface', successfulBoundaryIsComplete(firstResult) && mutableSurfaceProof, { completeBoundary: successfulBoundaryIsComplete(firstResult), mutableSurfaceProof });
  const saves = firstFactoryTraces.filter(entry => entry.name === 'save').length;
  const restores = firstFactoryTraces.filter(entry => entry.name === 'restore').length;
  check('clipping save and restore are balanced', saves === restores && firstFactoryTraces.filter(entry => entry.name === 'clip').length === saves, { saves, restores });
  const diagnosticPlan = forgedResult(paint, (_plan, layers) => {
    const commands = layers[2]?.commands;
    if (commands === undefined) return;
    const keepOutCommands = layers[3]?.commands ?? [];
    const lastDiagnosticOrder = Math.max(...commands.map(command => Number(command.order)));
    const firstInsertedOrder = lastDiagnosticOrder + 1;
    for (const command of keepOutCommands) command.order = Number(command.order) + 2;
    commands.push({ id: 'selftest:empty-clip', layer: 'diagnostics', order: firstInsertedOrder, kind: 'empty-clip', reason: 'selftest empty clip', clipRect: { x: 0, y: 0, width: 100, height: 80 }, gameTruth: 'Not verified in game', gameVerified: false });
    commands.push({ id: 'selftest:invalid-raster', layer: 'diagnostics', order: firstInsertedOrder + 1, kind: 'invalid-raster-candidate', reason: 'selftest invalid raster', geometry: { x: 1, y: 1, width: 2, height: 2 }, gameTruth: 'Not verified in game', gameVerified: false });
  });
  const diagnosticTrace: TraceEntry[] = [];
  const diagnosticResult = renderX4UiPaintPlanToCanvas(diagnosticPlan, corpus, { surfaceFactory: makeFactory(diagnosticTrace) });
  const diagnosticCompositeTrace = diagnosticTrace.filter(entry => entry.role === 'composite');
  const expectedDiagnosticTrace = expectedCompositeTrace(diagnosticPlan.plan, corpus);
  check('geometry selection gap unsupported unavailable and empty-clip diagnostics are issued', diagnosticResult.status === 'rendered' && ['node-geometry', 'selection', 'gap', 'unsupported-runtime-paint', 'unavailable-node', 'empty-clip', 'invalid-raster-candidate'].every(kind => commandList(diagnosticPlan.plan).some(command => command.kind === kind)) && traceEquals(diagnosticCompositeTrace, expectedDiagnosticTrace), { kinds: commandList(diagnosticPlan.plan).map(command => command.kind), firstTraceDifference: firstTraceDifference(expectedDiagnosticTrace, diagnosticCompositeTrace) });
  const horizontalGuideTrace = [
    traceEntry('composite', 'setStrokeStyle', X4_UI_CANVAS_DIAGNOSTIC_PALETTE.keepOut),
    traceEntry('composite', 'beginPath'),
    traceEntry('composite', 'moveTo', 0, 80 * 0.788),
    traceEntry('composite', 'lineTo', 100, 80 * 0.788),
    traceEntry('composite', 'stroke'),
  ];
  const verticalGuideTrace = [
    traceEntry('composite', 'setStrokeStyle', X4_UI_CANVAS_DIAGNOSTIC_PALETTE.keepOut),
    traceEntry('composite', 'beginPath'),
    traceEntry('composite', 'moveTo', 100 * 0.664, 0),
    traceEntry('composite', 'lineTo', 100 * 0.664, 80),
    traceEntry('composite', 'stroke'),
  ];
  check('wheel and video keep-out guides preserve exact normalized projections', paint.plan.keepOuts.some(command => command.geometry?.kind === 'horizontal-guide' && command.geometry.y === 80 * 0.788) && paint.plan.keepOuts.some(command => command.geometry?.kind === 'vertical-guide' && command.geometry.x === 100 * 0.664) && traceContainsSequence(firstCompositeTrace, horizontalGuideTrace) && traceContainsSequence(firstCompositeTrace, verticalGuideTrace), { keepOuts: paint.plan.keepOuts, horizontalGuideTrace, verticalGuideTrace });
  const polygonCalibration = calibrateKeepOutPolygon({
    stableId: 'canvas-manual-golden-polygon',
    context: 'canvas-manual-golden-context',
    sourceNote: 'Canvas renderer exact manual polygon golden selftest.',
    screenshotHash: `sha256:${'e'.repeat(64)}`,
    profile: 'canvas-manual-golden-profile',
    drawableBounds: { left: 0, top: 0, width: 1000, height: 800 },
    points: [{ x: 100, y: 100 }, { x: 200, y: 100 }, { x: 150, y: 200 }],
  });
  const polygonEntry = polygonCalibration.status === 'success' ? polygonCalibration.entry : undefined;
  const polygonProjection = polygonEntry === undefined ? undefined : projectKeepOut(polygonEntry, viewport);
  const polygonPaintResult = polygonEntry === undefined || polygonProjection === undefined || fixture.preview.scene === undefined
    ? undefined
    : projectX4UiPaintPlan({
      scene: fixture.preview.scene,
      corpus,
      previewAuthority: fixture.preview,
      keepOuts: [
        { context: KEEP_OUT_PRESET_IDS.cockpitConversation, entry: getBuiltInKeepOut(KEEP_OUT_IDS.conversationBackRow)!, projection: projectBuiltInKeepOut(KEEP_OUT_IDS.conversationBackRow, viewport) },
        { context: polygonEntry.context, entry: polygonEntry, projection: polygonProjection },
        { context: KEEP_OUT_PRESET_IDS.mapOpen, entry: getBuiltInKeepOut(KEEP_OUT_IDS.informationPanelLeftEdge)!, projection: projectBuiltInKeepOut(KEEP_OUT_IDS.informationPanelLeftEdge, viewport) },
        { context: KEEP_OUT_PRESET_IDS.fullscreenMenu, entry: getBuiltInKeepOut(KEEP_OUT_IDS.missionMessagesTicker)!, projection: projectBuiltInKeepOut(KEEP_OUT_IDS.missionMessagesTicker, viewport) },
        { context: KEEP_OUT_PRESET_IDS.firstPerson, entry: getBuiltInKeepOut(KEEP_OUT_IDS.topHudStrip)!, projection: projectBuiltInKeepOut(KEEP_OUT_IDS.topHudStrip, viewport) },
      ],
    });
  const polygonPlan = polygonPaintResult !== undefined && polygonPaintResult.status !== 'refused' ? polygonPaintResult : paint;
  const polygonTrace: TraceEntry[] = [];
  const polygonResult = renderX4UiPaintPlanToCanvas(polygonPlan, corpus, { surfaceFactory: makeFactory(polygonTrace) });
  const polygonCompositeTrace = polygonTrace.filter(entry => entry.role === 'composite');
  const expectedPolygonTrace = CANONICAL_POLYGON_COMPOSITE_TRACE;
  const exactPolygonPath = [
    traceEntry('composite', 'setStrokeStyle', X4_UI_CANVAS_DIAGNOSTIC_PALETTE.keepOut),
    traceEntry('composite', 'beginPath'),
    traceEntry('composite', 'moveTo', 10, 10),
    traceEntry('composite', 'lineTo', 20, 10),
    traceEntry('composite', 'lineTo', 15, 20),
    traceEntry('composite', 'closePath'),
    traceEntry('composite', 'stroke'),
  ];
  const unavailableTrace = [traceEntry('composite', 'setStrokeStyle', X4_UI_CANVAS_DIAGNOSTIC_PALETTE.unavailableKeepOut)];
  check('polygon and unavailable keep-out overlays are retained from real manual calibration', polygonCalibration.status === 'success' && polygonEntry !== undefined && polygonProjection?.status === 'projected' && polygonPaintResult?.status !== 'refused' && polygonPaintResult !== undefined && polygonResult.status === 'rendered' && polygonPlan.plan.keepOuts.some(command => command.entryId === polygonEntry.id && command.geometry?.kind === 'polygon') && polygonPlan.plan.keepOuts.some(command => command.status === 'unavailable' && command.geometry === null) && traceEquals(polygonCompositeTrace, expectedPolygonTrace) && traceContainsSequence(polygonCompositeTrace, exactPolygonPath) && traceContainsSequence(polygonCompositeTrace, unavailableTrace), { calibration: polygonCalibration.status, projection: polygonProjection?.status, paint: polygonPaintResult?.status, keepOuts: polygonPlan.plan.keepOuts, exactPolygonPath, unavailableTrace, firstTraceDifference: firstTraceDifference(expectedPolygonTrace, polygonCompositeTrace) });
  familyCheck(
    'emitted-trace',
    'composite trace exactly follows fixed layers and every command terminal operation',
    firstResult.status === 'rendered'
      && expectedFirstCompositeTrace.length > commandList(paint.plan).length
      && commandList(paint.plan).every(command => expectedCommandTrace(command, paint.plan, corpus).length > 0)
      && traceEquals(firstCompositeTrace, expectedFirstCompositeTrace),
    {
      layerKinds: paint.plan.layers.map(layer => layer.kind),
      commandKinds: commandList(paint.plan).map(command => command.kind),
      expectedOperations: expectedFirstCompositeTrace.length,
      actualOperations: firstCompositeTrace.length,
      firstDifference: firstTraceDifference(expectedFirstCompositeTrace, firstCompositeTrace),
    },
  );
  familyCheck(
    'emitted-trace',
    'all diagnostic families emit their exact palette and rectangle operations',
    diagnosticResult.status === 'rendered'
      && traceEquals(diagnosticCompositeTrace, expectedDiagnosticTrace)
      && ['selection', 'gap', 'unsupported-runtime-paint', 'unavailable-node', 'empty-clip', 'invalid-raster-candidate'].every(kind => {
        const command = commandList(diagnosticPlan.plan).find(candidate => candidate.kind === kind);
        return command !== undefined && traceContainsSequence(diagnosticCompositeTrace, expectedCommandTrace(command, diagnosticPlan.plan, corpus));
      }),
    { firstDifference: firstTraceDifference(expectedDiagnosticTrace, diagnosticCompositeTrace) },
  );
  familyCheck(
    'emitted-trace',
    'guide polygon and unavailable keep-out traces are exact with no invented unavailable geometry',
    traceContainsSequence(firstCompositeTrace, horizontalGuideTrace)
      && traceContainsSequence(firstCompositeTrace, verticalGuideTrace)
      && traceEquals(polygonCompositeTrace, expectedPolygonTrace)
      && traceContainsSequence(polygonCompositeTrace, exactPolygonPath)
      && traceContainsSequence(polygonCompositeTrace, unavailableTrace)
      && polygonPlan.plan.keepOuts.filter(command => command.geometry === null).every(command => {
        const expected = expectedCommandTrace(command as unknown as JsonRecord, polygonPlan.plan, corpus);
        return expected.length === 1 && expected[0]?.name === 'setStrokeStyle' && expected[0]?.args[0] === X4_UI_CANVAS_DIAGNOSTIC_PALETTE.unavailableKeepOut;
      }),
    { horizontalGuideTrace, verticalGuideTrace, exactPolygonPath, unavailableTrace },
  );
  check('empty layer remains paintable', (() => {
    const empty = forgedResult(paint, (_plan, layers) => { layers[3] = { kind: 'keep-out-overlays', commands: [] }; });
    const result = renderX4UiPaintPlanToCanvas(empty, corpus, { surfaceFactory: makeFactory([]) });
    return result.status === 'rendered' && result.receipt.commandIds.length === paint.plan.layers[0].commands.length + paint.plan.layers[1].commands.length + paint.plan.layers[2].commands.length;
  })());
  const replayFactoryTraces: TraceEntry[] = [];
  const replay = renderX4UiPaintPlanToCanvas(paint, corpus, { surfaceFactory: makeFactory(replayFactoryTraces) });
  const replayFactoryTraces2: TraceEntry[] = [];
  const replay2 = renderX4UiPaintPlanToCanvas(paint, corpus, { surfaceFactory: makeFactory(replayFactoryTraces2) });
  check('deterministic replay receipt and trace exclude mutable surface identity', replay.status === 'rendered' && replay2.status === 'rendered' && replay.surface !== replay2.surface && traceSignature(replayFactoryTraces) === traceSignature(replayFactoryTraces2) && JSON.stringify(replay.receipt) === JSON.stringify(replay2.receipt), { replay: receiptSummary(replay.receipt), replay2: receiptSummary(replay2.receipt) });
  check('plan, corpus, and alpha bytes remain unchanged', JSON.stringify(paint.plan) === baselinePlanJson && JSON.stringify(Array.from(corpus.fonts.regular.atlas.alphaBytes)) === JSON.stringify(regularBytes) && JSON.stringify(Array.from(corpus.fonts.bold.atlas.alphaBytes)) === JSON.stringify(boldBytes));

  renderCase('refused result refuses with no surface', { status: 'refused', refusal: { code: 'invalid-input', message: 'fixture refusal' }, gameTruth: 'Not verified in game', verification: { game: 'Not verified in game', gameVerified: false } }, corpus, 'input-refused');
  renderCase('malformed result refuses with no surface', undefined as never, corpus, 'invalid-result');
  renderCase('synthetic or structural corpus clone refuses with no surface', paint, JSON.parse(JSON.stringify(corpus)) as X4UiCorpusCanonicalSuccess, 'invalid-corpus');
  const duplicate = forgedResult(paint, (_plan, layers) => {
    const first = layers[0]?.commands[0];
    const second = layers[0]?.commands[1];
    if (first !== undefined && second !== undefined) second.id = first.id;
  });
  renderCase('duplicate command refuses with no surface', duplicate, corpus, 'duplicate-command');

  const baselineOrders = issuedOrders(paint.plan);
  const sortedBaselineOrders = [...baselineOrders].sort((left, right) => left - right);
  check('global issued-order fixture starts at zero and is contiguous', sortedBaselineOrders.length > 2 && sortedBaselineOrders.every((order, index) => order === index), sortedBaselineOrders);
  const shiftedOrders = forgedResult(paint, (plan) => {
    for (const command of commandList(plan)) command.order = Number(command.order) + 17;
  });
  const shiftedValues = issuedOrders(shiftedOrders.plan);
  check('constant order-shift mutation is changed while preserving uniqueness and per-layer monotonicity', shiftedValues.every((order, index) => order === baselineOrders[index]! + 17) && new Set(shiftedValues).size === shiftedValues.length && layerOrdersAreStrictlyIncreasing(shiftedOrders.plan), { baselineOrders, shiftedValues });
  renderCase('constant-shifted global command orders refuse with no surface', shiftedOrders, corpus, 'out-of-order-command');

  const keepOutBoundary = Math.min(...paint.plan.layers[3].commands.map(command => command.order));
  const gappedOrders = forgedResult(paint, (plan) => {
    for (const command of commandList(plan)) {
      if (Number(command.order) >= keepOutBoundary) command.order = Number(command.order) + 1;
    }
  });
  const gappedValues = issuedOrders(gappedOrders.plan);
  check('layer-boundary gap mutation is changed while preserving uniqueness and per-layer monotonicity', Number.isSafeInteger(keepOutBoundary) && !gappedValues.includes(keepOutBoundary) && gappedValues.some(order => order === keepOutBoundary + 1) && new Set(gappedValues).size === gappedValues.length && layerOrdersAreStrictlyIncreasing(gappedOrders.plan), { keepOutBoundary, baselineOrders, gappedValues });
  renderCase('global command-order gap at a layer boundary refuses with no surface', gappedOrders, corpus, 'out-of-order-command');

  const glyphIdsBefore = paint.plan.layers[1].commands.slice(0, 2).map(command => command.id);
  const coherentReorder = forgedResult(paint, (_plan, layers) => {
    const commands = layers[1]?.commands;
    const first = commands?.[0];
    const second = commands?.[1];
    if (commands === undefined || first === undefined || second === undefined) return;
    const firstOrder = Number(first.order);
    const secondOrder = Number(second.order);
    commands[0] = second;
    commands[1] = first;
    second.order = firstOrder;
    first.order = secondOrder;
  });
  const coherentIds = coherentReorder.plan.layers[1].commands.slice(0, 2).map(command => command.id);
  const coherentValues = issuedOrders(coherentReorder.plan);
  check('same-layer coherent reorder mutation is changed while preserving global order values and local monotonicity', glyphIdsBefore.length === 2 && coherentIds[0] === glyphIdsBefore[1] && coherentIds[1] === glyphIdsBefore[0] && JSON.stringify([...coherentValues].sort((left, right) => left - right)) === JSON.stringify(sortedBaselineOrders) && layerOrdersAreStrictlyIncreasing(coherentReorder.plan), { glyphIdsBefore, coherentIds, baselineOrders, coherentValues });
  const coherentTrace: TraceEntry[] = [];
  const coherentResult = renderX4UiPaintPlanToCanvas(coherentReorder, corpus, { surfaceFactory: makeFactory(coherentTrace) });
  const coherentIssuedIds = commandList(coherentReorder.plan).map(command => command.id);
  check('coherent same-layer reorder is a positive structural boundary without origin authentication', coherentResult.status === 'rendered' && JSON.stringify(coherentResult.receipt.commandIds) === JSON.stringify(coherentIssuedIds) && coherentResult.receipt.commandIds[paint.plan.layers[0].commands.length] === coherentIds[0], { result: coherentResult.status, commandIdsFollowProvidedSequence: coherentResult.status === 'rendered' && JSON.stringify(coherentResult.receipt.commandIds) === JSON.stringify(coherentIssuedIds), originAuthenticated: false });

  const crossLayerOrderSwap = forgedResult(paint, (_plan, layers) => {
    const backgroundLast = layers[0]?.commands[layers[0].commands.length - 1];
    const glyphFirst = layers[1]?.commands[0];
    if (backgroundLast === undefined || glyphFirst === undefined) return;
    const backgroundOrder = backgroundLast.order;
    backgroundLast.order = glyphFirst.order;
    glyphFirst.order = backgroundOrder;
  });
  const crossLayerActivity = emptyActivityLedger();
  const crossLayerAttempt = attemptRender(crossLayerOrderSwap, corpus, makeObservedFactory(crossLayerActivity));
  const crossLayerResult = completedResult(crossLayerAttempt);
  familyCheck(
    'batch-6d-causal',
    'cross-layer stale order refuses before allocator, context, or draw activity',
    crossLayerResult?.status === 'refused'
      && crossLayerResult.receipt.refusal.code === 'out-of-order-command'
      && refusalBoundaryIsComplete(crossLayerResult)
      && !crossLayerAttempt.threw
      && activityIsZero(crossLayerActivity)
      && layerOrdersAreStrictlyIncreasing(crossLayerOrderSwap.plan)
      && new Set(issuedOrders(crossLayerOrderSwap.plan)).size === issuedOrders(crossLayerOrderSwap.plan).length,
    {
      threw: crossLayerAttempt.threw,
      receipt: receiptSummary(crossLayerResult?.receipt),
      layerOrdersRemainIncreasing: layerOrdersAreStrictlyIncreasing(crossLayerOrderSwap.plan),
      issuedOrders: issuedOrders(crossLayerOrderSwap.plan),
      activity: {
        factory: crossLayerActivity.factory.length,
        dimensions: crossLayerActivity.dimensions.length,
        contexts: crossLayerActivity.contexts.length,
        paint: crossLayerActivity.paint.length,
      },
    },
  );
  familyCheck(
    'batch-6d-causal',
      'coherent same-layer reorder remains rendered as the non-defect control',
    coherentResult.status === 'rendered'
      && coherentResult.receipt.commandIds[paint.plan.layers[0].commands.length] === coherentIds[0]
      && coherentTrace.length > 0,
    { result: coherentResult.status, commandIds: coherentResult.status === 'rendered' ? coherentResult.receipt.commandIds : [] },
  );

  const reordered = forgedResult(paint, (_plan, layers) => {
    if (layers[1]?.commands.length > 1) [layers[1].commands[0], layers[1].commands[1]] = [layers[1].commands[1], layers[1].commands[0]];
  });
  renderCase('reordered command with decreasing layer orders refuses with no surface', reordered, corpus, 'out-of-order-command');

  // Review fail-first receipt: command exited 1 at 35/43 with exactly eight reds;
  // callbacks changed glyph x 5->6, alpha 255->0, and drawable width 100->101,
  // while the removed caller-target commit left observable setter/draw traces.

  const callbackBaseline = forgedResult(paint, () => undefined);
  const callbackBaselineFactoryTrace: TraceEntry[] = [];
  const callbackBaselineResult = renderX4UiPaintPlanToCanvas(callbackBaseline, corpus, { surfaceFactory: makeFactory(callbackBaselineFactoryTrace) });
  const surfaceMutation = forgedResult(paint, () => undefined);
  const surfaceGlyph = surfaceMutation.plan.layers[1].commands.find(command => command.kind === 'glyph-alpha-blit') as unknown as JsonRecord | undefined;
  const surfaceDestination = surfaceGlyph?.destinationRect as JsonRecord | undefined;
  const surfaceOriginalX = Number(surfaceDestination?.x);
  const surfaceWidth = Number(surfaceDestination?.width);
  const surfaceMutatedX = surfaceOriginalX + surfaceWidth + 1 <= surfaceMutation.plan.logicalDrawable.width ? surfaceOriginalX + 1 : surfaceOriginalX - 1;
  let surfaceFactoryReached = false;
  let surfaceMutationChanged = false;
  const surfaceMutationFactoryTrace: TraceEntry[] = [];
  const surfaceDelegate = makeFactory(surfaceMutationFactoryTrace);
  const surfaceMutatingFactory: X4UiCanvasSurfaceFactory = (width, height, role) => {
    if (!surfaceFactoryReached) {
      surfaceFactoryReached = true;
      if (surfaceDestination !== undefined) {
        surfaceDestination.x = surfaceMutatedX;
        surfaceMutationChanged = surfaceDestination.x !== surfaceOriginalX;
      }
    }
    return surfaceDelegate(width, height, role);
  };
  const surfaceMutationAttempt = attemptRender(surfaceMutation, corpus, surfaceMutatingFactory);
  const surfaceMutationResult = completedResult(surfaceMutationAttempt);
  check('surface-factory plan mutation is detached then refused with no returned surface', callbackBaselineResult.status === 'rendered' && surfaceFactoryReached && surfaceMutationChanged && traceSignature(callbackBaselineFactoryTrace) === traceSignature(surfaceMutationFactoryTrace) && surfaceMutationResult?.status === 'refused' && surfaceMutationResult.receipt.refusal.code === 'post-validation-mutation' && refusalBoundaryIsComplete(surfaceMutationResult), {
    threw: surfaceMutationAttempt.threw,
    callbackBaselineReceipt: receiptSummary(callbackBaselineResult.receipt),
    surfaceFactoryReached,
    surfaceMutationChanged,
    surfaceOriginalX,
    surfaceMutatedX,
    baselineTraceLength: callbackBaselineFactoryTrace.length,
    mutatedTraceLength: surfaceMutationFactoryTrace.length,
    preRepairTraceDiffers: traceSignature(callbackBaselineFactoryTrace) !== traceSignature(surfaceMutationFactoryTrace),
    firstTraceDifference: firstTraceDifference(callbackBaselineFactoryTrace, surfaceMutationFactoryTrace),
    surfaceMutationReceipt: receiptSummary(surfaceMutationResult?.receipt),
    hasSurface: surfaceMutationResult === undefined ? undefined : Object.prototype.hasOwnProperty.call(surfaceMutationResult, 'surface'),
  });

  const alphaBytes = corpus.fonts.regular.atlas.alphaBytes as Uint8Array;
  const callbackAlphaOriginal = alphaBytes[0]!;
  const callbackAlphaMutated = callbackAlphaOriginal === 0 ? 1 : 0;
  const expectedDetachedAlpha = applyZektonSdfAlpha(callbackAlphaOriginal);
  const expectedMutatedAlpha = applyZektonSdfAlpha(callbackAlphaMutated);
  let alphaMutationReached = false;
  let stagedAlpha: number | undefined;
  let corpusWasMutated = false;
  const alphaMutationFactoryTrace: TraceEntry[] = [];
  const alphaMutatingFactory: X4UiCanvasSurfaceFactory = (width, height, role) => {
    const hooks: TraceContextHooks = role === 'regular-atlas' ? {
      beforeCreateImageData: () => {
        alphaMutationReached = true;
        alphaBytes[0] = callbackAlphaMutated;
      },
      captureImageData: data => { stagedAlpha = data[3]; },
    } : {};
    const context = makeTraceContext(alphaMutationFactoryTrace, role, true, false, hooks);
    return { role, width, height, getContext: (_kind: '2d') => context } as JsonRecord & X4UiCanvasSurface;
  };
  let alphaMutationAttempt: RenderAttempt | undefined;
  try {
    alphaMutationAttempt = attemptRender(forgedResult(paint, () => undefined), corpus, alphaMutatingFactory);
    corpusWasMutated = alphaBytes[0] === callbackAlphaMutated;
  } finally {
    alphaBytes[0] = callbackAlphaOriginal;
  }
  const alphaMutationResult = completedResult(alphaMutationAttempt);
  check('post-validation canonical alpha mutation uses detached A8 bytes then refuses with no surface', alphaMutationReached && corpusWasMutated && stagedAlpha === expectedDetachedAlpha && traceEquals(alphaMutationFactoryTrace, callbackBaselineFactoryTrace) && alphaMutationResult?.status === 'refused' && alphaMutationResult.receipt.refusal.code === 'post-validation-mutation' && refusalBoundaryIsComplete(alphaMutationResult) && isX4UiCorpusCanonicalSuccess(corpus), {
    threw: alphaMutationAttempt?.threw,
    alphaMutationReached,
    corpusWasMutated,
    callbackAlphaOriginal,
    callbackAlphaMutated,
    expectedDetachedAlpha,
    expectedMutatedAlpha,
    stagedAlpha,
    preRepairUsedMutatedAlpha: stagedAlpha === expectedMutatedAlpha,
    alphaMutationReceipt: receiptSummary(alphaMutationResult?.receipt),
    hasSurface: alphaMutationResult === undefined ? undefined : Object.prototype.hasOwnProperty.call(alphaMutationResult, 'surface'),
    canonicalRestored: isX4UiCorpusCanonicalSuccess(corpus),
  });

  const contextCallbackMutation = forgedResult(paint, () => undefined);
  const callbackDrawable = contextCallbackMutation.plan.logicalDrawable as unknown as JsonRecord;
  const callbackDrawableWidth = Number(callbackDrawable.width);
  let contextCallbackReached = false;
  let contextCallbackChanged = false;
  const contextCallbackTrace: TraceEntry[] = [];
  const contextDelegate = makeFactory(contextCallbackTrace);
  const contextMutatingFactory: X4UiCanvasSurfaceFactory = (width, height, role) => {
    if (role !== 'composite') return contextDelegate(width, height, role);
    const context = makeTraceContext(contextCallbackTrace, role, false);
    return {
      role,
      width,
      height,
      getContext: (_kind: '2d') => {
        if (!contextCallbackReached) {
          contextCallbackReached = true;
          callbackDrawable.width = callbackDrawableWidth + 1;
          contextCallbackChanged = callbackDrawable.width !== callbackDrawableWidth;
        }
        return context;
      },
    } as JsonRecord & X4UiCanvasSurface;
  };
  const contextCallbackAttempt = attemptRender(contextCallbackMutation, corpus, contextMutatingFactory);
  const contextCallbackResult = completedResult(contextCallbackAttempt);
  check('composite getContext plan mutation is detached then refused with no surface', contextCallbackReached && contextCallbackChanged && traceSignature(contextCallbackTrace) === traceSignature(callbackBaselineFactoryTrace) && contextCallbackResult?.status === 'refused' && contextCallbackResult.receipt.refusal.code === 'post-validation-mutation' && refusalBoundaryIsComplete(contextCallbackResult), {
    threw: contextCallbackAttempt.threw,
    contextCallbackReached,
    contextCallbackChanged,
    callbackDrawableWidth,
    mutatedDrawableWidth: callbackDrawable.width,
    traceMatchesDetachedBaseline: traceSignature(contextCallbackTrace) === traceSignature(callbackBaselineFactoryTrace),
    firstTraceDifference: firstTraceDifference(callbackBaselineFactoryTrace, contextCallbackTrace),
    contextCallbackReceipt: receiptSummary(contextCallbackResult?.receipt),
    hasSurface: contextCallbackResult === undefined ? undefined : Object.prototype.hasOwnProperty.call(contextCallbackResult, 'surface'),
  });

  const callbackMatrixBaselineActivity = emptyActivityLedger();
  const callbackMatrixBaselineAttempt = attemptRender(forgedResult(paint, () => undefined), corpus, makeObservedFactory(callbackMatrixBaselineActivity));
  const callbackMatrixBaselineResult = completedResult(callbackMatrixBaselineAttempt);
  const planMutationStages: readonly {
    readonly label: string;
    readonly hooks: (mutate: () => void) => ObservedFactoryHooks;
  }[] = [
    {
      label: 'regular atlas width setter',
      hooks: mutate => ({ afterDimensionWrite: (role, dimension) => { if (role === 'regular-atlas' && dimension === 'width') mutate(); } }),
    },
    {
      label: 'regular atlas height setter',
      hooks: mutate => ({ afterDimensionWrite: (role, dimension) => { if (role === 'regular-atlas' && dimension === 'height') mutate(); } }),
    },
    {
      label: 'regular atlas width getter',
      hooks: mutate => ({ afterDimensionRead: (role, dimension) => { if (role === 'regular-atlas' && dimension === 'width') mutate(); } }),
    },
    {
      label: 'regular atlas height getter',
      hooks: mutate => ({ afterDimensionRead: (role, dimension) => { if (role === 'regular-atlas' && dimension === 'height') mutate(); } }),
    },
    {
      label: 'successful composite raster drawImage',
      hooks: mutate => ({ contextHooks: role => role === 'composite' ? { afterOperation: (_operationRole, name) => { if (name === 'drawImage') mutate(); } } : {} }),
    },
    {
      label: 'successful composite geometry style',
      hooks: mutate => ({ contextHooks: role => role === 'composite' ? { afterOperation: (_operationRole, name) => { if (name === 'setFillStyle') mutate(); } } : {} }),
    },
  ];
  for (const stage of planMutationStages) {
    const mutationResult = forgedResult(paint, () => undefined);
    const glyph = mutationResult.plan.layers[1].commands.find(command => command.kind === 'glyph-alpha-blit') as unknown as JsonRecord | undefined;
    const destination = dataRecord(glyph?.destinationRect);
    const originalX = Number(destination?.x);
    const width = Number(destination?.width);
    const mutatedX = originalX + width + 1 <= mutationResult.plan.logicalDrawable.width ? originalX + 1 : originalX - 1;
    let callbackReached = false;
    let sourceFactChanged = false;
    const mutate = (): void => {
      if (callbackReached) return;
      callbackReached = true;
      if (destination !== undefined) {
        destination.x = mutatedX;
        sourceFactChanged = destination.x !== originalX;
      }
    };
    const activity = emptyActivityLedger();
    const attempt = attemptRender(mutationResult, corpus, makeObservedFactory(activity, stage.hooks(mutate)));
    const resultValue = completedResult(attempt);
    const refusedAfterMutation = resultValue?.status === 'refused'
      && resultValue.receipt.refusal.code === 'post-validation-mutation'
      && refusalBoundaryIsComplete(resultValue);
    familyCheck(
      'callback-isolation',
      `${stage.label} mutation uses detached operations then refuses without a surface`,
      callbackMatrixBaselineResult?.status === 'rendered'
        && successfulBoundaryIsComplete(callbackMatrixBaselineResult)
        && callbackReached
        && sourceFactChanged
        && Number(destination?.x) === mutatedX
        && refusedAfterMutation
        && activitySignature(activity) === activitySignature(callbackMatrixBaselineActivity),
      {
        baselineStatus: callbackMatrixBaselineResult?.status ?? 'threw',
        callbackReached,
        sourceFactChanged,
        originalX,
        mutatedX,
        actualX: destination?.x,
        threw: attempt.threw,
        receipt: receiptSummary(resultValue?.receipt),
        activityMatchesBaseline: activitySignature(activity) === activitySignature(callbackMatrixBaselineActivity),
        firstPaintDifference: firstTraceDifference(callbackMatrixBaselineActivity.paint, activity.paint),
      },
    );
  }

  const putImageDataActivity = emptyActivityLedger();
  const putImageDataOriginal = alphaBytes[0]!;
  const putImageDataMutated = putImageDataOriginal === 0 ? 1 : 0;
  let putImageDataReached = false;
  let putImageDataCorpusChanged = false;
  let putImageDataAttempt: RenderAttempt | undefined;
  try {
    putImageDataAttempt = attemptRender(forgedResult(paint, () => undefined), corpus, makeObservedFactory(putImageDataActivity, {
      contextHooks: role => role === 'regular-atlas' ? {
        afterOperation: (_operationRole, name) => {
          if (name !== 'putImageData' || putImageDataReached) return;
          putImageDataReached = true;
          alphaBytes[0] = putImageDataMutated;
          putImageDataCorpusChanged = alphaBytes[0] !== putImageDataOriginal;
        },
      } : {},
    }));
  } finally {
    alphaBytes[0] = putImageDataOriginal;
  }
  const putImageDataResult = completedResult(putImageDataAttempt);
  familyCheck(
    'callback-isolation',
    'atlas putImageData mutation uses detached A8 pixels then refuses without a surface',
    callbackMatrixBaselineResult?.status === 'rendered'
      && putImageDataReached
      && putImageDataCorpusChanged
      && putImageDataResult?.status === 'refused'
      && putImageDataResult.receipt.refusal.code === 'post-validation-mutation'
      && refusalBoundaryIsComplete(putImageDataResult)
      && activitySignature(putImageDataActivity) === activitySignature(callbackMatrixBaselineActivity)
      && isX4UiCorpusCanonicalSuccess(corpus),
    {
      putImageDataReached,
      putImageDataCorpusChanged,
      putImageDataOriginal,
      putImageDataMutated,
      threw: putImageDataAttempt?.threw,
      receipt: receiptSummary(putImageDataResult?.receipt),
      activityMatchesBaseline: activitySignature(putImageDataActivity) === activitySignature(callbackMatrixBaselineActivity),
      firstPaintDifference: firstTraceDifference(callbackMatrixBaselineActivity.paint, putImageDataActivity.paint),
      canonicalRestored: isX4UiCorpusCanonicalSuccess(corpus),
    },
  );

  const unsupported = forgedResult(paint, (_plan, layers) => {
    const command = layers[0]?.commands[0];
    if (command !== undefined) command.kind = 'unsupported';
  });
  renderCase('unsupported command refuses with no surface', unsupported, corpus, 'unsupported-command');
  const unsafe = forgedResult(paint, (plan) => { (plan.logicalDrawable as unknown as JsonRecord).width = Number.NaN; });
  renderCase('unsafe dimension refuses with no surface', unsafe, corpus, 'invalid-geometry');
  const gameTruth = forgedResult(paint, (plan) => { (plan as unknown as JsonRecord).gameVerified = true; });
  renderCase('game-truth escalation refuses with no surface', gameTruth, corpus, 'game-truth');
  const atlasMismatch = forgedResult(paint, (_plan, layers) => {
    const glyph = layers[1]?.commands.find(command => command.kind === 'glyph-alpha-blit');
    if (glyph !== undefined) (glyph.atlas as JsonRecord).sha256 = '0'.repeat(64);
  });
  renderCase('atlas identity mismatch refuses with no surface', atlasMismatch, corpus, 'invalid-atlas');
  const sourceOutOfBounds = forgedResult(paint, (_plan, layers) => {
    const glyph = layers[1]?.commands.find(command => command.kind === 'glyph-alpha-blit');
    if (glyph !== undefined) (glyph.sourceRect as JsonRecord).x = -1;
  });
  renderCase('atlas source out-of-bounds refuses with no surface', sourceOutOfBounds, corpus, 'atlas-bounds');
  const sparse = forgedResult(paint, (_plan, layers) => {
    const commands = layers[0]?.commands;
    if (commands !== undefined && commands.length > 0) delete commands[0];
  });
  renderCase('sparse command array refuses with no surface', sparse, corpus, 'invalid-layer');
  let accessorResultReads = 0;
  const accessorResult = Object.defineProperty({ status: paint.status, verification: paint.verification }, 'plan', { enumerable: true, get: () => { accessorResultReads += 1; return paint.plan; } }) as unknown as X4UiPaintPlanResult;
  renderCase('accessor result refuses with no surface', accessorResult, corpus, 'invalid-result');

  const targetOptionCases = (['target', 'existingSurface'] as const).map(field => {
    let contextReads = 0;
    const target = {
      width: 321,
      height: 123,
      state: 'caller-owned',
      getContext: (_kind: '2d') => {
        contextReads += 1;
        return null;
      },
    };
    const activity = emptyActivityLedger();
    const options = {
      surfaceFactory: makeObservedFactory(activity),
      [field]: target,
    } as unknown as X4UiCanvasRenderOptions;
    const attempt = attemptRenderWithOptions(paint, corpus, options);
    const resultValue = completedResult(attempt);
    return {
      field,
      attempt,
      result: resultValue,
      target,
      contextReads,
      activity,
    };
  });
  familyCheck(
    'batch-6d-causal',
    'own target and existing-surface options refuse before allocation and preserve caller state',
    targetOptionCases.every(item => item.result?.status === 'refused'
      && item.result.receipt.refusal.code === 'invalid-input'
      && refusalBoundaryIsComplete(item.result)
      && !item.attempt.threw
      && item.target.width === 321
      && item.target.height === 123
      && item.target.state === 'caller-owned'
      && item.contextReads === 0
      && activityIsZero(item.activity)),
    targetOptionCases.map(item => ({
      field: item.field,
      threw: item.attempt.threw,
      receipt: receiptSummary(item.result?.receipt),
      target: { width: item.target.width, height: item.target.height, state: item.target.state },
      contextReads: item.contextReads,
      activity: { factory: item.activity.factory.length, dimensions: item.activity.dimensions.length, contexts: item.activity.contexts.length, paint: item.activity.paint.length },
    })),
  );

  const malformedPlan = forgedResult(paint, (plan) => { Reflect.deleteProperty(plan as unknown as JsonRecord, 'source'); });
  preAllocationFamilyCase('malformed plan refuses before every allocation or Canvas callback', malformedPlan, corpus, 'invalid-plan', !Object.prototype.hasOwnProperty.call(malformedPlan.plan, 'source'));
  const malformedCommand = forgedResult(paint, (_plan, layers) => {
    const command = layers[0]?.commands[0];
    if (command !== undefined) command.id = '';
  });
  preAllocationFamilyCase('malformed command refuses before every allocation or Canvas callback', malformedCommand, corpus, 'invalid-command', malformedCommand.plan.layers[0].commands[0]?.id === '');
  const invalidDestination = forgedResult(paint, (plan, layers) => {
    const glyph = layers[1]?.commands.find(command => command.kind === 'glyph-alpha-blit');
    const destination = dataRecord(glyph?.destinationRect);
    if (destination !== undefined) destination.x = plan.logicalDrawable.width;
  });
  const invalidDestinationRect = dataRecord((invalidDestination.plan.layers[1].commands.find(command => command.kind === 'glyph-alpha-blit') as unknown as JsonRecord | undefined)?.destinationRect);
  preAllocationFamilyCase('invalid destination geometry refuses before every allocation or Canvas callback', invalidDestination, corpus, 'invalid-geometry', invalidDestinationRect?.x === invalidDestination.plan.logicalDrawable.width, invalidDestinationRect);
  let commandAccessorReads = 0;
  const accessorCommand = forgedResult(paint, (_plan, layers) => {
    const command = layers[0]?.commands[0];
    if (command === undefined) return;
    Reflect.deleteProperty(command, 'id');
    Object.defineProperty(command, 'id', { configurable: true, enumerable: true, get: () => { commandAccessorReads += 1; return 'forbidden-accessor'; } });
  });
  const commandIdDescriptor = Object.getOwnPropertyDescriptor(accessorCommand.plan.layers[0].commands[0] as unknown as object, 'id');
  preAllocationFamilyCase('accessor command refuses without executing the accessor or allocating a surface', accessorCommand, corpus, 'invalid-command', () => typeof commandIdDescriptor?.get === 'function' && commandAccessorReads === 0, { accessorReads: () => commandAccessorReads });
  const prototypeCommand = forgedResult(paint, (_plan, layers) => {
    const command = layers[0]?.commands[0];
    if (command !== undefined) Object.setPrototypeOf(command, { inheritedDecoration: true });
  });
  preAllocationFamilyCase('custom-prototype command refuses before every allocation or Canvas callback', prototypeCommand, corpus, 'invalid-command', Object.getPrototypeOf(prototypeCommand.plan.layers[0].commands[0] as unknown as object) !== Object.prototype);
  preAllocationFamilyCase('accessor result refuses without executing the accessor or allocating a surface', accessorResult, corpus, 'invalid-result', () => accessorResultReads === 0, { accessorDescriptor: typeof Object.getOwnPropertyDescriptor(accessorResult as unknown as object, 'plan')?.get });

  renderCase('staging surface missing 2D context refuses with no surface', paint, corpus, 'missing-context', () => ({ width: 1, height: 1, getContext: () => null }));
  const compositeMissingDelegate = makeFactory([]);
  renderCase('final composite missing 2D context refuses with no surface', paint, corpus, 'missing-context', (width, height, role) => role === 'composite' ? { width, height, getContext: () => null } : compositeMissingDelegate(width, height, role));
  renderCase('atlas surface allocation failure refuses with no surface', paint, corpus, 'allocation-failure', makeFactory([], true, 'regular-atlas'));
  renderCase('image-data allocation failure refuses with no surface', paint, corpus, 'allocation-failure', makeFactory([], true, undefined, true));
  renderCase('final composite allocation failure refuses with no surface', paint, corpus, 'allocation-failure', makeFactory([], true, 'composite'));

  const compositeFailureTrace: TraceEntry[] = [];
  const compositeFailureDelegate = makeFactory(compositeFailureTrace);
  const compositePaintFailureFactory: X4UiCanvasSurfaceFactory = (width, height, role) => {
    if (role !== 'composite') return compositeFailureDelegate(width, height, role);
    const context = makeTraceContext(compositeFailureTrace, role, false, false, { failDrawImage: true });
    return { role, width, height, getContext: (_kind: '2d') => context } as JsonRecord & X4UiCanvasSurface;
  };
  const compositePaintFailure = renderX4UiPaintPlanToCanvas(paint, corpus, { surfaceFactory: compositePaintFailureFactory });
  check('composite paint failure discards every owned surface and returns no surface', compositePaintFailure.status === 'refused' && compositePaintFailure.receipt.refusal.code === 'surface-failure' && compositeFailureTrace.some(entry => entry.name === 'drawImage') && !Object.prototype.hasOwnProperty.call(compositePaintFailure, 'surface'), { receipt: receiptSummary(compositePaintFailure.receipt), internalDrawReached: compositeFailureTrace.some(entry => entry.name === 'drawImage'), hasSurface: Object.prototype.hasOwnProperty.call(compositePaintFailure, 'surface') });

  const regularAlphaBytes = corpus.fonts.regular.atlas.alphaBytes as Uint8Array;
  const originalAlpha = regularAlphaBytes[0];
  regularAlphaBytes[0] = originalAlpha === 0 ? 1 : 0;
  renderCase('mutated canonical corpus bytes refuse with no surface', paint, corpus, 'invalid-corpus');
  regularAlphaBytes[0] = originalAlpha;
  check('canonical corpus byte mutation is restored for later checks', isX4UiCorpusCanonicalSuccess(corpus));

  const freezeRefusalActivity = emptyActivityLedger();
  const freezeRefusalAttempt = attemptRender(undefined as never, corpus, makeObservedFactory(freezeRefusalActivity));
  const freezeRefusal = completedResult(freezeRefusalAttempt);
  familyCheck(
    'freeze-truth',
    'success freezes every receipt boundary while leaving only the returned surface mutable',
    successfulBoundaryIsComplete(firstResult) && mutableSurfaceProof,
    firstResult.status === 'rendered' ? {
      wrapper: Object.isFrozen(firstResult),
      receipt: Object.isFrozen(firstResult.receipt),
      verification: Object.isFrozen(firstResult.receipt.verification),
      layers: Object.isFrozen(firstResult.receipt.layers),
      commandIds: Object.isFrozen(firstResult.receipt.commandIds),
      atlasRoles: Object.isFrozen(firstResult.receipt.atlasRoles),
      palette: Object.isFrozen(firstResult.receipt.palette),
      surface: Object.isFrozen(firstResult.surface),
      gameTruth: firstResult.receipt.gameTruth,
      gameVerified: firstResult.receipt.gameVerified,
    } : { status: firstResult.status },
  );
  familyCheck(
    'freeze-truth',
    'refusal freezes every receipt boundary with literal truth and no surface',
    freezeRefusal?.status === 'refused'
      && refusalBoundaryIsComplete(freezeRefusal)
      && activityIsZero(freezeRefusalActivity),
    freezeRefusal === undefined || freezeRefusal.status !== 'refused' ? { threw: freezeRefusalAttempt.threw, status: freezeRefusal?.status } : {
      wrapper: Object.isFrozen(freezeRefusal),
      receipt: Object.isFrozen(freezeRefusal.receipt),
      refusal: Object.isFrozen(freezeRefusal.receipt.refusal),
      verification: Object.isFrozen(freezeRefusal.receipt.verification),
      gameTruth: freezeRefusal.receipt.gameTruth,
      gameVerified: freezeRefusal.receipt.gameVerified,
      hasSurface: Object.prototype.hasOwnProperty.call(freezeRefusal, 'surface'),
      preAllocationActivity: activitySignature(freezeRefusalActivity),
    },
  );

  const omittedTrace = expectedFirstCompositeTrace.slice(1);
  const reorderedTrace = [...expectedFirstCompositeTrace];
  if (reorderedTrace.length > 1) [reorderedTrace[0], reorderedTrace[1]] = [reorderedTrace[1]!, reorderedTrace[0]!];
  const changedArgumentTrace = expectedFirstCompositeTrace.map((entry, index) => index === 0 ? traceEntry(entry.role, entry.name, ...entry.args, 'changed') : entry);
  familyCheck(
    'oracle-sensitivity',
    'trace equality oracle rejects one omitted reordered or argument-mutated operation',
    expectedFirstCompositeTrace.length > 1
      && traceEquals(expectedFirstCompositeTrace, firstCompositeTrace)
      && !traceEquals(expectedFirstCompositeTrace, omittedTrace)
      && !traceEquals(expectedFirstCompositeTrace, reorderedTrace)
      && !traceEquals(expectedFirstCompositeTrace, changedArgumentTrace),
    {
      expectedLength: expectedFirstCompositeTrace.length,
      omittedDetected: !traceEquals(expectedFirstCompositeTrace, omittedTrace),
      reorderDetected: !traceEquals(expectedFirstCompositeTrace, reorderedTrace),
      argumentChangeDetected: !traceEquals(expectedFirstCompositeTrace, changedArgumentTrace),
    },
  );
  const mutablePalette = firstResult.status === 'rendered' ? { ...firstResult.receipt.palette } : {};
  const nestedMutableSuccess = firstResult.status === 'rendered' ? Object.freeze({
    status: 'rendered' as const,
    receipt: Object.freeze({
      ...firstResult.receipt,
      verification: Object.freeze({ ...firstResult.receipt.verification }),
      layers: Object.freeze([...firstResult.receipt.layers]),
      commandIds: Object.freeze([...firstResult.receipt.commandIds]),
      atlasRoles: Object.freeze([...firstResult.receipt.atlasRoles]),
      palette: mutablePalette,
    }),
    surface: firstResult.surface,
  }) as unknown as X4UiCanvasRenderResult : firstResult;
  const mutableRefusalVerification = freezeRefusal?.status === 'refused' ? { ...freezeRefusal.receipt.verification } : {};
  const nestedMutableRefusal = freezeRefusal?.status === 'refused' ? Object.freeze({
    status: 'refused' as const,
    receipt: Object.freeze({
      ...freezeRefusal.receipt,
      refusal: Object.freeze({ ...freezeRefusal.receipt.refusal }),
      verification: mutableRefusalVerification,
    }),
  }) as unknown as X4UiCanvasRenderResult : freezeRefusal;
  familyCheck(
    'oracle-sensitivity',
    'freeze boundary oracle rejects a mutable nested palette or verification object',
    firstResult.status === 'rendered'
      && freezeRefusal?.status === 'refused'
      && !Object.isFrozen(mutablePalette)
      && !Object.isFrozen(mutableRefusalVerification)
      && !successfulBoundaryIsComplete(nestedMutableSuccess)
      && nestedMutableRefusal !== undefined
      && !refusalBoundaryIsComplete(nestedMutableRefusal),
    {
      mutablePaletteDetected: !successfulBoundaryIsComplete(nestedMutableSuccess),
      mutableVerificationDetected: nestedMutableRefusal === undefined ? false : !refusalBoundaryIsComplete(nestedMutableRefusal),
    },
  );

  const priorCheckCount = checks.filter(item => item.family === 'prior-44').length;
  familyCheck('oracle-sensitivity', 'all prior renderer checks remain present', priorCheckCount === 44, { priorCheckCount });

  const failed = checks.filter(item => !item.pass);
  const passed = checks.length - failed.length;
  const familyCounts = (['prior-44', 'callback-isolation', 'pre-allocation', 'emitted-trace', 'freeze-truth', 'oracle-sensitivity', 'batch-6d-causal', 'stage-b-causal'] as const).map(family => {
    const familyChecks = checks.filter(item => item.family === family);
    return { family, passed: familyChecks.filter(item => item.pass).length, total: familyChecks.length };
  });
  console.log(`x4UiCanvasRenderer selftest: ${passed}/${checks.length} passed; families=${JSON.stringify(familyCounts)}`);
  if (failed.length > 0) {
    console.error(JSON.stringify(failed, null, 2));
    throw new Error(`${failed.length} renderer selftest checks failed`);
  }
}

void main();
