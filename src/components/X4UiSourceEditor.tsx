/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  X4_UI_EDITOR_DEFAULT_PROFILE,
  X4_UI_EDITOR_EMPTY_CANVAS_STATE,
  X4_UI_EDITOR_SESSION_GAME_TRUTH,
  X4_UI_EDITOR_UNSELECTED_SOURCE,
  adoptX4UiEditorCanvasResult,
  projectX4UiEditorSession,
  sameX4UiEditorSampleBinding,
  updateX4UiEditorSampleState,
  type X4UiEditorCanvasState,
  type X4UiEditorProfileControls,
  type X4UiEditorSampleBinding,
  type X4UiEditorSampleCatalogAuthority,
  type X4UiEditorSampleState,
  type X4UiEditorSessionInput,
  type X4UiEditorSessionProjection,
} from '../lib/x4UiEditorSession';
import type {
  X4UiLayoutPreviewSampleCatalog,
  X4UiLayoutPreviewSampleInput,
  X4UiLayoutScalar,
} from '../lib/x4UiLayoutProgram';
import {
  X4_UI_CORPUS_FILE_URL,
  X4_UI_CORPUS_MANIFEST_URL,
  X4_UI_CORPUS_STATUS_URL,
  isX4UiCorpusCanonicalColorSuccess,
  isX4UiCorpusCanonicalSuccess,
  loadConfiguredX4UiCorpusAssets,
  loadConfiguredX4UiCorpusColorEvidence,
  type X4UiCorpusCanonicalColorSuccess,
  type X4UiCorpusCanonicalSuccess,
  type X4UiCorpusTransport,
} from '../lib/x4UiCorpusAssets';
import {
  applyX4UiSourceEdit,
  applyX4UiSourceStructuralEdit,
  discoverX4UiSourceEdits,
  type X4UiSourceEditCatalog,
  type X4UiSourceEditCatalogEntry,
  type X4UiSourceEditScalar,
  type X4UiSourceEditInsertBlockEntry,
  type X4UiSourceEditResult,
  type X4UiSourceStructuralEditResult,
} from '../lib/x4UiSourceEdits';
import {
  X4_UI_CANVAS_RENDERER_FORMAT,
  X4_UI_CANVAS_RENDERER_VERSION,
  createX4UiCanvasRenderSession,
  renderX4UiPaintPlanToCanvas,
  type X4UiCanvasRenderResult,
  type X4UiCanvasRenderSession,
  type X4UiCanvasSurface,
  type X4UiCanvasSurfaceFactory,
} from '../lib/x4UiCanvasRenderer';
import { KEEP_OUT_PRESETS } from '../lib/x4UiKeepOuts';
import type { KeepOutCalibrationInput } from '../lib/x4UiKeepOuts';
import {
  buildX4UiGameVerificationCurrentSnapshot,
  type X4UiGameVerificationCurrentSnapshot,
} from '../lib/x4UiGameVerification';

/** The editor deliberately receives the workspace as an opaque session input. */
export interface X4UiSourceEditorProps {
  readonly workspace: unknown;
  readonly corpusLoader?: X4UiSourceEditorCorpusLoader;
  readonly surfaceFactory?: X4UiCanvasSurfaceFactory;
  readonly onWorkspaceEdit?: X4UiWorkspaceEditHandler;
  /** Emits only current plain source/target/profile data; deploy evidence remains parent-owned. */
  readonly onVerificationSnapshotChange?: (snapshot: X4UiGameVerificationCurrentSnapshot | null) => void;
}

export interface X4UiWorkspaceEditRequest {
  readonly expectedWorkspace: unknown;
  readonly workspace: unknown;
}

export type X4UiWorkspaceEditResult =
  | { readonly accepted: true; readonly detail: string }
  | { readonly accepted: false; readonly reason: string; readonly detail: string };

export interface X4UiWorkspaceEditAcknowledgement {
  readonly status: 'accepted' | 'refused';
  readonly attempt: object;
  readonly expectedWorkspace: unknown;
  readonly workspace: unknown;
  readonly currentWorkspace: unknown;
  readonly reason?: 'stale-parent-workspace';
  readonly detail: string;
}

export interface X4UiWorkspaceEditPending {
  readonly status: 'pending';
  readonly attempt: object;
  readonly expectedWorkspace: unknown;
  readonly workspace: unknown;
  readonly acknowledgement: Promise<X4UiWorkspaceEditAcknowledgement>;
  readonly detail: string;
}

export type X4UiWorkspaceEditSubmission =
  | X4UiWorkspaceEditPending
  | { readonly status: 'refused'; readonly reason: string; readonly detail: string };

export type X4UiWorkspaceEditReadback =
  | { readonly status: 'pending'; readonly detail: string }
  | { readonly status: 'accepted'; readonly detail: string }
  | {
    readonly status: 'refused';
    readonly reason: 'stale-parent-workspace' | 'invalid-parent-workspace-acknowledgement';
    readonly detail: string;
  };

export interface X4UiWorkspaceEditPendingAuthority {
  readonly submission: X4UiWorkspaceEditPending;
  readonly acknowledge: (currentWorkspace: unknown) => X4UiWorkspaceEditAcknowledgement;
}

export type X4UiWorkspaceEditHandler = (request: X4UiWorkspaceEditRequest) => X4UiWorkspaceEditSubmission;

export type X4UiSourceEditorCorpusLoader = (input: {
  readonly signal: AbortSignal;
}) => Promise<unknown>;

type ValueRecord = Record<string, unknown>;

type CorpusLoadStatus = 'idle' | 'loading' | 'canonical' | 'unavailable' | 'stale' | 'malformed' | 'refused';

interface CorpusLoadState {
  readonly status: CorpusLoadStatus;
  readonly result: unknown;
  readonly detail: string;
  readonly colorStatus: CorpusLoadStatus;
  readonly colorEvidence?: X4UiCorpusCanonicalColorSuccess;
  readonly colorDetail: string;
}

interface SourceCandidateView {
  readonly raw: ValueRecord;
  readonly index: number;
  readonly path: string;
  readonly key: string;
  readonly sourceIdentity: unknown;
  readonly targets: readonly TargetCandidateView[];
}

interface TargetCandidateView {
  readonly raw: ValueRecord;
  readonly key: string;
  readonly label: string;
}

export interface X4UiEditorSelectionCandidate {
  readonly key: string;
  readonly targets: readonly { readonly key: string }[];
}

export const reconcileX4UiEditorSelections = (input: {
  readonly sourceSelector: string;
  readonly targetSelector: string;
  readonly candidates: readonly X4UiEditorSelectionCandidate[];
}): { readonly sourceSelector: string; readonly targetSelector: string } => {
  if (input.sourceSelector === '') return { sourceSelector: '', targetSelector: '' };
  const source = input.candidates.find(candidate => candidate.key === input.sourceSelector);
  if (source === undefined) return { sourceSelector: '', targetSelector: '' };
  if (input.targetSelector === '') return { sourceSelector: input.sourceSelector, targetSelector: '' };
  const target = source.targets.find(candidate => candidate.key === input.targetSelector);
  return {
    sourceSelector: input.sourceSelector,
    targetSelector: target === undefined ? '' : input.targetSelector,
  };
};

interface ProjectionView {
  readonly status?: string;
  readonly reason?: string;
  readonly normalizedProfile?: unknown;
  readonly source?: ValueRecord;
  readonly preview?: ValueRecord;
  readonly gaps?: readonly unknown[];
  readonly keepOutPresets?: readonly unknown[];
  readonly activePresetId?: string | null;
  readonly activeKeepOuts?: readonly unknown[];
  readonly paint?: unknown;
  readonly canRender?: boolean;
}

interface PreviewView {
  readonly sourceCandidates: readonly unknown[];
  readonly lint: readonly unknown[];
}

export interface X4UiEditorLintFinding {
  readonly filePath: string;
  readonly severity: string;
  readonly code: string;
  readonly location: string;
  readonly message: string;
  readonly failureMode: string;
  readonly evidenceBoundary: string;
  readonly nextAction: string;
}

export type X4UiLintSummaryKind =
  | 'no-source-analyzed'
  | 'static-errors-found'
  | 'static-warnings-found'
  | 'static-checks-incomplete'
  | 'no-known-static-rule-violated';

export interface X4UiLintInspection {
  readonly sourceAnalyzed: boolean;
  readonly findings: readonly X4UiEditorLintFinding[];
  readonly incompleteFindingCount: number;
  readonly diagnosticCount: number;
  readonly verificationGapCount: number;
  readonly lintErrorCount: number;
  readonly truncated: boolean;
}

export interface X4UiLintSummary {
  readonly kind: X4UiLintSummaryKind;
  readonly label: string;
}

export type X4UiPreviewGeometryCategory = 'height' | 'width';

export interface X4UiPreviewGeometryPosition {
  readonly line: number;
  readonly column: number;
  readonly offset: number | null;
}

export interface X4UiPreviewGeometryRange {
  readonly start: X4UiPreviewGeometryPosition;
  readonly end: X4UiPreviewGeometryPosition;
}

export interface X4UiPreviewGeometryDiagnostic {
  readonly category: X4UiPreviewGeometryCategory;
  readonly status: string;
  readonly file: string;
  readonly range: X4UiPreviewGeometryRange;
  readonly reason: string;
  readonly nodeId?: string;
}

export type X4UiPreviewGeometryInspectionState = 'available' | 'empty' | 'unavailable' | 'incomplete';

export interface X4UiPreviewGeometryInspection {
  readonly state: X4UiPreviewGeometryInspectionState;
  readonly sceneStatus: string;
  readonly diagnostics: readonly X4UiPreviewGeometryDiagnostic[];
  readonly diagnosticCount: number;
  readonly incompleteCount: number;
  readonly detail: string;
}

const EMPTY_CORPUS_STATE: CorpusLoadState = Object.freeze({
  status: 'idle',
  result: null,
  detail: 'Configured corpus has not loaded yet.',
  colorStatus: 'idle',
  colorDetail: 'Configured canonical-default color evidence has not loaded yet.',
});

const asRecord = (value: unknown): ValueRecord | null => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as ValueRecord
    : null
);

const asArray = (value: unknown): readonly unknown[] => Array.isArray(value) ? value : [];

const stringValue = (value: unknown, fallback = 'unavailable'): string => (
  typeof value === 'string' && value.length > 0 ? value : fallback
);

const finiteValue = (value: unknown): number | null => (
  typeof value === 'number' && Number.isFinite(value) ? value : null
);

const positiveValue = (value: unknown): number | null => {
  const number = finiteValue(value);
  return number !== null && number > 0 ? number : null;
};

export type X4UiSourceEditorScaleMode =
  | 'derived-from-x4-user-scale'
  | 'custom-effective-helper-scale';

export const X4_UI_SOURCE_EDITOR_SCALE_MODE_DERIVED: X4UiSourceEditorScaleMode = 'derived-from-x4-user-scale';
export const X4_UI_SOURCE_EDITOR_SCALE_MODE_CUSTOM: X4UiSourceEditorScaleMode = 'custom-effective-helper-scale';
export const X4_UI_SOURCE_EDITOR_DEFAULT_USER_SCALE = 1.05;

const X4_UI_SOURCE_EDITOR_REFERENCE_HEIGHT = 1080;

const positiveScaleResult = (value: number): number | null => (
  Number.isFinite(value) && value > 0 ? value : null
);

export const deriveX4UiEffectiveScale = (
  userScale: unknown,
  drawableHeight: unknown,
): number | null => {
  const user = positiveValue(userScale);
  const height = positiveValue(drawableHeight);
  if (user === null || height === null) return null;
  const directResult = (user * height) / X4_UI_SOURCE_EDITOR_REFERENCE_HEIGHT;
  if (Number.isFinite(directResult)) return positiveScaleResult(directResult);
  return positiveScaleResult(user * (height / X4_UI_SOURCE_EDITOR_REFERENCE_HEIGHT));
};

export const deriveX4UiUserScale = (
  effectiveScale: unknown,
  drawableHeight: unknown,
): number | null => {
  const effective = positiveValue(effectiveScale);
  const height = positiveValue(drawableHeight);
  if (effective === null || height === null) return null;
  const directResult = (effective * X4_UI_SOURCE_EDITOR_REFERENCE_HEIGHT) / height;
  if (Number.isFinite(directResult)) return positiveScaleResult(directResult);
  const result = (effective / height) * X4_UI_SOURCE_EDITOR_REFERENCE_HEIGHT;
  return positiveScaleResult(result);
};

const boolValue = (value: unknown): boolean => value === true;

const sourceIdentityKey = (identity: unknown): string => {
  const record = asRecord(identity);
  return [
    stringValue(record?.file, 'no-file'),
    stringValue(record?.sourcePath, 'no-source-path'),
    stringValue(record?.sha256, 'no-sha256'),
  ].join('|');
};

const sourceKeyFor = (candidate: ValueRecord, index: number): string => (
  [
    index,
    stringValue(candidate.path, 'unavailable'),
    sourceIdentityKey(candidate.sourceIdentity),
    String(boolValue(candidate.registered)),
    String(boolValue(candidate.editable)),
    stringValue(candidate.parseStatus, 'unavailable'),
    stringValue(candidate.verificationStatus, 'unavailable'),
  ].join(':')
);

const targetKeyFor = (candidate: ValueRecord, index: number): string => (
  `${index}:${stringValue(candidate.id, 'unavailable')}:${stringValue(candidate.kind, 'unavailable')}`
);

const sourceCandidatesFor = (preview: PreviewView): readonly SourceCandidateView[] => (
  preview.sourceCandidates.map((value, index) => {
    const candidate = asRecord(value) ?? {};
    const targets = asArray(candidate.targets).flatMap((targetValue, targetIndex) => {
      const target = asRecord(targetValue);
      if (target === null) return [];
      return [{
        raw: target,
        key: targetKeyFor(target, targetIndex),
        label: stringValue(target.name, stringValue(target.id, `target ${targetIndex + 1}`)),
      }];
    });
    return {
      raw: candidate,
      index: finiteValue(candidate.index) ?? index,
      path: stringValue(candidate.path, `source ${index + 1}`),
      key: sourceKeyFor(candidate, index),
      sourceIdentity: candidate.sourceIdentity,
      targets,
    };
  })
);

const previewFor = (projection: X4UiEditorSessionProjection): PreviewView => {
  const view = projection as unknown as ProjectionView;
  const preview = asRecord(view.preview) ?? {};
  return {
    sourceCandidates: asArray(preview.sourceCandidates),
    lint: asArray(preview.lint),
  };
};

const projectionFor = (projection: X4UiEditorSessionProjection): ProjectionView => (
  projection as unknown as ProjectionView
);

const boundedCorpusTransport: X4UiCorpusTransport = async (input, init) => {
  const path = input.startsWith('/') ? input.split(/[?#]/, 1)[0] : '';
  const allowed: ReadonlySet<string> = new Set([
    X4_UI_CORPUS_STATUS_URL,
    X4_UI_CORPUS_MANIFEST_URL,
    X4_UI_CORPUS_FILE_URL,
  ]);
  if (!allowed.has(path)) {
    throw new Error('Configured corpus transport refused an unknown endpoint.');
  }
  if (typeof globalThis.fetch !== 'function') {
    throw new Error('Configured corpus transport is unavailable in this browser.');
  }
  return globalThis.fetch(input, { signal: init?.signal, cache: 'no-store' });
};

export interface X4UiSourceEditorCorpusEnvelope {
  readonly core: unknown;
  readonly color: unknown;
}

export type X4UiSourceEditorCorpusBranchLoader = (input: {
  readonly transport: X4UiCorpusTransport;
  readonly signal: AbortSignal;
}) => Promise<unknown>;

export interface X4UiSourceEditorCorpusEnvelopeOptions {
  readonly transport: X4UiCorpusTransport;
  readonly signal: AbortSignal;
  readonly coreLoader?: X4UiSourceEditorCorpusBranchLoader;
  readonly colorLoader?: X4UiSourceEditorCorpusBranchLoader;
}

const rejectedCorpusLoaderResult = (authority: 'core' | 'color', signal: AbortSignal): unknown => ({
  ok: false,
  error: {
    code: signal.aborted ? 'aborted' : 'internal-error',
    stage: 'consistency',
    message: signal.aborted
      ? `Configured canonical ${authority} loader was aborted.`
      : `Configured canonical ${authority} loader rejected before producing evidence.`,
  },
});

export const loadX4UiSourceEditorCorpusEnvelope = async ({
  transport,
  signal,
  coreLoader,
  colorLoader,
}: X4UiSourceEditorCorpusEnvelopeOptions): Promise<X4UiSourceEditorCorpusEnvelope> => {
  const resolvedCoreLoader = coreLoader ?? ((input: { readonly transport: X4UiCorpusTransport; readonly signal: AbortSignal }) => loadConfiguredX4UiCorpusAssets(input));
  const resolvedColorLoader = colorLoader ?? ((input: { readonly transport: X4UiCorpusTransport; readonly signal: AbortSignal }) => loadConfiguredX4UiCorpusColorEvidence(input));
  const corePromise = Promise.resolve().then(() => resolvedCoreLoader({ transport, signal }));
  const colorPromise = Promise.resolve().then(() => resolvedColorLoader({ transport, signal }));
  const [core, color] = await Promise.allSettled([corePromise, colorPromise]);
  return {
    core: core.status === 'fulfilled' ? core.value : rejectedCorpusLoaderResult('core', signal),
    color: color.status === 'fulfilled' ? color.value : rejectedCorpusLoaderResult('color', signal),
  };
};

const defaultCorpusLoader: X4UiSourceEditorCorpusLoader = ({ signal }) => (
  loadX4UiSourceEditorCorpusEnvelope({ transport: boundedCorpusTransport, signal })
);

const defaultSurfaceFactory: X4UiCanvasSurfaceFactory = (width, height) => {
  if (typeof document === 'undefined') return undefined;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
};

type CorpusFailureStatus = Exclude<CorpusLoadStatus, 'idle' | 'loading' | 'canonical'>;

interface CorpusFailureClassification {
  readonly status: CorpusFailureStatus;
  readonly detail: string;
  readonly aborted: boolean;
}

interface OwnDataField {
  readonly present: boolean;
  readonly valid: boolean;
  readonly value?: unknown;
}

const ownEnumerableDataField = (value: unknown, key: string): OwnDataField => {
  if (value === null || typeof value !== 'object') return { present: false, valid: false };
  try {
    const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined) return { present: false, valid: true };
    if (!descriptor.enumerable || !('value' in descriptor)) return { present: true, valid: false };
    return { present: true, valid: true, value: descriptor.value };
  } catch {
    return { present: true, valid: false };
  }
};

const ownDataString = (value: unknown, key: string): string | undefined => {
  const field = ownEnumerableDataField(value, key);
  return field.present && field.valid && typeof field.value === 'string' && field.value.length > 0
    ? field.value
    : undefined;
};

const ownPlainRecord = (value: unknown): ValueRecord | null => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  try {
    const prototype = Reflect.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null ? value as ValueRecord : null;
  } catch {
    return null;
  }
};

const usableOwnDataString = (value: unknown, key: string): string | undefined => {
  const text = ownDataString(value, key);
  return text !== undefined && text.trim().length > 0 ? text : undefined;
};

