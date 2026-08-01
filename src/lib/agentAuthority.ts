/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * B117 — closed-world Agent API route authority.
 *
 * The reviewed route manifest is the only grant source. This module deliberately knows
 * nothing about Express handlers or key persistence: it validates/compiles exact route
 * templates and returns a secret-free decision for the auth/workspace middleware.
 */

import crypto from 'crypto';

export type AgentKeyScope = 'read' | 'write' | 'deploy';
export const AGENT_KEY_SCOPES = ['read', 'write', 'deploy'] as const satisfies readonly AgentKeyScope[];

export type AgentAuthorityResourceClass =
  | 'public'
  | 'workspace'
  | 'inline-or-addressed'
  | 'configured-root'
  | 'global-session'
  | 'cross-workspace-session'
  | 'provider-network'
  | 'host-file-read'
  | 'external-repository'
  | 'command-session'
  | 'stateless-analysis';

export type WorkspaceAuthorityMode = 'none' | 'optional' | 'required' | 'input-first';

export interface AgentRouteAuthorityEntry {
  disposition: string;
  owner: string;
  registrations: number;
  agentScopes: AgentKeyScope[];
  resourceClass: AgentAuthorityResourceClass;
  workspaceMode: WorkspaceAuthorityMode;
}

export interface AgentRouteAuthorityManifest {
  schemaVersion: 'forge.route-dispositions.v4';
  sources: string[];
  routes: Record<string, AgentRouteAuthorityEntry>;
  dynamicRoutes: Record<string, AgentRouteAuthorityEntry>;
  capabilitySignatures: Record<string, string>;
  mcpModuleSignature: { version: number; hash: string };
  mcpSignatures: Record<string, string>;
  mcpCapabilityIdentities: Record<string, string>;
}

export interface AgentRouteAuthorityDecision {
  policyVersion: AgentRouteAuthorityManifest['schemaVersion'];
  policyHash: string;
  routeKey: string;
  method: string;
  template: string;
  disposition: string;
  owner: string;
  agentScopes: AgentKeyScope[];
  resourceClass: AgentAuthorityResourceClass;
  workspaceMode: WorkspaceAuthorityMode;
}

export type AgentAuthorityResolution =
  | { ok: true; decision: AgentRouteAuthorityDecision }
  | { ok: false; reason: 'unreviewed_route' | 'malformed_path' };

interface CompiledRoute {
  method: string;
  template: string;
  segments: string[];
  params: boolean[];
  entry: AgentRouteAuthorityEntry;
}

export interface AgentRouteAuthority {
  policyVersion: AgentRouteAuthorityManifest['schemaVersion'];
  policyHash: string;
  resolve(method: string, requestPath: string): AgentAuthorityResolution;
  allows(scope: AgentKeyScope, method: string, requestPath: string): boolean;
}

const RESOURCE_CLASSES = new Set<AgentAuthorityResourceClass>([
  'public',
  'workspace',
  'inline-or-addressed',
  'configured-root',
  'global-session',
  'cross-workspace-session',
  'provider-network',
  'host-file-read',
  'external-repository',
  'command-session',
  'stateless-analysis',
]);

