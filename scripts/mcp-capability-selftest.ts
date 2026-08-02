#!/usr/bin/env node
/** Deterministic MCP discovery, narrowing, fail-closed, and recovery checks for B115/W1. */

import assert from 'assert/strict';
import crypto from 'crypto';
import http from 'http';
import path from 'path';
import { spawn, type ChildProcessWithoutNullStreams } from 'child_process';
import {
  FORGE_CAPABILITIES,
  buildForgeCapabilityContract,
  type ForgeCapabilityDescriptorV1,
} from '../src/lib/forgeCapabilities';

const EXPECTED_TOOLS = [
  'validate_mod',
  'list_schema_domains',
  'get_workspace',
  'compile_workspace',
  'author_check',
  'stage_and_validate',
  'readiness',
  'check_conflicts',
  'check_patch_readiness',
  'explain_element',
];
const READ_TOOLS = ['list_schema_domains', 'get_workspace', 'readiness', 'check_conflicts', 'explain_element'];
const WRITE_TOOLS = [
  'validate_mod', 'list_schema_domains', 'get_workspace', 'compile_workspace', 'author_check',
  'stage_and_validate', 'readiness', 'check_conflicts', 'explain_element',
];
const CUSTOM_TOOLS = ['validate_mod', 'list_schema_domains', 'author_check', 'stage_and_validate', 'explain_element'];
const MCP_KEY = `x4fk_${'a'.repeat(64)}`;
const MCP_WORKSPACE_ID = 'ws_111111111111111111111111';
const EFFECTIVE_API_VERSION = '2026-08-01.agent-effective.v1';
const EFFECTIVE_SCHEMA_VERSION = 'forge.agent-capability-authority.v1';
const ROUTE_POLICY_VERSION = 'forge.route-dispositions.v4';

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.keys(value as Record<string, unknown>).sort().map(key =>
      `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value);
}

async function listen(server: http.Server): Promise<number> {
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('MCP selftest server did not bind a TCP port.');
  return address.port;
}

async function stop(server: http.Server): Promise<void> {
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}

interface JsonRpcMessage {
  id?: number;
  method?: string;
  result?: { tools?: any[]; content?: Array<{ type?: string; text?: string }> };
  error?: { code?: number; message?: string };
}

interface McpClient {
  child: ChildProcessWithoutNullStreams;
  initializeResult: JsonRpcMessage;
  request(method: string, params?: unknown, timeoutMs?: number): Promise<JsonRpcMessage>;
  waitForNotification(method: string, timeoutMs?: number): Promise<void>;
  close(): Promise<void>;
}

async function startMcp(baseUrl: string, auth: { key?: string; workspaceId?: string } = {}): Promise<McpClient> {
  const child = spawn(process.execPath, [path.join(process.cwd(), 'vscode-extension', 'mcp', 'x4forge-mcp.cjs')], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      X4FORGE_URL: baseUrl,
      X4FORGE_KEY: auth.key ?? MCP_KEY,
      X4FORGE_WORKSPACE_ID: auth.workspaceId ?? MCP_WORKSPACE_ID,
      X4FORGE_CAPABILITY_RETRY_MS: '100',
    },
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  });
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  let buffer = '';
  let stderr = '';
  const notifications: string[] = [];
  let nextId = 1;
  const pending = new Map<number, { resolve: (message: JsonRpcMessage) => void; reject: (error: Error) => void; timer: NodeJS.Timeout }>();

  child.stderr.on('data', value => { stderr += value; });
  child.stdout.on('data', value => {
    buffer += value;
    while (buffer.includes('\n')) {
      const newline = buffer.indexOf('\n');
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (!line) continue;
      let message: JsonRpcMessage;
      try { message = JSON.parse(line) as JsonRpcMessage; } catch { continue; }
      if (typeof message.method === 'string' && message.id === undefined) {
        notifications.push(message.method);
        continue;
      }
      if (typeof message.id !== 'number') continue;
      const waiter = pending.get(message.id);
      if (!waiter) continue;
      pending.delete(message.id);
      clearTimeout(waiter.timer);
      waiter.resolve(message);
    }
  });
  child.once('exit', code => {
    for (const [id, waiter] of pending) {
      clearTimeout(waiter.timer);
      waiter.reject(new Error(`MCP exited ${code ?? 'unknown'} while waiting for request ${id}. stderr=${stderr}`));
    }
    pending.clear();
  });

  const client = {
    child,
    initializeResult: {} as JsonRpcMessage,
    request(method, params = {}, timeoutMs = 6_000) {
      const id = nextId++;
      return new Promise<JsonRpcMessage>((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`MCP ${method} timed out. stderr=${stderr}`));
        }, timeoutMs);
        pending.set(id, { resolve, reject, timer });
        child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
      });
    },
    async waitForNotification(method: string, timeoutMs = 3_000) {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        const index = notifications.indexOf(method);
        if (index >= 0) {
          notifications.splice(index, 1);
          return;
        }
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      throw new Error(`MCP notification ${method} timed out. received=${notifications.join(',')} stderr=${stderr}`);
    },
    async close() {
      if (child.exitCode !== null) return;
      child.stdin.end();
      await new Promise<void>(resolve => {
        const timer = setTimeout(() => { child.kill(); resolve(); }, 2_000);
        child.once('exit', () => { clearTimeout(timer); resolve(); });
      });
    },
  } satisfies McpClient;
  const initialized = await client.request('initialize');
  assert.ok(initialized.result, 'MCP initialize failed');
  client.initializeResult = initialized;
  assert.equal((initialized.result as any)?.capabilities?.tools?.listChanged, true,
    'dynamic MCP inventory must advertise tools.listChanged');
  child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`);
  return client;
}

