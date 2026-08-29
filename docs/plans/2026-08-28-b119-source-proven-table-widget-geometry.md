# B119 source-proven table and widget geometry

Task: B119 source-proven table and widget geometry
Lane: FULL
Status: VERIFIED (bounded unit); overall B119 IN_PROGRESS / PARTIAL
Date: 2026-08-28
Owner: GitHub #41

## PLAN

- Bounded unit: extend the existing source-first preview projection so the exact deployed `pipeline_test` table reaches complete row, cell, widget, text, Scene, and Paint geometry at the two already-observed X4 profiles. Port only the shipped `Helper.headerRowCenteredProperties` bundle and the shipped `Helper.getTextHeight` / `getMinTextHeight` behavior needed by this fixture, using loader-issued X4 9.00 helper and Zekton authority.
- Assumptions and unresolved facts:
  - `helper.lua` and the shipped Zekton `.abc` / `.dds` assets remain authoritative for these calculations. Browser output remains `Not verified in game`; X4 remains the frame-acceptance and visible-pixel authority.
  - The first supported external option-table expression is exactly `Helper.headerRowCenteredProperties`. Arbitrary Helper tables, mutations, aliases, or runtime values are not implied by this unit.
  - `layoutZektonText()` already owns decoded glyph metrics and wrap layout. The layout program may consume that result only through an exact loader-issued canonical corpus object and must reproduce Helper's scale/floor/ceil boundaries.
- Authoritative references:
  - `F:\Downskies\x4unpackersuiteV1\X4 unpacked 9.00\ui\addons\ego_detailmonitorhelper\helper.lua`: constants around lines 514-547, `headerRowCenteredProperties` lines 614-621, full table and row height logic lines 4852-4863 and 5249-5263, column-span width lines 5323-5359, text height lines 5482-5497, and `scaleX` / `scaleY` / `scaleFont` lines 806-858.
  - `src/lib/x4UiCorpusAssets.ts`: loader-issued canonical helper/font authority.
  - `src/lib/x4UiFontMetrics.ts`: shipped Zekton metric and wrap projection.
  - `src/lib/x4UiLayoutKernel.ts`: shipped Helper table geometry port.
  - `src/lib/x4UiLayoutProgram.ts`: source/profile/corpus-bound operation projection.
  - `src/lib/x4UiPreviewPipeline.ts`: canonical corpus owner at the preview boundary.
  - Exact deployed fixture `F:\DEV_ENV\projects\Mods\X4Mods\pipeline_test\ui\pipeline_test.lua`, SHA-256 `C1D9CD8580C6175E95C543259A2AB19F8B463282BF48B2229EB6013D6052718E`.
- In scope:
  - Exact recognition of `Helper.headerRowCenteredProperties` only when the model expression and loader-issued X4 9.00 canonical helper authority match.
  - Source-pinned projection of its font, font size, y offset, minimum row height, center alignment, and canonical `container_subsection_header` cell background color.
  - Per-cell Zekton text-height candidates using exact content, effective shipped font, scaled font size, wrap width from the finalized column span, and Helper's ceil/minimum-height rules.
  - Preview-pipeline wiring of its already-loaded canonical corpus into layout-program projection.
  - A narrow Scene producer-fact validation correction for zero-height text whose source-proven `minTextHeight` is already the final scaled Helper result; it must not be scaled a second time at non-unit UI scale.
  - Causal focused tests and exact-fixture two-profile receipts through Program, Scene, and Paint, including a direct non-unit-scale Scene regression.
- Out of scope:
  - Generic Lua evaluation, generic Helper property-table interpretation, mutable/runtime Helper tables, arbitrary fonts, C++ frame acceptance, handler execution, data binding, event semantics, full `widget_fullscreen.lua` parity, all brief lint rules, full AI Influence UI reconstruction, OpenVSX publication, or a global 1:1 claim.
  - Production changes to the mod/game package, X4 profile, server routes, deployment, SourceEditor, or unrelated UI owners.
