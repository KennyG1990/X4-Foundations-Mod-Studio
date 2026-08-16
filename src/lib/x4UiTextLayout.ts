import {
  MAX_SAFE_RUN_CODE_UNITS,
  MAX_UNICODE_CODE_POINT,
  ZEKTON_CORPUS_ASSETS,
  ZEKTON_EVIDENCE_STATE,
  lookupZektonGlyph,
} from './x4UiFontMetrics';
import type {
  ZektonAbcDescriptor,
  ZektonAssetIdentity,
  ZektonFontAssets,
  ZektonGlyphMetrics,
  ZektonLineMetrics,
} from './x4UiFontMetrics';

/**
 * Pure, deterministic projection of decoded Zekton metrics into text lines
 * and later-painter glyph quads. The atlas payload is deliberately absent:
 * the caller already owns the decoded font asset and its exact identity.
 */

export const ZEKTON_TEXT_LAYOUT_VERSION = 1 as const;
export const ZEKTON_TEXT_TRUTH_GRADE = 'source-backed-provisional' as const;
export const ZEKTON_TEXT_METRICS_EVIDENCE = 'exact-source-backed' as const;
export const MAX_SAFE_LAYOUT_WIDTH = 1_000_000_000;
export const MAX_SAFE_LAYOUT_SCALE = 4096;

export type ZektonTextTruthGrade =
  | typeof ZEKTON_TEXT_TRUTH_GRADE
  | typeof ZEKTON_EVIDENCE_STATE;

export type ZektonWrapMode = 'no-wrap' | 'word-wrap' | 'greedy-word' | 'none';
export type ZektonTruncationMode = 'none' | 'ellipsis';
export type ZektonNewlinePolicy = 'lf-crlf' | 'lf-crlf-and-cr';

export interface ZektonWhitespacePolicy {
  readonly mode: 'preserve' | 'trim-at-wrap';
  readonly breakOn: 'ascii-space' | 'unicode-space';
}

export interface ZektonEllipsisPolicy {
  readonly token: string;
  readonly placement: 'end';
}

export interface ZektonTextLayoutProfile {
  readonly descriptorIdentity: ZektonAssetIdentity;
  readonly atlasIdentity: ZektonAssetIdentity;
  /** Explicit design size; never inferred from a filename. */
  readonly nominalDesignSize: number;
  /** The integer size after the shipped Helper scaleFont path. */
  readonly requestedFontSize: number;
  readonly maxWidth: number;
  /** Extra distance between adjacent source-backed line boxes. */
  readonly lineSpacing: number;
  readonly wrapMode: ZektonWrapMode;
  readonly truncationMode: ZektonTruncationMode;
  readonly whitespacePolicy: ZektonWhitespacePolicy;
  readonly ellipsisPolicy: ZektonEllipsisPolicy;
  readonly newlinePolicy: ZektonNewlinePolicy;
  /** The only supported fallback is a visible, source-indexed gap. */
  readonly fallbackPolicy: 'gap';
  readonly truthGrade: ZektonTextTruthGrade;
  readonly evidenceState: typeof ZEKTON_EVIDENCE_STATE;
}

export interface ZektonTextRange {
  /** UTF-16 source offsets, end exclusive. */
  readonly start: number;
  readonly end: number;
}

export interface ZektonCodePointRange {
  /** Unicode-code-point ordinals, end exclusive. */
  readonly start: number;
  readonly end: number;
}

export interface ZektonScaledLineMetrics {
  readonly outer: number;
  readonly top: number;
  readonly bottom: number;
  readonly inner: number;
  readonly split20: number;
  readonly split24: number;
}

export interface ZektonTextLineBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly lineAdvance: number;
  readonly metrics: ZektonScaledLineMetrics;
}

export interface ZektonDesignLineCandidate {
  readonly nominalDesignSize: number;
  readonly requestedFontSize: number;
  readonly scale: number;
  readonly raw: ZektonLineMetrics;
  readonly scaled: ZektonScaledLineMetrics;
  readonly lineSpacing: number;
  readonly lineAdvance: number;
}

export type ZektonTextGapReason =
  | 'missing-glyph'
  | 'unsupported-control'
  | 'unsupported-icon-escape'
  | 'surrogate-invalid'
  | 'invalid-newline'
  | 'ellipsis-missing-glyph'
  | 'overflow';

export interface ZektonTextLayoutGap {
  readonly kind: 'gap';
  readonly reason: ZektonTextGapReason;
  readonly sourceRange: ZektonTextRange;
  readonly sourceCodePointRange: ZektonCodePointRange;
  readonly codePoint?: number;
  readonly lineIndex: number;
  readonly displayed: boolean;
  readonly message: string;
}

export interface ZektonGlyphQuad {
  readonly kind: 'glyph-quad';
  readonly sourceRange: ZektonTextRange;
  readonly sourceCodePointRange: ZektonCodePointRange;
  readonly codePoint: number;
  readonly glyphIndex: number;
  readonly x: number;
  readonly y: number;
  /** The bitmap height comes from the exact normalized atlas rectangle. */
  readonly width: number;
  readonly height: number;
  /** Exact atlas rectangle height, retained separately from the line-box height. */
  readonly bitmapHeight: number;
  readonly lineBoxY: number;
  readonly lineBoxHeight: number;
  readonly bearingX: number;
  readonly bitmapWidth: number;
  readonly advance: number;
  readonly scaledAdvance: number;
  readonly bitmapBounds: {
    readonly left: number;
    readonly top: number;
    readonly right: number;
    readonly bottom: number;
  };
  readonly uv: {
    readonly u0: number;
    readonly v0: number;
    readonly u1: number;
    readonly v1: number;
  };
  readonly descriptorIdentity: ZektonAssetIdentity;
  readonly atlasIdentity: ZektonAssetIdentity;
  readonly evidenceState: typeof ZEKTON_EVIDENCE_STATE;
  readonly isEllipsis: boolean;
}

export type ZektonLineBreakReason =
  | 'empty'
  | 'hard-newline'
  | 'word-wrap'
  | 'codepoint-wrap'
  | 'overflow-token'
  | 'truncated'
  | 'overflow'
  | 'end-of-text';

export interface ZektonTextLayoutLine {
  readonly lineIndex: number;
  readonly displayedText: string;
  readonly sourceRange: ZektonTextRange;
  readonly sourceCodePointRange: ZektonCodePointRange;
  readonly width: number;
  readonly maxWidth: number;
  readonly lineBox: ZektonTextLineBox;
  readonly breakReason: ZektonLineBreakReason;
  readonly breakSourceRange?: ZektonTextRange;
  readonly breakSourceCodePointRange?: ZektonCodePointRange;
  readonly truncated: boolean;
  readonly overflow: boolean;
  readonly glyphQuads: ReadonlyArray<ZektonGlyphQuad>;
  readonly gaps: ReadonlyArray<ZektonTextLayoutGap>;
}

