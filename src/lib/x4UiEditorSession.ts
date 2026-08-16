/**
 * Pure Batch 7A orchestration for the X4 UI editor session.
 *
 * This adapter only joins the accepted workspace-source, preview, paint, and
 * keep-out owners. It does not own a UI, a renderer, a source mutation path, or
 * any browser/game state. Preview evidence remains explicitly unverified in
 * game at every boundary.
 */

import {
  buildX4UiWorkspaceSource,
  NOT_VERIFIED_IN_GAME,
  type X4UiWorkspaceSource,
} from './x4UiWorkspaceSource';
import {
  projectX4UiPreviewPipeline,
  type X4UiPreviewPipelineInput,
  type X4UiPreviewPipelineResult,
  type X4UiPreviewSelection,
} from './x4UiPreviewPipeline';
import type {
  X4UiLayoutModelIdentity,
  X4UiLayoutPreviewSampleCatalog,
  X4UiLayoutPreviewSampleInput,
  X4UiLayoutPreviewSampleValue,
  X4UiLayoutScalar,
  X4UiLayoutScalarType,
} from './x4UiLayoutProgram';
import {
  isX4UiCorpusCanonicalSuccess,
  type X4UiCorpusCanonicalSuccess,
} from './x4UiCorpusAssets';
import {
  BUILT_IN_KEEP_OUTS,
  KEEP_OUT_PRESETS,
  getKeepOutPreset,
  projectBuiltInKeepOut,
  type KeepOutContextPresetId,
  type KeepOutPresetMember,
  type KeepOutProjectionResult,
  type X4UiKeepOutEntry,
} from './x4UiKeepOuts';
import {
  projectX4UiPaintPlan,
  type X4UiPaintPlanResult,
} from './x4UiPaintPlan';
import {
  X4_UI_CANVAS_DIAGNOSTIC_PALETTE,
  X4_UI_CANVAS_RENDERER_FORMAT,
  X4_UI_CANVAS_RENDERER_VERSION,
  type X4UiCanvasRenderReceipt,
  type X4UiCanvasRenderResult,
  type X4UiCanvasRenderRefusalCode,
  type X4UiCanvasSurface,
} from './x4UiCanvasRenderer';

type JsonRecord = Record<string, unknown>;
type EditorWorkspace = Parameters<typeof buildX4UiWorkspaceSource>[0];

export type X4UiEditorSampleState = X4UiLayoutPreviewSampleInput | undefined;

export interface X4UiEditorSampleBinding {
  readonly catalogId: string;
  readonly programKey: string;
  readonly profileKey: string;
  readonly selectionKey: string;
}

/** Opaque authority issued by the selected projected editor session. */
export interface X4UiEditorSampleCatalogAuthority {
  readonly kind: 'x4-ui-editor-sample-catalog-authority';
}

export type X4UiEditorSampleParseResult =
  | { readonly status: 'accepted'; readonly value: X4UiLayoutScalar }
  | { readonly status: 'reset' }
  | {
    readonly status: 'refused';
    readonly code: 'malformed-input' | 'nonfinite-number' | 'boolean-literal' | 'unknown-type';
    readonly message: string;
  };

export type X4UiEditorSampleReconciliationCode =
  | 'catalog-unavailable'
  | 'catalog-authority-required'
  | 'malformed-catalog'
  | 'duplicate-catalog-entry'
  | 'malformed-samples'
  | 'stale-samples'
  | 'unknown-sample'
  | 'duplicate-sample'
  | 'nonfinite-sample'
  | 'sample-type-mismatch';

export type X4UiEditorSampleReconciliation =
  | {
    readonly status: 'accepted';
    readonly samples: X4UiEditorSampleState;
    readonly changed: boolean;
  }
  | {
    readonly status: 'cleared';
    readonly samples: undefined;
    readonly changed: true;
    readonly code: 'catalog-unavailable' | 'stale-samples';
    readonly message: string;
  }
  | {
    readonly status: 'refused';
    readonly samples: X4UiEditorSampleState;
    readonly changed: boolean;
    readonly code: Exclude<X4UiEditorSampleReconciliationCode, 'catalog-unavailable' | 'stale-samples'>;
    readonly message: string;
  };

export type X4UiEditorSampleUpdateResult =
  | {
    readonly status: 'accepted' | 'reset';
    readonly samples: X4UiEditorSampleState;
    readonly changed: boolean;
  }
  | {
    readonly status: 'refused';
    readonly samples: X4UiEditorSampleState;
    readonly changed: boolean;
    readonly code: 'malformed-input' | 'nonfinite-number' | 'boolean-literal' | 'unknown-type'
      | 'catalog-unavailable' | 'catalog-authority-required' | 'malformed-catalog' | 'duplicate-catalog-entry' | 'malformed-samples'
      | 'stale-samples' | 'unknown-sample' | 'duplicate-sample' | 'nonfinite-sample' | 'sample-type-mismatch';
    readonly message: string;
  };

export const X4_UI_EDITOR_SESSION_GAME_TRUTH = NOT_VERIFIED_IN_GAME;

const UNSELECTED_SOURCE = Object.freeze({
  file: 'unselected.lua',
  sourcePath: 'fixture://unselected.lua',
  sha256: '0'.repeat(64),
});

export const X4_UI_EDITOR_UNSELECTED_SOURCE = UNSELECTED_SOURCE;

export type X4UiEditorProfileTruthGrade = 'supplied' | 'captured' | 'unverified-default';

export type X4UiEditorProfileSource = {
  readonly file: string;
  readonly sourcePath?: string;
  readonly sha256: string;
};

export type X4UiEditorProfile = {
  readonly id: string;
  readonly provenance: string;
  readonly truthGrade: X4UiEditorProfileTruthGrade;
  readonly source: X4UiEditorProfileSource;
  readonly drawable: {
    readonly width: number;
    readonly height: number;
  };
  readonly uiScale: number;
  readonly minTextHeight?: number;
};

export const X4_UI_EDITOR_DEFAULT_PROFILE: X4UiEditorProfile = Object.freeze({
  id: 'x4-ui-editor-default',
  provenance: 'x4-ui-editor-default',
  truthGrade: 'unverified-default',
  source: UNSELECTED_SOURCE,
  drawable: Object.freeze({ width: 2560, height: 1440 }),
  uiScale: 1.4,
});

export type X4UiEditorProfileInput = X4UiEditorProfile | X4UiEditorProfileControls;

export type X4UiEditorProfileControls = {
  width: number;
  height: number;
  uiScale: number;
};

export interface X4UiEditorSessionInput {
  readonly workspace: EditorWorkspace;
  readonly corpus: unknown;
  readonly profile?: X4UiEditorProfileInput;
  readonly selection?: X4UiPreviewSelection;
  readonly samples?: X4UiLayoutPreviewSampleInput;
  /** Editor-only binding; never forwarded to the layout-program owner. */
  readonly sampleBinding?: X4UiEditorSampleBinding;
  /** Editor-only session-issued sample authority; never forwarded to the layout-program owner. */
  readonly sampleCatalogAuthority?: X4UiEditorSampleCatalogAuthority;
  readonly activePresetId?: KeepOutContextPresetId | string;
  readonly enabledEntryIds?: readonly string[];
  readonly [key: string]: unknown;
}

export type X4UiEditorNormalizedProfile = X4UiEditorProfile;

export interface X4UiEditorKeepOutMemberProjection extends KeepOutPresetMember {
  readonly entry: X4UiKeepOutEntry | null;
  readonly projection: KeepOutProjectionResult;
  readonly enabled: boolean;
}

export interface X4UiEditorKeepOutPresetProjection {
  readonly id: KeepOutContextPresetId;
  readonly label: string;
  readonly members: readonly X4UiEditorKeepOutMemberProjection[];
}

export type X4UiEditorSessionStatus = X4UiPreviewPipelineResult['status'] | 'incomplete';

