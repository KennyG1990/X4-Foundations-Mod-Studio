/**
 * Pure Batch 6B orchestration for the already-materialized X4 UI source,
 * configured corpus evidence, and accepted preview owners.
 *
 * This module deliberately owns no source loading, parsing, persistence, UI,
 * or game integration.  It only selects an exact source/target and wires the
 * existing source bundle, call model, linter, layout program, and Scene.
 */

import {
  NOT_VERIFIED_IN_GAME,
  type X4UiWorkspaceSource,
  type X4UiWorkspaceSourceRecord,
} from './x4UiWorkspaceSource';
import {
  isX4UiCorpusCanonicalSuccess,
  type X4UiCorpusCanonicalSuccess,
  type X4UiCorpusCanonicalColorSuccess,
} from './x4UiCorpusAssets';
import {
  X4_LAYOUT_PROVENANCE,
} from './x4UiLayoutKernel';
import {
  createX4UiLayoutTargetCatalog,
  projectX4UiLayoutProgram,
  type X4UiLayoutModelIdentity,
  type X4UiLayoutPreviewPathSelectionInput,
  type X4UiLayoutPreviewSampleInput,
  type X4UiLayoutProjectionProfile,
  type X4UiLayoutProgramResult,
  type X4UiLayoutTarget,
  type X4UiLayoutTargetSelector,
  type X4UiLayoutTruthGrade,
} from './x4UiLayoutProgram';
import {
  projectX4UiScene,
  type X4UiScene,
  type X4UiSceneProfile,
  type X4UiSceneResult,
  type X4UiSceneTableViewState,
} from './x4UiScene';
import {
  lintX4UiCallModel,
  type X4UiLintResult,
} from './x4UiLint';
import {
  ZEKTON_EVIDENCE_STATE,
} from './x4UiFontMetrics';
import {
  ZEKTON_TEXT_TRUTH_GRADE,
  type ZektonNewlinePolicy,
  type ZektonTextTruthGrade,
  type ZektonTruncationMode,
  type ZektonWrapMode,
} from './x4UiTextLayout';

export const X4_UI_PREVIEW_PIPELINE_VERSION = 1 as const;
export const X4_UI_PREVIEW_GAME_TRUTH = NOT_VERIFIED_IN_GAME;

const HELPER_STANDARD_TEXT_HEIGHT = 16;
const HELPER_STANDARD_BUTTON_HEIGHT = 25;
const HELPER_STANDARD_TEXT_HEIGHT_LINE = 533;
const HELPER_STANDARD_BUTTON_HEIGHT_LINE = 522;
const HELPER_VIEW_WIDTH_LINE = 707;
const HELPER_VIEW_HEIGHT_LINE = 708;
const HELPER_BORDER_LINE = 709;
const WIDGET_SCALE_LINE_START = 8725;
const WIDGET_SCALE_LINE_END = 8726;
const WIDGET_TABLE_GEOMETRY_LINE_START = 8702;
const WIDGET_TABLE_GEOMETRY_LINE_END = 8708;
const WIDGET_SCROLLBAR_LINE_START = 867;
const WIDGET_SCROLLBAR_LINE_END = 868;

type JsonRecord = Record<string, unknown>;

interface X4UiPreviewPaintAuthorityRecord {
  readonly issuedSceneResult: X4UiSceneResult;
  readonly issuedScene: X4UiScene;
  readonly materializedScene: X4UiScene;
}

const issuedPreviewPaintAuthorities = new WeakMap<object, X4UiPreviewPaintAuthorityRecord>();

export interface X4UiPreviewProfileInput {
  readonly id: string;
  readonly provenance: string;
  readonly truthGrade: X4UiLayoutTruthGrade;
  readonly source: X4UiLayoutModelIdentity;
  readonly drawable: {
    readonly width: number;
    readonly height: number;
  };
  readonly uiScale: number;
  /** Caller-supplied/proven C++ GetTextHeight evidence. */
  readonly minTextHeight?: number;
  readonly localExpansion?: NonNullable<X4UiLayoutProjectionProfile['localExpansion']>;
}

export interface X4UiPreviewTextPolicyInput {
  readonly nominalDesignSize?: 32;
  readonly lineSpacing?: number;
  readonly wrapMode?: ZektonWrapMode;
  readonly truncationMode?: ZektonTruncationMode;
  readonly whitespaceMode?: 'preserve' | 'trim-at-wrap';
  readonly breakOn?: 'ascii-space' | 'unicode-space';
  readonly ellipsisToken?: string;
  readonly newlinePolicy?: ZektonNewlinePolicy;
  readonly truthGrade?: ZektonTextTruthGrade;
}

/**
 * Shipped widget_fullscreen.lua delegates no-wrap truncation to TruncateText;
 * the native visible token is three ASCII periods.
 */
export const X4_UI_DEFAULT_ELLIPSIS_TOKEN = '...' as const;

export interface X4UiPreviewSelection {
  readonly sourceIndex: number;
  readonly path: string;
  readonly sourceIdentity: X4UiLayoutModelIdentity;
  readonly target: X4UiLayoutTargetSelector & { readonly id: string };
}

export interface X4UiPreviewPipelineInput {
  readonly source: X4UiWorkspaceSource;
  /** A loader-issued canonical result is required for Scene geometry. */
  readonly corpus: unknown;
  /** Exact loader-issued P2 canonical-default color authority; never discovered here. */
  readonly colorEvidence?: X4UiCorpusCanonicalColorSuccess;
  readonly profile: X4UiPreviewProfileInput;
  readonly selection?: X4UiPreviewSelection;
  readonly samples?: X4UiLayoutPreviewSampleInput;
  readonly paths?: X4UiLayoutPreviewPathSelectionInput;
  readonly tableView?: Readonly<Record<string, X4UiSceneTableViewState>>;
  readonly textPolicy?: X4UiPreviewTextPolicyInput;
}

export interface X4UiPreviewScaleEvidence {
  readonly source: {
    readonly sourcePath: typeof X4_LAYOUT_PROVENANCE.widgetSourcePath;
    readonly lineStart: number;
    readonly lineEnd: number;
  };
  readonly input: number;
  readonly minimum: number;
  readonly uiScale: number;
  readonly value: number;
}

