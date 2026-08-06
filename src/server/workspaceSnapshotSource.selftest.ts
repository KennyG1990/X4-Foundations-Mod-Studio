import { createHash } from 'node:crypto';
import path from 'node:path';
import { TextEncoder } from 'node:util';

import { WORKSPACE_REGISTRY_MAX_BYTES } from '../lib/workspaceRegistry';
import {
  WORKSPACE_SNAPSHOT_SOURCE_MAX_BYTES,
  WorkspaceSnapshotSourceError,
  decodeWorkspaceSnapshotEnvelope,
  normalizeWorkspaceSnapshotLogicalIdentity,
  readWorkspaceSnapshotSource,
  type WorkspaceSnapshotSourceIo,
  type WorkspaceSnapshotSourceStat,
} from './workspaceSnapshotSource';

const FIXED_ERROR_CODE = 'WORKSPACE_SNAPSHOT_LOGICAL_IDENTITY_INVALID';
const FIXED_ERROR_MESSAGE = 'Workspace snapshot logical identity is invalid.';
const RAW_MARKER = 'raw-workspace-snapshot-selftest-marker-7d31c4';
const RAW_PATH_MARKER = 'C:\\raw\\workspace\\snapshot-selftest-path';
const RAW_BYTES_MARKER = 'raw-envelope-bytes-selftest-marker-2c61e8';
const DECODE_ERROR_MESSAGES = {
  WORKSPACE_SNAPSHOT_ENVELOPE_INVALID: 'Workspace snapshot envelope is invalid.',
  WORKSPACE_SNAPSHOT_MAX_BYTES_INVALID: 'Workspace snapshot maximum byte limit is invalid.',
  WORKSPACE_SNAPSHOT_TOO_LARGE: 'Workspace snapshot is too large.',
  WORKSPACE_SNAPSHOT_UTF8_INVALID: 'Workspace snapshot is not valid UTF-8.',
  WORKSPACE_SNAPSHOT_JSON_INVALID: 'Workspace snapshot JSON is invalid.',
  WORKSPACE_SNAPSHOT_VALUE_UNSAFE: 'Workspace snapshot value is unsafe.',
} as const;

const READER_ERROR_MESSAGES = {
  WORKSPACE_SNAPSHOT_LOGICAL_IDENTITY_INVALID: 'Workspace snapshot logical identity is invalid.',
  WORKSPACE_SNAPSHOT_MAX_BYTES_INVALID: 'Workspace snapshot maximum byte limit is invalid.',
  WORKSPACE_SNAPSHOT_ROOT_INVALID: 'Workspace snapshot root is invalid.',
  WORKSPACE_SNAPSHOT_PATH_UNSAFE: 'Workspace snapshot path is unsafe.',
  WORKSPACE_SNAPSHOT_NOT_FOUND: 'Workspace snapshot was not found.',
  WORKSPACE_SNAPSHOT_NOT_REGULAR: 'Workspace snapshot is not a regular file.',
  WORKSPACE_SNAPSHOT_READ_FAILED: 'Workspace snapshot could not be read.',
  WORKSPACE_SNAPSHOT_SOURCE_CHANGED: 'Workspace snapshot source changed while reading.',
  WORKSPACE_SNAPSHOT_TOO_LARGE: 'Workspace snapshot is too large.',
  WORKSPACE_SNAPSHOT_ENVELOPE_INVALID: 'Workspace snapshot envelope is invalid.',
  WORKSPACE_SNAPSHOT_UTF8_INVALID: 'Workspace snapshot is not valid UTF-8.',
  WORKSPACE_SNAPSHOT_JSON_INVALID: 'Workspace snapshot JSON is invalid.',
  WORKSPACE_SNAPSHOT_VALUE_UNSAFE: 'Workspace snapshot value is unsafe.',
} as const;

const ENVELOPE_SAVED_AT = '2026-08-06T12:34:56.000Z';
const ENVELOPE_NAME = 'Snapshot α🚀';
const ENVELOPE_MOD_ID = 'mod.alpha_1-beta';

function envelopeWorkspace(): Record<string, unknown> {
  return {
    id: 'workspace_snapshot_selftest',
    name: 'Decoded Workspace',
    version: '1.0.0',
    author: 'Snapshot Selftest',
    description: 'Deterministic envelope fixture',
    nodes: [null],
    links: [],
    uiWidgets: [],
    uiTheme: {
      backgroundColor: '#101820',
      borderColor: '#204060',
      accentColor: '#40a0c0',
      opacity: 'not-a-number',
      showIcons: true,
    },
    templates: [],
  };
}

function deterministicNodeWorkspace(): Record<string, unknown> {
  return {
    ...envelopeWorkspace(),
    nodes: [{
      id: 'node_deterministic_snapshot',
      type: 'action',
      xmlTag: 'debug_text',
      label: 'Deterministic Snapshot Node',
      x: 120,
      y: 240,
      properties: { text: 'stable snapshot node' },
      propertiesSchema: [],
      inputs: [],
      outputs: [],
      includeInBuild: true,
    }],
  };
}

function envelopeFixture(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    savedAt: ENVELOPE_SAVED_AT,
    name: ENVELOPE_NAME,
    modId: ENVELOPE_MOD_ID,
    workspace: envelopeWorkspace(),
    ...overrides,
  };
}

function withoutEnvelopeKey(key: 'savedAt' | 'name' | 'modId' | 'workspace'): Record<string, unknown> {
  const envelope = envelopeFixture();
  Reflect.deleteProperty(envelope, key);
  return envelope;
}

function encodeJson(value: unknown): Uint8Array {
  const json = JSON.stringify(value);
  if (json === undefined) throw new Error('selftest JSON fixture unavailable');
  return new TextEncoder().encode(json);
}

function validEnvelopeBytes(overrides: Record<string, unknown> = {}): Uint8Array {
  return encodeJson(envelopeFixture(overrides));
}

interface WorkspaceSnapshotSourceSelftestCheck {
  name: string;
  pass: boolean;
}

interface WorkspaceSnapshotSourceSelftestResult {
  pass: boolean;
  allPassed: boolean;
  passed: number;
  total: number;
  checks: WorkspaceSnapshotSourceSelftestCheck[];
}

function check(name: string, assertion: () => boolean): WorkspaceSnapshotSourceSelftestCheck {
  try {
    return { name, pass: assertion() };
  } catch {
    return { name, pass: false };
  }
}

function summarize(checks: WorkspaceSnapshotSourceSelftestCheck[]): WorkspaceSnapshotSourceSelftestResult {
  const passed = checks.filter(item => item.pass).length;
  const allPassed = passed === checks.length;
  return {
    pass: allPassed,
    allPassed,
    passed,
    total: checks.length,
    checks,
  };
}

function exactSourceRefusal(
  expectedCode: string,
  expectedMessage: string,
  invoke: () => unknown,
  rawValues: readonly string[] = [],
): boolean {
  try {
    invoke();
    return false;
  } catch (error) {
    if (!(error instanceof WorkspaceSnapshotSourceError)) return false;
    const exposed = [
      error.name,
      error.code,
      error.message,
      error.stack ?? '',
      JSON.stringify(error) ?? '',
    ].join('|');
    return error.constructor === WorkspaceSnapshotSourceError
      && error.name === 'WorkspaceSnapshotSourceError'
      && error.code === expectedCode
      && error.message === expectedMessage
      && rawValues.every(value => value.length === 0 || !exposed.includes(value));
  }
}

function exactRefusal(invoke: () => unknown, rawValues: readonly string[] = []): boolean {
  return exactSourceRefusal(FIXED_ERROR_CODE, FIXED_ERROR_MESSAGE, invoke, rawValues);
}

function exactDecodeRefusal(
  code: keyof typeof DECODE_ERROR_MESSAGES,
  invoke: () => unknown,
  rawValues: readonly string[] = [],
): boolean {
  return exactSourceRefusal(code, DECODE_ERROR_MESSAGES[code], invoke, rawValues);
}

function exactReaderRefusal(
  code: keyof typeof READER_ERROR_MESSAGES,
  invoke: () => unknown,
  rawValues: readonly string[] = [],
): boolean {
  return exactSourceRefusal(code, READER_ERROR_MESSAGES[code], invoke, rawValues);
}

function expectedHash(material: string): string {
  return createHash('sha256').update(material, 'utf8').digest('hex');
}