const WORKSPACE_MODES = new Set<WorkspaceAuthorityMode>(['none', 'optional', 'required', 'input-first']);
const METHOD_RE = /^[A-Z]+$/;
const PARAM_RE = /^:[A-Za-z_][A-Za-z0-9_]*$/;
const LITERAL_SEGMENT_RE = /^[A-Za-z0-9._~-]+$/;
const ENCODED_SEPARATOR_RE = /%(?:2f|5c)/i;
const ALLOWED_SCOPE_CHAINS = new Set(['', 'deploy', 'write,deploy', 'read,write,deploy']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function templateParts(template: string): { segments: string[]; params: boolean[] } | null {
  if (!template.startsWith('/api/') || template.includes('?') || template.includes('#') ||
    template.includes('\\') || ENCODED_SEPARATOR_RE.test(template) || template.endsWith('/')) return null;
  const segments = template.split('/').slice(1);
  const params = segments.map(segment => PARAM_RE.test(segment));
  if (segments.some((segment, index) => !params[index] && !LITERAL_SEGMENT_RE.test(segment))) return null;
  return { segments, params };
}

function templatesOverlap(left: CompiledRoute, right: CompiledRoute): boolean {
  if (left.method !== right.method || left.segments.length !== right.segments.length) return false;
  return left.segments.every((segment, index) => left.params[index] || right.params[index] || segment === right.segments[index]);
}

function requestSegments(requestPath: string): string[] | null {
  if (!requestPath.startsWith('/api/') || requestPath.includes('?') || requestPath.includes('#') ||
    requestPath.includes('\\') || requestPath.includes('\0') || requestPath.includes('%') || ENCODED_SEPARATOR_RE.test(requestPath) ||
    requestPath.endsWith('/')) return null;
  const segments = requestPath.split('/').slice(1);
  if (segments.some(segment => !segment || segment === '.' || segment === '..' || !LITERAL_SEGMENT_RE.test(segment))) return null;
  return segments;
}

function entryErrors(raw: unknown, label: string): string[] {
  if (!isRecord(raw)) return [`${label} must be an object`];
  const errors: string[] = [];
  const expected = ['disposition', 'owner', 'registrations', 'agentScopes', 'resourceClass', 'workspaceMode'];
  for (const field of expected) if (!Object.hasOwn(raw, field)) errors.push(`${label} is missing ${field}`);
  for (const field of Object.keys(raw)) if (!expected.includes(field)) errors.push(`${label} has unsupported field ${field}`);
  if (typeof raw.disposition !== 'string' || !raw.disposition.trim()) errors.push(`${label}.disposition is invalid`);
  if (typeof raw.owner !== 'string' || !raw.owner.trim()) errors.push(`${label}.owner is invalid`);
  if (!Number.isInteger(raw.registrations) || Number(raw.registrations) < 1) errors.push(`${label}.registrations is invalid`);
  if (!Array.isArray(raw.agentScopes) || !ALLOWED_SCOPE_CHAINS.has(raw.agentScopes.join(','))) {
    errors.push(`${label}.agentScopes must be one of [], [deploy], [write, deploy], or [read, write, deploy]`);
  }
  if (typeof raw.resourceClass !== 'string' || !RESOURCE_CLASSES.has(raw.resourceClass as AgentAuthorityResourceClass)) {
    errors.push(`${label}.resourceClass is invalid`);
  }
  if (typeof raw.workspaceMode !== 'string' || !WORKSPACE_MODES.has(raw.workspaceMode as WorkspaceAuthorityMode)) {
    errors.push(`${label}.workspaceMode is invalid`);
  }
  return errors;
}

export function agentRouteAuthorityManifestErrors(value: unknown): string[] {
  if (!isRecord(value)) return ['authority manifest must be an object'];
  const errors: string[] = [];
  if (value.schemaVersion !== 'forge.route-dispositions.v4') {
    errors.push(`authority manifest schema must be forge.route-dispositions.v4, got ${String(value.schemaVersion)}`);
  }
  if (!isRecord(value.routes)) errors.push('authority manifest routes must be an object');
  if (!isRecord(value.dynamicRoutes)) errors.push('authority manifest dynamicRoutes must be an object');
  if (isRecord(value.routes)) {
    for (const [key, entry] of Object.entries(value.routes)) {
      errors.push(...entryErrors(entry, `routes.${key}`));
      const match = key.match(/^([A-Z]+) (\/\S*|\*)$/);
      if (!match || !METHOD_RE.test(match[1])) errors.push(`routes.${key} has a malformed route key`);
      else if (match[2].startsWith('/api/') && !templateParts(match[2])) errors.push(`routes.${key} has an unsupported API template`);
    }
  }
  if (isRecord(value.dynamicRoutes)) {
    for (const [key, entry] of Object.entries(value.dynamicRoutes)) errors.push(...entryErrors(entry, `dynamicRoutes.${key}`));
  }
  return errors;
}

export function createAgentRouteAuthority(value: unknown): AgentRouteAuthority {
  const errors = agentRouteAuthorityManifestErrors(value);
  if (errors.length) throw new Error(`Invalid agent route authority manifest: ${errors.join(' | ')}`);
  const manifest = value as unknown as AgentRouteAuthorityManifest;
  const compiled: CompiledRoute[] = [];
  for (const [key, entry] of Object.entries(manifest.routes)) {
    const match = key.match(/^([A-Z]+) (\/\S*|\*)$/)!;
    const method = match[1];
    const template = match[2];
    if (!template.startsWith('/api/')) continue;
    const parts = templateParts(template)!;
    compiled.push({ method, template, ...parts, entry });
  }
  for (let left = 0; left < compiled.length; left += 1) {
    for (let right = left + 1; right < compiled.length; right += 1) {
      if (templatesOverlap(compiled[left], compiled[right])) {
        throw new Error(`Invalid agent route authority manifest: overlapping templates ${compiled[left].method} ${compiled[left].template} and ${compiled[right].method} ${compiled[right].template}`);
      }
    }
  }
  const policyHash = crypto.createHash('sha256').update(canonicalJson(manifest), 'utf8').digest('hex');
  return {
    policyVersion: manifest.schemaVersion,
    policyHash,
    resolve(method, requestPath) {
      const normalizedMethod = String(method || '').toUpperCase();
      if (!METHOD_RE.test(normalizedMethod)) return { ok: false, reason: 'malformed_path' };
      const segments = requestSegments(requestPath);
      if (!segments) return { ok: false, reason: 'malformed_path' };
      const route = compiled.find(candidate => candidate.method === normalizedMethod &&
        candidate.segments.length === segments.length &&
        candidate.segments.every((segment, index) => candidate.params[index] ? true : segment === segments[index]));
      if (!route) return { ok: false, reason: 'unreviewed_route' };
      return {
        ok: true,
        decision: {
          policyVersion: manifest.schemaVersion,
          policyHash,
          routeKey: `${route.method} ${route.template}`,
          method: route.method,
          template: route.template,
          disposition: route.entry.disposition,
          owner: route.entry.owner,
          agentScopes: [...route.entry.agentScopes],
          resourceClass: route.entry.resourceClass,
          workspaceMode: route.entry.workspaceMode,
        },
      };
    },
    allows(scope, method, requestPath) {
      const resolved = this.resolve(method, requestPath);
      return resolved.ok && resolved.decision.agentScopes.includes(scope);
    },
  };
}

function fixtureManifest(routes: Record<string, AgentRouteAuthorityEntry>): AgentRouteAuthorityManifest {
  return {
    schemaVersion: 'forge.route-dispositions.v4',
    sources: ['fixture.ts'],
    routes,
    dynamicRoutes: {},
    capabilitySignatures: { 'fixture.read@1': 'a'.repeat(64) },
    mcpModuleSignature: { version: 1, hash: 'b'.repeat(64) },
    mcpSignatures: { fixture: 'c'.repeat(64) },
    mcpCapabilityIdentities: { fixture: 'fixture.read@1' },
  };
}

function fixtureEntry(agentScopes: AgentKeyScope[]): AgentRouteAuthorityEntry {
  return {
    disposition: 'legacy-agent-api',
    owner: 'fixture',
    registrations: 1,
    agentScopes,
    resourceClass: 'workspace',
    workspaceMode: 'required',
  };
}

export function runAgentRouteAuthoritySelftest(): {
  pass: boolean;
  checks: Array<{ name: string; pass: boolean; detail?: string }>;
} {
  const checks: Array<{ name: string; pass: boolean; detail?: string }> = [];
  const ok = (name: string, pass: boolean, detail?: string) => checks.push({ name, pass, detail });
  const authority = createAgentRouteAuthority(fixtureManifest({
    'GET /api/agent/workspace': fixtureEntry(['read', 'write', 'deploy']),
    'POST /api/agent/workspace': fixtureEntry(['write', 'deploy']),
    'GET /api/agent/history/:id/raw': fixtureEntry(['deploy']),
    'GET *': { ...fixtureEntry([]), resourceClass: 'global-session', workspaceMode: 'none' },
  }));

  ok('exact_literal_scope_matrix',
    authority.allows('read', 'GET', '/api/agent/workspace') &&
    !authority.allows('read', 'POST', '/api/agent/workspace') &&
    authority.allows('write', 'POST', '/api/agent/workspace'));
  ok('parameter_matches_one_safe_segment',
    authority.allows('deploy', 'GET', '/api/agent/history/row_1/raw') &&
    !authority.allows('deploy', 'GET', '/api/agent/history/row_1/extra/raw') &&
    !authority.allows('deploy', 'GET', '/api/agent/history/../raw'));
  ok('unknown_method_and_prefix_child_fail_closed',
    !authority.allows('deploy', 'DELETE', '/api/agent/workspace') &&
    !authority.allows('deploy', 'GET', '/api/agent/Workspace') &&
    !authority.allows('deploy', 'GET', '/api/agent/workspaces') &&
    !authority.allows('deploy', 'GET', '/api/agent/workspace/future'));
  ok('malformed_and_encoded_paths_fail_closed',
    !authority.allows('deploy', 'GET', '/api/agent/history/a%2Fb/raw') &&
    !authority.allows('deploy', 'GET', '/api/agent/history/a%5Cb/raw') &&
    !authority.allows('deploy', 'GET', '/api/agent/history/%2e/raw') &&
    !authority.allows('deploy', 'GET', '/api/agent/history/%2e%2e/raw') &&
    !authority.allows('deploy', 'GET', '/api/agent/history/%00/raw') &&
    !authority.allows('deploy', 'GET', '/api/agent/history/bad%/raw') &&
    !authority.allows('deploy', 'GET', '/api/agent/workspace?x=1') &&
    !authority.allows('deploy', 'GET', '/api/agent/workspace/'));
  ok('ui_wildcard_never_grants_api_authority',
    !authority.allows('deploy', 'GET', '/api/agent/unreviewed'));

  let overlapRejected = false;
  try {
    createAgentRouteAuthority(fixtureManifest({
      'GET /api/agent/history/:id/raw': fixtureEntry(['read']),
      'GET /api/agent/history/fixed/raw': fixtureEntry(['read']),
    }));
  } catch { overlapRejected = true; }
  ok('overlapping_templates_rejected', overlapRejected);

  const malformed = fixtureManifest({ 'GET /api/agent/workspace': fixtureEntry(['deploy', 'read']) });
  const nonHierarchical = fixtureManifest({ 'GET /api/agent/workspace': fixtureEntry(['read', 'deploy']) });
  ok('unordered_and_non_hierarchical_scope_arrays_rejected',
    agentRouteAuthorityManifestErrors(malformed).some(error => error.includes('must be one of')) &&
    agentRouteAuthorityManifestErrors(nonHierarchical).some(error => error.includes('must be one of')));

  const reordered = fixtureManifest({
    'POST /api/agent/workspace': fixtureEntry(['write', 'deploy']),
    'GET /api/agent/workspace': fixtureEntry(['read', 'write', 'deploy']),
    'GET /api/agent/history/:id/raw': fixtureEntry(['deploy']),
    'GET *': { ...fixtureEntry([]), resourceClass: 'global-session', workspaceMode: 'none' },
  });
  ok('policy_hash_is_key_order_independent', authority.policyHash === createAgentRouteAuthority(reordered).policyHash);

  return { pass: checks.every(check => check.pass), checks };
}