export interface X4UiPreviewWidgetPortEvidence {
  readonly scaleSizeMinValue: X4UiPreviewScaleEvidence;
  readonly tableBorder: X4UiPreviewScaleEvidence;
  readonly standardContainerOffset: X4UiPreviewScaleEvidence;
  readonly scrollbarWidth: {
    readonly first: X4UiPreviewScaleEvidence;
    readonly second: X4UiPreviewScaleEvidence;
    readonly value: number;
    readonly source: {
      readonly sourcePath: typeof X4_LAYOUT_PROVENANCE.widgetSourcePath;
      readonly lineStart: number;
      readonly lineEnd: number;
    };
  };
}

export interface X4UiPreviewSourceCandidate {
  readonly index: number;
  readonly path: string;
  readonly rawPath?: string;
  readonly lookupKey?: string;
  readonly sourcePath?: string;
  readonly sourceIdentity?: X4UiLayoutModelIdentity;
  readonly registered: boolean;
  readonly unregistered: boolean;
  readonly editable: boolean;
  readonly parseStatus?: string;
  readonly verificationStatus?: string;
  readonly targetCount: number;
  readonly targets: readonly X4UiLayoutTarget[];
  readonly catalogError?: string;
}

export interface X4UiPreviewLintFile {
  readonly index: number;
  readonly path: string;
  readonly rawPath?: string;
  readonly lookupKey?: string;
  readonly sourcePath?: string;
  readonly registered: boolean;
  readonly unregistered: boolean;
  readonly editable: boolean;
  readonly parseStatus: string;
  readonly verificationStatus: string;
  readonly registrationIndexes: readonly number[];
  readonly diagnostics: readonly unknown[];
  readonly verificationGaps: readonly unknown[];
  readonly lint?: X4UiLintResult;
  readonly lintError?: string;
}

export interface X4UiPreviewCorpusSummary {
  readonly status: 'canonical' | 'synthetic' | 'stale' | 'unavailable';
  readonly available: boolean;
  readonly canonical: boolean;
  readonly evidenceKind?: string;
  readonly canonicalIdentity?: string;
  readonly statusIdentity?: unknown;
  readonly helperSourceHash?: string;
  readonly widgetSourceHash?: string;
  readonly fonts?: {
    readonly regular: { readonly descriptor: unknown; readonly atlas: unknown };
    readonly bold: { readonly descriptor: unknown; readonly atlas: unknown };
  };
  readonly verification: typeof NOT_VERIFIED_IN_GAME;
  readonly reason?: string;
}

export interface X4UiPreviewSourceSummary {
  readonly status: X4UiWorkspaceSource['status'];
  readonly availability: X4UiWorkspaceSource['availability'];
  readonly available: boolean;
  readonly locked: boolean;
  readonly editable: boolean;
  readonly shippable: boolean;
  readonly reason: X4UiWorkspaceSource['reason'];
  readonly reasons: readonly X4UiWorkspaceSource['reasons'][number][];
  readonly detail: string;
  readonly verification: typeof NOT_VERIFIED_IN_GAME;
  readonly rootFile: X4UiWorkspaceSourceRecord | null;
  readonly rootCandidates: readonly X4UiWorkspaceSourceRecord[];
  readonly luaFiles: readonly X4UiWorkspaceSourceRecord[];
  readonly registeredLuaFiles: readonly X4UiWorkspaceSourceRecord[];
  readonly bundle: {
    readonly locked: boolean;
    readonly hasUnverifiedCallModelGaps: boolean;
    readonly diagnostics: readonly unknown[];
  } | null;
  readonly compile: unknown;
  readonly cas: unknown;
}

export type X4UiPreviewSelectionStatus = 'selected' | 'needs-selection' | 'unavailable';

export interface X4UiPreviewSelectionState {
  readonly status: X4UiPreviewSelectionStatus;
  readonly reason: string;
  readonly sourceIndex?: number;
  readonly targetId?: string;
}

export interface X4UiPreviewPipelineResult {
  readonly version: typeof X4_UI_PREVIEW_PIPELINE_VERSION;
  readonly status: 'projected' | 'partial' | 'refused' | 'needs-selection';
  readonly gameTruth: typeof NOT_VERIFIED_IN_GAME;
  readonly source: X4UiPreviewSourceSummary;
  readonly corpus: X4UiPreviewCorpusSummary;
  readonly sourceCandidates: readonly X4UiPreviewSourceCandidate[];
  readonly targetCandidates: readonly X4UiLayoutTarget[];
  readonly selection: X4UiPreviewSelectionState;
  readonly selectedSource?: X4UiPreviewSourceCandidate;
  readonly selectedTarget?: X4UiLayoutTarget;
  readonly profile: {
    readonly layout?: X4UiLayoutProjectionProfile;
    readonly scene?: X4UiSceneProfile;
    /** Absent when caller input is malformed before profile normalization. */
    readonly widgetPort?: X4UiPreviewWidgetPortEvidence;
    readonly tableView?: Readonly<Record<string, X4UiSceneTableViewState>>;
    readonly minTextHeight?: {
      readonly value: number;
      readonly truthGrade: X4UiLayoutTruthGrade;
    };
  };
  readonly lint: readonly X4UiPreviewLintFile[];
  readonly program?: X4UiLayoutProgramResult;
  readonly scene?: X4UiSceneResult;
  readonly gaps: readonly {
    readonly stage: 'source' | 'corpus' | 'selection' | 'lint' | 'program' | 'scene';
    readonly reason: string;
  }[];
  readonly authority: {
    readonly editable: boolean;
    readonly shippable: boolean;
    readonly sourceStatus: X4UiWorkspaceSource['status'];
    readonly verification: typeof NOT_VERIFIED_IN_GAME;
  };
  readonly verification: {
    readonly game: typeof NOT_VERIFIED_IN_GAME;
    readonly gameVerified: false;
  };
}

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const ownDataPropertyValue = (value: object, key: string): unknown => {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor !== undefined && Object.prototype.hasOwnProperty.call(descriptor, 'value')
      ? descriptor.value
      : undefined;
  } catch {
    return undefined;
  }
};

