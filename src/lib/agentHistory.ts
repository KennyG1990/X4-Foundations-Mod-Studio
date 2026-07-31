/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * B86 — the Agent Action Ledger engine.
 *
 * A human-readable record of what agents actually did, in the register of Photoshop's history
 * window: one timestamped row per action, each stating the action and its outcome in a sentence
 * a tired person can skim. Diagnostic infrastructure, NOT version control — git remains the
 * authoritative history of the workspace.
 *
 * THE LOAD-BEARING RULE: payloads are NEVER inlined into a row. Real agent writes in this
 * project run ~295 KB per call (`ui/addons/ai_influence_chat/aic_uix.lua`). Inlining request or
 * response bodies would put hundreds of megabytes into a single session's history and make the
 * panel the thing you avoid opening. A row carries counts, hashes and blob REFERENCES; the bytes
 * live in a content-addressed blob store behind an explicit "show raw" action, deduplicated by
 * hash. Binary files store hash + size only, never bytes.
 *
 * This module is pure: it builds and formats rows and decides policy. All filesystem work lives
 * in the store (`agentHistoryStore.ts`) so every rule here is testable without touching disk.
 */

export type LedgerKind =
  | 'edit' | 'import' | 'validate' | 'compile' | 'deploy' | 'package' | 'revert'
  | 'workspace' | 'generate' | 'snapshot' | 'config' | 'keys' | 'command' | 'action';
export type LedgerStatus = 'ok' | 'warn' | 'error';

export interface LedgerActor {
  /** 'agent' = an x4fk_ API key; 'studio' = the app UI's session token. */
  kind: 'agent' | 'studio';
  /** The key's human label, never the key itself. */
  label: string;
}

export interface LedgerOutcome {
  status: LedgerStatus;
  /** Machine code when the route supplies one (e.g. UNKNOWN_DEPLOY_FORMAT). */
  code?: string;
  /** Failing stage for staged routes (deploy-verify's checklist). */
  stage?: string;
}

export interface LedgerRow {
  id: string;
  ts: string;
  /** ADR-F5: immutable authority for workspace-bound actions. Missing only on legacy/global rows. */
  workspaceId?: string;
  /** Tab provenance for Studio actions; never an authentication credential. */
  clientId?: string;
  agent: LedgerActor;
  kind: LedgerKind;
  title: string;
  files: string[];
  outcome: LedgerOutcome;
  durationMs: number;
  bytes?: { before?: number; after?: number };
  lines?: { added: number; removed: number };
  beforeBlob?: string;
  afterBlob?: string;
  diffBlob?: string;
  binary?: boolean;
  /** B86.1: blob holding this action's diagnostics, shown when the row is expanded. */
  diagnosticsBlob?: string;
  /** B86.1: how many diagnostics that blob holds, so the UI can label the expander. */
  diagnosticsCount?: number;
  /**
   * B86.1: canvas nodes this action touched. Rows become clickable — pick an entry, land on
   * the node it changed — which is what makes this read like Photoshop's history rather than
   * a log file.
   */
  nodes?: Array<{ id: string; label?: string }>;
  /**
   * B93.9: what this action did to files on disk. The reporter maintained a separate deploy
   * script purely because the Forge would not answer "what did you add, overwrite and delete".
   */
  fileEffect?: { added: number; overwritten: number; deleted: number; preserved: number; bytes: number };
  /** B110-R14: one-time CAS recovery receipt owned by the bounded recovery store. */
  recoveryId?: string;
  recoveryKind?: 'workspace' | 'deploy';
  recoveryExpectedHash?: string;
  recoveryExpiresAt?: string;
  revertible: boolean;
  revertReason?: string;
  /** Set on a `revert` row: the id of the entry it undid. */
  revertOf?: string;
}

