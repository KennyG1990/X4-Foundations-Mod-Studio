# B119 three real-menu pixel parity

Date: 2026-09-03
Lane: FULL
Status: `BOUNDED VERIFIED / ORIGINAL BRIEF 6/6 VERIFIED / OVERALL B119 IN_PROGRESS`
Owner issue: GitHub #41
Parent: `docs/plans/2026-08-10-b119-x4-ui-editor-linter-first.md`

## PLAN

- **Bounded unit:** close original brief acceptance row 2 with direct Forge-versus-X4 pixel evidence for three
  separately registered, Forge-authored real Lua menus in the existing `pipeline_test` UI-only mod.
- **Assumptions:** the current four-context keep-out unit closes first; X4 remains the visual authority; the configured
  unpacked 9.00 corpus supplies `helper.lua`, `widget_fullscreen.lua`, and Zekton metrics; a purpose-built menu that is
  registered, deployed, accepted, and visibly rendered by X4 is a real menu for this row.
- **Authoritative references:** the supplied `FORGE-UI-EDITOR-BRIEF.md` acceptance row 2; configured X4 9.00
  `ui/addons/ego_detailmonitorhelper/helper.lua`; configured X4 9.00 `ui/widget/lua/widget_fullscreen.lua`; the exact
  installed Forge candidate and exact deployed Lua bytes.
- **In scope:** three static-literal menu fixtures authored through Forge; each fixture includes unequal column
  boundaries, at least one standard text row, one button row, one wrapped paragraph with deterministic line breaks,
  and one deliberately overflowing non-wrapped string whose visible truncation position is measurable.
- **Out of scope:** runtime-generated AI Influence body data, broad renderer refactors, new widget vocabulary, an
  OpenVSX release, and the later twelve-image AI Influence reconstruction benchmark.
- **Existing infrastructure reused:** the `pipeline_test` workspace/mod, Source Editor exact source/target selection,
  configured corpus loader, sample-free static layout program, Canvas native PNG export, validated Forge deploy path,
  X4 screenshot workflow, and current image-coordinate receipt scripts.
- **Risks and authorization boundaries:** the user explicitly authorized Forge workspace mutation, validated deploy,
  X4 launch, and computer-use. The existing `pipeline_test` workspace and deployed mod are snapshotted by exact bytes
  and hashes before mutation. No AI Influence mod or public extension release is touched.
- **Rollback/checkpoint:** restore the pre-unit Forge workspace snapshot and pre-unit deployed `pipeline_test` bytes,
  redeploy through Forge, then prove byte/hash parity and zero X4 process count.
- **Evidence locations:**
  `dev-docs/b119-x4-ui-pipeline-smoke/three-menu-parity-20260903/`, with one Forge PNG, one X4 PNG, one measurement
  overlay, and one machine-readable receipt per menu plus a combined verdict JSON.

## ACCEPTANCE CONTRACT

1. Forge creates and deploys three separately registered Lua menus through the existing workspace/deploy authority;
   workspace, export, deployed bytes, and selected Source Editor identity are hash-bound per menu.
2. Each menu is visibly accepted and rendered by X4 at a fixed `2544x1353` drawable and X4 user UI scale `1.0`, with
   scoped frame/view/Lua failure signatures absent.
3. The installed Forge renders and physically exports the same exact source/target at the same drawable and user
   scale. Status text without a physical PNG is not evidence.
4. After normalizing only proven host chrome/crop offsets, every declared column boundary and row boundary differs by
   at most `5 px` between Forge and X4 for all three menus.
5. Every declared wrapped line ends at the same word and its baseline differs by at most `5 px`; every declared
   non-wrapped overflow resolves to the same visible truncated text and its final visible glyph boundary differs by at
   most `5 px`.
6. A deliberately perturbed analysis copy with one boundary shifted by more than `5 px` is rejected by the receipt
   classifier. The perturbed copy is never deployed.
7. A human visual review of all six source images and all three overlays finds no unmeasured acceptance claim. X4
   remains the authority and every Forge image retains `Not verified in game` until deploy-and-confirm evidence exists.

## BASELINE

