import {
  ZEKTON_CORPUS_ASSETS,
  ZEKTON_EVIDENCE_STATE,
  decodeZektonFontAssets,
} from './x4UiFontMetrics';
import type { ZektonAssetIdentity } from './x4UiFontMetrics';
import {
  ZEKTON_TEXT_METRICS_EVIDENCE,
  layoutZektonText,
} from './x4UiTextLayout';
import type {
  ZektonTextLayout,
  ZektonTextLayoutProfile,
} from './x4UiTextLayout';

interface SyntheticRecord {
  readonly u0: number;
  readonly v0: number;
  readonly u1: number;
  readonly v1: number;
  readonly bearing: number;
  readonly width: number;
  readonly advance: number;
}

const regularIdentity = ZEKTON_CORPUS_ASSETS.regular.descriptor;
const regularAtlasIdentity = ZEKTON_CORPUS_ASSETS.regular.atlas;
const boldIdentity = ZEKTON_CORPUS_ASSETS.bold.descriptor;
const boldAtlasIdentity = ZEKTON_CORPUS_ASSETS.bold.atlas;
const unpinnedIdentity = Object.freeze({
  relativePath: 'synthetic/zekton_32.abc',
  sha256: 'unpinned-layout-synthetic-identity',
});
const unpinnedAtlasIdentity = Object.freeze({
  relativePath: 'synthetic/zekton_32.dds',
  sha256: 'unpinned-layout-synthetic-atlas-identity',
});

const SUPPLEMENTARY = 0x1f600;
const regularRecords: readonly SyntheticRecord[] = [
  { u0: 0, v0: 0, u1: 2 / 16, v1: 4 / 16, bearing: -2, width: 2, advance: 5 },
  { u0: 2 / 16, v0: 0, u1: 6 / 16, v1: 4 / 16, bearing: 1, width: 4, advance: 7 },
  { u0: 6 / 16, v0: 0, u1: 14 / 16, v1: 4 / 16, bearing: 2, width: 8, advance: 9 },
  { u0: 14 / 16, v0: 0, u1: 15 / 16, v1: 4 / 16, bearing: -1, width: 1, advance: 3 },
  { u0: 0, v0: 4 / 16, u1: 4 / 16, v1: 8 / 16, bearing: 0, width: 4, advance: 8 },
];
const boldRecords: readonly SyntheticRecord[] = [
  regularRecords[0],
  regularRecords[1],
  { ...regularRecords[2], advance: 10 },
  regularRecords[3],
  regularRecords[4],
];

function assertCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, received ${String(actual)}`);
  }
}

function assertApprox(actual: number, expected: number, message: string): void {
  if (Math.abs(actual - expected) > 1e-12) {
    throw new Error(`${message}: expected ${String(expected)}, received ${String(actual)}`);
  }
}

function assertFrozenDeep(value: unknown, path = 'value'): void {
  if (value === null || typeof value !== 'object') return;
  assertCondition(Object.isFrozen(value), `${path} is not frozen`);
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertFrozenDeep(item, `${path}[${index}]`));
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    assertFrozenDeep(child, `${path}.${key}`);
  }
}

function makeAbc(
  records: readonly SyntheticRecord[],
  mappings: Readonly<Record<number, number>>,
  maxCodepoint = SUPPLEMENTARY,
): Uint8Array {
  const mapByteLength = (maxCodepoint + 1) * 2;
  const recordStart = (48 + mapByteLength + 3) & ~3;
  const bytes = new Uint8Array(recordStart + records.length * 24 + 4);
  const dataView = new DataView(bytes.buffer);
  dataView.setUint32(0, 9, true);
  dataView.setFloat32(4, 52, true);
  dataView.setFloat32(8, 0, true);
  dataView.setFloat32(12, 0, true);
  dataView.setFloat32(16, 52, true);
  dataView.setInt32(20, 41, true);
  dataView.setInt32(24, 11, true);
  dataView.setInt32(28, 9, true);
  dataView.setUint32(32, 0, true);
  dataView.setUint32(36, 16, true);
  dataView.setUint32(40, 16, true);
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
    dataView.setUint16(offset + 22, 0, true);
  });
  return bytes;
}

function makeDds(): Uint8Array {
  const bytes = new Uint8Array(128 + 16 * 16);
  bytes.set([0x44, 0x44, 0x53, 0x20]);
  const dataView = new DataView(bytes.buffer);
  dataView.setUint32(4, 124, true);
  dataView.setUint32(8, 0x1007, true);
  dataView.setUint32(12, 16, true);
  dataView.setUint32(16, 16, true);
  dataView.setUint32(76, 32, true);
  dataView.setUint32(80, 2, true);
  dataView.setUint32(88, 8, true);
  dataView.setUint32(104, 0xff, true);
  dataView.setUint32(108, 0x1000, true);
  for (let index = 128; index < bytes.length; index += 1) bytes[index] = index - 128;
  return bytes;
}

function makeProfile(
  descriptorIdentity: ZektonAssetIdentity,
  atlasIdentity: ZektonAssetIdentity,
  maxWidth: number,
  overrides: Partial<ZektonTextLayoutProfile> = {},
): ZektonTextLayoutProfile {
  return {
    descriptorIdentity,
    atlasIdentity,
    nominalDesignSize: 32,
    requestedFontSize: 9,
    maxWidth,
    lineSpacing: 1,
    wrapMode: 'no-wrap',
    truncationMode: 'none',
    whitespacePolicy: { mode: 'preserve', breakOn: 'ascii-space' },
    ellipsisPolicy: { token: '.', placement: 'end' },
    newlinePolicy: 'lf-crlf',
    fallbackPolicy: 'gap',
    truthGrade: 'source-backed-provisional',
    evidenceState: ZEKTON_EVIDENCE_STATE,
    ...overrides,
  };
}

function expectSuccess(result: unknown): ZektonTextLayout {
  assertCondition(result !== null && typeof result === 'object', 'layout result must be an object');
  const candidate = result as { readonly ok?: unknown; readonly value?: unknown };
  assertEqual(candidate.ok, true, 'expected layout success');
  assertCondition(candidate.value !== null && typeof candidate.value === 'object', 'layout success needs a value');
  return candidate.value as ZektonTextLayout;
}

function expectRefusal(result: unknown, code: string, message?: string): void {
  assertCondition(result !== null && typeof result === 'object', 'refusal result must be an object');
  const candidate = result as { readonly ok?: unknown; readonly error?: { readonly code?: unknown; readonly message?: unknown } };
  assertEqual(candidate.ok, false, 'expected layout refusal');
  assertEqual(candidate.error?.code, code, 'layout refusal code');
  if (message !== undefined) {
    assertEqual(candidate.error && 'message' in candidate.error ? candidate.error.message : undefined, message, 'layout refusal message');
  }
}

const regularDescriptorBytes = makeAbc(regularRecords, {
  32: 1,
  46: 4,
  65: 2,
  66: 3,
  [SUPPLEMENTARY]: 5,
});
const boldDescriptorBytes = makeAbc(boldRecords, {
  32: 1,
  46: 4,
  65: 2,
  66: 3,
  [SUPPLEMENTARY]: 5,
});
const atlasBytes = makeDds();
const decodedRegular = decodeZektonFontAssets(
  regularDescriptorBytes,
  regularIdentity,
  atlasBytes,
  regularAtlasIdentity,
);
const decodedBold = decodeZektonFontAssets(
  boldDescriptorBytes,
  boldIdentity,
  atlasBytes,
  boldAtlasIdentity,
);
const decodedUnpinned = decodeZektonFontAssets(
  regularDescriptorBytes,
  unpinnedIdentity,
  atlasBytes,
  unpinnedAtlasIdentity,
);
const decodedCrossPair = decodeZektonFontAssets(
  regularDescriptorBytes,
  regularIdentity,
  atlasBytes,
  boldAtlasIdentity,
);
const decodedInvalidNativePen = decodeZektonFontAssets(
  makeAbc(
    [{ ...regularRecords[1], bearing: -8 }],
    { 65: 1 },
  ),
  regularIdentity,
  atlasBytes,
  regularAtlasIdentity,
);
assertCondition(
  decodedRegular.ok && decodedBold.ok && decodedUnpinned.ok && decodedCrossPair.ok && decodedInvalidNativePen.ok,
  'layout font-pair fixtures must decode',
);
const regularFont = decodedRegular.value;
const boldFont = decodedBold.value;
const unpinnedFont = decodedUnpinned.value;
const crossPairFont = decodedCrossPair.value;
const invalidNativePenFont = decodedInvalidNativePen.value;
const scale = 9 / 32;

const tests: readonly [string, () => void][] = [
  [
    'exact source advances, bearing-aware quads, UVs, and Helper line candidate remain separate',
    () => {
      const beforeFont = JSON.stringify(regularFont);
      const profile = makeProfile(regularIdentity, regularAtlasIdentity, 50);
      const beforeProfile = JSON.stringify(profile);
      const layout = expectSuccess(layoutZektonText(regularFont, 'A', profile));
      assertApprox(layout.scale, scale, 'explicit 9/32 scale');
      assertApprox(layout.designLineCandidate.scaled.outer, 52 * scale, 'scaled design line candidate');
      assertEqual(layout.designLineCandidate.scaled.outer === 16, false, 'standardTextHeight is not baked into metrics');
      assertApprox(layout.lines[0].lineBox.height, 52 * scale, 'line box height');
      const quad = layout.lines[0].glyphQuads[0];
      assertCondition(quad !== undefined, 'A quad should be emitted');
      assertApprox(quad.scaledAdvance, 8 * scale, 'scaled A native pen advance');
      assertApprox(quad.x, 1 * scale, 'bearing-aware A x');
      assertApprox(quad.width, 4 * scale, 'bitmap width scaling');
      assertApprox(quad.height, 52 * scale, 'typed line-box height scaling');
      assertApprox(quad.bitmapHeight, 4 * scale, 'exact atlas bitmap height scaling');
      assertEqual(quad.uv.u0, 2 / 16, 'exact u0');
      assertEqual(quad.uv.u1, 6 / 16, 'exact u1');
      assertEqual(quad.descriptorIdentity.sha256, regularIdentity.sha256, 'descriptor provenance');
      assertEqual(quad.atlasIdentity.sha256, regularAtlasIdentity.sha256, 'atlas provenance');
      assertEqual(layout.evidence.metrics, ZEKTON_TEXT_METRICS_EVIDENCE, 'exact metric evidence');
      assertEqual(layout.evidence.wrapAndTruncationPolicy, ZEKTON_EVIDENCE_STATE, 'provisional policy evidence');
      assertEqual(layout.evidence.gameParity, 'not-verified', 'game parity remains open');
      assertEqual(JSON.stringify(regularFont), beforeFont, 'font input unchanged');
      assertEqual(JSON.stringify(profile), beforeProfile, 'profile input unchanged');
    },
  ],
  [
    'native pen advance fail-first: nonzero bearing changes line width and scaled advance',
    () => {
      const layout = expectSuccess(layoutZektonText(
        regularFont,
        'A',
        makeProfile(regularIdentity, regularAtlasIdentity, 50),
      ));
      const quad = layout.lines[0].glyphQuads[0];
      assertCondition(quad !== undefined, 'A quad should be emitted for native pen-advance fail-first test');
      assertApprox(layout.lines[0].width, 8 * scale, 'A line width includes horizontal bearing');
      assertApprox(quad.scaledAdvance, 8 * scale, 'A scaled advance includes horizontal bearing');
    },
  ],
  [
    'native pen advance fail-first: negative bearing changes following pen position',
    () => {
      const layout = expectSuccess(layoutZektonText(
        regularFont,
        ' A',
        makeProfile(regularIdentity, regularAtlasIdentity, 50),
      ));
      const quad = layout.lines[0].glyphQuads[1];
      assertCondition(quad !== undefined, 'A following-space quad should be emitted for native pen-advance fail-first test');
      assertApprox(quad.x, 4 * scale, 'A x uses the negative-bearing space pen advance exactly once');
    },
  ],
  [
    'native pen advance rejects nonpositive derived geometry as a displayed gap without partial width',
    () => {
      const layout = expectSuccess(layoutZektonText(
        invalidNativePenFont,
        'A',
        makeProfile(regularIdentity, regularAtlasIdentity, 50),
      ));
      assertEqual(layout.lines[0].displayedText, 'A', 'invalid native advance remains source-indexed display text');
      assertEqual(layout.lines[0].width, 0, 'invalid native advance contributes no partial line width');
      assertEqual(layout.lines[0].glyphQuads.length, 0, 'invalid native advance emits no partial glyph quad');
      assertEqual(layout.lines[0].gaps.length, 1, 'invalid native advance emits one typed displayed gap');
      assertEqual(layout.lines[0].gaps[0]?.reason, 'overflow', 'invalid native advance gap reason');
      assertEqual(layout.lines[0].gaps[0]?.displayed, true, 'invalid native advance gap is displayed');
      assertEqual(layout.overflow, true, 'invalid native advance marks layout overflow');
    },
  ],
  [
    'regular and bold retain exact advances at explicit scale',
    () => {
      const regular = expectSuccess(layoutZektonText(
        regularFont,
        'B',
        makeProfile(regularIdentity, regularAtlasIdentity, 50),
      ));
      const bold = expectSuccess(layoutZektonText(
        boldFont,
        'B',
        makeProfile(boldIdentity, boldAtlasIdentity, 50) as ZektonTextLayoutProfile,
      ));
      assertApprox(regular.lines[0].glyphQuads[0].scaledAdvance, 11 * scale, 'regular B native pen advance');
      assertApprox(bold.lines[0].glyphQuads[0].scaledAdvance, 12 * scale, 'bold B native pen advance');
      assertEqual(bold.atlasIdentity.sha256, boldAtlasIdentity.sha256, 'bold atlas identity');
    },
  ],
  [
    'wrapped lines retain source line advances and line-local glyph offsets',
    () => {
      const layout = expectSuccess(layoutZektonText(
        regularFont,
        'A B A B A B A B',
        makeProfile(regularIdentity, regularAtlasIdentity, 13 * scale, { wrapMode: 'greedy-word', lineSpacing: 1 }),
      ));
      assertCondition(layout.lines.length > 1, 'wrapped fixture must produce multiple lines');
      const firstLine = layout.lines[0];
      assertCondition(firstLine !== undefined, 'wrapped fixture must have a first line');
      const firstQuad = firstLine.glyphQuads[0];
      assertCondition(firstQuad !== undefined, 'wrapped fixture first line must have a glyph');
      for (const [index, line] of layout.lines.entries()) {
        assertApprox(line.lineBox.y, index * line.lineBox.lineAdvance, `source line ${index} uses the exact line advance`);
        const quad = line.glyphQuads[0];
        assertCondition(quad !== undefined, `wrapped fixture line ${index} must have a glyph`);
        assertApprox(quad.lineBoxY, line.lineBox.y, `source line ${index} keeps its line-box offset`);
        assertApprox(quad.y - quad.lineBoxY, firstQuad.y - firstQuad.lineBoxY, `source line ${index} keeps a line-local glyph offset`);
      }
    },
  ],
  [
    'hard newline, CRLF, empty text, exact fit, and one-over greedy wrap are deterministic',
    () => {
      const exactWidth = 19 * scale;
      const exact = expectSuccess(layoutZektonText(
        regularFont,
        'A A',
        makeProfile(regularIdentity, regularAtlasIdentity, exactWidth, { wrapMode: 'greedy-word' }),
      ));
      assertEqual(exact.lines.length, 1, 'exact-fit text stays on one line');
      assertEqual(exact.lines[0].displayedText, 'A A', 'exact-fit displayed text');
      const over = expectSuccess(layoutZektonText(
        regularFont,
        'A A',
        makeProfile(regularIdentity, regularAtlasIdentity, exactWidth - 0.001, { wrapMode: 'greedy-word' }),
      ));
      assertEqual(over.lines.length, 2, 'one-over text wraps');
      assertEqual(over.lines[0].displayedText, 'A ', 'wrap preserves break whitespace');
      assertEqual(over.lines[0].breakReason, 'word-wrap', 'word wrap break reason');
      const crlf = expectSuccess(layoutZektonText(
        regularFont,
        'A\r\nB',
        makeProfile(regularIdentity, regularAtlasIdentity, 50),
      ));
      assertEqual(crlf.lines.length, 2, 'CRLF is one hard break');
      assertEqual(crlf.lines[0].breakReason, 'hard-newline', 'CRLF break reason');
      assertEqual(crlf.lines[0].breakSourceRange?.start, 1, 'CRLF source start');
      assertEqual(crlf.lines[0].breakSourceRange?.end, 3, 'CRLF source end');
      const empty = expectSuccess(layoutZektonText(
        regularFont,
        '',
        makeProfile(regularIdentity, regularAtlasIdentity, 0),
      ));
      assertEqual(empty.lines.length, 1, 'empty text has one empty line');
      assertEqual(empty.lines[0].breakReason, 'empty', 'empty break reason');
    },
  ],
  [
    'repeated whitespace, leading/trailing whitespace, and too-wide tokens stay explicit',
    () => {
      const repeated = expectSuccess(layoutZektonText(
        regularFont,
        'A  B',
        makeProfile(regularIdentity, regularAtlasIdentity, 17 * scale, { wrapMode: 'greedy-word' }),
      ));
      assertEqual(repeated.lines.length, 2, 'repeated whitespace wraps at the last space');
      assertEqual(repeated.lines[0].displayedText, 'A  ', 'repeated spaces preserved');
      const edges = expectSuccess(layoutZektonText(
        regularFont,
        ' A ',
        makeProfile(regularIdentity, regularAtlasIdentity, 50),
      ));
      assertEqual(edges.lines[0].displayedText, ' A ', 'leading/trailing spaces preserved');
      const tooWide = expectSuccess(layoutZektonText(
        regularFont,
        'BB',
        makeProfile(regularIdentity, regularAtlasIdentity, 8 * scale, { wrapMode: 'greedy-word' }),
      ));
      assertEqual(tooWide.lines.length, 2, 'too-wide token breaks by code point');
      assertEqual(tooWide.lines[0].breakReason, 'overflow-token', 'too-wide token reason');
      assertEqual(tooWide.gaps.filter(gap => gap.reason === 'overflow').length, 2, 'overflow gaps are explicit');
    },
  ],
  [
    'no-wrap truncation uses an explicit ellipsis token and preserves source ranges',
    () => {
      const layout = expectSuccess(layoutZektonText(
        regularFont,
        'AB',
        makeProfile(regularIdentity, regularAtlasIdentity, 10 * scale, { truncationMode: 'ellipsis' }),
      ));
      assertEqual(layout.truncated, true, 'layout truncation state');
      assertEqual(layout.lines[0].truncated, true, 'line truncation state');
      assertEqual(layout.lines[0].breakReason, 'truncated', 'truncation reason');
      assertEqual(layout.lines[0].displayedText, 'A.', 'explicit ellipsis display');
      assertEqual(layout.lines[0].sourceRange.start, 0, 'truncated source start');
      assertEqual(layout.lines[0].sourceRange.end, 1, 'truncated source ends at source prefix');
      assertEqual(layout.lines[0].glyphQuads[1].isEllipsis, true, 'ellipsis quad provenance');
      assertEqual(layout.lines[0].glyphQuads[1].sourceRange.start, 2, 'ellipsis has no source span');
      assertEqual(layout.lines[0].glyphQuads[1].sourceRange.end, 2, 'ellipsis source end is original end');
      const exactFitEllipsis = expectSuccess(layoutZektonText(
        regularFont,
        'AB',
        makeProfile(regularIdentity, regularAtlasIdentity, 2 * scale, { truncationMode: 'ellipsis' }),
      ));
      assertEqual(exactFitEllipsis.lines[0].displayedText, '.', 'exact-fit ellipsis remains explicit');
      assertEqual(exactFitEllipsis.lines[0].overflow, false, 'exact-fit ellipsis overflow state');
      assertEqual(exactFitEllipsis.overflow, false, 'layout overflow state');
      assertApprox(exactFitEllipsis.lines[0].width, 2 * scale, 'exact-fit ellipsis width evidence');
      assertEqual(exactFitEllipsis.gaps.some(gap => gap.reason === 'overflow'), false, 'exact-fit ellipsis has no overflow gap');
      const overwideEllipsis = expectSuccess(layoutZektonText(
        regularFont,
        'AB',
        makeProfile(regularIdentity, regularAtlasIdentity, 1 * scale, { truncationMode: 'ellipsis' }),
      ));
      assertEqual(overwideEllipsis.lines[0].displayedText, '.', 'overwide ellipsis remains explicit');
      assertEqual(overwideEllipsis.lines[0].overflow, true, 'overwide ellipsis overflow state');
      assertEqual(overwideEllipsis.overflow, true, 'layout overflow state for overwide ellipsis');
      assertApprox(overwideEllipsis.lines[0].width, 2 * scale, 'overwide ellipsis width evidence');
      assertEqual(overwideEllipsis.gaps.some(gap => gap.reason === 'overflow'), true, 'overwide ellipsis gap');
    },
  ],
  [
    'nominal design size is authorized only for exact canonical same-style pairs',
    () => {
      const authorityMessage = 'nominalDesignSize 32 is authorized only for an exact canonical regular or bold Zekton descriptor+atlas pair.';
      expectRefusal(
        layoutZektonText(
          unpinnedFont,
          'A',
          makeProfile(unpinnedIdentity, unpinnedAtlasIdentity, 50),
        ),
        'invalid-profile',
        authorityMessage,
      );
      expectRefusal(
        layoutZektonText(
          crossPairFont,
          'A',
          makeProfile(regularIdentity, boldAtlasIdentity, 50),
        ),
        'invalid-profile',
        authorityMessage,
      );
      const sizeMessage = 'nominalDesignSize must be exactly 32 for the supported pinned Zekton profiles.';
      for (const nominalDesignSize of [31, 64]) {
        expectRefusal(
          layoutZektonText(
            regularFont,
            'A',
            makeProfile(regularIdentity, regularAtlasIdentity, 50, { nominalDesignSize }),
          ),
          'invalid-profile',
          sizeMessage,
        );
      }
    },
  ],
  [
    'supplementary Unicode never splits surrogate pairs, and missing/control/icon inputs gap',
    () => {
      const supplementary = expectSuccess(layoutZektonText(
        regularFont,
        String.fromCodePoint(SUPPLEMENTARY),
        makeProfile(regularIdentity, regularAtlasIdentity, 50),
      ));
      assertEqual(supplementary.sourceLength, 2, 'supplementary UTF-16 length');
      assertEqual(supplementary.sourceCodePointCount, 1, 'supplementary code-point count');
      assertEqual(supplementary.lines[0].glyphQuads[0].sourceRange.start, 0, 'supplementary source start');
      assertEqual(supplementary.lines[0].glyphQuads[0].sourceRange.end, 2, 'supplementary source end');
      assertEqual(supplementary.lines[0].glyphQuads[0].sourceCodePointRange.end, 1, 'supplementary code-point end');
      assertApprox(supplementary.lines[0].glyphQuads[0].scaledAdvance, 8 * scale, 'zero-bearing M keeps its advance value');
      const gaps = expectSuccess(layoutZektonText(
        regularFont,
        'A?\u0001\u001b',
        makeProfile(regularIdentity, regularAtlasIdentity, 50),
      ));
      assertEqual(gaps.lines[0].glyphQuads.length, 1, 'only mapped glyph gets a quad');
      assertEqual(gaps.gaps.some(gap => gap.reason === 'missing-glyph'), true, 'missing glyph gap');
      assertEqual(gaps.gaps.some(gap => gap.reason === 'unsupported-control'), true, 'control gap');
      assertEqual(gaps.gaps.some(gap => gap.reason === 'unsupported-icon-escape'), true, 'icon escape gap');
      const loneCr = expectSuccess(layoutZektonText(
        regularFont,
        'A\rB',
        makeProfile(regularIdentity, regularAtlasIdentity, 50),
      ));
      assertEqual(loneCr.lines.length, 1, 'lone CR does not silently become a newline');
      assertEqual(loneCr.gaps[0].reason, 'invalid-newline', 'lone CR gap reason');
    },
  ],
  [
    'profile identity, newline, fallback, overflow, freeze, serialization, and replay guards hold',
    () => {
      const profile = makeProfile(regularIdentity, regularAtlasIdentity, 50);
      const alteredIdentity = { ...regularIdentity, sha256: 'wrong' };
      expectRefusal(
        layoutZektonText(
          regularFont,
          'A',
          { ...profile, descriptorIdentity: alteredIdentity } as ZektonTextLayoutProfile,
        ),
        'identity-mismatch',
      );
      expectRefusal(
        layoutZektonText(
          regularFont,
          'A',
          { ...profile, requestedFontSize: 9.5 } as ZektonTextLayoutProfile,
        ),
        'invalid-profile',
      );
      expectRefusal(
        layoutZektonText(
          regularFont,
          'A',
          { ...profile, maxWidth: Number.NaN } as ZektonTextLayoutProfile,
        ),
        'invalid-profile',
      );
      const first = expectSuccess(layoutZektonText(regularFont, 'A B', profile));
      const second = expectSuccess(layoutZektonText(regularFont, 'A B', profile));
      assertEqual(JSON.stringify(first), JSON.stringify(second), 'repeated layout JSON');
      assertCondition(JSON.stringify(first).length > 0, 'layout is JSON serializable');
      assertFrozenDeep(first);
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

console.log(`x4UiTextLayout selftest: ${passed}/${tests.length} passed`);
if (failures.length > 0) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  throw new Error(`${failures.length} selftest case(s) failed.`);
}