/**
 * Route classification, DENY-LIST FIRST.
 *
 * This started as an allowlist of six routes taken from the feature brief. That was wrong: the
 * server exposes ~47 mutating endpoints, so the ledger silently recorded a fraction of what
 * agents actually do and the gap was invisible — the panel looked healthy while missing
 * workspace replacements, AI generation, snapshots and shell jobs.
 *
 * Inverted here on purpose. Every mutating `/api` request is recorded UNLESS it is proven
 * read-only analysis (`LEDGER_QUIET_ROUTES`). A new route therefore defaults to being VISIBLE;
 * drift now shows up as an extra row someone can see, never as a silent hole.
 */
export const LEDGER_QUIET_ROUTES: string[] = [
  // Pure analysis/read endpoints that happen to use POST because they take a body. They change
  // no state, and recording them would bury the actions that matter.
  '/api/agent/critic',
  '/api/agent/explain',
  '/api/agent/node-diagnostics',
  '/api/agent/simulate',
  '/api/agent/suggest/expression',
  '/api/agent/xpath-synth',
  '/api/agent/xsd-lookup',
  '/api/agent/round-trip-check',
  '/api/agent/probe/preview',
  '/api/agent/log-diagnose',
  '/api/agent/log-file-tail',
  '/api/agent/live/cue-telemetry',
  '/api/agent/quick-fixes',
  '/api/agent/project/validate-crossfile',
  '/api/agent/project-rules/prepare-suppression',
  '/api/agent/bulk-transform/preview',
  '/api/gemini',
  '/api/gemini/analyze',
  '/api/gemini/analyze-log',
];

/** Exact-path kind mapping. Anything mutating and unlisted still records, as kind `action`. */
export const LEDGER_ROUTES: Array<{ method: string; path: string; kind: LedgerKind }> = [
  { method: 'POST', path: '/api/fs/write', kind: 'edit' },
  { method: 'POST', path: '/api/agent/project-rules/suppress', kind: 'edit' },
  { method: 'POST', path: '/api/fs/create', kind: 'edit' },
  { method: 'POST', path: '/api/fs/delete-dir', kind: 'edit' },
  { method: 'POST', path: '/api/agent/project/file/create', kind: 'edit' },
  { method: 'POST', path: '/api/agent/project/content-xml', kind: 'edit' },
  { method: 'POST', path: '/api/agent/lua-staleness/instrument', kind: 'edit' },
  { method: 'POST', path: '/api/agent/mod-folder/import', kind: 'import' },
  { method: 'POST', path: '/api/agent/project/create', kind: 'import' },
  { method: 'POST', path: '/api/agent/project/validate', kind: 'validate' },
  { method: 'POST', path: '/api/agent/compile', kind: 'compile' },
  { method: 'POST', path: '/api/agent/deploy-verify', kind: 'deploy' },
  { method: 'POST', path: '/api/agent/deploy', kind: 'deploy' },
  { method: 'POST', path: '/api/agent/package/release', kind: 'package' },
  { method: 'POST', path: '/api/agent/release/nexus/prepare', kind: 'package' },
  { method: 'POST', path: '/api/agent/release/steam/prepare', kind: 'package' },
  { method: 'POST', path: '/api/agent/release/steam/verify', kind: 'package' },
  { method: 'POST', path: '/api/agent/release/steam/adopt', kind: 'package' },
  { method: 'POST', path: '/api/agent/release/export/receipt', kind: 'package' },
  { method: 'POST', path: '/api/agent/package', kind: 'package' },
  { method: 'POST', path: '/api/agent/project/package', kind: 'package' },
  { method: 'POST', path: '/api/agent/artifact/build', kind: 'package' },
  { method: 'POST', path: '/api/agent/workspace', kind: 'workspace' },
  { method: 'POST', path: '/api/agent/workspace/merge', kind: 'workspace' },
  { method: 'POST', path: '/api/agent/workspace/restore-parked', kind: 'workspace' },
  { method: 'POST', path: '/api/agent/bulk-transform/apply', kind: 'workspace' },
  { method: 'POST', path: '/api/agent/generate', kind: 'generate' },
  { method: 'POST', path: '/api/agent/project/generate', kind: 'generate' },
  { method: 'POST', path: '/api/fs/snapshot', kind: 'snapshot' },
  { method: 'POST', path: '/api/fs/restore-snapshot', kind: 'snapshot' },
  { method: 'POST', path: '/api/fs/delete-snapshot', kind: 'snapshot' },
  { method: 'POST', path: '/api/schema/config', kind: 'config' },
  { method: 'POST', path: '/api/agent/external-api/register', kind: 'config' },
  { method: 'POST', path: '/api/agent/keys', kind: 'keys' },
  { method: 'POST', path: '/api/agent/keys/revoke', kind: 'keys' },
  { method: 'POST', path: '/api/ai/keys', kind: 'keys' },
  { method: 'POST', path: '/api/run_command/job', kind: 'command' },
];

