/**
 * Pure, source-canonical scalar edit authority for the X4 UI editor.
 *
 * This module deliberately owns neither parsing nor workspace persistence.  It
 * only catalogs values already proven by the call model/layout program and
 * delegates the one source mutation to the existing workspace CAS owner.
 */

import type { ModWorkspace } from '../types';
import {
  createX4UiLayoutTargetCatalog,
  isIssuedX4UiLayoutEvidencePair,
  isIssuedX4UiLayoutEvidencePairForModel,
  projectX4UiLayoutProgram,
  validateX4UiLayoutEvidencePair,
  type X4UiLayoutEvidenceAuthority,
  type X4UiLayoutEvidenceCall,
  type X4UiLayoutEvidenceOperation,
  type X4UiLayoutEvidenceSourceBinding,
  type X4UiLayoutModelIdentity,
  type X4UiLayoutOperation,
  type X4UiLayoutProgram,
  type X4UiLayoutTarget,
  type X4UiLayoutTargetSelector,
} from './x4UiLayoutProgram';
import type {
  X4UiCallModel,
  X4UiCallRecord,
  X4UiCallSemantics,
  X4UiRelevantCallName,
  X4UiSourceLocation,
  X4UiValue,
} from './x4UiCallModel';
import type {
  X4UiSourceFile,
  X4UiSourceRegistration,
} from './x4UiSourceBundle';
import {
  buildX4UiWorkspaceSource,
  isIssuedX4UiWorkspaceSourcePair,
  NOT_VERIFIED_IN_GAME,
  spliceX4UiWorkspaceSource,
  type X4UiWorkspaceSource,
  type X4UiWorkspaceSourceRecord,
} from './x4UiWorkspaceSource';

export type X4UiSourceEditScalar = string | number | boolean;
export type X4UiSourceEditScalarType = 'number' | 'string' | 'boolean';
export type X4UiSourceEditQuoteStyle = 'single' | 'double';

export type X4UiSourceEditLockReason =
  | 'source-unavailable'
  | 'source-locked'
  | 'generated-shadowed-source'
  | 'workspace-source-mismatch'
  | 'missing-source'
  | 'unregistered-source'
  | 'ambiguous-registration'
  | 'foreign-source-identity'
  | 'foreign-target-identity'
  | 'missing-location'
  | 'invalid-location'
  | 'source-literal-mismatch'
  | 'dynamic-value'
  | 'constant-folded-value'
  | 'aliased-value'
  | 'unsupported-value'
  | 'unsupported-string-style'
  | 'operation-not-applied'
  | 'unsupported-provenance'
  | 'provenance-drift';

export type X4UiSourceEditRefusalReason =
  | X4UiSourceEditLockReason
  | 'entry-not-found'
  | 'entry-not-editable'
  | 'invalid-request'
  | 'invalid-replacement'
  | 'unsupported-number-replacement'
  | 'stale-expected-text'
  | 'stale-range'
  | 'foreign-entry'
  | 'replacement-parse-failure'
  | 'reparse-failure'
  | 'reparse-provenance-drift'
  | 'byte-locality-failure'
  | 'source-record-drift'
  | 'source-cas-refusal';

export interface X4UiSourceEditProvenance {
  readonly sourceIdentity: X4UiLayoutModelIdentity;
  readonly targetId: string;
  readonly targetSource: X4UiSourceLocation;
  readonly operationId: string;
  readonly callName: X4UiRelevantCallName;
  readonly callSource: X4UiSourceLocation;
  readonly callOrder: number;
  readonly fields: readonly string[];
}

export interface X4UiEditableSourceEditEntry {
  readonly kind: 'editable';
  readonly id: string;
  readonly path: string;
  readonly valueType: X4UiSourceEditScalarType;
  readonly value: X4UiSourceEditScalar;
  readonly expression: string;
  readonly expectedText: string;
  readonly startOffset: number;
  readonly endOffset: number;
  readonly source: X4UiSourceLocation;
  readonly sourceLiteral: X4UiSourceLocation;
  readonly quoteStyle?: X4UiSourceEditQuoteStyle;
  readonly provenance: X4UiSourceEditProvenance;
}

export interface X4UiLockedSourceEditEntry {
  readonly kind: 'locked';
  readonly id: string;
  readonly path?: string;
  readonly valueType: X4UiSourceEditScalarType | 'unknown';
  readonly value?: X4UiSourceEditScalar;
  readonly expression?: string;
  readonly source?: X4UiSourceLocation;
  readonly sourceLiteral?: X4UiSourceLocation;
  readonly expectedText?: string;
  readonly startOffset?: number;
  readonly endOffset?: number;
  readonly field: string;
  readonly operationId?: string;
  readonly callName?: X4UiRelevantCallName;
  readonly reason: X4UiSourceEditLockReason;
  readonly detail: string;
}

export type X4UiSourceEditCatalogEntry =
  | X4UiEditableSourceEditEntry
  | X4UiLockedSourceEditEntry;

export interface X4UiSourceEditCatalog {
  readonly status: 'ready' | 'locked';
  readonly sourceIdentity: X4UiLayoutModelIdentity;
  readonly target: X4UiLayoutTarget;
  readonly sourcePath: string;
  readonly sourceText?: string;
  readonly entries: readonly X4UiSourceEditCatalogEntry[];
  readonly editableEntries: readonly X4UiEditableSourceEditEntry[];
  readonly lockedEntries: readonly X4UiLockedSourceEditEntry[];
  readonly editable: boolean;
  readonly reason?: X4UiSourceEditLockReason;
  readonly detail: string;
  readonly verification: typeof NOT_VERIFIED_IN_GAME;
}

interface X4UiSourceEditTrustedContext {
  readonly workspace: ModWorkspace;
  readonly source: X4UiWorkspaceSource;
  readonly program: X4UiLayoutProgram;
  readonly evidenceAuthority: X4UiLayoutEvidenceAuthority;
}

export interface X4UiSourceEditExpectedRange {
  readonly path: string;
  readonly startOffset: number;
  readonly endOffset: number;
  readonly expectedText: string;
}

export type X4UiSourceEditEncodedReplacement =
  | { readonly ok: true; readonly replacement: string }
  | { readonly ok: false; readonly reason: X4UiSourceEditRefusalReason; readonly detail: string };

export interface X4UiAcceptedSourceEditResult {
  readonly accepted: true;
  readonly changed: boolean;
  readonly workspace: ModWorkspace;
  readonly source: X4UiWorkspaceSource;
  readonly catalog: X4UiSourceEditCatalog;
  readonly entry: X4UiEditableSourceEditEntry;
  readonly path: string;
  readonly startOffset: number;
  readonly endOffset: number;
  readonly expectedText: string;
  readonly replacement: string;
  readonly byteLocal: true;
  readonly reparsed: boolean;
  readonly provenanceReestablished: true;
}

export interface X4UiRefusedSourceEditResult {
  readonly accepted: false;
  readonly changed: false;
  readonly workspace: ModWorkspace;
  readonly source: X4UiWorkspaceSource;
  readonly catalog: X4UiSourceEditCatalog;
  readonly reason: X4UiSourceEditRefusalReason;
  readonly detail: string;
  readonly entry?: X4UiSourceEditCatalogEntry;
}

export type X4UiSourceEditResult =
  | X4UiAcceptedSourceEditResult
  | X4UiRefusedSourceEditResult;

type WorkspacePassthroughFile = NonNullable<ModWorkspace['passthroughFiles']>[number];

interface SourceSelection {
  readonly file: X4UiSourceFile;
  readonly registration: X4UiSourceRegistration;
  readonly workspaceIndex: number;
}

interface SelectionFailure {
  readonly reason: X4UiSourceEditLockReason;
  readonly detail: string;
}

interface ReparseFailure {
  readonly reason: 'reparse-failure' | 'reparse-provenance-drift';
  readonly detail: string;
}

interface RawValueReference {
  readonly value: X4UiValue;
  readonly field: string;
  readonly expectedType?: X4UiSourceEditScalarType;
}

interface Candidate {
  readonly operation: X4UiLayoutOperation;
  readonly call: X4UiCallRecord;
  readonly value: X4UiValue;
  readonly fields: readonly string[];
  readonly expectedTypes: readonly X4UiSourceEditScalarType[];
}

interface ReparseProof {
  readonly source: X4UiWorkspaceSource;
  readonly workspace: ModWorkspace;
  readonly program: X4UiLayoutProgram;
  readonly catalog: X4UiSourceEditCatalog;
  readonly entry: X4UiEditableSourceEditEntry;
}

interface X4UiSourceEditAuthority {
  readonly workspace: ModWorkspace;
  readonly source: X4UiWorkspaceSource;
  readonly program: X4UiLayoutProgram;
  readonly evidenceAuthority: X4UiLayoutEvidenceAuthority;
  readonly entries: ReadonlyMap<string, X4UiSourceEditCatalogEntry>;
  readonly entrySequence: readonly X4UiSourceEditCatalogEntry[];
}

const catalogAuthorities = new WeakMap<object, X4UiSourceEditAuthority>();
const entryAuthorities = new WeakMap<object, X4UiSourceEditAuthority>();

const CLOSED_MODEL_ERROR = 'source edit layout model must be closed plain own data';
const DUPLICATE_MODEL_ERROR = 'source edit layout model contains duplicate call/evidence';

