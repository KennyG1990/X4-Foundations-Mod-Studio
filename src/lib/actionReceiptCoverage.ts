import type { ActionReceiptPrepareInput, ReceiptHttpMethod } from './actionReceipt.js';
import { FORGE_CAPABILITY_EFFECTS, type ForgeCapabilityEffect } from './forgeCapabilities.js';

export const ACTION_RECEIPT_COVERAGE_SCHEMA = 'forge.action-receipt-coverage.v1' as const;

export type ReceiptCoverageSemanticClass =
  | 'read-analysis-only'
  | 'audit-retention'
  | 'durable-local-mutation'
  | 'session-credential-mutation'
  | 'external-network'
  | 'external-spend'
  | 'external-publish'
  | 'external-process'
  | 'fixture-cache'
  | 'conditional-dev-only';

export type ReceiptCoveragePolicy =
  | 'receipt-required'
  | 'receipt-exempt'
  | 'separately-governed'
  | 'refused';

export type ReceiptCoverageScope = 'global' | 'profile' | 'workspace';

export type ReceiptCoverageSurfaceKind =
  | 'filesystem-writer'
  | 'host-store'
  | 'browser-output'
  | 'sqlite'
  | 'external-effect';

export type ReceiptCoverageHistory = 'quiet' | 'visible' | 'none';

export type ReceiptCoverageEffect = ForgeCapabilityEffect | 'process' | 'session-write';

export type ReceiptCoverageCapabilityIdentity =
  | {
      kind: 'canonical';
      id: string;
      version: number;
    }
  | {
      kind: 'reviewed-legacy';
      id: string;
      reviewRef: string;
    };

export interface ActionReceiptCoverageRouteEntry {
  routeKey: string;
  method: string;
  template: string;
  owner: string;
  resourceClass: string;
  sourceRef: string;
  integrationBatch: string;
  history: ReceiptCoverageHistory;
  capability: ReceiptCoverageCapabilityIdentity;
  semanticClass: ReceiptCoverageSemanticClass;
  policy: ReceiptCoveragePolicy;
  effects: ReceiptCoverageEffect[];
  authorityScopes: ReceiptCoverageScope[];
}

export interface ActionReceiptCoverageSurfaceEntry {
  id: string;
  kind: ReceiptCoverageSurfaceKind;
  owner: string;
  sourceRef: string;
  integrationBatch: string;
  semanticClass: ReceiptCoverageSemanticClass;
  policy: ReceiptCoveragePolicy;
  effects: ReceiptCoverageEffect[];
  authorityScopes: ReceiptCoverageScope[];
}

export interface ActionReceiptCoverageManifest {
  schema: typeof ACTION_RECEIPT_COVERAGE_SCHEMA;
  routes: ActionReceiptCoverageRouteEntry[];
  surfaces: ActionReceiptCoverageSurfaceEntry[];
}

export interface DiscoveredReceiptCoverageCapability {
  id: string;
  version: number;
  effects: ForgeCapabilityEffect[];
}

export interface DiscoveredReceiptCoverageRoute {
  routeKey: string;
  method: string;
  template: string;
  owner: string;
  resourceClass: string;
  sourceRef: string;
  history: ReceiptCoverageHistory;
  canonicalCapability?: DiscoveredReceiptCoverageCapability;
}

export interface DiscoveredReceiptCoverageSurface {
  id: string;
  kind: ReceiptCoverageSurfaceKind;
  owner: string;
  sourceRef: string;
}

export interface DiscoveredActionReceiptCoverageInventory {
  routes: DiscoveredReceiptCoverageRoute[];
  surfaces: DiscoveredReceiptCoverageSurface[];
}

export type ActionReceiptCoverageValidationErrorCode =
  | 'ACTION_RECEIPT_COVERAGE_ARRAY_INVALID'
  | 'ACTION_RECEIPT_COVERAGE_AUTHORITY_SCOPE_INVALID'
  | 'ACTION_RECEIPT_COVERAGE_CANONICAL_EFFECT_MISMATCH'
  | 'ACTION_RECEIPT_COVERAGE_CAPABILITY_MISMATCH'
  | 'ACTION_RECEIPT_COVERAGE_CAPABILITY_VERSION_INVALID'
  | 'ACTION_RECEIPT_COVERAGE_DUPLICATE_EFFECT'
  | 'ACTION_RECEIPT_COVERAGE_DUPLICATE_ROUTE'
  | 'ACTION_RECEIPT_COVERAGE_DUPLICATE_SCOPE'
  | 'ACTION_RECEIPT_COVERAGE_DUPLICATE_SURFACE'
  | 'ACTION_RECEIPT_COVERAGE_EFFECT_INVALID'
  | 'ACTION_RECEIPT_COVERAGE_ENUM_INVALID'
  | 'ACTION_RECEIPT_COVERAGE_EXTERNAL_SURFACE_INVALID'
  | 'ACTION_RECEIPT_COVERAGE_FIELD_REQUIRED'
  | 'ACTION_RECEIPT_COVERAGE_MISSING_ROUTE'
  | 'ACTION_RECEIPT_COVERAGE_MISSING_SURFACE'
  | 'ACTION_RECEIPT_COVERAGE_POLICY_MISMATCH'
  | 'ACTION_RECEIPT_COVERAGE_QUIET_MUTATION'
  | 'ACTION_RECEIPT_COVERAGE_ROUTE_KEY_MISMATCH'
  | 'ACTION_RECEIPT_COVERAGE_ROUTE_METHOD_INVALID'
  | 'ACTION_RECEIPT_COVERAGE_ROUTE_MISMATCH'
  | 'ACTION_RECEIPT_COVERAGE_ROUTE_TEMPLATE_INVALID'
  | 'ACTION_RECEIPT_COVERAGE_SCHEMA_MISMATCH'
  | 'ACTION_RECEIPT_COVERAGE_SEMANTIC_EFFECT_MISMATCH'
  | 'ACTION_RECEIPT_COVERAGE_STALE_ROUTE'
  | 'ACTION_RECEIPT_COVERAGE_STALE_SURFACE'
  | 'ACTION_RECEIPT_COVERAGE_STRING_INVALID'
  | 'ACTION_RECEIPT_COVERAGE_SURFACE_MISMATCH'
  | 'ACTION_RECEIPT_COVERAGE_UNKNOWN_FIELD'
  | 'ACTION_RECEIPT_COVERAGE_VALIDATION_INTERNAL'
  | 'ACTION_RECEIPT_COVERAGE_VALUE_INVALID';

