/**
 * Pure, source-canonical scalar edit authority for the X4 UI editor.
 *
 * This module deliberately owns neither parsing nor workspace persistence.  It
 * only catalogs values already proven by the call model/layout program and
 * delegates the one source mutation to the existing workspace CAS owner.
 */

import type { ModWorkspace } from '../types';
import {
  canonicalizeX4UiLayoutModel,
  createX4UiLayoutTargetCatalog,
  isExactX4UiLayoutColorValue,
  isIssuedX4UiLayoutEvidencePair,
  isIssuedX4UiLayoutEvidencePairForModel,
  reprojectX4UiLayoutProgramWithIssuedColorAuthority,
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
import {
  buildX4UiCallModel,
  type X4UiCallModel,
  type X4UiCallRecord,
  type X4UiCallSemantics,
  type X4UiRelevantCallName,
  type X4UiSourceLocation,
  type X4UiValue,
} from './x4UiCallModel';
import type {
  X4UiSourceFile,
  X4UiSourceRegistration,
} from './x4UiSourceBundle';
import { X4_LAYOUT_PROVENANCE } from './x4UiLayoutKernel';
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

export interface X4UiSourceEditStructuralCallBinding {
  readonly operationId: string;
  readonly callName: X4UiRelevantCallName;
  readonly callOrder: number;
  readonly callSource: X4UiSourceLocation;
}

export interface X4UiSourceEditStructuralOwner {
  readonly kind: 'table' | 'frame';
  readonly ownerId: string;
  readonly frameId?: string;
}

/** Exact row/table/frame chain owned by a row-local structural statement. */
export interface X4UiSourceEditStructuralRowOwner {
  readonly frameId: string;
  readonly tableId: string;
  readonly rowId: string;
}

export interface X4UiSourceEditStructuralProvenance {
  readonly sourceIdentity: X4UiLayoutModelIdentity;
  readonly targetId: string;
  readonly targetSource: X4UiSourceLocation;
  readonly statementSource: X4UiSourceLocation;
  readonly callBindings: readonly X4UiSourceEditStructuralCallBinding[];
  readonly owner?: X4UiSourceEditStructuralOwner;
  readonly rowOwner?: X4UiSourceEditStructuralRowOwner;
}

export interface X4UiSourceEditDeleteEntry {
  readonly kind: 'delete-statement';
  readonly id: string;
  readonly path: string;
  readonly startOffset: number;
  readonly endOffset: number;
  readonly expectedText: string;
  readonly statementSource: X4UiSourceLocation;
  readonly deletionSource: X4UiSourceLocation;
  readonly callBindings: readonly X4UiSourceEditStructuralCallBinding[];
  readonly provenance: X4UiSourceEditStructuralProvenance;
}

export interface X4UiSourceEditReplaceEntry {
  readonly kind: 'replace-statement';
  readonly id: string;
  readonly path: string;
  readonly startOffset: number;
  readonly endOffset: number;
  readonly expectedText: string;
  readonly statementSource: X4UiSourceLocation;
  readonly deletionSource: X4UiSourceLocation;
  /** Calls and operations removed by this atomic replacement. */
  readonly callBindings: readonly X4UiSourceEditStructuralCallBinding[];
  readonly provenance: X4UiSourceEditStructuralProvenance & {
    readonly owner: X4UiSourceEditStructuralOwner;
    readonly rowOwner: X4UiSourceEditStructuralRowOwner;
  };
}

export type X4UiSourceEditInsertionAnchor = 'first-row' | 'fallback-display' | 'frame-display';

export interface X4UiSourceEditInsertEntry {
  readonly kind: 'insert-call';
  readonly id: string;
  readonly path: string;
  readonly startOffset: number;
  readonly endOffset: number;
  readonly expectedText: '';
  readonly anchor: X4UiSourceEditInsertionAnchor;
  readonly anchorSource: X4UiSourceLocation;
  readonly indentation: string;
  readonly lineEnding: '\n' | '\r\n';
  readonly provenance: X4UiSourceEditStructuralProvenance;
}

export interface X4UiSourceEditInsertBlockEntry {
  readonly kind: 'insert-block';
  readonly id: string;
  readonly path: string;
  readonly startOffset: number;
  readonly endOffset: number;
  readonly expectedText: '';
  readonly anchor: 'frame-display';
  readonly anchorSource: X4UiSourceLocation;
  readonly indentation: string;
  readonly lineEnding: '\n' | '\r\n';
  readonly provenance: X4UiSourceEditStructuralProvenance;
}

export type X4UiSourceEditInsertionEntry = X4UiSourceEditInsertEntry | X4UiSourceEditInsertBlockEntry;

export type X4UiSourceEditStructuralEntry =
  | X4UiSourceEditDeleteEntry
  | X4UiSourceEditReplaceEntry
  | X4UiSourceEditInsertionEntry;

export interface X4UiSourceEditCatalog {
  readonly status: 'ready' | 'locked';
  readonly sourceIdentity: X4UiLayoutModelIdentity;
  readonly target: X4UiLayoutTarget;
  readonly sourcePath: string;
  readonly sourceText?: string;
  readonly entries: readonly X4UiSourceEditCatalogEntry[];
  readonly editableEntries: readonly X4UiEditableSourceEditEntry[];
  readonly lockedEntries: readonly X4UiLockedSourceEditEntry[];
  readonly structuralEntries?: readonly X4UiSourceEditStructuralEntry[];
  readonly deleteEntries?: readonly X4UiSourceEditDeleteEntry[];
  readonly replaceEntries?: readonly X4UiSourceEditReplaceEntry[];
  readonly insertEntries?: readonly X4UiSourceEditInsertionEntry[];
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
  readonly entry?: X4UiSourceEditCatalogEntry | X4UiSourceEditStructuralEntry;
}

export type X4UiSourceEditResult =
  | X4UiAcceptedSourceEditResult
  | X4UiRefusedSourceEditResult;

export interface X4UiAcceptedSourceStructuralEditResult {
  readonly accepted: true;
  readonly changed: true;
  readonly workspace: ModWorkspace;
  readonly source: X4UiWorkspaceSource;
  readonly catalog: X4UiSourceEditCatalog;
  readonly entry: X4UiSourceEditStructuralEntry;
  readonly path: string;
  readonly startOffset: number;
  readonly endOffset: number;
  readonly expectedText: '' | string;
  readonly replacement: string;
  readonly byteLocal: true;
  readonly reparsed: true;
  readonly provenanceReestablished: true;
}

export interface X4UiRefusedSourceStructuralEditResult {
  readonly accepted: false;
  readonly changed: false;
  readonly workspace: ModWorkspace;
  readonly source: X4UiWorkspaceSource;
  readonly catalog: X4UiSourceEditCatalog;
  readonly reason: X4UiSourceEditRefusalReason;
  readonly detail: string;
  readonly entry?: X4UiSourceEditStructuralEntry;
}

export type X4UiSourceStructuralEditResult =
  | X4UiAcceptedSourceStructuralEditResult
  | X4UiRefusedSourceStructuralEditResult;

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
  readonly structuralEntries: ReadonlyMap<string, X4UiSourceEditStructuralEntry>;
  readonly structuralSequence: readonly X4UiSourceEditStructuralEntry[];
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
  for (const key of Reflect.ownKeys(objectValue)) {
    const descriptor = Object.getOwnPropertyDescriptor(objectValue, key);
    if (descriptor && 'value' in descriptor) freezeDeep(descriptor.value, seen);
  }
  Object.freeze(objectValue);
  return value;
};

const cloneDataGraph = <T>(value: T, seen = new WeakMap<object, object>()): T => {
  if (typeof value === 'function') throw new Error('source edit authority graph contains a function');
  if (value === null || typeof value !== 'object') return value;
  const objectValue = value as unknown as object;
  const prior = seen.get(objectValue);
  if (prior) return prior as T;
  const clone = (Array.isArray(value)
    ? []
    : Object.create(Object.getPrototypeOf(objectValue))) as object;
  seen.set(objectValue, clone);
  for (const key of Reflect.ownKeys(objectValue)) {
    const descriptor = Object.getOwnPropertyDescriptor(objectValue, key);
    if (!descriptor) continue;
    if ('value' in descriptor) {
      Object.defineProperty(clone, key, {
        ...descriptor,
        value: cloneDataGraph(descriptor.value, seen),
      });
    } else {
      Object.defineProperty(clone, key, descriptor);
    }
  }
  return clone as T;
};

const hasUnsupportedAuthoritySurface = (value: unknown, seen = new WeakSet<object>()): boolean => {
  if (value === null || typeof value !== 'object') return typeof value === 'function';
  const objectValue = value as object;
  if (seen.has(objectValue)) return false;
  seen.add(objectValue);
  let prototype: object | null;
  try {
    prototype = Object.getPrototypeOf(objectValue);
  } catch {
    return true;
  }
  if (Array.isArray(objectValue)
    ? prototype !== Array.prototype
    : prototype !== Object.prototype && prototype !== null) {
    return true;
  }
  let keys: readonly (string | symbol)[];
  try {
    keys = Reflect.ownKeys(objectValue);
  } catch {
    return true;
  }
  for (const key of keys) {
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(objectValue, key);
    } catch {
      return true;
    }
    if (!descriptor || !('value' in descriptor) || hasUnsupportedAuthoritySurface(descriptor.value, seen)) {
      return true;
    }
  }
  return false;
};

const hasUnsafeAuthorityGraph = (
  ...values: readonly unknown[]
): boolean => {
  const seen = new WeakSet<object>();
  return values.some(value => hasUnsupportedAuthoritySurface(value, seen));
};

const freezeArray = <T>(value: readonly T[]): readonly T[] => Object.freeze([...value]);

const spliceInputBoundary = <T extends object>(value: T): T => Object.isFrozen(value)
  ? { ...value } as T
  : value;

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
  if (key === 'handler') {
    const name = ownData(parent, 'name');
    const source = ownData(parent, 'source');
    const start = isRecord(source) ? ownData(source, 'start') : undefined;
    const end = isRecord(source) ? ownData(source, 'end') : undefined;
    const sourcePath = isRecord(source) ? ownData(source, 'sourcePath') : undefined;
    const reachability = ownData(parent, 'reachability');
    const finiteOwnNumber = (record: Record<string, unknown>, field: string): boolean => {
      const value = ownData(record, field);
      return typeof value === 'number' && Number.isFinite(value);
    };
    return ownData(parent, 'kind') === 'function'
      && typeof name === 'string'
      && name.length > 0
      && isRecord(source)
      && typeof ownData(source, 'file') === 'string'
      && (sourcePath === undefined || typeof sourcePath === 'string')
      && isRecord(start)
      && finiteOwnNumber(start, 'line')
      && finiteOwnNumber(start, 'column')
      && finiteOwnNumber(start, 'offset')
      && isRecord(end)
      && finiteOwnNumber(end, 'line')
      && finiteOwnNumber(end, 'column')
      && finiteOwnNumber(end, 'offset')
      && Array.isArray(ownData(parent, 'branchPath'))
      && Array.isArray(ownData(parent, 'loopPath'))
      && (reachability === 'reachable' || reachability === 'conditional' || reachability === 'unreachable');
  }
  const dynamicHandlerOptionalKeys = ['functionSource', 'bodySource', 'parameters'] as const;
  if (dynamicHandlerOptionalKeys.includes(key as typeof dynamicHandlerOptionalKeys[number])) {
    const ownLocationShape = (candidate: unknown): boolean => {
      if (!isRecord(candidate)) return false;
      const start = ownData(candidate, 'start');
      const end = ownData(candidate, 'end');
      const sourcePathDescriptor = Object.getOwnPropertyDescriptor(candidate, 'sourcePath');
      const optionalSourcePath = sourcePathDescriptor === undefined
        || ('value' in sourcePathDescriptor
          && (sourcePathDescriptor.value === undefined || typeof sourcePathDescriptor.value === 'string'));
      const finiteOwnNumber = (record: Record<string, unknown>, field: string): boolean => {
        const value = ownData(record, field);
        return typeof value === 'number' && Number.isFinite(value);
      };
      return typeof ownData(candidate, 'file') === 'string'
        && optionalSourcePath
        && isRecord(start)
        && finiteOwnNumber(start, 'line')
        && finiteOwnNumber(start, 'column')
        && finiteOwnNumber(start, 'offset')
        && isRecord(end)
        && finiteOwnNumber(end, 'line')
        && finiteOwnNumber(end, 'column')
        && finiteOwnNumber(end, 'offset');
    };
    const optionalDescriptorsAreCanonical = dynamicHandlerOptionalKeys.every(optionalKey => {
      const descriptor = Object.getOwnPropertyDescriptor(parent, optionalKey);
      return descriptor !== undefined
        && descriptor.enumerable
        && 'value' in descriptor
        && descriptor.value === undefined;
    });
    const path = ownData(parent, 'path');
    const sourceOrder = ownData(parent, 'sourceOrder');
    const order = ownData(parent, 'order');
    const value = ownData(parent, 'value');
    const valueStatus = isRecord(value) ? ownData(value, 'status') : undefined;
    const context = ownData(parent, 'context');
    const contextName = isRecord(context) ? ownData(context, 'name') : undefined;
    const contextReachability = isRecord(context) ? ownData(context, 'reachability') : undefined;
    return optionalDescriptorsAreCanonical
      && recordType === 'handler'
      && ownData(parent, 'name') === 'onClick'
      && typeof path === 'string'
      && path.length > 0
      && ownLocationShape(ownData(parent, 'source'))
      && typeof sourceOrder === 'number'
      && Number.isFinite(sourceOrder)
      && typeof order === 'number'
      && Number.isFinite(order)
      && isRecord(value)
      && (valueStatus === 'static' || valueStatus === 'dynamic' || valueStatus === 'unknown')
      && typeof ownData(value, 'type') === 'string'
      && typeof ownData(value, 'expression') === 'string'
      && ownLocationShape(ownData(value, 'location'))
      && isRecord(context)
      && ownData(context, 'kind') === 'handler'
      && typeof contextName === 'string'
      && contextName.length > 0
      && ownData(context, 'handler') === 'onClick'
      && ownLocationShape(ownData(context, 'source'))
      && Array.isArray(ownData(context, 'branchPath'))
      && Array.isArray(ownData(context, 'loopPath'))
      && (contextReachability === 'reachable'
        || contextReachability === 'conditional'
        || contextReachability === 'unreachable');
  }
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

interface ClosedDataTraversalBudget {
  remaining: number;
}

const isClosedPlainOwnData = (
  value: unknown,
  ancestors = new Set<object>(),
  parent?: object,
  key?: string,
  arrayElement = false,
  budget: ClosedDataTraversalBudget = { remaining: 250_000 },
): boolean => {
  if (budget.remaining <= 0 || ancestors.size > 512) return false;
  budget.remaining -= 1;
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
        if (!isClosedPlainOwnData(descriptor.value, nextAncestors, value, String(index), true, budget)) return false;
      }
      return true;
    }
    if (Object.getPrototypeOf(value) !== Object.prototype || Object.getOwnPropertySymbols(value).length > 0) return false;
    for (const key of Object.getOwnPropertyNames(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) return false;
      if (!isClosedPlainOwnData(descriptor.value, nextAncestors, value, key, false, budget)) return false;
    }
    return true;
  } catch {
    return false;
  }
};

const isStructuredCloneableClosedData = (value: unknown): boolean => {
  try {
    structuredClone(value);
    return true;
  } catch {
    return false;
  }
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

/**
 * Validate the source-edit boundary, then consume the layout owner's single
 * canonical complete model view. The raw call model remains authoritative for
 * edit locking; this view only lets the layout owner project an otherwise valid
 * identifier alias.
 */
export const normalizeX4UiSourceEditLayoutModel = (model: X4UiCallModel): X4UiCallModel => {
  if (!isClosedPlainOwnData(model)) throw new Error(CLOSED_MODEL_ERROR);
  if (!isCallModel(model)) throw new Error(CLOSED_MODEL_ERROR);
  if (hasDuplicateCallEvidence(model)) throw new Error(DUPLICATE_MODEL_ERROR);
  const normalized = canonicalizeX4UiLayoutModel(model);
  if (!isCallModel(normalized) || !isClosedPlainOwnData(normalized)) throw new Error(CLOSED_MODEL_ERROR);
  return normalized;
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
    case 'setDefaultCellProperties': return index === 0 ? 'string' : undefined;
    case 'setDefaultComplexCellProperties': return index === 0 || index === 1 ? 'string' : undefined;
    case 'setHotkey': return index === 0 ? 'string' : undefined;
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
  if (['scaling', 'active', 'affectrowheight', 'wordwrap', 'selecttextonactivation', 'interactive', 'fixed', 'borderbelow', 'displayicon'].includes(normalized)) return 'boolean';
  if (['text', 'font', 'fontname', 'halign', 'alignment', 'description', 'defaulttext', 'icon', 'hotkey'].includes(normalized)) return 'string';
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
    ['cellType', 'string'], ['propertyName', 'string'], ['hotkey', 'string'], ['displayIcon', 'boolean'],
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

const withoutSemanticsProperties = (metadata: unknown): unknown => {
  if (!isRecord(metadata) || !isRecord(metadata.semantics)) return undefined;
  const semantics = Object.fromEntries(
    Object.entries(metadata.semantics).filter(([key]) => key !== 'properties'),
  );
  return { ...metadata, semantics };
};

// Call-model numericExpression trees are parser-derived helper expansion
// details. They are not emitted by the layout operation metadata; all source
// locations, literal values, identities, and the owner-issued snapshots still
// remain exact below.
const withoutCallModelNumericExpressions = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(withoutCallModelNumericExpressions);
  if (!isRecord(value)) return value;
  const isCallModelValue = isX4UiValue(value);
  const result: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (isCallModelValue && key === 'numericExpression') continue;
    result[key] = withoutCallModelNumericExpressions(child);
  }
  return result;
};

