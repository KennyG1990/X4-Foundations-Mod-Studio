import { readFileSync } from 'node:fs';

import {
  HELPER_SOURCE_PATH,
  WIDGET_SOURCE_PATH,
  X4_UI_CORPUS_COLOR_CANONICAL_EVIDENCE,
  X4_UI_CORPUS_COLORS_XML_PATH,
  X4_UI_CORPUS_COLORS_XML_SHA256,
  X4_UI_CORPUS_COLORS_XML_SIZE,
  X4_UI_CORPUS_COLORS_XSD_PATH,
  X4_UI_CORPUS_COLORS_XSD_SHA256,
  X4_UI_CORPUS_COLORS_XSD_SIZE,
  X4_UI_CORPUS_CANONICAL_EVIDENCE,
  X4_UI_CORPUS_FILE_URL,
  X4_UI_CORPUS_MANIFEST_URL,
  X4_UI_CORPUS_STATUS_URL,
  X4_UI_CORPUS_VERIFICATION,
  X4_UI_CORPUS_9_00_CONTRACT,
  X4_UI_CORPUS_9_00_COLOR_CONTRACT,
  isX4UiCorpusCanonicalColorSuccess,
  isX4UiCorpusCanonicalSuccess,
  loadCanonicalX4UiCorpusColorEvidence,
  loadCanonicalX4UiCorpusAssets,
  loadSyntheticX4UiCorpusAssets,
  type X4UiCorpusAssetContract,
  type X4UiCorpusAssetKind,
  type X4UiCorpusCanonicalColorLoadOptions,
  type X4UiCorpusCanonicalColorSuccess,
  type X4UiCorpusCanonicalSuccess,
  type X4UiCorpusFailureResult,
  type X4UiCorpusLoadOptions,
  type X4UiCorpusFetchResponse,
} from './x4UiCorpusAssets';
import {
  ZEKTON_DDS_HEADER_SIZE,
  ZEKTON_DESCRIPTOR_HEADER_SIZE,
  ZEKTON_DESCRIPTOR_TRAILING_SIZE,
  ZEKTON_EVIDENCE_STATE,
  ZEKTON_RECORD_SIZE,
} from './x4UiFontMetrics';

interface SyntheticRecord {
  readonly bearing: number;
  readonly width: number;
  readonly advance: number;
}

interface Fixture {
  contract: X4UiCorpusAssetContract;
  readonly buffers: Map<string, Uint8Array>;
  readonly records: Map<string, unknown[]>;
  readonly calls: string[];
  readonly statusBodies: unknown[];
  readonly statusCodes: number[];
  readonly manifestBodies: Map<string, unknown>;
  readonly manifestCodes: Map<string, number>;
  readonly manifestGenerations: Map<string, string>;
  readonly fileCodes: Map<string, number>;
  readonly fileContentTypes: Map<string, string>;
  readonly fileErrors: Set<string>;
  readonly fileNoArrayBuffer: Set<string>;
  readonly root: string;
  readonly generation: string;
}

interface ColorFixture {
  readonly buffers: Map<string, Uint8Array>;
  readonly records: Map<string, unknown[]>;
  readonly calls: string[];
  readonly statusBodies: unknown[];
  readonly statusCodes: number[];
  readonly manifestBodies: Map<string, unknown>;
  readonly manifestCodes: Map<string, number>;
  readonly manifestGenerations: Map<string, string>;
  readonly fileCodes: Map<string, number>;
  readonly fileContentTypes: Map<string, string>;
  readonly fileErrors: Set<string>;
  readonly fileNoArrayBuffer: Set<string>;
  readonly root: string;
  readonly generation: string;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function equal<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) throw new Error(`${message}: expected ${String(expected)}, received ${String(actual)}`);
}

function bytesEqual(actual: ArrayLike<number>, expected: ArrayLike<number>, message: string): void {
  equal(actual.length, expected.length, `${message} length`);
  for (let index = 0; index < actual.length; index += 1) equal(actual[index], expected[index], `${message} byte ${index}`);
}

function paddedUtf8(text: string, size: number): Uint8Array {
  const bytes = new TextEncoder().encode(text);
  assert(bytes.byteLength <= size, `fixture text exceeds pinned size ${size}`);
  const padded = new Uint8Array(size);
  padded.set(bytes);
  padded.fill(0x20, bytes.byteLength);
  return padded;
}

function makeCanonicalColorXml(): Uint8Array {
  const colors: string[] = [];
  for (let index = 0; index < 224; index += 1) {
    const id = `base_${index.toString().padStart(3, '0')}`;
    if (index === 0) {
      colors.push(`    <color id="${id}"/>`);
    } else {
      colors.push(`    <color id="${id}" r="${index % 256}" g="${(index + 1) % 256}" b="${(index + 2) % 256}" a="${(index + 3) % 256}" glow="${(index % 5) / 10}"/>`);
    }
  }
  const mappings: string[] = [];
  for (let index = 0; index < 804; index += 1) {
    mappings.push(`    <mapping id="map_${index.toString().padStart(3, '0')}" ref="base_${(index % 224).toString().padStart(3, '0')}"/>`);
  }
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<colormap>',
    '  <colors>',
    ...colors,
    '  </colors>',
    '  <mappings>',
    ...mappings,
    '  </mappings>',
    '  <daltonization><color id="out_of_scope"/></daltonization>',
    '</colormap>',
  ].join('\n');
  return paddedUtf8(xml, X4_UI_CORPUS_COLORS_XML_SIZE);
}

function makeCanonicalColorXsd(): Uint8Array {
  const xsd = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">',
    '  <xs:simpleType name="identifier"><xs:restriction base="xs:string"><xs:pattern value="[a-zA-Z_][a-zA-Z0-9_]*"/></xs:restriction></xs:simpleType>',
    '</xs:schema>',
  ].join('\n');
  return paddedUtf8(xsd, X4_UI_CORPUS_COLORS_XSD_SIZE);
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

function makeAbc(record: SyntheticRecord): Uint8Array {
  const maxCodePoint = 32;
  const mapBytes = (maxCodePoint + 1) * 2;
  const recordStart = (48 + mapBytes + 3) & ~3;
  const bytes = new Uint8Array(recordStart + 24 + 4);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 9, true);
  view.setFloat32(4, 52, true);
  view.setFloat32(8, 0, true);
  view.setFloat32(12, 0, true);
  view.setFloat32(16, 52, true);
  view.setInt32(20, 41, true);
  view.setInt32(24, 11, true);
  view.setInt32(28, 9, true);
  view.setUint32(32, 0, true);
  view.setUint32(36, 4, true);
  view.setUint32(40, 4, true);
  view.setUint32(44, maxCodePoint, true);
  view.setUint16(48 + 32 * 2, 1, true);
  view.setFloat32(recordStart, 0, true);
  view.setFloat32(recordStart + 4, 0, true);
  view.setFloat32(recordStart + 8, 0.25, true);
  view.setFloat32(recordStart + 12, 0.25, true);
  view.setInt16(recordStart + 16, record.bearing, true);
  view.setUint16(recordStart + 18, record.width, true);
  view.setUint16(recordStart + 20, record.advance, true);
  view.setUint16(recordStart + 22, 0, true);
  return bytes;
}

