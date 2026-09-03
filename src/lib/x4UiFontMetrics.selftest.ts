import {
  ZEKTON_CORPUS_ASSETS,
  ZEKTON_EVIDENCE_STATE,
  decodeZektonA8Dds,
  decodeZektonAbc,
  decodeZektonFontAssets,
  deriveZektonNativePenAdvance,
  lookupZektonGlyph,
  measureZektonGlyphRun,
} from './x4UiFontMetrics';
import * as fontSemantics from './x4UiFontMetrics';

interface SyntheticRecord {
  readonly u0: number;
  readonly v0: number;
  readonly u1: number;
  readonly v1: number;
  readonly bearing: number;
  readonly width: number;
  readonly advance: number;
  readonly page: number;
}

interface SyntheticAbc {
  readonly bytes: Uint8Array;
  readonly recordStart: number;
}

interface SyntheticHeader {
  readonly formatVersion?: number;
  readonly outer?: number;
  readonly top?: number;
  readonly bottom?: number;
  readonly inner?: number;
  readonly split20?: number;
  readonly split24?: number;
  readonly rawMetric28?: number;
  readonly reserved32?: number;
}

const regularIdentity = {
  relativePath: 'synthetic/zekton_32.abc',
  sha256: 'regular-synthetic-identity',
} as const;

const boldIdentity = {
  relativePath: 'synthetic/zekton bold_32.abc',
  sha256: 'bold-synthetic-identity',
} as const;

const regularAtlasIdentity = {
  relativePath: 'synthetic/zekton_32.dds',
  sha256: 'regular-synthetic-atlas-identity',
} as const;

const boldAtlasIdentity = {
  relativePath: 'synthetic/zekton bold_32.dds',
  sha256: 'bold-synthetic-atlas-identity',
} as const;

const regularRecords: readonly SyntheticRecord[] = [
  { u0: 0, v0: 0, u1: 2 / 16, v1: 4 / 16, bearing: -2, width: 2, advance: 5, page: 0 },
  { u0: 2 / 16, v0: 0, u1: 6 / 16, v1: 4 / 16, bearing: 1, width: 4, advance: 7, page: 0 },
  { u0: 6 / 16, v0: 0, u1: 14 / 16, v1: 4 / 16, bearing: 2, width: 8, advance: 9, page: 0 },
  { u0: 14 / 16, v0: 0, u1: 15 / 16, v1: 4 / 16, bearing: -1, width: 1, advance: 3, page: 0 },
];

const boldRecords: readonly SyntheticRecord[] = [
  ...regularRecords.slice(0, 3),
  { u0: 14 / 16, v0: 0, u1: 15 / 16, v1: 4 / 16, bearing: -1, width: 2, advance: 4, page: 0 },
  { u0: 0, v0: 4 / 16, u1: 4 / 16, v1: 8 / 16, bearing: 0, width: 4, advance: 8, page: 0 },
];