const previewGeometryPositionFor = (value: unknown): X4UiPreviewGeometryPosition | null => {
  if (ownPlainRecord(value) === null) return null;
  const lineField = ownEnumerableDataField(value, 'line');
  const columnField = ownEnumerableDataField(value, 'column');
  if (!lineField.present || !lineField.valid || !columnField.present || !columnField.valid) return null;
  const line = finiteValue(lineField.value);
  const column = finiteValue(columnField.value);
  if (line === null || column === null || !Number.isInteger(line) || !Number.isInteger(column) || line < 1 || column < 0) return null;
  const offsetField = ownEnumerableDataField(value, 'offset');
  let offset: number | null = null;
  if (offsetField.present) {
    if (!offsetField.valid) return null;
    const parsedOffset = finiteValue(offsetField.value);
    if (parsedOffset === null || !Number.isInteger(parsedOffset) || parsedOffset < 0) return null;
    offset = parsedOffset;
  }
  return { line, column, offset };
};

const previewGeometryRangeFor = (source: unknown): X4UiPreviewGeometryRange | null => {
  if (ownPlainRecord(source) === null) return null;
  const file = usableOwnDataString(source, 'file');
  if (file === undefined) return null;
  const rangeField = ownEnumerableDataField(source, 'range');
  if (rangeField.present && !rangeField.valid) return null;
  const range = rangeField.present ? ownPlainRecord(rangeField.value) : source;
  if (range === null) return null;
  const startField = ownEnumerableDataField(range, 'start');
  const endField = ownEnumerableDataField(range, 'end');
  if (!startField.present || !startField.valid || !endField.present || !endField.valid) return null;
  const start = previewGeometryPositionFor(startField.value);
  const end = previewGeometryPositionFor(endField.value);
  if (start === null || end === null) return null;
  if (end.line < start.line || (end.line === start.line && end.column < start.column)) return null;
  if (start.offset !== null && end.offset !== null && end.offset < start.offset) return null;
  return { start, end };
};

const PREVIEW_GEOMETRY_SCENE_STATUSES = new Set(['partial', 'projected']);

const hasPreviewGeometryVerification = (value: unknown): boolean => {
  if (ownPlainRecord(value) === null) return false;
  const gameField = ownEnumerableDataField(value, 'game');
  const gameVerifiedField = ownEnumerableDataField(value, 'gameVerified');
  return gameField.present
    && gameField.valid
    && gameField.value === X4_UI_EDITOR_SESSION_GAME_TRUTH
    && gameVerifiedField.present
    && gameVerifiedField.valid
    && gameVerifiedField.value === false;
};

const unavailablePreviewGeometryInspection = (detail: string, sceneStatus = 'unavailable'): X4UiPreviewGeometryInspection => ({
  state: 'unavailable',
  sceneStatus,
  diagnostics: [],
  diagnosticCount: 0,
  incompleteCount: 0,
  detail,
});

const previewGeometryPositionKey = (position: X4UiPreviewGeometryPosition): string => (
  `${position.line}:${position.column}:${position.offset === null ? '' : position.offset}`
);

const previewGeometryDiagnosticKey = (diagnostic: X4UiPreviewGeometryDiagnostic): string => JSON.stringify([
  diagnostic.nodeId ?? '',
  diagnostic.category,
  diagnostic.status,
  diagnostic.file,
  previewGeometryPositionKey(diagnostic.range.start),
  previewGeometryPositionKey(diagnostic.range.end),
  diagnostic.reason,
]);

const comparePreviewGeometryText = (left: string, right: string): number => (
  left < right ? -1 : left > right ? 1 : 0
);

const comparePreviewGeometryPosition = (left: X4UiPreviewGeometryPosition, right: X4UiPreviewGeometryPosition): number => (
  left.line - right.line
  || left.column - right.column
  || (left.offset ?? Number.MAX_SAFE_INTEGER) - (right.offset ?? Number.MAX_SAFE_INTEGER)
);

const comparePreviewGeometryDiagnostics = (
  left: X4UiPreviewGeometryDiagnostic,
  right: X4UiPreviewGeometryDiagnostic,
): number => (
  comparePreviewGeometryText(left.file, right.file)
  || comparePreviewGeometryPosition(left.range.start, right.range.start)
  || comparePreviewGeometryPosition(left.range.end, right.range.end)
  || comparePreviewGeometryText(left.category, right.category)
  || comparePreviewGeometryText(left.status, right.status)
  || comparePreviewGeometryText(left.nodeId ?? '', right.nodeId ?? '')
  || comparePreviewGeometryText(left.reason, right.reason)
);

export const inspectX4UiPreviewGeometry = (sceneResult: unknown): X4UiPreviewGeometryInspection => {
  const resultRecord = ownPlainRecord(sceneResult);
  if (resultRecord === null) return unavailablePreviewGeometryInspection('Scene result evidence is unavailable or malformed.');
  const resultStatusField = ownEnumerableDataField(resultRecord, 'status');
  if (!resultStatusField.present || !resultStatusField.valid || typeof resultStatusField.value !== 'string') {
    return unavailablePreviewGeometryInspection('Scene result evidence has no usable own-data status.');
  }
  const resultStatus = resultStatusField.value;
  if (!PREVIEW_GEOMETRY_SCENE_STATUSES.has(resultStatus)) {
    return unavailablePreviewGeometryInspection(`Scene result evidence is ${resultStatus}; source-linked geometry diagnostics are unavailable.`, resultStatus);
  }
  const verificationField = ownEnumerableDataField(resultRecord, 'verification');
  if (!verificationField.present || !verificationField.valid || !hasPreviewGeometryVerification(verificationField.value)) {
    return unavailablePreviewGeometryInspection('Scene result verification is missing or malformed.', resultStatus);
  }
  const sceneField = ownEnumerableDataField(resultRecord, 'scene');
  if (!sceneField.present || !sceneField.valid) {
    return unavailablePreviewGeometryInspection('Scene result has no usable own-data nested Scene.', resultStatus);
  }
  const sceneRecord = ownPlainRecord(sceneField.value);
  if (sceneRecord === null) {
    return unavailablePreviewGeometryInspection('Scene result nested Scene is unavailable or malformed.', resultStatus);
  }
  const sceneStatusField = ownEnumerableDataField(sceneRecord, 'status');
  if (!sceneStatusField.present || !sceneStatusField.valid || typeof sceneStatusField.value !== 'string' || !PREVIEW_GEOMETRY_SCENE_STATUSES.has(sceneStatusField.value)) {
    return unavailablePreviewGeometryInspection('Nested Scene has no usable own-data projected/partial status.', resultStatus);
  }
  const sceneStatus = sceneStatusField.value;
  const gapsField = ownEnumerableDataField(sceneRecord, 'gaps');
  if (!gapsField.present || !gapsField.valid || !Array.isArray(gapsField.value)) {
    return unavailablePreviewGeometryInspection('Scene evidence has no usable own-data gap list.', sceneStatus);
  }

  const diagnostics: X4UiPreviewGeometryDiagnostic[] = [];
  let incompleteCount = 0;
  const gapValues = gapsField.value;
  for (let gapIndex = 0; gapIndex < gapValues.length; gapIndex += 1) {
    const gapField = ownEnumerableDataField(gapValues, String(gapIndex));
    if (!gapField.present || !gapField.valid) {
      incompleteCount += 1;
      continue;
    }
    const gapValue = gapField.value;
    if (gapValue === null || typeof gapValue !== 'object' || Array.isArray(gapValue)) {
      incompleteCount += 1;
      continue;
    }
    const categoryField = ownEnumerableDataField(gapValue, 'category');
    if (!categoryField.present) continue;
    if (!categoryField.valid) {
      incompleteCount += 1;
      continue;
    }
    if (categoryField.value !== 'height' && categoryField.value !== 'width') continue;
    if (ownPlainRecord(gapValue) === null) {
      incompleteCount += 1;
      continue;
    }
    const status = usableOwnDataString(gapValue, 'status');
    const reason = usableOwnDataString(gapValue, 'reason');
    const sourceField = ownEnumerableDataField(gapValue, 'source');
    const source = sourceField.present && sourceField.valid ? sourceField.value : null;
    const range = previewGeometryRangeFor(source);
    if (status === undefined || reason === undefined || range === null) {
      incompleteCount += 1;
      continue;
    }
    const nodeIdField = ownEnumerableDataField(gapValue, 'nodeId');
    if (nodeIdField.present && (
      !nodeIdField.valid
      || typeof nodeIdField.value !== 'string'
      || nodeIdField.value.trim().length === 0
    )) {
      incompleteCount += 1;
      continue;
    }
    const nodeId = nodeIdField.present ? nodeIdField.value as string : undefined;
    const diagnostic: X4UiPreviewGeometryDiagnostic = {
      category: categoryField.value,
      status,
      file: usableOwnDataString(source, 'file') ?? 'unavailable',
      range,
      reason,
      ...(nodeId === undefined ? {} : { nodeId }),
    };
    if (diagnostic.file === 'unavailable') {
      incompleteCount += 1;
      continue;
    }
    diagnostics.push(diagnostic);
  }

  const uniqueDiagnostics: X4UiPreviewGeometryDiagnostic[] = [];
  const diagnosticKeys = new Set<string>();
  for (const diagnostic of diagnostics) {
    const key = previewGeometryDiagnosticKey(diagnostic);
    if (diagnosticKeys.has(key)) continue;
    diagnosticKeys.add(key);
    uniqueDiagnostics.push(diagnostic);
  }
  uniqueDiagnostics.sort(comparePreviewGeometryDiagnostics);
  const diagnosticCount = uniqueDiagnostics.length;
  const state: X4UiPreviewGeometryInspectionState = incompleteCount > 0
    ? 'incomplete'
    : diagnosticCount > 0
      ? 'available'
      : 'empty';
  return {
    state,
    sceneStatus,
    diagnostics: uniqueDiagnostics,
    diagnosticCount,
    incompleteCount,
    detail: incompleteCount > 0
      ? `${incompleteCount} source-linked height/width candidate${incompleteCount === 1 ? '' : 's'} were malformed and are not rendered.`
      : diagnosticCount > 0
        ? `${diagnosticCount} source-linked height/width diagnostic${diagnosticCount === 1 ? '' : 's'} accepted in stable source order.`
        : 'No source-linked height/width diagnostics are available in this Scene.',
  };
};

const corpusFailure = (value: unknown, fallbackDetail = 'Configured corpus evidence was not accepted.'): CorpusFailureClassification => {
  let failure: unknown;
  for (const key of ['failure', 'refusal', 'error']) {
    const field = ownEnumerableDataField(value, key);
    if (field.present && field.valid) {
      failure = field.value;
      break;
    }
    if (field.present && !field.valid) {
      return { status: 'refused', detail: fallbackDetail, aborted: false };
    }
  }
  const code = (ownDataString(failure, 'code') ?? ownDataString(value, 'code') ?? 'refused').toLowerCase();
  const detail = ownDataString(failure, 'message') ?? ownDataString(value, 'message') ?? fallbackDetail;
  if (code === 'aborted') return { status: 'unavailable', detail, aborted: true };
  if (code === 'offline' || code === 'network' || code === 'file-http' || code === 'manifest-http' || code === 'status-http'
    || code === 'status-unavailable' || code === 'manifest-unavailable' || code === 'manifest-pending'
    || code === 'internal-error') {
    return { status: 'unavailable', detail, aborted: false };
  }
  if (code === 'stale' || code === 'generation-drift' || code === 'status-stale') {
    return { status: 'stale', detail, aborted: false };
  }
  if (code.includes('malformed') || code === 'content-type' || code === 'unexpected-content-type') {
    return { status: 'malformed', detail, aborted: false };
  }
  return { status: 'refused', detail, aborted: false };
};

type CorpusEnvelopeSnapshot =
  | { readonly kind: 'direct' }
  | { readonly kind: 'envelope'; readonly core: unknown; readonly colorPresent: boolean; readonly color?: unknown }
  | { readonly kind: 'refused'; readonly detail: string };

const snapshotCorpusEnvelope = (value: unknown): CorpusEnvelopeSnapshot => {
  if (value === null || typeof value !== 'object') return { kind: 'direct' };
  try {
    if (Reflect.getPrototypeOf(value) !== Object.prototype) {
      return { kind: 'refused', detail: 'Configured corpus envelope must have the plain object prototype.' };
    }
    const keys = Reflect.ownKeys(value);
    const envelopeShaped = keys.some(key => key === 'core' || key === 'color');
    if (!envelopeShaped) return { kind: 'direct' };
    if (!keys.includes('core') || keys.some(key => key !== 'core' && key !== 'color')) {
      return { kind: 'refused', detail: 'Configured corpus envelope has inherited, missing, or decorated authority fields.' };
    }
    const coreDescriptor = Reflect.getOwnPropertyDescriptor(value, 'core');
    if (coreDescriptor === undefined || !coreDescriptor.enumerable || !('value' in coreDescriptor)) {
      return { kind: 'refused', detail: 'Configured corpus core authority must be an own enumerable data field.' };
    }
    const colorPresent = keys.includes('color');
    if (!colorPresent) return { kind: 'envelope', core: coreDescriptor.value, colorPresent: false };
    const colorDescriptor = Reflect.getOwnPropertyDescriptor(value, 'color');
    if (colorDescriptor === undefined || !colorDescriptor.enumerable || !('value' in colorDescriptor)) {
      return { kind: 'refused', detail: 'Configured corpus color authority must be an own enumerable data field.' };
    }
    return {
      kind: 'envelope',
      core: coreDescriptor.value,
      colorPresent: true,
      color: colorDescriptor.value,
    };
  } catch {
    return { kind: 'refused', detail: 'Configured corpus envelope reflection was refused.' };
  }
};

const canonicalCoreSuccess = (value: unknown): value is X4UiCorpusCanonicalSuccess => {
  try {
    return isX4UiCorpusCanonicalSuccess(value);
  } catch {
    return false;
  }
};

const canonicalColorSuccess = (value: unknown): value is X4UiCorpusCanonicalColorSuccess => {
  try {
    return isX4UiCorpusCanonicalColorSuccess(value);
  } catch {
    return false;
  }
};

export interface X4UiCorpusLoadResultClassification {
  readonly status: CorpusLoadStatus | 'ignored';
  readonly accepted: boolean;
  readonly result: X4UiCorpusCanonicalSuccess | null;
  readonly detail: string;
  readonly colorStatus: CorpusLoadStatus;
  readonly colorEvidence?: X4UiCorpusCanonicalColorSuccess;
  readonly colorDetail: string;
}

export const classifyX4UiCorpusLoadResult = (input: {
  readonly result: unknown;
  readonly loaderIssued: boolean;
  readonly signalAborted: boolean;
  readonly requestActive: boolean;
  readonly requestGeneration: number;
  readonly currentGeneration: number;
}): X4UiCorpusLoadResultClassification => {
  const ignored = (): X4UiCorpusLoadResultClassification => ({
    status: 'ignored',
    accepted: false,
    result: null,
    detail: 'Ignored aborted, late, or non-loader corpus evidence.',
    colorStatus: 'unavailable',
    colorDetail: 'Ignored aborted, late, or non-loader canonical-default color evidence.',
  });
  if (!input.loaderIssued || input.signalAborted || !input.requestActive || input.requestGeneration !== input.currentGeneration) {
    return ignored();
  }

  const snapshot = snapshotCorpusEnvelope(input.result);
  if (snapshot.kind === 'refused') {
    return {
      status: 'refused',
      accepted: false,
      result: null,
      detail: snapshot.detail,
      colorStatus: 'refused',
      colorDetail: snapshot.detail,
    };
  }

  if (snapshot.kind === 'direct') {
    if (canonicalCoreSuccess(input.result)) {
      return {
        status: 'canonical',
        accepted: true,
        result: input.result,
        detail: 'Loader-issued canonical X4 corpus accepted.',
        colorStatus: 'unavailable',
        colorDetail: 'Configured canonical-default color evidence was not supplied.',
      };
    }
    const failure = corpusFailure(input.result);
    if (failure.aborted) return ignored();
    return {
      status: failure.status,
      accepted: false,
      result: null,
      detail: failure.detail,
      colorStatus: 'unavailable',
      colorDetail: 'Configured canonical-default color evidence was not supplied.',
    };
  }

  const coreAccepted = canonicalCoreSuccess(snapshot.core);
  const coreFailure = coreAccepted
    ? undefined
    : corpusFailure(snapshot.core, 'Configured canonical core evidence was not accepted.');
  const colorAccepted = snapshot.colorPresent && canonicalColorSuccess(snapshot.color);
  const colorFailure = snapshot.colorPresent && !colorAccepted
    ? corpusFailure(snapshot.color, 'Configured canonical-default color evidence was not accepted.')
    : undefined;
  if (coreFailure?.aborted) return ignored();

  if (!coreAccepted) {
    return {
      status: coreFailure?.status ?? 'refused',
      accepted: false,
      result: null,
      detail: coreFailure?.detail ?? 'Configured canonical core evidence was not accepted.',
      colorStatus: colorAccepted ? 'canonical' : colorFailure?.status ?? 'unavailable',
      colorDetail: colorAccepted
        ? 'Loader-issued canonical-default color evidence was accepted but withheld because canonical core evidence is unavailable.'
        : colorFailure?.detail ?? 'Configured canonical-default color evidence was not supplied.',
    };
  }

  if (colorAccepted) {
    return {
      status: 'canonical',
      accepted: true,
      result: snapshot.core,
      detail: 'Loader-issued canonical X4 corpus accepted.',
      colorStatus: 'canonical',
      colorEvidence: snapshot.color,
      colorDetail: 'Loader-issued canonical-default color evidence accepted.',
    };
  }

  return {
    status: 'canonical',
    accepted: true,
    result: snapshot.core,
    detail: 'Loader-issued canonical X4 corpus accepted.',
    colorStatus: colorFailure?.status ?? 'unavailable',
    colorDetail: colorFailure?.detail ?? 'Configured canonical-default color evidence was not supplied.',
  };
};

const profileScale = (profile: X4UiEditorProfileControls): number | null => (
  positiveValue(asRecord(profile)?.uiScale)
);

const formatNumber = (value: unknown): string => {
  const number = finiteValue(value);
  return number === null ? 'unavailable' : String(number);
};

const findingLocation = (finding: ValueRecord): string | null => {
  const locationValue = finding.sourceLocation ?? finding.location ?? finding.source;
  if (typeof locationValue === 'string' && locationValue.trim().length > 0) return locationValue;
  const location = asRecord(locationValue);
  const path = typeof location?.path === 'string' && location.path.trim().length > 0
    ? location.path
    : typeof location?.file === 'string' && location.file.trim().length > 0
      ? location.file
      : null;
  if (path === null) return null;
  const line = finiteValue(location?.line) ?? finiteValue(finding.line);
  const column = finiteValue(location?.column) ?? finiteValue(finding.column);
  if (line === null) return path;
  return `${path}:${line}${column === null ? '' : `:${column}`}`;
};

const requiredFindingValue = (finding: ValueRecord, key: string): string | null => {
  const value = finding[key];
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
};

const normalizeFinding = (finding: ValueRecord, filePath: string): X4UiEditorLintFinding | null => {
  const location = findingLocation(finding);
  const severity = requiredFindingValue(finding, 'severity');
  const code = requiredFindingValue(finding, 'code');
  const message = requiredFindingValue(finding, 'message');
  const failureMode = requiredFindingValue(finding, 'failureMode');
  const evidenceBoundary = requiredFindingValue(finding, 'evidenceBoundary');
  const nextAction = requiredFindingValue(finding, 'nextAction');
  if (location === null || severity === null || code === null || message === null || failureMode === null || evidenceBoundary === null || nextAction === null) return null;
  return {
    filePath,
    severity,
    code,
    location,
    message,
    failureMode,
    evidenceBoundary,
    nextAction,
  };
};

