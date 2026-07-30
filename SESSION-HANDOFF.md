# X4 Forge — Session Handoff

Updated: 2026-07-30

## One-line state

B110-R10 managed-sidecar parent-death/orphan prevention is VERIFIED; R19 packaged-VSIX CI is the next bounded Kimi
safety-contract unit, followed by R20 flake policy.

## Operator brief

- Project: `F:\DEV_ENV\X4_Forge` (Forge application/Antigravity extension, not the live X4 mod).
- Machine state: Ken confirmed quiet. All R10 runtime/UI validation used isolated temp state; no installed sidecar,
  real mod, game directory, Nexus, Steam, Open VSX, or live workspace was changed.
- Eyeball queue: none for R10. It introduces no new visible control; packaged process behavior and full rendered
  compatibility passed.
- Commit question: verify the R10 close commit/push exists before R19. Its prewritten title is
  `feat(extension): reap managed sidecars when the host dies`; preserve the four unrelated dirty/untracked files.

## Current bounded task

### B110-R10 status: VERIFIED

Implemented:

- Packaged supervisor owns exactly one managed server and treats extension-host stdin loss as authority.
- Nonce-authenticated graceful exit removes discovery; bounded fallback reaps only the exact spawned child tree.
- Parent PID is diagnostic only; attach-first backends never enter the supervision path.
- Product-copy screenshots now use per-run artifacts; layout persistence coalesces stale pending states.

Validation:

- Parent contract 11/11; latest-value writer 3/3; staged packaged process drill 16/16.
- Isolated routes 243/243; runtime-discovered oracles 119/119.
- Focused Studio E2E 9/9; final instrumented full isolated E2E 46/46, zero failed/flaky/bad results.
- Typecheck/lint/build/stage/extension build/package inspection passed. Final local VSIX SHA-256:
  `A72BFB0E3EB9D32DBCF7EEBD02CF2FADB1180648CC6365919A869AE614EF0472`.

## Next action

1. Verify R10's path-scoped commit/push and exact-SHA public CI.
2. Begin B110-R19 as a new Full-lane task: reconcile the existing Windows Quality workflow and staged probe before
   adding extension build/stage/package/VSIX inspection without publication.
3. Close/document R19 independently; R20 follows.

## Live hazards and ownership

- Preserve unrelated modified files:
  - `vscode-extension/evidence/0.0.35-runtime-copy-live.png`
  - `vscode-extension/evidence/0.0.35-runtime-copy-startup.png`
- Preserve unrelated untracked files:
  - `Note for Kimi.md`
  - `scripts/x4_muds_game.mjs`
- Do not publish a new extension version for these internal safety units without a separately scoped release task.
- Raw `node scripts/oracle-sweep.mjs` assumes a running target; use `npm run test:oracles` when no server is running.
- Non-Windows `exec()` descendant reaping is not proven; never replace the safe single-process fallback with an
  unowned negative-PID group kill.

## R10-owned paths

- `src/lib/parentLiveness.ts`
- `src/lib/latestValueWriteQueue.ts`
- `src/App.tsx`
- `server.ts`
- `vscode-extension/src/sidecarSupervisor.ts`
- `vscode-extension/src/extension.ts`
- `vscode-extension/scripts/build-ext.mjs`
- `vscode-extension/scripts/probe-staged-app.mjs`
- `vscode-extension/.vscodeignore`
- `tests/e2e/product-copy.spec.ts`
- `docs/plans/2026-07-30-sidecar-parent-liveness.md`
- `docs/plans/2026-07-29-kimi-recommendations-ledger.md`
- `BACKLOG.md`
- `ROADMAP.md`
- `SESSION-HANDOFF.md`
- `F:\StarForge\wiki\x4-forge\capability-map.md`
- `F:\StarForge\wiki\x4-forge\aar-log.md`
- `F:\StarForge\wiki\workflow\aar-log.md`

## AAR state

Triggered and recorded. Main triggers: first supervisor transport failed; generated-output build race; standing
evidence writes; traced layout-save starvation; one unexplained late Vite exit followed by an instrumented 46/46;
and one raw oracle command without its server. No rollback, product-data mutation, or acceptance weakening.
