import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { TextDecoder, types as nodeUtilTypes } from 'node:util';

import { WORKSPACE_REGISTRY_MAX_BYTES } from '../lib/workspaceRegistry';
import { sanitizeWorkspace, type ModWorkspace } from '../types';

export const WORKSPACE_SNAPSHOT_SOURCE_MAX_BYTES = WORKSPACE_REGISTRY_MAX_BYTES + 1024 * 1024;

export type WorkspaceSnapshotSourceErrorCode =
  | 'WORKSPACE_SNAPSHOT_LOGICAL_IDENTITY_INVALID'
  | 'WORKSPACE_SNAPSHOT_MAX_BYTES_INVALID'
  | 'WORKSPACE_SNAPSHOT_TOO_LARGE'
  | 'WORKSPACE_SNAPSHOT_UTF8_INVALID'
  | 'WORKSPACE_SNAPSHOT_JSON_INVALID'
  | 'WORKSPACE_SNAPSHOT_ENVELOPE_INVALID'
  | 'WORKSPACE_SNAPSHOT_VALUE_UNSAFE'
  | 'WORKSPACE_SNAPSHOT_ROOT_INVALID'
  | 'WORKSPACE_SNAPSHOT_PATH_UNSAFE'
  | 'WORKSPACE_SNAPSHOT_NOT_FOUND'
  | 'WORKSPACE_SNAPSHOT_NOT_REGULAR'
  | 'WORKSPACE_SNAPSHOT_READ_FAILED'
  | 'WORKSPACE_SNAPSHOT_SOURCE_CHANGED';

const WORKSPACE_SNAPSHOT_SOURCE_ERROR_MESSAGES = {
  WORKSPACE_SNAPSHOT_LOGICAL_IDENTITY_INVALID: 'Workspace snapshot logical identity is invalid.',
  WORKSPACE_SNAPSHOT_MAX_BYTES_INVALID: 'Workspace snapshot maximum byte limit is invalid.',
  WORKSPACE_SNAPSHOT_TOO_LARGE: 'Workspace snapshot is too large.',
  WORKSPACE_SNAPSHOT_UTF8_INVALID: 'Workspace snapshot is not valid UTF-8.',
  WORKSPACE_SNAPSHOT_JSON_INVALID: 'Workspace snapshot JSON is invalid.',
  WORKSPACE_SNAPSHOT_ENVELOPE_INVALID: 'Workspace snapshot envelope is invalid.',
  WORKSPACE_SNAPSHOT_VALUE_UNSAFE: 'Workspace snapshot value is unsafe.',
  WORKSPACE_SNAPSHOT_ROOT_INVALID: 'Workspace snapshot root is invalid.',
  WORKSPACE_SNAPSHOT_PATH_UNSAFE: 'Workspace snapshot path is unsafe.',
  WORKSPACE_SNAPSHOT_NOT_FOUND: 'Workspace snapshot was not found.',
  WORKSPACE_SNAPSHOT_NOT_REGULAR: 'Workspace snapshot is not a regular file.',
  WORKSPACE_SNAPSHOT_READ_FAILED: 'Workspace snapshot could not be read.',
  WORKSPACE_SNAPSHOT_SOURCE_CHANGED: 'Workspace snapshot source changed while reading.',
} as const satisfies Record<WorkspaceSnapshotSourceErrorCode, string>;

export class WorkspaceSnapshotSourceError extends Error {
  readonly code: WorkspaceSnapshotSourceErrorCode;

  constructor(code: WorkspaceSnapshotSourceErrorCode = 'WORKSPACE_SNAPSHOT_LOGICAL_IDENTITY_INVALID') {
    super(WORKSPACE_SNAPSHOT_SOURCE_ERROR_MESSAGES[code]);
    this.name = 'WorkspaceSnapshotSourceError';
    this.code = code;
  }
}

export type WorkspaceSnapshotLogicalIdentity = {
  modId: string;
  snapshotName: string;
  snapshotIdentityHash: string;
};

export type WorkspaceSnapshotEnvelopeSource = {
  workspace: ModWorkspace;
  sourceHash: string;
  savedAt: string;
  name: string;
  snapshotModIdHash: string;
};

export interface WorkspaceSnapshotSourceStat {
  readonly dev: bigint;
  readonly ino: bigint;
  readonly mode: bigint;
  readonly size: bigint;
  readonly mtimeNs: bigint;
  readonly ctimeNs: bigint;
  readonly birthtimeNs?: bigint;
  isFile(): boolean;
  isDirectory(): boolean;
  isSymbolicLink(): boolean;
}

export interface WorkspaceSnapshotSourceIo {
  lstat(path: string): WorkspaceSnapshotSourceStat;
  realpath(path: string): string;
  open(path: string): number;
  fstat(fd: number): WorkspaceSnapshotSourceStat;
  read(fd: number): Uint8Array;
  close(fd: number): void;
}

export const NODE_WORKSPACE_SNAPSHOT_SOURCE_IO: WorkspaceSnapshotSourceIo = Object.freeze({
  lstat: (path: string) => fs.lstatSync(path, { bigint: true }),
  realpath: (path: string) => fs.realpathSync.native(path),
  open: (path: string) => fs.openSync(path, 'r'),
  fstat: (fd: number) => fs.fstatSync(fd, { bigint: true }),
  read: (fd: number) => fs.readFileSync(fd),
  close: (fd: number) => fs.closeSync(fd),
});

export type WorkspaceSnapshotFileSource = WorkspaceSnapshotEnvelopeSource & {
  snapshotIdentityHash: string;
};

