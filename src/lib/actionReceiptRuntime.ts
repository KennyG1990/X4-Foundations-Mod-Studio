/**
 * W3B1a pure runtime seams for action-receipt authority.
 *
 * This module deliberately has no route, store, filesystem, browser, or configuration
 * dependency.  It turns the runtime identities and bounded facts owned by later adapters into
 * the narrow, canonical values accepted by the W3A receipt builder.
 */

import { createHash } from 'node:crypto';

import {
  canonicalJson,
  createPreparedActionReceipt,
  type ActionReceiptClient,
  type ActionReceiptPrepareInput,
  type ActionReceiptResourceAuthority,
} from './actionReceipt';

// Keep the import type-only boundary honest: the resolver type is declared in its own module,
// not re-exported by actionReceipt.ts.  The local type alias below is used by the public API.
import type { ActionReceiptCoverageResolverResult as CoverageResolverResult } from './actionReceiptCoverage';

export const RECEIPT_FACTS_MAX_DEPTH = 8;
export const RECEIPT_FACTS_MAX_NODES = 512;
export const RECEIPT_FACTS_MAX_KEYS = 256;
export const RECEIPT_FACTS_MAX_ARRAY_ITEMS = 128;
export const RECEIPT_FACTS_MAX_STRING_BYTES = 4096;
export const RECEIPT_FACTS_MAX_BYTES = 32 * 1024;
export const RECEIPT_RESOURCE_MAX_COUNT = 128;

const HASH_RE = /^[a-f0-9]{64}$/;
const LEGACY_LOGICAL_ID_RE = /^[a-zA-Z][a-zA-Z0-9._:-]{0,127}$/;
const VERSION_RE = /^[a-zA-Z0-9][a-zA-Z0-9._+-]{0,63}$/;
const STUDIO_CLIENT_ID_RE = /^client_[a-z0-9_-]{8,80}$/i;
const AGENT_KEY_ID_RE = /^key_[a-zA-Z0-9._:-]{1,123}$/;
const ROOT_RE = /^[a-z][a-z0-9._-]{0,63}$/;
const CREDENTIAL_SHAPED_RE = /(?:bearer\s+|x4fk_|sk-|pk-|rk-|ghp_|github_pat_|AIza|-----BEGIN [^-]*PRIVATE KEY-----|(?:api[_-]?key|authorization|credential|password|passwd|secret|token)\s*[:=])/i;
const RESOURCE_ROLES = new Set([
  'workspace', 'profile', 'project', 'data', 'deploy', 'artifact', 'snapshot', 'config', 'game',
  'file', 'directory', 'other',
]);

export type ActionReceiptRuntimeErrorCode =
  | 'ACTION_RECEIPT_RUNTIME_INPUT_INVALID'
  | 'ACTION_RECEIPT_RUNTIME_IDENTITY_INVALID'
  | 'ACTION_RECEIPT_RUNTIME_IDENTITY_MISSING'
  | 'ACTION_RECEIPT_RUNTIME_CHANNEL_UNSUPPORTED'
  | 'ACTION_RECEIPT_RUNTIME_CLIENT_ID_INVALID'
  | 'ACTION_RECEIPT_RUNTIME_KEY_ID_INVALID'
  | 'ACTION_RECEIPT_RUNTIME_VERSION_INVALID'
  | 'ACTION_RECEIPT_RUNTIME_FACTS_INVALID'
  | 'ACTION_RECEIPT_RUNTIME_FACTS_LIMIT'
  | 'ACTION_RECEIPT_RUNTIME_RESOURCE_INVALID'
  | 'ACTION_RECEIPT_RUNTIME_RESOURCE_HASH_INVALID'
  | 'ACTION_RECEIPT_RUNTIME_RESOURCE_DUPLICATE'
  | 'ACTION_RECEIPT_RUNTIME_RECOVERY_INVALID'
  | 'ACTION_RECEIPT_RUNTIME_RECOVERY_UNSTABLE'
  | (string & {});

/** Stable, route-mappable error surface.  Messages intentionally contain no caller values. */
export class ActionReceiptRuntimeError extends Error {
  readonly code: ActionReceiptRuntimeErrorCode;