export interface X4UiEditorSessionProjection {
  readonly status: X4UiEditorSessionStatus;
  readonly gameTruth: typeof X4_UI_EDITOR_SESSION_GAME_TRUTH;
  readonly gameVerified: false;
  readonly normalizedProfile: X4UiEditorNormalizedProfile;
  /** Alias for consumers that use the session's profile vocabulary. */
  readonly profile: X4UiEditorNormalizedProfile;
  readonly source: X4UiWorkspaceSource;
  readonly preview: X4UiPreviewPipelineResult;
  readonly sampleCatalog: X4UiLayoutPreviewSampleCatalog | null;
  readonly sampleCatalogAuthority: X4UiEditorSampleCatalogAuthority | undefined;
  readonly samples: X4UiEditorSampleState;
  readonly sampleBinding: X4UiEditorSampleBinding | undefined;
  readonly sampleReconciliation: X4UiEditorSampleReconciliation;
  readonly keepOutPresets: readonly X4UiEditorKeepOutPresetProjection[];
  /** Alias retained for callers that call the entries simply presets. */
  readonly presets: readonly X4UiEditorKeepOutPresetProjection[];
  readonly activePresetId: KeepOutContextPresetId | null;
  readonly activePreset: X4UiEditorKeepOutPresetProjection | null;
  readonly activeKeepOuts: readonly {
    readonly context: KeepOutContextPresetId;
    readonly projection: KeepOutProjectionResult;
  }[];
  /** Exact input shape accepted by the paint-plan owner. */
  readonly keepOuts: readonly {
    readonly context: KeepOutContextPresetId;
    readonly projection: KeepOutProjectionResult;
  }[];
  readonly paint: X4UiPaintPlanResult | null;
  readonly canRender: boolean;
  readonly reason: string;
}

export type X4UiEditorCanvasStatus = 'empty' | 'current' | 'stale' | 'refused';

export interface X4UiEditorCanvasState {
  readonly status: X4UiEditorCanvasStatus;
  readonly surface: X4UiCanvasSurface | null;
  readonly receipt: X4UiCanvasRenderReceipt | null;
  readonly stale: boolean;
  readonly gameTruth: typeof X4_UI_EDITOR_SESSION_GAME_TRUTH;
  readonly gameVerified: false;
  readonly refusal?: {
    readonly code: X4UiCanvasRenderRefusalCode;
    readonly message: string;
  };
}

type NormalizedInput = {
  readonly raw: JsonRecord;
  readonly selection?: X4UiPreviewSelection;
  readonly profile: X4UiEditorNormalizedProfile;
  readonly issues: readonly string[];
};

const EMPTY_WORKSPACE = Object.freeze({ passthroughFiles: [] }) as unknown as EditorWorkspace;

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasOwn(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isFinitePositive(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isTruthGrade(value: unknown): value is X4UiEditorProfileTruthGrade {
  return value === 'supplied' || value === 'captured' || value === 'unverified-default';
}

function isSourceIdentity(value: unknown): value is X4UiEditorProfileSource {
  if (!isRecord(value) || !isNonEmptyString(value.file) || !isNonEmptyString(value.sha256)
    || !/^[0-9a-fA-F]{64}$/.test(value.sha256)) return false;
  return value.sourcePath === undefined || isNonEmptyString(value.sourcePath);
}

function freezeDeep<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== 'object') return value;
  const objectValue = value as unknown as object;
  if (seen.has(objectValue)) return value;
  seen.add(objectValue);
  for (const child of Object.values(value as unknown as JsonRecord)) freezeDeep(child, seen);
  return Object.freeze(value);
}

function isLayoutScalarType(value: unknown): value is X4UiLayoutScalarType {
  return value === 'number' || value === 'string' || value === 'boolean';
}

function isScalar(value: unknown): value is X4UiLayoutScalar {
  return typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number';
}

const X4_UI_LAYOUT_SAMPLE_OPERATION_KINDS: ReadonlySet<string> = new Set([
  'createFrameHandle',
  'addTable',
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
  'createButton',
  'createIcon',
  'scaleX',
  'scaleY',
  'scaleFont',
]);

function isClosedPlainDataRecord(value: unknown): value is JsonRecord {
  if (!isRecord(value)) return false;
  try {
    return Object.getPrototypeOf(value) === Object.prototype;
  } catch {
    return false;
  }
}

function hasClosedOwnDataFields(value: unknown, required: readonly string[], optional: readonly string[] = []): value is JsonRecord {
  return isClosedPlainDataRecord(value) && hasExactOwnDataFields(value, required, optional);
}

function closedArrayValues(value: unknown): readonly unknown[] | null {
  return denseArrayValues(value);
}

function closedSampleSourceIdentity(value: unknown): value is X4UiLayoutModelIdentity {
  if (!hasClosedOwnDataFields(value, ['file', 'sha256'], ['sourcePath'])) return false;
  const file = dataField(value, 'file');
  const sourcePath = dataField(value, 'sourcePath');
  const sha256 = dataField(value, 'sha256');
  return isNonEmptyString(file)
    && (!hasOwn(value, 'sourcePath') || isNonEmptyString(sourcePath))
    && typeof sha256 === 'string'
    && /^[0-9a-fA-F]{64}$/.test(sha256);
}

function closedSampleSourcePosition(value: unknown): boolean {
  return hasClosedOwnDataFields(value, ['line', 'column', 'offset'])
    && Number.isSafeInteger(dataField(value, 'line'))
    && (dataField(value, 'line') as number) >= 1
    && Number.isSafeInteger(dataField(value, 'column'))
    && (dataField(value, 'column') as number) >= 0
    && Number.isSafeInteger(dataField(value, 'offset'))
    && (dataField(value, 'offset') as number) >= 0;
}

function closedSampleSourceLocation(value: unknown): value is X4UiLayoutModelIdentity & {
  readonly start: { readonly line: number; readonly column: number; readonly offset: number };
  readonly end: { readonly line: number; readonly column: number; readonly offset: number };
} {
  if (!hasClosedOwnDataFields(value, ['file', 'start', 'end'], ['sourcePath'])) return false;
  const start = dataField(value, 'start');
  const end = dataField(value, 'end');
  const sourcePath = dataField(value, 'sourcePath');
  if (!isNonEmptyString(dataField(value, 'file'))
    || (hasOwn(value, 'sourcePath') && !isNonEmptyString(sourcePath))
    || !closedSampleSourcePosition(start)
    || !closedSampleSourcePosition(end)) return false;
  const startOffset = dataField(start as JsonRecord, 'offset') as number;
  const endOffset = dataField(end as JsonRecord, 'offset') as number;
  const startLine = dataField(start as JsonRecord, 'line') as number;
  const endLine = dataField(end as JsonRecord, 'line') as number;
  const startColumn = dataField(start as JsonRecord, 'column') as number;
  const endColumn = dataField(end as JsonRecord, 'column') as number;
  return startOffset <= endOffset
    && (startLine < endLine || (startLine === endLine && startColumn <= endColumn));
}

function sampleSourceMatchesIdentity(
  source: { readonly file: string; readonly sourcePath?: string },
  identity: X4UiLayoutModelIdentity,
): boolean {
  return source.file === identity.file && source.sourcePath === identity.sourcePath;
}

