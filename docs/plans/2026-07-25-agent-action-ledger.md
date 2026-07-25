# Agent Action Ledger — a human-readable history of what agents did

Task: B86 agent action ledger
Lane: FULL
Status: IMPLEMENTED — awaiting final gates + visual validation

## IMPLEMENTATION NOTES (deltas from the spec, recorded as they happened)

- **`req.path` is MOUNT-RELATIVE** under `app.use("/api", …)`. The first capture middleware matched
  nothing (`0 -> 0` entries) because the allowlist holds full paths while Express supplied `/fs/write`.
  Fixed by matching `req.baseUrl + req.path`; the allowlist stays readable as full paths, which is what a
  reviewer can check against the route definitions. The existing `PUBLIC_READONLY_GETS` had already solved
  this by storing half-paths (`/agent/x`) — a quieter but more confusing answer.
- **The guarded write was extracted, not duplicated.** `writeWorkspaceFileGuarded()` is now the single
  implementation behind both `/api/fs/write` and revert, so "replays through the same validated write path"
  is literally true rather than approximately true. Duplicating those containment checks would have been a
  second security surface.
- **Dropped the synthetic fault injector.** It was dead code the moment a real fault was cheaper: the route
  test replaces the blob directory with a *file*, which makes the store genuinely throw, and asserts the
  underlying write still returns 200 with correct bytes on disk.
- **Revert is captured by the middleware, not by its handler.** `ledgerRouteKind` matches the id-bearing
  revert path by pattern so all capture stays in one place, per the brief.

## WHY

Claude is building `x4_ai_influence` entirely through the agent API. Two hours were lost on 2026-07-25 to
things that would have been one glance in a history panel: a stale workspace snapshot, and a malformed MD file
that silently killed a subsystem. Ken's framing: **Photoshop's history window** — timestamped rows, each
stating the action and its outcome in plain language, inspectable, steppable.

This is diagnostic infrastructure. It is **not** version control — git remains the authoritative history of the
workspace, and the panel must say so.

## RECONCILE (done 2026-07-25 — two brief premises corrected)

1. **`.forge/checkpoints/` is NOT this codebase's mechanism.** The only occurrence of `.forge/` in the entire
   source is `src/lib/artifactPipeline.ts:85`, where `.forge/**` is *excluded* as development metadata. This
   matches `BACKLOG.md` B70: that tree is written by the separate `kennyg.forge-agent` harness extension.
   Building revert on it would couple this panel to a product X4 Forge does not control. **Plan change:** the
   ledger owns its own content-addressed blob store, which it needs for "show raw" regardless — one store, two
   uses, no duplicated snapshot mechanism.
2. **`.snapshots/` cannot serve as the revert substrate either.** `POST /api/fs/snapshot` /
   `restore-snapshot` (`server.ts` ~3566/3626) store and restore **whole-workspace JSON**, not file bytes, so
   they cannot restore an arbitrary `/api/fs/write`. They remain the right tool for workspace-level recovery
   and are untouched by this unit.
3. **No agent-activity log exists.** Searched `src/lib/` and `server.ts` for log/telemetry/audit/history
   engines: `logTelemetry.ts` parses the X4 debug log, `liveLogNav.ts`/`luaRuntimeLog.ts` are game-log
   surfaces, `liveCanvasTelemetry.ts` is canvas perf. Agent keys carry a `lastUsed` touch but no action record.
   Absence proven within that boundary.
4. **Attribution is already available.** `authMiddleware` (`server.ts:353`) resolves `v.label` and `v.id` for
   `x4fk_` keys and has a separate session-token branch. The actor can be attached to the request there; the
   raw token is never stored.
5. **Storage home is `dataPath()`** (`src/lib/dataDir.ts`, B53) so history survives extension updates and can
   never be written into a game folder — the B70 litter class.

## SCOPE

**In scope**
1. `src/lib/agentHistory.ts` — pure engine: row construction, per-route semantic summaries, redaction,
   filtering, size accounting, revertibility rules, JSONL encode/decode. No Express, no globals.
2. A content-addressed blob store under `dataPath('history')`: `ledger.jsonl` + `blobs/<aa>/<sha256>`.
   Rotation at a byte cap with a bounded number of retained segments; blob GC bounded by the same policy.
3. One capture middleware over an **explicit route allowlist**, mounted after `authMiddleware`. Row is built
   and written on `res.on('finish')`. The only hot-path work is the `fs/write` before-read.
