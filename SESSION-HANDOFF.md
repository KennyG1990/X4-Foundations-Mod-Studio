# X4 Forge — Session Handoff

Updated: 2026-07-30

## One-line state

B110 safety batch R3/R9/R10/R19/R20 is VERIFIED. The next bounded Kimi unit is the shared R1+R16
`forge.rules.json` validation/suppression schema.

## Operator brief

- Project: `F:\DEV_ENV\X4_Forge` (Forge application/Antigravity extension, not the live X4 mod).
- Machine state: Ken confirmed quiet. R20 used isolated temp state/ports and public CI; no installed sidecar, real
  mod, game directory, Nexus, Steam, Open VSX, or live workspace was changed.
- Eyeball queue: none for R20. It is test governance, not a visible product control.
- Commit question: implementation `681051f` is pushed and exact-SHA public Quality `30572006397` passed. Commit the
  R20 durable close under `docs(test): verify zero-flake policy`, push, then specify R1+R16.

## B110-R20 close: VERIFIED

- Runner owns one retry, official fail-on-flaky, mandatory structured JSON, atomic receipts, and a zero-flake final
  verdict. Caller retry/flaky/reporter overrides fail before spawn.
- Quarantine is exact-id ownership metadata only: maximum three entries, maximum 14 days, required owner/reason/
  issue/dates, never a skip/exclusion/success override.
- Pure matrix 26/26; real first-fail/retry-pass fixture with matching quarantine stays red and outer oracle is 8/8;
  full isolated E2E 46/46 with zero failed/flaky/bad/quarantined; ports closed.
- Oracles 119/119, routes 243/243, typecheck/lint/build/precommit/graph/workflow review passed.
- Exact-SHA Quality `30572006397` / job `90970783625` passed the policy and all downstream packaged-product gates;
  artifact `8771216666` retained through 2026-08-13.

## Next action

1. Commit/push only R20 close records and assert `origin/main == HEAD`.
2. Full-lane plan R1+R16. Reconcile every validator finding/suppression reader, existing `ruleId`/explain behavior,
   config/root/path ownership, project validation options, diagnostics UI, guarded writes, schemas, and agent API.
3. Specify one versioned `forge.rules.json` foundation for mod-local suppressions plus declared wire keys, known
   property chains, and expected Lua registrations. Invalid/expired rules must fail visibly; zero cry-wolf is the bar.
4. After R1+R16, execute R6, R2, R11+R14, R8+R17, R13, R18+R21, and final Kimi reconciliation.
5. Only after R1-R21 close, begin the queued two-document community-tool research program in `BACKLOG.md`.

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

`docs(test): verify zero-flake policy`