export type ActionReceiptCoverageValidationError = {
  code: ActionReceiptCoverageValidationErrorCode;
  path: string;
  message: string;
};

export type ActionReceiptCoverageValidationResult =
  | {
      ok: true;
      errors: ActionReceiptCoverageValidationError[];
    }
  | {
      ok: false;
      errors: ActionReceiptCoverageValidationError[];
    };

export interface ActionReceiptCoverageResolverRequest {
  inventory: DiscoveredActionReceiptCoverageInventory;
  routeKey: string;
  actor: ActionReceiptPrepareInput['actor'];
  client: ActionReceiptPrepareInput['client'];
  authority: ActionReceiptPrepareInput['authority'];
  declaredEffects: ActionReceiptPrepareInput['effects']['declared'];
  input: ActionReceiptPrepareInput['input'];
  validation: ActionReceiptPrepareInput['validation'];
  rollback: ActionReceiptPrepareInput['rollback'];
  metadata?: ActionReceiptPrepareInput['metadata'];
  preparedAt?: ActionReceiptPrepareInput['preparedAt'];
}

export type ActionReceiptCoverageRefusalCode =
  | 'ACTION_RECEIPT_COVERAGE_UNKNOWN_ROUTE'
  | 'ACTION_RECEIPT_COVERAGE_POLICY_REFUSED'
  | 'ACTION_RECEIPT_COVERAGE_SCOPE_DENIED'
  | 'ACTION_RECEIPT_COVERAGE_EFFECT_MISMATCH'
  | 'ACTION_RECEIPT_COVERAGE_CAPABILITY_MISMATCH'
  | 'ACTION_RECEIPT_COVERAGE_MANIFEST_INVALID';

export type ActionReceiptCoverageResolverResult =
  | {
      policy: 'receipt-required';
      prepareInput: ActionReceiptPrepareInput;
    }
  | {
      policy: 'receipt-exempt' | 'separately-governed';
    }
  | {
      policy: 'refused';
      code: ActionReceiptCoverageRefusalCode;
      message: string;
    };

const HTTP_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD']);
const SEMANTIC_CLASSES = new Set<ReceiptCoverageSemanticClass>([
  'read-analysis-only', 'audit-retention', 'durable-local-mutation', 'session-credential-mutation',
  'external-network', 'external-spend', 'external-publish', 'external-process', 'fixture-cache',
  'conditional-dev-only',
]);
const POLICIES = new Set<ReceiptCoveragePolicy>([
  'receipt-required', 'receipt-exempt', 'separately-governed', 'refused',
]);
const SCOPES = new Set<ReceiptCoverageScope>(['global', 'profile', 'workspace']);
const SURFACE_KINDS = new Set<ReceiptCoverageSurfaceKind>([
  'filesystem-writer', 'host-store', 'browser-output', 'sqlite', 'external-effect',
]);
const HISTORIES = new Set<ReceiptCoverageHistory>(['quiet', 'visible', 'none']);
const FORGE_EFFECTS = new Set<ForgeCapabilityEffect>(FORGE_CAPABILITY_EFFECTS);
const COVERAGE_EFFECTS = new Set<ReceiptCoverageEffect>([...FORGE_CAPABILITY_EFFECTS, 'process', 'session-write']);
const LOCAL_MUTATION_EFFECTS = new Set<ReceiptCoverageEffect>([
  'workspace-write', 'filesystem-write', 'package', 'deploy', 'delete', 'credential', 'session-write',
]);
const EXTERNAL_SURFACE_CLASSES = new Set<ReceiptCoverageSemanticClass>([
  'external-network', 'external-spend', 'external-publish', 'external-process', 'conditional-dev-only',
]);

const MANIFEST_FIELDS = ['schema', 'routes', 'surfaces'];
const ROUTE_FIELDS = [
  'routeKey', 'method', 'template', 'owner', 'resourceClass', 'sourceRef', 'integrationBatch', 'history',
  'capability', 'semanticClass', 'policy', 'effects', 'authorityScopes',
];
const SURFACE_FIELDS = [
  'id', 'kind', 'owner', 'sourceRef', 'integrationBatch', 'semanticClass', 'policy', 'effects',
  'authorityScopes',
];
const DISCOVERED_ROUTE_FIELDS = [
  'routeKey', 'method', 'template', 'owner', 'resourceClass', 'sourceRef', 'history', 'canonicalCapability',
];
const DISCOVERED_SURFACE_FIELDS = ['id', 'kind', 'owner', 'sourceRef'];

type ParsedRoute = ActionReceiptCoverageRouteEntry & { path: string };
type ParsedSurface = ActionReceiptCoverageSurfaceEntry & { path: string };
type ParsedDiscoveredRoute = DiscoveredReceiptCoverageRoute & { path: string };
type ParsedDiscoveredSurface = DiscoveredReceiptCoverageSurface & { path: string };

function compareOrdinal(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function addError(
  errors: ActionReceiptCoverageValidationError[],
  code: ActionReceiptCoverageValidationErrorCode,
  path: string,
  message: string,
): void {
  errors.push({ code, path, message });
}

function exactFields(
  value: Record<string, unknown>,
  allowed: readonly string[],
  path: string,
  errors: ActionReceiptCoverageValidationError[],
): void {
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(value).sort(compareOrdinal)) {
    if (!allowedSet.has(key)) {
      addError(errors, 'ACTION_RECEIPT_COVERAGE_UNKNOWN_FIELD', `${path}.${key}`, `Unknown field ${key}.`);
    }
  }
}

