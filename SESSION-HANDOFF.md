# X4 Forge — Native Extension Close Handoff

Updated: 2026-08-06 America/New_York

## One-line state

The W3B1a snapshot-restore receipt subunit is `VERIFIED` as route `4/5`: exact contained snapshot source authority,
paired CAS, one registry commit, recovery-backed compensation, persisted receipt before success, replay/conflict,
redaction, fault injection, governance promotion, precommit, and fresh `467/467` route containment are green. Bulk-
transform apply is the remaining W3B1a route. W3B1, W3, and the extension-native program remain
`IN_PROGRESS / PARTIAL`.

## Operator brief

- **Project:** `F:\DEV_ENV\X4_Forge`, the Forge extension and its integrated Studio/managed-sidecar/API surfaces.
- **Eyeball queue:** none for this bounded checkpoint. It adds no visible control; installed/rendered proof remains a
  W3C gate. Full W3B1a E2E is deliberately deferred until bulk apply completes route `5/5`.
- **Machine state:** Ken granted standing permission to validate inside Antigravity for this work; do not pause to ask
  again. Do not stop or interact with his running game.
- **Commit point:** `feat(authority): bind snapshot restore to action receipts`. Run final synchronized precommit after
  durable docs, stage only the exact checkpoint paths, commit/push, assert local/origin/remote parity, and update the
  marker blocks in GitHub `#20` and parent `#19` without closing either.

## Verified implementation

- `src/server/workspaceSnapshotSource.ts` normalizes caller logical identity, resolves only a contained regular
  snapshot file, rejects junction/symlink/path escape, enforces byte ceiling and exact `fstat`/read length, closes the
  descriptor exactly once, checks pre-open/open/final identity, decodes fatal UTF-8 and a strict snapshot envelope,
  and returns only sanitized workspace plus bounded hashes/scalars.
- `src/server/workspaceSnapshotRestoreReceiptAdapter.ts` binds source bytes/logical identity/target hashes and paired
  current resources, serializes by addressed workspace, rereads source and paired CAS immediately before the single
  `WorkspaceRegistry.commit`, prepares durable recovery first, reopens the terminal receipt, and implements exact
  replay plus rollback success/refusal/failure truth.
- `server.ts` routes `POST /api/fs/restore-snapshot` through that adapter, requires caller-owned
  `x-forge-operation-id` and paired expected hashes, maps fixed redacted failures, captures history fail-soft, and
  returns only after a committed receipt.
- `scripts/route-integration.mjs` contains the final real-owner route proof. No standalone app, end-user CLI, external
  provider/runtime/result, schema-path change, validator weakening, mod/game write, or deploy was introduced.

## Final evidence

- Source reader `53/53`; restore adapter `27/27`; receipt coverage candidate/promotion `57/57`; policy bundle
  `18/18`; durable writer audit `14/14`; extension durable writer `8/8`.
- Route disposition candidate SHA-256
  `0fb6886180236dfbcae0defceea552c3409e6f6909e7270a5a78b43e797780bb` added only
  `src/server/workspaceSnapshotRestoreReceiptAdapter.ts` and `src/server/workspaceSnapshotSource.ts` to the sorted
  source boundary. Capability audit passes at `11` capabilities / `294` disposed literal routes / one dynamic
  registrar / `10` MCP aliases.
- Receipt coverage candidate SHA-256
  `f95d5670ae9a0d615fadc2f876e8bbfc30fa92c022663069fac91572674d215e` added only one
  `receipt-exempt / W3B0-internal / fixture-cache` selftest surface and six deterministic source-reference shifts.
  Reviewed manifest/pin SHA-256 is
  `2387d9db5bad96fa5040afed7d93f7eda90b6dfadf61ef8d64bd6f95ade6c637`; audit is `82/51`.
- Typecheck/build exit `0`; focused lint `0` errors / `240` existing `server.ts` warnings; Graphify refresh is `5,720`
  nodes / `14,041` edges / `209` communities and resolves the new adapter.
