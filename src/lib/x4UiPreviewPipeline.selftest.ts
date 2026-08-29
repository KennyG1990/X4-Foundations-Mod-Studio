import type { ModWorkspace, PassthroughFile } from '../types';
import {
  buildX4UiWorkspaceSource,
  type X4UiWorkspaceSource,
} from './x4UiWorkspaceSource';
import {
  createX4UiLayoutTargetCatalog,
  projectX4UiLayoutProgram,
  type X4UiLayoutPreviewSampleInput,
  type X4UiLayoutPreviewPathSelectionInput,
} from './x4UiLayoutProgram';
import {
  HELPER_SOURCE_PATH,
  WIDGET_SOURCE_PATH,
  X4_UI_CORPUS_FILE_URL,
  X4_UI_CORPUS_MANIFEST_URL,
  X4_UI_CORPUS_STATUS_URL,
  X4_UI_CORPUS_9_00_CONTRACT,
  X4_UI_CORPUS_COLORS_XML_PATH,
  X4_UI_CORPUS_COLORS_XML_SHA256,
  X4_UI_CORPUS_COLORS_XML_SIZE,
  X4_UI_CORPUS_COLORS_XSD_PATH,
  X4_UI_CORPUS_COLORS_XSD_SHA256,
  X4_UI_CORPUS_COLORS_XSD_SIZE,
  isX4UiCorpusCanonicalColorSuccess,
  isX4UiCorpusCanonicalSuccess,
  loadCanonicalX4UiCorpusColorEvidence,
  loadCanonicalX4UiCorpusAssets,
  type X4UiCorpusCanonicalColorSuccess,
  type X4UiCorpusCanonicalSuccess,
  type X4UiCorpusFetchResponse,
} from './x4UiCorpusAssets';
import {
  ZEKTON_DDS_HEADER_SIZE,
  ZEKTON_DESCRIPTOR_HEADER_SIZE,
  ZEKTON_DESCRIPTOR_TRAILING_SIZE,
  ZEKTON_RECORD_SIZE,
} from './x4UiFontMetrics';
import {
  buildX4UiPreviewPipeline,
  buildX4UiPreviewProfile,
  projectX4UiPreviewPipeline,
  scaleSizeMinValue,
  type X4UiPreviewPipelineInput,
  type X4UiPreviewProfileInput,
  type X4UiPreviewSelection,
} from './x4UiPreviewPipeline';
import * as PreviewPipelineExports from './x4UiPreviewPipeline';
import type { X4UiSceneTableViewState } from './x4UiScene';

type Check = { readonly name: string; readonly pass: boolean; readonly detail?: unknown };
type JsonRecord = Record<string, unknown>;

const checks: Check[] = [];

function check(name: string, pass: boolean, detail?: unknown): void {
  checks.push({ name, pass, ...(detail === undefined ? {} : { detail }) });
}

function firstJsonDifference(left: unknown, right: unknown, path = '$'): string | undefined {
  if (Object.is(left, right)) return undefined;
  if (typeof left !== typeof right || left === null || right === null || typeof left !== 'object' || typeof right !== 'object') {
    return path;
  }
  if (Array.isArray(left) !== Array.isArray(right)) return path;
  if (Array.isArray(left) && Array.isArray(right)) {
    if (left.length !== right.length) return `${path}.length`;
    for (let index = 0; index < left.length; index += 1) {
      const difference = firstJsonDifference(left[index], right[index], `${path}[${index}]`);
      if (difference !== undefined) return difference;
    }
    return undefined;
  }
  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const leftKeys = Object.keys(leftRecord).sort();
  const rightKeys = Object.keys(rightRecord).sort();
  if (JSON.stringify(leftKeys) !== JSON.stringify(rightKeys)) return `${path}.keys`;
  for (const key of leftKeys) {
    const difference = firstJsonDifference(leftRecord[key], rightRecord[key], `${path}.${key}`);
    if (difference !== undefined) return difference;
  }
  return undefined;
}

function asRecord(value: unknown): JsonRecord | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord
    : undefined;
}

function sameJson(left: unknown, right: unknown): boolean {
  const leftJson = JSON.stringify(left);
  const rightJson = JSON.stringify(right);
  return leftJson !== undefined && leftJson === rightJson;
}

function issuedPaintSourceAuthority(result: unknown, scene: unknown): boolean {
  const predicate = (PreviewPipelineExports as unknown as Record<string, unknown>).isX4UiPreviewPaintSourceAuthority;
  if (typeof predicate !== 'function') return false;
  try {
    return (predicate as (candidateResult: unknown, candidateScene: unknown) => unknown)(result, scene) === true;
  } catch {
    return false;
  }
}

type SceneMaterializationAttempt = {
  readonly present: boolean;
  readonly threw: boolean;
  readonly value?: unknown;
  readonly error?: string;
};

function materializeIssuedPaintScene(result: unknown, scene: unknown): SceneMaterializationAttempt {
  const materializer = (PreviewPipelineExports as unknown as Record<string, unknown>).materializeX4UiPreviewPaintScene;
  if (typeof materializer !== 'function') return { present: false, threw: false };
  try {
    return {
      present: true,
      threw: false,
      value: (materializer as (candidateResult: unknown, candidateScene: unknown) => unknown)(result, scene),
    };
  } catch (caught) {
    return {
      present: true,
      threw: true,
      error: caught instanceof Error ? caught.message : String(caught),
    };
  }
}

type ClosedDomainFacts = {
  readonly records: number;
  readonly arrays: number;
  readonly nullPrototypeRecords: boolean;
  readonly denseCanonicalArrays: boolean;
  readonly dataDescriptorsOnly: boolean;
  readonly deeplyFrozen: boolean;
  readonly acyclic: boolean;
};

function closedDomainFacts(value: unknown): ClosedDomainFacts {
  let records = 0;
  let arrays = 0;
  let nullPrototypeRecords = true;
  let denseCanonicalArrays = true;
  let dataDescriptorsOnly = true;
  let deeplyFrozen = true;
  let acyclic = true;
  const active = new Set<object>();
  const completed = new Set<object>();
  const visit = (candidate: unknown): void => {
    if (candidate === null || typeof candidate !== 'object') return;
    if (active.has(candidate)) {
      acyclic = false;
      return;
    }
    if (completed.has(candidate)) return;
    active.add(candidate);
    deeplyFrozen = deeplyFrozen && Object.isFrozen(candidate);
    if (Object.getOwnPropertySymbols(candidate).length !== 0) dataDescriptorsOnly = false;
    if (Array.isArray(candidate)) {
      arrays += 1;
      const names = Object.getOwnPropertyNames(candidate);
      denseCanonicalArrays = denseCanonicalArrays
        && Object.getPrototypeOf(candidate) === Array.prototype
        && names.length === candidate.length + 1
        && names.every(name => name === 'length' || /^(0|[1-9][0-9]*)$/.test(name) && Number(name) < candidate.length);
      for (let index = 0; index < candidate.length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(candidate, String(index));
        if (descriptor === undefined || !descriptor.enumerable || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
          denseCanonicalArrays = false;
          dataDescriptorsOnly = false;
        } else {
          visit(descriptor.value);
        }
      }
    } else {
      records += 1;
      nullPrototypeRecords = nullPrototypeRecords && Object.getPrototypeOf(candidate) === null;
      for (const name of Object.getOwnPropertyNames(candidate)) {
        const descriptor = Object.getOwnPropertyDescriptor(candidate, name);
        if (descriptor === undefined || !descriptor.enumerable || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
          dataDescriptorsOnly = false;
        } else {
          visit(descriptor.value);
        }
      }
    }
    active.delete(candidate);
    completed.add(candidate);
  };
  visit(value);
  return { records, arrays, nullPrototypeRecords, denseCanonicalArrays, dataDescriptorsOnly, deeplyFrozen, acyclic };
}

function normalizeExistingJson<T>(value: T): T {
  if (Array.isArray(value)) {
    return Array.from(value, item => item === undefined ? null : normalizeExistingJson(item)) as T;
  }
  if (value !== null && typeof value === 'object') {
    const normalized: JsonRecord = {};
    for (const key of Object.keys(value as JsonRecord)) {
      const child = (value as JsonRecord)[key];
      if (child !== undefined) normalized[key] = normalizeExistingJson(child);
    }
    return normalized as T;
  }
  return value;
}

type NormalizationPaths = {
  readonly objectMembers: string[];
  readonly arraySlots: string[];
};

function undefinedPaths(value: unknown, path = '$', active = new Set<object>()): NormalizationPaths {
  const objectMembers: string[] = [];
  const arraySlots: string[] = [];
  if (value === null || typeof value !== 'object') return { objectMembers, arraySlots };
  if (active.has(value)) return { objectMembers, arraySlots };
  active.add(value);
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const childPath = `${path}[${index}]`;
      if (!Object.prototype.hasOwnProperty.call(value, index) || value[index] === undefined) {
        arraySlots.push(childPath);
      } else {
        const nested = undefinedPaths(value[index], childPath, active);
        objectMembers.push(...nested.objectMembers);
        arraySlots.push(...nested.arraySlots);
      }
    }
  } else {
    for (const key of Object.keys(value)) {
      const child = (value as JsonRecord)[key];
      const childPath = `${path}.${key}`;
      if (child === undefined) {
        objectMembers.push(childPath);
      } else {
        const nested = undefinedPaths(child, childPath, active);
        objectMembers.push(...nested.objectMembers);
        arraySlots.push(...nested.arraySlots);
      }
    }
  }
  active.delete(value);
  return { objectMembers, arraySlots };
}

type NormalizationComparison = {
  readonly pass: boolean;
  readonly reason?: string;
  readonly rawJson: string | undefined;
  readonly normalizedJson: string | undefined;
  readonly jsonBytesEqual: boolean;
  readonly undefinedObjectMembers: readonly string[];
  readonly undefinedArraySlots: readonly string[];
};

function compareAllowedNormalization(raw: unknown, normalized: unknown): NormalizationComparison {
  const rawJson = JSON.stringify(raw);
  const normalizedJson = JSON.stringify(normalized);
  const paths = undefinedPaths(raw);
  let reason: string | undefined;
  const active = new Set<object>();
  const compare = (left: unknown, right: unknown, path: string): boolean => {
    if (left === null || typeof left !== 'object') {
      if (left === undefined) {
        reason = `${path} undefined value was not normalized in an array slot`;
        return right === null;
      }
      if (!Object.is(left, right)) {
        reason = `${path} defined value changed`;
        return false;
      }
      return true;
    }
    if (active.has(left)) {
      reason = `${path} contains a cycle`;
      return false;
    }
    active.add(left);
    if (Array.isArray(left)) {
      if (!Array.isArray(right) || left.length !== right.length) {
        reason = `${path} array shape changed`;
        active.delete(left);
        return false;
      }
      const rightKeys = Object.keys(right);
      const expectedRightKeys = Array.from({ length: left.length }, (_unused, index) => String(index));
      if (JSON.stringify(rightKeys) !== JSON.stringify(expectedRightKeys)) {
        reason = `${path} array order or keys changed`;
        active.delete(left);
        return false;
      }
      for (let index = 0; index < left.length; index += 1) {
        const childPath = `${path}[${index}]`;
        const present = Object.prototype.hasOwnProperty.call(left, index) && left[index] !== undefined;
        if (!present) {
          if (right[index] !== null) {
            reason = `${childPath} undefined array slot was not mapped to null`;
            active.delete(left);
            return false;
          }
        } else if (!compare(left[index], right[index], childPath)) {
          active.delete(left);
          return false;
        }
      }
      active.delete(left);
      return true;
    }
    const leftRecord = left as JsonRecord;
    const rightRecord = asRecord(right);
    if (!rightRecord) {
      reason = `${path} record shape changed`;
      active.delete(left);
      return false;
    }
    const expectedKeys = Object.keys(leftRecord).filter(key => leftRecord[key] !== undefined);
    if (JSON.stringify(Object.keys(rightRecord)) !== JSON.stringify(expectedKeys)) {
      reason = `${path} defined keys changed, were reordered, or were added`;
      active.delete(left);
      return false;
    }
    for (const key of Object.keys(leftRecord)) {
      const child = leftRecord[key];
      const childPath = `${path}.${key}`;
      if (child === undefined) {
        if (Object.prototype.hasOwnProperty.call(rightRecord, key)) {
          reason = `${childPath} undefined object member was retained`;
          active.delete(left);
          return false;
        }
      } else if (!compare(child, rightRecord[key], childPath)) {
        active.delete(left);
        return false;
      }
    }
    active.delete(left);
    return true;
  };
  const pass = rawJson !== undefined
    && normalizedJson !== undefined
    && rawJson === normalizedJson
    && compare(raw, normalized, '$');
  return {
    pass,
    ...(reason === undefined ? {} : { reason }),
    rawJson,
    normalizedJson,
    jsonBytesEqual: rawJson !== undefined && rawJson === normalizedJson,
    undefinedObjectMembers: paths.objectMembers,
    undefinedArraySlots: paths.arraySlots,
  };
}

function callEvidenceSnapshot(model: unknown): unknown {
  const modelRecord = asRecord(model);
  const calls = modelRecord?.calls;
  if (!Array.isArray(calls)) return undefined;
  return calls.map((call, index) => {
    const record = asRecord(call) || {};
    const evidence: JsonRecord = {
      index,
    };
    for (const key of [
      'id', 'callId', 'kind', 'name', 'recordType', 'callee', 'method', 'source', 'sourceOrder', 'order',
      'arguments', 'receiver', 'result', 'semantics', 'metadata', 'context',
    ]) {
      if (record[key] !== undefined) evidence[key] = record[key];
    }
    return evidence;
  });
}

type NormalizationControlResult = {
  readonly basePass: boolean;
  readonly fixtureReady: boolean;
  readonly mutationChanged: boolean;
  readonly mutatedRejected: boolean;
  readonly mutatedReason?: string;
  readonly before?: unknown;
  readonly after?: unknown;
};

function normalizationControl(
  raw: unknown,
  normalized: unknown,
  mutate: (candidate: JsonRecord) => {
    readonly changed: boolean;
    readonly before?: unknown;
    readonly after?: unknown;
  },
): NormalizationControlResult {
  const base = compareAllowedNormalization(raw, normalized);
  const candidateValue = JSON.parse(JSON.stringify(normalized)) as unknown;
  const candidate = asRecord(candidateValue);
  if (!candidate) {
    return {
      basePass: base.pass,
      fixtureReady: false,
      mutationChanged: false,
      mutatedRejected: false,
      ...(base.reason === undefined ? {} : { mutatedReason: base.reason }),
    };
  }
  const mutation = mutate(candidate);
  const mutated = compareAllowedNormalization(raw, candidate);
  return {
    basePass: base.pass,
    fixtureReady: base.pass && candidate !== normalized,
    mutationChanged: mutation.changed,
    mutatedRejected: !mutated.pass,
    ...(mutated.reason === undefined ? {} : { mutatedReason: mutated.reason }),
    before: mutation.before,
    after: mutation.after,
  };
}

type ExistingModelNormalizationAudit = {
  readonly pass: boolean;
  readonly rawDirectStatus: unknown;
  readonly rawDirectRefusal: string | undefined;
  readonly rawDirectRefusalExact: boolean;
  readonly normalizedDirectStatus: unknown;
  readonly normalizedEquivalent: boolean;
  readonly rawModelJsonEqual: boolean;
  readonly callerJsonEqual: boolean;
  readonly allowedNormalization: boolean;
  readonly callEvidencePreserved: boolean;
  readonly sourceIdentityPreserved: boolean;
  readonly callCount: number | undefined;
  readonly normalizedCallCount: number | undefined;
  readonly callOrderPreserved: boolean;
  readonly callModelUndefinedObjectMembers: readonly string[];
  readonly callModelUndefinedArraySlots: readonly string[];
  readonly callerUndefinedObjectMembers: readonly string[];
  readonly callerUndefinedArraySlots: readonly string[];
  readonly gameTruthPreserved: boolean;
};

function existingModelNormalizationAudit(
  rawModel: unknown,
  normalizedModel: unknown,
  callerSnapshot: unknown,
  target: Parameters<typeof projectX4UiLayoutProgram>[1],
  profile: Parameters<typeof projectX4UiLayoutProgram>[2],
  pipelineProgram: unknown,
  sourceJsonBefore: string,
  sourceJsonAfter: string,
): ExistingModelNormalizationAudit {
  const rawModelJson = JSON.stringify(rawModel);
  const normalizedModelJson = JSON.stringify(normalizedModel);
  const normalizedCaller = normalizeExistingJson(callerSnapshot);
  const rawEnvelope = { callModel: rawModel, caller: callerSnapshot };
  const normalizedEnvelope = { callModel: normalizedModel, caller: normalizedCaller };
  const envelopeAudit = compareAllowedNormalization(rawEnvelope, normalizedEnvelope);
  const rawEvidence = callEvidenceSnapshot(rawModel);
  const normalizedEvidence = callEvidenceSnapshot(normalizedModel);
  const evidenceAudit = compareAllowedNormalization(rawEvidence, normalizedEvidence);
  const rawModelRecord = asRecord(rawModel);
  const normalizedModelRecord = asRecord(normalizedModel);
  const rawCalls = Array.isArray(rawModelRecord?.calls) ? rawModelRecord.calls : undefined;
  const normalizedCalls = Array.isArray(normalizedModelRecord?.calls) ? normalizedModelRecord.calls : undefined;
  const callOrderPreserved = rawCalls !== undefined
    && normalizedCalls !== undefined
    && rawCalls.length === normalizedCalls.length
    && rawCalls.every((call, index) => asRecord(call)?.order === asRecord(normalizedCalls[index])?.order);
  const rawDirect = rawModel === undefined
    ? undefined
    : projectX4UiLayoutProgram(rawModel as Parameters<typeof projectX4UiLayoutProgram>[0], target, profile);
  const normalizedDirect = normalizedModel === undefined
    ? undefined
    : projectX4UiLayoutProgram(normalizedModel as Parameters<typeof projectX4UiLayoutProgram>[0], target, profile);
  const rawDirectRefusal = rawDirect !== undefined && 'refusal' in rawDirect
    ? rawDirect.refusal.message
    : undefined;
  const rawDirectRefusalExact = rawDirectRefusal?.includes('outside the JSON value domain') === true;
  const normalizedEquivalent = pipelineProgram !== undefined
    && normalizedDirect !== undefined
    && JSON.stringify(normalizedDirect) === JSON.stringify(pipelineProgram);
  const pipelineProgramRecord = asRecord(pipelineProgram);
  const normalizedDirectRecord = asRecord(normalizedDirect);
  const gameTruthPreserved = hasNotVerifiedVerification(pipelineProgramRecord?.verification)
    && hasNotVerifiedVerification(asRecord(pipelineProgramRecord?.program)?.verification)
    && hasNotVerifiedVerification(normalizedDirectRecord?.verification)
    && hasNotVerifiedVerification(asRecord(normalizedDirectRecord?.program)?.verification);
  const rawPaths = undefinedPaths(rawModel);
  const callerPaths = undefinedPaths(callerSnapshot);
  const allowedNormalization = envelopeAudit.pass && evidenceAudit.pass;
  const rawModelJsonEqual = rawModelJson !== undefined && rawModelJson === normalizedModelJson;
  const callerJson = JSON.stringify(callerSnapshot);
  const normalizedCallerJson = JSON.stringify(normalizedCaller);
  const callerJsonEqual = callerJson !== undefined && callerJson === normalizedCallerJson;
  const sourceIdentityPreserved = sameJson(rawModelRecord?.file, normalizedModelRecord?.file);
  const callCount = rawCalls?.length;
  const normalizedCallCount = normalizedCalls?.length;
  const pass = rawDirectRefusalExact
    && normalizedEquivalent
    && rawModelJsonEqual
    && callerJsonEqual
    && allowedNormalization
    && sourceIdentityPreserved
    && callCount !== undefined
    && callCount === normalizedCallCount
    && callOrderPreserved
    && sourceJsonBefore === sourceJsonAfter
    && rawPaths.objectMembers.length + rawPaths.arraySlots.length + callerPaths.objectMembers.length + callerPaths.arraySlots.length > 0
    && gameTruthPreserved;
  return {
    pass,
    rawDirectStatus: rawDirect?.status,
    rawDirectRefusal,
    rawDirectRefusalExact,
    normalizedDirectStatus: normalizedDirect?.status,
    normalizedEquivalent,
    rawModelJsonEqual,
    callerJsonEqual,
    allowedNormalization,
    callEvidencePreserved: evidenceAudit.pass,
    sourceIdentityPreserved,
    callCount,
    normalizedCallCount,
    callOrderPreserved,
    callModelUndefinedObjectMembers: rawPaths.objectMembers,
    callModelUndefinedArraySlots: rawPaths.arraySlots,
    callerUndefinedObjectMembers: callerPaths.objectMembers,
    callerUndefinedArraySlots: callerPaths.arraySlots,
    gameTruthPreserved,
  };
}

function hasNotVerifiedVerification(value: unknown): boolean {
  const verification = asRecord(value);
  return verification?.game === 'Not verified in game' && verification.gameVerified === false;
}

function knownColorFactRecords(result: unknown): readonly JsonRecord[] {
  const records: JsonRecord[] = [];
  const add = (value: unknown): void => {
    const candidate = asRecord(value);
    if (candidate?.status === 'known' && candidate.expectedType === 'color-object') records.push(candidate);
  };
  const resultRecord = asRecord(result);
  const programResult = asRecord(resultRecord?.program);
  const program = asRecord(programResult?.program);
  const operations = Array.isArray(program?.operations) ? program.operations : [];
  for (const operation of operations) {
    const facts = asRecord(asRecord(operation)?.descriptorFacts);
    if (facts) Object.values(facts).forEach(add);
  }
  const sceneResult = asRecord(resultRecord?.scene);
  const scene = asRecord(sceneResult?.scene);
  for (const collection of ['tables', 'cells', 'widgets', 'texts'] as const) {
    const nodes = Array.isArray(scene?.[collection]) ? scene[collection] : [];
    for (const node of nodes) {
      const facts = asRecord(node)?.colorFacts;
      if (Array.isArray(facts)) facts.forEach(add);
    }
  }
  return records;
}

type CanonicalAcceptanceFacts = {
  readonly accepted: boolean;
  readonly loaderIssued: boolean;
  readonly programProjected: boolean;
  readonly operationCount: number | undefined;
  readonly appliedOperationCount: number | undefined;
  readonly producerGapCount: number | undefined;
  readonly sceneStatus: unknown;
  readonly sourceIdentityMatch: boolean;
  readonly dimensionsMatch: boolean;
  readonly helperWidgetPinsMatch: boolean;
  readonly fontIdentityPinsMatch: boolean;
  readonly geometryCounts: {
    readonly frames: number | undefined;
    readonly tables: number | undefined;
    readonly rows: number | undefined;
    readonly cells: number | undefined;
    readonly widgets: number | undefined;
  };
  readonly geometryMatch: boolean;
  readonly gameTruthComplete: boolean;
};