function requiredString(
  value: Record<string, unknown>,
  key: string,
  path: string,
  errors: ActionReceiptCoverageValidationError[],
): string | undefined {
  const fieldPath = `${path}.${key}`;
  if (!Object.prototype.hasOwnProperty.call(value, key)) {
    addError(errors, 'ACTION_RECEIPT_COVERAGE_FIELD_REQUIRED', fieldPath, `${key} is required.`);
    return undefined;
  }
  const field = value[key];
  if (typeof field !== 'string' || field.length === 0 || field !== field.trim()) {
    addError(errors, 'ACTION_RECEIPT_COVERAGE_STRING_INVALID', fieldPath, `${key} must be a nonempty trimmed string.`);
    return undefined;
  }
  return field;
}

function requiredArray(
  value: Record<string, unknown>,
  key: string,
  path: string,
  errors: ActionReceiptCoverageValidationError[],
): unknown[] | undefined {
  const fieldPath = `${path}.${key}`;
  if (!Object.prototype.hasOwnProperty.call(value, key)) {
    addError(errors, 'ACTION_RECEIPT_COVERAGE_FIELD_REQUIRED', fieldPath, `${key} is required.`);
    return undefined;
  }
  if (!Array.isArray(value[key])) {
    addError(errors, 'ACTION_RECEIPT_COVERAGE_ARRAY_INVALID', fieldPath, `${key} must be an array.`);
    return undefined;
  }
  return value[key];
}

function requiredEnum<T extends string>(
  value: Record<string, unknown>,
  key: string,
  path: string,
  allowed: ReadonlySet<string>,
  errors: ActionReceiptCoverageValidationError[],
): T | undefined {
  const field = requiredString(value, key, path, errors);
  if (field === undefined) return undefined;
  if (!allowed.has(field)) {
    addError(errors, 'ACTION_RECEIPT_COVERAGE_ENUM_INVALID', `${path}.${key}`, `${key} has an unsupported value.`);
    return undefined;
  }
  return field as T;
}

function requiredStringArray<T extends string>(
  value: Record<string, unknown>,
  key: string,
  path: string,
  allowed: ReadonlySet<string>,
  requireNonempty: boolean,
  invalidCode: ActionReceiptCoverageValidationErrorCode,
  duplicateCode: ActionReceiptCoverageValidationErrorCode,
  errors: ActionReceiptCoverageValidationError[],
): T[] | undefined {
  const array = requiredArray(value, key, path, errors);
  if (array === undefined) return undefined;
  if (requireNonempty && array.length === 0) {
    addError(errors, invalidCode, `${path}.${key}`, `${key} must not be empty.`);
  }
  const result: T[] = [];
  const seen = new Set<string>();
  array.forEach((entry, index) => {
    const entryPath = `${path}.${key}[${index}]`;
    if (typeof entry !== 'string' || entry.length === 0 || entry !== entry.trim() || !allowed.has(entry)) {
      addError(errors, invalidCode, entryPath, `${key} contains an unsupported value.`);
      return;
    }
    if (seen.has(entry)) addError(errors, duplicateCode, entryPath, `${key} contains duplicate ${entry}.`);
    seen.add(entry);
    result.push(entry as T);
  });
  return result;
}

function parseCapabilityIdentity(
  value: unknown,
  path: string,
  errors: ActionReceiptCoverageValidationError[],
): ReceiptCoverageCapabilityIdentity | undefined {
  if (!isPlainObject(value)) {
    addError(errors, 'ACTION_RECEIPT_COVERAGE_VALUE_INVALID', path, 'capability must be a plain object.');
    return undefined;
  }
  const start = errors.length;
  const kind = requiredEnum<'canonical' | 'reviewed-legacy'>(
    value, 'kind', path, new Set(['canonical', 'reviewed-legacy']), errors,
  );
  exactFields(value, kind === 'canonical' ? ['kind', 'id', 'version']
    : kind === 'reviewed-legacy' ? ['kind', 'id', 'reviewRef']
      : ['kind', 'id', 'version', 'reviewRef'], path, errors);
  const id = requiredString(value, 'id', path, errors);
  if (kind === 'canonical') {
    const version = value.version;
    if (!Object.prototype.hasOwnProperty.call(value, 'version')) {
      addError(errors, 'ACTION_RECEIPT_COVERAGE_FIELD_REQUIRED', `${path}.version`, 'version is required.');
    } else if (typeof version !== 'number' || !Number.isInteger(version) || version <= 0) {
      addError(errors, 'ACTION_RECEIPT_COVERAGE_CAPABILITY_VERSION_INVALID', `${path}.version`, 'version must be a positive integer.');
    }
    if (errors.length > start || id === undefined || typeof version !== 'number') return undefined;
    return { kind, id, version };
  }
  if (kind === 'reviewed-legacy') {
    const reviewRef = requiredString(value, 'reviewRef', path, errors);
    if (errors.length > start || id === undefined || reviewRef === undefined) return undefined;
    return { kind, id, reviewRef };
  }
  return undefined;
}

function validateRouteIdentity(
  routeKey: string | undefined,
  method: string | undefined,
  template: string | undefined,
  path: string,
  errors: ActionReceiptCoverageValidationError[],
): void {
  if (method !== undefined && !HTTP_METHODS.has(method)) {
    addError(errors, 'ACTION_RECEIPT_COVERAGE_ROUTE_METHOD_INVALID', `${path}.method`, 'method must be a supported uppercase HTTP method.');
  }
  if (template !== undefined && (!template.startsWith('/') || /\s/.test(template))) {
    addError(errors, 'ACTION_RECEIPT_COVERAGE_ROUTE_TEMPLATE_INVALID', `${path}.template`, 'template must be an absolute whitespace-free route template.');
  }
  if (routeKey !== undefined && method !== undefined && template !== undefined && routeKey !== `${method} ${template}`) {
    addError(errors, 'ACTION_RECEIPT_COVERAGE_ROUTE_KEY_MISMATCH', `${path}.routeKey`, 'routeKey must exactly equal method, one space, and template.');
  }
}

