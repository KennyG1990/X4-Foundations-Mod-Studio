# X4 Forge — Session Handoff

Updated: 2026-07-30

## One-line state

B110-R19 is VERIFIED. B110-R20 zero-flake policy is locally green but PARTIAL until exact-SHA public Quality runs
the real deliberate retry-flake fixture; R1+R16 follows.

## Operator brief

- Project: `F:\DEV_ENV\X4_Forge` (Forge application/Antigravity extension, not the live X4 mod).
- Machine state: Ken confirmed quiet. R20 full E2E used isolated temp state/ports 3100/3101 and cleaned both; no
  installed sidecar, real mod, game directory, Nexus, Steam, Open VSX, or live workspace was changed.
- Eyeball queue: none for R20. It changes test governance/CI, not a visible product control.
- Commit question: R19 close `60d4565` is pushed and public Quality `30570581116` passed. Commit only R20-owned paths
  under `test(e2e): enforce zero-flake quarantine policy`, push, then require exact-SHA public Quality.

## Current bounded task

### B110-R20 status: PARTIAL (public clean-runner gate pending)

Implemented:

- `run-e2e.mjs` owns one retry plus Playwright fail-on-flaky, rejects caller retry/flaky/reporter overrides, requires
  structured JSON for green, and writes an atomic machine-readable verdict receipt.
- The actual flake budget is zero. Exact-id quarantine is ownership metadata only, capped at three entries and 14
  days with owner/reason/issue/created/expiry enforcement. It cannot skip a test or change the verdict.
- A real isolated Playwright fixture fails attempt zero and passes retry one; the policy selftest runs it both without
  and with matching valid quarantine metadata and requires both wrapper runs to stay red.
- Existing Windows Quality runs the bounded real policy selftest after oracles and before build/package gates.

Validation:

- Pure policy/verdict/override/missing-JSON matrix 26/26.
- Real deliberate flake selftest 8/8; Playwright reported 1 flaky and both inner wrapper runs returned FAIL.
- Full isolated E2E 46/46, 0 failed/flaky/bad/quarantined, JSON receipt green; ports 3100/3101 closed.
- Typecheck PASS; lint 0 errors/548 warnings; oracles 119/119; build PASS; routes 243/243; precommit PASS; graph
  3,002 nodes / 6,990 edges / 163 communities; workflow YAML/order/no-publish review PASS.
- One compound validation process exited Windows `0xC0000409` at oracle launch after type/lint passed. The isolated
  oracle command passed 119/119; all subsequent gates passed separately. Fresh-eyes review also corrected the old
  stdout fallback's false-green path; structured JSON is now mandatory. The deliberate fixture's output is OS-temp
  isolated and a hash check proves it no longer changes tracked `test-results/.last-run.json`.

## Next action

1. Commit/push only R20 paths and assert `origin/main == HEAD`.
2. Wait for exact-SHA public Quality. The new `Prove fail-closed E2E flake policy` step must pass before build/package;
   a failure returns to implementation, never rerun-only green.
3. After public proof, reconcile R20 to VERIFIED in ledger/ROADMAP/capability/AAR, overwrite this handoff, commit/push
   the close, then begin the R1+R16 validation-rules schema unit.
4. Continue Kimi order: R1+R16, R6, R2, R11+R14, R8+R17, R13, R18+R21, final reconciliation.
5. Only after R1-R21 close, begin the queued two-document community-tool research program in `BACKLOG.md`.

## Live hazards and ownership

- Preserve unrelated modified files:
  - `vscode-extension/evidence/0.0.35-runtime-copy-live.png`
  - `vscode-extension/evidence/0.0.35-runtime-copy-startup.png`
- Preserve unrelated untracked files:
  - `Note for Kimi.md`
  - `scripts/x4_muds_game.mjs`
- `test-results/` evidence is ignored runtime output; do not stage it.
- Do not publish a new extension version for internal safety units without a separately scoped release task.
- A retry-pass is red. Never rerun a flaky gate to manufacture green; inspect the receipt and fix/own the cause.

## R20-owned paths

- `.github/workflows/quality.yml`
- `BACKLOG.md`
- `package.json`
- `scripts/run-e2e.mjs`
- `scripts/e2e-flake-policy.mjs`
- `scripts/e2e-flake-policy-selftest.mjs`
- `scripts/e2e-quarantine.json`
- `tests/fixtures/e2e-flake-policy/`
- `docs/testing/E2E_FLAKE_POLICY.md`
- `docs/plans/2026-07-30-e2e-flake-policy.md`
- `docs/plans/2026-07-29-kimi-recommendations-ledger.md`
- `SESSION-HANDOFF.md`

## Suggested implementation commit title

`test(e2e): enforce zero-flake quarantine policy`
