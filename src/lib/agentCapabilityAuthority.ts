/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * B118 — compose immutable per-key narrowing with the canonical Forge capability
 * registry and B117's exact route authority. Metadata never grants: every effective
 * capability must still resolve to its reviewed primary route.
 */

import {
  FORGE_CAPABILITIES,
  FORGE_CAPABILITY_EFFECTS,
  type ForgeCapabilityDescriptorV1,
  type ForgeCapabilityEffect,
} from './forgeCapabilities';
import type {
  AgentAuthorityResolution,
  AgentKeyScope,
  AgentRouteAuthorityDecision,
} from './agentAuthority';

export const AGENT_CAPABILITY_AUTHORITY_SCHEMA_VERSION = 'forge.agent-capability-authority.v1' as const;
export const AGENT_CAPABILITY_AUTHORITY_API_VERSION = '2026-08-01.agent-effective.v1' as const;
export const AGENT_CAPABILITY_DISCOVERY_ROUTE_KEY = 'GET /api/agent/capabilities/effective' as const;
export const AGENT_CAPABILITY_DISCOVERY_DISPOSITION = 'agent-authority-discovery' as const;

export interface AgentCapabilityConstraint {
  /** Exact immutable id@version identities. Public capabilities remain public. */
  capabilityIdentities: string[];
  /** Every effect declared by a selected protected capability must be present. */
  allowedEffects: ForgeCapabilityEffect[];
}

export type AgentCapabilityDecisionCode =
  | 'ALLOWED'
  | 'CAPABILITY_ROUTE_UNREVIEWED'
  | 'CAPABILITY_OWNER_MISMATCH'
  | 'CAPABILITY_SCOPE_DENIED'
  | 'CAPABILITY_WORKSPACE_REQUIRED'
  | 'CAPABILITY_NOT_GRANTED'
  | 'CAPABILITY_EFFECT_DENIED'
  | 'UNCONTRACTED_ROUTE_DENIED';

export interface AgentCapabilityDecision {
  allowed: boolean;
  code: AgentCapabilityDecisionCode;
  capabilityIdentity?: string;
  disallowedEffects?: ForgeCapabilityEffect[];
}

export interface EffectiveCapabilityActor {
  kind: 'agent' | 'studio';
  scope?: AgentKeyScope;
  workspaceId?: string;
  constraint?: AgentCapabilityConstraint;
}

export interface EffectiveCapabilityExclusion {
  capabilityIdentity: string;
  code: Exclude<AgentCapabilityDecisionCode, 'ALLOWED' | 'UNCONTRACTED_ROUTE_DENIED'>;
  disallowedEffects?: ForgeCapabilityEffect[];
}

export type ResolveAgentRouteTemplate = (method: string, template: string) => AgentAuthorityResolution;

const EFFECT_ORDER = new Map(FORGE_CAPABILITY_EFFECTS.map((effect, index) => [effect, index]));
const EFFECT_SET = new Set<ForgeCapabilityEffect>(FORGE_CAPABILITY_EFFECTS);

export function forgeCapabilityIdentity(capability: Pick<ForgeCapabilityDescriptorV1, 'id' | 'version'>): string {
  return `${capability.id}@${capability.version}`;
}

function duplicateStrings(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates].sort();
}