async function toolsFor(client: McpClient): Promise<any[]> {
  const message = await client.request('tools/list');
  assert.equal(message.error, undefined, message.error?.message);
  assert.ok(Array.isArray(message.result?.tools), 'MCP tools/list omitted tools');
  const tools = message.result!.tools!;
  for (const tool of tools) {
    assert.equal(typeof tool?.description, 'string', `MCP tool ${String(tool?.name || '<unnamed>')} omitted description`);
    assert.ok(tool?.inputSchema && typeof tool.inputSchema === 'object' && !Array.isArray(tool.inputSchema),
      `MCP tool ${String(tool?.name || '<unnamed>')} omitted object inputSchema`);
    assert.equal(tool.inputSchema.type, 'object',
      `MCP tool ${String(tool?.name || '<unnamed>')} must advertise an object root input schema`);
    assert.equal(tool.inputSchema.additionalProperties, false,
      `MCP tool ${String(tool?.name || '<unnamed>')} must advertise a closed root input schema`);
  }
  const authorCheck = tools.find(tool => tool.name === 'author_check');
  if (authorCheck) {
    assert.equal(authorCheck.inputSchema?.properties?.files?.items?.additionalProperties, false,
      'author_check draft-file items must reject undeclared fields');
    assert.equal(authorCheck.inputSchema?.properties?.files?.items?.type, 'object',
      'author_check draft-file items must advertise object validation');
  }
  return tools;
}

async function withMcp<T>(
  baseUrl: string,
  run: (client: McpClient) => Promise<T>,
  auth?: { key?: string; workspaceId?: string },
): Promise<T> {
  const client = await startMcp(baseUrl, auth);
  try { return await run(client); } finally { await client.close(); }
}

type Mode = 'live' | 'read' | 'write' | 'legacy' | 'malformed' | 'current-missing' | 'unknown-envelope' | 'primitive' |
  'wrong-hash' | 'unauthorized' | 'forbidden' | 'incomplete' | 'duplicate-id' | 'binding-collision' |
  'fixed-body-type' | 'mcp-alias-collision' | 'extra-field' | 'api-path' | 'api-dot-path' | 'open-input' | 'hung' | 'outage' |
  'narrowed' | 'alias-narrowed' | 'v2' | 'wrong-workspace' | 'authority-wrong-hash' | 'effective-malformed' |
  'effective-missing' | 'effective-expanded';
let mode: Mode = 'live';
let endpointMode: 'normal' | 'invalid-json' | 'empty-json' | 'missing-fields' | 'missing-workspace-snapshot' = 'normal';
const contract = buildForgeCapabilityContract(sha256);
const wrongHashContract = {
  ...contract,
  contractHash: `${contract.contractHash[0] === '0' ? '1' : '0'}${contract.contractHash.slice(1)}`,
};
const validationV1 = FORGE_CAPABILITIES.find(capability => capability.id === 'project.validate')!;
const aliasNarrowedValidationV1 = {
  ...validationV1,
  surfaces: {
    ...validationV1.surfaces,
    mcp: validationV1.surfaces.mcp.filter(projection => projection.id === 'validate_mod'),
  },
} as ForgeCapabilityDescriptorV1;
const validationV2 = { ...validationV1, version: 2 } as unknown as ForgeCapabilityDescriptorV1;
const duplicateIdV2 = {
  ...validationV1,
  version: 2,
  apiBindings: validationV1.apiBindings.map(binding => ({ ...binding, path: `${binding.path}/v2` })),
  surfaces: { ...validationV1.surfaces, mcp: [] },
} as ForgeCapabilityDescriptorV1;
const duplicateIdContract = buildForgeCapabilityContract(sha256, [validationV1, duplicateIdV2]);
const bindingCollisionCapability = {
  ...validationV1,
  id: 'project.validationcollision',
  surfaces: { ...validationV1.surfaces, mcp: [] },
} as ForgeCapabilityDescriptorV1;
const bindingCollisionContract = buildForgeCapabilityContract(sha256, [validationV1, bindingCollisionCapability]);
const fixedBodyTypeCapability = {
  ...validationV1,
  inputSchema: {
    ...validationV1.inputSchema,
    properties: {
      ...validationV1.inputSchema.properties,
      recordBaseline: { type: 'string' },
    },
  },
} as ForgeCapabilityDescriptorV1;
const fixedBodyTypeContract = buildForgeCapabilityContract(sha256, [fixedBodyTypeCapability]);
const mcpAliasCollisionCapability = {
  ...validationV1,
  id: 'project.validatealiascollision',
  apiBindings: validationV1.apiBindings.map(binding => ({ ...binding, path: `${binding.path}/alias-collision` })),
} as ForgeCapabilityDescriptorV1;
const mcpAliasCollisionContract = buildForgeCapabilityContract(sha256, [validationV1, mcpAliasCollisionCapability]);
const effectiveOrphanCapability = {
  ...validationV1,
  id: 'project.validationorphan',
  apiBindings: validationV1.apiBindings.map(binding => ({ ...binding, path: `${binding.path}/effective-orphan` })),
  surfaces: { ...validationV1.surfaces, mcp: [] },
} as ForgeCapabilityDescriptorV1;
const extraFieldContract = { ...contract, generatedAt: '2030-01-01T00:00:00.000Z' };
const invalidPathCapability = {
  ...validationV1,
  apiBindings: validationV1.apiBindings.map(binding => ({ ...binding, path: `${binding.path}?decoy=1` })),
} as ForgeCapabilityDescriptorV1;
const invalidPathContract = buildForgeCapabilityContract(sha256, [invalidPathCapability]);
const traversalPathCapability = {
  ...validationV1,
  apiBindings: validationV1.apiBindings.map(binding => ({ ...binding, path: `${binding.path}/../hidden` })),
} as ForgeCapabilityDescriptorV1;
const traversalPathContract = buildForgeCapabilityContract(sha256, [traversalPathCapability]);
const workspaceRead = FORGE_CAPABILITIES.find(capability => capability.id === 'workspace.read')!;
const openInputCapability = {
  ...workspaceRead,
  inputSchema: { type: 'object', properties: {}, additionalProperties: true },
} as ForgeCapabilityDescriptorV1;
const openInputContract = buildForgeCapabilityContract(sha256, [openInputCapability]);
const incompleteContract = buildForgeCapabilityContract(sha256, [{
  id: 'project.validate',
  version: 1,
  effects: ['read'],
  apiBindings: [],
  surfaces: {},
} as unknown as ForgeCapabilityDescriptorV1]);
type Constraint = { capabilityIdentities: string[]; allowedEffects: string[] };
const customConstraint: Constraint = {
  capabilityIdentities: ['project.validate@1'],
  allowedEffects: ['read', 'analyze', 'audit-write', 'audit-retention-delete'],
};

