/**
 * B115 W3A — the narrow, durable authority envelope for a Forge action.
 *
 * This module deliberately contains no Express, Agent History, workspace writer, or recovery
 * integration.  It defines the immutable prepare facts and the small lifecycle state machine
 * that W3B integrations will use later.
 */

import { createHash } from 'crypto';

export const ACTION_RECEIPT_SCHEMA = 'forge.action-receipt.v1' as const;
export const ACTION_RECEIPT_HASH_ALGORITHM = 'sha256' as const;

export type ActionReceiptStatus = 'prepared' | 'committed' | 'failed' | 'rolled_back' | 'incomplete' | 'compensated';
export type ReceiptActorKind = 'human' | 'agent' | 'service' | 'system';
export type ReceiptClientChannel = 'studio' | 'api' | 'mcp' | 'harness' | 'internal';
export type ReceiptValidationStatus = 'pending' | 'passed' | 'failed';
export type ReceiptRollbackMode = 'none' | 'recovery';
export type ReceiptRollbackStatus = 'not_required' | 'prepared' | 'available' | 'performed' | 'failed';
export type ReceiptAfterOutcome = 'applied' | 'no_change' | 'partial';

export interface ActionReceiptActor {
  kind: ReceiptActorKind;
  id: string;
}

export interface ActionReceiptClient {
  channel: ReceiptClientChannel;
  id: string;
  version: string;
}

export type ActionReceiptCapability =
  | { id: string; version: string }
  | { legacyRoute: string; method: ReceiptHttpMethod; reviewed: true; reviewRef: string };

export type ReceiptHttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD';

export type ActionReceiptResourceRole =
  | 'workspace'
  | 'profile'
  | 'project'
  | 'data'
  | 'deploy'
  | 'artifact'
  | 'snapshot'
  | 'config'
  | 'game'
  | 'file'
  | 'directory'
  | 'other';

export interface ActionReceiptResourceAuthority {
  role: ActionReceiptResourceRole;
  root: string;
  relativePath: string;
  beforeHash?: string;
}

interface ActionReceiptAuthorityBase {
  operationId: string;
  requestScope: string;
  resources: ActionReceiptResourceAuthority[];
}

export type ActionReceiptAuthority =
  | (ActionReceiptAuthorityBase & {
    scope: 'global';
  })
  | (ActionReceiptAuthorityBase & {
    scope: 'profile';
    profileId: string;
  })
  | (ActionReceiptAuthorityBase & {
    scope: 'workspace';
    workspaceId: string;
  });

export interface ActionReceiptAfterResource {
  role: ActionReceiptResourceRole;
  root: string;
  relativePath: string;
  hash: string;
}

export interface ActionReceiptAfter {
  outcome: ReceiptAfterOutcome;
  resources: ActionReceiptAfterResource[];
  code?: string;
}

/*
 * Scope identity is intentionally discriminated rather than represented by nullable fields.
 * Global authority has no profile/workspace identity; profile and workspace authority each carry
 * only the identifier that makes that scope real.  operationId is caller-owned and is part of the
 * immutable prepare identity, not a generated receipt field.
 */
export interface ActionReceiptGlobalAuthority extends ActionReceiptAuthorityBase {
  scope: 'global';
}

export interface ActionReceiptProfileAuthority extends ActionReceiptAuthorityBase {
  scope: 'profile';
  profileId: string;
}

export interface ActionReceiptWorkspaceAuthority extends ActionReceiptAuthorityBase {
  scope: 'workspace';
  workspaceId: string;
}

export interface ActionReceiptDeclaredEffect {
  id: string;
  operation: string;
  resource: ActionReceiptResourceAuthority;
  reversible: boolean;
}

export interface ActionReceiptEffects {
  declared: ActionReceiptDeclaredEffect[];
}

export interface ActionReceiptInputAuthority {
  requestHash: string;
  beforeHash: string;
}

export interface ActionReceiptValidation {
  status: ReceiptValidationStatus;
  validator: string;
  ruleHash?: string;
  code?: string;
  summary?: string;
}

export interface ActionReceiptRollback {
  required: boolean;
  mode: ReceiptRollbackMode;
  status: ReceiptRollbackStatus;
  reference?: string;
}

export interface ActionReceiptFailure {
  code: string;
  message?: string;
}

export type ReceiptMetadataValue = string | number | boolean | null;
export type ActionReceiptMetadata = Record<string, ReceiptMetadataValue>;

export interface ActionReceiptTimes {
  preparedAt: string;
  committedAt?: string;
  failedAt?: string;
  rolledBackAt?: string;
  incompleteAt?: string;
  compensatedAt?: string;
}

export interface ActionReceiptTransition {
  from: 'none' | 'prepared' | 'committed';
  to: ActionReceiptStatus;
  at: string;
}

export interface ActionReceipt {
  schema: typeof ACTION_RECEIPT_SCHEMA;
  id: string;
  authorityHash: string;
  actor: ActionReceiptActor;
  client: ActionReceiptClient;
  capability: ActionReceiptCapability;
  authority: ActionReceiptAuthority;
  effects: ActionReceiptEffects;
  input: ActionReceiptInputAuthority;
  validation: ActionReceiptValidation;
  rollback: ActionReceiptRollback;
  status: ActionReceiptStatus;
  times: ActionReceiptTimes;
  transition: ActionReceiptTransition;
  transitionHash: string;
  after?: ActionReceiptAfter;
  failure?: ActionReceiptFailure;
  metadata?: ActionReceiptMetadata;
  /** SHA-256 of the canonical record with this field omitted. */
  hash: string;
}

export interface ActionReceiptPrepareInput {
  actor: ActionReceiptActor;
  client: ActionReceiptClient;
  capability: ActionReceiptCapability;
  authority: ActionReceiptAuthority;
  effects: ActionReceiptEffects;
  input: ActionReceiptInputAuthority;
  validation: Omit<ActionReceiptValidation, 'status'>;
  rollback: Omit<ActionReceiptRollback, 'status'> & { status?: ReceiptRollbackStatus };
  metadata?: unknown;
  preparedAt?: string;
}

export interface ActionReceiptTransitionInput {
  to: Exclude<ActionReceiptStatus, 'prepared'>;
  at: string;
  validation?: ActionReceiptValidation;
  rollbackStatus?: ReceiptRollbackStatus;
  after?: ActionReceiptAfter;
  failure?: ActionReceiptFailure;
}

export interface ActionReceiptValidationResult {
  ok: boolean;
  errors: string[];
  receipt?: ActionReceipt;
}

export class ActionReceiptValidationError extends Error {
  readonly code = 'ACTION_RECEIPT_INVALID';
  readonly errors: string[];