const isCanonicalHeaderPropertiesEnrichment = (
  call: X4UiCallRecord,
  operation: X4UiLayoutOperation,
): boolean => {
  if (call.name !== 'createText' || call.semantics.properties !== undefined) return false;
  const options = call.semantics.options;
  const operationMetadata = isRecord(operation.metadata) ? operation.metadata : undefined;
  const operationSemantics = isRecord(operationMetadata?.semantics) ? operationMetadata.semantics : undefined;
  const properties = operationSemantics?.properties;
  const canonicalPropertyNames = ['font', 'fontsize', 'y', 'minrowheight', 'halign', 'cellbgcolor'];
  return isX4UiValue(options)
    && options.status === 'unknown'
    && options.type === 'identifier'
    && options.expression === 'Helper.headerRowCenteredProperties'
    && Array.isArray(properties)
    && properties.length === canonicalPropertyNames.length
    && properties.every((property, index) => isRecord(property) && property.name === canonicalPropertyNames[index]);
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
  const operationMatchesBinding = sameClosedData(operation.metadata, binding.metadata);
  const normalizedMetadata = withoutCallModelNumericExpressions(metadata);
  const rawCallMatchesBinding = sameClosedData(metadata, binding.metadata)
    || sameClosedData(normalizedMetadata, binding.metadata)
    || (isCanonicalHeaderPropertiesEnrichment(call, operation)
      && sameClosedData(normalizedMetadata, withoutSemanticsProperties(operation.metadata)));
  return rawCallMatchesBinding && operationMatchesBinding;
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
    structuralEntries: freezeArray([]),
    deleteEntries: freezeArray([]),
    replaceEntries: freezeArray([]),
    insertEntries: freezeArray([]),
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

const scalarProgramIsActionable = (program: X4UiLayoutProgram): boolean =>
  (program.status === 'projected' || program.status === 'partial')
  && program.operations.length > 0
  && program.operations.every(operation => operation.status === 'applied');

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
  const structuralSequence = catalog.structuralEntries || [];
  const structuralEntries = new Map<string, X4UiSourceEditStructuralEntry>();
  for (const entry of structuralSequence) {
    if (entries.has(entry.id) || structuralEntries.has(entry.id)) return catalog;
    structuralEntries.set(entry.id, entry);
  }
  const authority: X4UiSourceEditAuthority = {
    workspace: context.workspace,
    source: context.source,
    program: context.program,
    evidenceAuthority: context.evidenceAuthority,
    entries,
    entrySequence: catalog.entries,
    structuralEntries,
    structuralSequence,
  };
  catalogAuthorities.set(catalog, authority);
  for (const entry of catalog.entries) entryAuthorities.set(entry, authority);
  for (const entry of structuralSequence) entryAuthorities.set(entry, authority);
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

interface EnclosingStatementFacts {
  readonly source: X4UiSourceLocation;
  readonly deletionSource: X4UiSourceLocation;
  readonly terminator: string;
  readonly kind: string;
  readonly isStandaloneCallStatementRoot: boolean;
}

interface CompleteStructuralStatement {
  readonly statement: EnclosingStatementFacts;
  readonly calls: readonly X4UiCallRecord[];
  readonly bindings: readonly X4UiSourceEditStructuralCallBinding[];
}

const enclosingStatementOf = (call: X4UiCallRecord): EnclosingStatementFacts | undefined => {
  const candidate = ownData(call as unknown as object, 'enclosingStatement');
  if (!isRecord(candidate)
    || !isClosedPlainOwnData(candidate)
    || !isLocationRecord(candidate.source)
    || !isLocationRecord(candidate.deletionSource)
    || typeof candidate.terminator !== 'string'
    || typeof candidate.kind !== 'string'
    || typeof candidate.isStandaloneCallStatementRoot !== 'boolean') return undefined;
  return {
    source: candidate.source,
    deletionSource: candidate.deletionSource,
    terminator: candidate.terminator,
    kind: candidate.kind,
    isStandaloneCallStatementRoot: candidate.isStandaloneCallStatementRoot,
  };
};

const statementKey = (statement: EnclosingStatementFacts): string => [
  locationKey(statement.source),
  locationKey(statement.deletionSource),
  statement.kind,
  statement.terminator,
].join('::');

const deletionSourceIsBounded = (
  text: string,
  statement: EnclosingStatementFacts,
  identity: X4UiLayoutModelIdentity,
): boolean => {
  if (!validLocation(statement.source, text)
    || !validLocation(statement.deletionSource, text)
    || !sourceIdentityMatchesLocation(identity, statement.source)
    || !sourceIdentityMatchesLocation(identity, statement.deletionSource)
    || statement.deletionSource.start.offset > statement.source.start.offset
    || statement.deletionSource.end.offset < statement.source.end.offset) return false;
  const prefix = text.slice(statement.deletionSource.start.offset, statement.source.start.offset);
  const suffix = text.slice(statement.source.end.offset, statement.deletionSource.end.offset);
  return /^[ \t]*$/.test(prefix)
    && /^[ \t]*(?:;[ \t]*)?$/.test(suffix);
};

interface LuaLongBracketSpan {
  readonly end: number;
  readonly closed: boolean;
}

const luaLongBracketSpan = (text: string, start: number): LuaLongBracketSpan | undefined => {
  if (text[start] !== '[') return undefined;
  let cursor = start + 1;
  while (text[cursor] === '=') cursor += 1;
  if (text[cursor] !== '[') return undefined;
  const close = `]${'='.repeat(cursor - start - 1)}]`;
  const closeStart = text.indexOf(close, cursor + 1);
  return closeStart < 0
    ? { end: text.length, closed: false }
    : { end: closeStart + close.length, closed: true };
};

const isLuaIdentifierStart = (value: string | undefined): boolean => value !== undefined && /[A-Za-z_]/.test(value);
const isLuaIdentifierPart = (value: string | undefined): boolean => value !== undefined && /[A-Za-z0-9_]/.test(value);

const hasExecutableLuaShapeOutsideLiterals = (expression: string): boolean => {
  let index = 0;
  while (index < expression.length) {
    const current = expression[index];
    if (current === "'" || current === '"') {
      const quote = current;
      index += 1;
      let closed = false;
      while (index < expression.length) {
        if (expression[index] === '\\') {
          if (index + 1 >= expression.length) return true;
          index += 2;
        } else if (expression[index] === quote) {
          index += 1;
          closed = true;
          break;
        } else {
          index += 1;
        }
      }
      if (!closed) return true;
      continue;
    }
    if (expression.startsWith('--', index)) {
      const comment = luaLongBracketSpan(expression, index + 2);
      if (comment) {
        if (!comment.closed) return true;
        index = comment.end;
      } else {
        while (index < expression.length && expression[index] !== '\r' && expression[index] !== '\n') index += 1;
      }
      continue;
    }
    const longBracket = luaLongBracketSpan(expression, index);
    if (longBracket) {
      if (!longBracket.closed) return true;
      index = longBracket.end;
      continue;
    }
    if (!isLuaIdentifierStart(current)) {
      index += 1;
      continue;
    }
    const wordStart = index;
    index += 1;
    while (isLuaIdentifierPart(expression[index])) index += 1;
    const word = expression.slice(wordStart, index);
    if (word === 'function') return true;
    while (expression[index] === '.' || expression[index] === ':') {
      const separator = index;
      index += 1;
      if (!isLuaIdentifierStart(expression[index])) {
        index = separator;
        break;
      }
      index += 1;
      while (isLuaIdentifierPart(expression[index])) index += 1;
    }
    while (index < expression.length && /\s/.test(expression[index])) index += 1;
    if (expression[index] === '(') return true;
  }
  return false;
};

const hasUnprovenExecutableWithin = (
  model: X4UiCallModel,
  statement: EnclosingStatementFacts,
  text: string,
): boolean => {
  const rawInvocations = ownData(model as unknown as object, 'localInvocations');
  if (!Array.isArray(rawInvocations)) return true;
  for (const rawInvocation of rawInvocations) {
    if (!isRecord(rawInvocation)) return true;
    const source = ownData(rawInvocation, 'source');
    if (!isLocationRecord(source) || !validLocation(source, text)) return true;
    if (locationWithin(statement.source, source) || locationWithin(statement.deletionSource, source)) return true;
  }
  // The call model can accept a function/table body or an unbound call as a
  // single argument without emitting a localInvocation record.  This is a
  // deliberately bounded fail-closed shape check over the model's own
  // argument expressions; it is not a second Lua parser.
  for (const call of model.calls) {
    if (!sameLocation(call.source, statement.source)) continue;
    const argumentsValue = ownData(call as unknown as object, 'arguments');
    if (!Array.isArray(argumentsValue)) continue;
    for (const argument of argumentsValue) {
      if (!isRecord(argument)) return true;
      const expression = ownData(argument, 'expression');
      const type = ownData(argument, 'type');
      if (typeof expression === 'string'
        && !['string', 'number', 'boolean', 'nil'].includes(typeof type === 'string' ? type : '')
        && hasExecutableLuaShapeOutsideLiterals(expression)) return true;
    }
  }
  return false;
};

const structuralOperationForCall = (
  call: X4UiCallRecord,
  program: X4UiLayoutProgram,
  target: X4UiLayoutTarget,
  evidenceAuthority: X4UiLayoutEvidenceAuthority,
): X4UiLayoutOperation | undefined => {
  const matches = program.operations.filter(operation =>
    operation.kind === call.name
    && operation.modelOrder === call.order
    && operation.status === 'applied'
    && sameLocation(operation.source, call.source)
    && locationWithin(target.source, operation.source)
    && !operation.localExpansion,
  );
  if (matches.length !== 1) return undefined;
  const operation = matches[0];
  const binding = evidenceAuthority.sourceBindings.find(candidate =>
    candidate.operationId === operation.id
    && candidate.callId === evidenceAuthority.calls.find(callEvidence =>
      callEvidence.operationId === operation.id
      && sameLocation(callEvidence.source, call.source))?.id,
  );
  return binding && sameLocation(binding.source, call.source) ? operation : undefined;
};

const recordString = (value: unknown, key: string): string | undefined => {
  if (!isRecord(value)) return undefined;
  const candidate = ownData(value, key);
  return typeof candidate === 'string' && candidate.length > 0 ? candidate : undefined;
};

const assignedNamesOf = (call: X4UiCallRecord): readonly string[] => Array.isArray(call.assignedTo)
  ? call.assignedTo.filter((value): value is string => typeof value === 'string' && value.length > 0)
  : [];

const structuralOwnerLedger = (
  model: X4UiCallModel,
  program: X4UiLayoutProgram,
): ReadonlyMap<string, X4UiSourceEditStructuralOwner> => {
  const owners = new Map<string, X4UiSourceEditStructuralOwner>();
  const frameBindings = new Map<string, string>();
  const tableFrames = new Map<string, string | undefined>();
  const ledger = orderedCallLedger(model);
  if (!ledger) return owners;
  for (const operation of program.operations) {
    if (operation.status !== 'applied' || operation.localExpansion) continue;
    const call = ledger.byModelOrder.get(operation.modelOrder)?.call;
    if (!call) continue;
    const record = operation as unknown as object;
    const frameId = recordString(record, 'frameId');
    const tableId = recordString(record, 'tableId');
    if (operation.kind === 'createFrameHandle' && frameId) {
      for (const name of assignedNamesOf(call)) frameBindings.set(name, frameId);
    }
    if (operation.kind === 'addTable' && tableId) {
      const parentFrameId = frameBindings.get(call.receiver?.expression || '');
      tableFrames.set(tableId, parentFrameId);
    }
    if (tableId) {
      owners.set(operation.id, {
        kind: 'table',
        ownerId: tableId,
        ...(tableFrames.has(tableId) && tableFrames.get(tableId) !== undefined
          ? { frameId: tableFrames.get(tableId) }
          : {}),
      });
    } else if (frameId) {
      owners.set(operation.id, { kind: 'frame', ownerId: frameId });
    }
  }
  return owners;
};

const structuralOwnerKey = (owner: X4UiSourceEditStructuralOwner): string => [
  owner.kind,
  owner.ownerId,
  owner.frameId || '',
].join('|');

const ownerForStructuralCandidate = (
  candidate: CompleteStructuralStatement,
  callName: X4UiRelevantCallName,
  program: X4UiLayoutProgram,
  owners: ReadonlyMap<string, X4UiSourceEditStructuralOwner>,
): X4UiSourceEditStructuralOwner | undefined => {
  const call = candidate.calls.find(item => item.name === callName);
  if (!call) return undefined;
  const operation = program.operations.find(item => item.kind === call.name
    && item.modelOrder === call.order
    && sameLocation(item.source, call.source));
  return operation ? owners.get(operation.id) : undefined;
};

interface StructuralRowOwnerFacts {
  readonly standaloneCandidates: readonly CompleteStructuralStatement[];
  readonly owners: readonly X4UiSourceEditStructuralOwner[];
  readonly hasRows: boolean;
  readonly valid: boolean;
}

const structuralRowOwnerFacts = (
  file: X4UiSourceFile,
  target: X4UiLayoutTarget,
  program: X4UiLayoutProgram,
  evidenceAuthority: X4UiLayoutEvidenceAuthority,
  statements: readonly CompleteStructuralStatement[],
  owners: ReadonlyMap<string, X4UiSourceEditStructuralOwner>,
): StructuralRowOwnerFacts => {
  const standaloneCandidates = statements.filter(candidate => candidate.calls.some(call => call.name === 'addRow'));
  const standaloneOwners = standaloneCandidates.map(candidate => ownerForStructuralCandidate(candidate, 'addRow', program, owners));
  let valid = standaloneOwners.every(owner => owner?.kind === 'table' && typeof owner.frameId === 'string');
  const assignedRowCalls = file.callModel.calls.filter(call => call.name === 'addRow'
    && Array.isArray(call.assignedTo)
    && call.assignedTo.length > 0
    && locationWithin(target.source, call.source));
  const assignedOwners: X4UiSourceEditStructuralOwner[] = [];
  const assignedOperationIds = new Set<string>();
  for (const call of assignedRowCalls) {
    const statement = enclosingStatementOf(call);
    const assignedNames = assignedNamesOf(call);
    const operation = structuralOperationForCall(call, program, target, evidenceAuthority);
    const owner = operation ? owners.get(operation.id) : undefined;
    if (!statement
      || statement.isStandaloneCallStatementRoot
      || !['local', 'assignment'].includes(statement.kind)
      || assignedNames.length !== 1
      || !operation
      || assignedOperationIds.has(operation.id)
      || owner?.kind !== 'table'
      || typeof owner.frameId !== 'string') {
      valid = false;
      continue;
    }
    assignedOperationIds.add(operation.id);
    assignedOwners.push(owner);
  }
  return {
    standaloneCandidates,
    owners: freezeArray([
      ...standaloneOwners.filter((owner): owner is X4UiSourceEditStructuralOwner => owner !== undefined),
      ...assignedOwners,
    ]),
    hasRows: standaloneCandidates.length > 0 || assignedRowCalls.length > 0,
    valid,
  };
};

const completeStructuralStatement = (
  model: X4UiCallModel,
  program: X4UiLayoutProgram,
  evidenceAuthority: X4UiLayoutEvidenceAuthority,
  target: X4UiLayoutTarget,
  file: X4UiSourceFile,
  root: EnclosingStatementFacts,
): CompleteStructuralStatement | undefined => {
  if (root.kind !== 'call'
    || !root.isStandaloneCallStatementRoot
    || !deletionSourceIsBounded(file.text, root, target.sourceIdentity)
    || !locationWithin(target.source, root.source)
    || !locationWithin(target.source, root.deletionSource)
    || hasUnprovenExecutableWithin(model, root, file.text)) return undefined;
  const calls = model.calls.filter(call =>
    validLocation(call.source, file.text)
    && locationWithin(root.source, call.source),
  );
  if (calls.length === 0) return undefined;
  const rootCalls = calls.filter(call => {
    const statement = enclosingStatementOf(call);
    return Boolean(statement
      && statement.isStandaloneCallStatementRoot
      && sameLocation(statement.source, root.source)
      && sameLocation(statement.deletionSource, root.deletionSource));
  });
  if (rootCalls.length !== 1) return undefined;
  const bindings: X4UiSourceEditStructuralCallBinding[] = [];
  for (const call of calls) {
    const statement = enclosingStatementOf(call);
    if (!statement
      || !locationWithin(root.source, statement.source)
      || !locationWithin(root.deletionSource, statement.deletionSource)
      || (call.source.start.offset !== root.source.start.offset
        && !sameLocation(call.source, root.source))
      || (call.context.source !== undefined && !sameLocation(call.context.source, target.source))
      || call.context.source === undefined) return undefined;
    const operation = structuralOperationForCall(call, program, target, evidenceAuthority);
    if (!operation) return undefined;
    bindings.push(freezeDeep({
      operationId: operation.id,
      callName: call.name,
      callOrder: call.order,
      callSource: call.source,
    }));
  }
  return {
    statement: root,
    calls: freezeArray(calls),
    bindings: freezeArray(bindings),
  };
};

const structuralStatements = (
  file: X4UiSourceFile,
  program: X4UiLayoutProgram,
  evidenceAuthority: X4UiLayoutEvidenceAuthority,
  target: X4UiLayoutTarget,
): readonly CompleteStructuralStatement[] => {
  const model = file.callModel;
  const roots = new Map<string, EnclosingStatementFacts>();
  for (const call of model.calls) {
    const statement = enclosingStatementOf(call);
    if (!statement || !statement.isStandaloneCallStatementRoot) continue;
    const key = statementKey(statement);
    if (!roots.has(key)) roots.set(key, statement);
  }
  const complete: CompleteStructuralStatement[] = [];
  for (const root of roots.values()) {
    const candidate = completeStructuralStatement(model, program, evidenceAuthority, target, file, root);
    if (candidate) complete.push(candidate);
  }
  return complete.sort((left, right) => left.statement.deletionSource.start.offset - right.statement.deletionSource.start.offset);
};

const structuralEntryProvenance = (
  identity: X4UiLayoutModelIdentity,
  target: X4UiLayoutTarget,
  candidate: CompleteStructuralStatement,
  owner?: X4UiSourceEditStructuralOwner,
  rowOwner?: X4UiSourceEditStructuralRowOwner,
): X4UiSourceEditStructuralProvenance => freezeDeep({
  sourceIdentity: identity,
  targetId: target.id,
  targetSource: target.source,
  statementSource: candidate.statement.source,
  callBindings: candidate.bindings,
  ...(owner ? { owner } : {}),
  ...(rowOwner ? { rowOwner } : {}),
});

const pointLocation = (source: X4UiSourceLocation, offset: number): X4UiSourceLocation => ({
  file: source.file,
  ...(source.sourcePath !== undefined ? { sourcePath: source.sourcePath } : {}),
  start: { ...source.start, column: 0, offset },
  end: { ...source.start, column: 0, offset },
});

const localInsertionStyle = (
  text: string,
  source: X4UiSourceLocation,
): { readonly anchorOffset: number; readonly indentation: string; readonly lineEnding: '\n' | '\r\n' } | undefined => {
  const maxScan = 4096;
  const windowStart = Math.max(0, source.start.offset - maxScan);
  const windowEnd = Math.min(text.length, source.start.offset + maxScan);
  const previousNewline = text.lastIndexOf('\n', source.start.offset - 1);
  if (previousNewline >= 0 && previousNewline < windowStart) return undefined;
  const lineStart = previousNewline >= 0 ? previousNewline + 1 : 0;
  if (lineStart > source.start.offset || source.start.offset - lineStart > maxScan) return undefined;
  const indentation = text.slice(lineStart, source.start.offset);
  if (!/^[ \t]*$/.test(indentation)) return undefined;
  const nextNewline = text.indexOf('\n', source.start.offset);
  const newlineIndex = nextNewline >= 0 && nextNewline <= windowEnd
    ? nextNewline
    : previousNewline;
  const lineEnding: '\n' | '\r\n' = newlineIndex >= 0 && text[newlineIndex - 1] === '\r' ? '\r\n' : '\n';
  return { anchorOffset: lineStart, indentation, lineEnding };
};

const structuralDeleteId = (target: X4UiLayoutTarget, statement: EnclosingStatementFacts): string =>
  `x4-ui-source-delete:${target.id}:${statement.deletionSource.start.offset}:${statement.deletionSource.end.offset}`;

const structuralInsertId = (
  target: X4UiLayoutTarget,
  anchor: X4UiSourceEditInsertionAnchor,
  offset: number,
): string => `x4-ui-source-insert:${target.id}:${anchor}:${offset}`;

const structuralReplaceId = (
  target: X4UiLayoutTarget,
  statement: EnclosingStatementFacts,
): string => `x4-ui-source-replace:${target.id}:${statement.deletionSource.start.offset}:${statement.deletionSource.end.offset}`;

const rowOwnerForStructuralCandidate = (
  candidate: CompleteStructuralStatement,
  program: X4UiLayoutProgram,
  owners: ReadonlyMap<string, X4UiSourceEditStructuralOwner>,
): X4UiSourceEditStructuralRowOwner | undefined => {
  if (candidate.bindings.length === 0) return undefined;
  let rowOwner: X4UiSourceEditStructuralRowOwner | undefined;
  for (const binding of candidate.bindings) {
    const operation = program.operations.find(item => item.id === binding.operationId);
    const owner = owners.get(binding.operationId);
    const record = operation as unknown as Record<string, unknown> | undefined;
    const tableId = recordString(record, 'tableId');
    const rowId = recordString(record, 'rowId');
    const cellId = recordString(record, 'cellId');
    if (!operation
      || operation.status !== 'applied'
      || operation.localExpansion
      || !owner
      || owner.kind !== 'table'
      || !tableId
      || !rowId
      || !cellId
      || owner.ownerId !== tableId
      || typeof owner.frameId !== 'string'
      || owner.frameId.length === 0) return undefined;
    const candidateOwner = { frameId: owner.frameId, tableId, rowId };
    if (!rowOwner) rowOwner = candidateOwner;
    else if (rowOwner.frameId !== candidateOwner.frameId
      || rowOwner.tableId !== candidateOwner.tableId
      || rowOwner.rowId !== candidateOwner.rowId) return undefined;
  }
  return rowOwner ? freezeDeep(rowOwner) : undefined;
};

const structuralEntriesFor = (
  file: X4UiSourceFile,
  target: X4UiLayoutTarget,
  program: X4UiLayoutProgram,
  evidenceAuthority: X4UiLayoutEvidenceAuthority,
): readonly X4UiSourceEditStructuralEntry[] => {
  const statements = structuralStatements(file, program, evidenceAuthority, target);
  const owners = structuralOwnerLedger(file.callModel, program);
  const ownerForStatement = (candidate: CompleteStructuralStatement): X4UiSourceEditStructuralOwner | undefined => {
    const candidateOwners = candidate.bindings.map(binding => owners.get(binding.operationId));
    if (candidateOwners.length === 0 || candidateOwners.some(owner => owner === undefined)) return undefined;
    const distinctOwners = new Set(candidateOwners.map(owner => structuralOwnerKey(owner!)));
    return distinctOwners.size === 1 ? candidateOwners[0] : undefined;
  };
  const deletions: X4UiSourceEditDeleteEntry[] = statements.map(candidate => freezeDeep({
    kind: 'delete-statement',
    id: structuralDeleteId(target, candidate.statement),
    path: file.path,
    startOffset: candidate.statement.deletionSource.start.offset,
    endOffset: candidate.statement.deletionSource.end.offset,
    expectedText: file.text.slice(candidate.statement.deletionSource.start.offset, candidate.statement.deletionSource.end.offset),
    statementSource: candidate.statement.source,
    deletionSource: candidate.statement.deletionSource,
    callBindings: candidate.bindings,
    provenance: structuralEntryProvenance(target.sourceIdentity, target, candidate, ownerForStatement(candidate)),
  }));
  const replacements: X4UiSourceEditReplaceEntry[] = statements.flatMap(candidate => {
    const owner = ownerForStatement(candidate);
    const rowOwner = rowOwnerForStructuralCandidate(candidate, program, owners);
    if (!owner || !rowOwner) return [];
    return [freezeDeep({
      kind: 'replace-statement' as const,
      id: structuralReplaceId(target, candidate.statement),
      path: file.path,
      startOffset: candidate.statement.deletionSource.start.offset,
      endOffset: candidate.statement.deletionSource.end.offset,
      expectedText: file.text.slice(candidate.statement.deletionSource.start.offset, candidate.statement.deletionSource.end.offset),
      statementSource: candidate.statement.source,
      deletionSource: candidate.statement.deletionSource,
      callBindings: candidate.bindings,
      provenance: structuralEntryProvenance(target.sourceIdentity, target, candidate, owner, rowOwner),
    } as X4UiSourceEditReplaceEntry)];
  });
  interface OwnerCandidate {
    readonly candidate: CompleteStructuralStatement;
    readonly owner: X4UiSourceEditStructuralOwner;
  }
  const sameReceiverCandidate = (
    candidates: readonly CompleteStructuralStatement[],
    callName: X4UiRelevantCallName,
  ): OwnerCandidate | undefined => {
    if (candidates.length === 0) return undefined;
    const ownerCandidates = candidates.map(candidate => ({
      candidate,
      owner: ownerForStructuralCandidate(candidate, callName, program, owners),
    }));
    if (ownerCandidates.some(item => item.owner === undefined)) return undefined;
    const distinctOwners = new Set(ownerCandidates.map(item => structuralOwnerKey(item.owner!)));
    return distinctOwners.size === 1
      ? { candidate: ownerCandidates[0].candidate, owner: ownerCandidates[0].owner! }
      : undefined;
  };
  const rowFacts = structuralRowOwnerFacts(file, target, program, evidenceAuthority, statements, owners);
  const firstRowCandidates = rowFacts.standaloneCandidates;
  const firstRowMatch = rowFacts.valid ? sameReceiverCandidate(firstRowCandidates, 'addRow') : undefined;
  const fallbackDisplayCandidates = statements.filter(candidate => candidate.calls.some(call => call.name === 'display'));
  const displayOwnerMatch = sameReceiverCandidate(fallbackDisplayCandidates, 'display');
  const uniqueDisplayMatch = fallbackDisplayCandidates.length === 1 ? displayOwnerMatch : undefined;
  const distinctRowOwners = new Set(rowFacts.owners.map(owner => structuralOwnerKey(owner)));
  const multipleTableOwners = rowFacts.valid
    && rowFacts.owners.length > 0
    && rowFacts.owners.every(owner => owner.kind === 'table' && typeof owner.frameId === 'string')
    && distinctRowOwners.size >= 2;
  const fallbackDisplay = !multipleTableOwners && rowFacts.valid
    ? displayOwnerMatch
    : undefined;
  const displayOwner = uniqueDisplayMatch?.owner;
  const frameDisplayMatch = multipleTableOwners
    && displayOwner?.kind === 'frame'
    && rowFacts.owners.every(owner => owner.frameId === displayOwner.ownerId)
    ? uniqueDisplayMatch
    : undefined;
  const anchorMatch = rowFacts.valid && !multipleTableOwners
    ? firstRowMatch || fallbackDisplay
    : undefined;
  const insertions: X4UiSourceEditInsertionEntry[] = [];
  if (anchorMatch) {
    const anchorCandidate = anchorMatch.candidate;
    const style = localInsertionStyle(file.text, anchorCandidate.statement.deletionSource);
    if (style) {
      const anchor: X4UiSourceEditInsertionAnchor = firstRowMatch ? 'first-row' : 'fallback-display';
      const anchorSource = pointLocation(anchorCandidate.statement.deletionSource, style.anchorOffset);
      insertions.push(freezeDeep({
        kind: 'insert-call',
        id: structuralInsertId(target, anchor, style.anchorOffset),
        path: file.path,
        startOffset: style.anchorOffset,
        endOffset: style.anchorOffset,
        expectedText: '',
        anchor,
        anchorSource,
        indentation: style.indentation,
        lineEnding: style.lineEnding,
        provenance: structuralEntryProvenance(target.sourceIdentity, target, anchorCandidate, anchorMatch.owner),
      }));
    }
  }
  // A frame/display block is intentionally issued only for the ambiguity case
  // that suppresses the legacy one-call anchor: the block owns a new hierarchy
  // through one proven frame and never reuses an existing table owner.
  if (frameDisplayMatch) {
    const anchorCandidate = frameDisplayMatch.candidate;
    const style = localInsertionStyle(file.text, anchorCandidate.statement.deletionSource);
    if (style) {
      const anchorSource = pointLocation(anchorCandidate.statement.deletionSource, style.anchorOffset);
      insertions.push(freezeDeep({
        kind: 'insert-block',
        id: structuralInsertId(target, 'frame-display', style.anchorOffset),
        path: file.path,
        startOffset: style.anchorOffset,
        endOffset: style.anchorOffset,
        expectedText: '',
        anchor: 'frame-display',
        anchorSource,
        indentation: style.indentation,
        lineEnding: style.lineEnding,
        provenance: structuralEntryProvenance(target.sourceIdentity, target, anchorCandidate, frameDisplayMatch.owner),
      }));
    }
  }
  return freezeArray([...deletions, ...replacements, ...insertions]);
};

const structuralIgnoredKeys = new Set<string>();

const structuralOperationIgnoredKeys = new Set<string>();

const structuralOperationSourceDerivedKeys = new Set(['rowId', 'cellId']);
const structuralParserReferenceSourceDerivedKeys = new Set(['path', 'parentPath', 'relatedPath']);
const structuralOperationOrderKeys = new Set(['modelOrder']);
const structuralOperationLedgerIdentityKeys = new Set(['id', 'frameId', 'tableId']);
const structuralOperationOwnerKeysByKind: Readonly<Record<string, readonly string[]>> = {
  scaleX: [],
  scaleY: [],
  scaleFont: [],
  OpenMenu: [],
  createFrameHandle: ['frameId'],
  display: ['frameId'],
  addTable: ['tableId'],
  setColWidth: ['tableId'],
  setColWidthPercent: ['tableId'],
  addRow: ['tableId', 'rowId'],
  setDefaultCellProperties: ['tableId'],
  setDefaultComplexCellProperties: ['tableId'],
  setColSpan: ['tableId', 'rowId', 'cellId'],
  createButton: ['tableId', 'rowId', 'cellId'],
  setText: ['tableId', 'rowId', 'cellId'],
  setText2: ['tableId', 'rowId', 'cellId'],
  createText: ['tableId', 'rowId', 'cellId'],
  createEditBox: ['tableId', 'rowId', 'cellId'],
  setHotkey: ['tableId', 'rowId', 'cellId'],
  createIcon: ['tableId', 'rowId', 'cellId'],
};

const isParserOwnedReferenceRecord = (value: unknown): boolean => {
  if (!isRecord(value)
    || typeof ownData(value, 'kind') !== 'string'
    || typeof ownData(value, 'origin') !== 'string') return false;
  return isLocationRecord(ownData(value, 'source'));
};

type StructuralCompleteRecordSchema = 'property-record' | 'handler-record' | 'alias-record';

type StructuralRecordSchema =
  | 'exact'
  | 'call'
  | 'operation'
  | 'call-metadata'
  | 'call-semantics'
  | 'edit-box-semantics'
  | 'scale-semantics'
  | 'parser-values'
  | 'parser-value'
  | 'parser-reference'
  | 'parser-parameter'
  | 'parser-local-invocation-result'
  | 'parser-properties'
  | 'parser-property'
  | 'enclosing-statement'
  | 'call-context'
  | 'branch-paths'
  | 'branch-path'
  | 'loop-paths'
  | 'loop-path'
  | 'descriptor-facts'
  | 'descriptor-fact'
  | 'scale-resolution'
  | 'color-value'
  | 'color-channels'
  | 'color-literal-field'
  | 'source-locations'
  | 'source-location'
  | StructuralCompleteRecordSchema;

const isStructuralCompleteRecordSchema = (
  schema: StructuralRecordSchema,
): schema is StructuralCompleteRecordSchema => schema === 'property-record'
  || schema === 'handler-record'
  || schema === 'alias-record';

const isStructuralParserPropertyRecord = (value: unknown): boolean => isRecord(value)
  && typeof ownData(value, 'sourceOrder') === 'number'
  && Object.prototype.hasOwnProperty.call(value, 'value')
  && isLocationRecord(ownData(value, 'source'));

const isStructuralParserValueRecord = (value: unknown): boolean => isRecord(value)
  && typeof ownData(value, 'status') === 'string'
  && typeof ownData(value, 'type') === 'string'
  && typeof ownData(value, 'expression') === 'string'
  && isLocationRecord(ownData(value, 'location'));

const isStructuralDescriptorFact = (value: unknown): boolean => isRecord(value)
  && (ownData(value, 'status') === 'known' || ownData(value, 'status') === 'unavailable')
  && typeof ownData(value, 'expectedType') === 'string'
  && isLocationRecord(ownData(value, 'source'));

const structuralCallSemanticsValueKeys = new Set([
  'count', 'index', 'span', 'width', 'percentage', 'height', 'layer', 'menu', 'menuName',
  'frame', 'table', 'row', 'cell', 'dataFlow', 'text', 'fontsize', 'options', 'rowData',
  'icon', 'scaling', 'cellType', 'propertyName', 'hotkey', 'displayIcon',
]);

const structuralChildSchema = (
  schema: StructuralRecordSchema,
  key: string,
): StructuralRecordSchema => {
  if (structuralSchemaOwnsLocation(schema, key)) return 'source-location';
  if (structuralSchemaOwnsField(schema, key)) return schema;
  if (schema === 'call') {
    if (key === 'arguments') return 'parser-values';
    if (key === 'receiver') return 'parser-value';
    if (key === 'result') return 'parser-reference';
    if (key === 'semantics') return 'call-semantics';
    if (key === 'enclosingStatement') return 'enclosing-statement';
    if (key === 'context') return 'call-context';
  }
  if (schema === 'operation') {
    if (key === 'metadata') return 'call-metadata';
    if (key === 'descriptorFacts') return 'descriptor-facts';
    if (key === 'scale') return 'scale-resolution';
  }
  if (schema === 'call-metadata') {
    if (key === 'arguments') return 'parser-values';
    if (key === 'receiver') return 'parser-value';
    if (key === 'result') return 'parser-reference';
    if (key === 'semantics') return 'call-semantics';
  }
  if (schema === 'call-semantics') {
    if (structuralCallSemanticsValueKeys.has(key)) return 'parser-value';
    if (key === 'properties' || key === 'unsupportedProperties') return 'parser-properties';
    if (key === 'editBox') return 'edit-box-semantics';
    if (key === 'scale') return 'scale-semantics';
  }
  if (schema === 'edit-box-semantics' && (key === 'defaultText' || key === 'description')) return 'parser-value';
  if (schema === 'scale-semantics' && ['input', 'fontname', 'fontsize', 'enabled'].includes(key)) return 'parser-value';
  if (schema === 'parser-value' && key === 'reference') return 'parser-reference';
  if (schema === 'parser-value' && key === 'parameter') return 'parser-parameter';
  if (schema === 'parser-value' && key === 'localInvocationResult') return 'parser-local-invocation-result';
  if (schema === 'parser-reference' && key === 'index') return 'parser-value';
  if (schema === 'parser-property' && key === 'value') return 'parser-value';
  if (schema === 'call-context') {
    if (key === 'branchPath') return 'branch-paths';
    if (key === 'loopPath') return 'loop-paths';
  }
  if (schema === 'property-record') {
    if (key === 'owner' || key === 'value') return 'parser-value';
    if (key === 'context') return 'call-context';
  }
  if (schema === 'handler-record') {
    if (key === 'value') return 'parser-value';
    if (key === 'context') return 'call-context';
  }
  if (schema === 'alias-record') {
    if (key === 'value') return 'parser-value';
    if (key === 'context') return 'call-context';
  }
  if (schema === 'scale-resolution' && key === 'sourceArguments') return 'source-locations';
  if (schema === 'color-value' && key === 'channels') return 'color-channels';
  if (schema === 'color-channels' && ['r', 'g', 'b', 'a', 'glow'].includes(key)) return 'color-literal-field';
  return 'exact';
};

const structuralArrayElementSchema = (schema: StructuralRecordSchema): StructuralRecordSchema => {
  if (schema === 'parser-values') return 'parser-value';
  if (schema === 'parser-properties') return 'parser-property';
  if (schema === 'branch-paths') return 'branch-path';
  if (schema === 'loop-paths') return 'loop-path';
  if (schema === 'source-locations') return 'source-location';
  return schema;
};

const structuralSchemaOwnsLocation = (
  schema: StructuralRecordSchema,
  key: string,
): boolean => {
  if ((schema === 'call' || schema === 'operation') && key === 'source') return true;
  if (schema === 'property-record' && key === 'source') return true;
  if (schema === 'handler-record' && ['source', 'functionSource', 'bodySource'].includes(key)) return true;
  if (schema === 'alias-record' && key === 'source') return true;
  if (schema === 'enclosing-statement' && (key === 'source' || key === 'deletionSource')) return true;
  if (schema === 'parser-value' && (key === 'location' || key === 'sourceLiteral')) return true;
  if (schema === 'parser-reference' && (key === 'source' || key === 'helperAliasSource')) return true;
  if ((schema === 'parser-parameter' || schema === 'parser-local-invocation-result') && key === 'source') return true;
  if (schema === 'parser-property' && key === 'source') return true;
  if (schema === 'call-context' && key === 'source') return true;
  if (schema === 'branch-path' && key === 'boundary') return true;
  if (schema === 'loop-path' && key === 'source') return true;
  if (schema === 'color-value' && key === 'declarationSource') return true;
  if (schema === 'color-literal-field' && (key === 'source' || key === 'keySource')) return true;
  return schema === 'descriptor-fact' && key === 'source';
};

const structuralSchemaOwnsField = (
  schema: StructuralRecordSchema,
  key: string,
): boolean => {
  if (schema === 'call') return key === 'order' || key === 'sourceOrder';
  if (isStructuralCompleteRecordSchema(schema)) return key === 'order' || key === 'sourceOrder';
  if (schema === 'operation') {
    return key === 'sourceOrder'
      || structuralOperationOrderKeys.has(key)
      || structuralOperationLedgerIdentityKeys.has(key)
      || structuralOperationSourceDerivedKeys.has(key);
  }
  if (schema === 'parser-reference') return structuralParserReferenceSourceDerivedKeys.has(key);
  if (schema === 'parser-parameter') return key === 'id' || key === 'declarationId';
  if (schema === 'parser-local-invocation-result') return key === 'invocationId';
  if (schema === 'branch-path') return key === 'boundaryId' || key === 'armId';
  return schema === 'parser-property' && key === 'sourceOrder';
};

interface StructuralSplice {
  readonly beforeText: string;
  readonly afterText: string;
  readonly startOffset: number;
  readonly endOffset: number;
  readonly replacementLength: number;
  readonly orderShift: number;
  readonly side: 'before' | 'after';
}

interface StructuralInvariantState {
  valid: boolean;
}

const structuralInvariant = (
  value: unknown,
  key = '',
  ignoredKeys: ReadonlySet<string> = structuralIgnoredKeys,
  splice?: StructuralSplice,
  state: StructuralInvariantState = { valid: true },
  schema: StructuralRecordSchema = 'exact',
): unknown => {
  if (typeof value === 'string' && splice
    && ((schema === 'operation' && structuralOperationSourceDerivedKeys.has(key))
      || (schema === 'parser-reference' && structuralParserReferenceSourceDerivedKeys.has(key))
      || (schema === 'parser-parameter' && (key === 'id' || key === 'declarationId'))
      || (schema === 'parser-local-invocation-result' && key === 'invocationId'))) {
    return remapSourceDerivedIdentity(value, splice);
  }
  if (typeof value === 'string' && splice && schema === 'branch-path'
    && (key === 'boundaryId' || key === 'armId')) {
    return remapStructuralBranchIdentity(value, splice);
  }
  if (typeof value === 'string' && splice && splice.side === 'before'
    && schema === 'operation' && structuralOperationLedgerIdentityKeys.has(key)) {
    return remapStructuralLedgerIdentity(value, splice);
  }
  if (typeof value === 'number' && splice && splice.side === 'before'
    && (((schema === 'call' || isStructuralCompleteRecordSchema(schema)) && key === 'order')
      || (schema === 'operation' && structuralOperationOrderKeys.has(key)))) {
    return value + splice.orderShift;
  }
  if (typeof value === 'number' && splice && splice.side === 'before' && key === 'sourceOrder'
    && (schema === 'call' || isStructuralCompleteRecordSchema(schema)
      || schema === 'operation' || schema === 'parser-property')) {
    const mapped = mapStructuralOffset(
      value,
      splice.startOffset,
      splice.endOffset,
      splice.replacementLength,
    );
    return mapped === undefined ? '<invalid-splice-offset>' : mapped;
  }
  if (schema !== 'exact'
    && !(structuralSchemaOwnsField(schema, key)
      && (typeof value === 'string' || typeof value === 'number'))
    && !structuralProducerSchemaNodeIsValid(value, schema, splice)) {
    state.valid = false;
  }
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    const elementSchema = structuralArrayElementSchema(schema);
    return value.map(child => structuralInvariant(child, key, ignoredKeys, splice, state, elementSchema));
  }
  if (!isRecord(value)) return value;
  if (schema === 'source-location' || structuralSchemaOwnsLocation(schema, key)) {
    const location = structuralLocationInvariant(value, splice);
    if (location === undefined) {
      state.valid = false;
    }
    return location;
  }
  if ((schema === 'parser-reference' && !isParserOwnedReferenceRecord(value))
    || (schema === 'parser-property' && !isStructuralParserPropertyRecord(value))
    || (schema === 'parser-value' && !isStructuralParserValueRecord(value))
    || (schema === 'descriptor-fact' && !isStructuralDescriptorFact(value))) {
    state.valid = false;
  }
  const result: Record<string, unknown> = {};
  for (const [childKey, child] of Object.entries(value)) {
    if (ignoredKeys.has(childKey)) continue;
    if (child === undefined) {
      result[childKey] = child;
      continue;
    }
    if (splice
      && splice.side === 'before'
      && isStructuralCompleteRecordSchema(schema)
      && childKey === 'path'
      && typeof child === 'string') {
      result[childKey] = remapSourceDerivedIdentity(child, splice);
      continue;
    }
    const childSchema = schema === 'descriptor-facts'
      ? 'descriptor-fact'
      : schema === 'descriptor-fact'
        && childKey === 'value'
        && ownData(value, 'expectedType') === 'color-object'
        ? 'color-value'
        : structuralChildSchema(schema, childKey);
    result[childKey] = structuralInvariant(
      child,
      childKey,
      ignoredKeys,
      splice,
      state,
      childSchema,
    );
  }
  return result;
};

