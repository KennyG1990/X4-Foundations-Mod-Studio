/**
 * Pure, source-ordered projection from the accepted X4 UI call model to the
 * accepted Helper layout kernel.
 *
 * This module is intentionally a bridge only. It reparses accepted source only
 * to validate closed numeric-expression structure; it does not interpret Lua,
 * load a file, inspect a browser, or claim that any projected geometry was
 * accepted by a running game.
 */

import { parse } from 'luaparse';

import type {
  X4UiCallModel,
  X4UiCallColorExpression,
  X4UiCallPropertyProjection,
  X4UiCallRecord,
  X4UiBranchPathSegment,
  X4UiDirectHelperScaleResultIdentity,
  X4UiFunctionContext,
  X4UiLocalFunctionDeclaration,
  X4UiLocalFunctionInvocation,
  X4UiLocalFunctionParameterIdentity,
  X4UiLocalInvocationResultIdentity,
  X4UiRelevantCallName,
  X4UiNumericExpression,
  X4UiSourceLocation,
  X4UiValue,
  X4UiValueReference,
  X4UiVerificationGap,
  X4UiColorExpression,
} from './x4UiCallModel';
import {
  X4_UI_CORPUS_COLORS_XML_PATH,
  X4_UI_CORPUS_COLORS_XML_SHA256,
  X4_UI_CORPUS_COLORS_XML_SIZE,
  X4_UI_CORPUS_COLORS_XSD_PATH,
  X4_UI_CORPUS_COLORS_XSD_SHA256,
  X4_UI_CORPUS_COLORS_XSD_SIZE,
  isX4UiCorpusCanonicalSuccess,
  isX4UiCorpusCanonicalColorSuccess,
  type X4UiCorpusCanonicalSuccess,
  type X4UiCorpusCanonicalColorSuccess,
} from './x4UiCorpusAssets';
import {
  ZEKTON_CORPUS_ASSETS,
  ZEKTON_EVIDENCE_STATE,
  type ZektonFontAssets,
} from './x4UiFontMetrics';
import {
  ZEKTON_TEXT_TRUTH_GRADE,
  layoutZektonText,
} from './x4UiTextLayout';
import type { ZektonTextLayout, ZektonTextLayoutProfile } from './x4UiTextLayout';
import {
  addRow,
  createHelperTable,
  finalizeHelperTable,
  getColSpanWidth,
  getCellHeight,
  getFullTableHeight,
  getRowHeight,
  HELPER_SOURCE_SHA256,
  setCellColSpan,
  setColWidth,
  setColWidthPercent,
  setDefaultCellProperties,
  setDefaultComplexCellProperties,
  setCellHotkey,
  specializeCell,
  scaleFont,
  scaleX,
  scaleY,
  WIDGET_SOURCE_SHA256,
  X4_LAYOUT_PROVENANCE,
  type HelperCellSpecializationInput,
  type HelperTableState,
  type HelperTableInput,
  type LayoutFailure,
  type LayoutResult,
  type StateResult,
  type X4UiLayoutMetrics,
} from './x4UiLayoutKernel';

export const X4_UI_LAYOUT_GAME_TRUTH = 'Not verified in game' as const;

export type X4UiLayoutTruthGrade = 'supplied' | 'captured' | 'unverified-default';

export type X4UiLayoutTargetKind = 'top-level' | 'function' | 'handler';

export type X4UiLayoutHelperConstantName =
  | 'standardTextHeight'
  | 'standardButtonHeight'
  | 'borderSize'
  | 'viewWidth'
  | 'viewHeight';

export interface X4UiLayoutModelIdentity {
  readonly file: string;
  readonly sourcePath?: string;
  readonly sha256: string;
}

export interface X4UiLayoutSourcePin {
  readonly sourcePath: string;
  readonly lineStart: number;
  readonly lineEnd: number;
}

export type X4UiLayoutScalar = number | string | boolean;

export type X4UiLayoutScalarType = 'number' | 'string' | 'boolean';

export type X4UiLayoutFactProvenance =
  | 'source-literal'
  | 'source-pinned-default'
  | 'direct-helper-scale'
  | 'preview-sample';

export type X4UiLayoutColorDomain =
  | 'source-literal-percent-alpha'
  | 'canonical-xml-byte-alpha';

export type X4UiLayoutColorFactProvenance = 'source-literal' | 'canonical-default-only';

export interface X4UiLayoutColorSourceIdentity {
  readonly path: string;
  readonly relativePath: string;
  readonly sha256: string;
  readonly size: number;
}

export interface X4UiLayoutColorDocumentSource {
  readonly path: string;
  readonly index: number;
  readonly id: string;
}

export interface X4UiLayoutColorLiteralField {
  readonly value: number;
  readonly expression: string;
  readonly source: X4UiSourceLocation;
  readonly keySource: X4UiSourceLocation;
}

export interface X4UiLayoutSourceLiteralColorValue {
  readonly kind: 'color';
  readonly domain: 'source-literal-percent-alpha';
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
  readonly glow?: number;
  readonly declarationExpression: string;
  readonly declarationSource: X4UiSourceLocation;
  readonly channels: {
    readonly r: X4UiLayoutColorLiteralField;
    readonly g: X4UiLayoutColorLiteralField;
    readonly b: X4UiLayoutColorLiteralField;
    readonly a: X4UiLayoutColorLiteralField;
    readonly glow?: X4UiLayoutColorLiteralField;
  };
  readonly gameVerification: typeof X4_UI_LAYOUT_GAME_TRUTH;
}

export interface X4UiLayoutCanonicalColorValue {
  readonly kind: 'color';
  readonly domain: 'canonical-xml-byte-alpha';
  readonly canonicalIdentity: 'x4-9.00';
  readonly requestedId: string;
  readonly resolvedBaseId: string;
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
  readonly glow: number;
  readonly baseSource: X4UiLayoutColorDocumentSource;
  readonly mappingSource?: X4UiLayoutColorDocumentSource;
  readonly sourceIdentities: {
    readonly xml: X4UiLayoutColorSourceIdentity;
    readonly xsd: X4UiLayoutColorSourceIdentity;
  };
  readonly gameVerification: typeof X4_UI_LAYOUT_GAME_TRUTH;
}

export type X4UiLayoutColorValue = X4UiLayoutSourceLiteralColorValue | X4UiLayoutCanonicalColorValue;

export type X4UiLayoutDescriptorFact =
  | {
    readonly status: 'known';
    readonly expectedType: X4UiLayoutScalarType;
    readonly value: X4UiLayoutScalar;
    readonly provenance: X4UiLayoutFactProvenance;
    readonly expression: string;
    readonly source: X4UiSourceLocation;
    readonly sourcePin?: X4UiLayoutSourcePin;
    readonly sampleId?: string;
  }
  | {
    readonly status: 'known';
    readonly expectedType: 'color-object';
    readonly value: X4UiLayoutColorValue;
    readonly provenance: X4UiLayoutColorFactProvenance;
    readonly expression: string;
    readonly source: X4UiSourceLocation;
    readonly sourcePin?: X4UiLayoutSourcePin;
    readonly sampleId?: string;
  }
  | {
    readonly status: 'unavailable';
    readonly expectedType: X4UiLayoutScalarType | 'color-object';
    readonly reason: string;
    readonly expression?: string;
    readonly source: X4UiSourceLocation;
    readonly sourcePin?: X4UiLayoutSourcePin;
  };

export type X4UiLayoutDescriptorFacts = Readonly<Record<string, X4UiLayoutDescriptorFact>>;

export interface X4UiLayoutPreviewSampleConsumer {
  readonly operationId: string;
  readonly operationKind: X4UiRelevantCallName;
  readonly field: string;
  readonly source: X4UiSourceLocation;
}

export interface X4UiLayoutPreviewSampleCatalogEntry {
  readonly id: string;
  readonly expression: string;
  readonly expectedType: X4UiLayoutScalarType;
  readonly source: X4UiSourceLocation;
  readonly consumers: readonly X4UiLayoutPreviewSampleConsumer[];
  readonly provenance: 'preview-only';
}

export interface X4UiLayoutPreviewSampleCatalog {
  readonly id: string;
  readonly sourceIdentity: X4UiLayoutModelIdentity;
  readonly targetId: string;
  readonly entries: readonly X4UiLayoutPreviewSampleCatalogEntry[];
}

export interface X4UiLayoutPreviewSampleValue {
  readonly id: string;
  readonly value: X4UiLayoutScalar;
}

export interface X4UiLayoutPreviewSampleInput {
  readonly catalogId: string;
  readonly source: X4UiLayoutModelIdentity;
  readonly values: readonly X4UiLayoutPreviewSampleValue[];
}

export interface X4UiLayoutPreviewSampleBinding extends X4UiLayoutPreviewSampleValue {
  readonly expectedType: X4UiLayoutScalarType;
  readonly source: X4UiSourceLocation;
  readonly provenance: 'preview-only';
  readonly status: 'consumed' | 'not-applied';
  readonly reason?: string;
}

export interface X4UiLayoutPinnedNumber {
  readonly value: number;
  readonly source: X4UiLayoutSourcePin;
}

export type X4UiLayoutHelperConstants = Readonly<{
  [K in X4UiLayoutHelperConstantName]: X4UiLayoutPinnedNumber;
}>;

export interface X4UiLayoutProjectionProfile {
  /** Stable caller-owned profile identity. */
  readonly id: string;
  /** Human-readable provenance label; it is not a game-verification claim. */
  readonly provenance: string;
  readonly truthGrade: X4UiLayoutTruthGrade;
  /** Exact model source identity, including the source text hash. */
  readonly source: X4UiLayoutModelIdentity;
  readonly frame: {
    readonly width: number;
    readonly height: number;
  };
  readonly metrics: X4UiLayoutMetrics;
  readonly helper: {
    readonly sourcePath: string;
    readonly sha256: string;
    readonly constants: X4UiLayoutHelperConstants;
  };
  readonly widget: {
    readonly sourcePath: string;
    readonly sha256: string;
  };
  readonly defaults: {
    /** The shipped Helper default is usable only with an exact source pin. */
    readonly standardButtonHeight?: X4UiLayoutPinnedNumber;
    /** Caller-supplied/proven C++ GetTextHeight candidate; never a browser font guess. */
    readonly minTextHeight?: number;
  };
  /** Explicit opt-in bounds for same-file local-helper expansion. */
  readonly localExpansion?: {
    readonly maxDepth: number;
    readonly maxInvocations: number;
  };
}

export interface X4UiLayoutPreviewPathCatalogEntry {
  readonly id: string;
  readonly boundaryId: string;
  readonly armId: string;
  readonly boundary: X4UiSourceLocation;
  readonly arm: X4UiBranchPathSegment['arm'];
  readonly armIndex: number;
  readonly reachability: X4UiBranchPathSegment['reachability'];
  readonly invocationIds: readonly string[];
  readonly provenance: 'preview-only';
}

export interface X4UiLayoutPreviewPathCatalog {
  readonly id: string;
  readonly sourceIdentity: X4UiLayoutModelIdentity;
  readonly targetId: string;
  readonly entries: readonly X4UiLayoutPreviewPathCatalogEntry[];
}

export interface X4UiLayoutPreviewPathSelectionValue {
  readonly id: string;
  readonly boundaryId: string;
  readonly armId: string;
}

export interface X4UiLayoutPreviewPathSelectionInput {
  readonly catalogId: string;
  readonly source: X4UiLayoutModelIdentity;
  readonly selections: readonly X4UiLayoutPreviewPathSelectionValue[];
}

export interface X4UiLayoutPreviewPathSelectionBinding extends X4UiLayoutPreviewPathSelectionValue {
  readonly boundary: X4UiSourceLocation;
  readonly provenance: 'preview-only';
}

export type X4UiLayoutLocalInvocationStatus =
  | 'expanded'
  | 'rejected'
  | 'conditional'
  | 'unreachable'
  | 'looped';

export interface X4UiLayoutLocalInvocation {
  readonly id: string;
  readonly sourceInvocationId: string;
  readonly calleeDeclarationId?: string;
  readonly source: X4UiSourceLocation;
  readonly ancestry: readonly string[];
  readonly depth: number;
  readonly status: X4UiLayoutLocalInvocationStatus;
  readonly resultConsumed: boolean;
  readonly resolution?: X4UiLocalFunctionInvocation['resolution'];
  readonly previewPathSelectionIds: readonly string[];
  readonly operationIds: readonly string[];
  readonly reason?: string;
}

export interface X4UiLayoutLocalExpansionState {
  readonly limits: NonNullable<X4UiLayoutProjectionProfile['localExpansion']>;
  readonly invocations: readonly X4UiLayoutLocalInvocation[];
  readonly previewPathCatalog: X4UiLayoutPreviewPathCatalog;
  readonly previewPathSelections: readonly X4UiLayoutPreviewPathSelectionBinding[];
}

export interface X4UiLayoutTargetSelector {
  readonly kind: X4UiLayoutTargetKind;
  /** The complete context range.  A name without this range is invalid. */
  readonly source: X4UiSourceLocation;
  readonly name?: string;
  readonly handler?: string;
  /** Optional catalog ID; when present it must match the exact range. */
  readonly id?: string;
}

export interface X4UiLayoutTarget extends X4UiLayoutTargetSelector {
  readonly id: string;
  readonly sourceIdentity: X4UiLayoutModelIdentity;
}

export interface X4UiLayoutTargetCatalog {
  readonly sourceIdentity: X4UiLayoutModelIdentity;
  readonly targets: readonly X4UiLayoutTarget[];
}

export type X4UiLayoutProjectionStatus = 'projected' | 'partial' | 'refused';

export type X4UiLayoutOperationStatus =
  | 'applied'
  | 'rejected'
  | 'unresolved'
  | 'unreachable'
  | 'conditional';

export type X4UiLayoutGapStatus =
  | 'dynamic'
  | 'unknown'
  | 'unsupported'
  | 'incomplete'
  | 'refused';

export type X4UiLayoutGapCategory =
  | 'profile'
  | 'target'
  | 'source'
  | 'analysis'
  | 'data-flow'
  | 'frame'
  | 'table'
  | 'row'
  | 'cell'
  | 'count'
  | 'index'
  | 'span'
  | 'width'
  | 'percentage'
  | 'height'
  | 'options'
  | 'constant'
  | 'scale'
  | 'sample'
  | 'local-expansion'
  | 'preview-path'
  | 'text'
  | X4UiVerificationGap['category'];

export interface X4UiLayoutGap {
  readonly category: X4UiLayoutGapCategory;
  readonly status: X4UiLayoutGapStatus;
  readonly reason: string;
  readonly expression?: string;
  readonly source: X4UiSourceLocation;
  readonly operationId?: string;
  readonly nodeId?: string;
}

export interface X4UiLayoutHeight {
  readonly status: 'known' | 'unavailable';
  readonly value?: number;
  readonly refusal?: LayoutFailure;
}

export interface X4UiLayoutCallMetadata {
  readonly arguments: readonly X4UiValue[];
  readonly receiver?: X4UiValue;
  readonly result?: X4UiValueReference;
  readonly semantics: X4UiCallRecord['semantics'];
}

export interface X4UiLayoutKernelTransition {
  readonly stateBefore?: HelperTableState;
  readonly stateAfter?: HelperTableState;
  readonly refusal?: LayoutFailure;
}

export interface X4UiLayoutScaleResolution {
  readonly status: 'resolved';
  readonly value: number;
  readonly sourceArguments: readonly X4UiSourceLocation[];
}

export interface X4UiLayoutOperation {
  readonly id: string;
  readonly kind: X4UiRelevantCallName;
  readonly source: X4UiSourceLocation;
  readonly sourceOrder: number;
  readonly modelOrder: number;
  readonly status: X4UiLayoutOperationStatus;
  readonly metadata: X4UiLayoutCallMetadata;
  readonly frameId?: string;
  readonly tableId?: string;
  readonly rowId?: string;
  readonly cellId?: string;
  readonly reason?: string;
  readonly kernel?: X4UiLayoutKernelTransition;
  readonly scale?: X4UiLayoutScaleResolution;
  readonly descriptorFacts: X4UiLayoutDescriptorFacts;
  readonly localExpansion?: {
    readonly invocationId: string;
    readonly ancestry: readonly string[];
    readonly depth: number;
    readonly previewPathSelectionIds: readonly string[];
  };
}

export type X4UiLayoutEvidenceReachability = 'reachable' | 'conditional' | 'unreachable';

export interface X4UiLayoutEvidenceExpansionLink {
  readonly invocationInstanceId: string;
  readonly sourceInvocationId: string;
  readonly ancestry: readonly string[];
  readonly depth: number;
  readonly selectionIds: readonly string[];
  readonly catalogId: string;
}

export interface X4UiLayoutEvidenceCall {
  readonly id: string;
  readonly operationId: string;
  readonly kind: X4UiRelevantCallName;
  readonly source: X4UiSourceLocation;
  readonly sourceOrder: number;
  readonly modelOrder: number;
  readonly streamIndex: number;
  readonly status: X4UiLayoutOperationStatus;
  readonly reachability: X4UiLayoutEvidenceReachability;
  readonly expansion?: X4UiLayoutEvidenceExpansionLink;
}

export interface X4UiLayoutEvidenceOperation {
  readonly id: string;
  readonly callId: string;
  readonly kind: X4UiRelevantCallName;
  readonly source: X4UiSourceLocation;
  readonly sourceOrder: number;
  readonly modelOrder: number;
  readonly streamIndex: number;
  readonly status: X4UiLayoutOperationStatus;
  readonly frameId?: string;
  readonly tableId?: string;
  readonly rowId?: string;
  readonly cellId?: string;
  readonly reason?: string;
  readonly expansion?: X4UiLayoutEvidenceExpansionLink;
  readonly snapshot: X4UiLayoutOperation;
}

export interface X4UiLayoutEvidenceSourceBinding {
  readonly id: string;
  readonly callId: string;
  readonly operationId: string;
  readonly kind: X4UiRelevantCallName;
  readonly source: X4UiSourceLocation;
  readonly sourceOrder: number;
  readonly modelOrder: number;
  readonly streamIndex: number;
  readonly reachability: X4UiLayoutEvidenceReachability;
  readonly metadata: X4UiLayoutCallMetadata;
  readonly expansion?: X4UiLayoutEvidenceExpansionLink;
}

export interface X4UiLayoutEvidenceGap {
  readonly category: X4UiLayoutGapCategory;
  readonly status: X4UiLayoutGapStatus;
  readonly reason: string;
  readonly expression?: string;
  readonly source: X4UiSourceLocation;
  readonly operationId?: string;
  readonly nodeId?: string;
}

export interface X4UiLayoutEvidenceInvocation {
  readonly id: string;
  readonly sourceInvocationId: string;
  readonly calleeDeclarationId?: string;
  readonly source: X4UiSourceLocation;
  readonly ancestry: readonly string[];
  readonly depth: number;
  readonly status: X4UiLayoutLocalInvocationStatus;
  readonly resultConsumed: boolean;
  readonly resolution?: X4UiLocalFunctionInvocation['resolution'];
  readonly previewPathSelectionIds: readonly string[];
  readonly operationIds: readonly string[];
  readonly reason?: string;
}

export interface X4UiLayoutEvidenceExpansion {
  readonly limits: NonNullable<X4UiLayoutProjectionProfile['localExpansion']>;
  readonly catalog: X4UiLayoutPreviewPathCatalog;
  readonly selections: readonly X4UiLayoutPreviewPathSelectionBinding[];
  readonly invocations: readonly X4UiLayoutEvidenceInvocation[];
}

export interface X4UiLayoutEvidenceNodeLedger {
  readonly id: string;
  readonly operationIds: readonly string[];
  readonly metadataOperationIds?: readonly string[];
  readonly snapshot: X4UiLayoutFrameNode | X4UiLayoutTableNode | X4UiLayoutRowNode | X4UiLayoutCellNode;
}

export interface X4UiLayoutEvidenceNodeLedgers {
  readonly frames: readonly X4UiLayoutEvidenceNodeLedger[];
  readonly tables: readonly X4UiLayoutEvidenceNodeLedger[];
  readonly rows: readonly X4UiLayoutEvidenceNodeLedger[];
  readonly cells: readonly X4UiLayoutEvidenceNodeLedger[];
}

export interface X4UiLayoutEvidenceLocalFunction {
  readonly id: string;
  readonly source: X4UiSourceLocation;
  readonly parameters: readonly X4UiLocalFunctionParameterIdentity[];
}

export interface X4UiLayoutEvidenceLocalInvocation {
  readonly id: string;
  readonly source: X4UiSourceLocation;
  readonly expression: string;
  readonly calleeDeclarationId?: string;
}

export interface X4UiLayoutEvidenceLocalIdentities {
  readonly functions: readonly X4UiLayoutEvidenceLocalFunction[];
  readonly invocations: readonly X4UiLayoutEvidenceLocalInvocation[];
}

export interface X4UiLayoutEvidenceAuthority {
  readonly version: 3;
  readonly sourceIdentity: X4UiLayoutModelIdentity;
  readonly profile: X4UiLayoutProjectionProfile;
  readonly targetId: string;
  readonly targetSource: X4UiSourceLocation;
  readonly calls: readonly X4UiLayoutEvidenceCall[];
  readonly operations: readonly X4UiLayoutEvidenceOperation[];
  readonly sourceBindings: readonly X4UiLayoutEvidenceSourceBinding[];
  readonly nodes: X4UiLayoutEvidenceNodeLedgers;
  readonly localIdentities: X4UiLayoutEvidenceLocalIdentities;
  readonly gaps: readonly X4UiLayoutEvidenceGap[];
  readonly linkedGapIndexes: readonly number[];
  readonly unlinkedGapIndexes: readonly number[];
  readonly expansion?: X4UiLayoutEvidenceExpansion;
}

export interface X4UiLayoutFrameNode {
  readonly id: string;
  readonly source: X4UiSourceLocation;
  readonly identity?: X4UiValueReference;
  readonly width?: number;
  readonly height?: number;
  readonly widthSource?: X4UiSourceLocation;
  readonly heightSource?: X4UiSourceLocation;
  /** Exact shipped frametextureproperty descriptor projection, in source order. */
  readonly frameTextureLayers?: readonly X4UiLayoutFrameTextureLayer[];
  /** Shipped Helper blurBackground requirement; this is not a drawable surface. */
  readonly blurBackground?: X4UiLayoutDescriptorFact;
  readonly tableIds: readonly string[];
  readonly operationIds: readonly string[];
  readonly descriptorFacts: X4UiLayoutDescriptorFacts;
  readonly status: X4UiLayoutProjectionStatus | X4UiLayoutOperationStatus;
}

export type X4UiLayoutFrameTextureLayerName = 'background' | 'background2' | 'overlay';

export interface X4UiLayoutFrameTextureLayer {
  readonly name: X4UiLayoutFrameTextureLayerName;
  readonly source: X4UiSourceLocation;
  readonly sourceOrder: number;
  readonly operationIds: readonly string[];
  readonly descriptorFacts: X4UiLayoutDescriptorFacts;
}

export interface X4UiLayoutTableNode {
  readonly id: string;
  readonly source: X4UiSourceLocation;
  readonly identity?: X4UiValueReference;
  readonly frameId?: string;
  readonly frameWidth?: number;
  readonly numColumns?: number;
  readonly requestedWidth?: number;
  readonly rowIds: readonly string[];
  readonly operationIds: readonly string[];
  readonly kernelState?: HelperTableState;
  readonly height?: X4UiLayoutHeight;
  readonly descriptorFacts: X4UiLayoutDescriptorFacts;
  readonly status: X4UiLayoutProjectionStatus | X4UiLayoutOperationStatus;
}

export interface X4UiLayoutRowNode {
  readonly id: string;
  readonly source: X4UiSourceLocation;
  readonly identity?: X4UiValueReference;
  readonly tableId?: string;
  readonly rowIndex?: number;
  readonly cellIds: readonly string[];
  readonly operationIds: readonly string[];
  readonly kernelState?: HelperTableState['rows'][number];
  readonly height?: X4UiLayoutHeight;
  readonly descriptorFacts: X4UiLayoutDescriptorFacts;
  readonly status: X4UiLayoutProjectionStatus | X4UiLayoutOperationStatus;
}

export interface X4UiLayoutCellNode {
  readonly id: string;
  readonly source: X4UiSourceLocation;
  readonly identity?: X4UiValueReference;
  readonly tableId?: string;
  readonly rowId?: string;
  readonly rowIndex?: number;
  readonly column: number;
  readonly operationIds: readonly string[];
  readonly metadataOperationIds: readonly string[];
  readonly kernelState?: HelperTableState['rows'][number]['cells'][number];
  readonly spanWidth?: X4UiLayoutHeight;
  readonly height?: X4UiLayoutHeight;
  readonly descriptorFacts: X4UiLayoutDescriptorFacts;
  readonly status: X4UiLayoutProjectionStatus | X4UiLayoutOperationStatus;
}

export interface X4UiLayoutAnalysisState {
  readonly parsed: boolean;
  readonly callModelGaps: number;
  readonly callModelGapsTruncated: boolean;
  readonly incomplete: boolean;
  readonly profile: 'complete' | 'refused';
  readonly staticSource: 'complete' | 'incomplete' | 'refused';
  readonly gameVerification: typeof X4_UI_LAYOUT_GAME_TRUTH;
}

export interface X4UiLayoutProgram {
  readonly status: X4UiLayoutProjectionStatus;
  readonly target: X4UiLayoutTarget;
  readonly profile: X4UiLayoutProjectionProfile;
  readonly analysis: X4UiLayoutAnalysisState;
  readonly localIdentities: X4UiLayoutEvidenceLocalIdentities;
  readonly frames: readonly X4UiLayoutFrameNode[];
  readonly tables: readonly X4UiLayoutTableNode[];
  readonly rows: readonly X4UiLayoutRowNode[];
  readonly cells: readonly X4UiLayoutCellNode[];
  readonly operations: readonly X4UiLayoutOperation[];
  readonly gaps: readonly X4UiLayoutGap[];
  readonly sampleCatalog: X4UiLayoutPreviewSampleCatalog;
  readonly previewSampleBindings: readonly X4UiLayoutPreviewSampleBinding[];
  readonly localExpansion?: X4UiLayoutLocalExpansionState;
  readonly verification: {
    readonly game: typeof X4_UI_LAYOUT_GAME_TRUTH;
    readonly gameVerified: false;
  };
}

interface X4UiLayoutEvidenceIssuanceRecord {
  readonly evidenceAuthority: X4UiLayoutEvidenceAuthority;
  readonly modelSnapshot: X4UiCallModel | undefined;
  readonly colorEvidence?: X4UiCorpusCanonicalColorSuccess;
}

const issuedX4UiLayoutEvidenceAuthorities = new WeakMap<
  X4UiLayoutProgram,
  X4UiLayoutEvidenceIssuanceRecord
>();

export const isIssuedX4UiLayoutEvidencePair = (
  program: unknown,
  evidenceAuthority: unknown,
): boolean => {
  if (program === null || (typeof program !== 'object' && typeof program !== 'function')) return false;
  if (evidenceAuthority === null
    || (typeof evidenceAuthority !== 'object' && typeof evidenceAuthority !== 'function')) return false;
  return issuedX4UiLayoutEvidenceAuthorities.get(program as X4UiLayoutProgram)?.evidenceAuthority
    === evidenceAuthority;
};

export const isIssuedX4UiLayoutEvidencePairForModel = (
  program: unknown,
  evidenceAuthority: unknown,
  model: unknown,
): boolean => {
  if (!isIssuedX4UiLayoutEvidencePair(program, evidenceAuthority)) return false;
  const issuance = issuedX4UiLayoutEvidenceAuthorities.get(program as X4UiLayoutProgram);
  if (!issuance?.modelSnapshot) return false;
  try {
    const normalizedModel = normalizeCompleteX4UiCallModelContent(model);
    return normalizedModel !== undefined && jsonEqual(normalizedModel, issuance.modelSnapshot);
  } catch {
    return false;
  }
};

export type X4UiLayoutProgramResult =
  | {
    readonly status: X4UiLayoutProjectionStatus;
    readonly program: X4UiLayoutProgram;
    readonly evidenceAuthority: X4UiLayoutEvidenceAuthority;
    readonly verification: {
      readonly game: typeof X4_UI_LAYOUT_GAME_TRUTH;
      readonly gameVerified: false;
    };
  }
  | {
    readonly status: 'refused';
    readonly program?: undefined;
    readonly refusal: {
      readonly code:
        | 'malformed-model'
        | 'malformed-profile'
        | 'source-mismatch'
        | 'target-mismatch'
        | 'malformed-samples'
        | 'sample-source-mismatch'
        | 'invalid-samples'
        | 'malformed-preview-path'
        | 'preview-path-source-mismatch'
        | 'invalid-preview-path'
        | 'malformed-color-evidence'
        | 'malformed-corpus-evidence';
      readonly message: string;
      readonly source?: X4UiSourceLocation;
    };
    readonly analysis: X4UiLayoutAnalysisState;
    readonly verification: {
      readonly game: typeof X4_UI_LAYOUT_GAME_TRUTH;
      readonly gameVerified: false;
    };
  };

const HELPER_SOURCE_PATH = X4_LAYOUT_PROVENANCE.helperSourcePath;
const WIDGET_SOURCE_PATH = X4_LAYOUT_PROVENANCE.widgetSourcePath;
const HELPER_CONSTANT_NAMES: readonly X4UiLayoutHelperConstantName[] = Object.freeze([
  'standardTextHeight',
  'standardButtonHeight',
  'borderSize',
  'viewWidth',
  'viewHeight',
]);

const HELPER_CONSTANT_LINES: Readonly<Record<X4UiLayoutHelperConstantName, number>> = Object.freeze({
  standardTextHeight: 533,
  standardButtonHeight: 522,
  borderSize: 709,
  viewWidth: 707,
  viewHeight: 708,
});

const helperPin = (lineStart: number, lineEnd = lineStart): X4UiLayoutSourcePin => ({
  sourcePath: HELPER_SOURCE_PATH,
  lineStart,
  lineEnd,
});

const widgetPin = (lineStart: number, lineEnd = lineStart): X4UiLayoutSourcePin => ({
  sourcePath: WIDGET_SOURCE_PATH,
  lineStart,
  lineEnd,
});

const WIDGET_DEFAULT_PINS = Object.freeze({
  editBoxDefaultTextColor: widgetPin(12774, 12799),
  editBoxBackgroundBlackColor: widgetPin(9680, 9689),
  editBoxConfigBorder: widgetPin(617, 634),
  editBoxTextBorder: widgetPin(848, 860),
  editBoxBlackInset: widgetPin(8702, 8727),
  editBoxInitialInputActive: widgetPin(6325, 6332),
  frameTextureActivation: widgetPin(16945, 17024),
});

const HELPER_DEFAULT_PINS = Object.freeze({
  standardHalignment: helperPin(515),
  standardButtonHeight: helperPin(522),
  standardFont: helperPin(529),
  standardFontSize: helperPin(530),
  standardTextOffsetX: helperPin(531),
  standardTextOffsetY: helperPin(532),
  standardTextHeight: helperPin(533),
  standardEditBoxMaxTextLength: helperPin(535),
  widgetScaling: helperPin(3104),
  widgetWidth: helperPin(3105),
  widgetHeight: helperPin(3106),
  widgetX: helperPin(3107),
  widgetY: helperPin(3108),
  frameLayer: helperPin(3121),
  frameAutoHeight: helperPin(3128),
  frameBlurBackground: helperPin(3133),
  frameTextureIcon: helperPin(3447),
  frameTextureColor: helperPin(3448),
  frameTextureWidth: helperPin(3449),
  frameTextureHeight: helperPin(3450),
  frameTextureRotationRate: helperPin(3451),
  frameTextureRotationStart: helperPin(3452),
  frameTextureRotationDuration: helperPin(3453),
  frameTextureRotationInterval: helperPin(3454),
  frameTextureInitialScaleFactor: helperPin(3455),
  frameTextureScaleDuration: helperPin(3456),
  frameTextureGlowfactor: helperPin(3457),
  tableTabOrder: helperPin(3165),
  tableMaxVisibleHeight: helperPin(3169),
  tableReserveScrollBar: helperPin(3170),
  tableHighlightMode: helperPin(3172),
  tableBackgroundId: helperPin(3174),
  tableBackgroundColor: helperPin(3175),
  tableFinalWidthBoundary: helperPin(4895, 4897),
  rowScaling: helperPin(3189),
  rowFixed: helperPin(3190),
  rowBorderBelow: helperPin(3191),
  rowInteractive: helperPin(3192),
  rowPaddingTop: helperPin(3195),
  rowPaddingBottom: helperPin(3196),
  rowSelectable: helperPin(5087, 5118),
  cellBackgroundColor: helperPin(3200),
  textContent: helperPin(3205),
  textHalign: helperPin(3206),
  textColor: helperPin(3207),
  textPropertyColor: helperPin(3422),
  textFont: helperPin(3210),
  textFontSize: helperPin(3211),
  textWordwrap: helperPin(3212),
  textX: helperPin(3213),
  textY: helperPin(3214),
  textMinRowHeight: helperPin(3215),
  textMinHeightBoundary: helperPin(5482, 5497),
  iconTextSetter: helperPin(5663, 5673),
  buttonTextSetter: helperPin(5753, 5763),
  editBoxTextSetter: helperPin(5960, 5964),
  iconIdentity: helperPin(3219),
  iconColor: helperPin(3220),
  iconAffectRowHeight: helperPin(3222),
  buttonActive: helperPin(3226),
  buttonBackgroundColor: helperPin(3227),
  buttonHighlightColor: helperPin(3228),
  buttonBorderColor: helperPin(3229),
  buttonHeight: helperPin(3230),
  buttonAffectRowHeight: helperPin(3231),
  editBoxBackgroundColor: helperPin(3235),
  editBoxDefaultText: helperPin(3237),
  editBoxDescription: helperPin(3238),
  editBoxSelectTextOnActivation: helperPin(3241),
  editBoxActive: helperPin(3242),
  editBoxMaxChars: helperPin(3244),
  frameWidth: helperPin(3794),
  frameHeight: helperPin(3795),
  frameX: helperPin(3796),
  frameY: helperPin(3797),
  baseCellKind: helperPin(4925),
  baseCellSpan: helperPin(4926),
  baseCellScaling: helperPin(4937, 4939),
  cellSpecialization: helperPin(5432, 5469),
  editBoxMinHeight: helperPin(565),
  editBoxHotkeyDefaults: helperPin(3440, 3445),
});

const HELPER_HEADER_ROW_PINS = Object.freeze({
  bundle: helperPin(614, 621),
  titleFont: helperPin(537),
  standardFontSize: helperPin(530),
  offsetY: helperPin(546),
  minRowHeight: helperPin(547),
  halign: helperPin(619),
  cellBackgroundColor: helperPin(620),
});

const freezeDeep = <T>(value: T, seen = new WeakSet<object>()): T => {
  if (value === null || typeof value !== 'object') return value;
  const objectValue = value as object;
  if (seen.has(objectValue)) return value;
  seen.add(objectValue);
  for (const child of Object.values(value as Record<string, unknown>)) {
    freezeDeep(child, seen);
  }
  Object.freeze(objectValue);
  return value;
};

const cloneDeep = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(item => cloneDeep(item));
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) result[key] = cloneDeep(child);
    return result;
  }
  return value;
};

const cloneJsonLike = (value: unknown, seen = new WeakMap<object, unknown>()): unknown => {
  if (Array.isArray(value)) {
    if (seen.has(value)) return seen.get(value);
    const result: unknown[] = [];
    seen.set(value, result);
    for (const item of value) result.push(item === undefined ? null : cloneJsonLike(item, seen));
    return result;
  }
  if (value !== null && typeof value === 'object') {
    if (seen.has(value)) return seen.get(value);
    const result: Record<string, unknown> = {};
    seen.set(value, result);
    for (const [key, child] of Object.entries(value)) {
      if (child !== undefined) result[key] = cloneJsonLike(child, seen);
    }
    return result;
  }
  return value;
};

const hasOnlyJsonDataProperties = (
  value: unknown,
  active = new Set<object>(),
  allowUndefined = false,
): boolean => {
  const type = typeof value;
  if (type === 'undefined') return allowUndefined;
  if (value === null || type === 'string' || type === 'boolean') return true;
  if (type === 'number') return Number.isFinite(value);
  if (type !== 'object') return false;
  const objectValue = value as object;
  if (active.has(objectValue)) return false;
  try {
    const arrayValue = Array.isArray(objectValue) ? objectValue as readonly unknown[] : undefined;
    const prototype = Object.getPrototypeOf(objectValue);
    if (arrayValue) {
      if (prototype !== Array.prototype) return false;
    } else if (prototype !== Object.prototype && prototype !== null) {
      return false;
    }
    if (Object.getOwnPropertySymbols(objectValue).length > 0) return false;
    const keys = Object.keys(objectValue);
    if (arrayValue
      && (keys.length !== arrayValue.length || keys.some((key, index) => key !== String(index)))) return false;
    active.add(objectValue);
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(objectValue, key);
      if (!descriptor
        || !descriptor.enumerable
        || !Object.prototype.hasOwnProperty.call(descriptor, 'value')
        || !hasOnlyJsonDataProperties(descriptor.value, active, arrayValue === undefined)) {
        active.delete(objectValue);
        return false;
      }
    }
    active.delete(objectValue);
    return true;
  } catch {
    active.delete(objectValue);
    return false;
  }
};

const normalizeCompleteX4UiCallModelContent = (model: unknown): unknown | undefined => {
  try {
    if (!hasOnlyJsonDataProperties(model)) return undefined;
    const normalized = cloneJsonLike(model);
    if (!hasOnlyJsonDataProperties(normalized)
      || closedJsonDomain(normalized, 'normalized model') !== undefined) {
      return undefined;
    }
    return normalized;
  } catch {
    return undefined;
  }
};

const snapshotCompleteX4UiCallModel = (model: X4UiCallModel): X4UiCallModel | undefined => {
  const normalized = normalizeCompleteX4UiCallModelContent(model);
  return normalized === undefined ? undefined : freezeDeep(normalized) as X4UiCallModel;
};

const cloneLocation = (location: X4UiSourceLocation): X4UiSourceLocation =>
  cloneDeep(location) as X4UiSourceLocation;

const cloneMetadataValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(item => cloneMetadataValue(item));
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      if (key !== 'numericExpression') result[key] = cloneMetadataValue(child);
    }
    return result;
  }
  return value;
};

const cloneReference = (reference: X4UiValueReference | undefined): X4UiValueReference | undefined =>
  reference ? cloneMetadataValue(reference) as X4UiValueReference : undefined;

const cloneMetadata = (call: X4UiCallRecord): X4UiLayoutCallMetadata => ({
  arguments: cloneMetadataValue(call.arguments) as X4UiValue[],
  ...(call.receiver ? { receiver: cloneMetadataValue(call.receiver) as X4UiValue } : {}),
  ...(call.result ? { result: cloneMetadataValue(call.result) as X4UiValueReference } : {}),
  semantics: cloneMetadataValue(call.semantics) as X4UiCallRecord['semantics'],
});

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isNonNegativeNumber = (value: unknown): value is number =>
  isFiniteNumber(value) && value >= 0;

const isHexSha256 = (value: unknown): value is string =>
  typeof value === 'string' && /^[0-9A-Fa-f]{64}$/.test(value);

const exactAssetIdentity = (
  value: unknown,
  expected: { readonly relativePath: string; readonly sha256: string },
): boolean => isObject(value)
  && value.relativePath === expected.relativePath
  && value.sha256 === expected.sha256;

const exactZektonFontIdentity = (
  value: unknown,
  expected: {
    readonly descriptor: { readonly relativePath: string; readonly sha256: string };
    readonly atlas: { readonly relativePath: string; readonly sha256: string };
  },
): value is ZektonFontAssets => isObject(value)
  && value.format === 'x4-zekton-font-assets'
  && value.evidenceState === ZEKTON_EVIDENCE_STATE
  && exactAssetIdentity(value.descriptorIdentity, expected.descriptor)
  && exactAssetIdentity(value.atlasIdentity, expected.atlas)
  && isObject(value.descriptor)
  && exactAssetIdentity(value.descriptor.identity, expected.descriptor)
  && isObject(value.atlas)
  && exactAssetIdentity(value.atlas.identity, expected.atlas);

const isPinnedCanonicalCorpus = (value: unknown): value is X4UiCorpusCanonicalSuccess => {
  try {
    if (!isX4UiCorpusCanonicalSuccess(value)) return false;
    return value.helperSourceHash === HELPER_SOURCE_SHA256
      && value.widgetSourceHash === WIDGET_SOURCE_SHA256
      && value.assets.helper.relativePath === HELPER_SOURCE_PATH
      && value.assets.helper.sha256 === HELPER_SOURCE_SHA256
      && value.assets.widget.relativePath === WIDGET_SOURCE_PATH
      && value.assets.widget.sha256 === WIDGET_SOURCE_SHA256
      && value.assets.regular.decoded === value.fonts.regular
      && value.assets.bold.decoded === value.fonts.bold
      && exactZektonFontIdentity(value.fonts.regular, ZEKTON_CORPUS_ASSETS.regular)
      && exactZektonFontIdentity(value.fonts.bold, ZEKTON_CORPUS_ASSETS.bold);
  } catch {
    return false;
  }
};

const sourcePositionKey = (position: X4UiSourceLocation['start']): string =>
  `${position.line}:${position.column}:${position.offset}`;

const locationKey = (location: X4UiSourceLocation): string =>
  [
    location.file,
    location.sourcePath || '',
    sourcePositionKey(location.start),
    sourcePositionKey(location.end),
  ].join('|');

const localInvocationIdentityKey = (location: X4UiSourceLocation): string =>
  `${location.file}|${location.sourcePath || ''}|${location.start.offset}|${location.end.offset}`;

const sameOptionalString = (left: string | undefined, right: string | undefined): boolean =>
  (left || undefined) === (right || undefined);

const locationsEqual = (left: X4UiSourceLocation | undefined, right: X4UiSourceLocation | undefined): boolean =>
  Boolean(left && right)
  && left?.file === right?.file
  && sameOptionalString(left?.sourcePath, right?.sourcePath)
  && sourcePositionKey(left!.start) === sourcePositionKey(right!.start)
  && sourcePositionKey(left!.end) === sourcePositionKey(right!.end);

const isSourceLocationShape = (value: unknown): value is X4UiSourceLocation => {
  if (!isObject(value) || typeof value.file !== 'string' || !isObject(value.start) || !isObject(value.end)) return false;
  return Number.isInteger(value.start.line)
    && Number.isInteger(value.start.column)
    && Number.isInteger(value.start.offset)
    && Number.isInteger(value.end.line)
    && Number.isInteger(value.end.column)
    && Number.isInteger(value.end.offset)
    && (value.sourcePath === undefined || typeof value.sourcePath === 'string');
};

const locationContains = (outer: X4UiSourceLocation, inner: X4UiSourceLocation): boolean =>
  outer.file === inner.file
  && sameOptionalString(outer.sourcePath, inner.sourcePath)
  && outer.start.offset <= inner.start.offset
  && outer.end.offset >= inner.end.offset;

const sourceIdentityKey = (identity: X4UiLayoutModelIdentity): string =>
  `${identity.file}|${identity.sourcePath || ''}|${identity.sha256}`;

const referenceKey = (reference: X4UiValueReference | undefined): string | undefined => {
  if (!reference) return undefined;
  const index = reference.index ? valueIdentityKey(reference.index) : '';
  return [
    reference.kind,
    reference.path,
    reference.origin,
    locationKey(reference.source),
    reference.parentPath || '',
    reference.relatedPath || '',
    index,
  ].join('|');
};

const valueIdentityKey = (value: X4UiValue): string => {
  const reference = referenceKey(value.reference);
  return [
    value.status,
    value.type,
    value.expression,
    locationKey(value.location),
    reference || '',
  ].join('|');
};

const programId = (prefix: string, identity: string): string => `${prefix}:${identity}`;

const sourceHashBytes = (text: string): number[] => {
  const bytes: number[] = [];
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code >= 0xd800 && code <= 0xdbff && index + 1 < text.length) {
      const low = text.charCodeAt(index + 1);
      if (low >= 0xdc00 && low <= 0xdfff) {
        const codePoint = 0x10000 + ((code - 0xd800) << 10) + (low - 0xdc00);
        bytes.push(
          0xf0 | (codePoint >> 18),
          0x80 | ((codePoint >> 12) & 0x3f),
          0x80 | ((codePoint >> 6) & 0x3f),
          0x80 | (codePoint & 0x3f),
        );
        index += 1;
      } else {
        bytes.push(0xef, 0xbf, 0xbd);
      }
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      bytes.push(0xef, 0xbf, 0xbd);
    } else {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    }
  }
  return bytes;
};

const rightRotate = (value: number, bits: number): number =>
  (value >>> bits) | (value << (32 - bits));

const sha256 = (text: string): string => {
  const bytes = sourceHashBytes(text);
  const bitLength = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  const high = Math.floor(bitLength / 0x100000000);
  const low = bitLength >>> 0;
  bytes.push((high >>> 24) & 0xff, (high >>> 16) & 0xff, (high >>> 8) & 0xff, high & 0xff);
  bytes.push((low >>> 24) & 0xff, (low >>> 16) & 0xff, (low >>> 8) & 0xff, low & 0xff);

  const constants = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  let hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];
  for (let offset = 0; offset < bytes.length; offset += 64) {
    const schedule = new Array<number>(64).fill(0);
    for (let index = 0; index < 16; index += 1) {
      const position = offset + index * 4;
      schedule[index] = (
        (bytes[position] << 24)
        | (bytes[position + 1] << 16)
        | (bytes[position + 2] << 8)
        | bytes[position + 3]
      ) >>> 0;
    }
    for (let index = 16; index < 64; index += 1) {
      const value = schedule[index - 15];
      const sigma0 = rightRotate(value, 7) ^ rightRotate(value, 18) ^ (value >>> 3);
      const previous = schedule[index - 2];
      const sigma1 = rightRotate(previous, 17) ^ rightRotate(previous, 19) ^ (previous >>> 10);
      schedule[index] = (schedule[index - 16] + sigma0 + schedule[index - 7] + sigma1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = hash;
    for (let index = 0; index < 64; index += 1) {
      const sigma1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const choose = (e & f) ^ (~e & g);
      const temp1 = (h + sigma1 + choose + constants[index] + schedule[index]) >>> 0;
      const sigma0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (sigma0 + majority) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }
    hash = hash.map((value, index) => (value + [a, b, c, d, e, f, g, h][index]) >>> 0);
  }
  return hash.map(value => value.toString(16).padStart(8, '0')).join('').toUpperCase();
};

const modelIdentity = (model: X4UiCallModel): X4UiLayoutModelIdentity => ({
  file: model.file.rel,
  ...(model.file.sourcePath ? { sourcePath: model.file.sourcePath } : {}),
  sha256: sha256(model.file.text),
});

const fullSourceLocation = (model: X4UiCallModel): X4UiSourceLocation => {
  const lastNewline = model.file.text.lastIndexOf('\n');
  const line = (model.file.text.match(/\n/g)?.length || 0) + 1;
  const column = lastNewline >= 0 ? model.file.text.length - lastNewline - 1 : model.file.text.length;
  return {
    file: model.file.rel,
    ...(model.file.sourcePath ? { sourcePath: model.file.sourcePath } : {}),
    start: { line: 1, column: 0, offset: 0 },
    end: { line, column, offset: model.file.text.length },
  };
};

const contextKey = (context: X4UiFunctionContext): string =>
  `${context.kind}|${context.name || ''}|${context.handler || ''}|${context.source ? locationKey(context.source) : ''}`;

const targetIdFor = (identity: X4UiLayoutModelIdentity, context: X4UiFunctionContext, source: X4UiSourceLocation): string =>
  programId('target', `${sourceIdentityKey(identity)}|${context.kind}|${locationKey(source)}`);

const contextName = (context: X4UiFunctionContext): string | undefined =>
  context.kind === 'handler' ? context.name || context.handler : context.name;

/** Build a deterministic source-ranged catalog without flattening contexts. */
export function createX4UiLayoutTargetCatalog(model: X4UiCallModel): X4UiLayoutTargetCatalog {
  const identity = modelIdentity(model);
  const contexts = new Map<string, { context: X4UiFunctionContext; source: X4UiSourceLocation }>();
  const topSource = fullSourceLocation(model);
  const addContext = (context: X4UiFunctionContext): void => {
    const source = context.source || (context.kind === 'top-level' ? topSource : undefined);
    if (!source) return;
    const key = contextKey(context);
    if (!contexts.has(key)) contexts.set(key, { context, source });
  };
  addContext({
    kind: 'top-level',
    source: topSource,
    branchPath: [],
    loopPath: [],
    reachability: 'reachable',
  });
  for (const record of model.records) addContext(record.context);
  const targets = [...contexts.values()]
    .sort((left, right) => {
      const leftStart = left.source.start.offset;
      const rightStart = right.source.start.offset;
      if (leftStart !== rightStart) return leftStart - rightStart;
      const leftEnd = left.source.end.offset;
      const rightEnd = right.source.end.offset;
      if (leftEnd !== rightEnd) return leftEnd - rightEnd;
      return contextKey(left.context).localeCompare(contextKey(right.context));
    })
    .map(({ context, source }) => ({
      kind: context.kind,
      source: cloneLocation(source),
      ...(contextName(context) ? { name: contextName(context) } : {}),
      ...(context.handler ? { handler: context.handler } : {}),
      id: targetIdFor(identity, context, source),
      sourceIdentity: cloneDeep(identity) as X4UiLayoutModelIdentity,
    }));
  return freezeDeep({
    sourceIdentity: cloneDeep(identity) as X4UiLayoutModelIdentity,
    targets,
  });
}

const invalidAnalysis = (profile: 'complete' | 'refused', parsed: boolean, gaps = 0, truncated = false): X4UiLayoutAnalysisState => ({
  parsed,
  callModelGaps: gaps,
  callModelGapsTruncated: truncated,
  incomplete: !parsed || truncated || gaps > 0,
  profile,
  staticSource: profile === 'refused' ? 'refused' : (!parsed || truncated || gaps > 0 ? 'incomplete' : 'complete'),
  gameVerification: X4_UI_LAYOUT_GAME_TRUTH,
});

const refusalResult = (
  code:
    | 'malformed-model'
    | 'malformed-profile'
    | 'source-mismatch'
    | 'target-mismatch'
    | 'malformed-samples'
    | 'sample-source-mismatch'
    | 'invalid-samples'
    | 'malformed-preview-path'
    | 'preview-path-source-mismatch'
    | 'invalid-preview-path'
    | 'malformed-color-evidence'
    | 'malformed-corpus-evidence',
  message: string,
  model?: X4UiCallModel,
  source?: X4UiSourceLocation,
): X4UiLayoutProgramResult => freezeDeep({
  status: 'refused' as const,
  program: undefined,
  refusal: { code, message, ...(source ? { source: cloneLocation(source) } : {}) },
  analysis: invalidAnalysis('refused', model?.parsed ?? false, model?.verificationGaps.length || 0, model?.verificationGapsTruncated || false),
  verification: { game: X4_UI_LAYOUT_GAME_TRUTH, gameVerified: false as const },
});

/**
 * Reproject an exact issued layout pair after a source identity change.
 *
 * This owner-only path replays only the exact loader-issued canonical color
 * authority retained for the original program. It deliberately omits preview
 * samples and preview paths; it is not a general optional-input replay API.
 * Programs issued without color evidence retain the original three-argument
 * projection behavior.
 */
export const reprojectX4UiLayoutProgramWithIssuedColorAuthority = (
  issuedProgram: unknown,
  issuedEvidenceAuthority: unknown,
  model: X4UiCallModel,
  targetSelector: X4UiLayoutTargetSelector,
  profile: X4UiLayoutProjectionProfile,
): X4UiLayoutProgramResult => {
  let issuance: X4UiLayoutEvidenceIssuanceRecord | undefined;
  try {
    if (!isIssuedX4UiLayoutEvidencePair(issuedProgram, issuedEvidenceAuthority)) {
      return refusalResult(
        'malformed-color-evidence',
        'layout program/evidence pair was not issued by the layout program owner',
      );
    }
    issuance = issuedX4UiLayoutEvidenceAuthorities.get(issuedProgram as X4UiLayoutProgram);
    if (!issuance) {
      return refusalResult(
        'malformed-color-evidence',
        'layout program/evidence issuance record is unavailable',
      );
    }
    if (issuance.colorEvidence !== undefined
      && !isX4UiCorpusCanonicalColorSuccess(issuance.colorEvidence)) {
      return refusalResult(
        'malformed-color-evidence',
        'retained loader-issued canonical color authority no longer passes its loader guard',
      );
    }
    return issuance.colorEvidence === undefined
      ? projectX4UiLayoutProgram(model, targetSelector, profile)
      : projectX4UiLayoutProgram(model, targetSelector, profile, undefined, undefined, issuance.colorEvidence);
  } catch {
    return refusalResult(
      'malformed-color-evidence',
      issuance?.colorEvidence === undefined
        ? 'layout program/evidence reprojection was not safely readable'
        : 'retained loader-issued canonical color authority was not safely readable',
    );
  }
};

const valueStatus = (value: X4UiValue | undefined): X4UiLayoutGapStatus => {
  if (!value) return 'unknown';
  return value.status === 'dynamic' ? 'dynamic' : value.status === 'unknown' ? 'unknown' : 'unsupported';
};

const hasExactRecordKeys = (
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[] = [],
): boolean => required.every(key => Object.prototype.hasOwnProperty.call(value, key))
  && Object.keys(value).every(key => required.includes(key) || optional.includes(key));

const profilePinnedNumberShape = (
  value: unknown,
  expectedSourcePath?: string,
): value is X4UiLayoutPinnedNumber => {
  if (!isObject(value) || !hasExactRecordKeys(value, ['value', 'source'])) return false;
  if (!isFiniteNumber(value.value) || value.value < 0 || !isObject(value.source)
    || !hasExactRecordKeys(value.source, ['sourcePath', 'lineStart', 'lineEnd'])
    || typeof value.source.sourcePath !== 'string'
    || (expectedSourcePath !== undefined && value.source.sourcePath !== expectedSourcePath)
    || !Number.isInteger(value.source.lineStart)
    || !Number.isInteger(value.source.lineEnd)) return false;
  const source = value.source as unknown as X4UiLayoutSourcePin;
  return source.lineStart >= 1 && source.lineEnd >= source.lineStart;
};

const sourcePinValid = (pin: unknown, expectedPath: string): pin is X4UiLayoutPinnedNumber => {
  return profilePinnedNumberShape(pin, expectedPath);
};

interface NormalizedProfile {
  readonly value: X4UiLayoutProjectionProfile;
  readonly sourceIdentity: X4UiLayoutModelIdentity;
}

const normalizeProfile = (
  profile: unknown,
  model: X4UiCallModel,
): { ok: true; value: NormalizedProfile } | { ok: false; code: 'malformed-profile' | 'source-mismatch'; message: string } => {
  if (!isObject(profile)) return { ok: false, code: 'malformed-profile', message: 'projection profile must be an object' };
  if (!hasExactRecordKeys(profile, [
    'id', 'provenance', 'truthGrade', 'source', 'frame', 'metrics', 'helper', 'widget', 'defaults',
  ], ['localExpansion'])) {
    return { ok: false, code: 'malformed-profile', message: 'projection profile contains an unknown or missing key' };
  }
  if (typeof profile.id !== 'string' || profile.id.length === 0) {
    return { ok: false, code: 'malformed-profile', message: 'profile.id must be a non-empty string' };
  }
  if (typeof profile.provenance !== 'string' || profile.provenance.length === 0) {
    return { ok: false, code: 'malformed-profile', message: 'profile.provenance must be a non-empty string' };
  }
  if (!['supplied', 'captured', 'unverified-default'].includes(String(profile.truthGrade))) {
    return { ok: false, code: 'malformed-profile', message: 'profile.truthGrade is invalid' };
  }
  const identity = modelIdentity(model);
  if (!isObject(profile.source)
    || !hasExactRecordKeys(profile.source, ['file', 'sha256'], ['sourcePath'])
    || profile.source.file !== identity.file
    || (profile.source.sourcePath !== undefined && typeof profile.source.sourcePath !== 'string')
    || !sameOptionalString(typeof profile.source.sourcePath === 'string' ? profile.source.sourcePath : undefined, identity.sourcePath)
    || !isHexSha256(profile.source.sha256)) {
    return { ok: false, code: 'source-mismatch', message: 'profile source identity does not exactly match the call-model source' };
  }
  if (profile.source.sha256.toUpperCase() !== identity.sha256) {
    return { ok: false, code: 'source-mismatch', message: 'profile source hash does not match the call-model source text' };
  }
  if (!isObject(profile.frame)
    || !hasExactRecordKeys(profile.frame, ['width', 'height'])
    || !isNonNegativeNumber(profile.frame.width)
    || !isNonNegativeNumber(profile.frame.height)) {
    return { ok: false, code: 'malformed-profile', message: 'profile.frame dimensions must be finite and non-negative' };
  }
  if (!isObject(profile.metrics)
    || !hasExactRecordKeys(profile.metrics, ['uiScale', 'borderSize', 'scrollbarWidth', 'standardContainerOffset'])
    || !isFiniteNumber(profile.metrics.uiScale)
    || profile.metrics.uiScale <= 0
    || !isNonNegativeNumber(profile.metrics.borderSize)
    || !isNonNegativeNumber(profile.metrics.scrollbarWidth)
    || !isNonNegativeNumber(profile.metrics.standardContainerOffset)) {
    return { ok: false, code: 'malformed-profile', message: 'profile.metrics contains an invalid domain value' };
  }
  if (!isObject(profile.helper)
    || !hasExactRecordKeys(profile.helper, ['sourcePath', 'sha256', 'constants'])
    || profile.helper.sourcePath !== HELPER_SOURCE_PATH
    || profile.helper.sha256 !== HELPER_SOURCE_SHA256
    || !isObject(profile.helper.constants)
    || !hasExactRecordKeys(profile.helper.constants, HELPER_CONSTANT_NAMES)) {
    return { ok: false, code: 'source-mismatch', message: 'profile Helper provenance or hash is incompatible with the accepted kernel' };
  }
  const constants = {} as Record<X4UiLayoutHelperConstantName, X4UiLayoutPinnedNumber>;
  for (const name of HELPER_CONSTANT_NAMES) {
    const pin = profile.helper.constants[name];
    if (!sourcePinValid(pin, HELPER_SOURCE_PATH)) {
      return { ok: false, code: 'malformed-profile', message: `profile.helper.constants.${name} is not a source-pinned finite number` };
    }
    if (pin.source.lineStart !== HELPER_CONSTANT_LINES[name] || pin.source.lineEnd !== HELPER_CONSTANT_LINES[name]) {
      return { ok: false, code: 'source-mismatch', message: `profile.helper.constants.${name} does not cite its exact accepted Helper source line` };
    }
    constants[name] = cloneDeep(pin) as X4UiLayoutPinnedNumber;
  }
  if (constants.standardTextHeight.value !== 16) {
    return { ok: false, code: 'source-mismatch', message: 'standardTextHeight must match the pinned Helper declaration value 16' };
  }
  if (constants.standardButtonHeight.value !== 25) {
    return { ok: false, code: 'source-mismatch', message: 'standardButtonHeight must match the pinned Helper declaration value 25' };
  }
  if (constants.viewWidth.value !== profile.frame.width
    || constants.viewHeight.value !== profile.frame.height) {
    return { ok: false, code: 'source-mismatch', message: 'Helper view dimensions must exactly match the profile frame dimensions' };
  }
  if (constants.borderSize.value !== profile.metrics.borderSize) {
    return { ok: false, code: 'source-mismatch', message: 'Helper.borderSize and profile.metrics.borderSize disagree' };
  }
  if (!isObject(profile.widget)
    || !hasExactRecordKeys(profile.widget, ['sourcePath', 'sha256'])
    || profile.widget.sourcePath !== WIDGET_SOURCE_PATH
    || profile.widget.sha256 !== WIDGET_SOURCE_SHA256) {
    return { ok: false, code: 'source-mismatch', message: 'profile widget provenance or hash is incompatible with the accepted kernel' };
  }
  if (!isObject(profile.defaults) || !hasExactRecordKeys(profile.defaults, [], ['standardButtonHeight', 'minTextHeight'])) {
    return { ok: false, code: 'malformed-profile', message: 'profile.defaults must be an explicit object' };
  }
  let standardButtonHeight: X4UiLayoutPinnedNumber | undefined;
  if (profile.defaults.standardButtonHeight !== undefined) {
    if (!sourcePinValid(profile.defaults.standardButtonHeight, HELPER_SOURCE_PATH)
      || profile.defaults.standardButtonHeight.value !== 25
      || constants.standardButtonHeight.value !== 25
      || profile.defaults.standardButtonHeight.source.lineStart !== 522
      || profile.defaults.standardButtonHeight.source.lineEnd !== 522) {
      return { ok: false, code: 'source-mismatch', message: 'standardButtonHeight default lacks the exact pinned Helper proof' };
    }
    standardButtonHeight = cloneDeep(profile.defaults.standardButtonHeight) as X4UiLayoutPinnedNumber;
  }
  const minTextHeightCandidate = profile.defaults.minTextHeight;
  if (minTextHeightCandidate !== undefined && !isNonNegativeNumber(minTextHeightCandidate)) {
    return { ok: false, code: 'malformed-profile', message: 'profile.defaults.minTextHeight must be finite and non-negative' };
  }
  const minTextHeight: number | undefined = minTextHeightCandidate === undefined
    ? undefined
    : minTextHeightCandidate as number;
  let localExpansion: X4UiLayoutProjectionProfile['localExpansion'];
  if (profile.localExpansion !== undefined) {
    if (!isObject(profile.localExpansion)
      || !hasExactRecordKeys(profile.localExpansion, ['maxDepth', 'maxInvocations'])
      || !Number.isInteger(profile.localExpansion.maxDepth)
      || !Number.isInteger(profile.localExpansion.maxInvocations)
      || (profile.localExpansion.maxDepth as number) < 1
      || (profile.localExpansion.maxDepth as number) > 32
      || (profile.localExpansion.maxInvocations as number) < 1
      || (profile.localExpansion.maxInvocations as number) > 2048) {
      return {
        ok: false,
        code: 'malformed-profile',
        message: 'profile.localExpansion requires integer maxDepth 1..32 and maxInvocations 1..2048'
      };
    }
    localExpansion = {
      maxDepth: profile.localExpansion.maxDepth as number,
      maxInvocations: profile.localExpansion.maxInvocations as number
    };
  }
  const normalized: X4UiLayoutProjectionProfile = {
    id: profile.id,
    provenance: profile.provenance,
    truthGrade: profile.truthGrade as X4UiLayoutTruthGrade,
    source: cloneDeep(identity) as X4UiLayoutModelIdentity,
    frame: { width: profile.frame.width, height: profile.frame.height },
    metrics: {
      uiScale: profile.metrics.uiScale,
      borderSize: profile.metrics.borderSize,
      scrollbarWidth: profile.metrics.scrollbarWidth,
      standardContainerOffset: profile.metrics.standardContainerOffset,
    },
    helper: {
      sourcePath: HELPER_SOURCE_PATH,
      sha256: HELPER_SOURCE_SHA256,
      constants: constants as X4UiLayoutHelperConstants,
    },
    widget: { sourcePath: WIDGET_SOURCE_PATH, sha256: WIDGET_SOURCE_SHA256 },
    defaults: {
      ...(standardButtonHeight ? { standardButtonHeight } : {}),
      ...(minTextHeight !== undefined ? { minTextHeight } : {}),
    },
    ...(localExpansion ? { localExpansion } : {}),
  };
  return { ok: true, value: { value: freezeDeep(normalized), sourceIdentity: freezeDeep(cloneDeep(identity) as X4UiLayoutModelIdentity) } };
};

const exactTarget = (
  model: X4UiCallModel,
  selector: unknown,
): { ok: true; value: X4UiLayoutTarget } | { ok: false; message: string } => {
  if (!isObject(selector) || !['top-level', 'function', 'handler'].includes(String(selector.kind)) || !isSourceLocationShape(selector.source)) {
    return { ok: false, message: 'target selector must carry a kind and exact source range' };
  }
  const catalog = createX4UiLayoutTargetCatalog(model);
  const candidate = catalog.targets.find(target =>
    target.kind === selector.kind
    && locationsEqual(target.source, selector.source as X4UiSourceLocation)
    && (selector.name === undefined || selector.name === target.name)
    && (selector.handler === undefined || selector.handler === target.handler)
    && (selector.id === undefined || selector.id === target.id));
  return candidate ? { ok: true, value: candidate } : { ok: false, message: 'target selector does not exactly match a catalogued source context' };
};

const gapFromModel = (gap: X4UiVerificationGap): X4UiLayoutGap => ({
  category: gap.category,
  status: gap.status === 'static' ? 'unsupported' : gap.status,
  expression: gap.expression,
  reason: gap.reason,
  source: cloneLocation(gap.source),
});

const isFrameTextureSetter = (callName: X4UiRelevantCallName): boolean =>
  callName === 'setBackground' || callName === 'setBackground2' || callName === 'setOverlay';

const property = (call: X4UiCallRecord, name: string): X4UiCallPropertyProjection | undefined =>
  call.semantics.properties?.find(candidate =>
    isFrameTextureSetter(call.name)
      ? candidate.name === name
      : candidate.normalizedName === name.toLowerCase());

const optionMode = (call: X4UiCallRecord): 'omitted' | 'known' | 'unresolved' => {
  const options = call.semantics.options;
  if (!options || (options.status === 'static' && options.type === 'nil')) return 'omitted';
  if (options.status === 'static' && call.semantics.properties !== undefined) return 'known';
  return 'unresolved';
};

const propertyValue = (call: X4UiCallRecord, name: string): X4UiValue | undefined => property(call, name)?.value;

const HEADER_ROW_CENTERED_PROPERTIES_EXPRESSION = 'Helper.headerRowCenteredProperties';

const isHeaderRowCenteredProperties = (
  call: X4UiCallRecord,
  canonicalCorpus: X4UiCorpusCanonicalSuccess | undefined,
): boolean => canonicalCorpus !== undefined
  && call.name === 'createText'
  && call.semantics.options?.expression === HEADER_ROW_CENTERED_PROPERTIES_EXPRESSION;

type HeaderBundleScalar = string | number | boolean;

const synthesizedHeaderBundleProperty = (
  call: X4UiCallRecord,
  name: string,
  value: HeaderBundleScalar,
  expression: string,
): X4UiCallPropertyProjection => {
  const source = cloneLocation(call.semantics.options?.location || call.source);
  return {
    name,
    normalizedName: name.toLowerCase(),
    value: {
      status: 'static',
      type: typeof value as 'string' | 'number' | 'boolean',
      expression,
      location: cloneLocation(source),
      value,
    } as X4UiValue,
    source,
    sourceOrder: source.start.offset,
  };
};

const synthesizeHeaderBundleMetadata = (
  metadata: X4UiLayoutCallMetadata,
  call: X4UiCallRecord,
  canonicalCorpus: X4UiCorpusCanonicalSuccess | undefined,
): X4UiLayoutCallMetadata => {
  if (!isHeaderRowCenteredProperties(call, canonicalCorpus)) return metadata;
  return {
    ...metadata,
    semantics: {
      ...metadata.semantics,
      properties: [
        synthesizedHeaderBundleProperty(call, 'font', 'Zekton Bold', 'Helper.titleFont'),
        synthesizedHeaderBundleProperty(call, 'fontsize', 9, 'Helper.standardFontSize'),
        synthesizedHeaderBundleProperty(call, 'y', 2, 'Helper.headerRow1Offsety'),
        synthesizedHeaderBundleProperty(call, 'minrowheight', 20, 'Helper.headerRow1Height'),
        synthesizedHeaderBundleProperty(call, 'halign', 'center', '"center"'),
        synthesizedHeaderBundleProperty(call, 'cellbgcolor', 'container_subsection_header', 'Color["container_subsection_header"]'),
      ],
    },
  };
};

interface DerivedTextHeightCandidate {
  readonly value?: number;
  readonly expression?: string;
  readonly reason?: string;
}

const acceptsExpectedNoWrapOverflowForHeight = (layout: ZektonTextLayout): boolean => {
  const finite = (value: number): boolean => Number.isFinite(value);
  const finiteNonNegative = (value: number): boolean => finite(value) && value >= 0;
  const lineGeometryIsFinite = layout.lines.length > 0 && layout.lines.every(line => {
    const lineValues = [
      line.width,
      line.maxWidth,
      line.lineBox.x,
      line.lineBox.y,
    ];
    const nonNegativeLineValues = [
      line.lineBox.width,
      line.lineBox.height,
      line.lineBox.lineAdvance,
      line.lineBox.metrics.outer,
      line.lineBox.metrics.top,
      line.lineBox.metrics.bottom,
      line.lineBox.metrics.inner,
      line.lineBox.metrics.split20,
      line.lineBox.metrics.split24,
    ];
    const glyphGeometryIsFinite = line.glyphQuads.length > 0 && line.glyphQuads.every(glyph => [
      glyph.x,
      glyph.y,
      glyph.width,
      glyph.height,
      glyph.bitmapHeight,
      glyph.lineBoxY,
      glyph.lineBoxHeight,
      glyph.bearingX,
      glyph.bitmapWidth,
      glyph.advance,
      glyph.scaledAdvance,
      glyph.bitmapBounds.left,
      glyph.bitmapBounds.top,
      glyph.bitmapBounds.right,
      glyph.bitmapBounds.bottom,
      glyph.uv.u0,
      glyph.uv.v0,
      glyph.uv.u1,
      glyph.uv.v1,
    ].every(finite));
    return lineValues.every(finite)
      && nonNegativeLineValues.every(finiteNonNegative)
      && glyphGeometryIsFinite;
  });
  return layout.profile.wrapMode === 'no-wrap'
    && layout.overflow
    && layout.lines.every(line => line.overflow)
    && layout.gaps.length > 0
    && layout.gaps.every(gap => gap.reason === 'overflow' && gap.displayed)
    && lineGeometryIsFinite;
};

const deriveCanonicalTextHeightCandidate = (
  canonicalCorpus: X4UiCorpusCanonicalSuccess,
  fontName: string | undefined,
  text: string | undefined,
  requestedFontSize: number | undefined,
  maxWidth: number | undefined,
  wordwrap: boolean | undefined,
): DerivedTextHeightCandidate => {
  if (text === undefined) return { reason: 'text content is unavailable for the canonical Zekton height candidate' };
  const fontAssets: ZektonFontAssets | undefined = fontName === 'Zekton'
    ? canonicalCorpus.fonts.regular
    : fontName === 'Zekton Bold'
      ? canonicalCorpus.fonts.bold
      : undefined;
  if (!fontAssets) return { reason: `unsupported canonical text font ${fontName || '<missing>'}` };
  if (requestedFontSize === undefined || !Number.isSafeInteger(requestedFontSize) || requestedFontSize <= 0) {
    return { reason: 'scaled Zekton font size is unavailable for the canonical text height candidate' };
  }
  if (maxWidth === undefined || !isNonNegativeNumber(maxWidth)) {
    return { reason: 'finalized cell span width is unavailable for the canonical text height candidate' };
  }
  const layoutProfile: ZektonTextLayoutProfile = {
    descriptorIdentity: fontAssets.descriptorIdentity,
    atlasIdentity: fontAssets.atlasIdentity,
    nominalDesignSize: 32,
    requestedFontSize,
    maxWidth: Math.floor(maxWidth),
    lineSpacing: 0,
    wrapMode: wordwrap === true ? 'word-wrap' : 'no-wrap',
    truncationMode: 'none',
    whitespacePolicy: { mode: 'preserve', breakOn: 'ascii-space' },
    ellipsisPolicy: { token: '…', placement: 'end' },
    newlinePolicy: 'lf-crlf',
    fallbackPolicy: 'gap',
    truthGrade: ZEKTON_TEXT_TRUTH_GRADE,
    evidenceState: ZEKTON_EVIDENCE_STATE,
  };
  const layout = layoutZektonText(fontAssets, text, layoutProfile);
  if (layout.ok === false) return { reason: `canonical Zekton text layout was refused: ${layout.error.message}` };
  if (layout.value.gaps.length > 0 && !acceptsExpectedNoWrapOverflowForHeight(layout.value)) {
    return { reason: 'canonical Zekton text layout contains an unresolved glyph or layout gap' };
  }
  const height = layout.value.lines.reduce(
    (maximum, line) => Math.max(maximum, line.lineBox.y + line.lineBox.height),
    0,
  );
  const candidate = Math.ceil(height);
  if (!Number.isFinite(candidate) || candidate < 0) {
    return { reason: 'canonical Zekton text height candidate is outside the finite non-negative domain' };
  }
  return {
    value: candidate,
    expression: `Math.ceil(layoutZektonText(${fontName}, text, { requestedFontSize: ${requestedFontSize}, maxWidth: ${Math.floor(maxWidth)}, wrapMode: ${wordwrap === true ? 'word-wrap' : 'no-wrap'} }))`,
  };
};

interface Resolution<T> {
  readonly value?: T;
  readonly source?: X4UiSourceLocation;
  readonly provenance?: X4UiLayoutFactProvenance;
  readonly sourcePin?: X4UiLayoutSourcePin;
  readonly sampleId?: string;
  readonly gap?: {
    readonly category: X4UiLayoutGapCategory;
    readonly status: X4UiLayoutGapStatus;
    readonly reason: string;
    readonly expression?: string;
    readonly source: X4UiSourceLocation;
  };
}

interface DirectScaleValue {
  readonly value: number;
  readonly kind: 'scaleX' | 'scaleY' | 'scaleFont';
  /** Exact source range of the accepted direct Helper.scaleX/scaleY/scaleFont call. */
  readonly source: X4UiSourceLocation;
  /** Empty for the selected root, otherwise the complete caller ancestry. */
  readonly instanceScope: string;
}

const directHelperScaleResultKey = (identity: X4UiDirectHelperScaleResultIdentity): string => [
  identity.callName,
  locationKey(identity.callSource),
  identity.callExpression,
  identity.bindingName,
  locationKey(identity.bindingSource),
].join('|');

const directHelperScaleResultIsBound = (
  model: X4UiCallModel,
  value: X4UiValue,
): boolean => {
  const identity = value.directHelperScaleResult;
  if (!identity
    || value.expression.trim() !== identity.bindingName
    || identity.callSource.file !== model.file.rel
    || !sameOptionalString(identity.callSource.sourcePath, model.file.sourcePath)
    || identity.bindingSource.file !== model.file.rel
    || !sameOptionalString(identity.bindingSource.sourcePath, model.file.sourcePath)) return false;
  const call = model.calls.find(candidate => locationsEqual(candidate.source, identity.callSource));
  if (!call
    || call.name !== identity.callName
    || !isHelperReceiver(call)
    || call.semantics.dataFlow
    || model.file.text.slice(call.source.start.offset, call.source.end.offset) !== identity.callExpression) return false;
  const binding = model.aliases.find(candidate => candidate.name === identity.bindingName
    && locationsEqual(candidate.source, identity.bindingSource)
    && candidate.value.directHelperScaleResult !== undefined
    && directHelperScaleResultKey(candidate.value.directHelperScaleResult) === directHelperScaleResultKey(identity));
  if (!binding || !locationsEqual(call.context.source, binding.context.source)) return false;
  if (identity.bindingSource.start.offset > identity.callSource.start.offset
    || identity.callSource.end.offset > value.location.start.offset
    || identity.bindingSource.start.offset > value.location.start.offset) return false;
  return !model.aliases.some(candidate => candidate !== binding
    && candidate.name === identity.bindingName
    && locationsEqual(candidate.context.source, binding.context.source)
    && candidate.source.start.offset > binding.source.start.offset
    && candidate.source.start.offset < value.location.start.offset
    && candidate.context.reachability !== 'unreachable');
};

const scopedLocationKey = (source: X4UiSourceLocation, instanceScope = ''): string =>
  `${instanceScope}|${locationKey(source)}`;

const directScaleForValue = (
  values: ReadonlyMap<string, DirectScaleValue> | undefined,
  value: X4UiValue | undefined,
  instanceScope: string,
  model: X4UiCallModel | undefined,
): DirectScaleValue | undefined => {
  const identity = value?.directHelperScaleResult;
  if (identity && (!model || !directHelperScaleResultIsBound(model, value))) return undefined;
  const source = identity?.callSource || value?.location;
  if (!source) return undefined;
  const exact = values?.get(scopedLocationKey(source, instanceScope));
  if (exact && (!identity || exact.kind === identity.callName)) return exact;
  if (exact) return undefined;
  if (!values) return undefined;
  return [...values.values()]
    .filter(candidate => locationsEqual(candidate.source, source)
      && (!identity || candidate.kind === identity.callName)
      && (candidate.instanceScope.length === 0
        || instanceScope.startsWith(`${candidate.instanceScope}>`)))
    .sort((left, right) => right.instanceScope.length - left.instanceScope.length)[0];
};

const localScaleFontWrapperForValue = (
  values: ReadonlyMap<string, DirectScaleValue> | undefined,
  value: X4UiValue | undefined,
  model: X4UiCallModel | undefined,
): DirectScaleValue | undefined => {
  const localResult = value?.localInvocationResult;
  if (!values || !model || !localResult) return undefined;
  const invocation = model.localInvocations.find(candidate => candidate.id === localResult.invocationId);
  if (!invocation
    || !sourceLocationMatchesModel(model, invocation.source, model.file.text.slice(
      invocation.source.start.offset,
      invocation.source.end.offset,
    ))
    || !locationsEqual(invocation.source, localResult.source)
    || !sourceLocationMatchesModel(model, value.location, localResult.expression)
    || !locationsEqual(value.location, localResult.source)) return undefined;
  const exact = values.get(invocation.id);
  return exact?.kind === 'scaleFont' ? exact : undefined;
};

const NUMERIC_LITERAL_EXPRESSION = /^(?:0[xX][0-9A-Fa-f]+|(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)$/;
const NUMERIC_EXPRESSION_OPERATORS = ['+', '-', '*', '/'] as const;

const sourcePositionAtOffset = (
  text: string,
  offset: number,
): { readonly line: number; readonly column: number } => {
  const lastNewline = text.lastIndexOf('\n', offset - 1);
  let line = 1;
  for (let index = 0; index < offset; index += 1) {
    if (text[index] === '\n') line += 1;
  }
  return { line, column: offset - (lastNewline + 1) };
};

const sourceLocationMatchesModel = (
  model: X4UiCallModel,
  source: unknown,
  expression: unknown,
): source is X4UiSourceLocation => {
  if (!isSourceLocationShape(source) || typeof expression !== 'string'
    || source.file !== model.file.rel
    || !sameOptionalString(source.sourcePath, model.file.sourcePath)
    || !Number.isSafeInteger(source.start.offset)
    || !Number.isSafeInteger(source.end.offset)
    || source.start.offset < 0
    || source.end.offset <= source.start.offset
    || source.end.offset > model.file.text.length
    || model.file.text.slice(source.start.offset, source.end.offset) !== expression) return false;
  const start = sourcePositionAtOffset(model.file.text, source.start.offset);
  const end = sourcePositionAtOffset(model.file.text, source.end.offset);
  return source.start.line === start.line
    && source.start.column === start.column
    && source.end.line === end.line
    && source.end.column === end.column;
};

type HelperReceiverAliasFact = X4UiCallModel['helperReceiverAliases'][number];

const modelSourceLocationIsExact = (
  model: X4UiCallModel,
  source: unknown,
): source is X4UiSourceLocation => {
  if (!isSourceLocationShape(source)
    || !Number.isSafeInteger(source.start.offset)
    || !Number.isSafeInteger(source.end.offset)
    || source.start.offset < 0
    || source.end.offset <= source.start.offset
    || source.end.offset > model.file.text.length) return false;
  return sourceLocationMatchesModel(
    model,
    source,
    model.file.text.slice(source.start.offset, source.end.offset),
  );
};

const activeHelperReceiverAliasAuthority = (
  model: X4UiCallModel,
  name: string,
  useLocation: X4UiSourceLocation,
  aliasSource?: X4UiSourceLocation,
): HelperReceiverAliasFact | undefined => {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)
    || !modelSourceLocationIsExact(model, useLocation)
    || (aliasSource !== undefined && !modelSourceLocationIsExact(model, aliasSource))) return undefined;
  const facts = model.helperReceiverAliases
    .filter(alias => alias.name === name
      && alias.targetSource.start.offset <= useLocation.start.offset
      && locationContains(alias.context.source, useLocation))
    .sort((left, right) => left.targetSource.start.offset - right.targetSource.start.offset);
  const latest = facts[facts.length - 1];
  if (!latest
    || (latest.status !== 'bound' && latest.status !== 'preserved')
    || !latest.callSource
    || !sourceLocationMatchesModel(model, latest.targetSource, name)
    || !modelSourceLocationIsExact(model, latest.callSource)) return undefined;
  if (aliasSource !== undefined && !facts.some(alias =>
    (alias.status === 'bound' || alias.status === 'preserved')
      && alias.callSource
      && locationsEqual(alias.callSource, aliasSource))) return undefined;
  return latest;
};

const numericExpressionReceiverError = (
  value: unknown,
  model: X4UiCallModel,
): string | undefined => {
  if (!isObject(value)
    || Object.getPrototypeOf(value) !== Object.prototype
    || !hasExactRecordKeys(value, ['name', 'origin', 'source'], ['aliasSource'])
    || !hasOnlyJsonDataProperties(value)) return 'numeric Helper receiver is malformed';
  if (typeof value.name !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(value.name)) {
    return 'numeric Helper receiver name is invalid';
  }
  if (value.origin !== 'global' && value.origin !== 'alias') return 'numeric Helper receiver origin is invalid';
  if (!sourceLocationMatchesModel(model, value.source, value.name)) return 'numeric Helper receiver source does not match the model';
  if (value.origin === 'global') {
    if (value.name !== 'Helper' || value.aliasSource !== undefined) return 'global numeric Helper receiver identity is invalid';
    const shadowed = model.helperReceiverAliases.some(alias => alias.name === value.name
      && alias.targetSource.start.offset <= (value.source as X4UiSourceLocation).start.offset
      && locationContains(alias.context.source, value.source as X4UiSourceLocation));
    return shadowed ? 'global numeric Helper receiver is shadowed by a lexical alias' : undefined;
  }
  if (!modelSourceLocationIsExact(model, value.aliasSource)) return 'aliased numeric Helper receiver source is malformed';
  const receiverSource = value.source as X4UiSourceLocation;
  if (!activeHelperReceiverAliasAuthority(
    model,
    value.name,
    receiverSource,
    value.aliasSource,
  )) {
    return 'aliased numeric Helper receiver is not an active bound or preserved rawget identity';
  }
  return undefined;
};

interface NumericExpressionSourceAstNode {
  readonly type?: unknown;
  readonly range?: unknown;
  readonly operator?: unknown;
  readonly name?: unknown;
  readonly raw?: unknown;
  readonly value?: unknown;
  readonly indexer?: unknown;
  readonly base?: unknown;
  readonly identifier?: unknown;
  readonly argument?: unknown;
  readonly expression?: unknown;
  readonly left?: unknown;
  readonly right?: unknown;
  readonly [key: string]: unknown;
}

interface NumericExpressionSourceAstIndex {
  readonly sourceText: string;
  readonly nodesByRange: ReadonlyMap<string, readonly NumericExpressionSourceAstNode[]>;
  readonly error?: string;
}

const numericExpressionSourceAstCache = new WeakMap<X4UiCallModel, NumericExpressionSourceAstIndex>();

const sourceAstRange = (node: NumericExpressionSourceAstNode): readonly [number, number] | undefined => {
  if (!Array.isArray(node.range)
    || node.range.length !== 2
    || !Number.isSafeInteger(node.range[0])
    || !Number.isSafeInteger(node.range[1])
    || node.range[0] < 0
    || node.range[1] < node.range[0]) return undefined;
  return [node.range[0], node.range[1]];
};

const sourceAstRangeKey = (start: number, end: number): string => `${start}:${end}`;

const numericExpressionSourceAstIndex = (model: X4UiCallModel): NumericExpressionSourceAstIndex => {
  const cached = numericExpressionSourceAstCache.get(model);
  if (cached?.sourceText === model.file.text) return cached;
  try {
    const ast = parse(model.file.text, {
      comments: false,
      locations: true,
      ranges: true,
      scope: true,
      luaVersion: '5.2',
    }) as unknown as NumericExpressionSourceAstNode;
    const mutableNodes = new Map<string, NumericExpressionSourceAstNode[]>();
    const seen = new Set<object>();
    const visit = (value: unknown): void => {
      if (Array.isArray(value)) {
        value.forEach(visit);
        return;
      }
      if (!isObject(value) || seen.has(value)) return;
      seen.add(value);
      const node = value as NumericExpressionSourceAstNode;
      const range = sourceAstRange(node);
      if (typeof node.type === 'string' && range) {
        const key = sourceAstRangeKey(range[0], range[1]);
        const nodes = mutableNodes.get(key) || [];
        nodes.push(node);
        mutableNodes.set(key, nodes);
      }
      for (const [key, child] of Object.entries(value)) {
        if (key !== 'loc' && key !== 'range') visit(child);
      }
    };
    visit(ast);
    const index: NumericExpressionSourceAstIndex = {
      sourceText: model.file.text,
      nodesByRange: new Map([...mutableNodes].map(([key, nodes]) => [key, Object.freeze([...nodes])])),
    };
    numericExpressionSourceAstCache.set(model, index);
    return index;
  } catch {
    const index: NumericExpressionSourceAstIndex = {
      sourceText: model.file.text,
      nodesByRange: new Map(),
      error: 'numeric expression source could not be parsed for structural validation',
    };
    numericExpressionSourceAstCache.set(model, index);
    return index;
  }
};

const numericExpressionStructureError = (
  descriptor: X4UiNumericExpression,
  model: X4UiCallModel,
): string | undefined => {
  const index = numericExpressionSourceAstIndex(model);
  if (index.error) return index.error;
  const nodeMatches = (candidate: X4UiNumericExpression, nodeValue: unknown): boolean => {
    if (!isObject(nodeValue)) return false;
    const node = nodeValue as NumericExpressionSourceAstNode;
    const range = sourceAstRange(node);
    if (!range
      || range[0] !== candidate.source.start.offset
      || range[1] !== candidate.source.end.offset) return false;
    switch (candidate.kind) {
      case 'literal':
        return node.type === 'NumericLiteral' && node.value === candidate.value;
      case 'helper-constant': {
        if (node.type !== 'MemberExpression' || node.indexer !== '.'
          || !isObject(node.base) || !isObject(node.identifier)) return false;
        const base = node.base as NumericExpressionSourceAstNode;
        const identifier = node.identifier as NumericExpressionSourceAstNode;
        const baseRange = sourceAstRange(base);
        return base.type === 'Identifier'
          && base.name === candidate.receiver.name
          && identifier.type === 'Identifier'
          && identifier.name === candidate.name
          && baseRange?.[0] === candidate.receiver.source.start.offset
          && baseRange[1] === candidate.receiver.source.end.offset;
      }
      case 'direct-helper-scale':
        return node.type === 'Identifier' && node.name === candidate.identity.bindingName;
      case 'group':
        return node.type === 'ParenthesizedExpression'
          && nodeMatches(candidate.operand, node.expression || node.argument);
      case 'unary':
        return node.type === 'UnaryExpression'
          && node.operator === candidate.operator
          && nodeMatches(candidate.operand, node.argument);
      case 'binary':
        return node.type === 'BinaryExpression'
          && node.operator === candidate.operator
          && nodeMatches(candidate.left, node.left)
          && nodeMatches(candidate.right, node.right);
      case 'or':
        return node.type === 'LogicalExpression'
          && node.operator === 'or'
          && nodeMatches(candidate.left, node.left)
          && nodeMatches(candidate.right, node.right);
    }
  };
  const rootNodes = index.nodesByRange.get(sourceAstRangeKey(
    descriptor.source.start.offset,
    descriptor.source.end.offset,
  )) || [];
  return rootNodes.some(node => nodeMatches(descriptor, node))
    ? undefined
    : 'numeric expression structure does not match the exact source AST';
};

const numericExpressionError = (
  descriptor: unknown,
  value: X4UiValue,
  model: X4UiCallModel,
): string | undefined => {
  try {
    if (!isObject(descriptor)
      || Object.getPrototypeOf(descriptor) !== Object.prototype
      || !hasOnlyJsonDataProperties(descriptor)) return 'numeric expression descriptor is malformed';
    const active = new Set<object>();
    const visit = (candidate: unknown): string | undefined => {
      if (!isObject(candidate)
        || Object.getPrototypeOf(candidate) !== Object.prototype
        || !hasOnlyJsonDataProperties(candidate)
        || active.has(candidate)) return 'numeric expression node is malformed or cyclic';
      active.add(candidate);
      const finish = (error?: string): string | undefined => {
        active.delete(candidate);
        return error;
      };
      if (typeof candidate.kind !== 'string'
        || typeof candidate.expression !== 'string'
        || !sourceLocationMatchesModel(model, candidate.source, candidate.expression)) {
        return finish('numeric expression node source does not match the model');
      }
      const source = candidate.source as X4UiSourceLocation;
      switch (candidate.kind) {
        case 'literal': {
          if (!hasExactRecordKeys(candidate, ['kind', 'value', 'expression', 'source'])
            || !isFiniteNumber(candidate.value)
            || !NUMERIC_LITERAL_EXPRESSION.test(candidate.expression.trim())
            || Number(candidate.expression.trim()) !== candidate.value) {
            return finish('numeric literal descriptor is malformed');
          }
          return finish();
        }
        case 'helper-constant': {
          if (!hasExactRecordKeys(candidate, ['kind', 'name', 'receiver', 'expression', 'source'])
            || !HELPER_CONSTANT_NAMES.includes(candidate.name as X4UiLayoutHelperConstantName)) {
            return finish('numeric Helper constant descriptor is malformed');
          }
          const receiverError = numericExpressionReceiverError(candidate.receiver, model);
          if (receiverError) return finish(receiverError);
          const receiver = candidate.receiver as Record<string, unknown>;
          const receiverSource = receiver.source as X4UiSourceLocation;
          if (!locationContains(source, receiverSource)) return finish('numeric Helper receiver range escapes its member expression');
          return finish();
        }
        case 'direct-helper-scale': {
          if (!hasExactRecordKeys(candidate, ['kind', 'identity', 'expression', 'source'])
            || !isObject(candidate.identity)
            || Object.getPrototypeOf(candidate.identity) !== Object.prototype
            || !hasExactRecordKeys(candidate.identity, ['callName', 'callSource', 'callExpression', 'bindingName', 'bindingSource'])
            || (candidate.identity.callName !== 'scaleX' && candidate.identity.callName !== 'scaleY')
            || typeof candidate.identity.callExpression !== 'string'
            || typeof candidate.identity.bindingName !== 'string'
            || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(candidate.identity.bindingName)
            || !sourceLocationMatchesModel(model, candidate.identity.callSource, candidate.identity.callExpression)
            || !sourceLocationMatchesModel(model, candidate.identity.bindingSource, candidate.identity.bindingName)) {
            return finish('direct numeric scale identity is malformed');
          }
          const identity = candidate.identity as unknown as X4UiDirectHelperScaleResultIdentity;
          const syntheticValue: X4UiValue = {
            status: 'dynamic',
            type: 'expression',
            expression: candidate.expression,
            location: source,
            directHelperScaleResult: identity,
          };
          if (!directHelperScaleResultIsBound(model, syntheticValue)) {
            return finish('direct numeric scale identity is not bound to the source model');
          }
          return finish();
        }
        case 'group': {
          if (!hasExactRecordKeys(candidate, ['kind', 'operand', 'expression', 'source'])) return finish('numeric group descriptor is malformed');
          const error = visit(candidate.operand);
          if (error) return finish(error);
          if (!isObject(candidate.operand) || !locationContains(source, candidate.operand.source as X4UiSourceLocation)) {
            return finish('numeric group operand escapes its source range');
          }
          return finish();
        }
        case 'unary': {
          if (!hasExactRecordKeys(candidate, ['kind', 'operator', 'operand', 'expression', 'source'])
            || (candidate.operator !== '+' && candidate.operator !== '-')) return finish('numeric unary descriptor is malformed');
          const error = visit(candidate.operand);
          if (error) return finish(error);
          if (!isObject(candidate.operand) || !locationContains(source, candidate.operand.source as X4UiSourceLocation)) {
            return finish('numeric unary operand escapes its source range');
          }
          return finish();
        }
        case 'binary': {
          if (!hasExactRecordKeys(candidate, ['kind', 'operator', 'left', 'right', 'expression', 'source'])
            || !NUMERIC_EXPRESSION_OPERATORS.includes(candidate.operator as typeof NUMERIC_EXPRESSION_OPERATORS[number])) {
            return finish('numeric binary descriptor is malformed');
          }
          const leftError = visit(candidate.left);
          if (leftError) return finish(leftError);
          const rightError = visit(candidate.right);
          if (rightError) return finish(rightError);
          if (!isObject(candidate.left) || !isObject(candidate.right)
            || !locationContains(source, candidate.left.source as X4UiSourceLocation)
            || !locationContains(source, candidate.right.source as X4UiSourceLocation)
            || (candidate.left.source as X4UiSourceLocation).start.offset > (candidate.right.source as X4UiSourceLocation).start.offset) {
            return finish('numeric binary operands escape or reorder the source range');
          }
          return finish();
        }
        case 'or': {
          if (!hasExactRecordKeys(candidate, ['kind', 'left', 'right', 'expression', 'source'])) return finish('numeric or descriptor is malformed');
          const leftError = visit(candidate.left);
          if (leftError) return finish(leftError);
          const rightError = visit(candidate.right);
          if (rightError) return finish(rightError);
          if (!isObject(candidate.left) || !isObject(candidate.right)
            || !locationContains(source, candidate.left.source as X4UiSourceLocation)
            || !locationContains(source, candidate.right.source as X4UiSourceLocation)) {
            return finish('numeric or operands escape the source range');
          }
          return finish();
        }
        default:
          return finish('numeric expression operator or node kind is unsupported');
      }
    };
    const rootError = visit(descriptor);
    if (rootError) return rootError;
    const structureError = numericExpressionStructureError(descriptor as X4UiNumericExpression, model);
    if (structureError) return structureError;
    const root = descriptor as Record<string, unknown>;
    if (root.expression === value.expression && locationsEqual(root.source as X4UiSourceLocation, value.location)) return undefined;
    const aliasName = value.expression.trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(aliasName)) return 'numeric expression root is not bound to the value use';
    const propertyContext = model.properties.find(candidate => locationsEqual(candidate.value.location, value.location))?.context.source;
    const bindings = model.aliases
      .filter(candidate => candidate.name === aliasName
        && candidate.value.numericExpression !== undefined
        && jsonEqual(candidate.value.numericExpression, descriptor)
        && candidate.value.expression === root.expression
        && locationsEqual(candidate.value.location, root.source as X4UiSourceLocation)
        && candidate.source.end.offset <= value.location.start.offset
        && (!propertyContext || locationsEqual(candidate.context.source, propertyContext)))
      .sort((left, right) => left.source.start.offset - right.source.start.offset);
    const binding = bindings[bindings.length - 1];
    if (!binding) return 'numeric expression root has no exact source binding';
    if (model.aliases.some(candidate => candidate !== binding
      && candidate.name === aliasName
      && locationsEqual(candidate.context.source, binding.context.source)
      && candidate.source.start.offset > binding.source.start.offset
      && candidate.source.start.offset < value.location.start.offset
      && candidate.context.reachability !== 'unreachable')) {
      return 'numeric expression binding was reassigned before use';
    }
    return undefined;
  } catch {
    return 'numeric expression descriptor could not be safely inspected';
  }
};

const unresolved = <T>(
  value: X4UiValue | undefined,
  category: X4UiLayoutGapCategory,
  reason: string,
  fallbackSource: X4UiSourceLocation,
): Resolution<T> => ({
  gap: {
    category,
    status: valueStatus(value),
    reason,
    ...(value?.localInvocationResult?.expression || value?.expression
      ? { expression: value?.localInvocationResult?.expression || value?.expression }
      : {}),
    source: cloneLocation(value?.localInvocationResult?.source || value?.location || fallbackSource),
  },
});

const sampleSourceForValue = (value: X4UiValue): X4UiSourceLocation =>
  value.directHelperScaleResult?.callSource || value.localInvocationResult?.source || value.location;

const evidenceExpressionForValue = (value: X4UiValue | undefined): string | undefined =>
  value?.numericExpression?.expression || value?.localInvocationResult?.expression || value?.expression;

const resolveNumericExpression = (
  value: X4UiValue,
  descriptor: X4UiNumericExpression,
  profile: X4UiLayoutProjectionProfile,
  category: X4UiLayoutGapCategory,
  label: string,
  fallbackSource: X4UiSourceLocation,
  directScaleValues: ReadonlyMap<string, DirectScaleValue> | undefined,
  allowedScaleKinds: readonly DirectScaleValue['kind'][],
  instanceScope: string,
  model: X4UiCallModel,
): Resolution<number> => {
  const expressionGap = (expression: X4UiNumericExpression, reason: string): Resolution<number> => ({
    gap: {
      category,
      status: 'unsupported',
      expression: expression.expression,
      reason,
      source: cloneLocation(expression.source || fallbackSource),
    },
  });
  const evaluate = (expression: X4UiNumericExpression): Resolution<number> => {
    switch (expression.kind) {
      case 'literal':
        return { value: expression.value, source: cloneLocation(expression.source), provenance: 'source-literal' };
      case 'helper-constant':
        return {
          value: profile.helper.constants[expression.name].value,
          source: cloneLocation(expression.source),
          provenance: 'source-pinned-default',
          sourcePin: cloneDeep(profile.helper.constants[expression.name].source) as X4UiLayoutSourcePin,
        };
      case 'direct-helper-scale': {
        const syntheticValue: X4UiValue = {
          status: 'dynamic',
          type: 'expression',
          expression: expression.expression,
          location: cloneLocation(expression.source),
          directHelperScaleResult: expression.identity,
        };
        const directScale = directScaleForValue(directScaleValues, syntheticValue, instanceScope, model);
        if (!directScale || !allowedScaleKinds.includes(directScale.kind)) {
          return expressionGap(expression, `${label} uses an unavailable or disallowed direct Helper scale result`);
        }
        return { value: directScale.value, source: cloneLocation(directScale.source), provenance: 'direct-helper-scale' };
      }
      case 'group': {
        const operand = evaluate(expression.operand);
        if (operand.gap || operand.value === undefined) return expressionGap(expression, `${label} contains an unavailable grouped number`);
        return { value: operand.value, source: cloneLocation(expression.source), provenance: 'source-literal' };
      }
      case 'unary': {
        const operand = evaluate(expression.operand);
        if (operand.gap || operand.value === undefined) return expressionGap(expression, `${label} contains an unavailable unary number`);
        const result = expression.operator === '-' ? -operand.value : operand.value;
        return Number.isFinite(result)
          ? { value: result, source: cloneLocation(expression.source), provenance: 'source-literal' }
          : expressionGap(expression, `${label} unary result is not finite`);
      }
      case 'binary': {
        const left = evaluate(expression.left);
        const right = evaluate(expression.right);
        if (left.gap || right.gap || left.value === undefined || right.value === undefined) {
          return expressionGap(expression, `${label} contains an unavailable arithmetic operand`);
        }
        if (expression.operator === '/' && right.value === 0) {
          return expressionGap(expression, `${label} divides by zero`);
        }
        const result = expression.operator === '+' ? left.value + right.value
          : expression.operator === '-' ? left.value - right.value
            : expression.operator === '*' ? left.value * right.value
              : left.value / right.value;
        return Number.isFinite(result)
          ? { value: result, source: cloneLocation(expression.source), provenance: 'source-literal' }
          : expressionGap(expression, `${label} arithmetic result is not finite`);
      }
      case 'or': {
        const left = evaluate(expression.left);
        if (left.gap || left.value === undefined) return expressionGap(expression, `${label} has an unavailable Lua or condition`);
        // A finite Lua number, including zero, is truthy.  The right branch is
        // retained for provenance but is not evaluated when the left wins.
        return { value: left.value, source: cloneLocation(expression.source), provenance: 'source-literal' };
      }
      default:
        return expressionGap(expression, `${label} contains an unsupported numeric expression node`);
    }
  };
  return evaluate(descriptor);
};

const resolveNumber = (
  value: X4UiValue | undefined,
  profile: X4UiLayoutProjectionProfile,
  category: X4UiLayoutGapCategory,
  label: string,
  fallbackSource: X4UiSourceLocation,
  directScaleValues?: ReadonlyMap<string, DirectScaleValue>,
  previewSamples?: ReadonlyMap<string, ResolvedPreviewSample>,
  consumedSamples?: Set<string>,
  allowedScaleKinds: readonly DirectScaleValue['kind'][] = ['scaleX', 'scaleY'],
  instanceScope = '',
  model?: X4UiCallModel,
  localScaleFontWrapperValues?: ReadonlyMap<string, DirectScaleValue>,
): Resolution<number> => {
  if (value?.numericExpression !== undefined) {
    if (!model) {
      return unresolved(value, category, `${label} numeric expression has no source model`, fallbackSource);
    }
    const descriptorError = numericExpressionError(value.numericExpression, value, model);
    if (descriptorError) {
      return {
        gap: {
          category,
          status: 'unsupported',
          expression: value.numericExpression.expression,
          reason: `${label} numeric expression rejected: ${descriptorError}`,
          source: cloneLocation(value.numericExpression.source),
        },
      };
    }
    return resolveNumericExpression(
      value,
      value.numericExpression,
      profile,
      category,
      label,
      fallbackSource,
      directScaleValues,
      allowedScaleKinds,
      instanceScope,
      model,
    );
  }
  if (value?.status === 'static' && value.type === 'number' && isFiniteNumber(value.value)) {
    return { value: value.value, source: cloneLocation(value.location), provenance: 'source-literal' };
  }
  const directScale = directScaleForValue(directScaleValues, value, instanceScope, model);
  if (directScale && allowedScaleKinds.includes(directScale.kind)) {
    return { value: directScale.value, source: cloneLocation(directScale.source), provenance: 'direct-helper-scale' };
  }
  const localScaleFontWrapper = localScaleFontWrapperForValue(localScaleFontWrapperValues, value, model);
  if (localScaleFontWrapper && allowedScaleKinds.includes('scaleFont')) {
    return {
      value: localScaleFontWrapper.value,
      source: cloneLocation(localScaleFontWrapper.source),
      provenance: 'direct-helper-scale',
    };
  }
  if (value?.localInvocationResult && allowedScaleKinds.includes('scaleFont')) {
    return unresolved(value, category, `${label} requires an exact source-proven local Helper.scaleFont wrapper`, fallbackSource);
  }
  if (value?.status === 'unknown' && (value.symbol?.startsWith('Helper.') || /^Helper\.[A-Za-z_][A-Za-z0-9_]*$/.test(value.expression))) {
    const symbol = value.symbol || value.expression;
    const name = symbol.slice('Helper.'.length) as X4UiLayoutHelperConstantName;
    if (HELPER_CONSTANT_NAMES.includes(name)) {
      return {
        value: profile.helper.constants[name].value,
        source: cloneLocation(value.location),
        provenance: 'source-pinned-default',
        sourcePin: cloneDeep(profile.helper.constants[name].source) as X4UiLayoutSourcePin,
      };
    }
    return unresolved(value, 'constant', `${label} uses an unknown Helper constant`, fallbackSource);
  }
  const sample = value ? previewSamples?.get(rangeAndTypeKey(sampleSourceForValue(value), 'number')) : undefined;
  if (sample && typeof sample.value === 'number') {
    consumedSamples?.add(sample.entry.id);
    return {
      value: sample.value,
      source: cloneLocation(sample.entry.source),
      provenance: 'preview-sample',
      sampleId: sample.entry.id,
    };
  }
  return unresolved(value, category, `${label} is not a complete static number`, fallbackSource);
};

const resolveBoolean = (
  value: X4UiValue | undefined,
  category: X4UiLayoutGapCategory,
  label: string,
  fallbackSource: X4UiSourceLocation,
  previewSamples?: ReadonlyMap<string, ResolvedPreviewSample>,
  consumedSamples?: Set<string>,
): Resolution<boolean> =>
  value?.status === 'static' && value.type === 'boolean' && typeof value.value === 'boolean'
    ? { value: value.value, source: cloneLocation(value.location), provenance: 'source-literal' }
    : (() => {
      const sample = value ? previewSamples?.get(rangeAndTypeKey(sampleSourceForValue(value), 'boolean')) : undefined;
      if (sample && typeof sample.value === 'boolean') {
        consumedSamples?.add(sample.entry.id);
        return {
          value: sample.value,
          source: cloneLocation(sample.entry.source),
          provenance: 'preview-sample' as const,
          sampleId: sample.entry.id,
        };
      }
      return unresolved(value, category, `${label} is not a complete static boolean`, fallbackSource);
    })();

const resolveLuaTruthiness = (
  value: X4UiValue | undefined,
  category: X4UiLayoutGapCategory,
  label: string,
  fallbackSource: X4UiSourceLocation,
): Resolution<boolean> => {
  if (!value) {
    return {
      value: false,
      source: cloneLocation(fallbackSource),
      provenance: 'source-pinned-default',
      sourcePin: HELPER_DEFAULT_PINS.rowSelectable,
    };
  }
  if (value.status !== 'static') {
    return unresolved(value, category, `${label} is not a complete static Lua value`, fallbackSource);
  }
  if (value.type === 'nil') {
    return {
      value: false,
      source: cloneLocation(value.location),
      provenance: 'source-literal',
      sourcePin: HELPER_DEFAULT_PINS.rowSelectable,
    };
  }
  if (value.type === 'boolean') {
    return {
      value: value.value === true,
      source: cloneLocation(value.location),
      provenance: 'source-literal',
      sourcePin: HELPER_DEFAULT_PINS.rowSelectable,
    };
  }
  return {
    value: true,
    source: cloneLocation(value.location),
    provenance: 'source-literal',
    sourcePin: HELPER_DEFAULT_PINS.rowSelectable,
  };
};

const resolveString = (
  value: X4UiValue | undefined,
  category: X4UiLayoutGapCategory,
  label: string,
  fallbackSource: X4UiSourceLocation,
  previewSamples?: ReadonlyMap<string, ResolvedPreviewSample>,
  consumedSamples?: Set<string>,
): Resolution<string> =>
  value?.status === 'static' && value.type === 'string' && typeof value.value === 'string'
    ? { value: value.value, source: cloneLocation(value.location), provenance: 'source-literal' }
    : (() => {
      const sample = value ? previewSamples?.get(rangeAndTypeKey(sampleSourceForValue(value), 'string')) : undefined;
      if (sample && typeof sample.value === 'string') {
        consumedSamples?.add(sample.entry.id);
        return {
          value: sample.value,
          source: cloneLocation(sample.entry.source),
          provenance: 'preview-sample' as const,
          sampleId: sample.entry.id,
        };
      }
      return unresolved(value, category, `${label} is not a complete static string`, fallbackSource);
    })();

const knownDefaultFact = (
  value: X4UiLayoutScalar,
  expectedType: X4UiLayoutScalarType,
  source: X4UiSourceLocation,
  sourcePin: X4UiLayoutSourcePin,
  expression: string,
): X4UiLayoutDescriptorFact => ({
  status: 'known',
  expectedType,
  value,
  provenance: 'source-pinned-default',
  expression,
  source: cloneLocation(source),
  sourcePin: cloneDeep(sourcePin) as X4UiLayoutSourcePin,
});

const knownSourceFact = (
  value: X4UiLayoutScalar,
  expectedType: X4UiLayoutScalarType,
  source: X4UiSourceLocation,
  expression: string,
  provenance: X4UiLayoutFactProvenance = 'source-literal',
  sampleId?: string,
): X4UiLayoutDescriptorFact => ({
  status: 'known',
  expectedType,
  value,
  provenance,
  expression,
  source: cloneLocation(source),
  ...(sampleId ? { sampleId } : {}),
});

const factFromResolution = <T extends X4UiLayoutScalar>(
  value: X4UiValue | undefined,
  resolution: Resolution<T>,
  expectedType: X4UiLayoutScalarType,
  fallbackSource: X4UiSourceLocation,
  reason: string,
): X4UiLayoutDescriptorFact => {
  if (resolution.value !== undefined && resolution.source && resolution.provenance) {
    return {
      status: 'known',
      expectedType,
      value: resolution.value,
      provenance: resolution.provenance,
      expression: evidenceExpressionForValue(value) || reason,
      source: cloneLocation(resolution.source),
      ...(resolution.sourcePin ? { sourcePin: cloneDeep(resolution.sourcePin) as X4UiLayoutSourcePin } : {}),
      ...(resolution.sampleId ? { sampleId: resolution.sampleId } : {}),
    };
  }
  return {
    status: 'unavailable',
    expectedType,
    reason: resolution.gap?.reason || reason,
    ...(evidenceExpressionForValue(value) ? { expression: evidenceExpressionForValue(value) } : {}),
    source: cloneLocation(resolution.gap?.source || value?.localInvocationResult?.source || value?.location || fallbackSource),
  };
};

const unavailableFact = (
  expectedType: X4UiLayoutScalarType | 'color-object',
  reason: string,
  source: X4UiSourceLocation,
  expression?: string,
  sourcePin?: X4UiLayoutSourcePin,
): X4UiLayoutDescriptorFact => ({
  status: 'unavailable',
  expectedType,
  reason,
  ...(expression ? { expression } : {}),
  source: cloneLocation(source),
  ...(sourcePin ? { sourcePin: cloneDeep(sourcePin) as X4UiLayoutSourcePin } : {}),
});

interface ColorFactResolution {
  readonly fact: X4UiLayoutDescriptorFact;
  readonly gap?: {
    readonly category: X4UiLayoutGapCategory;
    readonly status: X4UiLayoutGapStatus;
    readonly reason: string;
    readonly expression?: string;
    readonly source: X4UiSourceLocation;
  };
}

const normalizeColorPropertyName = (name: string): string => name.replace(/[-_\s]/g, '').toLowerCase();

const knownColorFact = (
  value: X4UiLayoutColorValue,
  provenance: X4UiLayoutColorFactProvenance,
  expression: string,
  source: X4UiSourceLocation,
  sourcePin?: X4UiLayoutSourcePin,
): X4UiLayoutDescriptorFact => ({
  status: 'known',
  expectedType: 'color-object',
  value: cloneDeep(value) as X4UiLayoutColorValue,
  provenance,
  expression,
  source: cloneLocation(source),
  ...(sourcePin ? { sourcePin: cloneDeep(sourcePin) as X4UiLayoutSourcePin } : {}),
});

const colorFactGap = (
  fact: X4UiLayoutDescriptorFact,
  reason: string,
  source: X4UiSourceLocation,
  expression: string | undefined,
  category: X4UiLayoutGapCategory,
  status: X4UiLayoutGapStatus = 'unsupported',
): ColorFactResolution => ({
  fact,
  gap: {
    category,
    status,
    reason,
    ...(expression ? { expression } : {}),
    source: cloneLocation(source),
  },
});

const unavailableColorFact = (
  reason: string,
  source: X4UiSourceLocation,
  expression: string | undefined,
  category: X4UiLayoutGapCategory,
  sourcePin?: X4UiLayoutSourcePin,
): ColorFactResolution => colorFactGap(
  unavailableFact('color-object', reason, source, expression, sourcePin),
  reason,
  source,
  expression,
  category,
);

const colorFieldValueIsValid = (
  field: { readonly value: number },
  minimum: number,
  maximum: number,
): boolean => isFiniteNumber(field.value) && field.value >= minimum && field.value <= maximum;

const colorSourceField = (field: {
  readonly value: number;
  readonly expression: string;
  readonly source: X4UiSourceLocation;
  readonly keySource: X4UiSourceLocation;
}): X4UiLayoutColorLiteralField => ({
  value: field.value,
  expression: field.expression,
  source: cloneLocation(field.source),
  keySource: cloneLocation(field.keySource),
});

const sourceLiteralColorValueSemanticError = (
  value: X4UiLayoutSourceLiteralColorValue,
): string | undefined => {
  if (value.kind !== 'color' || value.domain !== 'source-literal-percent-alpha'
    || value.gameVerification !== X4_UI_LAYOUT_GAME_TRUTH
    || typeof value.declarationExpression !== 'string' || value.declarationExpression.length === 0
    || !isSourceLocationShape(value.declarationSource)) {
    return 'source literal color identity or declaration provenance is malformed';
  }
  const fields: ReadonlyArray<readonly [
    'r' | 'g' | 'b' | 'a' | 'glow',
    number,
    number,
    number | undefined,
  ]> = [
    ['r', value.r, 0, 255],
    ['g', value.g, 0, 255],
    ['b', value.b, 0, 255],
    ['a', value.a, 0, 100],
    ['glow', value.glow === undefined ? 0 : value.glow, 0, 1],
  ];
  for (const [name, channelValue, minimum, maximum] of fields) {
    if (name === 'glow' && value.glow === undefined) {
      if (value.channels.glow !== undefined) return 'source literal glow channel presence is inconsistent';
      continue;
    }
    if (!colorFieldValueIsValid({ value: channelValue }, minimum, maximum)) {
      return 'source literal ' + name + ' channel is outside its declared domain';
    }
    const field = value.channels[name];
    if (!field
      || !isSourceLocationShape(field.source)
      || !isSourceLocationShape(field.keySource)
      || typeof field.expression !== 'string'
      || field.expression.length === 0
      || !Object.is(field.value, channelValue)
      || !locationContains(value.declarationSource, field.source)
      || !locationContains(value.declarationSource, field.keySource)) {
      return 'source literal ' + name + ' channel provenance is inconsistent';
    }
  }
  if (value.glow !== undefined && value.channels.glow === undefined) {
    return 'source literal glow value is missing its channel provenance';
  }
  return undefined;
};

const canonicalColorValueSemanticError = (
  value: X4UiLayoutCanonicalColorValue,
): string | undefined => {
  if (value.kind !== 'color'
    || value.domain !== 'canonical-xml-byte-alpha'
    || value.canonicalIdentity !== 'x4-9.00'
    || value.gameVerification !== X4_UI_LAYOUT_GAME_TRUTH
    || typeof value.requestedId !== 'string' || value.requestedId.length === 0
    || typeof value.resolvedBaseId !== 'string' || value.resolvedBaseId.length === 0
    || !isFiniteNumber(value.r) || !Number.isInteger(value.r) || value.r < 0 || value.r > 255
    || !isFiniteNumber(value.g) || !Number.isInteger(value.g) || value.g < 0 || value.g > 255
    || !isFiniteNumber(value.b) || !Number.isInteger(value.b) || value.b < 0 || value.b > 255
    || !isFiniteNumber(value.a) || !Number.isInteger(value.a) || value.a < 0 || value.a > 255
    || !isFiniteNumber(value.glow) || value.glow < 0 || value.glow > 1
    || !isObject(value.baseSource)
    || value.baseSource.path !== X4_UI_CORPUS_COLORS_XML_PATH
    || !Number.isInteger(value.baseSource.index)
    || value.baseSource.index < 0 || value.baseSource.index >= 224
    || value.baseSource.id !== value.resolvedBaseId
    || (value.mappingSource !== undefined
      && (!isObject(value.mappingSource)
        || value.mappingSource.path !== X4_UI_CORPUS_COLORS_XML_PATH
        || !Number.isInteger(value.mappingSource.index)
        || value.mappingSource.index < 0 || value.mappingSource.index >= 804
        || value.mappingSource.id !== value.requestedId
        || value.mappingSource.id === value.resolvedBaseId))
    || (value.mappingSource === undefined && value.requestedId !== value.resolvedBaseId)
    || !isObject(value.sourceIdentities)
    || !isObject(value.sourceIdentities.xml)
    || !isObject(value.sourceIdentities.xsd)
    || value.sourceIdentities.xml.path !== X4_UI_CORPUS_COLORS_XML_PATH
    || value.sourceIdentities.xml.relativePath !== X4_UI_CORPUS_COLORS_XML_PATH
    || value.sourceIdentities.xml.sha256 !== X4_UI_CORPUS_COLORS_XML_SHA256
    || value.sourceIdentities.xml.size !== X4_UI_CORPUS_COLORS_XML_SIZE
    || value.sourceIdentities.xsd.path !== X4_UI_CORPUS_COLORS_XSD_PATH
    || value.sourceIdentities.xsd.relativePath !== X4_UI_CORPUS_COLORS_XSD_PATH
    || value.sourceIdentities.xsd.sha256 !== X4_UI_CORPUS_COLORS_XSD_SHA256
    || value.sourceIdentities.xsd.size !== X4_UI_CORPUS_COLORS_XSD_SIZE) {
    return 'canonical color identity, domain, document pin, or source identity is inconsistent';
  }
  return undefined;
};

const exactColorExpressionRecord = (
  colorExpressions: readonly X4UiCallColorExpression[],
  call: X4UiCallRecord,
  propertyProjection: X4UiCallPropertyProjection,
): X4UiCallColorExpression | undefined => {
  const records = colorExpressions.filter(record => {
    try {
      return record.callName === call.name
        && locationsEqual(record.callSource, call.source)
        && normalizeColorPropertyName(record.propertyName) === normalizeColorPropertyName(propertyProjection.name);
    } catch {
      return false;
    }
  });
  if (records.length !== 1) return undefined;
  const record = records[0];
  try {
    return locationsEqual(record.source, propertyProjection.source)
      && record.colorExpression.expression === propertyProjection.value.expression
      && locationsEqual(record.colorExpression.source, propertyProjection.value.location)
      ? record
      : undefined;
  } catch {
    return undefined;
  }
};

const resolveSourceLiteralColor = (
  expression: X4UiColorExpression,
  sourcePin: X4UiLayoutSourcePin | undefined,
  category: X4UiLayoutGapCategory,
): ColorFactResolution => {
  if (expression.kind !== 'literal-table') {
    const reason = `P1 color expression ${expression.expression} is not a source literal table (${expression.kind})`;
    return unavailableColorFact(reason, expression.source, expression.expression, category, sourcePin);
  }
  const validChannels = colorFieldValueIsValid(expression.r, 0, 255)
    && colorFieldValueIsValid(expression.g, 0, 255)
    && colorFieldValueIsValid(expression.b, 0, 255)
    && colorFieldValueIsValid(expression.a, 0, 100)
    && (expression.glow === undefined || colorFieldValueIsValid(expression.glow, 0, 1));
  if (!validChannels) {
    const reason = `P1 source literal color ${expression.expression} has an out of range or non-finite channel`;
    return unavailableColorFact(reason, expression.source, expression.expression, category, sourcePin);
  }
  const value: X4UiLayoutSourceLiteralColorValue = {
    kind: 'color',
    domain: 'source-literal-percent-alpha',
    r: expression.r.value,
    g: expression.g.value,
    b: expression.b.value,
    a: expression.a.value,
    ...(expression.glow ? { glow: expression.glow.value } : {}),
    declarationExpression: expression.declarationExpression,
    declarationSource: cloneLocation(expression.declarationSource),
    channels: {
      r: colorSourceField(expression.r),
      g: colorSourceField(expression.g),
      b: colorSourceField(expression.b),
      a: colorSourceField(expression.a),
      ...(expression.glow ? { glow: colorSourceField(expression.glow) } : {}),
    },
    gameVerification: X4_UI_LAYOUT_GAME_TRUTH,
  };
  const semanticError = sourceLiteralColorValueSemanticError(value);
  if (semanticError) {
    return unavailableColorFact(semanticError, expression.source, expression.expression, category, sourcePin);
  }
  return {
    fact: knownColorFact(value, 'source-literal', expression.expression, expression.source, sourcePin),
  };
};

const colorDocumentSource = (source: { readonly path: string; readonly index: number; readonly id: string }): X4UiLayoutColorDocumentSource => ({
  path: source.path,
  index: source.index,
  id: source.id,
});

const canonicalColorValueMatchesEvidence = (
  value: X4UiLayoutCanonicalColorValue,
  evidence: X4UiCorpusCanonicalColorSuccess,
): boolean => {
  if (canonicalColorValueSemanticError(value)) return false;
  const bases = evidence.graph.baseColors.filter(candidate => candidate.id === value.resolvedBaseId);
  const mappings = evidence.graph.mappings.filter(candidate => candidate.id === value.requestedId);
  if (bases.length !== 1 || (value.mappingSource ? mappings.length !== 1 : mappings.length !== 0)) return false;
  const base = bases[0];
  if (value.mappingSource) {
    const mapping = mappings[0];
    if (mapping.ref !== base.id
      || value.mappingSource.path !== mapping.source.path
      || value.mappingSource.index !== mapping.source.index
      || value.mappingSource.id !== mapping.source.id) return false;
  } else if (value.requestedId !== base.id) {
    return false;
  }
  return value.baseSource.path === base.source.path
    && value.baseSource.index === base.source.index
    && value.baseSource.id === base.source.id
    && value.r === base.r
    && value.g === base.g
    && value.b === base.b
    && value.a === base.a
    && value.glow === base.glow
    && value.sourceIdentities.xml.path === evidence.identities.xml.path
    && value.sourceIdentities.xml.relativePath === evidence.identities.xml.relativePath
    && value.sourceIdentities.xml.sha256 === evidence.identities.xml.sha256
    && value.sourceIdentities.xml.size === evidence.identities.xml.size
    && value.sourceIdentities.xsd.path === evidence.identities.xsd.path
    && value.sourceIdentities.xsd.relativePath === evidence.identities.xsd.relativePath
    && value.sourceIdentities.xsd.sha256 === evidence.identities.xsd.sha256
    && value.sourceIdentities.xsd.size === evidence.identities.xsd.size;
};

const resolveCanonicalColorById = (
  evidence: X4UiCorpusCanonicalColorSuccess,
  requestedId: string,
  expression: string,
  source: X4UiSourceLocation,
  sourcePin: X4UiLayoutSourcePin | undefined,
  category: X4UiLayoutGapCategory,
): ColorFactResolution => {
  const bases = evidence.graph.baseColors.filter(candidate => candidate.id === requestedId);
  const mappings = evidence.graph.mappings.filter(candidate => candidate.id === requestedId);
  if (bases.length + mappings.length !== 1) {
    const reason = `canonical color ID ${requestedId} is unknown or ambiguous in the accepted P2 graph`;
    return unavailableColorFact(reason, source, expression, category, sourcePin);
  }
  const mapping = mappings[0];
  const base = mapping
    ? evidence.graph.baseColors.filter(candidate => candidate.id === mapping.ref)
    : bases;
  if (base.length !== 1) {
    const reason = `canonical color ID ${requestedId} has no unique one-hop base mapping in the accepted P2 graph`;
    return unavailableColorFact(reason, source, expression, category, sourcePin);
  }
  const baseColor = base[0];
  const validBase = isFiniteNumber(baseColor.r) && baseColor.r >= 0 && baseColor.r <= 255
    && isFiniteNumber(baseColor.g) && baseColor.g >= 0 && baseColor.g <= 255
    && isFiniteNumber(baseColor.b) && baseColor.b >= 0 && baseColor.b <= 255
    && isFiniteNumber(baseColor.a) && baseColor.a >= 0 && baseColor.a <= 255
    && isFiniteNumber(baseColor.glow) && baseColor.glow >= 0 && baseColor.glow <= 1
    && Number.isInteger(baseColor.r)
    && Number.isInteger(baseColor.g)
    && Number.isInteger(baseColor.b)
    && Number.isInteger(baseColor.a)
    && Number.isInteger(baseColor.source.index) && baseColor.source.index >= 0 && baseColor.source.index < 224
    && baseColor.source.path === X4_UI_CORPUS_COLORS_XML_PATH
    && baseColor.source.id === baseColor.id
    && (!mapping || (Number.isInteger(mapping.source.index)
      && mapping.source.index >= 0 && mapping.source.index < 804
      && mapping.source.id === mapping.id
      && mapping.source.path === X4_UI_CORPUS_COLORS_XML_PATH));
  if (!validBase) {
    const reason = `canonical color ID ${requestedId} has malformed or out of range P2 graph facts`;
    return unavailableColorFact(reason, source, expression, category, sourcePin);
  }
  const value: X4UiLayoutCanonicalColorValue = {
    kind: 'color',
    domain: 'canonical-xml-byte-alpha',
    canonicalIdentity: evidence.canonicalIdentity,
    requestedId,
    resolvedBaseId: baseColor.id,
    r: baseColor.r,
    g: baseColor.g,
    b: baseColor.b,
    a: baseColor.a,
    glow: baseColor.glow,
    baseSource: colorDocumentSource(baseColor.source),
    ...(mapping ? { mappingSource: colorDocumentSource(mapping.source) } : {}),
    sourceIdentities: {
      xml: cloneDeep(evidence.identities.xml) as X4UiLayoutColorSourceIdentity,
      xsd: cloneDeep(evidence.identities.xsd) as X4UiLayoutColorSourceIdentity,
    },
    gameVerification: X4_UI_LAYOUT_GAME_TRUTH,
  };
  if (!canonicalColorValueMatchesEvidence(value, evidence)) {
    const reason = 'canonical color ID ' + requestedId + ' has inconsistent P2 identity, mapping, base, or pinned source facts';
    return unavailableColorFact(reason, source, expression, category, sourcePin);
  }
  return {
    fact: knownColorFact(value, 'canonical-default-only', expression, source, sourcePin),
  };
};

const resolveColorFact = (
  colorExpressions: readonly X4UiCallColorExpression[] | undefined,
  call: X4UiCallRecord,
  propertyName: string,
  propertyProjection: X4UiCallPropertyProjection | undefined,
  evidence: X4UiCorpusCanonicalColorSuccess | undefined,
  defaultId: string | undefined,
  source: X4UiSourceLocation,
  sourcePin: X4UiLayoutSourcePin | undefined,
  category: X4UiLayoutGapCategory,
  absentReason: string,
  absentExpression: string,
  absentGapReason = absentReason,
): ColorFactResolution => {
  if (!evidence) {
    return {
      fact: unavailableFact(
        'color-object',
        absentReason,
        propertyProjection?.source || source,
        propertyProjection?.value.expression || (defaultId ? absentExpression : undefined),
        propertyProjection ? undefined : sourcePin,
      ),
      ...(propertyProjection ? {
        gap: {
          category,
          status: 'unsupported' as const,
          reason: absentGapReason,
          expression: propertyProjection.value.expression,
          source: cloneLocation(propertyProjection.source),
        },
      } : {}),
    };
  }
  if (!propertyProjection) {
    return resolveCanonicalColorById(evidence, defaultId || absentExpression, absentExpression, source, sourcePin, category);
  }
  const record = colorExpressions ? exactColorExpressionRecord(colorExpressions, call, propertyProjection) : undefined;
  if (!record) {
    const reason = `P1 color expression for ${propertyName} was missing, duplicated, conflicting, or not exactly source-bound`;
    return unavailableColorFact(reason, propertyProjection.source, propertyProjection.value.expression, category, sourcePin);
  }
  return record.colorExpression.kind === 'symbolic-reference'
    ? resolveCanonicalColorById(evidence, record.colorExpression.id, record.colorExpression.expression, record.colorExpression.source, sourcePin, category)
    : resolveSourceLiteralColor(record.colorExpression, sourcePin, category);
};

const FRAME_TEXTURE_LAYER_NAMES: readonly X4UiLayoutFrameTextureLayerName[] = Object.freeze([
  'background',
  'background2',
  'overlay',
]);

const FRAME_TEXTURE_PROPERTY_TYPES: Readonly<Record<string, X4UiLayoutScalarType | 'color-object'>> = Object.freeze({
  icon: 'string',
  color: 'color-object',
  width: 'number',
  height: 'number',
  rotationRate: 'number',
  rotationStart: 'number',
  rotationDuration: 'number',
  rotationInterval: 'number',
  initialScaleFactor: 'number',
  scaleDuration: 'number',
  glowfactor: 'number',
});

const FRAME_TEXTURE_OPTION_PROPERTIES: readonly string[] = Object.freeze([
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

interface FrameTextureDefaultProjection {
  readonly facts: Readonly<Record<string, X4UiLayoutDescriptorFact>>;
}

const frameTextureDefaultProjection = (
  call: X4UiCallRecord,
  colorEvidence: X4UiCorpusCanonicalColorSuccess | undefined,
  colorExpressions: readonly X4UiCallColorExpression[] | undefined,
): FrameTextureDefaultProjection => {
  const color = resolveColorFact(
    colorExpressions,
    call,
    'color',
    undefined,
    colorEvidence,
    'frame_background_default',
    call.source,
    HELPER_DEFAULT_PINS.frameTextureColor,
    'frame',
    'runtime Color table is not projected as RGBA',
    'Color["frame_background_default"]',
  );
  const glow = color.fact.status === 'known' && color.fact.expectedType === 'color-object'
    ? knownDefaultFact(
      color.fact.value.glow,
      'number',
      call.source,
      HELPER_DEFAULT_PINS.frameTextureGlowfactor,
      'Color["frame_background_default"].glow',
    )
    : unavailableFact(
      'number',
      'frame texture default glowfactor depends on unavailable frame background color',
      call.source,
      'Color["frame_background_default"].glow',
      HELPER_DEFAULT_PINS.frameTextureGlowfactor,
    );
  return {
    facts: {
      icon: knownDefaultFact('', 'string', call.source, HELPER_DEFAULT_PINS.frameTextureIcon, '""'),
      color: color.fact,
      width: knownDefaultFact(0, 'number', call.source, HELPER_DEFAULT_PINS.frameTextureWidth, '0'),
      height: knownDefaultFact(0, 'number', call.source, HELPER_DEFAULT_PINS.frameTextureHeight, '0'),
      rotationRate: knownDefaultFact(0, 'number', call.source, HELPER_DEFAULT_PINS.frameTextureRotationRate, '0'),
      rotationStart: knownDefaultFact(0, 'number', call.source, HELPER_DEFAULT_PINS.frameTextureRotationStart, '0'),
      rotationDuration: knownDefaultFact(0, 'number', call.source, HELPER_DEFAULT_PINS.frameTextureRotationDuration, '0'),
      rotationInterval: knownDefaultFact(0, 'number', call.source, HELPER_DEFAULT_PINS.frameTextureRotationInterval, '0'),
      initialScaleFactor: knownDefaultFact(1, 'number', call.source, HELPER_DEFAULT_PINS.frameTextureInitialScaleFactor, '1'),
      scaleDuration: knownDefaultFact(0, 'number', call.source, HELPER_DEFAULT_PINS.frameTextureScaleDuration, '0'),
      glowfactor: glow,
    },
  };
};

const frameTextureLayersFor = (
  call: X4UiCallRecord,
  colorEvidence: X4UiCorpusCanonicalColorSuccess | undefined,
  colorExpressions: readonly X4UiCallColorExpression[] | undefined,
): { readonly layers: MutableFrameTextureLayer[] } => {
  const defaults = frameTextureDefaultProjection(call, colorEvidence, colorExpressions);
  return {
    layers: FRAME_TEXTURE_LAYER_NAMES.map(name => ({
      name,
      source: cloneLocation(call.source),
      sourceOrder: call.source.start.offset,
      operationIds: [],
      descriptorFacts: cloneDeep(defaults.facts) as Record<string, X4UiLayoutDescriptorFact>,
    })),
  };
};

const withKnownFactValue = (
  fact: X4UiLayoutDescriptorFact,
  value: X4UiLayoutScalar,
): X4UiLayoutDescriptorFact => fact.status === 'known' && fact.expectedType !== 'color-object' ? { ...fact, value } : fact;

const recordDescriptorFact = (
  operation: MutableOperation,
  nodeFacts: Record<string, X4UiLayoutDescriptorFact>,
  field: string,
  fact: X4UiLayoutDescriptorFact,
): void => {
  operation.descriptorFacts[field] = fact;
  nodeFacts[field] = fact;
};

const invalidateDescriptorDefaultsForDynamicOptions = (
  operation: MutableOperation,
  nodeFacts: Record<string, X4UiLayoutDescriptorFact>,
  options: X4UiValue | undefined,
  fallbackSource: X4UiSourceLocation,
): void => {
  for (const [field, prior] of Object.entries(nodeFacts)) {
    const fact = unavailableFact(
      prior.expectedType,
      'dynamic option table prevents source-pinned default substitution',
      options?.location || fallbackSource,
      options?.expression,
    );
    operation.descriptorFacts[field] = fact;
    nodeFacts[field] = fact;
  }
};

const isHelperReceiver = (call: X4UiCallRecord): boolean =>
  call.method === '.'
  && call.receiver?.status === 'static'
  && call.receiver.reference?.kind === 'global'
  && call.receiver.reference.path === 'Helper';

const isReachabilityBlocked = (context: X4UiFunctionContext): X4UiLayoutOperationStatus | undefined => {
  if (context.reachability === 'unreachable' || context.branchPath.some(segment => segment.reachability === 'unreachable')) return 'unreachable';
  if (context.branchPath.length > 0 || context.loopPath.length > 0 || context.reachability === 'conditional') return 'conditional';
  return undefined;
};

const isCallReachabilityBlocked = (call: ProjectableCall): X4UiLayoutOperationStatus | undefined => {
  const context = call.context;
  if (context.reachability === 'unreachable'
    || context.branchPath.some(segment => segment.reachability === 'unreachable')) return 'unreachable';
  if (!call.expansionInstance) return isReachabilityBlocked(context);
  if (context.loopPath.length > 0) return 'conditional';
  const selected = new Set(call.expansionInstance.selectedBoundaryIds);
  if (context.branchPath.some(segment => !selected.has(segment.boundaryId))) return 'conditional';
  if (context.reachability === 'conditional' && context.branchPath.length === 0) return 'conditional';
  return undefined;
};

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

interface MutableFrameTextureLayer extends Mutable<Omit<X4UiLayoutFrameTextureLayer, 'operationIds' | 'descriptorFacts'>> {
  operationIds: string[];
  descriptorFacts: Record<string, X4UiLayoutDescriptorFact>;
}

interface MutableFrame extends Mutable<Omit<X4UiLayoutFrameNode, 'tableIds' | 'operationIds' | 'descriptorFacts' | 'status' | 'frameTextureLayers' | 'blurBackground'>> {
  tableIds: string[];
  operationIds: string[];
  descriptorFacts: Record<string, X4UiLayoutDescriptorFact>;
  frameTextureLayers: MutableFrameTextureLayer[];
  blurBackground: X4UiLayoutDescriptorFact;
  status: X4UiLayoutFrameNode['status'];
  hadGap: boolean;
  hadRefusal: boolean;
}

interface MutableTable extends Mutable<Omit<X4UiLayoutTableNode, 'rowIds' | 'operationIds' | 'descriptorFacts' | 'status'>> {
  rowIds: string[];
  operationIds: string[];
  descriptorFacts: Record<string, X4UiLayoutDescriptorFact>;
  status: X4UiLayoutTableNode['status'];
  kernelState?: HelperTableState;
  hadGap: boolean;
  hadRefusal: boolean;
  tableIdentityKey?: string;
  editBoxDefaultsUnresolved: boolean;
}

interface MutableRow extends Mutable<Omit<X4UiLayoutRowNode, 'cellIds' | 'operationIds' | 'descriptorFacts' | 'status'>> {
  cellIds: string[];
  operationIds: string[];
  descriptorFacts: Record<string, X4UiLayoutDescriptorFact>;
  status: X4UiLayoutRowNode['status'];
  kernelState?: HelperTableState['rows'][number];
  hadGap: boolean;
  hadRefusal: boolean;
  rowIdentityKey?: string;
  invocationAncestry: readonly string[];
}

interface MutableCell extends Mutable<Omit<X4UiLayoutCellNode, 'operationIds' | 'metadataOperationIds' | 'descriptorFacts' | 'status'>> {
  operationIds: string[];
  metadataOperationIds: string[];
  descriptorFacts: Record<string, X4UiLayoutDescriptorFact>;
  status: X4UiLayoutCellNode['status'];
  kernelState?: HelperTableState['rows'][number]['cells'][number];
  hadGap: boolean;
  hadRefusal: boolean;
  cellIdentityKey?: string;
  missingHeight: boolean;
  explicitWidth?: number;
  explicitWidthFact?: X4UiLayoutDescriptorFact;
  effectiveScaling?: boolean;
}

interface MutableOperation extends Mutable<Omit<X4UiLayoutOperation, 'status' | 'metadata' | 'descriptorFacts'>> {
  status: X4UiLayoutOperationStatus;
  metadata: X4UiLayoutCallMetadata;
  descriptorFacts: Record<string, X4UiLayoutDescriptorFact>;
}

interface EvidenceOperationEvent {
  readonly call: ProjectableCall;
  readonly operation: MutableOperation;
}

type EvidenceNodeKind = 'frame' | 'table' | 'row' | 'cell';
type EvidenceNodeLedgerName = 'operationIds' | 'metadataOperationIds';

interface EvidenceNodeLedgerEvent {
  readonly kind: EvidenceNodeKind;
  readonly nodeId: string;
  readonly ledger: 'node' | EvidenceNodeLedgerName;
  readonly operationId?: string;
}

const addGap = (
  gaps: X4UiLayoutGap[],
  gap: X4UiLayoutGap,
  evidenceGaps?: X4UiLayoutGap[],
): void => {
  const normalized: X4UiLayoutGap = {
    category: gap.category,
    status: gap.status,
    reason: gap.reason,
    ...(gap.expression ? { expression: gap.expression } : {}),
    source: cloneLocation(gap.source),
    ...(gap.operationId ? { operationId: gap.operationId } : {}),
    ...(gap.nodeId ? { nodeId: gap.nodeId } : {}),
  };
  gaps.push(normalized);
  if (evidenceGaps) evidenceGaps.push(cloneDeep(normalized) as X4UiLayoutGap);
};

const addGapToProgram = addGap;

const layoutFailure = (result: LayoutResult<unknown>): LayoutFailure | undefined =>
  result.status === 'ok' ? undefined : result;

const addResolutionGap = (
  gaps: X4UiLayoutGap[],
  resolution: Resolution<unknown>,
  operationId: string,
  nodeId?: string,
  evidenceGaps?: X4UiLayoutGap[],
): void => {
  if (!resolution.gap) return;
  addGap(gaps, { ...resolution.gap, operationId, ...(nodeId ? { nodeId } : {}) }, evidenceGaps);
};

const kernelFailureGap = (
  result: LayoutResult<unknown>,
  category: X4UiLayoutGapCategory,
  source: X4UiSourceLocation,
  operationId: string,
  nodeId?: string,
): X4UiLayoutGap | undefined => {
  const failure = layoutFailure(result);
  if (!failure) return undefined;
  return {
    category,
    status: 'refused',
    reason: failure.message,
    source: cloneLocation(source),
    operationId,
    ...(nodeId ? { nodeId } : {}),
  };
};

interface ProjectableCall extends X4UiCallRecord {
  readonly expansionInstance?: {
    readonly invocationId: string;
    readonly ancestry: readonly string[];
    readonly depth: number;
    readonly previewPathSelectionIds: readonly string[];
    readonly selectedBoundaryIds: readonly string[];
  };
}

const EVIDENCE_RELEVANT_CALL_NAMES: readonly X4UiRelevantCallName[] = Object.freeze([
  'createFrameHandle',
  'addTable',
  'setDefaultCellProperties',
  'setDefaultComplexCellProperties',
  'setColWidth',
  'setColWidthPercent',
  'addRow',
  'setColSpan',
  'createText',
  'createButton',
  'createEditBox',
  'setHotkey',
  'createIcon',
  'setBackground',
  'setBackground2',
  'setOverlay',
  'setText',
  'setText2',
  'scaleX',
  'scaleY',
  'scaleFont',
  'display',
  'OpenMenu',
]);

const operationIdFor = (call: ProjectableCall): string =>
  programId(
    'operation',
    `${call.order}|${call.name}|${locationKey(call.source)}`
      + (call.expansionInstance ? `|${call.expansionInstance.ancestry.join('>')}` : '')
  );

const evidenceCallIdFor = (call: ProjectableCall): string =>
  programId('evidence-call', operationIdFor(call));

const evidenceSourceBindingIdFor = (operationId: string): string =>
  programId('evidence-source-binding', operationId);

const sampleCatalogIdFor = (identity: X4UiLayoutModelIdentity, target: X4UiLayoutTarget): string =>
  programId('sample-catalog', `${identity.sha256}|${locationKey(target.source)}`);

const sampleIdFor = (
  identity: X4UiLayoutModelIdentity,
  source: X4UiSourceLocation,
  expectedType: X4UiLayoutScalarType,
): string => programId(
  'preview-sample',
  `${identity.sha256}|${source.start.line}:${source.start.column}:${source.start.offset}`
    + `-${source.end.line}:${source.end.column}:${source.end.offset}|${expectedType}`,
);

const PROPERTY_SAMPLE_TYPES: Readonly<Record<string, X4UiLayoutScalarType | undefined>> = Object.freeze({
  x: 'number',
  y: 'number',
  width: 'number',
  height: 'number',
  icon: 'string',
  rotationrate: 'number',
  rotationstart: 'number',
  rotationduration: 'number',
  rotationinterval: 'number',
  initialscalefactor: 'number',
  scaleduration: 'number',
  glowfactor: 'number',
  layer: 'number',
  taborder: 'number',
  maxvisibleheight: 'number',
  paddingtop: 'number',
  paddingbottom: 'number',
  minrowheight: 'number',
  fontsize: 'number',
  maxchars: 'number',
  autoframeheight: 'boolean',
  blurbackground: 'boolean',
  reservescrollbar: 'boolean',
  scaling: 'boolean',
  borderbelow: 'boolean',
  fixed: 'boolean',
  interactive: 'boolean',
  wordwrap: 'boolean',
  active: 'boolean',
  affectrowheight: 'boolean',
  selecttextonactivation: 'boolean',
  backgroundid: 'string',
  highlightmode: 'string',
  font: 'string',
  halign: 'string',
  defaulttext: 'string',
  description: 'string',
});

const isSampleableValue = (
  value: X4UiValue,
  expectedType: X4UiLayoutScalarType,
  allowLocalInvocationResults: boolean,
): boolean => {
  if (value.numericExpression) return false;
  if (value.localInvocationResult && allowLocalInvocationResults) {
    return value.status !== 'static'
      && !value.reference
      && value.type !== 'table'
      && value.type !== 'function'
      && value.type !== 'reference';
  }
  if (value.status === 'static'
    || value.type === 'nil'
    || value.type === 'table'
    || value.type === 'function'
    || value.type === 'reference'
    || value.reference
    || value.symbol?.startsWith('Helper.')) return false;
  if (/\bC\./.test(value.expression) || /\bHelper\./.test(value.expression)) return false;
  if (value.expression.length === 0) return false;
  // Eligible dynamic/unknown strings are represented only by an opaque user-supplied preview value.
  // Forge does not expand, invoke, or evaluate any call; the surrounding guards continue to exclude
  // all non-string calls and direct C.* / Helper.* expressions.
  if (/[A-Za-z_][A-Za-z0-9_.:]*\s*\(/.test(value.expression)
    && !(expectedType === 'string' && (value.status === 'dynamic' || value.status === 'unknown'))) return false;
  return true;
};

const createPreviewSampleCatalog = (
  identity: X4UiLayoutModelIdentity,
  target: X4UiLayoutTarget,
  calls: readonly ProjectableCall[],
  resolvedDirectScaleLocations: ReadonlySet<string>,
  resolvedLocalScaleFontInvocationIds: ReadonlySet<string> = new Set(),
  allowLocalInvocationResults = false,
): X4UiLayoutPreviewSampleCatalog => {
  type MutableEntry = {
    id: string;
    expression: string;
    expectedType: X4UiLayoutScalarType;
    source: X4UiSourceLocation;
    consumers: X4UiLayoutPreviewSampleConsumer[];
    provenance: 'preview-only';
  };
  const entries = new Map<string, MutableEntry>();
  const collect = (
    call: ProjectableCall,
    field: string,
    value: X4UiValue | undefined,
    expectedType: X4UiLayoutScalarType,
  ): void => {
    if (!value || !isSampleableValue(value, expectedType, allowLocalInvocationResults)) return;
    if (value.localInvocationResult
      && resolvedLocalScaleFontInvocationIds.has(value.localInvocationResult.invocationId)) return;
    const sampleSource = sampleSourceForValue(value);
    if (resolvedDirectScaleLocations.has(locationKey(sampleSource))) return;
    const id = sampleIdFor(identity, sampleSource, expectedType);
    const consumer: X4UiLayoutPreviewSampleConsumer = {
      operationId: operationIdFor(call),
      operationKind: call.name,
      field,
      source: cloneLocation(value.location),
    };
    const existing = entries.get(id);
    if (existing) {
      if (!existing.consumers.some(candidate => candidate.operationId === consumer.operationId && candidate.field === consumer.field)) {
        existing.consumers.push(consumer);
      }
      return;
    }
    entries.set(id, {
      id,
      expression: evidenceExpressionForValue(value) || value.expression,
      expectedType,
      source: cloneLocation(sampleSource),
      consumers: [consumer],
      provenance: 'preview-only',
    });
  };

  for (const call of calls) {
    if (call.name === 'createFrameHandle') {
      collect(call, 'width', call.semantics.width, 'number');
      collect(call, 'height', call.semantics.height, 'number');
    } else if (call.name === 'addTable') {
      collect(call, 'count', call.semantics.count, 'number');
      collect(call, 'width', call.semantics.width, 'number');
    } else if (call.name === 'setColWidth') {
      collect(call, 'index', call.semantics.index, 'number');
      collect(call, 'width', call.semantics.width, 'number');
      collect(call, 'scaling', call.semantics.scaling, 'boolean');
    } else if (call.name === 'setColWidthPercent') {
      collect(call, 'index', call.semantics.index, 'number');
      collect(call, 'percentage', call.semantics.percentage, 'number');
    } else if (call.name === 'setColSpan') {
      collect(call, 'span', call.semantics.span, 'number');
    } else if (call.name === 'createText' || call.name === 'setText' || call.name === 'setText2') {
      collect(call, call.name === 'setText2' ? 'text2' : 'text', call.semantics.text, 'string');
    } else if (call.name === 'createIcon' || call.name === 'setBackground' || call.name === 'setBackground2' || call.name === 'setOverlay') {
      collect(call, 'icon', call.semantics.icon, 'string');
    }
    for (const projected of call.semantics.properties || []) {
      if (call.name === 'addRow' && projected.normalizedName === 'height') continue;
      const expectedType = PROPERTY_SAMPLE_TYPES[projected.normalizedName];
      if (expectedType) collect(call, projected.normalizedName, projected.value, expectedType);
    }
  }
  const ordered = [...entries.values()].sort((left, right) =>
    left.source.start.offset - right.source.start.offset
      || left.source.end.offset - right.source.end.offset
      || left.expectedType.localeCompare(right.expectedType));
  return freezeDeep({
    id: sampleCatalogIdFor(identity, target),
    sourceIdentity: cloneDeep(identity) as X4UiLayoutModelIdentity,
    targetId: target.id,
    entries: ordered,
  });
};

interface ResolvedPreviewSample {
  readonly entry: X4UiLayoutPreviewSampleCatalogEntry;
  readonly value: X4UiLayoutScalar;
}

interface NormalizedPreviewSamples {
  readonly byRangeAndType: ReadonlyMap<string, ResolvedPreviewSample>;
  readonly ordered: readonly ResolvedPreviewSample[];
}

const rangeAndTypeKey = (source: X4UiSourceLocation, expectedType: X4UiLayoutScalarType): string =>
  `${locationKey(source)}|${expectedType}`;

const scalarType = (value: X4UiLayoutScalar): X4UiLayoutScalarType => typeof value as X4UiLayoutScalarType;

const normalizePreviewSamples = (
  input: X4UiLayoutPreviewSampleInput | undefined,
  identity: X4UiLayoutModelIdentity,
  catalog: X4UiLayoutPreviewSampleCatalog,
):
  | { ok: true; value: NormalizedPreviewSamples }
  | { ok: false; code: 'malformed-samples' | 'sample-source-mismatch' | 'invalid-samples'; message: string } => {
  if (input === undefined) return { ok: true, value: { byRangeAndType: new Map(), ordered: [] } };
  if (!isObject(input) || typeof input.catalogId !== 'string' || !isObject(input.source) || !Array.isArray(input.values)) {
    return { ok: false, code: 'malformed-samples', message: 'preview samples must carry catalogId, exact source identity, and a values array' };
  }
  if (typeof input.source.file !== 'string'
    || (input.source.sourcePath !== undefined && typeof input.source.sourcePath !== 'string')
    || !isHexSha256(input.source.sha256)) {
    return { ok: false, code: 'malformed-samples', message: 'preview sample source identity is malformed' };
  }
  if (input.catalogId !== catalog.id
    || input.source.file !== identity.file
    || !sameOptionalString(typeof input.source.sourcePath === 'string' ? input.source.sourcePath : undefined, identity.sourcePath)
    || typeof input.source.sha256 !== 'string'
    || input.source.sha256.toUpperCase() !== identity.sha256) {
    return { ok: false, code: 'sample-source-mismatch', message: 'preview sample catalog/source identity does not match the selected source target' };
  }
  const catalogById = new Map(catalog.entries.map(entry => [entry.id, entry]));
  const supplied = new Map<string, X4UiLayoutScalar>();
  for (const candidate of input.values) {
    if (!isObject(candidate) || typeof candidate.id !== 'string'
      || !['number', 'string', 'boolean'].includes(typeof candidate.value)
      || (typeof candidate.value === 'number' && !Number.isFinite(candidate.value))) {
      return { ok: false, code: 'malformed-samples', message: 'preview sample values must be finite numbers, strings, or booleans with an ID' };
    }
    if (supplied.has(candidate.id)) {
      return { ok: false, code: 'invalid-samples', message: `duplicate preview sample ID: ${candidate.id}` };
    }
    const entry = catalogById.get(candidate.id);
    if (!entry) return { ok: false, code: 'invalid-samples', message: `unknown or extra preview sample ID: ${candidate.id}` };
    if (scalarType(candidate.value as X4UiLayoutScalar) !== entry.expectedType) {
      return { ok: false, code: 'invalid-samples', message: `preview sample type mismatch for ${candidate.id}` };
    }
    supplied.set(candidate.id, candidate.value as X4UiLayoutScalar);
  }
  const ordered = catalog.entries
    .filter(entry => supplied.has(entry.id))
    .map(entry => ({ entry, value: supplied.get(entry.id)! }));
  return {
    ok: true,
    value: {
      byRangeAndType: new Map(ordered.map(sample => [rangeAndTypeKey(sample.entry.source, sample.entry.expectedType), sample])),
      ordered,
    },
  };
};

const previewPathCatalogIdFor = (
  identity: X4UiLayoutModelIdentity,
  target: X4UiLayoutTarget
): string => programId('preview-path-catalog', `${identity.sha256}|${locationKey(target.source)}`);

const previewPathIdFor = (
  identity: X4UiLayoutModelIdentity,
  boundaryId: string,
  armId: string
): string => programId('preview-path', `${identity.sha256}|${boundaryId}|${armId}`);

const contextSourceMatches = (
  context: X4UiFunctionContext,
  source: X4UiSourceLocation
): boolean => locationsEqual(context.source, source);

const createPreviewPathCatalog = (
  model: X4UiCallModel,
  identity: X4UiLayoutModelIdentity,
  target: X4UiLayoutTarget
): X4UiLayoutPreviewPathCatalog => {
  type MutableEntry = {
    id: string;
    boundaryId: string;
    armId: string;
    boundary: X4UiSourceLocation;
    arm: X4UiBranchPathSegment['arm'];
    armIndex: number;
    reachability: X4UiBranchPathSegment['reachability'];
    invocationIds: string[];
    provenance: 'preview-only';
  };
  const entries = new Map<string, MutableEntry>();
  const declarations = new Map((model.localFunctions || []).map(declaration => [declaration.id, declaration]));
  const visitedContexts = new Set<string>();
  const queue: X4UiSourceLocation[] = [target.source];
  while (queue.length > 0) {
    const contextSource = queue.shift()!;
    const contextId = locationKey(contextSource);
    if (visitedContexts.has(contextId)) continue;
    visitedContexts.add(contextId);
    const invocations = (model.localInvocations || []).filter(invocation => contextSourceMatches(invocation.context, contextSource));
    for (const invocation of invocations) {
      for (const segment of invocation.context.branchPath) {
        const id = previewPathIdFor(identity, segment.boundaryId, segment.armId);
        const existing = entries.get(id);
        if (existing) {
          if (!existing.invocationIds.includes(invocation.id)) existing.invocationIds.push(invocation.id);
        } else {
          entries.set(id, {
            id,
            boundaryId: segment.boundaryId,
            armId: segment.armId,
            boundary: cloneLocation(segment.boundary),
            arm: segment.arm,
            armIndex: segment.armIndex,
            reachability: segment.reachability,
            invocationIds: [invocation.id],
            provenance: 'preview-only'
          });
        }
      }
      const declaration = invocation.calleeDeclarationId
        ? declarations.get(invocation.calleeDeclarationId)
        : undefined;
      if (declaration) queue.push(declaration.source);
    }
  }
  const ordered = [...entries.values()].sort((left, right) =>
    left.boundary.start.offset - right.boundary.start.offset
      || left.armIndex - right.armIndex
      || left.id.localeCompare(right.id));
  return freezeDeep({
    id: previewPathCatalogIdFor(identity, target),
    sourceIdentity: cloneDeep(identity) as X4UiLayoutModelIdentity,
    targetId: target.id,
    entries: ordered
  });
};

interface NormalizedPreviewPaths {
  readonly byBoundary: ReadonlyMap<string, X4UiLayoutPreviewPathCatalogEntry>;
  readonly ordered: readonly X4UiLayoutPreviewPathSelectionBinding[];
}

const normalizePreviewPaths = (
  input: X4UiLayoutPreviewPathSelectionInput | undefined,
  identity: X4UiLayoutModelIdentity,
  catalog: X4UiLayoutPreviewPathCatalog,
  enabled: boolean
):
  | { ok: true; value: NormalizedPreviewPaths }
  | {
    ok: false;
    code: 'malformed-preview-path' | 'preview-path-source-mismatch' | 'invalid-preview-path';
    message: string;
  } => {
  if (input === undefined) return { ok: true, value: { byBoundary: new Map(), ordered: [] } };
  if (!enabled) {
    return { ok: false, code: 'invalid-preview-path', message: 'preview-path selections require explicit localExpansion limits' };
  }
  if (!isObject(input) || typeof input.catalogId !== 'string' || !isObject(input.source) || !Array.isArray(input.selections)) {
    return { ok: false, code: 'malformed-preview-path', message: 'preview-path input must carry catalogId, exact source identity, and a selections array' };
  }
  if (typeof input.source.file !== 'string'
    || (input.source.sourcePath !== undefined && typeof input.source.sourcePath !== 'string')
    || !isHexSha256(input.source.sha256)) {
    return { ok: false, code: 'malformed-preview-path', message: 'preview-path source identity is malformed' };
  }
  if (input.catalogId !== catalog.id
    || input.source.file !== identity.file
    || !sameOptionalString(typeof input.source.sourcePath === 'string' ? input.source.sourcePath : undefined, identity.sourcePath)
    || input.source.sha256.toUpperCase() !== identity.sha256) {
    return { ok: false, code: 'preview-path-source-mismatch', message: 'preview-path catalog/source identity does not match the selected source target' };
  }
  const byId = new Map(catalog.entries.map(entry => [entry.id, entry]));
  const selectedIds = new Set<string>();
  const selectedBoundaries = new Map<string, X4UiLayoutPreviewPathCatalogEntry>();
  for (const candidate of input.selections) {
    if (!isObject(candidate)
      || typeof candidate.id !== 'string'
      || typeof candidate.boundaryId !== 'string'
      || typeof candidate.armId !== 'string') {
      return { ok: false, code: 'malformed-preview-path', message: 'each preview-path selection requires exact id, boundaryId, and armId strings' };
    }
    if (selectedIds.has(candidate.id)) {
      return { ok: false, code: 'invalid-preview-path', message: `duplicate preview-path selection ID: ${candidate.id}` };
    }
    const entry = byId.get(candidate.id);
    if (!entry || entry.boundaryId !== candidate.boundaryId || entry.armId !== candidate.armId) {
      return { ok: false, code: 'invalid-preview-path', message: `unknown, extra, or mismatched preview-path selection: ${candidate.id}` };
    }
    if (entry.reachability === 'unreachable') {
      return { ok: false, code: 'invalid-preview-path', message: `statically unreachable preview-path arm cannot be selected: ${candidate.id}` };
    }
    const prior = selectedBoundaries.get(entry.boundaryId);
    if (prior && prior.armId !== entry.armId) {
      return { ok: false, code: 'invalid-preview-path', message: `conflicting preview-path arms for boundary ${entry.boundaryId}` };
    }
    selectedIds.add(candidate.id);
    selectedBoundaries.set(entry.boundaryId, entry);
  }
  const ordered = catalog.entries
    .filter(entry => selectedIds.has(entry.id))
    .map(entry => ({
      id: entry.id,
      boundaryId: entry.boundaryId,
      armId: entry.armId,
      boundary: cloneLocation(entry.boundary),
      provenance: 'preview-only' as const
    }));
  return { ok: true, value: { byBoundary: selectedBoundaries, ordered } };
};

interface MutableLocalInvocation extends Mutable<Omit<X4UiLayoutLocalInvocation, 'operationIds'>> {
  operationIds: string[];
}

interface LocalExpansionPlan {
  readonly calls: ProjectableCall[];
  readonly invocations: MutableLocalInvocation[];
  readonly gaps: X4UiLayoutGap[];
  readonly contextSources: X4UiSourceLocation[];
}

const mergeReachability = (
  left: X4UiFunctionContext['reachability'],
  right: X4UiFunctionContext['reachability']
): X4UiFunctionContext['reachability'] => {
  if (left === 'unreachable' || right === 'unreachable') return 'unreachable';
  if (left === 'conditional' || right === 'conditional') return 'conditional';
  return 'reachable';
};

const mergeExpansionContext = (
  parent: X4UiFunctionContext | undefined,
  child: X4UiFunctionContext
): X4UiFunctionContext => parent ? {
  ...child,
  branchPath: [...parent.branchPath, ...child.branchPath],
  loopPath: [...parent.loopPath, ...child.loopPath],
  reachability: mergeReachability(parent.reachability, child.reachability)
} : cloneDeep(child) as X4UiFunctionContext;

const isValueShape = (value: unknown): value is X4UiValue =>
  isObject(value)
  && ['static', 'dynamic', 'unknown'].includes(String(value.status))
  && typeof value.type === 'string'
  && typeof value.expression === 'string'
  && isSourceLocationShape(value.location);

const prefixInstancePath = (prefix: string, path: string | undefined): string | undefined =>
  path === undefined || prefix.length === 0 || path === 'Helper' || path.startsWith(`${prefix}|`)
    ? path
    : `${prefix}|${path}`;

const instantiateReference = (
  reference: X4UiValueReference,
  prefix: string,
  parameterBindings: ReadonlyMap<string, X4UiValue>
): X4UiValueReference => {
  const cloned = cloneDeep(reference) as X4UiValueReference;
  if (cloned.kind !== 'global') {
    cloned.path = prefixInstancePath(prefix, cloned.path)!;
    cloned.parentPath = prefixInstancePath(prefix, cloned.parentPath);
    cloned.relatedPath = prefixInstancePath(prefix, cloned.relatedPath);
  }
  if (cloned.index) cloned.index = instantiateValue(cloned.index, prefix, parameterBindings);
  return cloned;
};

const instantiateValue = (
  value: X4UiValue,
  prefix: string,
  parameterBindings: ReadonlyMap<string, X4UiValue>,
  seenParameters = new Set<string>()
): X4UiValue => {
  if (value.parameter) {
    if (seenParameters.has(value.parameter.id)) {
      return {
        ...cloneDeep(value) as X4UiValue,
        status: 'unknown',
        reason: 'cyclic local parameter binding is unsupported'
      };
    }
    const bound = parameterBindings.get(value.parameter.id);
    if (bound) {
      const nextSeen = new Set(seenParameters);
      nextSeen.add(value.parameter.id);
      // A bound value already belongs to the caller instance.  Preserve that
      // exact ownership/source identity instead of rebasing it into the callee.
      const resolved = instantiateValue(bound, '', parameterBindings, nextSeen);
      const result = cloneDeep(resolved) as X4UiValue;
      delete result.parameter;
      return result;
    }
  }
  const result = cloneDeep(value) as X4UiValue;
  if (result.reference) {
    result.reference = instantiateReference(result.reference, prefix, parameterBindings);
    if (['frame', 'table', 'row', 'cell'].includes(result.reference.kind)
      && ['call', 'alias', 'index'].includes(result.reference.origin)) {
      result.status = 'static';
      delete result.reason;
    }
  }
  return result;
};

const instantiateTree = (
  value: unknown,
  prefix: string,
  parameterBindings: ReadonlyMap<string, X4UiValue>
): unknown => {
  if (isValueShape(value)) return instantiateValue(value, prefix, parameterBindings);
  if (Array.isArray(value)) return value.map(child => instantiateTree(child, prefix, parameterBindings));
  if (isObject(value)) {
    const result: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) result[key] = instantiateTree(child, prefix, parameterBindings);
    return result;
  }
  return value;
};

const directLiteralArgument = (value: X4UiValue): boolean =>
  Boolean(value.sourceLiteral && locationsEqual(value.sourceLiteral, value.location)
    && value.status === 'static'
    && ['number', 'string', 'boolean'].includes(value.type));

const objectOwnershipArgument = (value: X4UiValue): boolean =>
  value.status === 'static'
  && Boolean(value.reference)
  && ['frame', 'table', 'row', 'cell'].includes(value.reference!.kind);

const parameterReceiverIds = (
  declaration: X4UiLocalFunctionDeclaration,
  calls: readonly X4UiCallRecord[]
): ReadonlySet<string> => {
  const result = new Set<string>();
  for (const call of calls) {
    if (!contextSourceMatches(call.context, declaration.source)) continue;
    const values = [call.receiver, call.semantics.frame, call.semantics.table, call.semantics.row, call.semantics.cell];
    for (const value of values) if (value?.parameter) result.add(value.parameter.id);
  }
  return result;
};

const callDataFlowSatisfied = (call: ProjectableCall): boolean => {
  const dataFlow = call.semantics.dataFlow;
  if (!dataFlow || dataFlow.status !== 'static') return false;
  const kind = dataFlow.reference?.kind;
  if (call.name === 'createFrameHandle' || call.name === 'scaleX' || call.name === 'scaleY' || call.name === 'scaleFont') {
    return kind === 'global' && dataFlow.reference?.path === 'Helper';
  }
  if (call.name === 'addTable' || call.name === 'display'
    || call.name === 'setBackground' || call.name === 'setBackground2' || call.name === 'setOverlay') return kind === 'frame';
  if (call.name === 'setColWidth' || call.name === 'setColWidthPercent' || call.name === 'addRow') return kind === 'table';
  if (['setColSpan', 'createText', 'createButton', 'createEditBox', 'createIcon', 'setText', 'setText2'].includes(call.name)) {
    return kind === 'cell' || kind === 'row' || kind === 'table';
  }
  return false;
};

const localAstNode = (value: unknown): NumericExpressionSourceAstNode | undefined =>
  isObject(value) ? value as NumericExpressionSourceAstNode : undefined;

const localAstNodes = (value: unknown): readonly NumericExpressionSourceAstNode[] | undefined =>
  Array.isArray(value) && value.every(item => isObject(item))
    ? value as readonly NumericExpressionSourceAstNode[]
    : undefined;

const localAstIdentifier = (
  value: unknown,
  name: string,
  isLocal?: boolean,
): boolean => {
  const node = localAstNode(value);
  return Boolean(node
    && node.type === 'Identifier'
    && node.name === name
    && (isLocal === undefined || node.isLocal === isLocal));
};

const localAstSource = (
  model: X4UiCallModel,
  node: NumericExpressionSourceAstNode,
): X4UiSourceLocation | undefined => {
  const range = sourceAstRange(node);
  if (!range || range[1] > model.file.text.length) return undefined;
  const start = sourcePositionAtOffset(model.file.text, range[0]);
  const end = sourcePositionAtOffset(model.file.text, range[1]);
  return {
    file: model.file.rel,
    ...(model.file.sourcePath ? { sourcePath: model.file.sourcePath } : {}),
    start: { ...start, offset: range[0] },
    end: { ...end, offset: range[1] },
  };
};

const localAstStringValue = (
  model: X4UiCallModel,
  value: unknown,
): string | undefined => {
  const node = localAstNode(value);
  const range = node ? sourceAstRange(node) : undefined;
  if (!node || node.type !== 'StringLiteral' || !range) return undefined;
  const source = localAstSource(model, node);
  if (!source || !sourceLocationMatchesModel(model, source, model.file.text.slice(range[0], range[1]))) {
    return undefined;
  }
  if (typeof node.value === 'string') return node.value;
  // luaparse currently exposes StringLiteral.value as null.  Decode only the
  // AST-confirmed quoted token; this is a literal-value fallback, not Lua
  // evaluation, and the exact AST range/model source check above remains
  // mandatory.
  if (node.value !== null || typeof node.raw !== 'string') return undefined;
  const raw = node.raw;
  if (model.file.text.slice(range[0], range[1]) !== raw) return undefined;
  if (raw.length < 2 || (raw[0] !== '"' && raw[0] !== "'") || raw[raw.length - 1] !== raw[0]) {
    return undefined;
  }
  const body = raw.slice(1, -1);
  if (body.includes('\\')) return undefined;
  return body;
};

const localAstExactString = (
  model: X4UiCallModel,
  value: unknown,
  expected: string,
): boolean => {
  return localAstStringValue(model, value) === expected;
};

const localAstExactZero = (model: X4UiCallModel, value: unknown): boolean => {
  const node = localAstNode(value);
  const range = node ? sourceAstRange(node) : undefined;
  const source = node && range ? localAstSource(model, node) : undefined;
  return Boolean(node
    && node.type === 'NumericLiteral'
    && node.value === 0
    && range
    && source
    && sourceLocationMatchesModel(model, source, model.file.text.slice(range[0], range[1])));
};

const localAstNodeAt = (
  index: NumericExpressionSourceAstIndex,
  source: X4UiSourceLocation,
  type: string,
): readonly NumericExpressionSourceAstNode[] => (index.nodesByRange.get(sourceAstRangeKey(
  source.start.offset,
  source.end.offset,
)) || []).filter(node => node.type === type);

type LocalScaleFontGlobalAuthority = 'pcall' | 'type' | 'Helper' | 'rawget';

const localAstGlobalEnvironment = (value: unknown): boolean =>
  localAstIdentifier(value, '_G', false) || localAstIdentifier(value, '_ENV', false);

const localAstReplacesGlobalEnvironment = (value: unknown): boolean =>
  localAstIdentifier(value, '_ENV');

const localAstMayWriteGlobalAuthority = (
  model: X4UiCallModel,
  value: unknown,
  name: LocalScaleFontGlobalAuthority,
): boolean => {
  const node = localAstNode(value);
  if (!node) return false;
  if (localAstIdentifier(node, name, false)) return true;
  if (!localAstGlobalEnvironment(node.base)) return false;
  if (node.type === 'MemberExpression' && node.indexer === '.') {
    return localAstIdentifier(node.identifier, name);
  }
  if (node.type !== 'IndexExpression') return false;
  const key = localAstStringValue(model, node.index);
  return key === undefined || key === name;
};

const localAstRawsetMayWriteGlobalAuthority = (
  model: X4UiCallModel,
  value: unknown,
  name: LocalScaleFontGlobalAuthority,
): boolean => {
  const node = localAstNode(value);
  const args = node ? localAstNodes(node.arguments) : undefined;
  if (!node
    || node.type !== 'CallExpression'
    || !localAstIdentifier(node.base, 'rawset', false)
    || !args
    || args.length !== 3
    || !localAstGlobalEnvironment(args[0])) return false;
  const key = localAstStringValue(model, args[1]);
  return key === undefined || key === name;
};

const globalAuthorityAvailableAt = (
  model: X4UiCallModel,
  name: LocalScaleFontGlobalAuthority,
  useLocation: X4UiSourceLocation,
): boolean => {
  if (!modelSourceLocationIsExact(model, useLocation)) return false;
  const index = numericExpressionSourceAstIndex(model);
  if (index.error) return false;
  const seen = new Set<object>();
  for (const nodes of index.nodesByRange.values()) {
    for (const node of nodes) {
      if (seen.has(node as object)) continue;
      seen.add(node as object);
      const range = sourceAstRange(node);
      if (!range || range[0] >= useLocation.start.offset) continue;
      if (node.type === 'AssignmentStatement') {
        const variables = localAstNodes(node.variables);
        if (variables?.some(variable => localAstReplacesGlobalEnvironment(variable)
          || localAstMayWriteGlobalAuthority(model, variable, name))) return false;
      } else if (node.type === 'LocalStatement') {
        const variables = localAstNodes(node.variables);
        if (variables?.some(localAstReplacesGlobalEnvironment)) return false;
      } else if (node.type === 'FunctionDeclaration'
        && node.isLocal === false
        && localAstMayWriteGlobalAuthority(model, node.identifier, name)) {
        return false;
      } else if (localAstRawsetMayWriteGlobalAuthority(model, node, name)) {
        return false;
      }
    }
  }
  return true;
};

const exactHelperReceiverIdentity = (
  model: X4UiCallModel,
  receiver: unknown,
  receiverSource: X4UiSourceLocation,
): boolean => {
  const receiverNode = localAstNode(receiver);
  if (!localAstIdentifier(receiverNode, 'Helper')
    || !sourceLocationMatchesModel(model, receiverSource, 'Helper')) return false;
  if (receiverNode?.isLocal === false) {
    return !model.helperReceiverAliases.some(alias => alias.name === 'Helper'
      && alias.targetSource.start.offset <= receiverSource.start.offset
      && locationContains(alias.context.source, receiverSource));
  }
  if (receiverNode?.isLocal !== true) return false;
  return activeHelperReceiverAliasAuthority(model, 'Helper', receiverSource) !== undefined;
};

const exactLocalScaleFontWrapperSource = (
  model: X4UiCallModel,
  declaration: X4UiLocalFunctionDeclaration,
  consumedInvocationSource: X4UiSourceLocation,
): X4UiSourceLocation | undefined => {
  const index = numericExpressionSourceAstIndex(model);
  if (index.error || !sourceLocationMatchesModel(model, declaration.source, model.file.text.slice(
    declaration.source.start.offset,
    declaration.source.end.offset,
  )) || !modelSourceLocationIsExact(model, consumedInvocationSource)) return undefined;
  const declarationNodes = localAstNodeAt(index, declaration.source, 'FunctionDeclaration');
  if (declarationNodes.length !== 1) return undefined;
  const functionNode = declarationNodes[0];
  if (functionNode.isLocal !== true
    || !localAstIdentifier(functionNode.identifier, declaration.name, true)) return undefined;
  const parameters = localAstNodes(functionNode.parameters);
  const body = localAstNodes(functionNode.body);
  if (!parameters || !body || declaration.parameters.length !== 1 || parameters.length !== 1 || body.length !== 3) return undefined;
  const parameter = declaration.parameters[0];
  const parameterNode = parameters[0];
  const parameterRange = sourceAstRange(parameterNode);
  if (!parameter
    || !localAstIdentifier(parameterNode, parameter.name, true)
    || !parameterRange
    || parameterRange[0] !== parameter.source.start.offset
    || parameterRange[1] !== parameter.source.end.offset
    || !sourceLocationMatchesModel(model, parameter.source, parameter.name)) return undefined;
  // This matcher proves only the exact three-statement wrapper shape.  The
  // parameter cannot reuse either declared result name because the AST does
  // not provide a stronger lexical-binding proof for that collision.
  if (parameter.name === 'ok' || parameter.name === 'v') return undefined;

  const localStatement = localAstNode(body[0]);
  const localVariables = localStatement ? localAstNodes(localStatement.variables) : undefined;
  const localInitializers = localStatement ? localAstNodes(localStatement.init) : undefined;
  if (!localStatement
    || localStatement.type !== 'LocalStatement'
    || !localVariables
    || !localInitializers
    || localVariables.length !== 2
    || localInitializers.length !== 1
    || !localAstIdentifier(localVariables[0], 'ok', true)
    || !localAstIdentifier(localVariables[1], 'v', true)) return undefined;

  const protectedCallStatement = localAstNode(localInitializers[0]);
  const protectedCallArguments = protectedCallStatement ? localAstNodes(protectedCallStatement.arguments) : undefined;
  const callback = protectedCallArguments?.length === 1 ? localAstNode(protectedCallArguments[0]) : undefined;
  const callbackBody = callback ? localAstNodes(callback.body) : undefined;
  const callbackReturn = callbackBody?.length === 1 ? localAstNode(callbackBody[0]) : undefined;
  const callbackReturnArguments = callbackReturn ? localAstNodes(callbackReturn.arguments) : undefined;
  const protectedCall = callbackReturnArguments?.length === 1 ? localAstNode(callbackReturnArguments[0]) : undefined;
  const protectedCallBase = protectedCall ? localAstNode(protectedCall.base) : undefined;
  const protectedCallReceiver = protectedCallBase ? localAstNode(protectedCallBase.base) : undefined;
  const protectedCallCallee = protectedCallBase ? localAstNode(protectedCallBase.identifier) : undefined;
  const protectedCallArgumentsExact = protectedCall ? localAstNodes(protectedCall.arguments) : undefined;
  const protectedCallArgument = protectedCallArgumentsExact?.[1];
  const protectedCallReceiverSource = protectedCallReceiver ? localAstSource(model, protectedCallReceiver) : undefined;
  const protectedCallArgumentSource = protectedCallArgument ? localAstSource(model, protectedCallArgument) : undefined;
  if (!protectedCallStatement
    || protectedCallStatement.type !== 'CallExpression'
    || !localAstIdentifier(protectedCallStatement.base, 'pcall', false)
    || protectedCallStatement.isLocal !== undefined
    || !callback
    || callback.type !== 'FunctionDeclaration'
    || callback.identifier !== null
    || localAstNodes(callback.parameters)?.length !== 0
    || !callbackReturn
    || callbackReturn.type !== 'ReturnStatement'
    || !protectedCall
    || protectedCall.type !== 'CallExpression'
    || !protectedCallBase
    || protectedCallBase.type !== 'MemberExpression'
    || protectedCallBase.indexer !== '.'
    || !protectedCallReceiverSource
    || !exactHelperReceiverIdentity(model, protectedCallReceiver, protectedCallReceiverSource)
    || !localAstIdentifier(protectedCallCallee, 'scaleFont')
    || !protectedCallArgumentsExact
    || protectedCallArgumentsExact.length !== 2
    || !localAstExactString(model, protectedCallArgumentsExact[0], 'Zekton')
    || !localAstIdentifier(protectedCallArgument, parameter.name, true)
    || !protectedCallArgumentSource
    || !sourceLocationMatchesModel(model, protectedCallArgumentSource, parameter.name)) return undefined;
  if (!globalAuthorityAvailableAt(model, 'pcall', consumedInvocationSource)
    || !globalAuthorityAvailableAt(model, 'type', consumedInvocationSource)) return undefined;

  const ifStatement = localAstNode(body[1]);
  const clauses = ifStatement ? localAstNodes(ifStatement.clauses) : undefined;
  const clause = clauses?.length === 1 ? localAstNode(clauses[0]) : undefined;
  const condition = clause ? localAstNode(clause.condition) : undefined;
  const conditionLeft = condition ? localAstNode(condition.left) : undefined;
  const conditionRight = condition ? localAstNode(condition.right) : undefined;
  const typeCheck = conditionLeft ? localAstNode(conditionLeft.right) : undefined;
  const okTypeCall = typeCheck ? localAstNode(typeCheck.left) : undefined;
  const okTypeArguments = okTypeCall ? localAstNodes(okTypeCall.arguments) : undefined;
  const positiveGuard = conditionRight;
  const ifBody = clause ? localAstNodes(clause.body) : undefined;
  const guardReturn = ifBody?.length === 1 ? localAstNode(ifBody[0]) : undefined;
  const guardReturnArguments = guardReturn ? localAstNodes(guardReturn.arguments) : undefined;
  if (!ifStatement
    || ifStatement.type !== 'IfStatement'
    || ifStatement.elseBody !== undefined
    || !clauses
    || clauses.length !== 1
    || !clause
    || clause.type !== 'IfClause'
    || !condition
    || condition.type !== 'LogicalExpression'
    || condition.operator !== 'and'
    || !conditionLeft
    || conditionLeft.type !== 'LogicalExpression'
    || conditionLeft.operator !== 'and'
    || !localAstIdentifier(conditionLeft.left, 'ok', true)
    || !typeCheck
    || typeCheck.type !== 'BinaryExpression'
    || typeCheck.operator !== '=='
    || !okTypeCall
    || okTypeCall.type !== 'CallExpression'
    || !localAstIdentifier(okTypeCall.base, 'type', false)
    || !okTypeArguments
    || okTypeArguments.length !== 1
    || !localAstIdentifier(okTypeArguments[0], 'v', true)
    || !localAstExactString(model, typeCheck.right, 'number')
    || !positiveGuard
    || positiveGuard.type !== 'BinaryExpression'
    || positiveGuard.operator !== '>'
    || !localAstIdentifier(positiveGuard.left, 'v', true)
    || !localAstExactZero(model, positiveGuard.right)
    || !ifBody
    || ifBody.length !== 1
    || !guardReturn
    || guardReturn.type !== 'ReturnStatement'
    || !guardReturnArguments
    || guardReturnArguments.length !== 1
    || !localAstIdentifier(guardReturnArguments[0], 'v', true)) return undefined;

  const fallbackReturn = localAstNode(body[2]);
  const fallbackArguments = fallbackReturn ? localAstNodes(fallbackReturn.arguments) : undefined;
  if (!fallbackReturn
    || fallbackReturn.type !== 'ReturnStatement'
    || !fallbackArguments
    || fallbackArguments.length !== 1
    || !localAstIdentifier(fallbackArguments[0], parameter.name, true)) return undefined;
  return localAstSource(model, protectedCall);
};

const localScaleFontWrapperValuesFor = (
  model: X4UiCallModel,
  profile: X4UiLayoutProjectionProfile,
): ReadonlyMap<string, DirectScaleValue> => {
  const result = new Map<string, DirectScaleValue>();
  const index = numericExpressionSourceAstIndex(model);
  if (index.error) return result;
  const declarations = new Map((model.localFunctions || []).map(declaration => [declaration.id, declaration]));
  for (const invocation of model.localInvocations || []) {
    if (invocation.status !== 'supported'
      || invocation.resolution !== 'direct'
      || !invocation.resultConsumed
      || !invocation.calleeDeclarationId
      || invocation.context.reachability !== 'reachable'
      || invocation.context.branchPath.length > 0
      || invocation.context.loopPath.length > 0
      || invocation.arguments.length !== 1) continue;
    const declaration = declarations.get(invocation.calleeDeclarationId);
    const argument = invocation.arguments[0];
    if (!declaration
      || !directLiteralArgument(argument)
      || argument.type !== 'number'
      || !isFiniteNumber(argument.value)) continue;
    const invocationNodes = localAstNodeAt(index, invocation.source, 'CallExpression');
    if (invocationNodes.length !== 1) continue;
    const invocationNode = invocationNodes[0];
    const invocationArguments = localAstNodes(invocationNode.arguments);
    const invocationBase = localAstNode(invocationNode.base);
    const argumentNode = invocationArguments?.length === 1 ? invocationArguments[0] : undefined;
    const argumentRange = argumentNode ? sourceAstRange(argumentNode) : undefined;
    if (!localAstIdentifier(invocationBase, invocation.calleeExpression, true)
      || !invocationArguments
      || invocationArguments.length !== 1
      || !argumentRange
      || argumentRange[0] !== argument.location.start.offset
      || argumentRange[1] !== argument.location.end.offset
      || !sourceLocationMatchesModel(model, argument.location, model.file.text.slice(
        argument.location.start.offset,
        argument.location.end.offset,
      ))) continue;
    const protectedCallSource = exactLocalScaleFontWrapperSource(model, declaration, invocation.source);
    const helperAuthority = activeHelperReceiverAliasAuthority(model, 'Helper', invocation.source);
    if (!protectedCallSource
      || !helperAuthority?.callSource
      || !globalAuthorityAvailableAt(model, 'Helper', helperAuthority.callSource)
      || !globalAuthorityAvailableAt(model, 'rawget', helperAuthority.callSource)) continue;
    const scaled = scaleFont('Zekton', argument.value, profile.metrics.uiScale);
    const output = scaled.status === 'ok' && isFiniteNumber(scaled.value) && scaled.value > 0
      ? scaled.value
      : argument.value;
    if (!isFiniteNumber(output)) continue;
    result.set(invocation.id, {
      value: output,
      kind: 'scaleFont',
      source: cloneLocation(protectedCallSource),
      instanceScope: '',
    });
  }
  return result;
};

const instantiateCall = (
  call: X4UiCallRecord,
  context: X4UiFunctionContext,
  instance: NonNullable<ProjectableCall['expansionInstance']>,
  parameterBindings: ReadonlyMap<string, X4UiValue>
): ProjectableCall => {
  const prefix = `@local-instance:${instance.ancestry.join('>')}`;
  const transformed = instantiateTree(call, prefix, parameterBindings) as ProjectableCall;
  const result: ProjectableCall = {
    ...transformed,
    ...(call.result ? { result: instantiateReference(call.result, prefix, parameterBindings) } : {}),
    context: mergeExpansionContext(context, call.context),
    expansionInstance: instance
  };
  if (callDataFlowSatisfied(result)) delete result.semantics.dataFlow;
  return result;
};

const buildLocalExpansionPlan = (
  model: X4UiCallModel,
  identity: X4UiLayoutModelIdentity,
  target: X4UiLayoutTarget,
  limits: NonNullable<X4UiLayoutProjectionProfile['localExpansion']>,
  previewPaths: NormalizedPreviewPaths
): LocalExpansionPlan => {
  const calls: ProjectableCall[] = [];
  const invocationLedger: MutableLocalInvocation[] = [];
  const gaps: X4UiLayoutGap[] = [];
  const contextSources = new Map<string, X4UiSourceLocation>([[locationKey(target.source), cloneLocation(target.source)]]);
  const declarations = new Map((model.localFunctions || []).map(declaration => [declaration.id, declaration]));
  const callsByContext = new Map<string, X4UiCallRecord[]>();
  const invocationsByContext = new Map<string, X4UiLocalFunctionInvocation[]>();
  for (const call of model.calls) {
    if (!call.context.source) continue;
    const key = locationKey(call.context.source);
    const list = callsByContext.get(key) || [];
    list.push(call);
    callsByContext.set(key, list);
  }
  for (const invocation of model.localInvocations || []) {
    if (!invocation.context.source) continue;
    const key = locationKey(invocation.context.source);
    const list = invocationsByContext.get(key) || [];
    list.push(invocation);
    invocationsByContext.set(key, list);
  }
  let expandedCount = 0;

  const recordInvocation = (
    invocation: X4UiLocalFunctionInvocation,
    ancestry: readonly string[],
    depth: number,
    status: X4UiLayoutLocalInvocationStatus,
    selectionIds: readonly string[],
    reason?: string
  ): MutableLocalInvocation => {
    const item: MutableLocalInvocation = {
      id: programId('local-invocation-instance', `${identity.sha256}|${ancestry.join('>')}`),
      sourceInvocationId: invocation.id,
      ...(invocation.calleeDeclarationId ? { calleeDeclarationId: invocation.calleeDeclarationId } : {}),
      source: cloneLocation(invocation.source),
      ancestry: [...ancestry],
      depth,
      status,
      resultConsumed: invocation.resultConsumed,
      ...(invocation.resolution ? { resolution: invocation.resolution } : {}),
      previewPathSelectionIds: [...selectionIds],
      operationIds: [],
      ...(reason ? { reason } : {})
    };
    invocationLedger.push(item);
    if (status !== 'expanded') {
      addGap(gaps, {
        category: status === 'conditional' ? 'preview-path' : 'local-expansion',
        status: status === 'unreachable' || status === 'looped' || status === 'conditional' ? 'incomplete' : 'refused',
        reason: reason || `local invocation was ${status}`,
        expression: invocation.calleeExpression,
        source: invocation.source
      });
    }
    return item;
  };

  const expandContext = (
    contextSource: X4UiSourceLocation,
    parentContext: X4UiFunctionContext | undefined,
    parameterBindings: ReadonlyMap<string, X4UiValue>,
    ancestry: readonly string[],
    stack: readonly string[],
    owner?: MutableLocalInvocation
  ): { callList: ProjectableCall[]; fatal?: string } => {
    const events: Array<{ sourceOrder: number; kind: 'call'; call: X4UiCallRecord } | {
      sourceOrder: number;
      kind: 'invocation';
      invocation: X4UiLocalFunctionInvocation;
    }> = [
      ...(callsByContext.get(locationKey(contextSource)) || []).map(call => ({ sourceOrder: call.sourceOrder, kind: 'call' as const, call })),
      // Expansion starts only after the complete invocation expression. This
      // keeps nested direct Helper.scale* argument calls ahead of callee UI
      // effects while retaining each record's canonical source range/order.
      ...(invocationsByContext.get(locationKey(contextSource)) || []).map(invocation => ({
        sourceOrder: invocation.source.end.offset,
        kind: 'invocation' as const,
        invocation
      }))
    ].sort((left, right) => left.sourceOrder - right.sourceOrder
      || (left.kind === right.kind ? 0 : left.kind === 'invocation' ? -1 : 1));
    const localCalls: ProjectableCall[] = [];
    for (const event of events) {
      if (event.kind === 'call') {
        if (!owner) {
          localCalls.push(event.call);
        } else {
          const selectedBoundaryIds = owner.previewPathSelectionIds
            .map(id => previewPaths.ordered.find(selection => selection.id === id)?.boundaryId)
            .filter((id): id is string => Boolean(id));
          const instance = {
            invocationId: owner.id,
            ancestry: owner.ancestry,
            depth: owner.depth,
            previewPathSelectionIds: owner.previewPathSelectionIds,
            selectedBoundaryIds
          };
          localCalls.push(instantiateCall(event.call, parentContext!, instance, parameterBindings));
        }
        continue;
      }

      const originalInvocation = event.invocation;
      const effectiveContext = mergeExpansionContext(parentContext, originalInvocation.context);
      const currentPrefix = owner ? `@local-instance:${owner.ancestry.join('>')}` : '';
      const invocationArgs = originalInvocation.arguments.map(argument =>
        instantiateValue(argument, currentPrefix, parameterBindings));
      const invocation: X4UiLocalFunctionInvocation = {
        ...originalInvocation,
        arguments: invocationArgs,
        context: effectiveContext
      };
      const nextAncestry = [...ancestry, invocation.id];
      const depth = stack.length + 1;
      const selectedIds: string[] = [];
      if (effectiveContext.reachability === 'unreachable'
        || effectiveContext.branchPath.some(segment => segment.reachability === 'unreachable')) {
        recordInvocation(invocation, nextAncestry, depth, 'unreachable', selectedIds, 'statically unreachable local invocation was recorded but not expanded');
        continue;
      }
      if (effectiveContext.loopPath.length > 0) {
        recordInvocation(invocation, nextAncestry, depth, 'looped', selectedIds, 'looped local invocation was recorded but loops are never replayed');
        continue;
      }
      let branchBlockedReason: string | undefined;
      for (const segment of effectiveContext.branchPath) {
        const selected = previewPaths.byBoundary.get(segment.boundaryId);
        if (!selected) {
          branchBlockedReason = `conditional invocation requires preview selection for boundary ${segment.boundaryId}`;
          break;
        }
        if (selected.armId !== segment.armId) {
          branchBlockedReason = `a different preview arm is selected for boundary ${segment.boundaryId}`;
          break;
        }
        selectedIds.push(selected.id);
      }
      if (effectiveContext.reachability === 'conditional' && effectiveContext.branchPath.length === 0) {
        branchBlockedReason = 'conditional invocation has no exact selectable branch boundary';
      }
      if (branchBlockedReason) {
        recordInvocation(invocation, nextAncestry, depth, 'conditional', selectedIds, branchBlockedReason);
        continue;
      }
      if (invocation.status !== 'supported' || !invocation.calleeDeclarationId) {
        recordInvocation(invocation, nextAncestry, depth, 'rejected', selectedIds, invocation.reason || 'local invocation identity is unsupported');
        continue;
      }
      const declaration = declarations.get(invocation.calleeDeclarationId);
      if (!declaration) {
        recordInvocation(invocation, nextAncestry, depth, 'rejected', selectedIds, 'callee declaration identity is absent from this call model');
        continue;
      }
      if (stack.includes(declaration.id)) {
        const reason = `recursive local-helper cycle detected at ${declaration.id}`;
        recordInvocation(invocation, nextAncestry, depth, 'rejected', selectedIds, reason);
        if (owner) return { callList: [], fatal: reason };
        continue;
      }
      if (depth > limits.maxDepth) {
        const reason = `local-helper expansion depth ${depth} exceeds maxDepth ${limits.maxDepth}`;
        recordInvocation(invocation, nextAncestry, depth, 'rejected', selectedIds, reason);
        if (owner) return { callList: [], fatal: reason };
        continue;
      }
      if (expandedCount + 1 > limits.maxInvocations) {
        const reason = `expanded invocation count would exceed maxInvocations ${limits.maxInvocations}`;
        recordInvocation(invocation, nextAncestry, depth, 'rejected', selectedIds, reason);
        if (owner) return { callList: [], fatal: reason };
        continue;
      }
      if (invocation.arguments.length !== declaration.parameters.length) {
        const reason = `local helper arity mismatch: expected ${declaration.parameters.length}, received ${invocation.arguments.length}`;
        recordInvocation(invocation, nextAncestry, depth, 'rejected', selectedIds, reason);
        continue;
      }
      const receiverParameters = parameterReceiverIds(declaration, model.calls);
      let bindingReason: string | undefined;
      for (const parameter of declaration.parameters) {
        const argument = invocation.arguments[parameter.index];
        if (!argument) {
          bindingReason = `missing argument for exact parameter ${parameter.id}`;
          break;
        }
        if (receiverParameters.has(parameter.id)) {
          if (!objectOwnershipArgument(argument)) {
            bindingReason = `parameter ${parameter.id} requires a direct frame/table/row/cell ownership argument`;
            break;
          }
        } else if (argument.status === 'static'
          && !directLiteralArgument(argument)
          && !objectOwnershipArgument(argument)) {
          bindingReason = `parameter ${parameter.id} static argument is not a direct scalar literal or accepted object identity`;
          break;
        } else if (argument.type === 'table' || argument.type === 'function' || argument.type === 'nil') {
          bindingReason = `parameter ${parameter.id} argument type ${argument.type} is outside bounded scalar/object binding`;
          break;
        }
      }
      if (bindingReason) {
        recordInvocation(invocation, nextAncestry, depth, 'rejected', selectedIds, bindingReason);
        continue;
      }
      expandedCount += 1;
      const ledger = recordInvocation(invocation, nextAncestry, depth, 'expanded', selectedIds);
      if (selectedIds.length > 0) {
        addGap(gaps, {
          category: 'preview-path',
          status: 'incomplete',
          reason: 'selected conditional local invocation is preview-only and does not change source reachability',
          expression: invocation.calleeExpression,
          source: invocation.source
        });
      }
      const childBindings = new Map<string, X4UiValue>();
      for (const parameter of declaration.parameters) childBindings.set(parameter.id, invocation.arguments[parameter.index]);
      contextSources.set(locationKey(declaration.source), cloneLocation(declaration.source));
      const beforeCount = expandedCount;
      const descendantLedgerStart = invocationLedger.length;
      const child = expandContext(
        declaration.source,
        effectiveContext,
        childBindings,
        nextAncestry,
        [...stack, declaration.id],
        ledger
      );
      if (child.fatal) {
        expandedCount = beforeCount - 1;
        for (const discarded of invocationLedger.slice(descendantLedgerStart)) {
          if (discarded.status !== 'expanded') continue;
          discarded.status = 'rejected';
          discarded.reason = `discarded with containing subtree: ${child.fatal}`;
          addGap(gaps, {
            category: 'local-expansion',
            status: 'refused',
            reason: discarded.reason,
            source: discarded.source
          });
        }
        ledger.status = 'rejected';
        ledger.reason = child.fatal;
        addGap(gaps, {
          category: 'local-expansion',
          status: 'refused',
          reason: child.fatal,
          expression: invocation.calleeExpression,
          source: invocation.source
        });
        if (owner) return { callList: [], fatal: child.fatal };
        continue;
      }
      localCalls.push(...child.callList);
    }
    return { callList: localCalls };
  };

  const root = expandContext(target.source, undefined, new Map(), [target.id], [], undefined);
  calls.push(...root.callList);
  return { calls, invocations: invocationLedger, gaps, contextSources: [...contextSources.values()] };
};

const makeOperation = (call: ProjectableCall, status: X4UiLayoutOperationStatus, reason?: string): MutableOperation => ({
  id: operationIdFor(call),
  kind: call.name,
  source: cloneLocation(call.source),
  sourceOrder: call.source.start.offset,
  modelOrder: call.order,
  status,
  metadata: cloneMetadata(call),
  descriptorFacts: {},
  ...(call.expansionInstance ? {
    localExpansion: {
      invocationId: call.expansionInstance.invocationId,
      ancestry: [...call.expansionInstance.ancestry],
      depth: call.expansionInstance.depth,
      previewPathSelectionIds: [...call.expansionInstance.previewPathSelectionIds]
    }
  } : {}),
  ...(reason ? { reason } : {}),
});

const evidenceReachabilityFor = (call: ProjectableCall): X4UiLayoutEvidenceReachability => {
  const blocked = isCallReachabilityBlocked(call);
  return blocked === 'unreachable' ? 'unreachable' : blocked === 'conditional' ? 'conditional' : 'reachable';
};

const cloneEvidenceGap = (gap: X4UiLayoutGap): X4UiLayoutEvidenceGap => ({
  category: gap.category,
  status: gap.status,
  reason: gap.reason,
  ...(gap.expression !== undefined ? { expression: gap.expression } : {}),
  source: cloneLocation(gap.source),
  ...(Object.prototype.hasOwnProperty.call(gap, 'operationId') ? { operationId: gap.operationId } : {}),
  ...(Object.prototype.hasOwnProperty.call(gap, 'nodeId') ? { nodeId: gap.nodeId } : {}),
});

const evidenceExpansionLinkFor = (
  call: ProjectableCall,
  localExpansion: X4UiLayoutLocalExpansionState | undefined,
): X4UiLayoutEvidenceExpansionLink | undefined => {
  if (!call.expansionInstance) return undefined;
  const invocation = localExpansion?.invocations.find(candidate => candidate.id === call.expansionInstance!.invocationId);
  if (!invocation) throw new Error(`missing local expansion invocation for call ${operationIdFor(call)}`);
  return {
    invocationInstanceId: call.expansionInstance.invocationId,
    sourceInvocationId: invocation.sourceInvocationId,
    ancestry: [...call.expansionInstance.ancestry],
    depth: call.expansionInstance.depth,
    selectionIds: [...call.expansionInstance.previewPathSelectionIds],
    catalogId: localExpansion!.previewPathCatalog.id,
  };
};

const cloneEvidenceExpansion = (
  localExpansion: X4UiLayoutLocalExpansionState | undefined,
): X4UiLayoutEvidenceExpansion | undefined => {
  if (!localExpansion) return undefined;
  return {
    limits: cloneDeep(localExpansion.limits) as NonNullable<X4UiLayoutProjectionProfile['localExpansion']>,
    catalog: cloneDeep(localExpansion.previewPathCatalog) as X4UiLayoutPreviewPathCatalog,
    selections: cloneDeep(localExpansion.previewPathSelections) as X4UiLayoutPreviewPathSelectionBinding[],
    invocations: localExpansion.invocations.map(invocation => ({
      id: invocation.id,
      sourceInvocationId: invocation.sourceInvocationId,
      ...(invocation.calleeDeclarationId ? { calleeDeclarationId: invocation.calleeDeclarationId } : {}),
      source: cloneLocation(invocation.source),
      ancestry: [...invocation.ancestry],
      depth: invocation.depth,
      status: invocation.status,
      resultConsumed: invocation.resultConsumed,
      ...(invocation.resolution !== undefined
        ? { resolution: cloneDeep(invocation.resolution) as X4UiLocalFunctionInvocation['resolution'] }
        : {}),
      previewPathSelectionIds: [...invocation.previewPathSelectionIds],
      operationIds: [...invocation.operationIds],
      ...(invocation.reason ? { reason: invocation.reason } : {}),
    })),
  };
};

const buildEvidenceNodeLedgers = (
  events: readonly EvidenceNodeLedgerEvent[],
  frames: readonly X4UiLayoutFrameNode[],
  tables: readonly X4UiLayoutTableNode[],
  rows: readonly X4UiLayoutRowNode[],
  cells: readonly X4UiLayoutCellNode[],
): X4UiLayoutEvidenceNodeLedgers => {
  type EvidenceNodeSnapshot =
    | X4UiLayoutFrameNode
    | X4UiLayoutTableNode
    | X4UiLayoutRowNode
    | X4UiLayoutCellNode;
  type MutableEvidenceNodeLedger = {
    id: string;
    operationIds: string[];
    metadataOperationIds?: string[];
    snapshot: EvidenceNodeSnapshot;
  };
  const snapshots: Record<EvidenceNodeKind, ReadonlyMap<string, EvidenceNodeSnapshot>> = {
    frame: new Map(frames.map(node => [node.id, node] as const)),
    table: new Map(tables.map(node => [node.id, node] as const)),
    row: new Map(rows.map(node => [node.id, node] as const)),
    cell: new Map(cells.map(node => [node.id, node] as const)),
  };
  const ledgers: Record<EvidenceNodeKind, MutableEvidenceNodeLedger[]> = {
    frame: [],
    table: [],
    row: [],
    cell: [],
  };
  const byKindAndId = new Map<string, MutableEvidenceNodeLedger>();
  for (const event of events) {
    const key = `${event.kind}|${event.nodeId}`;
    if (event.ledger === 'node') {
      if (byKindAndId.has(key)) throw new Error(`duplicate evidence node ${key}`);
      const snapshot = snapshots[event.kind].get(event.nodeId);
      if (!snapshot) throw new Error(`evidence node snapshot is missing for ${key}`);
      const ledger: MutableEvidenceNodeLedger = {
        id: event.nodeId,
        operationIds: [],
        ...(event.kind === 'cell' ? { metadataOperationIds: [] } : {}),
        snapshot: cloneJsonLike(snapshot) as EvidenceNodeSnapshot,
      };
      ledgers[event.kind].push(ledger);
      byKindAndId.set(key, ledger);
      continue;
    }
    if (!event.operationId) throw new Error(`evidence node operation event is missing an operation ID for ${key}`);
    const ledger = byKindAndId.get(key);
    if (!ledger) throw new Error(`evidence node operation event precedes node creation for ${key}`);
    if (event.ledger === 'operationIds') {
      ledger.operationIds.push(event.operationId);
    } else {
      if (event.kind !== 'cell' || ledger.metadataOperationIds === undefined) {
        throw new Error(`metadata evidence ledger is only valid for cells: ${key}`);
      }
      ledger.metadataOperationIds.push(event.operationId);
    }
  }
  for (const kind of ['frame', 'table', 'row', 'cell'] as const) {
    for (const ledger of ledgers[kind]) {
      ledger.operationIds = [...ledger.snapshot.operationIds];
      if (kind === 'cell' && ledger.metadataOperationIds !== undefined) {
        ledger.metadataOperationIds = [
          ...((ledger.snapshot as X4UiLayoutCellNode).metadataOperationIds || []),
        ];
      }
    }
  }
  return {
    frames: ledgers.frame,
    tables: ledgers.table,
    rows: ledgers.row,
    cells: ledgers.cell,
  };
};

const buildEvidenceLocalIdentities = (
  model: X4UiCallModel,
): X4UiLayoutEvidenceLocalIdentities => {
  const orderedInvocations = [...model.localInvocations].sort((left, right) =>
    left.source.start.offset - right.source.start.offset
      || left.source.end.offset - right.source.end.offset
      || left.id.localeCompare(right.id));
  return {
    functions: model.localFunctions.map(declaration => ({
      id: declaration.id,
      source: cloneLocation(declaration.source),
      parameters: cloneDeep(declaration.parameters) as X4UiLocalFunctionParameterIdentity[],
    })),
    invocations: orderedInvocations.map(invocation => ({
      id: invocation.id,
      source: cloneLocation(invocation.source),
      expression: model.file.text.slice(invocation.source.start.offset, invocation.source.end.offset),
      ...(invocation.calleeDeclarationId ? { calleeDeclarationId: invocation.calleeDeclarationId } : {}),
    })),
  };
};

const buildEvidenceAuthority = (
  target: X4UiLayoutTarget,
  profile: X4UiLayoutProjectionProfile,
  model: X4UiCallModel,
  targetCalls: readonly ProjectableCall[],
  operationEvents: readonly EvidenceOperationEvent[],
  nodeLedgerEvents: readonly EvidenceNodeLedgerEvent[],
  gapEvents: readonly X4UiLayoutGap[],
  frames: readonly X4UiLayoutFrameNode[],
  tables: readonly X4UiLayoutTableNode[],
  rows: readonly X4UiLayoutRowNode[],
  cells: readonly X4UiLayoutCellNode[],
  localExpansion?: X4UiLayoutLocalExpansionState,
): X4UiLayoutEvidenceAuthority => {
  const relevantCalls = targetCalls.filter(call => EVIDENCE_RELEVANT_CALL_NAMES.includes(call.name));
  if (relevantCalls.length !== operationEvents.length) {
    throw new Error('evidence operation append events do not cover the selected call stream exactly');
  }
  const calls: X4UiLayoutEvidenceCall[] = [];
  const authorityOperations: X4UiLayoutEvidenceOperation[] = [];
  const sourceBindings: X4UiLayoutEvidenceSourceBinding[] = [];
  for (const [streamIndex, call] of relevantCalls.entries()) {
    const event = operationEvents[streamIndex];
    const operation = event.operation;
    const operationId = operationIdFor(call);
    if (event.call !== call || operation.id !== operationId) {
      throw new Error(`evidence operation append event does not match selected call ${operationId}`);
    }
    const expansion = evidenceExpansionLinkFor(call, localExpansion);
    const callId = evidenceCallIdFor(call);
    calls.push({
      id: callId,
      operationId,
      kind: call.name,
      source: cloneLocation(call.source),
      sourceOrder: call.source.start.offset,
      modelOrder: call.order,
      streamIndex,
      status: operation.status,
      reachability: evidenceReachabilityFor(call),
      ...(expansion ? { expansion: cloneDeep(expansion) as X4UiLayoutEvidenceExpansionLink } : {}),
    });
    sourceBindings.push({
      id: evidenceSourceBindingIdFor(operationId),
      callId,
      operationId,
      kind: call.name,
      source: cloneLocation(call.source),
      sourceOrder: call.source.start.offset,
      modelOrder: call.order,
      streamIndex,
      reachability: evidenceReachabilityFor(call),
      metadata: cloneJsonLike(operation.metadata) as X4UiLayoutCallMetadata,
      ...(expansion ? { expansion: cloneDeep(expansion) as X4UiLayoutEvidenceExpansionLink } : {}),
    });
    authorityOperations.push({
      id: operation.id,
      callId,
      kind: call.name,
      source: cloneLocation(call.source),
      sourceOrder: call.source.start.offset,
      modelOrder: call.order,
      streamIndex,
      status: operation.status,
      ...(operation.frameId ? { frameId: operation.frameId } : {}),
      ...(operation.tableId ? { tableId: operation.tableId } : {}),
      ...(operation.rowId ? { rowId: operation.rowId } : {}),
      ...(operation.cellId ? { cellId: operation.cellId } : {}),
      ...(operation.reason ? { reason: operation.reason } : {}),
      ...(expansion ? { expansion: cloneDeep(expansion) as X4UiLayoutEvidenceExpansionLink } : {}),
      snapshot: cloneJsonLike(operation) as X4UiLayoutOperation,
    });
  }
  const authorityGaps = gapEvents.map(cloneEvidenceGap);
  const linkedGapIndexes = authorityGaps
    .map((gap, index) => gap.operationId !== undefined ? index : undefined)
    .filter((index): index is number => index !== undefined);
  const unlinkedGapIndexes = authorityGaps
    .map((gap, index) => gap.operationId === undefined ? index : undefined)
    .filter((index): index is number => index !== undefined);
  return freezeDeep({
    version: 3 as const,
    sourceIdentity: cloneDeep(profile.source) as X4UiLayoutModelIdentity,
    profile: cloneDeep(profile) as X4UiLayoutProjectionProfile,
    targetId: target.id,
    targetSource: cloneLocation(target.source),
    calls,
    operations: authorityOperations,
    sourceBindings,
    nodes: buildEvidenceNodeLedgers(nodeLedgerEvents, frames, tables, rows, cells),
    localIdentities: buildEvidenceLocalIdentities(model),
    gaps: authorityGaps,
    linkedGapIndexes,
    unlinkedGapIndexes,
    ...(localExpansion ? { expansion: cloneEvidenceExpansion(localExpansion) } : {}),
  });
};

const tableReference = (call: X4UiCallRecord): X4UiValueReference | undefined =>
  call.semantics.table?.reference || (call.receiver?.reference?.kind === 'table' ? call.receiver.reference : undefined);

const frameReference = (call: X4UiCallRecord): X4UiValueReference | undefined =>
  call.semantics.frame?.reference || (call.receiver?.reference?.kind === 'frame' ? call.receiver.reference : undefined);

const cellReference = (call: X4UiCallRecord): X4UiValueReference | undefined =>
  call.semantics.cell?.reference || (call.receiver?.reference?.kind === 'cell' ? call.receiver.reference : undefined);

const setOperationLinks = (
  operation: MutableOperation,
  links: { frameId?: string; tableId?: string; rowId?: string; cellId?: string },
): void => {
  if (links.frameId) operation.frameId = links.frameId;
  if (links.tableId) operation.tableId = links.tableId;
  if (links.rowId) operation.rowId = links.rowId;
  if (links.cellId) operation.cellId = links.cellId;
};

const addOperationGap = (
  gaps: X4UiLayoutGap[],
  operation: MutableOperation,
  category: X4UiLayoutGapCategory,
  status: X4UiLayoutGapStatus,
  reason: string,
  source: X4UiSourceLocation,
  expression?: string,
  nodeId?: string,
  evidenceGaps?: X4UiLayoutGap[],
): void => addGap(gaps, {
  category,
  status,
  reason,
  source,
  operationId: operation.id,
  ...(expression ? { expression } : {}),
  ...(nodeId ? { nodeId } : {}),
}, evidenceGaps);

const addOperationGapToProgram = addOperationGap;

const stateResultTransition = (
  result: StateResult<HelperTableState>,
  before: HelperTableState,
): X4UiLayoutKernelTransition => result.status === 'ok'
  ? { stateBefore: before, stateAfter: result.value }
  : { stateBefore: before, stateAfter: result.state, refusal: result };

const mapRowForCell = (
  rows: MutableRow[],
  cell: X4UiValueReference,
  tableId: string,
  sourceOffset: number,
): MutableRow | undefined => {
  const parentPath = cell.parentPath;
  if (!parentPath) return undefined;
  const candidates = rows.filter(row => row.tableId === tableId
    && row.identity?.path === parentPath
    && (row.source.start.offset <= sourceOffset));
  return candidates.sort((left, right) => right.source.start.offset - left.source.start.offset)[0];
};

const makeBaseCells = (
  table: MutableTable,
  row: MutableRow,
  columnCount: number,
): MutableCell[] => {
  const result: MutableCell[] = [];
  for (let column = 1; column <= columnCount; column += 1) {
    const id = programId('cell', `${table.id}|${row.id}|${column}`);
    const source = cloneLocation(row.source);
    const scalingFact = row.descriptorFacts.scaling || knownDefaultFact(
      true,
      'boolean',
      source,
      HELPER_DEFAULT_PINS.baseCellScaling,
      'row.properties.scaling',
    );
    result.push({
      id,
      source,
      tableId: table.id,
      rowId: row.id,
      rowIndex: row.rowIndex,
      column,
      operationIds: [],
      metadataOperationIds: [],
      descriptorFacts: {
        contentKind: knownDefaultFact('cell', 'string', source, HELPER_DEFAULT_PINS.baseCellKind, '"cell"'),
        span: knownDefaultFact(1, 'number', source, HELPER_DEFAULT_PINS.baseCellSpan, '1'),
        outerX: knownDefaultFact(0, 'number', source, HELPER_DEFAULT_PINS.widgetX, '0'),
        outerY: knownDefaultFact(0, 'number', source, HELPER_DEFAULT_PINS.widgetY, '0'),
        outerWidth: unavailableFact('number', 'cell outer width is unavailable until columns are finalized', source),
        outerHeight: unavailableFact('number', 'cell outer height is unavailable until specialization/finalization', source),
        scaling: scalingFact,
        affectRowHeight: unavailableFact('boolean', 'base cells do not emit affectRowHeight descriptor data', source),
        hotkey: unavailableFact('string', 'base cell has no edit-box hotkey', source),
        displayIcon: unavailableFact('boolean', 'base cell has no edit-box hotkey icon flag', source),
        primaryContent: unavailableFact('string', 'base cell has no specialized primary content', source),
        text: unavailableFact('string', 'base cell has no text content', source),
        text2: unavailableFact('string', 'base cell has no secondary text content', source),
        font: unavailableFact('string', 'base cell has no text font property', source),
        fontsize: unavailableFact('number', 'base cell has no text font-size property', source),
        halign: unavailableFact('string', 'base cell has no text alignment property', source),
        wordwrap: unavailableFact('boolean', 'base cell has no text wrapping property', source),
        defaultText: unavailableFact('string', 'base cell has no edit-box default text', source),
        maxChars: unavailableFact('number', 'base cell has no edit-box maximum character count', source),
        selectTextOnActivation: unavailableFact('boolean', 'base cell has no edit-box selection behavior', source),
        icon: unavailableFact('string', 'base cell has no icon identity', source),
      },
      status: 'projected',
      hadGap: false,
      hadRefusal: false,
      missingHeight: false,
    });
  }
  return result;
};

const applyNodeStatus = (
  hadGap: boolean,
  hadRefusal: boolean,
  hasState: boolean,
): X4UiLayoutProjectionStatus => {
  if (!hasState) return 'refused';
  if (hadGap || hadRefusal) return 'partial';
  return 'projected';
};

const resultStatus = (
  tables: readonly MutableTable[],
  frames: readonly MutableFrame[],
  operations: readonly MutableOperation[],
  gaps: readonly X4UiLayoutGap[],
): X4UiLayoutProjectionStatus => {
  const hasState = tables.some(table => Boolean(table.kernelState));
  const hasApplied = operations.some(operation => operation.status === 'applied');
  const hasProblem = gaps.length > 0
    || operations.some(operation => operation.status !== 'applied')
    || frames.some(frame => frame.hadGap || frame.hadRefusal)
    || tables.some(table => table.hadGap || table.hadRefusal);
  if (!hasState && !hasApplied) return 'refused';
  return hasProblem ? 'partial' : 'projected';
};

const finishProgram = (
  status: X4UiLayoutProjectionStatus,
  target: X4UiLayoutTarget,
  profile: X4UiLayoutProjectionProfile,
  analysis: X4UiLayoutAnalysisState,
  frames: MutableFrame[],
  tables: MutableTable[],
  rows: MutableRow[],
  cells: MutableCell[],
  operations: MutableOperation[],
  gaps: X4UiLayoutGap[],
  sampleCatalog: X4UiLayoutPreviewSampleCatalog,
  previewSamples: NormalizedPreviewSamples,
  consumedSamples: ReadonlySet<string>,
  model: X4UiCallModel,
  targetCalls: readonly ProjectableCall[],
  operationEvents: readonly EvidenceOperationEvent[],
  nodeLedgerEvents: readonly EvidenceNodeLedgerEvent[],
  gapEvents: readonly X4UiLayoutGap[],
  localExpansion?: X4UiLayoutLocalExpansionState,
  colorEvidence?: X4UiCorpusCanonicalColorSuccess,
): X4UiLayoutProgramResult => {
  for (const frame of frames) {
    frame.status = applyNodeStatus(frame.hadGap, frame.hadRefusal, true);
  }
  for (const table of tables) {
    table.status = applyNodeStatus(table.hadGap, table.hadRefusal, Boolean(table.kernelState));
  }
  for (const row of rows) {
    row.status = applyNodeStatus(row.hadGap, row.hadRefusal, Boolean(row.kernelState));
  }
  for (const cell of cells) {
    cell.status = applyNodeStatus(cell.hadGap, cell.hadRefusal, Boolean(cell.kernelState));
  }
  const outputFrames = frames.map(frame => cloneJsonLike({
    id: frame.id,
    source: frame.source,
    ...(frame.identity ? { identity: frame.identity } : {}),
    ...(frame.width !== undefined ? { width: frame.width } : {}),
    ...(frame.height !== undefined ? { height: frame.height } : {}),
    ...(frame.widthSource ? { widthSource: frame.widthSource } : {}),
    ...(frame.heightSource ? { heightSource: frame.heightSource } : {}),
    frameTextureLayers: frame.frameTextureLayers,
    blurBackground: frame.blurBackground,
    tableIds: frame.tableIds,
    operationIds: frame.operationIds,
    descriptorFacts: frame.descriptorFacts,
    status: frame.status,
  }) as X4UiLayoutFrameNode);
  const outputTables = tables.map(table => cloneJsonLike({
    id: table.id,
    source: table.source,
    ...(table.identity ? { identity: table.identity } : {}),
    ...(table.frameId ? { frameId: table.frameId } : {}),
    ...(table.frameWidth !== undefined ? { frameWidth: table.frameWidth } : {}),
    ...(table.numColumns !== undefined ? { numColumns: table.numColumns } : {}),
    ...(table.requestedWidth !== undefined ? { requestedWidth: table.requestedWidth } : {}),
    rowIds: table.rowIds,
    operationIds: table.operationIds,
    ...(table.kernelState ? { kernelState: table.kernelState } : {}),
    ...(table.height ? { height: table.height } : {}),
    descriptorFacts: table.descriptorFacts,
    status: table.status,
  }) as X4UiLayoutTableNode);
  const outputRows = rows.map(row => cloneJsonLike({
    id: row.id,
    source: row.source,
    ...(row.identity ? { identity: row.identity } : {}),
    ...(row.tableId ? { tableId: row.tableId } : {}),
    ...(row.rowIndex !== undefined ? { rowIndex: row.rowIndex } : {}),
    cellIds: row.cellIds,
    operationIds: row.operationIds,
    ...(row.kernelState ? { kernelState: row.kernelState } : {}),
    ...(row.height ? { height: row.height } : {}),
    descriptorFacts: row.descriptorFacts,
    status: row.status,
  }) as X4UiLayoutRowNode);
  const outputCells = cells.map(cell => cloneJsonLike({
    id: cell.id,
    source: cell.source,
    ...(cell.identity ? { identity: cell.identity } : {}),
    ...(cell.tableId ? { tableId: cell.tableId } : {}),
    ...(cell.rowId ? { rowId: cell.rowId } : {}),
    ...(cell.rowIndex !== undefined ? { rowIndex: cell.rowIndex } : {}),
    column: cell.column,
    operationIds: cell.operationIds,
    metadataOperationIds: cell.metadataOperationIds,
    ...(cell.kernelState ? { kernelState: cell.kernelState } : {}),
    ...(cell.spanWidth ? { spanWidth: cell.spanWidth } : {}),
    ...(cell.height ? { height: cell.height } : {}),
    descriptorFacts: cell.descriptorFacts,
    status: cell.status,
  }) as X4UiLayoutCellNode);
  const outputOperations = cloneJsonLike(operations) as MutableOperation[];
  const outputGaps = cloneJsonLike(gaps) as X4UiLayoutGap[];
  const programLocalIdentities = buildEvidenceLocalIdentities(model);
  const program: X4UiLayoutProgram = {
    status,
    target: cloneDeep(target) as X4UiLayoutTarget,
    profile,
    analysis,
    localIdentities: programLocalIdentities,
    frames: outputFrames,
    tables: outputTables,
    rows: outputRows,
    cells: outputCells,
    operations: outputOperations,
    gaps: outputGaps,
    sampleCatalog,
    previewSampleBindings: previewSamples.ordered.map(sample => ({
      id: sample.entry.id,
      value: sample.value,
      expectedType: sample.entry.expectedType,
      source: sample.entry.source,
      provenance: 'preview-only',
      status: consumedSamples.has(sample.entry.id) ? 'consumed' : 'not-applied',
      ...(!consumedSamples.has(sample.entry.id)
        ? { reason: 'sample was valid but its conditional, unreachable, or unresolved owner was not applied' }
        : {}),
    })),
    ...(localExpansion ? { localExpansion } : {}),
    verification: { game: X4_UI_LAYOUT_GAME_TRUTH, gameVerified: false },
  };
  freezeDeep(program);
  const evidenceAuthority = buildEvidenceAuthority(
    target,
    profile,
    model,
    targetCalls,
    operationEvents,
    nodeLedgerEvents,
    gapEvents,
    program.frames,
    program.tables,
    program.rows,
    program.cells,
    localExpansion,
  );
  const result = freezeDeep({
    status,
    program,
    evidenceAuthority,
    verification: { game: X4_UI_LAYOUT_GAME_TRUTH, gameVerified: false as const },
  });
  if (status !== 'refused') {
    const validation = validateX4UiLayoutEvidencePair(result.program, result.evidenceAuthority);
    if (validation.valid === false) {
      return refusalResult(
        'malformed-profile',
        `projected layout evidence failed its own contract: ${validation.reason}`,
        model,
        target.source,
      );
    }
    issuedX4UiLayoutEvidenceAuthorities.set(result.program, Object.freeze({
      evidenceAuthority: result.evidenceAuthority,
      modelSnapshot: snapshotCompleteX4UiCallModel(model),
      ...(colorEvidence !== undefined ? { colorEvidence } : {}),
    }));
  }
  return result;
};

export type X4UiLayoutEvidenceValidationResult =
  | { readonly valid: true }
  | { readonly valid: false; readonly reason: string; readonly index?: number };

const exactKeys = (
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[] = [],
): boolean => required.every(key => Object.prototype.hasOwnProperty.call(value, key))
  && Object.keys(value).every(key => required.includes(key) || optional.includes(key));

const jsonEqual = (left: unknown, right: unknown): boolean => {
  const comparedPairs = new Map<object, Set<object>>();

  const compare = (leftValue: unknown, rightValue: unknown): boolean => {
    const leftType = typeof leftValue;
    const rightType = typeof rightValue;
    if (leftType !== rightType) return false;
    if (leftValue === null || rightValue === null) return leftValue === rightValue;
    if (leftType !== 'object') {
      return leftType !== 'function' && leftType !== 'symbol' && leftType !== 'bigint'
        && Object.is(leftValue, rightValue);
    }

    const leftObject = leftValue as object;
    const rightObject = rightValue as object;
    const pairedRightObjects = comparedPairs.get(leftObject);
    if (pairedRightObjects?.has(rightObject)) return true;

    const leftIsArray = Array.isArray(leftObject);
    if (leftIsArray !== Array.isArray(rightObject)) return false;
    if (leftIsArray && (leftObject as readonly unknown[]).length !== (rightObject as readonly unknown[]).length) {
      return false;
    }
    const leftPrototype = Object.getPrototypeOf(leftObject);
    const rightPrototype = Object.getPrototypeOf(rightObject);
    if (leftIsArray) {
      if (leftPrototype !== Array.prototype || rightPrototype !== Array.prototype) return false;
    } else {
      const leftIsPlain = leftPrototype === Object.prototype || leftPrototype === null;
      const rightIsPlain = rightPrototype === Object.prototype || rightPrototype === null;
      if (!leftIsPlain || !rightIsPlain) return false;
    }

    const leftKeys = Object.keys(leftObject).sort();
    const rightKeys = Object.keys(rightObject).sort();
    if (leftKeys.length !== rightKeys.length
      || leftKeys.some((key, index) => key !== rightKeys[index])) return false;

    if (pairedRightObjects) pairedRightObjects.add(rightObject);
    else comparedPairs.set(leftObject, new Set([rightObject]));
    for (const key of leftKeys) {
      if (!compare(
        (leftObject as Record<string, unknown>)[key],
        (rightObject as Record<string, unknown>)[key],
      )) return false;
    }
    return true;
  };

  try {
    return compare(left, right);
  } catch {
    return false;
  }
};

type ClosedSchemaError = string | undefined;

const schemaObject = (
  value: unknown,
  path: string,
  required: readonly string[],
  optional: readonly string[] = [],
): ClosedSchemaError => {
  if (!isObject(value)) return `${path} must be a record`;
  if (!exactKeys(value, required, optional)) return `${path} contains an unknown or missing key`;
  return undefined;
};

const schemaArray = (value: unknown, path: string): ClosedSchemaError =>
  Array.isArray(value) ? undefined : `${path} must be an array`;

const schemaString = (value: unknown, path: string, nonEmpty = false): ClosedSchemaError =>
  typeof value === 'string' && (!nonEmpty || value.length > 0) ? undefined : `${path} must be a string`;

const schemaBoolean = (value: unknown, path: string): ClosedSchemaError =>
  typeof value === 'boolean' ? undefined : `${path} must be a boolean`;

const schemaNumber = (value: unknown, path: string): ClosedSchemaError =>
  typeof value === 'number' && Number.isFinite(value) ? undefined : `${path} must be a finite number`;

const schemaIndex = (value: unknown, path: string): ClosedSchemaError =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? undefined
    : `${path} must be a safe non-negative integer`;

const schemaPositiveIndex = (value: unknown, path: string): ClosedSchemaError =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 1
    ? undefined
    : `${path} must be a positive safe integer`;

const schemaEnum = (value: unknown, path: string, values: readonly string[]): ClosedSchemaError =>
  typeof value === 'string' && values.includes(value) ? undefined : `${path} has an invalid value`;

const schemaOptional = (
  value: Record<string, unknown>,
  key: string,
  validate: (child: unknown, path: string) => ClosedSchemaError,
  path: string,
): ClosedSchemaError => Object.prototype.hasOwnProperty.call(value, key)
  ? validate(value[key], `${path}.${key}`)
  : undefined;

const closedJsonDomain = (value: unknown, path = 'value', active = new Set<object>()): ClosedSchemaError => {
  const type = typeof value;
  if (value === null || type === 'string' || type === 'boolean') return undefined;
  if (type === 'number') return Number.isFinite(value) ? undefined : `${path} must be finite`;
  if (type !== 'object') return `${path} is outside the JSON value domain`;
  const objectValue = value as object;
  if (active.has(objectValue)) return `${path} contains a cycle`;
  let prototype: object | null;
  try {
    prototype = Object.getPrototypeOf(objectValue);
    if (Object.getOwnPropertySymbols(objectValue).length > 0) return `${path} contains symbol keys`;
    if (Array.isArray(objectValue)) {
      if (prototype !== Array.prototype) return `${path} has a non-array prototype`;
      const arrayValue = objectValue as readonly unknown[];
      if (!Number.isSafeInteger(arrayValue.length) || arrayValue.length < 0) return `${path} has an invalid length`;
      const keys = Object.keys(objectValue);
      if (keys.length !== arrayValue.length || keys.some((key, index) => key !== String(index))) {
        return `${path} is sparse or has unknown enumerable keys`;
      }
      active.add(objectValue);
      for (let index = 0; index < arrayValue.length; index += 1) {
        const error = closedJsonDomain(arrayValue[index], `${path}[${index}]`, active);
        if (error) return error;
      }
      active.delete(objectValue);
      return undefined;
    }
    if (prototype !== Object.prototype && prototype !== null) return `${path} has a non-record prototype`;
    active.add(objectValue);
    for (const key of Object.keys(objectValue)) {
      const error = closedJsonDomain((objectValue as Record<string, unknown>)[key], `${path}.${key}`, active);
      if (error) return error;
    }
    active.delete(objectValue);
    return undefined;
  } catch {
    active.delete(objectValue);
    return `${path} is not a readable JSON value`;
  }
};

const schemaPosition = (value: unknown, path: string): ClosedSchemaError => {
  const objectError = schemaObject(value, path, ['line', 'column', 'offset']);
  if (objectError) return objectError;
  const position = value as Record<string, unknown>;
  return (typeof position.line === 'number' && Number.isSafeInteger(position.line) && position.line >= 1
    ? undefined
    : `${path}.line must be a positive safe integer`)
    || schemaIndex(position.column, `${path}.column`)
    || schemaIndex(position.offset, `${path}.offset`);
};

const schemaSource = (value: unknown, path: string): ClosedSchemaError => {
  const objectError = schemaObject(value, path, ['file', 'start', 'end'], ['sourcePath']);
  if (objectError) return objectError;
  const source = value as Record<string, unknown>;
  return schemaString(source.file, `${path}.file`, true)
    || schemaOptional(source, 'sourcePath', (child, childPath) => schemaString(child, childPath, true), path)
    || schemaPosition(source.start, `${path}.start`)
    || schemaPosition(source.end, `${path}.end`)
    || (((source.start as Record<string, unknown>).offset as number) <= ((source.end as Record<string, unknown>).offset as number)
      ? undefined
      : `${path} has a reversed range`);
};

const schemaSourceIdentity = (value: unknown, path: string): ClosedSchemaError => {
  const objectError = schemaObject(value, path, ['file', 'sha256'], ['sourcePath']);
  if (objectError) return objectError;
  const identity = value as Record<string, unknown>;
  return schemaString(identity.file, `${path}.file`, true)
    || schemaString(identity.sha256, `${path}.sha256`, true)
    || (typeof identity.sha256 === 'string' && /^[0-9a-f]{64}$/i.test(identity.sha256)
      ? undefined
      : `${path}.sha256 must be a SHA-256 string`)
    || schemaOptional(identity, 'sourcePath', (child, childPath) => schemaString(child, childPath, true), path);
};

const schemaSourcePin = (value: unknown, path: string): ClosedSchemaError => {
  const objectError = schemaObject(value, path, ['sourcePath', 'lineStart', 'lineEnd']);
  if (objectError) return objectError;
  const pin = value as Record<string, unknown>;
  return schemaString(pin.sourcePath, `${path}.sourcePath`, true)
    || (typeof pin.lineStart === 'number' && Number.isSafeInteger(pin.lineStart) && pin.lineStart >= 1
      ? undefined
      : `${path}.lineStart must be a positive safe integer`)
    || (typeof pin.lineEnd === 'number' && Number.isSafeInteger(pin.lineEnd) && pin.lineEnd >= 1
      ? undefined
      : `${path}.lineEnd must be a positive safe integer`)
    || ((pin.lineStart as number) <= (pin.lineEnd as number) ? undefined : `${path} has a reversed line range`);
};

const X4_UI_VALUE_TYPES = [
  'string', 'number', 'boolean', 'nil', 'table', 'function', 'reference', 'identifier', 'expression', 'unknown',
] as const;
const X4_UI_REFERENCE_KINDS = ['global', 'menu', 'frame', 'table', 'row', 'cell', 'object', 'handler', 'unknown'] as const;
const X4_UI_REFERENCE_ORIGINS = ['global', 'literal', 'call', 'alias', 'index', 'property', 'unknown'] as const;
const X4_UI_VALUE_STATUSES = ['static', 'dynamic', 'unknown'] as const;
const X4_LAYOUT_GAP_CATEGORIES = [
  'profile', 'target', 'source', 'analysis', 'data-flow', 'frame', 'table', 'row', 'cell', 'count', 'index', 'span',
  'width', 'percentage', 'height', 'options', 'constant', 'scale', 'sample', 'local-expansion', 'preview-path', 'text',
  'parse', 'unsupported', 'layer', 'menu', 'edit-box', 'fontsize', 'property',
] as const;
const HELPER_CELL_TYPES = ['cell', 'text', 'boxtext', 'icon', 'button', 'editbox'] as const;
const HELPER_DIAGNOSTIC_CODES = [
  'reserve-scrollbar-no-variable-column',
  'reserve-scrollbar-insufficient-space',
  'colspan-clamped',
  'colspan-hid-non-cell',
  'background-colspan-clamped',
] as const;
const LAYOUT_FAILURE_CODES = [
  'invalid-input', 'invalid-number', 'invalid-domain', 'invalid-count', 'invalid-index', 'invalid-span', 'invalid-cell',
  'finalized', 'columns-not-finalized', 'unsupported-dynamic-input', 'missing-min-text-height',
  'reserve-scrollbar-no-variable-column', 'reserve-scrollbar-insufficient-space', 'widget-percent-overflow',
  'widget-pixel-overflow', 'numeric-overflow',
] as const;

const schemaScalar = (value: unknown, path: string): ClosedSchemaError =>
  (typeof value === 'number' && Number.isFinite(value))
    || typeof value === 'string' || typeof value === 'boolean'
    ? undefined
    : `${path} must be a scalar`;

const schemaScalarMatchesType = (
  value: unknown,
  expectedType: unknown,
  path: string,
): ClosedSchemaError => {
  const scalarError = schemaScalar(value, path);
  if (scalarError) return scalarError;
  if (expectedType === 'number' && typeof value !== 'number') return `${path} does not match its numeric type`;
  if (expectedType === 'string' && typeof value !== 'string') return `${path} does not match its string type`;
  if (expectedType === 'boolean' && typeof value !== 'boolean') return `${path} does not match its boolean type`;
  return undefined;
};

const schemaScalarType = (value: unknown, path: string): ClosedSchemaError =>
  schemaEnum(value, path, ['number', 'string', 'boolean']);

const schemaColorLiteralField = (value: unknown, path: string): ClosedSchemaError => {
  const objectError = schemaObject(value, path, ['value', 'expression', 'source', 'keySource']);
  if (objectError) return objectError;
  const field = value as Record<string, unknown>;
  return schemaNumber(field.value, `${path}.value`)
    || schemaString(field.expression, `${path}.expression`)
    || schemaSource(field.source, `${path}.source`)
    || schemaSource(field.keySource, `${path}.keySource`);
};

const schemaColorSourceIdentity = (value: unknown, path: string): ClosedSchemaError => {
  const objectError = schemaObject(value, path, ['path', 'relativePath', 'sha256', 'size']);
  if (objectError) return objectError;
  const identity = value as Record<string, unknown>;
  return schemaString(identity.path, `${path}.path`, true)
    || schemaString(identity.relativePath, `${path}.relativePath`, true)
    || (typeof identity.sha256 === 'string' && isHexSha256(identity.sha256)
      ? undefined
      : `${path}.sha256 must be a SHA-256 string`)
    || schemaNumber(identity.size, `${path}.size`)
    || (typeof identity.size === 'number' && Number.isSafeInteger(identity.size) && identity.size >= 0
      ? undefined
      : `${path}.size must be a safe non-negative integer`);
};

const schemaColorDocumentSource = (value: unknown, path: string): ClosedSchemaError => {
  const objectError = schemaObject(value, path, ['path', 'index', 'id']);
  if (objectError) return objectError;
  const source = value as Record<string, unknown>;
  return schemaString(source.path, `${path}.path`, true)
    || schemaIndex(source.index, `${path}.index`)
    || schemaString(source.id, `${path}.id`, true);
};

const schemaColorValue = (value: unknown, path: string): ClosedSchemaError => {
  if (!isObject(value)) return `${path} must be a color value record`;
  const kind = value.kind;
  const domain = value.domain;
  if (kind !== 'color') return `${path}.kind must be color`;
  if (domain === 'source-literal-percent-alpha') {
    const objectError = schemaObject(value, path, [
      'kind', 'domain', 'r', 'g', 'b', 'a', 'declarationExpression', 'declarationSource', 'channels', 'gameVerification',
    ], ['glow']);
    if (objectError) return objectError;
    const color = value as Record<string, unknown>;
    const channelsError = schemaObject(color.channels, `${path}.channels`, ['r', 'g', 'b', 'a'], ['glow']);
    if (channelsError) return channelsError;
    const channels = color.channels as Record<string, unknown>;
    const errors = schemaEnum(color.domain, `${path}.domain`, ['source-literal-percent-alpha'])
      || schemaNumber(color.r, `${path}.r`)
      || schemaNumber(color.g, `${path}.g`)
      || schemaNumber(color.b, `${path}.b`)
      || schemaNumber(color.a, `${path}.a`)
      || schemaOptional(color, 'glow', child => schemaNumber(child, `${path}.glow`), path)
      || schemaString(color.declarationExpression, `${path}.declarationExpression`)
      || schemaSource(color.declarationSource, `${path}.declarationSource`)
      || schemaColorLiteralField(channels.r, `${path}.channels.r`)
      || schemaColorLiteralField(channels.g, `${path}.channels.g`)
      || schemaColorLiteralField(channels.b, `${path}.channels.b`)
      || schemaColorLiteralField(channels.a, `${path}.channels.a`)
      || schemaOptional(channels, 'glow', (child, childPath) => schemaColorLiteralField(child, childPath), `${path}.channels`)
      || schemaEnum(color.gameVerification, `${path}.gameVerification`, [X4_UI_LAYOUT_GAME_TRUTH]);
    if (errors) return errors;
    return sourceLiteralColorValueSemanticError(color as unknown as X4UiLayoutSourceLiteralColorValue);
  }
  if (domain === 'canonical-xml-byte-alpha') {
    const objectError = schemaObject(value, path, [
      'kind', 'domain', 'canonicalIdentity', 'requestedId', 'resolvedBaseId', 'r', 'g', 'b', 'a', 'glow', 'baseSource', 'sourceIdentities', 'gameVerification',
    ], ['mappingSource']);
    if (objectError) return objectError;
    const color = value as Record<string, unknown>;
    const identityError = schemaObject(color.sourceIdentities, `${path}.sourceIdentities`, ['xml', 'xsd']);
    if (identityError) return identityError;
    const identities = color.sourceIdentities as Record<string, unknown>;
    const errors = schemaEnum(color.domain, `${path}.domain`, ['canonical-xml-byte-alpha'])
      || schemaEnum(color.canonicalIdentity, `${path}.canonicalIdentity`, ['x4-9.00'])
      || schemaString(color.requestedId, `${path}.requestedId`, true)
      || schemaString(color.resolvedBaseId, `${path}.resolvedBaseId`, true)
      || schemaNumber(color.r, `${path}.r`)
      || schemaNumber(color.g, `${path}.g`)
      || schemaNumber(color.b, `${path}.b`)
      || schemaNumber(color.a, `${path}.a`)
      || schemaNumber(color.glow, `${path}.glow`)
      || schemaColorDocumentSource(color.baseSource, `${path}.baseSource`)
      || schemaOptional(color, 'mappingSource', schemaColorDocumentSource, path)
      || schemaColorSourceIdentity(identities.xml, `${path}.sourceIdentities.xml`)
      || schemaColorSourceIdentity(identities.xsd, `${path}.sourceIdentities.xsd`)
      || schemaEnum(color.gameVerification, `${path}.gameVerification`, [X4_UI_LAYOUT_GAME_TRUTH]);
    if (errors) return errors;
    return canonicalColorValueSemanticError(color as unknown as X4UiLayoutCanonicalColorValue);
  }
  return `${path}.domain is invalid`;
};

/**
 * Validate one exact X4 layout color value without exposing the loader
 * authority or any mutation capability.
 */
export const isExactX4UiLayoutColorValue = (
  value: unknown,
): value is X4UiLayoutColorValue => {
  try {
    return hasOnlyJsonDataProperties(value)
      && closedJsonDomain(value, 'color value') === undefined
      && schemaColorValue(value, 'color value') === undefined;
  } catch {
    return false;
  }
};

const schemaDescriptorFact = (value: unknown, path: string): ClosedSchemaError => {
  if (!isObject(value)) return `${path} must be a descriptor fact record`;
  const status = value.status;
  if (status === 'known') {
    const objectError = schemaObject(value, path, ['status', 'expectedType', 'value', 'provenance', 'expression', 'source'], ['sourcePin', 'sampleId']);
    if (objectError) return objectError;
    const fact = value as Record<string, unknown>;
    if (fact.expectedType === 'color-object') {
      const colorObjectError = schemaObject(value, path, ['status', 'expectedType', 'value', 'provenance', 'expression', 'source'], ['sourcePin', 'sampleId']);
      if (colorObjectError) return colorObjectError;
      const errors = schemaEnum(fact.status, `${path}.status`, ['known'])
        || schemaEnum(fact.expectedType, `${path}.expectedType`, ['color-object'])
        || schemaColorValue(fact.value, `${path}.value`)
        || schemaEnum(fact.provenance, `${path}.provenance`, ['source-literal', 'canonical-default-only'])
        || schemaString(fact.expression, `${path}.expression`)
        || schemaSource(fact.source, `${path}.source`)
        || schemaOptional(fact, 'sourcePin', schemaSourcePin, path)
        || schemaOptional(fact, 'sampleId', (child, childPath) => schemaString(child, childPath, true), path);
      if (errors) return errors;
      const colorValue = fact.value as Record<string, unknown>;
      const expectedProvenance = colorValue.domain === 'source-literal-percent-alpha'
        ? 'source-literal'
        : colorValue.domain === 'canonical-xml-byte-alpha'
          ? 'canonical-default-only'
          : undefined;
      return expectedProvenance === fact.provenance
        ? undefined
        : `${path}.provenance does not match its color domain`;
    }
    return schemaEnum(fact.status, `${path}.status`, ['known'])
      || schemaScalarType(fact.expectedType, `${path}.expectedType`)
      || schemaScalarMatchesType(fact.value, fact.expectedType, `${path}.value`)
      || schemaEnum(fact.provenance, `${path}.provenance`, ['source-literal', 'source-pinned-default', 'direct-helper-scale', 'preview-sample'])
      || schemaString(fact.expression, `${path}.expression`)
      || schemaSource(fact.source, `${path}.source`)
      || schemaOptional(fact, 'sourcePin', schemaSourcePin, path)
      || schemaOptional(fact, 'sampleId', (child, childPath) => schemaString(child, childPath, true), path);
  }
  if (status === 'unavailable') {
    const objectError = schemaObject(value, path, ['status', 'expectedType', 'reason', 'source'], ['expression', 'sourcePin']);
    if (objectError) return objectError;
    const fact = value as Record<string, unknown>;
    return schemaEnum(fact.status, `${path}.status`, ['unavailable'])
      || schemaEnum(fact.expectedType, `${path}.expectedType`, ['number', 'string', 'boolean', 'color-object'])
      || schemaString(fact.reason, `${path}.reason`)
      || schemaOptional(fact, 'expression', schemaString, path)
      || schemaSource(fact.source, `${path}.source`)
      || schemaOptional(fact, 'sourcePin', schemaSourcePin, path);
  }
  return `${path}.status is invalid`;
};

const schemaDescriptorFacts = (value: unknown, path: string): ClosedSchemaError => {
  if (!isObject(value)) return `${path} must be a descriptor-facts record`;
  for (const [key, fact] of Object.entries(value)) {
    const error = schemaDescriptorFact(fact, `${path}.${key}`);
    if (error) return error;
  }
  return undefined;
};

const schemaParameterIdentity = (value: unknown, path: string): ClosedSchemaError => {
  const objectError = schemaObject(value, path, ['id', 'declarationId', 'index', 'name', 'source']);
  if (objectError) return objectError;
  const parameter = value as Record<string, unknown>;
  return schemaString(parameter.id, `${path}.id`, true)
    || schemaString(parameter.declarationId, `${path}.declarationId`, true)
    || schemaIndex(parameter.index, `${path}.index`)
    || schemaString(parameter.name, `${path}.name`, true)
    || schemaSource(parameter.source, `${path}.source`);
};

const isDirectScalarLiteralExpression = (expression: unknown, type: unknown): boolean => {
  if (typeof expression !== 'string') return false;
  const text = expression.trim();
  if (type === 'string') {
    return (text.startsWith('"') && text.endsWith('"'))
      || (text.startsWith("'") && text.endsWith("'"))
      || /^\[=*\[/.test(text);
  }
  if (type === 'boolean') return text === 'true' || text === 'false';
  if (type === 'nil') return text === 'nil';
  if (type === 'number') {
    return /^[-+]?(?:0[xX][0-9A-Fa-f]+|(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?)$/.test(text);
  }
  return false;
};

const isSourceBoundMemberExpression = (expression: unknown): boolean =>
  typeof expression === 'string'
    && /^[A-Za-z_][A-Za-z0-9_]*(?:\s*\.\s*[A-Za-z_][A-Za-z0-9_]*)+$/.test(expression.trim());

const isSourceBoundPropagatedLiteral = (value: Record<string, unknown>): boolean => {
  if (value.status !== 'static'
    || !['string', 'number', 'boolean', 'nil'].includes(String(value.type))
    || isDirectScalarLiteralExpression(value.expression, value.type)
    || !isSourceBoundMemberExpression(value.expression)
    || !isSourceLocationShape(value.location)
    || !isSourceLocationShape(value.sourceLiteral)) {
    return false;
  }
  const location = value.location;
  const sourceLiteral = value.sourceLiteral;
  return sourceLiteral.file === location.file
    && sameOptionalString(sourceLiteral.sourcePath, location.sourcePath)
    && sourceLiteral.end.offset <= location.start.offset;
};

const schemaDirectHelperScaleResult = (value: unknown, path: string): ClosedSchemaError => {
  const objectError = schemaObject(value, path, ['callName', 'callSource', 'callExpression', 'bindingName', 'bindingSource']);
  if (objectError) return objectError;
  const identity = value as Record<string, unknown>;
  const errors = schemaEnum(identity.callName, `${path}.callName`, ['scaleX', 'scaleY', 'scaleFont'])
    || schemaSource(identity.callSource, `${path}.callSource`)
    || schemaString(identity.callExpression, `${path}.callExpression`, true)
    || schemaString(identity.bindingName, `${path}.bindingName`, true)
    || schemaSource(identity.bindingSource, `${path}.bindingSource`);
  if (errors) return errors;
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(identity.bindingName as string)) {
    return `${path}.bindingName must be a direct local identifier`;
  }
  const callSource = identity.callSource as X4UiSourceLocation;
  const bindingSource = identity.bindingSource as X4UiSourceLocation;
  if (callSource.file !== bindingSource.file
    || !sameOptionalString(callSource.sourcePath, bindingSource.sourcePath)) {
    return `${path} call and binding sources must belong to the same source`;
  }
  return undefined;
};

const schemaNumericHelperReceiver = (value: unknown, path: string): ClosedSchemaError => {
  const objectError = schemaObject(value, path, ['name', 'origin', 'source'], ['aliasSource']);
  if (objectError) return objectError;
  const receiver = value as Record<string, unknown>;
  return schemaString(receiver.name, `${path}.name`, true)
    || schemaEnum(receiver.origin, `${path}.origin`, ['global', 'alias'])
    || schemaSource(receiver.source, `${path}.source`)
    || schemaOptional(receiver, 'aliasSource', schemaSource, path);
};

const schemaNumericExpression = (value: unknown, path: string): ClosedSchemaError => {
  if (!isObject(value)) return `${path} must be a numeric expression descriptor`;
  const candidate = value as Record<string, unknown>;
  if (candidate.kind === 'literal') {
    const objectError = schemaObject(value, path, ['kind', 'value', 'expression', 'source']);
    if (objectError) return objectError;
    return schemaEnum(candidate.kind, `${path}.kind`, ['literal'])
      || schemaNumber(candidate.value, `${path}.value`)
      || schemaString(candidate.expression, `${path}.expression`)
      || schemaSource(candidate.source, `${path}.source`);
  }
  if (candidate.kind === 'helper-constant') {
    const objectError = schemaObject(value, path, ['kind', 'name', 'receiver', 'expression', 'source']);
    if (objectError) return objectError;
    return schemaEnum(candidate.kind, `${path}.kind`, ['helper-constant'])
      || schemaEnum(candidate.name, `${path}.name`, [
        'standardTextHeight', 'standardButtonHeight', 'borderSize', 'viewWidth', 'viewHeight',
      ])
      || schemaNumericHelperReceiver(candidate.receiver, `${path}.receiver`)
      || schemaString(candidate.expression, `${path}.expression`)
      || schemaSource(candidate.source, `${path}.source`);
  }
  if (candidate.kind === 'direct-helper-scale') {
    const objectError = schemaObject(value, path, ['kind', 'identity', 'expression', 'source']);
    if (objectError) return objectError;
    if (!isObject(candidate.identity)) return `${path}.identity must be a direct Helper scale identity`;
    return schemaEnum(candidate.kind, `${path}.kind`, ['direct-helper-scale'])
      || schemaDirectHelperScaleResult(candidate.identity, `${path}.identity`)
      || (candidate.identity.callName === 'scaleX' || candidate.identity.callName === 'scaleY'
        ? undefined
        : `${path}.identity.callName must be scaleX or scaleY`)
      || schemaString(candidate.expression, `${path}.expression`)
      || schemaSource(candidate.source, `${path}.source`);
  }
  if (candidate.kind === 'group') {
    const objectError = schemaObject(value, path, ['kind', 'operand', 'expression', 'source']);
    if (objectError) return objectError;
    return schemaEnum(candidate.kind, `${path}.kind`, ['group'])
      || schemaNumericExpression(candidate.operand, `${path}.operand`)
      || schemaString(candidate.expression, `${path}.expression`)
      || schemaSource(candidate.source, `${path}.source`);
  }
  if (candidate.kind === 'unary') {
    const objectError = schemaObject(value, path, ['kind', 'operator', 'operand', 'expression', 'source']);
    if (objectError) return objectError;
    return schemaEnum(candidate.kind, `${path}.kind`, ['unary'])
      || schemaEnum(candidate.operator, `${path}.operator`, ['+', '-'])
      || schemaNumericExpression(candidate.operand, `${path}.operand`)
      || schemaString(candidate.expression, `${path}.expression`)
      || schemaSource(candidate.source, `${path}.source`);
  }
  if (candidate.kind === 'binary' || candidate.kind === 'or') {
    const required = candidate.kind === 'binary'
      ? ['kind', 'operator', 'left', 'right', 'expression', 'source']
      : ['kind', 'left', 'right', 'expression', 'source'];
    const objectError = schemaObject(value, path, required);
    if (objectError) return objectError;
    return schemaEnum(candidate.kind, `${path}.kind`, ['binary', 'or'])
      || (candidate.kind === 'binary'
        ? schemaEnum(candidate.operator, `${path}.operator`, ['+', '-', '*', '/'])
        : undefined)
      || schemaNumericExpression(candidate.left, `${path}.left`)
      || schemaNumericExpression(candidate.right, `${path}.right`)
      || schemaString(candidate.expression, `${path}.expression`)
      || schemaSource(candidate.source, `${path}.source`);
  }
  return `${path}.kind is invalid`;
};

const schemaValue = (value: unknown, path: string, allowExpandedSourceMismatch = false): ClosedSchemaError => {
  const objectError = schemaObject(value, path, ['status', 'type', 'expression', 'location'], [
    'value', 'reference', 'sourceLiteral', 'reason', 'symbol', 'parameter', 'localInvocationResult', 'directHelperScaleResult', 'numericExpression',
  ]);
  if (objectError) return objectError;
  const candidate = value as Record<string, unknown>;
  const errors = schemaEnum(candidate.status, `${path}.status`, X4_UI_VALUE_STATUSES)
    || schemaEnum(candidate.type, `${path}.type`, X4_UI_VALUE_TYPES)
    || schemaString(candidate.expression, `${path}.expression`)
    || schemaSource(candidate.location, `${path}.location`)
    || schemaOptional(candidate, 'reference', schemaReference, path)
    || schemaOptional(candidate, 'sourceLiteral', schemaSource, path)
    || schemaOptional(candidate, 'reason', schemaString, path)
    || schemaOptional(candidate, 'symbol', schemaString, path)
    || schemaOptional(candidate, 'parameter', schemaParameterIdentity, path)
    || schemaOptional(candidate, 'localInvocationResult', (child, childPath) => {
      const resultError = schemaObject(child, childPath, ['invocationId', 'source', 'expression']);
      if (resultError) return resultError;
      const result = child as Record<string, unknown>;
      return schemaString(result.invocationId, `${childPath}.invocationId`, true)
        || schemaSource(result.source, `${childPath}.source`)
        || schemaString(result.expression, `${childPath}.expression`);
    }, path)
    || schemaOptional(candidate, 'directHelperScaleResult', schemaDirectHelperScaleResult, path)
    || schemaOptional(candidate, 'numericExpression', schemaNumericExpression, path);
  if (errors) return errors;
  const valueType = candidate.type;
  const valueStatus = candidate.status;
  const allowedTypesByStatus: Readonly<Record<string, readonly string[]>> = {
    static: ['string', 'number', 'boolean', 'nil', 'function', 'reference'],
    dynamic: ['string', 'number', 'boolean', 'reference', 'expression', 'unknown'],
    unknown: ['identifier', 'reference', 'expression', 'number', 'unknown'],
  };
  if (!allowedTypesByStatus[String(valueStatus)]?.includes(String(valueType))) {
    return `${path} has an impossible emitted status/type signature`;
  }
  const hasValue = Object.prototype.hasOwnProperty.call(candidate, 'value');
  if (valueType === 'nil') {
    if (candidate.status !== 'static' || !hasValue || candidate.value !== null) {
      return `${path}.nil values must be static with a null value`;
    }
  } else if (hasValue) {
    if (valueType === 'number' || valueType === 'string' || valueType === 'boolean') {
      const scalarError = schemaScalarMatchesType(candidate.value, valueType, `${path}.value`);
      if (scalarError) return scalarError;
    } else {
      return `${path}.value is not allowed for ${String(valueType)} values`;
    }
  }
  if ((valueType === 'string' || valueType === 'number' || valueType === 'boolean')
    && candidate.status === 'static'
    && !hasValue) {
    return `${path}.static scalar values must carry value`;
  }
  if (candidate.status !== 'static' && hasValue) {
    return `${path}.non-static values cannot carry value`;
  }
  if (valueType === 'reference'
    && candidate.status === 'static'
    && candidate.reference === undefined) {
    return `${path}.static reference values must carry reference`;
  }
  if (candidate.reference !== undefined && valueType !== 'reference') {
    return `${path}.reference is only valid for reference values`;
  }
  if (candidate.sourceLiteral !== undefined
    && (candidate.status !== 'static' || !['string', 'number', 'boolean', 'nil'].includes(String(valueType)))) {
    return `${path}.sourceLiteral is only valid for static literal values`;
  }
  if (candidate.sourceLiteral !== undefined
    && !allowExpandedSourceMismatch
    && !isSourceBoundPropagatedLiteral(candidate)
    && !jsonEqual(candidate.sourceLiteral, candidate.location)) {
    return `${path}.sourceLiteral must equal value.location for direct literals`;
  }
  if (candidate.reason !== undefined && candidate.status === 'static') {
    return `${path}.static values cannot carry reason`;
  }
  if (candidate.status !== 'static' && typeof candidate.reason !== 'string') {
    return `${path}.non-static values must carry reason`;
  }
  if (candidate.symbol !== undefined && candidate.status !== 'unknown') {
    return `${path}.symbol is only valid for unknown values`;
  }
  if (candidate.parameter !== undefined
    && (candidate.status !== 'unknown' || valueType !== 'identifier')) {
    return `${path}.parameter is only valid for unknown identifiers`;
  }
  if (candidate.parameter !== undefined) {
    const parameter = candidate.parameter as Record<string, unknown>;
    const parameterSource = parameter.source as Record<string, unknown>;
    const parameterStart = parameterSource.start as Record<string, unknown>;
    const parameterEnd = parameterSource.end as Record<string, unknown>;
    const expectedParameterId = programId(
      'local-parameter',
      `${parameter.declarationId}|${parameter.index}|${parameterStart.offset}|${parameterEnd.offset}`,
    );
    if (candidate.symbol !== parameter.name) {
      return `${path}.symbol must equal parameter.name`;
    }
    if (candidate.expression !== parameter.name) {
      return `${path}.expression must equal the direct parameter name`;
    }
    if (parameter.id !== expectedParameterId) {
      return `${path}.parameter.id does not match its declaration/index/source identity`;
    }
  }
  if (candidate.localInvocationResult !== undefined
    && (candidate.status !== 'dynamic' || valueType !== 'expression')) {
    return `${path}.localInvocationResult is only valid for dynamic expressions`;
  }
  if (candidate.localInvocationResult !== undefined) {
    const localResult = candidate.localInvocationResult as Record<string, unknown>;
    const localSource = localResult.source as X4UiSourceLocation;
    const expectedInvocationId = programId('local-invocation', localInvocationIdentityKey(localSource));
    if (localResult.invocationId !== expectedInvocationId) {
      return `${path}.localInvocationResult.invocationId does not match its source identity`;
    }
    if (allowExpandedSourceMismatch
      && (!Object.is((localResult.source as X4UiSourceLocation).file, (candidate.location as X4UiSourceLocation).file)
        || !sameOptionalString((localResult.source as X4UiSourceLocation).sourcePath, (candidate.location as X4UiSourceLocation).sourcePath))) {
      return `${path}.expanded localInvocationResult must retain source identity`;
    }
  }
  if (candidate.directHelperScaleResult !== undefined
    && (candidate.status !== 'dynamic' || valueType !== 'expression')) {
    return `${path}.directHelperScaleResult is only valid for dynamic expressions`;
  }
  if (candidate.directHelperScaleResult !== undefined) {
    const directScale = candidate.directHelperScaleResult as Record<string, unknown>;
    const directSource = directScale.callSource as X4UiSourceLocation;
    const valueLocation = candidate.location as X4UiSourceLocation;
    if (directSource.file !== valueLocation.file
      || !sameOptionalString(directSource.sourcePath, valueLocation.sourcePath)) {
      return `${path}.directHelperScaleResult must retain source identity`;
    }
  }
  return undefined;
};

function schemaReference(value: unknown, path: string): ClosedSchemaError {
  const objectError = schemaObject(value, path, ['kind', 'path', 'origin', 'source'], [
    'parentPath', 'relatedPath', 'index', 'helperRuntimeAvailability', 'helperAliasSource',
  ]);
  if (objectError) return objectError;
  const reference = value as Record<string, unknown>;
  return schemaEnum(reference.kind, `${path}.kind`, X4_UI_REFERENCE_KINDS)
    || schemaString(reference.path, `${path}.path`)
    || schemaEnum(reference.origin, `${path}.origin`, X4_UI_REFERENCE_ORIGINS)
    || schemaSource(reference.source, `${path}.source`)
    || schemaOptional(reference, 'parentPath', schemaString, path)
    || schemaOptional(reference, 'relatedPath', schemaString, path)
    || schemaOptional(reference, 'index', schemaValue, path)
    || schemaOptional(reference, 'helperRuntimeAvailability', (child, childPath) => schemaEnum(child, childPath, ['unverified']), path)
    || schemaOptional(reference, 'helperAliasSource', schemaSource, path);
}

const schemaProperty = (value: unknown, path: string, allowExpandedSourceMismatch = false): ClosedSchemaError => {
  const objectError = schemaObject(value, path, ['name', 'normalizedName', 'value', 'source', 'sourceOrder']);
  if (objectError) return objectError;
  const property = value as Record<string, unknown>;
  const errors = schemaString(property.name, `${path}.name`)
    || schemaString(property.normalizedName, `${path}.normalizedName`)
    || schemaValue(property.value, `${path}.value`, allowExpandedSourceMismatch)
    || schemaSource(property.source, `${path}.source`)
    || schemaIndex(property.sourceOrder, `${path}.sourceOrder`);
  if (errors) return errors;
  const propertyValue = property.value as Record<string, unknown>;
  const valueLocation = propertyValue.location;
  const sourceRecord = property.source as Record<string, unknown>;
  const sourceStart = sourceRecord.start as Record<string, unknown>;
  if (!Object.is(property.sourceOrder, sourceStart.offset)) {
    return `${path}.sourceOrder must equal source.start.offset`;
  }
  if (!allowExpandedSourceMismatch) {
    if (!jsonEqual(property.source, valueLocation)) {
      return `${path}.source must equal value.location for direct values`;
    }
    const valueLocationRecord = valueLocation as Record<string, unknown>;
    const valueStart = valueLocationRecord.start as Record<string, unknown>;
    if (!Object.is(property.sourceOrder, valueStart.offset)) {
      return `${path}.sourceOrder must equal value.location.start.offset for direct values`;
    }
    if (propertyValue.sourceLiteral !== undefined
      && !isSourceBoundPropagatedLiteral(propertyValue)
      && !jsonEqual(propertyValue.sourceLiteral, valueLocation)) {
      return `${path}.sourceLiteral must equal value.location for direct literals`;
    }
  } else {
    const valueLocationRecord = valueLocation as Record<string, unknown>;
    if (!Object.is(sourceRecord.file, valueLocationRecord.file)
      || !sameOptionalString(sourceRecord.sourcePath as string | undefined, valueLocationRecord.sourcePath as string | undefined)) {
      return `${path}.expanded source and value.location must retain source identity`;
    }
  }
  return undefined;
};

const schemaSemantics = (value: unknown, path: string, allowExpandedSourceMismatch = false): ClosedSchemaError => {
  const objectError = schemaObject(value, path, [], [
    'count', 'index', 'span', 'width', 'percentage', 'height', 'layer', 'menu', 'menuName', 'frame', 'table', 'row',
    'cell', 'cellType', 'propertyName', 'hotkey', 'displayIcon', 'dataFlow', 'text', 'editBox', 'fontsize', 'options',
    'properties', 'unsupportedProperties', 'rowData', 'icon', 'scaling', 'scale',
  ]);
  if (objectError) return objectError;
  const semantics = value as Record<string, unknown>;
  for (const key of [
    'count', 'index', 'span', 'width', 'percentage', 'height', 'layer', 'menu', 'menuName', 'frame', 'table', 'row',
    'cell', 'cellType', 'propertyName', 'hotkey', 'displayIcon', 'dataFlow', 'text', 'fontsize', 'options', 'rowData', 'icon', 'scaling',
  ]) {
    const error = schemaOptional(semantics, key, (child, childPath) =>
      schemaValue(child, childPath, allowExpandedSourceMismatch), path);
    if (error) return error;
  }
  if (semantics.editBox !== undefined) {
    const editBoxError = schemaObject(semantics.editBox, `${path}.editBox`, [], ['defaultText', 'description']);
    if (editBoxError) return editBoxError;
    const editBox = semantics.editBox as Record<string, unknown>;
    for (const key of ['defaultText', 'description']) {
      const error = schemaOptional(editBox, key, (child, childPath) =>
        schemaValue(child, childPath, allowExpandedSourceMismatch), `${path}.editBox`);
      if (error) return error;
    }
  }
  const scale = semantics.scale;
  if (scale !== undefined) {
    const scaleError = schemaObject(scale, `${path}.scale`, [], ['input', 'enabled', 'fontname', 'fontsize']);
    if (scaleError) return scaleError;
    const scaleRecord = scale as Record<string, unknown>;
    for (const key of ['input', 'enabled', 'fontname', 'fontsize']) {
      const error = schemaOptional(scaleRecord, key, (child, childPath) =>
        schemaValue(child, childPath, allowExpandedSourceMismatch), `${path}.scale`);
      if (error) return error;
    }
  }
  if (semantics.properties !== undefined) {
    const error = schemaArray(semantics.properties, `${path}.properties`);
    if (error) return error;
    for (const [index, property] of (semantics.properties as readonly unknown[]).entries()) {
      const propertyError = schemaProperty(property, `${path}.properties[${index}]`, allowExpandedSourceMismatch);
      if (propertyError) return propertyError;
    }
  }
  if (semantics.unsupportedProperties !== undefined) {
    const error = schemaArray(semantics.unsupportedProperties, `${path}.unsupportedProperties`);
    if (error) return error;
    for (const [index, property] of (semantics.unsupportedProperties as readonly unknown[]).entries()) {
      const propertyError = schemaProperty(property, `${path}.unsupportedProperties[${index}]`, allowExpandedSourceMismatch);
      if (propertyError) return propertyError;
    }
  }
  return undefined;
};

const schemaMetadata = (value: unknown, path: string, allowExpandedSourceMismatch = false): ClosedSchemaError => {
  const objectError = schemaObject(value, path, ['arguments', 'semantics'], ['receiver', 'result']);
  if (objectError) return objectError;
  const metadata = value as Record<string, unknown>;
  const argumentsError = schemaArray(metadata.arguments, `${path}.arguments`);
  if (argumentsError) return argumentsError;
  for (const [index, argument] of (metadata.arguments as readonly unknown[]).entries()) {
    const error = schemaValue(argument, `${path}.arguments[${index}]`, allowExpandedSourceMismatch);
    if (error) return error;
  }
  const semanticsError = schemaSemantics(metadata.semantics, `${path}.semantics`, allowExpandedSourceMismatch);
  return semanticsError
    || schemaOptional(metadata, 'receiver', schemaValue, path)
    || schemaOptional(metadata, 'result', schemaReference, path);
};

const schemaPinnedNumber = (value: unknown, path: string): ClosedSchemaError => {
  if (!profilePinnedNumberShape(value)) return `${path} is not an exact source-pinned finite number`;
  const objectError = schemaObject(value, path, ['value', 'source']);
  if (objectError) return objectError;
  const pinned = value as unknown as Record<string, unknown>;
  return schemaNumber(pinned.value, `${path}.value`) || schemaSourcePin(pinned.source, `${path}.source`);
};

const schemaMetrics = (value: unknown, path: string): ClosedSchemaError => {
  const objectError = schemaObject(value, path, ['uiScale', 'borderSize', 'scrollbarWidth', 'standardContainerOffset']);
  if (objectError) return objectError;
  const metrics = value as Record<string, unknown>;
  const errors = schemaNumber(metrics.uiScale, `${path}.uiScale`)
    || schemaNumber(metrics.borderSize, `${path}.borderSize`)
    || schemaNumber(metrics.scrollbarWidth, `${path}.scrollbarWidth`)
    || schemaNumber(metrics.standardContainerOffset, `${path}.standardContainerOffset`);
  if (errors) return errors;
  if ((metrics.uiScale as number) <= 0) return `${path}.uiScale must be positive`;
  if ((metrics.borderSize as number) < 0) return `${path}.borderSize must be non-negative`;
  if ((metrics.scrollbarWidth as number) < 0) return `${path}.scrollbarWidth must be non-negative`;
  if ((metrics.standardContainerOffset as number) < 0) return `${path}.standardContainerOffset must be non-negative`;
  return undefined;
};

const schemaProfile = (value: unknown, path: string): ClosedSchemaError => {
  const objectError = schemaObject(value, path, ['id', 'provenance', 'truthGrade', 'source', 'frame', 'metrics', 'helper', 'widget', 'defaults'], ['localExpansion']);
  if (objectError) return objectError;
  const profile = value as Record<string, unknown>;
  const frameError = schemaObject(profile.frame, `${path}.frame`, ['width', 'height']);
  if (frameError) return frameError;
  const frame = profile.frame as Record<string, unknown>;
  const errors = schemaString(profile.id, `${path}.id`, true)
    || schemaString(profile.provenance, `${path}.provenance`, true)
    || schemaEnum(profile.truthGrade, `${path}.truthGrade`, ['supplied', 'captured', 'unverified-default'])
    || schemaSourceIdentity(profile.source, `${path}.source`)
    || schemaNumber(frame.width, `${path}.frame.width`)
    || schemaNumber(frame.height, `${path}.frame.height`)
    || schemaMetrics(profile.metrics, `${path}.metrics`);
  if (errors) return errors;
  if ((frame.width as number) < 0 || (frame.height as number) < 0) {
    return `${path}.frame dimensions must be non-negative`;
  }
  const helperError = schemaObject(profile.helper, `${path}.helper`, ['sourcePath', 'sha256', 'constants']);
  if (helperError) return helperError;
  const helper = profile.helper as Record<string, unknown>;
  const helperConstantsError = schemaObject(helper.constants, `${path}.helper.constants`, [
    'standardTextHeight', 'standardButtonHeight', 'borderSize', 'viewWidth', 'viewHeight',
  ]);
  if (helperConstantsError) return helperConstantsError;
  for (const key of ['standardTextHeight', 'standardButtonHeight', 'borderSize', 'viewWidth', 'viewHeight']) {
    const error = schemaPinnedNumber((helper.constants as Record<string, unknown>)[key], `${path}.helper.constants.${key}`);
    if (error) return error;
  }
  const widgetError = schemaObject(profile.widget, `${path}.widget`, ['sourcePath', 'sha256']);
  if (widgetError) return widgetError;
  const widget = profile.widget as Record<string, unknown>;
  if (schemaString(helper.sourcePath, `${path}.helper.sourcePath`, true)
    || schemaString(helper.sha256, `${path}.helper.sha256`, true)
    || schemaString(widget.sourcePath, `${path}.widget.sourcePath`, true)
    || schemaString(widget.sha256, `${path}.widget.sha256`, true)) {
    return `${path} helper or widget identity is malformed`;
  }
  if (helper.sourcePath !== HELPER_SOURCE_PATH
    || helper.sha256 !== HELPER_SOURCE_SHA256
    || widget.sourcePath !== WIDGET_SOURCE_PATH
    || widget.sha256 !== WIDGET_SOURCE_SHA256) {
    return `${path} helper or widget identity does not match the accepted shipped sources`;
  }
  const helperConstants = helper.constants as Record<string, unknown>;
  const exactHelperPin = (
    name: X4UiLayoutHelperConstantName,
    expectedValue: number,
    expectedLine: number,
  ): boolean => {
    const pin = helperConstants[name] as Record<string, unknown>;
    const source = pin.source as Record<string, unknown>;
    return Object.is(pin.value, expectedValue)
      && source.sourcePath === HELPER_SOURCE_PATH
      && Object.is(source.lineStart, expectedLine)
      && Object.is(source.lineEnd, expectedLine);
  };
  if (!exactHelperPin('standardTextHeight', 16, 533)
    || !exactHelperPin('standardButtonHeight', 25, 522)
    || !exactHelperPin('borderSize', profile.metrics && (profile.metrics as Record<string, unknown>).borderSize as number, 709)
    || !exactHelperPin('viewWidth', frame.width as number, 707)
    || !exactHelperPin('viewHeight', frame.height as number, 708)) {
    return `${path}.helper.constants do not match the accepted Helper pins`;
  }
  if (!Object.is((profile.metrics as Record<string, unknown>).borderSize, (helperConstants.borderSize as Record<string, unknown>).value)) {
    return `${path}.metrics.borderSize must equal helper.constants.borderSize.value`;
  }
  const defaultsError = schemaObject(profile.defaults, `${path}.defaults`, [], ['standardButtonHeight', 'minTextHeight']);
  if (defaultsError) return defaultsError;
  const defaults = profile.defaults as Record<string, unknown>;
  const defaultsSchemaError = schemaOptional(defaults, 'standardButtonHeight', schemaPinnedNumber, `${path}.defaults`)
    || schemaOptional(defaults, 'minTextHeight', schemaNumber, `${path}.defaults`);
  if (defaultsSchemaError) return defaultsSchemaError;
  if (defaults.standardButtonHeight !== undefined) {
    const standardButtonHeight = defaults.standardButtonHeight as Record<string, unknown>;
    const source = standardButtonHeight.source as Record<string, unknown>;
    if (!Object.is(standardButtonHeight.value, 25)
      || source.sourcePath !== HELPER_SOURCE_PATH
      || !Object.is(source.lineStart, 522)
      || !Object.is(source.lineEnd, 522)
      || !Object.is((helperConstants.standardButtonHeight as Record<string, unknown>).value, standardButtonHeight.value)) {
      return `${path}.defaults.standardButtonHeight does not match the accepted Helper pin`;
    }
  }
  if (defaults.minTextHeight !== undefined && (defaults.minTextHeight as number) < 0) {
    return `${path}.defaults.minTextHeight must be non-negative`;
  }
  const expansionError = schemaOptional(profile, 'localExpansion', (child, childPath) => {
      const expansionError = schemaObject(child, childPath, ['maxDepth', 'maxInvocations']);
      if (expansionError) return expansionError;
      const limits = child as Record<string, unknown>;
      return schemaPositiveIndex(limits.maxDepth, `${childPath}.maxDepth`)
        || ((limits.maxDepth as number) <= 32 ? undefined : `${childPath}.maxDepth must be at most 32`)
        || schemaPositiveIndex(limits.maxInvocations, `${childPath}.maxInvocations`)
        || ((limits.maxInvocations as number) <= 2048 ? undefined : `${childPath}.maxInvocations must be at most 2048`);
    }, path);
  return expansionError;
};

const schemaTarget = (value: unknown, path: string): ClosedSchemaError => {
  const objectError = schemaObject(value, path, ['kind', 'source', 'id', 'sourceIdentity'], ['name', 'handler']);
  if (objectError) return objectError;
  const target = value as Record<string, unknown>;
  return schemaEnum(target.kind, `${path}.kind`, ['top-level', 'function', 'handler'])
    || schemaSource(target.source, `${path}.source`)
    || schemaString(target.id, `${path}.id`, true)
    || schemaSourceIdentity(target.sourceIdentity, `${path}.sourceIdentity`)
    || schemaOptional(target, 'name', schemaString, path)
    || schemaOptional(target, 'handler', schemaString, path);
};

const schemaHeight = (value: unknown, path: string): ClosedSchemaError => {
  if (!isObject(value)) return `${path} must be a record`;
  const height = value as Record<string, unknown>;
  if (height.status === 'known') {
    const objectError = schemaObject(height, path, ['status', 'value']);
    if (objectError) return objectError;
    return schemaNumber(height.value, `${path}.value`);
  }
  if (height.status === 'unavailable') {
    const objectError = schemaObject(height, path, ['status'], ['refusal']);
    if (objectError) return objectError;
    return schemaOptional(height, 'refusal', schemaFailure, path);
  }
  return `${path}.status has an invalid value`;
};

const schemaProvenance = (value: unknown, path: string): ClosedSchemaError => {
  const objectError = schemaObject(value, path, [
    'id', 'version', 'helperSourcePath', 'helperSha256', 'helperLineAnchors', 'widgetSourcePath', 'widgetSha256', 'widgetLineAnchors',
  ]);
  if (objectError) return objectError;
  const provenance = value as Record<string, unknown>;
  const errors = schemaString(provenance.id, `${path}.id`, true)
    || (typeof provenance.version === 'string'
      ? schemaString(provenance.version, `${path}.version`, true)
      : schemaNumber(provenance.version, `${path}.version`))
    || schemaString(provenance.helperSourcePath, `${path}.helperSourcePath`, true)
    || schemaString(provenance.helperSha256, `${path}.helperSha256`, true)
    || schemaString(provenance.widgetSourcePath, `${path}.widgetSourcePath`, true)
    || schemaString(provenance.widgetSha256, `${path}.widgetSha256`, true);
  if (errors) return errors;
  const anchorKeys: Readonly<Record<string, readonly string[]>> = {
    helperLineAnchors: [
      'defaultWidgetScaling', 'defaultTableReserveScrollBar', 'defaultRowScalingAndBorderBelow', 'editBoxMinHeight',
      'editBoxHotkeyDefaults', 'initTableCell', 'editBoxHotkeyAndHeight', 'iconGetHeight',
      'buttonGetHeight', 'roundAndScale', 'addTableDefaults', 'settersAndFinalization', 'fullHeight',
      'firstAddRowAndFreeze', 'rowHeight', 'colspan', 'cellHeight',
    ],
    widgetLineAnchors: ['convertColumnWidth'],
  };
  for (const key of ['helperLineAnchors', 'widgetLineAnchors']) {
    const anchors = provenance[key];
    const anchorsError = schemaObject(anchors, `${path}.${key}`, anchorKeys[key]);
    if (anchorsError) return anchorsError;
    for (const [anchorName, anchor] of Object.entries(anchors as Record<string, unknown>)) {
      const anchorError = schemaArray(anchor, `${path}.${key}.${anchorName}`);
      if (anchorError) return anchorError;
      const values = anchor as readonly unknown[];
      if (values.length !== 2) return `${path}.${key}.${anchorName} must contain two line indexes`;
      if (schemaIndex(values[0], `${path}.${key}.${anchorName}[0]`)
        || schemaIndex(values[1], `${path}.${key}.${anchorName}[1]`)) return `${path}.${key}.${anchorName} has invalid line indexes`;
    }
  }
  if (!jsonEqual(value, X4_LAYOUT_PROVENANCE)) return `${path} does not match the exact layout provenance`;
  return undefined;
};

const schemaKernelCell = (value: unknown, path: string): ClosedSchemaError => {
  const objectError = schemaObject(value, path, ['type', 'colspan', 'bgcolspan', 'y', 'height', 'scaling', 'affectRowHeight', 'hotkey', 'displayIcon'], ['minTextHeight']);
  if (objectError) return objectError;
  const cell = value as Record<string, unknown>;
  const errors = schemaEnum(cell.type, `${path}.type`, HELPER_CELL_TYPES)
    || schemaIndex(cell.colspan, `${path}.colspan`)
    || schemaIndex(cell.bgcolspan, `${path}.bgcolspan`)
    || schemaNumber(cell.y, `${path}.y`)
    || schemaNumber(cell.height, `${path}.height`)
    || schemaBoolean(cell.scaling, `${path}.scaling`)
    || schemaBoolean(cell.affectRowHeight, `${path}.affectRowHeight`)
    || schemaString(cell.hotkey, `${path}.hotkey`)
    || schemaBoolean(cell.displayIcon, `${path}.displayIcon`)
    || schemaOptional(cell, 'minTextHeight', schemaNumber, path);
  if (errors) return errors;
  if ((cell.height as number) < 0) return `${path}.height must be non-negative`;
  if (cell.minTextHeight !== undefined && (cell.minTextHeight as number) < 0) {
    return `${path}.minTextHeight must be non-negative`;
  }
  return undefined;
};

const schemaKernelRow = (value: unknown, path: string): ClosedSchemaError => {
  const objectError = schemaObject(value, path, ['fixed', 'borderBelow', 'paddingTop', 'paddingBottom', 'scaling', 'cells'], ['groupIndex']);
  if (objectError) return objectError;
  const row = value as Record<string, unknown>;
  const errors = schemaBoolean(row.fixed, `${path}.fixed`)
    || schemaBoolean(row.borderBelow, `${path}.borderBelow`)
    || schemaNumber(row.paddingTop, `${path}.paddingTop`)
    || schemaNumber(row.paddingBottom, `${path}.paddingBottom`)
    || schemaBoolean(row.scaling, `${path}.scaling`)
    || schemaOptional(row, 'groupIndex', (child, childPath) =>
      typeof child === 'number' && Number.isSafeInteger(child) && child >= 1
        ? undefined
        : `${childPath} must be a positive safe integer`, path)
    || schemaArray(row.cells, `${path}.cells`);
  if (errors) return errors;
  for (const [index, cell] of (row.cells as readonly unknown[]).entries()) {
    const error = schemaKernelCell(cell, `${path}.cells[${index}]`);
    if (error) return error;
  }
  if ((row.paddingTop as number) < 0) return `${path}.paddingTop must be non-negative`;
  if ((row.paddingBottom as number) < 0) return `${path}.paddingBottom must be non-negative`;
  return undefined;
};

const schemaKernelState = (value: unknown, path: string): ClosedSchemaError => {
  const objectError = schemaObject(value, path, [
    'provenance', 'frameWidth', 'metrics', 'requestedWidth', 'properties', 'editBoxDefaults', 'columns', 'rows', 'rowGroups', 'createdWithScrollBar', 'final', 'diagnostics',
  ]);
  if (objectError) return objectError;
  const state = value as Record<string, unknown>;
  const errors = schemaProvenance(state.provenance, `${path}.provenance`)
    || schemaNumber(state.frameWidth, `${path}.frameWidth`)
    || schemaMetrics(state.metrics, `${path}.metrics`)
    || schemaNumber(state.requestedWidth, `${path}.requestedWidth`)
    || schemaObject(state.properties, `${path}.properties`, ['width', 'x', 'scaling', 'reserveScrollBar'])
    || schemaObject(state.editBoxDefaults, `${path}.editBoxDefaults`, [], ['height', 'scaling', 'hotkey', 'displayIcon'])
    || schemaArray(state.columns, `${path}.columns`)
    || schemaArray(state.rows, `${path}.rows`)
    || schemaArray(state.rowGroups, `${path}.rowGroups`)
    || schemaBoolean(state.createdWithScrollBar, `${path}.createdWithScrollBar`)
    || schemaBoolean(state.final, `${path}.final`)
    || schemaArray(state.diagnostics, `${path}.diagnostics`);
  if (errors) return errors;
  const editBoxDefaults = state.editBoxDefaults as Record<string, unknown>;
  const editBoxDefaultsError = schemaOptional(editBoxDefaults, 'height', schemaNumber, `${path}.editBoxDefaults`)
    || schemaOptional(editBoxDefaults, 'scaling', schemaBoolean, `${path}.editBoxDefaults`)
    || schemaOptional(editBoxDefaults, 'hotkey', schemaString, `${path}.editBoxDefaults`)
    || schemaOptional(editBoxDefaults, 'displayIcon', schemaBoolean, `${path}.editBoxDefaults`);
  if (editBoxDefaultsError) return editBoxDefaultsError;
  if (editBoxDefaults.height !== undefined && (editBoxDefaults.height as number) < 0) return `${path}.editBoxDefaults.height must be non-negative`;
  const properties = state.properties as Record<string, unknown>;
  for (const key of ['width', 'x']) {
    const error = schemaNumber(properties[key], `${path}.properties.${key}`);
    if (error) return error;
  }
  for (const key of ['scaling', 'reserveScrollBar']) {
    const error = schemaBoolean(properties[key], `${path}.properties.${key}`);
    if (error) return error;
  }
  for (const [index, column] of (state.columns as readonly unknown[]).entries()) {
    const columnError = schemaObject(column, `${path}.columns[${index}]`, ['width', 'percent', 'min', 'weight', 'colspan', 'bgcolspan'], ['scaling']);
    if (columnError) return columnError;
    const candidate = column as Record<string, unknown>;
    const widthError = schemaNumber(candidate.width, `${path}.columns[${index}].width`);
    if (widthError) return widthError;
    const percentError = schemaBoolean(candidate.percent, `${path}.columns[${index}].percent`);
    if (percentError) return percentError;
    const minError = schemaBoolean(candidate.min, `${path}.columns[${index}].min`);
    if (minError) return minError;
    const weightError = schemaNumber(candidate.weight, `${path}.columns[${index}].weight`);
    if (weightError) return weightError;
    if ((candidate.width as number) < 0) return `${path}.columns[${index}].width must be non-negative`;
    if ((candidate.weight as number) < 0) return `${path}.columns[${index}].weight must be non-negative`;
    for (const key of ['colspan', 'bgcolspan']) {
      const error = schemaPositiveIndex(candidate[key], `${path}.columns[${index}].${key}`);
      if (error) return error;
    }
    const scalingError = schemaOptional(candidate, 'scaling', schemaBoolean, `${path}.columns[${index}]`);
    if (scalingError) return scalingError;
  }
  for (const [index, row] of (state.rows as readonly unknown[]).entries()) {
    const error = schemaKernelRow(row, `${path}.rows[${index}]`);
    if (error) return error;
  }
  const columns = state.columns as readonly unknown[];
  if (columns.length === 0) return `${path}.columns must contain at least one column`;
  if (!(state.final as boolean) && (state.rows as readonly unknown[]).length > 0) {
    return `${path}.pre-final state cannot contain populated rows`;
  }
  for (const [index, row] of (state.rows as readonly unknown[]).entries()) {
    const rowRecord = row as Record<string, unknown>;
    const cells = rowRecord.cells as readonly unknown[];
    if (cells.length !== columns.length) {
      return `${path}.rows[${index}].cells must match columns length`;
    }
  }
  for (const [index, group] of (state.rowGroups as readonly unknown[]).entries()) {
    const error = schemaObject(group, `${path}.rowGroups[${index}]`, ['level'])
      || schemaIndex((group as Record<string, unknown>).level, `${path}.rowGroups[${index}].level`);
    if (error) return error;
  }
  for (const [index, diagnostic] of (state.diagnostics as readonly unknown[]).entries()) {
    const diagnosticRecord = diagnostic as Record<string, unknown>;
    const error = schemaObject(diagnostic, `${path}.diagnostics[${index}]`, ['code', 'message', 'provenance'])
      || schemaEnum(diagnosticRecord.code, `${path}.diagnostics[${index}].code`, HELPER_DIAGNOSTIC_CODES)
      || schemaString(diagnosticRecord.message, `${path}.diagnostics[${index}].message`)
      || schemaProvenance(diagnosticRecord.provenance, `${path}.diagnostics[${index}].provenance`);
    if (error) return error;
  }
  const rowGroups = state.rowGroups as readonly unknown[];
  for (const [index, row] of (state.rows as readonly unknown[]).entries()) {
    const groupIndex = (row as Record<string, unknown>).groupIndex;
    if (groupIndex !== undefined
      && (typeof groupIndex !== 'number' || !Number.isSafeInteger(groupIndex) || groupIndex < 1 || groupIndex > rowGroups.length)) {
      return `${path}.rows[${index}].groupIndex is outside rowGroups`;
    }
  }
  return undefined;
};

const schemaFailure = (value: unknown, path: string, allowState = false): ClosedSchemaError => {
  const objectError = schemaObject(value, path, ['status', 'code', 'message', 'provenance'], allowState ? ['state'] : []);
  if (objectError) return objectError;
  const failure = value as Record<string, unknown>;
  const error = schemaEnum(failure.status, `${path}.status`, ['refused', 'unsupported'])
    || schemaEnum(failure.code, `${path}.code`, LAYOUT_FAILURE_CODES)
    || schemaString(failure.message, `${path}.message`)
    || schemaProvenance(failure.provenance, `${path}.provenance`);
  if (error) return error;
  if (allowState && !Object.prototype.hasOwnProperty.call(failure, 'state')) return `${path}.state is required for a state refusal`;
  return allowState ? schemaOptional(failure, 'state', schemaKernelState, path) : undefined;
};

const schemaTransition = (value: unknown, path: string): ClosedSchemaError => {
  if (!isObject(value)) return `${path} must be a transition record`;
  const transition = value as Record<string, unknown>;
  const hasBefore = Object.prototype.hasOwnProperty.call(transition, 'stateBefore');
  const hasAfter = Object.prototype.hasOwnProperty.call(transition, 'stateAfter');
  const hasRefusal = Object.prototype.hasOwnProperty.call(transition, 'refusal');
  if (hasRefusal && !hasBefore && !hasAfter) {
    const objectError = schemaObject(transition, path, ['refusal']);
    if (objectError) return objectError;
    return schemaFailure(transition.refusal, `${path}.refusal`);
  }
  if (hasRefusal) {
    const objectError = schemaObject(transition, path, ['stateBefore', 'stateAfter', 'refusal']);
    if (objectError) return objectError;
    const stateError = schemaKernelState(transition.stateBefore, `${path}.stateBefore`)
      || schemaKernelState(transition.stateAfter, `${path}.stateAfter`);
    if (stateError) return stateError;
    const refusalError = schemaFailure(transition.refusal, `${path}.refusal`, true);
    if (refusalError) return refusalError;
    if (!jsonEqual(transition.stateBefore, transition.stateAfter)) {
      return `${path}.stateBefore must equal stateAfter for a refusal`;
    }
    return jsonEqual((transition.refusal as Record<string, unknown>).state, transition.stateAfter)
      ? undefined
      : `${path}.refusal.state must equal stateAfter`;
  }
  if (hasBefore && hasAfter) {
    const objectError = schemaObject(transition, path, ['stateBefore', 'stateAfter']);
    if (objectError) return objectError;
    return schemaKernelState(transition.stateBefore, `${path}.stateBefore`)
      || schemaKernelState(transition.stateAfter, `${path}.stateAfter`);
  }
  if (!hasBefore && hasAfter) {
    const objectError = schemaObject(transition, path, ['stateAfter']);
    if (objectError) return objectError;
    return schemaKernelState(transition.stateAfter, `${path}.stateAfter`);
  }
  return `${path} has an impossible transition shape`;
};

const schemaScale = (value: unknown, path: string): ClosedSchemaError => {
  const objectError = schemaObject(value, path, ['status', 'value', 'sourceArguments']);
  if (objectError) return objectError;
  const scale = value as Record<string, unknown>;
  const errors = schemaEnum(scale.status, `${path}.status`, ['resolved'])
    || schemaNumber(scale.value, `${path}.value`)
    || schemaArray(scale.sourceArguments, `${path}.sourceArguments`);
  if (errors) return errors;
  for (const [index, source] of (scale.sourceArguments as readonly unknown[]).entries()) {
    const error = schemaSource(source, `${path}.sourceArguments[${index}]`);
    if (error) return error;
  }
  return undefined;
};

const schemaLocalOperationExpansion = (value: unknown, path: string): ClosedSchemaError => {
  const objectError = schemaObject(value, path, ['invocationId', 'ancestry', 'depth', 'previewPathSelectionIds']);
  if (objectError) return objectError;
  const expansion = value as Record<string, unknown>;
  const errors = schemaString(expansion.invocationId, `${path}.invocationId`, true)
    || schemaArray(expansion.ancestry, `${path}.ancestry`)
    || schemaIndex(expansion.depth, `${path}.depth`)
    || schemaArray(expansion.previewPathSelectionIds, `${path}.previewPathSelectionIds`);
  if (errors) return errors;
  if (!(expansion.ancestry as readonly unknown[]).every(candidate => typeof candidate === 'string' && candidate.length > 0)) return `${path}.ancestry has an invalid ID`;
  if (!(expansion.previewPathSelectionIds as readonly unknown[]).every(candidate => typeof candidate === 'string' && candidate.length > 0)) return `${path}.previewPathSelectionIds has an invalid ID`;
  return undefined;
};

type OperationOwnerKey = 'frameId' | 'tableId' | 'rowId' | 'cellId';

const OPERATION_OWNER_SHAPES: Readonly<Record<string, readonly OperationOwnerKey[]>> = {
  scaleX: [],
  scaleY: [],
  scaleFont: [],
  OpenMenu: [],
  createFrameHandle: ['frameId'],
  setBackground: ['frameId'],
  setBackground2: ['frameId'],
  setOverlay: ['frameId'],
  display: ['frameId'],
  addTable: ['tableId'],
  setDefaultCellProperties: ['tableId'],
  setDefaultComplexCellProperties: ['tableId'],
  setColWidth: ['tableId'],
  setColWidthPercent: ['tableId'],
  addRow: ['tableId', 'rowId'],
  setColSpan: ['tableId', 'rowId', 'cellId'],
  createButton: ['tableId', 'rowId', 'cellId'],
  setText: ['tableId', 'rowId', 'cellId'],
  setText2: ['tableId', 'rowId', 'cellId'],
  createText: ['tableId', 'rowId', 'cellId'],
  createEditBox: ['tableId', 'rowId', 'cellId'],
  setHotkey: ['tableId', 'rowId', 'cellId'],
  createIcon: ['tableId', 'rowId', 'cellId'],
};

const ownerKeyForReferenceKind = (kind: unknown): OperationOwnerKey | undefined => {
  if (kind === 'frame') return 'frameId';
  if (kind === 'table') return 'tableId';
  if (kind === 'row') return 'rowId';
  if (kind === 'cell') return 'cellId';
  return undefined;
};

interface OperationOwnerEvidenceNodes {
  readonly frames: readonly unknown[];
  readonly tables: readonly unknown[];
  readonly rows: readonly unknown[];
  readonly cells: readonly unknown[];
}

const operationReciprocalOwnerKeys = (
  value: Record<string, unknown>,
  nodes: OperationOwnerEvidenceNodes,
): ReadonlySet<OperationOwnerKey> => {
  const keys = new Set<OperationOwnerKey>();
  if (typeof value.id !== 'string') return keys;
  if (OPERATION_OWNER_SHAPES[String(value.kind)]?.includes('cellId') !== true) return keys;
  const ownerNodes: readonly {
    readonly key: OperationOwnerKey;
    readonly kind: 'frame' | 'table' | 'row' | 'cell';
    readonly id: unknown;
    readonly collection: readonly unknown[];
  }[] = [
    { key: 'frameId', kind: 'frame', id: value.frameId, collection: nodes.frames },
    { key: 'tableId', kind: 'table', id: value.tableId, collection: nodes.tables },
    { key: 'rowId', kind: 'row', id: value.rowId, collection: nodes.rows },
    { key: 'cellId', kind: 'cell', id: value.cellId, collection: nodes.cells },
  ];
  const operationId = value.id;
  const reciprocalNode = (owner: typeof ownerNodes[number]): Record<string, unknown> | undefined => {
    if (typeof owner.id !== 'string') return undefined;
    const node = owner.collection.find(candidate => isObject(candidate) && candidate.id === owner.id);
    if (!isObject(node) || !isObject(node.identity) || node.identity.kind !== owner.kind) return undefined;
    if (!Array.isArray(node.operationIds)
      || node.operationIds.filter(candidate => candidate === operationId).length !== 1) return undefined;
    return node;
  };
  const tableOwner = ownerNodes.find(owner => owner.key === 'tableId')!;
  const rowOwner = ownerNodes.find(owner => owner.key === 'rowId')!;
  const cellOwner = ownerNodes.find(owner => owner.key === 'cellId')!;
  const table = reciprocalNode(tableOwner);
  const row = reciprocalNode(rowOwner);
  const cell = reciprocalNode(cellOwner);
  if (!table || !row || !cell) return keys;
  if (cell.tableId !== value.tableId
    || cell.rowId !== value.rowId
    || row.tableId !== value.tableId) return keys;
  keys.add('cellId');
  return keys;
};

const operationMetadataOwnerKeys = (
  value: Record<string, unknown>,
  nodes: OperationOwnerEvidenceNodes,
): ReadonlySet<OperationOwnerKey> => {
  const keys = new Set<OperationOwnerKey>();
  const kind = String(value.kind);
  const expectsCellOwner = OPERATION_OWNER_SHAPES[kind]?.includes('cellId') === true;
  const addRowAncestry = (row: Record<string, unknown>): void => {
    keys.add('rowId');
    if (typeof row.tableId === 'string') keys.add('tableId');
  };
  const resolvedReferenceKind = (reference: Record<string, unknown>): OperationOwnerKey | undefined => {
    const ownerKey = ownerKeyForReferenceKind(reference.kind);
    if (!ownerKey) return undefined;
    const collection = ownerKey === 'frameId'
      ? nodes.frames
      : ownerKey === 'tableId'
        ? nodes.tables
        : ownerKey === 'rowId'
          ? nodes.rows
          : nodes.cells;
    // The metadata reference is independent source evidence only when it
    // exactly identifies an emitted node.  A cell-shaped reference with a
    // dynamic/out-of-range index can still be present on an unresolved call;
    // without a matching materialized identity it must not force an owner.
    return collection.some(node => isObject(node)
      && isObject(node.identity)
      && jsonEqual(node.identity, reference))
      ? ownerKey
      : undefined;
  };
  const addResolvedReference = (reference: Record<string, unknown>, allowNonCellOwner: boolean): void => {
    const ownerKey = resolvedReferenceKind(reference);
    if (!allowNonCellOwner && ownerKey !== 'cellId') {
      if (expectsCellOwner && reference.kind === 'cell' && typeof reference.parentPath === 'string') {
        const row = nodes.rows.find(candidate => isObject(candidate)
          && isObject(candidate.identity)
          && (candidate.identity as Record<string, unknown>).path === reference.parentPath);
        if (row && isObject(row)) addRowAncestry(row);
      }
      return;
    }
    if (!ownerKey) return;
    if (ownerKey === 'rowId') {
      const row = nodes.rows.find(candidate => isObject(candidate)
        && isObject(candidate.identity)
        && jsonEqual(candidate.identity, reference));
      if (row && isObject(row)) addRowAncestry(row);
      return;
    }
    keys.add(ownerKey);
  };
  const metadata = value.metadata;
  if (!isObject(metadata)) return keys;
  const addReferenceKind = (candidate: unknown, allowNonCellOwner = !expectsCellOwner): void => {
    if (!isObject(candidate)) return;
    const reference = isObject(candidate.reference) ? candidate.reference : candidate;
    addResolvedReference(reference, allowNonCellOwner);
  };
  addReferenceKind(metadata.receiver);
  addReferenceKind(metadata.result);
  if (isObject(metadata.semantics)) {
    for (const key of ['frame', 'table', 'row', 'cell']) addReferenceKind(metadata.semantics[key], true);
  }
  for (const key of operationReciprocalOwnerKeys(value, nodes)) keys.add(key);
  return keys;
};

const schemaOperationOwnerShape = (
  value: Record<string, unknown>,
  path: string,
  nodes: OperationOwnerEvidenceNodes,
): ClosedSchemaError => {
  const kind = String(value.kind);
  const allowed = OPERATION_OWNER_SHAPES[kind];
  if (allowed === undefined) return `${path}.kind has no emitted owner shape`;
  const requiredByStatus = value.status === 'applied'
    || value.status === 'rejected'
    || value.kernel !== undefined
    || kind === 'addTable';
  const metadataOwnerKeys = operationMetadataOwnerKeys(value, nodes);
  const expected = new Set<OperationOwnerKey>(requiredByStatus ? allowed : []);
  if (!requiredByStatus) {
    if (metadataOwnerKeys.has('cellId')) {
      for (const key of allowed) expected.add(key);
    } else {
      for (const key of allowed) if (metadataOwnerKeys.has(key)) expected.add(key);
    }
  }
  // For non-applied calls, the source-matched metadata/reference shape is the
  // independent evidence of which owner closure the emitter resolved.  Status
  // and kind alone do not authorize optional owner fields: unresolved owners
  // remain absent when the source evidence is absent.
  for (const key of ['frameId', 'tableId', 'rowId', 'cellId'] as const) {
    const present = Object.prototype.hasOwnProperty.call(value, key);
    if (present && !allowed.includes(key)) return `${path}.${key} is not emitted for ${kind}`;
    if (expected.has(key) && !present) return `${path}.${key} is required for the emitted ${value.status} ${kind} owner shape`;
    if (!expected.has(key) && present) return `${path}.${key} is not emitted for this ${value.status} ${kind} branch`;
  }
  return undefined;
};

const schemaOperation = (
  value: unknown,
  path: string,
  ownerEvidence?: OperationOwnerEvidenceNodes,
): ClosedSchemaError => {
  const objectError = schemaObject(value, path, ['id', 'kind', 'source', 'sourceOrder', 'modelOrder', 'status', 'metadata', 'descriptorFacts'], [
    'frameId', 'tableId', 'rowId', 'cellId', 'reason', 'kernel', 'scale', 'localExpansion',
  ]);
  if (objectError) return objectError;
  const operation = value as Record<string, unknown>;
  return schemaString(operation.id, `${path}.id`, true)
    || schemaEnum(operation.kind, `${path}.kind`, EVIDENCE_RELEVANT_CALL_NAMES)
    || schemaSource(operation.source, `${path}.source`)
    || schemaIndex(operation.sourceOrder, `${path}.sourceOrder`)
    || schemaIndex(operation.modelOrder, `${path}.modelOrder`)
    || schemaEnum(operation.status, `${path}.status`, ['applied', 'rejected', 'unresolved', 'unreachable', 'conditional'])
    || schemaMetadata(operation.metadata, `${path}.metadata`, isObject(operation.localExpansion))
    || schemaDescriptorFacts(operation.descriptorFacts, `${path}.descriptorFacts`)
    || schemaOptional(operation, 'frameId', (child, childPath) => schemaString(child, childPath, true), path)
    || schemaOptional(operation, 'tableId', (child, childPath) => schemaString(child, childPath, true), path)
    || schemaOptional(operation, 'rowId', (child, childPath) => schemaString(child, childPath, true), path)
    || schemaOptional(operation, 'cellId', (child, childPath) => schemaString(child, childPath, true), path)
    || schemaOptional(operation, 'reason', schemaString, path)
    || schemaOptional(operation, 'kernel', schemaTransition, path)
    || schemaOptional(operation, 'scale', schemaScale, path)
    || schemaOptional(operation, 'localExpansion', schemaLocalOperationExpansion, path)
    || (ownerEvidence ? schemaOperationOwnerShape(operation, path, ownerEvidence) : undefined);
};

const schemaNodeStatus = (value: unknown, path: string): ClosedSchemaError =>
  schemaEnum(value, path, ['projected', 'partial', 'refused', 'applied', 'rejected', 'unresolved', 'unreachable', 'conditional']);

const schemaIdArray = (value: unknown, path: string): ClosedSchemaError => {
  const error = schemaArray(value, path);
  if (error) return error;
  const values = value as readonly unknown[];
  if (!values.every(candidate => typeof candidate === 'string' && candidate.length > 0)) return `${path} contains an invalid ID`;
  if (new Set(values).size !== values.length) return `${path} contains duplicate IDs`;
  return undefined;
};

const schemaFrameTextureLayer = (value: unknown, path: string): ClosedSchemaError => {
  const objectError = schemaObject(value, path, [
    'name', 'source', 'sourceOrder', 'operationIds', 'descriptorFacts',
  ]);
  if (objectError) return objectError;
  const layer = value as Record<string, unknown>;
  return schemaEnum(layer.name, `${path}.name`, ['background', 'background2', 'overlay'])
    || schemaSource(layer.source, `${path}.source`)
    || schemaIndex(layer.sourceOrder, `${path}.sourceOrder`)
    || schemaIdArray(layer.operationIds, `${path}.operationIds`)
    || schemaDescriptorFacts(layer.descriptorFacts, `${path}.descriptorFacts`);
};

const schemaFrameTextureLayers = (value: unknown, path: string): ClosedSchemaError => {
  const arrayError = schemaArray(value, path);
  if (arrayError) return arrayError;
  const layers = value as readonly unknown[];
  if (layers.length !== FRAME_TEXTURE_LAYER_NAMES.length) return `${path} must contain exactly one background, background2, and overlay layer`;
  for (const [index, layer] of layers.entries()) {
    const error = schemaFrameTextureLayer(layer, `${path}[${index}]`);
    if (error) return error;
  }
  if (layers.some((layer, index) => !isObject(layer) || layer.name !== FRAME_TEXTURE_LAYER_NAMES[index])) {
    return `${path} must preserve shipped background layer source order`;
  }
  return undefined;
};

const schemaNode = (value: unknown, kind: 'frame' | 'table' | 'row' | 'cell', path: string): ClosedSchemaError => {
  const common = ['id', 'source', 'operationIds', 'descriptorFacts', 'status'];
  const required = kind === 'frame'
    ? [...common, 'tableIds']
    : kind === 'table'
      ? [...common, 'rowIds']
      : kind === 'row'
        ? [...common, 'cellIds']
        : [...common, 'metadataOperationIds', 'column'];
  const optional = kind === 'frame'
    ? ['identity', 'width', 'height', 'widthSource', 'heightSource', 'frameTextureLayers', 'blurBackground']
    : kind === 'table'
      ? ['identity', 'frameId', 'frameWidth', 'numColumns', 'requestedWidth', 'kernelState', 'height']
      : kind === 'row'
        ? ['identity', 'tableId', 'rowIndex', 'kernelState', 'height']
        : ['identity', 'tableId', 'rowId', 'rowIndex', 'kernelState', 'spanWidth', 'height'];
  const objectError = schemaObject(value, path, required, optional);
  if (objectError) return objectError;
  const node = value as Record<string, unknown>;
  const errors = schemaString(node.id, `${path}.id`, true)
    || schemaSource(node.source, `${path}.source`)
    || schemaIdArray(node.operationIds, `${path}.operationIds`)
    || schemaDescriptorFacts(node.descriptorFacts, `${path}.descriptorFacts`)
    || schemaNodeStatus(node.status, `${path}.status`);
  if (errors) return errors;
  const childIds = kind === 'frame' ? node.tableIds : kind === 'table' ? node.rowIds : kind === 'row' ? node.cellIds : undefined;
  if (childIds !== undefined) {
    const error = schemaIdArray(childIds, `${path}.${kind === 'frame' ? 'tableIds' : kind === 'table' ? 'rowIds' : 'cellIds'}`);
    if (error) return error;
  }
  if (kind === 'cell') {
    if (schemaIndex(node.column, `${path}.column`)) return `${path}.column is invalid`;
    if (schemaIdArray(node.metadataOperationIds, `${path}.metadataOperationIds`)) return `${path}.metadataOperationIds is invalid`;
  }
  if (kind === 'frame') {
    return schemaOptional(node, 'identity', schemaReference, path)
      || schemaOptional(node, 'width', schemaNumber, path)
      || schemaOptional(node, 'height', schemaNumber, path)
      || schemaOptional(node, 'widthSource', schemaSource, path)
      || schemaOptional(node, 'heightSource', schemaSource, path)
      || schemaOptional(node, 'frameTextureLayers', schemaFrameTextureLayers, path)
      || schemaOptional(node, 'blurBackground', schemaDescriptorFact, path);
  }
  const commonOptional = schemaOptional(node, 'identity', schemaReference, path)
    || schemaOptional(node, 'frameId', (child, childPath) => schemaString(child, childPath, true), path)
    || schemaOptional(node, 'tableId', (child, childPath) => schemaString(child, childPath, true), path)
    || schemaOptional(node, 'rowId', (child, childPath) => schemaString(child, childPath, true), path)
    || schemaOptional(node, 'rowIndex', schemaIndex, path)
    || schemaOptional(node, 'frameWidth', schemaNumber, path)
    || schemaOptional(node, 'numColumns', schemaIndex, path)
    || schemaOptional(node, 'requestedWidth', schemaNumber, path)
    || schemaOptional(node, 'kernelState', kind === 'table' ? schemaKernelState : kind === 'row' ? schemaKernelRow : schemaKernelCell, path)
    || schemaOptional(node, 'height', schemaHeight, path);
  if (commonOptional) return commonOptional;
  if (kind === 'cell') return schemaOptional(node, 'spanWidth', schemaHeight, path);
  return undefined;
};

const schemaAnalysis = (value: unknown, path: string): ClosedSchemaError => {
  const objectError = schemaObject(value, path, ['parsed', 'callModelGaps', 'callModelGapsTruncated', 'incomplete', 'profile', 'staticSource', 'gameVerification']);
  if (objectError) return objectError;
  const analysis = value as Record<string, unknown>;
  return schemaBoolean(analysis.parsed, `${path}.parsed`)
    || schemaIndex(analysis.callModelGaps, `${path}.callModelGaps`)
    || schemaBoolean(analysis.callModelGapsTruncated, `${path}.callModelGapsTruncated`)
    || schemaBoolean(analysis.incomplete, `${path}.incomplete`)
    || schemaEnum(analysis.profile, `${path}.profile`, ['complete', 'refused'])
    || schemaEnum(analysis.staticSource, `${path}.staticSource`, ['complete', 'incomplete', 'refused'])
    || schemaEnum(analysis.gameVerification, `${path}.gameVerification`, [X4_UI_LAYOUT_GAME_TRUTH]);
};

const schemaSampleCatalog = (value: unknown, path: string): ClosedSchemaError => {
  const objectError = schemaObject(value, path, ['id', 'sourceIdentity', 'targetId', 'entries']);
  if (objectError) return objectError;
  const catalog = value as Record<string, unknown>;
  const errors = schemaString(catalog.id, `${path}.id`, true)
    || schemaSourceIdentity(catalog.sourceIdentity, `${path}.sourceIdentity`)
    || schemaString(catalog.targetId, `${path}.targetId`, true)
    || schemaArray(catalog.entries, `${path}.entries`);
  if (errors) return errors;
  for (const [index, entryValue] of (catalog.entries as readonly unknown[]).entries()) {
    const entryError = schemaObject(entryValue, `${path}.entries[${index}]`, ['id', 'expression', 'expectedType', 'source', 'consumers', 'provenance']);
    if (entryError) return entryError;
    const entry = entryValue as Record<string, unknown>;
    const error = schemaString(entry.id, `${path}.entries[${index}].id`, true)
      || schemaString(entry.expression, `${path}.entries[${index}].expression`)
      || schemaScalarType(entry.expectedType, `${path}.entries[${index}].expectedType`)
      || schemaSource(entry.source, `${path}.entries[${index}].source`)
      || schemaArray(entry.consumers, `${path}.entries[${index}].consumers`)
      || schemaEnum(entry.provenance, `${path}.entries[${index}].provenance`, ['preview-only']);
    if (error) return error;
    for (const [consumerIndex, consumerValue] of (entry.consumers as readonly unknown[]).entries()) {
      const consumerError = schemaObject(consumerValue, `${path}.entries[${index}].consumers[${consumerIndex}]`, ['operationId', 'operationKind', 'field', 'source']);
      if (consumerError) return consumerError;
      const consumer = consumerValue as Record<string, unknown>;
      const consumerFieldError = schemaString(consumer.operationId, `${path}.entries[${index}].consumers[${consumerIndex}].operationId`, true)
        || schemaEnum(consumer.operationKind, `${path}.entries[${index}].consumers[${consumerIndex}].operationKind`, EVIDENCE_RELEVANT_CALL_NAMES)
        || schemaString(consumer.field, `${path}.entries[${index}].consumers[${consumerIndex}].field`, true)
        || schemaSource(consumer.source, `${path}.entries[${index}].consumers[${consumerIndex}].source`);
      if (consumerFieldError) return consumerFieldError;
    }
  }
  return undefined;
};

const schemaSampleBindings = (value: unknown, path: string): ClosedSchemaError => {
  const arrayError = schemaArray(value, path);
  if (arrayError) return arrayError;
  for (const [index, bindingValue] of (value as readonly unknown[]).entries()) {
    const objectError = schemaObject(bindingValue, `${path}[${index}]`, ['id', 'value', 'expectedType', 'source', 'provenance', 'status'], ['reason']);
    if (objectError) return objectError;
    const binding = bindingValue as Record<string, unknown>;
    const error = schemaString(binding.id, `${path}[${index}].id`, true)
      || schemaScalarType(binding.expectedType, `${path}[${index}].expectedType`)
      || schemaScalarMatchesType(binding.value, binding.expectedType, `${path}[${index}].value`)
      || schemaSource(binding.source, `${path}[${index}].source`)
      || schemaEnum(binding.provenance, `${path}[${index}].provenance`, ['preview-only'])
      || schemaEnum(binding.status, `${path}[${index}].status`, ['consumed', 'not-applied'])
      || schemaOptional(binding, 'reason', schemaString, `${path}[${index}]`);
    if (error) return error;
  }
  return undefined;
};

const schemaPreviewCatalog = (value: unknown, path: string): ClosedSchemaError => {
  const objectError = schemaObject(value, path, ['id', 'sourceIdentity', 'targetId', 'entries']);
  if (objectError) return objectError;
  const catalog = value as Record<string, unknown>;
  const errors = schemaString(catalog.id, `${path}.id`, true)
    || schemaSourceIdentity(catalog.sourceIdentity, `${path}.sourceIdentity`)
    || schemaString(catalog.targetId, `${path}.targetId`, true)
    || schemaArray(catalog.entries, `${path}.entries`);
  if (errors) return errors;
  for (const [index, entryValue] of (catalog.entries as readonly unknown[]).entries()) {
    const entryError = schemaObject(entryValue, `${path}.entries[${index}]`, [
      'id', 'boundaryId', 'armId', 'boundary', 'arm', 'armIndex', 'reachability', 'invocationIds', 'provenance',
    ]);
    if (entryError) return entryError;
    const entry = entryValue as Record<string, unknown>;
    const error = schemaString(entry.id, `${path}.entries[${index}].id`, true)
      || schemaString(entry.boundaryId, `${path}.entries[${index}].boundaryId`, true)
      || schemaString(entry.armId, `${path}.entries[${index}].armId`, true)
      || schemaSource(entry.boundary, `${path}.entries[${index}].boundary`)
      || schemaEnum(entry.arm, `${path}.entries[${index}].arm`, ['then', 'elseif', 'else'])
      || schemaIndex(entry.armIndex, `${path}.entries[${index}].armIndex`)
      || schemaEnum(entry.reachability, `${path}.entries[${index}].reachability`, ['reachable', 'conditional', 'unreachable'])
      || schemaIdArray(entry.invocationIds, `${path}.entries[${index}].invocationIds`)
      || schemaEnum(entry.provenance, `${path}.entries[${index}].provenance`, ['preview-only']);
    if (error) return error;
  }
  return undefined;
};

const schemaExpansionSelection = (value: unknown, path: string): ClosedSchemaError => {
  const objectError = schemaObject(value, path, ['id', 'boundaryId', 'armId', 'boundary', 'provenance']);
  if (objectError) return objectError;
  const selection = value as Record<string, unknown>;
  return schemaString(selection.id, `${path}.id`, true)
    || schemaString(selection.boundaryId, `${path}.boundaryId`, true)
    || schemaString(selection.armId, `${path}.armId`, true)
    || schemaSource(selection.boundary, `${path}.boundary`)
    || schemaEnum(selection.provenance, `${path}.provenance`, ['preview-only']);
};

const schemaExpansionInvocation = (value: unknown, path: string): ClosedSchemaError => {
  const objectError = schemaObject(value, path, [
    'id', 'sourceInvocationId', 'source', 'ancestry', 'depth', 'status', 'resultConsumed', 'previewPathSelectionIds', 'operationIds',
  ], ['calleeDeclarationId', 'resolution', 'reason']);
  if (objectError) return objectError;
  const invocation = value as Record<string, unknown>;
  const errors = schemaString(invocation.id, `${path}.id`, true)
    || schemaString(invocation.sourceInvocationId, `${path}.sourceInvocationId`, true)
    || schemaSource(invocation.source, `${path}.source`)
    || schemaIdArray(invocation.ancestry, `${path}.ancestry`)
    || schemaIndex(invocation.depth, `${path}.depth`)
    || schemaEnum(invocation.status, `${path}.status`, ['expanded', 'rejected', 'conditional', 'unreachable', 'looped'])
    || schemaBoolean(invocation.resultConsumed, `${path}.resultConsumed`)
    || schemaIdArray(invocation.previewPathSelectionIds, `${path}.previewPathSelectionIds`)
    || schemaIdArray(invocation.operationIds, `${path}.operationIds`)
    || schemaOptional(invocation, 'calleeDeclarationId', (child, childPath) => schemaString(child, childPath, true), path)
    || schemaOptional(invocation, 'resolution', (child, childPath) => schemaEnum(child, childPath, ['direct', 'alias']), path)
    || schemaOptional(invocation, 'reason', schemaString, path);
  return errors;
};

const schemaLocalExpansion = (value: unknown, path: string): ClosedSchemaError => {
  const objectError = schemaObject(value, path, ['limits', 'invocations', 'previewPathCatalog', 'previewPathSelections']);
  if (objectError) return objectError;
  const expansion = value as Record<string, unknown>;
  const limitsError = schemaObject(expansion.limits, `${path}.limits`, ['maxDepth', 'maxInvocations']);
  if (limitsError) return limitsError;
  const limits = expansion.limits as Record<string, unknown>;
  const errors = schemaIndex(limits.maxDepth, `${path}.limits.maxDepth`)
    || schemaIndex(limits.maxInvocations, `${path}.limits.maxInvocations`)
    || schemaArray(expansion.invocations, `${path}.invocations`)
    || schemaPreviewCatalog(expansion.previewPathCatalog, `${path}.previewPathCatalog`)
    || schemaArray(expansion.previewPathSelections, `${path}.previewPathSelections`);
  if (errors) return errors;
  for (const [index, invocation] of (expansion.invocations as readonly unknown[]).entries()) {
    const error = schemaExpansionInvocation(invocation, `${path}.invocations[${index}]`);
    if (error) return error;
  }
  for (const [index, selection] of (expansion.previewPathSelections as readonly unknown[]).entries()) {
    const error = schemaExpansionSelection(selection, `${path}.previewPathSelections[${index}]`);
    if (error) return error;
  }
  return undefined;
};

const schemaGap = (value: unknown, path: string): ClosedSchemaError => {
  const objectError = schemaObject(value, path, ['category', 'status', 'reason', 'source'], ['expression', 'operationId', 'nodeId']);
  if (objectError) return objectError;
  const gap = value as Record<string, unknown>;
  return schemaEnum(gap.category, `${path}.category`, X4_LAYOUT_GAP_CATEGORIES)
    || schemaEnum(gap.status, `${path}.status`, ['dynamic', 'unknown', 'unsupported', 'incomplete', 'refused'])
    || schemaString(gap.reason, `${path}.reason`)
    || schemaSource(gap.source, `${path}.source`)
    || schemaOptional(gap, 'expression', schemaString, path)
    || schemaOptional(gap, 'operationId', (child, childPath) => schemaString(child, childPath, true), path)
    || schemaOptional(gap, 'nodeId', (child, childPath) => schemaString(child, childPath, true), path);
};

const schemaProgram = (value: unknown): ClosedSchemaError => {
  const objectError = schemaObject(value, 'program', [
    'status', 'target', 'profile', 'analysis', 'localIdentities', 'frames', 'tables', 'rows', 'cells', 'operations', 'gaps', 'sampleCatalog', 'previewSampleBindings', 'verification',
  ], ['localExpansion']);
  if (objectError) return objectError;
  const program = value as Record<string, unknown>;
  const errors = schemaEnum(program.status, 'program.status', ['projected', 'partial', 'refused'])
    || schemaTarget(program.target, 'program.target')
    || schemaProfile(program.profile, 'program.profile')
    || schemaAnalysis(program.analysis, 'program.analysis')
    || schemaArray(program.frames, 'program.frames')
    || schemaArray(program.tables, 'program.tables')
    || schemaArray(program.rows, 'program.rows')
    || schemaArray(program.cells, 'program.cells')
    || schemaArray(program.operations, 'program.operations')
    || schemaArray(program.gaps, 'program.gaps')
    || schemaSampleCatalog(program.sampleCatalog, 'program.sampleCatalog')
    || schemaSampleBindings(program.previewSampleBindings, 'program.previewSampleBindings')
    || schemaObject(program.verification, 'program.verification', ['game', 'gameVerified'])
    || ((program.verification as Record<string, unknown>).game === X4_UI_LAYOUT_GAME_TRUTH
      ? undefined
      : 'program.verification.game must retain the game-truth boundary')
    || ((program.verification as Record<string, unknown>).gameVerified === false
      ? undefined
      : 'program.verification.gameVerified must remain false')
    || schemaOptional(program, 'localExpansion', schemaLocalExpansion, 'program');
  if (errors) return errors;
  const localIdentityError = schemaEvidenceLocalIdentities(
    program.localIdentities,
    'program.localIdentities',
    (program.target as Record<string, unknown>).sourceIdentity as X4UiLayoutModelIdentity,
  );
  if (localIdentityError) return localIdentityError;
  if (!jsonEqual(
    (program.profile as Record<string, unknown>).source,
    (program.target as Record<string, unknown>).sourceIdentity,
  )) {
    return 'program.profile.source does not match program.target.sourceIdentity';
  }
  for (const [index, node] of (program.frames as readonly unknown[]).entries()) {
    const error = schemaNode(node, 'frame', `program.frames[${index}]`);
    if (error) return error;
  }
  for (const [index, node] of (program.tables as readonly unknown[]).entries()) {
    const error = schemaNode(node, 'table', `program.tables[${index}]`);
    if (error) return error;
  }
  for (const [index, node] of (program.rows as readonly unknown[]).entries()) {
    const error = schemaNode(node, 'row', `program.rows[${index}]`);
    if (error) return error;
  }
  for (const [index, node] of (program.cells as readonly unknown[]).entries()) {
    const error = schemaNode(node, 'cell', `program.cells[${index}]`);
    if (error) return error;
  }
  for (const [index, operation] of (program.operations as readonly unknown[]).entries()) {
    const error = schemaOperation(operation, `program.operations[${index}]`, {
      frames: program.frames as readonly unknown[],
      tables: program.tables as readonly unknown[],
      rows: program.rows as readonly unknown[],
      cells: program.cells as readonly unknown[],
    });
    if (error) return error;
  }
  for (const [index, gap] of (program.gaps as readonly unknown[]).entries()) {
    const error = schemaGap(gap, `program.gaps[${index}]`);
    if (error) return error;
  }
  return undefined;
};

const schemaEvidenceExpansionLink = (value: unknown, path: string): ClosedSchemaError => {
  const objectError = schemaObject(value, path, [
    'invocationInstanceId', 'sourceInvocationId', 'ancestry', 'depth', 'selectionIds', 'catalogId',
  ]);
  if (objectError) return objectError;
  const link = value as Record<string, unknown>;
  return schemaString(link.invocationInstanceId, `${path}.invocationInstanceId`, true)
    || schemaString(link.sourceInvocationId, `${path}.sourceInvocationId`, true)
    || schemaIdArray(link.ancestry, `${path}.ancestry`)
    || schemaIndex(link.depth, `${path}.depth`)
    || schemaIdArray(link.selectionIds, `${path}.selectionIds`)
    || schemaString(link.catalogId, `${path}.catalogId`, true);
};

const schemaAuthorityCall = (value: unknown, path: string): ClosedSchemaError => {
  const objectError = schemaObject(value, path, [
    'id', 'operationId', 'kind', 'source', 'sourceOrder', 'modelOrder', 'streamIndex', 'status', 'reachability',
  ], ['expansion']);
  if (objectError) return objectError;
  const call = value as Record<string, unknown>;
  return schemaString(call.id, `${path}.id`, true)
    || schemaString(call.operationId, `${path}.operationId`, true)
    || schemaEnum(call.kind, `${path}.kind`, EVIDENCE_RELEVANT_CALL_NAMES)
    || schemaSource(call.source, `${path}.source`)
    || schemaIndex(call.sourceOrder, `${path}.sourceOrder`)
    || schemaIndex(call.modelOrder, `${path}.modelOrder`)
    || schemaIndex(call.streamIndex, `${path}.streamIndex`)
    || schemaEnum(call.status, `${path}.status`, ['applied', 'rejected', 'unresolved', 'unreachable', 'conditional'])
    || schemaEnum(call.reachability, `${path}.reachability`, ['reachable', 'conditional', 'unreachable'])
    || schemaOptional(call, 'expansion', schemaEvidenceExpansionLink, path);
};

const schemaAuthorityOperation = (value: unknown, path: string): ClosedSchemaError => {
  const objectError = schemaObject(value, path, [
    'id', 'callId', 'kind', 'source', 'sourceOrder', 'modelOrder', 'streamIndex', 'status', 'snapshot',
  ], ['frameId', 'tableId', 'rowId', 'cellId', 'reason', 'expansion']);
  if (objectError) return objectError;
  const operation = value as Record<string, unknown>;
  return schemaString(operation.id, `${path}.id`, true)
    || schemaString(operation.callId, `${path}.callId`, true)
    || schemaEnum(operation.kind, `${path}.kind`, EVIDENCE_RELEVANT_CALL_NAMES)
    || schemaSource(operation.source, `${path}.source`)
    || schemaIndex(operation.sourceOrder, `${path}.sourceOrder`)
    || schemaIndex(operation.modelOrder, `${path}.modelOrder`)
    || schemaIndex(operation.streamIndex, `${path}.streamIndex`)
    || schemaEnum(operation.status, `${path}.status`, ['applied', 'rejected', 'unresolved', 'unreachable', 'conditional'])
    || schemaOptional(operation, 'frameId', (child, childPath) => schemaString(child, childPath, true), path)
    || schemaOptional(operation, 'tableId', (child, childPath) => schemaString(child, childPath, true), path)
    || schemaOptional(operation, 'rowId', (child, childPath) => schemaString(child, childPath, true), path)
    || schemaOptional(operation, 'cellId', (child, childPath) => schemaString(child, childPath, true), path)
    || schemaOptional(operation, 'reason', schemaString, path)
    || schemaOptional(operation, 'expansion', schemaEvidenceExpansionLink, path)
    || schemaOperation(operation.snapshot, `${path}.snapshot`);
};

const schemaAuthoritySourceBinding = (value: unknown, path: string): ClosedSchemaError => {
  const objectError = schemaObject(value, path, [
    'id', 'callId', 'operationId', 'kind', 'source', 'sourceOrder', 'modelOrder', 'streamIndex', 'reachability', 'metadata',
  ], ['expansion']);
  if (objectError) return objectError;
  const binding = value as Record<string, unknown>;
  const sourceError = schemaSource(binding.source, `${path}.source`);
  if (sourceError) return sourceError;
  const source = binding.source as X4UiSourceLocation;
  if (binding.sourceOrder !== source.start.offset) return `${path}.sourceOrder does not match source.start.offset`;
  return schemaString(binding.id, `${path}.id`, true)
    || schemaString(binding.callId, `${path}.callId`, true)
    || schemaString(binding.operationId, `${path}.operationId`, true)
    || schemaEnum(binding.kind, `${path}.kind`, EVIDENCE_RELEVANT_CALL_NAMES)
    || schemaIndex(binding.sourceOrder, `${path}.sourceOrder`)
    || schemaIndex(binding.modelOrder, `${path}.modelOrder`)
    || schemaIndex(binding.streamIndex, `${path}.streamIndex`)
    || schemaEnum(binding.reachability, `${path}.reachability`, ['reachable', 'conditional', 'unreachable'])
    || schemaMetadata(binding.metadata, `${path}.metadata`, binding.expansion !== undefined)
    || schemaOptional(binding, 'expansion', schemaEvidenceExpansionLink, path);
};

const schemaAuthorityNodeLedger = (
  value: unknown,
  kind: 'frame' | 'table' | 'row' | 'cell',
  path: string,
): ClosedSchemaError => {
  const required = kind === 'cell' ? ['id', 'operationIds', 'metadataOperationIds', 'snapshot'] : ['id', 'operationIds', 'snapshot'];
  const objectError = schemaObject(value, path, required);
  if (objectError) return objectError;
  const ledger = value as Record<string, unknown>;
  return schemaString(ledger.id, `${path}.id`, true)
    || schemaIdArray(ledger.operationIds, `${path}.operationIds`)
    || (kind === 'cell' ? schemaIdArray(ledger.metadataOperationIds, `${path}.metadataOperationIds`) : undefined)
    || schemaNode(ledger.snapshot, kind, `${path}.snapshot`);
};

const schemaEvidenceLocalIdentities = (
  value: unknown,
  path: string,
  sourceIdentity: X4UiLayoutModelIdentity,
): ClosedSchemaError => {
  const objectError = schemaObject(value, path, ['functions', 'invocations']);
  if (objectError) return objectError;
  const identities = value as Record<string, unknown>;
  const functionsError = schemaArray(identities.functions, `${path}.functions`)
    || schemaArray(identities.invocations, `${path}.invocations`);
  if (functionsError) return functionsError;
  const functionIds = new Set<string>();
  let previousFunctionStart = -1;
  let previousFunctionEnd = -1;
  for (const [index, functionValue] of (identities.functions as readonly unknown[]).entries()) {
    const functionPath = `${path}.functions[${index}]`;
    const functionError = schemaObject(functionValue, functionPath, ['id', 'source', 'parameters'])
      || schemaSource((functionValue as Record<string, unknown>).source, `${functionPath}.source`)
      || schemaArray((functionValue as Record<string, unknown>).parameters, `${functionPath}.parameters`);
    if (functionError) return functionError;
    const declaration = functionValue as Record<string, unknown>;
    const source = declaration.source as X4UiSourceLocation;
    if (source.file !== sourceIdentity.file
      || !sameOptionalString(source.sourcePath, sourceIdentity.sourcePath)
      || schemaString(declaration.id, `${functionPath}.id`, true)
      || declaration.id !== programId('local-function', localInvocationIdentityKey(source))
      || functionIds.has(declaration.id as string)
      || source.start.offset < previousFunctionStart
      || (source.start.offset === previousFunctionStart && source.end.offset < previousFunctionEnd)) {
      return `${functionPath} does not match a unique source-bound local declaration`;
    }
    functionIds.add(declaration.id as string);
    previousFunctionStart = source.start.offset;
    previousFunctionEnd = source.end.offset;
    const parameterIds = new Set<string>();
    const parameterIndexes = new Set<number>();
    let previousParameterStart = -1;
    let previousParameterEnd = -1;
    for (const [parameterIndex, parameter] of (declaration.parameters as readonly unknown[]).entries()) {
      const parameterPath = `${functionPath}.parameters[${parameterIndex}]`;
      const parameterError = schemaParameterIdentity(parameter, parameterPath);
      if (parameterError) return parameterError;
      const parameterRecord = parameter as Record<string, unknown>;
      const parameterSource = parameterRecord.source as X4UiSourceLocation;
      const expectedParameterId = programId(
        'local-parameter',
        `${declaration.id}|${parameterRecord.index}|${parameterSource.start.offset}|${parameterSource.end.offset}`,
      );
      if (parameterRecord.declarationId !== declaration.id
        || parameterRecord.index !== parameterIndex
        || parameterIndexes.has(parameterRecord.index as number)
        || parameterIds.has(parameterRecord.id as string)
        || parameterRecord.id !== expectedParameterId
        || parameterSource.file !== sourceIdentity.file
        || !sameOptionalString(parameterSource.sourcePath, sourceIdentity.sourcePath)
        || parameterSource.start.offset >= parameterSource.end.offset
        || parameterSource.start.offset <= previousParameterStart
        || parameterSource.start.offset < previousParameterEnd
        || parameterSource.start.offset < source.start.offset
        || parameterSource.end.offset > source.end.offset) {
        return `${parameterPath} does not match its owning local declaration`;
      }
      parameterIndexes.add(parameterRecord.index as number);
      parameterIds.add(parameterRecord.id as string);
      previousParameterStart = parameterSource.start.offset;
      previousParameterEnd = parameterSource.end.offset;
    }
  }
  const invocationIds = new Set<string>();
  let previousInvocationStart = -1;
  let previousInvocationEnd = -1;
  for (const [index, invocationValue] of (identities.invocations as readonly unknown[]).entries()) {
    const invocationPath = `${path}.invocations[${index}]`;
    const invocationObjectError = schemaObject(invocationValue, invocationPath, ['id', 'source', 'expression'], ['calleeDeclarationId']);
    if (invocationObjectError) return invocationObjectError;
    const invocation = invocationValue as Record<string, unknown>;
    const sourceError = schemaSource(invocation.source, `${invocationPath}.source`)
      || schemaString(invocation.expression, `${invocationPath}.expression`, true)
      || schemaOptional(invocation, 'calleeDeclarationId', (child, childPath) => schemaString(child, childPath, true), invocationPath);
    if (sourceError) return sourceError;
    const source = invocation.source as X4UiSourceLocation;
    if (source.file !== sourceIdentity.file
      || !sameOptionalString(source.sourcePath, sourceIdentity.sourcePath)
      || invocation.id !== programId('local-invocation', localInvocationIdentityKey(source))
      || invocationIds.has(invocation.id as string)
      || source.start.offset < previousInvocationStart
      || (source.start.offset === previousInvocationStart && source.end.offset < previousInvocationEnd)
      || (invocation.calleeDeclarationId !== undefined && !functionIds.has(invocation.calleeDeclarationId as string))) {
      return `${invocationPath} does not match a unique source-bound local invocation`;
    }
    invocationIds.add(invocation.id as string);
    previousInvocationStart = source.start.offset;
    previousInvocationEnd = source.end.offset;
  }
  return undefined;
};

const schemaAuthority = (value: unknown): ClosedSchemaError => {
  const objectError = schemaObject(value, 'authority', [
    'version', 'sourceIdentity', 'profile', 'targetId', 'targetSource', 'calls', 'operations', 'sourceBindings', 'nodes', 'localIdentities', 'gaps', 'linkedGapIndexes', 'unlinkedGapIndexes',
  ], ['expansion']);
  if (objectError) return objectError;
  const authority = value as Record<string, unknown>;
  const errors = authority.version === 3 ? undefined : 'authority.version is unsupported';
  if (errors) return errors;
  const baseError = schemaSourceIdentity(authority.sourceIdentity, 'authority.sourceIdentity')
    || schemaProfile(authority.profile, 'authority.profile')
    || schemaString(authority.targetId, 'authority.targetId', true)
    || schemaSource(authority.targetSource, 'authority.targetSource')
    || schemaArray(authority.calls, 'authority.calls')
    || schemaArray(authority.operations, 'authority.operations')
    || schemaArray(authority.sourceBindings, 'authority.sourceBindings')
    || schemaArray(authority.gaps, 'authority.gaps')
    || schemaArray(authority.linkedGapIndexes, 'authority.linkedGapIndexes')
    || schemaArray(authority.unlinkedGapIndexes, 'authority.unlinkedGapIndexes')
    || schemaObject(authority.nodes, 'authority.nodes', ['frames', 'tables', 'rows', 'cells'])
    || schemaEvidenceLocalIdentities(authority.localIdentities, 'authority.localIdentities', authority.sourceIdentity as X4UiLayoutModelIdentity);
  if (baseError) return baseError;
  if (!jsonEqual((authority.profile as Record<string, unknown>).source, authority.sourceIdentity)) {
    return 'authority.profile.source does not match authority.sourceIdentity';
  }
  for (const [index, call] of (authority.calls as readonly unknown[]).entries()) {
    const error = schemaAuthorityCall(call, `authority.calls[${index}]`);
    if (error) return error;
  }
  for (const [index, operation] of (authority.operations as readonly unknown[]).entries()) {
    const error = schemaAuthorityOperation(operation, `authority.operations[${index}]`);
    if (error) return error;
  }
  for (const [index, binding] of (authority.sourceBindings as readonly unknown[]).entries()) {
    const error = schemaAuthoritySourceBinding(binding, `authority.sourceBindings[${index}]`);
    if (error) return error;
  }
  for (const [index, gap] of (authority.gaps as readonly unknown[]).entries()) {
    const error = schemaGap(gap, `authority.gaps[${index}]`);
    if (error) return error;
  }
  for (const key of ['linkedGapIndexes', 'unlinkedGapIndexes']) {
    for (const [index, gapIndex] of (authority[key] as readonly unknown[]).entries()) {
      const error = schemaIndex(gapIndex, `authority.${key}[${index}]`);
      if (error) return error;
    }
  }
  const nodes = authority.nodes as Record<string, unknown>;
  for (const kind of ['frame', 'table', 'row', 'cell'] as const) {
    const collection = kind === 'frame' ? nodes.frames : kind === 'table' ? nodes.tables : kind === 'row' ? nodes.rows : nodes.cells;
    const arrayError = schemaArray(collection, `authority.nodes.${kind}s`);
    if (arrayError) return arrayError;
    for (const [index, node] of (collection as readonly unknown[]).entries()) {
      const error = schemaAuthorityNodeLedger(node, kind, `authority.nodes.${kind}s[${index}]`);
      if (error) return error;
    }
  }
  const expansionError = schemaOptional(authority, 'expansion', (child, childPath) => {
      const object = schemaObject(child, childPath, ['limits', 'catalog', 'selections', 'invocations']);
      if (object) return object;
      const expansion = child as Record<string, unknown>;
      const limits = schemaObject(expansion.limits, `${childPath}.limits`, ['maxDepth', 'maxInvocations']);
      if (limits) return limits;
      const limitValues = expansion.limits as Record<string, unknown>;
      return schemaIndex(limitValues.maxDepth, `${childPath}.limits.maxDepth`)
        || schemaIndex(limitValues.maxInvocations, `${childPath}.limits.maxInvocations`)
        || schemaPreviewCatalog(expansion.catalog, `${childPath}.catalog`)
        || schemaArray(expansion.selections, `${childPath}.selections`)
        || schemaArray(expansion.invocations, `${childPath}.invocations`)
        || (expansion.selections as readonly unknown[]).map((selection, index) => schemaExpansionSelection(selection, `${childPath}.selections[${index}]`)).find(Boolean)
        || (expansion.invocations as readonly unknown[]).map((invocation, index) => schemaExpansionInvocation(invocation, `${childPath}.invocations[${index}]`)).find(Boolean);
    }, 'authority');
  return expansionError;
};

const evidenceSafeIndex = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

const evidenceId = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const evidenceDeepFrozen = (value: unknown, seen = new Set<object>()): boolean => {
  if (!isObject(value) && !Array.isArray(value)) return true;
  const objectValue = value as object;
  if (seen.has(objectValue)) return true;
  seen.add(objectValue);
  if (!Object.isFrozen(objectValue)) return false;
  return Object.values(objectValue).every(child => evidenceDeepFrozen(child, seen));
};

const evidencePosition = (value: unknown): boolean => {
  if (!isObject(value) || !exactKeys(value, ['line', 'column', 'offset'])) return false;
  const position = value as { readonly line: unknown; readonly column: unknown; readonly offset: unknown };
  return evidenceSafeIndex(position.line) && evidenceSafeIndex(position.column) && evidenceSafeIndex(position.offset);
};

const evidenceSource = (value: unknown): boolean => {
  if (!isObject(value) || !exactKeys(value, ['file', 'start', 'end'], ['sourcePath'])) return false;
  const source = value as { readonly file: unknown; readonly sourcePath?: unknown; readonly start: unknown; readonly end: unknown };
  const start = source.start as { readonly offset?: unknown };
  const end = source.end as { readonly offset?: unknown };
  return typeof source.file === 'string'
    && source.file.length > 0
    && (source.sourcePath === undefined || typeof source.sourcePath === 'string')
    && evidencePosition(source.start)
    && evidencePosition(source.end)
    && typeof start.offset === 'number'
    && typeof end.offset === 'number'
    && start.offset <= end.offset;
};

const evidenceExpansionLink = (value: unknown): boolean => {
  if (!isObject(value) || !exactKeys(value, [
    'invocationInstanceId', 'sourceInvocationId', 'ancestry', 'depth', 'selectionIds', 'catalogId',
  ])) return false;
  return evidenceId(value.invocationInstanceId)
    && evidenceId(value.sourceInvocationId)
    && Array.isArray(value.ancestry)
    && value.ancestry.length > 0
    && value.ancestry.every(evidenceId)
    && evidenceSafeIndex(value.depth)
    && Array.isArray(value.selectionIds)
    && value.selectionIds.every(evidenceId)
    && evidenceId(value.catalogId);
};

/**
 * Validate the separate producer-owned evidence authority against the emitted program ledgers.
 * This is intentionally pure and exact: it never reconstructs calls, reruns
 * parsing, or accepts an authority after an operation or gap ledger mutation.
 */
export const validateX4UiLayoutEvidencePair = (
  program: X4UiLayoutProgram,
  authority: X4UiLayoutEvidenceAuthority,
): X4UiLayoutEvidenceValidationResult => {
  const fail = (reason: string, index?: number): X4UiLayoutEvidenceValidationResult => ({
    valid: false,
    reason,
    ...(index === undefined ? {} : { index }),
  });
  let programSchemaError: ClosedSchemaError;
  let authoritySchemaError: ClosedSchemaError;
  try {
    programSchemaError = closedJsonDomain(program, 'program') || schemaProgram(program);
    authoritySchemaError = closedJsonDomain(authority, 'authority') || schemaAuthority(authority);
  } catch {
    return fail('program or authority schema could not be inspected');
  }
  if (programSchemaError) return fail(`program schema is invalid: ${programSchemaError}`);
  if (authoritySchemaError) return fail(`authority schema is invalid: ${authoritySchemaError}`);
  const jsonRoundTrip = (value: unknown, label: string): X4UiLayoutEvidenceValidationResult | undefined => {
    try {
      const roundTrip = JSON.parse(JSON.stringify(value));
      return jsonEqual(roundTrip, value) ? undefined : fail(`${label} JSON round-trip is lossy`);
    } catch {
      return fail(`${label} is not JSON serializable`);
    }
  };
  const programRoundTripError = jsonRoundTrip(program, 'program');
  if (programRoundTripError) return programRoundTripError;
  const authorityRoundTripError = jsonRoundTrip(authority, 'evidence authority');
  if (authorityRoundTripError) return authorityRoundTripError;
  if (!Array.isArray(program.operations) || !Array.isArray(program.gaps)) return fail('program operation or gap ledger is malformed');
  if (!evidenceDeepFrozen(program) || !evidenceDeepFrozen(authority)) return fail('program and authority must be deeply frozen');
  const manifestValue = authority as unknown;
  const manifest = isObject(manifestValue) && !Array.isArray(manifestValue) ? manifestValue : undefined;
  if (!manifest) return fail('evidence authority is missing or malformed');
  if (!exactKeys(manifest, [
    'version', 'sourceIdentity', 'profile', 'targetId', 'targetSource', 'calls', 'operations', 'sourceBindings', 'nodes', 'localIdentities', 'gaps', 'linkedGapIndexes', 'unlinkedGapIndexes',
  ], ['expansion'])) return fail('evidence authority contains an unknown or missing top-level key');
  if (manifest.version !== 3) return fail('evidence authority version is unsupported');
  if (manifest.targetId !== program.target.id) return fail('evidence authority target identity does not match the program target');
  const targetSource = manifest.targetSource as unknown as X4UiSourceLocation;
  if (!evidenceSource(manifest.targetSource) || !locationsEqual(targetSource, program.target.source)) {
    return fail('evidence authority target source does not match the program target');
  }
  if (!isObject(manifest.sourceIdentity)
    || !exactKeys(manifest.sourceIdentity, ['file', 'sha256'], ['sourcePath'])
    || typeof manifest.sourceIdentity.file !== 'string'
    || manifest.sourceIdentity.file.length === 0
    || typeof manifest.sourceIdentity.sha256 !== 'string'
    || !/^[0-9a-f]{64}$/i.test(manifest.sourceIdentity.sha256)) {
    return fail('evidence authority source identity is malformed');
  }
  if (!jsonEqual(manifest.sourceIdentity, program.target.sourceIdentity)) {
    return fail('evidence authority source identity does not match the program target source identity');
  }
  if (!jsonEqual(manifest.profile, program.profile)) {
    return fail('evidence authority profile does not exactly match the emitted program profile');
  }
  if (!jsonEqual(program.localIdentities, manifest.localIdentities)) {
    return fail('program and evidence authority local identity ledgers are not exactly equal');
  }
  if (!Array.isArray(manifest.sourceBindings)
    || manifest.sourceBindings.length !== program.operations.length) {
    return fail('evidence source-call binding cardinality does not match the emitted operation ledger');
  }
  for (let index = 0; index < program.operations.length; index += 1) {
    const operation = program.operations[index];
    const sourceBinding = manifest.sourceBindings[index] as unknown as X4UiLayoutEvidenceSourceBinding;
    const authorityOperation = manifest.operations[index] as unknown as X4UiLayoutEvidenceOperation;
    if (!sourceBinding || !authorityOperation
      || sourceBinding.id !== evidenceSourceBindingIdFor(operation.id)
      || sourceBinding.callId !== programId('evidence-call', operation.id)
      || sourceBinding.operationId !== operation.id
      || sourceBinding.kind !== operation.kind
      || !locationsEqual(sourceBinding.source, operation.source)
      || sourceBinding.sourceOrder !== operation.sourceOrder
      || sourceBinding.sourceOrder !== operation.source.start.offset
      || sourceBinding.modelOrder !== operation.modelOrder
      || sourceBinding.streamIndex !== index
      || !jsonEqual(sourceBinding.metadata, operation.metadata)
      || !jsonEqual(sourceBinding.metadata, authorityOperation.snapshot.metadata)) {
      return fail('emitted operation metadata does not match detached source-call binding', index);
    }
    const call = manifest.calls[index] as unknown as X4UiLayoutEvidenceCall;
    if (!call
      || sourceBinding.callId !== call.id
      || sourceBinding.operationId !== call.operationId
      || sourceBinding.reachability !== call.reachability
      || !jsonEqual(sourceBinding.expansion, call.expansion)) {
      return fail('detached source-call binding does not match its source-call evidence', index);
    }
  }
  const framesById = new Map(program.frames.map(frame => [frame.id, frame] as const));
  const tablesById = new Map(program.tables.map(table => [table.id, table] as const));
  const rowsById = new Map(program.rows.map(row => [row.id, row] as const));
  const cellsById = new Map(program.cells.map(cell => [cell.id, cell] as const));
  const localInvocationsById = new Map(
    program.localIdentities.invocations.map(invocation => [invocation.id, invocation] as const),
  );
  const validateLocalInvocationResults = (
    value: unknown,
    path: string,
    seen = new Set<object>(),
  ): X4UiLayoutEvidenceValidationResult | undefined => {
    if (!value || typeof value !== 'object') return undefined;
    const objectValue = value as object;
    if (seen.has(objectValue)) return undefined;
    seen.add(objectValue);
    if (Array.isArray(value)) {
      for (const [index, child] of value.entries()) {
        const error = validateLocalInvocationResults(child, `${path}[${index}]`, seen);
        if (error) return error;
      }
      return undefined;
    }
    const record = value as Record<string, unknown>;
    if (record.localInvocationResult !== undefined) {
      const localResult = record.localInvocationResult as Record<string, unknown>;
      const invocation = localInvocationsById.get(String(localResult.invocationId));
      if (!invocation) return fail(`${path}.localInvocationResult does not resolve to an emitted local invocation`);
      if (!jsonEqual(localResult.source, invocation.source)) {
        return fail(`${path}.localInvocationResult source does not match its emitted invocation`);
      }
      if (localResult.expression !== invocation.expression) {
        return fail(`${path}.localInvocationResult expression does not match its emitted invocation`);
      }
    }
    for (const [key, child] of Object.entries(record)) {
      const error = validateLocalInvocationResults(child, `${path}.${key}`, seen);
      if (error) return error;
    }
    return undefined;
  };
  const validateDirectLocalInvocationOccurrences = (
    value: unknown,
    path: string,
    sampledSources: ReadonlySet<string>,
    directInvocationIds: ReadonlySet<string>,
    expansionInvocationIds: ReadonlySet<string>,
    enforceOccurrence = true,
    seen = new Set<object>(),
  ): X4UiLayoutEvidenceValidationResult | undefined => {
    if (!value || typeof value !== 'object') return undefined;
    const objectValue = value as object;
    if (seen.has(objectValue)) return undefined;
    seen.add(objectValue);
    if (Array.isArray(value)) {
      for (const [index, child] of value.entries()) {
        const error = validateDirectLocalInvocationOccurrences(
          child,
          `${path}[${index}]`,
          sampledSources,
          directInvocationIds,
          expansionInvocationIds,
          enforceOccurrence,
          seen,
        );
        if (error) return error;
      }
      return undefined;
    }
    const record = value as Record<string, unknown>;
    const localResult = record.localInvocationResult as Record<string, unknown> | undefined;
    const localResultInvocationId = localResult === undefined ? undefined : String(localResult.invocationId);
    if (enforceOccurrence
      && localResult !== undefined
      && record.location !== undefined
      && !sampledSources.has(locationKey(localResult.source as X4UiSourceLocation))
      && (!expansionInvocationIds.has(localResultInvocationId!) || directInvocationIds.has(localResultInvocationId!))
      && !jsonEqual(localResult.source, record.location)) {
      return fail(`${path}.localInvocationResult source does not match its direct consumer location`);
    }
    for (const [key, child] of Object.entries(record)) {
      const ownerOrResultKey = key === 'receiver' || key === 'result'
        || key === 'frame' || key === 'table' || key === 'row' || key === 'cell'
        || key === 'dataFlow';
      const error = validateDirectLocalInvocationOccurrences(
        child,
        `${path}.${key}`,
        sampledSources,
        directInvocationIds,
        expansionInvocationIds,
        enforceOccurrence && !ownerOrResultKey,
        seen,
      );
      if (error) return error;
    }
    return undefined;
  };
  const sampledSourcesByOperation = new Map<string, Set<string>>();
  for (const entry of program.sampleCatalog.entries) {
    for (const consumer of entry.consumers) {
      for (const operation of program.operations) {
        const sameOperation = consumer.operationId === operation.id
          || consumer.operationId.startsWith(`${operation.id}|`)
          || operation.id.startsWith(`${consumer.operationId}|`);
        if (!sameOperation) continue;
        const sources = sampledSourcesByOperation.get(operation.id) || new Set<string>();
        sources.add(locationKey(entry.source));
        sampledSourcesByOperation.set(operation.id, sources);
      }
    }
  }
  const expansionInvocations = program.localExpansion?.invocations || [];
  const expansionInvocationIds = new Set(expansionInvocations.map(invocation => invocation.sourceInvocationId));
  for (const [index, operation] of program.operations.entries()) {
    const localResultError = validateLocalInvocationResults(operation.metadata, `program.operations[${index}].metadata`);
    if (localResultError) return localResultError;
    const currentAncestry = operation.localExpansion?.ancestry || [program.target.id];
    const directInvocationIds = new Set(
      expansionInvocations
        .filter(invocation => invocation.ancestry.length > currentAncestry.length
          && currentAncestry.every((ancestor, ancestorIndex) => invocation.ancestry[ancestorIndex] === ancestor))
        .map(invocation => invocation.sourceInvocationId),
    );
    const occurrenceError = validateDirectLocalInvocationOccurrences(
      operation.metadata,
      `program.operations[${index}].metadata`,
      sampledSourcesByOperation.get(operation.id) || new Set<string>(),
      directInvocationIds,
      expansionInvocationIds,
    );
    if (occurrenceError) return occurrenceError;
  }
  const validateHelperStateBindings = (
    state: HelperTableState,
    path: string,
    expectedFrameWidth?: number,
  ): X4UiLayoutEvidenceValidationResult | undefined => {
    if (!jsonEqual(state.metrics, program.profile.metrics)) {
      return fail(`${path}.metrics does not exactly match program.profile.metrics`);
    }
    if (expectedFrameWidth !== undefined && !Object.is(state.frameWidth, expectedFrameWidth)) {
      return fail(`${path}.frameWidth does not match its owning frame width`);
    }
    return undefined;
  };
  const referenceIndexValue = (reference: X4UiValueReference | undefined): number | undefined => {
    const index = reference?.index;
    return index?.status === 'static'
      && index.type === 'number'
      && typeof index.value === 'number'
      && Number.isSafeInteger(index.value)
      ? index.value
      : undefined;
  };
  const isMaterializedRow = (row: X4UiLayoutRowNode): boolean =>
    row.rowIndex !== undefined || row.kernelState !== undefined;
  const isMaterializedCell = (cell: X4UiLayoutCellNode): boolean =>
    cell.rowIndex !== undefined || cell.kernelState !== undefined;
  const rowKernelStateForBinding = (state: unknown): unknown => {
    if (!isObject(state)) return state;
    return Object.fromEntries(Object.entries(state).filter(([key]) => key !== 'groupIndex'));
  };
  for (const [index, frame] of program.frames.entries()) {
    const expectedTableIds = program.tables
      .filter(table => table.frameId === frame.id)
      .map(table => table.id);
    if (!jsonEqual(frame.tableIds, expectedTableIds)) {
      return fail('program frame tableIds are not the exact ordered table-owner projection', index);
    }
  }
  for (const [index, row] of program.rows.entries()) {
    const ownerTable = row.tableId === undefined ? undefined : tablesById.get(row.tableId);
    if (row.tableId !== undefined && !ownerTable) {
      return fail('program row owner does not resolve to an emitted table', index);
    }
    if (isMaterializedRow(row)) {
      if (row.tableId === undefined || row.rowIndex === undefined || !ownerTable?.kernelState) {
        return fail('program materialized row has incomplete table/kernel ownership', index);
      }
      const kernelRow = ownerTable.kernelState.rows[row.rowIndex - 1];
      if (!kernelRow || !jsonEqual(rowKernelStateForBinding(row.kernelState), rowKernelStateForBinding(kernelRow))) {
        return fail('program materialized row does not match its exact kernel slot', index);
      }
      const rowGroupIndex = isObject(row.kernelState) ? row.kernelState.groupIndex : undefined;
      const kernelGroupIndex = isObject(kernelRow) ? kernelRow.groupIndex : undefined;
      if (rowGroupIndex !== undefined && !Object.is(rowGroupIndex, kernelGroupIndex)) {
        return fail('program materialized row groupIndex does not match its exact kernel slot', index);
      }
    }
    const expectedCellIds = program.cells
      .filter(cell => cell.rowId === row.id)
      .map(cell => cell.id);
    if (!jsonEqual(row.cellIds, expectedCellIds)) {
      return fail('program row cellIds are not the exact ordered cell-owner projection', index);
    }
    if (ownerTable?.identity !== undefined && row.identity !== undefined
      && row.identity.parentPath !== ownerTable.identity.path) {
      return fail('program row identity parent does not match its owning table identity', index);
    }
    const rowIdentityIndex = referenceIndexValue(row.identity);
    if (rowIdentityIndex !== undefined && row.rowIndex !== undefined && rowIdentityIndex !== row.rowIndex) {
      return fail('program row identity index does not match its row index', index);
    }
  }
  for (const [index, cell] of program.cells.entries()) {
    const ownerRow = cell.rowId === undefined ? undefined : rowsById.get(cell.rowId);
    const ownerTable = cell.tableId === undefined ? undefined : tablesById.get(cell.tableId);
    if (cell.rowId !== undefined && !ownerRow) {
      return fail('program cell owner does not resolve to an emitted row', index);
    }
    if (cell.tableId !== undefined && !ownerTable) {
      return fail('program cell table owner does not resolve to an emitted table', index);
    }
    if (ownerRow?.tableId !== undefined && cell.tableId !== ownerRow.tableId) {
      return fail('program cell table owner does not match its owning row', index);
    }
    if (ownerRow?.identity !== undefined && cell.identity !== undefined
      && cell.identity.parentPath !== ownerRow.identity.path) {
      return fail('program cell identity parent does not match its owning row identity', index);
    }
    const cellIdentityIndex = referenceIndexValue(cell.identity);
    if (cellIdentityIndex !== undefined && cellIdentityIndex !== cell.column) {
      return fail('program cell identity index does not match its column', index);
    }
    if (ownerRow?.rowIndex !== undefined && cell.rowIndex !== undefined && cell.rowIndex !== ownerRow.rowIndex) {
      return fail('program cell row index does not match its owning row', index);
    }
    if (isMaterializedCell(cell)) {
      if (cell.tableId === undefined || cell.rowId === undefined || cell.rowIndex === undefined
        || !ownerRow || !ownerTable?.kernelState || ownerRow.rowIndex === undefined) {
        return fail('program materialized cell has incomplete table/row/kernel ownership', index);
      }
      if (cell.rowIndex !== ownerRow.rowIndex || cell.column < 1
        || cell.column > (ownerTable.numColumns ?? ownerTable.kernelState.columns.length)) {
        return fail('program materialized cell is outside its owning row/table bounds', index);
      }
      const kernelRow = ownerTable.kernelState.rows[cell.rowIndex - 1];
      const kernelCell = kernelRow?.cells[cell.column - 1];
      if (!kernelCell || !jsonEqual(cell.kernelState, kernelCell)) {
        return fail('program materialized cell does not match its exact kernel slot', index);
      }
      if (ownerRow.cellIds.filter(cellId => cellId === cell.id).length !== 1) {
        return fail('program materialized cell is not reciprocally listed by its owning row', index);
      }
    }
  }
  for (const [index, operation] of program.operations.entries()) {
    for (const [ownerKind, ownerId, owners] of [
      ['frame', operation.frameId, framesById],
      ['table', operation.tableId, tablesById],
      ['row', operation.rowId, rowsById],
      ['cell', operation.cellId, cellsById],
    ] as const) {
      if (ownerId !== undefined && !owners.has(ownerId)) {
        return fail(`program operation ${ownerKind} owner does not resolve to an emitted node`, index);
      }
    }
    if (operation.frameId !== undefined && operation.tableId !== undefined) {
      const table = tablesById.get(operation.tableId);
      if (table?.frameId !== undefined && operation.frameId !== table.frameId) {
        return fail('program operation frame and table owners are contradictory', index);
      }
    }
    if (operation.rowId !== undefined) {
      const row = rowsById.get(operation.rowId);
      if (operation.tableId !== undefined && row?.tableId !== operation.tableId) {
        return fail('program operation table and row owners are contradictory', index);
      }
    }
    if (operation.cellId !== undefined) {
      const cell = cellsById.get(operation.cellId);
      if (operation.tableId !== undefined && cell?.tableId !== operation.tableId) {
        return fail('program operation table and cell owners are contradictory', index);
      }
      if (operation.rowId !== undefined && cell?.rowId !== operation.rowId) {
        return fail('program operation row and cell owners are contradictory', index);
      }
    }
    const frame = operation.frameId === undefined ? undefined : framesById.get(operation.frameId);
    const table = operation.tableId === undefined ? undefined : tablesById.get(operation.tableId);
    const row = operation.rowId === undefined ? undefined : rowsById.get(operation.rowId);
    const cell = operation.cellId === undefined ? undefined : cellsById.get(operation.cellId);
    const requireSourceOwnerIdentity = (
      ownerId: string | undefined,
      ownerIdentity: X4UiValueReference | undefined,
      references: readonly (X4UiValueReference | undefined)[],
      reason: string,
    ): X4UiLayoutEvidenceValidationResult | undefined => {
      const presentReferences = references.filter((reference): reference is X4UiValueReference => reference !== undefined);
      if (presentReferences.length === 0) return undefined;
      const sourceReference = presentReferences[0];
      if (!presentReferences.every(reference => jsonEqual(reference, sourceReference))) {
        return fail('program source receiver/result references are not one exact owner identity', index);
      }
      if (ownerId !== undefined) {
        if (!ownerIdentity || !jsonEqual(ownerIdentity, sourceReference)) return fail(reason, index);
        return undefined;
      }
      return undefined;
    };
    if (operation.cellId === undefined
      && (operation.kind === 'setColSpan' || operation.kind === 'createButton' || operation.kind === 'setText'
        || operation.kind === 'setText2' || operation.kind === 'createText' || operation.kind === 'createEditBox'
        || operation.kind === 'createIcon')) {
      const receiverReference = operation.metadata.receiver?.reference;
      const metadataCell = program.cells.find(candidate => candidate.identity !== undefined
        && receiverReference !== undefined && jsonEqual(candidate.identity, receiverReference));
      if (metadataCell) return fail('program cell operation omits a source-bound emitted cell owner', index);
    }
    const requireOperationIdentity = (
      expected: X4UiValueReference | undefined,
      actual: X4UiValueReference | undefined,
      reason: string,
    ): X4UiLayoutEvidenceValidationResult | undefined => {
      if (operation.status === 'applied' || expected !== undefined) {
        if (!expected || !actual || !jsonEqual(actual, expected)) return fail(reason, index);
      }
      return undefined;
    };
    switch (operation.kind) {
      case 'createFrameHandle': {
        const sourceOwnerError = requireSourceOwnerIdentity(
          operation.frameId,
          frame?.identity,
          [operation.metadata.result],
          'program createFrameHandle source result does not identify its owning frame',
        );
        if (sourceOwnerError) return sourceOwnerError;
        const identityError = requireOperationIdentity(
          frame?.identity,
          operation.metadata.result,
          'program createFrameHandle result does not identify its frame node',
        );
        if (identityError) return identityError;
        break;
      }
      case 'addTable': {
        const owningFrame = table?.frameId === undefined ? frame : framesById.get(table.frameId);
        const sourceTableError = requireSourceOwnerIdentity(
          operation.tableId,
          table?.identity,
          [operation.metadata.result],
          'program addTable source result does not identify its owning table',
        );
        if (sourceTableError) return sourceTableError;
        const sourceFrameError = requireSourceOwnerIdentity(
          owningFrame?.id,
          owningFrame?.identity,
          [operation.metadata.receiver?.reference],
          'program addTable source receiver does not identify its owning frame',
        );
        if (sourceFrameError) return sourceFrameError;
        const resultError = requireOperationIdentity(
          table?.identity,
          operation.metadata.result,
          'program addTable result does not identify its table node',
        );
        if (resultError) return resultError;
        if (owningFrame !== undefined) {
          const receiverError = requireOperationIdentity(
            owningFrame.identity,
            operation.metadata.receiver?.reference,
            'program addTable receiver does not identify its owning frame',
          );
          if (receiverError) return receiverError;
        }
        break;
      }
      case 'addRow': {
        const sourceRowError = requireSourceOwnerIdentity(
          operation.rowId,
          row?.identity,
          [operation.metadata.result],
          'program addRow source result does not identify its owning row',
        );
        if (sourceRowError) return sourceRowError;
        const sourceTableError = requireSourceOwnerIdentity(
          operation.tableId,
          table?.identity,
          [operation.metadata.receiver?.reference],
          'program addRow source receiver does not identify its owning table',
        );
        if (sourceTableError) return sourceTableError;
        const resultError = requireOperationIdentity(
          row?.identity,
          operation.metadata.result,
          'program addRow result does not identify its row node',
        );
        if (resultError) return resultError;
        const receiverError = requireOperationIdentity(
          table?.identity,
          operation.metadata.receiver?.reference,
          'program addRow receiver does not identify its owning table',
        );
        if (receiverError) return receiverError;
        break;
      }
      case 'setColWidth':
      case 'setColWidthPercent': {
        const sourceOwnerError = requireSourceOwnerIdentity(
          operation.tableId,
          table?.identity,
          [operation.metadata.receiver?.reference],
          'program table width source receiver does not identify its owning table',
        );
        if (sourceOwnerError) return sourceOwnerError;
        const identityError = requireOperationIdentity(
          table?.identity,
          operation.metadata.receiver?.reference,
          'program table width receiver does not identify its owning table',
        );
        if (identityError) return identityError;
        break;
      }
      case 'setColSpan':
      case 'createButton':
      case 'setText':
      case 'setText2':
      case 'createText':
      case 'createEditBox':
      case 'createIcon': {
        const sourceOwnerError = requireSourceOwnerIdentity(
          operation.cellId,
          cell?.identity,
          [
            operation.metadata.receiver?.reference,
            operation.metadata.semantics.cell?.reference,
            operation.metadata.result,
          ],
          'program cell operation source references do not identify its owning cell',
        );
        if (sourceOwnerError) return sourceOwnerError;
        const identityError = requireOperationIdentity(
          cell?.identity,
          operation.metadata.receiver?.reference,
          'program cell operation receiver does not identify its owning cell',
        );
        if (identityError) return identityError;
        break;
      }
      case 'display': {
        const sourceOwnerError = requireSourceOwnerIdentity(
          operation.frameId,
          frame?.identity,
          [operation.metadata.receiver?.reference],
          'program display source receiver does not identify its owning frame',
        );
        if (sourceOwnerError) return sourceOwnerError;
        const identityError = requireOperationIdentity(
          frame?.identity,
          operation.metadata.receiver?.reference,
          'program display receiver does not identify its owning frame',
        );
        if (identityError) return identityError;
        break;
      }
      default:
        break;
    }
  }
  for (const [index, table] of program.tables.entries()) {
    const expectedRowIds = program.rows
      .filter(row => row.tableId === table.id && isMaterializedRow(row))
      .map(row => row.id);
    if (!jsonEqual(table.rowIds, expectedRowIds)) {
      return fail('program table rowIds are not the exact ordered row-owner projection', index);
    }
    const ownerFrame = table.frameId === undefined ? undefined : framesById.get(table.frameId);
    const addTableOperations = program.operations.filter(operation =>
      operation.kind === 'addTable' && operation.tableId === table.id);
    if (table.identity !== undefined) {
      if (addTableOperations.length !== 1) {
        return fail('program table identity does not have one unique addTable operation', index);
      }
      if (!jsonEqual(addTableOperations[0].metadata.result, table.identity)) {
        return fail('program addTable result does not identify its table node', index);
      }
    }
    if (table.frameId !== undefined) {
      if (!ownerFrame) return fail('program table owner does not resolve to an emitted frame', index);
      if (typeof ownerFrame.width !== 'number') {
        return fail('program table owner has no resolved numeric width', index);
      }
      if (!Object.is(table.frameWidth, ownerFrame.width)) {
        return fail('program table frameWidth does not match its owning frame width', index);
      }
      if (table.identity?.parentPath !== undefined && ownerFrame.identity !== undefined
        && table.identity.parentPath !== ownerFrame.identity.path) {
        return fail('program table identity parent does not match its owning frame identity', index);
      }
      if (ownerFrame.identity !== undefined) {
        if (addTableOperations.length !== 1) {
          return fail('program table owner does not have one unique addTable operation', index);
        }
        const receiverReference = addTableOperations[0].metadata.receiver?.reference;
        if (!jsonEqual(receiverReference, ownerFrame.identity)) {
          return fail('program addTable receiver does not identify its owning frame', index);
        }
      }
    } else if (table.frameWidth !== undefined || table.kernelState !== undefined) {
      return fail('program ownerless table carries frame-derived width or kernel state', index);
    }
    if (table.kernelState) {
      if (table.numColumns === undefined
        || !Object.is(table.numColumns, table.kernelState.columns.length)) {
        return fail('program materialized table numColumns does not match its kernel columns', index);
      }
      const stateError = validateHelperStateBindings(
        table.kernelState,
        `program.tables[${index}].kernelState`,
        ownerFrame?.width,
      );
      if (stateError) return stateError;
    }
  }
  for (const [index, operation] of program.operations.entries()) {
    const transition = operation.kernel;
    if (!transition) continue;
    if (operation.tableId === undefined) {
      return fail('program operation kernel transition has no table owner', index);
    }
    const table = tablesById.get(operation.tableId);
    const ownerFrame = table?.frameId === undefined ? undefined : framesById.get(table.frameId);
    if (!table || table.frameId === undefined || !ownerFrame || typeof ownerFrame.width !== 'number') {
      return fail('program operation kernel transition has no resolved width-bearing table owner', index);
    }
    for (const [label, state] of [
      ['stateBefore', transition.stateBefore],
      ['stateAfter', transition.stateAfter],
      ['refusal.state', transition.refusal?.state],
    ] as const) {
      if (!state) continue;
      const stateError = validateHelperStateBindings(
        state,
        `program.operations[${index}].kernel.${label}`,
        ownerFrame.width,
      );
      if (stateError) return stateError;
    }
  }
  if (!Array.isArray(manifest.calls) || !Array.isArray(manifest.operations) || !Array.isArray(manifest.gaps)
    || !Array.isArray(manifest.linkedGapIndexes) || !Array.isArray(manifest.unlinkedGapIndexes)) {
    return fail('evidence authority ledgers must be arrays');
  }
  const calls = manifest.calls;
  const manifestOperations = manifest.operations;
  const manifestGaps = manifest.gaps;
  if (calls.length !== manifestOperations.length || manifestOperations.length !== program.operations.length) {
    return fail('evidence call/operation cardinality does not match the emitted operation ledger');
  }
  const programNodeCollections = [
    { name: 'frames', value: program.frames, cell: false },
    { name: 'tables', value: program.tables, cell: false },
    { name: 'rows', value: program.rows, cell: false },
    { name: 'cells', value: program.cells, cell: true },
  ] as const;
  for (const collection of programNodeCollections) {
    if (!Array.isArray(collection.value)) return fail(`program ${collection.name} node collection is malformed`);
    for (let index = 0; index < collection.value.length; index += 1) {
      const node = collection.value[index];
      if (!isObject(node)
        || !evidenceId(node.id)
        || !Array.isArray(node.operationIds)
        || !node.operationIds.every(evidenceId)
        || new Set(node.operationIds).size !== node.operationIds.length
        || (collection.cell && (!Array.isArray(node.metadataOperationIds)
          || !node.metadataOperationIds.every(evidenceId)
          || new Set(node.metadataOperationIds).size !== node.metadataOperationIds.length))) {
        return fail(`program ${collection.name} node entry is malformed`, index);
      }
    }
  }
  const callIds = new Set<string>();
  const operationIds = new Set<string>();
  const ownerIds = new Set<string>([
    ...program.frames.map(frame => frame.id),
    ...program.tables.map(table => table.id),
    ...program.rows.map(row => row.id),
    ...program.cells.map(cell => cell.id),
  ]);
  const callKeys = ['id', 'operationId', 'kind', 'source', 'sourceOrder', 'modelOrder', 'streamIndex', 'status', 'reachability'];
  const callOptionalKeys = ['expansion'];
  const operationKeys = ['id', 'callId', 'kind', 'source', 'sourceOrder', 'modelOrder', 'streamIndex', 'status', 'snapshot'];
  const operationOptionalKeys = [
    'frameId', 'tableId', 'rowId', 'cellId', 'reason', 'expansion',
  ];
  for (let index = 0; index < calls.length; index += 1) {
    const callValue = calls[index];
    const operationEvidenceValue = manifestOperations[index];
    const operation = program.operations[index];
    if (!isObject(callValue) || !isObject(operationEvidenceValue) || !operation) return fail('evidence call or operation entry is malformed', index);
    if (!exactKeys(callValue, callKeys, callOptionalKeys) || !exactKeys(operationEvidenceValue, operationKeys, operationOptionalKeys)) {
      return fail('evidence call or operation entry contains an unknown or missing key', index);
    }
    const call = callValue as unknown as X4UiLayoutEvidenceCall;
    const operationEvidence = operationEvidenceValue as unknown as X4UiLayoutEvidenceOperation;
    if (!evidenceId(call.id) || callIds.has(call.id)) return fail('evidence call IDs are not unique', index);
    if (!evidenceId(operationEvidence.id) || operationIds.has(operationEvidence.id)) {
      return fail('evidence operation IDs are not unique', index);
    }
    callIds.add(call.id);
    operationIds.add(operationEvidence.id);
    if (!EVIDENCE_RELEVANT_CALL_NAMES.includes(call.kind as X4UiRelevantCallName)
      || !EVIDENCE_RELEVANT_CALL_NAMES.includes(operationEvidence.kind as X4UiRelevantCallName)) {
      return fail('evidence contains an unknown relevant call kind', index);
    }
    if (!evidenceSource(call.source) || !evidenceSource(operationEvidence.source)) {
      return fail('evidence source location is malformed', index);
    }
    if (!evidenceSafeIndex(call.sourceOrder)
      || !evidenceSafeIndex(call.modelOrder)
      || !evidenceSafeIndex(call.streamIndex)
      || !evidenceSafeIndex(operationEvidence.sourceOrder)
      || !evidenceSafeIndex(operationEvidence.modelOrder)
      || !evidenceSafeIndex(operationEvidence.streamIndex)
      || !['applied', 'rejected', 'unresolved', 'unreachable', 'conditional'].includes(String(call.status))
      || !['applied', 'rejected', 'unresolved', 'unreachable', 'conditional'].includes(String(operationEvidence.status))) {
      return fail('evidence position, order, or status domain is invalid', index);
    }
    const expectedOperationId = programId(
      'operation',
      `${call.modelOrder}|${call.kind}|${locationKey(call.source)}`
        + (call.expansion ? `|${call.expansion.ancestry.join('>')}` : '')
    );
    if (operationEvidence.id !== expectedOperationId
      || call.operationId !== expectedOperationId
      || call.id !== programId('evidence-call', expectedOperationId)) {
      return fail('evidence deterministic identity does not match the source call', index);
    }
    for (const key of ['frameId', 'tableId', 'rowId', 'cellId'] as const) {
      if (Object.prototype.hasOwnProperty.call(operationEvidence, key)
        && (!evidenceId(operationEvidence[key]) || !ownerIds.has(operationEvidence[key]))) {
        return fail('evidence owner identity is malformed', index);
      }
    }
    if (Object.prototype.hasOwnProperty.call(operationEvidence, 'reason')
      && typeof operationEvidence.reason !== 'string') {
      return fail('evidence operation reason is malformed', index);
    }
    if (!isObject(operationEvidence.snapshot) || !jsonEqual(operationEvidence.snapshot, operation)) {
      return fail('evidence operation snapshot does not exactly match the emitted operation', index);
    }
    if (call.operationId !== operation.id
      || operationEvidence.id !== operation.id
      || operationEvidence.callId !== call.id
      || call.kind !== operation.kind
      || operationEvidence.kind !== operation.kind
      || !locationsEqual(call.source, operation.source)
      || !locationsEqual(operationEvidence.source, operation.source)
      || call.sourceOrder !== operationEvidence.sourceOrder
      || call.sourceOrder !== operation.source.start.offset
      || operationEvidence.sourceOrder !== operation.sourceOrder
      || call.modelOrder !== operation.modelOrder
      || operationEvidence.modelOrder !== operation.modelOrder
      || call.modelOrder !== operationEvidence.modelOrder
      || call.streamIndex !== index
      || operationEvidence.streamIndex !== index
      || call.status !== operation.status
      || operationEvidence.status !== operation.status
      || call.status !== operationEvidence.status
      || operationEvidence.frameId !== operation.frameId
      || operationEvidence.tableId !== operation.tableId
      || operationEvidence.rowId !== operation.rowId
      || operationEvidence.cellId !== operation.cellId
      || operationEvidence.reason !== operation.reason) {
      return fail('evidence call or operation does not exactly match the emitted operation', index);
    }
    const reachability = call.reachability;
    if (!['reachable', 'conditional', 'unreachable'].includes(String(reachability))) {
      return fail('evidence reachability is invalid', index);
    }
    if ((operation.status === 'conditional' && reachability !== 'conditional')
      || (operation.status === 'unreachable' && reachability !== 'unreachable')
      || (operation.status !== 'conditional'
        && operation.status !== 'unreachable'
        && reachability !== 'reachable')) {
      return fail('evidence reachability does not match producer status', index);
    }
    const operationExpansion = operation.localExpansion;
    const callExpansion = call.expansion;
    const expectedExpansion = operationExpansion
      ? {
        invocationInstanceId: operationExpansion.invocationId,
        sourceInvocationId: undefined,
        ancestry: operationExpansion.ancestry,
        depth: operationExpansion.depth,
        selectionIds: operationExpansion.previewPathSelectionIds,
        catalogId: undefined,
      }
      : undefined;
    if ((operationExpansion === undefined) !== (callExpansion === undefined)
      || (callExpansion !== undefined && !evidenceExpansionLink(callExpansion))
      || (operationEvidence.expansion !== undefined && !evidenceExpansionLink(operationEvidence.expansion))
      || (operationExpansion === undefined && ('expansion' in operationEvidence || 'expansion' in call))
      || (operationExpansion !== undefined && (!('expansion' in operationEvidence) || !('expansion' in call)))) {
      return fail('evidence expansion identity is malformed or inconsistent', index);
    }
    if (operationExpansion && callExpansion && operationEvidence.expansion
      && (callExpansion.invocationInstanceId !== operationExpansion.invocationId
        || callExpansion.ancestry.join('>') !== operationExpansion.ancestry.join('>')
        || callExpansion.depth !== operationExpansion.depth
        || !jsonEqual(callExpansion.selectionIds, operationExpansion.previewPathSelectionIds)
        || operationEvidence.expansion.invocationInstanceId !== callExpansion.invocationInstanceId
        || operationEvidence.expansion.sourceInvocationId !== callExpansion.sourceInvocationId
        || !jsonEqual(operationEvidence.expansion, callExpansion))) {
      return fail('evidence expansion identity does not match the emitted operation', index);
    }
    if (expectedExpansion && callExpansion && expectedExpansion.invocationInstanceId !== callExpansion.invocationInstanceId) {
      return fail('evidence expansion instance identity does not match the operation', index);
    }
  }
  const localIdentities = manifest.localIdentities as unknown as X4UiLayoutEvidenceLocalIdentities;
  const localFunctions = new Map(localIdentities.functions.map(declaration => [declaration.id, declaration]));
  const localInvocations = new Map(localIdentities.invocations.map(invocation => [invocation.id, invocation]));
  const validateOperationLocalIdentities = (
    value: unknown,
    operationIndex: number,
    seen = new Set<object>(),
  ): X4UiLayoutEvidenceValidationResult | undefined => {
    if (Array.isArray(value)) {
      if (seen.has(value)) return undefined;
      seen.add(value);
      for (const child of value) {
        const result = validateOperationLocalIdentities(child, operationIndex, seen);
        if (result) return result;
      }
      return undefined;
    }
    if (!isObject(value)) return undefined;
    if (seen.has(value)) return undefined;
    seen.add(value);
    if (typeof value.status === 'string' && typeof value.type === 'string' && value.location !== undefined) {
      if (value.parameter !== undefined) {
        const parameter = value.parameter as X4UiLocalFunctionParameterIdentity;
        const owner = localFunctions.get(parameter.declarationId);
        const ownerParameter = owner?.parameters.find(candidate => candidate.index === parameter.index);
        if (!owner || !ownerParameter || !jsonEqual(ownerParameter, parameter)) {
          return fail('program parameter identity is not bound to the authority local declaration', operationIndex);
        }
      }
      if (value.localInvocationResult !== undefined) {
        const localResult = value.localInvocationResult as X4UiLocalInvocationResultIdentity;
        const invocation = localInvocations.get(localResult.invocationId);
        if (!invocation
          || !jsonEqual(invocation.source, localResult.source)
          || invocation.expression !== localResult.expression) {
          return fail('program local invocation result is not bound to the authority local invocation', operationIndex);
        }
      }
    }
    for (const child of Object.values(value)) {
      const result = validateOperationLocalIdentities(child, operationIndex, seen);
      if (result) return result;
    }
    return undefined;
  };
  for (let index = 0; index < program.operations.length; index += 1) {
    const identityError = validateOperationLocalIdentities(program.operations[index].metadata, index);
    if (identityError) return identityError;
  }
  if (!isObject(manifest.nodes) || !exactKeys(manifest.nodes, ['frames', 'tables', 'rows', 'cells'])) {
    return fail('evidence node ledgers are malformed');
  }
  const nodeLedgers = manifest.nodes as unknown as X4UiLayoutEvidenceNodeLedgers;
  const operationById = new Map(program.operations.map(operation => [operation.id, operation]));
  const knownNodeIds = new Set<string>();
  const seenNodeOperationMembership = new Set<string>();
  const validateNodeLedger = (
    kind: 'frame' | 'table' | 'row' | 'cell',
    authorityNodes: unknown,
    programNodes: readonly (
      | X4UiLayoutFrameNode
      | X4UiLayoutTableNode
      | X4UiLayoutRowNode
      | X4UiLayoutCellNode
    )[],
  ): X4UiLayoutEvidenceValidationResult => {
    if (!Array.isArray(authorityNodes) || authorityNodes.length !== programNodes.length) {
      return fail(`evidence ${kind} node ledger cardinality does not match the program`);
    }
    for (let index = 0; index < authorityNodes.length; index += 1) {
      const authorityNodeValue = authorityNodes[index];
      const programNode = programNodes[index];
      if (!isObject(authorityNodeValue) || !programNode) return fail(`evidence ${kind} node ledger entry is malformed`, index);
      const requiresMetadata = kind === 'cell';
      if (!exactKeys(
        authorityNodeValue,
        ['id', 'operationIds', 'snapshot', ...(requiresMetadata ? ['metadataOperationIds'] : [])],
      )) return fail(`evidence ${kind} node ledger entry contains an unknown or missing key`, index);
      const authorityNode = authorityNodeValue as unknown as X4UiLayoutEvidenceNodeLedger;
      if (!evidenceId(authorityNode.id) || knownNodeIds.has(authorityNode.id)
        || !Array.isArray(authorityNode.operationIds)
        || !authorityNode.operationIds.every(evidenceId)
        || new Set(authorityNode.operationIds).size !== authorityNode.operationIds.length
        || authorityNode.id !== programNode.id
        || !isObject(authorityNode.snapshot)
        || !jsonEqual(authorityNode.snapshot, programNode)
        || !jsonEqual(authorityNode.operationIds, programNode.operationIds)) {
        return fail(`evidence ${kind} node operation ledger does not exactly match the program`, index);
      }
      const ownerKey = `${kind}Id`;
      const expectedOperationIds = program.operations
        .filter(operation => (operation as unknown as Record<string, unknown>)[ownerKey] === programNode.id)
        .map(operation => operation.id);
      if (!jsonEqual(programNode.operationIds, expectedOperationIds)) {
        return fail(`program ${kind} node operation ledger is not the exact ordered operation projection`, index);
      }
      knownNodeIds.add(authorityNode.id);
      const metadataOperationIds = authorityNode.metadataOperationIds;
      const programMetadataOperationIds = (programNode as X4UiLayoutCellNode).metadataOperationIds;
      if (requiresMetadata) {
        if (!Array.isArray(metadataOperationIds)
          || !metadataOperationIds.every(evidenceId)
          || new Set(metadataOperationIds).size !== metadataOperationIds.length
          || !jsonEqual(metadataOperationIds, programMetadataOperationIds)) {
          return fail('evidence cell metadata operation ledger does not exactly match the program', index);
        }
      } else if (Object.prototype.hasOwnProperty.call(authorityNodeValue, 'metadataOperationIds')) {
        return fail(`evidence ${kind} node ledger contains a cell-only metadata ledger`, index);
      }
      for (const operationId of authorityNode.operationIds) {
        const membershipKey = `${kind}|operationIds|${operationId}`;
        if (seenNodeOperationMembership.has(membershipKey)) {
          return fail(`evidence ${kind} node operation ledger duplicates an operation`, index);
        }
        seenNodeOperationMembership.add(membershipKey);
        const operation = operationById.get(operationId);
        if (!operation || (operation as unknown as Record<string, unknown>)[ownerKey] !== authorityNode.id) {
          return fail(`evidence ${kind} node ledger contains an unrelated operation`, index);
        }
      }
      if (requiresMetadata) {
        for (const operationId of metadataOperationIds || []) {
          const membershipKey = `${kind}|metadataOperationIds|${operationId}`;
          if (seenNodeOperationMembership.has(membershipKey)) {
            return fail('evidence cell metadata ledger duplicates an operation', index);
          }
          seenNodeOperationMembership.add(membershipKey);
          const operation = operationById.get(operationId);
          if (!operation || operation.cellId !== authorityNode.id) {
            return fail('evidence cell metadata ledger contains an unrelated operation', index);
          }
        }
      }
    }
    return { valid: true };
  };
  const nodeLedgerChecks = [
    validateNodeLedger('frame', nodeLedgers.frames, program.frames),
    validateNodeLedger('table', nodeLedgers.tables, program.tables),
    validateNodeLedger('row', nodeLedgers.rows, program.rows),
    validateNodeLedger('cell', nodeLedgers.cells, program.cells),
  ];
  const failedNodeLedger = nodeLedgerChecks.find(candidate => !candidate.valid);
  if (failedNodeLedger && !failedNodeLedger.valid) return failedNodeLedger;
  const nodeLedgerMembership = new Set<string>();
  const indexNodeLedgerMembership = (
    kind: 'frame' | 'table' | 'row' | 'cell',
    nodeValues: readonly X4UiLayoutEvidenceNodeLedger[],
  ): void => {
    for (const node of nodeValues) {
      for (const operationId of node.operationIds) nodeLedgerMembership.add(`${kind}|${operationId}`);
    }
  };
  indexNodeLedgerMembership('frame', nodeLedgers.frames);
  indexNodeLedgerMembership('table', nodeLedgers.tables);
  indexNodeLedgerMembership('row', nodeLedgers.rows);
  indexNodeLedgerMembership('cell', nodeLedgers.cells);
  for (let index = 0; index < program.operations.length; index += 1) {
    const operation = program.operations[index];
    for (const owner of [
      ['frame', operation.frameId],
      ['table', operation.tableId],
      ['row', operation.rowId],
      ['cell', operation.cellId],
    ] as const) {
      if (owner[1] !== undefined && !nodeLedgerMembership.has(`${owner[0]}|${operation.id}`)) {
        return fail(`program operation owner is missing from the ${owner[0]} node ledger`, index);
      }
    }
  }
  const gapKeys = ['category', 'status', 'reason', 'source'];
  const gapOptionalKeys = ['expression', 'operationId', 'nodeId'];
  if (manifestGaps.length !== program.gaps.length) return fail('evidence gap cardinality does not match the program gap ledger');
  for (let index = 0; index < manifestGaps.length; index += 1) {
    const manifestGapValue = manifestGaps[index];
    const gap = program.gaps[index];
    if (!isObject(manifestGapValue) || !exactKeys(manifestGapValue, gapKeys, gapOptionalKeys)
      || !evidenceSource(manifestGapValue.source)) {
      return fail('evidence gap entry is malformed or contains an unknown key', index);
    }
    const manifestGap = manifestGapValue as unknown as X4UiLayoutEvidenceGap;
    if (typeof manifestGap.category !== 'string'
      || typeof manifestGap.status !== 'string'
      || typeof manifestGap.reason !== 'string'
      || (Object.prototype.hasOwnProperty.call(manifestGap, 'expression') && typeof manifestGap.expression !== 'string')
      || (Object.prototype.hasOwnProperty.call(manifestGap, 'operationId') && !evidenceId(manifestGap.operationId))
      || (Object.prototype.hasOwnProperty.call(manifestGap, 'nodeId') && !evidenceId(manifestGap.nodeId))) {
      return fail('evidence gap field domain is invalid', index);
    }
    if (manifestGap.category !== gap.category
      || manifestGap.status !== gap.status
      || manifestGap.reason !== gap.reason
      || !locationsEqual(manifestGap.source, gap.source)
      || !jsonEqual(manifestGap.expression, gap.expression)
      || !jsonEqual(manifestGap.operationId, gap.operationId)
      || !jsonEqual(manifestGap.nodeId, gap.nodeId)) {
      return fail('evidence gap does not exactly match the program gap ledger', index);
    }
    if (manifestGap.operationId !== undefined
      && (typeof manifestGap.operationId !== 'string' || !operationIds.has(manifestGap.operationId))) {
      return fail('evidence gap references an unknown operation', index);
    }
  }
  const linkedIndexes = manifest.linkedGapIndexes;
  const unlinkedIndexes = manifest.unlinkedGapIndexes;
  if (!linkedIndexes.every(index => evidenceSafeIndex(index) && index < manifestGaps.length)
    || !unlinkedIndexes.every(index => evidenceSafeIndex(index) && index < manifestGaps.length)
    || new Set(linkedIndexes).size !== linkedIndexes.length
    || new Set(unlinkedIndexes).size !== unlinkedIndexes.length) {
    return fail('evidence gap indexes are out of range');
  }
  const expectedLinkedIndexes = manifestGaps
    .map((gap, index) => gap.operationId === undefined ? undefined : index)
    .filter((index): index is number => index !== undefined);
  const expectedUnlinkedIndexes = manifestGaps
    .map((gap, index) => gap.operationId !== undefined ? undefined : index)
    .filter((index): index is number => index !== undefined);
  if (!jsonEqual(linkedIndexes, expectedLinkedIndexes) || !jsonEqual(unlinkedIndexes, expectedUnlinkedIndexes)) {
    return fail('evidence linked and unlinked gap indexes are not the exact ordered partition');
  }
  const programExpansion = program.localExpansion;
  const authorityExpansion = manifest.expansion;
  if ((programExpansion === undefined) !== (authorityExpansion === undefined)) {
    return fail('evidence expansion presence does not match the program');
  }
  if (programExpansion && authorityExpansion) {
    const expansion = authorityExpansion as unknown as X4UiLayoutEvidenceExpansion;
    if (!isObject(authorityExpansion)
      || !exactKeys(authorityExpansion, ['limits', 'catalog', 'selections', 'invocations'])
      || !isObject(expansion.limits)
      || !exactKeys(expansion.limits, ['maxDepth', 'maxInvocations'])
      || !evidenceSafeIndex(expansion.limits.maxDepth)
      || !evidenceSafeIndex(expansion.limits.maxInvocations)
      || !jsonEqual(expansion.limits, programExpansion.limits)) {
      return fail('evidence expansion limits are malformed or do not match the program');
    }
    const catalog = expansion.catalog;
    if (!isObject(catalog)
      || !exactKeys(catalog, ['id', 'sourceIdentity', 'targetId', 'entries'])
      || !evidenceId(catalog.id)
      || !isObject(catalog.sourceIdentity)
      || !Array.isArray(catalog.entries)
      || catalog.id !== programExpansion.previewPathCatalog.id
      || catalog.targetId !== programExpansion.previewPathCatalog.targetId
      || !jsonEqual(catalog.sourceIdentity, programExpansion.previewPathCatalog.sourceIdentity)
      || !jsonEqual(catalog.entries, programExpansion.previewPathCatalog.entries)) {
      return fail('evidence expansion catalog does not match the program');
    }
    if (!jsonEqual(expansion.selections, programExpansion.previewPathSelections)
      || !jsonEqual(expansion.invocations, programExpansion.invocations)) {
      return fail('evidence expansion selections or invocations do not exactly match the program');
    }
    const catalogEntryIds = new Set<string>();
    for (let index = 0; index < catalog.entries.length; index += 1) {
      const entry = catalog.entries[index];
      if (!isObject(entry) || !exactKeys(entry, [
        'id', 'boundaryId', 'armId', 'boundary', 'arm', 'armIndex', 'reachability', 'invocationIds', 'provenance',
      ]) || !evidenceId(entry.id) || catalogEntryIds.has(entry.id)
        || !evidenceId(entry.boundaryId) || !evidenceId(entry.armId)
        || !evidenceSource(entry.boundary)
        || typeof entry.arm !== 'string'
        || !evidenceSafeIndex(entry.armIndex)
        || !['reachable', 'conditional', 'unreachable'].includes(String(entry.reachability))
        || !Array.isArray(entry.invocationIds)
        || !entry.invocationIds.every(evidenceId)
        || new Set(entry.invocationIds).size !== entry.invocationIds.length
        || entry.provenance !== 'preview-only') {
        return fail('evidence expansion catalog entry is malformed', index);
      }
      catalogEntryIds.add(entry.id);
    }
    if (!Array.isArray(expansion.selections)) return fail('evidence expansion selections are malformed');
    const selectionIds = new Set<string>();
    for (let index = 0; index < expansion.selections.length; index += 1) {
      const selection = expansion.selections[index] as X4UiLayoutPreviewPathSelectionBinding;
      if (!isObject(selection) || !exactKeys(selection, ['id', 'boundaryId', 'armId', 'boundary', 'provenance'])
        || !evidenceId(selection.id) || selectionIds.has(selection.id)
        || !evidenceId(selection.boundaryId) || !evidenceId(selection.armId)
        || !evidenceSource(selection.boundary)
        || selection.provenance !== 'preview-only'
        || !catalog.entries.some(entry => isObject(entry)
          && entry.boundaryId === selection.boundaryId
          && entry.armId === selection.armId
          && locationsEqual(entry.boundary as unknown as X4UiSourceLocation, selection.boundary))) {
        return fail('evidence expansion selection is malformed or not catalog-bound', index);
      }
      selectionIds.add(selection.id);
    }
    if (!Array.isArray(expansion.invocations)) return fail('evidence expansion invocations are malformed');
    const invocationIds = new Set<string>();
    const invocationSourceIds = new Set<string>();
    for (let index = 0; index < expansion.invocations.length; index += 1) {
      const invocation = expansion.invocations[index] as X4UiLayoutEvidenceInvocation;
      if (!isObject(invocation) || !exactKeys(invocation, [
        'id', 'sourceInvocationId', 'source', 'ancestry', 'depth', 'status', 'resultConsumed',
        'previewPathSelectionIds', 'operationIds',
      ], ['calleeDeclarationId', 'resolution', 'reason'])
        || !evidenceId(invocation.id) || invocationIds.has(invocation.id)
        || !evidenceId(invocation.sourceInvocationId)
        || !evidenceSource(invocation.source)
        || !Array.isArray(invocation.ancestry) || invocation.ancestry.length === 0 || !invocation.ancestry.every(evidenceId)
        || !evidenceSafeIndex(invocation.depth)
        || !['expanded', 'rejected', 'conditional', 'unreachable', 'looped'].includes(String(invocation.status))
        || typeof invocation.resultConsumed !== 'boolean'
        || !Array.isArray(invocation.previewPathSelectionIds)
        || !invocation.previewPathSelectionIds.every(id => evidenceId(id) && selectionIds.has(id))
        || new Set(invocation.previewPathSelectionIds).size !== invocation.previewPathSelectionIds.length
        || !Array.isArray(invocation.operationIds)
        || !invocation.operationIds.every(id => evidenceId(id) && operationIds.has(id))
        || new Set(invocation.operationIds).size !== invocation.operationIds.length
        || (Object.prototype.hasOwnProperty.call(invocation, 'calleeDeclarationId') && !evidenceId(invocation.calleeDeclarationId))
        || (Object.prototype.hasOwnProperty.call(invocation, 'resolution')
          && (!['direct', 'alias'].includes(String(invocation.resolution))
            || !jsonEqual(invocation.resolution, programExpansion.invocations[index]?.resolution)))
        || (Object.prototype.hasOwnProperty.call(invocation, 'reason') && typeof invocation.reason !== 'string')) {
        return fail('evidence expansion invocation is malformed', index);
      }
      invocationIds.add(invocation.id);
      invocationSourceIds.add(invocation.sourceInvocationId);
      const linkedOperationIds = manifestOperations
        .filter(operation => isObject(operation)
          && isObject(operation.expansion)
          && operation.expansion.invocationInstanceId === invocation.id)
        .map(operation => operation.id);
      if (!jsonEqual(invocation.operationIds, linkedOperationIds)) {
        return fail('evidence invocation operation reciprocity is not exact', index);
      }
    }
    for (const entry of catalog.entries) {
      const catalogEntry = entry as X4UiLayoutPreviewPathCatalogEntry;
      if (!isObject(catalogEntry) || !catalogEntry.invocationIds.every(id => invocationSourceIds.has(id))) {
        return fail('evidence catalog invocation identity is not reciprocal');
      }
    }
    for (const callValue of calls) {
      if (!isObject(callValue)) continue;
      const call = callValue as unknown as X4UiLayoutEvidenceCall;
      if (call.expansion === undefined) continue;
      const invocation = expansion.invocations.find(candidate => isObject(candidate)
        && candidate.id === call.expansion!.invocationInstanceId) as unknown as X4UiLayoutEvidenceInvocation | undefined;
      if (!invocation || !invocationIds.has(call.expansion.invocationInstanceId)
        || !invocationSourceIds.has(call.expansion.sourceInvocationId)
        || call.expansion.invocationInstanceId === call.expansion.sourceInvocationId
        || invocation.sourceInvocationId !== call.expansion.sourceInvocationId
        || !jsonEqual(invocation.ancestry, call.expansion.ancestry)
        || invocation.depth !== call.expansion.depth
        || !jsonEqual(invocation.previewPathSelectionIds, call.expansion.selectionIds)
        || call.expansion.catalogId !== catalog.id) {
        return fail('evidence call expansion identity is not reciprocal');
      }
    }
  }
  try {
    const serialized = JSON.stringify(manifest);
    const roundTrip = JSON.parse(serialized);
    if (!jsonEqual(roundTrip, manifest)) return fail('evidence authority JSON round-trip is lossy');
  } catch {
    return fail('evidence authority is not JSON serializable');
  }
  return { valid: true };
};

/**
 * Project one exact model context into the shipped Helper kernel.
 *
 * The first three parameters preserve the accepted Batch 4A input boundary.
 * The optional fourth parameter binds preview-only scalar samples by exact
 * source hash and range. The optional fifth parameter selects exact
 * conditional invocation arms for preview only. The optional sixth parameter
 * is loader-issued P2 canonical-default color evidence. The optional seventh
 * parameter is the exact loader-issued X4 9.00 corpus authority used for the
 * bounded font/property projection. No ambient state is consulted.
 */
export function projectX4UiLayoutProgram(
  model: X4UiCallModel,
  targetSelector: X4UiLayoutTargetSelector,
  profile: X4UiLayoutProjectionProfile,
  previewSampleInput?: X4UiLayoutPreviewSampleInput,
  previewPathInput?: X4UiLayoutPreviewPathSelectionInput,
  colorEvidenceInput?: X4UiCorpusCanonicalColorSuccess,
  canonicalCorpusInput?: X4UiCorpusCanonicalSuccess,
): X4UiLayoutProgramResult {
  if (colorEvidenceInput !== undefined && !isX4UiCorpusCanonicalColorSuccess(colorEvidenceInput)) {
    return refusalResult('malformed-color-evidence', 'color evidence is not the exact loader-issued P2 canonical authority');
  }
  if (canonicalCorpusInput !== undefined && !isPinnedCanonicalCorpus(canonicalCorpusInput)) {
    return refusalResult('malformed-corpus-evidence', 'corpus evidence is not the exact loader-issued X4 9.00 canonical authority');
  }
  if (!isObject(model) || !isObject(model.file) || typeof model.file.text !== 'string' || typeof model.file.rel !== 'string') {
    return refusalResult('malformed-model', 'call-model input is malformed');
  }
  let modelColorExpressions: readonly X4UiCallColorExpression[] | undefined;
  if (colorEvidenceInput !== undefined) {
    try {
      const descriptor = Object.getOwnPropertyDescriptor(model, 'colorExpressions');
      const candidate = descriptor && 'value' in descriptor ? descriptor.value : undefined;
      if (!descriptor || !descriptor.enumerable || !Array.isArray(candidate)
        || Object.getPrototypeOf(candidate) !== Array.prototype) {
        return refusalResult('malformed-model', 'call-model colorExpressions container is malformed', model);
      }
      modelColorExpressions = candidate as readonly X4UiCallColorExpression[];
    } catch {
      return refusalResult('malformed-model', 'call-model colorExpressions container is not safely readable', model);
    }
  }
  if (!model.parsed) return refusalResult('malformed-model', 'call-model parse did not succeed', model);
  const normalizedProfile = normalizeProfile(profile, model);
  if (normalizedProfile.ok === false) return refusalResult(normalizedProfile.code, normalizedProfile.message, model);
  const selectedTarget = exactTarget(model, targetSelector);
  if (selectedTarget.ok === false) return refusalResult('target-mismatch', selectedTarget.message, model);

  const target = selectedTarget.value;
  const profileValue = normalizedProfile.value.value;
  const directTargetCalls: ProjectableCall[] = model.records
    .filter(record => locationsEqual(record.context.source, target.source))
    .filter((record): record is X4UiCallRecord => record.recordType === 'call')
    .sort((left, right) => left.order - right.order);
  const previewPathCatalog = createPreviewPathCatalog(
    model,
    normalizedProfile.value.sourceIdentity,
    target
  );
  const normalizedPaths = normalizePreviewPaths(
    previewPathInput,
    normalizedProfile.value.sourceIdentity,
    previewPathCatalog,
    Boolean(profileValue.localExpansion)
  );
  if (normalizedPaths.ok === false) {
    return refusalResult(normalizedPaths.code, normalizedPaths.message, model, target.source);
  }
  const localExpansionPlan = profileValue.localExpansion
    ? buildLocalExpansionPlan(
      model,
      normalizedProfile.value.sourceIdentity,
      target,
      profileValue.localExpansion,
      normalizedPaths.value
    )
    : undefined;
  const targetCalls: ProjectableCall[] = localExpansionPlan?.calls || directTargetCalls;
  const directScaleValues = new Map<string, DirectScaleValue>();
  const resolvedDirectScaleLocations = new Set<string>();
  for (const call of targetCalls) {
    if ((call.name !== 'scaleX' && call.name !== 'scaleY' && call.name !== 'scaleFont')
      || isCallReachabilityBlocked(call)
      || !isHelperReceiver(call)
      || call.semantics.dataFlow) continue;
    const instanceScope = call.expansionInstance?.ancestry.join('>') || '';
    const scale = call.semantics.scale;
    const enabled = scale?.enabled
      ? resolveBoolean(scale.enabled, 'scale', `${call.name} enabled`, call.source)
      : { value: undefined };
    let result: LayoutResult<number> | undefined;
    if (call.name === 'scaleFont') {
      const font = resolveString(scale?.fontname, 'scale', 'scaleFont font name', call.source);
      const fontSize = resolveNumber(
        scale?.fontsize,
        profileValue,
        'scale',
        'scaleFont font size',
        call.source,
        undefined,
        undefined,
        undefined,
        ['scaleX', 'scaleY'],
        instanceScope,
        model,
      );
      if (font.value === undefined || fontSize.value === undefined || font.gap || fontSize.gap || enabled.gap) continue;
      result = scaleFont(font.value, fontSize.value, profileValue.metrics.uiScale, enabled.value);
    } else {
      const input = resolveNumber(
        scale?.input,
        profileValue,
        'scale',
        `${call.name} input`,
        call.source,
        undefined,
        undefined,
        undefined,
        ['scaleX', 'scaleY'],
        instanceScope,
        model,
      );
      if (input.value === undefined || input.gap || enabled.gap) continue;
      result = call.name === 'scaleX'
        ? scaleX(input.value, profileValue.metrics.uiScale, enabled.value)
        : scaleY(input.value, profileValue.metrics.uiScale, enabled.value);
    }
    if (result.status === 'ok') {
      directScaleValues.set(scopedLocationKey(call.source, instanceScope), {
        value: result.value,
        kind: call.name,
        source: cloneLocation(call.source),
        instanceScope,
      });
      resolvedDirectScaleLocations.add(locationKey(call.source));
    }
  }
  const localScaleFontWrapperValues = localScaleFontWrapperValuesFor(model, profileValue);
  const resolvedLocalScaleFontInvocationIds = new Set(localScaleFontWrapperValues.keys());
  const sampleCatalog = createPreviewSampleCatalog(
    normalizedProfile.value.sourceIdentity,
    target,
    targetCalls,
    resolvedDirectScaleLocations,
    resolvedLocalScaleFontInvocationIds,
    Boolean(localExpansionPlan),
  );
  const normalizedSamples = normalizePreviewSamples(
    previewSampleInput,
    normalizedProfile.value.sourceIdentity,
    sampleCatalog,
  );
  if (normalizedSamples.ok === false) {
    return refusalResult(normalizedSamples.code, normalizedSamples.message, model, target.source);
  }
  const previewSamples = normalizedSamples.value;
  const consumedSamples = new Set<string>();
  const projectedContextSources = localExpansionPlan?.contextSources || [target.source];
  const gapEvents: X4UiLayoutGap[] = [];
  const addGap = (gapsValue: X4UiLayoutGap[], gap: X4UiLayoutGap): void =>
    addGapToProgram(gapsValue, gap, gapEvents);
  const isColorExpressionProperty = (propertyName: string): boolean =>
    ['color', 'cellbgcolor', 'bgcolor', 'highlightcolor', 'bordercolor', 'backgroundcolor']
      .includes(normalizeColorPropertyName(propertyName));
  const isColorVerificationGapCategory = (category: X4UiVerificationGap['category']): boolean =>
    category === 'property' || category === 'text';
  const isResolvedModelColorGap = (gap: X4UiVerificationGap): boolean => {
    if (!colorEvidenceInput || !modelColorExpressions || !gap.expression || !isColorVerificationGapCategory(gap.category)) return false;
    const records = modelColorExpressions.filter(record => {
      try {
        return record.colorExpression.expression === gap.expression
          && locationsEqual(record.colorExpression.source, gap.source);
      } catch {
        return false;
      }
    });
    if (records.length !== 1) return false;
    const record = records[0];
    const call = targetCalls.find(candidate => candidate.name === record.callName
      && locationsEqual(candidate.source, record.callSource));
    if (!call) return false;
    if (!isColorExpressionProperty(record.propertyName)) return false;
    const projection = call.semantics.properties?.find(candidate => normalizeColorPropertyName(candidate.name) === normalizeColorPropertyName(record.propertyName));
    if (!projection) return false;
    if (exactColorExpressionRecord(modelColorExpressions, call, projection) !== record) return false;
    const resolution = resolveColorFact(
      modelColorExpressions,
      call,
      record.propertyName,
      projection,
      colorEvidenceInput,
      undefined,
      call.source,
      undefined,
      'property',
      'model color expression remains unavailable',
      record.colorExpression.expression,
    );
    return resolution.fact.status === 'known' && resolution.gap === undefined;
  };
  let gaps: X4UiLayoutGap[] = model.verificationGaps
    .filter(gap => projectedContextSources.some(source => locationContains(source, gap.source))
      && !resolvedDirectScaleLocations.has(locationKey(gap.source))
      && !isResolvedModelColorGap(gap))
    .map(gapFromModel);
  gapEvents.push(...gaps.map(gap => cloneDeep(gap) as X4UiLayoutGap));
  const modelGapCount = gaps.length;
  if (localExpansionPlan) {
    for (const gap of localExpansionPlan.gaps) {
      const clonedGap = cloneDeep(gap) as X4UiLayoutGap;
      gaps.push(clonedGap);
      gapEvents.push(cloneDeep(clonedGap) as X4UiLayoutGap);
    }
  }
  if (model.verificationGapsTruncated) {
    addGap(gaps, {
      category: 'analysis',
      status: 'incomplete',
      reason: 'call-model verification gap list was truncated; static source analysis is incomplete',
      source: cloneLocation(target.source),
    });
  }
  const analysis = invalidAnalysis('complete', model.parsed, gaps.length, model.verificationGapsTruncated);
  const frames: MutableFrame[] = [];
  const tables: MutableTable[] = [];
  const rows: MutableRow[] = [];
  const cells: MutableCell[] = [];
  const operations: MutableOperation[] = [];
  const operationEvents: EvidenceOperationEvent[] = [];
  const nodeLedgerEvents: EvidenceNodeLedgerEvent[] = [];
  const frameByReference = new Map<string, MutableFrame>();
  const tableByReference = new Map<string, MutableTable>();
  const rowByReference = new Map<string, MutableRow>();
  const cellByReference = new Map<string, MutableCell>();
  const cellsByRow = new Map<string, MutableCell[]>();
  const deferredConditionalCellOwners: Array<{
    readonly call: ProjectableCall;
    readonly operation: MutableOperation;
  }> = [];
  let activeCall: ProjectableCall | undefined;

  const recordNode = (kind: EvidenceNodeKind, nodeId: string): void => {
    nodeLedgerEvents.push({ kind, nodeId, ledger: 'node' });
  };

  const appendNodeOperation = (
    kind: EvidenceNodeKind,
    node: { readonly id: string; readonly operationIds: string[] } | undefined,
    operationId: string,
  ): void => {
    if (!node) return;
    node.operationIds.push(operationId);
    nodeLedgerEvents.push({ kind, nodeId: node.id, ledger: 'operationIds', operationId });
  };

  const appendCellMetadataOperation = (cell: MutableCell | undefined, operationId: string): void => {
    if (!cell) return;
    cell.metadataOperationIds.push(operationId);
    nodeLedgerEvents.push({ kind: 'cell', nodeId: cell.id, ledger: 'metadataOperationIds', operationId });
  };

  const appendOperation = (operation: MutableOperation): void => {
    operations.push(operation);
    if (!activeCall) throw new Error(`operation ${operation.id} was appended without an active source call`);
    operationEvents.push({ call: activeCall, operation });
    const receiver = operation.metadata.receiver;
    if (receiver?.reference?.helperRuntimeAvailability === 'unverified') {
      addGap(gaps, {
        category: 'data-flow',
        status: 'incomplete',
        reason: 'rawget Helper alias proves preview receiver identity only; runtime non-nil availability remains unverified',
        expression: receiver.expression,
        source: receiver.reference.helperAliasSource || receiver.location,
        operationId: operation.id
      });
    }
  };

  const addOperationGap = (
    gapsValue: X4UiLayoutGap[],
    operation: MutableOperation,
    category: X4UiLayoutGapCategory,
    gapStatus: X4UiLayoutGapStatus,
    reason: string,
    source: X4UiSourceLocation,
    expression?: string,
    nodeId?: string,
  ): void => addOperationGapToProgram(
    gapsValue,
    operation,
    category,
    gapStatus,
    reason,
    source,
    expression,
    nodeId,
    gapEvents,
  );

  const appendGapForResolution = (operation: MutableOperation, resolution: Resolution<unknown>, nodeId?: string): void => {
    addResolutionGap(gaps, resolution, operation.id, nodeId, gapEvents);
  };

  const resolveProjectedNumber = (
    value: X4UiValue | undefined,
    category: X4UiLayoutGapCategory,
    label: string,
    source: X4UiSourceLocation,
    allowedScaleKinds: readonly DirectScaleValue['kind'][] = [],
  ): Resolution<number> => resolveNumber(
    value,
    profileValue,
    category,
    label,
    source,
    directScaleValues,
    previewSamples.byRangeAndType,
    consumedSamples,
    allowedScaleKinds,
    activeCall?.expansionInstance?.ancestry.join('>') || '',
    model,
    localScaleFontWrapperValues,
  );

  const resolveProjectedBoolean = (
    value: X4UiValue | undefined,
    category: X4UiLayoutGapCategory,
    label: string,
    source: X4UiSourceLocation,
  ): Resolution<boolean> => resolveBoolean(
    value,
    category,
    label,
    source,
    previewSamples.byRangeAndType,
    consumedSamples,
  );

  const resolveProjectedString = (
    value: X4UiValue | undefined,
    category: X4UiLayoutGapCategory,
    label: string,
    source: X4UiSourceLocation,
  ): Resolution<string> => resolveString(
    value,
    category,
    label,
    source,
    previewSamples.byRangeAndType,
    consumedSamples,
  );

  const frameTextureLayerNameForCall = (
    call: ProjectableCall,
  ): X4UiLayoutFrameTextureLayerName | undefined => {
    if (call.name === 'setBackground') return 'background';
    if (call.name === 'setBackground2') return 'background2';
    if (call.name === 'setOverlay') return 'overlay';
    return undefined;
  };

  const unavailableFrameTextureFact = (
    propertyName: string,
    reason: string,
    source: X4UiSourceLocation,
    expression?: string,
  ): X4UiLayoutDescriptorFact => unavailableFact(
    FRAME_TEXTURE_PROPERTY_TYPES[propertyName],
    reason,
    source,
    expression,
  );

  const markTableGap = (table: MutableTable | undefined, refusal = false): void => {
    if (!table) return;
    table.hadGap = true;
    if (refusal) table.hadRefusal = true;
  };

  const addUnsupportedB119PropertyGaps = (
    call: ProjectableCall,
    operation: MutableOperation,
    nodeId?: string,
  ): boolean => {
    if (call.name !== 'setDefaultCellProperties'
      && call.name !== 'setDefaultComplexCellProperties'
      && call.name !== 'setHotkey') return false;
    const unsupported = call.semantics.unsupportedProperties || [];
    for (const property of unsupported) {
      addOperationGap(
        gaps,
        operation,
        'property',
        'unsupported',
        `${call.name} property ${property.name} is retained as source evidence but not applied by bounded layout projection`,
        property.source,
        property.value.expression,
        nodeId,
      );
    }
    return unsupported.length > 0;
  };

  const findTable = (reference: X4UiValueReference | undefined): MutableTable | undefined => {
    const key = referenceKey(reference);
    return key ? tableByReference.get(key) : undefined;
  };

  const findCell = (call: ProjectableCall): { cell?: MutableCell; row?: MutableRow; table?: MutableTable } => {
    const reference = cellReference(call);
    if (!reference) return {};
    const key = referenceKey(reference);
    const existing = key ? cellByReference.get(key) : undefined;
    if (existing) {
      const row = existing.rowId ? rows.find(candidate => candidate.id === existing.rowId) : undefined;
      const table = existing.tableId ? tables.find(candidate => candidate.id === existing.tableId) : undefined;
      return { cell: existing, row, table };
    }
    const callAncestry = call.expansionInstance?.ancestry || [];
    // The emitted cell reference identifies the row that owns the cell. The
    // operation can be emitted later than that reference after a lexical row
    // variable is rebound, so its own source offset is not the ownership
    // boundary.
    const sourceOffset = reference.source.start.offset;
    const sameAncestry = (row: MutableRow): boolean => row.invocationAncestry.length <= callAncestry.length
      && row.invocationAncestry.every((ancestor, index) => callAncestry[index] === ancestor);
    const receiverParentPath = call.receiver?.reference?.parentPath || reference.parentPath;
    const causalRows = receiverParentPath
      ? rows
        .filter(row => row.identity?.path === receiverParentPath
          && sameAncestry(row)
          && row.source.start.offset <= sourceOffset)
        .sort((left, right) => right.source.start.offset - left.source.start.offset
          || right.source.end.offset - left.source.end.offset)
      : [];
    const causalRow = causalRows.length > 0
      && (causalRows.length === 1
        || causalRows[0].source.start.offset !== causalRows[1].source.start.offset
        || causalRows[0].source.end.offset !== causalRows[1].source.end.offset)
      ? causalRows[0]
      : undefined;
    const tableReferenceValue = reference.parentPath?.startsWith('@')
      ? undefined
      : call.semantics.table?.reference;
    let candidateTable = findTable(tableReferenceValue);
    if (causalRow) {
      const causalTable = causalRow.tableId ? tables.find(table => table.id === causalRow.tableId) : undefined;
      if (!causalTable || (candidateTable && candidateTable.id !== causalTable.id)) return {};
      candidateTable = causalTable;
    } else if (!candidateTable && receiverParentPath) {
      return {};
    }
    if (!candidateTable) return {};
    const indexValue = reference.index?.status === 'static' && reference.index.type === 'number'
      ? reference.index.value
      : undefined;
    const hasIndexedCell = (row: MutableRow): boolean => {
      if (!isFiniteNumber(indexValue) || !Number.isInteger(indexValue)) return false;
      return (cellsByRow.get(row.id) || []).some(cell => cell.column === indexValue);
    };
    // Expanded calls retain their canonical callee source ranges, which may
    // precede the caller-side addRow range. Complete ancestry-scoped identity
    // remains the boundary there; the emitted reference offset disambiguates
    // reused lexical paths for both direct and expanded targets.
    const materializedRows = rows
      .filter(row => row.tableId === candidateTable!.id
        && row.identity?.path === receiverParentPath
        && sameAncestry(row)
        && hasIndexedCell(row));
    const orderedMaterializedRows = [
      ...materializedRows
        .filter(row => row.source.start.offset <= sourceOffset)
        .sort((left, right) => right.source.start.offset - left.source.start.offset
          || right.source.end.offset - left.source.end.offset),
      ...materializedRows
        .filter(row => row.source.start.offset > sourceOffset)
        .sort((left, right) => left.source.start.offset - right.source.start.offset
          || left.source.end.offset - right.source.end.offset),
    ];
    const materializedRow = orderedMaterializedRows.length > 0
      && (orderedMaterializedRows.length === 1
        || orderedMaterializedRows[0].source.start.offset !== orderedMaterializedRows[1].source.start.offset
        || orderedMaterializedRows[0].source.end.offset !== orderedMaterializedRows[1].source.end.offset)
      ? orderedMaterializedRows[0]
      : undefined;
    const candidateRow = causalRow && causalRow.tableId === candidateTable.id
      && hasIndexedCell(causalRow)
      ? causalRow
      : materializedRow || (causalRow && causalRow.tableId === candidateTable.id
        ? causalRow
        : mapRowForCell(rows, reference, candidateTable.id, sourceOffset));
    if (!candidateRow || !isFiniteNumber(indexValue) || !Number.isInteger(indexValue)) return { table: candidateTable, row: candidateRow };
    const index = indexValue as number;
    const rowCells = cellsByRow.get(candidateRow.id) || [];
    const cell = rowCells.find(item => item.column === index);
    if (!cell) return { table: candidateTable, row: candidateRow };
    cell.identity = cloneReference(reference);
    cell.cellIdentityKey = key;
    cell.source = cloneLocation(reference.source);
    if (key) cellByReference.set(key, cell);
    return { cell, row: candidateRow, table: candidateTable };
  };

  const resolveFrameDimension = (
    call: X4UiCallRecord,
    name: 'width' | 'height',
    fallback: number,
    operation: MutableOperation,
    frameId: string,
  ): Resolution<number> => {
    const options = optionMode(call);
    if (options === 'unresolved') {
      const result = unresolved<number>(call.semantics.options, 'options', `${call.name} options are dynamic or unknown`, call.source);
      appendGapForResolution(operation, result, frameId);
      return result;
    }
    const value = call.semantics[name];
    if (!value) return {
      value: fallback,
      source: cloneLocation(call.source),
      provenance: 'source-pinned-default',
      sourcePin: cloneDeep(profileValue.helper.constants[name === 'width' ? 'viewWidth' : 'viewHeight'].source) as X4UiLayoutSourcePin,
    };
    const resolved = resolveProjectedNumber(value, 'frame', `frame ${name}`, call.source, name === 'width' ? ['scaleX'] : ['scaleY']);
    appendGapForResolution(operation, resolved, frameId);
    return resolved;
  };

  const displayedFrameIds = new Set<string>();
  for (const call of targetCalls) {
    activeCall = call;
    const blocked = isCallReachabilityBlocked(call);
    if (call.name === 'createFrameHandle') {
      const reference = call.result;
      const identity = referenceKey(reference) || `${call.source.start.offset}`;
      const frameTextureDefaults = frameTextureLayersFor(call, colorEvidenceInput, modelColorExpressions);
      const blurBackgroundDefault = knownDefaultFact(
        true,
        'boolean',
        call.source,
        HELPER_DEFAULT_PINS.frameBlurBackground,
        'true',
      );
      const frame: MutableFrame = {
        id: programId('frame', identity),
        source: cloneLocation(call.source),
        ...(reference ? { identity: cloneReference(reference) } : {}),
        frameTextureLayers: frameTextureDefaults.layers,
        blurBackground: blurBackgroundDefault,
        tableIds: [],
        operationIds: [],
        descriptorFacts: {
          x: knownDefaultFact(0, 'number', call.source, HELPER_DEFAULT_PINS.frameX, '0'),
          y: knownDefaultFact(0, 'number', call.source, HELPER_DEFAULT_PINS.frameY, '0'),
          width: knownDefaultFact(profileValue.frame.width, 'number', call.source, profileValue.helper.constants.viewWidth.source, 'Helper.viewWidth'),
          height: knownDefaultFact(profileValue.frame.height, 'number', call.source, profileValue.helper.constants.viewHeight.source, 'Helper.viewHeight'),
          layer: knownDefaultFact(4, 'number', call.source, HELPER_DEFAULT_PINS.frameLayer, '4'),
          autoFrameHeight: knownDefaultFact(false, 'boolean', call.source, HELPER_DEFAULT_PINS.frameAutoHeight, 'false'),
          blurBackground: blurBackgroundDefault,
        },
        status: blocked || 'partial',
        hadGap: false,
        hadRefusal: false,
      };
      frames.push(frame);
      recordNode('frame', frame.id);
      if (reference) frameByReference.set(referenceKey(reference)!, frame);
      const operation = makeOperation(call, blocked || 'unresolved');
      setOperationLinks(operation, { frameId: frame.id });
      appendNodeOperation('frame', frame, operation.id);
      appendOperation(operation);
      for (const layer of frame.frameTextureLayers) layer.operationIds.push(operation.id);
      if (blocked) {
        operation.reason = blocked === 'unreachable' ? 'unreachable source operation was recorded but not applied' : 'conditional or looped source operation was recorded but not applied';
        frame.hadGap = true;
        continue;
      }
      if (!isHelperReceiver(call)) {
        operation.status = 'unresolved';
        operation.reason = 'createFrameHandle receiver is not the source-matched Helper global';
        frame.hadGap = true;
        addOperationGap(gaps, operation, 'data-flow', 'unknown', operation.reason, call.source, call.receiver?.expression, frame.id);
        continue;
      }
      if (optionMode(call) === 'unresolved') {
        operation.status = 'unresolved';
        operation.reason = 'createFrameHandle options are dynamic or unknown; source defaults were not substituted';
        frame.hadGap = true;
        invalidateDescriptorDefaultsForDynamicOptions(operation, frame.descriptorFacts, call.semantics.options, call.source);
        frame.blurBackground = frame.descriptorFacts.blurBackground;
        addOperationGap(gaps, operation, 'options', 'dynamic', operation.reason, call.semantics.options?.location || call.source, call.semantics.options?.expression, frame.id);
        continue;
      }
      const width = resolveFrameDimension(call, 'width', profileValue.frame.width, operation, frame.id);
      const height = resolveFrameDimension(call, 'height', profileValue.frame.height, operation, frame.id);
      const frameXValue = propertyValue(call, 'x');
      const frameYValue = propertyValue(call, 'y');
      const layerValue = propertyValue(call, 'layer');
      const autoHeightValue = propertyValue(call, 'autoframeheight');
      const blurBackgroundValue = propertyValue(call, 'blurbackground');
      const frameX = frameXValue
        ? resolveProjectedNumber(frameXValue, 'frame', 'frame x', call.source, ['scaleX'])
        : { value: 0, source: cloneLocation(call.source), provenance: 'source-pinned-default' as const, sourcePin: HELPER_DEFAULT_PINS.frameX };
      const frameY = frameYValue
        ? resolveProjectedNumber(frameYValue, 'frame', 'frame y', call.source, ['scaleY'])
        : { value: 0, source: cloneLocation(call.source), provenance: 'source-pinned-default' as const, sourcePin: HELPER_DEFAULT_PINS.frameY };
      const layer = layerValue
        ? resolveProjectedNumber(layerValue, 'frame', 'frame layer', call.source)
        : { value: 4, source: cloneLocation(call.source), provenance: 'source-pinned-default' as const, sourcePin: HELPER_DEFAULT_PINS.frameLayer };
      const autoHeight = autoHeightValue
        ? resolveProjectedBoolean(autoHeightValue, 'frame', 'frame autoFrameHeight', call.source)
        : { value: false, source: cloneLocation(call.source), provenance: 'source-pinned-default' as const, sourcePin: HELPER_DEFAULT_PINS.frameAutoHeight };
      const blurBackground = blurBackgroundValue
        ? resolveProjectedBoolean(blurBackgroundValue, 'frame', 'frame blurBackground', call.source)
        : { value: true, source: cloneLocation(call.source), provenance: 'source-pinned-default' as const, sourcePin: HELPER_DEFAULT_PINS.frameBlurBackground };
      for (const resolution of [frameX, frameY, layer, autoHeight, blurBackground]) appendGapForResolution(operation, resolution, frame.id);
      recordDescriptorFact(operation, frame.descriptorFacts, 'x', frameXValue
        ? factFromResolution(frameXValue, frameX, 'number', call.source, 'frame x')
        : knownDefaultFact(0, 'number', call.source, HELPER_DEFAULT_PINS.frameX, '0'));
      recordDescriptorFact(operation, frame.descriptorFacts, 'y', frameYValue
        ? factFromResolution(frameYValue, frameY, 'number', call.source, 'frame y')
        : knownDefaultFact(0, 'number', call.source, HELPER_DEFAULT_PINS.frameY, '0'));
      recordDescriptorFact(operation, frame.descriptorFacts, 'width', factFromResolution(call.semantics.width, width, 'number', call.source, 'frame width'));
      recordDescriptorFact(operation, frame.descriptorFacts, 'height', factFromResolution(call.semantics.height, height, 'number', call.source, 'frame height'));
      recordDescriptorFact(operation, frame.descriptorFacts, 'layer', layerValue
        ? factFromResolution(layerValue, layer, 'number', call.source, 'frame layer')
        : knownDefaultFact(4, 'number', call.source, HELPER_DEFAULT_PINS.frameLayer, '4'));
      recordDescriptorFact(operation, frame.descriptorFacts, 'autoFrameHeight', autoHeightValue
        ? factFromResolution(autoHeightValue, autoHeight, 'boolean', call.source, 'frame autoFrameHeight')
        : knownDefaultFact(false, 'boolean', call.source, HELPER_DEFAULT_PINS.frameAutoHeight, 'false'));
      recordDescriptorFact(operation, frame.descriptorFacts, 'blurBackground', blurBackgroundValue
        ? factFromResolution(blurBackgroundValue, blurBackground, 'boolean', call.source, 'frame blurBackground')
        : knownDefaultFact(true, 'boolean', call.source, HELPER_DEFAULT_PINS.frameBlurBackground, 'true'));
      frame.blurBackground = frame.descriptorFacts.blurBackground;
      if (width.value !== undefined && !width.gap) {
        frame.width = width.value;
        frame.widthSource = width.source;
      }
      if (height.value !== undefined && !height.gap) {
        frame.height = height.value;
        frame.heightSource = height.source;
      }
      if (width.value === undefined || width.gap || frameX.gap || frameY.gap || layer.gap || autoHeight.gap) {
        operation.status = 'unresolved';
        operation.reason = 'frame width is not completely source-resolved';
        frame.hadGap = true;
        continue;
      }
      if (height.value === undefined || height.gap) {
        operation.status = 'unresolved';
        operation.reason = 'frame height is not completely source-resolved';
        frame.hadGap = true;
        continue;
      }
      if (blurBackground.value === undefined || blurBackground.gap) {
        operation.status = 'unresolved';
        operation.reason = 'frame blurBackground is not completely source-resolved';
        frame.hadGap = true;
        continue;
      }
      operation.status = 'applied';
      frame.status = 'projected';
      continue;
    }

    const frameTextureLayerName = frameTextureLayerNameForCall(call);
    if (frameTextureLayerName !== undefined) {
      const operation = makeOperation(call, blocked || 'unresolved');
      const frameReferenceValue = frameReference(call);
      const frame = frameReferenceValue?.kind === 'frame'
        ? frameByReference.get(referenceKey(frameReferenceValue) || '')
        : undefined;
      setOperationLinks(operation, { frameId: frame?.id });
      appendNodeOperation('frame', frame, operation.id);
      appendOperation(operation);
      if (blocked) {
        operation.reason = blocked === 'unreachable'
          ? 'unreachable source operation was recorded but not applied'
          : 'conditional or looped source operation was recorded but not applied';
        if (frame) frame.hadGap = true;
        continue;
      }
      if (call.method !== ':' || !frame || frame.width === undefined || frame.height === undefined) {
        operation.reason = call.method !== ':'
          ? `${call.name} uses an unsupported receiver/method shape`
          : !frame
            ? `${call.name} receiver is not an applied frame identity`
            : `${call.name} owner frame geometry is not an applied source identity`;
        addOperationGap(
          gaps,
          operation,
          'data-flow',
          call.method !== ':' ? 'unsupported' : 'unknown',
          operation.reason,
          call.source,
          call.receiver?.expression || call.semantics.frame?.expression,
          frame?.id,
        );
        if (frame) frame.hadGap = true;
        continue;
      }
      if (displayedFrameIds.has(frame.id)) {
        operation.reason = `${call.name} occurs after frame:display and is not applied by source-order projection`;
        addOperationGap(gaps, operation, 'data-flow', 'unsupported', operation.reason, call.source, call.receiver?.expression, frame.id);
        frame.hadGap = true;
        continue;
      }
      const layer = frame.frameTextureLayers.find(candidate => candidate.name === frameTextureLayerName);
      if (!layer) {
        operation.reason = `${call.name} frame texture layer ledger is unavailable`;
        addOperationGap(gaps, operation, 'frame', 'incomplete', operation.reason, call.source, undefined, frame.id);
        frame.hadGap = true;
        continue;
      }
      const optionModeValue = optionMode(call);
      let hasGap = false;
      const setLayerFact = (propertyName: string, fact: X4UiLayoutDescriptorFact): void => {
        layer.descriptorFacts[propertyName] = fact;
        operation.descriptorFacts[propertyName] = fact;
      };
      const iconValue = optionModeValue === 'unresolved'
        ? call.semantics.options
        : propertyValue(call, 'icon') || call.semantics.icon;
      const icon = optionModeValue === 'unresolved'
        ? unresolved<string>(
          iconValue,
          'options',
          `${call.name} options are dynamic or unknown; effective frame texture icon was not substituted`,
          call.source,
        )
        : resolveProjectedString(iconValue, 'data-flow', `${call.name} icon`, call.source);
      appendGapForResolution(operation, icon, frame.id);
      if (icon.gap) hasGap = true;
      setLayerFact('icon', factFromResolution(iconValue, icon, 'string', call.source, `${call.name} icon`));

      if (optionModeValue === 'unresolved') {
        const reason = `${call.name} options are dynamic or unknown; frame texture defaults and overrides were not substituted`;
        addOperationGap(
          gaps,
          operation,
          'options',
          'dynamic',
          reason,
          call.semantics.options?.location || call.source,
          call.semantics.options?.expression,
          frame.id,
        );
        for (const propertyName of FRAME_TEXTURE_OPTION_PROPERTIES) {
          setLayerFact(
            propertyName,
            unavailableFrameTextureFact(
              propertyName,
              'dynamic frame texture option table prevents source-pinned default substitution',
              call.semantics.options?.location || call.source,
              call.semantics.options?.expression,
            ),
          );
        }
        hasGap = true;
      } else {
        for (const propertyName of FRAME_TEXTURE_OPTION_PROPERTIES) {
          const value = propertyValue(call, propertyName);
          if (!value) continue;
          if (propertyName === 'color') {
            const projection = property(call, 'color');
            const color = resolveColorFact(
              modelColorExpressions,
              call,
              'color',
              projection,
              colorEvidenceInput,
              undefined,
              call.source,
              undefined,
              'frame',
              'frame texture color remains unavailable without exact source color evidence',
              'frame texture color expression',
            );
            setLayerFact(propertyName, color.fact);
            if (color.gap) {
              addOperationGap(gaps, operation, color.gap.category, color.gap.status, color.gap.reason, color.gap.source, color.gap.expression, frame.id);
              hasGap = true;
            }
          } else {
            const resolution = resolveProjectedNumber(value, 'property', `${call.name} ${propertyName}`, call.source);
            appendGapForResolution(operation, resolution, frame.id);
            if (resolution.gap) hasGap = true;
            setLayerFact(propertyName, factFromResolution(value, resolution, 'number', call.source, `${call.name} ${propertyName}`));
          }
        }
        const recognizedFrameTextureProperties = new Set(['icon', ...FRAME_TEXTURE_OPTION_PROPERTIES]);
        const invalidProjectedProperties = (call.semantics.properties || [])
          .filter(projected => !recognizedFrameTextureProperties.has(projected.name));
        const unsupportedProperties = [
          ...(call.semantics.unsupportedProperties || []),
          ...invalidProjectedProperties,
        ].filter((candidate, index, all) => all.findIndex(existing =>
          existing.name === candidate.name
            && locationsEqual(existing.source, candidate.source)) === index);
        for (const unsupported of unsupportedProperties) {
          addOperationGap(
            gaps,
            operation,
            'property',
            'unsupported',
            `${call.name} property ${unsupported.name} is retained as source evidence but not applied by bounded frame-texture projection`,
            unsupported.source,
            unsupported.value.expression,
            frame.id,
          );
          hasGap = true;
        }
      }
      layer.source = cloneLocation(call.source);
      layer.sourceOrder = call.source.start.offset;
      if (!layer.operationIds.includes(operation.id)) layer.operationIds.push(operation.id);
      if (hasGap) {
        operation.status = 'unresolved';
        operation.reason = optionModeValue === 'unresolved'
          ? `${call.name} frame texture options are not completely source-resolved`
          : `${call.name} frame texture properties are not completely source-resolved`;
        frame.hadGap = true;
      } else {
        operation.status = 'applied';
      }
      continue;
    }

    if (call.name === 'addTable') {
      const reference = call.result;
      const identity = referenceKey(reference) || `${call.source.start.offset}`;
      const table: MutableTable = {
        id: programId('table', identity),
        source: cloneLocation(call.source),
        ...(reference ? { identity: cloneReference(reference) } : {}),
        rowIds: [],
        operationIds: [],
        descriptorFacts: {
          x: knownDefaultFact(0, 'number', call.source, HELPER_DEFAULT_PINS.widgetX, '0'),
          y: knownDefaultFact(0, 'number', call.source, HELPER_DEFAULT_PINS.widgetY, '0'),
          requestedWidth: knownDefaultFact(0, 'number', call.source, HELPER_DEFAULT_PINS.widgetWidth, '0'),
          finalWidth: unavailableFact('number', 'table finalization awaits the first successfully applied addRow', call.source),
          editBoxDefaultHeight: knownDefaultFact(0, 'number', call.source, HELPER_DEFAULT_PINS.widgetHeight, '0'),
          editBoxDefaultScaling: knownDefaultFact(true, 'boolean', call.source, HELPER_DEFAULT_PINS.widgetScaling, 'true'),
          editBoxDefaultHotkey: knownDefaultFact('', 'string', call.source, HELPER_DEFAULT_PINS.editBoxHotkeyDefaults, '""'),
          editBoxDefaultDisplayIcon: knownDefaultFact(false, 'boolean', call.source, HELPER_DEFAULT_PINS.editBoxHotkeyDefaults, 'false'),
          maxVisibleHeight: knownDefaultFact(0, 'number', call.source, HELPER_DEFAULT_PINS.tableMaxVisibleHeight, '0'),
          scaling: knownDefaultFact(true, 'boolean', call.source, HELPER_DEFAULT_PINS.widgetScaling, 'true'),
          tabOrder: knownDefaultFact(0, 'number', call.source, HELPER_DEFAULT_PINS.tableTabOrder, '0'),
          reserveScrollBar: knownDefaultFact(true, 'boolean', call.source, HELPER_DEFAULT_PINS.tableReserveScrollBar, 'true'),
          highlightMode: knownDefaultFact('on', 'string', call.source, HELPER_DEFAULT_PINS.tableHighlightMode, '"on"'),
          backgroundID: knownDefaultFact('', 'string', call.source, HELPER_DEFAULT_PINS.tableBackgroundId, '""'),
          backgroundColor: unavailableFact(
            'color-object',
            'runtime Color table is not projected as RGBA',
            call.source,
            'Color["table_background_default"]',
            HELPER_DEFAULT_PINS.tableBackgroundColor,
          ),
        },
        status: blocked || 'partial',
        hadGap: false,
        hadRefusal: false,
        tableIdentityKey: referenceKey(reference),
        editBoxDefaultsUnresolved: false,
      };
      tables.push(table);
      recordNode('table', table.id);
      if (reference) tableByReference.set(referenceKey(reference)!, table);
      const operation = makeOperation(call, blocked || 'unresolved');
      setOperationLinks(operation, { tableId: table.id });
      appendNodeOperation('table', table, operation.id);
      appendOperation(operation);
      if (blocked) {
        operation.reason = blocked === 'unreachable' ? 'unreachable source operation was recorded but not applied' : 'conditional or looped source operation was recorded but not applied';
        table.hadGap = true;
        continue;
      }
      const frameReferenceValue = frameReference(call);
      const frameKey = referenceKey(frameReferenceValue);
      const frame = frameKey ? frameByReference.get(frameKey) : undefined;
      if (!frame || frame.width === undefined) {
        operation.status = 'unresolved';
        operation.reason = 'addTable owner/frame width is not an applied source identity';
        table.hadGap = true;
        addOperationGap(gaps, operation, 'data-flow', 'unknown', operation.reason, call.source, call.semantics.frame?.expression, table.id);
        continue;
      }
      table.frameId = frame.id;
      table.frameWidth = frame.width;
      frame.tableIds.push(table.id);
      const count = resolveProjectedNumber(call.semantics.count, 'count', 'table column count', call.source);
      appendGapForResolution(operation, count, table.id);
      operation.descriptorFacts.columnCount = factFromResolution(
        call.semantics.count,
        count,
        'number',
        call.source,
        'table column count',
      );
      const mode = optionMode(call);
      if (mode === 'unresolved') {
        operation.status = 'unresolved';
        operation.reason = 'addTable options are dynamic or unknown; source defaults were not substituted';
        table.hadGap = true;
        invalidateDescriptorDefaultsForDynamicOptions(operation, table.descriptorFacts, call.semantics.options, call.source);
        addOperationGap(gaps, operation, 'options', 'dynamic', operation.reason, call.semantics.options?.location || call.source, call.semantics.options?.expression, table.id);
        continue;
      }
      const width = call.semantics.width
        ? resolveProjectedNumber(call.semantics.width, 'width', 'table width', call.source, ['scaleX'])
        : { value: undefined };
      const x = propertyValue(call, 'x')
        ? resolveProjectedNumber(propertyValue(call, 'x'), 'width', 'table x', call.source, ['scaleX'])
        : { value: undefined };
      const scaling = propertyValue(call, 'scaling')
        ? resolveProjectedBoolean(propertyValue(call, 'scaling'), 'options', 'table scaling', call.source)
        : { value: undefined };
      const reserve = propertyValue(call, 'reservescrollbar')
        ? resolveProjectedBoolean(propertyValue(call, 'reservescrollbar'), 'options', 'reserveScrollBar', call.source)
        : { value: undefined };
      const yValue = propertyValue(call, 'y');
      const maxVisibleHeightValue = propertyValue(call, 'maxvisibleheight');
      const tabOrderValue = propertyValue(call, 'taborder');
      const highlightModeValue = propertyValue(call, 'highlightmode');
      const backgroundIdValue = propertyValue(call, 'backgroundid');
      const backgroundColorValue = propertyValue(call, 'backgroundcolor');
      const y = yValue
        ? resolveProjectedNumber(yValue, 'table', 'table y', call.source, ['scaleY'])
        : { value: 0, source: cloneLocation(call.source), provenance: 'source-pinned-default' as const, sourcePin: HELPER_DEFAULT_PINS.widgetY };
      const maxVisibleHeight = maxVisibleHeightValue
        ? resolveProjectedNumber(maxVisibleHeightValue, 'height', 'table maxVisibleHeight', call.source, ['scaleY'])
        : { value: 0, source: cloneLocation(call.source), provenance: 'source-pinned-default' as const, sourcePin: HELPER_DEFAULT_PINS.tableMaxVisibleHeight };
      const tabOrder = tabOrderValue
        ? resolveProjectedNumber(tabOrderValue, 'table', 'table tabOrder', call.source)
        : { value: 0, source: cloneLocation(call.source), provenance: 'source-pinned-default' as const, sourcePin: HELPER_DEFAULT_PINS.tableTabOrder };
      const highlightMode = highlightModeValue
        ? resolveProjectedString(highlightModeValue, 'table', 'table highlightMode', call.source)
        : { value: 'on', source: cloneLocation(call.source), provenance: 'source-pinned-default' as const, sourcePin: HELPER_DEFAULT_PINS.tableHighlightMode };
      const backgroundId = backgroundIdValue
        ? resolveProjectedString(backgroundIdValue, 'table', 'table backgroundID', call.source)
        : { value: '', source: cloneLocation(call.source), provenance: 'source-pinned-default' as const, sourcePin: HELPER_DEFAULT_PINS.tableBackgroundId };
      for (const resolution of [width, x, scaling, reserve, y, maxVisibleHeight, tabOrder, highlightMode, backgroundId]) {
        appendGapForResolution(operation, resolution, table.id);
      }
      recordDescriptorFact(operation, table.descriptorFacts, 'x', propertyValue(call, 'x')
        ? factFromResolution(propertyValue(call, 'x'), x, 'number', call.source, 'table x')
        : knownDefaultFact(0, 'number', call.source, HELPER_DEFAULT_PINS.widgetX, '0'));
      recordDescriptorFact(operation, table.descriptorFacts, 'y', yValue
        ? factFromResolution(yValue, y, 'number', call.source, 'table y')
        : knownDefaultFact(0, 'number', call.source, HELPER_DEFAULT_PINS.widgetY, '0'));
      recordDescriptorFact(operation, table.descriptorFacts, 'requestedWidth', call.semantics.width
        ? factFromResolution(call.semantics.width, width, 'number', call.source, 'table width')
        : knownDefaultFact(0, 'number', call.source, HELPER_DEFAULT_PINS.widgetWidth, '0'));
      recordDescriptorFact(
        operation,
        table.descriptorFacts,
        'finalWidth',
        unavailableFact('number', 'table finalization awaits the first successfully applied addRow', call.source),
      );
      recordDescriptorFact(operation, table.descriptorFacts, 'maxVisibleHeight', maxVisibleHeightValue
        ? factFromResolution(maxVisibleHeightValue, maxVisibleHeight, 'number', call.source, 'table maxVisibleHeight')
        : knownDefaultFact(0, 'number', call.source, HELPER_DEFAULT_PINS.tableMaxVisibleHeight, '0'));
      recordDescriptorFact(operation, table.descriptorFacts, 'scaling', propertyValue(call, 'scaling')
        ? factFromResolution(propertyValue(call, 'scaling'), scaling, 'boolean', call.source, 'table scaling')
        : knownDefaultFact(true, 'boolean', call.source, HELPER_DEFAULT_PINS.widgetScaling, 'true'));
      recordDescriptorFact(operation, table.descriptorFacts, 'tabOrder', tabOrderValue
        ? factFromResolution(tabOrderValue, tabOrder, 'number', call.source, 'table tabOrder')
        : knownDefaultFact(0, 'number', call.source, HELPER_DEFAULT_PINS.tableTabOrder, '0'));
      recordDescriptorFact(operation, table.descriptorFacts, 'reserveScrollBar', propertyValue(call, 'reservescrollbar')
        ? factFromResolution(propertyValue(call, 'reservescrollbar'), reserve, 'boolean', call.source, 'table reserveScrollBar')
        : knownDefaultFact(true, 'boolean', call.source, HELPER_DEFAULT_PINS.tableReserveScrollBar, 'true'));
      recordDescriptorFact(operation, table.descriptorFacts, 'highlightMode', highlightModeValue
        ? factFromResolution(highlightModeValue, highlightMode, 'string', call.source, 'table highlightMode')
        : knownDefaultFact('on', 'string', call.source, HELPER_DEFAULT_PINS.tableHighlightMode, '"on"'));
      recordDescriptorFact(operation, table.descriptorFacts, 'backgroundID', backgroundIdValue
        ? factFromResolution(backgroundIdValue, backgroundId, 'string', call.source, 'table backgroundID')
        : knownDefaultFact('', 'string', call.source, HELPER_DEFAULT_PINS.tableBackgroundId, '""'));
      const tableColor = resolveColorFact(
        modelColorExpressions,
        call,
        'backgroundColor',
        backgroundColorValue ? property(call, 'backgroundcolor') : undefined,
        colorEvidenceInput,
        'table_background_default',
        call.source,
        backgroundColorValue ? undefined : HELPER_DEFAULT_PINS.tableBackgroundColor,
        'table',
        backgroundColorValue
          ? 'color-table values remain source evidence and cannot be sampled as RGBA'
          : 'runtime Color table is not projected as RGBA',
        'Color["table_background_default"]',
        'table backgroundColor is a color-table expression and remains unavailable',
      );
      recordDescriptorFact(operation, table.descriptorFacts, 'backgroundColor', tableColor.fact);
      if (tableColor.gap) {
        addOperationGap(gaps, operation, tableColor.gap.category, tableColor.gap.status, tableColor.gap.reason, tableColor.gap.source, tableColor.gap.expression, table.id);
        table.hadGap = true;
      }
      if (count.value === undefined || count.gap || width.gap || x.gap || scaling.gap || reserve.gap) {
        operation.status = 'unresolved';
        operation.reason = 'addTable has an unresolved required geometry input';
        table.hadGap = true;
        continue;
      }
      const input: HelperTableInput = {
        numColumns: count.value,
        frameWidth: frame.width,
        metrics: profileValue.metrics,
        ...(width.value !== undefined ? { width: width.value } : {}),
        ...(x.value !== undefined ? { x: x.value } : {}),
        ...(scaling.value !== undefined ? { scaling: scaling.value } : {}),
        ...(reserve.value !== undefined ? { reserveScrollBar: reserve.value } : {}),
      };
      const created = createHelperTable(input);
      if (created.status !== 'ok') {
        operation.status = 'rejected';
        operation.reason = created.message;
        operation.kernel = { refusal: created };
        table.hadGap = true;
        table.hadRefusal = true;
        const gap = kernelFailureGap(created, 'table', call.source, operation.id, table.id);
        if (gap) addGap(gaps, gap);
        continue;
      }
      table.kernelState = created.value;
      table.numColumns = count.value;
      table.requestedWidth = created.value.requestedWidth;
      const descriptorGap = Boolean(y.gap || maxVisibleHeight.gap || tabOrder.gap || highlightMode.gap || backgroundId.gap || tableColor.gap);
      operation.status = descriptorGap ? 'unresolved' : 'applied';
      if (descriptorGap) {
        operation.reason = 'table kernel state is deterministic but one or more descriptor facts remain unavailable';
        table.hadGap = true;
      }
      operation.kernel = { stateAfter: created.value };
      table.status = 'projected';
      continue;
    }

    if (call.name === 'setDefaultCellProperties' || call.name === 'setDefaultComplexCellProperties') {
      const table = findTable(call.semantics.table?.reference);
      const operation = makeOperation(call, blocked || 'unresolved');
      setOperationLinks(operation, { tableId: table?.id });
      appendNodeOperation('table', table, operation.id);
      appendOperation(operation);
      const hasUnsupportedProperties = addUnsupportedB119PropertyGaps(call, operation, table?.id);
      if (hasUnsupportedProperties) markTableGap(table);
      if (blocked) {
        operation.reason = blocked === 'unreachable'
          ? 'unreachable source operation was recorded but not applied'
          : 'conditional or looped source operation was recorded but not applied';
        markTableGap(table);
        if (table && (call.semantics.cellType?.status !== 'static'
          || (call.semantics.cellType.type === 'string' && call.semantics.cellType.value === 'editbox'))) {
          table.editBoxDefaultsUnresolved = true;
        }
        if (blocked === 'conditional') {
          addOperationGap(
            gaps,
            operation,
            'data-flow',
            'incomplete',
            'conditional editbox defaults cannot be proven for every execution path',
            call.source,
            call.semantics.cellType?.expression,
            table?.id,
          );
        }
        continue;
      }
      if (!table || !table.kernelState) {
        operation.reason = 'editbox default receiver is not an applied source table identity';
        markTableGap(table);
        addOperationGap(gaps, operation, 'data-flow', 'unknown', operation.reason, call.source, call.semantics.table?.expression, table?.id);
        continue;
      }
      const cellType = call.semantics.cellType;
      const cellTypeKnown = cellType?.status === 'static'
        && cellType.type === 'string'
        && typeof cellType.value === 'string';
      operation.descriptorFacts.cellType = cellTypeKnown
        ? knownSourceFact(cellType.value as string, 'string', cellType.location, cellType.expression)
        : unavailableFact('string', 'editbox default cell type is dynamic or unknown', cellType?.location || call.source, cellType?.expression);
      const propertyName = call.name === 'setDefaultComplexCellProperties' ? call.semantics.propertyName : undefined;
      const propertyNameKnown = call.name === 'setDefaultComplexCellProperties'
        ? propertyName?.status === 'static' && propertyName.type === 'string' && typeof propertyName.value === 'string'
        : true;
      if (propertyName !== undefined) {
        operation.descriptorFacts.propertyName = propertyNameKnown
          ? knownSourceFact(propertyName.value as string, 'string', propertyName.location, propertyName.expression)
          : unavailableFact('string', 'editbox default complex property name is dynamic or unknown', propertyName.location, propertyName.expression);
      }
      const isEditBoxType = cellTypeKnown && cellType.value === 'editbox';
      const isSupportedDefaultForm = isEditBoxType
        && (call.name === 'setDefaultCellProperties'
          || (propertyNameKnown && propertyName?.value === 'hotkey'));
      const isProvablyIrrelevantDefault = cellTypeKnown
        && (cellType.value !== 'editbox'
          || (call.name === 'setDefaultComplexCellProperties'
            && propertyNameKnown
            && propertyName?.value !== 'hotkey'));
      if (isProvablyIrrelevantDefault) {
        operation.status = 'unresolved';
        operation.reason = cellType.value !== 'editbox'
          ? 'non-editbox widget default effects are outside the bounded editbox-height projection'
          : 'non-hotkey editbox default effects are outside the bounded editbox-height projection';
        markTableGap(table);
        addOperationGap(
          gaps,
          operation,
          'options',
          'unsupported',
          operation.reason,
          call.source,
          call.semantics.options?.expression,
          table.id,
        );
        continue;
      }
      if (!isSupportedDefaultForm) {
        operation.status = 'unresolved';
        operation.reason = 'only the literal editbox and hotkey default forms are projected';
        markTableGap(table);
        const potentiallyEditBoxSimple = call.name === 'setDefaultCellProperties'
          && (!cellTypeKnown || cellType.value === 'editbox');
        const potentiallyEditBoxHotkey = call.name === 'setDefaultComplexCellProperties'
          && (!cellTypeKnown || cellType.value === 'editbox')
          && (!propertyNameKnown || propertyName?.value === 'hotkey');
        if (potentiallyEditBoxSimple || potentiallyEditBoxHotkey) table.editBoxDefaultsUnresolved = true;
        const invalidValue = !cellTypeKnown || cellType.value !== 'editbox' ? cellType : propertyName;
        addOperationGap(
          gaps,
          operation,
          'data-flow',
          valueStatus(invalidValue),
          operation.reason,
          invalidValue?.location || call.source,
          invalidValue?.expression,
          table.id,
        );
        continue;
      }
      if (call.method !== ':' || call.semantics.dataFlow !== undefined) {
        operation.status = 'unresolved';
        operation.reason = 'editbox defaults require the shipped colon-method shape and exact table data-flow';
        markTableGap(table);
        table.editBoxDefaultsUnresolved = true;
        addOperationGap(
          gaps,
          operation,
          'data-flow',
          valueStatus(call.semantics.dataFlow),
          operation.reason,
          call.semantics.dataFlow?.location || call.source,
          call.semantics.dataFlow?.expression || call.callee,
          table.id,
        );
        continue;
      }
      if (optionMode(call) === 'unresolved') {
        operation.status = 'unresolved';
        operation.reason = 'editbox default properties are dynamic or unknown; defaults were not applied';
        markTableGap(table);
        table.editBoxDefaultsUnresolved = true;
        addOperationGap(gaps, operation, 'options', 'dynamic', operation.reason, call.semantics.options?.location || call.source, call.semantics.options?.expression, table.id);
        continue;
      }
      const heightValue = call.name === 'setDefaultCellProperties' ? propertyValue(call, 'height') : undefined;
      const scalingValue = call.name === 'setDefaultCellProperties' ? propertyValue(call, 'scaling') : undefined;
      const hotkeyValue = call.name === 'setDefaultComplexCellProperties' ? propertyValue(call, 'hotkey') : undefined;
      const displayIconValue = call.name === 'setDefaultComplexCellProperties' ? propertyValue(call, 'displayicon') : undefined;
      const staticNumber = (value: X4UiValue | undefined): number | undefined => value?.status === 'static'
        && value.type === 'number' && typeof value.value === 'number' && Number.isFinite(value.value)
        ? value.value
        : undefined;
      const staticBoolean = (value: X4UiValue | undefined): boolean | undefined => value?.status === 'static'
        && value.type === 'boolean' && typeof value.value === 'boolean'
        ? value.value
        : undefined;
      const staticString = (value: X4UiValue | undefined): string | undefined => value?.status === 'static'
        && value.type === 'string' && typeof value.value === 'string'
        ? value.value
        : undefined;
      const height = staticNumber(heightValue);
      const scaling = staticBoolean(scalingValue);
      const hotkey = staticString(hotkeyValue);
      const displayIcon = staticBoolean(displayIconValue);
      const invalidProperty = [heightValue, scalingValue, hotkeyValue, displayIconValue]
        .find(value => value !== undefined && value.status !== 'static');
      const invalidPropertyType = [
        heightValue && height === undefined,
        scalingValue && scaling === undefined,
        hotkeyValue && hotkey === undefined,
        displayIconValue && displayIcon === undefined,
      ].some(Boolean);
      if (invalidProperty || invalidPropertyType) {
        operation.status = 'unresolved';
        operation.reason = 'editbox default property is dynamic, unknown, or has the wrong literal type';
        markTableGap(table);
        table.editBoxDefaultsUnresolved = true;
        const invalid = invalidProperty || (heightValue && height === undefined ? heightValue
          : scalingValue && scaling === undefined ? scalingValue
            : hotkeyValue && hotkey === undefined ? hotkeyValue : displayIconValue);
        addOperationGap(gaps, operation, 'data-flow', valueStatus(invalid), operation.reason, invalid?.location || call.source, invalid?.expression, table.id);
        continue;
      }
      if (heightValue) operation.descriptorFacts.height = knownSourceFact(height!, 'number', heightValue.location, heightValue.expression);
      if (scalingValue) operation.descriptorFacts.scaling = knownSourceFact(scaling!, 'boolean', scalingValue.location, scalingValue.expression);
      if (hotkeyValue) operation.descriptorFacts.hotkey = knownSourceFact(hotkey!, 'string', hotkeyValue.location, hotkeyValue.expression);
      if (displayIconValue) operation.descriptorFacts.displayIcon = knownSourceFact(displayIcon!, 'boolean', displayIconValue.location, displayIconValue.expression);
      const before = table.kernelState;
      const result = call.name === 'setDefaultCellProperties'
        ? setDefaultCellProperties(before, 'editbox', {
          ...(heightValue ? { height: height! } : {}),
          ...(scalingValue ? { scaling: scaling! } : {}),
        })
        : setDefaultComplexCellProperties(before, 'editbox', 'hotkey', {
          ...(hotkeyValue ? { hotkey: hotkey! } : {}),
          ...(displayIconValue ? { displayIcon: displayIcon! } : {}),
        });
      operation.kernel = stateResultTransition(result, before);
      if (result.status !== 'ok') {
        operation.status = 'rejected';
        operation.reason = result.message;
        markTableGap(table, true);
        const gap = kernelFailureGap(result, 'table', call.source, operation.id, table.id);
        if (gap) addGap(gaps, gap);
      } else {
        operation.status = hasUnsupportedProperties ? 'unresolved' : 'applied';
        if (hasUnsupportedProperties) {
          operation.reason = 'editbox default kernel state is deterministic but one or more source properties remain outside the bounded projection';
        }
        table.kernelState = result.value;
        if (heightValue) table.descriptorFacts.editBoxDefaultHeight = operation.descriptorFacts.height;
        if (scalingValue) table.descriptorFacts.editBoxDefaultScaling = operation.descriptorFacts.scaling;
        if (hotkeyValue) table.descriptorFacts.editBoxDefaultHotkey = operation.descriptorFacts.hotkey;
        if (displayIconValue) table.descriptorFacts.editBoxDefaultDisplayIcon = operation.descriptorFacts.displayIcon;
      }
      continue;
    }

    if (call.name === 'setColWidth' || call.name === 'setColWidthPercent') {
      const table = findTable(tableReference(call));
      const operation = makeOperation(call, blocked || 'unresolved');
      setOperationLinks(operation, { tableId: table?.id });
      appendNodeOperation('table', table, operation.id);
      appendOperation(operation);
      if (blocked) {
        operation.reason = blocked === 'unreachable' ? 'unreachable source operation was recorded but not applied' : 'conditional or looped source operation was recorded but not applied';
        markTableGap(table);
        continue;
      }
      if (!table || !table.kernelState) {
        operation.status = 'unresolved';
        operation.reason = 'width setter receiver is not an applied table identity';
        markTableGap(table);
        addOperationGap(gaps, operation, 'data-flow', 'unknown', operation.reason, call.source, tableReference(call)?.path, table?.id);
        continue;
      }
      const index = resolveProjectedNumber(call.semantics.index, 'index', 'column index', call.source);
      const widthValue = call.name === 'setColWidthPercent' ? call.semantics.percentage : call.semantics.width;
      const width = resolveProjectedNumber(
        widthValue,
        call.name === 'setColWidthPercent' ? 'percentage' : 'width',
        'column width',
        call.source,
        call.name === 'setColWidth' ? ['scaleX'] : [],
      );
      appendGapForResolution(operation, index, table.id);
      appendGapForResolution(operation, width, table.id);
      const scaling = call.name === 'setColWidth' && call.semantics.scaling
        ? resolveProjectedBoolean(call.semantics.scaling, 'options', 'column scaling', call.source)
        : { value: undefined };
      appendGapForResolution(operation, scaling, table.id);
      operation.descriptorFacts.columnIndex = factFromResolution(
        call.semantics.index,
        index,
        'number',
        call.source,
        'column index',
      );
      operation.descriptorFacts[call.name === 'setColWidthPercent' ? 'percentage' : 'width'] = factFromResolution(
        widthValue,
        width,
        'number',
        call.source,
        'column width',
      );
      if (call.name === 'setColWidth') {
        operation.descriptorFacts.scaling = call.semantics.scaling
          ? factFromResolution(call.semantics.scaling, scaling, 'boolean', call.source, 'column scaling')
          : knownDefaultFact(true, 'boolean', call.source, HELPER_DEFAULT_PINS.widgetScaling, 'true');
      }
      if (index.value === undefined || width.value === undefined || index.gap || width.gap || scaling.gap) {
        operation.status = 'unresolved';
        operation.reason = 'column width operation has an unresolved static input';
        markTableGap(table);
        continue;
      }
      const before = table.kernelState;
      const result = call.name === 'setColWidth'
        ? setColWidth(before, index.value, width.value, scaling.value)
        : setColWidthPercent(before, index.value, width.value);
      operation.kernel = stateResultTransition(result, before);
      if (result.status !== 'ok') {
        operation.status = 'rejected';
        operation.reason = result.message;
        table.hadGap = true;
        table.hadRefusal = true;
        const gap = kernelFailureGap(result, call.name === 'setColWidthPercent' ? 'percentage' : 'width', call.source, operation.id, table.id);
        if (gap) addGap(gaps, gap);
      } else {
        operation.status = 'applied';
        table.kernelState = result.value;
      }
      continue;
    }

    if (call.name === 'addRow') {
      const table = findTable(tableReference(call));
      const reference = call.result;
      const row: MutableRow = {
        id: programId('row', referenceKey(reference) || `${call.source.start.offset}`),
        source: cloneLocation(call.source),
        ...(reference ? { identity: cloneReference(reference) } : {}),
        ...(table ? { tableId: table.id } : {}),
        cellIds: [],
        operationIds: [],
        descriptorFacts: {
          paddingTop: knownDefaultFact(0, 'number', call.source, HELPER_DEFAULT_PINS.rowPaddingTop, '0'),
          paddingBottom: knownDefaultFact(0, 'number', call.source, HELPER_DEFAULT_PINS.rowPaddingBottom, '0'),
          borderBelow: knownDefaultFact(true, 'boolean', call.source, HELPER_DEFAULT_PINS.rowBorderBelow, 'true'),
          fixed: knownDefaultFact(false, 'boolean', call.source, HELPER_DEFAULT_PINS.rowFixed, 'false'),
          scaling: unavailableFact('boolean', 'row scaling awaits the owning table effective properties.scaling', call.source),
          selectable: unavailableFact('boolean', 'rowdata selectability has not been resolved for an applied row', call.source),
          interactive: unavailableFact('boolean', 'row properties interactive has not been resolved for an applied row', call.source),
        },
        status: blocked || 'unresolved',
        hadGap: false,
        hadRefusal: false,
        rowIdentityKey: referenceKey(reference),
        invocationAncestry: call.expansionInstance?.ancestry ? [...call.expansionInstance.ancestry] : [],
      };
      rows.push(row);
      recordNode('row', row.id);
      if (reference) rowByReference.set(referenceKey(reference)!, row);
      const operation = makeOperation(call, blocked || 'unresolved');
      setOperationLinks(operation, { tableId: table?.id, rowId: row.id });
      appendNodeOperation('table', table, operation.id);
      appendNodeOperation('row', row, operation.id);
      appendOperation(operation);
      if (blocked) {
        operation.reason = blocked === 'unreachable' ? 'unreachable source operation was recorded but not applied' : 'conditional or looped source operation was recorded but not applied';
        row.hadGap = true;
        markTableGap(table);
        if (blocked === 'conditional' && table?.kernelState && table.numColumns !== undefined) {
          const sourceCells = makeBaseCells(table, row, table.numColumns);
          for (const cell of sourceCells) {
            row.cellIds.push(cell.id);
            cells.push(cell);
            recordNode('cell', cell.id);
          }
          cellsByRow.set(row.id, sourceCells);
        }
        continue;
      }
      if (!table || !table.kernelState) {
        operation.reason = 'row owner is not an applied table identity';
        row.hadGap = true;
        markTableGap(table);
        addOperationGap(gaps, operation, 'data-flow', 'unknown', operation.reason, call.source, tableReference(call)?.path, row.id);
        continue;
      }
      const tableState = table.kernelState;
      const tableScalingFact = table.descriptorFacts.scaling;
      const finalizedForRow = tableState.final
        ? { status: 'ok' as const, value: tableState }
        : finalizeHelperTable(tableState);
      const inheritedScaling: Resolution<boolean> = finalizedForRow.status === 'ok'
        && tableScalingFact?.status === 'known'
        && tableScalingFact.expectedType === 'boolean'
        && typeof tableScalingFact.value === 'boolean'
        && finalizedForRow.value.properties.scaling === tableScalingFact.value
        ? {
          value: finalizedForRow.value.properties.scaling,
          source: cloneLocation(tableScalingFact.source),
          provenance: tableScalingFact.provenance,
          ...(tableScalingFact.sourcePin
            ? { sourcePin: cloneDeep(tableScalingFact.sourcePin) as X4UiLayoutSourcePin }
            : {}),
        }
        : {
          gap: {
            category: 'row' as const,
            status: 'incomplete' as const,
            reason: 'addRow effective scaling is unavailable from the owning table kernel state',
            source: cloneLocation(table.source),
          },
        };
      const selectable = resolveLuaTruthiness(
        call.semantics.rowData,
        'row',
        'rowdata selectability',
        call.source,
      );
      appendGapForResolution(operation, selectable, row.id);
      recordDescriptorFact(
        operation,
        row.descriptorFacts,
        'selectable',
        call.semantics.rowData
          ? factFromResolution(call.semantics.rowData, selectable, 'boolean', call.source, 'not not row.rowdata')
          : knownDefaultFact(false, 'boolean', call.source, HELPER_DEFAULT_PINS.rowSelectable, 'not not row.rowdata'),
      );
      const mode = optionMode(call);
      if (mode === 'unresolved') {
        operation.reason = 'addRow options are dynamic or unknown; source defaults were not substituted';
        row.hadGap = true;
        markTableGap(table);
        const selectableFact = row.descriptorFacts.selectable;
        invalidateDescriptorDefaultsForDynamicOptions(operation, row.descriptorFacts, call.semantics.options, call.source);
        operation.descriptorFacts.selectable = selectableFact;
        row.descriptorFacts.selectable = selectableFact;
        addOperationGap(gaps, operation, 'options', 'dynamic', operation.reason, call.semantics.options?.location || call.source, call.semantics.options?.expression, row.id);
        continue;
      }
      const fields: { name: string; value: X4UiValue | undefined; category: X4UiLayoutGapCategory }[] = [
        { name: 'paddingtop', value: propertyValue(call, 'paddingtop'), category: 'row' },
        { name: 'paddingbottom', value: propertyValue(call, 'paddingbottom'), category: 'row' },
      ];
      const paddingTop = fields[0].value ? resolveProjectedNumber(fields[0].value, 'row', 'row paddingTop', call.source, ['scaleY']) : { value: undefined };
      const paddingBottom = fields[1].value ? resolveProjectedNumber(fields[1].value, 'row', 'row paddingBottom', call.source, ['scaleY']) : { value: undefined };
      const borderBelow = propertyValue(call, 'borderbelow') ? resolveProjectedBoolean(propertyValue(call, 'borderbelow'), 'row', 'row borderBelow', call.source) : { value: undefined };
      const fixed = propertyValue(call, 'fixed') ? resolveProjectedBoolean(propertyValue(call, 'fixed'), 'row', 'row fixed', call.source) : { value: undefined };
      const scalingValue = propertyValue(call, 'scaling');
      const scaling = scalingValue
        ? resolveProjectedBoolean(scalingValue, 'row', 'row scaling', call.source)
        : inheritedScaling;
      for (const resolution of [paddingTop, paddingBottom, borderBelow, fixed, scaling]) appendGapForResolution(operation, resolution, row.id);
      const interactiveValue = propertyValue(call, 'interactive');
      const interactive = interactiveValue
        ? resolveProjectedBoolean(interactiveValue, 'row', 'row properties interactive', call.source)
        : {
          value: true,
          source: cloneLocation(call.source),
          provenance: 'source-pinned-default' as const,
          sourcePin: HELPER_DEFAULT_PINS.rowInteractive,
        };
      appendGapForResolution(operation, interactive, row.id);
      recordDescriptorFact(operation, row.descriptorFacts, 'paddingTop', fields[0].value
        ? factFromResolution(fields[0].value, paddingTop, 'number', call.source, 'row paddingTop')
        : knownDefaultFact(0, 'number', call.source, HELPER_DEFAULT_PINS.rowPaddingTop, '0'));
      recordDescriptorFact(operation, row.descriptorFacts, 'paddingBottom', fields[1].value
        ? factFromResolution(fields[1].value, paddingBottom, 'number', call.source, 'row paddingBottom')
        : knownDefaultFact(0, 'number', call.source, HELPER_DEFAULT_PINS.rowPaddingBottom, '0'));
      recordDescriptorFact(operation, row.descriptorFacts, 'borderBelow', propertyValue(call, 'borderbelow')
        ? factFromResolution(propertyValue(call, 'borderbelow'), borderBelow, 'boolean', call.source, 'row borderBelow')
        : knownDefaultFact(true, 'boolean', call.source, HELPER_DEFAULT_PINS.rowBorderBelow, 'true'));
      recordDescriptorFact(operation, row.descriptorFacts, 'fixed', propertyValue(call, 'fixed')
        ? factFromResolution(propertyValue(call, 'fixed'), fixed, 'boolean', call.source, 'row fixed')
        : knownDefaultFact(false, 'boolean', call.source, HELPER_DEFAULT_PINS.rowFixed, 'false'));
      recordDescriptorFact(operation, row.descriptorFacts, 'scaling', propertyValue(call, 'scaling')
        ? factFromResolution(scalingValue, scaling, 'boolean', call.source, 'row scaling')
        : factFromResolution(undefined, scaling, 'boolean', call.source, 'row scaling inherited from owning table properties.scaling'));
      recordDescriptorFact(operation, row.descriptorFacts, 'interactive', interactiveValue
        ? factFromResolution(interactiveValue, interactive, 'boolean', call.source, 'row properties interactive')
        : knownDefaultFact(true, 'boolean', call.source, HELPER_DEFAULT_PINS.rowInteractive, 'true'));
      const ignoredHeight = propertyValue(call, 'height');
      if (ignoredHeight) {
        addOperationGap(gaps, operation, 'height', ignoredHeight.status === 'dynamic' ? 'dynamic' : ignoredHeight.status === 'unknown' ? 'unknown' : 'unsupported', 'addRow height is non-operative in shipped Helper; cell geometry must come from a later specialization', ignoredHeight.location, ignoredHeight.expression, row.id);
        row.hadGap = true;
        table.hadGap = true;
      }
      if (paddingTop.gap || paddingBottom.gap || borderBelow.gap || fixed.gap || scaling.gap) {
        operation.reason = 'row geometry options are not completely static';
        row.hadGap = true;
        markTableGap(table);
        continue;
      }
      const before = table.kernelState;
      const result = addRow(before, {
        ...(paddingTop.value !== undefined ? { paddingTop: paddingTop.value } : {}),
        ...(paddingBottom.value !== undefined ? { paddingBottom: paddingBottom.value } : {}),
        ...(borderBelow.value !== undefined ? { borderBelow: borderBelow.value } : {}),
        ...(fixed.value !== undefined ? { fixed: fixed.value } : {}),
        ...(scaling.value !== undefined ? { scaling: scaling.value } : {}),
      });
      operation.kernel = stateResultTransition(result, before);
      if (result.status !== 'ok') {
        operation.status = 'rejected';
        operation.reason = result.message;
        row.hadGap = true;
        row.hadRefusal = true;
        markTableGap(table, true);
        const gap = kernelFailureGap(result, 'row', call.source, operation.id, row.id);
        if (gap) addGap(gaps, gap);
        continue;
      }
      operation.status = 'applied';
      if (selectable.gap || interactive.gap || ignoredHeight) {
        operation.reason = 'row kernel state is deterministic but one or more descriptor facts remain unresolved';
        row.hadGap = true;
        table.hadGap = true;
      }
      table.kernelState = result.value;
      const finalWidthFact = knownDefaultFact(
        result.value.properties.width,
        'number',
        call.source,
        HELPER_DEFAULT_PINS.tableFinalWidthBoundary,
        'addRow kernel result after Helper.finalizeTableColumnWidths(self)',
      );
      operation.descriptorFacts.finalWidth = finalWidthFact;
      if (table.descriptorFacts.finalWidth.status !== 'known') {
        table.descriptorFacts.finalWidth = finalWidthFact;
      }
      row.rowIndex = result.value.rows.length;
      row.kernelState = result.value.rows[result.value.rows.length - 1];
      table.rowIds.push(row.id);
      const rowCells = makeBaseCells(table, row, result.value.columns.length);
      for (const cell of rowCells) {
        row.cellIds.push(cell.id);
        cells.push(cell);
        recordNode('cell', cell.id);
      }
      cellsByRow.set(row.id, rowCells);
      continue;
    }

    if (call.name === 'setColSpan') {
      const found = findCell(call);
      const operation = makeOperation(call, blocked || 'unresolved');
      const deferredOwner = blocked === 'conditional'
        && found.table !== undefined
        && found.table.kernelState !== undefined
        && found.cell === undefined;
      setOperationLinks(operation, {
        tableId: found.table?.id,
        ...(deferredOwner ? {} : { rowId: found.row?.id, cellId: found.cell?.id }),
      });
      appendNodeOperation('table', found.table, operation.id);
      if (!deferredOwner) {
        appendNodeOperation('row', found.row, operation.id);
        appendNodeOperation('cell', found.cell, operation.id);
      }
      appendOperation(operation);
      if (deferredOwner) deferredConditionalCellOwners.push({ call, operation });
      if (blocked) {
        operation.reason = blocked === 'unreachable' ? 'unreachable source operation was recorded but not applied' : 'conditional or looped source operation was recorded but not applied';
        if (found.cell) found.cell.hadGap = true;
        markTableGap(found.table);
        continue;
      }
      if (!found.table || !found.row || !found.cell || !found.table.kernelState || found.row.rowIndex === undefined) {
        operation.reason = 'colspan receiver/index is not an applied source cell identity';
        if (found.cell) found.cell.hadGap = true;
        markTableGap(found.table);
        const receiver = cellReference(call);
        addOperationGap(gaps, operation, 'data-flow', 'unknown', operation.reason, call.source, receiver?.path, found.cell?.id);
        continue;
      }
      const span = resolveProjectedNumber(call.semantics.span, 'span', 'cell colspan', call.source);
      appendGapForResolution(operation, span, found.cell.id);
      operation.descriptorFacts.span = factFromResolution(call.semantics.span, span, 'number', call.source, 'cell colspan');
      const column = found.cell.column;
      if (span.value === undefined || span.gap) {
        operation.reason = 'cell colspan is not a complete static number';
        found.cell.hadGap = true;
        markTableGap(found.table);
        continue;
      }
      const before = found.table.kernelState;
      const result = setCellColSpan(before, found.row.rowIndex, column, span.value);
      operation.kernel = stateResultTransition(result, before);
      if (result.status !== 'ok') {
        operation.status = 'rejected';
        operation.reason = result.message;
        found.cell.hadGap = true;
        found.cell.hadRefusal = true;
        markTableGap(found.table, true);
        const gap = kernelFailureGap(result, 'span', call.source, operation.id, found.cell.id);
        if (gap) addGap(gaps, gap);
      } else {
        operation.status = 'applied';
        found.table.kernelState = result.value;
        found.cell.descriptorFacts.span = operation.descriptorFacts.span;
        if (result.value.diagnostics.length > before.diagnostics.length) {
          found.table.hadGap = true;
          for (const diagnostic of result.value.diagnostics.slice(before.diagnostics.length)) {
            addOperationGap(gaps, operation, 'span', 'refused', diagnostic.message, call.source, undefined, found.cell.id);
          }
        }
      }
      continue;
    }

    if (call.name === 'setHotkey') {
      const found = findCell(call);
      const operation = makeOperation(call, blocked || 'unresolved');
      const deferredOwner = blocked === 'conditional'
        && found.table !== undefined
        && found.table.kernelState !== undefined
        && found.cell === undefined;
      setOperationLinks(operation, {
        tableId: found.table?.id,
        ...(deferredOwner ? {} : { rowId: found.row?.id, cellId: found.cell?.id }),
      });
      appendNodeOperation('table', found.table, operation.id);
      if (!deferredOwner) {
        appendNodeOperation('row', found.row, operation.id);
        appendNodeOperation('cell', found.cell, operation.id);
      }
      appendOperation(operation);
      const hasUnsupportedProperties = addUnsupportedB119PropertyGaps(call, operation, found.cell?.id);
      if (hasUnsupportedProperties) {
        if (found.cell) found.cell.hadGap = true;
        markTableGap(found.table);
      }
      if (deferredOwner) deferredConditionalCellOwners.push({ call, operation });
      if (blocked) {
        operation.reason = blocked === 'unreachable'
          ? 'unreachable source operation was recorded but not applied'
          : 'conditional or looped source operation was recorded but not applied';
        if (found.cell) found.cell.hadGap = true;
        markTableGap(found.table);
        if (blocked === 'conditional') {
          addOperationGap(gaps, operation, 'edit-box', 'incomplete', 'conditional editbox hotkey cannot be proven for every execution path', call.source, call.semantics.hotkey?.expression, found.cell?.id);
        }
        continue;
      }
      if (!found.table || !found.row || !found.cell || !found.table.kernelState || found.row.rowIndex === undefined) {
        operation.reason = 'setHotkey receiver is not an applied source editbox cell identity';
        if (found.cell) found.cell.hadGap = true;
        markTableGap(found.table);
        addOperationGap(gaps, operation, 'data-flow', 'unknown', operation.reason, call.source, call.semantics.cell?.expression, found.cell?.id);
        continue;
      }
      const contentKindFact = found.cell.descriptorFacts.contentKind;
      const isButtonReceiver = contentKindFact.status === 'known'
        && contentKindFact.expectedType === 'string'
        && contentKindFact.value === 'button';
      if (isButtonReceiver && call.method === ':' && call.semantics.dataFlow === undefined) {
        operation.status = 'unresolved';
        operation.reason = 'button setHotkey effects are outside the bounded editbox-height projection';
        operation.descriptorFacts.contentKind = cloneDeep(contentKindFact) as X4UiLayoutDescriptorFact;
        found.cell.hadGap = true;
        markTableGap(found.table);
        addOperationGap(
          gaps,
          operation,
          'options',
          'unsupported',
          operation.reason,
          call.source,
          call.semantics.options?.expression || call.semantics.hotkey?.expression,
          found.cell.id,
        );
        continue;
      }
      if (call.method !== ':' || call.semantics.dataFlow !== undefined) {
        operation.status = 'unresolved';
        operation.reason = 'editbox setHotkey requires the shipped colon-method shape and exact cell data-flow';
        found.cell.hadGap = true;
        markTableGap(found.table);
        addOperationGap(
          gaps,
          operation,
          'data-flow',
          valueStatus(call.semantics.dataFlow),
          operation.reason,
          call.semantics.dataFlow?.location || call.source,
          call.semantics.dataFlow?.expression || call.callee,
          found.cell.id,
        );
        continue;
      }
      if (optionMode(call) === 'unresolved') {
        operation.reason = 'setHotkey options are dynamic or unknown; displayIcon was not projected';
        found.cell.hadGap = true;
        markTableGap(found.table);
        addOperationGap(gaps, operation, 'options', 'dynamic', operation.reason, call.semantics.options?.location || call.source, call.semantics.options?.expression, found.cell.id);
        continue;
      }
      const hotkeyProperty = property(call, 'hotkey');
      const hotkeyValue = hotkeyProperty?.value || call.semantics.hotkey;
      const argumentHotkeyValue = call.semantics.hotkey;
      const displayIconValue = propertyValue(call, 'displayicon');
      const hotkey = hotkeyValue?.status === 'static' && hotkeyValue.type === 'string' && typeof hotkeyValue.value === 'string'
        ? hotkeyValue.value
        : undefined;
      const displayIcon = displayIconValue?.status === 'static' && displayIconValue.type === 'boolean' && typeof displayIconValue.value === 'boolean'
        ? displayIconValue.value
        : undefined;
      const invalidValue = hotkey === undefined
        ? hotkeyValue
        : displayIconValue !== undefined && displayIcon === undefined
          ? displayIconValue
          : undefined;
      operation.descriptorFacts.hotkey = hotkeyValue && hotkey !== undefined
        ? knownSourceFact(hotkey, 'string', hotkeyValue.location, hotkeyValue.expression)
        : unavailableFact('string', 'setHotkey value is dynamic, unknown, or not a string', hotkeyValue?.location || call.source, hotkeyValue?.expression);
      if (displayIconValue) {
        operation.descriptorFacts.displayIcon = displayIcon !== undefined
          ? knownSourceFact(displayIcon, 'boolean', displayIconValue.location, displayIconValue.expression)
          : unavailableFact('boolean', 'setHotkey displayIcon is dynamic, unknown, or not boolean', displayIconValue.location, displayIconValue.expression);
      }
      if (invalidValue || hotkey === undefined) {
        operation.reason = 'setHotkey requires a static string hotkey and optional static boolean displayIcon';
        found.cell.hadGap = true;
        markTableGap(found.table);
        addOperationGap(gaps, operation, 'edit-box', valueStatus(invalidValue), operation.reason, invalidValue?.location || call.source, invalidValue?.expression, found.cell.id);
        continue;
      }
      const before = found.table.kernelState;
      const argumentHotkey = argumentHotkeyValue?.status === 'static'
        && argumentHotkeyValue.type === 'string'
        && typeof argumentHotkeyValue.value === 'string'
        ? argumentHotkeyValue.value
        : hotkey!;
      const result = setCellHotkey(
        before,
        found.row.rowIndex,
        found.cell.column,
        argumentHotkey,
        hotkeyProperty || displayIconValue
          ? {
            ...(hotkeyProperty ? { hotkey: hotkey! } : {}),
            ...(displayIconValue ? { displayIcon } : {}),
          }
          : undefined,
      );
      operation.kernel = stateResultTransition(result, before);
      if (result.status !== 'ok') {
        operation.status = 'rejected';
        operation.reason = result.message;
        found.cell.hadGap = true;
        found.cell.hadRefusal = true;
        markTableGap(found.table, true);
        const gap = kernelFailureGap(result, 'cell', call.source, operation.id, found.cell.id);
        if (gap) addGap(gaps, gap);
      } else {
        operation.status = hasUnsupportedProperties ? 'unresolved' : 'applied';
        if (hasUnsupportedProperties) {
          operation.reason = 'setHotkey kernel state is deterministic but one or more source properties remain outside the bounded projection';
        }
        found.table.kernelState = result.value;
        found.cell.descriptorFacts.hotkey = operation.descriptorFacts.hotkey;
        if (displayIconValue) found.cell.descriptorFacts.displayIcon = operation.descriptorFacts.displayIcon;
      }
      continue;
    }

    if (call.name === 'createText' || call.name === 'createButton' || call.name === 'createEditBox' || call.name === 'createIcon') {
      const found = findCell(call);
      const operation = makeOperation(call, blocked || 'unresolved');
      const deferredOwner = blocked === 'conditional'
        && found.table !== undefined
        && found.table.kernelState !== undefined
        && found.cell === undefined;
      setOperationLinks(operation, {
        tableId: found.table?.id,
        ...(deferredOwner ? {} : { rowId: found.row?.id, cellId: found.cell?.id }),
      });
      appendNodeOperation('table', found.table, operation.id);
      if (!deferredOwner) {
        appendNodeOperation('row', found.row, operation.id);
        appendNodeOperation('cell', found.cell, operation.id);
      }
      appendOperation(operation);
      if (deferredOwner) deferredConditionalCellOwners.push({ call, operation });
      if (blocked) {
        operation.reason = blocked === 'unreachable' ? 'unreachable source operation was recorded but not applied' : 'conditional or looped source operation was recorded but not applied';
        if (found.cell) found.cell.hadGap = true;
        markTableGap(found.table);
        continue;
      }
      if (!found.table || !found.row || !found.cell || !found.table.kernelState || found.row.rowIndex === undefined) {
        operation.reason = 'specialization receiver/index is not an applied source cell identity';
        if (found.cell) found.cell.hadGap = true;
        markTableGap(found.table);
        addOperationGap(gaps, operation, 'data-flow', 'unknown', operation.reason, call.source, cellReference(call)?.path, found.cell?.id);
        continue;
      }
      const type = call.name === 'createText' ? 'text' : call.name === 'createButton' ? 'button' : call.name === 'createEditBox' ? 'editbox' : 'icon';
      const recognizedHeaderBundle = isHeaderRowCenteredProperties(call, canonicalCorpusInput);
      operation.metadata = synthesizeHeaderBundleMetadata(operation.metadata, call, canonicalCorpusInput);
      const mode = optionMode(call);
      if (mode === 'unresolved' && !recognizedHeaderBundle) {
        operation.reason = 'specialization options are dynamic or unknown; source defaults were not substituted';
        found.cell.hadGap = true;
        markTableGap(found.table);
        const dynamicSource = call.semantics.options?.location || call.source;
        for (const [field, expectedType] of Object.entries({
          outerX: 'number',
          outerY: 'number',
          outerWidth: 'number',
          outerHeight: 'number',
          scaling: 'boolean',
          font: 'string',
          fontsize: 'number',
          halign: 'string',
          wordwrap: 'boolean',
        }) as [string, X4UiLayoutScalarType][]) {
          operation.descriptorFacts[field] = unavailableFact(
            expectedType,
            'dynamic option table prevents source-pinned default substitution',
            dynamicSource,
            call.semantics.options?.expression,
          );
        }
        addOperationGap(gaps, operation, 'options', 'dynamic', operation.reason, call.semantics.options?.location || call.source, call.semantics.options?.expression, found.cell.id);
        continue;
      }
      if (type === 'editbox' && found.table.editBoxDefaultsUnresolved) {
        operation.reason = 'an earlier editbox table default is dynamic or conditional; editbox geometry was not projected';
        found.cell.hadGap = true;
        markTableGap(found.table);
        addOperationGap(gaps, operation, 'edit-box', 'incomplete', operation.reason, call.source, call.semantics.options?.expression, found.cell.id);
        continue;
      }
      const xValue = propertyValue(call, 'x');
      const heightValue = propertyValue(call, 'height');
      const yValue = propertyValue(call, 'y');
      const widthValue = propertyValue(call, 'width');
      const scalingValue = propertyValue(call, 'scaling');
      const affectValue = propertyValue(call, 'affectrowheight');
      const xDefault = type === 'text' ? 5 : 0;
      const xDefaultPin = type === 'text' ? HELPER_DEFAULT_PINS.textX : HELPER_DEFAULT_PINS.widgetX;
      const yDefault = recognizedHeaderBundle ? 2 : 0;
      const yDefaultPin = recognizedHeaderBundle
        ? HELPER_HEADER_ROW_PINS.offsetY
        : type === 'text' ? HELPER_DEFAULT_PINS.textY : HELPER_DEFAULT_PINS.widgetY;
      const x = xValue
        ? resolveProjectedNumber(xValue, 'width', `${type} x`, call.source, ['scaleX'])
        : { value: xDefault, source: cloneLocation(call.source), provenance: 'source-pinned-default' as const, sourcePin: xDefaultPin };
      const y = yValue
        ? resolveProjectedNumber(yValue, 'height', `${type} y`, call.source, ['scaleY'])
        : { value: yDefault, source: cloneLocation(call.source), provenance: 'source-pinned-default' as const, sourcePin: yDefaultPin };
      const width = widthValue
        ? resolveProjectedNumber(widthValue, 'width', `${type} width`, call.source, ['scaleX'])
        : { value: 0, source: cloneLocation(call.source), provenance: 'source-pinned-default' as const, sourcePin: HELPER_DEFAULT_PINS.widgetWidth };
      const height = heightValue
        ? resolveProjectedNumber(heightValue, 'height', `${type} height`, call.source, ['scaleY'])
        : type === 'button'
          ? { value: undefined }
          : type === 'editbox'
            ? { value: undefined }
            : { value: 0, source: cloneLocation(call.source), provenance: 'source-pinned-default' as const, sourcePin: HELPER_DEFAULT_PINS.widgetHeight };
      const editBoxDefaultScaling = type === 'editbox'
        ? found.table.kernelState.editBoxDefaults.scaling
        : undefined;
      const editBoxScalingFact = editBoxDefaultScaling === undefined
        ? undefined
        : found.table.descriptorFacts.editBoxDefaultScaling;
      const scalingFactProvenance = editBoxScalingFact?.status === 'known' && editBoxScalingFact.expectedType === 'boolean'
        ? editBoxScalingFact.provenance
        : undefined;
      const scaling: Resolution<boolean> = scalingValue
        ? resolveProjectedBoolean(scalingValue, 'options', `${type} scaling`, call.source)
        : type === 'editbox'
          ? {
            value: editBoxDefaultScaling ?? found.row.kernelState?.scaling ?? true,
            source: cloneLocation(editBoxScalingFact?.source || call.source),
            provenance: scalingFactProvenance || 'source-pinned-default' as const,
            ...(editBoxScalingFact?.sourcePin
              ? { sourcePin: cloneDeep(editBoxScalingFact.sourcePin) as X4UiLayoutSourcePin }
              : { sourcePin: HELPER_DEFAULT_PINS.baseCellScaling }),
          }
          : { value: found.row.kernelState?.scaling ?? true, source: cloneLocation(call.source), provenance: 'source-pinned-default' as const, sourcePin: HELPER_DEFAULT_PINS.baseCellScaling };
      const affect = affectValue
        ? resolveProjectedBoolean(affectValue, 'options', `${type} affectRowHeight`, call.source)
        : { value: type === 'button' || type === 'icon' ? true : undefined };
      for (const resolution of [x, y, width, height, scaling, affect]) appendGapForResolution(operation, resolution, found.cell.id);

      const textValue = type === 'text' ? call.semantics.text : undefined;
      const iconValue = type === 'icon' ? call.semantics.icon : undefined;
      const content = textValue
        ? resolveProjectedString(textValue, 'text', 'text content', call.source)
        : iconValue
          ? resolveProjectedString(iconValue, 'text', 'icon identity', call.source)
          : { value: '', source: cloneLocation(call.source), provenance: 'source-pinned-default' as const, sourcePin: type === 'icon' ? HELPER_DEFAULT_PINS.iconIdentity : HELPER_DEFAULT_PINS.textContent };
      appendGapForResolution(operation, content, found.cell.id);

      const fontValue = propertyValue(call, 'font');
      const fontSizeValue = propertyValue(call, 'fontsize');
      const halignValue = propertyValue(call, 'halign');
      const wordwrapValue = propertyValue(call, 'wordwrap');
      const defaultTextValue = propertyValue(call, 'defaulttext');
      const descriptionValue = propertyValue(call, 'description');
      const maxCharsValue = propertyValue(call, 'maxchars');
      const selectTextValue = propertyValue(call, 'selecttextonactivation');
      const activeValue = propertyValue(call, 'active');
      const minRowHeightValue = type === 'text' ? propertyValue(call, 'minrowheight') : undefined;
      const font = fontValue
        ? resolveProjectedString(fontValue, 'text', `${type} font`, call.source)
        : {
          value: recognizedHeaderBundle ? 'Zekton Bold' : 'Zekton',
          source: cloneLocation(call.source),
          provenance: 'source-pinned-default' as const,
          sourcePin: recognizedHeaderBundle ? HELPER_HEADER_ROW_PINS.titleFont : HELPER_DEFAULT_PINS.standardFont,
        };
      const fontSize = fontSizeValue
        ? resolveProjectedNumber(fontSizeValue, 'text', `${type} font size`, call.source, ['scaleFont'])
        : { value: 9, source: cloneLocation(call.source), provenance: 'source-pinned-default' as const, sourcePin: HELPER_DEFAULT_PINS.standardFontSize };
      const halign = halignValue
        ? resolveProjectedString(halignValue, 'text', `${type} horizontal alignment`, call.source)
        : {
          value: recognizedHeaderBundle ? 'center' : 'left',
          source: cloneLocation(call.source),
          provenance: 'source-pinned-default' as const,
          sourcePin: recognizedHeaderBundle ? HELPER_HEADER_ROW_PINS.halign : HELPER_DEFAULT_PINS.standardHalignment,
        };
      const wordwrap = wordwrapValue
        ? resolveProjectedBoolean(wordwrapValue, 'text', `${type} wordwrap`, call.source)
        : { value: false, source: cloneLocation(call.source), provenance: 'source-pinned-default' as const, sourcePin: HELPER_DEFAULT_PINS.textWordwrap };
      const defaultText = defaultTextValue
        ? resolveProjectedString(defaultTextValue, 'text', 'edit-box defaultText', call.source)
        : { value: '', source: cloneLocation(call.source), provenance: 'source-pinned-default' as const, sourcePin: HELPER_DEFAULT_PINS.editBoxDefaultText };
      const description = descriptionValue
        ? resolveProjectedString(descriptionValue, 'text', 'edit-box description', call.source)
        : { value: '', source: cloneLocation(call.source), provenance: 'source-pinned-default' as const, sourcePin: HELPER_DEFAULT_PINS.editBoxDescription };
      const maxChars = maxCharsValue
        ? resolveProjectedNumber(maxCharsValue, 'text', 'edit-box maxChars', call.source)
        : { value: 50, source: cloneLocation(call.source), provenance: 'source-pinned-default' as const, sourcePin: HELPER_DEFAULT_PINS.editBoxMaxChars };
      const selectText = selectTextValue
        ? resolveProjectedBoolean(selectTextValue, 'text', 'edit-box selectTextOnActivation', call.source)
        : { value: true, source: cloneLocation(call.source), provenance: 'source-pinned-default' as const, sourcePin: HELPER_DEFAULT_PINS.editBoxSelectTextOnActivation };
      const active = activeValue
        ? resolveProjectedBoolean(activeValue, 'cell', `${type} active`, call.source)
        : { value: true, source: cloneLocation(call.source), provenance: 'source-pinned-default' as const, sourcePin: type === 'editbox' ? HELPER_DEFAULT_PINS.editBoxActive : HELPER_DEFAULT_PINS.buttonActive };
      const minRowHeight: Resolution<number> = type === 'text'
        ? minRowHeightValue
          ? resolveProjectedNumber(minRowHeightValue, 'height', 'text minRowHeight', call.source, ['scaleY'])
          : {
            value: recognizedHeaderBundle ? 20 : profileValue.helper.constants.standardTextHeight.value,
            source: cloneLocation(call.source),
            provenance: 'source-pinned-default' as const,
            sourcePin: recognizedHeaderBundle ? HELPER_HEADER_ROW_PINS.minRowHeight : HELPER_DEFAULT_PINS.textMinRowHeight,
          }
        : { value: undefined };
      for (const resolution of [font, fontSize, halign, wordwrap]) appendGapForResolution(operation, resolution, found.cell.id);
      if (type === 'text') appendGapForResolution(operation, minRowHeight, found.cell.id);
      if (type === 'editbox') {
        for (const resolution of [defaultText, description, maxChars, selectText, active]) appendGapForResolution(operation, resolution, found.cell.id);
      } else if (type === 'button') appendGapForResolution(operation, active, found.cell.id);

      let buttonHeight = height.value;
      if (type === 'button' && heightValue === undefined && profileValue.defaults.standardButtonHeight) {
        buttonHeight = profileValue.defaults.standardButtonHeight.value;
      }
      if (type === 'button' && heightValue === undefined && !profileValue.defaults.standardButtonHeight) {
        found.cell.missingHeight = true;
        addOperationGap(gaps, operation, 'height', 'unknown', 'button height was omitted and no source-pinned standardButtonHeight was supplied', call.source, undefined, found.cell.id);
        found.cell.hadGap = true;
        found.table.hadGap = true;
      }
      operation.descriptorFacts.outerX = xValue
        ? factFromResolution(xValue, x, 'number', call.source, `${type} x`)
        : knownDefaultFact(xDefault, 'number', call.source, xDefaultPin, type === 'text' ? 'Helper.standardTextOffsetx' : '0');
      operation.descriptorFacts.outerY = yValue
        ? factFromResolution(yValue, y, 'number', call.source, `${type} y`)
        : knownDefaultFact(yDefault, 'number', call.source, yDefaultPin, recognizedHeaderBundle ? 'Helper.headerRow1Offsety' : type === 'text' ? 'Helper.standardTextOffsety' : '0');
      operation.descriptorFacts.outerWidth = widthValue
        ? factFromResolution(widthValue, width, 'number', call.source, `${type} width`)
        : knownDefaultFact(0, 'number', call.source, HELPER_DEFAULT_PINS.widgetWidth, '0');
      operation.descriptorFacts.outerHeight = heightValue
        ? factFromResolution(heightValue, height, 'number', call.source, `${type} height`)
        : type === 'button' && profileValue.defaults.standardButtonHeight
          ? knownDefaultFact(buttonHeight!, 'number', call.source, profileValue.defaults.standardButtonHeight.source, 'Helper.standardButtonHeight')
          : type === 'button'
            ? unavailableFact('number', 'button height lacks a source-pinned standardButtonHeight default', call.source)
            : knownDefaultFact(0, 'number', call.source, HELPER_DEFAULT_PINS.widgetHeight, '0');
      if (height.gap || y.gap || scaling.gap || affect.gap) {
        operation.reason = 'specialization geometry contains a dynamic or unknown required input';
        found.cell.hadGap = true;
        markTableGap(found.table);
        continue;
      }
      const effectiveScaling = scaling.value ?? true;
      const scaledX = scaleX(x.value ?? 0, profileValue.metrics.uiScale, effectiveScaling);
      const scaledY = scaleY(y.value ?? 0, profileValue.metrics.uiScale, effectiveScaling);
      const scaledFontSize = font.value !== undefined && fontSize.value !== undefined
        ? scaleFont(font.value, fontSize.value, profileValue.metrics.uiScale, effectiveScaling)
        : undefined;
      const scaledMinRowHeight = type === 'text' && minRowHeight.value !== undefined
        ? scaleY(minRowHeight.value, profileValue.metrics.uiScale, effectiveScaling)
        : undefined;
      const floorDependency = minRowHeight.provenance === 'preview-sample'
        ? minRowHeight
        : y.provenance === 'preview-sample'
          ? y
          : minRowHeight.provenance === 'direct-helper-scale'
            ? minRowHeight
            : y.provenance === 'direct-helper-scale'
              ? y
              : minRowHeight;
      const minRowHeightFloor: Resolution<number> = type !== 'text'
        ? { value: undefined }
        : scaledMinRowHeight?.status === 'ok' && scaledY.status === 'ok'
          ? {
            value: scaledMinRowHeight.value - scaledY.value,
            source: cloneLocation(floorDependency.source || call.source),
            provenance: floorDependency.provenance || 'source-pinned-default',
            sourcePin: HELPER_DEFAULT_PINS.textMinHeightBoundary,
            ...(floorDependency.sampleId ? { sampleId: floorDependency.sampleId } : {}),
          }
          : unresolved(
            minRowHeightValue,
            'height',
            'text minRowHeight floor cannot be resolved exactly',
            call.source,
          );
      const minRowHeightExpression = minRowHeightValue?.expression
        || (recognizedHeaderBundle ? 'Helper.headerRow1Height' : 'Helper.standardTextHeight');
      const textYExpression = yValue?.expression
        || (recognizedHeaderBundle ? 'Helper.headerRow1Offsety' : 'Helper.standardTextOffsety');
      const minRowHeightFloorExpression = `Helper.scaleY(${minRowHeightExpression}) - Helper.scaleY(${textYExpression})`;
      const sourceMinRowHeightFact = type === 'text'
        ? minRowHeightValue
          ? factFromResolution(minRowHeightValue, minRowHeight, 'number', call.source, 'text minRowHeight')
          : knownDefaultFact(
            recognizedHeaderBundle ? 20 : profileValue.helper.constants.standardTextHeight.value,
            'number',
            call.source,
            recognizedHeaderBundle ? HELPER_HEADER_ROW_PINS.minRowHeight : HELPER_DEFAULT_PINS.textMinRowHeight,
            recognizedHeaderBundle ? 'Helper.headerRow1Height' : 'Helper.standardTextHeight',
          )
        : unavailableFact('number', `${type} has no text minRowHeight`, call.source);
      const minRowHeightFloorFact = type === 'text' && minRowHeightFloor.value !== undefined
        ? {
          status: 'known' as const,
          expectedType: 'number' as const,
          value: minRowHeightFloor.value,
          provenance: minRowHeightFloor.provenance || 'source-pinned-default' as const,
          expression: minRowHeightFloorExpression,
          source: cloneLocation(minRowHeightFloor.source || call.source),
          sourcePin: HELPER_DEFAULT_PINS.textMinHeightBoundary,
          ...(minRowHeightFloor.sampleId ? { sampleId: minRowHeightFloor.sampleId } : {}),
        }
        : unavailableFact(
          'number',
          minRowHeightFloor.gap?.reason || `${type} has no text minRowHeight floor`,
          minRowHeightFloor.gap?.source || call.source,
          type === 'text' ? minRowHeightFloorExpression : undefined,
          type === 'text' ? HELPER_DEFAULT_PINS.textMinHeightBoundary : undefined,
        );
      let canonicalTextHeightCandidate: DerivedTextHeightCandidate | undefined;
      if (type === 'text' && height.value === 0 && canonicalCorpusInput !== undefined) {
        const spanWidth = getColSpanWidth(found.table.kernelState, found.row.rowIndex, found.cell.column);
        if (spanWidth.status !== 'ok') {
          canonicalTextHeightCandidate = {
            reason: `finalized cell span width is unavailable: ${spanWidth.message}`,
          };
        } else if (scaledX.status !== 'ok') {
          canonicalTextHeightCandidate = { reason: 'scaled text x offset is unavailable for the finalized cell span width' };
        } else {
          const explicitWidth = width.value !== undefined && width.value !== 0
            ? scaleX(width.value, profileValue.metrics.uiScale, effectiveScaling)
            : undefined;
          const maxWidth = explicitWidth?.status === 'ok'
            ? explicitWidth.value
            : spanWidth.value - scaledX.value;
          canonicalTextHeightCandidate = explicitWidth !== undefined && explicitWidth.status !== 'ok'
            ? { reason: `explicit text width could not be scaled: ${explicitWidth.message}` }
            : deriveCanonicalTextHeightCandidate(
              canonicalCorpusInput,
              font.value,
              content.value,
              scaledFontSize?.status === 'ok' ? scaledFontSize.value : undefined,
              maxWidth,
              wordwrap.value,
            );
        }
      }
      const rawTextHeightCandidate = canonicalTextHeightCandidate?.value;
      const textHeightCandidate = type === 'text'
        && height.value === 0
        && minRowHeightFloor.value !== undefined
        ? canonicalCorpusInput !== undefined
          ? rawTextHeightCandidate !== undefined
            ? Math.max(rawTextHeightCandidate, profileValue.defaults.minTextHeight || 0, minRowHeightFloor.value)
            : profileValue.defaults.minTextHeight !== undefined
              ? Math.max(profileValue.defaults.minTextHeight, minRowHeightFloor.value)
              : undefined
          : profileValue.defaults.minTextHeight !== undefined
            ? Math.max(profileValue.defaults.minTextHeight, minRowHeightFloor.value)
            : undefined
        : undefined;
      const textHeightCandidateExpression = rawTextHeightCandidate !== undefined
        ? profileValue.defaults.minTextHeight !== undefined
          ? `max(${canonicalTextHeightCandidate?.expression || 'Math.ceil(layoutZektonText(...))'}, profile.defaults.minTextHeight, ${minRowHeightFloorExpression})`
          : `max(${canonicalTextHeightCandidate?.expression || 'Math.ceil(layoutZektonText(...))'}, ${minRowHeightFloorExpression})`
        : 'max(profile.defaults.minTextHeight, ' + minRowHeightFloorExpression + ')';
      if (type === 'text' && height.value === 0 && textHeightCandidate === undefined) {
        found.cell.missingHeight = true;
        const reason = canonicalTextHeightCandidate?.reason
          || (profileValue.defaults.minTextHeight === undefined
          ? 'zero-height text requires a supplied/proven C++ text-height candidate; minRowHeight proves only the Helper floor'
          : 'zero-height text cannot combine the supplied/proven C++ text-height candidate with an unresolved minRowHeight floor');
        addOperationGap(gaps, operation, 'height', 'unknown', reason, minRowHeightValue?.location || call.source, minRowHeightValue?.expression, found.cell.id);
        found.cell.hadGap = true;
        found.table.hadGap = true;
      }
      const finalTextHeightFact: X4UiLayoutDescriptorFact = textHeightCandidate !== undefined
        ? {
          status: 'known',
          expectedType: 'number',
          value: textHeightCandidate,
          provenance: minRowHeightFloor.provenance || 'source-pinned-default',
          expression: textHeightCandidateExpression,
          source: cloneLocation(minRowHeightFloor.source || call.source),
          sourcePin: HELPER_DEFAULT_PINS.textMinHeightBoundary,
          ...(minRowHeightFloor.sampleId ? { sampleId: minRowHeightFloor.sampleId } : {}),
        }
        : unavailableFact(
          'number',
          'final text height requires both a supplied/proven C++ text-height candidate and the exact Helper minRowHeight floor',
          minRowHeightValue?.location || call.source,
          minRowHeightFloorExpression,
          HELPER_DEFAULT_PINS.textMinHeightBoundary,
        );
      const editBoxDefaultTextColorResolution = type === 'editbox'
        ? resolveColorFact(
          modelColorExpressions,
          call,
          'defaultTextColor',
          undefined,
          colorEvidenceInput,
          'editbox_text_default',
          call.source,
          WIDGET_DEFAULT_PINS.editBoxDefaultTextColor,
          'text',
          'edit-box defaultText color requires canonical editbox_text_default evidence',
          'Color["editbox_text_default"]',
        )
        : undefined;
      const editBoxBackgroundBlackColorResolution = type === 'editbox'
        ? resolveColorFact(
          modelColorExpressions,
          call,
          'editboxBackgroundBlackColor',
          undefined,
          colorEvidenceInput,
          'editbox_background_black',
          call.source,
          WIDGET_DEFAULT_PINS.editBoxBackgroundBlackColor,
          'cell',
          'edit-box inner background requires canonical editbox_background_black evidence',
          'Color["editbox_background_black"]',
        )
        : undefined;
      const editBoxBlackInsetExpression = 'max(2, floor(config.editbox.border * uiScale + 0.5))';
      const editBoxBlackInsetValue = type === 'editbox'
        ? Math.max(2, Math.floor(profileValue.metrics.uiScale + 0.5))
        : undefined;
      const editBoxBlackInsetFact = type === 'editbox' && editBoxBlackInsetValue !== undefined
        && Number.isSafeInteger(editBoxBlackInsetValue)
        && editBoxBlackInsetValue <= 1_000_000
        ? knownDefaultFact(editBoxBlackInsetValue, 'number', call.source, WIDGET_DEFAULT_PINS.editBoxBlackInset, editBoxBlackInsetExpression)
        : type === 'editbox'
          ? unavailableFact(
            'number',
            'scaled edit-box black inset is outside the safe preview geometry domain',
            call.source,
            editBoxBlackInsetExpression,
            WIDGET_DEFAULT_PINS.editBoxBlackInset,
          )
          : undefined;
      const editBoxBaseHeightFact = type === 'editbox'
        ? heightValue
          ? factFromResolution(heightValue, height, 'number', call.source, 'edit-box base height')
          : found.table.descriptorFacts.editBoxDefaultHeight?.status === 'known'
            ? cloneDeep(found.table.descriptorFacts.editBoxDefaultHeight) as X4UiLayoutDescriptorFact
            : knownDefaultFact(0, 'number', call.source, HELPER_DEFAULT_PINS.widgetHeight, '0')
        : knownDefaultFact(height.value ?? 0, 'number', call.source, HELPER_DEFAULT_PINS.widgetHeight, '0');
      const editBoxBaseScalingFact = type === 'editbox'
        ? scalingValue
          ? factFromResolution(scalingValue, scaling, 'boolean', call.source, 'edit-box base scaling')
          : editBoxDefaultScaling !== undefined && editBoxScalingFact?.status === 'known'
            ? cloneDeep(editBoxScalingFact) as X4UiLayoutDescriptorFact
            : knownDefaultFact(effectiveScaling, 'boolean', call.source, HELPER_DEFAULT_PINS.baseCellScaling, 'row.properties.scaling')
        : knownDefaultFact(effectiveScaling, 'boolean', call.source, HELPER_DEFAULT_PINS.baseCellScaling, 'row.properties.scaling');
      const editBoxHotkeyFact = type === 'editbox'
        ? found.table.descriptorFacts.editBoxDefaultHotkey?.status === 'known'
          ? cloneDeep(found.table.descriptorFacts.editBoxDefaultHotkey) as X4UiLayoutDescriptorFact
          : knownDefaultFact('', 'string', call.source, HELPER_DEFAULT_PINS.editBoxHotkeyDefaults, '""')
        : unavailableFact('string', `${type} has no edit-box hotkey`, call.source);
      const editBoxDisplayIconFact = type === 'editbox'
        ? found.table.descriptorFacts.editBoxDefaultDisplayIcon?.status === 'known'
          ? cloneDeep(found.table.descriptorFacts.editBoxDefaultDisplayIcon) as X4UiLayoutDescriptorFact
          : knownDefaultFact(false, 'boolean', call.source, HELPER_DEFAULT_PINS.editBoxHotkeyDefaults, 'false')
        : unavailableFact('boolean', `${type} has no edit-box hotkey icon flag`, call.source);
      const pendingFacts: Record<string, X4UiLayoutDescriptorFact> = {
        contentKind: knownSourceFact(type, 'string', call.source, call.name),
        span: found.cell.descriptorFacts.span,
        outerX: scaledX.status === 'ok'
          ? withKnownFactValue(factFromResolution(xValue, x, 'number', call.source, `${type} x`), scaledX.value)
          : unavailableFact('number', scaledX.message, call.source, xValue?.expression),
        outerY: scaledY.status === 'ok'
          ? withKnownFactValue(factFromResolution(yValue, y, 'number', call.source, `${type} y`), scaledY.value)
          : unavailableFact('number', scaledY.message, call.source, yValue?.expression),
        outerWidth: unavailableFact('number', 'cell outer width is finalized from explicit width or column span after replay', width.source || call.source, widthValue?.expression),
        outerHeight: heightValue
          ? factFromResolution(heightValue, height, 'number', call.source, `${type} height`)
          : type === 'button' && profileValue.defaults.standardButtonHeight
            ? knownDefaultFact(buttonHeight!, 'number', call.source, profileValue.defaults.standardButtonHeight.source, 'Helper.standardButtonHeight')
            : type === 'text'
              ? finalTextHeightFact
            : type === 'editbox'
              ? editBoxBaseHeightFact
              : knownDefaultFact(0, 'number', call.source, HELPER_DEFAULT_PINS.widgetHeight, '0'),
        ...(type === 'editbox' ? {
          baseHeight: editBoxBaseHeightFact,
          baseScaling: editBoxBaseScalingFact,
          hotkey: editBoxHotkeyFact,
          displayIcon: editBoxDisplayIconFact,
        } : {
          hotkey: unavailableFact('string', `${type} has no edit-box hotkey`, call.source),
          displayIcon: unavailableFact('boolean', `${type} has no edit-box hotkey icon flag`, call.source),
        }),
        ...(type === 'text' ? {
          minTextHeight: finalTextHeightFact,
          minRowHeight: sourceMinRowHeightFact,
          minRowHeightFloor: minRowHeightFloorFact,
        } : {}),
        scaling: scalingValue
          ? factFromResolution(scalingValue, scaling, 'boolean', call.source, `${type} scaling`)
          : editBoxBaseScalingFact,
        affectRowHeight: affectValue
          ? factFromResolution(affectValue, affect, 'boolean', call.source, `${type} affectRowHeight`)
          : type === 'button'
            ? knownDefaultFact(true, 'boolean', call.source, HELPER_DEFAULT_PINS.buttonAffectRowHeight, 'true')
            : type === 'icon'
              ? knownDefaultFact(true, 'boolean', call.source, HELPER_DEFAULT_PINS.iconAffectRowHeight, 'true')
              : unavailableFact('boolean', `${type} descriptor does not expose affectRowHeight`, call.source),
        primaryContent: textValue || iconValue
          ? factFromResolution(textValue || iconValue, content, 'string', call.source, `${type} primary content`)
          : knownDefaultFact('', 'string', call.source, HELPER_DEFAULT_PINS.textContent, '""'),
        text: textValue
          ? factFromResolution(textValue, content, 'string', call.source, 'text content')
          : knownDefaultFact('', 'string', call.source, HELPER_DEFAULT_PINS.textContent, '""'),
        text2: knownDefaultFact('', 'string', call.source, HELPER_DEFAULT_PINS.textContent, '""'),
        font: fontValue
          ? factFromResolution(fontValue, font, 'string', call.source, `${type} font`)
          : knownDefaultFact(
            recognizedHeaderBundle ? 'Zekton Bold' : 'Zekton',
            'string',
            call.source,
            recognizedHeaderBundle ? HELPER_HEADER_ROW_PINS.titleFont : HELPER_DEFAULT_PINS.standardFont,
            recognizedHeaderBundle ? 'Helper.titleFont' : 'Helper.standardFont',
          ),
        fontsize: fontSizeValue
          ? scaledFontSize?.status === 'ok'
            ? withKnownFactValue(factFromResolution(fontSizeValue, fontSize, 'number', call.source, `${type} font size`), scaledFontSize.value)
            : factFromResolution(fontSizeValue, fontSize, 'number', call.source, `${type} font size`)
          : knownDefaultFact(
            scaledFontSize?.status === 'ok' ? scaledFontSize.value : 9,
            'number',
            call.source,
            recognizedHeaderBundle ? HELPER_HEADER_ROW_PINS.standardFontSize : HELPER_DEFAULT_PINS.standardFontSize,
            'Helper.scaleFont(Helper.standardFontSize)',
          ),
        halign: halignValue
          ? factFromResolution(halignValue, halign, 'string', call.source, `${type} horizontal alignment`)
          : knownDefaultFact(
            recognizedHeaderBundle ? 'center' : 'left',
            'string',
            call.source,
            recognizedHeaderBundle ? HELPER_HEADER_ROW_PINS.halign : HELPER_DEFAULT_PINS.standardHalignment,
            recognizedHeaderBundle ? 'halign = "center" in Helper.headerRowCenteredProperties' : 'Helper.standardHalignment',
          ),
        wordwrap: wordwrapValue
          ? factFromResolution(wordwrapValue, wordwrap, 'boolean', call.source, `${type} wordwrap`)
          : knownDefaultFact(false, 'boolean', call.source, HELPER_DEFAULT_PINS.textWordwrap, 'false'),
        defaultText: type === 'editbox'
          ? (defaultTextValue
            ? factFromResolution(defaultTextValue, defaultText, 'string', call.source, 'edit-box defaultText')
            : knownDefaultFact('', 'string', call.source, HELPER_DEFAULT_PINS.editBoxDefaultText, '""'))
          : unavailableFact('string', `${type} has no edit-box defaultText`, call.source),
        ...(type === 'editbox' ? {
          defaultTextColor: editBoxDefaultTextColorResolution!.fact,
          editboxBackgroundBlackColor: editBoxBackgroundBlackColorResolution!.fact,
          editboxConfigBorder: knownDefaultFact(1, 'number', call.source, WIDGET_DEFAULT_PINS.editBoxConfigBorder, 'config.editbox.border'),
          editboxTextBorder: knownDefaultFact(2, 'number', call.source, WIDGET_DEFAULT_PINS.editBoxTextBorder, 'config.texturesizes.editbox.borderSize'),
          editboxBlackInset: editBoxBlackInsetFact!,
          editboxInitialInputActive: knownDefaultFact(false, 'boolean', call.source, WIDGET_DEFAULT_PINS.editBoxInitialInputActive, 'initial setUpEditBox entry has no active direct-input flag'),
        } : {}),
        description: type === 'editbox'
          ? (descriptionValue
            ? factFromResolution(descriptionValue, description, 'string', call.source, 'edit-box description')
            : knownDefaultFact('', 'string', call.source, HELPER_DEFAULT_PINS.editBoxDescription, '""'))
          : unavailableFact('string', `${type} has no edit-box description`, call.source),
        maxChars: type === 'editbox'
          ? (maxCharsValue
            ? factFromResolution(maxCharsValue, maxChars, 'number', call.source, 'edit-box maxChars')
            : knownDefaultFact(50, 'number', call.source, HELPER_DEFAULT_PINS.editBoxMaxChars, 'Helper.standardEditBoxMaxTextLength'))
          : unavailableFact('number', `${type} has no edit-box maxChars`, call.source),
        selectTextOnActivation: type === 'editbox'
          ? (selectTextValue
            ? factFromResolution(selectTextValue, selectText, 'boolean', call.source, 'edit-box selectTextOnActivation')
            : knownDefaultFact(true, 'boolean', call.source, HELPER_DEFAULT_PINS.editBoxSelectTextOnActivation, 'true'))
          : unavailableFact('boolean', `${type} has no edit-box selection behavior`, call.source),
        icon: type === 'icon'
          ? (iconValue
            ? factFromResolution(iconValue, content, 'string', call.source, 'icon identity')
            : knownDefaultFact('', 'string', call.source, HELPER_DEFAULT_PINS.iconIdentity, '""'))
          : unavailableFact('string', `${type} has no primary icon identity`, call.source),
        active: type === 'button' || type === 'editbox'
          ? (activeValue
            ? factFromResolution(activeValue, active, 'boolean', call.source, `${type} active`)
            : knownDefaultFact(true, 'boolean', call.source, type === 'button' ? HELPER_DEFAULT_PINS.buttonActive : HELPER_DEFAULT_PINS.editBoxActive, 'true'))
          : unavailableFact('boolean', `${type} has no active descriptor flag`, call.source),
      };
      for (const [field, fact] of Object.entries(pendingFacts)) operation.descriptorFacts[field] = fact;
      const colorProperties = ['color', 'cellbgcolor', 'bgcolor', 'highlightcolor', 'bordercolor'] as const;
      const helperColorDefault = (colorName: typeof colorProperties[number]): { readonly id: string; readonly pin: X4UiLayoutSourcePin } | undefined => {
        if (colorName === 'cellbgcolor') {
          return recognizedHeaderBundle
            ? { id: 'container_subsection_header', pin: HELPER_HEADER_ROW_PINS.cellBackgroundColor }
            : { id: 'row_background', pin: HELPER_DEFAULT_PINS.cellBackgroundColor };
        }
        if (colorName === 'color') {
          return type === 'icon'
            ? { id: 'icon_normal', pin: HELPER_DEFAULT_PINS.iconColor }
            : type === 'text'
              ? { id: 'text_normal', pin: HELPER_DEFAULT_PINS.textColor }
              : undefined;
        }
        if (colorName === 'bgcolor') {
          return type === 'button'
            ? { id: 'button_background_default', pin: HELPER_DEFAULT_PINS.buttonBackgroundColor }
            : type === 'editbox'
              ? { id: 'editbox_background_default', pin: HELPER_DEFAULT_PINS.editBoxBackgroundColor }
              : undefined;
        }
        if (colorName === 'highlightcolor' && type === 'button') {
          return { id: 'button_highlight_default', pin: HELPER_DEFAULT_PINS.buttonHighlightColor };
        }
        if (colorName === 'bordercolor' && type === 'button') {
          return { id: 'button_border_default', pin: HELPER_DEFAULT_PINS.buttonBorderColor };
        }
        return undefined;
      };
      let colorDescriptorGap = false;
      for (const colorName of colorProperties) {
        const colorValue = propertyValue(call, colorName);
        const defaultColor = helperColorDefault(colorName);
        if (!colorValue && !colorEvidenceInput) continue;
        if (!colorValue && !defaultColor) continue;
        const colorResolution = resolveColorFact(
          modelColorExpressions,
          call,
          colorName,
          colorValue ? property(call, colorName) : undefined,
          colorEvidenceInput,
          defaultColor?.id,
          call.source,
          colorValue ? undefined : defaultColor?.pin,
          'cell',
          `${colorName} is retained as a source expression; RGBA is not inferred`,
          defaultColor?.id ? `Color["${defaultColor.id}"]` : colorValue?.expression || `Color["${colorName}"]`,
          `${colorName} is a color-table expression and remains unavailable`,
        );
        operation.descriptorFacts[colorName] = colorResolution.fact;
        pendingFacts[colorName] = colorResolution.fact;
        if (colorResolution.gap) {
          colorDescriptorGap = true;
          addOperationGap(gaps, operation, colorResolution.gap.category, colorResolution.gap.status, colorResolution.gap.reason, colorResolution.gap.source, colorResolution.gap.expression, found.cell.id);
        }
      }
      const input: HelperCellSpecializationInput = {
        type,
        ...(height.value !== undefined && (heightValue !== undefined || type !== 'editbox') ? { height: height.value } : {}),
        ...(y.value !== undefined ? { y: y.value } : {}),
        ...(scaling.value !== undefined && (scalingValue !== undefined || type !== 'editbox') ? { scaling: scaling.value } : {}),
        ...(affect.value !== undefined ? { affectRowHeight: affect.value } : {}),
        ...(textHeightCandidate !== undefined ? { minTextHeight: textHeightCandidate } : {}),
        ...(type === 'button' && buttonHeight !== undefined ? { height: buttonHeight } : {}),
      };
      const before = found.table.kernelState;
      const result = specializeCell(before, found.row.rowIndex, found.cell.column, input);
      operation.kernel = stateResultTransition(result, before);
      if (result.status !== 'ok') {
        operation.status = 'rejected';
        operation.reason = result.message;
        found.cell.hadGap = true;
        found.cell.hadRefusal = true;
        markTableGap(found.table, true);
        const gap = kernelFailureGap(result, 'cell', call.source, operation.id, found.cell.id);
        if (gap) addGap(gaps, gap);
      } else {
        const descriptorGap = Boolean(
          x.gap || width.gap || content.gap || font.gap || fontSize.gap || halign.gap || wordwrap.gap
            || found.cell.missingHeight
            || (type === 'text' && minRowHeight.gap)
            || (type === 'editbox' && (defaultText.gap || description.gap || maxChars.gap || selectText.gap || active.gap))
            || (type === 'button' && active.gap)
            || colorDescriptorGap,
        );
        operation.status = descriptorGap ? 'unresolved' : 'applied';
        if (descriptorGap) operation.reason = 'cell kernel state is deterministic but one or more descriptor facts remain unavailable';
        found.table.kernelState = result.value;
        Object.assign(found.cell.descriptorFacts, pendingFacts);
        found.cell.explicitWidth = width.value;
        found.cell.explicitWidthFact = widthValue
          ? factFromResolution(widthValue, width, 'number', call.source, `${type} width`)
          : knownDefaultFact(0, 'number', call.source, HELPER_DEFAULT_PINS.widgetWidth, '0');
        found.cell.effectiveScaling = effectiveScaling;
        if (descriptorGap) {
          found.cell.hadGap = true;
          found.table.hadGap = true;
        }
      }
      continue;
    }

    if (call.name === 'setText' || call.name === 'setText2') {
      const found = findCell(call);
      const operation = makeOperation(call, blocked || 'unresolved');
      const deferredOwner = blocked === 'conditional'
        && found.table !== undefined
        && found.table.kernelState !== undefined
        && found.cell === undefined;
      setOperationLinks(operation, {
        tableId: found.table?.id,
        ...(deferredOwner ? {} : { rowId: found.row?.id, cellId: found.cell?.id }),
      });
      appendNodeOperation('table', found.table, operation.id);
      if (!deferredOwner) {
        appendNodeOperation('row', found.row, operation.id);
        appendNodeOperation('cell', found.cell, operation.id);
      }
      appendOperation(operation);
      if (deferredOwner) deferredConditionalCellOwners.push({ call, operation });
      if (blocked) {
        operation.reason = blocked === 'unreachable' ? 'unreachable source operation was recorded but not applied' : 'conditional or looped source operation was recorded but not applied';
        if (found.cell) found.cell.hadGap = true;
        markTableGap(found.table);
        continue;
      }
      if (!found.cell || !found.table) {
        operation.reason = 'text operation receiver is not an applied source cell identity';
        addOperationGap(gaps, operation, 'data-flow', 'unknown', operation.reason, call.source, cellReference(call)?.path, found.cell?.id);
        continue;
      }
      const contentKindFact = found.cell.descriptorFacts.contentKind;
      const cellKind = contentKindFact.status === 'known' && typeof contentKindFact.value === 'string'
        ? contentKindFact.value
        : undefined;
      const setterSupported = call.name === 'setText'
        ? cellKind === 'icon' || cellKind === 'button' || cellKind === 'editbox'
        : cellKind === 'icon' || cellKind === 'button';
      if (!setterSupported) {
        operation.reason = `${call.name} is not implemented by shipped ${cellKind || 'base'} cells`;
        addOperationGap(gaps, operation, 'data-flow', 'unsupported', operation.reason, call.source, cellReference(call)?.path, found.cell.id);
        found.cell.hadGap = true;
        found.table.hadGap = true;
        continue;
      }
      appendCellMetadataOperation(found.cell, operation.id);
      const mode = optionMode(call);
      if (mode === 'unresolved') {
        operation.reason = 'text options are dynamic or unknown; source defaults were not substituted';
        found.cell.hadGap = true;
        found.table.hadGap = true;
        addOperationGap(gaps, operation, 'options', 'dynamic', operation.reason, call.semantics.options?.location || call.source, call.semantics.options?.expression, found.cell.id);
        continue;
      }
      const textValue = call.semantics.text;
      const content = resolveProjectedString(textValue, 'text', `${call.name} content`, call.source);
      const fontValue = propertyValue(call, 'font');
      const fontSizeValue = propertyValue(call, 'fontsize');
      const halignValue = propertyValue(call, 'halign');
      const xValue = propertyValue(call, 'x');
      const yValue = propertyValue(call, 'y');
      const scalingValue = propertyValue(call, 'scaling');
      const setterPin = cellKind === 'icon'
        ? HELPER_DEFAULT_PINS.iconTextSetter
        : cellKind === 'button'
          ? HELPER_DEFAULT_PINS.buttonTextSetter
          : HELPER_DEFAULT_PINS.editBoxTextSetter;
      const font = fontValue
        ? resolveProjectedString(fontValue, 'text', `${call.name} font`, call.source)
        : { value: 'Zekton', source: cloneLocation(call.source), provenance: 'source-pinned-default' as const, sourcePin: HELPER_DEFAULT_PINS.standardFont };
      const fontSize = fontSizeValue
        ? resolveProjectedNumber(fontSizeValue, 'text', `${call.name} font size`, call.source, ['scaleFont'])
        : { value: 9, source: cloneLocation(call.source), provenance: 'source-pinned-default' as const, sourcePin: HELPER_DEFAULT_PINS.standardFontSize };
      const halign = halignValue
        ? resolveProjectedString(halignValue, 'text', `${call.name} alignment`, call.source)
        : { value: 'left', source: cloneLocation(call.source), provenance: 'source-pinned-default' as const, sourcePin: HELPER_DEFAULT_PINS.standardHalignment };
      const textX = xValue
        ? resolveProjectedNumber(xValue, 'text', `${call.name} x`, call.source, ['scaleX'])
        : { value: 5, source: cloneLocation(call.source), provenance: 'source-pinned-default' as const, sourcePin: HELPER_DEFAULT_PINS.textX };
      const textY = yValue
        ? resolveProjectedNumber(yValue, 'text', `${call.name} y`, call.source, ['scaleY'])
        : { value: 0, source: cloneLocation(call.source), provenance: 'source-pinned-default' as const, sourcePin: HELPER_DEFAULT_PINS.textY };
      const textScaling = scalingValue
        ? resolveProjectedBoolean(scalingValue, 'text', `${call.name} scaling`, call.source)
        : found.cell.effectiveScaling !== undefined
          ? {
            value: found.cell.effectiveScaling,
            source: cloneLocation(call.source),
            provenance: 'source-pinned-default' as const,
            sourcePin: setterPin,
          }
          : unresolved<boolean>(undefined, 'text', `${call.name} cannot inherit an unresolved owning-cell scaling value`, call.source);
      for (const resolution of [content, font, fontSize, halign, textX, textY, textScaling]) {
        appendGapForResolution(operation, resolution, found.cell.id);
      }
      const scaledTextX = textX.value !== undefined && textScaling.value !== undefined
        ? scaleX(textX.value, profileValue.metrics.uiScale, textScaling.value)
        : undefined;
      const scaledTextY = textY.value !== undefined && textScaling.value !== undefined
        ? scaleY(textY.value, profileValue.metrics.uiScale, textScaling.value)
        : undefined;
      const scaledTextFontSize = font.value !== undefined && fontSize.value !== undefined && textScaling.value !== undefined
        ? scaleFont(font.value, fontSize.value, profileValue.metrics.uiScale, textScaling.value)
        : undefined;
      const fieldPrefix = call.name === 'setText2' ? 'text2' : 'text';
      const unsupportedWordwrap = call.semantics.unsupportedProperties?.find(candidate => candidate.normalizedName === 'wordwrap');
      const facts: Record<string, X4UiLayoutDescriptorFact> = {
        [fieldPrefix]: factFromResolution(textValue, content, 'string', call.source, `${call.name} content`),
        [`${fieldPrefix}Font`]: fontValue
          ? factFromResolution(fontValue, font, 'string', call.source, `${call.name} font`)
          : knownDefaultFact('Zekton', 'string', call.source, HELPER_DEFAULT_PINS.standardFont, 'Helper.standardFont'),
        [`${fieldPrefix}Fontsize`]: fontSizeValue
          ? scaledTextFontSize?.status === 'ok'
            ? withKnownFactValue(factFromResolution(fontSizeValue, fontSize, 'number', call.source, `${call.name} font size`), scaledTextFontSize.value)
            : unavailableFact('number', `${call.name} font size requires exact effective text scaling`, fontSizeValue.location, fontSizeValue.expression)
          : scaledTextFontSize?.status === 'ok'
            ? knownDefaultFact(
              scaledTextFontSize.value,
              'number',
              call.source,
              HELPER_DEFAULT_PINS.standardFontSize,
              'Helper.scaleFont(Helper.standardFontSize)',
            )
            : unavailableFact('number', `${call.name} font size requires exact effective text scaling`, call.source, 'Helper.standardFontSize'),
        [`${fieldPrefix}Halign`]: halignValue
          ? factFromResolution(halignValue, halign, 'string', call.source, `${call.name} alignment`)
          : knownDefaultFact('left', 'string', call.source, HELPER_DEFAULT_PINS.standardHalignment, 'Helper.standardHalignment'),
        [`${fieldPrefix}Wordwrap`]: unavailableFact(
          'boolean',
          'shipped nested textproperty does not expose wordwrap',
          unsupportedWordwrap?.source || call.source,
          unsupportedWordwrap?.value.expression,
          setterPin,
        ),
        [`${fieldPrefix}X`]: xValue
          ? scaledTextX?.status === 'ok'
            ? withKnownFactValue(factFromResolution(xValue, textX, 'number', call.source, `${call.name} x`), scaledTextX.value)
            : unavailableFact('number', `${call.name} x requires exact effective text scaling`, xValue.location, xValue.expression)
          : scaledTextX?.status === 'ok'
            ? knownDefaultFact(scaledTextX.value, 'number', call.source, HELPER_DEFAULT_PINS.textX, 'Helper.scaleX(Helper.standardTextOffsetx)')
            : unavailableFact('number', `${call.name} x requires exact effective text scaling`, call.source, 'Helper.standardTextOffsetx'),
        [`${fieldPrefix}Y`]: yValue
          ? scaledTextY?.status === 'ok'
            ? withKnownFactValue(factFromResolution(yValue, textY, 'number', call.source, `${call.name} y`), scaledTextY.value)
            : unavailableFact('number', `${call.name} y requires exact effective text scaling`, yValue.location, yValue.expression)
          : scaledTextY?.status === 'ok'
            ? knownDefaultFact(scaledTextY.value, 'number', call.source, HELPER_DEFAULT_PINS.textY, 'Helper.scaleY(Helper.standardTextOffsety)')
            : unavailableFact('number', `${call.name} y requires exact effective text scaling`, call.source, 'Helper.standardTextOffsety'),
        [`${fieldPrefix}Scaling`]: scalingValue
          ? factFromResolution(scalingValue, textScaling, 'boolean', call.source, `${call.name} scaling`)
          : textScaling.value !== undefined
            ? knownDefaultFact(textScaling.value, 'boolean', call.source, setterPin, 'owning cell.properties.scaling')
            : factFromResolution(undefined, textScaling, 'boolean', call.source, `${call.name} inherited scaling`),
      };
      for (const [field, fact] of Object.entries(facts)) {
        operation.descriptorFacts[field] = fact;
        found.cell.descriptorFacts[field] = fact;
      }
      if (call.name === 'setText') {
        found.cell.descriptorFacts.primaryContent = facts.text;
        found.cell.descriptorFacts.font = facts.textFont;
        found.cell.descriptorFacts.fontsize = facts.textFontsize;
        found.cell.descriptorFacts.halign = facts.textHalign;
      }
      const colorValue = propertyValue(call, 'color');
      const colorResolution = colorValue || colorEvidenceInput
        ? resolveColorFact(
          modelColorExpressions,
          call,
          'color',
          colorValue ? property(call, 'color') : undefined,
          colorEvidenceInput,
          'text_normal',
          call.source,
          colorValue ? undefined : HELPER_DEFAULT_PINS.textPropertyColor,
          'text',
          'nested text color remains a source color-table expression',
          'Color["text_normal"]',
          'nested text color cannot be projected as RGBA',
        )
        : undefined;
      if (colorResolution) {
        operation.descriptorFacts.color = colorResolution.fact;
        found.cell.descriptorFacts.color = colorResolution.fact;
        if (colorResolution.gap) {
          addOperationGap(gaps, operation, colorResolution.gap.category, colorResolution.gap.status, colorResolution.gap.reason, colorResolution.gap.source, colorResolution.gap.expression, found.cell.id);
        }
      }
      for (const unsupported of call.semantics.unsupportedProperties || []) {
        addOperationGap(
          gaps,
          operation,
          'text',
          'unsupported',
          `${call.name} property ${unsupported.name} is not applied by shipped textproperty`,
          unsupported.source,
          unsupported.value.expression,
          found.cell.id,
        );
      }
      const hasGap = Boolean(
        content.gap || font.gap || fontSize.gap || halign.gap || textX.gap || textY.gap || textScaling.gap
          || colorResolution?.gap || (call.semantics.unsupportedProperties?.length || 0) > 0,
      );
      operation.status = hasGap ? 'unresolved' : 'applied';
      if (hasGap) {
        operation.reason = 'text metadata contains one or more unavailable descriptor facts';
        found.cell.hadGap = true;
        found.table.hadGap = true;
      }
      continue;
    }

    if (call.name === 'scaleX' || call.name === 'scaleY' || call.name === 'scaleFont') {
      const operation = makeOperation(call, blocked || 'unresolved');
      appendOperation(operation);
      if (blocked) {
        operation.reason = blocked === 'unreachable' ? 'unreachable source operation was recorded but not applied' : 'conditional or looped source operation was recorded but not applied';
        addOperationGap(gaps, operation, 'scale', 'incomplete', operation.reason, call.source, undefined);
        continue;
      }
      if (!isHelperReceiver(call) || call.semantics.dataFlow) {
        operation.reason = 'scale call is not a direct source-matched Helper call';
        addOperationGap(gaps, operation, 'data-flow', 'unknown', operation.reason, call.source, call.receiver?.expression);
        continue;
      }
      const scale = call.semantics.scale;
      const sourceArguments: X4UiSourceLocation[] = [];
      let hasGap = false;
      let scaleResult: LayoutResult<number> | undefined;
      if (call.name === 'scaleFont') {
        const font = resolveString(scale?.fontname, 'scale', 'scaleFont font name', call.source);
        const fontSize = resolveNumber(
          scale?.fontsize,
          profileValue,
          'scale',
          'scaleFont font size',
          call.source,
          undefined,
          undefined,
          undefined,
          ['scaleX', 'scaleY'],
          call.expansionInstance?.ancestry.join('>') || '',
          model,
        );
        const enabled = scale?.enabled ? resolveBoolean(scale.enabled, 'scale', 'scaleFont enabled', call.source) : { value: undefined };
        for (const resolution of [font, fontSize, enabled]) {
          appendGapForResolution(operation, resolution, undefined);
          if (resolution.gap) hasGap = true;
          if (resolution.source) sourceArguments.push(resolution.source);
        }
        if (font.value === undefined || fontSize.value === undefined || font.gap || fontSize.gap || enabled.gap) hasGap = true;
        if (!hasGap) scaleResult = scaleFont(font.value, fontSize.value, profileValue.metrics.uiScale, enabled.value);
      } else {
        const input = resolveNumber(
          scale?.input,
          profileValue,
          'scale',
          `${call.name} input`,
          call.source,
          undefined,
          undefined,
          undefined,
          ['scaleX', 'scaleY'],
          call.expansionInstance?.ancestry.join('>') || '',
          model,
        );
        const enabled = scale?.enabled ? resolveBoolean(scale.enabled, 'scale', `${call.name} enabled`, call.source) : { value: undefined };
        for (const resolution of [input, enabled]) {
          appendGapForResolution(operation, resolution, undefined);
          if (resolution.gap) hasGap = true;
          if (resolution.source) sourceArguments.push(resolution.source);
        }
        if (input.value === undefined || input.gap || enabled.gap) hasGap = true;
        if (!hasGap) {
          scaleResult = call.name === 'scaleX'
            ? scaleX(input.value, profileValue.metrics.uiScale, enabled.value)
            : scaleY(input.value, profileValue.metrics.uiScale, enabled.value);
        }
      }
      if (hasGap) {
        operation.reason = 'direct Helper scale arguments are not completely static';
        continue;
      }
      const result = scaleResult!;
      if (result.status !== 'ok') {
        operation.status = 'rejected';
        operation.reason = result.message;
        const gap = kernelFailureGap(result, 'scale', call.source, operation.id);
        if (gap) addGap(gaps, gap);
      } else {
        operation.status = 'applied';
        operation.scale = { status: 'resolved', value: result.value, sourceArguments };
        operation.descriptorFacts.result = knownSourceFact(
          result.value,
          'number',
          call.source,
          call.name,
          'direct-helper-scale',
        );
      }
      continue;
    }

    if (call.name === 'display') {
      const operation = makeOperation(call, blocked || 'unresolved');
      const frameReferenceValue = frameReference(call);
      const frame = frameReferenceValue ? frameByReference.get(referenceKey(frameReferenceValue) || '') : undefined;
      setOperationLinks(operation, { frameId: frame?.id });
      appendNodeOperation('frame', frame, operation.id);
      appendOperation(operation);
      if (blocked) {
        operation.reason = blocked === 'unreachable' ? 'unreachable source operation was recorded but not applied' : 'conditional or looped source operation was recorded but not applied';
        if (frame) frame.hadGap = true;
      } else if (frame) {
        operation.status = 'applied';
        displayedFrameIds.add(frame.id);
      } else {
        operation.reason = 'display receiver is not an applied frame identity';
        addOperationGap(gaps, operation, 'data-flow', 'unknown', operation.reason, call.source, frameReferenceValue?.path);
      }
      continue;
    }

    if (call.name === 'OpenMenu') {
      const operation = makeOperation(call, blocked || 'unresolved');
      appendOperation(operation);
      if (blocked) {
        operation.reason = blocked === 'unreachable' ? 'unreachable source operation was recorded but not applied' : 'conditional or looped source operation was recorded but not applied';
        addOperationGap(gaps, operation, 'menu', 'incomplete', operation.reason, call.source, call.semantics.menu?.expression);
      } else if (call.semantics.dataFlow || call.semantics.menu?.status !== 'static') {
        operation.reason = 'OpenMenu menu identity is not statically complete';
        addOperationGap(gaps, operation, 'menu', valueStatus(call.semantics.menu), operation.reason, call.semantics.menu?.location || call.source, call.semantics.menu?.expression);
      } else {
        operation.status = 'applied';
      }
    }
  }

  for (const deferred of deferredConditionalCellOwners) {
    const found = findCell(deferred.call);
    if (!found.table || found.table.id !== deferred.operation.tableId) continue;
    const hadRowOwner = deferred.operation.rowId !== undefined;
    const hadCellOwner = deferred.operation.cellId !== undefined;
    setOperationLinks(deferred.operation, {
      tableId: found.table.id,
      ...(found.row ? { rowId: found.row.id } : {}),
      ...(found.cell ? { cellId: found.cell.id } : {}),
    });
    if (found.row && !hadRowOwner) appendNodeOperation('row', found.row, deferred.operation.id);
    if (found.cell && !hadCellOwner) appendNodeOperation('cell', found.cell, deferred.operation.id);
  }

  for (const table of tables) {
    if (!table.kernelState) continue;
    const finalReserveScrollBar = table.kernelState.properties.reserveScrollBar;
    if (typeof finalReserveScrollBar === 'boolean') {
      table.descriptorFacts.reserveScrollBar = knownDefaultFact(
        finalReserveScrollBar,
        'boolean',
        table.source,
        HELPER_DEFAULT_PINS.tableReserveScrollBar,
        'Helper.finalizeTableColumnWidths(self).properties.reserveScrollBar',
      );
    }
    for (const row of rows.filter(candidate => candidate.tableId === table.id && candidate.rowIndex !== undefined)) {
      const rowIndex = row.rowIndex!;
      const rowState = table.kernelState.rows[rowIndex - 1];
      if (!rowState) continue;
      row.kernelState = rowState;
      const height = getRowHeight(table.kernelState, rowIndex);
      if (height.status === 'ok') row.height = { status: 'known', value: height.value };
      else {
        row.height = { status: 'unavailable', refusal: height };
        row.hadGap = true;
        table.hadGap = true;
        const sourceCell = cells.find(cell => {
          if (cell.rowId !== row.id) return false;
          const finalCell = table.kernelState?.rows[rowIndex - 1]?.cells[cell.column - 1];
          return finalCell?.type === 'text' && finalCell.height === 0 && finalCell.minTextHeight === undefined;
        });
        addGap(gaps, {
          category: 'height',
          status: 'unsupported',
          reason: sourceCell
            ? 'zero-height text final height remains unavailable without both a supplied/proven C++ text-height candidate and an exact Helper minRowHeight floor'
            : height.message,
          source: cloneLocation(sourceCell?.source || row.source),
         nodeId: sourceCell?.id || row.id,
        });
      }
    }
    const fullHeight = getFullTableHeight(table.kernelState);
    if (fullHeight.status === 'ok' && !cells.some(cell => cell.tableId === table.id && cell.missingHeight)) {
      table.height = { status: 'known', value: fullHeight.value };
    }
    else if (fullHeight.status !== 'ok') {
      table.height = { status: 'unavailable', refusal: fullHeight };
      table.hadGap = true;
      addGap(gaps, {
        category: 'height',
        status: 'unsupported',
        reason: fullHeight.message,
        source: cloneLocation(table.source),
        nodeId: table.id,
      });
    } else table.height = { status: 'unavailable' };
    for (const cell of cells.filter(candidate => candidate.tableId === table.id && candidate.rowIndex !== undefined)) {
      const rowIndex = cell.rowIndex!;
      const cellState = table.kernelState.rows[rowIndex - 1]?.cells[cell.column - 1];
      if (!cellState) continue;
      cell.kernelState = cellState;
      const priorKind = cell.descriptorFacts.contentKind;
      cell.descriptorFacts.contentKind = priorKind.status === 'known' && priorKind.expectedType === 'string'
        ? { ...priorKind, value: cellState.type }
        : knownSourceFact(cellState.type, 'string', cell.source, cellState.type, 'source-pinned-default');
      const priorSpan = cell.descriptorFacts.span;
      cell.descriptorFacts.span = priorSpan.status === 'known' && priorSpan.expectedType === 'number'
        ? { ...priorSpan, value: cellState.colspan }
        : knownSourceFact(cellState.colspan, 'number', cell.source, String(cellState.colspan), 'source-pinned-default');
      const priorScaling = cell.descriptorFacts.scaling;
      cell.descriptorFacts.scaling = priorScaling.status === 'known' && priorScaling.expectedType === 'boolean'
        ? { ...priorScaling, value: cellState.scaling }
        : knownDefaultFact(cellState.scaling, 'boolean', cell.source, HELPER_DEFAULT_PINS.cellSpecialization, 'row.properties.scaling');
      if (cellState.type === 'editbox') {
        const priorHotkey = cell.descriptorFacts.hotkey;
        cell.descriptorFacts.hotkey = priorHotkey?.status === 'known' && priorHotkey.expectedType === 'string'
          ? { ...priorHotkey, value: cellState.hotkey }
          : knownDefaultFact(cellState.hotkey, 'string', cell.source, HELPER_DEFAULT_PINS.editBoxHotkeyDefaults, 'editbox.properties.hotkey');
        const priorDisplayIcon = cell.descriptorFacts.displayIcon;
        cell.descriptorFacts.displayIcon = priorDisplayIcon?.status === 'known' && priorDisplayIcon.expectedType === 'boolean'
          ? { ...priorDisplayIcon, value: cellState.displayIcon }
          : knownDefaultFact(cellState.displayIcon, 'boolean', cell.source, HELPER_DEFAULT_PINS.editBoxHotkeyDefaults, 'editbox.properties.hotkey.displayIcon');
      }
      if (cell.descriptorFacts.affectRowHeight.status === 'unavailable') {
        cell.descriptorFacts.affectRowHeight = knownDefaultFact(
          cellState.affectRowHeight,
          'boolean',
          cell.source,
          HELPER_DEFAULT_PINS.cellSpecialization,
          'specialized cell affectRowHeight default',
        );
      }
      const height = getRowHeight(table.kernelState, rowIndex);
      const cellHeight = getCellHeight(table.kernelState, rowIndex, cell.column);
      const descriptorHeight = cellState.type === 'icon' || cellState.type === 'button'
        ? scaleY(cellState.height, table.kernelState.metrics.uiScale, cellState.scaling)
        : cellHeight;
      if (cell.missingHeight || (cellState.type === 'text' && cellState.height === 0 && cellState.minTextHeight === undefined)) {
        cell.height = { status: 'unavailable' };
        cell.descriptorFacts.outerHeight = unavailableFact(
          'number',
          cellState.type === 'text'
            ? 'zero-height text final height requires both a supplied/proven C++ text-height candidate and the exact Helper minRowHeight floor'
            : 'cell height lacks a source-pinned default',
          cell.source,
        );
      } else if (cellHeight.status === 'ok' && height.status === 'ok') {
        cell.height = { status: 'known', value: cellHeight.value };
        const priorHeight = cell.descriptorFacts.outerHeight;
        cell.descriptorFacts.outerHeight = descriptorHeight.status === 'ok'
          ? priorHeight.status === 'known'
            && priorHeight.expectedType === 'number'
            ? { ...priorHeight, value: descriptorHeight.value }
            : knownSourceFact(descriptorHeight.value, 'number', cell.source, 'Helper cell:getHeight(true)', 'source-pinned-default')
          : unavailableFact('number', descriptorHeight.message, cell.source);
      }
      const span = getColSpanWidth(table.kernelState, rowIndex, cell.column);
      cell.spanWidth = span.status === 'ok'
        ? { status: 'known', value: span.value }
        : { status: 'unavailable', refusal: span };
      if (span.status === 'ok') {
        const outerX = cell.descriptorFacts.outerX.status === 'known' && typeof cell.descriptorFacts.outerX.value === 'number'
          ? cell.descriptorFacts.outerX.value
          : undefined;
        if (cell.explicitWidth !== undefined && cell.explicitWidth !== 0) {
          const explicitWidth = scaleX(cell.explicitWidth, table.kernelState.metrics.uiScale, cell.effectiveScaling ?? cellState.scaling);
          cell.descriptorFacts.outerWidth = explicitWidth.status === 'ok'
            ? cell.explicitWidthFact?.status === 'known'
              && cell.explicitWidthFact.expectedType === 'number'
              ? { ...cell.explicitWidthFact, value: explicitWidth.value }
              : knownSourceFact(explicitWidth.value, 'number', cell.source, 'Helper cell:getWidth()', 'source-pinned-default')
            : unavailableFact('number', explicitWidth.message, cell.source);
        } else if (outerX !== undefined) {
          const width = span.value - outerX;
          cell.descriptorFacts.outerWidth = knownDefaultFact(
            width,
            'number',
            cell.source,
            helperPin(5372, 5388),
            'cell:getColSpanWidth() - scaled x',
          );
        }
      } else {
        cell.descriptorFacts.outerWidth = unavailableFact('number', span.message, cell.source);
      }
    }
  }

  if (consumedSamples.size > 0) {
    // Boolean/string model gaps do not encode their expected type. Remove only
    // exact ranges proven consumed, irrespective of the call-model gap category.
    const consumedRanges = new Set(previewSamples.ordered
      .filter(sample => consumedSamples.has(sample.entry.id))
      .map(sample => locationKey(sample.entry.source)));
    gaps = gaps.filter((gap, index) => index >= modelGapCount || !consumedRanges.has(locationKey(gap.source)));
    gapEvents.splice(0, gapEvents.length, ...gapEvents
      .filter((gap, index) => index >= modelGapCount || !consumedRanges.has(locationKey(gap.source))));
  }
  for (const sample of previewSamples.ordered) {
    if (consumedSamples.has(sample.entry.id)) continue;
    addGap(gaps, {
      category: 'sample',
      status: 'incomplete',
      reason: 'valid preview sample was not applied because its owner/control-flow context was not applied',
      expression: sample.entry.expression,
      source: sample.entry.source,
    });
  }

  let localExpansionState: X4UiLayoutLocalExpansionState | undefined;
  if (localExpansionPlan && profileValue.localExpansion) {
    for (const invocation of localExpansionPlan.invocations) {
      invocation.operationIds = operationEvents
        .filter(event => event.operation.localExpansion?.invocationId === invocation.id)
        .map(event => event.operation.id);
    }
    const expansionSourceInvocationIds = new Set(
      localExpansionPlan.invocations.map(invocation => invocation.sourceInvocationId),
    );
    const reciprocalPreviewPathCatalog: X4UiLayoutPreviewPathCatalog = {
      ...previewPathCatalog,
      // The pre-expansion catalog describes every statically discoverable branch
      // below a declaration.  The emitted ledger is deliberately narrower when
      // a branch, rejection, or expansion limit prevents descending into that
      // declaration.  Emit only the catalog edges proven by this exact ledger.
      entries: previewPathCatalog.entries
        .map(entry => ({
          ...entry,
          invocationIds: entry.invocationIds.filter(id => expansionSourceInvocationIds.has(id)),
        }))
        .filter(entry => entry.invocationIds.length > 0),
    };
    localExpansionState = {
      limits: cloneDeep(profileValue.localExpansion) as NonNullable<X4UiLayoutProjectionProfile['localExpansion']>,
      invocations: localExpansionPlan.invocations.map(invocation => cloneDeep(invocation) as X4UiLayoutLocalInvocation),
      previewPathCatalog: cloneDeep(reciprocalPreviewPathCatalog) as X4UiLayoutPreviewPathCatalog,
      previewPathSelections: normalizedPaths.value.ordered.map(selection =>
        cloneDeep(selection) as X4UiLayoutPreviewPathSelectionBinding)
    };
  }

  const operationOrder = new Map(operations.map((operation, index) => [operation.id, index] as const));
  const orderedOperationIds = (operationIds: string[]): void => {
    operationIds.sort((left, right) =>
      (operationOrder.get(left) ?? Number.MAX_SAFE_INTEGER)
      - (operationOrder.get(right) ?? Number.MAX_SAFE_INTEGER));
  };
  for (const frame of frames) orderedOperationIds(frame.operationIds);
  for (const frame of frames) {
    for (const layer of frame.frameTextureLayers) orderedOperationIds(layer.operationIds);
  }
  for (const table of tables) orderedOperationIds(table.operationIds);
  for (const row of rows) orderedOperationIds(row.operationIds);
  for (const cell of cells) {
    orderedOperationIds(cell.operationIds);
    orderedOperationIds(cell.metadataOperationIds);
  }

  const status = resultStatus(tables, frames, operations, gaps);
  return finishProgram(status, target, profileValue, {
    ...analysis,
    callModelGaps: model.verificationGaps.length,
    incomplete: analysis.incomplete || gaps.length > 0,
    staticSource: analysis.incomplete || gaps.length > 0 ? 'incomplete' : 'complete',
  }, frames, tables, rows, cells, operations, gaps, sampleCatalog, previewSamples, consumedSamples, model,
  targetCalls, operationEvents, nodeLedgerEvents, gapEvents, localExpansionState, colorEvidenceInput);
}

/** Alias matching the construction language used by the surrounding modules. */
export const buildX4UiLayoutProgram = projectX4UiLayoutProgram;
