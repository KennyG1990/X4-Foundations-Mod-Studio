/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * An ordered, source-preserving view of an imported X4 UI menu registration
 * and caller-supplied Lua texts.  This module deliberately has no knowledge
 * of the filesystem: callers provide every source string explicitly.
 */

import { DOMParser } from '@xmldom/xmldom';
import {
  buildX4UiCallModel,
  type X4UiCallModel,
  type X4UiLuaFileInput,
  type X4UiVerificationGap,
  type X4UiVerificationGapCategory
} from './x4UiCallModel';

export interface X4UiSourceFileInputWithPath {
  readonly path: string;
  readonly text: string;
  readonly sourcePath?: string;
}

/** The existing call-model API calls the same user-facing path `rel`. */
export interface X4UiSourceFileInputWithRel {
  readonly rel: string;
  readonly text: string;
  readonly sourcePath?: string;
}

export type X4UiSourceFileInput = X4UiSourceFileInputWithPath | X4UiSourceFileInputWithRel;
export type X4UiSourceFileMap = Readonly<Record<string, string>>;
export type X4UiSourceFileInputs = readonly X4UiSourceFileInput[] | X4UiSourceFileMap;

export interface X4UiSourceBundleInput {
  readonly uiXml: string;
  readonly luaFiles: X4UiSourceFileInputs;
}

export type X4UiSourceDiagnosticSeverity = 'info' | 'warning' | 'error';

export type X4UiSourceDiagnosticCode =
  | 'malformed-xml'
  | 'missing-registration-name'
  | 'invalid-registration-path'
  | 'unsafe-traversal-registration'
  | 'unsafe-absolute-registration'
  | 'missing-lua-file'
  | 'duplicate-registration'
  | 'ambiguous-lua-file'
  | 'unregistered-lua-file'
  | 'unsafe-lua-file'
  | 'duplicate-supplied-lua-file'
  | 'lua-parse-failure'
  | 'dynamic-call-model-gap'
  | 'unsupported-call-model-gap';

export interface X4UiSourceDiagnostic {
  readonly code: X4UiSourceDiagnosticCode;
  readonly severity: X4UiSourceDiagnosticSeverity;
  readonly message: string;
  readonly registrationIndex?: number;
  readonly sourceIndex?: number;
  readonly path?: string;
  readonly gapCategory?: X4UiVerificationGapCategory;
}

export type X4UiXmlIssueLevel = 'warning' | 'error' | 'fatal';

export interface X4UiXmlIssue {
  readonly level: X4UiXmlIssueLevel;
  readonly message: string;
}

export interface X4UiSourceXmlState {
  readonly status: 'parsed' | 'malformed';
  readonly parsed: boolean;
  readonly issues: readonly X4UiXmlIssue[];
}

export type X4UiRegistrationPathSafety =
  | 'safe'
  | 'unsafe-traversal'
  | 'unsafe-absolute'
  | 'invalid';

export type X4UiRegistrationResolution =
  | 'resolved'
  | 'missing-file'
  | 'duplicate-registration'
  | 'ambiguous-source-file'
  | 'unsafe-traversal'
  | 'unsafe-absolute'
  | 'missing-name'
  | 'invalid-path'
  | 'malformed-xml';

export interface X4UiSourceRegistration {
  /** Zero-based position in the menu registration document order. */
  readonly index: number;
  readonly order: number;
  /** The decoded attribute value, retained exactly as supplied by the XML DOM. */
  readonly rawPath?: string;
  /** Alias making the preserved registration spelling explicit to consumers. */
  readonly rawSpelling?: string;
  /** A lookup-only key. It never replaces `rawPath` in the source projection. */
  readonly lookupKey?: string;
  readonly pathSafety: X4UiRegistrationPathSafety;
  readonly resolution: X4UiRegistrationResolution;
  readonly duplicate: boolean;
  readonly locked: boolean;
  readonly sourceIndexes: readonly number[];
  /** Present when exactly one supplied source has this contained lookup key. */
  readonly sourceIndex?: number;
}