const cloneJson = (value: unknown, active = new Set<object>()): unknown => {
  if (value === null || typeof value !== 'object') return value;
  if (active.has(value)) throw new Error('preview input contains a cycle');
  active.add(value);
  try {
    if (Array.isArray(value)) return Array.from(value, child => child === undefined ? null : cloneJson(child, active));
    const result: JsonRecord = {};
    for (const [key, child] of Object.entries(value)) {
      if (child !== undefined) result[key] = cloneJson(child, active);
    }
    return result;
  } finally {
    active.delete(value);
  }
};

const freezeDeep = <T>(value: T, seen = new WeakSet<object>()): T => {
  if (value === null || typeof value !== 'object') return value;
  const objectValue = value as unknown as object;
  if (seen.has(objectValue)) return value;
  seen.add(objectValue);
  for (const child of Object.values(value as unknown as JsonRecord)) freezeDeep(child, seen);
  return Object.freeze(value);
};

const sameJson = (left: unknown, right: unknown): boolean => {
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return false;
  }
};

const AUTHORITY_SCENE_REQUIRED_ROOT_KEYS = [
  'format',
  'version',
  'status',
  'gameTruth',
  'profile',
  'programStatus',
  'drawableRect',
  'frames',
  'tables',
  'rows',
  'cells',
  'widgets',
  'texts',
  'glyphs',
  'gaps',
  'preview',
  'diagnosticStyle',
  'verification',
] as const;

const hasOwn = (value: object, key: string): boolean => Object.prototype.hasOwnProperty.call(value, key);

const strictAuthorityClone = (
  value: unknown,
  active = new Set<object>(),
): unknown => {
  if (value === undefined) throw new TypeError('preview paint authority contains undefined');
  if (value === null) return null;
  if (typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('preview paint authority contains a non-JSON number');
    return value;
  }
  if (typeof value !== 'object') throw new TypeError('preview paint authority contains a non-JSON value');
  if (active.has(value)) throw new TypeError('preview paint authority contains a cycle');
  active.add(value);
  try {
    if (Array.isArray(value)) {
      if (Object.getPrototypeOf(value) !== Array.prototype || Object.getOwnPropertySymbols(value).length !== 0) {
        throw new TypeError('preview paint authority contains a malformed array');
      }
      const propertyNames = Object.getOwnPropertyNames(value);
      const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
      if (lengthDescriptor === undefined
        || !Object.prototype.hasOwnProperty.call(lengthDescriptor, 'value')
        || lengthDescriptor.value !== value.length
        || lengthDescriptor.enumerable
        || propertyNames.length !== value.length + 1
        || !propertyNames.every(name => name === 'length' || /^(0|[1-9][0-9]*)$/.test(name) && Number(name) < value.length)) {
        throw new TypeError('preview paint authority contains a sparse or decorated array');
      }
      const result: unknown[] = [];
      for (let index = 0; index < value.length; index += 1) {
        const key = String(index);
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (descriptor === undefined
          || !descriptor.enumerable
          || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
          throw new TypeError('preview paint authority contains a sparse or accessor array member');
        }
        result.push(strictAuthorityClone(descriptor.value, active));
      }
      return result;
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null || Object.getOwnPropertySymbols(value).length !== 0) {
      throw new TypeError('preview paint authority contains a non-JSON object');
    }
    const propertyNames = Object.getOwnPropertyNames(value);
    const enumerableNames = Object.keys(value);
    if (propertyNames.length !== enumerableNames.length || propertyNames.some(name => !enumerableNames.includes(name))) {
      throw new TypeError('preview paint authority contains a non-enumerable object member');
    }
    const result: JsonRecord = Object.create(null) as JsonRecord;
    for (const key of enumerableNames) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined
        || !descriptor.enumerable
        || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
        throw new TypeError('preview paint authority contains an accessor object member');
      }
      if (descriptor.value === undefined) continue;
      result[key] = strictAuthorityClone(descriptor.value, active);
    }
    return result;
  } finally {
    active.delete(value);
  }
};

const authoritySceneDataFor = (scene: unknown): {
  readonly status: string;
  readonly materialized: X4UiScene;
} => {
  const materializedRecord = strictAuthorityClone(scene) as JsonRecord;
  if (!isRecord(materializedRecord)
    || !AUTHORITY_SCENE_REQUIRED_ROOT_KEYS.every(key => hasOwn(materializedRecord, key))
    || (materializedRecord.status !== 'projected' && materializedRecord.status !== 'partial')
    || materializedRecord.gameTruth !== NOT_VERIFIED_IN_GAME
    || !isRecord(materializedRecord.profile)
    || !Array.isArray(materializedRecord.frames)
    || !Array.isArray(materializedRecord.tables)
    || !Array.isArray(materializedRecord.rows)
    || !Array.isArray(materializedRecord.cells)
    || !Array.isArray(materializedRecord.widgets)
    || !Array.isArray(materializedRecord.texts)
    || !Array.isArray(materializedRecord.glyphs)
    || !Array.isArray(materializedRecord.gaps)
    || !isRecord(materializedRecord.preview)
    || !isRecord(materializedRecord.verification)
    || materializedRecord.verification.game !== NOT_VERIFIED_IN_GAME
    || materializedRecord.verification.gameVerified !== false) {
    throw new TypeError('preview paint authority Scene root is malformed');
  }
  const status = materializedRecord.status;
  return {
    status,
    materialized: freezeDeep(materializedRecord as unknown as X4UiScene),
  };
};

const issuePreviewPaintAuthority = (result: X4UiPreviewPipelineResult): void => {
  if ((result.status !== 'projected' && result.status !== 'partial') || result.scene === undefined || result.scene.status === 'refused') throw new Error('preview paint authority requires a successful Scene result');
  const issuedSceneResult = result.scene;
  const issuedScene = issuedSceneResult.scene;
  const scene = authoritySceneDataFor(issuedScene);
  issuedPreviewPaintAuthorities.set(result as unknown as object, freezeDeep({
    issuedSceneResult,
    issuedScene,
    materializedScene: scene.materialized,
  }));
};

/**
 * Requires the exact Scene object privately bound to the exact issued preview
 * result. Equal serialized bytes are evidence, not authority.
 */