const SNAPSHOT_NAME_PREFIX = 'snapshot_';
const SNAPSHOT_NAME_SUFFIX = '.json';

function refuseWorkspaceSnapshotSource(code: WorkspaceSnapshotSourceErrorCode): never {
  throw new WorkspaceSnapshotSourceError(code);
}

function refuseInvalidLogicalIdentity(): never {
  return refuseWorkspaceSnapshotSource('WORKSPACE_SNAPSHOT_LOGICAL_IDENTITY_INVALID');
}

function isAsciiAlphanumeric(code: number): boolean {
  return (
    (code >= 0x30 && code <= 0x39) ||
    (code >= 0x41 && code <= 0x5a) ||
    (code >= 0x61 && code <= 0x7a)
  );
}

function isSafeSegmentCharacter(code: number): boolean {
  return isAsciiAlphanumeric(code) || code === 0x2e || code === 0x2d || code === 0x5f;
}

function isSafeSegment(value: string, maxLength: number): boolean {
  if (value.length < 1 || value.length > maxLength || value === '.' || value === '..') {
    return false;
  }

  if (!isAsciiAlphanumeric(value.charCodeAt(0))) {
    return false;
  }

  for (let index = 1; index < value.length; index += 1) {
    if (!isSafeSegmentCharacter(value.charCodeAt(index))) {
      return false;
    }
  }

  return true;
}

function isSafeSnapshotBody(value: string): boolean {
  if (value.length < 1 || value === '.' || value === '..') {
    return false;
  }

  for (let index = 0; index < value.length; index += 1) {
    if (!isSafeSegmentCharacter(value.charCodeAt(index))) {
      return false;
    }
  }

  return true;
}

function isSnapshotName(value: string): boolean {
  if (
    !isSafeSegment(value, 255) ||
    !value.startsWith(SNAPSHOT_NAME_PREFIX) ||
    !value.endsWith(SNAPSHOT_NAME_SUFFIX)
  ) {
    return false;
  }

  const body = value.slice(SNAPSHOT_NAME_PREFIX.length, -SNAPSHOT_NAME_SUFFIX.length);
  return isSafeSnapshotBody(body);
}

function readOwnDataProperty(input: object, key: 'modId' | 'snapshotName'): unknown {
  const descriptor = Reflect.getOwnPropertyDescriptor(input, key);
  if (
    descriptor === undefined ||
    !Object.prototype.hasOwnProperty.call(descriptor, 'value') ||
    Object.prototype.hasOwnProperty.call(descriptor, 'get') ||
    Object.prototype.hasOwnProperty.call(descriptor, 'set')
  ) {
    return refuseInvalidLogicalIdentity();
  }

  return descriptor.value;
}

export function normalizeWorkspaceSnapshotLogicalIdentity(
  input: unknown,
): WorkspaceSnapshotLogicalIdentity {
  if (nodeUtilTypes.isProxy?.(input)) {
    return refuseInvalidLogicalIdentity();
  }

  if (input === null || typeof input !== 'object' || Object.getPrototypeOf(input) !== Object.prototype) {
    return refuseInvalidLogicalIdentity();
  }

  const ownKeys = Reflect.ownKeys(input);
  if (
    ownKeys.length !== 2 ||
    ownKeys.some((key) => typeof key !== 'string') ||
    !ownKeys.includes('modId') ||
    !ownKeys.includes('snapshotName')
  ) {
    return refuseInvalidLogicalIdentity();
  }

  const modId = readOwnDataProperty(input, 'modId');
  const snapshotName = readOwnDataProperty(input, 'snapshotName');
  if (
    typeof modId !== 'string' ||
    !isSafeSegment(modId, 128) ||
    typeof snapshotName !== 'string' ||
    !isSnapshotName(snapshotName)
  ) {
    return refuseInvalidLogicalIdentity();
  }

  const snapshotIdentityHash = createHash('sha256')
    .update(JSON.stringify({ modId, snapshotName }), 'utf8')
    .digest('hex');

  return { modId, snapshotName, snapshotIdentityHash };
}

function readOwnDataPropertyForCode(
  input: object,
  key: string,
  code: WorkspaceSnapshotSourceErrorCode,
): unknown {
  const descriptor = Reflect.getOwnPropertyDescriptor(input, key);
  if (
    descriptor === undefined ||
    !Object.prototype.hasOwnProperty.call(descriptor, 'value') ||
    Object.prototype.hasOwnProperty.call(descriptor, 'get') ||
    Object.prototype.hasOwnProperty.call(descriptor, 'set')
  ) {
    return refuseWorkspaceSnapshotSource(code);
  }

  return descriptor.value;
}

function readStrictPlainDataObject(
  input: unknown,
  requiredKeys: readonly string[] | undefined,
  code: WorkspaceSnapshotSourceErrorCode,
): Record<string, unknown> {
  if (nodeUtilTypes.isProxy?.(input)) {
    return refuseWorkspaceSnapshotSource(code);
  }

  if (input === null || typeof input !== 'object' || Object.getPrototypeOf(input) !== Object.prototype) {
    return refuseWorkspaceSnapshotSource(code);
  }

  const ownKeys = Reflect.ownKeys(input);
  if (ownKeys.some(key => typeof key !== 'string')) {
    return refuseWorkspaceSnapshotSource(code);
  }

  if (
    requiredKeys !== undefined &&
    (ownKeys.length !== requiredKeys.length || requiredKeys.some(key => !ownKeys.includes(key)))
  ) {
    return refuseWorkspaceSnapshotSource(code);
  }

  for (const key of ownKeys) {
    if (typeof key !== 'string') return refuseWorkspaceSnapshotSource(code);
    readOwnDataPropertyForCode(input, key, code);
  }

  return input as Record<string, unknown>;
}

