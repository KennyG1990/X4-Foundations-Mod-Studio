import { isDeepStrictEqual } from 'node:util';

import {
  ACTION_RECEIPT_COVERAGE_SCHEMA,
  resolveActionReceiptPolicy,
  validateActionReceiptCoverageManifest,
  type ActionReceiptCoverageManifest,
  type ActionReceiptCoverageRefusalCode,
  type ActionReceiptCoverageResolverRequest,
  type ActionReceiptCoverageResolverResult,
  type ActionReceiptCoverageRouteEntry,
  type ActionReceiptCoverageSurfaceEntry,
  type ActionReceiptCoverageValidationErrorCode,
  type ActionReceiptCoverageValidationResult,
  type DiscoveredActionReceiptCoverageInventory,
  type DiscoveredReceiptCoverageRoute,
  type ReceiptCoverageEffect,
} from './actionReceiptCoverage.js';
import { createPreparedActionReceipt, serializeActionReceipt } from './actionReceipt.js';
import { FORGE_CAPABILITY_EFFECTS } from './forgeCapabilities.js';

export interface ActionReceiptCoverageSelftestCheck {
  name: string;
  pass: boolean;
  detail?: string;
}

export interface ActionReceiptCoverageSelftestResult {
  allPassed: boolean;
  pass: boolean;
  passed: number;
  total: number;
  failures: string[];
  checks: ActionReceiptCoverageSelftestCheck[];
}

type CoverageEffect = ReceiptCoverageEffect;
type CoverageFixture = {
  manifest: ActionReceiptCoverageManifest;
  inventory: DiscoveredActionReceiptCoverageInventory;
};
type RouteOverrides = Partial<ActionReceiptCoverageRouteEntry>;
type SurfaceOverrides = Partial<ActionReceiptCoverageSurfaceEntry>;
type ValidationResult = ActionReceiptCoverageValidationResult;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function effects(...values: string[]): CoverageEffect[] {
  return values as CoverageEffect[];
}

function makeFixture(): CoverageFixture {
  const route: DiscoveredReceiptCoverageRoute = {
    routeKey: 'POST /api/agent/action-receipt-coverage-selftest',
    method: 'POST',
    template: '/api/agent/action-receipt-coverage-selftest',
    owner: 'coverage-selftest',
    resourceClass: 'stateless-analysis',
    sourceRef: 'server.ts::registerActionReceiptCoverageSelftest',
    history: 'quiet',
    canonicalCapability: {
      id: 'forge.action-receipt-coverage.selftest',
      version: 1,
      effects: ['read', 'analyze'],
    },
  };
  const surface = {
    id: 'fixture-cache.action-receipt-coverage',
    kind: 'host-store' as const,
    owner: 'coverage-selftest',
    sourceRef: 'src/lib/actionReceiptCoverage.selftest.ts::fixture-cache',
  };

  return {
    inventory: {
      routes: [route],
      surfaces: [surface],
    },
    manifest: {
      schema: ACTION_RECEIPT_COVERAGE_SCHEMA,
      routes: [{
        routeKey: route.routeKey,
        method: route.method,
        template: route.template,
        owner: route.owner,
        resourceClass: route.resourceClass,
        sourceRef: route.sourceRef,
        integrationBatch: 'W3B0-A1b',
        history: route.history,
        capability: {
          kind: 'canonical',
          id: route.canonicalCapability!.id,
          version: route.canonicalCapability!.version,
        },
        semanticClass: 'read-analysis-only',
        policy: 'receipt-exempt',
        effects: effects('analyze', 'read'),
        authorityScopes: ['workspace'],
      }],
      surfaces: [{
        ...surface,
        integrationBatch: 'W3B0-A1b',
        semanticClass: 'fixture-cache',
        policy: 'receipt-exempt',
        effects: effects('read'),
        authorityScopes: ['workspace'],
      }],
    },
  };
}

function routeCase(
  fixture: CoverageFixture,
  routeOverrides: RouteOverrides = {},
  discoveredOverrides: Partial<DiscoveredReceiptCoverageRoute> = {},
): CoverageFixture {
  const manifest = clone(fixture.manifest);
  manifest.routes[0] = { ...manifest.routes[0], ...routeOverrides };
  const inventory = clone(fixture.inventory);
  inventory.routes[0] = { ...inventory.routes[0], ...discoveredOverrides };
  return { manifest, inventory };
}

function surfaceCase(fixture: CoverageFixture, surfaceOverrides: SurfaceOverrides = {}): CoverageFixture {
  const manifest = clone(fixture.manifest);
  manifest.surfaces[0] = { ...manifest.surfaces[0], ...surfaceOverrides };
  return { manifest, inventory: clone(fixture.inventory) };
}

function routeEffectCase(
  fixture: CoverageFixture,
  routeEffects: CoverageEffect[],
  semanticClass: ActionReceiptCoverageRouteEntry['semanticClass'] = 'read-analysis-only',
  policy: ActionReceiptCoverageRouteEntry['policy'] = 'receipt-required',
): CoverageFixture {
  const canonical = fixture.inventory.routes[0].canonicalCapability!;
  return routeCase(
    fixture,
    { effects: clone(routeEffects), semanticClass, policy },
    { canonicalCapability: { ...canonical, effects: clone(routeEffects.filter((effect): effect is Exclude<CoverageEffect, 'process' | 'session-write'> => effect !== 'process' && effect !== 'session-write')) } },
  );
}

function legacyRouteCase(
  fixture: CoverageFixture,
  routeEffects: CoverageEffect[],
  policy: ActionReceiptCoverageRouteEntry['policy'],
): CoverageFixture {
  const candidate = routeCase(fixture, {
    capability: {
      kind: 'reviewed-legacy',
      id: fixture.manifest.routes[0].routeKey,
      reviewRef: 'W3B0-A1b-legacy-review',
    },
    effects: clone(routeEffects),
    semanticClass: 'external-process',
    policy,
  });
  delete candidate.inventory.routes[0].canonicalCapability;
  return candidate;
}

