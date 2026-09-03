/**
 * Pure, browser-compatible decoding of the shipped X4 9.00 Zekton bitmap
 * descriptor and uncompressed A8 DDS atlas.
 *
 * The descriptor field projection is source-backed but still inferred. The
 * game has not yet supplied font-size or presentation parity evidence, so
 * every successful result carries this explicit provisional state.
 */

export const ZEKTON_EVIDENCE_STATE = 'provisional-until-game-parity' as const;

export type ZektonEvidenceState = typeof ZEKTON_EVIDENCE_STATE;

export const ZEKTON_RECORD_SIZE = 24;
export const ZEKTON_DESCRIPTOR_HEADER_SIZE = 48;
export const ZEKTON_DESCRIPTOR_TRAILING_SIZE = 4;
/** The only ABC header format/version observed in the pinned X4 9.00 files. */
export const ZEKTON_ABC_FORMAT_VERSION = 9 as const;
/** Safety bound for the typed vertical header fields. */
export const MAX_SAFE_LINE_METRIC = 4096;
export const ZEKTON_DDS_HEADER_SIZE = 128;
export const ZEKTON_DDS_STANDARD_HEADER_SIZE = 124;
export const ZEKTON_DDS_PIXEL_FORMAT_SIZE = 32;

/** The largest Unicode code point representable by the descriptor map. */
export const MAX_UNICODE_CODE_POINT = 0x10ffff;

/**
 * Safety limits for untrusted bytes. They are comfortably above the shipped
 * 1024x2048 assets while bounding map, record, dimension, and payload work.
 */
export const MAX_SAFE_DESCRIPTOR_BYTES = 16 * 1024 * 1024;
export const MAX_SAFE_DDS_BYTES = 64 * 1024 * 1024;
export const MAX_SAFE_GLYPH_RECORDS = 0xffff;
export const MAX_SAFE_ATLAS_DIMENSION = 8192;
export const MAX_SAFE_ATLAS_PIXELS = 64 * 1024 * 1024;
export const MAX_SAFE_GLYPH_ADVANCE = 4096;
export const MAX_SAFE_HORIZONTAL_BEARING = 4096;
export const MAX_SAFE_RUN_CODE_UNITS = 1_000_000;

export interface ZektonAssetIdentity {
  readonly relativePath: string;
  readonly sha256: string;
  readonly [key: string]: unknown;
}

export interface ZektonProvenance {
  readonly identity: ZektonAssetIdentity;
  readonly evidenceState: ZektonEvidenceState;
}

/**
 * The exact corpus-relative identities reconciled for X4 9.00. These are
 * provenance constants, not a filesystem lookup or an implicit input source.
 */
export const ZEKTON_CORPUS_ASSETS = Object.freeze({
  regular: Object.freeze({
    descriptor: Object.freeze({
      relativePath: 'assets/fx/gui/fonts/textures/zekton_32.abc',
      sha256: '2E7D49EE1A6C8033403EBFE8B3FAB036A511999D1F8F9A287A257E0D52DF7598',
    }),
    atlas: Object.freeze({
      relativePath: 'assets/fx/gui/fonts/textures/zekton_32.dds',
      sha256: '19483C78A2BDE509A5D118C556AF465C03ADB6CA9126276673A9C924269CA2DA',
    }),
  }),
  bold: Object.freeze({
    descriptor: Object.freeze({
      relativePath: 'assets/fx/gui/fonts/textures/zekton bold_32.abc',
      sha256: '57A3F41D29B4835C0FBB6C4C0F78F28F2F7E1531A3478C8C10F1E2B6E4A91394',
    }),
    atlas: Object.freeze({
      relativePath: 'assets/fx/gui/fonts/textures/zekton bold_32.dds',
      sha256: 'A2BFCB11A4006E39BED99AF956C26F1DCE7C4092FFA63FC66CDA844D12019738',
    }),
  }),
});

/**
 * Immutable identity for the shipped X4 9.00 material/shader chain. This is
 * source provenance only; it is not a filesystem lookup or a game-runtime
 * verification claim.
 */
export const ZEKTON_SDF_SHADER_SOURCE = Object.freeze({
  material: Object.freeze({
    relativePath: 'libraries/material_library.xml',
    sha256: '4F211F83343FF5C19A4D8427AB25D195E2A124208B730976F9A411335271C047',
    shader: 'xu_ui_unlit_sdf',
    blendMode: 'ALPHA8_ANARK',
    bindings: Object.freeze({
      regular: 'zekton_32',
      bold: 'zekton bold_32',
    }),
  }),
  shaderBinding: Object.freeze({
    relativePath: 'shadergl/ogl/xu_ui_unlit_sdf.xml',
    sha256: '5E74955A40459D137C19CFCDAE35974FC0F2494E53E58C2CF4761597537E5768',
    diffuseFunc: false,
  }),
  fragment: Object.freeze({
    relativePath: 'shadergl/glsl/ui_unlit_sdf.frag.glsl',
    sha256: '753923F5EDD97AEEF00177FD59B8A43CAA1EC6E2B64F5ADDED59E3E530498968',
    expression: 'smoothstep(0.4, 0.6, 1.0 - texture(S_diffuse_map, IO_uv0).r)',
  }),
} as const);

export const ZEKTON_SDF_EDGE_LOW = 0.4 as const;
export const ZEKTON_SDF_EDGE_HIGH = 0.6 as const;
export const ZEKTON_SDF_RAW_ALPHA_MAX = 255 as const;

function assertZektonSdfInput(value: number, label: string, maximum: number): void {
  if (!Number.isFinite(value) || value < 0 || value > maximum) {
    throw new RangeError(`${label} must be finite and within [0, ${maximum}].`);
  }
}

/**
 * Apply the shipped fragment's smoothstep transfer and caller alpha to one
 * raw A8 texel, returning the deterministic positive-value half-up byte.
 * Browser Canvas resampling remains preview behavior and is not X4 runtime
 * parity.
 */