export type X4UiLuaParseStatus = 'parsed' | 'locked';
export type X4UiCallModelVerificationStatus = 'verified' | 'unverified' | 'locked';

export interface X4UiSourceFile {
  readonly index: number;
  /** Caller spelling; this is never rewritten by normalization. */
  readonly path: string;
  readonly rawPath: string;
  readonly sourcePath?: string;
  readonly lookupKey?: string;
  readonly text: string;
  readonly callModel: X4UiCallModel;
  readonly parseStatus: X4UiLuaParseStatus;
  readonly verificationStatus: X4UiCallModelVerificationStatus;
  readonly verificationGaps: readonly X4UiVerificationGap[];
  readonly registrationIndexes: readonly number[];
  readonly registered: boolean;
  readonly unregistered: boolean;
  /** True only when an explicit CAS splice can target this source. */
  readonly editable: boolean;
  readonly diagnostics: readonly X4UiSourceDiagnostic[];
}

export interface X4UiSourceBundle {
  /** Raw ui.xml text, including BOM, line endings, and all formatting. */
  readonly uiXml: string;
  readonly xml: X4UiSourceXmlState;
  readonly registrations: readonly X4UiSourceRegistration[];
  /** Alias for consumers that want to emphasize document order. */
  readonly orderedRegistrations: readonly X4UiSourceRegistration[];
  readonly sourceFiles: readonly X4UiSourceFile[];
  /** Alias for `sourceFiles`; no source is dropped from this collection. */
  readonly files: readonly X4UiSourceFile[];
  /** Resolved sources in valid XML registration order; duplicates remain repeated. */
  readonly orderedFiles: readonly X4UiSourceFile[];
  readonly unregisteredFiles: readonly X4UiSourceFile[];
  readonly diagnostics: readonly X4UiSourceDiagnostic[];
  readonly locked: boolean;
  readonly hasUnverifiedCallModelGaps: boolean;
}

export interface X4UiSourceProjectionFile {
  readonly path: string;
  readonly text: string;
  readonly sourcePath?: string;
}

export interface X4UiSourceBundleProjection {
  readonly uiXml: string;
  readonly luaFiles: readonly X4UiSourceProjectionFile[];
}

export interface X4UiSourceSplice {
  readonly path: string;
  readonly startOffset: number;
  readonly endOffset: number;
  readonly expectedText: string;
  readonly replacement: string;
}

export type X4UiSourceEdit = X4UiSourceSplice;

export type X4UiSourceSpliceRefusalReason =
  | 'malformed-xml'
  | 'invalid-path'
  | 'unsafe-traversal-path'
  | 'unsafe-absolute-path'
  | 'not-registered'
  | 'missing-file'
  | 'ambiguous-registration'
  | 'ambiguous-source-file'
  | 'lua-parse-locked'
  | 'invalid-range'
  | 'expected-text-mismatch'
  | 'replacement-parse-failure';

export interface X4UiSourceSpliceResult {
  readonly accepted: boolean;
  readonly bundle: X4UiSourceBundle;
  readonly reason: X4UiSourceSpliceRefusalReason | null;
}

interface XmlNodeLike {
  readonly nodeType?: number;
  readonly nodeName?: string;
  readonly localName?: string | null;
  readonly childNodes?: {
    readonly length: number;
    item(index: number): XmlNodeLike | null;
  };
}

interface XmlElementLike extends XmlNodeLike {
  getAttribute?(name: string): string | null;
  hasAttribute?(name: string): boolean;
}

interface XmlDocumentLike {
  readonly documentElement?: XmlElementLike | null;
}

interface PathNormalization {
  readonly kind: X4UiRegistrationPathSafety;
  readonly key?: string;
}

interface RegistrationCandidate {
  readonly rawPath?: string;
  readonly normalized: PathNormalization;
}

interface ParsedUiXml {
  readonly state: X4UiSourceXmlState;
  readonly registrations: readonly RegistrationCandidate[];
}

