# Session handoff — B119 `pipeline_test` authorized pre-deploy checkpoint

Date: 2026-08-28
Project: `F:\DEV_ENV\X4_Forge`
Status: `IN_PROGRESS / PARTIAL / Not verified in game`

## Current state

- The operator supplied the exact gate: Antigravity open, X4 not running, machine quiet, and literal `go`.
- Host validation is green under bundled Node `v24.19.0`: complete precommit, production build, official oracle sweep
  `134/134`, serial isolated E2E `104/104`, and full ESLint exit `0`. ESLint has `0` errors and `592` existing
  warnings. The E2E verdict SHA-256 is
  `07A5BE43DC99415506CE85ACE263539FC426A0CEEECD13572CBD6E72597C7B39`; it proves `treeGone=true`, zero
  remaining child PIDs, free live/ephemeral ports, and unchanged persisted config.
- The staged UI-only package under `dev-docs/b119-x4-ui-pipeline-smoke/` remains exactly `content.xml` (`367`,
  `696c5c...`), `ui.xml` (`273`, `655331...`), and `ui/pipeline_test.lua` (`5378`, `b8f4c1...`). It has six UI
  widgets and no MD, AI, library, patch, translation, or gameplay-state content. The one-instance external validator
  receipt remains `b0bf7a6e...07bf`; package bytes have not changed, so it was not rerun.
- Both profiles at UI scale `1` and `1.4` still produce program counts `1/1/6/12` and `canRender=true`, but source-first
  geometry remains unusable with zero widgets/texts. This is not a frame/button capture and is not game proof.

## Runtime and exact authority

- Persisted Antigravity config SHA-256 is
  `355B4B636AD6C0BB3B58DEA793DE409C2375B8A81230433C0F0FDD48FBEE3B5A`; it names:
  - Mod Workspace: `F:\DEV_ENV\projects\Mods\X4Mods`
  - Game: `G:\SteamLibrary\steamapps\common\X4 Foundations`
  - Filesystem: `G:\SteamLibrary\steamapps\common\X4 Foundations\extensions`
  - Corpus: `F:\Downskies\x4unpackersuiteV1\X4 unpacked 9.00`
  - Deploy format: `loose`
- Antigravity Forge `0.0.70` is running on its private sidecar port. Its bundled server is
  `D27EDFA78255EE5B9919431A0AAE226C62BC9C97E9B0085C4F8A98C8938D3437` / `3,508,512` bytes. The freshly
  built current-checkout server is `64FE71D0C83007BDDAE09E1AD9C355F6D658182974E1A57FC2B6B24F8E53E121` / `3,509,970` bytes. They differ;
  launch the current checkout with `X4_CONFIG_DIR` pointed at the persisted config and isolated runtime state.
- Authorized writes are limited to:
  - `F:\DEV_ENV\projects\Mods\X4Mods\pipeline_test`
  - Forge's dedicated loose-build artifact for `pipeline_test`
  - `G:\SteamLibrary\steamapps\common\X4 Foundations\extensions\pipeline_test`
- Possible breakage is X4 startup/UI reload, Lua error, or C++ frame rejection. Rollback removes only the dedicated
  game extension after evidence and proves every pre-existing extension/root fingerprint unchanged. No save may be
  loaded without a separate gate.

## Dirty-file boundary and commit point

- Owned B119 implementation/test paths are the twelve `x4UiCallModel`, `x4UiLayoutProgram`, `x4UiScene`,
  `x4UiSourceEdits`, `x4UiPaintPlan`, and `x4UiCanvasRenderer` source/selftest files.
- Owned B119 records are `BACKLOG.md`, `SESSION-HANDOFF.md`, and
  `docs/plans/2026-08-10-b119-x4-ui-editor-linter-first.md`.
- Baseline is `HEAD == origin/main == edcb2a7d645d041d2a75253c0207bbafae7972fa`. Preserve all unrelated modified,
  deleted, and untracked paths. Stage only the fifteen explicit owned paths; never use broad staging.
- Suggested commit title: `feat(ui-editor): prepare B119 UI-only in-game pipeline smoke`.

## Hazards and AAR

- The raw oracle script was once called without its required server and returned `0/133`; the official owner passed
  `134/134`. The first full-lint receipt was lost to output truncation after the process had exited; process readback
  showed zero ESLint processes before a single successful evidence rerun.
- Host policy rejected one computed temporary-shim cleanup command before execution. The accepted ignored runtime shim
  contains only `node.cmd` and `npm.cmd`, selects bundled Node `24.19.0`, and changes no tracked product file.
- Highest-risk weakness remains unchanged: a convincing preview can still differ from X4 C++ frame acceptance. Keep
  `Not verified in game` until the visible host proves the dedicated frame and interaction.

## Eyeball queue

- After exact deploy-byte and debuglog baseline evidence, launch X4 to startup/main menu only. Confirm the authored
  panel appears, inspect its text/buttons/edit box, exercise the close and authored button surfaces, and capture a
  screenshot plus relevant debuglog interval. Repeat at a second UI-scale/display profile if the first profile passes.
- If the menu is unavailable before loading a save, stop. Do not open a save; present a separate save-specific gate.

## Next exact actions

1. Diff-check, explicitly stage the fifteen owned paths, commit, push, and prove local/tracking/direct-remote parity.
2. Start current-checkout `dist/server.cjs` with persisted config and isolated runtime state/token.
3. Through Forge project/compile/guarded-write owners, materialize only the exact UI-only `pipeline_test` source and
   read back byte hashes; run full project validation and the static negative gate.
4. Run deploy-verify dry-run, confirm exact effect/containment, apply only the dedicated target, and capture recovery
   authority plus surrounding-root fingerprints.
5. Launch X4 for visible truth, then roll back only `pipeline_test` after evidence. Update GitHub #41, Notion, Drive,
   capability map, plan, backlog, and this handoff at the promotion checkpoint.