const lintInspectionFor = (preview: PreviewView): X4UiLintInspection => {
  const findings: X4UiEditorLintFinding[] = [];
  const findingKeys = new Set<string>();
  let incompleteFindingCount = 0;
  let diagnosticCount = 0;
  let verificationGapCount = 0;
  let lintErrorCount = 0;
  let truncated = false;
  for (const fileValue of preview.lint) {
    const file = asRecord(fileValue) ?? {};
    const lint = asRecord(file.lint);
    const filePath = stringValue(file.path, 'source file unavailable');
    if (file.diagnostics !== undefined && !Array.isArray(file.diagnostics)) incompleteFindingCount += 1;
    if (file.verificationGaps !== undefined && !Array.isArray(file.verificationGaps)) incompleteFindingCount += 1;
    const diagnostics = asArray(file.diagnostics);
    const verificationGaps = asArray(file.verificationGaps);
    diagnosticCount += diagnostics.length;
    verificationGapCount += verificationGaps.length;
    if (file.lintError !== undefined && file.lintError !== null) lintErrorCount += 1;
    const lintSummary = asRecord(lint?.x4UiSummary) ?? asRecord(file.x4UiSummary);
    const unverifiedCount = finiteValue(lintSummary?.unverifiedCount) ?? 0;
    const truncatedCount = finiteValue(lintSummary?.truncatedCount) ?? 0;
    verificationGapCount += unverifiedCount;
    truncated = truncated || file.truncated === true || lint?.truncated === true || truncatedCount > 0;
    if (lint === null) {
      incompleteFindingCount += 1;
      continue;
    }
    if (!Array.isArray(lint.findings)) {
      incompleteFindingCount += 1;
      continue;
    }
    const normalizedFindings = lint.findings;
    for (const findingValueRaw of normalizedFindings) {
      const finding = asRecord(findingValueRaw);
      if (finding === null) {
        incompleteFindingCount += 1;
        continue;
      }
      const normalized = normalizeFinding(finding, filePath);
      if (normalized === null) {
        incompleteFindingCount += 1;
        continue;
      }
      const key = [
        normalized.filePath,
        normalizedLintToken(normalized.severity),
        normalized.code,
        normalized.location,
        normalized.message,
        normalized.failureMode,
        normalized.evidenceBoundary,
        normalized.nextAction,
      ].join('\u001f');
      if (findingKeys.has(key)) continue;
      findingKeys.add(key);
      findings.push(normalized);
    }
  }
  return {
    sourceAnalyzed: preview.lint.length > 0,
    findings,
    incompleteFindingCount,
    diagnosticCount,
    verificationGapCount,
    lintErrorCount,
    truncated,
  };
};

export const inspectX4UiLint = (preview: { readonly lint: readonly unknown[] }): X4UiLintInspection => (
  lintInspectionFor({ sourceCandidates: [], lint: preview.lint })
);

export const classifyX4UiLintState = (inspection: X4UiLintInspection): X4UiLintSummary => {
  if (!inspection.sourceAnalyzed) return { kind: 'no-source-analyzed', label: 'No source analyzed' };
  const severities = inspection.findings.map(finding => finding.severity.trim().toLowerCase());
  if (severities.some(severity => severity === 'error' || severity === 'fatal')) {
    return { kind: 'static-errors-found', label: 'Static errors found' };
  }
  if (severities.some(severity => severity === 'warning' || severity === 'warn')) {
    return { kind: 'static-warnings-found', label: 'Static warnings found' };
  }
  if (inspection.incompleteFindingCount > 0
    || inspection.diagnosticCount > 0
    || inspection.verificationGapCount > 0
    || inspection.lintErrorCount > 0
  || inspection.truncated) {
    return { kind: 'static-checks-incomplete', label: 'Static checks incomplete' };
  }
  return { kind: 'no-known-static-rule-violated', label: 'No known static rule violated' };
};

const normalizedLintToken = (value: string): string => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');

export const isBlockingX4UiAddTableFinding = (finding: X4UiEditorLintFinding): boolean => {
  const code = normalizedLintToken(finding.code);
  const severity = normalizedLintToken(finding.severity);
  const evidence = normalizedLintToken(finding.evidenceBoundary);
  const failureMode = normalizedLintToken(finding.failureMode);
  return code === normalizedLintToken('x4-ui.add-table-column-limit')
    && severity === 'error'
    && failureMode.includes('entireframe')
    && evidence.includes('24failed');
};

const keepOutEvidence = (member: ValueRecord | null): string => {
  const entry = asRecord(member?.entry);
  const geometry = asRecord(entry?.geometry);
  if (geometry?.kind === 'horizontal-guide') return `y=${formatNumber(geometry.y)}`;
  if (geometry?.kind === 'vertical-guide') return `x=${formatNumber(geometry.x)}`;
  return 'unavailable/unmeasured; no rectangle inferred';
};

const keepOutMemberFor = (presetValue: unknown, entryId: string): ValueRecord | null => {
  const preset = asRecord(presetValue);
  const member = asArray(preset?.members).find(value => asRecord(value)?.entryId === entryId);
  return asRecord(member);
};

export const toggleX4UiKeepOutEntry = (
  activePresetId: string | null,
  originatingPresetId: string,
  enabledEntryIds: readonly string[],
  entryId: string,
  presets: readonly { readonly id: string; readonly members: readonly { readonly entryId: string }[] }[],
): readonly string[] => {
  if (activePresetId === null || originatingPresetId !== activePresetId) return enabledEntryIds;
  const activePreset = presets.find(preset => preset.id === activePresetId);
  if (activePreset === undefined || !activePreset.members.some(member => member.entryId === entryId)) return enabledEntryIds;
  return enabledEntryIds.includes(entryId)
    ? enabledEntryIds.filter(value => value !== entryId)
    : [...enabledEntryIds, entryId];
};

export const isX4UiKeepOutEntryChecked = (
  activePresetId: string | null,
  presetId: string,
  enabledEntryIds: readonly string[],
  entryId: string,
): boolean => activePresetId === presetId && enabledEntryIds.includes(entryId);

export interface X4UiManualCalibrationPointDraft {
  readonly x: string;
  readonly y: string;
}

export interface X4UiManualCalibrationDraft {
  readonly stableId: string;
  readonly context: string;
  readonly sourceNote: string;
  readonly screenshotHash: string;
  readonly profile: string;
  readonly drawableLeft: string;
  readonly drawableTop: string;
  readonly drawableWidth: string;
  readonly drawableHeight: string;
  readonly points: readonly X4UiManualCalibrationPointDraft[];
}

export interface X4UiManualCalibrationRow {
  readonly rowId: string;
  readonly draft: X4UiManualCalibrationDraft;
}

export interface X4UiManualCalibrationState {
  readonly draft: X4UiManualCalibrationDraft;
  readonly rows: readonly X4UiManualCalibrationRow[];
  readonly enabledManualRowIds: readonly string[];
}

export type X4UiManualCalibrationDraftField = Exclude<keyof X4UiManualCalibrationDraft, 'points'>;

export type X4UiManualCalibrationDraftRefusal = {
  readonly accepted: false;
  readonly reason: 'malformed-draft' | 'invalid-number';
  readonly message: string;
};

export type X4UiManualCalibrationDraftResult =
  | { readonly accepted: true; readonly input: KeepOutCalibrationInput }
  | X4UiManualCalibrationDraftRefusal;

export type X4UiManualCalibrationSessionRefusalReason =
  | X4UiManualCalibrationDraftRefusal['reason']
  | 'duplicate-stable-id';

export interface X4UiManualCalibrationSessionInput {
  readonly manualCalibrations: readonly KeepOutCalibrationInput[];
  readonly enabledManualEntryIds: readonly string[];
  readonly acceptedRowIds: readonly string[];
  readonly refusedRows: readonly {
    readonly rowId: string;
    readonly reason: X4UiManualCalibrationSessionRefusalReason;
    readonly message: string;
  }[];
}

const manualCalibrationInitialPoints = (): readonly X4UiManualCalibrationPointDraft[] => [
  { x: '0', y: '0' },
  { x: '100', y: '0' },
  { x: '0', y: '100' },
];

export const createX4UiManualCalibrationDraft = (): X4UiManualCalibrationDraft => ({
  stableId: '',
  context: '',
  sourceNote: '',
  screenshotHash: '',
  profile: '',
  drawableLeft: '0',
  drawableTop: '0',
  drawableWidth: String(X4_UI_EDITOR_DEFAULT_PROFILE.drawable.width),
  drawableHeight: String(X4_UI_EDITOR_DEFAULT_PROFILE.drawable.height),
  points: manualCalibrationInitialPoints(),
});

export const createX4UiManualCalibrationState = (): X4UiManualCalibrationState => ({
  draft: createX4UiManualCalibrationDraft(),
  rows: [],
  enabledManualRowIds: [],
});

const copyManualCalibrationDraft = (draft: X4UiManualCalibrationDraft): X4UiManualCalibrationDraft => ({
  ...draft,
  points: draft.points.map(point => ({ x: point.x, y: point.y })),
});

export const updateX4UiManualCalibrationDraft = (
  draft: X4UiManualCalibrationDraft,
  field: X4UiManualCalibrationDraftField,
  value: string,
): X4UiManualCalibrationDraft => draft[field] === value
  ? draft
  : { ...draft, [field]: value } as X4UiManualCalibrationDraft;

export const updateX4UiManualCalibrationPoint = (
  draft: X4UiManualCalibrationDraft,
  index: number,
  axis: 'x' | 'y',
  value: string,
): X4UiManualCalibrationDraft => {
  if (!Number.isSafeInteger(index) || index < 0 || index >= draft.points.length) return draft;
  const point = draft.points[index];
  if (point[axis] === value) return draft;
  const points = draft.points.map((candidate, candidateIndex) => candidateIndex === index
    ? { ...candidate, [axis]: value }
    : candidate);
  return { ...draft, points };
};

export const addX4UiManualCalibrationPoint = (
  draft: X4UiManualCalibrationDraft,
): X4UiManualCalibrationDraft => ({
  ...draft,
  points: [...draft.points, { x: '', y: '' }],
});

export const removeX4UiManualCalibrationPoint = (
  draft: X4UiManualCalibrationDraft,
  index: number,
): X4UiManualCalibrationDraft => {
  if (!Number.isSafeInteger(index) || index < 0 || index >= draft.points.length) return draft;
  return {
    ...draft,
    points: [...draft.points.slice(0, index), ...draft.points.slice(index + 1)],
  };
};

const manualCalibrationNumber = (
  raw: unknown,
  label: string,
): { readonly accepted: true; readonly value: number } | { readonly accepted: false; readonly message: string } => {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return { accepted: false, message: `${label} must be a non-empty finite number.` };
  }
  const value = Number(raw);
  return Number.isFinite(value)
    ? { accepted: true, value }
    : { accepted: false, message: `${label} must be a non-empty finite number.` };
};

export const parseX4UiManualCalibrationDraft = (
  draft: X4UiManualCalibrationDraft,
): X4UiManualCalibrationDraftResult => {
  try {
    const numericFields = [
      ['drawable left', draft.drawableLeft],
      ['drawable top', draft.drawableTop],
      ['drawable width', draft.drawableWidth],
      ['drawable height', draft.drawableHeight],
    ] as const;
    const numericValues: number[] = [];
    for (const [label, raw] of numericFields) {
      const result = manualCalibrationNumber(raw, label);
      if ('message' in result) return { accepted: false, reason: 'invalid-number', message: result.message };
      numericValues.push(result.value);
    }
    if (!Array.isArray(draft.points)) {
      return { accepted: false, reason: 'malformed-draft', message: 'Manual calibration points must be a dense draft array.' };
    }
    const points: { readonly x: number; readonly y: number }[] = [];
    for (let index = 0; index < draft.points.length; index += 1) {
      const point = draft.points[index];
      if (point === undefined || point === null || typeof point !== 'object') {
        return { accepted: false, reason: 'malformed-draft', message: `Manual calibration point ${index + 1} is malformed.` };
      }
      const x = manualCalibrationNumber(point.x, `point ${index + 1} x`);
      if ('message' in x) return { accepted: false, reason: 'invalid-number', message: x.message };
      const y = manualCalibrationNumber(point.y, `point ${index + 1} y`);
      if ('message' in y) return { accepted: false, reason: 'invalid-number', message: y.message };
      points.push({ x: x.value, y: y.value });
    }
    if (typeof draft.stableId !== 'string'
      || typeof draft.context !== 'string'
      || typeof draft.sourceNote !== 'string'
      || typeof draft.screenshotHash !== 'string'
      || typeof draft.profile !== 'string') {
      return { accepted: false, reason: 'malformed-draft', message: 'Manual calibration text fields must be strings.' };
    }
    return {
      accepted: true,
      input: {
        stableId: draft.stableId,
        context: draft.context,
        sourceNote: draft.sourceNote,
        screenshotHash: draft.screenshotHash,
        profile: draft.profile,
        drawableBounds: {
          left: numericValues[0],
          top: numericValues[1],
          width: numericValues[2],
          height: numericValues[3],
        },
        points,
      },
    };
  } catch {
    return { accepted: false, reason: 'malformed-draft', message: 'Manual calibration draft was malformed.' };
  }
};

const nextManualCalibrationRowId = (rows: readonly X4UiManualCalibrationRow[]): string => {
  const used = new Set(rows.map(row => row.rowId));
  let ordinal = rows.length + 1;
  let rowId = `manual-calibration-row-${ordinal}`;
  while (used.has(rowId)) {
    ordinal += 1;
    rowId = `manual-calibration-row-${ordinal}`;
  }
  return rowId;
};

export const addX4UiManualCalibrationDraft = (
  state: X4UiManualCalibrationState,
  draft = state.draft,
): X4UiManualCalibrationState => ({
  draft: createX4UiManualCalibrationDraft(),
  rows: [
    ...state.rows,
    { rowId: nextManualCalibrationRowId(state.rows), draft: copyManualCalibrationDraft(draft) },
  ],
  enabledManualRowIds: state.enabledManualRowIds,
});

const manualCalibrationRowStableId = (row: X4UiManualCalibrationRow): string => row.draft.stableId;

export const setX4UiManualCalibrationRowEnabled = (
  state: X4UiManualCalibrationState,
  rowId: string,
  enabled: boolean,
): X4UiManualCalibrationState => {
  const row = state.rows.find(candidate => candidate.rowId === rowId);
  if (row === undefined || row.draft.stableId.trim().length === 0) return state;
  const alreadyEnabled = state.enabledManualRowIds.includes(rowId);
  if (alreadyEnabled === enabled) return state;
  return {
    ...state,
    enabledManualRowIds: enabled
      ? [...state.enabledManualRowIds, rowId]
      : state.enabledManualRowIds.filter(value => value !== rowId),
  };
};

export const toggleX4UiManualCalibrationRow = (
  state: X4UiManualCalibrationState,
  rowId: string,
): X4UiManualCalibrationState => {
  const row = state.rows.find(candidate => candidate.rowId === rowId);
  if (row === undefined || row.draft.stableId.trim().length === 0) return state;
  return setX4UiManualCalibrationRowEnabled(
    state,
    rowId,
    !state.enabledManualRowIds.includes(rowId),
  );
};

export const removeX4UiManualCalibrationRow = (
  state: X4UiManualCalibrationState,
  rowId: string,
): X4UiManualCalibrationState => {
  const rowIndex = state.rows.findIndex(candidate => candidate.rowId === rowId);
  if (rowIndex < 0) return state;
  const rows = [...state.rows.slice(0, rowIndex), ...state.rows.slice(rowIndex + 1)];
  const removedRowWasEnabled = state.enabledManualRowIds.includes(rowId);
  return {
    ...state,
    rows,
    enabledManualRowIds: removedRowWasEnabled
      ? state.enabledManualRowIds.filter(value => value !== rowId)
      : state.enabledManualRowIds,
  };
};

export const buildX4UiManualCalibrationSessionInput = (
  state: X4UiManualCalibrationState,
): X4UiManualCalibrationSessionInput => {
  const stableIdCounts = new Map<string, number>();
  for (const row of state.rows) {
    const stableId = manualCalibrationRowStableId(row);
    if (stableId.trim().length === 0) continue;
    stableIdCounts.set(stableId, (stableIdCounts.get(stableId) ?? 0) + 1);
  }
  const ambiguousStableIds = new Set(
    [...stableIdCounts.entries()]
      .filter(([, count]) => count > 1)
      .map(([stableId]) => stableId),
  );
  const manualCalibrations: KeepOutCalibrationInput[] = [];
  const enabledManualEntryIds: string[] = [];
  const acceptedRowIds: string[] = [];
  const refusedRows: X4UiManualCalibrationSessionInput['refusedRows'][number][] = [];
  for (const row of state.rows) {
    const stableId = manualCalibrationRowStableId(row);
    const ambiguous = ambiguousStableIds.has(stableId);
    const parsed = parseX4UiManualCalibrationDraft(row.draft);
    if (ambiguous) {
      refusedRows.push({
        rowId: row.rowId,
        reason: 'duplicate-stable-id',
        message: `Manual calibration stable ID is duplicated locally: ${stableId}.`,
      });
    }
    if ('input' in parsed) {
      manualCalibrations.push(parsed.input);
      acceptedRowIds.push(row.rowId);
      if (
        !ambiguous
        && parsed.input.stableId.trim().length > 0
        && state.enabledManualRowIds.includes(row.rowId)
      ) {
        enabledManualEntryIds.push(parsed.input.stableId);
      }
    } else if (!ambiguous) {
      refusedRows.push({ rowId: row.rowId, reason: parsed.reason, message: parsed.message });
    }
  }
  return {
    manualCalibrations,
    enabledManualEntryIds,
    acceptedRowIds,
    refusedRows,
  };
};

export interface X4UiCanvasStateDescription {
  readonly status: 'empty' | 'current' | 'stale' | 'refused';
  readonly label: string;
  readonly detail: string;
}

export const classifyX4UiCanvasState = (state: X4UiEditorCanvasState): X4UiCanvasStateDescription => {
  const value = asRecord(state);
  const refusal = asRecord(value?.refusal);
  switch (state.status) {
    case 'current':
      return {
        status: 'current',
        label: 'rendered/current',
        detail: 'Rendered/current bitmap is mounted from the accepted raw paint plan.',
      };
    case 'stale':
      return {
        status: 'stale',
        label: 'stale',
        detail: stringValue(refusal?.message, 'Previously rendered bitmap retained; the latest canvas state is stale.'),
      };
    case 'refused':
      return {
        status: 'refused',
        label: 'refused',
        detail: stringValue(refusal?.message, 'Latest canvas render was refused; no replacement was mounted.'),
      };
    case 'empty':
      return {
        status: 'empty',
        label: 'empty',
        detail: 'No rendered bitmap yet.',
      };
  }
};

const sessionRefusalResult = (reason: string): X4UiCanvasRenderResult => ({
  status: 'refused',
  receipt: {
    format: X4_UI_CANVAS_RENDERER_FORMAT,
    version: X4_UI_CANVAS_RENDERER_VERSION,
    status: 'refused',
    gameTruth: X4_UI_EDITOR_SESSION_GAME_TRUTH,
    gameVerified: false,
    verification: {
      game: X4_UI_EDITOR_SESSION_GAME_TRUTH,
      gameVerified: false,
    },
    refusal: {
      code: 'input-refused',
      message: reason,
    },
  },
});

export interface X4UiCanvasCommitDecision {
  readonly nextState: X4UiEditorCanvasState;
  readonly replaceSurface?: X4UiCanvasSurface;
  readonly discardSurface?: X4UiCanvasSurface;
}