interface CanonicalSourceInput {
  readonly path: string;
  readonly text: string;
  readonly sourcePath?: string;
}

interface MutableSourceDraft {
  readonly index: number;
  readonly input: CanonicalSourceInput;
  readonly normalized: PathNormalization;
  readonly callModel: X4UiCallModel;
  readonly registrationIndexes: number[];
}

const XML_ELEMENT_NODE = 1;

function freezeArray<T>(items: readonly T[]): readonly T[] {
  return Object.freeze([...items]);
}

function freezeObject<T extends object>(value: T): T {
  return Object.freeze(value);
}

function elementName(element: XmlElementLike): string {
  if (typeof element.localName === 'string' && element.localName.length > 0) {
    return element.localName;
  }
  const nodeName = typeof element.nodeName === 'string' ? element.nodeName : '';
  const separator = nodeName.indexOf(':');
  return separator >= 0 ? nodeName.slice(separator + 1) : nodeName;
}

function elementAttribute(element: XmlElementLike, name: string): string | undefined {
  if (typeof element.hasAttribute === 'function' && !element.hasAttribute(name)) {
    return undefined;
  }
  if (typeof element.getAttribute !== 'function') return undefined;
  const value = element.getAttribute(name);
  return value === null || value === undefined ? undefined : value;
}

function childElements(element: XmlElementLike): XmlElementLike[] {
  const children = element.childNodes;
  if (!children) return [];

  const result: XmlElementLike[] = [];
  for (let index = 0; index < children.length; index += 1) {
    const child = children.item(index);
    if (!child) continue;
    if (child.nodeType === XML_ELEMENT_NODE || (typeof child.nodeName === 'string' && !child.nodeName.startsWith('#'))) {
      result.push(child as XmlElementLike);
    }
  }
  return result;
}

function normalizeXmlIssueLevel(level: unknown): X4UiXmlIssueLevel {
  const value = String(level).toLowerCase();
  if (value.includes('fatal')) return 'fatal';
  if (value.includes('warn')) return 'warning';
  return 'error';
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return String(error);
}

/**
 * Normalize only a safe lookup key. The original path is retained separately.
 * Backslashes are accepted as separators for lookup, but an absolute or
 * traversing spelling is never made safe by normalization.
 */
function normalizeContainedPath(rawPath: string | undefined): PathNormalization {
  if (rawPath === undefined || rawPath.length === 0 || rawPath.includes('\u0000')) {
    return { kind: 'invalid' };
  }

  const slashPath = rawPath.replace(/\\/g, '/');
  if (/^(?:[A-Za-z]:|\/)/.test(slashPath)) {
    return { kind: 'unsafe-absolute' };
  }

  const segments = slashPath.split('/');
  const normalizedSegments: string[] = [];
  for (const segment of segments) {
    if (segment.length === 0 || segment === '.') continue;
    if (segment === '..') return { kind: 'unsafe-traversal' };
    normalizedSegments.push(segment);
  }

  if (normalizedSegments.length === 0) return { kind: 'invalid' };
  return { kind: 'safe', key: normalizedSegments.join('/') };
}