const lineColumnAt = (text: string, offset: number): { readonly line: number; readonly column: number } => {
  let line = 1;
  let lineStart = 0;
  for (let index = 0; index < offset; index += 1) {
    if (text[index] === '\n') {
      line += 1;
      lineStart = index + 1;
    }
  }
  return { line, column: offset - lineStart };
};

const mapStructuralOffset = (
  offset: number,
  startOffset: number,
  endOffset: number,
  replacementLength: number,
  endpoint: 'start' | 'end' = 'start',
): number | undefined => {
  if (startOffset === endOffset) {
    if (offset < startOffset) return offset;
    if (offset > startOffset) return offset + replacementLength;
    return endpoint === 'end' ? offset : offset + replacementLength;
  }
  if (endpoint === 'end') {
    if (offset <= startOffset) return offset;
    if (offset > endOffset) return offset + replacementLength - (endOffset - startOffset);
    return undefined;
  }
  if (offset < startOffset) return offset;
  if (offset >= endOffset) return offset + replacementLength - (endOffset - startOffset);
  return undefined;
};

const mapStructuralRangeOffsets = (
  start: number,
  end: number,
  startOffset: number,
  endOffset: number,
  replacementLength: number,
): { readonly start: number; readonly end: number } | undefined => {
  const mappedStart = mapStructuralOffset(start, startOffset, endOffset, replacementLength);
  const mappedEnd = mapStructuralOffset(end, startOffset, endOffset, replacementLength, 'end');
  if (start === end && mappedStart !== undefined) {
    const zeroWidthHasAfterAffinity = startOffset === endOffset
      ? start === startOffset
      : start === endOffset;
    if (zeroWidthHasAfterAffinity) return { start: mappedStart, end: mappedStart };
  }
  return mappedStart === undefined || mappedEnd === undefined || mappedStart > mappedEnd
    ? undefined
    : { start: mappedStart, end: mappedEnd };
};

const hasClosedStructuralKeys = (
  value: unknown,
  required: ReadonlySet<string>,
  optional: ReadonlySet<string> = new Set<string>(),
): value is Record<string, unknown> => {
  if (!isRecord(value)) return false;
  try {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return false;
    const keys = Reflect.ownKeys(value);
    if (keys.some(key => typeof key !== 'string')) return false;
    const names = keys as string[];
    if (![...required].every(key => names.includes(key))
      || !names.every(key => required.has(key) || optional.has(key))) return false;
    return names.every(key => {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      return descriptor !== undefined && descriptor.enumerable === true && 'value' in descriptor;
    });
  } catch {
    return false;
  }
};

const structuralPosition = (
  value: unknown,
  text: string,
): { readonly line: number; readonly column: number; readonly offset: number } | undefined => {
  if (!hasClosedStructuralKeys(value, new Set(['line', 'column', 'offset']))) return undefined;
  const line = ownData(value, 'line');
  const column = ownData(value, 'column');
  const offset = ownData(value, 'offset');
  if (typeof line !== 'number'
    || typeof column !== 'number'
    || typeof offset !== 'number'
    || !Number.isInteger(line)
    || line < 1
    || !Number.isInteger(column)
    || column < 0
    || !validOffset(offset)
    || offset > text.length) return undefined;
  const canonical = lineColumnAt(text, offset);
  return canonical.line === line && canonical.column === column
    ? { line, column, offset }
    : undefined;
};

const structuralRecordKeys = (
  value: unknown,
  required: readonly string[],
  optional: readonly string[] = [],
): value is Record<string, unknown> => hasClosedStructuralKeys(
  value,
  new Set(required),
  new Set(optional),
);

const structuralString = (value: unknown, nonEmpty = false): value is string =>
  typeof value === 'string' && (!nonEmpty || value.length > 0);

const structuralIndex = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

const structuralFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const structuralBoolean = (value: unknown): value is boolean => typeof value === 'boolean';

const structuralPositiveIndex = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 1;

const structuralEnum = (value: unknown, values: readonly string[]): value is string =>
  typeof value === 'string' && values.includes(value);

const structuralStringArray = (value: unknown): value is readonly string[] =>
  Array.isArray(value) && value.every(candidate => structuralString(candidate, true));

const structuralLocationForText = (
  value: unknown,
  text: string | undefined,
): value is Record<string, unknown> => {
  if (text === undefined
    || !structuralRecordKeys(value, ['file', 'start', 'end'], ['sourcePath'])) return false;
  const file = ownData(value, 'file');
  const sourcePath = ownData(value, 'sourcePath');
  const start = structuralPosition(ownData(value, 'start'), text);
  const end = structuralPosition(ownData(value, 'end'), text);
  return structuralString(file, true)
    && (sourcePath === undefined || structuralString(sourcePath, true))
    && start !== undefined
    && end !== undefined
    && start.offset <= end.offset;
};

const structuralLocationBounds = (
  value: unknown,
): { readonly start: number; readonly end: number } | undefined => {
  if (!isRecord(value)) return undefined;
  const start = ownData(value, 'start');
  const end = ownData(value, 'end');
  if (!isRecord(start) || !isRecord(end)) return undefined;
  const startOffset = ownData(start, 'offset');
  const endOffset = ownData(end, 'offset');
  return structuralIndex(startOffset) && structuralIndex(endOffset) && startOffset <= endOffset
    ? { start: startOffset, end: endOffset }
    : undefined;
};

const structuralOptionalData = (
  value: Record<string, unknown>,
  key: string,
  validate: (candidate: unknown) => boolean,
): boolean => !Object.prototype.hasOwnProperty.call(value, key)
  || ownData(value, key) === undefined
  || validate(ownData(value, key));

const structuralParameterIdentityIsValid = (
  value: unknown,
  text: string | undefined,
): boolean => structuralRecordKeys(value, ['id', 'declarationId', 'index', 'name', 'source'])
  && structuralString(ownData(value, 'id'), true)
  && structuralString(ownData(value, 'declarationId'), true)
  && structuralIndex(ownData(value, 'index'))
  && structuralString(ownData(value, 'name'), true)
  && structuralLocationForText(ownData(value, 'source'), text);

const structuralLocalInvocationResultIsValid = (
  value: unknown,
  text: string | undefined,
): boolean => structuralRecordKeys(value, ['invocationId', 'source', 'expression'])
  && structuralString(ownData(value, 'invocationId'), true)
  && structuralLocationForText(ownData(value, 'source'), text)
  && structuralString(ownData(value, 'expression'));

const structuralParserValueSignatureIsValid = (
  value: Record<string, unknown>,
): boolean => {
  const status = ownData(value, 'status');
  const type = ownData(value, 'type');
  const allowed: Readonly<Record<string, readonly string[]>> = {
    static: ['string', 'number', 'boolean', 'nil', 'function', 'reference'],
    dynamic: ['string', 'number', 'boolean', 'reference', 'expression', 'unknown'],
    unknown: ['identifier', 'reference', 'expression', 'number', 'unknown'],
  };
  if (!structuralEnum(status, ['static', 'dynamic', 'unknown'])
    || !structuralEnum(type, [
      'string', 'number', 'boolean', 'nil', 'table', 'function', 'reference', 'identifier', 'expression', 'unknown',
    ])
    || !allowed[status].includes(type)) return false;
  const hasValue = Object.prototype.hasOwnProperty.call(value, 'value');
  const literal = ownData(value, 'value');
  if (type === 'nil') {
    if (status !== 'static' || !hasValue || literal !== null) return false;
  } else if (hasValue) {
    if (status !== 'static') return false;
    if (type === 'number' && !structuralFiniteNumber(literal)) return false;
    if (type === 'string' && typeof literal !== 'string') return false;
    if (type === 'boolean' && typeof literal !== 'boolean') return false;
    if (!['number', 'string', 'boolean'].includes(type)) return false;
  } else if (status === 'static' && ['number', 'string', 'boolean'].includes(type)) return false;
  const reference = ownData(value, 'reference');
  if (status === 'static' && type === 'reference' && !isRecord(reference)) return false;
  if (reference !== undefined && type !== 'reference') return false;
  if (ownData(value, 'sourceLiteral') !== undefined
    && (status !== 'static' || !['string', 'number', 'boolean', 'nil'].includes(type))) return false;
  if (ownData(value, 'reason') !== undefined && status === 'static') return false;
  if (status !== 'static' && !structuralString(ownData(value, 'reason'))) return false;
  if (ownData(value, 'symbol') !== undefined && status !== 'unknown') return false;
  if (ownData(value, 'parameter') !== undefined && (status !== 'unknown' || type !== 'identifier')) return false;
  return ownData(value, 'localInvocationResult') === undefined
    || (status === 'dynamic' && type === 'expression');
};

const structuralSourcePinIsValid = (value: unknown): boolean => {
  if (!structuralRecordKeys(value, ['sourcePath', 'lineStart', 'lineEnd'])) return false;
  const lineStart = ownData(value, 'lineStart');
  const lineEnd = ownData(value, 'lineEnd');
  return structuralString(ownData(value, 'sourcePath'), true)
    && typeof lineStart === 'number'
    && Number.isSafeInteger(lineStart)
    && lineStart >= 1
    && typeof lineEnd === 'number'
    && Number.isSafeInteger(lineEnd)
    && lineEnd >= lineStart;
};

const structuralColorLiteralFieldIsValid = (
  value: unknown,
  text: string | undefined,
): boolean => structuralRecordKeys(value, ['value', 'expression', 'source', 'keySource'])
  && structuralFiniteNumber(ownData(value, 'value'))
  && structuralString(ownData(value, 'expression'))
  && structuralLocationForText(ownData(value, 'source'), text)
  && structuralLocationForText(ownData(value, 'keySource'), text);

const structuralColorChannelsIsValid = (
  value: unknown,
  text: string | undefined,
): boolean => {
  if (!structuralRecordKeys(value, ['r', 'g', 'b', 'a'], ['glow'])) return false;
  const channels = value as Record<string, unknown>;
  return structuralColorLiteralFieldIsValid(ownData(channels, 'r'), text)
    && structuralColorLiteralFieldIsValid(ownData(channels, 'g'), text)
    && structuralColorLiteralFieldIsValid(ownData(channels, 'b'), text)
    && structuralColorLiteralFieldIsValid(ownData(channels, 'a'), text)
    && (!Object.prototype.hasOwnProperty.call(channels, 'glow')
      || structuralColorLiteralFieldIsValid(ownData(channels, 'glow'), text));
};

const structuralColorValueIsValid = (value: unknown): boolean =>
  isExactX4UiLayoutColorValue(value);

const structuralDescriptorFactIsValid = (
  value: unknown,
  text: string | undefined,
): boolean => {
  if (!isRecord(value)) return false;
  const status = ownData(value, 'status');
  if (status === 'known') {
    if (!structuralRecordKeys(
      value,
      ['status', 'expectedType', 'value', 'provenance', 'expression', 'source'],
      ['sourcePin', 'sampleId'],
    )) return false;
    const expectedType = ownData(value, 'expectedType');
    const literal = ownData(value, 'value');
    const literalValid = expectedType === 'color-object'
      ? structuralColorValueIsValid(literal)
      : ((expectedType === 'number' && structuralFiniteNumber(literal))
        || (expectedType === 'string' && typeof literal === 'string')
        || (expectedType === 'boolean' && typeof literal === 'boolean'));
    const provenanceValid = expectedType === 'color-object'
      ? structuralEnum(ownData(value, 'provenance'), [
        'source-literal', 'canonical-default-only', 'direct-helper-scale', 'preview-sample',
      ])
      : structuralEnum(ownData(value, 'provenance'), [
        'source-literal', 'source-pinned-default', 'direct-helper-scale', 'preview-sample',
      ]);
    return (expectedType === 'color-object' || structuralEnum(expectedType, ['number', 'string', 'boolean']))
      && literalValid
      && provenanceValid
      && structuralString(ownData(value, 'expression'))
      && structuralLocationForText(ownData(value, 'source'), text)
      && structuralOptionalData(value, 'sourcePin', structuralSourcePinIsValid)
      && structuralOptionalData(value, 'sampleId', candidate => structuralString(candidate, true));
  }
  if (status !== 'unavailable'
    || !structuralRecordKeys(
      value,
      ['status', 'expectedType', 'reason', 'source'],
      ['expression', 'sourcePin'],
    )) return false;
  return structuralEnum(ownData(value, 'expectedType'), ['number', 'string', 'boolean', 'color-object'])
    && structuralString(ownData(value, 'reason'))
    && structuralLocationForText(ownData(value, 'source'), text)
    && structuralOptionalData(value, 'expression', structuralString)
    && structuralOptionalData(value, 'sourcePin', structuralSourcePinIsValid);
};

const structuralKernelProvenanceIsValid = (value: unknown): boolean =>
  structuralRecordKeys(value, [
    'id', 'version', 'helperSourcePath', 'helperSha256', 'helperLineAnchors', 'widgetSourcePath', 'widgetSha256', 'widgetLineAnchors',
  ]) && sameClosedData(value, X4_LAYOUT_PROVENANCE);

const structuralKernelMetricsIsValid = (value: unknown): boolean => {
  if (!structuralRecordKeys(value, ['uiScale', 'borderSize', 'scrollbarWidth', 'standardContainerOffset'])) return false;
  const uiScale = ownData(value, 'uiScale');
  const borderSize = ownData(value, 'borderSize');
  const scrollbarWidth = ownData(value, 'scrollbarWidth');
  const standardContainerOffset = ownData(value, 'standardContainerOffset');
  return structuralFiniteNumber(uiScale)
    && structuralFiniteNumber(borderSize)
    && structuralFiniteNumber(scrollbarWidth)
    && structuralFiniteNumber(standardContainerOffset)
    && uiScale > 0
    && borderSize >= 0
    && scrollbarWidth >= 0
    && standardContainerOffset >= 0;
};

const structuralKernelCellIsValid = (value: unknown): boolean => {
  if (!structuralRecordKeys(value, ['type', 'colspan', 'bgcolspan', 'y', 'height', 'scaling', 'affectRowHeight', 'hotkey', 'displayIcon'], ['minTextHeight'])) return false;
  const height = ownData(value, 'height');
  const minTextHeight = ownData(value, 'minTextHeight');
  if (!structuralFiniteNumber(height) || height < 0) return false;
  if (minTextHeight !== undefined && (!structuralFiniteNumber(minTextHeight) || minTextHeight < 0)) return false;
  return structuralEnum(ownData(value, 'type'), ['cell', 'text', 'boxtext', 'icon', 'button', 'editbox'])
    && structuralIndex(ownData(value, 'colspan'))
    && structuralIndex(ownData(value, 'bgcolspan'))
    && structuralFiniteNumber(ownData(value, 'y'))
    && structuralBoolean(ownData(value, 'scaling'))
    && structuralBoolean(ownData(value, 'affectRowHeight'))
    && structuralString(ownData(value, 'hotkey'))
    && structuralBoolean(ownData(value, 'displayIcon'))
    && structuralOptionalData(value, 'minTextHeight', structuralFiniteNumber);
};

const structuralKernelRowIsValid = (
  value: unknown,
  columnCount: number,
  rowGroupCount: number,
): boolean => {
  if (!structuralRecordKeys(value, ['fixed', 'borderBelow', 'paddingTop', 'paddingBottom', 'scaling', 'cells'], ['groupIndex'])) return false;
  const groupIndex = ownData(value, 'groupIndex');
  const cells = ownData(value, 'cells');
  return structuralBoolean(ownData(value, 'fixed'))
    && structuralBoolean(ownData(value, 'borderBelow'))
    && structuralFiniteNumber(ownData(value, 'paddingTop'))
    && structuralFiniteNumber(ownData(value, 'paddingBottom'))
    && structuralBoolean(ownData(value, 'scaling'))
    && structuralOptionalData(value, 'groupIndex', candidate => structuralIndex(candidate) && candidate >= 1)
    && Array.isArray(cells)
    && (groupIndex === undefined || (structuralIndex(groupIndex) && groupIndex >= 1 && groupIndex <= rowGroupCount))
    && (ownData(value, 'paddingTop') as number) >= 0
    && (ownData(value, 'paddingBottom') as number) >= 0
    && cells.length === columnCount
    && cells.every(cell => structuralKernelCellIsValid(cell));
};

const structuralKernelDiagnosticIsValid = (value: unknown): boolean =>
  structuralRecordKeys(value, ['code', 'message', 'provenance'])
  && structuralEnum(ownData(value, 'code'), [
    'reserve-scrollbar-no-variable-column',
    'reserve-scrollbar-insufficient-space',
    'colspan-clamped',
    'colspan-hid-non-cell',
    'background-colspan-clamped',
  ])
  && structuralString(ownData(value, 'message'))
  && structuralKernelProvenanceIsValid(ownData(value, 'provenance'));

const structuralKernelStateIsValid = (value: unknown): boolean => {
  if (!structuralRecordKeys(value, [
    'provenance', 'frameWidth', 'metrics', 'requestedWidth', 'properties', 'columns', 'rows', 'rowGroups', 'createdWithScrollBar', 'final', 'diagnostics', 'editBoxDefaults',
  ])) return false;
  const frameWidth = ownData(value, 'frameWidth');
  const requestedWidth = ownData(value, 'requestedWidth');
  const properties = ownData(value, 'properties');
  const columns = ownData(value, 'columns');
  const rows = ownData(value, 'rows');
  const rowGroups = ownData(value, 'rowGroups');
  const diagnostics = ownData(value, 'diagnostics');
  const editBoxDefaults = ownData(value, 'editBoxDefaults');
  if (!structuralKernelProvenanceIsValid(ownData(value, 'provenance'))
    || !structuralFiniteNumber(frameWidth)
    || !structuralKernelMetricsIsValid(ownData(value, 'metrics'))
    || !structuralFiniteNumber(requestedWidth)
    || !structuralRecordKeys(properties, ['width', 'x', 'scaling', 'reserveScrollBar'])
    || !structuralFiniteNumber(ownData(properties, 'width'))
    || !structuralFiniteNumber(ownData(properties, 'x'))
    || !structuralBoolean(ownData(properties, 'scaling'))
    || !structuralBoolean(ownData(properties, 'reserveScrollBar'))
    || !Array.isArray(columns)
    || columns.length === 0
    || !Array.isArray(rows)
    || !Array.isArray(rowGroups)
    || !structuralBoolean(ownData(value, 'createdWithScrollBar'))
    || !structuralBoolean(ownData(value, 'final'))
    || !Array.isArray(diagnostics)
    || !structuralRecordKeys(editBoxDefaults, [], ['height', 'scaling', 'hotkey', 'displayIcon'])
    || !structuralOptionalData(editBoxDefaults, 'height', candidate => structuralFiniteNumber(candidate) && candidate >= 0)
    || !structuralOptionalData(editBoxDefaults, 'scaling', structuralBoolean)
    || !structuralOptionalData(editBoxDefaults, 'hotkey', structuralString)
    || !structuralOptionalData(editBoxDefaults, 'displayIcon', structuralBoolean)) return false;
  for (const column of columns) {
    if (!structuralRecordKeys(column, ['width', 'percent', 'min', 'weight', 'colspan', 'bgcolspan'], ['scaling'])) return false;
    const width = ownData(column, 'width');
    const weight = ownData(column, 'weight');
    if (!structuralFiniteNumber(width)
      || !structuralBoolean(ownData(column, 'percent'))
      || !structuralBoolean(ownData(column, 'min'))
      || !structuralFiniteNumber(weight)
      || !structuralPositiveIndex(ownData(column, 'colspan'))
      || !structuralPositiveIndex(ownData(column, 'bgcolspan'))
      || !structuralOptionalData(column, 'scaling', structuralBoolean)
      || width < 0
      || weight < 0) return false;
  }
  for (const rowGroup of rowGroups) {
    if (!structuralRecordKeys(rowGroup, ['level']) || !structuralIndex(ownData(rowGroup, 'level'))) return false;
  }
  if (!structuralBoolean(ownData(value, 'final')) && rows.length > 0) return false;
  if (!rows.every(row => structuralKernelRowIsValid(row, columns.length, rowGroups.length))) return false;
  return diagnostics.every(diagnostic => structuralKernelDiagnosticIsValid(diagnostic));
};

const structuralKernelFailureIsValid = (value: unknown, allowState: boolean): boolean => {
  if (!structuralRecordKeys(value, ['status', 'code', 'message', 'provenance'], allowState ? ['state'] : [])) return false;
  const status = ownData(value, 'status');
  const code = ownData(value, 'code');
  const hasState = Object.prototype.hasOwnProperty.call(value, 'state');
  return structuralEnum(status, ['refused', 'unsupported'])
    && structuralEnum(code, [
      'invalid-input', 'invalid-number', 'invalid-domain', 'invalid-count', 'invalid-index', 'invalid-span', 'invalid-cell',
      'finalized', 'columns-not-finalized', 'unsupported-dynamic-input', 'missing-min-text-height',
      'reserve-scrollbar-no-variable-column', 'reserve-scrollbar-insufficient-space', 'widget-percent-overflow',
      'widget-pixel-overflow', 'numeric-overflow',
    ])
    && structuralString(ownData(value, 'message'))
    && structuralKernelProvenanceIsValid(ownData(value, 'provenance'))
    && (!allowState || (hasState && structuralKernelStateIsValid(ownData(value, 'state'))));
};

