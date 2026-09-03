# Session handoff — B119 brief 4/6; scale equivalence verified

Date: 2026-09-03
Project: `F:\DEV_ENV\X4_Forge`
Status: literal brief `4/6 VERIFIED / 2/6 PARTIAL`; overall B119 `IN_PROGRESS / PARTIAL`

## Session-start brief

- Project: X4 Forge B119, the linter-first source-faithful X4 Lua UI editor. GitHub owner: #41.
- Biggest milestone: Forge's actual user-scale control now matches X4's actual Game Settings UI-scale change at one
  fixed `2544x1353` drawable. This directly closes original brief row 3 without conflating resolution scaling.
- Eyeball queue: none for the completed scale unit. Remaining visible acceptance is three complete real-menu
  column/row/wrap/truncation comparisons and context-grounded rendering for all four keep-out presets.
- Commit question: scale checkpoint `3367c6846431b0ac85b1ab8081ce8a9657ded45d` is pushed with exact local,
  tracking, and direct-remote parity. Commit this projection/readback close next as
  `docs(ui-editor): record scale checkpoint projections`, with exact path staging only.

## Current bounded result

- Original brief rows 1, 3, 4, and 6 are `VERIFIED`; rows 2 and 5 remain `PARTIAL`.
- X4 visibly read user scale `1.0`, accepted exactly one shipped `0.1` step to `1.1`, rendered the unchanged
  `pipeline_test` fixture, and was restored to `1.0`.
- Installed Forge rendered/exported the same exact source at `1.0` and `1.1`, then was restored to `1.0`. Its
  effective Helper scale read `1.2527777777777778` and `1.3780555555555558`.
- Forge panel width changed `663 -> 729` (`1.099547511x`). X4 primary, secondary, and input widths changed
  `659 -> 723`, `654 -> 721`, and `656 -> 723`; Forge/X4 ratio disagreement is only `0.221061-0.263651%`.
- After the one-pixel side border and 31-pixel title offset, corresponding control edges differ by at most four
  horizontal and three vertical pixels. Both ratio and few-pixel gates pass.
- Exact task record: `docs/plans/2026-09-03-b119-fixed-drawable-user-scale.md`.
- Machine receipt:
  `dev-docs/b119-x4-ui-pipeline-smoke/user-scale-20260903/fixed-drawable-user-scale-receipt.json`; eight paired PNGs
  are adjacent.

## Identity, restoration, and runtime truth

- Workspace and deployed `pipeline_test.lua` are both `5,488` bytes /
  `C1D9CD8580C6175E95C543259A2AB19F8B463282BF48B2229EB6013D6052718E`.
- Workspace and deployed `content.xml` are both `367` bytes /
  `23A7E9A5D789DD31B5BFBFDCF7D9A6B63CB33971170C3C0E64438C77B52A5034`.
- X4 process count is zero. Installed Forge remains open on sidecar port `52236`, workspace `Pipeline Test UI ·
  219c37`, exact source `ui/pipeline_test.lua -> menu.createFrame`, user scale restored `1.0`.
- Current debuglog SHA-256 is `FC91FD29261684E953525C5161BC9EE8644C3F39F79D443DF25C1ACECA2AB7CC`.
  Scoped `DisplayView`/view-setup, Lua runtime/traceback, and owned-pipeline failure matches are zero. Existing unsigned-
  mod signature warnings plus unrelated AI Influence/missing-loadout `[=ERROR=]` markers remain baseline noise.
- Profile safety copy remains at
  `C:\Users\Moshi\AppData\Local\Temp\x4-b119-ui-scale-baseline-20260903-0545`; normal in-game restoration succeeded,
  so copied profile files were not written back.

## Product finding retained

- The installed Forge export handler can display `exported one image/png` when accessibility invocation fires before
  native Save As completes or any file exists. The two current exports are valid because physical Save As completed
  and exact files/hashes were verified; status text alone is not evidence.
- Treat repair of this false-success wording/completion contract as pre-release B119 work. Do not let it displace the
  two still-open original acceptance rows unless it blocks their evidence capture.
- X4 slider-track activation can stage an extreme value (`1.8` here). It was never confirmed. Use the inner arrow for
  one-step tests and visibly read back the value before capture.

## Durable projection readback

- Repository source checkpoint: `3367c6846431b0ac85b1ab8081ce8a9657ded45d`; complete precommit passed and local,
  tracking, and direct-remote `main` were equal after push.
- GitHub owner #41 remains open. Comment `5525209644` was written and read back with the exact scale result, `4/6`
  original-brief boundary, and two remaining rows.
- Notion owner `3b84618e-d15b-8190-821e-c0eb96f43d5a` was read back at `Status=In Progress` and
  `Evidence Grade=Partial`, with the commit/comment and fixed-drawable heading present.
- Google Current Status document `17VLaIsT499KHg7zg30hOyLaBXB0-9jlrX3dQ63s3dtE`, tab `t.0`, was revision-guarded
  and read back at revision
  `ANLCKQne8OZbPRb6PHRufzwKLfOLH_yusLOGNaGOZWrm2Mz1LvS0zORn0mWt1LL1aiEtm0C9T448JOcLMBrxp3lttyQAiHPnSCID-JbAycdV`.
- The first Drive append placed the new heading on the preceding paragraph and styled both as `HEADING_2`. An exact
  index repair inserted the missing paragraph boundary, restored the preceding paragraph to `NORMAL_TEXT`, and was
  read back before acceptance.

## Next bounded unit

1. Commit/push this four-file projection/readback close with exact staging and prove local/tracking/direct-remote parity.
2. Reconcile `src/lib/x4UiKeepOuts.ts`, its paint consumer, four presets, shipped UI owners, and retained X4 screenshots.
   Calibrate only geometry supported by shipped source or new screenshots; never convert an unavailable placeholder
   into a measured overlay. Close row 5 only when all four context presets visibly paint and toggle per canvas.
3. Then select three complete real-menu fixtures for row 2. Each needs columns, row heights, wrap points, and
   truncation positions measured in both Forge and X4. Current static COMM-header evidence is insufficient.
4. After rows 2 and 5, inspect all twelve AI Influence reference images and build the supplied UI through Forge as the
   final dogfood benchmark. OpenVSX remains deferred until release acceptance and publish-before-commit preparation.

## Preservation and credential boundary

- Preserve every unrelated modified, deleted, and untracked repository path. Never stage by broad glob or `git add .`.
- Do not stage screenshots, VSIX files, `test-results/.last-run.json`, release metadata, deleted scripts/data, showcase
  assets, unrelated plans, or user work. The ignored evidence receipt/PNGs stay durable on disk but outside source Git.
- No native Luna worker is open. Sol may update records; any implementation or test edit requires one exact native
  `gpt-5.6-luna` `luna_executor` with a bounded non-overlapping work order and max reasoning.
- Temporary deploy credential remains at
  `C:\Users\Moshi\AppData\Local\Temp\codex-b119-runtime-20260903.key`. Do not print, delete, or revoke it without an
  explicit credential action.
- No OpenVSX release is claimed. Public version remains `0.0.69`; installed B119 candidate remains private `0.0.70`.