function parseUiXml(uiXml: string): ParsedUiXml {
  const issues: X4UiXmlIssue[] = [];
  let document: XmlDocumentLike | undefined;

  try {
    document = new DOMParser({
      onError: (level: unknown, message: unknown): void => {
        issues.push({
          level: normalizeXmlIssueLevel(level),
          message: String(message)
        });
      }
    // @xmldom/xmldom treats a JavaScript BOM as content rather than the XML
    // encoding marker. Strip it only for the validation parse; `uiXml` itself
    // remains untouched in the bundle and every projection.
    }).parseFromString(uiXml.startsWith('\uFEFF') ? uiXml.slice(1) : uiXml, 'text/xml') as unknown as XmlDocumentLike;
  } catch (error) {
    issues.push({ level: 'fatal', message: errorMessage(error) });
  }

  const root = document?.documentElement;
  const rootName = root ? elementName(root).toLowerCase() : '';
  if (!root || rootName === 'parsererror') {
    if (issues.length === 0) {
      issues.push({ level: 'fatal', message: 'XML document has no usable document element' });
    }
  }

  const registrations: RegistrationCandidate[] = [];
  if (root && rootName !== 'parsererror') {
    const visit = (element: XmlElementLike, insideMenusEnvironment: boolean): void => {
      const name = elementName(element).toLowerCase();
      const insideMenus = insideMenusEnvironment
        || (name === 'environment' && elementAttribute(element, 'type') === 'menus');

      if (insideMenus && name === 'file') {
        const rawPath = elementAttribute(element, 'name');
        registrations.push({
          rawPath,
          normalized: normalizeContainedPath(rawPath)
        });
      }

      for (const child of childElements(element)) visit(child, insideMenus);
    };
    visit(root, false);
  }

  const frozenIssues = freezeArray(issues.map(issue => freezeObject({ ...issue })));
  const malformed = frozenIssues.length > 0 || !root || rootName === 'parsererror';
  const state: X4UiSourceXmlState = freezeObject({
    status: malformed ? 'malformed' : 'parsed',
    parsed: !malformed,
    issues: frozenIssues
  });

  return {
    state,
    registrations: freezeArray(registrations.map(candidate => freezeObject({ ...candidate })))
  };
}

function canonicalSourceInputs(inputs: X4UiSourceFileInputs): CanonicalSourceInput[] {
  if (Array.isArray(inputs)) {
    return inputs.map(input => {
      const candidate = input as X4UiSourceFileInputWithPath & X4UiSourceFileInputWithRel;
      const path = typeof candidate.path === 'string' ? candidate.path : candidate.rel;
      return {
        path: typeof path === 'string' ? path : '',
        text: input.text,
        sourcePath: input.sourcePath
      };
    });
  }

  return Object.keys(inputs).map(path => ({ path, text: inputs[path] }));
}

function stabilizeCallModel(model: X4UiCallModel): X4UiCallModel {
  if (model.parsed) return model;

  // luaparse can expose parser-internal wording that changes after another
  // failed parse (notably for a leading BOM). Keep the existing model shape
  // and source locations, but make the locked reason stable for bundle users.
  return {
    ...model,
    verificationGaps: model.verificationGaps.map(gap => gap.category === 'parse'
      ? { ...gap, reason: 'Lua source could not be parsed' }
      : gap)
  };
}

function buildSourceCallModel(source: CanonicalSourceInput): X4UiCallModel {
  // luaparse rejects U+FEFF, although the shipped Lua source is valid. A
  // single ASCII space is an equal-length parser-only sentinel, so all
  // source offsets remain aligned with the caller's raw text.
  const parserText = source.text.startsWith('\uFEFF')
    ? ` ${source.text.slice(1)}`
    : source.text;
  const model = stabilizeCallModel(buildX4UiCallModel({
    rel: source.path,
    text: parserText,
    ...(source.sourcePath !== undefined ? { sourcePath: source.sourcePath } : {})
  } as X4UiLuaFileInput));

  if (parserText === source.text) return model;
  return {
    ...model,
    file: {
      ...model.file,
      text: source.text
    }
  };
}