export const classifyX4UiCanvasCommit = (
  previous: X4UiEditorCanvasState,
  result: X4UiCanvasRenderResult,
): X4UiCanvasCommitDecision => {
  const nextState = adoptX4UiEditorCanvasResult(previous, result);
  if (result.status !== 'rendered'
    || nextState.status !== 'current'
    || nextState.surface !== result.surface
    || nextState.stale) {
    return result.status === 'rendered'
      ? { nextState, discardSurface: result.surface }
      : { nextState };
  }
  return { nextState, replaceSurface: result.surface };
};

export interface X4UiCanvasExportInput {
  readonly state: unknown;
  readonly mountedCanvas: unknown;
  readonly currentIdentity: unknown;
  readonly committedIdentity: unknown;
}

export interface X4UiCanvasExportClassification {
  readonly status: 'available' | 'refused';
  readonly detail: string;
  readonly filename?: string;
  readonly identityKey?: string;
  readonly width?: number;
  readonly height?: number;
}

const canvasExportRefusal = (detail: string): X4UiCanvasExportClassification => ({
  status: 'refused',
  detail,
});

const safePositiveInteger = (value: unknown): number | null => (
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : null
);

const canvasExportIdentityFor = (value: unknown): X4UiGameVerificationCurrentSnapshot | null => {
  const record = asRecord(value);
  if (record === null) return null;
  const sourceIdentity = ownEnumerableDataField(record, 'sourceIdentity');
  const targetIdentity = ownEnumerableDataField(record, 'targetIdentity');
  const normalizedProfile = ownEnumerableDataField(record, 'normalizedProfile');
  if (!sourceIdentity.present || !sourceIdentity.valid
    || !targetIdentity.present || !targetIdentity.valid
    || !normalizedProfile.present || !normalizedProfile.valid) return null;
  return buildX4UiGameVerificationCurrentSnapshot({
    sourceIdentity: sourceIdentity.value,
    targetIdentity: targetIdentity.value,
    normalizedProfile: normalizedProfile.value,
  });
};

const canvasExportIdentityKey = (value: X4UiGameVerificationCurrentSnapshot): string | null => {
  try {
    const serialized = JSON.stringify(value);
    return typeof serialized === 'string' ? serialized : null;
  } catch {
    return null;
  }
};

const canvasExportToken = (value: string, fallback: string): string => {
  let normalized = value;
  try {
    normalized = value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  } catch {
    normalized = value;
  }
  const token = normalized
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[.-]+|[.-]+$/g, '')
    .slice(0, 96);
  return token.length > 0 ? token : fallback;
};

const canvasExportFilenameFor = (identity: X4UiGameVerificationCurrentSnapshot): string | null => {
  try {
    const sourceFile = canvasExportToken(identity.sourceIdentity.file, 'source');
    const targetRecord = asRecord(identity.targetIdentity);
    const targetId = targetRecord === null ? undefined : targetRecord.id;
    if (typeof targetId !== 'string' || targetId.length === 0) return null;
    const profile = asRecord(identity.normalizedProfile);
    const drawable = asRecord(profile?.drawable);
    const width = safePositiveInteger(drawable?.width);
    const height = safePositiveInteger(drawable?.height);
    const uiScale = finiteValue(profile?.uiScale);
    if (width === null || height === null || uiScale === null || uiScale <= 0) return null;
    return `x4-ui-${sourceFile}-${canvasExportToken(targetId, 'target')}-${width}x${height}-effective-scale-${canvasExportToken(String(uiScale), 'scale')}.png`;
  } catch {
    return null;
  }
};

const renderedCanvasReceiptFor = (
  value: unknown,
): { readonly width: number; readonly height: number } | null => {
  const receipt = asRecord(value);
  if (receipt === null) return null;
  const required = [
    'format',
    'version',
    'status',
    'gameTruth',
    'gameVerified',
    'verification',
    'width',
    'height',
    'layers',
    'commandIds',
    'commandCount',
    'atlasRoles',
    'palette',
  ];
  try {
    const keys = Reflect.ownKeys(receipt);
    if (keys.length !== required.length || required.some(key => !keys.includes(key))) return null;
    if (receipt.format !== X4_UI_CANVAS_RENDERER_FORMAT
      || receipt.version !== X4_UI_CANVAS_RENDERER_VERSION
      || receipt.status !== 'rendered'
      || receipt.gameTruth !== X4_UI_EDITOR_SESSION_GAME_TRUTH
      || receipt.gameVerified !== false) return null;
    const verification = asRecord(receipt.verification);
    if (verification === null || verification.game !== X4_UI_EDITOR_SESSION_GAME_TRUTH || verification.gameVerified !== false) return null;
    const width = safePositiveInteger(receipt.width);
    const height = safePositiveInteger(receipt.height);
    if (width === null || height === null) return null;
    if (!Array.isArray(receipt.layers)
      || receipt.layers.length !== 4
      || receipt.layers.some((layer, index) => layer !== ['diagnostic-background', 'glyph-alpha-blits', 'diagnostics', 'keep-out-overlays'][index])) return null;
    if (!Array.isArray(receipt.commandIds)
      || receipt.commandIds.some(commandId => typeof commandId !== 'string')
      || receipt.commandCount !== receipt.commandIds.length) return null;
    if (!Array.isArray(receipt.atlasRoles)
      || receipt.atlasRoles.some(role => role !== 'regular' && role !== 'bold')) return null;
    const palette = asRecord(receipt.palette);
    if (palette === null || palette.id !== 'diagnostic-only' || palette.diagnosticOnly !== true) return null;
    return { width, height };
  } catch {
    return null;
  }
};

export const classifyX4UiCanvasExport = (
  input: X4UiCanvasExportInput,
): X4UiCanvasExportClassification => {
  try {
    const state = asRecord(input.state);
    if (state === null
      || state.status !== 'current'
      || state.stale !== false
      || state.gameTruth !== X4_UI_EDITOR_SESSION_GAME_TRUTH
      || state.gameVerified !== false
      || Object.prototype.hasOwnProperty.call(state, 'refusal')) {
      return canvasExportRefusal('Current rendered canvas evidence is unavailable or stale.');
    }
    const surface = state.surface;
    const canvasConstructor = typeof HTMLCanvasElement === 'undefined' ? null : HTMLCanvasElement;
    if (canvasConstructor === null || !(input.mountedCanvas instanceof canvasConstructor)) {
      return canvasExportRefusal('The current mounted surface is not an HTMLCanvasElement.');
    }
    if (surface === null || surface !== input.mountedCanvas) {
      return canvasExportRefusal('The mounted canvas is not the current renderer surface.');
    }
    const receipt = renderedCanvasReceiptFor(state.receipt);
    if (receipt === null) return canvasExportRefusal('The current renderer receipt is malformed or refused.');
    const canvasWidth = safePositiveInteger(input.mountedCanvas.width);
    const canvasHeight = safePositiveInteger(input.mountedCanvas.height);
    if (canvasWidth === null || canvasHeight === null || canvasWidth !== receipt.width || canvasHeight !== receipt.height) {
      return canvasExportRefusal('Mounted canvas dimensions do not match the current renderer receipt.');
    }
    const currentIdentity = canvasExportIdentityFor(input.currentIdentity);
    const committedIdentity = canvasExportIdentityFor(input.committedIdentity);
    if (currentIdentity === null || committedIdentity === null) {
      return canvasExportRefusal('Current source, target, or profile identity is unavailable.');
    }
    const currentKey = canvasExportIdentityKey(currentIdentity);
    const committedKey = canvasExportIdentityKey(committedIdentity);
    if (currentKey === null || committedKey === null || currentKey !== committedKey) {
      return canvasExportRefusal('Current source, target, or profile identity superseded the mounted canvas.');
    }
    const profile = asRecord(currentIdentity.normalizedProfile);
    const drawable = asRecord(profile?.drawable);
    const profileWidth = safePositiveInteger(drawable?.width);
    const profileHeight = safePositiveInteger(drawable?.height);
    if (profileWidth === null || profileHeight === null || profileWidth !== receipt.width || profileHeight !== receipt.height) {
      return canvasExportRefusal('Current profile dimensions do not match the mounted renderer receipt.');
    }
    const filename = canvasExportFilenameFor(currentIdentity);
    if (filename === null) return canvasExportRefusal('Current source, target, or profile cannot produce a safe filename.');
    return {
      status: 'available',
      detail: 'Current rendered canvas is eligible for native PNG export.',
      filename,
      identityKey: currentKey,
      width: receipt.width,
      height: receipt.height,
    };
  } catch {
    return canvasExportRefusal('Current canvas export evidence was malformed and was refused.');
  }
};

const setCompletedBitmapStyle = (surface: X4UiCanvasSurface): void => {
  if (!(surface instanceof HTMLElement)) return;
  surface.style.maxWidth = '100%';
  surface.style.maxHeight = '100%';
  surface.style.width = 'auto';
  surface.style.height = 'auto';
  surface.style.objectFit = 'contain';
  surface.style.imageRendering = 'pixelated';
};

const statusLabel = (status: CorpusLoadStatus): string => {
  switch (status) {
    case 'loading': return 'loading';
    case 'canonical': return 'canonical';
    case 'stale': return 'stale';
    case 'malformed': return 'malformed';
    case 'refused': return 'refused';
    case 'unavailable': return 'unavailable';
    case 'idle': return 'unavailable (not loaded)';
  }
};

const sourceStatusText = (source: ValueRecord | undefined, key: string): string => (
  stringValue(source?.[key], 'unavailable')
);

export type X4UiSourceEditInputResult =
  | { readonly accepted: true; readonly value: X4UiSourceEditScalar }
  | { readonly accepted: false; readonly reason: 'replacement-parse-failure' | 'invalid-replacement'; readonly detail: string };

/** Parse only the scalar type that the owner-issued catalog declared. */
export const parseX4UiSourceEditInput = (entry: unknown, raw: string): X4UiSourceEditInputResult => {
  const record = asRecord(entry);
  const valueType = record?.valueType;
  if (typeof raw !== 'string') {
    return { accepted: false, reason: 'invalid-replacement', detail: 'source edit input must be a string control value' };
  }
  if (valueType === 'string') return { accepted: true, value: raw };
  if (valueType === 'number') {
    if (raw.trim().length === 0) {
      return { accepted: false, reason: 'replacement-parse-failure', detail: 'number input must not be blank' };
    }
    const value = Number(raw.trim());
    if (!Number.isFinite(value)) {
      return { accepted: false, reason: 'replacement-parse-failure', detail: 'number input must be finite' };
    }
    return { accepted: true, value };
  }
  if (valueType === 'boolean') {
    if (raw === 'true') return { accepted: true, value: true };
    if (raw === 'false') return { accepted: true, value: false };
    return { accepted: false, reason: 'replacement-parse-failure', detail: 'boolean input must be exactly true or false' };
  }
  return { accepted: false, reason: 'invalid-replacement', detail: 'source edit entry has no supported scalar type' };
};

/** Stage a control value locally; this function has no source or workspace authority. */
export const stageX4UiSourceEditInput = (
  staged: Readonly<Record<string, string>>,
  entryId: string,
  raw: string,
): Readonly<Record<string, string>> => ({ ...staged, [entryId]: raw });

export interface X4UiSourceEditContext {
  readonly workspace: unknown;
  readonly source: unknown;
  readonly selection: unknown;
  readonly target: unknown;
  readonly program: unknown;
  readonly evidenceAuthority: unknown;
  readonly catalog: unknown;
  readonly profile: unknown;
}

const X4_UI_SOURCE_EDIT_CONTEXTS = new WeakSet<object>();

/** Issue one plain source-edit context from the exact current editor authority identities. */
export const createX4UiSourceEditContext = (
  workspace: unknown,
  source: unknown,
  selection: unknown,
  target: unknown,
  program: unknown,
  evidenceAuthority: unknown,
  catalog: unknown,
  profile: unknown,
): X4UiSourceEditContext => {
  const context: X4UiSourceEditContext = Object.freeze({
    workspace,
    source,
    selection,
    target,
    program,
    evidenceAuthority,
    catalog,
    profile,
  });
  X4_UI_SOURCE_EDIT_CONTEXTS.add(context);
  return context;
};

const isX4UiSourceEditContext = (value: unknown): value is X4UiSourceEditContext => (
  value !== null
  && typeof value === 'object'
  && X4_UI_SOURCE_EDIT_CONTEXTS.has(value)
);

const sameX4UiSourceEditContext = (left: X4UiSourceEditContext | null | undefined, right: X4UiSourceEditContext): boolean => (
  isX4UiSourceEditContext(left)
  && isX4UiSourceEditContext(right)
  && left.workspace === right.workspace
  && left.source === right.source
  && left.selection === right.selection
  && left.target === right.target
  && left.program === right.program
  && left.evidenceAuthority === right.evidenceAuthority
  && left.catalog === right.catalog
  && left.profile === right.profile
);

/** A changed authority input invalidates all staged values and receipts. */
export const shouldClearX4UiSourceEditState = (
  previous: X4UiSourceEditContext | null | undefined,
  current: X4UiSourceEditContext,
): boolean => !sameX4UiSourceEditContext(previous, current);

export const classifyX4UiWorkspaceCommit = (
  currentWorkspace: unknown,
  expectedWorkspace: unknown,
  replacementWorkspace: unknown,
): X4UiWorkspaceEditResult => {
  if (currentWorkspace !== expectedWorkspace) {
    return {
      accepted: false,
      reason: 'stale-parent-workspace',
      detail: 'parent workspace changed before the source edit could be committed',
    };
  }
  if (replacementWorkspace === null || typeof replacementWorkspace !== 'object') {
    return {
      accepted: false,
      reason: 'invalid-replacement-workspace',
      detail: 'accepted source edit did not return an object workspace',
    };
  }
  return { accepted: true, detail: 'accepted source edit workspace matches the expected parent object' };
};

const X4_UI_WORKSPACE_ACKNOWLEDGEMENTS = new WeakMap<X4UiWorkspaceEditPending, X4UiWorkspaceEditAcknowledgement>();

/** Create one exact pending attempt and the sole acknowledgement function bound to it. */
export const createX4UiWorkspaceEditPending = (
  expectedWorkspace: unknown,
  workspace: unknown,
): X4UiWorkspaceEditPendingAuthority => {
  const attempt = Object.freeze({});
  let resolveAcknowledgement: (acknowledgement: X4UiWorkspaceEditAcknowledgement) => void = () => undefined;
  const acknowledgement = new Promise<X4UiWorkspaceEditAcknowledgement>(resolve => {
    resolveAcknowledgement = resolve;
  });
  const submission: X4UiWorkspaceEditPending = Object.freeze({
    status: 'pending',
    attempt,
    expectedWorkspace,
    workspace,
    acknowledgement,
    detail: 'workspace CAS was scheduled; awaiting exact parent-issued attempt acknowledgement',
  });
  const acknowledge = (currentWorkspace: unknown): X4UiWorkspaceEditAcknowledgement => {
    const existing = X4_UI_WORKSPACE_ACKNOWLEDGEMENTS.get(submission);
    if (existing !== undefined) return existing;
    const issued: X4UiWorkspaceEditAcknowledgement = currentWorkspace === workspace
      ? Object.freeze({
        status: 'accepted',
        attempt,
        expectedWorkspace,
        workspace,
        currentWorkspace,
        detail: 'parent commit boundary processed the exact attempt and read back the exact owner workspace',
      })
      : Object.freeze({
        status: 'refused',
        attempt,
        expectedWorkspace,
        workspace,
        currentWorkspace,
        reason: 'stale-parent-workspace',
        detail: 'parent commit boundary processed the exact attempt against a newer live workspace',
      });
    X4_UI_WORKSPACE_ACKNOWLEDGEMENTS.set(submission, issued);
    resolveAcknowledgement(issued);
    return issued;
  };
  return Object.freeze({ submission, acknowledge });
};

/** Acceptance requires the exact registered acknowledgement object for this exact pending attempt. */
export const classifyX4UiWorkspaceEditAcknowledgement = (
  currentWorkspace: unknown,
  submission: X4UiWorkspaceEditPending,
  acknowledgement?: X4UiWorkspaceEditAcknowledgement,
): X4UiWorkspaceEditReadback => {
  if (acknowledgement === undefined) {
    return {
      status: 'pending',
      detail: 'parent workspace commit remains pending an exact attempt acknowledgement',
    };
  }
  const issued = X4_UI_WORKSPACE_ACKNOWLEDGEMENTS.get(submission);
  if (
    issued !== acknowledgement
    || acknowledgement.attempt !== submission.attempt
    || acknowledgement.expectedWorkspace !== submission.expectedWorkspace
    || acknowledgement.workspace !== submission.workspace
  ) {
    return {
      status: 'refused',
      reason: 'invalid-parent-workspace-acknowledgement',
      detail: 'parent acknowledgement was cloned, crossed, forged, or not issued for this exact pending attempt',
    };
  }
  if (
    acknowledgement.currentWorkspace !== currentWorkspace
    || acknowledgement.status === 'refused'
    || currentWorkspace !== submission.workspace
  ) {
    return {
      status: 'refused',
      reason: 'stale-parent-workspace',
      detail: acknowledgement.status === 'refused'
        ? acknowledgement.detail
        : 'parent acknowledgement no longer matches the exact current workspace outcome',
    };
  }
  return {
    status: 'accepted',
    detail: acknowledgement.detail,
  };
};

/** Compatibility name retained; identity readback alone never accepts without an acknowledgement. */
export const classifyX4UiWorkspaceEditReadback = classifyX4UiWorkspaceEditAcknowledgement;

/** Submit both changed and no-op owner results through the same exact parent commit seam. */
export const submitX4UiSourceEditWorkspaceCommit = (
  expectedWorkspace: unknown,
  workspace: unknown,
  onWorkspaceEdit: X4UiWorkspaceEditHandler | undefined,
): X4UiWorkspaceEditSubmission => {
  if (onWorkspaceEdit === undefined) {
    return {
      status: 'refused',
      reason: 'parent-workspace-owner-unavailable',
      detail: 'the UIBuilder workspace owner did not provide a commit seam',
    };
  }
  const submission = onWorkspaceEdit({ expectedWorkspace, workspace });
  if (submission.status === 'refused') return submission;
  if (
    submission.expectedWorkspace !== expectedWorkspace
    || submission.workspace !== workspace
    || submission.attempt === null
    || typeof submission.attempt !== 'object'
    || typeof submission.acknowledgement?.then !== 'function'
  ) {
    return {
      status: 'refused',
      reason: 'invalid-parent-workspace-acknowledgement',
      detail: 'parent pending submission did not preserve the exact attempt, expected workspace, replacement workspace, and acknowledgement identities',
    };
  }
  return submission;
};

/** Derive the source-edit catalog only from one exact current session projection. */
export const discoverX4UiSourceEditorCatalog = (
  workspace: unknown,
  projection: X4UiEditorSessionProjection,
): X4UiSourceEditCatalog | undefined => {
  const programResult = projection.preview.program;
  if (programResult === undefined || programResult.status === 'refused' || programResult.program === undefined) return undefined;
  try {
    return discoverX4UiSourceEdits(
      workspace as Parameters<typeof discoverX4UiSourceEdits>[0],
      projection.source,
      programResult.program,
      programResult.evidenceAuthority,
    );
  } catch {
    return undefined;
  }
};

export type X4UiSourceEditUiReceipt =
  | {
    readonly status: 'pending';
    readonly submission: X4UiWorkspaceEditPending;
    readonly context: X4UiSourceEditContext;
    readonly changed: boolean;
    readonly detail: string;
    readonly acceptedDetail: string;
  }
  | { readonly status: 'accepted'; readonly changed: boolean; readonly detail: string }
  | { readonly status: 'refused'; readonly reason: string; readonly detail: string };

