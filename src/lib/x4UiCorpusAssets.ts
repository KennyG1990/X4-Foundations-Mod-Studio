/**
 * Browser-only evidence boundary for the configured X4 unpacked corpus.
 *
 * This module deliberately owns transport, manifest binding, byte hashing, and
 * source/font evidence only. It does not discover a corpus, read a filesystem,
 * add an endpoint, render UI, or choose layout policy.
 */

import {
  MAX_SAFE_DESCRIPTOR_BYTES,
  MAX_SAFE_DDS_BYTES,
  ZEKTON_CORPUS_ASSETS,
  ZEKTON_EVIDENCE_STATE,
  decodeZektonFontAssets,
  type ZektonFontAssets,
} from './x4UiFontMetrics';

export const X4_UI_CORPUS_VERIFICATION = 'Not verified in game' as const;
export const X4_UI_CORPUS_CANONICAL_EVIDENCE = 'canonical-9.00' as const;
export const X4_UI_CORPUS_SYNTHETIC_EVIDENCE = 'synthetic' as const;

export const X4_UI_CORPUS_STATUS_URL = '/api/reference/status' as const;
export const X4_UI_CORPUS_MANIFEST_URL = '/api/reference/manifest' as const;
export const X4_UI_CORPUS_FILE_URL = '/api/reference/file' as const;

export const X4_UI_CORPUS_COLOR_CANONICAL_EVIDENCE = 'canonical-default-only' as const;
export const X4_UI_CORPUS_CANONICAL_COLOR_EVIDENCE = X4_UI_CORPUS_COLOR_CANONICAL_EVIDENCE;
export const X4_UI_CORPUS_COLORS_XML_PATH = 'libraries/colors.xml' as const;
export const X4_UI_CORPUS_COLORS_XML_SHA256 = '6A57FE660D546F5144206581A40194CE13D0D11478B584A46467F0AAE715B883' as const;
export const X4_UI_CORPUS_COLORS_XML_SIZE = 72950 as const;
export const X4_UI_CORPUS_COLORS_XSD_PATH = 'libraries/colors.xsd' as const;
export const X4_UI_CORPUS_COLORS_XSD_SHA256 = 'F0D31824E00227EFF6288B084E29346C5AA9D2694BFB0D62D6008EE3DBD879DF' as const;
export const X4_UI_CORPUS_COLORS_XSD_SIZE = 7981 as const;
export const X4_UI_CORPUS_COLOR_XML_PATH = X4_UI_CORPUS_COLORS_XML_PATH;
export const X4_UI_CORPUS_COLOR_XML_SHA256 = X4_UI_CORPUS_COLORS_XML_SHA256;
export const X4_UI_CORPUS_COLOR_XML_SIZE = X4_UI_CORPUS_COLORS_XML_SIZE;
export const X4_UI_CORPUS_COLOR_XSD_PATH = X4_UI_CORPUS_COLORS_XSD_PATH;
export const X4_UI_CORPUS_COLOR_XSD_SHA256 = X4_UI_CORPUS_COLORS_XSD_SHA256;
export const X4_UI_CORPUS_COLOR_XSD_SIZE = X4_UI_CORPUS_COLORS_XSD_SIZE;

export const HELPER_SOURCE_PATH = 'ui/addons/ego_detailmonitorhelper/helper.lua' as const;
export const HELPER_SOURCE_SHA256 = 'D24A08B8DA9F2C972794B60ACB48AE36F38CB026C991249DAB9F1164272D4DF2' as const;
export const WIDGET_SOURCE_PATH = 'ui/widget/lua/widget_fullscreen.lua' as const;
export const WIDGET_SOURCE_SHA256 = '420AFBA33D925A7B55F2A82AB12773DF04826EF588317010D209B249DE7BAED1' as const;

/** The loader's independent response caps. Decoder caps remain enforced too. */
export const MAX_SAFE_LUA_BYTES = 16 * 1024 * 1024;
export const DEFAULT_X4_UI_CORPUS_BYTE_CAPS = Object.freeze({
  lua: MAX_SAFE_LUA_BYTES,
  abc: MAX_SAFE_DESCRIPTOR_BYTES,
  dds: MAX_SAFE_DDS_BYTES,
});

export interface X4UiCorpusByteCaps {
  readonly lua: number;
  readonly abc: number;
  readonly dds: number;
  readonly xml?: number;
  readonly xsd?: number;
}

export const MAX_SAFE_XML_BYTES = 4 * 1024 * 1024;
export const MAX_SAFE_XSD_BYTES = 1 * 1024 * 1024;

export interface X4UiCorpusFetchHeaders {
  readonly get?: (name: string) => string | null;
}

/** A deliberately small Fetch-compatible response seam for browser and tests. */
export interface X4UiCorpusFetchResponse {
  readonly status: number;
  readonly ok?: boolean;
  readonly headers?: X4UiCorpusFetchHeaders;
  readonly json?: () => Promise<unknown>;
  readonly arrayBuffer?: () => Promise<ArrayBuffer | ArrayBufferView>;
}

export type X4UiCorpusTransport = (
  input: string,
  init?: { readonly signal?: AbortSignal },
) => Promise<X4UiCorpusFetchResponse>;

/** The explicit hash seam is useful in tests and still has browser semantics. */
export type X4UiCorpusSha256Provider = (
  bytes: Uint8Array,
) => Promise<ArrayBuffer | ArrayBufferView>;

export interface X4UiCorpusLoadOptions {
  /** Preferred name. `fetch` is accepted as a compatibility alias. */
  readonly transport?: X4UiCorpusTransport;
  readonly fetch?: X4UiCorpusTransport;
  readonly signal?: AbortSignal;
  /** `undefined` uses globalThis.crypto.subtle; null explicitly disables hashing. */
  readonly hashProvider?: X4UiCorpusSha256Provider | null;
  readonly byteCaps?: Partial<X4UiCorpusByteCaps>;
}

/** Canonical loading owns SHA-256 through global Web Crypto; callers cannot inject a provider. */
export interface X4UiCorpusCanonicalLoadOptions {
  readonly transport?: X4UiCorpusTransport;
  readonly fetch?: X4UiCorpusTransport;
  readonly signal?: AbortSignal;
  readonly byteCaps?: Partial<X4UiCorpusByteCaps>;
  readonly hashProvider?: never;
}

export interface X4UiCorpusCanonicalColorLoadOptions {
  readonly transport?: X4UiCorpusTransport;
  readonly fetch?: X4UiCorpusTransport;
  readonly signal?: AbortSignal;
  readonly byteCaps?: Pick<X4UiCorpusByteCaps, 'xml' | 'xsd'>;
  readonly hashProvider?: never;
}

interface X4UiCorpusInternalLoadOptions {
  readonly transport?: X4UiCorpusTransport;
  readonly fetch?: X4UiCorpusTransport;
  readonly signal?: AbortSignal;
  readonly byteCaps?: Partial<X4UiCorpusByteCaps>;
  readonly hashProvider?: X4UiCorpusSha256Provider | null;
}

export interface X4UiCorpusExpectedAsset {
  readonly relativePath: string;
  readonly sha256: string;
}

export interface X4UiCorpusAssetContract {
  readonly helper: X4UiCorpusExpectedAsset;
  readonly widget: X4UiCorpusExpectedAsset;
  readonly regular: {
    readonly descriptor: X4UiCorpusExpectedAsset;
    readonly atlas: X4UiCorpusExpectedAsset;
  };
  readonly bold: {
    readonly descriptor: X4UiCorpusExpectedAsset;
    readonly atlas: X4UiCorpusExpectedAsset;
  };
}

export type X4UiCorpusFailureCode =
  | 'offline'
  | 'network'
  | 'aborted'
  | 'status-http'
  | 'manifest-http'
  | 'file-http'
  | 'status-malformed'
  | 'manifest-malformed'
  | 'file-malformed'
  | 'status-unavailable'
  | 'manifest-unavailable'
  | 'manifest-pending'
  | 'path-invalid'
  | 'manifest-duplicate'
  | 'asset-missing'
  | 'generation-drift'
  | 'content-type'
  | 'size-limit'
  | 'size-mismatch'
  | 'hash-unavailable'
  | 'hash-failed'
  | 'hash-mismatch'
  | 'utf8-invalid'
  | 'font-decode'
  | 'color-xml-malformed'
  | 'color-xsd-malformed'
  | 'color-structure'
  | 'color-missing-id'
  | 'color-missing-ref'
  | 'color-invalid-id'
  | 'color-duplicate-id'
  | 'color-invalid-value'
  | 'color-invalid-ref'
  | 'color-graph-invalid'
  | 'contract-invalid'
  | 'internal-error';

export type X4UiCorpusEvidenceStage =
  | 'contract'
  | 'status'
  | 'manifest'
  | 'file'
  | 'hash'
  | 'text'
  | 'font'
  | 'color'
  | 'consistency';

export interface X4UiCorpusFailure {
  readonly code: X4UiCorpusFailureCode;
  readonly stage: X4UiCorpusEvidenceStage;
  readonly message: string;
  readonly assetKind?: X4UiCorpusAssetKind;
  readonly path?: string;
  readonly httpStatus?: number;
  readonly expected?: string | number;
  readonly actual?: string | number;
  readonly decoderCode?: string;
}

export interface X4UiCorpusFailureResult {
  readonly ok: false;
  readonly error: X4UiCorpusFailure;
}

export type X4UiCorpusAssetKind =
  | 'helper'
  | 'widget'
  | 'regular-descriptor'
  | 'regular-atlas'
  | 'bold-descriptor'
  | 'bold-atlas'
  | 'colors-xml'
  | 'colors-xsd';

type X4UiCorpusAssetEncoding = 'lua' | 'abc' | 'dds' | 'xml' | 'xsd';

interface X4UiCorpusInternalAsset extends X4UiCorpusExpectedAsset {
  readonly kind: X4UiCorpusAssetKind;
  readonly encoding: X4UiCorpusAssetEncoding;
  readonly expectedBytes?: number;
}

interface X4UiCorpusFetchedAsset {
  readonly expected: X4UiCorpusInternalAsset;
  readonly bytes: Uint8Array;
  readonly sha256: string;
  readonly text?: string;
}