function validateSampleCatalog(
  value: unknown,
):
  | { readonly ok: true; readonly catalog: X4UiLayoutPreviewSampleCatalog }
  | { readonly ok: false; readonly code: 'malformed-catalog' | 'duplicate-catalog-entry'; readonly message: string } {
  if (!hasClosedOwnDataFields(value, ['id', 'sourceIdentity', 'targetId', 'entries'])
    || !isNonEmptyString(dataField(value, 'id'))
    || !closedSampleSourceIdentity(dataField(value, 'sourceIdentity'))
    || !isNonEmptyString(dataField(value, 'targetId'))) {
    return { ok: false, code: 'malformed-catalog', message: 'preview sample catalog is malformed' };
  }
  const sourceIdentity = dataField(value, 'sourceIdentity') as X4UiLayoutModelIdentity;
  const entries = closedArrayValues(dataField(value, 'entries'));
  if (entries === null) return { ok: false, code: 'malformed-catalog', message: 'preview sample catalog entries must be a dense own-data array' };
  const ids = new Set<string>();
  for (const entryValue of entries) {
    if (!hasClosedOwnDataFields(entryValue, ['id', 'expression', 'expectedType', 'source', 'consumers', 'provenance'])
      || !isNonEmptyString(dataField(entryValue, 'id'))
      || !isNonEmptyString(dataField(entryValue, 'expression'))
      || !isLayoutScalarType(dataField(entryValue, 'expectedType'))
      || dataField(entryValue, 'provenance') !== 'preview-only'
      || !closedSampleSourceLocation(dataField(entryValue, 'source'))) {
      return { ok: false, code: 'malformed-catalog', message: 'preview sample catalog contains a malformed entry' };
    }
    const entryId = dataField(entryValue, 'id') as string;
    if (ids.has(entryId)) {
      return { ok: false, code: 'duplicate-catalog-entry', message: `duplicate preview sample catalog ID: ${entryId}` };
    }
    ids.add(entryId);
    const entrySource = dataField(entryValue, 'source') as X4UiLayoutModelIdentity & { readonly start: object; readonly end: object };
    if (!sampleSourceMatchesIdentity(entrySource, sourceIdentity)) {
      return { ok: false, code: 'malformed-catalog', message: `preview sample catalog entry ${entryId} has a foreign source identity` };
    }
    const consumers = closedArrayValues(dataField(entryValue, 'consumers'));
    if (consumers === null || consumers.length === 0) {
      return { ok: false, code: 'malformed-catalog', message: `preview sample catalog entry ${entryId} must have consumers` };
    }
    const consumerKeys = new Set<string>();
    for (const consumerValue of consumers) {
      if (!hasClosedOwnDataFields(consumerValue, ['operationId', 'operationKind', 'field', 'source'])
        || !isNonEmptyString(dataField(consumerValue, 'operationId'))
        || !X4_UI_LAYOUT_SAMPLE_OPERATION_KINDS.has(String(dataField(consumerValue, 'operationKind')))
        || !isNonEmptyString(dataField(consumerValue, 'field'))
        || !closedSampleSourceLocation(dataField(consumerValue, 'source'))) {
        return { ok: false, code: 'malformed-catalog', message: `preview sample catalog entry ${entryId} has a malformed consumer` };
      }
      const consumerSource = dataField(consumerValue, 'source') as X4UiLayoutModelIdentity & { readonly start: object; readonly end: object };
      if (!sampleSourceMatchesIdentity(consumerSource, sourceIdentity)) {
        return { ok: false, code: 'malformed-catalog', message: `preview sample catalog entry ${entryId} has a foreign consumer source identity` };
      }
      const consumerKey = `${String(dataField(consumerValue, 'operationId'))}|${String(dataField(consumerValue, 'field'))}`;
      if (consumerKeys.has(consumerKey)) {
        return { ok: false, code: 'malformed-catalog', message: `preview sample catalog entry ${entryId} has duplicate consumers` };
      }
      consumerKeys.add(consumerKey);
    }
  }
  return { ok: true, catalog: value as unknown as X4UiLayoutPreviewSampleCatalog };
}

function sampleCatalogMatchesProgram(catalog: X4UiLayoutPreviewSampleCatalog, program: unknown): boolean {
  if (!isRecord(program)) return false;
  const target = dataField(program, 'target');
  const targetSourceIdentity = isRecord(target) ? dataField(target, 'sourceIdentity') : undefined;
  return isRecord(target)
    && isNonEmptyString(dataField(target, 'id'))
    && closedSampleSourceIdentity(targetSourceIdentity)
    && dataField(catalog as unknown as JsonRecord, 'targetId') === dataField(target, 'id')
    && sameLayoutIdentity(catalog.sourceIdentity, targetSourceIdentity);
}

function stableDataKey(value: unknown, active = new WeakSet<object>()): string {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (typeof value === 'string') return `string:${JSON.stringify(value)}`;
  if (typeof value === 'number') return `number:${String(value)}`;
  if (typeof value === 'boolean') return `boolean:${String(value)}`;
  if (typeof value !== 'object') return `${typeof value}:${String(value)}`;
  const objectValue = value as object;
  if (active.has(objectValue)) return 'cycle';
  active.add(objectValue);
  let result: string;
  if (Array.isArray(objectValue)) {
    result = `[${denseArrayValues(objectValue)?.map(child => stableDataKey(child, active)).join(',') ?? 'invalid'}]`;
  } else {
    const keys = Reflect.ownKeys(objectValue).filter((key): key is string => typeof key === 'string').sort();
    result = `{${keys.map(key => `${JSON.stringify(key)}:${stableDataKey(dataField(objectValue as JsonRecord, key), active)}`).join(',')}}`;
  }
  active.delete(objectValue);
  return result;
}

function sampleBindingFor(
  preview: X4UiPreviewPipelineResult,
  profile: X4UiEditorNormalizedProfile,
  selection: X4UiPreviewSelection | undefined,
  catalog: X4UiLayoutPreviewSampleCatalog | null,
): X4UiEditorSampleBinding | undefined {
  const programResult = isRecord(preview.program) ? preview.program : null;
  const program = isRecord(programResult?.program) ? programResult.program : null;
  if (catalog === null || program === null) return undefined;
  const target = isRecord(dataField(program, 'target')) ? dataField(program, 'target') : undefined;
  return freezeDeep({
    catalogId: catalog.id,
    programKey: stableDataKey(program),
    profileKey: stableDataKey(profile),
    selectionKey: stableDataKey({
      sourceIndex: selection?.sourceIndex,
      path: selection?.path,
      sourceIdentity: selection?.sourceIdentity,
      target: target ?? selection?.target,
    }),
  });
}

function isSampleBinding(value: unknown): value is X4UiEditorSampleBinding {
  return hasClosedOwnDataFields(value, ['catalogId', 'programKey', 'profileKey', 'selectionKey'])
    && isNonEmptyString(dataField(value, 'catalogId'))
    && isNonEmptyString(dataField(value, 'programKey'))
    && isNonEmptyString(dataField(value, 'profileKey'))
    && isNonEmptyString(dataField(value, 'selectionKey'));
}

export function sameX4UiEditorSampleBinding(left: unknown, right: unknown): boolean {
  if (left === undefined || right === undefined) return left === right;
  if (!isSampleBinding(left) || !isSampleBinding(right)) return false;
  const leftRecord = left as unknown as JsonRecord;
  const rightRecord = right as unknown as JsonRecord;
  return dataField(leftRecord, 'catalogId') === dataField(rightRecord, 'catalogId')
    && dataField(leftRecord, 'programKey') === dataField(rightRecord, 'programKey')
    && dataField(leftRecord, 'profileKey') === dataField(rightRecord, 'profileKey')
    && dataField(leftRecord, 'selectionKey') === dataField(rightRecord, 'selectionKey');
}

type IssuedSampleCatalogAuthority = {
  catalog: X4UiLayoutPreviewSampleCatalog;
  binding: X4UiEditorSampleBinding;
};

const issuedSampleCatalogAuthorities = new WeakMap<object, IssuedSampleCatalogAuthority>();

function issueSampleCatalogAuthority(
  catalog: X4UiLayoutPreviewSampleCatalog,
  binding: X4UiEditorSampleBinding,
): X4UiEditorSampleCatalogAuthority {
  const authority = Object.freeze({ kind: 'x4-ui-editor-sample-catalog-authority' as const });
  issuedSampleCatalogAuthorities.set(authority, { catalog, binding });
  return authority;
}

function issuedSampleCatalogAuthorityFor(value: unknown): IssuedSampleCatalogAuthority | null {
  if (value === null || typeof value !== 'object') return null;
  return issuedSampleCatalogAuthorities.get(value) ?? null;
}

function rebindSampleCatalogAuthority(
  value: unknown,
  catalog: X4UiLayoutPreviewSampleCatalog | null,
  binding: X4UiEditorSampleBinding | undefined,
): X4UiEditorSampleCatalogAuthority | undefined {
  if (catalog === null || binding === undefined) return undefined;
  const record = issuedSampleCatalogAuthorityFor(value);
  if (record === null || !sameX4UiEditorSampleBinding(record.binding, binding)) return undefined;
  record.catalog = catalog;
  record.binding = binding;
  return value as X4UiEditorSampleCatalogAuthority;
}

