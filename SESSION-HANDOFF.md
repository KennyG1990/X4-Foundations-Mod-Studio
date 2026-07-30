# X4 Forge — Session Handoff

Updated: 2026-07-30

## One-line state

B109 Guided Nexus + Steam Release Center is VERIFIED and publicly delivered as Open VSX 0.0.59 with exact
public/local/installed artifact identity. The close commit/push is the current action; B110 Kimi R1-R21 is next.

## Operator brief

- Project: `F:\DEV_ENV\X4_Forge` (Forge application/Antigravity extension, not the live X4 mod).
- Machine state at handoff: Antigravity is open on the X4_Forge workspace with the installed 0.0.59 extension and
  an extension-owned sidecar on an ephemeral loopback port. No Steam/Nexus/Workshop upload was performed.
- Eyeball queue: none for B109—the installed Nexus guide, Steam guide, and Settings Express explanation were
  inspected and saved under `vscode-extension/evidence/b109-installed-*.jpg`.
- Authorization queue: none for B109. Ken authorized Open VSX publication; Steam/Nexus mod publication remains
  unrequested and out of scope.
- Commit question: Open VSX and store verification are complete; create/push the pre-written B109 close commit now.

## Current bounded task

### B109 status: VERIFIED; close commit/push in progress

Implemented:

- Separate `Package for Nexus Mods` and `Package for Steam Workshop` guided flows.
- Complete disk-backed, binary-safe Nexus ZIP with ZIP32/path/collision bounds, reopen CRC/SHA-256 validation,
  one exact mod root, user-selected final save, and receipt-backed final-byte verification.
- Steam CAT/DAT staging plus verified rollback ZIP; correct Egosoft `WorkshopTool.exe`; first/update preview rules;
  explicit `-minor`; visible but never auto-executed command; post-tool payload/manifest verification; guarded
  Workshop-id adoption.
- Guided is default. Settings-only Express explains that validation, output selection, Steam authentication/legal
  prompts, final verification, and no-auto-upload remain mandatory.
- Release Center remains visible when deploy/staging configuration is absent so it can explain its own failures.

Final artifact:

- `vscode-extension\x4-forge-studio-0.0.59.vsix`
- 2,090 entries; 17,840,878 bytes
- SHA-256 `859919BB8EF68469ADA404EFD224B350545EE1B1326F340B3DECD32BF3836910`
- Installed at `C:\Users\Moshi\.antigravity-ide\extensions\x4forge.x4-forge-studio-0.0.59`
- Installed controller/server/JS/CSS hashes match staged source; manifest identity matches and Antigravity adds only
  its expected `__metadata` top-level field.

Validation evidence:

- Platform release 24/24; distribution 31/31; native bridge 45/45; agent keys 25/25; history 67/67;
  release preferences 5/5.
- Isolated routes 227/227, focused Release Center E2E 3/3, full E2E 46/46, oracle sweep 115/115.
- Root typecheck/build, full lint (0 errors / 548 established warnings), graph refresh, and `git diff --check` passed.
- Final 0.0.59 root build, changelog generation, fresh staging, extension build, staged sidecar probe 6/6, VSIX audit,
  exact install, live public selftest 200/pass, protected config 401 negative, `git diff --check`, and the full
  post-version-bump `npm run precommit:check` passed.
- Open VSX publish succeeded; exact and latest endpoints report 0.0.59. The public artifact is exactly 17,840,878
  bytes and matches the installed/tested local SHA-256
  `859919BB8EF68469ADA404EFD224B350545EE1B1326F340B3DECD32BF3836910`.
- Durable screenshots:
  - `vscode-extension/evidence/b109-installed-nexus-guide.jpg`
  - `vscode-extension/evidence/b109-installed-steam-guide.jpg`
  - `vscode-extension/evidence/b109-installed-release-settings.jpg`

## First command / next action

1. Run final `npm run precommit:check` after all close-document edits.
2. Stage only the reconciled B109 code/docs/evidence plus the required StarForge documentation updates; preserve
   `scripts/x4_muds_game.mjs` and unrelated pre-existing evidence modifications.
3. Commit `feat(release): add guided verified Nexus and Steam packaging`, push `main`, and assert
   `origin/main == HEAD`.
4. Start B110 with the safety-contract batch (R3/R9/R10/R19/R20), updating the Kimi ledger after
   every bounded implementation.

## Live hazards and ownership

- Do not press either release build button against the restored DeadAir Dynamic Wars workspace; it is real user data.
  Artifact success/failure testing already passed in disposable fixtures.
- Do not run an Egosoft Workshop command or publish a Steam/Nexus mod. `WorkshopTool.exe` is not installed locally.
- Open VSX 0.0.59 is already published and verified; never republish the same version.
- Preserve unrelated untracked `scripts/x4_muds_game.mjs` and all unrelated bot/economy work.
- `C:\Users\Moshi\Desktop\SESSION-HANDOFFAG.md` is the preserved stale B108 buffer Ken asked to keep. It is not the
  current handoff and must not be copied back over this file.
- Existing modified 0.0.35 evidence images predate B109; do not claim or revert them.

## Hot files

- `BACKLOG.md`
- `docs/plans/2026-07-29-platform-release-center.md`
- `docs/plans/2026-07-29-platform-release-center-design.md`
- `docs/plans/2026-07-29-kimi-recommendations-ledger.md`
- `src/components/ReleaseCenter.tsx`
- `src/lib/platformRelease.ts`
- `src/lib/releasePreferences.ts`
- `src/lib/modDistribution.ts`
- `server.ts`
- `vscode-extension/src/nativeEditorBridge.ts`
- `vscode-extension/src/extension.ts`
- `scripts/route-integration.mjs`
- `tests/e2e/release-center.spec.ts`
- `vscode-extension/package.json`
- `vscode-extension/release-notes.json`
- `vscode-extension/CHANGELOG.md`

## Dead theories / corrected assumptions

- The official tool is `WorkshopTool.exe` from the separate Egosoft X Tools install, not `PublishTool.exe` or
  `X4Customizer.exe` in the game folder.
- Forge owns deterministic CAT/DAT generation; WorkshopTool owns interactive Steam authentication/upload.
- Steam output is staging + rollback/report, not one generic package file.
- Updates may omit preview; `-minor` requires an explicit unchanged-published-version acknowledgment.
- The installed host may append `__metadata` to `package.json`; compare manifest identity and executable payload
  hashes rather than demanding byte-identical manifest serialization.

## AAR state

Triggered and fully recorded in the B109 task record. Notable final-session triggers: retired CLI path, locked live
extension folder, protected unsaved surface, Desktop copy destination, PowerShell pipeline syntax error, protected
endpoint 401 used as a negative, the extra empty Antigravity welcome window requiring a second normal close, registry
propagation lag, and a staged-review catch/recovery of a truncated whole-file BACKLOG rewrite before commit.
