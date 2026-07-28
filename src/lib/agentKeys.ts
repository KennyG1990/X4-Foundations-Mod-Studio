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

export type AgentKeyScope = 'read' | 'write' | 'deploy';

export interface AgentKeyRecord {
  id: string;
  label: string;
  scope: AgentKeyScope;
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
  reason?: 'unknown' | 'expired' | 'revoked';
}

export interface AgentKeyStore {
  create(label: string, scope: AgentKeyScope, ttlMs: number | null): { token: string; record: AgentKeyRecord };
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

interface StoreOptions {
  /** JSON persistence path; empty string = in-memory only (tests). */
  file: string;
  now?: () => number;
  /** Injected randomness for deterministic tests; default crypto.randomBytes. */
  randomHex?: (bytes: number) => string;
}

export function createAgentKeyStore(opts: StoreOptions): AgentKeyStore {
  const now = opts.now || (() => Date.now());
  const randomHex = opts.randomHex || ((n: number) => crypto.randomBytes(n).toString('hex'));
  let records: AgentKeyRecord[] = [];

  // ---- persistence (atomic write, tolerant read — same posture as workspaceState) ----
  function load(): void {
    if (!opts.file) return;
    try {
      const raw = fs.readFileSync(opts.file, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed?.keys)) records = parsed.keys;
    } catch {
      /* first boot or unreadable — start empty; never crash auth on a bad file */
    }
  }
  function save(): void {
    if (!opts.file) return;
    try {
      fs.mkdirSync(path.dirname(opts.file), { recursive: true });
      const tmp = `${opts.file}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify({ version: 1, keys: records }, null, 2), 'utf8');
      fs.renameSync(tmp, opts.file);
    } catch {
      /* persistence best-effort; in-memory keys still work this session */
    }
  }
  load();

  return {
    create(label: string, scope: AgentKeyScope, ttlMs: number | null) {
      const at = now();
      const token = AGENT_KEY_PREFIX + randomHex(32);
      const record: AgentKeyRecord = {
        id: `key_${at.toString(36)}_${randomHex(4)}`,
        label: String(label || 'unnamed').slice(0, 60),
        scope,
        tokenHash: hashAgentKey(token),
        createdAt: at,
        expiresAt: ttlMs === null ? null : at + Math.max(60_000, ttlMs),
        lastUsedAt: null,
        useCount: 0,
        revokedAt: null,
      };
      records.push(record);
      save();
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
      return { ok: true, id: rec.id, label: rec.label, scope: rec.scope };
    },

    revoke(id: string): boolean {
      const rec = records.find((r) => r.id === id);
      if (!rec || rec.revokedAt !== null) return false;
      rec.revokedAt = now();
      save();
      return true;
    },

    list() {
      return records.map(({ tokenHash, ...rest }) => ({ ...rest, hashPrefix: tokenHash.slice(0, 8) }));
    },

    touch(id: string, atMs?: number) {
      const rec = records.find((r) => r.id === id);
      if (!rec) return;
      rec.lastUsedAt = atMs ?? now();
      rec.useCount += 1;
      save();
    },

    prune(atMs?: number, keepRevokedMs = 30 * 86_400_000): number {
      const at = atMs ?? now();
      const before = records.length;
      records = records.filter((r) => {
        if (r.revokedAt !== null) return at - r.revokedAt < keepRevokedMs;
        if (r.expiresAt !== null && at >= r.expiresAt) return false;
        return true;
      });
      if (records.length !== before) save();
      return before - records.length;
    },
  };
}

// ---------------------------------------------------------------------------
// Scope enforcement policy (used by server authMiddleware; deny-by-default).
// ---------------------------------------------------------------------------

/** Non-GET path prefixes (relative to /api) a 'write' key may call. */
export const WRITE_SCOPE_POST_PREFIXES = [
  '/agent/workspace',
  '/agent/compile',
  '/agent/package',
  '/agent/artifact/',
  '/agent/project/',
  '/agent/simulate',
  '/agent/probe/preview',
] as const;

/** Exact POST routes that are read-only despite using a body for cursor/content context. */
export const READ_SCOPE_POST_PATHS = new Set([
  '/reference/complete',
  '/reference/hover',
  '/reference/xpath-complete',
  '/reference/simulate-diff',
  '/agent/bulk-transform/preview',
]);

/** Exact mutation routes added outside the older broad workspace prefixes. */
export const WRITE_SCOPE_POST_PATHS = new Set([
  '/agent/bulk-transform/apply',
]);

/** Key management is session-token-only for EVERY scope. */
export const KEY_MANAGEMENT_PREFIX = '/agent/keys';

/**
 * Arbitrary command execution (dev-only run_command route + its async jobs) is
 * session-token-only for EVERY scope. B64-SEC1 (2026-07-18): the blanket-GET grant
 * below would otherwise let a read-scoped key reach `GET /api/run_command?cmd=…`
 * (which runs exec()) — a scope-integrity break the POST-only matrix never covered.
 * Covers `/run_command`, `/run_command/job` (POST) and `/run_command/job/:id` (GET).
 */
export const EXEC_PREFIX = '/run_command';

/**
 * Is `method path` allowed for `scope`? (path is express req.path under /api.)
 * Deny-by-default: anything not explicitly granted for the scope is refused.
 */
export function scopeAllows(scope: AgentKeyScope, method: string, reqPath: string): boolean {
  if (reqPath.startsWith(KEY_MANAGEMENT_PREFIX)) return false; // never via agent key
  if (reqPath.startsWith(EXEC_PREFIX)) return false; // B64-SEC1: exec is session-token-only, even on GET
  const m = method.toUpperCase();
  if (m === 'GET' || m === 'HEAD' || m === 'OPTIONS') return true; // all scopes read
  if (m === 'POST' && READ_SCOPE_POST_PATHS.has(reqPath)) return true;
  if (scope === 'read') return false;
  if (scope === 'deploy') return true; // full API power (minus key mgmt above)
  // scope === 'write'
  return WRITE_SCOPE_POST_PATHS.has(reqPath) || WRITE_SCOPE_POST_PREFIXES.some((p) => reqPath.startsWith(p));
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
    scopeAllows('write', 'POST', '/agent/bulk-transform/apply/extra') === false);
  ok('deploy_scope_full_power', scopeAllows('deploy', 'POST', '/agent/deploy') === true);
  ok('no_scope_can_manage_keys',
    (['read', 'write', 'deploy'] as AgentKeyScope[]).every(
      (s) => scopeAllows(s, 'POST', '/agent/keys') === false && scopeAllows(s, 'GET', '/agent/keys') === false));
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
    try { fs.rmSync(tmpFile, { force: true }); } catch { /* ignore */ }
  } catch (e) {
    ok('persistence_round_trip', false, String(e));
  }

  return { pass: checks.every((c) => c.pass), checks };
}