  constructor(code: ActionReceiptRuntimeErrorCode, message = 'Action-receipt runtime input was refused.') {
    super(message);
    this.name = 'ActionReceiptRuntimeError';
    this.code = code;
  }
}

export interface RuntimeReceiptIdentity {
  actor: {
    kind: 'human' | 'agent';
    id: string;
  };
  client: ActionReceiptClient;
}

/**
 * The normal adapter shape is `{ kind, clientId, keyId?, version }`.  The runtime parser also
 * accepts `source` and a channel discriminator so an adapter can pass its already-separated
 * source without manufacturing an actor label.  All other fields are refused.
 */
export type RuntimeReceiptIdentityInput = Record<string, unknown>;

type PlainRecord = Record<string, unknown>;

function isPlainObject(value: unknown): value is PlainRecord {
  if (value === null || typeof value !== 'object') return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function fail(code: ActionReceiptRuntimeErrorCode, message?: string): never {
  throw new ActionReceiptRuntimeError(code, message);
}

function hasOwn(value: PlainRecord, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function ownEnumerableKeys(value: PlainRecord, code: ActionReceiptRuntimeErrorCode): string[] {
  const symbols = Object.getOwnPropertySymbols(value);
  if (symbols.length > 0) fail(code);
  const names = Object.getOwnPropertyNames(value);
  const keys = Object.keys(value);
  if (names.length !== keys.length) fail(code);
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !('value' in descriptor)) fail(code);
  }
  return keys;
}

function requireExactKeys(value: PlainRecord, allowed: ReadonlySet<string>, code: ActionReceiptRuntimeErrorCode): void {
  for (const key of ownEnumerableKeys(value, code)) {
    if (!allowed.has(key)) fail(code);
  }
}