/** Settle one pending child receipt only from the exact parent-issued acknowledgement. */
export const settleX4UiSourceEditReceipt = (
  currentWorkspace: unknown,
  pendingReceipt: Extract<X4UiSourceEditUiReceipt, { readonly status: 'pending' }>,
  acknowledgement: X4UiWorkspaceEditAcknowledgement | undefined,
  currentContext: X4UiSourceEditContext,
): X4UiSourceEditUiReceipt => {
  const settlement = classifyX4UiWorkspaceEditAcknowledgement(
    currentWorkspace,
    pendingReceipt.submission,
    acknowledgement,
  );
  if (settlement.status === 'pending') return pendingReceipt;
  if (settlement.status === 'refused') {
    return { status: 'refused', reason: settlement.reason, detail: settlement.detail };
  }
  if (!sameX4UiSourceEditContext(pendingReceipt.context, currentContext)) {
    return {
      status: 'refused',
      reason: 'stale-editor-context',
      detail: 'source editor authority changed before the parent acknowledgement settled',
    };
  }
  return {
    status: 'accepted',
    changed: pendingReceipt.changed,
    detail: pendingReceipt.acceptedDetail,
  };
};

export interface X4UiSourceEditorSourceEditsProps {
  readonly catalog: X4UiSourceEditCatalog;
  readonly staged: Readonly<Record<string, string>>;
  readonly receipt?: X4UiSourceEditUiReceipt;
  readonly onStage: (entryId: string, raw: string) => void;
  readonly onApply: (entryId: string) => void;
}

const sourceEditLocationLabel = (entry: X4UiSourceEditCatalogEntry): string => {
  const location = entry.sourceLiteral ?? entry.source;
  if (location === undefined) return `${entry.path ?? 'source unavailable'} · range unavailable`;
  const sourcePath = location.sourcePath === undefined ? '' : ` · ${location.sourcePath}`;
  return `${entry.path ?? location.file}${sourcePath} · ${location.start.line}:${location.start.column + 1}-${location.end.line}:${location.end.column + 1} · bytes ${location.start.offset}-${location.end.offset}`;
};

const sourceEditIdentityLabel = (entry: X4UiSourceEditCatalogEntry): string => {
  if (entry.kind === 'editable') {
    return `${entry.provenance.callName} · ${entry.provenance.fields.join(', ')} · operation ${entry.provenance.operationId}`;
  }
  return `${entry.callName ?? 'call unavailable'} · ${entry.field} · operation ${entry.operationId ?? 'operation unavailable'}`;
};

const sourceEditLiteralLabel = (entry: X4UiSourceEditCatalogEntry): string => {
  if (entry.expectedText !== undefined) return entry.expectedText;
  if (entry.expression !== undefined) return entry.expression;
  return entry.value === undefined ? 'unavailable' : String(entry.value);
};

const sourceEditInputTestId = (entryId: string): string => `x4-ui-source-edit-input-${entryId}`;

const sourceEditBlockLocationLabel = (entry: X4UiSourceEditInsertBlockEntry): string => (
  `${entry.path} · frame/display anchor bytes ${entry.startOffset}-${entry.endOffset}`
);

const sourceEditBlockOwnerLabel = (entry: X4UiSourceEditInsertBlockEntry): string => {
  const owner = entry.provenance.owner;
  if (owner === undefined) return 'owner unavailable';
  return `${owner.kind} ${owner.ownerId}${owner.frameId === undefined ? '' : ` · frame ${owner.frameId}`}`;
};

