# B119 Editbox Descriptor-Height Source Port

Task: Port the shipped X4 editbox table-default and displayed-hotkey height path into the existing Forge call model, linter, layout kernel/program, Scene authority, and shared validation surfaces.
Lane: FULL
Status: VERIFIED - bounded source port, corpus acceptance, serial host gates, production build, and live-state containment are green; parent B119 remains PARTIAL
Date: 2026-08-30

## PLAN

- Bounded unit: model only the ordered shipped calls and readers that can determine an editbox descriptor height when `createEditBox` omits or explicitly sets `height`:
  - `table:setDefaultCellProperties("editbox", { height, scaling })`;
  - `table:setDefaultComplexCellProperties("editbox", "hotkey", { hotkey, displayIcon, x, y })`, applying the height-relevant pair and retaining unported offsets as gaps;
  - `editbox:setHotkey(hotkey, { hotkey, displayIcon, x, y })`, including shipped property-table override order and explicit gaps for unported offsets;
  - `initTableCell`, base `cell:getHeight`, and `editbox:getHeight` application order.
- Assumptions and unresolved facts:
  - The configured X4 9.00 unpacked corpus is authoritative. Forge must not execute arbitrary Lua or infer row-peer height inheritance.
  - The direct complex-default call is included because shipped `initTableCell` applies it before call-specific setters. Ignoring it while claiming a resolved hotkey state would be false authority.
  - `Helper.editboxMinHeight` is the exact unscaled value `23`; `editbox:getHeight` compares it against the already-scaled base-cell height and returns their maximum only when the effective hotkey is non-empty and `displayIcon=true`.
  - Shipped `editbox:setHotkey(hotkey, properties)` writes the first argument and then applies the complete `hotkeyproperty` table. A static `properties.hotkey` therefore overrides the first argument; valid `x`/`y` properties affect icon placement and must remain explicit preview gaps until that paint geometry is ported.
  - Static lint can prove only source-visible, unconditionally owned paths. Conditional, dynamic, aliased beyond the existing exact model, or ambiguous values remain verification gaps.
  - A button/default call may be proven irrelevant to this editbox-height rule without being globally irrelevant to X4 UI state. Until its widget semantics are ported, LayoutProgram/preview must record it as unresolved and partial rather than inventing an applied identity transition.
- Authoritative references:
  - Feature brief: `C:\Users\Moshi\AppData\Local\Temp\claude\G--SteamLibrary-steamapps-common-X4-Foundations-extensions-x4-ai-influence\b9a29c50-1478-4e0e-9729-d310c18cb51d\scratchpad\FORGE-UI-EDITOR-BRIEF.md`.
  - Configured corpus root: `F:\Downskies\x4unpackersuiteV1\X4 unpacked 9.00`.
  - `ui/addons/ego_detailmonitorhelper/helper.lua`, SHA-256 `D24A08B8DA9F2C972794B60ACB48AE36F38CB026C991249DAB9F1164272D4DF2`:
    - `Helper.editboxMinHeight = 23`, line 565;
    - base widget `height = 0`, lines 3102-3118;
    - editbox defaults, lines 3234-3245;
    - hotkey defaults, lines 3440-3445;
    - table simple/complex default setters, lines 4680-4710;
    - `initTableCell` default/custom application order, lines 5432-5470;
    - editbox creation/setter/height, lines 5953-5981.
  - `ui/widget/lua/widget_fullscreen.lua`, SHA-256 `420AFBA33D925A7B55F2A82AB12773DF04826EF588317010D209B249DE7BAED1`, remains the paint authority; this unit does not add new widget paint semantics.
  - Existing Forge owners: `x4UiCallModel`, `x4UiLayoutKernel`, `x4UiLayoutProgram`, `x4UiLint`, `x4UiScene`, `x4UiSourceEdits`, `luaStaticAnalysis`, and `x4UiIntegration`.
- In scope:
  - Exact source-located call records, receiver ownership, ordered merge/override behavior, profile-aware kernel height, linter severity calibration, Scene producer validation, source-edit closed-schema acceptance, and shared project/package/Problems parity.
  - Focused causal tests, the configured official-corpus census, broad host gates, and durable records.
- Out of scope:
  - Other widget types' default/hotkey semantics; arbitrary complex properties; general Lua execution; runtime callbacks; generic C++ frame acceptance; new source-edit controls; frame/background paint parity; AI Influence reconstruction; installed-extension/OpenVSX release; a global 1:1 claim.