  constructor(errors: string[] | string) {
    const list = Array.isArray(errors) ? errors : [errors];
    super(list.join('; '));
    this.name = 'ActionReceiptValidationError';
    this.errors = list;
  }
}

const HASH_RE = /^[a-f0-9]{64}$/;
const RECEIPT_ID_RE = /^ar_[a-f0-9]{64}$/;
const WORKSPACE_ID_RE = /^ws_[a-f0-9]{24}$/i;
const LOGICAL_ID_RE = /^[a-zA-Z][a-zA-Z0-9._:-]{0,127}$/;
const PROFILE_ID_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/;
const VERSION_RE = /^[a-zA-Z0-9][a-zA-Z0-9._+-]{0,63}$/;
const ROOT_RE = /^[a-z][a-z0-9._-]{0,63}$/;
const ROUTE_RE = /^[/]api[/][a-zA-Z0-9][a-zA-Z0-9._~:\x2f=-]{0,191}$/;
const OPERATION_RE = /^[a-z][a-z0-9._:-]{0,63}$/;
const TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;
const SECRET_KEY_RE = /(?:secret|token|password|passwd|api[_-]?key|authorization|credential|private[_-]?key|cookie|request[_-]?body|response[_-]?body|raw[_-]?body|prompt|environment|env)/i;
const SECRET_VALUE_RE = /(?:bearer\s+[a-z0-9._~+\x2f-]+=*|(?:x4fk_|sk-|pk-|rk-|ghp_|github_pat_|AIza)[a-z0-9._~+\x2f-]{6,}|-----BEGIN [^-]*PRIVATE KEY-----|(?:api[_-]?key|password|token|secret)\s*[:=]\s*[^\s,;]+)/i;
const SAFE_METADATA_KEYS = new Set([
  'operation', 'route', 'requestId', 'traceId', 'reasonCode', 'message', 'count', 'bytes',
  'mode', 'dryRun', 'provider', 'model', 'profile', 'resourceRole', 'summary', 'errorCode',
  'outcome', 'stage', 'recoveryId',
]);

const RECEIPT_KEYS = [
  'schema', 'id', 'authorityHash', 'actor', 'client', 'capability', 'authority', 'effects', 'input',
  'validation', 'rollback', 'status', 'times', 'transition', 'transitionHash', 'after', 'failure',
  'metadata', 'hash',
];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object') return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function fail(message: string): never {
  throw new ActionReceiptValidationError(message);
}

function exactKeys(value: Record<string, unknown>, allowed: readonly string[], label: string): void {
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(value)) {
    if (!allowedSet.has(key)) fail(`${label} contains unknown field '${key}'.`);
  }
}

function requireObject(value: unknown, label: string): Record<string, unknown> {
  if (!isPlainObject(value)) fail(`${label} must be a plain object.`);
  return value;
}

function requireString(value: unknown, label: string, max = 256): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > max) fail(`${label} must be a non-empty string of at most ${max} characters.`);
  if ([...value].some(character => character.charCodeAt(0) < 0x20 || character === '\u007f')) {
    fail(`${label} contains a control character.`);
  }
  return value;
}

function requirePattern(value: unknown, label: string, pattern: RegExp, max = 256): string {
  const text = requireString(value, label, max);
  if (!pattern.test(text)) fail(`${label} has an invalid shape.`);
  if (SECRET_VALUE_RE.test(text)) fail(`${label} contains a policy-covered credential-like value.`);
  return text;
}

function rejectSecretBearingIdentity(value: string, label: string): void {
  if (SECRET_VALUE_RE.test(value)) {
    fail(`${label} contains a policy-covered secret-bearing identity.`);
  }
}

function requireAuthorityIdentity(value: unknown, label: string, pattern: RegExp, max = 256): string {
  const text = requirePattern(value, label, pattern, max);
  rejectSecretBearingIdentity(text, label);
  return text;
}

function requireHash(value: unknown, label: string): string {
  return requirePattern(value, label, HASH_RE, 64);
}

function requireBoolean(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') fail(`${label} must be boolean.`);
  return value;
}

function parseTimestamp(value: unknown, label: string): string {
  const text = requireString(value, label, 40);
  if (!TIMESTAMP_RE.test(text)) fail(`${label} must be an ISO-8601 timestamp with an explicit timezone.`);
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed)) fail(`${label} is not a valid timestamp.`);
  return new Date(parsed).toISOString();
}

function timestampMillis(value: string): number {
  return Date.parse(value);
}

function isSensitiveKey(key: string): boolean {
  return SECRET_KEY_RE.test(key);
}

function redactSensitiveText(text: string): string {
  return text
    .replace(/Bearer\s+[a-z0-9._~+\x2f-]+=*/gi, 'Bearer [redacted]')
    .replace(/\b(?:x4fk_|sk-|pk-|rk-|ghp_|github_pat_|AIza)[a-z0-9._~+\x2f-]{6,}\b/gi, '[redacted-secret]')
    .replace(/-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?-----END [^-]*PRIVATE KEY-----/gi, '[redacted-private-key]')
    .replace(/((?:api[_-]?key|password|token|secret)\s*[:=]\s*)[^\s,;]+/gi, '$1[redacted]');
}

function normalizeMetadata(value: unknown, redact: boolean): ActionReceiptMetadata | undefined {
  if (value === undefined) return undefined;
  const object = requireObject(value, 'metadata');
  const output: ActionReceiptMetadata = {};
  const keys = Object.keys(object);
  if (keys.length > 24) fail('metadata has too many fields.');
  for (const key of keys) {
    if (isSensitiveKey(key) || !SAFE_METADATA_KEYS.has(key)) {
      fail(`metadata key '${key}' is outside the narrow safe metadata policy.`);
    }
    const raw = object[key];
    if (typeof raw === 'string') {
      const text = requireString(raw, `metadata.${key}`, 512);
      if (SECRET_VALUE_RE.test(text)) {
        if (!redact) fail(`metadata.${key} contains a policy-covered secret-bearing value.`);
        output[key] = redactSensitiveText(text);
      } else {
        output[key] = text;
      }
    } else if (raw === null || typeof raw === 'boolean') {
      output[key] = raw as null | boolean;
    } else if (typeof raw === 'number' && Number.isFinite(raw)) {
      output[key] = raw;
    } else {
      fail(`metadata.${key} must be a string, finite number, boolean, or null.`);
    }
  }
  return output;
}

/** Apply the explicit, narrow metadata redaction policy before a receipt is built. */
export function redactReceiptMetadata(value: unknown): ActionReceiptMetadata | undefined {
  return normalizeMetadata(value, true);
}