export interface X4UiCorpusStatusIdentity {
  readonly root: string;
  readonly generatedAt: string;
  readonly manifestGeneration: string;
  readonly manifestRoot: string;
  readonly manifestGeneratedAt: string;
}

export interface X4UiCorpusBinaryEvidence {
  readonly kind: X4UiCorpusAssetKind;
  readonly path: string;
  readonly relativePath: string;
  readonly sha256: string;
  readonly size: number;
  /** This is a copied view; the loader never aliases a transport buffer. */
  readonly bytes: Readonly<Uint8Array>;
}

export interface X4UiCorpusTextEvidence extends X4UiCorpusBinaryEvidence {
  readonly encoding: 'utf-8';
  readonly text: string;
}

export interface X4UiCorpusFontEvidence {
  readonly descriptor: X4UiCorpusBinaryEvidence;
  readonly atlas: X4UiCorpusBinaryEvidence;
  readonly decoded: ZektonFontAssets;
  readonly evidenceState: typeof ZEKTON_EVIDENCE_STATE;
}

interface X4UiCorpusSuccessBase {
  readonly ok: true;
  readonly statusIdentity: X4UiCorpusStatusIdentity;
  readonly manifestGeneration: string;
  readonly assets: {
    readonly helper: X4UiCorpusTextEvidence;
    readonly widget: X4UiCorpusTextEvidence;
    readonly regular: X4UiCorpusFontEvidence;
    readonly bold: X4UiCorpusFontEvidence;
  };
  readonly fonts: {
    readonly regular: ZektonFontAssets;
    readonly bold: ZektonFontAssets;
  };
  readonly helperSourceHash: string;
  readonly widgetSourceHash: string;
  readonly fontEvidence: typeof ZEKTON_EVIDENCE_STATE;
  readonly verification: typeof X4_UI_CORPUS_VERIFICATION;
}

export interface X4UiCorpusCanonicalSuccess extends X4UiCorpusSuccessBase {
  readonly evidenceKind: typeof X4_UI_CORPUS_CANONICAL_EVIDENCE;
  readonly canonical: true;
  readonly canonicalIdentity: 'x4-9.00';
}

interface X4UiCorpusAuthorityPayload {
  readonly reference: Uint8Array;
  readonly snapshot: Uint8Array;
}

interface X4UiCorpusAuthorityRecord {
  readonly payloads: readonly X4UiCorpusAuthorityPayload[];
}

/**
 * Loader-issued canonical identity is intentionally private.  The scene may
 * ask whether a value is this exact result, but callers cannot mint a brand or
 * register a structurally similar clone.
 */
const CANONICAL_AUTHORITY = new WeakMap<object, X4UiCorpusAuthorityRecord>();

interface X4UiCorpusColorAuthorityRecord extends X4UiCorpusAuthorityRecord {
  readonly graphSnapshot: string;
}

const CANONICAL_COLOR_AUTHORITY = new WeakMap<object, X4UiCorpusColorAuthorityRecord>();

export interface X4UiCorpusSyntheticSuccess extends X4UiCorpusSuccessBase {
  readonly evidenceKind: typeof X4_UI_CORPUS_SYNTHETIC_EVIDENCE;
  readonly canonical: false;
  readonly canonicalIdentity: 'synthetic-contract';
}

export type X4UiCorpusCanonicalResult = X4UiCorpusCanonicalSuccess | X4UiCorpusFailureResult;
export type X4UiCorpusSyntheticResult = X4UiCorpusSyntheticSuccess | X4UiCorpusFailureResult;

export interface X4UiCorpusColorSourceContract extends X4UiCorpusExpectedAsset {
  readonly size: number;
}

export interface X4UiCorpusColorAssetContract {
  readonly xml: X4UiCorpusColorSourceContract;
  readonly xsd: X4UiCorpusColorSourceContract;
}

export interface X4UiCorpusColorSourceIdentity {
  readonly path: string;
  readonly relativePath: string;
  readonly sha256: string;
  readonly size: number;
}

export interface X4UiCorpusColorBaseDefinition {
  readonly id: string;
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
  readonly glow: number;
  readonly source: {
    readonly path: typeof X4_UI_CORPUS_COLORS_XML_PATH;
    readonly index: number;
    readonly id: string;
  };
}

export interface X4UiCorpusColorMappingDefinition {
  readonly id: string;
  readonly ref: string;
  readonly source: {
    readonly path: typeof X4_UI_CORPUS_COLORS_XML_PATH;
    readonly index: number;
    readonly id: string;
  };
}

export interface X4UiCorpusColorGraph {
  readonly baseColors: readonly X4UiCorpusColorBaseDefinition[];
  readonly mappings: readonly X4UiCorpusColorMappingDefinition[];
}

export interface X4UiCorpusCanonicalColorSuccess {
  readonly ok: true;
  readonly evidenceKind: typeof X4_UI_CORPUS_COLOR_CANONICAL_EVIDENCE;
  readonly canonical: true;
  readonly canonicalIdentity: 'x4-9.00';
  readonly verification: typeof X4_UI_CORPUS_VERIFICATION;
  readonly source: {
    readonly xml: X4UiCorpusTextEvidence;
    readonly xsd: X4UiCorpusTextEvidence;
  };
  readonly identities: {
    readonly xml: X4UiCorpusColorSourceIdentity;
    readonly xsd: X4UiCorpusColorSourceIdentity;
  };
  readonly graph: X4UiCorpusColorGraph;
}

export type X4UiCorpusCanonicalColorResult = X4UiCorpusCanonicalColorSuccess | X4UiCorpusFailureResult;
export type X4UiCorpusCanonicalColorsSuccess = X4UiCorpusCanonicalColorSuccess;
export type X4UiCorpusCanonicalColorsResult = X4UiCorpusCanonicalColorResult;

const CANONICAL_CONTRACT: X4UiCorpusAssetContract = deepFreeze({
  helper: { relativePath: HELPER_SOURCE_PATH, sha256: HELPER_SOURCE_SHA256 },
  widget: { relativePath: WIDGET_SOURCE_PATH, sha256: WIDGET_SOURCE_SHA256 },
  regular: {
    descriptor: {
      relativePath: ZEKTON_CORPUS_ASSETS.regular.descriptor.relativePath,
      sha256: ZEKTON_CORPUS_ASSETS.regular.descriptor.sha256,
    },
    atlas: {
      relativePath: ZEKTON_CORPUS_ASSETS.regular.atlas.relativePath,
      sha256: ZEKTON_CORPUS_ASSETS.regular.atlas.sha256,
    },
  },
  bold: {
    descriptor: {
      relativePath: ZEKTON_CORPUS_ASSETS.bold.descriptor.relativePath,
      sha256: ZEKTON_CORPUS_ASSETS.bold.descriptor.sha256,
    },
    atlas: {
      relativePath: ZEKTON_CORPUS_ASSETS.bold.atlas.relativePath,
      sha256: ZEKTON_CORPUS_ASSETS.bold.atlas.sha256,
    },
  },
});

/** Read-only view of the identities used by the canonical wrapper. */
export const X4_UI_CORPUS_9_00_CONTRACT = CANONICAL_CONTRACT;

const CANONICAL_COLOR_ASSETS: Readonly<Record<'colors-xml' | 'colors-xsd', X4UiCorpusInternalAsset>> = deepFreeze({
  'colors-xml': {
    kind: 'colors-xml',
    encoding: 'xml',
    relativePath: X4_UI_CORPUS_COLORS_XML_PATH,
    sha256: X4_UI_CORPUS_COLORS_XML_SHA256,
    expectedBytes: X4_UI_CORPUS_COLORS_XML_SIZE,
  },
  'colors-xsd': {
    kind: 'colors-xsd',
    encoding: 'xsd',
    relativePath: X4_UI_CORPUS_COLORS_XSD_PATH,
    sha256: X4_UI_CORPUS_COLORS_XSD_SHA256,
    expectedBytes: X4_UI_CORPUS_COLORS_XSD_SIZE,
  },
});

export const X4_UI_CORPUS_9_00_COLOR_CONTRACT: X4UiCorpusColorAssetContract = deepFreeze({
  xml: {
    relativePath: X4_UI_CORPUS_COLORS_XML_PATH,
    sha256: X4_UI_CORPUS_COLORS_XML_SHA256,
    size: X4_UI_CORPUS_COLORS_XML_SIZE,
  },
  xsd: {
    relativePath: X4_UI_CORPUS_COLORS_XSD_PATH,
    sha256: X4_UI_CORPUS_COLORS_XSD_SHA256,
    size: X4_UI_CORPUS_COLORS_XSD_SIZE,
  },
});

export const X4_UI_CORPUS_9_00_COLORS_CONTRACT = X4_UI_CORPUS_9_00_COLOR_CONTRACT;

const ASSET_ORDER: readonly X4UiCorpusAssetKind[] = Object.freeze([
  'helper',
  'widget',
  'regular-descriptor',
  'regular-atlas',
  'bold-descriptor',
  'bold-atlas',
]);

const COLOR_ASSET_ORDER = Object.freeze(['colors-xml', 'colors-xsd'] as const);

const PENDING_MANIFEST_STATES = new Set(['idle', 'indexing', 'scanning', 'stale', 'error']);

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== 'object') return value;
  if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) return value;
  const object = value as object;
  if (seen.has(object)) return value;
  seen.add(object);
  for (const key of Object.keys(object)) {
    deepFreeze((object as UnknownRecord)[key], seen);
  }
  return Object.freeze(value);
}

function collectAuthorityPayloads(
  value: unknown,
  seen = new WeakSet<object>(),
  payloads: X4UiCorpusAuthorityPayload[] = [],
): readonly X4UiCorpusAuthorityPayload[] {
  if (value === null || typeof value !== 'object') return payloads;
  if (value instanceof Uint8Array) {
    payloads.push({ reference: value, snapshot: value.slice() });
    return payloads;
  }
  if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) return payloads;
  const object = value as object;
  if (seen.has(object)) return payloads;
  seen.add(object);
  for (const key of Object.keys(value as UnknownRecord)) {
    collectAuthorityPayloads((value as UnknownRecord)[key], seen, payloads);
  }
  return payloads;
}