const structuralOperationKernelEnvelopeIsValid = (value: unknown): boolean => {
  if (!isRecord(value)) return false;
  const hasBefore = Object.prototype.hasOwnProperty.call(value, 'stateBefore');
  const hasAfter = Object.prototype.hasOwnProperty.call(value, 'stateAfter');
  const hasRefusal = Object.prototype.hasOwnProperty.call(value, 'refusal');
  const keys = Object.keys(value);
  if (hasRefusal && !hasBefore && !hasAfter) {
    return keys.length === 1 && keys[0] === 'refusal' && structuralKernelFailureIsValid(ownData(value, 'refusal'), false);
  }
  if (hasRefusal) {
    const beforeValid = structuralKernelStateIsValid(ownData(value, 'stateBefore'));
    const afterValid = structuralKernelStateIsValid(ownData(value, 'stateAfter'));
    const refusalValid = structuralKernelFailureIsValid(ownData(value, 'refusal'), true);
    if (!hasBefore || !hasAfter || keys.length !== 3
      || !beforeValid
      || !afterValid
      || !refusalValid) return false;
    const stateBefore = ownData(value, 'stateBefore');
    const stateAfter = ownData(value, 'stateAfter');
    const refusal = ownData(value, 'refusal');
    return sameClosedData(stateBefore, stateAfter)
      && isRecord(refusal)
      && sameClosedData(ownData(refusal, 'state'), stateAfter);
  }
  if (hasBefore && hasAfter) {
    return keys.length === 2
      && structuralKernelStateIsValid(ownData(value, 'stateBefore'))
      && structuralKernelStateIsValid(ownData(value, 'stateAfter'));
  }
  return !hasBefore && hasAfter
    && keys.length === 1
    && structuralKernelStateIsValid(ownData(value, 'stateAfter'));
};

const structuralOperationLocalExpansionIsValid = (value: unknown): boolean =>
  structuralRecordKeys(value, ['invocationId', 'ancestry', 'depth', 'previewPathSelectionIds'])
  && structuralString(ownData(value, 'invocationId'), true)
  && structuralStringArray(ownData(value, 'ancestry'))
  && structuralIndex(ownData(value, 'depth'))
  && structuralStringArray(ownData(value, 'previewPathSelectionIds'));

const structuralProducerSchemaNodeIsValid = (
  value: unknown,
  schema: StructuralRecordSchema,
  splice?: StructuralSplice,
): boolean => {
  const text = splice ? (splice.side === 'before' ? splice.beforeText : splice.afterText) : undefined;
  if (schema === 'source-location') return structuralLocationForText(value, text);
  if (schema === 'parser-values'
    || schema === 'parser-properties'
    || schema === 'branch-paths'
    || schema === 'loop-paths'
    || schema === 'source-locations') return Array.isArray(value);
  if (!isRecord(value)) return false;
  if (schema === 'property-record') {
    const source = ownData(value, 'source');
    const sourceBounds = structuralLocationBounds(source);
    const sourceOrder = ownData(value, 'sourceOrder');
    return structuralRecordKeys(value, [
      'recordType', 'name', 'path', 'source', 'sourceOrder', 'order', 'value', 'assignment', 'context',
    ], ['owner'])
      && ownData(value, 'recordType') === 'property'
      && structuralString(ownData(value, 'name'), true)
      && structuralString(ownData(value, 'path'), true)
      && structuralLocationForText(source, text)
      && sourceBounds !== undefined
      && structuralIndex(sourceOrder)
      && sourceOrder >= sourceBounds.start
      && sourceOrder <= sourceBounds.end
      && structuralIndex(ownData(value, 'order'))
      && structuralProducerSchemaNodeIsValid(ownData(value, 'value'), 'parser-value', splice)
      && structuralEnum(ownData(value, 'assignment'), [
        'table-field', 'member-assignment', 'index-assignment', 'function-declaration',
      ])
      && structuralProducerSchemaNodeIsValid(ownData(value, 'context'), 'call-context', splice)
      && structuralOptionalData(value, 'owner', candidate =>
        structuralProducerSchemaNodeIsValid(candidate, 'parser-value', splice));
  }
  if (schema === 'handler-record') {
    const source = ownData(value, 'source');
    const sourceBounds = structuralLocationBounds(source);
    const sourceOrder = ownData(value, 'sourceOrder');
    return structuralRecordKeys(value, [
      'recordType', 'name', 'path', 'source', 'sourceOrder', 'order', 'value', 'context',
    ], ['functionSource', 'bodySource', 'parameters'])
      && ownData(value, 'recordType') === 'handler'
      && ownData(value, 'name') === 'onClick'
      && structuralString(ownData(value, 'path'), true)
      && structuralLocationForText(source, text)
      && sourceBounds !== undefined
      && structuralIndex(sourceOrder)
      && sourceOrder >= sourceBounds.start
      && sourceOrder <= sourceBounds.end
      && structuralIndex(ownData(value, 'order'))
      && structuralProducerSchemaNodeIsValid(ownData(value, 'value'), 'parser-value', splice)
      && structuralProducerSchemaNodeIsValid(ownData(value, 'context'), 'call-context', splice)
      && structuralOptionalData(value, 'functionSource', candidate => structuralLocationForText(candidate, text))
      && structuralOptionalData(value, 'bodySource', candidate => structuralLocationForText(candidate, text))
      && structuralOptionalData(value, 'parameters', structuralStringArray);
  }
  if (schema === 'alias-record') {
    const source = ownData(value, 'source');
    const sourceBounds = structuralLocationBounds(source);
    const sourceOrder = ownData(value, 'sourceOrder');
    return structuralRecordKeys(value, [
      'recordType', 'name', 'source', 'sourceOrder', 'order', 'value', 'aliasKind', 'context',
    ])
      && ownData(value, 'recordType') === 'alias'
      && structuralString(ownData(value, 'name'), true)
      && structuralLocationForText(source, text)
      && sourceBounds !== undefined
      && structuralIndex(sourceOrder)
      && sourceOrder >= sourceBounds.start
      && sourceOrder <= sourceBounds.end
      && structuralIndex(ownData(value, 'order'))
      && structuralProducerSchemaNodeIsValid(ownData(value, 'value'), 'parser-value', splice)
      && structuralEnum(ownData(value, 'aliasKind'), ['definition', 'assignment'])
      && structuralProducerSchemaNodeIsValid(ownData(value, 'context'), 'call-context', splice);
  }
  if (schema === 'call') {
    if (!structuralRecordKeys(value, [
      'recordType', 'name', 'callee', 'method', 'source', 'enclosingStatement', 'sourceOrder', 'order',
      'arguments', 'semantics', 'context',
    ], ['receiver', 'result', 'assignedTo'])) return false;
    const source = structuralLocationBounds(ownData(value, 'source'));
    const sourceOrder = ownData(value, 'sourceOrder');
    const semantics = ownData(value, 'semantics');
    return ownData(value, 'recordType') === 'call'
      && structuralEnum(ownData(value, 'name'), [
        'createFrameHandle', 'addTable', 'setColWidthPercent', 'setColWidth', 'addRow', 'setColSpan', 'display',
        'OpenMenu', 'setText', 'setText2', 'createText', 'createEditBox', 'createButton', 'createIcon',
        'scaleX', 'scaleY', 'scaleFont', 'setDefaultCellProperties', 'setDefaultComplexCellProperties', 'setHotkey',
      ])
      && structuralString(ownData(value, 'callee'), true)
      && structuralEnum(ownData(value, 'method'), [':', '.', 'direct', 'unknown'])
      && structuralLocationForText(ownData(value, 'source'), text)
      && source !== undefined
      && structuralIndex(sourceOrder)
      && sourceOrder >= source.start
      && sourceOrder <= source.end
      && structuralIndex(ownData(value, 'order'))
      && Array.isArray(ownData(value, 'arguments'))
      && isRecord(semantics)
      && Object.keys(semantics).length > 0
      && isRecord(ownData(value, 'enclosingStatement'))
      && isRecord(ownData(value, 'context'))
      && structuralOptionalData(value, 'receiver', isRecord)
      && structuralOptionalData(value, 'result', isRecord)
      && structuralOptionalData(value, 'assignedTo', structuralStringArray);
  }
  if (schema === 'operation') {
    if (!structuralRecordKeys(value, [
      'id', 'kind', 'source', 'sourceOrder', 'modelOrder', 'status', 'metadata', 'descriptorFacts',
    ], ['frameId', 'tableId', 'rowId', 'cellId', 'reason', 'kernel', 'scale', 'localExpansion'])) return false;
    const source = structuralLocationBounds(ownData(value, 'source'));
    const sourceOrder = ownData(value, 'sourceOrder');
    const descriptorFacts = ownData(value, 'descriptorFacts');
    const kind = ownData(value, 'kind');
    const status = ownData(value, 'status');
    const allowedOwnerKeys = typeof kind === 'string' ? structuralOperationOwnerKeysByKind[kind] : undefined;
    const ownerRequired = status === 'applied'
      || status === 'rejected'
      || ownData(value, 'kernel') !== undefined
      || kind === 'addTable';
    const requiresFacts = ownData(value, 'status') === 'applied'
      && ownData(value, 'kind') !== 'display'
      && ownData(value, 'kind') !== 'OpenMenu';
    return structuralString(ownData(value, 'id'), true)
      && structuralEnum(ownData(value, 'kind'), [
        'createFrameHandle', 'addTable', 'setColWidthPercent', 'setColWidth', 'addRow', 'setColSpan', 'display',
        'OpenMenu', 'setText', 'setText2', 'createText', 'createEditBox', 'createButton', 'createIcon',
        'scaleX', 'scaleY', 'scaleFont', 'setDefaultCellProperties', 'setDefaultComplexCellProperties', 'setHotkey',
      ])
      && structuralLocationForText(ownData(value, 'source'), text)
      && source !== undefined
      && structuralIndex(sourceOrder)
      && sourceOrder >= source.start
      && sourceOrder <= source.end
      && structuralIndex(ownData(value, 'modelOrder'))
      && structuralEnum(ownData(value, 'status'), ['applied', 'rejected', 'unresolved', 'unreachable', 'conditional'])
      && isRecord(ownData(value, 'metadata'))
      && isRecord(descriptorFacts)
      && (!requiresFacts || Object.keys(descriptorFacts).length > 0)
      && ['frameId', 'tableId', 'rowId', 'cellId'].every(key =>
        structuralOptionalData(value, key, candidate => structuralString(candidate, true)))
      && structuralOptionalData(value, 'reason', structuralString)
      && structuralOptionalData(value, 'kernel', structuralOperationKernelEnvelopeIsValid)
      && structuralOptionalData(value, 'scale', isRecord)
      && structuralOptionalData(value, 'localExpansion', structuralOperationLocalExpansionIsValid)
      && allowedOwnerKeys !== undefined
      && ['frameId', 'tableId', 'rowId', 'cellId'].every(key => {
        const present = Object.prototype.hasOwnProperty.call(value, key) && ownData(value, key) !== undefined;
        return (!present || allowedOwnerKeys.includes(key))
          && (!ownerRequired || !allowedOwnerKeys.includes(key) || present);
      });
  }
  if (schema === 'call-metadata') {
    const semantics = ownData(value, 'semantics');
    return structuralRecordKeys(value, ['arguments', 'semantics'], ['receiver', 'result'])
      && Array.isArray(ownData(value, 'arguments'))
      && isRecord(semantics)
      && Object.keys(semantics).length > 0
      && structuralOptionalData(value, 'receiver', isRecord)
      && structuralOptionalData(value, 'result', isRecord);
  }
  if (schema === 'call-semantics') {
    const keys = [
      'count', 'index', 'span', 'width', 'percentage', 'height', 'layer', 'menu', 'menuName', 'frame', 'table',
      'row', 'cell', 'dataFlow', 'text', 'editBox', 'fontsize', 'options', 'properties', 'unsupportedProperties',
      'rowData', 'icon', 'scaling', 'scale', 'cellType', 'propertyName', 'hotkey', 'displayIcon',
    ];
    return structuralRecordKeys(value, [], keys);
  }
  if (schema === 'edit-box-semantics') {
    return structuralRecordKeys(value, [], ['defaultText', 'description'])
      && Object.keys(value).length > 0;
  }
  if (schema === 'scale-semantics') {
    if (!structuralRecordKeys(value, [], ['input', 'fontname', 'fontsize', 'enabled'])) return false;
    const hasInput = Object.prototype.hasOwnProperty.call(value, 'input') && ownData(value, 'input') !== undefined;
    const hasFontName = Object.prototype.hasOwnProperty.call(value, 'fontname') && ownData(value, 'fontname') !== undefined;
    const hasFontSize = Object.prototype.hasOwnProperty.call(value, 'fontsize') && ownData(value, 'fontsize') !== undefined;
    return hasInput ? !hasFontName && !hasFontSize : hasFontName && hasFontSize;
  }
  if (schema === 'parser-value') {
    if (!structuralRecordKeys(value, ['status', 'type', 'expression', 'location'], [
      'value', 'reference', 'symbol', 'reason', 'parameter', 'localInvocationResult', 'sourceLiteral',
    ])) return false;
    const location = ownData(value, 'location');
    const sourceLiteral = ownData(value, 'sourceLiteral');
    const locationBounds = structuralLocationBounds(location);
    const literalBounds = structuralLocationBounds(sourceLiteral);
    return structuralParserValueSignatureIsValid(value)
      && structuralString(ownData(value, 'expression'))
      && structuralLocationForText(location, text)
      && structuralOptionalData(value, 'reference', isRecord)
      && structuralOptionalData(value, 'symbol', structuralString)
      && structuralOptionalData(value, 'reason', structuralString)
      && structuralOptionalData(value, 'parameter', candidate => structuralParameterIdentityIsValid(candidate, text))
      && structuralOptionalData(value, 'localInvocationResult', candidate =>
        structuralLocalInvocationResultIsValid(candidate, text))
      && structuralOptionalData(value, 'sourceLiteral', candidate => structuralLocationForText(candidate, text))
      && (sourceLiteral === undefined
        || sameClosedData(sourceLiteral, location)
        || (isRecord(sourceLiteral)
          && isRecord(location)
          && ownData(sourceLiteral, 'file') === ownData(location, 'file')
          && ownData(sourceLiteral, 'sourcePath') === ownData(location, 'sourcePath')
          && literalBounds !== undefined
          && locationBounds !== undefined
          && literalBounds.end <= locationBounds.start));
  }
  if (schema === 'parser-reference') {
    return structuralRecordKeys(value, ['kind', 'path', 'origin', 'source'], [
      'parentPath', 'relatedPath', 'index', 'helperAliasSource', 'helperRuntimeAvailability',
    ])
      && structuralEnum(ownData(value, 'kind'), ['global', 'menu', 'frame', 'table', 'row', 'cell', 'object', 'handler', 'unknown'])
      && structuralString(ownData(value, 'path'))
      && structuralEnum(ownData(value, 'origin'), ['global', 'literal', 'call', 'alias', 'index', 'property', 'unknown'])
      && structuralLocationForText(ownData(value, 'source'), text)
      && structuralOptionalData(value, 'parentPath', structuralString)
      && structuralOptionalData(value, 'relatedPath', structuralString)
      && structuralOptionalData(value, 'index', isRecord)
      && structuralOptionalData(value, 'helperAliasSource', candidate => structuralLocationForText(candidate, text))
      && structuralOptionalData(value, 'helperRuntimeAvailability', candidate => candidate === 'unverified');
  }
  if (schema === 'parser-parameter') return structuralParameterIdentityIsValid(value, text);
  if (schema === 'parser-local-invocation-result') return structuralLocalInvocationResultIsValid(value, text);
  if (schema === 'parser-property') {
    const source = ownData(value, 'source');
    const sourceBounds = structuralLocationBounds(source);
    return structuralRecordKeys(value, ['name', 'normalizedName', 'value', 'source', 'sourceOrder'])
      && structuralString(ownData(value, 'name'))
      && structuralString(ownData(value, 'normalizedName'))
      && isRecord(ownData(value, 'value'))
      && structuralLocationForText(source, text)
      && sourceBounds !== undefined
      && ownData(value, 'sourceOrder') === sourceBounds.start;
  }
  if (schema === 'enclosing-statement') {
    return structuralRecordKeys(value, [
      'source', 'deletionSource', 'terminator', 'kind', 'isStandaloneCallStatementRoot',
    ])
      && structuralLocationForText(ownData(value, 'source'), text)
      && structuralLocationForText(ownData(value, 'deletionSource'), text)
      && structuralEnum(ownData(value, 'terminator'), ['none', 'semicolon'])
      && structuralEnum(ownData(value, 'kind'), [
        'local', 'assignment', 'function', 'call', 'return', 'if', 'while', 'repeat', 'numeric-for',
        'generic-for', 'do', 'break', 'goto', 'label', 'unknown',
      ])
      && typeof ownData(value, 'isStandaloneCallStatementRoot') === 'boolean';
  }
  if (schema === 'call-context') {
    return structuralRecordKeys(value, ['kind', 'branchPath', 'loopPath', 'reachability'], ['name', 'handler', 'source'])
      && structuralEnum(ownData(value, 'kind'), ['top-level', 'function', 'handler'])
      && Array.isArray(ownData(value, 'branchPath'))
      && Array.isArray(ownData(value, 'loopPath'))
      && structuralEnum(ownData(value, 'reachability'), ['reachable', 'conditional', 'unreachable'])
      && structuralOptionalData(value, 'name', structuralString)
      && structuralOptionalData(value, 'handler', structuralString)
      && structuralOptionalData(value, 'source', candidate => structuralLocationForText(candidate, text));
  }
  if (schema === 'branch-path') {
    return structuralRecordKeys(value, ['boundaryId', 'boundary', 'armId', 'arm', 'armIndex', 'reachability'])
      && structuralString(ownData(value, 'boundaryId'), true)
      && structuralLocationForText(ownData(value, 'boundary'), text)
      && structuralString(ownData(value, 'armId'), true)
      && structuralEnum(ownData(value, 'arm'), ['then', 'elseif', 'else'])
      && structuralIndex(ownData(value, 'armIndex'))
      && structuralEnum(ownData(value, 'reachability'), ['reachable', 'conditional', 'unreachable']);
  }
  if (schema === 'loop-path') {
    return structuralRecordKeys(value, ['source', 'kind', 'multiplicity'])
      && structuralLocationForText(ownData(value, 'source'), text)
      && structuralEnum(ownData(value, 'kind'), ['while', 'repeat', 'numeric-for', 'generic-for'])
      && structuralEnum(ownData(value, 'multiplicity'), ['zero-or-more', 'one-or-more']);
  }
  if (schema === 'descriptor-facts') {
    return Object.keys(value).every(key => key.length > 0);
  }
  if (schema === 'descriptor-fact') return structuralDescriptorFactIsValid(value, text);
  if (schema === 'color-value') return structuralColorValueIsValid(value);
  if (schema === 'color-channels') return structuralColorChannelsIsValid(value, text);
  if (schema === 'color-literal-field') return structuralColorLiteralFieldIsValid(value, text);
  if (schema === 'scale-resolution') {
    return structuralRecordKeys(value, ['status', 'value', 'sourceArguments'])
      && ownData(value, 'status') === 'resolved'
      && structuralFiniteNumber(ownData(value, 'value'))
      && Array.isArray(ownData(value, 'sourceArguments'));
  }
  return false;
};

const structuralCompleteRecordIsValid = (
  value: unknown,
  text: string,
): boolean => {
  if (!isRecord(value)) return false;
  const validationSplice: StructuralSplice = {
    beforeText: text,
    afterText: text,
    startOffset: text.length,
    endOffset: text.length,
    replacementLength: 0,
    orderShift: 0,
    side: 'after',
  };
  const recordType = ownData(value, 'recordType');
  if (recordType === 'call') return structuralProducerSchemaNodeIsValid(value, 'call', validationSplice);
  if (recordType !== 'property' && recordType !== 'handler' && recordType !== 'alias') return false;
  return structuralProducerSchemaNodeIsValid(
    value,
    recordType === 'property' ? 'property-record' : recordType === 'handler' ? 'handler-record' : 'alias-record',
    validationSplice,
  );
};

const structuralLocationInvariant = (
  value: unknown,
  splice?: StructuralSplice,
): unknown | undefined => {
  if (!splice) {
    if (!isLocationRecord(value)) return undefined;
    return {
      file: ownData(value, 'file'),
      ...(ownData(value, 'sourcePath') !== undefined ? { sourcePath: ownData(value, 'sourcePath') } : {}),
    };
  }
  if (!hasClosedStructuralKeys(value, new Set(['file', 'start', 'end']), new Set(['sourcePath']))) return undefined;
  const file = ownData(value, 'file');
  const sourcePath = ownData(value, 'sourcePath');
  const hasSourcePath = Object.prototype.hasOwnProperty.call(value, 'sourcePath');
  if (typeof file !== 'string' || (sourcePath !== undefined && typeof sourcePath !== 'string')) return undefined;
  const sourceText = splice.side === 'before' ? splice.beforeText : splice.afterText;
  const start = structuralPosition(ownData(value, 'start'), sourceText);
  const end = structuralPosition(ownData(value, 'end'), sourceText);
  if (!start || !end || start.offset > end.offset) return undefined;
  if (splice.side === 'after') {
    return {
      file,
      ...(hasSourcePath ? { sourcePath } : {}),
      start,
      end,
    };
  }
  const mapped = mapStructuralRangeOffsets(
    start.offset,
    end.offset,
    splice.startOffset,
    splice.endOffset,
    splice.replacementLength,
  );
  if (!mapped) return undefined;
  const mappedStartPosition = lineColumnAt(splice.afterText, mapped.start);
  const mappedEndPosition = lineColumnAt(splice.afterText, mapped.end);
  return {
    file,
    ...(hasSourcePath ? { sourcePath } : {}),
    start: { ...mappedStartPosition, offset: mapped.start },
    end: { ...mappedEndPosition, offset: mapped.end },
  };
};

const remapStructuralLedgerIdentity = (value: string, splice: StructuralSplice): string => {
  let result = value.replace(/^(operation:)(\d+)(\|)/, (
    _full,
    prefix: string,
    rawOrder: string,
    separator: string,
  ) => `${prefix}${Number(rawOrder) + splice.orderShift}${separator}`);
  result = result.replace(/\|\|(\d+):(\d+):(\d+)\|(\d+):(\d+):(\d+)/g, (
    _full,
    _beforeLineStart: string,
    _beforeColumnStart: string,
    rawStart: string,
    _beforeLineEnd: string,
    _beforeColumnEnd: string,
    rawEnd: string,
  ) => {
    const mapped = mapStructuralRangeOffsets(
      Number(rawStart),
      Number(rawEnd),
      splice.startOffset,
      splice.endOffset,
      splice.replacementLength,
    );
    if (!mapped) return '||<invalid-splice-location>|<invalid-splice-location>';
    const start = lineColumnAt(splice.afterText, mapped.start);
    const end = lineColumnAt(splice.afterText, mapped.end);
    return `||${start.line}:${start.column}:${mapped.start}|${end.line}:${end.column}:${mapped.end}`;
  });
  return result;
};

const structuralOrderShift = (
  entry: X4UiSourceEditStructuralEntry,
  beforeOffset: number,
  beforeRecords: readonly unknown[],
  afterRecords: readonly unknown[],
  replacementLength = 0,
): number => {
  const completeRecordSourceStart = (value: unknown): number | undefined => {
    const source = isRecord(value) ? ownData(value, 'source') : undefined;
    const bounds = structuralLocationBounds(source);
    return bounds?.start;
  };
  const completeRecordSourceEnd = (value: unknown): number | undefined => {
    const source = isRecord(value) ? ownData(value, 'source') : undefined;
    const bounds = structuralLocationBounds(source);
    return bounds?.end;
  };
  const insertedBefore = (entry.kind === 'insert-call' || entry.kind === 'insert-block' || entry.kind === 'replace-statement') && beforeOffset >= entry.startOffset
    ? afterRecords.filter(record => {
      const start = completeRecordSourceStart(record);
      const end = completeRecordSourceEnd(record);
      const insertedStart = entry.startOffset + (entry.kind === 'replace-statement' ? 0 : entry.indentation.length);
      const insertedEnd = entry.startOffset + replacementLength;
      return start !== undefined && end !== undefined
        && start >= insertedStart
        && end <= insertedEnd;
    }).length
    : 0;
  const removedBefore = (entry.kind === 'delete-statement' || entry.kind === 'replace-statement')
    ? beforeRecords.filter(record => {
      const start = completeRecordSourceStart(record);
      const end = completeRecordSourceEnd(record);
      return start !== undefined && end !== undefined
        && start >= entry.startOffset
        && end <= entry.endOffset
        && start < beforeOffset;
    }).length
    : 0;
  return insertedBefore - removedBefore;
};

const remapSourceDerivedIdentity = (value: string, splice: StructuralSplice): string => {
  if (splice.side === 'after') return value;
  const mappedOffset = (raw: string): number | undefined => mapStructuralOffset(
    Number(raw),
    splice.startOffset,
    splice.endOffset,
    splice.replacementLength,
  );
  const parameterMatch = /^(local-parameter:local-function:[^|]*\|[^|]*\|)(\d+)\|(\d+)(\|\d+\|)(\d+)\|(\d+)$/.exec(value);
  if (parameterMatch) {
    const declaration = mapStructuralRangeOffsets(
      Number(parameterMatch[2]),
      Number(parameterMatch[3]),
      splice.startOffset,
      splice.endOffset,
      splice.replacementLength,
    );
    const parameter = mapStructuralRangeOffsets(
      Number(parameterMatch[5]),
      Number(parameterMatch[6]),
      splice.startOffset,
      splice.endOffset,
      splice.replacementLength,
    );
    return declaration && parameter
      ? `${parameterMatch[1]}${declaration.start}|${declaration.end}${parameterMatch[4]}${parameter.start}|${parameter.end}`
      : `${parameterMatch[1]}<invalid-splice-offset>|<invalid-splice-offset>${parameterMatch[4]}<invalid-splice-offset>|<invalid-splice-offset>`;
  }
  let result = value.replace(/@(row|cell|object):(\d+)/g, (
    full,
    kind: string,
    rawOffset: string,
  ) => {
    const mapped = mappedOffset(rawOffset);
    return mapped === undefined ? `@${kind}:<invalid-splice-offset>` : full.replace(rawOffset, String(mapped));
  });
  result = result.replace(/(local-(?:invocation|function):[^|]*\|[^|]*\|)(\d+)\|(\d+)/g, (
    _full,
    prefix: string,
    rawStart: string,
    rawEnd: string,
  ) => {
    const mapped = mapStructuralRangeOffsets(
      Number(rawStart),
      Number(rawEnd),
      splice.startOffset,
      splice.endOffset,
      splice.replacementLength,
    );
    return !mapped
      ? `${prefix}<invalid-splice-offset>|<invalid-splice-offset>`
      : `${prefix}${mapped.start}|${mapped.end}`;
  });
  if (result.includes('|call|')) {
    result = result.replace(/(\|\|)(\d+):(\d+):(\d+)\|(\d+):(\d+):(\d+)/g, (
      _full,
      prefix: string,
      _beforeLineStart: string,
      _beforeColumnStart: string,
      rawStart: string,
      _beforeLineEnd: string,
      _beforeColumnEnd: string,
      rawEnd: string,
    ) => {
      const mapped = mapStructuralRangeOffsets(
        Number(rawStart),
        Number(rawEnd),
        splice.startOffset,
        splice.endOffset,
        splice.replacementLength,
      );
      if (!mapped) {
        return `${prefix}<invalid-splice-location>|<invalid-splice-location>`;
      }
      const start = lineColumnAt(splice.afterText, mapped.start);
      const end = lineColumnAt(splice.afterText, mapped.end);
      return `${prefix}${start.line}:${start.column}:${mapped.start}|${end.line}:${end.column}:${mapped.end}`;
    });
  }
  return result;
};