export function applyZektonSdfAlpha(rawAlpha: number, callerAlpha = 1): number {
  assertZektonSdfInput(rawAlpha, 'Zekton raw alpha', ZEKTON_SDF_RAW_ALPHA_MAX);
  assertZektonSdfInput(callerAlpha, 'Zekton caller alpha', 1);
  const x = 1 - rawAlpha / ZEKTON_SDF_RAW_ALPHA_MAX;
  const unclampedT = (x - ZEKTON_SDF_EDGE_LOW) / (ZEKTON_SDF_EDGE_HIGH - ZEKTON_SDF_EDGE_LOW);
  const t = Math.min(1, Math.max(0, unclampedT));
  const coverage = t * t * (3 - 2 * t);
  return Math.round(coverage * callerAlpha * ZEKTON_SDF_RAW_ALPHA_MAX);
}

export type ZektonByteInput = ArrayBuffer | ArrayBufferView | Uint8Array;

export type ZektonDecodeErrorCode =
  | 'invalid-input'
  | 'invalid-provenance'
  | 'input-too-large'
  | 'too-short'
  | 'invalid-header'
  | 'invalid-dimensions'
  | 'invalid-map'
  | 'invalid-record-count'
  | 'truncated-map'
  | 'invalid-alignment-padding'
  | 'truncated-records'
  | 'invalid-uv'
  | 'invalid-metric'
  | 'unsupported-page'
  | 'invalid-trailing-data'
  | 'invalid-magic'
  | 'invalid-dimensions-parity'
  | 'invalid-dimension-parity'
  | 'invalid-dds-header'
  | 'invalid-pixel-format'
  | 'unsupported-layout'
  | 'truncated-payload'
  | 'invalid-payload-length'
  | 'invalid-scale'
  | 'invalid-text'
  | 'measurement-overflow';

export interface ZektonDecodeError {
  readonly code: ZektonDecodeErrorCode;
  readonly message: string;
  readonly offset?: number;
}

export interface ZektonDecodeFailure {
  readonly ok: false;
  readonly error: ZektonDecodeError;
}

export interface ZektonDecodeSuccess<T> {
  readonly ok: true;
  readonly value: T;
  readonly identity: ZektonAssetIdentity;
  readonly provenance: ZektonProvenance;
  readonly evidenceState: ZektonEvidenceState;
}

export type ZektonDecodeResult<T> = ZektonDecodeSuccess<T> | ZektonDecodeFailure;

export interface ZektonUvBounds {
  /** Inferred normalized descriptor coordinates. */
  readonly u0: number;
  readonly v0: number;
  readonly u1: number;
  readonly v1: number;
}