function sampleCatalogAuthorityMatches(
  catalog: unknown,
  authority: unknown,
): boolean {
  const record = issuedSampleCatalogAuthorityFor(authority);
  return record !== null && record.catalog === catalog;
}

function sameLayoutIdentity(left: X4UiLayoutModelIdentity, right: X4UiLayoutModelIdentity): boolean {
  return left.file === right.file
    && left.sourcePath === right.sourcePath
    && left.sha256 === right.sha256;
}

function sameScalar(left: X4UiLayoutScalar, right: X4UiLayoutScalar): boolean {
  return Object.is(left, right);
}

function sameSampleInput(left: X4UiLayoutPreviewSampleInput, right: X4UiLayoutPreviewSampleInput): boolean {
  return left.catalogId === right.catalogId
    && sameLayoutIdentity(left.source, right.source)
    && left.values.length === right.values.length
    && left.values.every((value, index) => {
      const candidate = right.values[index];
      return candidate !== undefined && candidate.id === value.id && sameScalar(candidate.value, value.value);
    });
}

function sampleInputFor(
  catalog: X4UiLayoutPreviewSampleCatalog,
  values: readonly X4UiLayoutPreviewSampleValue[],
): X4UiEditorSampleState {
  if (values.length === 0) return undefined;
  return freezeDeep({
    catalogId: catalog.id,
    source: {
      file: catalog.sourceIdentity.file,
      ...(catalog.sourceIdentity.sourcePath === undefined ? {} : { sourcePath: catalog.sourceIdentity.sourcePath }),
      sha256: catalog.sourceIdentity.sha256,
    },
    values: values.map(value => ({ id: value.id, value: value.value })),
  });
}

function sampleStateWithout(
  state: X4UiEditorSampleState,
  catalog: X4UiLayoutPreviewSampleCatalog,
  entryId: string,
): { readonly samples: X4UiEditorSampleState; readonly changed: boolean } {
  if (state === undefined) return { samples: undefined, changed: false };
  const values = state.values.filter(value => value.id !== entryId);
  if (values.length === state.values.length) return { samples: state, changed: false };
  return { samples: sampleInputFor(catalog, values), changed: true };
}

/** Parse one raw editor control value without coercing between catalog types. */
export function parseX4UiEditorSampleInput(
  expectedType: X4UiLayoutScalarType,
  raw: unknown,
): X4UiEditorSampleParseResult {
  if (!isLayoutScalarType(expectedType)) {
    return { status: 'refused', code: 'unknown-type', message: 'preview sample type is not declared by the catalog' };
  }
  if (typeof raw !== 'string') {
    return { status: 'refused', code: 'malformed-input', message: 'preview sample input must be a string control value' };
  }
  if (expectedType === 'string') {
    return raw === '' ? { status: 'reset' } : { status: 'accepted', value: raw };
  }
  const trimmed = raw.trim();
  if (trimmed === '') return { status: 'reset' };
  if (expectedType === 'number') {
    const value = Number(trimmed);
    if (Number.isNaN(value)) return { status: 'refused', code: 'malformed-input', message: 'number sample input is malformed' };
    if (!Number.isFinite(value)) return { status: 'refused', code: 'nonfinite-number', message: 'number sample input must be finite' };
    return { status: 'accepted', value };
  }
  if (trimmed === 'true') return { status: 'accepted', value: true };
  if (trimmed === 'false') return { status: 'accepted', value: false };
  return { status: 'refused', code: 'boolean-literal', message: 'boolean sample input must be true or false' };
}

/** Reconcile a preview-only sample state against one exact layout-program catalog. */
export function reconcileX4UiEditorSampleState(
  samples: unknown,
  catalog: unknown,
  authority: unknown,
): X4UiEditorSampleReconciliation {
  if (catalog === null || catalog === undefined) {
    if (samples === undefined) return { status: 'accepted', samples: undefined, changed: false };
    return {
      status: 'cleared',
      samples: undefined,
      changed: true,
      code: 'catalog-unavailable',
      message: 'preview samples were cleared because no selected layout-program catalog is available',
    };
  }
  if (!sampleCatalogAuthorityMatches(catalog, authority)) {
    return {
      status: 'refused',
      samples: undefined,
      changed: true,
      code: 'catalog-authority-required',
      message: 'preview samples require the exact catalog authority issued by the selected editor session',
    };
  }
  const catalogResult = validateSampleCatalog(catalog);
  if (catalogResult.ok === false) {
    return {
      status: 'refused',
      samples: undefined,
      changed: true,
      code: catalogResult.code,
      message: catalogResult.message,
    };
  }
  if (samples === undefined) return { status: 'accepted', samples: undefined, changed: false };
  if (!hasClosedOwnDataFields(samples, ['catalogId', 'source', 'values'])
    || !isNonEmptyString(dataField(samples, 'catalogId'))
    || !closedSampleSourceIdentity(dataField(samples, 'source'))) {
    return {
      status: 'refused',
      samples: undefined,
      changed: true,
      code: 'malformed-samples',
      message: 'preview samples must carry catalogId, exact source identity, and a values array',
    };
  }
  const sampleValues = closedArrayValues(dataField(samples, 'values'));
  if (sampleValues === null) {
    return {
      status: 'refused',
      samples: undefined,
      changed: true,
      code: 'malformed-samples',
      message: 'preview sample values must be a dense own-data array',
    };
  }
  const typedSamples = samples as unknown as X4UiLayoutPreviewSampleInput;
  const sampleCatalogId = dataField(samples, 'catalogId');
  const sampleSource = dataField(samples, 'source');
  if (sampleCatalogId !== catalogResult.catalog.id
    || !sameLayoutIdentity(sampleSource as X4UiLayoutModelIdentity, catalogResult.catalog.sourceIdentity)) {
    return {
      status: 'cleared',
      samples: undefined,
      changed: true,
      code: 'stale-samples',
      message: 'preview samples were cleared because source, target, or selected program identity changed',
    };
  }
  const entriesById = new Map(catalogResult.catalog.entries.map(entry => [entry.id, entry]));
  const seen = new Set<string>();
  const values: X4UiLayoutPreviewSampleValue[] = [];
  for (const value of sampleValues) {
    if (!hasClosedOwnDataFields(value, ['id', 'value']) || !isNonEmptyString(dataField(value, 'id'))) {
      return {
        status: 'refused',
        samples: undefined,
        changed: true,
        code: 'malformed-samples',
        message: 'preview sample values must carry an ID and a scalar value',
      };
    }
    const valueId = dataField(value, 'id') as string;
    const scalarValue = dataField(value, 'value');
    if (seen.has(valueId)) {
      return {
        status: 'refused',
        samples: undefined,
        changed: true,
        code: 'duplicate-sample',
        message: `duplicate preview sample ID: ${valueId}`,
      };
    }
    seen.add(valueId);
    const entry = entriesById.get(valueId);
    if (entry === undefined) {
      return {
        status: 'refused',
        samples: undefined,
        changed: true,
        code: 'unknown-sample',
        message: `unknown or no-longer-catalogued preview sample ID: ${valueId}`,
      };
    }
    if (!isScalar(scalarValue)) {
      return {
        status: 'refused',
        samples: undefined,
        changed: true,
        code: 'malformed-samples',
        message: `preview sample value is not a string, finite number, or boolean: ${valueId}`,
      };
    }
    if (typeof scalarValue === 'number' && !Number.isFinite(scalarValue)) {
      return {
        status: 'refused',
        samples: undefined,
        changed: true,
        code: 'nonfinite-sample',
        message: `preview sample number must be finite: ${valueId}`,
      };
    }
    if (typeof scalarValue !== entry.expectedType) {
      return {
        status: 'refused',
        samples: undefined,
        changed: true,
        code: 'sample-type-mismatch',
        message: `preview sample type mismatch for ${valueId}`,
      };
    }
    values.push({ id: valueId, value: scalarValue });
  }
  const valuesById = new Map(values.map(value => [value.id, value]));
  const orderedValues = catalogResult.catalog.entries
    .map(entry => valuesById.get(entry.id))
    .filter((value): value is X4UiLayoutPreviewSampleValue => value !== undefined);
  if (orderedValues.length === 0) {
    return { status: 'accepted', samples: undefined, changed: true };
  }
  const normalized = sampleInputFor(catalogResult.catalog, orderedValues);
  if (normalized !== undefined && sameSampleInput(typedSamples, normalized)) {
    return { status: 'accepted', samples: typedSamples, changed: false };
  }
  return { status: 'accepted', samples: normalized, changed: true };
}

