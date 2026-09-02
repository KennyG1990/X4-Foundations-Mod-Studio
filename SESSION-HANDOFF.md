# Session handoff — B119 native export verified; effective-scale semantics correction next

Date: 2026-09-02
Project: `F:\DEV_ENV\X4_Forge`
Status: `IN_PROGRESS / PARTIAL`; installed native export and bounded geometry are `VERIFIED`, profile semantics failed

## Session-start brief

- Project: X4 Forge B119, the linter-first source-faithful X4 Lua UI editor. GitHub owner: #41.
- Current milestone: installed Forge exports the exact current native canvas; native comparison isolated the remaining
  large geometry discrepancy to user-scale versus effective `Helper.uiScale`, not the ported layout kernel.
- Eyeball queue: after the semantic correction, repeat installed `2544x1353 / user scale 1` export and compare with
  X4; then continue complete widget/Helper coverage, Zekton checks, AI Influence reconstruction, and keep-out review.
- Commit question: prior checkpoints through `7a500b74e618fc3aa9a17261edda3d1f936b4c9b` are pushed. The PNG export unit
  is fully validated but uncommitted in the broad dirty tree; explicit-path precommit/commit/push is next.

## What is proven

- The current Source Editor exports only its already-mounted `HTMLCanvasElement`; it does not rerender, encode through
  a second owner, add a backend route, or persist a duplicate bitmap.
- Export metadata binds exact source path/SHA, target identity, normalized drawable profile, effective scale, native
  dimensions, and the permanent `Preview evidence only · Not verified in game` boundary.
- Empty, refused, stale, non-DOM, malformed, dimension-mismatched, superseded, throwing, and empty-serialization cases
  refuse without false success. Async completion rechecks the exact issued identity key.
- The exact four-file `pipeline_test` package renders in X4 9.00; both buttons respond, the edit box accepts native
  input, standard close removes the panel, and the owned log has zero runtime/view-setup errors.
- Native Forge geometry at effective scale `1353/1080` is `663` pixels wide versus approximately `666` in X4, centered
  to less than one pixel. The `3`-pixel residual is `0.45%` and is within the current screenshot/JPEG comparison limit.

## Reproduced semantic defect

- `helper.lua` uses `Helper.uiScale = C.GetUIScale(false)` and scales X/Y by that value.
- `targetsystem.lua` documents that `C.GetUIScale(false)` practically combines the user scale factor with resolution
  scaling and shows `resolutionFactor = screenHeight / 1080`.
- Forge currently consumes its profile `uiScale` directly as the effective kernel scale while labeling the control
  merely `UI scale`. Entering X4's user setting `1` at height `1353` produced a `529`-pixel panel, not X4's `666`.
- Entering effective scale `1.25277777777778` produced `663` pixels. This explains essentially the full discrepancy.
- Next correction must preserve internal effective-scale receipts and distinguish/derive user scale explicitly rather
  than redefining the layout kernel.

## Identity, package, and rollback

- Baseline: `HEAD == origin/main == direct remote == 7a500b74e618fc3aa9a17261edda3d1f936b4c9b` before this unit.
- Isolated worktree: `C:\Users\Moshi\AppData\Local\Temp\x4forge-b119-png-8e0c3689772c469ca41d4fa31bb16b77`.
- VSIX: `vscode-extension/x4-forge-studio-0.0.70-b119-native-png-019fea10.vsix`; `2,092` entries;
  `18,600,594` bytes; SHA-256 `377B555B6CF8FFD9A24B3A2D1EAAA2C582C4E4A5EAEBCB7F6BA9E25A07835A21`.
- Installed extension: `C:\Users\Moshi\.antigravity-ide\extensions\x4forge.x4-forge-studio-0.0.70`.
- Backup/rollback: `C:\Users\Moshi\AppData\Local\Temp\x4forge-b119-install-backup-20260902-140638`.
- Installed extension host, supervisor, server, HTML, CSS, and frontend bytes match the reviewed package; installer-added
  package `__metadata` is the only expected semantic delta.
- Workspace: `ws_f61166c42849c757cf219c37`; deployed target:
  `G:\SteamLibrary\steamapps\common\X4 Foundations\extensions\pipeline_test`.