4. `describe()` summarizers for the six routes, producing exactly Ken's register.
5. Routes: `GET /api/agent/history`, `GET /api/agent/history/:id/raw`, `POST /api/agent/history/:id/revert`,
   and a public `GET /api/agent/history-selftest` oracle (house pattern).
6. UI: a HISTORY tab on the Agent API screen — reverse-chronological rows, expand for diff + files, filters,
   "Revert to here", and copy stating this is an activity log, not version control.

**Out of scope (deliberate, recorded)**
- **Whole-state Photoshop step-back.** Ken's acceptance criterion is per-entry ("Revert to here on an
  `fs/write` restores the previous content"). True multi-file state-step-back needs CAS conflict handling when
  the workspace has moved on, and is its own unit. Built: per-entry restore. Deferred: state-step-back.
- Reverting deploys (see asymmetry below), imports, or packages.
- Streaming/live-tailing the panel; a poll on open is enough.

## DESIGN

**Row** (one JSONL line):
`id`, `ts`, `agent {kind:'agent'|'studio', label}`, `kind` (edit|import|validate|compile|deploy|package|revert),
`title`, `files[]`, `outcome {status:'ok'|'warn'|'error', code?, stage?}`, `durationMs`, `bytes {before,after}`,
`lines {added,removed}`, `beforeBlob?`, `afterBlob?`, `diffBlob?`, `revertible`, `revertReason?`, `revertOf?`.

**Never inlined.** A 295 KB `aic_uix.lua` write yields a row of a few hundred bytes plus content-addressed
blobs. Identical content is stored once (hash-keyed). Binary paths store `sha256` + `size` only, never bytes,
and are marked non-diffable.

**Summaries** (the point of the feature):
- `fs/write` → ``Edited `md/aic_politics.xml` — +42 / −8 lines``
- `mod-folder/import` → `Re-imported mod from workspace — 49 files, v201`
- `project/validate` → `Validated 27 files — 0 errors, 6 warnings`
- `deploy-verify` fail → ``Deploy BLOCKED at stage 'XML well-formed' — `ai_influence_diplomacy.xml` malformed``
- `package/release` → `Packaged v2.0.1 — 47 files, 3.1 MB`

**Deploy asymmetry, stated honestly.** Deploy rows are `revertible:false`. The panel must NOT point at "the
existing backup": `replaceValidatedDeployment` **deletes the sibling backup on success**, so after a good
deploy no rollback target exists — that backup protects only *during* the transaction. Correct copy is
"redeploy from a previous workspace state".

**Failure isolation.** Every ledger operation is wrapped so a logging fault can never fail, delay, or alter the
underlying request. A ledger write error is counted and surfaced in the panel, never thrown.

## ACCEPTANCE CONTRACT

- Each allowlisted route produces **exactly one** entry; GETs and `/api/reference/*` produce none.
- A 295 KB `fs/write` produces a row under ~1 KB; ledger growth tracks change size, not payload size.
- Every title is understandable unexpanded — no JSON, no stack traces, no script bodies.
- A failed `deploy-verify` names the failing stage and reason in the title.
- "Revert to here" on an `fs/write` restores the previous bytes, passes validation, and appends a `revert` row.
- Entries survive a backend restart; **no API key material appears in stored data** (asserted by scanning the
  written file for the key and its prefix).
- An injected ledger failure leaves the underlying route's status and body unchanged.
- Deploy/import/package rows are non-revertible with a stated reason.
- Rotation caps total size; blobs are deduplicated by hash.
- type/lint/oracle/route/e2e/precommit/build gates pass; validation uses scratch dirs only.

## RISKS AND RECOVERY

- **Latency on `fs/write`** from the before-read. Bounded: single stat+read of the target file only, skipped
  when absent or over a size ceiling (hash-only above it).
- **Disk growth** — mitigated by hash dedup, diff-only rows, a byte cap with rotation, and bounded blob GC.
- **Middleware regression risk on live routes** — highest risk in this unit. Mitigated by allowlist-only
  interception, no body mutation, `finish`-time work, and a negative test proving an injected ledger throw does
  not alter the response.
- **Rollback:** the unit is additive; removing the middleware mount and the routes restores current behavior.

## EVIDENCE LOCATIONS

- Oracle `agent-history-selftest` (summaries, redaction, dedup, rotation, revertibility, no-payload-inlining).
- `scripts/route-integration.mjs`: one-entry-per-call, GET silence, 295 KB row-size proof, restart survival,
  revert round-trip, injected-failure isolation, key-absence scan.
- UI: eyeball script in `SESSION-HANDOFF.md`.
