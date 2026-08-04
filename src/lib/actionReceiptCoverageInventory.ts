import type {
  DiscoveredActionReceiptCoverageInventory,
  DiscoveredReceiptCoverageCapability,
  DiscoveredReceiptCoverageSurface,
  ReceiptCoverageSurfaceKind,
} from './actionReceiptCoverage.js';
import type {
  ForgeCapabilityDescriptorV1,
} from './forgeCapabilities.js';

export type InventorySurfaceKind = Extract<
  ReceiptCoverageSurfaceKind,
  'filesystem-writer' | 'host-store' | 'browser-output' | 'sqlite'
>;

export interface ActionReceiptCoverageInventoryAuthorities {
  routeAuthority: unknown;
  durableWriterAuthority: unknown;
  capabilities: readonly ForgeCapabilityDescriptorV1[];
  quietRoutes: readonly string[];
}

export interface ActionReceiptCoverageInventoryBuildResult {
  inventory: DiscoveredActionReceiptCoverageInventory;
  totalRouteCount: number;
  nonGetRouteCount: number;
  surfaceCounts: Record<InventorySurfaceKind, number>;
}

export interface RouteAuthorityMetadata {
  agentScopes: string[];
  disposition: string;
  workspaceMode: string;
}

export interface SurfaceAuthorityMetadata {
  categories: string[];
  owners: string[];
}

export interface ActionReceiptCoverageBuildAuthority {
  routes: Map<string, RouteAuthorityMetadata>;
  surfaces: Map<string, SurfaceAuthorityMetadata>;
}

const BUILD_AUTHORITY_METADATA = Symbol('action-receipt-coverage-build-authority');
type InternalInventoryBuildResult = ActionReceiptCoverageInventoryBuildResult & {
  [BUILD_AUTHORITY_METADATA]: ActionReceiptCoverageBuildAuthority;
};