- Risks and authorization boundaries:
  - Primary risk is false authority: a forged corpus object or merely similar Helper expression must remain refused/unresolved.
  - Width must be the finalized span width used by shipped Helper, not frame width or an approximate browser width. Font size must use `scaleFont`, not `scaleY`.
  - Preserve all unrelated dirty paths. No game-directory write is needed for this implementation unit. X4 is stopped; serial host gates may run.
- Rollback/checkpoint: `HEAD == origin/main == 7be3547e2cfc1b817327f43d3822fb3b44f330b7`. Revert only the explicit implementation/test paths and this plan if the unit fails.
- Acceptance criteria:
  - Fail-first exact fixture retains current causal receipt: one frame, one table, six rows, twelve cells, zero Scene widgets/texts, one Paint primitive, and `missing-min-text-height` / unresolved header-option evidence.
  - At 1920x1080, UI scale 1, header cell heights are `18,18`, row heights are exactly `20,20,25,16,25,44`, and table height is `160`; all six creator cells reach finite Scene geometry.
  - At 2544x1353, UI scale 1.25, header cell heights are `22,22`, row heights are exactly `25,25,31,20,31,55`, and table height is `202`; all six creator cells reach finite Scene geometry.
  - Header text uses `Zekton bold`, size 9/12 after shipped scaling, centered alignment, y 2/3, and canonical `container_subsection_header` color authority. Status text uses regular Zekton and its exact per-cell height candidate.
  - Scene and Paint contain the panel's headers, two buttons, status text, and editbox with finite geometry; preview truth remains exactly `Not verified in game`.
  - An unknown Helper option-table expression remains unresolved; a copied/plain/frozen object is not canonical authority; malformed or mutated corpus evidence is rejected; existing caller-supplied `profile.defaults.minTextHeight` remains compatible.
- Required validation and negative path:
  - TDD fail-first exact-fixture receipt before production repair.
  - `x4UiLayoutProgram.selftest.ts` and `x4UiPreviewPipeline.selftest.ts`; add Scene/Canvas/Paint assertions only if required to prove the existing downstream contract.
  - `npm run typecheck`, exact owned-file ESLint, exact-path `git diff --check`, deterministic two-profile smoke driver, and fresh-eyes diff review.
  - After focused success: Graphify refresh, runtime-indexed oracles, controlled full E2E, complete precommit, and production build while X4 remains stopped.
  - Real rendered Forge preview capture compared with the retained X4 screenshots. This can verify the bounded fixture's measured geometry but must not be generalized to C++ acceptance or all X4 UIs.
- Evidence locations:
  - This task record.
  - `dev-docs/b119-x4-ui-pipeline-smoke/` for the deterministic smoke driver and receipts.
  - `dev-docs/b119-x4-ui-pipeline-smoke/pixel-comparison-20260828/` for retained current X4 visual truth.

## BASELINE

- Revision/version: `HEAD == origin/main == 7be3547e2cfc1b817327f43d3822fb3b44f330b7`; X4 9.00 build 611726.
- Existing changes/failures/runtime state:
  - Forty-nine unrelated/user-owned dirty paths predate this unit; none is owned here.
  - X4 is stopped. The latest real-game run visibly rendered the exact unchanged `pipeline_test` panel at 2544x1353 and button focus changed on click. `debuglog.txt` was absent/empty, so no telemetry claim is made.
  - Exact fixture currently projects finite frame geometry and a six-row table model, but both header `createText` operations remain generic cells because `Helper.headerRowCenteredProperties` is an unresolved identifier. The literal status `createText` specializes, then remains height-unavailable because no proven per-cell C++ text-height candidate exists.
  - Current downstream symptom: Scene emits zero widgets and zero text nodes; Paint emits only the frame primitive.
  - Independent shipped-font probe: at scale 1 the header/status C-style ceil candidate is 15 px, producing Helper cell-height floors of 18 px for headers and 16 px for status. At scale 1.25, candidates/floors produce 22 px header cells and 20 px status. Reconciliation corrected the initial arithmetic: shipped `row:getHeight()` adds the scaled cell y offset after `text:getMinTextHeight()`, so header row heights are 20/25 rather than the 18/22 cell heights. These are causal expectations, not accepted production evidence yet.