const remapStructuralBranchIdentity = (value: string, splice: StructuralSplice): string => {
  if (splice.side === 'after') return value;
  const match = /^([^|]*\|[^|]*\|)(\d+)\|(\d+)(:arm:\d+)?$/.exec(value);
  if (!match) return value;
  const mapped = mapStructuralRangeOffsets(
    Number(match[2]),
    Number(match[3]),
    splice.startOffset,
    splice.endOffset,
    splice.replacementLength,
  );
  return mapped
    ? `${match[1]}${mapped.start}|${mapped.end}${match[4] || ''}`
    : `${match[1]}<invalid-splice-offset>|<invalid-splice-offset>${match[4] || ''}`;
};

const sameShiftedLocation = (
  before: X4UiSourceLocation,
  after: X4UiSourceLocation,
  beforeText: string,
  afterText: string,
  startOffset: number,
  endOffset: number,
  replacementLength: number,
): boolean => {
  const mapped = mapStructuralRangeOffsets(
    before.start.offset,
    before.end.offset,
    startOffset,
    endOffset,
    replacementLength,
  );
  if (!mapped) return false;
  const startPosition = lineColumnAt(afterText, mapped.start);
  const endPosition = lineColumnAt(afterText, mapped.end);
  return after.file === before.file
    && after.sourcePath === before.sourcePath
    && after.start.offset === mapped.start
    && after.end.offset === mapped.end
    && after.start.line === startPosition.line
    && after.start.column === startPosition.column
    && after.end.line === endPosition.line
    && after.end.column === endPosition.column
    && beforeText.slice(before.start.offset, before.end.offset).length === before.end.offset - before.start.offset;
};

const sameStructuralFactAfterSplice = (
  left: unknown,
  right: unknown,
  splice: StructuralSplice,
  schema: StructuralRecordSchema = 'exact',
): boolean => {
  const leftState: StructuralInvariantState = { valid: true };
  const rightState: StructuralInvariantState = { valid: true };
  const leftInvariant = structuralInvariant(left, '', structuralIgnoredKeys, splice, leftState, schema);
  const rightInvariant = structuralInvariant(
    right,
    '',
    structuralIgnoredKeys,
    { ...splice, side: 'after' },
    rightState,
    schema,
  );
  return leftState.valid && rightState.valid && sameClosedData(leftInvariant, rightInvariant);
};

const structuralCompleteRecordInvariantAfterSplice = (
  value: Record<string, unknown>,
  splice: StructuralSplice,
  orderShift: number,
): unknown => {
  const recordType = ownData(value, 'recordType');
  if (recordType === 'call') {
    const source = ownData(value, 'source');
    const sourceBounds = structuralLocationBounds(source);
    const mappedSourceOrder = splice.side === 'after'
      ? ownData(value, 'sourceOrder') as number
      : mapStructuralOffset(
        ownData(value, 'sourceOrder') as number,
        splice.startOffset,
        splice.endOffset,
        splice.replacementLength,
      );
    if (!sourceBounds || mappedSourceOrder === undefined) return undefined;
    return {
      recordType,
      name: ownData(value, 'name'),
      source: structuralLocationInvariant(source, splice),
      sourceOrder: mappedSourceOrder,
      order: (ownData(value, 'order') as number) + orderShift,
    };
  }
  const schema: StructuralRecordSchema = recordType === 'call'
    ? 'call'
    : recordType === 'property'
      ? 'property-record'
      : recordType === 'handler'
        ? 'handler-record'
        : recordType === 'alias'
          ? 'alias-record'
          : 'exact';
  if (schema === 'exact') return undefined;
  const state: StructuralInvariantState = { valid: true };
  const normalized = structuralInvariant(value, '', structuralIgnoredKeys, {
    ...splice,
    orderShift,
  }, state, schema);
  return state.valid ? normalized : undefined;
};

const sameStructuralCompleteRecordAfterSplice = (
  left: Record<string, unknown>,
  right: Record<string, unknown>,
  splice: StructuralSplice,
  orderShift: number,
): boolean => {
  const leftInvariant = structuralCompleteRecordInvariantAfterSplice(left, splice, orderShift);
  const rightInvariant = structuralCompleteRecordInvariantAfterSplice(
    right,
    { ...splice, side: 'after' },
    0,
  );
  return leftInvariant !== undefined
    && rightInvariant !== undefined
    && sameClosedData(leftInvariant, rightInvariant);
};

const structuralOperationLedger = (value: unknown): unknown => {
  if (!isRecord(value)) return value;
  const kernel = ownData(value, 'kernel');
  if (!isRecord(kernel)) return value;
  const hasKernelState = Object.prototype.hasOwnProperty.call(kernel, 'stateBefore')
    || Object.prototype.hasOwnProperty.call(kernel, 'stateAfter');
  const envelope: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(kernel)) {
    if (key === 'stateBefore' || key === 'stateAfter') continue;
    if (key === 'refusal' && hasKernelState && isRecord(child)) {
      envelope[key] = Object.fromEntries(
        Object.entries(child).filter(([childKey]) => childKey !== 'state'),
      );
    } else {
      envelope[key] = child;
    }
  }
  if (Object.keys(envelope).length === 0) {
    return Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'kernel'));
  }
  return {
    ...value,
    kernel: envelope,
  };
};

const sameStructuralOperationFactAfterSplice = (
  left: unknown,
  right: unknown,
  splice: StructuralSplice,
): boolean => {
  const afterSplice: StructuralSplice = { ...splice, side: 'after' };
  if (!structuralProducerSchemaNodeIsValid(left, 'operation', splice)
    || !structuralProducerSchemaNodeIsValid(right, 'operation', afterSplice)) return false;
  const leftState: StructuralInvariantState = { valid: true };
  const rightState: StructuralInvariantState = { valid: true };
  const leftInvariant = structuralInvariant(
    structuralOperationLedger(left),
    '',
    structuralOperationIgnoredKeys,
    splice,
    leftState,
    'operation',
  );
  const rightInvariant = structuralInvariant(
    structuralOperationLedger(right),
    '',
    structuralOperationIgnoredKeys,
    afterSplice,
    rightState,
    'operation',
  );
  return leftState.valid && rightState.valid && sameClosedData(leftInvariant, rightInvariant);
};

const structuralKernelEnvelope = (operation: X4UiLayoutOperation): unknown => {
  const kernel = ownData(operation as unknown as object, 'kernel');
  if (!isRecord(kernel)) return kernel;
  const envelope: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(kernel)) {
    if (key !== 'stateBefore' && key !== 'stateAfter') envelope[key] = value;
  }
  return envelope;
};

const sameStructuralKernelEnvelopeAfterSplice = (
  left: X4UiLayoutOperation,
  right: X4UiLayoutOperation,
  splice: StructuralSplice,
): boolean => sameStructuralFactAfterSplice(
  structuralKernelEnvelope(left),
  structuralKernelEnvelope(right),
  splice,
);

const structuralKernelStateAfterSplice = (
  left: X4UiLayoutOperation,
  right: X4UiLayoutOperation,
  splice: StructuralSplice,
): boolean => {
  const leftKernel = ownData(left as unknown as object, 'kernel');
  const rightKernel = ownData(right as unknown as object, 'kernel');
  if (!isRecord(leftKernel) || !isRecord(rightKernel)) return leftKernel === rightKernel;
  return sameStructuralFactAfterSplice(
    ownData(leftKernel, 'stateBefore'),
    ownData(rightKernel, 'stateBefore'),
    splice,
  ) && sameStructuralFactAfterSplice(
    ownData(leftKernel, 'stateAfter'),
    ownData(rightKernel, 'stateAfter'),
    splice,
  );
};

const structuralKernelTransitionsAreContinuous = (
  operations: readonly X4UiLayoutOperation[],
): boolean => {
  const tableStates = new Map<string, unknown>();
  for (const operation of operations) {
    if (operation.status !== 'applied' || operation.localExpansion) continue;
    const kernel = ownData(operation as unknown as object, 'kernel');
    if (!isRecord(kernel)) continue;
    const tableId = recordString(operation as unknown as Record<string, unknown>, 'tableId');
    if (!tableId) continue;
    const stateBefore = ownData(kernel, 'stateBefore');
    const previousState = tableStates.get(tableId);
    if (stateBefore !== undefined
      && previousState !== undefined
      && !sameClosedData(previousState, stateBefore)) {
      return false;
    }
    const stateAfter = ownData(kernel, 'stateAfter');
    if (stateAfter !== undefined) tableStates.set(tableId, stateAfter);
  }
  return true;
};

export interface X4UiSourceStructuralLedgerCorrespondenceInput {
  readonly beforeCalls: readonly unknown[];
  readonly afterCalls: readonly unknown[];
  /** Complete call-model record streams; global order is defined only by these records. */
  readonly beforeRecords: readonly unknown[];
  readonly afterRecords: readonly unknown[];
  readonly beforeOperations: readonly unknown[];
  readonly afterOperations: readonly unknown[];
  readonly entry: X4UiSourceEditStructuralEntry;
  readonly beforeText: string;
  readonly afterText: string;
  readonly replacementLength: number;
  readonly insertedCallIndex: number;
  readonly insertedOperationIndex: number;
  /** Replacement-only added ledger indexes and their producer facts. */
  readonly replacementCallIndexes?: readonly number[];
  readonly replacementCallNames?: readonly string[];
  readonly replacementCallOrders?: readonly number[];
  readonly replacementOperationIndexes?: readonly number[];
  readonly replacementOperationKinds?: readonly string[];
  readonly replacementOperationIds?: readonly string[];
  readonly replacementOperationModelOrders?: readonly number[];
}

const structuralKernelStateKeysMatch = (
  beforeOperation: unknown,
  afterOperation: unknown,
): boolean => {
  if (!isRecord(beforeOperation) || !isRecord(afterOperation)) return false;
  const beforeKernel = ownData(beforeOperation, 'kernel');
  const afterKernel = ownData(afterOperation, 'kernel');
  if (beforeKernel === undefined || afterKernel === undefined) return beforeKernel === afterKernel;
  if (!isRecord(beforeKernel) || !isRecord(afterKernel)) return false;
  return ['stateBefore', 'stateAfter'].every(key =>
    Object.prototype.hasOwnProperty.call(beforeKernel, key)
      === Object.prototype.hasOwnProperty.call(afterKernel, key));
};

const STRUCTURAL_STATE_UNCHANGED = Symbol('structural-state-unchanged');
const STRUCTURAL_STATE_UNMAPPABLE = Symbol('structural-state-unmappable');

const structuralStateTransitionRecipe = (
  before: unknown,
  after: unknown,
): unknown | typeof STRUCTURAL_STATE_UNCHANGED | typeof STRUCTURAL_STATE_UNMAPPABLE => {
  if (sameClosedData(before, after)) return STRUCTURAL_STATE_UNCHANGED;
  if (Array.isArray(before) && Array.isArray(after)) {
    if (before.length < after.length
      && before.every((value, index) => sameClosedData(value, after[index]))) {
      return { kind: 'array-append', values: after.slice(before.length) };
    }
    if (after.length < before.length
      && after.every((value, index) => sameClosedData(value, before[index]))) {
      return { kind: 'array-remove-tail', values: before.slice(after.length) };
    }
    if (before.length < after.length
      && before.every((value, index) => sameClosedData(value, after[after.length - before.length + index]))) {
      return { kind: 'array-prepend', values: after.slice(0, after.length - before.length) };
    }
    if (after.length < before.length
      && after.every((value, index) => sameClosedData(value, before[before.length - after.length + index]))) {
      return { kind: 'array-remove-head', values: before.slice(0, before.length - after.length) };
    }
    if (before.length !== after.length) return STRUCTURAL_STATE_UNMAPPABLE;
    const changes: Record<string, unknown> = {};
    for (let distance = 1; distance <= before.length; distance += 1) {
      const beforeIndex = before.length - distance;
      const afterIndex = after.length - distance;
      const path = `from-end:${distance}`;
      const child = structuralStateTransitionRecipe(before[beforeIndex], after[afterIndex]);
      if (child === STRUCTURAL_STATE_UNMAPPABLE) return STRUCTURAL_STATE_UNMAPPABLE;
      if (child !== STRUCTURAL_STATE_UNCHANGED) changes[path] = child;
    }
    return { kind: 'array-update', changes };
  }
  if (isRecord(before) && isRecord(after)) {
    const changes: Record<string, unknown> = {};
    const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
    for (const key of keys) {
      const beforeHas = Object.prototype.hasOwnProperty.call(before, key);
      const afterHas = Object.prototype.hasOwnProperty.call(after, key);
      if (!beforeHas) {
        changes[key] = { kind: 'set', value: ownData(after, key) };
        continue;
      }
      if (!afterHas) {
        changes[key] = { kind: 'remove' };
        continue;
      }
      const child = structuralStateTransitionRecipe(ownData(before, key), ownData(after, key));
      if (child === STRUCTURAL_STATE_UNMAPPABLE) return STRUCTURAL_STATE_UNMAPPABLE;
      if (child !== STRUCTURAL_STATE_UNCHANGED) changes[key] = { kind: 'update', recipe: child };
    }
    return { kind: 'record-update', changes };
  }
  return { kind: 'replace', value: after };
};

const applyStructuralStateTransitionRecipe = (
  current: unknown,
  recipe: unknown | typeof STRUCTURAL_STATE_UNCHANGED,
): unknown | typeof STRUCTURAL_STATE_UNMAPPABLE => {
  if (recipe === STRUCTURAL_STATE_UNCHANGED) return current;
  if (!isRecord(recipe)) return STRUCTURAL_STATE_UNMAPPABLE;
  const kind = ownData(recipe, 'kind');
  if (kind === 'replace') return ownData(recipe, 'value');
  if (kind === 'record-update') {
    if (!isRecord(current) || Array.isArray(current)) return STRUCTURAL_STATE_UNMAPPABLE;
    const changes = ownData(recipe, 'changes');
    if (!isRecord(changes)) return STRUCTURAL_STATE_UNMAPPABLE;
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(current)) result[key] = ownData(current, key);
    for (const key of Object.keys(changes)) {
      const change = ownData(changes, key);
      if (!isRecord(change)) return STRUCTURAL_STATE_UNMAPPABLE;
      const changeKind = ownData(change, 'kind');
      if (changeKind === 'set') result[key] = ownData(change, 'value');
      else if (changeKind === 'remove') {
        if (!Object.prototype.hasOwnProperty.call(result, key)) return STRUCTURAL_STATE_UNMAPPABLE;
        delete result[key];
      } else if (changeKind === 'update') {
        if (!Object.prototype.hasOwnProperty.call(result, key)) return STRUCTURAL_STATE_UNMAPPABLE;
        const child = applyStructuralStateTransitionRecipe(result[key], ownData(change, 'recipe'));
        if (child === STRUCTURAL_STATE_UNMAPPABLE) return STRUCTURAL_STATE_UNMAPPABLE;
        result[key] = child;
      } else return STRUCTURAL_STATE_UNMAPPABLE;
    }
    return result;
  }
  if (!Array.isArray(current)) return STRUCTURAL_STATE_UNMAPPABLE;
  const values = ownData(recipe, 'values');
  if (kind === 'array-append' || kind === 'array-prepend'
    || kind === 'array-remove-tail' || kind === 'array-remove-head') {
    if (!Array.isArray(values)) return STRUCTURAL_STATE_UNMAPPABLE;
    if (kind === 'array-append') return [...current, ...values];
    if (kind === 'array-prepend') return [...values, ...current];
    if (values.length > current.length) return STRUCTURAL_STATE_UNMAPPABLE;
    const retained = kind === 'array-remove-tail'
      ? current.slice(0, current.length - values.length)
      : current.slice(values.length);
    const removed = kind === 'array-remove-tail'
      ? current.slice(current.length - values.length)
      : current.slice(0, values.length);
    return sameClosedData(removed, values) ? retained : STRUCTURAL_STATE_UNMAPPABLE;
  }
  if (kind !== 'array-update') return STRUCTURAL_STATE_UNMAPPABLE;
  const changes = ownData(recipe, 'changes');
  if (!isRecord(changes)) return STRUCTURAL_STATE_UNMAPPABLE;
  const result = [...current];
  for (const path of Object.keys(changes)) {
    const match = /^from-end:([1-9][0-9]*)$/.exec(path);
    if (!match) return STRUCTURAL_STATE_UNMAPPABLE;
    const index = result.length - Number(match[1]);
    if (index < 0) return STRUCTURAL_STATE_UNMAPPABLE;
    const child = applyStructuralStateTransitionRecipe(result[index], ownData(changes, path));
    if (child === STRUCTURAL_STATE_UNMAPPABLE) return STRUCTURAL_STATE_UNMAPPABLE;
    result[index] = child;
  }
  return result;
};

interface StructuralKernelStates {
  readonly hasStateBefore: boolean;
  readonly hasStateAfter: boolean;
  readonly stateBefore: unknown;
  readonly stateAfter: unknown;
}

const structuralKernelStates = (operation: X4UiLayoutOperation): StructuralKernelStates => {
  const kernel = ownData(operation as unknown as object, 'kernel');
  if (!isRecord(kernel)) {
    return { hasStateBefore: false, hasStateAfter: false, stateBefore: undefined, stateAfter: undefined };
  }
  return {
    hasStateBefore: Object.prototype.hasOwnProperty.call(kernel, 'stateBefore'),
    hasStateAfter: Object.prototype.hasOwnProperty.call(kernel, 'stateAfter'),
    stateBefore: ownData(kernel, 'stateBefore'),
    stateAfter: ownData(kernel, 'stateAfter'),
  };
};

const structuralKernelLedgerStatesCorrespond = (
  beforeOperations: readonly X4UiLayoutOperation[],
  afterOperations: readonly X4UiLayoutOperation[],
  removedOperationIds: ReadonlySet<string>,
  insertedOperationIndex: number | ReadonlySet<number>,
  splice: StructuralSplice,
  allowInsertedTransitionDrift = false,
): boolean => {
  const insertedOperationIndexes = typeof insertedOperationIndex === 'number'
    ? new Set([insertedOperationIndex])
    : insertedOperationIndex;
  const tableStates = new Map<string, unknown>();
  const beforeTableId = (operation: X4UiLayoutOperation): string | undefined => {
    const tableId = recordString(operation as unknown as Record<string, unknown>, 'tableId');
    return tableId ? remapStructuralLedgerIdentity(tableId, splice) : undefined;
  };
  const afterTableId = (operation: X4UiLayoutOperation): string | undefined =>
    recordString(operation as unknown as Record<string, unknown>, 'tableId');
  const skipRemoved = (
    operation: X4UiLayoutOperation,
    boundedTables: Set<string>,
  ): boolean => {
    const states = structuralKernelStates(operation);
    if (!states.hasStateBefore && !states.hasStateAfter) return true;
    if (allowInsertedTransitionDrift) return true;
    const tableId = beforeTableId(operation);
    if (!tableId || (!states.hasStateBefore && states.hasStateAfter)) return false;
    if (boundedTables.has(tableId)) return true;
    boundedTables.add(tableId);
    if (!tableStates.has(tableId)) tableStates.set(tableId, states.stateBefore);
    return sameClosedData(tableStates.get(tableId), states.stateBefore);
  };
  const retain = (before: X4UiLayoutOperation, after: X4UiLayoutOperation): boolean => {
    const beforeStates = structuralKernelStates(before);
    const afterStates = structuralKernelStates(after);
    if (beforeStates.hasStateBefore !== afterStates.hasStateBefore
      || beforeStates.hasStateAfter !== afterStates.hasStateAfter) return false;
    if (!beforeStates.hasStateBefore && !beforeStates.hasStateAfter) return true;
    const mappedTableId = beforeTableId(before);
    const tableId = afterTableId(after);
    if (!mappedTableId || !tableId || mappedTableId !== tableId) return false;
    let current = tableStates.get(tableId);
    if (beforeStates.hasStateBefore) {
      if (!tableStates.has(tableId)) {
        if (!sameClosedData(beforeStates.stateBefore, afterStates.stateBefore)) return false;
        current = afterStates.stateBefore;
        tableStates.set(tableId, current);
      } else if (!sameClosedData(current, afterStates.stateBefore)) return false;
    }
    if (!beforeStates.hasStateAfter) return true;
    if (!beforeStates.hasStateBefore) {
      if (!sameClosedData(beforeStates.stateAfter, afterStates.stateAfter)) return false;
      tableStates.set(tableId, afterStates.stateAfter);
      return true;
    }
    const recipe = structuralStateTransitionRecipe(beforeStates.stateBefore, beforeStates.stateAfter);
    if (recipe === STRUCTURAL_STATE_UNMAPPABLE) return false;
    const replayed = applyStructuralStateTransitionRecipe(current, recipe);
    if (replayed === STRUCTURAL_STATE_UNMAPPABLE || !sameClosedData(replayed, afterStates.stateAfter)) return false;
    tableStates.set(tableId, replayed);
    return true;
  };
  const insert = (operation: X4UiLayoutOperation): boolean => {
    const states = structuralKernelStates(operation);
    if (!states.hasStateBefore && !states.hasStateAfter) return true;
    const tableId = afterTableId(operation);
    if (!states.hasStateBefore && states.hasStateAfter) {
      if (operation.kind !== 'addTable' || !tableId || tableStates.has(tableId)) return false;
      tableStates.set(tableId, states.stateAfter);
      return true;
    }
    if (!tableId || !states.hasStateBefore || !states.hasStateAfter || !tableStates.has(tableId)
      || !sameClosedData(tableStates.get(tableId), states.stateBefore)) return false;
    if (allowInsertedTransitionDrift) {
      const authoritativeEnvelope = beforeOperations
        .filter(before => {
          const beforeStates = structuralKernelStates(before);
          return beforeStates.hasStateBefore
            && beforeStates.hasStateAfter
            && beforeTableId(before) === tableId
            && structuralKernelEnvelope(before) !== undefined;
        })
        .map(before => structuralKernelEnvelope(before))[0];
      if (authoritativeEnvelope !== undefined
        && !sameClosedData(authoritativeEnvelope, structuralKernelEnvelope(operation))) return false;
    }
    const recipe = structuralStateTransitionRecipe(states.stateBefore, states.stateAfter);
    if (recipe === STRUCTURAL_STATE_UNMAPPABLE) return false;
    const authoritativeAnalogues = beforeOperations.filter(before => {
      const beforeStates = structuralKernelStates(before);
      return before.kind === operation.kind
        && before.status === operation.status
        && beforeTableId(before) === tableId
        && beforeStates.hasStateBefore
        && beforeStates.hasStateAfter;
    });
    const hasMatchingAuthoritativeAnalogue = authoritativeAnalogues.some(before => {
      const beforeStates = structuralKernelStates(before);
      if (before.kind !== operation.kind
        || before.status !== operation.status
        || beforeTableId(before) !== tableId
        || !beforeStates.hasStateBefore
        || !beforeStates.hasStateAfter) return false;
      const beforeRecipe = structuralStateTransitionRecipe(beforeStates.stateBefore, beforeStates.stateAfter);
      return beforeRecipe !== STRUCTURAL_STATE_UNMAPPABLE && sameClosedData(beforeRecipe, recipe);
    });
    if (authoritativeAnalogues.length > 0 && !hasMatchingAuthoritativeAnalogue && !allowInsertedTransitionDrift) return false;
    const replayed = applyStructuralStateTransitionRecipe(tableStates.get(tableId), recipe);
    if (replayed === STRUCTURAL_STATE_UNMAPPABLE || !sameClosedData(replayed, states.stateAfter)) return false;
    tableStates.set(tableId, replayed);
    return true;
  };
  let beforeIndex = 0;
  for (let afterIndex = 0; afterIndex < afterOperations.length; afterIndex += 1) {
    if (insertedOperationIndexes.has(afterIndex)) {
      if (!insert(afterOperations[afterIndex])) return false;
      continue;
    }
    const boundedTables = new Set<string>();
    while (beforeIndex < beforeOperations.length && removedOperationIds.has(beforeOperations[beforeIndex].id)) {
      if (!skipRemoved(beforeOperations[beforeIndex], boundedTables)) return false;
      beforeIndex += 1;
    }
    const before = beforeOperations[beforeIndex];
    if (!before || removedOperationIds.has(before.id) || !retain(before, afterOperations[afterIndex])) return false;
    beforeIndex += 1;
  }
  const boundedTables = new Set<string>();
  while (beforeIndex < beforeOperations.length && removedOperationIds.has(beforeOperations[beforeIndex].id)) {
    if (!skipRemoved(beforeOperations[beforeIndex], boundedTables)) return false;
    beforeIndex += 1;
  }
  return beforeIndex === beforeOperations.length;
};

const isStructuralCorrespondenceCall = (value: unknown): boolean => isRecord(value)
  && ownData(value, 'recordType') === 'call'
  && typeof ownData(value, 'name') === 'string'
  && typeof ownData(value, 'callee') === 'string'
  && typeof ownData(value, 'method') === 'string'
  && isLocationRecord(ownData(value, 'source'))
  && isRecord(ownData(value, 'enclosingStatement'))
  && typeof ownData(value, 'sourceOrder') === 'number'
  && Number.isInteger(ownData(value, 'sourceOrder'))
  && typeof ownData(value, 'order') === 'number'
  && Number.isInteger(ownData(value, 'order'))
  && Array.isArray(ownData(value, 'arguments'))
  && isRecord(ownData(value, 'semantics'))
  && isRecord(ownData(value, 'context'));

const isStructuralCorrespondenceOperation = (value: unknown): boolean => {
  if (!isRecord(value)
    || typeof ownData(value, 'id') !== 'string'
    || typeof ownData(value, 'kind') !== 'string'
    || !isLocationRecord(ownData(value, 'source'))
    || typeof ownData(value, 'sourceOrder') !== 'number'
    || !Number.isInteger(ownData(value, 'sourceOrder'))
    || typeof ownData(value, 'modelOrder') !== 'number'
    || !Number.isInteger(ownData(value, 'modelOrder'))
    || typeof ownData(value, 'status') !== 'string'
    || !isRecord(ownData(value, 'metadata'))
    || !Object.prototype.hasOwnProperty.call(value, 'descriptorFacts')) return false;
  const kernel = ownData(value, 'kernel');
  return kernel === undefined || isRecord(kernel);
};

const structuralCorrespondenceInputKeys = new Set([
  'beforeCalls',
  'afterCalls',
  'beforeRecords',
  'afterRecords',
  'beforeOperations',
  'afterOperations',
  'entry',
  'beforeText',
  'afterText',
  'replacementLength',
  'insertedCallIndex',
  'insertedOperationIndex',
]);

const structuralCorrespondenceOptionalKeys = new Set([
  'replacementCallIndexes',
  'replacementCallNames',
  'replacementCallOrders',
  'replacementOperationIndexes',
  'replacementOperationKinds',
  'replacementOperationIds',
  'replacementOperationModelOrders',
]);

const STRUCTURAL_CORRESPONDENCE_FIELD_BUDGET = 750_000;
const STRUCTURAL_CORRESPONDENCE_TOTAL_BUDGET = 2_500_000;