- Current parent audit: `5/6 VERIFIED / 1/6 PARTIAL`; row 2 is the sole `PARTIAL` row because one static COMM header comparison does
  not measure three complete menus, dynamic body wrap, or truncation.
- Existing `pipeline_test` source/deploy baseline is `ui/pipeline_test.lua`, `5,488` bytes,
  SHA-256 `C1D9CD8580C6175E95C543259A2AB19F8B463282BF48B2229EB6013D6052718E`.
- Existing same-profile evidence reaches at most four horizontal and three vertical pixels for the simple panel, but
  it does not contain a three-menu wrap/truncation census and therefore is not reused as a passing row-2 fixture.
- Fresh baseline captured before implementation: repository checkpoint and both remotes resolve to
  `15e3ce50b9c376f1eaebea7bda5736ede1658cc0`; the broad pre-existing unrelated dirty tree remains unstaged; installed
  Forge is healthy at `http://127.0.0.1:54624/`; X4, For Honor, and Crimson Desert are absent.

## RECONCILE

- `helper.lua` resolves wrapped text height with `C.GetTextHeight(text, font, floor(fontsize), floor(cellWidth))` and
  rows size from widget content/minimum height.
- `widget_fullscreen.lua` applies `TruncateText` to non-wrapped font strings and preserves the full value as mouse-over
  text when truncation occurs. The fixtures must therefore exercise both paths rather than infer them from a blank or
  runtime-dynamic body.
- The brief says "at least three real menus"; it does not require the three parity fixtures to come from AI Influence.
  Shipping-mod round-trip is a separate row already verified. Controlled real X4 menus give stronger causal evidence
  than incomplete static projections of runtime-generated AI content.
- No capability-map delta yet. Record a delta only after the literal three-menu gate passes.
- **Plan change from earlier loose intent:** use three complete static-literal real menus instead of treating compact
  COMM, expanded COMM, and dossier as automatically eligible. Their current runtime bodies are not statically
  reproduced and cannot satisfy wrap/truncation evidence without additional authored sample authority.

## DOCUMENT PLAN

- This record is the implementation and acceptance authority for the bounded row-2 unit. The preceding keep-out unit
  is verified, its source checkpoint `8b97ea556a13a638dd7db157883687dc79a9d6ce` and documentation checkpoint
  `15e3ce50b9c376f1eaebea7bda5736ede1658cc0` are pushed, and the fresh baseline below activates this unit.

### Locked fixture design

- Keep all three menus in the existing `ui/pipeline_test.lua`, but register each under a distinct menu name and expose
  a distinct `createFrame` target. The first menu may auto-open; in-panel buttons provide deterministic forward/back
  navigation so X4 capture does not depend on a debug console or an invented launcher.
- Menu A uses three columns: column 1 is `20%`, column 2 is `30%`, and the untouched default-weight column 3 receives
  the remainder after border subtraction. This is the direct equal-default plus percent-redistribution oracle.
- Menu B uses four columns: column 1 has one literal `setColWidth`, columns 2 and 3 have unequal percentages, and the
  untouched fourth column receives the remaining width. This is the mixed fixed/percent/default oracle.
- Menu C uses five columns with five unequal percentages summing to `100`. This isolates floor and border behavior
  without a variable-width remainder.
- Every menu contains: a full-span header; a one-cell-per-column boundary row; a standard text row; a standard button
  row; a wrapped ASCII paragraph spanning a declared subset of columns; and a long non-wrapped ASCII marker in a
  declared narrow cell. The exact marker and expected final visible glyph are frozen only after the installed Forge
  and X4 render the same source—never guessed from source length.
- Fixture source uses only currently modeled calls (`addTable`, `setColWidth`, `setColWidthPercent`, `addRow`,
  `setColSpan`, `createText`, and `createButton`). `setColWidthMin*` is deliberately excluded because the current call
  model does not own it; adding vocabulary would turn this parity proof into an unplanned renderer feature.
- `helper.lua` is the geometry authority: `addRow` finalizes widths once; defaults start at width `0`, minimum=true,
  weight `1`; percentages consume floor(percent * usable width); variable defaults divide the remainder; borders are
  removed before allocation. `widget_fullscreen.lua` is the display authority: wrapped height is C++ text-height at
  the finalized cell width, while non-wrapped strings pass through `TruncateText`.