export function materializeX4UiPreviewPaintScene(issuedResult: unknown, candidateScene: unknown): X4UiScene | undefined {
  try {
    if (typeof issuedResult !== 'object' || issuedResult === null) return undefined;
    const record = issuedPreviewPaintAuthorities.get(issuedResult as object);
    if (record === undefined || candidateScene !== record.issuedScene && candidateScene !== record.issuedSceneResult) return undefined;
    const result = issuedResult as unknown as X4UiPreviewPipelineResult;
    if ((result.status !== 'projected' && result.status !== 'partial')
      || result.scene !== record.issuedSceneResult
      || record.issuedSceneResult.status === 'refused'
      || record.issuedSceneResult.scene !== record.issuedScene
      || record.issuedSceneResult.status !== record.issuedScene.status) return undefined;
    return record.materializedScene;
  } catch {
    return undefined;
  }
}

export function isX4UiPreviewPaintSourceAuthority(issuedResult: unknown, candidateScene: unknown): boolean {
  return materializeX4UiPreviewPaintScene(issuedResult, candidateScene) !== undefined;
}

const sourcePin = <T extends string>(sourcePath: T, lineStart: number, lineEnd = lineStart): {
  readonly sourcePath: T;
  readonly lineStart: number;
  readonly lineEnd: number;
} => ({
  sourcePath,
  lineStart,
  lineEnd,
});

const finitePositive = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

const validTruthGrade = (value: unknown): value is X4UiLayoutTruthGrade =>
  value === 'supplied' || value === 'captured' || value === 'unverified-default';

const validSourceIdentity = (value: unknown): value is X4UiLayoutModelIdentity =>
  isRecord(value)
  && typeof value.file === 'string'
  && value.file.length > 0
  && (value.sourcePath === undefined || typeof value.sourcePath === 'string')
  && typeof value.sha256 === 'string'
  && /^[0-9A-Fa-f]{64}$/.test(value.sha256);

/** Exact port of widgetSystem.scaleSizeMinValue from widget_fullscreen.lua. */
export function scaleSizeMinValue(insize: number, minvalue: number, uiScale: number): number {
  if (!Number.isFinite(insize) || !Number.isFinite(minvalue) || !finitePositive(uiScale)) {
    throw new RangeError('scaleSizeMinValue requires finite inputs and a positive uiScale');
  }
  return Math.max(minvalue, Math.floor(insize * uiScale + 0.5));
}

export const widgetScaleSizeMinValue = scaleSizeMinValue;

const widgetPortFor = (uiScale: number): X4UiPreviewWidgetPortEvidence => {
  const scaleSizeMinValueEvidence = (input: number, minimum: number): X4UiPreviewScaleEvidence => ({
    source: sourcePin(X4_LAYOUT_PROVENANCE.widgetSourcePath, WIDGET_SCALE_LINE_START, WIDGET_SCALE_LINE_END),
    input,
    minimum,
    uiScale,
    value: scaleSizeMinValue(input, minimum, uiScale),
  });
  const tableBorder = scaleSizeMinValueEvidence(2, 2);
  const standardContainerOffset = scaleSizeMinValueEvidence(4, 3);
  const firstScrollbar = scaleSizeMinValueEvidence(4, 3);
  const secondScrollbar = scaleSizeMinValueEvidence(4, 3);
  return {
    scaleSizeMinValue: scaleSizeMinValueEvidence(1, 1),
    tableBorder: {
      ...tableBorder,
      source: sourcePin(X4_LAYOUT_PROVENANCE.widgetSourcePath, WIDGET_TABLE_GEOMETRY_LINE_START, WIDGET_TABLE_GEOMETRY_LINE_END),
    },
    standardContainerOffset: {
      ...standardContainerOffset,
      source: sourcePin(X4_LAYOUT_PROVENANCE.widgetSourcePath, WIDGET_TABLE_GEOMETRY_LINE_START, WIDGET_TABLE_GEOMETRY_LINE_END),
    },
    scrollbarWidth: {
      first: firstScrollbar,
      second: secondScrollbar,
      value: firstScrollbar.value + secondScrollbar.value,
      source: sourcePin(X4_LAYOUT_PROVENANCE.widgetSourcePath, WIDGET_SCROLLBAR_LINE_START, WIDGET_SCROLLBAR_LINE_END),
    },
  };
};