function validatePolicy(
  semanticClass: ReceiptCoverageSemanticClass,
  policy: ReceiptCoveragePolicy,
  effects: ReceiptCoverageEffect[],
  path: string,
  errors: ActionReceiptCoverageValidationError[],
): void {
  const effectSet = new Set(effects);
  const requirePolicy = (allowed: readonly ReceiptCoveragePolicy[]): void => {
    if (!allowed.includes(policy)) {
      addError(errors, 'ACTION_RECEIPT_COVERAGE_POLICY_MISMATCH', `${path}.policy`, `${semanticClass} does not allow policy ${policy}.`);
    }
  };
  const requireEffect = (effect: ReceiptCoverageEffect): void => {
    if (!effectSet.has(effect)) {
      addError(errors, 'ACTION_RECEIPT_COVERAGE_SEMANTIC_EFFECT_MISMATCH', `${path}.effects`, `${semanticClass} requires effect ${effect}.`);
    }
  };
  if (semanticClass === 'read-analysis-only') {
    const invalid = effects.filter(effect => effect !== 'read' && effect !== 'analyze');
    if (invalid.length > 0) {
      addError(errors, 'ACTION_RECEIPT_COVERAGE_SEMANTIC_EFFECT_MISMATCH', `${path}.effects`, 'read-analysis-only permits only read and analyze effects.');
    }
    requirePolicy(['receipt-exempt', 'separately-governed']);
  } else if (semanticClass === 'audit-retention') {
    const allowed = new Set<ReceiptCoverageEffect>(['read', 'analyze', 'audit-write', 'audit-retention-delete']);
    if (effects.some(effect => !allowed.has(effect))) {
      addError(errors, 'ACTION_RECEIPT_COVERAGE_SEMANTIC_EFFECT_MISMATCH', `${path}.effects`, 'audit-retention contains a non-audit effect.');
    }
    if (!effectSet.has('audit-write') && !effectSet.has('audit-retention-delete')) {
      addError(errors, 'ACTION_RECEIPT_COVERAGE_SEMANTIC_EFFECT_MISMATCH', `${path}.effects`, 'audit-retention requires audit-write or audit-retention-delete.');
    }
    requirePolicy(['separately-governed', 'receipt-required']);
  } else if (semanticClass === 'durable-local-mutation') {
    if (!effects.some(effect => ['workspace-write', 'filesystem-write', 'package', 'deploy', 'delete'].includes(effect))) {
      addError(errors, 'ACTION_RECEIPT_COVERAGE_SEMANTIC_EFFECT_MISMATCH', `${path}.effects`, 'durable-local-mutation requires a durable local mutation effect.');
    }
    requirePolicy(['receipt-required', 'refused']);
  } else if (semanticClass === 'session-credential-mutation') {
    if (!effectSet.has('credential') && !effectSet.has('session-write')) {
      addError(errors, 'ACTION_RECEIPT_COVERAGE_SEMANTIC_EFFECT_MISMATCH', `${path}.effects`, 'session-credential-mutation requires credential or session-write.');
    }
    requirePolicy(['receipt-required', 'refused']);
  } else if (semanticClass === 'external-network') {
    requireEffect('network');
    requirePolicy(['receipt-required', 'refused']);
  } else if (semanticClass === 'external-spend') {
    requireEffect('spend');
    requireEffect('network');
    requirePolicy(['receipt-required', 'refused']);
  } else if (semanticClass === 'external-publish') {
    requireEffect('publish');
    requirePolicy(['receipt-required', 'refused']);
  } else if (semanticClass === 'external-process') {
    requireEffect('process');
    requirePolicy(['receipt-required', 'refused']);
  } else if (semanticClass === 'fixture-cache') {
    const forbidden = new Set<ReceiptCoverageEffect>(['network', 'spend', 'publish', 'process', 'credential']);
    if (effects.some(effect => forbidden.has(effect))) {
      addError(errors, 'ACTION_RECEIPT_COVERAGE_SEMANTIC_EFFECT_MISMATCH', `${path}.effects`, 'fixture-cache cannot carry external or credential effects.');
    }
    requirePolicy(['receipt-exempt', 'separately-governed']);
  } else {
    requirePolicy(['receipt-required', 'refused']);
  }
}