function isSafeEnvelopeScalar(value: unknown, maxLength?: number): value is string {
  if (typeof value !== 'string' || value.length < 1 || (maxLength !== undefined && value.length > maxLength)) {
    return false;
  }

  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (
      code <= 0x1f ||
      code === 0x7f ||
      (code >= 0x80 && code <= 0x9f) ||
      code === 0x2028 ||
      code === 0x2029
    ) {
      return false;
    }

    if (code >= 0xd800 && code <= 0xdbff) {
      if (index + 1 >= value.length) return false;
      const nextCode = value.charCodeAt(index + 1);
      if (nextCode < 0xdc00 || nextCode > 0xdfff) {
        return false;
      }
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return false;
    }
  }

  return true;
}

function isCanonicalSavedAt(value: unknown): value is string {
  if (!isSafeEnvelopeScalar(value)) return false;

  try {
    return new Date(value).toISOString() === value;
  } catch {
    return false;
  }
}

function requireDeterministicWorkspaceIdentities(workspace: Record<string, unknown>): void {
  const workspaceId = readOwnDataPropertyForCode(
    workspace,
    'id',
    'WORKSPACE_SNAPSHOT_ENVELOPE_INVALID',
  );
  if (typeof workspaceId !== 'string' || workspaceId.length === 0) {
    return refuseWorkspaceSnapshotSource('WORKSPACE_SNAPSHOT_ENVELOPE_INVALID');
  }

  const nodesDescriptor = Reflect.getOwnPropertyDescriptor(workspace, 'nodes');
  if (nodesDescriptor === undefined) return;
  const nodes = readOwnDataPropertyForCode(
    workspace,
    'nodes',
    'WORKSPACE_SNAPSHOT_ENVELOPE_INVALID',
  );
  if (!Array.isArray(nodes)) return;

  for (const node of nodes) {
    if (node === null || typeof node !== 'object') continue;
    const nodeId = readOwnDataPropertyForCode(
      node,
      'id',
      'WORKSPACE_SNAPSHOT_ENVELOPE_INVALID',
    );
    if (typeof nodeId !== 'string' || nodeId.length === 0) {
      return refuseWorkspaceSnapshotSource('WORKSPACE_SNAPSHOT_ENVELOPE_INVALID');
    }
  }
}

function sha256Bytes(value: Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}