- Risks and authorization boundaries:
  - Primary risk is false clean output: a default or hotkey from another table/cell, a later default setter, a conditional branch, or forged evidence must never resolve this editbox.
  - A hotkey minimum changes row height as well as the descriptor. Updating only paint facts would create a convincing but geometrically false preview, so the immutable Helper kernel and Scene transition authority must agree.
  - Preserve all 49 pre-existing dirty paths. No mod, game, profile, credential, or user-facing release write is authorized by this unit; repository commit/push and the parent goal's GitHub/Notion/Drive record synchronization are authorized close operations.
- Rollback/checkpoint: `HEAD == origin/main == 396c57a587d0444b9e908251491b91f9f9a4cd73`. Revert only the named implementation/test/record paths if the unit fails. The game and mod roots remain untouched.
- Acceptance criteria:
  1. The three bounded call shapes are source-located and ordered in the existing call model. Literal non-editbox/non-hotkey variants remain outside this bounded editbox projection: they add no editbox lint finding, but any source-visible UI mutation not modeled by LayoutProgram remains an explicit unresolved program/preview gap. Dynamic potentially relevant shapes fail closed.
  2. Repeated table defaults merge in source order. A positive editbox default height applies only to later editbox creation on the same exact table. Call-specific `height` and `scaling` override simple defaults; a default written after creation does not mutate the existing cell.
  3. Complex hotkey defaults apply before direct `setHotkey`. Direct `setHotkey` first replaces the hotkey string, then applies its property table in shipped order: a supplied static `properties.hotkey` overrides the argument and a supplied `displayIcon` replaces that flag. Valid but unported `x`/`y` properties retain source evidence and force a partial preview rather than disappearing.
  4. Effective displayed-hotkey height is exactly `max(Helper.scaleY(baseHeight, scaling), 23)`. Empty hotkeys or `displayIcon=false` do not apply the minimum.
  5. Omitted height with a proven positive table default or proven displayed hotkey is clean for `x4-ui.editbox-height-minimum`; bare omission remains one nonblocking warning.
  6. Literal zero without a proven displayed hotkey remains blocking. Literal zero with a proven displayed hotkey is clean. A potentially applicable but dynamic/conditional hotkey produces a verification gap and nonblocking warning, never a false clean or a source-proven fatal.
  7. Layout cell/row/table geometry and `outerHeight` reflect the same effective value at UI scale `1` and a non-unit profile. Scene accepts the authentic transition and rejects altered ownership, ordering, minimum-height state, or source pin evidence.
  8. Button/dropdown hotkeys and defaults from another table/cell cannot affect an editbox result. Proving that separation must not promote unported widget effects to exact applied no-ops: the editbox linter stays clean while LayoutProgram/preview remains partial with source-located unresolved operations. Unknown receivers, widget types, complex-property names, values, aliases, and conditional paths remain explicit gaps or unchanged warnings.
  9. Project validation, package readiness, and IDE Problems preserve the same stable rule, path, line, severity, and blocking state.
  10. The configured official census remains `81/81/0`, `7,669,552` bytes, zero applicable fatal findings, 70 unverified files, 26 truncated files, and 13,681 verification gaps. The exact source-derived warning total is `29`: the five displayed-hotkey positives are resolved, while faithful button/editbox receiver separation restores three legitimate omission warnings that the pre-change analyzer had falsely cleaned. Any different delta requires reconciliation before acceptance.
  11. Every preview/result retains `Not verified in game`; no static or browser result claims C++ acceptance.
- Required validation and negative path:
  - Tests-first fail receipts for table default, complex default, direct hotkey, property-table hotkey override, unported hotkey x/y, explicit-zero override, repeated ordering, after-create default, dynamic/conditional values, wrong table/cell/widget, and forged authority.
  - Focused selftests: CallModel, LayoutKernel, LayoutProgram, Lint, Scene, SourceEdits, and server integration.
  - `npm run typecheck`; exact changed-file ESLint; B119 diff hygiene.
  - `npm run test:x4-ui-corpus -- --base-url http://127.0.0.1:52061 --json` against the installed read-only manifest authority.
  - After a fresh machine-state confirmation: oracle sweep, full serial E2E, precommit, production build, process/port cleanup, and live-workspace non-mutation checks.