export function buildX4UiPreviewProfile(input: X4UiPreviewProfileInput): X4UiLayoutProjectionProfile {
  if (!isRecord(input) || typeof input.id !== 'string' || input.id.length === 0
    || typeof input.provenance !== 'string' || input.provenance.length === 0
    || !validTruthGrade(input.truthGrade)
    || !validSourceIdentity(input.source)
    || !isRecord(input.drawable)
    || !finitePositive(input.drawable.width)
    || !finitePositive(input.drawable.height)
    || !finitePositive(input.uiScale)) {
    throw new TypeError('preview profile input is malformed');
  }
  if (input.minTextHeight !== undefined && (!Number.isFinite(input.minTextHeight) || input.minTextHeight < 0)) {
    throw new TypeError('preview profile minTextHeight is malformed');
  }
  if (input.localExpansion !== undefined
    && (!isRecord(input.localExpansion)
      || !Number.isSafeInteger(input.localExpansion.maxDepth)
      || input.localExpansion.maxDepth < 1
      || input.localExpansion.maxDepth > 32
      || !Number.isSafeInteger(input.localExpansion.maxInvocations)
      || input.localExpansion.maxInvocations < 1
      || input.localExpansion.maxInvocations > 2048)) {
    throw new TypeError('preview profile localExpansion limits are malformed');
  }
  const widgetPort = widgetPortFor(input.uiScale);
  const profile: X4UiLayoutProjectionProfile = {
    id: input.id,
    provenance: input.provenance,
    truthGrade: input.truthGrade,
    source: cloneJson(input.source) as X4UiLayoutModelIdentity,
    frame: { width: input.drawable.width, height: input.drawable.height },
    metrics: {
      uiScale: input.uiScale,
      borderSize: widgetPort.tableBorder.value,
      scrollbarWidth: widgetPort.scrollbarWidth.value,
      standardContainerOffset: widgetPort.standardContainerOffset.value,
    },
    helper: {
      sourcePath: X4_LAYOUT_PROVENANCE.helperSourcePath,
      sha256: X4_LAYOUT_PROVENANCE.helperSha256,
      constants: {
        standardTextHeight: { value: HELPER_STANDARD_TEXT_HEIGHT, source: sourcePin(X4_LAYOUT_PROVENANCE.helperSourcePath, HELPER_STANDARD_TEXT_HEIGHT_LINE) },
        standardButtonHeight: { value: HELPER_STANDARD_BUTTON_HEIGHT, source: sourcePin(X4_LAYOUT_PROVENANCE.helperSourcePath, HELPER_STANDARD_BUTTON_HEIGHT_LINE) },
        borderSize: { value: widgetPort.tableBorder.value, source: sourcePin(X4_LAYOUT_PROVENANCE.helperSourcePath, HELPER_BORDER_LINE) },
        viewWidth: { value: input.drawable.width, source: sourcePin(X4_LAYOUT_PROVENANCE.helperSourcePath, HELPER_VIEW_WIDTH_LINE) },
        viewHeight: { value: input.drawable.height, source: sourcePin(X4_LAYOUT_PROVENANCE.helperSourcePath, HELPER_VIEW_HEIGHT_LINE) },
      },
    },
    widget: {
      sourcePath: X4_LAYOUT_PROVENANCE.widgetSourcePath,
      sha256: X4_LAYOUT_PROVENANCE.widgetSha256,
    },
    defaults: {
      standardButtonHeight: { value: HELPER_STANDARD_BUTTON_HEIGHT, source: sourcePin(X4_LAYOUT_PROVENANCE.helperSourcePath, HELPER_STANDARD_BUTTON_HEIGHT_LINE) },
      ...(input.minTextHeight === undefined ? {} : { minTextHeight: input.minTextHeight }),
    },
    ...(input.localExpansion === undefined ? {} : { localExpansion: cloneJson(input.localExpansion) as NonNullable<X4UiLayoutProjectionProfile['localExpansion']> }),
  };
  return freezeDeep(profile);
}

export const createX4UiPreviewProfile = buildX4UiPreviewProfile;

const sourceRecordCopy = (record: X4UiWorkspaceSourceRecord): X4UiWorkspaceSourceRecord =>
  cloneJson(record) as X4UiWorkspaceSourceRecord;

const assetIdentityFor = (asset: { readonly relativePath: string; readonly sha256: string }): {
  readonly relativePath: string;
  readonly sha256: string;
} => ({
  relativePath: asset.relativePath,
  sha256: asset.sha256,
});

const sourceSummaryFor = (source: X4UiWorkspaceSource): X4UiPreviewSourceSummary => ({
  status: source.status,
  availability: source.availability,
  available: source.available,
  locked: source.locked,
  editable: source.editable,
  shippable: source.shippable,
  reason: source.reason,
  reasons: cloneJson(source.reasons) as X4UiPreviewSourceSummary['reasons'],
  detail: source.detail,
  verification: NOT_VERIFIED_IN_GAME,
  rootFile: source.rootFile === null ? null : sourceRecordCopy(source.rootFile),
  rootCandidates: source.rootCandidates.map(sourceRecordCopy),
  luaFiles: source.luaFiles.map(sourceRecordCopy),
  registeredLuaFiles: source.registeredLuaFiles.map(sourceRecordCopy),
  bundle: source.bundle === null ? null : {
    locked: source.bundle.locked,
    hasUnverifiedCallModelGaps: source.bundle.hasUnverifiedCallModelGaps,
    diagnostics: cloneJson(source.bundle.diagnostics) as readonly unknown[],
  },
  compile: cloneJson(source.compile),
  cas: cloneJson(source.cas),
});

const corpusSummaryFor = (corpus: unknown): X4UiPreviewCorpusSummary => {
  if (isX4UiCorpusCanonicalSuccess(corpus)) {
    return {
      status: 'canonical',
      available: true,
      canonical: true,
      evidenceKind: corpus.evidenceKind,
      canonicalIdentity: corpus.canonicalIdentity,
      statusIdentity: cloneJson(corpus.statusIdentity),
      helperSourceHash: corpus.helperSourceHash,
      widgetSourceHash: corpus.widgetSourceHash,
      fonts: {
        regular: {
          descriptor: assetIdentityFor(corpus.assets.regular.descriptor),
          atlas: assetIdentityFor(corpus.assets.regular.atlas),
        },
        bold: {
          descriptor: assetIdentityFor(corpus.assets.bold.descriptor),
          atlas: assetIdentityFor(corpus.assets.bold.atlas),
        },
      },
      verification: NOT_VERIFIED_IN_GAME,
    };
  }
  if (isRecord(corpus) && corpus.ok === true) {
    const evidenceKind = typeof corpus.evidenceKind === 'string' ? corpus.evidenceKind : undefined;
    return {
      status: evidenceKind === 'synthetic' ? 'synthetic' : 'stale',
      available: false,
      canonical: false,
      ...(evidenceKind ? { evidenceKind } : {}),
      ...(typeof corpus.canonicalIdentity === 'string' ? { canonicalIdentity: corpus.canonicalIdentity } : {}),
      verification: NOT_VERIFIED_IN_GAME,
      reason: 'canonical configured-corpus authority is unavailable',
    };
  }
  return {
    status: 'unavailable',
    available: false,
    canonical: false,
    verification: NOT_VERIFIED_IN_GAME,
    reason: 'configured corpus evidence was not supplied',
  };
};

