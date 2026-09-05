import { strict as assert } from 'node:assert';
import type { ModWorkspace, PassthroughFile } from '../types';
import {
  X4_UI_CORPUS_COLOR_CANONICAL_EVIDENCE,
  X4_UI_CORPUS_COLORS_XML_PATH,
  X4_UI_CORPUS_COLORS_XML_SHA256,
  X4_UI_CORPUS_COLORS_XML_SIZE,
  X4_UI_CORPUS_COLORS_XSD_PATH,
  X4_UI_CORPUS_COLORS_XSD_SHA256,
  X4_UI_CORPUS_COLORS_XSD_SIZE,
  X4_UI_CORPUS_9_00_CONTRACT,
  X4_UI_CORPUS_FILE_URL,
  X4_UI_CORPUS_MANIFEST_URL,
  X4_UI_CORPUS_STATUS_URL,
  X4_UI_CORPUS_VERIFICATION,
  isX4UiCorpusCanonicalColorSuccess,
  isX4UiCorpusCanonicalSuccess,
  loadConfiguredX4UiCorpusColorEvidence,
  loadCanonicalX4UiCorpusAssets,
  type X4UiCorpusCanonicalColorSuccess,
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

type ProxyTrapCounts = {
  total: number;
  get: number;
  getPrototypeOf: number;
  ownKeys: number;
  getOwnPropertyDescriptor: number;
};

type ProxyTrapField = Exclude<keyof ProxyTrapCounts, 'total'>;
type ProxyTrapVector = Readonly<ProxyTrapCounts>;

function armableTransparentProxy<T extends object>(
  target: T,
  counts: ProxyTrapCounts,
  state: { armed: boolean },
): T {
  const mark = (name: keyof Omit<ProxyTrapCounts, 'total'>): void => {
    if (state.armed) throw new Error('post-call proxy trap executed');
    counts.total += 1;
    counts[name] += 1;
  };
  return new Proxy(target, {
    get: (current, property, receiver) => {
      mark('get');
      return Reflect.get(current, property, receiver);
    },
    getPrototypeOf: current => {
      mark('getPrototypeOf');
      return Reflect.getPrototypeOf(current);
    },
    ownKeys: current => {
      mark('ownKeys');
      return Reflect.ownKeys(current);
    },
    getOwnPropertyDescriptor: (current, property) => {
      mark('getOwnPropertyDescriptor');
      return Reflect.getOwnPropertyDescriptor(current, property);
    },
  });
}

function proxyTrapCensusMatches(actual: unknown, expected: ProxyTrapVector): boolean {
  if (actual === null || typeof actual !== 'object' || Array.isArray(actual)) return false;
  const observed = actual as Partial<Record<keyof ProxyTrapCounts, unknown>>;
  return observed.total === expected.total
    && observed.get === expected.get
    && observed.getPrototypeOf === expected.getPrototypeOf
    && observed.ownKeys === expected.ownKeys
    && observed.getOwnPropertyDescriptor === expected.getOwnPropertyDescriptor;
}

function proxyTrapCountsWithDelta(expected: ProxyTrapVector, field: ProxyTrapField, delta: number): ProxyTrapCounts {
  const perturbed: ProxyTrapCounts = { ...expected };
  perturbed.total += delta;
  perturbed[field] += delta;
  return perturbed;
}

function assertProxyTrapCensusOracleSensitivity(expected: ProxyTrapVector): JsonRecord {
  const result = {
    accepted: proxyTrapCensusMatches(expected, expected),
    getPlusOneRejected: !proxyTrapCensusMatches(proxyTrapCountsWithDelta(expected, 'get', 1), expected),
    ownKeysPlusOneRejected: !proxyTrapCensusMatches(proxyTrapCountsWithDelta(expected, 'ownKeys', 1), expected),
    getPrototypeOfPlusOneRejected: !proxyTrapCensusMatches(proxyTrapCountsWithDelta(expected, 'getPrototypeOf', 1), expected),
    descriptorPlusOneRejected: !proxyTrapCensusMatches(proxyTrapCountsWithDelta(expected, 'getOwnPropertyDescriptor', 1), expected),
    descriptorMinusOneRejected: !proxyTrapCensusMatches(proxyTrapCountsWithDelta(expected, 'getOwnPropertyDescriptor', -1), expected),
  };
  assert.deepEqual(result, {
    accepted: true,
    getPlusOneRejected: true,
    ownKeysPlusOneRejected: true,
    getPrototypeOfPlusOneRejected: true,
    descriptorPlusOneRejected: true,
    descriptorMinusOneRejected: true,
  }, `Proxy trap census oracle sensitivity failed: ${JSON.stringify(result)}`);
  return result;
}

const SESSION_ONE_ITEM_CONTAINER_PROXY_TRAPS: ProxyTrapVector = {
  total: 4,
  get: 0,
  getPrototypeOf: 1,
  ownKeys: 1,
  getOwnPropertyDescriptor: 2,
};
const SESSION_DIRECT_CANDIDATE_PROXY_TRAPS: ProxyTrapVector = {
  total: 9,
  get: 0,
  getPrototypeOf: 1,
  ownKeys: 1,
  getOwnPropertyDescriptor: 7,
};
const SESSION_MIXED_CONTAINER_PROXY_TRAPS: ProxyTrapVector = {
  total: 7,
  get: 0,
  getPrototypeOf: 1,
  ownKeys: 1,
  getOwnPropertyDescriptor: 5,
};
const SESSION_TOCTOU_CANDIDATE_PROXY_TRAPS: ProxyTrapVector = {
  total: 9,
  get: 0,
  getPrototypeOf: 1,
  ownKeys: 1,
  getOwnPropertyDescriptor: 7,
};

type SessionCausalRow = {
  readonly name: string;
  readonly fixtureReady: boolean;
  readonly seamReached: boolean;
  readonly threw: boolean;
  readonly expected: string;
  readonly observed: unknown;
  readonly pass: boolean;
};

const sessionCausalRows: SessionCausalRow[] = [];

function recordSessionCausal(
  name: string,
  fixtureReady: boolean,
  expected: string,
  invoke: (markSeamReached: () => void) => unknown,
  accepts: (observed: unknown) => boolean,
): void {
  let seamReached = false;
  let threw = false;
  let observed: unknown;
  try {
    observed = invoke(() => { seamReached = true; });
  } catch (error) {
    threw = true;
    observed = { error: error instanceof Error ? error.message : String(error) };
  }
  sessionCausalRows.push({
    name,
    fixtureReady,
    seamReached,
    threw,
    expected,
    observed,
    pass: fixtureReady && seamReached && !threw && accepts(observed),
  });
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

function p7SessionPaddedUtf8(text: string, size: number): Uint8Array {
  const bytes = new TextEncoder().encode(text);
  if (bytes.byteLength > size) throw new Error(`EditorSession P7 color fixture exceeds ${size} bytes`);
  const padded = new Uint8Array(size);
  padded.set(bytes);
  padded.fill(0x20, bytes.byteLength);
  return padded;
}

async function loadP7SessionColorFixture(): Promise<X4UiCorpusCanonicalColorSuccess> {
  const root = 'editor-session-p7-color-root';
  const generation = 'editor-session-p7-color-generation';
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
  while (baseIds.length < 224) baseIds.push(`session_p7_base_${baseIds.length.toString().padStart(3, '0')}`);
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
  for (let index = mappings.length; index < 804; index += 1) mappings.push(`    <mapping id="session_p7_map_${index.toString().padStart(3, '0')}" ref="${baseIds[index % baseIds.length]}"/>`);
  const buffers = new Map<string, Uint8Array>([
    [X4_UI_CORPUS_COLORS_XML_PATH, p7SessionPaddedUtf8([
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
    [X4_UI_CORPUS_COLORS_XSD_PATH, p7SessionPaddedUtf8([
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">',
      '  <xs:simpleType name="identifier"><xs:restriction base="xs:string"><xs:pattern value="[a-zA-Z_][a-zA-Z0-9_]*"/></xs:restriction></xs:simpleType>',
      '</xs:schema>',
    ].join('\n'), X4_UI_CORPUS_COLORS_XSD_SIZE)],
  ]);
  const status = {
    available: true,
    root,
    generatedAt: '2026-08-19T00:00:00.000Z',
    manifestGeneration: generation,
    manifest: { available: true, state: 'ready', root, current: { generation, root, generatedAt: '2026-08-19T00:00:00.000Z' } },
  };
  const transport = async (url: string): Promise<X4UiCorpusFetchResponse> => {
    if (url === X4_UI_CORPUS_STATUS_URL) return jsonResponse(status);
    if (url.startsWith(`${X4_UI_CORPUS_MANIFEST_URL}?`)) {
      const path = pathFromQuery(url, 'q');
      const bytes = buffers.get(path);
      if (!bytes) throw new Error(`EditorSession P7 unknown color manifest path ${path}`);
      return jsonResponse({
        status: manifestStatus(root, generation),
        generation,
        total: 1,
        limit: 500,
        offset: 0,
        files: [{ path, bytes: bytes.byteLength }],
      });
    }
    if (url.startsWith(`${X4_UI_CORPUS_FILE_URL}?`)) {
      const path = pathFromQuery(url, 'path');
      const bytes = buffers.get(path);
      if (!bytes) throw new Error(`EditorSession P7 unknown color file path ${path}`);
      return bytesResponse(bytes, 200, 'application/xml');
    }
    throw new Error(`EditorSession P7 unexpected color URL ${url}`);
  };
  const result = await withCanonicalPlatformHash(
    [X4_UI_CORPUS_COLORS_XML_SHA256, X4_UI_CORPUS_COLORS_XSD_SHA256],
    () => loadConfiguredX4UiCorpusColorEvidence({ transport }),
  );
  if (!isX4UiCorpusCanonicalColorSuccess(result)) throw new Error(`EditorSession P7 color fixture failed: ${JSON.stringify(result)}`);
  if (result.evidenceKind !== X4_UI_CORPUS_COLOR_CANONICAL_EVIDENCE || result.verification !== X4_UI_CORPUS_VERIFICATION) throw new Error('EditorSession P7 color authority identity drifted');
  return result;
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

const p7ColorXml = [
  '<?xml version="1.0" encoding="utf-8"?>',
  '<addon name="editor-session-p7-colors">',
  '  <environment type="menus">',
  '    <file name="ui/p7-colors.lua" />',
  '</environment>',
  '</addon>',
  '',
].join('\n');

const p7ColorLua = [
  'local menu = { name = "EditorSessionP7Colors", layer = 1 }',
  'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80, layer = 1 })',
  'local table = frame:addTable(4, { width = 100, reserveScrollBar = false, scaling = false, backgroundColor = Color["table_background_default"] })',
  'table:setColWidth(1, 20, false)',
  'table:setColWidth(2, 20, false)',
  'table:setColWidth(3, 20, false)',
  'table:setColWidth(4, 20, false)',
  'local row = table:addRow(false, { paddingTop = 1, paddingBottom = 1, borderBelow = false, fixed = false, scaling = false })',
  'row[1]:setColSpan(1):createText("literal", { height = 12, minRowHeight = 10, color = { r = 12.5, g = 23.5, b = 34.5, a = 45.5, glow = 0.25 }, cellBGColor = Color["row_background"] })',
  'row[2]:createButton({ height = 12, bgcolor = Color["button_background_default"], highlightColor = Color["button_highlight_default"], borderColor = Color["button_border_default"] }):setText("primary", { color = Color["text_normal"] }):setText2("secondary", { color = { r = 15, g = 25, b = 35, a = 55 } })',
  'row[3]:createEditBox({ height = 12, bgColor = Color["editbox_background_default"] })',
  'row[4]:createIcon("icon", { height = 8, affectRowHeight = false, color = Color["text_normal"] })',
  'frame:display()',
  '',
].join('\n');
assert.match(p7ColorLua, /setColSpan\(1\)/, 'P7 cardinality fixture must retain the corrected span-1 cell');

const p7ColorSampleLua = [
  'local menu = { name = "EditorSessionP7ColorSamples", layer = 1 }',
  'function menu.display(tableWidth, dynamicText)',
  '  local frame = Helper.createFrameHandle(menu, { width = 100, height = 80, layer = 1 })',
  '  local table = frame:addTable(4, { width = tableWidth, reserveScrollBar = false, scaling = false, backgroundColor = Color["table_background_default"] })',
  '  table:setColWidth(1, 20, false)',
  '  table:setColWidth(2, 20, false)',
  '  table:setColWidth(3, 20, false)',
  '  table:setColWidth(4, 20, false)',
  '  local row = table:addRow(false, { paddingTop = 1, paddingBottom = 1, borderBelow = false, fixed = false, scaling = false })',
  '  row[1]:setColSpan(1):createText(dynamicText, { height = 12, minRowHeight = 10, color = Color["text_normal"], cellBGColor = Color["row_background"] })',
  '  row[2]:createButton({ height = 12, bgcolor = Color["button_background_default"], highlightColor = Color["button_highlight_default"], borderColor = Color["button_border_default"] }):setText("primary", { color = Color["text_normal"] }):setText2("secondary", { color = { r = 15, g = 25, b = 35, a = 55 } })',
  '  row[3]:createEditBox({ height = 12, bgColor = Color["editbox_background_default"] })',
  '  row[4]:createIcon("icon", { height = 8, affectRowHeight = false, color = Color["text_normal"] })',
  '  frame:display()',
  'end',
  '',
].join('\n');

function p7ColorWorkspace(path: string, content: string): ModWorkspace {
  return workspace([
    passthrough('ui.xml', p7ColorXml.replace('ui/p7-colors.lua', path)),
    passthrough(path, content, { reason: 'unparsed' }),
  ], { id: `editor-session-p7-${path}` });
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

type P7SessionColorOwner = {
  readonly field: string;
  readonly slot: string;
  readonly domain: string;
  readonly values: readonly [number, number, number, number];
};

const P7_SESSION_COLOR_OWNERS: readonly P7SessionColorOwner[] = [
  { field: 'backgroundColor', slot: 'table-background', domain: 'canonical-xml-byte-alpha', values: [11, 22, 33, 44] },
  { field: 'cellbgcolor', slot: 'cell-background', domain: 'canonical-xml-byte-alpha', values: [51, 52, 53, 54] },
  { field: 'bgcolor', slot: 'widget-background', domain: 'canonical-xml-byte-alpha', values: [61, 62, 63, 64] },
  { field: 'highlightcolor', slot: 'widget-highlight', domain: 'canonical-xml-byte-alpha', values: [71, 72, 73, 74] },
  { field: 'bordercolor', slot: 'widget-border', domain: 'canonical-xml-byte-alpha', values: [81, 82, 83, 84] },
  { field: 'color', slot: 'primary-text', domain: 'canonical-xml-byte-alpha', values: [101, 102, 103, 104] },
];

const P7_SESSION_PAINT_COLOR_OWNERS: readonly P7SessionColorOwner[] = P7_SESSION_COLOR_OWNERS.filter(owner => owner.slot !== 'table-background');

type P7SessionRow = {
  readonly name: string;
  readonly fixtureReady: boolean;
  readonly threw: boolean;
  readonly expected: string;
  readonly observed: unknown;
  readonly pass: boolean;
};

const p7SessionRows: P7SessionRow[] = [];

function p7SessionRecord(value: unknown): JsonRecord | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : undefined;
}

function p7SessionSceneRecord(result: unknown): JsonRecord | undefined {
  const projection = p7SessionRecord(result);
  const preview = p7SessionRecord(projection?.preview);
  const sceneResult = p7SessionRecord(preview?.scene);
  return p7SessionRecord(sceneResult?.scene);
}

function p7SessionSceneFacts(result: unknown): JsonRecord[] {
  const scene = p7SessionSceneRecord(result);
  if (scene === undefined) return [];
  const facts: JsonRecord[] = [];
  for (const collectionName of ['frames', 'tables', 'rows', 'cells', 'widgets', 'texts', 'gaps']) {
    const collection = scene[collectionName];
    if (!Array.isArray(collection)) continue;
    for (const node of collection) {
      const record = p7SessionRecord(node);
      const colorFacts = record?.colorFacts;
      if (!Array.isArray(colorFacts)) continue;
      for (const fact of colorFacts) {
        const factRecord = p7SessionRecord(fact);
        if (factRecord !== undefined) facts.push(factRecord);
      }
    }
  }
  return facts;
}

function p7SessionPaintTintsWithOwner(
  result: unknown,
  ownerFromCommand: (command: JsonRecord) => unknown,
): JsonRecord[] {
  const projection = p7SessionRecord(result);
  const paint = p7SessionRecord(projection?.paint);
  const plan = p7SessionRecord(paint?.plan);
  const layers = plan?.layers;
  if (!Array.isArray(layers)) return [];
  const tints: JsonRecord[] = [];
  for (const layer of layers) {
    const layerRecord = p7SessionRecord(layer);
    const commands = layerRecord?.commands;
    if (!Array.isArray(commands)) continue;
    for (const command of commands) {
      const commandRecord = p7SessionRecord(command);
      if (commandRecord === undefined) continue;
      const commandTints = commandRecord.basePreviewTints;
      if (!Array.isArray(commandTints)) continue;
      for (const tint of commandTints) {
        const tintRecord = p7SessionRecord(tint);
        if (tintRecord !== undefined) tints.push({ ...tintRecord, ownerId: ownerFromCommand(commandRecord) });
      }
    }
  }
  return tints;
}

function p7SessionPaintTints(result: unknown): JsonRecord[] {
  return p7SessionPaintTintsWithOwner(result, command => command.nodeId);
}

function p7SessionLegacyNodeIdFallbackPaintTints(result: unknown): JsonRecord[] {
  return p7SessionPaintTintsWithOwner(result, command => command.nodeId ?? command.id);
}

type P7SessionCardinalities = {
  readonly frames: number;
  readonly tables: number;
  readonly rows: number;
  readonly cells: number;
  readonly widgets: number;
  readonly texts: number;
  readonly colorFacts: number;
  readonly paintTints: number;
};

const P7_SESSION_EXPECTED_CARDINALITIES: P7SessionCardinalities = Object.freeze({
  frames: 1,
  tables: 1,
  rows: 1,
  cells: 4,
  widgets: 4,
  texts: 6,
  colorFacts: 13,
  paintTints: 31,
});

const P7_SESSION_EXPECTED_FACT_OWNERS = Object.freeze({
  'backgroundColor|table-background|canonical-xml-byte-alpha|11,22,33,44|table_background_default': 1,
  'bgcolor|widget-background|canonical-xml-byte-alpha|61,62,63,64|button_background_default': 1,
  'bgcolor|widget-background|canonical-xml-byte-alpha|91,92,93,94|editbox_background_default': 1,
  'bordercolor|widget-border|canonical-xml-byte-alpha|81,82,83,84|button_border_default': 1,
  'cellbgcolor|cell-background|canonical-xml-byte-alpha|51,52,53,54|row_background': 4,
  'color|primary-text|canonical-xml-byte-alpha|101,102,103,104|text_normal': 1,
  'color|primary-text|source-literal-percent-alpha|12.5,23.5,34.5,45.5|': 1,
  'color|secondary-text|source-literal-percent-alpha|15,25,35,55|': 1,
  'color|widget-icon|canonical-xml-byte-alpha|101,102,103,104|text_normal': 1,
  'highlightcolor|widget-highlight|canonical-xml-byte-alpha|71,72,73,74|button_highlight_default': 1,
});

type P7SessionPaintExpectedEntry = {
  readonly field: string;
  readonly slot: string;
  readonly domain: string;
  readonly values: readonly number[];
  readonly requestedId: string;
  readonly ownerId: string;
  readonly count: number;
};

const P7_SESSION_CANONICAL_COLOR_DOMAIN = 'canonical-xml-byte-alpha';
const P7_SESSION_LITERAL_COLOR_DOMAIN = 'source-literal-percent-alpha';

const P7_SESSION_SELECTED_CELL_OWNER_PREFIX = 'scene:cell:table:table|table|call|ui/p7-colors.lua||3:14:159|3:144:289|frame|||row:row|row|call|ui/p7-colors.lua||8:12:430|8:123:541|table|||';
const P7_SESSION_SELECTED_WIDGET_OWNER_PREFIX = 'scene:widget:cell:table:table|table|call|ui/p7-colors.lua||3:14:159|3:144:289|frame|||row:row|row|call|ui/p7-colors.lua||8:12:430|8:123:541|table|||';
const P7_SESSION_SELECTED_TEXT_OWNER_PREFIX = 'scene:text:cell:table:table|table|call|ui/p7-colors.lua||3:14:159|3:144:289|frame|||row:row|row|call|ui/p7-colors.lua||8:12:430|8:123:541|table|||';
const P7_SESSION_SAMPLED_CELL_OWNER_PREFIX = 'scene:cell:table:table|table|call|ui/p7-color-samples.lua||4:16:216|4:153:353|frame|||row:row|row|call|ui/p7-color-samples.lua||9:14:504|9:125:615|table|||';
const P7_SESSION_SAMPLED_WIDGET_OWNER_PREFIX = 'scene:widget:cell:table:table|table|call|ui/p7-color-samples.lua||4:16:216|4:153:353|frame|||row:row|row|call|ui/p7-color-samples.lua||9:14:504|9:125:615|table|||';
const P7_SESSION_SAMPLED_TEXT_OWNER_PREFIX = 'scene:text:cell:table:table|table|call|ui/p7-color-samples.lua||4:16:216|4:153:353|frame|||row:row|row|call|ui/p7-color-samples.lua||9:14:504|9:125:615|table|||';

function p7SessionPaintExpectedEntry(
  field: string,
  slot: string,
  domain: string,
  values: readonly number[],
  requestedId: string,
  ownerId: string,
  count = 1,
): P7SessionPaintExpectedEntry {
  return { field, slot, domain, values, requestedId, ownerId, count };
}

function p7SessionPaintExpectedGlyphEntries(
  field: string,
  slot: string,
  domain: string,
  values: readonly number[],
  requestedId: string,
  ownerId: string,
  glyphCount: number,
): P7SessionPaintExpectedEntry[] {
  const base = p7SessionPaintExpectedEntry(field, slot, domain, values, requestedId, ownerId);
  return [
    base,
    ...Array.from({ length: glyphCount }, (_, glyph) => p7SessionPaintExpectedEntry(
      field,
      slot,
      domain,
      values,
      requestedId,
      `${ownerId}:line:0:glyph:${glyph}`,
    )),
  ];
}

function p7SessionPaintExpectedKey(entry: P7SessionPaintExpectedEntry): string {
  return [entry.field, entry.slot, entry.domain, entry.values.join(','), entry.requestedId, entry.ownerId].join('|');
}

function p7SessionPaintExpectedMultiplicity(entries: readonly P7SessionPaintExpectedEntry[]): JsonRecord {
  return Object.freeze(Object.fromEntries(
    entries
      .map(entry => [p7SessionPaintExpectedKey(entry), entry.count] as const)
      .sort(([left], [right]) => left.localeCompare(right)),
  ));
}

const P7_SESSION_EXPECTED_SELECTED_PAINT_OWNERS = p7SessionPaintExpectedMultiplicity([
  p7SessionPaintExpectedEntry('cellbgcolor', 'cell-background', P7_SESSION_CANONICAL_COLOR_DOMAIN, [51, 52, 53, 54], 'row_background', `${P7_SESSION_SELECTED_CELL_OWNER_PREFIX}1`),
  ...p7SessionPaintExpectedGlyphEntries('color', 'primary-text', P7_SESSION_LITERAL_COLOR_DOMAIN, [12.5, 23.5, 34.5, 45.5], '', `${P7_SESSION_SELECTED_TEXT_OWNER_PREFIX}1:primary`, 7),
  p7SessionPaintExpectedEntry('cellbgcolor', 'cell-background', P7_SESSION_CANONICAL_COLOR_DOMAIN, [51, 52, 53, 54], 'row_background', `${P7_SESSION_SELECTED_CELL_OWNER_PREFIX}2`),
  p7SessionPaintExpectedEntry('bgcolor', 'widget-background', P7_SESSION_CANONICAL_COLOR_DOMAIN, [61, 62, 63, 64], 'button_background_default', `${P7_SESSION_SELECTED_WIDGET_OWNER_PREFIX}2:button`),
  p7SessionPaintExpectedEntry('highlightcolor', 'widget-highlight', P7_SESSION_CANONICAL_COLOR_DOMAIN, [71, 72, 73, 74], 'button_highlight_default', `${P7_SESSION_SELECTED_WIDGET_OWNER_PREFIX}2:button`),
  p7SessionPaintExpectedEntry('bordercolor', 'widget-border', P7_SESSION_CANONICAL_COLOR_DOMAIN, [81, 82, 83, 84], 'button_border_default', `${P7_SESSION_SELECTED_WIDGET_OWNER_PREFIX}2:button`),
  ...p7SessionPaintExpectedGlyphEntries('color', 'primary-text', P7_SESSION_CANONICAL_COLOR_DOMAIN, [101, 102, 103, 104], 'text_normal', `${P7_SESSION_SELECTED_TEXT_OWNER_PREFIX}2:primary`, 6),
  ...p7SessionPaintExpectedGlyphEntries('color', 'secondary-text', P7_SESSION_LITERAL_COLOR_DOMAIN, [15, 25, 35, 55], '', `${P7_SESSION_SELECTED_TEXT_OWNER_PREFIX}2:secondary`, 6),
  p7SessionPaintExpectedEntry('cellbgcolor', 'cell-background', P7_SESSION_CANONICAL_COLOR_DOMAIN, [51, 52, 53, 54], 'row_background', `${P7_SESSION_SELECTED_CELL_OWNER_PREFIX}3`),
  p7SessionPaintExpectedEntry('bgcolor', 'widget-background', P7_SESSION_CANONICAL_COLOR_DOMAIN, [91, 92, 93, 94], 'editbox_background_default', `${P7_SESSION_SELECTED_WIDGET_OWNER_PREFIX}3:editbox`),
  p7SessionPaintExpectedEntry('cellbgcolor', 'cell-background', P7_SESSION_CANONICAL_COLOR_DOMAIN, [51, 52, 53, 54], 'row_background', `${P7_SESSION_SELECTED_CELL_OWNER_PREFIX}4`),
  p7SessionPaintExpectedEntry('color', 'widget-icon', P7_SESSION_CANONICAL_COLOR_DOMAIN, [101, 102, 103, 104], 'text_normal', `${P7_SESSION_SELECTED_WIDGET_OWNER_PREFIX}4:icon`),
]);

const P7_SESSION_EXPECTED_SAMPLED_PAINT_OWNERS = p7SessionPaintExpectedMultiplicity([
  p7SessionPaintExpectedEntry('cellbgcolor', 'cell-background', P7_SESSION_CANONICAL_COLOR_DOMAIN, [51, 52, 53, 54], 'row_background', `${P7_SESSION_SAMPLED_CELL_OWNER_PREFIX}1`),
  ...p7SessionPaintExpectedGlyphEntries('color', 'primary-text', P7_SESSION_CANONICAL_COLOR_DOMAIN, [101, 102, 103, 104], 'text_normal', `${P7_SESSION_SAMPLED_TEXT_OWNER_PREFIX}1:primary`, 7),
  p7SessionPaintExpectedEntry('cellbgcolor', 'cell-background', P7_SESSION_CANONICAL_COLOR_DOMAIN, [51, 52, 53, 54], 'row_background', `${P7_SESSION_SAMPLED_CELL_OWNER_PREFIX}2`),
  p7SessionPaintExpectedEntry('bgcolor', 'widget-background', P7_SESSION_CANONICAL_COLOR_DOMAIN, [61, 62, 63, 64], 'button_background_default', `${P7_SESSION_SAMPLED_WIDGET_OWNER_PREFIX}2:button`),
  p7SessionPaintExpectedEntry('highlightcolor', 'widget-highlight', P7_SESSION_CANONICAL_COLOR_DOMAIN, [71, 72, 73, 74], 'button_highlight_default', `${P7_SESSION_SAMPLED_WIDGET_OWNER_PREFIX}2:button`),
  p7SessionPaintExpectedEntry('bordercolor', 'widget-border', P7_SESSION_CANONICAL_COLOR_DOMAIN, [81, 82, 83, 84], 'button_border_default', `${P7_SESSION_SAMPLED_WIDGET_OWNER_PREFIX}2:button`),
  ...p7SessionPaintExpectedGlyphEntries('color', 'primary-text', P7_SESSION_CANONICAL_COLOR_DOMAIN, [101, 102, 103, 104], 'text_normal', `${P7_SESSION_SAMPLED_TEXT_OWNER_PREFIX}2:primary`, 6),
  ...p7SessionPaintExpectedGlyphEntries('color', 'secondary-text', P7_SESSION_LITERAL_COLOR_DOMAIN, [15, 25, 35, 55], '', `${P7_SESSION_SAMPLED_TEXT_OWNER_PREFIX}2:secondary`, 6),
  p7SessionPaintExpectedEntry('cellbgcolor', 'cell-background', P7_SESSION_CANONICAL_COLOR_DOMAIN, [51, 52, 53, 54], 'row_background', `${P7_SESSION_SAMPLED_CELL_OWNER_PREFIX}3`),
  p7SessionPaintExpectedEntry('bgcolor', 'widget-background', P7_SESSION_CANONICAL_COLOR_DOMAIN, [91, 92, 93, 94], 'editbox_background_default', `${P7_SESSION_SAMPLED_WIDGET_OWNER_PREFIX}3:editbox`),
  p7SessionPaintExpectedEntry('cellbgcolor', 'cell-background', P7_SESSION_CANONICAL_COLOR_DOMAIN, [51, 52, 53, 54], 'row_background', `${P7_SESSION_SAMPLED_CELL_OWNER_PREFIX}4`),
  p7SessionPaintExpectedEntry('color', 'widget-icon', P7_SESSION_CANONICAL_COLOR_DOMAIN, [101, 102, 103, 104], 'text_normal', `${P7_SESSION_SAMPLED_WIDGET_OWNER_PREFIX}4:icon`),
]);

const P7_SESSION_EXPECTED_PAINT_OWNERS = P7_SESSION_EXPECTED_SELECTED_PAINT_OWNERS;

type P7SessionShapeExpectation = {
  readonly cardinalities: P7SessionCardinalities;
  readonly factOwners: JsonRecord;
  readonly paintOwners: JsonRecord;
  readonly wrongPaintOwnerId: string;
  readonly sameColorOwnerPair: readonly [string, string];
};

const P7_SESSION_EXPECTED_SELECTED_SHAPE: P7SessionShapeExpectation = Object.freeze({
  cardinalities: P7_SESSION_EXPECTED_CARDINALITIES,
  factOwners: P7_SESSION_EXPECTED_FACT_OWNERS,
  paintOwners: P7_SESSION_EXPECTED_PAINT_OWNERS,
  wrongPaintOwnerId: `${P7_SESSION_SELECTED_CELL_OWNER_PREFIX}1`,
  sameColorOwnerPair: [`${P7_SESSION_SELECTED_CELL_OWNER_PREFIX}1`, `${P7_SESSION_SELECTED_CELL_OWNER_PREFIX}2`] as const,
});

const P7_SESSION_EXPECTED_SAMPLED_SHAPE: P7SessionShapeExpectation = Object.freeze({
  cardinalities: P7_SESSION_EXPECTED_CARDINALITIES,
  factOwners: Object.freeze(Object.fromEntries(
    Object.entries(P7_SESSION_EXPECTED_FACT_OWNERS)
      .filter(([key]) => !key.includes('color|primary-text|source-literal-percent-alpha|12.5,23.5,34.5,45.5|'))
      .map(([key, count]) => [key, key === 'color|primary-text|canonical-xml-byte-alpha|101,102,103,104|text_normal' ? 2 : count]),
  )),
  paintOwners: P7_SESSION_EXPECTED_SAMPLED_PAINT_OWNERS,
  wrongPaintOwnerId: `${P7_SESSION_SAMPLED_CELL_OWNER_PREFIX}1`,
  sameColorOwnerPair: [`${P7_SESSION_SAMPLED_CELL_OWNER_PREFIX}1`, `${P7_SESSION_SAMPLED_CELL_OWNER_PREFIX}2`] as const,
});

function p7SessionColorSignature(fact: JsonRecord): string {
  const value = p7SessionRecord(fact.value);
  return [
    String(fact.field ?? ''),
    String(fact.slot ?? ''),
    String(value?.domain ?? ''),
    [value?.r, value?.g, value?.b, value?.a].join(','),
    String(value?.requestedId ?? value?.expression ?? ''),
  ].join('|');
}

function p7SessionColorMultiplicity(values: JsonRecord[]): JsonRecord {
  const counts = new Map<string, number>();
  for (const value of values) {
    const key = p7SessionColorSignature(value);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Object.fromEntries([...counts.entries()].sort(([left], [right]) => left.localeCompare(right)));
}

function p7SessionPaintSignature(tint: JsonRecord): string {
  return `${p7SessionColorSignature(tint)}|${String(tint.ownerId ?? '')}`;
}

function p7SessionPaintMultiplicity(values: JsonRecord[]): JsonRecord {
  const counts = new Map<string, number>();
  for (const value of values) {
    const key = p7SessionPaintSignature(value);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Object.fromEntries([...counts.entries()].sort(([left], [right]) => left.localeCompare(right)));
}

function p7SessionLegacyPaintSignature(exactKey: string): string {
  let separators = 0;
  for (let index = 0; index < exactKey.length; index += 1) {
    if (exactKey[index] !== '|') continue;
    separators += 1;
    if (separators === 5) return exactKey.slice(0, index);
  }
  return exactKey;
}

function p7SessionLegacyPaintExpectedMultiplicity(expectedPaintOwners: JsonRecord): JsonRecord {
  const counts = new Map<string, number>();
  for (const [exactKey, count] of Object.entries(expectedPaintOwners)) {
    if (typeof count !== 'number') continue;
    const legacyKey = p7SessionLegacyPaintSignature(exactKey);
    counts.set(legacyKey, (counts.get(legacyKey) ?? 0) + count);
  }
  return Object.fromEntries([...counts.entries()].sort(([left], [right]) => left.localeCompare(right)));
}

function p7SessionExactShape(result: unknown, expected: P7SessionShapeExpectation = P7_SESSION_EXPECTED_SELECTED_SHAPE): boolean {
  try {
    assert.deepEqual(p7SessionCardinalities(result), expected.cardinalities);
    assert.deepEqual(p7SessionColorMultiplicity(p7SessionSceneFacts(result)), expected.factOwners);
    assert.deepEqual(p7SessionPaintMultiplicity(p7SessionPaintTints(result)), expected.paintOwners);
    assert.equal(p7SessionProjectionHasColorOwners(result, expected), true);
    return true;
  } catch {
    return false;
  }
}

function p7SessionPaintCommands(result: unknown): JsonRecord[] {
  const projection = p7SessionRecord(result);
  const paint = p7SessionRecord(projection?.paint);
  const plan = p7SessionRecord(paint?.plan);
  if (!Array.isArray(plan?.layers)) return [];
  const commands: JsonRecord[] = [];
  for (const layer of plan.layers) {
    const layerRecord = p7SessionRecord(layer);
    if (!Array.isArray(layerRecord?.commands)) continue;
    for (const command of layerRecord.commands) {
      const commandRecord = p7SessionRecord(command);
      if (commandRecord !== undefined) commands.push(commandRecord);
    }
  }
  return commands;
}

function p7SessionPaintCommandOwner(command: JsonRecord): string | undefined {
  const ownerId = command.nodeId;
  return typeof ownerId === 'string' ? ownerId : undefined;
}

function p7SessionSetPaintCommandOwner(command: JsonRecord, ownerId: string): void {
  const hasNodeId = Object.hasOwn(command, 'nodeId');
  const hasId = Object.hasOwn(command, 'id');
  if (hasNodeId) command.nodeId = ownerId;
  if (hasId) command.id = ownerId;
  if (!hasNodeId && !hasId) command.nodeId = ownerId;
}

function p7SessionPaintCommandForOwner(result: unknown, ownerId: string): JsonRecord | undefined {
  return p7SessionPaintCommands(result).find(command => p7SessionPaintCommandOwner(command) === ownerId);
}

function p7SessionPaintCommandHasColor(command: JsonRecord, signature: string): boolean {
  const tints = command.basePreviewTints;
  return Array.isArray(tints) && tints.some(tint => {
    const tintRecord = p7SessionRecord(tint);
    return tintRecord !== undefined && p7SessionColorSignature(tintRecord) === signature;
  });
}

function p7SessionLegacyProjectionHasColorOwners(result: unknown): boolean {
  const facts = p7SessionSceneFacts(result);
  const tints = p7SessionPaintTints(result);
  return P7_SESSION_COLOR_OWNERS.every(owner => facts.some(fact => p7SessionColorFactMatches(fact, owner)))
    && P7_SESSION_PAINT_COLOR_OWNERS.every(owner => tints.some(tint => p7SessionColorFactMatches(tint, owner) && typeof tint.ownerId === 'string'));
}

function p7SessionLegacyExactShape(result: unknown, expected: P7SessionShapeExpectation): boolean {
  try {
    assert.deepEqual(p7SessionCardinalities(result), expected.cardinalities);
    assert.deepEqual(p7SessionColorMultiplicity(p7SessionSceneFacts(result)), expected.factOwners);
    assert.deepEqual(p7SessionColorMultiplicity(p7SessionPaintTints(result)), p7SessionLegacyPaintExpectedMultiplicity(expected.paintOwners));
    assert.equal(p7SessionLegacyProjectionHasColorOwners(result), true);
    return true;
  } catch {
    return false;
  }
}

function p7SessionLegacyNodeIdFallbackExactShape(result: unknown, expected: P7SessionShapeExpectation): boolean {
  const tints = p7SessionLegacyNodeIdFallbackPaintTints(result);
  try {
    assert.deepEqual(p7SessionCardinalities(result), expected.cardinalities);
    assert.deepEqual(p7SessionColorMultiplicity(p7SessionSceneFacts(result)), expected.factOwners);
    assert.deepEqual(p7SessionPaintMultiplicity(tints), expected.paintOwners);
    assert.equal(tints.every(tint => typeof tint.ownerId === 'string'), true);
    return true;
  } catch {
    return false;
  }
}

function p7SessionWrongPaintOwnerMutation(result: JsonRecord, expected: P7SessionShapeExpectation): JsonRecord | undefined {
  const mutated = p7SessionColorClone(result);
  const command = p7SessionPaintCommandForOwner(mutated, expected.wrongPaintOwnerId);
  if (command === undefined) return undefined;
  p7SessionSetPaintCommandOwner(command, 'p7-session-wrong-paint-owner');
  return mutated;
}

function p7SessionSameColorOwnerMutation(result: JsonRecord, expected: P7SessionShapeExpectation): JsonRecord | undefined {
  const mutated = p7SessionColorClone(result);
  const [firstOwner, secondOwner] = expected.sameColorOwnerPair;
  const first = p7SessionPaintCommandForOwner(mutated, firstOwner);
  const second = p7SessionPaintCommandForOwner(mutated, secondOwner);
  const sameColorSignature = 'cellbgcolor|cell-background|canonical-xml-byte-alpha|51,52,53,54|row_background';
  if (first === undefined || second === undefined || !p7SessionPaintCommandHasColor(first, sameColorSignature) || !p7SessionPaintCommandHasColor(second, sameColorSignature)) return undefined;
  p7SessionSetPaintCommandOwner(first, secondOwner);
  return mutated;
}

type P7SessionMissingNodeIdMutation = {
  readonly result: JsonRecord;
  readonly nodeIdDeleted: boolean;
  readonly originalHadOwnId: boolean;
  readonly originalId: unknown;
  readonly originalIdUnchanged: boolean;
  readonly tintDataPreserved: boolean;
};

function p7SessionMissingNodeIdMutation(result: JsonRecord, expectedOwnerId: string): P7SessionMissingNodeIdMutation | undefined {
  const mutated = p7SessionColorClone(result);
  const command = p7SessionPaintCommandForOwner(mutated, expectedOwnerId);
  if (command === undefined || !Array.isArray(command.basePreviewTints)) return undefined;
  const hadExpectedNodeId = Object.hasOwn(command, 'nodeId') && command.nodeId === expectedOwnerId;
  const originalHadOwnId = Object.hasOwn(command, 'id');
  const originalId = command.id;
  const tintDataBefore = JSON.stringify(command.basePreviewTints);
  Reflect.deleteProperty(command, 'nodeId');
  return {
    result: mutated,
    nodeIdDeleted: hadExpectedNodeId && !Object.hasOwn(command, 'nodeId'),
    originalHadOwnId,
    originalId,
    originalIdUnchanged: Object.hasOwn(command, 'id') === originalHadOwnId && Object.is(command.id, originalId),
    tintDataPreserved: JSON.stringify(command.basePreviewTints) === tintDataBefore,
  };
}

const P7_SESSION_STATIC_FALLBACK_OWNER = 'p7-static-tint-owner';
const P7_SESSION_STATIC_FALLBACK_EXPECTED_PAINT = Object.freeze({
  [`color|primary-text|source-literal-percent-alpha|1,2,3,4||${P7_SESSION_STATIC_FALLBACK_OWNER}`]: 1,
});

function p7SessionStaticNodeIdFallbackFixture(): JsonRecord {
  return {
    paint: {
      plan: {
        layers: [{
          commands: [{
            id: P7_SESSION_STATIC_FALLBACK_OWNER,
            nodeId: P7_SESSION_STATIC_FALLBACK_OWNER,
            basePreviewTints: [{
              field: 'color',
              slot: 'primary-text',
              value: { domain: P7_SESSION_LITERAL_COLOR_DOMAIN, r: 1, g: 2, b: 3, a: 4 },
            }],
          }],
        }],
      },
    },
  };
}

function p7SessionStaticNodeIdOwnerOracle(
  result: unknown,
  extractTints: (value: unknown) => JsonRecord[],
): boolean {
  try {
    const tints = extractTints(result);
    assert.equal(tints.length, 1);
    assert.deepEqual(p7SessionPaintMultiplicity(tints), P7_SESSION_STATIC_FALLBACK_EXPECTED_PAINT);
    return true;
  } catch {
    return false;
  }
}

function p7SessionShapeEvidence(result: unknown, expected: P7SessionShapeExpectation = P7_SESSION_EXPECTED_SELECTED_SHAPE): JsonRecord {
  const resultRecord = p7SessionRecord(result);
  let duplicateRejected = false;
  let driftRejected = false;
  let legacyWrongPaintOwnerAccepted = false;
  let wrongPaintOwnerRejected = false;
  let legacySameColorOwnerMutationAccepted = false;
  let sameColorMutationPreservesCardinality = false;
  let sameColorMutationPreservesNonOwnerColorSignature = false;
  let sameColorOwnerMutationRejected = false;
  let missingNodeIdDeleted = false;
  let missingNodeIdOriginalHadOwnId = false;
  let missingNodeIdOriginalId: unknown;
  let missingNodeIdOriginalIdUnchanged = false;
  let missingNodeIdTintDataPreserved = false;
  let missingNodeIdPreservesCardinality = false;
  let missingNodeIdPreservesNonOwnerColorSignature = false;
  let productionLegacyNodeIdFallbackAccepted = false;
  let staticFallbackBaselineAccepted = false;
  let staticFallbackNodeIdDeleted = false;
  let staticFallbackOriginalHadOwnId = false;
  let staticFallbackOriginalId: unknown;
  let staticFallbackOriginalIdUnchanged = false;
  let staticFallbackOriginalIdSupportsOwner = false;
  let staticFallbackTintDataPreserved = false;
  let staticFallbackPreservesCardinality = false;
  let staticFallbackPreservesNonOwnerColorSignature = false;
  let legacyNodeIdFallbackAccepted = false;
  let staticFallbackRejected = false;
  let missingNodeIdRejected = false;
  if (resultRecord !== undefined) {
    const duplicate = p7SessionColorClone(resultRecord);
    const duplicateScene = p7SessionSceneRecord(duplicate);
    if (Array.isArray(duplicateScene?.frames) && duplicateScene.frames.length > 0) duplicateScene.frames.push(duplicateScene.frames[0]);
    duplicateRejected = !p7SessionExactShape(duplicate, expected);

    const drift = p7SessionColorClone(resultRecord);
    const driftFact = p7SessionSceneFacts(drift)[0];
    if (driftFact !== undefined) driftFact.slot = 'drifted-owner';
    driftRejected = !p7SessionExactShape(drift, expected);

    const wrongOwner = p7SessionWrongPaintOwnerMutation(resultRecord, expected);
    if (wrongOwner !== undefined) {
      legacyWrongPaintOwnerAccepted = p7SessionLegacyExactShape(wrongOwner, expected);
      wrongPaintOwnerRejected = legacyWrongPaintOwnerAccepted && !p7SessionExactShape(wrongOwner, expected);
    }

    const sameColorMutation = p7SessionSameColorOwnerMutation(resultRecord, expected);
    if (sameColorMutation !== undefined) {
      sameColorMutationPreservesCardinality = JSON.stringify(p7SessionCardinalities(sameColorMutation)) === JSON.stringify(p7SessionCardinalities(resultRecord));
      sameColorMutationPreservesNonOwnerColorSignature = JSON.stringify(p7SessionColorMultiplicity(p7SessionPaintTints(sameColorMutation))) === JSON.stringify(p7SessionColorMultiplicity(p7SessionPaintTints(resultRecord)));
      legacySameColorOwnerMutationAccepted = p7SessionLegacyExactShape(sameColorMutation, expected);
      sameColorOwnerMutationRejected = legacySameColorOwnerMutationAccepted && !p7SessionExactShape(sameColorMutation, expected);
    }

    const missingNodeIdMutation = p7SessionMissingNodeIdMutation(resultRecord, expected.wrongPaintOwnerId);
    if (missingNodeIdMutation !== undefined) {
      missingNodeIdDeleted = missingNodeIdMutation.nodeIdDeleted;
      missingNodeIdOriginalHadOwnId = missingNodeIdMutation.originalHadOwnId;
      missingNodeIdOriginalId = missingNodeIdMutation.originalId;
      missingNodeIdOriginalIdUnchanged = missingNodeIdMutation.originalIdUnchanged;
      missingNodeIdTintDataPreserved = missingNodeIdMutation.tintDataPreserved;
      missingNodeIdPreservesCardinality = JSON.stringify(p7SessionCardinalities(missingNodeIdMutation.result)) === JSON.stringify(p7SessionCardinalities(resultRecord));
      missingNodeIdPreservesNonOwnerColorSignature = JSON.stringify(p7SessionColorMultiplicity(p7SessionPaintTints(missingNodeIdMutation.result))) === JSON.stringify(p7SessionColorMultiplicity(p7SessionPaintTints(resultRecord)));
      productionLegacyNodeIdFallbackAccepted = p7SessionLegacyNodeIdFallbackExactShape(missingNodeIdMutation.result, expected);
      missingNodeIdRejected = !p7SessionExactShape(missingNodeIdMutation.result, expected);
    }
  }

  const staticFallbackFixture = p7SessionStaticNodeIdFallbackFixture();
  staticFallbackBaselineAccepted = p7SessionStaticNodeIdOwnerOracle(staticFallbackFixture, p7SessionPaintTints)
    && p7SessionStaticNodeIdOwnerOracle(staticFallbackFixture, p7SessionLegacyNodeIdFallbackPaintTints);
  const staticFallbackMutation = p7SessionMissingNodeIdMutation(staticFallbackFixture, P7_SESSION_STATIC_FALLBACK_OWNER);
  if (staticFallbackMutation !== undefined) {
    staticFallbackNodeIdDeleted = staticFallbackMutation.nodeIdDeleted;
    staticFallbackOriginalHadOwnId = staticFallbackMutation.originalHadOwnId;
    staticFallbackOriginalId = staticFallbackMutation.originalId;
    staticFallbackOriginalIdUnchanged = staticFallbackMutation.originalIdUnchanged;
    staticFallbackOriginalIdSupportsOwner = staticFallbackMutation.originalHadOwnId
      && staticFallbackMutation.originalId === P7_SESSION_STATIC_FALLBACK_OWNER
      && staticFallbackMutation.originalIdUnchanged;
    staticFallbackTintDataPreserved = staticFallbackMutation.tintDataPreserved;
    staticFallbackPreservesCardinality = JSON.stringify(p7SessionCardinalities(staticFallbackMutation.result)) === JSON.stringify(p7SessionCardinalities(staticFallbackFixture));
    staticFallbackPreservesNonOwnerColorSignature = JSON.stringify(p7SessionColorMultiplicity(p7SessionPaintTints(staticFallbackMutation.result))) === JSON.stringify(p7SessionColorMultiplicity(p7SessionPaintTints(staticFallbackFixture)));
    legacyNodeIdFallbackAccepted = staticFallbackOriginalIdSupportsOwner
      && p7SessionStaticNodeIdOwnerOracle(staticFallbackMutation.result, p7SessionLegacyNodeIdFallbackPaintTints);
    staticFallbackRejected = legacyNodeIdFallbackAccepted
      && !p7SessionStaticNodeIdOwnerOracle(staticFallbackMutation.result, p7SessionPaintTints);
  }
  return {
    cardinalities: p7SessionCardinalities(result),
    ownerMultiplicity: {
      facts: p7SessionColorMultiplicity(p7SessionSceneFacts(result)),
      paint: p7SessionPaintMultiplicity(p7SessionPaintTints(result)),
    },
    exactShape: p7SessionExactShape(result, expected),
    duplicateRejected,
    driftRejected,
    legacyWrongPaintOwnerAccepted,
    wrongPaintOwnerRejected,
    legacySameColorOwnerMutationAccepted,
    sameColorMutationPreservesCardinality,
    sameColorMutationPreservesNonOwnerColorSignature,
    sameColorOwnerMutationRejected,
    missingNodeIdDeleted,
    missingNodeIdOriginalHadOwnId,
    missingNodeIdOriginalId,
    missingNodeIdOriginalIdUnchanged,
    missingNodeIdTintDataPreserved,
    missingNodeIdPreservesCardinality,
    missingNodeIdPreservesNonOwnerColorSignature,
    productionLegacyNodeIdFallbackAccepted,
    staticFallbackBaselineAccepted,
    staticFallbackNodeIdDeleted,
    staticFallbackOriginalHadOwnId,
    staticFallbackOriginalId,
    staticFallbackOriginalIdUnchanged,
    staticFallbackOriginalIdSupportsOwner,
    staticFallbackTintDataPreserved,
    staticFallbackPreservesCardinality,
    staticFallbackPreservesNonOwnerColorSignature,
    legacyNodeIdFallbackAccepted,
    staticFallbackRejected,
    missingNodeIdRejected,
  };
}

function p7SessionCardinalities(result: unknown): P7SessionCardinalities {
  const scene = p7SessionSceneRecord(result);
  const count = (name: string): number => scene !== undefined && Array.isArray(scene[name]) ? scene[name].length : 0;
  return {
    frames: count('frames'),
    tables: count('tables'),
    rows: count('rows'),
    cells: count('cells'),
    widgets: count('widgets'),
    texts: count('texts'),
    colorFacts: p7SessionSceneFacts(result).length,
    paintTints: p7SessionPaintTints(result).length,
  };
}

function p7SessionColorFactMatches(fact: JsonRecord, owner: P7SessionColorOwner): boolean {
  const value = p7SessionRecord(fact.value);
  return fact.field === owner.field
    && fact.slot === owner.slot
    && value?.domain === owner.domain
    && value.r === owner.values[0]
    && value.g === owner.values[1]
    && value.b === owner.values[2]
    && value.a === owner.values[3];
}

function p7SessionProjectionHasColorOwners(result: unknown, expected: P7SessionShapeExpectation = P7_SESSION_EXPECTED_SELECTED_SHAPE): boolean {
  const facts = p7SessionSceneFacts(result);
  const tints = p7SessionPaintTints(result);
  if (!P7_SESSION_COLOR_OWNERS.every(owner => facts.some(fact => p7SessionColorFactMatches(fact, owner)))) return false;
  if (!tints.every(tint => typeof tint.ownerId === 'string')) return false;
  try {
    assert.deepEqual(p7SessionPaintMultiplicity(tints), expected.paintOwners);
    return true;
  } catch {
    return false;
  }
}

function p7SessionGameTruth(result: unknown): boolean {
  const projection = p7SessionRecord(result);
  const preview = p7SessionRecord(projection?.preview);
  const sceneResult = p7SessionRecord(preview?.scene);
  const scene = p7SessionRecord(sceneResult?.scene);
  const paint = p7SessionRecord(projection?.paint);
  const plan = p7SessionRecord(paint?.plan);
  return projection?.gameTruth === X4_UI_EDITOR_SESSION_GAME_TRUTH
    && projection.gameVerified === false
    && preview?.gameTruth === X4_UI_EDITOR_SESSION_GAME_TRUTH
    && p7SessionRecord(preview.verification)?.gameVerified === false
    && (scene === undefined || (scene.gameTruth === X4_UI_EDITOR_SESSION_GAME_TRUTH && p7SessionRecord(scene.verification)?.gameVerified === false))
    && (plan === undefined || (plan.gameTruth === X4_UI_EDITOR_SESSION_GAME_TRUTH && plan.gameVerified === false && p7SessionRecord(plan.verification)?.gameVerified === false));
}

function p7SessionNoColorBehavior(result: unknown): boolean {
  const projection = p7SessionRecord(result);
  const paint = p7SessionRecord(projection?.paint);
  return projection?.canRender === true
    && paint !== null
    && paint !== undefined
    && (paint.status === 'projected' || paint.status === 'partial')
    && p7SessionSceneFacts(result).length === 0
    && p7SessionPaintTints(result).length === 0
    && p7SessionGameTruth(result);
}

function p7SessionInputWithColor(base: JsonRecord, evidence: unknown): JsonRecord {
  const input = { ...base };
  Object.defineProperty(input, 'colorEvidence', {
    configurable: true,
    enumerable: true,
    writable: true,
    value: evidence,
  });
  return input;
}

function p7SessionColorClone(value: unknown): JsonRecord {
  return JSON.parse(JSON.stringify(value)) as JsonRecord;
}

function p7SessionOneDescriptorColorFacade(base: JsonRecord, evidence: unknown): {
  input: JsonRecord;
  colorEvidenceDescriptorReads: () => number;
  mutateAfterCall: () => void;
} {
  const invalidClone = p7SessionColorClone(evidence);
  const target = p7SessionInputWithColor(base, invalidClone);
  let descriptorReads = 0;
  const input = new Proxy(target, {
    getOwnPropertyDescriptor(current, key) {
      const descriptor = Reflect.getOwnPropertyDescriptor(current, key);
      if (key !== 'colorEvidence' || descriptor === undefined || !('value' in descriptor)) return descriptor;
      descriptorReads += 1;
      return {
        ...descriptor,
        value: descriptorReads === 1 ? evidence : invalidClone,
      };
    },
  });
  return {
    input,
    colorEvidenceDescriptorReads: () => descriptorReads,
    mutateAfterCall: () => {
      target.colorEvidence = { ...invalidClone, postCallMutation: true };
    },
  };
}

function p7SessionSafeProjection(input: unknown): unknown {
  try {
    return projectX4UiEditorSession(input as X4UiEditorSessionInput);
  } catch (error) {
    return { threw: true, error: error instanceof Error ? error.message : String(error) };
  }
}

function p7SessionReceipt(value: unknown): unknown {
  const record = p7SessionRecord(value);
  if (record === undefined) return value;
  if (record.threw === true || typeof record.error === 'string') return { threw: record.threw === true, error: record.error };
  const receipt: Record<string, unknown> = {
    canRender: record.canRender,
    status: record.status,
    gameTruth: record.gameTruth,
    gameVerified: record.gameVerified,
    previewStatus: p7SessionRecord(record.preview)?.status,
    sceneStatus: p7SessionRecord(p7SessionRecord(record.preview)?.scene)?.status,
    paintStatus: p7SessionRecord(record.paint)?.status,
    sceneFacts: p7SessionSceneFacts(value).length,
    paintTints: p7SessionPaintTints(value).length,
  };
  for (const key of [
    'cardinalities',
    'ownerMultiplicity',
     'exactShape',
     'duplicateRejected',
     'driftRejected',
     'legacyWrongPaintOwnerAccepted',
     'wrongPaintOwnerRejected',
     'legacySameColorOwnerMutationAccepted',
     'sameColorMutationPreservesCardinality',
     'sameColorMutationPreservesNonOwnerColorSignature',
     'sameColorOwnerMutationRejected',
     'missingNodeIdDeleted',
     'missingNodeIdOriginalHadOwnId',
     'missingNodeIdOriginalId',
     'missingNodeIdOriginalIdUnchanged',
     'missingNodeIdTintDataPreserved',
     'missingNodeIdPreservesCardinality',
     'missingNodeIdPreservesNonOwnerColorSignature',
     'productionLegacyNodeIdFallbackAccepted',
     'staticFallbackBaselineAccepted',
     'staticFallbackNodeIdDeleted',
     'staticFallbackOriginalHadOwnId',
     'staticFallbackOriginalId',
     'staticFallbackOriginalIdUnchanged',
     'staticFallbackOriginalIdSupportsOwner',
     'staticFallbackTintDataPreserved',
     'staticFallbackPreservesCardinality',
     'staticFallbackPreservesNonOwnerColorSignature',
     'legacyNodeIdFallbackAccepted',
     'staticFallbackRejected',
     'missingNodeIdRejected',
     'exactIdentity',
    'catalogIssued',
    'finalHasOwners',
    'accessorReads',
    'colorEvidenceDescriptorReads',
    'keysPreserved',
    'descriptorsPreserved',
    'sampleCatalogReconciled',
    'samplesReconciled',
    'sampleBindingsConsumed',
    'postCallStable',
  ]) {
    if (Object.hasOwn(record, key)) receipt[key] = record[key];
  }
  if (Array.isArray(record.results)) receipt.results = record.results.map(item => {
    const row = p7SessionRecord(item);
    return row === undefined ? item : { name: row.name, result: p7SessionReceipt(row.result) };
  });
  for (const key of ['selected', 'sampled', 'noColor', 'missing', 'refused', 'result']) {
    if (Object.hasOwn(record, key)) receipt[key] = p7SessionReceipt(record[key]);
  }
  return receipt;
}

function recordP7SessionRow(
  name: string,
  fixtureReady: boolean,
  expected: string,
  invoke: () => unknown,
  accepts: (observed: unknown) => boolean,
): void {
  let threw = false;
  let observed: unknown;
  try {
    observed = invoke();
    if (p7SessionRecord(observed)?.threw === true) threw = true;
  } catch (error) {
    threw = true;
    observed = { error: error instanceof Error ? error.message : String(error) };
  }
  p7SessionRows.push({ name, fixtureReady, threw, expected, observed, pass: fixtureReady && !threw && accepts(observed) });
}

async function run(): Promise<void> {
  const proxyTrapOracleSensitivity = assertProxyTrapCensusOracleSensitivity(SESSION_ONE_ITEM_CONTAINER_PROXY_TRAPS);
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
  let p7ColorAuthority: X4UiCorpusCanonicalColorSuccess | undefined;
  let p7ColorFixtureError: string | undefined;
  try {
    p7ColorAuthority = await loadP7SessionColorFixture();
  } catch (error) {
    p7ColorFixtureError = error instanceof Error ? error.message : String(error);
  }

  let p7SelectedInputBase: JsonRecord | undefined;
  let p7SampleInputBase: JsonRecord | undefined;
  let p7SampleCatalog: unknown;
  let p7FixtureError: string | undefined;
  try {
    const selectedWorkspace = p7ColorWorkspace('ui/p7-colors.lua', p7ColorLua);
    const selectedSeed = projectX4UiEditorSession({ workspace: selectedWorkspace, corpus: undefined, profile: X4_UI_EDITOR_DEFAULT_PROFILE });
    const selected = selectionFor(selectedSeed.source, 'ui/p7-colors.lua', 'top-level');
    const selectedProfile: X4UiEditorProfile = {
      ...X4_UI_EDITOR_DEFAULT_PROFILE,
      id: 'editor-session-p7-selected-profile',
      provenance: 'P7 selected canonical color fixture',
      source: selected.sourceIdentity,
      drawable: { width: 100, height: 80 },
      uiScale: 1,
      minTextHeight: 10,
    };
    p7SelectedInputBase = { workspace: selectedWorkspace, corpus: canonical, profile: selectedProfile, selection: selected };

    const sampleWorkspaceValue = p7ColorWorkspace('ui/p7-color-samples.lua', p7ColorSampleLua);
    const sampleSeed = projectX4UiEditorSession({ workspace: sampleWorkspaceValue, corpus: undefined, profile: X4_UI_EDITOR_DEFAULT_PROFILE });
    const sampleSelection = selectionFor(sampleSeed.source, 'ui/p7-color-samples.lua', 'function');
    const sampleProfile: X4UiEditorProfile = {
      ...X4_UI_EDITOR_DEFAULT_PROFILE,
      id: 'editor-session-p7-sampled-profile',
      provenance: 'P7 sampled canonical color fixture',
      source: sampleSelection.sourceIdentity,
      drawable: { width: 100, height: 80 },
      uiScale: 1,
      minTextHeight: 10,
    };
    const sampleUnprojected = projectX4UiEditorSession({ workspace: sampleWorkspaceValue, corpus: canonical, profile: sampleProfile, selection: sampleSelection });
    const sampleCatalog = sampleUnprojected.sampleCatalog;
    if (!sampleCatalog || !sampleUnprojected.sampleBinding || !sampleUnprojected.sampleCatalogAuthority) throw new Error('P7 sample fixture did not issue catalog/binding authorities');
    p7SampleCatalog = sampleCatalog;
    const sampleState: X4UiEditorSampleState = {
      catalogId: sampleCatalog.id,
      source: sampleCatalog.sourceIdentity,
      values: sampleCatalog.entries.map(entry => ({
        id: entry.id,
        value: entry.expectedType === 'number' ? 80 : entry.expectedType === 'string' ? 'P7 sample text' : true,
      })),
    };
    p7SampleInputBase = {
      workspace: sampleWorkspaceValue,
      corpus: canonical,
      profile: sampleProfile,
      selection: sampleSelection,
      samples: sampleState,
      sampleBinding: sampleUnprojected.sampleBinding,
      sampleCatalogAuthority: sampleUnprojected.sampleCatalogAuthority,
    };
  } catch (error) {
    p7FixtureError = error instanceof Error ? error.message : String(error);
  }
  const p7FixtureReady = p7ColorAuthority !== undefined && p7SelectedInputBase !== undefined && p7SampleInputBase !== undefined;

  recordP7SessionRow(
    'P7 EditorSession exact own-data colorEvidence reaches selected Layout -> Scene -> Paint owners',
    p7FixtureReady,
    'the exact loader-issued colorEvidence data descriptor is accepted unchanged and produces every expected owner-linked base tint',
    () => {
      if (p7SelectedInputBase === undefined || p7ColorAuthority === undefined) return { fixtureReady: false };
      const input = p7SessionInputWithColor(p7SelectedInputBase, p7ColorAuthority);
      const descriptor = Object.getOwnPropertyDescriptor(input, 'colorEvidence');
      const result = p7SessionSafeProjection(input);
      const shape = p7SessionShapeEvidence(result);
      return {
        descriptor,
        exactIdentity: descriptor !== undefined && 'value' in descriptor && descriptor.value === p7ColorAuthority,
        ...shape,
        result,
      };
    },
    observed => {
      const value = p7SessionRecord(observed);
      return value?.exactIdentity === true
        && p7SessionRecord(value.result)?.threw !== true
        && p7SessionProjectionHasColorOwners(value?.result, P7_SESSION_EXPECTED_SELECTED_SHAPE)
        && value.exactShape === true
        && value.duplicateRejected === true
        && value.driftRejected === true
        && value.legacyWrongPaintOwnerAccepted === true
        && value.wrongPaintOwnerRejected === true
        && value.legacySameColorOwnerMutationAccepted === true
        && value.sameColorMutationPreservesCardinality === true
        && value.sameColorMutationPreservesNonOwnerColorSignature === true
        && value.sameColorOwnerMutationRejected === true
        && value.missingNodeIdDeleted === true
        && value.missingNodeIdOriginalHadOwnId === true
        && typeof value.missingNodeIdOriginalId === 'string'
        && value.missingNodeIdOriginalIdUnchanged === true
        && value.missingNodeIdTintDataPreserved === true
        && value.missingNodeIdPreservesCardinality === true
        && value.missingNodeIdPreservesNonOwnerColorSignature === true
        && value.productionLegacyNodeIdFallbackAccepted === false
        && value.staticFallbackBaselineAccepted === true
        && value.staticFallbackNodeIdDeleted === true
        && value.staticFallbackOriginalHadOwnId === true
        && value.staticFallbackOriginalId === P7_SESSION_STATIC_FALLBACK_OWNER
        && value.staticFallbackOriginalIdUnchanged === true
        && value.staticFallbackOriginalIdSupportsOwner === true
        && value.staticFallbackTintDataPreserved === true
        && value.staticFallbackPreservesCardinality === true
        && value.staticFallbackPreservesNonOwnerColorSignature === true
        && value.legacyNodeIdFallbackAccepted === true
        && value.staticFallbackRejected === true
        && value.missingNodeIdRejected === true;
    },
  );

  recordP7SessionRow(
    'P7 EditorSession sampled public path forwards exact colorEvidence into selected/sample Paint',
    p7FixtureReady,
    'the real sampled path consumes the same exact loader-issued colorEvidence and produces owner-linked base tints after sample reconciliation',
    () => {
      if (p7SampleInputBase === undefined || p7ColorAuthority === undefined) return { fixtureReady: false };
      const result = p7SessionSafeProjection(p7SessionInputWithColor(p7SampleInputBase, p7ColorAuthority));
      return { catalogIssued: p7SampleCatalog !== undefined, ...p7SessionShapeEvidence(result, P7_SESSION_EXPECTED_SAMPLED_SHAPE), result };
    },
    observed => {
      const value = p7SessionRecord(observed);
      return value?.catalogIssued === true
        && p7SessionRecord(value.result)?.threw !== true
        && p7SessionProjectionHasColorOwners(value?.result, P7_SESSION_EXPECTED_SAMPLED_SHAPE)
        && value.exactShape === true
        && value.duplicateRejected === true
        && value.driftRejected === true
        && value.legacyWrongPaintOwnerAccepted === true
        && value.wrongPaintOwnerRejected === true
        && value.legacySameColorOwnerMutationAccepted === true
        && value.sameColorMutationPreservesCardinality === true
        && value.sameColorMutationPreservesNonOwnerColorSignature === true
        && value.sameColorOwnerMutationRejected === true
        && value.missingNodeIdDeleted === true
        && value.missingNodeIdOriginalHadOwnId === true
        && typeof value.missingNodeIdOriginalId === 'string'
        && value.missingNodeIdOriginalIdUnchanged === true
        && value.missingNodeIdTintDataPreserved === true
        && value.missingNodeIdPreservesCardinality === true
        && value.missingNodeIdPreservesNonOwnerColorSignature === true
        && value.productionLegacyNodeIdFallbackAccepted === false
        && value.staticFallbackBaselineAccepted === true
        && value.staticFallbackNodeIdDeleted === true
        && value.staticFallbackOriginalHadOwnId === true
        && value.staticFallbackOriginalId === P7_SESSION_STATIC_FALLBACK_OWNER
        && value.staticFallbackOriginalIdUnchanged === true
        && value.staticFallbackOriginalIdSupportsOwner === true
        && value.staticFallbackTintDataPreserved === true
        && value.staticFallbackPreservesCardinality === true
        && value.staticFallbackPreservesNonOwnerColorSignature === true
        && value.legacyNodeIdFallbackAccepted === true
        && value.staticFallbackRejected === true
        && value.missingNodeIdRejected === true;
    },
  );

  recordP7SessionRow(
    'P7 EditorSession issued sample catalog and final colored outcome remain separately observable',
    p7FixtureReady,
    'the public result retains its issued sample catalog authority while the reconciled final selected/sample outcome exposes owner-linked color tints',
    () => {
      if (p7SampleInputBase === undefined || p7ColorAuthority === undefined) return { fixtureReady: false };
      const result = p7SessionSafeProjection(p7SessionInputWithColor(p7SampleInputBase, p7ColorAuthority));
      const projection = p7SessionRecord(result);
      return { catalog: projection?.sampleCatalog, catalogAuthority: projection?.sampleCatalogAuthority, finalHasOwners: p7SessionProjectionHasColorOwners(result, P7_SESSION_EXPECTED_SAMPLED_SHAPE) };
    },
    observed => {
      const value = p7SessionRecord(observed);
      return value?.catalog !== undefined && value.catalogAuthority !== undefined && value.finalHasOwners === true;
    },
  );

  recordP7SessionRow(
    'P7 EditorSession missing/refused/malformed/copied/inherited/accessor/proxy color values degrade to no-color',
    p7FixtureReady,
    'invalid or absent color values never invoke a getter, never fail core geometry, and never manufacture a canonical tint',
    () => {
      if (p7SelectedInputBase === undefined || p7ColorAuthority === undefined) return { fixtureReady: false };
      const copied = p7SessionColorClone(p7ColorAuthority);
      const inherited = { ...p7SelectedInputBase };
      Object.setPrototypeOf(inherited, { colorEvidence: p7ColorAuthority });
      let accessorReads = 0;
      const accessor = { ...p7SelectedInputBase };
      Object.defineProperty(accessor, 'colorEvidence', {
        configurable: true,
        enumerable: true,
        get: () => {
          accessorReads += 1;
          throw new Error('P7 EditorSession color getter executed');
        },
      });
      const proxy = new Proxy(p7ColorAuthority, { get: () => { throw new Error('P7 EditorSession color proxy getter executed'); } });
      const candidates: readonly [string, unknown][] = [
        ['missing', p7SelectedInputBase],
        ['refused', p7SessionInputWithColor(p7SelectedInputBase, { ok: false, error: { code: 'offline', stage: 'status', message: 'P7 refused color' } })],
        ['malformed', p7SessionInputWithColor(p7SelectedInputBase, { ok: true, evidenceKind: X4_UI_CORPUS_COLOR_CANONICAL_EVIDENCE })],
        ['copied', p7SessionInputWithColor(p7SelectedInputBase, copied)],
        ['inherited', inherited],
        ['accessor', accessor],
        ['proxy', p7SessionInputWithColor(p7SelectedInputBase, proxy)],
      ];
      const results = candidates.map(([name, input]) => ({ name, result: p7SessionSafeProjection(input) }));
      return { accessorReads, results };
    },
    observed => {
      const value = p7SessionRecord(observed);
      const results = value?.results;
      return value?.accessorReads === 0
        && Array.isArray(results)
        && results.length === 7
        && results.every(item => {
          const row = p7SessionRecord(item);
          const result = row?.result;
          return p7SessionRecord(result)?.threw !== true && p7SessionNoColorBehavior(result);
        });
    },
  );

  recordP7SessionRow(
    'P7 EditorSession sampled one-descriptor color capture feeds reconciled final Scene/Paint',
    p7FixtureReady,
    'one sampled-input colorEvidence descriptor read captures the exact authority, reconciles the issued sample catalog, and produces final owner tints; later clone reads and post-call mutation cannot alter that result',
    () => {
      if (p7SampleInputBase === undefined || p7ColorAuthority === undefined || p7SampleCatalog === undefined) return { fixtureReady: false };
      const facade = p7SessionOneDescriptorColorFacade(p7SampleInputBase, p7ColorAuthority);
      const baseKeys = Reflect.ownKeys(p7SampleInputBase);
      const keysPreserved = Reflect.ownKeys(facade.input).length === baseKeys.length + 1
        && baseKeys.every(key => Reflect.ownKeys(facade.input).includes(key))
        && Reflect.ownKeys(facade.input).includes('colorEvidence');
      const descriptorsPreserved = baseKeys.every(key => {
        const expected = Reflect.getOwnPropertyDescriptor(p7SampleInputBase, key);
        const actual = Reflect.getOwnPropertyDescriptor(facade.input, key);
        if (expected === undefined || actual === undefined) return expected === actual;
        return expected.configurable === actual.configurable
          && expected.enumerable === actual.enumerable
          && ('writable' in expected ? 'writable' in actual && expected.writable === actual.writable && expected.value === actual.value : !('writable' in actual));
      });
      const result = p7SessionSafeProjection(facade.input);
      const projection = p7SessionRecord(result);
      const preview = p7SessionRecord(projection?.preview);
      const programResult = p7SessionRecord(preview?.program);
      const program = p7SessionRecord(programResult?.program);
      const bindings = program?.previewSampleBindings;
      const expectedCatalog = p7SessionRecord(p7SampleCatalog);
      const actualCatalog = p7SessionRecord(projection?.sampleCatalog);
      const expectedSamples = p7SessionRecord(p7SampleInputBase.samples);
      const before = JSON.stringify(p7SessionPaintTints(result));
      facade.mutateAfterCall();
      const after = JSON.stringify(p7SessionPaintTints(result));
      return {
        colorEvidenceDescriptorReads: facade.colorEvidenceDescriptorReads(),
        keysPreserved,
        descriptorsPreserved,
        catalogIssued: actualCatalog !== undefined && projection?.sampleCatalogAuthority !== undefined,
        sampleCatalogReconciled: actualCatalog?.id === expectedCatalog?.id
          && actualCatalog?.id === expectedSamples?.catalogId
          && JSON.stringify(actualCatalog?.sourceIdentity) === JSON.stringify(expectedCatalog?.sourceIdentity)
          && JSON.stringify(actualCatalog?.sourceIdentity) === JSON.stringify(expectedSamples?.source),
        samplesReconciled: projection?.samples === p7SampleInputBase.samples,
        sampleBindingsConsumed: programResult?.status !== 'refused'
          && Array.isArray(bindings)
          && bindings.length > 0
          && bindings.every(binding => p7SessionRecord(binding)?.status === 'consumed'),
        finalHasOwners: p7SessionProjectionHasColorOwners(result, P7_SESSION_EXPECTED_SAMPLED_SHAPE),
        postCallStable: before === after,
        result,
      };
    },
    observed => {
      const value = p7SessionRecord(observed);
      return value?.colorEvidenceDescriptorReads === 1
        && value.keysPreserved === true
        && value.descriptorsPreserved === true
        && value.catalogIssued === true
        && value.sampleCatalogReconciled === true
        && value.samplesReconciled === true
        && value.sampleBindingsConsumed === true
        && value.finalHasOwners === true
        && value.postCallStable === true;
    },
  );

  recordP7SessionRow(
    'P7 EditorSession color success without exact core remains non-paintable',
    p7FixtureReady,
    'a valid color authority cannot make a missing/refused core corpus canonical, renderable, or paintable',
    () => {
      if (p7SelectedInputBase === undefined || p7ColorAuthority === undefined) return { fixtureReady: false };
      const missingCore = { ...p7SessionInputWithColor(p7SelectedInputBase, p7ColorAuthority), corpus: undefined };
      const refusedCore = { ...p7SessionInputWithColor(p7SelectedInputBase, p7ColorAuthority), corpus: { ok: false, error: { code: 'offline', stage: 'status', message: 'P7 core refused' } } };
      return { missing: p7SessionSafeProjection(missingCore), refused: p7SessionSafeProjection(refusedCore) };
    },
    observed => {
      const value = p7SessionRecord(observed);
      return [value?.missing, value?.refused].every(candidate => {
        const result = p7SessionRecord(candidate);
        return result?.canRender === false && result.paint === null && p7SessionPaintTints(candidate).length === 0 && p7SessionGameTruth(candidate);
      });
    },
  );

  recordP7SessionRow(
    'P7 EditorSession selected/sample states retain permanent Not verified in game truth',
    p7FixtureReady,
    'all accepted, degraded, and core-refused selected/sample outcomes keep gameVerified=false and Not verified in game',
    () => ({
      selected: p7SelectedInputBase === undefined || p7ColorAuthority === undefined ? undefined : p7SessionSafeProjection(p7SessionInputWithColor(p7SelectedInputBase, p7ColorAuthority)),
      sampled: p7SampleInputBase === undefined || p7ColorAuthority === undefined ? undefined : p7SessionSafeProjection(p7SessionInputWithColor(p7SampleInputBase, p7ColorAuthority)),
      noColor: p7SelectedInputBase === undefined ? undefined : p7SessionSafeProjection(p7SelectedInputBase),
    }),
    observed => {
      const value = p7SessionRecord(observed);
      return p7SessionGameTruth(value?.selected) && p7SessionGameTruth(value?.sampled) && p7SessionGameTruth(value?.noColor);
    },
  );

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

  recordSessionCausal(
    'causal-sampleless-preview-is-value-equivalent-and-accepted-samples-reproject',
    sampleBinding !== undefined && sampleExactCatalogAuthority !== undefined,
    'sampleless output remains value-equivalent to the accepted catalog preview while accepted sample values remain consumed by the sampled projection',
    markSeamReached => {
      markSeamReached();
      const sampleless = projectX4UiEditorSession({
        workspace: sampleWorkspaceValue,
        corpus: canonical,
        profile: sampleExactProfile,
        selection: sampleSelection,
      });
      const sampled = projectX4UiEditorSession({
        workspace: sampleWorkspaceValue,
        corpus: canonical,
        profile: sampleExactProfile,
        selection: sampleSelection,
        samples: sampleState,
        sampleBinding,
        sampleCatalogAuthority: sampleExactCatalogAuthority,
      });
      const samplelessProgram = sampleless.preview.program;
      const sampledProgram = sampled.preview.program;
      const sampledBindingsConsumed = sampledProgram !== undefined && sampledProgram.status !== 'refused'
        && sampledProgram.program.previewSampleBindings.length > 0
        && sampledProgram.program.previewSampleBindings.every(binding => binding.status === 'consumed');
      const samplelessWidth = samplelessProgram !== undefined && samplelessProgram.status !== 'refused'
        ? samplelessProgram.program.tables[0]?.requestedWidth
        : undefined;
      const sampledWidth = sampledProgram !== undefined && sampledProgram.status !== 'refused'
        ? sampledProgram.program.tables[0]?.requestedWidth
        : undefined;
      return {
        samplelessPreviewValueEquivalent: JSON.stringify(sampleless.preview) === JSON.stringify(sampleExactUnprojected.preview),
        samplelessSamplesUndefined: sampleless.samples === undefined,
        sampledAccepted: sampled.sampleReconciliation.status === 'accepted' && sampled.samples === sampleState,
        sampledBindingsConsumed,
        sampledWidth,
        samplelessWidth,
        sampledPreviewDiffers: JSON.stringify(sampled.preview) !== JSON.stringify(sampleless.preview),
      };
    },
    observed => {
      if (observed === null || typeof observed !== 'object') return false;
      const value = observed as JsonRecord;
      return value.samplelessPreviewValueEquivalent === true
        && value.samplelessSamplesUndefined === true
        && value.sampledAccepted === true
        && value.sampledBindingsConsumed === true
        && value.sampledWidth === 80
        && value.samplelessWidth !== value.sampledWidth
        && value.sampledPreviewDiffers === true;
    },
  );
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
  assert.equal(Object.hasOwn(exact, 'samples'), false, 'fresh resize fixture must not carry prior samples');
  assert.equal(Object.hasOwn(exact, 'sampleBinding'), false, 'fresh resize fixture must not carry a prior profile binding');
  assert.equal(Object.hasOwn(exact, 'sampleCatalogAuthority'), false, 'fresh resize fixture must not carry prior catalog authority');
  assert.deepEqual(
    resized.sampleReconciliation,
    { status: 'accepted', samples: undefined, changed: false },
    'fresh resize must not manufacture or forward stale sample state',
  );
  assert.equal(resized.samples, undefined);
  const resizedSceneResult = resized.preview.scene;
  assert.ok(resizedSceneResult && resizedSceneResult.status !== 'refused', 'fresh resize must reissue Scene from the current profile');
  assert.deepEqual(resizedSceneResult.scene.drawableRect, { x: 0, y: 0, width: 1280, height: 720 });
  assert.deepEqual(resizedSceneResult.scene.profile.drawable, { width: 1280, height: 720 });
  assert.notDeepEqual(resizedSceneResult.scene.drawableRect, { x: 0, y: 0, width: 100, height: 80 }, 'fresh Scene drawable must not retain prior profile geometry');
  const resizedPaint = resized.paint;
  assert.ok(resizedPaint && resizedPaint.status !== 'refused', 'fresh resize must project Paint from the reissued Scene');
  assert.deepEqual(resizedPaint.plan.logicalDrawable, { width: 1280, height: 720 });
  assert.notDeepEqual(resizedPaint.plan.logicalDrawable, { width: 100, height: 80 }, 'fresh Paint drawable must not retain prior profile geometry');
  assert.equal(resized.canRender, true);
  assert.equal(resized.reason, 'preview and paint accepted; Not verified in game');
  assert.equal(resized.gameTruth, X4_UI_EDITOR_SESSION_GAME_TRUTH);
  assert.equal(resized.gameVerified, false);
  assert.equal(resized.preview.gameTruth, X4_UI_EDITOR_SESSION_GAME_TRUTH);
  assert.equal(resized.preview.verification.gameVerified, false);
  assert.equal(resizedSceneResult.scene.gameTruth, X4_UI_EDITOR_SESSION_GAME_TRUTH);
  assert.equal(resizedSceneResult.scene.verification.gameVerified, false);
  assert.equal(resizedPaint.plan.gameTruth, X4_UI_EDITOR_SESSION_GAME_TRUTH);
  assert.equal(resizedPaint.plan.gameVerified, false);
  assert.equal(resizedPaint.verification.gameVerified, false);

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
  assert.equal(ticker?.projection.status, 'projected');
  assert.equal(hud?.projection.status, 'projected');
  assert.equal(ticker?.enabled, true);
  assert.equal(hud?.enabled, false);
  const presetPaint = presetAll.paint;
  assert.ok(presetPaint && 'plan' in presetPaint);
  if (presetPaint && 'plan' in presetPaint) {
    assert.equal(presetPaint.plan.keepOuts.length, 4);
    assert.equal(new Set(presetPaint.plan.keepOuts.map(item => item.entryId)).size, presetPaint.plan.keepOuts.length);
    assert.ok(presetPaint.plan.keepOuts.some(item => item.entryId === KEEP_OUT_IDS.missionMessagesTicker && item.geometry?.kind === 'polygon'));
  }
  const toggled = projectX4UiEditorSession({ ...exact, activePresetId: KEEP_OUT_PRESET_IDS.cockpitConversation, enabledEntryIds: [KEEP_OUT_IDS.conversationBackRow] });
  assert.ok(toggled.paint && 'plan' in toggled.paint);
  if (toggled.paint && 'plan' in toggled.paint) assert.deepEqual(toggled.paint.plan.keepOuts.map(item => item.entryId), [KEEP_OUT_IDS.conversationBackRow]);
  const disabled = projectX4UiEditorSession({ ...exact, activePresetId: KEEP_OUT_PRESET_IDS.cockpitConversation, enabledEntryIds: [] });
  assert.ok(disabled.paint && 'plan' in disabled.paint);
  if (disabled.paint && 'plan' in disabled.paint) assert.equal(disabled.paint.plan.keepOuts.length, 0);

  const calibratedDrawable = {
    ...exact,
    profile: { ...exact.profile, drawable: { width: 2544, height: 1353 } },
  };
  const fourContextCases = [
    {
      presetId: KEEP_OUT_PRESET_IDS.cockpitConversation,
      expectedIds: [KEEP_OUT_IDS.conversationBackRow, KEEP_OUT_IDS.conversationOptionStackStart, KEEP_OUT_IDS.informationPanelLeftEdge, KEEP_OUT_IDS.missionMessagesTicker],
      calibratedId: KEEP_OUT_IDS.missionMessagesTicker,
    },
    {
      presetId: KEEP_OUT_PRESET_IDS.mapOpen,
      expectedIds: [KEEP_OUT_IDS.topHudStrip],
      calibratedId: KEEP_OUT_IDS.topHudStrip,
    },
    {
      presetId: KEEP_OUT_PRESET_IDS.fullscreenMenu,
      expectedIds: [KEEP_OUT_IDS.topHudStrip],
      calibratedId: KEEP_OUT_IDS.topHudStrip,
    },
    {
      presetId: KEEP_OUT_PRESET_IDS.firstPerson,
      expectedIds: [KEEP_OUT_IDS.missionMessagesTicker],
      calibratedId: KEEP_OUT_IDS.missionMessagesTicker,
    },
  ] as const;
  for (const testCase of fourContextCases) {
    const contextSession = projectX4UiEditorSession({ ...calibratedDrawable, activePresetId: testCase.presetId });
    assert.equal(contextSession.canRender, true, `${testCase.presetId} must render at the calibrated drawable`);
    assert.ok(contextSession.paint && 'plan' in contextSession.paint);
    if (contextSession.paint && 'plan' in contextSession.paint) {
      assert.deepEqual(contextSession.paint.plan.keepOuts.map(item => item.entryId), testCase.expectedIds);
      const calibratedCommand = contextSession.paint.plan.keepOuts.find(item => item.entryId === testCase.calibratedId);
      assert.equal(calibratedCommand?.status, 'projected');
      assert.equal(calibratedCommand?.geometry?.kind, 'polygon');
    }
    const calibratedMember = contextSession.activePreset?.members.find(member => member.entryId === testCase.calibratedId);
    assert.equal(calibratedMember?.projection.status, 'projected');
    assert.equal(calibratedMember?.projection.geometry.kind, 'polygon');
  }
  const cockpitTickerOnly = projectX4UiEditorSession({ ...calibratedDrawable, activePresetId: KEEP_OUT_PRESET_IDS.cockpitConversation, enabledEntryIds: [KEEP_OUT_IDS.missionMessagesTicker] });
  const mapTickerOnly = projectX4UiEditorSession({ ...calibratedDrawable, activePresetId: KEEP_OUT_PRESET_IDS.mapOpen, enabledEntryIds: [KEEP_OUT_IDS.missionMessagesTicker] });
  const firstTickerOnly = projectX4UiEditorSession({ ...calibratedDrawable, activePresetId: KEEP_OUT_PRESET_IDS.firstPerson, enabledEntryIds: [KEEP_OUT_IDS.missionMessagesTicker] });
  assert.ok(cockpitTickerOnly.paint && 'plan' in cockpitTickerOnly.paint);
  assert.ok(mapTickerOnly.paint && 'plan' in mapTickerOnly.paint);
  assert.ok(firstTickerOnly.paint && 'plan' in firstTickerOnly.paint);
  if (cockpitTickerOnly.paint && 'plan' in cockpitTickerOnly.paint) assert.deepEqual(cockpitTickerOnly.paint.plan.keepOuts.map(item => item.entryId), [KEEP_OUT_IDS.missionMessagesTicker]);
  if (mapTickerOnly.paint && 'plan' in mapTickerOnly.paint) assert.deepEqual(mapTickerOnly.paint.plan.keepOuts.map(item => item.entryId), []);
  if (firstTickerOnly.paint && 'plan' in firstTickerOnly.paint) assert.deepEqual(firstTickerOnly.paint.plan.keepOuts.map(item => item.entryId), [KEEP_OUT_IDS.missionMessagesTicker]);
  const emptyContext = projectX4UiEditorSession({ ...calibratedDrawable, activePresetId: KEEP_OUT_PRESET_IDS.mapOpen, enabledEntryIds: [] });
  assert.ok(emptyContext.paint && 'plan' in emptyContext.paint);
  if (emptyContext.paint && 'plan' in emptyContext.paint) assert.equal(emptyContext.paint.plan.keepOuts.length, 0);
  if (cockpitTickerOnly.paint && 'plan' in cockpitTickerOnly.paint && emptyContext.paint && 'plan' in emptyContext.paint) {
    assert.deepEqual(
      cockpitTickerOnly.paint.plan.layers.slice(0, 3).flatMap(layer => layer.commands.map(command => ({ id: command.id, order: command.order }))),
      emptyContext.paint.plan.layers.slice(0, 3).flatMap(layer => layer.commands.map(command => ({ id: command.id, order: command.order }))),
      'keep-out toggles must not drift source/scene command identity or order',
    );
  }

  const manualCalibrationId = 'session-manual-polygon-1';
  const manualContext = 'manual-session-context';
  const manualCalibration = {
    stableId: manualCalibrationId,
    context: manualContext,
    sourceNote: 'Manual screenshot trace for the Batch 8C.1 authority-spine selftest.',
    screenshotHash: `sha256:${'b'.repeat(64)}`,
    profile: 'screenshot-profile-2560x1440-scale-1',
    drawableBounds: { left: 100, top: 50, width: 1000, height: 500 },
    points: [{ x: 100, y: 50 }, { x: 600, y: 50 }, { x: 100, y: 300 }],
  } as const;
  const manualInputSnapshot = JSON.stringify(manualCalibration);
  const manualSession = projectX4UiEditorSession({
    ...exact,
    profile: { ...exact.profile, drawable: { width: 2560, height: 1440 } },
    activePresetId: KEEP_OUT_PRESET_IDS.cockpitConversation,
    manualCalibrations: [manualCalibration],
    enabledManualEntryIds: [manualCalibrationId],
  });
  assert.equal(manualSession.canRender, true);
  assert.equal(manualSession.manualCalibrations.length, 1);
  const manualResult = manualSession.manualCalibrations[0];
  assert.equal(manualResult?.calibration.status, 'success');
  assert.equal(manualResult?.enabled, true);
  assert.equal(manualResult?.entry?.provenance.screenshot?.hash, `sha256:${'b'.repeat(64)}`);
  assert.equal(manualResult?.entry?.provenance.screenshot?.profile, 'screenshot-profile-2560x1440-scale-1');
  assert.deepEqual(manualResult?.entry?.provenance.drawableBounds, { left: 100, top: 50, width: 1000, height: 500 });
  assert.deepEqual(manualResult?.entry?.geometry, {
    kind: 'polygon',
    points: [{ x: 0, y: 0 }, { x: 0.5, y: 0 }, { x: 0, y: 0.5 }],
  });
  assert.equal(manualResult?.projection?.status, 'projected');
  if (manualResult?.projection?.status === 'projected' && manualResult.projection.geometry.kind === 'polygon') {
    assert.deepEqual(manualResult.projection.geometry.points, [{ x: 0, y: 0 }, { x: 1280, y: 0 }, { x: 0, y: 720 }]);
  }
  if (manualSession.paint && 'plan' in manualSession.paint) {
    const manualCommand = manualSession.paint.plan.keepOuts.find(command => command.entryId === manualCalibrationId);
    assert.equal(manualCommand?.context, manualContext);
    assert.equal(manualCommand?.advisoryOnly, true);
    assert.equal(manualCommand?.gameVerification, X4_UI_EDITOR_SESSION_GAME_TRUTH);
    assert.deepEqual(manualCommand?.geometry, { kind: 'polygon', points: [{ x: 0, y: 0 }, { x: 1280, y: 0 }, { x: 0, y: 720 }] });
  } else {
    assert.fail('valid manual calibration must reach the paint plan');
  }
  assert.equal(JSON.stringify(manualCalibration), manualInputSnapshot);
  assertFrozenGraph(manualSession.manualCalibrations);

  const reprojectedManualSession = projectX4UiEditorSession({
    ...exact,
    profile: { ...exact.profile, drawable: { width: 1280, height: 720 } },
    manualCalibrations: [manualCalibration],
    enabledManualEntryIds: [manualCalibrationId],
  });
  assert.equal(reprojectedManualSession.canRender, true);
  const reprojectedManual = reprojectedManualSession.manualCalibrations[0];
  assert.equal(reprojectedManual?.entry?.provenance.screenshot?.hash, `sha256:${'b'.repeat(64)}`);
  assert.deepEqual(reprojectedManual?.entry?.provenance.drawableBounds, { left: 100, top: 50, width: 1000, height: 500 });
  if (reprojectedManual?.projection?.status === 'projected' && reprojectedManual.projection.geometry.kind === 'polygon') {
    assert.deepEqual(reprojectedManual.projection.geometry.points, [{ x: 0, y: 0 }, { x: 640, y: 0 }, { x: 0, y: 360 }]);
  } else {
    assert.fail('valid manual calibration must reproject at the second drawable');
  }

  const invalidManualSession = projectX4UiEditorSession({
    ...exact,
    manualCalibrations: [{ ...manualCalibration, screenshotHash: 'not-a-sha256' }],
    enabledManualEntryIds: [manualCalibrationId],
  });
  assert.equal(invalidManualSession.canRender, true);
  assert.equal(invalidManualSession.manualCalibrations[0]?.calibration.status, 'refused');
  assert.equal(invalidManualSession.manualCalibrations[0]?.calibration.status === 'refused' && invalidManualSession.manualCalibrations[0].calibration.reason, 'malformed-screenshot-hash');
  if (invalidManualSession.paint && 'plan' in invalidManualSession.paint) {
    assert.equal(invalidManualSession.paint.plan.keepOuts.some(command => command.entryId === manualCalibrationId), false);
  }

  const duplicateManualSession = projectX4UiEditorSession({
    ...exact,
    manualCalibrations: [manualCalibration, { ...manualCalibration }],
    enabledManualEntryIds: [manualCalibrationId],
  });
  assert.equal(duplicateManualSession.manualCalibrations[0]?.calibration.status, 'refused');
  assert.equal(duplicateManualSession.manualCalibrations[1]?.calibration.status, 'refused');
  assert.equal(duplicateManualSession.manualCalibrations[0]?.calibration.status === 'refused' && duplicateManualSession.manualCalibrations[0].calibration.reason, 'duplicate-stable-id');
  assert.equal(duplicateManualSession.manualCalibrations[1]?.calibration.status === 'refused' && duplicateManualSession.manualCalibrations[1].calibration.reason, 'duplicate-stable-id');
  if (duplicateManualSession.paint && 'plan' in duplicateManualSession.paint) {
    assert.equal(duplicateManualSession.paint.plan.keepOuts.filter(command => command.entryId === manualCalibrationId).length, 0);
  }

  const builtInCollisionSession = projectX4UiEditorSession({
    ...exact,
    manualCalibrations: [{ ...manualCalibration, stableId: KEEP_OUT_IDS.conversationBackRow }],
    enabledManualEntryIds: [KEEP_OUT_IDS.conversationBackRow],
  });
  const builtInCollision = builtInCollisionSession.manualCalibrations[0];
  assert.equal(builtInCollision?.calibration.status, 'refused');
  assert.equal(builtInCollision?.entry, null);
  assert.equal(builtInCollision?.projection, null);
  assert.equal(builtInCollision?.enabled, false);
  if (builtInCollisionSession.paint && 'plan' in builtInCollisionSession.paint) {
    assert.equal(builtInCollisionSession.paint.plan.keepOuts.some(command => command.entryId === KEEP_OUT_IDS.conversationBackRow && command.evidenceGrade === 'calibrated'), false);
  }

  const duplicatePermutationObservation = (manualInputs: readonly typeof manualCalibration[]) => {
    let seamReached = false;
    let result: ReturnType<typeof projectX4UiEditorSession>;
    try {
      seamReached = true;
      result = projectX4UiEditorSession({
        ...exact,
        manualCalibrations: manualInputs,
        enabledManualEntryIds: [manualCalibrationId],
      });
    } catch (error) {
      return {
        seamReached,
        threw: true,
        error: error instanceof Error ? error.message : String(error),
      };
    }
    return {
      seamReached,
      threw: false,
      statuses: result.manualCalibrations.map(item => item.calibration.status),
      reasons: result.manualCalibrations.map(item => item.calibration.status === 'refused' ? item.calibration.reason : null),
      enabled: result.manualCalibrations.map(item => item.enabled),
      paintedIds: result.paint && 'plan' in result.paint ? result.paint.plan.keepOuts.map(item => item.entryId) : [],
    };
  };
  recordSessionCausal(
    'causal-group-wide-duplicate-manual-id-refuses-every-occurrence',
    manualCalibrationId.length > 0 && JSON.stringify(manualCalibration) === manualInputSnapshot,
    'both duplicate occurrences refused duplicate-stable-id, neither enabled, and no duplicate ID reached Paint in either order',
    markSeamReached => {
      markSeamReached();
      return {
        forward: duplicatePermutationObservation([manualCalibration, { ...manualCalibration }]),
        reverse: duplicatePermutationObservation([{ ...manualCalibration }, manualCalibration]),
      };
    },
    observed => {
      if (observed === null || typeof observed !== 'object') return false;
      const record = observed as JsonRecord;
      return ['forward', 'reverse'].every(key => {
        const permutation = record[key];
        if (permutation === null || typeof permutation !== 'object') return false;
        const value = permutation as JsonRecord;
        return JSON.stringify(value.statuses) === JSON.stringify(['refused', 'refused'])
          && JSON.stringify(value.reasons) === JSON.stringify(['duplicate-stable-id', 'duplicate-stable-id'])
          && JSON.stringify(value.enabled) === JSON.stringify([false, false])
          && JSON.stringify(value.paintedIds) === JSON.stringify([])
          && value.seamReached === true
          && value.threw === false;
      });
    },
  );

  let manualFieldGetterReads = 0;
  const hostileManualSessionInput = { ...exact } as Record<string, unknown>;
  Object.defineProperty(hostileManualSessionInput, 'manualCalibrations', {
    enumerable: true,
    configurable: true,
    get: () => {
      manualFieldGetterReads += 1;
      throw new Error('manual calibration getter executed');
    },
  });
  const hostileManualSession = projectX4UiEditorSession(hostileManualSessionInput as unknown as X4UiEditorSessionInput);
  assert.equal(manualFieldGetterReads, 0);
  assert.equal(hostileManualSession.canRender, true);
  assert.equal(hostileManualSession.manualCalibrations[0]?.calibration.status, 'refused');
  assert.equal(hostileManualSession.manualCalibrations[0]?.calibration.status === 'refused' && hostileManualSession.manualCalibrations[0].calibration.reason, 'malformed-input');

  const proxyManualCounts: ProxyTrapCounts = { total: 0, get: 0, getPrototypeOf: 0, ownKeys: 0, getOwnPropertyDescriptor: 0 };
  const proxyManualTarget: Array<Record<string, unknown>> = [{ ...manualCalibration }];
  const proxyManualState = { armed: false };
  const proxyManualArray = armableTransparentProxy(proxyManualTarget, proxyManualCounts, proxyManualState);
  recordSessionCausal(
    'causal-transparent-proxy-manual-container-is-detached-facade',
    manualCalibrationId.length > 0,
    'admissible transparent facade is captured once into immutable detached manual authority without getter execution or post-call trap access',
    markSeamReached => {
      markSeamReached();
      const result = projectX4UiEditorSession({
        ...exact,
        manualCalibrations: proxyManualArray as unknown as X4UiEditorSessionInput['manualCalibrations'],
        enabledManualEntryIds: [manualCalibrationId],
      });
      const calibration = result.manualCalibrations[0];
      let deterministicReplay = false;
      try {
        const replayCounts: ProxyTrapCounts = { total: 0, get: 0, getPrototypeOf: 0, ownKeys: 0, getOwnPropertyDescriptor: 0 };
        const replay = projectX4UiEditorSession({
          ...exact,
          manualCalibrations: armableTransparentProxy([{ ...manualCalibration }], replayCounts, { armed: false }) as unknown as X4UiEditorSessionInput['manualCalibrations'],
          enabledManualEntryIds: [manualCalibrationId],
        });
        deterministicReplay = JSON.stringify(replay) === JSON.stringify(result);
      } catch {
        deterministicReplay = false;
      }
      const outputBeforeMutation = JSON.stringify(result.manualCalibrations);
      let postCallStable = false;
      try {
        proxyManualTarget[0] = { ...manualCalibration, stableId: 'post-call-session-facade-mutation' };
        proxyManualState.armed = true;
        postCallStable = JSON.stringify(result.manualCalibrations) === outputBeforeMutation;
      } catch {
        postCallStable = false;
      }
      return {
        traps: { ...proxyManualCounts },
        expectedTraps: { ...SESSION_ONE_ITEM_CONTAINER_PROXY_TRAPS },
        canRender: result.canRender,
        status: calibration?.calibration.status,
        entry: calibration?.entry,
        projection: calibration?.projection,
        enabled: calibration?.enabled,
        immutable: Object.isFrozen(result.manualCalibrations),
        postCallStable,
        deterministicReplay,
        paintedIds: result.paint && 'plan' in result.paint ? result.paint.plan.keepOuts.map(item => item.entryId) : [],
      };
    },
    observed => {
      if (observed === null || typeof observed !== 'object') return false;
      const value = observed as JsonRecord;
      return value.canRender === true
        && value.status === 'success'
        && (value.entry as JsonRecord | undefined)?.id === manualCalibrationId
        && (value.projection as JsonRecord | undefined)?.status === 'projected'
        && value.enabled === true
        && value.immutable === true
        && value.postCallStable === true
        && value.deterministicReplay === true
        && JSON.stringify(value.paintedIds) === JSON.stringify([manualCalibrationId])
        && proxyTrapCensusMatches(value.traps, SESSION_ONE_ITEM_CONTAINER_PROXY_TRAPS);
    },
  );

  let mixedAccessorReads = 0;
  const mixedAccessorPeer = { ...manualCalibration, stableId: 'session-manual-accessor-peer' } as Record<string, unknown>;
  Object.defineProperty(mixedAccessorPeer, 'stableId', {
    configurable: true,
    enumerable: true,
    get: () => {
      mixedAccessorReads += 1;
      throw new Error('mixed calibration getter executed');
    },
  });
  recordSessionCausal(
    'causal-ordinary-mixed-calibrations-preserve-valid-peer',
    manualCalibrationId.length > 0,
    'ordinary mixed calibration arrays keep the valid peer accepted while the accessor peer is visible and refused without getter execution',
    markSeamReached => {
      markSeamReached();
      const result = projectX4UiEditorSession({
        ...exact,
        manualCalibrations: [manualCalibration, mixedAccessorPeer] as unknown as X4UiEditorSessionInput['manualCalibrations'],
        enabledManualEntryIds: [manualCalibrationId],
      });
      return {
        getterReads: mixedAccessorReads,
        canRender: result.canRender,
        statuses: result.manualCalibrations.map(item => item.calibration.status),
        enabled: result.manualCalibrations.map(item => item.enabled),
        paintedIds: result.paint && 'plan' in result.paint ? result.paint.plan.keepOuts.map(item => item.entryId) : [],
      };
    },
    observed => {
      if (observed === null || typeof observed !== 'object') return false;
      const value = observed as JsonRecord;
      return value.canRender === true
        && value.getterReads === 0
        && JSON.stringify(value.statuses) === JSON.stringify(['success', 'refused'])
        && JSON.stringify(value.enabled) === JSON.stringify([true, false])
        && JSON.stringify(value.paintedIds) === JSON.stringify([manualCalibrationId]);
    },
  );

  const revokedManual = Proxy.revocable([manualCalibration], {});
  revokedManual.revoke();
  recordSessionCausal(
    'causal-revoked-proxy-manual-container-is-contained',
    manualCalibrationId.length > 0,
    'revoked Proxy manual-calibration container becomes a visible refusal without throw, authority, or Paint command',
    markSeamReached => {
      markSeamReached();
      const result = projectX4UiEditorSession({
        ...exact,
        manualCalibrations: revokedManual.proxy as unknown as X4UiEditorSessionInput['manualCalibrations'],
        enabledManualEntryIds: [manualCalibrationId],
      });
      const calibration = result.manualCalibrations[0];
      return {
        canRender: result.canRender,
        status: calibration?.calibration.status,
        entry: calibration?.entry,
        projection: calibration?.projection,
        enabled: calibration?.enabled,
        paintedIds: result.paint && 'plan' in result.paint ? result.paint.plan.keepOuts.map(item => item.entryId) : [],
      };
    },
    observed => {
      if (observed === null || typeof observed !== 'object') return false;
      const value = observed as JsonRecord;
      return value.canRender === true
        && value.status === 'refused'
        && value.entry === null
        && value.projection === null
        && value.enabled === false
        && JSON.stringify(value.paintedIds) === JSON.stringify([]);
    },
  );

  const directProxyCounts: ProxyTrapCounts = { total: 0, get: 0, getPrototypeOf: 0, ownKeys: 0, getOwnPropertyDescriptor: 0 };
  const directProxyTarget = { ...manualCalibration } as Record<string, unknown>;
  const directProxyState = { armed: false };
  const directProxyCalibration = armableTransparentProxy(directProxyTarget, directProxyCounts, directProxyState);
  recordSessionCausal(
    'causal-direct-proxy-calibration-element-is-detached-facade',
    manualCalibrationId.length > 0,
    'admissible direct Proxy calibration facade is captured once into immutable detached authority without post-call trap access',
    markSeamReached => {
      markSeamReached();
      const result = projectX4UiEditorSession({
        ...exact,
        manualCalibrations: [directProxyCalibration] as unknown as X4UiEditorSessionInput['manualCalibrations'],
        enabledManualEntryIds: [manualCalibrationId],
      });
      const calibration = result.manualCalibrations[0];
      let deterministicReplay = false;
      try {
        const replayCounts: ProxyTrapCounts = { total: 0, get: 0, getPrototypeOf: 0, ownKeys: 0, getOwnPropertyDescriptor: 0 };
        const replay = projectX4UiEditorSession({
          ...exact,
          manualCalibrations: [armableTransparentProxy({ ...manualCalibration }, replayCounts, { armed: false })] as unknown as X4UiEditorSessionInput['manualCalibrations'],
          enabledManualEntryIds: [manualCalibrationId],
        });
        deterministicReplay = JSON.stringify(replay) === JSON.stringify(result);
      } catch {
        deterministicReplay = false;
      }
      const outputBeforeMutation = JSON.stringify(result.manualCalibrations);
      let postCallStable = false;
      try {
        directProxyTarget.stableId = 'post-call-direct-facade-mutation';
        directProxyState.armed = true;
        postCallStable = JSON.stringify(result.manualCalibrations) === outputBeforeMutation;
      } catch {
        postCallStable = false;
      }
      return {
        traps: { ...directProxyCounts },
        expectedTraps: { ...SESSION_DIRECT_CANDIDATE_PROXY_TRAPS },
        canRender: result.canRender,
        status: calibration?.calibration.status,
        entry: calibration?.entry,
        projection: calibration?.projection,
        enabled: calibration?.enabled,
        immutable: Object.isFrozen(result.manualCalibrations),
        postCallStable,
        deterministicReplay,
        paintedIds: result.paint && 'plan' in result.paint ? result.paint.plan.keepOuts.map(item => item.entryId) : [],
      };
    },
    observed => {
      if (observed === null || typeof observed !== 'object') return false;
      const value = observed as JsonRecord;
      return value.canRender === true
        && value.status === 'success'
        && (value.entry as JsonRecord | undefined)?.id === manualCalibrationId
        && (value.projection as JsonRecord | undefined)?.status === 'projected'
        && value.enabled === true
        && value.immutable === true
        && value.postCallStable === true
        && value.deterministicReplay === true
        && JSON.stringify(value.paintedIds) === JSON.stringify([manualCalibrationId])
        && proxyTrapCensusMatches(value.traps, SESSION_DIRECT_CANDIDATE_PROXY_TRAPS);
    },
  );

  let mixedHostileAccessorReads = 0;
  const mixedHostileAccessorPeer = { ...manualCalibration, stableId: 'session-manual-hostile-accessor' } as Record<string, unknown>;
  Object.defineProperty(mixedHostileAccessorPeer, 'stableId', {
    configurable: true,
    enumerable: true,
    get: () => {
      mixedHostileAccessorReads += 1;
      throw new Error('mixed hostile calibration getter executed');
    },
  });
  const mixedSymbolPeer = { ...manualCalibration, stableId: 'session-manual-symbol-peer' } as Record<string, unknown>;
  Object.defineProperty(mixedSymbolPeer, Symbol('manual-symbol'), { enumerable: true, value: 'symbol-peer' });
  const mixedCyclePeer = { ...manualCalibration, stableId: 'session-manual-cycle-peer' } as Record<string, unknown>;
  mixedCyclePeer.cycle = mixedCyclePeer;
  const mixedProxyCounts: ProxyTrapCounts = { total: 0, get: 0, getPrototypeOf: 0, ownKeys: 0, getOwnPropertyDescriptor: 0 };
  const mixedProxyTarget = [manualCalibration, mixedHostileAccessorPeer, mixedSymbolPeer, mixedCyclePeer];
  const mixedProxyState = { armed: false };
  const mixedProxyArray = armableTransparentProxy(mixedProxyTarget, mixedProxyCounts, mixedProxyState);
  recordSessionCausal(
    'causal-transparent-proxy-mixed-hostile-facade-preserves-valid-peer',
    manualCalibrationId.length > 0,
    'transparent facade captures each candidate once: valid peer remains accepted, malformed peers remain visible/refused, and no getter or post-call trap runs',
    markSeamReached => {
      markSeamReached();
      const result = projectX4UiEditorSession({
        ...exact,
        manualCalibrations: mixedProxyArray as unknown as X4UiEditorSessionInput['manualCalibrations'],
        enabledManualEntryIds: [manualCalibrationId],
      });
      const outputBeforeMutation = JSON.stringify(result.manualCalibrations);
      let postCallStable = false;
      try {
        mixedProxyTarget[0] = { ...manualCalibration, stableId: 'post-call-mixed-facade-mutation' };
        mixedProxyState.armed = true;
        postCallStable = JSON.stringify(result.manualCalibrations) === outputBeforeMutation;
      } catch {
        postCallStable = false;
      }
      return {
        traps: { ...mixedProxyCounts },
        expectedTraps: { ...SESSION_MIXED_CONTAINER_PROXY_TRAPS },
        getterReads: mixedHostileAccessorReads,
        canRender: result.canRender,
        statuses: result.manualCalibrations.map(item => item.calibration.status),
        enabled: result.manualCalibrations.map(item => item.enabled),
        authority: result.manualCalibrations.map(item => ({ entry: item.entry, projection: item.projection })),
        immutable: Object.isFrozen(result.manualCalibrations),
        postCallStable,
        paintedIds: result.paint && 'plan' in result.paint ? result.paint.plan.keepOuts.map(item => item.entryId) : [],
      };
    },
    observed => {
      if (observed === null || typeof observed !== 'object') return false;
      const value = observed as JsonRecord;
      const statuses = value.statuses;
      const enabled = value.enabled;
      const authority = value.authority;
      return value.canRender === true
        && value.getterReads === 0
        && Array.isArray(statuses)
        && statuses.length === 4
        && JSON.stringify(statuses) === JSON.stringify(['success', 'refused', 'refused', 'refused'])
        && Array.isArray(enabled)
        && JSON.stringify(enabled) === JSON.stringify([true, false, false, false])
        && Array.isArray(authority)
        && authority[0] !== null
        && typeof authority[0] === 'object'
        && (authority[0] as JsonRecord).entry !== null
        && (authority[0] as JsonRecord).projection !== null
        && authority.slice(1).every(item => item !== null && typeof item === 'object' && (item as JsonRecord).entry === null && (item as JsonRecord).projection === null)
        && value.immutable === true
        && value.postCallStable === true
        && JSON.stringify(value.paintedIds) === JSON.stringify([manualCalibrationId])
        && proxyTrapCensusMatches(value.traps, SESSION_MIXED_CONTAINER_PROXY_TRAPS);
    },
  );

  const sessionToctouId = 'session-toctou-manual-id';
  const sessionToctouCounts: ProxyTrapCounts = { total: 0, get: 0, getPrototypeOf: 0, ownKeys: 0, getOwnPropertyDescriptor: 0 };
  const sessionToctouTarget = { ...manualCalibration, stableId: sessionToctouId };
  const sessionToctouDescriptorReads: string[] = [];
  const sessionToctouProxy = new Proxy(sessionToctouTarget, {
    get: (current, property, receiver) => {
      sessionToctouCounts.total += 1;
      sessionToctouCounts.get += 1;
      if (property === 'stableId') return sessionToctouId;
      return Reflect.get(current, property, receiver);
    },
    getPrototypeOf: current => {
      sessionToctouCounts.total += 1;
      sessionToctouCounts.getPrototypeOf += 1;
      return Reflect.getPrototypeOf(current);
    },
    ownKeys: current => {
      sessionToctouCounts.total += 1;
      sessionToctouCounts.ownKeys += 1;
      return Reflect.ownKeys(current);
    },
    getOwnPropertyDescriptor: (current, property) => {
      sessionToctouCounts.total += 1;
      sessionToctouCounts.getOwnPropertyDescriptor += 1;
      const descriptor = Reflect.getOwnPropertyDescriptor(current, property);
      if (property === 'stableId' && descriptor !== undefined && 'value' in descriptor) {
        const presented = sessionToctouDescriptorReads.length === 0
          ? KEEP_OUT_IDS.conversationBackRow
          : sessionToctouId;
        sessionToctouDescriptorReads.push(presented);
        return { ...descriptor, value: presented };
      }
      return descriptor;
    },
  });
  recordSessionCausal(
    'causal-session-toctou-snapshot-stops-collision-swap',
    manualCalibrationId.length > 0 && sessionToctouId.length > 0,
    'one detached calibration snapshot preserves the first built-in-collision ID and prevents a later ID story from issuing, enabling, or painting',
    markSeamReached => {
      markSeamReached();
      let result: ReturnType<typeof projectX4UiEditorSession> | undefined;
      let threw = false;
      try {
        result = projectX4UiEditorSession({
          ...exact,
          manualCalibrations: [sessionToctouProxy] as unknown as X4UiEditorSessionInput['manualCalibrations'],
          enabledManualEntryIds: [sessionToctouId],
        });
      } catch {
        threw = true;
      }
      const calibration = result?.manualCalibrations[0];
      return {
        traps: { ...sessionToctouCounts },
        expectedTraps: { ...SESSION_TOCTOU_CANDIDATE_PROXY_TRAPS },
        descriptorStableIds: [...sessionToctouDescriptorReads],
        threw,
        canRender: result?.canRender,
        stableId: calibration?.stableId,
        status: calibration?.calibration.status,
        reason: calibration?.calibration.status === 'refused' ? calibration.calibration.reason : undefined,
        entry: calibration?.entry,
        projection: calibration?.projection,
        enabled: calibration?.enabled,
        paintedIds: result?.paint && 'plan' in result.paint ? result.paint.plan.keepOuts.map(item => item.entryId) : [],
      };
    },
    observed => {
      if (observed === null || typeof observed !== 'object') return false;
      const value = observed as JsonRecord;
      return value.threw === false
        && value.canRender === true
        && JSON.stringify(value.descriptorStableIds) === JSON.stringify([KEEP_OUT_IDS.conversationBackRow])
        && value.stableId === KEEP_OUT_IDS.conversationBackRow
        && value.status === 'refused'
        && typeof value.reason === 'string'
        && value.entry === null
        && value.projection === null
        && value.enabled === false
        && JSON.stringify(value.paintedIds) === JSON.stringify([])
        && proxyTrapCensusMatches(value.traps, SESSION_TOCTOU_CANDIDATE_PROXY_TRAPS);
    },
  );

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

  const failedSessionCausalRows = sessionCausalRows.filter(row => !row.pass);
  console.log(`BATCH_8C1_CORRECTION_SESSION_CAUSAL ${JSON.stringify({ total: sessionCausalRows.length, passed: sessionCausalRows.length - failedSessionCausalRows.length, red: failedSessionCausalRows, proxyTrapOracleSensitivity })}`);
  if (failedSessionCausalRows.length > 0) throw new Error(`${failedSessionCausalRows.length} session causal checks failed`);
  const failedP7Rows = p7SessionRows.filter(row => !row.pass);
  const ownerBindingReceipt = p7SessionRows
    .filter(row => row.name.includes('exact own-data') || row.name.includes('sampled public path'))
    .map(row => {
      const observed = p7SessionRecord(row.observed);
      return {
        name: row.name,
        legacyWrongPaintOwnerAccepted: observed?.legacyWrongPaintOwnerAccepted,
        wrongPaintOwnerRejected: observed?.wrongPaintOwnerRejected,
        legacySameColorOwnerMutationAccepted: observed?.legacySameColorOwnerMutationAccepted,
        sameColorMutationPreservesCardinality: observed?.sameColorMutationPreservesCardinality,
        sameColorMutationPreservesNonOwnerColorSignature: observed?.sameColorMutationPreservesNonOwnerColorSignature,
        sameColorOwnerMutationRejected: observed?.sameColorOwnerMutationRejected,
        missingNodeIdDeleted: observed?.missingNodeIdDeleted,
        missingNodeIdOriginalHadOwnId: observed?.missingNodeIdOriginalHadOwnId,
        missingNodeIdOriginalId: observed?.missingNodeIdOriginalId,
        missingNodeIdOriginalIdUnchanged: observed?.missingNodeIdOriginalIdUnchanged,
        missingNodeIdTintDataPreserved: observed?.missingNodeIdTintDataPreserved,
        missingNodeIdPreservesCardinality: observed?.missingNodeIdPreservesCardinality,
        missingNodeIdPreservesNonOwnerColorSignature: observed?.missingNodeIdPreservesNonOwnerColorSignature,
        productionLegacyNodeIdFallbackAccepted: observed?.productionLegacyNodeIdFallbackAccepted,
        staticFallbackBaselineAccepted: observed?.staticFallbackBaselineAccepted,
        staticFallbackNodeIdDeleted: observed?.staticFallbackNodeIdDeleted,
        staticFallbackOriginalHadOwnId: observed?.staticFallbackOriginalHadOwnId,
        staticFallbackOriginalId: observed?.staticFallbackOriginalId,
        staticFallbackOriginalIdUnchanged: observed?.staticFallbackOriginalIdUnchanged,
        staticFallbackOriginalIdSupportsOwner: observed?.staticFallbackOriginalIdSupportsOwner,
        staticFallbackTintDataPreserved: observed?.staticFallbackTintDataPreserved,
        staticFallbackPreservesCardinality: observed?.staticFallbackPreservesCardinality,
        staticFallbackPreservesNonOwnerColorSignature: observed?.staticFallbackPreservesNonOwnerColorSignature,
        legacyNodeIdFallbackAccepted: observed?.legacyNodeIdFallbackAccepted,
        staticFallbackRejected: observed?.staticFallbackRejected,
        missingNodeIdRejected: observed?.missingNodeIdRejected,
      };
    });
  console.log(`P7_EDITOR_SESSION_OWNER_BINDING_RECEIPT ${JSON.stringify(ownerBindingReceipt)}`);
  console.log(`P7_EDITOR_SESSION_CANONICAL_COLOR_MATRIX ${JSON.stringify({ total: p7SessionRows.length, passed: p7SessionRows.length - failedP7Rows.length, red: failedP7Rows.map(row => ({ ...row, observed: p7SessionReceipt(row.observed) })), colorFixtureError: p7ColorFixtureError, projectionFixtureError: p7FixtureError })}`);
  if (failedP7Rows.length > 0) throw new Error(`${failedP7Rows.length} EditorSession P7 canonical-color checks failed`);
  console.log('x4UiEditorSession.selftest: PASS');
}

void run().catch(error => {
  console.error('x4UiEditorSession.selftest: FAIL');
  console.error(error);
  process.exitCode = 1;
});