### Read-only preflight, 2026-09-03

- Installed Pipeline Test workspace record:
  `C:\Users\Moshi\AppData\Roaming\Antigravity IDE\User\globalStorage\x4forge.x4-forge-studio\state\workspaces\ws_f61166c42849c757cf219c37.json`,
  `8,477` UTF-8 bytes, SHA-256 `18A3C6507C33967F77A723CA8854D6F855192FD61AC657D71D3DA3353DC69FBC`.
- Workspace identity remains `ws_f61166c42849c757cf219c37`, display name `Pipeline Test UI`, with exactly
  `ui.xml` (`273` bytes / `655331A4423A550532042B23C8E60141A60DCC0E1C42D4DE6DA653DAAD1C1689`) and
  `ui/pipeline_test.lua` (`5,488` bytes / `C1D9CD8580C6175E95C543259A2AB19F8B463282BF48B2229EB6013D6052718E`).
- The complete four-file inventories under both
  `F:\DEV_ENV\projects\Mods\X4Mods\pipeline_test` and
  `G:\SteamLibrary\steamapps\common\X4 Foundations\extensions\pipeline_test` are byte-identical: `content.xml`,
  `README.md`, `ui.xml`, and `ui/pipeline_test.lua` have matching SHA-256 values in both roots.
- A read-only `GET /api/agent/workspace` using the retained temporary credential was rejected `403
  WORKSPACE_BINDING_MISMATCH`; that credential is correctly bound to `ws_bca860d02b9ea61f6028bfb4`, not Pipeline
  Test. Before mutation, obtain a new workspace-bound authority through Forge and use paired content/snapshot CAS.
  Do not force, reuse the wrong key, or bypass the registry by editing its JSON record.
- Machine-state delta: X4 is absent, but `CrimsonDesert` sampled at approximately `95.6%` aggregate GPU-engine use.
  Installed-UI and X4 interaction remain frozen until that unrelated game is no longer active.

### Implementation baseline, 2026-09-05

- The earlier machine-state hold is cleared: X4, For Honor, and Crimson Desert are absent; the user explicitly reported
  the machine quiet and authorized Forge operation, deploy, X4 launch, and computer use for this unit.
- Installed Forge is the selected Pipeline Test workspace at `http://127.0.0.1:54624/` (sidecar PID `19540`). The
  Source Editor currently reports a `2560x1440` preview profile, X4 user scale approximately `1.05`, effective scale
  `1.4`, exact source `ui/pipeline_test.lua`, and exact target `menu.createFrame`. The parity capture must use the
  acceptance profile `2544x1353` and user scale `1.0`, then restore the observed profile.
- The workspace record remains `8,477` bytes with SHA-256
  `18A3C6507C33967F77A723CA8854D6F855192FD61AC657D71D3DA3353DC69FBC`. Both staging and installed game targets
  still contain exactly the same four files and hashes recorded above; `ui/pipeline_test.lua` remains `5,488` bytes
  with SHA-256 `C1D9CD8580C6175E95C543259A2AB19F8B463282BF48B2229EB6013D6052718E`.
- The prior key rejection remains a correct negative-path result. A new short-lived deploy key must be issued from the
  selected Pipeline Test Forge surface, used with paired same-read `expectedHead` and `expectedSnapshotHash`, and
  revoked after the unit. Direct workspace-record mutation remains forbidden.
- Rollback evidence is stored beneath
  `dev-docs/b119-x4-ui-pipeline-smoke/three-menu-parity-20260905/baseline/`: exact workspace JSON plus complete staging
  and installed-target copies, with a machine-readable inventory and hashes captured before mutation.

## IMPLEMENT

- Completed. The three-menu fixture was authored through the guarded workspace writer and its paired-CAS dry-run and
  commit both accepted the same `12,636` bytes (`9DAC7B9BBD734E032C0B8156991CCB1FE6763F9E84C4AF792B7FB379284E6425`).
  Forge compile, package, full-project validation, and the X4 UI linter all agree on that source with zero errors and
  zero warnings; the remaining information finding is the intended in-game verification gap.
