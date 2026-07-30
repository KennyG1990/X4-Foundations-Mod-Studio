# X4 Forge — Session Handoff

Updated: 2026-07-30

## One-line state

B110-R19 packaged-VSIX CI is VERIFIED on the clean public runner; R20 flake policy is the next bounded Kimi unit.

## Operator brief

- Project: `F:\DEV_ENV\X4_Forge` (Forge application/Antigravity extension, not the live X4 mod).
- Machine state: Ken confirmed quiet. R19 used isolated temporary state and GitHub CI; no installed sidecar, real mod,
  game directory, Nexus, Steam, Open VSX, or live workspace was changed.
- Eyeball queue: none for R19. It is a headless clean-runner/package gate with no visible product control.
- Commit question: implementation commits `dc70745` and `c0505cd` are pushed; `origin/main == HEAD == c0505cd`.
  Commit the R19 durable close under `docs(ci): verify packaged VSIX clean-runner gate`, then specify R20.

## B110-R19 close: VERIFIED

Implemented:

- Existing Windows Quality now runs locked root/extension installs and audits, root gates, extension build, fresh
  app stage, real 16-check sidecar process probe, 13-check VSIX inspector selftest, pinned VSCE package, final archive
  inspection, and inspected-only 14-day artifact retention.
- The staged probe creates an isolated reference fixture on corpus-free runners while local real-corpus runs keep the
  exact 32-faction assertion.
- The final inspector parses/decompresses the archive, verifies bounds/CRC/size/required payload/native binding, and
  rejects unsafe/duplicate names, secrets/runtime state/maps, and exact first-party build paths. GitHub failures emit
  exact annotations.

Evidence:

- Local inspector 13/13; hermetic/canonical staged probes 16/16; routes 243/243; oracles 119/119; typecheck, lint
  0 errors/548 warnings, build, precommit, and graph refresh passed.
- First public run `30569511806` failed closed at final inspection and skipped upload. The scoped provenance
  correction passed locally and was pushed as `c0505cdcf59aaa95ef90960a3528506558cdf942`.
- Corrective Quality run `30570137452` / job `90964477954` passed critical steps 15-19 and retained artifact
  `8770489130`, 17,509,178-byte outer artifact, expiring 2026-08-13.
- Anonymous artifact download returns GitHub 401; no post-upload byte replay is claimed. The exact VSIX passed the
  checked-in byte inspector immediately before upload, and public metadata proves retention.

## Next action

1. Commit/push only R19 close records; assert `origin/main == HEAD`.
2. Create the Full-lane R20 plan. Reconcile `scripts/run-e2e.mjs`, Playwright configuration, public Quality, prior
   one-off Vite loss, and Kimi's explicit owner/threshold/expiry/quarantine requirement.
3. Prove with synthetic fixtures that flaky results are red by default and any permitted quarantine cannot hide a
   product failure; preserve the existing verdict selftest and clean-runner CI.
4. After R20, execute Kimi in ledger order: R1+R16, R6, R2, R11+R14, R8+R17, R13, R18+R21, final reconciliation.
5. Only after R1-R21 close, begin the queued two-document community-tool research program in `BACKLOG.md`.

## Live hazards and ownership

- Preserve unrelated modified files:
  - `vscode-extension/evidence/0.0.35-runtime-copy-live.png`
  - `vscode-extension/evidence/0.0.35-runtime-copy-startup.png`
- Preserve unrelated untracked files:
  - `Note for Kimi.md`
  - `scripts/x4_muds_game.mjs`
- Do not publish a new extension version for internal safety units without a separately scoped release task.
- Raw `node scripts/oracle-sweep.mjs` assumes a running target; use `npm run test:oracles` when no server is running.
- Do not rerun a flaky gate to manufacture green. R20 owns the explicit evidence/owner/expiry policy.

## R19-owned close paths

- `BACKLOG.md`
- `ROADMAP.md`
- `SESSION-HANDOFF.md`
- `docs/plans/2026-07-29-kimi-recommendations-ledger.md`
- `docs/plans/2026-07-30-packaged-vsix-ci.md`
- `F:\StarForge\wiki\x4-forge\capability-map.md`
- `F:\StarForge\wiki\x4-forge\aar-log.md`
- `F:\StarForge\wiki\workflow\aar-log.md`

## Suggested close commit title

`docs(ci): verify packaged VSIX clean-runner gate`