function visibleRouteEffectCase(
  fixture: CoverageFixture,
  routeEffects: CoverageEffect[],
  semanticClass: ActionReceiptCoverageRouteEntry['semanticClass'],
  policy: ActionReceiptCoverageRouteEntry['policy'],
): CoverageFixture {
  const candidate = routeEffectCase(fixture, routeEffects, semanticClass, policy);
  candidate.manifest.routes[0].history = 'visible';
  candidate.inventory.routes[0].history = 'visible';
  return candidate;
}

function resolverAuthority(
  scope: ActionReceiptCoverageResolverRequest['authority']['scope'],
): ActionReceiptCoverageResolverRequest['authority'] {
  const base = {
    operationId: 'action-receipt-coverage-operation-0001',
    requestScope: 'action-receipt-coverage-selftest',
    resources: [{
      role: 'workspace' as const,
      root: 'fixed-selftest-root',
      relativePath: 'project/content.xml',
      beforeHash: '1'.repeat(64),
    }],
  };
  if (scope === 'global') return { ...base, scope };
  if (scope === 'profile') return { ...base, scope, profileId: 'profile-selftest' };
  return { ...base, scope, workspaceId: 'ws_0123456789abcdef01234567' };
}

function makeResolverRequest(
  fixture: CoverageFixture,
  scope: ActionReceiptCoverageResolverRequest['authority']['scope'] = 'workspace',
): ActionReceiptCoverageResolverRequest {
  const authority = resolverAuthority(scope);
  return {
    inventory: clone(fixture.inventory),
    routeKey: fixture.manifest.routes[0].routeKey,
    actor: { kind: 'agent', id: 'action-receipt-coverage-selftest-agent' },
    client: { channel: 'harness', id: 'action-receipt-coverage-selftest-client', version: '1.0.0' },
    authority,
    declaredEffects: fixture.manifest.routes[0].effects.map(effect => ({
      id: effect,
      operation: `selftest:${effect}`,
      resource: authority.resources[0],
      reversible: false,
    })),
    input: { requestHash: '2'.repeat(64), beforeHash: '3'.repeat(64) },
    validation: { validator: 'action-receipt-coverage-selftest', ruleHash: '4'.repeat(64) },
    rollback: { required: false, mode: 'none', status: 'not_required' },
    metadata: { operation: 'W3B0-A1c' },
    preparedAt: '2026-08-02T00:00:00.000Z',
  };
}

function resolve(
  manifest: unknown,
  request: ActionReceiptCoverageResolverRequest,
): ActionReceiptCoverageResolverResult | undefined {
  try {
    return resolveActionReceiptPolicy(manifest, request);
  } catch {
    return undefined;
  }
}

function hasRefusalCode(
  result: ActionReceiptCoverageResolverResult | undefined,
  code: ActionReceiptCoverageRefusalCode,
): boolean {
  return result?.policy === 'refused' && result.code === code;
}

function validate(value: unknown, inventory: DiscoveredActionReceiptCoverageInventory): ValidationResult | undefined {
  try {
    return validateActionReceiptCoverageManifest(value, inventory);
  } catch {
    return undefined;
  }
}

function resultDetail(result: ValidationResult | undefined): string {
  if (result === undefined) return 'validator threw';
  if (result.ok) return 'accepted';
  return result.errors.map(error => `${error.code}@${error.path}`).join('|');
}

function hasCode(result: ValidationResult | undefined, code: ActionReceiptCoverageValidationErrorCode): boolean {
  if (result === undefined || result.ok) return false;
  return result.errors.some(error => error.code === code);
}