/**
 * The revert route carries an id in its path, so it cannot be matched by exact string. It is
 * kept here rather than logged inside its handler so that ALL capture stays in the one
 * middleware — a revert is a recorded step like any other.
 */
export const LEDGER_REVERT_PATTERN = /^\/api\/agent\/history\/[A-Za-z0-9._-]+\/revert$/;

export function ledgerRouteKind(method: string, path: string): LedgerKind | null {
  const upper = method.toUpperCase();
  // Reads are never recorded, whatever the route.
  if (upper === 'GET' || upper === 'HEAD' || upper === 'OPTIONS') return null;
  if (!path.startsWith('/api/')) return null;
  // The ledger's own surface must not record itself (revert is the deliberate exception).
  if (upper === 'POST' && LEDGER_REVERT_PATTERN.test(path)) return 'revert';
  if (path.startsWith('/api/agent/history')) return null;
  // The canonical-corpus read API is read-only whatever verb is used against it.
  if (path.startsWith('/api/reference/')) return null;
  // Proven read-only analysis stays quiet so it cannot bury the actions that matter.
  if (LEDGER_QUIET_ROUTES.includes(path)) return null;
  const hit = LEDGER_ROUTES.find(r => r.method === upper && r.path === path);
  if (hit) return hit.kind;
  // Unclassified but mutating: record it anyway. A visible generic row beats a silent gap.
  return 'action';
}

/**
 * Only a file edit can be undone by replaying bytes. Deploys mutate the game directory and are
 * NOT trivially revertible: `replaceValidatedDeployment` deletes its sibling backup on success,
 * so after a good deploy there is no rollback target sitting there — that backup protects only
 * during the transaction. Saying "use the backup" would be a lie; the honest instruction is to
 * redeploy from a previous workspace state.
 */
export function revertibility(kind: LedgerKind, outcome: LedgerOutcome, hasBeforeBlob: boolean, hasRecovery: boolean = false): { revertible: boolean; reason?: string } {
  if (kind === 'edit') {
    if (outcome.status === 'error') return { revertible: false, reason: 'The edit failed, so there is nothing to undo.' };
    if (!hasBeforeBlob) return { revertible: false, reason: 'No previous content was captured (the file did not exist before this write).' };
    return { revertible: true };
  }
  if (kind === 'deploy') {
    if (outcome.status !== 'error' && hasRecovery) return { revertible: true };
    return {
      revertible: false,
      reason: outcome.status === 'error'
        ? 'The deploy did not complete, so there is no successful deployment to undo.'
        : 'This deploy has no retained recovery snapshot. Transaction rollback protects a failed deploy but is not later undo.',
    };
  }
  if (kind === 'workspace' && outcome.status !== 'error' && hasRecovery) return { revertible: true };
  if (kind === 'revert') return { revertible: false, reason: 'A revert is itself a recorded step; revert the newer entry instead.' };
  if (kind === 'import') return { revertible: false, reason: 'The import API returns a candidate workspace. Studio checkpoints the canvas before applying it; use local Undo there.' };
  if (kind === 'package') return { revertible: false, reason: 'Packaging produces a build artifact and changes no source.' };
  return { revertible: false, reason: 'This action changed no files.' };
}