function parseReviewedRoute(
  value: unknown,
  index: number,
  errors: ActionReceiptCoverageValidationError[],
): ParsedRoute | undefined {
  const path = `$.routes[${index}]`;
  if (!isPlainObject(value)) {
    addError(errors, 'ACTION_RECEIPT_COVERAGE_VALUE_INVALID', path, 'route entry must be a plain object.');
    return undefined;
  }
  const start = errors.length;
  exactFields(value, ROUTE_FIELDS, path, errors);
  const routeKey = requiredString(value, 'routeKey', path, errors);
  const method = requiredString(value, 'method', path, errors);
  const template = requiredString(value, 'template', path, errors);
  const owner = requiredString(value, 'owner', path, errors);
  const resourceClass = requiredString(value, 'resourceClass', path, errors);
  const sourceRef = requiredString(value, 'sourceRef', path, errors);
  const integrationBatch = requiredString(value, 'integrationBatch', path, errors);
  const history = requiredEnum<ReceiptCoverageHistory>(value, 'history', path, HISTORIES, errors);
  const capability = Object.prototype.hasOwnProperty.call(value, 'capability')
    ? parseCapabilityIdentity(value.capability, `${path}.capability`, errors)
    : undefined;
  if (!Object.prototype.hasOwnProperty.call(value, 'capability')) {
    addError(errors, 'ACTION_RECEIPT_COVERAGE_FIELD_REQUIRED', `${path}.capability`, 'capability is required.');
  }
  const semanticClass = requiredEnum<ReceiptCoverageSemanticClass>(value, 'semanticClass', path, SEMANTIC_CLASSES, errors);
  const policy = requiredEnum<ReceiptCoveragePolicy>(value, 'policy', path, POLICIES, errors);
  const effects = requiredStringArray<ReceiptCoverageEffect>(
    value, 'effects', path, COVERAGE_EFFECTS, true, 'ACTION_RECEIPT_COVERAGE_EFFECT_INVALID',
    'ACTION_RECEIPT_COVERAGE_DUPLICATE_EFFECT', errors,
  );
  const authorityScopes = requiredStringArray<ReceiptCoverageScope>(
    value, 'authorityScopes', path, SCOPES, true, 'ACTION_RECEIPT_COVERAGE_AUTHORITY_SCOPE_INVALID',
    'ACTION_RECEIPT_COVERAGE_DUPLICATE_SCOPE', errors,
  );
  validateRouteIdentity(routeKey, method, template, path, errors);
  if (errors.length > start || routeKey === undefined || method === undefined || template === undefined
    || owner === undefined || resourceClass === undefined || sourceRef === undefined || integrationBatch === undefined
    || history === undefined || capability === undefined || semanticClass === undefined || policy === undefined
    || effects === undefined || authorityScopes === undefined) return undefined;
  const route: ParsedRoute = {
    path, routeKey, method, template, owner, resourceClass, sourceRef, integrationBatch, history, capability,
    semanticClass, policy, effects, authorityScopes,
  };
  validatePolicy(semanticClass, policy, effects, path, errors);
  if (capability.kind === 'reviewed-legacy' && capability.id !== routeKey) {
    addError(errors, 'ACTION_RECEIPT_COVERAGE_CAPABILITY_MISMATCH', `${path}.capability.id`, 'reviewed-legacy capability id must exactly equal routeKey.');
  }
  if (history === 'quiet') {
    const localEffects = effects.filter(effect => LOCAL_MUTATION_EFFECTS.has(effect));
    if (localEffects.length > 0) {
      addError(errors, 'ACTION_RECEIPT_COVERAGE_QUIET_MUTATION', `${path}.history`, 'quiet history cannot carry a local durable mutation effect.');
    }
  }
  return route;
}

function parseReviewedSurface(
  value: unknown,
  index: number,
  errors: ActionReceiptCoverageValidationError[],
): ParsedSurface | undefined {
  const path = `$.surfaces[${index}]`;
  if (!isPlainObject(value)) {
    addError(errors, 'ACTION_RECEIPT_COVERAGE_VALUE_INVALID', path, 'surface entry must be a plain object.');
    return undefined;
  }
  const start = errors.length;
  exactFields(value, SURFACE_FIELDS, path, errors);
  const id = requiredString(value, 'id', path, errors);
  const kind = requiredEnum<ReceiptCoverageSurfaceKind>(value, 'kind', path, SURFACE_KINDS, errors);
  const owner = requiredString(value, 'owner', path, errors);
  const sourceRef = requiredString(value, 'sourceRef', path, errors);
  const integrationBatch = requiredString(value, 'integrationBatch', path, errors);
  const semanticClass = requiredEnum<ReceiptCoverageSemanticClass>(value, 'semanticClass', path, SEMANTIC_CLASSES, errors);
  const policy = requiredEnum<ReceiptCoveragePolicy>(value, 'policy', path, POLICIES, errors);
  const effects = requiredStringArray<ReceiptCoverageEffect>(
    value, 'effects', path, COVERAGE_EFFECTS, true, 'ACTION_RECEIPT_COVERAGE_EFFECT_INVALID',
    'ACTION_RECEIPT_COVERAGE_DUPLICATE_EFFECT', errors,
  );
  const authorityScopes = requiredStringArray<ReceiptCoverageScope>(
    value, 'authorityScopes', path, SCOPES, true, 'ACTION_RECEIPT_COVERAGE_AUTHORITY_SCOPE_INVALID',
    'ACTION_RECEIPT_COVERAGE_DUPLICATE_SCOPE', errors,
  );
  if (errors.length > start || id === undefined || kind === undefined || owner === undefined || sourceRef === undefined
    || integrationBatch === undefined || semanticClass === undefined || policy === undefined || effects === undefined
    || authorityScopes === undefined) return undefined;
  const surface: ParsedSurface = {
    path, id, kind, owner, sourceRef, integrationBatch, semanticClass, policy, effects, authorityScopes,
  };
  validatePolicy(semanticClass, policy, effects, path, errors);
  if (kind === 'external-effect'
    && (!EXTERNAL_SURFACE_CLASSES.has(semanticClass)
      || policy === 'receipt-exempt' || policy === 'separately-governed')) {
    addError(errors, 'ACTION_RECEIPT_COVERAGE_EXTERNAL_SURFACE_INVALID', path, 'external-effect surface requires an external or conditional-dev-only semantic class with receipt-required or refused policy.');
  }
  return surface;
}

function parseDiscoveredCapability(
  value: unknown,
  path: string,
  errors: ActionReceiptCoverageValidationError[],
): DiscoveredReceiptCoverageCapability | undefined {
  if (!isPlainObject(value)) {
    addError(errors, 'ACTION_RECEIPT_COVERAGE_VALUE_INVALID', path, 'canonicalCapability must be a plain object.');
    return undefined;
  }
  const start = errors.length;
  exactFields(value, ['id', 'version', 'effects'], path, errors);
  const id = requiredString(value, 'id', path, errors);
  const version = value.version;
  if (!Object.prototype.hasOwnProperty.call(value, 'version')) {
    addError(errors, 'ACTION_RECEIPT_COVERAGE_FIELD_REQUIRED', `${path}.version`, 'version is required.');
  } else if (typeof version !== 'number' || !Number.isInteger(version) || version <= 0) {
    addError(errors, 'ACTION_RECEIPT_COVERAGE_CAPABILITY_VERSION_INVALID', `${path}.version`, 'version must be a positive integer.');
  }
  const effects = requiredStringArray<ForgeCapabilityEffect>(
    value, 'effects', path, FORGE_EFFECTS, false, 'ACTION_RECEIPT_COVERAGE_EFFECT_INVALID',
    'ACTION_RECEIPT_COVERAGE_DUPLICATE_EFFECT', errors,
  );
  if (errors.length > start || id === undefined || typeof version !== 'number' || effects === undefined) return undefined;
  return { id, version, effects };
}