function frozenAuthorityGraph(value: unknown, seen = new WeakSet<object>()): boolean {
  if (value === null || typeof value !== 'object') return true;
  if (value instanceof Uint8Array || ArrayBuffer.isView(value) || value instanceof ArrayBuffer) return true;
  const object = value as object;
  if (seen.has(object)) return true;
  seen.add(object);
  return Object.isFrozen(object)
    && Object.keys(value as UnknownRecord).every(key => frozenAuthorityGraph((value as UnknownRecord)[key], seen));
}

function registerCanonicalAuthority(value: X4UiCorpusCanonicalSuccess): void {
  CANONICAL_AUTHORITY.set(value, {
    payloads: collectAuthorityPayloads(value).slice(),
  });
}

function authorityPayloadsUnchanged(record: X4UiCorpusAuthorityRecord): boolean {
  return record.payloads.every(payload => payload.reference.byteLength === payload.snapshot.byteLength
    && payload.reference.every((byte, index) => byte === payload.snapshot[index]));
}

/** Accept only an exact, loader-issued canonical result whose mutable bytes remain unchanged. */
export function isX4UiCorpusCanonicalSuccess(value: unknown): value is X4UiCorpusCanonicalSuccess {
  if (value === null || typeof value !== 'object') return false;
  const record = CANONICAL_AUTHORITY.get(value);
  if (!record || !frozenAuthorityGraph(value) || !authorityPayloadsUnchanged(record)) return false;
  const candidate = value as Partial<X4UiCorpusCanonicalSuccess>;
  return candidate.ok === true
    && candidate.evidenceKind === X4_UI_CORPUS_CANONICAL_EVIDENCE
    && candidate.canonical === true
    && candidate.canonicalIdentity === 'x4-9.00'
    && candidate.verification === X4_UI_CORPUS_VERIFICATION;
}

function registerCanonicalColorAuthority(value: X4UiCorpusCanonicalColorSuccess): void {
  CANONICAL_COLOR_AUTHORITY.set(value, {
    payloads: collectAuthorityPayloads(value).slice(),
    graphSnapshot: JSON.stringify(value.graph),
  });
}

/** Accept only a loader-issued canonical-default color graph. */
export function isX4UiCorpusCanonicalColorSuccess(value: unknown): value is X4UiCorpusCanonicalColorSuccess {
  if (value === null || typeof value !== 'object') return false;
  try {
    const record = CANONICAL_COLOR_AUTHORITY.get(value);
    if (!record || !frozenAuthorityGraph(value) || !authorityPayloadsUnchanged(record)) return false;
    const candidate = value as Partial<X4UiCorpusCanonicalColorSuccess>;
    return candidate.ok === true
      && candidate.evidenceKind === X4_UI_CORPUS_COLOR_CANONICAL_EVIDENCE
      && candidate.canonical === true
      && candidate.canonicalIdentity === 'x4-9.00'
      && candidate.verification === X4_UI_CORPUS_VERIFICATION
      && JSON.stringify(candidate.graph) === record.graphSnapshot;
  } catch {
    return false;
  }
}

function failure(
  code: X4UiCorpusFailureCode,
  stage: X4UiCorpusEvidenceStage,
  message: string,
  details: Omit<X4UiCorpusFailure, 'code' | 'stage' | 'message'> = {},
): X4UiCorpusFailureResult {
  return deepFreeze({
    ok: false as const,
    error: { code, stage, message, ...details },
  });
}

function isFailureResult(value: unknown): value is X4UiCorpusFailureResult {
  return isRecord(value) && value.ok === false && isRecord(value.error)
    && typeof value.error.code === 'string'
    && typeof value.error.stage === 'string'
    && typeof value.error.message === 'string';
}

function safeRelativePath(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length === 0) return undefined;
  if (
    value.includes('\\')
    || value.includes('\u0000')
    || value.startsWith('/')
    || value.startsWith('\\')
    || /^[A-Za-z]:/.test(value)
    || value.includes('://')
  ) return undefined;
  const segments = value.split('/');
  if (segments.some(segment => segment.length === 0 || segment === '.' || segment === '..')) return undefined;
  return value;
}

function safeHash(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value);
}

function contractAsset(
  value: unknown,
  kind: X4UiCorpusAssetKind,
  encoding: X4UiCorpusInternalAsset['encoding'],
  extension: string,
): X4UiCorpusInternalAsset | X4UiCorpusFailureResult {
  if (!isRecord(value)) {
    return failure('contract-invalid', 'contract', `${kind} contract record is malformed.`, { assetKind: kind });
  }
  const relativePath = typeof value.relativePath === 'string'
    ? value.relativePath
    : typeof value.path === 'string'
      ? value.path
      : undefined;
  if (typeof relativePath !== 'string' || safeRelativePath(relativePath) === undefined || !relativePath.endsWith(extension)) {
    return failure('contract-invalid', 'contract', `${kind} contract path is unsafe or has the wrong extension.`, {
      assetKind: kind,
      path: relativePath,
    });
  }
  if (!safeHash(value.sha256)) {
    return failure('contract-invalid', 'contract', `${kind} contract SHA-256 is malformed.`, {
      assetKind: kind,
      path: relativePath,
    });
  }
  return deepFreeze({ kind, encoding, relativePath, sha256: value.sha256 });
}

function cloneContract(value: unknown):
  | { readonly ok: true; readonly assets: Readonly<Record<X4UiCorpusAssetKind, X4UiCorpusInternalAsset>> }
  | X4UiCorpusFailureResult {
  if (!isRecord(value) || !isRecord(value.regular) || !isRecord(value.bold)) {
    return failure('contract-invalid', 'contract', 'X4 UI corpus asset contract is malformed.');
  }
  const entries: Array<[X4UiCorpusAssetKind, unknown, X4UiCorpusInternalAsset['encoding'], string]> = [
    ['helper', value.helper, 'lua', '.lua'],
    ['widget', value.widget, 'lua', '.lua'],
    ['regular-descriptor', value.regular.descriptor, 'abc', '.abc'],
    ['regular-atlas', value.regular.atlas, 'dds', '.dds'],
    ['bold-descriptor', value.bold.descriptor, 'abc', '.abc'],
    ['bold-atlas', value.bold.atlas, 'dds', '.dds'],
  ];
  const assets = {} as Record<X4UiCorpusAssetKind, X4UiCorpusInternalAsset>;
  const paths = new Set<string>();
  for (const [kind, raw, encoding, extension] of entries) {
    const candidate = contractAsset(raw, kind, encoding, extension);
    if (isFailureResult(candidate)) return candidate;
    if (paths.has(candidate.relativePath)) {
      return failure('contract-invalid', 'contract', `Duplicate contract path for ${kind}.`, {
        assetKind: kind,
        path: candidate.relativePath,
      });
    }
    paths.add(candidate.relativePath);
    assets[kind] = candidate;
  }
  return { ok: true, assets: deepFreeze(assets) };
}

function hasPropertyInPrototypeChain(value: object, property: string): boolean {
  const visited = new Set<object>();
  let current: object | null = value;
  while (current !== null && !visited.has(current)) {
    visited.add(current);
    if (Object.prototype.hasOwnProperty.call(current, property)) return true;
    current = Object.getPrototypeOf(current) as object | null;
  }
  return false;
}

function bindPlatformSha256(): X4UiCorpusSha256Provider | null {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle || typeof subtle.digest !== 'function') return null;
  const digest = subtle.digest.bind(subtle);
  return bytes => digest('SHA-256', bytes);
}

type X4UiCorpusLoaderEvidenceKind =
  | typeof X4_UI_CORPUS_CANONICAL_EVIDENCE
  | typeof X4_UI_CORPUS_SYNTHETIC_EVIDENCE
  | typeof X4_UI_CORPUS_COLOR_CANONICAL_EVIDENCE;

function isCanonicalLoaderEvidenceKind(value: X4UiCorpusLoaderEvidenceKind): boolean {
  return value === X4_UI_CORPUS_CANONICAL_EVIDENCE || value === X4_UI_CORPUS_COLOR_CANONICAL_EVIDENCE;
}

function snapshotLoadOptions(
  input: unknown,
  evidenceKind: X4UiCorpusLoaderEvidenceKind,
  canonicalHashProvider?: X4UiCorpusSha256Provider | null,
): X4UiCorpusInternalLoadOptions | X4UiCorpusFailureResult {
  if (input === null || typeof input !== 'object') return failure('contract-invalid', 'contract', 'Loader options are malformed.');
  const source = input as Record<string, unknown>;
  if (isCanonicalLoaderEvidenceKind(evidenceKind) && hasPropertyInPrototypeChain(input, 'hashProvider')) {
    return failure('contract-invalid', 'contract', 'Canonical corpus loading does not accept a caller-supplied hash provider.');
  }
  const rawCaps = source.byteCaps;
  const byteCaps: Partial<X4UiCorpusByteCaps> | undefined = isRecord(rawCaps)
    ? {
      lua: rawCaps.lua as number,
      abc: rawCaps.abc as number,
      dds: rawCaps.dds as number,
      xml: rawCaps.xml as number,
      xsd: rawCaps.xsd as number,
    }
    : rawCaps as Partial<X4UiCorpusByteCaps> | undefined;
  return {
    transport: typeof source.transport === 'function' ? source.transport as X4UiCorpusTransport : undefined,
    fetch: typeof source.fetch === 'function' ? source.fetch as X4UiCorpusTransport : undefined,
    signal: source.signal as AbortSignal | undefined,
    byteCaps,
    hashProvider: isCanonicalLoaderEvidenceKind(evidenceKind)
      ? canonicalHashProvider
      : source.hashProvider === undefined
        ? bindPlatformSha256()
        : source.hashProvider as X4UiCorpusSha256Provider | null,
  };
}

interface X4UiCorpusResolvedByteCaps {
  readonly lua: number;
  readonly abc: number;
  readonly dds: number;
  readonly xml: number;
  readonly xsd: number;
}