function requireSafeText(value: unknown, code: ActionReceiptRuntimeErrorCode, max: number): string {
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

function requireLogicalId(value: unknown, code: ActionReceiptRuntimeErrorCode): string {
  const text = requireSafeText(value, code, 128);
  if (!LEGACY_LOGICAL_ID_RE.test(text)) fail(code);
  return text;
}

function requireHash(value: unknown, code: ActionReceiptRuntimeErrorCode): string {
  if (typeof value !== 'string' || !HASH_RE.test(value)) fail(code);
  return value;
}

function requireVersion(value: unknown): string {
  const version = requireSafeText(value, 'ACTION_RECEIPT_RUNTIME_VERSION_INVALID', 64);
  if (!VERSION_RE.test(version)) fail('ACTION_RECEIPT_RUNTIME_VERSION_INVALID');
  return version;
}

function requireRoot(value: unknown): string {
  const root = requireSafeText(value, 'ACTION_RECEIPT_RUNTIME_RESOURCE_INVALID', 64);
  if (!ROOT_RE.test(root)) fail('ACTION_RECEIPT_RUNTIME_RESOURCE_INVALID');
  return root;
}

function requireRelativePath(value: unknown): string {
  const path = requireSafeText(value, 'ACTION_RECEIPT_RUNTIME_RESOURCE_INVALID', 512);
  if (
    path.includes('\\')
    || path.startsWith('/')
    || /^[a-zA-Z]:($|[\\/])/.test(path)
    || path.startsWith('\\')
  ) {
    fail('ACTION_RECEIPT_RUNTIME_RESOURCE_INVALID');
  }
  const segments = path.split('/');
  if (segments.some(segment => segment.length === 0 || segment === '.' || segment === '..')) {
    fail('ACTION_RECEIPT_RUNTIME_RESOURCE_INVALID');
  }
  return path;
}

function resourceIdentity(resource: Pick<ActionReceiptResourceAuthority, 'role' | 'root' | 'relativePath'>): string {
  return `${resource.role}\u0000${resource.root}\u0000${resource.relativePath}`;
}

function resourceSortKey(resource: ActionReceiptResourceAuthority): string {
  return `${resource.role}\u0000${resource.root}\u0000${resource.relativePath}\u0000${resource.beforeHash ?? ''}`;
}

function compareOrdinal(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function normalizeBeforeResources(value: unknown): ActionReceiptResourceAuthority[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > RECEIPT_RESOURCE_MAX_COUNT) {
    fail('ACTION_RECEIPT_RUNTIME_RESOURCE_INVALID');
  }
  const seen = new Set<string>();
  const resources = value.map(entry => {
    if (!isPlainObject(entry)) fail('ACTION_RECEIPT_RUNTIME_RESOURCE_INVALID');
    requireExactKeys(entry, new Set(['role', 'root', 'relativePath', 'beforeHash']), 'ACTION_RECEIPT_RUNTIME_RESOURCE_INVALID');
    const role = requireSafeText(entry.role, 'ACTION_RECEIPT_RUNTIME_RESOURCE_INVALID', 32);
    if (!RESOURCE_ROLES.has(role)) fail('ACTION_RECEIPT_RUNTIME_RESOURCE_INVALID');
    const root = requireRoot(entry.root);
    const relativePath = requireRelativePath(entry.relativePath);
    const beforeHash = requireHash(entry.beforeHash, 'ACTION_RECEIPT_RUNTIME_RESOURCE_HASH_INVALID');
    const resource = { role: role as ActionReceiptResourceAuthority['role'], root, relativePath, beforeHash };
    const identity = resourceIdentity(resource);
    if (seen.has(identity)) fail('ACTION_RECEIPT_RUNTIME_RESOURCE_DUPLICATE');
    seen.add(identity);
    return resource;
  });
  return resources.sort((left, right) => compareOrdinal(resourceSortKey(left), resourceSortKey(right)));
}

function identityDiscriminator(value: PlainRecord): 'studio' | 'agent' {
  const candidates: string[] = [];
  for (const key of ['kind', 'source']) {
    if (hasOwn(value, key)) {
      if (typeof value[key] !== 'string') fail('ACTION_RECEIPT_RUNTIME_IDENTITY_INVALID');
      candidates.push(value[key] as string);
    }
  }
  if (hasOwn(value, 'channel')) {
    if (typeof value.channel !== 'string') fail('ACTION_RECEIPT_RUNTIME_CHANNEL_UNSUPPORTED');
    if (value.channel === 'cli') fail('ACTION_RECEIPT_RUNTIME_CHANNEL_UNSUPPORTED');
    if (value.channel === 'studio') candidates.push('studio');
    else if (value.channel === 'api') candidates.push('agent');
    else fail('ACTION_RECEIPT_RUNTIME_CHANNEL_UNSUPPORTED');
  }
  if (candidates.length === 0) fail('ACTION_RECEIPT_RUNTIME_IDENTITY_MISSING');
  if (new Set(candidates).size !== 1) fail('ACTION_RECEIPT_RUNTIME_IDENTITY_INVALID');
  const kind = candidates[0];
  if (kind === 'studio' || kind === 'agent') return kind;
  if (kind === 'cli') fail('ACTION_RECEIPT_RUNTIME_CHANNEL_UNSUPPORTED');
  fail('ACTION_RECEIPT_RUNTIME_IDENTITY_INVALID');
}

function validatedVersion(value: PlainRecord): string {
  const supplied = ['version', 'validatedVersion'].filter(key => hasOwn(value, key));
  if (supplied.length !== 1) fail('ACTION_RECEIPT_RUNTIME_VERSION_INVALID');
  return requireVersion(value[supplied[0]]);
}

/** Map a separated Studio/agent runtime identity into W3A receipt identity. */
export function mapRuntimeReceiptIdentity(input: unknown): RuntimeReceiptIdentity {
  if (!isPlainObject(input)) fail('ACTION_RECEIPT_RUNTIME_INPUT_INVALID');
  const kind = identityDiscriminator(input);
  requireExactKeys(
    input,
    new Set(['kind', 'source', 'channel', 'clientId', 'keyId', 'version', 'validatedVersion']),
    'ACTION_RECEIPT_RUNTIME_IDENTITY_INVALID',
  );
  const version = validatedVersion(input);

  if (kind === 'studio') {
    if (hasOwn(input, 'keyId') || !hasOwn(input, 'clientId')) fail('ACTION_RECEIPT_RUNTIME_IDENTITY_MISSING');
    const clientId = requireSafeText(input.clientId, 'ACTION_RECEIPT_RUNTIME_CLIENT_ID_INVALID', 87);
    if (!STUDIO_CLIENT_ID_RE.test(clientId)) fail('ACTION_RECEIPT_RUNTIME_CLIENT_ID_INVALID');
    return {
      actor: { kind: 'human', id: 'studio' },
      client: { channel: 'studio', id: clientId, version },
    };
  }

  if (hasOwn(input, 'clientId') && input.clientId === undefined) fail('ACTION_RECEIPT_RUNTIME_CLIENT_ID_INVALID');
  if (!hasOwn(input, 'keyId')) fail('ACTION_RECEIPT_RUNTIME_IDENTITY_MISSING');
  const keyId = requireSafeText(input.keyId, 'ACTION_RECEIPT_RUNTIME_KEY_ID_INVALID', 128);
  if (!AGENT_KEY_ID_RE.test(keyId)) fail('ACTION_RECEIPT_RUNTIME_KEY_ID_INVALID');

  let clientId: string;
  if (hasOwn(input, 'clientId')) {
    clientId = requireLogicalId(input.clientId, 'ACTION_RECEIPT_RUNTIME_CLIENT_ID_INVALID');
  } else {
    const digest = createHash('sha256').update(keyId, 'utf8').digest('hex');
    clientId = `agent_${digest.slice(0, 32)}`;
  }
  return {
    actor: { kind: 'agent', id: keyId },
    client: { channel: 'api', id: clientId, version },
  };
}

interface BoundedFactsState {
  nodes: number;
  keys: number;
  arrayItems: number;
  stringBytes: number;
  stack: WeakSet<object>;
}

function boundedFailure(limit = false): never {
  fail(limit ? 'ACTION_RECEIPT_RUNTIME_FACTS_LIMIT' : 'ACTION_RECEIPT_RUNTIME_FACTS_INVALID');
}

function inspectBoundedValue(value: unknown, depth: number, state: BoundedFactsState): void {
  if (depth > RECEIPT_FACTS_MAX_DEPTH) boundedFailure(true);
  state.nodes += 1;
  if (state.nodes > RECEIPT_FACTS_MAX_NODES) boundedFailure(true);

  if (value === null) return;
  switch (typeof value) {
    case 'string':
      state.stringBytes += Buffer.byteLength(value, 'utf8');
      if (value.length > RECEIPT_FACTS_MAX_STRING_BYTES || state.stringBytes > RECEIPT_FACTS_MAX_BYTES) boundedFailure(true);
      return;
    case 'boolean':
      return;
    case 'number':
      if (!Number.isFinite(value)) boundedFailure();
      return;
    case 'undefined':
    case 'function':
    case 'symbol':
    case 'bigint':
      boundedFailure();
      return;
    default:
      break;
  }

  if (typeof value !== 'object') boundedFailure();
  if (state.stack.has(value)) boundedFailure();
  state.stack.add(value);
  try {
    if (Array.isArray(value)) {
      if (value.length > RECEIPT_FACTS_MAX_ARRAY_ITEMS) boundedFailure(true);
      const names = Object.getOwnPropertyNames(value);
      const keys = Object.keys(value);
      if (names.length !== keys.length + 1 || !names.includes('length')) boundedFailure();
      if (Object.getOwnPropertySymbols(value).length > 0) boundedFailure();
      if (keys.some(key => !/^(?:0|[1-9][0-9]*)$/.test(key) || Number(key) >= value.length)) boundedFailure();
      for (let index = 0; index < value.length; index += 1) {
        if (!Object.prototype.hasOwnProperty.call(value, index)) boundedFailure();
        state.arrayItems += 1;
        if (state.arrayItems > RECEIPT_FACTS_MAX_ARRAY_ITEMS) boundedFailure(true);
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        if (!descriptor || !('value' in descriptor)) boundedFailure();
        inspectBoundedValue(descriptor.value, depth + 1, state);
      }
      return;
    }
    if (!isPlainObject(value)) boundedFailure();
    const keys = ownEnumerableKeys(value, 'ACTION_RECEIPT_RUNTIME_FACTS_INVALID');
    state.keys += keys.length;
    if (state.keys > RECEIPT_FACTS_MAX_KEYS) boundedFailure(true);
    for (const key of keys) {
      state.stringBytes += Buffer.byteLength(key, 'utf8');
      if (state.stringBytes > RECEIPT_FACTS_MAX_BYTES) boundedFailure(true);
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !('value' in descriptor)) boundedFailure();
      inspectBoundedValue(descriptor.value, depth + 1, state);
    }
  } finally {
    state.stack.delete(value);
  }
}