- Final pre-doc precommit is `[precommit] OK` in `484.9s`. Final fresh production route suite is `467/467`, exit `0`,
  with zero new route process, zero new `x4-route-int-*` directory, and zero listeners on
  `3000/3001/3100/3101`. The nine visible route temp roots all predate this checkpoint.

## Reproduced failures and corrections

- A first two-minute receipt-coverage wrapper timed out while its prerequisite was legitimately active; an earlier
  overlapping attempt also remained. The two exact task-owned command trees were stopped and confirmed gone before
  serialized reruns. Outer wrapper timeout is not child cleanup proof.
- Writer audit correctly refused the new fixture writer and stale fingerprint. One exact fixture-only registry entry
  and the scanner-derived fingerprint restored the gate.
- Capability audit correctly refused the two newly reachable source files. Exact candidate review proved no route,
  authority, capability, or MCP delta before atomic promotion.
- Receipt coverage correctly refused one missing fixture surface plus shifted durable-writer references. Its separate
  candidate/promotion added one exempt row; two positive selftests then exposed three stale `50` literals, corrected
  to the reviewed `51`. No audit was weakened or hand-edited.
- One JavaScript spawn-message template and one read-only PowerShell projection failed to parse before mutation; their
  corrected structured forms succeeded. These are AAR/tooling events, not product failures.

## Immediate next unit

Implement `POST /api/agent/bulk-transform/apply` through the existing addressed-workspace receipt transaction. Reuse
`buildPlan`, `mergeBulkTransformPatches`, paired CAS, current corpus/plan hashes, `WorkspaceRegistry`, recovery store,
receipt service/store, history projection, deadline predicate, and redacted failure mapping. Prove exact plan/source
intent, same-workspace serialization, replay/conflict, both stale CAS halves, plan/corpus drift, no-change, recovery,
finalization rollback, rollback refusal/failure, and route integration. Then run the official full W3B1a E2E and
containment gates for route `5/5`.

Every implementation/test edit remains on exact native `gpt-5.6-luna` `luna_executor` workers at
`reasoning_effort=max`, `fork_context=false`; Sol coordinates, reviews, validates, documents, commits, and pushes.

## Preserved unrelated dirty boundary

Do not stage, reset, clean, restore, or claim ownership of:

- Modified `BACKLOG.md`, `CODEX-ONBOARDING.md`, and `KNOWN-BUGS.md`.
- Deleted `data/known_fixes.json`, `data/trivia_questions.json`, `docs/DISCORD_BOTS_AND_GAMES.md`,
  `scripts/ailive_discord_bot.mjs`, `scripts/discord_economy.mjs`, `scripts/forge_discord_bot.mjs`,
  `scripts/ingest_repo_bugs.mjs`, and `scripts/x4_muds_game.mjs`.
- Modified `test-results/.last-run.json`, `vscode-extension/evidence/0.0.35-runtime-copy-live.png`, and
  `vscode-extension/evidence/0.0.35-runtime-copy-startup.png`.
- Untracked `.github/ISSUE_TEMPLATE/bug_report.md`, `.github/ISSUE_TEMPLATE/feature_request.md`, `Note for Kimi.md`,
  and the six older screenshots under `vscode-extension/evidence/2026-07-31-r8-r17/`.

`BACKLOG.md` remains intentionally unstaged because its unrelated user edits predate this checkpoint. The accurate
W3 `4/5` state is durable in the W3B1 plan, program plan, roadmap, this handoff, and GitHub owner projections.

## AAR summary

- **Sustain:** exact source capture, mutation-boundary reread, paired CAS, one commit owner, recovery before mutation,
  terminal receipt reopen, redacted failure truth, exact candidate promotion, and independent route containment.
- **Improve work/approach:** serialize long authority scans; a timed-out outer command can leave owned children
  running. Treat each governance manifest as a separate source of truth and promote it through its own workflow.
- **Improve tools:** receipt coverage suppresses prerequisite stderr; run the named prerequisite directly after its
  wrapper fails. Graphify output is ignored, so verify loadability/counts rather than expecting Git status.
- **Highest-risk evidenced weakness:** bulk-transform apply and all W3B1b-d mutation owners still lack complete native
  receipt authority. Post-response history alone cannot close that gap.