function resolveCaps(options: X4UiCorpusInternalLoadOptions): X4UiCorpusResolvedByteCaps | X4UiCorpusFailureResult {
  const supplied = options.byteCaps;
  const values: X4UiCorpusResolvedByteCaps = {
    lua: supplied?.lua ?? DEFAULT_X4_UI_CORPUS_BYTE_CAPS.lua,
    abc: supplied?.abc ?? DEFAULT_X4_UI_CORPUS_BYTE_CAPS.abc,
    dds: supplied?.dds ?? DEFAULT_X4_UI_CORPUS_BYTE_CAPS.dds,
    xml: supplied?.xml ?? MAX_SAFE_XML_BYTES,
    xsd: supplied?.xsd ?? MAX_SAFE_XSD_BYTES,
  };
  const safeMax: X4UiCorpusResolvedByteCaps = {
    lua: MAX_SAFE_LUA_BYTES,
    abc: MAX_SAFE_DESCRIPTOR_BYTES,
    dds: MAX_SAFE_DDS_BYTES,
    xml: MAX_SAFE_XML_BYTES,
    xsd: MAX_SAFE_XSD_BYTES,
  };
  for (const key of ['lua', 'abc', 'dds', 'xml', 'xsd'] as const) {
    if (!Number.isSafeInteger(values[key]) || values[key] <= 0 || values[key] > safeMax[key]) {
      return failure('contract-invalid', 'contract', `${key} byte cap is outside the safe bounded range.`);
    }
  }
  return values;
}

function transportFor(options: X4UiCorpusInternalLoadOptions): X4UiCorpusTransport | undefined {
  if (typeof options.transport === 'function') return options.transport;
  if (typeof options.fetch === 'function') return options.fetch;
  return undefined;
}

function isAbortError(error: unknown, signal: AbortSignal | undefined): boolean {
  if (signal?.aborted) return true;
  return isRecord(error) && error.name === 'AbortError';
}

async function request(
  transport: X4UiCorpusTransport,
  url: string,
  signal: AbortSignal | undefined,
  stage: X4UiCorpusEvidenceStage,
): Promise<{ readonly ok: true; readonly response: X4UiCorpusFetchResponse } | X4UiCorpusFailureResult> {
  if (signal?.aborted) return failure('aborted', stage, 'The configured-corpus request was aborted.');
  try {
    const response = await transport(url, signal ? { signal } : undefined);
    if (!isRecord(response) || !Number.isInteger(response.status)) {
      return failure(
        stage === 'status' || stage === 'consistency' ? 'status-malformed' : stage === 'manifest' ? 'manifest-malformed' : 'file-malformed',
        stage,
        'The configured-corpus endpoint returned a malformed response.',
      );
    }
    return { ok: true, response: response as X4UiCorpusFetchResponse };
  } catch (error) {
    if (isAbortError(error, signal)) return failure('aborted', stage, 'The configured-corpus request was aborted.');
    return failure(
      stage === 'status' || stage === 'consistency' ? 'offline' : 'network',
      stage,
      stage === 'status' || stage === 'consistency'
        ? 'The configured X4 corpus status endpoint is offline or unreachable.'
        : 'The configured X4 corpus endpoint is unreachable.',
    );
  }
}

function httpStatus(response: X4UiCorpusFetchResponse): number | undefined {
  return Number.isInteger(response.status) ? response.status : undefined;
}

function contentTypeFailure(
  response: X4UiCorpusFetchResponse,
  expected: readonly string[],
  stage: X4UiCorpusEvidenceStage,
  assetKind?: X4UiCorpusAssetKind,
): X4UiCorpusFailureResult | undefined {
  const get = response.headers?.get;
  if (typeof get !== 'function') return undefined;
  let contentType: string | null;
  try {
    contentType = get.call(response.headers, 'content-type');
  } catch {
    return failure('content-type', stage, 'The configured-corpus response content type could not be read.', { assetKind });
  }
  if (!contentType) return undefined;
  const mediaType = contentType.split(';', 1)[0]?.trim().toLowerCase();
  if (mediaType && !expected.includes(mediaType)) {
    return failure('content-type', stage, 'The configured-corpus response content type drifted.', {
      assetKind,
      actual: mediaType,
      expected: expected.join('|'),
    });
  }
  return undefined;
}

async function readJson(
  response: X4UiCorpusFetchResponse,
  code: 'status-malformed' | 'manifest-malformed',
  stage: 'status' | 'manifest' | 'consistency',
  signal: AbortSignal | undefined,
): Promise<unknown | X4UiCorpusFailureResult> {
  if (typeof response.json !== 'function') return failure(code, stage, 'The configured-corpus JSON response is malformed.');
  if (signal?.aborted) return failure('aborted', stage, 'The configured-corpus JSON response was aborted.');
  try {
    return await response.json();
  } catch (error) {
    if (isAbortError(error, signal)) return failure('aborted', stage, 'The configured-corpus JSON response was aborted.');
    return failure(code, stage, 'The configured-corpus JSON response could not be decoded.');
  }
}

interface ManifestStatusProjection {
  readonly root: string;
  readonly generation: string;
  readonly generatedAt: string;
}

function pendingFailure(
  stage: 'status' | 'manifest' | 'consistency',
  state: string,
): X4UiCorpusFailureResult {
  if (state === 'unavailable' || state === 'error') {
    return failure(
      stage === 'manifest' ? 'manifest-unavailable' : 'status-unavailable',
      stage,
      state === 'error'
        ? 'The configured X4 corpus manifest is in an error state.'
        : 'The configured X4 corpus manifest is unavailable.',
    );
  }
  return failure('manifest-pending', stage, `The configured X4 corpus manifest is ${state}, not ready.`);
}

function parseManifestStatus(
  value: unknown,
  stage: 'manifest' | 'consistency',
): ManifestStatusProjection | X4UiCorpusFailureResult {
  if (!isRecord(value) || typeof value.available !== 'boolean' || typeof value.state !== 'string' || typeof value.root !== 'string') {
    return failure('manifest-malformed', stage, 'The configured-corpus manifest status record is malformed.');
  }
  if (value.state === 'unavailable' || (value.available === false && value.state === 'ready')) {
    return pendingFailure(stage, value.state);
  }
  if (value.state !== 'ready') {
    return PENDING_MANIFEST_STATES.has(value.state)
      ? pendingFailure(stage, value.state)
      : failure('manifest-malformed', stage, 'The configured-corpus manifest state is unknown.');
  }
  if (value.available !== true || value.root.length === 0 || !isRecord(value.current)) {
    return failure('manifest-malformed', stage, 'The ready configured-corpus manifest status is incomplete.');
  }
  const current = value.current;
  if (
    typeof current.generation !== 'string'
    || current.generation.length === 0
    || typeof current.root !== 'string'
    || current.root.length === 0
    || typeof current.generatedAt !== 'string'
    || current.generatedAt.length === 0
  ) {
    return failure('manifest-malformed', stage, 'The ready configured-corpus manifest generation is malformed.');
  }
  if (current.root !== value.root) {
    return failure('generation-drift', stage, 'The configured-corpus manifest root changed within one response.');
  }
  return { root: value.root, generation: current.generation, generatedAt: current.generatedAt };
}

interface OuterStatusProjection {
  readonly identity: X4UiCorpusStatusIdentity;
  readonly manifest: ManifestStatusProjection;
}

function parseOuterStatus(value: unknown, stage: 'status' | 'consistency'): OuterStatusProjection | X4UiCorpusFailureResult {
  if (!isRecord(value) || typeof value.available !== 'boolean' || typeof value.root !== 'string' || typeof value.generatedAt !== 'string') {
    return failure('status-malformed', stage, 'The configured-corpus status response is malformed.');
  }
  const manifest = parseManifestStatus(value.manifest, stage === 'status' ? 'manifest' : 'consistency');
  if (isFailureResult(manifest)) {
    if (stage === 'status') {
      const statusCode = manifest.error.code === 'manifest-unavailable'
        ? 'status-unavailable'
        : manifest.error.code === 'manifest-malformed'
          ? 'status-malformed'
          : manifest.error.code;
      return failure(statusCode, stage, manifest.error.message, {
        assetKind: manifest.error.assetKind,
        path: manifest.error.path,
        expected: manifest.error.expected,
        actual: manifest.error.actual,
      });
    }
    return manifest;
  }
  if (value.available !== true || value.root.length === 0 || value.generatedAt.length === 0) {
    return failure('status-unavailable', stage, 'The configured X4 corpus status is unavailable.');
  }
  if (manifest.root !== value.root) {
    return failure('status-malformed', stage, 'The configured-corpus status root identities disagree.');
  }
  if (value.manifestGeneration !== null && value.manifestGeneration !== undefined && typeof value.manifestGeneration !== 'string') {
    return failure('status-malformed', stage, 'The configured-corpus manifest generation identity is malformed.');
  }
  if (typeof value.manifestGeneration === 'string' && value.manifestGeneration !== manifest.generation) {
    return failure('generation-drift', stage, 'The configured-corpus status and manifest generations disagree.');
  }
  const identity = deepFreeze({
    root: value.root,
    generatedAt: value.generatedAt,
    manifestGeneration: manifest.generation,
    manifestRoot: manifest.root,
    manifestGeneratedAt: manifest.generatedAt,
  });
  return { identity, manifest };
}

function sameStatusIdentity(left: X4UiCorpusStatusIdentity, right: X4UiCorpusStatusIdentity): boolean {
  return left.root === right.root
    && left.generatedAt === right.generatedAt
    && left.manifestGeneration === right.manifestGeneration
    && left.manifestRoot === right.manifestRoot
    && left.manifestGeneratedAt === right.manifestGeneratedAt;
}

async function readStatus(
  transport: X4UiCorpusTransport,
  signal: AbortSignal | undefined,
  stage: 'status' | 'consistency',
): Promise<OuterStatusProjection | X4UiCorpusFailureResult> {
  const requested = await request(transport, X4_UI_CORPUS_STATUS_URL, signal, stage);
  if (isFailureResult(requested)) return requested;
  const response = requested.response;
  const status = httpStatus(response);
  if (status === undefined || status < 200 || status >= 300) {
    return failure('status-http', stage, 'The configured-corpus status endpoint returned a non-success response.', { httpStatus: status });
  }
  const contentType = contentTypeFailure(response, ['application/json'], stage);
  if (contentType) return contentType;
  const body = await readJson(response, 'status-malformed', stage, signal);
  if (isFailureResult(body)) return body;
  return parseOuterStatus(body, stage);
}