export function runActionReceiptCoverageSelftest(): ActionReceiptCoverageSelftestResult {
  const fixture = makeFixture();
  const checks: ActionReceiptCoverageSelftestCheck[] = [];
  const check = (name: string, pass: boolean, detail?: string): void => {
    checks.push({ name, pass, ...(detail === undefined ? {} : { detail }) });
  };
  const expectCode = (
    name: string,
    value: unknown,
    inventory: DiscoveredActionReceiptCoverageInventory,
    code: ActionReceiptCoverageValidationErrorCode,
  ): void => {
    const result = validate(value, inventory);
    check(name, hasCode(result, code), resultDetail(result));
  };
  const expectAccepted = (
    name: string,
    value: unknown,
    inventory: DiscoveredActionReceiptCoverageInventory,
  ): void => {
    const result = validate(value, inventory);
    check(name, result?.ok === true, resultDetail(result));
  };

  const manifestBefore = JSON.stringify(fixture.manifest);
  const inventoryBefore = JSON.stringify(fixture.inventory);

  expectAccepted('valid_fixture', fixture.manifest, fixture.inventory);

  const runtimeCanonicalEffects = routeCase(
    fixture,
    {
      history: 'visible',
      semanticClass: 'conditional-dev-only',
      policy: 'receipt-required',
      effects: effects(...FORGE_CAPABILITY_EFFECTS),
    },
    {
      history: 'visible',
      canonicalCapability: {
        ...fixture.inventory.routes[0].canonicalCapability!,
        effects: [...FORGE_CAPABILITY_EFFECTS],
      },
    },
  );
  expectAccepted(
    'runtime_canonical_effect_source_represented',
    runtimeCanonicalEffects.manifest,
    runtimeCanonicalEffects.inventory,
  );

  expectCode(
    'bad_schema',
    { ...clone(fixture.manifest), schema: 'forge.action-receipt-coverage.v2' },
    fixture.inventory,
    'ACTION_RECEIPT_COVERAGE_SCHEMA_MISMATCH',
  );

  const unknownTop = clone(fixture.manifest) as unknown as Record<string, unknown>;
  unknownTop.unexpected = true;
  expectCode('unknown_top_field', unknownTop, fixture.inventory, 'ACTION_RECEIPT_COVERAGE_UNKNOWN_FIELD');

  const unknownRoute = clone(fixture.manifest);
  (unknownRoute.routes[0] as unknown as Record<string, unknown>).unexpected = true;
  expectCode('unknown_route_field', unknownRoute, fixture.inventory, 'ACTION_RECEIPT_COVERAGE_UNKNOWN_FIELD');

  const unknownSurface = clone(fixture.manifest);
  (unknownSurface.surfaces[0] as unknown as Record<string, unknown>).unexpected = true;
  expectCode('unknown_surface_field', unknownSurface, fixture.inventory, 'ACTION_RECEIPT_COVERAGE_UNKNOWN_FIELD');

  const unknownCapability = clone(fixture.manifest);
  (unknownCapability.routes[0].capability as unknown as Record<string, unknown>).unexpected = true;
  expectCode('unknown_capability_field', unknownCapability, fixture.inventory, 'ACTION_RECEIPT_COVERAGE_UNKNOWN_FIELD');

  const unknownDiscoveredRoute = clone(fixture.inventory);
  (unknownDiscoveredRoute.routes[0] as unknown as Record<string, unknown>).unexpected = true;
  expectCode('unknown_discovered_route_field', fixture.manifest, unknownDiscoveredRoute, 'ACTION_RECEIPT_COVERAGE_UNKNOWN_FIELD');

  const unknownDiscoveredSurface = clone(fixture.inventory);
  (unknownDiscoveredSurface.surfaces[0] as unknown as Record<string, unknown>).unexpected = true;
  expectCode('unknown_discovered_surface_field', fixture.manifest, unknownDiscoveredSurface, 'ACTION_RECEIPT_COVERAGE_UNKNOWN_FIELD');

  const unknownDiscoveredCapability = clone(fixture.inventory);
  (unknownDiscoveredCapability.routes[0].canonicalCapability as unknown as Record<string, unknown>).unexpected = true;
  expectCode('unknown_discovered_capability_field', fixture.manifest, unknownDiscoveredCapability, 'ACTION_RECEIPT_COVERAGE_UNKNOWN_FIELD');

  const duplicateReviewedRoute = clone(fixture.manifest);
  duplicateReviewedRoute.routes.push(clone(duplicateReviewedRoute.routes[0]));
  expectCode('duplicate_reviewed_route', duplicateReviewedRoute, fixture.inventory, 'ACTION_RECEIPT_COVERAGE_DUPLICATE_ROUTE');

  const duplicateReviewedSurface = clone(fixture.manifest);
  duplicateReviewedSurface.surfaces.push(clone(duplicateReviewedSurface.surfaces[0]));
  expectCode('duplicate_reviewed_surface', duplicateReviewedSurface, fixture.inventory, 'ACTION_RECEIPT_COVERAGE_DUPLICATE_SURFACE');

  expectCode(
    'duplicate_reviewed_effect',
    routeCase(fixture, { effects: effects('read', 'read') }).manifest,
    fixture.inventory,
    'ACTION_RECEIPT_COVERAGE_DUPLICATE_EFFECT',
  );
  expectCode(
    'duplicate_reviewed_scope',
    routeCase(fixture, { authorityScopes: ['workspace', 'workspace'] }).manifest,
    fixture.inventory,
    'ACTION_RECEIPT_COVERAGE_DUPLICATE_SCOPE',
  );
  expectCode(
    'empty_reviewed_route_effects',
    routeCase(fixture, { effects: [] }).manifest,
    fixture.inventory,
    'ACTION_RECEIPT_COVERAGE_EFFECT_INVALID',
  );
  expectCode(
    'empty_reviewed_surface_effects',
    surfaceCase(fixture, { effects: [] }).manifest,
    fixture.inventory,
    'ACTION_RECEIPT_COVERAGE_EFFECT_INVALID',
  );

  const duplicateDiscoveredRoute = clone(fixture.inventory);
  duplicateDiscoveredRoute.routes.push(clone(duplicateDiscoveredRoute.routes[0]));
  expectCode('duplicate_discovered_route', fixture.manifest, duplicateDiscoveredRoute, 'ACTION_RECEIPT_COVERAGE_DUPLICATE_ROUTE');

  const duplicateDiscoveredSurface = clone(fixture.inventory);
  duplicateDiscoveredSurface.surfaces.push(clone(duplicateDiscoveredSurface.surfaces[0]));
  expectCode('duplicate_discovered_surface', fixture.manifest, duplicateDiscoveredSurface, 'ACTION_RECEIPT_COVERAGE_DUPLICATE_SURFACE');

  const missingRoute = clone(fixture.manifest);
  missingRoute.routes = [];
  expectCode('missing_route', missingRoute, fixture.inventory, 'ACTION_RECEIPT_COVERAGE_MISSING_ROUTE');
  expectCode(
    'stale_route',
    routeCase(fixture, {
      routeKey: 'POST /api/agent/action-receipt-coverage-stale',
      template: '/api/agent/action-receipt-coverage-stale',
    }).manifest,
    fixture.inventory,
    'ACTION_RECEIPT_COVERAGE_STALE_ROUTE',
  );

  const missingSurface = clone(fixture.manifest);
  missingSurface.surfaces = [];
  expectCode('missing_surface', missingSurface, fixture.inventory, 'ACTION_RECEIPT_COVERAGE_MISSING_SURFACE');
  expectCode(
    'stale_surface',
    surfaceCase(fixture, { id: 'stale.action-receipt-coverage' }).manifest,
    fixture.inventory,
    'ACTION_RECEIPT_COVERAGE_STALE_SURFACE',
  );

  const routeMetadataCases: Array<[string, RouteOverrides]> = [
    ['route_owner_mismatch', { owner: 'other-owner' }],
    ['route_resource_class_mismatch', { resourceClass: 'workspace' }],
    ['route_source_ref_mismatch', { sourceRef: 'server.ts::otherRoute' }],
    ['route_history_mismatch', { history: 'visible' }],
  ];
  for (const [name, overrides] of routeMetadataCases) {
    expectCode(name, routeCase(fixture, overrides).manifest, fixture.inventory, 'ACTION_RECEIPT_COVERAGE_ROUTE_MISMATCH');
  }

  const surfaceMetadataCases: Array<[string, SurfaceOverrides]> = [
    ['surface_kind_mismatch', { kind: 'sqlite' }],
    ['surface_owner_mismatch', { owner: 'other-owner' }],
    ['surface_source_ref_mismatch', { sourceRef: 'src/lib/other.ts::surface' }],
  ];
  for (const [name, overrides] of surfaceMetadataCases) {
    expectCode(name, surfaceCase(fixture, overrides).manifest, fixture.inventory, 'ACTION_RECEIPT_COVERAGE_SURFACE_MISMATCH');
  }

  expectCode(
    'malformed_route_key',
    routeCase(fixture, { routeKey: 'malformed-route-key' }).manifest,
    fixture.inventory,
    'ACTION_RECEIPT_COVERAGE_ROUTE_KEY_MISMATCH',
  );
  expectCode(
    'malformed_route_method',
    routeCase(fixture, { method: 'post' }).manifest,
    fixture.inventory,
    'ACTION_RECEIPT_COVERAGE_ROUTE_METHOD_INVALID',
  );
  expectCode(
    'malformed_route_template',
    routeCase(fixture, { template: 'api/agent/action-receipt-coverage-selftest' }).manifest,
    fixture.inventory,
    'ACTION_RECEIPT_COVERAGE_ROUTE_TEMPLATE_INVALID',
  );

  expectCode(
    'canonical_id_mismatch',
    routeCase(fixture, {
      capability: { kind: 'canonical', id: 'forge.other-capability', version: 1 },
    }).manifest,
    fixture.inventory,
    'ACTION_RECEIPT_COVERAGE_CAPABILITY_MISMATCH',
  );
  expectCode(
    'canonical_version_mismatch',
    routeCase(fixture, {
      capability: { kind: 'canonical', id: 'forge.action-receipt-coverage.selftest', version: 2 },
    }).manifest,
    fixture.inventory,
    'ACTION_RECEIPT_COVERAGE_CAPABILITY_MISMATCH',
  );

  expectCode(
    'canonical_effect_omission',
    routeCase(fixture, { effects: effects('read') }).manifest,
    fixture.inventory,
    'ACTION_RECEIPT_COVERAGE_CANONICAL_EFFECT_MISMATCH',
  );
  expectCode(
    'canonical_effect_addition',
    routeCase(fixture, { effects: effects('read', 'analyze', 'network') }).manifest,
    fixture.inventory,
    'ACTION_RECEIPT_COVERAGE_CANONICAL_EFFECT_MISMATCH',
  );
  const canonicalDuplicate = clone(fixture.inventory);
  canonicalDuplicate.routes[0].canonicalCapability!.effects = ['read', 'analyze', 'analyze'];
  expectCode(
    'canonical_effect_duplicate',
    fixture.manifest,
    canonicalDuplicate,
    'ACTION_RECEIPT_COVERAGE_DUPLICATE_EFFECT',
  );
  expectAccepted('canonical_effect_order_insensitive_equality', fixture.manifest, fixture.inventory);

  const canonicalWithoutLegacy = clone(fixture.inventory);
  delete canonicalWithoutLegacy.routes[0].canonicalCapability;
  expectCode(
    'canonical_manifest_vs_legacy_discovery_mismatch',
    fixture.manifest,
    canonicalWithoutLegacy,
    'ACTION_RECEIPT_COVERAGE_CAPABILITY_MISMATCH',
  );
  const legacyManifest = clone(fixture.manifest);
  legacyManifest.routes[0].capability = {
    kind: 'reviewed-legacy',
    id: 'legacy.action-receipt-coverage.selftest',
    reviewRef: 'W3B0-A1b-legacy-review',
  };
  expectCode(
    'legacy_manifest_vs_canonical_discovery_mismatch',
    legacyManifest,
    fixture.inventory,
    'ACTION_RECEIPT_COVERAGE_CAPABILITY_MISMATCH',
  );
  const validLegacy = legacyRouteCase(fixture, effects('process'), 'receipt-required');
  expectAccepted('legacy_id_matches_route_key', validLegacy.manifest, validLegacy.inventory);
  const legacyIdMismatch = clone(validLegacy.manifest);
  legacyIdMismatch.routes[0].capability = {
    kind: 'reviewed-legacy',
    id: 'POST /api/agent/unrelated-legacy-route',
    reviewRef: 'W3B0-A1b-legacy-review',
  };
  expectCode(
    'legacy_id_must_match_route_key',
    legacyIdMismatch,
    validLegacy.inventory,
    'ACTION_RECEIPT_COVERAGE_CAPABILITY_MISMATCH',
  );

  expectCode(
    'empty_authority_scope',
    routeCase(fixture, { authorityScopes: [] }).manifest,
    fixture.inventory,
    'ACTION_RECEIPT_COVERAGE_AUTHORITY_SCOPE_INVALID',
  );
  expectCode(
    'invalid_authority_scope',
    routeCase(fixture, { authorityScopes: ['tenant'] as unknown as ActionReceiptCoverageRouteEntry['authorityScopes'] }).manifest,
    fixture.inventory,
    'ACTION_RECEIPT_COVERAGE_AUTHORITY_SCOPE_INVALID',
  );
  expectCode(
    'invalid_effect',
    routeCase(fixture, { effects: effects('not-a-real-effect') }).manifest,
    fixture.inventory,
    'ACTION_RECEIPT_COVERAGE_EFFECT_INVALID',
  );

  const readAnalysisMutation = routeEffectCase(fixture, effects('filesystem-write'), 'read-analysis-only', 'receipt-exempt');
  expectCode('read_analysis_mutation_contradiction', readAnalysisMutation.manifest, readAnalysisMutation.inventory, 'ACTION_RECEIPT_COVERAGE_SEMANTIC_EFFECT_MISMATCH');
  const auditWithoutAuditEffect = routeEffectCase(fixture, effects('read', 'analyze'), 'audit-retention', 'separately-governed');
  expectCode('audit_retention_requires_audit_effect', auditWithoutAuditEffect.manifest, auditWithoutAuditEffect.inventory, 'ACTION_RECEIPT_COVERAGE_SEMANTIC_EFFECT_MISMATCH');
  const auditWithAuditEffect = routeEffectCase(fixture, effects('read', 'audit-write'), 'audit-retention', 'separately-governed');
  expectAccepted('audit_retention_with_audit_effect', auditWithAuditEffect.manifest, auditWithAuditEffect.inventory);
  const durableExempt = routeEffectCase(fixture, effects('filesystem-write'), 'durable-local-mutation', 'receipt-exempt');
  expectCode('durable_mutation_exempt', durableExempt.manifest, durableExempt.inventory, 'ACTION_RECEIPT_COVERAGE_POLICY_MISMATCH');
  const durableMissingEffect = routeEffectCase(fixture, effects('read'), 'durable-local-mutation', 'receipt-required');
  expectCode('durable_mutation_missing_durable_effect', durableMissingEffect.manifest, durableMissingEffect.inventory, 'ACTION_RECEIPT_COVERAGE_SEMANTIC_EFFECT_MISMATCH');
  const sessionExempt = routeEffectCase(fixture, effects('credential'), 'session-credential-mutation', 'receipt-exempt');
  expectCode('session_mutation_exempt', sessionExempt.manifest, sessionExempt.inventory, 'ACTION_RECEIPT_COVERAGE_POLICY_MISMATCH');
  const sessionMissingEffect = routeEffectCase(fixture, effects('read'), 'session-credential-mutation', 'receipt-required');
  expectCode('session_mutation_missing_credential_or_session_write', sessionMissingEffect.manifest, sessionMissingEffect.inventory, 'ACTION_RECEIPT_COVERAGE_SEMANTIC_EFFECT_MISMATCH');

  const externalNetworkMissingEffect = routeEffectCase(fixture, effects('read'), 'external-network', 'receipt-required');
  expectCode('external_network_missing_effect', externalNetworkMissingEffect.manifest, externalNetworkMissingEffect.inventory, 'ACTION_RECEIPT_COVERAGE_SEMANTIC_EFFECT_MISMATCH');
  const externalNetworkExempt = routeEffectCase(fixture, effects('network'), 'external-network', 'receipt-exempt');
  expectCode('external_network_exempt', externalNetworkExempt.manifest, externalNetworkExempt.inventory, 'ACTION_RECEIPT_COVERAGE_POLICY_MISMATCH');
  const externalSpendMissingNetwork = routeEffectCase(fixture, effects('spend'), 'external-spend', 'receipt-required');
  expectCode('external_spend_missing_network', externalSpendMissingNetwork.manifest, externalSpendMissingNetwork.inventory, 'ACTION_RECEIPT_COVERAGE_SEMANTIC_EFFECT_MISMATCH');
  const externalSpendExempt = routeEffectCase(fixture, effects('spend', 'network'), 'external-spend', 'receipt-exempt');
  expectCode('external_spend_exempt', externalSpendExempt.manifest, externalSpendExempt.inventory, 'ACTION_RECEIPT_COVERAGE_POLICY_MISMATCH');
  const externalPublishMissingEffect = routeEffectCase(fixture, effects('read'), 'external-publish', 'receipt-required');
  expectCode('external_publish_missing_effect', externalPublishMissingEffect.manifest, externalPublishMissingEffect.inventory, 'ACTION_RECEIPT_COVERAGE_SEMANTIC_EFFECT_MISMATCH');
  const externalPublishExempt = routeEffectCase(fixture, effects('publish'), 'external-publish', 'receipt-exempt');
  expectCode('external_publish_exempt', externalPublishExempt.manifest, externalPublishExempt.inventory, 'ACTION_RECEIPT_COVERAGE_POLICY_MISMATCH');
  const externalProcessMissingEffect = legacyRouteCase(fixture, effects('read'), 'receipt-required');
  expectCode('external_process_missing_effect', externalProcessMissingEffect.manifest, externalProcessMissingEffect.inventory, 'ACTION_RECEIPT_COVERAGE_SEMANTIC_EFFECT_MISMATCH');
  const externalProcessExempt = legacyRouteCase(fixture, effects('process'), 'receipt-exempt');
  expectCode('external_process_exempt', externalProcessExempt.manifest, externalProcessExempt.inventory, 'ACTION_RECEIPT_COVERAGE_POLICY_MISMATCH');

  const externalSurfaceExempt = surfaceCase(fixture, {
    kind: 'external-effect',
    semanticClass: 'external-network',
    policy: 'receipt-exempt',
    effects: effects('network'),
  });
  expectCode('external_effect_surface_exemption_rejected', externalSurfaceExempt.manifest, externalSurfaceExempt.inventory, 'ACTION_RECEIPT_COVERAGE_EXTERNAL_SURFACE_INVALID');
  const externalSurfaceReadOnly = surfaceCase(fixture, {
    kind: 'external-effect',
    semanticClass: 'read-analysis-only',
    policy: 'receipt-exempt',
    effects: effects('read'),
  });
  expectCode('external_effect_surface_read_only_rejected', externalSurfaceReadOnly.manifest, externalSurfaceReadOnly.inventory, 'ACTION_RECEIPT_COVERAGE_EXTERNAL_SURFACE_INVALID');
  const externalSurfaceDurable = surfaceCase(fixture, {
    kind: 'external-effect',
    semanticClass: 'durable-local-mutation',
    policy: 'receipt-required',
    effects: effects('filesystem-write'),
  });
  externalSurfaceDurable.inventory.surfaces[0].kind = 'external-effect';
  expectCode('external_effect_surface_durable_local_rejected', externalSurfaceDurable.manifest, externalSurfaceDurable.inventory, 'ACTION_RECEIPT_COVERAGE_EXTERNAL_SURFACE_INVALID');
  const externalSurfaceAllowed = surfaceCase(fixture, {
    kind: 'external-effect',
    semanticClass: 'external-network',
    policy: 'receipt-required',
    effects: effects('network'),
  });
  externalSurfaceAllowed.inventory.surfaces[0].kind = 'external-effect';
  expectAccepted('external_effect_surface_external_class_allowed', externalSurfaceAllowed.manifest, externalSurfaceAllowed.inventory);
  const conditionalDevOnlyExempt = surfaceCase(fixture, {
    semanticClass: 'conditional-dev-only',
    policy: 'receipt-exempt',
    effects: effects('read'),
  });
  expectCode('conditional_dev_only_exemption_rejected', conditionalDevOnlyExempt.manifest, conditionalDevOnlyExempt.inventory, 'ACTION_RECEIPT_COVERAGE_POLICY_MISMATCH');
  const quietLocalMutation = routeEffectCase(fixture, effects('filesystem-write'), 'durable-local-mutation', 'receipt-required');
  expectCode('quiet_route_local_mutation_rejected', quietLocalMutation.manifest, quietLocalMutation.inventory, 'ACTION_RECEIPT_COVERAGE_QUIET_MUTATION');
  expectAccepted('fixture_cache_valid_exemption', fixture.manifest, fixture.inventory);
  const fixtureCacheLocalEffect = surfaceCase(fixture, { effects: effects('filesystem-write') });
  expectAccepted('fixture_cache_local_effect_allowed', fixtureCacheLocalEffect.manifest, fixtureCacheLocalEffect.inventory);
  for (const effect of ['network', 'spend', 'publish', 'process', 'credential'] as const) {
    const candidate = surfaceCase(fixture, { effects: effects(effect) });
    expectCode(
      `fixture_cache_rejects_${effect}`,
      candidate.manifest,
      candidate.inventory,
      'ACTION_RECEIPT_COVERAGE_SEMANTIC_EFFECT_MISMATCH',
    );
  }

  const orderingCandidate = routeCase(fixture, {
    effects: effects('read', 'not-a-real-effect'),
    authorityScopes: [],
  });
  const firstOrderingResult = validate(clone(orderingCandidate.manifest), clone(orderingCandidate.inventory));
  const secondOrderingResult = validate(clone(orderingCandidate.manifest), clone(orderingCandidate.inventory));
  check(
    'deterministic_error_ordering',
    firstOrderingResult !== undefined && secondOrderingResult !== undefined
      && !firstOrderingResult.ok && !secondOrderingResult.ok
      && JSON.stringify(firstOrderingResult.errors) === JSON.stringify(secondOrderingResult.errors),
    `${resultDetail(firstOrderingResult)}||${resultDetail(secondOrderingResult)}`,
  );

  check(
    'input_manifest_and_inventory_unchanged',
    JSON.stringify(fixture.manifest) === manifestBefore && JSON.stringify(fixture.inventory) === inventoryBefore,
  );

  const malformedManifest = clone(fixture.manifest);
  const malformedInventory = clone(fixture.inventory);
  (malformedManifest.routes[0] as unknown as Record<string, unknown>).unexpected = true;
  malformedManifest.routes[0].effects = [];
  (malformedInventory.routes[0].canonicalCapability as unknown as Record<string, unknown>).unexpected = true;
  (malformedInventory.surfaces[0] as unknown as Record<string, unknown>).unexpected = true;
  const malformedManifestBefore = JSON.stringify(malformedManifest);
  const malformedInventoryBefore = JSON.stringify(malformedInventory);
  const malformedResult = validate(malformedManifest, malformedInventory);
  check(
    'malformed_manifest_and_inventory_unchanged',
    malformedResult?.ok === false
      && JSON.stringify(malformedManifest) === malformedManifestBefore
      && JSON.stringify(malformedInventory) === malformedInventoryBefore,
    resultDetail(malformedResult),
  );

  const canonicalRequired = visibleRouteEffectCase(
    fixture,
    effects('filesystem-write'),
    'durable-local-mutation',
    'receipt-required',
  );
  const canonicalRequest = makeResolverRequest(canonicalRequired);
  const canonicalResolution = resolve(canonicalRequired.manifest, canonicalRequest);
  const expectedCanonicalResolution = {
    policy: 'receipt-required',
    prepareInput: {
      actor: canonicalRequest.actor,
      client: canonicalRequest.client,
      capability: { id: 'forge.action-receipt-coverage.selftest', version: '1' },
      authority: canonicalRequest.authority,
      effects: { declared: canonicalRequest.declaredEffects },
      input: canonicalRequest.input,
      validation: canonicalRequest.validation,
      rollback: canonicalRequest.rollback,
      metadata: canonicalRequest.metadata,
      preparedAt: canonicalRequest.preparedAt,
    },
  };
  check(
    'resolver_canonical_required_complete',
    canonicalResolution?.policy === 'receipt-required'
      && JSON.stringify(canonicalResolution) === JSON.stringify(expectedCanonicalResolution)
      && canonicalResolution.prepareInput.actor === canonicalRequest.actor
      && canonicalResolution.prepareInput.client === canonicalRequest.client
      && canonicalResolution.prepareInput.authority === canonicalRequest.authority
      && canonicalResolution.prepareInput.effects.declared === canonicalRequest.declaredEffects
      && canonicalResolution.prepareInput.input === canonicalRequest.input
      && canonicalResolution.prepareInput.validation === canonicalRequest.validation
      && canonicalResolution.prepareInput.rollback === canonicalRequest.rollback,
    JSON.stringify(canonicalResolution),
  );
  try {
    if (canonicalResolution?.policy !== 'receipt-required') {
      throw new Error('canonical resolver result was not receipt-required');
    }
    const receipt = createPreparedActionReceipt(canonicalResolution.prepareInput);
    const repeatedReceipt = createPreparedActionReceipt(canonicalResolution.prepareInput);
    const receiptBytes = serializeActionReceipt(receipt);
    const repeatedBytes = serializeActionReceipt(repeatedReceipt);
    check(
      'resolver_canonical_required_w3a_compatible',
      receipt.schema === 'forge.action-receipt.v1'
        && receipt.status === 'prepared'
        && 'id' in receipt.capability
        && receipt.capability.id === 'forge.action-receipt-coverage.selftest'
        && receipt.capability.version === '1'
        && isDeepStrictEqual(receipt.authority, canonicalRequest.authority)
        && receipt.times.preparedAt === canonicalRequest.preparedAt
        && /^[0-9a-f]{64}$/.test(receipt.hash)
        && /^ar_[0-9a-f]{64}$/.test(receipt.id)
        && receipt.hash === repeatedReceipt.hash
        && receiptBytes === repeatedBytes,
      `${receipt.id}:${receipt.hash}:${receiptBytes.length}`,
    );
  } catch (error) {
    check(
      'resolver_canonical_required_w3a_compatible',
      false,
      error instanceof Error ? error.message : String(error),
    );
  }

  const legacyRequired = legacyRouteCase(fixture, effects('process'), 'receipt-required');
  const legacyRequest = makeResolverRequest(legacyRequired);
  const legacyResolution = resolve(legacyRequired.manifest, legacyRequest);
  check(
    'resolver_legacy_required_complete',
    legacyResolution?.policy === 'receipt-required'
      && JSON.stringify(legacyResolution.prepareInput.capability) === JSON.stringify({
        legacyRoute: '/api/agent/action-receipt-coverage-selftest',
        method: 'POST',
        reviewed: true,
        reviewRef: 'W3B0-A1b-legacy-review',
      })
      && legacyResolution.prepareInput.authority === legacyRequest.authority
      && legacyResolution.prepareInput.effects.declared === legacyRequest.declaredEffects,
    JSON.stringify(legacyResolution),
  );
  try {
    if (legacyResolution?.policy !== 'receipt-required') {
      throw new Error('legacy resolver result was not receipt-required');
    }
    const receipt = createPreparedActionReceipt(legacyResolution.prepareInput);
    const repeatedReceipt = createPreparedActionReceipt(legacyResolution.prepareInput);
    const receiptBytes = serializeActionReceipt(receipt);
    const repeatedBytes = serializeActionReceipt(repeatedReceipt);
    check(
      'resolver_legacy_required_w3a_compatible',
      receipt.schema === 'forge.action-receipt.v1'
        && receipt.status === 'prepared'
        && 'legacyRoute' in receipt.capability
        && receipt.capability.legacyRoute === '/api/agent/action-receipt-coverage-selftest'
        && receipt.capability.method === 'POST'
        && receipt.capability.reviewed === true
        && receipt.capability.reviewRef === 'W3B0-A1b-legacy-review'
        && isDeepStrictEqual(receipt.authority, legacyRequest.authority)
        && receipt.times.preparedAt === legacyRequest.preparedAt
        && /^[0-9a-f]{64}$/.test(receipt.hash)
        && /^ar_[0-9a-f]{64}$/.test(receipt.id)
        && receipt.hash === repeatedReceipt.hash
        && receiptBytes === repeatedBytes,
      `${receipt.id}:${receipt.hash}:${receiptBytes.length}`,
    );
  } catch (error) {
    check(
      'resolver_legacy_required_w3a_compatible',
      false,
      error instanceof Error ? error.message : String(error),
    );
  }

  const exemptRequest = makeResolverRequest(fixture);
  const exemptResolution = resolve(fixture.manifest, exemptRequest);
  check(
    'resolver_receipt_exempt_no_prepare',
    exemptResolution !== undefined
      && JSON.stringify(exemptResolution) === JSON.stringify({ policy: 'receipt-exempt' })
      && !('prepareInput' in exemptResolution),
    JSON.stringify(exemptResolution),
  );

  const separatelyGoverned = routeCase(fixture, { policy: 'separately-governed' });
  const separatelyRequest = makeResolverRequest(separatelyGoverned);
  const separatelyResolution = resolve(separatelyGoverned.manifest, separatelyRequest);
  check(
    'resolver_separately_governed_no_prepare',
    separatelyResolution !== undefined
      && JSON.stringify(separatelyResolution) === JSON.stringify({ policy: 'separately-governed' })
      && !('prepareInput' in separatelyResolution),
    JSON.stringify(separatelyResolution),
  );

  const refusedFixture = visibleRouteEffectCase(
    fixture,
    effects('filesystem-write'),
    'durable-local-mutation',
    'refused',
  );
  const refusedResolution = resolve(refusedFixture.manifest, makeResolverRequest(refusedFixture));
  check(
    'resolver_policy_refused',
    hasRefusalCode(refusedResolution, 'ACTION_RECEIPT_COVERAGE_POLICY_REFUSED'),
    JSON.stringify(refusedResolution),
  );

  const unknownRouteRequest = makeResolverRequest(fixture);
  unknownRouteRequest.routeKey = 'POST /api/agent/action-receipt-coverage-unknown';
  const unknownRouteResolution = resolve(fixture.manifest, unknownRouteRequest);
  check(
    'resolver_unknown_route',
    hasRefusalCode(unknownRouteResolution, 'ACTION_RECEIPT_COVERAGE_UNKNOWN_ROUTE'),
    JSON.stringify(unknownRouteResolution),
  );

  const invalidResolverManifest = clone(fixture.manifest) as unknown as Record<string, unknown>;
  invalidResolverManifest['resolver-secret-body'] = 'must-not-leak';
  const invalidResolverRequest = makeResolverRequest(fixture);
  invalidResolverRequest.routeKey = 'POST /api/agent/action-receipt-coverage-unknown';
  const invalidManifestResolution = resolve(invalidResolverManifest, invalidResolverRequest);
  check(
    'resolver_invalid_manifest',
    hasRefusalCode(invalidManifestResolution, 'ACTION_RECEIPT_COVERAGE_MANIFEST_INVALID')
      && invalidManifestResolution?.policy === 'refused'
      && !invalidManifestResolution.message.includes('must-not-leak'),
    JSON.stringify(invalidManifestResolution),
  );

  const capabilityDrift = clone(fixture);
  capabilityDrift.inventory.routes[0].canonicalCapability!.id = 'forge.action-receipt-coverage.drift';
  const capabilityDriftResolution = resolve(capabilityDrift.manifest, makeResolverRequest(capabilityDrift));
  check(
    'resolver_capability_drift',
    hasRefusalCode(capabilityDriftResolution, 'ACTION_RECEIPT_COVERAGE_CAPABILITY_MISMATCH'),
    JSON.stringify(capabilityDriftResolution),
  );

  const workspaceScopeRequest = makeResolverRequest(canonicalRequired, 'workspace');
  const workspaceScopeResolution = resolve(canonicalRequired.manifest, workspaceScopeRequest);
  check(
    'resolver_workspace_scope_allowed',
    workspaceScopeResolution?.policy === 'receipt-required'
      && workspaceScopeResolution.prepareInput.authority === workspaceScopeRequest.authority,
    JSON.stringify(workspaceScopeResolution),
  );

  const globalScoped = clone(canonicalRequired);
  globalScoped.manifest.routes[0].authorityScopes = ['global'];
  const workspaceDeniedResolution = resolve(globalScoped.manifest, makeResolverRequest(globalScoped, 'workspace'));
  check(
    'resolver_workspace_scope_denied',
    hasRefusalCode(workspaceDeniedResolution, 'ACTION_RECEIPT_COVERAGE_SCOPE_DENIED'),
    JSON.stringify(workspaceDeniedResolution),
  );

  const globalScopeRequest = makeResolverRequest(globalScoped, 'global');
  const globalScopeResolution = resolve(globalScoped.manifest, globalScopeRequest);
  check(
    'resolver_global_scope_allowed_no_fabricated_identity',
    globalScopeResolution?.policy === 'receipt-required'
      && globalScopeResolution.prepareInput.authority === globalScopeRequest.authority
      && !('profileId' in globalScopeResolution.prepareInput.authority)
      && !('workspaceId' in globalScopeResolution.prepareInput.authority),
    JSON.stringify(globalScopeResolution),
  );

  const profileScoped = clone(canonicalRequired);
  profileScoped.manifest.routes[0].authorityScopes = ['profile'];
  const globalDeniedResolution = resolve(profileScoped.manifest, makeResolverRequest(profileScoped, 'global'));
  check(
    'resolver_global_scope_denied',
    hasRefusalCode(globalDeniedResolution, 'ACTION_RECEIPT_COVERAGE_SCOPE_DENIED'),
    JSON.stringify(globalDeniedResolution),
  );

  const profileScopeRequest = makeResolverRequest(profileScoped, 'profile');
  const profileScopeResolution = resolve(profileScoped.manifest, profileScopeRequest);
  check(
    'resolver_profile_scope_allowed',
    profileScopeResolution?.policy === 'receipt-required'
      && profileScopeResolution.prepareInput.authority === profileScopeRequest.authority,
    JSON.stringify(profileScopeResolution),
  );

  const profileDeniedResolution = resolve(canonicalRequired.manifest, makeResolverRequest(canonicalRequired, 'profile'));
  check(
    'resolver_profile_scope_denied',
    hasRefusalCode(profileDeniedResolution, 'ACTION_RECEIPT_COVERAGE_SCOPE_DENIED'),
    JSON.stringify(profileDeniedResolution),
  );

  const twoEffectRequired = routeEffectCase(
    fixture,
    effects('network', 'spend'),
    'external-spend',
    'receipt-required',
  );
  const matchingEffectRequest = makeResolverRequest(twoEffectRequired);
  const omittedEffectRequest = clone(matchingEffectRequest);
  omittedEffectRequest.declaredEffects = omittedEffectRequest.declaredEffects.slice(0, 1);
  const omittedEffectResolution = resolve(twoEffectRequired.manifest, omittedEffectRequest);
  check(
    'resolver_effect_omission',
    hasRefusalCode(omittedEffectResolution, 'ACTION_RECEIPT_COVERAGE_EFFECT_MISMATCH'),
    JSON.stringify(omittedEffectResolution),
  );

  const addedEffectRequest = clone(matchingEffectRequest);
  addedEffectRequest.declaredEffects.push({
    ...addedEffectRequest.declaredEffects[0],
    id: 'read',
    operation: 'selftest:read',
  });
  const addedEffectResolution = resolve(twoEffectRequired.manifest, addedEffectRequest);
  check(
    'resolver_effect_addition',
    hasRefusalCode(addedEffectResolution, 'ACTION_RECEIPT_COVERAGE_EFFECT_MISMATCH'),
    JSON.stringify(addedEffectResolution),
  );

  const duplicateEffectRequest = clone(matchingEffectRequest);
  duplicateEffectRequest.declaredEffects.push(clone(duplicateEffectRequest.declaredEffects[0]));
  const duplicateEffectResolution = resolve(twoEffectRequired.manifest, duplicateEffectRequest);
  check(
    'resolver_effect_duplicate',
    hasRefusalCode(duplicateEffectResolution, 'ACTION_RECEIPT_COVERAGE_EFFECT_MISMATCH'),
    JSON.stringify(duplicateEffectResolution),
  );

  const malformedEffectRequest = clone(matchingEffectRequest);
  malformedEffectRequest.declaredEffects[0].id = ' ';
  const malformedEffectResolution = resolve(twoEffectRequired.manifest, malformedEffectRequest);
  check(
    'resolver_effect_malformed_id',
    hasRefusalCode(malformedEffectResolution, 'ACTION_RECEIPT_COVERAGE_EFFECT_MISMATCH'),
    JSON.stringify(malformedEffectResolution),
  );

  const reorderedEffectRequest = clone(matchingEffectRequest);
  reorderedEffectRequest.declaredEffects.reverse();
  const reorderedEffectResolution = resolve(twoEffectRequired.manifest, reorderedEffectRequest);
  check(
    'resolver_effect_order_insensitive_success',
    reorderedEffectResolution?.policy === 'receipt-required'
      && reorderedEffectResolution.prepareInput.effects.declared === reorderedEffectRequest.declaredEffects,
    JSON.stringify(reorderedEffectResolution),
  );

  const immutableResolverManifest = clone(canonicalRequired.manifest);
  const immutableResolverRequest = makeResolverRequest(canonicalRequired);
  const immutableResolverManifestBefore = JSON.stringify(immutableResolverManifest);
  const immutableResolverRequestBefore = JSON.stringify(immutableResolverRequest);
  const firstResolverResult = resolve(immutableResolverManifest, immutableResolverRequest);
  const secondResolverResult = resolve(immutableResolverManifest, immutableResolverRequest);
  check(
    'resolver_inputs_immutable_and_deterministic',
    firstResolverResult?.policy === 'receipt-required'
      && JSON.stringify(firstResolverResult) === JSON.stringify(secondResolverResult)
      && JSON.stringify(immutableResolverManifest) === immutableResolverManifestBefore
      && JSON.stringify(immutableResolverRequest) === immutableResolverRequestBefore,
    `${JSON.stringify(firstResolverResult)}||${JSON.stringify(secondResolverResult)}`,
  );

  const failures = checks.filter(item => !item.pass).map(item => item.name);
  const passed = checks.length - failures.length;
  const allPassed = failures.length === 0;
  return { allPassed, pass: allPassed, passed, total: checks.length, failures, checks };
}