export interface ZektonTextLayoutEvidence {
  readonly metrics: typeof ZEKTON_TEXT_METRICS_EVIDENCE;
  readonly wrapAndTruncationPolicy: typeof ZEKTON_EVIDENCE_STATE;
  readonly gameParity: 'not-verified';
}

export interface ZektonTextLayout {
  readonly format: 'x4-zekton-text-layout';
  readonly version: typeof ZEKTON_TEXT_LAYOUT_VERSION;
  readonly originalText: string;
  /** Hard newlines are normalized to LF in this display-only projection. */
  readonly displayedText: string;
  readonly sourceLength: number;
  readonly sourceCodePointCount: number;
  readonly scale: number;
  readonly maxWidth: number;
  readonly lineMetrics: ZektonLineMetrics;
  readonly designLineCandidate: ZektonDesignLineCandidate;
  readonly profile: ZektonTextLayoutProfile;
  readonly lines: ReadonlyArray<ZektonTextLayoutLine>;
  readonly gaps: ReadonlyArray<ZektonTextLayoutGap>;
  readonly truncated: boolean;
  readonly overflow: boolean;
  readonly descriptorIdentity: ZektonAssetIdentity;
  readonly atlasIdentity: ZektonAssetIdentity;
  readonly evidenceState: typeof ZEKTON_EVIDENCE_STATE;
  readonly truthGrade: ZektonTextTruthGrade;
  readonly evidence: ZektonTextLayoutEvidence;
}

export type ZektonTextLayoutErrorCode =
  | 'invalid-input'
  | 'invalid-font-assets'
  | 'identity-mismatch'
  | 'invalid-profile'
  | 'unsupported-policy'
  | 'layout-overflow';

export interface ZektonTextLayoutError {
  readonly code: ZektonTextLayoutErrorCode;
  readonly message: string;
}

export type ZektonTextLayoutResult =
  | { readonly ok: true; readonly value: ZektonTextLayout }
  | { readonly ok: false; readonly kind: 'refusal'; readonly error: ZektonTextLayoutError };

interface IdentityCopy {
  readonly identity: ZektonAssetIdentity;
}

interface ValidatedFont {
  readonly descriptor: ZektonAbcDescriptor;
  readonly descriptorIdentity: ZektonAssetIdentity;
  readonly atlasIdentity: ZektonAssetIdentity;
}

interface NormalizedProfile extends ZektonTextLayoutProfile {
  readonly normalizedWrapMode: 'no-wrap' | 'greedy-word';
}

interface TokenGap {
  readonly reason: ZektonTextGapReason;
  readonly codePoint?: number;
  readonly message: string;
}

interface LayoutToken {
  readonly text: string;
  readonly sourceStart: number;
  readonly sourceEnd: number;
  readonly sourceCodePointStart: number;
  readonly sourceCodePointEnd: number;
  readonly codePoint?: number;
  readonly glyph?: ZektonGlyphMetrics;
  readonly glyphIndex?: number;
  readonly advance: number;
  readonly width: number;
  readonly breakableWhitespace: boolean;
  readonly newline: boolean;
  readonly ellipsis: boolean;
  readonly gap?: TokenGap;
}

interface LineDraft {
  readonly tokens: ReadonlyArray<LayoutToken>;
  readonly width: number;
  readonly sourceFallback: number;
  readonly codePointFallback: number;
  readonly breakReason: ZektonLineBreakReason;
  readonly truncated: boolean;
  readonly breakSourceRange?: ZektonTextRange;
  readonly breakSourceCodePointRange?: ZektonCodePointRange;
  readonly overflow: boolean;
}

interface TokenizedText {
  readonly tokens: ReadonlyArray<LayoutToken>;
  readonly codePointCount: number;
}

interface LineDraftSet {
  readonly drafts: ReadonlyArray<LineDraft>;
}

function freezeArray<T>(values: T[]): ReadonlyArray<T> {
  return Object.freeze(values.slice());
}

function freezeRecord<T extends object>(value: T): T {
  return Object.freeze(value);
}