- **Plan delta — deploy repair required.** The first real deploy reproduced a source-authority split: the workspace,
  compile, and package surfaces held the new source, while staging and the installed CAT/DAT payload retained the
  `5,488`-byte baseline. `compileWorkspaceToFolder()` and `previewDeploymentEffect()` choose the stamped disk folder
  when `sourceStamp.dir` exists and simultaneously call `buildWorkspaceFileManifest(...,
  { includePassthrough: false })`; this drops committed source-owned passthrough edits and lets the older disk byte win.
  Release preparation repeats the same coupling. Repair these three artifact paths so loaded passthrough bytes remain
  explicit generated overrides while omitted/unloaded files still come from the stamped source. Add a regression that
  proves preview, loose/catalog materialization, and release preparation cannot regress to stamped bytes.
- The live capability schema separately advertises deprecated `/api/agent/deploy` but omits the existing canonical
  `/api/agent/deploy-verify` route used by Forge's own UI and durable documentation. Add that route to the schema and
  assert it remains discoverable. This is contract repair, not permission to retire the compatible legacy route.
- **Bounded layout repair, reproduced 2026-09-05.** In the canonical `2544x1353` / effective-scale
  `1.2527777777777778` profile, Menu A `createFrame` line 199's deliberate non-wrapped
  `A_OVERFLOW_MARKER_ABCDEFGHIJKLMNOPQRSTUVWXYZ_0123456789_END_A` produces one finite Zekton line
  (`width=616.125`, `overflow=true`) and exactly one `overflow` gap. The current text-height candidate rejects any
  non-empty layout gap, so line 199 stays unresolved, row 6/table height is unavailable, and Scene/Canvas is blank.
  The same matrix reproduces one unresolved marker, unavailable table height, and zero Scene widgets/texts/glyphs for
  Menu B line 266 (`B_OVERFLOW...`) and Menu C line 338 (`C_OVERFLOW...`); replacing only Menu A's marker with
  `A SHORT MARKER` restores table height `190`, six known rows, and nonzero Scene geometry. Shipped
  `widget_fullscreen.lua` explicitly sends non-word-wrapped text through `TruncateText` while retaining the full
  mouse-over value, so these overflow gaps are expected display evidence rather than missing geometry.
  Accept only this narrow case for height derivation: `no-wrap` layout with finite deterministic line geometry and
  gaps consisting exclusively of the expected displayed overflow evidence. Preserve that gap and all provisional/
  `Not verified in game` labels. Missing glyphs, unsupported controls, invalid newlines, non-finite geometry, and any
  mixed/other gap remain blocking and must continue refusing the candidate.
- Product implementation and tests for this delta belong to one bounded native Luna worker. Rollback is the exact
  worker diff plus the pre-deploy fixture backup; no direct staging/game edit is allowed.
- Implemented the bounded correction in `src/lib/x4UiLayoutProgram.ts`: a canonical text-height candidate may ignore
  gaps only when the layout is no-wrap, overflowing, line geometry and glyph geometry are finite, every gap is displayed
  `overflow`, and every line reports overflow. Missing glyphs, controls, invalid newlines, non-finite geometry, and
  mixed gaps remain blocking. `src/lib/x4UiPreviewPipeline.selftest.ts` now covers all three marker targets and the
  missing-glyph negative path without changing the exact existing pipeline fixture.
- The final source-faithful display correction remains inside the existing owners. `x4UiScene.ts` applies the shipped
  parent-relative width budget (`min(width, parentwidth - x)`) and centers the complete multiline line-box block instead
  of centering each line independently. `x4UiPreviewPipeline.ts` defaults non-wrapped overflow to truncation and emits
  the source-pinned ASCII `...` used by shipped `TruncateText`; `x4UiTextLayout.selftest.ts`, Scene, and PreviewPipeline
  regressions freeze those relations and their rejection paths.