export function normalizeAgentCapabilityConstraint(
  capabilityIdentities: unknown,
  allowedEffects: unknown,
  scope: AgentKeyScope,
  capabilities: readonly ForgeCapabilityDescriptorV1[] = FORGE_CAPABILITIES,
): { ok: true; constraint?: AgentCapabilityConstraint } | { ok: false; errors: string[] } {
  if (capabilityIdentities === undefined && allowedEffects === undefined) return { ok: true };
  const errors: string[] = [];
  if (!Array.isArray(capabilityIdentities) || !capabilityIdentities.every(value => typeof value === 'string')) {
    errors.push('capabilityIdentities must be an array of exact capability.id@version strings.');
  }
  if (!Array.isArray(allowedEffects) || !allowedEffects.every(value => typeof value === 'string')) {
    errors.push('allowedEffects must be an array of known Forge capability effects.');
  }
  if (errors.length) return { ok: false, errors };

  const identities = capabilityIdentities as string[];
  const effects = allowedEffects as string[];
  const duplicateIdentities = duplicateStrings(identities);
  const duplicateEffects = duplicateStrings(effects);
  if (duplicateIdentities.length) errors.push(`duplicate capability identities: ${duplicateIdentities.join(', ')}`);
  if (duplicateEffects.length) errors.push(`duplicate allowed effects: ${duplicateEffects.join(', ')}`);

  const byIdentity = new Map(capabilities.map(capability => [forgeCapabilityIdentity(capability), capability]));
  for (const identity of identities) {
    const capability = byIdentity.get(identity);
    if (!capability) errors.push(`unknown capability identity: ${identity}`);
    else if (capability.access.public) errors.push(`public capability does not belong in a key restriction: ${identity}`);
    else if (!capability.access.agentScopes.includes(scope)) {
      errors.push(`${identity} is outside the ${scope} preset.`);
    }
  }
  for (const effect of effects) {
    if (!EFFECT_SET.has(effect as ForgeCapabilityEffect)) errors.push(`unknown capability effect: ${effect}`);
  }
  const selectedEffectSet = new Set(identities.flatMap(identity => byIdentity.get(identity)?.effects || []));
  const surplusEffects = effects.filter(effect => EFFECT_SET.has(effect as ForgeCapabilityEffect) && !selectedEffectSet.has(effect as ForgeCapabilityEffect));
  if (surplusEffects.length) errors.push(`allowed effects unused by the selected capabilities: ${surplusEffects.sort().join(', ')}`);
  if (errors.length) return { ok: false, errors };

  return {
    ok: true,
    constraint: {
      capabilityIdentities: [...identities].sort(),
      allowedEffects: [...effects as ForgeCapabilityEffect[]]
        .sort((left, right) => (EFFECT_ORDER.get(left) ?? 999) - (EFFECT_ORDER.get(right) ?? 999)),
    },
  };
}

function primaryRouteDecision(
  capability: ForgeCapabilityDescriptorV1,
  resolveTemplate: ResolveAgentRouteTemplate,
): AgentAuthorityResolution {
  const primary = capability.apiBindings.find(binding => binding.role === 'primary');
  return primary
    ? resolveTemplate(primary.method, primary.path)
    : { ok: false, reason: 'unreviewed_route' };
}

export function decideEffectiveCapability(
  capability: ForgeCapabilityDescriptorV1,
  actor: EffectiveCapabilityActor,
  resolveTemplate: ResolveAgentRouteTemplate,
): AgentCapabilityDecision {
  const identity = forgeCapabilityIdentity(capability);
  if (actor.kind === 'studio') return { allowed: true, code: 'ALLOWED', capabilityIdentity: identity };
  const route = primaryRouteDecision(capability, resolveTemplate);
  if (!route.ok) return { allowed: false, code: 'CAPABILITY_ROUTE_UNREVIEWED', capabilityIdentity: identity };
  if (route.decision.disposition !== 'canonical-capability' || route.decision.owner !== capability.id) {
    return { allowed: false, code: 'CAPABILITY_OWNER_MISMATCH', capabilityIdentity: identity };
  }
  if (!actor.scope || !route.decision.agentScopes.includes(actor.scope)) {
    return { allowed: false, code: 'CAPABILITY_SCOPE_DENIED', capabilityIdentity: identity };
  }
  if ((route.decision.workspaceMode === 'required' || capability.context.workspace === 'required') && !actor.workspaceId) {
    return { allowed: false, code: 'CAPABILITY_WORKSPACE_REQUIRED', capabilityIdentity: identity };
  }
  // The key cannot make a public route private. Report public capabilities honestly.
  if (capability.access.public) return { allowed: true, code: 'ALLOWED', capabilityIdentity: identity };
  if (!actor.constraint) return { allowed: true, code: 'ALLOWED', capabilityIdentity: identity };
  if (!actor.constraint.capabilityIdentities.includes(identity)) {
    return { allowed: false, code: 'CAPABILITY_NOT_GRANTED', capabilityIdentity: identity };
  }
  const allowedEffects = new Set(actor.constraint.allowedEffects);
  const disallowedEffects = capability.effects.filter(effect => !allowedEffects.has(effect));
  if (disallowedEffects.length) {
    return { allowed: false, code: 'CAPABILITY_EFFECT_DENIED', capabilityIdentity: identity, disallowedEffects };
  }
  return { allowed: true, code: 'ALLOWED', capabilityIdentity: identity };
}