function refusal(code: ZektonTextLayoutErrorCode, message: string): ZektonTextLayoutResult {
  return freezeRecord({
    ok: false as const,
    kind: 'refusal' as const,
    error: freezeRecord({ code, message }),
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

function copyIdentity(value: unknown): IdentityCopy | undefined {
  if (!isRecord(value)) return undefined;
  try {
    if (typeof value.relativePath !== 'string' || value.relativePath.length === 0) return undefined;
    if (typeof value.sha256 !== 'string' || value.sha256.length === 0) return undefined;
    const copy: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      const field = value[key];
      if (
        field !== null &&
        typeof field !== 'string' &&
        typeof field !== 'number' &&
        typeof field !== 'boolean'
      ) {
        return undefined;
      }
      if (typeof field === 'number' && !Number.isFinite(field)) return undefined;
      copy[key] = field;
    }
    copy.relativePath = value.relativePath;
    copy.sha256 = value.sha256;
    return { identity: freezeRecord(copy) as ZektonAssetIdentity };
  } catch {
    return undefined;
  }
}

function sameIdentity(left: ZektonAssetIdentity, right: ZektonAssetIdentity): boolean {
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  if (leftKeys.length !== rightKeys.length) return false;
  for (let index = 0; index < leftKeys.length; index += 1) {
    const key = leftKeys[index];
    if (key !== rightKeys[index] || left[key] !== right[key]) return false;
  }
  return true;
}

function isCanonicalDesignPair(font: ValidatedFont): boolean {
  const canonicalPairs = [ZEKTON_CORPUS_ASSETS.regular, ZEKTON_CORPUS_ASSETS.bold];
  return canonicalPairs.some(pair =>
    sameIdentity(font.descriptorIdentity, pair.descriptor) &&
    sameIdentity(font.atlasIdentity, pair.atlas),
  );
}

function copyRange(start: number, end: number): ZektonTextRange {
  return freezeRecord({ start, end });
}

function copyCodePointRange(start: number, end: number): ZektonCodePointRange {
  return freezeRecord({ start, end });
}

function validMetricSet(metrics: ZektonLineMetrics): boolean {
  const values = [metrics.outer, metrics.top, metrics.bottom, metrics.inner, metrics.split20, metrics.split24, metrics.rawMetric28];
  return values.every(value => Number.isFinite(value) && value >= 0);
}

function validateFontAssets(input: unknown): ValidatedFont | ZektonTextLayoutResult {
  if (!isRecord(input) || input.format !== 'x4-zekton-font-assets') {
    return refusal('invalid-font-assets', 'Text layout requires a decoded x4-zekton-font-assets value.');
  }
  const descriptor = input.descriptor;
  const atlas = input.atlas;
  if (!isRecord(descriptor) || descriptor.format !== 'x4-zekton-abc' || !isRecord(atlas) || atlas.format !== 'x4-zekton-a8-dds') {
    return refusal('invalid-font-assets', 'Decoded font assets have unsupported descriptor or atlas formats.');
  }
  const descriptorIdentity = copyIdentity(input.descriptorIdentity);
  const atlasIdentity = copyIdentity(input.atlasIdentity);
  const descriptorValueIdentity = copyIdentity(descriptor.identity);
  const atlasValueIdentity = copyIdentity(atlas.identity);
  if (!descriptorIdentity || !atlasIdentity || !descriptorValueIdentity || !atlasValueIdentity) {
    return refusal('invalid-font-assets', 'Decoded font assets do not carry serializable identities.');
  }
  if (!sameIdentity(descriptorIdentity.identity, descriptorValueIdentity.identity)) {
    return refusal('identity-mismatch', 'Descriptor identity does not match the decoded descriptor.');
  }
  if (!sameIdentity(atlasIdentity.identity, atlasValueIdentity.identity)) {
    return refusal('identity-mismatch', 'Atlas identity does not match the decoded atlas.');
  }
  if (
    input.evidenceState !== ZEKTON_EVIDENCE_STATE ||
    descriptor.evidenceState !== ZEKTON_EVIDENCE_STATE ||
    atlas.evidenceState !== ZEKTON_EVIDENCE_STATE
  ) {
    return refusal('invalid-font-assets', 'Font assets must retain provisional-until-game-parity evidence.');
  }
  const lineMetrics = descriptor.lineMetrics;
  if (!isRecord(lineMetrics)) {
    return refusal('invalid-font-assets', 'Decoded descriptor is missing valid typed line metrics.');
  }
  const typedLineMetrics = lineMetrics as unknown as ZektonLineMetrics;
  if (!validMetricSet(typedLineMetrics)) {
    return refusal('invalid-font-assets', 'Decoded descriptor is missing valid typed line metrics.');
  }
  const descriptorAtlasWidth = descriptor.atlasWidth;
  const descriptorAtlasHeight = descriptor.atlasHeight;
  const descriptorMaxCodepoint = descriptor.maxCodepoint;
  if (
    typeof descriptorAtlasWidth !== 'number' ||
    typeof descriptorAtlasHeight !== 'number' ||
    typeof descriptorMaxCodepoint !== 'number' ||
    !Number.isFinite(descriptorAtlasWidth) ||
    !Number.isFinite(descriptorAtlasHeight) ||
    descriptorAtlasWidth !== atlas.width ||
    descriptorAtlasHeight !== atlas.height ||
    !Number.isSafeInteger(descriptorMaxCodepoint) ||
    descriptorMaxCodepoint < 0 ||
    descriptorMaxCodepoint > MAX_UNICODE_CODE_POINT
  ) {
    return refusal('invalid-font-assets', 'Decoded descriptor and atlas dimensions are not in exact parity.');
  }
  return {
    descriptor: descriptor as unknown as ZektonAbcDescriptor,
    descriptorIdentity: descriptorIdentity.identity,
    atlasIdentity: atlasIdentity.identity,
  };
}

function normalizeWrapMode(value: unknown): 'no-wrap' | 'greedy-word' | undefined {
  if (value === 'no-wrap' || value === 'none') return 'no-wrap';
  if (value === 'word-wrap' || value === 'greedy-word') return 'greedy-word';
  return undefined;
}

function validateProfile(
  input: unknown,
  font: ValidatedFont,
): NormalizedProfile | ZektonTextLayoutResult {
  if (!isRecord(input)) return refusal('invalid-profile', 'Text layout profile must be an object.');
  const profileDescriptorIdentity = copyIdentity(input.descriptorIdentity);
  const profileAtlasIdentity = copyIdentity(input.atlasIdentity);
  if (!profileDescriptorIdentity || !profileAtlasIdentity) {
    return refusal('invalid-profile', 'Text layout profile requires exact descriptor and atlas identities.');
  }
  if (!sameIdentity(profileDescriptorIdentity.identity, font.descriptorIdentity)) {
    return refusal('identity-mismatch', 'Text profile descriptor identity does not match the decoded descriptor.');
  }
  if (!sameIdentity(profileAtlasIdentity.identity, font.atlasIdentity)) {
    return refusal('identity-mismatch', 'Text profile atlas identity does not match the decoded atlas.');
  }

  const nominalDesignSize = input.nominalDesignSize;
  const requestedFontSize = input.requestedFontSize;
  const maxWidth = input.maxWidth;
  const lineSpacing = input.lineSpacing;
  if (
    typeof nominalDesignSize !== 'number' ||
    !Number.isFinite(nominalDesignSize) ||
    nominalDesignSize < 1 ||
    nominalDesignSize > MAX_SAFE_LAYOUT_SCALE ||
    typeof requestedFontSize !== 'number' ||
    !Number.isSafeInteger(requestedFontSize) ||
    requestedFontSize <= 0 ||
    requestedFontSize > MAX_SAFE_LAYOUT_SCALE ||
    typeof maxWidth !== 'number' ||
    !Number.isFinite(maxWidth) ||
    maxWidth < 0 ||
    maxWidth > MAX_SAFE_LAYOUT_WIDTH ||
    typeof lineSpacing !== 'number' ||
    !Number.isFinite(lineSpacing) ||
    lineSpacing < 0 ||
    lineSpacing > MAX_SAFE_LAYOUT_WIDTH
  ) {
    return refusal('invalid-profile', 'Text profile sizes, width, and line spacing must be finite and in supported domains.');
  }
  if (nominalDesignSize !== 32) {
    return refusal(
      'invalid-profile',
      'nominalDesignSize must be exactly 32 for the supported pinned Zekton profiles.',
    );
  }
  if (!isCanonicalDesignPair(font)) {
    return refusal(
      'invalid-profile',
      'nominalDesignSize 32 is authorized only for an exact canonical regular or bold Zekton descriptor+atlas pair.',
    );
  }
  const scale = requestedFontSize / nominalDesignSize;
  if (!Number.isFinite(scale) || scale <= 0 || scale > MAX_SAFE_LAYOUT_SCALE) {
    return refusal('invalid-profile', 'Text profile design-size scale is outside the supported finite domain.');
  }

  const normalizedWrapMode = normalizeWrapMode(input.wrapMode);
  if (!normalizedWrapMode) return refusal('unsupported-policy', 'Text profile wrapMode must be explicit no-wrap or greedy word wrap.');
  if (input.truncationMode !== 'none' && input.truncationMode !== 'ellipsis') {
    return refusal('unsupported-policy', 'Text profile truncationMode must be none or ellipsis.');
  }
  if (input.fallbackPolicy !== 'gap') {
    return refusal('unsupported-policy', 'Text profile fallbackPolicy must be gap; replacement fonts are unsupported.');
  }
  if (input.newlinePolicy !== 'lf-crlf' && input.newlinePolicy !== 'lf-crlf-and-cr') {
    return refusal('unsupported-policy', 'Text profile newlinePolicy must explicitly select CR/LF handling.');
  }
  if (
    input.truthGrade !== ZEKTON_TEXT_TRUTH_GRADE &&
    input.truthGrade !== ZEKTON_EVIDENCE_STATE
  ) {
    return refusal('invalid-profile', 'Text profile truthGrade must remain provisional until game parity.');
  }
  if (input.evidenceState !== ZEKTON_EVIDENCE_STATE) {
    return refusal('invalid-profile', 'Text profile evidenceState must be provisional-until-game-parity.');
  }
  if (!isRecord(input.whitespacePolicy)) {
    return refusal('invalid-profile', 'Text profile requires an explicit whitespace policy.');
  }
  const whitespacePolicy = input.whitespacePolicy;
  if (
    (whitespacePolicy.mode !== 'preserve' && whitespacePolicy.mode !== 'trim-at-wrap') ||
    (whitespacePolicy.breakOn !== 'ascii-space' && whitespacePolicy.breakOn !== 'unicode-space')
  ) {
    return refusal('unsupported-policy', 'Whitespace policy must explicitly choose preservation and break characters.');
  }
  if (!isRecord(input.ellipsisPolicy) || input.ellipsisPolicy.placement !== 'end') {
    return refusal('invalid-profile', 'Text profile requires an explicit end ellipsis policy.');
  }
  const ellipsisToken = input.ellipsisPolicy.token;
  if (
    typeof ellipsisToken !== 'string' ||
    ellipsisToken.length === 0 ||
    ellipsisToken.length > MAX_SAFE_RUN_CODE_UNITS ||
    ellipsisToken.includes('\n') ||
    ellipsisToken.includes('\r')
  ) {
    return refusal('invalid-profile', 'Ellipsis policy must provide a finite token without newline characters.');
  }

  const normalized = freezeRecord({
    descriptorIdentity: profileDescriptorIdentity.identity,
    atlasIdentity: profileAtlasIdentity.identity,
    nominalDesignSize,
    requestedFontSize,
    maxWidth,
    lineSpacing,
    wrapMode: input.wrapMode as ZektonWrapMode,
    truncationMode: input.truncationMode as ZektonTruncationMode,
    whitespacePolicy: freezeRecord({
      mode: whitespacePolicy.mode as 'preserve' | 'trim-at-wrap',
      breakOn: whitespacePolicy.breakOn as 'ascii-space' | 'unicode-space',
    }),
    ellipsisPolicy: freezeRecord({ token: ellipsisToken, placement: 'end' as const }),
    newlinePolicy: input.newlinePolicy as ZektonNewlinePolicy,
    fallbackPolicy: 'gap' as const,
    truthGrade: input.truthGrade as ZektonTextTruthGrade,
    evidenceState: ZEKTON_EVIDENCE_STATE,
    normalizedWrapMode,
  });
  return normalized;
}

function isUnicodeWhitespace(codePoint: number): boolean {
  return (
    codePoint === 0x0009 ||
    codePoint === 0x0020 ||
    codePoint === 0x00a0 ||
    codePoint === 0x1680 ||
    (codePoint >= 0x2000 && codePoint <= 0x200a) ||
    codePoint === 0x2028 ||
    codePoint === 0x2029 ||
    codePoint === 0x202f ||
    codePoint === 0x205f ||
    codePoint === 0x3000
  );
}

function isBreakableWhitespace(codePoint: number, policy: ZektonWhitespacePolicy): boolean {
  if (policy.breakOn === 'ascii-space') return codePoint === 0x0020;
  return isUnicodeWhitespace(codePoint) && codePoint !== 0x0009;
}

function mapGlyphGap(
  codePoint: number | undefined,
  reason: string,
  ellipsis: boolean,
): TokenGap {
  if (ellipsis && reason === 'missing-mapping') {
    return {
      reason: 'ellipsis-missing-glyph',
      ...(codePoint === undefined ? {} : { codePoint }),
      message: 'Ellipsis token has no source glyph mapping; no replacement was used.',
    };
  }
  if (reason === 'missing-mapping') {
    return {
      reason: 'missing-glyph',
      ...(codePoint === undefined ? {} : { codePoint }),
      message: 'Source text has no glyph mapping; no replacement was used.',
    };
  }
  if (reason === 'surrogate-invalid') {
    return {
      reason: 'surrogate-invalid',
      ...(codePoint === undefined ? {} : { codePoint }),
      message: 'Invalid UTF-16 surrogate input remains a source-indexed gap.',
    };
  }
  if (codePoint === 0x001b) {
    return {
      reason: 'unsupported-icon-escape',
      codePoint,
      message: 'X4 icon escape/control input is unsupported by the pure glyph projector.',
    };
  }
  return {
    reason: 'unsupported-control',
    ...(codePoint === undefined ? {} : { codePoint }),
    message: 'Control or unsupported escape input remains a source-indexed gap.',
  };
}

function tokenizeText(
  text: string,
  descriptor: ZektonAbcDescriptor,
  scale: number,
  policy: ZektonTextLayoutProfile,
  ellipsis: boolean,
  sourceBase: number,
  codePointBase: number,
): TokenizedText | ZektonTextLayoutResult {
  const tokens: LayoutToken[] = [];
  let textIndex = 0;
  let codePointIndex = 0;
  while (textIndex < text.length) {
    const start = textIndex;
    const codePointStart = codePointIndex;
    const firstUnit = text.charCodeAt(textIndex);
    if (firstUnit === 0x000d) {
      const hasLf = textIndex + 1 < text.length && text.charCodeAt(textIndex + 1) === 0x000a;
      if (hasLf || policy.newlinePolicy === 'lf-crlf-and-cr') {
        const consumedUnits = hasLf ? 2 : 1;
        const consumedCodePoints = hasLf ? 2 : 1;
        tokens.push(freezeRecord({
          text: text.slice(textIndex, textIndex + consumedUnits),
          sourceStart: sourceBase + textIndex,
          sourceEnd: sourceBase + textIndex + consumedUnits,
          sourceCodePointStart: codePointBase + codePointIndex,
          sourceCodePointEnd: codePointBase + codePointIndex + consumedCodePoints,
          advance: 0,
          width: 0,
          breakableWhitespace: false,
          newline: true,
          ellipsis,
        }));
        textIndex += consumedUnits;
        codePointIndex += consumedCodePoints;
        continue;
      }
      tokens.push(freezeRecord({
        text: '\r',
        sourceStart: sourceBase + start,
        sourceEnd: sourceBase + start + 1,
        sourceCodePointStart: codePointBase + codePointStart,
        sourceCodePointEnd: codePointBase + codePointStart + 1,
        advance: 0,
        width: 0,
        breakableWhitespace: false,
        newline: false,
        ellipsis,
        gap: { reason: 'invalid-newline', message: 'Lone CR is not enabled by the explicit newline policy.' },
      }));
      textIndex += 1;
      codePointIndex += 1;
      continue;
    }
    if (firstUnit === 0x000a) {
      tokens.push(freezeRecord({
        text: '\n',
        sourceStart: sourceBase + start,
        sourceEnd: sourceBase + start + 1,
        sourceCodePointStart: codePointBase + codePointStart,
        sourceCodePointEnd: codePointBase + codePointStart + 1,
        advance: 0,
        width: 0,
        breakableWhitespace: false,
        newline: true,
        ellipsis,
      }));
      textIndex += 1;
      codePointIndex += 1;
      continue;
    }

    let codePoint: number;
    let consumedUnits = 1;
    let sourceGap: TokenGap | undefined;
    if (firstUnit >= 0xd800 && firstUnit <= 0xdbff) {
      const nextUnit = textIndex + 1 < text.length ? text.charCodeAt(textIndex + 1) : undefined;
      if (nextUnit !== undefined && nextUnit >= 0xdc00 && nextUnit <= 0xdfff) {
        codePoint = 0x10000 + ((firstUnit - 0xd800) << 10) + (nextUnit - 0xdc00);
        consumedUnits = 2;
      } else {
        codePoint = firstUnit;
        sourceGap = mapGlyphGap(codePoint, 'surrogate-invalid', ellipsis);
      }
    } else if (firstUnit >= 0xdc00 && firstUnit <= 0xdfff) {
      codePoint = firstUnit;
      sourceGap = mapGlyphGap(codePoint, 'surrogate-invalid', ellipsis);
    } else {
      codePoint = firstUnit;
    }

    if (sourceGap === undefined) {
      const lookup = lookupZektonGlyph(descriptor, codePoint);
      if (lookup.ok === false) {
        sourceGap = mapGlyphGap(lookup.gap.codePoint, lookup.gap.reason, ellipsis);
      }
    }
    const glyph = sourceGap === undefined
      ? lookupZektonGlyph(descriptor, codePoint)
      : undefined;
    let advance = 0;
    let width = 0;
    let glyphMetrics: ZektonGlyphMetrics | undefined;
    let glyphIndex: number | undefined;
    if (glyph !== undefined && glyph.ok) {
      glyphMetrics = glyph.glyph;
      glyphIndex = glyph.glyphIndex;
      advance = glyphMetrics.advance;
      width = glyphMetrics.advance * scale;
      if (!Number.isFinite(width) || width < 0 || width > Number.MAX_SAFE_INTEGER) {
        sourceGap = { reason: 'overflow', codePoint, message: 'Scaled glyph advance exceeded finite numeric bounds.' };
        advance = 0;
        width = 0;
        glyphMetrics = undefined;
        glyphIndex = undefined;
      }
    }
    tokens.push(freezeRecord({
      text: text.slice(start, start + consumedUnits),
      sourceStart: sourceBase + start,
      sourceEnd: sourceBase + start + consumedUnits,
      sourceCodePointStart: codePointBase + codePointStart,
      sourceCodePointEnd: codePointBase + codePointStart + 1,
      codePoint,
      glyph: glyphMetrics,
      glyphIndex,
      advance,
      width,
      breakableWhitespace: sourceGap === undefined && isBreakableWhitespace(codePoint, policy.whitespacePolicy),
      newline: false,
      ellipsis,
      ...(sourceGap === undefined ? {} : { gap: sourceGap }),
    }));
    textIndex += consumedUnits;
    codePointIndex += 1;
  }
  return { tokens: freezeArray(tokens), codePointCount: codePointIndex };
}

function sumTokenWidths(tokens: ReadonlyArray<LayoutToken>): number | undefined {
  let width = 0;
  for (const token of tokens) {
    if (!Number.isFinite(token.width) || token.width < 0 || width > Number.MAX_SAFE_INTEGER - token.width) return undefined;
    width += token.width;
  }
  return width;
}

function makeDraft(
  tokens: ReadonlyArray<LayoutToken>,
  sourceFallback: number,
  codePointFallback: number,
  breakReason: ZektonLineBreakReason,
  truncated = false,
  breakSourceRange?: ZektonTextRange,
  breakSourceCodePointRange?: ZektonCodePointRange,
  overflow = false,
): LineDraft | undefined {
  const width = sumTokenWidths(tokens);
  if (width === undefined) return undefined;
  return freezeRecord({
    tokens: freezeArray([...tokens]),
    width,
    sourceFallback,
    codePointFallback,
    breakReason,
    truncated,
    ...(breakSourceRange === undefined ? {} : { breakSourceRange }),
    ...(breakSourceCodePointRange === undefined ? {} : { breakSourceCodePointRange }),
    overflow,
  });
}

function trimDisplayTokens(
  tokens: ReadonlyArray<LayoutToken>,
  policy: ZektonWhitespacePolicy,
  breakReason: ZektonLineBreakReason,
): ReadonlyArray<LayoutToken> {
  if (policy.mode !== 'trim-at-wrap' || breakReason !== 'word-wrap') return tokens;
  let end = tokens.length;
  while (end > 0 && tokens[end - 1].breakableWhitespace) end -= 1;
  return tokens.slice(0, end);
}

function layoutNoWrapParagraph(
  tokens: ReadonlyArray<LayoutToken>,
  sourceFallback: number,
  codePointFallback: number,
  profile: ZektonTextLayoutProfile,
  ellipsisTokens: ReadonlyArray<LayoutToken>,
  ellipsisWidth: number,
): LineDraft | undefined {
  const width = sumTokenWidths(tokens);
  if (width === undefined) return undefined;
  if (width <= profile.maxWidth) {
    return makeDraft(tokens, sourceFallback, codePointFallback, tokens.length === 0 ? 'empty' : 'end-of-text');
  }
  if (profile.truncationMode !== 'ellipsis') {
    return makeDraft(tokens, sourceFallback, codePointFallback, 'overflow', false, undefined, undefined, true);
  }

  let prefixWidth = 0;
  let prefixEnd = 0;
  for (let index = 0; index < tokens.length; index += 1) {
    const nextWidth = prefixWidth + tokens[index].width + ellipsisWidth;
    if (!Number.isFinite(nextWidth) || nextWidth > profile.maxWidth) break;
    prefixWidth += tokens[index].width;
    prefixEnd = index + 1;
  }
  const prefixTokens = tokens.slice(0, prefixEnd);
  const visiblePrefix = trimDisplayTokens(prefixTokens, profile.whitespacePolicy, 'word-wrap');
  const displayTokens = [...visiblePrefix, ...ellipsisTokens];
  const ellipsisOverflow = ellipsisWidth > profile.maxWidth;
  return makeDraft(
    displayTokens,
    sourceFallback,
    prefixTokens.length === 0 ? codePointFallback : prefixTokens[0].sourceCodePointStart,
    'truncated',
    true,
    undefined,
    undefined,
    ellipsisOverflow,
  );
}

function layoutGreedyParagraph(
  tokens: ReadonlyArray<LayoutToken>,
  sourceFallback: number,
  codePointFallback: number,
  profile: ZektonTextLayoutProfile,
): LineDraftSet | undefined {
  if (tokens.length === 0) {
    const empty = makeDraft(tokens, sourceFallback, codePointFallback, 'empty');
    return empty === undefined ? undefined : { drafts: freezeArray([empty]) };
  }
  const drafts: LineDraft[] = [];
  let start = 0;
  while (start < tokens.length) {
    let cursor = start;
    let width = 0;
    let lastBreak = -1;
    let pushed = false;
    let overflowToken = false;
    while (cursor < tokens.length) {
      const token = tokens[cursor];
      const nextWidth = width + token.width;
      if (!Number.isFinite(nextWidth) || nextWidth > Number.MAX_SAFE_INTEGER) return undefined;
      if (nextWidth <= profile.maxWidth || cursor === start) {
        width = nextWidth;
        cursor += 1;
        if (token.breakableWhitespace) {
          lastBreak = cursor;
        }
        if (cursor === start + 1 && token.width > profile.maxWidth) {
          overflowToken = true;
          break;
        }
        continue;
      }
      if (lastBreak > start) {
        const draft = makeDraft(
          tokens.slice(start, lastBreak),
          sourceFallback,
          codePointFallback,
          'word-wrap',
        );
        if (draft === undefined) return undefined;
        drafts.push(draft);
        start = lastBreak;
        pushed = true;
        break;
      }
      if (cursor > start) {
        const draft = makeDraft(tokens.slice(start, cursor), sourceFallback, codePointFallback, 'codepoint-wrap');
        if (draft === undefined) return undefined;
        drafts.push(draft);
        start = cursor;
        pushed = true;
        break;
      }
    }
    if (!pushed) {
      if (cursor === tokens.length) {
        const draft = makeDraft(
          tokens.slice(start, cursor),
          sourceFallback,
          codePointFallback,
          overflowToken ? 'overflow-token' : 'end-of-text',
          false,
          undefined,
          undefined,
          overflowToken,
        );
        if (draft === undefined) return undefined;
        drafts.push(draft);
        start = cursor;
      } else {
        const draft = makeDraft(
          tokens.slice(start, cursor),
          sourceFallback,
          codePointFallback,
          overflowToken ? 'overflow-token' : 'codepoint-wrap',
          false,
          undefined,
          undefined,
          overflowToken,
        );
        if (draft === undefined) return undefined;
        drafts.push(draft);
        start = cursor;
      }
    }
  }
  return { drafts: freezeArray(drafts) };
}

function lineDraftsForParagraph(
  tokens: ReadonlyArray<LayoutToken>,
  sourceFallback: number,
  codePointFallback: number,
  profile: NormalizedProfile,
  ellipsisTokens: ReadonlyArray<LayoutToken>,
  ellipsisWidth: number,
): LineDraftSet | undefined {
  if (profile.normalizedWrapMode === 'no-wrap') {
    const draft = layoutNoWrapParagraph(
      tokens,
      sourceFallback,
      codePointFallback,
      profile,
      ellipsisTokens,
      ellipsisWidth,
    );
    return draft === undefined ? undefined : { drafts: freezeArray([draft]) };
  }
  return layoutGreedyParagraph(tokens, sourceFallback, codePointFallback, profile);
}

function gapForToken(token: LayoutToken, lineIndex: number, displayed: boolean): ZektonTextLayoutGap | undefined {
  if (!token.gap) return undefined;
  return freezeRecord({
    kind: 'gap' as const,
    reason: token.gap.reason,
    sourceRange: copyRange(token.sourceStart, token.sourceEnd),
    sourceCodePointRange: copyCodePointRange(token.sourceCodePointStart, token.sourceCodePointEnd),
    ...(token.gap.codePoint === undefined ? {} : { codePoint: token.gap.codePoint }),
    lineIndex,
    displayed,
    message: token.gap.message,
  });
}

function overflowGap(
  sourceStart: number,
  sourceEnd: number,
  codePointStart: number,
  codePointEnd: number,
  lineIndex: number,
): ZektonTextLayoutGap {
  return freezeRecord({
    kind: 'gap' as const,
    reason: 'overflow' as const,
    sourceRange: copyRange(sourceStart, sourceEnd),
    sourceCodePointRange: copyCodePointRange(codePointStart, codePointEnd),
    lineIndex,
    displayed: true,
    message: 'Line or glyph width exceeds the explicit finite profile width.',
  });
}

function scaledMetrics(raw: ZektonLineMetrics, scale: number): ZektonScaledLineMetrics {
  return freezeRecord({
    outer: raw.outer * scale,
    top: raw.top * scale,
    bottom: raw.bottom * scale,
    inner: raw.inner * scale,
    split20: raw.split20 * scale,
    split24: raw.split24 * scale,
  });
}

function makeLineBox(
  raw: ZektonLineMetrics,
  scale: number,
  lineIndex: number,
  width: number,
  lineSpacing: number,
): ZektonTextLineBox | undefined {
  const metrics = scaledMetrics(raw, scale);
  const lineAdvance = metrics.outer + lineSpacing;
  const y = lineIndex * lineAdvance;
  if (!Number.isFinite(lineAdvance) || !Number.isFinite(y) || lineAdvance < 0 || y < 0) return undefined;
  return freezeRecord({
    x: 0,
    y,
    width,
    height: metrics.outer,
    lineAdvance,
    metrics,
  });
}

function makeGlyphQuad(
  token: PenToken,
  lineBox: ZektonTextLineBox,
  scale: number,
  descriptorIdentity: ZektonAssetIdentity,
  atlasIdentity: ZektonAssetIdentity,
): ZektonGlyphQuad | undefined {
  if (!token.glyph || token.glyphIndex === undefined || token.codePoint === undefined) return undefined;
  const glyph = token.glyph;
  const bitmapWidth = glyph.bitmapWidth * scale;
  const bitmapHeight = (glyph.pixelBounds.bottom - glyph.pixelBounds.top) * scale;
  if (
    !Number.isFinite(bitmapWidth) ||
    !Number.isFinite(bitmapHeight) ||
    !Number.isFinite(token.__penBefore) ||
    bitmapWidth < 0 ||
    bitmapHeight < 0
  ) {
    return undefined;
  }
  const penBefore = token.__penBefore;
  const quadX = penBefore + glyph.horizontalBearing * scale;
  const uv = freezeRecord({
    u0: glyph.uv.u0,
    v0: glyph.uv.v0,
    u1: glyph.uv.u1,
    v1: glyph.uv.v1,
  });
  const bitmapBounds = freezeRecord({
    left: glyph.pixelBounds.left,
    top: glyph.pixelBounds.top,
    right: glyph.pixelBounds.right,
    bottom: glyph.pixelBounds.bottom,
  });
  return freezeRecord({
    kind: 'glyph-quad' as const,
    sourceRange: copyRange(token.sourceStart, token.sourceEnd),
    sourceCodePointRange: copyCodePointRange(token.sourceCodePointStart, token.sourceCodePointEnd),
    codePoint: token.codePoint,
    glyphIndex: token.glyphIndex,
    x: quadX,
    y: lineBox.y + lineBox.metrics.top,
    width: bitmapWidth,
    height: lineBox.metrics.inner,
    bitmapHeight,
    lineBoxY: lineBox.y,
    lineBoxHeight: lineBox.height,
    bearingX: glyph.horizontalBearing,
    bitmapWidth: glyph.bitmapWidth,
    advance: glyph.advance,
    scaledAdvance: token.width,
    bitmapBounds,
    uv,
    descriptorIdentity,
    atlasIdentity,
    evidenceState: ZEKTON_EVIDENCE_STATE,
    isEllipsis: token.ellipsis,
  });
}

interface PenToken extends LayoutToken {
  readonly __penBefore: number;
}

function buildLine(
  sourceTokens: ReadonlyArray<LayoutToken>,
  draft: LineDraft,
  lineIndex: number,
  rawMetrics: ZektonLineMetrics,
  scale: number,
  profile: NormalizedProfile,
  descriptorIdentity: ZektonAssetIdentity,
  atlasIdentity: ZektonAssetIdentity,
): ZektonTextLayoutLine | ZektonTextLayoutResult {
  const displayTokens = trimDisplayTokens(sourceTokens, profile.whitespacePolicy, draft.breakReason);
  const width = sumTokenWidths(displayTokens);
  if (width === undefined) return refusal('layout-overflow', 'Line width exceeded finite numeric bounds.');
  const lineBox = makeLineBox(rawMetrics, scale, lineIndex, width, profile.lineSpacing);
  if (lineBox === undefined) return refusal('layout-overflow', 'Line box position exceeded finite numeric bounds.');

  const originalTokens = sourceTokens.filter(token => !token.ellipsis);
  const sourceStart = originalTokens[0]?.sourceStart ?? draft.sourceFallback;
  const sourceEnd = originalTokens.length > 0
    ? originalTokens[originalTokens.length - 1].sourceEnd
    : draft.sourceFallback;
  const sourceCodePointStart = originalTokens[0]?.sourceCodePointStart ?? draft.codePointFallback;
  const sourceCodePointEnd = originalTokens.length > 0
    ? originalTokens[originalTokens.length - 1].sourceCodePointEnd
    : draft.codePointFallback;
  const displayedText = displayTokens.map(token => token.text).join('');
  const gaps: ZektonTextLayoutGap[] = [];
  for (const token of displayTokens) {
    const gap = gapForToken(token, lineIndex, true);
    if (gap) gaps.push(gap);
  }
  if (draft.overflow) {
    const last = originalTokens[originalTokens.length - 1];
    gaps.push(overflowGap(
      last?.sourceEnd ?? sourceEnd,
      last?.sourceEnd ?? sourceEnd,
      last?.sourceCodePointEnd ?? sourceCodePointEnd,
      last?.sourceCodePointEnd ?? sourceCodePointEnd,
      lineIndex,
    ));
  }

  const quads: ZektonGlyphQuad[] = [];
  let pen = 0;
  for (const token of displayTokens) {
    const penToken = freezeRecord({ ...token, __penBefore: pen }) as PenToken;
    const quad = makeGlyphQuad(penToken, lineBox, scale, descriptorIdentity, atlasIdentity);
    if (token.glyph && quad === undefined) {
      gaps.push(overflowGap(token.sourceStart, token.sourceEnd, token.sourceCodePointStart, token.sourceCodePointEnd, lineIndex));
    } else if (quad) {
      quads.push(quad);
    }
    pen += token.width;
  }
  const lineOverflow = draft.overflow || gaps.some(gap => gap.reason === 'overflow');

  return freezeRecord({
    lineIndex,
    displayedText,
    sourceRange: copyRange(sourceStart, sourceEnd),
    sourceCodePointRange: copyCodePointRange(sourceCodePointStart, sourceCodePointEnd),
    width,
    maxWidth: profile.maxWidth,
    lineBox,
    breakReason: draft.breakReason,
    ...(draft.breakSourceRange === undefined ? {} : { breakSourceRange: draft.breakSourceRange }),
    ...(draft.breakSourceCodePointRange === undefined ? {} : { breakSourceCodePointRange: draft.breakSourceCodePointRange }),
    truncated: draft.truncated,
    overflow: lineOverflow,
    glyphQuads: freezeArray(quads),
    gaps: freezeArray(gaps),
  });
}

function collectSkippedGaps(
  tokens: ReadonlyArray<LayoutToken>,
  displayedTokenSet: ReadonlySet<LayoutToken>,
  lineIndex: number,
): ZektonTextLayoutGap[] {
  const gaps: ZektonTextLayoutGap[] = [];
  for (const token of tokens) {
    if (displayedTokenSet.has(token)) continue;
    const gap = gapForToken(token, lineIndex, false);
    if (gap) gaps.push(gap);
  }
  return gaps;
}

function makeDesignLineCandidate(
  raw: ZektonLineMetrics,
  nominalDesignSize: number,
  requestedFontSize: number,
  lineSpacing: number,
  scale: number,
): ZektonDesignLineCandidate {
  const scaled = scaledMetrics(raw, scale);
  return freezeRecord({
    nominalDesignSize,
    requestedFontSize,
    scale,
    raw,
    scaled,
    lineSpacing,
    lineAdvance: scaled.outer + lineSpacing,
  });
}

function tokenizeAndLayout(
  font: ValidatedFont,
  text: string,
  profile: NormalizedProfile,
): ZektonTextLayoutResult {
  if (text.length > MAX_SAFE_RUN_CODE_UNITS) {
    return refusal('invalid-input', 'Text exceeds the finite source-length safety cap.');
  }
  const scale = profile.requestedFontSize / profile.nominalDesignSize;
  const originalTokenized = tokenizeText(text, font.descriptor, scale, profile, false, 0, 0);
  if (!('tokens' in originalTokenized)) return originalTokenized;
  const ellipsisTokenized = tokenizeText(
    profile.ellipsisPolicy.token,
    font.descriptor,
    scale,
    profile,
    true,
    text.length,
    originalTokenized.codePointCount,
  );
  if (!('tokens' in ellipsisTokenized)) return ellipsisTokenized;
  const ellipsisTokens = freezeArray(
    ellipsisTokenized.tokens.map(token => freezeRecord({
      ...token,
      sourceStart: text.length,
      sourceEnd: text.length,
      sourceCodePointStart: originalTokenized.codePointCount,
      sourceCodePointEnd: originalTokenized.codePointCount,
    })),
  );
  const ellipsisWidth = sumTokenWidths(ellipsisTokens);
  if (ellipsisWidth === undefined) return refusal('layout-overflow', 'Ellipsis width exceeded finite numeric bounds.');

  const drafts: LineDraft[] = [];
  const allOriginalTokens = originalTokenized.tokens;
  let paragraph: LayoutToken[] = [];
  let paragraphStart = 0;
  let paragraphCodePointStart = 0;
  const flushParagraph = (breakToken?: LayoutToken): ZektonTextLayoutResult | undefined => {
    const paragraphResult = lineDraftsForParagraph(
      freezeArray(paragraph),
      paragraphStart,
      paragraphCodePointStart,
      profile,
      ellipsisTokens,
      ellipsisWidth,
    );
    if (paragraphResult === undefined) return refusal('layout-overflow', 'Text paragraph exceeded finite layout bounds.');
    const paragraphDrafts = [...paragraphResult.drafts];
    if (breakToken !== undefined && paragraphDrafts.length > 0) {
      const last = paragraphDrafts[paragraphDrafts.length - 1];
      paragraphDrafts[paragraphDrafts.length - 1] = freezeRecord({
        ...last,
        breakReason: 'hard-newline' as const,
        breakSourceRange: copyRange(breakToken.sourceStart, breakToken.sourceEnd),
        breakSourceCodePointRange: copyCodePointRange(breakToken.sourceCodePointStart, breakToken.sourceCodePointEnd),
      });
    }
    drafts.push(...paragraphDrafts);
    paragraph = [];
    if (breakToken !== undefined) {
      paragraphStart = breakToken.sourceEnd;
      paragraphCodePointStart = breakToken.sourceCodePointEnd;
    }
    return undefined;
  };

  for (const token of allOriginalTokens) {
    if (token.newline) {
      const failure = flushParagraph(token);
      if (failure) return failure;
    } else {
      paragraph.push(token);
    }
  }
  const finalFailure = flushParagraph();
  if (finalFailure) return finalFailure;

  if (drafts.length === 0) {
    return refusal('layout-overflow', 'Text layout did not produce a deterministic line.');
  }

  const lines: ZektonTextLayoutLine[] = [];
  const allGaps: ZektonTextLayoutGap[] = [];
  const displayedTokens = new Set<LayoutToken>();
  for (let draftIndex = 0; draftIndex < drafts.length; draftIndex += 1) {
    const draft = drafts[draftIndex];
    for (const token of draft.tokens) {
      if (!token.ellipsis) displayedTokens.add(token);
    }
    const line = buildLine(
      draft.tokens,
      draft,
      draftIndex,
      font.descriptor.lineMetrics,
      scale,
      profile,
      font.descriptorIdentity,
      font.atlasIdentity,
    );
    if ('ok' in line && line.ok === false) return line;
    if (!('lineIndex' in line)) return refusal('layout-overflow', 'Text line projection returned an invalid line.');
    lines.push(line);
    allGaps.push(...line.gaps);
  }
  allGaps.push(...collectSkippedGaps(allOriginalTokens, displayedTokens, lines.length === 0 ? 0 : lines.length - 1));

  const lineMetrics = font.descriptor.lineMetrics;
  const designLineCandidate = makeDesignLineCandidate(
    lineMetrics,
    profile.nominalDesignSize,
    profile.requestedFontSize,
    profile.lineSpacing,
    scale,
  );
  const profileOutput = freezeRecord({
    descriptorIdentity: profile.descriptorIdentity,
    atlasIdentity: profile.atlasIdentity,
    nominalDesignSize: profile.nominalDesignSize,
    requestedFontSize: profile.requestedFontSize,
    maxWidth: profile.maxWidth,
    lineSpacing: profile.lineSpacing,
    wrapMode: profile.wrapMode,
    truncationMode: profile.truncationMode,
    whitespacePolicy: profile.whitespacePolicy,
    ellipsisPolicy: profile.ellipsisPolicy,
    newlinePolicy: profile.newlinePolicy,
    fallbackPolicy: 'gap' as const,
    truthGrade: profile.truthGrade,
    evidenceState: ZEKTON_EVIDENCE_STATE,
  });
  const value = freezeRecord({
    format: 'x4-zekton-text-layout' as const,
    version: ZEKTON_TEXT_LAYOUT_VERSION,
    originalText: text,
    displayedText: lines.map(line => line.displayedText).join('\n'),
    sourceLength: text.length,
    sourceCodePointCount: originalTokenized.codePointCount,
    scale,
    maxWidth: profile.maxWidth,
    lineMetrics,
    designLineCandidate,
    profile: profileOutput,
    lines: freezeArray(lines),
    gaps: freezeArray(allGaps),
    truncated: lines.some(line => line.truncated),
    overflow: lines.some(line => line.overflow),
    descriptorIdentity: font.descriptorIdentity,
    atlasIdentity: font.atlasIdentity,
    evidenceState: ZEKTON_EVIDENCE_STATE,
    truthGrade: profile.truthGrade,
    evidence: freezeRecord({
      metrics: ZEKTON_TEXT_METRICS_EVIDENCE,
      wrapAndTruncationPolicy: ZEKTON_EVIDENCE_STATE,
      gameParity: 'not-verified' as const,
    }),
  });
  return freezeRecord({ ok: true as const, value });
}

/** Project decoded Zekton assets into deterministic source-indexed lines. */
export function layoutZektonText(
  fontAssets: ZektonFontAssets,
  text: string,
  profile: ZektonTextLayoutProfile,
): ZektonTextLayoutResult;
/** Argument-order convenience overload for callers that keep profile first. */
export function layoutZektonText(
  fontAssets: ZektonFontAssets,
  profile: ZektonTextLayoutProfile,
  text: string,
): ZektonTextLayoutResult;
export function layoutZektonText(
  fontAssets: ZektonFontAssets,
  second: string | ZektonTextLayoutProfile,
  third: string | ZektonTextLayoutProfile,
): ZektonTextLayoutResult {
  const text = typeof second === 'string' ? second : third;
  const profile = typeof second === 'string' ? third : second;
  if (typeof text !== 'string') return refusal('invalid-input', 'Text layout input must be a string.');
  const font = validateFontAssets(fontAssets);
  if ('ok' in font && font.ok === false) return font;
  if (!('descriptor' in font)) return refusal('invalid-font-assets', 'Text layout font validation failed.');
  const normalizedProfile = validateProfile(profile, font);
  if ('ok' in normalizedProfile && normalizedProfile.ok === false) return normalizedProfile;
  if (!('normalizedWrapMode' in normalizedProfile)) return refusal('invalid-profile', 'Text profile validation failed.');
  return tokenizeAndLayout(font, text, normalizedProfile);
}

export const projectZektonText = layoutZektonText;
export const projectZektonTextLayout = layoutZektonText;
