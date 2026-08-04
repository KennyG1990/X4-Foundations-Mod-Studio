/**
 * W3B1a pure workspace/CAS receipt facts.
 *
 * These helpers expose only logical resource identities and complete receipt hashes.  They do
 * not sanitize, persist, read, or write a workspace; the caller supplies the already-sanitized
 * workspace and the already-authoritative registry records.
 */

import { createHash } from 'node:crypto';

import {
  canonicalJson,
  type ActionReceiptAfter,
  type ReceiptAfterOutcome as ActionReceiptAfterOutcome,
  type ActionReceiptResourceAuthority,
} from './actionReceipt';
import { hashBoundedReceiptFacts, ActionReceiptRuntimeError } from './actionReceiptRuntime';
import {
  workspaceContentReceiptHash,
  workspaceSnapshotReceiptHash,
} from './workspaceReceiptHash';

const WORKSPACE_ID_RE = /^ws_[a-f0-9]{24}$/i;
const HASH_RE = /^[a-f0-9]{64}$/;
const LEGACY_HEAD_RE = /^[a-f0-9]{16}$/;
const LOGICAL_ID_RE = /^[a-zA-Z][a-zA-Z0-9._:-]{0,127}$/;
const ROUTE_KEY_RE = /^(?:GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD) \/api\/[a-zA-Z0-9][a-zA-Z0-9._~:/=-]{0,191}$/;
const MODE_RE = /^[a-zA-Z][a-zA-Z0-9._:-]{0,63}$/;
const CREDENTIAL_SHAPED_RE = /(?:bearer\s+|x4fk_|sk-|pk-|rk-|ghp_|github_pat_|AIza|-----BEGIN [^-]*PRIVATE KEY-----|(?:api[_-]?key|authorization|credential|password|passwd|secret|token)\s*[:=])/i;
const ABSOLUTE_PATH_RE = /^(?:[a-zA-Z]:[\\/]|\\\\|\/)/;
const WORKSPACE_RESOURCE_ROOT = 'workspace' as const;
const REGISTRY_RESOURCE_ROOT = 'workspace-registry' as const;
const REGISTRY_RESOURCE_ROLE = 'data' as const;
const REGISTRY_MAX_RECORDS = 128;

export type WorkspaceActionReceiptErrorCode =
  | 'WORKSPACE_ACTION_RECEIPT_INPUT_INVALID'
  | 'WORKSPACE_ACTION_RECEIPT_ID_INVALID'
  | 'WORKSPACE_ACTION_RECEIPT_HASH_INVALID'
  | 'WORKSPACE_ACTION_RECEIPT_RESOURCE_INVALID'
  | 'WORKSPACE_ACTION_RECEIPT_RESOURCE_MISMATCH'
  | 'WORKSPACE_ACTION_RECEIPT_OUTCOME_INVALID'
  | 'WORKSPACE_ACTION_RECEIPT_NO_CHANGE_MISMATCH'
  | 'WORKSPACE_ACTION_RECEIPT_REGISTRY_INVALID'
  | 'WORKSPACE_ACTION_RECEIPT_REGISTRY_DUPLICATE'
  | 'WORKSPACE_ACTION_RECEIPT_REGISTRY_DEFAULT_MISSING'
  | 'WORKSPACE_ACTION_RECEIPT_REQUEST_FACTS_INVALID'
  | 'WORKSPACE_ACTION_RECEIPT_REQUEST_FACTS_UNKNOWN'
  | (string & {});

/** Stable, route-mappable workspace authority error.  No caller value is interpolated. */
export class WorkspaceActionReceiptError extends ActionReceiptRuntimeError {
  readonly code: WorkspaceActionReceiptErrorCode;

  constructor(code: WorkspaceActionReceiptErrorCode, message = 'Workspace action-receipt input was refused.') {
    super(code, message);
    this.name = 'WorkspaceActionReceiptError';
    this.code = code;
  }
}

export interface WorkspaceRegistryReceiptRecord {
  workspaceId: string;
  /** Existing registry field; this is deliberately retained as the legacy 16-hex CAS head. */
  head?: string;
  legacyHead?: string;
  version: number;
  createdAt: string;
  savedAt: string;
  origin: string;
  /** Existing WorkspaceRecord shape may supply the sanitized workspace for hash derivation. */
  workspace?: unknown;
  contentReceiptHash?: string;
  snapshotReceiptHash?: string;
  workspaceContentReceiptHash?: string;
  workspaceSnapshotReceiptHash?: string;
  schema?: number;
}