- The accepted fixture is `13,202` bytes / `407` lines / SHA-256
  `E75DEF8CBED95537EEF9B7D3BCD05155F22B82DC4EEFE828B1D37D3626708EC0`. The guarded workspace, in-memory export,
  `.forge-builds\loose\pipeline_test` staging tree, installed X4 loose extension, Forge export authority, and X4
  runtime all resolve that exact source. The similarly named `X4Mods\pipeline_test` directory is the immutable import
  source snapshot, not current staging; the artifact planner correctly gives loaded/modelled workspace bytes precedence
  while retaining stamped-disk files only for unclaimed or unloaded paths.

## VALIDATE

- Passed before repair: paired-CAS dry-run/commit, exact workspace round-trip, in-memory compile/package, full-project
  validation, and UI linter (`0` errors, `0` warnings).
- Failed as intended by the oracle: the installed catalog's `ui/pipeline_test.lua` DAT slice is exactly the old
  `5,488`-byte baseline, not the committed `12,636`-byte fixture. The temporary key was revoked and a post-revocation
  probe returned `401 API_UNAUTHORIZED`; X4 remained stopped.
- Fail-first receipt for the bounded layout regression: `npx tsx src/lib/x4UiPreviewPipeline.selftest.ts` exited `1`
  with `109/110` checks passed; all three marker targets had unavailable text/cell/row/table heights. The failure
  traced to `layout.value.gaps.length > 0` rejecting the single expected displayed `overflow` gap.
- Green receipt: the same owner test exits `0` with `110/110` checks passed. At the canonical profile, all three
  targets derive `16` for operation outer-height, cell height, row height, and table height; each Scene has nonzero
  widget/text/glyph geometry and retains the overflow diagnostic. The missing-glyph negative remains height-unresolved.
  Existing exact fixture assertions remain green.
- `npx tsx src/lib/x4UiLayoutProgram.selftest.ts` exits `0` with `705` passed, `1` skipped, `706` total. `npm run
  typecheck` exits `0`.
- Final focused gates pass: TextLayout `13/13`, Scene `178/178`, PreviewPipeline `117/117`, LayoutProgram `705` passed
  plus `1` intentional skip, whole-repository typecheck, and zero-error targeted ESLint. The receipt classifier
  selftest passes `26/26`.
- Native X4 9.00 acceptance is now positive for the exact deployed three-menu source
  `E75DEF8CBED95537EEF9B7D3BCD05155F22B82DC4EEFE828B1D37D3626708EC0` (`13,202` bytes / `407` lines).
  At exact client drawable `2544x1353`, Menu A, B, and C each rendered and the in-panel forward controls completed
  `A -> B -> C -> A`. Retained native captures are `x4/menu-a-2544x1353.png`
  (`38A6209C7D4C389C629827D48B35BE19D1FA0F718AD0D661D4B8DC46531CC9AE`),
  `x4/menu-b-2544x1353.png` (`A3FF5AD62AA8E80808BADDAF355F02B6BC063E5C6E988891D1BE4168F9DDE37A`),
  `x4/menu-c-2544x1353.png` (`3F2629A8D281E0FFDAAE91C392E2AD9A0F9D0D7193AEAA0604395AE0460BC9E7`), and
  the returned A capture `x4/menu-a-after-cycle-2544x1353.png`
  (`2C4B053B336C68AB534FFA9D4E3DA270D8F5B1783BAEC9E256688C49FD718B44`).
- The scoped pre-repair runtime log is retained as `x4/debuglog-pre-repair-20260905.txt`, SHA-256
  `1A7ECCE541A89B2B9FB85E617A29247FD748C2B5E69C3F4567B2520C6C3B2E59`: zero `DisplayView` setup failures,
  zero `Lua Error`, and zero traceback signatures. X4 then closed normally and its process count returned to zero.
- Exact colored-component measurement already clears the column/button geometry bar. Across all three menus, Forge
  and X4 button edges differ by at most `2 px`; representative Menu A components are Forge
  `x=696..923 / 928..1270 / 1275..1847, y=363..391` and X4
  `x=694..921 / 927..1269 / 1275..1848, y=363..392`.
