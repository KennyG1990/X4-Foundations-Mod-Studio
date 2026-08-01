/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * B42 — Agent API key manager: named, scoped, EXPIRING bearer keys for external agents
 * (Codex / Claude / Antigravity / scripts), managed by the studio owner.
 *
 * Security model:
 *  - Plaintext keys (`x4fk_<64 hex>`) are shown ONCE at creation and never stored —
 *    records persist a sha256 hash only, so neither the JSON file nor any list endpoint
 *    can leak a usable credential.
 *  - Keys carry a SCOPE ('read' | 'write' | 'deploy') enforced by the server's auth
 *    middleware (deny-by-default), and an optional EXPIRY chosen by the user at creation.
 *  - The boot session token (app UI) is the only credential allowed to manage keys —
 *    an agent key can never mint or revoke keys (privilege-escalation guard).
 *
 * House pattern: pure engine (injected clock + file path — no wall-clock or randomness in
 * verification logic) + runAgentKeysSelftest() oracle registered in server.ts SELFTESTS.
 */

import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import routeAuthorityManifest from '../../config/forge-route-dispositions.json' with { type: 'json' };
import {
  createAgentRouteAuthority,
  runAgentRouteAuthoritySelftest,
  type AgentAuthorityResolution,
  type AgentKeyScope,
  type AgentRouteAuthorityDecision,
} from './agentAuthority';
import { atomicWriteJson, type AtomicWriteOptions } from './workspaceState';

export type { AgentKeyScope, AgentRouteAuthorityDecision } from './agentAuthority';

export interface AgentKeyRecord {
  id: string;
  label: string;
  scope: AgentKeyScope;
  /** ADR-F5: immutable workspace authority. Missing only on pre-migration legacy keys. */
  workspaceId?: string;
  /** sha256 hex of the plaintext key. Never the key itself. */
  tokenHash: string;
  createdAt: number;
  /** null = never expires. */
  expiresAt: number | null;
  lastUsedAt: number | null;
  useCount: number;
  revokedAt: number | null;
}

export interface AgentKeyVerify {
  ok: boolean;
  id?: string;
  label?: string;
  scope?: AgentKeyScope;
  workspaceId?: string;
  reason?: 'unknown' | 'expired' | 'revoked';
}

export interface AgentKeyStore {
  create(label: string, scope: AgentKeyScope, ttlMs: number | null, workspaceId?: string): { token: string; record: AgentKeyRecord };
  verify(token: string, atMs?: number): AgentKeyVerify;
  revoke(id: string): boolean;
  /** Safe listing — records only (hashes included are non-reversible, but we still trim them for display). */
  list(): Array<Omit<AgentKeyRecord, 'tokenHash'> & { hashPrefix: string }>;
  /** Record a successful use (updates lastUsedAt/useCount, persisted lazily). */
  touch(id: string, atMs?: number): void;
  /** Drop expired + revoked records older than the given age (housekeeping). */
  prune(atMs?: number, keepRevokedMs?: number): number;
}

export const AGENT_KEY_PREFIX = 'x4fk_';

/** UI/endpoint lifetime vocabulary → milliseconds (null = never). */
export const AGENT_KEY_TTLS: Record<string, number | null> = {
  '1h': 3_600_000,
  '24h': 86_400_000,
  '7d': 7 * 86_400_000,
  '30d': 30 * 86_400_000,
  'never': null,
};

