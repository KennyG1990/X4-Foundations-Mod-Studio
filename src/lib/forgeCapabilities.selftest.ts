/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'crypto';
import { scopeAllows, type AgentKeyScope } from './agentKeys';
import { ledgerRouteKind } from './agentHistory';
import {
  FORGE_CAPABILITIES,
  applyForgeCapabilityFixedBody,
  buildForgeCapabilityContract,
  canonicalCapabilityContractPayload,
  findForgeCapability,
  isForgeCapabilityContractV1,
  verifyForgeCapabilityContract,
  validateForgeCapabilityRegistry,
  type ForgeCapabilityDescriptorV1,
} from './forgeCapabilities';

interface CapabilityCheck {
  name: string;
  pass: boolean;
  detail?: string;
}

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function sampleRoute(path: string): string {
  return path.replace(/:[A-Za-z0-9_]+/g, 'sample');
}

function observedAgentScopes(capability: ForgeCapabilityDescriptorV1): AgentKeyScope[] {
  const primary = capability.apiBindings.find(binding => binding.role === 'primary');
  if (!primary) return [];
  const reqPath = sampleRoute(primary.path).replace(/^\/api/, '');
  return (['read', 'write', 'deploy'] as const).filter(scope => scopeAllows(scope, primary.method, reqPath));
}