## RECONCILE

- Resources and readers/writers searched:
  - Graphify paths confirm FontMetrics -> Scene -> LayoutProgram and CallModel -> LayoutProgram ownership. Narrow source inspection confirms PreviewPipeline already owns validated canonical corpus evidence and LayoutProgram currently receives only its color subset.
  - LayoutProgram already computes finalized column widths/spans, exact `scaleX`/`scaleY`/`scaleFont`, Helper minimum-row-height floors, and kernel specialization. It currently substitutes a single optional profile-level `minTextHeight` rather than deriving per-cell candidates.
  - Scene already validates canonical corpus and lays out Zekton text once Program supplies finite cell/table geometry; no parallel renderer is needed.
- Existing capability reused: canonical corpus authority, decoded regular/bold Zekton fonts, exact Helper profile/kernel, call-model source expressions, canonical color evidence, Scene text projection, and Paint/Canvas consumers.
- Couplings checked: exact helper hash/property bundle -> call option expression -> effective cell properties -> finalized span width -> Zekton metrics -> Helper row/table height -> Program authority -> Scene/Paint.
- Capability-map delta: none yet; record only after passing evidence.
- Plan changes: the observed browser/game mismatch is no longer attributed to frame math. The bounded defect is now the two missing source-authority bridges above. During fail-first implementation, exact Helper reconciliation corrected the planned header row/table expectations: 18/22 are text cell heights; row y offsets make the row heights 20/25 and table totals 160/202. The source algorithm, not the earlier arithmetic, governs acceptance.
  - The first non-unit-scale end-to-end replay exposed an existing Scene validator defect: creator `outerHeight` for zero-height text is the already-scaled final `getMinTextHeight` result, but generic producer-node validation treated it as an unscaled `height` input and applied `scaleY` again. This passes accidentally at scale 1 and rejects correct scale 1.25 state. Scope therefore expands narrowly to `src/lib/x4UiScene.ts` and `src/lib/x4UiScene.selftest.ts`; no validator bypass or hidden metadata is permitted.

## IMPLEMENT

- `src/lib/x4UiLayoutProgram.ts` now accepts the already validated canonical corpus from its existing preview owner,
  revalidates the exact loader-issued X4 9.00 helper/font identities, and recognizes only the shipped
  `Helper.headerRowCenteredProperties` expression. Its font, font size, y offset, minimum row height, centered
  alignment, and canonical `container_subsection_header` background are source pinned.
- The layout program derives a per-cell minimum text-height candidate from the finalized column-span width, exact
  scaled font size, shipped regular/bold Zekton metrics, wrap mode, line boxes, and Helper's ceil/minimum floor. The
  emitted ordinary `minTextHeight` fact remains independently replayable and mutation sensitive.
- `src/lib/x4UiPreviewPipeline.ts` passes its existing validated canonical corpus to the layout program; no second
  corpus loader or renderer was introduced.
- `src/lib/x4UiScene.ts` now treats zero-height text `minTextHeight` as the final scaled Helper result and validates
  matching creator/cell/kernel facts without applying `scaleY` a second time. Non-unit scale therefore accepts the
  correct source-proven geometry instead of failing accidentally.
- Focused tests embed the exact deployed Lua text and SHA rather than depending on an absolute workstation fixture
  path. They cover both real profiles, header/status/font/color facts, downstream Scene/Paint censuses, and causal
  creator/cell/provenance/removal mutations.
- No mod, game package, X4 profile, route, SourceEditor, Paint, Canvas, extension-release, or unrelated dirty path was
  changed by this bounded implementation.

## VALIDATE