const sourceCandidateFor = (file: {
  readonly index: number;
  readonly path: string;
  readonly rawPath: string;
  readonly lookupKey?: string;
  readonly sourcePath?: string;
  readonly registered: boolean;
  readonly unregistered: boolean;
  readonly editable: boolean;
  readonly parseStatus: string;
  readonly verificationStatus: string;
  readonly callModel: Parameters<typeof createX4UiLayoutTargetCatalog>[0];
}): X4UiPreviewSourceCandidate => {
  try {
    const catalog = createX4UiLayoutTargetCatalog(file.callModel);
    return freezeDeep({
      index: file.index,
      path: file.path,
      rawPath: file.rawPath,
      ...(file.lookupKey === undefined ? {} : { lookupKey: file.lookupKey }),
      ...(file.sourcePath === undefined ? {} : { sourcePath: file.sourcePath }),
      sourceIdentity: cloneJson(catalog.sourceIdentity) as X4UiLayoutModelIdentity,
      registered: file.registered,
      unregistered: file.unregistered,
      editable: file.editable,
      parseStatus: file.parseStatus,
      verificationStatus: file.verificationStatus,
      targetCount: catalog.targets.length,
      targets: cloneJson(catalog.targets) as readonly X4UiLayoutTarget[],
    });
  } catch (error) {
    return freezeDeep({
      index: file.index,
      path: file.path,
      rawPath: file.rawPath,
      ...(file.lookupKey === undefined ? {} : { lookupKey: file.lookupKey }),
      ...(file.sourcePath === undefined ? {} : { sourcePath: file.sourcePath }),
      registered: file.registered,
      unregistered: file.unregistered,
      editable: file.editable,
      parseStatus: file.parseStatus,
      verificationStatus: file.verificationStatus,
      targetCount: 0,
      targets: [],
      catalogError: error instanceof Error ? error.message : 'target catalog could not be built',
    });
  }
};

const lintFilesFor = (source: X4UiWorkspaceSource): readonly X4UiPreviewLintFile[] => {
  const files = source.bundle?.sourceFiles || [];
  return files.map(file => {
    try {
      return freezeDeep({
        index: file.index,
        path: file.path,
        rawPath: file.rawPath,
        ...(file.lookupKey === undefined ? {} : { lookupKey: file.lookupKey }),
        ...(file.sourcePath === undefined ? {} : { sourcePath: file.sourcePath }),
        registered: file.registered,
        unregistered: file.unregistered,
        editable: file.editable,
        parseStatus: file.parseStatus,
        verificationStatus: file.verificationStatus,
        registrationIndexes: [...file.registrationIndexes],
        diagnostics: cloneJson(file.diagnostics) as readonly unknown[],
        verificationGaps: cloneJson(file.verificationGaps) as readonly unknown[],
        lint: cloneJson(lintX4UiCallModel(file.callModel)) as X4UiLintResult,
      });
    } catch (error) {
      return freezeDeep({
        index: file.index,
        path: file.path,
        rawPath: file.rawPath,
        ...(file.lookupKey === undefined ? {} : { lookupKey: file.lookupKey }),
        ...(file.sourcePath === undefined ? {} : { sourcePath: file.sourcePath }),
        registered: file.registered,
        unregistered: file.unregistered,
        editable: file.editable,
        parseStatus: file.parseStatus,
        verificationStatus: file.verificationStatus,
        registrationIndexes: [...file.registrationIndexes],
        diagnostics: cloneJson(file.diagnostics) as readonly unknown[],
        verificationGaps: cloneJson(file.verificationGaps) as readonly unknown[],
        lintError: error instanceof Error ? error.message : 'call-model lint could not be evaluated',
      });
    }
  });
};

const defaultTextPolicy = (input: X4UiPreviewTextPolicyInput | undefined): X4UiSceneProfile['textPolicy'] => ({
  nominalDesignSize: 32,
  lineSpacing: input?.lineSpacing ?? 0,
  wrapMode: input?.wrapMode ?? 'word-wrap',
  truncationMode: input?.truncationMode ?? 'ellipsis',
  whitespacePolicy: {
    mode: input?.whitespaceMode ?? 'preserve',
    breakOn: input?.breakOn ?? 'ascii-space',
  },
  ellipsisPolicy: {
    token: input?.ellipsisToken ?? X4_UI_DEFAULT_ELLIPSIS_TOKEN,
    placement: 'end',
  },
  newlinePolicy: input?.newlinePolicy ?? 'lf-crlf',
  truthGrade: input?.truthGrade ?? ZEKTON_TEXT_TRUTH_GRADE,
  evidenceState: ZEKTON_EVIDENCE_STATE,
});

const sceneProfileFor = (
  profile: X4UiLayoutProjectionProfile,
  corpus: X4UiCorpusCanonicalSuccess,
  tableView: Readonly<Record<string, X4UiSceneTableViewState>> | undefined,
  textPolicy: X4UiPreviewTextPolicyInput | undefined,
): X4UiSceneProfile => freezeDeep({
  id: profile.id,
  provenance: profile.provenance,
  source: cloneJson(profile.source) as X4UiLayoutModelIdentity,
  helper: {
    sourcePath: profile.helper.sourcePath,
    sha256: profile.helper.sha256,
  },
  widget: {
    sourcePath: profile.widget.sourcePath,
    sha256: profile.widget.sha256,
  },
  fonts: {
    Zekton: {
      descriptor: assetIdentityFor(corpus.assets.regular.descriptor) as X4UiSceneProfile['fonts']['Zekton']['descriptor'],
      atlas: assetIdentityFor(corpus.assets.regular.atlas) as X4UiSceneProfile['fonts']['Zekton']['atlas'],
    },
    'Zekton Bold': {
      descriptor: assetIdentityFor(corpus.assets.bold.descriptor) as X4UiSceneProfile['fonts']['Zekton Bold']['descriptor'],
      atlas: assetIdentityFor(corpus.assets.bold.atlas) as X4UiSceneProfile['fonts']['Zekton Bold']['atlas'],
    },
  },
  drawable: {
    width: profile.frame.width,
    height: profile.frame.height,
  },
  textPolicy: defaultTextPolicy(textPolicy),
  ...(tableView === undefined ? {} : { tableView: cloneJson(tableView) as Readonly<Record<string, X4UiSceneTableViewState>> }),
});

const refusedScene = (message: string): X4UiSceneResult => ({
  status: 'refused',
  refusal: {
    code: 'font-mismatch',
    message,
  },
  verification: {
    game: NOT_VERIFIED_IN_GAME,
    gameVerified: false,
  },
});

const minTextHeightEvidenceFor = (profile: X4UiLayoutProjectionProfile): {
  readonly minTextHeight?: {
    readonly value: number;
    readonly truthGrade: X4UiLayoutTruthGrade;
  };
} => profile.defaults.minTextHeight === undefined
  ? {}
  : {
    minTextHeight: {
      value: profile.defaults.minTextHeight,
      truthGrade: profile.truthGrade,
    },
  };