const freezeDeep = <T>(value: T, seen = new WeakSet<object>()): T => {
  if (value === null || typeof value !== 'object') return value;
  const objectValue = value as object;
  if (seen.has(objectValue)) return value;
  seen.add(objectValue);
  for (const child of Object.values(value as Record<string, unknown>)) freezeDeep(child, seen);
  Object.freeze(objectValue);
  return value;
};

const freezeArray = <T>(value: readonly T[]): readonly T[] => Object.freeze([...value]);

const FALLBACK_WORKSPACE: ModWorkspace = freezeDeep({
  id: 'x4-ui-source-edit-refusal',
  name: 'X4 UI source edit refusal',
  version: '0.0.0',
  author: 'X4 Forge',
  description: 'Deterministic non-mutating public-boundary refusal',
  nodes: [],
  links: [],
  uiWidgets: [],
  uiTheme: {
    backgroundColor: '#000000',
    borderColor: '#000000',
    accentColor: '#000000',
    opacity: 1,
    showIcons: false,
  },
  compileSettings: {
    md: false,
    ui: false,
    ai: false,
    library: false,
    translations: false,
    patches: false,
  },
  passthroughFiles: [],
});

const FALLBACK_SOURCE = freezeDeep(buildX4UiWorkspaceSource(FALLBACK_WORKSPACE));
const FALLBACK_IDENTITY: X4UiLayoutModelIdentity = freezeDeep({
  file: '[locked-source-edit-boundary]',
  sha256: '0'.repeat(64),
});
const FALLBACK_LOCATION: X4UiSourceLocation = freezeDeep({
  file: FALLBACK_IDENTITY.file,
  start: { line: 1, column: 0, offset: 0 },
  end: { line: 1, column: 0, offset: 0 },
});
const FALLBACK_TARGET: X4UiLayoutTarget = freezeDeep({
  id: 'x4-ui-source-edit:locked-boundary',
  kind: 'top-level',
  source: FALLBACK_LOCATION,
  sourceIdentity: FALLBACK_IDENTITY,
});

const sameOptionalString = (left: string | undefined, right: string | undefined): boolean => left === right;

const locationKey = (location: X4UiSourceLocation): string => [
  location.file,
  location.sourcePath || '',
  location.start.line,
  location.start.column,
  location.start.offset,
  location.end.line,
  location.end.column,
  location.end.offset,
].join('|');

const sameLocation = (left: X4UiSourceLocation | undefined, right: X4UiSourceLocation | undefined): boolean =>
  Boolean(left && right)
  && left!.file === right!.file
  && sameOptionalString(left!.sourcePath, right!.sourcePath)
  && left!.start.line === right!.start.line
  && left!.start.column === right!.start.column
  && left!.start.offset === right!.start.offset
  && left!.end.line === right!.end.line
  && left!.end.column === right!.end.column
  && left!.end.offset === right!.end.offset;

const sameIdentity = (left: X4UiLayoutModelIdentity, right: X4UiLayoutModelIdentity): boolean =>
  left.file === right.file
  && sameOptionalString(left.sourcePath, right.sourcePath)
  && left.sha256 === right.sha256;

const isScalarType = (value: string | undefined): value is X4UiSourceEditScalarType =>
  value === 'number' || value === 'string' || value === 'boolean';

const scalarTypeOf = (value: X4UiValue | undefined): X4UiSourceEditScalarType | undefined =>
  value && isScalarType(value.type) ? value.type : undefined;

const scalarValueOf = (value: X4UiValue | undefined): X4UiSourceEditScalar | undefined => {
  if (!value || value.status !== 'static' || !isScalarType(value.type)) return undefined;
  if (value.type === 'number') return typeof value.value === 'number' && Number.isFinite(value.value) ? value.value : undefined;
  if (value.type === 'string') return typeof value.value === 'string' ? value.value : undefined;
  return typeof value.value === 'boolean' ? value.value : undefined;
};

const validOffset = (value: number): boolean => Number.isInteger(value) && value >= 0;

const validLocation = (location: X4UiSourceLocation | undefined, text: string): boolean => Boolean(
  location
  && validOffset(location.start.offset)
  && validOffset(location.end.offset)
  && location.start.offset <= location.end.offset
  && location.end.offset <= text.length
  && Number.isInteger(location.start.line)
  && Number.isInteger(location.start.column)
  && Number.isInteger(location.end.line)
  && Number.isInteger(location.end.column),
);

const sourceIdentityMatchesLocation = (
  identity: X4UiLayoutModelIdentity,
  location: X4UiSourceLocation,
): boolean => location.file === identity.file && sameOptionalString(location.sourcePath, identity.sourcePath);

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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const ownData = (value: object, key: string): unknown => {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor && 'value' in descriptor ? descriptor.value : undefined;
};

const parserOwnedOptionalUndefined = (parent: object, key: string): boolean => {
  const recordType = ownData(parent, 'recordType');
  const status = ownData(parent, 'status');
  const type = ownData(parent, 'type');
  const expression = ownData(parent, 'expression');
  const location = ownData(parent, 'location');
  if (key === 'sourcePath') {
    return (typeof ownData(parent, 'file') === 'string'
        && isRecord(ownData(parent, 'start'))
        && isRecord(ownData(parent, 'end')))
      || (typeof ownData(parent, 'rel') === 'string'
        && typeof ownData(parent, 'text') === 'string');
  }
  if (status === 'static' || status === 'dynamic' || status === 'unknown') {
    return typeof type === 'string'
      && typeof expression === 'string'
      && isRecord(location)
      && ['reason', 'symbol', 'reference', 'parameter', 'localInvocationResult', 'sourceLiteral'].includes(key);
  }
  if (typeof ownData(parent, 'kind') === 'string'
    && typeof ownData(parent, 'path') === 'string'
    && typeof ownData(parent, 'origin') === 'string'
    && isRecord(ownData(parent, 'source'))) {
    return ['parentPath', 'relatedPath', 'index', 'helperAliasSource', 'helperRuntimeAvailability'].includes(key);
  }
  if (recordType === 'call') return ['receiver', 'result', 'assignedTo'].includes(key);
  return false;
};

const isClosedPlainOwnData = (
  value: unknown,
  ancestors = new Set<object>(),
  parent?: object,
  key?: string,
  arrayElement = false,
): boolean => {
  if (value === null) return true;
  if (value === undefined) {
    return !arrayElement && parent !== undefined && key !== undefined && parserOwnedOptionalUndefined(parent, key);
  }
  if (typeof value !== 'object') {
    return typeof value === 'string'
      || (typeof value === 'number' && Number.isFinite(value))
      || typeof value === 'boolean';
  }
  const objectValue = value as object;
  if (ancestors.has(objectValue)) return false;
  try {
    const nextAncestors = new Set(ancestors);
    nextAncestors.add(objectValue);
    if (Array.isArray(value)) {
      if (Object.getPrototypeOf(value) !== Array.prototype || Object.getOwnPropertySymbols(value).length > 0) return false;
      const arrayLength = value.length;
      for (const key of Object.getOwnPropertyNames(value)) {
        if (key === 'length') continue;
        if (!/^(0|[1-9][0-9]*)$/.test(key)) return false;
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) return false;
      }
      for (let index = 0; index < arrayLength; index += 1) {
        if (!Object.prototype.hasOwnProperty.call(value, index)) return false;
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) return false;
        if (!isClosedPlainOwnData(descriptor.value, nextAncestors, value, String(index), true)) return false;
      }
      return true;
    }
    if (Object.getPrototypeOf(value) !== Object.prototype || Object.getOwnPropertySymbols(value).length > 0) return false;
    for (const key of Object.getOwnPropertyNames(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) return false;
      if (!isClosedPlainOwnData(descriptor.value, nextAncestors, value, key)) return false;
    }
    return true;
  } catch {
    return false;
  }
};

const removeUndefined = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(item => removeUndefined(item));
  if (!isRecord(value)) return value;
  const result: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (child !== undefined) result[key] = removeUndefined(child);
  }
  return result;
};

const isCallModel = (value: unknown): value is X4UiCallModel => {
  if (!isRecord(value) || value.parsed !== true || !isRecord(value.file)) return false;
  return typeof value.file.rel === 'string'
    && typeof value.file.text === 'string'
    && Array.isArray(value.calls)
    && Array.isArray(value.records)
    && Array.isArray(value.verificationGaps);
};

const hasDuplicateCallEvidence = (model: X4UiCallModel): boolean => {
  const callKeys = new Set<string>();
  for (const call of model.calls) {
    if (!isRecord(call) || typeof call.name !== 'string' || !isLocationRecord(call.source)) return true;
    const key = `${call.name}|${locationKey(call.source)}`;
    if (callKeys.has(key)) return true;
    callKeys.add(key);
  }
  for (const values of [model.calls, model.records]) {
    const references = new Set<object>();
    for (const value of values) {
      if (!isRecord(value)) continue;
      if (references.has(value)) return true;
      references.add(value);
    }
  }
  return false;
};