export function buildEffectiveCapabilitySelection(
  actor: EffectiveCapabilityActor,
  resolveTemplate: ResolveAgentRouteTemplate,
  capabilities: readonly ForgeCapabilityDescriptorV1[] = FORGE_CAPABILITIES,
): { capabilities: ForgeCapabilityDescriptorV1[]; exclusions: EffectiveCapabilityExclusion[] } {
  const selected: ForgeCapabilityDescriptorV1[] = [];
  const exclusions: EffectiveCapabilityExclusion[] = [];
  for (const capability of capabilities) {
    const decision = decideEffectiveCapability(capability, actor, resolveTemplate);
    if (decision.allowed) selected.push(capability);
    else exclusions.push({
      capabilityIdentity: decision.capabilityIdentity || forgeCapabilityIdentity(capability),
      code: decision.code as EffectiveCapabilityExclusion['code'],
      ...(decision.disallowedEffects?.length ? { disallowedEffects: decision.disallowedEffects } : {}),
    });
  }
  return { capabilities: selected, exclusions };
}

/** The one protected route that a contract-only key must reach to inspect itself. */
export function isAgentCapabilityDiscoveryRoute(decision: AgentRouteAuthorityDecision): boolean {
  return decision.routeKey === AGENT_CAPABILITY_DISCOVERY_ROUTE_KEY &&
    decision.disposition === AGENT_CAPABILITY_DISCOVERY_DISPOSITION;
}

/** Apply custom key narrowing after the exact preset decision and before handler execution. */
export function decideConstrainedAgentRoute(
  decision: AgentRouteAuthorityDecision,
  constraint: AgentCapabilityConstraint | undefined,
  capabilities: readonly ForgeCapabilityDescriptorV1[] = FORGE_CAPABILITIES,
): AgentCapabilityDecision {
  if (!constraint || isAgentCapabilityDiscoveryRoute(decision)) return { allowed: true, code: 'ALLOWED' };
  if (decision.disposition !== 'canonical-capability') {
    return { allowed: false, code: 'UNCONTRACTED_ROUTE_DENIED' };
  }
  const capability = capabilities.find(candidate => candidate.id === decision.owner);
  if (!capability) return { allowed: false, code: 'CAPABILITY_OWNER_MISMATCH' };
  const identity = forgeCapabilityIdentity(capability);
  if (!constraint.capabilityIdentities.includes(identity)) {
    return { allowed: false, code: 'CAPABILITY_NOT_GRANTED', capabilityIdentity: identity };
  }
  const allowedEffects = new Set(constraint.allowedEffects);
  const disallowedEffects = capability.effects.filter(effect => !allowedEffects.has(effect));
  if (disallowedEffects.length) {
    return { allowed: false, code: 'CAPABILITY_EFFECT_DENIED', capabilityIdentity: identity, disallowedEffects };
  }
  return { allowed: true, code: 'ALLOWED', capabilityIdentity: identity };
}
