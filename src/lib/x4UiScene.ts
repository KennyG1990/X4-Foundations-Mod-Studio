/**
 * Pure, deterministic projection of an accepted X4 UI layout program into a
 * serializable scene for a later painter.
 *
 * This module deliberately stops at source-backed scene facts. It does not
 * render, load a workspace, parse Lua, evaluate Lua, or claim game parity.
 */

import {
  X4_UI_LAYOUT_GAME_TRUTH,
  isIssuedX4UiLayoutEvidencePair,
  validateX4UiLayoutEvidencePair,
  type X4UiLayoutCellNode,
  type X4UiLayoutColorDomain,
  type X4UiLayoutColorFactProvenance,
  type X4UiLayoutColorValue,
  type X4UiLayoutDescriptorFact,
  type X4UiLayoutDescriptorFacts,
  type X4UiLayoutFrameNode,
  type X4UiLayoutFrameTextureLayer,
  type X4UiLayoutFrameTextureLayerName,
  type X4UiLayoutModelIdentity,
  type X4UiLayoutOperation,
  type X4UiLayoutProgram,
  type X4UiLayoutProgramResult,
  type X4UiLayoutEvidenceAuthority,
  type X4UiLayoutRowNode,
  type X4UiLayoutSourcePin,
  type X4UiLayoutTableNode,
} from './x4UiLayoutProgram';
import {
  X4_LAYOUT_PROVENANCE,
  convertColumnWidth,
  finalizeHelperTable,
  getCellHeight,
  getRowHeight,
  getFullTableHeight,
  getColSpanWidth,
  setCellColSpan,
  setDefaultCellProperties,
  setDefaultComplexCellProperties,
  setCellHotkey,
  specializeCell,
  scaleX,
  scaleY,
  type HelperTableState,
} from './x4UiLayoutKernel';
import {
  MAX_SAFE_LAYOUT_WIDTH,
  ZEKTON_TEXT_TRUTH_GRADE,
  layoutZektonText,
  type ZektonTextLayout,
  type ZektonTextLayoutProfile,
  type ZektonTextLayoutResult,
  type ZektonTextTruthGrade,
  type ZektonWrapMode,
  type ZektonTruncationMode,
  type ZektonNewlinePolicy,
  type ZektonWhitespacePolicy,
  type ZektonEllipsisPolicy,
} from './x4UiTextLayout';
import {
  ZEKTON_CORPUS_ASSETS,
  ZEKTON_EVIDENCE_STATE,
  MAX_SAFE_ATLAS_DIMENSION,
  MAX_SAFE_ATLAS_PIXELS,
  MAX_SAFE_DESCRIPTOR_BYTES,
  MAX_SAFE_DDS_BYTES,
  MAX_SAFE_GLYPH_ADVANCE,
  MAX_SAFE_GLYPH_RECORDS,
  MAX_SAFE_HORIZONTAL_BEARING,
  MAX_SAFE_LINE_METRIC,
  MAX_UNICODE_CODE_POINT,
  ZEKTON_ABC_FORMAT_VERSION,
  ZEKTON_DDS_HEADER_SIZE,
  ZEKTON_DESCRIPTOR_HEADER_SIZE,
  ZEKTON_DESCRIPTOR_TRAILING_SIZE,
  ZEKTON_RECORD_SIZE,
  type ZektonAssetIdentity,
  type ZektonA8DdsAtlas,
  type ZektonAbcDescriptor,
  type ZektonFontAssets,
  type ZektonGlyphMetrics,
} from './x4UiFontMetrics';
import {
  X4_UI_CORPUS_CANONICAL_EVIDENCE,
  X4_UI_CORPUS_VERIFICATION,
  X4_UI_CORPUS_COLORS_XML_PATH,
  X4_UI_CORPUS_COLORS_XML_SHA256,
  X4_UI_CORPUS_COLORS_XML_SIZE,
  X4_UI_CORPUS_COLORS_XSD_PATH,
  X4_UI_CORPUS_COLORS_XSD_SHA256,
  X4_UI_CORPUS_COLORS_XSD_SIZE,
  isX4UiCorpusCanonicalSuccess,
  type X4UiCorpusAssetKind,
  type X4UiCorpusCanonicalSuccess,
} from './x4UiCorpusAssets';

export const X4_UI_SCENE_FORMAT = 'x4-ui-scene' as const;
export const X4_UI_SCENE_VERSION = 1 as const;
export const X4_UI_SCENE_GAME_TRUTH = X4_UI_LAYOUT_GAME_TRUTH;

const WIDGET_SOURCE_PATH = X4_LAYOUT_PROVENANCE.widgetSourcePath;
const BUTTON_BORDER_SIZE = 2;
const EDITBOX_CONFIG_BORDER = 1;
const EDITBOX_TEXT_BORDER = 2;
const EDITBOX_SOURCE_PINS = Object.freeze({
  configBorder: Object.freeze({ sourcePath: WIDGET_SOURCE_PATH, lineStart: 617, lineEnd: 634 }),
  textBorder: Object.freeze({ sourcePath: WIDGET_SOURCE_PATH, lineStart: 848, lineEnd: 860 }),
  blackInset: Object.freeze({ sourcePath: WIDGET_SOURCE_PATH, lineStart: 8702, lineEnd: 8727 }),
  initialInputActive: Object.freeze({ sourcePath: WIDGET_SOURCE_PATH, lineStart: 6325, lineEnd: 6332 }),
});

const FRAME_TEXTURE_SOURCE_PINS = Object.freeze({
  blurBackground: Object.freeze({ sourcePath: X4_LAYOUT_PROVENANCE.helperSourcePath, lineStart: 3133, lineEnd: 3133 }),
  widthFallback: Object.freeze({ sourcePath: WIDGET_SOURCE_PATH, lineStart: 16977, lineEnd: 16977 }),
  heightFallback: Object.freeze({ sourcePath: WIDGET_SOURCE_PATH, lineStart: 16978, lineEnd: 16978 }),
});

export type X4UiSceneStatus = 'projected' | 'partial' | 'refused';
export type X4UiSceneCompleteness = 'complete' | 'partial' | 'unavailable';
export type X4UiSceneNodeKind = 'frame' | 'table' | 'row' | 'cell' | 'text' | 'button' | 'editbox' | 'icon' | 'glyph';
export type X4UiSceneTextSlot = 'primary' | 'secondary';
export type X4UiSceneColorSlot =
  | 'table-background'
  | 'cell-background'
  | 'widget-background'
  | 'editbox-inner-background'
  | 'widget-highlight'
  | 'widget-border'
  | 'widget-icon'
  | 'primary-text'
  | 'secondary-text';

export interface X4UiSceneColorFact {
  readonly field: string;
  readonly slot: X4UiSceneColorSlot;
  readonly value: X4UiLayoutColorValue;
  readonly domain: X4UiLayoutColorDomain;
  readonly provenance: X4UiLayoutColorFactProvenance;
  readonly expression: string;
  readonly source: X4UiSceneSourceLocation;
  readonly sourcePin?: X4UiLayoutSourcePin;
  readonly sampleId?: string;
  readonly gameVerification: typeof X4_UI_SCENE_GAME_TRUTH;
}

/** The source location shape is intentionally inherited from the accepted program owner. */
export type X4UiSceneSourceLocation = X4UiLayoutFrameNode['source'];

export interface X4UiSceneRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface X4UiSceneTableViewState {
  /** One-based first non-fixed row supplied by the caller for preview only. */
  readonly topRow?: number;
  /** Explicit logical scroll distance. It is not a game-observed scroll value. */
  readonly scrollOffset?: number;
  readonly selectedRow?: number;
}

export interface X4UiSceneFontIdentityPins {
  readonly descriptor: ZektonAssetIdentity;
  readonly atlas: ZektonAssetIdentity;
}

export interface X4UiSceneFontAssetMap {
  readonly Zekton: ZektonFontAssets;
  readonly 'Zekton Bold': ZektonFontAssets;
}

export interface X4UiSceneTextPolicy {
  readonly nominalDesignSize: 32;
  readonly lineSpacing: number;
  readonly wrapMode: ZektonWrapMode;
  readonly truncationMode: ZektonTruncationMode;
  readonly whitespacePolicy: ZektonWhitespacePolicy;
  readonly ellipsisPolicy: ZektonEllipsisPolicy;
  readonly newlinePolicy: ZektonNewlinePolicy;
  readonly truthGrade: ZektonTextTruthGrade;
  readonly evidenceState: typeof ZEKTON_EVIDENCE_STATE;
}

export interface X4UiSceneProfile {
  readonly id: string;
  readonly provenance: string;
  readonly source: X4UiLayoutModelIdentity;
  readonly helper: {
    readonly sourcePath: string;
    readonly sha256: string;
  };
  readonly widget: {
    readonly sourcePath: string;
    readonly sha256: string;
  };
  readonly fonts: {
    readonly Zekton: X4UiSceneFontIdentityPins;
    readonly 'Zekton Bold': X4UiSceneFontIdentityPins;
  };
  readonly drawable: {
    readonly width: number;
    readonly height: number;
  };
  readonly textPolicy: X4UiSceneTextPolicy;
  readonly tableView?: Readonly<Record<string, X4UiSceneTableViewState>>;
}

export interface X4UiSceneProvenanceLink {
  readonly kind: 'descriptor-fact' | 'kernel-state' | 'source-pin' | 'font-metrics' | 'preview-only' | 'program-gap';
  readonly fact?: string;
  readonly operationId?: string;
  readonly source?: X4UiSceneSourceLocation;
  readonly sourcePin?: X4UiLayoutSourcePin;
  readonly expression?: string;
  readonly sampleId?: string;
}

export interface X4UiSceneDiagnosticStyle {
  readonly geometry: 'source-derived' | 'unavailable';
  readonly paint: 'unknown-runtime-color';
  readonly texture: 'unknown-runtime-texture';
  readonly interaction: 'unknown-runtime-state';
}

export interface X4UiSceneGap {
  readonly id: string;
  readonly category: string;
  readonly status: string;
  readonly reason: string;
  readonly source: X4UiSceneSourceLocation;
  readonly expression?: string;
  readonly sourcePin?: X4UiLayoutSourcePin;
  readonly operationId?: string;
  readonly nodeId?: string;
  readonly previewOnly?: boolean;
  readonly textRange?: {
    readonly start: number;
    readonly end: number;
  };
  readonly lineIndex?: number;
}

export interface X4UiSceneNodeBase {
  readonly id: string;
  readonly parentId?: string;
  readonly source: X4UiSceneSourceLocation;
  readonly sourceOrder: number;
  readonly zOrder?: number;
  readonly rect?: X4UiSceneRect;
  readonly clipRect?: X4UiSceneRect;
  readonly completeness: X4UiSceneCompleteness;
  readonly provenance: 'source-derived' | 'font-metrics' | 'preview-only' | 'unavailable';
  readonly provenanceLinks: readonly X4UiSceneProvenanceLink[];
  readonly colorFacts?: readonly X4UiSceneColorFact[];
  readonly diagnosticLinks: readonly string[];
  readonly diagnosticStyle: X4UiSceneDiagnosticStyle;
}

export interface X4UiSceneFrameNode extends X4UiSceneNodeBase {
  readonly kind: 'frame';
  readonly tableIds: readonly string[];
  readonly layer?: number;
  readonly frameTextureLayers?: readonly X4UiSceneFrameTextureLayer[];
  readonly backdrop?: X4UiSceneFrameBackdrop;
}

export type X4UiSceneFrameTextureApplicability = 'inactive' | 'active-unresolved' | 'active-source-known';

export interface X4UiSceneFrameTextureLayer {
  readonly name: X4UiLayoutFrameTextureLayerName;
  readonly source: X4UiSceneSourceLocation;
  readonly sourceOrder: number;
  readonly operationIds: readonly string[];
  readonly descriptorFacts: X4UiLayoutDescriptorFacts;
  readonly applicability: X4UiSceneFrameTextureApplicability;
  readonly icon?: string;
  readonly effectiveWidth?: number;
  readonly effectiveHeight?: number;
  readonly provenanceLinks: readonly X4UiSceneProvenanceLink[];
  readonly diagnosticLinks: readonly string[];
  readonly gameVerification: typeof X4_UI_SCENE_GAME_TRUTH;
  readonly reason?: string;
}

export interface X4UiSceneFrameBackdrop {
  readonly blurBackground?: boolean;
  readonly blurBackgroundFact: X4UiLayoutDescriptorFact;
  readonly availability: 'unavailable' | 'disabled';
  readonly reason: string;
  readonly source: X4UiSceneSourceLocation;
  readonly provenanceLinks: readonly X4UiSceneProvenanceLink[];
  readonly diagnosticLinks: readonly string[];
  readonly gameVerification: typeof X4_UI_SCENE_GAME_TRUTH;
}

export interface X4UiSceneColumn {
  readonly index: number;
  readonly x: number;
  readonly width: number;
  readonly fixedWidth: number;
  readonly sourceOrder: number;
  readonly provenanceLinks: readonly X4UiSceneProvenanceLink[];
}

export interface X4UiSceneScrollbar {
  readonly rect: X4UiSceneRect;
  readonly clipRect: X4UiSceneRect;
  readonly provenanceLinks: readonly X4UiSceneProvenanceLink[];
  readonly diagnosticStyle: X4UiSceneDiagnosticStyle;
}

export interface X4UiSceneTableNode extends X4UiSceneNodeBase {
  readonly kind: 'table';
  readonly frameId?: string;
  readonly rowIds: readonly string[];
  /** Known Helper/Layout backgroundID applicability; an empty value is an issued no-background fact. */
  readonly backgroundId?: string;
  readonly columns?: readonly X4UiSceneColumn[];
  readonly fixedColumns?: readonly X4UiSceneColumn[];
  readonly fullHeight?: number;
  readonly visibleHeight?: number;
  readonly maxVisibleHeight?: number;
  /** Helper/widget projection only; runtime scrollbar acceptance is unknown. */
  readonly descriptorHasScrollBar?: boolean;
  readonly scrollbarEvidence?: {
    readonly descriptor: 'helper-derived';
    readonly runtime: 'unavailable';
  };
  readonly reserveScrollBar?: boolean;
  readonly viewportRect?: X4UiSceneRect;
  readonly scrollbar?: X4UiSceneScrollbar;
  readonly viewState?: X4UiSceneTableViewState;
}

export interface X4UiSceneRowNode extends X4UiSceneNodeBase {
  readonly kind: 'row';
  readonly tableId: string;
  readonly rowIndex?: number;
  readonly cellIds: readonly string[];
  readonly fixed?: boolean;
  readonly visible?: boolean;
  readonly paddingTop?: number;
  readonly paddingBottom?: number;
  readonly borderBelow?: boolean;
  readonly naturalRect?: X4UiSceneRect;
}

export interface X4UiSceneCellNode extends X4UiSceneNodeBase {
  readonly kind: 'cell';
  readonly tableId: string;
  readonly rowId: string;
  readonly rowIndex?: number;
  readonly column: number;
  readonly span?: number;
  readonly hidden?: boolean;
  readonly widgetIds: readonly string[];
  readonly naturalRect?: X4UiSceneRect;
}

export interface X4UiSceneWidgetNode extends X4UiSceneNodeBase {
  readonly kind: 'text' | 'button' | 'editbox' | 'icon';
  readonly cellId: string;
  readonly textIds: readonly string[];
  readonly primaryContent?: string;
  readonly iconIdentity?: string;
  /** Descriptor configuration only; runtime widget activity remains unknown. */
  readonly configuredActive?: boolean;
  readonly outerRect?: X4UiSceneRect;
  /** Source-pinned base config value; it is not the fixed text border. */
  readonly editboxConfigBorder?: 1;
  /** Source-pinned scaled inset used only for the black inner preview layer. */
  readonly editboxBlackInset?: number;
  /** Source-pinned fixed text anchor/truncation border. */
  readonly editboxTextBorder?: 2;
  /** Initial source-composition state only; never a live input/focus observation. */
  readonly editboxPreviewInputState?: 'source-initial-inactive' | 'runtime-unknown';
}

export interface X4UiSceneTextLine {
  readonly lineIndex: number;
  readonly displayedText: string;
  readonly rect: X4UiSceneRect;
  readonly completeness: X4UiSceneCompleteness;
  readonly diagnosticLinks: readonly string[];
  readonly width: number;
  readonly sourceRange: {
    readonly start: number;
    readonly end: number;
  };
  readonly sourceCodePointRange: {
    readonly start: number;
    readonly end: number;
  };
  readonly breakReason: string;
  readonly truncated: boolean;
  readonly overflow: boolean;
  readonly glyphIds: readonly string[];
}

export interface X4UiSceneTextNode extends X4UiSceneNodeBase {
  readonly kind: 'text';
  readonly widgetId: string;
  readonly slot: X4UiSceneTextSlot;
  readonly content?: string;
  readonly defaultContent?: string;
  readonly description?: string;
  readonly contentSelection: 'current' | 'preview-default' | 'runtime-choice-unavailable' | 'unavailable';
  /** Initial source-composition state only; runtime input mode remains unavailable. */
  readonly editboxPreviewInputState?: 'source-initial-inactive' | 'runtime-unknown';
  /** Fixed source text border; independent of the scaled black inset. */
  readonly editboxTextBorder?: 2;
  readonly font?: 'Zekton' | 'Zekton Bold';
  readonly fontSize?: number;
  readonly alignment?: 'left' | 'center' | 'right';
  readonly offsetX?: number;
  readonly offsetY?: number;
  readonly availableWidth?: number;
  readonly lines: readonly X4UiSceneTextLine[];
  readonly layout?: ZektonTextLayout;
  readonly textGaps: readonly string[];
  readonly evidence: {
    readonly metrics: 'exact-source-backed' | 'unavailable';
    readonly wrapAndTruncationPolicy: typeof ZEKTON_EVIDENCE_STATE;
    readonly gameParity: 'not-verified';
  };
}

export interface X4UiSceneGlyphNode extends X4UiSceneNodeBase {
  readonly kind: 'glyph';
  readonly textId: string;
  readonly lineIndex: number;
  readonly sourceRange: {
    readonly start: number;
    readonly end: number;
  };
  readonly sourceCodePointRange: {
    readonly start: number;
    readonly end: number;
  };
  readonly codePoint: number;
  readonly glyphIndex: number;
  readonly quad: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
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
    readonly isEllipsis: boolean;
  };
}

export interface X4UiScene {
  readonly format: typeof X4_UI_SCENE_FORMAT;
  readonly version: typeof X4_UI_SCENE_VERSION;
  readonly status: 'projected' | 'partial';
  readonly gameTruth: typeof X4_UI_SCENE_GAME_TRUTH;
  readonly profile: X4UiSceneProfile;
  readonly programStatus: 'projected' | 'partial';
  readonly drawableRect: X4UiSceneRect;
  readonly frames: readonly X4UiSceneFrameNode[];
  readonly tables: readonly X4UiSceneTableNode[];
  readonly rows: readonly X4UiSceneRowNode[];
  readonly cells: readonly X4UiSceneCellNode[];
  readonly widgets: readonly X4UiSceneWidgetNode[];
  readonly texts: readonly X4UiSceneTextNode[];
  readonly glyphs: readonly X4UiSceneGlyphNode[];
  readonly gaps: readonly X4UiSceneGap[];
  readonly preview: {
    readonly provenance: 'preview-only';
    readonly sampleBindings: readonly unknown[];
    readonly pathSelections: readonly unknown[];
  };
  readonly diagnosticStyle: X4UiSceneDiagnosticStyle;
  readonly verification: {
    readonly game: typeof X4_UI_SCENE_GAME_TRUTH;
    readonly gameVerified: false;
  };
}

export type X4UiSceneRefusalCode =
  | 'invalid-input'
  | 'invalid-program'
  | 'invalid-profile'
  | 'source-mismatch'
  | 'font-mismatch'
  | 'identity-mismatch'
  | 'malformed-structure'
  | 'unsafe-number';

export interface X4UiSceneRefusal {
  readonly status: 'refused';
  readonly refusal: {
    readonly code: X4UiSceneRefusalCode;
    readonly message: string;
    readonly source?: X4UiSceneSourceLocation;
  };
  readonly verification: {
    readonly game: typeof X4_UI_SCENE_GAME_TRUTH;
    readonly gameVerified: false;
  };
}

export type X4UiSceneResult =
  | { readonly status: 'projected' | 'partial'; readonly scene: X4UiScene; readonly verification: X4UiScene['verification'] }
  | X4UiSceneRefusal;

const STYLE: X4UiSceneDiagnosticStyle = Object.freeze({
  geometry: 'source-derived',
  paint: 'unknown-runtime-color',
  texture: 'unknown-runtime-texture',
  interaction: 'unknown-runtime-state',
});

const UNAVAILABLE_STYLE: X4UiSceneDiagnosticStyle = Object.freeze({
  geometry: 'unavailable',
  paint: 'unknown-runtime-color',
  texture: 'unknown-runtime-texture',
  interaction: 'unknown-runtime-state',
});

const diagnosticStyleForGeometry = (hasRect: boolean): X4UiSceneDiagnosticStyle =>
  hasRect ? STYLE : UNAVAILABLE_STYLE;

const REFUSAL_VERIFICATION = Object.freeze({
  game: X4_UI_SCENE_GAME_TRUTH,
  gameVerified: false as const,
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isFiniteSafe = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER;

const isFiniteDimension = (value: unknown): value is number =>
  isFiniteSafe(value) && value >= 0 && value <= MAX_SAFE_LAYOUT_WIDTH;

const isSafeIntegerAtLeast = (value: unknown, minimum: number): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum;

const isSha256 = (value: unknown): value is string =>
  typeof value === 'string' && /^[0-9A-Fa-f]{64}$/.test(value);

const cloneData = (value: unknown, seen = new WeakMap<object, unknown>()): unknown => {
  if (value === null || typeof value !== 'object') return value;
  const existing = seen.get(value);
  if (existing !== undefined) return existing;
  if (value instanceof Uint8Array) return Array.from(value);
  if (Array.isArray(value)) {
    const result: unknown[] = [];
    seen.set(value, result);
    for (const item of value) result.push(cloneData(item, seen));
    return result;
  }
  const result: Record<string, unknown> = {};
  seen.set(value, result);
  for (const key of Object.keys(value).sort()) result[key] = cloneData((value as Record<string, unknown>)[key], seen);
  return result;
};

const freezeDeep = <T>(value: T, seen = new WeakSet<object>()): T => {
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return value;
  seen.add(value);
  if (value instanceof Uint8Array) return value;
  for (const key of Object.keys(value as object)) {
    freezeDeep((value as Record<string, unknown>)[key], seen);
  }
  return Object.freeze(value);
};

const samePrimitiveRecord = (left: Record<string, unknown>, right: Record<string, unknown>): boolean => {
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  if (leftKeys.length !== rightKeys.length) return false;
  for (let index = 0; index < leftKeys.length; index += 1) {
    const key = leftKeys[index];
    if (key !== rightKeys[index] || left[key] !== right[key]) return false;
  }
  return true;
};

const sameModelIdentity = (left: X4UiLayoutModelIdentity, right: X4UiLayoutModelIdentity): boolean =>
  isRecord(left) && isRecord(right) && samePrimitiveRecord(left as unknown as Record<string, unknown>, right as unknown as Record<string, unknown>);

const sameAssetIdentity = (left: ZektonAssetIdentity, right: ZektonAssetIdentity): boolean =>
  isRecord(left) && isRecord(right) && samePrimitiveRecord(left as unknown as Record<string, unknown>, right as unknown as Record<string, unknown>);

const sameProvenance = (value: unknown): boolean =>
  isRecord(value)
  && value.id === X4_LAYOUT_PROVENANCE.id
  && value.version === X4_LAYOUT_PROVENANCE.version
  && value.helperSourcePath === X4_LAYOUT_PROVENANCE.helperSourcePath
  && value.helperSha256 === X4_LAYOUT_PROVENANCE.helperSha256
  && value.widgetSourcePath === X4_LAYOUT_PROVENANCE.widgetSourcePath
  && value.widgetSha256 === X4_LAYOUT_PROVENANCE.widgetSha256;

const sourceOrder = (source: X4UiSceneSourceLocation): number => source.start.offset;

const compareSourceOrder = (left: number, right: number): number => left === right ? 0 : left < right ? -1 : 1;

const sourceIsValid = (source: unknown): source is X4UiSceneSourceLocation => {
  if (!isRecord(source) || !isRecord(source.start) || !isRecord(source.end)) return false;
  const sourceKeys = Object.keys(source);
  const positionKeys = (position: Record<string, unknown>): boolean => {
    const keys = Object.keys(position);
    return keys.length === 3 && keys.every(key => key === 'line' || key === 'column' || key === 'offset');
  };
  if (!sourceKeys.every(key => key === 'file' || key === 'sourcePath' || key === 'start' || key === 'end') || !positionKeys(source.start) || !positionKeys(source.end)) return false;
  if (typeof source.file !== 'string' || source.file.length === 0) return false;
  if (source.sourcePath !== undefined && typeof source.sourcePath !== 'string') return false;
  const start = source.start;
  const end = source.end;
  return isSafeIntegerAtLeast(start.line, 1)
    && isSafeIntegerAtLeast(start.column, 0)
    && isSafeIntegerAtLeast(start.offset, 0)
    && isSafeIntegerAtLeast(end.line, 1)
    && isSafeIntegerAtLeast(end.column, 0)
    && isSafeIntegerAtLeast(end.offset, start.offset);
};

const sourceCopy = (source: X4UiSceneSourceLocation): X4UiSceneSourceLocation =>
  ({
    file: source.file,
    ...(source.sourcePath === undefined ? {} : { sourcePath: source.sourcePath }),
    start: { line: source.start.line, column: source.start.column, offset: source.start.offset },
    end: { line: source.end.line, column: source.end.column, offset: source.end.offset },
  });

const sourcePinIsValid = (pin: unknown): pin is X4UiLayoutSourcePin => {
  if (!isRecord(pin)) return false;
  const keys = Object.keys(pin);
  return keys.length === 3
    && keys.every(key => key === 'sourcePath' || key === 'lineStart' || key === 'lineEnd')
    && typeof pin.sourcePath === 'string'
    && pin.sourcePath.length > 0
    && isSafeIntegerAtLeast(pin.lineStart, 1)
    && isSafeIntegerAtLeast(pin.lineEnd, pin.lineStart);
};

const isHelperOmittedWidthFact = (fact: X4UiLayoutDescriptorFact | undefined): boolean =>
  fact?.status === 'known'
  && fact.expectedType === 'number'
  && fact.provenance === 'source-pinned-default'
  && fact.sourcePin?.sourcePath === X4_LAYOUT_PROVENANCE.helperSourcePath
  && fact.sourcePin.lineStart === 5372
  && fact.sourcePin.lineEnd === 5388;

const sourcePinCopy = (pin: X4UiLayoutSourcePin): X4UiLayoutSourcePin => ({
  sourcePath: pin.sourcePath,
  lineStart: pin.lineStart,
  lineEnd: pin.lineEnd,
});

const modelIdentityCopy = (identity: X4UiLayoutModelIdentity): X4UiLayoutModelIdentity => ({
  file: identity.file,
  ...(identity.sourcePath === undefined ? {} : { sourcePath: identity.sourcePath }),
  sha256: identity.sha256,
});

const assetIdentityCopy = (identity: ZektonAssetIdentity): ZektonAssetIdentity => ({
  relativePath: identity.relativePath,
  sha256: identity.sha256,
});

const tableViewStateCopy = (view: X4UiSceneTableViewState): X4UiSceneTableViewState => ({
  ...(view.topRow === undefined ? {} : { topRow: view.topRow }),
  ...(view.scrollOffset === undefined ? {} : { scrollOffset: view.scrollOffset }),
  ...(view.selectedRow === undefined ? {} : { selectedRow: view.selectedRow }),
});

const sceneProfileCopy = (profile: X4UiSceneProfile): X4UiSceneProfile => ({
  id: profile.id,
  provenance: profile.provenance,
  source: modelIdentityCopy(profile.source),
  helper: { sourcePath: profile.helper.sourcePath, sha256: profile.helper.sha256 },
  widget: { sourcePath: profile.widget.sourcePath, sha256: profile.widget.sha256 },
  fonts: {
    Zekton: { descriptor: assetIdentityCopy(profile.fonts.Zekton.descriptor), atlas: assetIdentityCopy(profile.fonts.Zekton.atlas) },
    'Zekton Bold': { descriptor: assetIdentityCopy(profile.fonts['Zekton Bold'].descriptor), atlas: assetIdentityCopy(profile.fonts['Zekton Bold'].atlas) },
  },
  drawable: { width: profile.drawable.width, height: profile.drawable.height },
  textPolicy: {
    nominalDesignSize: profile.textPolicy.nominalDesignSize,
    lineSpacing: profile.textPolicy.lineSpacing,
    wrapMode: profile.textPolicy.wrapMode,
    truncationMode: profile.textPolicy.truncationMode,
    whitespacePolicy: { mode: profile.textPolicy.whitespacePolicy.mode, breakOn: profile.textPolicy.whitespacePolicy.breakOn },
    ellipsisPolicy: { token: profile.textPolicy.ellipsisPolicy.token, placement: profile.textPolicy.ellipsisPolicy.placement },
    newlinePolicy: profile.textPolicy.newlinePolicy,
    truthGrade: profile.textPolicy.truthGrade,
    evidenceState: profile.textPolicy.evidenceState,
  },
  ...(profile.tableView === undefined ? {} : {
    tableView: Object.fromEntries(Object.keys(profile.tableView).sort().map(key => [key, tableViewStateCopy(profile.tableView![key])])),
  }),
});

const refusal = (
  code: X4UiSceneRefusalCode,
  message: string,
  source?: X4UiSceneSourceLocation,
): X4UiSceneRefusal => freezeDeep({
  status: 'refused' as const,
  refusal: {
    code,
    message,
    ...(source ? { source: sourceCopy(source) } : {}),
  },
  verification: REFUSAL_VERIFICATION,
});

const knownValue = (
  fact: X4UiLayoutDescriptorFact | undefined,
  expectedType: 'number' | 'string' | 'boolean',
): { readonly value: number | string | boolean; readonly fact: Extract<X4UiLayoutDescriptorFact, { readonly status: 'known' }> } | undefined => {
  if (!fact || fact.status !== 'known' || fact.expectedType !== expectedType) return undefined;
  if (typeof fact.value !== expectedType) return undefined;
  return { value: fact.value, fact };
};

const factProvenanceLink = (
  factName: string,
  fact: Extract<X4UiLayoutDescriptorFact, { readonly status: 'known' }>,
  operationId?: string,
): X4UiSceneProvenanceLink => ({
  kind: fact.provenance === 'preview-sample' ? 'preview-only' : 'descriptor-fact',
  fact: factName,
  operationId,
  source: sourceCopy(fact.source),
  ...(fact.sourcePin ? { sourcePin: sourcePinCopy(fact.sourcePin) } : {}),
  expression: fact.expression,
  ...(fact.sampleId ? { sampleId: fact.sampleId } : {}),
});

const sceneColorFact = (
  field: string,
  slot: X4UiSceneColorSlot,
  fact: X4UiLayoutDescriptorFact | undefined,
): X4UiSceneColorFact | undefined => {
  if (!fact || fact.status !== 'known' || fact.expectedType !== 'color-object' || !validateKnownColorFact(fact as unknown as Record<string, unknown>)) return undefined;
  return {
    field,
    slot,
    value: cloneData(fact.value) as X4UiLayoutColorValue,
    domain: fact.value.domain,
    provenance: fact.provenance,
    expression: fact.expression,
    source: sourceCopy(fact.source),
    ...(fact.sourcePin ? { sourcePin: sourcePinCopy(fact.sourcePin) } : {}),
    ...(fact.sampleId ? { sampleId: fact.sampleId } : {}),
    gameVerification: X4_UI_SCENE_GAME_TRUTH,
  };
};

const sceneColorFacts = (
  facts: X4UiLayoutDescriptorFacts,
  entries: readonly (readonly [string, X4UiSceneColorSlot])[],
): readonly X4UiSceneColorFact[] => entries
  .map(([field, slot]) => sceneColorFact(field, slot, facts[field]))
  .filter((fact): fact is X4UiSceneColorFact => fact !== undefined);

const addKnownColorUncertaintyGap = (
  context: BuildContext,
  nodeId: string,
  source: X4UiSceneSourceLocation,
  links: string[],
  subject: string,
): void => {
  gapForChild(
    context,
    'paint',
    nodeId,
    source,
    `known base color tint for ${subject} does not establish engine-effective material/texture/glow, active/inactive/hover/selection state, C++ effective color map/profile/daltonization, font raster color behavior, or game-frame acceptance`,
    links,
    'unsupported',
  );
};

const addUnavailableColorGap = (
  context: BuildContext,
  nodeId: string,
  field: string,
  fact: X4UiLayoutDescriptorFact | undefined,
  links: string[],
): void => {
  if (fact?.status !== 'unavailable' || fact.expectedType !== 'color-object') return;
  gapForChild(
    context,
    'paint',
    nodeId,
    fact.source,
    `color descriptor fact ${field} remains unavailable to the scene projection`,
    links,
    'unsupported',
  );
};

interface BuildContext {
  readonly program: X4UiLayoutProgram;
  readonly assets: X4UiSceneFontAssetMap;
  readonly profile: X4UiSceneProfile;
  readonly gaps: X4UiSceneGap[];
  readonly programGapIds: Map<number, string>;
  partial: boolean;
  gapSequence: number;
}

const addGap = (
  context: BuildContext,
  input: Omit<X4UiSceneGap, 'id'>,
): string => {
  const id = `scene-gap:${String(context.gapSequence).padStart(6, '0')}`;
  context.gapSequence += 1;
  context.gaps.push({ id, ...input });
  context.partial = true;
  return id;
};

const compareText = (left: string, right: string): number => left === right ? 0 : left < right ? -1 : 1;

const compareOptionalNumber = (left: number | undefined, right: number | undefined): number => {
  if (left === right) return 0;
  if (left === undefined) return -1;
  if (right === undefined) return 1;
  return left < right ? -1 : 1;
};

const compareSceneGap = (left: X4UiSceneGap, right: X4UiSceneGap): number =>
  compareText(left.source.file, right.source.file)
  || compareText(left.source.sourcePath || '', right.source.sourcePath || '')
  || compareOptionalNumber(left.source.start.offset, right.source.start.offset)
  || compareOptionalNumber(left.source.end.offset, right.source.end.offset)
  || compareOptionalNumber(left.source.start.line, right.source.start.line)
  || compareOptionalNumber(left.source.start.column, right.source.start.column)
  || compareOptionalNumber(left.source.end.line, right.source.end.line)
  || compareOptionalNumber(left.source.end.column, right.source.end.column)
  || compareText(left.category, right.category)
  || compareText(left.status, right.status)
  || compareText(left.reason, right.reason)
  || compareText(left.expression || '', right.expression || '')
  || compareText(left.sourcePin?.sourcePath || '', right.sourcePin?.sourcePath || '')
  || compareOptionalNumber(left.sourcePin?.lineStart, right.sourcePin?.lineStart)
  || compareOptionalNumber(left.sourcePin?.lineEnd, right.sourcePin?.lineEnd)
  || compareText(left.operationId || '', right.operationId || '')
  || compareText(left.nodeId || '', right.nodeId || '')
  || compareOptionalNumber(left.textRange?.start, right.textRange?.start)
  || compareOptionalNumber(left.textRange?.end, right.textRange?.end)
  || compareOptionalNumber(left.lineIndex, right.lineIndex)
  || compareText(left.previewOnly === undefined ? '' : String(left.previewOnly), right.previewOnly === undefined ? '' : String(right.previewOnly))
  || compareText(left.id, right.id);

const remapGapLinks = (
  links: readonly string[],
  ids: ReadonlyMap<string, string>,
): readonly string[] => {
  const remapped: string[] = [];
  const seen = new Set<string>();
  for (const link of links) {
    const next = ids.get(link);
    if (next === undefined) throw new Error(`scene gap link ${link} has no canonical target`);
    if (!seen.has(next)) {
      seen.add(next);
      remapped.push(next);
    }
  }
  remapped.sort(compareText);
  return remapped;
};

const canonicalizeSceneGapGraph = (
  gaps: readonly X4UiSceneGap[],
  frames: readonly X4UiSceneFrameNode[],
  tables: readonly X4UiSceneTableNode[],
  rows: readonly X4UiSceneRowNode[],
  cells: readonly X4UiSceneCellNode[],
  widgets: readonly X4UiSceneWidgetNode[],
  texts: readonly X4UiSceneTextNode[],
  glyphs: readonly X4UiSceneGlyphNode[],
): {
  readonly gaps: readonly X4UiSceneGap[];
  readonly frames: readonly X4UiSceneFrameNode[];
  readonly tables: readonly X4UiSceneTableNode[];
  readonly rows: readonly X4UiSceneRowNode[];
  readonly cells: readonly X4UiSceneCellNode[];
  readonly widgets: readonly X4UiSceneWidgetNode[];
  readonly texts: readonly X4UiSceneTextNode[];
  readonly glyphs: readonly X4UiSceneGlyphNode[];
} => {
  const ordered = [...gaps].sort(compareSceneGap);
  const ids = new Map<string, string>();
  ordered.forEach((gap, index) => {
    if (ids.has(gap.id)) throw new Error(`duplicate scene gap id ${gap.id}`);
    ids.set(gap.id, `scene-gap:${String(index).padStart(6, '0')}`);
  });
  const canonicalGaps = ordered.map(gap => ({ ...gap, id: ids.get(gap.id)! }));
  const remapNode = <T extends X4UiSceneNodeBase>(node: T): T => ({
    ...node,
    diagnosticLinks: remapGapLinks(node.diagnosticLinks, ids),
  } as T);
  const canonicalTexts = texts.map(text => ({
    ...remapNode(text),
    textGaps: remapGapLinks(text.textGaps, ids),
    lines: text.lines.map(line => ({
      ...line,
      diagnosticLinks: remapGapLinks(line.diagnosticLinks, ids),
    })),
  }));
  const canonicalFrames = frames.map(frame => ({
    ...remapNode(frame),
    ...(frame.frameTextureLayers === undefined ? {} : {
      frameTextureLayers: frame.frameTextureLayers.map(layer => ({
        ...layer,
        diagnosticLinks: remapGapLinks(layer.diagnosticLinks, ids),
      })),
    }),
    ...(frame.backdrop === undefined ? {} : {
      backdrop: {
        ...frame.backdrop,
        diagnosticLinks: remapGapLinks(frame.backdrop.diagnosticLinks, ids),
      },
    }),
  }));
  return {
    gaps: canonicalGaps,
    frames: canonicalFrames,
    tables: tables.map(remapNode),
    rows: rows.map(remapNode),
    cells: cells.map(remapNode),
    widgets: widgets.map(remapNode),
    texts: canonicalTexts,
    glyphs: glyphs.map(remapNode),
  };
};

const linkProgramGaps = (context: BuildContext, nodeId: string | undefined): string[] => {
  const links: string[] = [];
  context.program.gaps.forEach((gap, index) => {
    const nodeMatch = gap.nodeId !== undefined && gap.nodeId === nodeId;
    const operationMatch = gap.nodeId === undefined
      && gap.operationId !== undefined
      && nodeId !== undefined
      && context.program.operations.some(operation =>
        operation.id === gap.operationId
        && (
          operation.frameId === nodeId
          || operation.tableId === nodeId
          || operation.rowId === nodeId
          || operation.cellId === nodeId
          || context.program.frames.some(frame => frame.id === nodeId && frame.operationIds.includes(operation.id))
          || context.program.tables.some(table => table.id === nodeId && table.operationIds.includes(operation.id))
          || context.program.rows.some(row => row.id === nodeId && row.operationIds.includes(operation.id))
          || context.program.cells.some(cell => cell.id === nodeId && (cell.operationIds.includes(operation.id) || cell.metadataOperationIds.includes(operation.id)))
        ),
      );
    if (nodeMatch || operationMatch) {
      const id = context.programGapIds.get(index);
      if (id) links.push(id);
    }
  });
  return links;
};

const addNodeStatusGap = (
  context: BuildContext,
  nodeId: string,
  source: X4UiSceneSourceLocation,
  status: string,
  links: string[],
): void => {
  if (status === 'projected' || status === 'applied') return;
  const id = addGap(context, {
    category: 'program-node',
    status: status === 'refused' || status === 'rejected' ? 'refused' : 'incomplete',
    reason: `accepted layout node ${nodeId} retained status ${status}`,
    source: sourceCopy(source),
    nodeId,
  });
  links.push(id);
};

const gapForMissingFact = (
  context: BuildContext,
  category: string,
  nodeId: string,
  source: X4UiSceneSourceLocation,
  factName: string,
  fact: X4UiLayoutDescriptorFact | undefined,
  links: string[],
): void => {
  if (fact?.status === 'unavailable') {
    const id = addGap(context, {
      category,
      status: fact.expectedType === 'color-object' ? 'unsupported' : 'unknown',
      reason: fact.reason,
      source: sourceCopy(fact.source),
      ...(fact.expression ? { expression: fact.expression } : {}),
      ...(fact.sourcePin ? { sourcePin: sourcePinCopy(fact.sourcePin) } : {}),
      nodeId,
    });
    links.push(id);
    return;
  }
  const id = addGap(context, {
    category,
    status: 'incomplete',
    reason: `required descriptor fact ${factName} is missing or has an unexpected type`,
    source: sourceCopy(source),
    nodeId,
  });
  links.push(id);
};

const gapForChild = (
  context: BuildContext,
  category: string,
  nodeId: string,
  source: X4UiSceneSourceLocation,
  reason: string,
  links: string[],
  status = 'unknown',
): void => {
  links.push(addGap(context, {
    category,
    status,
    reason,
    source: sourceCopy(source),
    nodeId,
  }));
};

const addFinalizationGap = (
  context: BuildContext,
  table: X4UiLayoutTableNode,
  links: string[],
): void => {
  const reason = 'Helper column finalization awaits the first successfully applied addRow';
  const existing = context.gaps.find(gap => gap.nodeId === table.id && gap.reason === reason);
  const id = existing?.id || addGap(context, {
    category: 'width',
    status: 'unknown',
    reason,
    source: sourceCopy(table.source),
    sourcePin: {
      sourcePath: X4_LAYOUT_PROVENANCE.helperSourcePath,
      lineStart: 4779,
      lineEnd: 4958,
    },
    nodeId: table.id,
  });
  if (!links.includes(id)) links.push(id);
};

const projectKernelDiagnostics = (
  context: BuildContext,
  table: X4UiLayoutTableNode,
  state: HelperTableState,
  links: string[],
): void => {
  const seen = new Set<string>();
  for (const diagnostic of state.diagnostics) {
    const key = `${diagnostic.code}\u0000${diagnostic.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const reason = `kernel finalization diagnostic ${diagnostic.code}: ${diagnostic.message}`;
    const existing = context.gaps.find(gap => gap.nodeId === table.id && (
      gap.reason === reason
      || gap.reason === diagnostic.message
      || gap.expression === diagnostic.code
    ));
    const id = existing?.id || addGap(context, {
      category: 'kernel',
      status: 'incomplete',
      reason,
      source: sourceCopy(table.source),
      expression: diagnostic.code,
      nodeId: table.id,
    });
    if (!links.includes(id)) links.push(id);
  }
};

const factLinks = (
  facts: X4UiLayoutDescriptorFacts,
  names: readonly string[],
  operationId?: string,
): X4UiSceneProvenanceLink[] => names.flatMap(name => {
  const fact = facts[name];
  return fact?.status === 'known' ? [factProvenanceLink(name, fact, operationId)] : [];
});

const statusIsComplete = (status: string): boolean => status === 'projected' || status === 'applied';

const rect = (x: number, y: number, width: number, height: number): X4UiSceneRect => ({ x, y, width, height });

const intersection = (left: X4UiSceneRect, right: X4UiSceneRect): X4UiSceneRect | undefined => {
  const x = Math.max(left.x, right.x);
  const y = Math.max(left.y, right.y);
  const endX = Math.min(left.x + left.width, right.x + right.width);
  const endY = Math.min(left.y + left.height, right.y + right.height);
  if (endX <= x || endY <= y) return undefined;
  return rect(x, y, endX - x, endY - y);
};

const clamp = (value: number, minimum: number, maximum: number): number => Math.min(Math.max(value, minimum), maximum);

const intersectionOrEmpty = (left: X4UiSceneRect, right: X4UiSceneRect): X4UiSceneRect => {
  const clipped = intersection(left, right);
  if (clipped) return clipped;
  return rect(
    clamp(left.x, right.x, right.x + right.width),
    clamp(left.y, right.y, right.y + right.height),
    0,
    0,
  );
};

const clipRectFor = (geometry: X4UiSceneRect, clip: X4UiSceneRect): X4UiSceneRect => {
  if (clip.width === 0 || clip.height === 0) return rect(clip.x, clip.y, 0, 0);
  const clipped = intersection(geometry, clip);
  if (clipped) return clipped;
  return rect(
    clamp(geometry.x, clip.x, clip.x + clip.width),
    clamp(geometry.y, clip.y, clip.y + clip.height),
    0,
    0,
  );
};

const numericFact = (
  context: BuildContext,
  facts: X4UiLayoutDescriptorFacts,
  name: string,
  nodeId: string,
  source: X4UiSceneSourceLocation,
  links: string[],
  dimension = false,
  allowHelperDerivedNegative = false,
): number | undefined => {
  const fact = facts[name];
  const value = knownValue(fact, 'number');
  const validDimension = value !== undefined
    && (isFiniteDimension(value.value)
      || (allowHelperDerivedNegative && typeof value.value === 'number' && value.value < 0 && isHelperOmittedWidthFact(fact)));
  if (!value || (dimension ? !validDimension : !isFiniteSafe(value.value))) {
    if (value && !isFiniteSafe(value.value)) {
      gapForChild(context, 'number', nodeId, source, `descriptor fact ${name} is not finite and safe`, links, 'refused');
    } else {
      gapForMissingFact(context, 'geometry', nodeId, source, name, fact, links);
    }
    return undefined;
  }
  return value.value as number;
};

const booleanFact = (
  context: BuildContext,
  facts: X4UiLayoutDescriptorFacts,
  name: string,
  nodeId: string,
  source: X4UiSceneSourceLocation,
  links: string[],
): boolean | undefined => {
  const fact = facts[name];
  const value = knownValue(fact, 'boolean');
  if (!value) {
    gapForMissingFact(context, 'geometry', nodeId, source, name, fact, links);
    return undefined;
  }
  return value.value as boolean;
};

const safeArithmetic = (value: number): number | undefined =>
  isFiniteSafe(value) && Math.abs(value) <= MAX_SAFE_LAYOUT_WIDTH ? value : undefined;

const formatSceneDiagnosticPixels = (value: number): string => {
  const rounded = Math.round(value * 10000) / 10000;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(4).replace(/0+$/, '');
};

const operationForCell = (
  operations: ReadonlyMap<string, X4UiLayoutOperation>,
  cell: X4UiLayoutCellNode,
  names: readonly string[],
): X4UiLayoutOperation | undefined => {
  const candidates = cell.operationIds
    .map(id => operations.get(id))
    .filter((operation): operation is X4UiLayoutOperation => Boolean(operation) && names.includes(operation.kind))
    .sort((left, right) => compareSourceOrder(left.sourceOrder, right.sourceOrder) || left.id.localeCompare(right.id));
  return candidates[candidates.length - 1];
};

const cellStateFor = (
  table: HelperTableState | undefined,
  rowIndex: number | undefined,
  column: number,
): HelperTableState['rows'][number]['cells'][number] | undefined => {
  if (!table || rowIndex === undefined) return undefined;
  return table.rows[rowIndex - 1]?.cells[column - 1];
};

const rowStateFor = (
  table: HelperTableState | undefined,
  rowIndex: number | undefined,
): HelperTableState['rows'][number] | undefined =>
  table && rowIndex !== undefined ? table.rows[rowIndex - 1] : undefined;

const groupFor = (
  table: HelperTableState,
  rowState: HelperTableState['rows'][number] | undefined,
): HelperTableState['rowGroups'][number] | undefined =>
  rowState?.groupIndex === undefined ? undefined : table.rowGroups[rowState.groupIndex - 1];

const fixedCountFor = (rows: readonly X4UiLayoutRowNode[]): number | undefined => {
  let max = 0;
  for (let index = 0; index < rows.length; index += 1) {
    const fact = rows[index].descriptorFacts.fixed;
    if (!fact || fact.status !== 'known' || typeof fact.value !== 'boolean') return undefined;
    const rowNumber = rows[index].rowIndex ?? index + 1;
    if (fact.value) max = Math.max(max, rowNumber);
  }
  return max;
};

const isFixedSectionRow = (
  row: X4UiLayoutRowNode,
  rowPosition: number,
  fixedCount: number | undefined,
): boolean | undefined => fixedCount === undefined ? undefined : (row.rowIndex ?? rowPosition + 1) <= fixedCount;

interface GroupTopology {
  /** First row whose vertical position depends on an ambiguous group transition. */
  readonly blockedAt?: number;
}

/**
 * A row only carries its deepest group identity. One group can therefore be
 * entered and exited exactly from the accepted facts. Multiple group IDs do
 * not carry enough parent/first-row/num-rows information to reconstruct the
 * active stack without guessing; leave the transition and all downstream
 * vertical geometry unavailable instead of applying a one-level heuristic.
 */
const analyzeGroupTopology = (
  rows: readonly X4UiLayoutRowNode[],
  state: HelperTableState | undefined,
): GroupTopology => {
  if (!state) return {};
  const seen = new Set<number>();
  const closed = new Set<number>();
  let activeGroup: number | undefined;
  for (let index = 0; index < rows.length; index += 1) {
    const rowState = rowStateFor(state, rows[index].rowIndex);
    const groupIndex = rowState?.groupIndex;
    if (groupIndex === undefined) {
      if (activeGroup !== undefined) {
        closed.add(activeGroup);
        activeGroup = undefined;
      }
      continue;
    }
    if (closed.has(groupIndex) || (activeGroup !== undefined && activeGroup !== groupIndex) || (activeGroup === undefined && seen.size > 0 && !seen.has(groupIndex))) return { blockedAt: index };
    seen.add(groupIndex);
    activeGroup = groupIndex;
  }
  return {};
};

interface DiscreteDrawAcceptanceLedger {
  readonly accepted: ReadonlyMap<string, boolean | undefined>;
  readonly normalStartOffset?: number;
}

interface DiscreteDrawAcceptanceSectionResult {
  readonly height?: number;
  readonly firstContentOffset?: number;
  readonly sectionEndClosure?: number;
  readonly stopped: boolean;
  readonly unknown: boolean;
}

const knownRowBoolean = (row: X4UiLayoutRowNode | undefined, name: 'borderBelow'): boolean | undefined => {
  const fact = row?.descriptorFacts[name];
  return fact?.status === 'known' && fact.expectedType === 'boolean' && typeof fact.value === 'boolean' ? fact.value : undefined;
};

const knownRowPadding = (row: X4UiLayoutRowNode | undefined, name: 'paddingTop' | 'paddingBottom'): number | undefined => {
  const fact = row?.descriptorFacts[name];
  return fact?.status === 'known' && fact.expectedType === 'number' && typeof fact.value === 'number' && isFiniteDimension(fact.value) ? fact.value : undefined;
};

const knownRowHeight = (row: X4UiLayoutRowNode | undefined): number | undefined =>
  row?.height?.status === 'known' && isFiniteDimension(row.height.value) ? row.height.value : undefined;

const drawAcceptanceLedgerFor = (
  rows: readonly X4UiLayoutRowNode[],
  state: HelperTableState,
  fixedCount: number | undefined,
  topRow: number,
  tableHeight: number,
): DiscreteDrawAcceptanceLedger => {
  const accepted = new Map<string, boolean | undefined>();
  if (fixedCount === undefined) {
    rows.forEach(row => accepted.set(row.id, undefined));
    return { accepted };
  }
  const rowsByNumber = new Map<number, X4UiLayoutRowNode>();
  rows.forEach((row, index) => rowsByNumber.set(row.rowIndex ?? index + 1, row));
  const rowNumber = (row: X4UiLayoutRowNode): number => row.rowIndex ?? rows.indexOf(row) + 1;
  const groupIndexFor = (row: X4UiLayoutRowNode | undefined): number | undefined => {
    const rowState = rowStateFor(state, row?.rowIndex);
    return rowState?.groupIndex;
  };
  const groupLevelFor = (row: X4UiLayoutRowNode | undefined): number => {
    const groupIndex = groupIndexFor(row);
    return groupIndex === undefined ? 0 : state.rowGroups[groupIndex - 1]?.level ?? 0;
  };
  const borderSize = state.metrics.borderSize;
  const groupOffset = state.metrics.standardContainerOffset;
  const rowNumberForSectionStart = (section: readonly X4UiLayoutRowNode[]): number | undefined => section[0] ? rowNumber(section[0]) : undefined;

  const processSection = (
    section: readonly X4UiLayoutRowNode[],
    isFixedSection: boolean,
    initialHeight: number,
  ): DiscreteDrawAcceptanceSectionResult => {
    let curtableheight: number | undefined = initialHeight;
    let blocked = false;
    let unknownStop = false;
    let firstContentOffset: number | undefined;
    let sectionEndClosure: number | undefined;
    const firstRow = rowNumberForSectionStart(section);
    for (const row of section) {
      if (blocked) {
        accepted.set(row.id, curtableheight === undefined ? undefined : false);
        continue;
      }
      const currentRowNumber = rowNumber(row);
      const previousRow = currentRowNumber === firstRow && !isFixedSection
        ? rowsByNumber.get(fixedCount)
        : rowsByNumber.get(currentRowNumber - 1);
      let nextrowheight = knownRowHeight(row);
      if (curtableheight === undefined || nextrowheight === undefined) {
        accepted.set(row.id, undefined);
        blocked = true;
        curtableheight = undefined;
        continue;
      }
      let previousBorderContribution = 0;
      if (curtableheight !== 0 && previousRow) {
        const previousBorder = knownRowBoolean(previousRow, 'borderBelow');
        if (previousBorder === undefined) {
          accepted.set(row.id, undefined);
          blocked = true;
          unknownStop = true;
          curtableheight = undefined;
          continue;
        }
        if (previousBorder) {
          const borderedHeight = safeArithmetic(nextrowheight + borderSize);
          if (borderedHeight === undefined) {
            accepted.set(row.id, undefined);
            blocked = true;
            unknownStop = true;
            curtableheight = undefined;
            continue;
          }
          nextrowheight = borderedHeight;
          previousBorderContribution = borderSize;
        }
      }
      const currentGroupLevel = !isFixedSection && currentRowNumber === firstRow ? 0 : groupLevelFor(row);
      const previousGroupLevel = previousRow ? groupLevelFor(previousRow) : 0;
      if (previousGroupLevel > currentGroupLevel) {
        const closed = safeArithmetic((previousGroupLevel - currentGroupLevel) * groupOffset);
        if (closed === undefined) {
          accepted.set(row.id, undefined);
          blocked = true;
          unknownStop = true;
          curtableheight = undefined;
          continue;
        }
        const withClosing = safeArithmetic(curtableheight + closed);
        if (withClosing === undefined) {
          accepted.set(row.id, undefined);
          blocked = true;
          unknownStop = true;
          curtableheight = undefined;
          continue;
        }
        curtableheight = withClosing;
      }
      if (curtableheight + nextrowheight > tableHeight) {
        const terminatedHeight = previousGroupLevel > 0
          ? safeArithmetic(curtableheight + previousGroupLevel * groupOffset)
          : curtableheight;
        if (terminatedHeight === undefined) {
          accepted.set(row.id, undefined);
          blocked = true;
          unknownStop = true;
          curtableheight = undefined;
          continue;
        }
        curtableheight = terminatedHeight;
        accepted.set(row.id, false);
        blocked = true;
        continue;
      }
      accepted.set(row.id, true);
      const paddingTop = knownRowPadding(row, 'paddingTop');
      const paddingBottom = knownRowPadding(row, 'paddingBottom');
      if (firstContentOffset === undefined && paddingTop !== undefined) firstContentOffset = curtableheight + previousBorderContribution + paddingTop;
      if (paddingTop === undefined || paddingBottom === undefined) {
        blocked = true;
        unknownStop = true;
        curtableheight = undefined;
        continue;
      }
      const withPadding = safeArithmetic(curtableheight + nextrowheight + paddingTop + paddingBottom);
      if (withPadding === undefined) {
        blocked = true;
        unknownStop = true;
        curtableheight = undefined;
        continue;
      }
      curtableheight = withPadding;
      const currentGroupIndex = groupIndexFor(row);
      const previousGroupIndex = groupIndexFor(previousRow);
      if (currentGroupIndex !== undefined && (currentRowNumber === firstRow || currentGroupIndex !== previousGroupIndex)) {
        const currentGroupLevel = groupLevelFor(row);
        const withOpening = safeArithmetic(curtableheight + currentGroupLevel * groupOffset);
        if (withOpening === undefined) {
          blocked = true;
          unknownStop = true;
          curtableheight = undefined;
          continue;
        }
        curtableheight = withOpening;
      }
    }
    if (!blocked && !unknownStop && curtableheight !== undefined && section.length > 0) {
      const finalGroupLevel = groupLevelFor(section[section.length - 1]);
      if (finalGroupLevel > 0) {
        const closing = safeArithmetic(finalGroupLevel * groupOffset);
        const closedHeight = closing === undefined ? undefined : safeArithmetic(curtableheight + closing);
        if (closing === undefined || closedHeight === undefined) {
          curtableheight = undefined;
          unknownStop = true;
        } else {
          curtableheight = closedHeight;
          sectionEndClosure = closing;
        }
      }
    }
    return {
      ...(curtableheight === undefined ? {} : { height: curtableheight }),
      ...(firstContentOffset === undefined ? {} : { firstContentOffset }),
      ...(sectionEndClosure === undefined ? {} : { sectionEndClosure }),
      stopped: blocked || unknownStop,
      unknown: unknownStop,
    };
  };

  const fixedRows = rows.filter(row => rowNumber(row) <= fixedCount);
  const normalRows = rows.filter(row => rowNumber(row) > fixedCount && rowNumber(row) >= topRow);
  const fixedResult = processSection(fixedRows, true, 0);
  let normalResult: DiscreteDrawAcceptanceSectionResult | undefined;
  if (!fixedResult.unknown && fixedResult.height !== undefined) normalResult = processSection(normalRows, false, fixedResult.height);
  else normalRows.forEach(row => accepted.set(row.id, fixedResult.height === undefined ? undefined : false));
  rows.forEach(row => {
    if (!accepted.has(row.id)) accepted.set(row.id, false);
  });
  const fixedBoundaryChanged = (!fixedResult.unknown && fixedResult.stopped)
    || (fixedResult.sectionEndClosure !== undefined && fixedResult.sectionEndClosure > 0);
  const normalStartOffset = fixedBoundaryChanged ? normalResult?.firstContentOffset : undefined;
  return {
    accepted,
    ...(normalStartOffset === undefined ? {} : { normalStartOffset }),
  };
};

const canDeriveFullHeight = (
  table: X4UiLayoutTableNode,
  rowsById: ReadonlyMap<string, X4UiLayoutRowNode>,
  state: HelperTableState,
): boolean => table.rowIds.every(rowId => {
  const row = rowsById.get(rowId);
  if (!row || row.height?.status !== 'known' || !isFiniteDimension(row.height.value) || row.rowIndex === undefined) return false;
  const stateRow = state.rows[row.rowIndex - 1];
  return Boolean(stateRow && stateRow.cells.every(cell => isFiniteSafe(cell.height) && isFiniteSafe(cell.y)));
});

interface TableProjection {
  readonly table: X4UiLayoutTableNode;
  readonly state?: HelperTableState;
  readonly frame?: X4UiLayoutFrameNode;
  readonly frameRect?: X4UiSceneRect;
  readonly rect?: X4UiSceneRect;
  readonly viewportRect?: X4UiSceneRect;
  readonly fixedViewportRect?: X4UiSceneRect;
  readonly columns?: readonly X4UiSceneColumn[];
  readonly fixedColumns?: readonly X4UiSceneColumn[];
  readonly fullHeight?: number;
  readonly visibleHeight?: number;
  readonly maxVisibleHeight?: number;
  readonly hasScrollBar?: boolean;
  readonly reserveScrollBar?: boolean;
  readonly fixedCount?: number;
  readonly rowNaturalContentTop: ReadonlyMap<string, number>;
  readonly rowDisplayContentTop: ReadonlyMap<string, number>;
  readonly rowVisible: ReadonlyMap<string, boolean>;
  readonly rowNaturalRect: ReadonlyMap<string, X4UiSceneRect>;
  readonly rowRect: ReadonlyMap<string, X4UiSceneRect>;
  readonly rowLinks: ReadonlyMap<string, readonly string[]>;
  readonly viewState?: X4UiSceneTableViewState;
}

const makeSourceLink = (
  kind: X4UiSceneProvenanceLink['kind'],
  source: X4UiSceneSourceLocation,
  sourcePin?: X4UiLayoutSourcePin,
  expression?: string,
): X4UiSceneProvenanceLink => ({
  kind,
  source: sourceCopy(source),
  ...(sourcePin ? { sourcePin: sourcePinCopy(sourcePin) } : {}),
  ...(expression ? { expression } : {}),
});

const tableViewFor = (profile: X4UiSceneProfile, tableId: string): X4UiSceneTableViewState | undefined =>
  profile.tableView?.[tableId];

const FRAME_TEXTURE_DESCRIPTOR_FIELDS = Object.freeze([
  'icon',
  'color',
  'width',
  'height',
  'rotationRate',
  'rotationStart',
  'rotationDuration',
  'rotationInterval',
  'initialScaleFactor',
  'scaleDuration',
  'glowfactor',
]);

const frameTextureSurfaceFor = (
  context: BuildContext,
  frame: X4UiLayoutFrameNode,
  frameRect: X4UiSceneRect | undefined,
  frameLinks: readonly string[],
): {
  readonly frameTextureLayers?: readonly X4UiSceneFrameTextureLayer[];
  readonly backdrop?: X4UiSceneFrameBackdrop;
} => {
  const layers = frame.frameTextureLayers?.map(layer => {
    const provenanceLinks = [
      ...factLinks(layer.descriptorFacts, FRAME_TEXTURE_DESCRIPTOR_FIELDS),
    ];
    const diagnosticLinks = [...frameLinks];
    const iconValue = knownValue(layer.descriptorFacts.icon, 'string');
    const icon = iconValue?.value as string | undefined;
    const inactive = icon === '';
    const applicability: X4UiSceneFrameTextureApplicability = inactive
      ? 'inactive'
      : 'active-unresolved';
    const effectiveWidthFact = knownValue(layer.descriptorFacts.width, 'number');
    const effectiveHeightFact = knownValue(layer.descriptorFacts.height, 'number');
    const effectiveWidthValue = effectiveWidthFact?.value;
    const effectiveHeightValue = effectiveHeightFact?.value;
    const effectiveWidth = typeof effectiveWidthValue === 'number'
      ? effectiveWidthValue > 0 ? effectiveWidthValue : frameRect?.width
      : undefined;
    const effectiveHeight = typeof effectiveHeightValue === 'number'
      ? effectiveHeightValue > 0 ? effectiveHeightValue : frameRect?.height
      : undefined;
    if (effectiveWidthFact?.value === 0 && frameRect) {
      provenanceLinks.push(makeSourceLink('source-pin', layer.source, FRAME_TEXTURE_SOURCE_PINS.widthFallback, 'frameElement.width'));
    }
    if (effectiveHeightFact?.value === 0 && frameRect) {
      provenanceLinks.push(makeSourceLink('source-pin', layer.source, FRAME_TEXTURE_SOURCE_PINS.heightFallback, 'frameElement.height'));
    }
    const reason = inactive
      ? undefined
      : 'non-empty frame texture icon remains unresolved because no exact accepted X4 9.00 texture/material asset is available to the source preview';
    if (!inactive) {
      const id = addGap(context, {
        category: 'paint',
        status: 'unsupported',
        reason: reason!,
        source: sourceCopy(layer.source),
        ...(iconValue ? { expression: iconValue.fact.expression } : {}),
        nodeId: `scene:${frame.id}`,
      });
      diagnosticLinks.push(id);
    }
    return {
      name: layer.name,
      source: sourceCopy(layer.source),
      sourceOrder: layer.sourceOrder,
      operationIds: [...layer.operationIds],
      descriptorFacts: cloneData(layer.descriptorFacts) as X4UiLayoutDescriptorFacts,
      applicability,
      ...(icon === undefined ? {} : { icon }),
      ...(effectiveWidth === undefined ? {} : { effectiveWidth }),
      ...(effectiveHeight === undefined ? {} : { effectiveHeight }),
      provenanceLinks,
      diagnosticLinks: [...new Set(diagnosticLinks)],
      gameVerification: X4_UI_SCENE_GAME_TRUTH,
      ...(reason ? { reason } : {}),
    };
  });
  const blurFact = frame.blurBackground || frame.descriptorFacts.blurBackground;
  const backdrop = frame.frameTextureLayers === undefined && blurFact === undefined
    ? undefined
    : (() => {
      const knownBlur = knownValue(blurFact, 'boolean');
      const blurBackground = knownBlur?.value as boolean | undefined;
      const provenanceLinks = [
        ...(blurFact && blurFact.status === 'known' ? [factProvenanceLink('blurBackground', blurFact)] : []),
      ];
      const diagnosticLinks = [...frameLinks];
      const unavailable = blurBackground !== false;
      const reason = unavailable
        ? 'live-game blur rasterization is unavailable; blurBackground is a compositor/backdrop requirement only'
        : 'source disables blurBackground; no live-game backdrop is required';
      if (unavailable) {
        const sceneFrameId = `scene:${frame.id}`;
        const existing = context.gaps.find(gap => gap.nodeId === sceneFrameId && gap.reason === reason);
        const id = existing?.id || addGap(context, {
          category: 'backdrop',
          status: 'unknown',
          reason,
          source: sourceCopy(blurFact?.source || frame.source),
          ...(blurFact?.sourcePin ? { sourcePin: sourcePinCopy(blurFact.sourcePin) } : {}),
          nodeId: sceneFrameId,
        });
        diagnosticLinks.push(id);
      }
      return {
        ...(blurBackground === undefined ? {} : { blurBackground }),
        blurBackgroundFact: cloneData(blurFact) as X4UiLayoutDescriptorFact,
        availability: unavailable ? 'unavailable' as const : 'disabled' as const,
        reason,
        source: sourceCopy(blurFact?.source || frame.source),
        provenanceLinks,
        diagnosticLinks: [...new Set(diagnosticLinks)],
        gameVerification: X4_UI_SCENE_GAME_TRUTH,
      };
    })();
  return {
    ...(layers ? { frameTextureLayers: layers } : {}),
    ...(backdrop ? { backdrop } : {}),
  };
};

const buildFrameNodes = (
  context: BuildContext,
  framesById: ReadonlyMap<string, X4UiLayoutFrameNode>,
): { readonly frames: readonly X4UiSceneFrameNode[]; readonly frameRects: ReadonlyMap<string, X4UiSceneRect>; readonly frameClips: ReadonlyMap<string, X4UiSceneRect> } => {
  const frames: X4UiSceneFrameNode[] = [];
  const frameRects = new Map<string, X4UiSceneRect>();
  const frameClips = new Map<string, X4UiSceneRect>();
  const drawable = rect(0, 0, context.profile.drawable.width, context.profile.drawable.height);
  for (const frame of [...framesById.values()].sort((left, right) => compareSourceOrder(sourceOrder(left.source), sourceOrder(right.source)) || left.id.localeCompare(right.id))) {
    const links = linkProgramGaps(context, frame.id);
    addNodeStatusGap(context, frame.id, frame.source, frame.status, links);
    const x = numericFact(context, frame.descriptorFacts, 'x', frame.id, frame.source, links);
    const y = numericFact(context, frame.descriptorFacts, 'y', frame.id, frame.source, links);
    const width = numericFact(context, frame.descriptorFacts, 'width', frame.id, frame.source, links, true);
    const height = numericFact(context, frame.descriptorFacts, 'height', frame.id, frame.source, links, true);
    const layer = numericFact(context, frame.descriptorFacts, 'layer', frame.id, frame.source, links);
    const frameRect = x !== undefined && y !== undefined && width !== undefined && height !== undefined
      ? rect(x, y, width, height)
      : undefined;
    if (frameRect) frameRects.set(frame.id, frameRect);
    if (frameRect) frameClips.set(frame.id, intersectionOrEmpty(frameRect, drawable));
    const nodeLinks = [
      ...factLinks(frame.descriptorFacts, ['x', 'y', 'width', 'height', 'layer']),
      makeSourceLink('source-pin', frame.source),
    ];
    const frameSurface = frameTextureSurfaceFor(context, frame, frameRect, links);
    const completeness: X4UiSceneCompleteness = frameRect ? (links.length === 0 ? 'complete' : 'partial') : 'unavailable';
    frames.push({
      id: `scene:${frame.id}`,
      kind: 'frame',
      source: sourceCopy(frame.source),
      sourceOrder: sourceOrder(frame.source),
      ...(layer === undefined ? {} : { zOrder: layer, layer }),
      ...(frameRect ? { rect: frameRect, clipRect: frameClips.get(frame.id)! } : {}),
      completeness,
      provenance: 'source-derived',
      provenanceLinks: nodeLinks,
      diagnosticLinks: links,
      diagnosticStyle: diagnosticStyleForGeometry(Boolean(frameRect)),
      tableIds: frame.tableIds.map(id => `scene:${id}`),
      ...frameSurface,
    });
  }
  return { frames, frameRects, frameClips };
};

const adjustedColumnWidths = (
  context: BuildContext,
  table: X4UiLayoutTableNode,
  state: HelperTableState,
  hasScrollBar: boolean,
  reserveScrollBar: boolean,
  links: string[],
): number[] | undefined => {
  const widths = state.columns.map(column => column.width);
  if (widths.some(width => !isFiniteDimension(width))) {
    gapForChild(context, 'width', table.id, table.source, 'kernel column width is not finite and safe', links, 'refused');
    return undefined;
  }
  if (hasScrollBar && !reserveScrollBar) {
    const last = widths.length - 1;
    if (last < 0) return undefined;
    if (widths[last] >= state.metrics.scrollbarWidth) {
      widths[last] -= state.metrics.scrollbarWidth;
    } else {
      gapForChild(
        context,
        'width',
        table.id,
        table.source,
        'scrollbar is required but the rightmost column is not wide enough for the pinned scrollbar width',
        links,
        'unsupported',
      );
    }
  } else if (!hasScrollBar && reserveScrollBar) {
    let variableWeight = state.columns.reduce(
      (sum, column) => sum + (column.min && column.weight > 0 ? column.weight : 0),
      0,
    );
    if (variableWeight > 0) {
      let totalAdded = 0;
      for (let index = 0; index < state.columns.length; index += 1) {
        const column = state.columns[index];
        if (!column.min || column.weight <= 0) continue;
        const added = Math.ceil((state.metrics.scrollbarWidth - totalAdded) * column.weight / variableWeight);
        widths[index] += added;
        totalAdded += added;
        variableWeight -= column.weight;
        if (variableWeight <= 0) break;
      }
    }
  }
  return widths;
};

const buildColumns = (
  context: BuildContext,
  table: X4UiLayoutTableNode,
  state: HelperTableState,
  frameWidth: number,
  tableX: number,
  frameOriginX: number,
  hasScrollBar: boolean,
  reserveScrollBar: boolean,
  links: string[],
): { readonly columns: readonly X4UiSceneColumn[]; readonly fixedColumns: readonly X4UiSceneColumn[]; readonly width: number } | undefined => {
  const adjusted = adjustedColumnWidths(context, table, state, hasScrollBar, reserveScrollBar, links);
  if (!adjusted) return undefined;
  const borderTotal = (adjusted.length - 1) * state.metrics.borderSize;
  const insufficientRightmost = hasScrollBar && !reserveScrollBar && state.columns.length > 0 && state.columns[state.columns.length - 1].width < state.metrics.scrollbarWidth;
  // helper.lua finalizes from the requested table width. Only an exact zero
  // width falls back to the remaining frame edge; do not derive explicit
  // source tables from the parent frame's right edge.
  const tableWidth = state.properties.width === 0 ? frameWidth - tableX : state.properties.width;
  const maxWidth = tableWidth - (hasScrollBar && !insufficientRightmost ? state.metrics.scrollbarWidth : 0) - borderTotal;
  if (!isFiniteDimension(maxWidth)) {
    gapForChild(context, 'width', table.id, table.source, 'table has no finite drawable width after scrollbar and borders', links);
    return undefined;
  }
  const converted = convertColumnWidth(adjusted, false, maxWidth);
  if (converted.status !== 'ok') {
    gapForChild(context, 'width', table.id, table.source, converted.message, links, 'unsupported');
    return undefined;
  }
  const widths = converted.value.widths;
  const fixedWidths = [...widths];
  if (hasScrollBar && fixedWidths.length > 0) fixedWidths[fixedWidths.length - 1] += state.metrics.scrollbarWidth;
  const columns: X4UiSceneColumn[] = [];
  const fixedColumns: X4UiSceneColumn[] = [];
  let x = frameOriginX + tableX;
  let fixedX = frameOriginX + tableX;
  for (let index = 0; index < widths.length; index += 1) {
    const sourceLinks = [makeSourceLink('kernel-state', table.source)];
    columns.push({
      index: index + 1,
      x,
      width: widths[index],
      fixedWidth: fixedWidths[index],
      sourceOrder: sourceOrder(table.source),
      provenanceLinks: sourceLinks,
    });
    fixedColumns.push({
      index: index + 1,
      x: fixedX,
      width: fixedWidths[index],
      fixedWidth: fixedWidths[index],
      sourceOrder: sourceOrder(table.source),
      provenanceLinks: sourceLinks,
    });
    x += widths[index] + (index < widths.length - 1 ? state.metrics.borderSize : 0);
    fixedX += fixedWidths[index] + (index < widths.length - 1 ? state.metrics.borderSize : 0);
  }
  const width = safeArithmetic(widths.reduce((sum, value) => sum + value, 0) + borderTotal);
  if (width === undefined || !isFiniteDimension(width)) {
    gapForChild(context, 'width', table.id, table.source, 'converted table width is not finite and safe', links, 'refused');
    return undefined;
  }
  return { columns, fixedColumns, width };
};

const buildTableProjection = (
  context: BuildContext,
  table: X4UiLayoutTableNode,
  framesById: ReadonlyMap<string, X4UiLayoutFrameNode>,
  frameRects: ReadonlyMap<string, X4UiSceneRect>,
  frameClips: ReadonlyMap<string, X4UiSceneRect>,
  rowsById: ReadonlyMap<string, X4UiLayoutRowNode>,
): { readonly node: X4UiSceneTableNode; readonly projection: TableProjection } => {
  const links = linkProgramGaps(context, table.id);
  addNodeStatusGap(context, table.id, table.source, table.status, links);
  const frame = table.frameId
    ? framesById.get(table.frameId)
    : [...framesById.values()].find(candidate => candidate.tableIds.includes(table.id));
  const frameNodeId = frame ? `scene:${frame.id}` : undefined;
  const frameRect = frame ? frameRects.get(frame.id) : undefined;
  const frameClip = frame ? frameClips.get(frame.id) : undefined;
  if (!frame || !frameRect || !frameClip) gapForChild(context, 'table', table.id, table.source, 'table parent frame geometry is unavailable', links);
  const tableX = numericFact(context, table.descriptorFacts, 'x', table.id, table.source, links);
  const tableY = numericFact(context, table.descriptorFacts, 'y', table.id, table.source, links);
  const maxVisibleHeight = numericFact(context, table.descriptorFacts, 'maxVisibleHeight', table.id, table.source, links, true);
  const reserveFact = booleanFact(context, table.descriptorFacts, 'reserveScrollBar', table.id, table.source, links);
  const state = table.kernelState;
  const tableRows = table.rowIds.map(id => rowsById.get(id)).filter((row): row is X4UiLayoutRowNode => Boolean(row));
  const fixedCount = fixedCountFor(tableRows);
  if (fixedCount === undefined) {
    gapForChild(context, 'fixed-section', table.id, table.source, 'effective fixed-section membership is unavailable; fixed rows, scroll, and fixed-column geometry are not projected', links);
  }
  if (state && !state.final) addFinalizationGap(context, table, links);
  if (state && !sameProvenance(state.provenance)) gapForChild(context, 'source', table.id, table.source, 'table kernel provenance does not match the pinned X4 layout source', links, 'refused');
  if (state && sameProvenance(state.provenance)) projectKernelDiagnostics(context, table, state, links);
  const reserveScrollBar = state?.properties.reserveScrollBar ?? reserveFact;
  if (reserveScrollBar === undefined) gapForChild(context, 'table', table.id, table.source, 'reserveScrollBar decision is unavailable', links);
  const fullHeight = table.height?.status === 'known' && isFiniteDimension(table.height.value)
    ? table.height.value
    : table.height?.status === 'unavailable'
      ? undefined
      : state && canDeriveFullHeight(table, rowsById, state)
        ? (() => {
          const result = getFullTableHeight(state);
          return result.status === 'ok' && isFiniteDimension(result.value) ? result.value : undefined;
        })()
        : undefined;
  if (fullHeight === undefined) {
    if (table.height?.status === 'unavailable') {
      gapForChild(context, 'height', table.id, table.source, 'accepted table height fact is explicitly unavailable', links);
    } else {
      gapForChild(context, 'height', table.id, table.source, 'full table height is unavailable', links);
    }
  }
  let visibleHeight: number | undefined;
  let hasScrollBar: boolean | undefined;
  let tableRect: X4UiSceneRect | undefined;
  let viewportRect: X4UiSceneRect | undefined;
  let fixedViewportRect: X4UiSceneRect | undefined;
  let fixedRowWidth: number | undefined;
  let columns: readonly X4UiSceneColumn[] | undefined;
  let fixedColumns: readonly X4UiSceneColumn[] | undefined;
  if (frameRect && frameClip && tableX !== undefined && tableY !== undefined && maxVisibleHeight !== undefined && fullHeight !== undefined && reserveScrollBar !== undefined && state && state.final) {
    const availableHeight = safeArithmetic(frameRect.height - tableY);
    if (availableHeight === undefined) {
      gapForChild(context, 'height', table.id, table.source, 'frame height minus table y is not positive', links);
    } else {
      if (availableHeight <= 0) gapForChild(context, 'clip', table.id, table.source, 'table lies outside the parent frame; its known viewport intersection is empty', links, 'unsupported');
      const boundedMaxHeight = availableHeight > 0
        ? maxVisibleHeight > 0 && maxVisibleHeight < availableHeight ? maxVisibleHeight : availableHeight
        : fullHeight;
      hasScrollBar = boundedMaxHeight > 0 && fullHeight > boundedMaxHeight;
      gapForChild(
        context,
        'scrollbar',
        table.id,
        table.source,
        'runtime scrollbar acceptance and visibility remain unavailable beyond the helper descriptor projection',
        links,
        'unsupported',
      );
      visibleHeight = hasScrollBar ? boundedMaxHeight : fullHeight;
      const widthProjection = buildColumns(context, table, state, frameRect.width, tableX, frameRect.x, hasScrollBar, reserveScrollBar, links);
      if (widthProjection) {
        columns = widthProjection.columns;
        fixedColumns = widthProjection.fixedColumns;
        tableRect = rect(frameRect.x + tableX, frameRect.y + tableY, widthProjection.width, visibleHeight);
        viewportRect = intersectionOrEmpty(tableRect, frameClip);
        const lastFixedColumn = fixedColumns[fixedColumns.length - 1];
        fixedRowWidth = lastFixedColumn
          ? safeArithmetic(lastFixedColumn.x + lastFixedColumn.fixedWidth - tableRect.x)
          : tableRect.width;
        if (fixedRowWidth === undefined || !isFiniteDimension(fixedRowWidth)) {
          gapForChild(context, 'width', table.id, table.source, 'fixed-row width extension is unavailable', links, 'unsupported');
        } else {
          fixedViewportRect = intersectionOrEmpty(rect(tableRect.x, tableRect.y, fixedRowWidth, tableRect.height), frameClip);
        }
      }
    }
  } else if (state && !state.final) {
    // The pre-final kernel columns are source evidence only; no pixel geometry
    // may be derived until Helper's first successfully applied addRow freezes them.
  } else if (state && (maxVisibleHeight === undefined || fullHeight === undefined || reserveScrollBar === undefined)) {
    gapForChild(context, 'table', table.id, table.source, 'scrollbar decision is not complete; pre-descriptor widths are not reused', links);
  }
  const viewState = tableViewFor(context.profile, table.id);
  const explicitScrollOffset = viewState?.scrollOffset !== undefined;
  const discreteTopRow = !explicitScrollOffset;
  const rowIds = table.rowIds.map(id => `scene:${id}`);
  const rowNaturalContentTop = new Map<string, number>();
  const rowDisplayContentTop = new Map<string, number>();
  const rowVisible = new Map<string, boolean>();
  const rowNaturalRect = new Map<string, X4UiSceneRect>();
  const rowRect = new Map<string, X4UiSceneRect>();
  const rowLinks = new Map<string, readonly string[]>();
  let cursor = tableRect?.y;
  let cursorKnown = cursor !== undefined;
  const groupTopology = analyzeGroupTopology(tableRows, state);
  const defaultTopRow = fixedCount === undefined ? 1 : fixedCount + 1;
  const requestedTopRow = viewState?.topRow ?? defaultTopRow;
  const ownedRowCount = tableRows.length;
  const clampedRequestedTopRow = isSafeIntegerAtLeast(requestedTopRow, 1)
    ? Math.min(requestedTopRow, Math.max(ownedRowCount, 1))
    : defaultTopRow;
  const topRow = isSafeIntegerAtLeast(clampedRequestedTopRow, 1) ? Math.max(defaultTopRow, clampedRequestedTopRow) : defaultTopRow;
  let firstNormalNaturalTop: number | undefined;
  let requestedNormalNaturalTop: number | undefined;
  for (let index = 0; index < tableRows.length; index += 1) {
    const row = tableRows[index];
    const rowNodeLinks = linkProgramGaps(context, row.id);
    addNodeStatusGap(context, row.id, row.source, row.status, rowNodeLinks);
    const rowHeight = row.height?.status === 'known' && isFiniteDimension(row.height.value)
      ? row.height.value
      : undefined;
    const paddingTop = numericFact(context, row.descriptorFacts, 'paddingTop', row.id, row.source, rowNodeLinks, true);
    const paddingBottom = numericFact(context, row.descriptorFacts, 'paddingBottom', row.id, row.source, rowNodeLinks, true);
    const borderBelow = booleanFact(context, row.descriptorFacts, 'borderBelow', row.id, row.source, rowNodeLinks);
    const configuredFixed = booleanFact(context, row.descriptorFacts, 'fixed', row.id, row.source, rowNodeLinks);
    const fixed = isFixedSectionRow(row, index, fixedCount);
    void configuredFixed;
    if (rowHeight === undefined) gapForChild(context, 'row', row.id, row.source, 'row height is unavailable', rowNodeLinks);
    const rowState = rowStateFor(state, row.rowIndex);
    const group = state ? groupFor(state, rowState) : undefined;
    const previous = index > 0 ? tableRows[index - 1] : undefined;
    if (state && rowState?.groupIndex !== undefined && !group) gapForChild(context, 'row', row.id, row.source, 'row group identity is unavailable', rowNodeLinks);
    if (!cursorKnown) gapForChild(context, 'geometry', row.id, row.source, 'row y is unavailable because an earlier vertical contribution was unavailable', rowNodeLinks);
    if (groupTopology.blockedAt !== undefined && index >= groupTopology.blockedAt) {
      gapForChild(context, 'geometry', row.id, row.source, 'row y is unavailable because row-group topology is ambiguous without an accepted active-group stack', rowNodeLinks, 'unsupported');
      cursorKnown = false;
      rowLinks.set(row.id, rowNodeLinks);
      continue;
    }
    if (!cursorKnown || rowHeight === undefined || paddingTop === undefined || !tableRect) {
      cursorKnown = false;
      rowLinks.set(row.id, rowNodeLinks);
      continue;
    }
    if (group && (!previous || rowState?.groupIndex !== rowStateFor(state, previous.rowIndex)?.groupIndex)) {
      const opened = safeArithmetic(cursor + group.level * state.metrics.standardContainerOffset);
      if (opened === undefined) {
        cursorKnown = false;
        rowLinks.set(row.id, rowNodeLinks);
        continue;
      }
      cursor = opened;
    }
    const contentTop = cursor + paddingTop;
    if (fixed === false && firstNormalNaturalTop === undefined) firstNormalNaturalTop = contentTop;
    if (row.rowIndex === topRow) requestedNormalNaturalTop = contentTop;
    rowNaturalContentTop.set(row.id, contentTop);
    const rowWidth = fixed === true && fixedRowWidth !== undefined ? fixedRowWidth : tableRect.width;
    const natural = rect(tableRect.x, contentTop, rowWidth, rowHeight);
    rowNaturalRect.set(row.id, natural);
    if (fixed === false && firstNormalNaturalTop === undefined) firstNormalNaturalTop = contentTop;
    if (paddingBottom === undefined) {
      cursorKnown = false;
      rowLinks.set(row.id, rowNodeLinks);
      continue;
    }
    const blockHeight = safeArithmetic(paddingTop + rowHeight + paddingBottom);
    if (blockHeight === undefined || (index < tableRows.length - 1 && borderBelow === undefined)) {
      cursorKnown = false;
      rowLinks.set(row.id, rowNodeLinks);
      continue;
    }
    cursor += blockHeight;
    if (borderBelow && index < tableRows.length - 1 && state) cursor += state.metrics.borderSize;
    const next = tableRows[index + 1];
    if (group && (!next || rowStateFor(state, next.rowIndex)?.groupIndex !== rowState?.groupIndex)) {
      const closed = safeArithmetic(cursor + group.level * state.metrics.standardContainerOffset);
      if (closed === undefined) {
        cursorKnown = false;
        rowLinks.set(row.id, rowNodeLinks);
        continue;
      }
      cursor = closed;
    }
    rowLinks.set(row.id, rowNodeLinks);
  }
  const drawAcceptance = discreteTopRow && tableRect && state
    ? drawAcceptanceLedgerFor(tableRows, state, fixedCount, topRow, tableRect.height)
    : undefined;
  const derivedScrollOffset = fixedCount !== undefined && requestedNormalNaturalTop !== undefined && firstNormalNaturalTop !== undefined
    ? Math.max(0, requestedNormalNaturalTop - firstNormalNaturalTop)
    : 0;
  const normalStartCorrection = drawAcceptance?.normalStartOffset !== undefined && tableRect && firstNormalNaturalTop !== undefined
    ? firstNormalNaturalTop - (tableRect.y + drawAcceptance.normalStartOffset)
    : 0;
  const scrollOffset = viewState?.scrollOffset !== undefined ? viewState.scrollOffset : derivedScrollOffset + normalStartCorrection;
  for (const row of tableRows) {
    const natural = rowNaturalRect.get(row.id);
    const fixed = isFixedSectionRow(row, tableRows.indexOf(row), fixedCount);
    if (fixed === undefined) {
      const linksForRow = [...(rowLinks.get(row.id) || [])];
      gapForChild(context, 'fixed-section', row.id, row.source, 'row display y and fixed-column selection are unavailable because effective fixed-section membership is unknown', linksForRow);
      rowLinks.set(row.id, linksForRow);
      continue;
    }
    if (!natural || !tableRect) continue;
    const rowNumber = row.rowIndex ?? tableRows.indexOf(row) + 1;
    if (discreteTopRow && !fixed && rowNumber < topRow) {
      rowVisible.set(row.id, false);
      continue;
    }
    const acceptedBySource = discreteTopRow ? drawAcceptance?.accepted.get(row.id) : true;
    if (discreteTopRow && acceptedBySource !== true) {
      if (acceptedBySource === undefined) {
        const linksForRow = [...(rowLinks.get(row.id) || [])];
        gapForChild(context, 'geometry', row.id, row.source, 'row draw acceptance is unavailable because the source-order height ledger is incomplete', linksForRow, 'unsupported');
        rowLinks.set(row.id, linksForRow);
      }
      rowVisible.set(row.id, false);
      continue;
    }
    const displayY = fixed ? natural.y : natural.y - scrollOffset;
    const displayed = rect(natural.x, displayY, natural.width, natural.height);
    rowDisplayContentTop.set(row.id, displayY);
    rowRect.set(row.id, displayed);
    const visible = Boolean(viewportRect && intersection(displayed, viewportRect));
    rowVisible.set(row.id, visible);
  }
  const backgroundId = knownValue(table.descriptorFacts.backgroundID, 'string');
  const tableBackgroundEvidence = sceneColorFacts(table.descriptorFacts, [['backgroundColor', 'table-background']]);
  addUnavailableColorGap(context, `scene:${table.id}`, 'backgroundColor', table.descriptorFacts.backgroundColor, links);
  for (const colorFact of tableBackgroundEvidence) {
    addKnownColorUncertaintyGap(context, `scene:${table.id}`, colorFact.source, links, 'the table surface');
  }
  const tableCompleteness: X4UiSceneCompleteness = tableRect
    ? (links.length === 0 ? 'complete' : 'partial')
    : 'unavailable';
  const tableViewLinks = viewState?.scrollOffset !== undefined
    ? [makeSourceLink('preview-only', table.source, undefined, 'caller-supplied scrollOffset is preview-only and is not engine topRow truth')]
    : [];
  const topRowSourceLinks = !explicitScrollOffset
    ? [
      makeSourceLink('source-pin', table.source, { sourcePath: WIDGET_SOURCE_PATH, lineStart: 5942, lineEnd: 5966 }, 'widget_fullscreen.lua fixed/non-fixed draw ordering and default/explicit topRow'),
      makeSourceLink('source-pin', table.source, { sourcePath: WIDGET_SOURCE_PATH, lineStart: 6055, lineEnd: 6110 }, 'widget_fullscreen.lua drawTableSection row-height acceptance'),
      makeSourceLink('source-pin', table.source, { sourcePath: WIDGET_SOURCE_PATH, lineStart: 6429, lineEnd: 6434 }, 'widget_fullscreen.lua successful row-group section termination'),
    ]
    : [];
  const node: X4UiSceneTableNode = {
    id: `scene:${table.id}`,
    kind: 'table',
    parentId: frameNodeId,
    source: sourceCopy(table.source),
    sourceOrder: sourceOrder(table.source),
    ...(tableRect ? { rect: tableRect } : {}),
    ...(viewportRect ? { clipRect: fixedViewportRect || viewportRect, viewportRect } : {}),
    completeness: tableCompleteness,
    provenance: 'source-derived',
    ...(tableBackgroundEvidence.length > 0 ? { colorFacts: tableBackgroundEvidence } : {}),
    provenanceLinks: [
      ...factLinks(table.descriptorFacts, ['x', 'y', 'maxVisibleHeight', 'reserveScrollBar', 'finalWidth', 'backgroundID']),
      ...(state ? [makeSourceLink('kernel-state', table.source)] : []),
      ...(state && !state.final ? [makeSourceLink('source-pin', table.source, { sourcePath: X4_LAYOUT_PROVENANCE.helperSourcePath, lineStart: 4779, lineEnd: 4958 }, 'helper.lua finalizeTableColumnWidths and first addRow freeze boundary')] : []),
      ...tableViewLinks,
      ...topRowSourceLinks,
    ],
    diagnosticLinks: links,
    diagnosticStyle: diagnosticStyleForGeometry(Boolean(tableRect)),
    frameId: frameNodeId,
    rowIds,
    ...(backgroundId !== undefined && typeof backgroundId.value === 'string' ? { backgroundId: backgroundId.value } : {}),
    ...(columns ? { columns } : {}),
    ...(fixedColumns ? { fixedColumns } : {}),
    ...(fullHeight === undefined ? {} : { fullHeight }),
    ...(visibleHeight === undefined ? {} : { visibleHeight }),
    ...(maxVisibleHeight === undefined ? {} : { maxVisibleHeight }),
    ...(hasScrollBar === undefined ? {} : { descriptorHasScrollBar: hasScrollBar }),
    ...(hasScrollBar === undefined ? {} : { scrollbarEvidence: { descriptor: 'helper-derived' as const, runtime: 'unavailable' as const } }),
    ...(reserveScrollBar === undefined ? {} : { reserveScrollBar }),
    ...(viewState ? { viewState: tableViewStateCopy(viewState) } : {}),
    ...(tableRect && hasScrollBar && state ? {
      scrollbar: {
        rect: rect(tableRect.x + tableRect.width, tableRect.y, state.metrics.scrollbarWidth, tableRect.height),
        clipRect: frameClip
          ? intersectionOrEmpty(rect(tableRect.x + tableRect.width, tableRect.y, state.metrics.scrollbarWidth, tableRect.height), frameClip)
          : rect(tableRect.x + tableRect.width, tableRect.y, 0, 0),
        provenanceLinks: [makeSourceLink('kernel-state', table.source)],
        diagnosticStyle: STYLE,
      },
    } : {}),
  };
  return {
    node,
    projection: {
      table,
      state,
      frame,
      frameRect,
      rect: tableRect,
      viewportRect,
      fixedViewportRect,
      columns,
      fixedColumns,
      fullHeight,
      visibleHeight,
      maxVisibleHeight,
      hasScrollBar,
      reserveScrollBar,
      fixedCount,
      rowNaturalContentTop,
      rowDisplayContentTop,
      rowVisible,
      rowNaturalRect,
      rowRect,
      rowLinks,
      viewState,
    },
  };
};

const spanWidth = (
  state: HelperTableState,
  rowState: HelperTableState['rows'][number] | undefined,
  column: number,
  span: number,
  widths: readonly X4UiSceneColumn[],
  fixed: boolean,
): number | undefined => {
  if (column < 1 || span < 1 || column + span - 1 > widths.length) return undefined;
  let width = 0;
  for (let index = column; index <= column + span - 1; index += 1) {
    const entry = widths[index - 1];
    width += fixed ? entry.fixedWidth : entry.width;
    if (index < column + span - 1) width += state.metrics.borderSize;
  }
  const group = groupFor(state, rowState);
  if (group && column === 1) width -= group.level * state.metrics.standardContainerOffset;
  if (group && column + span - 1 === widths.length) width -= group.level * state.metrics.standardContainerOffset;
  return safeArithmetic(width);
};

const cellBackgroundWidthFor = (
  state: HelperTableState,
  rowState: HelperTableState['rows'][number] | undefined,
  column: number,
  span: number,
  cellWidth: number,
): number | undefined => {
  if (!rowState || column < 1 || span < 1 || column + span - 1 > state.columns.length) return undefined;
  const nextColumn = column + span;
  if (nextColumn <= state.columns.length) {
    const nextCell = rowState.cells[nextColumn - 1];
    if (!nextCell || !isSafeIntegerAtLeast(nextCell.bgcolspan, 0)) return undefined;
    if (nextCell.bgcolspan === 0) return safeArithmetic(cellWidth + state.metrics.borderSize);
  }
  return cellWidth;
};

const cellX = (
  tableProjection: TableProjection,
  rowState: HelperTableState['rows'][number] | undefined,
  column: number,
  fixed: boolean,
): number | undefined => {
  const columns = fixed ? tableProjection.fixedColumns : tableProjection.columns;
  if (!columns || column < 1 || column > columns.length) return undefined;
  const group = tableProjection.state ? groupFor(tableProjection.state, rowState) : undefined;
  const base = columns[column - 1].x;
  return base + (group && column === 1 ? group.level * tableProjection.state!.metrics.standardContainerOffset : 0);
};

const widgetTypeFromFact = (value: string | undefined): 'text' | 'button' | 'editbox' | 'icon' | undefined =>
  value === 'text' || value === 'button' || value === 'editbox' || value === 'icon' ? value : undefined;

interface TextBuildResult {
  readonly node: X4UiSceneTextNode;
  readonly glyphs: readonly X4UiSceneGlyphNode[];
}

const widgetOuterRect = (
  cellRect: X4UiSceneRect,
  widgetType: 'text' | 'button' | 'editbox' | 'icon',
  outerX: number,
  outerY: number,
  outerWidth: number,
  outerHeight: number,
): X4UiSceneRect => {
  const rowTopY = cellRect.y + outerY;
  if (widgetType === 'editbox') {
    return rect(cellRect.x + cellRect.width / 2 + outerX - outerWidth / 2, rowTopY, outerWidth, outerHeight);
  }
  if (widgetType === 'icon') {
    return rect(cellRect.x + outerX, cellRect.y + cellRect.height / 2 + outerY - outerHeight / 2, outerWidth, outerHeight);
  }
  return rect(cellRect.x + outerX, rowTopY, outerWidth, outerHeight);
};

const widgetSourceLinks = (
  source: X4UiSceneSourceLocation,
  widgetType: 'text' | 'button' | 'editbox' | 'icon',
): X4UiSceneProvenanceLink[] => {
  const pins = widgetType === 'text'
    ? [{ lineStart: 6243, lineEnd: 6243 }, { lineStart: 13140, lineEnd: 13173 }]
    : widgetType === 'button'
      ? [{ lineStart: 6279, lineEnd: 6279 }, { lineStart: 12135, lineEnd: 12176 }]
      : widgetType === 'editbox'
        ? [
          { lineStart: 6332, lineEnd: 6332 },
          { lineStart: 617, lineEnd: 634 },
          { lineStart: 848, lineEnd: 860 },
          { lineStart: 8702, lineEnd: 8727 },
          { lineStart: 9680, lineEnd: 9689 },
          { lineStart: 12603, lineEnd: 12730 },
          { lineStart: 12642, lineEnd: 12646 },
          { lineStart: 12673, lineEnd: 12686 },
          { lineStart: 12733, lineEnd: 12772 },
          { lineStart: 12774, lineEnd: 12782 },
          { lineStart: 12774, lineEnd: 12799 },
        ]
        : [{ lineStart: 6259, lineEnd: 6259 }, { lineStart: 17790, lineEnd: 17861 }];
  return pins.map(pin => makeSourceLink(
    'source-pin',
    source,
    { sourcePath: WIDGET_SOURCE_PATH, lineStart: pin.lineStart, lineEnd: pin.lineEnd },
    `widget_fullscreen.lua ${widgetType} table call/setup geometry`,
  ));
};

const factHasExactPin = (fact: X4UiLayoutDescriptorFact, pin: X4UiLayoutSourcePin): boolean =>
  fact.sourcePin?.sourcePath === pin.sourcePath
  && fact.sourcePin.lineStart === pin.lineStart
  && fact.sourcePin.lineEnd === pin.lineEnd;

const validEditBoxConfigBorderFact = (fact: X4UiLayoutDescriptorFact | undefined): 1 | undefined =>
  fact?.status === 'known'
    && fact.expectedType === 'number'
    && fact.value === EDITBOX_CONFIG_BORDER
    && fact.provenance === 'source-pinned-default'
    && fact.expression === 'config.editbox.border'
    && factHasExactPin(fact, EDITBOX_SOURCE_PINS.configBorder)
    ? EDITBOX_CONFIG_BORDER
    : undefined;

const validEditBoxTextBorderFact = (fact: X4UiLayoutDescriptorFact | undefined): 2 | undefined =>
  fact?.status === 'known'
    && fact.expectedType === 'number'
    && fact.value === EDITBOX_TEXT_BORDER
    && fact.provenance === 'source-pinned-default'
    && fact.expression === 'config.texturesizes.editbox.borderSize'
    && factHasExactPin(fact, EDITBOX_SOURCE_PINS.textBorder)
    ? EDITBOX_TEXT_BORDER
    : undefined;

const validEditBoxBlackInsetFact = (fact: X4UiLayoutDescriptorFact | undefined, uiScale: number): number | undefined => {
  if (fact?.status !== 'known'
    || fact.expectedType !== 'number'
    || typeof fact.value !== 'number'
    || fact.provenance !== 'source-pinned-default'
    || fact.expression !== 'max(2, floor(config.editbox.border * uiScale + 0.5))'
    || !factHasExactPin(fact, EDITBOX_SOURCE_PINS.blackInset)
    || !isFiniteSafe(uiScale)) return undefined;
  const expected = Math.max(EDITBOX_TEXT_BORDER, Math.floor(EDITBOX_CONFIG_BORDER * uiScale + 0.5));
  return Number.isSafeInteger(expected) && expected <= 1_000_000 && fact.value === expected
    ? fact.value
    : undefined;
};

const validEditBoxInitialInputActiveFact = (fact: X4UiLayoutDescriptorFact | undefined): false | undefined =>
  fact?.status === 'known'
    && fact.expectedType === 'boolean'
    && fact.value === false
    && fact.provenance === 'source-pinned-default'
    && fact.expression === 'initial setUpEditBox entry has no active direct-input flag'
    && factHasExactPin(fact, EDITBOX_SOURCE_PINS.initialInputActive)
    ? false
    : undefined;

const nestedTextNoWrapLinks = (source: X4UiSceneSourceLocation): X4UiSceneProvenanceLink[] => [
  makeSourceLink(
    'source-pin',
    source,
    { sourcePath: X4_LAYOUT_PROVENANCE.helperSourcePath, lineStart: 3417, lineEnd: 3427 },
    'helper.lua nested textproperty fields omit wordwrap',
  ),
  makeSourceLink(
    'source-pin',
    source,
    { sourcePath: X4_LAYOUT_PROVENANCE.helperSourcePath, lineStart: 3572, lineEnd: 3596 },
    'helper.lua createTextPropertyInfo does not expose wordwrap',
  ),
];

const isSupportedWrappingAlgorithm = (value: string): value is ZektonWrapMode =>
  value === 'word-wrap' || value === 'greedy-word';

const textPolicyFor = (
  profile: X4UiSceneProfile,
  assets: ZektonFontAssets,
  fontSize: number,
  maxWidth: number,
  wrapMode: ZektonWrapMode,
): ZektonTextLayoutProfile => ({
  descriptorIdentity: assets.descriptorIdentity,
  atlasIdentity: assets.atlasIdentity,
  nominalDesignSize: profile.textPolicy.nominalDesignSize,
  requestedFontSize: fontSize,
  maxWidth,
  lineSpacing: profile.textPolicy.lineSpacing,
  wrapMode,
  truncationMode: profile.textPolicy.truncationMode,
  whitespacePolicy: profile.textPolicy.whitespacePolicy,
  ellipsisPolicy: profile.textPolicy.ellipsisPolicy,
  newlinePolicy: profile.textPolicy.newlinePolicy,
  fallbackPolicy: 'gap',
  truthGrade: profile.textPolicy.truthGrade,
  evidenceState: profile.textPolicy.evidenceState,
});

const buildTextNode = (
  context: BuildContext,
  widgetId: string,
  widgetType: 'text' | 'button' | 'editbox' | 'icon',
  widgetRect: X4UiSceneRect,
  parentRect: X4UiSceneRect,
  viewportRect: X4UiSceneRect | undefined,
  cell: X4UiLayoutCellNode,
  slot: X4UiSceneTextSlot,
  operations: ReadonlyMap<string, X4UiLayoutOperation>,
  textIds: string[],
  widgetLinks: string[],
): TextBuildResult => {
  const contentName = slot === 'primary' ? 'text' : 'text2';
  const fontName = slot === 'primary' ? 'font' : 'text2Font';
  const sizeName = slot === 'primary' ? 'fontsize' : 'text2Fontsize';
  const alignName = slot === 'primary' ? 'halign' : 'text2Halign';
  const xName = widgetType === 'text'
    ? 'outerX'
    : slot === 'primary' ? 'textX' : 'text2X';
  const yName = widgetType === 'text'
    ? 'outerY'
    : slot === 'primary' ? 'textY' : 'text2Y';
  const contentFact = cell.descriptorFacts[contentName] || (slot === 'primary' ? cell.descriptorFacts.primaryContent : undefined);
  const textNodeId = `scene:text:${cell.id}:${slot}`;
  const links = [...new Set([...widgetLinks, ...linkProgramGaps(context, cell.id)])];
  const source = contentFact?.source || cell.source;
  const wordwrapFact = widgetType === 'text' ? cell.descriptorFacts.wordwrap : undefined;
  const nestedNoWrapLinks = widgetType === 'text' ? [] : nestedTextNoWrapLinks(source);
  let wrapMode: ZektonWrapMode = 'no-wrap';
  let wrapPolicyAvailable = true;
  if (widgetType === 'text') {
    if (wordwrapFact?.status === 'known' && wordwrapFact.expectedType === 'boolean' && typeof wordwrapFact.value === 'boolean') {
      if (wordwrapFact.value) {
        const profileWrapMode = context.profile.textPolicy.wrapMode as string;
        if (isSupportedWrappingAlgorithm(profileWrapMode)) wrapMode = profileWrapMode;
        else {
          wrapPolicyAvailable = false;
          gapForChild(context, 'text', textNodeId, source, 'plain wordwrap=true has no supported provisional wrapping algorithm', links);
        }
      }
    } else {
      wrapPolicyAvailable = false;
      gapForMissingFact(context, 'text', textNodeId, source, 'wordwrap', wordwrapFact, links);
    }
  }
  let content: string | undefined;
  if (contentFact?.status === 'known' && contentFact.expectedType === 'string' && typeof contentFact.value === 'string') content = contentFact.value;
  else gapForMissingFact(context, 'text', textNodeId, source, contentName, contentFact, links);
  const defaultFact = slot === 'primary' && widgetType === 'editbox' ? cell.descriptorFacts.defaultText : undefined;
  const descriptionFact = slot === 'primary' && widgetType === 'editbox' ? cell.descriptorFacts.description : undefined;
  const defaultContent = defaultFact?.status === 'known' && defaultFact.expectedType === 'string' && typeof defaultFact.value === 'string' ? defaultFact.value : undefined;
  const description = descriptionFact?.status === 'known' && descriptionFact.expectedType === 'string' && typeof descriptionFact.value === 'string' ? descriptionFact.value : undefined;
  const editBoxOperation = widgetType === 'editbox' && slot === 'primary'
    ? operationForCell(operations, cell, ['createEditBox'])
    : undefined;
  const editBoxDescriptorFacts = editBoxOperation?.descriptorFacts;
  const editBoxTextBorderFact = editBoxDescriptorFacts?.editboxTextBorder || cell.descriptorFacts.editboxTextBorder;
  const editBoxTextBorder = widgetType === 'editbox'
    ? validEditBoxTextBorderFact(editBoxTextBorderFact)
    : undefined;
  const editBoxInitialInputActiveFact = editBoxDescriptorFacts?.editboxInitialInputActive || cell.descriptorFacts.editboxInitialInputActive;
  const editBoxInitialInputActive = widgetType === 'editbox'
    ? validEditBoxInitialInputActiveFact(editBoxInitialInputActiveFact)
    : undefined;
  const editBoxPreviewInputState = widgetType === 'editbox'
    ? editBoxInitialInputActive === false ? 'source-initial-inactive' as const : 'runtime-unknown' as const
    : undefined;
  const previewTextColorDescriptorFact = widgetType === 'editbox' && slot === 'primary'
    ? editBoxDescriptorFacts?.defaultTextColor || cell.descriptorFacts.defaultTextColor
    : undefined;
  const previewTextColorFact = sceneColorFact('defaultTextColor', 'primary-text', previewTextColorDescriptorFact);
  let contentSelection: X4UiSceneTextNode['contentSelection'] = content === undefined ? 'unavailable' : 'current';
  let runtimeChoiceUnavailable = false;
  let previewDefaultSelection = false;
  if (widgetType === 'editbox' && slot === 'primary' && content === '') {
    if (editBoxInitialInputActive === false) {
      previewDefaultSelection = true;
      contentSelection = 'preview-default';
      if (defaultContent === undefined) gapForMissingFact(context, 'text', textNodeId, source, 'defaultText', defaultFact, links);
    } else {
      runtimeChoiceUnavailable = true;
      contentSelection = 'runtime-choice-unavailable';
      gapForChild(context, 'text', textNodeId, source, 'edit-box current text is empty but the accepted source-composition input does not prove the initial inactive direct-input branch; descriptor active is only widget configuration, so live active/focus state is not guessed', links, 'unknown');
    }
  }
  const textColorDescriptorFact = previewDefaultSelection
    ? previewTextColorDescriptorFact
    : widgetType === 'text' && slot === 'primary'
      ? cell.descriptorFacts.color
      : operationForCell(operations, cell, [slot === 'primary' ? 'setText' : 'setText2'])?.descriptorFacts.color;
  const textColorFact = previewDefaultSelection
    ? previewTextColorFact
    : sceneColorFact('color', slot === 'primary' ? 'primary-text' : 'secondary-text', textColorDescriptorFact);
  addUnavailableColorGap(context, textNodeId, previewDefaultSelection ? 'defaultTextColor' : 'color', textColorDescriptorFact, links);
  if (textColorFact) addKnownColorUncertaintyGap(context, textNodeId, textColorFact.source, links, 'font raster color');
  if (widgetType === 'editbox' && editBoxTextBorder === undefined) {
    gapForMissingFact(context, 'geometry', textNodeId, source, 'editboxTextBorder', editBoxTextBorderFact, links);
  }
  const previewSourceLink = previewDefaultSelection
    ? makeSourceLink(
      'preview-only',
      defaultFact?.source || source,
      { sourcePath: WIDGET_SOURCE_PATH, lineStart: 12774, lineEnd: 12799 },
      'widget_fullscreen.lua setEditBoxText selects defaultText for inactive-empty edit-box preview',
    )
    : undefined;
  const fontFact = cell.descriptorFacts[fontName];
  const sizeFact = cell.descriptorFacts[sizeName];
  const alignFact = cell.descriptorFacts[alignName];
  const offsetXFact = cell.descriptorFacts[xName];
  const offsetYFact = cell.descriptorFacts[yName];
  const font = fontFact?.status === 'known' && fontFact.expectedType === 'string' && typeof fontFact.value === 'string'
    ? fontFact.value
    : undefined;
  if (font === undefined) gapForMissingFact(context, 'text', textNodeId, source, fontName, fontFact, links);
  const fontSize = knownValue(sizeFact, 'number');
  if (!fontSize || !Number.isSafeInteger(fontSize.value) || (fontSize.value as number) <= 0) gapForMissingFact(context, 'text', textNodeId, source, sizeName, sizeFact, links);
  const alignment = alignFact?.status === 'known' && alignFact.expectedType === 'string' && (alignFact.value === 'left' || alignFact.value === 'center' || alignFact.value === 'right')
    ? alignFact.value as 'left' | 'center' | 'right'
    : undefined;
  if (alignment !== 'left' && alignment !== 'center' && alignment !== 'right') gapForMissingFact(context, 'text', textNodeId, source, alignName, alignFact, links);
  const offsetX = knownValue(offsetXFact, 'number');
  const offsetY = knownValue(offsetYFact, 'number');
  if (!offsetX || !isFiniteSafe(offsetX.value)) gapForMissingFact(context, 'text', textNodeId, source, xName, offsetXFact, links);
  if (!offsetY || !isFiniteSafe(offsetY.value)) gapForMissingFact(context, 'text', textNodeId, source, yName, offsetYFact, links);
  let availableWidth: number | undefined;
  if (widgetType === 'text') {
    availableWidth = widgetRect.width;
  } else if (widgetType === 'icon') {
    availableWidth = parentRect.width;
  } else if (offsetX) {
    const textOffsetX = offsetX.value as number;
    if (widgetType === 'button') {
      availableWidth = safeArithmetic(widgetRect.width - textOffsetX);
    } else {
      availableWidth = editBoxTextBorder === undefined
        ? undefined
        : safeArithmetic(widgetRect.width - 2 * (textOffsetX + editBoxTextBorder));
    }
  }
  if (availableWidth === undefined || !isFiniteDimension(availableWidth)) gapForChild(context, 'text', textNodeId, source, 'text available width is unavailable', links);
  const textClip = viewportRect || widgetRect;
  let layout: ZektonTextLayout | undefined;
  const glyphs: X4UiSceneGlyphNode[] = [];
  const lines: X4UiSceneTextLine[] = [];
  const textGapIds: string[] = [];
  const validFont = font === 'Zekton' || font === 'Zekton Bold';
  if (!validFont && font !== undefined) gapForChild(context, 'font', textNodeId, source, `unsupported text font ${font}`, links, 'unsupported');
  const assets = validFont ? context.assets[font] : undefined;
  const displayContent = previewDefaultSelection ? defaultContent : content;
  if (!runtimeChoiceUnavailable && wrapPolicyAvailable && displayContent !== undefined && assets && fontSize && Number.isSafeInteger(fontSize.value) && alignment && availableWidth !== undefined && offsetX && offsetY) {
    const profile = textPolicyFor(context.profile, assets, fontSize.value as number, availableWidth, wrapMode);
    const result: ZektonTextLayoutResult = layoutZektonText(assets, displayContent, profile);
    if (result.ok === false) {
      gapForChild(context, 'text', textNodeId, source, result.error.message, links, 'unsupported');
    } else {
      layout = result.value;
      for (const gap of layout.gaps) {
        const gapId = addGap(context, {
          category: 'text',
          status: gap.reason === 'overflow' ? 'unsupported' : 'unknown',
          reason: gap.message,
          source: sourceCopy(source),
          nodeId: textNodeId,
          textRange: cloneData(gap.sourceRange) as { readonly start: number; readonly end: number },
          lineIndex: gap.lineIndex,
        });
        textGapIds.push(gapId);
        links.push(gapId);
      }
      if (layout.lines.some(line => line.breakReason === 'word-wrap' || line.breakReason === 'codepoint-wrap' || line.breakReason === 'truncated' || line.truncated || line.overflow)) {
        const policyGap = addGap(context, {
          category: 'text',
          status: 'incomplete',
          reason: 'wrap or truncation remains provisional-until-game-parity',
          source: sourceCopy(source),
          nodeId: textNodeId,
          previewOnly: true,
        });
        textGapIds.push(policyGap);
        links.push(policyGap);
      }
      for (const line of layout.lines) {
        const xValue = offsetX.value as number;
        let xAnchor: number;
        let subtractLineWidth = false;
        let subtractHalfLineWidth = false;
        if (widgetType === 'text') {
          if (alignment === 'left') xAnchor = parentRect.x + xValue;
          else if (alignment === 'right') {
            xAnchor = parentRect.x + parentRect.width - xValue;
            subtractLineWidth = true;
          } else {
            xAnchor = parentRect.x + parentRect.width / 2 + xValue / 2;
            if (xAnchor % 1 !== 0) xAnchor -= 0.5;
            subtractHalfLineWidth = true;
          }
        } else if (widgetType === 'icon') {
          if (alignment === 'left') xAnchor = parentRect.x + xValue;
          else if (alignment === 'right') {
            xAnchor = parentRect.x + parentRect.width - xValue;
            subtractLineWidth = true;
          } else {
            xAnchor = parentRect.x + xValue;
            subtractHalfLineWidth = true;
          }
        } else {
          const borderSize = widgetType === 'editbox' ? editBoxTextBorder! : BUTTON_BORDER_SIZE;
          const localAnchor = alignment === 'left'
            ? xValue - widgetRect.width / 2 + borderSize
            : alignment === 'right'
              ? -xValue + widgetRect.width / 2 - borderSize
              : 0;
          xAnchor = widgetRect.x + widgetRect.width / 2 + localAnchor;
          if (alignment === 'right') subtractLineWidth = true;
          if (alignment === 'center') subtractHalfLineWidth = true;
        }
        const xBase = xAnchor! - (subtractLineWidth ? line.width : subtractHalfLineWidth ? line.width / 2 : 0);
        const yAnchor = widgetType === 'text'
          ? parentRect.y + parentRect.height / 2 - (offsetY.value as number)
          : widgetType === 'icon'
            ? parentRect.y + parentRect.height / 2 - widgetRect.height / 2 + (offsetY.value as number)
            : widgetRect.y + widgetRect.height / 2 - (offsetY.value as number);
        const yBase = yAnchor - line.lineBox.height / 2;
        const lineRect = rect(xBase + line.lineBox.x, yBase + line.lineBox.y, line.width, line.lineBox.height);
        const lineGlyphIds: string[] = [];
        for (let glyphIndex = 0; glyphIndex < line.glyphQuads.length; glyphIndex += 1) {
          const quad = line.glyphQuads[glyphIndex];
          const glyphId = `${textNodeId}:line:${line.lineIndex}:glyph:${glyphIndex}`;
          lineGlyphIds.push(glyphId);
          glyphs.push({
            id: glyphId,
            kind: 'glyph',
            parentId: textNodeId,
            source: sourceCopy(source),
            sourceOrder: sourceOrder(source),
            rect: rect(xBase + quad.x, yBase + quad.y, quad.width, quad.height),
            clipRect: clipRectFor(rect(xBase + quad.x, yBase + quad.y, quad.width, quad.height), textClip),
            completeness: textGapIds.length === 0 ? 'complete' : 'partial',
            provenance: 'font-metrics',
            provenanceLinks: [{
              kind: 'font-metrics',
              source: sourceCopy(source),
              expression: `${font} Zekton glyph ${quad.glyphIndex}`,
            }, ...(previewSourceLink ? [previewSourceLink] : [])],
            diagnosticLinks: textGapIds,
            diagnosticStyle: STYLE,
            textId: textNodeId,
            lineIndex: line.lineIndex,
            sourceRange: cloneData(quad.sourceRange) as { readonly start: number; readonly end: number },
            sourceCodePointRange: cloneData(quad.sourceCodePointRange) as { readonly start: number; readonly end: number },
            codePoint: quad.codePoint,
            glyphIndex: quad.glyphIndex,
            quad: {
              x: xBase + quad.x,
              y: yBase + quad.y,
              width: quad.width,
              height: quad.height,
              bitmapHeight: quad.bitmapHeight,
              lineBoxY: yBase + quad.lineBoxY,
              lineBoxHeight: quad.lineBoxHeight,
              bearingX: quad.bearingX,
              bitmapWidth: quad.bitmapWidth,
              advance: quad.advance,
              scaledAdvance: quad.scaledAdvance,
              bitmapBounds: cloneData(quad.bitmapBounds) as X4UiSceneGlyphNode['quad']['bitmapBounds'],
              uv: cloneData(quad.uv) as X4UiSceneGlyphNode['quad']['uv'],
              isEllipsis: quad.isEllipsis,
            },
          });
        }
        lines.push({
          lineIndex: line.lineIndex,
          displayedText: line.displayedText,
          rect: lineRect,
          width: line.width,
          sourceRange: cloneData(line.sourceRange) as { readonly start: number; readonly end: number },
          sourceCodePointRange: cloneData(line.sourceCodePointRange) as { readonly start: number; readonly end: number },
          breakReason: line.breakReason,
          truncated: line.truncated,
          overflow: line.overflow,
          completeness: textGapIds.length === 0 ? 'complete' : 'partial',
          diagnosticLinks: [...textGapIds],
          glyphIds: lineGlyphIds,
        });
      }
      const explicitHeightFact = cell.descriptorFacts.outerHeight;
      const explicitInputHeight = cell.kernelState?.height;
      const hasExplicitNonzeroHeight = typeof explicitInputHeight === 'number'
        ? Number.isFinite(explicitInputHeight) && explicitInputHeight > 0
        : true;
      const explicitHeight = explicitHeightFact?.status === 'known'
        && explicitHeightFact.expectedType === 'number'
        && typeof explicitHeightFact.value === 'number'
        && Number.isFinite(explicitHeightFact.value)
        && explicitHeightFact.value > 0
        && hasExplicitNonzeroHeight
        ? explicitHeightFact.value
        : undefined;
      if (widgetType === 'text' && slot === 'primary' && explicitHeight !== undefined && lines.length > 0) {
        const lineMinY = Math.min(...lines.map(line => line.rect.y));
        const lineMaxY = Math.max(...lines.map(line => line.rect.y + line.rect.height));
        const requiredHeight = lineMaxY - lineMinY;
        const spanHeightExcess = Math.max(0, requiredHeight - widgetRect.height);
        const widgetMaxY = widgetRect.y + widgetRect.height;
        const topOverflow = Math.max(0, widgetRect.y - lineMinY);
        const bottomOverflow = Math.max(0, lineMaxY - widgetMaxY);
        const totalOverflow = topOverflow + bottomOverflow;
        if (topOverflow > 0 || bottomOverflow > 0) {
          const gapId = addGap(context, {
            category: 'height',
            status: 'unknown',
            reason: `un-clipped issued text line geometry exceeds the explicit widget rectangle: issued line bounds y=${formatSceneDiagnosticPixels(lineMinY)}..${formatSceneDiagnosticPixels(lineMaxY)} px, widget bounds y=${formatSceneDiagnosticPixels(widgetRect.y)}..${formatSceneDiagnosticPixels(widgetMaxY)} px, top overflow ${formatSceneDiagnosticPixels(topOverflow)} px, bottom overflow ${formatSceneDiagnosticPixels(bottomOverflow)} px, total overflow ${formatSceneDiagnosticPixels(totalOverflow)} px; required ${formatSceneDiagnosticPixels(requiredHeight)} px, available ${formatSceneDiagnosticPixels(widgetRect.height)} px, span-height excess ${formatSceneDiagnosticPixels(spanHeightExcess)} px; native clipping/overlap remains unverified`,
            source: sourceCopy(explicitHeightFact.source),
            ...(explicitHeightFact.expression ? { expression: explicitHeightFact.expression } : {}),
            ...(explicitHeightFact.sourcePin ? { sourcePin: sourcePinCopy(explicitHeightFact.sourcePin) } : {}),
            nodeId: textNodeId,
          });
          textGapIds.push(gapId);
          links.push(gapId);
        }
      }
    }
  }
  if (layout) {
    const lineRects = lines.map(line => line.rect);
    const bounds = lineRects.length > 0
      ? (() => {
        const minX = Math.min(...lineRects.map(line => line.x));
        const minY = Math.min(...lineRects.map(line => line.y));
        const maxX = Math.max(...lineRects.map(line => line.x + line.width));
        const maxY = Math.max(...lineRects.map(line => line.y + line.height));
        return rect(minX, minY, maxX - minX, maxY - minY);
      })()
      : undefined;
    const completeness: X4UiSceneCompleteness = links.length === 0 ? 'complete' : 'partial';
    const node: X4UiSceneTextNode = {
      id: textNodeId,
      kind: 'text',
      parentId: widgetId,
      source: sourceCopy(source),
      sourceOrder: sourceOrder(source),
      ...(bounds ? { rect: bounds } : {}),
      clipRect: textClip,
      completeness,
      provenance: previewDefaultSelection ? 'preview-only' : 'font-metrics',
      ...(textColorFact ? { colorFacts: [textColorFact] } : {}),
      provenanceLinks: [
        ...(wordwrapFact?.status === 'known' ? [factProvenanceLink('wordwrap', wordwrapFact)] : []),
        ...nestedNoWrapLinks,
        ...(fontFact?.status === 'known' ? [factProvenanceLink(fontName, fontFact)] : []),
        ...(sizeFact?.status === 'known' ? [factProvenanceLink(sizeName, sizeFact)] : []),
        ...(alignFact?.status === 'known' ? [factProvenanceLink(alignName, alignFact)] : []),
        ...(editBoxTextBorderFact?.status === 'known' ? [factProvenanceLink('editboxTextBorder', editBoxTextBorderFact)] : []),
        ...(editBoxInitialInputActiveFact?.status === 'known' ? [factProvenanceLink('editboxInitialInputActive', editBoxInitialInputActiveFact)] : []),
        ...(previewDefaultSelection && defaultFact?.status === 'known' ? [factProvenanceLink('defaultText', defaultFact)] : []),
        ...(previewSourceLink ? [previewSourceLink] : []),
        makeSourceLink('font-metrics', source),
        makeSourceLink(
          'source-pin',
          source,
          widgetType === 'text'
            ? { sourcePath: WIDGET_SOURCE_PATH, lineStart: 13140, lineEnd: 13173 }
            : widgetType === 'button'
              ? { sourcePath: WIDGET_SOURCE_PATH, lineStart: 12135, lineEnd: 12176 }
              : widgetType === 'editbox'
                ? { sourcePath: WIDGET_SOURCE_PATH, lineStart: 12673, lineEnd: 12782 }
                : { sourcePath: WIDGET_SOURCE_PATH, lineStart: 17790, lineEnd: 17861 },
          widgetType === 'text'
            ? 'widget_fullscreen.lua setUpFontString parent anchor and alignment'
            : widgetType === 'button'
              ? 'widget_fullscreen.lua setUpButton local text anchor and border'
              : widgetType === 'editbox'
                ? 'widget_fullscreen.lua setUpEditBox text anchor and border'
                : 'widget_fullscreen.lua updateIcon text anchor and alignment',
        ),
      ],
      diagnosticLinks: links,
      diagnosticStyle: diagnosticStyleForGeometry(Boolean(bounds)),
      widgetId,
      slot,
      content,
      ...(defaultContent === undefined ? {} : { defaultContent }),
      ...(description === undefined ? {} : { description }),
      contentSelection,
      ...(editBoxPreviewInputState === undefined ? {} : { editboxPreviewInputState: editBoxPreviewInputState }),
      ...(editBoxTextBorder === undefined ? {} : { editboxTextBorder: editBoxTextBorder }),
      font: font as 'Zekton' | 'Zekton Bold',
      fontSize: fontSize!.value as number,
      alignment,
      offsetX: offsetX!.value as number,
      offsetY: offsetY!.value as number,
      availableWidth: availableWidth!,
      lines,
      layout,
      textGaps: textGapIds,
      evidence: layout.evidence,
    };
    textIds.push(textNodeId);
    return { node, glyphs };
  }
  const fallbackNode: X4UiSceneTextNode = {
    id: textNodeId,
    kind: 'text',
    parentId: widgetId,
    source: sourceCopy(source),
    sourceOrder: sourceOrder(source),
    clipRect: textClip,
    completeness: 'unavailable',
    provenance: previewDefaultSelection ? 'preview-only' : 'unavailable',
    ...(textColorFact ? { colorFacts: [textColorFact] } : {}),
    provenanceLinks: [
      ...(wordwrapFact?.status === 'known' ? [factProvenanceLink('wordwrap', wordwrapFact)] : []),
      ...nestedNoWrapLinks,
      ...(editBoxTextBorderFact?.status === 'known' ? [factProvenanceLink('editboxTextBorder', editBoxTextBorderFact)] : []),
      ...(editBoxInitialInputActiveFact?.status === 'known' ? [factProvenanceLink('editboxInitialInputActive', editBoxInitialInputActiveFact)] : []),
      ...(previewDefaultSelection && defaultFact?.status === 'known' ? [factProvenanceLink('defaultText', defaultFact)] : []),
      ...(previewSourceLink ? [previewSourceLink] : []),
      makeSourceLink('descriptor-fact', source),
    ],
    diagnosticLinks: links,
    diagnosticStyle: diagnosticStyleForGeometry(Boolean(widgetRect)),
    widgetId,
    slot,
    ...(content === undefined ? {} : { content }),
    ...(defaultContent === undefined ? {} : { defaultContent }),
    ...(description === undefined ? {} : { description }),
    contentSelection,
    ...(editBoxPreviewInputState === undefined ? {} : { editboxPreviewInputState: editBoxPreviewInputState }),
    ...(editBoxTextBorder === undefined ? {} : { editboxTextBorder: editBoxTextBorder }),
    ...(validFont && font !== undefined ? { font: font as 'Zekton' | 'Zekton Bold' } : {}),
    ...(fontSize && Number.isSafeInteger(fontSize.value) && (fontSize.value as number) > 0 ? { fontSize: fontSize.value as number } : {}),
    ...(alignment === 'left' || alignment === 'center' || alignment === 'right' ? { alignment } : {}),
    ...(offsetX && isFiniteSafe(offsetX.value) ? { offsetX: offsetX.value as number } : {}),
    ...(offsetY && isFiniteSafe(offsetY.value) ? { offsetY: offsetY.value as number } : {}),
    ...(availableWidth === undefined ? {} : { availableWidth }),
    lines,
    textGaps: textGapIds,
    evidence: {
      metrics: 'unavailable',
      wrapAndTruncationPolicy: ZEKTON_EVIDENCE_STATE,
      gameParity: 'not-verified',
    },
  };
  textIds.push(textNodeId);
  return { node: fallbackNode, glyphs };
};

const buildRowAndCellNodes = (
  context: BuildContext,
  tableProjection: TableProjection,
  rowsById: ReadonlyMap<string, X4UiLayoutRowNode>,
  cellsById: ReadonlyMap<string, X4UiLayoutCellNode>,
  operations: ReadonlyMap<string, X4UiLayoutOperation>,
): {
  readonly rows: readonly X4UiSceneRowNode[];
  readonly cells: readonly X4UiSceneCellNode[];
  readonly widgets: readonly X4UiSceneWidgetNode[];
  readonly texts: readonly X4UiSceneTextNode[];
  readonly glyphs: readonly X4UiSceneGlyphNode[];
} => {
  const rows: X4UiSceneRowNode[] = [];
  const cells: X4UiSceneCellNode[] = [];
  const widgets: X4UiSceneWidgetNode[] = [];
  const texts: X4UiSceneTextNode[] = [];
  const glyphs: X4UiSceneGlyphNode[] = [];
  const table = tableProjection.table;
  const state = tableProjection.state;
  for (const rowId of table.rowIds) {
    const row = rowsById.get(rowId);
    if (!row) continue;
    const rowNodeId = `scene:${row.id}`;
    const links = [...(tableProjection.rowLinks.get(row.id) || [])];
    const rowRect = tableProjection.rowRect.get(row.id);
    const naturalRect = tableProjection.rowNaturalRect.get(row.id);
    const effectiveFixed = isFixedSectionRow(row, table.rowIds.indexOf(row.id), tableProjection.fixedCount);
    const rowViewport = effectiveFixed === true ? tableProjection.fixedViewportRect : tableProjection.viewportRect;
    const rowClip = rowViewport
      ? rowRect
        ? clipRectFor(rowRect, rowViewport)
        : rect(rowViewport.x, rowViewport.y, 0, 0)
      : undefined;
    const fixed = row.descriptorFacts.fixed?.status === 'known' ? row.descriptorFacts.fixed.value as boolean : undefined;
    const visible = tableProjection.rowVisible.get(row.id);
    const completeness: X4UiSceneCompleteness = rowRect ? (links.length === 0 ? 'complete' : 'partial') : 'unavailable';
    rows.push({
      id: rowNodeId,
      kind: 'row',
    parentId: `scene:${table.id}`,
    source: sourceCopy(row.source),
    sourceOrder: sourceOrder(row.source),
    ...(rowRect ? { rect: rowRect } : {}),
      ...(rowClip ? { clipRect: rowClip } : {}),
      ...(naturalRect ? { naturalRect } : {}),
      completeness,
      provenance: 'source-derived',
      provenanceLinks: [
        ...factLinks(row.descriptorFacts, ['paddingTop', 'paddingBottom', 'borderBelow', 'fixed']),
        ...(state ? [makeSourceLink('kernel-state', row.source)] : []),
      ],
      diagnosticLinks: links,
      diagnosticStyle: diagnosticStyleForGeometry(Boolean(rowRect)),
      tableId: `scene:${table.id}`,
      ...(row.rowIndex === undefined ? {} : { rowIndex: row.rowIndex }),
      cellIds: row.cellIds.map(id => `scene:${id}`),
      ...(fixed === undefined ? {} : { fixed }),
      ...(visible === undefined ? {} : { visible }),
      ...(row.descriptorFacts.paddingTop?.status === 'known' ? { paddingTop: row.descriptorFacts.paddingTop.value as number } : {}),
      ...(row.descriptorFacts.paddingBottom?.status === 'known' ? { paddingBottom: row.descriptorFacts.paddingBottom.value as number } : {}),
      ...(row.descriptorFacts.borderBelow?.status === 'known' ? { borderBelow: row.descriptorFacts.borderBelow.value as boolean } : {}),
    });
    for (const cellId of row.cellIds) {
      const cell = cellsById.get(cellId);
      if (!cell) continue;
      const cellNodeId = `scene:${cell.id}`;
      const cellLinks = [...linkProgramGaps(context, cell.id)];
      addNodeStatusGap(context, cell.id, cell.source, cell.status, cellLinks);
      const cellState = cellStateFor(state, row.rowIndex, cell.column);
      const rowState = rowStateFor(state, row.rowIndex);
      const spanFact = knownValue(cell.descriptorFacts.span, 'number');
      const spanCandidate = spanFact && Number.isSafeInteger(spanFact.value) ? spanFact.value as number : cellState?.colspan;
      const span = spanCandidate !== undefined && Number.isSafeInteger(spanCandidate) && spanCandidate >= 0 ? spanCandidate : undefined;
      if (span === undefined) gapForMissingFact(context, 'span', cell.id, cell.source, 'span', cell.descriptorFacts.span, cellLinks);
      const hidden = span === undefined ? undefined : span === 0;
      let cellRect: X4UiSceneRect | undefined;
      let naturalCellRect: X4UiSceneRect | undefined;
      if (hidden !== true && span !== undefined && tableProjection.columns && tableProjection.fixedColumns && state && rowRect && naturalRect && tableProjection.hasScrollBar !== undefined && tableProjection.reserveScrollBar !== undefined) {
        const fixedRow = isFixedSectionRow(row, table.rowIds.indexOf(row.id), tableProjection.fixedCount);
        if (fixedRow === undefined) {
          gapForChild(context, 'fixed-section', cell.id, cell.source, 'cell column selection is unavailable because effective fixed-section membership is unknown', cellLinks);
        } else {
          const columns = fixedRow ? tableProjection.fixedColumns : tableProjection.columns;
          const x = cellX(tableProjection, rowState, cell.column, fixedRow);
          const naturalX = cellX(tableProjection, rowState, cell.column, fixedRow);
          const width = spanWidth(state, rowState, cell.column, span, columns, fixedRow);
          if (x !== undefined && width !== undefined) {
            const naturalY = naturalRect.y;
            const displayY = rowRect.y;
            naturalCellRect = rect(x, naturalY, width, naturalRect.height);
            cellRect = rect(x, displayY, width, rowRect.height);
            void naturalX;
          } else gapForChild(context, 'cell', cell.id, cell.source, 'cell span or column geometry is unavailable', cellLinks);
        }
      } else if (hidden !== true) {
        gapForChild(context, 'cell', cell.id, cell.source, 'cell parent row/table geometry is unavailable', cellLinks);
      }
      const cellColorFacts = sceneColorFacts(cell.descriptorFacts, [['cellbgcolor', 'cell-background']]);
      addUnavailableColorGap(context, cellNodeId, 'cellbgcolor', cell.descriptorFacts.cellbgcolor, cellLinks);
      for (const colorFact of cellColorFacts) {
        addKnownColorUncertaintyGap(context, cellNodeId, colorFact.source, cellLinks, 'the cell surface');
      }
      const widgetIds: string[] = [];
      const contentKind = cell.descriptorFacts.contentKind?.status === 'known' && typeof cell.descriptorFacts.contentKind.value === 'string'
        ? cell.descriptorFacts.contentKind.value
        : undefined;
      const widgetType = widgetTypeFromFact(contentKind);
      if (hidden !== true && contentKind !== undefined && widgetType === undefined && contentKind !== 'cell') {
        gapForChild(context, 'widget', cell.id, cell.source, `unsupported cell content kind ${contentKind}`, cellLinks, 'unsupported');
      }
      if (hidden !== true && widgetType && cellRect) {
        const operation = operationForCell(operations, cell, [`create${widgetType === 'editbox' ? 'EditBox' : widgetType[0].toUpperCase() + widgetType.slice(1)}`]);
        const outerX = numericFact(context, cell.descriptorFacts, 'outerX', cell.id, cell.source, cellLinks);
        const outerY = numericFact(context, cell.descriptorFacts, 'outerY', cell.id, cell.source, cellLinks);
        const outerWidth = numericFact(context, cell.descriptorFacts, 'outerWidth', cell.id, cell.source, cellLinks, true, true);
        const outerHeight = numericFact(context, cell.descriptorFacts, 'outerHeight', cell.id, cell.source, cellLinks, true);
        if (outerX !== undefined && outerY !== undefined && outerWidth !== undefined && outerHeight !== undefined) {
          const backgroundWidth = state
            ? cellBackgroundWidthFor(state, rowState, cell.column, span || 1, cellRect.width)
            : undefined;
          const parentWidth = widgetType === 'button' || widgetType === 'icon' ? backgroundWidth : cellRect.width;
          const parentHeight = cellRect.height;
          if (parentWidth === undefined) {
            gapForChild(context, 'width', cell.id, cell.source, 'source cellbackgroundwidth is unavailable for button/icon parentwidth', cellLinks);
          } else {
            let width = outerWidth;
            let height = outerHeight;
            const widgetNodeId = `scene:widget:${cell.id}:${widgetType}`;
            const baseWidgetLinks = [...cellLinks, ...(operation ? linkProgramGaps(context, operation.id) : [])];
            const textIds: string[] = [];
            if ((widgetType === 'button' || widgetType === 'editbox') && width === 0) width = parentWidth;
            let sourceWidthValid = true;
            if (width < 0) {
              sourceWidthValid = false;
              gapForChild(
                context,
                'width',
                cell.id,
                cell.source,
                'fontstring width is negative: Helper omitted-width arithmetic produced a negative widget width; drawable widget geometry is unavailable',
                cellLinks,
                'unsupported',
              );
            } else if (widgetType === 'text') {
              const sourceWidth = width === 0 ? parentWidth - outerX : Math.min(width, parentWidth - outerX);
              if (!isFiniteDimension(sourceWidth)) {
                sourceWidthValid = false;
                gapForChild(context, 'width', cell.id, cell.source, 'fontstring width is negative or outside the supported source domain', cellLinks, 'unsupported');
              } else {
                width = sourceWidth;
              }
            }
            if (widgetType === 'button' && width > parentWidth) width = parentWidth;
            if (widgetType === 'button' || widgetType === 'editbox') {
              if (height === 0) height = parentHeight;
            }
            const widgetColorEntries: readonly (readonly [string, X4UiSceneColorSlot])[] = widgetType === 'button'
              ? [['bgcolor', 'widget-background'], ['highlightcolor', 'widget-highlight'], ['bordercolor', 'widget-border']]
              : widgetType === 'editbox'
                ? [['bgcolor', 'widget-background']]
                : widgetType === 'icon'
                  ? [['color', 'widget-icon']]
                  : [];
            const widgetDescriptorFacts = operation?.descriptorFacts || {};
            const widgetEditBoxConfigBorder = widgetType === 'editbox'
              ? validEditBoxConfigBorderFact(widgetDescriptorFacts.editboxConfigBorder || cell.descriptorFacts.editboxConfigBorder)
              : undefined;
            const widgetEditBoxTextBorder = widgetType === 'editbox'
              ? validEditBoxTextBorderFact(widgetDescriptorFacts.editboxTextBorder || cell.descriptorFacts.editboxTextBorder)
              : undefined;
            const widgetEditBoxBlackInset = widgetType === 'editbox'
              ? validEditBoxBlackInsetFact(widgetDescriptorFacts.editboxBlackInset || cell.descriptorFacts.editboxBlackInset, state.metrics.uiScale)
              : undefined;
            const widgetEditBoxInitialInputActive = widgetType === 'editbox'
              ? validEditBoxInitialInputActiveFact(widgetDescriptorFacts.editboxInitialInputActive || cell.descriptorFacts.editboxInitialInputActive)
              : undefined;
            const widgetEditBoxPreviewInputState = widgetType === 'editbox'
              ? widgetEditBoxInitialInputActive === false ? 'source-initial-inactive' as const : 'runtime-unknown' as const
              : undefined;
            const widgetColorFacts: X4UiSceneColorFact[] = [...sceneColorFacts(widgetDescriptorFacts, widgetColorEntries)];
            for (const [field] of widgetColorEntries) {
              addUnavailableColorGap(context, widgetNodeId, field, widgetDescriptorFacts[field], baseWidgetLinks);
            }
            for (const colorFact of widgetColorFacts) {
              addKnownColorUncertaintyGap(context, widgetNodeId, colorFact.source, baseWidgetLinks, `widget ${colorFact.slot}`);
            }
            if (widgetType === 'editbox') {
              const innerColorFact = sceneColorFact('editboxBackgroundBlackColor', 'editbox-inner-background', widgetDescriptorFacts.editboxBackgroundBlackColor);
              if (innerColorFact) {
                widgetColorFacts.push(innerColorFact);
              }
            }
            const unavailableWidgetLinks = [...new Set([...baseWidgetLinks, ...cellLinks])];
            if (sourceWidthValid) {
              const widgetRect = widgetOuterRect(cellRect, widgetType, outerX, outerY, width, height);
              const cellClip = rowClip ? clipRectFor(cellRect, rowClip) : undefined;
              const widgetClip = cellClip ? clipRectFor(widgetRect, cellClip) : undefined;
              const textNodes: TextBuildResult[] = [];
              const textDiagnosticLinks: string[] = [];
              const textParentRect = widgetType === 'button' || widgetType === 'icon'
                ? { ...cellRect, width: parentWidth }
                : cellRect;
              const supportedTextSlots: X4UiSceneTextSlot[] = widgetType === 'text' || widgetType === 'editbox'
                ? ['primary']
                : ['primary', 'secondary'];
              for (const slot of supportedTextSlots) {
                const textViewport = widgetType === 'icon'
                  ? (cellClip ? clipRectFor(textParentRect, cellClip) : textParentRect)
                  : widgetClip;
                const result = buildTextNode(context, widgetNodeId, widgetType, widgetRect, textParentRect, textViewport, cell, slot, operations, textIds, baseWidgetLinks);
                textNodes.push(result);
                texts.push(result.node);
                glyphs.push(...result.glyphs);
                textDiagnosticLinks.push(...result.node.diagnosticLinks);
              }
              if (widgetType === 'editbox') {
                if (widgetEditBoxConfigBorder === undefined) {
                  gapForMissingFact(context, 'geometry', widgetNodeId, cell.source, 'editboxConfigBorder', widgetDescriptorFacts.editboxConfigBorder, baseWidgetLinks);
                }
                if (widgetEditBoxTextBorder === undefined) {
                  gapForMissingFact(context, 'geometry', widgetNodeId, cell.source, 'editboxTextBorder', widgetDescriptorFacts.editboxTextBorder, baseWidgetLinks);
                }
                if (widgetEditBoxBlackInset === undefined || widgetRect.width <= 2 * widgetEditBoxBlackInset || widgetRect.height <= 2 * widgetEditBoxBlackInset) {
                  gapForChild(context, 'geometry', widgetNodeId, cell.source, 'preview-only edit-box black inner rectangle requires a finite positive outer rectangle larger than twice the source-scaled black inset', baseWidgetLinks, 'unsupported');
                }
              }
              const widgetLinks = [...new Set([...baseWidgetLinks, ...textDiagnosticLinks])];
              if (widgetType === 'icon') gapForChild(context, 'texture', widgetNodeId, cell.source, 'icon material/texture is not projected as engine truth', widgetLinks, 'unsupported');
              if (widgetType === 'button') {
                gapForChild(context, 'state', widgetNodeId, cell.source, 'runtime widget interaction state is not projected as engine truth', widgetLinks, 'unsupported');
              } else if (widgetType === 'editbox') {
                widgetLinks.push(addGap(context, {
                  category: 'state',
                  status: 'unsupported',
                  reason: 'preview-only edit-box source composition does not observe live direct-input activity, focus/hover/cursor/selection/hidden/encrypted/hotkey state, engine material/texture state, font raster behavior, or game-frame acceptance',
                  source: sourceCopy(operation?.source || cell.source),
                  sourcePin: {
                    sourcePath: WIDGET_SOURCE_PATH,
                    lineStart: 12603,
                    lineEnd: 12799,
                  },
                  nodeId: widgetNodeId,
                  previewOnly: true,
                }));
              }
              const widgetCompleteness: X4UiSceneCompleteness = widgetLinks.length === 0 ? 'complete' : 'partial';
              const primaryContent = cell.descriptorFacts.text?.status === 'known' && typeof cell.descriptorFacts.text.value === 'string'
                ? cell.descriptorFacts.text.value
                : undefined;
              const iconIdentity = cell.descriptorFacts.icon?.status === 'known' && typeof cell.descriptorFacts.icon.value === 'string'
                ? cell.descriptorFacts.icon.value
                : undefined;
              widgets.push({
                id: widgetNodeId,
                kind: widgetType,
                parentId: cellNodeId,
                source: sourceCopy(operation?.source || cell.source),
                sourceOrder: sourceOrder(operation?.source || cell.source),
                rect: widgetRect,
                ...(widgetClip ? { clipRect: widgetClip } : {}),
                completeness: widgetCompleteness,
                provenance: 'source-derived',
                ...(widgetColorFacts.length > 0 ? { colorFacts: widgetColorFacts } : {}),
                provenanceLinks: [
                  ...factLinks(cell.descriptorFacts, ['contentKind', 'outerX', 'outerY', 'outerWidth', 'outerHeight', 'text', 'text2', 'icon', 'active', 'defaultTextColor', 'editboxBackgroundBlackColor', 'editboxConfigBorder', 'editboxTextBorder', 'editboxBlackInset', 'editboxInitialInputActive']),
                  makeSourceLink('source-pin', operation?.source || cell.source),
                  ...widgetSourceLinks(operation?.source || cell.source, widgetType),
                ],
                diagnosticLinks: widgetLinks,
                diagnosticStyle: diagnosticStyleForGeometry(true),
                cellId: cellNodeId,
                textIds,
                ...(primaryContent === undefined ? {} : { primaryContent }),
                ...(iconIdentity === undefined ? {} : { iconIdentity }),
                ...(cell.descriptorFacts.active?.status === 'known' ? { configuredActive: cell.descriptorFacts.active.value as boolean } : {}),
                outerRect: widgetRect,
                ...(widgetEditBoxConfigBorder === undefined ? {} : { editboxConfigBorder: widgetEditBoxConfigBorder }),
                ...(widgetEditBoxTextBorder === undefined ? {} : { editboxTextBorder: widgetEditBoxTextBorder }),
                ...(widgetEditBoxBlackInset === undefined ? {} : { editboxBlackInset: widgetEditBoxBlackInset }),
                ...(widgetEditBoxPreviewInputState === undefined ? {} : { editboxPreviewInputState: widgetEditBoxPreviewInputState }),
              });
              widgetIds.push(widgetNodeId);
              void textNodes;
            } else {
              widgets.push({
                id: widgetNodeId,
                kind: widgetType,
                parentId: cellNodeId,
                source: sourceCopy(operation?.source || cell.source),
                sourceOrder: sourceOrder(operation?.source || cell.source),
                completeness: 'unavailable',
                provenance: 'unavailable',
                ...(widgetColorFacts.length > 0 ? { colorFacts: widgetColorFacts } : {}),
                provenanceLinks: [
                  ...factLinks(cell.descriptorFacts, ['contentKind', 'outerX', 'outerY', 'outerWidth', 'outerHeight', 'defaultTextColor', 'editboxBackgroundBlackColor', 'editboxConfigBorder', 'editboxTextBorder', 'editboxBlackInset', 'editboxInitialInputActive']),
                  makeSourceLink('source-pin', operation?.source || cell.source),
                  ...widgetSourceLinks(operation?.source || cell.source, widgetType),
                ],
                diagnosticLinks: unavailableWidgetLinks,
                diagnosticStyle: diagnosticStyleForGeometry(false),
                cellId: cellNodeId,
                textIds,
                ...(widgetEditBoxPreviewInputState === undefined ? {} : { editboxPreviewInputState: widgetEditBoxPreviewInputState }),
              });
              widgetIds.push(widgetNodeId);
            }
          }
        } else {
          gapForChild(context, 'widget', cell.id, cell.source, 'finalized widget outer rectangle facts are unavailable', cellLinks);
        }
      }
      const cellCompleteness: X4UiSceneCompleteness = hidden === true
        ? (cellLinks.length === 0 ? 'complete' : 'partial')
        : cellRect
          ? (cellLinks.length === 0 ? 'complete' : 'partial')
          : 'unavailable';
      cells.push({
        id: cellNodeId,
        kind: 'cell',
        parentId: rowNodeId,
        source: sourceCopy(cell.source),
        sourceOrder: sourceOrder(cell.source),
        ...(cellRect ? { rect: cellRect, ...(rowClip ? { clipRect: clipRectFor(cellRect, rowClip) } : {}) } : {}),
        ...(naturalCellRect ? { naturalRect: naturalCellRect } : {}),
        completeness: cellCompleteness,
        provenance: 'source-derived',
        ...(cellColorFacts.length > 0 ? { colorFacts: cellColorFacts } : {}),
        provenanceLinks: [
          ...factLinks(cell.descriptorFacts, ['contentKind', 'span', 'outerX', 'outerY', 'outerWidth', 'outerHeight']),
          ...(state ? [makeSourceLink('kernel-state', cell.source)] : []),
        ],
        diagnosticLinks: cellLinks,
        diagnosticStyle: diagnosticStyleForGeometry(Boolean(cellRect)),
        tableId: `scene:${table.id}`,
        rowId: rowNodeId,
        ...(cell.rowIndex === undefined ? {} : { rowIndex: cell.rowIndex }),
        column: cell.column,
        ...(span === undefined ? {} : { span }),
        ...(hidden === undefined ? {} : { hidden }),
        widgetIds,
      });
    }
  }
  return { rows, cells, widgets, texts, glyphs };
};

const closedDataRecord = (
  value: unknown,
  required: readonly string[],
  optional: readonly string[] = [],
): value is Record<string, unknown> => {
  if (!isRecord(value) || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.some(key => typeof key !== 'string')) return false;
  const keys = ownKeys as string[];
  if (!required.every(key => keys.includes(key)) || !keys.every(key => required.includes(key) || optional.includes(key))) return false;
  return keys.every(key => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor !== undefined && 'value' in descriptor && descriptor.enumerable === true;
  });
};

const closedSourceIsValid = (value: unknown): value is X4UiSceneSourceLocation => {
  if (!closedDataRecord(value, ['file', 'start', 'end'], ['sourcePath'])) return false;
  const source = value as Record<string, unknown>;
  if (!closedDataRecord(source.start, ['line', 'column', 'offset']) || !closedDataRecord(source.end, ['line', 'column', 'offset'])) return false;
  return sourceIsValid(value);
};

const closedSourcePinIsValid = (value: unknown): value is X4UiLayoutSourcePin =>
  closedDataRecord(value, ['sourcePath', 'lineStart', 'lineEnd']) && sourcePinIsValid(value);

const finiteColorChannel = (value: unknown, minimum: number, maximum: number, integer = false): value is number =>
  typeof value === 'number'
  && Number.isFinite(value)
  && (!integer || Number.isInteger(value))
  && value >= minimum
  && value <= maximum;

const validateColorLiteralField = (
  value: unknown,
  declarationSource: X4UiSceneSourceLocation,
  minimum: number,
  maximum: number,
): boolean => {
  if (!closedDataRecord(value, ['value', 'expression', 'source', 'keySource'])) return false;
  const field = value as Record<string, unknown>;
  return finiteColorChannel(field.value, minimum, maximum)
    && typeof field.expression === 'string'
    && field.expression.length > 0
    && closedSourceIsValid(field.source)
    && closedSourceIsValid(field.keySource)
    && sourceLocationContains(declarationSource, field.source)
    && sourceLocationContains(declarationSource, field.keySource);
};

const validateColorSourceIdentity = (
  value: unknown,
  path: string,
  sha256: string,
  size: number,
): boolean => closedDataRecord(value, ['path', 'relativePath', 'sha256', 'size'])
  && value.path === path
  && value.relativePath === path
  && value.sha256 === sha256
  && value.size === size;

const validateColorDocumentSource = (
  value: unknown,
  expectedId: string,
  maximumIndex: number,
): boolean => closedDataRecord(value, ['path', 'index', 'id'])
  && value.path === X4_UI_CORPUS_COLORS_XML_PATH
  && Number.isSafeInteger(value.index)
  && (value.index as number) >= 0
  && (value.index as number) < maximumIndex
  && value.id === expectedId;

const validateColorValue = (value: unknown): value is X4UiLayoutColorValue => {
  if (!closedDataRecord(value, ['kind', 'domain', 'r', 'g', 'b', 'a', 'gameVerification'], ['glow', 'declarationExpression', 'declarationSource', 'channels', 'canonicalIdentity', 'requestedId', 'resolvedBaseId', 'baseSource', 'mappingSource', 'sourceIdentities'])) return false;
  const candidate = value as Record<string, unknown>;
  if (candidate.kind !== 'color' || candidate.gameVerification !== X4_UI_SCENE_GAME_TRUTH) return false;
  if (candidate.domain === 'source-literal-percent-alpha') {
    if (!closedDataRecord(value, ['kind', 'domain', 'r', 'g', 'b', 'a', 'declarationExpression', 'declarationSource', 'channels', 'gameVerification'], ['glow'])
      || typeof candidate.declarationExpression !== 'string'
      || candidate.declarationExpression.length === 0
      || !closedSourceIsValid(candidate.declarationSource)) return false;
    if (!finiteColorChannel(candidate.r, 0, 255) || !finiteColorChannel(candidate.g, 0, 255) || !finiteColorChannel(candidate.b, 0, 255) || !finiteColorChannel(candidate.a, 0, 100)) return false;
    const channels = candidate.channels;
    if (!closedDataRecord(channels, ['r', 'g', 'b', 'a'], ['glow'])) return false;
    const declarationSource = candidate.declarationSource as X4UiSceneSourceLocation;
    const channelValues: Readonly<Record<'r' | 'g' | 'b' | 'a', readonly [number, number]>> = {
      r: [candidate.r as number, 255],
      g: [candidate.g as number, 255],
      b: [candidate.b as number, 255],
      a: [candidate.a as number, 100],
    };
    for (const name of ['r', 'g', 'b', 'a'] as const) {
      const field = channels[name] as Record<string, unknown>;
      if (!validateColorLiteralField(field, declarationSource, 0, channelValues[name][1]) || !Object.is(field.value, channelValues[name][0])) return false;
    }
    if (candidate.glow === undefined) {
      if (Object.prototype.hasOwnProperty.call(candidate, 'glow') || Object.prototype.hasOwnProperty.call(channels, 'glow')) return false;
    } else {
      if (!finiteColorChannel(candidate.glow, 0, 1) || !Object.prototype.hasOwnProperty.call(channels, 'glow') || !validateColorLiteralField(channels.glow, declarationSource, 0, 1) || !Object.is((channels.glow as Record<string, unknown>).value, candidate.glow)) return false;
    }
    return true;
  }
  if (candidate.domain !== 'canonical-xml-byte-alpha'
    || candidate.canonicalIdentity !== 'x4-9.00'
    || !closedDataRecord(value, ['kind', 'domain', 'canonicalIdentity', 'requestedId', 'resolvedBaseId', 'r', 'g', 'b', 'a', 'glow', 'baseSource', 'sourceIdentities', 'gameVerification'], ['mappingSource'])
    || typeof candidate.requestedId !== 'string'
    || candidate.requestedId.length === 0
    || typeof candidate.resolvedBaseId !== 'string'
    || candidate.resolvedBaseId.length === 0
    || !finiteColorChannel(candidate.r, 0, 255, true)
    || !finiteColorChannel(candidate.g, 0, 255, true)
    || !finiteColorChannel(candidate.b, 0, 255, true)
    || !finiteColorChannel(candidate.a, 0, 255, true)
    || !finiteColorChannel(candidate.glow, 0, 1)
    || !validateColorDocumentSource(candidate.baseSource, candidate.resolvedBaseId, 224)
    || !closedDataRecord(candidate.sourceIdentities, ['xml', 'xsd'])
    || !validateColorSourceIdentity(candidate.sourceIdentities.xml, X4_UI_CORPUS_COLORS_XML_PATH, X4_UI_CORPUS_COLORS_XML_SHA256, X4_UI_CORPUS_COLORS_XML_SIZE)
    || !validateColorSourceIdentity(candidate.sourceIdentities.xsd, X4_UI_CORPUS_COLORS_XSD_PATH, X4_UI_CORPUS_COLORS_XSD_SHA256, X4_UI_CORPUS_COLORS_XSD_SIZE)) return false;
  if (candidate.mappingSource === undefined) return candidate.requestedId === candidate.resolvedBaseId;
  return candidate.requestedId !== candidate.resolvedBaseId
    && validateColorDocumentSource(candidate.mappingSource, candidate.requestedId, 804);
};

const validateKnownColorFact = (fact: Record<string, unknown>): boolean => {
  if (!closedDataRecord(fact, ['status', 'expectedType', 'value', 'provenance', 'expression', 'source'], ['sourcePin', 'sampleId'])
    || fact.status !== 'known'
    || fact.expectedType !== 'color-object'
    || !validateColorValue(fact.value)
    || (fact.value.domain === 'source-literal-percent-alpha' ? fact.provenance !== 'source-literal' : fact.provenance !== 'canonical-default-only')
    || typeof fact.expression !== 'string'
    || fact.expression.length === 0
    || !closedSourceIsValid(fact.source)) return false;
  return (fact.sourcePin === undefined || closedSourcePinIsValid(fact.sourcePin))
    && (fact.sampleId === undefined || (typeof fact.sampleId === 'string' && fact.sampleId.length > 0));
};

const ownDataValue = (value: Record<string, unknown>, key: string): unknown => {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor !== undefined && 'value' in descriptor ? descriptor.value : undefined;
};

const validateFact = (fact: unknown): boolean => {
  if (!isRecord(fact) || Array.isArray(fact)) return false;
  const status = ownDataValue(fact, 'status');
  const expectedType = ownDataValue(fact, 'expectedType');
  if (status === 'known' && expectedType === 'color-object') return validateKnownColorFact(fact);
  const source = ownDataValue(fact, 'source');
  if ((status !== 'known' && status !== 'unavailable') || !sourceIsValid(source)) return false;
  const sourcePin = ownDataValue(fact, 'sourcePin');
  if (sourcePin !== undefined && !sourcePinIsValid(sourcePin)) return false;
  const value = ownDataValue(fact, 'value');
  const expression = ownDataValue(fact, 'expression');
  if (status === 'known') {
    if (expectedType !== 'number' && expectedType !== 'string' && expectedType !== 'boolean') return false;
    if (typeof value !== expectedType) return false;
    if (typeof value === 'number' && !isFiniteSafe(value)) return false;
    if (!['source-literal', 'source-pinned-default', 'direct-helper-scale', 'preview-sample'].includes(String(ownDataValue(fact, 'provenance'))) || typeof expression !== 'string' || (ownDataValue(fact, 'sampleId') !== undefined && typeof ownDataValue(fact, 'sampleId') !== 'string')) return false;
  } else if ((expectedType !== 'number' && expectedType !== 'string' && expectedType !== 'boolean' && expectedType !== 'color-object') || typeof ownDataValue(fact, 'reason') !== 'string' || (expression !== undefined && typeof expression !== 'string')) return false;
  return true;
};

const validateFacts = (facts: unknown): boolean => {
  if (!isRecord(facts) || Array.isArray(facts)) return false;
  const keys = Reflect.ownKeys(facts);
  if (keys.some(key => typeof key !== 'string')) return false;
  return keys.every(key => {
    const descriptor = Object.getOwnPropertyDescriptor(facts, key);
    return descriptor !== undefined && 'value' in descriptor && descriptor.enumerable === true && validateFact(descriptor.value);
  });
};

const validateFactDomain = (
  facts: X4UiLayoutDescriptorFacts,
  name: string,
  predicate: (value: number) => boolean,
): boolean => {
  const fact = facts[name];
  if (!fact || fact.status === 'unavailable') return true;
  return fact.status === 'known'
    && fact.expectedType === 'number'
    && typeof fact.value === 'number'
    && predicate(fact.value);
};

const validateConsumedFactDomains = (
  facts: X4UiLayoutDescriptorFacts,
  dimensions: readonly string[],
  signedNumbers: readonly string[],
  nonnegativeIntegers: readonly string[],
  positiveIntegers: readonly string[],
): boolean => {
  const signed = (value: number): boolean => isFiniteDimension(Math.abs(value));
  const nonnegativeInteger = (value: number): boolean => isSafeIntegerAtLeast(value, 0);
  const positiveInteger = (value: number): boolean => isSafeIntegerAtLeast(value, 1);
  const dimension = (name: string): boolean => name === 'outerWidth'
    ? validateFactDomain(facts, name, value => isFiniteDimension(value) || (value < 0 && isHelperOmittedWidthFact(facts[name])))
    : validateFactDomain(facts, name, isFiniteDimension);
  return dimensions.every(dimension)
    && signedNumbers.every(name => validateFactDomain(facts, name, signed))
    && nonnegativeIntegers.every(name => validateFactDomain(facts, name, nonnegativeInteger))
    && positiveIntegers.every(name => validateFactDomain(facts, name, positiveInteger));
};

const knownFactMatches = (
  facts: X4UiLayoutDescriptorFacts,
  name: string,
  expected: string | number | boolean | undefined,
  expectedType: 'string' | 'number' | 'boolean',
): boolean => {
  const fact = facts[name];
  if (fact === undefined || fact.status !== 'known') return true;
  return expected !== undefined && fact.expectedType === expectedType && fact.value === expected;
};

const uniqueStringArray = (value: unknown): value is readonly string[] =>
  Array.isArray(value)
  && value.every(item => typeof item === 'string')
  && new Set(value).size === value.length;

const HELPER_CELL_TYPES = new Set(['cell', 'text', 'boxtext', 'icon', 'button', 'editbox']);

const validateKernelCell = (cell: unknown): boolean => {
  if (!isRecord(cell) || typeof cell.type !== 'string' || !HELPER_CELL_TYPES.has(cell.type)) return false;
  if (!isSafeIntegerAtLeast(cell.colspan, 0) || !isSafeIntegerAtLeast(cell.bgcolspan, 0)) return false;
  if (!isFiniteSafe(cell.y) || Math.abs(cell.y as number) > MAX_SAFE_LAYOUT_WIDTH || !isFiniteDimension(cell.height) || typeof cell.scaling !== 'boolean' || typeof cell.affectRowHeight !== 'boolean' || typeof cell.hotkey !== 'string' || typeof cell.displayIcon !== 'boolean') return false;
  return cell.minTextHeight === undefined || isFiniteDimension(cell.minTextHeight);
};

const validateKernelRow = (row: unknown, columnCount?: number, groupCount?: number): boolean => {
  if (!isRecord(row)) return false;
  if (row.groupIndex !== undefined && (!isSafeIntegerAtLeast(row.groupIndex, 1) || (groupCount !== undefined && row.groupIndex > groupCount))) return false;
  if (typeof row.fixed !== 'boolean' || typeof row.borderBelow !== 'boolean' || !isFiniteDimension(row.paddingTop) || !isFiniteDimension(row.paddingBottom) || typeof row.scaling !== 'boolean' || !Array.isArray(row.cells)) return false;
  if (columnCount !== undefined && row.cells.length !== columnCount) return false;
  return row.cells.every((cell, index) => {
    if (!validateKernelCell(cell)) return false;
    const candidate = cell as Record<string, unknown>;
    const span = candidate.colspan as number;
    const bgSpan = candidate.bgcolspan as number;
    return columnCount === undefined
      || (span === 0 || index + span <= columnCount)
      && (bgSpan === 0 || index + bgSpan <= columnCount);
  });
};

const validateKernelDiagnostic = (diagnostic: unknown): boolean => {
  if (!isRecord(diagnostic) || !exactKeys(diagnostic, ['code', 'message', 'provenance']) || !['reserve-scrollbar-no-variable-column', 'reserve-scrollbar-insufficient-space', 'colspan-clamped', 'colspan-hid-non-cell', 'background-colspan-clamped'].includes(String(diagnostic.code)) || typeof diagnostic.message !== 'string') return false;
  if (!sameProvenance(diagnostic.provenance)) return false;
  if (diagnostic.code === 'reserve-scrollbar-no-variable-column') return diagnostic.message === RESERVE_NO_VARIABLE_MESSAGE;
  if (diagnostic.code === 'colspan-clamped') return diagnostic.message === 'colspan was clamped to the remaining columns';
  if (diagnostic.code === 'background-colspan-clamped') return diagnostic.message === 'background colspan was clamped to the remaining columns';
  if (diagnostic.code === 'colspan-hid-non-cell') return /^colspan hid non-cell at column [1-9][0-9]*$/.test(diagnostic.message);
  return /^table column finalization with reserveScrollBar: Cannot reserve enough space for scroll bar, width available=[0-9]+, required=[0-9]+$/.test(diagnostic.message);
};

const sameStructuralValue = (left: unknown, right: unknown, seen = new WeakMap<object, object>()): boolean => {
  if (left === right) return true;
  if (typeof left !== typeof right || left === null || right === null) return false;
  if (typeof left !== 'object' || typeof right !== 'object') return false;
  if (left instanceof Uint8Array || right instanceof Uint8Array) {
    return left instanceof Uint8Array && right instanceof Uint8Array && left.length === right.length && left.every((value, index) => value === right[index]);
  }
  const prior = seen.get(left);
  if (prior === right) return true;
  seen.set(left, right);
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((value, index) => sameStructuralValue(value, right[index], seen));
  }
  if (!isRecord(left) || !isRecord(right)) return false;
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return leftKeys.length === rightKeys.length
    && leftKeys.every((key, index) => key === rightKeys[index] && sameStructuralValue(left[key], right[key], seen));
};

const validateKernelState = (state: unknown): boolean => {
  if (!isRecord(state) || !sameProvenance(state.provenance)) return false;
  if (!isFiniteDimension(state.frameWidth) || !isRecord(state.metrics)) return false;
  const metrics = state.metrics as Record<string, unknown>;
  if (!exactKeys(metrics, ['uiScale', 'borderSize', 'scrollbarWidth', 'standardContainerOffset']) || !isFiniteSafe(metrics.uiScale) || metrics.uiScale <= 0 || !isFiniteDimension(metrics.borderSize) || !isFiniteDimension(metrics.scrollbarWidth) || !isFiniteDimension(metrics.standardContainerOffset)) return false;
  if (!isFiniteDimension(state.requestedWidth) || !isRecord(state.properties) || !isRecord(state.editBoxDefaults) || !Array.isArray(state.columns) || !Array.isArray(state.rows) || !Array.isArray(state.rowGroups) || typeof state.createdWithScrollBar !== 'boolean' || typeof state.final !== 'boolean' || !Array.isArray(state.diagnostics)) return false;
  const properties = state.properties as Record<string, unknown>;
  if (!isFiniteDimension(properties.width) || !isFiniteSafe(properties.x) || Math.abs(properties.x as number) > MAX_SAFE_LAYOUT_WIDTH || typeof properties.scaling !== 'boolean' || typeof properties.reserveScrollBar !== 'boolean') return false;
  const editBoxDefaults = state.editBoxDefaults as Record<string, unknown>;
  if (Object.keys(editBoxDefaults).some(key => !['height', 'scaling', 'hotkey', 'displayIcon'].includes(key))
    || (editBoxDefaults.height !== undefined && (!isFiniteDimension(editBoxDefaults.height) || (editBoxDefaults.height as number) < 0))
    || (editBoxDefaults.scaling !== undefined && typeof editBoxDefaults.scaling !== 'boolean')
    || (editBoxDefaults.hotkey !== undefined && typeof editBoxDefaults.hotkey !== 'string')
    || (editBoxDefaults.displayIcon !== undefined && typeof editBoxDefaults.displayIcon !== 'boolean')) return false;
  const columns = state.columns as unknown[];
  const rowGroups = state.rowGroups as unknown[];
  const rows = state.rows as unknown[];
  const diagnostics = state.diagnostics as unknown[];
  const columnsValid = columns.every(column => isRecord(column)
    && isFiniteDimension(column.width)
    && typeof column.percent === 'boolean'
    && typeof column.min === 'boolean'
    && isFiniteSafe(column.weight) && column.weight >= 0
    && isSafeIntegerAtLeast(column.colspan, 1)
    && isSafeIntegerAtLeast(column.bgcolspan, 1)
    && (column.scaling === undefined || typeof column.scaling === 'boolean'));
  const groupsValid = rowGroups.every(group => isRecord(group) && isSafeIntegerAtLeast(group.level, 0));
  const rowsValid = rows.every(row => validateKernelRow(row, columns.length, rowGroups.length));
  return columnsValid && groupsValid && rowsValid && diagnostics.every(validateKernelDiagnostic);
};

const RESERVE_NO_VARIABLE_MESSAGE = 'table column finalization with reserveScrollBar: No column with variable width defined, cannot reserve additional space';

const kernelStateWithRows = (state: HelperTableState, rows: readonly unknown[]): HelperTableState => ({
  ...state,
  rows: rows as HelperTableState['rows'],
});

const kernelStateAppendsRow = (before: HelperTableState, after: HelperTableState): boolean =>
  before.rows.length + 1 === after.rows.length
  && sameKernelStateIgnoringUndefinedOptionals(
    kernelStateWithRows(after, after.rows.slice(0, before.rows.length)),
    before,
  );

const reserveDiagnosticMatchesAcceptedFinalization = (
  state: HelperTableState,
  diagnostic: HelperTableState['diagnostics'][number],
  program: X4UiLayoutProgram,
  table: X4UiLayoutTableNode,
): boolean => {
  if (diagnostic.code === 'reserve-scrollbar-no-variable-column') {
    return diagnostic.message === RESERVE_NO_VARIABLE_MESSAGE
      && state.columns.every(column => !(column.min && column.weight > 0))
      && validateReserveProducerChain(program, state, diagnostic, table);
  }
  if (diagnostic.code !== 'reserve-scrollbar-insufficient-space') return false;
  return /^table column finalization with reserveScrollBar: Cannot reserve enough space for scroll bar, width available=[0-9]+, required=[0-9]+$/.test(diagnostic.message)
    && validateReserveProducerChain(program, state, diagnostic, table);
};

const validateLayoutMetrics = (value: unknown): value is { readonly uiScale: number; readonly borderSize: number; readonly scrollbarWidth: number; readonly standardContainerOffset: number } =>
  isRecord(value)
  && exactKeys(value, ['uiScale', 'borderSize', 'scrollbarWidth', 'standardContainerOffset'])
  && isFiniteSafe(value.uiScale)
  && value.uiScale > 0
  && isFiniteDimension(value.borderSize)
  && isFiniteDimension(value.scrollbarWidth)
  && isFiniteDimension(value.standardContainerOffset);

const sameLayoutMetrics = (
  left: unknown,
  right: unknown,
): boolean => validateLayoutMetrics(left)
  && validateLayoutMetrics(right)
  && left.uiScale === right.uiScale
  && left.borderSize === right.borderSize
  && left.scrollbarWidth === right.scrollbarWidth
  && left.standardContainerOffset === right.standardContainerOffset;

const exactKeys = (value: Record<string, unknown>, required: readonly string[], optional: readonly string[] = []): boolean => {
  const allowed = new Set([...required, ...optional]);
  const keys = Object.keys(value);
  return required.every(key => Object.prototype.hasOwnProperty.call(value, key))
    && keys.every(key => allowed.has(key));
};

const isExactUnavailableCellHeight = (value: unknown): boolean => {
  if (value === null || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) return false;
  const keys = Reflect.ownKeys(value);
  if (keys.length !== 1 || keys[0] !== 'status') return false;
  const status = Object.getOwnPropertyDescriptor(value, 'status');
  return status?.enumerable === true
    && Object.prototype.hasOwnProperty.call(status, 'value')
    && status.value === 'unavailable';
};

const SUPPORTED_OPERATION_KINDS = new Set([
  'createFrameHandle',
  'addTable',
  'setDefaultCellProperties',
  'setDefaultComplexCellProperties',
  'setColWidthPercent',
  'setColWidth',
  'addRow',
  'setColSpan',
  'display',
  'OpenMenu',
  'setText',
  'setText2',
  'createText',
  'createEditBox',
  'setHotkey',
  'createButton',
  'createIcon',
  'scaleX',
  'scaleY',
  'scaleFont',
  'setBackground',
  'setBackground2',
  'setOverlay',
]);

const KERNEL_PRODUCER_KINDS = new Set([
  'addTable',
  'setDefaultCellProperties',
  'setDefaultComplexCellProperties',
  'setColWidth',
  'setColWidthPercent',
  'addRow',
  'setColSpan',
  'createText',
  'createEditBox',
  'setHotkey',
  'createButton',
  'createIcon',
]);

const SOURCE_OWNER_DOWNSTREAM_KINDS = new Set([
  ...KERNEL_PRODUCER_KINDS,
  'setText',
  'setText2',
]);

const SERIALIZABLE_MAX_DEPTH = 64;

const producerTransition = (operation: X4UiLayoutOperation): X4UiLayoutOperation['kernel'] | undefined =>
  operation.kernel?.stateAfter !== undefined
    ? operation.kernel
    : undefined;

const sameDiagnostic = (
  left: HelperTableState['diagnostics'][number],
  right: HelperTableState['diagnostics'][number],
): boolean => left.code === right.code && left.message === right.message && sameProvenance(left.provenance);

const operationRowFor = (program: X4UiLayoutProgram, operation: X4UiLayoutOperation): X4UiLayoutRowNode | undefined =>
  operation.rowId === undefined
    ? operation.cellId === undefined
      ? undefined
      : program.cells.find(cell => cell.id === operation.cellId)?.rowId === undefined
        ? undefined
        : program.rows.find(row => row.id === program.cells.find(cell => cell.id === operation.cellId)?.rowId)
    : program.rows.find(row => row.id === operation.rowId);

const operationCellFor = (program: X4UiLayoutProgram, operation: X4UiLayoutOperation): X4UiLayoutCellNode | undefined =>
  operation.cellId === undefined ? undefined : program.cells.find(cell => cell.id === operation.cellId);

const operationTableFor = (program: X4UiLayoutProgram, operation: X4UiLayoutOperation): X4UiLayoutTableNode | undefined => {
  if (operation.tableId !== undefined) return program.tables.find(table => table.id === operation.tableId);
  const row = operationRowFor(program, operation);
  return row?.tableId === undefined ? undefined : program.tables.find(table => table.id === row.tableId);
};

const operationHasOwnerShape = (
  program: X4UiLayoutProgram,
  operation: X4UiLayoutOperation,
  kind: X4UiLayoutOperation['kind'],
): boolean => {
  const row = operationRowFor(program, operation);
  const cell = operationCellFor(program, operation);
  const table = operationTableFor(program, operation);
  const frameTextureLayerName = kind === 'setBackground'
    ? 'background'
    : kind === 'setBackground2'
      ? 'background2'
      : kind === 'setOverlay'
        ? 'overlay'
        : undefined;
  if (frameTextureLayerName !== undefined) {
    const frame = operation.frameId === undefined
      ? undefined
      : program.frames.find(candidate => candidate.id === operation.frameId);
    const layer = frame?.frameTextureLayers?.find(candidate => candidate.name === frameTextureLayerName);
    const receiver = operation.metadata.receiver?.reference;
    const semanticFrame = operation.metadata.semantics.frame?.reference;
    return operation.frameId !== undefined
      && operation.tableId === undefined
      && operation.rowId === undefined
      && operation.cellId === undefined
      && frame !== undefined
      && layer !== undefined
      && layer.operationIds.includes(operation.id)
      && frame.identity !== undefined
      && receiver !== undefined
      && semanticFrame !== undefined
      && sameStructuralValue(receiver, frame.identity)
      && sameStructuralValue(semanticFrame, frame.identity);
  }
  if (kind === 'createFrameHandle') {
    return operation.frameId !== undefined && operation.tableId === undefined && operation.rowId === undefined && operation.cellId === undefined;
  }
  if (kind === 'OpenMenu') {
    return operation.frameId === undefined && operation.tableId === undefined && operation.rowId === undefined && operation.cellId === undefined;
  }
  if (kind === 'display') {
    return operation.status === 'applied'
      ? operation.frameId !== undefined && operation.tableId === undefined && operation.rowId === undefined && operation.cellId === undefined
      : (operation.status === 'conditional' || operation.status === 'unreachable')
        ? operation.tableId === undefined && operation.rowId === undefined && operation.cellId === undefined
        : operation.frameId === undefined && operation.tableId === undefined && operation.rowId === undefined && operation.cellId === undefined;
  }
  if (kind === 'addTable') return operation.tableId !== undefined && operation.frameId === undefined && operation.rowId === undefined && operation.cellId === undefined;
  if (kind === 'setColWidth' || kind === 'setColWidthPercent') return operation.tableId !== undefined
    && operation.frameId === undefined && operation.rowId === undefined && operation.cellId === undefined;
  if (kind === 'setDefaultCellProperties' || kind === 'setDefaultComplexCellProperties') return operation.tableId !== undefined
    && operation.frameId === undefined && operation.rowId === undefined && operation.cellId === undefined;
  if (kind === 'addRow') return operation.rowId !== undefined
    && operation.cellId === undefined
    && operation.frameId === undefined
    && (operation.tableId === undefined || row?.tableId === undefined || operation.tableId === row.tableId)
    && (table === undefined || operation.tableId === undefined || row?.tableId === undefined || table.id === row.tableId);
  if (kind === 'scaleX' || kind === 'scaleY' || kind === 'scaleFont') return operation.rowId === undefined
    && operation.cellId === undefined
    && operation.frameId === undefined
    && operation.tableId === undefined;
  return operation.tableId !== undefined
    && operation.rowId !== undefined
    && row !== undefined
    && (row.tableId === undefined || row.tableId === operation.tableId)
    && (operation.cellId === undefined || (cell?.rowId === operation.rowId && cell.tableId === operation.tableId))
    && operation.frameId === undefined;
};

const operationBelongsToTable = (
  program: X4UiLayoutProgram,
  operation: X4UiLayoutOperation,
  table: X4UiLayoutTableNode,
): boolean => {
  if (operation.tableId !== undefined) return operation.tableId === table.id;
  const owner = operationTableFor(program, operation);
  return owner?.id === table.id || table.operationIds.includes(operation.id);
};

const authorityGapsFor = (
  authority: X4UiLayoutEvidenceAuthority,
  operationId: string,
): readonly X4UiLayoutEvidenceAuthority['gaps'][number][] =>
  authority.gaps.filter(gap => gap.operationId === operationId);

const authorityOperationFor = (
  authority: X4UiLayoutEvidenceAuthority,
  operationId: string,
): X4UiLayoutEvidenceAuthority['operations'][number] | undefined =>
  authority.operations.find(operation => operation.id === operationId);

const validKernelRefusalShape = (operation: X4UiLayoutOperation, allowNoState = false): boolean => {
  const transition = operation.kernel;
  const refusal = transition?.refusal;
  if (!transition || !refusal || operation.scale !== undefined) return false;
  const refusalWithState = refusal as typeof refusal & { readonly state?: HelperTableState };
  if (allowNoState) return transition.stateBefore === undefined && transition.stateAfter === undefined && refusalWithState.state === undefined;
  return transition.stateBefore !== undefined
    && transition.stateAfter !== undefined
    && isRecord(refusal)
    && refusalWithState.state !== undefined
    && validateKernelState(refusalWithState.state)
    && sameKernelStateIgnoringUndefinedOptionals(refusalWithState.state, transition.stateBefore)
    && sameKernelStateIgnoringUndefinedOptionals(refusalWithState.state, transition.stateAfter);
};

const isCreatorKind = (kind: X4UiLayoutOperation['kind']): boolean =>
  kind === 'createText' || kind === 'createEditBox' || kind === 'createButton' || kind === 'createIcon';

const kernelStateAppendsRowFromFinalized = (finalized: HelperTableState, after: HelperTableState): boolean =>
  finalized.rows.length + 1 === after.rows.length
  && sameKernelStateIgnoringUndefinedOptionals(
    kernelStateWithRows(after, after.rows.slice(0, finalized.rows.length)),
    finalized,
  );

const creatorTypeForOperation = (kind: X4UiLayoutOperation['kind']): 'text' | 'editbox' | 'button' | 'icon' | undefined =>
  kind === 'createText' ? 'text'
    : kind === 'createEditBox' ? 'editbox'
      : kind === 'createButton' ? 'button'
        : kind === 'createIcon' ? 'icon' : undefined;

const sourcePropertyExists = (operation: X4UiLayoutOperation, name: string): boolean => {
  const semantics = operation.metadata.semantics as unknown as Record<string, unknown>;
  const properties = Array.isArray(semantics.properties) ? semantics.properties : [];
  return properties.some(candidate => isRecord(candidate) && candidate.normalizedName === name);
};

const sourceProperty = (operation: X4UiLayoutOperation, name: string): Record<string, unknown> | undefined => {
  const semantics = operation.metadata.semantics as unknown as Record<string, unknown>;
  const properties = Array.isArray(semantics.properties) ? semantics.properties : [];
  const candidate = properties.find(value => isRecord(value) && value.normalizedName === name);
  return isRecord(candidate) ? candidate : undefined;
};

const descriptorFactExists = (operation: X4UiLayoutOperation, name: string): boolean =>
  Object.prototype.hasOwnProperty.call(operation.descriptorFacts, name);

const staticOperationProperty = (
  operation: X4UiLayoutOperation,
  name: string,
  expectedType: 'number' | 'boolean',
): number | boolean | undefined => {
  const semantics = operation.metadata.semantics as unknown as Record<string, unknown>;
  const properties = Array.isArray(semantics.properties) ? semantics.properties : [];
  const property = properties.find(candidate => isRecord(candidate) && candidate.normalizedName === name);
  if (!isRecord(property) || !isRecord(property.value) || property.value.status !== 'static' || property.value.type !== expectedType) return undefined;
  return property.value.value as number | boolean;
};

const knownOperationFactValue = (
  operation: X4UiLayoutOperation,
  name: string,
  expectedType: 'number' | 'boolean',
): number | boolean | undefined => {
  const fact = operation.descriptorFacts[name];
  if (!fact || fact.status !== 'known' || fact.expectedType !== expectedType) return undefined;
  return fact.value as number | boolean;
};

const knownOperationStringFact = (
  operation: X4UiLayoutOperation,
  name: string,
): string | undefined => {
  const fact = operation.descriptorFacts[name];
  if (!fact || fact.status !== 'known' || fact.expectedType !== 'string' || typeof fact.value !== 'string') return undefined;
  return fact.value;
};

const staticOperationStringProperty = (
  operation: X4UiLayoutOperation,
  name: string,
): string | undefined => {
  const property = sourceProperty(operation, name);
  if (!isRecord(property) || !isRecord(property.value) || property.value.status !== 'static' || property.value.type !== 'string') return undefined;
  return typeof property.value.value === 'string' ? property.value.value : undefined;
};

const B119_UNSUPPORTED_PROPERTY_OPERATION_KINDS = new Set<X4UiLayoutOperation['kind']>([
  'setDefaultCellProperties',
  'setDefaultComplexCellProperties',
  'setHotkey',
]);

const normalizeB119PropertyName = (name: string): string => name.replace(/[-_\s]/g, '').toLowerCase();

const validateB119UnsupportedPropertyGaps = (
  program: X4UiLayoutProgram,
  evidenceAuthority: X4UiLayoutEvidenceAuthority,
  operation: X4UiLayoutOperation,
): boolean => {
  if (!B119_UNSUPPORTED_PROPERTY_OPERATION_KINDS.has(operation.kind)) return true;
  const semantics = operation.metadata.semantics as unknown as Record<string, unknown>;
  const hasUnsupportedField = Object.prototype.hasOwnProperty.call(semantics, 'unsupportedProperties');
  if (!hasUnsupportedField) return true;
  if (!Array.isArray(semantics.unsupportedProperties) || semantics.unsupportedProperties.length === 0) return false;
  if (operation.status !== 'unresolved') return false;
  const expectedNodeId = operation.kind === 'setHotkey' ? operation.cellId : operation.tableId;
  const unsupported = semantics.unsupportedProperties;
  const validProjection = (candidate: unknown): candidate is Record<string, unknown> => {
    if (!isRecord(candidate)
      || typeof candidate.name !== 'string'
      || typeof candidate.normalizedName !== 'string'
      || candidate.normalizedName !== normalizeB119PropertyName(candidate.name)
      || !Number.isSafeInteger(candidate.sourceOrder)
      || !sourceIsValid(candidate.source)
      || !isRecord(candidate.value)
      || typeof candidate.value.expression !== 'string'
      || !sourceIsValid(candidate.value.location)
      || candidate.sourceOrder !== (candidate.source as { readonly start: { readonly offset: number } }).start.offset
      || !sameStructuralValue(candidate.source, candidate.value.location)) return false;
    return true;
  };
  if (!unsupported.every(validProjection)) return false;
  const matches = (candidate: unknown): boolean => {
    if (!isRecord(candidate)
      || candidate.operationId !== operation.id
      || candidate.category !== 'property'
      || candidate.status !== 'unsupported'
      || candidate.nodeId !== expectedNodeId) return false;
    return unsupported.some(property => isRecord(property)
      && candidate.source !== undefined
      && sameStructuralValue(candidate.source, property.source)
      && candidate.expression === (property.value as Record<string, unknown>).expression
      && candidate.reason === `${operation.kind} property ${property.name} is retained as source evidence but not applied by bounded layout projection`);
  };
  const exactGapSet = (candidateGaps: readonly unknown[]): boolean => {
    if (candidateGaps.length !== unsupported.length) return false;
    const used = new Set<number>();
    return unsupported.every(property => {
      const index = candidateGaps.findIndex((candidate, candidateIndex) => !used.has(candidateIndex)
        && isRecord(candidate)
        && candidate.operationId === operation.id
        && matches(candidate)
        && sameStructuralValue(candidate.source, property.source)
        && candidate.expression === (property.value as Record<string, unknown>).expression);
      if (index < 0) return false;
      used.add(index);
      return true;
    });
  };
  const programGaps = program.gaps.filter(gap => gap.operationId === operation.id
    && gap.category === 'property'
    && gap.status === 'unsupported');
  const authorityGaps = authorityGapsFor(evidenceAuthority, operation.id).filter(gap => gap.category === 'property'
    && gap.status === 'unsupported');
  return exactGapSet(programGaps) && exactGapSet(authorityGaps);
};

const stateSameOutsideCell = (
  before: HelperTableState,
  after: HelperTableState,
  rowIndex: number,
  column: number,
): boolean => {
  if (before.rows.length !== after.rows.length || rowIndex < 1 || column < 1) return false;
  const scrub = (state: HelperTableState): HelperTableState => ({
    ...state,
    rows: state.rows.map((row, rowOffset) => rowOffset === rowIndex - 1
      ? { ...row, cells: row.cells.map((cell, columnOffset) => columnOffset === column - 1 ? undefined : cell) }
      : row),
  });
  const scrubbedBefore = scrub(before);
  const scrubbedAfter = scrub(after);
  return sameKernelStateIgnoringUndefinedOptionals(scrubbedBefore, scrubbedAfter);
};

const sameKernelStateIgnoringUndefinedOptionals = (left: unknown, right: unknown): boolean => {
  try {
    return sameStructuralValue(JSON.parse(JSON.stringify(left)), JSON.parse(JSON.stringify(right)));
  } catch {
    return false;
  }
};

const validateCreatorProducerTransition = (
  program: X4UiLayoutProgram,
  operation: X4UiLayoutOperation,
): boolean => {
  const creatorFailure = (_stage: string): false => false;
  const transition = operation.kernel;
  const type = creatorTypeForOperation(operation.kind);
  if (!transition || !type || !transition.stateBefore || !transition.stateAfter) return creatorFailure('transition');
  const row = operation.rowId === undefined ? undefined : program.rows.find(candidate => candidate.id === operation.rowId);
  const cell = operation.cellId === undefined ? undefined : program.cells.find(candidate => candidate.id === operation.cellId);
  if (!row || !cell || row.rowIndex === undefined || cell.rowId !== row.id || cell.tableId !== operation.tableId || cell.rowIndex !== row.rowIndex) return creatorFailure('owner');
  const rowIndex = row.rowIndex;
  const column = cell.column;
  const sourceSemantics = operation.metadata.semantics as unknown as Record<string, unknown>;
  const sourceExact = Object.keys(operation.descriptorFacts).length > 0 || Object.keys(sourceSemantics).length > 0;
  if (!sourceExact) return creatorFailure('source');
  if (sourceExact && !stateSameOutsideCell(transition.stateBefore, transition.stateAfter, rowIndex, column)) return creatorFailure('outside-cell');
  const beforeCell = transition.stateBefore.rows[rowIndex - 1]?.cells[column - 1];
  const afterCell = transition.stateAfter.rows[rowIndex - 1]?.cells[column - 1];
  if (!beforeCell || !afterCell) return creatorFailure('cell');
  if (beforeCell.type !== 'cell') return creatorFailure('before-type');
  const input: {
    type: 'text' | 'editbox' | 'button' | 'icon';
    y?: number;
    height?: number;
    scaling?: boolean;
    affectRowHeight?: boolean;
    hotkey?: string;
    displayIcon?: boolean;
    minTextHeight?: number;
  } = { type };
  const y = staticOperationProperty(operation, 'y', 'number') ?? knownOperationFactValue(operation, 'outerY', 'number');
  const explicitHeight = staticOperationProperty(operation, 'height', 'number');
  const baseHeight = knownOperationFactValue(operation, 'baseHeight', 'number');
  const derivedOuterHeight = knownOperationFactValue(operation, 'outerHeight', 'number');
  // Helper's default height input is zero.  The producer's outerHeight fact is
  // the post-creation descriptor result, not the height argument to
  // specializeCell.  Replaying it as the input would turn a default-height
  // creator into a different kernel state (notably the raw descriptor-partial
  // createText branches with dynamic x/width).
  const height = explicitHeight ?? (
    type === 'text'
      ? 0
      : type === 'editbox'
        ? baseHeight ?? derivedOuterHeight
        : derivedOuterHeight
  );
  const scaling = staticOperationProperty(operation, 'scaling', 'boolean') ?? knownOperationFactValue(operation, 'scaling', 'boolean');
  const affect = staticOperationProperty(operation, 'affectrowheight', 'boolean') ?? knownOperationFactValue(operation, 'affectRowHeight', 'boolean');
  if (!isFiniteSafe(y) || !isFiniteSafe(height) || typeof scaling !== 'boolean') return creatorFailure(`facts:${String(y)}:${String(height)}:${String(scaling)}`);
  input.y = y;
  input.height = height;
  input.scaling = scaling;
  if (typeof affect === 'boolean') input.affectRowHeight = affect;
  if (type === 'editbox') {
    const hotkey = knownOperationStringFact(operation, 'hotkey');
    const displayIcon = knownOperationFactValue(operation, 'displayIcon', 'boolean');
    if (hotkey === undefined || typeof displayIcon !== 'boolean') return creatorFailure('editbox-hotkey-facts');
    input.hotkey = hotkey;
    input.displayIcon = displayIcon;
  }
  const minRowHeight = knownOperationFactValue(operation, 'minRowHeight', 'number');
  const operationOuterHeight = knownOperationFactValue(operation, 'outerHeight', 'number');
  const minTextHeightFact = operation.descriptorFacts.minTextHeight;
  const minTextHeightFloorFact = operation.descriptorFacts.minRowHeightFloor;
  const minTextHeight = knownOperationFactValue(operation, 'minTextHeight', 'number')
    ?? (minRowHeight !== undefined
      && minTextHeightFloorFact?.status === 'known'
      && minTextHeightFloorFact.expectedType === 'number'
      && afterCell.minTextHeight !== undefined
      && (operationOuterHeight === undefined || operationOuterHeight === minRowHeight)
      ? afterCell.minTextHeight
      : minTextHeightFact?.status === 'known' && minTextHeightFact.expectedType === 'number'
        ? minTextHeightFact.value
        : undefined);
  if (typeof minTextHeight === 'number') input.minTextHeight = minTextHeight;
  else if (afterCell.minTextHeight !== beforeCell.minTextHeight) return creatorFailure('min-text-height');
  const replayed = specializeCell(transition.stateBefore, rowIndex, column, input);
  if (replayed.status !== 'ok') return creatorFailure('replay-status');
  if (!sameKernelStateIgnoringUndefinedOptionals(transition.stateBefore.diagnostics, transition.stateAfter.diagnostics)) return creatorFailure('diagnostics');
  if (!sameKernelStateIgnoringUndefinedOptionals(replayed.value, transition.stateAfter)) return creatorFailure('replayed-state');
  return true;
};

const validateEditBoxDefaultProducerTransition = (
  operation: X4UiLayoutOperation,
): boolean => {
  const transition = producerTransition(operation);
  if (!transition || !transition.stateBefore || !transition.stateAfter) return false;
  const semantics = operation.metadata.semantics as unknown as Record<string, unknown>;
  if (!isRecord(semantics) || !Array.isArray(operation.metadata.arguments) || operation.metadata.arguments.length === 0) return false;
  const cellTypeFact = operation.descriptorFacts.cellType;
  if (cellTypeFact?.status !== 'known' || cellTypeFact.expectedType !== 'string' || typeof cellTypeFact.value !== 'string') return false;
  if (semantics.cellType === undefined || !isRecord(semantics.cellType)
    || semantics.cellType.status !== 'static' || semantics.cellType.type !== 'string' || semantics.cellType.value !== cellTypeFact.value) return false;
  const cellType = cellTypeFact.value;
  const propertyFact = operation.kind === 'setDefaultComplexCellProperties'
    ? operation.descriptorFacts.propertyName
    : undefined;
  const staticPropertyName = operation.kind === 'setDefaultComplexCellProperties'
    && isRecord(semantics.propertyName)
    && semantics.propertyName.status === 'static'
    && semantics.propertyName.type === 'string'
    && typeof semantics.propertyName.value === 'string'
    ? semantics.propertyName.value
    : undefined;
  const irrelevant = cellType !== 'editbox'
    || (operation.kind === 'setDefaultComplexCellProperties'
      && staticPropertyName !== undefined
      && staticPropertyName !== 'hotkey');
  if (irrelevant) {
    if (operation.kind === 'setDefaultCellProperties') {
      if (!exactKeys(operation.descriptorFacts as Record<string, unknown>, ['cellType'])) return false;
    } else {
      if (!exactKeys(operation.descriptorFacts as Record<string, unknown>, ['cellType', 'propertyName'])) return false;
      if (cellType === 'editbox'
        && (propertyFact?.status !== 'known'
          || propertyFact.expectedType !== 'string'
          || propertyFact.value !== staticPropertyName)) return false;
    }
    return sameKernelStateIgnoringUndefinedOptionals(transition.stateBefore, transition.stateAfter);
  }
  if (cellType !== 'editbox') return false;
  if (operation.kind === 'setDefaultCellProperties'
    ? !exactKeys(operation.descriptorFacts as Record<string, unknown>, ['cellType'], ['height', 'scaling'])
    : !exactKeys(operation.descriptorFacts as Record<string, unknown>, ['cellType', 'propertyName'], ['hotkey', 'displayIcon'])) return false;
  const height = operation.kind === 'setDefaultCellProperties'
    ? knownOperationFactValue(operation, 'height', 'number')
    : undefined;
  const scaling = operation.kind === 'setDefaultCellProperties'
    ? knownOperationFactValue(operation, 'scaling', 'boolean')
    : undefined;
  const hotkey = operation.kind === 'setDefaultComplexCellProperties'
    ? knownOperationStringFact(operation, 'hotkey')
    : undefined;
  const displayIcon = operation.kind === 'setDefaultComplexCellProperties'
    ? knownOperationFactValue(operation, 'displayIcon', 'boolean')
    : undefined;
  if (operation.kind === 'setDefaultComplexCellProperties') {
    if (propertyFact?.status !== 'known' || propertyFact.expectedType !== 'string' || propertyFact.value !== 'hotkey') return false;
    if (semantics.propertyName === undefined || !isRecord(semantics.propertyName)
      || semantics.propertyName.status !== 'static' || semantics.propertyName.type !== 'string' || semantics.propertyName.value !== 'hotkey') return false;
  }
  const sourceHeight = operation.kind === 'setDefaultCellProperties' ? staticOperationProperty(operation, 'height', 'number') : undefined;
  const sourceScaling = operation.kind === 'setDefaultCellProperties' ? staticOperationProperty(operation, 'scaling', 'boolean') : undefined;
  const sourceHotkey = operation.kind === 'setDefaultComplexCellProperties' ? staticOperationStringProperty(operation, 'hotkey') : undefined;
  const sourceDisplayIcon = operation.kind === 'setDefaultComplexCellProperties' ? staticOperationProperty(operation, 'displayicon', 'boolean') : undefined;
  if (operation.kind === 'setDefaultCellProperties') {
    if (descriptorFactExists(operation, 'height') !== sourcePropertyExists(operation, 'height')) return false;
    if (descriptorFactExists(operation, 'scaling') !== sourcePropertyExists(operation, 'scaling')) return false;
  } else {
    if (descriptorFactExists(operation, 'hotkey') !== sourcePropertyExists(operation, 'hotkey')) return false;
    if (descriptorFactExists(operation, 'displayIcon') !== sourcePropertyExists(operation, 'displayicon')) return false;
  }
  if (height !== undefined && sourceHeight === undefined) return false;
  if (scaling !== undefined && sourceScaling === undefined) return false;
  if (hotkey !== undefined && sourceHotkey === undefined) return false;
  if (displayIcon !== undefined && sourceDisplayIcon === undefined) return false;
  if (sourceHeight !== undefined && height !== sourceHeight) return false;
  if (sourceScaling !== undefined && scaling !== sourceScaling) return false;
  if (sourceHotkey !== undefined && hotkey !== sourceHotkey) return false;
  if (sourceDisplayIcon !== undefined && displayIcon !== sourceDisplayIcon) return false;
  const replayed = operation.kind === 'setDefaultCellProperties'
    ? setDefaultCellProperties(transition.stateBefore, 'editbox', {
      ...(height === undefined ? {} : { height }),
      ...(scaling === undefined ? {} : { scaling }),
    })
    : setDefaultComplexCellProperties(transition.stateBefore, 'editbox', 'hotkey', {
      ...(hotkey === undefined ? {} : { hotkey }),
      ...(displayIcon === undefined ? {} : { displayIcon }),
    });
  return replayed.status === 'ok' && sameKernelStateIgnoringUndefinedOptionals(replayed.value, transition.stateAfter);
};

const validateSetHotkeyProducerTransition = (
  program: X4UiLayoutProgram,
  operation: X4UiLayoutOperation,
): boolean => {
  const transition = producerTransition(operation);
  if (!transition || !transition.stateBefore || !transition.stateAfter || operation.tableId === undefined || operation.rowId === undefined || operation.cellId === undefined) return false;
  const row = program.rows.find(candidate => candidate.id === operation.rowId);
  const cell = program.cells.find(candidate => candidate.id === operation.cellId);
  if (!row || !cell || row.tableId !== operation.tableId || cell.tableId !== operation.tableId || cell.rowId !== row.id || row.rowIndex === undefined || cell.rowIndex !== row.rowIndex) return false;
  const contentKind = cell.descriptorFacts.contentKind;
  const operationContentKind = operation.descriptorFacts.contentKind;
  if (contentKind?.status === 'known' && contentKind.expectedType === 'string' && contentKind.value === 'button') {
    const semantics = operation.metadata.semantics as unknown as Record<string, unknown>;
    const semanticsCell = isRecord(semantics) && isRecord(semantics.cell) ? semantics.cell : undefined;
    const semanticsReference = semanticsCell && isRecord(semanticsCell.reference) ? semanticsCell.reference : undefined;
    if (!exactKeys(operation.descriptorFacts as Record<string, unknown>, ['contentKind'])
      || !sameStructuralValue(operationContentKind, contentKind)
      || !sameStructuralValue(operation.metadata.receiver?.reference, cell.identity)
      || !sameStructuralValue(semanticsReference, cell.identity)
      || transition.stateBefore.rows[row.rowIndex - 1]?.cells[cell.column - 1]?.type !== 'button'
      || transition.stateAfter.rows[row.rowIndex - 1]?.cells[cell.column - 1]?.type !== 'button') return false;
    return sameKernelStateIgnoringUndefinedOptionals(transition.stateBefore, transition.stateAfter);
  }
  if (!stateSameOutsideCell(transition.stateBefore, transition.stateAfter, row.rowIndex, cell.column)) return false;
  const semantics = operation.metadata.semantics as unknown as Record<string, unknown>;
  if (!exactKeys(operation.descriptorFacts as Record<string, unknown>, ['hotkey'], ['displayIcon'])) return false;
  const sourceHotkey = sourceProperty(operation, 'hotkey');
  const sourceHotkeyValue = sourceHotkey && isRecord(sourceHotkey.value) ? sourceHotkey.value : undefined;
  const winningHotkeyValue = sourceHotkeyValue || semantics.hotkey;
  if (winningHotkeyValue === undefined || !isRecord(winningHotkeyValue)
    || winningHotkeyValue.status !== 'static' || winningHotkeyValue.type !== 'string'
    || typeof winningHotkeyValue.value !== 'string') return false;
  const hotkey = winningHotkeyValue.value;
  const hotkeyFact = operation.descriptorFacts.hotkey;
  if (hotkeyFact?.status !== 'known' || hotkeyFact.expectedType !== 'string'
    || hotkeyFact.value !== hotkey
    || !sameStructuralValue(hotkeyFact.source, winningHotkeyValue.location)
    || hotkeyFact.expression !== winningHotkeyValue.expression) return false;
  if (!sourceHotkey && (!isRecord(semantics.hotkey)
    || semantics.hotkey.status !== 'static' || semantics.hotkey.type !== 'string'
    || semantics.hotkey.value !== hotkey)) return false;
  const displayIcon = knownOperationFactValue(operation, 'displayIcon', 'boolean');
  const sourceDisplayIconProperty = sourceProperty(operation, 'displayicon');
  const sourceDisplayIcon = staticOperationProperty(operation, 'displayicon', 'boolean');
  if (descriptorFactExists(operation, 'displayIcon') !== sourcePropertyExists(operation, 'displayicon')) return false;
  if (displayIcon !== undefined && sourceDisplayIcon === undefined) return false;
  if (sourceDisplayIcon !== undefined && displayIcon !== sourceDisplayIcon) return false;
  const argumentHotkey = isRecord(semantics.hotkey)
    && semantics.hotkey.status === 'static'
    && semantics.hotkey.type === 'string'
    && typeof semantics.hotkey.value === 'string'
    ? semantics.hotkey.value
    : hotkey;
  const replayed = setCellHotkey(
    transition.stateBefore,
    row.rowIndex,
    cell.column,
    argumentHotkey,
    sourceHotkey || sourceDisplayIconProperty
      ? {
        ...(sourceHotkey ? { hotkey } : {}),
        ...(sourceDisplayIconProperty ? { displayIcon } : {}),
      }
      : undefined,
  );
  return replayed.status === 'ok' && sameKernelStateIgnoringUndefinedOptionals(replayed.value, transition.stateAfter);
};

const validateCompleteProducerChain = (
  program: X4UiLayoutProgram,
  table: X4UiLayoutTableNode,
): boolean => {
  const chainFailure = (_stage: string): false => false;
  const chainCandidates = program.operations
    .filter(operation => KERNEL_PRODUCER_KINDS.has(operation.kind) && operationBelongsToTable(program, operation, table))
  const chain = chainCandidates.some(operation => operation.localExpansion !== undefined)
    ? chainCandidates
    : chainCandidates.slice().sort((left, right) => left.modelOrder - right.modelOrder);
  const deterministic = chain.filter(operation => operation.status === 'applied' || (operation.status === 'unresolved' && producerTransition(operation) !== undefined));
  if (deterministic.length === 0 || deterministic[0].kind !== 'addTable') return chainFailure('first-kind');
  const first = producerTransition(deterministic[0]);
  if (!first || first.stateBefore !== undefined || first.stateAfter === undefined || first.stateAfter.rows.length !== 0) return chainFailure('first-shape');
  let previous = first.stateAfter;
  for (let index = 1; index < chain.length; index += 1) {
    const operation = chain[index];
    if (operation.status === 'conditional' || operation.status === 'unreachable' || operation.status === 'rejected'
      || (operation.status === 'unresolved' && producerTransition(operation) === undefined)) {
      continue;
    }
    const transition = producerTransition(operation);
    if (!transition || transition.stateBefore === undefined || transition.stateAfter === undefined) return chainFailure(`transition:${operation.id}`);
    if (!sameKernelStateIgnoringUndefinedOptionals(transition.stateBefore, previous)) return chainFailure(`continuity:${operation.id}`);
    if (operation.kind === 'addRow') {
      if (transition.stateBefore.rows.length === 0) {
        const finalized = finalizeHelperTable(transition.stateBefore);
        if (finalized.status !== 'ok' || !kernelStateAppendsRowFromFinalized(finalized.value, transition.stateAfter)) return chainFailure(`first-row:${operation.id}`);
      } else if (!kernelStateAppendsRow(transition.stateBefore, transition.stateAfter)) {
        return chainFailure(`row:${operation.id}`);
      }
    } else if (operation.kind === 'setColSpan') {
      if (!validateSetColSpanProducerTransition(program, operation)) return chainFailure(`span:${operation.id}`);
    } else if (operation.kind === 'setDefaultCellProperties' || operation.kind === 'setDefaultComplexCellProperties') {
      if (!validateEditBoxDefaultProducerTransition(operation)) return chainFailure(`editbox-default:${operation.id}`);
    } else if (operation.kind === 'setHotkey') {
      if (!validateSetHotkeyProducerTransition(program, operation)) return chainFailure(`set-hotkey:${operation.id}`);
    } else if (isCreatorKind(operation.kind)) {
      if (!validateCreatorProducerTransition(program, operation)) return chainFailure(`creator:${operation.id}`);
    } else if (!sameStructuralValue(transition.stateBefore.diagnostics, transition.stateAfter.diagnostics)) {
      return chainFailure(`diagnostics:${operation.id}`);
    }
    previous = transition.stateAfter;
  }
  if (!sameKernelStateIgnoringUndefinedOptionals(previous, table.kernelState)) return chainFailure('final');
  return true;
};

const validateReserveProducerChain = (
  program: X4UiLayoutProgram,
  state: HelperTableState,
  diagnostic: HelperTableState['diagnostics'][number],
  table: X4UiLayoutTableNode,
): boolean => validateCompleteProducerChain(program, table)
  && sameStructuralValue(state, table.kernelState)
  && state.diagnostics.some(candidate => sameDiagnostic(candidate, diagnostic));

const validateSetColSpanProducerTransition = (
  program: X4UiLayoutProgram,
  operation: X4UiLayoutOperation,
): boolean => {
  const spanFailure = (): false => false;
  const transition = producerTransition(operation);
  if (!transition || !transition.stateBefore || !transition.stateAfter) return spanFailure();
  const previousByOrder = program.operations
    .filter(candidate => candidate.tableId === operation.tableId && KERNEL_PRODUCER_KINDS.has(candidate.kind) && candidate.modelOrder < operation.modelOrder && producerTransition(candidate) !== undefined)
    .sort((left, right) => right.modelOrder - left.modelOrder)[0];
  const previousTransition = previousByOrder === undefined ? undefined : producerTransition(previousByOrder);
  if (previousTransition?.stateAfter !== undefined && !sameStructuralValue(previousTransition.stateAfter, transition.stateBefore)) return spanFailure();
  const row = program.rows.find(candidate => candidate.id === operation.rowId);
  const cell = program.cells.find(candidate => candidate.id === operation.cellId);
  if (!row || !cell || row.tableId !== operation.tableId || cell.tableId !== operation.tableId || cell.rowId !== row.id || cell.rowIndex !== row.rowIndex || row.rowIndex === undefined) return spanFailure();
  const semantics = operation.metadata.semantics as unknown as Record<string, unknown>;
  if (!isRecord(semantics) || Object.keys(semantics).length === 0 || !Array.isArray(operation.metadata.arguments) || operation.metadata.arguments.length === 0) return spanFailure();
  const spanFact = operation.descriptorFacts.span;
  if (spanFact?.status !== 'known' || spanFact.expectedType !== 'number' || !isSafeIntegerAtLeast(spanFact.value, 1)) return spanFailure();
  const replayed = setCellColSpan(transition.stateBefore, row.rowIndex, cell.column, spanFact.value);
  return replayed.status === 'ok' && sameKernelStateIgnoringUndefinedOptionals(replayed.value, transition.stateAfter);
};

const validateSerializable = (
  value: unknown,
  depth = 0,
  active = new WeakSet<object>(),
  completed = new WeakSet<object>(),
): boolean => {
  if (depth > SERIALIZABLE_MAX_DEPTH || value === undefined || typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint') return false;
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (value instanceof Uint8Array || value instanceof ArrayBuffer || ArrayBuffer.isView(value)) return false;
  if (typeof value !== 'object') return false;
  const object = value as object;
  if (completed.has(object)) return true;
  if (active.has(object)) return false;
  active.add(object);
  const valid = Array.isArray(value)
    ? value.every(item => validateSerializable(item, depth + 1, active, completed))
    : isRecord(value) && Object.keys(value).every(key => validateSerializable(value[key], depth + 1, active, completed));
  active.delete(object);
  if (valid) completed.add(object);
  return valid;
};

const producerFactMatchesNodeFact = (
  nodeFact: X4UiLayoutDescriptorFact | undefined,
  producerFact: X4UiLayoutDescriptorFact | undefined,
  exact = false,
): boolean => {
  if (nodeFact === undefined || producerFact === undefined) return nodeFact === producerFact;
  if (exact) return sameStructuralValue(nodeFact, producerFact);
  if (nodeFact.status !== producerFact.status || nodeFact.expectedType !== producerFact.expectedType) return false;
  if (nodeFact.status === 'known' && producerFact.status === 'known') return sameStructuralValue(nodeFact.value, producerFact.value);
  return nodeFact.status === 'unavailable' && producerFact.status === 'unavailable';
};

const latestProducerFact = (
  operations: readonly X4UiLayoutOperation[],
  key: string,
): X4UiLayoutDescriptorFact | undefined => {
  const aliases: Readonly<Record<string, readonly string[]>> = {
    font: ['font', 'textFont'],
    fontsize: ['fontsize', 'textFontsize'],
    halign: ['halign', 'textHalign'],
    wordwrap: ['wordwrap'],
    primaryContent: ['primaryContent', 'text'],
    secondaryContent: ['secondaryContent', 'text2'],
  };
  const names = [key, ...(aliases[key] || [])];
  for (let index = operations.length - 1; index >= 0; index -= 1) {
    for (const name of names) {
      const fact = operations[index].descriptorFacts[name];
      if (fact !== undefined) return fact;
    }
  }
  return undefined;
};

const sourceLocationContains = (
  outer: X4UiSceneSourceLocation,
  inner: X4UiSceneSourceLocation,
): boolean => outer.file === inner.file
  && outer.sourcePath === inner.sourcePath
  && outer.start.offset <= inner.start.offset
  && inner.end.offset <= outer.end.offset;

const tableReserveFinalizationReconciled = (
  program: X4UiLayoutProgram,
  table: X4UiLayoutTableNode,
  operation: X4UiLayoutOperation,
  producerFact: X4UiLayoutDescriptorFact | undefined,
): boolean => {
  const nodeFact = table.descriptorFacts.reserveScrollBar;
  if (nodeFact?.status !== 'known'
    || nodeFact.expectedType !== 'boolean'
    || nodeFact.provenance !== 'source-pinned-default'
    || nodeFact.value !== false
    || nodeFact.expression !== 'Helper.finalizeTableColumnWidths(self).properties.reserveScrollBar'
    || !sameStructuralValue(nodeFact.source, table.source)
    || nodeFact.sourcePin?.sourcePath !== X4_LAYOUT_PROVENANCE.helperSourcePath
    || nodeFact.sourcePin.lineStart !== 3170
    || nodeFact.sourcePin.lineEnd !== 3170
    || producerFact?.status !== 'known'
    || producerFact.expectedType !== 'boolean'
    || producerFact.value === nodeFact.value
    || operation.kind !== 'addTable'
    || operation.tableId !== table.id
    || operation.frameId !== undefined
    || operation.rowId !== undefined
    || operation.cellId !== undefined
    || !table.operationIds.includes(operation.id)
    || !sameStructuralValue(operation.source, table.source)
    || program.operations.filter(candidate => candidate.kind === 'addTable' && candidate.tableId === table.id).length !== 1
    || table.kernelState?.final !== true
    || table.kernelState.properties.reserveScrollBar !== nodeFact.value) return false;
  const semantics = operation.metadata.semantics as unknown as Record<string, unknown>;
  if (!isRecord(semantics) || !Array.isArray(semantics.properties)) return false;
  const property = semantics.properties.find(candidate => isRecord(candidate) && candidate.normalizedName === 'reservescrollbar');
  if (producerFact.provenance === 'source-pinned-default') {
    return property === undefined
      && producerFact.expression === String(producerFact.value)
      && sameStructuralValue(producerFact.source, operation.source)
      && producerFact.sourcePin?.sourcePath === X4_LAYOUT_PROVENANCE.helperSourcePath
      && producerFact.sourcePin.lineStart === 3170
      && producerFact.sourcePin.lineEnd === 3170;
  }
  if (producerFact.provenance !== 'source-literal' || producerFact.sourcePin !== undefined || !isRecord(property) || !isRecord(property.value)) return false;
  const value = property.value;
  if (value.status !== 'static'
    || value.type !== 'boolean'
    || value.value !== producerFact.value
    || typeof value.expression !== 'string'
    || !isRecord(value.location)
    || !sourceIsValid(value.location)
    || !sourceLocationContains(operation.source, value.location)
    || producerFact.expression !== value.expression
    || !sameStructuralValue(producerFact.source, value.location)) return false;
  if (value.sourceLiteral !== undefined
    && (!isRecord(value.sourceLiteral)
      || !sourceIsValid(value.sourceLiteral)
      || !sameStructuralValue(value.sourceLiteral, value.location)
      || !sameStructuralValue(producerFact.source, value.sourceLiteral))) return false;
  if (value.sourceOrder !== undefined
    && (!isSafeIntegerAtLeast(value.sourceOrder, 0) || value.sourceOrder !== value.location.start.offset)) return false;
  return true;
};

const validateProducerNodeFacts = (
  program: X4UiLayoutProgram,
  unmaterializedRows: ReadonlySet<string> = new Set<string>(),
): boolean => {
  const fail = (_stage: string): false => false;
  const operationFor = (ids: readonly string[], kind: X4UiLayoutOperation['kind']): X4UiLayoutOperation | undefined => {
    const matches = program.operations
      .filter(operation => ids.includes(operation.id) && operation.kind === kind)
      .sort((left, right) => left.modelOrder - right.modelOrder);
    return matches.length === 1 ? matches[0] : undefined;
  };
  const factsMatch = (
    node: X4UiLayoutFrameNode | X4UiLayoutTableNode | X4UiLayoutRowNode | X4UiLayoutCellNode,
    operation: X4UiLayoutOperation,
    keys: readonly string[],
    exact = false,
  ): boolean => keys.every(key => {
    const producerFact = latestProducerFact([operation], key);
    return producerFact === undefined || producerFactMatchesNodeFact(node.descriptorFacts[key], producerFact, exact);
  });
  for (const frame of program.frames) {
    if (frame.width === undefined && frame.height === undefined && frame.tableIds.length === 0
      && frame.status !== 'projected' && frame.status !== 'applied') continue;
    const operation = operationFor(frame.operationIds, 'createFrameHandle');
    if (!operation || operation.frameId !== frame.id || !sameStructuralValue(operation.source, frame.source)
      || !factsMatch(frame, operation, ['x', 'y', 'width', 'height', 'layer', 'autoFrameHeight'])
      || !knownFactMatches(frame.descriptorFacts, 'width', frame.width, 'number')
      || !knownFactMatches(frame.descriptorFacts, 'height', frame.height, 'number')) return fail(`frame:${frame.id}`);
  }
  for (const table of program.tables) {
    if (table.status === 'refused' && table.kernelState === undefined) continue;
    const operation = operationFor(table.operationIds, 'addTable');
    const reserveFact = operation === undefined ? undefined : latestProducerFact([operation], 'reserveScrollBar');
    const tableFactsMatch = operation !== undefined
      && factsMatch(table, operation, ['x', 'y', 'requestedWidth', 'maxVisibleHeight', 'scaling', 'tabOrder', 'highlightMode', 'backgroundID', 'backgroundColor'])
      && (producerFactMatchesNodeFact(table.descriptorFacts.reserveScrollBar, reserveFact)
        || tableReserveFinalizationReconciled(program, table, operation, reserveFact));
    if (!operation || operation.tableId !== table.id || !sameStructuralValue(operation.source, table.source)
      || !tableFactsMatch
      || !knownFactMatches(table.descriptorFacts, 'requestedWidth', table.requestedWidth, 'number')) return fail(`table:${table.id}`);
  }
  for (const row of program.rows) {
    if (unmaterializedRows.has(row.id)
      || (row.status === 'refused' && row.kernelState === undefined && row.rowIndex === undefined && row.cellIds.length === 0)) continue;
    const operation = operationFor(row.operationIds, 'addRow');
    if (!operation || operation.rowId !== row.id || !sameStructuralValue(operation.source, row.source)
      || !factsMatch(row, operation, ['paddingTop', 'paddingBottom', 'borderBelow', 'fixed', 'scaling'])) return fail(`row:${row.id}`);
  }
  for (const cell of program.cells) {
    const operations = program.operations
      .filter(operation => [...cell.operationIds, ...cell.metadataOperationIds].includes(operation.id))
      .sort((left, right) => left.modelOrder - right.modelOrder);
    const creator = operations.find(operation => operation.kind === 'createText' || operation.kind === 'createEditBox' || operation.kind === 'createButton' || operation.kind === 'createIcon');
    const row = cell.rowId === undefined ? undefined : program.rows.find(candidate => candidate.id === cell.rowId);
    const expectedSource = cell.identity !== undefined ? cell.identity.source : row?.source;
    if (expectedSource === undefined || !sameStructuralValue(expectedSource, cell.source)) return fail(`cell-source:${cell.id}`);
    if (!creator) continue;
    const creatorMaterialized = creator.status === 'applied' || (creator.status === 'unresolved' && creator.kernel !== undefined);
    if (!creatorMaterialized) continue;
    const hotkeyOperations = operations.filter(operation => operation.kind === 'setHotkey' && (operation.status === 'applied' || (operation.status === 'unresolved' && operation.kernel !== undefined)));
    const requiredCreatorFacts = [
      'contentKind', 'outerX', 'outerY', 'outerWidth', 'outerHeight', 'scaling', 'affectRowHeight',
      'primaryContent', 'text', 'text2', 'font', 'fontsize', 'halign', 'wordwrap',
      'defaultText', 'description', 'maxChars', 'selectTextOnActivation', 'icon', 'active',
      ...(creator.kind === 'createEditBox' ? ['baseHeight', 'baseScaling', 'hotkey', 'displayIcon'] : []),
      ...(creator.kind === 'createText' ? ['minRowHeight', 'minRowHeightFloor'] : []),
    ];
    if (requiredCreatorFacts.some(key => creator.descriptorFacts[key] === undefined)) return fail(`cell-required:${cell.id}:${creator.kind}`);
    const directKeys = [
      'contentKind', 'outerX', 'outerY', 'scaling',
      ...(creator.kind === 'createButton' || creator.kind === 'createIcon' || creator.descriptorFacts.affectRowHeight?.status === 'known' ? ['affectRowHeight'] : []),
      'defaultText', 'description', 'maxChars', 'selectTextOnActivation', 'icon', 'active',
    ];
    if (!factsMatch(cell, creator, directKeys)) return fail(`cell-direct:${cell.id}:${creator.kind}`);
    const table = cell.tableId === undefined ? undefined : program.tables.find(candidate => candidate.id === cell.tableId);
    const scaling = cell.kernelState?.scaling;
    const creatorOuterHeight = creator.descriptorFacts.outerHeight;
    const cellOuterHeight = cell.descriptorFacts.outerHeight;
    const creatorMinTextHeight = creator.descriptorFacts.minTextHeight;
    const cellMinTextHeight = cell.descriptorFacts.minTextHeight;
    const zeroHeightTextHasKnownHeightFacts = creator.kind === 'createText'
      && cell.kernelState?.type === 'text'
      && cell.kernelState.height === 0
      && creatorOuterHeight?.status === 'known'
      && creatorOuterHeight.expectedType === 'number'
      && cellOuterHeight?.status === 'known'
      && cellOuterHeight.expectedType === 'number';
    const zeroHeightTextHasAlreadyScaledCandidate = creator.kind === 'createText'
      && cell.kernelState?.type === 'text'
      && cell.kernelState.height === 0
      && typeof cell.kernelState.minTextHeight === 'number'
      && isFiniteSafe(cell.kernelState.minTextHeight)
      && creatorMinTextHeight?.status === 'known'
      && creatorMinTextHeight.expectedType === 'number'
      && cellMinTextHeight?.status === 'known'
      && cellMinTextHeight.expectedType === 'number'
      && creatorOuterHeight?.status === 'known'
      && creatorOuterHeight.expectedType === 'number'
      && cellOuterHeight?.status === 'known' && cellOuterHeight.expectedType === 'number'
      && creatorMinTextHeight.value === cell.kernelState.minTextHeight
      && cellMinTextHeight.value === cell.kernelState.minTextHeight
      && creatorOuterHeight.value === cell.kernelState.minTextHeight
      && cellOuterHeight.value === cell.kernelState.minTextHeight
      && sameStructuralValue(creatorMinTextHeight, cellMinTextHeight)
      && sameStructuralValue(creatorMinTextHeight, creatorOuterHeight)
      && sameStructuralValue(creatorOuterHeight, cellOuterHeight);
    if (zeroHeightTextHasKnownHeightFacts) {
      if (!zeroHeightTextHasAlreadyScaledCandidate) return fail(`cell-zero-text-height:${cell.id}`);
    } else if (creatorOuterHeight?.status === 'known' && creatorOuterHeight.expectedType === 'number'
      && cellOuterHeight?.status === 'known' && cellOuterHeight.expectedType === 'number'
      && table?.kernelState && typeof scaling === 'boolean') {
      const explicitHeight = staticOperationProperty(creator, 'height', 'number');
      const rawHeight = explicitHeight
        ?? (creator.kind === 'createEditBox' ? knownOperationFactValue(creator, 'baseHeight', 'number') : undefined)
        ?? creatorOuterHeight.value;
      const scaledHeight = scaleY(rawHeight, table.kernelState.metrics.uiScale, scaling);
      const effectiveHotkeyFact = latestProducerFact(hotkeyOperations, 'hotkey') || creator.descriptorFacts.hotkey;
      const effectiveDisplayIconFact = latestProducerFact(hotkeyOperations, 'displayIcon') || creator.descriptorFacts.displayIcon;
      const displayedHotkey = creator.kind === 'createEditBox'
        && effectiveHotkeyFact?.status === 'known'
        && effectiveHotkeyFact.expectedType === 'string'
        && typeof effectiveHotkeyFact.value === 'string'
        && effectiveHotkeyFact.value !== ''
        && effectiveDisplayIconFact?.status === 'known'
        && effectiveDisplayIconFact.expectedType === 'boolean'
        && effectiveDisplayIconFact.value === true;
      const expectedHeight = scaledHeight.status === 'ok' && displayedHotkey
        ? Math.max(scaledHeight.value, 23)
        : scaledHeight.status === 'ok' ? scaledHeight.value : undefined;
      if (scaledHeight.status !== 'ok' || cellOuterHeight.value !== expectedHeight) return fail(`cell-outer-height-scaled:${cell.id}`);
      if (explicitHeight !== undefined && creatorOuterHeight.value !== explicitHeight) return fail(`cell-outer-height-source:${cell.id}`);
    }
    const outerWidth = cell.descriptorFacts.outerWidth;
    const creatorOuterWidth = creator.descriptorFacts.outerWidth;
    const explicitWidth = staticOperationProperty(creator, 'width', 'number');
    if (outerWidth?.status === 'known') {
      if (explicitWidth !== undefined && explicitWidth !== 0) {
        const scaledWidth = table?.kernelState && typeof scaling === 'boolean'
          ? scaleX(explicitWidth, table.kernelState.metrics.uiScale, scaling)
          : undefined;
        if (scaledWidth?.status !== 'ok'
          || outerWidth.value !== scaledWidth.value
          || (outerWidth.provenance !== 'source-literal' && outerWidth.provenance !== 'direct-helper-scale')) return fail(`cell-outer-width-explicit:${cell.id}`);
        if (creatorOuterWidth?.status === 'known' && creatorOuterWidth.expectedType === 'number' && creatorOuterWidth.value !== explicitWidth) return fail(`cell-outer-width-source:${cell.id}`);
      } else if (!isHelperOmittedWidthFact(outerWidth)) {
        return fail(`cell-outer-width-derived:${cell.id}`);
      } else if (creatorOuterWidth?.status === 'known' && creatorOuterWidth.expectedType === 'number' && creatorOuterWidth.value !== 0) {
        return fail(`cell-outer-width-source:${cell.id}`);
      }
    }
    if ((creator.kind === 'createText' || creator.kind === 'createEditBox')
      && creator.descriptorFacts.affectRowHeight?.status === 'unavailable') {
      const finalized = cell.descriptorFacts.affectRowHeight;
      const specializationPin = finalized?.sourcePin;
      if (finalized?.status !== 'known'
        || cell.kernelState === undefined
        || finalized.value !== cell.kernelState.affectRowHeight
        || finalized.provenance !== 'source-pinned-default'
        || specializationPin?.sourcePath !== X4_LAYOUT_PROVENANCE.helperSourcePath
        || specializationPin.lineStart !== 5432
        || specializationPin.lineEnd !== 5469) return fail(`cell-affect-final:${cell.id}`);
    }
    const factOperations = operations.filter(operation => operation.kind === 'setText' || operation.kind === 'setText2' || operation.status === 'applied' || (operation.status === 'unresolved' && operation.kernel !== undefined));
    for (const key of ['font', 'fontsize', 'halign', 'wordwrap', 'primaryContent', 'text', 'text2', 'defaultText', 'description', 'maxChars', 'selectTextOnActivation', 'icon', 'active']) {
      const producerFact = latestProducerFact(factOperations, key);
      if (producerFact !== undefined && !producerFactMatchesNodeFact(cell.descriptorFacts[key], producerFact)) return fail(`cell:${cell.id}:${key}`);
    }
    const hotkeyFact = latestProducerFact(hotkeyOperations, 'hotkey');
    const displayIconFact = latestProducerFact(hotkeyOperations, 'displayIcon');
    if (hotkeyFact !== undefined && !producerFactMatchesNodeFact(cell.descriptorFacts.hotkey, hotkeyFact)) return fail(`cell:${cell.id}:hotkey`);
    if (displayIconFact !== undefined && !producerFactMatchesNodeFact(cell.descriptorFacts.displayIcon, displayIconFact)) return fail(`cell:${cell.id}:displayIcon`);
  }
  return true;
};

const validateValueReference = (value: unknown): boolean => {
  if (!isRecord(value) || !exactKeys(value, ['kind', 'path', 'origin', 'source'], ['parentPath', 'relatedPath', 'index', 'helperAliasSource', 'helperRuntimeAvailability'])) return false;
  if (!['global', 'menu', 'frame', 'table', 'row', 'cell', 'object', 'handler', 'unknown'].includes(String(value.kind)) || !['global', 'literal', 'call', 'alias', 'index', 'property', 'unknown'].includes(String(value.origin)) || typeof value.path !== 'string' || value.path.length === 0 || !sourceIsValid(value.source)) return false;
  if (value.parentPath !== undefined && typeof value.parentPath !== 'string') return false;
  if (value.relatedPath !== undefined && typeof value.relatedPath !== 'string') return false;
  if (value.helperRuntimeAvailability !== undefined && value.helperRuntimeAvailability !== 'unverified') return false;
  if (value.helperAliasSource !== undefined && !sourceIsValid(value.helperAliasSource)) return false;
  return value.index === undefined || validateLayoutValue(value.index);
};

const DIRECT_HELPER_SCALE_CALL_NAMES = ['scaleX', 'scaleY', 'scaleFont'] as const;
const LUA_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

const isLuaWhitespace = (value: string): boolean => value === ' '
  || value === '\t'
  || value === '\r'
  || value === '\n'
  || value === '\v'
  || value === '\f';

const directHelperScaleCallMatches = (expression: string, callName: string): boolean => {
  const end = expression.length;
  let cursor = 0;
  const skipWhitespace = (): void => {
    while (cursor < end && isLuaWhitespace(expression[cursor] ?? '')) cursor += 1;
  };
  const readToken = (token: string): boolean => {
    if (expression.slice(cursor, cursor + token.length) !== token) return false;
    cursor += token.length;
    return true;
  };
  skipWhitespace();
  if (!readToken('Helper')) return false;
  skipWhitespace();
  if (!readToken('.')) return false;
  skipWhitespace();
  if (!readToken(callName)) return false;
  skipWhitespace();
  if (expression[cursor] !== '(') return false;
  const opening = cursor;
  let depth = 0;
  let quote: '"' | "'" | undefined;
  let escaped = false;
  for (; cursor < end; cursor += 1) {
    const character = expression[cursor];
    if (quote !== undefined) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === quote) quote = undefined;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === '(') depth += 1;
    else if (character === ')') {
      depth -= 1;
      if (depth < 0) return false;
      if (depth === 0) {
        cursor += 1;
        while (cursor < end && isLuaWhitespace(expression[cursor] ?? '')) cursor += 1;
        return opening < cursor && cursor === end;
      }
    }
  }
  return false;
};

const validateDirectHelperScaleResult = (
  layoutValue: Record<string, unknown>,
  directResult: unknown,
): boolean => {
  if (!closedDataRecord(directResult, ['callName', 'callSource', 'callExpression', 'bindingName', 'bindingSource'])) return false;
  const callName = directResult.callName;
  const callSource = directResult.callSource;
  const callExpression = directResult.callExpression;
  const bindingSource = directResult.bindingSource;
  const location = layoutValue.location;
  if (!DIRECT_HELPER_SCALE_CALL_NAMES.includes(callName as typeof DIRECT_HELPER_SCALE_CALL_NAMES[number])
    || typeof callName !== 'string'
    || typeof callExpression !== 'string'
    || callExpression.length === 0
    || typeof directResult.bindingName !== 'string'
    || !LUA_IDENTIFIER.test(directResult.bindingName)
    || !closedSourceIsValid(callSource)
    || !closedSourceIsValid(bindingSource)
    || !closedSourceIsValid(location)
    || layoutValue.status !== 'dynamic'
    || layoutValue.type !== 'expression'
    || layoutValue.expression !== directResult.bindingName
    || !directHelperScaleCallMatches(callExpression, callName)) return false;
  if (callSource.file !== location.file
    || callSource.sourcePath !== location.sourcePath
    || bindingSource.file !== location.file
    || bindingSource.sourcePath !== location.sourcePath
    || bindingSource.start.offset >= bindingSource.end.offset
    || callSource.start.offset >= callSource.end.offset
    || bindingSource.end.offset > callSource.start.offset
    || callSource.end.offset > location.start.offset) return false;
  return true;
};

const validateLayoutValue = (value: unknown): boolean => {
  if (!isRecord(value) || !exactKeys(value, ['status', 'type', 'expression', 'location'], ['value', 'reference', 'symbol', 'reason', 'parameter', 'localInvocationResult', 'sourceLiteral', 'directHelperScaleResult'])) return false;
  if (!['static', 'dynamic', 'unknown'].includes(String(value.status)) || !['string', 'number', 'boolean', 'nil', 'table', 'function', 'reference', 'identifier', 'expression', 'unknown'].includes(String(value.type)) || typeof value.expression !== 'string' || !sourceIsValid(value.location)) return false;
  if (value.value !== undefined && !(value.value === null || typeof value.value === 'string' || typeof value.value === 'boolean' || isFiniteSafe(value.value))) return false;
  if (value.reference !== undefined && !validateValueReference(value.reference)) return false;
  for (const key of ['symbol', 'reason'] as const) if (value[key] !== undefined && typeof value[key] !== 'string') return false;
  if (value.sourceLiteral !== undefined && !sourceIsValid(value.sourceLiteral)) return false;
  if (value.parameter !== undefined && !validateSerializable(value.parameter)) return false;
  if (value.localInvocationResult !== undefined && !validateSerializable(value.localInvocationResult)) return false;
  const directResultDescriptor = Object.getOwnPropertyDescriptor(value, 'directHelperScaleResult');
  if (directResultDescriptor === undefined) {
    if ('directHelperScaleResult' in value) return false;
  } else if (!('value' in directResultDescriptor)
    || directResultDescriptor.enumerable !== true
    || !validateDirectHelperScaleResult(value, directResultDescriptor.value)) return false;
  return true;
};

const CALL_SEMANTICS_KEYS = [
  'count', 'index', 'span', 'width', 'percentage', 'height', 'layer', 'menu', 'menuName',
  'frame', 'table', 'row', 'cell', 'cellType', 'propertyName', 'hotkey', 'displayIcon', 'dataFlow', 'text', 'editBox', 'fontsize', 'options',
  'properties', 'unsupportedProperties', 'rowData', 'icon', 'scaling', 'scale',
] as const;

const validateCallPropertyProjection = (value: unknown): boolean =>
  isRecord(value)
  && exactKeys(value, ['name', 'normalizedName', 'value', 'source', 'sourceOrder'])
  && typeof value.name === 'string'
  && typeof value.normalizedName === 'string'
  && validateLayoutValue(value.value)
  && sourceIsValid(value.source)
  && isSafeIntegerAtLeast(value.sourceOrder, 0)
  && value.sourceOrder === value.source.start.offset;

const validateCallSemantics = (value: unknown): boolean => {
  if (!isRecord(value) || !exactKeys(value, [], CALL_SEMANTICS_KEYS as readonly string[])) return false;
  for (const key of CALL_SEMANTICS_KEYS) {
    const field = value[key];
    if (field === undefined) continue;
    if (key === 'editBox') {
      if (!isRecord(field) || !exactKeys(field, [], ['defaultText', 'description'])) return false;
      if (field.defaultText !== undefined && !validateLayoutValue(field.defaultText)) return false;
      if (field.description !== undefined && !validateLayoutValue(field.description)) return false;
    } else if (key === 'scale') {
      if (!isRecord(field) || !exactKeys(field, [], ['input', 'fontname', 'fontsize', 'enabled'])) return false;
      if (field.input !== undefined && !validateLayoutValue(field.input)) return false;
      if (field.fontname !== undefined && !validateLayoutValue(field.fontname)) return false;
      if (field.fontsize !== undefined && !validateLayoutValue(field.fontsize)) return false;
      if (field.enabled !== undefined && !validateLayoutValue(field.enabled)) return false;
    } else if (key === 'properties' || key === 'unsupportedProperties') {
      if (!Array.isArray(field) || !field.every(validateCallPropertyProjection)) return false;
    } else if (!validateLayoutValue(field)) {
      return false;
    }
  }
  return true;
};

const validateOperationMetadata = (value: unknown): boolean => {
  if (!isRecord(value) || !exactKeys(value, ['arguments', 'semantics'], ['receiver', 'result']) || !Array.isArray(value.arguments) || !value.arguments.every(validateLayoutValue) || !validateCallSemantics(value.semantics)) return false;
  if (value.receiver !== undefined && !validateLayoutValue(value.receiver)) return false;
  return value.result === undefined || validateValueReference(value.result);
};

const validateKernelTransition = (value: unknown): boolean => {
  if (!isRecord(value) || !exactKeys(value, [], ['stateBefore', 'stateAfter', 'refusal'])) return false;
  if (value.stateBefore !== undefined && !validateKernelState(value.stateBefore)) return false;
  if (value.stateAfter !== undefined && !validateKernelState(value.stateAfter)) return false;
  if (value.refusal !== undefined) {
    if (!isRecord(value.refusal) || !exactKeys(value.refusal, ['status', 'code', 'message', 'provenance'], ['state']) || value.refusal.status === 'ok' || typeof value.refusal.status !== 'string' || typeof value.refusal.code !== 'string' || typeof value.refusal.message !== 'string' || !sameProvenance(value.refusal.provenance) || (value.refusal.state !== undefined && !validateKernelState(value.refusal.state))) return false;
  }
  return value.stateBefore !== undefined || value.stateAfter !== undefined || value.refusal !== undefined;
};

const validateScaleResolution = (value: unknown): boolean =>
  isRecord(value)
  && exactKeys(value, ['status', 'value', 'sourceArguments'])
  && value.status === 'resolved'
  && isFiniteSafe(value.value)
  && Array.isArray(value.sourceArguments)
  && value.sourceArguments.every(sourceIsValid);

const validateLocalExpansion = (value: unknown): boolean =>
  isRecord(value)
  && exactKeys(value, ['invocationId', 'ancestry', 'depth', 'previewPathSelectionIds'])
  && typeof value.invocationId === 'string'
  && value.invocationId.length > 0
  && uniqueStringArray(value.ancestry)
  && isSafeIntegerAtLeast(value.depth, 0)
  && uniqueStringArray(value.previewPathSelectionIds);

const validateOperation = (operation: unknown): operation is X4UiLayoutOperation => {
  if (!isRecord(operation) || !exactKeys(operation, ['id', 'kind', 'source', 'sourceOrder', 'modelOrder', 'status', 'metadata', 'descriptorFacts'], ['frameId', 'tableId', 'rowId', 'cellId', 'reason', 'kernel', 'scale', 'localExpansion'])) return false;
  if (typeof operation.id !== 'string' || operation.id.length === 0 || typeof operation.kind !== 'string' || !SUPPORTED_OPERATION_KINDS.has(operation.kind) || !sourceIsValid(operation.source) || !isSafeIntegerAtLeast(operation.sourceOrder, 0) || operation.sourceOrder !== operation.source.start.offset || !isSafeIntegerAtLeast(operation.modelOrder, 0) || !validateOperationMetadata(operation.metadata) || !validateFacts(operation.descriptorFacts)) return false;
  if (!['applied', 'rejected', 'unresolved', 'unreachable', 'conditional'].includes(String(operation.status))) return false;
  if (operation.reason !== undefined && typeof operation.reason !== 'string') return false;
  for (const key of ['frameId', 'tableId', 'rowId', 'cellId'] as const) if (operation[key] !== undefined && (typeof operation[key] !== 'string' || operation[key].length === 0)) return false;
  if (operation.kernel !== undefined && !validateKernelTransition(operation.kernel)) return false;
  if (operation.scale !== undefined && !validateScaleResolution(operation.scale)) return false;
  if (operation.localExpansion !== undefined && !validateLocalExpansion(operation.localExpansion)) return false;
  return true;
};

const frozenEvidenceGraph = (value: unknown, seen = new WeakSet<object>()): boolean => {
  if (value === null || typeof value !== 'object') return true;
  if (value instanceof Uint8Array) return true;
  if (seen.has(value)) return true;
  seen.add(value);
  return Object.isFrozen(value)
    && Object.keys(value).every(key => frozenEvidenceGraph((value as Record<string, unknown>)[key], seen));
};

const safeByteArray = (value: unknown, maximum: number): value is Uint8Array =>
  value instanceof Uint8Array
  && value.byteLength <= maximum;

const safeReadonlyNumberArray = (value: unknown, maximum: number): value is readonly number[] =>
  Array.isArray(value)
  && value.length <= maximum
  && value.every(item => isSafeIntegerAtLeast(item, 0));

const validateCorpusBinaryEvidence = (
  value: unknown,
  kind: X4UiCorpusAssetKind,
  identity: ZektonAssetIdentity,
  maximum: number,
  allowText = false,
): boolean => {
  if (!isRecord(value) || !exactKeys(value, ['kind', 'path', 'relativePath', 'sha256', 'size', 'bytes'], allowText ? ['encoding', 'text'] : [])) return false;
  return value.kind === kind
    && value.path === identity.relativePath
    && value.relativePath === identity.relativePath
    && value.sha256 === identity.sha256
    && isSafeIntegerAtLeast(value.size, 0)
    && value.size <= maximum
    && safeByteArray(value.bytes, maximum)
    && value.bytes.byteLength === value.size;
};

const validateCorpusTextEvidence = (
  value: unknown,
  kind: 'helper' | 'widget',
  path: string,
  sha256: string,
): boolean => {
  if (!isRecord(value) || !exactKeys(value, ['kind', 'path', 'relativePath', 'sha256', 'size', 'bytes', 'encoding', 'text'])) return false;
  return validateCorpusBinaryEvidence(value, kind, { relativePath: path, sha256 }, MAX_SAFE_DESCRIPTOR_BYTES, true)
    && value.encoding === 'utf-8'
    && typeof value.text === 'string';
};

const validateCorpusIdentity = (value: unknown, expected: ZektonAssetIdentity): boolean =>
  isRecord(value)
  && exactKeys(value, ['relativePath', 'sha256'])
  && value.relativePath === expected.relativePath
  && value.sha256 === expected.sha256;

const validateCorpusLineMetrics = (value: unknown): value is Record<string, unknown> => {
  if (!isRecord(value) || !exactKeys(value, ['outer', 'top', 'bottom', 'inner', 'split20', 'split24', 'rawMetric28'])) return false;
  const metrics = value;
  if (![metrics.outer, metrics.top, metrics.bottom, metrics.inner, metrics.split20, metrics.split24, metrics.rawMetric28]
    .every(item => isFiniteSafe(item) && Number(item) >= 0 && Number(item) <= MAX_SAFE_LINE_METRIC)) return false;
  return metrics.outer === Number(metrics.top) + Number(metrics.inner) + Number(metrics.bottom)
    && Math.abs(Number(metrics.split20) + Number(metrics.split24) - Number(metrics.inner)) <= 1;
};

const validateCorpusFontGraph = (
  value: unknown,
  name: 'regular' | 'bold',
): value is ZektonFontAssets => {
  const expected = name === 'regular' ? ZEKTON_CORPUS_ASSETS.regular : ZEKTON_CORPUS_ASSETS.bold;
  if (!isRecord(value) || !exactKeys(value, ['format', 'descriptor', 'atlas', 'descriptorIdentity', 'atlasIdentity', 'evidenceState', 'provenance'])) return false;
  if (value.format !== 'x4-zekton-font-assets' || value.evidenceState !== ZEKTON_EVIDENCE_STATE || !isRecord(value.descriptor) || !isRecord(value.atlas) || !isRecord(value.provenance)) return false;
  if (!exactKeys(value.provenance, ['descriptor', 'atlas']) || !isRecord(value.provenance.descriptor) || !isRecord(value.provenance.atlas)) return false;
  if (!exactKeys(value.provenance.descriptor, ['identity', 'evidenceState']) || !exactKeys(value.provenance.atlas, ['identity', 'evidenceState']) || value.provenance.descriptor.evidenceState !== ZEKTON_EVIDENCE_STATE || value.provenance.atlas.evidenceState !== ZEKTON_EVIDENCE_STATE) return false;
  if (!validateCorpusIdentity(value.descriptorIdentity, expected.descriptor) || !validateCorpusIdentity(value.atlasIdentity, expected.atlas) || !validateCorpusIdentity(value.provenance.descriptor.identity, expected.descriptor) || !validateCorpusIdentity(value.provenance.atlas.identity, expected.atlas)) return false;

  const descriptor = value.descriptor as unknown as ZektonAbcDescriptor;
  if (!exactKeys(descriptor as unknown as Record<string, unknown>, ['format', 'atlasWidth', 'atlasHeight', 'maxCodepoint', 'codePointToGlyphIndex', 'map', 'glyphRecords', 'glyphs', 'glyphCount', 'recordSize', 'headerBytes', 'header', 'lineMetrics', 'trailingBytes', 'identity', 'provenance', 'evidenceState'])) return false;
  if (descriptor.format !== 'x4-zekton-abc' || descriptor.evidenceState !== ZEKTON_EVIDENCE_STATE || !validateCorpusIdentity(descriptor.identity, expected.descriptor) || !isRecord(descriptor.provenance) || !exactKeys(descriptor.provenance, ['identity', 'evidenceState']) || descriptor.provenance.evidenceState !== ZEKTON_EVIDENCE_STATE || !validateCorpusIdentity(descriptor.provenance.identity, expected.descriptor)) return false;
  if (!isSafeIntegerAtLeast(descriptor.atlasWidth, 1) || descriptor.atlasWidth > MAX_SAFE_ATLAS_DIMENSION || !isSafeIntegerAtLeast(descriptor.atlasHeight, 1) || descriptor.atlasHeight > MAX_SAFE_ATLAS_DIMENSION || descriptor.atlasWidth * descriptor.atlasHeight > MAX_SAFE_ATLAS_PIXELS || !isSafeIntegerAtLeast(descriptor.maxCodepoint, 0) || descriptor.maxCodepoint > MAX_UNICODE_CODE_POINT || descriptor.recordSize !== ZEKTON_RECORD_SIZE || !isSafeIntegerAtLeast(descriptor.glyphCount, 0) || descriptor.glyphCount > MAX_SAFE_GLYPH_RECORDS) return false;
  if (!safeReadonlyNumberArray(descriptor.headerBytes, ZEKTON_DESCRIPTOR_HEADER_SIZE) || descriptor.headerBytes.length !== ZEKTON_DESCRIPTOR_HEADER_SIZE || !safeReadonlyNumberArray(descriptor.trailingBytes, ZEKTON_DESCRIPTOR_TRAILING_SIZE) || descriptor.trailingBytes.length !== ZEKTON_DESCRIPTOR_TRAILING_SIZE) return false;
  if (!isRecord(descriptor.header) || !exactKeys(descriptor.header, ['formatVersion', 'lineMetrics', 'reserved32', 'atlasWidth', 'atlasHeight', 'maxCodepoint']) || descriptor.header.formatVersion !== ZEKTON_ABC_FORMAT_VERSION || descriptor.header.reserved32 !== 0 || descriptor.header.atlasWidth !== descriptor.atlasWidth || descriptor.header.atlasHeight !== descriptor.atlasHeight || descriptor.header.maxCodepoint !== descriptor.maxCodepoint || !validateCorpusLineMetrics(descriptor.lineMetrics) || descriptor.header.lineMetrics !== descriptor.lineMetrics) return false;
  if (!Array.isArray(descriptor.codePointToGlyphIndex) || descriptor.map !== descriptor.codePointToGlyphIndex || descriptor.codePointToGlyphIndex.length !== descriptor.maxCodepoint + 1 || !Array.isArray(descriptor.glyphRecords) || descriptor.glyphs !== descriptor.glyphRecords || descriptor.glyphRecords.length !== descriptor.glyphCount) return false;
  if (!descriptor.codePointToGlyphIndex.every(index => isSafeIntegerAtLeast(index, 0) && index <= descriptor.glyphCount)) return false;
  for (let index = 0; index < descriptor.glyphRecords.length; index += 1) {
    const glyph = descriptor.glyphRecords[index];
    if (!isRecord(glyph) || !exactKeys(glyph, ['glyphIndex', 'uv', 'pixelBounds', 'horizontalBearing', 'bearingX', 'bitmapWidth', 'width', 'advance', 'page'])) return false;
    const glyphValue = glyph as unknown as ZektonGlyphMetrics;
    if (glyphValue.glyphIndex !== index + 1 || glyphValue.page !== 0 || !isSafeIntegerAtLeast(glyphValue.bitmapWidth, 1) || glyphValue.bitmapWidth > descriptor.atlasWidth || glyphValue.width !== glyphValue.bitmapWidth || !isSafeIntegerAtLeast(glyphValue.advance, 1) || glyphValue.advance > MAX_SAFE_GLYPH_ADVANCE || !isFiniteSafe(glyphValue.horizontalBearing) || Math.abs(glyphValue.horizontalBearing) > MAX_SAFE_HORIZONTAL_BEARING || glyphValue.bearingX !== glyphValue.horizontalBearing || !isRecord(glyphValue.uv) || !exactKeys(glyphValue.uv, ['u0', 'v0', 'u1', 'v1']) || !isRecord(glyphValue.pixelBounds) || !exactKeys(glyphValue.pixelBounds, ['left', 'top', 'right', 'bottom'])) return false;
    const uv = glyphValue.uv;
    const bounds = glyphValue.pixelBounds;
    if (![uv.u0, uv.v0, uv.u1, uv.v1].every(item => isFiniteSafe(item) && Number(item) >= 0 && Number(item) <= 1) || Number(uv.u0) >= Number(uv.u1) || Number(uv.v0) >= Number(uv.v1)) return false;
    if (![bounds.left, bounds.top, bounds.right, bounds.bottom].every(item => isFiniteSafe(item)) || Number(bounds.left) < 0 || Number(bounds.top) < 0 || Number(bounds.right) > descriptor.atlasWidth || Number(bounds.bottom) > descriptor.atlasHeight || Number(bounds.left) >= Number(bounds.right) || Number(bounds.top) >= Number(bounds.bottom) || Number(bounds.left) !== Number(uv.u0) * descriptor.atlasWidth || Number(bounds.top) !== Number(uv.v0) * descriptor.atlasHeight || Number(bounds.right) !== Number(uv.u1) * descriptor.atlasWidth || Number(bounds.bottom) !== Number(uv.v1) * descriptor.atlasHeight) return false;
  }

  const atlas = value.atlas as unknown as ZektonA8DdsAtlas;
  if (!exactKeys(atlas as unknown as Record<string, unknown>, ['format', 'width', 'height', 'dimensions', 'payloadOffset', 'payloadLength', 'mipMapCount', 'depth', 'alphaBytes', 'identity', 'provenance', 'evidenceState']) || atlas.format !== 'x4-zekton-a8-dds' || atlas.evidenceState !== ZEKTON_EVIDENCE_STATE || !validateCorpusIdentity(atlas.identity, expected.atlas) || !isRecord(atlas.provenance) || !exactKeys(atlas.provenance, ['identity', 'evidenceState']) || atlas.provenance.evidenceState !== ZEKTON_EVIDENCE_STATE || !validateCorpusIdentity(atlas.provenance.identity, expected.atlas) || !isSafeIntegerAtLeast(atlas.width, 1) || atlas.width > MAX_SAFE_ATLAS_DIMENSION || !isSafeIntegerAtLeast(atlas.height, 1) || atlas.height > MAX_SAFE_ATLAS_DIMENSION || atlas.width * atlas.height > MAX_SAFE_ATLAS_PIXELS || !isRecord(atlas.dimensions) || !exactKeys(atlas.dimensions, ['width', 'height']) || atlas.dimensions.width !== atlas.width || atlas.dimensions.height !== atlas.height || atlas.payloadOffset !== ZEKTON_DDS_HEADER_SIZE || atlas.payloadLength !== atlas.width * atlas.height || atlas.mipMapCount !== 0 || atlas.depth !== 0 || !safeByteArray(atlas.alphaBytes, MAX_SAFE_DDS_BYTES) || atlas.alphaBytes.byteLength !== atlas.payloadLength) return false;
  return frozenEvidenceGraph(value);
};

const validateCanonicalCorpus = (value: unknown): value is X4UiCorpusCanonicalSuccess => {
  if (!isX4UiCorpusCanonicalSuccess(value) || !isRecord(value) || !exactKeys(value, ['ok', 'statusIdentity', 'manifestGeneration', 'assets', 'fonts', 'helperSourceHash', 'widgetSourceHash', 'fontEvidence', 'verification', 'evidenceKind', 'canonical', 'canonicalIdentity']) || value.ok !== true || value.evidenceKind !== X4_UI_CORPUS_CANONICAL_EVIDENCE || value.canonical !== true || value.canonicalIdentity !== 'x4-9.00' || value.verification !== X4_UI_CORPUS_VERIFICATION || value.fontEvidence !== ZEKTON_EVIDENCE_STATE || value.helperSourceHash !== X4_LAYOUT_PROVENANCE.helperSha256 || value.widgetSourceHash !== X4_LAYOUT_PROVENANCE.widgetSha256 || !isRecord(value.statusIdentity) || !exactKeys(value.statusIdentity, ['root', 'generatedAt', 'manifestGeneration', 'manifestRoot', 'manifestGeneratedAt']) || Object.values(value.statusIdentity).some(item => typeof item !== 'string' || item.length === 0) || value.statusIdentity.manifestGeneration !== value.manifestGeneration || typeof value.manifestGeneration !== 'string' || !isRecord(value.assets) || !isRecord(value.fonts)) return false;
  const assets = value.assets as Record<string, unknown>;
  const fonts = value.fonts as Record<string, unknown>;
  if (!exactKeys(assets, ['helper', 'widget', 'regular', 'bold']) || !exactKeys(fonts, ['regular', 'bold'])) return false;
  if (!validateCorpusTextEvidence(assets.helper, 'helper', X4_LAYOUT_PROVENANCE.helperSourcePath, X4_LAYOUT_PROVENANCE.helperSha256) || !validateCorpusTextEvidence(assets.widget, 'widget', X4_LAYOUT_PROVENANCE.widgetSourcePath, X4_LAYOUT_PROVENANCE.widgetSha256)) return false;
  for (const name of ['regular', 'bold'] as const) {
    const expected = name === 'regular' ? ZEKTON_CORPUS_ASSETS.regular : ZEKTON_CORPUS_ASSETS.bold;
    const evidence = assets[name];
    const descriptorKind = name === 'regular' ? 'regular-descriptor' : 'bold-descriptor';
    const atlasKind = name === 'regular' ? 'regular-atlas' : 'bold-atlas';
    if (!isRecord(evidence) || !exactKeys(evidence, ['descriptor', 'atlas', 'decoded', 'evidenceState']) || evidence.evidenceState !== ZEKTON_EVIDENCE_STATE || !validateCorpusBinaryEvidence(evidence.descriptor, descriptorKind, expected.descriptor, MAX_SAFE_DESCRIPTOR_BYTES) || !validateCorpusBinaryEvidence(evidence.atlas, atlasKind, expected.atlas, MAX_SAFE_DDS_BYTES) || evidence.decoded !== fonts[name] || !validateCorpusFontGraph(evidence.decoded, name)) return false;
  }
  const regularEvidence = assets.regular;
  const boldEvidence = assets.bold;
  return isRecord(regularEvidence) && isRecord(boldEvidence)
    && fonts.regular === regularEvidence.decoded
    && fonts.bold === boldEvidence.decoded
    && frozenEvidenceGraph(value);
};

const validScalar = (value: unknown): boolean =>
  (typeof value === 'string' || typeof value === 'boolean' || isFiniteSafe(value));

const validateModelIdentity = (value: unknown): boolean => {
  if (!isRecord(value) || !exactKeys(value, ['file', 'sha256'], ['sourcePath']) || typeof value.file !== 'string' || value.file.length === 0 || !isSha256(value.sha256)) return false;
  return value.sourcePath === undefined || (typeof value.sourcePath === 'string' && value.sourcePath.length > 0);
};

const validatePreviewSampleBinding = (value: unknown): boolean => {
  if (!isRecord(value) || !exactKeys(value, ['id', 'value', 'expectedType', 'source', 'provenance', 'status'], ['reason'])) return false;
  if (typeof value.id !== 'string' || value.id.length === 0 || !validScalar(value.value) || !sourceIsValid(value.source) || value.provenance !== 'preview-only') return false;
  if (value.expectedType !== 'number' && value.expectedType !== 'string' && value.expectedType !== 'boolean') return false;
  if ((value.expectedType === 'number' && typeof value.value !== 'number') || (value.expectedType === 'string' && typeof value.value !== 'string') || (value.expectedType === 'boolean' && typeof value.value !== 'boolean')) return false;
  if (value.status !== 'consumed' && value.status !== 'not-applied') return false;
  return value.reason === undefined || typeof value.reason === 'string';
};

const validatePreviewPathSelection = (value: unknown): boolean => {
  if (!isRecord(value) || !exactKeys(value, ['id', 'boundaryId', 'armId', 'boundary', 'provenance'])) return false;
  return typeof value.id === 'string'
    && value.id.length > 0
    && typeof value.boundaryId === 'string'
    && value.boundaryId.length > 0
    && typeof value.armId === 'string'
    && value.armId.length > 0
    && sourceIsValid(value.boundary)
    && value.provenance === 'preview-only';
};

const validateLocalExpansionInvocation = (value: unknown): boolean => {
  if (!isRecord(value) || !exactKeys(value, ['id', 'sourceInvocationId', 'source', 'ancestry', 'depth', 'status', 'resultConsumed', 'previewPathSelectionIds', 'operationIds'], ['calleeDeclarationId', 'resolution', 'reason'])) return false;
  if (typeof value.id !== 'string' || value.id.length === 0 || typeof value.sourceInvocationId !== 'string' || value.sourceInvocationId.length === 0 || !sourceIsValid(value.source) || !uniqueStringArray(value.ancestry) || !isSafeIntegerAtLeast(value.depth, 0) || !['expanded', 'rejected', 'conditional', 'unreachable', 'looped'].includes(String(value.status)) || typeof value.resultConsumed !== 'boolean' || !uniqueStringArray(value.previewPathSelectionIds) || !uniqueStringArray(value.operationIds)) return false;
  if (value.calleeDeclarationId !== undefined && (typeof value.calleeDeclarationId !== 'string' || value.calleeDeclarationId.length === 0)) return false;
  if (value.resolution !== undefined && value.resolution !== 'direct' && value.resolution !== 'alias') return false;
  return value.reason === undefined || typeof value.reason === 'string';
};

const validateLocalExpansionCatalogEntry = (value: unknown): boolean => {
  if (!isRecord(value) || !exactKeys(value, ['id', 'boundaryId', 'armId', 'boundary', 'arm', 'armIndex', 'reachability', 'invocationIds', 'provenance'])) return false;
  return typeof value.id === 'string'
    && value.id.length > 0
    && typeof value.boundaryId === 'string'
    && value.boundaryId.length > 0
    && typeof value.armId === 'string'
    && value.armId.length > 0
    && sourceIsValid(value.boundary)
    && (value.arm === 'then' || value.arm === 'elseif' || value.arm === 'else')
    && isSafeIntegerAtLeast(value.armIndex, 0)
    && (value.reachability === 'reachable' || value.reachability === 'conditional' || value.reachability === 'unreachable')
    && uniqueStringArray(value.invocationIds)
    && value.provenance === 'preview-only';
};

const validateLocalExpansionShape = (value: unknown): boolean => {
  if (!isRecord(value) || !exactKeys(value, ['limits', 'invocations', 'previewPathCatalog', 'previewPathSelections'])) return false;
  if (!isRecord(value.limits) || !exactKeys(value.limits, ['maxDepth', 'maxInvocations']) || !isSafeIntegerAtLeast(value.limits.maxDepth, 1) || value.limits.maxDepth > 32 || !isSafeIntegerAtLeast(value.limits.maxInvocations, 1) || value.limits.maxInvocations > 2048) return false;
  if (!Array.isArray(value.invocations) || !value.invocations.every(validateLocalExpansionInvocation)) return false;
  if (!isRecord(value.previewPathCatalog) || !exactKeys(value.previewPathCatalog, ['id', 'sourceIdentity', 'targetId', 'entries']) || typeof value.previewPathCatalog.id !== 'string' || value.previewPathCatalog.id.length === 0 || !validateModelIdentity(value.previewPathCatalog.sourceIdentity) || typeof value.previewPathCatalog.targetId !== 'string' || value.previewPathCatalog.targetId.length === 0 || !Array.isArray(value.previewPathCatalog.entries) || !value.previewPathCatalog.entries.every(validateLocalExpansionCatalogEntry)) return false;
  return Array.isArray(value.previewPathSelections) && value.previewPathSelections.every(validatePreviewPathSelection);
};

const validatePreviewSerialization = (program: Record<string, unknown>): boolean => {
  if (!Array.isArray(program.previewSampleBindings) || !program.previewSampleBindings.every(validatePreviewSampleBinding)) return false;
  if (program.localExpansion === undefined) return true;
  return validateLocalExpansionShape(program.localExpansion);
};

const isGeneratedGlyphIdFor = (id: string, textId: string): boolean => {
  const prefix = `${textId}:line:`;
  if (!id.startsWith(prefix)) return false;
  const parts = id.slice(prefix.length).split(':');
  return parts.length === 3 && /^\d+$/.test(parts[0]) && parts[1] === 'glyph' && /^\d+$/.test(parts[2]);
};

const validateGeneratedSceneIds = (program: X4UiLayoutProgram): boolean => {
  const reservedGapId = (id: string): boolean => id.startsWith('scene-gap:') || id.startsWith('gap:');
  if ([
    ...program.frames.map(node => node.id),
    ...program.tables.map(node => node.id),
    ...program.rows.map(node => node.id),
    ...program.cells.map(node => node.id),
    ...program.operations.map(operation => operation.id),
  ].some(reservedGapId)) return false;
  const directIds = new Set<string>([
    ...program.frames.map(node => `scene:${node.id}`),
    ...program.tables.map(node => `scene:${node.id}`),
    ...program.rows.map(node => `scene:${node.id}`),
    ...program.cells.map(node => `scene:${node.id}`),
  ]);
  const generatedIds = new Set<string>();
  const textIds: string[] = [];
  const claim = (id: string): boolean => {
    if (reservedGapId(id) || directIds.has(id) || generatedIds.has(id)) return false;
    generatedIds.add(id);
    return true;
  };
  for (const cell of program.cells) {
    const span = cell.descriptorFacts.span;
    if (span?.status === 'known' && span.expectedType === 'number' && span.value === 0) continue;
    const contentKind = cell.descriptorFacts.contentKind;
    const widgetType = contentKind?.status === 'known' && contentKind.expectedType === 'string'
      && (contentKind.value === 'text' || contentKind.value === 'button' || contentKind.value === 'editbox' || contentKind.value === 'icon')
      ? contentKind.value
      : undefined;
    if (!widgetType) continue;
    if (!claim(`scene:widget:${cell.id}:${widgetType}`)) return false;
    const slots = widgetType === 'text' || widgetType === 'editbox' ? ['primary'] : ['primary', 'secondary'];
    for (const slot of slots) {
      const textId = `scene:text:${cell.id}:${slot}`;
      if (!claim(textId)) return false;
      textIds.push(textId);
    }
  }
  const allIds = [...directIds, ...generatedIds];
  if (allIds.some(reservedGapId)) return false;
  return textIds.every(textId => allIds.every(id => !isGeneratedGlyphIdFor(id, textId)));
};

const validateFrameTextureLayerStructure = (
  frame: X4UiLayoutFrameNode,
  layers: unknown,
): layers is readonly X4UiLayoutFrameTextureLayer[] => {
  if (!Array.isArray(layers) || layers.length !== 3) return false;
  return layers.every((candidate, index) => {
    if (!isRecord(candidate)
      || !exactKeys(candidate, ['name', 'source', 'sourceOrder', 'operationIds', 'descriptorFacts'])
      || candidate.name !== ['background', 'background2', 'overlay'][index]
      || !sourceIsValid(candidate.source)
      || candidate.source.file !== frame.source.file
      || candidate.source.sourcePath !== frame.source.sourcePath
      || !isSafeIntegerAtLeast(candidate.sourceOrder, 0)
      || candidate.sourceOrder !== (candidate.source as X4UiSceneSourceLocation).start.offset
      || !uniqueStringArray(candidate.operationIds)
      || !validateFacts(candidate.descriptorFacts)) return false;
    const factKeys = Object.keys(candidate.descriptorFacts as Record<string, unknown>).sort();
    return JSON.stringify(factKeys) === JSON.stringify([...FRAME_TEXTURE_DESCRIPTOR_FIELDS].sort())
      && FRAME_TEXTURE_DESCRIPTOR_FIELDS.every(field => validateFact((candidate.descriptorFacts as Record<string, unknown>)[field]));
  });
};

const validateProgramStructure = (
  program: unknown,
  evidenceAuthority: X4UiLayoutEvidenceAuthority,
  diagnostic?: { stage?: string },
): program is X4UiLayoutProgram => {
  const refuseStructure = (stage: string): false => {
    if (diagnostic !== undefined && diagnostic.stage === undefined) diagnostic.stage = stage;
    return false;
  };
  if (!isRecord(program)) return false;
  if (program.status !== 'projected' && program.status !== 'partial') return refuseStructure('status');
  if (!isRecord(program.target) || typeof program.target.id !== 'string' || !sourceIsValid(program.target.source) || !validateModelIdentity(program.target.sourceIdentity)) return refuseStructure('target');
  if (!isRecord(program.profile) || !validateModelIdentity(program.profile.source) || !isRecord(program.profile.helper) || !isRecord(program.profile.widget) || !isRecord(program.profile.frame) || !validateLayoutMetrics(program.profile.metrics) || !exactKeys(program.profile.frame, ['width', 'height']) || !isFiniteDimension(program.profile.frame.width) || !isFiniteDimension(program.profile.frame.height)) return refuseStructure('profile');
  if (!isRecord(program.analysis) || !exactKeys(program.analysis, ['parsed', 'callModelGaps', 'callModelGapsTruncated', 'incomplete', 'profile', 'staticSource', 'gameVerification']) || program.analysis.parsed !== true || !isSafeIntegerAtLeast(program.analysis.callModelGaps, 0) || typeof program.analysis.callModelGapsTruncated !== 'boolean' || typeof program.analysis.incomplete !== 'boolean' || (program.analysis.profile !== 'complete' && program.analysis.profile !== 'refused') || (program.analysis.staticSource !== 'complete' && program.analysis.staticSource !== 'incomplete' && program.analysis.staticSource !== 'refused') || program.analysis.profile === 'refused' || program.analysis.gameVerification !== X4_UI_LAYOUT_GAME_TRUTH) return refuseStructure('analysis');
  if (!Array.isArray(program.frames) || !Array.isArray(program.tables) || !Array.isArray(program.rows) || !Array.isArray(program.cells) || !Array.isArray(program.operations) || !Array.isArray(program.gaps) || !validatePreviewSerialization(program)) return refuseStructure('arrays-preview');
  if (!isRecord(program.verification) || !exactKeys(program.verification, ['game', 'gameVerified']) || program.verification.game !== X4_UI_LAYOUT_GAME_TRUTH || program.verification.gameVerified !== false) return refuseStructure('verification');
  const ids = new Set<string>();
  const checkNode = (node: unknown, required: readonly string[], optional: readonly string[]): boolean => {
    if (!isRecord(node) || !exactKeys(node, required, optional) || typeof node.id !== 'string' || node.id.length === 0 || ids.has(node.id) || !sourceIsValid(node.source) || !validateFacts(node.descriptorFacts)) {
      return false;
    }
    if (!['projected', 'partial', 'refused', 'applied', 'rejected', 'unresolved', 'unreachable', 'conditional'].includes(String(node.status))) return false;
    ids.add(node.id);
    return true;
  };
  if (!program.frames.every(node => checkNode(node, ['id', 'source', 'tableIds', 'operationIds', 'descriptorFacts', 'status'], ['identity', 'width', 'height', 'widthSource', 'heightSource', 'frameTextureLayers', 'blurBackground']))
    || !program.tables.every(node => checkNode(node, ['id', 'source', 'rowIds', 'operationIds', 'descriptorFacts', 'status'], ['identity', 'frameId', 'frameWidth', 'numColumns', 'requestedWidth', 'kernelState', 'height']))
    || !program.rows.every(node => checkNode(node, ['id', 'source', 'cellIds', 'operationIds', 'descriptorFacts', 'status'], ['identity', 'tableId', 'rowIndex', 'kernelState', 'height']))
     || !program.cells.every(node => checkNode(node, ['id', 'source', 'column', 'operationIds', 'metadataOperationIds', 'descriptorFacts', 'status'], ['identity', 'tableId', 'rowId', 'rowIndex', 'kernelState', 'spanWidth', 'height']))) return refuseStructure('nodes');
  if (!program.frames.every(frame =>
    (frame.identity === undefined || validateValueReference(frame.identity))
    && (frame.widthSource === undefined || sourceIsValid(frame.widthSource))
    && (frame.heightSource === undefined || sourceIsValid(frame.heightSource))
    && (frame.frameTextureLayers === undefined || validateFrameTextureLayerStructure(frame, frame.frameTextureLayers))
    && (frame.blurBackground === undefined || validateFact(frame.blurBackground))
    && (frame.blurBackground === undefined || sameStructuralValue(frame.blurBackground, frame.descriptorFacts.blurBackground)))
    || !program.tables.every(table => table.identity === undefined || validateValueReference(table.identity))
    || !program.rows.every(row => row.identity === undefined || validateValueReference(row.identity))
     || !program.cells.every(cell => cell.identity === undefined || validateValueReference(cell.identity))) return refuseStructure('node-optionals');
  const typedProgram = program as unknown as X4UiLayoutProgram;
  const localExpansion = typedProgram.localExpansion;
  const localExpansionById = new Map(localExpansion?.invocations.map(invocation => [invocation.id, invocation]));
  if (localExpansion !== undefined && localExpansionById.size !== localExpansion.invocations.length) return refuseStructure('local-expansion-invocation-ids');
  const sourceBoundLocalExpansion = (operation: X4UiLayoutOperation): boolean => {
    const expansion = operation.localExpansion;
    if (expansion === undefined || localExpansion === undefined) return false;
    const invocation = localExpansionById.get(expansion.invocationId);
    const linkedInvocations = localExpansion.invocations.filter(candidate => candidate.operationIds.includes(operation.id));
    return invocation !== undefined
      && invocation.status === 'expanded'
      && linkedInvocations.length === 1
      && linkedInvocations[0]?.id === invocation.id
      && expansion.depth === invocation.depth
      && sameStructuralValue(expansion.ancestry, invocation.ancestry)
      && sameStructuralValue(expansion.previewPathSelectionIds, invocation.previewPathSelectionIds)
      && expansion.ancestry[0] === typedProgram.target.id
      && invocation.ancestry[0] === typedProgram.target.id
      && localExpansion.previewPathCatalog.targetId === typedProgram.target.id
      && sameStructuralValue(localExpansion.previewPathCatalog.sourceIdentity, typedProgram.target.sourceIdentity);
  };
  // Expanded local invocations retain callee modelOrder; the issued occurrence ledger authorizes safe duplicates.
  const modelOrders = new Set<number>();
  const modelOrderInvocations = new Map<number, Set<string>>();
  for (const operation of program.operations) {
     if (!validateOperation(operation) || ids.has(operation.id)) return refuseStructure(`operation:${operation.id}`);
    ids.add(operation.id);
    if (operation.localExpansion !== undefined && !sourceBoundLocalExpansion(operation)) return refuseStructure(`local-expansion-operation:${operation.id}`);
    if (modelOrders.has(operation.modelOrder)) {
      const invocations = modelOrderInvocations.get(operation.modelOrder);
      if (invocations === undefined || operation.localExpansion === undefined || invocations.has(operation.localExpansion.invocationId)) return refuseStructure(`model-order:${operation.id}`);
      invocations.add(operation.localExpansion.invocationId);
    } else {
      modelOrders.add(operation.modelOrder);
      if (operation.localExpansion !== undefined) modelOrderInvocations.set(operation.modelOrder, new Set([operation.localExpansion.invocationId]));
    }
  }
  if (evidenceAuthority.operations.length !== program.operations.length
    || evidenceAuthority.calls.length !== program.operations.length
    || evidenceAuthority.gaps.length !== program.gaps.length) return refuseStructure('authority-cardinality');
  for (let index = 0; index < program.operations.length; index += 1) {
    const operation = program.operations[index];
    const authorityOperation = evidenceAuthority.operations[index];
    const authorityCall = evidenceAuthority.calls[index];
    if (authorityOperation === undefined || authorityCall === undefined
      || authorityOperation.id !== operation.id
      || authorityOperation.callId !== authorityCall.id
      || authorityOperation.kind !== operation.kind
      || !sameStructuralValue(authorityOperation.source, operation.source)
      || authorityOperation.sourceOrder !== operation.sourceOrder
      || authorityOperation.modelOrder !== operation.modelOrder
      || authorityOperation.status !== operation.status
      || authorityOperation.frameId !== operation.frameId
      || authorityOperation.tableId !== operation.tableId
      || authorityOperation.rowId !== operation.rowId
      || authorityOperation.cellId !== operation.cellId
      || authorityOperation.reason !== operation.reason
      || authorityCall.operationId !== operation.id
      || authorityCall.kind !== operation.kind
      || !sameStructuralValue(authorityCall.source, operation.source)
      || authorityCall.sourceOrder !== operation.sourceOrder
      || authorityCall.modelOrder !== operation.modelOrder
      || authorityCall.status !== operation.status) return refuseStructure(`authority-operation:${operation.id}`);
  }
  const authorityNodeLedgers: readonly [keyof X4UiLayoutEvidenceAuthority['nodes'], readonly { readonly id: string; readonly operationIds: readonly string[]; readonly metadataOperationIds?: readonly string[] }[], readonly { readonly id: string; readonly operationIds: readonly string[]; readonly metadataOperationIds?: readonly string[] }[]][] = [
    ['frames', evidenceAuthority.nodes.frames, program.frames],
    ['tables', evidenceAuthority.nodes.tables, program.tables],
    ['rows', evidenceAuthority.nodes.rows, program.rows],
    ['cells', evidenceAuthority.nodes.cells, program.cells],
  ];
  for (const [kind, authorityNodes, programNodes] of authorityNodeLedgers) {
    if (authorityNodes.length !== programNodes.length) return refuseStructure(`authority-node-cardinality:${kind}`);
    for (let index = 0; index < programNodes.length; index += 1) {
      const authorityNode = authorityNodes[index];
      const programNode = programNodes[index];
      if (authorityNode.id !== programNode.id
        || !sameStructuralValue(authorityNode.operationIds, programNode.operationIds)
        || (kind === 'cells' && !sameStructuralValue(authorityNode.metadataOperationIds, (programNode as X4UiLayoutCellNode).metadataOperationIds))) return refuseStructure(`authority-node:${kind}:${programNode.id}`);
    }
  }
  for (let index = 0; index < program.gaps.length; index += 1) {
    if (!sameStructuralValue(evidenceAuthority.gaps[index], program.gaps[index])) return refuseStructure(`authority-gap:${index}`);
  }
  if (!sameStructuralValue(evidenceAuthority.linkedGapIndexes, evidenceAuthority.gaps.map((gap, index) => gap.operationId === undefined ? undefined : index).filter((index): index is number => index !== undefined))
    || !sameStructuralValue(evidenceAuthority.unlinkedGapIndexes, evidenceAuthority.gaps.map((gap, index) => gap.operationId === undefined ? index : undefined).filter((index): index is number => index !== undefined))) return refuseStructure('authority-gap-partition');
  // Refused partial nodes retain downstream unresolved operations; recognize the complete issued owner chain.
  const unmaterializedTableIds = new Set<string>();
  const incompleteOperationStatus = new Set(['rejected', 'unresolved', 'conditional', 'unreachable']);
  const operationGapBelongsTo = (operation: X4UiLayoutOperation, ownerId: string, tableId?: string): boolean => {
    const linkedGaps = authorityGapsFor(evidenceAuthority, operation.id);
    if (linkedGaps.length === 0) return operation.status === 'conditional' || operation.status === 'unreachable';
    return linkedGaps.every(gap => gap.operationId === operation.id
      && (gap.nodeId === undefined
        || gap.nodeId === ownerId
        || gap.nodeId === tableId
        || typedProgram.rows.some(row => row.id === gap.nodeId && row.tableId === tableId)
        || typedProgram.cells.some(cell => cell.id === gap.nodeId && cell.tableId === tableId)));
  };
  const isIssuedIncompleteOperation = (
    operation: X4UiLayoutOperation,
    ownerId: string,
    tableId?: string,
  ): boolean => {
    if (!incompleteOperationStatus.has(operation.status) || operation.kernel !== undefined || !operationGapBelongsTo(operation, ownerId, tableId)) return false;
    if (operation.status === 'rejected') {
      return validKernelRefusalShape(operation, true) && operation.reason === operation.kernel?.refusal?.message;
    }
    return true;
  };
  const operationIdsAreIssuedOrder = (operationIds: readonly string[]): boolean => {
    let previousIndex = -1;
    for (const operationId of operationIds) {
      const index = typedProgram.operations.findIndex(operation => operation.id === operationId);
      if (index <= previousIndex) return false;
      previousIndex = index;
    }
    return true;
  };
  for (const table of program.tables) {
    if (table.status !== 'refused' || table.kernelState !== undefined || table.rowIds.length !== 0 || table.operationIds.length === 0 || !operationIdsAreIssuedOrder(table.operationIds)) continue;
    const operations = table.operationIds
      .map(operationId => typedProgram.operations.find(candidate => candidate.id === operationId))
      .filter((operation): operation is X4UiLayoutOperation => operation !== undefined);
    const operation = operations.find(candidate => candidate.kind === 'addTable');
    const addTableOperations = operations.filter(candidate => candidate.kind === 'addTable');
    const refusal = operation?.kernel?.refusal;
    const authorityOperation = operation === undefined ? undefined : authorityOperationFor(evidenceAuthority, operation.id);
    const linkedGaps = operation === undefined ? [] : authorityGapsFor(evidenceAuthority, operation.id);
    const exactRefusal = operation !== undefined
      && authorityOperation !== undefined
      && operation.kind === 'addTable'
      && operation.tableId === table.id
      && operation.frameId === undefined
      && operation.rowId === undefined
      && operation.cellId === undefined
      && addTableOperations.length === 1
      && operationHasOwnerShape(program as unknown as X4UiLayoutProgram, operation, 'addTable')
      && (operation.status === 'rejected'
        ? validKernelRefusalShape(operation, true) && refusal?.message === operation.reason && linkedGaps.length > 0 && linkedGaps.every(gap => gap.operationId === operation.id && (gap.nodeId === undefined || gap.nodeId === table.id))
        : isIssuedIncompleteOperation(operation, table.id));
    const downstreamOperations = operations.filter(candidate => candidate.id !== operation?.id);
    const downstreamShape = downstreamOperations.length > 0
      && downstreamOperations.every(candidate => candidate.kind !== 'addTable'
        && SOURCE_OWNER_DOWNSTREAM_KINDS.has(candidate.kind)
        && operationBelongsToTable(program as unknown as X4UiLayoutProgram, candidate, table)
        && operationHasOwnerShape(program as unknown as X4UiLayoutProgram, candidate, candidate.kind)
        && isIssuedIncompleteOperation(candidate, table.id, table.id));
    if (exactRefusal && (downstreamOperations.length === 0 || downstreamShape)) unmaterializedTableIds.add(table.id);
  }
  // The producer evidence pair owns the exact local-expansion ledger. Scene
  // validation must not reconstruct a second, approximate expansion language.
  for (const gap of program.gaps) {
    const categories = new Set(['profile', 'target', 'source', 'analysis', 'data-flow', 'frame', 'table', 'row', 'cell', 'count', 'index', 'span', 'width', 'percentage', 'height', 'options', 'constant', 'scale', 'sample', 'local-expansion', 'preview-path', 'text', 'parse', 'unsupported', 'layer', 'menu', 'edit-box', 'fontsize', 'property']);
     if (!isRecord(gap) || !exactKeys(gap, ['category', 'status', 'reason', 'source'], ['expression', 'operationId', 'nodeId']) || !sourceIsValid(gap.source) || typeof gap.reason !== 'string' || !categories.has(String(gap.category)) || !['dynamic', 'unknown', 'unsupported', 'incomplete', 'refused'].includes(String(gap.status)) || (gap.expression !== undefined && typeof gap.expression !== 'string') || (gap.operationId !== undefined && typeof gap.operationId !== 'string') || (gap.nodeId !== undefined && typeof gap.nodeId !== 'string')) return refuseStructure('gap');
  }
  for (const operation of typedProgram.operations) {
    if (!validateB119UnsupportedPropertyGaps(typedProgram, evidenceAuthority, operation)) {
      return refuseStructure(`unsupported-property:${operation.id}`);
    }
  }
  if (program.status === 'projected' && (program.gaps.length > 0 || program.operations.some(operation => operation.status !== 'applied') || program.frames.some(frame => !['projected', 'applied'].includes(String(frame.status))) || program.tables.some(table => !['projected', 'applied'].includes(String(table.status))))) return refuseStructure('projected-status');
  for (const frame of program.frames) {
    if (!uniqueStringArray(frame.tableIds) || !uniqueStringArray(frame.operationIds)) return refuseStructure(`frame-arrays:${frame.id}`);
    if (frame.width !== undefined && !isFiniteDimension(frame.width)) return refuseStructure(`frame-width:${frame.id}`);
    if (frame.height !== undefined && !isFiniteDimension(frame.height)) return refuseStructure(`frame-height:${frame.id}`);
    if (!validateConsumedFactDomains(frame.descriptorFacts, ['width', 'height'], ['x', 'y', 'layer'], [], [])) return refuseStructure(`frame-facts:${frame.id}`);
    if (frame.frameTextureLayers !== undefined) {
      for (const layer of frame.frameTextureLayers) {
        if (layer.operationIds.some(operationId => !frame.operationIds.includes(operationId))) return refuseStructure(`frame-texture-owner:${frame.id}:${layer.name}`);
        const layerOperations = layer.operationIds
          .map(operationId => typedProgram.operations.find(operation => operation.id === operationId))
          .filter((operation): operation is X4UiLayoutOperation => operation !== undefined);
        const acceptedOperationKinds = layer.name === 'background'
          ? ['createFrameHandle', 'setBackground']
          : layer.name === 'background2'
            ? ['createFrameHandle', 'setBackground2']
            : ['createFrameHandle', 'setOverlay'];
        if (layerOperations.length !== layer.operationIds.length
          || layerOperations.length === 0
          || layerOperations.some(operation => operation.frameId !== frame.id
            || !acceptedOperationKinds.includes(operation.kind)
            || (operation.kind !== 'createFrameHandle'
              && !operationHasOwnerShape(program as unknown as X4UiLayoutProgram, operation, operation.kind)))) return refuseStructure(`frame-texture-operation:${frame.id}:${layer.name}`);
        const lastOperation = layerOperations[layerOperations.length - 1];
        if (lastOperation.sourceOrder !== layer.sourceOrder || !sameStructuralValue(lastOperation.source, layer.source)) return refuseStructure(`frame-texture-source:${frame.id}:${layer.name}`);
      }
    }
  }
  for (const table of program.tables) {
    if (!uniqueStringArray(table.rowIds) || !uniqueStringArray(table.operationIds)) return refuseStructure(`table-arrays:${table.id}`);
    if (table.kernelState) {
      if (!validateKernelState(table.kernelState)) return refuseStructure(`table-kernel-state:${table.id}`);
      if (!sameLayoutMetrics(table.kernelState.metrics, program.profile.metrics)) return refuseStructure(`table-kernel-metrics:${table.id}`);
      const ownerFrame = table.frameId === undefined
        ? program.frames.find(frame => frame.tableIds.includes(table.id))
        : program.frames.find(frame => frame.id === table.frameId);
      const expectedFrameWidth = ownerFrame?.width ?? program.profile.frame.width;
      if (table.kernelState.frameWidth !== expectedFrameWidth) return refuseStructure(`table-kernel-frame-width:${table.id}`);
    }
    if (table.numColumns !== undefined && !isSafeIntegerAtLeast(table.numColumns, 1)) return refuseStructure(`table-columns:${table.id}`);
    if (table.kernelState && table.numColumns !== undefined && table.kernelState.columns.length !== table.numColumns) return refuseStructure(`table-column-count:${table.id}`);
    if (table.height !== undefined && ((table.height.status === 'known' && !isFiniteDimension(table.height.value)) || (table.height.status !== 'known' && table.height.status !== 'unavailable'))) return refuseStructure(`table-height:${table.id}`);
    if (table.frameWidth !== undefined && !isFiniteDimension(table.frameWidth)) return refuseStructure(`table-frame-width:${table.id}`);
    if (!unmaterializedTableIds.has(table.id) && table.requestedWidth !== undefined && !isFiniteDimension(table.requestedWidth)) return refuseStructure(`table-requested-width:${table.id}`);
    if (!unmaterializedTableIds.has(table.id) && !validateConsumedFactDomains(table.descriptorFacts, ['maxVisibleHeight', 'requestedWidth', 'finalWidth'], ['x', 'y'], [], [])) return refuseStructure(`table-facts:${table.id}`);
    if (table.kernelState && table.height?.status === 'known') {
      const derivedHeight = getFullTableHeight(table.kernelState);
      if (derivedHeight.status !== 'ok' || derivedHeight.value !== table.height.value) return refuseStructure(`table-height-reconciliation:${table.id}`);
    }
  }
  for (const row of program.rows) {
    if (!uniqueStringArray(row.cellIds) || !uniqueStringArray(row.operationIds)) return refuseStructure(`row-arrays:${row.id}`);
    if (row.rowIndex !== undefined && !isSafeIntegerAtLeast(row.rowIndex, 1)) return refuseStructure(`row-index:${row.id}`);
    if (row.height !== undefined && ((row.height.status === 'known' && !isFiniteDimension(row.height.value)) || (row.height.status !== 'known' && row.height.status !== 'unavailable'))) return refuseStructure(`row-height:${row.id}`);
    if (row.kernelState && !validateKernelRow(row.kernelState)) return refuseStructure(`row-kernel:${row.id}`);
    const rowIsUnmaterializedShape = row.status === 'refused' && row.kernelState === undefined && row.rowIndex === undefined && row.cellIds.length === 0;
    if (!rowIsUnmaterializedShape && !validateConsumedFactDomains(row.descriptorFacts, ['paddingTop', 'paddingBottom'], [], [], [])) return refuseStructure(`row-facts:${row.id}`);
  }
  for (const cell of program.cells) {
    if (!uniqueStringArray(cell.operationIds) || !uniqueStringArray(cell.metadataOperationIds)) return refuseStructure(`cell-arrays:${cell.id}`);
    if (!isSafeIntegerAtLeast(cell.column, 1)) return refuseStructure(`cell-column:${cell.id}`);
    if (cell.rowIndex !== undefined && !isSafeIntegerAtLeast(cell.rowIndex, 1)) return refuseStructure(`cell-row-index:${cell.id}`);
    for (const height of [cell.spanWidth, cell.height]) {
      if (height !== undefined && ((height.status === 'known' && !isFiniteDimension(height.value)) || (height.status !== 'known' && height.status !== 'unavailable'))) return refuseStructure(`cell-height:${cell.id}`);
    }
    if (cell.kernelState && !validateKernelCell(cell.kernelState)) return refuseStructure(`cell-kernel:${cell.id}`);
    if (!validateConsumedFactDomains(
      cell.descriptorFacts,
      ['outerWidth', 'outerHeight', 'minTextHeight'],
      ['outerX', 'outerY', 'textX', 'textY', 'text2X', 'text2Y'],
      ['span'],
      ['fontsize', 'text2Fontsize'],
    )) return refuseStructure(`cell-facts:${cell.id}`);
  }
  const frameIds = new Set(program.frames.map(frame => frame.id));
  const tableIds = new Set(program.tables.map(table => table.id));
  const rowIds = new Set(program.rows.map(row => row.id));
  const cellIds = new Set(program.cells.map(cell => cell.id));
  const tableOwner = new Map<string, string>();
  const rowOwner = new Map<string, string>();
  const cellOwner = new Map<string, string>();
  const unmaterializedRows = new Set<string>();
  const isUnmaterializedRow = (row: X4UiLayoutRowNode): boolean => {
    if (row.status !== 'refused' || row.kernelState !== undefined || row.rowIndex !== undefined) return false;
    const table = row.tableId === undefined
      ? undefined
      : typedProgram.tables.find(candidate => candidate.id === row.tableId);
    if (row.tableId !== undefined && table === undefined) return false;
    const rowOperations = (program.operations as unknown as readonly X4UiLayoutOperation[]).filter(operation => operation.kind === 'addRow' && operation.rowId === row.id);
    const rowOperation = rowOperations[0];
    if (rowOperations.length !== 1 || rowOperation === undefined) return false;
    const operations = row.operationIds
      .map(operationId => typedProgram.operations.find(operation => operation.id === operationId))
      .filter((operation): operation is X4UiLayoutOperation => operation !== undefined);
    if (operations.length !== row.operationIds.length
      || !operationIdsAreIssuedOrder(row.operationIds)
      || !operations.some(operation => operation.id === rowOperation.id)) return false;
    const authorityOperationMatches = (operation: X4UiLayoutOperation): boolean => {
      const authorityOperation = authorityOperationFor(evidenceAuthority, operation.id);
      return authorityOperation !== undefined
        && authorityOperation.kind === operation.kind
        && authorityOperation.status === operation.status
        && authorityOperation.frameId === operation.frameId
        && authorityOperation.tableId === operation.tableId
        && authorityOperation.rowId === operation.rowId
        && authorityOperation.cellId === operation.cellId
        && sameStructuralValue(authorityOperation.source, operation.source)
        && sameStructuralValue(authorityOperation.snapshot, operation);
    };
    const gapHasExactOwner = (operation: X4UiLayoutOperation, cellId?: string): boolean => authorityGapsFor(evidenceAuthority, operation.id).every(gap =>
      gap.operationId === operation.id
      && (gap.nodeId === undefined || gap.nodeId === row.id || gap.nodeId === table?.id || gap.nodeId === cellId));
    const rejected = rowOperation?.status === 'rejected'
      && validKernelRefusalShape(rowOperation)
      && rowOperation.reason === rowOperation.kernel?.refusal?.message;
    const authorityOperation = rowOperation === undefined ? undefined : authorityOperationFor(evidenceAuthority, rowOperation.id);
    const operationGaps = rowOperation === undefined ? [] : authorityGapsFor(evidenceAuthority, rowOperation.id);
    const authorityGapShape = rowOperation !== undefined
      && authorityOperation !== undefined
      && ((operationGaps.length === 0 && (rowOperation.status === 'conditional' || rowOperation.status === 'unreachable'))
        || (operationGaps.length > 0 && operationGaps.every(gap => gap.operationId === rowOperation.id && (gap.nodeId === undefined || gap.nodeId === row.id))));
    const unmaterializedStatus = rowOperation?.status === 'unresolved'
      || rowOperation?.status === 'conditional'
      || rowOperation?.status === 'unreachable';
    const primaryIssued = rowOperation !== undefined
      && (rejected ? authorityGapShape : unmaterializedStatus && isIssuedIncompleteOperation(rowOperation, row.id, row.tableId));
    const downstreamOperations = operations.filter(operation => operation.id !== rowOperation?.id);
    const downstreamShape = downstreamOperations.length > 0
      && downstreamOperations.every(operation => operation.kind !== 'addRow'
        && SOURCE_OWNER_DOWNSTREAM_KINDS.has(operation.kind)
        && operationHasOwnerShape(program as unknown as X4UiLayoutProgram, operation, operation.kind)
        && isIssuedIncompleteOperation(operation, row.id, row.tableId));
    const legacyEmptyRowShape = row.cellIds.length === 0
      && primaryIssued
      && operationHasOwnerShape(program as unknown as X4UiLayoutProgram, rowOperation, 'addRow')
      && (downstreamOperations.length === 0 || downstreamShape);
    if (legacyEmptyRowShape) return true;
    if (table?.kernelState === undefined
      || table.rowIds.includes(row.id)
      || table.kernelState.rows.length !== table.rowIds.length
      || rowOperation.status !== 'conditional'
      || rowOperation.kernel !== undefined
      || rowOperation.tableId !== table.id
      || rowOperation.frameId !== undefined
      || rowOperation.cellId !== undefined
      || !sameStructuralValue(rowOperation.source, row.source)
      || !authorityOperationMatches(rowOperation)
      || !gapHasExactOwner(rowOperation)) return false;
    const cells = row.cellIds
      .map(cellId => typedProgram.cells.find(cell => cell.id === cellId))
      .filter((cell): cell is X4UiLayoutCellNode => cell !== undefined);
    if (cells.length !== row.cellIds.length
      || cells.length !== table.kernelState.columns.length
      || cells.some((cell, index) => cell.column !== index + 1
        || cell.status !== 'refused'
        || cell.tableId !== table.id
        || cell.rowId !== row.id
        || cell.rowIndex !== undefined
        || cell.kernelState !== undefined
        || !sameStructuralValue(cell.source, cell.identity === undefined ? row.source : cell.identity.source))) return false;
    const allCellLedgersEmpty = cells.every(cell => cell.operationIds.length === 0 && cell.metadataOperationIds.length === 0);
    const cellOperationIds = new Set(cells.flatMap(cell => [...cell.operationIds, ...cell.metadataOperationIds]));
    const legacyEmptyCellShape = cells.length === 1
      && table.kernelState.columns.length === 1
      && cells[0]?.descriptorFacts.contentKind?.status === 'known'
      && cells[0].descriptorFacts.contentKind.expectedType === 'string'
      && cells[0].descriptorFacts.contentKind.value === 'cell';
    if (downstreamOperations.length === 0) {
      return allCellLedgersEmpty && legacyEmptyCellShape;
    }
    if (!downstreamShape
      || downstreamOperations.some(operation => operation.status !== 'conditional'
        || operation.rowId !== row.id
        || !authorityOperationMatches(operation)
        || !gapHasExactOwner(operation, operation.cellId)
        || (allCellLedgersEmpty
          ? operation.cellId !== undefined
          : operation.cellId === undefined || !cellOperationIds.has(operation.id)))) return false;
    if (allCellLedgersEmpty) return true;
    return cells.every(cell => [...cell.operationIds, ...cell.metadataOperationIds].every(operationId => {
      const operation = typedProgram.operations.find(candidate => candidate.id === operationId);
      return operation !== undefined
        && operations.some(candidate => candidate.id === operation.id)
        && operation.status === 'conditional'
        && operation.rowId === row.id
        && operation.cellId === cell.id
        && authorityOperationMatches(operation)
        && gapHasExactOwner(operation, cell.id);
    }));
  };
  for (const row of program.rows) {
    if (isUnmaterializedRow(row)) unmaterializedRows.add(row.id);
  }
  for (const frame of program.frames) {
    for (const tableId of frame.tableIds) {
      if (!tableIds.has(tableId) || (tableOwner.has(tableId) && tableOwner.get(tableId) !== frame.id)) return refuseStructure(`table-owner:${frame.id}:${tableId}`);
      tableOwner.set(tableId, frame.id);
    }
  }
  for (const table of program.tables) {
    if (table.frameId !== undefined && !frameIds.has(table.frameId)) return refuseStructure(`table-frame-id:${table.id}`);
    if (table.frameId !== undefined && tableOwner.get(table.id) !== table.frameId) return refuseStructure(`table-frame-owner:${table.id}`);
    for (const rowId of table.rowIds) {
      if (!rowIds.has(rowId) || (rowOwner.has(rowId) && rowOwner.get(rowId) !== table.id)) return refuseStructure(`row-owner:${table.id}:${rowId}`);
      rowOwner.set(rowId, table.id);
    }
  }
  for (const row of program.rows) {
    for (const cellId of row.cellIds) {
      if (!cellIds.has(cellId) || (cellOwner.has(cellId) && cellOwner.get(cellId) !== row.id)) return refuseStructure(`cell-owner:${row.id}:${cellId}`);
      cellOwner.set(cellId, row.id);
    }
  }
  for (const cell of program.cells) {
    if (cell.tableId !== undefined && !tableIds.has(cell.tableId)) return refuseStructure(`cell-table-id:${cell.id}`);
    if (cell.rowId !== undefined && !rowIds.has(cell.rowId)) return refuseStructure(`cell-row-id:${cell.id}`);
  }
  for (const row of program.rows) {
    if (unmaterializedRows.has(row.id)) continue;
    const ownerTableId = rowOwner.get(row.id);
    if (ownerTableId === undefined || row.tableId !== ownerTableId) return refuseStructure(`row-reciprocal:${row.id}`);
  }
  for (const cell of program.cells) {
    const ownerRowId = cellOwner.get(cell.id);
    const ownerRow = ownerRowId === undefined ? undefined : program.rows.find(row => row.id === ownerRowId);
    if (ownerRowId === undefined || !ownerRow || cell.rowId !== ownerRowId || cell.tableId !== ownerRow.tableId) return refuseStructure(`cell-reciprocal:${cell.id}`);
  }
  for (const operation of program.operations) {
    if (operation.frameId !== undefined && !frameIds.has(operation.frameId)) return refuseStructure(`operation-frame:${operation.id}`);
    if (operation.tableId !== undefined && !tableIds.has(operation.tableId)) return refuseStructure(`operation-table:${operation.id}`);
    if (operation.rowId !== undefined && !rowIds.has(operation.rowId)) return refuseStructure(`operation-row:${operation.id}`);
    if (operation.cellId !== undefined && !cellIds.has(operation.cellId)) return refuseStructure(`operation-cell:${operation.id}`);
  }
  for (const frame of program.frames) {
    for (const operationId of frame.operationIds) {
      const operation = program.operations.find(candidate => candidate.id === operationId);
      if (!operation || (operation.frameId !== undefined && operation.frameId !== frame.id)) return refuseStructure(`frame-operation:${frame.id}:${operationId}`);
    }
  }
  for (const table of program.tables) {
    for (const operationId of table.operationIds) {
      const operation = program.operations.find(candidate => candidate.id === operationId);
      if (!operation || (operation.tableId !== undefined && operation.tableId !== table.id)) return refuseStructure(`table-operation:${table.id}:${operationId}`);
    }
  }
  for (const row of program.rows) {
    for (const operationId of row.operationIds) {
      const operation = program.operations.find(candidate => candidate.id === operationId);
      if (!operation || (operation.rowId !== undefined && operation.rowId !== row.id)) return refuseStructure(`row-operation:${row.id}:${operationId}`);
    }
  }
  for (const cell of program.cells) {
    for (const operationId of [...cell.operationIds, ...cell.metadataOperationIds]) {
      const operation = program.operations.find(candidate => candidate.id === operationId);
      if (!operation || (operation.cellId !== undefined && operation.cellId !== cell.id)) return refuseStructure(`cell-operation:${cell.id}:${operationId}`);
    }
  }
  for (const operation of program.operations) {
    if (operation.frameId !== undefined && !program.frames.find(frame => frame.id === operation.frameId)?.operationIds.includes(operation.id)) return refuseStructure(`operation-frame-membership:${operation.id}`);
    if (operation.tableId !== undefined && !program.tables.find(table => table.id === operation.tableId)?.operationIds.includes(operation.id)) return refuseStructure(`operation-table-membership:${operation.id}`);
    if (operation.rowId !== undefined && !program.rows.find(row => row.id === operation.rowId)?.operationIds.includes(operation.id)) return refuseStructure(`operation-row-membership:${operation.id}`);
    if (operation.cellId !== undefined) {
      const cell = program.cells.find(candidate => candidate.id === operation.cellId);
      if (!cell || (!cell.operationIds.includes(operation.id) && !cell.metadataOperationIds.includes(operation.id))) return refuseStructure(`operation-cell-membership:${operation.id}`);
    }
    const resolvedTable = operationTableFor(program as unknown as X4UiLayoutProgram, operation);
    const resolvedRow = operationRowFor(program as unknown as X4UiLayoutProgram, operation);
    if (resolvedTable && !resolvedTable.operationIds.includes(operation.id)) return refuseStructure(`resolved-table-membership:${operation.id}`);
    if (resolvedRow && !resolvedRow.operationIds.includes(operation.id)) return refuseStructure(`resolved-row-membership:${operation.id}`);
  }
  const gapNodes = new Map<string, X4UiLayoutFrameNode | X4UiLayoutTableNode | X4UiLayoutRowNode | X4UiLayoutCellNode>([
    ...program.frames.map(frame => [frame.id, frame] as const),
    ...program.tables.map(table => [table.id, table] as const),
    ...program.rows.map(row => [row.id, row] as const),
    ...program.cells.map(cell => [cell.id, cell] as const),
  ]);
  const operationOwnsNode = (
    operation: X4UiLayoutOperation,
    node: X4UiLayoutFrameNode | X4UiLayoutTableNode | X4UiLayoutRowNode | X4UiLayoutCellNode,
  ): boolean => {
    if ('tableIds' in node) {
      return operation.frameId === node.id
        && operation.tableId === undefined
        && operation.rowId === undefined
        && operation.cellId === undefined;
    }
    if ('rowIds' in node) {
      const frameId = node.frameId;
      return operation.tableId === node.id
        && operation.rowId === undefined
        && operation.cellId === undefined
        && (operation.frameId === undefined || operation.frameId === frameId);
    }
    if ('cellIds' in node) {
      const rowNode = node as X4UiLayoutRowNode;
      const table = typedProgram.tables.find(candidate => candidate.id === rowNode.tableId);
      return operation.rowId === rowNode.id
        && operation.cellId === undefined
        && (operation.tableId === undefined || operation.tableId === rowNode.tableId)
        && (operation.frameId === undefined || operation.frameId === table?.frameId);
    }
    const cellNode = node as X4UiLayoutCellNode;
    const row = typedProgram.rows.find(candidate => candidate.id === cellNode.rowId);
    const table = row === undefined ? undefined : typedProgram.tables.find(candidate => candidate.id === row.tableId);
    return operation.cellId === node.id
      && (operation.rowId === undefined || operation.rowId === row?.id)
      && (operation.tableId === undefined || operation.tableId === table?.id)
      && (operation.frameId === undefined || operation.frameId === table?.frameId);
  };
  for (const gap of program.gaps) {
    const operation = gap.operationId === undefined ? undefined : program.operations.find(candidate => candidate.id === gap.operationId);
    const node = gap.nodeId === undefined ? undefined : gapNodes.get(gap.nodeId);
    if (gap.operationId !== undefined && !operation || gap.nodeId !== undefined && !node) return refuseStructure('gap-reference');
    if (operation && node) {
      const operationIds = 'metadataOperationIds' in node
        ? [...node.operationIds, ...node.metadataOperationIds]
        : node.operationIds;
      if (!operationIds.includes(operation.id)) return refuseStructure('gap-operation-membership');
      if (!operationOwnsNode(operation, node)) return refuseStructure('gap-owner-shape');
    }
  }
  for (const frame of program.frames) {
    for (const tableId of frame.tableIds) {
      const table = program.tables.find(candidate => candidate.id === tableId);
      if (table?.frameId !== undefined && table.frameId !== frame.id) return refuseStructure(`frame-table-reciprocal:${frame.id}`);
    }
  }
  for (const table of program.tables) {
    let previousRowIndex: number | undefined;
    let previousRowSourceOrder: number | undefined;
    for (const rowId of table.rowIds) {
      const row = program.rows.find(candidate => candidate.id === rowId);
      if (!row) return refuseStructure(`table-row-missing:${table.id}`);
      if (previousRowSourceOrder !== undefined && sourceOrder(row.source) <= previousRowSourceOrder) return refuseStructure(`table-row-source-order:${table.id}`);
      previousRowSourceOrder = sourceOrder(row.source);
      if (row.rowIndex !== undefined) {
        if (previousRowIndex !== undefined && row.rowIndex <= previousRowIndex) return refuseStructure(`table-row-index-order:${table.id}`);
        previousRowIndex = row.rowIndex;
      }
    }
    for (const rowId of table.rowIds) {
      const row = program.rows.find(candidate => candidate.id === rowId);
      if (row?.tableId !== undefined && row.tableId !== table.id) return refuseStructure(`table-row-parent:${table.id}`);
    }
  }
  for (const row of program.rows) {
    if (unmaterializedRows.has(row.id)) continue;
    let previousColumn: number | undefined;
    for (const cellId of row.cellIds) {
      const cell = program.cells.find(candidate => candidate.id === cellId);
      if (!cell) return refuseStructure(`row-cell-missing:${row.id}`);
      if (previousColumn !== undefined && cell.column <= previousColumn) return refuseStructure(`row-cell-column-order:${row.id}`);
      previousColumn = cell.column;
    }
    for (const cellId of row.cellIds) {
      const cell = program.cells.find(candidate => candidate.id === cellId);
      if (!cell) return refuseStructure(`row-cell-missing:${row.id}`);
      if (cell.tableId !== undefined && row.tableId !== undefined && cell.tableId !== row.tableId) return refuseStructure(`row-cell-table-parent:${row.id}`);
      if (cell.rowId !== undefined && cell.rowId !== row.id) return refuseStructure(`row-cell-row-parent:${row.id}`);
      if (cell.rowIndex !== undefined && row.rowIndex !== undefined && cell.rowIndex !== row.rowIndex) return refuseStructure(`row-cell-index-parent:${row.id}`);
    }
  }
  for (const row of program.rows) {
    if (unmaterializedRows.has(row.id)) continue;
    if (row.tableId !== undefined && rowOwner.get(row.id) !== row.tableId) return refuseStructure(`row-owner-repeat:${row.id}`);
  }
  for (const cell of program.cells) {
    if (cell.rowId !== undefined && cellOwner.get(cell.id) !== cell.rowId) return refuseStructure(`cell-owner-repeat:${cell.id}`);
    if (cell.tableId !== undefined && cell.rowId !== undefined) {
      const ownerRow = program.rows.find(row => row.id === cell.rowId);
      if (ownerRow?.tableId !== undefined && ownerRow.tableId !== cell.tableId) return refuseStructure(`cell-row-table:${cell.id}`);
    }
    if (cell.tableId !== undefined && cellOwner.has(cell.id)) {
      const ownerRow = program.rows.find(row => row.id === cellOwner.get(cell.id));
      if (ownerRow?.tableId !== undefined && ownerRow.tableId !== cell.tableId) return refuseStructure(`cell-owner-table:${cell.id}`);
    }
  }
  for (const table of program.tables) {
    if (!table.kernelState) continue;
    for (const rowId of table.rowIds) {
      const row = program.rows.find(candidate => candidate.id === rowId);
      if (!row || row.rowIndex === undefined || row.rowIndex > table.kernelState.rows.length) return refuseStructure(`table-row-slot:${table.id}`);
      if (row.kernelState && !validateKernelRow(row.kernelState, table.kernelState.columns.length, table.kernelState.rowGroups.length)) return refuseStructure(`table-row-kernel:${row.id}`);
    }
  }
  for (const table of program.tables) {
    if (table.frameId !== undefined && tableOwner.get(table.id) !== table.frameId) return refuseStructure(`table-frame-repeat:${table.id}`);
  }
  for (const frame of program.frames) {
    for (const tableId of frame.tableIds) {
      const table = program.tables.find(candidate => candidate.id === tableId);
      if (!table || table.frameId === undefined || table.frameId !== frame.id) return refuseStructure(`frame-table-repeat:${frame.id}`);
    }
  }
  for (const cell of program.cells) {
    if (!cell.tableId) continue;
    const table = program.tables.find(candidate => candidate.id === cell.tableId);
    if (!table?.kernelState) continue;
    if (cell.rowId !== undefined && unmaterializedRows.has(cell.rowId)) continue;
    if (cell.column > table.kernelState.columns.length || cell.rowIndex === undefined || cell.rowIndex > table.kernelState.rows.length) return refuseStructure(`cell-kernel-slot:${cell.id}`);
  }
  for (const table of program.tables) {
    const state = table.kernelState as unknown as HelperTableState | undefined;
    if (!state) continue;
    if (state.rows.length !== table.rowIds.length) return refuseStructure(`table-state-row-count:${table.id}`);
    if (table.frameWidth !== undefined && table.frameWidth !== state.frameWidth) return refuseStructure(`table-state-frame-width:${table.id}`);
    if (table.requestedWidth !== undefined && table.requestedWidth !== state.requestedWidth) return refuseStructure(`table-state-requested-width:${table.id}`);
    const finalWidthFact = table.descriptorFacts.finalWidth;
    if (finalWidthFact?.status === 'known' && finalWidthFact.expectedType === 'number' && finalWidthFact.value !== state.properties.width) return refuseStructure(`table-state-final-width:${table.id}`);
    const reserveFact = table.descriptorFacts.reserveScrollBar;
    if (reserveFact?.status === 'known' && reserveFact.expectedType === 'boolean') {
      if (reserveFact.value === false && state.properties.reserveScrollBar === true) return refuseStructure(`table-reserve-false-true:${table.id}`);
      if (reserveFact.value === true && state.properties.reserveScrollBar === false && !state.diagnostics.some(diagnostic => reserveDiagnosticMatchesAcceptedFinalization(state, diagnostic, program as unknown as X4UiLayoutProgram, table))) return refuseStructure(`table-reserve-true-false:${table.id}`);
    }
    if (table.height?.status === 'known') {
      const fullHeight = getFullTableHeight(state);
      if (fullHeight.status !== 'ok' || fullHeight.value !== table.height.value) return refuseStructure(`table-height-value:${table.id}`);
    }
    for (let rowIndex = 1; rowIndex <= state.rows.length; rowIndex += 1) {
      const rowId = table.rowIds[rowIndex - 1];
      const row = program.rows.find(candidate => candidate.id === rowId);
      if (!row || row.rowIndex !== rowIndex || !row.kernelState) return refuseStructure(`table-row-state:${table.id}:${rowIndex}`);
      const stateRow = state.rows[rowIndex - 1];
      if (!sameStructuralValue(row.kernelState, stateRow)) return refuseStructure(`row-state-value:${row.id}`);
      const rowFacts: readonly [string, number | boolean][] = [
        ['fixed', stateRow.fixed],
        ['paddingTop', stateRow.paddingTop],
        ['paddingBottom', stateRow.paddingBottom],
        ['borderBelow', stateRow.borderBelow],
        ['scaling', stateRow.scaling],
      ];
      for (const [name, expected] of rowFacts) {
        const fact = row.descriptorFacts[name];
        const expectedType = typeof expected === 'boolean' ? 'boolean' : 'number';
        if (fact?.status === 'known' && fact.expectedType === expectedType && fact.value !== expected) return refuseStructure(`row-fact:${row.id}:${name}`);
      }
      if (row.height?.status === 'known') {
        const height = getRowHeight(state, rowIndex);
        if (height.status !== 'ok' || height.value !== row.height.value) return refuseStructure(`row-height-value:${row.id}`);
      }
      const rowCells = (row.cellIds as readonly string[]).map(cellId => (program.cells as readonly X4UiLayoutCellNode[]).find(candidate => candidate.id === cellId));
      for (let column = 1; column <= state.columns.length; column += 1) {
        const matching = rowCells.filter(cell => cell?.column === column);
        if (matching.length !== 1) return refuseStructure(`row-cell-slot:${row.id}:${column}`);
        const cell = matching[0]!;
        const stateCell = stateRow.cells[column - 1];
        if (cell.rowIndex !== rowIndex || cell.tableId !== table.id || !cell.kernelState || !sameStructuralValue(cell.kernelState, stateCell)) return refuseStructure(`cell-state-value:${cell.id}`);
        const creatorOperations = program.operations
          .filter(operation => operation.cellId === cell.id && isCreatorKind(operation.kind))
          .sort((left, right) => left.modelOrder - right.modelOrder);
        const creator = creatorOperations[creatorOperations.length - 1];
        if (creator?.kind === 'createEditBox') {
          const editBoxInsetFacts = [
            creator.descriptorFacts.editboxBlackInset,
            cell.descriptorFacts.editboxBlackInset,
          ];
          if (editBoxInsetFacts.some(fact => fact?.status === 'known' && validEditBoxBlackInsetFact(fact, state.metrics.uiScale) === undefined)) {
            return refuseStructure(`cell-editbox-black-inset:${cell.id}`);
          }
        }
        const expectedOuterY = scaleY(stateCell.y, state.metrics.uiScale, stateCell.scaling);
        const expectedOuterHeight = stateCell.type === 'icon' || stateCell.type === 'button'
          ? scaleY(stateCell.height, state.metrics.uiScale, stateCell.scaling)
          : getCellHeight(state, rowIndex, column);
        if (!knownFactMatches(cell.descriptorFacts, 'contentKind', stateCell.type, 'string')) return refuseStructure(`cell-content-kind:${cell.id}`);
        if (!knownFactMatches(cell.descriptorFacts, 'scaling', stateCell.scaling, 'boolean')) return refuseStructure(`cell-scaling:${cell.id}`);
        if (!knownFactMatches(cell.descriptorFacts, 'affectRowHeight', stateCell.affectRowHeight, 'boolean')) return refuseStructure(`cell-affect-row-height:${cell.id}`);
        if (!knownFactMatches(cell.descriptorFacts, 'minTextHeight', stateCell.minTextHeight, 'number')) return refuseStructure(`cell-min-text-height:${cell.id}`);
        if (expectedOuterY.status !== 'ok' || !knownFactMatches(cell.descriptorFacts, 'outerY', expectedOuterY.status === 'ok' ? expectedOuterY.value : undefined, 'number')) return refuseStructure(`cell-outer-y:${cell.id}`);
         const outerHeightFact = cell.descriptorFacts.outerHeight;
         const creatorOuterHeightFact = creator?.descriptorFacts.outerHeight;
         const explicitHeight = creator === undefined ? undefined : staticOperationProperty(creator, 'height', 'number');
         let outerHeightMatches = expectedOuterHeight.status === 'ok'
           && knownFactMatches(cell.descriptorFacts, 'outerHeight', expectedOuterHeight.value, 'number');
         if (stateCell.type === 'text' && stateCell.height === 0 && expectedOuterHeight.status === 'ok') {
           outerHeightMatches = outerHeightFact?.status === 'known'
             && outerHeightFact.expectedType === 'number'
             && outerHeightFact.value === expectedOuterHeight.value
             && (explicitHeight !== undefined
               || creatorOuterHeightFact?.status === 'known'
                 && sameStructuralValue(outerHeightFact, creatorOuterHeightFact));
         } else if (stateCell.type === 'text'
           && stateCell.height === 0
           && stateCell.minTextHeight === undefined
           && expectedOuterHeight.status === 'unsupported'
           && expectedOuterHeight.code === 'missing-min-text-height') {
           const cellUnavailableExact = outerHeightFact?.status === 'unavailable'
             && exactKeys(outerHeightFact as unknown as Record<string, unknown>, ['status', 'expectedType', 'reason', 'source'])
             && outerHeightFact.expectedType === 'number'
             && outerHeightFact.reason === 'zero-height text final height requires both a supplied/proven C++ text-height candidate and the exact Helper minRowHeight floor'
             && sameStructuralValue(outerHeightFact.source, cell.source);
           const creatorUnavailableExact = creator?.kind === 'createText'
             && creator.status === 'unresolved'
             && creator.kernel !== undefined
             && explicitHeight === undefined
             && creator.descriptorFacts.height === undefined
             && creatorOuterHeightFact?.status === 'unavailable'
             && exactKeys(creatorOuterHeightFact as unknown as Record<string, unknown>, ['status', 'expectedType', 'reason', 'expression', 'source', 'sourcePin'])
             && creatorOuterHeightFact.expectedType === 'number'
             && creatorOuterHeightFact.reason === 'final text height requires both a supplied/proven C++ text-height candidate and the exact Helper minRowHeight floor'
             && creatorOuterHeightFact.expression === 'Helper.scaleY(Helper.standardTextHeight) - Helper.scaleY(Helper.standardTextOffsety)'
             && sameStructuralValue(creatorOuterHeightFact.source, creator.source)
             && creatorOuterHeightFact.sourcePin?.sourcePath === X4_LAYOUT_PROVENANCE.helperSourcePath
             && creatorOuterHeightFact.sourcePin.lineStart === 5482
             && creatorOuterHeightFact.sourcePin.lineEnd === 5497;
           outerHeightMatches = isExactUnavailableCellHeight(cell.height)
             && cellUnavailableExact
             && creatorUnavailableExact;
         }
         if (!outerHeightMatches) return refuseStructure(`cell-outer-height:${cell.id}`);
         const spanFact = cell.descriptorFacts.span;
         if (spanFact?.status === 'known' && spanFact.expectedType === 'number' && spanFact.value !== stateCell.colspan) return refuseStructure(`cell-span:${cell.id}`);
         const outerWidthFact = cell.descriptorFacts.outerWidth;
         const explicitWidth = creator === undefined ? undefined : staticOperationProperty(creator, 'width', 'number');
         if (explicitWidth !== undefined && explicitWidth !== 0) {
           const expectedOuterWidth = scaleX(explicitWidth, state.metrics.uiScale, stateCell.scaling);
           if (expectedOuterWidth.status !== 'ok'
             || outerWidthFact?.status !== 'known'
             || (outerWidthFact.provenance !== 'source-literal' && outerWidthFact.provenance !== 'direct-helper-scale')
             || !knownFactMatches(cell.descriptorFacts, 'outerWidth', expectedOuterWidth.value, 'number')) return refuseStructure(`cell-outer-width-explicit:${cell.id}`);
         }
         const outerWidthIsHelperDerived = creator !== undefined && (explicitWidth === undefined || explicitWidth === 0)
           ? outerWidthFact?.status === 'known'
             && outerWidthFact.sourcePin?.sourcePath === X4_LAYOUT_PROVENANCE.helperSourcePath
             && outerWidthFact.sourcePin.lineStart === 5372
             && outerWidthFact.sourcePin.lineEnd === 5388
             && outerWidthFact.provenance === 'source-pinned-default'
           : false;
         if (state.final && outerWidthIsHelperDerived) {
           const cellWidth = getColSpanWidth(state, rowIndex, column);
           const outerXFact = cell.descriptorFacts.outerX;
           const expectedOuterWidth = cellWidth.status === 'ok' && outerXFact?.status === 'known' && outerXFact.expectedType === 'number' && typeof outerXFact.value === 'number'
             ? { status: 'ok' as const, value: cellWidth.value - outerXFact.value }
             : { status: 'unavailable' as const };
           if (expectedOuterWidth.status !== 'ok' || !Number.isFinite(expectedOuterWidth.value)) return refuseStructure(`cell-outer-width:${cell.id}`);
           if (!knownFactMatches(cell.descriptorFacts, 'outerWidth', expectedOuterWidth.value, 'number')) return refuseStructure(`cell-outer-width:${cell.id}`);
         }
         if (cell.height?.status === 'known' && stateCell.colspan !== 0) {
          const height = getCellHeight(state, rowIndex, column);
          if (height.status !== 'ok' || height.value !== cell.height.value) return refuseStructure(`cell-height-value:${cell.id}`);
        }
      }
    }
  }
  for (const table of program.tables) {
    if (table.kernelState && !validateCompleteProducerChain(program as unknown as X4UiLayoutProgram, table)) return refuseStructure(`producer-chain:${table.id}`);
  }
  for (const operation of program.operations) {
    if (operation.kind === 'setColSpan' && (operation.status === 'applied' || operation.status === 'unresolved') && operation.kernel !== undefined && !validateSetColSpanProducerTransition(program as unknown as X4UiLayoutProgram, operation)) return refuseStructure(`set-col-span:${operation.id}`);
  }
  if (!validateProducerNodeFacts(program as unknown as X4UiLayoutProgram, unmaterializedRows)) return refuseStructure('producer-node-facts');
  const generatedValid = validateGeneratedSceneIds(program as unknown as X4UiLayoutProgram);
  return generatedValid;
};

/** Test-only first-failure probe; public Scene refusals remain intentionally generic. */
export const diagnoseX4UiSceneStructureForTest = (
  program: unknown,
  evidenceAuthority: X4UiLayoutEvidenceAuthority,
): string | undefined => {
  const diagnostic: { stage?: string } = {};
  if (validateProgramStructure(program, evidenceAuthority, diagnostic)) return undefined;
  return diagnostic.stage ?? 'unknown';
};

const validateSceneProfile = (profile: unknown): profile is X4UiSceneProfile => {
  if (!isRecord(profile) || !exactKeys(profile, ['id', 'provenance', 'source', 'helper', 'widget', 'fonts', 'drawable', 'textPolicy'], ['tableView']) || typeof profile.id !== 'string' || profile.id.length === 0 || typeof profile.provenance !== 'string' || profile.provenance.length === 0 || !isRecord(profile.source) || !isRecord(profile.helper) || !isRecord(profile.widget) || !isRecord(profile.fonts) || !isRecord(profile.drawable) || !isRecord(profile.textPolicy)) return false;
  if (!exactKeys(profile.helper, ['sourcePath', 'sha256']) || !exactKeys(profile.widget, ['sourcePath', 'sha256']) || !validateModelIdentity(profile.source) || !isSha256(profile.helper.sha256) || typeof profile.helper.sourcePath !== 'string' || !isSha256(profile.widget.sha256) || typeof profile.widget.sourcePath !== 'string') return false;
  if (!exactKeys(profile.drawable, ['width', 'height']) || !isFiniteDimension(profile.drawable.width) || !isFiniteDimension(profile.drawable.height) || profile.drawable.width <= 0 || profile.drawable.height <= 0) return false;
  if (!exactKeys(profile.textPolicy, ['nominalDesignSize', 'lineSpacing', 'wrapMode', 'truncationMode', 'whitespacePolicy', 'ellipsisPolicy', 'newlinePolicy', 'truthGrade', 'evidenceState']) || !isRecord(profile.textPolicy.whitespacePolicy) || !isRecord(profile.textPolicy.ellipsisPolicy) || !exactKeys(profile.textPolicy.whitespacePolicy, ['mode', 'breakOn']) || !exactKeys(profile.textPolicy.ellipsisPolicy, ['token', 'placement'])) return false;
  const keys = Object.keys(profile.fonts).sort();
  if (keys.length !== 2 || keys[0] !== 'Zekton' || keys[1] !== 'Zekton Bold') return false;
  for (const name of ['Zekton', 'Zekton Bold'] as const) {
    const pin = profile.fonts[name];
    if (!isRecord(pin) || !exactKeys(pin, ['descriptor', 'atlas']) || !isRecord(pin.descriptor) || !isRecord(pin.atlas) || !exactKeys(pin.descriptor, ['relativePath', 'sha256']) || !exactKeys(pin.atlas, ['relativePath', 'sha256']) || !isSha256(pin.descriptor.sha256) || !isSha256(pin.atlas.sha256) || typeof pin.descriptor.relativePath !== 'string' || typeof pin.atlas.relativePath !== 'string') return false;
  }
  const text = profile.textPolicy;
  if (text.nominalDesignSize !== 32 || !isFiniteDimension(text.lineSpacing) || (text.wrapMode !== 'no-wrap' && text.wrapMode !== 'word-wrap' && text.wrapMode !== 'greedy-word' && text.wrapMode !== 'none') || (text.truncationMode !== 'none' && text.truncationMode !== 'ellipsis') || !isRecord(text.whitespacePolicy) || !isRecord(text.ellipsisPolicy) || (text.newlinePolicy !== 'lf-crlf' && text.newlinePolicy !== 'lf-crlf-and-cr') || text.evidenceState !== ZEKTON_EVIDENCE_STATE || (text.truthGrade !== ZEKTON_TEXT_TRUTH_GRADE && text.truthGrade !== ZEKTON_EVIDENCE_STATE)) return false;
  if ((text.whitespacePolicy.mode !== 'preserve' && text.whitespacePolicy.mode !== 'trim-at-wrap') || (text.whitespacePolicy.breakOn !== 'ascii-space' && text.whitespacePolicy.breakOn !== 'unicode-space') || text.ellipsisPolicy.placement !== 'end' || typeof text.ellipsisPolicy.token !== 'string' || text.ellipsisPolicy.token.length === 0 || text.ellipsisPolicy.token.includes('\n') || text.ellipsisPolicy.token.includes('\r')) return false;
  if (profile.tableView !== undefined) {
    if (!isRecord(profile.tableView)) return false;
    for (const view of Object.values(profile.tableView)) {
      if (!isRecord(view) || !exactKeys(view, [], ['topRow', 'scrollOffset', 'selectedRow'])) return false;
      if (view.topRow !== undefined && !isSafeIntegerAtLeast(view.topRow, 1)) return false;
      if (view.selectedRow !== undefined && !isSafeIntegerAtLeast(view.selectedRow, 0)) return false;
      if (view.scrollOffset !== undefined && (!isFiniteDimension(view.scrollOffset) || view.scrollOffset < 0)) return false;
    }
  }
  return true;
};

interface ExtractedProducerResult {
  readonly program: X4UiLayoutProgram;
  readonly evidenceAuthority: X4UiLayoutEvidenceAuthority;
}

const extractProgram = (input: X4UiLayoutProgramResult): ExtractedProducerResult | X4UiSceneRefusal => {
  if (!isRecord(input) || typeof input.status !== 'string') return refusal('invalid-input', 'scene builder requires exactly one layout program result');
  if (input.status === 'refused') {
    const refused = input as Extract<X4UiLayoutProgramResult, { readonly status: 'refused' }>;
    if (!exactKeys(refused, ['status', 'refusal', 'analysis', 'verification']) || !isRecord(refused.refusal) || typeof refused.refusal.message !== 'string' || !isRecord(refused.analysis) || !isRecord(refused.verification) || !exactKeys(refused.verification, ['game', 'gameVerified']) || refused.verification.game !== X4_UI_LAYOUT_GAME_TRUTH || refused.verification.gameVerified !== false) {
      return refusal('invalid-program', 'refused layout program result wrapper is malformed');
    }
    return refusal('invalid-program', refused.refusal.message, sourceIsValid(refused.refusal.source) ? refused.refusal.source : undefined);
  }
  if (input.status !== 'projected' && input.status !== 'partial') return refusal('invalid-program', 'layout program result wrapper is malformed or refused');
  const successful = input as X4UiLayoutProgramResult & {
    readonly status: 'projected' | 'partial';
    readonly program: X4UiLayoutProgram;
    readonly evidenceAuthority: X4UiLayoutEvidenceAuthority;
  };
  if (!exactKeys(successful, ['status', 'program', 'evidenceAuthority', 'verification'])) {
    return refusal('invalid-program', 'successful layout program result wrapper is malformed or mismatched');
  }
  const programProperty = Object.getOwnPropertyDescriptor(successful, 'program');
  const authorityProperty = Object.getOwnPropertyDescriptor(successful, 'evidenceAuthority');
  if (!programProperty || !('value' in programProperty) || !authorityProperty || !('value' in authorityProperty)) {
    return refusal('invalid-program', 'successful layout program result wrapper must expose data-valued program and evidence authority fields');
  }
  const program = programProperty.value as X4UiLayoutProgram;
  const evidenceAuthority = authorityProperty.value as X4UiLayoutEvidenceAuthority;
  if (!isIssuedX4UiLayoutEvidencePair(program, evidenceAuthority)) {
    return refusal('invalid-program', 'layout program/evidence authority pair was not issued by the layout producer');
  }
  if (!isRecord(program) || !isRecord(evidenceAuthority) || !isRecord(successful.verification) || !exactKeys(successful.verification, ['game', 'gameVerified']) || successful.verification.game !== X4_UI_LAYOUT_GAME_TRUTH || successful.verification.gameVerified !== false || program.status !== successful.status) {
    return refusal('invalid-program', 'successful layout program result wrapper is malformed or mismatched');
  }
  try {
    const evidence = validateX4UiLayoutEvidencePair(program, evidenceAuthority);
    if (!evidence.valid) return refusal('invalid-program', `layout program evidence authority is invalid: ${'reason' in evidence ? evidence.reason : 'unknown validation failure'}`);
  } catch {
    return refusal('invalid-program', 'layout program evidence authority validation failed');
  }
  return { program, evidenceAuthority };
};

const isSceneRefusal = (value: unknown): value is X4UiSceneRefusal =>
  isRecord(value) && value.status === 'refused' && 'refusal' in value;

const validateInputs = (
  input: X4UiLayoutProgramResult,
  corpus: X4UiCorpusCanonicalSuccess,
  profile: X4UiSceneProfile,
): ExtractedProducerResult | X4UiSceneRefusal => {
  let extracted: ExtractedProducerResult | X4UiSceneRefusal;
  try {
    extracted = extractProgram(input);
  } catch {
    return refusal('invalid-input', 'scene builder rejected a malformed layout program result without evaluating geometry');
  }
  if (isSceneRefusal(extracted)) return extracted;
  if (!validateSceneProfile(profile)) return refusal('invalid-profile', 'scene profile is malformed or contains unsafe values');
  const program = extracted.program;
  if (!validateProgramStructure(program, extracted.evidenceAuthority)) return refusal('malformed-structure', 'layout program is malformed, incomplete in required structure, or internally mismatched');
  if (!sameModelIdentity(program.target.sourceIdentity, program.profile.source) || !sameModelIdentity(program.target.sourceIdentity, profile.source)) return refusal('source-mismatch', 'program, target, and scene profile source identities do not match', program.target.source);
  if (program.profile.helper.sourcePath !== X4_LAYOUT_PROVENANCE.helperSourcePath || program.profile.helper.sha256 !== X4_LAYOUT_PROVENANCE.helperSha256 || program.profile.widget.sourcePath !== X4_LAYOUT_PROVENANCE.widgetSourcePath || program.profile.widget.sha256 !== X4_LAYOUT_PROVENANCE.widgetSha256 || profile.helper.sourcePath !== X4_LAYOUT_PROVENANCE.helperSourcePath || profile.helper.sha256 !== X4_LAYOUT_PROVENANCE.helperSha256 || profile.widget.sourcePath !== X4_LAYOUT_PROVENANCE.widgetSourcePath || profile.widget.sha256 !== X4_LAYOUT_PROVENANCE.widgetSha256) return refusal('source-mismatch', 'program or scene profile does not pin the shipped Helper/widget source identities');
  if (program.profile.frame.width !== profile.drawable.width || program.profile.frame.height !== profile.drawable.height) return refusal('identity-mismatch', 'scene drawable dimensions do not match the accepted program frame profile');
  if (!validateCanonicalCorpus(corpus)) return refusal('font-mismatch', 'scene requires the frozen canonical configured-corpus success boundary; detached or synthetic font evidence is refused');
  for (const name of ['Zekton', 'Zekton Bold'] as const) {
    const canonical = name === 'Zekton' ? ZEKTON_CORPUS_ASSETS.regular : ZEKTON_CORPUS_ASSETS.bold;
    const pin = profile.fonts[name];
    if (!sameAssetIdentity(pin.descriptor, canonical.descriptor) || !sameAssetIdentity(pin.atlas, canonical.atlas)) return refusal('font-mismatch', `scene profile font identity for ${name} is stale or mismatched`);
  }
  return extracted;
};

/**
 * Build one immutable scene from one accepted program and the canonical
 * configured-corpus success boundary. A program whose literal status is partial is intentionally
 * accepted; its known nodes are retained and its gaps remain visible.
 */
export function projectX4UiScene(
  input: X4UiLayoutProgramResult,
  corpus: X4UiCorpusCanonicalSuccess,
  profile: X4UiSceneProfile,
): X4UiSceneResult {
  let validated: ExtractedProducerResult | X4UiSceneRefusal;
  try {
    validated = validateInputs(input, corpus, profile);
  } catch {
    return refusal('invalid-input', 'scene builder rejected malformed producer evidence before geometry');
  }
  if (isSceneRefusal(validated)) return validated;
  const program = validated.program as X4UiLayoutProgram & { readonly status: 'projected' | 'partial' };
  const assets: X4UiSceneFontAssetMap = Object.freeze({
    Zekton: corpus.fonts.regular,
    'Zekton Bold': corpus.fonts.bold,
  });
  const context: BuildContext = {
    program,
    assets,
    profile,
    gaps: [],
    programGapIds: new Map(),
    partial: program.status === 'partial',
    gapSequence: 0,
  };
  program.gaps.forEach((gap, index) => {
    const id = addGap(context, {
      category: gap.category,
      status: gap.status === 'dynamic' ? 'unknown' : gap.status,
      reason: gap.reason,
      source: sourceCopy(gap.source),
      ...(gap.expression ? { expression: gap.expression } : {}),
      ...(gap.operationId ? { operationId: gap.operationId } : {}),
      ...(gap.nodeId ? { nodeId: gap.nodeId } : {}),
    });
    context.programGapIds.set(index, id);
  });
  const framesById = new Map(program.frames.map(frame => [frame.id, frame]));
  const tablesById = new Map(program.tables.map(table => [table.id, table]));
  const rowsById = new Map(program.rows.map(row => [row.id, row]));
  const cellsById = new Map(program.cells.map(cell => [cell.id, cell]));
  const operationsById = new Map(program.operations.map(operation => [operation.id, operation]));
  const frameResult = buildFrameNodes(context, framesById);
  const tables: X4UiSceneTableNode[] = [];
  const rows: X4UiSceneRowNode[] = [];
  const cells: X4UiSceneCellNode[] = [];
  const widgets: X4UiSceneWidgetNode[] = [];
  const texts: X4UiSceneTextNode[] = [];
  const glyphs: X4UiSceneGlyphNode[] = [];
  for (const table of [...tablesById.values()].sort((left, right) => compareSourceOrder(sourceOrder(left.source), sourceOrder(right.source)) || left.id.localeCompare(right.id))) {
    const tableResult = buildTableProjection(context, table, framesById, frameResult.frameRects, frameResult.frameClips, rowsById);
    tables.push(tableResult.node);
    const children = buildRowAndCellNodes(context, tableResult.projection, rowsById, cellsById, operationsById);
    rows.push(...children.rows);
    cells.push(...children.cells);
    widgets.push(...children.widgets);
    texts.push(...children.texts);
    glyphs.push(...children.glyphs);
  }
  for (const operation of program.operations) {
    if (!statusIsComplete(operation.status) && !operation.frameId && !operation.tableId && !operation.rowId && !operation.cellId) {
      addGap(context, {
        category: 'operation',
        status: operation.status === 'rejected' ? 'refused' : 'incomplete',
        reason: operation.reason || `operation ${operation.id} was not fully applied`,
        source: sourceCopy(operation.source),
        operationId: operation.id,
      });
    }
  }
  const canonicalGraph = canonicalizeSceneGapGraph(
    context.gaps,
    frameResult.frames,
    tables,
    rows,
    cells,
    widgets,
    texts,
    glyphs,
  );
  const drawableRect = rect(0, 0, profile.drawable.width, profile.drawable.height);
  const sceneStatus: 'projected' | 'partial' = context.partial ? 'partial' : 'projected';
  const scene: X4UiScene = {
    format: X4_UI_SCENE_FORMAT,
    version: X4_UI_SCENE_VERSION,
    status: sceneStatus,
    gameTruth: X4_UI_SCENE_GAME_TRUTH,
    profile: sceneProfileCopy(profile),
    programStatus: program.status,
    drawableRect,
    frames: canonicalGraph.frames,
    tables: canonicalGraph.tables,
    rows: canonicalGraph.rows,
    cells: canonicalGraph.cells,
    widgets: canonicalGraph.widgets,
    texts: canonicalGraph.texts,
    glyphs: canonicalGraph.glyphs,
    gaps: canonicalGraph.gaps,
    preview: {
      provenance: 'preview-only',
      sampleBindings: program.previewSampleBindings.map(binding => ({
        id: binding.id,
        value: binding.value,
        expectedType: binding.expectedType,
        source: sourceCopy(binding.source),
        provenance: binding.provenance,
        status: binding.status,
        ...(binding.reason === undefined ? {} : { reason: binding.reason }),
      })),
      pathSelections: (program.localExpansion?.previewPathSelections || []).map(selection => ({
        id: selection.id,
        boundaryId: selection.boundaryId,
        armId: selection.armId,
        boundary: sourceCopy(selection.boundary),
        provenance: selection.provenance,
      })),
    },
    diagnosticStyle: STYLE,
    verification: REFUSAL_VERIFICATION,
  };
  freezeDeep(scene);
  return freezeDeep({
    status: sceneStatus,
    scene,
    verification: REFUSAL_VERIFICATION,
  });
}

export const buildX4UiScene = projectX4UiScene;