export function hashAgentKey(token: string): string {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

function isAgentKeyRecord(value: unknown): value is AgentKeyRecord {
  if (!value || typeof value !== 'object') return false;
  const row = value as Partial<AgentKeyRecord>;
  const nullableNumber = (candidate: unknown) => candidate === null || (typeof candidate === 'number' && Number.isFinite(candidate));
  return typeof row.id === 'string' && typeof row.label === 'string' &&
    (row.scope === 'read' || row.scope === 'write' || row.scope === 'deploy') &&
    (row.workspaceId === undefined || /^ws_[a-f0-9]{24}$/i.test(row.workspaceId)) &&
    typeof row.tokenHash === 'string' && /^[a-f0-9]{64}$/.test(row.tokenHash) &&
    typeof row.createdAt === 'number' && Number.isFinite(row.createdAt) &&
    nullableNumber(row.expiresAt) && nullableNumber(row.lastUsedAt) && nullableNumber(row.revokedAt) &&
    typeof row.useCount === 'number' && Number.isInteger(row.useCount) && row.useCount >= 0;
}

interface StoreOptions {
  /** JSON persistence path; empty string = in-memory only (tests). */
  file: string;
  now?: () => number;
  /** Injected randomness for deterministic tests; default crypto.randomBytes. */
  randomHex?: (bytes: number) => string;
  /** Test seam for deterministic pre-promotion failure. */
  writeJson?: (file: string, value: unknown, options?: AtomicWriteOptions) => void;
}

export function createAgentKeyStore(opts: StoreOptions): AgentKeyStore {
  const now = opts.now || (() => Date.now());
  const randomHex = opts.randomHex || ((n: number) => crypto.randomBytes(n).toString('hex'));
  const writeJson = opts.writeJson || atomicWriteJson;
  let records: AgentKeyRecord[] = [];
  let loadError: string | null = null;

  // ---- persistence (atomic write; missing is first boot, malformed/unreadable fails closed) ----
  function load(): void {
    if (!opts.file) return;
    try {
      const raw = fs.readFileSync(opts.file, 'utf8');
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || ![1, 2].includes(parsed.version) || !Array.isArray(parsed.keys) || !parsed.keys.every(isAgentKeyRecord)) {
        throw new Error('agent key store has an invalid shape');
      }
      records = parsed.keys;
    } catch (error: unknown) {
      const code = typeof error === 'object' && error !== null && 'code' in error
        ? (error as { code?: unknown }).code
        : undefined;
      if (code !== 'ENOENT') loadError = error instanceof Error ? error.message : String(error);
      /* first boot or unreadable — existing keys fail closed; mutations refuse overwrite */
    }
  }
  function save(next: AgentKeyRecord[]): void {
    if (!opts.file) return;
    if (loadError) throw new Error(`Agent key store is unreadable; refusing to overwrite it: ${loadError}`);
    writeJson(opts.file, { version: 2, keys: next }, { mode: 0o600 });
  }
  load();

  return {
    create(label: string, scope: AgentKeyScope, ttlMs: number | null, workspaceId?: string) {
      if (workspaceId !== undefined && !/^ws_[a-f0-9]{24}$/i.test(workspaceId)) {
        throw new Error('Agent key workspaceId is malformed.');
      }
      const at = now();
      const token = AGENT_KEY_PREFIX + randomHex(32);
      const record: AgentKeyRecord = {
        id: `key_${at.toString(36)}_${randomHex(4)}`,
        label: String(label || 'unnamed').slice(0, 60),
        scope,
        ...(workspaceId ? { workspaceId } : {}),
        tokenHash: hashAgentKey(token),
        createdAt: at,
        expiresAt: ttlMs === null ? null : at + Math.max(60_000, ttlMs),
        lastUsedAt: null,
        useCount: 0,
        revokedAt: null,
      };
      const next = [...records, record];
      save(next);
      records = next;
      return { token, record };
    },

    verify(token: string, atMs?: number): AgentKeyVerify {
      if (!token || !token.startsWith(AGENT_KEY_PREFIX)) return { ok: false, reason: 'unknown' };
      const at = atMs ?? now();
      const hash = hashAgentKey(token);
      const rec = records.find((r) => r.tokenHash === hash);
      if (!rec) return { ok: false, reason: 'unknown' };
      if (rec.revokedAt !== null) return { ok: false, reason: 'revoked' };
      if (rec.expiresAt !== null && at >= rec.expiresAt) return { ok: false, reason: 'expired' };
      return { ok: true, id: rec.id, label: rec.label, scope: rec.scope, workspaceId: rec.workspaceId };
    },

    revoke(id: string): boolean {
      const rec = records.find((r) => r.id === id);
      if (!rec || rec.revokedAt !== null) return false;
      const next = records.map(row => row.id === id ? { ...row, revokedAt: now() } : row);
      save(next);
      records = next;
      return true;
    },

    list() {
      return records.map(({ tokenHash, ...rest }) => ({ ...rest, hashPrefix: tokenHash.slice(0, 8) }));
    },

    touch(id: string, atMs?: number) {
      const rec = records.find((r) => r.id === id);
      if (!rec) return;
      const next = records.map(row => row.id === id ? { ...row, lastUsedAt: atMs ?? now(), useCount: row.useCount + 1 } : row);
      try {
        save(next);
        records = next;
      } catch {
        // Touch is audit metadata, not authorization state. Keep memory/disk consistent
        // and allow the already-authorized request without fabricating a durable touch.
      }
    },

    prune(atMs?: number, keepRevokedMs = 30 * 86_400_000): number {
      const at = atMs ?? now();
      const before = records.length;
      const next = records.filter((r) => {
        if (r.revokedAt !== null) return at - r.revokedAt < keepRevokedMs;
        if (r.expiresAt !== null && at >= r.expiresAt) return false;
        return true;
      });
      if (next.length !== before) {
        save(next);
        records = next;
      }
      return before - next.length;
    },
  };
}