/** Files above this never get a stored copy or a diff — hash + size only. */
export const MAX_DIFFABLE_BYTES = 2 * 1024 * 1024;

/** Heuristic: NUL byte in the first block means binary. Cheap and good enough for this purpose. */
export function looksBinary(sample: Buffer | Uint8Array): boolean {
  const bytes = sample instanceof Buffer ? sample : Buffer.from(sample);
  const limit = Math.min(bytes.length, 8000);
  for (let i = 0; i < limit; i++) if (bytes[i] === 0) return true;
  return false;
}

/**
 * Added/removed line counts via a bounded LCS. This drives the "+42 / −8 lines" summary; it is
 * deliberately count-only. The full unified diff is produced separately and stored as a blob.
 */
export function lineDelta(before: string, after: string): { added: number; removed: number } {
  if (before === after) return { added: 0, removed: 0 };
  const a = before.length ? before.split(/\r?\n/) : [];
  const b = after.length ? after.split(/\r?\n/) : [];
  // Guard the quadratic table. Very large files fall back to a coarse count rather than
  // spending seconds on an exact LCS for a summary line.
  if (a.length * b.length > 4_000_000) {
    const common = Math.min(a.length, b.length);
    return { added: Math.max(0, b.length - common), removed: Math.max(0, a.length - common) };
  }
  const table: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      table[i][j] = a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  let i = 0, j = 0, added = 0, removed = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; }
    else if (table[i + 1][j] >= table[i][j + 1]) { removed++; i++; }
    else { added++; j++; }
  }
  removed += a.length - i;
  added += b.length - j;
  return { added, removed };
}

/** A minimal unified diff, stored as a blob and shown only on "show raw". */
export function unifiedDiff(before: string, after: string, filePath: string): string {
  // An identical rewrite has no diff payload. Without this fast path the simple
  // formatter emits every unchanged line as context, creating a second blob as
  // large as the source even though the content-addressed source blob deduplicates.
  if (before === after) return `--- a/${filePath}\n+++ b/${filePath}`;
  const a = before.length ? before.split(/\r?\n/) : [];
  const b = after.length ? after.split(/\r?\n/) : [];
  const out = [`--- a/${filePath}`, `+++ b/${filePath}`];
  let i = 0, j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) { out.push(` ${a[i]}`); i++; j++; continue; }
    if (j < b.length && (i >= a.length || a[i] !== b[j])) {
      const removedHere = i < a.length && !b.includes(a[i], j);
      if (removedHere) { out.push(`-${a[i]}`); i++; }
      else { out.push(`+${b[j]}`); j++; }
      continue;
    }
    if (i < a.length) { out.push(`-${a[i]}`); i++; }
  }
  return out.join('\n');
}

function shortPath(filePath: string): string {
  const normalized = String(filePath || '').replace(/\\/g, '/');
  const parts = normalized.split('/').filter(Boolean);
  return parts.length <= 3 ? normalized : `…/${parts.slice(-3).join('/')}`;
}

function humanBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '0 B';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * The semantic summary — the core of this feature. One line per action, in the register Ken
 * specified: what happened and how it turned out, never JSON, never a stack trace, never a
 * script body. Each branch is fed the already-parsed response, so this stays pure.
 */