const isLocationRecord = (value: unknown): value is X4UiSourceLocation => {
  if (!isRecord(value)) return false;
  const start = value.start;
  const end = value.end;
  if (!isRecord(start) || !isRecord(end)) return false;
  return typeof value.file === 'string'
    && (value.sourcePath === undefined || typeof value.sourcePath === 'string')
    && typeof start.line === 'number'
    && typeof start.column === 'number'
    && typeof start.offset === 'number'
    && typeof end.line === 'number'
    && typeof end.column === 'number'
    && typeof end.offset === 'number';
};

const isX4UiValue = (value: unknown): value is X4UiValue => Boolean(
  isRecord(value)
  && (value.status === 'static' || value.status === 'dynamic' || value.status === 'unknown')
  && typeof value.type === 'string'
  && typeof value.expression === 'string'
  && isLocationRecord(value.location),
);

const sameNormalizedLocation = (left: unknown, right: unknown): boolean => {
  if (!isLocationRecord(left) || !isLocationRecord(right)) return false;
  return left.file === right.file
    && left.sourcePath === right.sourcePath
    && left.start.line === right.start.line
    && left.start.column === right.start.column
    && left.start.offset === right.start.offset
    && left.end.line === right.end.line
    && left.end.column === right.end.column
    && left.end.offset === right.end.offset;
};

const isAliasedScalarValue = (value: Record<string, unknown>): boolean => {
  const expression = value.expression;
  return value.status === 'static'
    && (value.type === 'number' || value.type === 'string' || value.type === 'boolean')
    && typeof expression === 'string'
    && /^[A-Za-z_][A-Za-z0-9_]*$/.test(expression)
    && isLocationRecord(value.location)
    && isLocationRecord(value.sourceLiteral)
    && !sameNormalizedLocation(value.location, value.sourceLiteral);
};

/**
 * Remove explicit undefined optional location fields and hide only the
 * sourceLiteral on identifier aliases before the existing JSON evidence owner
 * runs. The raw call model remains authoritative for edit locking; this
 * normalization only lets the layout owner project an otherwise valid alias.
 */
export const normalizeX4UiSourceEditLayoutModel = (model: X4UiCallModel): X4UiCallModel => {
  if (!isClosedPlainOwnData(model)) throw new Error(CLOSED_MODEL_ERROR);
  if (!isCallModel(model)) throw new Error(CLOSED_MODEL_ERROR);
  if (hasDuplicateCallEvidence(model)) throw new Error(DUPLICATE_MODEL_ERROR);
  const withoutUndefined = removeUndefined(model);
  const normalized = normalizeAliasedLayoutEvidence(withoutUndefined);
  if (!isCallModel(normalized) || !isClosedPlainOwnData(normalized)) throw new Error(CLOSED_MODEL_ERROR);
  return normalized;
};

const normalizeAliasedLayoutEvidence = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(item => normalizeAliasedLayoutEvidence(item));
  if (!isRecord(value)) return value;
  const aliased = isAliasedScalarValue(value);
  const result: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (aliased && key === 'sourceLiteral') continue;
    result[key] = normalizeAliasedLayoutEvidence(child);
  }
  return result;
};

const layoutModel = normalizeX4UiSourceEditLayoutModel;

const sameRecord = (
  left: WorkspacePassthroughFile | undefined,
  right: X4UiWorkspaceSourceRecord | undefined,
): boolean => Boolean(
  left
  && right
  && left.path === right.path
  && left.content === right.content
  && left.reason === right.reason
  && left.omitted === right.omitted
  && left.bytes === right.bytes,
);

const workspaceSnapshotMatches = (workspace: ModWorkspace, source: X4UiWorkspaceSource): boolean => {
  const current = Array.isArray(workspace.passthroughFiles) ? workspace.passthroughFiles : undefined;
  return Boolean(
    current
    && current.length === source.cas.passthroughFiles.length
    && source.cas.passthroughFiles.every((record, index) => sameRecord(current[index], record)),
  );
};

const locationWithin = (outer: X4UiSourceLocation, inner: X4UiSourceLocation): boolean =>
  outer.file === inner.file
  && sameOptionalString(outer.sourcePath, inner.sourcePath)
  && outer.start.offset <= inner.start.offset
  && outer.end.offset >= inner.end.offset;

const selectSource = (context: X4UiSourceEditTrustedContext): SourceSelection | SelectionFailure => {
  const { source, program, workspace } = context;
  if (!workspaceSnapshotMatches(workspace, source)) {
    return { reason: 'workspace-source-mismatch', detail: 'workspace passthrough records no longer match the source CAS snapshot' };
  }
  if (source.status === 'generated-shadowing-source') {
    return { reason: 'generated-shadowed-source', detail: 'generated UI output shadows the source-canonical workspace' };
  }
  if (source.status === 'unavailable') {
    return { reason: 'source-unavailable', detail: 'source-canonical UI workspace is unavailable' };
  }
  if (source.reason === 'duplicate-registered-lua' || source.reason === 'ambiguous-registered-lua') {
    return { reason: 'ambiguous-registration', detail: 'selected Lua source registration is duplicate or ambiguous' };
  }
  if (source.reason === 'no-registered-lua' || source.reason === 'missing-registered-lua') {
    return { reason: 'unregistered-source', detail: 'selected workspace Lua source is not uniquely registered by ui.xml' };
  }
  if (source.status !== 'source-owned' || source.bundle === null || source.projection === null) {
    return { reason: 'source-locked', detail: 'source-canonical UI workspace is locked' };
  }
  const identity = program.target.sourceIdentity;
  const candidates = source.bundle.sourceFiles.filter(file =>
    file.path === identity.file
    && sameOptionalString(file.callModel.file.sourcePath, identity.sourcePath),
  );
  if (candidates.length !== 1) {
    return { reason: 'foreign-source-identity', detail: 'selected layout source identity does not resolve to one workspace Lua source' };
  }
  const file = candidates[0];
  if (sha256(file.text) !== identity.sha256) {
    return { reason: 'foreign-source-identity', detail: 'selected layout source hash does not match the workspace Lua text' };
  }
  if (!sameIdentity(program.profile.source, identity)) {
    return { reason: 'foreign-source-identity', detail: 'layout profile and target carry different source identities' };
  }
  if (!sourceIdentityMatchesLocation(identity, program.target.source)) {
    return { reason: 'foreign-target-identity', detail: 'selected target range belongs to a different source identity' };
  }
  if (!validLocation(program.target.source, file.text) || !locationWithin({
    file: identity.file,
    ...(identity.sourcePath !== undefined ? { sourcePath: identity.sourcePath } : {}),
    start: { line: 1, column: 0, offset: 0 },
    end: program.target.source.end,
  }, program.target.source)) {
    return { reason: 'invalid-location', detail: 'selected target carries an invalid UTF-16 source range' };
  }
  if (!file.registered || file.unregistered) {
    return { reason: 'unregistered-source', detail: 'selected Lua source is not registered in authoritative ui.xml order' };
  }
  const registrationMatches = source.bundle.registrations.filter(registration =>
    registration.sourceIndex === file.index,
  );
  if (registrationMatches.length !== 1) {
    return { reason: 'ambiguous-registration', detail: 'selected Lua source does not have one unique registration' };
  }
  const registration = registrationMatches[0];
  if (registration.resolution !== 'resolved' || registration.locked || !file.editable) {
    return { reason: 'ambiguous-registration', detail: 'selected Lua registration is not uniquely editable' };
  }
  const binding = source.cas.luaBindings.find(candidate => candidate.bundleIndex === file.index);
  if (!binding || binding.workspaceIndex === null) {
    return { reason: 'missing-source', detail: 'selected Lua source has no mutable passthrough record' };
  }
  const projected = source.projection.luaFiles[file.index];
  if (!projected || projected.path !== file.path || projected.text !== file.text) {
    return { reason: 'provenance-drift', detail: 'workspace source projection does not match the selected bundle source' };
  }
  return { file, registration, workspaceIndex: binding.workspaceIndex };
};

const argumentExpectedType = (
  call: X4UiRelevantCallName,
  index: number,
): X4UiSourceEditScalarType | undefined => {
  switch (call) {
    case 'addTable': return index === 0 ? 'number' : undefined;
    case 'setColWidth': return index === 0 || index === 1 ? 'number' : index === 2 ? 'boolean' : undefined;
    case 'setColWidthPercent': return index === 0 || index === 1 ? 'number' : undefined;
    case 'setColSpan': return index === 0 ? 'number' : undefined;
    case 'setText':
    case 'setText2':
    case 'createText': return index === 0 ? 'string' : undefined;
    case 'OpenMenu': return index === 0 ? 'string' : undefined;
    case 'scaleX':
    case 'scaleY': return index === 0 ? 'number' : index === 1 ? 'boolean' : undefined;
    case 'scaleFont': return index === 0 ? 'string' : index === 1 ? 'number' : index === 2 ? 'boolean' : undefined;
    default: return undefined;
  }
};

const propertyExpectedType = (name: string): X4UiSourceEditScalarType | undefined => {
  const normalized = name.replace(/[-_\s]/g, '').toLowerCase();
  if (['width', 'height', 'x', 'y', 'fontsize', 'maxchars', 'paddingtop', 'paddingbottom'].includes(normalized)) return 'number';
  if (['scaling', 'active', 'affectrowheight', 'wordwrap', 'selecttextonactivation', 'interactive', 'fixed', 'borderbelow'].includes(normalized)) return 'boolean';
  if (['text', 'font', 'fontname', 'halign', 'alignment', 'description', 'defaulttext', 'icon'].includes(normalized)) return 'string';
  return undefined;
};

