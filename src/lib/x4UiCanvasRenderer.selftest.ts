import type { ModWorkspace, PassthroughFile } from '../types';
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
  type X4UiPreviewPipelineResult,
} from './x4UiPreviewPipeline';
import {
  projectX4UiPaintPlan,
  type X4UiPaintPlan,
  type X4UiPaintPlanResult,
} from './x4UiPaintPlan';
import { buildX4UiWorkspaceSource, type X4UiWorkspaceSource } from './x4UiWorkspaceSource';
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
type CheckFamily = 'prior-44' | 'callback-isolation' | 'pre-allocation' | 'emitted-trace' | 'freeze-truth' | 'oracle-sensitivity' | 'batch-6d-causal';
type Check = { readonly family: CheckFamily; readonly name: string; readonly pass: boolean; readonly detail?: unknown };
const checks: Check[] = [];

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
  return bytes;
}

async function withCanonicalPlatformHash<T>(expectedHashes: readonly string[], run: () => Promise<T>): Promise<T> {
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
    check('canonical loader restores platform crypto', (globalThis as unknown as { crypto?: unknown }).crypto === originalValue);
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
    { context: KEEP_OUT_PRESET_IDS.cockpitConversation, projection: projectBuiltInKeepOut(KEEP_OUT_IDS.conversationBackRow, viewport) },
    { context: KEEP_OUT_PRESET_IDS.cockpitConversation, projection: projectBuiltInKeepOut(KEEP_OUT_IDS.conversationOptionStackStart, viewport) },
    { context: KEEP_OUT_PRESET_IDS.mapOpen, projection: projectBuiltInKeepOut(KEEP_OUT_IDS.informationPanelLeftEdge, viewport) },
    { context: KEEP_OUT_PRESET_IDS.fullscreenMenu, projection: projectBuiltInKeepOut(KEEP_OUT_IDS.missionMessagesTicker, viewport) },
    { context: KEEP_OUT_PRESET_IDS.firstPerson, projection: projectBuiltInKeepOut(KEEP_OUT_IDS.topHudStrip, viewport) },
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
  traceEntry('composite', "fillRect", 5, 0, 20.25, 2.25),
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
  traceEntry('composite', "fillRect", 5, 1, 15.75, 2.25),
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
  traceEntry('composite', "rect", 5, 0, 2.25, 1.40625),
  traceEntry('composite', "clip"),
  traceEntry('composite', "setFillStyle", "#e5e7eb"),
  traceEntry('composite', "drawImage", "regular-atlas", 0, 5, 8, 5, 5, 0, 2.25, 1.40625),
  traceEntry('composite', "restore"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 7.25, 0, 2.25, 1.40625),
  traceEntry('composite', "clip"),
  traceEntry('composite', "setFillStyle", "#e5e7eb"),
  traceEntry('composite', "drawImage", "regular-atlas", 0, 5, 8, 5, 7.25, 0, 2.25, 1.40625),
  traceEntry('composite', "restore"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 9.5, 0, 2.25, 1.40625),
  traceEntry('composite', "clip"),
  traceEntry('composite', "setFillStyle", "#e5e7eb"),
  traceEntry('composite', "drawImage", "regular-atlas", 0, 5, 8, 5, 9.5, 0, 2.25, 1.40625),
  traceEntry('composite', "restore"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 11.75, 0, 2.25, 1.40625),
  traceEntry('composite', "clip"),
  traceEntry('composite', "setFillStyle", "#e5e7eb"),
  traceEntry('composite', "drawImage", "regular-atlas", 0, 5, 8, 5, 11.75, 0, 2.25, 1.40625),
  traceEntry('composite', "restore"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 14, 0, 2.25, 1.40625),
  traceEntry('composite', "clip"),
  traceEntry('composite', "setFillStyle", "#e5e7eb"),
  traceEntry('composite', "drawImage", "regular-atlas", 0, 5, 8, 5, 14, 0, 2.25, 1.40625),
  traceEntry('composite', "restore"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 16.25, 0, 2.25, 1.40625),
  traceEntry('composite', "clip"),
  traceEntry('composite', "setFillStyle", "#e5e7eb"),
  traceEntry('composite', "drawImage", "regular-atlas", 0, 5, 8, 5, 16.25, 0, 2.25, 1.40625),
  traceEntry('composite', "restore"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 18.5, 0, 2.25, 1.40625),
  traceEntry('composite', "clip"),
  traceEntry('composite', "setFillStyle", "#e5e7eb"),
  traceEntry('composite', "drawImage", "regular-atlas", 0, 5, 8, 5, 18.5, 0, 2.25, 1.40625),
  traceEntry('composite', "restore"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 20.75, 0, 2.25, 1.40625),
  traceEntry('composite', "clip"),
  traceEntry('composite', "setFillStyle", "#e5e7eb"),
  traceEntry('composite', "drawImage", "regular-atlas", 0, 5, 8, 5, 20.75, 0, 2.25, 1.40625),
  traceEntry('composite', "restore"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 23, 0, 2.25, 1.40625),
  traceEntry('composite', "clip"),
  traceEntry('composite', "setFillStyle", "#e5e7eb"),
  traceEntry('composite', "drawImage", "regular-atlas", 0, 5, 8, 5, 23, 0, 2.25, 1.40625),
  traceEntry('composite', "restore"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 5, 1, 2.25, 1.40625),
  traceEntry('composite', "clip"),
  traceEntry('composite', "setFillStyle", "#e5e7eb"),
  traceEntry('composite', "drawImage", "regular-atlas", 0, 5, 8, 5, 5, 1, 2.25, 1.40625),
  traceEntry('composite', "restore"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 7.25, 1, 2.25, 1.40625),
  traceEntry('composite', "clip"),
  traceEntry('composite', "setFillStyle", "#e5e7eb"),
  traceEntry('composite', "drawImage", "regular-atlas", 0, 5, 8, 5, 7.25, 1, 2.25, 1.40625),
  traceEntry('composite', "restore"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 9.5, 1, 2.25, 1.40625),
  traceEntry('composite', "clip"),
  traceEntry('composite', "setFillStyle", "#e5e7eb"),
  traceEntry('composite', "drawImage", "regular-atlas", 0, 5, 8, 5, 9.5, 1, 2.25, 1.40625),
  traceEntry('composite', "restore"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 11.75, 1, 2.25, 1.40625),
  traceEntry('composite', "clip"),
  traceEntry('composite', "setFillStyle", "#e5e7eb"),
  traceEntry('composite', "drawImage", "regular-atlas", 0, 5, 8, 5, 11.75, 1, 2.25, 1.40625),
  traceEntry('composite', "restore"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 14, 1, 2.25, 1.40625),
  traceEntry('composite', "clip"),
  traceEntry('composite', "setFillStyle", "#e5e7eb"),
  traceEntry('composite', "drawImage", "regular-atlas", 0, 5, 8, 5, 14, 1, 2.25, 1.40625),
  traceEntry('composite', "restore"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 16.25, 1, 2.25, 1.40625),
  traceEntry('composite', "clip"),
  traceEntry('composite', "setFillStyle", "#e5e7eb"),
  traceEntry('composite', "drawImage", "regular-atlas", 0, 5, 8, 5, 16.25, 1, 2.25, 1.40625),
  traceEntry('composite', "restore"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 18.5, 1, 2.25, 1.40625),
  traceEntry('composite', "clip"),
  traceEntry('composite', "setFillStyle", "#e5e7eb"),
  traceEntry('composite', "drawImage", "regular-atlas", 0, 5, 8, 5, 18.5, 1, 2.25, 1.40625),
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
  traceEntry('composite', "setFillStyle", "#ef4444"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 44, 1, 20, 12),
  traceEntry('composite', "clip"),
  traceEntry('composite', "fillRect", 44, 1, 20, 12),
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
  traceEntry('composite', "rect", 66, 3, 20, 8),
  traceEntry('composite', "clip"),
  traceEntry('composite', "fillRect", 66, 3, 20, 8),
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
  traceEntry('composite', "fillRect", 5, 0, 20.25, 2.25),
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
  traceEntry('composite', "fillRect", 5, 1, 15.75, 2.25),
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
  traceEntry('composite', "rect", 5, 0, 2.25, 1.40625),
  traceEntry('composite', "clip"),
  traceEntry('composite', "setFillStyle", "#e5e7eb"),
  traceEntry('composite', "drawImage", "regular-atlas", 0, 5, 8, 5, 5, 0, 2.25, 1.40625),
  traceEntry('composite', "restore"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 7.25, 0, 2.25, 1.40625),
  traceEntry('composite', "clip"),
  traceEntry('composite', "setFillStyle", "#e5e7eb"),
  traceEntry('composite', "drawImage", "regular-atlas", 0, 5, 8, 5, 7.25, 0, 2.25, 1.40625),
  traceEntry('composite', "restore"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 9.5, 0, 2.25, 1.40625),
  traceEntry('composite', "clip"),
  traceEntry('composite', "setFillStyle", "#e5e7eb"),
  traceEntry('composite', "drawImage", "regular-atlas", 0, 5, 8, 5, 9.5, 0, 2.25, 1.40625),
  traceEntry('composite', "restore"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 11.75, 0, 2.25, 1.40625),
  traceEntry('composite', "clip"),
  traceEntry('composite', "setFillStyle", "#e5e7eb"),
  traceEntry('composite', "drawImage", "regular-atlas", 0, 5, 8, 5, 11.75, 0, 2.25, 1.40625),
  traceEntry('composite', "restore"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 14, 0, 2.25, 1.40625),
  traceEntry('composite', "clip"),
  traceEntry('composite', "setFillStyle", "#e5e7eb"),
  traceEntry('composite', "drawImage", "regular-atlas", 0, 5, 8, 5, 14, 0, 2.25, 1.40625),
  traceEntry('composite', "restore"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 16.25, 0, 2.25, 1.40625),
  traceEntry('composite', "clip"),
  traceEntry('composite', "setFillStyle", "#e5e7eb"),
  traceEntry('composite', "drawImage", "regular-atlas", 0, 5, 8, 5, 16.25, 0, 2.25, 1.40625),
  traceEntry('composite', "restore"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 18.5, 0, 2.25, 1.40625),
  traceEntry('composite', "clip"),
  traceEntry('composite', "setFillStyle", "#e5e7eb"),
  traceEntry('composite', "drawImage", "regular-atlas", 0, 5, 8, 5, 18.5, 0, 2.25, 1.40625),
  traceEntry('composite', "restore"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 20.75, 0, 2.25, 1.40625),
  traceEntry('composite', "clip"),
  traceEntry('composite', "setFillStyle", "#e5e7eb"),
  traceEntry('composite', "drawImage", "regular-atlas", 0, 5, 8, 5, 20.75, 0, 2.25, 1.40625),
  traceEntry('composite', "restore"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 23, 0, 2.25, 1.40625),
  traceEntry('composite', "clip"),
  traceEntry('composite', "setFillStyle", "#e5e7eb"),
  traceEntry('composite', "drawImage", "regular-atlas", 0, 5, 8, 5, 23, 0, 2.25, 1.40625),
  traceEntry('composite', "restore"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 5, 1, 2.25, 1.40625),
  traceEntry('composite', "clip"),
  traceEntry('composite', "setFillStyle", "#e5e7eb"),
  traceEntry('composite', "drawImage", "regular-atlas", 0, 5, 8, 5, 5, 1, 2.25, 1.40625),
  traceEntry('composite', "restore"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 7.25, 1, 2.25, 1.40625),
  traceEntry('composite', "clip"),
  traceEntry('composite', "setFillStyle", "#e5e7eb"),
  traceEntry('composite', "drawImage", "regular-atlas", 0, 5, 8, 5, 7.25, 1, 2.25, 1.40625),
  traceEntry('composite', "restore"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 9.5, 1, 2.25, 1.40625),
  traceEntry('composite', "clip"),
  traceEntry('composite', "setFillStyle", "#e5e7eb"),
  traceEntry('composite', "drawImage", "regular-atlas", 0, 5, 8, 5, 9.5, 1, 2.25, 1.40625),
  traceEntry('composite', "restore"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 11.75, 1, 2.25, 1.40625),
  traceEntry('composite', "clip"),
  traceEntry('composite', "setFillStyle", "#e5e7eb"),
  traceEntry('composite', "drawImage", "regular-atlas", 0, 5, 8, 5, 11.75, 1, 2.25, 1.40625),
  traceEntry('composite', "restore"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 14, 1, 2.25, 1.40625),
  traceEntry('composite', "clip"),
  traceEntry('composite', "setFillStyle", "#e5e7eb"),
  traceEntry('composite', "drawImage", "regular-atlas", 0, 5, 8, 5, 14, 1, 2.25, 1.40625),
  traceEntry('composite', "restore"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 16.25, 1, 2.25, 1.40625),
  traceEntry('composite', "clip"),
  traceEntry('composite', "setFillStyle", "#e5e7eb"),
  traceEntry('composite', "drawImage", "regular-atlas", 0, 5, 8, 5, 16.25, 1, 2.25, 1.40625),
  traceEntry('composite', "restore"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 18.5, 1, 2.25, 1.40625),
  traceEntry('composite', "clip"),
  traceEntry('composite', "setFillStyle", "#e5e7eb"),
  traceEntry('composite', "drawImage", "regular-atlas", 0, 5, 8, 5, 18.5, 1, 2.25, 1.40625),
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
  traceEntry('composite', "setFillStyle", "#ef4444"),
  traceEntry('composite', "save"),
  traceEntry('composite', "beginPath"),
  traceEntry('composite', "rect", 44, 1, 20, 12),
  traceEntry('composite', "clip"),
  traceEntry('composite', "fillRect", 44, 1, 20, 12),
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
  traceEntry('composite', "rect", 66, 3, 20, 8),
  traceEntry('composite', "clip"),
  traceEntry('composite', "fillRect", 66, 3, 20, 8),
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
  const rgbaMatchesDetachedA8 = (rgba: Uint8ClampedArray[] | undefined, alpha: readonly number[]): boolean => {
    if (rgba?.length !== 1 || rgba[0] === undefined || rgba[0].length !== alpha.length * 4) return false;
    const pixels = rgba[0];
    for (let index = 0; index < alpha.length; index += 1) {
      const offset = index * 4;
      if (pixels[offset] !== 229 || pixels[offset + 1] !== 231 || pixels[offset + 2] !== 235 || pixels[offset + 3] !== alpha[index]) return false;
    }
    return true;
  };
  const wrongRgb = regularStagedRgba[0]?.slice();
  if (wrongRgb !== undefined) wrongRgb[0] = wrongRgb[0] === 229 ? 228 : 229;
  const wrongAlpha = boldStagedRgba[0]?.slice();
  if (wrongAlpha !== undefined) wrongAlpha[3] = wrongAlpha[3] === boldBytes[0] ? (wrongAlpha[3] + 1) % 256 : boldBytes[0]!;
  familyCheck(
    'batch-6d-causal',
    'regular and bold atlas staging emits every literal RGBA byte from detached A8 data',
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
  const polygonPlan = forgedResult(paint, (_plan, layers) => {
    const polygon = layers[3]?.commands.find(command => command.entryId === KEEP_OUT_IDS.conversationOptionStackStart);
    if (polygon !== undefined) polygon.geometry = { kind: 'polygon', points: [{ x: 10, y: 10 }, { x: 20, y: 10 }, { x: 15, y: 20 }] };
  });
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
  check('polygon and unavailable keep-out overlays are retained', polygonResult.status === 'rendered' && polygonPlan.plan.keepOuts.some(command => command.geometry?.kind === 'polygon') && polygonPlan.plan.keepOuts.some(command => command.status === 'unavailable' && command.geometry === null) && traceEquals(polygonCompositeTrace, expectedPolygonTrace) && traceContainsSequence(polygonCompositeTrace, exactPolygonPath) && traceContainsSequence(polygonCompositeTrace, unavailableTrace), { keepOuts: polygonPlan.plan.keepOuts, exactPolygonPath, unavailableTrace, firstTraceDifference: firstTraceDifference(expectedPolygonTrace, polygonCompositeTrace) });
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
  check('post-validation canonical alpha mutation uses detached A8 bytes then refuses with no surface', alphaMutationReached && corpusWasMutated && stagedAlpha === callbackAlphaOriginal && traceEquals(alphaMutationFactoryTrace, callbackBaselineFactoryTrace) && alphaMutationResult?.status === 'refused' && alphaMutationResult.receipt.refusal.code === 'post-validation-mutation' && refusalBoundaryIsComplete(alphaMutationResult) && isX4UiCorpusCanonicalSuccess(corpus), {
    threw: alphaMutationAttempt?.threw,
    alphaMutationReached,
    corpusWasMutated,
    callbackAlphaOriginal,
    callbackAlphaMutated,
    stagedAlpha,
    preRepairUsedMutatedAlpha: stagedAlpha === callbackAlphaMutated,
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
  const familyCounts = (['prior-44', 'callback-isolation', 'pre-allocation', 'emitted-trace', 'freeze-truth', 'oracle-sensitivity', 'batch-6d-causal'] as const).map(family => {
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
