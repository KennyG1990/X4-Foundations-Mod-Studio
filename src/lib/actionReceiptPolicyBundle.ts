import { createHash } from 'node:crypto';

import reviewedManifest from '../../config/action-receipt-coverage.json' with { type: 'json' };
import durableWriterAuthority from '../../config/durable-writers.json' with { type: 'json' };
import routeAuthority from '../../config/forge-route-dispositions.json' with { type: 'json' };

import {
  ACTION_RECEIPT_COVERAGE_SCHEMA,
  validateActionReceiptCoverageManifest,
  type ActionReceiptCoverageManifest,
  type ActionReceiptCoverageValidationError,
  type DiscoveredActionReceiptCoverageInventory,
} from './actionReceiptCoverage.js';
import {
  buildDiscoveredActionReceiptCoverageInventory,
  type ActionReceiptCoverageInventoryAuthorities,
  type ActionReceiptCoverageInventoryBuildResult,
} from './actionReceiptCoverageInventory.js';
import { LEDGER_QUIET_ROUTES } from './agentHistory.js';
import { FORGE_CAPABILITIES, type ForgeCapabilityDescriptorV1 } from './forgeCapabilities.js';

export const ACTION_RECEIPT_COVERAGE_REVIEWED_MANIFEST_SHA256 =
  '6ce4c8db542afcd514253f92f02b29fcdd96e13728b0aea6f8219a1163ed370d' as const;

export const ACTION_RECEIPT_POLICY_BUNDLE_SCHEMA = 'forge.action-receipt-policy-bundle.v1' as const;

export type ActionReceiptPolicyBundleErrorCode =
  | 'ACTION_RECEIPT_POLICY_BUNDLE_MANIFEST_MISSING'
  | 'ACTION_RECEIPT_POLICY_BUNDLE_MANIFEST_MALFORMED'
  | 'ACTION_RECEIPT_POLICY_BUNDLE_SCHEMA_MISMATCH'
  | 'ACTION_RECEIPT_POLICY_BUNDLE_ROUTE_DRIFT'
  | 'ACTION_RECEIPT_POLICY_BUNDLE_DURABLE_OWNER_DRIFT'
  | 'ACTION_RECEIPT_POLICY_BUNDLE_CAPABILITY_DRIFT'
  | 'ACTION_RECEIPT_POLICY_BUNDLE_QUIET_ROUTE_DRIFT'
  | 'ACTION_RECEIPT_POLICY_BUNDLE_HASH_MISMATCH'
  | 'ACTION_RECEIPT_POLICY_BUNDLE_INVENTORY_INVALID';

export class ActionReceiptPolicyBundleError extends Error {
  readonly code: ActionReceiptPolicyBundleErrorCode;

  constructor(code: ActionReceiptPolicyBundleErrorCode, detail: string) {
    super(`${code}: ${detail}`);
    this.name = 'ActionReceiptPolicyBundleError';
    this.code = code;
  }
}

export interface ActionReceiptPolicyBundleSources {
  readonly manifest: unknown;
  readonly routeAuthority: unknown;
  readonly durableWriterAuthority: unknown;
  readonly capabilities: readonly ForgeCapabilityDescriptorV1[];
  readonly quietRoutes: readonly string[];
}

export type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly (infer Item)[]
    ? ReadonlyArray<DeepReadonly<Item>>
    : T extends object
      ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
      : T;