// Structural reparses carry complete kernel snapshots in both operation ledgers. Keep
// each ledger bounded independently while allowing the aggregate input to remain bounded.
const isClosedStructuralCorrespondenceInput = (value: unknown): boolean => {
  if (!hasClosedStructuralKeys(value, structuralCorrespondenceInputKeys, structuralCorrespondenceOptionalKeys)) return false;
  const input = value as Record<string, unknown>;
  let totalRemaining = STRUCTURAL_CORRESPONDENCE_TOTAL_BUDGET;
  for (const key of Object.keys(input)) {
    const fieldBudget: ClosedDataTraversalBudget = { remaining: STRUCTURAL_CORRESPONDENCE_FIELD_BUDGET };
    if (!isClosedPlainOwnData(input[key], new Set<object>(), input, key, false, fieldBudget)) return false;
    totalRemaining -= STRUCTURAL_CORRESPONDENCE_FIELD_BUDGET - fieldBudget.remaining;
    if (totalRemaining <= 0) return false;
  }
  return true;
};

const structuralProducerRecordIsValid = (
  value: unknown,
  schema: 'call' | 'operation',
  text: string,
): boolean => {
  const state: StructuralInvariantState = { valid: true };
  structuralInvariant(value, '', structuralIgnoredKeys, {
    beforeText: text,
    afterText: text,
    startOffset: text.length,
    endOffset: text.length,
    replacementLength: 0,
    orderShift: 0,
    side: 'after',
  }, state, schema);
  return state.valid;
};

export const compareX4UiSourceStructuralLedgerCorrespondence = (
  input: X4UiSourceStructuralLedgerCorrespondenceInput,
): boolean => {
  try {
    if (!isClosedStructuralCorrespondenceInput(input)
      || !isStructuredCloneableClosedData(input)
      || !hasClosedStructuralKeys(input, structuralCorrespondenceInputKeys, structuralCorrespondenceOptionalKeys)) return false;
    const beforeCalls = ownData(input, 'beforeCalls');
    const afterCalls = ownData(input, 'afterCalls');
    const beforeRecords = ownData(input, 'beforeRecords');
    const afterRecords = ownData(input, 'afterRecords');
    const beforeOperations = ownData(input, 'beforeOperations');
    const afterOperations = ownData(input, 'afterOperations');
    const entryValue = ownData(input, 'entry');
    const beforeText = ownData(input, 'beforeText');
    const afterText = ownData(input, 'afterText');
    const replacementLength = ownData(input, 'replacementLength');
    const insertedCallIndex = ownData(input, 'insertedCallIndex');
    const insertedOperationIndex = ownData(input, 'insertedOperationIndex');
    const replacementCallIndexesValue = ownData(input, 'replacementCallIndexes');
    const replacementCallNamesValue = ownData(input, 'replacementCallNames');
    const replacementCallOrdersValue = ownData(input, 'replacementCallOrders');
    const replacementOperationIndexesValue = ownData(input, 'replacementOperationIndexes');
    const replacementOperationKindsValue = ownData(input, 'replacementOperationKinds');
    const replacementOperationIdsValue = ownData(input, 'replacementOperationIds');
    const replacementOperationModelOrdersValue = ownData(input, 'replacementOperationModelOrders');
    const entryKind = isRecord(entryValue) ? ownData(entryValue, 'kind') : undefined;
    if (!Array.isArray(beforeCalls)
      || !Array.isArray(afterCalls)
      || !Array.isArray(beforeRecords)
      || !Array.isArray(afterRecords)
      || !Array.isArray(beforeOperations)
      || !Array.isArray(afterOperations)
      || !isRecord(entryValue)
      || (entryKind !== 'delete-statement'
        && entryKind !== 'replace-statement'
        && entryKind !== 'insert-call'
        && entryKind !== 'insert-block')
      || typeof beforeText !== 'string'
      || typeof afterText !== 'string'
      || typeof replacementLength !== 'number'
      || !validOffset(replacementLength)
      || typeof insertedCallIndex !== 'number'
      || !Number.isInteger(insertedCallIndex)
      || typeof insertedOperationIndex !== 'number'
      || !Number.isInteger(insertedOperationIndex)) return false;
    const replacementFields = [
      replacementCallIndexesValue,
      replacementCallNamesValue,
      replacementCallOrdersValue,
      replacementOperationIndexesValue,
      replacementOperationKindsValue,
      replacementOperationIdsValue,
      replacementOperationModelOrdersValue,
    ];
    if (entryKind !== 'replace-statement' && replacementFields.some(value => value !== undefined)) return false;
    if (entryKind === 'replace-statement'
      && (!Array.isArray(replacementCallIndexesValue)
        || !Array.isArray(replacementCallNamesValue)
        || !Array.isArray(replacementCallOrdersValue)
        || !Array.isArray(replacementOperationIndexesValue)
        || !Array.isArray(replacementOperationKindsValue)
        || !Array.isArray(replacementOperationIdsValue)
        || !Array.isArray(replacementOperationModelOrdersValue)
        || replacementCallIndexesValue.length === 0
        || replacementCallIndexesValue.length !== replacementCallNamesValue.length
        || replacementCallIndexesValue.length !== replacementCallOrdersValue.length
        || replacementOperationIndexesValue.length === 0
        || replacementOperationIndexesValue.length !== replacementOperationKindsValue.length
        || replacementOperationIndexesValue.length !== replacementOperationIdsValue.length
        || replacementOperationIndexesValue.length !== replacementOperationModelOrdersValue.length)) return false;
    if (![...beforeCalls, ...afterCalls].every(isStructuralCorrespondenceCall)
      || ![...beforeOperations, ...afterOperations].every(isStructuralCorrespondenceOperation)) return false;
    if (!beforeCalls.every(value => structuralProducerRecordIsValid(value, 'call', beforeText))
      || !afterCalls.every(value => structuralProducerRecordIsValid(value, 'call', afterText))
      || !beforeOperations.every(value => structuralProducerRecordIsValid(value, 'operation', beforeText))
      || !afterOperations.every(value => structuralProducerRecordIsValid(value, 'operation', afterText))
      || !beforeRecords.every(value => structuralCompleteRecordIsValid(value, beforeText))
      || !afterRecords.every(value => structuralCompleteRecordIsValid(value, afterText))
      || !beforeRecords.every((value, index) => isRecord(value) && ownData(value, 'order') === index)
      || !afterRecords.every((value, index) => isRecord(value) && ownData(value, 'order') === index)) return false;
    const beforeRecordCalls = beforeRecords.filter(value => isRecord(value) && ownData(value, 'recordType') === 'call');
    const afterRecordCalls = afterRecords.filter(value => isRecord(value) && ownData(value, 'recordType') === 'call');
    if (beforeRecordCalls.length !== beforeCalls.length
      || afterRecordCalls.length !== afterCalls.length
      || !beforeRecordCalls.every((value, index) => sameClosedData(value, beforeCalls[index]))
      || !afterRecordCalls.every((value, index) => sameClosedData(value, afterCalls[index]))) return false;
    const entry = entryValue as unknown as X4UiSourceEditStructuralEntry;
    const startOffset = ownData(entryValue, 'startOffset');
    const endOffset = ownData(entryValue, 'endOffset');
    if (typeof startOffset !== 'number'
      || typeof endOffset !== 'number'
      || !validOffset(startOffset)
      || !validOffset(endOffset)
      || startOffset > endOffset
      || endOffset > beforeText.length
      || afterText.length !== beforeText.length - (endOffset - startOffset) + replacementLength) return false;
    const callBindingsValue = (entry.kind === 'delete-statement' || entry.kind === 'replace-statement')
      ? ownData(entryValue, 'callBindings')
      : [];
    if (!Array.isArray(callBindingsValue)) return false;
    const callBindings = callBindingsValue as readonly unknown[];
    const removedOrders = new Set<number>();
    const removedOperationIds = new Set<string>();
    for (const binding of callBindings) {
      if (!isRecord(binding)) return false;
      const callOrder = ownData(binding, 'callOrder');
      const operationId = ownData(binding, 'operationId');
      if (typeof callOrder !== 'number'
        || !Number.isInteger(callOrder)
        || typeof operationId !== 'string'
        || removedOrders.has(callOrder)
        || removedOperationIds.has(operationId)) return false;
      const beforeCall = beforeCalls.find(candidate => isRecord(candidate) && ownData(candidate, 'order') === callOrder);
      const beforeOperation = beforeOperations.find(candidate => isRecord(candidate) && ownData(candidate, 'id') === operationId);
      if (!isRecord(beforeCall)
        || !isRecord(beforeOperation)
         || ownData(beforeCall, 'name') !== ownData(binding, 'callName')
         || !sameClosedData(ownData(beforeCall, 'source'), ownData(binding, 'callSource'))
         || ownData(beforeOperation, 'kind') !== ownData(binding, 'callName')
         || !isLocationRecord(ownData(beforeOperation, 'source'))
         || !isLocationRecord(ownData(binding, 'callSource'))
         || !sameLocation(
           ownData(beforeOperation, 'source') as X4UiSourceLocation,
           ownData(binding, 'callSource') as X4UiSourceLocation,
         )
         || ownData(beforeOperation, 'modelOrder') !== callOrder) return false;
      removedOrders.add(callOrder);
      removedOperationIds.add(operationId);
    }
    const expectedCalls: unknown[] = [];
    for (const call of beforeCalls) {
      if (!isRecord(call)) return false;
      const order = ownData(call, 'order');
      if (typeof order !== 'number' || !Number.isInteger(order)) return false;
      if (!removedOrders.has(order)) expectedCalls.push(call);
    }
    const expectedOperations: unknown[] = [];
    for (const operation of beforeOperations) {
      if (!isRecord(operation)) return false;
      const id = ownData(operation, 'id');
      if (typeof id !== 'string') return false;
      if (!removedOperationIds.has(id)) expectedOperations.push(operation);
    }
    const insertedCallIndexes = new Set<number>();
    const insertedOperationIndexes = new Set<number>();
    if (entry.kind === 'insert-call') {
      if (insertedCallIndex < 0
        || insertedCallIndex >= afterCalls.length
        || insertedOperationIndex < 0
        || insertedOperationIndex >= afterOperations.length
        || afterCalls.length !== expectedCalls.length + 1
        || afterOperations.length !== expectedOperations.length + 1) return false;
      insertedCallIndexes.add(insertedCallIndex);
      insertedOperationIndexes.add(insertedOperationIndex);
    } else if (entry.kind === 'insert-block') {
      const insertedStart = startOffset + entry.indentation.length;
      const insertedEnd = startOffset + replacementLength;
      afterCalls.forEach((call, index) => {
        if (!isRecord(call)) return;
        const bounds = structuralLocationBounds(ownData(call, 'source'));
        if (bounds !== undefined && bounds.start >= insertedStart && bounds.end <= insertedEnd) {
          insertedCallIndexes.add(index);
        }
      });
      afterOperations.forEach((operation, index) => {
        if (!isRecord(operation)) return;
        const bounds = structuralLocationBounds(ownData(operation, 'source'));
        if (bounds !== undefined && bounds.start >= insertedStart && bounds.end <= insertedEnd) {
          insertedOperationIndexes.add(index);
        }
      });
      if (insertedCallIndex !== -1
        || insertedOperationIndex !== -1
        || insertedCallIndexes.size === 0
        || insertedOperationIndexes.size === 0
        || afterCalls.length !== expectedCalls.length + insertedCallIndexes.size
        || afterOperations.length !== expectedOperations.length + insertedOperationIndexes.size) return false;
    } else if (entry.kind === 'replace-statement') {
      if (insertedCallIndex !== -1
        || insertedOperationIndex !== -1
        || !Array.isArray(replacementCallIndexesValue)
        || !Array.isArray(replacementCallNamesValue)
        || !Array.isArray(replacementCallOrdersValue)
        || !Array.isArray(replacementOperationIndexesValue)
        || !Array.isArray(replacementOperationKindsValue)
        || !Array.isArray(replacementOperationIdsValue)
        || !Array.isArray(replacementOperationModelOrdersValue)) return false;
      const replacementStart = startOffset;
      const replacementEnd = startOffset + replacementLength;
      const addCallIndexes = replacementCallIndexesValue as readonly unknown[];
      const addCallNames = replacementCallNamesValue as readonly unknown[];
      const addCallOrders = replacementCallOrdersValue as readonly unknown[];
      const addOperationIndexes = replacementOperationIndexesValue as readonly unknown[];
      const addOperationKinds = replacementOperationKindsValue as readonly unknown[];
      const addOperationIds = replacementOperationIdsValue as readonly unknown[];
      const addOperationModelOrders = replacementOperationModelOrdersValue as readonly unknown[];
      const validIndexList = (values: readonly unknown[], length: number): boolean => {
        const indexes = new Set<number>();
        for (const value of values) {
          if (typeof value !== 'number'
            || !Number.isInteger(value)
            || value < 0
            || value >= length
            || indexes.has(value)) return false;
          indexes.add(value);
        }
        return true;
      };
      if (!validIndexList(addCallIndexes, afterCalls.length)
        || !validIndexList(addOperationIndexes, afterOperations.length)) return false;
      for (let index = 0; index < addCallIndexes.length; index += 1) {
        const afterCall = afterCalls[addCallIndexes[index] as number];
        if (!isRecord(afterCall)
          || typeof addCallNames[index] !== 'string'
          || typeof addCallOrders[index] !== 'number'
          || !Number.isInteger(addCallOrders[index])
          || ownData(afterCall, 'name') !== addCallNames[index]
          || ownData(afterCall, 'order') !== addCallOrders[index]) return false;
        const bounds = structuralLocationBounds(ownData(afterCall, 'source'));
        if (!bounds || bounds.start < replacementStart || bounds.end > replacementEnd) return false;
        insertedCallIndexes.add(addCallIndexes[index] as number);
      }
      for (let index = 0; index < addOperationIndexes.length; index += 1) {
        const afterOperation = afterOperations[addOperationIndexes[index] as number];
        if (!isRecord(afterOperation)
          || typeof addOperationKinds[index] !== 'string'
          || typeof addOperationIds[index] !== 'string'
          || typeof addOperationModelOrders[index] !== 'number'
          || !Number.isInteger(addOperationModelOrders[index])
          || ownData(afterOperation, 'kind') !== addOperationKinds[index]
          || ownData(afterOperation, 'id') !== addOperationIds[index]
          || ownData(afterOperation, 'modelOrder') !== addOperationModelOrders[index]) return false;
        const bounds = structuralLocationBounds(ownData(afterOperation, 'source'));
        if (!bounds || bounds.start < replacementStart || bounds.end > replacementEnd) return false;
        insertedOperationIndexes.add(addOperationIndexes[index] as number);
      }
      if (afterCalls.length !== expectedCalls.length + insertedCallIndexes.size
        || afterOperations.length !== expectedOperations.length + insertedOperationIndexes.size) return false;
    } else if (insertedCallIndex !== -1
      || insertedOperationIndex !== -1
      || afterCalls.length !== expectedCalls.length
      || afterOperations.length !== expectedOperations.length) return false;
    const comparableAfterCalls = afterCalls.filter((_, index) => !insertedCallIndexes.has(index));
    const comparableAfterOperations = afterOperations.filter((_, index) => !insertedOperationIndexes.has(index));
    if (comparableAfterCalls.length !== expectedCalls.length
      || comparableAfterOperations.length !== expectedOperations.length) return false;
    const insertedStart = entry.kind === 'replace-statement'
      ? startOffset
      : entry.kind === 'insert-call' || entry.kind === 'insert-block'
        ? startOffset + entry.indentation.length
      : -1;
    const insertedEnd = entry.kind === 'replace-statement'
      || entry.kind === 'insert-call' || entry.kind === 'insert-block'
      ? startOffset + replacementLength
      : -1;
    const isRemovedRecord = (record: unknown): boolean => {
      if ((entry.kind !== 'delete-statement' && entry.kind !== 'replace-statement') || !isRecord(record)) return false;
      const bounds = structuralLocationBounds(ownData(record, 'source'));
      return bounds !== undefined
        && bounds.start >= startOffset
        && bounds.end <= endOffset;
    };
    const isInsertedRecord = (record: unknown): boolean => {
      if ((entry.kind !== 'insert-call' && entry.kind !== 'insert-block' && entry.kind !== 'replace-statement') || !isRecord(record)) return false;
      const bounds = structuralLocationBounds(ownData(record, 'source'));
      return bounds !== undefined
        && bounds.start >= insertedStart
        && bounds.end <= insertedEnd;
    };
    const expectedRecords = beforeRecords.filter(record => !isRemovedRecord(record));
    const comparableAfterRecords = afterRecords.filter(record => !isInsertedRecord(record));
    const insertedRecords = afterRecords.filter(isInsertedRecord);
    if ((entry.kind === 'insert-call' || entry.kind === 'insert-block' || entry.kind === 'replace-statement') && insertedRecords.length === 0) return false;
    if (comparableAfterRecords.length !== expectedRecords.length) return false;
    const splice: StructuralSplice = {
      beforeText,
      afterText,
      startOffset,
      endOffset,
      replacementLength,
      orderShift: 0,
      side: 'before',
    };
    for (let index = 0; index < expectedRecords.length; index += 1) {
      const beforeRecord = expectedRecords[index];
      const afterRecord = comparableAfterRecords[index];
      if (!isRecord(beforeRecord) || !isRecord(afterRecord)) return false;
      const beforeSource = ownData(beforeRecord, 'source');
      const afterSource = ownData(afterRecord, 'source');
      const beforeBounds = structuralLocationBounds(beforeSource);
      if (!isLocationRecord(beforeSource)
        || !isLocationRecord(afterSource)
        || beforeBounds === undefined) return false;
      const recordSplice = {
        ...splice,
        orderShift: structuralOrderShift(
          entry,
          beforeBounds.start,
          beforeRecords,
          afterRecords,
          replacementLength,
        ),
      };
      if (!sameStructuralCompleteRecordAfterSplice(
        beforeRecord,
        afterRecord,
        recordSplice,
        recordSplice.orderShift,
      )) return false;
    }
    for (let index = 0; index < expectedCalls.length; index += 1) {
      const beforeCall = expectedCalls[index];
      const afterCall = comparableAfterCalls[index];
      if (!isRecord(beforeCall) || !isRecord(afterCall)) return false;
      const beforeSource = ownData(beforeCall, 'source');
      const afterSource = ownData(afterCall, 'source');
      if (!isLocationRecord(beforeSource) || !isLocationRecord(afterSource)) return false;
      if (!sameShiftedLocation(
        beforeSource,
        afterSource,
        beforeText,
        afterText,
        startOffset,
        endOffset,
        replacementLength,
      )) return false;
    }
    const beforeTypedOperations = beforeOperations as readonly X4UiLayoutOperation[];
    const afterTypedOperations = afterOperations as readonly X4UiLayoutOperation[];
    const beforeTransitions = structuralKernelTransitionsAreContinuous(beforeTypedOperations);
    const afterTransitions = structuralKernelTransitionsAreContinuous(afterTypedOperations);
    const ledgerStates = structuralKernelLedgerStatesCorrespond(
      beforeTypedOperations,
      afterTypedOperations,
      removedOperationIds,
      entry.kind === 'insert-block' || entry.kind === 'replace-statement'
        ? insertedOperationIndexes
        : insertedOperationIndex,
      splice,
      entry.kind === 'replace-statement',
    );
    if (!beforeTransitions || !afterTransitions || !ledgerStates) return false;
    for (let index = 0; index < expectedOperations.length; index += 1) {
      const beforeOperation = expectedOperations[index];
      const afterOperation = comparableAfterOperations[index];
      if (!isRecord(beforeOperation) || !isRecord(afterOperation)) return false;
      const beforeSource = ownData(beforeOperation, 'source');
      const afterSource = ownData(afterOperation, 'source');
      if (!isLocationRecord(beforeSource) || !isLocationRecord(afterSource)) return false;
      const operationSplice = {
        ...splice,
        orderShift: structuralOrderShift(
          entry,
          beforeSource.start.offset,
          beforeRecords,
          afterRecords,
          replacementLength,
        ),
      };
      const exactKernelState = beforeSource.end.offset <= startOffset;
      const operationFact = sameStructuralOperationFactAfterSplice(beforeOperation, afterOperation, operationSplice);
      const kernelEnvelope = sameStructuralKernelEnvelopeAfterSplice(
        beforeOperation as unknown as X4UiLayoutOperation,
        afterOperation as unknown as X4UiLayoutOperation,
        operationSplice,
      );
      const stateKeys = structuralKernelStateKeysMatch(beforeOperation, afterOperation);
      const stateAfter = !exactKernelState || structuralKernelStateAfterSplice(
        beforeOperation as unknown as X4UiLayoutOperation,
        afterOperation as unknown as X4UiLayoutOperation,
        operationSplice,
      );
      const location = sameShiftedLocation(
        beforeSource,
        afterSource,
        beforeText,
        afterText,
        startOffset,
        endOffset,
        replacementLength,
      );
      if (!operationFact || !kernelEnvelope || !stateKeys || !stateAfter || !location) return false;
    }
    return true;
  } catch {
    return false;
  }
};

interface DirectCallPayloadProof {
  readonly source: string;
  readonly model: X4UiCallModel;
  readonly call: X4UiCallRecord;
  readonly statement: EnclosingStatementFacts;
}

interface DirectBlockPayloadCallSpan {
  readonly call: X4UiCallRecord;
  readonly startOffset: number;
  readonly endOffset: number;
}

interface DirectBlockPayloadProof {
  readonly source: string;
  readonly formattedSource: string;
  readonly formattedCallSpans: readonly DirectBlockPayloadCallSpan[];
  readonly model: X4UiCallModel;
  readonly calls: readonly X4UiCallRecord[];
  readonly statements: readonly EnclosingStatementFacts[];
  readonly frameReceiver: string;
}

interface DirectStatementReplacementPayloadProof {
  readonly source: string;
  readonly model: X4UiCallModel;
  readonly calls: readonly X4UiCallRecord[];
  readonly statement: EnclosingStatementFacts;
}

const ROW_LOCAL_REPLACEMENT_CALL_NAMES = new Set<X4UiRelevantCallName>([
  'setColSpan',
  'setText',
  'setText2',
  'createText',
  'createEditBox',
  'createButton',
  'createIcon',
]);

type DirectStructuralPayload = DirectCallPayloadProof | DirectBlockPayloadProof | DirectStatementReplacementPayloadProof;

const directStatementReplacementPayload = (
  path: string,
  payload: string,
): DirectStatementReplacementPayloadProof | { readonly reason: X4UiSourceEditRefusalReason; readonly detail: string } => {
  const trimmed = payload.replace(/^[ \t]+|[ \t]+$/g, '');
  if (!trimmed || trimmed.length > 32768 || /[\r\n]/.test(trimmed)) {
    return { reason: 'invalid-request', detail: 'statement replacement must be one non-empty single-line Lua source statement at most 32768 characters' };
  }
  let model: X4UiCallModel;
  try {
    model = buildX4UiCallModel({ rel: path, text: `${trimmed}\n` });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'unknown parser error';
    return { reason: 'replacement-parse-failure', detail: `statement replacement parse was contained: ${detail}` };
  }
  if (model.parsed !== true || model.calls.length === 0 || model.calls.length > 32) {
    return { reason: 'replacement-parse-failure', detail: 'statement replacement must parse to between 1 and 32 relevant direct X4 UI calls' };
  }
  const rawHandlers = ownData(model as unknown as object, 'handlers');
  const rawFunctions = ownData(model as unknown as object, 'localFunctions');
  const rawInvocations = ownData(model as unknown as object, 'localInvocations');
  if ((Array.isArray(rawHandlers) && rawHandlers.length > 0)
    || (Array.isArray(rawFunctions) && rawFunctions.length > 0)
    || (Array.isArray(rawInvocations) && rawInvocations.length > 0)) {
    return { reason: 'replacement-parse-failure', detail: 'statement replacement rejects handlers, function definitions, and hidden or nested non-UI invocations' };
  }
  const statements = new Map<string, EnclosingStatementFacts>();
  for (const call of model.calls) {
    if (!ROW_LOCAL_REPLACEMENT_CALL_NAMES.has(call.name)) {
      return { reason: 'replacement-parse-failure', detail: `statement replacement call ${call.name} is outside the bounded row-local direct X4 UI allow-list` };
    }
    const statement = enclosingStatementOf(call);
    if (!statement
      || statement.kind !== 'call'
      || statement.source.start.offset !== 0
      || statement.deletionSource.start.offset !== 0
      || statement.deletionSource.end.offset > trimmed.length
      || trimmed.slice(statement.deletionSource.end.offset).trim().length > 0) {
      return { reason: 'replacement-parse-failure', detail: 'statement replacement must be exactly one standalone direct call statement' };
    }
    const context = call.context as unknown as Record<string, unknown>;
    const branchPath = ownData(context, 'branchPath');
    const loopPath = ownData(context, 'loopPath');
    if (ownData(context, 'kind') !== 'top-level'
      || !Array.isArray(branchPath)
      || !Array.isArray(loopPath)
      || branchPath.length !== 0
      || loopPath.length !== 0
      || ownData(context, 'reachability') !== 'reachable'
      || (call.context.source !== undefined
        && (call.context.source.start.offset > 0 || call.context.source.end.offset < trimmed.length))) {
      return { reason: 'replacement-parse-failure', detail: 'statement replacement rejects conditional, looped, unreachable, or nested call context' };
    }
    if (hasUnprovenExecutableWithin(model, statement, `${trimmed}\n`)) {
      return { reason: 'replacement-parse-failure', detail: 'statement replacement contains an unproven nested executable invocation' };
    }
    statements.set(statementKey(statement), statement);
  }
  if (statements.size !== 1) {
    return { reason: 'replacement-parse-failure', detail: 'statement replacement contains multiple source statements' };
  }
  const statement = [...statements.values()][0];
  if (!model.calls.some(call => enclosingStatementOf(call)?.isStandaloneCallStatementRoot === true)) {
    return { reason: 'replacement-parse-failure', detail: 'statement replacement must have one standalone direct call statement root' };
  }
  const orderedCalls = [...model.calls].sort((left, right) => left.order - right.order);
  for (let index = 1; index < orderedCalls.length; index += 1) {
    const previous = orderedCalls[index - 1];
    const current = orderedCalls[index];
    const previousSource = trimmed.slice(previous.source.start.offset, previous.source.end.offset);
    const receiver = recordString(current.receiver, 'expression');
    if (!previousSource
      || !receiver
      || !receiver.includes(previousSource)
      || current.source.start.offset < previous.source.start.offset
      || current.source.end.offset > statement.source.end.offset) {
      return { reason: 'replacement-parse-failure', detail: 'statement replacement calls must form one direct fluent X4 UI chain' };
    }
  }
  return { source: trimmed, model, calls: model.calls, statement };
};