const addRaw = (
  values: RawValueReference[],
  value: X4UiValue | undefined,
  field: string,
  expectedType?: X4UiSourceEditScalarType,
): void => {
  if (value) values.push({ value, field, expectedType });
};

const callValues = (call: X4UiCallRecord): readonly RawValueReference[] => {
  const values: RawValueReference[] = [];
  call.arguments.forEach((value, index) => addRaw(values, value, `arguments[${index}]`, argumentExpectedType(call.name, index)));
  const semantics: X4UiCallSemantics = call.semantics;
  const scalarFields: readonly [keyof X4UiCallSemantics, X4UiSourceEditScalarType | undefined][] = [
    ['count', 'number'], ['index', 'number'], ['span', 'number'], ['width', 'number'], ['percentage', 'number'],
    ['height', 'number'], ['layer', 'number'], ['menu', 'string'], ['menuName', 'string'], ['frame', undefined],
    ['table', undefined], ['row', undefined], ['cell', undefined], ['dataFlow', undefined], ['text', 'string'],
    ['fontsize', 'number'], ['options', undefined], ['rowData', undefined], ['icon', 'string'], ['scaling', 'boolean'],
  ];
  for (const [field, expectedType] of scalarFields) {
    const value = semantics[field];
    if (isX4UiValue(value)) addRaw(values, value, `semantics.${String(field)}`, expectedType);
  }
  for (const property of semantics.properties || []) {
    addRaw(values, property.value, `semantics.properties.${property.name}`, propertyExpectedType(property.name));
  }
  for (const property of semantics.unsupportedProperties || []) {
    addRaw(values, property.value, `semantics.unsupportedProperties.${property.name}`, propertyExpectedType(property.name));
  }
  if (semantics.editBox) {
    addRaw(values, semantics.editBox.defaultText, 'semantics.editBox.defaultText', 'string');
    addRaw(values, semantics.editBox.description, 'semantics.editBox.description', 'string');
  }
  if (semantics.scale) {
    addRaw(values, semantics.scale.input, 'semantics.scale.input', 'number');
    addRaw(values, semantics.scale.fontname, 'semantics.scale.fontname', 'string');
    addRaw(values, semantics.scale.fontsize, 'semantics.scale.fontsize', 'number');
    addRaw(values, semantics.scale.enabled, 'semantics.scale.enabled', 'boolean');
  }
  return values;
};

const sameClosedData = (left: unknown, right: unknown): boolean => {
  if (Object.is(left, right)) return true;
  if (left === null || right === null || typeof left !== 'object' || typeof right !== 'object') return false;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left)
      && Array.isArray(right)
      && left.length === right.length
      && left.every((value, index) => sameClosedData(value, right[index]));
  }
  if (Object.getPrototypeOf(left) !== Object.prototype || Object.getPrototypeOf(right) !== Object.prototype) return false;
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  return leftKeys.length === rightKeys.length
    && leftKeys.every(key => Object.prototype.hasOwnProperty.call(right, key)
      && sameClosedData(ownData(left, key), ownData(right, key)));
};

const callMatchesEvidenceBinding = (
  call: X4UiCallRecord,
  operation: X4UiLayoutOperation,
  evidenceCall: X4UiLayoutEvidenceCall | undefined,
  evidenceOperation: X4UiLayoutEvidenceOperation | undefined,
  binding: X4UiLayoutEvidenceSourceBinding | undefined,
  index: number,
): boolean => {
  if (!evidenceCall
    || !evidenceOperation
    || !binding
    || evidenceCall.operationId !== operation.id
    || evidenceCall.kind !== operation.kind
    || evidenceCall.sourceOrder !== operation.sourceOrder
    || evidenceCall.modelOrder !== operation.modelOrder
    || evidenceCall.streamIndex !== index
    || evidenceCall.status !== operation.status
    || !sameLocation(evidenceCall.source, operation.source)
    || evidenceOperation.id !== operation.id
    || evidenceOperation.callId !== evidenceCall.id
    || evidenceOperation.kind !== operation.kind
    || evidenceOperation.sourceOrder !== operation.sourceOrder
    || evidenceOperation.modelOrder !== operation.modelOrder
    || evidenceOperation.streamIndex !== index
    || evidenceOperation.status !== operation.status
    || !sameLocation(evidenceOperation.source, operation.source)
    || binding.operationId !== operation.id
    || binding.callId !== evidenceCall.id
    || binding.kind !== call.name
    || binding.sourceOrder !== call.source.start.offset
    || binding.modelOrder !== call.order
    || binding.streamIndex !== index
    || binding.reachability !== evidenceCall.reachability
    || !sameLocation(binding.source, call.source)
    || !sameClosedData(evidenceOperation.snapshot, operation)) return false;
  const metadata = {
    arguments: call.arguments,
    ...(call.receiver !== undefined ? { receiver: call.receiver } : {}),
    ...(call.result !== undefined ? { result: call.result } : {}),
    semantics: call.semantics,
  };
  return sameClosedData(metadata, binding.metadata)
    && sameClosedData(operation.metadata, binding.metadata);
};

interface OrderedCallLedger {
  readonly byModelOrder: ReadonlyMap<number, { readonly call: X4UiCallRecord; readonly index: number }>;
}

const orderedCallLedger = (model: X4UiCallModel): OrderedCallLedger | undefined => {
  const byModelOrder = new Map<number, { readonly call: X4UiCallRecord; readonly index: number }>();
  let previousOrder = -1;
  for (let index = 0; index < model.calls.length; index += 1) {
    const call = model.calls[index];
    if (!Number.isInteger(call.order)
      || call.order <= previousOrder
      || byModelOrder.has(call.order)) return undefined;
    byModelOrder.set(call.order, { call, index });
    previousOrder = call.order;
  }
  return { byModelOrder };
};

const modelMatchesEvidenceAuthority = (
  model: X4UiCallModel,
  program: X4UiLayoutProgram,
  authority: X4UiLayoutEvidenceAuthority,
): boolean => {
  if (program.operations.length !== authority.calls.length
    || program.operations.length !== authority.operations.length
    || program.operations.length !== authority.sourceBindings.length) return false;
  const ledger = orderedCallLedger(model);
  if (!ledger) return false;
  let previousCallIndex = -1;
  for (let index = 0; index < program.operations.length; index += 1) {
    const operation = program.operations[index];
    const indexedCall = ledger.byModelOrder.get(operation.modelOrder);
    if (!indexedCall
      || indexedCall.index <= previousCallIndex
      || indexedCall.call.name !== operation.kind
      || !sameLocation(indexedCall.call.source, operation.source)
      || !callMatchesEvidenceBinding(
        indexedCall.call,
        operation,
        authority.calls[index],
        authority.operations[index],
        authority.sourceBindings[index],
        index,
      )) return false;
    previousCallIndex = indexedCall.index;
  }
  return true;
};

const candidateFor = (
  operation: X4UiLayoutOperation,
  call: X4UiCallRecord,
  references: readonly RawValueReference[],
): readonly Candidate[] => {
  const byLocation = new Map<string, { value: X4UiValue; fields: string[]; expectedTypes: X4UiSourceEditScalarType[] }>();
  for (const reference of references) {
    const key = locationKey(reference.value.location);
    const prior = byLocation.get(key);
    if (prior) {
      if (!prior.fields.includes(reference.field)) prior.fields.push(reference.field);
      if (reference.expectedType && !prior.expectedTypes.includes(reference.expectedType)) prior.expectedTypes.push(reference.expectedType);
    } else {
      byLocation.set(key, {
        value: reference.value,
        fields: [reference.field],
        expectedTypes: reference.expectedType ? [reference.expectedType] : [],
      });
    }
  }
  return [...byLocation.values()].map(value => ({
    operation,
    call,
    value: value.value,
    fields: freezeArray(value.fields),
    expectedTypes: freezeArray(value.expectedTypes),
  }));
};

const entryId = (target: X4UiLayoutTarget, operation: X4UiLayoutOperation, location: X4UiSourceLocation): string =>
  `x4-ui-source-edit:${target.id}:${operation.id}:${location.start.offset}:${location.end.offset}`;

const lockedId = (target: X4UiLayoutTarget, operationId: string, field: string, location?: X4UiSourceLocation): string =>
  `x4-ui-source-locked:${target.id}:${operationId}:${field}:${location ? locationKey(location) : 'missing'}`;

const reasonForValue = (value: X4UiValue): X4UiSourceEditLockReason => {
  if (value.sourceLiteral && !sameLocation(value.location, value.sourceLiteral)) return 'aliased-value';
  if (value.status === 'dynamic') return 'dynamic-value';
  if (value.status === 'unknown') return 'unsupported-value';
  if (!value.sourceLiteral) return 'constant-folded-value';
  return 'unsupported-value';
};

const quoteStyleOf = (raw: string): X4UiSourceEditQuoteStyle | undefined => {
  if (raw.length >= 2 && raw[0] === "'" && raw[raw.length - 1] === "'") return 'single';
  if (raw.length >= 2 && raw[0] === '"' && raw[raw.length - 1] === '"') return 'double';
  return undefined;
};