function effectiveAuthority(
  scope: 'read' | 'write' | 'deploy',
  constraint: Constraint | null = null,
  effectiveCapabilities?: ForgeCapabilityDescriptorV1[],
): Record<string, unknown> {
  const allowedEffects = new Set(constraint?.allowedEffects || []);
  const selected = new Set(constraint?.capabilityIdentities || []);
  const capabilities = effectiveCapabilities || FORGE_CAPABILITIES.filter(capability => {
    if (!capability.access.agentScopes.some(candidate => candidate === scope)) return false;
    if (capability.access.public || constraint === null) return true;
    return selected.has(`${capability.id}@${capability.version}`) && capability.effects.every(effect => allowedEffects.has(effect));
  });
  const effectiveIdentities = new Set(capabilities.map(capability => `${capability.id}@${capability.version}`));
  const exclusions = FORGE_CAPABILITIES.flatMap(capability => {
    const identity = `${capability.id}@${capability.version}`;
    if (effectiveIdentities.has(identity)) return [];
    if (!capability.access.agentScopes.some(candidate => candidate === scope)) return [{ capabilityIdentity: identity, code: 'CAPABILITY_SCOPE_DENIED' }];
    if (constraint !== null && !selected.has(identity)) return [{ capabilityIdentity: identity, code: 'CAPABILITY_NOT_GRANTED' }];
    const disallowedEffects = capability.effects.filter(effect => !allowedEffects.has(effect));
    return [{ capabilityIdentity: identity, code: 'CAPABILITY_EFFECT_DENIED', disallowedEffects }];
  });
  const unsigned = {
    api_version: EFFECTIVE_API_VERSION,
    authority_schema_version: EFFECTIVE_SCHEMA_VERSION,
    actor: {
      kind: 'agent', label: `${scope} fixture`, keyId: `key_${scope}_fixture`, scope,
      workspaceId: mode === 'wrong-workspace' ? 'ws_222222222222222222222222' : MCP_WORKSPACE_ID,
    },
    route_policy: { version: ROUTE_POLICY_VERSION, hash: 'b'.repeat(64) },
    constraint,
    capability_contract: buildForgeCapabilityContract(sha256, capabilities),
    exclusions,
  };
  return { ...unsigned, authority_hash: sha256(stableStringify(unsigned)) };
}
const routeCalls: Array<{ method: string; path: string; body: unknown }> = [];
const discoveryCalls: Array<{ path: string; authorization?: string; workspaceId?: string }> = [];
const server = http.createServer((request, response) => {
  if (request.url === '/api/agent/schema') {
    discoveryCalls.push({
      path: request.url,
      authorization: request.headers.authorization,
      workspaceId: request.headers['x-workspace-id'] as string | undefined,
    });
    if (mode === 'hung') return;
    if (mode === 'outage') {
      response.writeHead(503, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ error: 'schema temporarily unavailable' }));
      return;
    }
    response.writeHead(200, { 'Content-Type': 'application/json' });
    const effectiveModes: Mode[] = [
      'live', 'read', 'write', 'narrowed', 'alias-narrowed', 'v2', 'unauthorized', 'forbidden',
      'wrong-workspace', 'authority-wrong-hash', 'effective-malformed', 'effective-missing', 'effective-expanded',
    ];
    const body = effectiveModes.includes(mode)
      ? { api_version: '2026-07-30.agent.v4', capability_contract: contract }
      : mode === 'duplicate-id'
            ? { api_version: '2026-07-30.agent.v4', capability_contract: duplicateIdContract }
            : mode === 'binding-collision'
              ? { api_version: '2026-07-30.agent.v4', capability_contract: bindingCollisionContract }
              : mode === 'fixed-body-type'
                ? { api_version: '2026-07-30.agent.v4', capability_contract: fixedBodyTypeContract }
                : mode === 'mcp-alias-collision'
                  ? { api_version: '2026-07-30.agent.v4', capability_contract: mcpAliasCollisionContract }
                : mode === 'extra-field'
                  ? { api_version: '2026-07-30.agent.v4', capability_contract: extraFieldContract }
                : mode === 'api-path'
                  ? { api_version: '2026-07-30.agent.v4', capability_contract: invalidPathContract }
                  : mode === 'api-dot-path'
                    ? { api_version: '2026-07-30.agent.v4', capability_contract: traversalPathContract }
                : mode === 'open-input'
                  ? { api_version: '2026-07-30.agent.v4', capability_contract: openInputContract }
          : mode === 'wrong-hash'
            ? { api_version: '2026-07-30.agent.v4', capability_contract: wrongHashContract }
          : mode === 'incomplete'
            ? { api_version: '2026-07-30.agent.v4', capability_contract: incompleteContract }
          : mode === 'malformed'
            ? { api_version: '2026-07-30.agent.v4', capability_contract: { ...contract, contractHash: 'not-a-hash', capabilities: contract.capabilities.slice(0, 1) } }
            : mode === 'current-missing'
              ? { api_version: '2026-07-30.agent.v4' }
              : mode === 'unknown-envelope'
                ? { api_version: 'future.agent.v99' }
                : mode === 'primitive'
                  ? 'not-a-schema-envelope'
                  : { api_version: '2026-06-10.agent.v2' };
    response.end(JSON.stringify(body));
    return;
  }
  if (request.url === '/api/agent/capabilities/effective') {
    discoveryCalls.push({
      path: request.url,
      authorization: request.headers.authorization,
      workspaceId: request.headers['x-workspace-id'] as string | undefined,
    });
    if (mode === 'legacy') {
      response.writeHead(404, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ error: 'not found' }));
      return;
    }
    if (mode === 'effective-missing') {
      response.writeHead(404, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ error: 'not found' }));
      return;
    }
    if (mode === 'unauthorized') {
      response.writeHead(401, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ error: 'invalid agent key' }));
      return;
    }
    if (mode === 'forbidden') {
      response.writeHead(403, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ error: 'key scope denied' }));
      return;
    }
    let authority = mode === 'read'
      ? effectiveAuthority('read')
      : mode === 'write'
        ? effectiveAuthority('write')
        : mode === 'narrowed'
          ? effectiveAuthority('write', customConstraint)
          : mode === 'alias-narrowed'
            ? effectiveAuthority('write', customConstraint, [
              FORGE_CAPABILITIES.find(capability => capability.id === 'schema.domains.list')!,
              FORGE_CAPABILITIES.find(capability => capability.id === 'schema.element.explain')!,
              aliasNarrowedValidationV1,
            ])
            : mode === 'v2'
              ? effectiveAuthority('write', customConstraint, [validationV2])
              : mode === 'effective-expanded'
                ? effectiveAuthority('deploy', null, [...FORGE_CAPABILITIES, effectiveOrphanCapability])
              : mode === 'effective-malformed'
                ? { api_version: EFFECTIVE_API_VERSION, actor: {} }
                : effectiveAuthority('deploy');
    if (mode === 'authority-wrong-hash') authority = { ...authority, authority_hash: '0'.repeat(64) };
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify(authority));
    return;
  }
  if (request.method === 'GET' && request.url?.startsWith('/api/agent/lang/hover?')) {
    routeCalls.push({ method: request.method, path: request.url, body: null });
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({
      domain: 'md', tag: 'cue', known: true, summary: 'fixture', requiredAttrs: [], attrCount: 0,
    }));
    return;
  }
  if (request.method === 'GET' && request.url?.startsWith('/api/agent/lang/attrs?')) {
    routeCalls.push({ method: request.method, path: request.url, body: null });
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ attrs: [] }));
    return;
  }
  if (request.method === 'POST' && ['/api/agent/project/validate', '/api/agent/project/validate/check'].includes(request.url || '')) {
    let raw = '';
    request.setEncoding('utf8');
    request.on('data', chunk => { raw += chunk; });
    request.on('end', () => {
      const body = raw ? JSON.parse(raw) : null;
      routeCalls.push({ method: request.method || '', path: request.url || '', body });
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify(endpointMode === 'empty-json'
        ? {}
        : { ok: true, summary: {}, flat: [], capsules: [], source: { loaded: [] } }));
    });
    return;
  }
  if (request.method === 'GET' && request.url?.startsWith('/api/agent/lang/element-explain?')) {
    routeCalls.push({ method: request.method, path: request.url, body: null });
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify(endpointMode === 'missing-fields'
      ? { domain: 'md', tag: 'cue', known: true, attrs: [] }
      : { domain: 'md', tag: 'cue', known: true, requiredAttrs: [], attrCount: 0, attrs: [] }));
    return;
  }
  if (request.method === 'GET' && request.url === '/api/agent/readiness') {
    routeCalls.push({ method: request.method, path: request.url, body: null });
    response.writeHead(200, { 'Content-Type': endpointMode === 'invalid-json' ? 'text/plain' : 'application/json' });
    response.end(endpointMode === 'invalid-json' ? 'not-json' : JSON.stringify({
      workspaceId: 'fixture', workspace: 'Fixture workspace', modId: 'fixture', stages: [], note: 'fixture',
    }));
    return;
  }
  if (request.method === 'GET' && request.url === '/api/agent/workspace') {
    routeCalls.push({ method: request.method, path: request.url, body: null });
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({
      workspaceId: 'ws_fixture',
      workspace: { name: 'Fixture workspace', nodes: [{ id: 'cue_fixture', xmlTag: 'cue', label: 'Fixture cue' }], links: [] },
      version: 7,
      workspaceHash: 'a'.repeat(64),
      ...(endpointMode === 'missing-workspace-snapshot' ? {} : { snapshotHash: 'b'.repeat(64) }),
      lastUpdated: '2030-01-01T00:00:00.000Z',
      origin: 'mcp-selftest',
    }));
    return;
  }
  response.writeHead(404, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify({ error: 'not found' }));
});