function stableError(code: string, detail: string): Error {
  return new Error(`${code}: ${detail}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw stableError('ACTION_RECEIPT_COVERAGE_AUTHORITY_INVALID', `${label}:object-required`);
  }
  return value;
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0 || value !== value.trim()) {
    throw stableError('ACTION_RECEIPT_COVERAGE_AUTHORITY_INVALID', `${label}:nonempty-string-required`);
  }
  return value;
}

function compareOrdinal(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function jsonPointerToken(value: string): string {
  return value.replace(/~/g, '~0').replace(/\//g, '~1');
}

function sameCanonicalCapability(
  left: DiscoveredReceiptCoverageCapability,
  right: DiscoveredReceiptCoverageCapability,
): boolean {
  return left.id === right.id
    && left.version === right.version
    && left.effects.length === right.effects.length
    && left.effects.every((effect, index) => effect === right.effects[index]);
}

function buildCanonicalBindingMap(
  capabilities: readonly ForgeCapabilityDescriptorV1[],
): Map<string, DiscoveredReceiptCoverageCapability> {
  const bindings = new Map<string, DiscoveredReceiptCoverageCapability>();
  for (const capability of capabilities) {
    const runtimeCapability = capability as unknown as Record<string, unknown>;
    const capabilityVersion = runtimeCapability.version;
    const capabilityEffects = runtimeCapability.effects;
    if (typeof capability.id !== 'string' || capability.id.length === 0
      || typeof capabilityVersion !== 'number' || !Number.isInteger(capabilityVersion) || capabilityVersion <= 0
      || !Array.isArray(capabilityEffects) || capabilityEffects.length === 0) {
      throw stableError('ACTION_RECEIPT_COVERAGE_CAPABILITY_INVALID', 'registry-entry');
    }
    if (new Set(capability.effects).size !== capability.effects.length) {
      throw stableError('ACTION_RECEIPT_COVERAGE_CAPABILITY_INVALID', `${capability.id}:duplicate-effect`);
    }
    for (const binding of capability.apiBindings) {
      const method = requireString(binding.method, `${capability.id}.apiBinding.method`);
      const template = requireString(binding.path, `${capability.id}.apiBinding.path`);
      const routeKey = `${method} ${template}`;
      const candidate: DiscoveredReceiptCoverageCapability = {
        id: capability.id,
        version: capabilityVersion,
        effects: [...capability.effects],
      };
      const previous = bindings.get(routeKey);
      if (previous !== undefined && !sameCanonicalCapability(previous, candidate)) {
        throw stableError('ACTION_RECEIPT_COVERAGE_CAPABILITY_BINDING_CONFLICT', routeKey);
      }
      bindings.set(routeKey, candidate);
    }
  }
  return bindings;
}

function reviewedStrings(value: unknown, label: string, duplicateCode: string): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw stableError('ACTION_RECEIPT_COVERAGE_AUTHORITY_INVALID', `${label}:nonempty-array-required`);
  }
  const values: string[] = [];
  const seen = new Set<string>();
  for (let index = 0; index < value.length; index += 1) {
    const entry = requireString(value[index], `${label}[${index}]`);
    if (seen.has(entry)) {
      throw stableError(duplicateCode, `${label}:${entry}`);
    }
    seen.add(entry);
    values.push(entry);
  }
  return values;
}

function routeAuthorityMetadata(value: Record<string, unknown>, label: string): RouteAuthorityMetadata {
  const disposition = requireString(value.disposition, `${label}.disposition`);
  const workspaceMode = requireString(value.workspaceMode, `${label}.workspaceMode`);
  if (!['none', 'optional', 'required', 'input-first'].includes(workspaceMode)) {
    throw stableError('ACTION_RECEIPT_COVERAGE_AUTHORITY_INVALID', `${label}.workspaceMode:value`);
  }
  if (!Array.isArray(value.agentScopes)) {
    throw stableError('ACTION_RECEIPT_COVERAGE_AUTHORITY_INVALID', `${label}.agentScopes:array-required`);
  }
  const agentScopes: string[] = [];
  const seen = new Set<string>();
  for (let index = 0; index < value.agentScopes.length; index += 1) {
    const scope = requireString(value.agentScopes[index], `${label}.agentScopes[${index}]`);
    if (!['read', 'write', 'deploy'].includes(scope) || seen.has(scope)) {
      throw stableError('ACTION_RECEIPT_COVERAGE_AUTHORITY_INVALID', `${label}.agentScopes:value`);
    }
    seen.add(scope);
    agentScopes.push(scope);
  }
  return { agentScopes, disposition, workspaceMode };
}

function addSurface(
  surfaces: DiscoveredReceiptCoverageSurface[],
  ids: Set<string>,
  kind: InventorySurfaceKind,
  file: string,
  owner: string,
  sourceRef: string,
): string {
  const id = `${kind}:${file}`;
  if (ids.has(id)) {
    throw stableError('ACTION_RECEIPT_COVERAGE_SURFACE_ID_DUPLICATE', id);
  }
  ids.add(id);
  surfaces.push({ id, kind, owner, sourceRef });
  return id;
}

function buildSurfaces(authority: unknown): {
  surfaces: DiscoveredReceiptCoverageSurface[];
  counts: Record<InventorySurfaceKind, number>;
  authorities: Map<string, SurfaceAuthorityMetadata>;
} {
  const root = requireRecord(authority, 'durable-writers');
  if (root.version !== 1) {
    throw stableError('ACTION_RECEIPT_COVERAGE_AUTHORITY_INVALID', 'durable-writers.version');
  }
  const surfaces: DiscoveredReceiptCoverageSurface[] = [];
  const ids = new Set<string>();
  const authorities = new Map<string, SurfaceAuthorityMetadata>();
  const counts: Record<InventorySurfaceKind, number> = {
    'filesystem-writer': 0,
    'host-store': 0,
    'browser-output': 0,
    sqlite: 0,
  };
  const arrays: Array<{ field: string; kind: InventorySurfaceKind }> = [
    { field: 'writers', kind: 'filesystem-writer' },
    { field: 'hostStores', kind: 'host-store' },
    { field: 'browserOutputs', kind: 'browser-output' },
  ];
  for (const { field, kind } of arrays) {
    const entries = root[field];
    if (!Array.isArray(entries) || entries.length === 0) {
      throw stableError('ACTION_RECEIPT_COVERAGE_AUTHORITY_INVALID', `durable-writers.${field}:nonempty-array-required`);
    }
    counts[kind] = entries.length;
    for (let index = 0; index < entries.length; index += 1) {
      const entry = requireRecord(entries[index], `durable-writers.${field}[${index}]`);
      const file = requireString(entry.file, `durable-writers.${field}[${index}].file`);
      const owners = reviewedStrings(
        entry.owners,
        `durable-writers.${field}[${index}].owners`,
        'ACTION_RECEIPT_COVERAGE_SURFACE_OWNER_DUPLICATE',
      );
      const categories = reviewedStrings(
        entry.categories,
        `durable-writers.${field}[${index}].categories`,
        'ACTION_RECEIPT_COVERAGE_SURFACE_CATEGORY_DUPLICATE',
      );
      const id = addSurface(
        surfaces,
        ids,
        kind,
        file,
        owners.join(' | '),
        `config/durable-writers.json#/${field}/${index}`,
      );
      authorities.set(id, { categories, owners });
    }
  }
  const database = requireRecord(root.database, 'durable-writers.database');
  const databaseFile = requireString(database.file, 'durable-writers.database.file');
  const databaseOwners = reviewedStrings(
    database.owners,
    'durable-writers.database.owners',
    'ACTION_RECEIPT_COVERAGE_SURFACE_OWNER_DUPLICATE',
  );
  const databaseCategory = requireString(database.category, 'durable-writers.database.category');
  const databaseId = addSurface(
    surfaces,
    ids,
    'sqlite',
    databaseFile,
    databaseOwners.join(' | '),
    'config/durable-writers.json#/database',
  );
  authorities.set(databaseId, { categories: [databaseCategory], owners: databaseOwners });
  counts.sqlite = 1;
  surfaces.sort((left, right) => compareOrdinal(left.id, right.id));
  return { surfaces, counts, authorities };
}