const lockedEntry = (
  target: X4UiLayoutTarget,
  path: string,
  candidate: Candidate | undefined,
  reason: X4UiSourceEditLockReason,
  detail: string,
): X4UiLockedSourceEditEntry => {
  const value = candidate?.value;
  const scalar = scalarValueOf(value);
  const source = value?.location;
  const sourceLiteral = value?.sourceLiteral;
  return freezeDeep({
    kind: 'locked',
    id: lockedId(target, candidate?.operation.id || 'catalog', candidate?.fields.join(',') || 'source', source),
    ...(path ? { path } : {}),
    valueType: scalarTypeOf(value) || candidate?.expectedTypes[0] || 'unknown',
    ...(scalar !== undefined ? { value: scalar } : {}),
    ...(value?.expression !== undefined ? { expression: value.expression } : {}),
    ...(source ? { source } : {}),
    ...(sourceLiteral ? { sourceLiteral } : {}),
    ...(sourceLiteral && validOffset(sourceLiteral.start.offset) && validOffset(sourceLiteral.end.offset)
      ? { startOffset: sourceLiteral.start.offset, endOffset: sourceLiteral.end.offset }
      : {}),
    field: candidate?.fields.join(',') || 'source',
    ...(candidate ? { operationId: candidate.operation.id, callName: candidate.call.name } : {}),
    reason,
    detail,
  });
};

const editableEntry = (
  target: X4UiLayoutTarget,
  identity: X4UiLayoutModelIdentity,
  path: string,
  text: string,
  candidate: Candidate,
): X4UiSourceEditCatalogEntry => {
  const value = candidate.value;
  const sourceLiteral = value.sourceLiteral;
  const valueType = scalarTypeOf(value);
  if (!sourceLiteral || !valueType) {
    return lockedEntry(target, path, candidate, reasonForValue(value), 'value lacks a directly editable scalar source literal');
  }
  if (!validLocation(sourceLiteral, text) || !sourceIdentityMatchesLocation(identity, sourceLiteral)) {
    return lockedEntry(target, path, candidate, 'invalid-location', 'source literal range is not valid for the selected source document');
  }
  if (!sameLocation(value.location, sourceLiteral)) {
    return lockedEntry(target, path, candidate, 'aliased-value', 'source literal belongs to an alias declaration rather than the selected call use site');
  }
  const expectedText = text.slice(sourceLiteral.start.offset, sourceLiteral.end.offset);
  if (expectedText !== value.expression) {
    return lockedEntry(target, path, candidate, 'source-literal-mismatch', 'value expression and sourceLiteral do not identify the same bytes');
  }
  if (value.status !== 'static') {
    return lockedEntry(target, path, candidate, reasonForValue(value), 'only static direct literal values are editable');
  }
  const scalar = scalarValueOf(value);
  if (scalar === undefined || candidate.expectedTypes.some(type => type !== valueType)) {
    return lockedEntry(target, path, candidate, 'unsupported-value', 'literal value type is not compatible with its selected call field');
  }
  if (candidate.operation.status !== 'applied') {
    return lockedEntry(target, path, candidate, 'operation-not-applied', 'the selected layout operation was not applied by the existing layout owner');
  }
  if (candidate.operation.localExpansion) {
    return lockedEntry(target, path, candidate, 'unsupported-provenance', 'expanded local-helper occurrences are not direct edit anchors');
  }
  const rawQuote = valueType === 'string' ? quoteStyleOf(expectedText) : undefined;
  if (valueType === 'string' && rawQuote === undefined) {
    return lockedEntry(target, path, candidate, 'unsupported-string-style', 'only existing single- or double-quoted Lua strings are editable');
  }
  const expressionStyle = valueType === 'boolean'
    ? expectedText === 'true' || expectedText === 'false'
    : valueType === 'number'
      ? Number.isFinite(scalar) && Number.isFinite(Number(expectedText))
      : true;
  if (!expressionStyle) {
    return lockedEntry(target, path, candidate, 'unsupported-value', 'source literal spelling is not a supported scalar literal');
  }
  const provenance: X4UiSourceEditProvenance = {
    sourceIdentity: identity,
    targetId: target.id,
    targetSource: target.source,
    operationId: candidate.operation.id,
    callName: candidate.call.name,
    callSource: candidate.call.source,
    callOrder: candidate.call.order,
    fields: candidate.fields,
  };
  return freezeDeep({
    kind: 'editable',
    id: entryId(target, candidate.operation, sourceLiteral),
    path,
    valueType,
    value: scalar,
    expression: value.expression,
    expectedText,
    startOffset: sourceLiteral.start.offset,
    endOffset: sourceLiteral.end.offset,
    source: value.location,
    sourceLiteral,
    ...(rawQuote ? { quoteStyle: rawQuote } : {}),
    provenance,
  });
};

const catalogFromEntries = (
  target: X4UiLayoutTarget,
  identity: X4UiLayoutModelIdentity,
  path: string,
  text: string | undefined,
  entries: readonly X4UiSourceEditCatalogEntry[],
  status: 'ready' | 'locked',
  detail: string,
  reason?: X4UiSourceEditLockReason,
): X4UiSourceEditCatalog => {
  const editableEntries = entries.filter((entry): entry is X4UiEditableSourceEditEntry => entry.kind === 'editable');
  const lockedEntries = entries.filter((entry): entry is X4UiLockedSourceEditEntry => entry.kind === 'locked');
  return freezeDeep({
    status,
    sourceIdentity: identity,
    target,
    sourcePath: path,
    ...(text === undefined ? {} : { sourceText: text }),
    entries: freezeArray(entries),
    editableEntries: freezeArray(editableEntries),
    lockedEntries: freezeArray(lockedEntries),
    editable: status === 'ready' && editableEntries.length > 0,
    ...(reason ? { reason } : {}),
    detail,
    verification: NOT_VERIFIED_IN_GAME,
  });
};

const validateIssuedEvidencePair = (
  program: X4UiLayoutProgram,
  evidenceAuthority: X4UiLayoutEvidenceAuthority,
): string | undefined => {
  try {
    const validation = validateX4UiLayoutEvidencePair(program, evidenceAuthority);
    if (validation.valid === false) {
      return `layout evidence pair refused: ${validation.reason}`;
    }
    return undefined;
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'layout evidence pair validation threw an unknown error';
    return `layout evidence pair validation was contained: ${detail}`;
  }
};

const lockedBoundaryCatalog = (
  detail: string,
  reason: X4UiSourceEditLockReason = 'unsupported-provenance',
): X4UiSourceEditCatalog => catalogFromEntries(
    FALLBACK_TARGET,
    FALLBACK_TARGET.sourceIdentity,
    FALLBACK_TARGET.sourceIdentity.file,
    undefined,
    [freezeDeep({
      kind: 'locked',
      id: lockedId(FALLBACK_TARGET, 'catalog', 'public-boundary'),
      path: FALLBACK_TARGET.sourceIdentity.file,
      valueType: 'unknown',
      field: 'public-boundary',
      reason,
      detail,
    })],
    'locked',
    detail,
    reason,
  );

const issueCatalog = (
  context: X4UiSourceEditTrustedContext,
  catalog: X4UiSourceEditCatalog,
): X4UiSourceEditCatalog => {
  const entries = new Map<string, X4UiSourceEditCatalogEntry>();
  for (const entry of catalog.entries) {
    if (entries.has(entry.id)) return catalog;
    entries.set(entry.id, entry);
  }
  const authority: X4UiSourceEditAuthority = {
    workspace: context.workspace,
    source: context.source,
    program: context.program,
    evidenceAuthority: context.evidenceAuthority,
    entries,
    entrySequence: catalog.entries,
  };
  catalogAuthorities.set(catalog, authority);
  for (const entry of catalog.entries) entryAuthorities.set(entry, authority);
  return catalog;
};

const prerequisiteCatalog = (
  context: X4UiSourceEditTrustedContext,
  failure: SelectionFailure,
): X4UiSourceEditCatalog => catalogFromEntries(
  context.program.target,
  context.program.target.sourceIdentity,
  context.program.target.sourceIdentity.file,
  undefined,
  [freezeDeep({
    kind: 'locked',
    id: lockedId(context.program.target, 'catalog', 'source'),
    path: context.program.target.sourceIdentity.file,
    valueType: 'unknown',
    field: 'source',
    reason: failure.reason,
    detail: failure.detail,
  })],
  'locked',
  failure.detail,
  failure.reason,
);

const callForOperation = (file: X4UiSourceFile, operation: X4UiLayoutOperation): X4UiCallRecord | undefined => {
  const call = orderedCallLedger(file.callModel)?.byModelOrder.get(operation.modelOrder)?.call;
  return call
    && call.name === operation.kind
    && sameLocation(call.source, operation.source)
    ? call
    : undefined;
};