/** Apply one raw control update, removing refused or reset values deterministically. */
export function updateX4UiEditorSampleState(
  current: X4UiEditorSampleState,
  catalog: unknown,
  entryId: string,
  raw: unknown,
  authority: unknown,
): X4UiEditorSampleUpdateResult {
  const reconciled = reconcileX4UiEditorSampleState(current, catalog, authority);
  if (reconciled.status === 'refused') {
    return {
      status: 'refused',
      samples: reconciled.samples,
      changed: reconciled.changed,
      code: reconciled.code,
      message: reconciled.message,
    };
  }
  const catalogResult = validateSampleCatalog(catalog);
  if (catalogResult.ok === false) {
    return {
      status: 'refused',
      samples: undefined,
      changed: true,
      code: catalogResult.code,
      message: catalogResult.message,
    };
  }
  const entry = catalogResult.catalog.entries.find(candidate => candidate.id === entryId);
  if (entry === undefined) {
    return {
      status: 'refused',
      samples: reconciled.samples,
      changed: reconciled.changed,
      code: 'unknown-sample',
      message: `unknown preview sample ID: ${entryId}`,
    };
  }
  const parsed = parseX4UiEditorSampleInput(entry.expectedType, raw);
  if (parsed.status === 'refused') {
    const removed = sampleStateWithout(reconciled.samples, catalogResult.catalog, entryId);
    return {
      status: 'refused',
      samples: removed.samples,
      changed: reconciled.changed || removed.changed,
      code: parsed.code,
      message: parsed.message,
    };
  }
  if (parsed.status === 'reset') {
    const removed = sampleStateWithout(reconciled.samples, catalogResult.catalog, entryId);
    return { status: 'reset', samples: removed.samples, changed: reconciled.changed || removed.changed };
  }
  const currentValue = reconciled.samples?.values.find(value => value.id === entryId);
  if (currentValue !== undefined && sameScalar(currentValue.value, parsed.value) && !reconciled.changed) {
    return { status: 'accepted', samples: reconciled.samples, changed: false };
  }
  const values = (reconciled.samples?.values ?? []).filter(value => value.id !== entryId);
  values.push({ id: entryId, value: parsed.value });
  const updated = reconcileX4UiEditorSampleState({
    catalogId: catalogResult.catalog.id,
    source: catalogResult.catalog.sourceIdentity,
    values,
  }, catalogResult.catalog, authority);
  if (updated.status !== 'accepted') {
    return {
      status: 'refused',
      samples: updated.samples,
      changed: true,
      code: updated.code,
      message: updated.message,
    };
  }
  return {
    status: 'accepted',
    samples: updated.samples,
    changed: reconciled.changed || updated.changed,
  };
}

function copySource(value: X4UiEditorProfileSource): X4UiEditorProfileSource {
  return {
    file: value.file,
    ...(value.sourcePath === undefined ? {} : { sourcePath: value.sourcePath }),
    sha256: value.sha256,
  };
}

function sameSource(left: X4UiEditorProfileSource, right: X4UiEditorProfileSource): boolean {
  return left.file === right.file && left.sourcePath === right.sourcePath && left.sha256 === right.sha256;
}

function profileFromControls(
  controls: X4UiEditorProfileControls,
  source: X4UiEditorProfileSource,
  id = X4_UI_EDITOR_DEFAULT_PROFILE.id,
  provenance = X4_UI_EDITOR_DEFAULT_PROFILE.provenance,
  truthGrade: X4UiEditorProfileTruthGrade = X4_UI_EDITOR_DEFAULT_PROFILE.truthGrade,
  minTextHeight?: number,
): X4UiEditorNormalizedProfile {
  return freezeDeep({
    id,
    provenance,
    truthGrade,
    source: copySource(source),
    drawable: { width: controls.width, height: controls.height },
    uiScale: controls.uiScale,
    ...(minTextHeight === undefined ? {} : { minTextHeight }),
  });
}

function validControls(value: unknown): value is X4UiEditorProfileControls {
  return isRecord(value)
    && isFinitePositive(value.width)
    && isFinitePositive(value.height)
    && isFinitePositive(value.uiScale);
}

function validFullProfile(value: unknown): value is X4UiEditorProfile {
  return isRecord(value)
    && isNonEmptyString(value.id)
    && isNonEmptyString(value.provenance)
    && isTruthGrade(value.truthGrade)
    && isSourceIdentity(value.source)
    && isRecord(value.drawable)
    && isFinitePositive(value.drawable.width)
    && isFinitePositive(value.drawable.height)
    && isFinitePositive(value.uiScale)
    && (value.minTextHeight === undefined || (typeof value.minTextHeight === 'number' && Number.isFinite(value.minTextHeight) && value.minTextHeight >= 0));
}

function selectionIdentity(value: unknown): X4UiEditorProfileSource | undefined {
  if (!isRecord(value) || !isRecord(value.sourceIdentity) || !isSourceIdentity(value.sourceIdentity)) return undefined;
  return copySource(value.sourceIdentity);
}

function selectionIsUsable(value: unknown): value is X4UiPreviewSelection {
  if (!isRecord(value) || typeof value.sourceIndex !== 'number' || !Number.isSafeInteger(value.sourceIndex) || value.sourceIndex < 0
    || !isNonEmptyString(value.path) || !isSourceIdentity(value.sourceIdentity) || !isRecord(value.target)
    || !isNonEmptyString(value.target.id)) return false;
  return true;
}

function normalizeInput(input: unknown): NormalizedInput {
  const issues: string[] = [];
  const raw = isRecord(input) ? input : {};
  if (!isRecord(input)) issues.push('session input is malformed');

  const rawSelection = hasOwn(raw, 'selection') ? raw.selection : undefined;
  const usableSelection = rawSelection === undefined ? undefined : selectionIsUsable(rawSelection) ? rawSelection : undefined;
  if (rawSelection !== undefined && usableSelection === undefined) issues.push('selection is malformed');

  const source = selectionIdentity(rawSelection) ?? UNSELECTED_SOURCE;
  const rawProfile = hasOwn(raw, 'profile') ? raw.profile : undefined;
  let profile: X4UiEditorNormalizedProfile;
  if (rawProfile === undefined) {
    profile = profileFromControls(
      X4_UI_EDITOR_DEFAULT_PROFILE.drawable && {
        width: X4_UI_EDITOR_DEFAULT_PROFILE.drawable.width,
        height: X4_UI_EDITOR_DEFAULT_PROFILE.drawable.height,
        uiScale: X4_UI_EDITOR_DEFAULT_PROFILE.uiScale,
      },
      source,
    );
  } else if (validControls(rawProfile)) {
    profile = profileFromControls(rawProfile, source);
  } else if (validFullProfile(rawProfile)) {
    const effectiveSource = usableSelection !== undefined && sameSource(rawProfile.source, UNSELECTED_SOURCE)
      ? copySource(usableSelection.sourceIdentity)
      : rawProfile.source;
    profile = profileFromControls(
      {
        width: rawProfile.drawable.width,
        height: rawProfile.drawable.height,
        uiScale: rawProfile.uiScale,
      },
      effectiveSource,
      rawProfile.id,
      rawProfile.provenance,
      rawProfile.truthGrade,
      rawProfile.minTextHeight,
    );
  } else {
    issues.push('profile is malformed');
    profile = profileFromControls(
      {
        width: X4_UI_EDITOR_DEFAULT_PROFILE.drawable.width,
        height: X4_UI_EDITOR_DEFAULT_PROFILE.drawable.height,
        uiScale: X4_UI_EDITOR_DEFAULT_PROFILE.uiScale,
      },
      source,
    );
  }

  if (!hasOwn(raw, 'workspace') || !isRecord(raw.workspace)) issues.push('workspace is malformed');

  const activePreset = raw.activePresetId;
  if (activePreset !== undefined && (typeof activePreset !== 'string' || getKeepOutPreset(activePreset as KeepOutContextPresetId) === undefined)) {
    issues.push('active keep-out preset is unknown');
  }
  if (raw.enabledEntryIds !== undefined
    && (!Array.isArray(raw.enabledEntryIds) || raw.enabledEntryIds.some(value => typeof value !== 'string'))) {
    issues.push('enabled keep-out entries are malformed');
  }

  return {
    raw,
    ...(usableSelection === undefined ? {} : { selection: usableSelection }),
    profile,
    issues,
  };
}

