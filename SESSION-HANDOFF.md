# Session handoff — B119 exact deploy-bound X4 UI verification

Date: 2026-08-28
Project: `F:\DEV_ENV\X4_Forge`
Status: implementation and complete host validation green; second-profile X4 gate pending;
overall B119 `IN_PROGRESS / PARTIAL`

## Current state

- Baseline `HEAD == origin/main == cfb87ac89e453a912e5a0be28fe20e814e7b20b1`. The bounded executable changes
  are uncommitted and unstaged. Preserve the many unrelated user-owned worktree changes.
- The prior real-X4 `pipeline_test` proof remains authoritative at one `2544x1353` drawable profile. Exact package:
  four files, `6,338` bytes, fingerprint
  `88574c00ce6d9aa5b1dd2686425fae0a8b492df75a04a25bd94d19e82f7d844f`.
- The live game target remains absent after its one-use recovery. No mod, game, corpus, credential, or standing
  configuration byte was written by the current unit.
- Antigravity is open by window/process evidence; X4 is absent; the operator confirmed the machine quiet before the
  heavy host gate.
- All four Luna workers used by this bounded unit reached terminal status and were closed. Zero workers are open.

## Implemented bounded unit

- `server.ts` returns and persists the exact regular-tree `deployedFingerprint` for successful legacy and guarded
  deploys.
- `src/server/runtimeDebuggerAdapter.ts` validates, persists, and reconstructs that fingerprint across restart;
  failed deploy evidence cannot replace the last successful exact deploy.
- New pure `src/lib/x4UiGameVerification.ts` extends the existing global experience-confirmation authority with an
  optional X4 UI snapshot. External verification requires exact workspace/source identity, successful deploy
  timestamp/path/fingerprint, target identity, clean readiness, normalized drawable/UI-scale profile, and explicit
  human confirmation.
- `App`, `UIBuilder`, `X4UiSourceEditor`, and readiness wiring consume that external state without changing internal
  preview truth. Preview/session/paint/canvas receipts remain `gameVerified:false` and `Not verified in game`.
- Fresh-eyes corrections preserve a prior X4 UI snapshot only while workspace and deploy evidence still match,
  remove a parent/child snapshot-lifecycle race, and prevent an enabled-but-inert confirmation control.

## Host validation green

- X4 UI verification owner selftest: PASS.
- Runtime debugger adapter: PASS `44/44`.
- SourceEditor selftest: PASS all current matrices.
- Host typecheck: PASS.
- Bounded ESLint: exit `0`, zero errors; broad existing warnings remain outside this unit.
- `git diff --check`: PASS, with only the existing UIBuilder line-ending warning.
- Graphify refreshed and queried: `9,931` nodes / `24,845` edges / `327` communities.
- Route integration: `491/491`; runtime-index oracles: `134/134`.
- First full e2e is retained red evidence: `103` passed / `1` flaky / `treeGone=true`. Exact project-browser
  reproduction passed `3/3`; one controlled unchanged full retry passed `104/104`, zero flaky, `treeGone=true`.
  Green receipt SHA-256: `19636EE9351736DEBA2E1ED9186E1F0C3F9CC27F3E5C60E93588187CF6DEA865`.
- Writer authority: selftest `14/14`, live inventory PASS, host-store `8/8`. Exact manifest delta updates only the
  current server fingerprint and App local-storage write count.
- Capability authority: reviewed candidate SHA-256
  `25af9c77b0d84020426cad609459883e010a622bee9d6caaf7b4762c155ccfae`; source boundary `192 -> 193`, no
  route/authority changes; audit `12 capabilities / 297 routes / 1 dynamic registrar / 11 MCP aliases`.
- Action receipts: `82` routes / `56` surfaces. Complete precommit: PASS. Final production build: PASS at `1,848`
  Vite modules. Ports `3000/3001/3100/3101` are free and X4 remains absent.
- Evidence: `dev-docs/b119-exact-deploy-verification/e2e-red-20260828-01/` preserves red, targeted green, trace, and
  full-retry green receipts.

## Google Docs bridge and external records

- Installed bridge owner:
  `C:\Users\Moshi\.codex\plugins\cache\openai-curated-remote\google-drive\0.1.16\skills\google-docs\host\docs-trusted-read-file-bridge.mjs`.
- Windows absolute paths, strict UTF-8 without Web API globals, ConPTY line framing, and short exact byte/hash receipts
  are repaired. Syntax checks, `11` owner checks, and a real ConPTY exact-receipt probe pass.