const discoverX4UiSourceEditsUnsafe = (context: X4UiSourceEditTrustedContext): X4UiSourceEditCatalog => {
  try {
    const selection = selectSource(context);
    if ('reason' in selection) return issueCatalog(context, prerequisiteCatalog(context, selection));
    const { file } = selection;
    const normalizedModel = layoutModel(file.callModel);
    if (!isIssuedX4UiLayoutEvidencePairForModel(
      context.program,
      context.evidenceAuthority,
      normalizedModel,
    )) {
      return issueCatalog(context, prerequisiteCatalog(context, {
        reason: 'provenance-drift',
        detail: 'layout evidence pair was not issued for the canonical complete source call model',
      }));
    }
    if (context.program.status !== 'projected') {
      return issueCatalog(context, prerequisiteCatalog(context, {
        reason: 'operation-not-applied',
        detail: `layout program status ${context.program.status} is non-actionable; projected status is required`,
      }));
    }
    const evidenceFailure = validateIssuedEvidencePair(context.program, context.evidenceAuthority);
    if (evidenceFailure) {
      return issueCatalog(context, prerequisiteCatalog(context, {
        reason: 'unsupported-provenance',
        detail: evidenceFailure,
      }));
    }
    if (!modelMatchesEvidenceAuthority(normalizedModel, context.program, context.evidenceAuthority)) {
      return issueCatalog(context, prerequisiteCatalog(context, {
        reason: 'provenance-drift',
        detail: 'call-model operation metadata does not exactly match the owner-issued layout evidence binding',
      }));
    }
    const target = context.program.target;
    const entries: X4UiSourceEditCatalogEntry[] = [];
    const targetOperations = context.program.operations.filter(operation =>
      locationWithin(target.source, operation.source),
    );
    for (const operation of targetOperations) {
      const call = callForOperation(file, operation);
      if (!call) {
        entries.push(lockedEntry(target, file.path, undefined, 'provenance-drift', 'layout operation has no exact call-model source record'));
        continue;
      }
      const contextMatches = call.context.source ? sameLocation(call.context.source, target.source) : false;
      const candidates = candidateFor(operation, call, callValues(call));
      for (const candidate of candidates) {
        if (!contextMatches) {
          entries.push(lockedEntry(target, file.path, candidate, 'foreign-target-identity', 'call-model context is outside the selected layout target'));
          continue;
        }
        const entry = editableEntry(target, context.program.target.sourceIdentity, file.path, file.text, candidate);
        entries.push(entry);
      }
    }
    return issueCatalog(context, catalogFromEntries(
      target,
      context.program.target.sourceIdentity,
      file.path,
      file.text,
      entries,
      'ready',
      entries.some(entry => entry.kind === 'editable')
        ? 'direct source literals are available for bounded CAS editing'
        : 'selected source is valid but no direct editable scalar literal was proven',
    ));
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'source edit discovery failed with an unknown model error';
    return issueCatalog(context, prerequisiteCatalog(context, {
      reason: detail === DUPLICATE_MODEL_ERROR ? 'provenance-drift' : 'unsupported-provenance',
      detail,
    }));
  }
};

/** Discover editable and locked scalar source entries for one accepted target program. */
export function discoverX4UiSourceEdits(
  workspace: ModWorkspace,
  source: X4UiWorkspaceSource,
  program: X4UiLayoutProgram,
  evidenceAuthority: X4UiLayoutEvidenceAuthority,
): X4UiSourceEditCatalog {
  if (!isIssuedX4UiWorkspaceSourcePair(workspace, source)) {
    return lockedBoundaryCatalog('workspace/source pair was not issued by the workspace source owner');
  }
  if (!isIssuedX4UiLayoutEvidencePair(program, evidenceAuthority)) {
    return lockedBoundaryCatalog('program/evidence pair was not issued by the layout program owner');
  }
  const context: X4UiSourceEditTrustedContext = { workspace, source, program, evidenceAuthority };
  return discoverX4UiSourceEditsUnsafe(context);
}

export const buildX4UiSourceEditCatalog = discoverX4UiSourceEdits;
export const catalogX4UiSourceEdits = discoverX4UiSourceEdits;

const sameScalar = (left: X4UiSourceEditScalar, right: X4UiSourceEditScalar): boolean => left === right;

const encodeLuaString = (value: string, quote: "'" | '"'): string => {
  let output = quote;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    const char = value[index];
    if (char === '\\') output += '\\\\';
    else if (char === quote) output += `\\${quote}`;
    else if (char === '\n') output += '\\n';
    else if (char === '\r') output += '\\r';
    else if (char === '\t') output += '\\t';
    else if (char === '\b') output += '\\b';
    else if (char === '\f') output += '\\f';
    else if (char === '\u0007') output += '\\a';
    else if (char === '\u000b') output += '\\v';
    else if (code < 0x20 || code === 0x7f) output += `\\${code.toString(10).padStart(3, '0')}`;
    else output += char;
  }
  return `${output}${quote}`;
};

/** Pure field-aware Lua replacement encoding; it performs no source mutation or parsing. */
export const encodeX4UiSourceEditReplacement = (
  entry: X4UiEditableSourceEditEntry,
  value: X4UiSourceEditScalar,
): X4UiSourceEditEncodedReplacement => {
  if (typeof value === 'string' && entry.valueType === 'string') {
    const quote = entry.quoteStyle === 'single' ? "'" : entry.quoteStyle === 'double' ? '"' : undefined;
    if (!quote) return { ok: false, reason: 'unsupported-string-style', detail: 'selected string has no supported quote style' };
    return { ok: true, replacement: encodeLuaString(value, quote) };
  }
  if (typeof value === 'boolean' && entry.valueType === 'boolean') {
    return { ok: true, replacement: value ? 'true' : 'false' };
  }
  if (typeof value === 'number' && entry.valueType === 'number') {
    if (!Number.isFinite(value)) return { ok: false, reason: 'invalid-replacement', detail: 'number replacement must be finite' };
    if (value < 0 && !Object.is(value, -0)) {
      return { ok: false, reason: 'unsupported-number-replacement', detail: 'negative numeric replacements are not direct numeric literals in the existing call model' };
    }
    return { ok: true, replacement: Object.is(value, -0) ? '0' : String(value) };
  }
  return { ok: false, reason: 'invalid-replacement', detail: 'replacement type does not match the editable entry' };
};

const refusal = (
  workspace: ModWorkspace,
  source: X4UiWorkspaceSource,
  catalog: X4UiSourceEditCatalog,
  reason: X4UiSourceEditRefusalReason,
  detail: string,
  entry?: X4UiSourceEditCatalogEntry,
): X4UiRefusedSourceEditResult => Object.freeze({
  accepted: false,
  changed: false,
  workspace,
  source,
  catalog,
  reason,
  detail,
  ...(entry ? { entry } : {}),
});

const sameProjectedFile = (
  left: { readonly path: string; readonly text: string; readonly sourcePath?: string } | undefined,
  right: { readonly path: string; readonly text: string; readonly sourcePath?: string } | undefined,
): boolean => Boolean(
  left
  && right
  && left.path === right.path
  && left.text === right.text
  && left.sourcePath === right.sourcePath,
);

const byteLocality = (
  beforeWorkspace: ModWorkspace,
  afterWorkspace: ModWorkspace,
  beforeSource: X4UiWorkspaceSource,
  afterSource: X4UiWorkspaceSource,
  selection: SourceSelection,
  path: string,
  startOffset: number,
  endOffset: number,
  expectedText: string,
  replacement: string,
): boolean => {
  const beforeFiles = Array.isArray(beforeWorkspace.passthroughFiles) ? beforeWorkspace.passthroughFiles : [];
  const afterFiles = Array.isArray(afterWorkspace.passthroughFiles) ? afterWorkspace.passthroughFiles : [];
  if (beforeFiles.length !== afterFiles.length || afterWorkspace === beforeWorkspace) return false;
  let changedRecordCount = 0;
  for (let index = 0; index < beforeFiles.length; index += 1) {
    if (afterFiles[index] !== beforeFiles[index]) {
      changedRecordCount += 1;
      if (index !== selection.workspaceIndex) return false;
      if (afterFiles[index].path !== path || afterFiles[index].content !== undefined) {
        const expectedContent = typeof beforeFiles[index].content === 'string'
          ? beforeFiles[index].content.slice(0, startOffset) + replacement + beforeFiles[index].content.slice(endOffset)
          : undefined;
        if (afterFiles[index].content !== expectedContent) return false;
      }
    }
  }
  if (changedRecordCount !== 1) return false;
  const beforeProjection = beforeSource.projection;
  const afterProjection = afterSource.projection;
  if (!beforeProjection || !afterProjection || beforeProjection.uiXml !== afterProjection.uiXml) return false;
  if (beforeProjection.luaFiles.length !== afterProjection.luaFiles.length) return false;
  for (let index = 0; index < beforeProjection.luaFiles.length; index += 1) {
    const beforeFile = beforeProjection.luaFiles[index];
    const afterFile = afterProjection.luaFiles[index];
    if (index === selection.file.index) {
      if (!afterFile || afterFile.path !== path) return false;
      const expectedTextAfter = beforeFile.text.slice(0, startOffset) + replacement + beforeFile.text.slice(endOffset);
      if (afterFile.text !== expectedTextAfter) return false;
      if (beforeFile.text.slice(startOffset, endOffset) !== expectedText) return false;
    } else if (!sameProjectedFile(beforeFile, afterFile)) {
      return false;
    }
  }
  return true;
};

