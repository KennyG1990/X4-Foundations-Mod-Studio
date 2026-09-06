# Session handoff — B119 deterministic-math `0.0.72` released; AI benchmark remains open

Date: `2026-09-06`
Project: `F:\DEV_ENV\X4_Forge`
Status: bounded deterministic-math/release/install/public-parity unit `VERIFIED`; overall B119
`IN_PROGRESS / PARTIAL / Not verified in game`

## Session-start brief

- **Project identity:** X4 Forge B119, the linter-first source-faithful X4 Lua UI editor; GitHub owner #41.
- **Eyeball queue:**
  1. In installed Forge, select workspace `x4 AiLive` -> `HUD & Lua UI` -> exact source
     `ui/addons/ai_influence_chat/aic_menu.lua` -> target `menu.display` -> enter the displayed owner-issued samples,
     ending with `_choiceY = 979`. Confirm the native Canvas shows the low edit box plus `SEND` and `END`, and that
     the page still says `Not verified in game`.
  2. For the remaining AI benchmark, launch X4 -> load the current proving save -> use `Speak to AI` -> capture the
     selected compact direction, expanded COMM, proposal gate/sheet, and each hub tab through valid current paths.
     Compare only against Forge output with the same source hash, drawable, scale, samples, and branch selections.
     Do not treat missing runtime body content as a preview success or a game failure.
- **Commit question:** pending at this handoff write. Parent checkpoint is
  `596ef0c79ac3c574ed1ca1af96840705388e24c2`; intended commit title is
  `feat(ui-editor): resolve source math geometry and publish 0.0.72`. Run final precommit, stage only the listed
  owned paths, commit/push, and assert local/tracking/direct-remote parity.

## Exact current evidence

- Intended implementation/test paths:
  `src/lib/x4UiCallModel.ts`, `src/lib/x4UiCallModel.selftest.ts`, `src/lib/x4UiLayoutProgram.ts`, and
  `src/lib/x4UiLayoutProgram.selftest.ts`. Release paths:
  `vscode-extension/package.json`, `vscode-extension/release-notes.json`, and
  `vscode-extension/CHANGELOG.md`. Records: this file, `BACKLOG.md`, and
  `docs/plans/2026-09-02-b119-canonical-source-editor-game-pipeline.md`. Preserve every other dirty path.
- Focused gates: call model `102/102`; layout `721 passed / 1 standing skip / 722 total`; linter `140/140`;
  whole-repository TypeScript, exact four-file ESLint, and diff hygiene green. The fifteen reproduced false-known
  math/global mutation paths now fail closed; pure/non-math/Helper/post-use controls remain known.
- Real-source probe: exact current `aic_menu.lua -> menu.display`, SHA-256
  `4253D9BD9DE4113D4DE0B881DBF5A1E90CAA7B30F735BA925403EBEF7EC47DD7`, `parsed=true`, projection `partial`,
  resolved `px=600`, resolved `tw=1050`, one `_choiceY` occurrence, and `19` samples total.
- Broad gates: oracle wrapper `134/134`; serial E2E `106/106`, zero failed/flaky/bad/quarantined, `treeGone=true`,
  ports `3100/3101` closed; production build `1,848` modules; staged app probe `16/16`; and complete precommit green
  after the final release and record edits (`12` capabilities / `297` routes, `82` receipt routes / `57` surfaces,
  typecheck and size guards included).
- Live mod workspace stayed clean at `4c0a422b7e3d0f492b572b9da8d2d7ea19a2b453`. Excluding `.git`, payload
  fingerprint is `127 files / 19 directories / 11,262,724 bytes /
  9B1A0021A22927D55168A8904C255CEDC630853DB02B07389A64742E269C0BEC`.

## Release / install / rendered-host proof

- Local stable VSIX: `F:\DEV_ENV\X4_Forge\vscode-extension\x4-forge-studio-0.0.72.vsix`, `2,107` archive
  entries / `2,105` payload files, `26,303,425` bytes, SHA-256
  `5C6B2C20C42E93359DED03DBF199F00C1C858AFCC579388F10F94818CDDEA4B0`. Package inspection found no secret or
  machine-path leak.
- OpenVSX publication succeeded once. `/latest` and direct version endpoint now return `0.0.72`; independent public
  download is exactly `26,303,425` bytes with the same SHA-256. Do not republish.
- Retained prior install:
  `C:\Users\Moshi\AppData\Local\Temp\x4forge-b119-0.0.71-final-install-backup-20260906T024434135Z`.
  Installed `0.0.72` matches all `2,105` package files with only expected `.vsixmanifest`; Antigravity is open.
  Installed sidecar is port `60966`, one supervisor plus one server, root HTTP `200`, configured corpus exact,
  unauthenticated config `401`, runtime oracles `134/134`.
- Exact installed target exposes `19` preview-only samples and `33` branch boundaries. The unsampled state refuses
  source composition. Supplying the first eleven required samples, ending with `_choiceY=979`, produces
  `rendered/current` and one native `2560x1440` Canvas. Visual inspection confirms only the source-static edit box,
  `SEND`, and `END`; runtime rail/transcript/choice content is not invented.
- Retained screenshot:
  `dev-docs/b119-ai-influence-dogfood/installed-release-20260906/installed-0.0.72-menu-display-sampled-current-2560x1440.png`,
  `45,676` bytes, SHA-256
  `5286095C6B16A15230D79F770B4FB6CD026B80BC08F59E32D215FC4AD37D6A8F` (evidence directory is intentionally
  ignored by Git). A later refused branch state retained that bitmap as `stale`, proving current-only replacement.
- X4 is stopped. No mod/game/settings/save/corpus byte changed in the `0.0.72` parser-only release. Prior same-source
  X4 receipts remain valid evidence for their bounded runs but do not make this preview game-verified.

## Current boundary and next bounded unit

- The original literal UI-editor brief has retained linter and three-menu same-source Forge/X4 evidence, including
  `125` measured features with maximum normalized delta `3 px <= 5 px`. This release closes the real-source math
  geometry gap and public distribution of that repair.
- Overall B119 remains open because the full twelve-reference AI Influence reconstruction/current-path visual census,
  complete runtime-built menu bodies, and universal Helper/widget/C++ frame acceptance are not proven. `1f` remains
  data-blocked by its missing deterministic pricing contract. Preview always remains `Not verified in game`.
- Next bounded unit after commit/projection close: launch X4 only if needed for a genuinely new same-source comparison;
  otherwise continue the exact AI reference census from the existing retained captures and identify the smallest
  missing source/sample/path capability. Do not reopen already-proven three-menu parity or mutate the live mod without
  a new reconciled acceptance contract.

## Close / AAR state

- No capability-map delta. Project UI gotcha card `40` records the verified source-visible math-authority lesson.
- Triggered failures to retain: direct oracle without its server (`0/133`) before wrapper pass; one E2E pre-discovery
  `0xC0000409` before `106/106`; initial workspace fingerprint accidentally included `.git`; OpenVSX indexing lag;
  blank Electron installer output; supervisor/server process double-count; computer-use controlled-select mismatch;
  first headless replay on the wrong workspace; expensive all-input projection replay; and unsupported
  `New-Item -LiteralPath` before exact public-download retry.
- External GitHub #41, Notion owner `3b84618e-d15b-8190-821e-c0eb96f43d5a`, and Google Current Status document
  `17VLaIsT499KHg7zg30hOyLaBXB0-9jlrX3dQ63s3dtE` still need this `0.0.72` checkpoint written/read back after the
  source commit exists. Keep all three `In Progress / Partial`; do not close B119.
