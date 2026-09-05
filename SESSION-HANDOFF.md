# Session handoff — B119 brief 5/6; four-context keep-outs verified

Date: 2026-09-05
Project: `F:\DEV_ENV\X4_Forge`
Status: literal brief `5/6 VERIFIED / 1/6 PARTIAL`; overall B119 `IN_PROGRESS / PARTIAL`

## Session-start brief

- Project: X4 Forge B119, the linter-first source-faithful X4 Lua UI editor. GitHub owner: #41.
- Eyeball queue: none for the completed four-context unit. The remaining original-brief proof is three complete real
  Lua menus compared between Forge and X4 for columns, rows, wrapping, and truncation. The final dogfood benchmark then
  requires visual inspection of all twelve supplied AI Influence references.
- Commit question: the verified four-context unit is committed and pushed at
  `8b97ea556a13a638dd7db157883687dc79a9d6ce`; local, tracking, and direct-remote refs matched at close.

## Current verified checkpoint

- Original brief rows 1, 3, 4, 5, and 6 are `VERIFIED`; row 2 remains `PARTIAL`.
- Four retained X4 9.00 contexts now drive exact installed Forge keep-outs through the existing issued
  KeepOut -> Session -> Paint -> Canvas chain:
  - cockpit-conversation: three measured guides plus the MESSAGES polygon (`4` applicable members),
  - map-open: shared top-HUD polygon (`1`),
  - fullscreen-menu: shared top-HUD polygon (`1`),
  - first-person: MESSAGES polygon (`1`).
- Structural clones, stale projections, wrong contexts, duplicate IDs, malformed geometry, and unavailable members fail
  closed. The measured values stay `y=0.788`, `y=0.74`, and `x=0.664`; no INFORMATION rectangle was invented.
- The installed stale-parent-snapshot race is repaired. A non-null parent verification snapshot is emitted only after
  the exact Canvas is `rendered/current`, mounted, non-stale, and bound to the same PNG-export identity.

## Installed and visual evidence

- Installed private package:
  `vscode-extension/x4-forge-studio-0.0.70-b119-four-context-snapshot-order-20260905.vsix`, SHA-256
  `737A755251BCD1B71D05C53F9040B7B631423D0BDE41F7AAD649C8B5FE40EA9E`, `2,107` entries, `26,290,386` bytes.
- Package/install comparison: `2,105` expected payload files, zero missing, zero mismatched, zero unexpected; the sole
  installed extra was the allowed IDE-owned `.vsixmanifest`.
- Installed sidecar PID `19540` remains healthy at `http://127.0.0.1:54624/`; exact source
  `ui/pipeline_test.lua` SHA-256 `C1D9CD8580C6175E95C543259A2AB19F8B463282BF48B2229EB6013D6052718E` and target
  `menu.createFrame` render on a native `2560x1440` Canvas. X4 process count is zero.
- All four preset buttons and all seven applicable checkboxes passed independent off/on interaction. Every disable
  changed the native Canvas hash; every re-enable restored the exact all-on hash while source/target identity and
  `Not verified in game` stayed stable.
- Receipt and twenty PNGs:
  `dev-docs/b119-x4-ui-pipeline-smoke/keepouts-20260903/forge-four-context/receipt.md`.

## Validation and review

- Focused: KeepOuts `9/9 + 18/18`; PaintPlan `186/186`; CanvasRenderer `155/155`; EditorSession `8/8 + 7/7`;
  SourceEditor P8 `13/13`; whole-repository typecheck and exact nine-path ESLint pass.
- Production build `1,848` modules; staged-app probe `16/16`; strict package inspection and installed byte parity pass.
- Complete `npm run precommit:check` passes.
- Installed runtime oracles pass `134/134`.
- Full serial e2e passes `106/106`, zero failed/flaky/bad/quarantined-blocking, child exit `0`, complete report,
  `treeGone=true`; ports `3100/3101` are closed and the live installed sidecar remains HTTP `200`.
- Graphify refreshed to `10,257` nodes / `25,719` edges / `318` communities. Reverse traversal reaches only expected
  UI editor/session/preview/paint/canvas consumers. Fresh-eyes review found no blocking issue.

## Current bounded next unit

1. Execute `docs/plans/2026-09-03-b119-three-menu-pixel-parity.md`: three separately registered Forge-authored Lua
   menus, fixed profile, direct column/row/wrap/truncation measurements, `<=5 px` acceptance, exact deploy identity,
   X4 screenshots, and scoped runtime logs.
2. After row 2, inspect all twelve images under
   `C:\Users\Moshi\Desktop\# AI Influence mod UI design\design_handoff_ai_influence` and author the real Lua through
   Forge as the final benchmark.
3. Repair native Save As false-success wording before release. OpenVSX remains deferred until release acceptance and
   publish-before-commit preparation.

## Durable projection receipt

- GitHub #41 comment `5550124777` was written and read back; the issue remains open.
- Notion owner `3b84618e-d15b-8190-821e-c0eb96f43d5a` was written and read back at `In Progress / Partial` with the
  exact `5/6` checkpoint.
- Google Current Status document `17VLaIsT499KHg7zg30hOyLaBXB0-9jlrX3dQ63s3dtE`, tab `t.0`, was trusted-read,
  revision-guarded, written, and structurally read back at
  `ANLCKQmmV5DbvTyHnpcg-W_JJbmRqZvOZF7Dt_eETxHSKsR8BCnBACfrINJDNbgKRxChLcCD-r3RMZMVK_ozoeJH_ZCYMSEeY1iKtAf7vEQY`.

## AAR and preservation

- Wait for corpus state `canonical` before source/target interaction; pre-readiness refusal is a timing result.
- CUA deep-scroll activation can return without changing an enabled button. Require rendered state change; ordinary
  installed-sidecar Playwright is the accepted deterministic control oracle here.
- A clipped viewport can hide a lower keep-out mutation. Export and hash the native full Canvas before calling the
  visual comparison unchanged.
- The first raw oracle sweep used its dead default `localhost:3001`; rerunning through supported
  `X4_FORGE_BASE=http://127.0.0.1:54624` passed `134/134`.
- Preserve every unrelated modified, deleted, and untracked path. Never stage by broad glob or `git add .`. Do not
  stage screenshots, VSIX files, `test-results`, release metadata, deleted scripts/data, showcase assets, unrelated
  plans, or user work.
- No native Luna worker remains open. Any implementation/test edit requires one exact native `gpt-5.6-luna`
  `luna_executor`, max reasoning, bounded non-overlapping ownership.
- No OpenVSX release is claimed. Public version remains `0.0.69`; installed B119 candidate remains private `0.0.70`.