const nextTargetFor = (
  oldTarget: X4UiLayoutTarget,
  catalog: ReturnType<typeof createX4UiLayoutTargetCatalog>,
  literalStart: number,
  literalEnd: number,
): X4UiLayoutTarget | undefined => catalog.targets.find(target =>
  target.kind === oldTarget.kind
  && target.name === oldTarget.name
  && target.handler === oldTarget.handler
  && target.source.start.offset === oldTarget.source.start.offset
  && locationWithin(target.source, {
    file: oldTarget.source.file,
    ...(oldTarget.source.sourcePath !== undefined ? { sourcePath: oldTarget.source.sourcePath } : {}),
    start: { ...oldTarget.source.start, offset: literalStart },
    end: { ...oldTarget.source.end, offset: literalEnd },
  }),
);

const targetSelector = (target: X4UiLayoutTarget): X4UiLayoutTargetSelector => ({
  kind: target.kind,
  source: target.source,
  ...(target.name !== undefined ? { name: target.name } : {}),
  ...(target.handler !== undefined ? { handler: target.handler } : {}),
  id: target.id,
});

const nextOperationFor = (
  program: X4UiLayoutProgram,
  entry: X4UiEditableSourceEditEntry,
): X4UiLayoutOperation | undefined => {
  let match: X4UiLayoutOperation | undefined;
  for (const operation of program.operations) {
    if (operation.kind !== entry.provenance.callName
      || operation.source.file !== entry.provenance.callSource.file
      || !sameOptionalString(operation.source.sourcePath, entry.provenance.callSource.sourcePath)
      || operation.source.start.line !== entry.provenance.callSource.start.line
      || operation.source.start.column !== entry.provenance.callSource.start.column
      || operation.source.start.offset !== entry.provenance.callSource.start.offset
      || operation.modelOrder !== entry.provenance.callOrder
      || operation.status !== 'applied') continue;
    if (match) return undefined;
    match = operation;
  }
  return match;
};

const sameFields = (left: readonly string[], right: readonly string[]): boolean =>
  left.length === right.length && left.every((field, index) => field === right[index]);

const hasExactReparsedValue = (
  modelFile: X4UiSourceFile,
  operation: X4UiLayoutOperation,
  entry: X4UiEditableSourceEditEntry,
  replacement: string,
  startOffset: number,
  endOffset: number,
  value: X4UiSourceEditScalar,
): boolean => {
  const call = callForOperation(modelFile, operation);
  if (modelFile.path !== entry.path
    || !call
    || call.order !== entry.provenance.callOrder
    || !call.context.source
    || !locationWithin(operation.source, {
    file: entry.path,
    ...(entry.source.sourcePath !== undefined ? { sourcePath: entry.source.sourcePath } : {}),
    start: { ...entry.source.start, offset: startOffset },
    end: { ...entry.source.end, offset: endOffset },
  })) return false;
  return candidateFor(operation, call, callValues(call)).some(candidate => {
    const literal = candidate.value.sourceLiteral;
    const scalar = scalarValueOf(candidate.value);
    return sameFields(candidate.fields, entry.provenance.fields)
      && candidate.value.status === 'static'
      && scalar !== undefined
      && sameScalar(scalar, value)
      && candidate.value.expression === replacement
      && literal !== undefined
      && literal.start.offset === startOffset
      && literal.end.offset === endOffset
      && sameLocation(candidate.value.location, literal)
      && modelFile.text.slice(startOffset, endOffset) === replacement;
  });
};

const reparseAndProveUnsafe = (
  input: X4UiSourceEditTrustedContext,
  selection: SourceSelection,
  entry: X4UiEditableSourceEditEntry,
  replacement: string,
  startOffset: number,
  value: X4UiSourceEditScalar,
  nextWorkspace: ModWorkspace,
  nextSource: X4UiWorkspaceSource,
): ReparseProof | ReparseFailure => {
  if (nextSource.status !== 'source-owned' || !nextSource.bundle || !nextSource.projection) {
    return { reason: 'reparse-failure', detail: 'complete source reparse no longer produces source-owned UI authority' };
  }
  if (!nextSource.bundle.sourceFiles.every(file => file.parseStatus === 'parsed')) {
    return { reason: 'reparse-failure', detail: 'complete source reparse contains a locked Lua document' };
  }
  const nextFile = nextSource.bundle.sourceFiles.find(file => file.path === entry.path);
  if (!nextFile || nextFile.parseStatus !== 'parsed') {
    return { reason: 'reparse-failure', detail: 'edited Lua source is missing after complete reparse' };
  }
  const nextModel = layoutModel(nextFile.callModel);
  const reparsedEndOffset = startOffset + replacement.length;
  const nextIdentity: X4UiLayoutModelIdentity = {
    file: nextModel.file.rel,
    ...(nextModel.file.sourcePath !== undefined ? { sourcePath: nextModel.file.sourcePath } : {}),
    sha256: sha256(nextFile.text),
  };
  const nextTarget = nextTargetFor(
    input.program.target,
    createX4UiLayoutTargetCatalog(nextModel),
    startOffset,
    reparsedEndOffset,
  );
  if (!nextTarget || !sameIdentity(nextTarget.sourceIdentity, nextIdentity)) {
    return { reason: 'reparse-provenance-drift', detail: 'selected target provenance was not re-established after the edit' };
  }
  const nextProfile = { ...input.program.profile, source: nextIdentity };
  const nextProgramResult = projectX4UiLayoutProgram(
    nextModel,
    targetSelector(nextTarget),
    nextProfile,
  );
  if (nextProgramResult.status === 'refused' || !nextProgramResult.program) {
    return { reason: 'reparse-provenance-drift', detail: 'layout program refused the reparsed source or lost selected provenance' };
  }
  const nextOperation = nextOperationFor(nextProgramResult.program, entry);
  if (!nextOperation || !hasExactReparsedValue(nextFile, nextOperation, entry, replacement, startOffset, reparsedEndOffset, value)) {
    return { reason: 'reparse-provenance-drift', detail: 'selected call/value provenance did not survive complete reparse' };
  }
  const nextCatalog = discoverX4UiSourceEdits(
    nextWorkspace,
    nextSource,
    nextProgramResult.program,
    nextProgramResult.evidenceAuthority,
  );
  const nextEntry = nextCatalog.editableEntries.find(candidate =>
    candidate.path === entry.path
    && candidate.startOffset === startOffset
    && candidate.endOffset === reparsedEndOffset
    && candidate.expectedText === replacement
    && candidate.valueType === entry.valueType
    && candidate.provenance.callName === entry.provenance.callName
    && candidate.provenance.callOrder === entry.provenance.callOrder
    && sameFields(candidate.provenance.fields, entry.provenance.fields),
  );
  if (!nextEntry) {
    return { reason: 'reparse-provenance-drift', detail: 'reparsed catalog did not retain the edited direct source literal' };
  }
  return {
    workspace: nextWorkspace,
    source: nextSource,
    program: nextProgramResult.program,
    catalog: nextCatalog,
    entry: nextEntry,
  };
};