- The first comparison correctly rejects overall parity on wrapped text. Menu A and B place the first wrapped glyph
  band at Forge `y=419` versus X4 `y=400` and clip the third line; Menu C places it at Forge `y=409` versus X4
  `y=400` and clips the second line. Single-line titles, headers, and buttons remain aligned within approximately
  `1-2 px`. Source reconciliation isolates the cause to `x4UiScene.ts`: every line reused a single-line-centered
  `yBase` even though `lineBox.y` already advances multiline lines, biasing an N-line block downward by roughly
  `(N-1) * lineAdvance / 2`. The active bounded worker changes only the common multiline block origin and freezes
  single-line placement in its regressions.
- One validation helper accidentally called `ShowWindow(..., 9)`, changing the X4 client from `2544x1353` to
  `2542x1351` and triggering a normal UI reload. The resulting black `x4/menu-b-client.png` and resized
  `x4/after-navigation-reload-client.png` are excluded from acceptance evidence. The exact drawable was restored via
  an outer `2560x1392` window before the accepted captures above. This is a validation-tool AAR trigger, not an X4
  renderer failure.
- Security cleanup corrected an earlier false report: installed registry plus Forge-rendered key-manager readback now
  show both temporary deploy keys `codex-b119-installed-parity-20260905` and
  `codex-b119-runtime-deploy-20260905` as revoked. No temporary B119 deploy authority remains active.
- Installed Forge exported exact source/profile images for all three targets:
  `forge-final/menu-a-2544x1353.png` (`AAD068210F90C7F3FEB5C35AE8EDBE421D294D14963228B97BFE3F585D3A3908`),
  Menu B (`980EF382F4E17D2A03E7C29DF870A534D548F877E38F904169F089FEACE40B2E`), and Menu C
  (`B108CF275F937C3D3555B80F037779DFCE6E835542F58EB99DF448A1ECDD1D8A`). The matching native X4 images retain
  hashes `38A6209C...9AE`, `A3FF5AD6...37A`, and `3F2629A8...C9E`. All six physical hashes were independently read
  from disk and all six images were visually inspected.
- The machine-readable receipt
  `dev-docs/b119-x4-ui-pipeline-smoke/three-menu-parity-20260905/parity-receipt.json` accepts exactly Menu A/B/C,
  `125` closed-set geometry features, and maximum normalized delta `3 px` against the `5 px` ceiling. Wrapped
  baselines are exact (`411/431/451` for A/B and `411/431` for C); line endings match exactly (`gamma/prove/wrapping.`,
  `yellow/endings/deterministic.`, and `west/line.`); visible overflow strings match exactly as ASCII
  `A_OVERFLOW_MARKER_AB...`, `B_OVERFLOW_MARKER...`, and `C_OVERFL...`.
- The declared negative copy shifts Menu A `columns.boundary1` by `6 px` and is rejected with
  `NUMERIC_DELTA_EXCEEDED`; it was never deployed. The classifier validates a closed receipt and declared
  measurements rather than extracting pixels, so physical file hashes and the six-image human review remain separate
  required evidence, not inferred classifier behavior.
- Production build passes at `1,848` modules. Staged-app probe passes `16/16`; private VSIX
  `x4-forge-studio-0.0.70-b119-ellipsis-parity-20260905.vsix` is `26,292,779` bytes / `2,107` entries / SHA-256
  `541CF6CD33BCF3322EFD1017F75F5DB379E73F66D555C51DED44F638B78570D6`, and installed payload parity is exact.
  Installed runtime oracles pass `134/134` with the supported `60,000 ms` timeout. Full serial E2E passes `106/106`,
  zero failed/flaky/bad/quarantined-blocking, complete verdict SHA-256
  `9E15D34F158F5693D5E7DE26F3B2F919186C60BC6C799939A63612ABC202D33B`, `treeGone=true`; ports `3100/3101` are
  closed and the live workspace hash remains unchanged. Complete `npm run precommit:check` then passed exit `0` after
  the durable records were updated.

## REVIEW

- Bounded worker review: done — finite no-wrap overflow derives deterministic height for Menu A/B/C; Scene retains
  nonzero geometry and the overflow gap; the missing-glyph negative refuses height; existing exact fixture values
  remain unchanged.