interface ManifestRecord {
  readonly path: string;
  readonly bytes: number;
}

interface ManifestQueryResult {
  readonly generation: string;
  readonly status: ManifestStatusProjection;
  readonly record: ManifestRecord;
}

function parseManifestRecord(value: unknown, stage: 'manifest', expectedKind?: X4UiCorpusAssetKind): ManifestRecord | X4UiCorpusFailureResult {
  if (!isRecord(value) || typeof value.path !== 'string') {
    return failure('manifest-malformed', stage, 'A configured-corpus manifest record is malformed.', { assetKind: expectedKind });
  }
  const path = safeRelativePath(value.path);
  if (path === undefined) {
    return failure('path-invalid', stage, 'A configured-corpus manifest record contains an unsafe path.', {
      assetKind: expectedKind,
      path: value.path,
    });
  }
  if (typeof value.bytes !== 'number' || !Number.isSafeInteger(value.bytes) || value.bytes < 0) {
    return failure('manifest-malformed', stage, 'A configured-corpus manifest record has an invalid byte count.', {
      assetKind: expectedKind,
      path,
    });
  }
  return { path, bytes: value.bytes };
}

async function readManifest(
  transport: X4UiCorpusTransport,
  signal: AbortSignal | undefined,
  expected: X4UiCorpusInternalAsset,
  initial: OuterStatusProjection,
): Promise<ManifestQueryResult | X4UiCorpusFailureResult> {
  const url = `${X4_UI_CORPUS_MANIFEST_URL}?q=${encodeURIComponent(expected.relativePath)}&limit=500&offset=0`;
  const requested = await request(transport, url, signal, 'manifest');
  if (isFailureResult(requested)) return requested;
  const response = requested.response;
  const status = httpStatus(response);
  if (status === undefined) return failure('manifest-malformed', 'manifest', 'The configured-corpus manifest response status is malformed.', { assetKind: expected.kind });
  if (status !== 202 && (status < 200 || status >= 300)) {
    return failure('manifest-http', 'manifest', 'The configured-corpus manifest endpoint returned a non-success response.', {
      assetKind: expected.kind,
      httpStatus: status,
    });
  }
  const contentType = contentTypeFailure(response, ['application/json'], 'manifest', expected.kind);
  if (contentType) return contentType;
  const body = await readJson(response, 'manifest-malformed', 'manifest', signal);
  if (isFailureResult(body)) return body;
  if (!isRecord(body)) return failure('manifest-malformed', 'manifest', 'The configured-corpus manifest JSON is malformed.', { assetKind: expected.kind });

  const manifestStatus = parseManifestStatus(body.status, 'manifest');
  if (isFailureResult(manifestStatus)) return manifestStatus;
  if (manifestStatus.root !== initial.identity.manifestRoot || manifestStatus.generation !== initial.identity.manifestGeneration) {
    return failure('generation-drift', 'manifest', 'The configured-corpus manifest generation changed during loading.', {
      assetKind: expected.kind,
      expected: initial.identity.manifestGeneration,
      actual: manifestStatus.generation,
    });
  }
  if (typeof body.generation !== 'string' || body.generation.length === 0) {
    return failure('manifest-malformed', 'manifest', 'The configured-corpus manifest generation is missing.', { assetKind: expected.kind });
  }
  if (body.generation !== manifestStatus.generation) {
    return failure('generation-drift', 'manifest', 'The configured-corpus manifest response has conflicting generations.', {
      assetKind: expected.kind,
      expected: manifestStatus.generation,
      actual: body.generation,
    });
  }
  if (!Array.isArray(body.files)) {
    return failure('manifest-malformed', 'manifest', 'The configured-corpus manifest files list is malformed.', { assetKind: expected.kind });
  }
  const records: ManifestRecord[] = [];
  const seen = new Set<string>();
  for (const rawRecord of body.files) {
    const record = parseManifestRecord(rawRecord, 'manifest', expected.kind);
    if (isFailureResult(record)) return record;
    if (seen.has(record.path)) {
      return failure('manifest-duplicate', 'manifest', 'The configured-corpus manifest contains duplicate exact records.', {
        assetKind: expected.kind,
        path: record.path,
      });
    }
    seen.add(record.path);
    records.push(record);
  }
  const matches = records.filter(record => record.path === expected.relativePath);
  if (matches.length === 0) {
    return failure('asset-missing', 'manifest', 'The exact configured-corpus asset is missing from the manifest.', {
      assetKind: expected.kind,
      path: expected.relativePath,
    });
  }
  if (matches.length !== 1) {
    return failure('manifest-duplicate', 'manifest', 'The exact configured-corpus asset is ambiguous in the manifest.', {
      assetKind: expected.kind,
      path: expected.relativePath,
    });
  }
  if (expected.expectedBytes !== undefined && matches[0].bytes !== expected.expectedBytes) {
    return failure('size-mismatch', 'manifest', 'The configured-corpus manifest size differs from the pinned canonical size.', {
      assetKind: expected.kind,
      path: expected.relativePath,
      expected: expected.expectedBytes,
      actual: matches[0].bytes,
    });
  }
  return { generation: manifestStatus.generation, status: manifestStatus, record: matches[0] };
}

function bytesFromResponse(value: ArrayBuffer | ArrayBufferView): Uint8Array | undefined {
  if (value instanceof ArrayBuffer) return new Uint8Array(value).slice();
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength).slice();
  return undefined;
}

async function readFile(
  transport: X4UiCorpusTransport,
  signal: AbortSignal | undefined,
  expected: X4UiCorpusInternalAsset,
  manifest: ManifestRecord,
  caps: X4UiCorpusByteCaps,
): Promise<Uint8Array | X4UiCorpusFailureResult> {
  const url = `${X4_UI_CORPUS_FILE_URL}?path=${encodeURIComponent(expected.relativePath)}`;
  const requested = await request(transport, url, signal, 'file');
  if (isFailureResult(requested)) return requested;
  const response = requested.response;
  const status = httpStatus(response);
  if (status === undefined || status < 200 || status >= 300) {
    return failure('file-http', 'file', 'The configured-corpus file endpoint returned a non-success response.', {
      assetKind: expected.kind,
      path: expected.relativePath,
      httpStatus: status,
    });
  }
  const expectedContentType = expected.encoding === 'lua'
    ? ['text/plain']
    : expected.encoding === 'xml' || expected.encoding === 'xsd'
      ? ['application/xml', 'text/xml', 'application/xsd+xml', 'text/plain']
      : ['application/octet-stream'];
  const contentType = contentTypeFailure(response, expectedContentType, 'file', expected.kind);
  if (contentType) return contentType;
  if (typeof response.arrayBuffer !== 'function') {
    return failure('file-malformed', 'file', 'The configured-corpus file response has no byte body.', {
      assetKind: expected.kind,
      path: expected.relativePath,
    });
  }
  let raw: ArrayBuffer | ArrayBufferView;
  try {
    raw = await response.arrayBuffer();
  } catch (error) {
    if (isAbortError(error, signal)) return failure('aborted', 'file', 'The configured-corpus file request was aborted.', { assetKind: expected.kind, path: expected.relativePath });
    return failure('network', 'file', 'The configured-corpus file bytes could not be read.', { assetKind: expected.kind, path: expected.relativePath });
  }
  const bytes = bytesFromResponse(raw);
  if (!bytes) {
    return failure('file-malformed', 'file', 'The configured-corpus file body is not an ArrayBuffer.', {
      assetKind: expected.kind,
      path: expected.relativePath,
    });
  }
  const cap = caps[expected.encoding];
  if (bytes.byteLength > cap) {
    return failure('size-limit', 'file', 'The configured-corpus file exceeds its safe byte cap.', {
      assetKind: expected.kind,
      path: expected.relativePath,
      expected: cap,
      actual: bytes.byteLength,
    });
  }
  if (bytes.byteLength !== manifest.bytes) {
    return failure('size-mismatch', 'file', 'The configured-corpus file size differs from its manifest record.', {
      assetKind: expected.kind,
      path: expected.relativePath,
      expected: manifest.bytes,
      actual: bytes.byteLength,
    });
  }
  return bytes;
}

function copyDigestOutput(value: ArrayBuffer | ArrayBufferView): Uint8Array | undefined {
  return bytesFromResponse(value);
}

async function sha256(
  bytes: Uint8Array,
  provider: X4UiCorpusSha256Provider | null | undefined,
  expected: X4UiCorpusInternalAsset,
): Promise<string | X4UiCorpusFailureResult> {
  if (provider === undefined) {
    return failure('hash-unavailable', 'hash', 'Browser Web Crypto SHA-256 is unavailable.', {
      assetKind: expected.kind,
      path: expected.relativePath,
    });
  }
  if (provider === null || typeof provider !== 'function') {
    return failure('hash-unavailable', 'hash', 'No browser-compatible SHA-256 provider is available.', {
      assetKind: expected.kind,
      path: expected.relativePath,
    });
  }
  let digest: ArrayBuffer | ArrayBufferView;
  try {
    digest = await provider(bytes.slice());
  } catch {
    return failure('hash-failed', 'hash', 'The browser-compatible SHA-256 provider failed.', {
      assetKind: expected.kind,
      path: expected.relativePath,
    });
  }
  const digestBytes = copyDigestOutput(digest);
  if (!digestBytes || digestBytes.byteLength !== 32) {
    return failure('hash-failed', 'hash', 'The browser-compatible SHA-256 provider returned an invalid digest.', {
      assetKind: expected.kind,
      path: expected.relativePath,
    });
  }
  let actual = '';
  for (const byte of digestBytes) actual += byte.toString(16).padStart(2, '0');
  if (actual !== expected.sha256.toLowerCase()) {
    return failure('hash-mismatch', 'hash', 'The configured-corpus file bytes do not match the pinned SHA-256.', {
      assetKind: expected.kind,
      path: expected.relativePath,
      expected: expected.sha256.toLowerCase(),
      actual,
    });
  }
  return actual;
}