- Focused deterministic selftests: Layout Program `641/641`, Preview Pipeline `103/103`, and Scene `154/154`, all
  exit `0`. The exact fixture reaches `6` rows, `12` cells, `6` widgets, `8` text nodes, `99` glyphs, and `56` gaps.
  The final causal color test first failed with both header `cellbgcolor` facts unavailable; adding the exact synthetic
  `container_subsection_header -> azure_dark_alpha_26` corpus mapping resolved five color-related Scene gaps (`61 ->
  56`) while retaining exactly `224` base colors and `804` mappings and leaving production unchanged.
- Exact profile receipts match the acceptance contract. Scale `1`: cell heights `18,18,25,16,25,44`, row heights
  `20,20,25,16,25,44`, table height `160`. Scale `1.25`: cell heights `22,22,31,20,31,55`, row heights
  `25,25,31,20,31,55`, table height `202`.
- Whole-repository TypeScript exits `0`; exact six-file ESLint exits `0`; exact-path `git diff --check` is clean.
  The two-profile smoke driver reports `canRender:true`, `geometryStatus:projected`, no gap summary, and permanent
  `Not verified in game` at scale `1` and `1.4`.
- Runtime-indexed oracle sweep is `134/134` against the isolated server. The first raw default invocation targeted a
  dead `3001` and returned `0/133`; that invocation failure is retained as AAR evidence and is not product evidence.
- The configured unpacked-corpus owner completed a manifest generation over `1,028,384` files / `33,206,154,495`
  bytes. The rendered Forge editor then accepted canonical core and canonical-default color evidence, selected exact
  source `ui/pipeline_test.lua` at SHA-256
  `C1D9CD8580C6175E95C543259A2AB19F8B463282BF48B2229EB6013D6052718E`, selected `menu.createFrame`, mounted one
  canvas with status `rendered/current`, emitted zero page errors, and retained `Not verified in game`.
- Visual evidence is under `dev-docs/b119-x4-ui-pipeline-smoke/pixel-comparison-20260828/`: raw Forge canvas
  `forge-source-preview-canvas-2560x1440.png` SHA-256 `F2D23BB...DABC3`, rendered editor region
  `forge-source-preview-region-1600x900.png` SHA-256 `96720E13...A3A722`, and retained X4 screenshot
  `x4-current-2544x1353.jpg` SHA-256 `570C5DF6...6411C`. Visual inspection confirms the same centered table, row order,
  spans, header hierarchy, status text, two buttons, and editbox region. It also confirms remaining non-parity: the
  Forge canvas draws a large frame-area outline and does not reproduce X4 background/alpha composition.
- Current X4 9.00 startup log loaded `extensions/pipeline_test/ui.xml` and contains no `DisplayView(): Failed to set up
  the view` or `pipeline_test` Lua runtime error. Existing unsigned-extension/signature, unrelated-mod runtime, and
  missing historical loadout diagnostics remain separate baseline noise. The exact unchanged Lua had already visibly
  rendered and accepted button focus in the retained game run; this preview patch itself is not promoted to game
  authority.
- Full serial E2E is `104/104` in `9.0m`, zero failed/flaky/bad/quarantined-blocking, complete discovery/terminal
  parity, child-close, and `treeGone=true`; receipt `test-results/e2e-verdict.json` SHA-256
  `676F47BD...07EBF`. Ports `3100/3101` were clear afterward while the original live PIDs on `3000/3300` were
  unchanged.
- Complete precommit passes: tripwires/canon mirrors, verdict selftests `55/55`, Vite lifecycle, product copy,
  durable writers `14/14 + 8/8`, capability contract `12/297/1/11`, MCP capability recovery, action receipts
  `82` routes / `56` surfaces, TypeScript, and size guards. Production build passes with `1,848` modules; Graphify
  refresh is `9,966` nodes / `24,959` edges / `310` communities.
- Negative paths pass for unknown Helper tables, copied/frozen/forged corpus values, malformed or mutated identities,
  mismatched creator/cell/kernel facts, removed provenance, and caller-supplied compatible minimum-height defaults.