function buildSource(input: NormalizedInput): X4UiWorkspaceSource {
  const workspace = isRecord(input.raw.workspace) ? input.raw.workspace as unknown as EditorWorkspace : EMPTY_WORKSPACE;
  try {
    return buildX4UiWorkspaceSource(workspace);
  } catch {
    return buildX4UiWorkspaceSource(EMPTY_WORKSPACE);
  }
}

function previewFor(
  source: X4UiWorkspaceSource,
  corpus: unknown,
  profile: X4UiEditorNormalizedProfile,
  selection: X4UiPreviewSelection | undefined,
  samples: X4UiLayoutPreviewSampleInput | undefined,
): X4UiPreviewPipelineResult {
  const previewInput: X4UiPreviewPipelineInput = {
    source,
    corpus,
    profile: {
      id: profile.id,
      provenance: profile.provenance,
      truthGrade: profile.truthGrade,
      source: copySource(profile.source),
      drawable: { width: profile.drawable.width, height: profile.drawable.height },
      uiScale: profile.uiScale,
      ...(profile.minTextHeight === undefined ? {} : { minTextHeight: profile.minTextHeight }),
    },
    ...(selection === undefined ? {} : { selection }),
    ...(samples === undefined ? {} : { samples }),
  };
  try {
    return projectX4UiPreviewPipeline(previewInput);
  } catch {
    return projectX4UiPreviewPipeline({
      source,
      corpus: undefined,
      profile: {
        id: X4_UI_EDITOR_DEFAULT_PROFILE.id,
        provenance: X4_UI_EDITOR_DEFAULT_PROFILE.provenance,
        truthGrade: X4_UI_EDITOR_DEFAULT_PROFILE.truthGrade,
        source: copySource(UNSELECTED_SOURCE),
        drawable: { ...X4_UI_EDITOR_DEFAULT_PROFILE.drawable },
        uiScale: X4_UI_EDITOR_DEFAULT_PROFILE.uiScale,
      },
      samples: undefined,
    });
  }
}

function sampleCatalogFor(preview: X4UiPreviewPipelineResult): X4UiLayoutPreviewSampleCatalog | null {
  const programResult = isRecord(preview.program) ? preview.program : null;
  const program = isRecord(programResult?.program) ? programResult.program : null;
  if (program === null) return null;
  const catalogResult = validateSampleCatalog(dataField(program, 'sampleCatalog'));
  if (catalogResult.ok === false || !sampleCatalogMatchesProgram(catalogResult.catalog, program)) return null;
  return catalogResult.catalog;
}

function keepOutProjectionFor(
  member: KeepOutPresetMember,
  viewport: { readonly width: number; readonly height: number },
  enabled: boolean,
): X4UiEditorKeepOutMemberProjection {
  const entry = BUILT_IN_KEEP_OUTS.find(candidate => candidate.id === member.entryId) ?? null;
  let projection: KeepOutProjectionResult;
  try {
    projection = projectBuiltInKeepOut(member.entryId, viewport);
  } catch {
    projection = projectBuiltInKeepOut('__unknown__', viewport);
  }
  return freezeDeep({ ...member, entry, projection, enabled });
}

function keepOutPresetsFor(
  viewport: { readonly width: number; readonly height: number },
  activePresetId: KeepOutContextPresetId | null,
  enabledEntryIds: readonly string[] | undefined,
): readonly X4UiEditorKeepOutPresetProjection[] {
  const enabled = enabledEntryIds === undefined ? undefined : new Set(enabledEntryIds);
  return freezeDeep(KEEP_OUT_PRESETS.map(preset => ({
    id: preset.id,
    label: preset.label,
      members: preset.members.map(member => keepOutProjectionFor(
        member,
        viewport,
        preset.id === activePresetId
        && member.applicability !== 'not-applicable'
        && (enabled === undefined || enabled.has(member.entryId)),
      )),
  })));
}

function safeCanonical(value: unknown): value is X4UiCorpusCanonicalSuccess {
  try {
    return isX4UiCorpusCanonicalSuccess(value);
  } catch {
    return false;
  }
}

function sceneIssued(preview: X4UiPreviewPipelineResult): boolean {
  if ((preview.status !== 'projected' && preview.status !== 'partial') || !isRecord(preview.scene)) return false;
  return preview.scene.status === 'projected' || preview.scene.status === 'partial';
}

function activePaintKeepOuts(
  presets: readonly X4UiEditorKeepOutPresetProjection[],
  activePresetId: KeepOutContextPresetId | null,
): readonly { readonly context: KeepOutContextPresetId; readonly projection: KeepOutProjectionResult }[] {
  if (activePresetId === null) return [];
  const preset = presets.find(candidate => candidate.id === activePresetId);
  if (!preset) return [];
  return preset.members.filter(member => member.enabled).map(member => ({
    context: activePresetId,
    projection: member.projection,
  }));
}

function makeSessionReason(
  issues: readonly string[],
  preview: X4UiPreviewPipelineResult,
  paint: X4UiPaintPlanResult | null,
  canRender: boolean,
): string {
  if (issues.length > 0) return issues.join('; ');
  if (paint?.status === 'refused') return paint.refusal.message;
  if (canRender) return 'preview and paint accepted; Not verified in game';
  if (preview.gaps.length > 0) return preview.gaps[0].reason;
  return preview.selection.reason;
}