function registrationDiagnostic(
  registration: X4UiSourceRegistration,
  sourceFileCount: number
): X4UiSourceDiagnostic | undefined {
  const path = registration.rawPath;
  switch (registration.resolution) {
    case 'missing-name':
      return {
        code: 'missing-registration-name',
        severity: 'error',
        message: `Menu registration ${registration.index} has no file name`,
        registrationIndex: registration.index
      };
    case 'invalid-path':
      return {
        code: 'invalid-registration-path',
        severity: 'error',
        message: `Menu registration ${registration.index} has an invalid contained path`,
        registrationIndex: registration.index,
        path
      };
    case 'unsafe-traversal':
      return {
        code: 'unsafe-traversal-registration',
        severity: 'error',
        message: `Menu registration ${registration.index} uses an unsafe traversal path`,
        registrationIndex: registration.index,
        path
      };
    case 'unsafe-absolute':
      return {
        code: 'unsafe-absolute-registration',
        severity: 'error',
        message: `Menu registration ${registration.index} uses an unsafe absolute path`,
        registrationIndex: registration.index,
        path
      };
    case 'missing-file':
      return {
        code: 'missing-lua-file',
        severity: 'error',
        message: `Menu registration ${registration.index} has no supplied Lua source`,
        registrationIndex: registration.index,
        path
      };
    case 'duplicate-registration':
      return {
        code: 'duplicate-registration',
        severity: 'error',
        message: `Menu registration ${registration.index} is a duplicate contained path`,
        registrationIndex: registration.index,
        path
      };
    case 'ambiguous-source-file':
      return {
        code: 'ambiguous-lua-file',
        severity: 'error',
        message: `Menu registration ${registration.index} matches ${sourceFileCount} supplied Lua sources`,
        registrationIndex: registration.index,
        path
      };
    default:
      return undefined;
  }
}

function sourceDiagnostic(
  code: X4UiSourceDiagnosticCode,
  severity: X4UiSourceDiagnosticSeverity,
  message: string,
  sourceIndex: number,
  path: string,
  gapCategory?: X4UiVerificationGapCategory
): X4UiSourceDiagnostic {
  return {
    code,
    severity,
    message,
    sourceIndex,
    path,
    ...(gapCategory ? { gapCategory } : {})
  };
}

function buildSourceFile(
  draft: MutableSourceDraft,
  sourceDiagnostics: readonly X4UiSourceDiagnostic[],
  registrations: readonly X4UiSourceRegistration[],
  xmlParsed: boolean,
  sourceKeyCount: number
): X4UiSourceFile {
  const parseStatus: X4UiLuaParseStatus = draft.callModel.parsed ? 'parsed' : 'locked';
  const verificationStatus: X4UiCallModelVerificationStatus = !draft.callModel.parsed
    ? 'locked'
    : draft.callModel.verificationGaps.length > 0
      ? 'unverified'
      : 'verified';
  const registered = xmlParsed && draft.registrationIndexes.length > 0;
  const resolvedRegistration = draft.registrationIndexes.length === 1
    ? registrations[draft.registrationIndexes[0]]
    : undefined;
  const editable = Boolean(
    xmlParsed
      && draft.normalized.kind === 'safe'
      && sourceKeyCount === 1
      && resolvedRegistration?.resolution === 'resolved'
      && draft.callModel.parsed
  );

  return freezeObject({
    index: draft.index,
    path: draft.input.path,
    rawPath: draft.input.path,
    ...(draft.input.sourcePath !== undefined ? { sourcePath: draft.input.sourcePath } : {}),
    ...(draft.normalized.key !== undefined ? { lookupKey: draft.normalized.key } : {}),
    text: draft.input.text,
    callModel: draft.callModel,
    parseStatus,
    verificationStatus,
    verificationGaps: freezeArray(draft.callModel.verificationGaps),
    registrationIndexes: freezeArray(draft.registrationIndexes),
    registered,
    unregistered: !registered,
    editable,
    diagnostics: freezeArray(sourceDiagnostics)
  });
}