export function describeAction(input: {
  kind: LedgerKind;
  status: number;
  body?: any;
  request?: any;
  files: string[];
  lines?: { added: number; removed: number };
  binary?: boolean;
  bytes?: { before?: number; after?: number };
  revertOfTitle?: string;
  /** Full route path, so generic and family summaries can distinguish siblings. */
  routePath?: string;
  nodes?: Array<{ id: string; label?: string }>;
}): { title: string; outcome: LedgerOutcome } {
  const { kind, status, body, request, files } = input;
  const httpFailed = status >= 400;
  const target = files.length === 1 ? shortPath(files[0]) : `${plural(files.length, 'file')}`;

  if (kind === 'edit') {
    if (httpFailed) {
      return {
        title: `Edit REFUSED — \`${target}\`: ${cleanReason(body)}`,
        outcome: { status: 'error', code: body?.code },
      };
    }
    if (input.binary) {
      return {
        title: `Wrote binary \`${target}\` — ${humanBytes(input.bytes?.after ?? 0)}`,
        outcome: { status: 'ok' },
      };
    }
    const d = input.lines || { added: 0, removed: 0 };
    if (d.added === 0 && d.removed === 0) {
      return { title: `Wrote \`${target}\` — no content change`, outcome: { status: 'ok' } };
    }
    return {
      title: `Edited \`${target}\` — +${d.added} / −${d.removed} lines`,
      outcome: { status: 'ok' },
    };
  }

  if (kind === 'import') {
    if (httpFailed) return { title: `Import FAILED — ${cleanReason(body)}`, outcome: { status: 'error', code: body?.code } };
    const ws = body?.workspace || {};
    const fileCount = (ws.passthroughFiles?.length ?? 0) + (ws.nodes?.length ? 0 : 0);
    const counted = body?.classification?.total ?? body?.fileCount ?? fileCount;
    const root = request?.root ? ` from ${request.root}` : '';
    const version = ws.version ? `, v${ws.version}` : '';
    const nodes = ws.nodes?.length ? `${plural(ws.nodes.length, 'node')}` : '';
    const size = counted ? `${plural(counted, 'file')}` : nodes;
    return {
      title: `Re-imported mod${root} — ${size}${version}`.replace(/ — $/, ''),
      outcome: { status: 'ok' },
    };
  }

  if (kind === 'validate') {
    if (httpFailed) return { title: `Validation call FAILED — ${cleanReason(body)}`, outcome: { status: 'error', code: body?.code } };
    const s = body?.summary || {};
    const errors = numberish(s.schemaErrors) + numberish(s.unresolvedCueRefs) + numberish(s.crossFileErrors) + numberish(s.aiscriptErrors);
    const warnings = numberish(s.schemaWarnings) + numberish(s.scriptPropertyWarnings) + numberish(s.mdPitfallWarnings);
    const scanned = numberish(body?.fileCount ?? s.files ?? files.length);
    const scope = scanned ? `Validated ${plural(scanned, 'file')}` : 'Validated project';
    // A count alone is useless: "1 error" does not tell you WHICH error, which is the whole
    // reason this panel exists. Name the first one — file, line, message — the same way the
    // deploy row names its failing stage.
    const worst = firstDiagnostic(body, 'error');
    if (errors > 0 && worst) {
      const more = errors > 1 ? ` (+${errors - 1} more)` : '';
      return {
        title: `${scope} — ${plural(errors, 'error')}: ${describeDiagnostic(worst)}${more}`,
        outcome: { status: 'error', code: worst.code },
      };
    }
    if (errors > 0) {
      return { title: `${scope} — ${plural(errors, 'error')}, ${plural(warnings, 'warning')}`, outcome: { status: 'error' } };
    }
    if (warnings > 0 && !firstDiagnostic(body, 'warning')) {
      return { title: `${scope} — 0 errors, ${plural(warnings, 'warning')}`, outcome: { status: 'warn' } };
    }
    const firstWarning = warnings > 0 ? firstDiagnostic(body, 'warning') : null;
    if (firstWarning) {
      const more = warnings > 1 ? ` (+${warnings - 1} more)` : '';
      return {
        title: `${scope} — ${plural(warnings, 'warning')}: ${describeDiagnostic(firstWarning)}${more}`,
        outcome: { status: 'warn', code: firstWarning.code },
      };
    }
    return { title: `${scope} — 0 errors, 0 warnings`, outcome: { status: 'ok' } };
  }

  if (kind === 'workspace') {
    if (input.routePath === '/api/agent/bulk-transform/apply') {
      if (httpFailed) return { title: `Bulk transform REFUSED — ${cleanReason(body)}`, outcome: { status: 'error', code: body?.error || body?.code } };
      const count = numberish(body?.added ?? body?.plan?.matchedFiles);
      const operation = String(body?.plan?.rule?.operation || request?.rule?.operation || 'numeric');
      return { title: `Added ${plural(count, 'validated XML patch')} — canonical ${operation} transform`, outcome: { status: 'ok' } };
    }
    if (httpFailed) return { title: `Workspace update REFUSED — ${cleanReason(body)}`, outcome: { status: 'error', code: body?.code } };
    const nodeCount = numberish(request?.workspace?.nodes?.length);
    const name = request?.workspace?.name ? ` "${request.workspace.name}"` : '';
    const changed = input.nodes?.length ? ` — ${plural(input.nodes.length, 'node')} changed` : '';
    return { title: `Replaced the working canvas${name} (${plural(nodeCount, 'node')})${changed}`, outcome: { status: 'ok' } };
  }

  if (kind === 'generate') {
    if (httpFailed) return { title: `AI generation FAILED — ${cleanReason(body)}`, outcome: { status: 'error', code: body?.code } };
    const prompt = typeof request?.prompt === 'string' ? firstSentence(request.prompt) : '';
    const repaired = numberish(body?.repair?.attempts);
    const suffix = repaired ? ` (${plural(repaired, 'repair pass', 'repair passes')})` : '';
    return {
      title: prompt ? `AI generated from: "${truncate(prompt, 80)}"${suffix}` : `AI generation completed${suffix}`,
      outcome: { status: 'ok' },
    };
  }

  if (kind === 'snapshot') {
    if (httpFailed) return { title: `Snapshot action FAILED — ${cleanReason(body)}`, outcome: { status: 'error', code: body?.code } };
    const modId = request?.modId ? ` for ${request.modId}` : '';
    if (/restore/.test(input.routePath || '')) return { title: `Restored a workspace snapshot${modId}`, outcome: { status: 'ok' } };
    if (/delete/.test(input.routePath || '')) return { title: `Deleted a workspace snapshot${modId}`, outcome: { status: 'ok' } };
    return { title: `Saved a workspace snapshot${modId}`, outcome: { status: 'ok' } };
  }

  if (kind === 'config') {
    if (httpFailed) return { title: `Settings change REFUSED — ${cleanReason(body)}`, outcome: { status: 'error', code: body?.code } };
    const touched = Object.keys(request || {}).filter(k => k !== 'schemaFiles');
    return {
      title: touched.length ? `Changed settings: ${touched.slice(0, 4).join(', ')}` : 'Changed studio settings',
      outcome: { status: 'ok' },
    };
  }

  if (kind === 'keys') {
    // Never record key material — only that a key's lifecycle changed, and its label.
    if (httpFailed) return { title: `Key operation FAILED — ${cleanReason(body)}`, outcome: { status: 'error', code: body?.code } };
    const label = typeof request?.label === 'string' ? ` "${request.label}"` : '';
    if (/revoke/.test(input.routePath || '')) return { title: `Revoked an agent key${label}`, outcome: { status: 'ok' } };
    return { title: `Created or updated a stored key${label}`, outcome: { status: 'ok' } };
  }

  if (kind === 'command') {
    const cmd = typeof request?.cmd === 'string' ? truncate(request.cmd.replace(/\s+/g, ' ').trim(), 90) : '';
    if (httpFailed) return { title: `Shell command REFUSED — ${cleanReason(body)}`, outcome: { status: 'error', code: body?.code } };
    return { title: cmd ? `Ran shell command: ${cmd}` : 'Ran a shell command', outcome: { status: 'ok' } };
  }

  if (kind === 'compile') {
    if (httpFailed) return { title: `Compile FAILED — ${cleanReason(body)}`, outcome: { status: 'error', code: body?.code } };
    const emitted = numberish(body?.fileCount ?? Object.keys(body?.files || {}).length);
    const errs = Array.isArray(body?.errors) ? body.errors.length : 0;
    return {
      title: `Compiled ${plural(emitted, 'file')} — ${plural(errs, 'error')}`,
      outcome: { status: errs > 0 ? 'error' : 'ok' },
    };
  }

  if (kind === 'deploy') {
    // A dry run changed nothing; say so plainly rather than implying a deploy happened.
    if (body?.dryRun === true) {
      const e = body?.effect || {};
      return {
        title: `Deploy PREVIEW (nothing written) — would add ${(e.added || []).length}, overwrite ${(e.overwritten || []).length}, delete ${(e.deleted || []).length}`,
        outcome: { status: (e.deleted || []).length ? 'warn' : 'ok' },
      };
    }
    // A blocked deploy must name the failing stage and reason IN THE TITLE — this exact row is
    // the two hours the panel exists to save.
    const checklist: Array<{ id: string; label: string; status: string; detail: string }> = body?.checklist || [];
    const failed = checklist.find(c => c.status === 'fail');
    if (httpFailed || body?.ok === false) {
      if (failed) {
        return {
          title: `Deploy BLOCKED at stage '${failed.label}' — ${firstSentence(failed.detail)}`,
          outcome: { status: 'error', stage: failed.id, code: body?.code },
        };
      }
      return {
        title: `Deploy FAILED — ${cleanReason(body)}`,
        outcome: { status: 'error', stage: body?.stage, code: body?.code },
      };
    }
    const format = body?.deployFormat?.mode ? ` as ${body.deployFormat.mode === 'catalog' ? 'CAT/DAT' : 'loose files'}` : '';
    const count = numberish(body?.artifact?.outputFiles ?? body?.artifact?.includedFiles);
    const warned = checklist.some(c => c.status === 'warn');
    return {
      title: `Deployed ${body?.modId || 'mod'}${format} — ${plural(count, 'file')}${warned ? ' (with warnings)' : ''}`,
      outcome: { status: warned ? 'warn' : 'ok' },
    };
  }

  if (kind === 'package') {
    if (httpFailed || body?.ok === false) return { title: `Packaging FAILED — ${cleanReason(body)}`, outcome: { status: 'error', code: body?.code } };
    const version = body?.version ? ` v${body.version}` : '';
    const count = numberish(body?.fileCount ?? body?.files?.length);
    const size = body?.bytes ? ` , ${humanBytes(body.bytes)}` : '';
    return {
      title: `Packaged${version} — ${plural(count, 'file')}${size}`.replace(' , ', ', '),
      outcome: { status: 'ok' },
    };
  }

  if (kind === 'revert') {
    return {
      title: input.revertOfTitle
        ? `Reverted: ${input.revertOfTitle}`
        : `Reverted \`${target}\` to its previous content`,
      outcome: { status: httpFailed ? 'error' : 'ok' },
    };
  }

  // Generic mutating route with no bespoke summary yet. Deliberately still recorded: an
  // unglamorous row a reader can see beats a silent gap in the history.
  const routeLabel = (input.routePath || '').replace(/^\/api\//, '');
  if (httpFailed) {
    return { title: `${routeLabel} FAILED — ${cleanReason(body)}`, outcome: { status: 'error', code: body?.code } };
  }
  return { title: `Ran ${routeLabel}`, outcome: { status: 'ok' } };
}

/** One diagnostic rendered as a readable clause: where it is, then what is wrong. */
export function describeDiagnostic(d: { filePath?: string; line?: number; message?: string; code?: string }): string {
  const where = d.filePath ? `${shortPath(d.filePath)}${d.line ? `:${d.line}` : ''}` : '';
  const what = firstSentence(String(d.message || d.code || 'no detail given'));
  return where ? `${where} — ${what}` : what;
}

/**
 * The first diagnostic of a given severity from a validation response. Reads the `flat` list —
 * the project's single diagnostic currency — so this stays correct as individual lint layers
 * come and go.
 */
export function firstDiagnostic(body: any, severity: 'error' | 'warning'): { filePath?: string; line?: number; message?: string; code?: string; sourceRef?: string } | null {
  const flat = Array.isArray(body?.flat) ? body.flat : [];
  const hit = flat.find((d: any) => d && d.severity === severity);
  return hit || null;
}

/** Compact diagnostics for storage/expansion — bounded so a noisy project cannot bloat a blob. */
export function compactDiagnostics(body: any, limit = 200): Array<{ severity: string; code?: string; filePath?: string; line?: number; message: string }> {
  const flat = Array.isArray(body?.flat) ? body.flat : [];
  return flat.slice(0, limit).map((d: any) => ({
    severity: String(d?.severity || 'info'),
    code: d?.code,
    filePath: d?.filePath,
    line: d?.line,
    message: redactSecrets(String(d?.message || '')),
  }));
}

function truncate(text: string, max: number): string {
  const flat = String(text || '').replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

function numberish(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Turn an error payload into one readable clause. Strips stack traces, collapses whitespace and
 * truncates — a title must never become a wall of text or leak a script body.
 */
export function cleanReason(body: any): string {
  const raw = typeof body === 'string' ? body : (body?.error || body?.message || body?.reason || 'no reason given');
  return firstSentence(String(raw));
}

export function firstSentence(text: string): string {
  const flat = String(text || '').replace(/\s+/g, ' ').trim();
  const cut = flat.split(/(?<=[.!?])\s/)[0] || flat;
  return cut.length > 160 ? `${cut.slice(0, 157)}…` : cut;
}

/**
 * Defence in depth for the "no key material is ever stored" contract. The middleware never
 * copies the Authorization header, but any string heading for disk passes through here too, so
 * a future careless summary cannot leak a token.
 */
export function redactSecrets(text: string): string {
  return String(text ?? '')
    .replace(/x4fk_[A-Za-z0-9]+/g, '[redacted-key]')
    .replace(/\b[a-f0-9]{64}\b/gi, match => `${match.slice(0, 8)}…`)
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [redacted]');
}

export function encodeRow(row: LedgerRow): string {
  const safe: LedgerRow = { ...row, title: redactSecrets(row.title) };
  return JSON.stringify(safe);
}

export function decodeRows(jsonl: string): LedgerRow[] {
  const rows: LedgerRow[] = [];
  for (const line of String(jsonl || '').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed);
      // A truncated final line (crash mid-append) must not poison the whole history.
      if (parsed && typeof parsed.id === 'string') rows.push(parsed);
    } catch { /* skip a torn line, keep the rest */ }
  }
  return rows;
}

export function filterRows(rows: LedgerRow[], filter: { kind?: string; outcome?: string; file?: string; limit?: number }): LedgerRow[] {
  let out = rows;
  if (filter.kind) out = out.filter(r => r.kind === filter.kind);
  if (filter.outcome) out = out.filter(r => r.outcome?.status === filter.outcome);
  if (filter.file) {
    const needle = filter.file.replace(/\\/g, '/').toLowerCase();
    out = out.filter(r => (r.files || []).some(f => f.replace(/\\/g, '/').toLowerCase().includes(needle)));
  }
  // Newest first — the panel reads top-down like Photoshop's history.
  out = [...out].reverse();
  const limit = Number(filter.limit);
  return Number.isFinite(limit) && limit > 0 ? out.slice(0, limit) : out;
}