function decodeUtf8(bytes: Uint8Array, expected: X4UiCorpusInternalAsset): string | X4UiCorpusFailureResult {
  if (typeof TextDecoder !== 'function') {
    return failure('utf8-invalid', 'text', 'Fatal UTF-8 decoding is unavailable.', {
      assetKind: expected.kind,
      path: expected.relativePath,
    });
  }
  try {
    // ignoreBOM=true is intentional: source evidence must retain U+FEFF.
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes.slice());
  } catch {
    return failure('utf8-invalid', 'text', expected.encoding === 'lua'
      ? 'The configured-corpus Lua source is not valid UTF-8.'
      : 'The configured-corpus text source is not valid UTF-8.', {
      assetKind: expected.kind,
      path: expected.relativePath,
    });
  }
}

function identity(expected: X4UiCorpusInternalAsset): { readonly relativePath: string; readonly sha256: string } {
  return deepFreeze({ relativePath: expected.relativePath, sha256: expected.sha256 });
}

function binaryEvidence(fetched: X4UiCorpusFetchedAsset): X4UiCorpusBinaryEvidence {
  const bytes = fetched.bytes.slice();
  return deepFreeze({
    kind: fetched.expected.kind,
    path: fetched.expected.relativePath,
    relativePath: fetched.expected.relativePath,
    sha256: fetched.expected.sha256,
    size: bytes.byteLength,
    bytes,
  });
}

function textEvidence(fetched: X4UiCorpusFetchedAsset): X4UiCorpusTextEvidence {
  const bytes = fetched.bytes.slice();
  return deepFreeze({
    kind: fetched.expected.kind,
    path: fetched.expected.relativePath,
    relativePath: fetched.expected.relativePath,
    sha256: fetched.expected.sha256,
    size: bytes.byteLength,
    bytes,
    encoding: 'utf-8' as const,
    text: fetched.text || '',
  });
}

function buildSuccess(
  fetched: Readonly<Record<X4UiCorpusAssetKind, X4UiCorpusFetchedAsset>>,
  statusIdentity: X4UiCorpusStatusIdentity,
  evidenceKind: typeof X4_UI_CORPUS_CANONICAL_EVIDENCE | typeof X4_UI_CORPUS_SYNTHETIC_EVIDENCE,
): X4UiCorpusCanonicalSuccess | X4UiCorpusSyntheticSuccess | X4UiCorpusFailureResult {
  const helper = textEvidence(fetched.helper);
  const widget = textEvidence(fetched.widget);
  const regularDescriptor = binaryEvidence(fetched['regular-descriptor']);
  const regularAtlas = binaryEvidence(fetched['regular-atlas']);
  const boldDescriptor = binaryEvidence(fetched['bold-descriptor']);
  const boldAtlas = binaryEvidence(fetched['bold-atlas']);
  const regularDecoded = decodeZektonFontAssets(
    fetched['regular-descriptor'].bytes,
    identity(fetched['regular-descriptor'].expected),
    fetched['regular-atlas'].bytes,
    identity(fetched['regular-atlas'].expected),
  );
  if (regularDecoded.ok === false) {
    return deepFreeze({
      ok: false as const,
      error: {
        code: 'font-decode' as const,
        stage: 'font' as const,
        message: 'The regular Zekton descriptor/atlas pair was refused by x4UiFontMetrics.',
        assetKind: 'regular-descriptor' as const,
        decoderCode: regularDecoded.error.code,
      },
    });
  }
  const boldDecoded = decodeZektonFontAssets(
    fetched['bold-descriptor'].bytes,
    identity(fetched['bold-descriptor'].expected),
    fetched['bold-atlas'].bytes,
    identity(fetched['bold-atlas'].expected),
  );
  if (boldDecoded.ok === false) {
    return deepFreeze({
      ok: false as const,
      error: {
        code: 'font-decode' as const,
        stage: 'font' as const,
        message: 'The bold Zekton descriptor/atlas pair was refused by x4UiFontMetrics.',
        assetKind: 'bold-descriptor' as const,
        decoderCode: boldDecoded.error.code,
      },
    });
  }
  const regular = deepFreeze({
    descriptor: regularDescriptor,
    atlas: regularAtlas,
    decoded: regularDecoded.value,
    evidenceState: ZEKTON_EVIDENCE_STATE,
  });
  const bold = deepFreeze({
    descriptor: boldDescriptor,
    atlas: boldAtlas,
    decoded: boldDecoded.value,
    evidenceState: ZEKTON_EVIDENCE_STATE,
  });
  const base = {
    ok: true as const,
    statusIdentity,
    manifestGeneration: statusIdentity.manifestGeneration,
    assets: { helper, widget, regular, bold },
    fonts: { regular: regularDecoded.value, bold: boldDecoded.value },
    helperSourceHash: helper.sha256,
    widgetSourceHash: widget.sha256,
    fontEvidence: ZEKTON_EVIDENCE_STATE,
    verification: X4_UI_CORPUS_VERIFICATION,
  };
  if (evidenceKind === X4_UI_CORPUS_CANONICAL_EVIDENCE) {
    return deepFreeze({
      ...base,
      evidenceKind: X4_UI_CORPUS_CANONICAL_EVIDENCE,
      canonical: true as const,
      canonicalIdentity: 'x4-9.00' as const,
    });
  }
  return deepFreeze({
    ...base,
    evidenceKind: X4_UI_CORPUS_SYNTHETIC_EVIDENCE,
    canonical: false as const,
    canonicalIdentity: 'synthetic-contract' as const,
  });
}

interface X4UiCorpusFetchedBatch<K extends X4UiCorpusAssetKind> {
  readonly fetched: Readonly<Record<K, X4UiCorpusFetchedAsset>>;
  readonly statusIdentity: X4UiCorpusStatusIdentity;
}

async function loadFetchedAssets<K extends X4UiCorpusAssetKind>(
  assets: Readonly<Record<K, X4UiCorpusInternalAsset>>,
  order: readonly K[],
  transport: X4UiCorpusTransport,
  signal: AbortSignal | undefined,
  caps: X4UiCorpusResolvedByteCaps,
  hashProvider: X4UiCorpusSha256Provider | null | undefined,
): Promise<X4UiCorpusFetchedBatch<K> | X4UiCorpusFailureResult> {
  const initial = await readStatus(transport, signal, 'status');
  if (isFailureResult(initial)) return initial;
  const manifests = {} as Record<K, ManifestQueryResult>;
  for (const kind of order) {
    const manifest = await readManifest(transport, signal, assets[kind], initial);
    if (isFailureResult(manifest)) return manifest;
    manifests[kind] = manifest;
  }
  const fetched = {} as Record<K, X4UiCorpusFetchedAsset>;
  for (const kind of order) {
    const expected = assets[kind];
    const bytes = await readFile(transport, signal, expected, manifests[kind].record, caps);
    if (isFailureResult(bytes)) return bytes;
    const digest = await sha256(bytes, hashProvider, expected);
    if (isFailureResult(digest)) return digest;
    let text: string | undefined;
    if (expected.encoding === 'lua' || expected.encoding === 'xml' || expected.encoding === 'xsd') {
      const decoded = decodeUtf8(bytes, expected);
      if (isFailureResult(decoded)) return decoded;
      text = decoded;
    }
    fetched[kind] = { expected, bytes, sha256: digest, ...(text === undefined ? {} : { text }) };
  }
  const finalStatus = await readStatus(transport, signal, 'consistency');
  if (isFailureResult(finalStatus)) return finalStatus;
  if (!sameStatusIdentity(initial.identity, finalStatus.identity)) {
    return failure('generation-drift', 'consistency', 'The configured-corpus status identity changed during loading.', {
      expected: initial.identity.manifestGeneration,
      actual: finalStatus.identity.manifestGeneration,
    });
  }
  return { fetched, statusIdentity: initial.identity };
}

async function runLoader(
  contractInput: unknown,
  optionsInput: X4UiCorpusLoadOptions | X4UiCorpusCanonicalLoadOptions,
  evidenceKind: typeof X4_UI_CORPUS_CANONICAL_EVIDENCE | typeof X4_UI_CORPUS_SYNTHETIC_EVIDENCE,
  canonicalHashProvider?: X4UiCorpusSha256Provider | null,
): Promise<X4UiCorpusCanonicalResult | X4UiCorpusSyntheticResult> {
  let options: X4UiCorpusInternalLoadOptions | undefined;
  try {
    const snapshot = snapshotLoadOptions(optionsInput, evidenceKind, canonicalHashProvider);
    if (isFailureResult(snapshot)) return snapshot;
    options = snapshot;
    const contract = cloneContract(contractInput);
    if (isFailureResult(contract)) return contract;
    const caps = resolveCaps(options);
    if (isFailureResult(caps)) return caps;
    const transport = transportFor(options);
    if (!transport) return failure('network', 'status', 'A bounded fetch-compatible transport is required.');

    const loaded = await loadFetchedAssets(contract.assets, ASSET_ORDER, transport, options.signal, caps, options.hashProvider);
    if (isFailureResult(loaded)) return loaded;
    const success = buildSuccess(loaded.fetched, loaded.statusIdentity, evidenceKind);
    if (success.ok && evidenceKind === X4_UI_CORPUS_CANONICAL_EVIDENCE && success.evidenceKind === X4_UI_CORPUS_CANONICAL_EVIDENCE) registerCanonicalAuthority(success);
    return success;
  } catch (error) {
    if (isAbortError(error, options?.signal)) return failure('aborted', 'consistency', 'The configured-corpus request was aborted.');
    return failure('internal-error', 'consistency', 'The configured-corpus evidence loader encountered an unexpected failure.');
  }
}

interface X4UiCorpusXmlNode {
  readonly name: string;
  readonly attributes: Map<string, string>;
  readonly children: X4UiCorpusXmlNode[];
  text: string;
}

interface X4UiCorpusXmlParseResult {
  readonly root: X4UiCorpusXmlNode;
}

const XML_NAME_START = /[A-Za-z_]/;
const XML_NAME_CHAR = /[A-Za-z0-9_.:-]/;

