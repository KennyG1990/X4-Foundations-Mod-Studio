# X4 Forge — Session Handoff

Updated: 2026-07-30

## One-line state

B110 R1+R16 project rules are VERIFIED locally and on exact-SHA public Quality. The next bounded Kimi unit is R6
self-explaining diagnostics and guarded one-click exact suppression.

## Operator brief

- Project: `F:\DEV_ENV\X4_Forge` (Forge application/Antigravity extension, not the live X4 mod).
- Machine state: Ken confirmed quiet. R1+R16 used repo/temp fixtures and isolated ports only; no installed sidecar,
  real mod, game directory, Nexus, Steam, Open VSX, or live workspace was changed.
- Eyeball queue: none. This is a headless validation/CLI contract; no rendered UI changed.
- Commit question: implementation `5262348` is pushed and exact-SHA Quality `30574645399` passed. Commit/push the
  durable R1/R16 close as `docs(validation): verify project rules contract`, then begin R6.

## B110-R1+R16 close: VERIFIED

- Strict optional `forge.rules.json` v1 supports exact reviewed warning suppressions, exact known property chains,
  declared indexed wire keys/scopes, and expected AST-observed Lua registrations. Errors are never suppressible.
- Rule errors disable every suppression and make shared validation red. Results retain rule/evidence/suppressed
  provenance plus raw/suppressed/active warning totals. Disk/API/CLI/compile/release/deploy use the same referee.
- Pure rules 20/20; cross-file 21/21; routes 248/248; oracles 120/120; CLI fixture/schema/type/lint/build/precommit/
  graph passed; final post-review E2E 46/46 with zero failed/flaky/bad/quarantined and ports closed.
- Fresh-eyes fixed an oversized-disk fail-open: root rules above 256 KiB now block as `rules.file_too_large` rather
  than disappearing through the generic loader.
- Exact-SHA public Quality `30574645399`, job `90979730922`, passed all 23 steps at implementation `5262348`;
  inspected artifact `8772238373` is retained through 2026-08-13. Discord sync `30574645262` also passed.

## Next action

1. Commit/push only the R1+R16 durable close paths and assert `origin/main == HEAD`.
2. Next bounded Kimi unit: R6 self-explaining diagnostics and guarded one-click exact
   suppression, reusing this schema. Then R2, R11+R14, R8+R17, R13, R18+R21, and final Kimi reconciliation.
3. Only after R1-R21 close, begin the queued two-document community-tool research program in `BACKLOG.md`.

## Live hazards and ownership

- Preserve unrelated modified files:
  - `vscode-extension/evidence/0.0.35-runtime-copy-live.png`
  - `vscode-extension/evidence/0.0.35-runtime-copy-startup.png`
- Preserve unrelated untracked files:
  - `Note for Kimi.md`
  - `scripts/x4_muds_game.mjs`
- `test-results/` receipts are ignored runtime output; the tracked `.last-run.json` is baseline-clean.
- Do not publish a new extension version for internal safety/validation units without a separately scoped release.
- A retry-pass is red. Never rerun a flaky gate to manufacture green.

## Suggested close commit title

`docs(validation): verify project rules contract`