export async function runForgeCapabilitiesSelftest(): Promise<{ pass: boolean; checks: CapabilityCheck[]; contractHash: string }> {
  const checks: CapabilityCheck[] = [];
  const check = (name: string, pass: boolean, detail?: string): void => {
    checks.push({ name, pass, ...(detail ? { detail } : {}) });
  };

  const validationErrors = validateForgeCapabilityRegistry();
  check('registry invariants', validationErrors.length === 0, validationErrors.join(' | ') || undefined);
  check('bounded initial registry', FORGE_CAPABILITIES.length === 11, `count=${FORGE_CAPABILITIES.length}`);

  const canonical = canonicalCapabilityContractPayload();
  const contract = buildForgeCapabilityContract(sha256);
  const second = buildForgeCapabilityContract(sha256);
  check('deterministic sha256 contract', contract.contractHash === second.contractHash && contract.contractHash === sha256(canonical), contract.contractHash);
  check('no volatile timestamp field', !canonical.includes('generatedAt') && !canonical.includes('timestamp'));
  check('canonical contract shape is accepted', isForgeCapabilityContractV1(contract));
  check('unhashed top-level contract fields are rejected',
    !isForgeCapabilityContractV1({ ...contract, generatedAt: '2030-01-01T00:00:00.000Z' }));
  const syntacticallyValidWrongHash = {
    ...contract,
    contractHash: `${contract.contractHash[0] === '0' ? '1' : '0'}${contract.contractHash.slice(1)}`,
  };
  check('malformed hash and duplicate identities are rejected by shape',
    !isForgeCapabilityContractV1({ ...contract, contractHash: 'bad' }) &&
    !isForgeCapabilityContractV1({ ...contract, capabilities: [contract.capabilities[0], contract.capabilities[0]] }));
  check('canonical hash verifies and a valid-looking wrong hash is rejected',
    await verifyForgeCapabilityContract(contract) &&
    isForgeCapabilityContractV1(syntacticallyValidWrongHash) &&
    !await verifyForgeCapabilityContract(syntacticallyValidWrongHash));
  const firstCapability = FORGE_CAPABILITIES[0];
  const secondVersion = {
    ...firstCapability,
    version: firstCapability.version + 1,
    apiBindings: firstCapability.apiBindings.map(binding => ({ ...binding, path: `${binding.path}/v2` })),
    surfaces: { ...firstCapability.surfaces, mcp: [] },
  } as ForgeCapabilityDescriptorV1;
  const collidingCapability = {
    ...firstCapability,
    id: 'contract.bindingcollision',
    surfaces: { ...firstCapability.surfaces, mcp: [] },
  } as ForgeCapabilityDescriptorV1;
  const duplicateVersionContract = buildForgeCapabilityContract(sha256, [firstCapability, secondVersion]);
  const collidingBindingContract = buildForgeCapabilityContract(sha256, [firstCapability, collidingCapability]);
  const duplicateVersionErrors = validateForgeCapabilityRegistry([firstCapability, secondVersion]);
  const collidingBindingErrors = validateForgeCapabilityRegistry([firstCapability, collidingCapability]);
  check(
    'stable ids and contract-wide API bindings are unambiguous',
    !isForgeCapabilityContractV1(duplicateVersionContract) && !isForgeCapabilityContractV1(collidingBindingContract) &&
      duplicateVersionErrors.some(error => error.includes('duplicate stable capability id')) &&
      collidingBindingErrors.some(error => error.includes('duplicate API binding')),
    [...duplicateVersionErrors, ...collidingBindingErrors].join(' | '),
  );
  const incompleteCapability = {
    id: 'project.validate',
    version: 1,
    effects: ['read'],
    apiBindings: [],
    surfaces: {},
  } as unknown as ForgeCapabilityDescriptorV1;
  const correctlyHashedIncompleteContract = buildForgeCapabilityContract(sha256, [incompleteCapability]);
  check(
    'correctly hashed incomplete descriptor is rejected',
    !isForgeCapabilityContractV1(correctlyHashedIncompleteContract),
  );
  const schemaDomains = findForgeCapability('schema.domains.list')!;
  const transportMismatch = {
    ...schemaDomains,
    apiBindings: schemaDomains.apiBindings.map(binding => binding.role === 'primary'
      ? { ...binding, inputLocation: 'none' as const }
      : binding),
  } as ForgeCapabilityDescriptorV1;
  const transportMismatchErrors = validateForgeCapabilityRegistry([transportMismatch]);
  check(
    'declared caller input cannot use a none transport binding',
    transportMismatchErrors.some(error => error.includes('input schema declares caller input')) &&
      !isForgeCapabilityContractV1(buildForgeCapabilityContract(sha256, [transportMismatch])),
    transportMismatchErrors.join(' | ') || undefined,
  );
  const openTransportMismatch = {
    ...findForgeCapability('workspace.read')!,
    inputSchema: { type: 'object', properties: {}, additionalProperties: true },
  } as ForgeCapabilityDescriptorV1;
  const openTransportErrors = validateForgeCapabilityRegistry([openTransportMismatch]);
  check(
    'additionalProperties caller input cannot use a none transport binding',
    openTransportErrors.some(error => error.includes('input schema declares caller input')) &&
      !isForgeCapabilityContractV1(buildForgeCapabilityContract(sha256, [openTransportMismatch])),
    openTransportErrors.join(' | ') || undefined,
  );

  const validationCapability = findForgeCapability('project.validate')!;
  const invalidApiPath = {
    ...validationCapability,
    apiBindings: validationCapability.apiBindings.map(binding => ({ ...binding, path: `${binding.path}?decoy=1` })),
  } as ForgeCapabilityDescriptorV1;
  const invalidApiPathErrors = validateForgeCapabilityRegistry([invalidApiPath]);
  const traversalApiPath = {
    ...validationCapability,
    apiBindings: validationCapability.apiBindings.map(binding => ({ ...binding, path: `${binding.path}/../hidden` })),
  } as ForgeCapabilityDescriptorV1;
  const traversalApiPathErrors = validateForgeCapabilityRegistry([traversalApiPath]);
  check(
    'API bindings are literal Express paths without query, fragment, or traversal text',
    invalidApiPathErrors.some(error => error.includes('literal /api route')) &&
      traversalApiPathErrors.some(error => error.includes('literal /api route')) &&
      !isForgeCapabilityContractV1(buildForgeCapabilityContract(sha256, [invalidApiPath])) &&
      !isForgeCapabilityContractV1(buildForgeCapabilityContract(sha256, [traversalApiPath])),
    [...invalidApiPathErrors, ...traversalApiPathErrors].join(' | ') || undefined,
  );
  const fixedBodyTypeMismatch = {
    ...validationCapability,
    inputSchema: {
      ...validationCapability.inputSchema,
      properties: {
        ...validationCapability.inputSchema.properties,
        recordBaseline: { type: 'string' },
      },
    },
  } as ForgeCapabilityDescriptorV1;
  const fixedBodyTypeErrors = validateForgeCapabilityRegistry([fixedBodyTypeMismatch]);
  check(
    'fixed-body values must match every binding input schema',
    fixedBodyTypeErrors.some(error => error.includes('does not match its input schema')) &&
      !isForgeCapabilityContractV1(buildForgeCapabilityContract(sha256, [fixedBodyTypeMismatch])),
    fixedBodyTypeErrors.join(' | ') || undefined,
  );

  const duplicateMcpAlias = {
    ...validationCapability,
    id: 'project.validatealiascollision',
    apiBindings: validationCapability.apiBindings.map(binding => ({ ...binding, path: `${binding.path}/alias-collision` })),
  } as ForgeCapabilityDescriptorV1;
  const duplicateMcpAliasErrors = validateForgeCapabilityRegistry([validationCapability, duplicateMcpAlias]);
  check(
    'MCP aliases are unique across the capability contract',
    duplicateMcpAliasErrors.some(error => error.includes('MCP alias')) &&
      !isForgeCapabilityContractV1(buildForgeCapabilityContract(sha256, [validationCapability, duplicateMcpAlias])),
    duplicateMcpAliasErrors.join(' | ') || undefined,
  );

  const known = findForgeCapability('project.validate');
  check('known capability lookup', known?.version === 1);
  check('unknown capability refusal', findForgeCapability('project.validate', 99) === undefined && findForgeCapability('unknown.capability') === undefined);
  check(
    'validation aliases converge',
    JSON.stringify(known?.surfaces.mcp.map(projection => projection.id)) === JSON.stringify(['validate_mod', 'author_check', 'stage_and_validate']) &&
      known?.surfaces.mcp.every(projection => projection.status === 'partial' && !!projection.note) === true,
    JSON.stringify(known?.surfaces.mcp),
  );
  check(
    'validation adapter fixes recordBaseline false',
    known?.apiBindings[0]?.fixedBody?.recordBaseline === false &&
      known.inputSchema.properties?.recordBaseline?.enum?.[0] === false &&
      known.inputSchema.anyOf?.some(branch => branch.required?.[0] === 'project') === true &&
      known.inputSchema.anyOf?.some(branch => branch.required?.[0] === 'fromPath') === true,
  );
  check(
    'fixed-body adapter overrides hostile mutation flags',
    applyForgeCapabilityFixedBody('project.validate', { recordBaseline: true }).recordBaseline === false &&
      applyForgeCapabilityFixedBody('workspace.generate.preview', { apply: true }).apply === false,
  );

  const preview = findForgeCapability('workspace.generate.preview');
  const previewPrimary = preview?.apiBindings.find(binding => binding.role === 'primary');
  check(
    'generation is preview constrained',
    previewPrimary?.path === '/api/agent/generate/preview' && previewPrimary.fixedBody?.apply === false,
  );
  check(
    'generation spend and network are explicit',
    preview?.effects.includes('spend') === true && preview.effects.includes('network') === true && preview.surfaces.mcp.length === 0,
  );

  const scopeMismatches = FORGE_CAPABILITIES.flatMap(capability => {
    const observed = observedAgentScopes(capability);
    return JSON.stringify(observed) === JSON.stringify(capability.access.agentScopes)
      ? []
      : [`${capability.id}: declared=${capability.access.agentScopes.join(',')} observed=${observed.join(',')}`];
  });
  check('declared agent scopes match current middleware', scopeMismatches.length === 0, scopeMismatches.join(' | ') || undefined);

  const unclassifiedPosts = FORGE_CAPABILITIES.flatMap(capability => capability.apiBindings
    .filter(binding => binding.method === 'POST')
    .filter(binding => ledgerRouteKind(binding.method, sampleRoute(binding.path)) === null)
    .map(binding => `${capability.id}: ${binding.method} ${binding.path}`));
  check('post bindings have ledger disposition', unclassifiedPosts.length === 0, unclassifiedPosts.join(' | ') || undefined);

  const malformed = {
    ...FORGE_CAPABILITIES[0],
    id: 'Malformed Capability',
    version: 0,
    effects: [],
    apiBindings: [
      ...FORGE_CAPABILITIES[0].apiBindings,
      ...FORGE_CAPABILITIES[0].apiBindings,
    ],
  } as unknown as ForgeCapabilityDescriptorV1;
  const malformedErrors = validateForgeCapabilityRegistry([malformed]);
  const malformedSurface = {
    ...FORGE_CAPABILITIES[0],
    outputSchema: { type: 'object', properties: {}, additionalProperties: true },
    surfaces: {
      ...FORGE_CAPABILITIES[0].surfaces,
      ui: [{ id: 'false-live', status: 'connected' }],
    },
  } as unknown as ForgeCapabilityDescriptorV1;
  const malformedSurfaceErrors = validateForgeCapabilityRegistry([malformedSurface]);
  const duplicateErrors = validateForgeCapabilityRegistry([FORGE_CAPABILITIES[0], FORGE_CAPABILITIES[0]]);
  check(
    'malformed descriptor fixture is rejected',
    malformedErrors.some(error => error.includes('lower-case dotted')) &&
      malformedErrors.some(error => error.includes('positive integer')) &&
      malformedErrors.some(error => error.includes('at least one effect')) &&
      malformedErrors.some(error => error.includes('duplicate API binding')) &&
      malformedSurfaceErrors.some(error => error.includes('output schema must declare')) &&
      malformedSurfaceErrors.some(error => error.includes('requires a file::token anchor')) &&
      duplicateErrors.some(error => error.includes('duplicate capability identity')),
    [...malformedErrors, ...malformedSurfaceErrors, ...duplicateErrors].join(' | '),
  );

  return { pass: checks.every(item => item.pass), checks, contractHash: contract.contractHash };
}