export interface WorkspaceActionRequestFacts {
  routeKey: string;
  mode: string;
  expectedHead?: string;
  expectedSnapshotHash?: string;
  expectedVersion?: number;
  force?: boolean;
  dryRun?: boolean;
  proposedContentHash?: string;
  proposedSnapshotHash?: string;
  sourceHash?: string;
}

type PlainRecord = Record<string, unknown>;

function fail(code: WorkspaceActionReceiptErrorCode, message?: string): never {
  throw new WorkspaceActionReceiptError(code, message);
}

function isPlainObject(value: unknown): value is PlainRecord {
  if (value === null || typeof value !== 'object') return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasOwn(value: PlainRecord, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function ownEnumerableKeys(value: PlainRecord, code: WorkspaceActionReceiptErrorCode): string[] {
  if (Object.getOwnPropertySymbols(value).length > 0) fail(code);
  const names = Object.getOwnPropertyNames(value);
  const keys = Object.keys(value);
  if (names.length !== keys.length) fail(code);
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !('value' in descriptor)) fail(code);
  }
  return keys;
}

function requireExactKeys(value: PlainRecord, allowed: ReadonlySet<string>, code: WorkspaceActionReceiptErrorCode): void {
  for (const key of ownEnumerableKeys(value, code)) {
    if (!allowed.has(key)) fail(code);
  }
}

function requireSafeText(value: unknown, code: WorkspaceActionReceiptErrorCode, max: number): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > max || hasControlCharacter(value)) fail(code);
  if (CREDENTIAL_SHAPED_RE.test(value)) fail(code);
  return value;
}

function hasControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

function requireWorkspaceId(value: unknown): string {
  const id = requireSafeText(value, 'WORKSPACE_ACTION_RECEIPT_ID_INVALID', 27);
  if (!WORKSPACE_ID_RE.test(id)) fail('WORKSPACE_ACTION_RECEIPT_ID_INVALID');
  return id;
}

function requireFullHash(value: unknown): string {
  if (typeof value !== 'string' || !HASH_RE.test(value)) fail('WORKSPACE_ACTION_RECEIPT_HASH_INVALID');
  return value;
}

function requireLegacyHead(value: unknown): string {
  if (typeof value !== 'string' || !LEGACY_HEAD_RE.test(value)) fail('WORKSPACE_ACTION_RECEIPT_REGISTRY_INVALID');
  return value;
}

function requireRelativePath(value: unknown): string {
  const path = requireSafeText(value, 'WORKSPACE_ACTION_RECEIPT_RESOURCE_INVALID', 512);
  if (path.includes('\\') || path.startsWith('/') || /^[a-zA-Z]:($|[\\/])/.test(path) || path.startsWith('\\')) {
    fail('WORKSPACE_ACTION_RECEIPT_RESOURCE_INVALID');
  }
  if (path.split('/').some(segment => segment.length === 0 || segment === '.' || segment === '..')) {
    fail('WORKSPACE_ACTION_RECEIPT_RESOURCE_INVALID');
  }
  return path;
}

function resourceIdentity(resource: Pick<ActionReceiptResourceAuthority, 'role' | 'root' | 'relativePath'>): string {
  return `${resource.role}\u0000${resource.root}\u0000${resource.relativePath}`;
}

function compareResource(left: ActionReceiptResourceAuthority, right: ActionReceiptResourceAuthority): number {
  const leftKey = `${left.role}\u0000${left.root}\u0000${left.relativePath}`;
  const rightKey = `${right.role}\u0000${right.root}\u0000${right.relativePath}`;
  return leftKey === rightKey ? 0 : leftKey < rightKey ? -1 : 1;
}