function expectedBytesHash(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

const READER_ROOT = path.resolve(process.cwd(), 'workspace-snapshot-source-selftest-root');
const READER_MOD_ID = 'reader_mod';
const READER_SNAPSHOT_NAME = 'snapshot_reader.json';
const READER_MOD_PATH = path.resolve(READER_ROOT, READER_MOD_ID);
const READER_SNAPSHOTS_PATH = path.resolve(READER_MOD_PATH, '.snapshots');
const READER_TARGET_PATH = path.resolve(READER_SNAPSHOTS_PATH, READER_SNAPSHOT_NAME);
const READER_FD = 73;

function readerInput(maxBytes?: number): Record<string, unknown> {
  const input: Record<string, unknown> = {
    root: READER_ROOT,
    modId: READER_MOD_ID,
    snapshotName: READER_SNAPSHOT_NAME,
  };
  if (maxBytes !== undefined) input.maxBytes = maxBytes;
  return input;
}

function readerPathKey(value: string): string {
  const resolved = path.resolve(value);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function readerNativeError(code?: string): Error {
  const error = new Error(RAW_MARKER);
  if (code !== undefined) Object.defineProperty(error, 'code', { value: code });
  return error;
}

function readerStat(
  kind: 'directory' | 'file' | 'link',
  size: bigint,
  ino: bigint,
): WorkspaceSnapshotSourceStat {
  return {
    dev: 7n,
    ino,
    mode: kind === 'directory' ? 16_384n : kind === 'file' ? 33_188n : 40_960n,
    size,
    mtimeNs: 11n,
    ctimeNs: 12n,
    birthtimeNs: 13n,
    isFile: () => kind === 'file',
    isDirectory: () => kind === 'directory',
    isSymbolicLink: () => kind === 'link',
  };
}

interface ReaderIoOverrides {
  lstat?: (
    value: string,
    callNumber: number,
    defaultStat: WorkspaceSnapshotSourceStat,
  ) => WorkspaceSnapshotSourceStat;
  realpath?: (value: string, callNumber: number, defaultValue: string) => string;
  open?: (value: string) => number;
  fstat?: (fd: number, defaultStat: WorkspaceSnapshotSourceStat) => WorkspaceSnapshotSourceStat;
  read?: (fd: number, defaultBytes: Uint8Array) => Uint8Array;
  close?: (fd: number) => void;
}

interface ReaderIoHarness {
  io: WorkspaceSnapshotSourceIo;
  readonly openCount: number;
  readonly closeCount: number;
  readonly lstatCounts: Map<string, number>;
  readonly realpathCounts: Map<string, number>;
}

function makeReaderIo(
  bytes: Uint8Array = validEnvelopeBytes(),
  overrides: ReaderIoOverrides = {},
  targetSize: bigint = BigInt(bytes.byteLength),
): ReaderIoHarness {
  const stats = new Map<string, WorkspaceSnapshotSourceStat>([
    [readerPathKey(READER_ROOT), readerStat('directory', 0n, 1n)],
    [readerPathKey(READER_MOD_PATH), readerStat('directory', 0n, 2n)],
    [readerPathKey(READER_SNAPSHOTS_PATH), readerStat('directory', 0n, 3n)],
    [readerPathKey(READER_TARGET_PATH), readerStat('file', targetSize, 4n)],
  ]);
  const lstatCounts = new Map<string, number>();
  const realpathCounts = new Map<string, number>();
  let openCount = 0;
  let closeCount = 0;

  const increment = (counts: Map<string, number>, value: string): number => {
    const key = readerPathKey(value);
    const callNumber = (counts.get(key) ?? 0) + 1;
    counts.set(key, callNumber);
    return callNumber;
  };

  const io: WorkspaceSnapshotSourceIo = {
    lstat(value) {
      const callNumber = increment(lstatCounts, value);
      const defaultStat = stats.get(readerPathKey(value));
      if (defaultStat === undefined) throw readerNativeError('ENOENT');
      return overrides.lstat === undefined
        ? defaultStat
        : overrides.lstat(value, callNumber, defaultStat);
    },
    realpath(value) {
      const callNumber = increment(realpathCounts, value);
      const defaultValue = value;
      return overrides.realpath === undefined
        ? defaultValue
        : overrides.realpath(value, callNumber, defaultValue);
    },
    open(value) {
      openCount += 1;
      if (overrides.open !== undefined) return overrides.open(value);
      return READER_FD;
    },
    fstat(fd) {
      const defaultStat = stats.get(readerPathKey(READER_TARGET_PATH));
      if (defaultStat === undefined) throw readerNativeError('ENOENT');
      return overrides.fstat === undefined ? defaultStat : overrides.fstat(fd, defaultStat);
    },
    read(fd) {
      const defaultBytes = new Uint8Array(bytes);
      return overrides.read === undefined ? defaultBytes : overrides.read(fd, defaultBytes);
    },
    close(fd) {
      closeCount += 1;
      if (overrides.close !== undefined) overrides.close(fd);
    },
  };

  return {
    io,
    get openCount() {
      return openCount;
    },
    get closeCount() {
      return closeCount;
    },
    lstatCounts,
    realpathCounts,
  };
}

export function runWorkspaceSnapshotSourceSelftest(): WorkspaceSnapshotSourceSelftestResult {
  const checks: WorkspaceSnapshotSourceSelftestCheck[] = [];

  checks.push(check('exported_byte_ceiling_is_registry_ceiling_plus_one_megabyte', () => (
    Number.isSafeInteger(WORKSPACE_SNAPSHOT_SOURCE_MAX_BYTES)
      && WORKSPACE_SNAPSHOT_SOURCE_MAX_BYTES === WORKSPACE_REGISTRY_MAX_BYTES + 1024 * 1024
  )));

  checks.push(check('error_contract_is_fixed_and_nonsecret', () => {
    const error = new WorkspaceSnapshotSourceError();
    const exposed = `${error.name}|${error.code}|${error.message}|${error.stack ?? ''}|${JSON.stringify(error) ?? ''}`;
    return error instanceof Error
      && error instanceof WorkspaceSnapshotSourceError
      && error.constructor === WorkspaceSnapshotSourceError
      && error.name === 'WorkspaceSnapshotSourceError'
      && error.code === FIXED_ERROR_CODE
      && error.message === FIXED_ERROR_MESSAGE
      && !exposed.includes(RAW_MARKER);
  }));

  checks.push(check('valid_identity_uses_fixed_order_sha256', () => {
    const modId = 'mod.alpha_1-beta';
    const snapshotName = 'snapshot_main_part-1.v1.json';
    const input = { snapshotName, modId };
    const material = '{"modId":"mod.alpha_1-beta","snapshotName":"snapshot_main_part-1.v1.json"}';
    const reversedMaterial = JSON.stringify(input);
    const result = normalizeWorkspaceSnapshotLogicalIdentity(input);
    const fixedHash = expectedHash(material);
    return reversedMaterial !== material
      && result.modId === modId
      && result.snapshotName === snapshotName
      && result.snapshotIdentityHash === fixedHash
      && result.snapshotIdentityHash !== expectedHash(reversedMaterial)
      && JSON.stringify(result) === JSON.stringify({ modId, snapshotName, snapshotIdentityHash: fixedHash });
  }));

  checks.push(check('valid_identity_is_stable_on_repeated_call', () => {
    const modId = 'stable_mod';
    const snapshotName = 'snapshot_stable.json';
    const first = normalizeWorkspaceSnapshotLogicalIdentity({ modId, snapshotName });
    const second = normalizeWorkspaceSnapshotLogicalIdentity({ snapshotName, modId });
    return JSON.stringify(first) === JSON.stringify(second)
      && first.snapshotIdentityHash === second.snapshotIdentityHash;
  }));

  checks.push(check('maximum_length_segments_are_accepted', () => {
    const modId = `m${'a'.repeat(127)}`;
    const snapshotName = `snapshot_${'b'.repeat(241)}.json`;
    const result = normalizeWorkspaceSnapshotLogicalIdentity({ modId, snapshotName });
    return modId.length === 128
      && snapshotName.length === 255
      && result.modId === modId
      && result.snapshotName === snapshotName
      && /^[a-f0-9]{64}$/.test(result.snapshotIdentityHash);
  }));

  checks.push(check('null_array_class_and_null_prototype_are_refused', () => {
    class IdentityClass {
      modId = 'class_mod';
      snapshotName = 'snapshot_class.json';
    }
    const nullPrototype = Object.create(null) as Record<string, string>;
    nullPrototype.modId = 'null_prototype_mod';
    nullPrototype.snapshotName = 'snapshot_null_prototype.json';
    return exactRefusal(() => normalizeWorkspaceSnapshotLogicalIdentity(null))
      && exactRefusal(() => normalizeWorkspaceSnapshotLogicalIdentity([]))
      && exactRefusal(() => normalizeWorkspaceSnapshotLogicalIdentity(new IdentityClass()))
      && exactRefusal(() => normalizeWorkspaceSnapshotLogicalIdentity(nullPrototype));
  }));

  checks.push(check('proxy_is_refused_before_any_hostile_trap', () => {
    let trapCalls = 0;
    const hostileProxy = new Proxy({
      modId: RAW_MARKER,
      snapshotName: 'snapshot_proxy.json',
    }, {
      get() {
        trapCalls += 1;
        throw new Error(RAW_MARKER);
      },
      getPrototypeOf() {
        trapCalls += 1;
        throw new Error(RAW_MARKER);
      },
      ownKeys() {
        trapCalls += 1;
        throw new Error(RAW_MARKER);
      },
      getOwnPropertyDescriptor() {
        trapCalls += 1;
        throw new Error(RAW_MARKER);
      },
    });
    return exactRefusal(() => normalizeWorkspaceSnapshotLogicalIdentity(hostileProxy), [RAW_MARKER])
      && trapCalls === 0;
  }));

  checks.push(check('missing_extra_symbol_accessor_and_inherited_fields_are_refused', () => {
    const symbolKey = Symbol('raw-symbol');
    let getterCalls = 0;
    const accessor = {
      modId: 'accessor_mod',
      snapshotName: 'snapshot_accessor.json',
    };
    Object.defineProperty(accessor, 'modId', {
      configurable: true,
      enumerable: true,
      get() {
        getterCalls += 1;
        throw new Error(RAW_MARKER);
      },
    });
    const inherited = Object.create({
      inherited: RAW_MARKER,
      snapshotName: 'snapshot_inherited.json',
    }) as { modId: string };
    inherited.modId = 'inherited_mod';
    return exactRefusal(() => normalizeWorkspaceSnapshotLogicalIdentity({ modId: 'missing_snapshot' }))
      && exactRefusal(() => normalizeWorkspaceSnapshotLogicalIdentity({ snapshotName: 'snapshot_missing_mod.json' }))
      && exactRefusal(() => normalizeWorkspaceSnapshotLogicalIdentity({
        modId: 'extra_mod',
        snapshotName: 'snapshot_extra.json',
        extra: RAW_MARKER,
      }), [RAW_MARKER])
      && exactRefusal(() => normalizeWorkspaceSnapshotLogicalIdentity({
        modId: 'symbol_mod',
        snapshotName: 'snapshot_symbol.json',
        [symbolKey]: RAW_MARKER,
      }), [RAW_MARKER])
      && exactRefusal(() => normalizeWorkspaceSnapshotLogicalIdentity(accessor), [RAW_MARKER])
      && getterCalls === 0
      && exactRefusal(() => normalizeWorkspaceSnapshotLogicalIdentity(inherited), [RAW_MARKER]);
  }));

  checks.push(check('non_string_fields_are_refused', () => {
    const cases: unknown[] = [
      { modId: 7, snapshotName: 'snapshot_number_mod.json' },
      { modId: 'non_string_mod', snapshotName: false },
      { modId: new String('boxed_mod'), snapshotName: 'snapshot_boxed_mod.json' },
      { modId: 'array_mod', snapshotName: ['snapshot_array_value.json'] },
      { modId: undefined, snapshotName: 'snapshot_undefined_mod.json' },
      { modId: 'null_value_mod', snapshotName: null },
    ];
    return cases.every(input => exactRefusal(() => normalizeWorkspaceSnapshotLogicalIdentity(input)));
  }));

  checks.push(check('empty_dot_and_dotdot_values_are_refused', () => {
    const validSnapshotName = 'snapshot_valid.json';
    const validModId = 'valid_mod';
    const modIdValues = ['', '.', '..'];
    const snapshotNameValues = ['', '.', '..'];
    return modIdValues.every(modId => exactRefusal(
      () => normalizeWorkspaceSnapshotLogicalIdentity({ modId, snapshotName: validSnapshotName }),
    ))
      && snapshotNameValues.every(snapshotName => exactRefusal(
        () => normalizeWorkspaceSnapshotLogicalIdentity({ modId: validModId, snapshotName }),
      ));
  }));

  checks.push(check('path_control_unicode_space_and_leading_punctuation_are_refused', () => {
    const invalidModIds = [
      '/absolute/path',
      'C:\\absolute\\path',
      'mod:id',
      'mod/id',
      'mod\\id',
      `mod${String.fromCharCode(0)}id`,
      'modé',
      'mod id',
      '-mod',
      '_mod',
      '.mod',
    ];
    const invalidSnapshotNames = [
      '/absolute/snapshot.json',
      'C:\\absolute\\snapshot.json',
      'snapshot_mod:id.json',
      'snapshot_mod/id.json',
      'snapshot_mod\\id.json',
      `snapshot_mod${String.fromCharCode(0)}id.json`,
      'snapshot_modé.json',
      'snapshot_mod id.json',
      '-snapshot.json',
      '_snapshot.json',
      '.snapshot.json',
    ];
    return invalidModIds.every(modId => exactRefusal(
      () => normalizeWorkspaceSnapshotLogicalIdentity({ modId, snapshotName: 'snapshot_valid.json' }),
      [modId],
    ))
      && invalidSnapshotNames.every(snapshotName => exactRefusal(
        () => normalizeWorkspaceSnapshotLogicalIdentity({ modId: 'valid_mod', snapshotName }),
        [snapshotName],
      ));
  }));

  checks.push(check('oversized_values_are_refused', () => {
    const oversizedModId = `m${'a'.repeat(128)}`;
    const oversizedSnapshotName = `snapshot_${'b'.repeat(242)}.json`;
    return oversizedModId.length === 129
      && oversizedSnapshotName.length === 256
      && exactRefusal(
        () => normalizeWorkspaceSnapshotLogicalIdentity({
          modId: oversizedModId,
          snapshotName: 'snapshot_valid.json',
        }),
        [oversizedModId],
      )
      && exactRefusal(
        () => normalizeWorkspaceSnapshotLogicalIdentity({
          modId: 'valid_mod',
          snapshotName: oversizedSnapshotName,
        }),
        [oversizedSnapshotName],
      );
  }));

  checks.push(check('snapshot_prefix_and_suffix_are_required', () => {
    const invalidNames = [
      'archive_a.json',
      'snap_a.json',
      'snapshota.json',
      'snapshot_a',
      'snapshot_a.txt',
      'snapshot_a.JSON',
      'snapshot_a.json.bak',
    ];
    return invalidNames.every(snapshotName => exactRefusal(
      () => normalizeWorkspaceSnapshotLogicalIdentity({ modId: 'valid_mod', snapshotName }),
      [snapshotName],
    ));
  }));

  checks.push(check('snapshot_body_must_be_nonempty_and_safe', () => {
    const invalidNames = [
      'snapshot_.json',
      'snapshot_..json',
      'snapshot_...json',
      'snapshot_/.json',
      'snapshot_\\.json',
      'snapshot_a:b.json',
      'snapshot_ .json',
      `snapshot_${String.fromCharCode(0)}.json`,
      'snapshot_😀.json',
    ];
    return invalidNames.every(snapshotName => exactRefusal(
      () => normalizeWorkspaceSnapshotLogicalIdentity({ modId: 'valid_mod', snapshotName }),
      [snapshotName],
    ));
  }));

  checks.push(check('decode_valid_envelope_has_exact_byte_and_mod_id_hashes', () => {
    const bytes = validEnvelopeBytes();
    const result = decodeWorkspaceSnapshotEnvelope(bytes);
    return result.sourceHash === expectedBytesHash(bytes)
      && result.snapshotModIdHash === expectedHash(ENVELOPE_MOD_ID)
      && /^[a-f0-9]{64}$/.test(result.sourceHash)
      && /^[a-f0-9]{64}$/.test(result.snapshotModIdHash)
      && !JSON.stringify(result).includes(ENVELOPE_MOD_ID);
  }));

  checks.push(check('decode_preserves_canonical_scalars_and_sanitizes_workspace', () => {
    const result = decodeWorkspaceSnapshotEnvelope(validEnvelopeBytes());
    return result.savedAt === ENVELOPE_SAVED_AT
      && result.name === ENVELOPE_NAME
      && result.workspace.id === 'workspace_snapshot_selftest'
      && result.workspace.nodes.length === 0
      && result.workspace.uiTheme.opacity === 0.95
      && result.workspace.compileSettings.md === true
      && result.workspace.templates.length === 0;
  }));

  checks.push(check('decode_is_deterministic_and_independent_from_later_caller_mutation', () => {
    const bytes = validEnvelopeBytes();
    const sourceHash = expectedBytesHash(bytes);
    const first = decodeWorkspaceSnapshotEnvelope(bytes);
    bytes[0] ^= 0x01;
    const second = decodeWorkspaceSnapshotEnvelope(validEnvelopeBytes());
    return first.sourceHash === sourceHash
      && JSON.stringify(first) === JSON.stringify(second);
  }));

  checks.push(check('decode_accepts_default_and_exact_boundary_max_bytes', () => {
    const bytes = validEnvelopeBytes();
    const defaultResult = decodeWorkspaceSnapshotEnvelope(bytes);
    const boundaryResult = decodeWorkspaceSnapshotEnvelope(bytes, bytes.byteLength);
    return bytes.byteLength > 0
      && bytes.byteLength <= WORKSPACE_SNAPSHOT_SOURCE_MAX_BYTES
      && defaultResult.sourceHash === boundaryResult.sourceHash
      && defaultResult.snapshotModIdHash === boundaryResult.snapshotModIdHash;
  }));

  checks.push(check('decode_rejects_invalid_max_bytes_with_fixed_message', () => {
    const bytes = validEnvelopeBytes();
    const invalidValues: unknown[] = [
      0,
      -1,
      0.5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      WORKSPACE_SNAPSHOT_SOURCE_MAX_BYTES + 1,
      null,
    ];
    return invalidValues.every(value => exactDecodeRefusal(
      'WORKSPACE_SNAPSHOT_MAX_BYTES_INVALID',
      () => decodeWorkspaceSnapshotEnvelope(bytes, value as number),
    ));
  }));

  checks.push(check('decode_rejects_oversize_with_fixed_message', () => {
    const bytes = validEnvelopeBytes();
    return bytes.byteLength > 1
      && exactDecodeRefusal(
        'WORKSPACE_SNAPSHOT_TOO_LARGE',
        () => decodeWorkspaceSnapshotEnvelope(bytes, bytes.byteLength - 1),
      );
  }));

  checks.push(check('decode_rejects_proxy_and_non_uint8array_without_traps', () => {
    let trapCalls = 0;
    const hostileProxy = new Proxy(validEnvelopeBytes(), {
      get() {
        trapCalls += 1;
        throw new Error(RAW_MARKER);
      },
      getPrototypeOf() {
        trapCalls += 1;
        throw new Error(RAW_MARKER);
      },
      ownKeys() {
        trapCalls += 1;
        throw new Error(RAW_MARKER);
      },
      getOwnPropertyDescriptor() {
        trapCalls += 1;
        throw new Error(RAW_MARKER);
      },
    });
    const nonUint8Arrays: unknown[] = [
      [],
      new Uint16Array([1]),
      new ArrayBuffer(1),
      'not-bytes',
      null,
    ];
    return exactDecodeRefusal(
      'WORKSPACE_SNAPSHOT_ENVELOPE_INVALID',
      () => decodeWorkspaceSnapshotEnvelope(hostileProxy as unknown as Uint8Array),
      [RAW_MARKER],
    )
      && trapCalls === 0
      && nonUint8Arrays.every(value => exactDecodeRefusal(
        'WORKSPACE_SNAPSHOT_ENVELOPE_INVALID',
        () => decodeWorkspaceSnapshotEnvelope(value as Uint8Array),
      ));
  }));

  checks.push(check('decode_maps_fatal_invalid_utf8_to_fixed_message', () => {
    const invalidUtf8 = new Uint8Array([0xe2, 0x28, 0xa1]);
    return exactDecodeRefusal(
      'WORKSPACE_SNAPSHOT_UTF8_INVALID',
      () => decodeWorkspaceSnapshotEnvelope(invalidUtf8),
    );
  }));

  checks.push(check('decode_maps_malformed_json_to_fixed_message', () => {
    const malformedJson = new TextEncoder().encode(`{"savedAt":"${RAW_MARKER}"`);
    return exactDecodeRefusal(
      'WORKSPACE_SNAPSHOT_JSON_INVALID',
      () => decodeWorkspaceSnapshotEnvelope(malformedJson),
      [RAW_MARKER],
    );
  }));

  checks.push(check('decode_rejects_null_and_array_envelopes', () => (
    ['null', '[]'].every(json => exactDecodeRefusal(
      'WORKSPACE_SNAPSHOT_ENVELOPE_INVALID',
      () => decodeWorkspaceSnapshotEnvelope(new TextEncoder().encode(json)),
    ))
  )));

  checks.push(check('decode_rejects_missing_and_extra_envelope_keys', () => (
    (['savedAt', 'name', 'modId', 'workspace'] as const).every(key => exactDecodeRefusal(
      'WORKSPACE_SNAPSHOT_ENVELOPE_INVALID',
      () => decodeWorkspaceSnapshotEnvelope(encodeJson(withoutEnvelopeKey(key))),
    ))
      && exactDecodeRefusal(
        'WORKSPACE_SNAPSHOT_ENVELOPE_INVALID',
        () => decodeWorkspaceSnapshotEnvelope(validEnvelopeBytes({
          [RAW_MARKER]: RAW_BYTES_MARKER,
        })),
        [RAW_MARKER, RAW_BYTES_MARKER],
      )
  )));

  checks.push(check('decode_maps_wrong_scalar_types_and_workspace_shape', () => {
    const wrongScalarValues: Array<Record<string, unknown>> = [
      envelopeFixture({ savedAt: 7 }),
      envelopeFixture({ name: false }),
      envelopeFixture({ modId: { raw: RAW_MARKER } }),
      envelopeFixture({ savedAt: null }),
      envelopeFixture({ name: [] }),
    ];
    const wrongWorkspaceValues: unknown[] = [null, [], 'workspace', 7];
    return wrongScalarValues.every(value => exactDecodeRefusal(
      'WORKSPACE_SNAPSHOT_VALUE_UNSAFE',
      () => decodeWorkspaceSnapshotEnvelope(encodeJson(value)),
      [RAW_MARKER],
    ))
      && wrongWorkspaceValues.every(workspace => exactDecodeRefusal(
        'WORKSPACE_SNAPSHOT_ENVELOPE_INVALID',
        () => decodeWorkspaceSnapshotEnvelope(validEnvelopeBytes({ workspace })),
      ));
  }));

  checks.push(check('decode_rejects_empty_controls_surrogates_separators_and_oversize_scalars', () => {
    const unsafeValues = [
      '',
      '\u0001',
      '\u0085',
      '\u007f',
      '\ud800',
      '\udc00',
      '\u2028',
      '\u2029',
    ];
    const unsafeNames = [...unsafeValues, 'n'.repeat(257)];
    const unsafeModIds = [...unsafeValues, 'm'.repeat(129)];
    const unsafeSavedAt = [...unsafeValues];
    return unsafeNames.every(name => exactDecodeRefusal(
      'WORKSPACE_SNAPSHOT_VALUE_UNSAFE',
      () => decodeWorkspaceSnapshotEnvelope(validEnvelopeBytes({ name })),
      [name],
    ))
      && unsafeModIds.every(modId => exactDecodeRefusal(
        'WORKSPACE_SNAPSHOT_VALUE_UNSAFE',
        () => decodeWorkspaceSnapshotEnvelope(validEnvelopeBytes({ modId })),
        [modId],
      ))
      && unsafeSavedAt.every(savedAt => exactDecodeRefusal(
        'WORKSPACE_SNAPSHOT_VALUE_UNSAFE',
        () => decodeWorkspaceSnapshotEnvelope(validEnvelopeBytes({ savedAt })),
        [savedAt],
      ));
  }));

  checks.push(check('decode_accepts_inclusive_scalar_maximum_lengths', () => {
    const name = 'n'.repeat(256);
    const modId = 'm'.repeat(128);
    const result = decodeWorkspaceSnapshotEnvelope(validEnvelopeBytes({ name, modId }));
    return result.name === name
      && result.snapshotModIdHash === expectedHash(modId);
  }));

  checks.push(check('decode_requires_canonical_valid_saved_at', () => {
    const invalidTimestamps = [
      '2026-08-06T12:34:56Z',
      '2026-08-06',
      '2026-02-30T12:34:56.000Z',
      'not-a-timestamp',
    ];
    return invalidTimestamps.every(savedAt => exactDecodeRefusal(
      'WORKSPACE_SNAPSHOT_VALUE_UNSAFE',
      () => decodeWorkspaceSnapshotEnvelope(validEnvelopeBytes({ savedAt })),
      [savedAt],
    ));
  }));

  checks.push(check('decode_requires_nonobject_workspace', () => {
    const invalidWorkspaces: unknown[] = [null, [], 'workspace', 7];
    return invalidWorkspaces.every(workspace => exactDecodeRefusal(
      'WORKSPACE_SNAPSHOT_ENVELOPE_INVALID',
      () => decodeWorkspaceSnapshotEnvelope(validEnvelopeBytes({ workspace })),
    ));
  }));

  checks.push(check('decode_refusals_do_not_leak_raw_marker_path_or_bytes', () => {
    const bytes = validEnvelopeBytes({
      name: RAW_PATH_MARKER,
      workspace: {
        ...envelopeWorkspace(),
        sourceFolder: RAW_PATH_MARKER,
      },
      [RAW_MARKER]: RAW_BYTES_MARKER,
    });
    const rawByteText = new TextDecoder().decode(bytes);
    const rawByteHex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
    return exactDecodeRefusal(
      'WORKSPACE_SNAPSHOT_ENVELOPE_INVALID',
      () => decodeWorkspaceSnapshotEnvelope(bytes),
      [RAW_MARKER, RAW_PATH_MARKER, RAW_BYTES_MARKER, rawByteText, rawByteHex],
    );
  }));

  checks.push(check('decode_rejects_workspace_identity_synthesis_inputs', () => {
    const missingId = {
      ...envelopeWorkspace(),
      description: RAW_MARKER,
    };
    Reflect.deleteProperty(missingId, 'id');
    const emptyId = {
      ...envelopeWorkspace(),
      id: '',
      description: RAW_MARKER,
    };
    const nonStringId = {
      ...envelopeWorkspace(),
      id: { marker: RAW_MARKER },
    };
    return [missingId, emptyId, nonStringId].every(workspace => exactDecodeRefusal(
      'WORKSPACE_SNAPSHOT_ENVELOPE_INVALID',
      () => decodeWorkspaceSnapshotEnvelope(validEnvelopeBytes({ workspace })),
      [RAW_MARKER],
    ));
  }));

  checks.push(check('decode_rejects_retained_node_identity_synthesis_inputs', () => {
    const validNode = {
      id: 'node_valid_before_invalid',
      type: 'action',
      xmlTag: 'debug_text',
    };
    const missingId = {
      type: 'action',
      xmlTag: 'debug_text',
      label: RAW_MARKER,
    };
    const emptyId = {
      id: '',
      type: 'action',
      label: RAW_MARKER,
    };
    const nonStringId = {
      id: { marker: RAW_MARKER },
      type: 'action',
    };
    return [missingId, emptyId, nonStringId].every(node => exactDecodeRefusal(
      'WORKSPACE_SNAPSHOT_ENVELOPE_INVALID',
      () => decodeWorkspaceSnapshotEnvelope(validEnvelopeBytes({
        workspace: {
          ...envelopeWorkspace(),
          nodes: [validNode, node],
        },
      })),
      [RAW_MARKER],
    ));
  }));

  checks.push(check('decode_repeated_accepted_bytes_are_structurally_identical', () => {
    const bytes = validEnvelopeBytes({ workspace: deterministicNodeWorkspace() });
    const first = decodeWorkspaceSnapshotEnvelope(bytes);
    const second = decodeWorkspaceSnapshotEnvelope(bytes);
    return JSON.stringify(first.workspace) === JSON.stringify(second.workspace)
      && JSON.stringify(first) === JSON.stringify(second)
      && first.workspace.id === 'workspace_snapshot_selftest'
      && first.workspace.nodes.length === 1
      && first.workspace.nodes[0]?.id === 'node_deterministic_snapshot';
  }));

  checks.push(check('reader_repeated_accepted_bytes_are_structurally_identical', () => {
    const bytes = validEnvelopeBytes({ workspace: deterministicNodeWorkspace() });
    const harness = makeReaderIo(bytes);
    const first = readWorkspaceSnapshotSource(readerInput(), harness.io);
    const second = readWorkspaceSnapshotSource(readerInput(), harness.io);
    return JSON.stringify(first.workspace) === JSON.stringify(second.workspace)
      && JSON.stringify(first) === JSON.stringify(second)
      && first.workspace.nodes[0]?.id === 'node_deterministic_snapshot'
      && harness.openCount === 2
      && harness.closeCount === 2;
  }));

  checks.push(check('reader_happy_path_returns_sanitized_workspace_and_exact_hashes', () => {
    const bytes = validEnvelopeBytes();
    const harness = makeReaderIo(bytes);
    const result = readWorkspaceSnapshotSource(readerInput(), harness.io);
    const identity = normalizeWorkspaceSnapshotLogicalIdentity({
      modId: READER_MOD_ID,
      snapshotName: READER_SNAPSHOT_NAME,
    });
    const serialized = JSON.stringify(result);
    const rawByteHex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
    return result.sourceHash === expectedBytesHash(bytes)
      && result.snapshotIdentityHash === identity.snapshotIdentityHash
      && result.snapshotModIdHash === expectedHash(ENVELOPE_MOD_ID)
      && result.savedAt === ENVELOPE_SAVED_AT
      && result.name === ENVELOPE_NAME
      && result.workspace.id === 'workspace_snapshot_selftest'
      && result.workspace.nodes.length === 0
      && result.workspace.uiTheme.opacity === 0.95
      && harness.openCount === 1
      && harness.closeCount === 1
      && !serialized.includes(READER_ROOT)
      && !serialized.includes(ENVELOPE_MOD_ID)
      && !serialized.includes(rawByteHex);
  }));

  checks.push(check('reader_requires_exact_fstat_read_byte_length', () => {
    const bytes = validEnvelopeBytes();
    const truncated = bytes.slice(0, -1);
    const overlong = new Uint8Array(bytes.length + 1);
    overlong.set(bytes);
    const truncatedHarness = makeReaderIo(bytes, {
      read: () => truncated,
    });
    const overlongHarness = makeReaderIo(bytes, {
      read: () => overlong,
    });
    return exactReaderRefusal(
      'WORKSPACE_SNAPSHOT_READ_FAILED',
      () => readWorkspaceSnapshotSource(readerInput(), truncatedHarness.io),
      [RAW_MARKER],
    )
      && exactReaderRefusal(
        'WORKSPACE_SNAPSHOT_READ_FAILED',
        () => readWorkspaceSnapshotSource(readerInput(), overlongHarness.io),
        [RAW_MARKER],
      )
      && truncatedHarness.openCount === 1
      && truncatedHarness.closeCount === 1
      && overlongHarness.openCount === 1
      && overlongHarness.closeCount === 1;
  }));

  checks.push(check('reader_close_is_exactly_once_after_open_and_zero_before_open', () => {
    const bytes = validEnvelopeBytes();
    const happyHarness = makeReaderIo(bytes);
    readWorkspaceSnapshotSource(readerInput(), happyHarness.io);
    const tooLargeHarness = makeReaderIo(bytes, {}, BigInt(bytes.byteLength + 1));
    const tooLargeInput = readerInput(bytes.byteLength);
    return happyHarness.openCount === 1
      && happyHarness.closeCount === 1
      && exactReaderRefusal(
        'WORKSPACE_SNAPSHOT_TOO_LARGE',
        () => readWorkspaceSnapshotSource(tooLargeInput, tooLargeHarness.io),
      )
      && tooLargeHarness.openCount === 0
      && tooLargeHarness.closeCount === 0;
  }));

  checks.push(check('reader_rejects_logical_root_and_max_input_abuse_before_io', () => {
    const cases: Array<{
      input: unknown;
      code: keyof typeof READER_ERROR_MESSAGES;
    }> = [
      { input: { ...readerInput(), root: 'relative-root' }, code: 'WORKSPACE_SNAPSHOT_ROOT_INVALID' },
      { input: { ...readerInput(), modId: '../escape' }, code: 'WORKSPACE_SNAPSHOT_LOGICAL_IDENTITY_INVALID' },
      { input: { ...readerInput(), snapshotName: 'archive.json' }, code: 'WORKSPACE_SNAPSHOT_LOGICAL_IDENTITY_INVALID' },
      { input: { ...readerInput(), maxBytes: 0 }, code: 'WORKSPACE_SNAPSHOT_MAX_BYTES_INVALID' },
      {
        input: { ...readerInput(), maxBytes: WORKSPACE_SNAPSHOT_SOURCE_MAX_BYTES + 1 },
        code: 'WORKSPACE_SNAPSHOT_MAX_BYTES_INVALID',
      },
      { input: { ...readerInput(), extra: RAW_MARKER }, code: 'WORKSPACE_SNAPSHOT_ROOT_INVALID' },
    ];
    return cases.every(({ input, code }) => {
      const harness = makeReaderIo();
      return exactReaderRefusal(code, () => readWorkspaceSnapshotSource(input, harness.io), [RAW_MARKER])
        && harness.openCount === 0
        && harness.closeCount === 0
        && harness.lstatCounts.size === 0;
    });
  }));

  checks.push(check('reader_rejects_hostile_input_and_io_without_traps', () => {
    let inputTrapCalls = 0;
    const hostileInput = new Proxy(readerInput(), {
      get() {
        inputTrapCalls += 1;
        throw new Error(RAW_MARKER);
      },
      getPrototypeOf() {
        inputTrapCalls += 1;
        throw new Error(RAW_MARKER);
      },
      ownKeys() {
        inputTrapCalls += 1;
        throw new Error(RAW_MARKER);
      },
      getOwnPropertyDescriptor() {
        inputTrapCalls += 1;
        throw new Error(RAW_MARKER);
      },
    });
    const inputHarness = makeReaderIo();
    const inputResult = exactReaderRefusal(
      'WORKSPACE_SNAPSHOT_ROOT_INVALID',
      () => readWorkspaceSnapshotSource(hostileInput, inputHarness.io),
      [RAW_MARKER],
    );

    const ioHarness = makeReaderIo();
    let ioTrapCalls = 0;
    const hostileIo = new Proxy(ioHarness.io, {
      get() {
        ioTrapCalls += 1;
        throw new Error(RAW_MARKER);
      },
      ownKeys() {
        ioTrapCalls += 1;
        throw new Error(RAW_MARKER);
      },
      getPrototypeOf() {
        ioTrapCalls += 1;
        throw new Error(RAW_MARKER);
      },
      getOwnPropertyDescriptor() {
        ioTrapCalls += 1;
        throw new Error(RAW_MARKER);
      },
    });
    const ioResult = exactReaderRefusal(
      'WORKSPACE_SNAPSHOT_READ_FAILED',
      () => readWorkspaceSnapshotSource(readerInput(), hostileIo as unknown as WorkspaceSnapshotSourceIo),
      [RAW_MARKER],
    );
    return inputResult
      && inputTrapCalls === 0
      && inputHarness.lstatCounts.size === 0
      && ioResult
      && ioTrapCalls === 0
      && ioHarness.lstatCounts.size === 0;
  }));

  checks.push(check('reader_rejects_io_accessors_missing_extra_and_proxy_methods', () => {
    const baseIo = makeReaderIo().io;
    const missingIo = { ...baseIo } as Partial<WorkspaceSnapshotSourceIo>;
    Reflect.deleteProperty(missingIo, 'close');
    const extraIo = { ...baseIo, extra: RAW_MARKER };
    let getterCalls = 0;
    const accessorIo = { ...baseIo };
    Object.defineProperty(accessorIo, 'read', {
      configurable: true,
      enumerable: true,
      get() {
        getterCalls += 1;
        throw new Error(RAW_MARKER);
      },
    });
    let methodProxyTraps = 0;
    const proxyMethod = new Proxy(() => new Uint8Array(), {
      apply() {
        methodProxyTraps += 1;
        throw new Error(RAW_MARKER);
      },
    });
    const proxyMethodIo = { ...baseIo, read: proxyMethod };
    return exactReaderRefusal(
      'WORKSPACE_SNAPSHOT_READ_FAILED',
      () => readWorkspaceSnapshotSource(readerInput(), missingIo as WorkspaceSnapshotSourceIo),
    )
      && exactReaderRefusal(
        'WORKSPACE_SNAPSHOT_READ_FAILED',
        () => readWorkspaceSnapshotSource(readerInput(), extraIo as WorkspaceSnapshotSourceIo),
        [RAW_MARKER],
      )
      && exactReaderRefusal(
        'WORKSPACE_SNAPSHOT_READ_FAILED',
        () => readWorkspaceSnapshotSource(readerInput(), accessorIo),
        [RAW_MARKER],
      )
      && getterCalls === 0
      && exactReaderRefusal(
        'WORKSPACE_SNAPSHOT_READ_FAILED',
        () => readWorkspaceSnapshotSource(readerInput(), proxyMethodIo),
        [RAW_MARKER],
      )
      && methodProxyTraps === 0;
  }));

  checks.push(check('reader_rejects_root_stat_proxies_and_accessors_without_traps', () => {
    let proxyTrapCalls = 0;
    const proxyStat = new Proxy(readerStat('directory', 0n, 1n), {
      get() {
        proxyTrapCalls += 1;
        throw new Error(RAW_MARKER);
      },
      getPrototypeOf() {
        proxyTrapCalls += 1;
        throw new Error(RAW_MARKER);
      },
    });
    const proxyHarness = makeReaderIo(validEnvelopeBytes(), {
      lstat: (value, callNumber, defaultStat) => readerPathKey(value) === readerPathKey(READER_ROOT)
        ? proxyStat as unknown as WorkspaceSnapshotSourceStat
        : defaultStat,
    });
    let getterCalls = 0;
    const accessorStat = readerStat('directory', 0n, 1n);
    Object.defineProperty(accessorStat, 'dev', {
      configurable: true,
      enumerable: true,
      get() {
        getterCalls += 1;
        throw new Error(RAW_MARKER);
      },
    });
    const accessorHarness = makeReaderIo(validEnvelopeBytes(), {
      lstat: (value, callNumber, defaultStat) => readerPathKey(value) === readerPathKey(READER_ROOT)
        ? accessorStat
        : defaultStat,
    });
    return exactReaderRefusal(
      'WORKSPACE_SNAPSHOT_ROOT_INVALID',
      () => readWorkspaceSnapshotSource(readerInput(), proxyHarness.io),
      [RAW_MARKER],
    )
      && proxyTrapCalls === 0
      && exactReaderRefusal(
        'WORKSPACE_SNAPSHOT_ROOT_INVALID',
        () => readWorkspaceSnapshotSource(readerInput(), accessorHarness.io),
        [RAW_MARKER],
      )
      && getterCalls === 0;
  }));

  checks.push(check('reader_maps_root_and_directory_target_states_to_fixed_codes', () => {
    const bytes = validEnvelopeBytes();
    const rootLinkHarness = makeReaderIo(bytes, {
      lstat: (value, callNumber, defaultStat) => readerPathKey(value) === readerPathKey(READER_ROOT)
        ? readerStat('link', 0n, 1n)
        : defaultStat,
    });
    const rootFileHarness = makeReaderIo(bytes, {
      lstat: (value, callNumber, defaultStat) => readerPathKey(value) === readerPathKey(READER_ROOT)
        ? readerStat('file', 0n, 1n)
        : defaultStat,
    });
    const modLinkHarness = makeReaderIo(bytes, {
      lstat: (value, callNumber, defaultStat) => readerPathKey(value) === readerPathKey(READER_MOD_PATH)
        ? readerStat('link', 0n, 2n)
        : defaultStat,
    });
    const modFileHarness = makeReaderIo(bytes, {
      lstat: (value, callNumber, defaultStat) => readerPathKey(value) === readerPathKey(READER_MOD_PATH)
        ? readerStat('file', 0n, 2n)
        : defaultStat,
    });
    const snapshotsLinkHarness = makeReaderIo(bytes, {
      lstat: (value, callNumber, defaultStat) => readerPathKey(value) === readerPathKey(READER_SNAPSHOTS_PATH)
        ? readerStat('link', 0n, 3n)
        : defaultStat,
    });
    const snapshotsFileHarness = makeReaderIo(bytes, {
      lstat: (value, callNumber, defaultStat) => readerPathKey(value) === readerPathKey(READER_SNAPSHOTS_PATH)
        ? readerStat('file', 0n, 3n)
        : defaultStat,
    });
    const targetLinkHarness = makeReaderIo(bytes, {
      lstat: (value, callNumber, defaultStat) => readerPathKey(value) === readerPathKey(READER_TARGET_PATH)
        ? readerStat('link', BigInt(bytes.byteLength), 4n)
        : defaultStat,
    });
    const targetDirectoryHarness = makeReaderIo(bytes, {
      lstat: (value, callNumber, defaultStat) => readerPathKey(value) === readerPathKey(READER_TARGET_PATH)
        ? readerStat('directory', BigInt(bytes.byteLength), 4n)
        : defaultStat,
    });
    return exactReaderRefusal(
      'WORKSPACE_SNAPSHOT_ROOT_INVALID',
      () => readWorkspaceSnapshotSource(readerInput(), rootLinkHarness.io),
    )
      && exactReaderRefusal(
        'WORKSPACE_SNAPSHOT_ROOT_INVALID',
        () => readWorkspaceSnapshotSource(readerInput(), rootFileHarness.io),
      )
      && exactReaderRefusal(
        'WORKSPACE_SNAPSHOT_PATH_UNSAFE',
        () => readWorkspaceSnapshotSource(readerInput(), modLinkHarness.io),
      )
      && exactReaderRefusal(
        'WORKSPACE_SNAPSHOT_PATH_UNSAFE',
        () => readWorkspaceSnapshotSource(readerInput(), modFileHarness.io),
      )
      && exactReaderRefusal(
        'WORKSPACE_SNAPSHOT_PATH_UNSAFE',
        () => readWorkspaceSnapshotSource(readerInput(), snapshotsLinkHarness.io),
      )
      && exactReaderRefusal(
        'WORKSPACE_SNAPSHOT_PATH_UNSAFE',
        () => readWorkspaceSnapshotSource(readerInput(), snapshotsFileHarness.io),
      )
      && exactReaderRefusal(
        'WORKSPACE_SNAPSHOT_PATH_UNSAFE',
        () => readWorkspaceSnapshotSource(readerInput(), targetLinkHarness.io),
      )
      && exactReaderRefusal(
        'WORKSPACE_SNAPSHOT_NOT_REGULAR',
        () => readWorkspaceSnapshotSource(readerInput(), targetDirectoryHarness.io),
      );
  }));

  checks.push(check('reader_maps_missing_root_ancestors_and_target', () => {
    const bytes = validEnvelopeBytes();
    const missingRoot = makeReaderIo(bytes, {
      lstat: (value) => {
        if (readerPathKey(value) === readerPathKey(READER_ROOT)) throw readerNativeError('ENOENT');
        return readerStat('directory', 0n, 1n);
      },
    });
    const missingMod = makeReaderIo(bytes, {
      lstat: (value, callNumber, defaultStat) => {
        if (readerPathKey(value) === readerPathKey(READER_MOD_PATH)) throw readerNativeError('ENOENT');
        return defaultStat;
      },
    });
    const missingSnapshots = makeReaderIo(bytes, {
      lstat: (value, callNumber, defaultStat) => {
        if (readerPathKey(value) === readerPathKey(READER_SNAPSHOTS_PATH)) throw readerNativeError('ENOENT');
        return defaultStat;
      },
    });
    const missingTarget = makeReaderIo(bytes, {
      lstat: (value, callNumber, defaultStat) => {
        if (readerPathKey(value) === readerPathKey(READER_TARGET_PATH)) throw readerNativeError('ENOENT');
        return defaultStat;
      },
    });
    return exactReaderRefusal(
      'WORKSPACE_SNAPSHOT_ROOT_INVALID',
      () => readWorkspaceSnapshotSource(readerInput(), missingRoot.io),
      [RAW_MARKER],
    )
      && exactReaderRefusal(
        'WORKSPACE_SNAPSHOT_NOT_FOUND',
        () => readWorkspaceSnapshotSource(readerInput(), missingMod.io),
        [RAW_MARKER],
      )
      && exactReaderRefusal(
        'WORKSPACE_SNAPSHOT_NOT_FOUND',
        () => readWorkspaceSnapshotSource(readerInput(), missingSnapshots.io),
        [RAW_MARKER],
      )
      && exactReaderRefusal(
        'WORKSPACE_SNAPSHOT_NOT_FOUND',
        () => readWorkspaceSnapshotSource(readerInput(), missingTarget.io),
        [RAW_MARKER],
      );
  }));

  checks.push(check('reader_rejects_realpath_escape_and_prefix_sibling_escape', () => {
    const bytes = validEnvelopeBytes();
    const escapedRoot = path.resolve(READER_ROOT, '..', 'reader-source-escape');
    const escapedMod = path.resolve(READER_ROOT, '..', 'reader-mod-escape');
    const escapedSnapshots = path.resolve(READER_ROOT, '..', 'reader-snapshots-escape');
    const escapedTarget = path.resolve(READER_ROOT, '..', 'reader-target-escape');
    const rootHarness = makeReaderIo(bytes, {
      realpath: (value, callNumber, defaultValue) => readerPathKey(value) === readerPathKey(READER_ROOT)
        ? escapedRoot
        : defaultValue,
    });
    const modHarness = makeReaderIo(bytes, {
      realpath: (value, callNumber, defaultValue) => readerPathKey(value) === readerPathKey(READER_MOD_PATH)
        ? escapedMod
        : defaultValue,
    });
    const snapshotsHarness = makeReaderIo(bytes, {
      realpath: (value, callNumber, defaultValue) => readerPathKey(value) === readerPathKey(READER_SNAPSHOTS_PATH)
        ? escapedSnapshots
        : defaultValue,
    });
    const targetHarness = makeReaderIo(bytes, {
      realpath: (value, callNumber, defaultValue) => readerPathKey(value) === readerPathKey(READER_TARGET_PATH)
        ? escapedTarget
        : defaultValue,
    });
    const prefixSibling = `${READER_ROOT}-sibling`;
    const prefixHarness = makeReaderIo(bytes, {
      realpath: (value, callNumber, defaultValue) => readerPathKey(value) === readerPathKey(READER_TARGET_PATH)
        ? path.resolve(prefixSibling, 'reader_mod', '.snapshots', READER_SNAPSHOT_NAME)
        : defaultValue,
    });
    return exactReaderRefusal(
      'WORKSPACE_SNAPSHOT_ROOT_INVALID',
      () => readWorkspaceSnapshotSource(readerInput(), rootHarness.io),
    )
      && exactReaderRefusal(
        'WORKSPACE_SNAPSHOT_PATH_UNSAFE',
        () => readWorkspaceSnapshotSource(readerInput(), modHarness.io),
      )
      && exactReaderRefusal(
        'WORKSPACE_SNAPSHOT_PATH_UNSAFE',
        () => readWorkspaceSnapshotSource(readerInput(), snapshotsHarness.io),
      )
      && exactReaderRefusal(
        'WORKSPACE_SNAPSHOT_PATH_UNSAFE',
        () => readWorkspaceSnapshotSource(readerInput(), targetHarness.io),
      )
      && exactReaderRefusal(
        'WORKSPACE_SNAPSHOT_PATH_UNSAFE',
        () => readWorkspaceSnapshotSource(readerInput(), prefixHarness.io),
      );
  }));

  checks.push(check('reader_enforces_declared_and_preopen_byte_ceiling', () => {
    const bytes = validEnvelopeBytes();
    const statTooLarge = makeReaderIo(bytes, {}, BigInt(bytes.byteLength + 1));
    const invalidMax = makeReaderIo(bytes);
    const boundary = makeReaderIo(bytes);
    return exactReaderRefusal(
      'WORKSPACE_SNAPSHOT_TOO_LARGE',
      () => readWorkspaceSnapshotSource(readerInput(bytes.byteLength), statTooLarge.io),
    )
      && statTooLarge.openCount === 0
      && statTooLarge.closeCount === 0
      && exactReaderRefusal(
        'WORKSPACE_SNAPSHOT_MAX_BYTES_INVALID',
        () => readWorkspaceSnapshotSource(readerInput(WORKSPACE_SNAPSHOT_SOURCE_MAX_BYTES + 1), invalidMax.io),
      )
      && invalidMax.lstatCounts.size === 0
      && readWorkspaceSnapshotSource(readerInput(bytes.byteLength), boundary.io).sourceHash === expectedBytesHash(bytes)
      && boundary.closeCount === 1;
  }));

  checks.push(check('reader_maps_open_fstat_read_and_close_faults_without_native_leaks', () => {
    const bytes = validEnvelopeBytes();
    const openHarness = makeReaderIo(bytes, {
      open: () => {
        throw readerNativeError();
      },
    });
    const fstatHarness = makeReaderIo(bytes, {
      fstat: () => {
        throw readerNativeError();
      },
    });
    const readHarness = makeReaderIo(bytes, {
      read: () => {
        throw readerNativeError();
      },
    });
    const closeHarness = makeReaderIo(bytes, {
      close: () => {
        throw readerNativeError();
      },
    });
    return exactReaderRefusal(
      'WORKSPACE_SNAPSHOT_READ_FAILED',
      () => readWorkspaceSnapshotSource(readerInput(), openHarness.io),
      [RAW_MARKER],
    )
      && openHarness.openCount === 1
      && openHarness.closeCount === 0
      && exactReaderRefusal(
        'WORKSPACE_SNAPSHOT_READ_FAILED',
        () => readWorkspaceSnapshotSource(readerInput(), fstatHarness.io),
        [RAW_MARKER],
      )
      && fstatHarness.openCount === 1
      && fstatHarness.closeCount === 1
      && exactReaderRefusal(
        'WORKSPACE_SNAPSHOT_READ_FAILED',
        () => readWorkspaceSnapshotSource(readerInput(), readHarness.io),
        [RAW_MARKER],
      )
      && readHarness.openCount === 1
      && readHarness.closeCount === 1
      && exactReaderRefusal(
        'WORKSPACE_SNAPSHOT_READ_FAILED',
        () => readWorkspaceSnapshotSource(readerInput(), closeHarness.io),
        [RAW_MARKER],
      )
      && closeHarness.openCount === 1
      && closeHarness.closeCount === 1;
  }));

  checks.push(check('reader_preserves_earlier_source_change_when_close_also_fails', () => {
    const bytes = validEnvelopeBytes();
    const changedStat = readerStat('file', BigInt(bytes.byteLength), 99n);
    const harness = makeReaderIo(bytes, {
      fstat: () => changedStat,
      close: () => {
        throw readerNativeError();
      },
    });
    return exactReaderRefusal(
      'WORKSPACE_SNAPSHOT_SOURCE_CHANGED',
      () => readWorkspaceSnapshotSource(readerInput(), harness.io),
      [RAW_MARKER],
    )
      && harness.openCount === 1
      && harness.closeCount === 1;
  }));

  checks.push(check('reader_rejects_fstat_and_final_identity_changes', () => {
    const bytes = validEnvelopeBytes();
    const changedFstatHarness = makeReaderIo(bytes, {
      fstat: () => readerStat('file', BigInt(bytes.byteLength), 99n),
    });
    const changedBirthtimeHarness = makeReaderIo(bytes, {
      fstat: () => ({
        ...readerStat('file', BigInt(bytes.byteLength), 4n),
        birthtimeNs: 999n,
      }),
    });
    const changedFinalHarness = makeReaderIo(bytes, {
      lstat: (value, callNumber, defaultStat) => readerPathKey(value) === readerPathKey(READER_TARGET_PATH)
        && callNumber === 2
        ? readerStat('file', BigInt(bytes.byteLength), 100n)
        : defaultStat,
    });
    return exactReaderRefusal(
      'WORKSPACE_SNAPSHOT_SOURCE_CHANGED',
      () => readWorkspaceSnapshotSource(readerInput(), changedFstatHarness.io),
    )
      && changedFstatHarness.closeCount === 1
      && exactReaderRefusal(
        'WORKSPACE_SNAPSHOT_SOURCE_CHANGED',
        () => readWorkspaceSnapshotSource(readerInput(), changedBirthtimeHarness.io),
      )
      && changedBirthtimeHarness.closeCount === 1
      && exactReaderRefusal(
        'WORKSPACE_SNAPSHOT_SOURCE_CHANGED',
        () => readWorkspaceSnapshotSource(readerInput(), changedFinalHarness.io),
      )
      && changedFinalHarness.closeCount === 1;
  }));

  checks.push(check('reader_rejects_invalid_read_results_and_hostile_byte_proxies', () => {
    const bytes = validEnvelopeBytes();
    const invalidResultHarness = makeReaderIo(bytes, {
      read: () => 'not-bytes' as unknown as Uint8Array,
    });
    let byteTrapCalls = 0;
    const hostileBytes = new Proxy(new Uint8Array(bytes), {
      get() {
        byteTrapCalls += 1;
        throw new Error(RAW_MARKER);
      },
      getPrototypeOf() {
        byteTrapCalls += 1;
        throw new Error(RAW_MARKER);
      },
    });
    const proxyResultHarness = makeReaderIo(bytes, {
      read: () => hostileBytes as unknown as Uint8Array,
    });
    return exactReaderRefusal(
      'WORKSPACE_SNAPSHOT_READ_FAILED',
      () => readWorkspaceSnapshotSource(readerInput(), invalidResultHarness.io),
      [RAW_MARKER],
    )
      && invalidResultHarness.closeCount === 1
      && exactReaderRefusal(
        'WORKSPACE_SNAPSHOT_READ_FAILED',
        () => readWorkspaceSnapshotSource(readerInput(), proxyResultHarness.io),
        [RAW_MARKER],
      )
      && proxyResultHarness.closeCount === 1
      && byteTrapCalls === 0;
  }));

  checks.push(check('reader_propagates_fixed_decode_failures_without_raw_values', () => {
    const invalidUtf8 = new Uint8Array([0xe2, 0x28, 0xa1]);
    const malformedJson = new TextEncoder().encode(`{"savedAt":"${RAW_MARKER}"`);
    const invalidEnvelope = validEnvelopeBytes({ name: '' });
    const utf8Harness = makeReaderIo(invalidUtf8);
    const jsonHarness = makeReaderIo(malformedJson);
    const envelopeHarness = makeReaderIo(invalidEnvelope);
    return exactReaderRefusal(
      'WORKSPACE_SNAPSHOT_UTF8_INVALID',
      () => readWorkspaceSnapshotSource(readerInput(), utf8Harness.io),
      [RAW_MARKER],
    )
      && exactReaderRefusal(
        'WORKSPACE_SNAPSHOT_JSON_INVALID',
        () => readWorkspaceSnapshotSource(readerInput(), jsonHarness.io),
        [RAW_MARKER],
      )
      && exactReaderRefusal(
        'WORKSPACE_SNAPSHOT_VALUE_UNSAFE',
        () => readWorkspaceSnapshotSource(readerInput(), envelopeHarness.io),
      )
      && utf8Harness.closeCount === 1
      && jsonHarness.closeCount === 1
      && envelopeHarness.closeCount === 1;
  }));

  checks.push(check('reader_final_containment_change_is_source_changed', () => {
    const bytes = validEnvelopeBytes();
    const escape = path.resolve(READER_ROOT, '..', 'reader-final-escape');
    const harness = makeReaderIo(bytes, {
      realpath: (value, callNumber, defaultValue) => readerPathKey(value) === readerPathKey(READER_TARGET_PATH)
        && callNumber === 2
        ? escape
        : defaultValue,
    });
    return exactReaderRefusal(
      'WORKSPACE_SNAPSHOT_SOURCE_CHANGED',
      () => readWorkspaceSnapshotSource(readerInput(), harness.io),
    )
      && harness.openCount === 1
      && harness.closeCount === 1;
  }));

  checks.push(check('reader_refusals_redact_paths_bytes_and_os_errors', () => {
    const bytes = validEnvelopeBytes({
      name: RAW_PATH_MARKER,
      workspace: {
        ...envelopeWorkspace(),
        sourceFolder: RAW_PATH_MARKER,
      },
      [RAW_MARKER]: RAW_BYTES_MARKER,
    });
    const rawByteText = new TextDecoder().decode(bytes);
    const rawByteHex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
    const harness = makeReaderIo(bytes);
    return exactReaderRefusal(
      'WORKSPACE_SNAPSHOT_ENVELOPE_INVALID',
      () => readWorkspaceSnapshotSource(readerInput(), harness.io),
      [RAW_MARKER, RAW_PATH_MARKER, RAW_BYTES_MARKER, rawByteText, rawByteHex],
    );
  }));

  return summarize(checks);
}

const invokedDirectly = path.basename(process.argv[1] ?? '') === 'workspaceSnapshotSource.selftest.ts';
if (invokedDirectly) {
  try {
    const result = runWorkspaceSnapshotSourceSelftest();
    console.log(JSON.stringify(result));
    if (!result.allPassed) process.exitCode = 1;
  } catch {
    console.log(JSON.stringify({
      pass: false,
      allPassed: false,
      passed: 0,
      total: 1,
      checks: [{ name: 'selftest_runner', pass: false }],
    }));
    process.exitCode = 1;
  }
}