function safeFreeText(value: unknown, label: string, max: number, redact: boolean): string {
  const text = requireString(value, label, max);
  if (!SECRET_VALUE_RE.test(text)) return text;
  if (!redact) fail(`${label} contains a policy-covered secret-bearing value.`);
  return redactSensitiveText(text);
}

function validateRelativePath(value: unknown, label: string): string {
  const text = requireString(value, label, 512);
  // Hashable resources are role/root-relative POSIX identities, never local paths.  Reject both
  // Windows and POSIX absolute forms instead of attempting to normalize them.
  if (text.includes('\\') || text.startsWith('/') || /^[a-zA-Z]:($|\/)/.test(text) || text.startsWith('\\')) {
    fail(`${label} must be a role/root-relative POSIX path, not an absolute machine path.`);
  }
  const segments = text.split('/');
  if (segments.some(segment => segment.length === 0 || segment === '.' || segment === '..')) {
    fail(`${label} contains an empty or traversal segment.`);
  }
  rejectSecretBearingIdentity(text, label);
  return text;
}

function normalizeResource(value: unknown, label: string, redact = false): ActionReceiptResourceAuthority {
  const object = requireObject(value, label);
  exactKeys(object, ['role', 'root', 'relativePath', 'beforeHash'], label);
  const role = requireString(object.role, `${label}.role`, 32) as ActionReceiptResourceRole;
  if (!(['workspace', 'profile', 'project', 'data', 'deploy', 'artifact', 'snapshot', 'config', 'game', 'file', 'directory', 'other'] as string[]).includes(role)) {
    fail(`${label}.role is not a supported authority role.`);
  }
  const root = requireAuthorityIdentity(object.root, `${label}.root`, ROOT_RE, 64);
  const relativePath = validateRelativePath(object.relativePath, `${label}.relativePath`);
  const output: ActionReceiptResourceAuthority = { role, root, relativePath };
  if (object.beforeHash !== undefined) output.beforeHash = requireHash(object.beforeHash, `${label}.beforeHash`);
  if (redact) rejectSecretBearingIdentity(output.relativePath, `${label}.relativePath`);
  return output;
}

function resourceKey(resource: ActionReceiptResourceAuthority): string {
  return `${resource.role}\u0000${resource.root}\u0000${resource.relativePath}`;
}

function resourceAuthorityKey(resource: ActionReceiptResourceAuthority): string {
  return `${resourceKey(resource)}\u0000${resource.beforeHash ?? ''}`;
}