- Parent fresh-eyes review: done — every production and test diff was reread; the receipt schema is closed, menu-bound,
  source/profile-bound, and rejects missing/extra features, bad identities, semantic drift, non-finite values, and a
  `>5 px` delta. Physical image identity and human visual review remain independent because the classifier does not
  decode images. Exact workspace/staging/install/runtime source identity was rechecked after correcting the staging
  directory label. No blocking finding remains for this bounded unit.
- Requirement review: all seven acceptance-contract clauses are done and evidenced. X4 accepted and navigated all
  three menus; Forge exported the same exact source/profile; columns, rows, wrap, and truncation are within threshold;
  the perturbed copy fails; and all preview images retain the non-authoritative game-truth boundary.

## CLOSE

- **Bounded status:** `VERIFIED`. This promotes original-brief row 2 and makes the literal brief `6/6 VERIFIED`.
- **Overall B119:** `IN_PROGRESS`, not release-complete. The twelve-reference AI Influence reconstruction, native Save
  As false-success repair, release acceptance, and OpenVSX publish remain open. Arbitrary Lua/C++ frame acceptance is
  still not promised; Forge preview remains explicitly `Not verified in game`, while exact deploy plus X4 observation
  remains the authority.
- No rollback was required. The initial stale deploy and first visual mismatch were retained as causal evidence and
  corrected through the existing artifact/layout/scene owners; the final deployed fixture and workspace are exact.
- Commit point: `feat(ui-editor): prove three real-menu pixel parity`.

## AAR

- Triggered during reconciliation: the prior idea of reusing three AI Influence views conflated real in-game views
  with complete static preview authority. Their runtime-built bodies leave the exact wrap/truncation gate unmeasured.
- Triggered during implementation: a green workspace/compile/package result did not prove deploy-source identity. The
  installed CAT/DAT byte-slice check caught a real stale-source deployment before X4 launch.
- **Sustain:** retain X4 as the visual authority and use exact source/profile identities.
- **Improve work/approach:** construct minimal complete fixtures whose required geometry and text are all observable in
  both hosts before spending more capture cycles.
- **Improve tools:** make the artifact planner's source precedence explicit and regression-tested across preview,
  deploy, and release; advertise the canonical deploy-verify route so external agents do not select the weaker legacy
  route from an incomplete schema.
- **Highest-risk evidenced weakness:** source-owned workspace bytes can pass compile/package yet be silently replaced by
  older stamped-disk bytes during physical deployment. Require the deployed artifact's indexed payload hash to equal
  the accepted workspace source hash before any runtime or visual gate advances.
- **This worker's AAR trigger:** the original text-gap predicate conflated expected visible non-wrap overflow with
  geometry-compromising uncertainty. The repair must keep the accepted overflow gap observable and prove the negative
  missing-glyph path still refuses height; no general text-gap relaxation is acceptable.
- **This worker's AAR result:** the narrow predicate and three-target fixture preserve diagnostic overflow evidence while
  producing deterministic height; the first typecheck attempt caught an evidence-only union narrowing issue, which was
  corrected without changing production behavior. No capability-map delta.
- Project lesson to bank after verification: complete static fixtures are the appropriate acceptance oracle for
  source-faithful layout; runtime-generated production views remain a separate dogfood benchmark.
- The first installed oracle sweep used the default `20,000 ms` timeout and reached `133/134`; the X4 UI integration
  selftest itself completed cleanly in `20.94 s`. The supported `X4_FORGE_TIMEOUT_MS=60000` rerun passed `134/134`.
  Treat endpoint timeout budget separately from an endpoint failure.
- The first full E2E run passed its first `23` cases before the Windows Playwright child exited `0xC0000409`, leaving no
  structured verdict. It failed closed; ports and live-workspace identity were checked, then one unchanged controlled
  retry produced the accepted complete `106/106` verdict.
- The imported source root was initially called staging because both paths contain `pipeline_test`. Graph/source
  reconciliation proved current staging lives under `.forge-builds\loose`; distinguish immutable import source,
  mutable workspace state, build staging, and installed target by owner rather than basename.
