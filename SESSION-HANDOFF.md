# Session handoff — B119 brief 6/6; AI Influence benchmark next

Date: 2026-09-05
Project: `F:\DEV_ENV\X4_Forge`
Status: literal brief `6/6 VERIFIED`; overall B119 `IN_PROGRESS`

## Session-start brief

- Project: X4 Forge B119, the linter-first source-faithful X4 Lua UI editor. GitHub owner: #41.
- Eyeball queue: no operator check blocks the completed three-menu unit. The next visual unit must inspect all twelve
  supplied references under `C:\Users\Moshi\Desktop\# AI Influence mod UI design\design_handoff_ai_influence` and
  compare the Forge-authored result with those references before release acceptance.
- Commit question: the verified three-menu code/records are not yet committed. Complete precommit passed; stage only
  the exact B119 paths below, commit/push, then overwrite this line with the checkpoint hash.

## Current verified checkpoint

- Original brief rows 1 through 6 are now directly `VERIFIED`. This does not close the larger release program.
- Three separately registered `pipeline_test` Lua menus exercise unequal 3/4/5-column allocation, six row boundaries,
  standard text/button sizing, deterministic multiline wrapping, and deliberate no-wrap truncation.
- Existing owners were repaired, not duplicated:
  - LayoutProgram derives deterministic height when the only retained gap is finite displayed no-wrap overflow.
  - Scene applies `min(width, parentwidth - x)` and one common multiline line-box origin.
  - PreviewPipeline defaults no-wrap overflow to source-pinned ASCII `...`.
- Preview remains permanently non-authoritative. Exact deploy plus observed X4 behavior is still the game-truth gate.

## Exact source, runtime, and visual evidence

- Accepted Lua: `ui/pipeline_test.lua`, `13,202` bytes, `407` lines, SHA-256
  `E75DEF8CBED95537EEF9B7D3BCD05155F22B82DC4EEFE828B1D37D3626708EC0`.
- Exact identity agrees across guarded workspace, in-memory export, Forge staging at
  `F:\DEV_ENV\projects\Mods\X4Mods\.forge-builds\loose\pipeline_test`, installed X4 loose extension, Forge export
  authority, and X4 runtime. `F:\DEV_ENV\projects\Mods\X4Mods\pipeline_test` is the immutable imported source snapshot,
  not current staging.
- Native X4 accepted Menu A/B/C at drawable `2544x1353`, user scale `1.0`, effective Helper scale
  `1.2527777777777778`, and navigated `A -> B -> C -> A`. Scoped DisplayView/Lua/traceback signatures are zero.
- Forge PNG hashes: A `AAD06821...3908`, B `980EF382...0B2E`, C `B108CF27...1D8A`.
- X4 PNG hashes: A `38A6209C...9AE`, B `A3FF5AD6...37A`, C `3F2629A8...C9E`.
- Receipt `dev-docs/b119-x4-ui-pipeline-smoke/three-menu-parity-20260905/parity-receipt.json` accepts all three
  menus and exactly `125` geometry features, maximum delta `3 px <= 5 px`. Wrapped baselines and ending words match
  exactly; overflow strings match as `A_OVERFLOW_MARKER_AB...`, `B_OVERFLOW_MARKER...`, and `C_OVERFL...`.
- A non-deployed `6 px` Menu A boundary perturbation is rejected with `NUMERIC_DELTA_EXCEEDED`. All six source images
  were hash-checked and visually inspected; the classifier itself validates declared measurements and does not decode
  pixels.

## Installed package and validation

- Installed private package:
  `vscode-extension/x4-forge-studio-0.0.70-b119-ellipsis-parity-20260905.vsix`, `26,292,779` bytes, `2,107` entries,
  SHA-256 `541CF6CD33BCF3322EFD1017F75F5DB379E73F66D555C51DED44F638B78570D6`. Package/install parity is exact.
- Installed sidecar PID `66324` is healthy at `http://127.0.0.1:57771/`; X4 is stopped. Pipeline Test workspace record
  remains `16,570` bytes / SHA-256 `168EF21392FFB7897CD001F77BB927E2E9A7B3A8757A23DF57C0E9EA6E4D339B`.
- Focused: TextLayout `13/13`; Scene `178/178`; PreviewPipeline `117/117`; parity classifier `26/26`; LayoutProgram
  `705` pass plus `1` skip; typecheck; zero-error targeted lint.
- Production build `1,848` modules; staged-app probe `16/16`; installed runtime oracles `134/134` using the supported
  `60,000 ms` timeout.
- Full serial E2E passes `106/106`, zero failed/flaky/bad/quarantined-blocking, verdict SHA-256
  `9E15D34F158F5693D5E7DE26F3B2F919186C60BC6C799939A63612ABC202D33B`, `treeGone=true`; ports `3100/3101` are
  closed and the live workspace hash is unchanged.
- Complete `npm run precommit:check` passed exit `0` after record edits. Graphify is refreshed to `10,344` nodes /
  `25,894` edges / `342` communities.

## Exact owned commit set

- `docs/plans/2026-08-10-b119-x4-ui-editor-linter-first.md`
- `docs/plans/2026-09-03-b119-three-menu-pixel-parity.md`
- `BACKLOG.md`
- `SESSION-HANDOFF.md`
- `src/lib/x4UiLayoutProgram.ts`
- `src/lib/x4UiPreviewPipeline.ts`
- `src/lib/x4UiPreviewPipeline.selftest.ts`
- `src/lib/x4UiScene.ts`
- `src/lib/x4UiScene.selftest.ts`
- `src/lib/x4UiTextLayout.selftest.ts`
- `scripts/x4-ui-parity-receipt.ts`
- `scripts/x4-ui-parity-receipt.selftest.ts`

Do not stage ignored screenshots/receipts/VSIX files or any unrelated modified, deleted, and untracked path.

## Current next units

1. Run complete precommit, explicit-path stage/review, commit/push this verified checkpoint, and assert
   `origin/main == HEAD`.
2. Write/read back GitHub #41, Notion owner `3b84618e-d15b-8190-821e-c0eb96f43d5a`, and Google Current Status
   document `17VLaIsT499KHg7zg30hOyLaBXB0-9jlrX3dQ63s3dtE` tab `t.0`; record the exact external IDs/revision.
3. Inspect all twelve AI Influence reference images visually, reconcile their specification/source, and author the real
   Lua UI through Forge as the final dogfood benchmark.
4. Repair native Save As false-success wording, rerun release acceptance, then perform the separately required OpenVSX
   publish-before-commit sequence. Public version remains `0.0.69`; installed `0.0.70` is private.

## AAR and preservation

- First oracle sweep was `133/134` because one clean endpoint required `20.94 s` under a `20 s` default; supported
  `60 s` rerun passed `134/134`.
- First E2E run passed `23` cases before Windows child exit `0xC0000409` produced no verdict. It failed closed; ports
  and live workspace were verified safe before one unchanged complete `106/106` retry.
- Identify repeated folder names by owner: import source, workspace state, build staging, and installed target are
  separate authorities.
- No native Luna worker remains open. Any implementation/test edit requires one exact native `gpt-5.6-luna`
  `luna_executor`, max reasoning, bounded non-overlapping ownership.
- External projection readback for this checkpoint is pending. Repository Markdown remains authoritative.