export function buildDiscoveredActionReceiptCoverageInventory(
  authorities: ActionReceiptCoverageInventoryAuthorities,
): ActionReceiptCoverageInventoryBuildResult {
  const routeAuthority = requireRecord(authorities.routeAuthority, 'forge-route-dispositions');
  if (routeAuthority.schemaVersion !== 'forge.route-dispositions.v4') {
    throw stableError('ACTION_RECEIPT_COVERAGE_AUTHORITY_INVALID', 'forge-route-dispositions.schemaVersion');
  }
  const routeRecords = requireRecord(routeAuthority.routes, 'forge-route-dispositions.routes');
  const routeEntries = Object.entries(routeRecords).sort(([left], [right]) => compareOrdinal(left, right));
  if (routeEntries.length === 0) {
    throw stableError('ACTION_RECEIPT_COVERAGE_AUTHORITY_INVALID', 'forge-route-dispositions.routes:nonempty-required');
  }
  const canonicalBindings = buildCanonicalBindingMap(authorities.capabilities);
  const quietRoutes = new Set(authorities.quietRoutes);
  if (quietRoutes.size !== authorities.quietRoutes.length
    || authorities.quietRoutes.some(route => typeof route !== 'string' || route.length === 0 || route !== route.trim())) {
    throw stableError('ACTION_RECEIPT_COVERAGE_HISTORY_AUTHORITY_INVALID', 'LEDGER_QUIET_ROUTES');
  }
  const discoveredRouteKeys = new Set(routeEntries.map(([routeKey]) => routeKey));
  const routeAuthorities = new Map<string, RouteAuthorityMetadata>();
  const routes: DiscoveredActionReceiptCoverageInventory['routes'] = [];
  for (const [routeKey, rawDisposition] of routeEntries) {
    const separator = routeKey.indexOf(' ');
    if (separator <= 0 || separator === routeKey.length - 1) {
      throw stableError('ACTION_RECEIPT_COVERAGE_ROUTE_KEY_INVALID', routeKey);
    }
    const method = routeKey.slice(0, separator);
    const template = routeKey.slice(separator + 1);
    if (!/^[A-Z]+$/.test(method) || template.length === 0 || template !== template.trim()) {
      throw stableError('ACTION_RECEIPT_COVERAGE_ROUTE_KEY_INVALID', routeKey);
    }
    const disposition = requireRecord(rawDisposition, `forge-route-dispositions.routes.${routeKey}`);
    const authorityMetadata = routeAuthorityMetadata(
      disposition,
      `forge-route-dispositions.routes.${routeKey}`,
    );
    routeAuthorities.set(routeKey, authorityMetadata);
    const owner = requireString(disposition.owner, `forge-route-dispositions.routes.${routeKey}.owner`);
    const resourceClass = requireString(
      disposition.resourceClass,
      `forge-route-dispositions.routes.${routeKey}.resourceClass`,
    );
    if (method === 'GET') continue;
    const canonicalCapability = canonicalBindings.get(routeKey);
    routes.push({
      routeKey,
      method,
      template,
      owner,
      resourceClass,
      sourceRef: `config/forge-route-dispositions.json#/routes/${jsonPointerToken(routeKey)}`,
      history: template.startsWith('/api/reference/')
        ? 'none'
        : quietRoutes.has(template) ? 'quiet' : 'visible',
      ...(canonicalCapability === undefined ? {} : {
        canonicalCapability: {
          id: canonicalCapability.id,
          version: canonicalCapability.version,
          effects: [...canonicalCapability.effects],
        },
      }),
    });
  }
  for (const routeKey of canonicalBindings.keys()) {
    if (!routeKey.startsWith('GET ') && !discoveredRouteKeys.has(routeKey)) {
      throw stableError('ACTION_RECEIPT_COVERAGE_CANONICAL_ROUTE_MISSING', routeKey);
    }
  }

  const { surfaces, counts, authorities: surfaceAuthorities } = buildSurfaces(authorities.durableWriterAuthority);
  const result: InternalInventoryBuildResult = {
    inventory: { routes, surfaces },
    totalRouteCount: routeEntries.length,
    nonGetRouteCount: routes.length,
    surfaceCounts: counts,
    [BUILD_AUTHORITY_METADATA]: {
      routes: routeAuthorities,
      surfaces: surfaceAuthorities,
    },
  };
  return result;
}

export const buildActionReceiptCoverageInventory = buildDiscoveredActionReceiptCoverageInventory;

export function getActionReceiptCoverageBuildAuthority(
  buildResult: ActionReceiptCoverageInventoryBuildResult,
): ActionReceiptCoverageBuildAuthority | undefined {
  return (buildResult as Partial<InternalInventoryBuildResult>)[BUILD_AUTHORITY_METADATA];
}