function xmlWhitespace(value: string): boolean {
  return /^[\t\n\r ]*$/.test(value);
}

function xmlWhitespaceCharacter(value: string | undefined): boolean {
  return value !== undefined && /^[\t\n\r ]$/.test(value);
}

function isBoundedXmlDeclaration(value: string): boolean {
  if (!value.startsWith('xml') || !xmlWhitespaceCharacter(value[3])) return false;
  let cursor = 3;
  const members = new Set<'version' | 'encoding'>();
  let lastOrder = 0;
  while (cursor < value.length) {
    while (cursor < value.length && xmlWhitespaceCharacter(value[cursor])) cursor += 1;
    if (cursor >= value.length) break;
    const name = xmlName(value, cursor);
    if (!name || (name.name !== 'version' && name.name !== 'encoding') || members.has(name.name)) return false;
    const order = name.name === 'version' ? 1 : 2;
    if (order < lastOrder) return false;
    lastOrder = order;
    cursor = name.next;
    while (cursor < value.length && xmlWhitespaceCharacter(value[cursor])) cursor += 1;
    if (value[cursor] !== '=') return false;
    cursor += 1;
    while (cursor < value.length && xmlWhitespaceCharacter(value[cursor])) cursor += 1;
    const quote = value[cursor];
    if (quote !== '"' && quote !== "'") return false;
    cursor += 1;
    const valueStart = cursor;
    while (cursor < value.length && value[cursor] !== quote) cursor += 1;
    if (cursor >= value.length) return false;
    const memberValue = value.slice(valueStart, cursor);
    if (name.name === 'version' && memberValue !== '1.0') return false;
    if (name.name === 'encoding' && memberValue.toLowerCase() !== 'utf-8') return false;
    members.add(name.name);
    cursor += 1;
    if (cursor < value.length && !xmlWhitespaceCharacter(value[cursor])) return false;
  }
  return members.has('version');
}

function xmlName(source: string, index: number): { readonly name: string; readonly next: number } | undefined {
  if (index >= source.length || !XML_NAME_START.test(source[index])) return undefined;
  let next = index + 1;
  while (next < source.length && XML_NAME_CHAR.test(source[next])) next += 1;
  return { name: source.slice(index, next), next };
}

function decodeXmlEntities(value: string): string | undefined {
  let invalid = false;
  const decoded = value.replace(/&(#x[0-9A-Fa-f]+|#\d+|amp|lt|gt|quot|apos);/g, (_match, entity: string) => {
    if (entity === 'amp') return '&';
    if (entity === 'lt') return '<';
    if (entity === 'gt') return '>';
    if (entity === 'quot') return '"';
    if (entity === 'apos') return "'";
    const codePoint = entity.startsWith('#x')
      ? Number.parseInt(entity.slice(2), 16)
      : Number.parseInt(entity.slice(1), 10);
    if (!Number.isSafeInteger(codePoint) || codePoint <= 0 || codePoint > 0x10ffff) {
      invalid = true;
      return '';
    }
    try {
      return String.fromCodePoint(codePoint);
    } catch {
      invalid = true;
      return '';
    }
  });
  if (invalid || decoded.includes('&')) {
    if (/&[^;\s]*;?/.test(decoded)) return undefined;
  }
  return decoded;
}

function parseXmlDocument(sourceInput: string, code: 'color-xml-malformed' | 'color-xsd-malformed'): X4UiCorpusXmlParseResult | X4UiCorpusFailureResult {
  if (typeof sourceInput !== 'string' || sourceInput.length === 0) return failure(code, 'color', 'The configured color XML source is empty.');
  const source = sourceInput.charCodeAt(0) === 0xfeff ? sourceInput.slice(1) : sourceInput;
  const stack: X4UiCorpusXmlNode[] = [];
  let root: X4UiCorpusXmlNode | undefined;
  let index = 0;
  let declarationSeen = false;
  const malformed = (message: string): X4UiCorpusFailureResult => failure(code, 'color', message, {
    assetKind: code === 'color-xml-malformed' ? 'colors-xml' : 'colors-xsd',
  });
  const appendText = (raw: string): X4UiCorpusFailureResult | undefined => {
    const decoded = decodeXmlEntities(raw);
    if (decoded === undefined) return malformed('The configured color XML contains an unknown or invalid entity.');
    if (stack.length === 0) {
      return xmlWhitespace(decoded) ? undefined : malformed('The configured color XML contains text outside its root element.');
    }
    stack[stack.length - 1].text += decoded;
    return undefined;
  };

  while (index < source.length) {
    if (source[index] !== '<') {
      const next = source.indexOf('<', index);
      const end = next < 0 ? source.length : next;
      const error = appendText(source.slice(index, end));
      if (error) return error;
      index = end;
      continue;
    }
    if (source.startsWith('<!--', index)) {
      const end = source.indexOf('-->', index + 4);
      if (end < 0 || source.slice(index + 4, end).includes('--')) return malformed('The configured color XML contains an invalid comment.');
      index = end + 3;
      continue;
    }
    if (source.startsWith('<?', index)) {
      const end = source.indexOf('?>', index + 2);
      if (end < 0 || declarationSeen || root || stack.length > 0 || !isBoundedXmlDeclaration(source.slice(index + 2, end))) {
        return malformed('The configured color XML contains an unexpected processing instruction.');
      }
      declarationSeen = true;
      index = end + 2;
      continue;
    }
    if (source.startsWith('</', index)) {
      const closing = xmlName(source, index + 2);
      if (!closing) return malformed('The configured color XML has a malformed closing tag.');
      let end = closing.next;
      while (end < source.length && /[\t\n\r ]/.test(source[end])) end += 1;
      if (source[end] !== '>' || stack.length === 0 || stack[stack.length - 1].name !== closing.name) {
        return malformed('The configured color XML has mismatched closing tags.');
      }
      const closed = stack.pop()!;
      if (stack.length > 0) stack[stack.length - 1].children.push(closed);
      else if (root) return malformed('The configured color XML contains more than one root element.');
      else root = closed;
      index = end + 1;
      continue;
    }
    if (source.startsWith('<!', index)) return malformed('DOCTYPE, ENTITY, CDATA, and other declarations are not accepted.');

    const opening = xmlName(source, index + 1);
    if (!opening) return malformed('The configured color XML has a malformed opening tag.');
    const attributes = new Map<string, string>();
    let cursor = opening.next;
    let selfClosing = false;
    while (cursor < source.length) {
      while (cursor < source.length && /[\t\n\r ]/.test(source[cursor])) cursor += 1;
      if (source.startsWith('/>', cursor)) {
        selfClosing = true;
        cursor += 2;
        break;
      }
      if (source[cursor] === '>') {
        cursor += 1;
        break;
      }
      const attribute = xmlName(source, cursor);
      if (!attribute) return malformed('The configured color XML has a malformed attribute name.');
      cursor = attribute.next;
      while (cursor < source.length && /[\t\n\r ]/.test(source[cursor])) cursor += 1;
      if (source[cursor] !== '=') return malformed('The configured color XML has an unbound attribute.');
      cursor += 1;
      while (cursor < source.length && /[\t\n\r ]/.test(source[cursor])) cursor += 1;
      const quote = source[cursor];
      if (quote !== '"' && quote !== "'") return malformed('The configured color XML has an unquoted attribute.');
      cursor += 1;
      const valueStart = cursor;
      while (cursor < source.length && source[cursor] !== quote) cursor += 1;
      if (cursor >= source.length) return malformed('The configured color XML has an unterminated attribute.');
      const value = decodeXmlEntities(source.slice(valueStart, cursor));
      if (value === undefined || attributes.has(attribute.name)) return malformed('The configured color XML has an invalid or duplicate attribute.');
      attributes.set(attribute.name, value);
      cursor += 1;
    }
    if (cursor > source.length || (!selfClosing && source[cursor - 1] !== '>')) return malformed('The configured color XML has an unterminated opening tag.');
    if (root && stack.length === 0) return malformed('The configured color XML contains more than one root element.');
    const node: X4UiCorpusXmlNode = { name: opening.name, attributes, children: [], text: '' };
    if (selfClosing) {
      if (stack.length > 0) stack[stack.length - 1].children.push(node);
      else if (root) return malformed('The configured color XML contains more than one root element.');
      else root = node;
    } else {
      stack.push(node);
    }
    index = cursor;
  }
  if (stack.length > 0 || !root) return malformed('The configured color XML is truncated or has no root element.');
  return { root };
}

function colorFailure(
  code: Extract<X4UiCorpusFailureCode, `color-${string}`>,
  message: string,
  assetKind: X4UiCorpusAssetKind = 'colors-xml',
): X4UiCorpusFailureResult {
  return failure(code, 'color', message, { assetKind });
}

function colorNodeName(value: string): string {
  const separator = value.indexOf(':');
  return separator < 0 ? value : value.slice(separator + 1);
}

function validateColorXsd(source: string): X4UiCorpusFailureResult | true {
  const parsed = parseXmlDocument(source, 'color-xsd-malformed');
  if (isFailureResult(parsed)) return parsed;
  const rootSeparator = parsed.root.name.indexOf(':');
  const rootPrefix = rootSeparator > 0 ? parsed.root.name.slice(0, rootSeparator) : undefined;
  if (
    colorNodeName(parsed.root.name) !== 'schema'
    || rootPrefix === undefined
    || parsed.root.attributes.get(`xmlns:${rootPrefix}`) !== 'http://www.w3.org/2001/XMLSchema'
  ) {
    return colorFailure('color-xsd-malformed', 'The canonical color XSD root is not bound to the XML Schema namespace.', 'colors-xsd');
  }
  let hasIdPattern = false;
  const visit = (node: X4UiCorpusXmlNode): void => {
    if (node.attributes.get('value') === '[a-zA-Z_][a-zA-Z0-9_]*' || node.text.trim() === '[a-zA-Z_][a-zA-Z0-9_]*') hasIdPattern = true;
    for (const child of node.children) visit(child);
  };
  visit(parsed.root);
  return hasIdPattern
    ? true
    : colorFailure('color-xsd-malformed', 'The canonical color XSD does not declare the pinned identifier pattern.', 'colors-xsd');
}