export interface ActionReceiptPolicyBundle {
  readonly schema: typeof ACTION_RECEIPT_POLICY_BUNDLE_SCHEMA;
  readonly manifest: DeepReadonly<ActionReceiptCoverageManifest>;
  readonly inventory: DeepReadonly<DiscoveredActionReceiptCoverageInventory>;
  readonly manifestSha256: string;
  readonly reviewedManifestSha256: typeof ACTION_RECEIPT_COVERAGE_REVIEWED_MANIFEST_SHA256;
  readonly routeCount: number;
  readonly surfaceCount: number;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function prettyLfJsonBytes(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sha256Utf8(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function cloneAndFreeze<T>(value: T): DeepReadonly<T> {
  if (Array.isArray(value)) {
    const clone = value.map(item => cloneAndFreeze(item));
    return Object.freeze(clone) as DeepReadonly<T>;
  }
  if (isPlainObject(value)) {
    const clone: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      clone[key] = cloneAndFreeze(child);
    }
    return Object.freeze(clone) as DeepReadonly<T>;
  }
  return value as DeepReadonly<T>;
}

function rejectBundle(code: ActionReceiptPolicyBundleErrorCode, detail: string): never {
  throw new ActionReceiptPolicyBundleError(code, detail);
}

function validationFailureCode(
  errors: readonly ActionReceiptCoverageValidationError[],
): ActionReceiptPolicyBundleErrorCode {
  if (errors.some(error => error.code === 'ACTION_RECEIPT_COVERAGE_QUIET_MUTATION'
    || (error.code === 'ACTION_RECEIPT_COVERAGE_ROUTE_MISMATCH' && error.path.endsWith('.history'))
    || error.message.toLowerCase().includes('history'))) {
    return 'ACTION_RECEIPT_POLICY_BUNDLE_QUIET_ROUTE_DRIFT';
  }
  if (errors.some(error => error.code === 'ACTION_RECEIPT_COVERAGE_CAPABILITY_MISMATCH'
    || error.code === 'ACTION_RECEIPT_COVERAGE_CANONICAL_EFFECT_MISMATCH'
    || error.code === 'ACTION_RECEIPT_COVERAGE_CAPABILITY_VERSION_INVALID')) {
    return 'ACTION_RECEIPT_POLICY_BUNDLE_CAPABILITY_DRIFT';
  }
  if (errors.some(error => error.code === 'ACTION_RECEIPT_COVERAGE_SURFACE_MISMATCH'
    || error.code === 'ACTION_RECEIPT_COVERAGE_MISSING_SURFACE'
    || error.code === 'ACTION_RECEIPT_COVERAGE_STALE_SURFACE')) {
    return 'ACTION_RECEIPT_POLICY_BUNDLE_DURABLE_OWNER_DRIFT';
  }
  if (errors.some(error => error.code === 'ACTION_RECEIPT_COVERAGE_ROUTE_MISMATCH'
    || error.code === 'ACTION_RECEIPT_COVERAGE_MISSING_ROUTE'
    || error.code === 'ACTION_RECEIPT_COVERAGE_STALE_ROUTE'
    || error.code === 'ACTION_RECEIPT_COVERAGE_ROUTE_KEY_MISMATCH')) {
    return 'ACTION_RECEIPT_POLICY_BUNDLE_ROUTE_DRIFT';
  }
  return 'ACTION_RECEIPT_POLICY_BUNDLE_INVENTORY_INVALID';
}

function authorityFailureCode(error: unknown): ActionReceiptPolicyBundleErrorCode {
  const detail = error instanceof Error ? error.message : String(error);
  if (detail.includes('HISTORY_AUTHORITY')) return 'ACTION_RECEIPT_POLICY_BUNDLE_QUIET_ROUTE_DRIFT';
  if (detail.includes('CAPABILITY')) return 'ACTION_RECEIPT_POLICY_BUNDLE_CAPABILITY_DRIFT';
  if (detail.includes('durable-writers')) return 'ACTION_RECEIPT_POLICY_BUNDLE_DURABLE_OWNER_DRIFT';
  if (detail.includes('forge-route-dispositions') || detail.includes('ROUTE')) {
    return 'ACTION_RECEIPT_POLICY_BUNDLE_ROUTE_DRIFT';
  }
  return 'ACTION_RECEIPT_POLICY_BUNDLE_INVENTORY_INVALID';
}

function validateManifestShape(value: unknown): asserts value is ActionReceiptCoverageManifest {
  if (value === undefined) {
    rejectBundle('ACTION_RECEIPT_POLICY_BUNDLE_MANIFEST_MISSING', 'reviewed manifest is not bundled');
  }
  if (!isPlainObject(value)) {
    rejectBundle('ACTION_RECEIPT_POLICY_BUNDLE_MANIFEST_MALFORMED', 'reviewed manifest must be a plain object');
  }
  if (value.schema !== ACTION_RECEIPT_COVERAGE_SCHEMA) {
    rejectBundle('ACTION_RECEIPT_POLICY_BUNDLE_SCHEMA_MISMATCH', 'reviewed manifest schema is unsupported');
  }
  if (!Array.isArray(value.routes) || !Array.isArray(value.surfaces)) {
    rejectBundle('ACTION_RECEIPT_POLICY_BUNDLE_MANIFEST_MALFORMED', 'reviewed manifest routes and surfaces must be arrays');
  }
}

export function validateActionReceiptPolicyBundleSources(
  sources: ActionReceiptPolicyBundleSources,
): ActionReceiptPolicyBundle {
  validateManifestShape(sources.manifest);

  let buildResult: ActionReceiptCoverageInventoryBuildResult;
  try {
    buildResult = buildDiscoveredActionReceiptCoverageInventory({
      routeAuthority: sources.routeAuthority,
      durableWriterAuthority: sources.durableWriterAuthority,
      capabilities: sources.capabilities,
      quietRoutes: sources.quietRoutes,
    } satisfies ActionReceiptCoverageInventoryAuthorities);
  } catch (error) {
    const code = authorityFailureCode(error);
    rejectBundle(code, error instanceof Error ? error.message : String(error));
  }

  const validation = validateActionReceiptCoverageManifest(sources.manifest, buildResult.inventory);
  if (!validation.ok) {
    const code = validationFailureCode(validation.errors);
    rejectBundle(code, validation.errors.map(error => `${error.code}@${error.path}`).join('|'));
  }

  const manifestBytes = prettyLfJsonBytes(sources.manifest);
  const manifestSha256 = sha256Utf8(manifestBytes);
  if (manifestSha256 !== ACTION_RECEIPT_COVERAGE_REVIEWED_MANIFEST_SHA256) {
    rejectBundle(
      'ACTION_RECEIPT_POLICY_BUNDLE_HASH_MISMATCH',
      `reviewed manifest SHA-256 ${manifestSha256} does not match the pinned authority`,
    );
  }

  return cloneAndFreeze({
    schema: ACTION_RECEIPT_POLICY_BUNDLE_SCHEMA,
    manifest: cloneAndFreeze(sources.manifest),
    inventory: cloneAndFreeze(buildResult.inventory),
    manifestSha256,
    reviewedManifestSha256: ACTION_RECEIPT_COVERAGE_REVIEWED_MANIFEST_SHA256,
    routeCount: buildResult.nonGetRouteCount,
    surfaceCount: Object.values(buildResult.surfaceCounts).reduce((total, count) => total + count, 0),
  }) as ActionReceiptPolicyBundle;
}

const STATIC_POLICY_BUNDLE_SOURCES: ActionReceiptPolicyBundleSources = {
  manifest: reviewedManifest,
  routeAuthority,
  durableWriterAuthority,
  capabilities: FORGE_CAPABILITIES,
  quietRoutes: LEDGER_QUIET_ROUTES,
};

export function loadActionReceiptPolicyBundle(): ActionReceiptPolicyBundle {
  return validateActionReceiptPolicyBundleSources(STATIC_POLICY_BUNDLE_SOURCES);
}

export const loadBundledActionReceiptPolicy = loadActionReceiptPolicyBundle;