function parseDiscoveredRoute(
  value: unknown,
  index: number,
  errors: ActionReceiptCoverageValidationError[],
): ParsedDiscoveredRoute | undefined {
  const path = `inventory.routes[${index}]`;
  if (!isPlainObject(value)) {
    addError(errors, 'ACTION_RECEIPT_COVERAGE_VALUE_INVALID', path, 'discovered route must be a plain object.');
    return undefined;
  }
  const start = errors.length;
  exactFields(value, DISCOVERED_ROUTE_FIELDS, path, errors);
  const routeKey = requiredString(value, 'routeKey', path, errors);
  const method = requiredString(value, 'method', path, errors);
  const template = requiredString(value, 'template', path, errors);
  const owner = requiredString(value, 'owner', path, errors);
  const resourceClass = requiredString(value, 'resourceClass', path, errors);
  const sourceRef = requiredString(value, 'sourceRef', path, errors);
  const history = requiredEnum<ReceiptCoverageHistory>(value, 'history', path, HISTORIES, errors);
  const canonicalCapability = Object.prototype.hasOwnProperty.call(value, 'canonicalCapability')
    ? parseDiscoveredCapability(value.canonicalCapability, `${path}.canonicalCapability`, errors)
    : undefined;
  validateRouteIdentity(routeKey, method, template, path, errors);
  if (errors.length > start || routeKey === undefined || method === undefined || template === undefined
    || owner === undefined || resourceClass === undefined || sourceRef === undefined || history === undefined) return undefined;
  return { path, routeKey, method, template, owner, resourceClass, sourceRef, history, canonicalCapability };
}

function parseDiscoveredSurface(
  value: unknown,
  index: number,
  errors: ActionReceiptCoverageValidationError[],
): ParsedDiscoveredSurface | undefined {
  const path = `inventory.surfaces[${index}]`;
  if (!isPlainObject(value)) {
    addError(errors, 'ACTION_RECEIPT_COVERAGE_VALUE_INVALID', path, 'discovered surface must be a plain object.');
    return undefined;
  }
  const start = errors.length;
  exactFields(value, DISCOVERED_SURFACE_FIELDS, path, errors);
  const id = requiredString(value, 'id', path, errors);
  const kind = requiredEnum<ReceiptCoverageSurfaceKind>(value, 'kind', path, SURFACE_KINDS, errors);
  const owner = requiredString(value, 'owner', path, errors);
  const sourceRef = requiredString(value, 'sourceRef', path, errors);
  if (errors.length > start || id === undefined || kind === undefined || owner === undefined || sourceRef === undefined) return undefined;
  return { path, id, kind, owner, sourceRef };
}

function addDuplicates<T extends { path: string }>(
  entries: T[],
  identity: (entry: T) => string,
  pathFor: (entry: T) => string,
  code: 'ACTION_RECEIPT_COVERAGE_DUPLICATE_ROUTE' | 'ACTION_RECEIPT_COVERAGE_DUPLICATE_SURFACE',
  label: string,
  errors: ActionReceiptCoverageValidationError[],
): Map<string, T> {
  const result = new Map<string, T>();
  for (const entry of entries) {
    const key = identity(entry);
    const first = result.get(key);
    if (first !== undefined) {
      addError(errors, code, pathFor(entry), `Duplicate ${label} ${key}; first declared at ${pathFor(first)}.`);
    } else {
      result.set(key, entry);
    }
  }
  return result;
}

function parseManifest(
  value: unknown,
  errors: ActionReceiptCoverageValidationError[],
): { routes: ParsedRoute[]; surfaces: ParsedSurface[] } {
  if (!isPlainObject(value)) {
    addError(errors, 'ACTION_RECEIPT_COVERAGE_VALUE_INVALID', '$', 'manifest must be a plain object.');
    return { routes: [], surfaces: [] };
  }
  exactFields(value, MANIFEST_FIELDS, '$', errors);
  if (!Object.prototype.hasOwnProperty.call(value, 'schema')) {
    addError(errors, 'ACTION_RECEIPT_COVERAGE_FIELD_REQUIRED', '$.schema', 'schema is required.');
  } else if (value.schema !== ACTION_RECEIPT_COVERAGE_SCHEMA) {
    addError(errors, 'ACTION_RECEIPT_COVERAGE_SCHEMA_MISMATCH', '$.schema', `schema must equal ${ACTION_RECEIPT_COVERAGE_SCHEMA}.`);
  }
  const routeValues = requiredArray(value, 'routes', '$', errors) ?? [];
  const surfaceValues = requiredArray(value, 'surfaces', '$', errors) ?? [];
  return {
    routes: routeValues.map((entry, index) => parseReviewedRoute(entry, index, errors)).filter(entry => entry !== undefined),
    surfaces: surfaceValues.map((entry, index) => parseReviewedSurface(entry, index, errors)).filter(entry => entry !== undefined),
  };
}