/** Build a pure ordered bundle from raw ui.xml and caller-owned Lua strings. */
export function buildX4UiSourceBundle(input: X4UiSourceBundleInput): X4UiSourceBundle {
  const parsedXml = parseUiXml(input.uiXml);
  const canonicalInputs = canonicalSourceInputs(input.luaFiles);
  const sourceDrafts: MutableSourceDraft[] = canonicalInputs.map((source, index) => ({
    index,
    input: source,
    normalized: normalizeContainedPath(source.path),
    callModel: buildSourceCallModel(source),
    registrationIndexes: []
  }));

  const sourceIndexesByKey = new Map<string, number[]>();
  for (const draft of sourceDrafts) {
    const key = draft.normalized.key;
    if (key === undefined) continue;
    const indexes = sourceIndexesByKey.get(key) || [];
    indexes.push(draft.index);
    sourceIndexesByKey.set(key, indexes);
  }

  const registrationIndexesByKey = new Map<string, number[]>();
  parsedXml.registrations.forEach((candidate, index) => {
    if (candidate.normalized.key === undefined) return;
    const indexes = registrationIndexesByKey.get(candidate.normalized.key) || [];
    indexes.push(index);
    registrationIndexesByKey.set(candidate.normalized.key, indexes);
  });

  const registrationDrafts = parsedXml.registrations.map((candidate, index) => {
    const sourceIndexes = candidate.normalized.key === undefined
      ? []
      : sourceIndexesByKey.get(candidate.normalized.key) || [];
    const registrationIndexes = candidate.normalized.key === undefined
      ? []
      : registrationIndexesByKey.get(candidate.normalized.key) || [];
    const duplicate = registrationIndexes.length > 1;

    let resolution: X4UiRegistrationResolution;
    switch (candidate.normalized.kind) {
      case 'invalid':
        resolution = candidate.rawPath === undefined ? 'missing-name' : 'invalid-path';
        break;
      case 'unsafe-traversal':
        resolution = 'unsafe-traversal';
        break;
      case 'unsafe-absolute':
        resolution = 'unsafe-absolute';
        break;
      case 'safe':
        if (!parsedXml.state.parsed) resolution = 'malformed-xml';
        else if (sourceIndexes.length === 0) resolution = 'missing-file';
        else if (sourceIndexes.length > 1) resolution = 'ambiguous-source-file';
        else if (duplicate) resolution = 'duplicate-registration';
        else resolution = 'resolved';
        break;
    }
    if (!parsedXml.state.parsed && candidate.normalized.kind !== 'safe') {
      // Keep the path-safety classification visible even while XML is locked.
      // The bundle-level XML state remains the authoritative lock reason.
    }

    return {
      index,
      rawPath: candidate.rawPath,
      rawSpelling: candidate.rawPath,
      lookupKey: candidate.normalized.key,
      pathSafety: candidate.normalized.kind,
      resolution,
      duplicate,
      locked: !parsedXml.state.parsed || resolution !== 'resolved',
      sourceIndexes
    };
  });

  const registrations: X4UiSourceRegistration[] = registrationDrafts.map(draft => freezeObject({
    ...draft,
    order: draft.index,
    sourceIndexes: freezeArray(draft.sourceIndexes),
    ...(draft.sourceIndexes.length === 1 ? { sourceIndex: draft.sourceIndexes[0] } : {})
  }));

  for (const registration of registrations) {
    for (const sourceIndex of registration.sourceIndexes) {
      sourceDrafts[sourceIndex].registrationIndexes.push(registration.index);
    }
  }

  const diagnostics: X4UiSourceDiagnostic[] = [];
  for (const issue of parsedXml.state.issues) {
    diagnostics.push({
      code: 'malformed-xml',
      severity: 'error',
      message: issue.message
    });
  }
  if (parsedXml.state.status === 'malformed' && parsedXml.state.issues.length === 0) {
    diagnostics.push({
      code: 'malformed-xml',
      severity: 'error',
      message: 'ui.xml is malformed'
    });
  }

  for (const registration of registrations) {
    const diagnostic = registrationDiagnostic(
      registration,
      registration.sourceIndexes.length
    );
    if (diagnostic) diagnostics.push(diagnostic);
  }

  const sourceFiles: X4UiSourceFile[] = sourceDrafts.map(draft => {
    const sourceDiagnostics: X4UiSourceDiagnostic[] = [];
    const sourcePath = draft.input.path;
    const sourceKeyCount = draft.normalized.key === undefined
      ? 0
      : (sourceIndexesByKey.get(draft.normalized.key) || []).length;

    if (draft.normalized.kind !== 'safe') {
      sourceDiagnostics.push(sourceDiagnostic(
        'unsafe-lua-file',
        'error',
        'Supplied Lua source is outside the contained lookup namespace',
        draft.index,
        sourcePath
      ));
    }
    if (sourceKeyCount > 1) {
      sourceDiagnostics.push(sourceDiagnostic(
        'duplicate-supplied-lua-file',
        'error',
        'Multiple supplied Lua sources share one contained lookup key',
        draft.index,
        sourcePath
      ));
    }
    if (!draft.callModel.parsed) {
      sourceDiagnostics.push(sourceDiagnostic(
        'lua-parse-failure',
        'error',
        'Lua source could not be parsed and is locked',
        draft.index,
        sourcePath
      ));
    }
    for (const gap of draft.callModel.verificationGaps) {
      const gapCode = gap.status === 'dynamic' || gap.status === 'unknown'
        ? 'dynamic-call-model-gap'
        : 'unsupported-call-model-gap';
      sourceDiagnostics.push(sourceDiagnostic(
        gapCode,
        'warning',
        gap.reason,
        draft.index,
        sourcePath,
        gap.category
      ));
    }

    const file = buildSourceFile(
      draft,
      sourceDiagnostics,
      registrations,
      parsedXml.state.parsed,
      sourceKeyCount
    );
    diagnostics.push(...sourceDiagnostics);
    if (file.unregistered) {
      const unregisteredDiagnostic = sourceDiagnostic(
        'unregistered-lua-file',
        'info',
        'Supplied Lua source is not in the authoritative menus registration order',
        draft.index,
        sourcePath
      );
      diagnostics.push(unregisteredDiagnostic);
      return freezeObject({
        ...file,
        diagnostics: freezeArray([...file.diagnostics, unregisteredDiagnostic])
      });
    }
    return file;
  });

  const orderedFiles: X4UiSourceFile[] = [];
  if (parsedXml.state.parsed) {
    for (const registration of registrations) {
      if (registration.sourceIndex === undefined) continue;
      if (registration.resolution !== 'resolved' && registration.resolution !== 'duplicate-registration') continue;
      orderedFiles.push(sourceFiles[registration.sourceIndex]);
    }
  }

  const unregisteredFiles = sourceFiles.filter(file => file.unregistered);
  const frozenSourceFiles = freezeArray(sourceFiles);
  const frozenOrderedFiles = freezeArray(orderedFiles);
  const frozenUnregisteredFiles = freezeArray(unregisteredFiles);
  const frozenDiagnostics = freezeArray(diagnostics.map(diagnostic => freezeObject({ ...diagnostic })));
  const hasUnverifiedCallModelGaps = sourceFiles.some(file => file.verificationStatus === 'unverified');
  const locked = !parsedXml.state.parsed
    || sourceFiles.some(file => file.parseStatus === 'locked')
    || registrations.some(registration => registration.locked);

  return freezeObject({
    uiXml: input.uiXml,
    xml: parsedXml.state,
    registrations: freezeArray(registrations),
    orderedRegistrations: freezeArray(registrations),
    sourceFiles: frozenSourceFiles,
    files: frozenSourceFiles,
    orderedFiles: frozenOrderedFiles,
    unregisteredFiles: frozenUnregisteredFiles,
    diagnostics: frozenDiagnostics,
    locked,
    hasUnverifiedCallModelGaps
  });
}