/** Project one complete, side-effect-free editor session. */
export function projectX4UiEditorSession(input: X4UiEditorSessionInput): X4UiEditorSessionProjection {
  try {
    const normalized = normalizeInput(input);
    const source = buildSource(normalized);
    const corpus = normalized.raw.corpus;
    const activePresetId = typeof normalized.raw.activePresetId === 'string'
      && getKeepOutPreset(normalized.raw.activePresetId as KeepOutContextPresetId) !== undefined
      ? normalized.raw.activePresetId as KeepOutContextPresetId
      : null;
    const enabledEntryIds = Array.isArray(normalized.raw.enabledEntryIds)
      && normalized.raw.enabledEntryIds.every(value => typeof value === 'string')
      ? Array.from(new Set(normalized.raw.enabledEntryIds))
      : undefined;
    const catalogPreview = previewFor(source, corpus, normalized.profile, normalized.selection, undefined);
    const sampleCatalog = sampleCatalogFor(catalogPreview);
    const sampleBinding = sampleBindingFor(catalogPreview, normalized.profile, normalized.selection, sampleCatalog);
    const issuedSampleCatalogAuthority = sampleCatalog !== null && sampleBinding !== undefined
      ? issueSampleCatalogAuthority(sampleCatalog, sampleBinding)
      : undefined;
    const suppliedSampleCatalogAuthority = hasOwn(normalized.raw, 'sampleCatalogAuthority')
      ? normalized.raw.sampleCatalogAuthority
      : undefined;
    const sampleCatalogAuthority = rebindSampleCatalogAuthority(
      suppliedSampleCatalogAuthority,
      sampleCatalog,
      sampleBinding,
    ) ?? issuedSampleCatalogAuthority;
    const suppliedSamples = hasOwn(normalized.raw, 'samples') ? normalized.raw.samples : undefined;
    const suppliedSampleBinding = hasOwn(normalized.raw, 'sampleBinding')
      ? normalized.raw.sampleBinding
      : undefined;
    let sampleReconciliation: X4UiEditorSampleReconciliation;
    if (suppliedSamples !== undefined
      && sampleBinding !== undefined
      && !sameX4UiEditorSampleBinding(suppliedSampleBinding, sampleBinding)) {
      sampleReconciliation = {
        status: 'cleared',
        samples: undefined,
        changed: true,
        code: 'stale-samples',
        message: 'preview samples were cleared because the selected program or normalized profile identity changed',
      };
    } else {
      const authorityForReconciliation = suppliedSamples === undefined
        ? sampleCatalogAuthority
        : suppliedSampleCatalogAuthority;
      sampleReconciliation = reconcileX4UiEditorSampleState(
        suppliedSamples,
        sampleCatalog,
        authorityForReconciliation,
      );
    }
    const samples = sampleReconciliation.status === 'accepted'
      ? sampleReconciliation.samples
      : undefined;
    const preview = previewFor(source, corpus, normalized.profile, normalized.selection, samples);
    const sessionIssues = sampleReconciliation.status === 'refused'
      ? [...normalized.issues, sampleReconciliation.message]
      : normalized.issues;
    const keepOutPresets = keepOutPresetsFor(normalized.profile.drawable, activePresetId, enabledEntryIds);
    const activeKeepOuts = activePaintKeepOuts(keepOutPresets, activePresetId);
    let paint: X4UiPaintPlanResult | null = null;
    if (sessionIssues.length === 0 && safeCanonical(corpus) && sceneIssued(preview)) {
      try {
        paint = projectX4UiPaintPlan({
          scene: preview.scene,
          corpus,
          previewAuthority: preview,
          keepOuts: activeKeepOuts,
        });
      } catch {
        paint = null;
      }
    }
    const canRender = paint !== null && paint.status !== 'refused';
    const status: X4UiEditorSessionStatus = sessionIssues.length > 0
      ? 'refused'
      : paint?.status === 'refused'
        ? 'refused'
        : preview.status;
    const activePreset = activePresetId === null
      ? null
      : keepOutPresets.find(preset => preset.id === activePresetId) ?? null;
    return freezeDeep({
      status,
      gameTruth: X4_UI_EDITOR_SESSION_GAME_TRUTH,
      gameVerified: false as const,
      normalizedProfile: normalized.profile,
      profile: normalized.profile,
      source,
      preview,
      sampleCatalog,
      sampleCatalogAuthority,
      samples,
      sampleBinding,
      sampleReconciliation,
      keepOutPresets,
      presets: keepOutPresets,
      activePresetId,
      activePreset,
      activeKeepOuts,
      keepOuts: activeKeepOuts,
      paint,
      canRender,
      reason: makeSessionReason(sessionIssues, preview, paint, canRender),
    });
  } catch (error) {
    const fallback = normalizeInput(undefined);
    const source = buildSource(fallback);
    const preview = previewFor(source, undefined, fallback.profile, undefined, undefined);
    const keepOutPresets = keepOutPresetsFor(fallback.profile.drawable, null, undefined);
    return freezeDeep({
      status: 'refused' as const,
      gameTruth: X4_UI_EDITOR_SESSION_GAME_TRUTH,
      gameVerified: false as const,
      normalizedProfile: fallback.profile,
      profile: fallback.profile,
      source,
      preview,
      sampleCatalog: null,
      sampleCatalogAuthority: undefined,
      samples: undefined,
      sampleBinding: undefined,
      sampleReconciliation: { status: 'accepted', samples: undefined, changed: false },
      keepOutPresets,
      presets: keepOutPresets,
      activePresetId: null,
      activePreset: null,
      activeKeepOuts: [],
      keepOuts: [],
      paint: null,
      canRender: false,
      reason: error instanceof Error ? error.message : 'editor session refused malformed input',
    });
  }
}

const CANVAS_GAME_TRUTH = X4_UI_EDITOR_SESSION_GAME_TRUTH;

export const X4_UI_EDITOR_EMPTY_CANVAS_STATE: X4UiEditorCanvasState = Object.freeze({
  status: 'empty',
  surface: null,
  receipt: null,
  stale: false,
  gameTruth: CANVAS_GAME_TRUTH,
  gameVerified: false,
});

const CANVAS_RENDERER_LAYERS = [
  'diagnostic-background',
  'glyph-alpha-blits',
  'diagnostics',
  'keep-out-overlays',
] as const;
const CANVAS_REFUSAL_CODES: ReadonlySet<string> = new Set([
  'invalid-input',
  'input-refused',
  'invalid-result',
  'invalid-plan',
  'invalid-layer',
  'invalid-command',
  'duplicate-command',
  'out-of-order-command',
  'unsupported-command',
  'invalid-truth',
  'invalid-corpus',
  'invalid-font',
  'invalid-atlas',
  'atlas-bounds',
  'invalid-geometry',
  'invalid-clip',
  'invalid-keepout',
  'game-truth',
  'missing-context',
  'allocation-failure',
  'post-validation-mutation',
  'surface-failure',
]);

function surfaceDimensions(value: unknown): { readonly surface: X4UiCanvasSurface; readonly width: number; readonly height: number } | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  try {
    const candidate = value as JsonRecord;
    const width = candidate.width;
    const height = candidate.height;
    if (!isFinitePositive(width) || !isFinitePositive(height) || typeof candidate.getContext !== 'function') return null;
    return { surface: value as X4UiCanvasSurface, width, height };
  } catch {
    return null;
  }
}

function isPlainDataRecord(value: unknown): value is JsonRecord {
  if (!isRecord(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactOwnDataFields(value: unknown, required: readonly string[], optional: readonly string[] = []): value is JsonRecord {
  if (!isPlainDataRecord(value)) return false;
  const allowed = new Set([...required, ...optional]);
  const keys = Reflect.ownKeys(value);
  if (keys.length < required.length || keys.some(key => typeof key !== 'string' || !allowed.has(key))) return false;
  if (!required.every(key => keys.includes(key))) return false;
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !('value' in descriptor) || descriptor.enumerable !== true) return false;
  }
  return true;
}

function dataField(value: JsonRecord, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor !== undefined && 'value' in descriptor ? descriptor.value : undefined;
}

function denseArrayValues(value: unknown): readonly unknown[] | null {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return null;
  const keys = Reflect.ownKeys(value);
  if (!keys.includes('length') || keys.some(key => key !== 'length' && (typeof key !== 'string' || !/^\d+$/.test(key)))) return null;
  const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
  if (lengthDescriptor === undefined || !('value' in lengthDescriptor) || !Number.isSafeInteger(lengthDescriptor.value) || lengthDescriptor.value < 0) return null;
  const length = lengthDescriptor.value;
  const indexKeys = keys.filter(key => key !== 'length');
  if (indexKeys.length !== length) return null;
  const values: unknown[] = [];
  for (let index = 0; index < length; index += 1) {
    const key = String(index);
    if (!indexKeys.includes(key)) return null;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !('value' in descriptor) || descriptor.enumerable !== true) return null;
    values.push(descriptor.value);
  }
  return values;
}

function denseStringArray(value: unknown, unique: boolean): readonly string[] | null {
  const values = denseArrayValues(value);
  if (values === null || !values.every(isNonEmptyString)) return null;
  const strings = values as readonly string[];
  return unique && new Set(strings).size !== strings.length ? null : strings;
}

function validVerification(value: unknown): boolean {
  return hasExactOwnDataFields(value, ['game', 'gameVerified'])
    && dataField(value, 'game') === CANVAS_GAME_TRUTH
    && dataField(value, 'gameVerified') === false;
}

function validTruthReceipt(value: unknown, status: 'rendered' | 'refused', fields: readonly string[]): value is JsonRecord {
  return hasExactOwnDataFields(value, fields)
    && dataField(value, 'format') === X4_UI_CANVAS_RENDERER_FORMAT
    && dataField(value, 'version') === X4_UI_CANVAS_RENDERER_VERSION
    && dataField(value, 'status') === status
    && dataField(value, 'gameTruth') === CANVAS_GAME_TRUTH
    && dataField(value, 'gameVerified') === false
    && validVerification(dataField(value, 'verification'));
}