function computeWorkspaceReceiptHashes(sanitizedWorkspace: unknown): { content: string; snapshot: string } {
  if (!isPlainObject(sanitizedWorkspace)) fail('WORKSPACE_ACTION_RECEIPT_INPUT_INVALID');
  try {
    const content = workspaceContentReceiptHash(sanitizedWorkspace as never);
    const snapshot = workspaceSnapshotReceiptHash(sanitizedWorkspace as never);
    requireFullHash(content);
    requireFullHash(snapshot);
    return { content, snapshot };
  } catch (error) {
    if (error instanceof WorkspaceActionReceiptError) throw error;
    fail('WORKSPACE_ACTION_RECEIPT_INPUT_INVALID');
  }
}

function workspaceResourceList(workspaceId: string, hashes: { content: string; snapshot: string }): ActionReceiptResourceAuthority[] {
  const resources: ActionReceiptResourceAuthority[] = [
    {
      role: 'workspace',
      root: WORKSPACE_RESOURCE_ROOT,
      relativePath: `${workspaceId}/content`,
      beforeHash: hashes.content,
    },
    {
      role: 'snapshot',
      root: WORKSPACE_RESOURCE_ROOT,
      relativePath: `${workspaceId}/snapshot`,
      beforeHash: hashes.snapshot,
    },
  ];
  return resources.sort(compareResource);
}

function normalizeWorkspaceResources(value: unknown): ActionReceiptResourceAuthority[] {
  if (!Array.isArray(value) || value.length !== 2) fail('WORKSPACE_ACTION_RECEIPT_RESOURCE_INVALID');
  const resources = value.map(entry => {
    if (!isPlainObject(entry)) fail('WORKSPACE_ACTION_RECEIPT_RESOURCE_INVALID');
    requireExactKeys(entry, new Set(['role', 'root', 'relativePath', 'beforeHash']), 'WORKSPACE_ACTION_RECEIPT_RESOURCE_INVALID');
    if (entry.role !== 'workspace' && entry.role !== 'snapshot') fail('WORKSPACE_ACTION_RECEIPT_RESOURCE_INVALID');
    if (entry.root !== WORKSPACE_RESOURCE_ROOT) fail('WORKSPACE_ACTION_RECEIPT_RESOURCE_INVALID');
    const relativePath = requireRelativePath(entry.relativePath);
    const beforeHash = requireFullHash(entry.beforeHash);
    return {
      role: entry.role as 'workspace' | 'snapshot',
      root: WORKSPACE_RESOURCE_ROOT,
      relativePath,
      beforeHash,
    } satisfies ActionReceiptResourceAuthority;
  });
  const identities = new Set(resources.map(resourceIdentity));
  if (identities.size !== 2) fail('WORKSPACE_ACTION_RECEIPT_RESOURCE_INVALID');
  const ids = resources.map(resource => {
    const match = /^(ws_[a-f0-9]{24})\/(content|snapshot)$/i.exec(resource.relativePath);
    if (!match) fail('WORKSPACE_ACTION_RECEIPT_RESOURCE_INVALID');
    if ((resource.role === 'workspace' && match[2] !== 'content') || (resource.role === 'snapshot' && match[2] !== 'snapshot')) {
      fail('WORKSPACE_ACTION_RECEIPT_RESOURCE_MISMATCH');
    }
    return match[1];
  });
  if (ids[0].toLowerCase() !== ids[1].toLowerCase()) fail('WORKSPACE_ACTION_RECEIPT_RESOURCE_MISMATCH');
  const hasWorkspace = resources.some(resource => resource.role === 'workspace');
  const hasSnapshot = resources.some(resource => resource.role === 'snapshot');
  if (!hasWorkspace || !hasSnapshot) fail('WORKSPACE_ACTION_RECEIPT_RESOURCE_MISMATCH');
  return resources.sort(compareResource);
}

function workspaceIdFromResources(resources: readonly ActionReceiptResourceAuthority[]): string {
  const match = /^((?:ws_[a-f0-9]{24}))\/(?:content|snapshot)$/i.exec(resources[0]?.relativePath ?? '');
  if (!match) fail('WORKSPACE_ACTION_RECEIPT_RESOURCE_INVALID');
  return requireWorkspaceId(match[1]);
}

/** Build the paired complete content/snapshot pre-state resources for one immutable workspace. */
export function workspaceReceiptResources(
  workspaceId: string,
  sanitizedWorkspace: unknown,
): ActionReceiptResourceAuthority[] {
  const id = requireWorkspaceId(workspaceId);
  return workspaceResourceList(id, computeWorkspaceReceiptHashes(sanitizedWorkspace));
}

