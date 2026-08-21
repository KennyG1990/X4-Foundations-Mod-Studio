import reviewedManifest from '../../config/action-receipt-coverage.json' with { type: 'json' };
import durableWriterAuthority from '../../config/durable-writers.json' with { type: 'json' };
import routeAuthority from '../../config/forge-route-dispositions.json' with { type: 'json' };

import {
  ACTION_RECEIPT_COVERAGE_REVIEWED_MANIFEST_SHA256,
  ActionReceiptPolicyBundleError,
  loadActionReceiptPolicyBundle,
  type ActionReceiptPolicyBundleSources,
  validateActionReceiptPolicyBundleSources,
} from './actionReceiptPolicyBundle.js';
import { LEDGER_QUIET_ROUTES } from './agentHistory.js';
import { FORGE_CAPABILITIES, type ForgeCapabilityDescriptorV1 } from './forgeCapabilities.js';

interface SelftestCheck {
  name: string;
  pass: boolean;
  detail?: string;
}

export interface ActionReceiptPolicyBundleSelftestResult {
  allPassed: boolean;
  pass: boolean;
  passed: number;
  total: number;
  failures: string[];
  checks: SelftestCheck[];
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function baseSources(): ActionReceiptPolicyBundleSources {
  return {
    manifest: clone(reviewedManifest),
    routeAuthority: clone(routeAuthority),
    durableWriterAuthority: clone(durableWriterAuthority),
    capabilities: clone(FORGE_CAPABILITIES),
    quietRoutes: [...LEDGER_QUIET_ROUTES],
  };
}

function rejectCode(sources: ActionReceiptPolicyBundleSources, expected: string): boolean {
  try {
    validateActionReceiptPolicyBundleSources(sources);
    return false;
  } catch (error) {
    return error instanceof ActionReceiptPolicyBundleError && error.code === expected;
  }
}

function mutationThrows(action: () => void): boolean {
  try {
    action();
    return false;
  } catch (error) {
    return error instanceof TypeError;
  }
}

function manifestRecord(sources: ActionReceiptPolicyBundleSources): Record<string, unknown> {
  return sources.manifest as Record<string, unknown>;
}

function routeRecords(sources: ActionReceiptPolicyBundleSources): Record<string, Record<string, unknown>> {
  const authority = sources.routeAuthority as { routes: Record<string, Record<string, unknown>> };
  return authority.routes;
}

function capabilityWithChangedEffect(sources: ActionReceiptPolicyBundleSources): boolean {
  const capabilities = sources.capabilities as ForgeCapabilityDescriptorV1[];
  const target = capabilities.find(capability => capability.effects.length > 0
    && capability.apiBindings.some(binding => binding.method !== 'GET'));
  if (!target) return false;
  const targetRecord = target as unknown as Record<string, unknown>;
  const effects = [...target.effects];
  const replacements = ['read', 'analyze', 'network', 'filesystem-write', 'workspace-write'] as const;
  const replacement = replacements.find(effect => effect !== effects[0] && !effects.includes(effect));
  if (!replacement) return false;
  effects[0] = replacement;
  targetRecord.effects = effects;
  return true;
}

export function runActionReceiptPolicyBundleSelftest(): ActionReceiptPolicyBundleSelftestResult {
  const checks: SelftestCheck[] = [];
  const check = (name: string, pass: boolean, detail?: string): void => {
    checks.push({ name, pass, ...(detail === undefined ? {} : { detail }) });
  };

  const positive = loadActionReceiptPolicyBundle();
  check(
    'bundled_policy_positive_counts',
    positive.routeCount === 82 && positive.surfaceCount === 56
      && positive.inventory.routes.length === 82
      && positive.inventory.surfaces.length === 56,
    `routes=${positive.routeCount} surfaces=${positive.surfaceCount}`,
  );
  check(
    'bundled_policy_positive_hash',
    positive.manifestSha256 === ACTION_RECEIPT_COVERAGE_REVIEWED_MANIFEST_SHA256
      && positive.reviewedManifestSha256 === ACTION_RECEIPT_COVERAGE_REVIEWED_MANIFEST_SHA256,
    positive.manifestSha256,
  );
  check(
    'bundled_policy_source_refs_are_authoritative',
    positive.inventory.routes.every(route => route.sourceRef.startsWith('config/forge-route-dispositions.json#/routes/'))
      && positive.inventory.surfaces.every(surface => surface.sourceRef.startsWith('config/durable-writers.json#/')),
  );

  const positiveManifestJson = JSON.stringify(positive.manifest);
  const positiveInventoryJson = JSON.stringify(positive.inventory);
  const positiveBundleJson = JSON.stringify(positive);
  const positiveManifest = positive.manifest as unknown as {
    routes: Array<Record<string, unknown>>;
  };
  const positiveInventory = positive.inventory as unknown as {
    routes: Array<Record<string, unknown>>;
  };
  const canonicalManifestRoute = positive.manifest.routes.find(route => route.capability.kind === 'canonical');
  const canonicalInventoryRoute = positive.inventory.routes.find(route => route.canonicalCapability !== undefined);
  check(
    'runtime_snapshot_is_detached_and_recursively_frozen',
    positive.manifest !== reviewedManifest
      && positive.manifest.routes !== (reviewedManifest as { routes: unknown }).routes
      && Object.isFrozen(positive)
      && Object.isFrozen(positive.manifest)
      && Object.isFrozen(positive.manifest.routes)
      && Object.isFrozen(positive.manifest.routes[0])
      && Object.isFrozen(positive.inventory)
      && Object.isFrozen(positive.inventory.routes)
      && Object.isFrozen(positive.inventory.routes[0])
      && canonicalManifestRoute !== undefined
      && Object.isFrozen(canonicalManifestRoute.capability)
      && Object.isFrozen(canonicalManifestRoute.effects)
      && canonicalInventoryRoute !== undefined
      && canonicalInventoryRoute.canonicalCapability !== undefined
      && Object.isFrozen(canonicalInventoryRoute.canonicalCapability)
      && Object.isFrozen(canonicalInventoryRoute.canonicalCapability.effects),
  );
  check(
    'runtime_manifest_mutation_is_refused',
    mutationThrows(() => { positiveManifest.routes[0].policy = 'refused'; })
      && mutationThrows(() => { positiveManifest.routes.push({}); })
      && JSON.stringify(positive.manifest) === positiveManifestJson,
  );
  check(
    'runtime_inventory_mutation_is_refused',
    mutationThrows(() => { positiveInventory.routes[0].owner = 'poisoned-owner'; })
      && mutationThrows(() => { positiveInventory.routes.push({}); })
      && JSON.stringify(positive.inventory) === positiveInventoryJson,
  );
  check(
    'runtime_bundle_mutation_is_refused',
    mutationThrows(() => {
      (positive as unknown as { routeCount: number }).routeCount = 0;
    })
      && mutationThrows(() => {
        (positive as unknown as { manifest: unknown }).manifest = {};
      })
      && JSON.stringify(positive) === positiveBundleJson,
  );

  const later = loadActionReceiptPolicyBundle();
  check(
    'later_load_is_not_poisoned',
    later !== positive
      && JSON.stringify(later.manifest) === positiveManifestJson
      && JSON.stringify(later.inventory) === positiveInventoryJson
      && later.routeCount === 82
      && later.surfaceCount === 56
      && later.manifestSha256 === ACTION_RECEIPT_COVERAGE_REVIEWED_MANIFEST_SHA256,
  );

  const defensiveSources = baseSources();
  const defensiveResult = validateActionReceiptPolicyBundleSources(defensiveSources);
  const defensiveBefore = JSON.stringify(defensiveResult);
  const defensiveManifest = manifestRecord(defensiveSources);
  const defensiveRoutes = defensiveManifest.routes as Array<Record<string, unknown>>;
  if (defensiveRoutes[0]) defensiveRoutes[0].policy = 'refused';
  const defensiveAuthority = routeRecords(defensiveSources);
  const defensiveRouteKey = Object.keys(defensiveAuthority)[0];
  if (defensiveRouteKey) defensiveAuthority[defensiveRouteKey].owner = 'poisoned-source-owner';
  check(
    'caller_sources_are_detached_from_returned_snapshot',
    JSON.stringify(defensiveResult) === defensiveBefore,
  );

  const malformed = { ...baseSources(), manifest: [] };
  check(
    'malformed_manifest_refused',
    rejectCode(malformed, 'ACTION_RECEIPT_POLICY_BUNDLE_MANIFEST_MALFORMED'),
  );

  const missing = { ...baseSources(), manifest: undefined };
  check(
    'missing_manifest_refused',
    rejectCode(missing, 'ACTION_RECEIPT_POLICY_BUNDLE_MANIFEST_MISSING'),
  );

  const wrongSchema = baseSources();
  const wrongSchemaManifest = manifestRecord(wrongSchema);
  wrongSchemaManifest.schema = 'forge.action-receipt-coverage.wrong.v1';
  check(
    'wrong_schema_refused',
    rejectCode(wrongSchema, 'ACTION_RECEIPT_POLICY_BUNDLE_SCHEMA_MISMATCH'),
  );

  const routeDrift = baseSources();
  const routeDriftEntries = routeRecords(routeDrift);
  const routeDriftKey = Object.keys(routeDriftEntries).find(key => key.startsWith('POST '));
  if (routeDriftKey !== undefined) {
    routeDriftEntries[routeDriftKey] = { ...routeDriftEntries[routeDriftKey], owner: 'drifted-route-owner' };
  }
  check(
    'route_drift_refused',
    routeDriftKey !== undefined && rejectCode(routeDrift, 'ACTION_RECEIPT_POLICY_BUNDLE_ROUTE_DRIFT'),
  );

  const durableOwnerDrift = baseSources();
  const durable = durableOwnerDrift.durableWriterAuthority as {
    writers: Array<Record<string, unknown>>;
  };
  const firstWriter = durable.writers[0];
  if (firstWriter && Array.isArray(firstWriter.owners)) {
    firstWriter.owners = [...firstWriter.owners, 'drifted-durable-owner'];
  }
  check(
    'durable_owner_drift_refused',
    firstWriter !== undefined && rejectCode(durableOwnerDrift, 'ACTION_RECEIPT_POLICY_BUNDLE_DURABLE_OWNER_DRIFT'),
  );

  const capabilityDrift = baseSources();
  check(
    'capability_drift_refused',
    capabilityWithChangedEffect(capabilityDrift)
      && rejectCode(capabilityDrift, 'ACTION_RECEIPT_POLICY_BUNDLE_CAPABILITY_DRIFT'),
  );

  const quietRouteDrift = {
    ...baseSources(),
    quietRoutes: [...LEDGER_QUIET_ROUTES, '/api/agent/project/validate'],
  };
  check(
    'quiet_route_drift_refused',
    rejectCode(quietRouteDrift, 'ACTION_RECEIPT_POLICY_BUNDLE_QUIET_ROUTE_DRIFT'),
  );

  const hashMismatch = baseSources();
  const hashManifest = manifestRecord(hashMismatch);
  const hashRoutes = hashManifest.routes as Array<Record<string, unknown>>;
  const firstRoute = hashRoutes[0];
  if (firstRoute) {
    firstRoute.integrationBatch = firstRoute.integrationBatch === 'W3B1' ? 'W3B2' : 'W3B1';
  }
  check(
    'hash_mismatch_refused',
    firstRoute !== undefined && rejectCode(hashMismatch, 'ACTION_RECEIPT_POLICY_BUNDLE_HASH_MISMATCH'),
  );

  const sourcePreservation = baseSources();
  const sourceBefore = JSON.stringify(sourcePreservation);
  try {
    validateActionReceiptPolicyBundleSources(sourcePreservation);
  } catch {
    // The positive source set must be accepted; the check below records any mutation either way.
  }
  check('bundle_sources_are_read_only', sourceBefore === JSON.stringify(sourcePreservation));

  const failures = checks.filter(item => !item.pass).map(item => item.name);
  const passed = checks.length - failures.length;
  return {
    allPassed: failures.length === 0,
    pass: failures.length === 0,
    passed,
    total: checks.length,
    failures,
    checks,
  };
}

const invokedDirectly = process.argv[1]?.endsWith('actionReceiptPolicyBundle.selftest.ts') === true;
if (invokedDirectly) {
  const result = runActionReceiptPolicyBundleSelftest();
  console.log(JSON.stringify(result, null, 2));
  if (!result.allPassed) process.exitCode = 1;
}