// ---------------------------------------------------------------------------
// B117 exact route authority. The bundled reviewed manifest is the only grant source.
// ---------------------------------------------------------------------------

const ACTIVE_AGENT_ROUTE_AUTHORITY = createAgentRouteAuthority(routeAuthorityManifest);

function apiPath(reqPath: string): string {
  const value = String(reqPath || '');
  return value.startsWith('/api/') ? value : `/api${value.startsWith('/') ? value : `/${value}`}`;
}

export const AGENT_AUTHORITY_POLICY_VERSION = ACTIVE_AGENT_ROUTE_AUTHORITY.policyVersion;
export const AGENT_AUTHORITY_POLICY_HASH = ACTIVE_AGENT_ROUTE_AUTHORITY.policyHash;

export function resolveAgentRouteAuthority(method: string, reqPath: string): AgentAuthorityResolution {
  return ACTIVE_AGENT_ROUTE_AUTHORITY.resolve(method, apiPath(reqPath));
}

/** Is this exact reviewed method/template granted to the key preset? */
export function scopeAllows(scope: AgentKeyScope, method: string, reqPath: string): boolean {
  return ACTIVE_AGENT_ROUTE_AUTHORITY.allows(scope, method, apiPath(reqPath));
}

// ---------------------------------------------------------------------------
// Oracle
// ---------------------------------------------------------------------------