const directCallPayload = (
  path: string,
  payload: string,
): DirectCallPayloadProof | { readonly reason: X4UiSourceEditRefusalReason; readonly detail: string } => {
  const trimmed = payload.replace(/^[ \t]+|[ \t]+$/g, '');
  if (!trimmed || /[\r\n]/.test(trimmed)) {
    return { reason: 'invalid-request', detail: 'direct insertion payload must be one non-empty single-line Lua source statement' };
  }
  let model: X4UiCallModel;
  try {
    model = buildX4UiCallModel({ rel: path, text: `${trimmed}\n` });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'unknown parser error';
    return { reason: 'replacement-parse-failure', detail: `direct insertion payload parse was contained: ${detail}` };
  }
  if (model.parsed !== true || model.calls.length !== 1) {
    return { reason: 'replacement-parse-failure', detail: 'direct insertion payload must parse to exactly one relevant X4 UI call' };
  }
  const call = model.calls[0];
  const statement = enclosingStatementOf(call);
  if (!statement
    || statement.kind !== 'call'
    || !statement.isStandaloneCallStatementRoot
    || statement.deletionSource.start.offset !== 0
    || statement.deletionSource.end.offset > trimmed.length
    || trimmed.slice(statement.deletionSource.end.offset).trim() !== '') {
    return { reason: 'replacement-parse-failure', detail: 'direct insertion payload is not exactly one standalone call statement' };
  }
  if (hasUnprovenExecutableWithin(model, statement, `${trimmed}\n`)) {
    return { reason: 'replacement-parse-failure', detail: 'direct insertion payload contains an unproven nested executable invocation' };
  }
  return { source: trimmed, model, call, statement };
};

const BLOCK_DIRECT_CALL_NAMES = new Set<X4UiRelevantCallName>([
  'addTable',
  'setColWidthPercent',
  'addRow',
  'setColSpan',
  'setText',
  'createEditBox',
  'createButton',
]);

const blockBindingRoot = (expression: string | undefined): string | undefined => {
  if (expression === undefined) return undefined;
  const match = /^([A-Za-z_][A-Za-z0-9_]*)/.exec(expression.trim());
  return match?.[1];
};

const blockCallReceiver = (call: X4UiCallRecord): string | undefined =>
  recordString(call.receiver, 'expression');

const blockCallAssignedNames = (call: X4UiCallRecord): readonly string[] =>
  Array.isArray(call.assignedTo)
    ? call.assignedTo.filter((value): value is string => /^[A-Za-z_][A-Za-z0-9_]*$/.test(value))
    : [];

const blockStatementKey = (statement: EnclosingStatementFacts): string => [
  statement.source.start.offset,
  statement.source.end.offset,
  statement.deletionSource.start.offset,
  statement.deletionSource.end.offset,
  statement.kind,
].join('|');

const directBlockPayload = (
  path: string,
  payload: string,
  frameReceiver: string,
  indentation: string,
  lineEnding: '\n' | '\r\n',
): DirectBlockPayloadProof | { readonly reason: X4UiSourceEditRefusalReason; readonly detail: string } => {
  const trimmed = payload.replace(/^[ \t]+|[ \t]+$/g, '');
  if (!trimmed || trimmed.length > 32768) {
    return { reason: 'invalid-request', detail: 'frame insertion block must be non-empty and at most 32768 source characters' };
  }
  if (!frameReceiver || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(frameReceiver)) {
    return { reason: 'replacement-parse-failure', detail: 'frame insertion block has no proven selected-frame receiver binding' };
  }
  let model: X4UiCallModel;
  try {
    model = buildX4UiCallModel({ rel: path, text: `${trimmed}\n` });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'unknown parser error';
    return { reason: 'replacement-parse-failure', detail: `frame insertion block parse was contained: ${detail}` };
  }
  if (model.parsed !== true) {
    return { reason: 'replacement-parse-failure', detail: 'frame insertion block must parse as a complete Lua source fragment' };
  }
  const rawHandlers = ownData(model as unknown as object, 'handlers');
  const rawFunctions = ownData(model as unknown as object, 'localFunctions');
  const rawInvocations = ownData(model as unknown as object, 'localInvocations');
  if ((Array.isArray(rawHandlers) && rawHandlers.length > 0)
    || (Array.isArray(rawFunctions) && rawFunctions.length > 0)
    || (Array.isArray(rawInvocations) && rawInvocations.length > 0)) {
    return { reason: 'replacement-parse-failure', detail: 'frame insertion block rejects handlers, function definitions, and nested or hidden non-UI invocations' };
  }
  if (model.calls.length < 2 || model.calls.length > 64) {
    return { reason: 'replacement-parse-failure', detail: 'frame insertion block must contain between 2 and 64 relevant direct UI calls' };
  }
  const statementsByKey = new Map<string, { readonly statement: EnclosingStatementFacts; readonly calls: X4UiCallRecord[] }>();
  for (const call of model.calls) {
    if (!BLOCK_DIRECT_CALL_NAMES.has(call.name)) {
      return { reason: 'replacement-parse-failure', detail: `frame insertion block call ${call.name} is outside the bounded direct UI construction allow-list` };
    }
    const statement = enclosingStatementOf(call);
    if (!statement
      || !validLocation(statement.source, `${trimmed}\n`)
      || !validLocation(statement.deletionSource, `${trimmed}\n`)
      || statement.source.start.offset < 0
      || statement.source.end.offset > trimmed.length
      || statement.deletionSource.start.offset < 0
      || statement.deletionSource.end.offset > trimmed.length
      || statement.kind !== 'local' && statement.kind !== 'call'
      || (call.context.source !== undefined && (call.context.source.start.offset > 0
        || call.context.source.end.offset < trimmed.length))) {
      return { reason: 'replacement-parse-failure', detail: 'frame insertion block contains a non-top-level, conditional, looped, or malformed statement boundary' };
    }
    const context = call.context as unknown as Record<string, unknown>;
    const branchPath = ownData(context, 'branchPath');
    const loopPath = ownData(context, 'loopPath');
    if (ownData(context, 'kind') !== 'top-level'
      || !Array.isArray(branchPath)
      || !Array.isArray(loopPath)
      || branchPath.length !== 0
      || loopPath.length !== 0
      || ownData(context, 'reachability') !== 'reachable') {
      return { reason: 'replacement-parse-failure', detail: 'frame insertion block rejects conditional, looped, or unreachable UI statements' };
    }
    if (hasUnprovenExecutableWithin(model, statement, `${trimmed}\n`)) {
      return { reason: 'replacement-parse-failure', detail: 'frame insertion block contains an unproven nested executable invocation' };
    }
    const key = blockStatementKey(statement);
    const existing = statementsByKey.get(key);
    if (existing) existing.calls.push(call);
    else statementsByKey.set(key, { statement, calls: [call] });
  }
  const statements = [...statementsByKey.values()].sort((left, right) => left.statement.source.start.offset - right.statement.source.start.offset);
  if (statements.length < 2) {
    return { reason: 'replacement-parse-failure', detail: 'frame insertion block must contain multiple complete source statements' };
  }
  let cursor = 0;
  for (const group of statements) {
    const { statement, calls } = group;
    if (trimmed.slice(cursor, statement.source.start.offset).trim().length > 0
      || statement.source.start.offset !== statement.deletionSource.start.offset
      || statement.source.end.offset !== statement.deletionSource.end.offset) {
      return { reason: 'replacement-parse-failure', detail: 'frame insertion block contains control flow, comments, separators, or an unproven source statement' };
    }
    cursor = statement.source.end.offset;
    calls.sort((left, right) => left.order - right.order);
    const finalCall = calls[calls.length - 1];
    const finalStatement = enclosingStatementOf(finalCall);
    const localBindingStatement = statement.kind === 'local'
      && (calls[0].name === 'addTable' || calls[0].name === 'addRow');
    if (!finalStatement?.isStandaloneCallStatementRoot && !localBindingStatement) {
      return { reason: 'replacement-parse-failure', detail: 'each frame insertion statement must end in one standalone direct UI call chain' };
    }
    for (let index = 1; index < calls.length; index += 1) {
      const previous = calls[index - 1];
      const receiver = blockCallReceiver(calls[index]);
      const previousSource = trimmed.slice(previous.source.start.offset, previous.source.end.offset);
      if (!receiver || !receiver.includes(previousSource)) {
        return { reason: 'replacement-parse-failure', detail: 'frame insertion block contains multiple calls that are not one local fluent UI chain' };
      }
    }
    const assignedNames = calls.flatMap(blockCallAssignedNames);
    if (statement.kind === 'local') {
      if (assignedNames.length !== 1
        || !/^[ \t]*local[ \t]+[A-Za-z_][A-Za-z0-9_]*[ \t]*=/.test(trimmed.slice(statement.source.start.offset, statement.source.end.offset))) {
        return { reason: 'replacement-parse-failure', detail: 'local frame block declarations may bind only one returned table or row value' };
      }
      if (!['addTable', 'addRow'].includes(calls[0].name)) {
        return { reason: 'replacement-parse-failure', detail: 'frame block local declarations may bind only returned tables or rows' };
      }
    } else if (assignedNames.length > 0) {
      return { reason: 'replacement-parse-failure', detail: 'frame block assignments may not mutate existing locals or owners' };
    }
  }
  if (trimmed.slice(cursor).trim().length > 0) {
    return { reason: 'replacement-parse-failure', detail: 'frame insertion block contains trailing control flow, comments, or unrelated Lua' };
  }
  const tableBindings = new Set<string>();
  const rowBindings = new Set<string>();
  const seenBindings = new Set<string>();
  for (const call of model.calls) {
    const assignedNames = blockCallAssignedNames(call);
    if (assignedNames.length > 0) {
      const assignedName = assignedNames[0];
      if (seenBindings.has(assignedName)) {
        return { reason: 'replacement-parse-failure', detail: `frame insertion block reassigns local binding ${assignedName}` };
      }
      seenBindings.add(assignedName);
      if (call.name === 'addTable') tableBindings.add(assignedName);
      else if (call.name === 'addRow') rowBindings.add(assignedName);
      else return { reason: 'replacement-parse-failure', detail: 'frame insertion block binds only addTable/addRow results' };
    }
    const receiver = blockCallReceiver(call);
    const receiverRoot = blockBindingRoot(receiver);
    if (call.name === 'addTable') {
      if (receiver !== frameReceiver || assignedNames.length !== 1) {
        return { reason: 'replacement-parse-failure', detail: 'every new table must be created directly through the selected frame owner' };
      }
    } else if (call.name === 'addRow' || call.name === 'setColWidth' || call.name === 'setColWidthPercent') {
      if (!receiverRoot || !tableBindings.has(receiverRoot)) {
        return { reason: 'replacement-parse-failure', detail: 'row and column operations must stay within a table created by this block' };
      }
    } else if (call.name !== 'display' && (!receiverRoot || !rowBindings.has(receiverRoot))) {
      return { reason: 'replacement-parse-failure', detail: 'cell and widget operations must stay within rows created by this block' };
    }
  }
  const rawAliases = ownData(model as unknown as object, 'aliases');
  if (!Array.isArray(rawAliases) || rawAliases.length !== seenBindings.size || !rawAliases.every(alias => {
    if (!isRecord(alias)) return false;
    const name = ownData(alias, 'name');
    const aliasKind = ownData(alias, 'aliasKind');
    const value = ownData(alias, 'value');
    const reference = isRecord(value) ? ownData(value, 'reference') : undefined;
    const referenceKind = isRecord(reference) ? ownData(reference, 'kind') : undefined;
    return typeof name === 'string'
      && seenBindings.has(name)
      && aliasKind === 'definition'
      && ((tableBindings.has(name) && referenceKind === 'table') || (rowBindings.has(name) && referenceKind === 'row'));
  })) {
    return { reason: 'replacement-parse-failure', detail: 'frame insertion block local bindings do not have exact table/row return proof' };
  }
  const formattedParts: string[] = [];
  const formattedCallSpans: DirectBlockPayloadCallSpan[] = [];
  let formattedOffset = 0;
  for (let index = 0; index < statements.length; index += 1) {
    const group = statements[index];
    const statementSource = trimmed.slice(group.statement.source.start.offset, group.statement.source.end.offset);
    if (!statementSource || /[\r\n]/.test(statementSource)) {
      return { reason: 'replacement-parse-failure', detail: 'frame insertion block formatting is unproven for a multi-line direct UI statement' };
    }
    const prefix = index === 0 ? '' : `${lineEnding}${indentation}`;
    const statementOffset = formattedOffset + prefix.length;
    formattedParts.push(prefix, statementSource);
    for (const call of group.calls) {
      const startOffset = call.source.start.offset - group.statement.source.start.offset;
      const endOffset = call.source.end.offset - group.statement.source.start.offset;
      if (startOffset < 0 || endOffset > statementSource.length || startOffset >= endOffset) {
        return { reason: 'replacement-parse-failure', detail: 'frame insertion block call source is not bounded by its proven statement' };
      }
      formattedCallSpans.push({
        call,
        startOffset: statementOffset + startOffset,
        endOffset: statementOffset + endOffset,
      });
    }
    formattedOffset += prefix.length + statementSource.length;
  }
  return {
    source: trimmed,
    formattedSource: formattedParts.join(''),
    formattedCallSpans,
    model,
    calls: model.calls,
    statements: statements.map(group => group.statement),
    frameReceiver,
  };
};

const frameReceiverForEntry = (
  entry: X4UiSourceEditInsertBlockEntry,
  file: X4UiSourceFile,
): string | undefined => {
  const binding = entry.provenance.callBindings.find(candidate => candidate.callName === 'display');
  if (!binding) return undefined;
  const call = file.callModel.calls.find(candidate => candidate.order === binding.callOrder
    && sameLocation(candidate.source, binding.callSource));
  return call ? blockCallReceiver(call) : undefined;
};

const insertedBlockBounds = (
  entry: X4UiSourceEditInsertBlockEntry,
  payload: DirectBlockPayloadProof,
): { readonly start: number; readonly end: number } => ({
  start: entry.startOffset + entry.indentation.length,
  end: entry.startOffset + entry.indentation.length + payload.formattedSource.length,
});

const insertedOperationFor = (
  afterProgram: X4UiLayoutProgram,
  entry: X4UiSourceEditInsertEntry,
  replacement: string,
  directPayload: DirectCallPayloadProof,
): X4UiLayoutOperation | undefined => {
  const insertedStart = entry.startOffset + entry.indentation.length;
  const insertedEnd = entry.startOffset + replacement.length;
  const candidates = afterProgram.operations.filter(operation => operation.kind === directPayload.call.name
    && operation.status === 'applied'
    && !operation.localExpansion
    && operation.source.start.offset >= insertedStart
    && operation.source.end.offset <= insertedEnd);
  return candidates.length === 1 ? candidates[0] : undefined;
};

const insertedOperationsForBlock = (
  afterProgram: X4UiLayoutProgram,
  entry: X4UiSourceEditInsertBlockEntry,
  payload: DirectBlockPayloadProof,
): readonly X4UiLayoutOperation[] | undefined => {
  const bounds = insertedBlockBounds(entry, payload);
  const candidates = afterProgram.operations.filter(operation => operation.status === 'applied'
    && !operation.localExpansion
    && operation.source.start.offset >= bounds.start
    && operation.source.end.offset <= bounds.end);
  if (candidates.length !== payload.calls.length) return undefined;
  const matched: X4UiLayoutOperation[] = [];
  for (const span of payload.formattedCallSpans) {
    const start = bounds.start + span.startOffset;
    const end = bounds.start + span.endOffset;
    const matches = candidates.filter(operation => operation.kind === span.call.name
      && operation.source.start.offset === start
      && operation.source.end.offset === end);
    if (matches.length !== 1) return undefined;
    matched.push(matches[0]);
  }
  return matched;
};

interface ReplacementLedgerProof {
  readonly callIndexes: readonly number[];
  readonly operationIndexes: readonly number[];
  readonly operations: readonly X4UiLayoutOperation[];
}

const replacementLedgerFor = (
  file: X4UiSourceFile,
  program: X4UiLayoutProgram,
  entry: X4UiSourceEditReplaceEntry,
  replacement: string,
  payload: DirectStatementReplacementPayloadProof,
): ReplacementLedgerProof | undefined => {
  const replacementStart = entry.startOffset;
  const replacementEnd = entry.startOffset + replacement.length;
  const callIndexes: number[] = [];
  const usedCallIndexes = new Set<number>();
  for (const expected of payload.calls) {
    const expectedStart = replacementStart + expected.source.start.offset;
    const expectedEnd = replacementStart + expected.source.end.offset;
    const expectedSource = payload.source.slice(expected.source.start.offset, expected.source.end.offset);
    const candidates = file.callModel.calls
      .map((call, index) => ({ call, index }))
      .filter(({ call, index }) => !usedCallIndexes.has(index)
        && call.name === expected.name
        && call.source.start.offset === expectedStart
        && call.source.end.offset === expectedEnd
        && file.text.slice(call.source.start.offset, call.source.end.offset) === expectedSource);
    if (candidates.length !== 1) return undefined;
    usedCallIndexes.add(candidates[0].index);
    callIndexes.push(candidates[0].index);
  }
  const boundedCallIndexes = file.callModel.calls
    .map((call, index) => ({ call, index }))
    .filter(({ call }) => call.source.start.offset >= replacementStart
      && call.source.end.offset <= replacementEnd)
    .map(({ index }) => index);
  if (boundedCallIndexes.length !== callIndexes.length
    || boundedCallIndexes.some(index => !usedCallIndexes.has(index))) return undefined;

  const operationIndexes: number[] = [];
  const operations: X4UiLayoutOperation[] = [];
  const usedOperationIndexes = new Set<number>();
  for (let index = 0; index < payload.calls.length; index += 1) {
    const expectedCall = payload.calls[index];
    const callIndex = callIndexes[index];
    const afterCall = file.callModel.calls[callIndex];
    const candidates = program.operations
      .map((operation, operationIndex) => ({ operation, operationIndex }))
      .filter(({ operation, operationIndex }) => !usedOperationIndexes.has(operationIndex)
        && operation.kind === expectedCall.name
        && operation.modelOrder === afterCall.order
        && operation.status === 'applied'
        && !operation.localExpansion
        && sameLocation(operation.source, afterCall.source));
    if (candidates.length !== 1) return undefined;
    usedOperationIndexes.add(candidates[0].operationIndex);
    operationIndexes.push(candidates[0].operationIndex);
    operations.push(candidates[0].operation);
  }
  const boundedOperationIndexes = program.operations
    .map((operation, index) => ({ operation, index }))
    .filter(({ operation }) => operation.source.start.offset >= replacementStart
      && operation.source.end.offset <= replacementEnd)
    .map(({ index }) => index);
  if (boundedOperationIndexes.length !== operationIndexes.length
    || boundedOperationIndexes.some(index => !usedOperationIndexes.has(index))
    || boundedOperationIndexes.some(index => program.operations[index].status !== 'applied'
      || program.operations[index].localExpansion)) return undefined;
  return { callIndexes, operationIndexes, operations };
};

const replacementRowOwnerMatches = (
  entry: X4UiSourceEditReplaceEntry,
  operations: readonly X4UiLayoutOperation[],
  owners: ReadonlyMap<string, X4UiSourceEditStructuralOwner>,
): boolean => {
  const expected = entry.provenance.rowOwner;
  if (!expected || operations.length === 0) return false;
  return operations.every(operation => {
    const owner = owners.get(operation.id);
    const record = operation as unknown as Record<string, unknown>;
    const tableId = recordString(record, 'tableId');
    const rowId = recordString(record, 'rowId');
    const cellId = recordString(record, 'cellId');
    return owner?.kind === 'table'
      && owner.ownerId === expected.tableId
      && owner.frameId === expected.frameId
      && tableId === expected.tableId
      && rowId === expected.rowId
      && cellId !== undefined;
  });
};

const structuralAnchorOwnerMatches = (
  entry: X4UiSourceEditInsertEntry,
  insertedOwner: X4UiSourceEditStructuralOwner | undefined,
): boolean => {
  const anchorOwner = entry.provenance.owner;
  if (!anchorOwner || !insertedOwner) return false;
  if (entry.anchor === 'first-row') {
    return anchorOwner.kind === 'table'
      && insertedOwner.kind === 'table'
      && anchorOwner.frameId !== undefined
      && insertedOwner.frameId !== undefined
      && insertedOwner.ownerId === anchorOwner.ownerId
      && insertedOwner.frameId === anchorOwner.frameId;
  }
  return anchorOwner.kind === 'frame'
    && ((insertedOwner.kind === 'frame'
      && insertedOwner.ownerId === anchorOwner.ownerId
      && insertedOwner.frameId === anchorOwner.frameId)
      || (insertedOwner.kind === 'table'
        && insertedOwner.frameId !== undefined
        && insertedOwner.frameId === anchorOwner.ownerId));
};

const structuralBlockOwnersMatch = (
  entry: X4UiSourceEditInsertBlockEntry,
  insertedOperations: readonly X4UiLayoutOperation[],
  owners: ReadonlyMap<string, X4UiSourceEditStructuralOwner>,
): boolean => {
  const anchorOwner = entry.provenance.owner;
  if (!anchorOwner || anchorOwner.kind !== 'frame' || insertedOperations.length === 0) return false;
  const tableIds = new Set<string>();
  let hasRow = false;
  for (const operation of insertedOperations) {
    const owner = owners.get(operation.id);
    if (operation.kind === 'addTable') {
      if (!owner || owner.kind !== 'table' || owner.frameId !== anchorOwner.ownerId) return false;
      tableIds.add(owner.ownerId);
      continue;
    }
    if (!owner || owner.kind !== 'table' || owner.frameId !== anchorOwner.ownerId || !tableIds.has(owner.ownerId)) return false;
    if (operation.kind === 'addRow') hasRow = true;
  }
  return tableIds.size > 0 && hasRow;
};

interface StructuralLedgerDeltaProof {
  readonly addedCallIndexes: readonly number[];
  readonly addedOperationIndexes: readonly number[];
}