function refusalMetadata(value: unknown): { readonly code: X4UiCanvasRenderRefusalCode; readonly message: string } | null {
  if (!hasExactOwnDataFields(value, ['code', 'message'])) return null;
  const code = dataField(value, 'code');
  const message = dataField(value, 'message');
  if (typeof code !== 'string' || !CANVAS_REFUSAL_CODES.has(code) || typeof message !== 'string' || message.trim().length === 0) return null;
  return { code: code as X4UiCanvasRenderRefusalCode, message };
}

function renderedReceiptCopy(value: unknown, dimensions: { readonly width: number; readonly height: number }): X4UiCanvasRenderReceipt | null {
  const fields = ['format', 'version', 'status', 'gameTruth', 'gameVerified', 'verification', 'width', 'height', 'layers', 'commandIds', 'commandCount', 'atlasRoles', 'palette'];
  if (!validTruthReceipt(value, 'rendered', fields)) return null;
  const width = dataField(value, 'width');
  const height = dataField(value, 'height');
  if (!isFinitePositive(width) || !isFinitePositive(height) || width !== dimensions.width || height !== dimensions.height) return null;
  const layers = denseStringArray(dataField(value, 'layers'), false);
  if (layers === null || layers.length !== CANVAS_RENDERER_LAYERS.length || !CANVAS_RENDERER_LAYERS.every((layer, index) => layers[index] === layer)) return null;
  const commandIds = denseStringArray(dataField(value, 'commandIds'), true);
  const commandCount = dataField(value, 'commandCount');
  if (commandIds === null || typeof commandCount !== 'number' || !Number.isSafeInteger(commandCount) || commandCount < 0 || commandCount !== commandIds.length) return null;
  const atlasRoles = denseStringArray(dataField(value, 'atlasRoles'), true);
  if (atlasRoles === null || !atlasRoles.every(role => role === 'regular' || role === 'bold')) return null;
  const palette = dataField(value, 'palette');
  if (!hasExactOwnDataFields(palette, ['id', 'diagnosticOnly'])
    || dataField(palette, 'id') !== X4_UI_CANVAS_DIAGNOSTIC_PALETTE.id
    || dataField(palette, 'diagnosticOnly') !== true) return null;
  return freezeDeep({
    format: X4_UI_CANVAS_RENDERER_FORMAT,
    version: X4_UI_CANVAS_RENDERER_VERSION,
    status: 'rendered' as const,
    width,
    height,
    layers: [...CANVAS_RENDERER_LAYERS],
    commandIds: [...commandIds],
    commandCount,
    atlasRoles: [...atlasRoles],
    palette: { id: X4_UI_CANVAS_DIAGNOSTIC_PALETTE.id, diagnosticOnly: true },
    gameTruth: CANVAS_GAME_TRUTH,
    gameVerified: false as const,
    verification: copyVerification(),
  }) as unknown as X4UiCanvasRenderReceipt;
}

function refusedReceiptCopy(value: unknown): X4UiCanvasRenderReceipt | null {
  const fields = ['format', 'version', 'status', 'gameTruth', 'gameVerified', 'verification', 'refusal'];
  if (!validTruthReceipt(value, 'refused', fields)) return null;
  const refusal = refusalMetadata(dataField(value, 'refusal'));
  if (refusal === null) return null;
  return freezeDeep({
    format: X4_UI_CANVAS_RENDERER_FORMAT,
    version: X4_UI_CANVAS_RENDERER_VERSION,
    status: 'refused' as const,
    refusal: { ...refusal },
    gameTruth: CANVAS_GAME_TRUTH,
    gameVerified: false as const,
    verification: copyVerification(),
  }) as unknown as X4UiCanvasRenderReceipt;
}

function copyVerification(): { readonly game: typeof CANVAS_GAME_TRUTH; readonly gameVerified: false } {
  return { game: CANVAS_GAME_TRUTH, gameVerified: false };
}

function renderedResultParts(value: unknown): { readonly surface: X4UiCanvasSurface; readonly receipt: X4UiCanvasRenderReceipt } | null {
  if (!hasExactOwnDataFields(value, ['status', 'surface', 'receipt']) || dataField(value, 'status') !== 'rendered') return null;
  const dimensions = surfaceDimensions(dataField(value, 'surface'));
  if (dimensions === null) return null;
  const receipt = renderedReceiptCopy(dataField(value, 'receipt'), dimensions);
  return receipt === null ? null : { surface: dimensions.surface, receipt };
}

function refusedResultParts(value: unknown): X4UiCanvasRenderReceipt | null {
  if (!hasExactOwnDataFields(value, ['status', 'receipt']) || dataField(value, 'status') !== 'refused') return null;
  return refusedReceiptCopy(dataField(value, 'receipt'));
}

function previousSurfaceForAdoption(value: unknown): X4UiCanvasSurface | null {
  try {
    if (!hasExactOwnDataFields(value, ['status', 'surface', 'receipt', 'stale', 'gameTruth', 'gameVerified'], ['refusal'])) return null;
    const status = dataField(value, 'status');
    const dimensions = surfaceDimensions(dataField(value, 'surface'));
    if ((status !== 'current' && status !== 'stale') || dimensions === null
      || dataField(value, 'stale') !== (status === 'stale')
      || dataField(value, 'gameTruth') !== CANVAS_GAME_TRUTH
      || dataField(value, 'gameVerified') !== false) return null;
    const receipt = dataField(value, 'receipt');
    if (status === 'current') {
      if (hasOwn(value, 'refusal')) return null;
      return renderedReceiptCopy(receipt, dimensions) === null ? null : dimensions.surface;
    }
    const receiptStatus = isPlainDataRecord(receipt) ? dataField(receipt, 'status') : undefined;
    const validReceipt = receiptStatus === 'rendered'
      ? renderedReceiptCopy(receipt, dimensions)
      : receiptStatus === 'refused' ? refusedReceiptCopy(receipt) : null;
    if (receipt !== null && validReceipt === null) return null;
    if (hasOwn(value, 'refusal') && refusalMetadata(dataField(value, 'refusal')) === null) return null;
    return dimensions.surface;
  } catch {
    return null;
  }
}

function canvasState(
  status: X4UiEditorCanvasStatus,
  surface: X4UiCanvasSurface | null,
  receipt: X4UiCanvasRenderReceipt | null,
  stale: boolean,
  refusal?: { readonly code: X4UiCanvasRenderRefusalCode; readonly message: string },
): X4UiEditorCanvasState {
  return Object.freeze({
    status,
    surface,
    receipt,
    stale,
    gameTruth: CANVAS_GAME_TRUTH,
    gameVerified: false as const,
    ...(refusal === undefined ? {} : { refusal: freezeDeep({ ...refusal }) }),
  });
}

/** Apply the renderer's result without ever taking ownership of its surface. */
export function adoptX4UiEditorCanvasResult(
  previous: X4UiEditorCanvasState,
  result: X4UiCanvasRenderResult,
): X4UiEditorCanvasState {
  let previousSurface: X4UiCanvasSurface | null = null;
  try {
    previousSurface = previousSurfaceForAdoption(previous);
    const rendered = renderedResultParts(result);
    if (rendered !== null) return canvasState('current', rendered.surface, rendered.receipt, false);
    const refusedReceipt = refusedResultParts(result);
    const refusal = refusedReceipt?.status === 'refused'
      ? refusedReceipt.refusal
      : { code: 'invalid-result' as const, message: 'renderer result was refused or malformed' };
    return canvasState(previousSurface === null ? 'refused' : 'stale', previousSurface, refusedReceipt, previousSurface !== null, refusal);
  } catch {
    const refusal = { code: 'invalid-result' as const, message: 'renderer result was refused or malformed' };
    return canvasState(previousSurface === null ? 'refused' : 'stale', previousSurface, null, previousSurface !== null, refusal);
  }
}