function canonicalAcceptanceFacts(
  canonical: unknown,
  selection: X4UiPreviewSelection,
  result: unknown,
): CanonicalAcceptanceFacts {
  const canonicalRecord = asRecord(canonical);
  const assets = asRecord(canonicalRecord?.assets);
  const helper = asRecord(assets?.helper);
  const widget = asRecord(assets?.widget);
  const regular = asRecord(assets?.regular);
  const bold = asRecord(assets?.bold);
  const regularDescriptor = asRecord(regular?.descriptor);
  const regularAtlas = asRecord(regular?.atlas);
  const boldDescriptor = asRecord(bold?.descriptor);
  const boldAtlas = asRecord(bold?.atlas);
  const resultRecord = asRecord(result);
  const profile = asRecord(resultRecord?.profile);
  const layoutProfile = asRecord(profile?.layout);
  const programResult = asRecord(resultRecord?.program);
  const program = asRecord(programResult?.program);
  const sceneResult = asRecord(resultRecord?.scene);
  const scene = asRecord(sceneResult?.scene);
  const sceneProfile = asRecord(scene?.profile);
  const operations = Array.isArray(program?.operations) ? program.operations : undefined;
  const gaps = Array.isArray(program?.gaps) ? program.gaps : undefined;
  const operationCount = operations?.length;
  const appliedOperationCount = operations?.filter(operation => asRecord(operation)?.status === 'applied').length;
  const producerGapCount = gaps?.length;
  const geometryCounts = {
    frames: Array.isArray(scene?.frames) ? scene.frames.length : undefined,
    tables: Array.isArray(scene?.tables) ? scene.tables.length : undefined,
    rows: Array.isArray(scene?.rows) ? scene.rows.length : undefined,
    cells: Array.isArray(scene?.cells) ? scene.cells.length : undefined,
    widgets: Array.isArray(scene?.widgets) ? scene.widgets.length : undefined,
  };
  const expectedSource = selection.sourceIdentity;
  const sourceIdentityMatch = sameJson(expectedSource, layoutProfile?.source)
    && sameJson(expectedSource, sceneProfile?.source)
    && sameJson(expectedSource, asRecord(resultRecord?.selectedSource)?.sourceIdentity);
  const drawable = asRecord(layoutProfile?.frame);
  const sceneDrawable = asRecord(sceneProfile?.drawable);
  const dimensionsMatch = drawable?.width === sceneDrawable?.width
    && drawable?.height === sceneDrawable?.height
    && drawable?.width === 100
    && drawable?.height === 80;
  const helperWidgetPinsMatch = layoutProfile?.helper !== undefined
    && layoutProfile?.widget !== undefined
    && sceneProfile?.helper !== undefined
    && sceneProfile?.widget !== undefined
    && asRecord(layoutProfile.helper)?.sourcePath === helper?.relativePath
    && asRecord(layoutProfile.helper)?.sha256 === canonicalRecord?.helperSourceHash
    && asRecord(layoutProfile.widget)?.sourcePath === widget?.relativePath
    && asRecord(layoutProfile.widget)?.sha256 === canonicalRecord?.widgetSourceHash
    && asRecord(sceneProfile.helper)?.sourcePath === helper?.relativePath
    && asRecord(sceneProfile.helper)?.sha256 === canonicalRecord?.helperSourceHash
    && asRecord(sceneProfile.widget)?.sourcePath === widget?.relativePath
    && asRecord(sceneProfile.widget)?.sha256 === canonicalRecord?.widgetSourceHash;
  const fonts = asRecord(sceneProfile?.fonts);
  const regularPin = asRecord(fonts?.Zekton);
  const boldPin = asRecord(fonts?.['Zekton Bold']);
  const regularDescriptorIdentity = regularDescriptor === undefined ? undefined : {
    relativePath: regularDescriptor.relativePath,
    sha256: regularDescriptor.sha256,
  };
  const regularAtlasIdentity = regularAtlas === undefined ? undefined : {
    relativePath: regularAtlas.relativePath,
    sha256: regularAtlas.sha256,
  };
  const boldDescriptorIdentity = boldDescriptor === undefined ? undefined : {
    relativePath: boldDescriptor.relativePath,
    sha256: boldDescriptor.sha256,
  };
  const boldAtlasIdentity = boldAtlas === undefined ? undefined : {
    relativePath: boldAtlas.relativePath,
    sha256: boldAtlas.sha256,
  };
  const fontIdentityPinsMatch = sameJson(regularPin?.descriptor, regularDescriptorIdentity)
    && sameJson(regularPin?.atlas, regularAtlasIdentity)
    && sameJson(boldPin?.descriptor, boldDescriptorIdentity)
    && sameJson(boldPin?.atlas, boldAtlasIdentity);
  const geometryMatch = geometryCounts.frames === 1
    && geometryCounts.tables === 1
    && geometryCounts.rows === 1
    && geometryCounts.cells === 4
    && geometryCounts.widgets === 3;
  const gameTruthComplete = resultRecord?.gameTruth === 'Not verified in game'
    && hasNotVerifiedVerification(resultRecord?.verification)
    && hasNotVerifiedVerification(programResult?.verification)
    && hasNotVerifiedVerification(program?.verification)
    && hasNotVerifiedVerification(sceneResult?.verification)
    && hasNotVerifiedVerification(scene?.verification)
    && scene?.gameTruth === 'Not verified in game';
  const loaderIssued = isX4UiCorpusCanonicalSuccess(canonical);
  const programProjected = resultRecord?.status !== 'refused'
    && programResult?.status === 'projected'
    && program?.status === 'projected';
  const sceneStatus = scene?.status;
  const sceneAccepted = sceneStatus === 'projected' || sceneStatus === 'partial';
  const accepted = loaderIssued
    && programProjected
    && operationCount === 12
    && appliedOperationCount === 12
    && producerGapCount === 0
    && sceneAccepted
    && sourceIdentityMatch
    && dimensionsMatch
    && helperWidgetPinsMatch
    && fontIdentityPinsMatch
    && geometryMatch
    && gameTruthComplete;
  return {
    accepted,
    loaderIssued,
    programProjected,
    operationCount,
    appliedOperationCount,
    producerGapCount,
    sceneStatus,
    sourceIdentityMatch,
    dimensionsMatch,
    helperWidgetPinsMatch,
    fontIdentityPinsMatch,
    geometryCounts,
    geometryMatch,
    gameTruthComplete,
  };
}

function responseHeaders(contentType: string): { get(name: string): string | null } {
  return { get: name => name.toLowerCase() === 'content-type' ? contentType : null };
}

function jsonResponse(body: unknown, status = 200): X4UiCorpusFetchResponse {
  return {
    status,
    headers: responseHeaders('application/json; charset=utf-8'),
    json: async () => body,
  };
}

function bytesResponse(bytes: Uint8Array, status = 200, contentType = 'application/octet-stream'): X4UiCorpusFetchResponse {
  const copied = bytes.slice();
  return {
    status,
    headers: responseHeaders(contentType),
    arrayBuffer: async () => copied.buffer,
  };
}

function makeCanonicalAbc(advance: number): Uint8Array {
  const maxCodepoint = 127;
  const mapBytes = (maxCodepoint + 1) * 2;
  const recordStart = (ZEKTON_DESCRIPTOR_HEADER_SIZE + mapBytes + 3) & ~3;
  const bytes = new Uint8Array(recordStart + ZEKTON_RECORD_SIZE + ZEKTON_DESCRIPTOR_TRAILING_SIZE);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 9, true);
  view.setFloat32(4, 16, true);
  view.setFloat32(8, 3, true);
  view.setFloat32(12, 3, true);
  view.setFloat32(16, 10, true);
  view.setInt32(20, 4, true);
  view.setInt32(24, 6, true);
  view.setInt32(28, 0, true);
  view.setUint32(32, 0, true);
  view.setUint32(36, 8, true);
  view.setUint32(40, 10, true);
  view.setUint32(44, maxCodepoint, true);
  for (let codepoint = 0; codepoint <= maxCodepoint; codepoint += 1) {
    view.setUint16(ZEKTON_DESCRIPTOR_HEADER_SIZE + codepoint * 2, 1, true);
  }
  view.setFloat32(recordStart, 0, true);
  view.setFloat32(recordStart + 4, 0, true);
  view.setFloat32(recordStart + 8, 1, true);
  view.setFloat32(recordStart + 12, 1, true);
  view.setInt16(recordStart + 16, 0, true);
  view.setUint16(recordStart + 18, 8, true);
  view.setUint16(recordStart + 20, advance, true);
  view.setUint16(recordStart + 22, 0, true);
  return bytes;
}

function makeCanonicalDds(): Uint8Array {
  const bytes = new Uint8Array(ZEKTON_DDS_HEADER_SIZE + 8 * 10);
  bytes.set([0x44, 0x44, 0x53, 0x20]);
  const view = new DataView(bytes.buffer);
  view.setUint32(4, 124, true);
  view.setUint32(8, 0x1007, true);
  view.setUint32(12, 10, true);
  view.setUint32(16, 8, true);
  view.setUint32(76, 32, true);
  view.setUint32(80, 2, true);
  view.setUint32(88, 8, true);
  view.setUint32(104, 0xff, true);
  view.setUint32(108, 0x1002, true);
  for (let index = ZEKTON_DDS_HEADER_SIZE; index < bytes.length; index += 1) bytes[index] = 255;
  return bytes;
}

function hexDigest(hex: string): ArrayBuffer {
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  return bytes.buffer;
}

async function withCanonicalPlatformHash<T>(expectedHashes: readonly string[], run: () => Promise<T>): Promise<T> {
  const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  const originalValue = (globalThis as unknown as { crypto?: unknown }).crypto;
  let hashIndex = 0;
  const fakeCrypto = {
    subtle: {
      digest: async (..._args: readonly unknown[]): Promise<ArrayBuffer> => {
        const expected = expectedHashes[hashIndex++];
        if (expected === undefined) throw new Error('canonical pipeline selftest hash count mismatch');
        return hexDigest(expected);
      },
    },
  };
  try {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      enumerable: originalDescriptor?.enumerable ?? true,
      writable: true,
      value: fakeCrypto,
    });
    return await run();
  } finally {
    if (originalDescriptor) Object.defineProperty(globalThis, 'crypto', originalDescriptor);
    else Reflect.deleteProperty(globalThis, 'crypto');
    check('canonical loader restores platform Web Crypto',
      (globalThis as unknown as { crypto?: unknown }).crypto === originalValue);
  }
}

function pathFromQuery(url: string, key: string): string {
  const query = url.slice(url.indexOf('?') + 1).split('&');
  const pair = query.find(part => part.startsWith(`${key}=`));
  if (!pair) throw new Error(`missing query ${key}`);
  return decodeURIComponent(pair.slice(key.length + 1));
}

function manifestStatus(root: string, generation: string): Record<string, unknown> {
  return {
    available: true,
    state: 'ready',
    root,
    current: { generation, root, generatedAt: '2026-08-12T00:00:00.000Z' },
  };
}

async function loadCanonicalSelftestResult(): Promise<X4UiCorpusCanonicalSuccess> {
  const root = 'pipeline-canonical-selftest-root';
  const generation = 'pipeline-canonical-selftest-generation';
  const generatedAt = '2026-08-12T00:00:00.000Z';
  const contract = X4_UI_CORPUS_9_00_CONTRACT;
  const buffers = new Map<string, Uint8Array>([
    [contract.helper.relativePath, new TextEncoder().encode('-- pipeline canonical selftest helper\n')],
    [contract.widget.relativePath, new TextEncoder().encode('-- pipeline canonical selftest widget\n')],
    [contract.regular.descriptor.relativePath, makeCanonicalAbc(8)],
    [contract.regular.atlas.relativePath, makeCanonicalDds()],
    [contract.bold.descriptor.relativePath, makeCanonicalAbc(8)],
    [contract.bold.atlas.relativePath, makeCanonicalDds()],
  ]);
  const expectedHashes = [
    contract.helper.sha256,
    contract.widget.sha256,
    contract.regular.descriptor.sha256,
    contract.regular.atlas.sha256,
    contract.bold.descriptor.sha256,
    contract.bold.atlas.sha256,
  ];
  const status = {
    available: true,
    root,
    generatedAt,
    manifestGeneration: generation,
    manifest: { available: true, state: 'ready', root, current: { generation, root, generatedAt } },
  };
  const transport = async (url: string): Promise<X4UiCorpusFetchResponse> => {
    if (url === X4_UI_CORPUS_STATUS_URL) return jsonResponse(status);
    if (url.startsWith(`${X4_UI_CORPUS_MANIFEST_URL}?`)) {
      const path = pathFromQuery(url, 'q');
      const bytes = buffers.get(path);
      if (!bytes) throw new Error(`unknown canonical manifest path ${path}`);
      return jsonResponse({
        status: manifestStatus(root, generation),
        generation,
        total: 1,
        limit: 500,
        offset: 0,
        files: [{ path, bytes: bytes.byteLength }],
      });
    }
    if (url.startsWith(`${X4_UI_CORPUS_FILE_URL}?`)) {
      const path = pathFromQuery(url, 'path');
      const bytes = buffers.get(path);
      if (!bytes) throw new Error(`unknown canonical file path ${path}`);
      return bytesResponse(bytes, 200, path.endsWith('.lua') ? 'text/plain' : 'application/octet-stream');
    }
    throw new Error(`unexpected canonical pipeline selftest URL ${url}`);
  };
  const result = await withCanonicalPlatformHash(expectedHashes,
    () => loadCanonicalX4UiCorpusAssets({ transport }));
  if (result.ok === false) throw new Error(`canonical pipeline selftest loader failed: ${result.error.message}`);
  return result;
}

const previewColorBaseIds = [
  'white',
  'black_alpha_0',
  'white_weak_glow',
  'azure_very_dark',
  'azure_moderate_glow',
  'azure_dark_alpha_160_glow',
  'azure_dark_alpha_26',
  'azure_very_dark_alpha_224',
  'literal_base',
] as const;

const previewColorMappingIds = [
  'table_background_default',
  'row_background',
  'text_normal',
  'icon_normal',
  'button_background_default',
  'button_highlight_default',
  'button_border_default',
  'editbox_background_default',
  'container_subsection_header',
] as const;

function paddedUtf8(text: string, size: number): Uint8Array {
  const bytes = new TextEncoder().encode(text);
  if (bytes.byteLength > size) throw new Error(`Preview color fixture exceeds pinned size ${size}`);
  const padded = new Uint8Array(size);
  padded.set(bytes);
  padded.fill(0x20, bytes.byteLength);
  return padded;
}

async function loadCanonicalColorSelftestResult(): Promise<X4UiCorpusCanonicalColorSuccess> {
  const root = 'preview-color-corpus-identity';
  const generation = 'preview-color-generation-1';
  const baseIds: string[] = [...previewColorBaseIds];
  while (baseIds.length < 224) baseIds.push(`preview_base_${baseIds.length.toString().padStart(3, '0')}`);
  const specialValues: Record<string, readonly [number, number, number, number, number | undefined]> = {
    white: [11, 22, 33, 44, 0.1],
    black_alpha_0: [51, 52, 53, 54, 0.2],
    white_weak_glow: [101, 102, 103, 104, 0.3],
    azure_very_dark: [61, 62, 63, 64, 0.4],
    azure_moderate_glow: [71, 72, 73, 74, 0.5],
    azure_dark_alpha_160_glow: [81, 82, 83, 84, 0.6],
    azure_dark_alpha_26: [0, 105, 179, 26, undefined],
    azure_very_dark_alpha_224: [91, 92, 93, 94, 0.7],
    literal_base: [131, 132, 133, 134, 0.9],
  };
  const colors = baseIds.map((id, index) => {
    const values = specialValues[id] || [index % 256, (index + 1) % 256, (index + 2) % 256, (index + 3) % 256, 0];
    const glow = values[4] === undefined ? '' : ` glow="${values[4]}"`;
    return `    <color id="${id}" r="${values[0]}" g="${values[1]}" b="${values[2]}" a="${values[3]}"${glow}/>`;
  });
  const mappingRefs: Record<string, string> = {
    table_background_default: 'white',
    row_background: 'black_alpha_0',
    text_normal: 'white_weak_glow',
    icon_normal: 'white_weak_glow',
    button_background_default: 'azure_very_dark',
    button_highlight_default: 'azure_moderate_glow',
    button_border_default: 'azure_dark_alpha_160_glow',
    editbox_background_default: 'azure_very_dark_alpha_224',
    container_subsection_header: 'azure_dark_alpha_26',
  };
  const mappings = previewColorMappingIds.map(id => `    <mapping id="${id}" ref="${mappingRefs[id]}"/>`);
  for (let index = mappings.length; index < 804; index += 1) {
    mappings.push(`    <mapping id="preview_map_${index.toString().padStart(3, '0')}" ref="${baseIds[index % baseIds.length]}"/>`);
  }
  const buffers = new Map<string, Uint8Array>([
    [X4_UI_CORPUS_COLORS_XML_PATH, paddedUtf8([
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<colormap>',
      '  <colors>',
      ...colors,
      '  </colors>',
      '  <mappings>',
      ...mappings,
      '  </mappings>',
      '</colormap>',
    ].join('\n'), X4_UI_CORPUS_COLORS_XML_SIZE)],
    [X4_UI_CORPUS_COLORS_XSD_PATH, paddedUtf8([
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">',
      '  <xs:simpleType name="identifier"><xs:restriction base="xs:string"><xs:pattern value="[a-zA-Z_][a-zA-Z0-9_]*"/></xs:restriction></xs:simpleType>',
      '</xs:schema>',
    ].join('\n'), X4_UI_CORPUS_COLORS_XSD_SIZE)],
  ]);
  const status = {
    available: true,
    root,
    generatedAt: '2026-08-19T00:00:00.000Z',
    manifestGeneration: generation,
    manifest: { available: true, state: 'ready', root, current: { generation, root, generatedAt: '2026-08-19T00:00:00.000Z' } },
  };
  const transport = async (url: string): Promise<X4UiCorpusFetchResponse> => {
    if (url === X4_UI_CORPUS_STATUS_URL) return jsonResponse(status);
    if (url.startsWith(`${X4_UI_CORPUS_MANIFEST_URL}?`)) {
      const path = pathFromQuery(url, 'q');
      const bytes = buffers.get(path);
      if (!bytes) throw new Error(`unknown Preview color manifest path ${path}`);
      return jsonResponse({
        status: manifestStatus(root, generation),
        generation,
        total: 1,
        limit: 500,
        offset: 0,
        files: [{ path, bytes: bytes.byteLength }],
      });
    }
    if (url.startsWith(`${X4_UI_CORPUS_FILE_URL}?`)) {
      const path = pathFromQuery(url, 'path');
      const bytes = buffers.get(path);
      if (!bytes) throw new Error(`unknown Preview color file path ${path}`);
      return bytesResponse(bytes, 200, 'application/xml');
    }
    throw new Error(`unexpected Preview color selftest URL ${url}`);
  };
  const result = await withCanonicalPlatformHash(
    [X4_UI_CORPUS_COLORS_XML_SHA256, X4_UI_CORPUS_COLORS_XSD_SHA256],
    () => loadCanonicalX4UiCorpusColorEvidence({ transport }),
  );
  if (result.ok === false) throw new Error(`Preview color loader failed: ${result.error.message}`);
  if (!isX4UiCorpusCanonicalColorSuccess(result)) throw new Error('Preview color loader did not issue canonical authority');
  return result;
}

const uiXml = [
  '<?xml version="1.0" encoding="utf-8"?>',
  '<addon name="fixture">',
  '  <environment type="menus">',
  '    <file name="ui/first.lua" />',
  '    <file name="ui/sample.lua" />',
  '    <file name="ui/duplicate.lua" />',
  '  </environment>',
  '</addon>',
  '',
].join('\n');

const sampleLua = [
  'local menu = { name = "Sampled", layer = 1 }',
  'function menu.display(tw, dynamicText, mx)',
  '  local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
  '  local table = frame:addTable(2, { width = tw - mx * 2, reserveScrollBar = false, scaling = false })',
  '  local row = table:addRow(false, { scaling = false })',
  '  row[1]:createText(dynamicText, { height = 10 })',
  '  row[2]:createText(dynamicText, { height = 10 })',
  'end',
  '',
].join('\n');

const duplicateLua = [
  'function menu.duplicate() return Helper.createFrameHandle({ name = "one", layer = 1 }) end',
  'function menu.duplicate() return Helper.createFrameHandle({ name = "two", layer = 1 }) end',
  '',
].join('\n');

const firstLua = [
  'local frame = Menus.createFrameHandle()',
  'frame:addTable(2)',
  'frame:addRow()',
  'frame[1][1]:setText("hello")',
  '',
].join('\n');

const branchExpansionLua = [
  'local Helper = rawget(_G, "Helper")',
  'local function tabPanel(frame, width, label)',
  '  local table = frame:addTable(1, { width = width })',
  '  local row = table:addRow(false, {})',
  '  row[1]:createText(label, { height = 10 })',
  'end',
  'local function display(tab)',
  '  local menu = { name = "Branches", layer = 1 }',
  '  local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
  '  if tab == "first" then',
  '    tabPanel(frame, 40, "first")',
  '  else',
  '    tabPanel(frame, 50, "second")',
  '  end',
  '  if false then tabPanel(frame, 60, "never") end',
  '  while tab do tabPanel(frame, 70, "loop") end',
  'end',
  '',
].join('\n');

const canonicalLua = [
  'local menu = { name = "Canonical", layer = 1 }',
  'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
  'local table = frame:addTable(4, { width = 100, reserveScrollBar = false, scaling = false })',
  'table:setColWidth(1, 20, false)',
  'table:setColWidth(2, 20, false)',
  'table:setColWidth(3, 20, false)',
  'table:setColWidth(4, 20, false)',
  'local row = table:addRow(false, { paddingTop = 1, paddingBottom = 1, borderBelow = false, fixed = false })',
  'row[1]:setColSpan(2):createText("canonical", { height = 12, minRowHeight = 10 })',
  'row[3]:createButton({ height = 0, affectRowHeight = false })',
  'row[4]:createIcon("solid", { height = 8, affectRowHeight = false })',
  'frame:display()',
  '',
].join('\n');

const previewColorLua = [
  'local menu = { name = "PreviewColors", layer = 1 }',
  'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
  'local table = frame:addTable(4, { width = 100, reserveScrollBar = false, backgroundColor = Color["table_background_default"] })',
  'table:setColWidth(1, 20, false)',
  'table:setColWidth(2, 20, false)',
  'table:setColWidth(3, 20, false)',
  'table:setColWidth(4, 20, false)',
  'local row = table:addRow(false, { paddingTop = 1, paddingBottom = 1, borderBelow = false, fixed = false, scaling = false })',
  'row[1]:createText("literal", { height = 12, minRowHeight = 10, color = { r = 12.5, g = 23.5, b = 34.5, a = 45.5, glow = 0.25 }, cellBGColor = Color["row_background"] })',
  'row[2]:createButton({ height = 12, bgcolor = Color["button_background_default"], highlightColor = Color["button_highlight_default"], borderColor = Color["button_border_default"] }):setText("primary", { color = Color["text_normal"] }):setText2("secondary", { color = { r = 15, g = 25, b = 35, a = 55 } })',
  'row[3]:createEditBox({ height = 12, bgColor = Color["editbox_background_default"] })',
  'row[4]:createIcon("icon", { height = 8, affectRowHeight = false, color = Color["white"] })',
  'frame:display()',
  '',
].join('\n');