function sha256Utf8(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

const WORKSPACE_SNAPSHOT_ENVELOPE_KEYS = ['savedAt', 'name', 'modId', 'workspace'] as const;

export function decodeWorkspaceSnapshotEnvelope(
  bytes: Uint8Array,
  maxBytes?: number,
): WorkspaceSnapshotEnvelopeSource {
  try {
    if (nodeUtilTypes.isProxy?.(bytes) || !(bytes instanceof Uint8Array)) {
      return refuseWorkspaceSnapshotSource('WORKSPACE_SNAPSHOT_ENVELOPE_INVALID');
    }

    const effectiveMaxBytes = maxBytes === undefined ? WORKSPACE_SNAPSHOT_SOURCE_MAX_BYTES : maxBytes;
    if (
      !Number.isSafeInteger(effectiveMaxBytes) ||
      effectiveMaxBytes <= 0 ||
      effectiveMaxBytes > WORKSPACE_SNAPSHOT_SOURCE_MAX_BYTES
    ) {
      return refuseWorkspaceSnapshotSource('WORKSPACE_SNAPSHOT_MAX_BYTES_INVALID');
    }

    const copiedBytes = new Uint8Array(bytes);
    if (copiedBytes.byteLength > effectiveMaxBytes) {
      return refuseWorkspaceSnapshotSource('WORKSPACE_SNAPSHOT_TOO_LARGE');
    }

    let decoded: string;
    try {
      decoded = new TextDecoder('utf-8', { fatal: true }).decode(copiedBytes);
    } catch {
      return refuseWorkspaceSnapshotSource('WORKSPACE_SNAPSHOT_UTF8_INVALID');
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(decoded) as unknown;
    } catch {
      return refuseWorkspaceSnapshotSource('WORKSPACE_SNAPSHOT_JSON_INVALID');
    }

    const envelope = readStrictPlainDataObject(
      parsed,
      WORKSPACE_SNAPSHOT_ENVELOPE_KEYS,
      'WORKSPACE_SNAPSHOT_ENVELOPE_INVALID',
    );
    const savedAt = readOwnDataPropertyForCode(
      envelope,
      'savedAt',
      'WORKSPACE_SNAPSHOT_ENVELOPE_INVALID',
    );
    const name = readOwnDataPropertyForCode(
      envelope,
      'name',
      'WORKSPACE_SNAPSHOT_ENVELOPE_INVALID',
    );
    const modId = readOwnDataPropertyForCode(
      envelope,
      'modId',
      'WORKSPACE_SNAPSHOT_ENVELOPE_INVALID',
    );
    const workspaceValue = readOwnDataPropertyForCode(
      envelope,
      'workspace',
      'WORKSPACE_SNAPSHOT_ENVELOPE_INVALID',
    );

    if (!isCanonicalSavedAt(savedAt) || !isSafeEnvelopeScalar(name, 256) || !isSafeEnvelopeScalar(modId, 128)) {
      return refuseWorkspaceSnapshotSource('WORKSPACE_SNAPSHOT_VALUE_UNSAFE');
    }

    const workspaceInput = readStrictPlainDataObject(
      workspaceValue,
      undefined,
      'WORKSPACE_SNAPSHOT_ENVELOPE_INVALID',
    );
    requireDeterministicWorkspaceIdentities(workspaceInput);
    let workspace: ModWorkspace;
    try {
      workspace = sanitizeWorkspace(workspaceInput);
    } catch {
      return refuseWorkspaceSnapshotSource('WORKSPACE_SNAPSHOT_ENVELOPE_INVALID');
    }

    return {
      workspace,
      sourceHash: sha256Bytes(copiedBytes),
      savedAt,
      name,
      snapshotModIdHash: sha256Utf8(modId),
    };
  } catch (error) {
    if (error instanceof WorkspaceSnapshotSourceError) throw error;
    return refuseWorkspaceSnapshotSource('WORKSPACE_SNAPSHOT_ENVELOPE_INVALID');
  }
}

type WorkspaceSnapshotReadInput = {
  rootAbs: string;
  identity: WorkspaceSnapshotLogicalIdentity;
  maxBytes: number | undefined;
};

function normalizePathForComparison(value: string): string {
  const resolved = path.resolve(value);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function isStrictDescendant(child: string, root: string): boolean {
  const relative = path.relative(root, child);
  return relative.length > 0
    && relative !== '..'
    && !relative.startsWith('../')
    && !relative.startsWith('..\\')
    && !path.isAbsolute(relative);
}

function sameWorkspaceSnapshotStat(
  left: WorkspaceSnapshotSourceStat,
  right: WorkspaceSnapshotSourceStat,
): boolean {
  const birthtimeMatches = left.birthtimeNs === undefined && right.birthtimeNs === undefined
    || left.birthtimeNs !== undefined
      && right.birthtimeNs !== undefined
      && left.birthtimeNs === right.birthtimeNs;
  return left.dev === right.dev
    && left.ino === right.ino
    && left.mode === right.mode
    && left.size === right.size
    && left.mtimeNs === right.mtimeNs
    && left.ctimeNs === right.ctimeNs
    && birthtimeMatches;
}

function normalizeWorkspaceSnapshotReadInput(input: unknown): WorkspaceSnapshotReadInput {
  const source = readStrictPlainDataObject(
    input,
    undefined,
    'WORKSPACE_SNAPSHOT_ROOT_INVALID',
  );
  const allowedKeys = ['root', 'modId', 'snapshotName', 'maxBytes'] as const;
  const ownKeys = Reflect.ownKeys(source);
  if (
    ownKeys.length < 3 ||
    ownKeys.length > allowedKeys.length ||
    ownKeys.some(key => typeof key !== 'string' || !allowedKeys.includes(key as typeof allowedKeys[number]))
  ) {
    return refuseWorkspaceSnapshotSource('WORKSPACE_SNAPSHOT_ROOT_INVALID');
  }

  const hasOwnKey = (key: string): boolean => ownKeys.includes(key);
  if (!hasOwnKey('root')) return refuseWorkspaceSnapshotSource('WORKSPACE_SNAPSHOT_ROOT_INVALID');
  if (!hasOwnKey('modId')) {
    return refuseWorkspaceSnapshotSource('WORKSPACE_SNAPSHOT_LOGICAL_IDENTITY_INVALID');
  }
  if (!hasOwnKey('snapshotName')) {
    return refuseWorkspaceSnapshotSource('WORKSPACE_SNAPSHOT_LOGICAL_IDENTITY_INVALID');
  }

  const root = readOwnDataPropertyForCode(
    source,
    'root',
    'WORKSPACE_SNAPSHOT_ROOT_INVALID',
  );
  if (!isSafeEnvelopeScalar(root, 32767) || !path.isAbsolute(root)) {
    return refuseWorkspaceSnapshotSource('WORKSPACE_SNAPSHOT_ROOT_INVALID');
  }

  const modId = readOwnDataPropertyForCode(
    source,
    'modId',
    'WORKSPACE_SNAPSHOT_LOGICAL_IDENTITY_INVALID',
  );
  const snapshotName = readOwnDataPropertyForCode(
    source,
    'snapshotName',
    'WORKSPACE_SNAPSHOT_LOGICAL_IDENTITY_INVALID',
  );
  const identity = normalizeWorkspaceSnapshotLogicalIdentity({ modId, snapshotName });

  let maxBytes: number | undefined;
  if (hasOwnKey('maxBytes')) {
    const value = readOwnDataPropertyForCode(
      source,
      'maxBytes',
      'WORKSPACE_SNAPSHOT_MAX_BYTES_INVALID',
    );
    if (value !== undefined) {
      if (
        typeof value !== 'number' ||
        !Number.isSafeInteger(value) ||
        value < 1 ||
        value > WORKSPACE_SNAPSHOT_SOURCE_MAX_BYTES
      ) {
        return refuseWorkspaceSnapshotSource('WORKSPACE_SNAPSHOT_MAX_BYTES_INVALID');
      }
      maxBytes = value;
    }
  }

  return {
    rootAbs: normalizePathForComparison(root),
    identity,
    maxBytes,
  };
}

const WORKSPACE_SNAPSHOT_SOURCE_IO_KEYS = [
  'lstat',
  'realpath',
  'open',
  'fstat',
  'read',
  'close',
] as const;

function preserveWorkspaceSnapshotSourceError(
  error: unknown,
  code: WorkspaceSnapshotSourceErrorCode,
): never {
  if (error instanceof WorkspaceSnapshotSourceError) throw error;
  return refuseWorkspaceSnapshotSource(code);
}

function hasWorkspaceSnapshotErrorCode(error: unknown, expectedCode: string): boolean {
  try {
    if (
      error === null ||
      (typeof error !== 'object' && typeof error !== 'function') ||
      nodeUtilTypes.isProxy?.(error)
    ) {
      return false;
    }

    let current: object | null = error;
    while (current !== null) {
      if (nodeUtilTypes.isProxy?.(current)) return false;
      const descriptor = Reflect.getOwnPropertyDescriptor(current, 'code');
      if (descriptor !== undefined) {
        return (
          Object.prototype.hasOwnProperty.call(descriptor, 'value') &&
          !Object.prototype.hasOwnProperty.call(descriptor, 'get') &&
          !Object.prototype.hasOwnProperty.call(descriptor, 'set') &&
          descriptor.value === expectedCode
        );
      }
      current = Object.getPrototypeOf(current);
    }
  } catch {
    return false;
  }

  return false;
}

function normalizeWorkspaceSnapshotSourceIo(input: WorkspaceSnapshotSourceIo | undefined): WorkspaceSnapshotSourceIo {
  const candidate = input === undefined ? NODE_WORKSPACE_SNAPSHOT_SOURCE_IO : input;
  const source = readStrictPlainDataObject(
    candidate,
    WORKSPACE_SNAPSHOT_SOURCE_IO_KEYS,
    'WORKSPACE_SNAPSHOT_READ_FAILED',
  );
  const lstat = readOwnDataPropertyForCode(source, 'lstat', 'WORKSPACE_SNAPSHOT_READ_FAILED');
  const realpath = readOwnDataPropertyForCode(source, 'realpath', 'WORKSPACE_SNAPSHOT_READ_FAILED');
  const open = readOwnDataPropertyForCode(source, 'open', 'WORKSPACE_SNAPSHOT_READ_FAILED');
  const fstat = readOwnDataPropertyForCode(source, 'fstat', 'WORKSPACE_SNAPSHOT_READ_FAILED');
  const read = readOwnDataPropertyForCode(source, 'read', 'WORKSPACE_SNAPSHOT_READ_FAILED');
  const close = readOwnDataPropertyForCode(source, 'close', 'WORKSPACE_SNAPSHOT_READ_FAILED');
  const methods = [lstat, realpath, open, fstat, read, close];
  if (methods.some((method) => typeof method !== 'function' || nodeUtilTypes.isProxy?.(method))) {
    return refuseWorkspaceSnapshotSource('WORKSPACE_SNAPSHOT_READ_FAILED');
  }

  const lstatMethod = lstat as (value: string) => WorkspaceSnapshotSourceStat;
  const realpathMethod = realpath as (value: string) => string;
  const openMethod = open as (value: string) => number;
  const fstatMethod = fstat as (value: number) => WorkspaceSnapshotSourceStat;
  const readMethod = read as (value: number) => Uint8Array;
  const closeMethod = close as (value: number) => void;

  return {
    lstat: (value) => Reflect.apply(lstatMethod, source, [value]),
    realpath: (value) => Reflect.apply(realpathMethod, source, [value]),
    open: (value) => Reflect.apply(openMethod, source, [value]),
    fstat: (value) => Reflect.apply(fstatMethod, source, [value]),
    read: (value) => Reflect.apply(readMethod, source, [value]),
    close: (value) => Reflect.apply(closeMethod, source, [value]),
  };
}

type WorkspaceSnapshotSourceDataProperty = {
  found: boolean;
  value: unknown;
};

function readWorkspaceSnapshotSourceDataProperty(
  input: object,
  key: string,
): WorkspaceSnapshotSourceDataProperty | undefined {
  try {
    let current: object | null = input;
    while (current !== null) {
      if (nodeUtilTypes.isProxy?.(current)) return undefined;
      const descriptor = Reflect.getOwnPropertyDescriptor(current, key);
      if (descriptor !== undefined) {
        if (
          !Object.prototype.hasOwnProperty.call(descriptor, 'value') ||
          Object.prototype.hasOwnProperty.call(descriptor, 'get') ||
          Object.prototype.hasOwnProperty.call(descriptor, 'set')
        ) {
          return undefined;
        }
        return { found: true, value: descriptor.value };
      }
      current = Object.getPrototypeOf(current);
    }
  } catch {
    return undefined;
  }

  return { found: false, value: undefined };
}

function captureWorkspaceSnapshotStat(input: unknown): WorkspaceSnapshotSourceStat | undefined {
  try {
    if (
      input === null ||
      typeof input !== 'object' ||
      nodeUtilTypes.isProxy?.(input)
    ) {
      return undefined;
    }

    const dev = readWorkspaceSnapshotSourceDataProperty(input, 'dev');
    const ino = readWorkspaceSnapshotSourceDataProperty(input, 'ino');
    const mode = readWorkspaceSnapshotSourceDataProperty(input, 'mode');
    const size = readWorkspaceSnapshotSourceDataProperty(input, 'size');
    const mtimeNs = readWorkspaceSnapshotSourceDataProperty(input, 'mtimeNs');
    const ctimeNs = readWorkspaceSnapshotSourceDataProperty(input, 'ctimeNs');
    const birthtimeNs = readWorkspaceSnapshotSourceDataProperty(input, 'birthtimeNs');
    const isFile = readWorkspaceSnapshotSourceDataProperty(input, 'isFile');
    const isDirectory = readWorkspaceSnapshotSourceDataProperty(input, 'isDirectory');
    const isSymbolicLink = readWorkspaceSnapshotSourceDataProperty(input, 'isSymbolicLink');

    if (
      dev === undefined || !dev.found || typeof dev.value !== 'bigint' ||
      ino === undefined || !ino.found || typeof ino.value !== 'bigint' ||
      mode === undefined || !mode.found || typeof mode.value !== 'bigint' ||
      size === undefined || !size.found || typeof size.value !== 'bigint' || size.value < 0n ||
      mtimeNs === undefined || !mtimeNs.found || typeof mtimeNs.value !== 'bigint' ||
      ctimeNs === undefined || !ctimeNs.found || typeof ctimeNs.value !== 'bigint' ||
      birthtimeNs === undefined ||
      (birthtimeNs.found && birthtimeNs.value !== undefined && typeof birthtimeNs.value !== 'bigint') ||
      isFile === undefined || !isFile.found || typeof isFile.value !== 'function' ||
      isDirectory === undefined || !isDirectory.found || typeof isDirectory.value !== 'function' ||
      isSymbolicLink === undefined || !isSymbolicLink.found || typeof isSymbolicLink.value !== 'function' ||
      nodeUtilTypes.isProxy?.(isFile.value) ||
      nodeUtilTypes.isProxy?.(isDirectory.value) ||
      nodeUtilTypes.isProxy?.(isSymbolicLink.value)
    ) {
      return undefined;
    }

    const isFileMethod = isFile.value as (...args: unknown[]) => unknown;
    const isDirectoryMethod = isDirectory.value as (...args: unknown[]) => unknown;
    const isSymbolicLinkMethod = isSymbolicLink.value as (...args: unknown[]) => unknown;
    const invokePredicate = (method: (...args: unknown[]) => unknown): boolean => {
      const result = Reflect.apply(method, input, []);
      if (typeof result !== 'boolean') throw new TypeError();
      return result;
    };

    return {
      dev: dev.value as bigint,
      ino: ino.value as bigint,
      mode: mode.value as bigint,
      size: size.value as bigint,
      mtimeNs: mtimeNs.value as bigint,
      ctimeNs: ctimeNs.value as bigint,
      birthtimeNs: birthtimeNs.value as bigint | undefined,
      isFile: () => invokePredicate(isFileMethod),
      isDirectory: () => invokePredicate(isDirectoryMethod),
      isSymbolicLink: () => invokePredicate(isSymbolicLinkMethod),
    };
  } catch {
    return undefined;
  }
}

function isSameNormalizedWorkspaceSnapshotPath(left: string, right: string): boolean {
  try {
    return path.isAbsolute(left) && path.isAbsolute(right)
      && normalizePathForComparison(left) === normalizePathForComparison(right);
  } catch {
    return false;
  }
}

function isContainedWorkspaceSnapshotPath(
  actual: string,
  expected: string,
  parent: string,
): boolean {
  try {
    if (!path.isAbsolute(actual) || !path.isAbsolute(expected) || !path.isAbsolute(parent)) {
      return false;
    }
    const normalizedActual = normalizePathForComparison(actual);
    const normalizedExpected = normalizePathForComparison(expected);
    const normalizedParent = normalizePathForComparison(parent);
    return normalizedActual === normalizedExpected
      && isStrictDescendant(normalizedActual, normalizedParent);
  } catch {
    return false;
  }
}

function lstatWorkspaceSnapshotPath(
  io: WorkspaceSnapshotSourceIo,
  value: string,
  missingIsNotFound: boolean,
  faultCode: WorkspaceSnapshotSourceErrorCode,
): WorkspaceSnapshotSourceStat {
  try {
    const stat = captureWorkspaceSnapshotStat(io.lstat(value));
    if (stat === undefined) return refuseWorkspaceSnapshotSource(faultCode);
    return stat;
  } catch (error) {
    if (error instanceof WorkspaceSnapshotSourceError) throw error;
    if (missingIsNotFound && hasWorkspaceSnapshotErrorCode(error, 'ENOENT')) {
      return refuseWorkspaceSnapshotSource('WORKSPACE_SNAPSHOT_NOT_FOUND');
    }
    return preserveWorkspaceSnapshotSourceError(error, faultCode);
  }
}

function realpathWorkspaceSnapshotPath(
  io: WorkspaceSnapshotSourceIo,
  value: string,
  missingIsNotFound: boolean,
  faultCode: WorkspaceSnapshotSourceErrorCode,
): string {
  try {
    const realpath = io.realpath(value);
    if (typeof realpath !== 'string' || !path.isAbsolute(realpath)) {
      return refuseWorkspaceSnapshotSource(faultCode);
    }
    return realpath;
  } catch (error) {
    if (error instanceof WorkspaceSnapshotSourceError) throw error;
    if (missingIsNotFound && hasWorkspaceSnapshotErrorCode(error, 'ENOENT')) {
      return refuseWorkspaceSnapshotSource('WORKSPACE_SNAPSHOT_NOT_FOUND');
    }
    return preserveWorkspaceSnapshotSourceError(error, faultCode);
  }
}

function resolveWorkspaceSnapshotPath(parent: string, segment: string): string {
  try {
    const candidate = path.resolve(parent, segment);
    if (!isStrictDescendant(candidate, parent)) {
      return refuseWorkspaceSnapshotSource('WORKSPACE_SNAPSHOT_PATH_UNSAFE');
    }
    return candidate;
  } catch (error) {
    return preserveWorkspaceSnapshotSourceError(error, 'WORKSPACE_SNAPSHOT_PATH_UNSAFE');
  }
}

export function readWorkspaceSnapshotSource(
  input: unknown,
  io?: WorkspaceSnapshotSourceIo,
): WorkspaceSnapshotFileSource {
  let normalizedInput: WorkspaceSnapshotReadInput;
  try {
    normalizedInput = normalizeWorkspaceSnapshotReadInput(input);
  } catch (error) {
    return preserveWorkspaceSnapshotSourceError(error, 'WORKSPACE_SNAPSHOT_ROOT_INVALID');
  }

  let sourceIo: WorkspaceSnapshotSourceIo;
  try {
    sourceIo = normalizeWorkspaceSnapshotSourceIo(io);
  } catch (error) {
    return preserveWorkspaceSnapshotSourceError(error, 'WORKSPACE_SNAPSHOT_READ_FAILED');
  }

  const effectiveMaxBytes = normalizedInput.maxBytes ?? WORKSPACE_SNAPSHOT_SOURCE_MAX_BYTES;
  const { rootAbs, identity } = normalizedInput;
  const rootStat = lstatWorkspaceSnapshotPath(
    sourceIo,
    rootAbs,
    false,
    'WORKSPACE_SNAPSHOT_ROOT_INVALID',
  );
  try {
    if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) {
      return refuseWorkspaceSnapshotSource('WORKSPACE_SNAPSHOT_ROOT_INVALID');
    }
  } catch (error) {
    return preserveWorkspaceSnapshotSourceError(error, 'WORKSPACE_SNAPSHOT_ROOT_INVALID');
  }

  const rootRealpath = realpathWorkspaceSnapshotPath(
    sourceIo,
    rootAbs,
    false,
    'WORKSPACE_SNAPSHOT_ROOT_INVALID',
  );
  if (!isSameNormalizedWorkspaceSnapshotPath(rootRealpath, rootAbs)) {
    return refuseWorkspaceSnapshotSource('WORKSPACE_SNAPSHOT_ROOT_INVALID');
  }

  const modPath = resolveWorkspaceSnapshotPath(rootAbs, identity.modId);
  const snapshotsPath = resolveWorkspaceSnapshotPath(modPath, '.snapshots');
  const targetPath = resolveWorkspaceSnapshotPath(snapshotsPath, identity.snapshotName);
  if (!isStrictDescendant(snapshotsPath, rootAbs) || !isStrictDescendant(targetPath, rootAbs)) {
    return refuseWorkspaceSnapshotSource('WORKSPACE_SNAPSHOT_PATH_UNSAFE');
  }

  const modStat = lstatWorkspaceSnapshotPath(
    sourceIo,
    modPath,
    true,
    'WORKSPACE_SNAPSHOT_READ_FAILED',
  );
  try {
    if (modStat.isSymbolicLink() || !modStat.isDirectory()) {
      return refuseWorkspaceSnapshotSource('WORKSPACE_SNAPSHOT_PATH_UNSAFE');
    }
  } catch (error) {
    return preserveWorkspaceSnapshotSourceError(error, 'WORKSPACE_SNAPSHOT_READ_FAILED');
  }
  const modRealpath = realpathWorkspaceSnapshotPath(
    sourceIo,
    modPath,
    true,
    'WORKSPACE_SNAPSHOT_READ_FAILED',
  );
  if (!isContainedWorkspaceSnapshotPath(modRealpath, modPath, rootAbs)) {
    return refuseWorkspaceSnapshotSource('WORKSPACE_SNAPSHOT_PATH_UNSAFE');
  }

  const snapshotsStat = lstatWorkspaceSnapshotPath(
    sourceIo,
    snapshotsPath,
    true,
    'WORKSPACE_SNAPSHOT_READ_FAILED',
  );
  try {
    if (snapshotsStat.isSymbolicLink() || !snapshotsStat.isDirectory()) {
      return refuseWorkspaceSnapshotSource('WORKSPACE_SNAPSHOT_PATH_UNSAFE');
    }
  } catch (error) {
    return preserveWorkspaceSnapshotSourceError(error, 'WORKSPACE_SNAPSHOT_READ_FAILED');
  }
  const snapshotsRealpath = realpathWorkspaceSnapshotPath(
    sourceIo,
    snapshotsPath,
    true,
    'WORKSPACE_SNAPSHOT_READ_FAILED',
  );
  if (
    !isContainedWorkspaceSnapshotPath(snapshotsRealpath, snapshotsPath, rootAbs) ||
    !isStrictDescendant(normalizePathForComparison(snapshotsRealpath), normalizePathForComparison(modRealpath))
  ) {
    return refuseWorkspaceSnapshotSource('WORKSPACE_SNAPSHOT_PATH_UNSAFE');
  }

  const targetStat = lstatWorkspaceSnapshotPath(
    sourceIo,
    targetPath,
    true,
    'WORKSPACE_SNAPSHOT_READ_FAILED',
  );
  try {
    if (targetStat.isSymbolicLink()) {
      return refuseWorkspaceSnapshotSource('WORKSPACE_SNAPSHOT_PATH_UNSAFE');
    }
    if (!targetStat.isFile()) {
      return refuseWorkspaceSnapshotSource('WORKSPACE_SNAPSHOT_NOT_REGULAR');
    }
  } catch (error) {
    return preserveWorkspaceSnapshotSourceError(error, 'WORKSPACE_SNAPSHOT_READ_FAILED');
  }
  const targetRealpath = realpathWorkspaceSnapshotPath(
    sourceIo,
    targetPath,
    true,
    'WORKSPACE_SNAPSHOT_READ_FAILED',
  );
  if (
    !isContainedWorkspaceSnapshotPath(targetRealpath, targetPath, rootAbs) ||
    !isStrictDescendant(normalizePathForComparison(targetRealpath), normalizePathForComparison(snapshotsRealpath))
  ) {
    return refuseWorkspaceSnapshotSource('WORKSPACE_SNAPSHOT_PATH_UNSAFE');
  }
  if (targetStat.size > BigInt(effectiveMaxBytes)) {
    return refuseWorkspaceSnapshotSource('WORKSPACE_SNAPSHOT_TOO_LARGE');
  }

  let fileDescriptor: number;
  try {
    const opened = sourceIo.open(targetPath);
    if (!Number.isSafeInteger(opened) || opened < 0) {
      return refuseWorkspaceSnapshotSource('WORKSPACE_SNAPSHOT_READ_FAILED');
    }
    fileDescriptor = opened;
  } catch (error) {
    return preserveWorkspaceSnapshotSourceError(error, 'WORKSPACE_SNAPSHOT_READ_FAILED');
  }

  let copiedBytes: Uint8Array | undefined;
  let actualBytesTooLarge = false;
  let readPhaseError: WorkspaceSnapshotSourceError | undefined;
  try {
    const openedStat = captureWorkspaceSnapshotStat(sourceIo.fstat(fileDescriptor));
    if (openedStat === undefined) {
      return refuseWorkspaceSnapshotSource('WORKSPACE_SNAPSHOT_READ_FAILED');
    }
    if (openedStat.isSymbolicLink() || !openedStat.isFile()) {
      return refuseWorkspaceSnapshotSource('WORKSPACE_SNAPSHOT_SOURCE_CHANGED');
    }
    if (!sameWorkspaceSnapshotStat(targetStat, openedStat)) {
      return refuseWorkspaceSnapshotSource('WORKSPACE_SNAPSHOT_SOURCE_CHANGED');
    }

    const bytes = sourceIo.read(fileDescriptor);
    if (nodeUtilTypes.isProxy?.(bytes) || !(bytes instanceof Uint8Array)) {
      return refuseWorkspaceSnapshotSource('WORKSPACE_SNAPSHOT_READ_FAILED');
    }
    // A read length mismatch is an IO failure: opened fstat.size is authoritative,
    // so neither truncated nor overlong data may reach the envelope decoder.
    if (BigInt(bytes.byteLength) !== openedStat.size) {
      return refuseWorkspaceSnapshotSource('WORKSPACE_SNAPSHOT_READ_FAILED');
    }
    if (bytes.byteLength > effectiveMaxBytes) {
      actualBytesTooLarge = true;
    } else {
      copiedBytes = new Uint8Array(bytes);
    }
  } catch (error) {
    readPhaseError = error instanceof WorkspaceSnapshotSourceError
      ? error
      : new WorkspaceSnapshotSourceError('WORKSPACE_SNAPSHOT_READ_FAILED');
  } finally {
    try {
      sourceIo.close(fileDescriptor);
    } catch (error) {
      if (readPhaseError === undefined) {
        readPhaseError = error instanceof WorkspaceSnapshotSourceError
          ? error
          : new WorkspaceSnapshotSourceError('WORKSPACE_SNAPSHOT_READ_FAILED');
      }
    }
  }
  if (readPhaseError !== undefined) throw readPhaseError;

  const finalStat = lstatWorkspaceSnapshotPath(
    sourceIo,
    targetPath,
    false,
    'WORKSPACE_SNAPSHOT_SOURCE_CHANGED',
  );
  try {
    if (finalStat.isSymbolicLink() || !finalStat.isFile()) {
      return refuseWorkspaceSnapshotSource('WORKSPACE_SNAPSHOT_SOURCE_CHANGED');
    }
  } catch (error) {
    return preserveWorkspaceSnapshotSourceError(error, 'WORKSPACE_SNAPSHOT_SOURCE_CHANGED');
  }
  const finalRealpath = realpathWorkspaceSnapshotPath(
    sourceIo,
    targetPath,
    false,
    'WORKSPACE_SNAPSHOT_SOURCE_CHANGED',
  );
  if (
    !isContainedWorkspaceSnapshotPath(finalRealpath, targetPath, rootAbs) ||
    !isStrictDescendant(normalizePathForComparison(finalRealpath), normalizePathForComparison(snapshotsRealpath)) ||
    !sameWorkspaceSnapshotStat(targetStat, finalStat)
  ) {
    return refuseWorkspaceSnapshotSource('WORKSPACE_SNAPSHOT_SOURCE_CHANGED');
  }
  if (actualBytesTooLarge) {
    return refuseWorkspaceSnapshotSource('WORKSPACE_SNAPSHOT_TOO_LARGE');
  }
  if (copiedBytes === undefined) {
    return refuseWorkspaceSnapshotSource('WORKSPACE_SNAPSHOT_READ_FAILED');
  }

  let envelope: WorkspaceSnapshotEnvelopeSource;
  try {
    envelope = decodeWorkspaceSnapshotEnvelope(copiedBytes, effectiveMaxBytes);
  } catch (error) {
    return preserveWorkspaceSnapshotSourceError(error, 'WORKSPACE_SNAPSHOT_ENVELOPE_INVALID');
  }

  return {
    workspace: envelope.workspace,
    sourceHash: envelope.sourceHash,
    savedAt: envelope.savedAt,
    name: envelope.name,
    snapshotModIdHash: envelope.snapshotModIdHash,
    snapshotIdentityHash: identity.snapshotIdentityHash,
  };
}