const baseResult = (
  source: X4UiWorkspaceSource,
  corpus: unknown,
  profile: X4UiLayoutProjectionProfile,
  widgetPort: X4UiPreviewWidgetPortEvidence,
  lint: readonly X4UiPreviewLintFile[],
  sourceCandidates: readonly X4UiPreviewSourceCandidate[],
  targetCandidates: readonly X4UiLayoutTarget[],
  selection: X4UiPreviewSelectionState,
  gaps: readonly X4UiPreviewPipelineResult['gaps'][number][],
  tableView: Readonly<Record<string, X4UiSceneTableViewState>> | undefined,
): X4UiPreviewPipelineResult => freezeDeep({
  version: X4_UI_PREVIEW_PIPELINE_VERSION,
  status: selection.status === 'needs-selection' ? 'needs-selection' : 'refused',
  gameTruth: NOT_VERIFIED_IN_GAME,
  source: sourceSummaryFor(source),
  corpus: corpusSummaryFor(corpus),
  sourceCandidates,
  targetCandidates,
  selection,
  profile: {
    layout: profile,
    widgetPort,
    ...(tableView === undefined ? {} : { tableView: cloneJson(tableView) as Readonly<Record<string, X4UiSceneTableViewState>> }),
    ...minTextHeightEvidenceFor(profile),
  },
  lint,
  gaps,
  authority: {
    editable: source.editable,
    shippable: source.shippable,
    sourceStatus: source.status,
    verification: NOT_VERIFIED_IN_GAME,
  },
  verification: { game: NOT_VERIFIED_IN_GAME, gameVerified: false },
});

const invalidInputResult = (message: string): X4UiPreviewPipelineResult => {
  const emptySource = {
    status: 'unavailable' as const,
    availability: 'unavailable' as const,
    available: false,
    locked: false,
    editable: false,
    shippable: false,
    reason: 'source-bundle-failed' as const,
    reasons: ['source-bundle-failed' as const],
    detail: message,
    verification: NOT_VERIFIED_IN_GAME,
    rootFile: null,
    rootCandidates: [],
    luaFiles: [],
    registeredLuaFiles: [],
    bundle: null,
    compile: null,
    cas: null,
  };
  return freezeDeep({
    version: X4_UI_PREVIEW_PIPELINE_VERSION,
    status: 'refused' as const,
    gameTruth: NOT_VERIFIED_IN_GAME,
    source: emptySource,
    corpus: {
      status: 'unavailable' as const,
      available: false,
      canonical: false,
      verification: NOT_VERIFIED_IN_GAME,
      reason: 'pipeline input is malformed',
    },
    sourceCandidates: [],
    targetCandidates: [],
    selection: { status: 'unavailable' as const, reason: 'invalid-input' },
    profile: {},
    lint: [],
    gaps: [{ stage: 'source' as const, reason: message }],
    authority: {
      editable: false,
      shippable: false,
      sourceStatus: 'unavailable' as const,
      verification: NOT_VERIFIED_IN_GAME,
    },
    verification: { game: NOT_VERIFIED_IN_GAME, gameVerified: false as const },
  });
};