- Three failed trusted reads remain red evidence. Successful immutable read evidence is
  `dev-docs/google-docs-trusted-read/b119-20260828-04`.
- Drive document `17VLaIsT499KHg7zg30hOyLaBXB0-9jlrX3dQ63s3dtE` was revision-locked, appended, and read back at
  final revision `AIroW35g1L39c6IcRasl_o3p9SKsqKtlH5GoRCLjpja1ATvLh-iMM0G4e6Kp7OXYr8XjJ8-aIQ0yHZuBbmql3HxlmUK4nwecuJcDf89fN2iu`.
- Notion page `3b84618e-d15b-8190-821e-c0eb96f43d5a` was appended and read back as
  `HOST-VALIDATED / IN PROGRESS / PARTIAL`.
- GitHub issue #41 focused comment `5450866946` was written and read back as explicitly uncommitted/PARTIAL. The
  issue remains open; add the next comment only after the bounded commit/push exists, then read it back.

## Dirty boundary and commit question

- Executable/test paths: `server.ts`, `src/App.tsx`, `src/components/UIBuilder.tsx`,
  `src/components/X4UiSourceEditor.tsx`, `src/components/X4UiSourceEditor.selftest.tsx`, `src/lib/readiness.ts`,
  `src/lib/x4UiGameVerification.ts`, `src/lib/x4UiGameVerification.selftest.ts`,
  `src/server/runtimeDebuggerAdapter.ts`, and `src/server/runtimeDebuggerAdapter.selftest.ts`.
- Reviewed authority paths: `config/durable-writers.json` and `config/forge-route-dispositions.json`.
- Repository records: `BACKLOG.md`, `SESSION-HANDOFF.md`,
  `docs/plans/2026-08-10-b119-x4-ui-editor-linter-first.md`, and
  `docs/plans/2026-08-28-b119-exact-deploy-confirmation-second-profile.md`.
- Capability-map and project-AAR deltas under `F:\StarForge\wiki\x4-forge\` are updated outside this repository.
- Never broad-stage. Full precommit is green; use explicit `git add -- <paths>` only.
- Suggested commit: `feat(ui-editor): bind game verification to exact deploy evidence`.
- Push only after the commit hook passes; prove `HEAD == origin/main == git ls-remote` and zero staged residue.

## Next exact actions

1. Fresh-eyes review the exact staged diff, commit/push the narrow checkpoint, and prove local/tracking/direct-remote
   parity with zero staged residue.
2. Update/read back GitHub #41, Notion, and Drive with the exact commit.
3. Present the separate real-game write/recovery paragraph and wait for literal `go` before deploying the unchanged
   package at a second profile.
4. Capture interaction, debuglog, measured bounds, exact package identity, and recovery. Dynamic `Helper.scaleX` /
   `Helper.scaleY` geometry remains unavailable, so do not claim exact Forge-versus-X4 pixel parity.
5. Do not publish OpenVSX while B119 is partial. At release quality, reconcile the user-owned extension release
   edits, then build, package, inspect, probe, publish once, verify public parity, and commit/push.

## Triggered AAR hazards

- Reconciliation replaced a proposed local verification store with the existing readiness/confirmation owner.
- Fresh-eyes review forced two state-ownership repairs.
- The Docs bridge required separate Windows-path, missing-Web-API, ETX/ConPTY, and ANSI-wrap corrections.
- `reviewctl` is unavailable; complete diff review and causal tests remain the authority.
- A broad Docs extraction exceeded the useful context boundary; the compact paragraph API supplied safe readback.
- A broad recursive live-state fingerprint probe was stopped after it proved too expensive; the e2e lifecycle receipt
  is the bounded containment authority. The bundled npm path changed after the Codex update; fallback pnpm created an
  untracked lock and rewired dependencies before failing. The generated lock was removed and exact `npm ci` restored
  committed-lockfile state; final manifests are unchanged.
- First full e2e was red at `103 + 1 flaky`; exact `3/3` and one unchanged `104/104` retry cleared the host gate while
  retaining the original red receipt. Precommit legitimately refused stale writer and capability manifests, which
  exact native Luna owners reconciled without production/test changes.
- Highest risk: persisted confirmation can become a false green after source, target, deploy, or profile drift. The
  pure owner refuses known drift; live target recomputation and the second-profile experience proof remain open.