export function runAgentKeysSelftest(): { pass: boolean; checks: Array<{ name: string; pass: boolean; detail?: string }> } {
  const checks: Array<{ name: string; pass: boolean; detail?: string }> = [];
  const ok = (name: string, pass: boolean, detail?: string) => checks.push({ name, pass, detail });

  const T0 = 1_000_000_000_000; // fixed epoch — deterministic
  let seed = 0;
  const store = createAgentKeyStore({
    file: '', // in-memory
    now: () => T0,
    randomHex: (n) => (seed++).toString(16).padStart(n * 2, 'a'),
  });

  // create + verify happy path, scope carried
  const made = store.create('codex', 'write', AGENT_KEY_TTLS['1h']);
  const v1 = store.verify(made.token, T0 + 1000);
  ok('create_verify_green', v1.ok === true && v1.scope === 'write' && v1.label === 'codex');
  ok('token_has_prefix', made.token.startsWith(AGENT_KEY_PREFIX));
  const bound = store.create('bound', 'write', AGENT_KEY_TTLS['1h'], 'ws_111111111111111111111111');
  const boundVerify = store.verify(bound.token, T0 + 1000);
  ok('workspace_binding_roundtrip', boundVerify.ok === true && boundVerify.workspaceId === 'ws_111111111111111111111111' && store.list().find(row => row.id === bound.record.id)?.workspaceId === boundVerify.workspaceId);
  let malformedBindingRejected = false;
  try { store.create('bad binding', 'read', null, 'not-a-workspace'); } catch { malformedBindingRejected = true; }
  ok('malformed_workspace_binding_rejected', malformedBindingRejected);

  // no plaintext at rest
  ok('record_stores_hash_not_plaintext',
    made.record.tokenHash !== made.token && !JSON.stringify(store.list()).includes(made.token));

  // wrong token
  ok('wrong_token_unknown', store.verify(AGENT_KEY_PREFIX + 'f'.repeat(64), T0).reason === 'unknown');
  ok('foreign_format_unknown', store.verify('sk-not-ours', T0).reason === 'unknown');

  // EXPIRY: 1h key dead at +2h, alive at +59min (the user-picked-lifetime requirement)
  ok('expired_key_rejected', store.verify(made.token, T0 + 2 * 3_600_000).reason === 'expired');
  ok('unexpired_key_accepted', store.verify(made.token, T0 + 59 * 60_000).ok === true);

  // never-expires
  const forever = store.create('forever', 'read', null);
  ok('never_ttl_survives_a_year', store.verify(forever.token, T0 + 365 * 86_400_000).ok === true);

  // revocation
  store.revoke(made.record.id);
  ok('revoked_key_rejected', store.verify(made.token, T0 + 1000).reason === 'revoked');
  ok('revoke_twice_false', store.revoke(made.record.id) === false);

  // touch/audit
  store.touch(forever.record.id, T0 + 5000);
  const listed = store.list().find((r) => r.id === forever.record.id);
  ok('touch_updates_audit', listed?.lastUsedAt === T0 + 5000 && listed?.useCount === 1);

  // prune removes expired, keeps live
  const shortLived = store.create('short', 'read', AGENT_KEY_TTLS['1h']);
  const removed = store.prune(T0 + 3 * 3_600_000, 0); // revoked kept 0ms → also pruned
  ok('prune_drops_expired_and_old_revoked', removed >= 2 && store.verify(forever.token, T0).ok === true,
    `removed=${removed} shortLivedStillValid=${store.verify(shortLived.token, T0 + 3 * 3_600_000).ok}`);

  // scope policy matrix (deny-by-default)
  ok('read_scope_get_only',
    scopeAllows('read', 'GET', '/agent/workspace') === true &&
    scopeAllows('read', 'POST', '/agent/workspace') === false);
  ok('read_scope_allows_exact_intelligence_posts_only',
    scopeAllows('read', 'POST', '/reference/complete') === true &&
    scopeAllows('read', 'POST', '/reference/xpath-complete') === true &&
    scopeAllows('read', 'POST', '/agent/bulk-transform/preview') === true &&
    scopeAllows('read', 'POST', '/agent/project-rules/prepare-suppression') === true &&
    scopeAllows('read', 'POST', '/agent/bulk-transform/apply') === false &&
    scopeAllows('read', 'POST', '/reference/complete/extra') === false);
  ok('write_scope_allows_workspace_compile_only',
    scopeAllows('write', 'POST', '/agent/workspace') === true &&
    scopeAllows('write', 'POST', '/agent/compile') === true &&
    scopeAllows('write', 'POST', '/agent/artifact/build') === true &&
    scopeAllows('write', 'POST', '/agent/deploy') === false &&
    scopeAllows('write', 'POST', '/fs/write') === false &&
    scopeAllows('write', 'POST', '/ai/keys') === false &&
    scopeAllows('write', 'POST', '/agent/bulk-transform/apply') === true &&
    scopeAllows('write', 'POST', '/agent/project-rules/suppress') === true &&
    scopeAllows('write', 'POST', '/agent/bulk-transform/apply/extra') === false);
  ok('deploy_scope_has_exact_deploy_not_future_prefix_power',
    scopeAllows('deploy', 'POST', '/agent/deploy') === true &&
    scopeAllows('deploy', 'POST', '/agent/deploy/future') === false &&
    scopeAllows('deploy', 'GET', '/agent/unreviewed-future-route') === false);
  ok('no_scope_can_manage_keys',
    (['read', 'write', 'deploy'] as AgentKeyScope[]).every(
      (s) => scopeAllows(s, 'POST', '/agent/keys') === false && scopeAllows(s, 'GET', '/agent/keys') === false));
  ok('no_scope_can_spend_stored_github_authority',
    (['read', 'write', 'deploy'] as AgentKeyScope[]).every(
      (s) => scopeAllows(s, 'GET', '/github/credential') === false &&
             scopeAllows(s, 'POST', '/github/push') === false &&
             scopeAllows(s, 'DELETE', '/github/credential') === false));
  ok('no_agent_key_scope_can_prepare_or_verify_steam_uploads',
    (['read', 'write', 'deploy'] as AgentKeyScope[]).every(
      (s) => scopeAllows(s, 'POST', '/agent/release/steam/prepare') === false &&
             scopeAllows(s, 'POST', '/agent/release/steam/verify') === false &&
             scopeAllows(s, 'POST', '/agent/release/steam/adopt') === false));
  ok('no_agent_key_scope_can_claim_user_export_receipt',
    (['read', 'write', 'deploy'] as AgentKeyScope[]).every(
      (s) => scopeAllows(s, 'POST', '/agent/release/export/receipt') === false));
  ok('no_agent_key_scope_can_cross_workspace_authority',
    (['read', 'write', 'deploy'] as AgentKeyScope[]).every(
      (s) => scopeAllows(s, 'GET', '/agent/workspace/parked') === false &&
             scopeAllows(s, 'POST', '/agent/workspace/restore-parked') === false));
  ok('write_scope_can_prepare_local_nexus_artifact',
    scopeAllows('write', 'POST', '/agent/release/nexus/prepare') === true);
  ok('no_scope_can_change_standing_credentials_or_configuration',
    (['read', 'write', 'deploy'] as AgentKeyScope[]).every(
      (s) => scopeAllows(s, 'GET', '/ai/keys/status') === false &&
             scopeAllows(s, 'POST', '/ai/keys') === false &&
             scopeAllows(s, 'GET', '/schema/config') === false &&
             scopeAllows(s, 'POST', '/schema/config') === false &&
             scopeAllows(s, 'GET', '/studio/layout') === false &&
             scopeAllows(s, 'POST', '/studio/release-preferences') === false));
  ok('workspace_plural_does_not_inherit_singular_write_grant',
    scopeAllows('write', 'POST', '/agent/workspaces') === false &&
    scopeAllows('read', 'POST', '/agent/workspaces/bootstrap') === true);
  // B64-SEC1: no agent-key scope may reach the dev-only exec route on ANY method (the
  // blanket-GET grant used to leak GET /run_command RCE to read keys). Session token only.
  ok('no_scope_can_exec_commands',
    (['read', 'write', 'deploy'] as AgentKeyScope[]).every(
      (s) => scopeAllows(s, 'GET', '/run_command') === false &&
             scopeAllows(s, 'POST', '/run_command/job') === false &&
             scopeAllows(s, 'GET', '/run_command/job/abc') === false));
  // guard against over-restriction: a benign read GET is still allowed for the read scope
  ok('read_scope_still_reads_normal_gets',
    scopeAllows('read', 'GET', '/agent/schema') === true &&
    scopeAllows('read', 'GET', '/agent/workspace') === true);

  // persistence round-trip (real temp file)
  try {
    const tmpFile = path.join(os.tmpdir(), `x4-agent-keys-selftest-${process.pid}.json`);
    try { fs.rmSync(tmpFile, { force: true }); } catch { /* ignore */ }
    const s1 = createAgentKeyStore({ file: tmpFile, now: () => T0 });
    const k = s1.create('persisted', 'read', null);
    const s2 = createAgentKeyStore({ file: tmpFile, now: () => T0 });
    ok('persistence_round_trip', s2.verify(k.token, T0).ok === true);
    const fileRaw = fs.readFileSync(tmpFile, 'utf8');
    ok('file_never_contains_plaintext', !fileRaw.includes(k.token));

    const injected = createAgentKeyStore({
      file: tmpFile,
      now: () => T0 + 1,
      writeJson: () => { throw new Error('injected durable failure'); },
    });
    const beforeInjected = JSON.stringify(injected.list());
    let createFailed = false;
    try { injected.create('must-not-exist', 'read', null); } catch (error) { createFailed = /injected durable failure/.test(String(error)); }
    ok('failed_create_rolls_back_memory', createFailed && JSON.stringify(injected.list()) === beforeInjected);
    let revokeFailed = false;
    try { injected.revoke(k.record.id); } catch (error) { revokeFailed = /injected durable failure/.test(String(error)); }
    ok('failed_revoke_rolls_back_memory', revokeFailed && injected.verify(k.token, T0 + 1).ok === true);
    injected.touch(k.record.id, T0 + 2);
    ok('failed_touch_rolls_back_audit_without_blocking_auth', JSON.stringify(injected.list()) === beforeInjected);

    const writeInvalidStore = (text: string) => fs.writeFileSync(tmpFile, text, 'utf8');
    writeInvalidStore('{corrupt');
    const corrupt = createAgentKeyStore({ file: tmpFile, now: () => T0 + 3 });
    const corruptBytes = fs.readFileSync(tmpFile, 'utf8');
    let corruptCreateRejected = false;
    try { corrupt.create('must-not-overwrite', 'read', null); } catch (error) { corruptCreateRejected = /refusing to overwrite/.test(String(error)); }
    ok('corrupt_store_refuses_mutation', corruptCreateRejected && fs.readFileSync(tmpFile, 'utf8') === corruptBytes);
    writeInvalidStore('{"keys":"not-an-array"}');
    const invalidShape = createAgentKeyStore({ file: tmpFile, now: () => T0 + 4 });
    let invalidShapeRejected = false;
    try { invalidShape.create('must-not-overwrite-shape', 'read', null); } catch (error) { invalidShapeRejected = /invalid shape/.test(String(error)); }
    ok('invalid_shape_refuses_mutation', invalidShapeRejected && fs.readFileSync(tmpFile, 'utf8') === '{"keys":"not-an-array"}');
    writeInvalidStore('{"version":1,"keys":[{"id":"broken"}]}');
    const invalidRecord = createAgentKeyStore({ file: tmpFile, now: () => T0 + 5 });
    let invalidRecordRejected = false;
    try { invalidRecord.create('must-not-overwrite-record', 'read', null); } catch (error) { invalidRecordRejected = /invalid shape/.test(String(error)); }
    ok('invalid_record_refuses_mutation', invalidRecordRejected && invalidRecord.verify(k.token, T0 + 5).reason === 'unknown');
    try { fs.rmSync(tmpFile, { force: true }); } catch { /* ignore */ }
  } catch (e) {
    ok('persistence_round_trip', false, String(e));
  }

  for (const check of runAgentRouteAuthoritySelftest().checks) {
    ok(`route_authority_${check.name}`, check.pass, check.detail);
  }

  return { pass: checks.every((c) => c.pass), checks };
}
