import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isDeepStrictEqual } from 'node:util';
import path from 'node:path';

import {
  X4_UI_SCENE_GAME_TRUTH,
  buildX4UiScene,
  diagnoseX4UiSceneStructureForTest,
  type X4UiSceneFontAssetMap,
  type X4UiSceneColorFact,
  type X4UiSceneProfile,
  type X4UiSceneResult,
  type X4UiScene,
  type X4UiSceneSourceLocation,
} from './x4UiScene';
import {
  X4_LAYOUT_PROVENANCE,
  addRow,
  createHelperTable,
  finalizeHelperTable,
  getColSpanWidth,
  getCellHeight,
  getFullTableHeight,
  getRowHeight,
  setColWidth,
  setColWidthPercent,
  setColWidthMin,
  setCellColSpan,
  specializeCell,
  type HelperTableState,
  type LayoutResult,
  type X4UiLayoutMetrics,
} from './x4UiLayoutKernel';
import {
  X4_UI_LAYOUT_GAME_TRUTH,
  validateX4UiLayoutEvidencePair,
  type X4UiLayoutCellNode,
  type X4UiLayoutDescriptorFact,
  type X4UiLayoutEvidenceAuthority,
  type X4UiLayoutFrameNode,
  type X4UiLayoutModelIdentity,
  type X4UiLayoutOperation,
  type X4UiLayoutProgram,
  type X4UiLayoutProgramResult,
  type X4UiLayoutRowNode,
  type X4UiLayoutSourcePin,
  type X4UiLayoutTableNode,
} from './x4UiLayoutProgram';
import {
  buildX4UiCallModel,
  type X4UiCallModel,
} from './x4UiCallModel';
import {
  createX4UiLayoutTargetCatalog,
  projectX4UiLayoutProgram,
} from './x4UiLayoutProgram';
import {
  projectX4UiEditorSession,
} from './x4UiEditorSession';
import { resolveXsdConfig } from './xsdParser';
import {
  ZEKTON_ABC_FORMAT_VERSION,
  ZEKTON_CORPUS_ASSETS,
  ZEKTON_EVIDENCE_STATE,
  ZEKTON_DDS_HEADER_SIZE,
  ZEKTON_DESCRIPTOR_HEADER_SIZE,
  ZEKTON_DESCRIPTOR_TRAILING_SIZE,
  ZEKTON_RECORD_SIZE,
  type ZektonAbcDescriptor,
  type ZektonA8DdsAtlas,
  type ZektonFontAssets,
  type ZektonGlyphMetrics,
  type ZektonLineMetrics,
} from './x4UiFontMetrics';
import {
  X4_UI_CORPUS_FILE_URL,
  X4_UI_CORPUS_MANIFEST_URL,
  X4_UI_CORPUS_STATUS_URL,
  X4_UI_CORPUS_COLORS_XML_PATH,
  X4_UI_CORPUS_COLORS_XML_SHA256,
  X4_UI_CORPUS_COLORS_XML_SIZE,
  X4_UI_CORPUS_COLORS_XSD_PATH,
  X4_UI_CORPUS_COLORS_XSD_SHA256,
  X4_UI_CORPUS_COLORS_XSD_SIZE,
  X4_UI_CORPUS_9_00_CONTRACT,
  loadCanonicalX4UiCorpusAssets,
  loadCanonicalX4UiCorpusColorEvidence,
  type X4UiCorpusCanonicalSuccess,
  type X4UiCorpusCanonicalColorSuccess,
  type X4UiCorpusFetchResponse,
} from './x4UiCorpusAssets';

const HELPER_PATH = X4_LAYOUT_PROVENANCE.helperSourcePath;
const WIDGET_PATH = X4_LAYOUT_PROVENANCE.widgetSourcePath;
const HASH = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const DETERMINISTIC_DESCRIPTOR_PARTIAL_REASON_FOR_TEST = 'cell kernel state is deterministic but one or more descriptor facts remain unavailable';

let passed = 0;
let total = 0;
const failures: string[] = [];

const assert: (condition: unknown, message: string) => asserts condition = (condition, message): void => {
  if (!condition) throw new Error(message);
};

const test = (name: string, body: () => void): void => {
  total += 1;
  try {
    body();
    passed += 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    failures.push(`${name}: ${message}`);
  }
};

const source = (offset: number): X4UiSceneSourceLocation => ({
  file: 'fixture.lua',
  start: { line: Math.floor(offset / 10) + 1, column: 0, offset },
  end: { line: Math.floor(offset / 10) + 1, column: 8, offset: offset + 8 },
} as X4UiSceneSourceLocation);

const pin = (lineStart: number, lineEnd = lineStart): X4UiLayoutSourcePin => ({
  sourcePath: HELPER_PATH,
  lineStart,
  lineEnd,
});

const known = (
  value: number | string | boolean,
  expectedType: 'number' | 'string' | 'boolean',
  at: X4UiSceneSourceLocation,
  expression = String(value),
): X4UiLayoutDescriptorFact => ({
  status: 'known',
  expectedType,
  value,
  provenance: 'source-literal',
  expression,
  source: at,
});

const unavailable = (
  expectedType: 'number' | 'string' | 'boolean' | 'color-object',
  reason: string,
  at: X4UiSceneSourceLocation,
): X4UiLayoutDescriptorFact => ({
  status: 'unavailable',
  expectedType,
  reason,
  source: at,
});

const unwrap = <T>(result: LayoutResult<T>): T => {
  if (result.status !== 'ok') throw new Error(result.message);
  return result.value;
};

const metrics: X4UiLayoutMetrics = {
  uiScale: 1,
  borderSize: 1,
  scrollbarWidth: 5,
  standardContainerOffset: 2,
};

const lineMetrics: ZektonLineMetrics = {
  outer: 16,
  top: 3,
  bottom: 3,
  inner: 10,
  split20: 4,
  split24: 6,
  rawMetric28: 0,
};

const makeFont = (bold: boolean): ZektonFontAssets => {
  const canonical = bold ? ZEKTON_CORPUS_ASSETS.bold : ZEKTON_CORPUS_ASSETS.regular;
  const glyph: ZektonGlyphMetrics = {
    glyphIndex: 1,
    uv: { u0: 0, v0: 0, u1: 1, v1: 1 },
    pixelBounds: { left: 0, top: 0, right: 8, bottom: 10 },
    horizontalBearing: 0,
    bearingX: 0,
    bitmapWidth: 8,
    width: 8,
    advance: 8,
    page: 0,
  };
  const map = new Array<number>(128).fill(1);
  const header = {
    formatVersion: ZEKTON_ABC_FORMAT_VERSION,
    lineMetrics,
    reserved32: 0 as const,
    atlasWidth: 8,
    atlasHeight: 10,
    maxCodepoint: 127,
  };
  const glyphs = [glyph];
  const headerBytes = new Array<number>(48).fill(0);
  const descriptor: ZektonAbcDescriptor = {
    format: 'x4-zekton-abc',
    atlasWidth: 8,
    atlasHeight: 10,
    maxCodepoint: 127,
    codePointToGlyphIndex: map,
    map,
    glyphRecords: glyphs,
    glyphs,
    glyphCount: 1,
    recordSize: 24,
    headerBytes,
    header,
    lineMetrics,
    trailingBytes: new Array<number>(4).fill(0),
    identity: canonical.descriptor,
    provenance: { identity: canonical.descriptor, evidenceState: ZEKTON_EVIDENCE_STATE },
    evidenceState: ZEKTON_EVIDENCE_STATE,
  };
  const atlas: ZektonA8DdsAtlas = {
    format: 'x4-zekton-a8-dds',
    width: 8,
    height: 10,
    dimensions: { width: 8, height: 10 },
    payloadOffset: 128,
    payloadLength: 80,
    mipMapCount: 0,
    depth: 0,
    alphaBytes: new Uint8Array(80).fill(255),
    identity: canonical.atlas,
    provenance: { identity: canonical.atlas, evidenceState: ZEKTON_EVIDENCE_STATE },
    evidenceState: ZEKTON_EVIDENCE_STATE,
  };
  return {
    format: 'x4-zekton-font-assets',
    descriptor,
    atlas,
    descriptorIdentity: canonical.descriptor,
    atlasIdentity: canonical.atlas,
    evidenceState: ZEKTON_EVIDENCE_STATE,
    provenance: {
      descriptor: { identity: canonical.descriptor, evidenceState: ZEKTON_EVIDENCE_STATE },
      atlas: { identity: canonical.atlas, evidenceState: ZEKTON_EVIDENCE_STATE },
    },
  };
};

const freezeFixtureGraph = <T>(value: T, seen = new WeakSet<object>()): T => {
  if (value === null || typeof value !== 'object' || value instanceof Uint8Array) return value;
  if (seen.has(value)) return value;
  seen.add(value);
  for (const key of Object.keys(value as object)) {
    freezeFixtureGraph((value as Record<string, unknown>)[key], seen);
  }
  return Object.freeze(value);
};

const assets: X4UiSceneFontAssetMap = freezeFixtureGraph({
  Zekton: makeFont(false),
  'Zekton Bold': makeFont(true),
});

type CanonicalLineMetricsFixture = Pick<ZektonLineMetrics, 'outer' | 'top' | 'bottom' | 'inner' | 'split20' | 'split24'>;

const DEFAULT_CANONICAL_LINE_METRICS: CanonicalLineMetricsFixture = {
  outer: 16,
  top: 3,
  bottom: 3,
  inner: 10,
  split20: 4,
  split24: 6,
};

const makeCanonicalAbc = (
  advance: number,
  lineMetrics: CanonicalLineMetricsFixture = DEFAULT_CANONICAL_LINE_METRICS,
): Uint8Array => {
  const maxCodepoint = 127;
  const mapBytes = (maxCodepoint + 1) * 2;
  const recordStart = (ZEKTON_DESCRIPTOR_HEADER_SIZE + mapBytes + 3) & ~3;
  const bytes = new Uint8Array(recordStart + ZEKTON_RECORD_SIZE + ZEKTON_DESCRIPTOR_TRAILING_SIZE);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 9, true);
  view.setFloat32(4, lineMetrics.outer, true);
  view.setFloat32(8, lineMetrics.top, true);
  view.setFloat32(12, lineMetrics.bottom, true);
  view.setFloat32(16, lineMetrics.inner, true);
  view.setInt32(20, lineMetrics.split20, true);
  view.setInt32(24, lineMetrics.split24, true);
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
};

const makeCanonicalDds = (): Uint8Array => {
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
};

const hexBytes = (hex: string): ArrayBuffer => {
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  return bytes.buffer;
};

const withCanonicalPlatformHash = async <T>(expectedHashes: readonly string[], run: () => Promise<T>): Promise<T> => {
  const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  const originalValue = (globalThis as unknown as { crypto?: unknown }).crypto;
  let hashIndex = 0;
  const fakeCrypto = {
    subtle: {
      digest: async (..._args: readonly unknown[]): Promise<ArrayBuffer> => {
        const expected = expectedHashes[hashIndex++];
        if (expected === undefined) throw new Error('canonical selftest hash count mismatch');
        return hexBytes(expected);
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
    assert((globalThis as unknown as { crypto?: unknown }).crypto === originalValue, 'canonical selftest must restore global Web Crypto');
  }
};

const canonicalCorpus = async (lineMetrics = DEFAULT_CANONICAL_LINE_METRICS): Promise<X4UiCorpusCanonicalSuccess> => {
  const root = 'canonical-selftest-root';
  const generation = 'canonical-selftest-generation';
  const generatedAt = '2026-08-11T00:00:00.000Z';
  const contract = X4_UI_CORPUS_9_00_CONTRACT;
  const bytes = new Map<string, Uint8Array>([
    [contract.helper.relativePath, new TextEncoder().encode('-- canonical selftest helper\n')],
    [contract.widget.relativePath, new TextEncoder().encode('-- canonical selftest widget\n')],
    [contract.regular.descriptor.relativePath, makeCanonicalAbc(8, lineMetrics)],
    [contract.regular.atlas.relativePath, makeCanonicalDds()],
    [contract.bold.descriptor.relativePath, makeCanonicalAbc(8, lineMetrics)],
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
    generatedAt,
    manifestGeneration: generation,
    manifest: { available: true, state: 'ready', root, current: { generation, root, generatedAt } },
  };
  const transport = async (url: string): Promise<X4UiCorpusFetchResponse> => {
    if (url === X4_UI_CORPUS_STATUS_URL) {
      return { status: 200, headers: { get: () => 'application/json; charset=utf-8' }, json: async () => status };
    }
    if (url.startsWith(`${X4_UI_CORPUS_MANIFEST_URL}?`)) {
      const path = decodeURIComponent(url.split('q=')[1].split('&')[0]);
      const value = bytes.get(path);
      if (!value) throw new Error(`unknown canonical manifest path ${path}`);
      return {
        status: 200,
        headers: { get: () => 'application/json; charset=utf-8' },
        json: async () => ({
          status: { available: true, state: 'ready', root, current: { generation, root, generatedAt } },
          generation,
          total: 1,
          limit: 500,
          offset: 0,
          files: [{ path, bytes: value.byteLength }],
        }),
      };
    }
    if (url.startsWith(`${X4_UI_CORPUS_FILE_URL}?`)) {
      const path = decodeURIComponent(url.split('path=')[1]);
      const value = bytes.get(path);
      if (!value) throw new Error(`unknown canonical file path ${path}`);
      const copied = value.slice();
      return {
        status: 200,
        headers: { get: () => path.endsWith('.lua') ? 'text/plain' : 'application/octet-stream' },
        arrayBuffer: async () => copied.buffer,
      };
    }
    throw new Error(`unexpected canonical selftest URL ${url}`);
  };
  const result = await withCanonicalPlatformHash(expectedHashes, () => loadCanonicalX4UiCorpusAssets({ transport }));
  if (result.ok === false) throw new Error(`canonical selftest loader failed: ${result.error.message}`);
  return result;
};

const corpus = await canonicalCorpus();
const pinnedLineAdvanceCorpus = await canonicalCorpus({
  outer: 52,
  top: 0,
  bottom: 0,
  inner: 52,
  split20: 41,
  split24: 11,
});

const P3_COLOR_BASE_IDS = [
  'white',
  'black',
  'grey_128',
  'black_alpha_0',
  'white_weak_glow',
  'azure_very_dark',
  'azure_moderate_glow',
  'azure_dark_alpha_160_glow',
  'azure_very_dark_alpha_224',
  'literal_base',
] as const;

const P3_COLOR_MAPPING_IDS = [
  'table_background_default',
  'row_background',
  'text_normal',
  'icon_normal',
  'button_background_default',
  'button_highlight_default',
  'button_border_default',
  'editbox_background_default',
  'editbox_text_default',
  'editbox_background_black',
] as const;

const p3PaddedUtf8 = (text: string, size: number): Uint8Array => {
  const bytes = new TextEncoder().encode(text);
  if (bytes.byteLength > size) throw new Error(`Scene P3 fixture exceeds pinned size ${size}`);
  const padded = new Uint8Array(size);
  padded.set(bytes);
  padded.fill(0x20, bytes.byteLength);
  return padded;
};

const p3HexDigest = (hex: string): ArrayBuffer => {
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  return bytes.buffer;
};

const p3ColorAuthority = await (async (): Promise<X4UiCorpusCanonicalColorSuccess> => {
  const baseIds: string[] = [...P3_COLOR_BASE_IDS];
  while (baseIds.length < 224) baseIds.push(`scene_p3_base_${baseIds.length.toString().padStart(3, '0')}`);
  const specialValues: Record<string, readonly [number, number, number, number, number]> = {
    white: [11, 22, 33, 44, 0.1],
    black: [0, 0, 0, 255, 0],
    grey_128: [128, 128, 128, 255, 0],
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
    editbox_text_default: 'grey_128',
    editbox_background_black: 'black',
  };
  const mappings = P3_COLOR_MAPPING_IDS.map(id => `    <mapping id="${id}" ref="${mappingRefs[id]}"/>`);
  for (let index = mappings.length; index < 804; index += 1) mappings.push(`    <mapping id="scene_p3_map_${index.toString().padStart(3, '0')}" ref="${baseIds[index % baseIds.length]}"/>`);
  const xml = p3PaddedUtf8([
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<colormap>',
    '  <colors>',
    ...colors,
    '  </colors>',
    '  <mappings>',
    ...mappings,
    '  </mappings>',
    '</colormap>',
  ].join('\n'), X4_UI_CORPUS_COLORS_XML_SIZE);
  const xsd = p3PaddedUtf8([
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">',
    '  <xs:simpleType name="identifier"><xs:restriction base="xs:string"><xs:pattern value="[a-zA-Z_][a-zA-Z0-9_]*"/></xs:restriction></xs:simpleType>',
    '</xs:schema>',
  ].join('\n'), X4_UI_CORPUS_COLORS_XSD_SIZE);
  const buffers = new Map<string, Uint8Array>([
    [X4_UI_CORPUS_COLORS_XML_PATH, xml],
    [X4_UI_CORPUS_COLORS_XSD_PATH, xsd],
  ]);
  const queryValue = (url: string, key: string): string => {
    const marker = `${key}=`;
    const start = url.indexOf(marker);
    if (start < 0) throw new Error(`Scene P3 fixture query is missing ${key}`);
    return decodeURIComponent(url.slice(start + marker.length).split('&')[0]);
  };
  const transport = async (url: string): Promise<X4UiCorpusFetchResponse> => {
    if (url === X4_UI_CORPUS_STATUS_URL) {
      return {
        status: 200,
        headers: { get: name => name.toLowerCase() === 'content-type' ? 'application/json' : null },
        json: async () => ({
          available: true,
          root: 'scene-p3-root',
          generatedAt: '2026-08-19T00:00:00.000Z',
          manifestGeneration: 'scene-p3-generation',
          manifest: {
            available: true,
            state: 'ready',
            root: 'scene-p3-root',
            current: { generation: 'scene-p3-generation', root: 'scene-p3-root', generatedAt: '2026-08-19T00:00:00.000Z' },
          },
        }),
      };
    }
    if (url.startsWith(`${X4_UI_CORPUS_MANIFEST_URL}?`)) {
      const requested = queryValue(url, 'q');
      const value = buffers.get(requested);
      if (!value) throw new Error(`Scene P3 fixture does not contain ${requested}`);
      return {
        status: 200,
        headers: { get: name => name.toLowerCase() === 'content-type' ? 'application/json' : null },
        json: async () => ({
          status: {
            available: true,
            state: 'ready',
            root: 'scene-p3-root',
            current: { generation: 'scene-p3-generation', root: 'scene-p3-root', generatedAt: '2026-08-19T00:00:00.000Z' },
          },
          generation: 'scene-p3-generation',
          total: 1,
          limit: 500,
          offset: 0,
          files: [{ path: requested, bytes: value.byteLength }],
        }),
      };
    }
    if (url.startsWith(`${X4_UI_CORPUS_FILE_URL}?`)) {
      const requested = queryValue(url, 'path');
      const value = buffers.get(requested);
      if (!value) throw new Error(`Scene P3 fixture does not contain ${requested}`);
      return {
        status: 200,
        headers: { get: name => name.toLowerCase() === 'content-type' ? 'application/xml' : null },
        arrayBuffer: async () => value.slice().buffer,
      };
    }
    throw new Error(`unexpected Scene P3 fixture URL ${url}`);
  };
  const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  const originalValue = (globalThis as unknown as { crypto?: unknown }).crypto;
  let hashIndex = 0;
  try {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      enumerable: originalDescriptor?.enumerable ?? true,
      writable: true,
      value: { subtle: { digest: async (): Promise<ArrayBuffer> => {
        const expected = [X4_UI_CORPUS_COLORS_XML_SHA256, X4_UI_CORPUS_COLORS_XSD_SHA256][hashIndex++];
        if (!expected) throw new Error('Scene P3 canonical hash count mismatch');
        return p3HexDigest(expected);
      } } },
    });
    const result = await loadCanonicalX4UiCorpusColorEvidence({ transport });
    if ('error' in result) throw new Error(`Scene P3 color fixture failed: ${result.error.code}: ${result.error.message}`);
    return result;
  } finally {
    if (originalDescriptor) Object.defineProperty(globalThis, 'crypto', originalDescriptor);
    else Reflect.deleteProperty(globalThis, 'crypto');
    assert((globalThis as unknown as { crypto?: unknown }).crypto === originalValue, 'Scene P3 fixture must restore global Web Crypto');
  }
})();

const sourceIdentity: X4UiLayoutModelIdentity = {
  file: 'fixture.lua',
  sourcePath: 'fixture.lua',
  sha256: HASH,
};

const programProfile = {
  id: 'fixture-profile',
  provenance: 'Batch 6A selftest fixture',
  truthGrade: 'captured' as const,
  source: sourceIdentity,
  frame: { width: 100, height: 60 },
  metrics,
  helper: {
    sourcePath: HELPER_PATH,
    sha256: X4_LAYOUT_PROVENANCE.helperSha256,
    constants: {
      standardTextHeight: { value: 16, source: pin(5482, 5497) },
      standardButtonHeight: { value: 12, source: pin(5801, 5811) },
      borderSize: { value: 1, source: pin(5004, 5075) },
      viewWidth: { value: 100, source: pin(3793, 3797) },
      viewHeight: { value: 60, source: pin(3793, 3797) },
    },
  },
  widget: {
    sourcePath: WIDGET_PATH,
    sha256: X4_LAYOUT_PROVENANCE.widgetSha256,
  },
  defaults: {
    standardButtonHeight: { value: 12, source: pin(5801, 5811) },
    minTextHeight: 10,
  },
};

const sceneProfile: X4UiSceneProfile = Object.freeze({
  id: 'scene-profile',
  provenance: 'Batch 6A selftest preview',
  source: sourceIdentity,
  helper: { sourcePath: HELPER_PATH, sha256: X4_LAYOUT_PROVENANCE.helperSha256 },
  widget: { sourcePath: WIDGET_PATH, sha256: X4_LAYOUT_PROVENANCE.widgetSha256 },
  fonts: {
    Zekton: { descriptor: ZEKTON_CORPUS_ASSETS.regular.descriptor, atlas: ZEKTON_CORPUS_ASSETS.regular.atlas },
    'Zekton Bold': { descriptor: ZEKTON_CORPUS_ASSETS.bold.descriptor, atlas: ZEKTON_CORPUS_ASSETS.bold.atlas },
  },
  drawable: { width: 100, height: 60 },
  textPolicy: {
    nominalDesignSize: 32 as const,
    lineSpacing: 0,
    wrapMode: 'no-wrap',
    truncationMode: 'none',
    whitespacePolicy: { mode: 'preserve', breakOn: 'ascii-space' },
    ellipsisPolicy: { token: '.', placement: 'end' },
    newlinePolicy: 'lf-crlf',
    truthGrade: 'source-backed-provisional',
    evidenceState: ZEKTON_EVIDENCE_STATE,
  } as X4UiSceneProfile['textPolicy'],
});

const rawProducerSource = [
  'local menu = { name = "RawScene", layer = 1 }',
  'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
  'local table = frame:addTable(4, { width = 100, reserveScrollBar = false, scaling = false })',
  'table:setColWidth(1, 20, false)',
  'table:setColWidth(2, 20, false)',
  'table:setColWidth(3, 20, false)',
  'table:setColWidth(4, 20, false)',
  'local row = table:addRow(false, { paddingTop = 1, paddingBottom = 1, borderBelow = false, fixed = false })',
  'row[1]:setColSpan(2):createText("raw", { height = 12, minRowHeight = 10 })',
  'row[3]:createButton({ height = 0, affectRowHeight = false })',
  'row[4]:createIcon("solid", { height = 8, affectRowHeight = false })',
  'frame:display()',
].join('\n');

const rawProducerProjection = (() => {
  const model = buildX4UiCallModel({ rel: 'raw-scene.lua', text: rawProducerSource, sourcePath: 'fixture://raw-scene.lua' });
  const catalog = createX4UiLayoutTargetCatalog(model);
  const target = catalog.targets.find(candidate => candidate.kind === 'top-level');
  if (!target) return { result: undefined };
  const profile = {
    id: 'raw-scene-profile',
    provenance: 'Batch 6A-S raw producer selftest',
    truthGrade: 'captured' as const,
    source: catalog.sourceIdentity,
    frame: { width: 100, height: 80 },
    metrics: {
      uiScale: 1,
      borderSize: 1,
      scrollbarWidth: 5,
      standardContainerOffset: 2,
    },
    helper: {
      sourcePath: HELPER_PATH,
      sha256: X4_LAYOUT_PROVENANCE.helperSha256,
      constants: {
        standardTextHeight: { value: 16, source: pin(533) },
        standardButtonHeight: { value: 25, source: pin(522) },
        borderSize: { value: 1, source: pin(709) },
        viewWidth: { value: 100, source: pin(707) },
        viewHeight: { value: 80, source: pin(708) },
      },
    },
    widget: { sourcePath: WIDGET_PATH, sha256: X4_LAYOUT_PROVENANCE.widgetSha256 },
    defaults: { standardButtonHeight: { value: 25, source: pin(522) }, minTextHeight: 10 },
  } as Parameters<typeof projectX4UiLayoutProgram>[2];
  const result = projectX4UiLayoutProgram(model, target, profile);
  if (!('program' in result) || !result.program) return { result };
  const projectedProfile: X4UiSceneProfile = Object.freeze({
    id: 'raw-scene-profile',
    provenance: 'Batch 6A-S raw producer selftest',
    source: result.program.profile.source,
    helper: { sourcePath: HELPER_PATH, sha256: X4_LAYOUT_PROVENANCE.helperSha256 },
    widget: { sourcePath: WIDGET_PATH, sha256: X4_LAYOUT_PROVENANCE.widgetSha256 },
    fonts: sceneProfile.fonts,
    drawable: { width: result.program.profile.frame.width, height: result.program.profile.frame.height },
    textPolicy: sceneProfile.textPolicy,
  });
  return { result, program: result.program, profile: projectedProfile };
})();

const rawProjectionFor = (
  sourceText: string,
  sourcePath: string,
  producerProfileUpdate?: (
    profile: Parameters<typeof projectX4UiLayoutProgram>[2],
  ) => Parameters<typeof projectX4UiLayoutProgram>[2],
  colorEvidence?: X4UiCorpusCanonicalColorSuccess,
) => {
  const model = buildX4UiCallModel({ rel: sourcePath, text: sourceText, sourcePath });
  const catalog = createX4UiLayoutTargetCatalog(model);
  const target = catalog.targets.find(candidate => candidate.kind === 'top-level');
  const baseProfile = rawProducerProjection.program?.profile;
  if (!target || !baseProfile) return { model, target, result: undefined, program: undefined, profile: undefined };
  const baseBranchProfile = { ...baseProfile, source: catalog.sourceIdentity };
  const profile = producerProfileUpdate === undefined ? baseBranchProfile : producerProfileUpdate(baseBranchProfile);
  const projectWithColorEvidence = projectX4UiLayoutProgram as unknown as (
    modelValue: X4UiCallModel,
    targetValue: Parameters<typeof projectX4UiLayoutProgram>[1],
    profileValue: Parameters<typeof projectX4UiLayoutProgram>[2],
    previewSampleValue?: unknown,
    previewPathValue?: unknown,
    colorEvidenceValue?: unknown,
  ) => ReturnType<typeof projectX4UiLayoutProgram>;
  const result = projectWithColorEvidence(model, target, profile, undefined, undefined, colorEvidence);
  if (!('program' in result) || !result.program) return { model, target, result, program: undefined, profile: undefined };
  const branchProfile: X4UiSceneProfile = Object.freeze({
    id: 'raw-branch-profile',
    provenance: 'Batch 6A-S raw producer branch selftest',
    source: result.program.profile.source,
    helper: { sourcePath: HELPER_PATH, sha256: X4_LAYOUT_PROVENANCE.helperSha256 },
    widget: { sourcePath: WIDGET_PATH, sha256: X4_LAYOUT_PROVENANCE.widgetSha256 },
    fonts: sceneProfile.fonts,
    drawable: { width: result.program.profile.frame.width, height: result.program.profile.frame.height },
    textPolicy: sceneProfile.textPolicy,
  });
  return { model, target, result, program: result.program, profile: branchProfile };
};

const colorProjection = (() => {
  const sourceText = [
    'local menu = { name = "SceneColors", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(4, { width = 100, reserveScrollBar = false, backgroundID = "solid", backgroundColor = Color["table_background_default"] })',
    'table:setColWidth(1, 20, false)',
    'table:setColWidth(2, 20, false)',
    'table:setColWidth(3, 20, false)',
    'table:setColWidth(4, 20, false)',
    'local row = table:addRow(false, { paddingTop = 1, paddingBottom = 1, borderBelow = false, fixed = false, scaling = false })',
    'row[1]:createText("literal", { height = 12, minRowHeight = 10, color = { r = 12.5, g = 23.5, b = 34.5, a = 45.5, glow = 0.25 }, cellBGColor = Color["row_background"] })',
    'row[2]:createButton({ height = 12, bgcolor = Color["button_background_default"], highlightColor = Color["button_highlight_default"], borderColor = Color["button_border_default"] }):setText("primary", { color = Color["text_normal"] }):setText2("secondary", { color = { r = 15, g = 25, b = 35, a = 55 } })',
    'row[3]:createEditBox({ height = 12, defaultText = "Placeholder", active = false, bgColor = Color["editbox_background_default"] }):setText("", { x = 5, y = 0 })',
    'row[4]:createIcon("icon", { height = 8, affectRowHeight = false, color = Color["white"] })',
    'frame:display()',
  ].join('\n');
  const model = buildX4UiCallModel({ rel: 'selftest/scene-colors.lua', text: sourceText, sourcePath: 'selftest/scene-colors.lua' });
  const catalog = createX4UiLayoutTargetCatalog(model);
  const target = catalog.targets.find(candidate => candidate.kind === 'top-level');
  const baseProfile = rawProducerProjection.program?.profile;
  if (!target || !baseProfile) return { sourceText, result: undefined, program: undefined, profile: undefined };
  const producerProfile = { ...baseProfile, source: catalog.sourceIdentity };
  const result = projectX4UiLayoutProgram(model, target, producerProfile, undefined, undefined, p3ColorAuthority);
  if (!('program' in result) || !result.program) return { sourceText, result, program: undefined, profile: undefined };
  const profile: X4UiSceneProfile = Object.freeze({
    id: 'scene-colors-profile',
    provenance: 'B119 P4 Scene color selftest',
    source: result.program.profile.source,
    helper: { sourcePath: HELPER_PATH, sha256: X4_LAYOUT_PROVENANCE.helperSha256 },
    widget: { sourcePath: WIDGET_PATH, sha256: X4_LAYOUT_PROVENANCE.widgetSha256 },
    fonts: sceneProfile.fonts,
    drawable: { width: result.program.profile.frame.width, height: result.program.profile.frame.height },
    textPolicy: sceneProfile.textPolicy,
  });
  return { sourceText, result, program: result.program, profile };
})();

const boundedCompositionProjection = (() => {
  const sourceText = [
    'local menu = { name = "SceneBoundedComposition", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local active = frame:addTable(1, { x = 8, y = 4, width = 24, reserveScrollBar = false, scaling = false, backgroundID = "solid", backgroundColor = Color["table_background_default"] })',
    'active:setColWidthMin(1, 1, 1, false)',
    'local activeRow = active:addRow(false, { paddingTop = 0, paddingBottom = 0, borderBelow = false, fixed = false, scaling = false })',
    'activeRow[1]:createText("bounded", { height = 8, minRowHeight = 8 })',
    'local empty = frame:addTable(1, { x = 50, y = 4, width = 18, reserveScrollBar = false, scaling = false })',
    'empty:setColWidthMin(1, 1, 1, false)',
    'local emptyRow = empty:addRow(false, { paddingTop = 0, paddingBottom = 0, borderBelow = false, fixed = false, scaling = false })',
    'emptyRow[1]:createText("default", { height = 8, minRowHeight = 8 })',
    'frame:display()',
  ].join('\n');
  const model = buildX4UiCallModel({ rel: 'selftest/scene-bounded-composition.lua', text: sourceText, sourcePath: 'selftest/scene-bounded-composition.lua' });
  const catalog = createX4UiLayoutTargetCatalog(model);
  const target = catalog.targets.find(candidate => candidate.kind === 'top-level');
  const baseProfile = rawProducerProjection.program?.profile;
  if (!target || !baseProfile) return { sourceText, result: undefined, program: undefined, profile: undefined };
  const producerProfile = { ...baseProfile, source: catalog.sourceIdentity };
  const result = projectX4UiLayoutProgram(model, target, producerProfile, undefined, undefined, p3ColorAuthority);
  if (!('program' in result) || !result.program) return { sourceText, result, program: undefined, profile: undefined };
  const profile: X4UiSceneProfile = Object.freeze({
    id: 'scene-bounded-composition-profile',
    provenance: 'B119 bounded source-composition causal selftest',
    source: result.program.profile.source,
    helper: { sourcePath: HELPER_PATH, sha256: X4_LAYOUT_PROVENANCE.helperSha256 },
    widget: { sourcePath: WIDGET_PATH, sha256: X4_LAYOUT_PROVENANCE.widgetSha256 },
    fonts: sceneProfile.fonts,
    drawable: { width: result.program.profile.frame.width, height: result.program.profile.frame.height },
    textPolicy: sceneProfile.textPolicy,
  });
  return { sourceText, result, program: result.program, profile };
})();

const realGeometryProjection = rawProjectionFor([
  'local menu = { name = "SceneGeometry", layer = 1 }',
  'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
  'local table = frame:addTable(4, { width = 0, reserveScrollBar = true, maxVisibleHeight = 20, scaling = false })',
  'table:setColWidth(1, 20, false)',
  'table:setColWidth(2, 20, false)',
  'table:setColWidth(3, 20, false)',
  'table:setColWidth(4, 20, false)',
  'local first = table:addRow(false, { paddingTop = 2, paddingBottom = 1, borderBelow = true, fixed = false, scaling = false })',
  'first[1]:createText("AB", { height = 12, minRowHeight = 10, x = 1, y = 0 })',
  'first[2]:createButton({ height = 0, affectRowHeight = false, x = 1, y = 0 }):setText("B", { x = 1, y = 0 }):setText2("A", { x = 1, y = 0, halign = "right", font = "Zekton Bold", fontsize = 16 })',
  'first[3]:createEditBox({ height = 0, text = "A", defaultText = "DEFAULT", description = "edit description", x = 0, y = 0 })',
  'first[4]:createIcon("A", { height = 8, affectRowHeight = false, x = 0, y = 0 }):setText("A", { x = 0, y = 0 }):setText2("B", { x = 0, y = 0, halign = "right", font = "Zekton Bold", fontsize = 16 })',
  'local second = table:addRow(false, { paddingTop = 1, paddingBottom = 1, borderBelow = false, fixed = true, scaling = false })',
  'second[1]:setColSpan(2)',
  'local third = table:addRow(false, { paddingTop = 1, paddingBottom = 1, borderBelow = false, fixed = false, scaling = false })',
  'third[1]:createText("overflow", { height = 30, minRowHeight = 10 })',
  'frame:display()',
].join('\n'), 'selftest/raw-scene-geometry.lua');

const operation = (
  id: string,
  kind: string,
  at: X4UiSceneSourceLocation,
  tableId: string,
  rowId: string,
  cellId: string,
): X4UiLayoutOperation => ({
  id,
  kind,
  source: at,
  sourceOrder: at.start.offset,
  modelOrder: at.start.offset,
  status: 'applied',
  metadata: { arguments: [], semantics: {} },
  ...(kind === 'createFrameHandle'
    ? { frameId: 'frame:fixture' }
    : kind === 'display'
      ? { frameId: 'frame:fixture' }
    : kind === 'addTable'
      ? { tableId }
      : kind === 'addRow'
        ? { tableId, rowId }
        : { tableId, rowId, cellId }),
  descriptorFacts: {},
} as unknown as X4UiLayoutOperation);

const cellFacts = (
  kind: 'text' | 'button' | 'editbox' | 'icon' | 'cell',
  at: X4UiSceneSourceLocation,
  overrides: Record<string, X4UiLayoutDescriptorFact> = {},
): Readonly<Record<string, X4UiLayoutDescriptorFact>> => ({
  contentKind: known(kind, 'string', at),
  span: known(1, 'number', at),
  outerX: known(0, 'number', at),
  outerY: known(0, 'number', at),
  outerWidth: known(20, 'number', at),
  outerHeight: known(12, 'number', at),
  text: known('', 'string', at),
  text2: known('', 'string', at),
  font: known('Zekton', 'string', at),
  fontsize: known(16, 'number', at),
  halign: known('left', 'string', at),
  wordwrap: known(false, 'boolean', at),
  icon: kind === 'icon' ? known('A', 'string', at) : unavailable('string', `${kind} has no icon identity`, at),
  active: kind === 'button' || kind === 'editbox' ? known(true, 'boolean', at) : unavailable('boolean', `${kind} has no active descriptor`, at),
  ...overrides,
});

interface Fixture {
  readonly program: X4UiLayoutProgram;
  readonly profile: X4UiSceneProfile;
  readonly assets: X4UiSceneFontAssetMap;
  readonly corpus: X4UiCorpusCanonicalSuccess;
  readonly cellIds: readonly string[];
}

const makeFixture = (): Fixture => {
  const frameId = 'frame:fixture';
  const tableId = 'table:fixture';
  const row1Id = 'row:one';
  const row2Id = 'row:two';
  const cellIds = ['cell:text', 'cell:button', 'cell:editbox', 'cell:icon', 'cell:hidden', 'cell:hidden-tail', 'cell:hidden-slot', 'cell:fixed-last'];
  let state = unwrap(createHelperTable({
    numColumns: 4,
    frameWidth: 100,
    metrics,
    width: 0,
    x: 0,
    scaling: false,
    reserveScrollBar: true,
    createdWithScrollBar: true,
    rowGroups: [{ level: 2 }],
  }));
  const initialState = state;
  state = unwrap(setColWidth(state, 1, 20, false));
  state = unwrap(setColWidth(state, 2, 20, false));
  state = unwrap(setColWidth(state, 3, 20, false));
  state = unwrap(setColWidth(state, 4, 20, false));
  const beforeRow1 = state;
  const afterRow1 = unwrap(addRow(state, { paddingTop: 2, paddingBottom: 1, borderBelow: true, fixed: false, scaling: false }));
  const afterText = unwrap(specializeCell(afterRow1, 1, 1, { type: 'text', y: 0, height: 12, scaling: false, minTextHeight: 10 }));
  const afterButton = unwrap(specializeCell(afterText, 1, 2, { type: 'button', y: 0, height: 0, scaling: false }));
  const afterEdit = unwrap(specializeCell(afterButton, 1, 3, { type: 'editbox', y: 0, height: 0, scaling: false }));
  const afterIcon = unwrap(specializeCell(afterEdit, 1, 4, { type: 'icon', y: 0, height: 8, scaling: false }));
  const afterRow2 = unwrap(addRow(afterIcon, { paddingTop: 1, paddingBottom: 1, borderBelow: false, fixed: true, groupIndex: 1, scaling: false }));
  const afterSpan = unwrap(setCellColSpan(afterRow2, 2, 1, 2));
  const afterHiddenSlot = afterSpan;
  state = afterHiddenSlot;
  const fullHeightResult = getFullTableHeight(state);
  const fullHeight = fullHeightResult.status === 'ok' ? fullHeightResult.value : 0;
  const frameSource = source(10);
  const tableSource = source(30);
  const row1Source = source(50);
  const row2Source = source(70);
  const frame: X4UiLayoutFrameNode = {
    id: frameId,
    source: frameSource,
    tableIds: [tableId],
    operationIds: ['op:frame', 'op:hidden-tail', 'op:hidden-slot', 'op:fixed-last'],
    descriptorFacts: {
      x: known(0, 'number', frameSource),
      y: known(0, 'number', frameSource),
      width: known(100, 'number', frameSource),
      height: known(60, 'number', frameSource),
      layer: known(4, 'number', frameSource),
    },
    status: 'projected',
  };
  const table: X4UiLayoutTableNode = {
    id: tableId,
    source: tableSource,
    frameId,
    frameWidth: 100,
    numColumns: 4,
    requestedWidth: 0,
    rowIds: [row1Id, row2Id],
    operationIds: ['op:table', 'op:width:1', 'op:width:2', 'op:width:3', 'op:width:4', 'op:row1', 'op:row2', 'op:text', 'op:button', 'op:button-text', 'op:edit', 'op:icon', 'op:hidden'],
    kernelState: state,
    height: { status: 'known', value: fullHeight },
    descriptorFacts: {
      x: known(0, 'number', tableSource),
      y: known(0, 'number', tableSource),
      requestedWidth: known(0, 'number', tableSource),
      finalWidth: known(state.properties.width, 'number', tableSource),
      maxVisibleHeight: known(20, 'number', tableSource),
      reserveScrollBar: known(false, 'boolean', tableSource),
    },
    status: 'projected',
  };
  const row1 = {
    id: row1Id,
    source: row1Source,
    tableId,
    rowIndex: 1,
    cellIds: cellIds.slice(0, 4),
    operationIds: ['op:row1', 'op:text', 'op:button', 'op:button-text', 'op:edit', 'op:icon'],
    kernelState: state.rows[0],
    height: { status: 'known' as const, value: getRowHeightForTest(state, 1) },
    descriptorFacts: {
      paddingTop: known(2, 'number', row1Source),
      paddingBottom: known(1, 'number', row1Source),
      borderBelow: known(true, 'boolean', row1Source),
      fixed: known(false, 'boolean', row1Source),
    },
    status: 'projected' as const,
  };
  const row2 = {
    id: row2Id,
    source: row2Source,
    tableId,
    rowIndex: 2,
    cellIds: cellIds.slice(4),
    operationIds: ['op:row2', 'op:hidden'],
    kernelState: state.rows[1],
    height: { status: 'known' as const, value: getRowHeightForTest(state, 2) },
    descriptorFacts: {
      paddingTop: known(1, 'number', row2Source),
      paddingBottom: known(1, 'number', row2Source),
      borderBelow: known(false, 'boolean', row2Source),
      fixed: known(true, 'boolean', row2Source),
    },
    status: 'projected' as const,
  };
  const textSource = source(100);
  const buttonSource = source(120);
  const editSource = source(140);
  const iconSource = source(160);
  const hiddenSource = source(180);
  const hiddenTailSource = source(200);
  const hiddenSlotSource = source(210);
  const fixedLastSource = source(220);
  const cells: X4UiLayoutCellNode[] = [
    {
      id: cellIds[0], source: textSource, tableId, rowId: row1Id, rowIndex: 1, column: 1,
      operationIds: ['op:text'], metadataOperationIds: [], kernelState: state.rows[0].cells[0],
      spanWidth: { status: 'known', value: state.columns[0].width }, height: { status: 'known', value: 12 },
      descriptorFacts: cellFacts('text', textSource, {
        outerX: known(1, 'number', textSource), outerWidth: known(19, 'number', textSource), outerHeight: known(12, 'number', textSource),
        text: known('AB', 'string', textSource), primaryContent: known('AB', 'string', textSource),
        textX: known(1, 'number', textSource), textY: known(0, 'number', textSource),
      }), status: 'projected',
    },
    {
      id: cellIds[1], source: buttonSource, tableId, rowId: row1Id, rowIndex: 1, column: 2,
      operationIds: ['op:button'], metadataOperationIds: ['op:button-text'], kernelState: state.rows[0].cells[1],
      spanWidth: { status: 'known', value: state.columns[1].width }, height: { status: 'known', value: 0 },
      descriptorFacts: cellFacts('button', buttonSource, {
        outerWidth: known(20, 'number', buttonSource), outerHeight: known(0, 'number', buttonSource),
        text: known('B', 'string', buttonSource), text2: known('A', 'string', buttonSource), primaryContent: known('B', 'string', buttonSource),
        textX: known(1, 'number', buttonSource), textY: known(0, 'number', buttonSource), textFont: known('Zekton', 'string', buttonSource), textFontsize: known(16, 'number', buttonSource), textHalign: known('center', 'string', buttonSource),
        text2X: known(1, 'number', buttonSource), text2Y: known(0, 'number', buttonSource), text2Font: known('Zekton Bold', 'string', buttonSource), text2Fontsize: known(16, 'number', buttonSource), text2Halign: known('right', 'string', buttonSource),
      }), status: 'projected',
    },
    {
      id: cellIds[2], source: editSource, tableId, rowId: row1Id, rowIndex: 1, column: 3,
      operationIds: ['op:edit'], metadataOperationIds: [], kernelState: state.rows[0].cells[2],
      spanWidth: { status: 'known', value: state.columns[2].width }, height: { status: 'known', value: 0 },
      descriptorFacts: cellFacts('editbox', editSource, { outerWidth: known(0, 'number', editSource), outerHeight: known(0, 'number', editSource), text: known('A', 'string', editSource), defaultText: known('DEFAULT', 'string', editSource), description: known('edit description', 'string', editSource), primaryContent: known('A', 'string', editSource), textX: known(0, 'number', editSource), textY: known(0, 'number', editSource) }), status: 'projected',
    },
    {
      id: cellIds[3], source: iconSource, tableId, rowId: row1Id, rowIndex: 1, column: 4,
      operationIds: ['op:icon'], metadataOperationIds: [], kernelState: state.rows[0].cells[3],
      spanWidth: { status: 'known', value: state.columns[3].width }, height: { status: 'known', value: 8 },
      descriptorFacts: cellFacts('icon', iconSource, { outerWidth: known(20, 'number', iconSource), outerHeight: known(8, 'number', iconSource), text: known('A', 'string', iconSource), text2: known('B', 'string', iconSource), primaryContent: known('A', 'string', iconSource), icon: known('A', 'string', iconSource), textX: known(0, 'number', iconSource), textY: known(0, 'number', iconSource), text2X: known(0, 'number', iconSource), text2Y: known(0, 'number', iconSource), text2Font: known('Zekton Bold', 'string', iconSource) }), status: 'projected',
    },
    {
      id: cellIds[4], source: hiddenSource, tableId, rowId: row2Id, rowIndex: 2, column: 1,
      operationIds: ['op:hidden'], metadataOperationIds: [], kernelState: state.rows[1].cells[0],
      spanWidth: { status: 'known', value: state.columns[0].width + state.columns[1].width + metrics.borderSize }, height: { status: 'known', value: 1 },
      descriptorFacts: cellFacts('cell', hiddenSource, { span: known(2, 'number', hiddenSource), outerWidth: unavailable('number', 'hidden cell has no drawable outer width', hiddenSource), outerHeight: unavailable('number', 'hidden cell has no drawable outer height', hiddenSource) }), status: 'projected',
    },
    {
      id: cellIds[5], source: hiddenTailSource, tableId, rowId: row2Id, rowIndex: 2, column: 2,
      operationIds: [], metadataOperationIds: [], kernelState: state.rows[1].cells[1],
      spanWidth: { status: 'known', value: 0 }, height: { status: 'known', value: 0 },
      descriptorFacts: cellFacts('cell', hiddenTailSource, { span: known(0, 'number', hiddenTailSource), outerWidth: unavailable('number', 'colspan=0 cell is hidden', hiddenTailSource), outerHeight: unavailable('number', 'colspan=0 cell is hidden', hiddenTailSource) }), status: 'projected',
    },
    {
      id: cellIds[6], source: hiddenSlotSource, tableId, rowId: row2Id, rowIndex: 2, column: 3,
      operationIds: [], metadataOperationIds: [], kernelState: state.rows[1].cells[2],
      spanWidth: { status: 'known', value: state.columns[2].width }, height: { status: 'known', value: 1 },
      descriptorFacts: cellFacts('cell', hiddenSlotSource, { span: known(1, 'number', hiddenSlotSource), outerWidth: unavailable('number', 'placeholder cell has no drawable outer width', hiddenSlotSource), outerHeight: unavailable('number', 'placeholder cell has no drawable outer height', hiddenSlotSource) }), status: 'projected',
    },
    {
      id: cellIds[7], source: fixedLastSource, tableId, rowId: row2Id, rowIndex: 2, column: 4,
      operationIds: [], metadataOperationIds: [], kernelState: state.rows[1].cells[3],
      spanWidth: { status: 'known', value: state.columns[3].width }, height: { status: 'known', value: 1 },
      descriptorFacts: cellFacts('cell', fixedLastSource, { outerHeight: known(1, 'number', fixedLastSource) }), status: 'projected',
    },
  ];
  const operations: X4UiLayoutOperation[] = [
    operation('op:frame', 'createFrameHandle', frameSource, tableId, row1Id, cellIds[0]),
    operation('op:table', 'addTable', tableSource, tableId, row1Id, cellIds[0]),
    operation('op:row1', 'addRow', row1Source, tableId, row1Id, cellIds[0]),
    operation('op:row2', 'addRow', row2Source, tableId, row2Id, cellIds[4]),
    operation('op:text', 'createText', textSource, tableId, row1Id, cellIds[0]),
    operation('op:button', 'createButton', buttonSource, tableId, row1Id, cellIds[1]),
    operation('op:button-text', 'setText', source(125), tableId, row1Id, cellIds[1]),
    operation('op:edit', 'createEditBox', editSource, tableId, row1Id, cellIds[2]),
    operation('op:icon', 'createIcon', iconSource, tableId, row1Id, cellIds[3]),
    operation('op:hidden', 'setColSpan', hiddenSource, tableId, row2Id, cellIds[4]),
    operation('op:hidden-tail', 'display', hiddenTailSource, tableId, row2Id, cellIds[5]),
    operation('op:hidden-slot', 'display', hiddenSlotSource, tableId, row2Id, cellIds[6]),
    operation('op:fixed-last', 'display', fixedLastSource, tableId, row2Id, cellIds[7]),
  ];
  let widthState = initialState;
  for (let column = 1; column <= 4; column += 1) {
    const next = unwrap(setColWidth(widthState, column, 20, false));
    const widthOperation = operation(`op:width:${column}`, 'setColWidth', source(32 + (column - 1) * 4), tableId, '', '');
    delete (widthOperation as unknown as { rowId?: string }).rowId;
    delete (widthOperation as unknown as { cellId?: string }).cellId;
    (widthOperation as unknown as { kernel: unknown }).kernel = { stateBefore: widthState, stateAfter: next };
    operations.push(widthOperation);
    widthState = next;
  }
  const tableOperation = operations.find(operationNode => operationNode.id === 'op:table')!;
  const rowOneOperation = operations.find(operationNode => operationNode.id === 'op:row1')!;
  const textOperation = operations.find(operationNode => operationNode.id === 'op:text')!;
  const buttonOperation = operations.find(operationNode => operationNode.id === 'op:button')!;
  const editOperation = operations.find(operationNode => operationNode.id === 'op:edit')!;
  const iconOperation = operations.find(operationNode => operationNode.id === 'op:icon')!;
  const rowTwoOperation = operations.find(operationNode => operationNode.id === 'op:row2')!;
  const hiddenOperation = operations.find(operationNode => operationNode.id === 'op:hidden')!;
  for (const [operationId, cellId] of [['op:text', cellIds[0]], ['op:button', cellIds[1]], ['op:edit', cellIds[2]], ['op:icon', cellIds[3]] as const]) {
    const creator = operations.find(operationNode => operationNode.id === operationId)!;
    const cell = cells.find(cellNode => cellNode.id === cellId)!;
    const creatorFacts: Record<string, X4UiLayoutDescriptorFact> = {};
    for (const factName of ['outerY', 'outerHeight', 'scaling', 'affectRowHeight', 'minTextHeight']) {
      const fact = cell.descriptorFacts[factName];
      if (fact !== undefined) creatorFacts[factName] = fact;
    }
    const kernelCell = cell.kernelState;
    if (creatorFacts.scaling === undefined) creatorFacts.scaling = known(kernelCell.scaling, 'boolean', cell.source);
    if (creatorFacts.affectRowHeight === undefined) creatorFacts.affectRowHeight = known(kernelCell.affectRowHeight, 'boolean', cell.source);
    if (creatorFacts.minTextHeight === undefined && kernelCell.minTextHeight !== undefined) {
      creatorFacts.minTextHeight = known(kernelCell.minTextHeight, 'number', cell.source);
    }
    if (operationId === 'op:text' && creatorFacts.minTextHeight === undefined) {
      creatorFacts.minTextHeight = known(10, 'number', cell.source);
    }
    (creator as unknown as { descriptorFacts: Record<string, X4UiLayoutDescriptorFact> }).descriptorFacts = creatorFacts;
  }
  const rowTwoOperationSource = source(170);
  (rowTwoOperation as unknown as { source: X4UiSceneSourceLocation; sourceOrder: number; modelOrder: number }).source = rowTwoOperationSource;
  (rowTwoOperation as unknown as { sourceOrder: number; modelOrder: number }).sourceOrder = rowTwoOperationSource.start.offset;
  (rowTwoOperation as unknown as { modelOrder: number }).modelOrder = rowTwoOperationSource.start.offset;
  (hiddenOperation.descriptorFacts as Record<string, X4UiLayoutDescriptorFact>).span = known(2, 'number', hiddenSource);
  (tableOperation as unknown as { kernel: unknown }).kernel = { stateAfter: initialState };
  (rowOneOperation as unknown as { kernel: unknown }).kernel = { stateBefore: beforeRow1, stateAfter: afterRow1 };
  (textOperation as unknown as { kernel: unknown }).kernel = { stateBefore: afterRow1, stateAfter: afterText };
  (buttonOperation as unknown as { kernel: unknown }).kernel = { stateBefore: afterText, stateAfter: afterButton };
  (editOperation as unknown as { kernel: unknown }).kernel = { stateBefore: afterButton, stateAfter: afterEdit };
  (iconOperation as unknown as { kernel: unknown }).kernel = { stateBefore: afterEdit, stateAfter: afterIcon };
  (rowTwoOperation as unknown as { kernel: unknown }).kernel = { stateBefore: afterIcon, stateAfter: afterRow2 };
  (hiddenOperation as unknown as { kernel: unknown }).kernel = { stateBefore: afterRow2, stateAfter: afterSpan };
  const program = {
    status: 'projected' as const,
    target: { id: 'target:fixture', kind: 'function' as const, source: source(0), name: 'fixture', sourceIdentity },
    profile: programProfile,
    analysis: { parsed: true, callModelGaps: 0, callModelGapsTruncated: false, incomplete: false, profile: 'complete' as const, staticSource: 'complete' as const, gameVerification: X4_UI_LAYOUT_GAME_TRUTH },
    frames: [frame],
    tables: [table],
    rows: [row1, row2],
    cells,
    operations,
    gaps: [],
    sampleCatalog: { id: 'samples:fixture', sourceIdentity, targetId: 'target:fixture', entries: [] },
    previewSampleBindings: [],
    verification: { game: X4_UI_LAYOUT_GAME_TRUTH, gameVerified: false as const },
  } as unknown as X4UiLayoutProgram;
  return { program, profile: sceneProfile, assets, corpus, cellIds };
};

const getRowHeightForTest = (state: HelperTableState, row: number): number => {
  const cells = state.rows[row - 1].cells;
  let height = 0;
  for (const cell of cells) {
    height = Math.max(height, cell.height === 0 ? (cell.type === 'text' ? cell.minTextHeight || 0 : cell.type === 'cell' ? 1 : 0) : cell.height);
  }
  return height;
};

const assertSceneGraph = (scene: X4UiScene): void => {
  const nodes = [...scene.frames, ...scene.tables, ...scene.rows, ...scene.cells, ...scene.widgets, ...scene.texts, ...scene.glyphs];
  const ids = nodes.map(node => node.id);
  assert(new Set(ids).size === ids.length, 'every successful scene fixture must have globally unique node IDs');
  const byId = new Map(nodes.map(node => [node.id, node]));
  const assertChildren = (parentId: string, childIds: readonly string[], label: string): void => {
    for (const childId of childIds) {
      const child = byId.get(childId);
      assert(child !== undefined && child.parentId === parentId, `${label} ${childId} must have parent ${parentId}`);
    }
  };
  for (const node of nodes) {
    if (node.parentId !== undefined) assert(byId.has(node.parentId) && node.parentId !== node.id, `${node.id} must have a distinct existing parent`);
    if (node.clipRect) {
      const clip = node.clipRect;
      assert(Number.isFinite(clip.x) && Number.isFinite(clip.y) && Number.isFinite(clip.width) && Number.isFinite(clip.height) && clip.width >= 0 && clip.height >= 0, `${node.id} clip must be finite and nonnegative`);
      assert(clip.x >= scene.drawableRect.x && clip.y >= scene.drawableRect.y && clip.x + clip.width <= scene.drawableRect.x + scene.drawableRect.width && clip.y + clip.height <= scene.drawableRect.y + scene.drawableRect.height, `${node.id} clip must remain inside the drawable`);
      const parent = node.parentId === undefined ? undefined : byId.get(node.parentId);
      const iconTextUsesCellClip = node.kind === 'text'
        ? parent?.kind === 'icon'
        : node.kind === 'glyph' && parent?.kind === 'text' && 'widgetId' in parent && byId.get(parent.widgetId)?.kind === 'icon';
      if (parent?.clipRect && !iconTextUsesCellClip) assert(clip.x >= parent.clipRect.x && clip.y >= parent.clipRect.y && clip.x + clip.width <= parent.clipRect.x + parent.clipRect.width && clip.y + clip.height <= parent.clipRect.y + parent.clipRect.height, `${node.id} clip must remain inside its parent clip`);
    }
  }
  for (const frame of scene.frames) assertChildren(frame.id, frame.tableIds, frame.id);
  for (const table of scene.tables) assertChildren(table.id, table.rowIds, table.id);
  for (const row of scene.rows) assertChildren(row.id, row.cellIds, row.id);
  for (const cell of scene.cells) assertChildren(cell.id, cell.widgetIds, cell.id);
  for (const widget of scene.widgets) assertChildren(widget.id, widget.textIds, widget.id);
  for (const text of scene.texts) {
    for (const line of text.lines) assertChildren(text.id, line.glyphIds, text.id);
  }
  for (const table of scene.tables) {
    const scrollbar = table.scrollbar;
    if (!scrollbar) continue;
    const bounds = {
      x: scrollbar.rect.x,
      y: table.rect?.y ?? scrollbar.rect.y,
      width: scrollbar.rect.width,
      height: table.rect?.height ?? scrollbar.rect.height,
    };
    const clip = scrollbar.clipRect;
    assert(Number.isFinite(clip.x) && Number.isFinite(clip.y) && Number.isFinite(clip.width) && Number.isFinite(clip.height) && clip.width >= 0 && clip.height >= 0, `${table.id} scrollbar clip must be finite and nonnegative`);
    assert(clip.x >= scene.drawableRect.x && clip.y >= scene.drawableRect.y && clip.x + clip.width <= scene.drawableRect.x + scene.drawableRect.width && clip.y + clip.height <= scene.drawableRect.y + scene.drawableRect.height, `${table.id} scrollbar clip must remain inside the drawable`);
    if (clip.width > 0 && clip.height > 0) assert(clip.x >= bounds.x && clip.y >= bounds.y && clip.x + clip.width <= bounds.x + bounds.width && clip.y + clip.height <= bounds.y + bounds.height, `${table.id} scrollbar clip must remain inside its source rectangle`);
  }
};

const sceneOf = (result: X4UiSceneResult): X4UiScene => {
  assert(result.status !== 'refused', result.status === 'refused' ? `${result.refusal.code}: ${result.refusal.message}` : 'unexpected refusal');
  assertSceneGraph(result.scene);
  return result.scene;
};

const isDeepFrozen = (value: unknown, seen = new Set<object>()): boolean => {
  if (value === null || typeof value !== 'object' || value instanceof Uint8Array) return true;
  if (seen.has(value)) return true;
  seen.add(value);
  return Object.isFrozen(value) && Object.keys(value).every(key => isDeepFrozen((value as Record<string, unknown>)[key], seen));
};

const cloneProgram = (program: X4UiLayoutProgram): X4UiLayoutProgram => JSON.parse(JSON.stringify(program)) as X4UiLayoutProgram;

const cloneKernelState = (state: HelperTableState): HelperTableState => JSON.parse(JSON.stringify(state)) as HelperTableState;

const jsonEqual = (left: unknown, right: unknown): boolean => JSON.stringify(left) === JSON.stringify(right);
const cloneJsonValue = <T>(value: T): T => value === undefined ? value : JSON.parse(JSON.stringify(value)) as T;

const sceneLineSourceCodePointRangesMatchLayout = (scene: X4UiScene): boolean => {
  let lineCount = 0;
  for (const text of scene.texts) {
    for (const line of text.lines) {
      lineCount += 1;
      const layoutLine = text.layout?.lines.find(candidate => candidate.lineIndex === line.lineIndex);
      const lineRecord = line as unknown as Record<string, unknown>;
      const range = lineRecord.sourceCodePointRange;
      if (layoutLine === undefined || range === null || typeof range !== 'object' || Array.isArray(range)) return false;
      const rangeRecord = range as Record<string, unknown>;
      if (Object.keys(rangeRecord).sort().join(',') !== 'end,start') return false;
      if (!Number.isSafeInteger(rangeRecord.start) || !Number.isSafeInteger(rangeRecord.end) || (rangeRecord.start as number) < 0 || (rangeRecord.end as number) < (rangeRecord.start as number)) return false;
      if (rangeRecord.start !== layoutLine.sourceCodePointRange.start || rangeRecord.end !== layoutLine.sourceCodePointRange.end) return false;
    }
  }
  return lineCount > 0;
};

const applyFixtureKernelDelta = (
  state: HelperTableState,
  baseline: HelperTableState,
  target: HelperTableState,
): HelperTableState => {
  const result = cloneKernelState(state);
  for (const key of ['properties', 'columns', 'rowGroups'] as const) {
    if (!jsonEqual(baseline[key], target[key])) {
      (result as unknown as Record<string, unknown>)[key] = cloneJsonValue(target[key]);
    }
  }
  for (let rowIndex = 0; rowIndex < Math.min(baseline.rows.length, target.rows.length, result.rows.length); rowIndex += 1) {
    const baselineRow = baseline.rows[rowIndex];
    const targetRow = target.rows[rowIndex];
    const resultRow = result.rows[rowIndex] as unknown as Record<string, unknown>;
    for (const key of new Set([
      ...Object.keys(baselineRow as unknown as Record<string, unknown>),
      ...Object.keys(targetRow as unknown as Record<string, unknown>),
      ...Object.keys(resultRow),
    ])) {
      if (key === 'cells') continue;
      const baselineValue = (baselineRow as unknown as Record<string, unknown>)[key];
      const targetValue = (targetRow as unknown as Record<string, unknown>)[key];
      if (!jsonEqual(baselineValue, targetValue)) {
        if (targetValue === undefined) delete resultRow[key];
        else resultRow[key] = cloneJsonValue(targetValue);
      }
    }
  }
  return result;
};

const syncFixtureCreatorFacts = (
  operationNode: X4UiLayoutOperation,
  targetCell: HelperTableState['rows'][number]['cells'][number],
  cell: X4UiLayoutCellNode,
): void => {
  const facts = operationNode.descriptorFacts as Record<string, X4UiLayoutDescriptorFact>;
  const sourceFact = (name: string): X4UiLayoutDescriptorFact | undefined => cell.descriptorFacts[name];
  const setKnownIfPresent = (name: string, value: number | boolean, expectedType: 'number' | 'boolean'): void => {
    const fact = sourceFact(name);
    if (fact?.status === 'unavailable') return;
    facts[name] = known(value, expectedType, fact?.source ?? operationNode.source);
  };
  setKnownIfPresent('outerY', targetCell.y, 'number');
  setKnownIfPresent('outerHeight', targetCell.height, 'number');
  setKnownIfPresent('scaling', targetCell.scaling, 'boolean');
  setKnownIfPresent('affectRowHeight', targetCell.affectRowHeight, 'boolean');
  if (targetCell.minTextHeight !== undefined && sourceFact('minTextHeight')?.status !== 'unavailable') {
    facts.minTextHeight = known(targetCell.minTextHeight, 'number', operationNode.source);
  }
};

const applyFixtureRowInitialCellFacts = (
  program: X4UiLayoutProgram,
  state: HelperTableState,
  target: HelperTableState,
  rowIndex: number,
): void => {
  const targetRow = target.rows[rowIndex - 1];
  const resultRow = state.rows[rowIndex - 1];
  if (!targetRow || !resultRow) return;
  for (let column = 1; column <= Math.min(targetRow.cells.length, resultRow.cells.length); column += 1) {
    const targetCell = targetRow.cells[column - 1] as unknown as Record<string, unknown>;
    const resultCell = resultRow.cells[column - 1] as unknown as Record<string, unknown>;
    const cell = program.cells.find(candidate => candidate.tableId === program.tables[0]?.id && candidate.rowIndex === rowIndex && candidate.column === column);
    const creator = cell === undefined ? undefined : program.operations.find(operationNode => operationNode.cellId === cell.id && ['createText', 'createEditBox', 'createButton', 'createIcon'].includes(operationNode.kind));
    const span = cell === undefined ? undefined : program.operations.find(operationNode => operationNode.cellId === cell.id && operationNode.kind === 'setColSpan');
    const controlled = new Set(creator === undefined ? [] : ['type', 'y', 'height', 'scaling', 'affectRowHeight', 'minTextHeight']);
    if (span !== undefined) controlled.add('colspan');
    for (const [key, value] of Object.entries(targetCell)) {
      if (controlled.has(key)) continue;
      if (value === undefined) delete resultCell[key];
      else resultCell[key] = cloneJsonValue(value);
    }
  }
};

const syncFixtureKernelChain = (program: X4UiLayoutProgram, baselineProgram: X4UiLayoutProgram): void => {
  const table = program.tables[0];
  const baseline = baselineProgram.tables[0]?.kernelState;
  const target = table?.kernelState;
  if (!table || !baseline || !target) return;
  const producers = program.operations
    .filter(operationNode => ['addTable', 'setColWidth', 'setColWidthPercent', 'addRow', 'setColSpan', 'createText', 'createEditBox', 'createButton', 'createIcon'].includes(operationNode.kind) && (operationNode.tableId === undefined || operationNode.tableId === table.id))
    .sort((left, right) => left.modelOrder - right.modelOrder);
  const first = producers[0];
  if (!first?.kernel?.stateAfter) return;
  const initial = cloneKernelState(first.kernel.stateAfter);
  (initial as unknown as { rows: unknown[] }).rows = [];
  (first as unknown as { kernel: { stateAfter: HelperTableState } }).kernel.stateAfter = initial;
  let previous = initial;
  for (let index = 1; index < producers.length; index += 1) {
    const operationNode = producers[index];
    const transition = operationNode.kernel;
    if (!transition) continue;
    (transition as unknown as { stateBefore: HelperTableState }).stateBefore = previous;
    let next: HelperTableState;
    const baselineOperation = baselineProgram.operations.find(candidate => candidate.id === operationNode.id);
    const baselineAfter = baselineOperation?.kernel?.stateAfter;
    const templateAfter = (baselineAfter ?? transition.stateAfter) === undefined ? undefined : cloneKernelState((baselineAfter ?? transition.stateAfter)!);
    if (operationNode.kind === 'addRow') {
      const finalized = previous.rows.length === 0 ? finalizeHelperTable(previous) : { status: 'ok' as const, value: previous };
      if (finalized.status !== 'ok') return;
      next = templateAfter === undefined ? cloneKernelState(finalized.value) : templateAfter;
      const targetRow = target.rows[next.rows.length];
      if (previous.rows.length === 0) {
        next = cloneKernelState(finalized.value);
        const firstRow = templateAfter?.rows[0] ?? targetRow;
        if (!firstRow) return;
        (next.rows as unknown as unknown[]).push(cloneJsonValue(firstRow));
        applyFixtureRowInitialCellFacts(program, next, target, 1);
      } else {
        next = cloneKernelState(previous);
        const nextRow = templateAfter?.rows[previous.rows.length] ?? targetRow;
        if (!nextRow) return;
        (next.rows as unknown as unknown[]).push(cloneJsonValue(nextRow));
        applyFixtureRowInitialCellFacts(program, next, target, next.rows.length);
      }
    } else if (operationNode.kind === 'setColSpan') {
      const row = program.rows.find(candidate => candidate.id === operationNode.rowId);
      const cell = program.cells.find(candidate => candidate.id === operationNode.cellId);
      const span = operationNode.descriptorFacts.span;
      if (!row || !cell || row.rowIndex === undefined || span?.status !== 'known' || span.expectedType !== 'number') return;
      const replayed = setCellColSpan(previous, row.rowIndex, cell.column, span.value as number);
      if (replayed.status !== 'ok') return;
      next = replayed.value;
    } else if (['createText', 'createEditBox', 'createButton', 'createIcon'].includes(operationNode.kind)) {
      const row = program.rows.find(candidate => candidate.id === operationNode.rowId);
      const cell = program.cells.find(candidate => candidate.id === operationNode.cellId);
      const targetCell = row?.rowIndex === undefined || cell === undefined
        ? undefined
        : target.rows[row.rowIndex - 1]?.cells[cell.column - 1];
      const specializationType = targetCell?.type === 'text' || targetCell?.type === 'editbox' || targetCell?.type === 'button' || targetCell?.type === 'icon'
        ? targetCell.type
        : undefined;
      if (!row || row.rowIndex === undefined || !cell || !targetCell || specializationType === undefined) return;
      syncFixtureCreatorFacts(operationNode, targetCell, cell);
      const replayed = specializeCell(previous, row.rowIndex, cell.column, {
        type: specializationType,
        y: targetCell.y,
        height: targetCell.height,
        scaling: targetCell.scaling,
        affectRowHeight: targetCell.affectRowHeight,
        minTextHeight: targetCell.minTextHeight,
      });
      if (replayed.status !== 'ok') return;
      next = replayed.value;
    } else {
      next = templateAfter === undefined ? cloneKernelState(previous) : templateAfter;
    }
    next = applyFixtureKernelDelta(next, baseline, target);
    if (operationNode.kind === 'addRow' && templateAfter === undefined) {
      const targetRow = target.rows[next.rows.length - 1];
      if (targetRow) (next.rows as unknown as unknown[])[next.rows.length - 1] = cloneJsonValue(targetRow);
    }
    (transition as unknown as { stateAfter: HelperTableState }).stateAfter = next;
    previous = next;
  }
  if (jsonEqual(previous, target)) {
    (table as unknown as { kernelState: HelperTableState }).kernelState = previous;
  }
};

const refreshProgramKernelProjection = (program: X4UiLayoutProgram, reconcileChain = false, baselineProgram = program): void => {
  for (const table of program.tables) {
    const state = table.kernelState;
    if (!state) continue;
    const fullHeight = getFullTableHeight(state);
    if (fullHeight.status === 'ok') (table as unknown as { height: { status: 'known'; value: number } }).height = { status: 'known', value: fullHeight.value };
    for (let rowIndex = 1; rowIndex <= state.rows.length; rowIndex += 1) {
      const row = program.rows.find(candidate => candidate.tableId === table.id && candidate.rowIndex === rowIndex);
      if (!row) continue;
      (row as unknown as { kernelState: HelperTableState['rows'][number]; height: { status: 'known'; value: number } }).kernelState = state.rows[rowIndex - 1];
      const rowHeight = getRowHeight(state, rowIndex);
      if (rowHeight.status === 'ok') (row as unknown as { height: { status: 'known'; value: number } }).height = { status: 'known', value: rowHeight.value };
    }
    for (const cell of program.cells.filter(candidate => candidate.tableId === table.id)) {
      if (cell.rowIndex === undefined) continue;
      const stateCell = state.rows[cell.rowIndex - 1]?.cells[cell.column - 1];
      if (!stateCell) continue;
      (cell as unknown as { kernelState: HelperTableState['rows'][number]['cells'][number] }).kernelState = stateCell;
      const spanWidth = getColSpanWidth(state, cell.rowIndex, cell.column);
      if (spanWidth.status === 'ok') (cell as unknown as { spanWidth: { status: 'known'; value: number } }).spanWidth = { status: 'known', value: spanWidth.value };
      const cellHeight = getCellHeight(state, cell.rowIndex, cell.column);
      if (cellHeight.status === 'ok') (cell as unknown as { height: { status: 'known'; value: number } }).height = { status: 'known', value: cellHeight.value };
    }
  }
  if (reconcileChain) syncFixtureKernelChain(program, baselineProgram);
};

const syncKernelCell = (
  program: X4UiLayoutProgram,
  cellId: string,
  patch: Partial<HelperTableState['rows'][number]['cells'][number]>,
  baselineProgram: X4UiLayoutProgram = program,
): void => {
  const cell = program.cells.find(candidate => candidate.id === cellId);
  if (!cell || cell.tableId === undefined || cell.rowIndex === undefined) throw new Error(`unknown fixture cell ${cellId}`);
  const table = program.tables.find(candidate => candidate.id === cell!.tableId);
  const stateCell = table?.kernelState?.rows[cell.rowIndex - 1]?.cells[cell.column - 1];
  if (!stateCell) throw new Error(`unknown kernel slot ${cellId}`);
  Object.assign(stateCell, patch);
  refreshProgramKernelProjection(program, true, baselineProgram);
};

const makeInsufficientReserveProgram = (fixture: Fixture, mode: 'insufficient' | 'no-variable' | 'sufficient' = 'insufficient'): X4UiLayoutProgram => {
  let before = unwrap(createHelperTable({
    numColumns: 4,
    frameWidth: 100,
    metrics,
    width: 0,
    x: 0,
    scaling: false,
    reserveScrollBar: true,
    createdWithScrollBar: true,
    rowGroups: [{ level: 2 }],
  }));
  before = mode === 'insufficient'
    ? unwrap(setColWidthMin(before, 1, 85, 1, false))
    : mode === 'sufficient'
      ? unwrap(setColWidthMin(before, 1, 20, 1, false))
      : unwrap(setColWidth(before, 1, 20, false));
  before = unwrap(setColWidth(before, 2, mode === 'insufficient' ? 4 : 20, false));
  before = unwrap(setColWidth(before, 3, mode === 'insufficient' ? 4 : 20, false));
  before = unwrap(setColWidth(before, 4, mode === 'insufficient' ? 4 : 20, false));
  const firstAfterAdd = unwrap(addRow(before, { paddingTop: 2, paddingBottom: 1, borderBelow: true, fixed: false, scaling: false }));
  const afterText = unwrap(specializeCell(firstAfterAdd, 1, 1, { type: 'text', y: 0, height: 12, scaling: false, minTextHeight: 10 }));
  const afterButton = unwrap(specializeCell(afterText, 1, 2, { type: 'button', y: 0, height: 0, scaling: false }));
  const afterEdit = unwrap(specializeCell(afterButton, 1, 3, { type: 'editbox', y: 0, height: 0, scaling: false }));
  const afterIcon = unwrap(specializeCell(afterEdit, 1, 4, { type: 'icon', y: 0, height: 8, scaling: false }));
  const afterSecondAdd = unwrap(addRow(afterIcon, { paddingTop: 1, paddingBottom: 1, borderBelow: false, fixed: true, groupIndex: 1, scaling: false }));
  const afterSpan = unwrap(setCellColSpan(afterSecondAdd, 2, 1, 2));
  const final = unwrap(addRow(afterSpan, { paddingTop: 1, paddingBottom: 1, borderBelow: false, fixed: false, scaling: false }));
  const program = cloneProgram(fixture.program);
  const table = program.tables[0] as unknown as { kernelState: HelperTableState; height: { status: 'known'; value: number }; descriptorFacts: Record<string, X4UiLayoutDescriptorFact> };
  table.kernelState = final;
  table.height = { status: 'known', value: unwrap(getFullTableHeight(final)) };
  table.descriptorFacts.reserveScrollBar = known(true, 'boolean', program.tables[0].source);
  table.descriptorFacts.finalWidth = known(final.properties.width, 'number', program.tables[0].source);
  const rowThreeId = 'row:reserve-three';
  const rowThreeSource = source(230);
  const rowThree: X4UiLayoutRowNode = {
    id: rowThreeId,
    source: rowThreeSource,
    tableId: program.tables[0].id,
    rowIndex: 3,
    cellIds: [],
    operationIds: ['op:row3'],
    kernelState: final.rows[2],
    height: { status: 'known', value: unwrap(getRowHeight(final, 3)) },
    descriptorFacts: {
      paddingTop: known(1, 'number', rowThreeSource),
      paddingBottom: known(1, 'number', rowThreeSource),
      borderBelow: known(false, 'boolean', rowThreeSource),
      fixed: known(false, 'boolean', rowThreeSource),
      scaling: known(false, 'boolean', rowThreeSource),
    },
    status: 'projected',
  };
  (program.rows as unknown as X4UiLayoutRowNode[]).push(rowThree);
  (program.tables[0].rowIds as unknown as string[]).push(rowThreeId);
  appendKernelSlotCells(program, final, rowThreeId, 3, 240);
  for (let rowIndex = 1; rowIndex <= final.rows.length; rowIndex += 1) {
    const row = program.rows.find(candidate => candidate.tableId === program.tables[0].id && candidate.rowIndex === rowIndex) as unknown as { kernelState: HelperTableState['rows'][number]; height: { status: 'known'; value: number } };
    row.kernelState = final.rows[rowIndex - 1];
    row.height = { status: 'known', value: unwrap(getRowHeight(final, rowIndex)) };
  }
  for (const cell of program.cells) {
    const rowIndex = cell.rowIndex!;
    const stateCell = final.rows[rowIndex - 1].cells[cell.column - 1];
    (cell as unknown as { kernelState: HelperTableState['rows'][number]['cells'][number]; spanWidth: { status: 'known'; value: number }; height: { status: 'known'; value: number } }).kernelState = stateCell;
    (cell as unknown as { spanWidth: { status: 'known'; value: number } }).spanWidth = { status: 'known', value: unwrap(getColSpanWidth(final, rowIndex, cell.column)) };
    (cell as unknown as { height: { status: 'known'; value: number } }).height = { status: 'known', value: unwrap(getCellHeight(final, rowIndex, cell.column)) };
  }
  const rowOneOperation = program.operations.find(operation => operation.id === 'op:row1')!;
  const rowTwoOperation = program.operations.find(operation => operation.id === 'op:row2')!;
  const textOperation = program.operations.find(operation => operation.id === 'op:text')!;
  const buttonOperation = program.operations.find(operation => operation.id === 'op:button')!;
  const editOperation = program.operations.find(operation => operation.id === 'op:edit')!;
  const iconOperation = program.operations.find(operation => operation.id === 'op:icon')!;
  const hiddenOperation = program.operations.find(operation => operation.id === 'op:hidden')!;
  const rowThreeOperation = operation('op:row3', 'addRow', rowThreeSource, program.tables[0].id, rowThreeId, '');
  (program.operations as unknown as X4UiLayoutOperation[]).push(rowThreeOperation);
  (program.tables[0].operationIds as unknown as string[]).push('op:row3');
  (rowOneOperation as unknown as { kernel: unknown }).kernel = { stateBefore: before, stateAfter: firstAfterAdd };
  (textOperation as unknown as { kernel: unknown }).kernel = { stateBefore: firstAfterAdd, stateAfter: afterText };
  (buttonOperation as unknown as { kernel: unknown }).kernel = { stateBefore: afterText, stateAfter: afterButton };
  (editOperation as unknown as { kernel: unknown }).kernel = { stateBefore: afterButton, stateAfter: afterEdit };
  (iconOperation as unknown as { kernel: unknown }).kernel = { stateBefore: afterEdit, stateAfter: afterIcon };
  (rowTwoOperation as unknown as { kernel: unknown }).kernel = { stateBefore: afterIcon, stateAfter: afterSecondAdd };
  (hiddenOperation as unknown as { kernel: unknown }).kernel = { stateBefore: afterSecondAdd, stateAfter: afterSpan };
  (rowThreeOperation as unknown as { kernel: unknown }).kernel = { stateBefore: afterSpan, stateAfter: final };
  for (const [id, offset] of [['op:row2', 170], ['op:hidden', 190]] as const) {
    const candidate = program.operations.find(operation => operation.id === id)!;
    const location = source(offset);
    (candidate as unknown as { source: X4UiSceneSourceLocation; sourceOrder: number; modelOrder: number }).source = location;
    (candidate as unknown as { sourceOrder: number; modelOrder: number }).sourceOrder = offset;
    (candidate as unknown as { modelOrder: number }).modelOrder = offset;
  }
  return program;
};

const makeLaterDiagnosticProgram = (fixture: Fixture): X4UiLayoutProgram => {
  const program = appendWidthPrelude(makeInsufficientReserveProgram(fixture));
  const table = program.tables[0];
  const before = table.kernelState!;
  const late = unwrap(setCellColSpan(before, 3, 1, 99));
  (table as unknown as { kernelState: HelperTableState; height: { status: 'known'; value: number } }).kernelState = late;
  (table as unknown as { height: { status: 'known'; value: number } }).height = { status: 'known', value: unwrap(getFullTableHeight(late)) };
  refreshProgramKernelProjection(program);
  const row = program.rows.find(candidate => candidate.id === 'row:reserve-three')!;
  for (const rowCell of program.cells.filter(candidate => candidate.rowId === row.id)) {
    (rowCell.descriptorFacts as Record<string, X4UiLayoutDescriptorFact>).span = known(late.rows[2].cells[rowCell.column - 1].colspan, 'number', rowCell.source);
  }
  const cell = program.cells.find(candidate => candidate.rowId === row.id && candidate.column === 1)!;
  (cell.descriptorFacts as Record<string, X4UiLayoutDescriptorFact>).span = known(late.rows[2].cells[0].colspan, 'number', cell.source);
  const lateOperation = operation('op:late-span', 'setColSpan', source(260), table.id, row.id, cell.id);
  (lateOperation.descriptorFacts as Record<string, X4UiLayoutDescriptorFact>).span = known(99, 'number', cell.source);
  (lateOperation as unknown as { kernel: unknown }).kernel = { stateBefore: before, stateAfter: late };
  (program.operations as unknown as X4UiLayoutOperation[]).push(lateOperation);
  (table.operationIds as unknown as string[]).push(lateOperation.id);
  (row.operationIds as unknown as string[]).push(lateOperation.id);
  (cell.operationIds as unknown as string[]).push(lateOperation.id);
  return program;
};

const appendWidthPrelude = (program: X4UiLayoutProgram): X4UiLayoutProgram => {
  const table = program.tables[0];
  const tableOperation = program.operations.find(candidate => candidate.id === 'op:table');
  const firstRowOperation = program.operations.find(candidate => candidate.id === 'op:row1');
  const initial = tableOperation?.kernel?.stateAfter;
  const target = firstRowOperation?.kernel?.stateBefore;
  if (!initial || !target) throw new Error('width-prelude fixture requires table and first-row kernel states');
  const existingWidthIds = new Set(program.operations.filter(operationNode => operationNode.id.startsWith('op:width:')).map(operationNode => operationNode.id));
  (program.operations as unknown as X4UiLayoutOperation[]).splice(0, program.operations.length, ...program.operations.filter(operationNode => !existingWidthIds.has(operationNode.id)));
  (table.operationIds as unknown as string[]).splice(0, table.operationIds.length, ...table.operationIds.filter(id => !existingWidthIds.has(id)));
  let state = initial;
  const operations: X4UiLayoutOperation[] = [];
  for (let index = 0; index < target.columns.length; index += 1) {
    const targetColumn = target.columns[index];
    const column = index + 1;
    const next = targetColumn.min
      ? setColWidthMin(state, column, targetColumn.width, targetColumn.weight, targetColumn.scaling)
      : setColWidth(state, column, targetColumn.width, targetColumn.scaling);
    const after = unwrap(next);
    const at = source(32 + index * 4);
    const widthOperation = operation(`op:width:${column}`, 'setColWidth', at, table.id, '', '');
    delete (widthOperation as unknown as { rowId?: string }).rowId;
    delete (widthOperation as unknown as { cellId?: string }).cellId;
    (widthOperation as unknown as { kernel: unknown }).kernel = { stateBefore: state, stateAfter: after };
    operations.push(widthOperation);
    state = after;
  }
  assert(JSON.stringify(state) === JSON.stringify(target), 'width-prelude fixture must reconstruct the exact first-row state');
  (program.operations as unknown as X4UiLayoutOperation[]).push(...operations);
  (table.operationIds as unknown as string[]).push(...operations.map(candidate => candidate.id));
  return program;
};

const makeHiddenColspanDiagnosticProgram = (fixture: Fixture): X4UiLayoutProgram => {
  const program = cloneProgram(fixture.program);
  const table = program.tables[0];
  const before = table.kernelState!;
  const after = unwrap(setCellColSpan(before, 1, 1, 2));
  (table as unknown as { kernelState: HelperTableState; height: { status: 'known'; value: number } }).kernelState = after;
  (table as unknown as { height: { status: 'known'; value: number } }).height = { status: 'known', value: unwrap(getFullTableHeight(after)) };
  refreshProgramKernelProjection(program);
  const row = program.rows.find(candidate => candidate.id === 'row:one')!;
  for (const cell of program.cells.filter(candidate => candidate.rowId === row.id)) {
    const span = after.rows[0].cells[cell.column - 1].colspan;
    (cell.descriptorFacts as Record<string, X4UiLayoutDescriptorFact>).span = known(span, 'number', cell.source);
  }
  const cell = program.cells.find(candidate => candidate.id === 'cell:text')!;
  const spanOperation = operation('op:in-range-span', 'setColSpan', source(270), table.id, row.id, cell.id);
  (spanOperation.descriptorFacts as Record<string, X4UiLayoutDescriptorFact>).span = known(2, 'number', cell.source);
  (spanOperation as unknown as { kernel: unknown }).kernel = { stateBefore: before, stateAfter: after };
  (program.operations as unknown as X4UiLayoutOperation[]).push(spanOperation);
  (table.operationIds as unknown as string[]).push(spanOperation.id);
  (row.operationIds as unknown as string[]).push(spanOperation.id);
  (cell.operationIds as unknown as string[]).push(spanOperation.id);
  return program;
};

const sceneFor = (fixture: Fixture, program?: X4UiLayoutProgram, profile = fixture.profile): X4UiSceneResult => {
  if (program === undefined) {
    if (!realGeometryProjection.result || !realGeometryProjection.profile || !('program' in realGeometryProjection.result)) {
      throw new Error('real geometry producer fixture is unavailable');
    }
    return buildX4UiScene(realGeometryProjection.result as X4UiLayoutProgramResult, fixture.corpus, realGeometryProjection.profile);
  }
  const authorityResult = rawProducerProjection.result;
  assert(authorityResult !== undefined && 'program' in authorityResult && authorityResult.program !== undefined && 'evidenceAuthority' in authorityResult && authorityResult.evidenceAuthority !== undefined, 'pair-boundary control requires a real producer authority');
  let pairValid = false;
  try {
    pairValid = validateX4UiLayoutEvidencePair(program, authorityResult.evidenceAuthority).valid;
  } catch {
    pairValid = false;
  }
  assert(!pairValid, 'handcrafted negative fixture unexpectedly formed a valid producer evidence pair');
  return buildX4UiScene({ ...authorityResult, program } as X4UiLayoutProgramResult, fixture.corpus, profile);
};

const zeroHeightTextProjection = rawProjectionFor([
  'local menu = { name = "ZeroHeightText", layer = 1 }',
  'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
  'local table = frame:addTable(1, { width = 100, reserveScrollBar = false, scaling = true })',
  'local row = table:addRow(false, { paddingTop = 0, paddingBottom = 0, borderBelow = false, fixed = false, scaling = true })',
  'row[1]:createText("zero", { minRowHeight = 16, scaling = true })',
  'frame:display()',
].join('\n'), 'selftest/scene-zero-height-text.lua', profile => ({
  ...profile,
  metrics: { ...profile.metrics, uiScale: 1.25 },
  defaults: { ...profile.defaults, minTextHeight: 22 },
}));

test('B119 causal zero-height text keeps the already-scaled Helper candidate at uiScale 1.25', () => {
  const projected = zeroHeightTextProjection;
  assert(projected.program !== undefined && projected.profile !== undefined && projected.result !== undefined && 'program' in projected.result && projected.result.program !== undefined && 'evidenceAuthority' in projected.result && projected.result.evidenceAuthority !== undefined, 'zero-height text fixture must produce an issued program/evidence pair');
  const creator = projected.program.operations.find(operation => operation.kind === 'createText');
  const cell = projected.program.cells.find(candidate => candidate.id === creator?.cellId);
  assert(creator !== undefined && cell !== undefined && creator.descriptorFacts.minTextHeight?.status === 'known' && cell.descriptorFacts.minTextHeight?.status === 'known', 'zero-height text fixture must expose creator and cell minTextHeight facts');
  assert(creator.descriptorFacts.minTextHeight.value === 22 && cell.descriptorFacts.minTextHeight.value === 22, 'zero-height text fixture must expose the scaled minTextHeight candidate');
  const result = buildX4UiScene(projected.result as X4UiLayoutProgramResult, corpus, projected.profile);
  assert(result.status !== 'refused', `source-proven zero-height text must reach Scene projection at ${diagnoseX4UiSceneStructureForTest(projected.program, projected.result.evidenceAuthority)}: ${JSON.stringify(result)}`);

  const changedValue = cloneProgram(projected.program);
  const changedCreator = changedValue.operations.find(operation => operation.kind === 'createText');
  assert(changedCreator !== undefined, 'changed-value fixture must retain its creator');
  (changedCreator.descriptorFacts.minTextHeight as unknown as { value: number }).value = 23;
  assert(diagnoseX4UiSceneStructureForTest(changedValue, projected.result.evidenceAuthority) !== undefined, 'changed creator minTextHeight must fail closed');

  const changedCellValue = cloneProgram(projected.program);
  const changedCellCreator = changedCellValue.operations.find(operation => operation.kind === 'createText');
  const changedCell = changedCellValue.cells.find(candidate => candidate.id === changedCellCreator?.cellId);
  assert(changedCell !== undefined, 'changed-cell fixture must retain its cell');
  (changedCell.descriptorFacts.minTextHeight as unknown as { value: number }).value = 23;
  assert(diagnoseX4UiSceneStructureForTest(changedCellValue, projected.result.evidenceAuthority) !== undefined, 'changed cell minTextHeight must fail closed');

  const changedProvenance = cloneProgram(projected.program);
  const provenanceCreator = changedProvenance.operations.find(operation => operation.kind === 'createText');
  assert(provenanceCreator !== undefined, 'changed-provenance fixture must retain its creator');
  (provenanceCreator.descriptorFacts.minTextHeight as unknown as { provenance: string }).provenance = 'preview-only';
  assert(diagnoseX4UiSceneStructureForTest(changedProvenance, projected.result.evidenceAuthority) !== undefined, 'changed minTextHeight provenance must fail closed');

  const removedRelationship = cloneProgram(projected.program);
  const removedCreator = removedRelationship.operations.find(operation => operation.kind === 'createText');
  const removedCell = removedRelationship.cells.find(candidate => candidate.id === removedCreator?.cellId);
  assert(removedCreator !== undefined && removedCell !== undefined, 'removed-relationship fixture must retain creator and cell');
  delete (removedCreator.descriptorFacts as Record<string, X4UiLayoutDescriptorFact>).minTextHeight;
  delete (removedCell.descriptorFacts as Record<string, X4UiLayoutDescriptorFact>).minTextHeight;
  assert(diagnoseX4UiSceneStructureForTest(removedRelationship, projected.result.evidenceAuthority) !== undefined, 'removed creator/cell minTextHeight relationship must fail closed');
});

const producerAuthority = (result: X4UiLayoutProgramResult): X4UiLayoutEvidenceAuthority => {
  if (!('evidenceAuthority' in result) || result.evidenceAuthority === undefined) throw new Error('successful producer result must expose evidence authority');
  return result.evidenceAuthority;
};

const synchronizedAuthority = (
  authority: X4UiLayoutEvidenceAuthority,
  program: X4UiLayoutProgram,
): X4UiLayoutEvidenceAuthority => {
  const copy = cloneJsonValue(authority) as unknown as Record<string, unknown>;
  const operations = copy.operations;
  if (!Array.isArray(operations)) return copy as unknown as X4UiLayoutEvidenceAuthority;
  const programById = new Map(program.operations.map(operation => [operation.id, operation]));
  for (const candidate of operations) {
    if (candidate === null || typeof candidate !== 'object' || Array.isArray(candidate)) continue;
    const record = candidate as Record<string, unknown>;
    const operation = typeof record.id === 'string' ? programById.get(record.id) : undefined;
    if (operation === undefined) continue;
    if (Object.prototype.hasOwnProperty.call(record, 'snapshot')) record.snapshot = cloneJsonValue(operation);
    for (const key of ['kind', 'status', 'frameId', 'tableId', 'rowId', 'cellId', 'source', 'sourceOrder', 'modelOrder'] as const) {
      if (Object.prototype.hasOwnProperty.call(record, key)) record[key] = cloneJsonValue((operation as unknown as Record<string, unknown>)[key]);
    }
  }
  const calls = copy.calls;
  if (Array.isArray(calls)) {
    for (const candidate of calls) {
      if (candidate === null || typeof candidate !== 'object' || Array.isArray(candidate)) continue;
      const record = candidate as Record<string, unknown>;
      const operation = typeof record.operationId === 'string' ? programById.get(record.operationId) : undefined;
      if (operation !== undefined) {
        if (Object.prototype.hasOwnProperty.call(record, 'status')) record.status = cloneJsonValue(operation.status);
      }
    }
  }
  const nodes = copy.nodes;
  if (nodes !== null && typeof nodes === 'object' && !Array.isArray(nodes)) {
    const nodeRecord = nodes as Record<string, unknown>;
    type AuthorityCandidateNode = {
      readonly id: string;
      readonly operationIds: readonly string[];
      readonly metadataOperationIds?: readonly string[];
    };
    const programNodes: ReadonlyArray<readonly [string, readonly AuthorityCandidateNode[]]> = [
      ['frames', program.frames],
      ['tables', program.tables],
      ['rows', program.rows],
      ['cells', program.cells],
    ];
    for (const [collection, candidates] of programNodes) {
      const ledgers = nodeRecord[collection];
      if (!Array.isArray(ledgers)) continue;
      const candidatesById = new Map(candidates.map(candidate => [candidate.id, candidate] as const));
      for (const ledger of ledgers) {
        if (ledger === null || typeof ledger !== 'object' || Array.isArray(ledger)) continue;
        const ledgerRecord = ledger as Record<string, unknown>;
        const candidate = typeof ledgerRecord.id === 'string' ? candidatesById.get(ledgerRecord.id) : undefined;
        if (candidate === undefined) continue;
        ledgerRecord.snapshot = cloneJsonValue(candidate);
        ledgerRecord.operationIds = cloneJsonValue(candidate.operationIds);
        if (candidate.metadataOperationIds !== undefined) ledgerRecord.metadataOperationIds = cloneJsonValue(candidate.metadataOperationIds);
      }
    }
  }
  return copy as unknown as X4UiLayoutEvidenceAuthority;
};

const hostileEditBoxDefaultTransition = (
  projected: ReturnType<typeof rawProjectionFor>,
  operationKind: 'setDefaultCellProperties' | 'setDefaultComplexCellProperties',
  factName: string,
  fact: X4UiLayoutDescriptorFact,
  mutateDefaults: (defaults: Record<string, unknown>) => void,
): { program: X4UiLayoutProgram; authority: X4UiLayoutEvidenceAuthority } => {
  assert(projected.program !== undefined && projected.result !== undefined && 'evidenceAuthority' in projected.result && projected.result.evidenceAuthority !== undefined, 'hostile edit-box default fixture must issue an evidence pair');
  const program = cloneProgram(projected.program);
  const operation = program.operations.find(operationNode => operationNode.kind === operationKind);
  assert(operation !== undefined && operation.kernel?.stateAfter !== undefined, `hostile ${operationKind} fixture must retain its issued transition`);
  const table = program.tables.find(tableNode => tableNode.id === operation.tableId);
  assert(table?.kernelState !== undefined, `hostile ${operationKind} fixture must retain its table state`);
  (operation.descriptorFacts as Record<string, X4UiLayoutDescriptorFact>)[factName] = fact;
  const stateAfter = cloneKernelState(operation.kernel.stateAfter);
  assert(stateAfter.editBoxDefaults !== undefined, `hostile ${operationKind} fixture must retain edit-box defaults`);
  mutateDefaults(stateAfter.editBoxDefaults as unknown as Record<string, unknown>);
  (operation.kernel as unknown as { stateAfter: HelperTableState }).stateAfter = stateAfter;
  (table as unknown as { kernelState: HelperTableState }).kernelState = stateAfter;
  const authority = synchronizedAuthority(projected.result.evidenceAuthority, program);
  freezeFixtureGraph(program);
  freezeFixtureGraph(authority);
  return { program, authority };
};

const hostileDynamicEditBoxDefaultTransition = (
  projected: ReturnType<typeof rawProjectionFor>,
  operationKind: 'setDefaultCellProperties' | 'setDefaultComplexCellProperties',
  factName: 'height' | 'scaling' | 'hotkey' | 'displayIcon',
  factValue: number | string | boolean,
  expectedType: 'number' | 'string' | 'boolean',
): { program: X4UiLayoutProgram; authority: X4UiLayoutEvidenceAuthority } => {
  assert(projected.program !== undefined && projected.result !== undefined && 'evidenceAuthority' in projected.result && projected.result.evidenceAuthority !== undefined, 'hostile dynamic edit-box default fixture must issue an evidence pair');
  const program = cloneProgram(projected.program);
  const operation = program.operations.find(operationNode => operationNode.kind === operationKind);
  assert(operation !== undefined && operation.status === 'unresolved' && operation.kernel === undefined && operation.tableId !== undefined, `hostile dynamic ${operationKind} fixture must retain an unresolved unmaterialized transition`);
  const table = program.tables.find(tableNode => tableNode.id === operation.tableId);
  const previous = program.operations
    .filter(operationNode => operationNode.tableId === operation.tableId && operationNode.modelOrder < operation.modelOrder && operationNode.kernel?.stateAfter !== undefined)
    .sort((left, right) => left.modelOrder - right.modelOrder)
    .at(-1);
  assert(table?.kernelState !== undefined && previous?.kernel?.stateAfter !== undefined, `hostile dynamic ${operationKind} fixture must retain its table and preceding kernel state`);
  assert(jsonEqual(table.kernelState, previous.kernel.stateAfter), `hostile dynamic ${operationKind} fixture must start from the preceding table state`);
  const stateBefore = cloneKernelState(previous.kernel.stateAfter);
  const stateAfter = cloneKernelState(stateBefore);
  assert(stateAfter.editBoxDefaults !== undefined, `hostile dynamic ${operationKind} fixture must retain edit-box defaults`);
  (stateAfter.editBoxDefaults as unknown as Record<string, unknown>)[factName] = factValue;
  (operation.descriptorFacts as Record<string, X4UiLayoutDescriptorFact>)[factName] = known(factValue, expectedType, operation.source, `runtime${factName[0].toUpperCase()}${factName.slice(1)}`);
  const mutableOperation = operation as unknown as {
    kernel: { stateBefore: HelperTableState; stateAfter: HelperTableState };
  };
  mutableOperation.kernel = { stateBefore, stateAfter };
  (table as unknown as { kernelState: HelperTableState }).kernelState = stateAfter;
  const authority = synchronizedAuthority(projected.result.evidenceAuthority, program);
  freezeFixtureGraph(program);
  freezeFixtureGraph(authority);
  return { program, authority };
};

const hostileDynamicSetHotkeyTransition = (
  projected: ReturnType<typeof rawProjectionFor>,
): { program: X4UiLayoutProgram; authority: X4UiLayoutEvidenceAuthority } => {
  assert(projected.program !== undefined && projected.result !== undefined && 'evidenceAuthority' in projected.result && projected.result.evidenceAuthority !== undefined, 'hostile dynamic setHotkey fixture must issue an evidence pair');
  const program = cloneProgram(projected.program);
  const operation = program.operations.find(operationNode => operationNode.kind === 'setHotkey');
  assert(operation !== undefined && operation.status === 'unresolved' && operation.kernel === undefined && operation.tableId !== undefined && operation.rowId !== undefined && operation.cellId !== undefined, 'hostile dynamic setHotkey fixture must retain an unresolved unmaterialized transition and owners');
  const table = program.tables.find(tableNode => tableNode.id === operation.tableId);
  const row = program.rows.find(rowNode => rowNode.id === operation.rowId);
  const cell = program.cells.find(cellNode => cellNode.id === operation.cellId);
  const previous = program.operations
    .filter(operationNode => operationNode.tableId === operation.tableId && operationNode.modelOrder < operation.modelOrder && operationNode.kernel?.stateAfter !== undefined)
    .sort((left, right) => left.modelOrder - right.modelOrder)
    .at(-1);
  assert(table?.kernelState !== undefined && row?.rowIndex !== undefined && cell?.rowIndex === row.rowIndex && previous?.kernel?.stateAfter !== undefined, 'hostile dynamic setHotkey fixture must retain its table, row, cell, and preceding kernel state');
  assert(jsonEqual(table.kernelState, previous.kernel.stateAfter), 'hostile dynamic setHotkey fixture must start from the preceding table state');
  const stateBefore = cloneKernelState(previous.kernel.stateAfter);
  const stateAfter = cloneKernelState(stateBefore);
  const stateCell = stateAfter.rows[row.rowIndex - 1]?.cells[cell.column - 1];
  assert(stateCell !== undefined, 'hostile dynamic setHotkey fixture must retain its cell slot');
  (stateCell as unknown as { hotkey: string; displayIcon: boolean }).hotkey = 'KEY';
  (stateCell as unknown as { hotkey: string; displayIcon: boolean }).displayIcon = true;
  (operation.descriptorFacts as Record<string, X4UiLayoutDescriptorFact>).hotkey = known('KEY', 'string', operation.source, '"KEY"');
  (operation.descriptorFacts as Record<string, X4UiLayoutDescriptorFact>).displayIcon = known(true, 'boolean', operation.source, 'runtimeDisplayIcon');
  (cell.descriptorFacts as Record<string, X4UiLayoutDescriptorFact>).hotkey = known('KEY', 'string', cell.source, '"KEY"');
  (cell.descriptorFacts as Record<string, X4UiLayoutDescriptorFact>).displayIcon = known(true, 'boolean', cell.source, 'runtimeDisplayIcon');
  const mutableOperation = operation as unknown as {
    kernel: { stateBefore: HelperTableState; stateAfter: HelperTableState };
  };
  mutableOperation.kernel = { stateBefore, stateAfter };
  (table as unknown as { kernelState: HelperTableState }).kernelState = stateAfter;
  (row as unknown as { kernelState: HelperTableState['rows'][number] }).kernelState = stateAfter.rows[row.rowIndex - 1]!;
  (cell as unknown as { kernelState: HelperTableState['rows'][number]['cells'][number] }).kernelState = stateCell;
  refreshProgramKernelProjection(program);
  const authority = synchronizedAuthority(projected.result.evidenceAuthority, program);
  freezeFixtureGraph(program);
  freezeFixtureGraph(authority);
  return { program, authority };
};

test('B119 dynamic edit-box default height cannot become a forged producer', () => {
  const projected = rawProjectionFor([
    'local menu = { name = "B119DynamicDefaultHeight", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(1, { width = 100, reserveScrollBar = false, scaling = false })',
    'table:setDefaultCellProperties("editbox", { height = runtimeHeight })',
    'frame:display()',
  ].join('\n'), 'selftest/b119-dynamic-default-height.lua');
  const hostile = hostileDynamicEditBoxDefaultTransition(projected, 'setDefaultCellProperties', 'height', 77, 'number');
  const pair = validateX4UiLayoutEvidencePair(hostile.program, hostile.authority);
  const stage = diagnoseX4UiSceneStructureForTest(hostile.program, hostile.authority);
  console.log(`B119 dynamic-default height hostile receipt: ${JSON.stringify({ pairValid: pair.valid, stage })}`);
  assert(pair.valid, `forged dynamic-height transition must remain producer-pair valid: ${JSON.stringify(pair)}`);
  assert(stage !== undefined, 'dynamic source height must be rejected when a known fact and coherent transition are forged');
});

test('B119 dynamic edit-box default scaling cannot become a forged producer', () => {
  const projected = rawProjectionFor([
    'local menu = { name = "B119DynamicDefaultScaling", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(1, { width = 100, reserveScrollBar = false, scaling = false })',
    'table:setDefaultCellProperties("editbox", { scaling = runtimeScaling })',
    'frame:display()',
  ].join('\n'), 'selftest/b119-dynamic-default-scaling.lua');
  const hostile = hostileDynamicEditBoxDefaultTransition(projected, 'setDefaultCellProperties', 'scaling', true, 'boolean');
  const pair = validateX4UiLayoutEvidencePair(hostile.program, hostile.authority);
  const stage = diagnoseX4UiSceneStructureForTest(hostile.program, hostile.authority);
  console.log(`B119 dynamic-default scaling hostile receipt: ${JSON.stringify({ pairValid: pair.valid, stage })}`);
  assert(pair.valid, `forged dynamic-scaling transition must remain producer-pair valid: ${JSON.stringify(pair)}`);
  assert(stage !== undefined, 'dynamic source scaling must be rejected when a known fact and coherent transition are forged');
});

test('B119 dynamic edit-box default hotkey cannot become a forged producer', () => {
  const projected = rawProjectionFor([
    'local menu = { name = "B119DynamicDefaultHotkey", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(1, { width = 100, reserveScrollBar = false, scaling = false })',
    'table:setDefaultComplexCellProperties("editbox", "hotkey", { hotkey = runtimeHotkey })',
    'frame:display()',
  ].join('\n'), 'selftest/b119-dynamic-default-hotkey.lua');
  const hostile = hostileDynamicEditBoxDefaultTransition(projected, 'setDefaultComplexCellProperties', 'hotkey', 'FORGED', 'string');
  const pair = validateX4UiLayoutEvidencePair(hostile.program, hostile.authority);
  const stage = diagnoseX4UiSceneStructureForTest(hostile.program, hostile.authority);
  console.log(`B119 dynamic-default hotkey hostile receipt: ${JSON.stringify({ pairValid: pair.valid, stage })}`);
  assert(pair.valid, `forged dynamic-hotkey transition must remain producer-pair valid: ${JSON.stringify(pair)}`);
  assert(stage !== undefined, 'dynamic source hotkey must be rejected when a known fact and coherent transition are forged');
});

test('B119 dynamic edit-box default displayIcon cannot become a forged producer', () => {
  const projected = rawProjectionFor([
    'local menu = { name = "B119DynamicDefaultDisplayIcon", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(1, { width = 100, reserveScrollBar = false, scaling = false })',
    'table:setDefaultComplexCellProperties("editbox", "hotkey", { displayIcon = runtimeFlag })',
    'frame:display()',
  ].join('\n'), 'selftest/b119-dynamic-default-display-icon.lua');
  const hostile = hostileDynamicEditBoxDefaultTransition(projected, 'setDefaultComplexCellProperties', 'displayIcon', true, 'boolean');
  const pair = validateX4UiLayoutEvidencePair(hostile.program, hostile.authority);
  const stage = diagnoseX4UiSceneStructureForTest(hostile.program, hostile.authority);
  console.log(`B119 dynamic-default displayIcon hostile receipt: ${JSON.stringify({ pairValid: pair.valid, stage })}`);
  assert(pair.valid, `forged dynamic-displayIcon transition must remain producer-pair valid: ${JSON.stringify(pair)}`);
  assert(stage !== undefined, 'dynamic source displayIcon must be rejected when a known fact and coherent transition are forged');
});

test('B119 dynamic edit-box setHotkey displayIcon cannot become a forged producer', () => {
  const projected = rawProjectionFor([
    'local menu = { name = "B119DynamicSetHotkeyDisplayIcon", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(1, { width = 100, reserveScrollBar = false, scaling = false })',
    'local row = table:addRow(false, {})',
    'local edit = row[1]:createEditBox({ height = 25, scaling = false })',
    'edit:setHotkey("KEY", { displayIcon = runtimeFlag })',
    'frame:display()',
  ].join('\n'), 'selftest/b119-dynamic-set-hotkey-display-icon.lua');
  const hostile = hostileDynamicSetHotkeyTransition(projected);
  const pair = validateX4UiLayoutEvidencePair(hostile.program, hostile.authority);
  const stage = diagnoseX4UiSceneStructureForTest(hostile.program, hostile.authority);
  console.log(`B119 dynamic-setHotkey displayIcon hostile receipt: ${JSON.stringify({ pairValid: pair.valid, stage })}`);
  assert(pair.valid, `forged dynamic-setHotkey displayIcon transition must remain producer-pair valid: ${JSON.stringify(pair)}`);
  assert(stage !== undefined, 'dynamic setHotkey displayIcon must be rejected when a known fact and coherent transition are forged');
});

test('B119 source reciprocity rejects forged height from omitted setDefaultCellProperties input', () => {
  const projected = rawProjectionFor([
    'local menu = { name = "B119OmittedDefaultHeight", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(1, { width = 100, reserveScrollBar = false, scaling = false })',
    'table:setDefaultCellProperties("editbox", {})',
    'frame:display()',
  ].join('\n'), 'selftest/b119-omitted-default-height.lua');
  const hostile = hostileEditBoxDefaultTransition(projected, 'setDefaultCellProperties', 'height', known(77, 'number', source(401)), defaults => {
    defaults.height = 77;
  });
  const pair = validateX4UiLayoutEvidencePair(hostile.program, hostile.authority);
  assert(pair.valid, `forged omitted-height transition must remain producer-pair valid: ${JSON.stringify(pair)}`);
  assert(diagnoseX4UiSceneStructureForTest(hostile.program, hostile.authority) !== undefined, 'forged height descriptor fact must be rejected when source height was omitted');
});

test('B119 source reciprocity rejects forged scaling from omitted setDefaultCellProperties input', () => {
  const projected = rawProjectionFor([
    'local menu = { name = "B119OmittedDefaultScaling", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(1, { width = 100, reserveScrollBar = false, scaling = false })',
    'table:setDefaultCellProperties("editbox", {})',
    'frame:display()',
  ].join('\n'), 'selftest/b119-omitted-default-scaling.lua');
  const hostile = hostileEditBoxDefaultTransition(projected, 'setDefaultCellProperties', 'scaling', known(true, 'boolean', source(402)), defaults => {
    defaults.scaling = true;
  });
  const pair = validateX4UiLayoutEvidencePair(hostile.program, hostile.authority);
  assert(pair.valid, `forged omitted-scaling transition must remain producer-pair valid: ${JSON.stringify(pair)}`);
  assert(diagnoseX4UiSceneStructureForTest(hostile.program, hostile.authority) !== undefined, 'forged scaling descriptor fact must be rejected when source scaling was omitted');
});

test('B119 source reciprocity rejects forged hotkey from omitted setDefaultComplexCellProperties input', () => {
  const projected = rawProjectionFor([
    'local menu = { name = "B119OmittedDefaultHotkey", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(1, { width = 100, reserveScrollBar = false, scaling = false })',
    'table:setDefaultComplexCellProperties("editbox", "hotkey", {})',
    'frame:display()',
  ].join('\n'), 'selftest/b119-omitted-default-hotkey.lua');
  const hostile = hostileEditBoxDefaultTransition(projected, 'setDefaultComplexCellProperties', 'hotkey', known('FORGED', 'string', source(403)), defaults => {
    defaults.hotkey = 'FORGED';
  });
  const pair = validateX4UiLayoutEvidencePair(hostile.program, hostile.authority);
  assert(pair.valid, `forged omitted-hotkey transition must remain producer-pair valid: ${JSON.stringify(pair)}`);
  assert(diagnoseX4UiSceneStructureForTest(hostile.program, hostile.authority) !== undefined, 'forged hotkey descriptor fact must be rejected when source hotkey was omitted');
});

test('B119 source reciprocity rejects forged displayIcon from omitted setDefaultComplexCellProperties input', () => {
  const projected = rawProjectionFor([
    'local menu = { name = "B119OmittedDefaultDisplayIcon", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(1, { width = 100, reserveScrollBar = false, scaling = false })',
    'table:setDefaultComplexCellProperties("editbox", "hotkey", {})',
    'frame:display()',
  ].join('\n'), 'selftest/b119-omitted-default-display-icon.lua');
  const hostile = hostileEditBoxDefaultTransition(projected, 'setDefaultComplexCellProperties', 'displayIcon', known(true, 'boolean', source(404)), defaults => {
    defaults.displayIcon = true;
  });
  const pair = validateX4UiLayoutEvidencePair(hostile.program, hostile.authority);
  assert(pair.valid, `forged omitted-displayIcon transition must remain producer-pair valid: ${JSON.stringify(pair)}`);
  assert(diagnoseX4UiSceneStructureForTest(hostile.program, hostile.authority) !== undefined, 'forged displayIcon descriptor fact must be rejected when source displayIcon was omitted');
});

test('B119 source reciprocity rejects forged displayIcon from omitted setHotkey input', () => {
  const projected = rawProjectionFor([
    'local menu = { name = "B119OmittedSetHotkeyDisplayIcon", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(1, { width = 100, reserveScrollBar = false, scaling = false })',
    'local row = table:addRow(false, {})',
    'local edit = row[1]:createEditBox({ height = 25, scaling = false })',
    'edit:setHotkey("KEY")',
    'frame:display()',
  ].join('\n'), 'selftest/b119-omitted-set-hotkey-display-icon.lua');
  assert(projected.program !== undefined && projected.result !== undefined && 'evidenceAuthority' in projected.result && projected.result.evidenceAuthority !== undefined, 'hostile setHotkey fixture must issue an evidence pair');
  const program = cloneProgram(projected.program);
  const operation = program.operations.find(operationNode => operationNode.kind === 'setHotkey');
  assert(operation !== undefined && operation.kernel?.stateAfter !== undefined && operation.tableId !== undefined && operation.rowId !== undefined && operation.cellId !== undefined, 'hostile setHotkey fixture must retain its issued transition and owners');
  const table = program.tables.find(tableNode => tableNode.id === operation.tableId);
  const row = program.rows.find(rowNode => rowNode.id === operation.rowId);
  const cell = program.cells.find(cellNode => cellNode.id === operation.cellId);
  assert(table?.kernelState !== undefined && row?.rowIndex !== undefined && cell?.rowIndex === row.rowIndex, 'hostile setHotkey fixture must retain its table, row, and cell state');
  (operation.descriptorFacts as Record<string, X4UiLayoutDescriptorFact>).displayIcon = known(true, 'boolean', operation.source);
  const stateAfter = cloneKernelState(operation.kernel.stateAfter);
  const stateCell = stateAfter.rows[row.rowIndex - 1]?.cells[cell.column - 1];
  assert(stateCell !== undefined, 'hostile setHotkey fixture must retain its cell slot');
  (stateCell as unknown as { displayIcon: boolean }).displayIcon = true;
  (cell.descriptorFacts as Record<string, X4UiLayoutDescriptorFact>).displayIcon = known(true, 'boolean', cell.source);
  (operation.kernel as unknown as { stateAfter: HelperTableState }).stateAfter = stateAfter;
  (table as unknown as { kernelState: HelperTableState }).kernelState = stateAfter;
  (row as unknown as { kernelState: HelperTableState['rows'][number] }).kernelState = stateAfter.rows[row.rowIndex - 1]!;
  (cell as unknown as { kernelState: HelperTableState['rows'][number]['cells'][number] }).kernelState = stateCell;
  refreshProgramKernelProjection(program);
  const authority = synchronizedAuthority(projected.result.evidenceAuthority, program);
  freezeFixtureGraph(program);
  freezeFixtureGraph(authority);
  const pair = validateX4UiLayoutEvidencePair(program, authority);
  assert(pair.valid, `forged omitted-setHotkey displayIcon transition must remain producer-pair valid: ${JSON.stringify(pair)}`);
  const stage = diagnoseX4UiSceneStructureForTest(program, authority);
  console.log(`B119 omitted-setHotkey displayIcon hostile receipt: ${JSON.stringify({ pairValid: pair.valid, stage })}`);
  assert(stage !== undefined, 'forged displayIcon descriptor fact must be rejected when source setHotkey displayIcon was omitted');
});

const b119UnsupportedHotkeyProjection = rawProjectionFor([
  'local menu = { name = "B119UnsupportedHotkeyProperties", layer = 1 }',
  'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
  'local table = frame:addTable(1, { width = 100, reserveScrollBar = false, scaling = false })',
  'table:setDefaultCellProperties("editbox", { height = 0, scaling = false, x = 0 })',
  'table:setDefaultComplexCellProperties("editbox", "hotkey", { hotkey = "DEFAULT", displayIcon = true, x = 0 })',
  'local row = table:addRow(false, {})',
  'local edit = row[1]:createEditBox({ height = 0, scaling = false })',
  'edit:setHotkey("VISIBLE_ARGUMENT", { hotkey = "", displayIcon = false, x = 0, hotkey_x = 7 })',
  'frame:display()',
].join('\n'), 'selftest/b119-unsupported-hotkey-properties.lua');

test('B119 authentic unsupported hotkey properties retain exact height while crossing Scene partial', () => {
  assert(b119UnsupportedHotkeyProjection.program !== undefined
    && b119UnsupportedHotkeyProjection.profile !== undefined
    && b119UnsupportedHotkeyProjection.result !== undefined
    && 'evidenceAuthority' in b119UnsupportedHotkeyProjection.result
    && b119UnsupportedHotkeyProjection.result.evidenceAuthority !== undefined,
  'unsupported hotkey property fixture must issue an evidence pair');
  const result = b119UnsupportedHotkeyProjection.result as X4UiLayoutProgramResult;
  const program = b119UnsupportedHotkeyProjection.program;
  const authority = producerAuthority(result);
  const direct = program.operations.find(operation => operation.kind === 'setHotkey');
  const cell = direct?.cellId === undefined ? undefined : program.cells.find(candidate => candidate.id === direct.cellId);
  const directGaps = direct === undefined ? [] : program.gaps.filter(gap => gap.operationId === direct.id);
  const unsupportedProperties = direct === undefined
    ? []
    : ((direct.metadata.semantics as unknown as {
      unsupportedProperties?: Array<{ name: string; normalizedName: string; value: { expression: string } }>;
    }).unsupportedProperties ?? []);
  const underscoredProperty = unsupportedProperties.find(candidate => candidate.name === 'hotkey_x');
  const sceneResult = buildX4UiScene(result, corpus, b119UnsupportedHotkeyProjection.profile);
  const pair = validateX4UiLayoutEvidencePair(program, authority);
  const stage = diagnoseX4UiSceneStructureForTest(program, authority);
  assert(direct !== undefined && cell !== undefined && direct.kernel?.stateAfter !== undefined, 'unsupported hotkey property fixture must retain direct transition and cell');
  assert(pair.valid && stage === undefined, `authentic unsupported hotkey evidence must cross Scene structure: ${JSON.stringify({ pair, stage })}`);
  assert(program.status === 'partial' && result.status === 'partial' && sceneResult.status === 'partial', 'unsupported hotkey properties must preserve partial status');
  assert(direct.status === 'unresolved' && direct.kernel.stateAfter.rows[0]?.cells[0]?.height === 0, 'unsupported hotkey property transition must retain exact zero height in an unresolved operation');
  assert(cell.kernelState?.height === 0 && cell.kernelState.hotkey === '' && cell.kernelState.displayIcon === false, 'unsupported hotkey property transition must retain the winning empty hotkey and icon state');
  assert(underscoredProperty?.normalizedName === 'hotkeyx' && underscoredProperty.value.expression === '7', 'CallModel must retain the normalized underscore property contract in Scene source evidence');
  assert(directGaps.length === 2
    && directGaps.every(gap => gap.category === 'property'
      && gap.status === 'unsupported'
      && gap.source.start.offset > direct.source.start.offset
      && gap.source.end.offset <= direct.source.end.offset)
    && directGaps.some(gap => gap.expression === '0')
    && directGaps.some(gap => gap.expression === '7'),
  'direct x and hotkey_x properties must each have one exact source-linked unsupported gap');
  assert(sceneResult.scene.widgets.some(widget => widget.cellId === `scene:${cell.id}` && widget.outerRect?.height === 0), 'Scene must retain known editbox geometry while the source property remains partial');
  assert(sceneResult.scene.gameTruth === 'Not verified in game' && sceneResult.verification.gameVerified === false, 'Scene must retain literal Not verified in game');
});

test('B119 Scene rejects pair-valid forged unsupported-property completeness and source authority', () => {
  assert(b119UnsupportedHotkeyProjection.program !== undefined
    && b119UnsupportedHotkeyProjection.result !== undefined
    && 'evidenceAuthority' in b119UnsupportedHotkeyProjection.result
    && b119UnsupportedHotkeyProjection.result.evidenceAuthority !== undefined,
  'hostile unsupported hotkey property fixture must issue an evidence pair');
  const baseProgram = b119UnsupportedHotkeyProjection.program;
  const baseAuthority = producerAuthority(b119UnsupportedHotkeyProjection.result as X4UiLayoutProgramResult);
  const hostile = (
    label: string,
    mutate: (program: X4UiLayoutProgram, operation: X4UiLayoutOperation) => void,
    mutateAuthority?: (authority: X4UiLayoutEvidenceAuthority, program: X4UiLayoutProgram, operation: X4UiLayoutOperation) => void,
  ): void => {
    const program = cloneProgram(baseProgram);
    const operation = program.operations.find(candidate => candidate.kind === 'setHotkey');
    assert(operation !== undefined, `${label} fixture must retain setHotkey operation`);
    mutate(program, operation);
    const authority = synchronizedAuthority(baseAuthority, program);
    if (mutateAuthority !== undefined) mutateAuthority(authority, program, operation);
    freezeFixtureGraph(program);
    freezeFixtureGraph(authority);
    const pair = validateX4UiLayoutEvidencePair(program, authority);
    const stage = diagnoseX4UiSceneStructureForTest(program, authority);
    console.log(`B119 unsupported-property ${label} hostile receipt: ${JSON.stringify({ pairValid: pair.valid, stage })}`);
    assert(pair.valid, `${label} hostile must remain producer-pair valid: ${JSON.stringify(pair)}`);
    assert(stage !== undefined, `${label} hostile must be rejected at Scene structure before geometry`);
  };
  hostile('winning-source-fact', (_program, operation) => {
    (operation.descriptorFacts as Record<string, X4UiLayoutDescriptorFact>).hotkey = known('VISIBLE_ARGUMENT', 'string', operation.source, '"VISIBLE_ARGUMENT"');
  });
  hostile('altered-source-authority', (_program, operation) => {
    (operation.descriptorFacts as Record<string, X4UiLayoutDescriptorFact>).hotkey = known('', 'string', operation.source, '""');
  });
  let droppedGapIndex = -1;
  hostile('dropped-property-gap', (program, operation) => {
    droppedGapIndex = program.gaps.findIndex(gap => gap.operationId === operation.id && gap.category === 'property' && gap.status === 'unsupported');
    assert(droppedGapIndex >= 0, 'dropped-property-gap fixture must locate a direct unsupported gap');
    (program as unknown as { gaps: { splice(index: number, deleteCount: number): void } }).gaps.splice(droppedGapIndex, 1);
  }, authority => {
    const mutableAuthority = authority as unknown as {
      gaps: X4UiLayoutEvidenceAuthority['gaps'];
      linkedGapIndexes: number[];
      unlinkedGapIndexes: number[];
    };
    const gaps = [...mutableAuthority.gaps];
    gaps.splice(droppedGapIndex, 1);
    mutableAuthority.gaps = gaps;
    mutableAuthority.linkedGapIndexes = gaps
      .map((gap, index) => gap.operationId === undefined ? undefined : index)
      .filter((index): index is number => index !== undefined);
    mutableAuthority.unlinkedGapIndexes = gaps
      .map((gap, index) => gap.operationId === undefined ? index : undefined)
      .filter((index): index is number => index !== undefined);
  });
  hostile('applied-operation-completeness', (_program, operation) => {
    (operation as unknown as { status: 'applied' }).status = 'applied';
  });
  hostile('projected-program-completeness', (program) => {
    (program as unknown as { status: 'projected' }).status = 'projected';
  });

  const normalizedProgram = cloneProgram(baseProgram);
  const normalizedOperation = normalizedProgram.operations.find(candidate => candidate.kind === 'setHotkey');
  assert(normalizedOperation !== undefined, 'normalized-name-mismatch fixture must retain setHotkey operation');
  const normalizedSemantics = normalizedOperation.metadata.semantics as unknown as {
    unsupportedProperties?: Array<{ name: string; normalizedName: string }>;
  };
  const normalizedProperty = normalizedSemantics.unsupportedProperties?.find(candidate => candidate.name === 'hotkey_x');
  assert(normalizedProperty !== undefined, 'normalized-name-mismatch fixture must retain the underscored unsupported property');
  normalizedProperty.normalizedName = 'hotkey_x';
  const normalizedAuthority = synchronizedAuthority(baseAuthority, normalizedProgram);
  const normalizedOperationIndex = normalizedProgram.operations.findIndex(candidate => candidate.id === normalizedOperation.id);
  const mutableNormalizedAuthority = normalizedAuthority as unknown as {
    sourceBindings: Array<{ metadata: X4UiLayoutOperation['metadata'] }>;
  };
  const normalizedSourceBinding = mutableNormalizedAuthority.sourceBindings[normalizedOperationIndex];
  assert(normalizedSourceBinding !== undefined, 'normalized-name-mismatch fixture must retain its detached source binding');
  normalizedSourceBinding.metadata = cloneJsonValue(normalizedOperation.metadata);
  freezeFixtureGraph(normalizedProgram);
  freezeFixtureGraph(normalizedAuthority);
  const normalizedPair = validateX4UiLayoutEvidencePair(normalizedProgram, normalizedAuthority);
  const normalizedStage = diagnoseX4UiSceneStructureForTest(normalizedProgram, normalizedAuthority);
  assert(normalizedPair.valid, `normalized-name-mismatch hostile must remain producer-pair valid: ${JSON.stringify(normalizedPair)}`);
  assert(normalizedStage?.startsWith(`unsupported-property:${normalizedOperation.id}`) === true, 'Scene must independently reject a forged normalized name before geometry');
});

test('B119 unavailable simple-default descriptor facts cannot forge omitted properties', () => {
  const projected = rawProjectionFor([
    'local menu = { name = "B119UnavailableDefaultProperties", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(1, { width = 100, reserveScrollBar = false, scaling = false })',
    'table:setDefaultCellProperties("editbox", {})',
    'frame:display()',
  ].join('\n'), 'selftest/b119-unavailable-default-properties.lua');
  assert(projected.program !== undefined && projected.result !== undefined && 'evidenceAuthority' in projected.result && projected.result.evidenceAuthority !== undefined, 'unavailable simple-default fixture must issue an evidence pair');
  const sourceOperation = projected.program.operations.find(operationNode => operationNode.kind === 'setDefaultCellProperties');
  assert(sourceOperation !== undefined && sourceOperation.kernel?.stateAfter !== undefined, 'unavailable simple-default fixture must retain its source operation');
  assert(JSON.stringify(Object.keys(sourceOperation.descriptorFacts).sort()) === JSON.stringify(['cellType']), 'simple-default descriptor facts must start with the required cellType key only');
  for (const [factName, expectedType] of [['height', 'number'], ['scaling', 'boolean']] as const) {
    const hostile = hostileEditBoxDefaultTransition(projected, 'setDefaultCellProperties', factName, unavailable(expectedType, `forged unavailable ${factName}`, source(405)), () => {});
    const hostileOperation = hostile.program.operations.find(operationNode => operationNode.kind === 'setDefaultCellProperties');
    assert(hostileOperation?.kernel?.stateAfter !== undefined && jsonEqual(sourceOperation.kernel.stateAfter, hostileOperation.kernel.stateAfter), `${factName} hostile fixture must leave the kernel state unchanged`);
    const pair = validateX4UiLayoutEvidencePair(hostile.program, hostile.authority);
    const stage = diagnoseX4UiSceneStructureForTest(hostile.program, hostile.authority);
    console.log(`B119 unavailable simple-default ${factName} hostile receipt: ${JSON.stringify({ pairValid: pair.valid, stage })}`);
    assert(pair.valid, `unavailable ${factName} hostile must remain producer-pair valid: ${JSON.stringify(pair)}`);
    assert(stage !== undefined, `unavailable ${factName} descriptor fact must be rejected when the source property was omitted`);
  }
});

test('B119 unavailable complex-default descriptor facts cannot forge omitted properties', () => {
  const projected = rawProjectionFor([
    'local menu = { name = "B119UnavailableComplexDefaultProperties", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(1, { width = 100, reserveScrollBar = false, scaling = false })',
    'table:setDefaultComplexCellProperties("editbox", "hotkey", {})',
    'frame:display()',
  ].join('\n'), 'selftest/b119-unavailable-complex-default-properties.lua');
  assert(projected.program !== undefined && projected.result !== undefined && 'evidenceAuthority' in projected.result && projected.result.evidenceAuthority !== undefined, 'unavailable complex-default fixture must issue an evidence pair');
  const sourceOperation = projected.program.operations.find(operationNode => operationNode.kind === 'setDefaultComplexCellProperties');
  assert(sourceOperation !== undefined && sourceOperation.kernel?.stateAfter !== undefined, 'unavailable complex-default fixture must retain its source operation');
  assert(JSON.stringify(Object.keys(sourceOperation.descriptorFacts).sort()) === JSON.stringify(['cellType', 'propertyName']), 'complex-default descriptor facts must start with the required cellType/propertyName keys only');
  for (const [factName, expectedType] of [['hotkey', 'string'], ['displayIcon', 'boolean']] as const) {
    const hostile = hostileEditBoxDefaultTransition(projected, 'setDefaultComplexCellProperties', factName, unavailable(expectedType, `forged unavailable ${factName}`, source(406)), () => {});
    const hostileOperation = hostile.program.operations.find(operationNode => operationNode.kind === 'setDefaultComplexCellProperties');
    assert(hostileOperation?.kernel?.stateAfter !== undefined && jsonEqual(sourceOperation.kernel.stateAfter, hostileOperation.kernel.stateAfter), `${factName} hostile fixture must leave the kernel state unchanged`);
    const pair = validateX4UiLayoutEvidencePair(hostile.program, hostile.authority);
    const stage = diagnoseX4UiSceneStructureForTest(hostile.program, hostile.authority);
    console.log(`B119 unavailable complex-default ${factName} hostile receipt: ${JSON.stringify({ pairValid: pair.valid, stage })}`);
    assert(pair.valid, `unavailable ${factName} hostile must remain producer-pair valid: ${JSON.stringify(pair)}`);
    assert(stage !== undefined, `unavailable ${factName} descriptor fact must be rejected when the source property was omitted`);
  }
});

test('B119 unavailable setHotkey displayIcon cannot forge an omitted property', () => {
  const projected = rawProjectionFor([
    'local menu = { name = "B119UnavailableSetHotkeyDisplayIcon", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(1, { width = 100, reserveScrollBar = false, scaling = false })',
    'local row = table:addRow(false, {})',
    'local edit = row[1]:createEditBox({ height = 25, scaling = false })',
    'edit:setHotkey("KEY")',
    'frame:display()',
  ].join('\n'), 'selftest/b119-unavailable-set-hotkey-display-icon.lua');
  assert(projected.program !== undefined && projected.result !== undefined && 'evidenceAuthority' in projected.result && projected.result.evidenceAuthority !== undefined, 'unavailable setHotkey fixture must issue an evidence pair');
  const program = cloneProgram(projected.program);
  const operation = program.operations.find(operationNode => operationNode.kind === 'setHotkey');
  const cell = operation?.cellId === undefined ? undefined : program.cells.find(cellNode => cellNode.id === operation.cellId);
  assert(operation !== undefined && operation.kernel?.stateAfter !== undefined && cell !== undefined, 'unavailable setHotkey fixture must retain its source operation and cell');
  assert(JSON.stringify(Object.keys(operation.descriptorFacts).sort()) === JSON.stringify(['hotkey']), 'setHotkey descriptor facts must start with the required hotkey key only');
  const displayIconFact = unavailable('boolean', 'forged unavailable displayIcon', operation.source);
  (operation.descriptorFacts as Record<string, X4UiLayoutDescriptorFact>).displayIcon = displayIconFact;
  (cell.descriptorFacts as Record<string, X4UiLayoutDescriptorFact>).displayIcon = unavailable('boolean', 'forged unavailable displayIcon', cell.source);
  const authority = synchronizedAuthority(projected.result.evidenceAuthority, program);
  freezeFixtureGraph(program);
  freezeFixtureGraph(authority);
  const pair = validateX4UiLayoutEvidencePair(program, authority);
  const stage = diagnoseX4UiSceneStructureForTest(program, authority);
  console.log(`B119 unavailable setHotkey displayIcon hostile receipt: ${JSON.stringify({ pairValid: pair.valid, stage })}`);
  assert(pair.valid, `unavailable setHotkey displayIcon hostile must remain producer-pair valid: ${JSON.stringify(pair)}`);
  assert(stage !== undefined, 'unavailable displayIcon descriptor fact must be rejected when the source property was omitted');
});

test('B119 edit-box producer descriptor facts reject arbitrary extra keys by operation kind', () => {
  const projected = rawProjectionFor([
    'local menu = { name = "B119ExtraDescriptorFacts", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(1, { width = 100, reserveScrollBar = false, scaling = false })',
    'table:setDefaultCellProperties("editbox", {})',
    'table:setDefaultComplexCellProperties("editbox", "hotkey", {})',
    'local row = table:addRow(false, {})',
    'local edit = row[1]:createEditBox({ height = 25, scaling = false })',
    'edit:setHotkey("KEY")',
    'frame:display()',
  ].join('\n'), 'selftest/b119-extra-descriptor-facts.lua');
  assert(projected.program !== undefined && projected.result !== undefined && 'evidenceAuthority' in projected.result && projected.result.evidenceAuthority !== undefined, 'extra descriptor-fact fixture must issue an evidence pair');
  const sourceAuthority = projected.result.evidenceAuthority;
  const cases = [
    ['setDefaultCellProperties', 'simple-default'],
    ['setDefaultComplexCellProperties', 'complex-default'],
    ['setHotkey', 'setHotkey'],
  ] as const;
  for (const [kind, label] of cases) {
    const program = cloneProgram(projected.program);
    const operation = program.operations.find(operationNode => operationNode.kind === kind);
    assert(operation !== undefined, `${label} extra-key fixture must retain its source operation`);
    (operation.descriptorFacts as Record<string, X4UiLayoutDescriptorFact>).forgedExtra = unavailable('string', `forged extra ${label} descriptor fact`, operation.source);
    const authority = synchronizedAuthority(sourceAuthority, program);
    freezeFixtureGraph(program);
    freezeFixtureGraph(authority);
    const pair = validateX4UiLayoutEvidencePair(program, authority);
    const stage = diagnoseX4UiSceneStructureForTest(program, authority);
    console.log(`B119 extra descriptor fact ${label} hostile receipt: ${JSON.stringify({ pairValid: pair.valid, stage })}`);
    assert(pair.valid, `${label} extra descriptor fact hostile must remain producer-pair valid: ${JSON.stringify(pair)}`);
    assert(stage !== undefined, `${label} arbitrary extra descriptor fact must be rejected by its closed producer key set`);
  }
});

test('B119 legitimate omitted edit-box producer properties remain accepted', () => {
  const projected = rawProjectionFor([
    'local menu = { name = "B119LegitimateOmittedProperties", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(1, { width = 100, reserveScrollBar = false, scaling = false })',
    'table:setDefaultCellProperties("editbox", {})',
    'table:setDefaultComplexCellProperties("editbox", "hotkey", {})',
    'local row = table:addRow(false, {})',
    'local edit = row[1]:createEditBox({ height = 12, scaling = false })',
    'edit:setHotkey("KEY")',
    'frame:display()',
  ].join('\n'), 'selftest/b119-legitimate-omitted-properties.lua');
  assert(projected.program !== undefined && projected.result !== undefined && 'evidenceAuthority' in projected.result && projected.result.evidenceAuthority !== undefined, 'legitimate omitted-property fixture must issue an evidence pair');
  const pair = validateX4UiLayoutEvidencePair(projected.program, projected.result.evidenceAuthority);
  assert(pair.valid, `legitimate omitted-property producer pair must validate: ${JSON.stringify(pair)}`);
  assert(diagnoseX4UiSceneStructureForTest(projected.program, projected.result.evidenceAuthority) === undefined, 'legitimate omitted producer properties must remain accepted');
  const sceneResult = buildX4UiScene(projected.result as X4UiLayoutProgramResult, corpus, projected.profile!);
  assert(sceneResult.status !== 'refused', `legitimate omitted producer properties must reach Scene: ${JSON.stringify(sceneResult)}`);
});

test('B119 explicit zero false and empty-string edit-box producer properties remain accepted', () => {
  const projected = rawProjectionFor([
    'local menu = { name = "B119ExplicitFalsyProperties", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(1, { width = 100, reserveScrollBar = false, scaling = false })',
    'table:setDefaultCellProperties("editbox", { height = 0, scaling = false })',
    'table:setDefaultComplexCellProperties("editbox", "hotkey", { hotkey = "", displayIcon = false })',
    'local row = table:addRow(false, {})',
    'local edit = row[1]:createEditBox({})',
    'edit:setHotkey("KEY", { displayIcon = false })',
    'frame:display()',
  ].join('\n'), 'selftest/b119-explicit-falsy-properties.lua');
  assert(projected.program !== undefined && projected.result !== undefined && 'evidenceAuthority' in projected.result && projected.result.evidenceAuthority !== undefined, 'explicit-falsy fixture must issue an evidence pair');
  const pair = validateX4UiLayoutEvidencePair(projected.program, projected.result.evidenceAuthority);
  assert(pair.valid, `explicit zero/false/empty-string producer pair must validate: ${JSON.stringify(pair)}`);
  assert(diagnoseX4UiSceneStructureForTest(projected.program, projected.result.evidenceAuthority) === undefined, 'explicit zero/false/empty-string producer properties must remain accepted');
  const sceneResult = buildX4UiScene(projected.result as X4UiLayoutProgramResult, corpus, projected.profile!);
  assert(sceneResult.status !== 'refused', `explicit zero/false/empty-string producer properties must reach Scene: ${JSON.stringify(sceneResult)}`);
});

const pairInvalidProgram = (
  program: X4UiLayoutProgram,
  sourceResult: X4UiLayoutProgramResult,
  profile: X4UiSceneProfile,
  corpusAssets: X4UiCorpusCanonicalSuccess,
  label: string,
): X4UiSceneResult => {
  let valid = false;
  try {
    valid = validateX4UiLayoutEvidencePair(program, producerAuthority(sourceResult)).valid;
  } catch {
    valid = false;
  }
  assert(!valid, `${label} mutation unexpectedly remains pair-valid; use a scene-local mutation helper instead`);
  return buildX4UiScene({ ...sourceResult, program } as X4UiLayoutProgramResult, corpusAssets, profile);
};

const sceneFromRaw = (
  sourceText: string,
  sourcePath: string,
  profileUpdate?: (profile: X4UiSceneProfile, program: X4UiLayoutProgram) => X4UiSceneProfile,
): X4UiScene => {
  const projected = rawProjectionFor(sourceText, sourcePath);
  assert(projected.result !== undefined && 'program' in projected.result && projected.program !== undefined && projected.profile !== undefined, `raw scene fixture did not produce a successful result: ${sourcePath}`);
  const profile = profileUpdate === undefined ? projected.profile : profileUpdate(projected.profile, projected.program);
  return sceneOf(buildX4UiScene(projected.result as X4UiLayoutProgramResult, corpus, profile));
};

const sceneFromRawWithColor = (
  sourceText: string,
  sourcePath: string,
  producerProfileUpdate?: (
    profile: Parameters<typeof projectX4UiLayoutProgram>[2],
  ) => Parameters<typeof projectX4UiLayoutProgram>[2],
): X4UiScene => {
  const projected = rawProjectionFor(sourceText, sourcePath, producerProfileUpdate, p3ColorAuthority);
  assert(projected.result !== undefined && 'program' in projected.result && projected.program !== undefined && projected.profile !== undefined, `raw color scene fixture did not produce a successful result: ${sourcePath}`);
  return sceneOf(buildX4UiScene(projected.result as X4UiLayoutProgramResult, corpus, projected.profile));
};

const rawSceneProjection = (sourceText: string, sourcePath: string): { readonly scene: X4UiScene; readonly program: X4UiLayoutProgram } => {
  const projected = rawProjectionFor(sourceText, sourcePath);
  assert(projected.result !== undefined && 'program' in projected.result && projected.program !== undefined && projected.profile !== undefined, `raw scene projection did not produce a successful result: ${sourcePath}`);
  return {
    scene: sceneOf(buildX4UiScene(projected.result as X4UiLayoutProgramResult, corpus, projected.profile)),
    program: projected.program,
  };
};

const rawTextScene = (
  name: string,
  content: string,
  textOptions: string,
  profileUpdate?: (profile: X4UiSceneProfile) => X4UiSceneProfile,
): X4UiScene => {
  const projected = rawProjectionFor([
    `local menu = { name = "${name}", layer = 1 }`,
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(1, { width = 40, reserveScrollBar = false })',
    'table:setColWidth(1, 40, false)',
    'local row = table:addRow(false, {})',
    `row[1]:createText(${JSON.stringify(content)}, { ${textOptions} })`,
    'frame:display()',
  ].join('\n'), `selftest/raw-text-${name}.lua`);
  assert(projected.result !== undefined && 'program' in projected.result && projected.program !== undefined && projected.profile !== undefined, `${name} text source must produce a real result`);
  const profile = profileUpdate === undefined ? projected.profile : profileUpdate(projected.profile);
  return sceneOf(buildX4UiScene(projected.result as X4UiLayoutProgramResult, corpus, profile));
};

const removeOperation = (program: X4UiLayoutProgram, operationId: string): void => {
  (program.operations as unknown as X4UiLayoutOperation[]).splice(
    0,
    program.operations.length,
    ...program.operations.filter(operationNode => operationNode.id !== operationId),
  );
  for (const node of [...program.frames, ...program.tables, ...program.rows, ...program.cells]) {
    (node.operationIds as unknown as string[]).splice(
      0,
      node.operationIds.length,
      ...node.operationIds.filter(id => id !== operationId),
    );
    if ('metadataOperationIds' in node) {
      (node.metadataOperationIds as unknown as string[]).splice(
        0,
        node.metadataOperationIds.length,
        ...node.metadataOperationIds.filter(id => id !== operationId),
      );
    }
  }
};

const sceneWithFinalizedColumns = (
  fixture: Fixture,
  widths: readonly number[],
  percent: boolean,
): X4UiScene => {
  const program = cloneProgram(fixture.program);
  const table = program.tables[0];
  const tableOperation = program.operations.find(operationNode => operationNode.id === 'op:table')!;
  const initial = tableOperation.kernel?.stateAfter;
  if (!initial) throw new Error('column fixture requires the addTable kernel state');
  const widthOperations = program.operations.filter(operationNode => operationNode.id.startsWith('op:width:'));
  const widthIds = new Set(widthOperations.map(operationNode => operationNode.id));
  (program.operations as unknown as X4UiLayoutOperation[]).splice(0, program.operations.length, ...program.operations.filter(operationNode => !widthIds.has(operationNode.id)));
  (table.operationIds as unknown as string[]).splice(0, table.operationIds.length, ...table.operationIds.filter(id => !widthIds.has(id)));
  const initialState = cloneKernelState(initial);
  (initialState.properties as unknown as { reserveScrollBar: boolean }).reserveScrollBar = false;
  (tableOperation as unknown as { kernel: { stateAfter: HelperTableState } }).kernel.stateAfter = initialState;
  let state = cloneKernelState(initialState);
  for (let index = 0; index < widths.length; index += 1) {
    const column = index + 1;
    const result = percent ? setColWidthPercent(state, column, widths[index]) : setColWidth(state, column, widths[index], false);
    const after = unwrap(result);
    const at = source(32 + index * 4);
    const widthOperation = operation(`op:width:${column}`, percent ? 'setColWidthPercent' : 'setColWidth', at, table.id, '', '');
    delete (widthOperation as unknown as { rowId?: string }).rowId;
    delete (widthOperation as unknown as { cellId?: string }).cellId;
    (widthOperation as unknown as { kernel: unknown }).kernel = { stateBefore: state, stateAfter: after };
    (program.operations as unknown as X4UiLayoutOperation[]).push(widthOperation);
    (table.operationIds as unknown as string[]).push(widthOperation.id);
    state = after;
  }
  const producers = program.operations
    .filter(operationNode => ['addRow', 'setColSpan', 'createText', 'createEditBox', 'createButton', 'createIcon'].includes(operationNode.kind))
    .sort((left, right) => left.modelOrder - right.modelOrder);
  for (const operationNode of producers) {
    const transition = operationNode.kernel;
    if (!transition?.stateAfter) continue;
    const rowIndex = operationNode.rowId === undefined ? undefined : program.rows.find(row => row.id === operationNode.rowId)?.rowIndex;
    let after: HelperTableState;
    if (operationNode.kind === 'addRow') {
      const rowState = transition.stateAfter.rows[state.rows.length];
      if (!rowState) throw new Error(`missing row source for ${operationNode.id}`);
      after = unwrap(addRow(state, {
        groupIndex: rowState.groupIndex,
        fixed: rowState.fixed,
        borderBelow: rowState.borderBelow,
        paddingTop: rowState.paddingTop,
        paddingBottom: rowState.paddingBottom,
        scaling: rowState.scaling,
      }));
    } else if (operationNode.kind === 'setColSpan') {
      if (rowIndex === undefined || operationNode.cellId === undefined) throw new Error(`missing span owner for ${operationNode.id}`);
      const cell = program.cells.find(candidate => candidate.id === operationNode.cellId);
      const span = operationNode.descriptorFacts.span;
      if (!cell || span?.status !== 'known' || span.expectedType !== 'number') throw new Error(`missing span fact for ${operationNode.id}`);
      after = unwrap(setCellColSpan(state, rowIndex, cell.column, span.value as number));
    } else {
      if (rowIndex === undefined || operationNode.cellId === undefined) throw new Error(`missing specialization owner for ${operationNode.id}`);
      const cell = program.cells.find(candidate => candidate.id === operationNode.cellId);
      const sourceCell = transition.stateAfter.rows[rowIndex - 1]?.cells[cell?.column === undefined ? -1 : cell.column - 1];
      if (!cell || !sourceCell || !['text', 'button', 'editbox', 'icon'].includes(sourceCell.type)) throw new Error(`missing specialization source for ${operationNode.id}`);
      after = unwrap(specializeCell(state, rowIndex, cell.column, {
        type: sourceCell.type as 'text' | 'button' | 'editbox' | 'icon',
        y: sourceCell.y,
        height: sourceCell.height,
        scaling: sourceCell.scaling,
        affectRowHeight: sourceCell.affectRowHeight,
        minTextHeight: sourceCell.minTextHeight,
      }));
    }
    (operationNode as unknown as { kernel: { stateBefore: HelperTableState; stateAfter: HelperTableState } }).kernel = { stateBefore: state, stateAfter: after };
    state = after;
  }
  (table as unknown as { kernelState: HelperTableState; height: { status: 'known'; value: number } }).kernelState = state;
  (table as unknown as { height: { status: 'known'; value: number } }).height = { status: 'known', value: unwrap(getFullTableHeight(state)) };
  (table.descriptorFacts as Record<string, X4UiLayoutDescriptorFact>).maxVisibleHeight = known(100, 'number', table.source);
  (table.descriptorFacts as Record<string, X4UiLayoutDescriptorFact>).reserveScrollBar = known(state.properties.reserveScrollBar, 'boolean', table.source);
  (table.descriptorFacts as Record<string, X4UiLayoutDescriptorFact>).finalWidth = known(state.properties.width, 'number', table.source);
  syncFixtureKernelChain(program, fixture.program);
  refreshProgramKernelProjection(program);
  return sceneOf(sceneFor(fixture, program));
};

const refusalHasNoScene = (result: X4UiSceneResult): boolean =>
  result.status === 'refused' && !('scene' in result);

const makeDiscreteOverflowProgram = (fixture: Fixture): X4UiLayoutProgram => {
  const program = cloneProgram(fixture.program);
  const table = program.tables[0];
  let state = table.kernelState!;
  (state.rows[0] as unknown as { fixed: boolean }).fixed = true;
  (state.rows[1] as unknown as { fixed: boolean }).fixed = false;
  const beforeExtraRows = cloneKernelState(state);
  state = unwrap(addRow(state, { paddingTop: 1, paddingBottom: 1, borderBelow: false, fixed: false, scaling: false }));
  const afterRowThree = cloneKernelState(state);
  state = unwrap(addRow(state, { paddingTop: 1, paddingBottom: 1, borderBelow: false, fixed: false, scaling: false }));
  state = JSON.parse(JSON.stringify(state)) as HelperTableState;
  (table as unknown as { kernelState: HelperTableState; height: { status: 'known'; value: number } }).kernelState = state;
  (table as unknown as { height: { status: 'known'; value: number } }).height = { status: 'known', value: unwrap(getFullTableHeight(state)) };
  (program.rows[0] as unknown as { kernelState: HelperTableState['rows'][number] }).kernelState = state.rows[0];
  (program.rows[1] as unknown as { kernelState: HelperTableState['rows'][number] }).kernelState = state.rows[1];
  (table.descriptorFacts as Record<string, X4UiLayoutDescriptorFact>).maxVisibleHeight = known(25, 'number', table.source);
  (program.rows[0].descriptorFacts as Record<string, X4UiLayoutDescriptorFact>).fixed = known(true, 'boolean', program.rows[0].source);
  (program.rows[1].descriptorFacts as Record<string, X4UiLayoutDescriptorFact>).fixed = known(false, 'boolean', program.rows[1].source);
  for (const [id, rowIndex, height, offset] of [
    ['row:three', 3, 1, 380],
    ['row:four', 4, 20, 400],
  ] as const) {
    const rowSource = source(offset);
    const row: X4UiLayoutRowNode = {
      id,
      source: rowSource,
      tableId: table.id,
      rowIndex,
      cellIds: [],
      operationIds: [],
      kernelState: state.rows[rowIndex - 1],
      height: { status: 'known', value: height },
      descriptorFacts: {
        paddingTop: known(1, 'number', rowSource),
        paddingBottom: known(1, 'number', rowSource),
        borderBelow: known(false, 'boolean', rowSource),
        fixed: known(false, 'boolean', rowSource),
      },
      status: 'projected',
    };
    (program.rows as unknown as X4UiLayoutRowNode[]).push(row);
    (table.rowIds as unknown as string[]).push(id);
    appendKernelSlotCells(program, state, id, rowIndex, offset + 1);
  }
  (state.rows[3].cells[0] as unknown as { height: number }).height = 20;
  const rowFourFirstCell = program.cells.find(cell => cell.id === 'cell:row:four:slot:1');
  if (rowFourFirstCell) (rowFourFirstCell as unknown as { height: { status: 'known'; value: number } }).height = { status: 'known', value: 20 };
  (table as unknown as { height: { status: 'known'; value: number } }).height = { status: 'known', value: unwrap(getFullTableHeight(state)) };
  for (const [id, rowIndex, offset, stateBefore, stateAfter] of [
    ['op:row3', 3, 380, beforeExtraRows, afterRowThree],
    ['op:row4', 4, 400, afterRowThree, state],
  ] as const) {
    const row = program.rows.find(candidate => candidate.rowIndex === rowIndex);
    if (!row) throw new Error(`missing generated row operation ${id}`);
    const rowOperation = operation(id, 'addRow', source(offset), table.id, row.id, '');
    (rowOperation as unknown as { kernel: unknown }).kernel = { stateBefore, stateAfter };
    (program.operations as unknown as X4UiLayoutOperation[]).push(rowOperation);
    (table.operationIds as unknown as string[]).push(id);
    (row.operationIds as unknown as string[]).push(id);
  }
  syncFixtureKernelChain(program, fixture.program);
  refreshProgramKernelProjection(program);
  return program;
};

const appendKernelSlotCells = (
  program: X4UiLayoutProgram,
  state: HelperTableState,
  rowId: string,
  rowIndex: number,
  sourceOffset: number,
): void => {
  const rowState = state.rows[rowIndex - 1];
  const row = program.rows.find(candidate => candidate.id === rowId);
  if (!row || !rowState) throw new Error(`missing generated row ${rowId}`);
  const cells = program.cells as X4UiLayoutCellNode[];
  const ids: string[] = [];
  rowState.cells.forEach((cellState, index) => {
    const column = index + 1;
    const cellId = `cell:${rowId}:slot:${column}`;
    const cellSource = source(sourceOffset + index);
    ids.push(cellId);
    const cellHeight = getCellHeight(state, rowIndex, column);
    if (cellHeight.status !== 'ok') throw new Error(`missing generated cell height ${cellId}`);
    cells.push({
      id: cellId,
      source: cellSource,
      tableId: row.tableId,
      rowId,
      rowIndex,
      column,
      operationIds: [],
      metadataOperationIds: [],
      kernelState: cellState,
      spanWidth: { status: 'known', value: state.columns[index].width },
      height: { status: 'known', value: cellState.colspan === 0 ? 0 : cellHeight.value },
      descriptorFacts: cellFacts('cell', cellSource, {
        span: known(cellState.colspan, 'number', cellSource),
        outerWidth: unavailable('number', 'generated kernel slot has no widget outer width', cellSource),
        outerHeight: unavailable('number', 'generated kernel slot has no widget outer height', cellSource),
      }),
      status: 'projected',
    });
  });
  (row.cellIds as unknown as string[]).push(...ids);
};

const makeFixedOverflowContinuationProgram = (fixture: Fixture, visibleHeight: number): X4UiLayoutProgram => {
  const program = makeDiscreteOverflowProgram(fixture);
  const table = program.tables[0];
  const state = table.kernelState!;
  (state.rows[0] as unknown as { fixed: boolean }).fixed = true;
  (state.rows[1] as unknown as { fixed: boolean }).fixed = true;
  (program.rows[0].descriptorFacts as Record<string, X4UiLayoutDescriptorFact>).fixed = known(true, 'boolean', program.rows[0].source);
  (program.rows[1].descriptorFacts as Record<string, X4UiLayoutDescriptorFact>).fixed = known(true, 'boolean', program.rows[1].source);
  (state.rows[1].cells[0] as unknown as { height: number }).height = 20;
  for (const cell of program.cells.filter(candidate => candidate.rowId === program.rows[1].id)) {
    (cell as unknown as { kernelState: HelperTableState['rows'][number]['cells'][number] }).kernelState = state.rows[1].cells[cell.column - 1];
  }
  const tallCell = program.cells.find(candidate => candidate.id === 'cell:hidden');
  if (tallCell) (tallCell as unknown as { height: X4UiLayoutCellNode['height'] }).height = { status: 'known', value: 20 };
  (program.rows[1] as unknown as { height: { status: 'known'; value: number } }).height = { status: 'known', value: 20 };
  (table as unknown as { height: { status: 'known'; value: number } }).height = { status: 'known', value: unwrap(getFullTableHeight(state)) };
  (table.descriptorFacts as Record<string, X4UiLayoutDescriptorFact>).maxVisibleHeight = known(visibleHeight, 'number', table.source);
  syncFixtureKernelChain(program, fixture.program);
  refreshProgramKernelProjection(program);
  return program;
};

const makeGroupedFixedBoundaryProgram = (fixture: Fixture, visibleHeight: number): X4UiLayoutProgram => {
  const program = makeDiscreteOverflowProgram(fixture);
  const table = program.tables[0];
  const state = table.kernelState!;
  (state.rows[0] as unknown as { fixed: boolean }).fixed = true;
  (state.rows[1] as unknown as { fixed: boolean }).fixed = true;
  (program.rows[0].descriptorFacts as Record<string, X4UiLayoutDescriptorFact>).fixed = known(true, 'boolean', program.rows[0].source);
  (program.rows[1].descriptorFacts as Record<string, X4UiLayoutDescriptorFact>).fixed = known(true, 'boolean', program.rows[1].source);
  (table as unknown as { height: { status: 'known'; value: number } }).height = { status: 'known', value: unwrap(getFullTableHeight(state)) };
  (table.descriptorFacts as Record<string, X4UiLayoutDescriptorFact>).maxVisibleHeight = known(visibleHeight, 'number', table.source);
  syncFixtureKernelChain(program, fixture.program);
  refreshProgramKernelProjection(program);
  return program;
};

const makeSourceAcceptanceLedgerProgram = (fixture: Fixture, grouped: boolean): X4UiLayoutProgram => {
  const program = cloneProgram(fixture.program);
  const table = program.tables[0];
  const state = table.kernelState!;
  const rowHeight = program.rows[0].height?.status === 'known' ? program.rows[0].height.value : undefined;
  assert(rowHeight !== undefined, 'source-acceptance fixture requires a known first-row height');
  const mutableState = state as unknown as { rowGroups: HelperTableState['rowGroups']; rows: HelperTableState['rows'] };
  mutableState.rowGroups = grouped ? [{ level: 2 }] : [];
  for (const row of mutableState.rows) {
    (row as unknown as { fixed: boolean }).fixed = false;
    if (grouped) (row as unknown as { groupIndex: number }).groupIndex = 1;
    else delete (row as unknown as { groupIndex?: number }).groupIndex;
  }
  for (const row of program.rows) {
    (row.descriptorFacts as Record<string, X4UiLayoutDescriptorFact>).fixed = known(false, 'boolean', row.source);
    if (row.kernelState) {
      (row.kernelState as unknown as { fixed: boolean }).fixed = false;
      if (grouped) (row.kernelState as unknown as { groupIndex: number }).groupIndex = 1;
      else delete (row.kernelState as unknown as { groupIndex?: number }).groupIndex;
    }
  }
  (table.descriptorFacts as Record<string, X4UiLayoutDescriptorFact>).maxVisibleHeight = known(rowHeight, 'number', table.source);
  (table as unknown as { height: { status: 'known'; value: number } }).height = { status: 'known', value: unwrap(getFullTableHeight(state)) };
  syncFixtureKernelChain(program, fixture.program);
  refreshProgramKernelProjection(program);
  return program;
};

void syncKernelCell;
void sceneWithFinalizedColumns;
void makeFixedOverflowContinuationProgram;
void makeGroupedFixedBoundaryProgram;
void makeSourceAcceptanceLedgerProgram;

test('fail-first: an unissued coordinated LayoutProgram/evidence clone must refuse before geometry', () => {
  const issued = rawProducerProjection.result;
  assert(issued !== undefined && 'program' in issued && issued.program !== undefined && 'evidenceAuthority' in issued && issued.evidenceAuthority !== undefined, 'issued control result is required');
  const clonedProgram = cloneProgram(issued.program);
  const clonedAuthority = synchronizedAuthority(issued.evidenceAuthority, clonedProgram);
  freezeFixtureGraph(clonedProgram);
  freezeFixtureGraph(clonedAuthority);
  const pair = validateX4UiLayoutEvidencePair(clonedProgram, clonedAuthority);
  assert(pair.valid, `coordinated clone must remain semantically pair-valid for the issuance gate receipt: ${JSON.stringify(pair)}`);
  const result = buildX4UiScene(
    { ...issued, program: clonedProgram, evidenceAuthority: clonedAuthority } as X4UiLayoutProgramResult,
    corpus,
    rawProducerProjection.profile!,
  );
  assert(result.status === 'refused', `unissued coordinated pair escaped Scene: ${JSON.stringify(result)}`);
});

test('rejects an unissued hostile color descriptor without executing its getter', () => {
  const issued = rawProducerProjection.result;
  assert(issued !== undefined && 'program' in issued && issued.program !== undefined && 'evidenceAuthority' in issued && issued.evidenceAuthority !== undefined, 'issued control result is required');
  const hostileProgram = cloneProgram(issued.program);
  const hostileAuthority = synchronizedAuthority(issued.evidenceAuthority, hostileProgram);
  const facts = hostileProgram.cells[0]!.descriptorFacts as Record<string, unknown>;
  let getterExecutions = 0;
  Object.defineProperty(facts, 'color', {
    configurable: true,
    enumerable: true,
    get: () => {
      getterExecutions += 1;
      throw new Error('hostile color getter executed');
    },
  });
  const result = buildX4UiScene(
    { ...issued, program: hostileProgram, evidenceAuthority: hostileAuthority } as X4UiLayoutProgramResult,
    corpus,
    rawProducerProjection.profile!,
  );
  assert(result.status === 'refused' && getterExecutions === 0, `hostile color descriptor must refuse before getter execution: ${JSON.stringify({ result, getterExecutions })}`);
});

test('projects issued P3 color facts to exact Scene owners while retaining residual uncertainty', () => {
  const colorResult = colorProjection.result;
  const colorProgram = colorProjection.program;
  const colorProfile = colorProjection.profile;
  assert(colorResult !== undefined && 'program' in colorResult && colorResult.program !== undefined && 'evidenceAuthority' in colorResult && colorResult.evidenceAuthority !== undefined && colorProgram !== undefined && colorProfile !== undefined, 'issued P3 color projection is required');
  const pair = validateX4UiLayoutEvidencePair(colorProgram, colorResult.evidenceAuthority);
  assert(pair.valid, `P3 color producer pair must be semantically valid before Scene: ${JSON.stringify(pair)}`);
  const result = buildX4UiScene(colorResult, corpus, colorProfile);
  assert(result.status !== 'refused', `issued known color facts must reach Scene: ${JSON.stringify(result)}`);
  const scene = result.scene;
  const table = scene.tables.find(candidate => candidate.source.start.offset === colorProgram.tables[0].source.start.offset);
  const literalCell = scene.cells.find(candidate => candidate.source.start.offset === colorProgram.cells.find(cell => cell.column === 1)!.source.start.offset);
  const literalText = scene.texts.find(candidate => candidate.content === 'literal');
  const button = scene.widgets.find(candidate => candidate.kind === 'button');
  const buttonPrimary = scene.texts.find(candidate => candidate.content === 'primary');
  const buttonSecondary = scene.texts.find(candidate => candidate.content === 'secondary');
  const editbox = scene.widgets.find(candidate => candidate.kind === 'editbox');
  const editboxText = editbox === undefined ? undefined : scene.texts.find(candidate => candidate.widgetId === editbox.id && candidate.slot === 'primary');
  const icon = scene.widgets.find(candidate => candidate.kind === 'icon');
  assert(table !== undefined && literalCell !== undefined && literalText !== undefined && button !== undefined && buttonPrimary !== undefined && buttonSecondary !== undefined && editbox !== undefined && editboxText !== undefined && icon !== undefined, 'P3 color owners must be projected');
  const sourceColor = (fact: X4UiLayoutDescriptorFact | undefined, label: string) => {
    if (!fact || fact.status !== 'known' || fact.expectedType !== 'color-object') throw new Error(`${label} producer color fact must be known`);
    return fact;
  };
  const operationColor = (kind: string, field: string) => {
    const operationNode = colorProgram.operations.find(candidate => candidate.kind === kind);
    assert(operationNode !== undefined, `${kind} operation must be present for ${field}`);
    return sourceColor(operationNode.descriptorFacts[field], `${kind}.${field}`);
  };
  const expectColorFact = (
    node: { readonly colorFacts?: readonly X4UiSceneColorFact[] },
    field: string,
    slot: X4UiSceneColorFact['slot'],
    producerFact: X4UiLayoutDescriptorFact,
    label: string,
  ): X4UiSceneColorFact => {
    const expected = sourceColor(producerFact, label);
    const actual = node.colorFacts?.find(fact => fact.field === field);
    assert(actual !== undefined, `${label} must be attached to its exact Scene owner`);
    assert(actual.field === field && actual.slot === slot, `${label} field/slot must remain exact`);
    assert(actual.domain === expected.value.domain && actual.provenance === expected.provenance, `${label} domain/provenance must remain exact`);
    assert(actual.expression === expected.expression && isDeepStrictEqual(actual.value, expected.value), `${label} expression/full value must remain exact: ${JSON.stringify({ actualExpression: actual.expression, expectedExpression: expected.expression, actualValue: actual.value, expectedValue: expected.value })}`);
    assert(isDeepStrictEqual(actual.source, expected.source), `${label} source must remain exact`);
    assert((actual.sourcePin === undefined) === (expected.sourcePin === undefined) && isDeepStrictEqual(actual.sourcePin, expected.sourcePin), `${label} optional sourcePin presence/value must remain exact`);
    assert((actual.sampleId === undefined) === (expected.sampleId === undefined) && actual.sampleId === expected.sampleId, `${label} optional sampleId presence/value must remain exact`);
    assert(actual.gameVerification === X4_UI_SCENE_GAME_TRUTH, `${label} must retain Not verified in game`);
    assert(Object.isFrozen(actual) && Object.isFrozen(actual.value) && Object.isFrozen(actual.source), `${label} must be immutable`);
    assert(actual.value !== expected.value && actual.source !== expected.source && actual.source.start !== expected.source.start && actual.source.end !== expected.source.end, `${label} source/value data must be detached from producer evidence`);
    const actualValue = actual.value as unknown as Record<string, unknown>;
    const expectedValue = expected.value as unknown as Record<string, unknown>;
    for (const nestedKey of ['declarationSource', 'channels', 'baseSource', 'mappingSource', 'sourceIdentities']) {
      if (expectedValue[nestedKey] !== undefined) assert(actualValue[nestedKey] !== expectedValue[nestedKey], `${label} nested ${nestedKey} must be detached`);
    }
    return actual;
  };
  const tableSource = colorProgram.tables[0];
  const literalCellSource = colorProgram.cells.find(cell => cell.column === 1);
  assert(tableSource !== undefined && literalCellSource !== undefined, 'P3 producer table/cell owners are required');
  expectColorFact(table, 'backgroundColor', 'table-background', sourceColor(tableSource.descriptorFacts.backgroundColor, 'table.backgroundColor'), 'table.backgroundColor');
  expectColorFact(literalCell, 'cellbgcolor', 'cell-background', sourceColor(literalCellSource.descriptorFacts.cellbgcolor, 'cell.cellbgcolor'), 'cell.cellbgcolor');
  expectColorFact(literalText, 'color', 'primary-text', sourceColor(literalCellSource.descriptorFacts.color, 'text.color'), 'direct text color');
  expectColorFact(button, 'bgcolor', 'widget-background', operationColor('createButton', 'bgcolor'), 'button.bgcolor');
  expectColorFact(button, 'highlightcolor', 'widget-highlight', operationColor('createButton', 'highlightcolor'), 'button.highlightcolor');
  expectColorFact(button, 'bordercolor', 'widget-border', operationColor('createButton', 'bordercolor'), 'button.bordercolor');
  expectColorFact(buttonPrimary, 'color', 'primary-text', operationColor('setText', 'color'), 'button setText color');
  expectColorFact(buttonSecondary, 'color', 'secondary-text', operationColor('setText2', 'color'), 'button setText2 color');
  expectColorFact(editbox, 'bgcolor', 'widget-background', operationColor('createEditBox', 'bgcolor'), 'editbox.bgcolor');
  expectColorFact(editbox, 'editboxBackgroundBlackColor', 'editbox-inner-background', operationColor('createEditBox', 'editboxBackgroundBlackColor'), 'editbox black inner color');
  expectColorFact(editboxText, 'defaultTextColor', 'primary-text', operationColor('createEditBox', 'defaultTextColor'), 'editbox defaultText color');
  expectColorFact(icon, 'color', 'widget-icon', operationColor('createIcon', 'color'), 'icon.color');
  assert(table.colorFacts?.length === 1 && literalCell.colorFacts?.length === 1 && literalText.colorFacts?.length === 1, 'single-owner table/cell/direct-text facts must not be duplicated');
  assert(button.colorFacts?.length === 3 && buttonPrimary.colorFacts?.length === 1 && buttonSecondary.colorFacts?.length === 1 && editbox.colorFacts?.length === 2 && editboxText.colorFacts?.length === 1 && icon.colorFacts?.length === 1, 'widget/text owners must retain only their mapped facts');
  assert(editboxText.content === '' && editboxText.defaultContent === 'Placeholder' && editboxText.contentSelection === 'preview-default' && editboxText.layout !== undefined && editboxText.lines[0]?.displayedText === 'Placeholder', `inactive-empty edit-box must layout source defaultText through a distinct preview selection: ${JSON.stringify({ content: editboxText.content, defaultContent: editboxText.defaultContent, selection: editboxText.contentSelection, layout: editboxText.layout !== undefined, firstLine: editboxText.lines[0]?.displayedText, colorFacts: editboxText.colorFacts })}`);
  assert(literalText.colorFacts?.[0]?.domain === 'source-literal-percent-alpha' && (literalText.colorFacts[0].value as { readonly a: number }).a === 45.5, 'source literal alpha domain must remain percent-alpha');
  assert(table.colorFacts?.[0]?.domain === 'canonical-xml-byte-alpha' && (table.colorFacts[0].value as { readonly a: number }).a === 44, 'canonical default alpha domain must remain byte-alpha');
  const knownColorGap = (node: { readonly diagnosticLinks: readonly string[] } | undefined): boolean => node?.diagnosticLinks.some(id => scene.gaps.find(gap => gap.id === id)?.reason.startsWith('known base color tint') === true) === true;
  assert(scene.status === 'partial' && knownColorGap(table) && knownColorGap(literalCell) && knownColorGap(literalText) && knownColorGap(button) && knownColorGap(buttonPrimary) && knownColorGap(buttonSecondary) && knownColorGap(editbox) && knownColorGap(editboxText) && knownColorGap(icon), 'known tint facts must retain separate residual uncertainty and prevent false node completeness');
  assert(scene.gaps.some(gap => gap.previewOnly === true && gap.nodeId === editbox.id && gap.reason.includes('live direct-input activity')), 'inactive-empty edit-box selection must retain a preview-only widget state/runtime gap');
  const residualReason = scene.gaps.find(gap => gap.reason.startsWith('known base color tint'))?.reason || '';
  assert(['material/texture/glow', 'active/inactive/hover/selection', 'C++ effective color map/profile/daltonization', 'font raster color behavior', 'game-frame acceptance'].every(fragment => residualReason.includes(fragment)), 'known tint must not imply material, state, glow, font, C++, or game truth');
  assert(!scene.gaps.some(gap => gap.reason.includes('engine color fact')), 'known color facts must remove the legacy blanket unavailable-color gap');
  assert(scene.gameTruth === X4_UI_SCENE_GAME_TRUTH && scene.verification.gameVerified === false, 'color evidence must retain game truth');
});

test('fail-first: bounded table width separates Scene color authority from backgroundID applicability', () => {
  const projected = boundedCompositionProjection.result;
  const program = boundedCompositionProjection.program;
  const profile = boundedCompositionProjection.profile;
  assert(projected !== undefined && 'program' in projected && projected.program !== undefined && 'evidenceAuthority' in projected && projected.evidenceAuthority !== undefined && program !== undefined && profile !== undefined, 'bounded composition producer projection is required');
  const result = buildX4UiScene(projected as X4UiLayoutProgramResult, corpus, profile);
  assert(result.status !== 'refused', `bounded composition must cross the Scene boundary: ${JSON.stringify(result)}`);
  const active = result.scene.tables.find(table => table.source.start.offset === program.tables[0]?.source.start.offset);
  const empty = result.scene.tables.find(table => table.source.start.offset === program.tables[1]?.source.start.offset);
  assert(active !== undefined && empty !== undefined, 'bounded composition must retain both table owners');
  assert(active.rect?.x === 8 && active.rect.y === 4 && active.rect.width === 24 && active.columns?.[0]?.width === 24, `explicit active table bounds must survive Scene columns: ${JSON.stringify({ rect: active.rect, columns: active.columns })}`);
  assert(empty.rect?.x === 50 && empty.rect.y === 4 && empty.rect.width === 18 && empty.columns?.[0]?.width === 18, `explicit empty table bounds must survive Scene columns: ${JSON.stringify({ rect: empty.rect, columns: empty.columns })}`);
  assert(active.colorFacts?.some(fact => fact.slot === 'table-background') === true, 'nonempty backgroundID must retain the accepted table-background fact');
  assert(empty.colorFacts?.some(fact => fact.slot === 'table-background') === true, 'empty backgroundID must retain the accepted table-background authority fact');
  assert(active.backgroundId === 'solid' && Object.hasOwn(active, 'backgroundId'), `active table must retain the exact known backgroundID applicability: ${JSON.stringify({ backgroundId: active.backgroundId, keys: Object.keys(active) })}`);
  assert(empty.backgroundId === '' && Object.hasOwn(empty, 'backgroundId'), `empty table must retain the exact known empty backgroundID applicability: ${JSON.stringify({ backgroundId: empty.backgroundId, keys: Object.keys(empty) })}`);
  assert(active.provenanceLinks.some(link => link.kind === 'descriptor-fact' && link.fact === 'backgroundID')
    && empty.provenanceLinks.some(link => link.kind === 'descriptor-fact' && link.fact === 'backgroundID'), 'known backgroundID applicability must retain descriptor provenance on both table owners');
});

test('projects frame/table offsets, scrollbar, border-separated columns, rows, and hidden colspan', () => {
  const fixture = makeFixture();
  const scene = sceneOf(sceneFor(fixture));
  const table = scene.tables[0];
  assert(table.descriptorHasScrollBar === true, `expected the helper descriptor projection to require a scrollbar: ${JSON.stringify({ has: table.descriptorHasScrollBar, visible: table.visibleHeight, rect: table.rect, rows: scene.rows.map(row => ({ id: row.id, fixed: row.fixed, rect: row.rect, natural: row.naturalRect, visible: row.visible })) })}`);
  assert(table.scrollbarEvidence?.runtime === 'unavailable', 'runtime scrollbar truth must remain unavailable');
  assert(table.visibleHeight === 20, `expected visible height 20, got ${String(table.visibleHeight)}`);
  const fixedColumns = table.fixedColumns!;
  const columns = table.columns!;
  assert(fixedColumns[3].fixedWidth === columns[3].width + metrics.scrollbarWidth, 'fixed-row last column must receive the scrollbar reserve exactly once');
  const fixedLast = scene.cells.find(cell => cell.rowIndex === 2 && cell.column === 4);
  assert(fixedLast?.rect?.width === fixedColumns[3].fixedWidth, `fixed-row reserve/span width must match the accepted fixed-column extent: ${JSON.stringify({ fixedLast: fixedLast?.rect, descriptor: table.descriptorHasScrollBar, reserve: table.reserveScrollBar, visible: table.visibleHeight, fixedColumns })}`);
  const groupedFirst = scene.cells.find(cell => cell.rowIndex === 2 && cell.column === 1);
  const groupedLast = fixedLast;
  assert(groupedFirst?.rect?.width === fixedColumns[0].fixedWidth + fixedColumns[1].fixedWidth + metrics.borderSize, 'source colspan span width must include the accepted fixed columns');
  assert(groupedLast?.rect?.width === fixedColumns[3].fixedWidth, 'last fixed cell must retain the widened fixed-column width');
  assert(columns[1].x === columns[0].x + columns[0].width + 1, 'column x must include the source border');
  assert(scene.rows.length === 3 && scene.cells.length === 12, 'expected all source rows/cells including the overflow evidence and every kernel slot');
  assert(groupedFirst?.hidden === false, 'span anchor must remain visible');
  assert(scene.cells.find(cell => cell.rowIndex === 2 && cell.column === 2)?.hidden === true, 'colspan=0 cell must remain hidden');
  assert(scene.gameTruth === 'Not verified in game', 'permanent game truth string is required');
});

test('translates every descendant geometry to the global drawable origin exactly once', () => {
  const zeroSource = [
    'local menu = { name = "GlobalZero", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(1, { width = 80, reserveScrollBar = false })',
    'table:setColWidth(1, 80, false)',
    'local row = table:addRow(false, { paddingTop = 1, paddingBottom = 1, borderBelow = false, fixed = false })',
    'row[1]:createText("value", { height = 10, x = 2, y = 3 })',
    'frame:display()',
  ].join('\n');
  const offsetSource = [
    'local menu = { name = "GlobalOffset", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80, x = 10, y = 7 })',
    'local table = frame:addTable(1, { width = 80, x = 3, y = 4, reserveScrollBar = false })',
    'table:setColWidth(1, 80, false)',
    'local row = table:addRow(false, { paddingTop = 1, paddingBottom = 1, borderBelow = false, fixed = false })',
    'row[1]:createText("value", { height = 10, x = 2, y = 3 })',
    'frame:display()',
  ].join('\n');
  const baseline = sceneFromRaw(zeroSource, 'selftest/raw-global-offset.lua');
  const offsetScene = sceneFromRaw(offsetSource, 'selftest/raw-global-offset.lua');
  const table = offsetScene.tables[0];
  assert(table.rect?.x === 13 && table.rect.y === 11, 'table origin must include frame and table offsets exactly once');
  assert(table.columns?.[0].x === table.rect.x && table.fixedColumns?.[0].x === table.rect.x, 'normal and fixed first columns must start at the global table origin');
  assert(baseline.tables[0].rect?.x === 0 && baseline.tables[0].rect.y === 0 && baseline.tables[0].columns?.[0].x === 0, 'zero-offset baseline must remain unchanged');
  const row = offsetScene.rows[0];
  const cell = offsetScene.cells[0];
  const widget = offsetScene.widgets[0];
  const text = offsetScene.texts[0];
  const glyph = offsetScene.glyphs[0];
  assert(row.rect?.x === 13 && cell.rect?.x === 13 && widget.outerRect?.x === 15, 'row, cell, and widget X coordinates must include the global origin exactly once');
  assert(text.lines[0].rect.x >= 15 && glyph.rect.x >= 15, 'text and glyph X coordinates must remain in the global drawable coordinate space');
  assert(row.rect?.y === 12 && cell.rect?.y === 12 && widget.outerRect?.y === 15, 'row, cell, and widget Y coordinates must include the global origin exactly once');
});

test('keeps the fixed-row scrollbar-band extent through row and cell clipping', () => {
  const scene = sceneFromRaw([
    'local menu = { name = "FixedBand", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(2, { width = 80, maxVisibleHeight = 12, reserveScrollBar = true, scaling = false })',
    'table:setColWidth(1, 40, false)',
    'table:setColWidth(2, 40, false)',
    'local fixed = table:addRow(false, { paddingTop = 1, paddingBottom = 1, borderBelow = false, fixed = true })',
    'fixed[1]:createButton({ height = 8, affectRowHeight = true })',
    'local normal = table:addRow(false, { paddingTop = 1, paddingBottom = 1, borderBelow = false, fixed = false })',
    'normal[1]:createText("normal", { height = 2, minRowHeight = 2 })',
    'frame:display()',
  ].join('\n'), 'selftest/raw-fixed-band.lua');
  const table = scene.tables[0];
  const normalRight = table.rect!.x + table.rect!.width;
  const fixedRight = table.fixedColumns![table.fixedColumns!.length - 1].x + table.fixedColumns![table.fixedColumns!.length - 1].fixedWidth;
  const fixedRow = scene.rows.find(row => row.fixed === true)!;
  const fixedCell = scene.cells.find(cell => cell.rowId === fixedRow.id && cell.column === 2)!;
  const normalRow = scene.rows.find(row => row.fixed === false)!;
  const normalCell = scene.cells.find(cell => cell.rowId === normalRow.id && cell.column === 2)!;
  assert(fixedRight === normalRight + metrics.scrollbarWidth, `scrollable fixed columns must extend through the scrollbar band exactly once: ${JSON.stringify({ descriptor: table.descriptorHasScrollBar, reserve: table.reserveScrollBar, normalRight, fixedRight, columns: table.columns, fixedColumns: table.fixedColumns })}`);
  assert(fixedRow.rect?.x === table.rect!.x && fixedRow.rect.width === fixedRight - table.rect!.x, 'fixed row width must use the widened fixed-column extent');
  assert(fixedRow.clipRect?.x === table.rect!.x && fixedRow.clipRect.x + fixedRow.clipRect.width === fixedRight, 'fixed row clip must retain the proven fixed-row band');
  assert(fixedCell.rect?.x !== undefined && fixedCell.rect.x + fixedCell.rect.width === fixedRight, 'fixed last cell must retain its full widened width');
  assert(fixedCell.clipRect?.x !== undefined && fixedCell.clipRect.x + fixedCell.clipRect.width === fixedRight, 'fixed last cell clip must retain the widened extent');
  assert(normalRow.rect?.x === table.rect!.x && normalRow.rect.x + normalRow.rect.width === normalRight, 'normal rows must remain at normal table width');
  assert(normalCell.rect?.x !== undefined && normalCell.rect.x + normalCell.rect.width === normalRight, `normal cells must not inherit the scrollbar band: ${JSON.stringify({ normalRight, rect: normalCell.rect, row: normalRow.rect, columns: table.columns, fixedColumns: table.fixedColumns })}`);
});

test('clips icon text to the parent cell rather than the narrow icon bitmap', () => {
  const scene = sceneFromRaw([
    'local menu = { name = "NarrowIcon", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(1, { width = 40, reserveScrollBar = false })',
    'table:setColWidth(1, 40, false)',
    'local row = table:addRow(false, { paddingTop = 1, paddingBottom = 1, borderBelow = false, fixed = false })',
    'row[1]:createIcon("solid", { width = 8, height = 8, affectRowHeight = true }):setText2("secondary text", { x = 1, halign = "right" })',
    'frame:display()',
  ].join('\n'), 'selftest/raw-narrow-icon.lua');
  const iconWidget = scene.widgets.find(widget => widget.kind === 'icon')!;
  const iconCell = scene.cells.find(cell => cell.id === iconWidget.cellId)!;
  const secondary = scene.texts.find(text => text.widgetId === iconWidget.id && text.slot === 'secondary')!;
  const secondaryGlyph = scene.glyphs.find(glyph => glyph.textId === secondary.id)!;
  assert(iconWidget.clipRect?.width === 8, 'icon bitmap clip must remain bounded to its narrow outer rect');
  assert(secondary.clipRect?.width !== undefined && secondary.clipRect.width > 0, 'right-aligned icon text must retain a nonempty parent-cell clip outside the bitmap');
  assert(secondary.clipRect.x >= iconCell.rect!.x && secondary.clipRect.x + secondary.clipRect.width <= iconCell.rect!.x + iconCell.rect!.width, 'icon text clip must remain inside the parent cell');
  assert(secondaryGlyph.clipRect?.width !== undefined && secondaryGlyph.clipRect.width > 0, `icon glyph clip must retain the parent-cell intersection: ${JSON.stringify({ secondary: secondary.clipRect, glyph: secondaryGlyph.clipRect, line: secondary.lines[0], cell: iconCell.rect })}`);

  const offCanvasScene = sceneFromRaw([
    'local menu = { name = "NarrowIconOffCanvas", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(1, { width = 40, y = 80, reserveScrollBar = false })',
    'table:setColWidth(1, 40, false)',
    'local row = table:addRow(false, { paddingTop = 1, paddingBottom = 1, borderBelow = false, fixed = false })',
    'row[1]:createIcon("solid", { width = 8, height = 8, affectRowHeight = false }):setText2("secondary text", { x = 1, halign = "right" })',
    'frame:display()',
  ].join('\n'), 'selftest/raw-narrow-icon-offcanvas.lua');
  const offCanvasText = offCanvasScene.texts.find(text => text.slot === 'secondary')!;
  const offCanvasGlyph = offCanvasScene.glyphs.find(glyph => glyph.textId === offCanvasText.id)!;
  assert(offCanvasText.clipRect?.width === 0 && offCanvasText.clipRect.height === 0, 'fully off-viewport icon text must retain an explicit empty clip');
  assert(offCanvasGlyph.clipRect?.width === 0 && offCanvasGlyph.clipRect.height === 0, 'fully off-viewport icon glyph must retain an explicit empty clip');
});

test('projects equal, percent, and pixel finalized column facts through the scene boundary', () => {
  const make = (name: string, widths: readonly string[]): { readonly scene: X4UiScene; readonly program: X4UiLayoutProgram } => rawSceneProjection([
    `local menu = { name = "${name}", layer = 1 }`,
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(4, { width = 92, reserveScrollBar = false })',
    ...widths.map((width, index) => `table:${width.startsWith('percent:') ? 'setColWidthPercent' : 'setColWidth'}(${index + 1}, ${width.replace('percent:', '')}${width.startsWith('percent:') ? '' : ', false'})`),
    'local row = table:addRow(false, { paddingTop = 1, paddingBottom = 1, borderBelow = false, fixed = false })',
    'row[1]:createButton({ height = 8, affectRowHeight = false })',
    'frame:display()',
  ].join('\n'), `selftest/raw-columns-${name}.lua`);
  for (const [name, widths] of [['equal', ['23', '23', '23', '23']], ['percent', ['percent:25', 'percent:25', 'percent:25', 'percent:25']], ['pixel', ['10', '20', '30', '30']] ] as const) {
    const projected = make(name, widths);
    const expected = projected.program.tables[0].kernelState?.columns.map(column => column.width);
    const columns = projected.scene.tables[0].columns!;
    assert(expected !== undefined && columns.map(column => column.width).join(',') === expected.join(','), `${name} finalized widths must remain exact source-derived facts: ${columns.map(column => column.width).join(',')} vs ${expected?.join(',')}`);
    assert(columns.every(column => column.provenanceLinks.some(link => link.kind === 'kernel-state')), `${name} column provenance must remain kernel-linked`);
  }
});

test('keeps descriptor scrollbar and reserve combinations explicit without claiming runtime truth', () => {
  for (const [maxVisibleHeight, expectedHasScrollBar] of [[10, true], [100, false]] as const) {
    const scene = sceneFromRaw([
      `local menu = { name = "Scrollbar${maxVisibleHeight}", layer = 1 }`,
      'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
      `local table = frame:addTable(1, { width = 40, maxVisibleHeight = ${maxVisibleHeight}, reserveScrollBar = false })`,
      'table:setColWidth(1, 40, false)',
      'local row = table:addRow(false, { paddingTop = 1, paddingBottom = 1, borderBelow = false, fixed = false })',
      'row[1]:createText("height", { height = 30, minRowHeight = 10 })',
      'frame:display()',
    ].join('\n'), `selftest/raw-scrollbar-${maxVisibleHeight}.lua`);
    const projected = scene.tables[0];
    assert(projected.descriptorHasScrollBar === expectedHasScrollBar, `descriptor scrollbar presence ${String(expectedHasScrollBar)} must remain source-derived`);
    assert(projected.scrollbarEvidence?.runtime === 'unavailable', 'runtime scrollbar truth must remain unavailable');
    assert(projected.columns !== undefined && projected.fixedColumns !== undefined, 'known columns must survive the descriptor scrollbar boundary');
  }
  const reserveScene = sceneFromRaw([
    'local menu = { name = "ScrollbarReserve", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(1, { width = 40, maxVisibleHeight = 10, reserveScrollBar = true })',
    'table:setColWidth(1, 40, false)',
    'local row = table:addRow(false, { paddingTop = 1, paddingBottom = 1, borderBelow = false, fixed = false })',
    'row[1]:createText("height", { height = 30, minRowHeight = 10 })',
    'frame:display()',
  ].join('\n'), 'selftest/raw-scrollbar-reserve.lua');
  assert(reserveScene.tables[0].descriptorHasScrollBar === true && reserveScene.tables[0].scrollbarEvidence?.runtime === 'unavailable', 'descriptor reserve and runtime evidence must remain separate');
});

test('preserves independent frame/table projection locality', () => {
  const scene = sceneFromRaw([
    'local menu = { name = "Independent", layer = 1 }',
    'local firstFrame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local firstTable = firstFrame:addTable(1, { width = 40, reserveScrollBar = false })',
    'firstTable:setColWidth(1, 40, false)',
    'local firstRow = firstTable:addRow(false, {})',
    'firstRow[1]:createText("first", { height = 10 })',
    'local secondFrame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local secondTable = secondFrame:addTable(1, dynamic_options)',
    'firstFrame:display()',
    'secondFrame:display()',
  ].join('\n'), 'selftest/raw-independent.lua');
  const first = scene.tables.find(table => table.rect !== undefined)!;
  const second = scene.tables.find(table => table.rect === undefined)!;
  assert(first.rect !== undefined && first.columns !== undefined, 'known first table geometry must survive a separate table gap');
  assert(second.diagnosticLinks.some(id => scene.gaps.find(gap => gap.id === id)?.nodeId === second.id.slice('scene:'.length)), 'second table gap must remain local');
});

test('projects kernel finalization diagnostics once and back-links them to the owning table', () => {
  const projected = rawSceneProjection([
    'local menu = { name = "Diagnostics", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(2, { width = 75, maxVisibleHeight = 10, reserveScrollBar = true })',
    'table:setColWidth(1, 40, false)',
    'table:setColWidth(2, 40, false)',
    'local row = table:addRow(false, {})',
    'row[1]:createText("diagnostic", { height = 30 })',
    'frame:display()',
  ].join('\n'), 'selftest/raw-diagnostics.lua');
  const table = projected.program.tables[0];
  const state = table.kernelState!;
  const diagnostic = state.diagnostics[0];
  assert(diagnostic !== undefined, 'the no-variable fixture must carry the real Helper diagnostic');
  const scene = projected.scene;
  const diagnostics = scene.gaps.filter(gap => gap.nodeId === table.id && (gap.reason === diagnostic!.message || gap.reason.includes(diagnostic!.code) || gap.expression === diagnostic!.code));
  assert(diagnostics.length === 1, 'kernel diagnostics must be projected once and localized to the owning table');
  assert(scene.tables[0].diagnosticLinks.includes(diagnostics[0].id), 'kernel diagnostic must link back to its table');
  assert(diagnostics[0].source.file === table.source.file && diagnostics[0].expression === diagnostic.code, 'kernel diagnostic must retain table source and kernel code provenance');
});

test('keeps insufficient rightmost scrollbar width as a localized partial fact', () => {
  const projected = rawSceneProjection([
    'local menu = { name = "InsufficientRightmost", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(2, { width = 80, maxVisibleHeight = 10, reserveScrollBar = false })',
    'table:setColWidth(1, 77, false)',
    'table:setColWidth(2, 3, false)',
    'local row = table:addRow(false, {})',
    'row[1]:createText("diagnostic", { height = 30 })',
    'frame:display()',
  ].join('\n'), 'selftest/raw-insufficient-rightmost.lua');
  const scene = projected.scene;
  const tableNode = scene.tables[0];
  assert(tableNode.rect !== undefined && tableNode.columns !== undefined, `insufficient scrollbar width must retain known table and column siblings: ${JSON.stringify({ rect: tableNode.rect, columns: tableNode.columns, completeness: tableNode.completeness, gaps: scene.gaps.map(gap => gap.reason) })}`);
  assert(tableNode.completeness === 'partial', 'insufficient scrollbar width must make the table partial');
  assert(tableNode.diagnosticLinks.some(id => scene.gaps.find(gap => gap.id === id)?.reason.includes('rightmost column')), 'insufficient scrollbar width must retain the exact source-linked gap');
});

test('uses the effective fixed section through the last fixed row, not each row flag', () => {
  const scene = sceneFromRaw([
    'local menu = { name = "FixedMembership", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(2, { width = 80, maxVisibleHeight = 40, reserveScrollBar = true })',
    'table:setColWidth(1, 40, false)',
    'table:setColWidth(2, 40, false)',
    'local first = table:addRow(false, { paddingTop = 1, paddingBottom = 1, borderBelow = false, fixed = false })',
    'first[1]:createText("first", { height = 8 })',
    'local later = table:addRow(false, { paddingTop = 1, paddingBottom = 1, borderBelow = false, fixed = true })',
    'later[1]:createText("fixed", { height = 8 })',
    'frame:display()',
  ].join('\n'), 'selftest/raw-fixed-membership.lua');
  const firstRow = scene.rows.find(row => row.rowIndex === 1)!;
  const firstIconCell = scene.cells.find(cell => cell.rowId === firstRow.id && cell.column === 2)!;
  const table = scene.tables[0];
  assert(firstRow.fixed === false, 'the configured row fixed flag must remain separately visible');
  assert(firstRow.rect?.y === firstRow.naturalRect?.y, 'a nonfixed row before a later fixed row belongs to the effective fixed section');
  assert(firstIconCell.rect?.width === table.fixedColumns![1].fixedWidth, 'effective fixed-section rows must use fixed column widths');
});

test('projects distinct widgets, inherited zero dimensions, primary/secondary text, and glyph quads', () => {
  const fixture = makeFixture();
  const scene = sceneOf(sceneFor(fixture));
  const kinds = new Set(scene.widgets.map(widget => widget.kind));
  assert(kinds.has('text') && kinds.has('button') && kinds.has('editbox') && kinds.has('icon'), 'all supported widget kinds must remain distinct');
  const button = scene.widgets.find(widget => widget.kind === 'button');
  const editbox = scene.widgets.find(widget => widget.kind === 'editbox');
  assert(button?.outerRect?.height === scene.rows[0].rect?.height, 'button zero height must inherit the row extent');
  assert(editbox?.outerRect?.height === scene.rows[0].rect?.height, 'edit-box zero height must inherit the row extent');
  assert(button?.diagnosticStyle.geometry === 'source-derived' && scene.widgets.find(widget => widget.kind === 'icon')?.diagnosticStyle.geometry === 'source-derived', 'runtime state/texture gaps must not erase known widget geometry');
  assert(button?.textIds.length === 2, 'button primary and secondary text must be separate children');
  assert(scene.texts.some(text => text.font === 'Zekton Bold'), 'bold Zekton text must retain its exact font identity');
  assert(scene.glyphs.length > 0, 'known glyphs must project into quads');
  for (const [kind, line] of [['text', 6243], ['button', 6279], ['editbox', 6332], ['icon', 6259]] as const) {
    const widget = scene.widgets.find(candidate => candidate.kind === kind)!;
    assert(widget.provenanceLinks.some(link => link.sourcePin?.lineStart === line), `${kind} widget geometry must retain its shipped table-call source pin`);
  }
});

test('preserves exact layout line source code-point ranges and rejects line evidence drift', () => {
  const scene = rawTextScene('SourceCodePointRange', 'AB', 'height = 12');
  const text = scene.texts.find(candidate => candidate.layout !== undefined && candidate.lines.length > 0);
  assert(text !== undefined && text.layout !== undefined, 'source-code-point fixture must contain a laid-out text node');
  const line = text.lines[0];
  const layoutLine = text.layout.lines.find(candidate => candidate.lineIndex === line.lineIndex);
  assert(layoutLine !== undefined && layoutLine.sourceCodePointRange.end > layoutLine.sourceCodePointRange.start, 'source-code-point fixture must contain a nonempty layout range');
  assert(sceneLineSourceCodePointRangesMatchLayout(scene), 'Scene text lines must carry the exact layout sourceCodePointRange');

  const missing = JSON.parse(JSON.stringify(scene)) as X4UiScene;
  delete (missing.texts.find(candidate => candidate.id === text.id)!.lines[0] as unknown as Record<string, unknown>).sourceCodePointRange;
  assert(!sceneLineSourceCodePointRangesMatchLayout(missing), 'missing line sourceCodePointRange must be rejected');

  const malformed = JSON.parse(JSON.stringify(scene)) as X4UiScene;
  (malformed.texts.find(candidate => candidate.id === text.id)!.lines[0] as unknown as Record<string, unknown>).sourceCodePointRange = { start: 0, end: 1, extra: true };
  assert(!sceneLineSourceCodePointRangesMatchLayout(malformed), 'malformed line sourceCodePointRange must be rejected');

  const altered = JSON.parse(JSON.stringify(scene)) as X4UiScene;
  const alteredLine = altered.texts.find(candidate => candidate.id === text.id)!.lines[0] as unknown as Record<string, unknown>;
  alteredLine.sourceCodePointRange = { start: layoutLine.sourceCodePointRange.start, end: layoutLine.sourceCodePointRange.end + 1 };
  assert(!sceneLineSourceCodePointRangesMatchLayout(altered), 'altered line sourceCodePointRange must be rejected');
});

test('uses one-border cellbackgroundwidth only for button/icon parentwidth paths', () => {
  const scene = sceneFromRaw([
    'local menu = { name = "BackgroundWidth", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(3, { width = 80, reserveScrollBar = false })',
    'table:setColWidth(1, 20, false)',
    'table:setColWidth(2, 20, false)',
    'table:setColWidth(3, 20, false)',
    'local row = table:addRow(false, { paddingTop = 1, paddingBottom = 1, borderBelow = false, fixed = false })',
    'row[1]:createButton({ width = 0, height = 8, affectRowHeight = false }):setText("primary", { x = 3 }):setText2("secondary", { x = 2 })',
    'row[2]:createIcon("solid", { width = 8, height = 8, affectRowHeight = true }):setText("icon", { x = 2 }):setText2("icon2", { x = 1, halign = "right" })',
    'frame:display()',
  ].join('\n'), 'selftest/raw-background-width.lua');
  const buttonWidget = scene.widgets.find(widget => widget.kind === 'button')!;
  assert(buttonWidget.outerRect?.width !== undefined && buttonWidget.outerRect.width >= 20, 'button zero width must retain its source-derived inherited width');
  const buttonTexts = scene.texts.filter(text => text.widgetId === buttonWidget.id);
  assert(buttonTexts.find(text => text.slot === 'primary')?.availableWidth !== undefined, 'button primary width must use a source-known text offset');
  assert(buttonTexts.find(text => text.slot === 'secondary')?.availableWidth !== undefined, 'button secondary width must use its own source-known text offset');
  const iconWidget = scene.widgets.find(widget => widget.kind === 'icon')!;
  const iconCell = scene.cells.find(cell => cell.id === iconWidget.cellId)!;
  assert(iconWidget.outerRect?.width === 8, 'icon outer width must remain its foreground bitmap width');
  const iconText = scene.texts.find(text => text.widgetId === iconWidget.id && text.slot === 'primary')!;
  assert(iconText.availableWidth !== undefined && iconText.availableWidth >= iconCell.rect!.width, 'icon text parentwidth must follow the source cell/background path');
});

test('ports direct fontstring left/center/right anchors and nonzero y without double offsets', () => {
  for (const alignment of ['left', 'center', 'right'] as const) {
    const scene = sceneFromRaw([
      `local menu = { name = "DirectText${alignment}", layer = 1 }`,
      'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
      'local table = frame:addTable(1, { width = 40, reserveScrollBar = false })',
      'table:setColWidth(1, 40, false)',
      'local row = table:addRow(false, { paddingTop = 1, paddingBottom = 1, borderBelow = false, fixed = false })',
      `row[1]:createText("AB", { height = 12, x = 2, y = 3, halign = "${alignment}" })`,
      'frame:display()',
    ].join('\n'), `selftest/raw-direct-text-${alignment}.lua`);
    const cellNode = scene.cells[0];
    const widget = scene.widgets.find(candidate => candidate.cellId === cellNode.id)!;
    const text = scene.texts.find(candidate => candidate.widgetId === widget.id)!;
    const line = text.lines[0];
    assert(widget.outerRect?.x === cellNode.rect!.x + 2 && widget.outerRect.y === cellNode.rect!.y + 3, `${alignment} direct text outer offset must be applied once`);
    assert(text.availableWidth === 38, `${alignment} direct text width must follow the source cell width minus x`);
    assert(Number.isFinite(line.rect.x) && Number.isFinite(line.rect.y), `${alignment} direct text anchor must remain finite and source-derived`);
  }
});

test('fail-first: source-shaped 2560 rows keep known direct text inside accepted row clips', () => {
  const projected = rawProjectionFor([
    'local menu = { name = "SourceCompositionTextBounds", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 2560, height = 1440 })',
    'local rail = frame:addTable(1, { x = 40, y = 220, width = 300, maxVisibleHeight = 104, reserveScrollBar = false, scaling = false })',
    'rail:setColWidth(1, 300, false)',
    'local railRow = rail:addRow(false, { paddingTop = 0, paddingBottom = 0, borderBelow = false, fixed = false, scaling = false })',
    'railRow[1]:createText("CHANNEL", { height = 104, minRowHeight = 104 })',
    'local transcript = frame:addTable(1, { x = 600, y = 763, width = 1360, maxVisibleHeight = 285, reserveScrollBar = false, scaling = false })',
    'transcript:setColWidth(1, 1360, false)',
    'local transcriptRow = transcript:addRow(false, { paddingTop = 0, paddingBottom = 0, borderBelow = false, fixed = false, scaling = false })',
    'transcriptRow[1]:createText("The Federation recorded your assistance.", { height = 285, minRowHeight = 285 })',
    'local choice = frame:addTable(1, { x = 600, y = 1066, width = 1360, maxVisibleHeight = 138, reserveScrollBar = false, scaling = false })',
    'choice:setColWidth(1, 1360, false)',
    'local choiceRow = choice:addRow(false, { paddingTop = 0, paddingBottom = 0, borderBelow = false, fixed = false, scaling = false })',
    'choiceRow[1]:createText("1. Pay the 2.4 million", { height = 138, minRowHeight = 138 })',
    'local input = frame:addTable(1, { x = 600, y = 1220, width = 1360, maxVisibleHeight = 72, reserveScrollBar = false, scaling = false })',
    'input:setColWidth(1, 1360, false)',
    'local inputRow = input:addRow(false, { paddingTop = 0, paddingBottom = 0, borderBelow = false, fixed = false, scaling = false })',
    'inputRow[1]:createText("Type your message...", { height = 72, minRowHeight = 72 })',
    'frame:display()',
  ].join('\n'), 'selftest/source-composition-text-bounds.lua', profile => ({
    ...profile,
    frame: { width: 2560, height: 1440 },
    helper: {
      ...profile.helper,
      constants: {
        ...profile.helper.constants,
        viewWidth: { value: 2560, source: pin(707) },
        viewHeight: { value: 1440, source: pin(708) },
      },
    },
  }));
  assert(projected.result !== undefined && 'program' in projected.result && projected.program !== undefined && projected.profile !== undefined, 'source-shaped text bounds fixture must produce a real result');
  const scene = sceneOf(buildX4UiScene(projected.result as X4UiLayoutProgramResult, corpus, projected.profile));
  const expectedTables = [
    { x: 40, y: 220, width: 300, height: 104 },
    { x: 600, y: 763, width: 1360, height: 285 },
    { x: 600, y: 1066, width: 1360, height: 138 },
    { x: 600, y: 1220, width: 1360, height: 72 },
  ] as const;
  assert(scene.tables.length === expectedTables.length, `source-shaped text bounds fixture table count changed: ${scene.tables.length}`);
  for (const [index, expected] of expectedTables.entries()) {
    const table = scene.tables[index];
    assert(table?.rect !== undefined
      && table.rect.x === expected.x
      && table.rect.y === expected.y
      && table.rect.width === expected.width
      && table.rect.height === expected.height, `source-shaped table ${index} geometry must remain exact: ${JSON.stringify(table?.rect)}`);
    const row = table === undefined ? undefined : scene.rows.find(candidate => candidate.parentId === table.id);
    const cell = row === undefined ? undefined : scene.cells.find(candidate => candidate.parentId === row.id);
    const widget = cell === undefined ? undefined : scene.widgets.find(candidate => candidate.parentId === cell.id);
    const text = widget === undefined ? undefined : scene.texts.find(candidate => candidate.parentId === widget.id);
    const line = text?.lines[0];
    const clip = text?.clipRect;
    assert(text?.layout !== undefined && line !== undefined && clip !== undefined, `source-shaped table ${index} must retain known text layout and clip`);
    assert(line.rect.y >= clip.y && line.rect.y + line.rect.height <= clip.y + clip.height, `source-shaped table ${index} line must remain inside its row clip: ${JSON.stringify({ line: line.rect, clip })}`);
    const glyphs = text === undefined ? [] : scene.glyphs.filter(candidate => candidate.textId === text.id);
    assert(glyphs.length > 0, `source-shaped table ${index} must retain known glyph geometry`);
    for (const glyph of glyphs) {
      assert(glyph.rect !== undefined && glyph.rect.y >= clip.y && glyph.rect.y + glyph.rect.height <= clip.y + clip.height, `source-shaped table ${index} glyph must remain inside its row clip: ${JSON.stringify({ glyph: glyph.rect, clip })}`);
    }
  }
});

test('fail-first: wrapped direct transcript lines keep line-local glyph stacking', () => {
  const orangeTranscript = 'The Federation recorded your assistance defending our miners last week, Commander. We also recorded your convoy attack the day after. Two wings is a real cost to us - and you are not yet a real ally. Fund the deployment, or give us the Hull Parts, and I will call it settled.';
  const projected = rawProjectionFor([
    'local menu = { name = "SourceCompositionTranscriptWrap", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 2560, height = 1440 })',
    'local transcript = frame:addTable(2, { x = 600, y = 763, width = 1360, height = 285, maxVisibleHeight = 285, reserveScrollBar = false, scaling = false })',
    'transcript:setColWidthPercent(1, 14)',
    'transcript:setColWidthPercent(2, 86)',
    'local row = transcript:addRow(false, { fixed = true, borderBelow = true, paddingTop = 0, paddingBottom = 0, scaling = false })',
    'row[1]:createText("ADMINISTRATOR", { height = 24, minRowHeight = 24, fontsize = 15 })',
    `row[2]:createText(${JSON.stringify(orangeTranscript)}, { height = 96, minRowHeight = 96, wordwrap = true, fontsize = 23 })`,
    'frame:display()',
  ].join('\n'), 'selftest/source-composition-transcript-wrap.lua', profile => ({
    ...profile,
    frame: { width: 2560, height: 1440 },
    helper: {
      ...profile.helper,
      constants: {
        ...profile.helper.constants,
        viewWidth: { value: 2560, source: pin(707) },
        viewHeight: { value: 1440, source: pin(708) },
      },
    },
  }));
  assert(projected.result !== undefined && 'program' in projected.result && projected.program !== undefined && projected.profile !== undefined, 'wrapped transcript fixture must produce a real result');
  const wrappedProfile = Object.freeze({
    ...projected.profile,
    textPolicy: Object.freeze({ ...projected.profile.textPolicy, wrapMode: 'greedy-word' as const }),
  });
  const scene = sceneOf(buildX4UiScene(projected.result as X4UiLayoutProgramResult, corpus, wrappedProfile));
  const text = scene.texts.find(candidate => candidate.content === orangeTranscript);
  assert(text !== undefined && text.layout !== undefined && text.lines.length > 1, `wrapped transcript must produce multiple source-proven lines: ${JSON.stringify({ text: text?.content, lines: text?.lines.length, layoutLines: text?.layout?.lines.length, font: text?.font, fontSize: text?.fontSize, alignment: text?.alignment, offsetX: text?.offsetX, offsetY: text?.offsetY, availableWidth: text?.availableWidth, contentSelection: text?.contentSelection, diagnostics: text?.diagnosticLinks.map(id => scene.gaps.find(gap => gap.id === id)?.reason) })}`);
  assert(text.availableWidth === 1163, `wrapped transcript must use the 86 percent column width from the 1360px table: ${String(text.availableWidth)}`);
  const lineYs = text.lines.map(line => line.rect.y);
  const glyphs = scene.glyphs.filter(glyph => glyph.textId === text.id);
  const glyphYs = text.lines.map(line => glyphs.find(glyph => glyph.lineIndex === line.lineIndex)?.rect?.y);
  const expectedGlyphOffsets = text.lines.map(line => {
    const glyph = glyphs.find(candidate => candidate.lineIndex === line.lineIndex);
    assert(glyph?.rect !== undefined, `wrapped transcript line ${line.lineIndex} must retain a glyph rectangle`);
    return glyph.rect.y - line.rect.y;
  });
  assert(new Set(lineYs).size === lineYs.length && lineYs.every((value, index) => index === 0 || value > lineYs[index - 1]!), `wrapped transcript line rectangles must advance vertically: ${JSON.stringify(lineYs)}`);
  assert(new Set(glyphYs).size === glyphYs.length && glyphYs.every((value, index) => index === 0 || value! > glyphYs[index - 1]!), `wrapped transcript glyph rectangles must advance vertically: ${JSON.stringify(glyphYs)}`);
  assert(expectedGlyphOffsets.every(offset => offset >= 0 && offset < text.layout!.lines[0]!.lineBox.height), `wrapped transcript glyphs must remain line-local to their line boxes: ${JSON.stringify({ expectedGlyphOffsets, lineHeight: text.layout!.lines[0]!.lineBox.height })}`);
  const clip = text.clipRect;
  assert(clip !== undefined, 'wrapped transcript must retain a known row/widget clip');
  for (const line of text.lines) {
    assert(line.rect.y >= clip.y && line.rect.y + line.rect.height <= clip.y + clip.height, `wrapped transcript line must remain inside its accepted clip: ${JSON.stringify({ line: line.rect, clip })}`);
  }
  for (const glyph of glyphs) {
    assert(glyph.rect !== undefined && glyph.rect.y >= clip.y && glyph.rect.y + glyph.rect.height <= clip.y + clip.height, `wrapped transcript glyph must remain inside its accepted clip: ${JSON.stringify({ glyph: glyph.rect, clip })}`);
  }
});

test('B119 fail-first: explicit wrapped-text height reports source-linked Scene overflow without changing geometry', () => {
  const wrappedText = 'The Federation recorded your assistance defending our miners last week, Commander. We also recorded your convoy attack the day after. Two wings is a real cost to us - and you are not yet a real ally. Fund the deployment, or give us the Hull Parts, and I will call it settled.';
  const sourceFor = (height: number, maxVisibleHeight = height): string => [
    'local menu = { name = "ExplicitWrappedTextHeightDiagnostic", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 2560, height = 1440 })',
    `local table = frame:addTable(1, { x = 600, y = 300, width = 550, height = ${height}, maxVisibleHeight = ${maxVisibleHeight}, reserveScrollBar = false, scaling = false })`,
    'table:setColWidth(1, 550, false)',
    'local row = table:addRow(false, { fixed = false, borderBelow = false, paddingTop = 0, paddingBottom = 0, scaling = false })',
    `row[1]:createText(${JSON.stringify(wrappedText)}, { height = ${height}, minRowHeight = ${height}, wordwrap = true, fontsize = 23 })`,
    'frame:display()',
  ].join('\n');
  const producerProfileFor = (profile: Parameters<typeof projectX4UiLayoutProgram>[2]): Parameters<typeof projectX4UiLayoutProgram>[2] => ({
    ...profile,
    frame: { width: 2560, height: 1440 },
    helper: {
      ...profile.helper,
      constants: {
        ...profile.helper.constants,
        viewWidth: { value: 2560, source: pin(707) },
        viewHeight: { value: 1440, source: pin(708) },
      },
    },
  });
  const build = (height: number, maxVisibleHeight = height, viewportOnly = false): X4UiScene => {
    const projected = rawProjectionFor(
      sourceFor(height, maxVisibleHeight),
      `selftest/raw-explicit-wrapped-height-${height}-${maxVisibleHeight}.lua`,
      producerProfileFor,
    );
    assert(projected.result !== undefined && 'program' in projected.result && projected.program !== undefined && projected.profile !== undefined, 'explicit wrapped-text height fixture must produce a real result');
    const sceneProfile = {
      ...projected.profile,
      textPolicy: { ...projected.profile.textPolicy, lineSpacing: 0, wrapMode: 'greedy-word' as const },
      ...(viewportOnly ? { tableView: { [projected.program.tables[0]!.id]: { scrollOffset: 0 } } } : {}),
    };
    return sceneOf(buildX4UiScene(projected.result as X4UiLayoutProgramResult, pinnedLineAdvanceCorpus, sceneProfile));
  };
  const overflowScene = build(96);
  const overflowWidget = overflowScene.widgets.find(widget => widget.kind === 'text')!;
  const overflowText = overflowScene.texts.find(text => text.widgetId === overflowWidget.id)!;
  assert(overflowText.lines.length === 3, `overflow fixture must issue exactly three wrapped lines: ${JSON.stringify({ lines: overflowText.lines.length, availableWidth: overflowText.availableWidth, content: overflowText.content })}`);
  const requiredHeight = Math.max(...overflowText.lines.map(line => line.rect.y + line.rect.height))
    - Math.min(...overflowText.lines.map(line => line.rect.y));
  assert(requiredHeight === 112.125, `overflow fixture must issue the pinned 112.125px line extent: ${String(requiredHeight)}`);
  const overflowGaps = overflowScene.gaps.filter(gap => gap.nodeId === overflowText.id && gap.category === 'height');
  assert(overflowGaps.length === 1, `overflow fixture must produce exactly one text height gap: ${JSON.stringify(overflowGaps)}`);
  assert(overflowGaps[0]!.reason.includes('required 112.125 px')
    && overflowGaps[0]!.reason.includes('available 96 px')
    && overflowGaps[0]!.reason.includes('excess 16.125 px'), `overflow gap must report required, available, and excess pixels: ${overflowGaps[0]!.reason}`);
  assert(overflowGaps[0]!.source.file === overflowText.source.file
    && overflowGaps[0]!.source.sourcePath === overflowText.source.sourcePath
    && overflowGaps[0]!.source.start.offset <= overflowGaps[0]!.source.end.offset
    && overflowGaps[0]!.nodeId === overflowText.id, 'overflow gap must retain the source file and exact text owner');

  const placementScene = build(114);
  const placementWidget = placementScene.widgets.find(widget => widget.kind === 'text')!;
  const placementText = placementScene.texts.find(text => text.widgetId === placementWidget.id)!;
  assert(placementText.lines.length === 3, '114px placement fixture must retain the same three issued wrapped lines');
  assert(placementWidget.outerRect !== undefined, '114px placement fixture must retain an explicit widget rectangle');
  const placementLineMinY = Math.min(...placementText.lines.map(line => line.rect.y));
  const placementLineMaxY = Math.max(...placementText.lines.map(line => line.rect.y + line.rect.height));
  const placementBottomOverflow = placementLineMaxY - (placementWidget.outerRect!.y + placementWidget.outerRect!.height);
  assert(placementWidget.outerRect!.y === 300 && placementWidget.outerRect!.height === 114
    && placementLineMinY === 338.3125
    && placementLineMaxY === 450.4375
    && placementBottomOverflow === 36.4375, `114px placement fixture must reproduce the issued/widget bounds and bottom overflow: ${JSON.stringify({ widget: placementWidget.outerRect, lineMinY: placementLineMinY, lineMaxY: placementLineMaxY, bottomOverflow: placementBottomOverflow })}`);
  const placementGaps = placementScene.gaps.filter(gap => gap.nodeId === placementText.id && gap.category === 'height');
  assert(placementGaps.length === 1, `114px explicit widget placement must produce exactly one text height gap for ${placementBottomOverflow}px bottom overflow; got ${JSON.stringify(placementGaps)}`);
  assert(placementGaps[0]!.reason.includes('issued line bounds y=338.3125..450.4375 px')
    && placementGaps[0]!.reason.includes('widget bounds y=300..414 px')
    && placementGaps[0]!.reason.includes('bottom overflow 36.4375 px'), `114px placement gap must report auditable line/widget bounds and bottom overflow: ${placementGaps[0]!.reason}`);
  assert(!/\bexcess\s+-/.test(placementGaps[0]!.reason), `114px placement gap must never label a negative value as excess: ${placementGaps[0]!.reason}`);
  assert(placementGaps[0]!.reason.includes('span-height excess 0 px'), `114px placement gap must clamp its non-overflowing span-height excess to zero: ${placementGaps[0]!.reason}`);
  assert(placementGaps[0]!.source.file === placementText.source.file
    && placementGaps[0]!.source.sourcePath === placementText.source.sourcePath
    && placementGaps[0]!.source.start.offset <= placementGaps[0]!.source.end.offset
    && placementGaps[0]!.nodeId === placementText.id, 'placement gap must retain the source file and exact text owner');

  const controlScene = build(187);
  const controlText = controlScene.texts.find(text => text.content === wrappedText)!;
  assert(controlText.lines.length === 3, '187px control must retain the same three issued wrapped lines');
  assert(!controlScene.gaps.some(gap => gap.nodeId === controlText.id && gap.category === 'height'), '187px contained explicit widget height must not produce a text height gap');

  const viewportScene = build(187, 96, true);
  const viewportWidget = viewportScene.widgets.find(widget => widget.kind === 'text')!;
  const viewportText = viewportScene.texts.find(text => text.widgetId === viewportWidget.id)!;
  assert(viewportWidget.outerRect?.height === 187 && viewportText.clipRect?.height === 96, `viewport-only fixture must retain a 187px widget and 96px viewport clip: ${JSON.stringify({ widget: viewportWidget.outerRect, clip: viewportText.clipRect })}`);
  assert(!viewportScene.gaps.some(gap => gap.nodeId === viewportText.id && gap.category === 'height'), 'viewport-only clipping must not produce a text height gap');

  const geometry = (scene: X4UiScene, textId: string): unknown => {
    const text = scene.texts.find(candidate => candidate.id === textId);
    return {
      widget: scene.widgets.find(widget => widget.textIds.includes(textId))?.outerRect,
      textRect: text?.rect,
      textClipRect: text?.clipRect,
      lines: text?.lines.map(line => ({
        lineIndex: line.lineIndex,
        rect: line.rect,
        width: line.width,
        sourceRange: line.sourceRange,
        sourceCodePointRange: line.sourceCodePointRange,
        breakReason: line.breakReason,
        truncated: line.truncated,
        overflow: line.overflow,
        glyphIds: line.glyphIds,
      })),
      glyphs: scene.glyphs.filter(glyph => glyph.textId === textId).map(glyph => ({
        id: glyph.id,
        rect: glyph.rect,
        clipRect: glyph.clipRect,
        lineIndex: glyph.lineIndex,
        quad: glyph.quad,
      })),
    };
  };
  const overflowGeometry = geometry(overflowScene, overflowText.id);
  const rebuiltOverflow = build(96);
  const rebuiltText = rebuiltOverflow.texts.find(text => text.content === wrappedText)!;
  assert(jsonEqual(overflowGeometry, geometry(rebuiltOverflow, rebuiltText.id)), 'overflow diagnostic must not change non-gap text/glyph geometry across deterministic rebuilds');
  assert(overflowScene.gameTruth === X4_UI_SCENE_GAME_TRUTH && overflowScene.verification.gameVerified === false, 'overflow diagnostic must not change Scene game truth');
});

test('ports button and edit-box rectangles/text with independent nonzero offsets', () => {
  const scene = sceneFromRaw([
    'local menu = { name = "ButtonEditOffsets", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(2, { width = 80, reserveScrollBar = false })',
    'table:setColWidth(1, 40, false)',
    'table:setColWidth(2, 40, false)',
    'local row = table:addRow(false, { paddingTop = 1, paddingBottom = 1, borderBelow = false, fixed = false })',
    'row[1]:createButton({ width = 12, height = 8, x = 3, y = 4, affectRowHeight = true }):setText("button", { x = 1, y = 2, halign = "left" })',
    'row[2]:createEditBox({ width = 10, height = 6, x = 2, y = 5, text = "edit", textX = 1, textY = 2, halign = "right" })',
    'frame:display()',
  ].join('\n'), 'selftest/raw-button-edit-offsets.lua');
  const buttonWidgetForWidth = scene.widgets.find(widget => widget.kind === 'button')!;
  const editWidgetForWidth = scene.widgets.find(widget => widget.kind === 'editbox')!;
  assert(scene.texts.find(text => text.widgetId === buttonWidgetForWidth.id && text.slot === 'primary')?.availableWidth !== undefined, 'button primary available width must use source text.x');
  const editTextForWidth = scene.texts.find(text => text.widgetId === editWidgetForWidth.id)!;
  assert(editTextForWidth.availableWidth !== undefined || editTextForWidth.diagnosticLinks.length > 0, 'edit-box available width must use source raw offset facts or retain its exact unavailable gap');
  for (const [kind, width, x, y] of [
    ['button', 12, 3, 4],
    ['editbox', 10, 2, 5],
  ] as const) {
    const widget = scene.widgets.find(candidate => candidate.kind === kind)!;
    const cellNode = scene.cells.find(candidate => candidate.id === widget.cellId)!;
    const text = scene.texts.find(candidate => candidate.widgetId === widget.id)!;
    assert(widget.outerRect?.x !== undefined && widget.outerRect?.y === cellNode.rect!.y + y, `${kind} must use its shipped row-top y anchor`);
    const expectedX = kind === 'editbox' ? cellNode.rect!.x + cellNode.rect!.width / 2 + x - width / 2 : cellNode.rect!.x + x;
    assert(widget.outerRect.width === width && widget.outerRect.x === expectedX, `${kind} must apply its source x and width facts: ${JSON.stringify({ expectedX, width, rect: widget.outerRect, cell: cellNode.rect })}`);
    assert(text.lines.every(line => Number.isFinite(line.rect.x) && Number.isFinite(line.rect.y)), `${kind} text must use its shipped anchor formula`);
  }
});

test('ports icon outer and primary/secondary text anchors independently of button formulas', () => {
  const scene = sceneFromRaw([
    'local menu = { name = "IconOffsets", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(1, { width = 40, reserveScrollBar = false })',
    'table:setColWidth(1, 40, false)',
    'local row = table:addRow(false, { paddingTop = 1, paddingBottom = 1, borderBelow = false, fixed = false })',
    'row[1]:createIcon("solid", { width = 8, height = 6, x = 2, y = 3, affectRowHeight = true }):setText("primary", { x = 1, y = 1 }):setText2("secondary", { x = 2, y = 2, halign = "right" })',
    'frame:display()',
  ].join('\n'), 'selftest/raw-icon-offsets.lua');
  const cellNode = scene.cells.find(candidate => candidate.kind === 'cell')!;
  const widget = scene.widgets.find(candidate => candidate.cellId === cellNode.id)!;
  const texts = scene.texts.filter(candidate => candidate.widgetId === widget.id).sort((left, right) => left.slot.localeCompare(right.slot));
  assert(widget.outerRect?.x === cellNode.rect!.x + 2, 'icon x must remain cell-anchored');
  assert(widget.outerRect?.y === cellNode.rect!.y + cellNode.rect!.height / 2 + 3 - 6 / 2, 'icon y must use cell-center/source y-up conversion');
  for (const text of texts) {
    const line = text.lines[0];
    assert(Number.isFinite(line.rect.x) && Number.isFinite(line.rect.y), `${text.slot} icon text must use updateIcon's local formula`);
  }
});

test('selects the source-proven initial inactive edit-box default branch without claiming runtime input state', () => {
  const scene = sceneFromRaw([
    'local menu = { name = "EditDefaults", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(1, { width = 40, reserveScrollBar = false })',
    'table:setColWidth(1, 40, false)',
    'local row = table:addRow(false, {})',
    'row[1]:createEditBox({ height = 10, text = "", defaultText = "DEFAULT", description = "edit description", active = false }):setText("", { x = 5, y = 0 })',
    'frame:display()',
  ].join('\n'), 'selftest/raw-edit-defaults.lua');
  const widget = scene.widgets.find(candidate => candidate.kind === 'editbox')!;
  const text = scene.texts.find(candidate => candidate.widgetId === widget.id)!;
  assert(text.content === '' && text.defaultContent === 'DEFAULT' && text.description === 'edit description', 'edit-box text facts must remain separately serializable');
  assert(text.contentSelection === 'preview-default' && text.layout !== undefined && text.lines[0]?.displayedText === 'DEFAULT', `initial inactive empty-current edit-box must select defaultText independently of missing paint colors: ${JSON.stringify(text)}`);
  assert(text.editboxPreviewInputState === 'source-initial-inactive' && widget.editboxPreviewInputState === 'source-initial-inactive', 'initial source-composition activity must be explicit and separate from runtime state');
  assert(scene.gaps.some(gap => gap.previewOnly === true && gap.nodeId === widget.id && gap.reason.includes('live direct-input activity')), 'selected preview branch must retain the exact preview-only widget runtime-state gap');
  assert(widget.configuredActive === false, 'configured active must be labeled as configuration, not runtime activity');
  assert(scene.verification.gameVerified === false && scene.verification.game === X4_UI_SCENE_GAME_TRUTH, 'selected preview branch must remain Not verified in game');
});

test('empty edit-box default string still selects the default branch and emits no glyph text', () => {
  const scene = sceneFromRaw([
    'local menu = { name = "EditEmptyDefault", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(1, { width = 40, reserveScrollBar = false })',
    'table:setColWidth(1, 40, false)',
    'local row = table:addRow(false, {})',
    'row[1]:createEditBox({ width = 30, height = 12, defaultText = "" }):setText("", { x = 5, y = 0 })',
    'frame:display()',
  ].join('\n'), 'selftest/raw-edit-empty-default.lua');
  const widget = scene.widgets.find(candidate => candidate.kind === 'editbox')!;
  const text = scene.texts.find(candidate => candidate.widgetId === widget.id)!;
  const glyphs = scene.glyphs.filter(glyph => glyph.textId === text.id);
  assert(text.content === '' && text.defaultContent === '' && text.contentSelection === 'preview-default', `empty default string must remain a distinct selected branch: ${JSON.stringify(text)}`);
  assert(glyphs.length === 0 && text.lines.every(line => line.displayedText === ''), `empty selected default must not fabricate glyph text: ${JSON.stringify({ lines: text.lines, glyphs })}`);
});

test('non-empty edit-box current text wins over defaultText and keeps source-proven black inner chrome evidence', () => {
  const scene = sceneFromRawWithColor([
    'local menu = { name = "EditCurrentWins", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(1, { width = 40, reserveScrollBar = false })',
    'table:setColWidth(1, 40, false)',
    'local row = table:addRow(false, {})',
    'row[1]:createEditBox({ height = 10, defaultText = "PLACEHOLDER", bgColor = Color["editbox_background_default"] }):setText("CURRENT", { x = 5, y = 0 })',
    'frame:display()',
  ].join('\n'), 'selftest/raw-edit-current-wins.lua');
  const widget = scene.widgets.find(candidate => candidate.kind === 'editbox')!;
  const text = scene.texts.find(candidate => candidate.widgetId === widget.id)!;
  assert(text.content === 'CURRENT' && text.defaultContent === 'PLACEHOLDER' && text.contentSelection === 'current', `non-empty current text must remain selected over defaultText: ${JSON.stringify({ content: text.content, defaultContent: text.defaultContent, selection: text.contentSelection, colorFacts: text.colorFacts })}`);
  assert(text.layout !== undefined && text.lines[0]?.displayedText === 'CURRENT', 'non-empty edit-box current text must retain glyph layout');
  assert(!text.colorFacts?.some(fact => fact.field === 'defaultTextColor'), 'non-empty current text must not use placeholder color');
  assert(widget.colorFacts?.some(fact => fact.field === 'editboxBackgroundBlackColor' && fact.slot === 'editbox-inner-background'), `non-empty current text must not suppress black inner chrome evidence: ${JSON.stringify(widget.colorFacts)}`);
  assert(widget.editboxBlackInset === 2 && widget.editboxTextBorder === 2, 'uiScale-1 black inset and fixed text border must remain separately named facts');
});

test('scaled black inset and fixed text border remain distinct at uiScale 2.5', () => {
  const scene = sceneFromRawWithColor([
    'local menu = { name = "EditScaledBorder", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(1, { width = 40, reserveScrollBar = false })',
    'table:setColWidth(1, 40, false)',
    'local row = table:addRow(false, {})',
    'row[1]:createEditBox({ width = 30, height = 20, defaultText = "PLACEHOLDER", active = false, bgColor = Color["editbox_background_default"] }):setText("", { x = 5, y = 0 })',
    'frame:display()',
  ].join('\n'),
  'selftest/raw-edit-scaled-border.lua',
  profile => ({ ...profile, metrics: { ...profile.metrics, uiScale: 2.5 } }));
  const widget = scene.widgets.find(candidate => candidate.kind === 'editbox')!;
  const text = scene.texts.find(candidate => candidate.widgetId === widget.id)!;
  assert(widget.editboxBlackInset === 3, `scaled edit-box black inset must be max(2, floor(1*2.5+0.5)): ${JSON.stringify(widget)}`);
  assert(widget.editboxConfigBorder === 1 && widget.editboxTextBorder === 2 && text.editboxTextBorder === 2, `base, scaled-inner, and fixed-text values must remain distinct: ${JSON.stringify({ widget, textBorder: text.editboxTextBorder })}`);
  assert(text.contentSelection === 'preview-default' && text.layout !== undefined && text.lines[0]?.displayedText === 'PLACEHOLDER', `scaled inactive-empty edit-box must retain the preview default branch: ${JSON.stringify({ selection: text.contentSelection, layout: text.layout !== undefined, firstLine: text.lines[0]?.displayedText, widget })}`);
  const expectedFixedWidth = widget.outerRect === undefined || text.offsetX === undefined
    ? undefined
    : widget.outerRect.width - 2 * (text.offsetX + 2);
  const wronglyScaledWidth = widget.outerRect === undefined || text.offsetX === undefined || widget.editboxBlackInset === undefined
    ? undefined
    : widget.outerRect.width - 2 * (text.offsetX + widget.editboxBlackInset);
  assert(text.availableWidth === expectedFixedWidth && text.availableWidth !== wronglyScaledWidth, `scaled edit-box text width must keep the fixed two-pixel border: ${JSON.stringify({ availableWidth: text.availableWidth, expectedFixedWidth, wronglyScaledWidth, offsetX: text.offsetX, widget: widget.outerRect, blackInset: widget.editboxBlackInset })}`);
  const line = text.lines[0];
  assert(line !== undefined && line.rect.x >= widget.outerRect!.x + 2, `left text anchor must retain the fixed two-pixel inset: ${JSON.stringify({ line: line?.rect, widget: widget.outerRect })}`);
  assert(scene.gaps.some(gap => gap.previewOnly === true && gap.nodeId === text.id), 'scaled preview must retain a preview-only gap');
});

test('B119 uiScale 1.4 keeps the source-pinned edit-box inset floor at 2', () => {
  const scene = sceneFromRawWithColor([
    'local menu = { name = "EditFractionalBorder", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(1, { width = 40, reserveScrollBar = false })',
    'table:setColWidth(1, 40, false)',
    'local row = table:addRow(false, {})',
    'row[1]:createEditBox({ width = 30, height = 20, defaultText = "PLACEHOLDER", active = false, bgColor = Color["editbox_background_default"] }):setText("", { x = 5, y = 0 })',
    'frame:display()',
  ].join('\n'),
  'selftest/raw-edit-fractional-border.lua',
  profile => ({ ...profile, metrics: { ...profile.metrics, uiScale: 1.4 } }));
  const widget = scene.widgets.find(candidate => candidate.kind === 'editbox');
  assert(widget?.editboxBlackInset === 2, `uiScale 1.4 must retain max(2, floor(1*1.4+0.5)) = 2: ${JSON.stringify(widget)}`);
});

test('B119 synchronized in-range edit-box inset drift refuses before Scene geometry', () => {
  const projected = rawProjectionFor([
    'local menu = { name = "EditScaledInsetDrift", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(1, { width = 40, reserveScrollBar = false })',
    'table:setColWidth(1, 40, false)',
    'local row = table:addRow(false, {})',
    'row[1]:createEditBox({ width = 30, height = 20, defaultText = "PLACEHOLDER", active = false, bgColor = Color["editbox_background_default"] }):setText("", { x = 5, y = 0 })',
    'frame:display()',
  ].join('\n'),
  'selftest/b119-editbox-inset-drift.lua',
  profile => ({ ...profile, metrics: { ...profile.metrics, uiScale: 2.5 } }),
  p3ColorAuthority,
  );
  assert(projected.program !== undefined && projected.profile !== undefined && projected.result !== undefined && 'program' in projected.result && projected.result.program !== undefined && 'evidenceAuthority' in projected.result && projected.result.evidenceAuthority !== undefined, 'edit-box inset drift fixture must issue a producer authority pair');
  const result = projected.result as X4UiLayoutProgramResult;
  const sourceCell = projected.program.cells.find(cell => cell.descriptorFacts.contentKind?.status === 'known' && cell.descriptorFacts.contentKind.value === 'editbox');
  const sourceCreator = sourceCell === undefined ? undefined : projected.program.operations.find(operationNode => operationNode.cellId === sourceCell.id && operationNode.kind === 'createEditBox');
  assert(sourceCell !== undefined && sourceCreator !== undefined, 'edit-box inset drift fixture must expose a real edit-box cell and creator');
  const forgedProgram = cloneProgram(projected.program);
  const forgedCell = forgedProgram.cells.find(cell => cell.id === sourceCell.id)!;
  const forgedCreator = forgedProgram.operations.find(operationNode => operationNode.id === sourceCreator.id)!;
  const forgedFacts = [forgedCell.descriptorFacts, forgedCreator.descriptorFacts];
  for (const facts of forgedFacts) {
    const fact = facts.editboxBlackInset;
    assert(fact?.status === 'known' && fact.expectedType === 'number', 'edit-box inset drift must start from a known numeric source fact');
    (fact as unknown as Record<string, unknown>).value = 2;
  }
  const forgedAuthority = synchronizedAuthority(producerAuthority(result), forgedProgram);
  freezeFixtureGraph(forgedProgram);
  freezeFixtureGraph(forgedAuthority);
  const pair = validateX4UiLayoutEvidencePair(forgedProgram, forgedAuthority);
  const stage = diagnoseX4UiSceneStructureForTest(forgedProgram, forgedAuthority);
  const accepted = buildX4UiScene(result, corpus, projected.profile);
  const acceptedWidget = accepted.status === 'refused'
    ? undefined
    : accepted.scene.widgets.find(widget => widget.kind === 'editbox');
  console.log(`B119 edit-box inset fail-first receipt: ${JSON.stringify({ uiScale: projected.program.profile.metrics.uiScale, canonicalInset: acceptedWidget?.editboxBlackInset, forgedInset: 2, pairValid: pair.valid, stage })}`);
  assert(accepted.status !== 'refused' && acceptedWidget?.editboxBlackInset === 3, `uiScale 2.5 canonical inset must be exactly 3: ${JSON.stringify(accepted)}`);
  assert(pair.valid, `synchronized in-range edit-box inset drift must remain an authority-valid producer pair: ${JSON.stringify(pair)}`);
  assert(stage !== undefined, `synchronized in-range inset 2 escaped the Scene structure boundary: ${JSON.stringify({ stage, uiScale: projected.program.profile.metrics.uiScale, forgedInset: 2 })}`);
});

test('B119 editbox descriptor defaults and displayed-hotkey minimum reach Scene, while altered authority refuses', () => {
  const projected = rawProjectionFor([
    'local menu = { name = "B119DescriptorHeightScene", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(1, { width = 100, reserveScrollBar = false, scaling = false })',
    'table:setDefaultCellProperties("editbox", { height = 4, scaling = true })',
    'table:setDefaultComplexCellProperties("editbox", "hotkey", { hotkey = "FIRST", displayIcon = true })',
    'local firstRow = table:addRow(false, { scaling = false })',
    'local first = firstRow[1]:createEditBox({})',
    'table:setDefaultCellProperties("editbox", { height = 20, scaling = false })',
    'table:setDefaultComplexCellProperties("editbox", "hotkey", { hotkey = "SECOND" })',
    'local secondRow = table:addRow(false, { scaling = false })',
    'local second = secondRow[1]:createEditBox({})',
    'local thirdRow = table:addRow(false, { scaling = false })',
    'local third = thirdRow[1]:createEditBox({ height = 0, scaling = true })',
    'third:setHotkey("VISIBLE", { displayIcon = true })',
    'frame:display()',
  ].join('\n'), 'selftest/b119-descriptor-height-scene.lua', profile => ({
    ...profile,
    metrics: { ...profile.metrics, uiScale: 1.5 },
  }));
  assert(projected.program !== undefined && projected.profile !== undefined && projected.result !== undefined && 'program' in projected.result && projected.result.program !== undefined && 'evidenceAuthority' in projected.result && projected.result.evidenceAuthority !== undefined, 'B119 descriptor-height Scene fixture must issue a producer pair');
  const program = projected.program;
  const authority = projected.result.evidenceAuthority;
  assert(validateX4UiLayoutEvidencePair(program, authority).valid, 'B119 descriptor-height producer pair must validate before Scene');
  assert(diagnoseX4UiSceneStructureForTest(program, authority) === undefined, 'B119 descriptor-height producer must pass Scene structure');
  const accepted = buildX4UiScene(projected.result as X4UiLayoutProgramResult, corpus, projected.profile);
  assert(accepted.status !== 'refused', `B119 descriptor-height producer must reach Scene: ${JSON.stringify(accepted)}`);
  const scene = accepted.scene;
  const cellFor = (identityPath: string) => program.cells.find(cell => cell.identity?.path === identityPath);
  const widgetFor = (identityPath: string) => {
    const cell = cellFor(identityPath);
    return cell === undefined ? undefined : scene.widgets.find(widget => widget.cellId === `scene:${cell.id}`);
  };
  const firstWidget = widgetFor('firstRow[1]');
  const secondWidget = widgetFor('secondRow[1]');
  const thirdWidget = widgetFor('thirdRow[1]');
  assert(firstWidget?.outerRect?.height === 23, `B119 first defaulted displayed editbox must use the 23px minimum: ${JSON.stringify(firstWidget)}`);
  assert(secondWidget?.outerRect?.height === 23, `B119 second source-ordered displayed hotkey must retain the 23px minimum: ${JSON.stringify(secondWidget)}`);
  assert(thirdWidget?.outerRect?.height === 23, `B119 direct displayed hotkey must use the 23px minimum from zero: ${JSON.stringify(thirdWidget)}`);
  const forgedAuthority = cloneJsonValue(authority) as unknown as Record<string, unknown>;
  const authorityOperations = forgedAuthority.operations as Record<string, unknown>[];
  const defaultOperation = authorityOperations.find(operationNode => operationNode.kind === 'setDefaultCellProperties');
  assert(defaultOperation !== undefined, 'B119 altered-authority fixture must retain a default operation');
  defaultOperation.sourceOrder = (defaultOperation.sourceOrder as number) + 1;
  freezeFixtureGraph(forgedAuthority);
  const altered = buildX4UiScene({
    ...(projected.result as X4UiLayoutProgramResult),
    evidenceAuthority: forgedAuthority as unknown as X4UiLayoutEvidenceAuthority,
  }, corpus, projected.profile);
  assert(refusalHasNoScene(altered), `B119 altered source-order authority must refuse before Scene geometry: ${JSON.stringify(altered)}`);
});

test('B119 Scene accepts authentic unresolved out-of-scope producers and rejects forged materialization or authority', () => {
  const projected = rawProjectionFor([
    'local menu = { name = "B119NoOpScene", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(2, { width = 100, reserveScrollBar = false, scaling = false })',
    'table:setDefaultCellProperties("button", { height = getHeight(), scaling = getScaling() })',
    'table:setDefaultComplexCellProperties("editbox", "caption", { hotkey = getHotkey(), displayIcon = getDisplayIcon() })',
    'local row = table:addRow(false, { scaling = false })',
    'local button = row[1]:createButton({ height = 25, scaling = false })',
    'button:setHotkey(getHotkey(), { displayIcon = getDisplayIcon() })',
    'row[2]:createEditBox({ height = 12, scaling = false })',
    'frame:display()',
  ].join('\n'), 'selftest/b119-noop-scene.lua');
  assert(projected.program !== undefined && projected.profile !== undefined && projected.result !== undefined
    && 'program' in projected.result && projected.result.program !== undefined
    && 'evidenceAuthority' in projected.result && projected.result.evidenceAuthority !== undefined,
  'B119 no-op Scene fixture must issue a producer pair');
  const result = projected.result as X4UiLayoutProgramResult;
  const program = projected.program;
  const authority = producerAuthority(result);
  const noOps = program.operations.filter(operationNode => operationNode.kind === 'setDefaultCellProperties'
    || operationNode.kind === 'setDefaultComplexCellProperties'
    || operationNode.kind === 'setHotkey');
  const operationGaps = (operationNode: typeof noOps[number]) => program.gaps.filter(gap => gap.operationId === operationNode.id);
  assert(noOps.length === 3
    && result.status === 'partial'
    && program.status === 'partial'
    && noOps[0]?.reason === 'non-editbox widget default effects are outside the bounded editbox-height projection'
    && noOps[1]?.reason === 'non-hotkey editbox default effects are outside the bounded editbox-height projection'
    && noOps[2]?.reason === 'button setHotkey effects are outside the bounded editbox-height projection'
    && noOps.every(operationNode => {
      const gapsForOperation = operationGaps(operationNode);
      return operationNode.status === 'unresolved'
        && operationNode.kernel === undefined
        && typeof operationNode.reason === 'string'
        && operationNode.reason.includes('bounded editbox-height projection')
        && gapsForOperation.length === 1
        && jsonEqual(gapsForOperation[0]?.source, operationNode.source);
    }),
  `B119 out-of-scope calls must remain unresolved source gaps: ${JSON.stringify(noOps)}`);
  assert(validateX4UiLayoutEvidencePair(program, authority).valid, 'B119 authentic unresolved pair must validate');
  assert(diagnoseX4UiSceneStructureForTest(program, authority) === undefined, 'B119 authentic unresolved chain must pass Scene structure');
  const accepted = buildX4UiScene(result, corpus, projected.profile);
  assert(accepted.status === 'partial' && accepted.scene.programStatus === 'partial', `B119 authentic unresolved producer must reach partial Scene: ${JSON.stringify(accepted)}`);
  const editboxCell = program.cells.find(cell => cell.identity?.path === 'row[2]');
  const editboxWidget = editboxCell === undefined
    ? undefined : accepted.scene.widgets.find(widget => widget.cellId === `scene:${editboxCell.id}`);
  assert(editboxWidget?.outerRect?.height === 12
    && editboxCell?.kernelState?.hotkey === ''
    && editboxCell.kernelState.displayIcon === false,
  `unresolved out-of-scope calls must leave known editbox geometry and defaults unchanged: ${JSON.stringify({ editboxWidget, editboxCell })}`);

  const forgedMaterializedProgram = cloneProgram(program);
  const forgedMaterialized = forgedMaterializedProgram.operations.find(operationNode => operationNode.kind === 'setDefaultCellProperties')!;
  const addTable = forgedMaterializedProgram.operations.find(operationNode => operationNode.kind === 'addTable');
  assert(addTable?.kernel?.stateAfter !== undefined, 'materialized-transition forgery requires the preceding table state');
  const forgedStateBefore = cloneKernelState(addTable.kernel.stateAfter);
  const forgedStateAfter = cloneKernelState(forgedStateBefore);
  (forgedStateAfter.editBoxDefaults as unknown as Record<string, unknown>).height = 77;
  (forgedMaterialized as unknown as { kernel: { stateBefore: HelperTableState; stateAfter: HelperTableState } }).kernel = {
    stateBefore: forgedStateBefore,
    stateAfter: forgedStateAfter,
  };
  const forgedMaterializedAuthority = synchronizedAuthority(authority, forgedMaterializedProgram);
  freezeFixtureGraph(forgedMaterializedProgram);
  freezeFixtureGraph(forgedMaterializedAuthority);
  const alteredTransition = buildX4UiScene({
    ...result,
    program: forgedMaterializedProgram,
    evidenceAuthority: forgedMaterializedAuthority,
  }, corpus, projected.profile);
  assert(refusalHasNoScene(alteredTransition), `forged materialized transition must refuse before Scene geometry: ${JSON.stringify(alteredTransition)}`);

  const forgedSourceAuthority = cloneJsonValue(authority) as unknown as Record<string, unknown>;
  const authorityOperations = forgedSourceAuthority.operations as Record<string, unknown>[];
  const unresolvedAuthorityOperation = authorityOperations.find(operationNode => operationNode.kind === 'setDefaultComplexCellProperties');
  assert(unresolvedAuthorityOperation !== undefined, 'source-authority forgery requires the unresolved complex operation');
  unresolvedAuthorityOperation.sourceOrder = (unresolvedAuthorityOperation.sourceOrder as number) + 1;
  freezeFixtureGraph(forgedSourceAuthority);
  const alteredSource = buildX4UiScene({
    ...result,
    evidenceAuthority: forgedSourceAuthority as unknown as X4UiLayoutEvidenceAuthority,
  }, corpus, projected.profile);
  assert(refusalHasNoScene(alteredSource), `altered unresolved source authority must refuse before Scene geometry: ${JSON.stringify(alteredSource)}`);
});

test('missing colors and hostile black-inset geometry do not flip the source-proven default text branch', () => {
  const scene = sceneFromRaw([
    'local menu = { name = "EditHostilePaint", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(1, { width = 40, reserveScrollBar = false })',
    'table:setColWidth(1, 40, false)',
    'local row = table:addRow(false, {})',
    'row[1]:createEditBox({ width = 4, height = 4, defaultText = "DEFAULT" }):setText("", { x = 5, y = 0 })',
    'frame:display()',
  ].join('\n'), 'selftest/raw-edit-hostile-paint.lua');
  const widget = scene.widgets.find(candidate => candidate.kind === 'editbox')!;
  const text = scene.texts.find(candidate => candidate.widgetId === widget.id)!;
  assert(text.contentSelection === 'preview-default' && text.defaultContent === 'DEFAULT', `missing color and unusable chrome geometry must not alter source text selection: ${JSON.stringify({ text, widget })}`);
  assert(text.layout === undefined && widget.colorFacts?.some(fact => fact.slot === 'editbox-inner-background') !== true, 'paint gaps must fail closed without fabricated glyph/chrome evidence');
  assert(scene.gaps.some(gap => gap.nodeId === widget.id && gap.reason.includes('source-scaled black inset')), `hostile inner geometry must remain an explicit gap: ${JSON.stringify(scene.gaps)}`);
});

test('keeps edit-box width unavailable when the raw text offset is unavailable', () => {
  const scene = sceneFromRaw([
    'local menu = { name = "EditWidth", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(1, { width = 40, reserveScrollBar = false })',
    'table:setColWidth(1, 40, false)',
    'local row = table:addRow(false, {})',
    'row[1]:createEditBox({ height = 10, text = "edit", defaultText = "DEFAULT" })',
    'frame:display()',
  ].join('\n'), 'selftest/raw-edit-width.lua');
  const widget = scene.widgets.find(candidate => candidate.kind === 'editbox')!;
  const text = scene.texts.find(candidate => candidate.widgetId === widget.id)!;
  assert(widget.outerRect !== undefined && widget.diagnosticStyle.geometry === 'source-derived', 'known edit-box geometry must survive unavailable text policy facts');
  assert(text.availableWidth !== undefined || text.diagnosticLinks.length > 0, 'edit-box width must remain source-linked or explicitly unavailable');
});

test('subtracts both row-group boundaries for a full-span fixed row', () => {
  const scene = sceneFromRaw([
    'local menu = { name = "FullSpanGroup", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(4, { width = 80, reserveScrollBar = false })',
    'table:setColWidth(1, 20, false)', 'table:setColWidth(2, 20, false)', 'table:setColWidth(3, 20, false)', 'table:setColWidth(4, 20, false)',
    'local row = table:addRow(false, { paddingTop = 1, paddingBottom = 1, borderBelow = false, fixed = true, groupIndex = 1 })',
    'row[1]:setColSpan(4)',
    'frame:display()',
  ].join('\n'), 'selftest/raw-full-span-group.lua');
  const anchor = scene.cells.find(cell => cell.column === 1)!;
  assert(anchor.hidden === false && anchor.rect !== undefined, 'source full-span group anchor must retain source geometry');
  assert(scene.cells.some(cell => cell.hidden === true), 'source full-span group must retain hidden colspan slots');
});

test('does not guess nested row-group transitions without an accepted active-group stack', () => {
  const scene = sceneFromRaw([
    'local menu = { name = "NestedGroups", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(1, { width = 40, reserveScrollBar = false })',
    'table:setColWidth(1, 40, false)',
    'local first = table:addRow(false, { groupIndex = 1 })',
    'first[1]:createText("first", { height = 8 })',
    'local second = table:addRow(false, { groupIndex = 2 })',
    'second[1]:createText("second", { height = 8 })',
    'frame:display()',
  ].join('\n'), 'selftest/raw-nested-groups.lua');
  assert(scene.status === 'partial' || scene.rows.every(row => row.rect !== undefined), 'nested group status must remain explicit rather than guessed');
});

test('rejects disconnected re-entry of one row group instead of reopening it heuristically', () => {
  const projected = rawProjectionFor([
    'local menu = { name = "DisconnectedGroups", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(1, { width = 40, reserveScrollBar = false })',
    'table:setColWidth(1, 40, false)',
    'local first = table:addRow(false, { groupIndex = 1 })',
    'first[1]:createText("first", { height = 8 })',
    'local middle = table:addRow(false, {})',
    'middle[1]:createText("middle", { height = 8 })',
    'local reentry = table:addRow(false, { groupIndex = 1 })',
    'reentry[1]:createText("reentry", { height = 8 })',
    'frame:display()',
  ].join('\n'), 'selftest/raw-disconnected-groups.lua');
  assert(projected.result !== undefined && projected.profile !== undefined, 'disconnected group producer result must remain explicit');
  const scene = sceneOf(buildX4UiScene(projected.result as X4UiLayoutProgramResult, corpus, projected.profile));
  assert(scene.status === 'partial' || scene.rows.length > 0, 'disconnected group evidence must not be silently discarded');
});

test('accepts a structurally valid partial program and keeps a known sibling beside an unavailable child', () => {
  const scene = sceneFromRaw([
    'local menu = { name = "PartialSibling", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(2, { width = 80, reserveScrollBar = false })',
    'table:setColWidth(1, 40, false)', 'table:setColWidth(2, 40, false)',
    'local row = table:addRow(false, {})',
    'row[1]:createText("known", { height = 10 })',
    'row[2]:createButton(dynamic_options)',
    'frame:display()',
  ].join('\n'), 'selftest/raw-partial-sibling.lua');
  assert(scene.status === 'partial' && scene.programStatus === 'partial', 'partial program must remain partial, not refused or complete');
  assert(scene.widgets.some(widget => widget.kind === 'text'), 'known text sibling must survive the unavailable button');
  assert(scene.gaps.length > 0, 'unavailable child must retain source-linked gaps');
});

test('refuses orphan and non-reciprocal row/cell ownership before geometry', () => {
  const fixture = makeFixture();
  const assertMalformed = (program: X4UiLayoutProgram, label: string): void => {
    const result = sceneFor(fixture, program);
    assert(result.status === 'refused' && !('scene' in result), `${label} must refuse before scene geometry at the public evidence boundary`);
  };

  const orphanRow = cloneProgram(fixture.program);
  (orphanRow.rows as unknown as X4UiLayoutRowNode[]).push({
    ...orphanRow.rows[0],
    id: 'row:orphan',
    source: source(360),
    tableId: undefined,
    rowIndex: 3,
    cellIds: [],
    operationIds: [],
    kernelState: undefined,
    height: { status: 'known', value: 1 },
  });
  assertMalformed(orphanRow, 'orphan row');

  const missingRowOwner = cloneProgram(fixture.program);
  delete (missingRowOwner.rows[0] as unknown as { tableId?: string }).tableId;
  assertMalformed(missingRowOwner, 'row missing reciprocal tableId');

  const orphanCell = cloneProgram(fixture.program);
  (orphanCell.cells as unknown as X4UiLayoutCellNode[]).push({
    ...orphanCell.cells.find(cell => cell.id === 'cell:hidden-tail')!,
    id: 'cell:orphan',
    source: source(370),
    tableId: undefined,
    rowId: undefined,
    rowIndex: undefined,
    operationIds: [],
    metadataOperationIds: [],
  });
  assertMalformed(orphanCell, 'orphan cell');

  const missingCellOwner = cloneProgram(fixture.program);
  const missingCell = missingCellOwner.cells.find(cell => cell.id === 'cell:text') as unknown as { rowId?: string; tableId?: string };
  delete missingCell.rowId;
  delete missingCell.tableId;
  assertMalformed(missingCellOwner, 'cell missing reciprocal row/table ownership');

  const mismatchedRowOwner = cloneProgram(fixture.program);
  (mismatchedRowOwner.rows[0] as unknown as { tableId: string }).tableId = 'table:other';
  assertMalformed(mismatchedRowOwner, 'mismatched row owner');

  const mismatchedCellOwner = cloneProgram(fixture.program);
  (mismatchedCellOwner.cells.find(cell => cell.id === 'cell:text') as unknown as { tableId: string }).tableId = 'table:other';
  assertMalformed(mismatchedCellOwner, 'mismatched cell table owner');
});

test('refuses missing reciprocal frame/table ownership before scene geometry', () => {
  const fixture = makeFixture();
  const missingReciprocal = cloneProgram(fixture.program);
  delete (missingReciprocal.tables[0] as unknown as { frameId?: string }).frameId;
  assert(refusalHasNoScene(sceneFor(fixture, missingReciprocal)), 'a frame-owned table without table.frameId must refuse rather than infer its parent');

  const orphanTableProgram = cloneProgram(fixture.program);
  const orphanTable: X4UiLayoutTableNode = {
    ...orphanTableProgram.tables[0],
    id: 'table:orphan',
    source: source(360),
    frameId: undefined,
    rowIds: [],
    operationIds: [],
  };
  (orphanTableProgram.tables as unknown as X4UiLayoutTableNode[]).push(orphanTable);
  assert(refusalHasNoScene(sceneFor(fixture, orphanTableProgram)), 'an unowned table must not reach a successful scene with no parent');

  const duplicateRowIndex = cloneProgram(fixture.program);
  (duplicateRowIndex.rows[1] as unknown as { rowIndex: number }).rowIndex = 1;
  assert(refusalHasNoScene(sceneFor(fixture, duplicateRowIndex)), 'two distinct owned rows in one table cannot share a known rowIndex');

  const duplicateColumn = cloneProgram(fixture.program);
  (duplicateColumn.cells.find(cell => cell.id === 'cell:button') as unknown as { column: number }).column = 1;
  assert(refusalHasNoScene(sceneFor(fixture, duplicateColumn)), 'two distinct cells in one row cannot share a known source column');
});

test('refuses generated scene-ID namespace collisions before emitting a duplicate graph', () => {
  const renameLastCell = (program: X4UiLayoutProgram, nextId: string): void => {
    const cell = program.cells.find(candidate => candidate.id === 'cell:fixed-last')!;
    const previousId = cell.id;
    (cell as unknown as { id: string }).id = nextId;
    const row = program.rows.find(candidate => candidate.id === 'row:two')!;
    const cellIds = row.cellIds as unknown as string[];
    const cellIndex = cellIds.indexOf(previousId);
    cellIds[cellIndex] = nextId;
    const operation = program.operations.find(candidate => candidate.id === 'op:fixed-last')!;
    (operation as unknown as { cellId: string }).cellId = nextId;
  };

  const directVsWidget = cloneProgram(makeFixture().program);
  renameLastCell(directVsWidget, 'widget:cell:button:button');
  assert(refusalHasNoScene(sceneFor(makeFixture(), directVsWidget)), 'direct cell ID must not collide with a generated widget ID');

  const directVsText = cloneProgram(makeFixture().program);
  renameLastCell(directVsText, 'text:cell:text:primary');
  assert(refusalHasNoScene(sceneFor(makeFixture(), directVsText)), 'direct cell ID must not collide with a generated text ID');
});

test('refuses refused results, stale identities, malformed structure, duplicate IDs, and unsafe dimensions before geometry', () => {
  const fixture = makeFixture();
  const refused = buildX4UiScene({ status: 'refused', refusal: { code: 'source-mismatch', message: 'fixture refusal' } } as never, fixture.corpus, fixture.profile);
  assert(refused.status === 'refused', 'refused result must not create a scene');
  const stale = { ...fixture.profile, helper: { ...fixture.profile.helper, sha256: HASH } } as X4UiSceneProfile;
  assert(sceneFor(fixture, fixture.program, stale).status === 'refused', 'stale helper identity must refuse');
  const malformed = cloneProgram(fixture.program);
  (malformed as unknown as { frames: unknown[] }).frames = [];
  assert(sceneFor(fixture, malformed).status === 'refused', 'missing frame structure must refuse');
  const duplicate = cloneProgram(fixture.program);
  (duplicate.tables[0] as unknown as { id: string }).id = duplicate.frames[0].id;
  assert(refusalHasNoScene(sceneFor(fixture, duplicate)), 'duplicate IDs must refuse before a scene payload');
  const duplicateRowReference = cloneProgram(fixture.program);
  (duplicateRowReference.tables[0].rowIds as unknown as string[]).push('row:one');
  assert(refusalHasNoScene(sceneFor(fixture, duplicateRowReference)), 'repeated table row references must refuse before duplicate scene rows');
  const duplicateCellReference = cloneProgram(fixture.program);
  (duplicateCellReference.rows[0].cellIds as unknown as string[]).push('cell:text');
  assert(refusalHasNoScene(sceneFor(fixture, duplicateCellReference)), 'repeated row cell references must refuse before duplicate scene cells');
  const mismatchedFrameOwner = cloneProgram(fixture.program);
  (mismatchedFrameOwner.frames[0].tableIds as unknown as string[]).length = 0;
  assert(refusalHasNoScene(sceneFor(fixture, mismatchedFrameOwner)), 'known table/frame ownership mismatch must refuse before geometry');
  const mismatchedCellOwner = cloneProgram(fixture.program);
  (mismatchedCellOwner.cells.find(cell => cell.id === 'cell:text') as unknown as { rowId: string }).rowId = 'row:two';
  assert(refusalHasNoScene(sceneFor(fixture, mismatchedCellOwner)), 'known cell/row ownership mismatch must refuse before geometry');
  const mismatchedOperationOwner = cloneProgram(fixture.program);
  (mismatchedOperationOwner.operations.find(operation => operation.id === 'op:text') as unknown as { rowId: string }).rowId = 'row:two';
  assert(refusalHasNoScene(sceneFor(fixture, mismatchedOperationOwner)), 'known operation/row ownership mismatch must refuse before geometry');
  const unsafe = cloneProgram(fixture.program);
  (unsafe.frames[0].descriptorFacts as Record<string, X4UiLayoutDescriptorFact>).width = known(Number.NaN, 'number', unsafe.frames[0].source);
  assert(refusalHasNoScene(sceneFor(fixture, unsafe)), 'unsafe descriptor dimensions must refuse');
  const negativeFrame = cloneProgram(fixture.program);
  (negativeFrame.frames[0].descriptorFacts as Record<string, X4UiLayoutDescriptorFact>).width = known(-1, 'number', negativeFrame.frames[0].source);
  assert(refusalHasNoScene(sceneFor(fixture, negativeFrame)), 'negative frame width must refuse before geometry');
  const negativeTable = cloneProgram(fixture.program);
  (negativeTable.tables[0].descriptorFacts as Record<string, X4UiLayoutDescriptorFact>).maxVisibleHeight = known(-1, 'number', negativeTable.tables[0].source);
  assert(refusalHasNoScene(sceneFor(fixture, negativeTable)), 'negative table viewport height must refuse before geometry');
  const negativePadding = cloneProgram(fixture.program);
  (negativePadding.rows[0].descriptorFacts as Record<string, X4UiLayoutDescriptorFact>).paddingTop = known(-1, 'number', negativePadding.rows[0].source);
  assert(refusalHasNoScene(sceneFor(fixture, negativePadding)), 'negative row padding must refuse before geometry');
  const negativeOuter = cloneProgram(fixture.program);
  (negativeOuter.cells.find(cell => cell.id === 'cell:text')!.descriptorFacts as Record<string, X4UiLayoutDescriptorFact>).outerWidth = known(-1, 'number', source(253));
  assert(refusalHasNoScene(sceneFor(fixture, negativeOuter)), 'negative widget width must refuse before geometry');
  const negativeSpan = cloneProgram(fixture.program);
  (negativeSpan.cells.find(cell => cell.id === 'cell:hidden')!.descriptorFacts as Record<string, X4UiLayoutDescriptorFact>).span = known(-1, 'number', source(254));
  assert(refusalHasNoScene(sceneFor(fixture, negativeSpan)), 'negative span must refuse before geometry');
  const invalidFontSize = cloneProgram(fixture.program);
  (invalidFontSize.cells.find(cell => cell.id === 'cell:text')!.descriptorFacts as Record<string, X4UiLayoutDescriptorFact>).fontsize = known(0, 'number', source(255));
  assert(refusalHasNoScene(sceneFor(fixture, invalidFontSize)), 'non-positive consumed font size must refuse before geometry');
  const malformedPreview = cloneProgram(fixture.program);
  (malformedPreview as unknown as { previewSampleBindings: unknown[] }).previewSampleBindings = [{
    id: 'bad', value: 1, expectedType: 'number', source: source(250), provenance: 'preview-only', status: 'consumed', extra: 1,
  }];
  assert(sceneFor(fixture, malformedPreview).status === 'refused', 'extra preview fields must refuse before geometry');
  const functionPreview = cloneProgram(fixture.program);
  (functionPreview as unknown as { previewSampleBindings: unknown[] }).previewSampleBindings = [{
    id: 'bad', value: () => 1, expectedType: 'number', source: source(251), provenance: 'preview-only', status: 'consumed',
  }];
  assert(sceneFor(fixture, functionPreview).status === 'refused', 'function preview values must refuse serialization boundary');
  const malformedPath = cloneProgram(fixture.program);
  (malformedPath as unknown as { localExpansion: unknown }).localExpansion = {
    previewPathSelections: [{ id: 'path', boundaryId: 'boundary', armId: 'arm', boundary: source(252), provenance: 'preview-only', extra: 1 }],
  };
  assert(sceneFor(fixture, malformedPath).status === 'refused', 'extra local preview path fields must refuse before geometry');
  const acceptedResult = rawProducerProjection.result;
  assert(acceptedResult !== undefined && 'program' in acceptedResult && acceptedResult.program !== undefined && 'evidenceAuthority' in acceptedResult && acceptedResult.evidenceAuthority !== undefined, 'real producer wrapper is required for canonical asset negatives');
  const unsupportedAssets = { ...fixture.assets, Other: fixture.assets.Zekton } as unknown as X4UiSceneFontAssetMap;
  assert(refusalHasNoScene(buildX4UiScene(acceptedResult, unsupportedAssets as never, rawProducerProjection.profile!)), 'unsupported extra font asset pair must refuse before geometry');
  const staleAssets = {
    ...fixture.assets,
    Zekton: {
      ...fixture.assets.Zekton,
      atlasIdentity: { ...fixture.assets.Zekton.atlasIdentity, sha256: HASH },
    },
  } as X4UiSceneFontAssetMap;
  assert(refusalHasNoScene(buildX4UiScene(acceptedResult, staleAssets as never, rawProducerProjection.profile!)), 'stale font asset identity must refuse before geometry');
  const staleSourcePath = cloneProgram(fixture.program);
  (staleSourcePath.target.sourceIdentity as unknown as { sourcePath: unknown }).sourcePath = 42;
  assert(sceneFor(fixture, staleSourcePath).status === 'refused', 'malformed optional sourcePath must refuse');
  const malformedSource = cloneProgram(fixture.program);
  (malformedSource.frames[0].source as unknown as { extra: unknown }).extra = () => 1;
  assert(sceneFor(fixture, malformedSource).status === 'refused', 'non-serializable source-location extras must refuse');
  const malformedPin = cloneProgram(fixture.program);
  const pinFact = malformedPin.frames[0].descriptorFacts.width as Extract<X4UiLayoutDescriptorFact, { status: 'known' }>;
  (pinFact as unknown as { sourcePin: unknown }).sourcePin = { sourcePath: () => 1, lineStart: 1, lineEnd: 1 };
  assert(sceneFor(fixture, malformedPin).status === 'refused', 'non-serializable source pins must refuse');
  const badGroup = cloneProgram(fixture.program);
  (badGroup.tables[0].kernelState!.rowGroups[0] as unknown as { level: number }).level = Number.NaN;
  assert(sceneFor(fixture, badGroup).status === 'refused', 'NaN row-group level must refuse before geometry');
  const badRow = cloneProgram(fixture.program);
  (badRow.tables[0].kernelState!.rows[0] as unknown as { cells: Array<{ height: number }> }).cells[0].height = Number.NaN;
  assert(sceneFor(fixture, badRow).status === 'refused', 'malformed row cell height must refuse before geometry');
  const badBackgroundSpan = cloneProgram(fixture.program);
  (badBackgroundSpan.tables[0].kernelState!.rows[0].cells[3] as unknown as { bgcolspan: number }).bgcolspan = 2;
  assert(sceneFor(fixture, badBackgroundSpan).status === 'refused', 'background colspan overrun must refuse independently of foreground span');
  const badStateFlags = cloneProgram(fixture.program);
  (badStateFlags.tables[0].kernelState! as unknown as { createdWithScrollBar: unknown }).createdWithScrollBar = 'yes';
  assert(sceneFor(fixture, badStateFlags).status === 'refused', 'malformed kernel state flags must refuse before geometry');
});

test('applies discrete topRow draw semantics without hiding fixed rows or partially drawing overflow rows', () => {
  const sourceText = [
    'local menu = { name = "DiscreteTopRow", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(1, { width = 40, maxVisibleHeight = 20, reserveScrollBar = false })',
    'table:setColWidth(1, 40, false)',
    'local fixedRow = table:addRow(false, { paddingTop = 1, paddingBottom = 1, fixed = true })',
    'fixedRow[1]:createText("fixed", { height = 5 })',
    'local first = table:addRow(false, { paddingTop = 1, paddingBottom = 1, fixed = false })',
    'first[1]:createText("before", { height = 5 })',
    'local top = table:addRow(false, { paddingTop = 1, paddingBottom = 1, fixed = false })',
    'top[1]:createText("top", { height = 5 })',
    'local overflow = table:addRow(false, { paddingTop = 1, paddingBottom = 1, fixed = false })',
    'overflow[1]:createText("overflow", { height = 8 })',
    'frame:display()',
  ].join('\n');
  const projected = rawProjectionFor(sourceText, 'selftest/raw-discrete-top-row.lua');
  assert(projected.program !== undefined && projected.profile !== undefined && projected.result !== undefined && 'program' in projected.result, 'discrete topRow source must produce a real result');
  const tableId = projected.program.tables[0].id;
  const topRowProfile: X4UiSceneProfile = { ...projected.profile, tableView: { [tableId]: { topRow: 3 } } };
  const scene = sceneOf(buildX4UiScene(projected.result as X4UiLayoutProgramResult, corpus, topRowProfile));
  const fixed = scene.rows[0];
  const beforeTopRow = scene.rows[1];
  const topRow = scene.rows[2];
  const afterViewport = scene.rows[3];
  assert(fixed.rect !== undefined && fixed.visible === true, 'fixed rows must remain drawable under topRow selection');
  assert(beforeTopRow.naturalRect !== undefined && beforeTopRow.rect === undefined && beforeTopRow.visible === false, 'non-fixed rows before topRow must remain evidence but never draw');
  assert(topRow.rect !== undefined && topRow.visible === true && topRow.rect.y === beforeTopRow.naturalRect!.y, 'topRow must begin at the first normal-row slot below the effective fixed section');
  assert(beforeTopRow.clipRect?.width === 0 && topRow.clipRect?.y >= scene.tables[0].viewportRect!.y, 'pre-topRow clips must not enter the fixed section');
  assert(afterViewport.naturalRect !== undefined && afterViewport.rect === undefined && afterViewport.visible === false, 'a discrete topRow row exceeding the viewport must not be partially drawn');
  assert(afterViewport.clipRect?.width === 0 && afterViewport.clipRect?.height === 0, 'overflow topRow rows must retain an explicit zero clip');
  assert(scene.tables[0].provenanceLinks.some(link => link.sourcePin?.lineStart === 5942) && scene.tables[0].provenanceLinks.some(link => link.sourcePin?.lineStart === 6055), 'topRow projection must retain shipped draw-table source pins');
});

test('applies source discrete draw semantics by default without a tableView', () => {
  const scene = sceneFromRaw([
    'local menu = { name = "DiscreteDefault", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(1, { width = 40, maxVisibleHeight = 20, reserveScrollBar = false })',
    'table:setColWidth(1, 40, false)',
    'local fixedRow = table:addRow(false, { paddingTop = 1, paddingBottom = 1, fixed = true })',
    'fixedRow[1]:createText("fixed", { height = 5 })',
    'local first = table:addRow(false, { paddingTop = 1, paddingBottom = 1, fixed = false })',
    'first[1]:createText("first", { height = 5 })',
    'local second = table:addRow(false, { paddingTop = 1, paddingBottom = 1, fixed = false })',
    'second[1]:createText("second", { height = 5 })',
    'local overflow = table:addRow(false, { paddingTop = 1, paddingBottom = 1, fixed = false })',
    'overflow[1]:createText("overflow", { height = 8 })',
    'frame:display()',
  ].join('\n'), 'selftest/raw-discrete-default.lua');
  const fixed = scene.rows[0];
  const firstNormal = scene.rows[1];
  const overflow = scene.rows[3];
  assert(fixed.rect !== undefined && fixed.visible === true, 'default discrete drawing must retain a fitting fixed row');
  assert(firstNormal.rect !== undefined && firstNormal.visible === true, 'default topRow must begin at the first effective non-fixed row');
  assert(overflow.naturalRect !== undefined && overflow.rect === undefined && overflow.visible === false, 'default discrete drawing must reject a whole row that exceeds the table height');
  assert(overflow.clipRect?.width === 0 && overflow.clipRect?.height === 0, 'default-rejected rows must retain an explicit zero clip');
  assert(scene.tables[0].provenanceLinks.some(link => link.sourcePin?.lineStart === 5942) && scene.tables[0].provenanceLinks.some(link => link.sourcePin?.lineStart === 6055), 'default discrete drawing must retain shipped draw-table source pins');
});

test('rejects a whole row beyond visible draw height even when it remains below full content height', () => {
  const projected = rawProjectionFor([
    'local menu = { name = "VisibleBoundary", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(1, { width = 40, maxVisibleHeight = 20, reserveScrollBar = false })',
    'table:setColWidth(1, 40, false)',
    'local first = table:addRow(false, { paddingTop = 1, paddingBottom = 1, fixed = false })',
    'first[1]:createText("first", { height = 5 })',
    'local second = table:addRow(false, { paddingTop = 1, paddingBottom = 1, fixed = false })',
    'second[1]:createText("second", { height = 5 })',
    'local third = table:addRow(false, { paddingTop = 1, paddingBottom = 1, fixed = false })',
    'third[1]:createText("third", { height = 4 })',
    'local last = table:addRow(false, { paddingTop = 1, paddingBottom = 1, fixed = false })',
    'last[1]:createText("last", { height = 4 })',
    'frame:display()',
  ].join('\n'), 'selftest/raw-visible-boundary.lua');
  assert(projected.program !== undefined && projected.profile !== undefined && projected.result !== undefined && 'program' in projected.result, 'visible-boundary source must produce a real result');
  const scene = sceneOf(buildX4UiScene(projected.result as X4UiLayoutProgramResult, corpus, projected.profile));
  const table = scene.tables[0];
  const rowNode = scene.rows[3];
  assert(table.rect !== undefined && table.fullHeight !== undefined && table.visibleHeight !== undefined && table.fullHeight > table.visibleHeight, 'fixture must separate full content height from visible draw height');
  assert(rowNode.naturalRect !== undefined && rowNode.naturalRect.y + rowNode.naturalRect.height > table.rect.y + table.rect.height && rowNode.naturalRect.y + rowNode.naturalRect.height <= table.rect.y + table.fullHeight, `fixture row must fall strictly between visible and full table-height boundaries: ${JSON.stringify({ natural: rowNode.naturalRect, rect: table.rect, full: table.fullHeight })}`);
  assert(rowNode.rect === undefined && rowNode.visible === false, `drawTableSection must reject the whole row beyond tableElement.height: ${JSON.stringify({ rect: rowNode.rect, visible: rowNode.visible, natural: rowNode.naturalRect, table: table.rect, links: rowNode.diagnosticLinks })}`);
});

test('continues into normal rows after a known overflowing fixed row', () => {
  const scene = sceneFromRaw([
    'local menu = { name = "FixedOverflowContinue", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(1, { width = 40, maxVisibleHeight = 20, reserveScrollBar = false })',
    'table:setColWidth(1, 40, false)',
    'local early = table:addRow(false, { paddingTop = 1, paddingBottom = 1, fixed = true })',
    'early[1]:createText("early", { height = 5 })',
    'local overflowing = table:addRow(false, { paddingTop = 1, paddingBottom = 1, fixed = true })',
    'overflowing[1]:createText("overflowing", { height = 25 })',
    'local normal = table:addRow(false, { paddingTop = 1, paddingBottom = 1, fixed = false })',
    'normal[1]:createText("normal", { height = 5 })',
    'frame:display()',
  ].join('\n'), 'selftest/raw-fixed-overflow-continue.lua');
  const earlyFixed = scene.rows[0];
  const overflowingFixed = scene.rows[1];
  const firstNormal = scene.rows[2];
  assert(earlyFixed.rect !== undefined && earlyFixed.visible === true, 'the early fixed row must remain accepted');
  assert(overflowingFixed.naturalRect !== undefined && overflowingFixed.rect === undefined && overflowingFixed.visible === false, 'the later fixed row must stop at its source overflow');
  assert(firstNormal.rect !== undefined && firstNormal.visible === true, 'the normal section must continue from the returned accepted fixed height');
});

test('counts fixed-group termination before normal-row acceptance after fixed overflow', () => {
  const scene = sceneFromRaw([
    'local menu = { name = "FixedOverflowClose", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(1, { width = 40, maxVisibleHeight = 19, reserveScrollBar = false })',
    'table:setColWidth(1, 40, false)',
    'local early = table:addRow(false, { paddingTop = 1, paddingBottom = 1, fixed = true, groupIndex = 1 })',
    'early[1]:createText("early", { height = 5 })',
    'local overflowing = table:addRow(false, { paddingTop = 1, paddingBottom = 1, fixed = true, groupIndex = 1 })',
    'overflowing[1]:createText("overflowing", { height = 25 })',
    'local normal = table:addRow(false, { paddingTop = 1, paddingBottom = 1, fixed = false })',
    'normal[1]:createText("normal", { height = 5 })',
    'frame:display()',
  ].join('\n'), 'selftest/raw-fixed-overflow-close.lua');
  const firstNormal = scene.rows[2];
  assert(firstNormal.naturalRect !== undefined && (firstNormal.rect === undefined || firstNormal.rect.y > scene.tables[0].rect!.y), 'the fixed group termination contribution must remain visible in normal-section progression');
  assert(scene.tables[0].provenanceLinks.some(link => link.sourcePin?.lineStart === 6055), 'fixed-overflow ledger must retain drawTableSection source provenance');
});

test('accepts a no-group row before adding its current padding to the draw ledger', () => {
  const scene = sceneFromRaw([
    'local menu = { name = "LedgerPadding", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(1, { width = 40, maxVisibleHeight = 12, reserveScrollBar = false })',
    'table:setColWidth(1, 40, false)',
    'local row = table:addRow(false, { paddingTop = 3, paddingBottom = 1, borderBelow = false, fixed = false })',
    'row[1]:createText("padding", { height = 8 })',
    'frame:display()',
  ].join('\n'), 'selftest/raw-ledger-padding.lua');
  const table = scene.tables[0];
  const row = scene.rows[0];
  assert(table.visibleHeight !== undefined && row.naturalRect !== undefined && table.visibleHeight >= row.naturalRect.height, 'fixture must retain a source-known draw height and current row height');
  assert(row.paddingTop !== undefined && row.paddingTop > 0, 'fixture must retain positive current paddingTop');
  assert(row.rect !== undefined, 'source accepts the row before adding current padding to curtableheight');
  assert(row.clipRect !== undefined, 'accepted row must retain a known table clip after draw acceptance');
});

test('accepts a supported single-group first row before its group opening contribution', () => {
  const scene = sceneFromRaw([
    'local menu = { name = "LedgerGroup", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(1, { width = 40, maxVisibleHeight = 20, reserveScrollBar = false })',
    'table:setColWidth(1, 40, false)',
    'local row = table:addRow(false, { paddingTop = 1, paddingBottom = 1, borderBelow = false, fixed = false, groupIndex = 1 })',
    'row[1]:createText("group", { height = 8 })',
    'frame:display()',
  ].join('\n'), 'selftest/raw-ledger-group.lua');
  const row = scene.rows[0];
  assert(row.rect !== undefined, 'a supported first group row is accepted before the opening contribution is added');
  assert(!row.diagnosticLinks.some(id => scene.gaps.find(gap => gap.id === id)?.reason.includes('row-group topology is ambiguous') === true), 'supported single-group topology must not be downgraded to an ambiguity gap');
});

test('counts successful fixed-group termination before normal-row acceptance and display placement', () => {
  const scene = sceneFromRaw([
    'local menu = { name = "GroupedFixedBoundary", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(1, { width = 40, maxVisibleHeight = 32, reserveScrollBar = false })',
    'table:setColWidth(1, 40, false)',
    'local fixedOne = table:addRow(false, { paddingTop = 1, paddingBottom = 1, fixed = true, groupIndex = 1 })',
    'fixedOne[1]:createText("one", { height = 10 })',
    'local fixedTwo = table:addRow(false, { paddingTop = 1, paddingBottom = 1, fixed = true, groupIndex = 1 })',
    'fixedTwo[1]:createText("two", { height = 10 })',
    'local normal = table:addRow(false, { paddingTop = 1, paddingBottom = 1, fixed = false })',
    'normal[1]:createText("normal", { height = 5 })',
    'frame:display()',
  ].join('\n'), 'selftest/raw-grouped-fixed-boundary.lua');
  const fixedEnd = scene.rows[1];
  const normal = scene.rows[2];
  assert(fixedEnd.rect !== undefined && normal.rect !== undefined, 'the grouped fixed boundary fixture must retain both accepted sections');
  assert(normal.rect.y > fixedEnd.rect.y, 'normal row must start after the accepted fixed section closure');
  assert(scene.tables[0].provenanceLinks.some(link => link.sourcePin?.lineStart === 6429), 'successful fixed-section closure must retain the shipped source pin');
});

test('uses full table height when helper available height is exactly zero', () => {
  const scene = sceneFromRaw([
    'local menu = { name = "AvailableZero", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 60 })',
    'local table = frame:addTable(1, { width = 40, y = 60, maxVisibleHeight = 5, reserveScrollBar = false })',
    'table:setColWidth(1, 40, false)',
    'local row = table:addRow(false, {})',
    'row[1]:createText("zero", { height = 10 })',
    'frame:display()',
  ].join('\n'), 'selftest/raw-available-zero.lua');
  const projected = scene.tables[0];
  assert(projected.descriptorHasScrollBar === false, 'availableHeight zero must not invent a scrollbar');
  assert(projected.fullHeight !== undefined && projected.visibleHeight === projected.fullHeight && projected.rect?.height === projected.fullHeight, 'availableHeight zero must preserve full table height');
  assert(projected.viewportRect?.width === 0 && projected.viewportRect.height === 0, 'availableHeight zero must retain a known-empty viewport');
  assert(projected.diagnosticLinks.some(id => scene.gaps.find(gap => gap.id === id)?.reason.includes('table lies outside the parent frame')), 'outside-parent diagnostic must remain source-linked');
});

test('uses full table height when helper available height is negative', () => {
  const scene = sceneFromRaw([
    'local menu = { name = "AvailableNegative", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 60 })',
    'local table = frame:addTable(1, { width = 40, y = 61, maxVisibleHeight = 5, reserveScrollBar = false })',
    'table:setColWidth(1, 40, false)',
    'local row = table:addRow(false, {})',
    'row[1]:createText("negative", { height = 10 })',
    'frame:display()',
  ].join('\n'), 'selftest/raw-available-negative.lua');
  const projected = scene.tables[0];
  assert(projected.descriptorHasScrollBar === false, 'negative availableHeight must not invent a scrollbar');
  assert(projected.fullHeight !== undefined && projected.visibleHeight === projected.fullHeight && projected.rect?.height === projected.fullHeight, 'negative availableHeight must preserve full table height');
  assert(projected.viewportRect?.width === 0 && projected.viewportRect.height === 0, 'negative availableHeight must retain a known-empty viewport');
  assert(projected.diagnosticLinks.some(id => scene.gaps.find(gap => gap.id === id)?.reason.includes('table lies outside the parent frame')), 'outside-parent diagnostic must remain source-linked');
});

test('applies table-height rejection to fixed rows while keeping drawable clipping separate', () => {
  const fixedScene = sceneFromRaw([
    'local menu = { name = "FixedHeight", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(1, { width = 40, maxVisibleHeight = 5, reserveScrollBar = false })',
    'table:setColWidth(1, 40, false)',
    'local row = table:addRow(false, { fixed = true })',
    'row[1]:createText("too tall", { height = 10 })',
    'frame:display()',
  ].join('\n'), 'selftest/raw-fixed-height.lua');
  const fixedRow = fixedScene.rows[0];
  assert(fixedRow.naturalRect !== undefined && fixedRow.rect === undefined && fixedRow.visible === false, 'a fixed row exceeding the table height must not be partially drawn');

  const clippedProjection = rawProjectionFor([
    'local menu = { name = "DrawableClip", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 100 })',
    'local table = frame:addTable(1, { width = 40, y = 90, maxVisibleHeight = 80, reserveScrollBar = false })',
    'table:setColWidth(1, 40, false)',
    'local row = table:addRow(false, { fixed = true })',
    'row[1]:createText("clipped", { height = 60 })',
    'frame:display()',
  ].join('\n'), 'selftest/raw-drawable-clip.lua');
  assert(clippedProjection.result !== undefined && 'program' in clippedProjection.result && clippedProjection.profile !== undefined, 'drawable clip source must produce a real result');
  const clippedScene = sceneOf(buildX4UiScene(clippedProjection.result as X4UiLayoutProgramResult, corpus, clippedProjection.profile));
  const clippedRow = clippedScene.rows[0];
  assert(clippedScene.tables[0].clipRect !== undefined && (clippedRow.rect === undefined || clippedRow.clipRect !== undefined), 'table-height acceptance must retain the known parent drawable clip');
  if (clippedRow.rect !== undefined && clippedRow.clipRect !== undefined) {
    assert(clippedRow.rect.y + clippedRow.rect.height > clippedScene.drawableRect.height && clippedRow.clipRect.y + clippedRow.clipRect.height <= clippedScene.drawableRect.height, 'table-height acceptance must precede drawable clipping');
  }
});

test('keeps explicit pixel scroll as preview-only free scrolling', () => {
  const projected = rawProjectionFor([
    'local menu = { name = "PixelScroll", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(1, { width = 40, maxVisibleHeight = 30, reserveScrollBar = false })',
    'table:setColWidth(1, 40, false)',
    'local first = table:addRow(false, { fixed = false })',
    'first[1]:createText("first", { height = 8 })',
    'local second = table:addRow(false, { fixed = false })',
    'second[1]:createText("second", { height = 8 })',
    'frame:display()',
  ].join('\n'), 'selftest/raw-pixel-scroll.lua');
  assert(projected.program !== undefined && projected.profile !== undefined && projected.result !== undefined && 'program' in projected.result, 'pixel-scroll source must produce a real result');
  const profile: X4UiSceneProfile = { ...projected.profile, tableView: { [projected.program.tables[0].id]: { scrollOffset: 4 } } };
  const scene = sceneOf(buildX4UiScene(projected.result as X4UiLayoutProgramResult, corpus, profile));
  const table = scene.tables[0];
  const row = scene.rows[0];
  assert(row.rect !== undefined && row.naturalRect !== undefined && row.rect.y === row.naturalRect.y - 4, 'explicit scrollOffset must retain free pixel translation rather than discrete topRow placement');
  assert(table.provenanceLinks.some(link => link.kind === 'preview-only'), 'explicit scrollOffset must remain preview-only evidence');
  assert(!table.provenanceLinks.some(link => link.sourcePin?.lineStart === 5942), 'explicit scrollOffset must not be labeled as exact engine topRow truth');
});

test('keeps unknown frame/table geometry as gaps without fabricating rectangles', () => {
  const frameScene = sceneFromRaw([
    'local menu = { name = "UnknownFrame", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, dynamic_options)',
    'frame:display()',
  ].join('\n'), 'selftest/raw-unknown-frame.lua');
  assert(frameScene.frames[0].rect === undefined && frameScene.status === 'partial', 'unknown frame width must not become a numeric rectangle');
  const tableScene = sceneFromRaw([
    'local menu = { name = "UnknownTable", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(1, dynamic_options)',
    'frame:display()',
  ].join('\n'), 'selftest/raw-unknown-table.lua');
  assert(tableScene.tables[0].columns === undefined, 'unknown scrollbar decision must not reuse pre-descriptor widths');
  assert(tableScene.gaps.some(gap => gap.category === 'table' || gap.category === 'geometry'), 'unknown table facts must remain linked gaps');
});

test('retains independent table and natural-row geometry when fixed membership is unknown', () => {
  const scene = sceneFromRaw([
    'local menu = { name = "UnknownFixed", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(1, { width = 40, maxVisibleHeight = 20, reserveScrollBar = true })',
    'table:setColWidth(1, 40, false)',
    'local row = table:addRow(false, dynamic_options)',
    'frame:display()',
  ].join('\n'), 'selftest/raw-unknown-fixed.lua');
  const table = scene.tables[0];
  assert(table.columns !== undefined || table.diagnosticLinks.length > 0, 'table and normal-column evidence must survive unknown fixed membership');
  assert(scene.rows.length === 0 || scene.rows[0].rect === undefined || scene.gaps.length > 0, 'unmaterialized unknown fixed row must remain evidence without display geometry');
});

test('propagates unknown vertical contributions without zero-substituting downstream rows', () => {
  const scene = sceneFromRaw([
    'local menu = { name = "UnknownVertical", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(1, { width = 40, reserveScrollBar = false })',
    'table:setColWidth(1, 40, false)',
    'local first = table:addRow(false, dynamic_options)',
    'local second = table:addRow(false, { paddingTop = 1, paddingBottom = 1 })',
    'second[1]:createText("second", { height = 8 })',
    'frame:display()',
  ].join('\n'), 'selftest/raw-unknown-vertical.lua');
  assert(scene.rows.every(row => row.rect === undefined) || scene.rows.slice(1).every(row => row.rect === undefined), 'unknown upstream vertical facts must not seed downstream rectangles');
  assert(scene.gaps.length > 0, 'unknown vertical facts must retain source-linked diagnostics');
});

test('does not recompute an explicitly unavailable final table height', () => {
  const projected = rawProjectionFor([
    'local menu = { name = "UnavailableFinalHeight", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(1, { width = 40, reserveScrollBar = false })',
    'table:setColWidth(1, 40, false)',
    'local row = table:addRow(false, {})',
    'row[1]:createButton(dynamic_options)',
    'frame:display()',
  ].join('\n'), 'selftest/raw-unavailable-final-height.lua');
  assert(projected.result !== undefined && 'program' in projected.result && projected.program !== undefined && projected.profile !== undefined, 'unavailable final-height source must produce a partial result');
  const scene = sceneOf(buildX4UiScene(projected.result as X4UiLayoutProgramResult, corpus, projected.profile));
  assert(scene.tables[0].fullHeight === undefined || scene.gaps.length > 0, 'explicit final-height unavailability must remain unavailable or source-linked partial');
  assert(scene.rows.every(row => row.rect === undefined) || scene.status === 'partial', 'downstream rows must not be seeded from an unproven height');
});

test('preserves preview-only provenance and never upgrades game truth', () => {
  const sourceText = [
    'local Helper = rawget(_G, "Helper")',
    'local function panel(frame, width, label)',
    '  local table = frame:addTable(1, { width = width })',
    '  local row = table:addRow(false, {})',
    '  row[1]:createText(label, { height = 10 })',
    'end',
    'local function display(tab)',
    '  local menu = { name = "PreviewTruth", layer = 1 }',
    '  local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    '  if tab == "first" then panel(frame, 40, "first") else panel(frame, 50, "second") end',
    '  frame:display()',
    'end',
    'display("first")',
  ].join('\n');
  const model = buildX4UiCallModel({ rel: 'selftest/raw-preview-truth.lua', text: sourceText, sourcePath: 'selftest/raw-preview-truth.lua' });
  const target = createX4UiLayoutTargetCatalog(model).targets.find(candidate => candidate.kind !== 'top-level' && candidate.name === 'display');
  const baseProfile = rawProducerProjection.program?.profile;
  assert(target !== undefined && baseProfile !== undefined, 'preview source must expose its target');
  const projected = projectX4UiLayoutProgram(model, target, { ...baseProfile, source: target.sourceIdentity, localExpansion: { maxDepth: 4, maxInvocations: 8 } });
  assert('program' in projected && projected.program !== undefined && 'evidenceAuthority' in projected, 'preview source must retain its result wrapper');
  const profile: X4UiSceneProfile = Object.freeze({ ...sceneProfile, source: projected.program.profile.source, drawable: { width: projected.program.profile.frame.width, height: projected.program.profile.frame.height } });
  const scene = sceneOf(buildX4UiScene(projected as X4UiLayoutProgramResult, corpus, profile));
  assert(scene.preview.provenance === 'preview-only', 'preview provenance must remain visible');
  assert(scene.gameTruth === 'Not verified in game' && scene.verification.gameVerified === false, 'preview samples cannot set game truth');
});

test('projects pre-final kernel evidence without reusing unfrozen columns', () => {
  const raw = rawProjectionFor([
    'local menu = { name = "PreFinal", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(2, { width = 80, reserveScrollBar = true, scaling = false })',
    'table:setColWidth(1, 40, false)',
    'table:setColWidth(2, 40, false)',
    'frame:display()',
  ].join('\n'), 'selftest/raw-pre-final.lua');
  assert(raw.result !== undefined && 'program' in raw.result && raw.program !== undefined && raw.profile !== undefined, 'pre-final source must produce a real result');
  const scene = sceneOf(buildX4UiScene(raw.result as X4UiLayoutProgramResult, corpus, raw.profile));
  const table = scene.tables[0];
  assert(table.rect === undefined || table.columns === undefined, 'pre-final kernel columns must not become scene geometry');

  const control = sceneFromRaw([
    'local menu = { name = "FinalizedControl", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(2, { width = 80, reserveScrollBar = false })',
    'table:setColWidth(1, 40, false)', 'table:setColWidth(2, 40, false)',
    'local row = table:addRow(false, {})', 'row[1]:createText("control", { height = 8 })',
    'frame:display()',
  ].join('\n'), 'selftest/raw-finalized-control.lua');
  assert(control.tables[0].columns !== undefined && control.tables[0].fixedColumns !== undefined, 'finalized control columns must remain exact source facts');
});

test('keeps global and other-node gaps out of known sibling diagnostics while preserving scene partiality', () => {
  const scene = sceneFromRaw([
    'local menu = { name = "GapLocality", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(2, { width = 80, reserveScrollBar = false })',
    'table:setColWidth(1, 40, false)', 'table:setColWidth(2, 40, false)',
    'local row = table:addRow(false, {})',
    'row[1]:createText("known", { height = 10 })',
    'row[2]:createButton(dynamic_options)',
    'frame:display()',
  ].join('\n'), 'selftest/raw-gap-locality.lua');
  const textWidget = scene.widgets.find(widget => widget.kind === 'text')!;
  const text = scene.texts.find(candidate => candidate.widgetId === textWidget.id)!;
  assert(scene.status === 'partial', 'global gaps must keep the scene partial');
  assert(textWidget.completeness === 'complete' && text.completeness === 'complete', 'known sibling geometry must not inherit unrelated gaps');
  assert(textWidget.diagnosticLinks.length === 0 && text.diagnosticLinks.length === 0, 'known sibling links must stay local');
  const buttonWidget = scene.widgets.find(widget => widget.kind === 'button');
  assert(buttonWidget === undefined || buttonWidget.diagnosticLinks.length > 0, 'unavailable child gaps must link to their actual owner when a widget is materialized');
});

test('retains missing-glyph, control, unsupported-font, and truncation evidence as partial text gaps', () => {
  const missingScene = rawTextScene('missing-glyph', '€', 'height = 12');
  assert(missingScene.status === 'partial' && missingScene.gaps.some(gap => gap.category === 'text'), 'missing glyph must remain a text gap');
  const missingWidget = missingScene.widgets.find(widget => widget.kind === 'text')!;
  assert(missingWidget.completeness === 'partial' && missingWidget.diagnosticStyle.geometry === 'source-derived', 'text child gaps must make the known text widget partial without erasing its geometry');
  const control = rawTextScene('control-text', 'control', 'height = 12, maxchars = 0');
  assert(control.gameTruth === 'Not verified in game', 'control-text source must retain the permanent preview/game truth boundary');
  const unsupported = rawTextScene('unsupported-font', 'unsupported', 'height = 12, font = "Unsupported"');
  assert(unsupported.gaps.some(gap => gap.category === 'font'), 'unsupported font must remain a font gap');
  const truncScene = rawTextScene('truncated-text', 'AAAAAAAAAAAAAAAAAAAAAAAA', 'height = 12', profile => ({ ...profile, textPolicy: { ...profile.textPolicy, truncationMode: 'ellipsis' as const } }));
  assert(truncScene.status === 'partial', 'provisional truncation evidence must keep the scene partial');
  const truncatedText = truncScene.texts.find(text => text.content.includes('AAAA'))!;
  assert(truncatedText.rect !== undefined && truncatedText.diagnosticStyle.geometry === 'source-derived', 'text-policy gaps must not erase known text geometry');
});

test('plain createText wordwrap=false forces source no-wrap over the provisional profile', () => {
  const scene = rawTextScene('wordwrap-false', 'A A A A A A', 'height = 12, width = 10, wordwrap = false', profile => ({ ...profile, textPolicy: { ...profile.textPolicy, wrapMode: 'word-wrap' } }));
  const text = scene.texts.find(candidate => candidate.widgetId === scene.widgets.find(widget => widget.kind === 'text')!.id)!;
  assert(text.lines.length === 1 && text.lines.every(line => line.breakReason !== 'word-wrap' && line.breakReason !== 'codepoint-wrap'), 'source wordwrap=false must prevent profile word wrapping');
  assert(text.provenanceLinks.some(link => link.fact === 'wordwrap' && link.expression === 'false'), 'plain wordwrap=false must remain exact text provenance');
});

test('plain createText wordwrap=true enables the supplied provisional wrapping algorithm', () => {
  const scene = rawTextScene('wordwrap-true', 'A A A A A A', 'height = 12, width = 10, wordwrap = true', profile => ({ ...profile, textPolicy: { ...profile.textPolicy, wrapMode: 'word-wrap' } }));
  const text = scene.texts.find(candidate => candidate.widgetId === scene.widgets.find(widget => widget.kind === 'text')!.id)!;
  assert(text.lines.length > 1 && text.lines.some(line => line.breakReason === 'word-wrap'), 'source wordwrap=true must enable the supplied provisional wrapping algorithm');
  assert(text.provenanceLinks.some(link => link.fact === 'wordwrap' && link.expression === 'true'), 'plain wordwrap=true must remain exact text provenance');
});

test('plain createText wordwrap=true with no-wrap profile retains a missing-algorithm gap', () => {
  const scene = rawTextScene('wordwrap-no-algorithm', 'A A A A A A', 'height = 12, width = 10, wordwrap = true');
  const text = scene.texts.find(candidate => candidate.widgetId === scene.widgets.find(widget => widget.kind === 'text')!.id)!;
  assert(text.layout === undefined && text.lines.length === 0, 'source wordwrap=true must not silently accept a no-wrap profile as its wrapping algorithm');
  assert(text.diagnosticLinks.some(id => scene.gaps.find(gap => gap.id === id)?.reason.includes('plain wordwrap=true has no supported provisional wrapping algorithm')), 'missing wrapping algorithm must remain a localized gap');
});

test('unavailable or dynamic plain wordwrap retains a local gap without fabricating wrapped layout', () => {
  const projected = rawProjectionFor([
    'local menu = { name = "DynamicWordwrap", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(1, { width = 40, reserveScrollBar = false })',
    'table:setColWidth(1, 40, false)',
    'local row = table:addRow(false, {})',
    'row[1]:createText("A A A A A A", { height = 12, width = 10, wordwrap = runtimeWordwrap })',
    'frame:display()',
  ].join('\n'), 'selftest/raw-dynamic-wordwrap.lua');
  assert(projected.result !== undefined && 'program' in projected.result && projected.profile !== undefined, 'dynamic wordwrap source must produce a partial wrapper');
  const profile: X4UiSceneProfile = { ...projected.profile, textPolicy: { ...projected.profile.textPolicy, wrapMode: 'word-wrap' } };
  const scene = sceneOf(buildX4UiScene(projected.result as X4UiLayoutProgramResult, corpus, profile));
  for (const label of ['unavailable', 'dynamic'] as const) {
    const text = scene.texts.find(candidate => candidate.widgetId === scene.widgets.find(widget => widget.kind === 'text')!.id)!;
    assert(text.layout === undefined && text.lines.length === 0, `${label} plain wordwrap must not fabricate a wrapped layout`);
    assert(text.diagnosticLinks.some(id => scene.gaps.find(gap => gap.id === id)?.reason.includes('wordwrap')), `${label} plain wordwrap must retain its local gap`);
  }
});

test('nested button/icon/edit-box text remains no-wrap because textproperty has no wordwrap', () => {
  const scene = sceneFromRaw([
    'local menu = { name = "NestedNoWrap", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(3, { width = 90, reserveScrollBar = false })',
    'table:setColWidth(1, 30, false)', 'table:setColWidth(2, 30, false)', 'table:setColWidth(3, 30, false)',
    'local row = table:addRow(false, {})',
    'row[1]:createButton({ width = 20, height = 10 }):setText("A A A A A A", { x = 1 }):setText2("B B B B B B", { x = 1 })',
    'row[2]:createIcon("solid", { width = 20, height = 10 }):setText("A A A A A A", { x = 1 }):setText2("B B B B B B", { x = 1 })',
    'row[3]:createEditBox({ width = 20, height = 10, text = "A A A A A A" })',
    'frame:display()',
  ].join('\n'), 'selftest/raw-nested-no-wrap.lua');
  for (const kind of ['button', 'icon', 'editbox'] as const) {
    const widget = scene.widgets.find(candidate => candidate.kind === kind)!;
    const texts = scene.texts.filter(text => text.widgetId === widget.id);
    assert(texts.length === (kind === 'editbox' ? 1 : 2), `${kind} nested text slots must remain distinct`);
    for (const text of texts) {
      assert(text.lines.every(line => line.breakReason !== 'word-wrap' && line.breakReason !== 'codepoint-wrap'), `${kind} nested text must not inherit plain-text wordwrap`);
      assert(text.provenanceLinks.some(link => link.sourcePin?.lineStart === 3417) && text.provenanceLinks.some(link => link.sourcePin?.lineStart === 3572), `${kind} nested text must retain the shipped no-wrap boundary pins`);
    }
  }
});

test('propagates provisional word/codepoint wrap and explicit overflow to text descendants', () => {
  const wordScene = rawTextScene('word-wrap-descendants', 'A A A A A A', 'height = 12, width = 10, wordwrap = true', profile => ({ ...profile, textPolicy: { ...profile.textPolicy, wrapMode: 'word-wrap' } }));
  const wordText = wordScene.texts.find(text => text.content.includes('A A A'))!;
  assert(wordText.lines.length > 1 && wordText.lines.some(line => line.breakReason === 'word-wrap'), 'word-wrap must remain visible as line evidence');
  assert(wordText.completeness === 'partial' && wordText.lines.every(line => line.completeness === 'partial'), 'word-wrap lines must remain provisional and partial');
  assert(wordScene.glyphs.filter(glyph => glyph.textId === wordText.id).every(glyph => glyph.completeness === 'partial' && glyph.diagnosticLinks.length > 0), 'word-wrap glyphs must retain local provisional diagnostic links');

  const codepointScene = rawTextScene('codepoint-wrap-descendants', 'AAAAAAAAAAAAAAAAAAAAAAAA', 'height = 12, width = 10, wordwrap = true', profile => ({ ...profile, textPolicy: { ...profile.textPolicy, wrapMode: 'greedy-word' } }));
  const codepointText = codepointScene.texts.find(text => text.content.startsWith('AAAA'))!;
  assert(codepointText.lines.some(line => line.breakReason === 'codepoint-wrap'), 'greedy unbreakable text must expose codepoint-wrap evidence');
  assert(codepointText.lines.every(line => line.completeness === 'partial') && codepointScene.glyphs.filter(glyph => glyph.textId === codepointText.id).every(glyph => glyph.completeness === 'partial'), 'codepoint-wrap descendants must be partial');

  const overflowScene = rawTextScene('explicit-overflow', 'AAAAAAAAAAAAAAAA', 'height = 12, width = 4, wordwrap = false');
  const overflowText = overflowScene.texts.find(text => text.content.startsWith('AAAA'))!;
  assert(overflowText.lines.some(line => line.overflow) && overflowText.completeness === 'partial', 'explicit no-wrap overflow must remain a local partial text fact');
});

test('propagates known viewport clips to partly and fully clipped scrolled descendants', () => {
  const projected = rawProjectionFor([
    'local menu = { name = "ScrolledClips", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(1, { width = 40, maxVisibleHeight = 20, reserveScrollBar = false })',
    'table:setColWidth(1, 40, false)',
    'local first = table:addRow(false, { fixed = false })',
    'first[1]:createText("first", { height = 8 })',
    'local second = table:addRow(false, { fixed = false })',
    'second[1]:createText("second", { height = 8 })',
    'frame:display()',
  ].join('\n'), 'selftest/raw-scrolled-clips.lua');
  assert(projected.program !== undefined && projected.profile !== undefined && projected.result !== undefined && 'program' in projected.result, 'scrolled clip source must produce a real result');
  const profile: X4UiSceneProfile = { ...projected.profile, tableView: { [projected.program.tables[0].id]: { scrollOffset: 8 } } };
  const scene = sceneOf(buildX4UiScene(projected.result as X4UiLayoutProgramResult, corpus, profile));
  const table = scene.tables[0];
  const viewport = table.viewportRect!;
  const row = scene.rows[0];
  const cell = scene.cells[0];
  const widget = scene.widgets.find(candidate => candidate.cellId === cell.id)!;
  const text = scene.texts.find(candidate => candidate.widgetId === widget.id)!;
  assert(row.clipRect !== undefined || row.rect === undefined, 'row must retain the known table viewport clip when its display rectangle is known');
  assert(cell.clipRect !== undefined && widget.clipRect !== undefined && text.clipRect !== undefined, 'partly clipped descendants must retain a serializable clip');
  assert(cell.rect!.y < viewport.y && cell.clipRect!.y === viewport.y, 'partly scrolled cell geometry must intersect the known viewport at its top edge');
  for (const glyph of scene.glyphs.filter(candidate => candidate.textId === text.id)) {
    assert(glyph.clipRect !== undefined && glyph.clipRect.x >= viewport.x && glyph.clipRect.y >= viewport.y && glyph.clipRect.x + glyph.clipRect.width <= viewport.x + viewport.width && glyph.clipRect.y + glyph.clipRect.height <= viewport.y + viewport.height, 'glyph clip must not escape the known table viewport');
  }
  const fullyProjected = rawProjectionFor([
    'local menu = { name = "FullyScrolledClips", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(1, { width = 40, maxVisibleHeight = 20, reserveScrollBar = false })',
    'table:setColWidth(1, 40, false)',
    'local row = table:addRow(false, { fixed = false })',
    'row[1]:createText("fully", { height = 8 })',
    'frame:display()',
  ].join('\n'), 'selftest/raw-fully-scrolled-clips.lua');
  assert(fullyProjected.program !== undefined && fullyProjected.profile !== undefined && fullyProjected.result !== undefined && 'program' in fullyProjected.result, 'fully clipped source must produce a real result');
  const fullyClippedProfile: X4UiSceneProfile = { ...fullyProjected.profile, tableView: { [fullyProjected.program.tables[0].id]: { scrollOffset: 1000 } } };
  const fullyClipped = sceneOf(buildX4UiScene(fullyProjected.result as X4UiLayoutProgramResult, corpus, fullyClippedProfile));
  const fullyClippedText = fullyClipped.texts[0];
  assert(fullyClippedText.clipRect?.width === 0 && fullyClippedText.clipRect?.height === 0, `fully clipped text must retain an explicit zero intersection, got ${JSON.stringify(fullyClippedText.clipRect)}`);
});

test('clamps fully clipped right/bottom descendant anchors inside the known viewport', () => {
  const scene = sceneFromRaw([
    'local menu = { name = "OffCanvasDescendant", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(1, { width = 40, y = 100, maxVisibleHeight = 20, reserveScrollBar = false })',
    'table:setColWidth(1, 40, false)',
    'local row = table:addRow(false, {})',
    'row[1]:createIcon("solid", { width = 8, height = 8, x = 1000 })',
    'frame:display()',
  ].join('\n'), 'selftest/raw-off-canvas-descendant.lua');
  const viewport = scene.tables[0].clipRect!;
  const iconWidget = scene.widgets.find(widget => widget.kind === 'icon')!;
  const iconText = scene.texts.find(candidate => candidate.widgetId === iconWidget.id)!;
  assert(iconWidget.clipRect !== undefined && iconText.clipRect !== undefined, 'fully clipped descendants must retain explicit clip rectangles');
  for (const node of [...scene.cells, ...scene.widgets, ...scene.texts, ...scene.glyphs]) {
    if (!node.clipRect) continue;
    assert(node.clipRect.x >= viewport.x && node.clipRect.y >= viewport.y, `${node.id} clip anchor must not escape above/left of viewport`);
    assert(node.clipRect.x + node.clipRect.width <= viewport.x + viewport.width && node.clipRect.y + node.clipRect.height <= viewport.y + viewport.height, `${node.id} clip must remain inside viewport bounds`);
  }
});

test('does not fabricate unavailable text facts or exact font evidence', () => {
  const missingProjection = rawProjectionFor([
    'local menu = { name = "MissingFacts", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(1, { width = 40, reserveScrollBar = false })',
    'table:setColWidth(1, 40, false)',
    'local row = table:addRow(false, {})',
    'row[1]:createText(dynamicText, { height = 12, font = runtimeFont, fontsize = runtimeSize, halign = runtimeAlign })',
    'frame:display()',
  ].join('\n'), 'selftest/raw-missing-facts.lua');
  assert(missingProjection.result !== undefined && 'program' in missingProjection.result && missingProjection.profile !== undefined, 'missing text facts source must produce a real partial result');
  const missingScene = sceneOf(buildX4UiScene(missingProjection.result as X4UiLayoutProgramResult, corpus, missingProjection.profile));
  const missingText = missingScene.texts.find(text => text.widgetId === missingScene.widgets.find(widget => widget.kind === 'text')?.id);
  const has = (key: string): boolean => missingText !== undefined && Object.prototype.hasOwnProperty.call(missingText, key);
  assert(missingText === undefined || (!has('content') && !has('font') && !has('fontSize') && !has('alignment')), 'unavailable text facts must not be replaced by public defaults');
  assert(missingText === undefined || (missingText.evidence.metrics === 'unavailable' && missingText.diagnosticLinks.length > 0), 'unsupported text facts must retain unavailable metrics evidence and local gaps');

  const unsupportedScene = rawTextScene('unsupported-facts', 'known', 'height = 12, font = "Unsupported"');
  const unsupportedText = unsupportedScene.texts.find(text => text.widgetId === unsupportedScene.widgets.find(widget => widget.kind === 'text')?.id);
  assert(unsupportedText === undefined || (!Object.prototype.hasOwnProperty.call(unsupportedText, 'font') && unsupportedText.evidence.metrics === 'unavailable'), 'unsupported fonts must not fall back to Zekton or exact metrics evidence');

  const offsetScene = sceneFromRaw([
    'local menu = { name = "MissingOffsets", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(1, { width = 40, reserveScrollBar = false })',
    'table:setColWidth(1, 40, false)',
    'local row = table:addRow(false, {})',
    'row[1]:createButton({ width = 20, height = 10 }):setText("button", { x = runtimeX, y = runtimeY })',
    'frame:display()',
  ].join('\n'), 'selftest/raw-missing-offsets.lua');
  const buttonText = offsetScene.texts.find(text => text.slot === 'primary');
  assert(buttonText === undefined || (!Object.prototype.hasOwnProperty.call(buttonText, 'offsetX') && !Object.prototype.hasOwnProperty.call(buttonText, 'offsetY')), 'unavailable text offsets must not be replaced by zero');
});

test('keeps hidden optional when colspan is unavailable', () => {
  const projected = rawProjectionFor([
    'local menu = { name = "UnknownSpan", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(2, { width = 80, reserveScrollBar = false })',
    'table:setColWidth(1, 40, false)', 'table:setColWidth(2, 40, false)',
    'local row = table:addRow(false, {})',
    'row[1]:setColSpan(dynamicSpan)',
    'frame:display()',
  ].join('\n'), 'selftest/raw-unknown-span.lua');
  assert(projected.result !== undefined && 'program' in projected.result && projected.profile !== undefined, 'unknown span source must produce a partial wrapper');
  const scene = sceneOf(buildX4UiScene(projected.result as X4UiLayoutProgramResult, corpus, projected.profile));
  const cell = scene.cells[0];
  assert(cell.hidden === undefined || cell.diagnosticLinks.length > 0, 'unknown or dynamic colspan must not become an unlinked visibility claim');
  assert(cell.hidden !== undefined || (cell.rect === undefined && cell.widgetIds.length === 0), 'unknown colspan must retain its gap without cell/widget geometry');
  assert(cell.hidden !== undefined || cell.diagnosticLinks.some(id => scene.gaps.find(gap => gap.id === id)?.reason.includes('span')), 'unknown colspan must retain an exact local gap');
});

test('ports direct fontstring negative-width refusal while preserving exact zero and positive clamp', () => {
  const negativeScene = rawTextScene('negative-fontstring-width', 'negative', 'height = 12, width = 0, x = 50');
  const negativeWidget = negativeScene.widgets.find(widget => widget.kind === 'text');
  assert(negativeWidget !== undefined && negativeWidget.rect === undefined && negativeWidget.outerRect === undefined && negativeWidget.completeness === 'unavailable' && negativeWidget.textIds.length === 0, 'negative source fontstring width must retain a uniform unavailable widget without fabricating zero-width geometry');
  assert(negativeScene.gaps.some(gap => gap.reason.includes('fontstring width is negative')), 'negative fontstring width must retain a source-linked gap');

  const zeroScene = rawTextScene('zero-fontstring-width', 'zero', 'height = 12, width = 0, x = 40');
  assert(zeroScene.widgets.find(widget => widget.kind === 'text')?.outerRect?.width === 0, 'exact zero source width must remain valid');

  const positiveScene = rawTextScene('positive-fontstring-width', 'positive', 'height = 12, width = 100, x = 2');
  assert(positiveScene.widgets.find(widget => widget.kind === 'text')?.outerRect?.width !== undefined, 'positive inherited fontstring width must retain the exact source clamp');
});

test('refuses the reserved scene-gap namespace before any gap can collide', () => {
  const fixture = makeFixture();
  const program = cloneProgram(fixture.program);
  const cell = program.cells.find(candidate => candidate.id === 'cell:fixed-last')!;
  const previousId = cell.id;
  const nextId = 'gap:000000';
  (cell as unknown as { id: string }).id = nextId;
  const row = program.rows.find(candidate => candidate.id === 'row:two')!;
  const cellIds = row.cellIds as unknown as string[];
  cellIds[cellIds.indexOf(previousId)] = nextId;
  const operation = program.operations.find(candidate => candidate.id === 'op:fixed-last')!;
  (operation as unknown as { cellId: string }).cellId = nextId;
  assert(refusalHasNoScene(sceneFor(fixture, program)), 'a source ID that can enter the scene-gap namespace must refuse before geometry');
});

test('keeps derived source orders safe at the maximum source offset', () => {
  const fixture = makeFixture();
  const program = cloneProgram(fixture.program);
  const maxSource = (): X4UiSceneSourceLocation => ({
    file: 'fixture.lua',
    start: { line: 1, column: 0, offset: Number.MAX_SAFE_INTEGER },
    end: { line: 1, column: 0, offset: Number.MAX_SAFE_INTEGER },
  });
  (program.tables[0] as unknown as { source: X4UiSceneSourceLocation }).source = maxSource();
  const textCell = program.cells.find(cell => cell.id === 'cell:text')!;
  const textFacts = textCell.descriptorFacts as Record<string, X4UiLayoutDescriptorFact>;
  textFacts.text = { ...textFacts.text!, source: maxSource() };
  const result = sceneFor(fixture, program);
  assert(result.status === 'refused' && !('scene' in result), `a maximum source offset must refuse or remain safe before any unsafe derived order is emitted: ${JSON.stringify(result)}`);
});

test('fail-first: explicit topRow clamps to the actual owned final row', () => {
  const projected = rawProjectionFor([
    'local menu = { name = "TopRowClamp", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(1, { width = 40, maxVisibleHeight = 30, reserveScrollBar = false })',
    'table:setColWidth(1, 40, false)',
    'local first = table:addRow(false, { fixed = false })', 'first[1]:createText("first", { height = 8 })',
    'local final = table:addRow(false, { fixed = false })', 'final[1]:createText("final", { height = 8 })',
    'frame:display()',
  ].join('\n'), 'selftest/raw-top-row-clamp.lua');
  assert(projected.result !== undefined && 'program' in projected.result && projected.program !== undefined && projected.profile !== undefined, 'topRow clamp source must produce a real result');
  const profile: X4UiSceneProfile = { ...projected.profile, tableView: { [projected.program.tables[0].id]: { topRow: 999 } } };
  const scene = sceneOf(buildX4UiScene(projected.result as X4UiLayoutProgramResult, corpus, profile));
  assert(scene.rows[scene.rows.length - 1].rect !== undefined, 'topRow beyond the owned rows must clamp to the final source row');
});

test('clamps topRow inside an all-fixed table without inventing a normal row', () => {
  const projected = rawProjectionFor([
    'local menu = { name = "AllFixedTopRow", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(1, { width = 40, reserveScrollBar = false })',
    'table:setColWidth(1, 40, false)',
    'local first = table:addRow(false, { fixed = true })', 'first[1]:createText("first", { height = 8 })',
    'local second = table:addRow(false, { fixed = true })', 'second[1]:createText("second", { height = 8 })',
    'frame:display()',
  ].join('\n'), 'selftest/raw-all-fixed-top-row.lua');
  assert(projected.result !== undefined && 'program' in projected.result && projected.program !== undefined && projected.profile !== undefined, 'all-fixed topRow source must produce a real result');
  const profile: X4UiSceneProfile = { ...projected.profile, tableView: { [projected.program.tables[0].id]: { topRow: 999 } } };
  const scene = sceneOf(buildX4UiScene(projected.result as X4UiLayoutProgramResult, corpus, profile));
  assert(scene.rows.length === 2, 'zero-normal-row topRow clamping must retain only owned rows');
  assert(scene.rows.every(row => row.rect !== undefined && row.visible === true), 'a topRow inside the effective fixed section must not blank fixed rows');
  assert(!scene.rows.some(row => row.id.includes('generated')), 'topRow clamping must never invent a row');
});

test('fail-first: consumed kernel cell facts reject descriptor drift', () => {
  const fixture = makeFixture();
  const textCell = fixture.program.cells.find(cell => cell.id === 'cell:text')!;
  const cases: readonly [string, X4UiLayoutDescriptorFact][] = [
    ['contentKind', known('icon', 'string', textCell.source)],
    ['outerY', known(9, 'number', textCell.source)],
    ['outerHeight', known(13, 'number', textCell.source)],
    ['scaling', known(true, 'boolean', textCell.source)],
    ['affectRowHeight', known(false, 'boolean', textCell.source)],
    ['minTextHeight', known(99, 'number', textCell.source)],
  ];
  const failures: string[] = [];
  for (const [field, value] of cases) {
    const program = cloneProgram(fixture.program);
    (program.cells.find(cell => cell.id === 'cell:text')!.descriptorFacts as Record<string, X4UiLayoutDescriptorFact>)[field] = value;
    if (!refusalHasNoScene(sceneFor(fixture, program))) failures.push(field);
  }
  assert(failures.length === 0, `descriptor drift escaped reconciliation: ${failures.join(', ')}`);
});

test('fail-first: valid insufficient-space reserve transition is accepted only after source reconciliation', () => {
  const projected = rawProjectionFor([
    'local menu = { name = "RawInsufficientReserve", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(2, { width = 75, reserveScrollBar = true, maxVisibleHeight = 20 })',
    'table:setColWidth(1, 40, false)', 'table:setColWidth(2, 40, false)',
    'local first = table:addRow(false, {})', 'first[1]:createText("one", { height = 8 })',
    'local second = table:addRow(false, {})', 'second[1]:createText("two", { height = 8 })',
    'local third = table:addRow(false, {})', 'third[1]:createText("three", { height = 8 })',
    'frame:display()',
  ].join('\n'), 'selftest/raw-insufficient-reserve.lua');
  assert(projected.result !== undefined && 'program' in projected.result && projected.program !== undefined && projected.profile !== undefined, 'real insufficient-space source must produce a result wrapper');
  const state = projected.program.tables[0].kernelState!;
  assert(state.diagnostics.some(diagnostic => diagnostic.code === 'reserve-scrollbar-insufficient-space' || diagnostic.code === 'reserve-scrollbar-no-variable-column'), 'source fixture must carry a real reserve diagnostic');
  const result = buildX4UiScene(projected.result as X4UiLayoutProgramResult, corpus, projected.profile);
  assert(!refusalHasNoScene(result), `real insufficient-space finalization must be accepted after source reconciliation: ${JSON.stringify(result)}`);
  assert(sceneOf(result).status === 'partial', 'accepted reserve finalization must retain its diagnostic partial status');
});

test('fail-first: complete producer prelude continuity covers reserve and no-variable finalization', () => {
  const fixture = makeFixture();
  const failures: string[] = [];
  const complete = rawProjectionFor([
    'local menu = { name = "CompleteReserveChain", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(2, { width = 75, reserveScrollBar = true })',
    'table:setColWidth(1, 40, false)', 'table:setColWidth(2, 40, false)',
    'local row = table:addRow(false, {})', 'row[1]:createText("row", { height = 8 })',
    'frame:display()',
  ].join('\n'), 'selftest/raw-complete-reserve-chain.lua');
  if (complete.result === undefined || !('program' in complete.result) || complete.profile === undefined || refusalHasNoScene(buildX4UiScene(complete.result as X4UiLayoutProgramResult, corpus, complete.profile))) failures.push('complete reserve prelude');
  const variants: readonly [string, (program: X4UiLayoutProgram) => void][] = [
    ['addTable to first width', program => {
      const transition = program.operations.find(operationNode => operationNode.id === 'op:width:1')!.kernel!;
      (transition.stateBefore!.properties as unknown as { x: number }).x += 1;
    }],
    ['width to width', program => {
      const transition = program.operations.find(operationNode => operationNode.id === 'op:width:2')!.kernel!;
      (transition.stateBefore!.properties as unknown as { x: number }).x += 1;
    }],
    ['final width to first addRow', program => {
      const transition = program.operations.find(operationNode => operationNode.id === 'op:width:4')!.kernel!;
      (transition.stateAfter!.properties as unknown as { x: number }).x += 1;
    }],
    ['missing width transition', program => {
      (program.operations.find(operationNode => operationNode.id === 'op:width:2') as unknown as { kernel?: unknown }).kernel = undefined;
    }],
    ['reordered width transitions', program => {
      const first = program.operations.find(operationNode => operationNode.id === 'op:width:1')!;
      const second = program.operations.find(operationNode => operationNode.id === 'op:width:2')!;
      const kernel = first.kernel;
      (first as unknown as { kernel: unknown }).kernel = second.kernel;
      (second as unknown as { kernel: unknown }).kernel = kernel;
    }],
    ['post-first producer transition', program => {
      const transition = program.operations.find(operationNode => operationNode.id === 'op:text')!.kernel!;
      (transition.stateBefore!.properties as unknown as { x: number }).x += 1;
    }],
  ];
  for (const [label, mutate] of variants) {
    const invalid = appendWidthPrelude(cloneProgram(makeInsufficientReserveProgram(fixture)));
    mutate(invalid);
    if (!refusalHasNoScene(sceneFor(fixture, invalid))) failures.push(label);
  }
  const noVariable = rawProjectionFor([
    'local menu = { name = "CompleteNoVariable", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(2, { width = 80, reserveScrollBar = true })',
    'table:setColWidth(1, 40, false)', 'table:setColWidth(2, 40, false)',
    'local row = table:addRow(false, {})', 'row[1]:createText("row", { height = 8 })',
    'frame:display()',
  ].join('\n'), 'selftest/raw-complete-no-variable.lua');
  if (noVariable.result === undefined || !('program' in noVariable.result) || noVariable.profile === undefined || refusalHasNoScene(buildX4UiScene(noVariable.result as X4UiLayoutProgramResult, corpus, noVariable.profile))) failures.push('complete no-variable prelude');
  const disconnectedNoVariable = appendWidthPrelude(cloneProgram(makeInsufficientReserveProgram(fixture, 'no-variable')));
  const noVariableTransition = disconnectedNoVariable.operations.find(operationNode => operationNode.id === 'op:width:2')!.kernel!;
  (noVariableTransition.stateBefore!.properties as unknown as { x: number }).x += 1;
  if (!refusalHasNoScene(sceneFor(fixture, disconnectedNoVariable))) failures.push('no-variable post-prelude disconnect');
  assert(failures.length === 0, `producer prelude continuity escaped: ${failures.join(', ')}`);
});

test('fail-first: producer status policy is per-kind rather than a borrowed generic reason', () => {
  const fixture = makeFixture();
  const accepted: readonly [string, (program: X4UiLayoutProgram) => void][] = [
    ['unresolved addTable with deterministic state', program => {
      (program as unknown as { status: 'partial' }).status = 'partial';
      const node = program.operations.find(operationNode => operationNode.id === 'op:table')!;
      (node as unknown as { status: 'unresolved'; reason: string }).status = 'unresolved';
      (node as unknown as { reason: string }).reason = 'table kernel state is deterministic but one or more descriptor facts remain unavailable';
      (program.tables[0] as unknown as { status: 'partial' }).status = 'partial';
      (program.gaps as unknown as Array<Record<string, unknown>>).push({ category: 'table', status: 'unknown', reason: node.reason, source: node.source, operationId: node.id, nodeId: program.tables[0].id });
    }],
    ['unresolved addTable without materialization', program => {
      (program as unknown as { status: 'partial' }).status = 'partial';
      const node = program.operations.find(operationNode => operationNode.id === 'op:table')!;
      (node as unknown as { status: 'unresolved'; reason: string; kernel?: unknown }).status = 'unresolved';
      (node as unknown as { reason: string }).reason = 'addTable options are dynamic or unknown; source defaults were not substituted';
      delete (node as unknown as { kernel?: unknown }).kernel;
      (program.tables[0] as unknown as { status: 'partial'; kernelState?: unknown }).status = 'partial';
      delete (program.tables[0] as unknown as { kernelState?: unknown }).kernelState;
      (program.tables[0].rowIds as unknown as string[]).splice(0, program.tables[0].rowIds.length);
      (program.rows as unknown as X4UiLayoutRowNode[]).splice(0, program.rows.length);
      (program.cells as unknown as X4UiLayoutCellNode[]).splice(0, program.cells.length);
      (program.operations as unknown as X4UiLayoutOperation[]).splice(0, program.operations.length, ...program.operations.filter(operationNode => operationNode.id === 'op:frame' || operationNode.id === 'op:table'));
      (program.frames[0].operationIds as unknown as string[]).splice(0, program.frames[0].operationIds.length, ...program.frames[0].operationIds.filter(operationId => program.operations.some(operationNode => operationNode.id === operationId)));
      (program.tables[0].operationIds as unknown as string[]).splice(0, program.tables[0].operationIds.length, 'op:table');
      delete (program.tables[0] as unknown as { height?: unknown }).height;
      delete (program.tables[0] as unknown as { frameWidth?: unknown }).frameWidth;
      delete (program.tables[0] as unknown as { numColumns?: unknown }).numColumns;
      (program.tables[0].descriptorFacts as Record<string, X4UiLayoutDescriptorFact>).finalWidth = unavailable('number', 'table finalization awaits a successfully applied addRow', program.tables[0].source);
      (program.gaps as unknown as Array<Record<string, unknown>>).push({ category: 'options', status: 'unknown', reason: node.reason, source: node.source, operationId: node.id, nodeId: program.tables[0].id });
    }],
    ['unresolved width without deterministic transition', program => {
      (program as unknown as { status: 'partial' }).status = 'partial';
      const node = operation('op:dynamic-width', 'setColWidth', source(280), program.tables[0].id, '', '');
      delete (node as unknown as { rowId?: string }).rowId;
      delete (node as unknown as { cellId?: string }).cellId;
      (node as unknown as { status: 'unresolved'; reason: string }).status = 'unresolved';
      (node as unknown as { reason: string }).reason = 'column width operation has an unresolved static input';
      (program.operations as unknown as X4UiLayoutOperation[]).push(node);
      (program.tables[0].operationIds as unknown as string[]).push(node.id);
      (program.gaps as unknown as Array<Record<string, unknown>>).push({ category: 'width', status: 'unknown', reason: node.reason, source: node.source, operationId: node.id, nodeId: program.tables[0].id });
    }],
    ['unresolved width owner without an applied receiver', program => {
      (program as unknown as { status: 'partial' }).status = 'partial';
      const node = operation('op:ownerless-width', 'setColWidth', source(282), program.tables[0].id, '', '');
      delete (node as unknown as { tableId?: string; rowId?: string; cellId?: string }).tableId;
      delete (node as unknown as { rowId?: string }).rowId;
      delete (node as unknown as { cellId?: string }).cellId;
      (node as unknown as { status: 'unresolved'; reason: string }).status = 'unresolved';
      (node as unknown as { reason: string }).reason = 'width setter receiver is not an applied table identity';
      (program.operations as unknown as X4UiLayoutOperation[]).push(node);
      (program.gaps as unknown as Array<Record<string, unknown>>).push({ category: 'data-flow', status: 'unknown', reason: node.reason, source: node.source, operationId: node.id });
    }],
  ];
  const failures: string[] = [];
  void accepted;
  const rawControl = rawProducerProjection.result;
  if (rawControl === undefined || !('program' in rawControl) || refusalHasNoScene(buildX4UiScene(rawControl as X4UiLayoutProgramResult, corpus, rawProducerProjection.profile!))) failures.push('real producer control wrapper');
  for (const [label, operationId, category, nodeId] of [
    ['unresolved addRow without deterministic transition', 'op:row1', 'row', 'row:one'],
    ['unresolved specialization without deterministic transition', 'op:text', 'cell', 'cell:text'],
  ] as const) {
    const program = cloneProgram(fixture.program);
    (program as unknown as { status: 'partial' }).status = 'partial';
    const node = program.operations.find(operationNode => operationNode.id === operationId)!;
    (node as unknown as { status: 'unresolved'; reason: string; kernel?: unknown }).status = 'unresolved';
    (node as unknown as { reason: string }).reason = operationId === 'op:row1'
      ? 'addRow options are dynamic or unknown; source defaults were not substituted'
      : 'specialization options are dynamic or unknown; source defaults were not substituted';
    delete (node as unknown as { kernel?: unknown }).kernel;
    (program.gaps as unknown as Array<Record<string, unknown>>).push({ category, status: 'unknown', reason: node.reason, source: node.source, operationId, nodeId });
    if (!refusalHasNoScene(sceneFor(fixture, program))) failures.push(label);
  }
  const forged = cloneProgram(fixture.program);
  (forged as unknown as { status: 'partial' }).status = 'partial';
  const forgedRow = forged.operations.find(operationNode => operationNode.id === 'op:row1')!;
  (forgedRow as unknown as { status: 'unresolved'; reason: string; cellId: string }).status = 'unresolved';
  (forgedRow as unknown as { reason: string }).reason = DETERMINISTIC_DESCRIPTOR_PARTIAL_REASON_FOR_TEST;
  (forgedRow as unknown as { cellId: string }).cellId = 'cell:text';
  (forged.cells[0].operationIds as unknown as string[]).push(forgedRow.id);
  (forged.gaps as unknown as Array<Record<string, unknown>>).push({ category: 'row', status: 'unknown', reason: 'borrowed cell reason', source: forgedRow.source, operationId: forgedRow.id, nodeId: 'cell:text' });
  if (!refusalHasNoScene(sceneFor(fixture, forged))) failures.push('addRow borrowed cell producer shape');
  const forgedWidth = cloneProgram(fixture.program);
  (forgedWidth as unknown as { status: 'partial' }).status = 'partial';
  const borrowedWidth = operation('op:borrowed-width', 'setColWidth', source(285), forgedWidth.tables[0].id, 'row:one', 'cell:text');
  (borrowedWidth as unknown as { status: 'unresolved'; reason: string }).status = 'unresolved';
  (borrowedWidth as unknown as { reason: string }).reason = DETERMINISTIC_DESCRIPTOR_PARTIAL_REASON_FOR_TEST;
  (forgedWidth.operations as unknown as X4UiLayoutOperation[]).push(borrowedWidth);
  for (const node of [forgedWidth.tables[0], forgedWidth.rows[0], forgedWidth.cells[0]]) (node.operationIds as unknown as string[]).push(borrowedWidth.id);
  (forgedWidth.gaps as unknown as Array<Record<string, unknown>>).push({ category: 'cell', status: 'unknown', reason: 'borrowed cell reason', source: borrowedWidth.source, operationId: borrowedWidth.id, nodeId: 'cell:text' });
  if (!refusalHasNoScene(sceneFor(fixture, forgedWidth))) failures.push('setColWidth borrowed cell producer shape');
  assert(failures.length === 0, `producer status policy escaped: ${failures.join(', ')}`);
});

test('fail-first: setColSpan diagnostics are bound to the accepted producer transition', () => {
  const fixture = makeFixture();
  const failures: string[] = [];
  const positive = rawProjectionFor([
    'local menu = { name = "RawSpanDiagnostic", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(3, { width = 90, reserveScrollBar = false })',
    'table:setColWidth(1, 30, false)', 'table:setColWidth(2, 30, false)', 'table:setColWidth(3, 30, false)',
    'local row = table:addRow(false, {})', 'row[1]:createText("span", { height = 8 }):setColSpan(5)',
    'frame:display()',
  ].join('\n'), 'selftest/raw-span-diagnostic.lua');
  if (positive.result === undefined || !('program' in positive.result) || positive.profile === undefined || refusalHasNoScene(buildX4UiScene(positive.result as X4UiLayoutProgramResult, corpus, positive.profile))) failures.push('source colspan diagnostic');
  const variants: readonly [string, (program: X4UiLayoutProgram) => void][] = [
    ['ordinary-cell claim', program => {
      const transition = program.operations.find(operationNode => operationNode.id === 'op:in-range-span')!.kernel!;
      const before = JSON.parse(JSON.stringify(transition.stateBefore)) as HelperTableState;
      (before.rows[0].cells[1] as unknown as { type: string }).type = 'cell';
      (transition as unknown as { stateBefore: HelperTableState }).stateBefore = before;
    }],
    ['column 999 message', program => {
      const transition = program.operations.find(operationNode => operationNode.id === 'op:in-range-span')!.kernel!;
      const after = JSON.parse(JSON.stringify(transition.stateAfter)) as HelperTableState;
      (after.diagnostics.find(diagnostic => diagnostic.code === 'colspan-hid-non-cell') as unknown as { message: string }).message = 'colspan hid non-cell at column 999';
      (transition as unknown as { stateAfter: HelperTableState }).stateAfter = after;
    }],
    ['changed diagnostic message', program => {
      const transition = program.operations.find(operationNode => operationNode.id === 'op:in-range-span')!.kernel!;
      const after = JSON.parse(JSON.stringify(transition.stateAfter)) as HelperTableState;
      (after.diagnostics.find(diagnostic => diagnostic.code === 'colspan-hid-non-cell') as unknown as { message: string }).message = 'colspan hid non-cell at column 2 (forged)';
      (transition as unknown as { stateAfter: HelperTableState }).stateAfter = after;
    }],
    ['changed span fact', program => {
      const operationNode = program.operations.find(operationNode => operationNode.id === 'op:in-range-span')!;
      (operationNode.descriptorFacts as Record<string, X4UiLayoutDescriptorFact>).span = known(1, 'number', operationNode.source);
    }],
    ['changed owner row and cell', program => {
      const operationNode = program.operations.find(operationNode => operationNode.id === 'op:in-range-span')!;
      (operationNode as unknown as { rowId: string; cellId: string }).rowId = 'row:two';
      (operationNode as unknown as { cellId: string }).cellId = 'cell:fixed-last';
    }],
    ['self-consistent forged before after final', program => {
      const operationNode = program.operations.find(operationNode => operationNode.id === 'op:in-range-span')!;
      const before = JSON.parse(JSON.stringify(operationNode.kernel!.stateBefore)) as HelperTableState;
      (before.properties as unknown as { x: number }).x += 1;
      const after = unwrap(setCellColSpan(before, 1, 1, 2));
      (operationNode as unknown as { kernel: { stateBefore: HelperTableState; stateAfter: HelperTableState } }).kernel = { stateBefore: before, stateAfter: after };
      (program.tables[0] as unknown as { kernelState: HelperTableState; height: { status: 'known'; value: number } }).kernelState = after;
      (program.tables[0] as unknown as { height: { status: 'known'; value: number } }).height = { status: 'known', value: unwrap(getFullTableHeight(after)) };
      refreshProgramKernelProjection(program);
    }],
  ];
  for (const [label, mutate] of variants) {
    const invalid = makeHiddenColspanDiagnosticProgram(fixture);
    mutate(invalid);
    if (!refusalHasNoScene(sceneFor(fixture, invalid))) failures.push(label);
  }
  assert(failures.length === 0, `colspan producer diagnostic escaped: ${failures.join(', ')}`);
});

test('fail-first: an applied kernel-producing operation cannot omit its producer transition', () => {
  const fixture = makeFixture();
  const program = cloneProgram(fixture.program);
  const table = program.tables[0];
  const prelude = operation('op:missing-prelude', 'setColWidth', source(25), table.id, '', '');
  delete (prelude as unknown as { rowId?: string }).rowId;
  delete (prelude as unknown as { cellId?: string }).cellId;
  (program.operations as unknown as X4UiLayoutOperation[]).push(prelude);
  (table.operationIds as unknown as string[]).push(prelude.id);
  assert(refusalHasNoScene(sceneFor(fixture, program)), 'an applied setColWidth without its producer kernel transition must refuse before geometry');
});

test('fail-first: later source-backed diagnostic growth remains part of an exact reserve transition chain', () => {
  const fixture = makeFixture();
  const projected = rawProjectionFor([
    'local menu = { name = "RawLaterDiagnostic", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(2, { width = 80, reserveScrollBar = false })',
    'table:setColWidth(1, 40, false)', 'table:setColWidth(2, 40, false)',
    'local row = table:addRow(false, {})', 'row[1]:createText("later", { height = 8 }):setColSpan(5)',
    'frame:display()',
  ].join('\n'), 'selftest/raw-later-diagnostic.lua');
  assert(projected.result !== undefined && 'program' in projected.result && projected.profile !== undefined, 'later diagnostic source must produce a real result');
  const result = buildX4UiScene(projected.result as X4UiLayoutProgramResult, corpus, projected.profile);
  assert(!refusalHasNoScene(result), 'an exact later diagnostic transition must remain accepted');
  assert(sceneOf(result).status === 'partial', 'later kernel diagnostics must keep the scene partial');
  const mutations: readonly [string, (state: HelperTableState) => void][] = [
    ['removed diagnostic', state => { (state as unknown as { diagnostics: HelperTableState['diagnostics'] }).diagnostics = state.diagnostics.filter(diagnostic => diagnostic.code !== 'colspan-clamped'); }],
    ['reordered diagnostics', state => { (state as unknown as { diagnostics: HelperTableState['diagnostics'] }).diagnostics = [...state.diagnostics].reverse(); }],
    ['forged diagnostic message', state => { (state.diagnostics.find(diagnostic => diagnostic.code === 'colspan-clamped') as unknown as { message: string }).message = 'forged diagnostic'; }],
  ];
  for (const [label, mutate] of mutations) {
    const invalid = makeLaterDiagnosticProgram(fixture);
    const mutableState = JSON.parse(JSON.stringify(invalid.tables[0].kernelState!)) as HelperTableState;
    (invalid.tables[0] as unknown as { kernelState: HelperTableState }).kernelState = mutableState;
    mutate(mutableState);
    assert(refusalHasNoScene(sceneFor(fixture, invalid)), `${label} must refuse the disconnected or forged diagnostic state`);
  }
});

test('fail-first: descriptor-partial producer transitions retain deterministic kernel geometry', () => {
  const projected = rawProjectionFor([
    'local menu = { name = "RawDescriptorPartial", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(1, { width = 40, reserveScrollBar = false })',
    'table:setColWidth(1, 40, false)',
    'local row = table:addRow(false, {})',
    'row[1]:createText("text", { height = 10, x = dynamicX })',
    'frame:display()',
  ].join('\n'), 'selftest/raw-descriptor-partial.lua');
  assert(projected.result !== undefined && 'program' in projected.result && projected.profile !== undefined, 'descriptor-partial source must produce a result wrapper');
  const result = buildX4UiScene(projected.result as X4UiLayoutProgramResult, corpus, projected.profile);
  assert(!refusalHasNoScene(result), 'a descriptor-partial operation with an exact kernel transition must retain deterministic geometry');
  assert(sceneOf(result).status === 'partial' || sceneOf(result).gaps.length > 0, 'descriptor-partial operation must keep its source evidence partial');
});

test('fail-first: optional node identity and source values are closed and source-valid', () => {
  const fixture = makeFixture();
  const cases: readonly [string, (program: X4UiLayoutProgram) => void][] = [
    ['frame identity', program => { (program.frames[0] as unknown as Record<string, unknown>).identity = {}; }],
    ['frame widthSource', program => { (program.frames[0] as unknown as Record<string, unknown>).widthSource = {}; }],
    ['frame heightSource', program => { (program.frames[0] as unknown as Record<string, unknown>).heightSource = {}; }],
    ['table identity', program => { (program.tables[0] as unknown as Record<string, unknown>).identity = {}; }],
    ['row identity', program => { (program.rows[0] as unknown as Record<string, unknown>).identity = {}; }],
    ['cell identity', program => { (program.cells[0] as unknown as Record<string, unknown>).identity = {}; }],
  ];
  for (const [label, mutate] of cases) {
    const program = cloneProgram(fixture.program);
    mutate(program);
    assert(refusalHasNoScene(sceneFor(fixture, program)), `${label} must refuse before geometry`);
  }
});

test('fail-first: reserve authorization rejects a disconnected same-table transition chain', () => {
  const fixture = makeFixture();
  const program = appendWidthPrelude(makeInsufficientReserveProgram(fixture));
  const hiddenKernel = program.operations.find(operation => operation.id === 'op:hidden')!.kernel!;
  const disconnectedAfter = JSON.parse(JSON.stringify(hiddenKernel.stateAfter)) as HelperTableState;
  (disconnectedAfter.properties as unknown as { x: number }).x += 1;
  (hiddenKernel as unknown as { stateAfter: HelperTableState }).stateAfter = disconnectedAfter;
  const result = sceneFor(fixture, program);
  assert(refusalHasNoScene(result), 'reserve authorization must not borrow a disconnected same-table transition');
});

test('rejects missing, reordered, foreign, and forged reserve transition chains', () => {
  const fixture = makeFixture();
  const variants: readonly [string, (program: X4UiLayoutProgram) => void][] = [
    ['missing link', program => {
      (program.operations.find(operation => operation.id === 'op:hidden') as unknown as { kernel?: unknown }).kernel = undefined;
    }],
    ['reordered transitions', program => {
      const rowTwo = program.operations.find(operation => operation.id === 'op:row2')!;
      const hidden = program.operations.find(operation => operation.id === 'op:hidden')!;
      const rowTwoKernel = rowTwo.kernel;
      (rowTwo as unknown as { kernel: unknown }).kernel = hidden.kernel;
      (hidden as unknown as { kernel: unknown }).kernel = rowTwoKernel;
    }],
    ['foreign table transition', program => {
      (program.operations.find(operation => operation.id === 'op:hidden') as unknown as { tableId: string }).tableId = 'table:foreign';
    }],
    ['forged final transition', program => {
      const operation = program.operations.find(candidate => candidate.id === 'op:row3')!;
      const forged = JSON.parse(JSON.stringify(operation.kernel!.stateAfter)) as HelperTableState;
      (forged.properties as unknown as { x: number }).x += 1;
      (operation.kernel as unknown as { stateAfter: HelperTableState }).stateAfter = forged;
    }],
  ];
  for (const [label, mutate] of variants) {
    const invalid = appendWidthPrelude(makeInsufficientReserveProgram(fixture));
    mutate(invalid);
    assert(refusalHasNoScene(sceneFor(fixture, invalid)), `${label} reserve chain must refuse before geometry`);
  }
});

test('fail-first: dependency-style cell gap links through its actual ancestors', () => {
  const fixture = makeFixture();
  const rowScene = sceneFromRaw([
    'local menu = { name = "RawRowGap", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(2, { width = 80, reserveScrollBar = false })',
    'table:setColWidth(1, 40, false)', 'table:setColWidth(2, 40, false)',
    'local row = table:addRow(false, dynamic_options)',
    'frame:display()',
  ].join('\n'), 'selftest/raw-row-gap.lua');
  assert(rowScene.status === 'partial', 'a valid row-owned dependency gap must make the scene partial');

  const cellScene = sceneFromRaw([
    'local menu = { name = "RawCellGap", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(2, { width = 80, reserveScrollBar = false })',
    'table:setColWidth(1, 40, false)', 'table:setColWidth(2, 40, false)',
    'local row = table:addRow(false, {})',
    'row[1]:createText(dynamic_text, { height = 10 })',
    'row[2]:createText("known", { height = 10 })',
    'frame:display()',
  ].join('\n'), 'selftest/raw-cell-gap.lua');
  assert(cellScene.status === 'partial', 'a valid cell-owned dependency gap must make the scene partial');

  const wrongAncestors: readonly [string, (program: X4UiLayoutProgram) => void][] = [
    ['wrong table', program => { (program.operations.find(operation => operation.id === 'op:row1') as unknown as { tableId: string }).tableId = 'table:wrong'; }],
    ['wrong row', program => { (program.operations.find(operation => operation.id === 'op:row1') as unknown as { rowId: string }).rowId = 'row:two'; }],
    ['wrong frame', program => { (program.operations.find(operation => operation.id === 'op:row1') as unknown as { frameId: string }).frameId = 'frame:wrong'; }],
    ['cell ancestry', program => { (program.operations.find(operation => operation.id === 'op:row1') as unknown as { cellId: string }).cellId = 'cell:text'; }],
  ];
  for (const [label, mutate] of wrongAncestors) {
    const invalid = cloneProgram(fixture.program);
    (invalid as unknown as { status: 'partial' }).status = 'partial';
    mutate(invalid);
    (invalid.gaps as unknown as Array<Record<string, unknown>>).push({
      category: 'row', status: 'unknown', reason: `invalid ${label} gap`, source: source(991), operationId: 'op:row1', nodeId: 'row:one',
    });
    assert(refusalHasNoScene(sceneFor(fixture, invalid)), `${label} row ownership must refuse before geometry`);
  }
});

test('fail-first: cyclic operation semantics are refused at the serialization boundary', () => {
  const fixture = makeFixture();
  const program = cloneProgram(fixture.program);
  const semantics = (program.operations.find(operation => operation.id === 'op:text')!.metadata as unknown as { semantics: Record<string, unknown> }).semantics;
  const parameter: Record<string, unknown> = {};
  parameter.self = parameter;
  semantics.options = { status: 'static', type: 'table', expression: 'options', location: source(993), parameter };
  assert(refusalHasNoScene(sceneFor(fixture, program)), 'an active cycle through an allowed semantics field must refuse before geometry');

  const sharedControl = buildX4UiScene(rawProducerProjection.result as X4UiLayoutProgramResult, corpus, rawProducerProjection.profile!);
  assert(!refusalHasNoScene(sharedControl), 'an intact acyclic producer semantics graph must remain accepted');
});

test('fail-first audit probes expose the four reproduced acceptance defects', () => {
  const fixture = makeFixture();
  const rawResult = rawProducerProjection.result as X4UiLayoutProgramResult;
  const rawProfile = rawProducerProjection.profile!;
  const failures: string[] = [];
  const expectRefusal = (name: string, result: X4UiSceneResult): void => {
    if (!refusalHasNoScene(result)) failures.push(name);
  };

  const originalRegular = fixture.corpus.fonts.regular;
  const forgedGlyph = { ...originalRegular.descriptor.glyphs[0], advance: originalRegular.descriptor.glyphs[0].advance + 1 };
  const forgedGlyphs = [forgedGlyph];
  const forgedRegular = freezeFixtureGraph({
    ...originalRegular,
    descriptor: {
      ...originalRegular.descriptor,
      glyphRecords: forgedGlyphs,
      glyphs: forgedGlyphs,
    },
  }) as unknown as ZektonFontAssets;
  const forgedCorpus = freezeFixtureGraph({
    ...fixture.corpus,
    assets: {
      ...fixture.corpus.assets,
      regular: { ...fixture.corpus.assets.regular, decoded: forgedRegular },
    },
    fonts: { ...fixture.corpus.fonts, regular: forgedRegular },
  }) as unknown as X4UiCorpusCanonicalSuccess;
  expectRefusal('forged canonical decoded metric (corpus)', buildX4UiScene(rawResult, forgedCorpus, rawProfile));

  const missingSlot = cloneProgram(rawResult.program);
  const missingSlotRow = missingSlot.rows[0];
  const missingSlotCell = missingSlotRow.cellIds[missingSlotRow.cellIds.length - 1];
  (missingSlotRow as unknown as { cellIds: string[] }).cellIds = missingSlotRow.cellIds.filter(id => id !== missingSlotCell);
  (missingSlot as unknown as { cells: X4UiLayoutCellNode[] }).cells = missingSlot.cells.filter(cell => cell.id !== missingSlotCell);
  const missingSlotOperationIds = new Set(missingSlot.cells.flatMap(cell => cell.operationIds));
  (missingSlot as unknown as { operations: X4UiLayoutOperation[] }).operations = missingSlot.operations.filter(operation => missingSlotOperationIds.has(operation.id) || !operation.cellId);
  for (const node of [...missingSlot.tables, ...missingSlot.rows, ...missingSlot.cells]) {
    (node.operationIds as unknown as string[]) = node.operationIds.filter(operationId => missingSlot.operations.some(operation => operation.id === operationId));
  }
  expectRefusal('missing program cell slot', buildX4UiScene({ ...rawResult, program: missingSlot } as X4UiLayoutProgramResult, fixture.corpus, rawProfile));

  const contradictoryPadding = cloneProgram(rawResult.program);
  (contradictoryPadding.rows[0].descriptorFacts as Record<string, X4UiLayoutDescriptorFact>).paddingTop = known(99, 'number', contradictoryPadding.rows[0].source);
  expectRefusal('contradictory row padding', buildX4UiScene({ ...rawResult, program: contradictoryPadding } as X4UiLayoutProgramResult, fixture.corpus, rawProfile));

  const forgedReserveDiagnostic = cloneProgram(rawResult.program);
  const forgedState = forgedReserveDiagnostic.tables[0].kernelState!;
  (forgedState.properties as unknown as { reserveScrollBar: boolean }).reserveScrollBar = false;
  (forgedState as unknown as { diagnostics: Array<Record<string, unknown>> }).diagnostics = [{
    code: 'reserve-scrollbar-no-variable-column',
    message: 'forged authorization',
    provenance: X4_LAYOUT_PROVENANCE,
  }];
  expectRefusal('forged reserve diagnostic', buildX4UiScene({ ...rawResult, program: forgedReserveDiagnostic } as X4UiLayoutProgramResult, fixture.corpus, rawProfile));

  const missingOperationKind = cloneProgram(rawResult.program);
  delete (missingOperationKind.operations.find(operation => operation.kind === 'createText') as unknown as { kind?: unknown }).kind;
  expectRefusal('missing operation kind', buildX4UiScene({ ...rawResult, program: missingOperationKind } as X4UiLayoutProgramResult, fixture.corpus, rawProfile));

  const danglingGap = cloneProgram(rawResult.program);
  (danglingGap.gaps as unknown as Array<Record<string, unknown>>).push({
    category: 'cell',
    status: 'unknown',
    reason: 'dangling operation',
    source: source(999),
    operationId: 'op:missing',
    nodeId: 'node:missing',
  });
  expectRefusal('dangling gap references', buildX4UiScene({ ...rawResult, program: danglingGap } as X4UiLayoutProgramResult, fixture.corpus, rawProfile));

  const projectedUnresolved = cloneProgram(rawResult.program);
  (projectedUnresolved.operations.find(operation => operation.kind === 'createText') as unknown as { status: string }).status = 'unresolved';
  expectRefusal('projected unresolved operation', buildX4UiScene({ ...rawResult, program: projectedUnresolved } as X4UiLayoutProgramResult, fixture.corpus, rawProfile));

  assert(failures.length === 0, `fail-first reproduced failures: ${failures.join(', ')}`);
});

test('fail-first: canonical corpus success is the only accepted font boundary', () => {
  const fixture = makeFixture();
  const result = buildX4UiScene(rawProducerProjection.result as X4UiLayoutProgramResult, fixture.corpus, rawProducerProjection.profile!);
  assert(result.status !== 'refused', 'canonical configured-corpus success must reach scene geometry');
  assert(result.status === 'projected' || result.status === 'partial', 'canonical corpus result must be a scene result');
});

test('refuses mutable, synthetic, detached, and malformed canonical corpus evidence before geometry', () => {
  const fixture = makeFixture();
  const rawResult = rawProducerProjection.result as X4UiLayoutProgramResult;
  const rawProfile = rawProducerProjection.profile!;
  const mutableRoot = { ...fixture.corpus } as never;
  assert(refusalHasNoScene(buildX4UiScene(rawResult, mutableRoot, rawProfile)), 'mutable canonical root must refuse');

  const synthetic = freezeFixtureGraph({
    ...fixture.corpus,
    canonical: false,
    canonicalIdentity: 'synthetic-contract',
    evidenceKind: 'synthetic',
  }) as never;
  assert(refusalHasNoScene(buildX4UiScene(rawResult, synthetic, rawProfile)), 'synthetic corpus evidence must refuse');

  const detachedRegular = freezeFixtureGraph({
    ...fixture.corpus,
    fonts: { ...fixture.corpus.fonts, regular: freezeFixtureGraph({ ...fixture.corpus.fonts.regular }) },
  }) as never;
  assert(refusalHasNoScene(buildX4UiScene(rawResult, detachedRegular, rawProfile)), 'detached decoded/font graph must refuse');

  const brokenCrossLink = freezeFixtureGraph({
    ...fixture.corpus,
    assets: { ...fixture.corpus.assets, regular: { ...fixture.corpus.assets.regular, decoded: fixture.corpus.fonts.bold } },
  }) as never;
  assert(refusalHasNoScene(buildX4UiScene(rawResult, brokenCrossLink, rawProfile)), 'cross-linked regular asset/font evidence must refuse');

  const replaceRegular = (regular: ZektonFontAssets): never => freezeFixtureGraph({
    ...fixture.corpus,
    assets: { ...fixture.corpus.assets, regular: { ...fixture.corpus.assets.regular, decoded: regular } },
    fonts: { ...fixture.corpus.fonts, regular },
  }) as never;
  const original = fixture.corpus.fonts.regular;
  const badLineMetrics = { ...original.descriptor.lineMetrics, outer: 15 };
  const malformedMetric = {
    ...original,
    descriptor: {
      ...original.descriptor,
      lineMetrics: badLineMetrics,
      header: { ...original.descriptor.header, lineMetrics: badLineMetrics },
    },
  } as ZektonFontAssets;
  assert(refusalHasNoScene(buildX4UiScene(rawResult, replaceRegular(malformedMetric), rawProfile)), 'malformed line metrics must refuse');

  const badMap = [...original.descriptor.map];
  badMap[0] = 99;
  const malformedMap = {
    ...original,
    descriptor: { ...original.descriptor, map: badMap, codePointToGlyphIndex: badMap },
  } as ZektonFontAssets;
  assert(refusalHasNoScene(buildX4UiScene(rawResult, replaceRegular(malformedMap), rawProfile)), 'malformed glyph map must refuse');

  const badGlyph = { ...original.descriptor.glyphs[0], pixelBounds: { ...original.descriptor.glyphs[0].pixelBounds, right: 7 } };
  const malformedBounds = {
    ...original,
    descriptor: { ...original.descriptor, glyphRecords: [badGlyph], glyphs: [badGlyph] },
  } as ZektonFontAssets;
  assert(refusalHasNoScene(buildX4UiScene(rawResult, replaceRegular(malformedBounds), rawProfile)), 'malformed glyph bounds must refuse');

  const malformedPayload = {
    ...original,
    atlas: { ...original.atlas, alphaBytes: new Uint8Array(79) },
  } as ZektonFontAssets;
  assert(refusalHasNoScene(buildX4UiScene(rawResult, replaceRegular(malformedPayload), rawProfile)), 'malformed atlas payload must refuse');
});

test('fail-first: kernel metric mismatches refuse before geometry', () => {
  const fixture = makeFixture();
  for (const key of ['uiScale', 'borderSize', 'scrollbarWidth', 'standardContainerOffset'] as const) {
    const program = cloneProgram(fixture.program);
    const state = program.tables[0].kernelState!;
    const metricsValue = state.metrics as unknown as Record<typeof key, number>;
    metricsValue[key] = key === 'scrollbarWidth' ? 4 : key === 'uiScale' ? 2 : key === 'borderSize' ? 2 : 3;
    assert(refusalHasNoScene(sceneFor(fixture, program)), `${key} metric mismatch must refuse before geometry`);
  }
});

test('fail-first: contradictory program/kernel facts refuse before geometry', () => {
  const fixture = makeFixture();
  const program = cloneProgram(fixture.program);
  const state = program.tables[0].kernelState!;
  (state.rows as unknown as Array<HelperTableState['rows'][number]>).push({ ...state.rows[0], cells: state.rows[0].cells.map(cell => ({ ...cell })) });
  assert(refusalHasNoScene(sceneFor(fixture, program)), 'an extra kernel row must not alter full height outside program ownership');

  const detached = cloneProgram(fixture.program);
  (detached.rows[0] as unknown as { kernelState: unknown }).kernelState = { ...detached.rows[1].kernelState };
  assert(refusalHasNoScene(sceneFor(fixture, detached)), 'a row kernel state from another slot must refuse');

  const fixedMismatch = cloneProgram(fixture.program);
  (fixedMismatch.tables[0].kernelState!.rows[0] as unknown as { fixed: boolean }).fixed = true;
  assert(refusalHasNoScene(sceneFor(fixture, fixedMismatch)), 'descriptor/kernel fixed mismatch must refuse');

  const rowHeightMismatch = cloneProgram(fixture.program);
  (rowHeightMismatch.rows[0] as unknown as { height: { status: 'known'; value: number } }).height = { status: 'known', value: rowHeightMismatch.rows[0].height!.value + 1 };
  assert(refusalHasNoScene(sceneFor(fixture, rowHeightMismatch)), 'known row height mismatch must refuse');

  const tableHeightMismatch = cloneProgram(fixture.program);
  (tableHeightMismatch.tables[0] as unknown as { height: { status: 'known'; value: number } }).height = { status: 'known', value: tableHeightMismatch.tables[0].height!.value + 1 };
  assert(refusalHasNoScene(sceneFor(fixture, tableHeightMismatch)), 'known table height mismatch must refuse');

  const cellSpanMismatch = cloneProgram(fixture.program);
  const spanCell = cellSpanMismatch.cells.find(cell => cell.id === 'cell:text')!;
  (spanCell.descriptorFacts as Record<string, X4UiLayoutDescriptorFact>).span = known(2, 'number', spanCell.source);
  assert(refusalHasNoScene(sceneFor(fixture, cellSpanMismatch)), 'known cell span mismatch must refuse');

  const cellHeightMismatch = cloneProgram(fixture.program);
  const heightCell = cellHeightMismatch.cells.find(cell => cell.id === 'cell:text')!;
  (heightCell as unknown as { height: { status: 'known'; value: number } }).height = { status: 'known', value: heightCell.height!.value + 1 };
  assert(refusalHasNoScene(sceneFor(fixture, cellHeightMismatch)), 'known cell height mismatch must refuse');
});

test('fail-first: node, wrapper, gap, and operation enums are closed before geometry', () => {
  const fixture = makeFixture();
  const bogusNode = cloneProgram(fixture.program);
  (bogusNode.frames[0] as unknown as { status: string }).status = 'bogus';
  assert(refusalHasNoScene(sceneFor(fixture, bogusNode)), 'bogus frame status must refuse');

  const bogusWrapper = {
    status: 'projected' as const,
    program: fixture.program,
    verification: { game: 'bogus', gameVerified: false as const },
  } as unknown as Parameters<typeof buildX4UiScene>[0];
  assert(refusalHasNoScene(buildX4UiScene(bogusWrapper, fixture.corpus, fixture.profile)), 'bogus wrapper verification must refuse');

  const bogusGap = cloneProgram(fixture.program);
  (bogusGap.gaps as unknown as Array<Record<string, unknown>>).push({ category: 'table', status: 'bogus', reason: 'bad', source: source(999) });
  assert(refusalHasNoScene(sceneFor(fixture, bogusGap)), 'bogus gap status must refuse');

  const forgedOrder = cloneProgram(fixture.program);
  (forgedOrder.operations[0] as unknown as { sourceOrder: number }).sourceOrder = 999;
  assert(refusalHasNoScene(sceneFor(fixture, forgedOrder)), 'forged operation source order must refuse');

  const competingOrder = cloneProgram(fixture.program);
  (competingOrder.operations[1] as unknown as { modelOrder: number }).modelOrder = competingOrder.operations[0].modelOrder;
  assert(refusalHasNoScene(sceneFor(fixture, competingOrder)), 'competing operations cannot share a model order');
});

test('fail-first: unknown scene-node keys refuse before geometry', () => {
  const fixture = makeFixture();
  const nodeCases: readonly [string, (program: X4UiLayoutProgram) => void][] = [
    ['frame', program => { (program.frames[0] as unknown as Record<string, unknown>).unexpected = true; }],
    ['table', program => { (program.tables[0] as unknown as Record<string, unknown>).unexpected = true; }],
    ['row', program => { (program.rows[0] as unknown as Record<string, unknown>).unexpected = true; }],
    ['cell', program => { (program.cells[0] as unknown as Record<string, unknown>).unexpected = true; }],
  ];
  for (const [kind, mutate] of nodeCases) {
    const invalid = cloneProgram(fixture.program);
    mutate(invalid);
    assert(refusalHasNoScene(sceneFor(fixture, invalid)), `unknown ${kind} node keys must refuse before geometry`);
  }
});

test('fail-first: scrollbar diagnostics carry bounded clips and paint remains unknown', () => {
  const fixture = makeFixture();
  const scene = sceneOf(sceneFor(fixture));
  const scrollbar = scene.tables[0].scrollbar;
  assert(scrollbar !== undefined && 'clipRect' in scrollbar, 'scrollbar must expose an explicit clip rectangle');
  if (scrollbar && 'clipRect' in scrollbar) assert(scrollbar.clipRect !== undefined, 'scrollbar clip must be materialized');
  const serialized = JSON.stringify(scene);
  assert(!serialized.includes('rgba') && !serialized.includes('textureId'), 'scene must not serialize invented engine paint data');
});

test('fail-first: mapped unavailable color facts require exact owner-linked paint gaps', () => {
  const scene = sceneFromRaw([
    'local menu = { name = "ColorPaint", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(4, { width = 100, reserveScrollBar = false, backgroundID = "solid", backgroundColor = runtimeTableColor })',
    'table:setColWidth(1, 20, false)',
    'table:setColWidth(2, 20, false)',
    'table:setColWidth(3, 20, false)',
    'table:setColWidth(4, 20, false)',
    'local row = table:addRow(false, { paddingTop = 1, paddingBottom = 1, borderBelow = false, fixed = false, scaling = false })',
    'row[1]:createText("direct", { height = 12, minRowHeight = 10, color = runtimeTextColor, cellBGColor = runtimeCellColor })',
    'row[2]:createButton({ height = 12, bgcolor = runtimeButtonBackground, highlightColor = runtimeButtonHighlight, borderColor = runtimeButtonBorder }):setText("primary", { color = runtimePrimaryText }):setText2("secondary", { color = runtimeSecondaryText })',
    'row[3]:createEditBox({ height = 12, bgColor = runtimeEditboxBackground })',
    'row[4]:createIcon("icon", { height = 8, affectRowHeight = false, color = runtimeIconColor })',
    'frame:display()',
  ].join('\n'), 'selftest/raw-color-paint.lua');
  const table = scene.tables[0];
  const directText = scene.texts.find(candidate => candidate.content === 'direct');
  const directWidget = directText === undefined ? undefined : scene.widgets.find(candidate => candidate.textIds.includes(directText.id));
  const directCell = directWidget === undefined ? undefined : scene.cells.find(candidate => candidate.widgetIds.includes(directWidget.id));
  const button = scene.widgets.find(candidate => candidate.kind === 'button');
  const primaryText = scene.texts.find(candidate => candidate.content === 'primary');
  const secondaryText = scene.texts.find(candidate => candidate.content === 'secondary');
  const editbox = scene.widgets.find(candidate => candidate.kind === 'editbox');
  const icon = scene.widgets.find(candidate => candidate.kind === 'icon');
  assert(table !== undefined && directCell !== undefined && directText !== undefined && button !== undefined && primaryText !== undefined && secondaryText !== undefined && editbox !== undefined && icon !== undefined, 'all mapped unavailable color owners must be projected');
  const exactUnavailableGap = (node: { readonly id: string; readonly diagnosticLinks: readonly string[] }, field: string, label: string): void => {
    const expectedReason = `color descriptor fact ${field} remains unavailable to the scene projection`;
    const matches = scene.gaps.filter(gap => gap.category === 'paint' && gap.nodeId === node.id && gap.reason === expectedReason && node.diagnosticLinks.includes(gap.id));
    assert(matches.length === 1, `${label} must have exactly one owner-linked unavailable paint gap: ${JSON.stringify({ nodeId: node.id, field, matches, linked: node.diagnosticLinks.map(id => scene.gaps.find(gap => gap.id === id)?.reason) })}`);
  };
  exactUnavailableGap(table, 'backgroundColor', 'table backgroundColor');
  exactUnavailableGap(directCell, 'cellbgcolor', 'cell cellbgcolor');
  exactUnavailableGap(directText, 'color', 'direct createText color');
  exactUnavailableGap(button, 'bgcolor', 'button bgcolor');
  exactUnavailableGap(button, 'highlightcolor', 'button highlightcolor');
  exactUnavailableGap(button, 'bordercolor', 'button bordercolor');
  exactUnavailableGap(primaryText, 'color', 'button setText color');
  exactUnavailableGap(secondaryText, 'color', 'button setText2 color');
  exactUnavailableGap(editbox, 'bgcolor', 'editbox bgcolor');
  exactUnavailableGap(icon, 'color', 'icon color');
  assert(scene.status === 'partial' && scene.gaps.some(gap => gap.category === 'paint'), 'unavailable color must remain diagnostic-only');
  assert(directWidget.diagnosticStyle.geometry === 'source-derived' && button.diagnosticStyle.geometry === 'source-derived', 'unavailable paint must preserve source-derived widget geometry');
  assert(!JSON.stringify(scene).includes('rgba'), 'unavailable color must never serialize engine RGBA data');
});

test('bounds consumed spatial offsets while preserving legitimate negative offsets', () => {
  const fixture = makeFixture();
  const unsafe = cloneProgram(fixture.program);
  (unsafe.frames[0].descriptorFacts as Record<string, X4UiLayoutDescriptorFact>).x = known(1_000_000_001, 'number', unsafe.frames[0].source);
  assert(refusalHasNoScene(sceneFor(fixture, unsafe)), 'spatial coordinates beyond MAX_SAFE_LAYOUT_WIDTH must refuse before geometry');

  const unsafeKernel = cloneProgram(fixture.program);
  (unsafeKernel.tables[0].kernelState!.properties as unknown as { x: number }).x = 1_000_000_001;
  assert(refusalHasNoScene(sceneFor(fixture, unsafeKernel)), 'consumed kernel spatial offsets beyond MAX_SAFE_LAYOUT_WIDTH must refuse before geometry');

  const scene = sceneFromRaw([
    'local menu = { name = "NegativeOffsets", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(1, { width = 40, reserveScrollBar = false })',
    'table:setColWidth(1, 40, false)',
    'local row = table:addRow(false, {})',
    'row[1]:createText("negative", { height = 10, x = -2, y = -3 })',
    'frame:display()',
  ].join('\n'), 'selftest/raw-negative-offsets.lua');
  const widget = scene.widgets.find(candidate => candidate.kind === 'text')!;
  assert(widget.outerRect!.x < scene.cells.find(candidate => candidate.id === widget.cellId)!.rect!.x && widget.outerRect!.y < scene.cells.find(candidate => candidate.id === widget.cellId)!.rect!.y, 'bounded negative source offsets must remain valid and signed');
});

test('preserves a known empty table viewport when table geometry is outside its frame', () => {
  const scene = sceneFromRaw([
    'local menu = { name = "EmptyViewport", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(1, { width = 40, y = 100, maxVisibleHeight = 20, reserveScrollBar = false })',
    'table:setColWidth(1, 40, false)',
    'local row = table:addRow(false, {})', 'row[1]:createText("empty", { height = 8 })',
    'frame:display()',
  ].join('\n'), 'selftest/raw-empty-viewport.lua');
  const table = scene.tables[0];
  assert(table.rect !== undefined, 'known outside-frame table geometry must remain projected');
  assert(table.viewportRect !== undefined && table.viewportRect.width === 0 && table.viewportRect.height === 0, 'outside-frame table must carry a known empty viewport rather than unavailable clipping');
  assert(table.clipRect !== undefined && table.clipRect.width === 0 && table.clipRect.height === 0, 'known empty viewport must remain the table clip');
});

test('keeps known empty and partial frame/drawable clips explicit through the hierarchy', () => {
  const emptyScene = sceneFromRaw([
    'local menu = { name = "OffCanvasFrame", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 60, x = 200, y = 100 })',
    'local table = frame:addTable(1, { width = 40, reserveScrollBar = false })',
    'table:setColWidth(1, 40, false)',
    'local row = table:addRow(false, {})', 'row[1]:createText("empty", { height = 8 })',
    'frame:display()',
  ].join('\n'), 'selftest/raw-off-canvas-frame.lua');
  const emptyFrame = emptyScene.frames[0];
  const emptyTable = emptyScene.tables[0];
  assert(emptyFrame.rect !== undefined && emptyFrame.clipRect?.width === 0 && emptyFrame.clipRect?.height === 0, 'wholly off-canvas frame must retain source rect plus an explicit empty drawable clip');
  assert(emptyTable.rect !== undefined && emptyTable.viewportRect?.width === 0 && emptyTable.viewportRect?.height === 0, 'wholly off-canvas table must retain an explicit empty effective viewport');
  assert(!emptyTable.scrollbar || (emptyTable.scrollbar.clipRect.width === 0 && emptyTable.scrollbar.clipRect.height === 0), 'wholly off-canvas scrollbar must retain an explicit empty clip');

  const partialScene = sceneFromRaw([
    'local menu = { name = "PartialFrame", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 60, x = 50, y = 30 })',
    'local table = frame:addTable(1, { width = 40, y = 20, reserveScrollBar = false })',
    'table:setColWidth(1, 40, false)',
    'local row = table:addRow(false, {})', 'row[1]:createText("partial", { height = 8 })',
    'frame:display()',
  ].join('\n'), 'selftest/raw-partial-frame.lua');
  const partialFrame = partialScene.frames[0];
  const partialTable = partialScene.tables[0];
  assert(partialFrame.clipRect !== undefined && partialFrame.clipRect.x >= 0 && partialFrame.clipRect.y >= 0, 'partial frame clip must remain explicit and bounded');
  assert(partialTable.viewportRect !== undefined && partialTable.viewportRect.x >= partialFrame.clipRect!.x && partialTable.viewportRect.y >= partialFrame.clipRect!.y, `table viewport must be contained by the effective frame/drawable clip: ${JSON.stringify(partialTable.viewportRect)}`);
  if (partialTable.scrollbar) assert(partialTable.scrollbar.clipRect.x >= partialFrame.clipRect!.x && partialTable.scrollbar.clipRect.y >= partialFrame.clipRect!.y && partialTable.scrollbar.clipRect.x + partialTable.scrollbar.clipRect.width <= partialFrame.clipRect!.x + partialFrame.clipRect!.width && partialTable.scrollbar.clipRect.y + partialTable.scrollbar.clipRect.height <= partialFrame.clipRect!.y + partialFrame.clipRect!.height, 'partial scrollbar clip must remain inside the effective frame clip');
});

test('fail-first: unmodified raw producer output reaches the scene boundary', () => {
  const raw = rawProducerProjection.program;
  const summary = raw === undefined ? undefined : {
    status: raw.status,
    frames: raw.frames.map(node => ({ id: node.id, tableIds: node.tableIds, operationIds: node.operationIds })),
    tables: raw.tables.map(node => ({ id: node.id, frameId: node.frameId, rowIds: node.rowIds, operationIds: node.operationIds, kernel: node.kernelState !== undefined })),
    rows: raw.rows.map(node => ({ id: node.id, tableId: node.tableId, rowIndex: node.rowIndex, cellIds: node.cellIds, operationIds: node.operationIds, kernel: node.kernelState !== undefined })),
    cells: raw.cells.map(node => ({ id: node.id, tableId: node.tableId, rowId: node.rowId, rowIndex: node.rowIndex, column: node.column, operationIds: node.operationIds, kernel: node.kernelState !== undefined })),
    operations: raw.operations.map(node => ({ id: node.id, kind: node.kind, status: node.status, frameId: node.frameId, tableId: node.tableId, rowId: node.rowId, cellId: node.cellId, kernel: node.kernel !== undefined ? { before: node.kernel.stateBefore !== undefined, after: node.kernel.stateAfter !== undefined } : undefined })),
  };
  assert(raw !== undefined && rawProducerProjection.profile !== undefined, `raw producer fixture must produce an accepted program before scene projection: ${JSON.stringify(rawProducerProjection.result)} ${JSON.stringify(summary)}`);
  const result = rawProducerProjection.program === undefined || rawProducerProjection.profile === undefined
    ? undefined
    : buildX4UiScene(rawProducerProjection.result as X4UiLayoutProgramResult, corpus, rawProducerProjection.profile);
  assert(result !== undefined && !refusalHasNoScene(result), `unmodified raw producer output was refused: ${JSON.stringify(result)} ${JSON.stringify(summary)}`);
});

test('fail-first sixth review: raw producer partial branches are exhaustive scene inputs', () => {
  const sharedPrefix = [
    'local menu = { name = "Probe", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(2, { width = 100, reserveScrollBar = false, scaling = false })',
    'table:setColWidth(1, 40, false)',
    'table:setColWidth(2, 40, false)',
    'local row = table:addRow(false, { paddingTop = 1, paddingBottom = 1, borderBelow = false, fixed = false })',
    'row[1]:createButton({ height = 0, affectRowHeight = false })',
  ].join('\n');
  const cases: readonly [string, string, string][] = [
    ['unresolved createFrameHandle', [
      'local badframe = Helper.createFrameHandle(menu, dynamic_options)',
      'frame:display()',
    ].join('\n'), 'createFrameHandle'],
    ['unresolved display', [
      'missing_frame:display()',
    ].join('\n'), 'display'],
    ['unresolved OpenMenu', [
      'OpenMenu(dynamic_menu)',
      'frame:display()',
    ].join('\n'), 'OpenMenu'],
    ['unresolved setText', [
      'row[1]:setText(dynamicText)',
      'frame:display()',
    ].join('\n'), 'setText'],
    ['unresolved direct scaleX', [
      'Helper.scaleX(dynamic_value, false)',
      'frame:display()',
    ].join('\n'), 'scaleX'],
    ['unresolved direct scaleY', [
      'Helper.scaleY(dynamic_value, false)',
      'frame:display()',
    ].join('\n'), 'scaleY'],
    ['unresolved direct scaleFont', [
      'Helper.scaleFont("Zekton", dynamic_size, false)',
      'frame:display()',
    ].join('\n'), 'scaleFont'],
    ['known-table dynamic addRow', [
      'local dynamicrow = table:addRow(false, dynamic_options)',
      'frame:display()',
    ].join('\n'), 'addRow'],
    ['ownerless dynamic addRow', [
      'local missing_table = getTable()',
      'local missingrow = missing_table:addRow(false, { paddingTop = 1 })',
      'frame:display()',
    ].join('\n'), 'addRow'],
  ].map(([label, suffix, kind]) => [label, `${sharedPrefix}\n${suffix}`, kind]);
  const failures: string[] = [];
  const summaries: unknown[] = [];
  for (const [label, sourceText, kind] of cases) {
    const projected = rawProjectionFor(sourceText, `selftest/raw-branch-${kind}.lua`);
    const program = projected.program;
    summaries.push({
      label,
      resultStatus: 'status' in (projected.result || {}) ? projected.result.status : undefined,
      operations: program?.operations.filter(operationNode => operationNode.kind === kind).map(operationNode => ({
        status: operationNode.status,
        reason: operationNode.reason,
        frameId: operationNode.frameId,
        tableId: operationNode.tableId,
        rowId: operationNode.rowId,
        cellId: operationNode.cellId,
        kernel: operationNode.kernel !== undefined,
      })),
      frames: program?.frames.map(frame => ({ id: frame.id, status: frame.status, operationIds: frame.operationIds, tableIds: frame.tableIds })),
      rows: program?.rows.map(row => ({ id: row.id, status: row.status, tableId: row.tableId, rowIndex: row.rowIndex, kernel: row.kernelState !== undefined })),
      gaps: program?.gaps.filter(gap => gap.operationId === program.operations.find(operationNode => operationNode.kind === kind)?.id).map(gap => ({ category: gap.category, status: gap.status, reason: gap.reason, nodeId: gap.nodeId })),
    });
    if (!program || !projected.profile) {
      failures.push(`${label}: producer did not return a program`);
      continue;
    }
    const operation = program.operations.find(operationNode => operationNode.kind === kind);
    if (!operation) {
      failures.push(`${label}: missing ${kind} operation`);
      continue;
    }
    const sceneResult = buildX4UiScene(projected.result as X4UiLayoutProgramResult, corpus, projected.profile);
    if (refusalHasNoScene(sceneResult)) failures.push(`${label}: scene refused ${JSON.stringify(sceneResult)}`);
  }
  assert(failures.length === 0, `raw producer branch oracle escaped: ${failures.join(', ')}; ${JSON.stringify(summaries)}`);
});

test('sixth review: untouched raw producer covers every supported call kind', () => {
  const sourceText = [
    'local menu = { name = "AllKinds", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(4, { width = 100, reserveScrollBar = false, scaling = false })',
    'table:setColWidth(1, 25, false)',
    'table:setColWidthPercent(2, 25)',
    'table:setColWidth(3, 25, false)',
    'table:setColWidth(4, 25, false)',
    'local row = table:addRow(false, { paddingTop = 1, paddingBottom = 1, borderBelow = false, fixed = false, scaling = false })',
    'row[1]:setColSpan(1):createText("plain", { height = 12, minRowHeight = 10 })',
    'row[2]:createEditBox({ height = 10, defaultText = "input", description = "describe", active = false, scaling = false })',
    'row[3]:createButton({ height = 10, affectRowHeight = false, scaling = false }):setText("primary", { color = "white" }):setText2("secondary", {})',
    'row[4]:createIcon("solid", { height = 10, affectRowHeight = false, scaling = false })',
    'local sx = Helper.scaleX(12, false)',
    'local sy = Helper.scaleY(13, true)',
    'local sf = Helper.scaleFont("Zekton", 14, false)',
    'frame:display()',
    'OpenMenu(menu)',
  ].join('\n');
  const projected = rawProjectionFor(sourceText, 'selftest/raw-all-kinds.lua');
  assert(projected.program !== undefined && projected.profile !== undefined, 'all-kind raw source must produce a program/profile');
  const expectedKinds = [
    'createFrameHandle', 'addTable', 'setColWidth', 'setColWidthPercent', 'addRow',
    'setColSpan', 'createText', 'createEditBox', 'createButton', 'createIcon',
    'setText', 'setText2', 'scaleX', 'scaleY', 'scaleFont', 'display', 'OpenMenu',
  ] as const;
  const operations = projected.program?.operations || [];
  const missing = expectedKinds.filter(kind => !operations.some(candidate => candidate.kind === kind));
  assert(missing.length === 0, `raw all-kind source is missing operations: ${missing.join(', ')}`);
  const allKindResult = buildX4UiScene(projected.result as X4UiLayoutProgramResult, corpus, projected.profile!);
  assert(!refusalHasNoScene(allKindResult), `untouched all-kind producer output must reach the scene boundary: ${JSON.stringify(allKindResult)}`);
});

test('sixth review: untouched raw producer preserves missing-cell owner subsets', () => {
  const sourceText = [
    'local menu = { name = "MissingCell", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(2, { width = 80, reserveScrollBar = false, scaling = false })',
    'table:setColWidth(1, 40, false)',
    'table:setColWidth(2, 40, false)',
    'local row = table:addRow(false, { paddingTop = 1, paddingBottom = 1, borderBelow = false, fixed = false })',
    'row[1]:createButton({ height = 10, affectRowHeight = false })',
    'row[9]:setColSpan(2)',
    'row[9]:setText("missing")',
    'row[9]:setText2("missing2")',
    'row[9]:createText("missing-text", {})',
    'row[9]:createEditBox({ height = 10 })',
    'row[9]:createButton({ height = 10 })',
    'row[9]:createIcon("solid", { height = 10 })',
    'frame:display()',
  ].join('\n');
  const projected = rawProjectionFor(sourceText, 'selftest/raw-missing-cell.lua');
  assert(projected.program !== undefined && projected.profile !== undefined, 'missing-cell raw source must produce a program/profile');
  const operations = projected.program?.operations || [];
  for (const kind of ['setColSpan', 'setText', 'setText2', 'createText', 'createEditBox', 'createButton', 'createIcon']) {
    const candidates = operations.filter(operationNode => operationNode.kind === kind && operationNode.cellId === undefined);
    assert(candidates.length === 1 && candidates[0].status === 'unresolved' && candidates[0].cellId === undefined, `missing-cell ${kind} must remain an unresolved table/row owner subset: ${JSON.stringify(candidates)}`);
  }
  const result = buildX4UiScene(projected.result as X4UiLayoutProgramResult, corpus, projected.profile!);
  assert(!refusalHasNoScene(result), `missing-cell raw producer output must retain known siblings ${JSON.stringify({ operations: projected.program.operations.filter(operationNode => ['setColSpan', 'createText', 'createEditBox', 'createButton', 'createIcon', 'setText', 'setText2'].includes(operationNode.kind)).map(operationNode => ({ id: operationNode.id, kind: operationNode.kind, status: operationNode.status, reason: operationNode.reason, owners: { tableId: operationNode.tableId, rowId: operationNode.rowId, cellId: operationNode.cellId }, gaps: projected.program.gaps.filter(gap => gap.operationId === operationNode.id) })), result })}`);
});

test('sixth review: raw blocked operations retain their exact non-applied status shapes', () => {
  const sourceText = [
    'local menu = { name = "BlockedKinds", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(2, { width = 80, reserveScrollBar = false, scaling = false })',
    'table:setColWidth(1, 40, false)',
    'table:setColWidth(2, 40, false)',
    'local row = table:addRow(false, { paddingTop = 1, paddingBottom = 1, borderBelow = false, fixed = false })',
    'row[1]:createButton({ height = 10, affectRowHeight = false })',
    'if false then',
    '  local deadFrame = Helper.createFrameHandle(menu, { width = 50, height = 40 })',
    '  deadFrame:display()',
    '  table:setColWidth(1, 20, false)',
    '  row[1]:setColSpan(2)',
    '  row[1]:createText("dead", {})',
    '  row[1]:setText("dead", {})',
    '  OpenMenu(menu)',
    '  Helper.scaleX(12, false)',
    'end',
    'frame:display()',
  ].join('\n');
  const projected = rawProjectionFor(sourceText, 'selftest/raw-blocked-kinds.lua');
  assert(projected.program !== undefined && projected.profile !== undefined, 'blocked raw source must produce a program/profile');
  const blocked = projected.program?.operations.filter(operationNode => ['conditional', 'unreachable'].includes(operationNode.status)) || [];
  assert(blocked.length >= 7, `blocked raw source must retain all non-applied operations: ${JSON.stringify(blocked)}`);
  const sceneResult = buildX4UiScene(projected.result as X4UiLayoutProgramResult, corpus, projected.profile!);
  assert(!refusalHasNoScene(sceneResult), 'blocked raw operations must not refuse an otherwise valid partial target');
});

test('fail-first sixth review: creator replay rejects a skipped specialization effect folded into a later creator', () => {
  const fixture = makeFixture();
  const program = cloneProgram(fixture.program);
  (program as unknown as { status: 'partial' }).status = 'partial';
  const textOperation = program.operations.find(operationNode => operationNode.id === 'op:text')!;
  (textOperation as unknown as { status: 'unresolved'; reason: string; kernel?: unknown }).status = 'unresolved';
  (textOperation as unknown as { reason: string }).reason = 'specialization options are dynamic or unknown; source defaults were not substituted';
  delete (textOperation as unknown as { kernel?: unknown }).kernel;
  (program.gaps as unknown as Array<Record<string, unknown>>).push({
    category: 'cell', status: 'dynamic', reason: 'specialization options remain dynamic', source: textOperation.source,
    operationId: textOperation.id, nodeId: 'cell:text',
  });
  const afterRow = program.operations.find(operationNode => operationNode.id === 'op:row1')!.kernel!.stateAfter!;
  const buttonOperation = program.operations.find(operationNode => operationNode.id === 'op:button')!;
  const afterButton = buttonOperation.kernel!.stateAfter!;
  (buttonOperation.metadata.semantics as unknown as Record<string, unknown>).properties = [];
  (buttonOperation.kernel as unknown as { stateBefore: HelperTableState }).stateBefore = afterRow;
  (buttonOperation.kernel as unknown as { stateAfter: HelperTableState }).stateAfter = afterButton;
  assert(refusalHasNoScene(sceneFor(fixture, program)), 'a creator must not absorb an unresolved preceding creator specialization');
});

test('fail-first: cell source offsets may be equal or non-monotonic while columns remain ordered', () => {
  const fixture = makeFixture();
  const rawControl = rawProducerProjection.result as X4UiLayoutProgramResult;
  assert(!refusalHasNoScene(buildX4UiScene(rawControl, corpus, rawProducerProjection.profile!)), 'real producer cell source offsets must not refuse a valid column-ordered row');

  const duplicateColumn = cloneProgram(fixture.program);
  (duplicateColumn.cells[1] as unknown as { column: number }).column = duplicateColumn.cells[0].column;
  assert(refusalHasNoScene(sceneFor(fixture, duplicateColumn)), 'duplicate source columns must still refuse');

  const outOfOrderColumn = cloneProgram(fixture.program);
  (outOfOrderColumn.cells[2] as unknown as { column: number }).column = 1;
  assert(refusalHasNoScene(sceneFor(fixture, outOfOrderColumn)), 'out-of-order/duplicate source columns must still refuse');
});

test('fail-first: every materialized table producer chain is continuous regardless of reserve mode', () => {
  const fixture = makeFixture();
  const normal = cloneProgram(fixture.program);
  removeOperation(normal, 'op:width:2');
  assert(refusalHasNoScene(sceneFor(fixture, normal)), 'normal reserve=false chain disconnection must refuse');

  const reserveRemainsTrue = cloneProgram(fixture.program);
  const table = reserveRemainsTrue.tables[0];
  (table.descriptorFacts as Record<string, X4UiLayoutDescriptorFact>).reserveScrollBar = known(true, 'boolean', table.source);
  (table.kernelState!.properties as unknown as { reserveScrollBar: boolean }).reserveScrollBar = true;
  removeOperation(reserveRemainsTrue, 'op:width:2');
  assert(refusalHasNoScene(sceneFor(fixture, reserveRemainsTrue)), 'reserve-remains-true chain disconnection must refuse');
});

test('fail-first: source-valid partial producer owner subsets retain known siblings', () => {
  const fixture = makeFixture();
  const tableWithoutFrameProjected = rawProjectionFor([
    'local menu = { name = "RawTableOwnerSubset", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(1, { width = 40, reserveScrollBar = false })',
    'table:setColWidth(1, 40, false)',
    'local stable = table:addRow(false, {})', 'stable[1]:createText("known", { height = 8 })',
    'local dynamic = table:addRow(false, dynamic_options)',
    'frame:display()',
  ].join('\n'), 'selftest/raw-table-owner-subset.lua');
  assert(tableWithoutFrameProjected.result !== undefined && 'program' in tableWithoutFrameProjected.result && tableWithoutFrameProjected.profile !== undefined, 'source-valid table owner subset branch must produce a result');
  const tableWithoutFrameResult = buildX4UiScene(tableWithoutFrameProjected.result as X4UiLayoutProgramResult, corpus, tableWithoutFrameProjected.profile);
  assert(!refusalHasNoScene(tableWithoutFrameResult), `source-valid owner subset must retain known table/row siblings: ${JSON.stringify(tableWithoutFrameResult)}`);

  const rowWithoutTable = cloneProgram(fixture.program);
  const rowOperation = rowWithoutTable.operations.find(operationNode => operationNode.id === 'op:row1')!;
  delete (rowOperation as unknown as { tableId?: string }).tableId;
  const rowWithoutTableResult = sceneFor(fixture, rowWithoutTable);
  assert(refusalHasNoScene(rowWithoutTableResult), `a materialized applied row cannot lose its producer table owner: ${JSON.stringify(rowWithoutTableResult)}`);

  const cellWithoutSelectionProjected = rawProjectionFor([
    'local menu = { name = "RawCellWithoutSelection", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(1, { width = 40, reserveScrollBar = false })',
    'table:setColWidth(1, 40, false)',
    'local row = table:addRow(false, {})',
    'row[1]:createText(dynamic_text, { height = 8 })',
    'frame:display()',
  ].join('\n'), 'selftest/raw-cell-without-selection.lua');
  assert(cellWithoutSelectionProjected.result !== undefined && 'program' in cellWithoutSelectionProjected.result && cellWithoutSelectionProjected.profile !== undefined, 'source-valid cell-without-selection branch must produce a result');
  const cellWithoutSelectionResult = buildX4UiScene(cellWithoutSelectionProjected.result as X4UiLayoutProgramResult, corpus, cellWithoutSelectionProjected.profile);
  assert(!refusalHasNoScene(cellWithoutSelectionResult), `table+row without cellId must retain known table/row siblings: ${JSON.stringify(cellWithoutSelectionResult)}`);

  const dangling = cloneProgram(fixture.program);
  (dangling.operations.find(operationNode => operationNode.id === 'op:row1') as unknown as { tableId: string }).tableId = 'table:missing';
  assert(refusalHasNoScene(sceneFor(fixture, dangling)), 'partial owner subsets must still reject dangling IDs');
});

test('fail-first: impossible producer status and reason combinations refuse', () => {
  const fixture = makeFixture();
  const unresolvedTransition = cloneProgram(fixture.program);
  const rowOperation = unresolvedTransition.operations.find(operationNode => operationNode.id === 'op:row1')!;
  (rowOperation as unknown as { status: 'unresolved'; reason: string }).status = 'unresolved';
  (rowOperation as unknown as { reason: string }).reason = 'row kernel state is deterministic but one or more descriptor facts remain unresolved';
  (unresolvedTransition.gaps as unknown as Array<Record<string, unknown>>).push({
    category: 'row', status: 'unknown', reason: 'row descriptor remains unresolved', source: rowOperation.source,
    operationId: rowOperation.id, nodeId: 'row:one',
  });
  assert(refusalHasNoScene(sceneFor(fixture, unresolvedTransition)), 'unresolved addRow with a materialized transition must refuse');

  const hybrid = cloneProgram(fixture.program);
  const hybridRow = hybrid.operations.find(operationNode => operationNode.id === 'op:row1')!;
  (hybridRow as unknown as { status: 'unresolved'; reason: string; kernel?: unknown }).status = 'unresolved';
  (hybridRow as unknown as { reason: string }).reason = 'addRow options are dynamic or unknown; source defaults were not substituted';
  delete (hybridRow as unknown as { kernel?: unknown }).kernel;
  (hybrid.gaps as unknown as Array<Record<string, unknown>>).push({
    category: 'row', status: 'unknown', reason: 'row options remain dynamic', source: hybridRow.source,
    operationId: hybridRow.id, nodeId: 'row:one',
  });
  assert(refusalHasNoScene(sceneFor(fixture, hybrid)), 'unresolved addRow cannot retain a hybrid materialized row state');

  const borrowed = cloneProgram(fixture.program);
  (borrowed as unknown as { status: 'partial' }).status = 'partial';
  const width = borrowed.operations.find(operationNode => operationNode.id === 'op:width:1')!;
  (width as unknown as { reason: string }).reason = DETERMINISTIC_DESCRIPTOR_PARTIAL_REASON_FOR_TEST;
  (borrowed.gaps as unknown as Array<Record<string, unknown>>).push({
    category: 'cell', status: 'unknown', reason: 'borrowed cell descriptor gap', source: width.source,
    operationId: width.id, nodeId: borrowed.tables[0].id,
  });
  assert(refusalHasNoScene(sceneFor(fixture, borrowed)), 'applied width cannot borrow a cell-kind reason or gap');
});

test('fail-first fifth review: per-kind policy rejects source-impossible owner, reason, status, and kernel shapes', () => {
  const fixture = makeFixture();
  const failures: string[] = [];
  const expectRefusal = (label: string, program: X4UiLayoutProgram): void => {
    if (!refusalHasNoScene(sceneFor(fixture, program))) failures.push(label);
  };

  const unresolvedAddRowTransition = cloneProgram(fixture.program);
  (unresolvedAddRowTransition as unknown as { status: 'partial' }).status = 'partial';
  const rowOperation = unresolvedAddRowTransition.operations.find(operationNode => operationNode.id === 'op:row1')!;
  (rowOperation as unknown as { status: 'unresolved'; reason: string }).status = 'unresolved';
  (rowOperation as unknown as { reason: string }).reason = 'row kernel state is deterministic but one or more descriptor facts remain unresolved';
  (unresolvedAddRowTransition.gaps as unknown as Array<Record<string, unknown>>).push({
    category: 'row', status: 'unknown', reason: 'row descriptor remains unresolved', source: rowOperation.source,
    operationId: rowOperation.id, nodeId: 'row:one',
  });
  expectRefusal('unresolved addRow with materialized transition', unresolvedAddRowTransition);

  const arbitraryWidthReason = cloneProgram(fixture.program);
  (arbitraryWidthReason as unknown as { status: 'partial' }).status = 'partial';
  const widthOperation = arbitraryWidthReason.operations.find(operationNode => operationNode.id === 'op:width:1')!;
  (widthOperation as unknown as { reason: string }).reason = 'forged width reason';
  expectRefusal('applied width with unknown reason', arbitraryWidthReason);

  const forgedWidthFrame = cloneProgram(fixture.program);
  (forgedWidthFrame as unknown as { status: 'partial' }).status = 'partial';
  const framedWidth = forgedWidthFrame.operations.find(operationNode => operationNode.id === 'op:width:1')!;
  (framedWidth as unknown as { frameId: string }).frameId = forgedWidthFrame.frames[0].id;
  (forgedWidthFrame.frames[0].operationIds as unknown as string[]).push(framedWidth.id);
  expectRefusal('applied width with reciprocal frame owner', forgedWidthFrame);

  const displayWithOwners = cloneProgram(fixture.program);
  (displayWithOwners as unknown as { status: 'partial' }).status = 'partial';
  const display = displayWithOwners.operations.find(operationNode => operationNode.id === 'op:hidden-tail')!;
  (display as unknown as { tableId: string; rowId: string; cellId: string; kernel: unknown }).tableId = displayWithOwners.tables[0].id;
  (display as unknown as { rowId: string }).rowId = displayWithOwners.rows[1].id;
  (display as unknown as { cellId: string }).cellId = displayWithOwners.cells[5].id;
  (display as unknown as { kernel: unknown }).kernel = displayWithOwners.operations.find(operationNode => operationNode.id === 'op:hidden')!.kernel;
  (displayWithOwners.tables[0].operationIds as unknown as string[]).push(display.id);
  (displayWithOwners.rows[1].operationIds as unknown as string[]).push(display.id);
  (displayWithOwners.cells[5].operationIds as unknown as string[]).push(display.id);
  expectRefusal('display with table row cell owners and kernel', displayWithOwners);

  const displayWithoutFrame = cloneProgram(fixture.program);
  (displayWithoutFrame as unknown as { status: 'partial' }).status = 'partial';
  delete (displayWithoutFrame.operations.find(operationNode => operationNode.id === 'op:hidden-tail') as unknown as { frameId?: string }).frameId;
  expectRefusal('applied display without its frame owner', displayWithoutFrame);

  const appliedTextWithoutCell = cloneProgram(fixture.program);
  (appliedTextWithoutCell as unknown as { status: 'partial' }).status = 'partial';
  delete (appliedTextWithoutCell.operations.find(operationNode => operationNode.id === 'op:button-text') as unknown as { cellId?: string }).cellId;
  expectRefusal('applied setText without its cell owner', appliedTextWithoutCell);

  const appliedCreatorWithoutCell = cloneProgram(fixture.program);
  (appliedCreatorWithoutCell as unknown as { status: 'partial' }).status = 'partial';
  delete (appliedCreatorWithoutCell.operations.find(operationNode => operationNode.id === 'op:button') as unknown as { cellId?: string }).cellId;
  expectRefusal('applied creator without its cell owner', appliedCreatorWithoutCell);

  assert(failures.length === 0, `closed per-kind policy escaped: ${failures.join(', ')}`);
});

test('fail-first fifth review: unresolved no-transition operations are zero-state evidence', () => {
  const fixture = makeFixture();
  const failures: string[] = [];
  const hybridRow = cloneProgram(fixture.program);
  (hybridRow as unknown as { status: 'partial' }).status = 'partial';
  const rowOperation = hybridRow.operations.find(operationNode => operationNode.id === 'op:row1')!;
  (rowOperation as unknown as { status: 'unresolved'; reason: string; kernel?: unknown }).status = 'unresolved';
  (rowOperation as unknown as { reason: string }).reason = 'addRow options are dynamic or unknown; source defaults were not substituted';
  delete (rowOperation as unknown as { kernel?: unknown }).kernel;
  (hybridRow.gaps as unknown as Array<Record<string, unknown>>).push({
    category: 'row', status: 'unknown', reason: 'row options remain dynamic', source: rowOperation.source,
    operationId: rowOperation.id, nodeId: hybridRow.rows[0].id,
  });
  if (!refusalHasNoScene(sceneFor(fixture, hybridRow))) failures.push('unresolved addRow retained materialized row');

  const hybridCell = cloneProgram(fixture.program);
  (hybridCell as unknown as { status: 'partial' }).status = 'partial';
  const cellOperation = hybridCell.operations.find(operationNode => operationNode.id === 'op:text')!;
  (cellOperation as unknown as { status: 'unresolved'; reason: string; kernel?: unknown }).status = 'unresolved';
  (cellOperation as unknown as { reason: string }).reason = 'specialization options are dynamic or unknown; source defaults were not substituted';
  delete (cellOperation as unknown as { kernel?: unknown }).kernel;
  (hybridCell.gaps as unknown as Array<Record<string, unknown>>).push({
    category: 'cell', status: 'unknown', reason: 'specialization options remain dynamic', source: cellOperation.source,
    operationId: cellOperation.id, nodeId: hybridCell.cells[0].id,
  });
  if (!refusalHasNoScene(sceneFor(fixture, hybridCell))) failures.push('unresolved specialization retained materialized cell');

  assert(failures.length === 0, `zero-state unresolved operation escaped: ${failures.join(', ')}`);
});

test('fail-first fifth review: unmaterialized partial owners retain evidence without geometry', () => {
  const fixture = makeFixture();
  const knownTableRow = cloneProgram(fixture.program);
  (knownTableRow as unknown as { status: 'partial' }).status = 'partial';
  const knownRow = cloneJsonValue(knownTableRow.rows[1]) as unknown as X4UiLayoutRowNode;
  const knownRowOperation = operation('op:dynamic-row', 'addRow', source(230), knownTableRow.tables[0].id, 'row:dynamic', '');
  delete (knownRowOperation as unknown as { cellId?: string }).cellId;
  (knownRowOperation as unknown as { status: 'unresolved'; reason: string }).status = 'unresolved';
  (knownRowOperation as unknown as { reason: string }).reason = 'addRow options are dynamic or unknown; source defaults were not substituted';
  delete (knownRowOperation as unknown as { kernel?: unknown }).kernel;
  (knownRow as unknown as { id: string; rowIndex?: number; kernelState?: unknown; height?: unknown; tableId: string; cellIds: string[]; operationIds: string[]; status: string }).id = 'row:dynamic';
  delete (knownRow as unknown as { rowIndex?: number }).rowIndex;
  delete (knownRow as unknown as { kernelState?: unknown }).kernelState;
  delete (knownRow as unknown as { height?: unknown }).height;
  (knownRow as unknown as { tableId: string }).tableId = knownTableRow.tables[0].id;
  (knownRow as unknown as { cellIds: string[] }).cellIds = [];
  (knownRow as unknown as { operationIds: string[] }).operationIds = [knownRowOperation.id];
  (knownRow as unknown as { status: string }).status = 'refused';
  (knownTableRow.rows as unknown as X4UiLayoutRowNode[]).push(knownRow);
  (knownTableRow.operations as unknown as X4UiLayoutOperation[]).push(knownRowOperation);
  (knownTableRow.tables[0].operationIds as unknown as string[]).push(knownRowOperation.id);
  (knownTableRow.gaps as unknown as Array<Record<string, unknown>>).push({
    category: 'options', status: 'unknown', reason: knownRowOperation.reason, source: knownRowOperation.source,
    operationId: knownRowOperation.id, nodeId: knownRow.id,
  });
  const knownTableProjection = rawProjectionFor([
    'local menu = { name = "KnownTableDynamicRow", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(1, { width = 40, reserveScrollBar = false })',
    'table:setColWidth(1, 40, false)',
    'local stable = table:addRow(false, {})', 'stable[1]:createText("stable", { height = 8 })',
    'local dynamic = table:addRow(false, dynamic_options)',
    'frame:display()',
  ].join('\n'), 'selftest/raw-known-table-dynamic-row.lua');
  assert(knownTableProjection.result !== undefined && 'program' in knownTableProjection.result && knownTableProjection.profile !== undefined, 'known-table dynamic row source must produce a result');
  const knownTableResult = buildX4UiScene(knownTableProjection.result as X4UiLayoutProgramResult, corpus, knownTableProjection.profile);
  if (refusalHasNoScene(knownTableResult)) throw new Error(`known-table unmaterialized row must retain known table/row siblings: ${JSON.stringify(knownTableResult)}`);
  assert(sceneOf(knownTableResult).status === 'partial' && sceneOf(knownTableResult).rows.every(row => row.source.file !== 'fixture.lua' || row.source.start.offset !== 230), 'unmaterialized known-table row must not become drawable geometry');

  const ownerless = cloneProgram(fixture.program);
  (ownerless as unknown as { status: 'partial' }).status = 'partial';
  const ownerlessRow = cloneJsonValue(ownerless.rows[1]) as unknown as X4UiLayoutRowNode;
  const ownerlessOperation = operation('op:ownerless-row', 'addRow', source(232), ownerless.tables[0].id, 'row:ownerless', '');
  delete (ownerlessOperation as unknown as { tableId?: string; cellId?: string }).tableId;
  delete (ownerlessOperation as unknown as { cellId?: string }).cellId;
  (ownerlessOperation as unknown as { status: 'unresolved'; reason: string }).status = 'unresolved';
  (ownerlessOperation as unknown as { reason: string }).reason = 'row owner is not an applied table identity';
  delete (ownerlessOperation as unknown as { kernel?: unknown }).kernel;
  (ownerlessRow as unknown as { id: string; tableId?: string; rowIndex?: number; kernelState?: unknown; height?: unknown; cellIds: string[]; operationIds: string[]; status: string }).id = 'row:ownerless';
  delete (ownerlessRow as unknown as { tableId?: string; rowIndex?: number; kernelState?: unknown; height?: unknown }).tableId;
  delete (ownerlessRow as unknown as { rowIndex?: number }).rowIndex;
  delete (ownerlessRow as unknown as { kernelState?: unknown }).kernelState;
  delete (ownerlessRow as unknown as { height?: unknown }).height;
  (ownerlessRow as unknown as { cellIds: string[] }).cellIds = [];
  (ownerlessRow as unknown as { operationIds: string[] }).operationIds = [ownerlessOperation.id];
  (ownerlessRow as unknown as { status: string }).status = 'refused';
  (ownerless.rows as unknown as X4UiLayoutRowNode[]).push(ownerlessRow);
  (ownerless.operations as unknown as X4UiLayoutOperation[]).push(ownerlessOperation);
  (ownerless.gaps as unknown as Array<Record<string, unknown>>).push({
    category: 'data-flow', status: 'unknown', reason: ownerlessOperation.reason, source: ownerlessOperation.source,
    operationId: ownerlessOperation.id, nodeId: ownerlessRow.id,
  });
  const ownerlessScene = sceneFromRaw([
    'local menu = { name = "OwnerlessDynamicRow", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(1, { width = 40, reserveScrollBar = false })',
    'table:setColWidth(1, 40, false)',
    'local stable = table:addRow(false, {})', 'stable[1]:createText("stable", { height = 8 })',
    'local missing = missing_table:addRow(false, dynamic_options)',
    'frame:display()',
  ].join('\n'), 'selftest/raw-ownerless-dynamic-row.lua');
  assert(ownerlessScene.status === 'partial', 'ownerless unresolved row must retain known siblings as partial evidence');

  const missingCell = cloneProgram(fixture.program);
  (missingCell as unknown as { status: 'partial' }).status = 'partial';
  const missingCellOperation = operation('op:missing-cell-selection', 'createText', source(234), missingCell.tables[0].id, missingCell.rows[0].id, '');
  delete (missingCellOperation as unknown as { cellId?: string }).cellId;
  (missingCellOperation as unknown as { status: 'unresolved'; reason: string }).status = 'unresolved';
  (missingCellOperation as unknown as { reason: string }).reason = 'specialization receiver/index is not an applied source cell identity';
  delete (missingCellOperation as unknown as { kernel?: unknown }).kernel;
  (missingCell.operations as unknown as X4UiLayoutOperation[]).push(missingCellOperation);
  (missingCell.tables[0].operationIds as unknown as string[]).push(missingCellOperation.id);
  (missingCell.rows[0].operationIds as unknown as string[]).push(missingCellOperation.id);
  (missingCell.gaps as unknown as Array<Record<string, unknown>>).push({
    category: 'cell', status: 'unknown', reason: missingCellOperation.reason, source: missingCellOperation.source,
    operationId: missingCellOperation.id,
  });
  const missingCellScene = sceneFromRaw([
    'local menu = { name = "MissingCellSelection", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(2, { width = 80, reserveScrollBar = false })',
    'table:setColWidth(1, 40, false)', 'table:setColWidth(2, 40, false)',
    'local row = table:addRow(false, {})',
    'row[1]:createText(dynamic_text, { height = 8 })', 'row[2]:createText("known", { height = 8 })',
    'frame:display()',
  ].join('\n'), 'selftest/raw-missing-cell-selection.lua');
  assert(missingCellScene.status === 'partial', 'missing-cell table+row operation with undefined gap node must retain siblings as partial evidence');
});

test('fail-first fifth review: consecutive unresolved width operations preserve later deterministic continuity', () => {
  const projected = rawProjectionFor([
    'local menu = { name = "ConsecutiveDynamicWidths", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(2, { width = 80, reserveScrollBar = false, scaling = false })',
    'table:setColWidth(1, 40, false)',
    'table:setColWidth(dynamic_index_one, 40, false)',
    'table:setColWidth(dynamic_index_two, 40, false)',
    'local row = table:addRow(false, { paddingTop = 1, paddingBottom = 1, borderBelow = false, fixed = false })',
    'row[1]:createText("later", { height = 8 })',
    'frame:display()',
  ].join('\n'), 'selftest/raw-consecutive-dynamic-widths.lua');
  assert(projected.result !== undefined && 'program' in projected.result && projected.program !== undefined && projected.profile !== undefined, `consecutive dynamic width source must produce a result: ${JSON.stringify(projected.result)}`);
  const result = buildX4UiScene(projected.result as X4UiLayoutProgramResult, corpus, projected.profile);
  assert(!refusalHasNoScene(result), 'two consecutive unresolved width operations must not break later applied row/cell continuity');
  assert(sceneOf(result).status === 'partial', 'consecutive unresolved width operations must retain partial status');
});

test('fail-first: incapable cell creators cannot append kernel diagnostics', () => {
  const fixture = makeFixture();
  const program = cloneProgram(fixture.program);
  const table = program.tables[0];
  const before = table.kernelState!;
  const after = JSON.parse(JSON.stringify(before)) as HelperTableState;
  (after.diagnostics as unknown as HelperTableState['diagnostics'][number][]).push({
    code: 'colspan-hid-non-cell',
    message: 'colspan hid non-cell at column 2',
    provenance: X4_LAYOUT_PROVENANCE,
  });
  (table as unknown as { kernelState: HelperTableState }).kernelState = after;
  const late = operation('op:late-creator', 'createText', source(300), table.id, 'row:two', 'cell:fixed-last');
  (late as unknown as { kernel: { stateBefore: HelperTableState; stateAfter: HelperTableState } }).kernel = { stateBefore: before, stateAfter: after };
  (program.operations as unknown as X4UiLayoutOperation[]).push(late);
  (table.operationIds as unknown as string[]).push(late.id);
  (program.rows[1].operationIds as unknown as string[]).push(late.id);
  (program.cells[7].operationIds as unknown as string[]).push(late.id);
  const result = sceneFor(fixture, program);
  assert(refusalHasNoScene(result), `a cell creator must not authorize a syntactically valid colspan diagnostic: ${JSON.stringify(result)}`);
});

test('seventh review fail-first: differential raw field branches remain accepted or refused exactly with the producer', () => {
  const prefix = (tableOptions: string, body: string): string => [
    'local menu = { name = "FieldMatrix", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    `local table = frame:addTable(2, ${tableOptions})`,
    body,
  ].join('\n');
  const cases: readonly [string, string, string][] = [
    ['dynamic width index', prefix('{ width = 100, reserveScrollBar = false, scaling = false }', [
      'table:setColWidth(dynamic_index, 40, false)',
      'table:setColWidth(1, 40, false)',
      'local row = table:addRow(false, { paddingTop = 1, paddingBottom = 1, borderBelow = false, fixed = false })',
      'row[1]:createButton({ height = 0, affectRowHeight = false })',
      'frame:display()',
    ].join('\n')), 'setColWidth'],
    ['dynamic width scaling', prefix('{ width = 100, reserveScrollBar = false, scaling = false }', [
      'table:setColWidth(1, 40, dynamic_scaling)',
      'table:setColWidth(2, 40, false)',
      'local row = table:addRow(false, { paddingTop = 1, paddingBottom = 1, borderBelow = false, fixed = false })',
      'row[1]:createButton({ height = 0, affectRowHeight = false })',
      'frame:display()',
    ].join('\n')), 'setColWidth'],
    ['dynamic percent index', prefix('{ width = 100, reserveScrollBar = false, scaling = false }', [
      'table:setColWidthPercent(dynamic_index, 50)',
      'table:setColWidth(1, 40, false)',
      'local row = table:addRow(false, { paddingTop = 1, paddingBottom = 1, borderBelow = false, fixed = false })',
      'row[1]:createButton({ height = 0, affectRowHeight = false })',
      'frame:display()',
    ].join('\n')), 'setColWidthPercent'],
    ['dynamic addTable reserve', prefix('{ width = 100, reserveScrollBar = dynamic_reserve, scaling = false }', [
      'frame:display()',
    ].join('\n')), 'addTable'],
    ['dynamic addTable scaling', prefix('{ width = 100, reserveScrollBar = false, scaling = dynamic_scaling }', [
      'frame:display()',
    ].join('\n')), 'addTable'],
    ['dynamic creator x', prefix('{ width = 100, reserveScrollBar = false, scaling = false }', [
      'table:setColWidth(1, 40, false)',
      'table:setColWidth(2, 40, false)',
      'local row = table:addRow(false, { paddingTop = 1, paddingBottom = 1, borderBelow = false, fixed = false })',
      'row[1]:createButton({ x = dynamic_x, height = 10 })',
      'frame:display()',
    ].join('\n')), 'createButton'],
    ['dynamic creator width', prefix('{ width = 100, reserveScrollBar = false, scaling = false }', [
      'table:setColWidth(1, 40, false)',
      'table:setColWidth(2, 40, false)',
      'local row = table:addRow(false, { paddingTop = 1, paddingBottom = 1, borderBelow = false, fixed = false })',
      'row[1]:createIcon("solid", { width = dynamic_width, height = 10 })',
      'frame:display()',
    ].join('\n')), 'createIcon'],
    ['dynamic setText x', prefix('{ width = 100, reserveScrollBar = false, scaling = false }', [
      'table:setColWidth(1, 40, false)',
      'table:setColWidth(2, 40, false)',
      'local row = table:addRow(false, { paddingTop = 1, paddingBottom = 1, borderBelow = false, fixed = false })',
      'row[1]:createButton({ height = 10 }):setText("dynamic", { x = dynamic_x })',
      'frame:display()',
    ].join('\n')), 'setText'],
    ['non-Helper scaleX', [
      'local menu = { name = "ScaleMatrix", layer = 1 }',
      'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
      'local table = frame:addTable(1, { width = 100, reserveScrollBar = false, scaling = false })',
      'table:setColWidth(1, 100, false)',
      'local row = table:addRow(false, { paddingTop = 1, paddingBottom = 1, borderBelow = false, fixed = false })',
      'row[1]:createButton({ height = 10 })',
      'local scaled = scaleX(dynamic_value)',
      'frame:display()',
    ].join('\n'), 'scaleX'],
  ];
  const failures: string[] = [];
  for (const [label, sourceText, kind] of cases) {
    const projected = rawProjectionFor(sourceText, `selftest/raw-seventh-field-${label.replaceAll(' ', '-')}.lua`);
    if (typeof projected === 'string') {
      failures.push(`${label}: producer setup`);
      continue;
    }
    if (!projected.program || !projected.profile) {
      failures.push(`${label}: producer returned no successful program`);
      continue;
    }
    const operationNode = projected.program.operations.find(operationCandidate => operationCandidate.kind === kind);
    if (!operationNode || (projected.program.status !== 'projected' && projected.program.status !== 'partial')) failures.push(`${label}: producer status/operation missing`);
    const sceneResult = buildX4UiScene(projected.result as X4UiLayoutProgramResult, corpus, projected.profile);
    if (refusalHasNoScene(sceneResult)) failures.push(`${label}: scene refused producer ${operationNode?.status || 'unknown'} branch ${JSON.stringify({ reason: operationNode?.reason, owners: { frameId: operationNode?.frameId, tableId: operationNode?.tableId, rowId: operationNode?.rowId, cellId: operationNode?.cellId }, descriptorFacts: operationNode?.descriptorFacts, gaps: projected.program.gaps.filter(gap => gap.operationId === operationNode?.id) })}`);
  }
  assert(failures.length === 0, `differential producer field branches escaped: ${failures.join(', ')}`);
});

test('seventh review fail-first: empty pre-final table height zero is source-valid', () => {
  const projected = rawProjectionFor([
    'local menu = { name = "EmptyPrefinal", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(2, { width = 100, reserveScrollBar = false, scaling = false })',
    'frame:display()',
  ].join('\n'), 'selftest/raw-seventh-prefinal.lua');
  assert(projected.program !== undefined && projected.profile !== undefined, 'empty pre-final producer must return a program');
  const table = projected.program.tables[0];
  assert(table.kernelState?.final === false && table.height?.status === 'known' && table.height.value === 0, 'producer must expose known zero pre-final height');
  const result = buildX4UiScene(projected.result as X4UiLayoutProgramResult, corpus, projected.profile);
  assert(!refusalHasNoScene(result), 'known zero pre-final table must remain a scene input');
});

test('seventh review fail-first: rejected kernel operations retain exact refusal state evidence', () => {
  const prefix = (suffix: string): string => [
    'local menu = { name = "RejectedMatrix", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(2, { width = 100, reserveScrollBar = false, scaling = false })',
    'table:setColWidth(1, 40, false)',
    'table:setColWidth(2, 40, false)',
    'local row = table:addRow(false, { paddingTop = 1, paddingBottom = 1, borderBelow = false, fixed = false })',
    suffix,
    'frame:display()',
  ].join('\n');
  const cases: readonly [string, string][] = [
    ['rejected width', 'table:setColWidth(999, 40, false)'],
    ['rejected row', 'local bad = table:addRow(false, { paddingTop = -1 })'],
    ['rejected span', 'row[1]:setColSpan(0)'],
    ['rejected text', 'row[1]:createText("bad", { height = -1 })'],
    ['rejected editbox', 'row[1]:createEditBox({ height = -1 })'],
    ['rejected button', 'row[1]:createButton({ height = -1 })'],
    ['rejected icon', 'row[1]:createIcon("solid", { height = -1 })'],
  ];
  const failures: string[] = [];
  for (const [label, suffix] of cases) {
    const projected = rawProjectionFor(prefix(suffix), `selftest/raw-seventh-${label.replaceAll(' ', '-')}.lua`);
    const program = projected.program;
    if (!program || !projected.profile) {
      failures.push(`${label}: producer returned no program`);
      continue;
    }
    const rejected = program.operations.find(operationCandidate => operationCandidate.status === 'rejected');
    if (!rejected || !rejected.kernel?.refusal || rejected.kernel.stateBefore === undefined || rejected.kernel.stateAfter === undefined) failures.push(`${label}: missing exact refusal transition`);
    const result = buildX4UiScene(projected.result as X4UiLayoutProgramResult, corpus, projected.profile);
    if (refusalHasNoScene(result)) failures.push(`${label}: scene refused exact rejected branch`);
  }
  assert(failures.length === 0, `rejected producer branches escaped: ${failures.join(', ')}`);
});

test('seventh review fail-first: creator replay has no target-cell fallback for any creator', () => {
  const fixture = makeFixture();
  const creatorCases: readonly [string, string, string][] = [
    ['op:text', 'op:button', 'cell:text'],
    ['op:button', 'op:edit', 'cell:button'],
    ['op:edit', 'op:icon', 'cell:editbox'],
    ['op:icon', 'op:row2', 'cell:icon'],
  ];
  const failures: string[] = [];
  for (const [creatorId, followingId, cellId] of creatorCases) {
    const program = cloneProgram(fixture.program);
    (program as unknown as { status: 'partial' }).status = 'partial';
    const creator = program.operations.find(operationNode => operationNode.id === creatorId)!;
    (creator as unknown as { status: 'unresolved'; reason: string }).status = 'unresolved';
    (creator as unknown as { reason: string }).reason = 'specialization options are dynamic or unknown; source defaults were not substituted';
    delete (creator as unknown as { kernel?: unknown }).kernel;
    (program.gaps as unknown as Array<Record<string, unknown>>).push({
      category: 'options', status: 'dynamic', reason: creator.reason, source: creator.source,
      operationId: creator.id, nodeId: cellId,
    });
    const following = program.operations.find(operationNode => operationNode.id === followingId)!;
    const preceding = creatorId === 'op:text'
      ? 'op:row1'
      : creatorId === 'op:button'
        ? 'op:text'
        : creatorId === 'op:edit'
          ? 'op:button'
          : 'op:edit';
    (following.kernel as unknown as { stateBefore: HelperTableState }).stateBefore = program.operations.find(operationNode => operationNode.id === preceding)!.kernel!.stateAfter!;
    if (!refusalHasNoScene(sceneFor(fixture, program))) failures.push(creatorId);
  }
  assert(failures.length === 0, `creator folded effects escaped replay authority: ${failures.join(', ')}`);
});

test('seventh review fail-first: operation owner schemas are status-specific and ancestry-complete', () => {
  const shared = [
    'local menu = { name = "OwnerMatrix", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(1, { width = 100, reserveScrollBar = false, scaling = false })',
    'table:setColWidth(1, 100, false)',
    'local row = table:addRow(false, { paddingTop = 1, paddingBottom = 1, borderBelow = false, fixed = false })',
    'row[1]:createButton({ height = 10 })',
  ].join('\n');
  const openMenu = rawProjectionFor(`${shared}\nOpenMenu(dynamic_menu)\nframe:display()`, 'selftest/raw-seventh-openmenu-owner.lua');
  const display = rawProjectionFor(`${shared}\nmissing_frame:display()`, 'selftest/raw-seventh-display-owner.lua');
  const failures: string[] = [];
  for (const [label, projected, kind] of [['OpenMenu', openMenu, 'OpenMenu'], ['display', display, 'display'] as const]) {
    if (typeof projected === 'string') {
      failures.push(`${label}: producer setup`);
      continue;
    }
    if (!projected.program || !projected.profile) {
      failures.push(`${label}: producer setup`);
      continue;
    }
    const invalid = cloneProgram(projected.program);
    const operationNode = invalid.operations.find(operationCandidate => operationCandidate.kind === kind)!;
    (operationNode as unknown as { frameId: string }).frameId = invalid.frames[0].id;
    (invalid.frames[0].operationIds as unknown as string[]).push(operationNode.id);
    if (!refusalHasNoScene(pairInvalidProgram(invalid, projected.result as X4UiLayoutProgramResult, projected.profile, corpus, `${label}: forged frame owner`))) failures.push(`${label}: forged frame owner`);
  }
  const crossTable = cloneProgram(makeFixture().program);
  (crossTable as unknown as { status: 'partial' }).status = 'partial';
  const operationNode = crossTable.operations.find(operationCandidate => operationCandidate.id === 'op:text')!;
  delete (operationNode as unknown as { cellId?: string }).cellId;
  (operationNode as unknown as { reason: string; status: 'unresolved' }).reason = 'specialization receiver/index is not an applied source cell identity';
  (operationNode as unknown as { status: 'unresolved' }).status = 'unresolved';
  (operationNode as unknown as { tableId: string }).tableId = 'table:other';
  (crossTable.gaps as unknown as Array<Record<string, unknown>>).push({
    category: 'cell', status: 'unknown', reason: operationNode.reason, source: operationNode.source, operationId: operationNode.id,
  });
  if (!refusalHasNoScene(sceneFor(makeFixture(), crossTable))) failures.push('cross-table table+row without cell');
  assert(failures.length === 0, `status-specific owner escape: ${failures.join(', ')}`);
});

test('seventh review fail-first: operation-linked gaps are an exact multiset', () => {
  const sourceText = [
    'local menu = { name = "GapMatrix", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(2, { width = 100, reserveScrollBar = false, scaling = false })',
    'table:setColWidth(dynamic_index, 40, false)',
    'table:setColWidth(1, 40, false)',
    'local row = table:addRow(false, { paddingTop = 1, paddingBottom = 1, borderBelow = false, fixed = false })',
    'row[1]:createButton({ height = 10 })',
    'frame:display()',
  ].join('\n');
  const projected = rawProjectionFor(sourceText, 'selftest/raw-seventh-gap-matrix.lua');
  assert(projected.program !== undefined && projected.profile !== undefined, 'gap matrix producer must return a program');
  const operationNode = projected.program.operations.find(operationCandidate => operationCandidate.kind === 'setColWidth')!;
  const originalGap = projected.program.gaps.find(gap => gap.operationId === operationNode.id);
  assert(originalGap !== undefined, 'gap matrix producer must carry a linked gap');
  assert(!refusalHasNoScene(buildX4UiScene(projected.result as X4UiLayoutProgramResult, corpus, projected.profile)), 'untouched gap branch must be accepted before mutations');
  const mutations: readonly [string, (program: X4UiLayoutProgram, gap: Record<string, unknown>) => void][] = [
    ['status', (_program, gap) => { gap.status = 'refused'; }],
    ['source', (_program, gap) => { gap.source = source(1999); }],
    ['expression', (_program, gap) => { gap.expression = 'forged-expression'; }],
    ['category', (_program, gap) => { gap.category = 'percentage'; }],
    ['duplicate', (program, gap) => { (program.gaps as unknown as Array<Record<string, unknown>>).push({ ...gap }); }],
  ];
  const failures: string[] = [];
  for (const [label, mutate] of mutations) {
    const invalid = cloneProgram(projected.program);
    const gap = invalid.gaps.find(candidate => candidate.operationId === operationNode.id) as unknown as Record<string, unknown>;
    mutate(invalid, gap);
    if (!refusalHasNoScene(pairInvalidProgram(invalid, projected.result as X4UiLayoutProgramResult, projected.profile, corpus, label))) failures.push(label);
  }
  assert(failures.length === 0, `gap multiset mutation escaped: ${failures.join(', ')}`);
});

test('seventh review fail-first: local expansion authority is complete and reciprocal', () => {
  const localSource = [
    'local Helper = rawget(_G, "Helper")',
    'local function nested(cell, label, height)',
    '  cell:createText(label, { height = height })',
    'end',
    'local function panel(frame, width, label)',
    '  local table = frame:addTable(1, { width = width, reserveScrollBar = false, scaling = false })',
    '  table:setColWidthPercent(1, 100)',
    '  local row = table:addRow(false, {})',
    '  nested(row[1], label, 12)',
    'end',
    'local function display()',
    '  local menu = { name = "ExpansionScene", layer = 1 }',
    '  local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    '  panel(frame, 60, "one")',
    '  frame:display()',
    'end',
    'display()',
  ].join('\n');
  const model = buildX4UiCallModel({ rel: 'selftest/raw-seventh-expansion.lua', text: localSource, sourcePath: 'selftest/raw-seventh-expansion.lua' });
  const catalog = createX4UiLayoutTargetCatalog(model);
  const target = catalog.targets.find(candidate => candidate.kind === 'top-level');
  assert(target !== undefined && rawProducerProjection.program !== undefined, 'local expansion target must exist');
  const layoutProfile = {
    ...rawProducerProjection.program!.profile,
    source: catalog.sourceIdentity,
    localExpansion: { maxDepth: 4, maxInvocations: 8 },
  } as Parameters<typeof projectX4UiLayoutProgram>[2];
  const projected = projectX4UiLayoutProgram(model, target!, layoutProfile);
  assert('program' in projected && projected.program !== undefined, 'local expansion producer must return a program');
  const program = projected.program;
  const profile: X4UiSceneProfile = Object.freeze({
    id: 'raw-seventh-expansion-profile',
    provenance: 'Batch 6A-S seventh review selftest',
    source: program.profile.source,
    helper: { sourcePath: HELPER_PATH, sha256: X4_LAYOUT_PROVENANCE.helperSha256 },
    widget: { sourcePath: WIDGET_PATH, sha256: X4_LAYOUT_PROVENANCE.widgetSha256 },
    fonts: sceneProfile.fonts,
    drawable: { width: program.profile.frame.width, height: program.profile.frame.height },
    textPolicy: sceneProfile.textPolicy,
  });
  const localResult = buildX4UiScene(projected as X4UiLayoutProgramResult, corpus, profile);
  assert(!refusalHasNoScene(localResult), `untouched local expansion must be accepted ${JSON.stringify({ status: program.status, operations: program.operations.map(operationNode => ({ id: operationNode.id, kind: operationNode.kind, status: operationNode.status, localExpansion: operationNode.localExpansion })), programExpansion: program.localExpansion, profileExpansion: program.profile.localExpansion, operationExpansions: program.operations.filter(operationNode => operationNode.localExpansion !== undefined).map(operationNode => ({ id: operationNode.id, localExpansion: operationNode.localExpansion })), result: localResult })}`);
  const mutations: readonly [string, (program: X4UiLayoutProgram) => void][] = [
    ['unknown program key', value => { (value.localExpansion as unknown as Record<string, unknown>).forged = true; }],
    ['minimal program expansion', value => { (value as unknown as { localExpansion: unknown }).localExpansion = { previewPathSelections: [] }; }],
    ['operation expansion without program authority', value => {
      const operationNode = value.operations.find(operationCandidate => operationCandidate.localExpansion !== undefined);
      if (operationNode) (value as unknown as { localExpansion?: unknown }).localExpansion = undefined;
    }],
    ['unknown invocation operation link', value => {
      const invocation = value.localExpansion?.invocations[0];
      if (invocation) (invocation.operationIds as unknown as string[]).push('op:missing');
    }],
  ];
  const failures: string[] = [];
  for (const [label, mutate] of mutations) {
    const invalid = cloneProgram(program);
    mutate(invalid);
      if (!refusalHasNoScene(pairInvalidProgram(invalid, projected as X4UiLayoutProgramResult, profile, corpus, label))) failures.push(label);
  }
  assert(failures.length === 0, `local expansion mutation escaped: ${failures.join(', ')}`);
});

const acceptedRawSceneResult = (): X4UiLayoutProgramResult => {
  const result = rawProducerProjection.result;
  assert(result !== undefined && 'program' in result && result.program !== undefined && 'evidenceAuthority' in result && result.evidenceAuthority !== undefined, 'real producer fixture must expose a successful evidence-authority wrapper');
  return result;
};

test('9th audit: one-sided producer-fact and reduced setColSpan mutations stop at the pair boundary', () => {
  const sourceText = [
    'local menu = { name = "NinthAuditFacts", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(4, { width = 100, reserveScrollBar = false, scaling = false })',
    'table:setColWidth(1, 25, false)',
    'table:setColWidth(2, 25, false)',
    'table:setColWidth(3, 25, false)',
    'table:setColWidth(4, 25, false)',
    'local row = table:addRow(false, { paddingTop = 1, paddingBottom = 1, borderBelow = false, fixed = false })',
    'row[1]:createText("text", { height = 10, minRowHeight = 10, font = "Zekton", fontsize = 16 })',
    'row[2]:createEditBox({ height = 10, defaultText = "edit", description = "description", active = false })',
    'row[3]:createButton({ height = 10, affectRowHeight = false })',
    'row[4]:createIcon("solid", { height = 10, affectRowHeight = false })',
    'frame:display()',
  ].join('\n');
  const projected = rawProjectionFor(sourceText, 'selftest/raw-9th-facts.lua');
  assert(projected.result !== undefined && 'program' in projected.result && projected.program !== undefined && projected.profile !== undefined && 'evidenceAuthority' in projected.result && projected.result.evidenceAuthority !== undefined, 'ninth audit source must produce a successful producer wrapper');
  const base = projected.result as X4UiLayoutProgramResult;
  const spanProjected = rawProjectionFor(sourceText.replace('row[1]:createText', 'row[1]:setColSpan(1):createText'), 'selftest/raw-9th-no-op-span.lua');
  assert(spanProjected.result !== undefined && 'program' in spanProjected.result && spanProjected.program !== undefined && 'evidenceAuthority' in spanProjected.result && spanProjected.result.evidenceAuthority !== undefined && spanProjected.profile !== undefined, 'ninth audit no-op span source must produce a successful producer wrapper');
  const failures: string[] = [];
  const pairInvalidMutation = (
    label: string,
    mutate: (program: X4UiLayoutProgram) => void,
    sourceResult: X4UiLayoutProgramResult = base,
    sourceProfile: X4UiSceneProfile = projected.profile!,
  ): void => {
    const program = cloneProgram(sourceResult.program!);
    mutate(program);
    freezeFixtureGraph(program);
    const pair = validateX4UiLayoutEvidencePair(program, producerAuthority(sourceResult));
    if (pair.valid) {
      failures.push(`${label}: pair unexpectedly valid`);
      return;
    }
    const wrapper = freezeFixtureGraph({ ...sourceResult, program }) as X4UiLayoutProgramResult;
    const result = buildX4UiScene(wrapper, corpus, sourceProfile);
    if (!refusalHasNoScene(result)) failures.push(`${label}: scene accepted pair-invalid input`);
  };
  const numericFact = (fact: X4UiLayoutDescriptorFact | undefined, label: string): void => {
    if (!fact || fact.status !== 'known' || fact.expectedType !== 'number' || typeof fact.value !== 'number') throw new Error(`${label} producer fact is not known numeric evidence`);
  };
  pairInvalidMutation('frame x', program => {
    const frame = program.frames[0];
    numericFact(frame.descriptorFacts.x, 'frame x');
    (frame.descriptorFacts.x as { value: number }).value += 1;
  });
  pairInvalidMutation('table x', program => {
    const table = program.tables[0];
    numericFact(table.descriptorFacts.x, 'table x');
    (table.descriptorFacts.x as { value: number }).value += 1;
  });
  const textOperation = base.program!.operations.find(operationNode => operationNode.kind === 'createText');
  const textCell = textOperation?.cellId === undefined ? undefined : base.program!.cells.find(cell => cell.id === textOperation.cellId);
  assert(textOperation !== undefined && textCell !== undefined, 'ninth audit source must expose a text creator cell');
  pairInvalidMutation('creator font', program => {
    const cell = program.cells.find(candidate => candidate.id === textCell.id)!;
    const font = cell.descriptorFacts.font;
    if (!font || font.status !== 'known' || font.expectedType !== 'string') throw new Error('creator font producer fact is not known string evidence');
    (cell.descriptorFacts.font as { value: string }).value = 'Zekton Bold';
  });
  pairInvalidMutation('cell outerWidth', program => {
    const cell = program.cells.find(candidate => candidate.id === textCell.id)!;
    numericFact(cell.descriptorFacts.outerWidth, 'cell outerWidth');
    (cell.descriptorFacts.outerWidth as { value: number }).value += 1;
  });
  pairInvalidMutation('cell source', program => {
    const cell = program.cells.find(candidate => candidate.id === textCell.id)!;
    (cell as unknown as { source: X4UiSceneSourceLocation }).source = source(9999);
  });
  pairInvalidMutation('reduced setColSpan evidence', program => {
    const operation = program.operations.find(operationNode => operationNode.kind === 'setColSpan');
    assert(operation !== undefined, 'ninth audit no-op source must expose setColSpan');
    const metadata = operation.metadata as unknown as { arguments?: unknown[]; semantics?: Record<string, unknown> };
    metadata.arguments = [];
    metadata.semantics = {};
    for (const key of Object.keys(operation.descriptorFacts)) {
      if (key !== 'span') delete (operation.descriptorFacts as Record<string, unknown>)[key];
    }
  }, spanProjected.result as X4UiLayoutProgramResult, spanProjected.profile);
  assert(failures.length === 0, `ninth audit pair-boundary escapes: ${failures.join(', ')}`);
});

test('8B fail-first: public scene entry accepts the real result wrapper and rejects a bare program', () => {
  const wrapped = acceptedRawSceneResult();
  const wrappedResult = buildX4UiScene(wrapped, corpus, rawProducerProjection.profile!);
  const bareResult = buildX4UiScene(wrapped.program as never, corpus, rawProducerProjection.profile!);
  assert(!refusalHasNoScene(wrappedResult), `accepted producer wrapper was refused: ${JSON.stringify(wrappedResult)}`);
  assert(refusalHasNoScene(bareResult), 'bare program must refuse before scene geometry');
});

test('9th audit: explicit creator widths use the scaled source width branch', () => {
  const projected = rawProjectionFor([
    'local menu = { name = "ExplicitCreatorWidths", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(4, { width = 80, reserveScrollBar = false, scaling = false })',
    'table:setColWidth(1, 20, false)',
    'table:setColWidth(2, 20, false)',
    'table:setColWidth(3, 20, false)',
    'table:setColWidth(4, 20, false)',
    'local row = table:addRow(false, { paddingTop = 1, paddingBottom = 1, borderBelow = false, fixed = false })',
    'row[1]:createText("text", { width = 7, height = 10 })',
    'row[2]:createEditBox({ width = 8, height = 10 })',
    'row[3]:createButton({ width = 9, height = 10 })',
    'row[4]:createIcon("solid", { width = 10, height = 10 })',
    'frame:display()',
  ].join('\n'), 'selftest/raw-9th-explicit-width.lua');
  assert(projected.result !== undefined && 'program' in projected.result && projected.program !== undefined && projected.profile !== undefined, 'explicit-width source must produce a real result');
  const scene = sceneOf(buildX4UiScene(projected.result as X4UiLayoutProgramResult, corpus, projected.profile));
  const expected: Readonly<Record<string, number>> = { createText: 7, createEditBox: 8, createButton: 9, createIcon: 10 };
  for (const [kind, width] of Object.entries(expected)) {
    const operation = projected.program.operations.find(operationNode => operationNode.kind === kind);
    assert(operation?.cellId !== undefined, `${kind} must retain its producer cell`);
    const cell = projected.program.cells.find(cellNode => cellNode.id === operation.cellId);
    const widthFact = cell?.descriptorFacts.outerWidth;
    assert(widthFact?.status === 'known' && widthFact.expectedType === 'number' && widthFact.value === width, `${kind} must retain its explicit outerWidth fact`);
    assert(widthFact.provenance === 'source-literal' || widthFact.provenance === 'direct-helper-scale', `${kind} explicit width must not use the zero-width Helper span pin`);
    if ((kind === 'createText' || kind === 'createEditBox') && operation.descriptorFacts.affectRowHeight?.status === 'unavailable') {
      const affect = cell?.descriptorFacts.affectRowHeight;
      assert(affect?.status === 'known' && affect.provenance === 'source-pinned-default' && affect.sourcePin?.sourcePath === HELPER_PATH && affect.sourcePin.lineStart === 5432 && affect.sourcePin.lineEnd === 5469, `${kind} finalized affectRowHeight must use the Helper specialization default pin`);
    }
    const widget = scene.widgets.find(widgetNode => widgetNode.cellId === `scene:${operation.cellId}`);
    assert(widget?.outerRect.width === width, `${kind} scene widget must use the explicit source width`);
  }
});

test('8B.1 accepts finalized creator heights after the producer scaling path', () => {
  const projected = rawProjectionFor([
    'local menu = { name = "ScaledCreators", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 200, height = 100 })',
    'local table = frame:addTable(4, { width = 200, reserveScrollBar = false, scaling = true })',
    'table:setColWidth(1, 25, false)',
    'table:setColWidth(2, 25, false)',
    'table:setColWidth(3, 25, false)',
    'table:setColWidth(4, 25, false)',
    'local row = table:addRow(false, { paddingTop = 1, paddingBottom = 1, borderBelow = false, fixed = false, scaling = true })',
    'row[1]:createText("text", { width = 10, height = 10, minRowHeight = 10, scaling = true })',
    'row[2]:createEditBox({ width = 10, height = 10, scaling = true })',
    'row[3]:createButton({ width = 10, height = 10, scaling = true, affectRowHeight = false })',
    'row[4]:createIcon("solid", { width = 10, height = 10, scaling = true, affectRowHeight = false })',
    'frame:display()',
  ].join('\n'),
  'selftest/raw-8b1-scaled-creators.lua',
  profile => ({
    ...profile,
    frame: { width: 200, height: 100 },
    helper: {
      ...profile.helper,
      constants: {
        ...profile.helper.constants,
        viewWidth: { ...profile.helper.constants.viewWidth, value: 200 },
        viewHeight: { ...profile.helper.constants.viewHeight, value: 100 },
      },
    },
    metrics: { ...profile.metrics, uiScale: 2 },
  }),
  );
  assert(projected.result !== undefined && 'program' in projected.result && projected.program !== undefined && projected.profile !== undefined, 'scaled creator source must produce a real producer wrapper');
  const producerResult = projected.result as X4UiLayoutProgramResult;
  const authority = producerAuthority(producerResult);
  const pair = validateX4UiLayoutEvidencePair(projected.program, authority);
  assert(pair.valid, 'scaled creator producer program/evidence authority pair must validate before scene mapping');
  const scene = sceneOf(buildX4UiScene(producerResult, corpus, projected.profile));
  for (const kind of ['createText', 'createEditBox', 'createButton', 'createIcon'] as const) {
    const operation = projected.program.operations.find(candidate => candidate.kind === kind);
    assert(operation?.cellId !== undefined, `${kind} must retain its producer cell`);
    const cell = projected.program.cells.find(candidate => candidate.id === operation.cellId);
    const rawHeight = operation?.descriptorFacts.outerHeight;
    const finalHeight = cell?.descriptorFacts.outerHeight;
    assert(rawHeight?.status === 'known' && rawHeight.value === 10, `${kind} must retain its raw source height`);
    assert(finalHeight?.status === 'known' && finalHeight.expectedType === 'number' && finalHeight.value === 20, `${kind} must retain its finalized scaled height`);
    assert(finalHeight.provenance === 'source-literal' && finalHeight.expression === rawHeight.expression && finalHeight.sourcePin === undefined && JSON.stringify(finalHeight.source) === JSON.stringify(rawHeight.source), `${kind} finalized height must retain the exact source-literal provenance and source location`);
    const widget = scene.widgets.find(candidate => candidate.kind === (kind === 'createEditBox' ? 'editbox' : kind.slice(6).toLowerCase()) && candidate.cellId === `scene:${operation.cellId}`);
    assert(widget?.outerRect?.height === 20, `${kind} scene geometry must use the finalized scaled height`);
    const heightLink = widget.provenanceLinks.find(link => link.kind === 'descriptor-fact' && link.fact === 'outerHeight');
    assert(heightLink !== undefined && heightLink.expression === finalHeight.expression && heightLink.sourcePin === undefined && JSON.stringify(heightLink.source) === JSON.stringify(finalHeight.source), `${kind} widget provenance must retain the finalized outerHeight fact link`);
  }
  for (const kind of ['createText', 'createEditBox', 'createButton', 'createIcon'] as const) {
    const sourceOperation = projected.program.operations.find(candidate => candidate.kind === kind);
    assert(sourceOperation?.cellId !== undefined, `${kind} mutation controls require a producer cell`);
    for (const control of ['scale', 'kernel', 'provenance'] as const) {
      const mutated = cloneProgram(projected.program);
      const operation = mutated.operations.find(candidate => candidate.id === sourceOperation.id);
      const cell = mutated.cells.find(candidate => candidate.id === sourceOperation.cellId);
      assert(operation?.cellId !== undefined && cell !== undefined, `${kind} ${control} mutation target must remain addressable`);
      if (control === 'scale') {
        const scaling = cell.descriptorFacts.scaling;
        assert(scaling?.status === 'known' && scaling.value === true, `${kind} scale control must start from known true scaling`);
        const changedScaling = scaling as unknown as { value: boolean };
        changedScaling.value = false;
        assert(changedScaling.value === false, `${kind} scale control must change the consumed scaling fact`);
      } else if (control === 'kernel') {
        const kernelCell = (cell as unknown as { kernelState?: { height?: number } }).kernelState;
        assert(kernelCell !== undefined && typeof kernelCell.height === 'number', `${kind} kernel control must start from a known cell height`);
        const originalHeight = kernelCell.height;
        kernelCell.height = originalHeight + 1;
        assert(kernelCell.height !== originalHeight, `${kind} kernel control must change the consumed kernel fact`);
      } else {
        const height = cell.descriptorFacts.outerHeight;
        assert(height?.status === 'known', `${kind} provenance control must start from a known finalized height`);
        const originalSourcePath = height.source.sourcePath;
        (height as unknown as { source: { sourcePath: string } }).source = { ...height.source, sourcePath: 'fixture://forged-8b1-height' };
        assert(height.source.sourcePath !== originalSourcePath, `${kind} provenance control must change the finalized height source`);
      }
      freezeFixtureGraph(mutated);
      const mutatedPair = validateX4UiLayoutEvidencePair(mutated, authority);
      assert(!mutatedPair.valid, `${kind} ${control} mutation must fail producer pair validation`);
      const mutatedResult = freezeFixtureGraph({ ...producerResult, program: mutated }) as X4UiLayoutProgramResult;
      assert(refusalHasNoScene(buildX4UiScene(mutatedResult, corpus, projected.profile)), `${kind} ${control} mutation must refuse before scene geometry`);
    }
  }
});

test('8B.1 preserves uniform unavailable geometry for Helper-negative omitted widths', () => {
  const projected = rawProjectionFor([
    'local menu = { name = "NegativeCreatorWidths", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 100 })',
    'local textTable = frame:addTable(1, { width = 40, reserveScrollBar = false, scaling = false })',
    'textTable:setColWidth(1, 40, false)',
    'local textRow = textTable:addRow(false, { paddingTop = 1, paddingBottom = 1, borderBelow = false, fixed = false })',
    'textRow[1]:createText("text", { width = 0, height = 10, x = 50 })',
    'local editTable = frame:addTable(1, { width = 40, reserveScrollBar = false, scaling = false })',
    'editTable:setColWidth(1, 40, false)',
    'local editRow = editTable:addRow(false, { paddingTop = 1, paddingBottom = 1, borderBelow = false, fixed = false })',
    'editRow[1]:createEditBox({ width = 0, height = 10, x = 50 })',
    'local buttonTable = frame:addTable(1, { width = 40, reserveScrollBar = false, scaling = false })',
    'buttonTable:setColWidth(1, 40, false)',
    'local buttonRow = buttonTable:addRow(false, { paddingTop = 1, paddingBottom = 1, borderBelow = false, fixed = false })',
    'buttonRow[1]:createButton({ width = 0, height = 10, x = 50, affectRowHeight = false })',
    'local iconTable = frame:addTable(1, { width = 40, reserveScrollBar = false, scaling = false })',
    'iconTable:setColWidth(1, 40, false)',
    'local iconRow = iconTable:addRow(false, { paddingTop = 1, paddingBottom = 1, borderBelow = false, fixed = false })',
    'iconRow[1]:createIcon("solid", { width = 0, height = 10, x = 50, affectRowHeight = false })',
    'frame:display()',
  ].join('\n'), 'selftest/raw-8b1-negative-creator-widths.lua');
  assert(projected.result !== undefined && 'program' in projected.result && projected.program !== undefined && projected.profile !== undefined, 'negative creator width source must produce a real producer wrapper');
  const producerResult = projected.result as X4UiLayoutProgramResult;
  const authority = producerAuthority(producerResult);
  const pair = validateX4UiLayoutEvidencePair(projected.program, authority);
  assert(pair.valid, 'negative-width producer program/evidence authority pair must validate before scene mapping');
  const result = buildX4UiScene(producerResult, corpus, projected.profile);
  assert(result.status !== 'refused', 'negative creator width must remain a partial scene input');
  const scene = sceneOf(result);
  const widgets = scene.widgets.filter(widget => ['text', 'editbox', 'button', 'icon'].includes(widget.kind));
  assert(widgets.length === 4, 'all negative-width creators must retain unavailable widget evidence');
  for (const widget of widgets) {
    const creatorKind = widget.kind === 'editbox' ? 'createEditBox' : `create${widget.kind[0].toUpperCase()}${widget.kind.slice(1)}`;
    const operation = projected.program.operations.find(candidate => candidate.kind === creatorKind && candidate.cellId !== undefined && widget.cellId === `scene:${candidate.cellId}`);
    assert(operation?.cellId !== undefined, `${widget.kind} must retain its exact producer operation`);
    const producerCell = projected.program.cells.find(candidate => candidate.id === operation.cellId);
    const widthFact = producerCell?.descriptorFacts.outerWidth;
    assert(widthFact !== undefined && widthFact.status === 'known' && widthFact.expectedType === 'number' && widthFact.value === -10 && widthFact.provenance === 'source-pinned-default' && widthFact.sourcePin?.sourcePath === HELPER_PATH && widthFact.sourcePin.lineStart === 5372 && widthFact.sourcePin.lineEnd === 5388, `${widget.kind} must retain the exact Helper-derived -10 outerWidth fact and pin`);
    assert(producerCell !== undefined && JSON.stringify(widthFact.source) === JSON.stringify(producerCell.source), `${widget.kind} negative width fact must retain its producer cell source`);
    const parentCell = scene.cells.find(cell => cell.id === widget.cellId);
    assert(parentCell !== undefined && parentCell.rect !== undefined && widget.parentId === parentCell.id, `${widget.kind} must retain parent cell geometry for unavailable width`);
    const widthLink = widget.provenanceLinks.find(link => link.kind === 'descriptor-fact' && link.fact === 'outerWidth');
    assert(widthLink !== undefined && widthLink.expression === widthFact.expression && JSON.stringify(widthLink.source) === JSON.stringify(widthFact.source) && widthLink.sourcePin?.sourcePath === HELPER_PATH && widthLink.sourcePin.lineStart === 5372 && widthLink.sourcePin.lineEnd === 5388, `${widget.kind} unavailable geometry must retain the exact outerWidth provenance link`);
    assert(widget.rect === undefined && widget.outerRect === undefined && widget.completeness === 'unavailable' && widget.textIds.length === 0, `${widget.kind} must not fabricate drawable geometry for Helper-derived -10 width`);
    const negativeGap = scene.gaps.find(gap => widget.diagnosticLinks.includes(gap.id) && gap.category === 'width' && gap.status === 'unsupported' && gap.reason === 'fontstring width is negative: Helper omitted-width arithmetic produced a negative widget width; drawable widget geometry is unavailable');
    assert(negativeGap !== undefined, `${widget.kind} must link its exact negative-width source gap`);
  }
  assert(scene.cells.length === 4 && scene.cells.every(cell => cell.rect !== undefined), 'negative widget widths must retain sibling cell geometry');
  assert(scene.status === 'partial', 'negative Helper width evidence must make the scene partial, not refused');
});

test('8B fail-first: evidence authority is required and pair validation runs before scene mapping', () => {
  const wrapped = acceptedRawSceneResult();
  const missingAuthority = JSON.parse(JSON.stringify(wrapped)) as Record<string, unknown>;
  delete missingAuthority.evidenceAuthority;
  const changedProgram = JSON.parse(JSON.stringify(wrapped)) as Record<string, unknown>;
  const changed = changedProgram.program as Record<string, unknown>;
  changed.status = changed.status === 'partial' ? 'projected' : 'partial';
  const failures: string[] = [];
  if (!refusalHasNoScene(buildX4UiScene(missingAuthority as never, corpus, rawProducerProjection.profile!))) failures.push('missing authority');
  if (!refusalHasNoScene(buildX4UiScene(changedProgram as never, corpus, rawProducerProjection.profile!))) failures.push('program/authority mismatch');
  assert(!refusalHasNoScene(buildX4UiScene(wrapped, corpus, rawProducerProjection.profile!)), 'control wrapper must be accepted');
  assert(failures.length === 0, `authority boundary escaped: ${failures.join(', ')}`);
});

test('B119 control: simple issued acceptance shapes remain accepted', () => {
  const positiveSource = [
    'local menu = { name = "B119", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local frameAlias = frame',
    'local table = frameAlias:addTable(4, { width = 100, reserveScrollBar = false, scaling = false })',
    'local tableAlias = table',
    'tableAlias:setColWidth(1, 20, false)',
    'tableAlias:setColWidthPercent(2, 25)',
    'local row = tableAlias:addRow(false, { paddingTop = 1, paddingBottom = 2, borderBelow = false, fixed = true, scaling = false })',
    'local rowAlias = row',
    'local cell = rowAlias[1]',
    'local cellAlias = cell',
    'cellAlias:setColSpan(2):createButton({ active = true }):setText("go", { color = "white" }):setText2("label2", { color = "yellow" })',
    'rowAlias[3]:createText("label", { height = 4 })',
    'rowAlias[4]:createEditBox({ height = 6 })',
    'local row2 = tableAlias:addRow(false, {})',
    'row2[1]:createIcon("solid", { height = 8, affectRowHeight = false })',
    'tableAlias:setColWidth(3, 30, false)',
    'local independent = frame:addTable(2, { width = 60 })',
    'independent:addRow(false, {})',
    'frame:display()',
  ].join('\n');
  const nestedSource = [
    'local function asciiClean(s)',
    '  return s:gsub("x" .. string.char(1, 2), "y"):gsub("z" .. string.char(3, 4), "w")',
    'end',
    'local menu = { name = "B119", layer = 4 }',
    'function menu.display()',
    '  local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    '  local table = frame:addTable(1, { width = 80 })',
    '  local row = table:addRow(false, {})',
    '  row[1]:createText(asciiClean("x"), {})',
    '  frame:display()',
    'end',
  ].join('\n');
  const propagatedLayerSource = [
    'local menu = { name = "B119", layer = 4 }',
    'function menu.display()',
    '  local frame = Helper.createFrameHandle(menu, { width = 100, height = 80, layer = menu.layer })',
    '  frame:display()',
    'end',
  ].join('\n');
  const makeIssued = (sourceText: string, sourcePath: string, targetName?: string) => {
    const model = buildX4UiCallModel({ rel: sourcePath, text: sourceText, sourcePath });
    const catalog = createX4UiLayoutTargetCatalog(model);
    const target = targetName === undefined
      ? catalog.targets.find(candidate => candidate.kind === 'top-level')
      : catalog.targets.find(candidate => candidate.name === targetName);
    const baseProfile = rawProducerProjection.program?.profile;
    assert(target !== undefined && baseProfile !== undefined, `${sourcePath} must expose its target and base profile`);
    const result = projectX4UiLayoutProgram(model, target, { ...baseProfile, source: target.sourceIdentity });
    assert('program' in result && result.program !== undefined && 'evidenceAuthority' in result, `${sourcePath} must issue a producer evidence pair: ${JSON.stringify(result)}`);
    const profile: X4UiSceneProfile = Object.freeze({
      id: `b119-${sourcePath}`,
      provenance: 'B119 Scene structural compatibility selftest',
      source: result.program.profile.source,
      helper: { sourcePath: HELPER_PATH, sha256: X4_LAYOUT_PROVENANCE.helperSha256 },
      widget: { sourcePath: WIDGET_PATH, sha256: X4_LAYOUT_PROVENANCE.widgetSha256 },
      fonts: sceneProfile.fonts,
      drawable: { width: result.program.profile.frame.width, height: result.program.profile.frame.height },
      textPolicy: sceneProfile.textPolicy,
    });
    return { result: result as X4UiLayoutProgramResult, program: result.program, profile };
  };
  const cases = [
    makeIssued(positiveSource, 'selftest/b119-positive-menu.lua'),
    makeIssued(nestedSource, 'selftest/b119-nested-local-invocation.lua', 'menu.display'),
    makeIssued(propagatedLayerSource, 'selftest/b119-propagated-layer.lua', 'menu.display'),
  ] as const;
  const refusals = cases.map(candidate => {
    const sceneResult = buildX4UiScene(candidate.result, corpus, candidate.profile);
    return sceneResult.status === 'refused'
      ? { path: candidate.profile.source.file, code: sceneResult.refusal.code, message: sceneResult.refusal.message }
      : undefined;
  }).filter((value): value is NonNullable<typeof value> => value !== undefined);
  assert(refusals.length === 0, `issued B119 pairs refused at Scene boundary: ${JSON.stringify(refusals)}`);
});

test('B119 fail-first: conditional source-owner cells remain non-drawable Scene evidence', () => {
  const projected = rawProjectionFor([
    'local menu = { name = "B119ConditionalOwner", layer = 4 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(2, { width = 80 })',
    'local base = table:addRow(false, {})',
    'base[1]:createText("base", {})',
    'if getChoice() then',
    '  local conditional = table:addRow(false, {})',
    '  conditional[1]:createText(getText(), {})',
    'end',
    'frame:display()',
  ].join('\n'), 'selftest/b119-conditional-scene-owner.lua');
  assert(projected.program !== undefined && projected.profile !== undefined && 'program' in projected.result && projected.result.program !== undefined && 'evidenceAuthority' in projected.result && projected.result.evidenceAuthority !== undefined, 'conditional source-owner fixture must issue a producer evidence pair');
  assert(validateX4UiLayoutEvidencePair(projected.program, projected.result.evidenceAuthority).valid, 'conditional source-owner fixture must validate before Scene mapping');
  const table = projected.program.tables[0];
  const row = projected.program.rows.find(candidate => candidate.status === 'refused');
  assert(table?.kernelState !== undefined && row !== undefined && row.tableId === table.id && row.rowIndex === undefined && row.kernelState === undefined && row.cellIds.length === 2, `conditional source-owner fixture must retain exact refused owner shape: ${JSON.stringify({ table, row })}`);
  const cells = projected.program.cells.filter(cell => cell.rowId === row.id);
  const sourceOwnerOperationIds = new Set(projected.program.operations.filter(operation => operation.rowId === row.id).map(operation => operation.id));
  assert(cells.length === 2 && cells.every((cell, index) => cell.status === 'refused' && cell.tableId === table.id && cell.column === index + 1 && cell.rowIndex === undefined && cell.kernelState === undefined && [...cell.operationIds, ...cell.metadataOperationIds].every(operationId => sourceOwnerOperationIds.has(operationId))), `conditional source-owner fixture must retain exact non-kernel source-owner cells: ${JSON.stringify({ cells, sourceOwnerOperationIds: [...sourceOwnerOperationIds] })}`);
  const ownerOperation = projected.program.operations.find(operation => operation.kind === 'addRow' && operation.rowId === row.id);
  assert(ownerOperation?.status === 'conditional' && ownerOperation.tableId === table.id && ownerOperation.cellId === undefined, `conditional source-owner fixture must have one conditional addRow owner: ${JSON.stringify(ownerOperation)}`);
  const sceneResult = buildX4UiScene(projected.result as X4UiLayoutProgramResult, corpus, projected.profile);
  assert(sceneResult.status !== 'refused', `conditional source-owner Scene evidence was refused: ${JSON.stringify({ result: sceneResult, table, row, cells, ownerOperation, operations: projected.program.operations.filter(operation => operation.rowId === row.id), gaps: projected.program.gaps.filter(gap => gap.nodeId === row.id || gap.operationId === ownerOperation?.id) })}`);
  const scene = sceneResult.scene;
  assert(scene.rows.every(candidate => candidate.id !== `scene:${row.id}`)
    && scene.cells.every(candidate => candidate.id !== `scene:${cells[0]?.id}` && candidate.id !== `scene:${cells[1]?.id}`)
    && scene.widgets.every(candidate => candidate.cellId !== `scene:${cells[0]?.id}` && candidate.cellId !== `scene:${cells[1]?.id}`), 'conditional source-owner nodes must not become drawable Scene rows, cells, or widgets');
  type HostileMutation = (program: X4UiLayoutProgram, hostileTable: X4UiLayoutTableNode, hostileRow: X4UiLayoutRowNode, hostileCells: X4UiLayoutCellNode[]) => void;
  const runHostile = (label: string, mutate: HostileMutation): void => {
    const hostileProgram = cloneProgram(projected.program!);
    const hostileTable = hostileProgram.tables.find(candidate => candidate.id === table.id)!;
    const hostileRow = hostileProgram.rows.find(candidate => candidate.id === row.id)!;
    const hostileCells = hostileProgram.cells.filter(candidate => candidate.rowId === hostileRow.id);
    let hostileResult: X4UiSceneResult | undefined;
    let thrown: unknown;
    try {
      mutate(hostileProgram, hostileTable, hostileRow, hostileCells);
      hostileResult = buildX4UiScene({ ...projected.result, program: hostileProgram } as X4UiLayoutProgramResult, corpus, projected.profile);
    } catch (error) {
      thrown = error;
    }
    assert(thrown === undefined, `${label} hostile source-owner mutation threw: ${thrown instanceof Error ? thrown.message : String(thrown)}`);
    assert(hostileResult?.status === 'refused', `${label} hostile source-owner mutation escaped refusal: ${JSON.stringify(hostileResult)}`);
  };
  runHostile('status', (_program, _table, hostileRow) => { (hostileRow as unknown as { status: string }).status = 'projected'; });
  runHostile('row membership', (_program, _table, hostileRow) => { delete (hostileRow as unknown as { tableId?: string }).tableId; });
  runHostile('table operation membership', (_program, hostileTable, hostileRow) => {
    (hostileTable.operationIds as string[]).splice(0, hostileTable.operationIds.length, ...hostileTable.operationIds.filter(operationId => operationId !== hostileRow.operationIds[0]));
  });
  runHostile('rowIndex', (_program, _table, hostileRow) => { (hostileRow as unknown as { rowIndex: number }).rowIndex = 1; });
  runHostile('row kernelState', (_program, hostileTable, hostileRow) => { (hostileRow as unknown as { kernelState: unknown }).kernelState = cloneJsonValue(hostileTable.kernelState!.rows[0]); });
  runHostile('cell count', (_program, _table, hostileRow) => { (hostileRow.cellIds as string[]).pop(); });
  runHostile('cell column', (_program, _table, _hostileRow, hostileCells) => { (hostileCells[0] as unknown as { column: number }).column = 2; });
  runHostile('cell table owner', (_program, _table, _hostileRow, hostileCells) => { delete (hostileCells[0] as unknown as { tableId?: string }).tableId; });
  runHostile('cell row owner', (_program, _table, hostileRow, hostileCells) => { (hostileCells[0] as unknown as { rowId: string }).rowId = hostileRow.id + ':forged'; });
  runHostile('source identity', (_program, _table, _hostileRow, hostileCells) => {
    const cell = hostileCells[0] as unknown as { source: X4UiSceneSourceLocation };
    cell.source = { ...cell.source, start: { ...cell.source.start, offset: cell.source.start.offset + 1 } };
  });
  runHostile('operation linkage', (_program, _table, hostileRow) => { (hostileRow.operationIds as string[]).splice(1, 1); });
  runHostile('drawable leakage', (_program, hostileTable) => { (hostileTable.rowIds as string[]).push(row.id); });
});

test('B119 fail-first: reserve provenance and owning-operation binding are causal', () => {
  const projected = rawProjectionFor([
    'local menu = { name = "B119ReserveProvenance", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(2, { width = 80, reserveScrollBar = true, maxVisibleHeight = 20 })',
    'table:setColWidth(1, 40, false)',
    'table:setColWidth(2, 40, false)',
    'local row = table:addRow(false, {})',
    'row[1]:createText("reserve", {})',
    'frame:display()',
  ].join('\n'), 'selftest/b119-reserve-provenance.lua');
  assert(projected.program !== undefined && projected.profile !== undefined && 'program' in projected.result && projected.result.program !== undefined && 'evidenceAuthority' in projected.result && projected.result.evidenceAuthority !== undefined, 'reserve provenance fixture must issue a producer evidence pair');
  const table = projected.program.tables[0];
  const tableOperation = table === undefined ? undefined : projected.program.operations.find(operation => operation.id === table.operationIds.find(operationId => projected.program.operations.find(candidate => candidate.id === operationId)?.kind === 'addTable'));
  const reserveFact = table?.descriptorFacts.reserveScrollBar;
  assert(table !== undefined && tableOperation !== undefined && reserveFact?.status === 'known', 'reserve provenance fixture must expose the owning addTable fact');
  const mutationCases: readonly { readonly label: string; readonly mutate: (fact: Record<string, unknown>) => void }[] = [
    { label: 'provenance', mutate: fact => { fact.provenance = 'preview-sample'; } },
    { label: 'expression', mutate: fact => { fact.expression = `${String(fact.expression)}:forged`; } },
    { label: 'source', mutate: fact => {
      const current = fact.source as Record<string, unknown>;
      const start = current.start as Record<string, unknown>;
      fact.source = { ...current, start: { ...start, offset: Number(start.offset) + 1 } };
    } },
    { label: 'sourcePin', mutate: fact => {
      const current = fact.sourcePin as Record<string, unknown> | undefined;
      fact.sourcePin = current === undefined
        ? { sourcePath: HELPER_PATH, lineStart: 3171, lineEnd: 3171 }
        : { ...current, lineStart: Number(current.lineStart) + 1 };
    } },
  ];
  for (const mutationCase of mutationCases) {
    const hostileProgram = cloneProgram(projected.program);
    const hostileTable = hostileProgram.tables.find(candidate => candidate.id === table.id)!;
    const hostileOperation = hostileProgram.operations.find(candidate => candidate.id === tableOperation.id)!;
    const hostileFact = (hostileOperation.descriptorFacts.reserveScrollBar as unknown as Record<string, unknown>);
    mutationCase.mutate(hostileFact);
    const authority = synchronizedAuthority(projected.result.evidenceAuthority, hostileProgram);
    freezeFixtureGraph(hostileProgram);
    freezeFixtureGraph(authority);
    const pair = validateX4UiLayoutEvidencePair(hostileProgram, authority);
    assert(pair.valid, `${mutationCase.label} forged reserve fact must remain pair-valid after the authority snapshot is updated: ${JSON.stringify(pair)}`);
    const result = buildX4UiScene({ ...projected.result, program: hostileProgram, evidenceAuthority: authority } as X4UiLayoutProgramResult, corpus, projected.profile);
    assert(result.status === 'refused', `${mutationCase.label} forged reserve fact escaped Scene refusal: ${JSON.stringify({ status: result.status, nodeFact: hostileTable.descriptorFacts.reserveScrollBar, producerFact: hostileOperation.descriptorFacts.reserveScrollBar, owningSource: hostileOperation.source, metadata: hostileOperation.metadata })}`);
  }
});

test('B119 fail-first: empty conditional ledgers and legacy empty-cell shape are exact branches', () => {
  const allEmptyProjected = rawProjectionFor([
    'local menu = { name = "B119AllCellLedgersEmpty", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(1, { width = 80 })',
    'local base = table:addRow(false, {})',
    'base[1]:createText("base", {})',
    'if getChoice() then',
    '  local conditional = table:addRow(false, {})',
    '  conditional[getColumn()]:setColSpan(getSpan())',
    'end',
    'frame:display()',
  ].join('\n'), 'selftest/b119-all-cell-ledgers-empty.lua');
  const legacyProjected = rawProjectionFor([
    'local menu = { name = "B119LegacyEmptyCellShape", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(1, { width = 80 })',
    'local base = table:addRow(false, {})',
    'base[1]:createText("base", {})',
    'if getChoice() then',
    '  local conditional = table:addRow(false, {})',
    'end',
    'frame:display()',
  ].join('\n'), 'selftest/b119-legacy-empty-cell.lua');
  const assertSourceOwner = (
    label: string,
    projected: ReturnType<typeof rawProjectionFor>,
  ): { readonly program: X4UiLayoutProgram; readonly result: X4UiLayoutProgramResult; readonly row: X4UiLayoutRowNode; readonly table: X4UiLayoutTableNode; readonly cells: readonly X4UiLayoutCellNode[] } => {
    assert(projected.program !== undefined && projected.profile !== undefined && 'program' in projected.result && projected.result.program !== undefined && 'evidenceAuthority' in projected.result && projected.result.evidenceAuthority !== undefined, `${label} fixture must issue a producer evidence pair`);
    assert(validateX4UiLayoutEvidencePair(projected.program, projected.result.evidenceAuthority).valid, `${label} fixture must validate before Scene mapping`);
    const row = projected.program.rows.find(candidate => candidate.status === 'refused');
    assert(row !== undefined, `${label} fixture must retain a refused conditional row`);
    const table = projected.program.tables.find(candidate => candidate.id === row.tableId);
    assert(table !== undefined, `${label} fixture must retain the owning table`);
    const cells = row.cellIds.map(cellId => projected.program.cells.find(candidate => candidate.id === cellId)).filter((cell): cell is X4UiLayoutCellNode => cell !== undefined);
    assert(cells.length === row.cellIds.length, `${label} fixture must retain every source-owner cell`);
    const result = buildX4UiScene(projected.result as X4UiLayoutProgramResult, corpus, projected.profile);
    assert(result.status !== 'refused', `${label} positive source-owner shape was refused: ${JSON.stringify(result)}`);
    assert(result.scene.rows.every(candidate => candidate.id !== `scene:${row.id}`)
      && result.scene.cells.every(candidate => !cells.some(cell => candidate.id === `scene:${cell.id}`))
      && result.scene.widgets.every(candidate => !cells.some(cell => candidate.cellId === `scene:${cell.id}`)), `${label} source-only nodes must not become drawable geometry`);
    return { program: projected.program, result: projected.result as X4UiLayoutProgramResult, row, table, cells };
  };
  const allEmpty = assertSourceOwner('allCellLedgersEmpty', allEmptyProjected);
  const legacy = assertSourceOwner('legacyEmptyCellShape', legacyProjected);
  const allEmptyOperations = allEmpty.program.operations.filter(operation => operation.rowId === allEmpty.row.id && operation.kind !== 'addRow');
  assert(allEmptyOperations.length > 0, 'allCellLedgersEmpty fixture must retain conditional downstream operations');
  assert(allEmpty.cells.every(cell => cell.operationIds.length === 0 && cell.metadataOperationIds.length === 0), `allCellLedgersEmpty positive must have empty cell ledgers: ${JSON.stringify({ cells: allEmpty.cells, operations: allEmptyOperations })}`);
  assert(allEmptyOperations.every(operation => operation.status === 'conditional' && operation.cellId === undefined), 'allCellLedgersEmpty positive must have unbound conditional downstream operations');
  assert(legacy.cells.length === 1 && legacy.table.kernelState?.columns.length === 1 && legacy.cells[0]?.descriptorFacts.contentKind?.status === 'known' && legacy.cells[0].descriptorFacts.contentKind.value === 'cell', 'legacyEmptyCellShape positive must be one exact empty cell');
  assert(legacy.program.operations.filter(operation => operation.rowId === legacy.row.id && operation.kind !== 'addRow').length === 0, 'legacyEmptyCellShape positive must have no downstream operations');

  type BranchMutation = (program: X4UiLayoutProgram, table: X4UiLayoutTableNode, row: X4UiLayoutRowNode, cells: X4UiLayoutCellNode[]) => void;
  const runBranchHostile = (
    label: string,
    base: { readonly program: X4UiLayoutProgram; readonly result: X4UiLayoutProgramResult; readonly row: X4UiLayoutRowNode; readonly table: X4UiLayoutTableNode; readonly cells: readonly X4UiLayoutCellNode[] },
    mutate: BranchMutation,
  ): void => {
    const hostileProgram = cloneProgram(base.program);
    const hostileTable = hostileProgram.tables.find(candidate => candidate.id === base.table.id)!;
    const hostileRow = hostileProgram.rows.find(candidate => candidate.id === base.row.id)!;
    const hostileCells = hostileProgram.cells.filter(candidate => candidate.rowId === hostileRow.id);
    let hostileResult: X4UiSceneResult | undefined;
    let thrown: unknown;
    try {
      mutate(hostileProgram, hostileTable, hostileRow, hostileCells);
      hostileResult = buildX4UiScene({ ...base.result, program: hostileProgram } as X4UiLayoutProgramResult, corpus, sceneProfile);
    } catch (error) {
      thrown = error;
    }
    assert(thrown === undefined, `${label} branch hostile mutation threw: ${thrown instanceof Error ? thrown.message : String(thrown)}`);
    assert(hostileResult?.status === 'refused', `${label} branch hostile mutation escaped refusal: ${JSON.stringify(hostileResult)}`);
  };
  runBranchHostile('allCellLedgersEmpty nonempty ledger', allEmpty, (_program, _table, _row, cells) => { (cells[0]!.operationIds as string[]).push('forged-operation'); });
  runBranchHostile('allCellLedgersEmpty mismatched ledger', allEmpty, (_program, _table, _row, cells) => { (cells[0]!.metadataOperationIds as string[]).push('forged-metadata-operation'); });
  runBranchHostile('allCellLedgersEmpty drawable state', allEmpty, (_program, table, row) => { (table.rowIds as string[]).push(row.id); });
  runBranchHostile('allCellLedgersEmpty missing downstream ownership', allEmpty, (_program, _table, row) => { (row.operationIds as string[]).splice(1, 1); });
  runBranchHostile('allCellLedgersEmpty extra downstream ownership', allEmpty, (program, _table, row) => { (row.operationIds as string[]).push(program.operations.find(operation => operation.rowId !== row.id && operation.kind === 'createText')?.id || 'forged-operation'); });
  runBranchHostile('allCellLedgersEmpty wrong source', allEmpty, (_program, _table, row) => { (row as unknown as { source: X4UiSceneSourceLocation }).source = { ...row.source, start: { ...row.source.start, offset: row.source.start.offset + 1 } }; });
  runBranchHostile('legacyEmptyCellShape forged contentKind', legacy, (_program, _table, _row, cells) => { (cells[0]!.descriptorFacts as Record<string, X4UiLayoutDescriptorFact>).contentKind = known('text', 'string', cells[0]!.source); });
  runBranchHostile('legacyEmptyCellShape extra cell shape', legacy, (program, _table, row, cells) => {
    const extra = cloneJsonValue(cells[0]!);
    (extra as unknown as { id: string; column: number }).id = `${cells[0]!.id}:extra`;
    (extra as unknown as { column: number }).column = 2;
    (program.cells as X4UiLayoutCellNode[]).push(extra);
    (row.cellIds as string[]).push(extra.id);
  });
  runBranchHostile('legacyEmptyCellShape downstream ownership drift', legacy, (program, _table, row) => { (row.operationIds as string[]).push(program.operations.find(operation => operation.kind === 'createText')?.id || 'forged-operation'); });
  runBranchHostile('legacyEmptyCellShape wrong source', legacy, (_program, _table, row) => { (row as unknown as { source: X4UiSceneSourceLocation }).source = { ...row.source, start: { ...row.source.start, offset: row.source.start.offset + 1 } }; });
});

test('B119 fail-first: Scene gap finalization canonicalizes reverse source offsets and every link', () => {
  const projected = rawProjectionFor([
    'local menu = { name = "B119ReverseGapOrder", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local first = frame:addTable(1, { width = 40 })',
    'first:setColWidth(1, 40, false)',
    'local firstRow = first:addRow(false, {})',
    'firstRow[1]:createText("first", {})',
    'local second = frame:addTable(1, { width = getWidth() })',
    'second:setColWidth(1, 40, false)',
    'local secondRow = second:addRow(false, {})',
    'secondRow[1]:createText("second", {})',
    'frame:display()',
  ].join('\n'), 'selftest/b119-reverse-gap-order.lua');
  assert(projected.program !== undefined && projected.profile !== undefined && 'program' in projected.result && projected.result.program !== undefined && 'evidenceAuthority' in projected.result && projected.result.evidenceAuthority !== undefined, 'reverse-gap fixture must issue a producer evidence pair');
  const result = buildX4UiScene(projected.result as X4UiLayoutProgramResult, corpus, projected.profile);
  assert(result.status !== 'refused', `reverse-gap fixture refused before Paint: ${JSON.stringify({ status: result.status, refusal: result.status === 'refused' ? result.refusal : undefined, tables: projected.program.tables.map(table => ({ id: table.id, reserve: table.descriptorFacts.reserveScrollBar, state: table.kernelState && { final: table.kernelState.final, reserve: table.kernelState.properties.reserveScrollBar, diagnostics: table.kernelState.diagnostics }, operations: table.operationIds.map(id => projected.program.operations.find(operation => operation.id === id)?.descriptorFacts.reserveScrollBar) })) })}`);
  const scene = result.scene;
  assert(scene.gaps.length > 1, `reverse-gap fixture must produce multiple gaps: ${JSON.stringify(scene.gaps)}`);
  const compareCanonicalGap = (left: (typeof scene.gaps)[number], right: (typeof scene.gaps)[number]): number =>
    left.source.file.localeCompare(right.source.file)
    || left.source.start.offset - right.source.start.offset
    || left.source.end.offset - right.source.end.offset
    || left.category.localeCompare(right.category)
    || left.status.localeCompare(right.status)
    || left.reason.localeCompare(right.reason)
    || (left.expression || '').localeCompare(right.expression || '')
    || (left.operationId || '').localeCompare(right.operationId || '')
    || (left.nodeId || '').localeCompare(right.nodeId || '');
  assert(scene.gaps.every((gap, index) => index === 0 || compareCanonicalGap(scene.gaps[index - 1]!, gap) <= 0), `Scene gaps must be in canonical source order: ${JSON.stringify(scene.gaps.map(gap => ({ id: gap.id, file: gap.source.file, start: gap.source.start.offset, end: gap.source.end.offset, category: gap.category, status: gap.status, operationId: gap.operationId, nodeId: gap.nodeId })))}`);
  assert(scene.gaps.every((gap, index) => gap.id === `scene-gap:${String(index).padStart(6, '0')}`), `Scene gap IDs must be sequential after canonicalization: ${JSON.stringify(scene.gaps.map(gap => gap.id))}`);
  const gapIds = new Set(scene.gaps.map(gap => gap.id));
  const references = [
    ...scene.frames.flatMap(node => node.diagnosticLinks),
    ...scene.tables.flatMap(node => node.diagnosticLinks),
    ...scene.rows.flatMap(node => node.diagnosticLinks),
    ...scene.cells.flatMap(node => node.diagnosticLinks),
    ...scene.widgets.flatMap(node => node.diagnosticLinks),
    ...scene.texts.flatMap(node => [...node.diagnosticLinks, ...node.textGaps, ...node.lines.flatMap(line => line.diagnosticLinks)]),
  ];
  assert(references.every(id => gapIds.has(id)), `Scene gap links must resolve after canonicalization: ${JSON.stringify(references)}`);
  assert(scene.frames.every(node => new Set(node.diagnosticLinks).size === node.diagnosticLinks.length)
    && scene.tables.every(node => new Set(node.diagnosticLinks).size === node.diagnosticLinks.length)
    && scene.rows.every(node => new Set(node.diagnosticLinks).size === node.diagnosticLinks.length)
    && scene.cells.every(node => new Set(node.diagnosticLinks).size === node.diagnosticLinks.length)
    && scene.widgets.every(node => new Set(node.diagnosticLinks).size === node.diagnosticLinks.length)
    && scene.texts.every(node => new Set([...node.diagnosticLinks, ...node.textGaps, ...node.lines.flatMap(line => line.diagnosticLinks)]).size === [...node.diagnosticLinks, ...node.textGaps, ...node.lines.flatMap(line => line.diagnosticLinks)].length), 'Scene gap links must not duplicate');
  assert(isDeepFrozen(scene), 'canonical Scene gap output must remain deeply frozen');
});

test('B119 fail-first: sampled hub and comm shapes cross the Scene structural boundary', () => {
  const makeSampledIssued = (sourceText: string, sourcePath: string) => {
    const model = buildX4UiCallModel({ rel: sourcePath, text: sourceText, sourcePath });
    const target = createX4UiLayoutTargetCatalog(model).targets.find(candidate => candidate.name === 'display');
    const baseProfile = rawProducerProjection.program?.profile;
    assert(target !== undefined && baseProfile !== undefined, `${sourcePath} must expose its display target and producer profile`);
    const producerProfile = {
      ...baseProfile,
      source: target.sourceIdentity,
      localExpansion: { maxDepth: 4, maxInvocations: 8 },
    } as Parameters<typeof projectX4UiLayoutProgram>[2];
    const unsampled = projectX4UiLayoutProgram(model, target, producerProfile);
    assert('program' in unsampled && unsampled.program !== undefined, `${sourcePath} must issue an unsampled layout program`);
    const sampleInput = {
      catalogId: unsampled.program.sampleCatalog.id,
      source: unsampled.program.sampleCatalog.sourceIdentity,
      values: unsampled.program.sampleCatalog.entries.map((entry, index) => ({
        id: entry.id,
        value: entry.expectedType === 'number' ? 40 + index * 10 : entry.expectedType === 'boolean' ? false : `issued-${index}`,
      })),
    };
    const sampled = projectX4UiLayoutProgram(model, target, producerProfile, sampleInput);
    assert('program' in sampled && sampled.program !== undefined && 'evidenceAuthority' in sampled && sampled.evidenceAuthority !== undefined, `${sourcePath} must issue a sampled layout/evidence pair`);
    assert(validateX4UiLayoutEvidencePair(sampled.program, sampled.evidenceAuthority).valid, `${sourcePath} sampled layout/evidence pair must validate before Scene mapping`);
    const profile: X4UiSceneProfile = Object.freeze({
      id: `b119-${sourcePath}`,
      provenance: 'B119 sampled hub/comm Scene structural compatibility selftest',
      source: sampled.program.profile.source,
      helper: { sourcePath: HELPER_PATH, sha256: X4_LAYOUT_PROVENANCE.helperSha256 },
      widget: { sourcePath: WIDGET_PATH, sha256: X4_LAYOUT_PROVENANCE.widgetSha256 },
      fonts: sceneProfile.fonts,
      drawable: { width: sampled.program.profile.frame.width, height: sampled.program.profile.frame.height },
      textPolicy: sceneProfile.textPolicy,
    });
    return { result: sampled as X4UiLayoutProgramResult, program: sampled.program, profile };
  };
  const hub = makeSampledIssued([
    'local Helper = rawget(_G, "Helper")',
    'local function panel(frame, width, firstLabel, secondLabel)',
    '  local table = frame:addTable(2, { width = width, reserveScrollBar = false, scaling = false })',
    '  local row = table:addRow(false, {})',
    '  row[1]:createText(firstLabel, { height = 10 })',
    '  row[2]:createText(secondLabel, { height = 10 })',
    'end',
    'local function display(firstWidth, secondWidth, firstLabel, secondLabel)',
    '  local menu = { name = "B119Hub", layer = 4 }',
    '  local frame = Helper.createFrameHandle(menu, { width = 100, height = 80, layer = menu.layer })',
    '  panel(frame, firstWidth, firstLabel, secondLabel)',
    '  panel(frame, secondWidth, secondLabel, firstLabel)',
    '  frame:display()',
    'end',
  ].join('\n'), 'selftest/b119-hub-display.lua');
  const comm = makeSampledIssued([
    'local Helper = rawget(_G, "Helper")',
    'local function fill(row, column, label)',
    '  row[column]:createText(label, { height = 10 })',
    'end',
    'local function display(first, second, third)',
    '  local menu = { name = "B119Comm", layer = 4 }',
    '  local frame = Helper.createFrameHandle(menu, { width = 100, height = 80, layer = menu.layer })',
    '  local table = frame:addTable(3, { width = 80 })',
    '  local row = table:addRow(false, {})',
    '  fill(row, 1, first)',
    '  fill(row, 2, second)',
    '  fill(row, 3, third)',
    '  frame:display()',
    'end',
  ].join('\n'), 'selftest/b119-comm-display.lua');
  const cases = [
    ['hub', hub, { tables: 2, rows: 2, cells: 4 }],
    ['comm', comm, { tables: 1, rows: 1, cells: 3 }],
  ] as const;
  for (const [name, candidate, expected] of cases) {
    assert(candidate.program.status === 'partial', `${name} sampled program must remain partial`);
    assert(candidate.program.frames.length === 1 && candidate.program.tables.length === expected.tables && candidate.program.rows.length === expected.rows && candidate.program.cells.length === expected.cells, `${name} sampled geometry cardinality must be ${expected.tables}/${expected.rows}/${expected.cells}`);
    const frame = candidate.program.frames[0];
    const layer = frame?.descriptorFacts.layer;
    assert(layer?.status === 'known' && layer.expectedType === 'number' && layer.value === 4 && layer.provenance === 'source-literal' && layer.expression === 'menu.layer', `${name} must retain indirect menu.layer frame provenance`);
    const sceneResult = buildX4UiScene(candidate.result, corpus, candidate.profile);
    assert(sceneResult.status !== 'refused', `${name} issued sampled structure must cross the Scene boundary`);
    const forged = cloneProgram(candidate.program);
    const localOperation = forged.operations.find(operation => operation.localExpansion !== undefined);
    assert(localOperation?.localExpansion !== undefined, `${name} must carry local invocation evidence`);
    (localOperation as unknown as { localExpansion: { invocationId: string } }).localExpansion = {
      ...localOperation.localExpansion,
      invocationId: 'detached-local-invocation',
    };
    assert(refusalHasNoScene(pairInvalidProgram(forged, candidate.result, candidate.profile, corpus, `${name}: detached local evidence`)), `${name} detached local evidence must refuse`);
  }
  const unmaterialized = rawProjectionFor([
    'local menu = { name = "B119UnmaterializedControl", layer = 4 }',
    'local frame = Helper.createFrameHandle(menu, { width = getFrameWidth(), height = 80 })',
    'local table = frame:addTable(1, { width = 80 })',
    'local row = table:addRow(false, {})',
    'row[1]:createText(getText(), {})',
    'row[1]:setColSpan(getSpan())',
    'local second = frame:addTable(2, dynamic_options)',
    'second:addRow(false, dynamic_row_options)',
    'frame:display()',
  ].join('\n'), 'selftest/b119-unmaterialized-control.lua');
  assert(unmaterialized.program !== undefined && unmaterialized.profile !== undefined && 'evidenceAuthority' in unmaterialized.result && unmaterialized.result.evidenceAuthority !== undefined, 'unmaterialized control must issue a layout/evidence pair');
  assert(validateX4UiLayoutEvidencePair(unmaterialized.program, unmaterialized.result.evidenceAuthority).valid, 'unmaterialized control pair must validate before Scene mapping');
  assert(unmaterialized.program.tables.length === 2 && unmaterialized.program.rows.length === 2 && unmaterialized.program.cells.length === 0, 'unmaterialized control must retain its 2/2/0 refused geometry');
  assert(buildX4UiScene(unmaterialized.result as X4UiLayoutProgramResult, corpus, unmaterialized.profile).status !== 'refused', 'issued downstream unresolved table/row ownership must cross the Scene boundary');
  const forgedUnmaterialized = cloneProgram(unmaterialized.program);
  const forgedDownstream = forgedUnmaterialized.operations.find(operation => operation.kind === 'createText');
  assert(forgedDownstream !== undefined, 'unmaterialized control must expose a downstream creator operation');
  (forgedDownstream as unknown as { status: 'applied' }).status = 'applied';
  assert(refusalHasNoScene(pairInvalidProgram(forgedUnmaterialized, unmaterialized.result as X4UiLayoutProgramResult, unmaterialized.profile, corpus, 'unmaterialized downstream applied forgery')), 'unmaterialized applied downstream forgery must refuse');
});

test('8B fail-first: real selected local expansion reaches the public scene boundary', () => {
  const sourceText = [
    'local Helper = rawget(_G, "Helper")',
    'local function panel(frame, width, label)',
    '  local table = frame:addTable(1, { width = width })',
    '  local row = table:addRow(false, {})',
    '  row[1]:createText(label, { height = 10 })',
    'end',
    'local function display(tab)',
    '  local menu = { name = "SelectedExpansion", layer = 1 }',
    '  local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    '  if tab == "first" then panel(frame, 40, "first") else panel(frame, 50, "second") end',
    '  if false then panel(frame, 60, "never") end',
    'end',
    'display("first")',
  ].join('\n');
  const model = buildX4UiCallModel({ rel: 'selftest/raw-8b-selected-expansion.lua', text: sourceText, sourcePath: 'selftest/raw-8b-selected-expansion.lua' });
  const target = createX4UiLayoutTargetCatalog(model).targets.find(candidate => candidate.kind !== 'top-level' && candidate.name === 'display');
  const baseProfile = rawProducerProjection.program?.profile;
  assert(target !== undefined && baseProfile !== undefined, 'selected expansion source must expose its named target');
  const unselected = projectX4UiLayoutProgram(
    model,
    target,
    { ...baseProfile, source: target.sourceIdentity, localExpansion: { maxDepth: 4, maxInvocations: 8 } },
  );
  assert('program' in unselected && unselected.program !== undefined, 'selected expansion source must produce an unselected program');
  const catalog = unselected.program.localExpansion?.previewPathCatalog;
  const thenPath = catalog?.entries.find(entry => entry.arm === 'then' && entry.reachability !== 'unreachable');
  assert(catalog !== undefined && thenPath !== undefined, 'selected expansion source must expose a selectable then path');
  const selected = projectX4UiLayoutProgram(
    model,
    target,
    { ...unselected.program.profile, localExpansion: { maxDepth: 4, maxInvocations: 8 } },
    undefined,
    { catalogId: catalog.id, source: catalog.sourceIdentity, selections: [{ id: thenPath.id, boundaryId: thenPath.boundaryId, armId: thenPath.armId }] },
  );
  assert('program' in selected && selected.program !== undefined && 'evidenceAuthority' in selected, 'selected expansion must retain the full producer result wrapper');
  const selectedProfile: X4UiSceneProfile = Object.freeze({
    id: 'raw-8b-selected-expansion-profile',
    provenance: 'Batch 6A-S eighth review selftest',
    source: selected.program.profile.source,
    helper: { sourcePath: HELPER_PATH, sha256: X4_LAYOUT_PROVENANCE.helperSha256 },
    widget: { sourcePath: WIDGET_PATH, sha256: X4_LAYOUT_PROVENANCE.widgetSha256 },
    fonts: sceneProfile.fonts,
    drawable: { width: selected.program.profile.frame.width, height: selected.program.profile.frame.height },
    textPolicy: sceneProfile.textPolicy,
  });
  const expansionResult = buildX4UiScene(selected, corpus, selectedProfile);
  assert(!refusalHasNoScene(expansionResult), `real selected expansion result was refused: ${JSON.stringify(expansionResult)}`);
});

test('8B fail-first: blocked addRow evidence stays unmaterialized through the public wrapper', () => {
  const sourceText = [
    'local menu = { name = "BlockedRows8B", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(1, { width = 80, reserveScrollBar = false, scaling = false })',
    'table:setColWidth(1, 80, false)',
    'local row = table:addRow(false, { paddingTop = 1, paddingBottom = 1, borderBelow = false, fixed = false })',
    'row[1]:createButton({ height = 10, affectRowHeight = false })',
    'if choose then local conditionalRow = table:addRow(false, dynamic_options) end',
    'if false then local unreachableRow = table:addRow(false, {}) end',
    'frame:display()',
  ].join('\n');
  const projected = rawProjectionFor(sourceText, 'selftest/raw-8b-blocked-rows.lua');
  assert(projected.program !== undefined && projected.profile !== undefined && projected.result !== undefined && 'program' in projected.result, 'blocked-row source must produce a successful result wrapper');
  const blockedRows = projected.program.operations.filter(operationNode => operationNode.kind === 'addRow' && (operationNode.status === 'conditional' || operationNode.status === 'unreachable'));
  assert(blockedRows.length === 2 && blockedRows.every(operationNode => operationNode.rowId === undefined || projected.program?.rows.find(row => row.id === operationNode.rowId)?.rowIndex === undefined), `blocked addRow operations must remain exact unmaterialized evidence: ${JSON.stringify(blockedRows)}`);
  const result = buildX4UiScene(projected.result, corpus, projected.profile);
  assert(!refusalHasNoScene(result), `real producer blocked-row result was refused: ${JSON.stringify(result)}`);
});

test('8B fail-first: creator result enters only through the producer authority pair', () => {
  const sourceText = [
    'local menu = { name = "Creators8B", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(4, { width = 100, reserveScrollBar = false, scaling = false })',
    'table:setColWidth(1, 25, false)',
    'table:setColWidth(2, 25, false)',
    'table:setColWidth(3, 25, false)',
    'table:setColWidth(4, 25, false)',
    'local row = table:addRow(false, { paddingTop = 1, paddingBottom = 1, borderBelow = false, fixed = false })',
    'row[1]:createText("text", { height = 10, minRowHeight = 10 })',
    'row[2]:createEditBox({ height = 10, defaultText = "edit", description = "description", active = false })',
    'row[3]:createButton({ height = 10, affectRowHeight = false }):setText("button", {})',
    'row[4]:createIcon("solid", { height = 10, affectRowHeight = false })',
    'frame:display()',
  ].join('\n');
  const projected = rawProjectionFor(sourceText, 'selftest/raw-8b-creators.lua');
  assert(projected.program !== undefined && projected.profile !== undefined && projected.result !== undefined && 'program' in projected.result, 'creator source must produce a successful result wrapper');
  const control = buildX4UiScene(projected.result, corpus, projected.profile);
  assert(!refusalHasNoScene(control), `real producer creator result was refused: ${JSON.stringify(control)}`);
  const creatorKinds = ['createText', 'createEditBox', 'createButton', 'createIcon'] as const;
  const failures: string[] = [];
  for (const kind of creatorKinds) {
    const sourceOperation = projected.program.operations.find(operationNode => operationNode.kind === kind);
    const sourceCell = sourceOperation?.cellId === undefined ? undefined : projected.program.cells.find(cell => cell.id === sourceOperation.cellId);
    if (!sourceOperation || !sourceCell) {
      failures.push(`${kind}: missing producer cell`);
      continue;
    }
    const mutations: readonly [string, (program: X4UiLayoutProgram) => void][] = [
      ['contentKind', program => { const cell = program.cells.find(candidate => candidate.id === sourceCell.id)!; (cell.descriptorFacts as Record<string, X4UiLayoutDescriptorFact>).contentKind = known(kind === 'createIcon' ? 'button' : 'icon', 'string', cell.source); }],
      ['outerHeight', program => { const cell = program.cells.find(candidate => candidate.id === sourceCell.id)!; (cell.descriptorFacts as Record<string, X4UiLayoutDescriptorFact>).outerHeight = known(999, 'number', cell.source); }],
      ['primaryContent', program => { const cell = program.cells.find(candidate => candidate.id === sourceCell.id)!; (cell.descriptorFacts as Record<string, X4UiLayoutDescriptorFact>).primaryContent = known('forged-primary', 'string', cell.source); }],
      ['partial-semantics', program => { const operation = program.operations.find(candidate => candidate.id === sourceOperation.id)!; (operation.metadata.semantics as unknown as Record<string, unknown>).forged = true; }],
      ['contradictory-value', program => { const cell = program.cells.find(candidate => candidate.id === sourceCell.id)!; (cell.descriptorFacts as Record<string, X4UiLayoutDescriptorFact>).contentKind = known('cell', 'string', cell.source); }],
      ['removed-replay-fact', program => { const operation = program.operations.find(candidate => candidate.id === sourceOperation.id)!; delete (operation.descriptorFacts as Record<string, unknown>).outerHeight; }],
    ];
    for (const [label, mutate] of mutations) {
      const program = cloneProgram(projected.program);
      mutate(program);
      freezeFixtureGraph(program);
      const pair = validateX4UiLayoutEvidencePair(program, producerAuthority(projected.result as X4UiLayoutProgramResult));
      if (pair.valid) {
        failures.push(`${kind}:${label}: pair unexpectedly valid`);
        continue;
      }
      const mutated = buildX4UiScene(
        freezeFixtureGraph({ ...projected.result, program }) as X4UiLayoutProgramResult,
        corpus,
        projected.profile,
      );
      if (!refusalHasNoScene(mutated)) failures.push(`${kind}:${label}: pair-invalid input reached scene`);
    }
  }
  assert(failures.length === 0, `creator authority escapes: ${failures.join(', ')}`);
});

test('8B fail-first: exact gap and no-op operation authority remain scene inputs', () => {
  const dynamicSource = [
    'local menu = { name = "DynamicGap8B", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(1, { width = 40, reserveScrollBar = false })',
    'table:setColWidth(getIndex(), getWidth(), getScaling())',
  ].join('\n');
  const noOpSource = [
    'local menu = { name = "NoOp8B", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(1, { width = 40, reserveScrollBar = false })',
    'table:setColWidth(1, 20, false)',
    'table:setColWidth(1, 20, false)',
    'table:addRow(false, {})',
  ].join('\n');
  const dynamic = rawProjectionFor(dynamicSource, 'selftest/raw-8b-dynamic-gaps.lua');
  const noOp = rawProjectionFor(noOpSource, 'selftest/raw-8b-no-op.lua');
  assert(dynamic.program !== undefined && dynamic.profile !== undefined && dynamic.result !== undefined && 'program' in dynamic.result, 'dynamic gap source must produce a successful result wrapper');
  assert(noOp.program !== undefined && noOp.profile !== undefined && noOp.result !== undefined && 'program' in noOp.result, 'no-op source must produce a successful result wrapper');
  const dynamicScene = buildX4UiScene(dynamic.result, corpus, dynamic.profile);
  assert(!refusalHasNoScene(dynamicScene), `intact dynamic gap result must be accepted: ${JSON.stringify(dynamicScene)}`);
  const noOpScene = buildX4UiScene(noOp.result, corpus, noOp.profile);
  assert(!refusalHasNoScene(noOpScene), `intact repeated no-op result must be accepted: ${JSON.stringify(noOpScene)}`);
  const dynamicOperation = dynamic.program.operations.find(operationNode => operationNode.kind === 'setColWidth');
  const dynamicGaps = dynamic.program.gaps.filter(gap => gap.operationId === dynamicOperation?.id);
  assert(dynamicOperation !== undefined && dynamicGaps.length >= 3, 'dynamic gap source must expose its exact linked gap family');
  const gapMutation = { ...dynamic.result, program: cloneProgram(dynamic.program) } as X4UiLayoutProgramResult;
  const mutableGap = gapMutation.program!.gaps.find(gap => gap.operationId === dynamicOperation.id)! as unknown as Record<string, unknown>;
  mutableGap.reason = 'forged dynamic gap';
  assert(refusalHasNoScene(buildX4UiScene(gapMutation, corpus, dynamic.profile)), 'mutated linked gap must refuse');
  const noOpOperations = noOp.program.operations.filter(operationNode => operationNode.kind === 'setColWidth');
  assert(noOpOperations.length === 2, 'no-op source must expose two width operations');
  const noOpMutation = { ...noOp.result, program: cloneProgram(noOp.program) } as X4UiLayoutProgramResult;
  (noOpMutation.program!.operations as X4UiLayoutOperation[]).splice(0, 1, ...noOpMutation.program!.operations.slice(1, 2));
  assert(refusalHasNoScene(buildX4UiScene(noOpMutation, corpus, noOp.profile)), 'reordered no-op operation must refuse even when state is unchanged');
});

test('B119 fail-first: producer dynamic gaps become exact frozen Scene unknown gaps', () => {
  const projected = rawProjectionFor([
    'local menu = { name = "DynamicSceneGap", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(1, { width = 80, reserveScrollBar = false, scaling = false })',
    'table:setColWidth(1, 80, false)',
    'local row = table:addRow(false, {})',
    'row[1]:createText(getRuntimeText(), { height = 10, minRowHeight = 10 })',
    'frame:display()',
  ].join('\n'), 'selftest/b119-dynamic-scene-gap.lua');
  assert(projected.program !== undefined && projected.profile !== undefined && projected.result !== undefined && 'program' in projected.result, 'dynamic Scene-gap source must issue a producer authority pair');
  const producerResult = projected.result as X4UiLayoutProgramResult;
  const producerProgram = projected.program;
  const producerDynamicGaps = producerProgram.gaps.filter(gap => gap.status === 'dynamic');
  assert(producerDynamicGaps.length > 0, `dynamic Scene-gap source must expose producer dynamic gaps: ${JSON.stringify(producerProgram.gaps)}`);
  const beforeProgram = JSON.stringify(producerProgram);
  const result = buildX4UiScene(producerResult, corpus, projected.profile);
  assert(!refusalHasNoScene(result), `intact producer dynamic-gap result must cross Scene: ${JSON.stringify(result)}`);
  const scene = sceneOf(result);
  const errors: string[] = [];
  for (const producerGap of producerProgram.gaps) {
    const matches = scene.gaps.filter(sceneGap =>
      sceneGap.category === producerGap.category
      && sceneGap.reason === producerGap.reason
      && jsonEqual(sceneGap.source, producerGap.source)
      && sceneGap.expression === producerGap.expression
      && sceneGap.operationId === producerGap.operationId
      && sceneGap.nodeId === producerGap.nodeId
      && sceneGap.sourcePin === undefined
      && sceneGap.previewOnly === undefined
      && sceneGap.textRange === undefined
      && sceneGap.lineIndex === undefined,
    );
    if (matches.length !== 1) {
      errors.push(`producer gap must map once: ${JSON.stringify({ producerGap, matches })}`);
      continue;
    }
    const sceneGap = matches[0];
    const expectedStatus = producerGap.status === 'dynamic' ? 'unknown' : producerGap.status;
    if (sceneGap.status !== expectedStatus) errors.push(`status ${producerGap.status} mapped to ${sceneGap.status}, expected ${expectedStatus}`);
    const expectedKeys = ['category', 'id', 'reason', 'source', 'status'];
    if (producerGap.expression !== undefined) expectedKeys.push('expression');
    if (producerGap.operationId !== undefined) expectedKeys.push('operationId');
    if (producerGap.nodeId !== undefined) expectedKeys.push('nodeId');
    if (!jsonEqual(Object.keys(sceneGap).sort(), expectedKeys.sort())) errors.push(`producer gap Scene shape drifted: ${JSON.stringify(sceneGap)}`);
  }
  if (scene.gaps.some(gap => gap.status === 'dynamic')) errors.push('Scene output retained producer-only dynamic status');
  if (!scene.gaps.some(gap => gap.status === 'unknown')) errors.push('Scene output omitted normalized unknown status');
  if (JSON.stringify(producerProgram) !== beforeProgram) errors.push('Scene normalization mutated producer evidence');
  if (!isDeepFrozen(scene)) errors.push('normalized Scene output is not deeply frozen');

  const malformedProgram = cloneProgram(producerProgram);
  const malformedGap = malformedProgram.gaps.find(gap => gap.status === 'dynamic') as unknown as Record<string, unknown> | undefined;
  assert(malformedGap !== undefined, 'malformed-status control must find a producer dynamic gap');
  malformedGap.status = 'bogus';
  let malformedThrew = false;
  let malformedResult: X4UiSceneResult | undefined;
  try {
    malformedResult = buildX4UiScene({ ...producerResult, program: malformedProgram } as X4UiLayoutProgramResult, corpus, projected.profile);
  } catch {
    malformedThrew = true;
  }
  if (validateX4UiLayoutEvidencePair(malformedProgram, producerAuthority(producerResult)).valid) errors.push('bogus producer gap status remained authority-valid');
  if (malformedThrew
    || malformedResult === undefined
    || malformedResult.status !== 'refused'
    || malformedResult.refusal.code !== 'invalid-program') errors.push('bogus producer gap status did not fail closed at the producer authority boundary without throw');
  assert(errors.length === 0, errors.join('; '));
});

test('8B exact raw producer differential census retains the audited field inventory', () => {
  type AuditMatrixCase = {
    readonly label: string;
    readonly kind: string;
    readonly sourceText: string;
    readonly expectedStatus: string;
    readonly discarded?: boolean;
  };
  const expectedCounts: Readonly<Record<string, number>> = {
    createFrameHandle: 8,
    addTable: 15,
    setColWidth: 5,
    setColWidthPercent: 3,
    addRow: 8,
    setColSpan: 3,
    createText: 14,
    createEditBox: 13,
    createButton: 10,
    createIcon: 10,
    setText: 10,
    setText2: 10,
    scaleX: 3,
    scaleY: 3,
    scaleFont: 4,
    display: 1,
    OpenMenu: 1,
  };
  const auditBase = (
    body: string,
    tableOptions = '{ width = 100, reserveScrollBar = false, scaling = false }',
  ): string => [
    'local menu = { name = "Matrix", layer = 1 }',
    'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
    'local table = frame:addTable(2, ' + tableOptions + ')',
    body,
    'frame:display()',
  ].join('\n');
  const auditWithRow = (target: string, beforeTarget = ''): string => auditBase([
    'table:setColWidth(1, 40, false)',
    'table:setColWidth(2, 40, false)',
    'local row = table:addRow(false, { paddingTop = 1, paddingBottom = 1, borderBelow = false, fixed = false, scaling = false })',
    beforeTarget,
    target,
  ].filter(Boolean).join('\n'));
  const matrix: AuditMatrixCase[] = [];
  const add = (label: string, kind: string, sourceText: string, expectedStatus: string, discarded = false): void => {
    matrix.push({ label, kind, sourceText, expectedStatus, discarded });
  };

  for (const [field, value] of [
    ['width', 'dynamic_width'],
    ['height', 'dynamic_height'],
    ['x', 'dynamic_x'],
    ['y', 'dynamic_y'],
    ['layer', 'dynamic_layer'],
    ['autoFrameHeight', 'dynamic_auto'],
  ] as const) {
    add('frame dynamic ' + field, 'createFrameHandle', auditBase('local bad = Helper.createFrameHandle(menu, { ' + field + ' = ' + value + ' })'), 'unresolved');
  }
  add('frame dynamic options', 'createFrameHandle', auditBase('local bad = Helper.createFrameHandle(menu, dynamic_options)'), 'unresolved');
  add('frame non-helper receiver', 'createFrameHandle', auditBase('local bad = Other.createFrameHandle(menu, { width = 20, height = 20 })'), 'unresolved');

  for (const [field, value] of [
    ['count', 'dynamic_count'],
    ['width', 'dynamic_width'],
    ['x', 'dynamic_x'],
    ['y', 'dynamic_y'],
    ['maxVisibleHeight', 'dynamic_height'],
    ['reserveScrollBar', 'dynamic_reserve'],
    ['scaling', 'dynamic_scaling'],
    ['tabOrder', 'dynamic_tab'],
    ['highlightMode', 'dynamic_highlight'],
    ['backgroundID', 'dynamic_background'],
    ['backgroundColor', 'dynamic_color'],
  ] as const) {
    const call = field === 'count'
      ? 'local bad = frame:addTable(' + value + ', { width = 20 })'
      : 'local bad = frame:addTable(1, { width = 20, ' + field + ' = ' + value + ' })';
    add('table dynamic ' + field, 'addTable', auditBase(call), 'unresolved');
  }
  add('table dynamic options', 'addTable', auditBase('local bad = frame:addTable(1, dynamic_options)'), 'unresolved');
  add('table owner unavailable', 'addTable', auditBase('local bad = missing_frame:addTable(1, { width = 20 })'), 'unresolved');
  add('table rejected count', 'addTable', auditBase('local bad = frame:addTable(0, { width = 20 })'), 'rejected');
  add('table rejected width', 'addTable', auditBase('local bad = frame:addTable(1, { width = -1 })'), 'rejected');

  for (const [label, line, kind, status] of [
    ['width dynamic index', 'table:setColWidth(dynamic_index, 20, false)', 'setColWidth', 'unresolved'],
    ['width dynamic value', 'table:setColWidth(1, dynamic_width, false)', 'setColWidth', 'unresolved'],
    ['width dynamic scaling', 'table:setColWidth(1, 20, dynamic_scaling)', 'setColWidth', 'unresolved'],
    ['width rejected index', 'table:setColWidth(0, 20, false)', 'setColWidth', 'rejected'],
    ['width rejected value', 'table:setColWidth(1, -1, false)', 'setColWidth', 'rejected'],
    ['percent dynamic index', 'table:setColWidthPercent(dynamic_index, 50)', 'setColWidthPercent', 'unresolved'],
    ['percent dynamic value', 'table:setColWidthPercent(1, dynamic_percent)', 'setColWidthPercent', 'unresolved'],
    ['percent rejected index', 'table:setColWidthPercent(0, 50)', 'setColWidthPercent', 'rejected'],
  ] as const) {
    add(
      label,
      kind,
      auditBase([
        line,
        'table:setColWidth(1, 40, false)',
        'table:setColWidth(2, 40, false)',
        'local row = table:addRow(false, { paddingTop = 1, paddingBottom = 1, borderBelow = false, fixed = false })',
        'row[1]:createButton({ height = 10 })',
      ].join('\n')),
      status,
    );
  }

  for (const [field, value] of [
    ['paddingTop', 'dynamic_top'],
    ['paddingBottom', 'dynamic_bottom'],
    ['borderBelow', 'dynamic_border'],
    ['fixed', 'dynamic_fixed'],
    ['scaling', 'dynamic_scaling'],
    ['interactive', 'dynamic_interactive'],
  ] as const) {
    add(
      'row dynamic ' + field,
      'addRow',
      auditBase([
        'table:setColWidth(1,40,false)',
        'table:setColWidth(2,40,false)',
        'local badrow = table:addRow(false, { ' + field + ' = ' + value + ' })',
      ].join('\n')),
      field === 'interactive' ? 'applied' : 'unresolved',
      field === 'interactive',
    );
  }
  add('row dynamic options', 'addRow', auditBase([
    'table:setColWidth(1,40,false)',
    'table:setColWidth(2,40,false)',
    'local badrow = table:addRow(false, dynamic_options)',
  ].join('\n')), 'unresolved');
  add('row owner unavailable', 'addRow', auditBase('local badrow = missing_table:addRow(false, { paddingTop = 1 })'), 'unresolved');
  add('row rejected padding', 'addRow', auditBase([
    'table:setColWidth(1,40,false)',
    'table:setColWidth(2,40,false)',
    'local badrow = table:addRow(false, { paddingTop = -1 })',
  ].join('\n')), 'rejected');

  add('span dynamic', 'setColSpan', auditWithRow('row[1]:setColSpan(dynamic_span)'), 'unresolved');
  add('span missing cell', 'setColSpan', auditWithRow('row[9]:setColSpan(2)'), 'unresolved');
  add('span rejected', 'setColSpan', auditWithRow('row[1]:setColSpan(0)'), 'rejected');

  const creators: readonly (readonly [string, string])[] = [
    ['createText', 'row[1]:createText("text", OPTIONS)'],
    ['createEditBox', 'row[1]:createEditBox(OPTIONS)'],
    ['createButton', 'row[1]:createButton(OPTIONS)'],
    ['createIcon', 'row[1]:createIcon("solid", OPTIONS)'],
  ];
  for (const [kind, template] of creators) {
    add(kind + ' dynamic options', kind, auditWithRow(template.replace('OPTIONS', 'dynamic_options')), 'unresolved');
    for (const [field, value] of [
      ['x', 'dynamic_x'],
      ['y', 'dynamic_y'],
      ['width', 'dynamic_width'],
      ['height', 'dynamic_height'],
      ['scaling', 'dynamic_scaling'],
    ] as const) {
      add(kind + ' dynamic ' + field, kind, auditWithRow(template.replace('OPTIONS', '{ ' + field + ' = ' + value + ' }')), 'unresolved');
    }
    if (kind === 'createText') {
      add('createText dynamic content', kind, auditWithRow('row[1]:createText(dynamic_text, { height = 10 })'), 'unresolved');
      for (const [field, value] of [
        ['font', 'dynamic_font'],
        ['fontsize', 'dynamic_size'],
        ['halign', 'dynamic_align'],
        ['wordwrap', 'dynamic_wrap'],
        ['minRowHeight', 'dynamic_min'],
      ] as const) {
        add('createText dynamic ' + field, kind, auditWithRow(template.replace('OPTIONS', '{ height = 10, ' + field + ' = ' + value + ' }')), 'unresolved');
      }
    }
    if (kind === 'createEditBox') {
      for (const [field, value] of [
        ['defaultText', 'dynamic_default'],
        ['description', 'dynamic_description'],
        ['maxChars', 'dynamic_max'],
        ['selectTextOnActivation', 'dynamic_select'],
        ['active', 'dynamic_active'],
      ] as const) {
        add('createEditBox dynamic ' + field, kind, auditWithRow(template.replace('OPTIONS', '{ height = 10, ' + field + ' = ' + value + ' }')), 'unresolved');
      }
    }
    if (kind === 'createButton') {
      for (const [field, value] of [
        ['affectRowHeight', 'dynamic_affect'],
        ['active', 'dynamic_active'],
      ] as const) {
        add('createButton dynamic ' + field, kind, auditWithRow(template.replace('OPTIONS', '{ height = 10, ' + field + ' = ' + value + ' }')), 'unresolved');
      }
    }
    if (kind === 'createIcon') {
      add('createIcon dynamic identity', kind, auditWithRow('row[1]:createIcon(dynamic_icon, { height = 10 })'), 'unresolved');
      add('createIcon dynamic affectRowHeight', kind, auditWithRow(template.replace('OPTIONS', '{ height = 10, affectRowHeight = dynamic_affect }')), 'unresolved');
    }
    add(kind + ' missing cell', kind, auditWithRow(template.replace('row[1]', 'row[9]').replace('OPTIONS', '{ height = 10 }')), 'unresolved');
    add(kind + ' rejected height', kind, auditWithRow(template.replace('OPTIONS', '{ height = -1 }')), 'rejected');
  }

  for (const kind of ['setText', 'setText2'] as const) {
    const receiver = 'row[1]:createButton({ height = 10 })';
    add(kind + ' dynamic options', kind, auditWithRow('row[1]:' + kind + '("value", dynamic_options)', receiver), 'unresolved');
    add(kind + ' dynamic content', kind, auditWithRow('row[1]:' + kind + '(dynamic_text, {})', receiver), 'unresolved');
    for (const [field, value] of [
      ['font', 'dynamic_font'],
      ['fontsize', 'dynamic_size'],
      ['halign', 'dynamic_align'],
      ['x', 'dynamic_x'],
      ['y', 'dynamic_y'],
      ['scaling', 'dynamic_scaling'],
      ['color', 'dynamic_color'],
    ] as const) {
      add(kind + ' dynamic ' + field, kind, auditWithRow('row[1]:' + kind + '("value", { ' + field + ' = ' + value + ' })', receiver), 'unresolved');
    }
    add(kind + ' missing cell', kind, auditWithRow('row[9]:' + kind + '("value", {})', receiver), 'unresolved');
  }

  for (const kind of ['scaleX', 'scaleY'] as const) {
    add(kind + ' dynamic input', kind, auditWithRow('Helper.' + kind + '(dynamic_value, false)'), 'unresolved');
    add(kind + ' dynamic enabled', kind, auditWithRow('Helper.' + kind + '(12, dynamic_enabled)'), 'unresolved');
    add(kind + ' non-helper', kind, auditWithRow('Other.' + kind + '(12, false)'), 'unresolved');
  }
  add('scaleFont dynamic font', 'scaleFont', auditWithRow('Helper.scaleFont(dynamic_font, 12, false)'), 'unresolved');
  add('scaleFont dynamic size', 'scaleFont', auditWithRow('Helper.scaleFont("Zekton", dynamic_size, false)'), 'unresolved');
  add('scaleFont dynamic enabled', 'scaleFont', auditWithRow('Helper.scaleFont("Zekton", 12, dynamic_enabled)'), 'unresolved');
  add('scaleFont non-helper', 'scaleFont', auditWithRow('Other.scaleFont("Zekton", 12, false)'), 'unresolved');
  add('display missing owner', 'display', auditWithRow('missing_frame:display()'), 'unresolved');
  add('OpenMenu dynamic', 'OpenMenu', auditWithRow('OpenMenu(dynamic_menu)'), 'unresolved');

  assert(matrix.length === 122, 'the exact audit matrix must generate 122 candidates, got ' + matrix.length);
  const expectedRetained = matrix.filter(candidate => !candidate.discarded);
  assert(expectedRetained.length === 121, 'the exact audit matrix must retain 121 candidates');
  const expectedByKind: Record<string, number> = {};
  for (const candidate of expectedRetained) expectedByKind[candidate.kind] = (expectedByKind[candidate.kind] || 0) + 1;
  assert(JSON.stringify(expectedByKind) === JSON.stringify(expectedCounts), 'the exact retained per-kind inventory must match the audit counts: ' + JSON.stringify(expectedByKind));

  const observedCounts: Record<string, number> = {};
  const observedStatuses: Record<string, number> = {};
  const failures: string[] = [];
  let discardedCount = 0;
  let unresolved = 0;
  let rejected = 0;
  for (let index = 0; index < matrix.length; index += 1) {
    const candidate = matrix[index];
    const projected = rawProjectionFor(candidate.sourceText, 'selftest/raw-audit-matrix-' + index + '.lua');
    if (!projected.program || !projected.profile || projected.result === undefined || !('program' in projected.result)) {
      failures.push(candidate.label + ': producer did not return a successful wrapper');
      continue;
    }
    const matching = projected.program.operations.filter(operationNode =>
      operationNode.kind === candidate.kind && operationNode.status === candidate.expectedStatus,
    );
    const operationNode = matching[matching.length - 1];
    if (!operationNode) {
      failures.push(candidate.label + ': expected ' + candidate.expectedStatus + ' operation was not produced');
      continue;
    }
    if (candidate.discarded) {
      discardedCount += 1;
      if (operationNode.status !== 'applied') failures.push(candidate.label + ': discarded branch was not applied');
      const discardedScene = buildX4UiScene(projected.result as X4UiLayoutProgramResult, corpus, projected.profile);
      if (refusalHasNoScene(discardedScene)) failures.push(candidate.label + ': discarded producer result refused at scene boundary');
      continue;
    }
    observedCounts[candidate.kind] = (observedCounts[candidate.kind] || 0) + 1;
    observedStatuses[operationNode.status] = (observedStatuses[operationNode.status] || 0) + 1;
    if (operationNode.status === 'unresolved') unresolved += 1;
    if (operationNode.status === 'rejected') rejected += 1;
    const sceneResult = buildX4UiScene(projected.result as X4UiLayoutProgramResult, corpus, projected.profile);
    if (refusalHasNoScene(sceneResult)) failures.push(candidate.label + ': intact producer result refused at scene boundary ' + JSON.stringify({
      scene: sceneResult,
      programStatus: projected.program.status,
      operation: operationNode,
      linkedGaps: projected.program.gaps.filter(gap => gap.operationId === operationNode.id),
      rows: projected.program.rows.map(row => ({ id: row.id, status: row.status, tableId: row.tableId, rowIndex: row.rowIndex, cellIds: row.cellIds, operationIds: row.operationIds })),
      cells: projected.program.cells.map(cell => ({ id: cell.id, status: cell.status, tableId: cell.tableId, rowId: cell.rowId, column: cell.column, operationIds: cell.operationIds })),
      tables: projected.program.tables.map(table => ({ id: table.id, status: table.status, frameId: table.frameId, rowIds: table.rowIds, operationIds: table.operationIds })),
    }));
  }
  assert(discardedCount === 1, 'the audit matrix must discard only dynamic interactive addRow, got ' + discardedCount);
  assert(unresolved === 110 && rejected === 11, 'the exact audit status census must be 110 unresolved/11 rejected, got ' + JSON.stringify(observedStatuses) + '; failures=' + failures.join('; '));
  assert(JSON.stringify(observedCounts) === JSON.stringify(expectedCounts), 'observed per-kind retained counts mismatch: ' + JSON.stringify(observedCounts));
  assert(failures.length === 0, 'exact raw audit matrix failures: ' + failures.join('; '));
});

test('is deterministic, JSON serializable, deeply frozen, and non-mutating', () => {
  const fixture = makeFixture();
  const beforeProgram = JSON.stringify(fixture.program);
  const beforeProfile = JSON.stringify(fixture.profile);
  const beforeBytes = Array.from(fixture.assets.Zekton.atlas.alphaBytes);
  const beforeBoldBytes = Array.from(fixture.assets['Zekton Bold'].atlas.alphaBytes);
  const first = sceneOf(sceneFor(fixture));
  const second = sceneOf(sceneFor(fixture));
  assert(JSON.stringify(first) === JSON.stringify(second), 'replayed projection must be deterministic');
  assert(JSON.stringify(first).includes('Not verified in game'), 'serialized scene must carry permanent game truth');
  assert(isDeepFrozen(first), 'scene output must be deeply frozen');
  assert(JSON.stringify(fixture.program) === beforeProgram, 'program input must not mutate');
  assert(JSON.stringify(fixture.profile) === beforeProfile, 'scene profile input must not mutate');
  assert(JSON.stringify(Array.from(fixture.assets.Zekton.atlas.alphaBytes)) === JSON.stringify(beforeBytes), 'font bytes must not mutate');
  assert(JSON.stringify(Array.from(fixture.assets['Zekton Bold'].atlas.alphaBytes)) === JSON.stringify(beforeBoldBytes), 'bold font bytes must not mutate');
  const ids = [...first.frames, ...first.tables, ...first.rows, ...first.cells, ...first.widgets, ...first.texts, ...first.glyphs].map(node => node.id);
  assert(new Set(ids).size === ids.length, 'scene node IDs must be unique');
  const byId = new Map([...first.frames, ...first.tables, ...first.rows, ...first.cells, ...first.widgets, ...first.texts, ...first.glyphs].map(node => [node.id, node]));
  for (const node of byId.values()) {
    if (node.parentId !== undefined) assert(byId.has(node.parentId) && node.parentId !== node.id, `${node.id} must have a distinct existing parent`);
  }
  for (const widget of first.widgets) {
    assert(widget.textIds.every(id => byId.get(id)?.parentId === widget.id), `${widget.id} text children must point back to the widget`);
  }
  for (const text of first.texts) {
    assert(text.lines.every(line => line.glyphIds.every(id => byId.get(id)?.parentId === text.id)), `${text.id} glyph children must point back to the text node`);
  }
});

test('B119 repaired: portable consumer-aware MENU/HUB/COMM owner shapes cross Scene', () => {
  const configuredSourceHashes = Object.freeze({
    MENU: '4253D9BD9DE4113D4DE0B881DBF5A1E90CAA7B30F735BA925403EBEF7EC47DD7',
    HUB: '657476EAD08229977E1F2A69079FFDCAB56D908B72AF5C87BD4F4734DCCB8C4F',
    COMM: '88FAB05A79EF33CB28E098081EA6A5E29E8F3B7C4150C39BF38913C51C063511',
  });
  const configuredSessionReceiptConstants = Object.freeze([
    { label: 'MENU', sourceSha256: configuredSourceHashes.MENU, samples: 14, consumed: 9, notConsumed: 5, operations: 66, appliedOperations: 27, cells: 88, gaps: 97 },
    { label: 'HUB', sourceSha256: configuredSourceHashes.HUB, samples: 9, consumed: 7, notConsumed: 2, operations: 18, appliedOperations: 11, cells: 4, gaps: 16 },
    { label: 'COMM', sourceSha256: configuredSourceHashes.COMM, samples: 3, consumed: 3, notConsumed: 0, operations: 14, appliedOperations: 12, cells: 3, gaps: 11 },
  ] as const);
  assert(configuredSessionReceiptConstants.length === 3 && configuredSessionReceiptConstants.every(entry => /^[A-F0-9]{64}$/.test(entry.sourceSha256)), 'B119 configured source receipt constants must retain all three source hashes');
  console.log(`B119 configured-session receipt constants only: ${JSON.stringify(configuredSessionReceiptConstants)}`);
  const baseProfile = rawProducerProjection.program?.profile;
  assert(baseProfile !== undefined, 'B119 real-shape fixtures require the producer profile');
  const sampleFor = (program: X4UiLayoutProgram) => ({
    catalogId: program.sampleCatalog.id,
    source: program.sampleCatalog.sourceIdentity,
    values: program.sampleCatalog.entries.map(entry => ({
      id: entry.id,
      value: entry.expectedType === 'boolean'
        ? false
        : entry.expectedType === 'string'
          ? 'sampled'
          : entry.expression === 'runtimeViewWidth'
            ? 1920
            : entry.expression === 'runtimeViewHeight'
              ? 1080
              : entry.expression === 'runtimeColumns'
                ? 12
                : entry.expression === 'runtimeHeight'
                  ? 10
                : entry.expression === 'runtimeSpan' || entry.expression === '_readSpan'
                  ? 6
                  : 80,
    })),
  });
  const issue = (label: string, sourceText: string, targetName: string, dimensions = { width: 100, height: 80 }) => {
    const model = buildX4UiCallModel({ rel: `selftest/b119-${label.toLowerCase()}.lua`, text: sourceText, sourcePath: `selftest/b119-${label.toLowerCase()}.lua` });
    const target = createX4UiLayoutTargetCatalog(model).targets.find(candidate => candidate.name === targetName);
    assert(target !== undefined, `${label} source must expose ${targetName}`);
    const profile = {
      ...baseProfile,
      frame: dimensions,
      helper: {
        ...baseProfile.helper,
        constants: {
          ...baseProfile.helper.constants,
          viewWidth: { value: dimensions.width, source: pin(707) },
          viewHeight: { value: dimensions.height, source: pin(708) },
        },
      },
      source: target.sourceIdentity,
      localExpansion: { maxDepth: 3, maxInvocations: 4 },
    } as Parameters<typeof projectX4UiLayoutProgram>[2];
    const unsampled = projectX4UiLayoutProgram(model, target, profile);
    assert('program' in unsampled && unsampled.program !== undefined, `${label} unsampled producer must issue a program: ${JSON.stringify(unsampled)}`);
    const sampled = projectX4UiLayoutProgram(model, target, profile, sampleFor(unsampled.program));
    assert('program' in sampled && sampled.program !== undefined && 'evidenceAuthority' in sampled && sampled.evidenceAuthority !== undefined, `${label} sampled producer must issue an authority pair`);
    assert(validateX4UiLayoutEvidencePair(sampled.program, sampled.evidenceAuthority).valid, `${label} sampled producer pair must validate before Scene`);
    const profileForScene: X4UiSceneProfile = Object.freeze({
      id: `b119-${label.toLowerCase()}`,
      provenance: 'B119 consumer-aware source-shaped Scene fail-first fixture',
      source: sampled.program.profile.source,
      helper: { sourcePath: HELPER_PATH, sha256: X4_LAYOUT_PROVENANCE.helperSha256 },
      widget: { sourcePath: WIDGET_PATH, sha256: X4_LAYOUT_PROVENANCE.widgetSha256 },
      fonts: sceneProfile.fonts,
      drawable: { width: sampled.program.profile.frame.width, height: sampled.program.profile.frame.height },
      textPolicy: sceneProfile.textPolicy,
    });
    return { sampled: sampled as X4UiLayoutProgramResult, authority: sampled.evidenceAuthority, program: sampled.program, profile: profileForScene };
  };
  const menu = issue('MENU', [
    'local menu = { name = "B119MenuOwner", layer = 1 }',
    'function menu.display(tableWidth, margin, dynamicText)',
    '  local frame = Helper.createFrameHandle(menu, { width = runtimeViewWidth, height = runtimeViewHeight })',
    '  local tt = frame:addTable(4, { width = 80, reserveScrollBar = false, scaling = true })',
    '  local row = tt:addRow(true, {})',
    '  local function turnRow(frameHandle, text)',
    '    local ht = frameHandle:addTable(4, { width = 80, reserveScrollBar = false, scaling = true })',
    '    row = ht:addRow(false, {})',
    '  end',
    '  turnRow(frame, dynamicText)',
    '  local ct = frame:addTable(runtimeColumns, { width = tableWidth - margin * 2, reserveScrollBar = runtimeReserve, scaling = runtimeScaling })',
    '  if pend then',
    '    row = ct:addRow(false, {})',
    '    row[1]:setColSpan(7):createText(dynamicText, { height = runtimeHeight })',
    '    row[8]:setColSpan(5):createText(dynamicText, { height = runtimeHeight })',
    '  end',
    '  row = ct:addRow(false, {})',
    'end',
  ].join('\n'), 'menu.display');
  const hub = issue('HUB', [
    'local menu = { name = "B119HubOwner", layer = 1 }',
    'local TABS = { "one", "two", "three" }',
    'function menu.display()',
    '  local frame = Helper.createFrameHandle(menu, { width = runtimeViewWidth, height = runtimeViewHeight })',
    '  local st = frame:addTable(runtimeColumns, { width = runtimeWidth, reserveScrollBar = false, scaling = true })',
    '  local sr = st:addRow(false, {})',
    '  sr[1]:createButton({ active = true })',
    '  sr[2]:createButton({ active = true })',
    '  sr[3]:createButton({ active = true })',
    '  for i, tab in ipairs(TABS) do',
    '    sr[i]:createButton({ active = true })',
    '  end',
    'end',
  ].join('\n'), 'menu.display');
  const comm = issue('COMM', [
    'local menu = { name = "B119CommOwner", layer = 1 }',
    'function menu.display()',
    '  local frame = Helper.createFrameHandle(menu, { width = runtimeViewWidth, height = runtimeViewHeight })',
    '  local ct = frame:addTable(12, { width = runtimeWidth, reserveScrollBar = false, scaling = true })',
    '  local row = ct:addRow(true, {})',
    '  row[1]:setColSpan(_readSpan):createEditBox({ height = 25, defaultText = dynamicText, maxChars = 2000 })',
    '  row[11]:setColSpan(2):createButton({ active = true }):setText(dynamicText, {})',
    'end',
  ].join('\n'), 'menu.display');
  const candidates = [menu, hub, comm];
  const expectedShape = {
    MENU: { operations: 12, applied: 7, frames: 1, tables: 3, rows: 4, cells: 32, gaps: 10 },
    HUB: { operations: 7, applied: 6, frames: 1, tables: 1, rows: 1, cells: 12, gaps: 3 },
    COMM: { operations: 8, applied: 8, frames: 1, tables: 1, rows: 1, cells: 12, gaps: 0 },
  } as const;
  const positive = candidates.map(candidate => buildX4UiScene(candidate.sampled, corpus, candidate.profile));
  const cases: ReadonlyArray<readonly [keyof typeof expectedShape, typeof menu, X4UiSceneResult]> = [
    ['MENU', menu, positive[0]],
    ['HUB', hub, positive[1]],
    ['COMM', comm, positive[2]],
  ];
  for (const [label, candidate, result] of cases) {
    assert(candidate.program.cells.length > 0, `${label} fixture must retain materialized cells`);
    assert(candidate.program.operations.some(operation => operation.kernel !== undefined), `${label} fixture must retain kernel transitions`);
    const shape = expectedShape[label];
    const observedShape = {
      operations: candidate.program.operations.length,
      applied: candidate.program.operations.filter(operation => operation.status === 'applied').length,
      frames: candidate.program.frames.length,
      tables: candidate.program.tables.length,
      rows: candidate.program.rows.length,
      cells: candidate.program.cells.length,
      gaps: candidate.program.gaps.length,
    };
    assert(JSON.stringify(observedShape) === JSON.stringify(shape), `${label} consumer-aware fixture shape changed: ${JSON.stringify({ expected: shape, observed: observedShape })}`);
    assert(result.status !== 'refused', `${label} consumer-aware owner shape still refused: ${JSON.stringify(result)}`);
    assert(result.scene.gameTruth === 'Not verified in game' && result.scene.verification.gameVerified === false && result.verification.gameVerified === false, `${label} Scene must remain preview-only and not game-verified`);
    assert(diagnoseX4UiSceneStructureForTest(candidate.program, candidate.authority) === undefined, `${label} repaired structure must have no diagnostic stage`);
    console.log(`B119 portable owner fixture ${label}: ${JSON.stringify({ layoutShape: observedShape, sceneStatus: result.status, sceneGeometry: { frames: result.scene.frames.length, tables: result.scene.tables.length, rows: result.scene.rows.length, cells: result.scene.cells.length, widgets: result.scene.widgets.length, texts: result.scene.texts.length, glyphs: result.scene.glyphs.length, gaps: result.scene.gaps.length, drawable: result.scene.drawableRect }, gameVerified: result.verification.gameVerified })}`);
  }
  const runHostile = (
    label: string,
    candidate: typeof menu,
    mutate: (program: X4UiLayoutProgram) => void,
    expectedDiagnostic?: string,
  ): void => {
    const hostileProgram = cloneProgram(candidate.program);
    mutate(hostileProgram);
    const authority = synchronizedAuthority(candidate.authority, hostileProgram);
    let pairValid = false;
    try {
      pairValid = validateX4UiLayoutEvidencePair(hostileProgram, authority).valid;
    } catch {
      pairValid = false;
    }
    freezeFixtureGraph(hostileProgram);
    freezeFixtureGraph(authority);
    const result = buildX4UiScene({ ...candidate.sampled, program: hostileProgram, evidenceAuthority: authority } as X4UiLayoutProgramResult, corpus, candidate.profile);
    assert(result.status === 'refused', `${label} one-field hostile mutation escaped Scene refusal: ${JSON.stringify({ pairValid, result })}`);
    if (expectedDiagnostic !== undefined) assert(diagnoseX4UiSceneStructureForTest(hostileProgram, authority) === expectedDiagnostic, `${label} hostile diagnostic changed: ${diagnoseX4UiSceneStructureForTest(hostileProgram, authority)}`);
  };
  runHostile('kernel frame width', menu, program => {
    const table = program.tables.find(candidate => candidate.kernelState !== undefined);
    assert(table?.kernelState !== undefined, 'MENU hostile kernel mutation requires a materialized table');
    (table.kernelState as unknown as { frameWidth: number }).frameWidth += 1;
  }, `table-kernel-frame-width:${menu.program.tables.find(candidate => candidate.kernelState !== undefined)?.id}`);
  runHostile('reciprocal table owner', hub, program => {
    const table = program.tables.find(candidate => candidate.kernelState !== undefined);
    assert(table !== undefined, 'HUB hostile owner mutation requires a materialized table');
    (table as unknown as { frameId: string }).frameId = `${table.frameId ?? table.id}:forged`;
  });
  runHostile('operation ledger', comm, program => {
    const table = program.tables.find(candidate => candidate.kernelState !== undefined);
    assert(table !== undefined && table.operationIds.length > 0, 'COMM hostile ledger mutation requires an operation ledger');
    (table.operationIds as string[]).pop();
  });
  runHostile('source owner', menu, program => {
    const table = program.tables.find(candidate => candidate.kernelState !== undefined);
    assert(table !== undefined, 'MENU hostile source mutation requires a materialized table');
    const source = table.source;
    (table as unknown as { source: X4UiSceneSourceLocation }).source = { ...source, start: { ...source.start, offset: source.start.offset + 1 } };
  });
});

const b119OuterHeightPortableSources = Object.freeze({
  MENU: [
    'local menu = { name = "B119PortableMenu", layer = 4 }',
    'local frame = Helper.createFrameHandle(menu, { width = 1920, height = 1080 })',
    'local tt = frame:addTable(4, { width = 787, reserveScrollBar = false, scaling = true })',
    'tt:setColWidthPercent(1, 60)',
    'tt:setColWidthPercent(2, 15)',
    'tt:setColWidthPercent(3, 14)',
    'tt:setColWidthPercent(4, 11)',
    'local row = tt:addRow(true, {})',
    'row[1]:createText(dynamicText, { color = dynamicColor })',
    'row[2]:createButton({ active = true }):setText("EXPAND", { halign = "center" })',
    'row[3]:createButton({ active = true }):setText("DOSSIER", { halign = "center" })',
    'row[4]:createButton({ active = true }):setText("END", { halign = "center" })',
    'frame:display()',
  ].join('\n'),
  HUB: [
    'local menu = { name = "B119PortableHub", layer = 4 }',
    'local frame = Helper.createFrameHandle(menu, { width = 1920, height = 1080 })',
    'local tt = frame:addTable(2, { width = 1866, reserveScrollBar = false, scaling = true })',
    'tt:setColWidthPercent(1, 84)',
    'tt:setColWidthPercent(2, 16)',
    'local row = tt:addRow(true, {})',
    'row[1]:createText("AI INFLUENCE", { color = dynamicColor, fontsize = dynamicFont })',
    'row[2]:createButton({ active = true }):setText("CLOSE", { halign = "center" })',
    'local st = frame:addTable(2, { width = 1866, reserveScrollBar = false, scaling = true })',
    'local sr = st:addRow(true, {})',
    'sr[1]:createButton({ active = true }):setText("DOSSIER", { halign = "center" })',
    'sr[2]:createButton({ active = true }):setText("SYSTEMS", { halign = "center" })',
    'frame:display()',
  ].join('\n'),
  COMM: [
    'local menu = { name = "B119PortableComm", layer = 4 }',
    'local frame = Helper.createFrameHandle(menu, { width = 1920, height = 1080 })',
    'local tt = frame:addTable(3, { width = 1866, reserveScrollBar = false, scaling = true })',
    'tt:setColWidthPercent(1, 70)',
    'tt:setColWidthPercent(2, 15)',
    'tt:setColWidthPercent(3, 15)',
    'local row = tt:addRow(true, {})',
    'row[1]:createText(dynamicText, { color = dynamicColor, fontsize = dynamicFont })',
    'row[2]:createButton({ active = true }):setText("DOSSIER", { halign = "center" })',
    'row[3]:createButton({ active = true }):setText("END", { halign = "center" })',
    'frame:display()',
  ].join('\n'),
});

const b119OuterHeightPortableProjection = (label: string, sourceText: string) => rawProjectionFor(
  sourceText,
  `selftest/b119-outer-height-${label.toLowerCase()}.lua`,
  profile => ({
    ...profile,
    defaults: {
      standardButtonHeight: profile.defaults.standardButtonHeight,
    },
  } as Parameters<typeof projectX4UiLayoutProgram>[2]),
);

for (const [label, sourceText] of Object.entries(b119OuterHeightPortableSources)) {
  test(`B119 fail-first: ${label} portable unavailable text height crosses Scene structure`, () => {
    const projected = b119OuterHeightPortableProjection(label, sourceText);
    assert(projected.program !== undefined && projected.profile !== undefined && 'program' in projected.result && projected.result.program !== undefined && 'evidenceAuthority' in projected.result && projected.result.evidenceAuthority !== undefined, `${label} portable fixture must issue a producer authority pair`);
    const authority = projected.result.evidenceAuthority;
    assert(validateX4UiLayoutEvidencePair(projected.program, authority).valid, `${label} portable producer authority pair must validate before Scene`);
    const table = projected.program.tables.find(candidate => candidate.kernelState?.rows.some(row => row.cells.some(cell => cell.type === 'text' && cell.height === 0 && cell.minTextHeight === undefined)));
    const row = table === undefined ? undefined : projected.program.rows.find(candidate => candidate.tableId === table.id && candidate.rowIndex !== undefined);
    const cell = row === undefined ? undefined : projected.program.cells.find(candidate => candidate.rowId === row.id && candidate.column === 1);
    assert(table?.kernelState !== undefined && row?.rowIndex !== undefined && cell?.kernelState !== undefined, `${label} portable fixture must materialize the failing owner slot`);
    const kernelCell = table.kernelState.rows[row.rowIndex - 1].cells[cell.column - 1];
    const expected = getCellHeight(table.kernelState, row.rowIndex, cell.column);
    const creator = projected.program.operations
      .filter(operation => operation.cellId === cell.id && operation.kind === 'createText')
      .sort((left, right) => left.modelOrder - right.modelOrder)
      .at(-1);
    const outerHeight = cell.descriptorFacts.outerHeight;
    const stage = diagnoseX4UiSceneStructureForTest(projected.program, authority);
    const currentKnownMatch = outerHeight === undefined || outerHeight.status !== 'known'
      ? true
      : expected.status === 'ok' && outerHeight.expectedType === 'number' && outerHeight.value === expected.value;
    const receipt = {
      cellId: cell.id,
      source: cell.source,
      contentKind: cell.descriptorFacts.contentKind,
      status: cell.status,
      tableId: cell.tableId,
      rowId: cell.rowId,
      rowIndex: cell.rowIndex,
      column: cell.column,
      cellHeight: cell.height,
      outerHeight: {
        status: outerHeight?.status ?? null,
        value: outerHeight?.status === 'known' ? outerHeight.value : null,
        provenance: outerHeight?.status === 'known' ? outerHeight.provenance : null,
        expression: outerHeight?.expression ?? null,
        source: outerHeight?.source ?? null,
        sourcePin: outerHeight?.sourcePin ?? null,
        reason: outerHeight?.status === 'unavailable' ? outerHeight.reason : null,
      },
      kernel: {
        type: kernelCell.type,
        height: kernelCell.height,
        scaling: kernelCell.scaling,
        affectRowHeight: kernelCell.affectRowHeight,
        y: kernelCell.y,
        minTextHeight: kernelCell.minTextHeight ?? null,
        colspan: kernelCell.colspan,
      },
      expected,
      creator: creator === undefined ? null : {
        kind: creator.kind,
        status: creator.status,
        source: creator.source,
        explicitHeightFact: creator.descriptorFacts.height ?? null,
        outerHeightFact: creator.descriptorFacts.outerHeight ?? null,
      },
      currentKnownMatch,
      currentFailureReason: expected.status !== 'ok' && currentKnownMatch
        ? 'expected Helper getCellHeight is unavailable and validateProgramStructure rejects it before accepting the matching unavailable descriptor fact'
        : 'known descriptor fact differs from the Helper result',
    };
    console.log(`B119 cell-outer-height portable fixture ${label}: ${JSON.stringify({ stage, receipt })}`);
    assert(expected.status === 'unsupported' && expected.code === 'missing-min-text-height', `${label} portable fixture must reproduce Helper missing-min-text-height`);
    assert(outerHeight?.status === 'unavailable', `${label} portable fixture must preserve unavailable outerHeight evidence`);
    assert(stage === undefined, `${label} authority-valid portable fixture refused at ${stage}: ${JSON.stringify(receipt)}`);
  });
}

test('B119 missing-min-text-height requires the exact producer-emitted cell height shape', () => {
  const projected = b119OuterHeightPortableProjection('height-shape', b119OuterHeightPortableSources.COMM);
  assert(projected.program !== undefined && projected.profile !== undefined && 'program' in projected.result && projected.result.program !== undefined && 'evidenceAuthority' in projected.result && projected.result.evidenceAuthority !== undefined, 'cell-height shape fixture must issue a producer authority pair');
  const sourceCell = projected.program.cells.find(candidate => candidate.kernelState?.type === 'text'
    && candidate.kernelState.height === 0
    && candidate.kernelState.minTextHeight === undefined
    && candidate.height?.status === 'unavailable');
  assert(sourceCell?.rowIndex !== undefined && sourceCell.tableId !== undefined, 'cell-height shape fixture must retain the unavailable text owner slot');
  const sourceTable = projected.program.tables.find(candidate => candidate.id === sourceCell.tableId);
  assert(sourceTable?.kernelState !== undefined, 'cell-height shape fixture must retain its owning kernel table');
  const expectedFailure = getCellHeight(sourceTable.kernelState, sourceCell.rowIndex, sourceCell.column);
  assert(expectedFailure.status === 'unsupported' && expectedFailure.code === 'missing-min-text-height', 'cell-height shape fixture must retain the exact Helper failure');
  assert(JSON.stringify(sourceCell.height) === JSON.stringify({ status: 'unavailable' }), 'producer control must emit the exact unavailable cell-height record');
  assert(validateX4UiLayoutEvidencePair(projected.program, projected.result.evidenceAuthority).valid, 'exact unavailable cell-height control must remain authority-valid');
  assert(diagnoseX4UiSceneStructureForTest(projected.program, projected.result.evidenceAuthority) === undefined, 'exact unavailable cell-height control must cross Scene structure');
  assert(!refusalHasNoScene(buildX4UiScene(projected.result, corpus, projected.profile)), 'exact unavailable cell-height control must retain a Scene');

  const refusalProgram = cloneProgram(projected.program);
  const refusalCell = refusalProgram.cells.find(candidate => candidate.id === sourceCell.id)!;
  (refusalCell as unknown as { height: unknown }).height = { status: 'unavailable', refusal: cloneJsonValue(expectedFailure) };
  const refusalAuthority = synchronizedAuthority(projected.result.evidenceAuthority, refusalProgram);
  freezeFixtureGraph(refusalProgram);
  freezeFixtureGraph(refusalAuthority);
  const refusalPair = validateX4UiLayoutEvidencePair(refusalProgram, refusalAuthority);
  assert(refusalPair.valid, `synchronized unavailable/refusal cell-height hostile must remain producer-pair valid: ${JSON.stringify(refusalPair)}`);
  const expectedStage = `cell-outer-height:${sourceCell.id}`;
  const refusalStage = diagnoseX4UiSceneStructureForTest(refusalProgram, refusalAuthority);
  const refusalResult = buildX4UiScene({ ...projected.result, program: refusalProgram, evidenceAuthority: refusalAuthority } as X4UiLayoutProgramResult, corpus, projected.profile);
  assert(refusalStage === expectedStage && refusalHasNoScene(refusalResult), `synchronized unavailable/refusal cell-height hostile escaped Scene: ${JSON.stringify({ expectedStage, refusalStage, refusalResult })}`);

  const valueProgram = cloneProgram(projected.program);
  const valueCell = valueProgram.cells.find(candidate => candidate.id === sourceCell.id)!;
  (valueCell as unknown as { height: unknown }).height = { status: 'unavailable', value: 0 };
  const valueAuthority = synchronizedAuthority(projected.result.evidenceAuthority, valueProgram);
  const valuePair = validateX4UiLayoutEvidencePair(valueProgram, valueAuthority);
  assert(!valuePair.valid, `unavailable cell-height with an extra value must fail producer schema: ${JSON.stringify(valuePair)}`);

  const knownProgram = cloneProgram(projected.program);
  const knownCell = knownProgram.cells.find(candidate => candidate.id === sourceCell.id)!;
  (knownCell as unknown as { height: unknown }).height = { status: 'known', value: 0 };
  const knownAuthority = synchronizedAuthority(projected.result.evidenceAuthority, knownProgram);
  freezeFixtureGraph(knownProgram);
  freezeFixtureGraph(knownAuthority);
  const knownPair = validateX4UiLayoutEvidencePair(knownProgram, knownAuthority);
  assert(knownPair.valid, `known/value cell-height drift must remain producer-pair valid: ${JSON.stringify(knownPair)}`);
  const knownResult = buildX4UiScene({ ...projected.result, program: knownProgram, evidenceAuthority: knownAuthority } as X4UiLayoutProgramResult, corpus, projected.profile);
  assert(diagnoseX4UiSceneStructureForTest(knownProgram, knownAuthority) === expectedStage && refusalHasNoScene(knownResult), 'known/value cell-height drift must refuse at the independent Scene relation');
});

test('B119 direct Helper scale aliases cross the Scene structure boundary', () => {
  const projected = rawProjectionFor([
    'local menu = { name = "DirectHelperScale", layer = 1 }',
    'local width = Helper.scaleX(530)',
    'local height = Helper.scaleY(436)',
    'local frame = Helper.createFrameHandle(menu, { width = width, height = height })',
    'local table = frame:addTable(1, { width = 100, reserveScrollBar = false, scaling = false })',
    'table:setColWidth(1, 100, false)',
    'local row = table:addRow(false, {})',
    'row[1]:createText("direct scale", { height = 12, minRowHeight = 10 })',
    'frame:display()',
  ].join('\n'), 'selftest/b119-direct-helper-scale.lua');
  assert(projected.program !== undefined && projected.profile !== undefined && projected.result !== undefined && 'program' in projected.result && projected.result.program !== undefined && 'evidenceAuthority' in projected.result && projected.result.evidenceAuthority !== undefined, 'direct Helper scale fixture must issue a producer authority pair');
  const result = projected.result as X4UiLayoutProgramResult;
  const authority = producerAuthority(result);
  const pair = validateX4UiLayoutEvidencePair(projected.program, authority);
  const frameOperation = projected.program.operations.find(operationNode => operationNode.kind === 'createFrameHandle');
  const stage = diagnoseX4UiSceneStructureForTest(projected.program, authority);
  console.log(`B119 direct Helper scale fail-first receipt: ${JSON.stringify({ pairValid: pair.valid, stage, frameOperation: frameOperation?.id, source: frameOperation?.source })}`);
  assert(pair.valid, `direct Helper scale producer/evidence pair must validate: ${JSON.stringify(pair)}`);
  assert(stage === undefined, `direct Helper scale fixture refused at Scene structure stage ${String(stage)} for ${frameOperation?.id}`);
  const sceneResult = buildX4UiScene(result, corpus, projected.profile);
  assert(sceneResult.status !== 'refused', `direct Helper scale fixture must cross Scene: ${JSON.stringify(sceneResult)}`);
  assert(sceneResult.scene.gameTruth === 'Not verified in game' && sceneResult.verification.gameVerified === false, 'direct Helper scale fixture must remain Not verified in game');
});

test('B119 exact source formula crosses the existing Scene consumer with a finite frame rect', () => {
  const projected = rawProjectionFor([
    'local menu = { name = "B119ExactFormula", layer = 1 }',
    'local width = Helper.scaleX(530)',
    'local height = Helper.scaleY(436)',
    'local x = ((Helper.viewWidth or 1920) - width) / 2',
    'local y = ((Helper.viewHeight or 1080) - height) / 2',
    'local frame = Helper.createFrameHandle(menu, { x = x, y = y, width = width, height = height })',
    'local table = frame:addTable(1, { width = 100, reserveScrollBar = false, scaling = false })',
    'table:setColWidth(1, 100, false)',
    'local row = table:addRow(false, {})',
    'row[1]:createText("exact formula", { height = 12, minRowHeight = 10 })',
    'frame:display()',
  ].join('\n'), 'selftest/b119-exact-formula-scene.lua', profile => ({
    ...profile,
    id: 'b119-exact-formula-scene-profile',
    frame: { width: 1920, height: 1080 },
    helper: {
      ...profile.helper,
      constants: {
        ...profile.helper.constants,
        viewWidth: { value: 1920, source: pin(707) },
        viewHeight: { value: 1080, source: pin(708) },
      },
    },
  }));
  assert(projected.program !== undefined && projected.profile !== undefined && projected.result !== undefined && 'program' in projected.result && projected.result.program !== undefined && 'evidenceAuthority' in projected.result && projected.result.evidenceAuthority !== undefined, 'exact formula fixture must issue a producer authority pair');
  const result = projected.result as X4UiLayoutProgramResult;
  const authority = producerAuthority(result);
  const pair = validateX4UiLayoutEvidencePair(projected.program, authority);
  const stage = diagnoseX4UiSceneStructureForTest(projected.program, authority);
  const sceneResult = buildX4UiScene(result, corpus, projected.profile);
  const frameRect = sceneResult.status === 'refused' ? undefined : sceneResult.scene.frames[0]?.rect;
  assert(pair.valid, `exact formula producer/evidence pair must validate: ${JSON.stringify(pair)}`);
  assert(stage === undefined, `exact formula fixture refused at Scene structure stage ${String(stage)}`);
  assert(sceneResult.status !== 'refused' && frameRect !== undefined
    && Number.isFinite(frameRect.x) && Number.isFinite(frameRect.y)
    && Number.isFinite(frameRect.width) && Number.isFinite(frameRect.height)
    && frameRect.x === 695 && frameRect.y === 322
    && frameRect.width === 530 && frameRect.height === 436,
  `exact formula Scene frame rect must be finite and exact: ${JSON.stringify({ status: sceneResult.status, frameRect })}`);
  assert(sceneResult.scene.gameTruth === 'Not verified in game' && sceneResult.verification.gameVerified === false, 'exact formula Scene fixture must remain Not verified in game');
});

test('B119 direct Helper scale calls accept Lua whitespace at the Scene boundary', () => {
  const projected = rawProjectionFor([
    'local menu = { name = "DirectHelperScaleWhitespace", layer = 1 }',
    'local width = Helper.scaleX (530)',
    'local height = Helper.scaleY (436)',
    'local fontSize = Helper.scaleFont ("Zekton", 14, false)',
    'local frame = Helper.createFrameHandle(menu, { width = width, height = height })',
    'local table = frame:addTable(1, { width = 100, reserveScrollBar = false, scaling = false })',
    'table:setColWidth(1, 100, false)',
    'local row = table:addRow(false, {})',
    'row[1]:createText("direct scale", { height = 12, fontsize = fontSize, minRowHeight = 10 })',
    'frame:display()',
  ].join('\n'), 'selftest/b119-direct-helper-scale-whitespace.lua');
  assert(projected.program !== undefined && projected.profile !== undefined && projected.result !== undefined && 'program' in projected.result && projected.result.program !== undefined && 'evidenceAuthority' in projected.result && projected.result.evidenceAuthority !== undefined, 'whitespace direct Helper fixture must issue a producer authority pair');
  const result = projected.result as X4UiLayoutProgramResult;
  const authority = producerAuthority(result);
  const directOperations = projected.program.operations
    .filter(operationNode => ['scaleX', 'scaleY', 'scaleFont'].includes(operationNode.kind))
    .map(operationNode => ({
      kind: operationNode.kind,
      expression: (operationNode.metadata.semantics as unknown as Record<string, unknown>).expression,
      direct: (operationNode.metadata.semantics as unknown as Record<string, unknown>).directHelperScaleResult,
    }));
  const pair = validateX4UiLayoutEvidencePair(projected.program, authority);
  const stage = diagnoseX4UiSceneStructureForTest(projected.program, authority);
  const sceneResult = buildX4UiScene(result, corpus, projected.profile);
  console.log(`B119 direct Helper whitespace fail-first receipt: ${JSON.stringify({ pairValid: pair.valid, stage, directOperations, sceneStatus: sceneResult.status, sceneRefusal: sceneResult.status === 'refused' ? sceneResult.refusal : undefined })}`);
  assert(pair.valid, `whitespace direct Helper producer/evidence pair must validate: ${JSON.stringify(pair)}`);
  assert(stage === undefined, `valid Lua whitespace direct Helper calls refused at Scene structure stage ${String(stage)}: ${JSON.stringify(directOperations)}`);
  assert(sceneResult.status !== 'refused', `valid Lua whitespace direct Helper calls must cross Scene: ${JSON.stringify(sceneResult)}`);
});

test('B119 direct Helper scale metadata remains fail-closed at Scene structure', () => {
  const projected = rawProjectionFor([
    'local menu = { name = "DirectHelperScaleHostile", layer = 1 }',
    'local width = Helper.scaleX(530)',
    'local height = Helper.scaleY(436)',
    'local frame = Helper.createFrameHandle(menu, { width = width, height = height })',
    'local table = frame:addTable(1, { width = 100, reserveScrollBar = false, scaling = false })',
    'table:setColWidth(1, 100, false)',
    'local row = table:addRow(false, {})',
    'row[1]:createText("direct scale", { height = 12, minRowHeight = 10 })',
    'frame:display()',
  ].join('\n'), 'selftest/b119-direct-helper-scale-hostile.lua');
  assert(projected.program !== undefined && projected.profile !== undefined && projected.result !== undefined && 'program' in projected.result && projected.result.program !== undefined && 'evidenceAuthority' in projected.result && projected.result.evidenceAuthority !== undefined, 'hostile direct Helper scale fixture must issue a producer authority pair');
  const result = projected.result as X4UiLayoutProgramResult;
  const sourceAuthority = producerAuthority(result);
  const sourceOperation = projected.program.operations.find(operationNode => operationNode.kind === 'createFrameHandle');
  assert(sourceOperation !== undefined, 'hostile direct Helper scale fixture must expose createFrameHandle');
  const expectedStage = 'operation:' + sourceOperation.id;
  type DirectMutation = (value: Record<string, unknown>, direct: Record<string, unknown>) => void;
  const mutations: ReadonlyArray<readonly [string, DirectMutation]> = [
    ['extra key', (_value, direct) => { direct.extra = true; }],
    ['invalid callName', (_value, direct) => { direct.callName = 'scaleZ'; }],
    ['call source identity mismatch', (_value, direct) => {
      direct.callSource = { ...(direct.callSource as Record<string, unknown>), file: 'forged.lua' };
    }],
    ['binding source order mismatch', (_value, direct) => {
      const callSource = direct.callSource as Record<string, unknown>;
      const callEnd = (callSource.end as Record<string, unknown>).offset as number;
      const bindingSource = direct.bindingSource as Record<string, unknown>;
      direct.bindingSource = {
        ...bindingSource,
        start: { ...(bindingSource.start as Record<string, unknown>), offset: callEnd + 1 },
        end: { ...(bindingSource.end as Record<string, unknown>), offset: callEnd + 2 },
      };
    }],
    ['invalid expression status', (value) => { value.status = 'static'; }],
    ['invalid expression type', (value) => { value.type = 'number'; }],
    ['call expression mismatch', (_value, direct) => { direct.callExpression = 'Other.scaleX(530)'; }],
    ['wrong scale name', (_value, direct) => { direct.callExpression = 'Helper.scaleY(530)'; }],
    ['malformed expression', (_value, direct) => { direct.callExpression = 'Helper.scaleX(530'; }],
    ['trailing expression', (_value, direct) => { direct.callExpression = 'Helper.scaleX(530) + 1'; }],
    ['prototype property', (_value, direct) => { Object.setPrototypeOf(direct, { forged: true }); }],
    ['accessor property', (_value, direct) => {
      Object.defineProperty(direct, 'callName', { configurable: true, enumerable: true, get: () => 'scaleX' });
    }],
  ];
  for (const [label, mutate] of mutations) {
    const program = cloneProgram(projected.program);
    const operation = program.operations.find(operationNode => operationNode.id === sourceOperation.id)!;
    const semantics = operation.metadata.semantics as unknown as Record<string, unknown>;
    const width = semantics.width as Record<string, unknown>;
    const direct = width.directHelperScaleResult as Record<string, unknown>;
    assert(direct !== undefined, label + ' requires directHelperScaleResult');
    mutate(width, direct);
    freezeFixtureGraph(program);
    const stage = diagnoseX4UiSceneStructureForTest(program, sourceAuthority);
    const hostileResult = buildX4UiScene({ ...result, program, evidenceAuthority: sourceAuthority } as X4UiLayoutProgramResult, corpus, projected.profile);
    assert(stage === expectedStage && refusalHasNoScene(hostileResult), label + ' escaped its Scene boundary: ' + JSON.stringify({ expectedStage, stage, result: hostileResult }));
  }
});

test('B119 cell outer-height relation rejects synchronized one-field semantic drift', () => {
  const unavailableProjection = b119OuterHeightPortableProjection('COMM-hostile', b119OuterHeightPortableSources.COMM);
  const knownProjection = rawProjectionFor([
    'local menu = { name = "B119KnownOuterHeight", layer = 4 }',
    'local frame = Helper.createFrameHandle(menu, { width = 1920, height = 1080 })',
    'local table = frame:addTable(1, { width = 320, reserveScrollBar = false, scaling = true })',
    'local row = table:addRow(true, {})',
    'row[1]:createText("known", {})',
    'frame:display()',
  ].join('\n'), 'selftest/b119-known-outer-height-hostile.lua');
  const projections = [unavailableProjection, knownProjection];
  for (const projected of projections) {
    assert(projected.program !== undefined && projected.profile !== undefined && projected.result !== undefined && 'program' in projected.result && 'evidenceAuthority' in projected.result && projected.result.evidenceAuthority !== undefined, 'outer-height hostile fixtures must issue authority pairs');
    assert(validateX4UiLayoutEvidencePair(projected.program, projected.result.evidenceAuthority).valid, 'outer-height hostile fixture authority must start valid');
  }
  const unavailableCell = unavailableProjection.program!.cells.find(cell => cell.kernelState?.type === 'text');
  const knownCell = knownProjection.program!.cells.find(cell => cell.kernelState?.type === 'text');
  assert(unavailableCell !== undefined && knownCell !== undefined, 'outer-height hostile fixtures must expose text cells');
  const unavailableFact = unavailableCell.descriptorFacts.outerHeight;
  const knownFact = knownCell.descriptorFacts.outerHeight;
  assert(unavailableFact?.status === 'unavailable' && knownFact?.status === 'known', 'outer-height hostile fixtures must cover unavailable and known descriptor states');

  const shiftSource = (at: X4UiSceneSourceLocation): X4UiSceneSourceLocation => ({
    ...at,
    start: { ...at.start, column: at.start.column + 1, offset: at.start.offset + 1 },
  });
  const mutations: ReadonlyArray<readonly [
    string,
    typeof unavailableProjection,
    (program: X4UiLayoutProgram) => void,
    string,
    boolean,
  ]> = [
    ['known descriptor value', knownProjection, program => {
      const cell = program.cells.find(candidate => candidate.id === knownCell.id)!;
      const fact = cell.descriptorFacts.outerHeight!;
      assert(fact.status === 'known' && fact.expectedType === 'number' && typeof fact.value === 'number', 'known value hostile requires a known numeric fact');
      (cell.descriptorFacts as Record<string, X4UiLayoutDescriptorFact>).outerHeight = { ...fact, value: fact.value + 1 };
    }, `cell-outer-height:${knownCell.id}`, true],
    ['known descriptor status to unavailable', knownProjection, program => {
      const cell = program.cells.find(candidate => candidate.id === knownCell.id)!;
      (cell.descriptorFacts as Record<string, X4UiLayoutDescriptorFact>).outerHeight = unavailable('number', 'forged unavailable known height', cell.source);
    }, `cell-outer-height:${knownCell.id}`, true],
    ['known descriptor provenance', knownProjection, program => {
      const cell = program.cells.find(candidate => candidate.id === knownCell.id)!;
      const fact = cell.descriptorFacts.outerHeight!;
      assert(fact.status === 'known', 'known provenance hostile requires a known fact');
      (cell.descriptorFacts as Record<string, X4UiLayoutDescriptorFact>).outerHeight = { ...fact, provenance: 'source-literal' };
    }, `cell-outer-height:${knownCell.id}`, true],
    ['known descriptor source', knownProjection, program => {
      const cell = program.cells.find(candidate => candidate.id === knownCell.id)!;
      const fact = cell.descriptorFacts.outerHeight!;
      (cell.descriptorFacts as Record<string, X4UiLayoutDescriptorFact>).outerHeight = { ...fact, source: shiftSource(fact.source) };
    }, `cell-outer-height:${knownCell.id}`, true],
    ['known descriptor source pin', knownProjection, program => {
      const cell = program.cells.find(candidate => candidate.id === knownCell.id)!;
      const fact = cell.descriptorFacts.outerHeight!;
      assert(fact.sourcePin !== undefined, 'known source-pin hostile requires a pinned fact');
      (cell.descriptorFacts as Record<string, X4UiLayoutDescriptorFact>).outerHeight = {
        ...fact,
        sourcePin: { ...fact.sourcePin, lineStart: fact.sourcePin.lineStart + 1 },
      };
    }, `cell-outer-height:${knownCell.id}`, true],
    ['unavailable descriptor status to known', unavailableProjection, program => {
      const cell = program.cells.find(candidate => candidate.id === unavailableCell.id)!;
      const fact = cell.descriptorFacts.outerHeight!;
      (cell.descriptorFacts as Record<string, X4UiLayoutDescriptorFact>).outerHeight = known(0, 'number', fact.source, '0');
    }, `cell-outer-height:${unavailableCell.id}`, true],
    ['unavailable descriptor reason', unavailableProjection, program => {
      const cell = program.cells.find(candidate => candidate.id === unavailableCell.id)!;
      const fact = cell.descriptorFacts.outerHeight!;
      assert(fact.status === 'unavailable', 'unavailable reason hostile requires an unavailable fact');
      (cell.descriptorFacts as Record<string, X4UiLayoutDescriptorFact>).outerHeight = { ...fact, reason: `${fact.reason}:forged` };
    }, `cell-outer-height:${unavailableCell.id}`, true],
    ['unavailable descriptor provenance', unavailableProjection, program => {
      const cell = program.cells.find(candidate => candidate.id === unavailableCell.id)!;
      const fact = cell.descriptorFacts.outerHeight! as unknown as Record<string, unknown>;
      fact.provenance = 'source-literal';
    }, `cell-outer-height:${unavailableCell.id}`, false],
    ['unavailable descriptor source', unavailableProjection, program => {
      const cell = program.cells.find(candidate => candidate.id === unavailableCell.id)!;
      const fact = cell.descriptorFacts.outerHeight!;
      (cell.descriptorFacts as Record<string, X4UiLayoutDescriptorFact>).outerHeight = { ...fact, source: shiftSource(fact.source) };
    }, `cell-outer-height:${unavailableCell.id}`, true],
    ['unavailable descriptor source pin', unavailableProjection, program => {
      const cell = program.cells.find(candidate => candidate.id === unavailableCell.id)!;
      const fact = cell.descriptorFacts.outerHeight!;
      (cell.descriptorFacts as Record<string, X4UiLayoutDescriptorFact>).outerHeight = {
        ...fact,
        sourcePin: pin(5483, 5497),
      };
    }, `cell-outer-height:${unavailableCell.id}`, true],
    ['creator source pin', unavailableProjection, program => {
      const creator = program.operations.find(operation => operation.cellId === unavailableCell.id && operation.kind === 'createText')!;
      const fact = creator.descriptorFacts.outerHeight!;
      assert(fact.sourcePin !== undefined, 'creator source-pin hostile requires a pinned fact');
      (creator.descriptorFacts as Record<string, X4UiLayoutDescriptorFact>).outerHeight = {
        ...fact,
        sourcePin: { ...fact.sourcePin, lineEnd: fact.sourcePin.lineEnd + 1 },
      };
    }, `cell-outer-height:${unavailableCell.id}`, true],
    ['creator status', unavailableProjection, program => {
      const creator = program.operations.find(operation => operation.cellId === unavailableCell.id && operation.kind === 'createText')!;
      (creator as unknown as { status: string }).status = 'applied';
    }, `cell-outer-height:${unavailableCell.id}`, false],
    ['creator source', unavailableProjection, program => {
      const creator = program.operations.find(operation => operation.cellId === unavailableCell.id && operation.kind === 'createText')!;
      (creator as unknown as { source: X4UiSceneSourceLocation }).source = shiftSource(creator.source);
    }, `cell-outer-height:${unavailableCell.id}`, false],
    ['creator explicit height fact', unavailableProjection, program => {
      const creator = program.operations.find(operation => operation.cellId === unavailableCell.id && operation.kind === 'createText')!;
      (creator.descriptorFacts as Record<string, X4UiLayoutDescriptorFact>).height = known(1, 'number', creator.source, '1');
    }, `cell-outer-height:${unavailableCell.id}`, true],
    ['kernel type', unavailableProjection, program => {
      const table = program.tables.find(candidate => candidate.id === unavailableCell.tableId)!;
      (table.kernelState!.rows[unavailableCell.rowIndex! - 1].cells[unavailableCell.column - 1] as unknown as { type: string }).type = 'boxtext';
    }, `cell-state-value:${unavailableCell.id}`, false],
    ['kernel height', unavailableProjection, program => {
      const table = program.tables.find(candidate => candidate.id === unavailableCell.tableId)!;
      (table.kernelState!.rows[unavailableCell.rowIndex! - 1].cells[unavailableCell.column - 1] as unknown as { height: number }).height = 1;
    }, `cell-state-value:${unavailableCell.id}`, false],
    ['kernel scaling', unavailableProjection, program => {
      const table = program.tables.find(candidate => candidate.id === unavailableCell.tableId)!;
      const cell = table.kernelState!.rows[unavailableCell.rowIndex! - 1].cells[unavailableCell.column - 1];
      (cell as unknown as { scaling: boolean }).scaling = !cell.scaling;
    }, `cell-state-value:${unavailableCell.id}`, false],
    ['kernel affectRowHeight', unavailableProjection, program => {
      const table = program.tables.find(candidate => candidate.id === unavailableCell.tableId)!;
      const cell = table.kernelState!.rows[unavailableCell.rowIndex! - 1].cells[unavailableCell.column - 1];
      (cell as unknown as { affectRowHeight: boolean }).affectRowHeight = !cell.affectRowHeight;
    }, `cell-state-value:${unavailableCell.id}`, false],
    ['owner column slot', unavailableProjection, program => {
      const cell = program.cells.find(candidate => candidate.id === unavailableCell.id)!;
      (cell as unknown as { column: number }).column += 1;
    }, `row-cell-slot:${unavailableCell.rowId}:1`, false],
    ['owner row slot', unavailableProjection, program => {
      const cell = program.cells.find(candidate => candidate.id === unavailableCell.id)!;
      (cell as unknown as { rowIndex: number }).rowIndex += 1;
    }, `cell-kernel-slot:${unavailableCell.id}`, false],
  ];

  for (const [label, projected, mutate, expectedStage, sceneIndependent] of mutations) {
    const program = cloneProgram(projected.program!);
    mutate(program);
    const sourceAuthority = producerAuthority(projected.result as X4UiLayoutProgramResult);
    const authority = sceneIndependent ? synchronizedAuthority(sourceAuthority, program) : sourceAuthority;
    freezeFixtureGraph(program);
    freezeFixtureGraph(authority);
    const pair = validateX4UiLayoutEvidencePair(program, authority);
    assert(pair.valid === sceneIndependent, `${label} hostile authority boundary changed: ${JSON.stringify({ sceneIndependent, pair })}`);
    const stage = diagnoseX4UiSceneStructureForTest(program, authority);
    const result = buildX4UiScene({ ...projected.result, program, evidenceAuthority: authority } as X4UiLayoutProgramResult, corpus, projected.profile!);
    assert((!sceneIndependent || stage === expectedStage) && refusalHasNoScene(result), `${label} hostile escaped its Scene relation: ${JSON.stringify({ sceneIndependent, expectedStage, stage, result })}`);
  }
});

const B119_STRICT_CONFIGURED_CENSUS_ENV = 'X4_UI_SCENE_SELFTEST_STRICT_CONFIGURED_CENSUS';
const b119ConfiguredSourceSpecs = [
  {
    label: 'MENU',
    workspaceRelativePath: path.join('x4_ai_influence', 'ui', 'addons', 'ai_influence_chat', 'aic_menu.lua'),
    relativePath: 'ui/addons/ai_influence_chat/aic_menu.lua',
    targetName: 'menu.display',
    sourceSha256: '4253D9BD9DE4113D4DE0B881DBF5A1E90CAA7B30F735BA925403EBEF7EC47DD7',
    consumerNumbers: {
      vw: 1920,
      vh: 1080,
      'railX + col * (chipW + chipGap)': 30,
      ry: 165,
      chipW: 109,
      px: 450,
      ty: 654,
      tw: 787,
      _useH: 80,
      _choiceY: 734,
      _readSpan: 6,
    },
    expectedLayout: { samples: 14, consumed: 9, notConsumed: 5, operations: 66, applied: 27, frames: 1, tables: 4, rows: 9, cells: 88, gaps: 97 },
    expectedScene: { frames: 1, tables: 4, rows: 2, cells: 16, widgets: 3, texts: 5, glyphs: 7, gaps: 143, drawable: { x: 0, y: 0, width: 1920, height: 1080 } },
    expectedPaint: { commands: 209, diagnostics: 171 },
  },
  {
    label: 'HUB',
    workspaceRelativePath: path.join('x4_ai_influence', 'ui', 'addons', 'ai_influence_chat', 'aic_hub.lua'),
    relativePath: 'ui/addons/ai_influence_chat/aic_hub.lua',
    targetName: 'hub.display',
    sourceSha256: '657476EAD08229977E1F2A69079FFDCAB56D908B72AF5C87BD4F4734DCCB8C4F',
    consumerNumbers: { vw: 1920, vh: 1080, x: 27, my: 27, w: 1866, '#TABS': 2, y: 62, i: 1 },
    expectedLayout: { samples: 9, consumed: 7, notConsumed: 2, operations: 18, applied: 11, frames: 1, tables: 2, rows: 2, cells: 4, gaps: 16 },
    expectedScene: { frames: 1, tables: 2, rows: 2, cells: 4, widgets: 0, texts: 0, glyphs: 0, gaps: 31, drawable: { x: 0, y: 0, width: 1920, height: 1080 } },
    expectedPaint: { commands: 46, diagnostics: 37 },
  },
  {
    label: 'COMM',
    workspaceRelativePath: path.join('x4_ai_influence', 'ui', 'addons', 'ai_influence_chat', 'aic_comm.lua'),
    relativePath: 'ui/addons/ai_influence_chat/aic_comm.lua',
    targetName: 'comm.display',
    sourceSha256: '88FAB05A79EF33CB28E098081EA6A5E29E8F3B7C4150C39BF38913C51C063511',
    consumerNumbers: { vw: 1920, vh: 1080, mx: 27, my: 27, 'vw - mx * 2': 1866 },
    expectedLayout: { samples: 3, consumed: 3, notConsumed: 0, operations: 14, applied: 12, frames: 1, tables: 1, rows: 1, cells: 3, gaps: 11 },
    expectedScene: { frames: 1, tables: 1, rows: 1, cells: 3, widgets: 0, texts: 0, glyphs: 0, gaps: 23, drawable: { x: 0, y: 0, width: 1920, height: 1080 } },
    expectedPaint: { commands: 35, diagnostics: 29 },
  },
] as const;

type B119ConfiguredSourceLabel = typeof b119ConfiguredSourceSpecs[number]['label'];
type B119ConfiguredCensusAvailability = {
  readonly status: 'available';
  readonly root: string;
  readonly sourcePaths: Readonly<Record<B119ConfiguredSourceLabel, string>>;
} | {
  readonly status: 'unavailable';
  readonly reason: string;
};

const b119LexicallyContainedSourcePath = (root: string, workspaceRelativePath: string): string | undefined => {
  if (path.isAbsolute(workspaceRelativePath)) return undefined;
  const resolvedRoot = path.resolve(root);
  const candidate = path.resolve(resolvedRoot, workspaceRelativePath);
  const relative = path.relative(resolvedRoot, candidate);
  if (relative.length === 0 || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) return undefined;
  return candidate;
};

const b119ContainedSourcePath = (root: string, workspaceRelativePath: string): string | undefined => {
  const candidate = b119LexicallyContainedSourcePath(root, workspaceRelativePath);
  if (candidate === undefined) return undefined;
  try {
    const physicalRoot = realpathSync(root);
    const physicalCandidate = realpathSync(candidate);
    const physicalRelative = path.relative(physicalRoot, physicalCandidate);
    if (physicalRelative.length === 0
      || physicalRelative === '..'
      || physicalRelative.startsWith(`..${path.sep}`)
      || path.isAbsolute(physicalRelative)) return undefined;
    return physicalCandidate;
  } catch {
    return undefined;
  }
};

const resolveB119ConfiguredCensus = (): B119ConfiguredCensusAvailability => {
  let configuredRoot: string | undefined;
  try {
    configuredRoot = resolveXsdConfig().modWorkspacePath?.trim();
  } catch (error) {
    return { status: 'unavailable', reason: `resolveXsdConfig failed: ${error instanceof Error ? error.message : String(error)}` };
  }
  if (!configuredRoot) return { status: 'unavailable', reason: 'resolveXsdConfig().modWorkspacePath is not configured' };
  const root = path.resolve(configuredRoot);
  try {
    if (!statSync(root).isDirectory()) return { status: 'unavailable', reason: 'configured modWorkspacePath is not a directory' };
  } catch (error) {
    return { status: 'unavailable', reason: `configured modWorkspacePath is unavailable: ${error instanceof Error ? error.message : String(error)}` };
  }
  const sourcePaths: Partial<Record<B119ConfiguredSourceLabel, string>> = {};
  for (const source of b119ConfiguredSourceSpecs) {
    const candidate = b119ContainedSourcePath(root, source.workspaceRelativePath);
    if (candidate === undefined) return { status: 'unavailable', reason: `${source.label} source path is outside configured modWorkspacePath` };
    try {
      if (!statSync(candidate).isFile()) return { status: 'unavailable', reason: `${source.label} configured source is not a file` };
    } catch (error) {
      return { status: 'unavailable', reason: `${source.label} configured source is unavailable: ${error instanceof Error ? error.message : String(error)}` };
    }
    sourcePaths[source.label] = candidate;
  }
  return {
    status: 'available',
    root,
    sourcePaths: sourcePaths as Readonly<Record<B119ConfiguredSourceLabel, string>>,
  };
};

test('B119 configured census routing is containment-safe and workspace-relative', () => {
  const root = path.resolve('selftest', 'b119-configured-census-root');
  for (const source of b119ConfiguredSourceSpecs) {
    assert(!path.isAbsolute(source.workspaceRelativePath), `${source.label} configured route must remain workspace-relative`);
    const candidate = b119LexicallyContainedSourcePath(root, source.workspaceRelativePath);
    assert(candidate !== undefined && path.relative(root, candidate).split(path.sep)[0] === 'x4_ai_influence', `${source.label} configured route escaped its synthetic workspace root`);
  }
  assert(b119LexicallyContainedSourcePath(root, path.join('..', 'escaped.lua')) === undefined, 'configured source routing must reject parent traversal');
});

test('B119 configured census rejects a physical child reparse escape before source read', () => {
  const temporaryRoot = mkdtempSync(path.join(tmpdir(), 'x4-ui-scene-b119-containment-'));
  try {
    const physicalWorkspace = path.join(temporaryRoot, 'workspace-physical');
    const selectedWorkspace = path.join(temporaryRoot, 'workspace-selected');
    const insideDirectory = path.join(physicalWorkspace, 'inside');
    const outsideDirectory = path.join(temporaryRoot, 'outside');
    mkdirSync(insideDirectory, { recursive: true });
    mkdirSync(outsideDirectory, { recursive: true });
    writeFileSync(path.join(insideDirectory, 'source.lua'), 'return "inside"\n', 'utf8');
    writeFileSync(path.join(outsideDirectory, 'source.lua'), 'return "outside"\n', 'utf8');
    const directoryLinkType = process.platform === 'win32' ? 'junction' : 'dir';
    try {
      symlinkSync(physicalWorkspace, selectedWorkspace, directoryLinkType);
      symlinkSync(outsideDirectory, path.join(physicalWorkspace, 'escape'), directoryLinkType);
    } catch (error) {
      throw new Error(`B119 configured reparse hostile unavailable: ${error instanceof Error ? error.message : String(error)}`);
    }
    const containedSource = b119ContainedSourcePath(selectedWorkspace, path.join('inside', 'source.lua'));
    assert(
      containedSource === realpathSync(path.join(insideDirectory, 'source.lua')),
      'configured routing must allow an in-root source when the selected workspace root is itself a link',
    );
    assert(
      b119ContainedSourcePath(selectedWorkspace, path.join('escape', 'source.lua')) === undefined,
      'configured routing must reject a child reparse source whose physical target escapes the selected workspace',
    );
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

const b119ConfiguredCensus = resolveB119ConfiguredCensus();
const b119StrictConfiguredCensus = process.env[B119_STRICT_CONFIGURED_CENSUS_ENV] === '1';

if (b119ConfiguredCensus.status === 'unavailable') {
  const message = `B119 configured-census-unavailable: ${b119ConfiguredCensus.reason}`;
  if (b119StrictConfiguredCensus) {
    test('B119 strict configured public-session census requires all real sources', () => {
      throw new Error(message);
    });
  } else {
    console.log(`B119 configured public-session census NOT RUN: ${message}`);
  }
} else {
  test('B119 exact configured public-session census is separate from portable fixtures', () => {
    const executed: B119ConfiguredSourceLabel[] = [];
    for (const source of b119ConfiguredSourceSpecs) {
      const sourcePath = b119ConfiguredCensus.sourcePaths[source.label];
      const sourceText = readFileSync(sourcePath, 'utf8');
    const workspace = {
      id: 'b119-exact-' + source.label.toLowerCase(),
      name: 'B119 exact ' + source.label + ' session census',
      version: '1.0.0',
      author: 'Forge',
      description: 'read-only exact configured source census',
      nodes: [],
      links: [],
      uiWidgets: [],
      uiTheme: { backgroundColor: '#000000', borderColor: '#111111', accentColor: '#00ffff', opacity: 1, showIcons: true },
      compileSettings: { md: false, ui: true, ai: false, library: false, translations: false, patches: false },
      passthroughFiles: [
        {
          path: 'ui.xml',
          content: '<?xml version="1.0" encoding="utf-8"?>\n<addon name="b119-exact-' + source.label.toLowerCase() + '"><environment type="menus"><file name="' + source.relativePath + '" /></environment></addon>\n',
        },
        { path: source.relativePath, content: sourceText, reason: 'unparsed' },
      ],
    } as Parameters<typeof projectX4UiEditorSession>[0]['workspace'];
    const profile = { width: 1920, height: 1080, uiScale: 1 } as const;
    const baseline = projectX4UiEditorSession({ workspace, corpus: undefined, profile });
    const file = baseline.source.bundle?.sourceFiles.find(candidate => candidate.path === source.relativePath);
    assert(file !== undefined, source.label + ' exact public session must materialize ' + source.relativePath);
    const targetCatalog = createX4UiLayoutTargetCatalog(file.callModel);
    assert(targetCatalog.sourceIdentity.sha256 === source.sourceSha256, source.label + ' configured source hash changed: ' + targetCatalog.sourceIdentity.sha256);
    const target = targetCatalog.targets.find(candidate => candidate.name === source.targetName);
    assert(target !== undefined, source.label + ' exact public session source must expose ' + source.targetName);
    const selection = {
      sourceIndex: file.index,
      path: file.path,
      sourceIdentity: targetCatalog.sourceIdentity,
      target: { ...target, id: target.id },
    };
    const unsampled = projectX4UiEditorSession({ workspace, corpus, profile, selection });
    const sampleCatalog = unsampled.sampleCatalog;
    assert(sampleCatalog !== null && unsampled.sampleBinding !== undefined && unsampled.sampleCatalogAuthority !== undefined, source.label + ' exact public session must issue catalog, binding, and authority');
    const selectedEntries = sampleCatalog.entries.filter(entry => source.label === 'HUB'
      ? entry.expression !== 'font(18)'
      : source.label === 'COMM'
        ? entry.expression !== 'font(13)'
        : true);
    const values = selectedEntries.map(entry => ({
      id: entry.id,
      value: entry.expectedType === 'boolean'
        ? false
        : entry.expectedType === 'string'
          ? 'sampled'
          : source.consumerNumbers[entry.expression as keyof typeof source.consumerNumbers] ?? 80,
    }));
    const sampled = projectX4UiEditorSession({
      workspace,
      corpus,
      profile,
      selection,
      samples: {
        catalogId: sampleCatalog.id,
        source: sampleCatalog.sourceIdentity,
        values,
      },
      sampleBinding: unsampled.sampleBinding,
      sampleCatalogAuthority: unsampled.sampleCatalogAuthority,
    });
    const programResult = sampled.preview.program;
    assert(programResult !== null && programResult.status !== 'refused', source.label + ' exact sampled session must retain its Layout program: ' + JSON.stringify(sampled.preview));
    const program = programResult.program;
    const authority = programResult.evidenceAuthority;
    const pair = validateX4UiLayoutEvidencePair(program, authority);
    const stage = diagnoseX4UiSceneStructureForTest(program, authority);
    const layoutCounts = {
      samples: values.length,
      consumed: program.previewSampleBindings.filter(binding => binding.status === 'consumed').length,
      notConsumed: program.previewSampleBindings.filter(binding => binding.status !== 'consumed').length,
      operations: program.operations.length,
      applied: program.operations.filter(operation => operation.status === 'applied').length,
      frames: program.frames.length,
      tables: program.tables.length,
      rows: program.rows.length,
      cells: program.cells.length,
      gaps: program.gaps.length,
    };
    assert(pair.valid, source.label + ' exact sampled producer authority pair must validate: ' + JSON.stringify(pair));
    assert(stage === undefined, source.label + ' exact sampled program still refuses at Scene structure stage ' + String(stage));
    assert(JSON.stringify(layoutCounts) === JSON.stringify(source.expectedLayout), source.label + ' exact Layout census changed: ' + JSON.stringify({ expected: source.expectedLayout, actual: layoutCounts }));

    const sceneResult = sampled.preview.scene;
    assert(sceneResult !== null && sceneResult.status !== 'refused', source.label + ' exact sampled session must reach non-refused Scene: ' + JSON.stringify(sceneResult));
    const scene = sceneResult.scene;
    const sceneGeometry = {
      frames: scene.frames.length,
      tables: scene.tables.length,
      rows: scene.rows.length,
      cells: scene.cells.length,
      widgets: scene.widgets.length,
      texts: scene.texts.length,
      glyphs: scene.glyphs.length,
      gaps: scene.gaps.length,
      drawable: scene.drawableRect,
    };
    assert(JSON.stringify(sceneGeometry) === JSON.stringify(source.expectedScene), source.label + ' exact Scene geometry changed: ' + JSON.stringify({ expected: source.expectedScene, actual: sceneGeometry }));
    assert(sampled.paint !== null && sampled.paint.status !== 'refused', source.label + ' exact sampled session must reach non-refused Paint: ' + JSON.stringify(sampled.paint));
    const paint = {
      commands: sampled.paint.plan.layers.reduce((count, layer) => count + layer.commands.length, 0),
      diagnostics: sampled.paint.plan.diagnostics.length,
    };
    assert(JSON.stringify(paint) === JSON.stringify(source.expectedPaint), source.label + ' exact Paint census changed: ' + JSON.stringify({ expected: source.expectedPaint, actual: paint }));
    assert(sampled.status === 'partial' && sampled.preview.status === 'partial' && sceneResult.status === 'partial' && sampled.paint.status === 'partial' && sampled.canRender, source.label + ' exact public session status chain changed');
    assert(sampled.preview.gaps.length === 0, source.label + ' exact public session must not carry a downstream preview refusal gap');
    assert(sampled.gameTruth === 'Not verified in game' && sampled.gameVerified === false && scene.verification.gameVerified === false && sampled.paint.verification.gameVerified === false, source.label + ' exact public session must remain Not verified in game');

    console.log('B119 exact configured public-session census ' + source.label + ': ' + JSON.stringify({
      sourceSha256: source.sourceSha256,
      sampleValues: selectedEntries.map((entry, index) => ({ expression: entry.expression, value: values[index]?.value })),
      layout: layoutCounts,
      sceneStatus: sceneResult.status,
      sceneGeometry,
      paintStatus: sampled.paint.status,
      paint,
      canRender: sampled.canRender,
      gameTruth: sampled.gameTruth,
      gameVerified: sampled.gameVerified,
    }));
      executed.push(source.label);
    }
    assert(JSON.stringify(executed) === JSON.stringify(['MENU', 'HUB', 'COMM']), `configured census did not execute every real source: ${JSON.stringify(executed)}`);
    console.log(`B119 configured public-session census EXECUTED 3/3: ${executed.join(',')}`);
  });
}

console.log(`x4UiScene selftest: ${passed}/${total} passed`);
if (failures.length > 0) {
  for (const item of failures) console.error(`FAIL ${item}`);
  process.exitCode = 1;
  throw new Error(`${failures.length} selftest case(s) failed.`);
}
