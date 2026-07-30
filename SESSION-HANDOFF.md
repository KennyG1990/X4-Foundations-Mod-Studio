# X4 Forge — Session Handoff

Updated: 2026-07-30

## One-line state

B110-R10 is VERIFIED and public Quality passed. B110-R19 packaged-VSIX CI is locally green but PARTIAL until its
implementation commit receives exact-SHA public Quality plus retained-artifact evidence; R20 follows.

## Operator brief

- Project: `F:\DEV_ENV\X4_Forge` (Forge application/Antigravity extension, not the live X4 mod).
- Machine state: Ken confirmed quiet. All R19 runtime validation used isolated temp state; no installed sidecar,
  real mod, game directory, Nexus, Steam, Open VSX, or live workspace was changed.
- Eyeball queue: none for R19. It is a headless clean-runner/package gate with no visible product control.
- Commit question: R10 commit `f28daf2` is pushed and public Quality `30568397225` passed. R19 is at its implementation
  commit point; stage only R19 paths under title `ci(extension): build probe and inspect packaged VSIX`, then require
  public proof before the VERIFIED close. Preserve the four unrelated dirty/untracked files.

## Current bounded task

### B110-R19 status: PARTIAL (public clean-runner gate pending)

Implemented:

- Existing Windows Quality now includes locked VSCE 3.9.2, extension build/stage, R10 process probe, package policy,
  final VSIX inspection, and 14-day artifact retention after the established root gates.
- Staged probe creates an isolated reference fixture on corpus-free runners while keeping the canonical completion
  assertion on this machine.
- Final inspector parses/decompresses the archive, verifies CRC/size/path/required payload/native binding, and rejects
  secret/runtime/map/build-machine content.

Validation:

- Inspector policy 12/12; hermetic staged probe 16/16; canonical staged probe 16/16.
- Locked final VSIX inspection PASS: 2,091 entries / 17,860,949 bytes / local SHA-256
  `85AD769A6E64A5EE76542B9BB0AF851C3126868CBBAB6CB6C2C903402546B8C1`.
- Typecheck, lint 0/548, oracles 119/119, build, routes 243/243, extension audit/build/stage/package all pass locally.
- Public implementation SHA/run/artifact: pending.

## Next action

1. Commit/push only R19-owned paths; assert `origin/main == HEAD`.
2. Wait for exact-SHA public Quality. Inspect its retained artifact metadata/download and rerun the checked-in
   inspector on the public VSIX. A public failure returns to implementation; no rerun-only close.
3. After public proof, move R19 to VERIFIED in ledger/ROADMAP/capability/AAR, overwrite this handoff, commit/push the
   close, then begin R20.

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

## R19-owned paths

- `.github/workflows/quality.yml`
- `vscode-extension/package.json`
- `vscode-extension/package-lock.json`
- `vscode-extension/scripts/probe-staged-app.mjs`
- `vscode-extension/scripts/inspect-vsix.mjs`
- `docs/plans/2026-07-30-packaged-vsix-ci.md`
- `docs/plans/2026-07-29-kimi-recommendations-ledger.md`
- `BACKLOG.md`
- `ROADMAP.md`
- `SESSION-HANDOFF.md`
- `F:\StarForge\wiki\x4-forge\capability-map.md`
- `F:\StarForge\wiki\x4-forge\aar-log.md`
- `F:\StarForge\wiki\workflow\aar-log.md`

## AAR state

Triggered. One wildcard search failed; first hermetic fixture probe was 15/16; first archive scan overgeneralized
generic user paths. Corrections are tested; public-run triggers and final lessons remain open. No product-data
mutation, publish, rollback, or acceptance weakening.
