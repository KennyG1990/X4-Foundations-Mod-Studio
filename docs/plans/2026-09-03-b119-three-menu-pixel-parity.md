# B119 three real-menu pixel parity

Date: 2026-09-03
Lane: FULL
Status: `SPECIFIED`
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

- Current parent audit: `4/6 VERIFIED / 2/6 PARTIAL`; row 2 is `PARTIAL` because one static COMM header comparison does
  not measure three complete menus, dynamic body wrap, or truncation.
- Existing `pipeline_test` source/deploy baseline is `ui/pipeline_test.lua`, `5,488` bytes,
  SHA-256 `C1D9CD8580C6175E95C543259A2AB19F8B463282BF48B2229EB6013D6052718E`.
- Existing same-profile evidence reaches at most four horizontal and three vertical pixels for the simple panel, but
  it does not contain a three-menu wrap/truncation census and therefore is not reused as a passing row-2 fixture.
- Capture a fresh workspace/deploy/config/process baseline immediately before implementation because live state may
  change while the preceding keep-out unit closes.

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

- This record is the implementation and acceptance authority for the bounded row-2 unit. It remains `SPECIFIED`
  until the preceding keep-out unit has a verified installed close and a fresh baseline is appended here.

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

## IMPLEMENT

- Pending. Use Forge workspace/source operations and validated deploy only. Any Forge product code or test repair
  discovered by the fixtures requires an explicit plan delta and a bounded native Luna worker before source edits.

## VALIDATE

- Pending: exact source/export/deploy hash receipts; Forge physical PNG exports; X4 native screenshots; per-menu
  coordinate/text receipts; negative perturbed-copy receipt; scoped debug-log census; installed-product visual review;
  full applicable Forge gates if product source changes.

## REVIEW

- Pending point-by-point audit against all seven acceptance criteria and the literal brief row.

## CLOSE

- Status: `SPECIFIED`.
- Remaining risks: X4/Forge capture crops must be normalized from measured drawable bounds, not guessed; visible glyph
  endpoints require the same Zekton face and exact source text; three synthetic screenshots without X4 acceptance do
  not count.
- Suggested commit title after a verified close: `feat(ui-editor): prove three real-menu pixel parity`.

## AAR

- Triggered during reconciliation: the prior idea of reusing three AI Influence views conflated real in-game views
  with complete static preview authority. Their runtime-built bodies leave the exact wrap/truncation gate unmeasured.
- **Sustain:** retain X4 as the visual authority and use exact source/profile identities.
- **Improve work/approach:** construct minimal complete fixtures whose required geometry and text are all observable in
  both hosts before spending more capture cycles.
- **Improve tools:** produce one deterministic combined JSON receipt so a visual crop or stale export cannot be counted
  by narration alone.
- **Highest-risk evidenced weakness:** the installed Forge export status can claim success before a physical PNG
  exists. Require a real file path, dimensions, and hash for every accepted browser image.
- Project lesson to bank after verification: complete static fixtures are the appropriate acceptance oracle for
  source-faithful layout; runtime-generated production views remain a separate dogfood benchmark.