const previewColorXml = [
  '<?xml version="1.0" encoding="utf-8"?>',
  '<addon name="preview-color-fixture">',
  '  <environment type="menus">',
  '    <file name="ui/preview-colors.lua" />',
  '  </environment>',
  '</addon>',
  '',
].join('\n');

const authorityTopologyLua = [
  'local menuA = { name = "AuthorityA", layer = 1 }',
  'local frameA = Helper.createFrameHandle(menuA, { width = 100, height = 80 })',
  'local tableA = frameA:addTable(1, { width = 100, reserveScrollBar = false, scaling = false })',
  'tableA:setColWidth(1, 100, false)',
  'local rowA = tableA:addRow(false, {})',
  'rowA[1]:createText("A", { height = 10 })',
  'local menuB = { name = "AuthorityB", layer = 0 }',
  'local frameB = Helper.createFrameHandle(menuB, { width = 100, height = 80 })',
  'local tableB = frameB:addTable(1, { width = 100, reserveScrollBar = false, scaling = false })',
  'tableB:setColWidth(1, 100, false)',
  'local rowB = tableB:addRow(false, {})',
  'rowB[1]:createText("B", { height = 10 })',
  'frameA:display()',
  'frameB:display()',
  '',
].join('\n');

const partialLua = [
  'local menu = { name = "PartialSibling", layer = 1 }',
  'local frame = Helper.createFrameHandle(menu, { width = 100, height = 80 })',
  'local table = frame:addTable(2, { width = 80, reserveScrollBar = false })',
  'table:setColWidth(1, 40, false)',
  'table:setColWidth(2, 40, false)',
  'local row = table:addRow(false, {})',
  'row[1]:createText("known", { height = 10 })',
  'row[2]:createButton(dynamic_options)',
  'frame:display()',
  '',
].join('\n');

const lintLua = [
  'local frame = Menus.createFrameHandle()',
  'frame:addTable(24)',
  '',
].join('\n');

function passthrough(path: string, content?: string, extra: Partial<PassthroughFile> = {}): PassthroughFile {
  return { path, ...(content === undefined ? {} : { content }), ...extra };
}

function workspace(files: PassthroughFile[], extra: Partial<ModWorkspace> = {}): ModWorkspace {
  return {
    id: 'batch6b-selftest',
    name: 'Batch 6B selftest',
    version: '1.0.0',
    author: 'Forge',
    description: 'source-pinned preview pipeline fixture',
    nodes: [],
    links: [],
    uiWidgets: [],
    uiTheme: {
      backgroundColor: '#000000',
      borderColor: '#111111',
      accentColor: '#00ffff',
      opacity: 1,
      showIcons: true,
    },
    compileSettings: {
      md: false,
      ui: true,
      ai: false,
      library: false,
      translations: false,
      patches: false,
    },
    passthroughFiles: files,
    ...extra,
  } as ModWorkspace;
}

function sourceFor(files: PassthroughFile[], extra: Partial<ModWorkspace> = {}): X4UiWorkspaceSource {
  return buildX4UiWorkspaceSource(workspace(files, extra));
}

function selectionFor(
  source: X4UiWorkspaceSource,
  path = 'ui/first.lua',
  kind: 'top-level' | 'function' = 'top-level',
  name?: string,
): X4UiPreviewSelection {
  const file = source.bundle?.sourceFiles.find(candidate => candidate.path === path);
  if (!file) throw new Error(`missing source fixture ${path}`);
  const catalog = createX4UiLayoutTargetCatalog(file.callModel);
  const target = catalog.targets.find(candidate => candidate.kind === kind && (name === undefined || candidate.name === name));
  if (!target) throw new Error(`missing top-level target for ${path}`);
  return {
    sourceIndex: file.index,
    path: file.path,
    sourceIdentity: catalog.sourceIdentity,
    target,
  };
}

function pipelineInput(
  source: X4UiWorkspaceSource,
  selection?: X4UiPreviewSelection,
  corpus: unknown = null,
  options: Pick<X4UiPreviewPipelineInput, 'samples' | 'paths' | 'tableView' | 'textPolicy'> = {},
  profileOverrides: Partial<Pick<X4UiPreviewProfileInput, 'truthGrade' | 'minTextHeight' | 'localExpansion' | 'drawable' | 'uiScale'>> = {},
  colorEvidence?: unknown,
): X4UiPreviewPipelineInput {
  const input = {
    source,
    corpus,
    profile: {
      id: 'batch6b-profile',
      provenance: 'Batch 6B source-pinned selftest',
      truthGrade: 'unverified-default',
      source: selection?.sourceIdentity || {
        file: 'unselected.lua',
        sourcePath: 'fixture://unselected.lua',
        sha256: '0'.repeat(64),
      },
      drawable: { width: 2560, height: 1440 },
      uiScale: 1.4,
      ...profileOverrides,
    },
    ...(selection === undefined ? {} : { selection }),
    ...options,
  } as unknown as X4UiPreviewPipelineInput;
  if (colorEvidence !== undefined) {
    Object.defineProperty(input, 'colorEvidence', {
      configurable: true,
      enumerable: true,
      value: colorEvidence,
      writable: true,
    });
  }
  return input;
}

function pipeline(
  source: X4UiWorkspaceSource,
  selection?: X4UiPreviewSelection,
  corpus: unknown = null,
  options: Pick<X4UiPreviewPipelineInput, 'samples' | 'paths' | 'tableView' | 'textPolicy'> = {},
  profileOverrides: Partial<Pick<X4UiPreviewProfileInput, 'truthGrade' | 'minTextHeight' | 'localExpansion' | 'drawable' | 'uiScale'>> = {},
  colorEvidence?: unknown,
) {
  return projectX4UiPreviewPipeline(pipelineInput(source, selection, corpus, options, profileOverrides, colorEvidence));
}

const source = sourceFor([
  passthrough('ui.xml', uiXml),
  passthrough('ui/first.lua', firstLua, { reason: 'unparsed' }),
  passthrough('ui/sample.lua', sampleLua, { reason: 'unparsed' }),
  passthrough('ui/duplicate.lua', duplicateLua, { reason: 'unparsed' }),
  passthrough('ui/lint.lua', lintLua, { reason: 'partial' }),
  passthrough('ui/orphan.lua', '-- retained unregistered\n', { reason: 'unknown_domain' }),
]);
const selected = selectionFor(source);
const unchangedSource = JSON.stringify(source);

check('scaleSizeMinValue exact below-minimum golden', scaleSizeMinValue(1, 3, 1.4) === 3);
check('scaleSizeMinValue exact rounding-boundary golden', scaleSizeMinValue(2.5, 0, 1) === 3);
check('scaleSizeMinValue exact above-boundary golden', scaleSizeMinValue(3.1, 0, 1.4) === 4);

const profile = buildX4UiPreviewProfile({
  id: 'profile-golden',
  provenance: 'Batch 6B captured source fixture',
  truthGrade: 'unverified-default',
  source: selected.sourceIdentity,
  drawable: { width: 2560, height: 1440 },
  uiScale: 1.4,
});
check('profile 2560x1440/1.4 carries unverified-default truth',
  profile.frame.width === 2560
  && profile.frame.height === 1440
  && profile.metrics.uiScale === 1.4
  && profile.truthGrade === 'unverified-default');
check('profile ports exact widget-derived metrics',
  profile.metrics.borderSize === 3
  && profile.metrics.standardContainerOffset === 6
  && profile.metrics.scrollbarWidth === 12);
check('profile carries exact Helper/widget pins',
  profile.helper.constants.standardTextHeight.value === 16
  && profile.helper.constants.standardTextHeight.source.lineStart === 533
  && profile.helper.constants.standardButtonHeight.value === 25
  && profile.helper.constants.standardButtonHeight.source.lineStart === 522
  && profile.widget.sourcePath === 'ui/widget/lua/widget_fullscreen.lua');
const suppliedProfile = buildX4UiPreviewProfile({
  id: 'profile-supplied',
  provenance: 'Batch 6B supplied dimensions',
  truthGrade: 'supplied',
  source: selected.sourceIdentity,
  drawable: { width: 1280, height: 720 },
  uiScale: 1,
});
check('profile dimensions and scale flow only through the source-backed port',
  suppliedProfile.truthGrade === 'supplied'
  && suppliedProfile.frame.width === 1280
  && suppliedProfile.frame.height === 720
  && suppliedProfile.metrics.uiScale === 1
  && suppliedProfile.metrics.borderSize === 2
  && suppliedProfile.metrics.standardContainerOffset === 4
  && suppliedProfile.metrics.scrollbarWidth === 8
  && suppliedProfile.helper.constants.standardTextHeight.value === profile.helper.constants.standardTextHeight.value);
check('profile is deeply frozen and JSON serializable',
  Object.isFrozen(profile)
  && Object.isFrozen(profile.helper)
  && Object.isFrozen(profile.helper.constants)
  && JSON.stringify(profile).length > 0);

const noSelection = pipeline(source);
check('no source selection never auto-selects a target',
  noSelection.status === 'needs-selection'
  && noSelection.selection.reason === 'source-and-target-selection-required'
  && noSelection.profile.layout?.frame.width === 2560
  && noSelection.selectedSource === undefined
  && noSelection.program === undefined
  && noSelection.sourceCandidates.length >= 2);
check('lint is materialized before target selection',
  noSelection.lint.length === source.bundle?.sourceFiles.length
  && noSelection.lint.some(file => file.unregistered && file.path === 'ui/orphan.lua'));
check('lint retains a blocking finding independently of selection',
  noSelection.lint.some(file => file.path === 'ui/lint.lua'
    && (file.lint?.hasErrors === true || file.lint?.hasWarnings === true)));
check('source candidates retain exact source identities and target catalogs',
  noSelection.sourceCandidates.every(candidate => candidate.targetCount === candidate.targets.length)
  && noSelection.sourceCandidates.some(candidate => candidate.path === 'ui/first.lua'
    && candidate.sourceIdentity?.sha256 === selected.sourceIdentity.sha256));
const duplicateCandidate = noSelection.sourceCandidates.find(candidate => candidate.path === 'ui/duplicate.lua');
const duplicateTargets = duplicateCandidate?.targets.filter(candidate => candidate.name === 'menu.duplicate') || [];
check('duplicate same-name targets remain distinct exact catalog choices',
  duplicateTargets.length === 2
  && new Set(duplicateTargets.map(candidate => candidate.id)).size === 2
  && duplicateTargets[0].source.start.offset !== duplicateTargets[1].source.start.offset);

const tableView: Readonly<Record<string, X4UiSceneTableViewState>> = {
  'table-fixture': { topRow: 1, scrollOffset: 4, selectedRow: 0 },
};
const exactNoCorpus = pipeline(source, selected, null, { tableView });
check('exact source/target selection is accepted without fallback',
  exactNoCorpus.selection.status === 'selected'
  && exactNoCorpus.selectedSource?.path === 'ui/first.lua'
  && exactNoCorpus.selectedTarget?.id === selected.target.id
  && exactNoCorpus.program !== undefined);
check('missing canonical corpus refuses Scene geometry',
  exactNoCorpus.status === 'refused'
  && exactNoCorpus.scene?.status === 'refused');
check('missing canonical corpus keeps layout program/refusal distinction',
  exactNoCorpus.program?.status === 'refused'
  && 'program' in exactNoCorpus.program
  && exactNoCorpus.program.program.status === 'refused');
check('table view state is retained as detached preview evidence',
  exactNoCorpus.profile.tableView !== tableView
  && exactNoCorpus.profile.tableView?.['table-fixture'].scrollOffset === 4
  && Object.isFrozen(exactNoCorpus.profile.tableView));
check('every output branch carries literal game truth',
  exactNoCorpus.gameTruth === 'Not verified in game'
  && exactNoCorpus.verification.game === 'Not verified in game'
  && exactNoCorpus.verification.gameVerified === false
  && exactNoCorpus.source.verification === 'Not verified in game'
  && exactNoCorpus.authority.verification === 'Not verified in game');

const staleSource = {
  ...selected,
  path: 'ui/missing.lua',
};
const staleSelection = pipeline(source, staleSource);
check('stale source path is visible and never falls back',
  staleSelection.status === 'needs-selection'
  && staleSelection.selection.reason === 'source-selection-is-stale-or-ambiguous'
  && staleSelection.program === undefined);

const staleTarget = {
  ...selected,
  target: { ...selected.target, id: `${selected.target.id}:stale` },
};
const staleTargetResult = pipeline(source, staleTarget);
check('stale target ID is visible with candidates and no preview',
  staleTargetResult.status === 'needs-selection'
  && staleTargetResult.targetCandidates.length > 0
  && staleTargetResult.program === undefined);
const staleRange = {
  ...selected,
  target: {
    ...selected.target,
    source: {
      ...selected.target.source,
      end: { ...selected.target.source.end, offset: selected.target.source.end.offset + 1 },
    },
  },
};
const staleRangeResult = pipeline(source, staleRange);
check('stale target source range is rejected without fallback',
  staleRangeResult.status === 'needs-selection'
  && staleRangeResult.targetCandidates.length > 0
  && staleRangeResult.program === undefined);

const staleSamples = projectX4UiPreviewPipeline({
  source,
  corpus: null,
  profile: {
    id: 'sample-profile',
    provenance: 'Batch 6B sample selftest',
    truthGrade: 'unverified-default',
    source: selected.sourceIdentity,
    drawable: { width: 100, height: 80 },
    uiScale: 1,
  },
  selection: selected,
  samples: {
    catalogId: 'stale-catalog',
    source: selected.sourceIdentity,
    values: [],
  },
});
check('stale sample input remains a producer refusal',
  staleSamples.status === 'refused'
  && staleSamples.program?.status === 'refused'
  && staleSamples.scene === undefined);

const sampledSelection = selectionFor(source, 'ui/sample.lua', 'function');
const sampledBaseline = pipeline(source, sampledSelection);
const sampledProgram = sampledBaseline.program !== undefined && 'program' in sampledBaseline.program
  ? sampledBaseline.program.program
  : undefined;
const sampledEntry = sampledProgram?.sampleCatalog.entries.find(candidate => candidate.expectedType === 'number');
const sampledValue: X4UiLayoutPreviewSampleInput | undefined = sampledEntry === undefined
  ? undefined
  : {
    catalogId: sampledProgram.sampleCatalog.id,
    source: sampledProgram.sampleCatalog.sourceIdentity,
    values: [{ id: sampledEntry.id, value: 80 }],
  };
const sampledPipeline = sampledValue === undefined
  ? undefined
  : pipeline(source, sampledSelection, null, { samples: sampledValue });
check('real source sample catalog can be applied without source mutation',
  sampledValue !== undefined
  && sampledPipeline?.selection.status === 'selected'
  && sampledPipeline.program !== undefined
  && 'program' in sampledPipeline.program
  && sampledPipeline.program.program.previewSampleBindings.some(binding => binding.status === 'consumed')
  && JSON.stringify(source) === unchangedSource);
const stalePathInput: X4UiLayoutPreviewPathSelectionInput = {
  catalogId: 'stale-preview-path-catalog',
  source: sampledSelection.sourceIdentity,
  selections: [],
};
const stalePathResult = pipeline(source, sampledSelection, null, {
  paths: stalePathInput,
});
check('stale preview path catalog remains an explicit program refusal',
  stalePathResult.selection.status === 'selected'
  && stalePathResult.program?.status === 'refused'
  && stalePathResult.scene === undefined);

const synthetic = pipeline(source, selected, {
  ok: true,
  evidenceKind: 'synthetic',
  canonical: false,
  canonicalIdentity: 'synthetic-contract',
});
check('synthetic corpus is retained but cannot promote Scene geometry',
  synthetic.corpus.status === 'synthetic'
  && synthetic.corpus.canonical === false
  && synthetic.scene?.status === 'refused');

const staleCorpus = pipeline(source, selected, {
  ok: true,
  evidenceKind: 'canonical-9.00',
  canonical: true,
  canonicalIdentity: 'x4-9.00',
});
check('structurally canonical-looking stale corpus is refused as stale',
  staleCorpus.corpus.status === 'stale'
  && staleCorpus.corpus.available === false
  && staleCorpus.status === 'refused');

const generatedSource = sourceFor([
  passthrough('ui.xml', uiXml),
  passthrough('ui/first.lua', firstLua),
], {
  uiWidgets: [{
    id: 'generated-widget',
    type: 'button',
    x: 0,
    y: 0,
    w: 10,
    h: 10,
    label: 'generated',
    properties: {},
  }],
});
const generatedResult = pipeline(generatedSource);
check('generated-shadowing source authority remains visible',
  generatedSource.status === 'generated-shadowing-source'
  && generatedResult.source.status === 'generated-shadowing-source'
  && generatedResult.authority.editable === generatedSource.editable);

const lockedSource = sourceFor([
  passthrough('ui.xml', '<addon><environment type="menus"><file name="ui/missing.lua" /></environment></addon>'),
  passthrough('ui/first.lua', firstLua),
]);
const lockedResult = pipeline(lockedSource);
check('locked-readable source retains diagnostics without becoming editable',
  lockedSource.status === 'locked'
  && lockedSource.bundle !== null
  && lockedResult.source.status === 'locked'
  && lockedResult.authority.editable === false
  && lockedResult.authority.shippable === false
  && lockedResult.lint.length === lockedSource.bundle.sourceFiles.length);

const duplicateRootSource = sourceFor([
  passthrough('ui.xml', uiXml),
  passthrough('UI.XML', uiXml),
  passthrough('ui/first.lua', firstLua),
]);
const duplicateRootResult = pipeline(duplicateRootSource);
check('duplicate roots remain unavailable and never choose a winner',
  duplicateRootSource.status === 'unavailable'
  && duplicateRootSource.rootCandidates.length === 2
  && duplicateRootSource.bundle === null
  && duplicateRootResult.selection.status === 'unavailable'
  && duplicateRootResult.program === undefined
  && duplicateRootResult.scene === undefined);

const unavailableSource = sourceFor([]);
const unavailableResult = pipeline(unavailableSource);
check('no-source root is unavailable and returns no geometry',
  unavailableResult.status === 'refused'
  && unavailableResult.selection.status === 'unavailable'
  && unavailableResult.program === undefined
  && unavailableResult.scene === undefined);

const replayA = pipeline(source, selected);
const replayB = pipeline(source, selected);
check('pipeline replay is deterministic', JSON.stringify(replayA) === JSON.stringify(replayB));
check('pipeline does not mutate workspace source inputs', JSON.stringify(source) === unchangedSource);
check('pipeline output is deeply frozen',
  Object.isFrozen(replayA)
  && Object.isFrozen(replayA.source)
  && Object.isFrozen(replayA.sourceCandidates)
  && Object.isFrozen(replayA.lint)
  && (replayA.program === undefined || Object.isFrozen(replayA.program)));
check('pipeline output is JSON serializable', JSON.stringify(replayA).length > 0);
check('aliases expose the same pure projector', buildX4UiPreviewPipeline === projectX4UiPreviewPipeline);