function parseInventory(
  value: unknown,
  errors: ActionReceiptCoverageValidationError[],
): { routes: ParsedDiscoveredRoute[]; surfaces: ParsedDiscoveredSurface[] } {
  if (!isPlainObject(value)) {
    addError(errors, 'ACTION_RECEIPT_COVERAGE_VALUE_INVALID', 'inventory', 'inventory must be a plain object.');
    return { routes: [], surfaces: [] };
  }
  exactFields(value, ['routes', 'surfaces'], 'inventory', errors);
  const routeValues = requiredArray(value, 'routes', 'inventory', errors) ?? [];
  const surfaceValues = requiredArray(value, 'surfaces', 'inventory', errors) ?? [];
  return {
    routes: routeValues.map((entry, index) => parseDiscoveredRoute(entry, index, errors)).filter(entry => entry !== undefined),
    surfaces: surfaceValues.map((entry, index) => parseDiscoveredSurface(entry, index, errors)).filter(entry => entry !== undefined),
  };
}

function mismatch(
  code: 'ACTION_RECEIPT_COVERAGE_ROUTE_MISMATCH' | 'ACTION_RECEIPT_COVERAGE_SURFACE_MISMATCH',
  path: string,
  field: string,
  reviewed: string,
  discovered: string,
  errors: ActionReceiptCoverageValidationError[],
): void {
  if (reviewed !== discovered) {
    addError(errors, code, `${path}.${field}`, `${field} differs: reviewed ${JSON.stringify(reviewed)}, discovered ${JSON.stringify(discovered)}.`);
  }
}

function sameEffectSet(reviewed: ReceiptCoverageEffect[], discovered: ForgeCapabilityEffect[]): boolean {
  if (reviewed.length !== discovered.length) return false;
  const reviewedSet = new Set(reviewed);
  return reviewedSet.size === reviewed.length && discovered.every(effect => reviewedSet.has(effect));
}

function joinRoutes(
  reviewed: Map<string, ParsedRoute>,
  discovered: Map<string, ParsedDiscoveredRoute>,
  errors: ActionReceiptCoverageValidationError[],
): void {
  for (const [routeKey, route] of reviewed) {
    const found = discovered.get(routeKey);
    if (found === undefined) {
      addError(errors, 'ACTION_RECEIPT_COVERAGE_STALE_ROUTE', `${route.path}.routeKey`, `Reviewed route ${routeKey} was not discovered.`);
      continue;
    }
    mismatch('ACTION_RECEIPT_COVERAGE_ROUTE_MISMATCH', route.path, 'method', route.method, found.method, errors);
    mismatch('ACTION_RECEIPT_COVERAGE_ROUTE_MISMATCH', route.path, 'template', route.template, found.template, errors);
    mismatch('ACTION_RECEIPT_COVERAGE_ROUTE_MISMATCH', route.path, 'owner', route.owner, found.owner, errors);
    mismatch('ACTION_RECEIPT_COVERAGE_ROUTE_MISMATCH', route.path, 'resourceClass', route.resourceClass, found.resourceClass, errors);
    mismatch('ACTION_RECEIPT_COVERAGE_ROUTE_MISMATCH', route.path, 'sourceRef', route.sourceRef, found.sourceRef, errors);
    mismatch('ACTION_RECEIPT_COVERAGE_ROUTE_MISMATCH', route.path, 'history', route.history, found.history, errors);
    if (found.canonicalCapability !== undefined) {
      if (route.capability.kind !== 'canonical'
        || route.capability.id !== found.canonicalCapability.id
        || route.capability.version !== found.canonicalCapability.version) {
        addError(errors, 'ACTION_RECEIPT_COVERAGE_CAPABILITY_MISMATCH', `${route.path}.capability`, 'Reviewed canonical capability identity does not match discovery.');
      }
      if (!sameEffectSet(route.effects, found.canonicalCapability.effects)) {
        addError(errors, 'ACTION_RECEIPT_COVERAGE_CANONICAL_EFFECT_MISMATCH', `${route.path}.effects`, 'Reviewed effects do not exactly match canonical capability effects.');
      }
    } else if (route.capability.kind !== 'reviewed-legacy') {
      addError(errors, 'ACTION_RECEIPT_COVERAGE_CAPABILITY_MISMATCH', `${route.path}.capability`, 'Route without a canonical capability must use reviewed-legacy identity.');
    }
  }
  for (const [routeKey, route] of discovered) {
    if (!reviewed.has(routeKey)) {
      addError(errors, 'ACTION_RECEIPT_COVERAGE_MISSING_ROUTE', `${route.path}.routeKey`, `Discovered route ${routeKey} has no reviewed entry.`);
    }
  }
}

function joinSurfaces(
  reviewed: Map<string, ParsedSurface>,
  discovered: Map<string, ParsedDiscoveredSurface>,
  errors: ActionReceiptCoverageValidationError[],
): void {
  for (const [id, surface] of reviewed) {
    const found = discovered.get(id);
    if (found === undefined) {
      addError(errors, 'ACTION_RECEIPT_COVERAGE_STALE_SURFACE', `${surface.path}.id`, `Reviewed surface ${id} was not discovered.`);
      continue;
    }
    mismatch('ACTION_RECEIPT_COVERAGE_SURFACE_MISMATCH', surface.path, 'kind', surface.kind, found.kind, errors);
    mismatch('ACTION_RECEIPT_COVERAGE_SURFACE_MISMATCH', surface.path, 'owner', surface.owner, found.owner, errors);
    mismatch('ACTION_RECEIPT_COVERAGE_SURFACE_MISMATCH', surface.path, 'sourceRef', surface.sourceRef, found.sourceRef, errors);
  }
  for (const [id, surface] of discovered) {
    if (!reviewed.has(id)) {
      addError(errors, 'ACTION_RECEIPT_COVERAGE_MISSING_SURFACE', `${surface.path}.id`, `Discovered surface ${id} has no reviewed entry.`);
    }
  }
}

function sortedResult(errors: ActionReceiptCoverageValidationError[]): ActionReceiptCoverageValidationResult {
  const sorted = [...errors].sort((left, right) => compareOrdinal(left.code, right.code)
    || compareOrdinal(left.path, right.path)
    || compareOrdinal(left.message, right.message));
  return sorted.length === 0 ? { ok: true, errors: [] } : { ok: false, errors: sorted };
}