function parseAfterOptions(
  outcomeOrOptions: ActionReceiptAfterOutcome | { outcome?: ActionReceiptAfterOutcome; code?: string } | undefined,
  code: string | undefined,
): { outcome?: ActionReceiptAfterOutcome; code?: string } {
  if (outcomeOrOptions === undefined) return { code };
  if (typeof outcomeOrOptions === 'string') return { outcome: outcomeOrOptions, code };
  if (!isPlainObject(outcomeOrOptions)) fail('WORKSPACE_ACTION_RECEIPT_OUTCOME_INVALID');
  requireExactKeys(outcomeOrOptions, new Set(['outcome', 'code']), 'WORKSPACE_ACTION_RECEIPT_OUTCOME_INVALID');
  return { outcome: outcomeOrOptions.outcome as ActionReceiptAfterOutcome | undefined, code: outcomeOrOptions.code as string | undefined };
}

function validateOutcome(value: unknown): ActionReceiptAfterOutcome | undefined {
  if (value === undefined) return undefined;
  if (value !== 'applied' && value !== 'no_change' && value !== 'partial') fail('WORKSPACE_ACTION_RECEIPT_OUTCOME_INVALID');
  return value;
}

function optionalCode(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  const code = requireSafeText(value, 'WORKSPACE_ACTION_RECEIPT_OUTCOME_INVALID', 128);
  if (!LOGICAL_ID_RE.test(code)) fail('WORKSPACE_ACTION_RECEIPT_OUTCOME_INVALID');
  return code;
}

/** Build the exact paired after-state resources and enforce truthful no-change semantics. */
export function workspaceReceiptAfter(
  resources: unknown,
  sanitizedWorkspace: unknown,
  outcomeOrOptions?: ActionReceiptAfterOutcome | { outcome?: ActionReceiptAfterOutcome; code?: string },
  code?: string,
): ActionReceiptAfter {
  const before = normalizeWorkspaceResources(resources);
  const workspaceId = workspaceIdFromResources(before);
  const after = workspaceResourceList(workspaceId, computeWorkspaceReceiptHashes(sanitizedWorkspace));
  if (before.some((resource, index) => resourceIdentity(resource) !== resourceIdentity(after[index]))) {
    fail('WORKSPACE_ACTION_RECEIPT_RESOURCE_MISMATCH');
  }
  const options = parseAfterOptions(outcomeOrOptions, code);
  const outcome = validateOutcome(options.outcome)
    ?? (after.every((resource, index) => resource.beforeHash === before[index].beforeHash) ? 'no_change' : 'applied');
  if (outcome === 'no_change' && after.some((resource, index) => resource.beforeHash !== before[index].beforeHash)) {
    fail('WORKSPACE_ACTION_RECEIPT_NO_CHANGE_MISMATCH');
  }
  const output: ActionReceiptAfter = {
    outcome,
    resources: after.map(resource => ({
      role: resource.role,
      root: resource.root,
      relativePath: resource.relativePath,
      hash: resource.beforeHash!,
    })),
  };
  const afterCode = optionalCode(options.code);
  if (afterCode !== undefined) output.code = afterCode;
  return output;
}

function safeStructuralText(value: unknown): string {
  const text = requireSafeText(value, 'WORKSPACE_ACTION_RECEIPT_REGISTRY_INVALID', 256);
  if (ABSOLUTE_PATH_RE.test(text)) fail('WORKSPACE_ACTION_RECEIPT_REGISTRY_INVALID');
  return text;
}

function readConsistentAlias(record: PlainRecord, names: readonly string[]): unknown {
  const present = names.filter(name => hasOwn(record, name));
  if (present.length === 0) return undefined;
  const first = record[present[0]];
  if (first === undefined || present.some(name => record[name] === undefined || record[name] !== first)) {
    fail('WORKSPACE_ACTION_RECEIPT_REGISTRY_INVALID');
  }
  return first;
}