async function runIndependentReviewCorrections(): Promise<{
  readonly canonicalProjected: boolean;
  readonly canonicalFacts: CanonicalAcceptanceFacts;
  readonly canonicalMutationControls: {
    readonly sourceIdentity: boolean;
    readonly fontHash: boolean;
    readonly zeroGeometry: boolean;
  };
  readonly canonicalMutationEvidence: {
    readonly sourceIdentity: {
      readonly before: unknown;
      readonly after: unknown;
      readonly acceptedAfter: boolean;
    };
    readonly fontHash: {
      readonly before: unknown;
      readonly after: unknown;
      readonly acceptedAfter: boolean;
    };
    readonly zeroGeometry: {
      readonly beforeCells: unknown;
      readonly afterCells: unknown;
      readonly acceptedAfter: boolean;
    };
  };
  readonly partialProgram: boolean;
  readonly refusedProgram: boolean;
  readonly successfulPath: boolean;
  readonly blockingLintSurvivesRefusal: boolean;
  readonly canonicalLoaderReady: boolean;
  readonly canonicalLoaderRestored: boolean;
  readonly normalization: {
    readonly static: boolean;
    readonly dynamic: boolean;
    readonly controls: {
      readonly sourceRange: boolean;
      readonly removedDefinedMember: boolean;
      readonly addedDefinedMember: boolean;
      readonly reorderedCalls: boolean;
    };
  };
  readonly normalizationEvidence: {
    readonly static: ExistingModelNormalizationAudit | undefined;
    readonly dynamic: ExistingModelNormalizationAudit | undefined;
    readonly controls: {
      readonly sourceRange: NormalizationControlResult | undefined;
      readonly removedDefinedMember: NormalizationControlResult | undefined;
      readonly addedDefinedMember: NormalizationControlResult | undefined;
      readonly reorderedCalls: NormalizationControlResult | undefined;
    };
  };
}> {
  const minTextHeightGrades = ['supplied', 'captured', 'unverified-default'] as const;
  for (const truthGrade of minTextHeightGrades) {
    const gradeResult = pipeline(source, selected, null, {}, { truthGrade, minTextHeight: 12 });
    check(`minTextHeight preserves ${truthGrade} on refusal`,
      gradeResult.status === 'refused'
      && gradeResult.profile.minTextHeight?.value === 12
      && String(gradeResult.profile.minTextHeight.truthGrade) === truthGrade,
      {
        fixtureReady: gradeResult.status === 'refused' && gradeResult.profile.minTextHeight?.value === 12,
        expected: truthGrade,
        actual: gradeResult.profile.minTextHeight?.truthGrade,
      });
  }
  const omittedMinTextHeight = pipeline(source, selected, null, {}, { truthGrade: 'unverified-default' });
  check('omitted minTextHeight remains unavailable',
    omittedMinTextHeight.profile.minTextHeight === undefined,
    { actual: omittedMinTextHeight.profile.minTextHeight });

  const malformedUiScale = projectX4UiPreviewPipeline({
    source,
    corpus: null,
    profile: {
      id: 'malformed-ui-scale',
      provenance: 'Batch 6B malformed-input selftest',
      truthGrade: 'unverified-default',
      source: selected.sourceIdentity,
      drawable: { width: 2560, height: 1440 },
      uiScale: Number.NaN,
    },
    selection: selected,
  } as unknown as X4UiPreviewPipelineInput);
  check('malformed uiScale returns an honest frozen refusal shape',
    malformedUiScale.status === 'refused'
    && malformedUiScale.profile.layout === undefined
    && !Object.prototype.hasOwnProperty.call(malformedUiScale.profile, 'widgetPort')
    && Object.isFrozen(malformedUiScale.profile)
    && JSON.stringify(malformedUiScale).length > 0
    && malformedUiScale.gameTruth === 'Not verified in game',
    {
      fixtureReady: malformedUiScale.status === 'refused',
      profileKeys: Object.keys(malformedUiScale.profile),
      gap: malformedUiScale.gaps[0],
    });
  const malformedProfile = projectX4UiPreviewPipeline({} as unknown as X4UiPreviewPipelineInput);
  check('missing profile input cannot expose pretend normalized metrics',
    malformedProfile.status === 'refused'
    && malformedProfile.profile.layout === undefined
    && Object.keys(malformedProfile.profile).length === 0
    && malformedProfile.gaps.length === 1
    && malformedProfile.verification.game === 'Not verified in game',
    { profileKeys: Object.keys(malformedProfile.profile), gaps: malformedProfile.gaps });

  const blockingSelection = selectionFor(source, 'ui/lint.lua', 'top-level');
  const blockingRefusal = pipeline(source, blockingSelection);
  const blockingLintFile = blockingRefusal.lint.find(file => file.path === 'ui/lint.lua');
  const blockingFinding = blockingLintFile?.lint?.findings.find(finding => finding.code === 'x4-ui.add-table-column-limit');
  check('blocking addTable(24) lint survives downstream program refusal with exact evidence',
    blockingRefusal.program?.status === 'refused'
    && blockingFinding !== undefined
    && blockingFinding.rule === 'x4-ui.add-table-column-limit'
    && blockingFinding.severity === 'error'
    && blockingFinding.location.start.line === 2
    && blockingFinding.location.start.column === 0
    && blockingFinding.location.start.offset < blockingFinding.location.end.offset
    && blockingLintFile?.lint?.errorCount === 1,
    {
      fixtureReady: blockingFinding !== undefined,
      programStatus: blockingRefusal.program?.status,
      finding: blockingFinding,
    });

  const canonicalXml = [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<addon name="canonical-fixture">',
    '  <environment type="menus">',
    '    <file name="ui/canonical.lua" />',
    '  </environment>',
    '</addon>',
    '',
  ].join('\n');
  const canonicalSource = sourceFor([
    passthrough('ui.xml', canonicalXml),
    passthrough('ui/canonical.lua', canonicalLua, { reason: 'unparsed' }),
  ]);
  const canonicalSelection = selectionFor(canonicalSource, 'ui/canonical.lua', 'top-level');
  const canonicalSourceBefore = JSON.stringify(canonicalSource);
  let canonical: X4UiCorpusCanonicalSuccess | undefined;
  let canonicalLoaderReady = false;
  try {
    canonical = await loadCanonicalSelftestResult();
    canonicalLoaderReady = true;
  } catch (error) {
    check('loader-issued canonical corpus fixture is ready', false, {
      fixtureReady: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
  const canonicalBytesBefore = canonical === undefined ? undefined : JSON.stringify({
    helper: Array.from(canonical.assets.helper.bytes),
    widget: Array.from(canonical.assets.widget.bytes),
    regularDescriptor: Array.from(canonical.assets.regular.descriptor.bytes),
    regularAtlas: Array.from(canonical.assets.regular.atlas.bytes),
    boldDescriptor: Array.from(canonical.assets.bold.descriptor.bytes),
    boldAtlas: Array.from(canonical.assets.bold.atlas.bytes),
  });
  const canonicalProjectedResult = canonical === undefined
    ? undefined
    : pipeline(canonicalSource, canonicalSelection, canonical, {}, {
      truthGrade: 'supplied',
      minTextHeight: 10,
      drawable: { width: 100, height: 80 },
      uiScale: 1,
    });
  const canonicalProgram = canonicalProjectedResult?.program !== undefined && 'program' in canonicalProjectedResult.program
    ? canonicalProjectedResult.program.program
    : undefined;
  const canonicalScene = canonicalProjectedResult?.scene !== undefined && 'scene' in canonicalProjectedResult.scene
    ? canonicalProjectedResult.scene.scene
    : undefined;
  const canonicalFacts = canonicalAcceptanceFacts(canonical, canonicalSelection, canonicalProjectedResult);
  const canonicalProjected = canonicalFacts.accepted;
  check('loader-issued canonical corpus reaches projected Scene geometry with matching identities',
    canonicalProjected,
    {
      fixtureReady: canonical !== undefined && canonicalSelection.target.id.length > 0,
      facts: canonicalFacts,
      pipelineStatus: canonicalProjectedResult?.status,
      programStatus: canonicalProjectedResult?.program?.status,
      sceneStatus: canonicalScene?.status,
      programGapCount: canonicalProgram?.gaps.length,
      operationStatuses: canonicalProgram?.operations.reduce<Record<string, number>>((counts, operation) => {
        counts[operation.status] = (counts[operation.status] || 0) + 1;
        return counts;
      }, {}),
      nodeStatuses: canonicalProgram === undefined ? undefined : {
        frames: canonicalProgram.frames.map(node => node.status),
        tables: canonicalProgram.tables.map(node => node.status),
        rows: canonicalProgram.rows.map(node => node.status),
        cells: canonicalProgram.cells.map(node => node.status),
      },
      sourceMatches: canonicalProjectedResult?.profile.layout !== undefined
        && JSON.stringify(canonicalProjectedResult.profile.layout.source) === JSON.stringify(canonicalSelection.sourceIdentity)
        && canonicalScene?.profile.source !== undefined
        && JSON.stringify(canonicalScene.profile.source) === JSON.stringify(canonicalSelection.sourceIdentity),
      dimensionsMatch: canonicalScene?.profile.drawable.width === canonicalProjectedResult?.profile.layout?.frame.width
        && canonicalScene?.profile.drawable.height === canonicalProjectedResult?.profile.layout?.frame.height,
      helperPinsMatch: canonicalScene?.profile.helper.sourcePath === HELPER_SOURCE_PATH
        && canonicalScene?.profile.helper.sha256 === canonical?.helperSourceHash
        && canonicalScene?.profile.widget.sourcePath === WIDGET_SOURCE_PATH
        && canonicalScene?.profile.widget.sha256 === canonical?.widgetSourceHash,
      fontPinsMatch: canonicalScene?.profile.fonts.Zekton.descriptor.sha256 === canonical?.assets.regular.descriptor.sha256
        && canonicalScene?.profile.fonts['Zekton Bold'].atlas.sha256 === canonical?.assets.bold.atlas.sha256,
      sceneGeometry: canonicalScene === undefined ? undefined : {
        frames: canonicalScene.frames.length,
        tables: canonicalScene.tables.length,
        rows: canonicalScene.rows.length,
        cells: canonicalScene.cells.length,
        widgets: canonicalScene.widgets.length,
        gaps: canonicalScene.gaps.length,
      },
      sceneGameTruth: canonicalScene?.gameTruth,
    });

  const previewColorSource = sourceFor([
    passthrough('ui.xml', previewColorXml),
    passthrough('ui/preview-colors.lua', previewColorLua, { reason: 'unparsed' }),
  ]);
  const previewColorSelection = selectionFor(previewColorSource, 'ui/preview-colors.lua', 'top-level');
  let colorAuthority: X4UiCorpusCanonicalColorSuccess | undefined;
  try {
    colorAuthority = await loadCanonicalColorSelftestResult();
  } catch (error) {
    check('P4.5 loader-issued canonical color fixture is ready', false, {
      fixtureReady: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
  const colorAuthorityReady = colorAuthority !== undefined
    && isX4UiCorpusCanonicalColorSuccess(colorAuthority)
    && colorAuthority.graph.baseColors.length === 224
    && colorAuthority.graph.mappings.length === 804;
  check('P4.5 loader-issued canonical color fixture has exact 224 base colors and 804 mappings', colorAuthorityReady, {
    fixtureReady: colorAuthority !== undefined,
    guard: colorAuthority === undefined ? false : isX4UiCorpusCanonicalColorSuccess(colorAuthority),
    baseColors: colorAuthority?.graph.baseColors.length,
    mappings: colorAuthority?.graph.mappings.length,
  });

  const exactPipelineFixtureText = `-- Pipeline Test UI — X4 UI extension entry point
-- Packaged at: extensions/pipeline_test/ui/pipeline_test.lua
-- Registered by: extensions/pipeline_test/ui.xml (<environment type="menus">)
-- Generated from the visual designer by X4 Forge. Uses the corpus-backed
-- standalone-menu lifecycle: lazy Helper -> deferred registration -> OpenMenu
-- -> onShowMenu -> createFrameHandle/fTable -> frame:display().

local widgets = {
    { type = "window", id = "w_win", label = "Pipeline Test Panel", x = 120, y = 120, width = 280, height = 120 },
    { type = "header", id = "w_header", label = "B119 Pipeline Test", x = 140, y = 140, width = 380, height = 32 },
    { type = "button", id = "w_btn", label = "My First Button", x = 150, y = 170, width = 220, height = 40 },
    { type = "text", id = "w_status", label = "Status: source-first Forge preview", x = 140, y = 182, width = 380, height = 32 },
    { type = "button", id = "w_btn_secondary", label = "Second Button", x = 390, y = 230, width = 160, height = 40 },
    { type = "input", id = "w_input", label = "Operator note", x = 140, y = 286, width = 410, height = 44 },
}

local Helper = rawget(_G, "Helper")
local function refreshHelper()
  if not Helper then Helper = rawget(_G, "Helper") end
  return Helper
end

local menu = {
  name = "pipeline_test_menu",
  layer = 4,
  active = false,
  widgets = widgets,
  transcript = "",
}

local function log(message)
  if DebugError then DebugError("[pipeline_test] " .. tostring(message)) end
end

function menu.ensureRegistered()
  refreshHelper()
  _G.Menus = _G.Menus or {}
  local found = false
  for i, existing in ipairs(_G.Menus) do
    if existing.name == menu.name then _G.Menus[i] = menu; found = true; break end
  end
  if not found then table.insert(_G.Menus, menu) end
  if Helper and Helper.registerMenu and not menu._registered then
    local ok = pcall(Helper.registerMenu, menu)
    menu._registered = ok
  end
  return menu._registered == true
end

function menu.open(context)
  menu.context = type(context) == "table" and context or {}
  if not menu.ensureRegistered() then
    if SetScript then SetScript("onUpdate", menu.retryOpen) end
    return false
  end
  if OpenMenu then OpenMenu(menu.name, nil, nil, true)
  elseif menu.onShowMenu then menu.onShowMenu() end
  return true
end

function menu.retryOpen()
  if not menu.ensureRegistered() then return end
  if RemoveScript then RemoveScript("onUpdate", menu.retryOpen) end
  menu.open(menu.context)
end

function menu.onShowMenu()
  refreshHelper()
  menu.active = true
  menu.createFrame()
end

function menu.emit(widgetId, payload)
  if AddUITriggeredEvent then AddUITriggeredEvent(menu.name, widgetId, payload or {}) end
end

function menu.createFrame()
  refreshHelper()
  if not Helper then log("Helper unavailable; frame not built"); return end
  if menu.frame and Helper.clearDataForRefresh then Helper.clearDataForRefresh(menu, menu.layer) end
  local width = Helper.scaleX(530)
  local height = Helper.scaleY(436)
  local x = ((Helper.viewWidth or 1920) - width) / 2
  local y = ((Helper.viewHeight or 1080) - height) / 2
  menu.frame = Helper.createFrameHandle(menu, { x = x, y = y, width = width, height = height, layer = menu.layer, standardButtons = { close = true } })
  local ftable = menu.frame:addTable(2, { tabOrder = 1, width = width, highlightMode = "off", reserveScrollBar = false })
  ftable:setColWidthPercent(1, 55)
  ftable:setColWidthPercent(2, 45)
  local row
  row = ftable:addRow(false, {})
  row[1]:setColSpan(2):createText("Pipeline Test Panel", Helper.headerRowCenteredProperties)
  row = ftable:addRow(false, {})
  row[1]:setColSpan(2):createText("B119 Pipeline Test", Helper.headerRowCenteredProperties)
  row = ftable:addRow(true, {})
  row[1]:setColSpan(2):createButton({ active = true }):setText("My First Button", { halign = "center" })
  row[1].handlers.onClick = function() menu.emit("w_btn", { widget = "w_btn" }) end
  row = ftable:addRow(false, {})
  row[1]:setColSpan(2):createText("Status: source-first Forge preview", { wordwrap = true })
  row = ftable:addRow(true, {})
  row[1]:setColSpan(2):createButton({ active = true }):setText("Second Button", { halign = "center" })
  row[1].handlers.onClick = function() menu.emit("w_btn_secondary", { widget = "w_btn_secondary" }) end
  row = ftable:addRow(true, {})
  row[1]:setColSpan(2):createEditBox({ defaultText = "Type a note...", maxChars = 255, height = 44 })
  row[1].handlers.onEditBoxDeactivated = function(_, text) menu.emit("w_input", { text = text }) end
  menu.frame:display()
end

function menu.cleanup()
  menu.frame = nil
  menu.active = false
end

function menu.onCloseElement(dueToClose)
  refreshHelper()
  if Helper and Helper.closeMenu then Helper.closeMenu(menu, dueToClose) end
  menu.cleanup()
end

function menu.close()
  menu.onCloseElement("close")
end

-- Deliberate opening path for MD/companion Lua: <raise_lua_event name="'pipeline_test_menu.open'"/>.
if RegisterEvent then RegisterEvent("pipeline_test_menu.open", function(_, context) menu.open(context) end) end
_G["pipeline_test_menu"] = menu

-- The beginner template opts into one visible first result. Ordinary authored menus do not auto-open.
local function autoOpenWhenReady()
  refreshHelper()
  if not Helper then return end
  if RemoveScript then RemoveScript("onUpdate", autoOpenWhenReady) end
  menu.open({ source = "x4_forge_template" })
end
if SetScript then SetScript("onUpdate", autoOpenWhenReady) end


return menu
`;
  const exactPipelineXml = [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<addon name="pipeline_test">',
    '  <environment type="menus">',
    '    <file name="ui/pipeline_test.lua" />',
    '  </environment>',
    '</addon>',
    '',
  ].join('\n');
  const exactPipelineSource = sourceFor([
    passthrough('ui.xml', exactPipelineXml),
    passthrough('ui/pipeline_test.lua', exactPipelineFixtureText, { reason: 'unparsed' }),
  ]);
  const exactPipelineSelection = selectionFor(exactPipelineSource, 'ui/pipeline_test.lua', 'function', 'menu.createFrame');
  const exactPipelineAtOne = canonical === undefined || !colorAuthorityReady
    ? undefined
    : pipeline(exactPipelineSource, exactPipelineSelection, canonical, {}, {
      truthGrade: 'supplied',
      drawable: { width: 1920, height: 1080 },
      uiScale: 1,
    }, colorAuthority);
  const exactPipelineAt125 = canonical === undefined || !colorAuthorityReady
    ? undefined
    : pipeline(exactPipelineSource, exactPipelineSelection, canonical, {}, {
      truthGrade: 'supplied',
      drawable: { width: 2544, height: 1353 },
      uiScale: 1.25,
    }, colorAuthority);
  const exactPipelineProgram = (result: typeof exactPipelineAtOne) =>
    result?.program !== undefined && 'program' in result.program ? result.program.program : undefined;
  const exactPipelineScene = (result: typeof exactPipelineAtOne) =>
    result?.scene !== undefined && 'scene' in result.scene ? result.scene.scene : undefined;
  const exactPipelineOneProgram = exactPipelineProgram(exactPipelineAtOne);
  const exactPipeline125Program = exactPipelineProgram(exactPipelineAt125);
  const exactPipelineOneScene = exactPipelineScene(exactPipelineAtOne);
  const exactPipeline125Scene = exactPipelineScene(exactPipelineAt125);
  const exactPipelineCellHeights = (program: typeof exactPipelineOneProgram) => program?.rows.map(row => {
    const cell = program.cells.find(candidate => candidate.id === row.cellIds[0]);
    return cell?.height?.value;
  });
  const exactPipelineSceneGeometry = (scene: typeof exactPipelineOneScene) => scene === undefined ? undefined : {
    frames: scene.frames.length,
    tables: scene.tables.length,
    rows: scene.rows.length,
    cells: scene.cells.length,
    widgets: scene.widgets.length,
    texts: scene.texts.length,
    glyphs: scene.glyphs.length,
    gaps: scene.gaps.length,
  };
  const exactPipelineSceneFiniteGeometry = (scene: typeof exactPipelineOneScene): boolean => {
    const finiteRect = (value: unknown): boolean => {
      const rect = asRecord(value);
      return rect !== undefined
        && ['x', 'y', 'width', 'height'].every(key => typeof rect[key] === 'number' && Number.isFinite(rect[key]));
    };
    return scene !== undefined
      && scene.widgets.length === 6
      && scene.widgets.every(widget => finiteRect(widget.outerRect))
      && scene.texts.length === 8
      && scene.texts.every(text => text.lines.every(line => finiteRect(line.rect)));
  };
  const exactPipelineFact = (facts: unknown, name: string): {
    readonly status: unknown;
    readonly expectedType?: unknown;
    readonly domain?: unknown;
    readonly value?: unknown;
    readonly expression?: unknown;
  } | undefined => {
    const fact = asRecord(asRecord(facts)?.[name]);
    return fact === undefined ? undefined : {
      status: fact.status,
      expectedType: fact.expectedType,
      domain: fact.domain,
      value: fact.value,
      expression: fact.expression,
    };
  };
  const exactPipelineCreatorEvidence = (program: typeof exactPipelineOneProgram) => program?.operations
    .filter(operation => operation.kind === 'createText')
    .map(operation => {
      const cell = program.cells.find(candidate => candidate.id === operation.cellId);
      return {
        content: exactPipelineFact(cell?.descriptorFacts, 'text'),
        operation: {
          font: exactPipelineFact(operation.descriptorFacts, 'font'),
          fontsize: exactPipelineFact(operation.descriptorFacts, 'fontsize'),
          outerY: exactPipelineFact(operation.descriptorFacts, 'outerY'),
          outerHeight: exactPipelineFact(operation.descriptorFacts, 'outerHeight'),
          minTextHeight: exactPipelineFact(operation.descriptorFacts, 'minTextHeight'),
          halign: exactPipelineFact(operation.descriptorFacts, 'halign'),
          wordwrap: exactPipelineFact(operation.descriptorFacts, 'wordwrap'),
          cellbgcolor: exactPipelineFact(operation.descriptorFacts, 'cellbgcolor'),
        },
        cell: {
          font: exactPipelineFact(cell?.descriptorFacts, 'font'),
          fontsize: exactPipelineFact(cell?.descriptorFacts, 'fontsize'),
          outerY: exactPipelineFact(cell?.descriptorFacts, 'outerY'),
          outerHeight: exactPipelineFact(cell?.descriptorFacts, 'outerHeight'),
          minTextHeight: exactPipelineFact(cell?.descriptorFacts, 'minTextHeight'),
          halign: exactPipelineFact(cell?.descriptorFacts, 'halign'),
          wordwrap: exactPipelineFact(cell?.descriptorFacts, 'wordwrap'),
          cellbgcolor: exactPipelineFact(cell?.descriptorFacts, 'cellbgcolor'),
        },
        kernel: cell?.kernelState,
      };
    });
  const expectedHeaderCellBgColor: JsonRecord = {
    kind: 'color',
    domain: 'canonical-xml-byte-alpha',
    canonicalIdentity: 'x4-9.00',
    requestedId: 'container_subsection_header',
    resolvedBaseId: 'azure_dark_alpha_26',
    r: 0,
    g: 105,
    b: 179,
    a: 26,
    glow: 0,
    baseSource: {
      path: 'libraries/colors.xml',
      index: 6,
      id: 'azure_dark_alpha_26',
    },
    mappingSource: {
      path: 'libraries/colors.xml',
      index: 8,
      id: 'container_subsection_header',
    },
    sourceIdentities: {
      xml: {
        path: 'libraries/colors.xml',
        relativePath: 'libraries/colors.xml',
        sha256: X4_UI_CORPUS_COLORS_XML_SHA256,
        size: X4_UI_CORPUS_COLORS_XML_SIZE,
      },
      xsd: {
        path: 'libraries/colors.xsd',
        relativePath: 'libraries/colors.xsd',
        sha256: X4_UI_CORPUS_COLORS_XSD_SHA256,
        size: X4_UI_CORPUS_COLORS_XSD_SIZE,
      },
    },
    gameVerification: 'Not verified in game',
  };
  const exactPipelineKnownHeaderCellBgColor = (fact: unknown): boolean => {
    const record = asRecord(fact);
    return record?.status === 'known'
      && record.expectedType === 'color-object'
      && record.expression === 'Color["container_subsection_header"]'
      && firstJsonDifference(record.value, expectedHeaderCellBgColor) === undefined;
  };
  const exactPipelineTextEvidenceMatches = (
    program: typeof exactPipelineOneProgram,
    expectedOuterY: number,
    expectedFontSize: number,
    expectedHeaderMinTextHeight: number,
    expectedStatusMinTextHeight: number,
  ): boolean => {
    const creators = exactPipelineCreatorEvidence(program);
    if (creators === undefined || creators.length !== 3) return false;
    const headers = creators.slice(0, 2);
    const status = creators[2];
    const factValue = (fact: { readonly value?: unknown } | undefined): unknown => fact?.value;
    return headers.every(header =>
      factValue(header.operation.font) === 'Zekton Bold'
      && factValue(header.operation.fontsize) === expectedFontSize
      && factValue(header.operation.outerY) === expectedOuterY
      && factValue(header.operation.outerHeight) === expectedHeaderMinTextHeight
      && factValue(header.operation.minTextHeight) === expectedHeaderMinTextHeight
      && factValue(header.operation.halign) === 'center'
      && factValue(header.cell.font) === 'Zekton Bold'
      && factValue(header.cell.fontsize) === expectedFontSize
      && factValue(header.cell.outerY) === expectedOuterY
      && factValue(header.cell.outerHeight) === expectedHeaderMinTextHeight
      && factValue(header.cell.minTextHeight) === expectedHeaderMinTextHeight
      && factValue(header.cell.halign) === 'center'
      && exactPipelineKnownHeaderCellBgColor(header.operation.cellbgcolor)
      && exactPipelineKnownHeaderCellBgColor(header.cell.cellbgcolor)
      && header.kernel?.type === 'text'
      && header.kernel.y === 2
      && header.kernel.height === 0
      && header.kernel.minTextHeight === expectedHeaderMinTextHeight)
      && factValue(status?.operation.font) === 'Zekton'
      && factValue(status?.operation.fontsize) === expectedFontSize
      && factValue(status?.operation.outerY) === 0
      && factValue(status?.operation.outerHeight) === expectedStatusMinTextHeight
      && factValue(status?.operation.minTextHeight) === expectedStatusMinTextHeight
      && factValue(status?.operation.wordwrap) === true
      && factValue(status?.cell.font) === 'Zekton'
      && factValue(status?.cell.fontsize) === expectedFontSize
      && factValue(status?.cell.outerY) === 0
      && factValue(status?.cell.outerHeight) === expectedStatusMinTextHeight
      && factValue(status?.cell.minTextHeight) === expectedStatusMinTextHeight
      && factValue(status?.cell.wordwrap) === true
      && status?.kernel?.type === 'text'
      && status.kernel.y === 0
      && status.kernel.height === 0
      && status.kernel.minTextHeight === expectedStatusMinTextHeight;
  };
  const exactPipelinePaintAuthority = (result: typeof exactPipelineAtOne, scene: typeof exactPipelineOneScene): boolean =>
    scene !== undefined
    && issuedPaintSourceAuthority(result, scene)
    && materializeIssuedPaintScene(result, scene).value !== undefined;
  check('B119 fail-first exact deployed fixture source-proven geometry reaches six Scene/Paint creators at both profiles',
    exactPipelineSelection.sourceIdentity.sha256
      === 'C1D9CD8580C6175E95C543259A2AB19F8B463282BF48B2229EB6013D6052718E'
      && exactPipelineCellHeights(exactPipelineOneProgram)?.join(',') === '18,18,25,16,25,44'
      && exactPipelineOneProgram?.rows.map(row => row.height?.value).join(',') === '20,20,25,16,25,44'
      && exactPipelineOneProgram?.tables[0]?.height?.value === 160
      && exactPipelineCellHeights(exactPipeline125Program)?.join(',') === '22,22,31,20,31,55'
      && exactPipeline125Program?.rows.map(row => row.height?.value).join(',') === '25,25,31,20,31,55'
      && exactPipeline125Program?.tables[0]?.height?.value === 202
      && exactPipelineTextEvidenceMatches(exactPipelineOneProgram, 2, 9, 18, 16)
      && exactPipelineTextEvidenceMatches(exactPipeline125Program, 3, 12, 22, 20)
      && JSON.stringify(exactPipelineSceneGeometry(exactPipelineOneScene)) === JSON.stringify({ frames: 1, tables: 1, rows: 6, cells: 12, widgets: 6, texts: 8, glyphs: 99, gaps: 56 })
      && JSON.stringify(exactPipelineSceneGeometry(exactPipeline125Scene)) === JSON.stringify({ frames: 1, tables: 1, rows: 6, cells: 12, widgets: 6, texts: 8, glyphs: 99, gaps: 56 })
      && exactPipelineSceneFiniteGeometry(exactPipelineOneScene)
      && exactPipelineSceneFiniteGeometry(exactPipeline125Scene)
      && exactPipelinePaintAuthority(exactPipelineAtOne, exactPipelineOneScene)
      && exactPipelinePaintAuthority(exactPipelineAt125, exactPipeline125Scene),
    {
      sourceStatus: exactPipelineSource.status,
      sourceFiles: exactPipelineSource.bundle?.sourceFiles.map(file => ({ path: file.path })),
      selectedTarget: {
        id: exactPipelineSelection.target.id,
        kind: exactPipelineSelection.target.kind,
        name: exactPipelineSelection.target.name,
      },
      sourceSha256: exactPipelineSelection.sourceIdentity.sha256,
      modelSourcePath: exactPipelineSource.bundle?.sourceFiles.find(file => file.path === 'ui/pipeline_test.lua')?.callModel.file.sourcePath,
      canonical: canonical === undefined ? undefined : {
        guard: isX4UiCorpusCanonicalSuccess(canonical),
        helperPath: canonical.assets.helper.relativePath,
        helperHash: canonical.helperSourceHash,
        widgetPath: canonical.assets.widget.relativePath,
        widgetHash: canonical.widgetSourceHash,
        regularAlias: canonical.assets.regular.decoded === canonical.fonts.regular,
        boldAlias: canonical.assets.bold.decoded === canonical.fonts.bold,
        regularDescriptor: canonical.fonts.regular.descriptorIdentity,
        regularAtlas: canonical.fonts.regular.atlasIdentity,
        boldDescriptor: canonical.fonts.bold.descriptorIdentity,
        boldAtlas: canonical.fonts.bold.atlasIdentity,
      },
      atOne: {
        status: exactPipelineAtOne?.status,
        programStatus: exactPipelineAtOne?.program?.status,
        gaps: exactPipelineAtOne?.gaps,
        cellHeights: exactPipelineCellHeights(exactPipelineOneProgram),
        rowHeights: exactPipelineOneProgram?.rows.map(row => row.height?.value),
        tableHeight: exactPipelineOneProgram?.tables[0]?.height?.value,
        textEvidenceMatch: exactPipelineTextEvidenceMatches(exactPipelineOneProgram, 2, 9, 18, 16),
        creatorEvidence: exactPipelineCreatorEvidence(exactPipelineOneProgram),
        sceneGeometry: exactPipelineSceneGeometry(exactPipelineOneScene),
        sceneFiniteGeometry: exactPipelineSceneFiniteGeometry(exactPipelineOneScene),
        sceneStatus: exactPipelineAtOne?.scene?.status,
        paintAuthority: exactPipelinePaintAuthority(exactPipelineAtOne, exactPipelineOneScene),
      },
      at125: {
        status: exactPipelineAt125?.status,
        programStatus: exactPipelineAt125?.program?.status,
        gaps: exactPipelineAt125?.gaps,
        cellHeights: exactPipelineCellHeights(exactPipeline125Program),
        rowHeights: exactPipeline125Program?.rows.map(row => row.height?.value),
        tableHeight: exactPipeline125Program?.tables[0]?.height?.value,
        textEvidenceMatch: exactPipelineTextEvidenceMatches(exactPipeline125Program, 3, 12, 22, 20),
        creatorEvidence: exactPipelineCreatorEvidence(exactPipeline125Program),
        sceneGeometry: exactPipelineSceneGeometry(exactPipeline125Scene),
        sceneFiniteGeometry: exactPipelineSceneFiniteGeometry(exactPipeline125Scene),
        sceneStatus: exactPipelineAt125?.scene?.status,
        paintAuthority: exactPipelinePaintAuthority(exactPipelineAt125, exactPipeline125Scene),
      },
    });
  const colorPipeline = (evidence?: unknown) => canonical === undefined
    ? undefined
    : pipeline(previewColorSource, previewColorSelection, canonical, {}, {
      truthGrade: 'supplied',
      minTextHeight: 10,
      drawable: { width: 100, height: 80 },
      uiScale: 1,
    }, evidence);
  const omittedColorResult = colorPipeline();
  const omittedColorFacts = knownColorFactRecords(omittedColorResult);
  check('P4.5 omitted color evidence preserves no-color Preview behavior',
    omittedColorResult !== undefined
    && omittedColorFacts.length === 0
    && omittedColorResult.gameTruth === 'Not verified in game'
    && omittedColorResult.verification.gameVerified === false,
    {
      fixtureReady: omittedColorResult !== undefined,
      status: omittedColorResult?.status,
      programStatus: omittedColorResult?.program?.status,
      sceneStatus: omittedColorResult?.scene?.status,
      knownColorFacts: omittedColorFacts.length,
    });
  const colorResult = colorAuthority === undefined ? undefined : colorPipeline(colorAuthority);
  const colorResultRecord = asRecord(colorResult);
  const colorProgram = asRecord(asRecord(colorResultRecord?.program)?.program);
  const colorScene = asRecord(asRecord(colorResultRecord?.scene)?.scene);
  const colorOperations = Array.isArray(colorProgram?.operations) ? colorProgram.operations : [];
  const operationFor = (kind: string, needle: string): JsonRecord | undefined => colorOperations.find(operation => {
    const record = asRecord(operation);
    const sourceRange = asRecord(asRecord(record?.source)?.start);
    const endRange = asRecord(asRecord(record?.source)?.end);
    return record?.kind === kind
      && typeof sourceRange?.offset === 'number'
      && typeof endRange?.offset === 'number'
      && previewColorLua.slice(sourceRange.offset, endRange.offset).includes(needle);
  }) as JsonRecord | undefined;
  const operationFact = (kind: string, needle: string, field: string): JsonRecord | undefined => {
    const facts = asRecord(asRecord(operationFor(kind, needle))?.descriptorFacts);
    return asRecord(facts?.[field]);
  };
  const colorTables = Array.isArray(colorProgram?.tables) ? colorProgram.tables : [];
  const colorCells = Array.isArray(colorProgram?.cells) ? colorProgram.cells : [];
  const firstColorTable = asRecord(colorTables[0]);
  const firstColorCell = colorCells.map(asRecord).find(cell => cell?.column === 1);
  const sceneNodeFor = (collection: string, offset: unknown): JsonRecord | undefined => {
    const nodes = Array.isArray(colorScene?.[collection]) ? colorScene[collection] : [];
    return nodes.map(asRecord).find(node => asRecord(asRecord(node)?.source)?.start
      && asRecord(asRecord(asRecord(node)?.source)?.start)?.offset === offset);
  };
  const sceneFact = (node: JsonRecord | undefined, field: string): JsonRecord | undefined => {
    const facts = asRecord(node?.colorFacts);
    if (facts) return asRecord(facts[field]);
    const factList = node?.colorFacts;
    if (!Array.isArray(factList)) return undefined;
    return factList.map(asRecord).find(fact => fact?.field === field);
  };
  const colorFactValueMatches = (
    fact: unknown,
    domain: string,
    values: readonly [number, number, number, number, number | undefined],
  ): boolean => {
    const factRecord = asRecord(fact);
    const value = asRecord(factRecord?.value);
    return (factRecord?.status === undefined || factRecord.status === 'known')
      && (factRecord?.expectedType === undefined || factRecord.expectedType === 'color-object')
      && (factRecord?.domain === undefined || factRecord.domain === domain)
      && value?.domain === domain
      && value.r === values[0]
      && value.g === values[1]
      && value.b === values[2]
      && value.a === values[3]
      && value.glow === values[4];
  };
  const colorProgramFacts = {
    table: asRecord(asRecord(firstColorTable)?.descriptorFacts)?.backgroundColor,
    cell: asRecord(asRecord(firstColorCell)?.descriptorFacts)?.cellbgcolor,
    literal: operationFact('createText', 'createText("literal"', 'color'),
    buttonBackground: operationFact('createButton', 'createButton({ height = 12', 'bgcolor'),
    buttonHighlight: operationFact('createButton', 'createButton({ height = 12', 'highlightcolor'),
    buttonBorder: operationFact('createButton', 'createButton({ height = 12', 'bordercolor'),
    primary: operationFact('setText', 'setText("primary"', 'color'),
    secondary: operationFact('setText2', 'setText2("secondary"', 'color'),
    editbox: operationFact('createEditBox', 'createEditBox({ height = 12', 'bgcolor'),
    icon: operationFact('createIcon', 'createIcon("icon"', 'color'),
  };
  const colorSceneOwners = {
    table: sceneNodeFor('tables', asRecord(asRecord(firstColorTable)?.source)?.start && asRecord(asRecord(asRecord(firstColorTable)?.source)?.start)?.offset),
    cell: sceneNodeFor('cells', asRecord(asRecord(firstColorCell)?.source)?.start && asRecord(asRecord(asRecord(firstColorCell)?.source)?.start)?.offset),
    literal: (Array.isArray(colorScene?.texts) ? colorScene.texts : []).map(asRecord).find(node => node?.content === 'literal'),
    button: (Array.isArray(colorScene?.widgets) ? colorScene.widgets : []).map(asRecord).find(node => node?.kind === 'button'),
    primary: (Array.isArray(colorScene?.texts) ? colorScene.texts : []).map(asRecord).find(node => node?.content === 'primary'),
    secondary: (Array.isArray(colorScene?.texts) ? colorScene.texts : []).map(asRecord).find(node => node?.content === 'secondary'),
    editbox: (Array.isArray(colorScene?.widgets) ? colorScene.widgets : []).map(asRecord).find(node => node?.kind === 'editbox'),
    icon: (Array.isArray(colorScene?.widgets) ? colorScene.widgets : []).map(asRecord).find(node => node?.kind === 'icon'),
  };
  const programColorValues = colorResult !== undefined
    && colorProgramFacts.table !== undefined
    && colorProgramFacts.cell !== undefined
    && colorProgramFacts.literal !== undefined
    && colorProgramFacts.buttonBackground !== undefined
    && colorProgramFacts.buttonHighlight !== undefined
    && colorProgramFacts.buttonBorder !== undefined
    && colorProgramFacts.primary !== undefined
    && colorProgramFacts.secondary !== undefined
    && colorProgramFacts.editbox !== undefined
    && colorProgramFacts.icon !== undefined
    && colorFactValueMatches(colorProgramFacts.table, 'canonical-xml-byte-alpha', [11, 22, 33, 44, 0.1])
    && colorFactValueMatches(colorProgramFacts.cell, 'canonical-xml-byte-alpha', [51, 52, 53, 54, 0.2])
    && colorFactValueMatches(colorProgramFacts.literal, 'source-literal-percent-alpha', [12.5, 23.5, 34.5, 45.5, 0.25])
    && colorFactValueMatches(colorProgramFacts.buttonBackground, 'canonical-xml-byte-alpha', [61, 62, 63, 64, 0.4])
    && colorFactValueMatches(colorProgramFacts.buttonHighlight, 'canonical-xml-byte-alpha', [71, 72, 73, 74, 0.5])
    && colorFactValueMatches(colorProgramFacts.buttonBorder, 'canonical-xml-byte-alpha', [81, 82, 83, 84, 0.6])
    && colorFactValueMatches(colorProgramFacts.primary, 'canonical-xml-byte-alpha', [101, 102, 103, 104, 0.3])
    && colorFactValueMatches(colorProgramFacts.secondary, 'source-literal-percent-alpha', [15, 25, 35, 55, undefined])
    && colorFactValueMatches(colorProgramFacts.editbox, 'canonical-xml-byte-alpha', [91, 92, 93, 94, 0.7])
    && colorFactValueMatches(colorProgramFacts.icon, 'canonical-xml-byte-alpha', [11, 22, 33, 44, 0.1]);
  check('P4.5 Preview forwards exact color authority into LayoutProgram raw domains and values',
    colorAuthorityReady
    && colorResult !== undefined
    && colorResult.status !== 'refused'
    && programColorValues,
    {
      fixtureReady: colorAuthorityReady && colorResult !== undefined,
      status: colorResult?.status,
      programStatus: colorResult?.program?.status,
      knownColorFacts: knownColorFactRecords(colorResult).length,
      programFacts: colorProgramFacts,
    });
  const sceneColorBreakdown = {
    table: colorSceneOwners.table !== undefined
      && colorFactValueMatches(sceneFact(colorSceneOwners.table, 'backgroundColor'), 'canonical-xml-byte-alpha', [11, 22, 33, 44, 0.1]),
    cell: colorSceneOwners.cell !== undefined
      && colorFactValueMatches(sceneFact(colorSceneOwners.cell, 'cellbgcolor'), 'canonical-xml-byte-alpha', [51, 52, 53, 54, 0.2]),
    literal: colorSceneOwners.literal !== undefined
      && colorFactValueMatches(sceneFact(colorSceneOwners.literal, 'color'), 'source-literal-percent-alpha', [12.5, 23.5, 34.5, 45.5, 0.25]),
    buttonBackground: colorSceneOwners.button !== undefined
      && colorFactValueMatches(sceneFact(colorSceneOwners.button, 'bgcolor'), 'canonical-xml-byte-alpha', [61, 62, 63, 64, 0.4]),
    buttonHighlight: colorSceneOwners.button !== undefined
      && colorFactValueMatches(sceneFact(colorSceneOwners.button, 'highlightcolor'), 'canonical-xml-byte-alpha', [71, 72, 73, 74, 0.5]),
    buttonBorder: colorSceneOwners.button !== undefined
      && colorFactValueMatches(sceneFact(colorSceneOwners.button, 'bordercolor'), 'canonical-xml-byte-alpha', [81, 82, 83, 84, 0.6]),
    primary: colorSceneOwners.primary !== undefined
      && colorFactValueMatches(sceneFact(colorSceneOwners.primary, 'color'), 'canonical-xml-byte-alpha', [101, 102, 103, 104, 0.3]),
    secondary: colorSceneOwners.secondary !== undefined
      && colorFactValueMatches(sceneFact(colorSceneOwners.secondary, 'color'), 'source-literal-percent-alpha', [15, 25, 35, 55, undefined]),
    editbox: colorSceneOwners.editbox !== undefined
      && colorFactValueMatches(sceneFact(colorSceneOwners.editbox, 'bgcolor'), 'canonical-xml-byte-alpha', [91, 92, 93, 94, 0.7]),
    icon: colorSceneOwners.icon !== undefined
      && colorFactValueMatches(sceneFact(colorSceneOwners.icon, 'color'), 'canonical-xml-byte-alpha', [11, 22, 33, 44, 0.1]),
  };
  const sceneColorValues = colorResult !== undefined && Object.values(sceneColorBreakdown).every(Boolean);
  const colorSceneValue = colorResult?.scene !== undefined && 'scene' in colorResult.scene ? colorResult.scene.scene : undefined;
  check('P4.5 Preview forwards exact color authority into accepted Scene owners',
    colorAuthorityReady
    && colorResult !== undefined
    && colorResult.status !== 'refused'
    && colorResult.scene?.status !== 'refused'
    && sceneColorValues
    && colorResult.gameTruth === 'Not verified in game'
    && colorResult.verification.gameVerified === false
    && colorResult.scene?.verification.gameVerified === false,
    {
      fixtureReady: colorAuthorityReady && colorResult !== undefined,
      status: colorResult?.status,
      sceneStatus: colorResult?.scene?.status,
      sceneColorValues,
      sceneColorBreakdown,
      sceneOwners: colorSceneOwners,
      knownColorFacts: knownColorFactRecords(colorResult).length,
    });
  const exactColorAuthority = colorResult !== undefined
    && colorSceneValue !== undefined
    && issuedPaintSourceAuthority(colorResult, colorSceneValue)
    && materializeIssuedPaintScene(colorResult, colorSceneValue).value !== undefined;
  const copiedColorScene = colorSceneValue === undefined ? undefined : JSON.parse(JSON.stringify(colorSceneValue));
  check('P4.5 exact issued color result and Scene retain private Paint authority identity',
    exactColorAuthority
    && copiedColorScene !== undefined
    && !issuedPaintSourceAuthority(colorResult, copiedColorScene)
    && materializeIssuedPaintScene(colorResult, copiedColorScene).value === undefined,
    {
      fixtureReady: colorResult !== undefined && colorSceneValue !== undefined,
      exact: exactColorAuthority,
      copiedAccepted: copiedColorScene === undefined ? undefined : issuedPaintSourceAuthority(colorResult, copiedColorScene),
    });
  const structuralColorClone = colorAuthority === undefined ? undefined : JSON.parse(JSON.stringify(colorAuthority));
  const forgedColorEvidence = structuralColorClone === undefined ? undefined : { ...structuralColorClone, canonicalIdentity: 'forged-x4' };
  const mutatedColorEvidence = structuralColorClone === undefined
    ? undefined
    : { ...structuralColorClone, graph: { ...asRecord(structuralColorClone.graph), baseColors: [] } };
  const staleColorEvidence = structuralColorClone === undefined
    ? undefined
    : { ...structuralColorClone, verification: 'stale' };
  const invalidColorEvidenceCases = [
    ['structural clone', structuralColorClone],
    ['forged', forgedColorEvidence],
    ['mutated', mutatedColorEvidence],
    ['stale', staleColorEvidence],
    ['unissued', { ok: true, evidenceKind: 'canonical-default-only', canonical: true }],
  ] as const;
  const invalidColorResults = invalidColorEvidenceCases.map(([name, evidence]) => ({
    name,
    result: colorPipeline(evidence),
  }));
  const invalidInputDescriptors = invalidColorEvidenceCases.map(([name, evidence]) => {
    const candidate = pipelineInput(previewColorSource, previewColorSelection, canonical, {}, {
      truthGrade: 'supplied',
      minTextHeight: 10,
      drawable: { width: 100, height: 80 },
      uiScale: 1,
    }, evidence);
    const descriptor = Object.getOwnPropertyDescriptor(candidate, 'colorEvidence');
    return { name, present: descriptor !== undefined, same: descriptor?.value === evidence, valueType: typeof descriptor?.value };
  });
  check('P4.5 forged, mutated, stale, structural-clone, and unissued color evidence fails closed',
    colorAuthorityReady
    && invalidColorResults.every(candidate => candidate.result !== undefined
      && candidate.result.status === 'refused'
      && knownColorFactRecords(candidate.result).length === 0),
    {
      fixtureReady: colorAuthorityReady,
      results: invalidColorResults.map(candidate => ({
        name: candidate.name,
        status: candidate.result?.status,
        programStatus: candidate.result?.program?.status,
        knownColorFacts: knownColorFactRecords(candidate.result).length,
      })),
      invalidInputDescriptors,
    });
  const accessorInput = pipelineInput(previewColorSource, previewColorSelection, canonical, {}, {
    truthGrade: 'supplied',
    minTextHeight: 10,
    drawable: { width: 100, height: 80 },
    uiScale: 1,
  });
  let colorAccessorReads = 0;
  Object.defineProperty(accessorInput, 'colorEvidence', {
    configurable: true,
    enumerable: true,
    get: () => {
      colorAccessorReads += 1;
      throw new Error('Preview color evidence accessor executed');
    },
  });
  const accessorResult = projectX4UiPreviewPipeline(accessorInput);
  const inheritedInput = pipelineInput(previewColorSource, previewColorSelection, canonical, {}, {
    truthGrade: 'supplied',
    minTextHeight: 10,
    drawable: { width: 100, height: 80 },
    uiScale: 1,
  });
  let colorInheritedReads = 0;
  const inheritedPrototype = {};
  Object.defineProperty(inheritedPrototype, 'colorEvidence', {
    configurable: true,
    enumerable: true,
    get: () => {
      colorInheritedReads += 1;
      throw new Error('Preview inherited color evidence accessor executed');
    },
  });
  Object.setPrototypeOf(inheritedInput, inheritedPrototype);
  const inheritedResult = projectX4UiPreviewPipeline(inheritedInput);
  const symbolInput = pipelineInput(previewColorSource, previewColorSelection, canonical, {}, {
    truthGrade: 'supplied',
    minTextHeight: 10,
    drawable: { width: 100, height: 80 },
    uiScale: 1,
  });
  Object.defineProperty(symbolInput, Symbol('colorEvidence'), { configurable: true, enumerable: true, value: colorAuthority });
  const symbolResult = projectX4UiPreviewPipeline(symbolInput);
  const colorProxyTrapCounts = { get: 0, getOwnPropertyDescriptor: 0, ownKeys: 0, getPrototypeOf: 0, has: 0 };
  const proxyColorEvidence = colorAuthority === undefined ? undefined : new Proxy(colorAuthority, {
    get: (target, property, receiver) => {
      colorProxyTrapCounts.get += 1;
      return Reflect.get(target, property, receiver);
    },
    getOwnPropertyDescriptor: (target, property) => {
      colorProxyTrapCounts.getOwnPropertyDescriptor += 1;
      return Reflect.getOwnPropertyDescriptor(target, property);
    },
    ownKeys: target => {
      colorProxyTrapCounts.ownKeys += 1;
      return Reflect.ownKeys(target);
    },
    getPrototypeOf: target => {
      colorProxyTrapCounts.getPrototypeOf += 1;
      return Reflect.getPrototypeOf(target);
    },
    has: (target, property) => {
      colorProxyTrapCounts.has += 1;
      return Reflect.has(target, property);
    },
  });
  const proxyResult = colorPipeline(proxyColorEvidence);
  check('P4.5 inherited, accessor, symbol, and proxy evidence never becomes authority or invokes hostile observation',
    omittedColorResult !== undefined
    && colorAccessorReads === 0
    && colorInheritedReads === 0
    && sameJson(accessorResult, omittedColorResult)
    && sameJson(inheritedResult, omittedColorResult)
    && sameJson(symbolResult, omittedColorResult)
    && proxyResult !== undefined
    && proxyResult.status === 'refused'
    && knownColorFactRecords(proxyResult).length === 0
    && Object.values(colorProxyTrapCounts).every(count => count === 0),
    {
      fixtureReady: omittedColorResult !== undefined && colorAuthority !== undefined,
      accessorReads: colorAccessorReads,
      inheritedReads: colorInheritedReads,
      proxyTrapCounts: colorProxyTrapCounts,
      accessorStatus: accessorResult.status,
      inheritedStatus: inheritedResult.status,
      symbolStatus: symbolResult.status,
      proxyStatus: proxyResult?.status,
    });

  const cloneCanonicalResult = (): JsonRecord | undefined => canonicalProjectedResult === undefined
    ? undefined
    : asRecord(JSON.parse(JSON.stringify(canonicalProjectedResult)));
  const sourceMutation = cloneCanonicalResult();
  const sourceMutationRecord = asRecord(sourceMutation?.profile);
  const sourceMutationLayout = asRecord(sourceMutationRecord?.layout);
  const sourceMutationSource = asRecord(sourceMutationLayout?.source);
  const sourceBefore = sourceMutationSource?.file;
  if (typeof sourceBefore === 'string') sourceMutationSource.file = `${sourceBefore}:mutation`;
  const sourceMutationFacts = canonicalAcceptanceFacts(canonical, canonicalSelection, sourceMutation);
  const sourceMutationChanged = typeof sourceBefore === 'string'
    && sourceMutationSource?.file !== sourceBefore;
  const sourceMutationControl = canonicalProjected
    && sourceMutationChanged
    && sourceMutationFacts.programProjected
    && sourceMutationFacts.operationCount === canonicalFacts.operationCount
    && sourceMutationFacts.appliedOperationCount === canonicalFacts.appliedOperationCount
    && sourceMutationFacts.producerGapCount === canonicalFacts.producerGapCount
    && !sourceMutationFacts.sourceIdentityMatch
    && !sourceMutationFacts.accepted;
  check('canonical acceptance rejects a non-no-op source identity mutation', sourceMutationControl, {
    fixtureReady: canonicalProjected && sourceMutationChanged,
    before: sourceBefore,
    after: sourceMutationSource?.file,
    acceptedBefore: canonicalFacts.accepted,
    acceptedAfter: sourceMutationFacts.accepted,
    factsAfter: sourceMutationFacts,
  });

  const fontMutation = cloneCanonicalResult();
  const fontMutationSceneResult = asRecord(fontMutation?.scene);
  const fontMutationScene = asRecord(fontMutationSceneResult?.scene);
  const fontMutationSceneProfile = asRecord(fontMutationScene?.profile);
  const fontMutationFonts = asRecord(fontMutationSceneProfile?.fonts);
  const fontMutationRegular = asRecord(fontMutationFonts?.Zekton);
  const fontMutationDescriptor = asRecord(fontMutationRegular?.descriptor);
  const fontBefore = fontMutationDescriptor?.sha256;
  const fontAfter = typeof fontBefore === 'string'
    ? (fontBefore === '0'.repeat(64) ? '1'.repeat(64) : '0'.repeat(64))
    : undefined;
  if (fontAfter !== undefined) fontMutationDescriptor.sha256 = fontAfter;
  const fontMutationFacts = canonicalAcceptanceFacts(canonical, canonicalSelection, fontMutation);
  const fontMutationChanged = typeof fontBefore === 'string' && fontAfter !== undefined && fontBefore !== fontAfter;
  const fontMutationControl = canonicalProjected
    && fontMutationChanged
    && fontMutationFacts.programProjected
    && fontMutationFacts.operationCount === canonicalFacts.operationCount
    && fontMutationFacts.appliedOperationCount === canonicalFacts.appliedOperationCount
    && fontMutationFacts.producerGapCount === canonicalFacts.producerGapCount
    && fontMutationFacts.sourceIdentityMatch
    && !fontMutationFacts.fontIdentityPinsMatch
    && !fontMutationFacts.accepted;
  check('canonical acceptance rejects a non-no-op font hash mutation', fontMutationControl, {
    fixtureReady: canonicalProjected && fontMutationChanged,
    before: fontBefore,
    after: fontAfter,
    acceptedBefore: canonicalFacts.accepted,
    acceptedAfter: fontMutationFacts.accepted,
    factsAfter: fontMutationFacts,
  });

  const geometryMutation = cloneCanonicalResult();
  const geometryMutationSceneResult = asRecord(geometryMutation?.scene);
  const geometryMutationScene = asRecord(geometryMutationSceneResult?.scene);
  const cellsBefore = geometryMutationScene?.cells;
  if (Array.isArray(geometryMutationScene?.cells)) geometryMutationScene.cells = [];
  const geometryMutationFacts = canonicalAcceptanceFacts(canonical, canonicalSelection, geometryMutation);
  const geometryMutationChanged = Array.isArray(cellsBefore)
    && Array.isArray(geometryMutationScene?.cells)
    && cellsBefore.length !== geometryMutationScene.cells.length;
  const geometryMutationControl = canonicalProjected
    && geometryMutationChanged
    && geometryMutationFacts.programProjected
    && geometryMutationFacts.operationCount === canonicalFacts.operationCount
    && geometryMutationFacts.appliedOperationCount === canonicalFacts.appliedOperationCount
    && geometryMutationFacts.producerGapCount === canonicalFacts.producerGapCount
    && geometryMutationFacts.sourceIdentityMatch
    && geometryMutationFacts.fontIdentityPinsMatch
    && !geometryMutationFacts.geometryMatch
    && !geometryMutationFacts.accepted;
  check('canonical acceptance rejects a non-no-op zero-geometry mutation', geometryMutationControl, {
    fixtureReady: canonicalProjected && geometryMutationChanged,
    beforeCells: Array.isArray(cellsBefore) ? cellsBefore.length : undefined,
    afterCells: Array.isArray(geometryMutationScene?.cells) ? geometryMutationScene.cells.length : undefined,
    acceptedBefore: canonicalFacts.accepted,
    acceptedAfter: geometryMutationFacts.accepted,
    factsAfter: geometryMutationFacts,
  });
  const canonicalBytesAfter = canonical === undefined ? undefined : JSON.stringify({
    helper: Array.from(canonical.assets.helper.bytes),
    widget: Array.from(canonical.assets.widget.bytes),
    regularDescriptor: Array.from(canonical.assets.regular.descriptor.bytes),
    regularAtlas: Array.from(canonical.assets.regular.atlas.bytes),
    boldDescriptor: Array.from(canonical.assets.bold.descriptor.bytes),
    boldAtlas: Array.from(canonical.assets.bold.atlas.bytes),
  });
  check('canonical output is frozen, serializable, source-immutable, and fully labeled',
    canonicalProjectedResult !== undefined
    && Object.isFrozen(canonicalProjectedResult)
    && JSON.stringify(canonicalProjectedResult).length > 0
    && canonicalBytesBefore === canonicalBytesAfter
    && JSON.stringify(canonicalSource) === canonicalSourceBefore
    && canonicalProjectedResult.gameTruth === 'Not verified in game'
    && canonicalScene?.gameTruth === 'Not verified in game'
    && canonicalProjectedResult.verification.game === 'Not verified in game',
    {
      canonicalBytesUnchanged: canonicalBytesBefore === canonicalBytesAfter,
      sourceUnchanged: JSON.stringify(canonicalSource) === canonicalSourceBefore,
      gameTruth: canonicalProjectedResult?.gameTruth,
      sceneGameTruth: canonicalScene?.gameTruth,
    });

  const cloneCanonicalScene = (): JsonRecord | undefined => canonicalScene === undefined
    ? undefined
    : asRecord(JSON.parse(JSON.stringify(canonicalScene)));
  type AuthorityMutationProof = Readonly<Record<string, unknown>> & { readonly changed: boolean };
  const phaseTAuthorityAttack = (
    name: string,
    issuedResult: unknown,
    issuedScene: unknown,
    mutate: (candidate: JsonRecord) => AuthorityMutationProof,
  ): void => {
    const baselineAccepted = issuedPaintSourceAuthority(issuedResult, issuedScene);
    const candidate = issuedScene === undefined ? undefined : asRecord(JSON.parse(JSON.stringify(issuedScene)));
    const before = candidate === undefined ? undefined : JSON.stringify(candidate);
    let proof: AuthorityMutationProof = { changed: false };
    let threw = false;
    let error: string | undefined;
    let accepted = false;
    try {
      if (candidate !== undefined) proof = mutate(candidate);
      accepted = issuedPaintSourceAuthority(issuedResult, candidate);
    } catch (caught) {
      threw = true;
      error = caught instanceof Error ? caught.message : String(caught);
    }
    const after = candidate === undefined ? undefined : JSON.stringify(candidate);
    const fixtureReady = baselineAccepted && candidate !== undefined && proof.changed === true && before !== after;
    check(name, fixtureReady && !threw && !accepted, {
      fixtureReady,
      changed: before !== after,
      proof,
      threw,
      error,
      currentAccepted: accepted,
    });
  };
  const intactPaintAuthority = canonicalProjectedResult !== undefined
    && canonicalScene !== undefined
    && issuedPaintSourceAuthority(canonicalProjectedResult, canonicalScene);
  check('Phase P issued source authority accepts the unchanged canonical Scene', intactPaintAuthority, {
    fixtureReady: canonicalProjectedResult !== undefined && canonicalScene !== undefined,
    resultStatus: canonicalProjectedResult?.status,
    sceneStatus: canonicalScene?.status,
    predicatePresent: typeof (PreviewPipelineExports as unknown as Record<string, unknown>).isX4UiPreviewPaintSourceAuthority === 'function',
  });

  const canonicalSceneResult = canonicalProjectedResult?.scene !== undefined && 'scene' in canonicalProjectedResult.scene
    ? canonicalProjectedResult.scene
    : undefined;
  const exactSceneResultMaterialization = materializeIssuedPaintScene(canonicalProjectedResult, canonicalSceneResult);
  check('B119 exact Preview-issued Scene-result wrapper retains authority',
    intactPaintAuthority
    && canonicalSceneResult !== undefined
    && exactSceneResultMaterialization.present
    && !exactSceneResultMaterialization.threw
    && exactSceneResultMaterialization.value !== undefined, {
      fixtureReady: intactPaintAuthority && canonicalSceneResult !== undefined,
      materialization: exactSceneResultMaterialization,
    });
  const copiedSceneResult = canonicalSceneResult === undefined
    ? undefined
    : asRecord(JSON.parse(JSON.stringify(canonicalSceneResult)));
  const customPrototypeSceneResult = canonicalSceneResult === undefined
    ? undefined
    : Object.assign(Object.create({ boundary: 'not-authority' }), JSON.parse(JSON.stringify(canonicalSceneResult))) as JsonRecord;
  const copiedSceneResultMaterialization = materializeIssuedPaintScene(canonicalProjectedResult, copiedSceneResult);
  const customPrototypeSceneResultMaterialization = materializeIssuedPaintScene(canonicalProjectedResult, customPrototypeSceneResult);
  check('B119 copied and custom-prototype Scene-result wrappers refuse',
    intactPaintAuthority
    && copiedSceneResult !== undefined
    && customPrototypeSceneResult !== undefined
    && copiedSceneResult !== canonicalSceneResult
    && customPrototypeSceneResult !== canonicalSceneResult
    && copiedSceneResultMaterialization.present
    && !copiedSceneResultMaterialization.threw
    && copiedSceneResultMaterialization.value === undefined
    && customPrototypeSceneResultMaterialization.present
    && !customPrototypeSceneResultMaterialization.threw
    && customPrototypeSceneResultMaterialization.value === undefined, {
      fixtureReady: intactPaintAuthority && canonicalSceneResult !== undefined,
      copied: copiedSceneResultMaterialization,
      customPrototype: customPrototypeSceneResultMaterialization,
    });

  const unchangedCloneCandidate = cloneCanonicalScene();
  const unchangedCloneMaterialization = materializeIssuedPaintScene(canonicalProjectedResult, unchangedCloneCandidate);
  const unchangedCloneAuthority = issuedPaintSourceAuthority(canonicalProjectedResult, unchangedCloneCandidate);
  check('Phase P rejects an unchanged JSON deep-copy of the issued Scene',
    intactPaintAuthority
    && unchangedCloneCandidate !== undefined
    && canonicalScene !== undefined
    && !Object.is(unchangedCloneCandidate, canonicalScene)
    && sameJson(unchangedCloneCandidate, canonicalScene)
    && !unchangedCloneAuthority
    && unchangedCloneMaterialization.present
    && !unchangedCloneMaterialization.threw
    && unchangedCloneMaterialization.value === undefined, {
      fixtureReady: intactPaintAuthority && unchangedCloneCandidate !== undefined && canonicalScene !== undefined,
      distinctIdentity: !Object.is(unchangedCloneCandidate, canonicalScene),
      jsonEqual: sameJson(unchangedCloneCandidate, canonicalScene),
      accepted: unchangedCloneAuthority,
      materialization: unchangedCloneMaterialization,
    });

  const clipCandidate = cloneCanonicalScene();
  const clipCell = Array.isArray(clipCandidate?.cells) ? asRecord(clipCandidate.cells[0]) : undefined;
  if (clipCell !== undefined) clipCell.clipRect = { x: 0, y: 0, width: 1, height: 1 };
  const clipAuthority = canonicalProjectedResult !== undefined
    && clipCandidate !== undefined
    && issuedPaintSourceAuthority(canonicalProjectedResult, clipCandidate);
  const clipMaterialization = materializeIssuedPaintScene(canonicalProjectedResult, clipCandidate);
  check('Phase P rejects copied Scene clipRect variation despite equal source bytes', intactPaintAuthority
    && clipCell !== undefined
    && !clipAuthority
    && clipMaterialization.present
    && !clipMaterialization.threw
    && clipMaterialization.value === undefined, {
    fixtureReady: intactPaintAuthority && clipCell !== undefined,
    clipChanged: clipCell?.clipRect !== undefined,
    accepted: clipAuthority,
    materialization: clipMaterialization,
  });

  const statusCandidate = cloneCanonicalScene();
  if (statusCandidate !== undefined) {
    statusCandidate.status = 'partial';
    statusCandidate.programStatus = 'projected';
  }
  const statusAuthority = canonicalProjectedResult !== undefined
    && statusCandidate !== undefined
    && issuedPaintSourceAuthority(canonicalProjectedResult, statusCandidate);
  const statusMaterialization = materializeIssuedPaintScene(canonicalProjectedResult, statusCandidate);
  check('Phase P rejects copied Scene status variation despite equal program status', intactPaintAuthority
    && statusCandidate !== undefined
    && !statusAuthority
    && statusMaterialization.present
    && !statusMaterialization.threw
    && statusMaterialization.value === undefined, {
    fixtureReady: intactPaintAuthority && statusCandidate !== undefined,
    programStatus: statusCandidate?.programStatus,
    sceneStatus: statusCandidate?.status,
    accepted: statusAuthority,
    materialization: statusMaterialization,
  });

  const cloneAuthorityResult = canonicalProjectedResult === undefined
    ? undefined
    : JSON.parse(JSON.stringify(canonicalProjectedResult));
  const cloneAuthorityScene = cloneCanonicalScene();
  const exactMaterialization = materializeIssuedPaintScene(canonicalProjectedResult, canonicalScene);
  const clonedMaterialization = materializeIssuedPaintScene(cloneAuthorityResult, cloneAuthorityScene);
  const clonedAuthorityExactSceneMaterialization = materializeIssuedPaintScene(cloneAuthorityResult, canonicalScene);
  const materializedRecord = asRecord(exactMaterialization.value);
  const materializedFacts = closedDomainFacts(exactMaterialization.value);
  check('closed-domain-materializer-requires-exact-issued-result-identity',
    intactPaintAuthority
    && exactMaterialization.present
    && !exactMaterialization.threw
    && exactMaterialization.value !== undefined
    && clonedMaterialization.present
    && !clonedMaterialization.threw
    && clonedMaterialization.value === undefined
    && clonedAuthorityExactSceneMaterialization.present
    && !clonedAuthorityExactSceneMaterialization.threw
    && clonedAuthorityExactSceneMaterialization.value === undefined, {
      fixtureReady: intactPaintAuthority && cloneAuthorityResult !== undefined && cloneAuthorityScene !== undefined,
      exact: exactMaterialization,
      clone: clonedMaterialization,
      clonedAuthorityExactScene: clonedAuthorityExactSceneMaterialization,
    });
  check('closed-domain-materializer-preserves-deterministic-issued-json-without-aliasing',
    exactMaterialization.value !== undefined
    && exactMaterialization.value !== canonicalScene
    && sameJson(exactMaterialization.value, canonicalScene)
    && JSON.stringify(exactMaterialization.value) === JSON.stringify(exactMaterialization.value), {
      fixtureReady: intactPaintAuthority && canonicalScene !== undefined,
      present: exactMaterialization.present,
      threw: exactMaterialization.threw,
      aliasesOriginal: exactMaterialization.value === canonicalScene,
      jsonEqual: sameJson(exactMaterialization.value, canonicalScene),
    });
  check('closed-domain-materializer-returns-recursive-null-prototype-data-records',
    exactMaterialization.value !== undefined
    && materializedFacts.records > 5
    && materializedFacts.nullPrototypeRecords
    && materializedFacts.dataDescriptorsOnly
    && materializedRecord !== undefined
    && Object.getPrototypeOf(materializedRecord) === null, {
      fixtureReady: intactPaintAuthority && canonicalScene !== undefined,
      facts: materializedFacts,
    });
  check('closed-domain-materializer-returns-dense-canonical-deeply-frozen-arrays',
    exactMaterialization.value !== undefined
    && materializedFacts.arrays > 5
    && materializedFacts.denseCanonicalArrays
    && materializedFacts.deeplyFrozen
    && materializedFacts.acyclic, {
      fixtureReady: intactPaintAuthority && canonicalScene !== undefined,
      facts: materializedFacts,
    });

  const allowedPresentationCandidate = cloneCanonicalScene();
  const allowedPresentationCell = Array.isArray(allowedPresentationCandidate?.cells)
    ? asRecord(allowedPresentationCandidate.cells[0])
    : undefined;
  const allowedClip = { x: 0, y: 0, width: 1, height: 1 };
  if (allowedPresentationCandidate !== undefined) allowedPresentationCandidate.status = 'partial';
  if (allowedPresentationCell !== undefined) allowedPresentationCell.clipRect = allowedClip;
  const allowedPresentationMaterialization = materializeIssuedPaintScene(canonicalProjectedResult, allowedPresentationCandidate);
  check('closed-domain-materializer-refuses-copied-status-and-direct-node-clip-variation',
    allowedPresentationMaterialization.present
    && !allowedPresentationMaterialization.threw
    && allowedPresentationMaterialization.value === undefined, {
      fixtureReady: intactPaintAuthority && allowedPresentationCandidate !== undefined && allowedPresentationCell !== undefined,
      attempt: allowedPresentationMaterialization,
      status: allowedPresentationCandidate?.status,
      clipRect: allowedPresentationCell?.clipRect,
    });

  const undefinedMemberCandidate = cloneCanonicalScene();
  const undefinedMemberProfile = asRecord(undefinedMemberCandidate?.profile);
  if (undefinedMemberProfile !== undefined) undefinedMemberProfile.closedDomainUndefined = undefined;
  const undefinedMemberMaterialization = materializeIssuedPaintScene(canonicalProjectedResult, undefinedMemberCandidate);
  check('closed-domain-materializer-refuses-a-copied-Scene-with-an-enumerable-undefined-member',
    undefinedMemberMaterialization.present
    && !undefinedMemberMaterialization.threw
    && undefinedMemberMaterialization.value === undefined, {
      fixtureReady: intactPaintAuthority && undefinedMemberProfile !== undefined,
      attempt: undefinedMemberMaterialization,
      candidateOwnKeys: undefinedMemberProfile === undefined ? undefined : Object.keys(undefinedMemberProfile),
    });

  const proxyTrapCounts = { get: 0, getOwnPropertyDescriptor: 0, ownKeys: 0, getPrototypeOf: 0, has: 0 };
  const proxyCandidate = canonicalScene === undefined
    ? undefined
    : new Proxy(canonicalScene as unknown as object, {
      get: (target, property, receiver) => {
        proxyTrapCounts.get += 1;
        return Reflect.get(target, property, receiver);
      },
      getOwnPropertyDescriptor: (target, property) => {
        proxyTrapCounts.getOwnPropertyDescriptor += 1;
        return Reflect.getOwnPropertyDescriptor(target, property);
      },
      ownKeys: target => {
        proxyTrapCounts.ownKeys += 1;
        return Reflect.ownKeys(target);
      },
      getPrototypeOf: target => {
        proxyTrapCounts.getPrototypeOf += 1;
        return Reflect.getPrototypeOf(target);
      },
      has: (target, property) => {
        proxyTrapCounts.has += 1;
        return Reflect.has(target, property);
      },
    });
  const proxyMaterialization = materializeIssuedPaintScene(canonicalProjectedResult, proxyCandidate);
  let wrapperAccessorReads = 0;
  const accessorWrapper: JsonRecord = {};
  Object.defineProperty(accessorWrapper, 'scene', {
    configurable: true,
    enumerable: true,
    get: () => {
      wrapperAccessorReads += 1;
      return canonicalScene;
    },
  });
  const accessorWrapperMaterialization = materializeIssuedPaintScene(canonicalProjectedResult, accessorWrapper);
  const customPrototypeWrapper = Object.create({ scene: canonicalScene }) as JsonRecord;
  const customPrototypeMaterialization = materializeIssuedPaintScene(canonicalProjectedResult, customPrototypeWrapper);
  check('closed-domain-materializer-refuses proxy, accessor, and custom-prototype wrappers without observation',
    intactPaintAuthority
    && proxyCandidate !== undefined
    && proxyMaterialization.present
    && !proxyMaterialization.threw
    && proxyMaterialization.value === undefined
    && Object.values(proxyTrapCounts).every(count => count === 0)
    && accessorWrapperMaterialization.present
    && !accessorWrapperMaterialization.threw
    && accessorWrapperMaterialization.value === undefined
    && wrapperAccessorReads === 0
    && customPrototypeMaterialization.present
    && !customPrototypeMaterialization.threw
    && customPrototypeMaterialization.value === undefined, {
      fixtureReady: intactPaintAuthority && proxyCandidate !== undefined,
      proxy: { attempt: proxyMaterialization, traps: proxyTrapCounts },
      accessor: { attempt: accessorWrapperMaterialization, reads: wrapperAccessorReads },
      customPrototype: customPrototypeMaterialization,
    });

  const originalSourcePathPrototype = Object.getOwnPropertyDescriptor(Object.prototype, 'sourcePath');
  let pollutedMaterialization: SceneMaterializationAttempt = { present: false, threw: false };
  let prototypeRestored = false;
  try {
    Object.defineProperty(Object.prototype, 'sourcePath', {
      configurable: true,
      enumerable: false,
      writable: true,
      value: 'inherited://closed-domain',
    });
    pollutedMaterialization = materializeIssuedPaintScene(canonicalProjectedResult, canonicalScene);
  } finally {
    if (originalSourcePathPrototype === undefined) Reflect.deleteProperty(Object.prototype, 'sourcePath');
    else Object.defineProperty(Object.prototype, 'sourcePath', originalSourcePathPrototype);
    const restoredDescriptor = Object.getOwnPropertyDescriptor(Object.prototype, 'sourcePath');
    prototypeRestored = originalSourcePathPrototype === undefined
      ? restoredDescriptor === undefined
      : restoredDescriptor?.value === originalSourcePathPrototype.value
        && restoredDescriptor?.get === originalSourcePathPrototype.get
        && restoredDescriptor?.set === originalSourcePathPrototype.set;
  }
  check('closed-domain-materializer-ignores-nonenumerable-Object-prototype-pollution',
    pollutedMaterialization.present
    && !pollutedMaterialization.threw
    && prototypeRestored
    && sameJson(pollutedMaterialization.value, exactMaterialization.value), {
      fixtureReady: intactPaintAuthority && canonicalScene !== undefined,
      attempt: pollutedMaterialization,
      restored: prototypeRestored,
      jsonEqual: sameJson(pollutedMaterialization.value, exactMaterialization.value),
    });

  type ClosedDomainCandidateMutation = {
    readonly changed: boolean;
    readonly cleanup?: () => boolean;
    readonly facts?: () => unknown;
  };
  const closedDomainMaterializerRefusal = (
    name: string,
    mutate: (candidate: JsonRecord) => ClosedDomainCandidateMutation,
  ): void => {
    const candidate = cloneCanonicalScene();
    let mutation: ClosedDomainCandidateMutation = { changed: false };
    let attempt: SceneMaterializationAttempt = { present: false, threw: false };
    let mutationThrew = false;
    let mutationError: string | undefined;
    let restored = true;
    try {
      if (candidate !== undefined) mutation = mutate(candidate);
      attempt = materializeIssuedPaintScene(canonicalProjectedResult, candidate);
    } catch (caught) {
      mutationThrew = true;
      mutationError = caught instanceof Error ? caught.message : String(caught);
    } finally {
      restored = mutation.cleanup?.() ?? true;
    }
    const fixtureReady = intactPaintAuthority && candidate !== undefined && mutation.changed;
    check(name, fixtureReady && !mutationThrew && attempt.present && !attempt.threw && attempt.value === undefined && restored, {
      fixtureReady,
      mutationThrew,
      mutationError,
      materializerPresent: attempt.present,
      materializerThrew: attempt.threw,
      materializerError: attempt.error,
      refused: attempt.value === undefined,
      restored,
      facts: mutation.facts?.(),
    });
  };

  closedDomainMaterializerRefusal('closed-domain-materializer-refuses-custom-nested-record-prototypes', candidate => {
    const profileRecord = asRecord(candidate.profile);
    const sourceRecord = asRecord(profileRecord?.source);
    if (sourceRecord === undefined) return { changed: false };
    const originalPrototype = Object.getPrototypeOf(sourceRecord);
    Object.setPrototypeOf(sourceRecord, { relativePath: 'inherited://identity' });
    return {
      changed: Object.getPrototypeOf(sourceRecord) !== originalPrototype,
      cleanup: () => {
        Object.setPrototypeOf(sourceRecord, originalPrototype);
        return Object.getPrototypeOf(sourceRecord) === originalPrototype;
      },
    };
  });

  let accessorReads = 0;
  closedDomainMaterializerRefusal('closed-domain-materializer-refuses-accessors-without-invocation', candidate => {
    const profileRecord = asRecord(candidate.profile);
    if (profileRecord === undefined) return { changed: false };
    Object.defineProperty(profileRecord, 'closedDomainAccessor', {
      configurable: true,
      enumerable: true,
      get: () => {
        accessorReads += 1;
        return 'invoked';
      },
    });
    return {
      changed: true,
      cleanup: () => Reflect.deleteProperty(profileRecord, 'closedDomainAccessor'),
      facts: () => ({ accessorReads }),
    };
  });

  closedDomainMaterializerRefusal('closed-domain-materializer-refuses-symbol-members', candidate => {
    const profileRecord = asRecord(candidate.profile);
    if (profileRecord === undefined) return { changed: false };
    const symbol = Symbol('closed-domain');
    Object.defineProperty(profileRecord, symbol, { configurable: true, enumerable: true, value: 'forbidden' });
    return {
      changed: Object.getOwnPropertySymbols(profileRecord).includes(symbol),
      cleanup: () => Reflect.deleteProperty(profileRecord, symbol),
    };
  });

  closedDomainMaterializerRefusal('closed-domain-materializer-refuses-sparse-arrays', candidate => {
    if (!Array.isArray(candidate.frames) || candidate.frames.length === 0) return { changed: false };
    const first = candidate.frames[0];
    const changed = Reflect.deleteProperty(candidate.frames, '0');
    return {
      changed: changed && !Object.prototype.hasOwnProperty.call(candidate.frames, 0),
      cleanup: () => Reflect.set(candidate.frames as unknown[], 0, first),
    };
  });

  closedDomainMaterializerRefusal('closed-domain-materializer-refuses-decorated-arrays', candidate => {
    if (!Array.isArray(candidate.frames)) return { changed: false };
    const frames = candidate.frames;
    Object.defineProperty(frames, 'closedDomainDecoration', { configurable: true, enumerable: true, value: true });
    return {
      changed: Object.prototype.hasOwnProperty.call(frames, 'closedDomainDecoration'),
      cleanup: () => Reflect.deleteProperty(frames, 'closedDomainDecoration'),
    };
  });

  closedDomainMaterializerRefusal('closed-domain-materializer-refuses-undefined-array-slots', candidate => {
    if (!Array.isArray(candidate.frames) || candidate.frames.length === 0) return { changed: false };
    const first = candidate.frames[0];
    candidate.frames[0] = undefined;
    return {
      changed: Object.prototype.hasOwnProperty.call(candidate.frames, 0) && candidate.frames[0] === undefined,
      cleanup: () => Reflect.set(candidate.frames as unknown[], 0, first),
    };
  });

  closedDomainMaterializerRefusal('closed-domain-materializer-refuses-cycles', candidate => {
    const profileRecord = asRecord(candidate.profile);
    if (profileRecord === undefined) return { changed: false };
    profileRecord.closedDomainCycle = profileRecord;
    return {
      changed: profileRecord.closedDomainCycle === profileRecord,
      cleanup: () => Reflect.deleteProperty(profileRecord, 'closedDomainCycle'),
    };
  });

  const malformedValues: readonly [string, unknown][] = [
    ['nonfinite', Number.POSITIVE_INFINITY],
    ['function', () => 'forbidden'],
    ['bigint', BigInt(1)],
    ['typed-array', new Uint8Array([1])],
    ['array-buffer', new ArrayBuffer(1)],
  ];
  const malformedValueResults = malformedValues.map(([label, malformed]) => {
    const candidate = cloneCanonicalScene();
    const profileRecord = asRecord(candidate?.profile);
    if (profileRecord !== undefined) profileRecord.closedDomainMalformed = malformed;
    const attempt = materializeIssuedPaintScene(canonicalProjectedResult, candidate);
    return {
      label,
      fixtureReady: intactPaintAuthority && profileRecord !== undefined,
      present: attempt.present,
      threw: attempt.threw,
      refused: attempt.value === undefined,
    };
  });
  check('closed-domain-materializer-refuses-all-non-json-value-families',
    malformedValueResults.every(result => result.fixtureReady && result.present && !result.threw && result.refused), {
      fixtureReady: malformedValueResults.every(result => result.fixtureReady),
      results: malformedValueResults,
    });
  check('Phase P rejects a deep-cloned preview result as unissued',
    !issuedPaintSourceAuthority(cloneAuthorityResult, cloneAuthorityScene), {
      fixtureReady: canonicalProjectedResult !== undefined && cloneAuthorityResult !== undefined && cloneAuthorityScene !== undefined,
      originalIssued: intactPaintAuthority,
      cloneAccepted: issuedPaintSourceAuthority(cloneAuthorityResult, cloneAuthorityScene),
    });
  check('Phase P rejects refused and needs-selection results as paint authority',
    !issuedPaintSourceAuthority(exactNoCorpus, canonicalScene)
    && !issuedPaintSourceAuthority(noSelection, canonicalScene), {
      fixtureReady: canonicalScene !== undefined,
      refusedStatus: exactNoCorpus.status,
      needsSelectionStatus: noSelection.status,
    });

  const sourceRewriteCandidate = cloneCanonicalScene();
  const rewriteSourceEvidence = (value: unknown, seen = new Set<object>()): void => {
    if (value === null || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);
    if (Array.isArray(value)) {
      for (const child of value) rewriteSourceEvidence(child, seen);
      return;
    }
    const record = value as JsonRecord;
    for (const [key, child] of Object.entries(record)) {
      if ((key === 'source' || key === 'sourceIdentity') && asRecord(child)?.file !== undefined) {
        const sourceRecord = asRecord(child)!;
        sourceRecord.file = `${String(sourceRecord.file)}:rewritten`;
      }
      rewriteSourceEvidence(child, seen);
    }
  };
  rewriteSourceEvidence(sourceRewriteCandidate);
  check('Phase P rejects coherent source/file identity rewrites against issued evidence',
    !issuedPaintSourceAuthority(canonicalProjectedResult, sourceRewriteCandidate), {
      fixtureReady: intactPaintAuthority && sourceRewriteCandidate !== undefined,
      rewritten: sourceRewriteCandidate !== undefined,
      accepted: issuedPaintSourceAuthority(canonicalProjectedResult, sourceRewriteCandidate),
    });

  const reversedGapCandidate = cloneCanonicalScene();
  const reversedGaps = Array.isArray(reversedGapCandidate?.gaps) ? reversedGapCandidate.gaps : undefined;
  if (reversedGaps !== undefined) {
    reversedGaps.reverse();
    reversedGaps.forEach((gap, index) => {
      const gapRecord = asRecord(gap);
      if (gapRecord !== undefined) gapRecord.id = `phaseP-reordered-gap-${index}`;
    });
  }
  check('Phase P rejects equal-offset gap reversal and renumbering',
    !issuedPaintSourceAuthority(canonicalProjectedResult, reversedGapCandidate), {
      fixtureReady: intactPaintAuthority && reversedGaps !== undefined && reversedGaps.length > 1,
      gapCount: reversedGaps?.length,
      accepted: issuedPaintSourceAuthority(canonicalProjectedResult, reversedGapCandidate),
    });

  const lineMutationCandidate = cloneCanonicalScene();
  const lineMutationText = Array.isArray(lineMutationCandidate?.texts)
    ? asRecord(lineMutationCandidate.texts.find(text => Array.isArray(asRecord(text)?.lines) && (asRecord(text)?.lines as unknown[]).length > 0))
    : undefined;
  const lineMutationLines = lineMutationText !== undefined && Array.isArray(lineMutationText.lines) ? lineMutationText.lines : undefined;
  const lineMutation = lineMutationLines === undefined ? undefined : asRecord(lineMutationLines[0]);
  const lineMutationRange = asRecord(lineMutation?.sourceCodePointRange);
  if (lineMutationRange !== undefined && typeof lineMutationRange.end === 'number') lineMutationRange.end += 1;
  check('Phase P rejects changed text-line source evidence',
    !issuedPaintSourceAuthority(canonicalProjectedResult, lineMutationCandidate), {
      fixtureReady: intactPaintAuthority && lineMutationRange !== undefined,
      changed: lineMutationRange !== undefined,
      accepted: issuedPaintSourceAuthority(canonicalProjectedResult, lineMutationCandidate),
    });

  const forgedAliasResult = cloneAuthorityResult === undefined ? undefined : { ...cloneAuthorityResult, engineStatus: 'accepted', paintColor: '#fff', runtimeAccepted: true, gameVerified: true };
  check('Phase P rejects unissued preview aliases and game-truth fields',
    !issuedPaintSourceAuthority(forgedAliasResult, cloneAuthorityScene), {
      fixtureReady: intactPaintAuthority && forgedAliasResult !== undefined,
      aliases: ['engineStatus', 'paintColor', 'runtimeAccepted', 'gameVerified'],
      accepted: issuedPaintSourceAuthority(forgedAliasResult, cloneAuthorityScene),
    });

  phaseTAuthorityAttack('Phase T rejects cell geometry drift in issued Scene authority', canonicalProjectedResult, canonicalScene, candidate => {
    const cell = Array.isArray(candidate.cells)
      ? asRecord(candidate.cells.find(value => asRecord(value)?.rect !== undefined))
      : undefined;
    const rect = asRecord(cell?.rect);
    if (rect === undefined || typeof rect.x !== 'number') return { changed: false };
    const before = rect.x;
    rect.x = before + 1;
    return { changed: rect.x !== before, nodeId: cell?.id, before, after: rect.x };
  });

  phaseTAuthorityAttack('Phase T rejects coherent drawable and profile width drift', canonicalProjectedResult, canonicalScene, candidate => {
    const drawable = asRecord(candidate.drawableRect);
    const profile = asRecord(candidate.profile);
    const profileDrawable = asRecord(profile?.drawable);
    if (drawable === undefined || profileDrawable === undefined || typeof drawable.width !== 'number' || typeof profileDrawable.width !== 'number') return { changed: false };
    const before = { drawable: drawable.width, profile: profileDrawable.width };
    drawable.width = before.drawable + 1;
    profileDrawable.width = before.profile + 1;
    return { changed: drawable.width !== before.drawable && profileDrawable.width !== before.profile, before, after: { drawable: drawable.width, profile: profileDrawable.width } };
  });

  phaseTAuthorityAttack('Phase T rejects frame layer drift', canonicalProjectedResult, canonicalScene, candidate => {
    const frame = Array.isArray(candidate.frames) ? asRecord(candidate.frames[0]) : undefined;
    if (frame === undefined || typeof frame.layer !== 'number') return { changed: false };
    const before = frame.layer;
    frame.layer = before + 1;
    return { changed: frame.layer !== before, frameId: frame.id, before, after: frame.layer };
  });

  const topologySource = sourceFor([
    passthrough('ui.xml', canonicalXml.replace('ui/canonical.lua', 'ui/authority-topology.lua')),
    passthrough('ui/authority-topology.lua', authorityTopologyLua, { reason: 'unparsed' }),
  ]);
  const topologySelection = selectionFor(topologySource, 'ui/authority-topology.lua', 'top-level');
  const topologyResult = canonical === undefined
    ? undefined
    : pipeline(topologySource, topologySelection, canonical, {}, {
      truthGrade: 'supplied',
      minTextHeight: 10,
      drawable: { width: 100, height: 80 },
      uiScale: 1,
    });
  const topologyScene = topologyResult !== undefined && topologyResult.scene !== undefined && 'scene' in topologyResult.scene
    ? topologyResult.scene.scene
    : undefined;
  const canonicalResultTopologyScene = materializeIssuedPaintScene(canonicalProjectedResult, topologyScene);
  const topologyResultCanonicalScene = materializeIssuedPaintScene(topologyResult, canonicalScene);
  check('Phase P rejects cross-result exact Scene identities without throwing',
    intactPaintAuthority
    && topologyResult !== undefined
    && topologyScene !== undefined
    && issuedPaintSourceAuthority(topologyResult, topologyScene)
    && canonicalResultTopologyScene.present
    && !canonicalResultTopologyScene.threw
    && canonicalResultTopologyScene.value === undefined
    && topologyResultCanonicalScene.present
    && !topologyResultCanonicalScene.threw
    && topologyResultCanonicalScene.value === undefined, {
      fixtureReady: intactPaintAuthority && topologyResult !== undefined && topologyScene !== undefined,
      canonicalResultTopologyScene,
      topologyResultCanonicalScene,
    });
  phaseTAuthorityAttack('Phase T rejects reciprocal table/frame reassignment', topologyResult, topologyScene, candidate => {
    const frames = Array.isArray(candidate.frames) ? candidate.frames.map(asRecord).filter((value): value is JsonRecord => value !== undefined) : [];
    const tables = Array.isArray(candidate.tables) ? candidate.tables.map(asRecord).filter((value): value is JsonRecord => value !== undefined) : [];
    const frameA = frames[0];
    const frameB = frames.find(frame => frame.id !== frameA?.id);
    const tableA = tables.find(table => table.frameId === frameA?.id);
    const tableAIds = frameA !== undefined && Array.isArray(frameA.tableIds) ? frameA.tableIds as unknown[] : undefined;
    const tableBIds = frameB !== undefined && Array.isArray(frameB.tableIds) ? frameB.tableIds as unknown[] : undefined;
    if (frameA === undefined || frameB === undefined || tableA === undefined || typeof tableA.id !== 'string' || tableAIds === undefined || tableBIds === undefined || tableBIds.includes(tableA.id)) return { changed: false };
    const before = { frameA: [...tableAIds], frameB: [...tableBIds], tableFrameId: tableA.frameId, tableParentId: tableA.parentId };
    frameA.tableIds = tableAIds.filter(id => id !== tableA.id);
    frameB.tableIds = [...tableBIds, tableA.id];
    tableA.frameId = frameB.id;
    tableA.parentId = frameB.id;
    return {
      changed: tableA.frameId === frameB.id && tableA.parentId === frameB.id && Array.isArray(frameA.tableIds) && Array.isArray(frameB.tableIds) && !frameA.tableIds.includes(tableA.id) && frameB.tableIds.includes(tableA.id),
      before,
      after: { frameA: frameA.tableIds, frameB: frameB.tableIds, tableFrameId: tableA.frameId, tableParentId: tableA.parentId },
      frameA: frameA.id,
      frameB: frameB.id,
      tableId: tableA.id,
    };
  });

  phaseTAuthorityAttack('Phase T rejects paired glyph and layout x drift', canonicalProjectedResult, canonicalScene, candidate => {
    const texts = Array.isArray(candidate.texts) ? candidate.texts.map(asRecord).filter((value): value is JsonRecord => value !== undefined) : [];
    const glyphs = Array.isArray(candidate.glyphs) ? candidate.glyphs.map(asRecord).filter((value): value is JsonRecord => value !== undefined) : [];
    const text = texts.find(value => {
      const layout = asRecord(value.layout);
      return layout !== undefined && Array.isArray(layout.lines) && layout.lines.length > 0;
    });
    const textLayout = asRecord(text?.layout);
    const line = textLayout !== undefined && Array.isArray(textLayout.lines) ? asRecord(textLayout.lines[0]) : undefined;
    const layoutQuads = line !== undefined && Array.isArray(line.glyphQuads) ? line.glyphQuads : undefined;
    const firstLayoutQuad = layoutQuads === undefined ? undefined : asRecord(layoutQuads[0]);
    const glyph = text !== undefined && firstLayoutQuad !== undefined ? glyphs.find(value => value.textId === text.id && value.lineIndex === line?.lineIndex && value.glyphIndex === firstLayoutQuad.glyphIndex) : undefined;
    const glyphIndex = firstLayoutQuad === undefined ? -1 : 0;
    const quad = asRecord(glyph?.quad);
    const layoutQuad = firstLayoutQuad;
    if (quad === undefined || layoutQuad === undefined || typeof quad.x !== 'number' || typeof layoutQuad.x !== 'number') return { changed: false, textCount: texts.length, glyphCount: glyphs.length, textId: text?.id, lineIndex: line?.lineIndex, glyphIndex, layoutQuadPresent: layoutQuad !== undefined, quadPresent: quad !== undefined };
    const before = { glyph: quad.x, layout: layoutQuad.x };
    quad.x += 1;
    layoutQuad.x += 1;
    return { changed: quad.x !== before.glyph && layoutQuad.x !== before.layout, glyphId: glyph?.id, before, after: { glyph: quad.x, layout: layoutQuad.x } };
  });

  phaseTAuthorityAttack('Phase T rejects paired glyph and layout code-point drift', canonicalProjectedResult, canonicalScene, candidate => {
    const texts = Array.isArray(candidate.texts) ? candidate.texts.map(asRecord).filter((value): value is JsonRecord => value !== undefined) : [];
    const glyphs = Array.isArray(candidate.glyphs) ? candidate.glyphs.map(asRecord).filter((value): value is JsonRecord => value !== undefined) : [];
    const text = texts.find(value => {
      const layout = asRecord(value.layout);
      return layout !== undefined && Array.isArray(layout.lines) && layout.lines.length > 0;
    });
    const textLayout = asRecord(text?.layout);
    const line = textLayout !== undefined && Array.isArray(textLayout.lines) ? asRecord(textLayout.lines[0]) : undefined;
    const layoutQuads = line !== undefined && Array.isArray(line.glyphQuads) ? line.glyphQuads : undefined;
    const firstLayoutQuad = layoutQuads === undefined ? undefined : asRecord(layoutQuads[0]);
    const glyph = text !== undefined && firstLayoutQuad !== undefined ? glyphs.find(value => value.textId === text.id && value.lineIndex === line?.lineIndex && value.glyphIndex === firstLayoutQuad.glyphIndex) : undefined;
    const layoutQuad = firstLayoutQuad;
    const current = typeof glyph?.codePoint === 'number' ? glyph.codePoint : undefined;
    const font = text?.font === 'Zekton Bold' ? canonical?.fonts.bold : canonical?.fonts.regular;
    const alternate = current === undefined || font === undefined
      ? undefined
      : font.descriptor.codePointToGlyphIndex.findIndex((index, codePoint) => codePoint !== current && index === glyph?.glyphIndex);
    if (glyph === undefined || layoutQuad === undefined || current === undefined || alternate === undefined || alternate < 0) return { changed: false, current, alternate, textCount: texts.length, glyphCount: glyphs.length, textId: text?.id, lineIndex: line?.lineIndex, glyphIndex: glyph?.glyphIndex, layoutQuadPresent: layoutQuad !== undefined };
    const before = { glyph: glyph.codePoint, layout: layoutQuad.codePoint };
    glyph.codePoint = alternate;
    layoutQuad.codePoint = alternate;
    return { changed: glyph.codePoint !== before.glyph && layoutQuad.codePoint !== before.layout, glyphId: glyph.id, before, after: { glyph: glyph.codePoint, layout: layoutQuad.codePoint }, alternate };
  });

  phaseTAuthorityAttack('Phase T rejects table z-order drift', canonicalProjectedResult, canonicalScene, candidate => {
    const table = Array.isArray(candidate.tables) ? asRecord(candidate.tables[0]) : undefined;
    if (table === undefined) return { changed: false };
    const before = table.zOrder;
    const after = before === -10 ? -11 : -10;
    table.zOrder = after;
    return { changed: before !== after, tableId: table.id, before, after };
  });

  phaseTAuthorityAttack('Phase T rejects non-allowlisted node completeness drift', canonicalProjectedResult, canonicalScene, candidate => {
    const frame = Array.isArray(candidate.frames) ? asRecord(candidate.frames[0]) : undefined;
    if (frame === undefined || typeof frame.completeness !== 'string') return { changed: false };
    const before = frame.completeness;
    const after = before === 'complete' ? 'partial' : 'complete';
    frame.completeness = after;
    return { changed: before !== after, frameId: frame.id, before, after };
  });

  const partialXml = [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<addon name="partial-fixture">',
    '  <environment type="menus">',
    '    <file name="ui/partial.lua" />',
    '  </environment>',
    '</addon>',
    '',
  ].join('\n');
  const partialSource = sourceFor([
    passthrough('ui.xml', partialXml),
    passthrough('ui/partial.lua', partialLua, { reason: 'unparsed' }),
  ]);
  const partialSelection = selectionFor(partialSource, 'ui/partial.lua', 'top-level');
  const partialResult = canonical === undefined
    ? undefined
    : pipeline(partialSource, partialSelection, canonical, {}, {
      truthGrade: 'unverified-default',
      minTextHeight: 10,
      drawable: { width: 100, height: 80 },
      uiScale: 1,
    });
  const partialResultProgram = partialResult?.program !== undefined && 'program' in partialResult.program
    ? partialResult.program.program
    : undefined;
  const partialResultScene = partialResult?.scene !== undefined && 'scene' in partialResult.scene
    ? partialResult.scene.scene
    : undefined;

  const branchXml = [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<addon name="branch-fixture">',
    '  <environment type="menus">',
    '    <file name="ui/branch.lua" />',
    '  </environment>',
    '</addon>',
    '',
  ].join('\n');
  const branchSource = sourceFor([
    passthrough('ui.xml', branchXml),
    passthrough('ui/branch.lua', branchExpansionLua, { reason: 'unparsed' }),
  ]);
  const branchSelection = selectionFor(branchSource, 'ui/branch.lua', 'function', 'display');
  const branchSourceBefore = JSON.stringify(branchSource);
  const branchProfileOverrides: Partial<Pick<X4UiPreviewProfileInput, 'truthGrade' | 'minTextHeight' | 'localExpansion' | 'drawable' | 'uiScale'>> = {
    truthGrade: 'unverified-default',
    minTextHeight: 10,
    localExpansion: { maxDepth: 2, maxInvocations: 4 },
    drawable: { width: 100, height: 80 },
    uiScale: 1,
  };
  const branchBaseline = pipeline(branchSource, branchSelection, canonical, {}, branchProfileOverrides);
  const branchProgramBaseline = branchBaseline.program !== undefined && 'program' in branchBaseline.program
    ? branchBaseline.program.program
    : undefined;
  const branchCatalog = branchProgramBaseline?.localExpansion?.previewPathCatalog;
  const branchPath = branchCatalog?.entries.find(entry => entry.arm === 'then' && entry.reachability !== 'unreachable');
  const branchPathInput: X4UiLayoutPreviewPathSelectionInput | undefined = branchCatalog === undefined || branchPath === undefined
    ? undefined
    : {
      catalogId: branchCatalog.id,
      source: branchCatalog.sourceIdentity,
      selections: [{ id: branchPath.id, boundaryId: branchPath.boundaryId, armId: branchPath.armId }],
    };
  const branchSelected = branchPathInput === undefined
    ? undefined
    : pipeline(branchSource, branchSelection, canonical, { paths: branchPathInput }, branchProfileOverrides);
  const branchSelectedProgram = branchSelected?.program !== undefined && 'program' in branchSelected.program
    ? branchSelected.program.program
    : undefined;
  const branchSelectedScene = branchSelected?.scene !== undefined && 'scene' in branchSelected.scene
    ? branchSelected.scene.scene
    : undefined;
  const successfulPath = branchPathInput !== undefined
    && branchSelected?.status !== 'refused'
    && branchSelectedProgram?.localExpansion?.previewPathSelections.length === 1
    && branchSelectedProgram.localExpansion.previewPathSelections[0].id === branchPath?.id
    && branchSelectedProgram.localExpansion.previewPathSelections[0].boundaryId === branchPath?.boundaryId
    && branchSelectedProgram.localExpansion.previewPathSelections[0].armId === branchPath?.armId
    && branchSelectedProgram.localExpansion.previewPathSelections[0].provenance === 'preview-only'
    && branchSelectedProgram.localExpansion.invocations.some(invocation => invocation.status === 'expanded')
    && branchSelectedProgram.localExpansion.invocations.some(invocation => invocation.status === 'conditional')
    && branchSelectedScene?.gameTruth === 'Not verified in game'
    && JSON.stringify(branchSource) === branchSourceBefore
    && JSON.stringify(branchPathInput) !== '';
  check('exact reachable preview path selection expands one arm without source mutation', successfulPath, {
    fixtureReady: branchCatalog !== undefined && branchPath !== undefined,
    baselineStatus: branchBaseline.status,
    baselineProgramStatus: branchBaseline.program?.status,
    baselineExpansionEntries: branchCatalog?.entries.length,
    baselineExpansionInvocations: branchProgramBaseline?.localExpansion?.invocations.length,
    baselineRefusal: branchBaseline.program !== undefined && 'refusal' in branchBaseline.program ? branchBaseline.program.refusal.message : undefined,
    selected: branchPathInput,
    selection: branchSelectedProgram?.localExpansion?.previewPathSelections,
    branchStatus: branchSelected?.status,
    sceneStatus: branchSelectedScene?.status,
  });
  const partialProgram = partialResult?.status === 'partial'
    && partialResult.program?.status === 'partial'
    && partialResultScene?.status === 'partial'
    && partialResultScene.programStatus === 'partial'
    && partialResultScene.widgets.some(widget => widget.kind === 'text')
    && (partialResultProgram?.gaps.length || 0) > 0
    && (partialResultProgram?.gaps.every(gap => gap.source.start.offset >= 0) ?? false)
    && partialResult?.gameTruth === 'Not verified in game';
  check('partial producer result remains a partial Scene with source-linked gaps', partialProgram, {
    fixtureReady: canonical !== undefined && partialSelection.target.id.length > 0,
    pipelineStatus: partialResult?.status,
    programStatus: partialResult?.program?.status,
    sceneStatus: partialResultScene?.status,
    sceneRefusal: partialResult?.scene !== undefined && 'refusal' in partialResult.scene ? partialResult.scene.refusal : undefined,
    operationSummary: partialResultProgram?.operations.map(operation => ({
      kind: operation.kind,
      status: operation.status,
      frameId: operation.frameId,
      tableId: operation.tableId,
      rowId: operation.rowId,
      cellId: operation.cellId,
      reason: operation.reason,
    })),
    nodeSummary: partialResultProgram === undefined ? undefined : {
      frames: partialResultProgram.frames.map(frame => ({ id: frame.id, tableIds: frame.tableIds, operationIds: frame.operationIds, status: frame.status })),
      tables: partialResultProgram.tables.map(table => ({ id: table.id, frameId: table.frameId, rowIds: table.rowIds, operationIds: table.operationIds, status: table.status, hasKernel: table.kernelState !== undefined })),
      rows: partialResultProgram.rows.map(row => ({ id: row.id, tableId: row.tableId, rowIndex: row.rowIndex, cellIds: row.cellIds, operationIds: row.operationIds, status: row.status, hasKernel: row.kernelState !== undefined })),
      cells: partialResultProgram.cells.map(cell => ({ id: cell.id, tableId: cell.tableId, rowId: cell.rowId, rowIndex: cell.rowIndex, column: cell.column, operationIds: cell.operationIds, metadataOperationIds: cell.metadataOperationIds, status: cell.status, hasKernel: cell.kernelState !== undefined })),
    },
    knownTextWidgets: partialResultScene?.widgets.filter(widget => widget.kind === 'text').length,
    programGapCount: partialResultProgram?.gaps.length,
    gapSourceOffsets: partialResultProgram?.gaps.map(gap => gap.source.start.offset),
  });
  check('partial and refusal branches retain exact minTextHeight grade',
    String(partialResult?.profile.minTextHeight?.truthGrade) === 'unverified-default'
    && String(exactNoCorpus.profile.minTextHeight?.truthGrade) === 'undefined',
    {
    partialGrade: partialResult?.profile.minTextHeight?.truthGrade,
    refusedGrade: exactNoCorpus.profile.minTextHeight?.truthGrade,
    partialStatus: partialResult?.status,
    });

  const canonicalFile = canonicalSource.bundle?.sourceFiles.find(file => file.path === 'ui/canonical.lua');
  const directProfile = buildX4UiPreviewProfile({
    id: 'batch6b-profile',
    provenance: 'Batch 6B source-pinned selftest',
    truthGrade: 'supplied',
    source: canonicalSelection.sourceIdentity,
    drawable: { width: 100, height: 80 },
    uiScale: 1,
    minTextHeight: 10,
  });
  const pipelineStaticProgram = canonicalProjectedResult?.program;
  const staticRawModel = canonicalFile?.callModel;
  const staticCallerSnapshot = {
    sourceIndex: canonicalSelection.sourceIndex,
    path: canonicalSelection.path,
    sourceIdentity: canonicalSelection.sourceIdentity,
    target: canonicalSelection.target,
    profile: {
      id: 'batch6b-profile',
      provenance: 'Batch 6B source-pinned selftest',
      truthGrade: 'supplied' as const,
      source: canonicalSelection.sourceIdentity,
      drawable: { width: 100, height: 80 },
      uiScale: 1,
      minTextHeight: 10,
    },
    samples: undefined,
    paths: undefined,
    tableView: undefined,
    textPolicy: undefined,
  };
  const staticNormalizedModel = staticRawModel === undefined ? undefined : normalizeExistingJson(staticRawModel);
  const staticSourceJsonBefore = JSON.stringify(canonicalSource);
  const staticRawModelJsonBefore = JSON.stringify(staticRawModel);
  const staticCallerJsonBefore = JSON.stringify(staticCallerSnapshot);
  const staticNormalization = canonicalFile === undefined || staticRawModel === undefined || staticNormalizedModel === undefined
    ? undefined
    : existingModelNormalizationAudit(
      staticRawModel,
      staticNormalizedModel,
      staticCallerSnapshot,
      canonicalSelection.target,
      directProfile,
      pipelineStaticProgram,
      staticSourceJsonBefore,
      JSON.stringify(canonicalSource),
    );
  check('static JSON-domain normalization preserves existing call-model evidence and pipeline projection',
    staticNormalization?.pass === true,
    {
      fixtureReady: canonicalFile !== undefined && staticRawModel !== undefined && pipelineStaticProgram !== undefined,
      audit: staticNormalization,
      rawModelUnchanged: JSON.stringify(staticRawModel) === staticRawModelJsonBefore,
      callerUnchanged: JSON.stringify(staticCallerSnapshot) === staticCallerJsonBefore,
    });
  const partialFile = partialSource.bundle?.sourceFiles.find(file => file.path === 'ui/partial.lua');
  const partialPipelineProgram = partialResult?.program;
  const partialProfile = buildX4UiPreviewProfile({
    id: 'batch6b-profile',
    provenance: 'Batch 6B source-pinned selftest',
    truthGrade: 'unverified-default',
    source: partialSelection.sourceIdentity,
    drawable: { width: 100, height: 80 },
    uiScale: 1,
    minTextHeight: 10,
  });
  const dynamicRawModel = partialFile?.callModel;
  const dynamicCallerSnapshot = {
    sourceIndex: partialSelection.sourceIndex,
    path: partialSelection.path,
    sourceIdentity: partialSelection.sourceIdentity,
    target: partialSelection.target,
    profile: {
      id: 'batch6b-profile',
      provenance: 'Batch 6B source-pinned selftest',
      truthGrade: 'unverified-default' as const,
      source: partialSelection.sourceIdentity,
      drawable: { width: 100, height: 80 },
      uiScale: 1,
      minTextHeight: 10,
    },
    samples: undefined,
    paths: undefined,
    tableView: undefined,
    textPolicy: undefined,
  };
  const dynamicNormalizedModel = dynamicRawModel === undefined ? undefined : normalizeExistingJson(dynamicRawModel);
  const dynamicSourceJsonBefore = JSON.stringify(partialSource);
  const dynamicRawModelJsonBefore = JSON.stringify(dynamicRawModel);
  const dynamicCallerJsonBefore = JSON.stringify(dynamicCallerSnapshot);
  const dynamicNormalization = partialFile === undefined || dynamicRawModel === undefined || dynamicNormalizedModel === undefined
    ? undefined
    : existingModelNormalizationAudit(
      dynamicRawModel,
      dynamicNormalizedModel,
      dynamicCallerSnapshot,
      partialSelection.target,
      partialProfile,
      partialPipelineProgram,
      dynamicSourceJsonBefore,
      JSON.stringify(partialSource),
    );
  check('dynamic partial JSON-domain normalization preserves existing call-model evidence and pipeline projection',
    dynamicNormalization?.pass === true,
    {
      fixtureReady: partialFile !== undefined && dynamicRawModel !== undefined && partialPipelineProgram !== undefined,
      audit: dynamicNormalization,
      rawModelUnchanged: JSON.stringify(dynamicRawModel) === dynamicRawModelJsonBefore,
      callerUnchanged: JSON.stringify(dynamicCallerSnapshot) === dynamicCallerJsonBefore,
      difference: dynamicNormalization?.normalizedEquivalent === true
        ? undefined
        : firstJsonDifference(
          dynamicNormalizedModel === undefined ? undefined : projectX4UiLayoutProgram(
            dynamicNormalizedModel as Parameters<typeof projectX4UiLayoutProgram>[0],
            partialSelection.target,
            partialProfile,
          ),
          partialPipelineProgram,
        ),
      pipelineFontsize: partialResultProgram?.cells[0]?.descriptorFacts.fontsize,
    });

  const normalizationControlModel = staticNormalizedModel;
  const normalizationControlRaw = staticRawModel;
  const sourceRangeControl = normalizationControlModel === undefined || normalizationControlRaw === undefined
    ? undefined
    : normalizationControl(
      normalizationControlRaw,
      normalizationControlModel,
      candidate => {
        const calls = Array.isArray(candidate.calls) ? candidate.calls : [];
        const firstCall = asRecord(calls[0]);
        const source = asRecord(firstCall?.source);
        const start = asRecord(source?.start);
        const before = start?.offset;
        if (typeof before !== 'number') return { changed: false, before };
        start.offset = before + 1;
        return { changed: start.offset !== before, before, after: start.offset };
      },
    );
  check('JSON-domain normalization rejects a defined source-range mutation',
    sourceRangeControl?.basePass === true
    && sourceRangeControl.mutationChanged
    && sourceRangeControl.mutatedRejected,
    { fixtureReady: sourceRangeControl?.fixtureReady, control: sourceRangeControl });

  const removedMemberControl = normalizationControlModel === undefined || normalizationControlRaw === undefined
    ? undefined
    : normalizationControl(
      normalizationControlRaw,
      normalizationControlModel,
      candidate => {
        const calls = Array.isArray(candidate.calls) ? candidate.calls : [];
        const firstCall = asRecord(calls[0]);
        if (!firstCall || !Object.prototype.hasOwnProperty.call(firstCall, 'callee')) return { changed: false };
        const before = firstCall.callee;
        delete firstCall.callee;
        return { changed: !Object.prototype.hasOwnProperty.call(firstCall, 'callee'), before, after: undefined };
      },
    );
  check('JSON-domain normalization rejects removal of a defined call member',
    removedMemberControl?.basePass === true
    && removedMemberControl.mutationChanged
    && removedMemberControl.mutatedRejected,
    { fixtureReady: removedMemberControl?.fixtureReady, control: removedMemberControl });

  const addedMemberControl = normalizationControlModel === undefined || normalizationControlRaw === undefined
    ? undefined
    : normalizationControl(
      normalizationControlRaw,
      normalizationControlModel,
      candidate => {
        const key = '__batch6b_defined_evidence_mutation';
        const before = candidate[key];
        candidate[key] = 'defined';
        return { changed: candidate[key] === 'defined' && before === undefined, before, after: candidate[key] };
      },
    );
  check('JSON-domain normalization rejects addition of a defined call-model member',
    addedMemberControl?.basePass === true
    && addedMemberControl.mutationChanged
    && addedMemberControl.mutatedRejected,
    { fixtureReady: addedMemberControl?.fixtureReady, control: addedMemberControl });

  const reorderedCallsControl = normalizationControlModel === undefined || normalizationControlRaw === undefined
    ? undefined
    : normalizationControl(
      normalizationControlRaw,
      normalizationControlModel,
      candidate => {
        const calls = Array.isArray(candidate.calls) ? candidate.calls : [];
        const before = calls.map(call => asRecord(call)?.order);
        if (calls.length < 2) return { changed: false, before };
        calls.reverse();
        const after = calls.map(call => asRecord(call)?.order);
        return { changed: JSON.stringify(before) !== JSON.stringify(after), before, after };
      },
    );
  check('JSON-domain normalization rejects reordering defined calls',
    reorderedCallsControl?.basePass === true
    && reorderedCallsControl.mutationChanged
    && reorderedCallsControl.mutatedRejected,
    { fixtureReady: reorderedCallsControl?.fixtureReady, control: reorderedCallsControl });

  const normalization = {
    static: staticNormalization?.pass === true,
    dynamic: dynamicNormalization?.pass === true,
    controls: {
      sourceRange: sourceRangeControl?.mutatedRejected === true,
      removedDefinedMember: removedMemberControl?.mutatedRejected === true,
      addedDefinedMember: addedMemberControl?.mutatedRejected === true,
      reorderedCalls: reorderedCallsControl?.mutatedRejected === true,
    },
  };

  const refusedProgram = exactNoCorpus.program?.status === 'refused'
    && exactNoCorpus.status === 'refused'
    && exactNoCorpus.scene?.status === 'refused'
    && exactNoCorpus.gameTruth === 'Not verified in game';
  return {
    canonicalProjected,
    canonicalFacts,
    canonicalMutationControls: {
      sourceIdentity: sourceMutationControl,
      fontHash: fontMutationControl,
      zeroGeometry: geometryMutationControl,
    },
    canonicalMutationEvidence: {
      sourceIdentity: {
        before: sourceBefore,
        after: sourceMutationSource?.file,
        acceptedAfter: sourceMutationFacts.accepted,
      },
      fontHash: {
        before: fontBefore,
        after: fontAfter,
        acceptedAfter: fontMutationFacts.accepted,
      },
      zeroGeometry: {
        beforeCells: Array.isArray(cellsBefore) ? cellsBefore.length : undefined,
        afterCells: Array.isArray(geometryMutationScene?.cells) ? geometryMutationScene.cells.length : undefined,
        acceptedAfter: geometryMutationFacts.accepted,
      },
    },
    partialProgram,
    refusedProgram,
    successfulPath,
    blockingLintSurvivesRefusal: blockingRefusal.program?.status === 'refused' && blockingFinding !== undefined,
    canonicalLoaderReady,
    canonicalLoaderRestored: checks.some(candidate => candidate.name === 'canonical loader restores platform Web Crypto' && candidate.pass),
    normalization,
    normalizationEvidence: {
      static: staticNormalization,
      dynamic: dynamicNormalization,
      controls: {
        sourceRange: sourceRangeControl,
        removedDefinedMember: removedMemberControl,
        addedDefinedMember: addedMemberControl,
        reorderedCalls: reorderedCallsControl,
      },
    },
  };
}

runIndependentReviewCorrections().then(result => {
  const failed = checks.filter(candidate => !candidate.pass);
  const closedDomainChecks = checks.filter(candidate => candidate.name.startsWith('closed-domain-'));
  const closedDomainDetails = closedDomainChecks.map(candidate => candidate.detail !== null && typeof candidate.detail === 'object' && !Array.isArray(candidate.detail) ? candidate.detail as JsonRecord : {});
  const summary = {
    allPassed: failed.length === 0,
    passed: checks.length - failed.length,
    total: checks.length,
    closedDomain: {
      total: closedDomainChecks.length,
      passed: closedDomainChecks.filter(candidate => candidate.pass).length,
      failed: closedDomainChecks.filter(candidate => !candidate.pass).length,
      fixtureNotReady: closedDomainDetails.filter(detail => detail.fixtureReady === false).length,
      materializerExceptions: closedDomainDetails.filter(detail => detail.materializerThrew === true || asRecord(detail.attempt)?.threw === true).length,
      names: closedDomainChecks.map(candidate => candidate.name),
    },
    fixtureMatrix: {
      sourceOwned: source.status === 'source-owned',
      generatedShadowing: generatedSource.status === 'generated-shadowing-source',
      unavailable: unavailableSource.status === 'unavailable',
      unregisteredLintRetained: noSelection.lint.some(file => file.unregistered),
      staleCorpus: staleCorpus.corpus.status === 'stale',
      staleSelection: staleTargetResult.selection.status === 'needs-selection',
      canonicalProjected: result.canonicalProjected,
      partialProgram: result.partialProgram,
      refusedProgram: result.refusedProgram,
      successfulPath: result.successfulPath,
      blockingLintSurvivesRefusal: result.blockingLintSurvivesRefusal,
    },
    phase6B: {
      canonicalProjected: result.canonicalProjected,
      canonicalFacts: result.canonicalFacts,
      canonicalMutationControls: result.canonicalMutationControls,
      canonicalMutationEvidence: result.canonicalMutationEvidence,
      partialProgram: result.partialProgram,
      refusedProgram: result.refusedProgram,
      successfulPath: result.successfulPath,
      blockingLintSurvivesRefusal: result.blockingLintSurvivesRefusal,
      canonicalLoaderReady: result.canonicalLoaderReady,
      canonicalLoaderRestored: result.canonicalLoaderRestored,
      normalization: result.normalization,
      normalizationEvidence: result.normalizationEvidence,
    },
    failed: failed.map(candidate => ({ name: candidate.name, detail: candidate.detail })),
  };
  console.log(JSON.stringify(summary));
  if (failed.length > 0) process.exitCode = 1;
}).catch(error => {
  console.log(JSON.stringify({ allPassed: false, passed: checks.filter(candidate => candidate.pass).length, total: checks.length, failed: [{ name: 'independent-review-correction runner', detail: error instanceof Error ? error.message : String(error) }] }));
  process.exitCode = 1;
});