function parseColorInteger(
  attributes: Map<string, string>,
  name: 'r' | 'g' | 'b' | 'a',
  fallback: number,
): number | X4UiCorpusFailureResult {
  const raw = attributes.get(name);
  if (raw === undefined) return fallback;
  if (!/^\d+$/.test(raw)) return colorFailure('color-invalid-value', `Color ${name} must be a decimal integer.`);
  const value = Number(raw);
  return Number.isSafeInteger(value) && value >= 0 && value <= 255
    ? value
    : colorFailure('color-invalid-value', `Color ${name} is outside the 0..255 range.`);
}

function parseColorGlow(attributes: Map<string, string>): number | X4UiCorpusFailureResult {
  const raw = attributes.get('glow');
  if (raw === undefined) return 0;
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw)) return colorFailure('color-invalid-value', 'Color glow must be a finite decimal.');
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 && value <= 1
    ? value
    : colorFailure('color-invalid-value', 'Color glow is outside the 0..1 range.');
}

function parseColorId(
  attributes: Map<string, string>,
  name: 'color' | 'mapping',
): string | X4UiCorpusFailureResult {
  const id = attributes.get('id');
  if (id === undefined) return colorFailure(name === 'color' ? 'color-missing-id' : 'color-missing-id', `${name} id is required.`);
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(id)) return colorFailure('color-invalid-id', `${name} id does not match the XSD identifier pattern.`);
  return id;
}

function ensureColorNodeAttributes(
  node: X4UiCorpusXmlNode,
  allowed: readonly string[],
): X4UiCorpusFailureResult | undefined {
  if (node.children.length > 0 || !xmlWhitespace(node.text)) return colorFailure('color-structure', `${node.name} contains unexpected nested content.`);
  for (const name of node.attributes.keys()) {
    if (!allowed.includes(name)) return colorFailure('color-structure', `${node.name} contains unexpected attribute ${name}.`);
  }
  return undefined;
}

function parseCanonicalColorGraph(xmlSource: string, xsdSource: string): X4UiCorpusColorGraph | X4UiCorpusFailureResult {
  const xsd = validateColorXsd(xsdSource);
  if (isFailureResult(xsd)) return xsd;
  const parsed = parseXmlDocument(xmlSource, 'color-xml-malformed');
  if (isFailureResult(parsed)) return parsed;
  if (parsed.root.name !== 'colormap' || !xmlWhitespace(parsed.root.text)) return colorFailure('color-structure', 'The canonical color XML root must be colormap.');
  const containers = parsed.root.children.filter(child => child.name === 'colors' || child.name === 'mappings');
  const colors = containers.filter(child => child.name === 'colors');
  const mappings = containers.filter(child => child.name === 'mappings');
  const daltonization = parsed.root.children.filter(child => child.name === 'daltonization');
  if (parsed.root.children.some(child => !['colors', 'mappings', 'daltonization'].includes(child.name))
    || colors.length !== 1 || mappings.length !== 1 || daltonization.length > 1
    || parsed.root.children.some(child => !xmlWhitespace(child.text))) {
    return colorFailure('color-structure', 'The canonical color XML must contain one colors and one mappings container.');
  }
  const ids = new Set<string>();
  const baseColors: X4UiCorpusColorBaseDefinition[] = [];
  for (const [index, node] of colors[0].children.entries()) {
    if (node.name !== 'color') return colorFailure('color-structure', 'The colors container contains an unexpected record.');
    const nested = ensureColorNodeAttributes(node, ['id', 'r', 'g', 'b', 'a', 'glow']);
    if (nested) return nested;
    const id = parseColorId(node.attributes, 'color');
    if (isFailureResult(id)) return id;
    if (ids.has(id)) return colorFailure('color-duplicate-id', `Duplicate color or mapping id ${id}.`);
    ids.add(id);
    const r = parseColorInteger(node.attributes, 'r', 0);
    const g = parseColorInteger(node.attributes, 'g', 0);
    const b = parseColorInteger(node.attributes, 'b', 0);
    const a = parseColorInteger(node.attributes, 'a', 255);
    const glow = parseColorGlow(node.attributes);
    if (isFailureResult(r)) return r;
    if (isFailureResult(g)) return g;
    if (isFailureResult(b)) return b;
    if (isFailureResult(a)) return a;
    if (isFailureResult(glow)) return glow;
    baseColors.push({
      id,
      r,
      g,
      b,
      a,
      glow,
      source: { path: X4_UI_CORPUS_COLORS_XML_PATH, index, id },
    });
  }
  const baseIds = new Set(baseColors.map(color => color.id));
  const mappingDefinitions: X4UiCorpusColorMappingDefinition[] = [];
  for (const [index, node] of mappings[0].children.entries()) {
    if (node.name !== 'mapping') return colorFailure('color-structure', 'The mappings container contains an unexpected record.');
    const nested = ensureColorNodeAttributes(node, ['id', 'ref']);
    if (nested) return nested;
    const id = parseColorId(node.attributes, 'mapping');
    if (isFailureResult(id)) return id;
    const ref = node.attributes.get('ref');
    if (ref === undefined) return colorFailure('color-missing-ref', 'Mapping ref is required.');
    if (ids.has(id)) return colorFailure('color-duplicate-id', `Duplicate color or mapping id ${id}.`);
    ids.add(id);
    if (!baseIds.has(ref)) return colorFailure('color-invalid-ref', `Mapping ${id} does not target a base color id.`);
    mappingDefinitions.push({
      id,
      ref,
      source: { path: X4_UI_CORPUS_COLORS_XML_PATH, index, id },
    });
  }
  if (baseColors.length !== 224 || mappingDefinitions.length !== 804) {
    return colorFailure('color-graph-invalid', `Canonical color graph must contain 224 base colors and 804 mappings; received ${baseColors.length}/${mappingDefinitions.length}.`);
  }
  return deepFreeze({ baseColors, mappings: mappingDefinitions });
}

async function runCanonicalColorLoader(
  optionsInput: X4UiCorpusCanonicalColorLoadOptions,
  canonicalHashProvider?: X4UiCorpusSha256Provider | null,
): Promise<X4UiCorpusCanonicalColorResult> {
  let options: X4UiCorpusInternalLoadOptions | undefined;
  try {
    const snapshot = snapshotLoadOptions(optionsInput, X4_UI_CORPUS_COLOR_CANONICAL_EVIDENCE, canonicalHashProvider);
    if (isFailureResult(snapshot)) return snapshot;
    options = snapshot;
    const caps = resolveCaps(options);
    if (isFailureResult(caps)) return caps;
    const transport = transportFor(options);
    if (!transport) return failure('network', 'status', 'A bounded fetch-compatible transport is required.');
    const loaded = await loadFetchedAssets(CANONICAL_COLOR_ASSETS, COLOR_ASSET_ORDER, transport, options.signal, caps, options.hashProvider);
    if (isFailureResult(loaded)) return loaded;
    const xml = textEvidence(loaded.fetched['colors-xml']);
    const xsd = textEvidence(loaded.fetched['colors-xsd']);
    const graph = parseCanonicalColorGraph(xml.text, xsd.text);
    if (isFailureResult(graph)) return graph;
    const success: X4UiCorpusCanonicalColorSuccess = deepFreeze({
      ok: true as const,
      evidenceKind: X4_UI_CORPUS_COLOR_CANONICAL_EVIDENCE,
      canonical: true as const,
      canonicalIdentity: 'x4-9.00' as const,
      verification: X4_UI_CORPUS_VERIFICATION,
      source: { xml, xsd },
      identities: {
        xml: {
          path: xml.path,
          relativePath: xml.relativePath,
          sha256: xml.sha256,
          size: xml.size,
        },
        xsd: {
          path: xsd.path,
          relativePath: xsd.relativePath,
          sha256: xsd.sha256,
          size: xsd.size,
        },
      },
      graph,
    });
    registerCanonicalColorAuthority(success);
    return success;
  } catch (error) {
    if (isAbortError(error, options?.signal)) return failure('aborted', 'consistency', 'The configured-corpus request was aborted.');
    return failure('internal-error', 'consistency', 'The configured color evidence loader encountered an unexpected failure.');
  }
}

/** Load the fixed X4 9.00 identities; caller input cannot replace or relabel them. */
export function loadCanonicalX4UiCorpusAssets(options: X4UiCorpusCanonicalLoadOptions): Promise<X4UiCorpusCanonicalResult> {
  const platformHashProvider = bindPlatformSha256();
  return runLoader(CANONICAL_CONTRACT, options, X4_UI_CORPUS_CANONICAL_EVIDENCE, platformHashProvider) as Promise<X4UiCorpusCanonicalResult>;
}

/**
 * Load an explicitly synthetic contract for deterministic tests. Its result is
 * permanently marked synthetic and cannot be promoted to canonical evidence.
 */
export function loadSyntheticX4UiCorpusAssets(
  contract: X4UiCorpusAssetContract,
  options: X4UiCorpusLoadOptions,
): Promise<X4UiCorpusSyntheticResult> {
  return runLoader(contract, options, X4_UI_CORPUS_SYNTHETIC_EVIDENCE) as Promise<X4UiCorpusSyntheticResult>;
}

/** Alias for callers that want the configured-corpus wording. */
export const loadConfiguredX4UiCorpusAssets = loadCanonicalX4UiCorpusAssets;

/** Load only the pinned canonical-default color XML/XSD evidence and graph. */
export function loadCanonicalX4UiCorpusColorEvidence(
  options: X4UiCorpusCanonicalColorLoadOptions,
): Promise<X4UiCorpusCanonicalColorResult> {
  const platformHashProvider = bindPlatformSha256();
  return runCanonicalColorLoader(options, platformHashProvider);
}

export const loadCanonicalX4UiCorpusColors = loadCanonicalX4UiCorpusColorEvidence;
export const loadConfiguredX4UiCorpusColorEvidence = loadCanonicalX4UiCorpusColorEvidence;
export const loadCanonicalX4UiCorpusColorAssets = loadCanonicalX4UiCorpusColorEvidence;
export const loadConfiguredX4UiCorpusColorAssets = loadCanonicalX4UiCorpusColorEvidence;