const reparseAndProve = (
  input: X4UiSourceEditTrustedContext,
  selection: SourceSelection,
  entry: X4UiEditableSourceEditEntry,
  replacement: string,
  startOffset: number,
  value: X4UiSourceEditScalar,
  nextWorkspace: ModWorkspace,
  nextSource: X4UiWorkspaceSource,
): ReparseProof | ReparseFailure => {
  try {
    return reparseAndProveUnsafe(
      input,
      selection,
      entry,
      replacement,
      startOffset,
      value,
      nextWorkspace,
      nextSource,
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'complete source reparse failed with an unknown layout error';
    return { reason: 'reparse-failure', detail: `complete source reparse was contained: ${detail}` };
  }
};

const applyX4UiSourceEditUnsafe = (
  authority: X4UiSourceEditAuthority,
  catalog: X4UiSourceEditCatalog,
  entryIdValue: string,
  value: X4UiSourceEditScalar,
  expectedPath?: string,
  expectedStartOffset?: number,
  expectedEndOffset?: number,
  expectedText?: string,
): X4UiSourceEditResult => {
  try {
    if (!workspaceSnapshotMatches(authority.workspace, authority.source)) {
      return refusal(authority.workspace, authority.source, catalog, 'workspace-source-mismatch', 'workspace passthrough records no longer match the source CAS snapshot');
    }
    const selection = selectSource(authority);
    if ('reason' in selection) return refusal(authority.workspace, authority.source, catalog, selection.reason, selection.detail);
    const normalizedModel = layoutModel(selection.file.callModel);
    if (!isIssuedX4UiLayoutEvidencePairForModel(
      authority.program,
      authority.evidenceAuthority,
      normalizedModel,
    )) {
      return refusal(
        authority.workspace,
        authority.source,
        catalog,
        'unsupported-provenance',
        'catalog layout authority does not match the canonical complete source call model',
      );
    }
    if (!modelMatchesEvidenceAuthority(normalizedModel, authority.program, authority.evidenceAuthority)) {
      return refusal(
        authority.workspace,
        authority.source,
        catalog,
        'unsupported-provenance',
        'catalog layout authority does not exactly match canonical call/evidence correspondence',
      );
    }
    if (!Array.isArray(catalog.entries)
      || catalog.entries.length !== authority.entrySequence.length
      || catalog.entries.some((entry, index) => entry !== authority.entrySequence[index])) {
      return refusal(authority.workspace, authority.source, catalog, 'foreign-entry', 'source edit catalog entries are not the exact owner-issued entries');
    }

  if (catalog.status !== 'ready') {
    return refusal(authority.workspace, authority.source, catalog, catalog.reason || 'source-locked', catalog.detail);
  }
  if (!sameIdentity(catalog.sourceIdentity, authority.program.target.sourceIdentity)) {
    return refusal(authority.workspace, authority.source, catalog, 'foreign-source-identity', 'catalog source identity differs from the selected program');
  }
  if (catalog.target.id !== authority.program.target.id) {
    return refusal(authority.workspace, authority.source, catalog, 'foreign-target-identity', 'catalog target identity differs from the selected program');
  }
  const entry = authority.entries.get(entryIdValue);
  if (!entry) return refusal(authority.workspace, authority.source, catalog, 'entry-not-found', 'requested source edit entry is not in the catalog');
  if (entryAuthorities.get(entry) !== authority) {
    return refusal(authority.workspace, authority.source, catalog, 'foreign-entry', 'selected source edit entry is not the exact owner-issued entry', entry);
  }
  if (entry.kind !== 'editable') return refusal(authority.workspace, authority.source, catalog, entry.reason, entry.detail, entry);
  if (entry.path !== selection.file.path || entry.provenance.targetId !== authority.program.target.id) {
    return refusal(authority.workspace, authority.source, catalog, 'foreign-entry', 'editable entry does not belong to the selected source and target', entry);
  }
  if (sha256(selection.file.text) !== entry.provenance.sourceIdentity.sha256
    || !sameIdentity(entry.provenance.sourceIdentity, authority.program.target.sourceIdentity)) {
    return refusal(authority.workspace, authority.source, catalog, 'foreign-source-identity', 'editable entry source identity is stale or foreign', entry);
  }
  if (!validLocation(entry.sourceLiteral, selection.file.text)) {
    return refusal(authority.workspace, authority.source, catalog, 'invalid-location', 'editable entry range is not valid for the current source text', entry);
  }
  const currentText = selection.file.text.slice(entry.startOffset, entry.endOffset);
  if (currentText !== entry.expectedText) {
    return refusal(authority.workspace, authority.source, catalog, 'stale-expected-text', 'editable entry expected text is stale', entry);
  }
  if (expectedPath !== undefined && expectedPath !== entry.path) {
    return refusal(authority.workspace, authority.source, catalog, 'stale-range', 'expected path does not match the issued catalog entry', entry);
  }
  if (expectedStartOffset !== undefined && expectedStartOffset !== entry.startOffset) {
    return refusal(authority.workspace, authority.source, catalog, 'stale-range', 'expected start offset does not match the issued catalog entry', entry);
  }
  if (expectedEndOffset !== undefined && expectedEndOffset !== entry.endOffset) {
    return refusal(authority.workspace, authority.source, catalog, 'stale-range', 'expected end offset does not match the issued catalog entry', entry);
  }
  if (expectedText !== undefined && expectedText !== entry.expectedText) {
    return refusal(authority.workspace, authority.source, catalog, 'stale-expected-text', 'expected text does not match the issued catalog entry', entry);
  }
  const encoded = encodeX4UiSourceEditReplacement(entry, value);
  if (encoded.ok === false) return refusal(authority.workspace, authority.source, catalog, encoded.reason, encoded.detail, entry);
  if (sameScalar(value, entry.value) || encoded.replacement === entry.expectedText) {
    return freezeDeep({
      accepted: true,
      changed: false,
      workspace: authority.workspace,
      source: authority.source,
      catalog,
      entry,
      path: entry.path,
      startOffset: entry.startOffset,
      endOffset: entry.endOffset,
      expectedText: entry.expectedText,
      replacement: entry.expectedText,
      byteLocal: true,
      reparsed: false,
      provenanceReestablished: true,
    });
  }
  const splice = spliceX4UiWorkspaceSource(authority.workspace, authority.source, {
    path: entry.path,
    startOffset: entry.startOffset,
    endOffset: entry.endOffset,
    expectedText: entry.expectedText,
    replacement: encoded.replacement,
  });
  if (!splice.accepted) {
    const refusalReason: X4UiSourceEditRefusalReason = splice.reason === 'replacement-parse-failure'
      ? 'replacement-parse-failure'
      : 'source-cas-refusal';
    return refusal(
      authority.workspace,
      authority.source,
      catalog,
      refusalReason,
      `workspace source CAS refused the edit: ${splice.reason || 'unknown refusal'}`,
      entry,
    );
  }
  if (!byteLocality(
    authority.workspace,
    splice.workspace,
    authority.source,
    splice.source,
    selection,
    entry.path,
    entry.startOffset,
    entry.endOffset,
    entry.expectedText,
    encoded.replacement,
  )) {
    return refusal(authority.workspace, authority.source, catalog, 'byte-locality-failure', 'accepted source splice changed more than the proven literal range', entry);
  }
  const proof = reparseAndProve(
    authority,
    selection,
    entry,
    encoded.replacement,
    entry.startOffset,
    value,
    splice.workspace,
    splice.source,
  );
  if ('reason' in proof) return refusal(authority.workspace, authority.source, catalog, proof.reason, proof.detail, entry);
  return freezeDeep({
    accepted: true,
    changed: true,
    workspace: proof.workspace,
    source: proof.source,
    catalog: proof.catalog,
    entry: proof.entry,
    path: entry.path,
    startOffset: entry.startOffset,
    endOffset: entry.endOffset,
    expectedText: entry.expectedText,
    replacement: encoded.replacement,
    byteLocal: true,
    reparsed: true,
    provenanceReestablished: true,
  });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'source edit failed with an unknown model or layout error';
    return refusal(authority.workspace, authority.source, catalog, 'unsupported-provenance', `source edit refusal was contained: ${detail}`);
  }
};

const scalarPrimitive = (value: unknown): value is X4UiSourceEditScalar =>
  typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';

const optionalStringPrimitive = (value: unknown): value is string | undefined =>
  value === undefined || typeof value === 'string';

const optionalOffsetPrimitive = (value: unknown): value is number | undefined =>
  value === undefined || (typeof value === 'number' && Number.isInteger(value) && value >= 0);

const safeRefusalWorkspace = (workspace: ModWorkspace): ModWorkspace =>
  workspace !== null && typeof workspace === 'object' ? workspace : FALLBACK_WORKSPACE;

const safeRefusalSource = (source: X4UiWorkspaceSource): X4UiWorkspaceSource =>
  source !== null && typeof source === 'object' ? source : FALLBACK_SOURCE;

const safeRefusalCatalog = (catalog: X4UiSourceEditCatalog): X4UiSourceEditCatalog =>
  catalog !== null && (typeof catalog === 'object' || typeof catalog === 'function')
    ? catalog
    : lockedBoundaryCatalog('catalog input is not an issued source-edit catalog');

/** Apply one typed scalar edit through the existing workspace source CAS owner. */
export function applyX4UiSourceEdit(
  workspace: ModWorkspace,
  source: X4UiWorkspaceSource,
  catalog: X4UiSourceEditCatalog,
  entryIdValue: string,
  value: X4UiSourceEditScalar,
  expectedPath?: string,
  expectedStartOffset?: number,
  expectedEndOffset?: number,
  expectedText?: string,
): X4UiSourceEditResult {
  const workspacePairIssued = isIssuedX4UiWorkspaceSourcePair(workspace, source);
  const catalogAuthority = catalog !== null && (typeof catalog === 'object' || typeof catalog === 'function')
    ? catalogAuthorities.get(catalog)
    : undefined;
  const refusalWorkspace = safeRefusalWorkspace(workspace);
  const refusalSource = safeRefusalSource(source);
  const refusalCatalog = safeRefusalCatalog(catalog);
  if (!workspacePairIssued) {
    return refusal(refusalWorkspace, refusalSource, refusalCatalog, 'workspace-source-mismatch', 'workspace/source pair was not issued by the workspace source owner');
  }
  if (!catalogAuthority) {
    return refusal(refusalWorkspace, refusalSource, refusalCatalog, 'unsupported-provenance', 'source edit catalog was not issued by source-edit discovery');
  }
  if (catalogAuthority.workspace !== workspace || catalogAuthority.source !== source) {
    return refusal(workspace, source, catalog, 'unsupported-provenance', 'source edit catalog belongs to a different issued workspace/source pair');
  }
  if (!isIssuedX4UiLayoutEvidencePair(catalogAuthority.program, catalogAuthority.evidenceAuthority)
    || catalogAuthority.program.status !== 'projected') {
    return refusal(workspace, source, catalog, 'unsupported-provenance', 'catalog layout authority is no longer an issued projected pair');
  }
  if (typeof entryIdValue !== 'string'
    || !scalarPrimitive(value)
    || !optionalStringPrimitive(expectedPath)
    || !optionalOffsetPrimitive(expectedStartOffset)
    || !optionalOffsetPrimitive(expectedEndOffset)
    || !optionalStringPrimitive(expectedText)) {
    return refusal(workspace, source, catalog, 'invalid-request', 'entry, value, and optional expected CAS inputs must be positional primitives');
  }
  return applyX4UiSourceEditUnsafe(
    catalogAuthority,
    catalog,
    entryIdValue,
    value,
    expectedPath,
    expectedStartOffset,
    expectedEndOffset,
    expectedText,
  );
}

export const applyX4UiSourceEditRequest = applyX4UiSourceEdit;
export const commitX4UiSourceEdit = applyX4UiSourceEdit;