- Evidence locations: this record; focused command output; corpus JSON summary; `BACKLOG.md`; `SESSION-HANDOFF.md`; GitHub #41; the B119 Notion owner page; the AI Knowledgebase Drive document; eventual exact commits and remote-parity receipt.
- Currently unavailable validation: exact Forge-versus-X4 pixel comparison is a later renderer-composition unit. No game write is needed to prove this source law because shipped source and the retained two-profile `pipeline_test` receipts already establish the real failure/positive boundary.

## BASELINE

- Revision/version: `main`, `HEAD == origin/main == 396c57a587d0444b9e908251491b91f9f9a4cd73`; X4 corpus identity is pinned by the hashes above; installed Antigravity sidecar version `0.0.70` exposes manifest generation `1785035333079-2178b4c31f` at `127.0.0.1:52061`.
- Existing changes/failures/runtime state:
  - 49 unrelated dirty paths predate this unit: 19 tracked and 30 untracked. None is owned here.
  - An initial installed-sidecar request timed out during startup and was incorrectly attributed to storage. A controlled retry proved `F:` online/healthy and loaded the configured corpus and manifest successfully. The installed sidecar is used only for read-only manifest enumeration; current-checkout code remains the analyzer under test.
  - Official corpus before change: `no-known-fatal-static-gaps`, `81/81/0`, `7,669,552` bytes, zero applicable fatal, warnings `31`, unverified `70`, truncated `26`, gaps `13,681`. Six restricted-online-call findings remain visible and are not applicable only to this trusted official-source census.
  - Focused green baseline: CallModel `72/72`; LayoutKernel `29/29`; LayoutProgram `641/641`; Lint `118/118`; Scene `154/154`; SourceEdits `81/81`; integration `11/11`.

## RECONCILE

- Resources and readers/writers searched:
  - Graphify query/affected paths for `X4UiRelevantCallName`, `buildX4UiCallModel`, and `checkEditBoxHeights`; direct inspection of the call model, kernel, layout replay/evidence schemas, linter, Scene producer validator, source-edit closed enums, and integration consumers.
  - Direct shipped `helper.lua` reads for defaults, simple/complex property application, setter order, and `getHeight`; manifest-selected inspection of all 81 official UI Lua files.
- Existing capability reused:
  - Exact receiver/reference tracking, source ordering, option projection, immutable Helper table state, profile scaling, layout evidence issuance, Scene producer-chain validation, shared static-analysis consumers, corpus manifest authority, and permanent game-truth labeling.
- Couplings checked:
  - parser call kind and option vocabulary -> ordered operation/evidence schemas -> table/cell owner maps -> kernel transition -> finalized row/cell geometry -> Scene structural authority -> linter/project/package/Problems severity parity -> corpus census.
- Presence/absence proof:
  - Official corpus contains 60 method-style editbox creations: 35 explicit heights and 25 omissions. Exactly five omissions are chained to a non-empty static hotkey with `displayIcon=true`; 20 remain bare under this bounded source path.
  - Official corpus has no literal `setDefaultCellProperties("editbox", ...)` or matching editbox complex-default call. Synthetic causal tests therefore prove those shipped APIs without pretending they changed the corpus.
  - Official corpus has one editbox `setHotkey` property table with `x = 0` (`ui/addons/ego_gameoptions/gameoptions.lua:11841`), no `y` property, and no property-table `hotkey` override. The current port silently drops that valid `x` field and therefore overstates preview completeness even though the height result is unchanged.
  - Existing Forge does not model any of the three bounded calls. It emits omission warnings and literal-zero errors without resolving the source paths named in its own evidence boundary.
- Capability-map delta: none yet. Record the exact bounded delta only after all required evidence passes.
- Plan changes:
  - Reconciliation expands the handoff's two named calls to include the shipped complex-default hotkey path required for source closure.
  - The forecast `31 -> 26` was rejected by the authoritative corpus. Faithful source attribution produces `31 -> 29`: five displayed-hotkey omissions become clean and three previously misattributed button/editbox cases become legitimate warnings. File, byte, fatal, unverified, truncated, and verification-gap counts remain stable. This acceptance-contract correction makes the task non-clean.
  - Fresh-eyes graph/downstream review rejected the current LayoutProgram identity-transition treatment for source-visible button defaults, non-hotkey complex defaults, and button `setHotkey`. They are provably irrelevant only to the bounded editbox rule; because their full widget effects are not projected, the renderer must emit source-located unresolved gaps and an honest partial preview while preserving the configured linter-corpus invariants.
  - Direct shipped-source inspection corrected the earlier `setHotkey` merge assumption. `properties.hotkey` can override the first argument and therefore changes the displayed-hotkey minimum decision; `x`/`y` are valid hotkey properties that affect pixels. Preserve/port the height-relevant override now and expose unported positional properties as LayoutProgram/preview gaps. The linter corpus count need not change because these are projection gaps, not new bounded editbox-rule uncertainty.