/** SHA-256 over W3A canonical JSON after strict, bounded JSON validation. */
export function hashBoundedReceiptFacts(value: unknown): string {
  const state: BoundedFactsState = { nodes: 0, keys: 0, arrayItems: 0, stringBytes: 0, stack: new WeakSet() };
  inspectBoundedValue(value, 0, state);
  let canonical: string;
  try {
    canonical = canonicalJson(value);
  } catch {
    fail('ACTION_RECEIPT_RUNTIME_FACTS_INVALID');
  }
  if (Buffer.byteLength(canonical, 'utf8') > RECEIPT_FACTS_MAX_BYTES) boundedFailure(true);
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

/** Canonical hash of the complete, sorted pre-state resource authority list. */
export function combineReceiptResourceBeforeHashes(resources: unknown): string {
  return hashBoundedReceiptFacts(normalizeBeforeResources(resources));
}

const RECOVERY_PLACEHOLDER = 'recovery-pending';

function isReceiptRequiredResult(value: CoverageResolverResult): value is Extract<CoverageResolverResult, { policy: 'receipt-required' }> {
  return value.policy === 'receipt-required';
}

/**
 * Bind a reversible policy result to its deterministic receipt identity.  W3A operation identity
 * excludes rollback reference, so the provisional and final prepared IDs must be identical.
 */
export function bindDeterministicRecoveryReference(
  policyResult: CoverageResolverResult,
): CoverageResolverResult {
  if (!isPlainObject(policyResult)) fail('ACTION_RECEIPT_RUNTIME_RECOVERY_INVALID');
  if (!isReceiptRequiredResult(policyResult)) return policyResult;
  const prepareInput = policyResult.prepareInput;
  if (!isPlainObject(prepareInput) || !isPlainObject(prepareInput.rollback)) {
    fail('ACTION_RECEIPT_RUNTIME_RECOVERY_INVALID');
  }
  if (prepareInput.rollback.required !== true) return policyResult;

  const provisionalRollback = { ...prepareInput.rollback, reference: RECOVERY_PLACEHOLDER };
  const provisionalInput = { ...prepareInput, rollback: provisionalRollback } as ActionReceiptPrepareInput;
  let provisionalId: string;
  try {
    provisionalId = createPreparedActionReceipt(provisionalInput).id;
  } catch {
    fail('ACTION_RECEIPT_RUNTIME_RECOVERY_INVALID');
  }

  const finalRollback = { ...prepareInput.rollback, reference: provisionalId };
  const finalInput = { ...prepareInput, rollback: finalRollback } as ActionReceiptPrepareInput;
  let finalId: string;
  try {
    finalId = createPreparedActionReceipt(finalInput).id;
  } catch {
    fail('ACTION_RECEIPT_RUNTIME_RECOVERY_INVALID');
  }
  if (!HASH_RE.test(provisionalId.slice(3)) || finalId !== provisionalId || finalRollback.reference !== finalId) {
    fail('ACTION_RECEIPT_RUNTIME_RECOVERY_UNSTABLE');
  }
  return {
    ...policyResult,
    prepareInput: finalInput,
  };
}

// Keep the resolver type available to callers without making runtime code import policy values.
export type { CoverageResolverResult as ActionReceiptCoverageResolverResult };