## Evidence

- Evidence root: `dev-docs/b119-x4-ui-pipeline-smoke/source-editor-ingame-20260902/`.
- Entered-scale-1 PNG: `forge-native-preview-export-2544x1353-scale1-20260902.png`; `84,189` bytes;
  SHA-256 `473173A568D1BA5B7405AE1314471FB8FD012E959E3BC597B5B28E3C7D4A076B`; bounds `529x161`.
- Corrected-effective-scale PNG: `forge-native-preview-export-2544x1353-effective-scale-1.252777778-20260902.png`;
  `90,917` bytes; bounds `663x203` at `x=940..1602`, `y=403..605`.
- X4 reference: `x4-panel-2544x1353-scale1-20260902.jpg`; panel approximately `666` pixels wide at `x=939..1604`.
- Installed Forge screenshot: `forge-native-preview-export-ui-2544x1353-scale1-20260902.jpg`.
- Full record: `docs/plans/2026-09-02-b119-canonical-source-editor-game-pipeline.md`.

## Validation

- Source Editor selftest/P7 `12/12`; whole-repository TypeScript; exact three-file ESLint; focused E2E `2/2`, zero
  failed/flaky/bad-result, `child-close`, `treeGone=true`; ports `3100/3101` stopped.
- Durable authority: audit `15/15`, fingerprint
  `619d094ae6fb0af1dbad963ca9086307f50ff0dc2962dca62a546475aa074ae0`; policy bundle `18/18` at `57` surfaces;
  candidate `57/57`; promotion `23/23`; coverage routes `82`, surfaces `57`.
- Isolated complete precommit passed; production build and extension build passed; package inspection passed; stage/probe
  `16/16` passed.
- Installed-host export passed twice. The second artifact proves the shipped-source resolution factor closes native
  width from `529` to `663` against X4's approximately `666`.
- Overall B119 remains `PARTIAL`: this is one accepted frame, not universal C++ acceptance, complete widget coverage,
  exact Zekton glyph parity, AI Influence completion, or release acceptance.

## Durable projections

- GitHub #41 remains open; prior read-back comment: `5512448232`.
- Notion owner: `3b84618e-d15b-8190-821e-c0eb96f43d5a`, `Status=In Progress`, `Evidence Grade=Partial`.
- Google Current Status doc: `17VLaIsT499KHg7zg30hOyLaBXB0-9jlrX3dQ63s3dtE`, tab `t.0`; prior revision
  `ANLCKQnsxhUytocioHZoSZ9nBJM6LYlVGnu4fP12TgwXXEYIXv8VYVSmlEsZ2ONWb82TTAFecuEXEUd0mSx2inNNzbUj97FOTABQRY1qRxhw`.
- These projections need the native-export checkpoint after repository commit/push and exact readback.

## Exact continuation

1. Run complete precommit on the main working tree, stage only the ten intended PNG-unit/record files, inspect the
   staged diff, commit `feat(ui-editor): export current native preview PNG`, push, and prove direct-remote parity.
2. Update/read back GitHub #41, Notion, Drive, and the X4 UI gotcha quick reference with the user-scale/effective-scale
   lesson. Keep all projections partial.
3. Reconcile profile readers/writers with Graphify and exact source search. Document the bounded semantic-correction
   acceptance contract before implementation.
4. Delegate implementation/tests to one exact native `luna_executor`; preserve `uiScale` as effective internal truth,
   add a user-scale input/derived effective display or equivalent narrow contract, and fail closed on invalid profiles.
5. Repeat focused gates, complete precommit/package/install proof, native PNG export, and X4 comparison. Do not publish
   OpenVSX until the separate release acceptance contract is met.

## Preservation boundary

- Preserve every unrelated modified, deleted, and untracked file in the broad working tree.
- Do not stage `test-results/.last-run.json`, `vscode-extension/package.json`, screenshots, release metadata, showcase
  files, neighboring plans, or any unrelated deletion.
- Current evidence PNG/JPG files are ignored and remain local receipts unless a later plan explicitly promotes them.
- X4 is absent; Antigravity and its managed sidecar are running. No active Luna worker remains.