## IMPLEMENT

- Actual bounded changes:
  - Extended the existing ordered call model with exact table simple-default, table complex-default, and cell hotkey semantics, including source locations, receiver identity, statement ordering, and conservative control-flow row evidence.
  - Added a narrow source proof for fluent `createButton(...):setText/setText2/setIcon/setIcon2(...):setHotkey(...)` chains so button hotkeys cannot contaminate editbox height analysis. Generic `setIcon`/`setIcon2` receiver preservation now requires a tracked button cell.
  - Ported shipped `initTableCell` ordering and editbox `getHeight` behavior through the immutable layout kernel/program: simple defaults, complex defaults, custom properties, then `max(baseHeight, Helper.editboxMinHeight)` only for a non-empty displayed hotkey.
  - Propagated the same authority through linter findings, Scene evidence validation, source-edit closed schemas, static-analysis integration, package/project validation, and IDE Problems parity.
  - Closed Scene producer authority by requiring per-operation descriptor keys and optional fact presence to match exact static source-property presence. Omitted, dynamic, unavailable, arbitrary-extra, and coherently replayed forged editbox facts now fail closed while explicit `0`, `false`, and `""` remain valid source values.
  - Added causal positive and negative tests across the seven existing owners. Invalid editbox `setIcon`/`setIcon2` chains, ambiguous branches, wrong tables/cells, unknown factories, forged receivers, and post-creation defaults fail closed.
  - Ported the shipped `setHotkey` property-table override order, retained source-linked gaps for valid but unported `x`/`y` and other bounded hotkey properties, and allowed a later exact static hotkey/display-icon assignment to clear earlier lint uncertainty only when the final state is source-proven.
  - Closed the corresponding Scene authority: unsupported-property gaps must exist in both Program and authority with exact source/value/reason/node correlation, producer replay must use the winning source and actual `displayIcon` own-key state, and property-name normalization now matches CallModel for underscore, hyphen, and whitespace variants.
- Scope changes and reasons: no product-scope expansion beyond the reconciled complex-default inclusion. The original five causal review defects plus the later setHotkey/unsupported-property/normalization escapes were repaired within scope; no new renderer or compiler path was introduced. Two validation-harness blockers discovered by the required broad gates were repaired in their existing owners: the isolated oracle server now starts in API-only/no-HMR mode and removes both owned temporary roots fail-closed, while Windows E2E process ownership now uses bounded PowerShell/CIM output through the existing strict WMIC-compatible parser because current Windows no longer ships `wmic.exe`.

## VALIDATE