const port = await listen(server);
const baseUrl = `http://127.0.0.1:${port}`;
try {
  mode = 'read';
  await withMcp(baseUrl, async client => {
    assert.deepEqual((await toolsFor(client)).map(tool => tool.name), READ_TOOLS,
      'read key effective discovery must expose exactly five curated tools');
  });

  mode = 'write';
  await withMcp(baseUrl, async client => {
    assert.deepEqual((await toolsFor(client)).map(tool => tool.name), WRITE_TOOLS,
      'write key effective discovery must expose exactly nine curated tools');
  });

  mode = 'live';
  for (const [label, auth] of [
    ['missing-key', { key: '' }],
    ['missing-workspace', { workspaceId: '' }],
  ] as const) {
    await withMcp(baseUrl, async client => {
      assert.deepEqual(await toolsFor(client), [], `${label} must advertise no tools before effective discovery`);
      const denied = await client.request('tools/call', { name: 'get_workspace', arguments: {} });
      assert.equal(denied.error?.code, -32602, `${label} must also block direct tools/call`);
    }, auth);
  }

  mode = 'live';
  discoveryCalls.length = 0;
  await withMcp(baseUrl, async client => {
    const liveTools = await toolsFor(client);
    assert.deepEqual(liveTools.map(tool => tool.name), EXPECTED_TOOLS, 'live discovery changed the curated MCP inventory');
    assert.deepEqual(discoveryCalls.slice(0, 2).map(call => call.path), [
      '/api/agent/schema', '/api/agent/capabilities/effective',
    ], 'current MCP discovery must verify the canonical catalog before the actor-effective subset');
    assert.ok(discoveryCalls.slice(0, 2).every(call =>
      call.authorization === `Bearer ${MCP_KEY}` && call.workspaceId === MCP_WORKSPACE_ID),
    'canonical and effective discovery must carry the configured bearer key and workspace authority');
    assert.ok(!JSON.stringify(liveTools).includes(MCP_KEY) && !JSON.stringify(liveTools).includes('x4fk_'),
      'MCP inventory must never leak the plaintext key');
    for (const tool of liveTools) {
      assert.equal(tool._meta?.['x4forge/contractVersion'], 'forge.capability.v1');
      assert.equal(tool._meta?.['x4forge/contractHash'], contract.contractHash);
      assert.equal(tool._meta?.['x4forge/authorityVersion'], EFFECTIVE_API_VERSION);
      assert.match(String(tool._meta?.['x4forge/authorityHash'] || ''), /^[a-f0-9]{64}$/);
      assert.equal(typeof tool._meta?.['x4forge/capabilityId'], 'string');
      const capabilityId = String(tool._meta?.['x4forge/capabilityId'] || '');
      assert.equal(
        tool._meta?.['x4forge/capabilityVersion'],
        FORGE_CAPABILITIES.find(capability => capability.id === capabilityId)?.version,
      );
      assert.equal(tool.annotations, undefined, '2024-11-05 MCP must not emit annotations introduced in later revisions');
    }
    routeCalls.length = 0;
    const liveValidation = await client.request('tools/call', { name: 'validate_mod', arguments: { fromPath: 'fixture' } });
    assert.equal(liveValidation.error, undefined, liveValidation.error?.message);
    assert.equal((liveValidation.result as any)?.isError, undefined);
    const liveWorkspace = await client.request('tools/call', { name: 'get_workspace', arguments: {} });
    assert.equal(liveWorkspace.error, undefined, liveWorkspace.error?.message);
    assert.equal((liveWorkspace.result as any)?.isError, undefined);
    const liveWorkspaceSummary = JSON.parse(String(liveWorkspace.result?.content?.[0]?.text || '{}'));
    assert.deepEqual(liveWorkspaceSummary, {
      name: 'Fixture workspace',
      version: 7,
      workspaceHash: 'a'.repeat(64),
      snapshotHash: 'b'.repeat(64),
      nodes: 1,
      links: 0,
      nodeSummary: [{ id: 'cue_fixture', tag: 'cue', label: 'Fixture cue' }],
    }, 'get_workspace must return both identities and the bounded workspace summary');
    const liveExplanation = await client.request('tools/call', { name: 'explain_element', arguments: { tag: 'cue' } });
    assert.equal(liveExplanation.error, undefined, liveExplanation.error?.message);
    assert.equal((liveExplanation.result as any)?.isError, undefined);
    const liveReadiness = await client.request('tools/call', { name: 'readiness', arguments: {} });
    assert.equal(liveReadiness.error, undefined, liveReadiness.error?.message);
    assert.equal((liveReadiness.result as any)?.isError, undefined);
    assert.deepEqual(routeCalls.map(call => `${call.method} ${call.path}`), [
      'POST /api/agent/project/validate/check',
      'GET /api/agent/workspace',
      'GET /api/agent/lang/element-explain?file=md%2Fx.xml&tag=cue',
      'GET /api/agent/readiness',
    ], 'current-contract execution must use current capability routes');

    routeCalls.length = 0;
    const invalidListParams = await client.request('tools/list', { ignored: true });
    assert.equal(invalidListParams.error?.code, -32602, 'tools/list must reject undeclared params');
    const invalidListCursor = await client.request('tools/list', { cursor: 'not-issued' });
    assert.equal(invalidListCursor.error?.code, -32602, 'tools/list must reject a cursor that this one-page inventory did not issue');
    const invalidCallEnvelope = await client.request('tools/call', { name: 'readiness', arguments: {}, ignored: true });
    assert.equal(invalidCallEnvelope.error?.code, -32602, 'tools/call must reject undeclared envelope fields');
    const invalidCallArgumentsShape = await client.request('tools/call', { name: 'readiness', arguments: 'not-an-object' });
    assert.equal(invalidCallArgumentsShape.error?.code, -32602, 'tools/call arguments must be an object when supplied');
    for (const invalid of [
      { name: 'validate_mod', arguments: {} },
      { name: 'validate_mod', arguments: { fromPath: 42 } },
      { name: 'author_check', arguments: { files: [{ path: 'md/x.xml', content: 42 }] } },
      { name: 'readiness', arguments: { apply: true } },
      { name: 'readiness', arguments: { constructor: 'x' } },
      { name: 'explain_element', arguments: { tag: 'cue', recordBaseline: true } },
      { name: 'author_check', arguments: { files: [{ path: 'md/x.xml', content: '<mdscript/>', ignored: true }] } },
      { name: 'author_check', arguments: { files: [{ path: 'md/x.xml', content: '<mdscript/>', toString: 'x' }] } },
    ]) {
      const denied = await client.request('tools/call', invalid);
      assert.equal(denied.error?.code, -32602, `${invalid.name} malformed input must fail before HTTP`);
    }
    assert.deepEqual(routeCalls, [], 'schema-invalid MCP arguments reached the Forge API');

    endpointMode = 'empty-json';
    const emptyResponse = await client.request('tools/call', { name: 'validate_mod', arguments: { fromPath: 'fixture' } });
    assert.equal((emptyResponse.result as any)?.isError, true, 'empty successful API envelope must fail the MCP call');
    endpointMode = 'invalid-json';
    const invalidJsonResponse = await client.request('tools/call', { name: 'readiness', arguments: {} });
    assert.equal((invalidJsonResponse.result as any)?.isError, true, 'non-JSON successful API response must fail the MCP call');
    endpointMode = 'missing-fields';
    const incompleteEnvelope = await client.request('tools/call', { name: 'explain_element', arguments: { tag: 'cue' } });
    assert.equal((incompleteEnvelope.result as any)?.isError, true,
      'successful API response missing canonical output fields must fail the MCP call');
    endpointMode = 'missing-workspace-snapshot';
    const missingSnapshot = await client.request('tools/call', { name: 'get_workspace', arguments: {} });
    assert.equal((missingSnapshot.result as any)?.isError, true,
      'workspace.read@2 must fail closed when the API omits snapshotHash');
    assert.match(String(missingSnapshot.result?.content?.[0]?.text || ''), /snapshotHash/,
      'workspace.read@2 failure must name the missing snapshotHash field');
    endpointMode = 'normal';
  });

  mode = 'legacy';
  await withMcp(baseUrl, async client => {
    const legacyTools = await toolsFor(client);
    assert.deepEqual(legacyTools.map(tool => tool.name), EXPECTED_TOOLS, 'legacy fallback changed the curated MCP inventory');
    assert.ok(legacyTools.every(tool => tool._meta?.['x4forge/contractVersion'] === 'legacy-static-fallback'));
    const legacyWorkspaceTool = legacyTools.find(tool => tool.name === 'get_workspace');
    assert.equal(legacyWorkspaceTool?._meta?.['x4forge/capabilityVersion'], 1,
      'legacy get_workspace must identify its workspace.read@1 compatibility projection');
    assert.match(String(legacyWorkspaceTool?.description || ''), /no complete snapshotHash/i);
    routeCalls.length = 0;
    const legacyCall = await client.request('tools/call', { name: 'validate_mod', arguments: { fromPath: 'fixture' } });
    assert.equal(legacyCall.error, undefined, legacyCall.error?.message);
    assert.equal(legacyCall.result?.content?.[0]?.type, 'text');
    endpointMode = 'missing-workspace-snapshot';
    const legacyWorkspace = await client.request('tools/call', { name: 'get_workspace', arguments: {} });
    assert.equal((legacyWorkspace.result as any)?.isError, undefined,
      'reviewed legacy workspace.read@1 response must remain callable without snapshotHash');
    const legacyWorkspaceSummary = JSON.parse(String(legacyWorkspace.result?.content?.[0]?.text || '{}'));
    assert.equal(legacyWorkspaceSummary.snapshotHash, undefined);
    assert.equal(legacyWorkspaceSummary.snapshotHashAvailable, false);
    assert.equal(legacyWorkspaceSummary.compatibility, 'workspace.read@1');
    endpointMode = 'normal';
    assert.deepEqual(routeCalls, [
      { method: 'POST', path: '/api/agent/project/validate', body: { fromPath: 'fixture' } },
      { method: 'GET', path: '/api/agent/workspace', body: null },
    ], 'legacy calls must use bounded compatibility routes and preserve workspace.read@1 truth');
  });

  mode = 'legacy';
  await withMcp(baseUrl, async client => {
    await toolsFor(client);
    mode = 'outage';
    const unavailableTools = await toolsFor(client);
    const unavailableWorkspaceTool = unavailableTools.find(tool => tool.name === 'get_workspace');
    assert.equal(unavailableWorkspaceTool?._meta?.['x4forge/capabilityVersion'], 1,
      'a positively identified reviewed legacy server may retain its bounded v1 adapter through an outage');
    routeCalls.length = 0;
    const validationCall = await client.request('tools/call', { name: 'validate_mod', arguments: { fromPath: 'fixture' } });
    assert.equal(validationCall.result?.content?.[0]?.type, 'text');
    const explanationCall = await client.request('tools/call', { name: 'explain_element', arguments: { tag: 'cue' } });
    assert.equal(explanationCall.result?.content?.[0]?.type, 'text');
    endpointMode = 'missing-workspace-snapshot';
    const unavailableWorkspace = await client.request('tools/call', { name: 'get_workspace', arguments: {} });
    assert.equal((unavailableWorkspace.result as any)?.isError, undefined,
      'positively identified legacy workspace.read@1 may remain available through a transient discovery outage');
    endpointMode = 'normal';
    assert.deepEqual(routeCalls.map(call => `${call.method} ${call.path}`), [
      'POST /api/agent/project/validate',
      'GET /api/agent/lang/hover?file=md%2Fx.xml&tag=cue',
      'GET /api/agent/lang/attrs?file=md%2Fx.xml&tag=cue',
      'GET /api/agent/workspace',
    ], 'transient outage after reviewed legacy discovery must retain only the old-server-compatible calls');
  });

  mode = 'malformed';
  await withMcp(baseUrl, async client => {
    assert.deepEqual(await toolsFor(client), [], 'malformed current contract must fail closed');
    const deniedCall = await client.request('tools/call', { name: 'validate_mod', arguments: { fromPath: 'fixture' } });
    assert.equal(deniedCall.error?.code, -32602, 'malformed current contract must also block direct tools/call');
  });

  for (const invalidMode of [
    'current-missing', 'unknown-envelope', 'primitive', 'wrong-hash', 'unauthorized', 'forbidden',
    'wrong-workspace', 'authority-wrong-hash', 'effective-malformed', 'effective-missing', 'effective-expanded',
  ] as const) {
    mode = invalidMode;
    await withMcp(baseUrl, async client => {
      assert.deepEqual(await toolsFor(client), [], `${invalidMode} capability discovery must fail closed`);
      const deniedCall = await client.request('tools/call', { name: 'validate_mod', arguments: { fromPath: 'fixture' } });
      assert.equal(deniedCall.error?.code, -32602, `${invalidMode} must also block direct tools/call`);
    });
  }

  mode = 'incomplete';
  await withMcp(baseUrl, async client => {
    assert.deepEqual(await toolsFor(client), [], 'correctly hashed incomplete v1 descriptor must fail closed');
    mode = 'legacy';
    assert.deepEqual(await toolsFor(client), [], 'legacy downgrade after malformed current discovery must remain fail closed');
    mode = 'live';
    await client.waitForNotification('notifications/tools/list_changed');
    assert.deepEqual((await toolsFor(client)).map(tool => tool.name), EXPECTED_TOOLS,
      'a later valid current contract must notify and recover a process blocked by malformed discovery');
  });

  for (const invalidMode of [
    'duplicate-id', 'binding-collision', 'fixed-body-type', 'mcp-alias-collision', 'extra-field', 'api-path', 'api-dot-path', 'open-input',
  ] as const) {
    mode = invalidMode;
    await withMcp(baseUrl, async client => {
      assert.deepEqual(await toolsFor(client), [], `${invalidMode} correctly hashed contract must fail closed`);
      const deniedCall = await client.request('tools/call', { name: 'validate_mod', arguments: { fromPath: 'fixture' } });
      assert.equal(deniedCall.error?.code, -32602, `${invalidMode} contract must also block direct tools/call`);
    });
  }

  mode = 'narrowed';
  await withMcp(baseUrl, async client => {
    const narrowedTools = await toolsFor(client);
    assert.deepEqual(narrowedTools.map(tool => tool.name), CUSTOM_TOOLS,
      'custom exact identity must retain public capabilities while narrowing protected tools');
    const narrowedAuthorityHash = narrowedTools[0]?._meta?.['x4forge/authorityHash'];
    assert.match(String(narrowedAuthorityHash || ''), /^[a-f0-9]{64}$/,
      'narrowed live tools must carry the effective authority hash');
    mode = 'legacy';
    const stickyAfterLegacyDowngrade = await toolsFor(client);
    assert.deepEqual(stickyAfterLegacyDowngrade.map(tool => tool.name), CUSTOM_TOOLS,
      'reviewed legacy downgrade after live narrowing must not widen the MCP inventory');
    assert.ok(stickyAfterLegacyDowngrade.every(tool =>
      tool._meta?.['x4forge/contractVersion'] === 'legacy-sticky-live' &&
      tool._meta?.['x4forge/authorityHash'] === narrowedAuthorityHash),
    'legacy downgrade must retain the accepted live contract and authority receipts');
    assert.equal(stickyAfterLegacyDowngrade.find(tool => tool.name === 'get_workspace'), undefined,
      'legacy downgrade must not acquire a workspace.read@1 compatibility projection');
    const excludedAfterLegacy = await client.request('tools/call', { name: 'compile_workspace', arguments: {} });
    assert.equal(excludedAfterLegacy.error?.code, -32602,
      'legacy downgrade must not make an excluded tool directly callable');
    routeCalls.length = 0;
    const allowedAfterLegacy = await client.request('tools/call', {
      name: 'validate_mod', arguments: { fromPath: 'fixture' },
    });
    assert.equal(allowedAfterLegacy.error, undefined, allowedAfterLegacy.error?.message);
    assert.deepEqual(routeCalls.map(call => `${call.method} ${call.path}`), ['POST /api/agent/project/validate/check'],
      'legacy downgrade after live authority must retain current routes, not compatibility adapters');
    mode = 'hung';
    const stickyAfterTimeout = await toolsFor(client);
    assert.deepEqual(stickyAfterTimeout.map(tool => tool.name), CUSTOM_TOOLS,
      'timeout after live narrowing must not widen the MCP inventory');
    assert.ok(stickyAfterTimeout.every(tool => tool._meta?.['x4forge/contractVersion'] === 'unavailable-sticky-live'));
    mode = 'live';
    assert.deepEqual((await toolsFor(client)).map(tool => tool.name), CUSTOM_TOOLS,
      'a broader later live contract must not re-expand a process after narrowing');
  });

  mode = 'live';
  await withMcp(baseUrl, async client => {
    assert.deepEqual((await toolsFor(client)).map(tool => tool.name), EXPECTED_TOOLS);
    mode = 'alias-narrowed';
    await client.waitForNotification('notifications/tools/list_changed');
    assert.deepEqual(await toolsFor(client), [],
      'a substituted descriptor that is locally well-formed but not byte-equivalent to canonical must fail closed');
    const deniedSubstitutedCall = await client.request('tools/call', { name: 'validate_mod', arguments: { fromPath: 'fixture' } });
    assert.equal(deniedSubstitutedCall.error?.code, -32602,
      'descriptor substitution must also block direct tools/call');
    mode = 'live';
    await client.waitForNotification('notifications/tools/list_changed');
    assert.deepEqual((await toolsFor(client)).map(tool => tool.name), EXPECTED_TOOLS,
      'a later valid actor-effective contract must recover after a substituted descriptor is removed');
  });

  mode = 'v2';
  await withMcp(baseUrl, async client => {
    assert.deepEqual(await toolsFor(client), [], 'unsupported capability descriptor version must not run the v1 adapter');
  });

  mode = 'hung';
  await withMcp(baseUrl, async client => {
    const hungStarted = Date.now();
    const hungTools = await toolsFor(client);
    const hungElapsed = Date.now() - hungStarted;
    assert.deepEqual(hungTools, [], 'pre-first-discovery outage must not expose a broad static inventory');
    assert.ok(hungElapsed >= 1_500 && hungElapsed < 4_500, `hung discovery fallback took ${hungElapsed} ms`);
    mode = 'live';
    const recovered = await toolsFor(client);
    assert.deepEqual(recovered.map(tool => tool.name), EXPECTED_TOOLS, 'same-process discovery did not recover after the server became live');
    assert.ok(recovered.every(tool => tool._meta?.['x4forge/contractVersion'] === 'forge.capability.v1'));
    console.log(`MCP capability selftest PASS: read=${READ_TOOLS.length}, write=${WRITE_TOOLS.length}, deploy=${recovered.length}; exact custom narrowing, legacy-only fallback, authenticated effective discovery, canonical-subset checks, fail-closed negatives, sticky monotonicity, and same-process recovery after ${hungElapsed} ms.`);
  });
} finally {
  await stop(server);
}