## REVIEW

- Exact Helper option-table recognition and source-pinned header properties: done and focused-test evidenced.
- Per-cell Zekton minimum-height projection from finalized span width: done and two-profile evidenced.
- Preview-to-program canonical corpus wiring: done without a parallel loader.
- Non-unit-scale Scene validation: done with causal mutation coverage.
- Finite downstream widget/text/Scene/Paint geometry for the deployed fixture: done and rendered-host evidenced.
- Permanent game-truth boundary: done; every internal receipt remains `Not verified in game`.
- Fresh-eyes review found one non-portable absolute fixture dependency; the native Luna worker replaced it with the
  exact embedded deployed source before final validation. No hidden metadata or debug residue remains in added lines.
- Rendered review found the accepted bounded geometry but also a large preview-only frame outline and missing game
  alpha/background composition. Exact pixel parity, arbitrary C++ acceptance, broader Helper/widget coverage, the
  remaining linter table, and AI Influence reconstruction are therefore partial/deferred rather than overclaimed.
- Unrelated modified/deleted/untracked files were re-inventoried after every broad gate and remain outside the owned
  path set.

## CLOSE

- Status: `VERIFIED` for this bounded source-proven table/widget geometry unit; overall B119 remains
  `IN_PROGRESS / PARTIAL` and GitHub #41 remains open.
- Capability-map delta: supersede the prior claim that the exact `pipeline_test` table's header/text/widget geometry
  was unavailable. Do not generalize that delta to full Helper/widget parity or engine acceptance.
- Remaining risks/deferred work: complete the linter-first rule table (still the higher-value product boundary), port
  broader shipped Helper/widget behavior, correct the observed frame/alpha visual gaps, compare more vanilla menus,
  reconstruct and visually match the supplied AI Influence screens, prove the installed extension, and publish
  OpenVSX only after release quality. No 1:1 or general renderer claim is made.
- Suggested commit title: `feat(ui-editor): project source-proven table widget geometry`.

## AAR

- Triggers: reconciliation expanded the unit to the Scene double-scale validator; fail-first and broad commands exposed
  real failures; fresh-eyes review corrected an absolute fixture dependency; the first oracle invocation targeted a
  dead port; the canonical manifest required explicit generation; the in-app browser's native select action was a
  no-op; the standalone capture first launched in Beginner mode; one capture waited for `current` instead of the real
  `rendered/current` label; the coordinator repeated a PowerShell `foreach |` parser mistake; and the final color-test
  worker launched an unnecessary recursive token scan over the full 1,028,384-file unpacked corpus. The exact `rg.exe`
  and wrapper process were terminated, then the worker used only `libraries/colors.xml` lines 362-363.
- Sustain: retain exact deployed Lua, exact shipped helper/font assets, two real X4 profiles, mutation-sensitive
  authority tests, downstream nonzero widget/text censuses, real rendered-host capture, and the permanent game-truth
  disclaimer.
- Improve work/approach: freeze the displayed canvas-success label in the acceptance harness before long waits, and
  make direct raw-canvas capture part of the first visual pass. Stop implementation expansion at this commit point;
  repeated shell parser errors are degradation evidence.
- Improve tools: the in-app browser backend currently no-ops native `selectOption`; the controlled repository
  Playwright runtime is the durable fallback for local rendered-host evidence. PowerShell loops must assign to an
  array before piping rather than piping directly from a braced `foreach` statement. Corpus lookups must target the
  already reconciled authoritative file; recursive searches over the 33 GB unpacked tree are a performance defect.
- Highest-risk evidenced weakness: the preview can now look substantially like X4 while still drawing a frame outline
  and composition X4 does not. The next bounded visual-parity unit must explain those pixels from shipped source or
  remove them; the disclaimer and deploy/game gate remain authoritative meanwhile.
- Global/project lessons banked: project capability-map and AAR deltas are required at record close; no global memory
  update is authorized.