function assertCondition(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, received ${String(actual)}`);
  }
}

function assertBytesEqual(actual: ArrayLike<number>, expected: ArrayLike<number>, message: string): void {
  assertEqual(actual.length, expected.length, `${message} length`);
  for (let index = 0; index < actual.length; index += 1) {
    assertEqual(actual[index], expected[index], `${message} byte ${index}`);
  }
}

function assertThrows(action: () => unknown, message: string): void {
  try {
    action();
  } catch {
    return;
  }
  throw new Error(`${message}: expected refusal`);
}

function assertDecodeResultShape(result: unknown): void {
  assertCondition(result !== null && typeof result === 'object', 'decoder result must be an object');
  const candidate = result as {
    readonly ok?: unknown;
    readonly value?: unknown;
    readonly error?: unknown;
  };
  assertCondition(candidate.ok === true || candidate.ok === false, 'decoder result must have boolean ok discriminator');
  if (candidate.ok === true) {
    assertCondition(candidate.value !== undefined, 'typed success must carry a value');
    return;
  }
  assertCondition(candidate.error !== null && typeof candidate.error === 'object', 'typed failure must carry error object');
  const error = candidate.error as { readonly code?: unknown; readonly message?: unknown };
  assertCondition(typeof error.code === 'string', 'typed failure must carry error.code');
  assertCondition(typeof error.message === 'string', 'typed failure must carry error.message');
}

function expectSuccess(result: unknown): void {
  assertDecodeResultShape(result);
  const candidate = result as { readonly ok?: unknown };
  assertEqual(candidate.ok, true, 'expected typed success');
}

function expectRefusal(result: unknown, code?: string): void {
  assertDecodeResultShape(result);
  const candidate = result as {
    readonly ok?: unknown;
    readonly error?: { readonly code?: unknown };
  };
  assertEqual(candidate.ok, false, 'expected typed refusal');
  if (code !== undefined) {
    assertEqual(candidate.error?.code, code, 'refusal code');
  }
}

function makeAbc(
  records: readonly SyntheticRecord[],
  mappings: Readonly<Record<number, number>>,
  maxCodepoint = 119,
  atlasWidth = 16,
  atlasHeight = 16,
  headerOverrides: SyntheticHeader = {},
): SyntheticAbc {
  const mapByteLength = (maxCodepoint + 1) * 2;
  const recordStart = (48 + mapByteLength + 3) & ~3;
  const bytes = new Uint8Array(recordStart + records.length * 24 + 4);
  const dataView = new DataView(bytes.buffer);
  dataView.setUint32(0, headerOverrides.formatVersion ?? 9, true);
  dataView.setFloat32(4, headerOverrides.outer ?? 52, true);
  dataView.setFloat32(8, headerOverrides.top ?? 0, true);
  dataView.setFloat32(12, headerOverrides.bottom ?? 0, true);
  dataView.setFloat32(16, headerOverrides.inner ?? 52, true);
  dataView.setInt32(20, headerOverrides.split20 ?? 41, true);
  dataView.setInt32(24, headerOverrides.split24 ?? 11, true);
  dataView.setInt32(28, headerOverrides.rawMetric28 ?? 9, true);
  dataView.setUint32(32, headerOverrides.reserved32 ?? 0, true);
  dataView.setUint32(36, atlasWidth, true);
  dataView.setUint32(40, atlasHeight, true);
  dataView.setUint32(44, maxCodepoint, true);
  for (const [codePointText, glyphIndex] of Object.entries(mappings)) {
    dataView.setUint16(48 + Number(codePointText) * 2, glyphIndex, true);
  }
  records.forEach((record, recordIndex) => {
    const offset = recordStart + recordIndex * 24;
    dataView.setFloat32(offset, record.u0, true);
    dataView.setFloat32(offset + 4, record.v0, true);
    dataView.setFloat32(offset + 8, record.u1, true);
    dataView.setFloat32(offset + 12, record.v1, true);
    dataView.setInt16(offset + 16, record.bearing, true);
    dataView.setUint16(offset + 18, record.width, true);
    dataView.setUint16(offset + 20, record.advance, true);
    dataView.setUint16(offset + 22, record.page, true);
  });
  return { bytes, recordStart };
}

function makeDds(width = 16, height = 16): Uint8Array {
  const bytes = new Uint8Array(128 + width * height);
  bytes.set([0x44, 0x44, 0x53, 0x20]);
  const dataView = new DataView(bytes.buffer);
  dataView.setUint32(4, 124, true);
  dataView.setUint32(8, 0x1007, true);
  dataView.setUint32(12, height, true);
  dataView.setUint32(16, width, true);
  dataView.setUint32(20, 0, true);
  dataView.setUint32(24, 0, true);
  dataView.setUint32(28, 0, true);
  dataView.setUint32(76, 32, true);
  dataView.setUint32(80, 2, true);
  dataView.setUint32(84, 0, true);
  dataView.setUint32(88, 8, true);
  dataView.setUint32(92, 0, true);
  dataView.setUint32(96, 0, true);
  dataView.setUint32(100, 0, true);
  dataView.setUint32(104, 0xff, true);
  dataView.setUint32(108, 0x1002, true);
  dataView.setUint32(112, 0, true);
  dataView.setUint32(116, 0, true);
  dataView.setUint32(120, 0, true);
  for (let index = 128; index < bytes.length; index += 1) {
    bytes[index] = (index - 128) & 0xff;
  }
  return bytes;
}

function mutateAbc(source: Uint8Array, mutator: (dataView: DataView) => void): Uint8Array {
  const copy = source.slice();
  mutator(new DataView(copy.buffer));
  return copy;
}

function mutateDds(source: Uint8Array, mutator: (dataView: DataView) => void): Uint8Array {
  const copy = source.slice();
  mutator(new DataView(copy.buffer));
  return copy;
}

function snapshot(value: unknown): string {
  return JSON.stringify(value);
}

const regularAbc = makeAbc(
  regularRecords,
  { 32: 1, 65: 2, 87: 3, 105: 4 },
);
const boldAbc = makeAbc(
  boldRecords,
  { 32: 1, 65: 2, 66: 5, 87: 3, 105: 4 },
);
const regularDds = makeDds();
const boldDds = makeDds();

const tests: readonly [string, () => void][] = [
  [
    'provenance constants match the reconciled X4 9.00 assets',
    () => {
      assertEqual(
        ZEKTON_CORPUS_ASSETS.regular.descriptor.sha256,
        '2E7D49EE1A6C8033403EBFE8B3FAB036A511999D1F8F9A287A257E0D52DF7598',
        'regular descriptor hash',
      );
      assertEqual(
        ZEKTON_CORPUS_ASSETS.regular.atlas.sha256,
        '19483C78A2BDE509A5D118C556AF465C03ADB6CA9126276673A9C924269CA2DA',
        'regular atlas hash',
      );
      assertEqual(
        ZEKTON_CORPUS_ASSETS.bold.descriptor.sha256,
        '57A3F41D29B4835C0FBB6C4C0F78F28F2F7E1531A3478C8C10F1E2B6E4A91394',
        'bold descriptor hash',
      );
      assertEqual(
        ZEKTON_CORPUS_ASSETS.bold.atlas.sha256,
        'A2BFCB11A4006E39BED99AF956C26F1DCE7C4092FFA63FC66CDA844D12019738',
        'bold atlas hash',
      );
    },
  ],
  [
    'shipped Zekton SDF shader vectors and immutable source identity are public',
    () => {
      const exports = fontSemantics as unknown as {
        readonly applyZektonSdfAlpha?: unknown;
        readonly ZEKTON_SDF_SHADER_SOURCE?: unknown;
      };
      assertCondition(typeof exports.applyZektonSdfAlpha === 'function', 'SDF alpha transfer must be exported');
      const apply = exports.applyZektonSdfAlpha as (rawAlpha: number, callerAlpha?: number) => number;
      assertEqual(apply(255), 0, 'raw 255 is transparent');
      assertEqual(apply(102), 255, 'raw 102 is opaque');
      assertEqual(apply(153), 0, 'lower transition edge is transparent');
      assertEqual(apply(127.5), 128, 'shader midpoint uses positive half-up byte quantization');
      assertEqual(apply(102.1), 255, 'upper transition interior is opaque');
      assertCondition(apply(0) >= apply(102) && apply(102) >= apply(127.5) && apply(127.5) >= apply(153) && apply(153) >= apply(255), 'raw-alpha polarity is monotonic toward transparency');
      assertEqual(apply(127.5, 0.5), 64, 'caller alpha multiplies coverage before byte quantization');
      assertEqual(apply(127.5, 0.5), apply(127.5, 0.5), 'shader transfer replay is deterministic');
      assertThrows(() => apply(Number.NaN), 'non-finite raw alpha');
      assertThrows(() => apply(-1), 'negative raw alpha');
      assertThrows(() => apply(256), 'out-of-range raw alpha');
      assertThrows(() => apply(128, Number.NaN), 'non-finite caller alpha');
      assertThrows(() => apply(128, -0.1), 'negative caller alpha');
      assertThrows(() => apply(128, 1.1), 'caller alpha above one');

      const source = exports.ZEKTON_SDF_SHADER_SOURCE as {
        readonly material?: { readonly relativePath?: unknown; readonly sha256?: unknown; readonly shader?: unknown; readonly blendMode?: unknown };
        readonly shaderBinding?: { readonly relativePath?: unknown; readonly sha256?: unknown; readonly diffuseFunc?: unknown };
        readonly fragment?: { readonly relativePath?: unknown; readonly sha256?: unknown; readonly expression?: unknown };
      } | undefined;
      assertCondition(source !== undefined && Object.isFrozen(source) && Object.isFrozen(source.material) && Object.isFrozen(source.shaderBinding) && Object.isFrozen(source.fragment), 'SDF source identity must be deeply immutable');
      assertEqual(source?.material?.relativePath, 'libraries/material_library.xml', 'material source path');
      assertEqual(source?.material?.sha256, '4F211F83343FF5C19A4D8427AB25D195E2A124208B730976F9A411335271C047', 'material source hash');
      assertEqual(source?.material?.shader, 'xu_ui_unlit_sdf', 'regular and bold material shader binding');
      assertEqual(source?.material?.blendMode, 'ALPHA8_ANARK', 'regular and bold material blend mode');
      assertEqual(source?.shaderBinding?.relativePath, 'shadergl/ogl/xu_ui_unlit_sdf.xml', 'shader binding path');
      assertEqual(source?.shaderBinding?.sha256, '5E74955A40459D137C19CFCDAE35974FC0F2494E53E58C2CF4761597537E5768', 'shader binding hash');
      assertEqual(source?.shaderBinding?.diffuseFunc, false, 'shader diffuse_func binding');
      assertEqual(source?.fragment?.relativePath, 'shadergl/glsl/ui_unlit_sdf.frag.glsl', 'fragment source path');
      assertEqual(source?.fragment?.sha256, '753923F5EDD97AEEF00177FD59B8A43CAA1EC6E2B64F5ADDED59E3E530498968', 'fragment source hash');
      assertEqual(source?.fragment?.expression, 'smoothstep(0.4, 0.6, 1.0 - texture(S_diffuse_map, IO_uv0).r)', 'fragment transfer expression');
    },
  ],
  [
    'identity metadata cannot spoof decoder result discriminators',
    () => {
      const collidingIdentity = {
        relativePath: 'synthetic/collision.abc',
        sha256: 'collision-identity',
        ok: false,
        error: 'evil',
        code: 'evil-code',
        message: 'evil-message',
        retained: 'primitive metadata',
      } as const;
      const abcResult = decodeZektonAbc(regularAbc.bytes, collidingIdentity);
      expectSuccess(abcResult);
      assertCondition(abcResult.ok, 'colliding identity must still produce success');
      assertEqual(abcResult.identity.ok, false, 'ok metadata is retained only inside identity');
      assertEqual(abcResult.identity.error, 'evil', 'error metadata is retained only inside identity');
      assertEqual(abcResult.identity.code, 'evil-code', 'code metadata is retained only inside identity');
      assertEqual(abcResult.identity.message, 'evil-message', 'message metadata is retained only inside identity');
      assertEqual(abcResult.identity.retained, 'primitive metadata', 'extra metadata is retained');
      const ddsResult = decodeZektonA8Dds(regularDds, {
        ...collidingIdentity,
        relativePath: 'synthetic/collision.dds',
      });
      expectSuccess(ddsResult);
      const malformedResult = decodeZektonAbc(new Uint8Array(47), collidingIdentity);
      expectRefusal(malformedResult, 'too-short');
    },
  ],
  [
    'regular and bold descriptors decode with one-based maps and raw fields',
    () => {
      const regular = decodeZektonAbc(regularAbc.bytes, regularIdentity);
      const bold = decodeZektonAbc(boldAbc.bytes, boldIdentity);
      expectSuccess(regular);
      expectSuccess(bold);
      assertCondition(regular.ok && bold.ok, 'synthetic descriptors should decode');
      assertEqual(regular.value.glyphCount, 4, 'regular record count');
      assertEqual(bold.value.glyphCount, 5, 'bold record count');
      assertEqual(regular.value.codePointToGlyphIndex[32], 1, 'space is one-based record one');
      const space = lookupZektonGlyph(regular.value, 32);
      const a = lookupZektonGlyph(regular.value, 65);
      const boldA = lookupZektonGlyph(bold.value, 65);
      assertCondition(space.ok && a.ok && boldA.ok, 'known glyphs should look up');
      assertEqual(space.glyph.glyphIndex, 1, 'space glyph index');
      assertEqual(space.glyph.horizontalBearing, -2, 'signed negative bearing');
      assertEqual(a.glyph.width, 4, 'ASCII A width');
      assertEqual(a.glyph.advance, 7, 'ASCII A advance');
      assertEqual(a.glyph.pixelBounds.left, 2, 'A pixel left');
      assertEqual(a.glyph.pixelBounds.right, 6, 'A pixel right');
      assertEqual(a.glyph.pixelBounds.top, 0, 'A pixel top');
      assertEqual(a.glyph.pixelBounds.bottom, 4, 'A pixel bottom');
      assertEqual(boldA.glyph.advance, 7, 'bold A uses the shared synthetic A record');
      const aNativePenAdvance = deriveZektonNativePenAdvance(a.glyph);
      expectSuccess(aNativePenAdvance);
      assertCondition(aNativePenAdvance.ok, 'A native pen advance should be explicit');
      assertEqual(aNativePenAdvance.value, 8, 'A native pen advance');
      assertEqual(a.glyph.horizontalBearing, 1, 'A raw horizontal bearing remains separate');
      assertEqual(a.glyph.advance, 7, 'A raw advance remains separate');
      const boldI = lookupZektonGlyph(bold.value, 105);
      assertCondition(boldI.ok, 'bold i-like glyph should look up');
      assertEqual(boldI.glyph.advance, 4, 'bold i-like metric distinction');
      assertEqual(regular.value.header.formatVersion, 9, 'ABC format/version');
      assertEqual(regular.value.lineMetrics.outer, 52, 'outer line metric');
      assertEqual(regular.value.lineMetrics.top, 0, 'top line metric');
      assertEqual(regular.value.lineMetrics.inner, 52, 'inner line metric');
      assertEqual(regular.value.lineMetrics.bottom, 0, 'bottom line metric');
      assertEqual(regular.value.lineMetrics.split20, 41, 'offset 20 integer split');
      assertEqual(regular.value.lineMetrics.split24, 11, 'offset 24 integer split');
      assertEqual(regular.value.lineMetrics.rawMetric28, 9, 'offset 28 remains raw');
      assertEqual(regular.value.header.reserved32, 0, 'reserved header field');
      assertEqual(regular.value.evidenceState, ZEKTON_EVIDENCE_STATE, 'regular evidence state');
      assertEqual(regular.identity.relativePath, regularIdentity.relativePath, 'identity is carried');
      assertEqual(regular.value.identity.sha256, regularIdentity.sha256, 'value identity is carried');
    },
  ],
  [
    'descriptor accepts ArrayBufferView slices and does not alias bytes',
    () => {
      const padded = new Uint8Array(regularAbc.bytes.length + 6);
      padded.set(regularAbc.bytes, 3);
      const view = padded.subarray(3, 3 + regularAbc.bytes.length);
      const before = view.slice();
      const result = decodeZektonAbc(view, regularIdentity);
      expectSuccess(result);
      assertCondition(result.ok, 'view descriptor should decode');
      assertBytesEqual(view, before, 'descriptor input remains unchanged');
      view[0] ^= 0xff;
      assertEqual(result.value.headerBytes[0], before[0], 'decoded header is not an input alias');
    },
  ],
  [
    'A8 DDS extracts exact payload and enforces descriptor dimension parity',
    () => {
      const result = decodeZektonA8Dds(regularDds, regularAtlasIdentity, { width: 16, height: 16 });
      expectSuccess(result);
      assertCondition(result.ok, 'synthetic A8 DDS should decode');
      assertEqual(result.value.width, 16, 'DDS width');
      assertEqual(result.value.height, 16, 'DDS height');
      assertEqual(result.value.alphaBytes.length, 256, 'A8 payload length');
      assertEqual(result.value.alphaBytes[0], 0, 'first alpha byte');
      assertEqual(result.value.alphaBytes[255], 255, 'last alpha byte');
      assertEqual(result.value.evidenceState, ZEKTON_EVIDENCE_STATE, 'DDS evidence state');
      const pair = decodeZektonFontAssets(
        regularAbc.bytes,
        regularIdentity,
        regularDds,
        regularAtlasIdentity,
      );
      expectSuccess(pair);
      assertCondition(pair.ok, 'descriptor and atlas pair should decode');
      assertEqual(pair.value.descriptor.glyphCount, 4, 'paired descriptor count');
      assertEqual(pair.value.atlas.alphaBytes[10], 10, 'paired atlas bytes');
      const boldPair = decodeZektonFontAssets(
        boldAbc.bytes,
        boldIdentity,
        boldDds,
        boldAtlasIdentity,
      );
      expectSuccess(boldPair);
      assertCondition(boldPair.ok, 'bold descriptor and atlas pair should decode');
      assertEqual(boldPair.value.descriptor.glyphCount, 5, 'paired bold descriptor count');
    },
  ],
  [
    'raw run measurement requires explicit scale and sums advances',
    () => {
      const descriptor = decodeZektonAbc(regularAbc.bytes, regularIdentity);
      assertCondition(descriptor.ok, 'descriptor should decode for measurement');
      const scaleOne = measureZektonGlyphRun(descriptor.value, ' AWi', 1);
      const scaleHalf = measureZektonGlyphRun(descriptor.value, ' AWi', 0.5);
      assertCondition(scaleOne.ok && scaleHalf.ok, 'known run should measure');
      assertEqual(scaleOne.value.rawAdvance, 24, 'raw advance sum at scale one');
      assertEqual(scaleOne.value.scaledAdvance, 24, 'scaled advance at scale one');
      assertEqual(scaleHalf.value.rawAdvance, 24, 'raw advance remains unscaled');
      assertEqual(scaleHalf.value.totalAdvance, 12, 'explicit half scale');
      const missing = measureZektonGlyphRun(descriptor.value, 'A?', 1);
      assertEqual(missing.ok, false, 'missing mapping is not a measured success');
      if (missing.ok === false && missing.kind === 'gap') {
        assertEqual(missing.kind, 'gap', 'missing mapping is a typed gap');
        assertEqual(missing.gaps[0]?.reason, 'missing-mapping', 'missing mapping reason');
      }
      const control = lookupZektonGlyph(descriptor.value, 10);
      const surrogate = lookupZektonGlyph(descriptor.value, 0xd800);
      assertEqual(control.ok, false, 'control code is a gap');
      assertEqual(surrogate.ok, false, 'surrogate code point is a gap');
    },
  ],
  [
    'native pen advance fail-first: positive nonzero bearing is included',
    () => {
      const descriptor = decodeZektonAbc(regularAbc.bytes, regularIdentity);
      assertCondition(descriptor.ok, 'descriptor should decode for native pen-advance fail-first test');
      const result = measureZektonGlyphRun(descriptor.value, 'A', 1);
      assertCondition(result.ok, 'known glyph should measure for native pen-advance fail-first test');
      assertEqual(result.value.rawAdvance, 8, 'A raw native pen advance includes horizontal bearing');
      assertEqual(result.value.scaledAdvance, 8, 'A scaled native pen advance includes horizontal bearing');
      assertEqual(result.value.totalAdvance, 8, 'A total native pen advance includes horizontal bearing');
      assertEqual(result.value.glyphs[0]?.rawAdvance, 8, 'A measured glyph raw native pen advance');
      assertEqual(result.value.glyphs[0]?.scaledAdvance, 8, 'A measured glyph scaled native pen advance');
    },
  ],
  [
    'native pen advance fail-first: negative bearing is included',
    () => {
      const descriptor = decodeZektonAbc(regularAbc.bytes, regularIdentity);
      assertCondition(descriptor.ok, 'descriptor should decode for negative-bearing fail-first test');
      const result = measureZektonGlyphRun(descriptor.value, ' ', 1);
      assertCondition(result.ok, 'space should measure for negative-bearing fail-first test');
      assertEqual(result.value.rawAdvance, 3, 'space raw native pen advance includes negative bearing');
      assertEqual(result.value.scaledAdvance, 3, 'space scaled native pen advance includes negative bearing');
      assertEqual(result.value.totalAdvance, 3, 'space total native pen advance includes negative bearing');
    },
  ],
  [
    'native pen advance fail-first: impossible negative derived advance refuses geometry',
    () => {
      const impossiblePenAbc = makeAbc(
        [{ ...regularRecords[0], bearing: -5, advance: 3 }],
        { 65: 1 },
      );
      const descriptor = decodeZektonAbc(impossiblePenAbc.bytes, regularIdentity);
      assertCondition(descriptor.ok, 'impossible derived-advance descriptor should retain raw fields');
      const result = measureZektonGlyphRun(descriptor.value, 'A', 1);
      assertEqual(result.ok, false, 'negative derived native pen advance must not return partial geometry');
      if (result.ok === false && result.kind === 'refusal') {
        assertEqual(result.error.code, 'invalid-metric', 'negative derived native pen advance refusal code');
      } else {
        throw new Error('negative derived native pen advance must return a typed refusal result');
      }
      const nonfinite = deriveZektonNativePenAdvance({ horizontalBearing: Number.NaN, advance: 3 });
      expectRefusal(nonfinite, 'invalid-metric');
      const overflowing = deriveZektonNativePenAdvance({ horizontalBearing: Number.MAX_SAFE_INTEGER, advance: 1 });
      expectRefusal(overflowing, 'invalid-metric');
      const impossibleDerived = deriveZektonNativePenAdvance({ horizontalBearing: -5, advance: 3 });
      expectRefusal(impossibleDerived, 'invalid-metric');
      const zeroBearing = deriveZektonNativePenAdvance({ horizontalBearing: 0, advance: 8 });
      expectSuccess(zeroBearing);
      assertCondition(zeroBearing.ok, 'zero-bearing native pen advance should be explicit');
      assertEqual(zeroBearing.value, 8, 'zero-bearing native pen advance remains value-identical');
    },
  ],
  [
    'native pen advance refuses derived values beyond the per-glyph cap',
    () => {
      const overCap = deriveZektonNativePenAdvance({
        horizontalBearing: fontSemantics.MAX_SAFE_GLYPH_ADVANCE,
        advance: fontSemantics.MAX_SAFE_GLYPH_ADVANCE,
      });
      expectRefusal(overCap, 'invalid-metric');
    },
  ],
  [
    'ABC typed header accepts padding and integer-rounding splits, and refuses malformed fields',
    () => {
      const padded = makeAbc(
        regularRecords,
        { 32: 1, 65: 2, 87: 3, 105: 4 },
        119,
        16,
        16,
        { outer: 11, top: 1, inner: 9.5, bottom: 0.5, split20: 4, split24: 5 },
      );
      const decoded = decodeZektonAbc(padded.bytes, regularIdentity);
      expectSuccess(decoded);
      assertCondition(decoded.ok, 'padding fixture should decode');
      assertEqual(decoded.value.lineMetrics.outer, 11, 'synthetic padded outer');
      assertEqual(decoded.value.lineMetrics.top, 1, 'synthetic padded top');
      assertEqual(decoded.value.lineMetrics.inner, 9.5, 'synthetic rounded inner');
      assertEqual(decoded.value.lineMetrics.bottom, 0.5, 'synthetic padded bottom');
      assertEqual(decoded.value.lineMetrics.split20, 4, 'synthetic split20');
      assertEqual(decoded.value.lineMetrics.split24, 5, 'synthetic split24');

      expectRefusal(
        decodeZektonAbc(mutateAbc(padded.bytes, view => view.setUint32(0, 8, true)), regularIdentity),
        'invalid-header',
      );
      expectRefusal(
        decodeZektonAbc(mutateAbc(padded.bytes, view => view.setUint32(32, 1, true)), regularIdentity),
        'invalid-header',
      );
      expectRefusal(
        decodeZektonAbc(mutateAbc(padded.bytes, view => view.setFloat32(4, 10, true)), regularIdentity),
        'invalid-header',
      );
      expectRefusal(
        decodeZektonAbc(mutateAbc(padded.bytes, view => view.setFloat32(8, -1, true)), regularIdentity),
        'invalid-header',
      );
      expectRefusal(
        decodeZektonAbc(mutateAbc(padded.bytes, view => view.setFloat32(4, Number.NaN, true)), regularIdentity),
        'invalid-header',
      );
      expectRefusal(
        decodeZektonAbc(
          mutateAbc(padded.bytes, view => {
            view.setFloat32(4, 4097, true);
            view.setFloat32(16, 4097, true);
            view.setInt32(20, 2048, true);
            view.setInt32(24, 2049, true);
          }),
          regularIdentity,
        ),
        'invalid-header',
      );
      expectRefusal(
        decodeZektonAbc(
          mutateAbc(padded.bytes, view => {
            view.setInt32(20, 1, true);
            view.setInt32(24, 1, true);
          }),
          regularIdentity,
        ),
        'invalid-header',
      );
      expectRefusal(
        decodeZektonAbc(mutateAbc(padded.bytes, view => view.setInt32(28, -1, true)), regularIdentity),
        'invalid-header',
      );
    },
  ],
  [
    'ABC rejects short, impossible, malformed, and unsupported structures',
    () => {
      expectRefusal(decodeZektonAbc(new Uint8Array(47), regularIdentity), 'too-short');
      const absurdMax = new Uint8Array(48);
      const absurdMaxView = new DataView(absurdMax.buffer);
      absurdMaxView.setUint32(0, 9, true);
      absurdMaxView.setFloat32(4, 52, true);
      absurdMaxView.setFloat32(16, 52, true);
      absurdMaxView.setInt32(20, 41, true);
      absurdMaxView.setInt32(24, 11, true);
      absurdMaxView.setInt32(28, 9, true);
      absurdMaxView.setUint32(36, 16, true);
      absurdMaxView.setUint32(40, 16, true);
      absurdMaxView.setUint32(44, 0xffffffff, true);
      expectRefusal(decodeZektonAbc(absurdMax, regularIdentity), 'invalid-map');
      const truncatedMap = makeAbc(regularRecords.slice(0, 1), { 32: 1 }, 32).bytes.slice(0, 55);
      expectRefusal(decodeZektonAbc(truncatedMap, regularIdentity), 'truncated-map');
      const beyondRecords = makeAbc(regularRecords.slice(0, 1), { 32: 2 }).bytes;
      expectRefusal(decodeZektonAbc(beyondRecords, regularIdentity), 'truncated-records');
      expectRefusal(decodeZektonAbc(regularAbc.bytes.slice(0, -5), regularIdentity), 'truncated-records');

      const nonfiniteUv = mutateAbc(regularAbc.bytes, (dataView) => {
        dataView.setFloat32(regularAbc.recordStart, Number.NaN, true);
      });
      expectRefusal(decodeZektonAbc(nonfiniteUv, regularIdentity), 'invalid-uv');
      const outOfRangeUv = mutateAbc(regularAbc.bytes, (dataView) => {
        dataView.setFloat32(regularAbc.recordStart + 8, 1.1, true);
      });
      expectRefusal(decodeZektonAbc(outOfRangeUv, regularIdentity), 'invalid-uv');
      const reversedUv = mutateAbc(regularAbc.bytes, (dataView) => {
        dataView.setFloat32(regularAbc.recordStart + 8, 0, true);
      });
      expectRefusal(decodeZektonAbc(reversedUv, regularIdentity), 'invalid-uv');
      const nonzeroPage = mutateAbc(regularAbc.bytes, (dataView) => {
        dataView.setUint16(regularAbc.recordStart + 22, 1, true);
      });
      expectRefusal(decodeZektonAbc(nonzeroPage, regularIdentity), 'unsupported-page');
      const impossibleWidth = mutateAbc(regularAbc.bytes, (dataView) => {
        dataView.setUint16(regularAbc.recordStart + 18, 0, true);
      });
      expectRefusal(decodeZektonAbc(impossibleWidth, regularIdentity), 'invalid-metric');
      const impossibleAdvance = mutateAbc(regularAbc.bytes, (dataView) => {
        dataView.setUint16(regularAbc.recordStart + 20, 0xffff, true);
      });
      expectRefusal(decodeZektonAbc(impossibleAdvance, regularIdentity), 'invalid-metric');
      const malformedTrailing = mutateAbc(regularAbc.bytes, (dataView) => {
        dataView.setUint32(regularAbc.bytes.length - 4, 1, true);
      });
      expectRefusal(decodeZektonAbc(malformedTrailing, regularIdentity), 'invalid-trailing-data');
      expectRefusal(decodeZektonAbc(new Uint8Array([...regularAbc.bytes, 0]), regularIdentity), 'invalid-trailing-data');
      const malformedPadding = makeAbc(regularRecords, { 32: 1, 65: 2, 87: 3, 105: 4 }, 118);
      malformedPadding.bytes[48 + ((118 + 1) * 2)] = 1;
      expectRefusal(decodeZektonAbc(malformedPadding.bytes, regularIdentity), 'invalid-alignment-padding');
    },
  ],
  [
    'DDS rejects bad headers, dimensions, formats, payloads, and layouts',
    () => {
      expectRefusal(
        decodeZektonA8Dds(mutateDds(regularDds, (dataView) => dataView.setUint32(0, 0, true)), regularAtlasIdentity),
        'invalid-magic',
      );
      expectRefusal(
        decodeZektonA8Dds(mutateDds(regularDds, (dataView) => dataView.setUint32(4, 123, true)), regularAtlasIdentity),
        'invalid-dds-header',
      );
      expectRefusal(
        decodeZektonA8Dds(mutateDds(regularDds, (dataView) => dataView.setUint32(76, 31, true)), regularAtlasIdentity),
        'invalid-pixel-format',
      );
      expectRefusal(decodeZektonA8Dds(regularDds.slice(0, 127), regularAtlasIdentity), 'too-short');
      expectRefusal(decodeZektonA8Dds(regularDds.slice(0, -1), regularAtlasIdentity), 'truncated-payload');
      expectRefusal(
        decodeZektonA8Dds(mutateDds(regularDds, (dataView) => dataView.setUint32(16, 0, true)), regularAtlasIdentity),
        'invalid-dimensions',
      );
      expectRefusal(
        decodeZektonA8Dds(mutateDds(regularDds, (dataView) => dataView.setUint32(12, 0xffff, true)), regularAtlasIdentity),
        'invalid-dimensions',
      );
      expectRefusal(
        decodeZektonA8Dds(regularDds, regularAtlasIdentity, { width: 8, height: 16 }),
        'invalid-dimension-parity',
      );
      expectRefusal(
        decodeZektonA8Dds(
          mutateDds(regularDds, (dataView) => {
            dataView.setUint32(80, 4, true);
            dataView.setUint32(84, 0x31545844, true);
          }),
          regularAtlasIdentity,
        ),
        'invalid-pixel-format',
      );
      expectRefusal(
        decodeZektonA8Dds(
          mutateDds(regularDds, (dataView) => {
            dataView.setUint32(80, 0x40, true);
            dataView.setUint32(88, 32, true);
            dataView.setUint32(92, 0xff, true);
          }),
          regularAtlasIdentity,
        ),
        'invalid-pixel-format',
      );
      expectRefusal(
        decodeZektonA8Dds(mutateDds(regularDds, (dataView) => dataView.setUint32(88, 16, true)), regularAtlasIdentity),
        'invalid-pixel-format',
      );
      expectRefusal(
        decodeZektonA8Dds(mutateDds(regularDds, (dataView) => dataView.setUint32(104, 0xf0, true)), regularAtlasIdentity),
        'invalid-pixel-format',
      );
      expectRefusal(
        decodeZektonA8Dds(mutateDds(regularDds, (dataView) => dataView.setUint32(28, 2, true)), regularAtlasIdentity),
        'unsupported-layout',
      );
      expectRefusal(
        decodeZektonA8Dds(mutateDds(regularDds, (dataView) => dataView.setUint32(112, 0x200, true)), regularAtlasIdentity),
        'unsupported-layout',
      );
      expectRefusal(
        decodeZektonA8Dds(mutateDds(regularDds, (dataView) => dataView.setUint32(24, 1, true)), regularAtlasIdentity),
        'unsupported-layout',
      );
      expectRefusal(
        decodeZektonA8Dds(new Uint8Array([...regularDds, 0]), regularAtlasIdentity),
        'invalid-payload-length',
      );
    },
  ],
  [
    'measurement and decode are deterministic, and input alpha bytes stay isolated',
    () => {
      const descriptorFirst = decodeZektonAbc(regularAbc.bytes, regularIdentity);
      const descriptorSecond = decodeZektonAbc(regularAbc.bytes, regularIdentity);
      const atlasFirst = decodeZektonA8Dds(regularDds, regularAtlasIdentity);
      const atlasSecond = decodeZektonA8Dds(regularDds, regularAtlasIdentity);
      assertEqual(snapshot(descriptorFirst), snapshot(descriptorSecond), 'repeated ABC output');
      assertEqual(snapshot(atlasFirst), snapshot(atlasSecond), 'repeated DDS output');
      assertCondition(descriptorFirst.ok && atlasFirst.ok, 'determinism fixtures decode');
      assertBytesEqual(regularDds, makeDds(), 'DDS input is unchanged');
      const alphaBefore = atlasFirst.value.alphaBytes.slice();
      regularDds[128] ^= 0xff;
      assertBytesEqual(atlasFirst.value.alphaBytes, alphaBefore, 'alpha payload is copied');
      regularDds[128] ^= 0xff;
      const invalidScale = measureZektonGlyphRun(descriptorFirst.value, 'A', Number.NaN);
      assertEqual(invalidScale.ok, false, 'NaN scale is a typed refusal');
      const negativeScale = measureZektonGlyphRun(descriptorFirst.value, 'A', -1);
      assertEqual(negativeScale.ok, false, 'negative scale is a typed refusal');
      const overflowingScale = measureZektonGlyphRun(descriptorFirst.value, 'A', Number.MAX_VALUE);
      expectRefusal(overflowingScale, 'measurement-overflow');
    },
  ],
];

let passed = 0;
const failures: string[] = [];
for (const [name, test] of tests) {
  try {
    test();
    passed += 1;
  } catch (error) {
    failures.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

console.log(`x4UiFontMetrics selftest: ${passed}/${tests.length} passed`);
if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`FAIL ${failure}`);
  }
  throw new Error(`${failures.length} selftest case(s) failed.`);
}