export function validateActionReceiptCoverageManifest(
  value: unknown,
  inventory: DiscoveredActionReceiptCoverageInventory,
): ActionReceiptCoverageValidationResult {
  const errors: ActionReceiptCoverageValidationError[] = [];
  try {
    const manifest = parseManifest(value, errors);
    const discovered = parseInventory(inventory, errors);
    const reviewedRoutes = addDuplicates(
      manifest.routes, route => route.routeKey, route => `${route.path}.routeKey`,
      'ACTION_RECEIPT_COVERAGE_DUPLICATE_ROUTE', 'route', errors,
    );
    const discoveredRoutes = addDuplicates(
      discovered.routes, route => route.routeKey, route => `${route.path}.routeKey`,
      'ACTION_RECEIPT_COVERAGE_DUPLICATE_ROUTE', 'route', errors,
    );
    const reviewedSurfaces = addDuplicates(
      manifest.surfaces, surface => surface.id, surface => `${surface.path}.id`,
      'ACTION_RECEIPT_COVERAGE_DUPLICATE_SURFACE', 'surface', errors,
    );
    const discoveredSurfaces = addDuplicates(
      discovered.surfaces, surface => surface.id, surface => `${surface.path}.id`,
      'ACTION_RECEIPT_COVERAGE_DUPLICATE_SURFACE', 'surface', errors,
    );
    joinRoutes(reviewedRoutes, discoveredRoutes, errors);
    joinSurfaces(reviewedSurfaces, discoveredSurfaces, errors);
  } catch {
    addError(errors, 'ACTION_RECEIPT_COVERAGE_VALIDATION_INTERNAL', '$', 'Validation could not inspect the supplied values.');
  }
  return sortedResult(errors);
}

function refuseResolution(
  code: ActionReceiptCoverageRefusalCode,
  message: string,
): ActionReceiptCoverageResolverResult {
  return { policy: 'refused', code, message };
}

function declaredEffectIdsMatch(
  declaredEffects: unknown,
  reviewedEffects: readonly ReceiptCoverageEffect[],
): declaredEffects is ActionReceiptPrepareInput['effects']['declared'] {
  if (!Array.isArray(declaredEffects) || declaredEffects.length === 0) return false;
  const declaredIds = new Set<string>();
  for (const effect of declaredEffects) {
    if (!isPlainObject(effect)) return false;
    const id = effect.id;
    if (typeof id !== 'string' || id.length === 0 || id !== id.trim() || declaredIds.has(id)) return false;
    declaredIds.add(id);
  }
  return declaredIds.size === reviewedEffects.length
    && reviewedEffects.every(effect => declaredIds.has(effect));
}

export function resolveActionReceiptPolicy(
  manifest: unknown,
  request: ActionReceiptCoverageResolverRequest,
): ActionReceiptCoverageResolverResult {
  try {
    const validation = validateActionReceiptCoverageManifest(manifest, request.inventory);
    if (!validation.ok) {
      const capabilityMismatch = validation.errors.some(error =>
        error.code === 'ACTION_RECEIPT_COVERAGE_CAPABILITY_MISMATCH'
        || error.code === 'ACTION_RECEIPT_COVERAGE_CANONICAL_EFFECT_MISMATCH');
      return capabilityMismatch
        ? refuseResolution(
          'ACTION_RECEIPT_COVERAGE_CAPABILITY_MISMATCH',
          'Action-receipt coverage capability does not match the discovered inventory.',
        )
        : refuseResolution(
          'ACTION_RECEIPT_COVERAGE_MANIFEST_INVALID',
          'Action-receipt coverage manifest or inventory is invalid.',
        );
    }

    const reviewedManifest = manifest as ActionReceiptCoverageManifest;
    const route = reviewedManifest.routes.find(entry => entry.routeKey === request.routeKey);
    if (route === undefined) {
      return refuseResolution(
        'ACTION_RECEIPT_COVERAGE_UNKNOWN_ROUTE',
        'No reviewed action-receipt coverage route matches the request.',
      );
    }
    if (!route.authorityScopes.includes(request.authority.scope)) {
      return refuseResolution(
        'ACTION_RECEIPT_COVERAGE_SCOPE_DENIED',
        'The request authority scope is not allowed for this route.',
      );
    }
    if (route.policy === 'refused') {
      return refuseResolution(
        'ACTION_RECEIPT_COVERAGE_POLICY_REFUSED',
        'The reviewed action-receipt policy refuses this route.',
      );
    }
    if (!declaredEffectIdsMatch(request.declaredEffects, route.effects)) {
      return refuseResolution(
        'ACTION_RECEIPT_COVERAGE_EFFECT_MISMATCH',
        'Declared effect identities do not exactly match the reviewed route effects.',
      );
    }
    if (route.policy === 'receipt-exempt' || route.policy === 'separately-governed') {
      return { policy: route.policy };
    }

    const capability: ActionReceiptPrepareInput['capability'] = route.capability.kind === 'canonical'
      ? { id: route.capability.id, version: String(route.capability.version) }
      : {
        legacyRoute: route.template,
        method: route.method as ReceiptHttpMethod,
        reviewed: true,
        reviewRef: route.capability.reviewRef,
      };
    return {
      policy: 'receipt-required',
      prepareInput: {
        actor: request.actor,
        client: request.client,
        capability,
        authority: request.authority,
        effects: { declared: request.declaredEffects },
        input: request.input,
        validation: request.validation,
        rollback: request.rollback,
        metadata: request.metadata,
        preparedAt: request.preparedAt,
      },
    };
  } catch {
    return refuseResolution(
      'ACTION_RECEIPT_COVERAGE_MANIFEST_INVALID',
      'Action-receipt coverage manifest or inventory is invalid.',
    );
  }
}