/** Project one exact source file/target without selecting a fallback. */
export function projectX4UiPreviewPipeline(input: X4UiPreviewPipelineInput): X4UiPreviewPipelineResult {
  try {
    if (!isRecord(input) || !isRecord(input.source) || !isRecord(input.profile)) {
      return invalidInputResult('preview pipeline input is malformed');
    }
    const colorEvidence = ownDataPropertyValue(input, 'colorEvidence') as X4UiCorpusCanonicalColorSuccess | undefined;
    const profileInput = input.profile;
    if (!finitePositive(profileInput.uiScale)) return invalidInputResult('preview profile uiScale must be positive and finite');
    const widgetPort = widgetPortFor(profileInput.uiScale);
    const layoutProfile = buildX4UiPreviewProfile(profileInput);
    const lint = lintFilesFor(input.source);
    const sourceCandidates = (input.source.bundle?.sourceFiles || []).map(sourceCandidateFor);
    const targetCandidates = input.selection === undefined
      ? []
      : sourceCandidates.find(candidate => candidate.index === input.selection?.sourceIndex)?.targets || [];
    const gaps: X4UiPreviewPipelineResult['gaps'][number][] = [];
    if (input.source.bundle === null) {
      gaps.push({ stage: 'source', reason: input.source.detail });
      return baseResult(
        input.source,
        input.corpus,
        layoutProfile,
        widgetPort,
        lint,
        sourceCandidates,
        [],
        { status: 'unavailable', reason: 'source bundle is unavailable' },
        gaps,
        input.tableView,
      );
    }
    if (input.selection === undefined) {
      gaps.push({ stage: 'selection', reason: 'an exact source index/path/identity and target ID/range are required' });
      return baseResult(
        input.source,
        input.corpus,
        layoutProfile,
        widgetPort,
        lint,
        sourceCandidates,
        [],
        { status: 'needs-selection', reason: 'source-and-target-selection-required' },
        gaps,
        input.tableView,
      );
    }
    const selected = input.selection;
    const selectedCandidate = sourceCandidates.filter(candidate =>
      candidate.index === selected.sourceIndex && candidate.path === selected.path
      && candidate.sourceIdentity !== undefined
      && sameJson(candidate.sourceIdentity, selected.sourceIdentity));
    if (selectedCandidate.length !== 1) {
      gaps.push({ stage: 'selection', reason: 'source selection is missing, ambiguous, or stale' });
      return baseResult(
        input.source,
        input.corpus,
        layoutProfile,
        widgetPort,
        lint,
        sourceCandidates,
        targetCandidates,
        { status: 'needs-selection', reason: 'source-selection-is-stale-or-ambiguous', sourceIndex: selected.sourceIndex },
        gaps,
        input.tableView,
      );
    }
    const selectedSource = selectedCandidate[0];
    const sourceFile = input.source.bundle.sourceFiles.find(file => file.index === selected.sourceIndex && file.path === selected.path);
    if (!sourceFile) {
      gaps.push({ stage: 'selection', reason: 'selected source file is no longer materialized' });
      return baseResult(input.source, input.corpus, layoutProfile, widgetPort, lint, sourceCandidates, targetCandidates, {
        status: 'unavailable', reason: 'selected-source-is-not-materialized', sourceIndex: selected.sourceIndex,
      }, gaps, input.tableView);
    }
    const target = selectedSource.targets.find(candidate => candidate.id === selected.target.id
      && sameJson(candidate.source, selected.target.source)
      && candidate.kind === selected.target.kind
      && (selected.target.name === undefined || candidate.name === selected.target.name)
      && (selected.target.handler === undefined || candidate.handler === selected.target.handler));
    if (!target) {
      gaps.push({ stage: 'selection', reason: 'target selection is stale or does not identify exactly one catalog target' });
      return freezeDeep({
        ...baseResult(input.source, input.corpus, layoutProfile, widgetPort, lint, sourceCandidates, selectedSource.targets, {
          status: 'needs-selection',
          reason: 'target-selection-is-stale-or-ambiguous',
          sourceIndex: selected.sourceIndex,
          targetId: selected.target.id,
        }, gaps, input.tableView),
        selectedSource,
      });
    }
    if (!sameJson(layoutProfile.source, selected.sourceIdentity)) {
      gaps.push({ stage: 'selection', reason: 'profile source identity does not match the selected source identity' });
      return freezeDeep({
        ...baseResult(input.source, input.corpus, layoutProfile, widgetPort, lint, sourceCandidates, selectedSource.targets, {
          status: 'needs-selection', reason: 'profile-source-identity-mismatch', sourceIndex: selected.sourceIndex, targetId: target.id,
        }, gaps, input.tableView),
        selectedSource,
        selectedTarget: target,
      });
    }
    // Workspace-source bundles may retain optional undefined members on call-model source records.
    // The accepted producer boundary is JSON-domain strict, so project a detached JSON-normalized
    // view of that existing model; linting above still uses the original callModel directly and no
    // parser/model rebuild is performed here.
    const projectModel = cloneJson(sourceFile.callModel) as typeof sourceFile.callModel;
    const canonical = isX4UiCorpusCanonicalSuccess(input.corpus) ? input.corpus : undefined;
    const program = projectX4UiLayoutProgram(
      projectModel,
      target,
      layoutProfile,
      input.samples,
      input.paths,
      colorEvidence,
      canonical,
    );
    if (program.status === 'refused' && 'refusal' in program) {
      gaps.push({ stage: 'program', reason: program.refusal.message });
      return freezeDeep({
        ...baseResult(input.source, input.corpus, layoutProfile, widgetPort, lint, sourceCandidates, selectedSource.targets, {
          status: 'selected', reason: 'program-refused', sourceIndex: selected.sourceIndex, targetId: target.id,
        }, gaps, input.tableView),
        status: 'refused' as const,
        selectedSource,
        selectedTarget: target,
        profile: {
          widgetPort,
          layout: layoutProfile,
          ...(input.tableView === undefined ? {} : { tableView: cloneJson(input.tableView) as Readonly<Record<string, X4UiSceneTableViewState>> }),
          ...minTextHeightEvidenceFor(layoutProfile),
        },
        program,
      });
    }
    if (!canonical) {
      gaps.push({ stage: 'corpus', reason: 'Scene geometry requires loader-issued canonical configured-corpus evidence' });
      return freezeDeep({
        ...baseResult(input.source, input.corpus, layoutProfile, widgetPort, lint, sourceCandidates, selectedSource.targets, {
          status: 'selected', reason: 'canonical-corpus-required', sourceIndex: selected.sourceIndex, targetId: target.id,
        }, gaps, input.tableView),
        status: 'refused' as const,
        selectedSource,
        selectedTarget: target,
        profile: {
          widgetPort,
          layout: layoutProfile,
          ...(input.tableView === undefined ? {} : { tableView: cloneJson(input.tableView) as Readonly<Record<string, X4UiSceneTableViewState>> }),
          ...minTextHeightEvidenceFor(layoutProfile),
        },
        program,
        scene: refusedScene('canonical configured-corpus evidence is unavailable; no Scene geometry was produced'),
      });
    }
    const sceneProfile = sceneProfileFor(layoutProfile, canonical, input.tableView, input.textPolicy);
    const scene = projectX4UiScene(program, canonical, sceneProfile);
    if (scene.status === 'refused') gaps.push({ stage: 'scene', reason: scene.refusal.message });
    const result: X4UiPreviewPipelineResult = freezeDeep({
      version: X4_UI_PREVIEW_PIPELINE_VERSION,
      status: (scene.status === 'refused' ? 'refused' : scene.status) as X4UiPreviewPipelineResult['status'],
      gameTruth: NOT_VERIFIED_IN_GAME,
      source: sourceSummaryFor(input.source),
      corpus: corpusSummaryFor(input.corpus),
      sourceCandidates,
      targetCandidates: selectedSource.targets,
      selection: { status: 'selected', reason: 'exact-source-and-target-selected', sourceIndex: selected.sourceIndex, targetId: target.id },
      selectedSource,
      selectedTarget: target,
      profile: {
        layout: layoutProfile,
        scene: sceneProfile,
        widgetPort,
        ...(input.tableView === undefined ? {} : { tableView: cloneJson(input.tableView) as Readonly<Record<string, X4UiSceneTableViewState>> }),
        ...minTextHeightEvidenceFor(layoutProfile),
      },
      lint,
      program,
      scene,
      gaps,
      authority: {
        editable: input.source.editable,
        shippable: input.source.shippable,
        sourceStatus: input.source.status,
        verification: NOT_VERIFIED_IN_GAME,
      },
      verification: { game: NOT_VERIFIED_IN_GAME, gameVerified: false as const },
    });
    if (result.status === 'projected' || result.status === 'partial') issuePreviewPaintAuthority(result);
    return result;
  } catch (error) {
    return invalidInputResult(error instanceof Error ? error.message : 'preview pipeline refused malformed input');
  }
}

export const buildX4UiPreviewPipeline = projectX4UiPreviewPipeline;
export const projectPreviewPipeline = projectX4UiPreviewPipeline;