- Method -> result -> evidence:
  - `npx tsx src/lib/x4UiCallModel.selftest.ts` -> PASS `89/89`.
  - `npx tsx src/lib/x4UiLayoutKernel.selftest.ts` -> PASS `34/34`.
  - `npx tsx src/lib/x4UiLayoutProgram.selftest.ts` -> PASS `648/648`.
  - `npx tsx src/lib/x4UiLint.selftest.ts` -> PASS `140/140`.
  - `npx tsx src/lib/x4UiScene.selftest.ts` -> PASS `174/174`.
  - `npx tsx src/lib/x4UiSourceEdits.selftest.ts` -> PASS `83/83`.
  - `npx tsx src/server/x4UiIntegration.selftest.ts` -> PASS `21/21`.
  - Focused total -> PASS `1,189/1,189` assertions.
  - Independent downstream replay -> PASS: PreviewPipeline `105/105`, PaintPlan `175/175`, CanvasRenderer `129/129`, EditorSession, SourceBundle, and complete source-editor matrices.
  - `npm run typecheck` -> PASS, exit `0`.
  - Exact 15-file ESLint -> PASS, zero errors; eight pre-existing `luaStaticAnalysis.ts` `no-explicit-any` warnings.
  - `git diff --check -- <15 bounded source/test paths>` -> PASS, exit `0`.
  - `npm run test:x4-ui-corpus -- --base-url http://127.0.0.1:52061 --json` -> PASS twice at the current final source-law revision and same ready manifest: files `81/81/0`, bytes `7,669,552`, applicable fatal `0`, warnings `29`, unverified `70`, truncated `26`, gaps `13,681`, exit `0`. The six restricted-online-call findings remain visible and are non-applicable only for the trusted official-source census.
  - Temporary installed sidecar shutdown -> PASS; port `52061` clear.
  - `npm run test:oracles` under accepted Node `v24.19.0 / libuv 1.52.1` -> PASS `134/134`, exit `0`; port `8972`, owned server process, and newly created oracle temporary/discovery roots were absent after teardown.
  - Windows process ownership focused matrix -> PASS `107/107`: parser `37/37`, adapter `31/31`, sampler `8/8`, termination async `10/10`, termination executor `9/9`, lifecycle `12/12`; live PowerShell/CIM capture included the current PID with a valid DMTF creation token.
  - Exact Git-tracked serial E2E set (`23` specs; unrelated untracked showcase excluded) -> PASS `103/103` in `6.9m`, zero failed/flaky/bad/quarantined, child exit `0`, structured report complete with `103` discovered and `103` terminal tests. Receipt `test-results/e2e-verdict.json` records root PID `47012`, `ownershipComplete=true`, termination `complete=true`, `treeGone=true`, and `remainingPids=[]`.
  - Post-E2E containment -> PASS: ports `3100/3101/8972` clear, X4 absent, and no exact E2E-owned process remained.
  - `npm run precommit:check` under accepted Node -> PASS, exit `0`; includes tripwires, mirrored canon, E2E verdict `55/55`, Vite lifecycle, product-copy, durable-writer `14/14`, capability contract (`12` capabilities / `297` literal routes / `11` MCP aliases), MCP authority, action-receipt coverage (`82` routes / `56` surfaces), and typecheck.
  - `npm run build` under accepted Node -> PASS, exit `0`; Vite transformed `1,848` modules and esbuild emitted `dist/server.cjs` plus source map. The existing large-chunk advisory remains nonblocking.
  - `graphify update .` -> PASS, exit `0`; refreshed `10,029` nodes, `25,198` edges, and `317` communities. HTML visualization was intentionally skipped by Graphify's `5,000`-node safety limit; JSON/report authority updated.
  - Exact baseline/final protected-root comparison -> PASS: `.studio-state` `9` files / `12,382,674` bytes / `34EE8656...0401`; `data` `3,686` files / `475,086,457` bytes / `18C74EA9...4D65`; repository `config.json` `3EC65D54...7779`; installed Antigravity Forge config `355B4B63...3B5A`. Ports `3000/3001/3100/3101/52061/8972` were clear and X4 absent.
- Negative/rollback result: button-only `setIcon` and `setIcon2` cannot clean literal-zero editboxes; wrong receiver/table/cell, sibling branches, arbitrary bound indexed values, dot calls, unknown fluent methods, later factories, dropped/forged unsupported-property gaps, stale unresolved state after an exact override, false `displayIcon` replay, altered normalized property names, and other altered Scene evidence all remain gaps or are rejected. Three earlier Scene fail-first rounds proved pair-valid coherent forgeries were rejected only after source/fact reciprocity enforcement: omitted known facts (`156/163 -> 163/163`), dynamic-source materialization (`163/168 -> 168/168`), and unavailable/arbitrary-extra facts (`168/172 -> 172/172`). No rollback was required.
- Visual/live result when applicable: not applicable to this source-law unit; retained game truth remains external and every preview remains `Not verified in game`.
- Host validation boundary: the operator supplied `go - Antigravity open; X4 not running; machine quiet`. All declared broad host methods then passed serially. This proves the bounded source port and Forge host regression surface, not C++ frame acceptance or Forge/X4 pixel parity.

## REVIEW

- Requirement -> done | partial | missed | deferred | out of scope:
  - Criteria 1-9 and 11 -> done and evidenced by the focused suites and exact source inspection.
  - Criterion 10 -> done after documented contract correction from the forecast `26` to the authoritative `29` warnings; all other census invariants match exactly.
  - Broad host gates -> done and evidenced by the `134/134` oracle receipt, `103/103` lifecycle-complete E2E receipt, precommit, build, Graphify refresh, and exact protected-root non-mutation proof.
  - Pixel parity, installed-extension/OpenVSX release, AI Influence reconstruction, and final two-profile game comparison -> deliberately deferred by this bounded unit and remain part of parent B119.