function compareOrdinal(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function normalizeActor(value: unknown, redact = false): ActionReceiptActor {
  const object = requireObject(value, 'actor');
  exactKeys(object, ['kind', 'id'], 'actor');
  const kind = requireString(object.kind, 'actor.kind', 16) as ReceiptActorKind;
  if (!(['human', 'agent', 'service', 'system'] as string[]).includes(kind)) fail('actor.kind is invalid.');
  const id = requirePattern(object.id, 'actor.id', LOGICAL_ID_RE, 128);
  if (redact) return { kind, id };
  return { kind, id };
}

function normalizeClient(value: unknown): ActionReceiptClient {
  const object = requireObject(value, 'client');
  exactKeys(object, ['channel', 'id', 'version'], 'client');
  const channel = requireString(object.channel, 'client.channel', 16) as ReceiptClientChannel;
  if (!(['studio', 'api', 'mcp', 'harness', 'internal'] as string[]).includes(channel)) fail('client.channel is invalid.');
  const id = requirePattern(object.id, 'client.id', LOGICAL_ID_RE, 128);
  const version = requirePattern(object.version, 'client.version', VERSION_RE, 64);
  return { channel, id, version };
}

function normalizeCapability(value: unknown): ActionReceiptCapability {
  const object = requireObject(value, 'capability');
  if (Object.prototype.hasOwnProperty.call(object, 'id')) {
    exactKeys(object, ['id', 'version'], 'capability');
    return {
      id: requirePattern(object.id, 'capability.id', LOGICAL_ID_RE, 128),
      version: requirePattern(object.version, 'capability.version', VERSION_RE, 64),
    };
  }
  exactKeys(object, ['legacyRoute', 'method', 'reviewed', 'reviewRef'], 'capability');
  if (object.reviewed !== true) fail('capability.reviewed must be true for a legacy route identity.');
  const method = requireString(object.method, 'capability.method', 8) as ReceiptHttpMethod;
  if (!(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'] as string[]).includes(method)) {
    fail('capability.method must be an uppercase HTTP method.');
  }
  return {
    legacyRoute: requirePattern(object.legacyRoute, 'capability.legacyRoute', ROUTE_RE, 192),
    method,
    reviewed: true,
    reviewRef: requirePattern(object.reviewRef, 'capability.reviewRef', LOGICAL_ID_RE, 128),
  };
}

function normalizeAuthority(value: unknown): ActionReceiptAuthority {
  const object = requireObject(value, 'authority');
  const scope = requireString(object.scope, 'authority.scope', 16) as ActionReceiptAuthority['scope'];
  if (!(['global', 'profile', 'workspace'] as string[]).includes(scope)) fail('authority.scope is invalid.');
  const operationId = requireAuthorityIdentity(object.operationId, 'authority.operationId', LOGICAL_ID_RE, 128);
  const requestScope = requireAuthorityIdentity(object.requestScope, 'authority.requestScope', LOGICAL_ID_RE, 128);
  if (!Array.isArray(object.resources) || object.resources.length === 0 || object.resources.length > 128) {
    fail('authority.resources must contain between 1 and 128 resources.');
  }
  const resources = object.resources.map((entry, index) => normalizeResource(entry, `authority.resources[${index}]`));
  const seen = new Set<string>();
  for (const resource of resources) {
    const key = resourceKey(resource);
    if (seen.has(key)) fail('authority.resources contains a duplicate resource identity.');
    seen.add(key);
  }
  resources.sort((a, b) => compareOrdinal(resourceKey(a), resourceKey(b)));
  if (scope === 'global') {
    exactKeys(object, ['scope', 'operationId', 'requestScope', 'resources'], 'authority');
    return { scope, operationId, requestScope, resources };
  }
  if (scope === 'profile') {
    exactKeys(object, ['scope', 'operationId', 'profileId', 'requestScope', 'resources'], 'authority');
    return {
      scope,
      operationId,
      profileId: requireAuthorityIdentity(object.profileId, 'authority.profileId', PROFILE_ID_RE, 64),
      requestScope,
      resources,
    };
  }
  exactKeys(object, ['scope', 'operationId', 'workspaceId', 'requestScope', 'resources'], 'authority');
  return {
    scope,
    operationId,
    workspaceId: requireAuthorityIdentity(object.workspaceId, 'authority.workspaceId', WORKSPACE_ID_RE, 27),
    requestScope,
    resources,
  };
}

function normalizeEffects(value: unknown, authority: ActionReceiptAuthority): ActionReceiptEffects {
  const object = requireObject(value, 'effects');
  exactKeys(object, ['declared'], 'effects');
  if (!Array.isArray(object.declared) || object.declared.length === 0 || object.declared.length > 128) {
    fail('effects.declared must contain between 1 and 128 effects.');
  }
  const authorityResources = new Map(authority.resources.map(resource => [resourceKey(resource), resource]));
  const ids = new Set<string>();
  const declared = object.declared.map((entry, index) => {
    const effect = requireObject(entry, `effects.declared[${index}]`);
    exactKeys(effect, ['id', 'operation', 'resource', 'reversible'], `effects.declared[${index}]`);
    const id = requirePattern(effect.id, `effects.declared[${index}].id`, LOGICAL_ID_RE, 128);
    if (ids.has(id)) fail('effects.declared contains a duplicate effect id.');
    ids.add(id);
    const operation = requirePattern(effect.operation, `effects.declared[${index}].operation`, OPERATION_RE, 64);
    const resource = normalizeResource(effect.resource, `effects.declared[${index}].resource`);
    const authorityResource = authorityResources.get(resourceKey(resource));
    if (authorityResource === undefined || resourceAuthorityKey(resource) !== resourceAuthorityKey(authorityResource)) {
      fail(`effects.declared[${index}] does not exactly match authority.resources, including beforeHash.`);
    }
    return { id, operation, resource: authorityResource, reversible: requireBoolean(effect.reversible, `effects.declared[${index}].reversible`) };
  });
  declared.sort((a, b) => compareOrdinal(a.id, b.id));
  return { declared };
}

function normalizeInput(value: unknown): ActionReceiptInputAuthority {
  const object = requireObject(value, 'input');
  exactKeys(object, ['requestHash', 'beforeHash'], 'input');
  return {
    requestHash: requireHash(object.requestHash, 'input.requestHash'),
    beforeHash: requireHash(object.beforeHash, 'input.beforeHash'),
  };
}

function normalizeValidation(value: unknown, redact: boolean): ActionReceiptValidation {
  const object = requireObject(value, 'validation');
  exactKeys(object, ['status', 'validator', 'ruleHash', 'code', 'summary'], 'validation');
  const status = requireString(object.status, 'validation.status', 16) as ReceiptValidationStatus;
  if (!(['pending', 'passed', 'failed'] as string[]).includes(status)) fail('validation.status is invalid.');
  const validator = requirePattern(object.validator, 'validation.validator', LOGICAL_ID_RE, 128);
  const output: ActionReceiptValidation = { status, validator };
  if (object.ruleHash !== undefined) output.ruleHash = requireHash(object.ruleHash, 'validation.ruleHash');
  if (object.code !== undefined) output.code = requirePattern(object.code, 'validation.code', LOGICAL_ID_RE, 128);
  if (object.summary !== undefined) output.summary = safeFreeText(object.summary, 'validation.summary', 256, redact);
  return output;
}

function normalizeRollback(value: unknown, redact = false): ActionReceiptRollback {
  const object = requireObject(value, 'rollback');
  exactKeys(object, ['required', 'mode', 'status', 'reference'], 'rollback');
  const required = requireBoolean(object.required, 'rollback.required');
  const mode = requireString(object.mode, 'rollback.mode', 16) as ReceiptRollbackMode;
  if (!(['none', 'recovery'] as string[]).includes(mode)) fail('rollback.mode is invalid.');
  const status = requireString(object.status, 'rollback.status', 16) as ReceiptRollbackStatus;
  if (!(['not_required', 'prepared', 'available', 'performed', 'failed'] as string[]).includes(status)) fail('rollback.status is invalid.');
  const output: ActionReceiptRollback = { required, mode, status };
  if (object.reference !== undefined) {
    const reference = requirePattern(object.reference, 'rollback.reference', LOGICAL_ID_RE, 128);
    if (SECRET_VALUE_RE.test(reference)) fail('rollback.reference contains a credential-like value.');
    output.reference = reference;
  }
  if (!required && (mode !== 'none' || status !== 'not_required' || output.reference !== undefined)) {
    fail('non-reversible effects must use rollback mode none and status not_required.');
  }
  if (required && (mode !== 'recovery' || output.reference === undefined)) {
    fail('required rollback must use recovery mode with a reference.');
  }
  if (redact && output.reference) output.reference = redactSensitiveText(output.reference);
  return output;
}

function normalizeAfter(value: unknown, authority: ActionReceiptAuthority, redact: boolean): ActionReceiptAfter {
  const object = requireObject(value, 'after');
  exactKeys(object, ['outcome', 'resources', 'code'], 'after');
  const outcome = requireString(object.outcome, 'after.outcome', 16) as ReceiptAfterOutcome;
  if (!(['applied', 'no_change', 'partial'] as string[]).includes(outcome)) fail('after.outcome is invalid.');
  if (!Array.isArray(object.resources) || object.resources.length !== authority.resources.length) {
    fail('after.resources must contain exactly one result for every authority resource.');
  }
  const resources = object.resources.map((entry, index) => {
    const result = requireObject(entry, `after.resources[${index}]`);
    exactKeys(result, ['role', 'root', 'relativePath', 'hash'], `after.resources[${index}]`);
    const role = requireString(result.role, `after.resources[${index}].role`, 32) as ActionReceiptResourceRole;
    if (!(['workspace', 'profile', 'project', 'data', 'deploy', 'artifact', 'snapshot', 'config', 'game', 'file', 'directory', 'other'] as string[]).includes(role)) {
      fail(`after.resources[${index}].role is not a supported authority role.`);
    }
    const root = requireAuthorityIdentity(result.root, `after.resources[${index}].root`, ROOT_RE, 64);
    const relativePath = validateRelativePath(result.relativePath, `after.resources[${index}].relativePath`);
    if (redact) rejectSecretBearingIdentity(relativePath, `after.resources[${index}].relativePath`);
    const hash = requireHash(result.hash, `after.resources[${index}].hash`);
    const expected = authority.resources[index];
    if (resourceKey({ role, root, relativePath }) !== resourceKey(expected)) {
      fail('after.resources must use the exact canonical authority resource order and identities.');
    }
    return { role, root, relativePath, hash };
  });
  if (outcome === 'no_change') {
    authority.resources.forEach((resource, index) => {
      if (resource.beforeHash === undefined) fail('no_change requires a beforeHash for every authority resource.');
      if (resources[index].hash !== resource.beforeHash) fail('no_change after hashes must equal each authority beforeHash.');
    });
  }
  const output: ActionReceiptAfter = { outcome, resources };
  if (object.code !== undefined) output.code = requirePattern(object.code, 'after.code', LOGICAL_ID_RE, 128);
  if (redact && output.code) output.code = redactSensitiveText(output.code);
  return output;
}

function normalizeFailure(value: unknown, redact: boolean): ActionReceiptFailure {
  const object = requireObject(value, 'failure');
  exactKeys(object, ['code', 'message'], 'failure');
  const output: ActionReceiptFailure = { code: requirePattern(object.code, 'failure.code', LOGICAL_ID_RE, 128) };
  if (object.message !== undefined) output.message = safeFreeText(object.message, 'failure.message', 512, redact);
  return output;
}

function normalizeTimes(value: unknown): ActionReceiptTimes {
  const object = requireObject(value, 'times');
  exactKeys(object, ['preparedAt', 'committedAt', 'failedAt', 'rolledBackAt', 'incompleteAt', 'compensatedAt'], 'times');
  const output: ActionReceiptTimes = { preparedAt: parseTimestamp(object.preparedAt, 'times.preparedAt') };
  if (object.committedAt !== undefined) output.committedAt = parseTimestamp(object.committedAt, 'times.committedAt');
  if (object.failedAt !== undefined) output.failedAt = parseTimestamp(object.failedAt, 'times.failedAt');
  if (object.rolledBackAt !== undefined) output.rolledBackAt = parseTimestamp(object.rolledBackAt, 'times.rolledBackAt');
  if (object.incompleteAt !== undefined) output.incompleteAt = parseTimestamp(object.incompleteAt, 'times.incompleteAt');
  if (object.compensatedAt !== undefined) output.compensatedAt = parseTimestamp(object.compensatedAt, 'times.compensatedAt');
  return output;
}

function normalizeTransition(value: unknown): ActionReceiptTransition {
  const object = requireObject(value, 'transition');
  exactKeys(object, ['from', 'to', 'at'], 'transition');
  const from = requireString(object.from, 'transition.from', 16) as ActionReceiptTransition['from'];
  if (!(['none', 'prepared', 'committed'] as string[]).includes(from)) fail('transition.from is invalid.');
  const to = requireString(object.to, 'transition.to', 16) as ActionReceiptStatus;
  if (!(['prepared', 'committed', 'failed', 'rolled_back', 'incomplete', 'compensated'] as string[]).includes(to)) fail('transition.to is invalid.');
  return { from, to, at: parseTimestamp(object.at, 'transition.at') };
}

function normalizeForPrepare(input: ActionReceiptPrepareInput): {
  actor: ActionReceiptActor;
  client: ActionReceiptClient;
  capability: ActionReceiptCapability;
  authority: ActionReceiptAuthority;
  effects: ActionReceiptEffects;
  input: ActionReceiptInputAuthority;
  validation: ActionReceiptValidation;
  rollback: ActionReceiptRollback;
  metadata?: ActionReceiptMetadata;
  preparedAt: string;
} {
  const authority = normalizeAuthority(input.authority);
  const effects = normalizeEffects(input.effects, authority);
  const rollbackInput = requireObject(input.rollback, 'rollback');
  const rollbackStatus = rollbackInput.status ?? (rollbackInput.required ? 'prepared' : 'not_required');
  const rollback = normalizeRollback({ ...rollbackInput, status: rollbackStatus }, false);
  const hasReversibleEffect = effects.declared.some(effect => effect.reversible);
  if (hasReversibleEffect !== rollback.required) fail('rollback.required must match the declared reversible effects.');
  const validationObject = requireObject(input.validation, 'validation');
  const validation = normalizeValidation({ ...validationObject, status: 'pending' }, true);
  return {
    actor: normalizeActor(input.actor, true),
    client: normalizeClient(input.client),
    capability: normalizeCapability(input.capability),
    authority,
    effects,
    input: normalizeInput(input.input),
    validation,
    rollback,
    metadata: redactReceiptMetadata(input.metadata),
    preparedAt: parseTimestamp(input.preparedAt ?? new Date().toISOString(), 'times.preparedAt'),
  };
}

function authorityPayloadFromParts(parts: {
  actor: ActionReceiptActor;
  client: ActionReceiptClient;
  capability: ActionReceiptCapability;
  authority: ActionReceiptAuthority;
  effects: ActionReceiptEffects;
  input: ActionReceiptInputAuthority;
  validation: ActionReceiptValidation;
  rollback: ActionReceiptRollback;
  metadata?: ActionReceiptMetadata;
}): Record<string, unknown> {
  return {
    schema: ACTION_RECEIPT_SCHEMA,
    actor: parts.actor,
    client: parts.client,
    capability: parts.capability,
    authority: parts.authority,
    effects: parts.effects,
    input: parts.input,
    // Validation status and result are lifecycle facts.  The validator/rule authority is a
    // prepare fact and therefore remains stable from prepared through compensated.
    validation: {
      validator: parts.validation.validator,
      ...(parts.validation.ruleHash === undefined ? {} : { ruleHash: parts.validation.ruleHash }),
    },
    // Recovery status changes with the lifecycle; its declared mode/reference do not.
    rollback: {
      required: parts.rollback.required,
      mode: parts.rollback.mode,
      ...(parts.rollback.reference === undefined ? {} : { reference: parts.rollback.reference }),
    },
    ...(parts.metadata === undefined ? {} : { metadata: parts.metadata }),
  };
}

function operationIdentityAuthority(authority: ActionReceiptAuthority): Record<string, unknown> {
  if (authority.scope === 'global') {
    return {
      scope: authority.scope,
      operationId: authority.operationId,
      requestScope: authority.requestScope,
    };
  }
  if (authority.scope === 'profile') {
    return {
      scope: authority.scope,
      operationId: authority.operationId,
      profileId: authority.profileId,
      requestScope: authority.requestScope,
    };
  }
  return {
    scope: authority.scope,
    operationId: authority.operationId,
    requestScope: authority.requestScope,
    workspaceId: authority.workspaceId,
  };
}

function operationIdentityPayloadFromParts(parts: {
  actor: ActionReceiptActor;
  client: ActionReceiptClient;
  capability: ActionReceiptCapability;
  authority: ActionReceiptAuthority;
}): Record<string, unknown> {
  return {
    schema: ACTION_RECEIPT_SCHEMA,
    actor: parts.actor,
    client: parts.client,
    capability: parts.capability,
    authority: operationIdentityAuthority(parts.authority),
  };
}

function sha256Canonical(value: unknown): string {
  return createHash(ACTION_RECEIPT_HASH_ALGORITHM).update(canonicalJson(value), 'utf8').digest('hex');
}

/** Deterministic JSON: sorted object keys, preserved array order, no ambient serialization. */
export function canonicalJson(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail('canonical JSON cannot contain a non-finite number.');
    return Object.is(value, -0) ? '0' : JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(item => canonicalJson(item)).join(',')}]`;
  if (isPlainObject(value)) {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  fail('canonical JSON cannot contain undefined, bigint, function, Date, or class instances.');
}

/** Canonical authority input excludes IDs, hashes, timestamps, status, and transition facts. */
export function canonicalizeActionReceiptAuthority(value: ActionReceipt | ActionReceiptPrepareInput): string {
  if (isPlainObject(value) && value.schema === ACTION_RECEIPT_SCHEMA && value.status !== undefined) {
    const record = value as unknown as ActionReceipt;
    // This shape validation is intentional: absolute resources and malformed authority inputs
    // must fail before they can reach the hash function.
    const authority = normalizeAuthority(record.authority);
    const parts = {
      actor: normalizeActor(record.actor),
      client: normalizeClient(record.client),
      capability: normalizeCapability(record.capability),
      authority,
      effects: normalizeEffects(record.effects, authority),
      input: normalizeInput(record.input),
      validation: normalizeValidation(record.validation, false),
      rollback: normalizeRollback(record.rollback),
      metadata: normalizeMetadata(record.metadata, false),
    };
    return canonicalJson(authorityPayloadFromParts(parts));
  }
  const parts = normalizeForPrepare(value as ActionReceiptPrepareInput);
  return canonicalJson(authorityPayloadFromParts(parts));
}

export function hashActionReceiptAuthority(value: ActionReceipt | ActionReceiptPrepareInput): string {
  return createHash(ACTION_RECEIPT_HASH_ALGORITHM).update(canonicalizeActionReceiptAuthority(value), 'utf8').digest('hex');
}

/** Canonical operation identity excludes resources, effects, input, outcomes, metadata, and time. */
export function canonicalizeActionReceiptOperationIdentity(value: ActionReceipt | ActionReceiptPrepareInput): string {
  if (isPlainObject(value) && value.schema === ACTION_RECEIPT_SCHEMA && value.status !== undefined) {
    const record = value as unknown as ActionReceipt;
    return canonicalJson(operationIdentityPayloadFromParts({
      actor: normalizeActor(record.actor),
      client: normalizeClient(record.client),
      capability: normalizeCapability(record.capability),
      authority: normalizeAuthority(record.authority),
    }));
  }
  const parts = normalizeForPrepare(value as ActionReceiptPrepareInput);
  return canonicalJson(operationIdentityPayloadFromParts(parts));
}

export function hashActionReceiptOperationIdentity(value: ActionReceipt | ActionReceiptPrepareInput): string {
  return createHash(ACTION_RECEIPT_HASH_ALGORITHM).update(canonicalizeActionReceiptOperationIdentity(value), 'utf8').digest('hex');
}

function transitionPayload(record: ActionReceipt): Record<string, unknown> {
  return {
    transition: normalizeTransition(record.transition),
    validation: record.validation,
    rollback: record.rollback,
    ...(record.after === undefined ? { after: null } : { after: record.after }),
    ...(record.failure === undefined ? { failure: null } : { failure: record.failure }),
  };
}

export function hashActionReceiptTransition(record: ActionReceipt): string {
  return sha256Canonical(transitionPayload(record));
}

function recordForHash(record: ActionReceipt): Record<string, unknown> {
  const withoutHash: Record<string, unknown> = { ...record };
  delete withoutHash.hash;
  const { times, transition } = record;
  // Timestamp offsets represent the same instant and are normalized before record hashing.  The
  // authority hash above excludes timestamps entirely, which gives prepare identity its stronger
  // idempotence guarantee.
  const normalizedTimes = normalizeTimes(times);
  const normalizedTransition = { ...normalizeTransition(transition) };
  return { ...withoutHash, times: normalizedTimes, transition: normalizedTransition };
}

export function hashActionReceipt(record: ActionReceipt): string {
  return sha256Canonical(recordForHash(record));
}

function assertReceiptShape(value: unknown, requireHashes: boolean): ActionReceipt {
  const record = requireObject(value, 'receipt') as unknown as ActionReceipt;
  exactKeys(record as unknown as Record<string, unknown>, RECEIPT_KEYS, 'receipt');
  if (record.schema !== ACTION_RECEIPT_SCHEMA) fail('receipt.schema is unknown or unsupported.');
  if (!RECEIPT_ID_RE.test(record.id)) fail('receipt.id is malformed.');
  requireHash(record.authorityHash, 'receipt.authorityHash');
  const actor = normalizeActor(record.actor);
  const client = normalizeClient(record.client);
  const capability = normalizeCapability(record.capability);
  const authority = normalizeAuthority(record.authority);
  const effects = normalizeEffects(record.effects, authority);
  const input = normalizeInput(record.input);
  const validation = normalizeValidation(record.validation, false);
  const rollback = normalizeRollback(record.rollback);
  const status = requireString(record.status, 'receipt.status', 16) as ActionReceiptStatus;
  if (!(['prepared', 'committed', 'failed', 'rolled_back', 'incomplete', 'compensated'] as string[]).includes(status)) fail('receipt.status is invalid.');
  const times = normalizeTimes(record.times);
  const transition = normalizeTransition(record.transition);
  requireHash(record.transitionHash, 'receipt.transitionHash');
  if (requireHashes) requireHash(record.hash, 'receipt.hash');

  const hasReversibleEffect = effects.declared.some(effect => effect.reversible);
  const allEffectsReversible = effects.declared.every(effect => effect.reversible);
  if (hasReversibleEffect !== rollback.required) fail('rollback.required disagrees with declared effects.');
  if (status === 'prepared' && validation.status !== 'pending') fail('prepared receipt validation must be pending.');
  if (status === 'committed' && validation.status !== 'passed') fail('committed receipt validation must be passed.');
  if (status === 'compensated' && validation.status !== 'passed') fail('compensated receipt validation must remain passed.');
  if ((status === 'failed' || status === 'rolled_back' || status === 'incomplete') && validation.status !== 'failed') fail(`${status} receipt validation must be failed.`);
  if ((status === 'prepared' || status === 'failed' || status === 'rolled_back') && record.after !== undefined) fail(`${status} receipt cannot contain an after outcome.`);
  if ((status === 'committed' || status === 'compensated' || status === 'incomplete') && record.after === undefined) fail(`${status} receipt must contain an after outcome.`);
  const after = record.after === undefined ? undefined : normalizeAfter(record.after, authority, false);
  if ((status === 'committed' || status === 'compensated') && after?.outcome === 'partial') fail(`${status} receipt cannot carry a partial after outcome.`);
  if (status === 'incomplete' && after?.outcome !== 'partial') fail('incomplete receipt must carry a partial after outcome.');
  const failure = record.failure === undefined ? undefined : normalizeFailure(record.failure, false);
  if ((status === 'failed' || status === 'rolled_back' || status === 'incomplete') && failure === undefined) fail(`${status} receipt must contain failure details.`);
  if ((status === 'prepared' || status === 'committed' || status === 'compensated') && failure !== undefined) fail(`${status} receipt cannot contain failure details.`);

  const expectedFrom: ActionReceiptTransition['from'] = status === 'prepared' ? 'none' : (status === 'compensated' ? 'committed' : 'prepared');
  if (transition.from !== expectedFrom || transition.to !== status) fail('receipt transition does not match the receipt status.');
  const expectedTime = status === 'prepared' ? times.preparedAt
    : status === 'committed' ? times.committedAt
      : status === 'failed' ? times.failedAt
        : status === 'rolled_back' ? times.rolledBackAt
          : status === 'incomplete' ? times.incompleteAt
            : times.compensatedAt;
  if (!expectedTime || expectedTime !== transition.at) fail('receipt transition time does not match its status time.');
  const allowedTimeKeys = status === 'committed'
    ? ['preparedAt', 'committedAt']
    : status === 'failed'
      ? ['preparedAt', 'failedAt']
      : status === 'rolled_back'
        ? ['preparedAt', 'rolledBackAt']
        : status === 'incomplete'
          ? ['preparedAt', 'incompleteAt']
          : status === 'compensated'
            ? ['preparedAt', 'committedAt', 'compensatedAt']
            : ['preparedAt'];
  if (Object.keys(times).some(key => !allowedTimeKeys.includes(key))) {
    fail('receipt contains a timestamp for a transition that did not occur.');
  }
  const transitionMillis = timestampMillis(transition.at);
  if (transitionMillis < timestampMillis(times.preparedAt)) fail('receipt transition precedes preparation.');
  if (status === 'compensated' && (!times.committedAt || timestampMillis(times.compensatedAt!) < timestampMillis(times.committedAt))) {
    fail('compensation must occur at or after commitment.');
  }
  if (status === 'committed' && rollback.required && rollback.status !== 'available') fail('committed reversible receipt must retain an available recovery reference.');
  if (status === 'prepared' && rollback.required && rollback.status !== 'prepared') fail('prepared reversible receipt must retain prepared recovery truth.');
  if (status === 'failed' && rollback.required && ['failed', 'performed'].includes(rollback.status)) fail('failed receipt cannot claim failed or performed recovery; use incomplete or rolled_back.');
  if (status === 'rolled_back' && (!allEffectsReversible || !rollback.required || rollback.status !== 'performed')) fail('rolled_back receipt must record performed recovery for an entirely reversible action.');
  if (status === 'incomplete' && rollback.required && !['available', 'failed'].includes(rollback.status)) fail('incomplete reversible receipt must record available or failed recovery truth.');
  if (status === 'compensated' && (!allEffectsReversible || !rollback.required || rollback.status !== 'performed')) fail('compensated receipt must record performed recovery for an entirely reversible action.');
  if (!rollback.required && rollback.status !== 'not_required') fail('non-reversible receipt must have no rollback status.');
  if (record.metadata !== undefined) normalizeMetadata(record.metadata, false);

  // Return a normalized view for internal comparisons while preserving the caller's object when
  // the function is used as a boolean validator.  Hash checks below use canonical normalized
  // projections, so offset timestamps remain equivalent.
  const normalized: ActionReceipt = {
    schema: ACTION_RECEIPT_SCHEMA,
    id: record.id,
    authorityHash: record.authorityHash,
    actor,
    client,
    capability,
    authority,
    effects,
    input,
    validation,
    rollback,
    status,
    times,
    transition,
    transitionHash: record.transitionHash,
    ...(after === undefined ? {} : { after }),
    ...(failure === undefined ? {} : { failure }),
    ...(record.metadata === undefined ? {} : { metadata: normalizeMetadata(record.metadata, false) }),
    hash: record.hash,
  };
  const expectedAuthorityHash = hashActionReceiptAuthority(normalized);
  if (record.authorityHash !== expectedAuthorityHash) fail('receipt.authorityHash does not match canonical authority input.');
  const expectedOperationId = `ar_${hashActionReceiptOperationIdentity(normalized)}`;
  if (record.id !== expectedOperationId) fail('receipt.id does not match the canonical operation identity.');
  const expectedTransitionHash = hashActionReceiptTransition(normalized);
  if (record.transitionHash !== expectedTransitionHash) fail('receipt.transitionHash does not match the lifecycle facts.');
  if (requireHashes && record.hash !== hashActionReceipt(normalized)) fail('receipt.hash does not match canonical receipt content.');
  return normalized;
}

export function validateActionReceipt(value: unknown): ActionReceiptValidationResult {
  try {
    return { ok: true, errors: [], receipt: assertReceiptShape(value, true) };
  } catch (error) {
    const errors = error instanceof ActionReceiptValidationError ? error.errors : [error instanceof Error ? error.message : String(error)];
    return { ok: false, errors };
  }
}

export function assertValidActionReceipt(value: unknown): ActionReceipt {
  return assertReceiptShape(value, true);
}

export function serializeActionReceipt(record: ActionReceipt): string {
  assertValidActionReceipt(record);
  return canonicalJson(record);
}

function buildReceipt(parts: ReturnType<typeof normalizeForPrepare>): ActionReceipt {
  const provisional = {
    schema: ACTION_RECEIPT_SCHEMA,
    id: 'ar_' + '0'.repeat(64),
    authorityHash: '0'.repeat(64),
    actor: parts.actor,
    client: parts.client,
    capability: parts.capability,
    authority: parts.authority,
    effects: parts.effects,
    input: parts.input,
    validation: parts.validation,
    rollback: parts.rollback,
    status: 'prepared' as const,
    times: { preparedAt: parts.preparedAt },
    transition: { from: 'none' as const, to: 'prepared' as const, at: parts.preparedAt },
    transitionHash: '0'.repeat(64),
    ...(parts.metadata === undefined ? {} : { metadata: parts.metadata }),
    hash: '0'.repeat(64),
  } satisfies ActionReceipt;
  const authorityHash = hashActionReceiptAuthority(provisional);
  const operationIdentityHash = hashActionReceiptOperationIdentity(provisional);
  const withIdentity = { ...provisional, id: `ar_${operationIdentityHash}`, authorityHash };
  const transitionHash = hashActionReceiptTransition(withIdentity);
  const withTransition = { ...withIdentity, transitionHash };
  return { ...withTransition, hash: hashActionReceipt(withTransition) };
}

/** Build a prepared receipt. The generated ID is derived only from the canonical operation identity. */
export function createPreparedActionReceipt(input: ActionReceiptPrepareInput): ActionReceipt {
  const parts = normalizeForPrepare(input);
  return assertValidActionReceipt(buildReceipt(parts));
}

function transitionAllowed(from: ActionReceiptStatus, to: ActionReceiptStatus): boolean {
  return (from === 'prepared' && (to === 'committed' || to === 'failed' || to === 'rolled_back' || to === 'incomplete'))
    || (from === 'committed' && to === 'compensated');
}

function buildTransition(record: ActionReceipt, input: ActionReceiptTransitionInput): ActionReceipt {
  const at = parseTimestamp(input.at, 'transition.at');
  if (record.status === 'incomplete') fail('incomplete action receipt is terminal and cannot transition again.');
  if (record.status === input.to) {
    // A caller may replay an exact transition.  It is accepted only when all supplied lifecycle
    // facts reproduce the existing content; a new timestamp or outcome is a conflicting rewrite.
    const candidate = buildTransitionFromCurrent(record, input, at);
    if (hashActionReceipt(candidate) === record.hash) return record;
    fail('conflicting replay of an existing action receipt transition.');
  }
  if (!transitionAllowed(record.status, input.to)) fail(`invalid action receipt transition ${record.status} -> ${input.to}.`);
  return buildTransitionFromCurrent(record, input, at);
}

function buildTransitionFromCurrent(record: ActionReceipt, input: ActionReceiptTransitionInput, at: string): ActionReceipt {
  const validation = input.validation === undefined ? record.validation : normalizeValidation(input.validation, true);
  const rollback = input.rollbackStatus === undefined
    ? record.rollback
    : normalizeRollback({ ...record.rollback, status: input.rollbackStatus }, false);
  const after = input.after === undefined ? record.after : normalizeAfter(input.after, record.authority, true);
  const failure = input.failure === undefined ? record.failure : normalizeFailure(input.failure, true);
  const allEffectsReversible = record.effects.declared.every(effect => effect.reversible);
  if (input.to === 'committed') {
    if (validation.status !== 'passed' || after === undefined || failure !== undefined) fail('committed transition requires passed validation and an after outcome.');
  } else if (input.to === 'failed') {
    if (validation.status !== 'failed' || failure === undefined || after !== undefined) fail('failed transition requires failed validation and failure details.');
    if (rollback.required && ['failed', 'performed'].includes(rollback.status)) fail('failed transition cannot claim failed or performed recovery; use incomplete or rolled_back.');
  } else if (input.to === 'rolled_back') {
    if (validation.status !== 'failed' || failure === undefined || after !== undefined) fail('rolled_back transition requires failed validation and failure details.');
    if (!allEffectsReversible || !rollback.required || rollback.status !== 'performed') fail('rolled_back transition requires performed recovery for an entirely reversible action.');
  } else if (input.to === 'incomplete') {
    if (validation.status !== 'failed' || failure === undefined || after === undefined || after.outcome !== 'partial') {
      fail('incomplete transition requires failed validation, failure details, and partial after resources.');
    }
    if (rollback.required && !['available', 'failed'].includes(rollback.status)) {
      fail('incomplete transition requires available or failed recovery truth.');
    }
  } else if (input.to === 'compensated') {
    if (!['committed', 'compensated'].includes(record.status) || after === undefined || failure !== undefined) fail('compensated transition requires the committed after outcome.');
    if (!allEffectsReversible || !rollback.required || rollback.status !== 'performed') fail('compensated transition requires performed recovery for an entirely reversible action.');
    if (validation.status !== 'passed') fail('compensated transition must preserve passed validation.');
    if (canonicalJson(validation) !== canonicalJson(record.validation)) fail('compensated transition cannot replace committed validation facts.');
    if (canonicalJson(after) !== canonicalJson(record.after)) fail('compensated transition cannot replace committed after facts.');
  }
  if (input.to === 'committed' && rollback.required && rollback.status === 'prepared') {
    // A recovery reference prepared before the mutation becomes available once the mutation is
    // committed. This is a lifecycle fact, not a change to the authority payload.
    rollback.status = 'available';
  }
  const times: ActionReceiptTimes = { preparedAt: record.times.preparedAt };
  if (record.times.committedAt) times.committedAt = record.times.committedAt;
  if (record.times.failedAt) times.failedAt = record.times.failedAt;
  if (record.times.rolledBackAt) times.rolledBackAt = record.times.rolledBackAt;
  if (record.times.incompleteAt) times.incompleteAt = record.times.incompleteAt;
  if (record.times.compensatedAt) times.compensatedAt = record.times.compensatedAt;
  if (input.to === 'committed') times.committedAt = at;
  if (input.to === 'failed') times.failedAt = at;
  if (input.to === 'rolled_back') times.rolledBackAt = at;
  if (input.to === 'incomplete') times.incompleteAt = at;
  if (input.to === 'compensated') times.compensatedAt = at;
  const next: ActionReceipt = {
    ...record,
    validation,
    rollback,
    status: input.to,
    times,
    transition: {
      from: input.to === record.status
        ? record.transition.from
        : (record.status === 'committed' ? 'committed' : 'prepared'),
      to: input.to,
      at,
    },
    transitionHash: '0'.repeat(64),
    ...(input.to === 'committed' || input.to === 'compensated' || input.to === 'incomplete' ? { after } : {}),
    ...(input.to === 'failed' || input.to === 'rolled_back' || input.to === 'incomplete' ? { failure } : {}),
    hash: '0'.repeat(64),
  };
  next.transitionHash = hashActionReceiptTransition(next);
  next.hash = hashActionReceipt(next);
  return assertValidActionReceipt(next);
}

/** Apply exactly one permitted lifecycle transition, or replay the identical transition. */
export function transitionActionReceipt(record: ActionReceipt, input: ActionReceiptTransitionInput): ActionReceipt {
  const current = assertValidActionReceipt(record);
  return buildTransition(current, input);
}

export function actionReceiptIdFor(input: ActionReceiptPrepareInput): string {
  return `ar_${hashActionReceiptOperationIdentity(input)}`;
}