const structuralLedgerDelta = (
  beforeFile: X4UiSourceFile,
  afterFile: X4UiSourceFile,
  beforeProgram: X4UiLayoutProgram,
  afterProgram: X4UiLayoutProgram,
  entry: X4UiSourceEditStructuralEntry,
  replacement: string,
  directPayload: DirectStructuralPayload | undefined,
): StructuralLedgerDeltaProof | undefined => {
  const beforeCalls = beforeFile.callModel.calls;
  const afterCalls = afterFile.callModel.calls;
  let insertedIndex = -1;
  let insertedCallIndexes: readonly number[] = [];
  let replacementLedger: ReplacementLedgerProof | undefined;
  if (entry.kind === 'insert-call') {
    if (!directPayload || !('call' in directPayload)) return undefined;
    const insertedStart = entry.startOffset + entry.indentation.length;
    const insertedEnd = entry.startOffset + replacement.length;
    const candidates = afterCalls.map((call, index) => ({ call, index })).filter(({ call }) =>
      call.source.start.offset >= insertedStart
      && call.source.end.offset <= insertedEnd
      && call.name === directPayload.call.name
      && afterFile.text.slice(call.source.start.offset, call.source.end.offset) === directPayload.source,
    );
    if (candidates.length !== 1) return undefined;
    insertedIndex = candidates[0].index;
    insertedCallIndexes = [insertedIndex];
  } else if (entry.kind === 'insert-block') {
    if (!directPayload || !('calls' in directPayload) || !('formattedCallSpans' in directPayload)) return undefined;
    const bounds = insertedBlockBounds(entry, directPayload);
    const candidates = afterCalls.filter(call => call.source.start.offset >= bounds.start
      && call.source.end.offset <= bounds.end);
    if (candidates.length !== directPayload.formattedCallSpans.length
      || !directPayload.formattedCallSpans.every(expected => {
        const start = bounds.start + expected.startOffset;
        const end = bounds.start + expected.endOffset;
        return candidates.filter(actual => actual.name === expected.call.name
          && actual.source.start.offset === start
          && actual.source.end.offset === end
          && afterFile.text.slice(actual.source.start.offset, actual.source.end.offset)
            === directPayload.formattedSource.slice(expected.startOffset, expected.endOffset)).length === 1;
      })) return undefined;
    insertedCallIndexes = afterCalls
      .map((call, index) => ({ call, index }))
      .filter(({ call }) => call.source.start.offset >= bounds.start
        && call.source.end.offset <= bounds.end)
      .map(({ index }) => index);
  } else if (entry.kind === 'replace-statement') {
    if (!directPayload || !('calls' in directPayload) || !('statement' in directPayload)) return undefined;
    replacementLedger = replacementLedgerFor(
      afterFile,
      afterProgram,
      entry,
      replacement,
      directPayload,
    );
    if (!replacementLedger) return undefined;
    insertedCallIndexes = replacementLedger.callIndexes;
  }
  const afterOperations = afterProgram.operations;
  let insertedOperationIndex = -1;
  let insertedOperationIndexes: readonly number[] = [];
  if (entry.kind === 'insert-call') {
    if (!directPayload || !('call' in directPayload)) return undefined;
    const insertedOperation = insertedOperationFor(afterProgram, entry, replacement, directPayload);
    if (!insertedOperation) return undefined;
    insertedOperationIndex = afterOperations.indexOf(insertedOperation);
    if (insertedOperationIndex < 0) return undefined;
    insertedOperationIndexes = [insertedOperationIndex];
  } else if (entry.kind === 'insert-block') {
    if (!directPayload || !('calls' in directPayload) || !('formattedCallSpans' in directPayload)
      || !insertedOperationsForBlock(afterProgram, entry, directPayload)) return undefined;
    const bounds = insertedBlockBounds(entry, directPayload);
    insertedOperationIndexes = afterOperations
      .map((operation, index) => ({ operation, index }))
      .filter(({ operation }) => operation.source.start.offset >= bounds.start
        && operation.source.end.offset <= bounds.end
        && operation.status === 'applied'
        && !operation.localExpansion)
      .map(({ index }) => index);
  } else if (entry.kind === 'replace-statement') {
    if (!replacementLedger) return undefined;
    insertedOperationIndexes = replacementLedger.operationIndexes;
  }
  const correspondenceInput: X4UiSourceStructuralLedgerCorrespondenceInput = {
    beforeCalls,
    afterCalls,
    beforeRecords: beforeFile.callModel.records,
    afterRecords: afterFile.callModel.records,
    beforeOperations: beforeProgram.operations,
    afterOperations,
    entry,
    beforeText: beforeFile.text,
    afterText: afterFile.text,
    replacementLength: replacement.length,
    insertedCallIndex: insertedIndex,
    insertedOperationIndex,
    ...(entry.kind === 'replace-statement' && replacementLedger ? {
      replacementCallIndexes: replacementLedger.callIndexes,
      replacementCallNames: replacementLedger.callIndexes.map(index => afterCalls[index].name),
      replacementCallOrders: replacementLedger.callIndexes.map(index => afterCalls[index].order),
      replacementOperationIndexes: replacementLedger.operationIndexes,
      replacementOperationKinds: replacementLedger.operationIndexes.map(index => afterOperations[index].kind),
      replacementOperationIds: replacementLedger.operationIndexes.map(index => afterOperations[index].id),
      replacementOperationModelOrders: replacementLedger.operationIndexes.map(index => afterOperations[index].modelOrder),
    } : {}),
  };
  const correspondence = compareX4UiSourceStructuralLedgerCorrespondence(correspondenceInput);
  return correspondence ? { addedCallIndexes: insertedCallIndexes, addedOperationIndexes: insertedOperationIndexes } : undefined;
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
    if (!scalarProgramIsActionable(context.program)) {
      return issueCatalog(context, prerequisiteCatalog(context, {
        reason: 'operation-not-applied',
        detail: `layout program status ${context.program.status} or operation stream is non-actionable; scalar action requires a nonempty projected/partial stream with every operation applied`,
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
    const catalog = catalogFromEntries(
      target,
      context.program.target.sourceIdentity,
      file.path,
      file.text,
      entries,
      'ready',
      entries.some(entry => entry.kind === 'editable')
        ? 'direct source literals are available for bounded CAS editing'
        : 'selected source is valid but no direct editable scalar literal was proven',
    );
    const structuralEntries = context.program.status === 'projected'
      ? structuralEntriesFor(file, target, context.program, context.evidenceAuthority)
      : context.program.status === 'partial'
        ? structuralEntriesFor(file, target, context.program, context.evidenceAuthority)
          .filter(entry => entry.kind === 'insert-block'
            || (entry.kind === 'delete-statement' && entry.provenance.owner !== undefined))
        : [];
    const deleteEntries = structuralEntries.filter((entry): entry is X4UiSourceEditDeleteEntry => entry.kind === 'delete-statement');
    const replaceEntries = structuralEntries.filter((entry): entry is X4UiSourceEditReplaceEntry => entry.kind === 'replace-statement');
    const insertEntries = structuralEntries.filter((entry): entry is X4UiSourceEditInsertionEntry => entry.kind === 'insert-call' || entry.kind === 'insert-block');
    return issueCatalog(context, freezeDeep({
      ...catalog,
      structuralEntries,
      deleteEntries: freezeArray(deleteEntries),
      replaceEntries: freezeArray(replaceEntries),
      insertEntries: freezeArray(insertEntries),
    }));
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
export const discoverX4UiSourceStructuralEdits = discoverX4UiSourceEdits;
export const catalogX4UiSourceStructuralEdits = discoverX4UiSourceEdits;

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
    const beforeFile = beforeFiles[index];
    const afterFile = afterFiles[index];
    if (!sameClosedData(beforeFile, afterFile)) {
      changedRecordCount += 1;
      if (index !== selection.workspaceIndex) return false;
      if (afterFile.path !== path || afterFile.content !== undefined) {
        const expectedContent = typeof beforeFile.content === 'string'
          ? beforeFile.content.slice(0, startOffset) + replacement + beforeFile.content.slice(endOffset)
          : undefined;
        if (afterFile.content !== expectedContent) return false;
        const afterCasFile = afterSource.cas.passthroughFiles[index];
        if (afterFile.bytes !== afterCasFile?.bytes) return false;
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
  const nextProgramResult = reprojectX4UiLayoutProgramWithIssuedColorAuthority(
    input.program,
    input.evidenceAuthority,
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

interface StructuralReparseProof {
  readonly workspace: ModWorkspace;
  readonly source: X4UiWorkspaceSource;
  readonly catalog: X4UiSourceEditCatalog;
}

const reparseStructuralAndProveUnsafe = (
  input: X4UiSourceEditTrustedContext,
  selection: SourceSelection,
  entry: X4UiSourceEditStructuralEntry,
  replacement: string,
  nextWorkspace: ModWorkspace,
  nextSource: X4UiWorkspaceSource,
  directPayload: DirectStructuralPayload | undefined,
): StructuralReparseProof | ReparseFailure => {
  if (nextSource.status !== 'source-owned' || !nextSource.bundle || !nextSource.projection) {
    return { reason: 'reparse-failure', detail: 'complete source reparse no longer produces source-owned UI authority' };
  }
  if (!nextSource.bundle.sourceFiles.every(file => file.parseStatus === 'parsed')) {
    return { reason: 'reparse-failure', detail: 'complete source reparse contains a locked Lua document' };
  }
  const nextFile = nextSource.bundle.sourceFiles.find(file => file.path === entry.path);
  if (!nextFile || nextFile.parseStatus !== 'parsed') {
    return { reason: 'reparse-failure', detail: 'edited Lua source is missing after complete structural edit' };
  }
  const nextModel = layoutModel(nextFile.callModel);
  const nextIdentity: X4UiLayoutModelIdentity = {
    file: nextModel.file.rel,
    ...(nextModel.file.sourcePath !== undefined ? { sourcePath: nextModel.file.sourcePath } : {}),
    sha256: sha256(nextFile.text),
  };
  const retainedOffset = entry.kind === 'insert-call' || entry.kind === 'replace-statement'
    ? entry.startOffset + replacement.length
    : entry.startOffset;
  const nextTarget = nextTargetFor(
    input.program.target,
    createX4UiLayoutTargetCatalog(nextModel),
    entry.startOffset,
    retainedOffset,
  );
  if (!nextTarget || !sameIdentity(nextTarget.sourceIdentity, nextIdentity)) {
    return { reason: 'reparse-provenance-drift', detail: 'selected target provenance was not re-established after the structural edit' };
  }
  const nextProfile = { ...input.program.profile, source: nextIdentity };
  const nextProgramResult = reprojectX4UiLayoutProgramWithIssuedColorAuthority(
    input.program,
    input.evidenceAuthority,
    nextModel,
    targetSelector(nextTarget),
    nextProfile,
  );
  if (nextProgramResult.status === 'refused' || !nextProgramResult.program) {
    return { reason: 'reparse-provenance-drift', detail: 'layout program refused the structurally reparsed source' };
  }
  if (!modelMatchesEvidenceAuthority(nextModel, nextProgramResult.program, nextProgramResult.evidenceAuthority)) {
    return { reason: 'reparse-provenance-drift', detail: 'reparsed structural source lost exact call/evidence authority' };
  }
  if (entry.kind === 'insert-call') {
    if (!directPayload || !('call' in directPayload)) {
      return { reason: 'reparse-provenance-drift', detail: 'inserted structural call lost its direct payload proof' };
    }
    const insertedOperation = insertedOperationFor(nextProgramResult.program, entry, replacement, directPayload);
    const nextOwners = structuralOwnerLedger(nextModel, nextProgramResult.program);
    if (!insertedOperation || !structuralAnchorOwnerMatches(entry, nextOwners.get(insertedOperation.id))) {
      return { reason: 'reparse-provenance-drift', detail: 'inserted structural call is not owned by the issued anchor owner' };
    }
  } else if (entry.kind === 'insert-block') {
    if (!directPayload || !('calls' in directPayload) || !('formattedSource' in directPayload)) {
      return { reason: 'reparse-provenance-drift', detail: 'inserted frame block lost its direct payload proof' };
    }
    const insertedOperations = insertedOperationsForBlock(nextProgramResult.program, entry, directPayload);
    const nextOwners = structuralOwnerLedger(nextModel, nextProgramResult.program);
    if (!insertedOperations || !structuralBlockOwnersMatch(entry, insertedOperations, nextOwners)) {
      return { reason: 'reparse-provenance-drift', detail: 'inserted frame block is not owned by the issued frame/display authority' };
    }
  } else if (entry.kind === 'replace-statement') {
    if (!directPayload || !('calls' in directPayload) || !('statement' in directPayload)) {
      return { reason: 'reparse-provenance-drift', detail: 'replacement statement lost its direct payload proof' };
    }
    const replacementLedger = replacementLedgerFor(nextFile, nextProgramResult.program, entry, replacement, directPayload);
    const nextOwners = structuralOwnerLedger(nextModel, nextProgramResult.program);
    if (!replacementLedger
      || replacementLedger.operations.length !== directPayload.calls.length
      || !replacementRowOwnerMatches(entry, replacementLedger.operations, nextOwners)) {
      return { reason: 'reparse-provenance-drift', detail: 'replacement calls are not all applied on the issued row/table/frame owner chain' };
    }
  }
  const ledgerDelta = structuralLedgerDelta(
    selection.file,
    nextFile,
    input.program,
    nextProgramResult.program,
    entry,
    replacement,
    directPayload,
  );
  if (!ledgerDelta) {
    return { reason: 'reparse-provenance-drift', detail: 'structural edit did not produce the exact intended call and operation ledger delta' };
  }
  const nextCatalog = discoverX4UiSourceEdits(
    nextWorkspace,
    nextSource,
    nextProgramResult.program,
    nextProgramResult.evidenceAuthority,
  );
  if (nextCatalog.status !== 'ready'
    || !nextCatalog.structuralEntries
    || nextCatalog.sourceIdentity.sha256 === entry.provenance.sourceIdentity.sha256) {
    return { reason: 'reparse-provenance-drift', detail: 'structural edit did not issue a new source/layout authority catalog' };
  }
  if (entry.kind === 'insert-call') {
    const sameKindAnchor = nextCatalog.insertEntries?.find(candidate => candidate.anchor === entry.anchor);
    let reissuedAnchor = sameKindAnchor;
    if (!reissuedAnchor && entry.anchor === 'fallback-display' && directPayload && 'call' in directPayload) {
      const transitionedAnchor = nextCatalog.insertEntries?.find(candidate => candidate.anchor === 'first-row');
      const insertedOperation = insertedOperationFor(nextProgramResult.program, entry, replacement, directPayload);
      const nextOwners = structuralOwnerLedger(nextModel, nextProgramResult.program);
      const insertedOwner = insertedOperation ? nextOwners.get(insertedOperation.id) : undefined;
      const transitionedOwner = transitionedAnchor?.provenance.owner;
      if (transitionedAnchor
        && insertedOwner?.kind === 'table'
        && transitionedOwner?.kind === 'table'
        && insertedOwner.ownerId === transitionedOwner.ownerId
        && insertedOwner.frameId !== undefined
        && insertedOwner.frameId === transitionedOwner.frameId
        && insertedOwner.frameId === entry.provenance.owner?.ownerId
        && structuralAnchorOwnerMatches(entry, insertedOwner)) {
        reissuedAnchor = transitionedAnchor;
      }
    }
    if (!reissuedAnchor
      || reissuedAnchor.expectedText !== ''
      || reissuedAnchor.provenance.sourceIdentity.sha256 === entry.provenance.sourceIdentity.sha256) {
      return { reason: 'reparse-provenance-drift', detail: 'inserted source did not reissue the selected structural anchor' };
    }
  } else if (entry.kind === 'insert-block') {
    const reissuedBlock = nextCatalog.insertEntries?.find(candidate => candidate.kind === 'insert-block'
      && candidate.anchor === 'frame-display');
    if (!reissuedBlock
      || reissuedBlock.expectedText !== ''
      || reissuedBlock.provenance.sourceIdentity.sha256 === entry.provenance.sourceIdentity.sha256
      || reissuedBlock.provenance.owner?.kind !== 'frame'
      || reissuedBlock.provenance.owner.ownerId !== entry.provenance.owner?.ownerId) {
      return { reason: 'reparse-provenance-drift', detail: 'frame block insertion did not reissue the selected frame/display authority' };
    }
  } else if (entry.kind === 'replace-statement') {
    const reissuedReplacement = nextCatalog.replaceEntries?.find(candidate =>
      candidate.kind === 'replace-statement'
      && candidate.startOffset === entry.startOffset
      && candidate.expectedText === replacement
      && candidate.provenance.rowOwner?.frameId === entry.provenance.rowOwner.frameId
      && candidate.provenance.rowOwner?.tableId === entry.provenance.rowOwner.tableId
      && candidate.provenance.rowOwner?.rowId === entry.provenance.rowOwner.rowId);
    if (!reissuedReplacement
      || reissuedReplacement.provenance.sourceIdentity.sha256 === entry.provenance.sourceIdentity.sha256) {
      return { reason: 'reparse-provenance-drift', detail: 'replacement source did not reissue the selected row/table/frame authority' };
    }
  }
  return { workspace: nextWorkspace, source: nextSource, catalog: nextCatalog };
};

const reparseStructuralAndProve = (
  input: X4UiSourceEditTrustedContext,
  selection: SourceSelection,
  entry: X4UiSourceEditStructuralEntry,
  replacement: string,
  nextWorkspace: ModWorkspace,
  nextSource: X4UiWorkspaceSource,
  directPayload: DirectStructuralPayload | undefined,
): StructuralReparseProof | ReparseFailure => {
  try {
    return reparseStructuralAndProveUnsafe(
      input,
      selection,
      entry,
      replacement,
      nextWorkspace,
      nextSource,
      directPayload,
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'complete structural source reparse failed with an unknown layout error';
    return { reason: 'reparse-failure', detail: `complete structural source reparse was contained: ${detail}` };
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
    if (hasUnsafeAuthorityGraph(
      authority.workspace,
      authority.source,
      catalog,
      authority.program,
      authority.evidenceAuthority,
    )) {
      return refusal(
        authority.workspace,
        authority.source,
        catalog,
        'unsupported-provenance',
        'source edit authority contains an accessor or unsupported own data surface',
      );
    }
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
    const detachedWorkspace = cloneDataGraph(authority.workspace);
    const detachedSource = cloneDataGraph(authority.source);
    const detachedCatalog = cloneDataGraph(catalog);
    const detachedEntry = cloneDataGraph(entry);
    return freezeDeep({
      accepted: true,
      changed: false,
      workspace: detachedWorkspace,
      source: detachedSource,
      catalog: detachedCatalog,
      entry: detachedEntry,
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
  const splice = spliceX4UiWorkspaceSource(
    spliceInputBoundary(authority.workspace),
    spliceInputBoundary(authority.source),
    {
      path: entry.path,
      startOffset: entry.startOffset,
      endOffset: entry.endOffset,
      expectedText: entry.expectedText,
      replacement: encoded.replacement,
    },
  );
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
  if (hasUnsafeAuthorityGraph(proof.workspace, proof.source, proof.catalog, proof.entry)) {
    return refusal(
      authority.workspace,
      authority.source,
      catalog,
      'unsupported-provenance',
      'reparsed source edit authority contains an accessor or unsupported own data surface',
      entry,
    );
  }
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
    || !scalarProgramIsActionable(catalogAuthority.program)) {
    return refusal(workspace, source, catalog, 'unsupported-provenance', 'catalog layout authority is no longer an issued scalar-actionable projected/partial pair');
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

const structuralRefusal = (
  workspace: ModWorkspace,
  source: X4UiWorkspaceSource,
  catalog: X4UiSourceEditCatalog,
  reason: X4UiSourceEditRefusalReason,
  detail: string,
  entry?: X4UiSourceEditStructuralEntry,
): X4UiRefusedSourceStructuralEditResult => Object.freeze({
  accepted: false,
  changed: false,
  workspace,
  source,
  catalog,
  reason,
  detail,
  ...(entry ? { entry } : {}),
});

const structuralSequenceMatches = (
  catalog: X4UiSourceEditCatalog,
  authority: X4UiSourceEditAuthority,
): boolean => {
  const structuralEntries = catalog.structuralEntries;
  const issuedReplaceEntries = authority.structuralSequence.filter((entry): entry is X4UiSourceEditReplaceEntry => entry.kind === 'replace-statement');
  const replaceEntries = catalog.replaceEntries;
  return Array.isArray(structuralEntries)
    && structuralEntries.length === authority.structuralSequence.length
    && structuralEntries.every((entry, index) => entry === authority.structuralSequence[index])
    && Array.isArray(replaceEntries)
    && replaceEntries.length === issuedReplaceEntries.length
    && replaceEntries.every((entry, index) => entry === issuedReplaceEntries[index]);
};

const applyX4UiSourceStructuralEditUnsafe = (
  authority: X4UiSourceEditAuthority,
  catalog: X4UiSourceEditCatalog,
  actionId: string,
  directCall: string | undefined,
  expectedPath?: string,
  expectedStartOffset?: number,
  expectedEndOffset?: number,
  expectedText?: string,
): X4UiSourceStructuralEditResult => {
  try {
    if (hasUnsafeAuthorityGraph(
      authority.workspace,
      authority.source,
      catalog,
      authority.program,
      authority.evidenceAuthority,
    )) {
      return structuralRefusal(
        authority.workspace,
        authority.source,
        catalog,
        'unsupported-provenance',
        'structural source edit authority contains an accessor or unsupported own data surface',
      );
    }
    if (!workspaceSnapshotMatches(authority.workspace, authority.source)) {
      return structuralRefusal(authority.workspace, authority.source, catalog, 'workspace-source-mismatch', 'workspace passthrough records no longer match the source CAS snapshot');
    }
    const selection = selectSource(authority);
    if ('reason' in selection) return structuralRefusal(authority.workspace, authority.source, catalog, selection.reason, selection.detail);
    const normalizedModel = layoutModel(selection.file.callModel);
    if (!isIssuedX4UiLayoutEvidencePairForModel(authority.program, authority.evidenceAuthority, normalizedModel)
      || !modelMatchesEvidenceAuthority(normalizedModel, authority.program, authority.evidenceAuthority)) {
      return structuralRefusal(authority.workspace, authority.source, catalog, 'unsupported-provenance', 'structural catalog layout authority does not exactly match the canonical complete source call model');
    }
    if (!Array.isArray(catalog.entries)
      || catalog.entries.length !== authority.entrySequence.length
      || catalog.entries.some((entry, index) => entry !== authority.entrySequence[index])
      || !structuralSequenceMatches(catalog, authority)) {
      return structuralRefusal(authority.workspace, authority.source, catalog, 'foreign-entry', 'structural source edit catalog entries are not the exact owner-issued entries');
    }
    if (catalog.status !== 'ready') {
      return structuralRefusal(authority.workspace, authority.source, catalog, catalog.reason || 'source-locked', catalog.detail);
    }
    if (!sameIdentity(catalog.sourceIdentity, authority.program.target.sourceIdentity)
      || catalog.target.id !== authority.program.target.id) {
      return structuralRefusal(authority.workspace, authority.source, catalog, 'foreign-target-identity', 'structural catalog source or target identity differs from the selected program');
    }
    const entry = authority.structuralEntries.get(actionId);
    if (!entry) return structuralRefusal(authority.workspace, authority.source, catalog, 'entry-not-found', 'requested structural source edit entry is not in the catalog');
    if (entryAuthorities.get(entry) !== authority) {
      return structuralRefusal(authority.workspace, authority.source, catalog, 'foreign-entry', 'selected structural source edit entry is not the exact owner-issued entry', entry);
    }
    if (entry.path !== selection.file.path || entry.provenance.targetId !== authority.program.target.id) {
      return structuralRefusal(authority.workspace, authority.source, catalog, 'foreign-entry', 'structural entry does not belong to the selected source and target', entry);
    }
    if (!sameIdentity(entry.provenance.sourceIdentity, authority.program.target.sourceIdentity)
      || sha256(selection.file.text) !== entry.provenance.sourceIdentity.sha256) {
      return structuralRefusal(authority.workspace, authority.source, catalog, 'foreign-source-identity', 'structural entry source identity is stale or foreign', entry);
    }
    if (!validOffset(entry.startOffset)
      || !validOffset(entry.endOffset)
      || entry.startOffset > entry.endOffset
      || entry.endOffset > selection.file.text.length
      || selection.file.text.slice(entry.startOffset, entry.endOffset) !== entry.expectedText) {
      return structuralRefusal(authority.workspace, authority.source, catalog, 'stale-expected-text', 'structural entry expected text is stale', entry);
    }
    if (expectedPath !== undefined && expectedPath !== entry.path) {
      return structuralRefusal(authority.workspace, authority.source, catalog, 'stale-range', 'expected path does not match the issued structural entry', entry);
    }
    if (expectedStartOffset !== undefined && expectedStartOffset !== entry.startOffset) {
      return structuralRefusal(authority.workspace, authority.source, catalog, 'stale-range', 'expected start offset does not match the issued structural entry', entry);
    }
    if (expectedEndOffset !== undefined && expectedEndOffset !== entry.endOffset) {
      return structuralRefusal(authority.workspace, authority.source, catalog, 'stale-range', 'expected end offset does not match the issued structural entry', entry);
    }
    if (expectedText !== undefined && expectedText !== entry.expectedText) {
      return structuralRefusal(authority.workspace, authority.source, catalog, 'stale-expected-text', 'expected text does not match the issued structural entry', entry);
    }

    let replacement = '';
    let directPayload: DirectStructuralPayload | undefined;
    if (entry.kind === 'delete-statement') {
      if (directCall !== undefined) {
        return structuralRefusal(authority.workspace, authority.source, catalog, 'invalid-request', 'whole-statement deletion does not accept an insertion payload', entry);
      }
    } else if (entry.kind === 'replace-statement') {
      if (directCall === undefined) {
        return structuralRefusal(authority.workspace, authority.source, catalog, 'invalid-request', 'statement replacement requires a Lua source payload', entry);
      }
      if (!entry.provenance.owner || !entry.provenance.rowOwner) {
        return structuralRefusal(authority.workspace, authority.source, catalog, 'provenance-drift', 'statement replacement has no exact issued row/table/frame owner proof', entry);
      }
      const parsedPayload = directStatementReplacementPayload(entry.path, directCall);
      if ('reason' in parsedPayload) {
        return structuralRefusal(authority.workspace, authority.source, catalog, parsedPayload.reason, parsedPayload.detail, entry);
      }
      directPayload = parsedPayload;
      replacement = parsedPayload.source;
    } else if (entry.kind === 'insert-call') {
      if (directCall === undefined) {
        return structuralRefusal(authority.workspace, authority.source, catalog, 'invalid-request', 'direct-call insertion requires a Lua source payload', entry);
      }
      const parsedPayload = directCallPayload(entry.path, directCall);
      if ('reason' in parsedPayload) {
        return structuralRefusal(authority.workspace, authority.source, catalog, parsedPayload.reason, parsedPayload.detail, entry);
      }
      directPayload = parsedPayload;
      replacement = `${entry.indentation}${parsedPayload.source}${entry.lineEnding}`;
    } else {
      if (directCall === undefined) {
        return structuralRefusal(authority.workspace, authority.source, catalog, 'invalid-request', 'frame block insertion requires a Lua source payload', entry);
      }
      const frameReceiver = frameReceiverForEntry(entry, selection.file);
      if (!frameReceiver) {
        return structuralRefusal(authority.workspace, authority.source, catalog, 'provenance-drift', 'frame block insertion has no exact selected-frame display receiver proof', entry);
      }
      const parsedPayload = directBlockPayload(
        entry.path,
        directCall,
        frameReceiver,
        entry.indentation,
        entry.lineEnding,
      );
      if ('reason' in parsedPayload) {
        return structuralRefusal(authority.workspace, authority.source, catalog, parsedPayload.reason, parsedPayload.detail, entry);
      }
      directPayload = parsedPayload;
      replacement = `${entry.indentation}${parsedPayload.formattedSource}${entry.lineEnding}`;
    }
    const splice = spliceX4UiWorkspaceSource(
      spliceInputBoundary(authority.workspace),
      spliceInputBoundary(authority.source),
      {
        path: entry.path,
        startOffset: entry.startOffset,
        endOffset: entry.endOffset,
        expectedText: entry.expectedText,
        replacement,
      },
    );
    if (!splice.accepted) {
      const refusalReason: X4UiSourceEditRefusalReason = splice.reason === 'replacement-parse-failure'
        ? 'replacement-parse-failure'
        : 'source-cas-refusal';
      return structuralRefusal(authority.workspace, authority.source, catalog, refusalReason, `workspace source CAS refused the structural edit: ${splice.reason || 'unknown refusal'}`, entry);
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
      replacement,
    )) {
      return structuralRefusal(authority.workspace, authority.source, catalog, 'byte-locality-failure', 'accepted structural source splice changed more than the issued CAS range', entry);
    }
    const proof = reparseStructuralAndProve(
      authority,
      selection,
      entry,
      replacement,
      splice.workspace,
      splice.source,
      directPayload,
    );
    if ('reason' in proof) return structuralRefusal(authority.workspace, authority.source, catalog, proof.reason, proof.detail, entry);
    if (hasUnsafeAuthorityGraph(proof.workspace, proof.source, proof.catalog, entry)) {
      return structuralRefusal(
        authority.workspace,
        authority.source,
        catalog,
        'unsupported-provenance',
        'reparsed structural authority contains an accessor or unsupported own data surface',
        entry,
      );
    }
    return freezeDeep({
      accepted: true,
      changed: true,
      workspace: proof.workspace,
      source: proof.source,
      catalog: proof.catalog,
      entry: cloneDataGraph(entry),
      path: entry.path,
      startOffset: entry.startOffset,
      endOffset: entry.endOffset,
      expectedText: entry.expectedText,
      replacement,
      byteLocal: true,
      reparsed: true,
      provenanceReestablished: true,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'structural source edit failed with an unknown model or layout error';
    return structuralRefusal(authority.workspace, authority.source, catalog, 'unsupported-provenance', `structural source edit refusal was contained: ${detail}`);
  }
};

/** Apply one owner-issued whole-statement deletion, row-local replacement, or direct-call insertion. */
export function applyX4UiSourceStructuralEdit(
  workspace: ModWorkspace,
  source: X4UiWorkspaceSource,
  catalog: X4UiSourceEditCatalog,
  actionId: string,
  directCall?: string,
  expectedPath?: string,
  expectedStartOffset?: number,
  expectedEndOffset?: number,
  expectedText?: string,
): X4UiSourceStructuralEditResult {
  const workspacePairIssued = isIssuedX4UiWorkspaceSourcePair(workspace, source);
  const catalogAuthority = catalog !== null && (typeof catalog === 'object' || typeof catalog === 'function')
    ? catalogAuthorities.get(catalog)
    : undefined;
  const refusalWorkspace = safeRefusalWorkspace(workspace);
  const refusalSource = safeRefusalSource(source);
  const refusalCatalog = safeRefusalCatalog(catalog);
  if (!workspacePairIssued) {
    return structuralRefusal(refusalWorkspace, refusalSource, refusalCatalog, 'workspace-source-mismatch', 'workspace/source pair was not issued by the workspace source owner');
  }
  if (!catalogAuthority) {
    return structuralRefusal(refusalWorkspace, refusalSource, refusalCatalog, 'unsupported-provenance', 'source edit catalog was not issued by structural source-edit discovery');
  }
  if (catalogAuthority.workspace !== workspace || catalogAuthority.source !== source) {
    return structuralRefusal(workspace, source, catalog, 'unsupported-provenance', 'structural source edit catalog belongs to a different issued workspace/source pair');
  }
  const requestedStructuralEntry = typeof actionId === 'string'
    ? catalogAuthority.structuralEntries.get(actionId)
    : undefined;
  const partialStructuralActionable = catalogAuthority.program.status === 'partial'
    && (requestedStructuralEntry?.kind === 'delete-statement'
      || requestedStructuralEntry?.kind === 'insert-block');
  if (!isIssuedX4UiLayoutEvidencePair(catalogAuthority.program, catalogAuthority.evidenceAuthority)
    || (catalogAuthority.program.status !== 'projected' && !partialStructuralActionable)) {
    return structuralRefusal(workspace, source, catalog, 'unsupported-provenance', 'structural catalog layout authority is neither an issued projected pair nor an issued actionable partial deletion or frame block');
  }
  if (typeof actionId !== 'string'
    || !optionalStringPrimitive(directCall)
    || !optionalStringPrimitive(expectedPath)
    || !optionalOffsetPrimitive(expectedStartOffset)
    || !optionalOffsetPrimitive(expectedEndOffset)
    || !optionalStringPrimitive(expectedText)) {
    return structuralRefusal(workspace, source, catalog, 'invalid-request', 'structural action, payload, and optional expected CAS inputs must be positional primitives');
  }
  return applyX4UiSourceStructuralEditUnsafe(
    catalogAuthority,
    catalog,
    actionId,
    directCall,
    expectedPath,
    expectedStartOffset,
    expectedEndOffset,
    expectedText,
  );
}

export const applyX4UiSourceStructuralEditRequest = applyX4UiSourceStructuralEdit;
export const commitX4UiSourceStructuralEdit = applyX4UiSourceStructuralEdit;