- Fresh-eyes findings for significant changes:
  - Review found the first implementation omitted shipped `button:setIcon2`; a causal fail-first test was added and the same narrow structural path now covers both icon setters.
  - Review found generic `setIcon`/`setIcon2` receiver preservation could falsely clean an invalid editbox chain. Production now requires tracked button identity, with call-model and linter fail-first negatives proving containment.
  - Review found Scene checked source-property values only in the forward direction, so an omitted property could be paired with a forged known fact and matching replayed state. Exact source/fact presence is now reciprocal.
  - Review found syntactic property presence was insufficient for a dynamic Lua value. Materialized transitions now require the source property itself to be exact and static.
  - Review found unavailable and arbitrary extra facts could forge provenance without changing layout. Descriptor keys are now closed by operation kind and own-key presence must match the source.
  - Review found valid `setHotkey` properties were either rejected or silently dropped. The call model now retains them, the kernel applies the exact hotkey/display-icon merge order, and LayoutProgram emits source-linked partial gaps for unported geometry.
  - Review found later exact hotkey overrides could leave stale uncertainty, producer replay could apply the wrong icon state, and Scene used a weaker property-name normalization than CallModel. Causal tests now close all three boundaries, including `hotkey_x` normalization.
  - The final structural proof is bounded to one colon-call statement, a source-proven row binding, static cell index, exact earlier `createButton`, and only shipped self-returning button setters. No corpus special case or filename exception was introduced.
  - Final manual review found no remaining blocking defect in the exact `18` implementation/test/harness files. `reviewctl` is not installed on this host; automated review authority is the green focused/corpus/host gates plus Graphify blast-radius inspection. The E2E wrapper itself correctly rejected the first `103/103` browser pass because process ownership was incomplete, preventing a false-green close.

## CLOSE

- Status: VERIFIED for this bounded editbox descriptor-height source port. Focused, downstream, official-corpus, oracle, lifecycle-complete E2E, precommit, production-build, Graphify, and exact live-state containment gates are green. Parent B119 remains PARTIAL and `Not verified in game`; this close does not claim C++ acceptance or global pixel parity.
- Remaining risks/deferred work: exact-path source commit/push and GitHub/Notion/Drive readback are the immediate record-close steps; then frame outline/background-alpha parity, keep-out overlays, AI Influence visual reconstruction, installed-extension proof, OpenVSX publication, and final exact two-profile Forge/X4 comparison remain parent-B119 work.
- Suggested commit title when applicable: `feat(ui-editor): port editbox descriptor height semantics`.

## AAR

- Triggers: reconciliation added the complex-default source path; five fail-first review corrections were required; the warning-count forecast was wrong; the first sidecar timeout was misdiagnosed before a controlled retry; one retry command had a literal-path quoting failure before launch; the first oracle run exposed API readiness/temporary-root ownership defects; the first E2E run passed `103/103` browser assertions but correctly failed lifecycle ownership because `wmic.exe` is absent; the sampler selftest still encoded WMIC after the production adapter repair; the first trusted-read wrapper attempt used an unavailable V8 `TextEncoder` before any connector write; one read-only PowerShell inspection used invalid inline `if` syntax and was rerun fail-closed; the first host command assumed a missing `npm.cmd` before the accepted Node runtime's npm CLI was selected; and `reviewctl` was unavailable, requiring the documented manual/automated fresh-eyes review boundary.
- Sustain: inspect the manifest-selected shipped corpus and require causal negatives before changing a linter rule that cites official counterexamples.
- Improve work/approach: distinguish forecasted count changes from acceptance invariants. The analyzer must follow source semantics even when that produces a less attractive count.
- Improve tools: sidecar readiness needs an explicit health/readiness wait so startup timing cannot be confused with storage failure. Validation harnesses must test their real host dependency: the Windows ownership adapter now uses PowerShell/CIM and has a live-own-PID assertion, while the oracle owner starts API-only and treats owned-root cleanup failure as gate failure.
- Highest-risk evidenced weakness: a pair-valid evidence snapshot could previously manufacture a Scene producer transition from omitted or dynamic Lua properties. Closed descriptor schemas, reciprocal own-key/source-property checks, static-source requirements, and nine causal hostile cases now contain that authority boundary.
- Global/project lessons banked: the bounded source port and both harness corrections are now backed by focused, corpus, lifecycle-complete host, and containment evidence. Repository/external record projection follows the exact source commit; parent B119 remains open.