function deriveRecordHashes(record: PlainRecord): { contentHash: string; snapshotHash: string } {
  const explicitContent = readConsistentAlias(record, [
    'contentReceiptHash', 'workspaceContentReceiptHash',
  ]);
  const explicitSnapshot = readConsistentAlias(record, [
    'snapshotReceiptHash', 'workspaceSnapshotReceiptHash',
  ]);
  if (explicitContent !== undefined || explicitSnapshot !== undefined) {
    if (explicitContent === undefined || explicitSnapshot === undefined) fail('WORKSPACE_ACTION_RECEIPT_REGISTRY_INVALID');
    return { contentHash: requireFullHash(explicitContent), snapshotHash: requireFullHash(explicitSnapshot) };
  }
  if (!hasOwn(record, 'workspace') || !isPlainObject(record.workspace)) fail('WORKSPACE_ACTION_RECEIPT_REGISTRY_INVALID');
  const hashes = computeWorkspaceReceiptHashes(record.workspace);
  return { contentHash: hashes.content, snapshotHash: hashes.snapshot };
}

interface NormalizedRegistryRecord {
  workspaceId: string;
  contentHash: string;
  snapshotHash: string;
  legacyHead: string;
  version: number;
  createdAt: string;
  savedAt: string;
  origin: string;
}

function normalizeRegistryRecord(value: unknown): NormalizedRegistryRecord {
  if (!isPlainObject(value)) fail('WORKSPACE_ACTION_RECEIPT_REGISTRY_INVALID');
  requireExactKeys(
    value,
    new Set([
      'workspaceId', 'head', 'legacyHead', 'version', 'createdAt', 'savedAt', 'origin', 'workspace',
      'contentReceiptHash', 'snapshotReceiptHash', 'workspaceContentReceiptHash',
      'workspaceSnapshotReceiptHash', 'schema',
    ]),
    'WORKSPACE_ACTION_RECEIPT_REGISTRY_INVALID',
  );
  if (hasOwn(value, 'schema') && value.schema !== 1) fail('WORKSPACE_ACTION_RECEIPT_REGISTRY_INVALID');
  const workspaceId = requireWorkspaceId(value.workspaceId);
  const legacyHead = readConsistentAlias(value, ['head', 'legacyHead']);
  if (legacyHead === undefined) fail('WORKSPACE_ACTION_RECEIPT_REGISTRY_INVALID');
  const version = value.version;
  if (typeof version !== 'number' || !Number.isSafeInteger(version) || version < 0) fail('WORKSPACE_ACTION_RECEIPT_REGISTRY_INVALID');
  const createdAt = safeStructuralText(value.createdAt);
  const savedAt = safeStructuralText(value.savedAt);
  const origin = safeStructuralText(value.origin);
  const hashes = deriveRecordHashes(value);
  return {
    workspaceId,
    contentHash: hashes.contentHash,
    snapshotHash: hashes.snapshotHash,
    legacyHead: requireLegacyHead(legacyHead),
    version,
    createdAt,
    savedAt,
    origin,
  };
}

function normalizeRegistrySnapshot(defaultWorkspaceId: unknown, records: unknown): { defaultWorkspaceId: string; records: NormalizedRegistryRecord[] } {
  const defaultId = requireWorkspaceId(defaultWorkspaceId);
  if (!Array.isArray(records) || records.length === 0 || records.length > REGISTRY_MAX_RECORDS) {
    fail('WORKSPACE_ACTION_RECEIPT_REGISTRY_INVALID');
  }
  const normalized = records.map(normalizeRegistryRecord);
  const ids = new Set(normalized.map(record => record.workspaceId.toLowerCase()));
  if (ids.size !== normalized.length) fail('WORKSPACE_ACTION_RECEIPT_REGISTRY_DUPLICATE');
  if (!ids.has(defaultId.toLowerCase())) fail('WORKSPACE_ACTION_RECEIPT_REGISTRY_DEFAULT_MISSING');
  normalized.sort((left, right) => {
    if (left.workspaceId === right.workspaceId) return 0;
    return left.workspaceId < right.workspaceId ? -1 : 1;
  });
  return { defaultWorkspaceId: defaultId, records: normalized };
}

