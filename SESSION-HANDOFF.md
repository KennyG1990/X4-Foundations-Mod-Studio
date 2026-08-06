# X4 Forge — Native Extension Close Handoff

Updated: 2026-08-06 America/New_York

## One-line state

The bounded installed managed-sidecar busy-liveness repair is `VERIFIED` in source, package, installed Antigravity,
rendered UI, precommit, and full E2E. A still-running owned sidecar is retained when synchronous deterministic
validation temporarily starves its HTTP loop; an exited child is still rejected, and external services still require
the full Forge identity. W3 remains `PARTIAL` at `3/5`, W10 remains `OPEN / PARTIAL`, and the overall
extension-native program remains `IN_PROGRESS / PARTIAL`.

## Operator brief

- **Project:** `F:\DEV_ENV\X4_Forge`, the Forge extension and its integrated Studio/sidecar/API surfaces.
- **Eyeball queue:** none for this bounded hotfix. Installed rendered proof is closed by the two saved Antigravity
  screenshots. The separate W3 snapshot-source candidate has no user-visible surface yet.
- **Machine state:** Ken granted standing permission to validate inside Antigravity for this work; do not pause to ask
  again. Do not stop or interact with his running game.
- **Commit point:** `fix(extension): retain busy managed sidecar`. The implementation checkpoint is the commit
  containing this handoff; use Git and canonical GitHub owner `#19` for the exact post-push hash/parity readback.

## Reproduced diagnosis

- The earlier `403` report used obsolete/guessed `POST /api/agent/validate`. Current project validation routes are
  `/api/agent/project/validate` and `/api/agent/project/validate/check`; deploy verification correctly refuses writes
  when validation is red.
- The current installed `Failed to fetch` was a different real bug. The sidecar loaded `402` MD events, `35`
  conditions, `807` actions, `32` factions, `1,902` wares, and `170` sectors, but synchronous validation blocked HTTP
  longer than two `1,500 ms` probes plus the retry delay. The extension treated the still-running child as dead,
  discarded it, and rebound panels to a new port.
- Therefore the schema files were present and loaded. The fetch failure came from destructive sidecar lifecycle churn,
  not a missing-schema path.

## Verified implementation

- `vscode-extension/src/backendLiveness.ts` classifies `responsive`, `child-not-running`, and
  `running-but-busy`. Process state is authoritative for an owned child after bounded probes.
- `vscode-extension/src/extension.ts` supplies a fresh child-state callback at the final decision boundary and retains
  the same handle for retry recovery or running-but-busy classification.
- `vscode-extension/src/backendLiveness.selftest.ts` covers seven deterministic positive/negative cases.
- `scripts/action-receipt-coverage-audit.ts` raises only the nested capability-audit wrapper from `300_000` to
  `600_000 ms` after the prerequisite measured `295.8s`; its 4 MiB buffer and failure taxonomy are unchanged.
- No schema path, validator verdict, route authorization, game/mod data, external attach, standalone/CLI, or
  marketplace behavior changed. No capability-map delta.

## Gate and package evidence

- Backend liveness `7/7`; extension/root builds exit `0`; root typecheck exit `0`; focused lint and diff checks exit
  `0`; Graphify `5,634` nodes / `13,781` edges / `208` communities.
- Final `npm run precommit:check` exits `0` with `[precommit] OK`; action-receipt coverage is `82` routes / `50`
  surfaces.
- Package `F:\DEV_ENV\X4_Forge\vscode-extension\x4-forge-studio-0.0.63-busy-liveness-20260806.vsix` is
  `18,076,535` bytes, SHA256 `841A63185547E2FBB946815EF87AF663A7367B6DC3FB091F66307B6409F9F1A3`;
  stage/probe is `16/16`, inspector PASS is `2,091` entries / `61,322,674` unpacked bytes.
- Full E2E rerun is `96/96` in `1,396.3s`, failed/flaky/bad `0/0/0`. Fresh receipt generated
  `2026-08-06T18:34:23Z` records complete report/lifecycle, `trigger=child-close`, `treeGone=true`, empty
  `remainingPids`, and no runner interaction failure; independent readback found no listeners on `3100/3101`.
- The first 20-minute observer killed an advancing E2E run and leaked only its isolated 3100/3101 stack. Exact PIDs
  were resolved, stopped, and verified gone before the unchanged green rerun. The stale earlier receipt was rejected.
- E2E writes were bound to `C:\Users\Moshi\AppData\Local\Temp\x4forge-e2e-state-44580` through both
  `X4_STATE_DIR` and `X4_CONFIG_DIR`, outside live Forge state.

## Installed Antigravity proof

- Candidate installed at
  `C:\Users\Moshi\.antigravity-ide\extensions\x4forge.x4-forge-studio-0.0.63`; installed extension,
  supervisor, and server bundle hashes/lengths match staged bytes.
- Antigravity `1.107.0` rendered Forge `v1.0.426`. Managed sidecar port `63755` was retained after two timed-out
  probes at `17:04:39.102Z`; validation completed at `17:04:49.828Z`; the same handle answered retry two at
  `17:04:55.145Z`. Fresh-log counts for discard, no-answer, fetch-failure, auto-restart, and unexpected-exit markers
  are zero.
- Evidence:
  `vscode-extension/evidence/2026-08-06-busy-liveness/installed-antigravity-busy-retained-recovered.png` and
  `vscode-extension/evidence/2026-08-06-busy-liveness/installed-antigravity-schema-corpus-loaded.png`.
  The latter visibly shows the configured unpacked 9.00 corpus found, `1,020,384` discovered items, read-only
  discovery/canonical-ID availability, and no `Failed to fetch`.
- No version bump or marketplace publication occurred; this is a local same-version installed candidate.

## Immediate close boundary

- Task-owned checkpoint paths are the three liveness source/test files, the bounded audit-timeout file, this handoff,
  `ROADMAP.md`, the owning plan, and the two new evidence PNGs.
- Canonical GitHub issue `#19` remains open. Update its single marker block after push with the exact commit hash,
  busy-liveness `7/7`, same-port installed proof, full E2E `96/96`, and W3 `3/5`; do not close the issue or program.
- The W3 snapshot reader candidate remains separate and uncommitted:
  `src/server/workspaceSnapshotSource.ts` and `src/server/workspaceSnapshotSource.selftest.ts`. It is not part of the
  hotfix index. Fresh-eyes review identified a missing explicit byte-count comparison after `read(fd)`; address that
  in the next W3 adversarial/integration slice.

## Next bounded program unit

Resume W3 snapshot restore authority: harden the source reader against truncated/injected reads, add adversarial and
integration coverage, then proceed to the remaining restore/bulk receipt paths. Keep all implementation and test
writes on exact native `gpt-5.6-luna` `luna_executor` workers at `reasoning_effort=max` with no fallback writer.

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
- The two untracked W3 snapshot-source files named above are active program work, not unrelated baseline, but they
  must remain outside this hotfix checkpoint.

## AAR summary

The task triggered installed-runtime contradiction, validation concurrency, accidental artifact, installer-lock,
prerequisite-timeout, E2E-observer/cleanup, and one read-only PowerShell parser events. All are documented in the
owning plan and project/global AAR ledgers. Highest-risk lesson: synchronous deterministic work can make a healthy
owned sidecar fail HTTP probes; destructive lifecycle decisions must use owned-process truth, not HTTP timeout alone.