export function X4UiSourceEditorSourceEdits({
  catalog,
  staged,
  receipt,
  onStage,
  onApply,
}: X4UiSourceEditorSourceEditsProps) {
  const parentCommitPending = receipt?.status === 'pending';
  const frameBlockEntries = (catalog.insertEntries ?? []).filter((entry): entry is X4UiSourceEditInsertBlockEntry => (
    entry.kind === 'insert-block' && entry.anchor === 'frame-display'
  ));
  return (
    <section data-testid="x4-ui-source-edits" className="mt-3 rounded border border-white/10 bg-black/20 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[10px] font-bold uppercase tracking-wider text-cyan-300">Source-safe property controls</h2>
        <span data-testid="x4-ui-source-edit-verification" className="text-[9px] font-bold text-amber-300">{X4_UI_EDITOR_SESSION_GAME_TRUTH}</span>
      </div>
      <div data-testid="x4-ui-source-edit-catalog-detail" className="mt-1 break-words text-slate-500">{catalog.detail}</div>
      {receipt !== undefined && (
        <div
          data-testid="x4-ui-source-edit-receipt"
          className={`mt-2 rounded border p-2 ${receipt.status === 'accepted' ? 'border-emerald-500/30 text-emerald-300' : receipt.status === 'pending' ? 'border-amber-500/30 text-amber-300' : 'border-red-500/30 text-red-300'}`}
        >
          {receipt.status === 'accepted'
            ? `Accepted${receipt.changed ? ' source change' : ' no-op'}: ${receipt.detail}`
            : receipt.status === 'pending'
              ? `Pending parent workspace acknowledgement: ${receipt.detail}`
              : `Refused: ${receipt.reason} · ${receipt.detail}`}
        </div>
      )}
      <div className="mt-2 space-y-2">
        {catalog.entries.map(entry => {
          const hasStaged = Object.prototype.hasOwnProperty.call(staged, entry.id);
          const stagedValue = hasStaged ? staged[entry.id] : undefined;
          return (
            <article key={entry.id} data-testid={`x4-ui-source-edit-entry-${entry.id}`} className="rounded border border-white/10 bg-black/30 p-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-bold text-slate-200">{entry.path ?? entry.id} · {entry.id}</div>
                  <div className="mt-1 break-words text-slate-500">source path/range: <span className="text-slate-300">{sourceEditLocationLabel(entry)}</span></div>
                  <div className="break-words text-slate-500">call/field: <span className="text-slate-300">{sourceEditIdentityLabel(entry)}</span></div>
                  <div className="break-words text-slate-500">current literal: <code className="text-slate-200">{sourceEditLiteralLabel(entry)}</code></div>
                </div>
                {entry.kind === 'locked' ? (
                  <span data-testid={`x4-ui-source-edit-locked-${entry.id}`} className="rounded border border-amber-500/30 px-2 py-1 text-[9px] font-bold uppercase text-amber-300">Read-only · {entry.reason}</span>
                ) : (
                  <span className="rounded border border-emerald-500/30 px-2 py-1 text-[9px] font-bold uppercase text-emerald-300">Owner-issued literal</span>
                )}
              </div>
                {entry.kind === 'locked' ? (
                  <div data-testid={`x4-ui-source-edit-lock-reason-${entry.id}`} className="mt-2 break-words text-amber-200">owner lock/refusal reason: {entry.reason} · {entry.detail}</div>
                ) : (
                <>
                  <div className="mt-2 break-words text-slate-500">owner lock/refusal reason: none · exact owner-issued direct source literal</div>
                  <div className="mt-2 flex flex-wrap items-end gap-2">
                  <label className="flex min-w-48 flex-1 flex-col gap-1 text-slate-500">
                    Stage {entry.valueType} literal
                    {entry.valueType === 'number' && (
                      <input
                        data-testid={sourceEditInputTestId(entry.id)}
                        type="number"
                         step="any"
                         value={stagedValue ?? ''}
                         disabled={parentCommitPending}
                         onChange={event => onStage(entry.id, event.target.value)}
                        className="rounded border border-white/10 bg-black/40 px-2 py-1 text-slate-200"
                      />
                    )}
                    {entry.valueType === 'string' && (
                      <input
                        data-testid={sourceEditInputTestId(entry.id)}
                         type="text"
                         value={stagedValue ?? ''}
                         disabled={parentCommitPending}
                         onChange={event => onStage(entry.id, event.target.value)}
                        className="rounded border border-white/10 bg-black/40 px-2 py-1 text-slate-200"
                      />
                    )}
                    {entry.valueType === 'boolean' && (
                      <span className="flex items-center gap-2 rounded border border-white/10 bg-black/40 px-2 py-1 text-slate-200">
                        <input
                          data-testid={sourceEditInputTestId(entry.id)}
                           type="checkbox"
                           checked={stagedValue === undefined ? entry.value === true : stagedValue === 'true'}
                           disabled={parentCommitPending}
                           onChange={event => onStage(entry.id, String(event.target.checked))}
                        />
                        <span>{stagedValue === undefined ? String(entry.value) : stagedValue}</span>
                      </span>
                    )}
                  </label>
                  <button
                     type="button"
                     data-testid={`x4-ui-source-edit-apply-${entry.id}`}
                     disabled={!hasStaged || parentCommitPending}
                    onClick={() => onApply(entry.id)}
                    className="rounded border border-cyan-500/30 px-2 py-1 text-[9px] font-bold uppercase text-cyan-300 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Apply
                  </button>
                  </div>
                </>
              )}
            </article>
          );
        })}
      </div>
      {catalog.entries.length === 0 && <div className="mt-2 text-slate-500">No owner-issued source properties were exposed for this exact target.</div>}
      <section data-testid="x4-ui-source-edit-frame-blocks" className="mt-3 rounded border border-violet-500/30 bg-violet-950/10 p-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-violet-300">Frame-level direct X4 UI insertion block</h3>
          <span className="text-[9px] font-bold text-amber-300">{X4_UI_EDITOR_SESSION_GAME_TRUTH}</span>
        </div>
        <div data-testid="x4-ui-source-edit-frame-block-detail" className="mt-1 break-words text-slate-500">
          Only the owner-issued frame/display authority may stage a bounded direct-UI construction block. Parent acknowledgement remains required before adopting changed source.
        </div>
        {frameBlockEntries.length === 0 ? (
          <div data-testid="x4-ui-source-edit-frame-block-none" className="mt-2 text-slate-500">No owner-issued frame/display block authority is available for this exact target.</div>
        ) : (
          <div className="mt-2 space-y-2">
            {frameBlockEntries.map(entry => {
              const hasStaged = Object.prototype.hasOwnProperty.call(staged, entry.id);
              return (
                <article key={entry.id} data-testid={`x4-ui-source-edit-frame-block-${entry.id}`} className="rounded border border-white/10 bg-black/30 p-2">
                  <div className="font-bold text-slate-200">{entry.id}</div>
                  <div className="mt-1 break-words text-slate-500">authority: <span className="text-slate-300">{sourceEditBlockLocationLabel(entry)}</span></div>
                  <div className="break-words text-slate-500">owner proof: <span className="text-slate-300">{sourceEditBlockOwnerLabel(entry)}</span></div>
                  <div className="break-words text-slate-500">CAS range: <span className="text-slate-300">{entry.startOffset}-{entry.endOffset} · expected text is empty at the display anchor</span></div>
                  <label className="mt-2 flex flex-col gap-1 text-slate-500">
                    Stage bounded direct X4 UI source block
                    <textarea
                      data-testid={`x4-ui-source-edit-block-input-${entry.id}`}
                      value={staged[entry.id] ?? ''}
                      disabled={parentCommitPending}
                      rows={8}
                      spellCheck={false}
                      onChange={event => onStage(entry.id, event.target.value)}
                      className="min-h-32 rounded border border-white/10 bg-black/40 px-2 py-1 text-slate-200"
                    />
                  </label>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <span data-testid={`x4-ui-source-edit-block-diagnostic-${entry.id}`} className="break-words text-amber-200">Diagnostic: {catalog.detail} · {X4_UI_EDITOR_SESSION_GAME_TRUTH}</span>
                    <button
                      type="button"
                      data-testid={`x4-ui-source-edit-apply-block-${entry.id}`}
                      disabled={!hasStaged || parentCommitPending}
                      onClick={() => onApply(entry.id)}
                      className="rounded border border-violet-400/40 px-2 py-1 text-[9px] font-bold uppercase text-violet-300 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Apply frame block
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </section>
  );
}

interface X4UiSourceEditDraftState {
  readonly context: X4UiSourceEditContext | null;
  readonly staged: Readonly<Record<string, string>>;
  readonly receipt?: X4UiSourceEditUiReceipt;
}

/** Recheck the live draft at effect execution time before clearing drifted authority state. */
export const reconcileX4UiSourceEditDraftContext = (
  previous: X4UiSourceEditDraftState,
  current: X4UiSourceEditContext,
): X4UiSourceEditDraftState => {
  if (previous.context === current) return previous;
  if (!shouldClearX4UiSourceEditState(previous.context, current)) {
    return { ...previous, context: current };
  }
  return { context: current, staged: {} };
};

export function X4UiSourceEditorLinter({ inspection }: { readonly inspection: X4UiLintInspection }) {
  const summary = classifyX4UiLintState(inspection);
  return (
    <section data-testid="x4-ui-linter-region" className="mt-3 rounded border border-white/10 bg-black/20 p-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[10px] font-bold uppercase tracking-wider text-cyan-300">Imported-source linter</h2>
        <span data-testid="x4-ui-linter-summary" className={`font-bold ${summary.kind === 'static-errors-found' ? 'text-red-300' : summary.kind === 'static-warnings-found' || summary.kind === 'static-checks-incomplete' ? 'text-amber-300' : 'text-emerald-300'}`}>{summary.label}</span>
      </div>
      {inspection.findings.length === 0 ? (
        <div className="mt-2 text-slate-500">{summary.kind === 'no-known-static-rule-violated' ? 'No imported-source findings are currently available.' : 'Imported-source findings are not complete enough to display.'}</div>
      ) : (
        <div className="mt-2 space-y-2">
          {inspection.findings.map((finding, index) => (
            <article key={`${finding.code}:${finding.location}:${index}`} className="rounded border border-white/10 bg-black/30 p-2">
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                <span>severity: <strong className="text-slate-200">{finding.severity}</strong></span>
                <span>code: <strong className="text-slate-200">{finding.code}</strong></span>
                <span>source location: <strong className="text-slate-200">{finding.location}</strong></span>
              </div>
              <div className="mt-1 break-words">message: <span className="text-slate-200">{finding.message}</span></div>
              <div className="mt-1 grid grid-cols-1 gap-1 text-slate-500 lg:grid-cols-3">
                <span>failureMode: {finding.failureMode}</span>
                <span>evidenceBoundary: {finding.evidenceBoundary}</span>
                <span>nextAction: {finding.nextAction}</span>
              </div>
              {isBlockingX4UiAddTableFinding(finding) && <div data-testid="x4-ui-addtable-symptom" className="mt-1 text-amber-300">Symptom: whole frame disappears; UI reloads; conversation closes.</div>}
              <div className="mt-1 text-slate-600">file: {finding.filePath}</div>
            </article>
          ))}
        </div>
      )}
      {(inspection.diagnosticCount > 0 || inspection.verificationGapCount > 0 || inspection.lintErrorCount > 0 || inspection.truncated || inspection.incompleteFindingCount > 0) && (
        <div className="mt-2 text-amber-300">Static evidence remains incomplete; diagnostics and verification gaps are not rendered as normalized findings.</div>
      )}
    </section>
  );
}

const previewGeometryPositionLabel = (position: X4UiPreviewGeometryPosition): string => (
  `${position.line}:${position.column + 1}${position.offset === null ? '' : ` @${position.offset}`}`
);

const previewGeometryRangeLabel = (range: X4UiPreviewGeometryRange): string => (
  `${previewGeometryPositionLabel(range.start)}-${previewGeometryPositionLabel(range.end)}`
);

export function X4UiSourceEditorPreviewGeometry({ scene }: { readonly scene: unknown }) {
  const inspection = inspectX4UiPreviewGeometry(scene);
  const stateLabel = inspection.state === 'available'
    ? 'available'
    : inspection.state === 'empty'
      ? 'empty'
      : inspection.state === 'incomplete'
        ? 'incomplete'
        : 'unavailable';
  return (
    <section data-testid="x4-ui-preview-geometry-region" className="mt-3 rounded border border-violet-500/30 bg-violet-950/10 p-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[10px] font-bold uppercase tracking-wider text-violet-300">Preview geometry diagnostics</h2>
        <span data-testid="x4-ui-preview-geometry-state" className="font-bold text-violet-200">{stateLabel}</span>
      </div>
      <div data-testid="x4-ui-preview-geometry-filter" className="mt-2 text-slate-500">Source-linked geometry filter: only height/width evidence is shown. Paint/text/kernel/scrollbar/state/data-flow gaps are not shown.</div>
      <div className="mt-1 text-slate-400">Scene status: <span data-testid="x4-ui-preview-geometry-scene-status" className="text-slate-200">{inspection.sceneStatus}</span></div>
      <div className="mt-1 text-slate-400">Count: <span data-testid="x4-ui-preview-geometry-count" className="font-bold text-slate-200">{inspection.diagnosticCount}</span> source-linked height/width diagnostics</div>
      {inspection.incompleteCount > 0 && (
        <div data-testid="x4-ui-preview-geometry-incomplete-count" className="mt-1 text-amber-300">Incomplete candidates: {inspection.incompleteCount} malformed source-linked height/width gap{inspection.incompleteCount === 1 ? '' : 's'} were not rendered.</div>
      )}
      {inspection.state === 'unavailable' ? (
        <div data-testid="x4-ui-preview-geometry-unavailable" className="mt-2 break-words text-slate-500">Unavailable: {inspection.detail}</div>
      ) : inspection.state === 'empty' ? (
        <div data-testid="x4-ui-preview-geometry-empty" className="mt-2 text-slate-500">Empty: no source-linked height/width diagnostics are available.</div>
      ) : (
        <div className="mt-2 space-y-2">
          {inspection.diagnostics.map((diagnostic, index) => (
            <article key={`${diagnostic.file}:${previewGeometryRangeLabel(diagnostic.range)}:${diagnostic.category}:${diagnostic.status}:${diagnostic.nodeId ?? ''}:${diagnostic.reason}:${index}`} data-testid={`x4-ui-preview-geometry-diagnostic-${index}`} className="rounded border border-white/10 bg-black/25 p-2">
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                <span>category: <strong className="text-slate-200">{diagnostic.category}</strong></span>
                <span>status: <strong className="text-slate-200">{diagnostic.status}</strong></span>
              </div>
              <div className="mt-1 break-words">file: <span className="text-slate-200">{diagnostic.file}</span></div>
              <div className="mt-1 break-words">range: <span className="text-slate-200">{previewGeometryRangeLabel(diagnostic.range)}</span></div>
              <div className="mt-1 break-words">reason: <span className="text-slate-200">{diagnostic.reason}</span></div>
              {diagnostic.nodeId !== undefined && <div className="mt-1 break-words">node owner: <span className="text-slate-200">{diagnostic.nodeId}</span></div>}
            </article>
          ))}
        </div>
      )}
      <div data-testid="x4-ui-preview-geometry-boundary" className="mt-2 font-bold text-amber-300">Layout evidence only · Not verified in game</div>
    </section>
  );
}

export interface X4UiSourceEditorSamplesProps {
  readonly catalog: X4UiLayoutPreviewSampleCatalog | null;
  readonly samples: X4UiLayoutPreviewSampleInput | undefined;
  readonly onSampleInput: (entryId: string, raw: string) => void;
  readonly error?: string;
}

const sampleValueFor = (
  samples: X4UiLayoutPreviewSampleInput | undefined,
  entryId: string,
): X4UiLayoutScalar | undefined => samples?.values.find(value => value.id === entryId)?.value;

const sampleControlValue = (
  expectedType: X4UiLayoutPreviewSampleCatalog['entries'][number]['expectedType'],
  value: X4UiLayoutScalar | undefined,
): string => {
  if (value === undefined) return '';
  if (expectedType === 'boolean') return typeof value === 'boolean' ? String(value) : '';
  if (expectedType === 'number') return typeof value === 'number' && Number.isFinite(value) ? String(value) : '';
  return typeof value === 'string' ? value : '';
};

const sampleSourceLabel = (catalog: X4UiLayoutPreviewSampleCatalog, entry: X4UiLayoutPreviewSampleCatalog['entries'][number]): string => {
  const sourcePath = entry.source.sourcePath ?? entry.source.file;
  const sourceIdentity = catalog.sourceIdentity.sourcePath ?? catalog.sourceIdentity.file;
  return `${sourcePath}:${entry.source.start.line}:${entry.source.start.column + 1}-${entry.source.end.line}:${entry.source.end.column + 1} · source identity ${sourceIdentity} · ${catalog.sourceIdentity.sha256}`;
};

export function X4UiSourceEditorSamples({
  catalog,
  samples,
  onSampleInput,
  error,
}: X4UiSourceEditorSamplesProps) {
  return (
    <section data-testid="x4-ui-samples-region" className="mt-3 rounded border border-cyan-500/30 bg-cyan-950/10 p-3">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-[10px] font-bold uppercase tracking-wider text-cyan-300">Preview-only samples</h2>
        <span data-testid="x4-ui-samples-preview-only" className="font-bold text-amber-300">Preview only</span>
      </div>
      <div className="mt-2 text-amber-200">Samples affect preview measurement only. They never change source, workspace, export bytes, linter truth, or <span className="font-bold">Not verified in game</span>.</div>
      {catalog === null ? (
        <div data-testid="x4-ui-samples-empty" className="mt-2 text-slate-500">Select an exact source and target to expose the selected layout-program sample catalog.</div>
      ) : catalog.entries.length === 0 ? (
        <div data-testid="x4-ui-samples-none" className="mt-2 text-slate-500">The selected layout program declares no dynamic preview samples.</div>
      ) : (
        <div className="mt-2 space-y-2">
          {catalog.entries.map(entry => {
            const value = sampleValueFor(samples, entry.id);
            const controlValue = sampleControlValue(entry.expectedType, value);
            return (
              <label key={entry.id} data-testid={`x4-ui-sample-${entry.id}`} className="flex flex-col gap-1 rounded border border-white/10 bg-black/25 p-2 text-slate-400">
                <span className="font-bold text-slate-200">{`{${entry.expression}}`} · {entry.expectedType} · {entry.id}</span>
                <span className="break-all text-slate-500">{sampleSourceLabel(catalog, entry)}</span>
                {entry.expectedType === 'boolean' ? (
                  <select data-testid={`x4-ui-sample-control-${entry.id}`} value={controlValue} onChange={event => onSampleInput(entry.id, event.target.value)} className="rounded border border-white/10 bg-black/40 px-2 py-1 text-slate-200">
                    <option value="">Reset sample</option>
                    <option value="true">true</option>
                    <option value="false">false</option>
                  </select>
                ) : (
                  <input data-testid={`x4-ui-sample-control-${entry.id}`} type={entry.expectedType === 'number' ? 'number' : 'text'} step={entry.expectedType === 'number' ? 'any' : undefined} value={controlValue} onChange={event => onSampleInput(entry.id, event.target.value)} placeholder={`{${entry.expression}}`} className="rounded border border-white/10 bg-black/40 px-2 py-1 text-slate-200" />
                )}
              </label>
            );
          })}
        </div>
      )}
      {error !== undefined && <div data-testid="x4-ui-samples-error" className="mt-2 text-red-300">{error}</div>}
    </section>
  );
}

export default function X4UiSourceEditor({
  workspace,
  corpusLoader,
  surfaceFactory,
  onWorkspaceEdit,
  onVerificationSnapshotChange,
}: X4UiSourceEditorProps) {
  const [profile, setProfile] = useState<X4UiEditorProfileControls>(() => ({
    width: X4_UI_EDITOR_DEFAULT_PROFILE.drawable.width,
    height: X4_UI_EDITOR_DEFAULT_PROFILE.drawable.height,
    uiScale: X4_UI_EDITOR_DEFAULT_PROFILE.uiScale,
  }));
  const [scaleMode, setScaleMode] = useState<X4UiSourceEditorScaleMode>(X4_UI_SOURCE_EDITOR_SCALE_MODE_DERIVED);
  const [userScale, setUserScale] = useState(X4_UI_SOURCE_EDITOR_DEFAULT_USER_SCALE);
  const [sourceSelector, setSourceSelector] = useState('');
  const [targetSelector, setTargetSelector] = useState('');
  const [sampleInput, setSampleInput] = useState<X4UiEditorSampleState>(undefined);
  const [sampleBinding, setSampleBinding] = useState<X4UiEditorSampleBinding | undefined>(undefined);
  const [sampleCatalogAuthority, setSampleCatalogAuthority] = useState<X4UiEditorSampleCatalogAuthority | undefined>(undefined);
  const [sampleError, setSampleError] = useState<string | undefined>(undefined);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [enabledEntryIds, setEnabledEntryIds] = useState<readonly string[]>([]);
  const [manualCalibrationState, setManualCalibrationState] = useState<X4UiManualCalibrationState>(() => createX4UiManualCalibrationState());
  const [corpusState, setCorpusState] = useState<CorpusLoadState>(EMPTY_CORPUS_STATE);
  const [corpusGeneration, setCorpusGeneration] = useState(0);
  const [canvasState, setCanvasState] = useState<X4UiEditorCanvasState>(() => X4_UI_EDITOR_EMPTY_CANVAS_STATE);
  const [canvasExportFeedback, setCanvasExportFeedback] = useState<string | undefined>(undefined);
  const [sourceEditDraft, setSourceEditDraft] = useState<X4UiSourceEditDraftState>(() => ({
    context: null,
    staged: {},
  }));
  const sourceEditContextRef = useRef<X4UiSourceEditContext | null>(null);
  const sourceEditDraftRef = useRef(sourceEditDraft);
  const canvasStateRef = useRef(canvasState);
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const currentVerificationSnapshotRef = useRef<X4UiGameVerificationCurrentSnapshot | null>(null);
  const canvasExportIdentityRef = useRef<X4UiGameVerificationCurrentSnapshot | null>(null);
  const canvasExportInFlightRef = useRef(false);
  const [rendererSession] = useState<X4UiCanvasRenderSession>(() => createX4UiCanvasRenderSession());

  const resolvedCorpusLoader = useMemo(() => corpusLoader ?? defaultCorpusLoader, [corpusLoader]);
  const resolvedSurfaceFactory = useMemo(() => surfaceFactory ?? defaultSurfaceFactory, [surfaceFactory]);
  const profileValue = useMemo(() => profile, [profile]);
  const manualSessionInput = useMemo(
    () => buildX4UiManualCalibrationSessionInput(manualCalibrationState),
    [manualCalibrationState],
  );

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const requestGeneration = corpusGeneration;
    setCorpusState({
      status: 'loading',
      result: null,
      detail: 'Loading configured canonical X4 corpus evidence.',
      colorStatus: 'loading',
      colorDetail: 'Loading configured canonical-default color evidence.',
    });
    void resolvedCorpusLoader({ signal: controller.signal }).then(result => {
      const classification = classifyX4UiCorpusLoadResult({
        result,
        loaderIssued: true,
        signalAborted: controller.signal.aborted,
        requestActive: active,
        requestGeneration,
        currentGeneration: corpusGeneration,
      });
      if (classification.status === 'ignored') return;
      setCorpusState({
        status: classification.status,
        result: classification.result,
        detail: classification.detail,
        colorStatus: classification.colorStatus,
        colorDetail: classification.colorDetail,
        ...(classification.colorEvidence === undefined ? {} : { colorEvidence: classification.colorEvidence }),
      });
    }).catch(error => {
      const classification = classifyX4UiCorpusLoadResult({
        result: error,
        loaderIssued: true,
        signalAborted: controller.signal.aborted,
        requestActive: active,
        requestGeneration,
        currentGeneration: corpusGeneration,
      });
      if (classification.status === 'ignored') return;
      setCorpusState({
        status: classification.status,
        result: null,
        detail: classification.detail,
        colorStatus: classification.colorStatus,
        colorDetail: classification.colorDetail,
      });
    });
    return () => {
      active = false;
      controller.abort();
    };
  }, [corpusGeneration, resolvedCorpusLoader]);

  const canonicalCorpus = isX4UiCorpusCanonicalSuccess(corpusState.result)
    ? corpusState.result as X4UiCorpusCanonicalSuccess
    : null;
  const canonicalColorEvidence = canonicalCorpus !== null && canonicalColorSuccess(corpusState.colorEvidence)
    ? corpusState.colorEvidence
    : undefined;

  const selection = useMemo(() => {
    const provisionalInput = {
      workspace,
      corpus: canonicalCorpus,
      profile: profileValue,
      enabledEntryIds,
      manualCalibrations: manualSessionInput.manualCalibrations,
      enabledManualEntryIds: manualSessionInput.enabledManualEntryIds,
      ...(canonicalColorEvidence === undefined ? {} : { colorEvidence: canonicalColorEvidence }),
      ...(activePresetId === null ? {} : { activePresetId }),
    } as unknown as X4UiEditorSessionInput;
    const provisionalProjection = projectX4UiEditorSession(provisionalInput);
    const provisionalPreview = previewFor(provisionalProjection);
    const candidates = sourceCandidatesFor(provisionalPreview);
    const reconciled = reconcileX4UiEditorSelections({
      sourceSelector,
      targetSelector,
      candidates,
    });
    const source = candidates.find(candidate => candidate.key === reconciled.sourceSelector);
    const target = source?.targets.find(candidate => candidate.key === reconciled.targetSelector);
    if (source === undefined || target === undefined || !asRecord(source.sourceIdentity)) {
      return {
        candidates,
        source,
        target,
        reconciled,
        selection: undefined,
      };
    }
    return {
      candidates,
      source,
      target,
      reconciled,
      selection: {
        sourceIndex: source.index,
        path: source.path,
        sourceIdentity: source.sourceIdentity,
        target: target.raw,
      },
    };
  }, [
    activePresetId,
    canonicalColorEvidence,
    canonicalCorpus,
    enabledEntryIds,
    manualSessionInput.enabledManualEntryIds,
    manualSessionInput.manualCalibrations,
    profileValue,
    sourceSelector,
    targetSelector,
    workspace,
  ]);

  const sessionInput = useMemo(() => ({
    workspace,
    corpus: canonicalCorpus,
    profile: profileValue,
    enabledEntryIds,
    manualCalibrations: manualSessionInput.manualCalibrations,
    enabledManualEntryIds: manualSessionInput.enabledManualEntryIds,
    ...(canonicalColorEvidence === undefined ? {} : { colorEvidence: canonicalColorEvidence }),
    ...(sampleBinding === undefined ? {} : { sampleBinding }),
    ...(sampleCatalogAuthority === undefined ? {} : { sampleCatalogAuthority }),
    ...(sampleInput === undefined ? {} : { samples: sampleInput }),
    ...(activePresetId === null ? {} : { activePresetId }),
    ...(selection.selection === undefined ? {} : { selection: selection.selection }),
  }) as unknown as X4UiEditorSessionInput, [
    activePresetId,
    canonicalColorEvidence,
    canonicalCorpus,
    enabledEntryIds,
    manualSessionInput.enabledManualEntryIds,
    manualSessionInput.manualCalibrations,
    profileValue,
    sampleBinding,
    sampleCatalogAuthority,
    sampleInput,
    selection.selection,
    workspace,
  ]);

  const projection = useMemo(
    () => projectX4UiEditorSession(sessionInput),
    [sessionInput],
  );
  const projectionView = projectionFor(projection);
  const preview = previewFor(projection);
  const currentVerificationSnapshot = useMemo(
    () => buildX4UiGameVerificationCurrentSnapshot({
      sourceIdentity: selection.selection?.sourceIdentity,
      targetIdentity: selection.selection?.target,
      normalizedProfile: projectionView.normalizedProfile,
    }),
    [projectionView.normalizedProfile, selection.selection],
  );
  currentVerificationSnapshotRef.current = currentVerificationSnapshot;

  useLayoutEffect(() => {
    if (onVerificationSnapshotChange === undefined) return;
    onVerificationSnapshotChange(currentVerificationSnapshot);
    return () => onVerificationSnapshotChange(null);
  }, [currentVerificationSnapshot, onVerificationSnapshotChange]);

  const source = projectionView.source;
  const lintInspection = lintInspectionFor(preview);
  const currentProgramResult = projection.preview.program;
  const currentProgram = currentProgramResult?.status === 'refused' ? undefined : currentProgramResult?.program;
  const currentEvidenceAuthority = currentProgramResult?.status === 'refused' ? undefined : currentProgramResult?.evidenceAuthority;
  const sourceEditCatalog = useMemo(
    () => discoverX4UiSourceEditorCatalog(workspace, projection),
    [projection, workspace],
  );
  const targetOptions = selection.source?.targets ?? [];
  const selectedSourceIdentity = asRecord(selection.source?.sourceIdentity);
  const sourceIdentityForDisplay = selectedSourceIdentity ?? asRecord(X4_UI_EDITOR_UNSELECTED_SOURCE);
  const selectedSourceFile = stringValue(sourceIdentityForDisplay?.file, 'unavailable');
  const selectedSourceHash = stringValue(sourceIdentityForDisplay?.sha256, 'unavailable');
  const sourceKeepOutPresets = asArray(projectionView.keepOutPresets);
  const canRender = projectionView.canRender === true
    && projectionView.paint !== null
    && projectionView.paint !== undefined
    && canonicalCorpus !== null;
  const canvasDescription = classifyX4UiCanvasState(canvasState);
  const sourceEditContext = useMemo<X4UiSourceEditContext>(() => createX4UiSourceEditContext(
    workspace,
    projection.source,
    selection.selection,
    projection.preview.selectedTarget,
    currentProgram,
    currentEvidenceAuthority,
    sourceEditCatalog,
    projection.normalizedProfile,
  ), [
    currentEvidenceAuthority,
    currentProgram,
    projection.normalizedProfile,
    projection.preview.selectedTarget,
    projection.source,
    selection.selection,
    sourceEditCatalog,
    workspace,
  ]);
  sourceEditContextRef.current = sourceEditContext;
  sourceEditDraftRef.current = sourceEditDraft;
  const sourceEditDraftMatches = sourceEditDraft.context !== null
    && !shouldClearX4UiSourceEditState(sourceEditDraft.context, sourceEditContext);
  const visibleSourceEditStaged = sourceEditDraftMatches ? sourceEditDraft.staged : {};
  const visibleSourceEditReceipt = sourceEditDraftMatches ? sourceEditDraft.receipt : undefined;

  useEffect(() => {
    setSourceEditDraft(previous => reconcileX4UiSourceEditDraftContext(
      previous,
      sourceEditContextRef.current ?? sourceEditContext,
    ));
  }, [sourceEditContext]);

  useEffect(() => {
    if (projection.samples !== sampleInput) setSampleInput(projection.samples);
    if (!sameX4UiEditorSampleBinding(projection.sampleBinding, sampleBinding)) setSampleBinding(projection.sampleBinding);
    if (projection.sampleCatalogAuthority !== sampleCatalogAuthority) setSampleCatalogAuthority(projection.sampleCatalogAuthority);
    if (projection.sampleReconciliation.status !== 'accepted') {
      setSampleError(projection.sampleReconciliation.message);
    }
  }, [projection.sampleBinding, projection.sampleCatalogAuthority, projection.sampleReconciliation, projection.samples, sampleBinding, sampleCatalogAuthority, sampleInput]);

  useEffect(() => {
    if (selection.reconciled.sourceSelector !== sourceSelector) setSourceSelector(selection.reconciled.sourceSelector);
    if (selection.reconciled.targetSelector !== targetSelector) setTargetSelector(selection.reconciled.targetSelector);
  }, [selection.reconciled.sourceSelector, selection.reconciled.targetSelector, sourceSelector, targetSelector]);

  useEffect(() => {
    setCanvasExportFeedback(undefined);
  }, [currentVerificationSnapshot]);

  useEffect(() => {
    let active = true;
    const host = canvasHostRef.current;
    const reason = stringValue(projectionView.reason, `session status is ${stringValue(projectionView.status, 'unavailable')}`);
    const disposeSurface = (surface: X4UiCanvasSurface): void => {
      if (typeof HTMLElement !== 'undefined' && surface instanceof HTMLElement) surface.remove();
    };
    const adopt = (result: X4UiCanvasRenderResult): void => {
      const decision = classifyX4UiCanvasCommit(canvasStateRef.current, result);
      canvasStateRef.current = decision.nextState;
      setCanvasState(decision.nextState);
      if (decision.replaceSurface === undefined) {
        canvasExportIdentityRef.current = null;
        if (decision.discardSurface !== undefined) disposeSurface(decision.discardSurface);
        return;
      }
      if (!active || host === null) {
        canvasExportIdentityRef.current = null;
        disposeSurface(decision.replaceSurface);
        return;
      }
      setCompletedBitmapStyle(decision.replaceSurface);
      host.replaceChildren(decision.replaceSurface as unknown as Node);
      canvasExportIdentityRef.current = currentVerificationSnapshot;
    };

    if (!canRender || canonicalCorpus === null || projectionView.paint === null || projectionView.paint === undefined) {
      adopt(sessionRefusalResult(`Session is not renderable: ${reason}`));
      return () => {
        active = false;
      };
    }

    const result = renderX4UiPaintPlanToCanvas(
      projectionView.paint as Parameters<typeof renderX4UiPaintPlanToCanvas>[0],
      canonicalCorpus,
      { surfaceFactory: resolvedSurfaceFactory, presentation: 'source-composition', session: rendererSession },
    );
    if (active) adopt(result);
    return () => {
      active = false;
    };
  }, [canRender, canonicalCorpus, currentVerificationSnapshot, projectionView.paint, projectionView.reason, projectionView.status, rendererSession, resolvedSurfaceFactory]);

  const updateProfileDimension = (field: 'width' | 'height' | 'uiScale', raw: string): void => {
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) return;
    setProfile(previous => {
      if (field === 'uiScale') {
        return scaleMode === X4_UI_SOURCE_EDITOR_SCALE_MODE_CUSTOM
          ? { ...previous, uiScale: value }
          : previous;
      }
      if (field !== 'height' || scaleMode !== X4_UI_SOURCE_EDITOR_SCALE_MODE_DERIVED) {
        return {
          ...previous,
          [field]: value,
        };
      }
      const effectiveScale = deriveX4UiEffectiveScale(userScale, value);
      if (effectiveScale === null) return previous;
      return {
        ...previous,
        height: value,
        uiScale: effectiveScale,
      };
    });
  };

  const updateUserScale = (raw: string): void => {
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) return;
    if (scaleMode === X4_UI_SOURCE_EDITOR_SCALE_MODE_DERIVED
      && deriveX4UiEffectiveScale(value, profile.height) === null) return;
    setUserScale(value);
    if (scaleMode !== X4_UI_SOURCE_EDITOR_SCALE_MODE_DERIVED) return;
    setProfile(previous => {
      const effectiveScale = deriveX4UiEffectiveScale(value, previous.height);
      return effectiveScale === null ? previous : { ...previous, uiScale: effectiveScale };
    });
  };

  const updateScaleMode = (value: string): void => {
    if (value !== X4_UI_SOURCE_EDITOR_SCALE_MODE_DERIVED && value !== X4_UI_SOURCE_EDITOR_SCALE_MODE_CUSTOM) return;
    if (value === X4_UI_SOURCE_EDITOR_SCALE_MODE_DERIVED) {
      const effectiveScale = deriveX4UiEffectiveScale(userScale, profile.height);
      if (effectiveScale === null) return;
      setProfile(previous => {
        const currentEffectiveScale = deriveX4UiEffectiveScale(userScale, previous.height);
        return currentEffectiveScale === null ? previous : { ...previous, uiScale: currentEffectiveScale };
      });
    }
    setScaleMode(value);
  };

  const selectSource = (value: string): void => {
    setSourceSelector(value);
    setTargetSelector('');
  };

  const selectPreset = (value: string | null): void => {
    setActivePresetId(value);
    if (value === null) {
      setEnabledEntryIds([]);
      return;
    }
    const definition = KEEP_OUT_PRESETS.find(preset => preset.id === value);
    setEnabledEntryIds(definition?.members.map(member => member.entryId) ?? []);
  };

  const toggleEntry = (originatingPresetId: string, entryId: string): void => {
    setEnabledEntryIds(previous => toggleX4UiKeepOutEntry(activePresetId, originatingPresetId, previous, entryId, KEEP_OUT_PRESETS));
  };

  const updateManualDraftField = (field: X4UiManualCalibrationDraftField, value: string): void => {
    setManualCalibrationState(previous => ({
      ...previous,
      draft: updateX4UiManualCalibrationDraft(previous.draft, field, value),
    }));
  };

  const updateManualDraftPoint = (index: number, axis: 'x' | 'y', value: string): void => {
    setManualCalibrationState(previous => ({
      ...previous,
      draft: updateX4UiManualCalibrationPoint(previous.draft, index, axis, value),
    }));
  };

  const addManualDraftPoint = (): void => {
    setManualCalibrationState(previous => ({
      ...previous,
      draft: addX4UiManualCalibrationPoint(previous.draft),
    }));
  };

  const removeManualDraftPoint = (index: number): void => {
    setManualCalibrationState(previous => ({
      ...previous,
      draft: removeX4UiManualCalibrationPoint(previous.draft, index),
    }));
  };

  const addManualCalibration = (): void => {
    setManualCalibrationState(previous => addX4UiManualCalibrationDraft(previous));
  };

  const toggleManualCalibration = (rowId: string): void => {
    setManualCalibrationState(previous => toggleX4UiManualCalibrationRow(previous, rowId));
  };

  const removeManualCalibration = (rowId: string): void => {
    setManualCalibrationState(previous => removeX4UiManualCalibrationRow(previous, rowId));
  };

  const updateSample = (entryId: string, raw: string): void => {
    const result = updateX4UiEditorSampleState(sampleInput, projection.sampleCatalog, entryId, raw, projection.sampleCatalogAuthority);
    setSampleInput(result.samples);
    setSampleError(result.status === 'refused' ? result.message : undefined);
  };

  const stageSourceEdit = (entryId: string, raw: string): void => {
    const executionContext = sourceEditContextRef.current;
    if (executionContext === null || executionContext !== sourceEditContext) return;
    setSourceEditDraft(previous => {
      if (sourceEditContextRef.current !== executionContext) return previous;
      const previousMatches = previous.context !== null
        && !shouldClearX4UiSourceEditState(previous.context, executionContext);
      return {
        context: executionContext,
        staged: stageX4UiSourceEditInput(previousMatches ? previous.staged : {}, entryId, raw),
      };
    });
  };

  const refuseSourceEdit = (reason: string, detail: string): void => {
    setSourceEditDraft({
      context: sourceEditContext,
      staged: {},
      receipt: { status: 'refused', reason, detail },
    });
  };

  const applySourceEdit = (entryId: string): void => {
    const executionContext = sourceEditContextRef.current;
    const executionDraft = sourceEditDraftRef.current;
    if (
      executionContext === null
      || executionContext !== sourceEditContext
      || executionDraft !== sourceEditDraft
    ) return;
    if (!sourceEditDraftMatches) {
      refuseSourceEdit('stale-editor-context', 'source edit staging was cleared because the current session projection changed');
      return;
    }
    const catalog = sourceEditCatalog;
    if (catalog === undefined || currentProgram === undefined || currentEvidenceAuthority === undefined) {
      refuseSourceEdit('catalog-unavailable', 'the exact current session has no projected source-edit catalog');
      return;
    }
    if (!Object.prototype.hasOwnProperty.call(executionDraft.staged, entryId)) return;
    const raw = executionDraft.staged[entryId];
    let result: X4UiSourceEditResult | X4UiSourceStructuralEditResult;
    const blockEntry = catalog.insertEntries?.find(candidate => candidate.id === entryId && candidate.kind === 'insert-block');
    if (blockEntry !== undefined) {
      result = applyX4UiSourceStructuralEdit(
        executionContext.workspace as Parameters<typeof applyX4UiSourceStructuralEdit>[0],
        projection.source,
        catalog,
        blockEntry.id,
        raw,
        blockEntry.path,
        blockEntry.startOffset,
        blockEntry.endOffset,
        blockEntry.expectedText,
      );
    } else {
      const entry = catalog.entries.find(candidate => candidate.id === entryId);
      if (entry === undefined) {
        refuseSourceEdit('entry-not-found', 'the selected entry is not in the exact current owner-issued catalog');
        return;
      }
      if (entry.kind !== 'editable') {
        refuseSourceEdit(entry.reason, entry.detail);
        return;
      }
      const parsed = parseX4UiSourceEditInput(entry, raw);
      if (parsed.accepted === false) {
        refuseSourceEdit(parsed.reason, parsed.detail);
        return;
      }
      result = applyX4UiSourceEdit(
        executionContext.workspace as Parameters<typeof applyX4UiSourceEdit>[0],
        projection.source,
        catalog,
        entry.id,
        parsed.value,
        entry.path,
        entry.startOffset,
        entry.endOffset,
        entry.expectedText,
      );
    }
    if (result.accepted === false) {
      refuseSourceEdit(result.reason, result.detail);
      return;
    }
    const parentResult = submitX4UiSourceEditWorkspaceCommit(
      executionContext.workspace,
      result.workspace,
      onWorkspaceEdit,
    );
    if (parentResult.status === 'refused') {
      refuseSourceEdit(parentResult.reason, parentResult.detail);
      return;
    }
    const acceptedDetail = result.changed
      ? `${result.path} bytes ${result.startOffset}-${result.endOffset} changed; session and preview reprojected from exact parent acknowledgement · ${X4_UI_EDITOR_SESSION_GAME_TRUTH}`
      : `owner reported no source-byte change; exact parent commit attempt acknowledged the original workspace identity · ${X4_UI_EDITOR_SESSION_GAME_TRUTH}`;
    const pendingContext = executionContext;
    const pendingReceipt: Extract<X4UiSourceEditUiReceipt, { readonly status: 'pending' }> = {
      status: 'pending',
      submission: parentResult,
      context: pendingContext,
      changed: result.changed,
      detail: parentResult.detail,
      acceptedDetail,
    };
    const pendingDraft: X4UiSourceEditDraftState = {
      context: pendingContext,
      staged: {},
      receipt: pendingReceipt,
    };
    setSourceEditDraft(previous => {
      if (
        sourceEditContextRef.current !== pendingContext
        || sourceEditDraftRef.current !== executionDraft
        || previous !== executionDraft
        || previous.context !== pendingContext
      ) return previous;
      return pendingDraft;
    });
    void parentResult.acknowledgement.then(
      acknowledgement => {
        const currentContext = sourceEditContextRef.current;
        if (currentContext === null || currentContext !== pendingContext) return;
        setSourceEditDraft(previous => {
          if (
            sourceEditContextRef.current !== currentContext
            || sourceEditContextRef.current !== pendingContext
            || sourceEditDraftRef.current !== pendingDraft
            || previous !== pendingDraft
            || previous.context !== pendingContext
            || previous.receipt !== pendingReceipt
          ) return previous;
          const settledReceipt = settleX4UiSourceEditReceipt(
            currentContext.workspace,
            pendingReceipt,
            acknowledgement,
            currentContext,
          );
          if (settledReceipt.status === 'pending') return previous;
          return {
            context: pendingContext,
            staged: {},
            receipt: settledReceipt,
          };
        });
      },
      () => {
        const currentContext = sourceEditContextRef.current;
        if (currentContext === null || currentContext !== pendingContext) return;
        setSourceEditDraft(previous => {
          if (
            sourceEditContextRef.current !== currentContext
            || sourceEditContextRef.current !== pendingContext
            || sourceEditDraftRef.current !== pendingDraft
            || previous !== pendingDraft
            || previous.context !== pendingContext
            || previous.receipt !== pendingReceipt
          ) return previous;
          return {
            context: pendingContext,
            staged: {},
            receipt: {
              status: 'refused',
              reason: 'invalid-parent-workspace-acknowledgement',
              detail: 'parent acknowledgement promise rejected before exact commit confirmation',
            },
          };
        });
      },
    );
  };

  const selectedTargetIdentity = asRecord(selection.selection?.target);
  const selectedTargetId = stringValue(selectedTargetIdentity?.id, 'unavailable');
  const selectedTargetName = stringValue(selectedTargetIdentity?.name, selectedTargetId);
  const selectedTargetKind = stringValue(selectedTargetIdentity?.kind, 'unavailable');
  const normalizedProfileRecord = asRecord(projectionView.normalizedProfile);
  const normalizedDrawable = asRecord(normalizedProfileRecord?.drawable);
  const exportProfileId = stringValue(normalizedProfileRecord?.id, 'unavailable');
  const exportProfileWidth = formatNumber(normalizedDrawable?.width);
  const exportProfileHeight = formatNumber(normalizedDrawable?.height);
  const exportEffectiveScale = formatNumber(normalizedProfileRecord?.uiScale);
  const mountedCanvas = canvasHostRef.current?.firstElementChild;
  const canvasExportClassification = classifyX4UiCanvasExport({
    state: canvasState,
    mountedCanvas,
    currentIdentity: currentVerificationSnapshot,
    committedIdentity: canvasExportIdentityRef.current,
  });
  const canvasExportReady = canvasExportClassification.status === 'available';
  const canvasExportStatusText = canvasExportFeedback
    ?? (canvasExportReady
      ? 'ready · native PNG export uses the mounted current canvas'
      : `unavailable · ${canvasExportClassification.detail}`);
  const nativeBitmapWidth = canvasExportReady ? formatNumber(canvasExportClassification.width) : 'unavailable';
  const nativeBitmapHeight = canvasExportReady ? formatNumber(canvasExportClassification.height) : 'unavailable';

  const handleCanvasExport = (): void => {
    if (canvasExportInFlightRef.current) return;
    const currentMountedCanvas = canvasHostRef.current?.firstElementChild;
    const classification = classifyX4UiCanvasExport({
      state: canvasStateRef.current,
      mountedCanvas: currentMountedCanvas,
      currentIdentity: currentVerificationSnapshotRef.current,
      committedIdentity: canvasExportIdentityRef.current,
    });
    if (classification.status !== 'available' || classification.filename === undefined) {
      setCanvasExportFeedback(`refused: ${classification.detail}`);
      return;
    }
    const canvasConstructor = typeof HTMLCanvasElement === 'undefined' ? null : HTMLCanvasElement;
    if (canvasConstructor === null || !(currentMountedCanvas instanceof canvasConstructor)) {
      setCanvasExportFeedback('refused: the current mounted surface is not an HTMLCanvasElement.');
      return;
    }
    const canvas = currentMountedCanvas;
    const filename = classification.filename;
    const identityKey = classification.identityKey;
    canvasExportInFlightRef.current = true;
    setCanvasExportFeedback('serializing current canvas as image/png…');
    let callbackSettled = false;
    const refuse = (detail: string): void => {
      canvasExportInFlightRef.current = false;
      if (canvasHostRef.current !== null) setCanvasExportFeedback(`refused: ${detail}`);
    };
    try {
      const toBlob = canvas.toBlob;
      if (typeof toBlob !== 'function') {
        callbackSettled = true;
        refuse('native PNG serialization is unavailable.');
        return;
      }
      toBlob.call(canvas, blob => {
        if (callbackSettled) return;
        callbackSettled = true;
        const liveMountedCanvas = canvasHostRef.current?.firstElementChild;
        const liveClassification = classifyX4UiCanvasExport({
          state: canvasStateRef.current,
          mountedCanvas: liveMountedCanvas,
          currentIdentity: currentVerificationSnapshotRef.current,
          committedIdentity: canvasExportIdentityRef.current,
        });
        if (liveMountedCanvas !== canvas
          || liveClassification.status !== 'available'
          || liveClassification.filename !== filename
          || liveClassification.identityKey !== identityKey) {
          refuse('the current source, target, profile, or mounted canvas changed before serialization completed.');
          return;
        }
        const blobConstructor = typeof Blob === 'undefined' ? null : Blob;
        let blobType = '';
        let blobSize = 0;
        try {
          blobType = typeof blob?.type === 'string' ? blob.type.toLowerCase() : '';
          blobSize = typeof blob?.size === 'number' ? blob.size : 0;
        } catch {
          refuse('native PNG serialization returned an unreadable blob.');
          return;
        }
        if (blobConstructor === null || !(blob instanceof blobConstructor) || blobSize <= 0 || blobType !== 'image/png') {
          refuse('native PNG serialization returned an empty or non-PNG blob.');
          return;
        }
        let objectUrl: string | undefined;
        let downloaded = false;
        let cleanupFailed = false;
        let failureDetail = 'native PNG download could not be created.';
        try {
          if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function' || typeof URL.revokeObjectURL !== 'function') {
            failureDetail = 'object URL support is unavailable for the native PNG download.';
            throw new Error(failureDetail);
          }
          if (typeof document === 'undefined' || document.body === null) {
            failureDetail = 'the document download host is unavailable.';
            throw new Error(failureDetail);
          }
          objectUrl = URL.createObjectURL(blob);
          const anchor = document.createElement('a');
          anchor.href = objectUrl;
          anchor.download = filename;
          anchor.style.display = 'none';
          document.body.appendChild(anchor);
          try {
            anchor.click();
            downloaded = true;
          } finally {
            anchor.remove();
          }
        } catch {
          downloaded = false;
        } finally {
          if (objectUrl !== undefined) {
            try {
              URL.revokeObjectURL(objectUrl);
            } catch {
              cleanupFailed = true;
            }
          }
        }
        if (cleanupFailed) {
          refuse('native PNG object URL cleanup failed.');
          return;
        }
        if (!downloaded) {
          refuse(failureDetail);
          return;
        }
        canvasExportInFlightRef.current = false;
        if (canvasHostRef.current !== null) setCanvasExportFeedback(`exported one image/png · ${filename} · ${X4_UI_EDITOR_SESSION_GAME_TRUTH}`);
      }, 'image/png');
    } catch {
      if (!callbackSettled) {
        callbackSettled = true;
        refuse('native PNG serialization threw before producing a blob.');
      }
    }
  };

  const width = positiveValue(asRecord(profileValue)?.width);
  const height = positiveValue(asRecord(profileValue)?.height);
  const uiScale = profileScale(profileValue);
  const normalizedProfile = asRecord(projectionView.normalizedProfile);

  return (
    <section data-testid="x4-ui-source-editor" className="flex-1 min-h-0 overflow-y-auto bg-[#090c12] p-3 text-slate-300 font-mono text-[11px]">
      <div className="mb-3 rounded border border-amber-500/30 bg-amber-950/15 p-3">
        <div data-testid="x4-ui-game-truth" className="font-bold text-amber-300">{X4_UI_EDITOR_SESSION_GAME_TRUTH}</div>
        <div className="mt-1 text-slate-500">Preview is for layout inspection; static analysis is not engine acceptance.</div>
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <section data-testid="x4-ui-profile-region" className="rounded border border-white/10 bg-black/20 p-3">
          <h2 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-cyan-300">Profile controls</h2>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-slate-500">
              Drawable width
              <input data-testid="x4-ui-profile-width" type="number" min="0.000001" step="any" value={width === null ? '' : width} onChange={event => updateProfileDimension('width', event.target.value)} className="rounded border border-white/10 bg-black/40 px-2 py-1 text-slate-200" />
            </label>
            <label className="flex flex-col gap-1 text-slate-500">
              Drawable height
              <input data-testid="x4-ui-profile-height" type="number" min="0.000001" step="any" value={height === null ? '' : height} onChange={event => updateProfileDimension('height', event.target.value)} className="rounded border border-white/10 bg-black/40 px-2 py-1 text-slate-200" />
            </label>
          </div>
          <div className="mt-2 grid grid-cols-1 gap-2 lg:grid-cols-3">
            <label className="flex flex-col gap-1 text-slate-500">
              Source Editor scale mode
              <select data-testid="x4-ui-profile-scale-mode" value={scaleMode} onChange={event => updateScaleMode(event.target.value)} className="rounded border border-white/10 bg-black/40 px-2 py-1 text-slate-200">
                <option value={X4_UI_SOURCE_EDITOR_SCALE_MODE_DERIVED}>Derived from X4 user scale</option>
                <option value={X4_UI_SOURCE_EDITOR_SCALE_MODE_CUSTOM}>Custom effective Helper scale</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-slate-500">
              X4 user scale factor
              <input data-testid="x4-ui-profile-user-scale" type="number" min="0.000001" step="any" value={userScale} onChange={event => updateUserScale(event.target.value)} className="rounded border border-white/10 bg-black/40 px-2 py-1 text-slate-200" />
            </label>
            <label className="flex flex-col gap-1 text-slate-500">
              Effective Helper scale
              <input data-testid="x4-ui-profile-scale" type="number" min="0.000001" step="any" value={uiScale === null ? '' : uiScale} disabled={scaleMode !== X4_UI_SOURCE_EDITOR_SCALE_MODE_CUSTOM} onChange={event => updateProfileDimension('uiScale', event.target.value)} className="rounded border border-white/10 bg-black/40 px-2 py-1 text-slate-200" />
            </label>
          </div>
          <div data-testid="x4-ui-profile-scale-derivation" className="mt-2 text-slate-500">Derived effective Helper scale = X4 user scale × drawable height ÷ 1080. Drawable width does not affect the derived value. Custom mode retains its effective value across height changes.</div>
          <div className="mt-2 text-slate-500">Truth grade: <span data-testid="x4-ui-profile-truth" className="text-amber-300">{stringValue(normalizedProfile?.truthGrade, 'unverified-default')}</span></div>
          <div className="text-slate-500">Profile: <span>{stringValue(normalizedProfile?.id, 'x4-ui-editor-default')}</span> · drawable {formatNumber(width)} × {formatNumber(height)} · effective Helper scale {formatNumber(uiScale)} · {X4_UI_EDITOR_SESSION_GAME_TRUTH}</div>
        </section>

        <section data-testid="x4-ui-corpus-region" className="rounded border border-white/10 bg-black/20 p-3">
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-[10px] font-bold uppercase tracking-wider text-cyan-300">Configured X4 corpus</h2>
            <button type="button" data-testid="x4-ui-corpus-reload" onClick={() => setCorpusGeneration(value => value + 1)} className="rounded border border-cyan-500/30 px-2 py-1 text-[9px] font-bold uppercase text-cyan-300">Reload</button>
          </div>
          <div className="mt-2 text-slate-400">Status: <span data-testid="x4-ui-corpus-status" className="font-bold text-slate-200">{statusLabel(corpusState.status)}</span></div>
          <div data-testid="x4-ui-corpus-detail" className="mt-1 break-words text-slate-500">{corpusState.detail}</div>
          <div className="mt-2 text-slate-400">Canonical-default color: <span data-testid="x4-ui-corpus-color-status" className="font-bold text-slate-200">{statusLabel(corpusState.colorStatus)}</span></div>
          <div data-testid="x4-ui-corpus-color-detail" className="mt-1 break-words text-slate-500">{corpusState.colorDetail}</div>
          <div className="mt-1 text-slate-600">Canonical status is accepted only from the configured loader.</div>
        </section>
      </div>

      <section data-testid="x4-ui-source-region" className="mt-3 rounded border border-white/10 bg-black/20 p-3">
        <h2 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-cyan-300">Source and target selection</h2>
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
          <label className="flex flex-col gap-1 text-slate-500">
            Exact source
            <select data-testid="x4-ui-source-selector" value={sourceSelector} onChange={event => selectSource(event.target.value)} className="rounded border border-white/10 bg-black/40 px-2 py-1 text-slate-200">
              <option value="">Select source…</option>
              {selection.candidates.map(candidate => <option key={candidate.key} value={candidate.key}>{candidate.path}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-slate-500">
            Exact target
            <select data-testid="x4-ui-target-selector" value={targetSelector} onChange={event => setTargetSelector(event.target.value)} className="rounded border border-white/10 bg-black/40 px-2 py-1 text-slate-200">
              <option value="">Select target…</option>
              {targetOptions.map(target => <option key={target.key} value={target.key}>{target.label}</option>)}
            </select>
          </label>
        </div>
        <div className="mt-2 text-slate-500">Selected source identity: <span data-testid="x4-ui-selected-source-identity" className="break-all text-slate-300">{selectedSourceFile} · {selectedSourceHash}</span></div>
      </section>

      <section data-testid="x4-ui-source-authority" className="mt-3 rounded border border-white/10 bg-black/20 p-3">
        <h2 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-cyan-300">Source authority</h2>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 lg:grid-cols-4">
          <div>Status: <span className="text-slate-200">{sourceStatusText(source, 'status')}</span></div>
          <div>Availability: <span className="text-slate-200">{sourceStatusText(source, 'availability')}</span></div>
          <div>Editable: <span className="text-slate-200">{String(boolValue(source?.editable))}</span></div>
          <div>Shippable: <span className="text-slate-200">{String(boolValue(source?.shippable))}</span></div>
          <div>Registration: <span className="text-slate-200">{String(asArray(source?.registeredLuaFiles).length)} registered Lua file(s)</span></div>
          <div>Generated shadow lock: <span className="text-slate-200">{String(source?.status === 'generated-shadowing-source' || boolValue(source?.locked))}</span></div>
        </div>
        <div className="mt-2 text-slate-500">{stringValue(source?.detail, 'Source authority is unavailable.')}</div>
        <div className="mt-1 break-words text-slate-500">Reasons: {asArray(source?.reasons).map(value => String(value)).join(', ') || stringValue(source?.reason, 'none')}</div>
        <div className="mt-1 break-words text-slate-500">Generated collisions: {asArray(asRecord(source?.compile)?.generatedCollisions).map(value => String(value)).join(', ') || 'none'}</div>
      </section>

      {sourceEditCatalog === undefined ? (
        <section data-testid="x4-ui-source-edits" className="mt-3 rounded border border-white/10 bg-black/20 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[10px] font-bold uppercase tracking-wider text-cyan-300">Source-safe property controls</h2>
            <span data-testid="x4-ui-source-edit-verification" className="text-[9px] font-bold text-amber-300">{X4_UI_EDITOR_SESSION_GAME_TRUTH}</span>
          </div>
          <div className="mt-2 text-slate-500">Select an exact source and target with a projected current session to expose owner-issued scalar literals. No caller-supplied catalog, program, evidence, source, target, or profile is accepted.</div>
        </section>
      ) : (
        <X4UiSourceEditorSourceEdits
          catalog={sourceEditCatalog}
          staged={visibleSourceEditStaged}
          receipt={visibleSourceEditReceipt}
          onStage={stageSourceEdit}
          onApply={applySourceEdit}
        />
      )}

      <X4UiSourceEditorLinter inspection={lintInspection} />

      <X4UiSourceEditorPreviewGeometry scene={projection.preview.scene} />

      <X4UiSourceEditorSamples
        catalog={projection.sampleCatalog}
        samples={projection.samples}
        onSampleInput={updateSample}
        error={sampleError}
      />

      <section data-testid="x4-ui-keepout-region" className="mt-3 rounded border border-white/10 bg-black/20 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[10px] font-bold uppercase tracking-wider text-cyan-300">Context keep-outs</h2>
          <div className="flex flex-wrap gap-1">
            <button type="button" data-testid="x4-ui-keepout-off" onClick={() => selectPreset(null)} className={`rounded border px-2 py-1 text-[9px] uppercase ${activePresetId === null ? 'border-cyan-400 text-cyan-300' : 'border-white/10 text-slate-500'}`}>Off</button>
            {KEEP_OUT_PRESETS.map(preset => <button type="button" key={preset.id} data-testid={`x4-ui-keepout-preset-${preset.id}`} onClick={() => selectPreset(preset.id)} className={`rounded border px-2 py-1 text-[9px] uppercase ${activePresetId === preset.id ? 'border-cyan-400 text-cyan-300' : 'border-white/10 text-slate-500'}`}>{preset.label}</button>)}
          </div>
        </div>
        <div className="mt-2 grid grid-cols-1 gap-2 xl:grid-cols-2">
          {KEEP_OUT_PRESETS.map(preset => {
            const sessionPreset = sourceKeepOutPresets.find(value => asRecord(value)?.id === preset.id);
            return (
              <article key={preset.id} className="rounded border border-white/10 bg-black/25 p-2">
                <div className="font-bold text-slate-200">{preset.label}</div>
                <div className="mt-1 space-y-1">
                  {preset.members.map(member => {
                    const sessionMember = keepOutMemberFor(sessionPreset, member.entryId);
                    const sessionMemberRecord = sessionMember;
                    const entry = asRecord(sessionMemberRecord?.entry);
                    const label = stringValue(entry?.label, member.entryId);
                    const enabled = boolValue(sessionMemberRecord?.enabled);
                    const presetActive = activePresetId === preset.id;
                    return (
                      <label key={member.entryId} className="flex items-start gap-2 text-slate-500">
                        <input type="checkbox" checked={isX4UiKeepOutEntryChecked(activePresetId, preset.id, enabledEntryIds, member.entryId)} disabled={!presetActive} onChange={() => toggleEntry(preset.id, member.entryId)} />
                        <span><span className="text-slate-300">{label}</span> · {keepOutEvidence(sessionMemberRecord)} · {member.evidenceGrade} · {member.applicabilityEvidence}{enabled ? '' : ' · unavailable in active preset'}</span>
                      </label>
                    );
                  })}
                </div>
              </article>
            );
          })}
        </div>
        <div data-testid="x4-ui-manual-calibration-region" className="mt-3 rounded border border-violet-500/30 bg-violet-950/10 p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-violet-300">Manual screenshot-polygon calibration</h3>
              <div className="mt-1 text-slate-500">Session-local draft only. Add stores the plain calibration input; the accepted Session, Paint, and Canvas owners remain authoritative.</div>
            </div>
            <span data-testid="x4-ui-manual-calibration-truth" className="font-bold text-amber-300">Advisory only · {X4_UI_EDITOR_SESSION_GAME_TRUTH}</span>
          </div>
          <div className="mt-2 grid grid-cols-1 gap-2 lg:grid-cols-2">
            <label className="flex flex-col gap-1 text-slate-500">
              Stable ID
              <input data-testid="x4-ui-manual-calibration-stable-id" type="text" value={manualCalibrationState.draft.stableId} onChange={event => updateManualDraftField('stableId', event.target.value)} className="rounded border border-white/10 bg-black/40 px-2 py-1 text-slate-200" />
            </label>
            <label className="flex flex-col gap-1 text-slate-500">
              Context
              <input data-testid="x4-ui-manual-calibration-context" type="text" value={manualCalibrationState.draft.context} onChange={event => updateManualDraftField('context', event.target.value)} className="rounded border border-white/10 bg-black/40 px-2 py-1 text-slate-200" />
            </label>
            <label className="flex flex-col gap-1 text-slate-500 lg:col-span-2">
              Source note
              <input data-testid="x4-ui-manual-calibration-source-note" type="text" value={manualCalibrationState.draft.sourceNote} onChange={event => updateManualDraftField('sourceNote', event.target.value)} className="rounded border border-white/10 bg-black/40 px-2 py-1 text-slate-200" />
            </label>
            <label className="flex flex-col gap-1 text-slate-500">
              Screenshot SHA-256/hash
              <input data-testid="x4-ui-manual-calibration-screenshot-hash" type="text" value={manualCalibrationState.draft.screenshotHash} onChange={event => updateManualDraftField('screenshotHash', event.target.value)} className="rounded border border-white/10 bg-black/40 px-2 py-1 text-slate-200" />
            </label>
            <label className="flex flex-col gap-1 text-slate-500">
              Screenshot profile
              <input data-testid="x4-ui-manual-calibration-profile" type="text" value={manualCalibrationState.draft.profile} onChange={event => updateManualDraftField('profile', event.target.value)} className="rounded border border-white/10 bg-black/40 px-2 py-1 text-slate-200" />
            </label>
          </div>
          <div className="mt-2 rounded border border-white/10 bg-black/20 p-2">
            <div className="font-bold text-slate-300">Drawable bounds (screenshot pixels)</div>
            <div className="mt-2 grid grid-cols-2 gap-2 lg:grid-cols-4">
              <label className="flex flex-col gap-1 text-slate-500">Left<input data-testid="x4-ui-manual-calibration-drawable-left" type="number" step="any" value={manualCalibrationState.draft.drawableLeft} onChange={event => updateManualDraftField('drawableLeft', event.target.value)} className="rounded border border-white/10 bg-black/40 px-2 py-1 text-slate-200" /></label>
              <label className="flex flex-col gap-1 text-slate-500">Top<input data-testid="x4-ui-manual-calibration-drawable-top" type="number" step="any" value={manualCalibrationState.draft.drawableTop} onChange={event => updateManualDraftField('drawableTop', event.target.value)} className="rounded border border-white/10 bg-black/40 px-2 py-1 text-slate-200" /></label>
              <label className="flex flex-col gap-1 text-slate-500">Width<input data-testid="x4-ui-manual-calibration-drawable-width" type="number" step="any" value={manualCalibrationState.draft.drawableWidth} onChange={event => updateManualDraftField('drawableWidth', event.target.value)} className="rounded border border-white/10 bg-black/40 px-2 py-1 text-slate-200" /></label>
              <label className="flex flex-col gap-1 text-slate-500">Height<input data-testid="x4-ui-manual-calibration-drawable-height" type="number" step="any" value={manualCalibrationState.draft.drawableHeight} onChange={event => updateManualDraftField('drawableHeight', event.target.value)} className="rounded border border-white/10 bg-black/40 px-2 py-1 text-slate-200" /></label>
            </div>
          </div>
          <div className="mt-2 rounded border border-white/10 bg-black/20 p-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-bold text-slate-300">Polygon points (screenshot pixels)</div>
              <button type="button" data-testid="x4-ui-manual-calibration-add-point" onClick={addManualDraftPoint} className="rounded border border-violet-500/30 px-2 py-1 text-[9px] font-bold uppercase text-violet-300">Add point</button>
            </div>
            <div className="mt-2 space-y-1">
              {manualCalibrationState.draft.points.map((point, index) => (
                <div key={index} data-testid={`x4-ui-manual-calibration-point-${index}`} className="flex flex-wrap items-end gap-2">
                  <label className="flex min-w-28 flex-1 flex-col gap-1 text-slate-500">Point {index + 1} x<input data-testid={`x4-ui-manual-calibration-point-${index}-x`} type="number" step="any" value={point.x} onChange={event => updateManualDraftPoint(index, 'x', event.target.value)} className="rounded border border-white/10 bg-black/40 px-2 py-1 text-slate-200" /></label>
                  <label className="flex min-w-28 flex-1 flex-col gap-1 text-slate-500">Point {index + 1} y<input data-testid={`x4-ui-manual-calibration-point-${index}-y`} type="number" step="any" value={point.y} onChange={event => updateManualDraftPoint(index, 'y', event.target.value)} className="rounded border border-white/10 bg-black/40 px-2 py-1 text-slate-200" /></label>
                  <button type="button" data-testid={`x4-ui-manual-calibration-remove-point-${index}`} onClick={() => removeManualDraftPoint(index)} className="rounded border border-white/10 px-2 py-1 text-[9px] uppercase text-slate-400">Remove point</button>
                </div>
              ))}
            </div>
          </div>
          <button type="button" data-testid="x4-ui-manual-calibration-add" onClick={addManualCalibration} className="mt-2 rounded border border-violet-500/30 px-2 py-1 text-[9px] font-bold uppercase text-violet-300">Add calibration · reset draft</button>
          <div className="mt-2 space-y-2">
            {manualCalibrationState.rows.map(row => {
              const acceptedIndex = manualSessionInput.acceptedRowIds.indexOf(row.rowId);
              const localRefusal = manualSessionInput.refusedRows.find(candidate => candidate.rowId === row.rowId);
              const sessionProjection = acceptedIndex < 0 ? undefined : projection.manualCalibrations[acceptedIndex];
              const sessionProjectionRecord = asRecord(sessionProjection);
              const entry = asRecord(sessionProjectionRecord?.entry);
              const provenance = asRecord(sessionProjectionRecord?.evidence) ?? asRecord(entry?.provenance);
              const screenshot = asRecord(provenance?.screenshot);
              const drawableBounds = asRecord(provenance?.drawableBounds);
              const geometry = asRecord(entry?.geometry);
              const normalizedPoints = asArray(geometry?.points);
              const explicitEnabled = manualCalibrationState.enabledManualRowIds.includes(row.rowId);
              const refusedReason = localRefusal?.reason ?? stringValue(sessionProjectionRecord?.reason, 'session-projection-unavailable');
              const refusedMessage = localRefusal?.message ?? stringValue(sessionProjectionRecord?.message, 'Session did not accept this calibration.');
              const calibrated = localRefusal === undefined && sessionProjectionRecord?.status === 'success';
              return (
                <article key={row.rowId} data-testid={`x4-ui-manual-calibration-row-${row.rowId}`} className="rounded border border-white/10 bg-black/30 p-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-bold text-slate-200">{row.draft.stableId || '(empty stable ID)'} · {row.draft.context || '(empty context)'}</div>
                      <div data-testid={`x4-ui-manual-calibration-status-${row.rowId}`} className={calibrated ? 'mt-1 text-emerald-300' : 'mt-1 text-red-300'}>{calibrated ? `Calibrated · ${explicitEnabled ? 'enabled' : 'disabled'}` : `Refused: ${refusedReason} · ${refusedMessage}`}</div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="flex items-center gap-1 text-[9px] uppercase text-slate-400">
                        <input type="checkbox" data-testid={`x4-ui-manual-calibration-enable-${row.rowId}`} checked={explicitEnabled} disabled={row.draft.stableId.trim().length === 0} onChange={() => toggleManualCalibration(row.rowId)} />
                        Enabled
                      </label>
                      <button type="button" data-testid={`x4-ui-manual-calibration-remove-${row.rowId}`} onClick={() => removeManualCalibration(row.rowId)} className="rounded border border-red-500/30 px-2 py-1 text-[9px] font-bold uppercase text-red-300">Remove</button>
                    </div>
                  </div>
                  {calibrated && (
                    <>
                      <div className="mt-1 break-all text-slate-400">Screenshot hash: <span className="text-slate-200">{stringValue(screenshot?.hash, 'unavailable')}</span> · profile: <span className="text-slate-200">{stringValue(screenshot?.profile, 'unavailable')}</span></div>
                      <div className="mt-1 break-words text-slate-400">Drawable bounds: <span className="text-slate-200">left={String(drawableBounds?.left ?? 'unavailable')}, top={String(drawableBounds?.top ?? 'unavailable')}, width={String(drawableBounds?.width ?? 'unavailable')}, height={String(drawableBounds?.height ?? 'unavailable')}</span></div>
                      <div data-testid={`x4-ui-manual-calibration-evidence-${row.rowId}`} className="mt-1 break-all text-slate-400">Normalized polygon evidence: <span className="text-slate-200">{JSON.stringify(normalizedPoints)}</span></div>
                    </>
                  )}
                  <div className="mt-1 text-amber-300">Advisory only · {X4_UI_EDITOR_SESSION_GAME_TRUTH}</div>
                </article>
              );
            })}
            {manualCalibrationState.rows.length === 0 && <div data-testid="x4-ui-manual-calibration-empty" className="text-slate-500">No session-local manual calibrations have been added.</div>}
          </div>
        </div>
        <div className="mt-2 text-slate-600">Measured guides remain advisory: y=0.788, y=0.74, x=0.664. Mission/MESSAGES ticker and Top HUD strip remain unavailable/unmeasured; no rectangle is inferred.</div>
      </section>

      <section data-testid="x4-ui-preview-region" className="mt-3 rounded border border-white/10 bg-black/20 p-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[10px] font-bold uppercase tracking-wider text-cyan-300">Source preview canvas</h2>
          <span data-testid="x4-ui-canvas-status" className={canvasDescription.status === 'current' ? 'text-slate-300' : 'text-amber-300'}>{canvasDescription.label}</span>
        </div>
        <section data-testid="x4-ui-canvas-export-region" className="mt-2 rounded border border-emerald-500/30 bg-emerald-950/10 p-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">Current PNG evidence export</h3>
            <button type="button" data-testid="x4-ui-canvas-export" disabled={!canvasExportReady || canvasExportInFlightRef.current} onClick={handleCanvasExport} className="rounded border border-emerald-500/40 px-2 py-1 text-[9px] font-bold uppercase text-emerald-300 disabled:cursor-not-allowed disabled:border-white/10 disabled:text-slate-600">Export current PNG</button>
          </div>
          <div data-testid="x4-ui-canvas-export-status" className="mt-2 break-words text-amber-200">{canvasExportStatusText}</div>
          <div data-testid="x4-ui-canvas-export-metadata" className="mt-2 grid grid-cols-1 gap-1 text-slate-400 lg:grid-cols-2">
            <div data-testid="x4-ui-canvas-export-source">Source file: <span className="break-all text-slate-200">{selectedSourceFile} · sha256 {selectedSourceHash}</span></div>
            <div data-testid="x4-ui-canvas-export-target">Target: <span className="break-all text-slate-200">{selectedTargetName} · id {selectedTargetId} · kind {selectedTargetKind}</span></div>
            <div data-testid="x4-ui-canvas-export-profile">Profile: <span className="text-slate-200">{exportProfileId} · drawable {exportProfileWidth} × {exportProfileHeight} · Effective Helper scale {exportEffectiveScale}</span></div>
            <div data-testid="x4-ui-canvas-export-native-bitmap">Native bitmap: <span data-testid="x4-ui-canvas-export-native-width" className="text-slate-200">{nativeBitmapWidth}</span> × <span data-testid="x4-ui-canvas-export-native-height" className="text-slate-200">{nativeBitmapHeight}</span></div>
          </div>
          <div data-testid="x4-ui-canvas-export-boundary" className="mt-2 font-bold text-amber-300">Preview evidence only · {X4_UI_EDITOR_SESSION_GAME_TRUTH}</div>
        </section>
        <div data-testid="x4-ui-canvas-host" ref={canvasHostRef} className="mt-2 flex min-h-24 max-h-[70vh] items-start justify-start overflow-auto rounded border border-white/10 bg-black/40 p-2" />
        <div data-testid="x4-ui-canvas-detail" className="mt-2 text-slate-500">{canvasDescription.detail} · {X4_UI_EDITOR_SESSION_GAME_TRUTH}</div>
      </section>
    </section>
  );
}