function hashCanonical(value: unknown): string {
  let canonical: string;
  try {
    canonical = canonicalJson(value);
  } catch {
    fail('WORKSPACE_ACTION_RECEIPT_REGISTRY_INVALID');
  }
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

/** Hash the sorted structural registry snapshot without serializing workspace payloads/paths. */
export function workspaceRegistryReceiptHash(defaultWorkspaceId: string, records: unknown): string {
  const snapshot = normalizeRegistrySnapshot(defaultWorkspaceId, records);
  return hashCanonical(snapshot);
}

function normalizeRegistryResource(value: unknown): ActionReceiptResourceAuthority {
  if (!isPlainObject(value)) fail('WORKSPACE_ACTION_RECEIPT_RESOURCE_INVALID');
  requireExactKeys(value, new Set(['role', 'root', 'relativePath', 'beforeHash']), 'WORKSPACE_ACTION_RECEIPT_RESOURCE_INVALID');
  if (value.role !== REGISTRY_RESOURCE_ROLE || value.root !== REGISTRY_RESOURCE_ROOT || value.relativePath !== 'registry') {
    fail('WORKSPACE_ACTION_RECEIPT_RESOURCE_MISMATCH');
  }
  return {
    role: REGISTRY_RESOURCE_ROLE,
    root: REGISTRY_RESOURCE_ROOT,
    relativePath: 'registry',
    beforeHash: requireFullHash(value.beforeHash),
  };
}

/** Build the single aggregate resource for the workspace registry authority. */
export function workspaceRegistryReceiptResource(
  defaultWorkspaceId: string,
  records: unknown,
): ActionReceiptResourceAuthority {
  return {
    role: REGISTRY_RESOURCE_ROLE,
    root: REGISTRY_RESOURCE_ROOT,
    relativePath: 'registry',
    beforeHash: workspaceRegistryReceiptHash(defaultWorkspaceId, records),
  };
}

/** Direct after-resource form for adapters that do not need the lifecycle outcome wrapper. */
export function workspaceRegistryReceiptAfterResource(
  resource: unknown,
  defaultWorkspaceId: string,
  records: unknown,
): { role: 'data'; root: typeof REGISTRY_RESOURCE_ROOT; relativePath: 'registry'; hash: string } {
  normalizeRegistryResource(resource);
  return {
    role: REGISTRY_RESOURCE_ROLE,
    root: REGISTRY_RESOURCE_ROOT,
    relativePath: 'registry',
    hash: workspaceRegistryReceiptHash(defaultWorkspaceId, records),
  };
}

/** Build the matching one-resource after-state and enforce truthful no-change semantics. */
export function workspaceRegistryReceiptAfter(
  resource: unknown,
  defaultWorkspaceId: string,
  records: unknown,
  outcomeOrOptions?: ActionReceiptAfterOutcome | { outcome?: ActionReceiptAfterOutcome; code?: string },
  code?: string,
): ActionReceiptAfter {
  const before = normalizeRegistryResource(resource);
  const afterHash = workspaceRegistryReceiptHash(defaultWorkspaceId, records);
  const options = parseAfterOptions(outcomeOrOptions, code);
  const outcome = validateOutcome(options.outcome) ?? (afterHash === before.beforeHash ? 'no_change' : 'applied');
  if (outcome === 'no_change' && afterHash !== before.beforeHash) fail('WORKSPACE_ACTION_RECEIPT_NO_CHANGE_MISMATCH');
  const output: ActionReceiptAfter = {
    outcome,
    resources: [{ role: before.role, root: before.root, relativePath: before.relativePath, hash: afterHash }],
  };
  const afterCode = optionalCode(options.code);
  if (afterCode !== undefined) output.code = afterCode;
  return output;
}

const REQUEST_ALLOWED_KEYS = new Set([
  'routeKey', 'mode', 'expectedHead', 'expectedLegacyHead', 'expectedSnapshotHash',
  'expectedVersion', 'expectedLegacyVersion', 'force', 'dryRun', 'proposedContentHash',
  'proposedContentReceiptHash', 'proposedSnapshotHash', 'proposedSnapshotReceiptHash',
  'sourceHash', 'sourceFullHash',
]);

function readRequestAlias(value: PlainRecord, names: readonly string[]): unknown {
  const present = names.filter(name => hasOwn(value, name));
  if (present.length === 0) return undefined;
  const first = value[present[0]];
  if (first === undefined || present.some(name => value[name] === undefined || value[name] !== first)) {
    fail('WORKSPACE_ACTION_RECEIPT_REQUEST_FACTS_INVALID');
  }
  return first;
}

function requestOptionalHash(value: unknown, full: boolean): string {
  if (full) return requireFullHash(value);
  if (typeof value !== 'string' || !LEGACY_HEAD_RE.test(value)) fail('WORKSPACE_ACTION_RECEIPT_REQUEST_FACTS_INVALID');
  return value;
}

/** Hash only the bounded, schema-approved W3B1a request facts; raw request data is refused. */
export function hashWorkspaceActionRequestFacts(facts: unknown): string {
  if (!isPlainObject(facts)) fail('WORKSPACE_ACTION_RECEIPT_REQUEST_FACTS_INVALID');
  requireExactKeys(facts, REQUEST_ALLOWED_KEYS, 'WORKSPACE_ACTION_RECEIPT_REQUEST_FACTS_UNKNOWN');
  const routeKey = requireSafeText(facts.routeKey, 'WORKSPACE_ACTION_RECEIPT_REQUEST_FACTS_INVALID', 192);
  if (!ROUTE_KEY_RE.test(routeKey)) fail('WORKSPACE_ACTION_RECEIPT_REQUEST_FACTS_INVALID');
  const mode = requireSafeText(facts.mode, 'WORKSPACE_ACTION_RECEIPT_REQUEST_FACTS_INVALID', 64);
  if (!MODE_RE.test(mode)) fail('WORKSPACE_ACTION_RECEIPT_REQUEST_FACTS_INVALID');

  const normalized: WorkspaceActionRequestFacts = { routeKey, mode };
  const expectedHead = readRequestAlias(facts, ['expectedHead', 'expectedLegacyHead']);
  if (expectedHead !== undefined) normalized.expectedHead = requestOptionalHash(expectedHead, false);
  if (hasOwn(facts, 'expectedSnapshotHash')) normalized.expectedSnapshotHash = requestOptionalHash(facts.expectedSnapshotHash, true);
  const expectedVersion = readRequestAlias(facts, ['expectedVersion', 'expectedLegacyVersion']);
  if (expectedVersion !== undefined) {
    if (typeof expectedVersion !== 'number' || !Number.isSafeInteger(expectedVersion) || expectedVersion < 0) {
      fail('WORKSPACE_ACTION_RECEIPT_REQUEST_FACTS_INVALID');
    }
    normalized.expectedVersion = expectedVersion;
  }
  for (const key of ['force', 'dryRun'] as const) {
    if (hasOwn(facts, key)) {
      if (typeof facts[key] !== 'boolean') fail('WORKSPACE_ACTION_RECEIPT_REQUEST_FACTS_INVALID');
      normalized[key] = facts[key] as boolean;
    }
  }

  const proposedContentHash = readRequestAlias(facts, ['proposedContentHash', 'proposedContentReceiptHash']);
  const proposedSnapshotHash = readRequestAlias(facts, ['proposedSnapshotHash', 'proposedSnapshotReceiptHash']);
  if ((proposedContentHash === undefined) !== (proposedSnapshotHash === undefined)) {
    fail('WORKSPACE_ACTION_RECEIPT_REQUEST_FACTS_INVALID');
  }
  if (proposedContentHash !== undefined && proposedSnapshotHash !== undefined) {
    normalized.proposedContentHash = requestOptionalHash(proposedContentHash, true);
    normalized.proposedSnapshotHash = requestOptionalHash(proposedSnapshotHash, true);
  }
  const sourceHash = readRequestAlias(facts, ['sourceHash', 'sourceFullHash']);
  if (sourceHash !== undefined) normalized.sourceHash = requestOptionalHash(sourceHash, true);
  return hashBoundedReceiptFacts(normalized);
}

export const WORKSPACE_RECEIPT_RESOURCE_ROOT = WORKSPACE_RESOURCE_ROOT;
export const WORKSPACE_REGISTRY_RECEIPT_RESOURCE_ROOT = REGISTRY_RESOURCE_ROOT;
export const WORKSPACE_REGISTRY_RECEIPT_RESOURCE_ROLE = REGISTRY_RESOURCE_ROLE;