function makeDds(): Uint8Array {
  const bytes = new Uint8Array(128 + 16);
  bytes.set([0x44, 0x44, 0x53, 0x20]);
  const view = new DataView(bytes.buffer);
  view.setUint32(4, 124, true);
  view.setUint32(8, 0x1007, true);
  view.setUint32(12, 4, true);
  view.setUint32(16, 4, true);
  view.setUint32(76, 32, true);
  view.setUint32(80, 2, true);
  view.setUint32(88, 8, true);
  view.setUint32(104, 0xff, true);
  view.setUint32(108, 0x1002, true);
  for (let index = 128; index < bytes.length; index += 1) bytes[index] = index - 128;
  return bytes;
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

function hexDigest(hex: string): ArrayBuffer {
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  return bytes.buffer;
}

async function withCanonicalPlatformHash<T>(expectedHashes: readonly string[], run: () => Promise<T>): Promise<T> {
  const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  const originalValue = (globalThis as unknown as { crypto?: unknown }).crypto;
  let hashIndex = 0;
  const fakeCrypto = {
    subtle: {
      digest: async (..._args: readonly unknown[]): Promise<ArrayBuffer> => {
        const expected = expectedHashes[hashIndex++];
        if (expected === undefined) throw new Error('canonical selftest hash count mismatch');
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
    assert((globalThis as unknown as { crypto?: unknown }).crypto === originalValue, 'canonical selftest must restore global Web Crypto');
  }
}

type CanonicalHashAttack =
  | 'none'
  | 'post-check-mutation'
  | 'proxy'
  | 'property-callback'
  | 'prototype-callback'
  | 'bytecaps-callback'
  | 'first-transport-crypto';

async function loadCanonicalSelftestResult(
  injectLyingHashProvider = false,
  attack: CanonicalHashAttack = 'none',
  attackState: { called: boolean; replacementCalls: number } = { called: false, replacementCalls: 0 },
): Promise<X4UiCorpusCanonicalSuccess> {
  const root = 'canonical-selftest-root';
  const generation = 'canonical-selftest-generation';
  const generatedAt = '2026-08-11T00:00:00.000Z';
  const contract = X4_UI_CORPUS_9_00_CONTRACT;
  const buffers = new Map<string, Uint8Array>([
    [contract.helper.relativePath, new TextEncoder().encode('-- canonical selftest helper\n')],
    [contract.widget.relativePath, new TextEncoder().encode('-- canonical selftest widget\n')],
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
    generatedAt,
    manifestGeneration: generation,
    manifest: { available: true, state: 'ready', root, current: { generation, root, generatedAt } },
  };
  let hashIndex = 0;
  const attackingProvider = async (): Promise<ArrayBuffer> => {
    attackState.called = true;
    throw new Error('canonical attack provider must never be called');
  };
  const replacementCrypto = {
    subtle: {
      digest: async (): Promise<ArrayBuffer> => {
        attackState.replacementCalls += 1;
        return hexDigest('00'.repeat(32));
      },
    },
  };
  const replaceCrypto = (): void => {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      enumerable: true,
      writable: true,
      value: replacementCrypto,
    });
  };
  const options: Record<string, unknown> = {};
  const transport = async (url: string): Promise<X4UiCorpusFetchResponse> => {
    if (url === X4_UI_CORPUS_STATUS_URL) {
      if (attack === 'post-check-mutation') options.hashProvider = attackingProvider;
      if (attack === 'first-transport-crypto') replaceCrypto();
      return jsonResponse(status);
    }
    if (url.startsWith(`${X4_UI_CORPUS_MANIFEST_URL}?`)) {
      const path = pathFromQuery(url, 'q');
      const bytes = buffers.get(path);
      if (!bytes) throw new Error(`unknown canonical manifest path ${path}`);
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
      if (!bytes) throw new Error(`unknown canonical file path ${path}`);
      return bytesResponse(bytes, 200, path.endsWith('.lua') ? 'text/plain' : 'application/octet-stream');
    }
    throw new Error(`unexpected canonical selftest URL ${url}`);
  };
  options.transport = transport;
  if (attack === 'property-callback') {
    Object.defineProperty(options, 'byteCaps', {
      configurable: true,
      enumerable: true,
      get: () => {
        replaceCrypto();
        return undefined;
      },
    });
  }
  if (injectLyingHashProvider) {
    options.hashProvider = async () => {
      const expected = expectedHashes[hashIndex++];
      if (expected === undefined) throw new Error('canonical selftest hash count mismatch');
      return hexDigest(expected);
    };
  }
  let loaderOptions: unknown = options;
  if (attack === 'proxy' || attack === 'prototype-callback' || attack === 'bytecaps-callback') {
    loaderOptions = new Proxy(options, {
      has: (target, property) => property === 'hashProvider' ? false : Reflect.has(target, property),
      get: (target, property, receiver) => {
        if (property === 'hashProvider') return attackingProvider;
        if (attack === 'bytecaps-callback' && property === 'byteCaps') replaceCrypto();
        return Reflect.get(target, property, receiver);
      },
      getPrototypeOf: target => {
        if (attack === 'prototype-callback') replaceCrypto();
        return Reflect.getPrototypeOf(target);
      },
    });
  }
  const result = injectLyingHashProvider
    ? await loadCanonicalX4UiCorpusAssets(loaderOptions as never)
    : await withCanonicalPlatformHash(expectedHashes, () => loadCanonicalX4UiCorpusAssets(loaderOptions as never));
  if (result.ok === false) throw new Error(`canonical selftest loader failed: ${result.error.message}`);
  return result;
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  const output = new Uint8Array(digest);
  return Array.from(output, byte => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
}

function asset(path: string, hash: string): { relativePath: string; sha256: string } {
  return { relativePath: path, sha256: hash };
}

function statusBody(root: string, generation: string, generatedAt = '2026-08-10T12:00:00.000Z'): Record<string, unknown> {
  const current = { generation, root, generatedAt };
  return {
    available: true,
    root,
    generatedAt,
    manifestGeneration: generation,
    manifest: { available: true, state: 'ready', root, current },
  };
}

function manifestStatus(root: string, generation: string): Record<string, unknown> {
  return {
    available: true,
    state: 'ready',
    root,
    current: { generation, root, generatedAt: '2026-08-10T12:00:00.000Z' },
  };
}

function pathFromQuery(url: string, key: string): string {
  const query = url.slice(url.indexOf('?') + 1).split('&');
  const pair = query.find(part => part.startsWith(`${key}=`));
  if (!pair) throw new Error(`missing query ${key}`);
  return decodeURIComponent(pair.slice(key.length + 1));
}

async function makeFixture(): Promise<Fixture> {
  const root = 'configured-corpus-identity';
  const generation = 'generation-1';
  const buffers = new Map<string, Uint8Array>();
  const helperBytes = new TextEncoder().encode('\uFEFF-- helper\r\nreturn "helper"\r\n');
  const widgetBytes = new TextEncoder().encode('\uFEFF-- widget\r\nreturn "widget"\r\n');
  const regularAbc = makeAbc({ bearing: -1, width: 2, advance: 5 });
  const boldAbc = makeAbc({ bearing: 0, width: 3, advance: 6 });
  const regularDds = makeDds();
  const boldDds = makeDds();
  const paths = {
    helper: 'synthetic/ui/helper.lua',
    widget: 'synthetic/ui/widget_fullscreen.lua',
    regularDescriptor: 'synthetic/fonts/zekton_32.abc',
    regularAtlas: 'synthetic/fonts/zekton_32.dds',
    boldDescriptor: 'synthetic/fonts/zekton bold_32.abc',
    boldAtlas: 'synthetic/fonts/zekton bold_32.dds',
  } as const;
  buffers.set(paths.helper, helperBytes);
  buffers.set(paths.widget, widgetBytes);
  buffers.set(paths.regularDescriptor, regularAbc);
  buffers.set(paths.regularAtlas, regularDds);
  buffers.set(paths.boldDescriptor, boldAbc);
  buffers.set(paths.boldAtlas, boldDds);
  const contract: X4UiCorpusAssetContract = {
    helper: asset(paths.helper, await sha256(helperBytes)),
    widget: asset(paths.widget, await sha256(widgetBytes)),
    regular: {
      descriptor: asset(paths.regularDescriptor, await sha256(regularAbc)),
      atlas: asset(paths.regularAtlas, await sha256(regularDds)),
    },
    bold: {
      descriptor: asset(paths.boldDescriptor, await sha256(boldAbc)),
      atlas: asset(paths.boldAtlas, await sha256(boldDds)),
    },
  };
  const records = new Map<string, unknown[]>();
  for (const path of buffers.keys()) records.set(path, [{ path, bytes: buffers.get(path)!.byteLength }]);
  return {
    contract,
    buffers,
    records,
    calls: [],
    statusBodies: [statusBody(root, generation), statusBody(root, generation)],
    statusCodes: [200, 200],
    manifestBodies: new Map(),
    manifestCodes: new Map(),
    manifestGenerations: new Map(),
    fileCodes: new Map(),
    fileContentTypes: new Map(),
    fileErrors: new Set(),
    fileNoArrayBuffer: new Set(),
    root,
    generation,
  };
}

function makeColorFixture(): ColorFixture {
  const root = 'configured-color-corpus-identity';
  const generation = 'color-generation-1';
  const xml = makeCanonicalColorXml();
  const xsd = makeCanonicalColorXsd();
  const buffers = new Map<string, Uint8Array>([
    [X4_UI_CORPUS_COLORS_XML_PATH, xml],
    [X4_UI_CORPUS_COLORS_XSD_PATH, xsd],
  ]);
  const records = new Map<string, unknown[]>([
    [X4_UI_CORPUS_COLORS_XML_PATH, [{ path: X4_UI_CORPUS_COLORS_XML_PATH, bytes: xml.byteLength }]],
    [X4_UI_CORPUS_COLORS_XSD_PATH, [{ path: X4_UI_CORPUS_COLORS_XSD_PATH, bytes: xsd.byteLength }]],
  ]);
  return {
    buffers,
    records,
    calls: [],
    statusBodies: [statusBody(root, generation), statusBody(root, generation)],
    statusCodes: [200, 200],
    manifestBodies: new Map(),
    manifestCodes: new Map(),
    manifestGenerations: new Map(),
    fileCodes: new Map(),
    fileContentTypes: new Map(),
    fileErrors: new Set(),
    fileNoArrayBuffer: new Set(),
    root,
    generation,
  };
}

function replaceColorXml(fixture: ColorFixture, text: string): void {
  const bytes = paddedUtf8(text.replace(/ +$/u, ''), X4_UI_CORPUS_COLORS_XML_SIZE);
  fixture.buffers.set(X4_UI_CORPUS_COLORS_XML_PATH, bytes);
  fixture.records.set(X4_UI_CORPUS_COLORS_XML_PATH, [{ path: X4_UI_CORPUS_COLORS_XML_PATH, bytes: bytes.byteLength }]);
}

function replaceColorXsd(fixture: ColorFixture, text: string): void {
  const bytes = paddedUtf8(text.replace(/ +$/u, ''), X4_UI_CORPUS_COLORS_XSD_SIZE);
  fixture.buffers.set(X4_UI_CORPUS_COLORS_XSD_PATH, bytes);
  fixture.records.set(X4_UI_CORPUS_COLORS_XSD_PATH, [{ path: X4_UI_CORPUS_COLORS_XSD_PATH, bytes: bytes.byteLength }]);
}

function colorXmlText(fixture: ColorFixture): string {
  return new TextDecoder().decode(fixture.buffers.get(X4_UI_CORPUS_COLORS_XML_PATH)!);
}

function recursivelyFrozen(value: unknown, seen = new WeakSet<object>()): boolean {
  if (value === null || typeof value !== 'object') return true;
  if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) return true;
  const object = value as object;
  if (seen.has(object)) return true;
  seen.add(object);
  return Object.isFrozen(object)
    && Object.keys(value as Record<string, unknown>).every(key => recursivelyFrozen((value as Record<string, unknown>)[key], seen));
}

function makeColorTransport(fixture: ColorFixture): (url: string, init?: { readonly signal?: AbortSignal }) => Promise<X4UiCorpusFetchResponse> {
  return async url => {
    fixture.calls.push(url);
    if (url === X4_UI_CORPUS_STATUS_URL) {
      const index = Math.min(fixture.calls.filter(call => call === X4_UI_CORPUS_STATUS_URL).length - 1, fixture.statusBodies.length - 1);
      return jsonResponse(fixture.statusBodies[index], fixture.statusCodes[index] ?? 200);
    }
    if (url.startsWith(`${X4_UI_CORPUS_MANIFEST_URL}?`)) {
      const path = pathFromQuery(url, 'q');
      if (fixture.fileErrors.has(`manifest:${path}`)) throw new Error('network');
      const code = fixture.manifestCodes.get(path) ?? 200;
      const body = fixture.manifestBodies.get(path) ?? {
        status: manifestStatus(fixture.root, fixture.manifestGenerations.get(path) ?? fixture.generation),
        generation: fixture.manifestGenerations.get(path) ?? fixture.generation,
        total: fixture.records.get(path)?.length ?? 0,
        limit: 500,
        offset: 0,
        files: fixture.records.get(path) ?? [],
      };
      return jsonResponse(body, code);
    }
    if (url.startsWith(`${X4_UI_CORPUS_FILE_URL}?`)) {
      const path = pathFromQuery(url, 'path');
      if (fixture.fileErrors.has(path)) throw new Error('network');
      const code = fixture.fileCodes.get(path) ?? 200;
      const contentType = fixture.fileContentTypes.get(path) ?? 'application/xml';
      if (fixture.fileNoArrayBuffer.has(path)) return { status: code, headers: responseHeaders(contentType) };
      return bytesResponse(fixture.buffers.get(path) ?? new Uint8Array(), code, contentType);
    }
    throw new Error(`unexpected color URL ${url}`);
  };
}

function colorOptions(fixture: ColorFixture, extra: Partial<X4UiCorpusCanonicalColorLoadOptions> = {}): X4UiCorpusCanonicalColorLoadOptions {
  return { transport: makeColorTransport(fixture), ...extra };
}

async function loadColorSelftestResult(
  fixture = makeColorFixture(),
  expectedHashes: readonly string[] = [X4_UI_CORPUS_COLORS_XML_SHA256, X4_UI_CORPUS_COLORS_XSD_SHA256],
): Promise<X4UiCorpusCanonicalColorSuccess> {
  const result = await withCanonicalPlatformHash(expectedHashes, () => loadCanonicalX4UiCorpusColorEvidence(colorOptions(fixture)));
  if (result.ok === false) throw new Error(`canonical color selftest loader failed: ${result.error.code}: ${result.error.message}`);
  return result;
}

async function expectColorFailure(
  fixture: ColorFixture,
  code: string,
  expectedHashes: readonly string[] = [X4_UI_CORPUS_COLORS_XML_SHA256, X4_UI_CORPUS_COLORS_XSD_SHA256],
  extra: Partial<X4UiCorpusCanonicalColorLoadOptions> = {},
): Promise<void> {
  const result = await withCanonicalPlatformHash(expectedHashes, () => loadCanonicalX4UiCorpusColorEvidence(colorOptions(fixture, extra)));
  if (result.ok) throw new Error(`expected canonical color failure ${code}`);
  equal((result as X4UiCorpusFailureResult).error.code, code, 'canonical color failure code');
}

function makeTransport(fixture: Fixture): (url: string, init?: { readonly signal?: AbortSignal }) => Promise<X4UiCorpusFetchResponse> {
  return async url => {
    fixture.calls.push(url);
    if (url === X4_UI_CORPUS_STATUS_URL) {
      const index = Math.min(fixture.calls.filter(call => call === X4_UI_CORPUS_STATUS_URL).length - 1, fixture.statusBodies.length - 1);
      return jsonResponse(fixture.statusBodies[index], fixture.statusCodes[index] ?? 200);
    }
    if (url.startsWith(`${X4_UI_CORPUS_MANIFEST_URL}?`)) {
      const path = pathFromQuery(url, 'q');
      if (fixture.fileErrors.has(`manifest:${path}`)) throw new Error('network');
      const code = fixture.manifestCodes.get(path) ?? 200;
      const body = fixture.manifestBodies.get(path) ?? {
        status: manifestStatus(fixture.root, fixture.manifestGenerations.get(path) ?? fixture.generation),
        generation: fixture.manifestGenerations.get(path) ?? fixture.generation,
        total: fixture.records.get(path)?.length ?? 0,
        limit: 500,
        offset: 0,
        files: fixture.records.get(path) ?? [],
      };
      return jsonResponse(body, code);
    }
    if (url.startsWith(`${X4_UI_CORPUS_FILE_URL}?`)) {
      const path = pathFromQuery(url, 'path');
      if (fixture.fileErrors.has(path)) throw new Error('network');
      const code = fixture.fileCodes.get(path) ?? 200;
      const contentType = fixture.fileContentTypes.get(path)
        ?? (path.endsWith('.lua') ? 'text/plain' : 'application/octet-stream');
      if (fixture.fileNoArrayBuffer.has(path)) return { status: code, headers: responseHeaders(contentType) };
      return bytesResponse(fixture.buffers.get(path) ?? new Uint8Array(), code, contentType);
    }
    throw new Error(`unexpected URL ${url}`);
  };
}

function options(fixture: Fixture, extra: Partial<X4UiCorpusLoadOptions> = {}): X4UiCorpusLoadOptions {
  return { transport: makeTransport(fixture), ...extra };
}

function pathForKind(contract: X4UiCorpusAssetContract, kind: X4UiCorpusAssetKind): string {
  switch (kind) {
    case 'helper': return contract.helper.relativePath;
    case 'widget': return contract.widget.relativePath;
    case 'regular-descriptor': return contract.regular.descriptor.relativePath;
    case 'regular-atlas': return contract.regular.atlas.relativePath;
    case 'bold-descriptor': return contract.bold.descriptor.relativePath;
    case 'bold-atlas': return contract.bold.atlas.relativePath;
  }
}

async function replaceBytes(fixture: Fixture, kind: X4UiCorpusAssetKind, bytes: Uint8Array): Promise<void> {
  const path = pathForKind(fixture.contract, kind);
  const hash = await sha256(bytes);
  fixture.buffers.set(path, bytes);
  fixture.records.set(path, [{ path, bytes: bytes.byteLength }]);
  const expected = asset(path, hash);
  switch (kind) {
    case 'helper': fixture.contract = { ...fixture.contract, helper: expected }; break;
    case 'widget': fixture.contract = { ...fixture.contract, widget: expected }; break;
    case 'regular-descriptor': fixture.contract = { ...fixture.contract, regular: { ...fixture.contract.regular, descriptor: expected } }; break;
    case 'regular-atlas': fixture.contract = { ...fixture.contract, regular: { ...fixture.contract.regular, atlas: expected } }; break;
    case 'bold-descriptor': fixture.contract = { ...fixture.contract, bold: { ...fixture.contract.bold, descriptor: expected } }; break;
    case 'bold-atlas': fixture.contract = { ...fixture.contract, bold: { ...fixture.contract.bold, atlas: expected } }; break;
  }
}

async function expectFailure(
  resultPromise: Promise<{ readonly ok: boolean; readonly error?: { readonly code?: string } }>,
  code: string,
): Promise<void> {
  const result = await resultPromise;
  assert(result.ok === false, `expected ${code} refusal, received success`);
  equal(result.error?.code, code, 'failure code');
}

const tests: readonly [string, () => Promise<void>][] = [
  [
    'success sequencing, exact URLs, source preservation, and both font pairs',
    async () => {
      const fixture = await makeFixture();
      const before = new Map(Array.from(fixture.buffers, ([path, bytes]) => [path, bytes.slice()]));
      const result = await loadSyntheticX4UiCorpusAssets(fixture.contract, options(fixture));
      assert(result.ok, 'synthetic fixture should load');
      equal(result.evidenceKind, 'synthetic', 'synthetic evidence kind');
      equal(result.canonical, false, 'synthetic result cannot be canonical');
      equal(result.verification, X4_UI_CORPUS_VERIFICATION, 'verification boundary');
      equal(result.fontEvidence, ZEKTON_EVIDENCE_STATE, 'font evidence state');
      equal(result.assets.helper.text, '\uFEFF-- helper\r\nreturn "helper"\r\n', 'helper BOM/CRLF preservation');
      equal(result.assets.widget.text, '\uFEFF-- widget\r\nreturn "widget"\r\n', 'widget BOM/CRLF preservation');
      assert(result.assets.regular.decoded.descriptor.glyphCount === 1, 'regular descriptor decoded');
      assert(result.assets.bold.decoded.descriptor.glyphCount === 1, 'bold descriptor decoded');
      const manifestCalls = fixture.calls.slice(1, 7);
      const fileCalls = fixture.calls.slice(7, 13);
      const orderedKinds: X4UiCorpusAssetKind[] = ['helper', 'widget', 'regular-descriptor', 'regular-atlas', 'bold-descriptor', 'bold-atlas'];
      orderedKinds.forEach((kind, index) => {
        const path = pathForKind(fixture.contract, kind);
        assert(manifestCalls[index] === `${X4_UI_CORPUS_MANIFEST_URL}?q=${encodeURIComponent(path)}&limit=500&offset=0`, `exact manifest URL ${kind}`);
        assert(fileCalls[index] === `${X4_UI_CORPUS_FILE_URL}?path=${encodeURIComponent(path)}`, `exact file URL ${kind}`);
      });
      assert(fixture.calls[0] === X4_UI_CORPUS_STATUS_URL, 'status comes first');
      assert(fixture.calls[fixture.calls.length - 1] === X4_UI_CORPUS_STATUS_URL, 'final status comes last');
      assert(fixture.calls[5].includes('zekton%20bold_32'), 'bold space is URL encoded');
      for (const [path, bytes] of before) bytesEqual(fixture.buffers.get(path)!, bytes, `input unchanged ${path}`);
    },
  ],
  [
    'deterministic replay, frozen records, and copied output bytes',
    async () => {
      const firstFixture = await makeFixture();
      const secondFixture = await makeFixture();
      const first = await loadSyntheticX4UiCorpusAssets(firstFixture.contract, options(firstFixture));
      const second = await loadSyntheticX4UiCorpusAssets(secondFixture.contract, options(secondFixture));
      assert(first.ok && second.ok, 'replay fixtures should load');
      equal(JSON.stringify(first), JSON.stringify(second), 'deterministic replay');
      assert(Object.isFrozen(first) && Object.isFrozen(first.assets) && Object.isFrozen(first.assets.regular), 'ordinary output records frozen');
      assert(!Object.isFrozen(first.assets.helper.bytes), 'typed-array elements are not falsely claimed frozen');
      const source = firstFixture.buffers.get(firstFixture.contract.helper.relativePath)!;
      source[0] ^= 0xff;
      equal(first.assets.helper.text, '\uFEFF-- helper\r\nreturn "helper"\r\n', 'output does not alias response bytes');
      equal(first.assets.helper.bytes[0], 0xef, 'copied helper byte remains intact');
      (first.assets.helper.bytes as Uint8Array)[0] = 0;
      equal(first.assets.helper.text, '\uFEFF-- helper\r\nreturn "helper"\r\n', 'source text remains immutable after exposed-byte mutation');
      equal(first.assets.regular.decoded.atlas.alphaBytes[0], 0, 'decoder owns a separate DDS copy');
    },
  ],
  [
    'manifest generation binds every exact record',
    async () => {
      const fixture = await makeFixture();
      fixture.manifestGenerations.set(fixture.contract.bold.descriptor.relativePath, 'generation-2');
      await expectFailure(loadSyntheticX4UiCorpusAssets(fixture.contract, options(fixture)), 'generation-drift');
    },
  ],
  [
    'offline status is typed',
    async () => {
      const fixture = await makeFixture();
      fixture.fileErrors.add(`manifest:${fixture.contract.helper.relativePath}`);
      await expectFailure(loadSyntheticX4UiCorpusAssets(fixture.contract, options(fixture)), 'network');
      const offline = await loadSyntheticX4UiCorpusAssets(fixture.contract, {
        transport: async () => { throw new Error('offline'); },
      });
      assert(!offline.ok, 'offline status must refuse');
      await expectFailure(loadSyntheticX4UiCorpusAssets(fixture.contract, {
        transport: async () => { throw new Error('offline'); },
      }), 'offline');
    },
  ],
  [
    'file network failure and abort are typed',
    async () => {
      const fixture = await makeFixture();
      fixture.fileErrors.add(fixture.contract.helper.relativePath);
      await expectFailure(loadSyntheticX4UiCorpusAssets(fixture.contract, options(fixture)), 'network');
      const abortedController = new AbortController();
      abortedController.abort();
      const abortedFixture = await makeFixture();
      await expectFailure(loadSyntheticX4UiCorpusAssets(abortedFixture.contract, options(abortedFixture, { signal: abortedController.signal })), 'aborted');
      equal(abortedFixture.calls.length, 0, 'pre-aborted transport is not invoked');
    },
  ],
  [
    '202/indexing manifest is pending, not a success',
    async () => {
      const fixture = await makeFixture();
      const path = fixture.contract.helper.relativePath;
      fixture.manifestCodes.set(path, 202);
      fixture.manifestBodies.set(path, { status: { available: false, state: 'indexing', root: fixture.root } });
      await expectFailure(loadSyntheticX4UiCorpusAssets(fixture.contract, options(fixture)), 'manifest-pending');
    },
  ],
  [
    'malformed status and manifest are typed',
    async () => {
      const statusFixture = await makeFixture();
      statusFixture.statusBodies[0] = { available: true };
      await expectFailure(loadSyntheticX4UiCorpusAssets(statusFixture.contract, options(statusFixture)), 'status-malformed');
      const manifestFixture = await makeFixture();
      const path = manifestFixture.contract.helper.relativePath;
      manifestFixture.manifestBodies.set(path, { status: manifestStatus(manifestFixture.root, manifestFixture.generation), generation: manifestFixture.generation, files: 'not-an-array' });
      await expectFailure(loadSyntheticX4UiCorpusAssets(manifestFixture.contract, options(manifestFixture)), 'manifest-malformed');
    },
  ],
  [
    'manifest error and unavailable states are stable refusals',
    async () => {
      for (const state of ['error', 'unavailable']) {
        const statusFixture = await makeFixture();
        statusFixture.statusBodies[0] = {
          available: false,
          root: statusFixture.root,
          generatedAt: '2026-08-10T12:00:00.000Z',
          manifestGeneration: null,
          manifest: { available: false, state, root: statusFixture.root },
        };
        await expectFailure(loadSyntheticX4UiCorpusAssets(statusFixture.contract, options(statusFixture)), 'status-unavailable');

        const manifestFixture = await makeFixture();
        const path = manifestFixture.contract.helper.relativePath;
        manifestFixture.manifestBodies.set(path, {
          status: { available: false, state, root: manifestFixture.root },
          generation: manifestFixture.generation,
          files: manifestFixture.records.get(path),
        });
        await expectFailure(loadSyntheticX4UiCorpusAssets(manifestFixture.contract, options(manifestFixture)), 'manifest-unavailable');
      }
    },
  ],
  [
    'status and manifest non-2xx responses are typed',
    async () => {
      const statusFixture = await makeFixture();
      statusFixture.statusCodes[0] = 500;
      await expectFailure(loadSyntheticX4UiCorpusAssets(statusFixture.contract, options(statusFixture)), 'status-http');
      const manifestFixture = await makeFixture();
      manifestFixture.manifestCodes.set(manifestFixture.contract.helper.relativePath, 500);
      await expectFailure(loadSyntheticX4UiCorpusAssets(manifestFixture.contract, options(manifestFixture)), 'manifest-http');
    },
  ],
  [
    'duplicate and missing exact paths refuse',
    async () => {
      const duplicate = await makeFixture();
      const path = duplicate.contract.helper.relativePath;
      duplicate.records.set(path, [{ path, bytes: duplicate.buffers.get(path)!.byteLength }, { path, bytes: duplicate.buffers.get(path)!.byteLength }]);
      await expectFailure(loadSyntheticX4UiCorpusAssets(duplicate.contract, options(duplicate)), 'manifest-duplicate');
      const missing = await makeFixture();
      missing.records.set(missing.contract.helper.relativePath, []);
      await expectFailure(loadSyntheticX4UiCorpusAssets(missing.contract, options(missing)), 'asset-missing');
    },
  ],
  [
    'traversal, absolute, backslash, and NUL manifest paths refuse',
    async () => {
      for (const unsafePath of ['../helper.lua', '/absolute/helper.lua', 'C:/absolute/helper.lua', 'synthetic\\bad.lua', `synthetic/${'bad\u0000path'}.lua`]) {
        const fixture = await makeFixture();
        const expected = fixture.contract.helper.relativePath;
        fixture.records.set(expected, [{ path: unsafePath, bytes: fixture.buffers.get(expected)!.byteLength }]);
        await expectFailure(loadSyntheticX4UiCorpusAssets(fixture.contract, options(fixture)), 'path-invalid');
      }
    },
  ],
  [
    'final status generation drift refuses after bytes are read',
    async () => {
      const fixture = await makeFixture();
      fixture.statusBodies[1] = statusBody(fixture.root, 'generation-2');
      await expectFailure(loadSyntheticX4UiCorpusAssets(fixture.contract, options(fixture)), 'generation-drift');
    },
  ],
  [
    'file 404 and 500 are typed HTTP failures',
    async () => {
      for (const code of [404, 500]) {
        const fixture = await makeFixture();
        fixture.fileCodes.set(fixture.contract.helper.relativePath, code);
        await expectFailure(loadSyntheticX4UiCorpusAssets(fixture.contract, options(fixture)), 'file-http');
      }
    },
  ],
  [
    'malformed file body and manifest/file size mismatches refuse',
    async () => {
      const malformed = await makeFixture();
      malformed.fileNoArrayBuffer.add(malformed.contract.helper.relativePath);
      await expectFailure(loadSyntheticX4UiCorpusAssets(malformed.contract, options(malformed)), 'file-malformed');

      const manifestMismatch = await makeFixture();
      const manifestPath = manifestMismatch.contract.helper.relativePath;
      manifestMismatch.records.set(manifestPath, [{ path: manifestPath, bytes: manifestMismatch.buffers.get(manifestPath)!.byteLength + 1 }]);
      await expectFailure(loadSyntheticX4UiCorpusAssets(manifestMismatch.contract, options(manifestMismatch)), 'size-mismatch');

      const fileMismatch = await makeFixture();
      const filePath = fileMismatch.contract.helper.relativePath;
      const extended = new Uint8Array(fileMismatch.buffers.get(filePath)!.length + 1);
      extended.set(fileMismatch.buffers.get(filePath)!);
      fileMismatch.buffers.set(filePath, extended);
      await expectFailure(loadSyntheticX4UiCorpusAssets(fileMismatch.contract, options(fileMismatch)), 'size-mismatch');
    },
  ],
  [
    'Lua, ABC, and DDS caps are enforced before hashing',
    async () => {
      const lua = await makeFixture();
      await expectFailure(loadSyntheticX4UiCorpusAssets(lua.contract, options(lua, { byteCaps: { lua: 1 } })), 'size-limit');
      const abc = await makeFixture();
      await expectFailure(loadSyntheticX4UiCorpusAssets(abc.contract, options(abc, { byteCaps: { abc: 1 } })), 'size-limit');
      const dds = await makeFixture();
      await expectFailure(loadSyntheticX4UiCorpusAssets(dds.contract, options(dds, { byteCaps: { dds: 1 } })), 'size-limit');
    },
  ],
  [
    'hash mismatch and unavailable hash provider are typed',
    async () => {
      const mismatch = await makeFixture();
      const path = mismatch.contract.helper.relativePath;
      const changed = mismatch.buffers.get(path)!.slice();
      changed[changed.length - 1] ^= 0xff;
      mismatch.buffers.set(path, changed);
      mismatch.records.set(path, [{ path, bytes: changed.byteLength }]);
      await expectFailure(loadSyntheticX4UiCorpusAssets(mismatch.contract, options(mismatch)), 'hash-mismatch');
      const unavailable = await makeFixture();
      await expectFailure(loadSyntheticX4UiCorpusAssets(unavailable.contract, options(unavailable, { hashProvider: null })), 'hash-unavailable');
    },
  ],
  [
    'hash provider throw and invalid-length digest are typed',
    async () => {
      const throwing = await makeFixture();
      await expectFailure(loadSyntheticX4UiCorpusAssets(throwing.contract, options(throwing, {
        hashProvider: async () => { throw new Error('hash provider failed'); },
      })), 'hash-failed');
      const invalid = await makeFixture();
      await expectFailure(loadSyntheticX4UiCorpusAssets(invalid.contract, options(invalid, {
        hashProvider: async () => new Uint8Array(31),
      })), 'hash-failed');
    },
  ],
  [
    'invalid UTF-8 is checked after exact hashing',
    async () => {
      const fixture = await makeFixture();
      await replaceBytes(fixture, 'helper', new Uint8Array([0xef, 0xbf, 0xbd, 0xff]));
      await expectFailure(loadSyntheticX4UiCorpusAssets(fixture.contract, options(fixture)), 'utf8-invalid');
    },
  ],
  [
    'malformed ABC and DDS are refused by x4UiFontMetrics',
    async () => {
      const abc = await makeFixture();
      await replaceBytes(abc, 'regular-descriptor', new Uint8Array([0]));
      await expectFailure(loadSyntheticX4UiCorpusAssets(abc.contract, options(abc)), 'font-decode');
      const dds = await makeFixture();
      const malformedDds = makeDds();
      malformedDds[0] = 0;
      await replaceBytes(dds, 'regular-atlas', malformedDds);
      await expectFailure(loadSyntheticX4UiCorpusAssets(dds.contract, options(dds)), 'font-decode');
    },
  ],
  [
    'content-type drift is refused',
    async () => {
      const fixture = await makeFixture();
      fixture.fileContentTypes.set(fixture.contract.helper.relativePath, 'application/octet-stream');
      await expectFailure(loadSyntheticX4UiCorpusAssets(fixture.contract, options(fixture)), 'content-type');
    },
  ],
  [
    'abort during JSON body decoding stays aborted',
    async () => {
      const fixture = await makeFixture();
      const controller = new AbortController();
      const transport = async (url: string): Promise<X4UiCorpusFetchResponse> => {
        if (url !== X4_UI_CORPUS_STATUS_URL) throw new Error('unexpected request');
        return {
          status: 200,
          headers: responseHeaders('application/json; charset=utf-8'),
          json: async () => {
            controller.abort();
            const error = new Error('aborted while decoding JSON');
            error.name = 'AbortError';
            throw error;
          },
        };
      };
      await expectFailure(loadSyntheticX4UiCorpusAssets(fixture.contract, { transport, signal: controller.signal }), 'aborted');
    },
  ],
  [
    'source and manifest root identity drift refuse',
    async () => {
      const manifestFixture = await makeFixture();
      const manifestPath = manifestFixture.contract.helper.relativePath;
      manifestFixture.manifestBodies.set(manifestPath, {
        status: manifestStatus('different-root', manifestFixture.generation),
        generation: manifestFixture.generation,
        files: manifestFixture.records.get(manifestPath),
      });
      await expectFailure(loadSyntheticX4UiCorpusAssets(manifestFixture.contract, options(manifestFixture)), 'generation-drift');

      const statusFixture = await makeFixture();
      statusFixture.statusBodies[1] = statusBody('different-root', statusFixture.generation);
      await expectFailure(loadSyntheticX4UiCorpusAssets(statusFixture.contract, options(statusFixture)), 'generation-drift');
    },
  ],
  [
    'canonical identities cannot be overridden or relabeled synthetic',
    async () => {
      const fixture = await makeFixture();
      const attemptedOverride = { ...options(fixture), contract: fixture.contract } as unknown as X4UiCorpusLoadOptions;
      const result = await loadCanonicalX4UiCorpusAssets(attemptedOverride as never);
      assert(!result.ok, 'canonical wrapper must not accept synthetic contract override');
      assert(fixture.calls.some(url => url.includes(encodeURIComponent(HELPER_SOURCE_PATH))), 'canonical helper path remains pinned');
      const syntheticFixture = await makeFixture();
      const synthetic = await loadSyntheticX4UiCorpusAssets(syntheticFixture.contract, options(syntheticFixture));
      assert(synthetic.ok, 'synthetic fixture should load');
      equal(synthetic.evidenceKind, 'synthetic', 'synthetic label is fixed');
      assert(Object.isFrozen(synthetic), 'synthetic result is frozen against relabeling');
      equal(X4_UI_CORPUS_CANONICAL_EVIDENCE, 'canonical-9.00', 'canonical label remains distinct');
      equal(X4_UI_CORPUS_9_00_CONTRACT.helper.relativePath, HELPER_SOURCE_PATH, 'read-only canonical contract');
      equal(X4_UI_CORPUS_9_00_CONTRACT.widget.relativePath, WIDGET_SOURCE_PATH, 'read-only canonical widget contract');
    },
  ],
  [
    'fail-first: a canonical caller-supplied hash provider must not mint authority',
    async () => {
      let refused = false;
      try {
        await loadCanonicalSelftestResult(true);
      } catch (error) {
        refused = String(error).includes('does not accept a caller-supplied hash provider');
      }
      assert(refused, 'a lying canonical hash provider must be refused instead of producing authority');
    },
  ],
  [
    'fail-first: canonical hash provider TOCTOU and Proxy injection are ignored',
    async () => {
      for (const attack of ['post-check-mutation', 'proxy'] as const) {
        const attackState = { called: false, replacementCalls: 0 };
        let accepted = false;
        try {
          accepted = isX4UiCorpusCanonicalSuccess(await loadCanonicalSelftestResult(false, attack, attackState));
        } catch {
          accepted = false;
        }
        assert(accepted && !attackState.called, `${attack} hash injection must be ignored without calling the provider`);
      }
    },
  ],
  [
    'fail-first: canonical platform hashing is captured before option callbacks and first transport',
    async () => {
      for (const attack of ['property-callback', 'prototype-callback', 'bytecaps-callback', 'first-transport-crypto'] as const) {
        const attackState = { called: false, replacementCalls: 0 };
        let accepted = false;
        try {
          accepted = isX4UiCorpusCanonicalSuccess(await loadCanonicalSelftestResult(false, attack, attackState));
        } catch {
          accepted = false;
        }
        assert(accepted && !attackState.called && attackState.replacementCalls === 0, `${attack} must not replace the pre-bound platform digest`);
      }
    },
  ],
  [
    'canonical authority binds exact identity and rejects structural metric forgeries',
    async () => {
      const canonical = await loadCanonicalSelftestResult();
      assert(isX4UiCorpusCanonicalSuccess(canonical), 'owner-issued canonical fixture must be accepted');
      const productionSource = readFileSync('src/lib/x4UiCorpusAssets.ts', 'utf8');
      assert(!productionSource.includes('createCanonicalX4UiCorpusSelftestSuccess'), 'production corpus owner must not export a canonical selftest minting factory');
      assert(!/export\s+(?:async\s+)?function\s+\w*Selftest/.test(productionSource), 'production corpus owner must not export selftest functions');
      const registrationCallSites = productionSource.split(/\r?\n/).filter(line => line.includes('registerCanonicalAuthority(success)'));
      equal(registrationCallSites.length, 1, 'canonical authority registration must have one loader call site');
      equal((productionSource.match(/registerCanonicalAuthority\(/g) ?? []).length, 2, 'registration source must contain only its private declaration and loader call');
      const structuralClone = Object.freeze({ ...canonical });
      assert(!isX4UiCorpusCanonicalSuccess(structuralClone), 'structural canonical clone must be rejected');

      const original = canonical.fonts.regular;
      const forgedGlyph = { ...original.descriptor.glyphs[0], advance: original.descriptor.glyphs[0].advance + 1 };
      const forgedGlyphs = Object.freeze([forgedGlyph, ...original.descriptor.glyphs.slice(1)]);
      const forgedDescriptor = Object.freeze({
        ...original.descriptor,
        glyphs: forgedGlyphs,
        glyphRecords: forgedGlyphs,
      });
      const forgedRegular = Object.freeze({ ...original, descriptor: forgedDescriptor });
      const forged = Object.freeze({
        ...canonical,
        assets: Object.freeze({
          ...canonical.assets,
          regular: Object.freeze({ ...canonical.assets.regular, decoded: forgedRegular }),
        }),
        fonts: Object.freeze({ ...canonical.fonts, regular: forgedRegular }),
      });
      assert(!isX4UiCorpusCanonicalSuccess(forged), 'altered decoded metric must be rejected before scene use');

      const syntheticFixture = await makeFixture();
      const synthetic = await loadSyntheticX4UiCorpusAssets(syntheticFixture.contract, options(syntheticFixture));
      assert(synthetic.ok, 'synthetic fixture should load');
      assert(!isX4UiCorpusCanonicalSuccess(synthetic), 'synthetic result must not cross the canonical authority boundary');
    },
  ],
  [
    'canonical authority detects same-length evidence and decoded-alpha mutation',
    async () => {
      const mutateAndReject = async (
        label: string,
        mutate: (value: X4UiCorpusCanonicalSuccess) => void,
      ): Promise<void> => {
        const canonical = await loadCanonicalSelftestResult();
        mutate(canonical);
        assert(!isX4UiCorpusCanonicalSuccess(canonical), `${label} must invalidate canonical authority`);
      };
      await mutateAndReject('helper evidence', value => { (value.assets.helper.bytes as Uint8Array)[0] ^= 1; });
      await mutateAndReject('widget evidence', value => { (value.assets.widget.bytes as Uint8Array)[0] ^= 1; });
      await mutateAndReject('regular descriptor evidence', value => { (value.assets.regular.descriptor.bytes as Uint8Array)[0] ^= 1; });
      await mutateAndReject('regular atlas evidence', value => { (value.assets.regular.atlas.bytes as Uint8Array)[0] ^= 1; });
      await mutateAndReject('bold descriptor evidence', value => { (value.assets.bold.descriptor.bytes as Uint8Array)[0] ^= 1; });
      await mutateAndReject('bold atlas evidence', value => { (value.assets.bold.atlas.bytes as Uint8Array)[0] ^= 1; });
      await mutateAndReject('regular decoded alpha', value => { (value.fonts.regular.atlas.alphaBytes as Uint8Array)[0] ^= 1; });
      await mutateAndReject('bold decoded alpha', value => { (value.fonts.bold.atlas.alphaBytes as Uint8Array)[0] ^= 1; });
    },
  ],
  [
    'canonical colors load fixed evidence, defaults, order, and a closed 224/804 graph',
    async () => {
      const fixture = makeColorFixture();
      const result = await loadColorSelftestResult(fixture);
      assert(isX4UiCorpusCanonicalColorSuccess(result), 'owner-issued canonical color result should be accepted');
      equal(result.evidenceKind, X4_UI_CORPUS_COLOR_CANONICAL_EVIDENCE, 'canonical color evidence label');
      equal(result.canonicalIdentity, 'x4-9.00', 'canonical color identity');
      equal(result.verification, X4_UI_CORPUS_VERIFICATION, 'color verification boundary');
      equal(result.identities.xml.relativePath, X4_UI_CORPUS_COLORS_XML_PATH, 'XML path pin');
      equal(result.identities.xml.sha256, X4_UI_CORPUS_COLORS_XML_SHA256, 'XML hash pin');
      equal(result.identities.xml.size, X4_UI_CORPUS_COLORS_XML_SIZE, 'XML size pin');
      equal(X4_UI_CORPUS_9_00_COLOR_CONTRACT.xml.relativePath, X4_UI_CORPUS_COLORS_XML_PATH, 'public XML contract path');
      equal(X4_UI_CORPUS_9_00_COLOR_CONTRACT.xsd.relativePath, X4_UI_CORPUS_COLORS_XSD_PATH, 'public XSD contract path');
      equal(result.identities.xsd.relativePath, X4_UI_CORPUS_COLORS_XSD_PATH, 'XSD path pin');
      equal(result.identities.xsd.sha256, X4_UI_CORPUS_COLORS_XSD_SHA256, 'XSD hash pin');
      equal(result.identities.xsd.size, X4_UI_CORPUS_COLORS_XSD_SIZE, 'XSD size pin');
      equal(result.source.xml.sha256, X4_UI_CORPUS_COLORS_XML_SHA256, 'XML evidence hash');
      equal(result.source.xml.bytes.byteLength, X4_UI_CORPUS_COLORS_XML_SIZE, 'XML evidence bytes');
      equal(result.source.xsd.bytes.byteLength, X4_UI_CORPUS_COLORS_XSD_SIZE, 'XSD evidence bytes');
      equal(result.graph.baseColors.length, 224, 'base color count');
      equal(result.graph.mappings.length, 804, 'mapping count');
      equal(result.graph.baseColors[0].id, 'base_000', 'base document order');
      equal(result.graph.baseColors[0].r, 0, 'omitted r default');
      equal(result.graph.baseColors[0].g, 0, 'omitted g default');
      equal(result.graph.baseColors[0].b, 0, 'omitted b default');
      equal(result.graph.baseColors[0].a, 255, 'omitted a default');
      equal(result.graph.baseColors[0].glow, 0, 'omitted glow default');
      equal(result.graph.baseColors[1].r, 1, 'explicit r');
      equal(result.graph.baseColors[1].glow, 0.1, 'explicit glow');
      equal(result.graph.baseColors[0].source.index, 0, 'base source index');
      equal(result.graph.mappings[0].id, 'map_000', 'mapping document order');
      equal(result.graph.mappings[0].ref, 'base_000', 'mapping base reference');
      equal(result.graph.mappings[0].source.index, 0, 'mapping source index');
      assert(result.graph.mappings.every(mapping => result.graph.baseColors.some(color => color.id === mapping.ref)), 'every mapping resolves to a base color');
      assert(!JSON.stringify(result.graph).match(/runtime|effective|profile|daltonization/i), 'graph has no out-of-scope authority fields');
      equal(Object.keys(result.graph).join(','), 'baseColors,mappings', 'graph is a minimal enumerable plain graph');
      assert(Object.getPrototypeOf(result.graph) === Object.prototype, 'graph is plain');
      assert(Object.getPrototypeOf(result.graph.baseColors[0]) === Object.prototype, 'base records are plain');
      assert(recursivelyFrozen(result.graph), 'graph is recursively frozen');
      equal(JSON.stringify(JSON.parse(JSON.stringify(result.graph))), JSON.stringify(result.graph), 'graph round trips through JSON');
      const originalFixtureByte = fixture.buffers.get(X4_UI_CORPUS_COLORS_XML_PATH)![0];
      fixture.buffers.get(X4_UI_CORPUS_COLORS_XML_PATH)![0] ^= 1;
      equal(result.source.xml.bytes[0], originalFixtureByte, 'source evidence is detached from transport bytes');
      assert(fixture.calls.includes(`${X4_UI_CORPUS_FILE_URL}?path=${encodeURIComponent(X4_UI_CORPUS_COLORS_XML_PATH)}`), 'fixed XML file request');
      assert(fixture.calls.includes(`${X4_UI_CORPUS_FILE_URL}?path=${encodeURIComponent(X4_UI_CORPUS_COLORS_XSD_PATH)}`), 'fixed XSD file request');
    },
  ],
  [
    'color pins cannot be overridden and the six-asset loader public shape remains exact',
    async () => {
      const fixture = makeColorFixture();
      const attemptedOverride = { ...colorOptions(fixture), contract: { xml: { relativePath: 'attacker.xml', sha256: '0'.repeat(64) } } };
      const result = await withCanonicalPlatformHash([X4_UI_CORPUS_COLORS_XML_SHA256, X4_UI_CORPUS_COLORS_XSD_SHA256], () =>
        loadCanonicalX4UiCorpusColorEvidence(attemptedOverride as never));
      assert(result.ok, 'caller contract data must be ignored');
      assert(fixture.calls.every(call => !call.includes('attacker.xml')), 'caller path cannot replace canonical path');

      let providerCalled = false;
      const providerResult = await withCanonicalPlatformHash([X4_UI_CORPUS_COLORS_XML_SHA256, X4_UI_CORPUS_COLORS_XSD_SHA256], () =>
        loadCanonicalX4UiCorpusColorEvidence({
          ...colorOptions(makeColorFixture()),
          hashProvider: async () => { providerCalled = true; return new Uint8Array(32); },
        } as never));
      if (providerResult.ok || (providerResult as X4UiCorpusFailureResult).error.code !== 'contract-invalid') throw new Error('caller color hash provider must be refused');
      assert(!providerCalled, 'caller color hash provider was not called');

      const existing = await loadCanonicalSelftestResult();
      equal(Object.keys(existing).join(','), 'ok,statusIdentity,manifestGeneration,assets,fonts,helperSourceHash,widgetSourceHash,fontEvidence,verification,evidenceKind,canonical,canonicalIdentity', 'existing canonical result keys');
    },
  ],
  [
    'color XML/XSD hash, cap, UTF-8, and content-type failures are causal',
    async () => {
      await expectColorFailure(makeColorFixture(), 'hash-mismatch', ['0'.repeat(64), X4_UI_CORPUS_COLORS_XSD_SHA256]);
      await expectColorFailure(makeColorFixture(), 'hash-mismatch', [X4_UI_CORPUS_COLORS_XML_SHA256, '0'.repeat(64)]);
      await expectColorFailure(makeColorFixture(), 'size-limit', undefined, { byteCaps: { xml: 1 } });
      const invalidUtf8 = makeColorFixture();
      const invalidBytes = new Uint8Array(X4_UI_CORPUS_COLORS_XML_SIZE);
      invalidBytes.fill(0x20);
      invalidBytes.set([0xff, 0xfe]);
      invalidUtf8.buffers.set(X4_UI_CORPUS_COLORS_XML_PATH, invalidBytes);
      invalidUtf8.records.set(X4_UI_CORPUS_COLORS_XML_PATH, [{ path: X4_UI_CORPUS_COLORS_XML_PATH, bytes: invalidBytes.byteLength }]);
      const invalidResult = await withCanonicalPlatformHash([X4_UI_CORPUS_COLORS_XML_SHA256, X4_UI_CORPUS_COLORS_XSD_SHA256], () =>
        loadCanonicalX4UiCorpusColorEvidence(colorOptions(invalidUtf8)));
      if (invalidResult.ok) throw new Error('invalid color XML UTF-8 must fail');
      equal((invalidResult as X4UiCorpusFailureResult).error.code, 'utf8-invalid', 'color UTF-8 failure code');
      equal((invalidResult as X4UiCorpusFailureResult).error.message, 'The configured-corpus text source is not valid UTF-8.', 'color UTF-8 failure message');
      const wrongContentType = makeColorFixture();
      wrongContentType.fileContentTypes.set(X4_UI_CORPUS_COLORS_XSD_PATH, 'application/octet-stream');
      await expectColorFailure(wrongContentType, 'content-type');
    },
  ],
  [
    'color reuses status, manifest, file, abort, network, and generation refusal paths',
    async () => {
      const missing = makeColorFixture();
      missing.records.set(X4_UI_CORPUS_COLORS_XML_PATH, []);
      await expectColorFailure(missing, 'asset-missing');
      const duplicate = makeColorFixture();
      duplicate.records.set(X4_UI_CORPUS_COLORS_XML_PATH, [
        { path: X4_UI_CORPUS_COLORS_XML_PATH, bytes: X4_UI_CORPUS_COLORS_XML_SIZE },
        { path: X4_UI_CORPUS_COLORS_XML_PATH, bytes: X4_UI_CORPUS_COLORS_XML_SIZE },
      ]);
      await expectColorFailure(duplicate, 'manifest-duplicate');
      const manifestHttp = makeColorFixture();
      manifestHttp.manifestCodes.set(X4_UI_CORPUS_COLORS_XML_PATH, 500);
      await expectColorFailure(manifestHttp, 'manifest-http');
      const fileHttp = makeColorFixture();
      fileHttp.fileCodes.set(X4_UI_CORPUS_COLORS_XML_PATH, 404);
      await expectColorFailure(fileHttp, 'file-http');
      const network = makeColorFixture();
      network.fileErrors.add(X4_UI_CORPUS_COLORS_XML_PATH);
      await expectColorFailure(network, 'network');
      const statusHttp = makeColorFixture();
      statusHttp.statusCodes[0] = 503;
      await expectColorFailure(statusHttp, 'status-http');
      const malformedStatus = makeColorFixture();
      malformedStatus.statusBodies[0] = { available: true };
      await expectColorFailure(malformedStatus, 'status-malformed');
      const drift = makeColorFixture();
      drift.statusBodies[1] = statusBody(drift.root, 'color-generation-2');
      await expectColorFailure(drift, 'generation-drift');
      const controller = new AbortController();
      controller.abort();
      const aborted = makeColorFixture();
      await expectColorFailure(aborted, 'aborted', undefined, { signal: controller.signal });
      equal(aborted.calls.length, 0, 'pre-aborted color transport is not invoked');
    },
  ],
  [
    'color parser rejects malformed XML/XSD roots, containers, declarations, and records',
    async () => {
      const malformedCases: readonly [string, string, string][] = [
        ['truncated XML', '<colormap>', 'color-xml-malformed'],
        ['wrong root', '<wrong><colors/><mappings/></wrong>', 'color-structure'],
        ['DOCTYPE/entity', '<!DOCTYPE colormap [<!ENTITY x "y">]><colormap><colors/><mappings/></colormap>', 'color-xml-malformed'],
        ['missing colors', '<colormap><mappings/></colormap>', 'color-structure'],
        ['duplicate colors', '<colormap><colors/><colors/><mappings/></colormap>', 'color-structure'],
        ['missing mappings', '<colormap><colors/></colormap>', 'color-structure'],
        ['duplicate mappings', '<colormap><colors/><mappings/><mappings/></colormap>', 'color-structure'],
        ['unexpected root record', '<colormap><colors/><mappings/><unexpected/></colormap>', 'color-structure'],
      ];
      for (const [label, xml, code] of malformedCases) {
        const fixture = makeColorFixture();
        replaceColorXml(fixture, xml);
        await expectColorFailure(fixture, code);
        assert(label.length > 0, 'named malformed case');
      }
      const unexpectedNested = makeColorFixture();
      replaceColorXml(unexpectedNested, colorXmlText(unexpectedNested).replace('  <colors>\n', '  <colors>\n    <unexpected/>\n'));
      await expectColorFailure(unexpectedNested, 'color-structure');
      const malformedXsd = makeColorFixture();
      replaceColorXsd(malformedXsd, '<xs:schema>');
      await expectColorFailure(malformedXsd, 'color-xsd-malformed');
    },
  ],
  [
    'XML declaration target and grammar are exact and bounded',
    async () => {
      const body = '<colormap><colors/><mappings/></colormap>';
      const malformedDeclarations: readonly [string, string][] = [
        ['xmlx target', '<?xmlxversion="1.0"?>'],
        ['missing version', '<?xml encoding="UTF-8"?>'],
        ['unsupported version', '<?xml version="1.1"?>'],
        ['duplicate version', '<?xml version="1.0" version="1.0"?>'],
        ['unsupported member', '<?xml version="1.0" standalone="yes"?>'],
        ['arbitrary processing instruction', '<?pi value?>'],
      ];
      for (const [label, declaration] of malformedDeclarations) {
        const fixture = makeColorFixture();
        replaceColorXml(fixture, `${declaration}${body}`);
        await expectColorFailure(fixture, 'color-xml-malformed');
        assert(label.length > 0, 'named XML declaration case');
      }
      const afterContent = makeColorFixture();
      replaceColorXml(afterContent, `${body}<?xml version="1.0"?>`);
      await expectColorFailure(afterContent, 'color-xml-malformed');

      for (const declaration of [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<?xml version="1.0" encoding="utf-8" ?>',
      ]) {
        const fixture = makeColorFixture();
        replaceColorXml(fixture, colorXmlText(fixture).replace('<?xml version="1.0" encoding="UTF-8"?>', declaration));
        const result = await loadColorSelftestResult(fixture);
        equal(result.graph.baseColors.length, 224, 'valid XML declaration base color count');
        equal(result.graph.mappings.length, 804, 'valid XML declaration mapping count');
        assert(isX4UiCorpusCanonicalColorSuccess(result), 'valid XML declaration authority');
      }
    },
  ],
  [
    'XSD schema local name requires an exact root prefix binding',
    async () => {
      const pattern = '  <xs:simpleType name="identifier"><xs:restriction base="xs:string"><xs:pattern value="[a-zA-Z_][a-zA-Z0-9_]*"/></xs:restriction></xs:simpleType>';
      const declarations: readonly [string, string, string][] = [
        ['unnamespaced schema', '<schema>', '</schema>'],
        ['wrong namespace URI', '<xs:schema xmlns:xs="urn:not-xml-schema">', '</xs:schema>'],
        ['missing namespace binding', '<xs:schema>', '</xs:schema>'],
        ['wrong local name', '<xs:notSchema xmlns:xs="http://www.w3.org/2001/XMLSchema">', '</xs:notSchema>'],
      ];
      for (const [label, start, end] of declarations) {
        const fixture = makeColorFixture();
        replaceColorXsd(fixture, `<?xml version="1.0" encoding="UTF-8"?>\n${start}\n${pattern}\n${end}`);
        await expectColorFailure(fixture, 'color-xsd-malformed');
        assert(label.length > 0, 'named XSD namespace case');
      }
      const genericPrefix = makeColorFixture();
      replaceColorXsd(genericPrefix, `<?xml version="1.0" encoding="UTF-8"?>\n<generic:schema xmlns:generic="http://www.w3.org/2001/XMLSchema">\n${pattern}\n</generic:schema>`);
      const result = await loadColorSelftestResult(genericPrefix);
      equal(result.graph.baseColors.length, 224, 'generic XSD prefix base color count');
      equal(result.graph.mappings.length, 804, 'generic XSD prefix mapping count');
      assert(isX4UiCorpusCanonicalColorSuccess(result), 'generic XSD prefix authority');
    },
  ],
  [
    'legacy Lua UTF-8 failure message remains exact',
    async () => {
      const fixture = await makeFixture();
      await replaceBytes(fixture, 'helper', new Uint8Array([0xef, 0xbf, 0xbd, 0xff]));
      const result = await loadSyntheticX4UiCorpusAssets(fixture.contract, options(fixture));
      if (result.ok) throw new Error('invalid Lua UTF-8 must fail');
      equal((result as X4UiCorpusFailureResult).error.code, 'utf8-invalid', 'Lua UTF-8 failure code');
      equal((result as X4UiCorpusFailureResult).error.message, 'The configured-corpus Lua source is not valid UTF-8.', 'Lua UTF-8 failure message');
    },
  ],
  [
    'color parser rejects duplicate/invalid IDs, values, and non-base mapping references',
    async () => {
      const cases: readonly [string, string, string, string][] = [
        ['duplicate base ID', 'id="base_001"', 'id="base_000"', 'color-duplicate-id'],
        ['duplicate mapping ID', 'id="map_001"', 'id="map_000"', 'color-duplicate-id'],
        ['invalid ID', 'id="base_000"', 'id="bad-id"', 'color-invalid-id'],
        ['missing color ID', '<color id="base_000"', '<color', 'color-missing-id'],
        ['missing mapping ref', ' ref="base_000"', '', 'color-missing-ref'],
        ['unknown color attribute', '<color id="base_000"', '<color id="base_000" nope="1"', 'color-structure'],
        ['decimal channel', 'r="1"', 'r="1.5"', 'color-invalid-value'],
        ['NaN channel', 'g="2"', 'g="NaN"', 'color-invalid-value'],
        ['infinite channel', 'b="3"', 'b="Infinity"', 'color-invalid-value'],
        ['negative alpha', 'a="4"', 'a="-1"', 'color-invalid-value'],
        ['large alpha', 'a="4"', 'a="256"', 'color-invalid-value'],
        ['infinite glow', 'glow="0.1"', 'glow="Infinity"', 'color-invalid-value'],
        ['out-of-range glow', 'glow="0.1"', 'glow="2"', 'color-invalid-value'],
        ['missing base reference', 'ref="base_000"', 'ref="missing_base"', 'color-invalid-ref'],
        ['mapping-to-mapping reference', 'ref="base_000"', 'ref="map_000"', 'color-invalid-ref'],
      ];
      for (const [label, from, to, code] of cases) {
        const fixture = makeColorFixture();
        replaceColorXml(fixture, colorXmlText(fixture).replace(from, to));
        await expectColorFailure(fixture, code);
        assert(label.length > 0, 'named color parser case');
      }
      const childValue = makeColorFixture();
      replaceColorXml(childValue, colorXmlText(childValue).replace('<color id="base_000"/>', '<color id="base_000"><r>1</r></color>'));
      await expectColorFailure(childValue, 'color-structure');
    },
  ],
  [
    'color authority rejects clones and tampering without effective-profile overclaim',
    async () => {
      const canonical = await loadColorSelftestResult();
      assert(isX4UiCorpusCanonicalColorSuccess(canonical), 'canonical color authority accepts loader result');
      const structuralClone = Object.freeze({ ...canonical });
      assert(!isX4UiCorpusCanonicalColorSuccess(structuralClone), 'structural color clone rejected');
      const forgedGraph = Object.freeze({
        ...canonical,
        graph: Object.freeze({
          ...canonical.graph,
          baseColors: Object.freeze(canonical.graph.baseColors.slice(1)),
        }),
      });
      assert(!isX4UiCorpusCanonicalColorSuccess(forgedGraph), 'forged graph rejected');
      const sourceByte = canonical.source.xml.bytes[0];
      (canonical.source.xml.bytes as Uint8Array)[0] ^= 1;
      equal(isX4UiCorpusCanonicalColorSuccess(canonical), false, 'exposed source-byte mutation invalidates authority');
      (canonical.source.xml.bytes as Uint8Array)[0] = sourceByte;
      const fresh = await loadColorSelftestResult();
      let tamperThrew = false;
      try {
        Object.defineProperty(fresh.graph.baseColors[0], 'r', { value: 99 });
      } catch {
        tamperThrew = true;
      }
      const freshAccepted = isX4UiCorpusCanonicalColorSuccess(fresh);
      if (tamperThrew) assert(freshAccepted, 'frozen graph remains authoritative after rejected tamper');
      else assert(!freshAccepted, 'graph tamper invalidates authority');
      assert(tamperThrew || fresh.graph.baseColors[0].r === 0, 'graph remains frozen where supported');
      assert(!JSON.stringify(fresh.graph).match(/active|effective|default.?profile|engine|runtime/i), 'color graph does not claim engine authority');
    },
  ],
  [
    'hostile color option getters and proxies fail closed through the option boundary',
    async () => {
      const hostile = new Proxy({}, {
        get: () => { throw new Error('hostile getter'); },
        getPrototypeOf: () => { throw new Error('hostile prototype'); },
      });
      let result: Awaited<ReturnType<typeof loadCanonicalX4UiCorpusColorEvidence>>;
      try {
        result = await withCanonicalPlatformHash([X4_UI_CORPUS_COLORS_XML_SHA256, X4_UI_CORPUS_COLORS_XSD_SHA256], () =>
          loadCanonicalX4UiCorpusColorEvidence(hostile as never));
      } catch (error) {
        throw new Error(`hostile option escaped loader boundary: ${String(error)}`);
      }
      assert(!result.ok, 'hostile option must not be accepted');
    },
  ],
];

let passed = 0;
const failures: string[] = [];
for (const [name, test] of tests) {
  try {
    await test();
    passed += 1;
  } catch (error) {
    failures.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

console.log(`x4UiCorpusAssets selftest: ${passed}/${tests.length} passed`);
if (failures.length > 0) {
  for (const item of failures) console.error(`FAIL ${item}`);
  process.exitCode = 1;
  throw new Error(`${failures.length} selftest case(s) failed.`);
}