/** Return raw ui.xml and every caller-supplied Lua string without regeneration. */
export function projectX4UiSourceBundle(bundle: X4UiSourceBundle): X4UiSourceBundleProjection {
  const luaFiles = bundle.sourceFiles.map(source => freezeObject({
    path: source.path,
    text: source.text,
    ...(source.sourcePath !== undefined ? { sourcePath: source.sourcePath } : {})
  }));
  return freezeObject({
    uiXml: bundle.uiXml,
    luaFiles: freezeArray(luaFiles)
  });
}

function refusal(
  bundle: X4UiSourceBundle,
  reason: X4UiSourceSpliceRefusalReason
): X4UiSourceSpliceResult {
  return freezeObject({ accepted: false, bundle, reason });
}

/**
 * Apply one compare-and-swap source splice. Refusals return the exact original
 * bundle object; successful edits rebuild only the supplied source projection
 * through the existing per-file call-model parser.
 */
export function spliceX4UiSourceBundle(
  bundle: X4UiSourceBundle,
  edit: X4UiSourceSplice
): X4UiSourceSpliceResult {
  if (!bundle.xml.parsed) return refusal(bundle, 'malformed-xml');

  const normalized = normalizeContainedPath(typeof edit.path === 'string' ? edit.path : undefined);
  switch (normalized.kind) {
    case 'invalid':
      return refusal(bundle, 'invalid-path');
    case 'unsafe-traversal':
      return refusal(bundle, 'unsafe-traversal-path');
    case 'unsafe-absolute':
      return refusal(bundle, 'unsafe-absolute-path');
    case 'safe':
      break;
  }

  const registrations = bundle.registrations.filter(registration => registration.lookupKey === normalized.key);
  if (registrations.length === 0) return refusal(bundle, 'not-registered');
  if (registrations.length !== 1) return refusal(bundle, 'ambiguous-registration');

  const registration = registrations[0];
  if (registration.sourceIndexes.length === 0) return refusal(bundle, 'missing-file');
  if (registration.sourceIndexes.length !== 1) return refusal(bundle, 'ambiguous-source-file');
  if (registration.resolution === 'duplicate-registration') {
    return refusal(bundle, 'ambiguous-registration');
  }
  if (registration.resolution === 'ambiguous-source-file') {
    return refusal(bundle, 'ambiguous-source-file');
  }
  if (registration.resolution !== 'resolved') {
    return refusal(bundle, 'missing-file');
  }

  const source = bundle.sourceFiles[registration.sourceIndexes[0]];
  if (!source || source.lookupKey !== normalized.key) return refusal(bundle, 'missing-file');
  if (!source.callModel.parsed || source.parseStatus !== 'parsed') {
    return refusal(bundle, 'lua-parse-locked');
  }
  if (
    !Number.isInteger(edit.startOffset)
    || !Number.isInteger(edit.endOffset)
    || edit.startOffset < 0
    || edit.endOffset < edit.startOffset
    || edit.endOffset > source.text.length
  ) {
    return refusal(bundle, 'invalid-range');
  }
  if (source.text.slice(edit.startOffset, edit.endOffset) !== edit.expectedText) {
    return refusal(bundle, 'expected-text-mismatch');
  }

  const replacement = typeof edit.replacement === 'string' ? edit.replacement : '';
  const nextText = source.text.slice(0, edit.startOffset)
    + replacement
    + source.text.slice(edit.endOffset);
  const nextModel = buildSourceCallModel({
    path: source.path,
    text: nextText,
    ...(source.sourcePath !== undefined ? { sourcePath: source.sourcePath } : {})
  });
  if (!nextModel.parsed) return refusal(bundle, 'replacement-parse-failure');

  const projection = projectX4UiSourceBundle(bundle);
  const nextLuaFiles = projection.luaFiles.map((file, index) => index === source.index
    ? freezeObject({
      path: file.path,
      text: nextText,
      ...(file.sourcePath !== undefined ? { sourcePath: file.sourcePath } : {})
    })
    : file);
  const nextBundle = buildX4UiSourceBundle({
    uiXml: projection.uiXml,
    luaFiles: freezeArray(nextLuaFiles)
  });
  return freezeObject({ accepted: true, bundle: nextBundle, reason: null });
}

export const applyX4UiSourceSplice = spliceX4UiSourceBundle;
export const applyX4UiSourceEdit = spliceX4UiSourceBundle;
