# X4 Forge — Session Handoff

Updated: 2026-07-30

## One-line state

B110-R9 uniform timeout policy is VERIFIED locally and ready for its scoped commit/push; R10 sidecar parent-death
and orphan prevention is the next bounded Kimi safety-contract unit.

## Operator brief

- Project: `F:\DEV_ENV\X4_Forge` (Forge application/Antigravity extension, not the live X4 mod).
- Machine state: Ken confirmed quiet. All R9 runtime/UI validation used isolated temp state; no installed sidecar,
  real mod, game directory, Nexus, Steam, Open VSX, or live workspace was changed.
- Eyeball queue: none for R9. It introduces no new visible control; full rendered compatibility passed 46/46.
- Commit question: R9 is at the verified commit point. Stage only the R9-owned paths listed below; preserve the four
  unrelated dirty/untracked files. After push, assert `origin/main == HEAD` and check the exact public CI SHA.

## Current bounded task

### B110-R9 status: VERIFIED

Implemented:

- `src/lib/requestDeadline.ts` centralizes browser/server/command budgets and 14 deterministic checks.
- Every same-origin browser API fetch has a composed 30-second default or 150-second long-operation deadline.
- Node HTTP and Express response lifetimes are bounded; expiry returns an R3-enveloped 504.
- Sync commands stop at 60 seconds. Async jobs default to 15 minutes, cap at 30 minutes, refuse invalid limits and
  full running capacity, terminate on timeout, and return stable machine evidence.
- `/api/agent/schema` v4 publishes the deadline contract.

Validation:

- Pure request policy 14/14; R3 regression 12/12.
- Isolated routes 243/243, including 504 preemption, invalid-limit/no-spawn, and real PowerShell tree-kill proof.
- Runtime-discovered isolated oracles 117/117.
- Full isolated E2E 46/46 in 399.5 seconds; 0 failed/flaky; ports 3100/3101 closed afterward.
- Typecheck PASS; lint PASS at 0 errors / 548 established warnings; production build and precommit PASS.
- Graphify: 2,934 nodes / 6,883 edges / 142 communities; diff check PASS.

## Next action

1. Commit/push only R9-owned paths and verify exact-SHA public CI.
2. Begin B110-R10 as a new Full-lane task: reconcile extension sidecar spawn/discovery/shutdown with a parent PID
   watchdog and PID-reuse-safe identity proof.
3. Do not bundle R19/R20 into R10; update the Kimi ledger after each close.

## Live hazards and ownership

- Preserve unrelated modified files:
  - `vscode-extension/evidence/0.0.35-runtime-copy-live.png`
  - `vscode-extension/evidence/0.0.35-runtime-copy-startup.png`
- Preserve unrelated untracked files:
  - `Note for Kimi.md`
  - `scripts/x4_muds_game.mjs`
- Do not publish a new extension version for these internal safety units without a separately scoped release task.
- Raw `node scripts/oracle-sweep.mjs` assumes `localhost:3001`; use `npm run test:oracles` when no server is running.
- Non-Windows `exec()` descendant reaping is not proven; never replace the safe single-process fallback with an
  unowned negative-PID group kill.

## R9-owned paths

- `src/lib/requestDeadline.ts`
- `src/lib/apiFailureEnvelope.ts`
- `src/main.tsx`
- `server.ts`
- `scripts/route-integration.mjs`
- `docs/plans/2026-07-30-timeout-policy.md`
- `docs/plans/2026-07-29-kimi-recommendations-ledger.md`
- `BACKLOG.md`
- `ROADMAP.md`
- `SESSION-HANDOFF.md`
- `F:\StarForge\wiki\x4-forge\capability-map.md`
- `F:\StarForge\wiki\x4-forge\aar-log.md`
- `F:\StarForge\wiki\workflow\aar-log.md`

## AAR state

Triggered and recorded. Triggers: one PowerShell search quoting failure, the first typecheck's unsupported Node exec
option and union-access errors, and fresh-eyes removal of a new lint warning. No rollback or acceptance weakening.