export interface ZektonPixelBounds {
  /** UV coordinates multiplied by the descriptor atlas dimensions. */
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

export interface ZektonGlyphMetrics {
  readonly glyphIndex: number;
  readonly uv: ZektonUvBounds;
  readonly pixelBounds: ZektonPixelBounds;
  /** Inferred signed horizontal bearing from the observed int16 field. */
  readonly horizontalBearing: number;
  /** Evidence-supported alias for horizontalBearing; still provisional. */
  readonly bearingX: number;
  /** Inferred bitmap width from the observed uint16 field. */
  readonly bitmapWidth: number;
  /** Evidence-supported alias for bitmapWidth; still provisional. */
  readonly width: number;
  /** Inferred raw horizontal advance from the observed uint16 field. */
  readonly advance: number;
  /** Observed atlas page; only page zero is supported. */
  readonly page: number;
}

/**
 * The 2026-09-02 C.GetTextWidth oracle proves that native ABC pen advance is
 * horizontalBearing + advance. Raw descriptor fields remain separate; this
 * result is the explicit derived value used by measurement and layout.
 */
export type ZektonNativePenAdvanceResult =
  | { readonly ok: true; readonly value: number }
  | { readonly ok: false; readonly error: ZektonDecodeError };

/**
 * Source-backed vertical ABC fields. The split names stay offset-based: the
 * shipped files show an integer split, but do not prove a more specific role.
 */
export interface ZektonLineMetrics {
  readonly outer: number;
  readonly top: number;
  readonly bottom: number;
  readonly inner: number;
  readonly split20: number;
  readonly split24: number;
  /** Offset 28 is retained without assigning it a semantic meaning. */
  readonly rawMetric28: number;
}

export interface ZektonAbcHeader {
  readonly formatVersion: typeof ZEKTON_ABC_FORMAT_VERSION;
  readonly lineMetrics: ZektonLineMetrics;
  /** Offset 32 is reserved and must remain zero for the supported format. */
  readonly reserved32: 0;
  readonly atlasWidth: number;
  readonly atlasHeight: number;
  readonly maxCodepoint: number;
}

export interface ZektonAbcDescriptor {
  readonly format: 'x4-zekton-abc';
  readonly atlasWidth: number;
  readonly atlasHeight: number;
  readonly maxCodepoint: number;
  /** One entry per code point, containing the observed one-based index or 0. */
  readonly codePointToGlyphIndex: ReadonlyArray<number>;
  readonly map: ReadonlyArray<number>;
  /** Records are stored in zero-based array order; glyphIndex is one-based. */
  readonly glyphRecords: ReadonlyArray<ZektonGlyphMetrics>;
  readonly glyphs: ReadonlyArray<ZektonGlyphMetrics>;
  readonly glyphCount: number;
  readonly recordSize: typeof ZEKTON_RECORD_SIZE;
  readonly headerBytes: ReadonlyArray<number>;
  readonly header: ZektonAbcHeader;
  readonly lineMetrics: ZektonLineMetrics;
  readonly trailingBytes: ReadonlyArray<number>;
  readonly identity: ZektonAssetIdentity;
  readonly provenance: ZektonProvenance;
  readonly evidenceState: ZektonEvidenceState;
}

export interface ZektonDdsDimensions {
  readonly width: number;
  readonly height: number;
}

export interface ZektonA8DdsAtlas {
  readonly format: 'x4-zekton-a8-dds';
  readonly width: number;
  readonly height: number;
  readonly dimensions: ZektonDdsDimensions;
  readonly payloadOffset: typeof ZEKTON_DDS_HEADER_SIZE;
  readonly payloadLength: number;
  readonly mipMapCount: number;
  readonly depth: number;
  /** Copied raw alpha bytes. The decoder never aliases caller-provided bytes. */
  readonly alphaBytes: Readonly<Uint8Array>;
  readonly identity: ZektonAssetIdentity;
  readonly provenance: ZektonProvenance;
  readonly evidenceState: ZektonEvidenceState;
}

export interface ZektonFontAssets {
  readonly format: 'x4-zekton-font-assets';
  readonly descriptor: ZektonAbcDescriptor;
  readonly atlas: ZektonA8DdsAtlas;
  readonly descriptorIdentity: ZektonAssetIdentity;
  readonly atlasIdentity: ZektonAssetIdentity;
  readonly evidenceState: ZektonEvidenceState;
  readonly provenance: Readonly<{
    readonly descriptor: ZektonProvenance;
    readonly atlas: ZektonProvenance;
  }>;
}

export type ZektonFontAssetsResult =
  | {
      readonly ok: true;
      readonly value: ZektonFontAssets;
      readonly evidenceState: ZektonEvidenceState;
      readonly provenance: ZektonFontAssets['provenance'];
    }
  | ZektonDecodeFailure;

export type ZektonGlyphGapReason =
  | 'missing-mapping'
  | 'control-code'
  | 'surrogate-invalid'
  | 'invalid-code-point';

export interface ZektonGlyphGap {
  readonly kind: 'gap';
  readonly reason: ZektonGlyphGapReason;
  readonly codePoint?: number;
  readonly textIndex?: number;
}

export type ZektonGlyphLookup =
  | {
      readonly ok: true;
      readonly kind: 'glyph';
      readonly codePoint: number;
      readonly glyphIndex: number;
      readonly glyph: ZektonGlyphMetrics;
    }
  | {
      readonly ok: false;
      readonly gap: ZektonGlyphGap;
    };

export interface ZektonMeasuredGlyph {
  readonly codePoint: number;
  readonly glyphIndex: number;
  /** Derived native ABC pen advance; the descriptor glyph.advance stays raw. */
  readonly rawAdvance: number;
  readonly scaledAdvance: number;
}

export interface ZektonGlyphRunMeasurement {
  readonly kind: 'measurement';
  readonly textLength: number;
  readonly scale: number;
  /** Sum of native ABC pen advances before caller scaling. */
  readonly rawAdvance: number;
  /** rawAdvance multiplied by the explicit caller scale. */
  readonly scaledAdvance: number;
  readonly totalAdvance: number;
  readonly glyphs: ReadonlyArray<ZektonMeasuredGlyph>;
  readonly gaps: ReadonlyArray<never>;
  readonly identity: ZektonAssetIdentity;
  readonly provenance: ZektonProvenance;
  readonly evidenceState: ZektonEvidenceState;
}

export type ZektonGlyphRunResult =
  | {
      readonly ok: true;
      readonly value: ZektonGlyphRunMeasurement;
    }
  | {
      readonly ok: false;
      readonly kind: 'gap';
      readonly gaps: ReadonlyArray<ZektonGlyphGap>;
      readonly identity: ZektonAssetIdentity;
      readonly provenance: ZektonProvenance;
      readonly evidenceState: ZektonEvidenceState;
    }
  | {
      readonly ok: false;
      readonly kind: 'refusal';
      readonly error: ZektonDecodeError;
      readonly identity: ZektonAssetIdentity;
      readonly provenance: ZektonProvenance;
      readonly evidenceState: ZektonEvidenceState;
    };

interface MutableIdentity {
  [key: string]: unknown;
}

type IdentityCopyResult =
  | {
      readonly status: 'ok';
      readonly value: ZektonAssetIdentity;
    }
  | {
      readonly status: 'failure';
      readonly failure: ZektonDecodeFailure;
    };

const EMPTY_GAPS: ReadonlyArray<never> = Object.freeze([] as never[]);

function freezeArray<T>(values: T[]): ReadonlyArray<T> {
  return Object.freeze(values.slice());
}

function freezeRecord<T extends object>(value: T): T {
  return Object.freeze(value);
}

function refusal(
  code: ZektonDecodeErrorCode,
  message: string,
  offset?: number,
): ZektonDecodeFailure {
  const error: ZektonDecodeError =
    offset === undefined
      ? freezeRecord({ code, message })
      : freezeRecord({ code, message, offset });
  return freezeRecord({ ok: false as const, error });
}

/**
 * Derive the native X4 ABC pen advance proven by the C.GetTextWidth oracle.
 * Invalid derived values are typed failures so callers cannot emit partial
 * geometry while retaining the raw descriptor fields unchanged.
 */
export function deriveZektonNativePenAdvance(
  glyph: Pick<ZektonGlyphMetrics, 'horizontalBearing' | 'advance'>,
): ZektonNativePenAdvanceResult {
  if (glyph === null || typeof glyph !== 'object') {
    return freezeRecord({
      ok: false as const,
      error: freezeRecord({
        code: 'invalid-metric' as const,
        message: 'Native ABC pen advance requires a glyph metric object.',
      }),
    });
  }
  const { horizontalBearing, advance } = glyph;
  if (
    !Number.isSafeInteger(horizontalBearing) ||
    Math.abs(horizontalBearing) > MAX_SAFE_HORIZONTAL_BEARING ||
    !Number.isSafeInteger(advance) ||
    advance <= 0 ||
    advance > MAX_SAFE_GLYPH_ADVANCE
  ) {
    return freezeRecord({
      ok: false as const,
      error: freezeRecord({
        code: 'invalid-metric' as const,
        message: 'Native ABC pen advance requires finite, safe raw bearing and advance fields.',
      }),
    });
  }

  const value = horizontalBearing + advance;
  if (!Number.isSafeInteger(value) || value <= 0 || value > MAX_SAFE_GLYPH_ADVANCE) {
    return freezeRecord({
      ok: false as const,
      error: freezeRecord({
        code: 'invalid-metric' as const,
        message: 'Native ABC pen advance must be finite, safe, and strictly positive.',
      }),
    });
  }
  return freezeRecord({ ok: true as const, value });
}

function isDecodeFailure(value: unknown): value is ZektonDecodeFailure {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  if (
    !Object.prototype.hasOwnProperty.call(value, 'ok') ||
    !Object.prototype.hasOwnProperty.call(value, 'error')
  ) {
    return false;
  }
  const candidate = value as {
    readonly ok?: unknown;
    readonly error?: { readonly code?: unknown; readonly message?: unknown };
  };
  return (
    candidate.ok === false &&
    candidate.error !== null &&
    typeof candidate.error === 'object' &&
    typeof candidate.error.code === 'string' &&
    typeof candidate.error.message === 'string'
  );
}

function invalidInput(message: string): ZektonDecodeFailure {
  return refusal('invalid-input', message);
}

function identityFailure(failure: ZektonDecodeFailure): IdentityCopyResult {
  return freezeRecord({ status: 'failure' as const, failure });
}

function copyIdentity(identity: ZektonAssetIdentity): IdentityCopyResult {
  try {
    if (identity === null || typeof identity !== 'object') {
      return identityFailure(refusal('invalid-provenance', 'Asset identity must be an object.'));
    }

    if (typeof identity.relativePath !== 'string' || identity.relativePath.length === 0) {
      return identityFailure(refusal('invalid-provenance', 'Asset identity requires a non-empty relativePath.'));
    }
    if (typeof identity.sha256 !== 'string' || identity.sha256.length === 0) {
      return identityFailure(refusal('invalid-provenance', 'Asset identity requires a non-empty sha256.'));
    }

    const copy: MutableIdentity = {};
    for (const key of Object.keys(identity)) {
      const value = identity[key];
      if (
        value !== null &&
        typeof value !== 'string' &&
        typeof value !== 'number' &&
        typeof value !== 'boolean' &&
        typeof value !== 'undefined'
      ) {
        return identityFailure(refusal('invalid-provenance', `Asset identity field ${key} must be primitive.`));
      }
      copy[key] = value;
    }
    copy.relativePath = identity.relativePath;
    copy.sha256 = identity.sha256;
    return freezeRecord({ status: 'ok' as const, value: freezeRecord(copy) as ZektonAssetIdentity });
  } catch {
    return identityFailure(refusal('invalid-provenance', 'Asset identity could not be read safely.'));
  }
}

function makeProvenance(identity: ZektonAssetIdentity): ZektonProvenance {
  return freezeRecord({ identity, evidenceState: ZEKTON_EVIDENCE_STATE });
}

function makeSuccess<T>(value: T, identity: ZektonAssetIdentity): ZektonDecodeSuccess<T> {
  const provenance = makeProvenance(identity);
  return freezeRecord({
    ok: true as const,
    value,
    identity,
    provenance,
    evidenceState: ZEKTON_EVIDENCE_STATE,
  });
}

function copyInputBytes(input: ZektonByteInput, maxBytes: number): Uint8Array | ZektonDecodeFailure {
  try {
    let byteLength: number;
    if (input instanceof ArrayBuffer) {
      byteLength = input.byteLength;
      if (byteLength > maxBytes) {
        return refusal('input-too-large', `Input exceeds the ${maxBytes}-byte safety cap.`);
      }
      return new Uint8Array(input).slice();
    }

    if (!ArrayBuffer.isView(input)) {
      return invalidInput('Input must be an ArrayBuffer or ArrayBufferView.');
    }

    byteLength = input.byteLength;
    if (byteLength > maxBytes) {
      return refusal('input-too-large', `Input exceeds the ${maxBytes}-byte safety cap.`);
    }
    return new Uint8Array(input.buffer, input.byteOffset, byteLength).slice();
  } catch {
    return invalidInput('Input bytes could not be copied safely.');
  }
}

function safeProduct(left: number, right: number, limit: number): number | undefined {
  if (!Number.isSafeInteger(left) || !Number.isSafeInteger(right) || left < 0 || right < 0) {
    return undefined;
  }
  if (left !== 0 && right > Math.floor(limit / left)) {
    return undefined;
  }
  const product = left * right;
  return Number.isSafeInteger(product) && product <= limit ? product : undefined;
}

function safeSum(left: number, right: number, limit: number): number | undefined {
  if (!Number.isSafeInteger(left) || !Number.isSafeInteger(right) || left < 0 || right < 0) {
    return undefined;
  }
  if (left > limit - right) {
    return undefined;
  }
  return left + right;
}

function isFiniteUnitInterval(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

interface ZektonHeaderProjection {
  readonly formatVersion: typeof ZEKTON_ABC_FORMAT_VERSION;
  readonly lineMetrics: ZektonLineMetrics;
  readonly reserved32: 0;
  readonly atlasWidth: number;
  readonly atlasHeight: number;
  readonly maxCodepoint: number;
}

function isFiniteNonnegativeBounded(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= MAX_SAFE_LINE_METRIC;
}

function decodeZektonHeader(dataView: DataView): ZektonHeaderProjection | ZektonDecodeFailure {
  const formatVersion = dataView.getUint32(0, true);
  if (formatVersion !== ZEKTON_ABC_FORMAT_VERSION) {
    return refusal(
      'invalid-header',
      `Unsupported ABC format/version ${formatVersion}; expected ${ZEKTON_ABC_FORMAT_VERSION}.`,
      0,
    );
  }

  const outer = dataView.getFloat32(4, true);
  const top = dataView.getFloat32(8, true);
  const bottom = dataView.getFloat32(12, true);
  const inner = dataView.getFloat32(16, true);
  const split20 = dataView.getInt32(20, true);
  const split24 = dataView.getInt32(24, true);
  const rawMetric28 = dataView.getInt32(28, true);
  const reserved32 = dataView.getUint32(32, true);

  if (
    !isFiniteNonnegativeBounded(outer) ||
    !isFiniteNonnegativeBounded(top) ||
    !isFiniteNonnegativeBounded(bottom) ||
    !isFiniteNonnegativeBounded(inner) ||
    !isFiniteNonnegativeBounded(split20) ||
    !isFiniteNonnegativeBounded(split24) ||
    !isFiniteNonnegativeBounded(rawMetric28)
  ) {
    return refusal('invalid-header', 'ABC vertical header fields must be finite, nonnegative, and bounded.', 4);
  }
  if (outer !== top + inner + bottom) {
    return refusal('invalid-header', 'ABC outer line metric must equal top + inner + bottom exactly.', 4);
  }
  if (Math.abs(split20 + split24 - inner) > 1) {
    return refusal('invalid-header', 'ABC integer line-metric split must match inner height within rounding tolerance.', 20);
  }
  if (reserved32 !== 0) {
    return refusal('invalid-header', 'ABC header reserved field at offset 32 must be zero.', 32);
  }

  const lineMetrics = freezeRecord({
    outer,
    top,
    bottom,
    inner,
    split20,
    split24,
    rawMetric28,
  });
  return freezeRecord({
    formatVersion: ZEKTON_ABC_FORMAT_VERSION,
    lineMetrics,
    reserved32: 0 as const,
    atlasWidth: dataView.getUint32(36, true),
    atlasHeight: dataView.getUint32(40, true),
    maxCodepoint: dataView.getUint32(44, true),
  });
}

function isControlCodePoint(codePoint: number): boolean {
  return (codePoint >= 0 && codePoint <= 0x1f) || (codePoint >= 0x7f && codePoint <= 0x9f);
}

function makeGlyphMetrics(
  dataView: DataView,
  recordOffset: number,
  glyphIndex: number,
  atlasWidth: number,
  atlasHeight: number,
): ZektonGlyphMetrics | ZektonDecodeFailure {
  const u0 = dataView.getFloat32(recordOffset, true);
  const v0 = dataView.getFloat32(recordOffset + 4, true);
  const u1 = dataView.getFloat32(recordOffset + 8, true);
  const v1 = dataView.getFloat32(recordOffset + 12, true);
  if (
    !isFiniteUnitInterval(u0) ||
    !isFiniteUnitInterval(v0) ||
    !isFiniteUnitInterval(u1) ||
    !isFiniteUnitInterval(v1) ||
    u0 >= u1 ||
    v0 >= v1
  ) {
    return refusal('invalid-uv', `Glyph ${glyphIndex} has non-finite, out-of-range, or reversed UV bounds.`, recordOffset);
  }

  const horizontalBearing = dataView.getInt16(recordOffset + 16, true);
  const bitmapWidth = dataView.getUint16(recordOffset + 18, true);
  const advance = dataView.getUint16(recordOffset + 20, true);
  const page = dataView.getUint16(recordOffset + 22, true);
  if (page !== 0) {
    return refusal('unsupported-page', `Glyph ${glyphIndex} uses unsupported atlas page ${page}.`, recordOffset + 22);
  }
  if (
    bitmapWidth === 0 ||
    bitmapWidth > atlasWidth ||
    advance === 0 ||
    advance > MAX_SAFE_GLYPH_ADVANCE ||
    Math.abs(horizontalBearing) > MAX_SAFE_HORIZONTAL_BEARING
  ) {
    return refusal('invalid-metric', `Glyph ${glyphIndex} has an impossible width, advance, or bearing.`, recordOffset + 16);
  }

  const left = u0 * atlasWidth;
  const top = v0 * atlasHeight;
  const right = u1 * atlasWidth;
  const bottom = v1 * atlasHeight;
  if (
    !Number.isFinite(left) ||
    !Number.isFinite(top) ||
    !Number.isFinite(right) ||
    !Number.isFinite(bottom) ||
    left < 0 ||
    top < 0 ||
    right > atlasWidth ||
    bottom > atlasHeight ||
    left >= right ||
    top >= bottom
  ) {
    return refusal('invalid-uv', `Glyph ${glyphIndex} has invalid pixel bounds.`, recordOffset);
  }

  const uv = freezeRecord({ u0, v0, u1, v1 });
  const pixelBounds = freezeRecord({ left, top, right, bottom });
  return freezeRecord({
    glyphIndex,
    uv,
    pixelBounds,
    horizontalBearing,
    bearingX: horizontalBearing,
    bitmapWidth,
    width: bitmapWidth,
    advance,
    page,
  });
}

/** Decode an X4 9.00 Zekton .abc descriptor from caller-owned bytes. */
export function decodeZektonAbc(
  input: ZektonByteInput,
  identity: ZektonAssetIdentity,
): ZektonDecodeResult<ZektonAbcDescriptor> {
  const copiedIdentity = copyIdentity(identity);
  if (copiedIdentity.status === 'failure') {
    return copiedIdentity.failure;
  }
  const descriptorIdentity = copiedIdentity.value;

  const copiedBytes = copyInputBytes(input, MAX_SAFE_DESCRIPTOR_BYTES);
  if (copiedBytes instanceof Uint8Array === false) {
    return copiedBytes;
  }

  try {
    if (copiedBytes.byteLength < ZEKTON_DESCRIPTOR_HEADER_SIZE) {
      return refusal('too-short', 'Descriptor is shorter than its fixed 48-byte header.');
    }

    const dataView = new DataView(copiedBytes.buffer, copiedBytes.byteOffset, copiedBytes.byteLength);
    const header = decodeZektonHeader(dataView);
    if (isDecodeFailure(header)) {
      return header;
    }
    const { atlasWidth, atlasHeight, maxCodepoint } = header;
    if (
      atlasWidth === 0 ||
      atlasHeight === 0 ||
      atlasWidth > MAX_SAFE_ATLAS_DIMENSION ||
      atlasHeight > MAX_SAFE_ATLAS_DIMENSION ||
      atlasWidth * atlasHeight > MAX_SAFE_ATLAS_PIXELS
    ) {
      return refusal('invalid-dimensions', 'Descriptor atlas dimensions exceed the safe supported range.');
    }
    if (maxCodepoint > MAX_UNICODE_CODE_POINT) {
      return refusal('invalid-map', 'Descriptor maxCodepoint exceeds the Unicode scalar range.', 44);
    }

    const mapCount = maxCodepoint + 1;
    const mapByteLength = safeProduct(mapCount, 2, MAX_SAFE_DESCRIPTOR_BYTES);
    if (mapByteLength === undefined) {
      return refusal('invalid-map', 'Descriptor map length is not safely representable.');
    }
    const mapEnd = safeSum(ZEKTON_DESCRIPTOR_HEADER_SIZE, mapByteLength, copiedBytes.byteLength);
    if (mapEnd === undefined || mapEnd > copiedBytes.byteLength) {
      return refusal('truncated-map', 'Descriptor Unicode map is truncated.');
    }

    const recordStart = (mapEnd + 3) & ~3;
    if (recordStart < mapEnd || recordStart > copiedBytes.byteLength) {
      return refusal('invalid-map', 'Descriptor record alignment overflows safely.');
    }
    for (let offset = mapEnd; offset < recordStart; offset += 1) {
      if (copiedBytes[offset] !== 0) {
        return refusal('invalid-alignment-padding', 'Descriptor alignment padding must be zero.', offset);
      }
    }

    const map = new Array<number>(mapCount);
    let glyphCount = 0;
    for (let codePoint = 0; codePoint < mapCount; codePoint += 1) {
      const glyphIndex = dataView.getUint16(ZEKTON_DESCRIPTOR_HEADER_SIZE + codePoint * 2, true);
      if (glyphIndex > MAX_SAFE_GLYPH_RECORDS) {
        return refusal('invalid-map', 'Descriptor map contains an unsupported glyph index.');
      }
      map[codePoint] = glyphIndex;
      if (glyphIndex > glyphCount) {
        glyphCount = glyphIndex;
      }
    }
    if (glyphCount > MAX_SAFE_GLYPH_RECORDS) {
      return refusal('invalid-record-count', 'Descriptor record count exceeds the safety cap.');
    }

    const recordByteLength = safeProduct(glyphCount, ZEKTON_RECORD_SIZE, MAX_SAFE_DESCRIPTOR_BYTES);
    if (recordByteLength === undefined) {
      return refusal('invalid-record-count', 'Descriptor record byte length is not safely representable.');
    }
    const recordsEnd = safeSum(recordStart, recordByteLength, copiedBytes.byteLength);
    if (recordsEnd === undefined || recordsEnd > copiedBytes.byteLength) {
      return refusal('truncated-records', 'Descriptor glyph records are truncated.');
    }
    const expectedEnd = safeSum(recordsEnd, ZEKTON_DESCRIPTOR_TRAILING_SIZE, copiedBytes.byteLength);
    if (expectedEnd === undefined || expectedEnd !== copiedBytes.byteLength) {
      return refusal('invalid-trailing-data', 'Descriptor must end with exactly one four-byte trailing field.');
    }
    if (dataView.getUint32(recordsEnd, true) !== 0) {
      return refusal('invalid-trailing-data', 'Descriptor trailing field must be zero.', recordsEnd);
    }

    const glyphRecords: ZektonGlyphMetrics[] = [];
    for (let recordIndex = 0; recordIndex < glyphCount; recordIndex += 1) {
      const recordOffset = recordStart + recordIndex * ZEKTON_RECORD_SIZE;
      const glyph = makeGlyphMetrics(
        dataView,
        recordOffset,
        recordIndex + 1,
        atlasWidth,
        atlasHeight,
      );
      if (isDecodeFailure(glyph)) {
        return glyph;
      }
      glyphRecords.push(glyph);
    }

    const frozenMap = freezeArray(map);
    const frozenRecords = freezeArray(glyphRecords);
    const headerBytes = freezeArray(Array.from(copiedBytes.slice(0, ZEKTON_DESCRIPTOR_HEADER_SIZE)));
    const trailingBytes = freezeArray(Array.from(copiedBytes.slice(recordsEnd)));
    const provenance = makeProvenance(descriptorIdentity);
    const descriptor = freezeRecord({
      format: 'x4-zekton-abc' as const,
      atlasWidth,
      atlasHeight,
      maxCodepoint,
      codePointToGlyphIndex: frozenMap,
      map: frozenMap,
      glyphRecords: frozenRecords,
      glyphs: frozenRecords,
      glyphCount,
      recordSize: ZEKTON_RECORD_SIZE as typeof ZEKTON_RECORD_SIZE,
      headerBytes,
      header,
      lineMetrics: header.lineMetrics,
      trailingBytes,
      identity: descriptorIdentity,
      provenance,
      evidenceState: ZEKTON_EVIDENCE_STATE,
    });
    return makeSuccess(descriptor, descriptorIdentity);
  } catch {
    return invalidInput('Descriptor bytes could not be decoded safely.');
  }
}

export const decodeZektonDescriptor = decodeZektonAbc;

function validateExpectedDimensions(
  actualWidth: number,
  actualHeight: number,
  expectedDimensions: ZektonDdsDimensions | undefined,
): ZektonDecodeFailure | undefined {
  if (expectedDimensions === undefined) {
    return undefined;
  }
  if (
    !Number.isSafeInteger(expectedDimensions.width) ||
    !Number.isSafeInteger(expectedDimensions.height) ||
    expectedDimensions.width !== actualWidth ||
    expectedDimensions.height !== actualHeight
  ) {
    return refusal('invalid-dimension-parity', 'DDS dimensions do not match the descriptor atlas dimensions.');
  }
  return undefined;
}

/** Decode the observed uncompressed 8-bit-alpha DDS layout without rasterizing. */
export function decodeZektonA8Dds(
  input: ZektonByteInput,
  identity: ZektonAssetIdentity,
  expectedDimensions?: ZektonDdsDimensions,
): ZektonDecodeResult<ZektonA8DdsAtlas> {
  const copiedIdentity = copyIdentity(identity);
  if (copiedIdentity.status === 'failure') {
    return copiedIdentity.failure;
  }
  const atlasIdentity = copiedIdentity.value;

  const copiedBytes = copyInputBytes(input, MAX_SAFE_DDS_BYTES);
  if (copiedBytes instanceof Uint8Array === false) {
    return copiedBytes;
  }

  try {
    if (copiedBytes.byteLength < ZEKTON_DDS_HEADER_SIZE) {
      return refusal('too-short', 'DDS is shorter than its 128-byte header.');
    }
    if (
      copiedBytes[0] !== 0x44 ||
      copiedBytes[1] !== 0x44 ||
      copiedBytes[2] !== 0x53 ||
      copiedBytes[3] !== 0x20
    ) {
      return refusal('invalid-magic', 'DDS magic must be the ASCII bytes DDS .');
    }

    const dataView = new DataView(copiedBytes.buffer, copiedBytes.byteOffset, copiedBytes.byteLength);
    if (dataView.getUint32(4, true) !== ZEKTON_DDS_STANDARD_HEADER_SIZE) {
      return refusal('invalid-dds-header', 'DDS header size must be 124 bytes.', 4);
    }

    const headerFlags = dataView.getUint32(8, true);
    const requiredHeaderFlags = 0x00000001 | 0x00000002 | 0x00000004 | 0x00001000;
    if ((headerFlags & requiredHeaderFlags) !== requiredHeaderFlags) {
      return refusal('invalid-dds-header', 'DDS header flags do not describe a complete texture header.', 8);
    }

    const height = dataView.getUint32(12, true);
    const width = dataView.getUint32(16, true);
    const depth = dataView.getUint32(24, true);
    const mipMapCount = dataView.getUint32(28, true);
    if (
      width === 0 ||
      height === 0 ||
      width > MAX_SAFE_ATLAS_DIMENSION ||
      height > MAX_SAFE_ATLAS_DIMENSION
    ) {
      return refusal('invalid-dimensions', 'DDS dimensions are zero or exceed the safety cap.');
    }
    const payloadLength = safeProduct(width, height, MAX_SAFE_ATLAS_PIXELS);
    if (payloadLength === undefined || payloadLength === 0) {
      return refusal('invalid-dimensions', 'DDS dimensions do not produce a safe A8 payload.');
    }
    const dimensionParityFailure = validateExpectedDimensions(width, height, expectedDimensions);
    if (dimensionParityFailure !== undefined) {
      return dimensionParityFailure;
    }

    if (depth !== 0 || mipMapCount !== 0) {
      return refusal('unsupported-layout', 'DDS depth and mipmapped layouts are unsupported.');
    }
    const caps = dataView.getUint32(108, true);
    const caps2 = dataView.getUint32(112, true);
    const caps3 = dataView.getUint32(116, true);
    const caps4 = dataView.getUint32(120, true);
    const DDSCAPS_TEXTURE = 0x00001000;
    const DDSCAPS_COMPLEX = 0x00000008;
    const DDSCAPS_MIPMAP = 0x00400000;
    if (
      (caps & DDSCAPS_TEXTURE) === 0 ||
      (caps & (DDSCAPS_COMPLEX | DDSCAPS_MIPMAP)) !== 0 ||
      caps2 !== 0 ||
      caps3 !== 0 ||
      caps4 !== 0
    ) {
      return refusal('unsupported-layout', 'DDS cubemap, volume, mipmap, or complex layouts are unsupported.');
    }

    if (dataView.getUint32(76, true) !== ZEKTON_DDS_PIXEL_FORMAT_SIZE) {
      return refusal('invalid-pixel-format', 'DDS pixel-format size must be 32 bytes.', 76);
    }
    const pixelFormatFlags = dataView.getUint32(80, true);
    const fourCC = dataView.getUint32(84, true);
    const bitsPerPixel = dataView.getUint32(88, true);
    const redMask = dataView.getUint32(92, true);
    const greenMask = dataView.getUint32(96, true);
    const blueMask = dataView.getUint32(100, true);
    const alphaMask = dataView.getUint32(104, true);
    if (
      pixelFormatFlags !== 0x00000002 ||
      fourCC !== 0 ||
      bitsPerPixel !== 8 ||
      redMask !== 0 ||
      greenMask !== 0 ||
      blueMask !== 0 ||
      alphaMask !== 0x000000ff
    ) {
      return refusal('invalid-pixel-format', 'DDS pixel format must be exactly uncompressed A8 alpha.');
    }

    const payloadEnd = safeSum(ZEKTON_DDS_HEADER_SIZE, payloadLength, copiedBytes.byteLength);
    if (payloadEnd === undefined || payloadEnd > copiedBytes.byteLength) {
      return refusal('truncated-payload', 'DDS A8 payload is truncated.');
    }
    if (payloadEnd !== copiedBytes.byteLength) {
      return refusal('invalid-payload-length', 'DDS must contain exactly width*height alpha bytes.');
    }

    const alphaBytes = copiedBytes.slice(ZEKTON_DDS_HEADER_SIZE);
    const provenance = makeProvenance(atlasIdentity);
    const atlas = freezeRecord({
      format: 'x4-zekton-a8-dds' as const,
      width,
      height,
      dimensions: freezeRecord({ width, height }),
      payloadOffset: ZEKTON_DDS_HEADER_SIZE as typeof ZEKTON_DDS_HEADER_SIZE,
      payloadLength,
      mipMapCount,
      depth,
      alphaBytes,
      identity: atlasIdentity,
      provenance,
      evidenceState: ZEKTON_EVIDENCE_STATE,
    });
    return makeSuccess(atlas, atlasIdentity);
  } catch {
    return invalidInput('DDS bytes could not be decoded safely.');
  }
}

export const decodeZektonDds = decodeZektonA8Dds;
export const decodeZektonA8Atlas = decodeZektonA8Dds;

/** Decode descriptor and atlas together, enforcing their dimension parity. */
export function decodeZektonFontAssets(
  descriptorInput: ZektonByteInput,
  descriptorIdentity: ZektonAssetIdentity,
  atlasInput: ZektonByteInput,
  atlasIdentity: ZektonAssetIdentity,
): ZektonFontAssetsResult {
  const descriptorResult = decodeZektonAbc(descriptorInput, descriptorIdentity);
  if (isDecodeFailure(descriptorResult)) {
    return descriptorResult;
  }
  const atlasResult = decodeZektonA8Dds(atlasInput, atlasIdentity, {
    width: descriptorResult.value.atlasWidth,
    height: descriptorResult.value.atlasHeight,
  });
  if (isDecodeFailure(atlasResult)) {
    return atlasResult;
  }

  const provenance = freezeRecord({
    descriptor: descriptorResult.value.provenance,
    atlas: atlasResult.value.provenance,
  });
  const value = freezeRecord({
    format: 'x4-zekton-font-assets' as const,
    descriptor: descriptorResult.value,
    atlas: atlasResult.value,
    descriptorIdentity: descriptorResult.value.identity,
    atlasIdentity: atlasResult.value.identity,
    evidenceState: ZEKTON_EVIDENCE_STATE,
    provenance,
  });
  return freezeRecord({
    ok: true as const,
    value,
    evidenceState: ZEKTON_EVIDENCE_STATE,
    provenance,
  });
}

export const decodeZektonPair = decodeZektonFontAssets;

function gapResult(
  descriptor: ZektonAbcDescriptor,
  gaps: ZektonGlyphGap[],
): ZektonGlyphRunResult {
  return freezeRecord({
    ok: false as const,
    kind: 'gap' as const,
    gaps: freezeArray(gaps),
    identity: descriptor.identity,
    provenance: descriptor.provenance,
    evidenceState: descriptor.evidenceState,
  });
}

function measurementRefusal(
  descriptor: ZektonAbcDescriptor,
  error: ZektonDecodeError,
): ZektonGlyphRunResult {
  return freezeRecord({
    ok: false as const,
    kind: 'refusal' as const,
    error,
    identity: descriptor.identity,
    provenance: descriptor.provenance,
    evidenceState: descriptor.evidenceState,
  });
}

function lookupGap(reason: ZektonGlyphGapReason, codePoint?: number): ZektonGlyphLookup {
  const gap: ZektonGlyphGap =
    codePoint === undefined
      ? freezeRecord({ kind: 'gap' as const, reason })
      : freezeRecord({ kind: 'gap' as const, reason, codePoint });
  return freezeRecord({ ok: false as const, gap });
}

/** Look up one Unicode scalar without browser fallback or inferred metrics. */
export function lookupZektonGlyph(
  descriptor: ZektonAbcDescriptor,
  codePoint: number,
): ZektonGlyphLookup {
  if (!Number.isFinite(codePoint) || !Number.isInteger(codePoint) || codePoint < 0 || codePoint > MAX_UNICODE_CODE_POINT) {
    return lookupGap('invalid-code-point');
  }
  if (codePoint >= 0xd800 && codePoint <= 0xdfff) {
    return lookupGap('surrogate-invalid', codePoint);
  }
  if (isControlCodePoint(codePoint)) {
    return lookupGap('control-code', codePoint);
  }
  if (codePoint > descriptor.maxCodepoint) {
    return lookupGap('missing-mapping', codePoint);
  }

  const glyphIndex = descriptor.codePointToGlyphIndex[codePoint];
  if (!Number.isInteger(glyphIndex) || glyphIndex <= 0 || glyphIndex > descriptor.glyphRecords.length) {
    return lookupGap('missing-mapping', codePoint);
  }
  const glyph = descriptor.glyphRecords[glyphIndex - 1];
  if (glyph === undefined) {
    return lookupGap('missing-mapping', codePoint);
  }
  return freezeRecord({ ok: true as const, kind: 'glyph' as const, codePoint, glyphIndex, glyph });
}

export const lookupGlyphByCodePoint = lookupZektonGlyph;

function appendGap(gaps: ZektonGlyphGap[], reason: ZektonGlyphGapReason, codePoint: number | undefined, textIndex: number): void {
  if (codePoint === undefined) {
    gaps.push(freezeRecord({ kind: 'gap' as const, reason, textIndex }));
  } else {
    gaps.push(freezeRecord({ kind: 'gap' as const, reason, codePoint, textIndex }));
  }
}

/**
 * Measure only the observed raw advances at an explicit finite scale. A gap
 * is a typed refusal of geometry, so no partial width is returned.
 */
export function measureZektonGlyphRun(
  descriptor: ZektonAbcDescriptor,
  text: string,
  scale: number,
): ZektonGlyphRunResult {
  if (typeof text !== 'string') {
    return measurementRefusal(
      descriptor,
      freezeRecord({ code: 'invalid-text', message: 'Glyph-run text must be a string.' }),
    );
  }
  if (!Number.isFinite(scale) || scale < 0) {
    return measurementRefusal(
      descriptor,
      freezeRecord({ code: 'invalid-scale', message: 'Glyph-run scale must be finite and nonnegative.' }),
    );
  }
  if (text.length > MAX_SAFE_RUN_CODE_UNITS) {
    return measurementRefusal(
      descriptor,
      freezeRecord({ code: 'invalid-text', message: 'Glyph-run text exceeds the safety cap.' }),
    );
  }

  const gaps: ZektonGlyphGap[] = [];
  const measuredGlyphs: ZektonMeasuredGlyph[] = [];
  let rawAdvance = 0;
  let scaledAdvance = 0;
  let textIndex = 0;
  while (textIndex < text.length) {
    const firstUnit = text.charCodeAt(textIndex);
    let codePoint: number | undefined;
    let consumedUnits = 1;
    if (firstUnit >= 0xd800 && firstUnit <= 0xdbff) {
      const nextUnit = textIndex + 1 < text.length ? text.charCodeAt(textIndex + 1) : undefined;
      if (nextUnit === undefined || nextUnit < 0xdc00 || nextUnit > 0xdfff) {
        appendGap(gaps, 'surrogate-invalid', firstUnit, textIndex);
        textIndex += consumedUnits;
        continue;
      }
      codePoint = 0x10000 + ((firstUnit - 0xd800) << 10) + (nextUnit - 0xdc00);
      consumedUnits = 2;
    } else if (firstUnit >= 0xdc00 && firstUnit <= 0xdfff) {
      appendGap(gaps, 'surrogate-invalid', firstUnit, textIndex);
      textIndex += consumedUnits;
      continue;
    } else {
      codePoint = firstUnit;
    }

    const lookup = lookupZektonGlyph(descriptor, codePoint);
    if (lookup.ok === false) {
      appendGap(gaps, lookup.gap.reason, lookup.gap.codePoint, textIndex);
      textIndex += consumedUnits;
      continue;
    }

    const nativePenAdvance = deriveZektonNativePenAdvance(lookup.glyph);
    if (nativePenAdvance.ok === false) {
      return measurementRefusal(descriptor, nativePenAdvance.error);
    }
    const nextRawAdvance = safeSum(rawAdvance, nativePenAdvance.value, Number.MAX_SAFE_INTEGER);
    const scaledContribution = nativePenAdvance.value * scale;
    if (
      nextRawAdvance === undefined ||
      !Number.isFinite(scaledContribution) ||
      scaledAdvance > Number.MAX_VALUE - scaledContribution
    ) {
      return measurementRefusal(
        descriptor,
        freezeRecord({ code: 'measurement-overflow', message: 'Glyph-run measurement exceeds finite numeric bounds.' }),
      );
    }
    rawAdvance = nextRawAdvance;
    scaledAdvance += scaledContribution;
    measuredGlyphs.push(
      freezeRecord({
        codePoint,
        glyphIndex: lookup.glyphIndex,
        rawAdvance: nativePenAdvance.value,
        scaledAdvance: scaledContribution,
      }),
    );
    textIndex += consumedUnits;
  }

  if (gaps.length > 0) {
    return gapResult(descriptor, gaps);
  }

  const value = freezeRecord({
    kind: 'measurement' as const,
    textLength: text.length,
    scale,
    rawAdvance,
    scaledAdvance,
    totalAdvance: scaledAdvance,
    glyphs: freezeArray(measuredGlyphs),
    gaps: EMPTY_GAPS,
    identity: descriptor.identity,
    provenance: descriptor.provenance,
    evidenceState: descriptor.evidenceState,
  });
  return freezeRecord({ ok: true as const, value });
}

export const measureZektonRawGlyphRun = measureZektonGlyphRun;
