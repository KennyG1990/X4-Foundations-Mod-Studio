# B119 — X4 UI Editor, Linter-First Port

Status: IN_PROGRESS
Lane: FULL
GitHub owner: [#41](https://github.com/KennyG1990/X4_Forge/issues/41)
Date: 2026-08-10

## Task

Begin the real X4 UI-editor upgrade with one bounded, shippable unit: build a source-backed model of the X4 Lua
widget calls and use it to detect the silent frame-refusal and layout traps from the supplied production brief. Wire
the findings into the Forge's existing Lua analysis, shared project validation, package/export/deploy gates, IDE
diagnostic currency, and UI editor. Do not start the visual renderer until this referee is trustworthy.

## PLAN

### Bounded unit

Batch 1 only:

1. Parse literal and statically traceable X4 UI calls into one ordered call model with source locations and explicit
   unknown/dynamic values.
2. Evaluate every rule in the brief's linter table against that model.
3. Reuse `analyzeLuaFiles()` and `runProjectValidation()` so authoring, imported whole-mod validation, package/export,
   deploy readiness, IDE Problems, and the UI editor consume the same findings.
4. Replace false-green UI copy with `Not verified in game`, `No known rule violated`, and
   `Not statically verified` states.

### Assumptions and unresolved facts

- X4 executable version is `9.0.0.0`; the configured unpacked corpus is `X4 unpacked 9.00`.
- Installed-host runtime authority is Antigravity's extension-owned config at
  `C:\Users\Moshi\AppData\Roaming\Antigravity IDE\User\globalStorage\x4forge.x4-forge-studio\config\config.json`.
  Readback on 2026-08-10 confirms `x4ReferenceRoot = F:\Downskies\x4unpackersuiteV1\X4 unpacked 9.00` and that the
  directory exists. A repository-shell `resolveXsdConfig()` without the extension's `X4_CONFIG_DIR` reads the
  checkout fallback and is not evidence about the running installed host.
- Authoritative layout sources for this install are:
  - `ui/addons/ego_detailmonitorhelper/helper.lua`, SHA-256
    `D24A08B8DA9F2C972794B60ACB48AE36F38CB026C991249DAB9F1164272D4DF2`.
  - `ui/widget/lua/widget_fullscreen.lua`, SHA-256
    `420AFBA33D925A7B55F2A82AB12773DF04826EF588317010D209B249DE7BAED1`.
- The brief's `ui/core/lib/helper.lua` path does not match this corpus. The inspected
  `ego_detailmonitorhelper/helper.lua` is the source to cite and later port.
- Engine acceptance remains C++-side. In-game evidence proves `addTable(12)` draws and `addTable(24)` refuses the
  whole frame; `13..23` were not bisected. Batch 1 uses `N <= 12` as a conservative export policy and says exactly
  what was measured.
- A numeric table width below 2 px is a known refusal case. Dynamic/scaled widths cannot be declared safe by static
  analysis.
- Row-height and same-layer hazards are statically decidable only for bounded literal/data-flow shapes. Unsupported
  shapes must say `not statically verified`, not pass.
- Zekton in the inspected corpus is `.abc` plus `.dds`, not a discovered TTF/OTF. Font decoding and metric parity are
  deferred to the renderer batch; a browser fallback font is not authorized as "exact".

### Authoritative references

- User brief: `FORGE-UI-EDITOR-BRIEF.md` supplied on 2026-08-10.
- X4 9.00 `helper.lua` and `widget_fullscreen.lua` hashes above.
- AI Influence production menus:
  `aic_menu.lua`, `aic_hub.lua`, and `aic_comm.lua`.
- AI Influence `tools/commfullgate.py` and `tools/glyphgate.py`.
- StarForge methods:
  `addtable-column-count-can-make-the-engine-refuse-the-whole-frame.md` and
  `three-lua-ui-traps-only-the-running-game-reveals.md`.
- Existing Forge owners: `src/lib/luaStaticAnalysis.ts`, `src/server/projectValidation.ts`,
  `src/lib/modCompiler.ts`, `src/lib/projectOrchestration.ts`, `src/components/UIBuilder.tsx`, and B34/B36 records.
- Architecture decisions F1/F2/F4/F5. In particular, ADR-F2's veteran floor forbids making the visual path
  mandatory or weakening raw/source fidelity.

### In scope

- Ordered, location-bearing static model for `createFrameHandle`, `addTable`, `setColWidthPercent`, `setColWidth`,
  `addRow`, `setColSpan`, rendered text/edit-box literals, `display`, `OpenMenu`, frame/menu names, and layers.
- Literal propagation through common local assignments, table/row aliases, indexed row cells, and fluent call chains.
- Explicit dynamic markers where a count, index, span, width, percentage, height, layer, target menu, or data-flow
  link cannot be proven.
- Rule IDs, severity, cause, actual failure mode, source location, evidence boundary, and next action.
- Shared project-validation result/summary/flattening and package-readiness integration.
- UI editor status and finding presentation for generated preview plus custom Lua.
- Deterministic selftests, project/package integration fixtures, three-real-menu checks, and a bounded vanilla/DLC UI
  Lua fatal-finding census.

### Out of scope

- Browser layout rendering, Canvas/WebGL widgets, UI-scale simulation, keep-out overlays, screenshot tracing, and
  screenshot comparison.
- Zekton `.abc`/`.dds` decoding or font asset redistribution.
- Lua import-to-canvas, source-splice editing, multi-file UI project persistence, or changing `ModWorkspace` schema.
- Replacing the current lossy `uiWidgets` generator. It remains legacy and must be labeled honestly; no silent
  migration is allowed.
- Standalone LSP/provider products, new public APIs, new MCP tools, or a parallel validator.
- Writes to the real mod, game installation, configured live workspace, installed extension, or Open VSX.
- Claiming a clean lint result proves frame acceptance or in-game rendering.

### Rule policy

| Rule | Static policy | Severity when proven |
|---|---|---|
| `addTable(N)` column count | `N <= 12` accepted; literal `13+` rejected; dynamic marked unverified. Message states 12 passed, 24 failed, 13–23 unbisected. | error |
| Table width | Literal width `< 2` rejected; scaled/dynamic width marked unverified. | error |
| Column index | Literal index outside `1..numColumns` rejected; unknown association/index marked unverified. | error |
| Width after first row | Proven `setColWidth*` after `addRow` on the same table rejected because X4 ignores it. | error |
| Column percentage | Static total `>100` rejected. All columns explicitly assigned and total `<100` warns that the table contracts. Mixed explicit plus automatic columns is valid. Dynamic totals are unverified. | error / warning |
| Colspan | Proven `startColumn + span - 1 > numColumns` rejected; dynamic association/index/span is unverified. | error |
| Font scaling | `fontsize = Helper.scaleX(...)` or `Helper.scaleY(...)` rejected; `scaleFont` remains valid. | error |
| Rendered non-ASCII | Check only literals that flow directly into known render calls/properties, never comments/prompts/arbitrary strings. | warning |
| Row-height budget | Reject/warn only when literal frame/table/row values prove overflow; otherwise mark budget unverified. Do not invent a universal "large" number. | warning |
| Inline display | A `display()` rebuild proven inside an assigned `handlers.onClick` function is rejected. | error |
| Same-layer inline open | Direct `OpenMenu` from an onClick is rejected only when current/target menu and equal literal layer are proven. Unresolved cases are unverified. | error |

Error findings participate in package/project/deploy blocking. Warnings make the package/diagnostic state amber but do
not claim engine rejection. Informational verification gaps prevent the UI from saying `No known rule violated` for
the affected boundary.

### Likely affected files

- Add `src/lib/x4UiCallModel.ts`.
- Add `src/lib/x4UiLint.ts` and its focused selftest.
- Modify `src/lib/luaStaticAnalysis.ts` to project the new findings through the existing owner.
- Modify `src/server/projectValidation.ts` to make Lua/X4 UI analysis a first-class layer and flat diagnostic source.
- Modify `src/lib/modCompiler.ts` only where package readiness currently hides analyzer warnings.
- Modify `src/components/UIBuilder.tsx` for truthful status/finding copy.
- Add a stable corpus/integration check under `scripts/` and a package script if warranted by existing conventions.
- Add a focused Playwright case only after the static/integration contract is green.
- Update this plan, `BACKLOG.md`, `ROADMAP.md` on close, `SESSION-HANDOFF.md`, capability-map delta, and both required
  AAR ledgers.

### Risks and authorization boundaries

- **False fatal findings:** the highest implementation risk. Fatal rules require literal/data-flow proof; unknowns
  degrade to an explicit verification gap.
- **False green:** dynamic values or unsupported Lua shapes must never be silently dropped from the verification
  summary.
- **Cross-layer drift:** a linter visible only in UIBuilder would let imported Lua bypass deploy checks. The existing
  shared validation and package seams are mandatory.
- **Parser compatibility:** do not change the existing Lua parser mode in this batch without a full corpus regression.
- **Performance:** parse each Lua document a bounded number of times; corpus check records file count and elapsed time.
- **User work:** preserve every pre-existing dirty/untracked/deleted path. No broad Git add/reset/clean/checkout/stash.
- **External effects:** issue #41 is the only authorized external tracking write. No publishing, installation, real
  mod/game/config write, commit, or push is part of this batch unless separately authorized and gated.

### Rollback/checkpoint

- Source checkpoint: `HEAD == origin/main == 0d49c6922c77536d49f6860a235d018ecbfba43b`.
- Roll back only B119-owned new files and exact hunks. Reinstalling or touching the current public extension is not
  needed because this batch begins in source only.
- Preserve the dirty inventory recorded below and in `SESSION-HANDOFF.md`.

### Acceptance criteria

1. Every row in the brief's linter table has a named positive and negative test.
2. `addTable(12)` is clean; `addTable(13)` and `addTable(24)` are blocking errors with the calibrated evidence text.
3. A dynamic `addTable(#items)` produces a verification gap, not a blocking guess and not a false green.
4. Mixed explicit/automatic widths are clean; all-explicit `<100` warns; `>100` blocks; out-of-range indices and
   post-row width changes block.
5. Rendered Unicode trips while identical Unicode in comments, prompts, or non-render strings stays clean.
6. Direct onClick display and proven same-layer inline OpenMenu block; dirty-flag/deferred update and different-layer
   fixtures stay clean.
7. Obvious literal row overflow trips without inventing a universal threshold; unresolved budget is reported.
8. `runProjectValidation()` exposes the layer, summary, locations, and flattened findings; proven UI-lint errors make
   `ok:false`.
9. Package/export readiness blocks fatal custom UI Lua and surfaces warnings. Deploy continues to rely on the same
   validated artifact/readiness chain.
10. UIBuilder says `Not verified in game`; clean static results say `No known rule violated`; incomplete analysis says
    `Not statically verified`. `layout valid`, `responsive grid`, and similar proof-like claims are removed or made
    explicitly legacy/geometry-only.
11. `aic_menu.lua`, `aic_hub.lua`, and `aic_comm.lua` parse successfully and have zero false fatal findings. Dynamic
    gaps are allowed and enumerated.
12. The configured vanilla/DLC UI Lua corpus has zero unexplained fatal findings. Any exception is source-cited and
    causes `PARTIAL`, not a suppressed green.
13. Typecheck, lint, relevant selftests, runtime oracle sweep, focused/full isolated E2E, production build, graphify
    refresh, and precommit pass. Rendered Studio inspection proves the status/finding UX.
14. No real mod/game/config/installed-extension bytes change, and all unrelated worktree changes remain intact.

### Required validation and negative paths

- Baseline and post-change `npm run typecheck`.
- Focused X4 UI linter selftest with per-rule check names.
- Existing Lua static-analysis, UI compiler, package-status, and project-orchestration selftests.
- Direct `runProjectValidation` fixture proving fatal/amber/dynamic result and flat-diagnostic parity.
- AI Influence three-menu check and configured vanilla/DLC corpus census.
- `npm run lint`; `node scripts/oracle-sweep.mjs`; `npm run build`.
- Focused Playwright UI-linter status/diagnostic case, then verdict-parsed `npm run test:e2e` with ephemeral-stack and
  live-workspace containment checks.
- `graphify update .`; `npm run precommit:check` only after every prior applicable layer is green.
- Real rendered Studio screenshot/interaction for `Not verified in game`, fatal, warning, and unverified states.
- No X4 runtime validation is claimed in Batch 1. A later scratch extension plus game screenshots remains the
  authority for engine/experience proof.

### Evidence locations

- This plan is the implementation/validation record.
- GitHub #41 is the public execution projection.
- Focused deterministic tests live beside the owning linter and under `scripts/`.
- Rendered/package evidence, if produced, goes under
  `vscode-extension/evidence/2026-08-10-b119-x4-ui-lint/`.
- Close delta goes to `ROADMAP.md`, `SESSION-HANDOFF.md`, capability map, and the project/global AAR ledgers.

### Currently unavailable validation

- E2E/rendered-host work waits for the required machine-state answer: whether the user is in Antigravity, whether X4
  is running, and whether the machine is quiet.
- In-game frame acceptance is deliberately deferred; Batch 1 can be VERIFIED as a static/product linter only, while
  issue #41 remains open for renderer and X4 experience phases.

## BATCH 1B ACCEPTANCE CONTRACT

Status: `VERIFIED` at the bounded pure-library contract; product integration remains pending.

### Bounded unit

- Add only `src/lib/x4UiLint.ts` and `src/lib/x4UiLint.selftest.ts`.
- Consume an already-built `X4UiCallModel`; do not read files, configuration, the unpacked corpus, or the network.
- Return deterministic, source-ordered findings and explicit verification gaps. A parse failure, unsupported or
  dynamic required value, unresolved receiver/ownership link, or truncated call-model gap list must never collapse
  to a clean/static-verified result.
- Keep `src/lib/x4UiCallModel.ts`, analyzer/project/package/UI owners, scripts, and package metadata read-only in this
  unit. If the verified model lacks a fact required for a sound rule, report that contract gap rather than expanding
  scope or guessing.

### Public result contract

- Export one pure model evaluator plus public result/finding/rule types and `runX4UiLintSelftest()` from the focused
  selftest module.
- Every proven finding carries a stable rule/code identity, `error | warning | info` severity, cause, real failure
  mode, calibrated evidence boundary, source location, and next action.
- The result separately exposes whether errors, warnings, verification gaps, or truncated evidence exist; callers
  must be able to distinguish `No known rule violated` from `Not statically verified` without parsing prose.
- Preserve the model's source path and one-based line/zero-based column convention. Sort and deduplicate output
  deterministically.

### Required rule tests

- Column limit: `12` clean; `13` and `24` error with the measured `12 passed / 24 failed / 13-23 unbisected` boundary;
  runtime/dynamic count is a verification gap only.
- Table width: static width below `2` errors; `2` is clean; dynamic/scaled width is unverified, not fatal.
- Column ownership/index: in-range clean; literal zero/negative/greater-than-count errors; unresolved table or index is
  unverified.
- Width freeze: same-table width assignment before the first row is clean; after the first row errors; another table
  and unresolved ownership do not cross-contaminate.
- Percentage allocation: mixed explicit/automatic columns clean; all-explicit below `100` warns; static total above
  `100` errors; exact `100` clean; dynamic/duplicate/unknown ownership remains conservative and explicit.
- Colspan: last occupied column within the table is clean; proven overrun errors; dynamic start/span/table count is
  unverified.
- Font scale: a rendered `fontsize` sourced from `Helper.scaleX` or `Helper.scaleY` errors; `Helper.scaleFont` and an
  ordinary static font size are clean.
- Rendered non-ASCII: direct rendered text/edit-box literals warn; identical Unicode in comments, prompts, arbitrary
  strings, and non-render properties stays clean.
- Row budget: a literal sum of row heights above a literal table height warns; a literal table height above its
  literal frame height warns; equal/within-budget values are clean; omitted or dynamic budgets are unverified. No
  universal large-number threshold may be invented.
- Inline display: `display()` directly inside an assigned `onClick` handler errors; top-level display and a handler
  that sets a dirty/deferred-update flag stay clean.
- Same-layer open: direct `OpenMenu` inside `onClick` errors only when current menu, target menu, and equal literal
  layers are all proven; a different literal layer is clean and unresolved identity/layer is unverified.
- Parse failure and `verificationGapsTruncated` each force a not-statically-verified result.
- Add aggregate no-cry-wolf checks: clean fixtures produce zero errors/warnings, every finding is source-located, and
  repeated evaluation is byte-for-byte deterministic.

### Validation for this unit

- Focused exported selftest reports every named check, totals, and failure details and exits non-green through its
  invoking assertion when any check fails.
- `npm run typecheck` and targeted ESLint pass for both new files.
- Independent coordinator fixtures reproduce the highest-risk thresholds and false-positive boundaries without
  relying only on the worker's selftest.
- Three AI Influence production menus parse and lint with zero false fatal findings; gaps and truncation remain
  visible. This is a production regression check, not an in-game acceptance claim.

### Batch 1B.1 reconciliation amendment - control-flow soundness

Status: `VERIFIED` after coordinator review changed and revalidated the acceptance contract.

- The first 66-check implementation passed its focused suite, typecheck, targeted ESLint, and the three-menu
  production regression. Independent fixtures then reproduced three false findings because source calls in
  mutually exclusive or statically dead `if` branches shared only a function identity: a `60/60` percentage total,
  width-after-row under `if false`, and two alternative row heights were all treated as co-executing.
- This amendment narrowly adds `src/lib/x4UiCallModel.ts` to Batch 1B ownership. It must expose immutable,
  source-located `if`-branch path/reachability metadata on modeled records without making lint decisions, executing
  Lua, reading files/configuration, or changing existing value/data-flow semantics. Literal Lua truthiness may mark
  a branch unreachable; dynamic conditions remain conditional, never guessed true or false.
- `src/lib/x4UiLint.ts` must ignore statically unreachable calls and may combine/order calls only when their exact
  function/handler identity and branch paths are compatible. Calls in distinct functions or mutually exclusive
  branches produce an explicit verification gap, not a fatal finding. Calls in the same function and compatible
  path retain the existing rules; a call outside a branch is compatible with a reachable call inside either arm.
- Required negative fixtures: mutually exclusive `60/60` percentages have no total finding; `if false` row before a
  width call has no width-freeze finding; mutually exclusive row heights do not sum. Required positive controls:
  sequential same-context width-after-row still errors, same-branch percentages above `100` still error, and
  same-branch literal row overflow still warns. Nested branches and `if true`/`elseif`/`else` reachability must be
  deterministic and source-located.
- Existing 66 checks, typecheck, targeted ESLint, deterministic repeat evaluation, and three production-menu zero
  fatal regression remain mandatory. Loops and runtime function-call order remain explicit static-analysis
  boundaries; this amendment must not invent execution counts or interprocedural order.

### Explicitly deferred after Batch 1B

- Registration in `analyzeLuaFiles()`, `runProjectValidation()`, package/export/deploy readiness, the IDE Problems
  collection, and `UIBuilder.tsx` truth-state UX.
- Configured vanilla/DLC census, corpus consumer classification, E2E, rendered Antigravity inspection, production
  build, precommit, commit/push, renderer/layout port, Zekton metrics, keep-out zones, round-trip editing, and X4
  runtime proof.

## BATCH 1C ACCEPTANCE CONTRACT

Status: `SPECIFIED` after post-outage re-baseline; no Batch 1C source edit has started.

### Bounded unit

- Make `analyzeLuaFiles()` the one product owner of the already-verified X4 UI call-model/linter result. It must
  retain per-file `X4UiLintResult` truth while projecting proven errors/warnings and a bounded unverified/truncation
  summary into the existing `LuaStaticFinding[]` currency.
- Add one first-class Lua/X4 UI layer to `runProjectValidation()`. It must analyze every loaded Lua file once through
  the shared owner, expose per-file results and summary counts, flatten source-located findings, and make proven Lua
  errors participate in `ok:false`.
- Reuse that same analyzer result in package/readiness and agent-project packaging. Proven errors block; warnings are
  amber; verification gaps and truncation remain informational and must never become a clean claim or a blocker by
  guesswork.
- Repair the reconciled custom-Lua export contradiction in the same package seam: the workspace/type/UI contract says
  `customLua` is packaged as `ui/<id>_custom.lua`, but `buildWorkspaceFileManifest()` currently emits no such file and
  `generateUIIndexXML()` registers only the generated menu. Emit the exact custom bytes, register generated-first then
  custom in `ui.xml`, and validate those exact emitted bytes. This is required for lint-to-deploy parity, not a new
  multi-file editor or source-order migration.
- Reuse the existing IDE Problems projection. `vscode-extension/src/diagnosticsMap.ts` already consumes the shared
  `flat` project currency continuously, so no second diagnostic collection, extension-only rule implementation, or
  parallel provider is permitted.
- Update `UIBuilder.tsx` to evaluate both the exact generated package-preview Lua and custom Lua through
  `analyzeLuaFiles()`. Replace `layout valid` and `responsive grid` proof-like copy with explicit geometry-only and
  static-lint truth, and show `Not verified in game` for every state.

### Shared parity contract

- Each proven X4 UI defect keeps the pure linter's stable code, severity, one-based line/zero-based column, cause,
  actual shipped failure mode, evidence boundary, and next action. Generic flat/Problems consumers must receive the
  failure mode in readable diagnostic text; richer consumers may also use the structured fields.
- Per analyzed file, callers can distinguish: proven errors, proven warnings, complete clean static evidence,
  incomplete static evidence, and truncated evidence. These are independent axes: an error with unresolved evidence
  remains both blocking and `Not statically verified`.
- Dynamic/unsupported details stay in the bounded per-file result. Product diagnostic lists emit one source-anchored
  informational summary per unverified file plus a distinct truncation diagnostic when applicable; they do not flood
  Problems with every low-level model gap.
- Clean wording is exactly `No known rule violated`. Incomplete wording includes `Not statically verified`. Every
  authoring/preview surface includes `Not verified in game`. No static path may say that X4 accepted or rendered a
  frame.
- Only UI-likely Lua is sent through the X4 UI model: Lua below `ui/` or `subst_lua/`, plus Lua outside those folders
  that contains a modeled X4 UI call/menu signal. Baseline Lua syntax/global/X4 rules continue to run for every Lua
  input.

### Owned integration seams

- Analyzer owner and focused checks: `src/lib/luaStaticAnalysis.ts`.
- Shared validator and flattening: `src/server/projectValidation.ts`.
- Package/readiness projection: `src/lib/modCompiler.ts`, `src/lib/modDoctor.ts`, and
  `src/lib/projectOrchestration.ts` only where their existing consumers currently discard warning/location/truth
  fields.
- Existing custom-Lua package contract repair: `src/types.ts::generateUIIndexXML()` plus
  `server.ts::buildWorkspaceFileManifest()` and their current selftests. No other compiler/export architecture changes.
- UI truth-state consumer: `src/components/UIBuilder.tsx`.
- Cross-layer regression: a focused X4 UI integration selftest registered in the existing runtime selftest index;
  it may call the existing vscode-free `mapFlatFindings()` helper to prove Problems parity without changing the
  installed extension provider.
- Corpus census: a read-only script over the configured `x4ReferenceRoot` authority; it may report elapsed/file/fatal/
  warning/unverified/truncated counts but may not create a second corpus setting or scanner product.

### Required positive and negative evidence

1. Analyzer: a clean 12-column UI file reports `No known rule violated`; 13 columns produces the calibrated blocking
   code and whole-frame/conversation-close failure mode; dynamic count is informational `Not statically verified`;
   forced truncated evidence is distinct.
2. Project validator: the same fatal file appears once in the first-class Lua layer and flat diagnostics at the same
   path/line and makes `ok:false`; warning-only stays `ok:true`; dynamic/unverified stays `ok:true` and not clean.
3. Package/export/deploy chain: exact custom UI Lua bytes are emitted at `ui/<id>_custom.lua`, registered after the
   generated menu in `ui.xml`, and are the bytes analyzed by readiness/full-project validation. A fatal appears with
   its real file/line and blocks readiness, compile, release, and deploy preflight through existing shared gates.
   Warning-only is retained as amber; informational gaps do not block. A custom-only workspace must not collapse to
   a manifest/README-only package.
4. Agent-project packaging exposes error/warning/unverified/truncation counts from the same analyzer and blocks only
   errors.
5. IDE Problems mapping anchors the project-flat X4 UI diagnostic to the Lua file and preserves severity, code, line,
   and failure-mode text. Existing collection ownership remains unchanged.
6. UIBuilder renders generated-preview and custom-Lua fatal, warning, clean, unverified, and truncation states; removes
   the two false proof phrases; and always renders `Not verified in game`.
7. Existing 78/78 pure linter, Lua static, UI compiler, project orchestration, package/readiness, diagnostics-map, and
   runtime oracle checks remain green. The three AI Influence menus retain zero false errors/warnings and visible
   unverified/truncation state.
8. Configured vanilla/DLC UI Lua census has zero unexplained fatal findings. A fatal hit is investigated and leaves
   the batch `PARTIAL` until source-cited or repaired; it is never silently suppressed.

### Validation order and gates

- Focused owner/selftest commands, coordinator parity fixtures, typecheck, targeted ESLint, production menus, and the
  configured read-only corpus census run before the broad gates.
- Then run full lint, runtime oracle sweep, production build, and graph refresh. Graphify's current graph predates the
  untracked B119 files, so live source remains authoritative until that refresh passes.
- Before precommit, isolated E2E, or rendered Antigravity validation, ask exactly: `Are you in Antigravity, is X4
  running, and is the machine quiet?`
- No commit, push, publish, installation, configured-directory write, real mod/game write, or X4 runtime claim belongs
  to this unit without a separate authorization/gate.

## BASELINE

- Revision: `main`, `HEAD == origin/main == 0d49c6922c77536d49f6860a235d018ecbfba43b`.
- Post-outage resume on 2026-08-10 re-proved the same local/origin/remote revision, preserved all three B119 source
  files byte-for-byte at SHA-256 `A4F254AB...F47`, `03F698C7...795`, and `AF4BA1F9...C31`, passed typecheck, passed
  the exported X4 UI linter 78/78, and passed the corrected UI compiler wrapper 11/11. One first wrapper referenced a
  nonexistent `pass` field and exited nonzero despite printing 11/11; it is a harness invocation failure, not green or
  red product evidence.
- X4: executable `9.0.0.0`; unpacked corpus `9.00`.
- Installed Antigravity Directory Settings readback, no write:
  - Mod Workspace: `F:\DEV_ENV\projects\Mods\X4Mods`.
  - Filesystem: `G:\SteamLibrary\steamapps\common\X4 Foundations\extensions`.
  - X4 installation: `G:\SteamLibrary\steamapps\common\X4 Foundations`.
  - Unpacked corpus: `F:\Downskies\x4unpackersuiteV1\X4 unpacked 9.00` (`exists:true`).
- Pre-existing dirty paths, not owned by B119: modified `BACKLOG.md`, `CODEX-ONBOARDING.md`, `KNOWN-BUGS.md`,
  `docs/plans/2026-08-02-w3b1-addressed-state-receipts.md`, `test-results/.last-run.json`, two historical runtime-copy
  screenshots; deleted Discord/data files; untracked issue templates, Kimi note, W3B1b plan, and R8-R17 screenshots.
- Baseline `npm run typecheck`: PASS, exit 0, 34.1 s.
- Baseline `runUiCompilerSelftest()`: 11/11 PASS. This proves the existing emitter's lifecycle/static contract, not
  X4 layout fidelity or frame acceptance.
- No dedicated GitHub issue existed; #41 was created after duplicate reconciliation.

## RECONCILE

- B34 already made package and Standard preview share `generateUILuaScript()` and real X4 menu lifecycle calls. Do not
  replace that lifecycle owner.
- `UIWidget` remains a flat pixel box and `generateUILuaScript()` emits one fixed two-column table; its serialized
  x/y/w/h metadata is not the runtime layout. The current canvas is therefore not an X4 layout model.
- `uiLayout.ts` emits a data descriptor and defers its runtime loader; it is not a port of `helper.lua`.
- `uiWidgetValidate.ts` checks box geometry only. It cannot detect X4 table semantics.
- `analyzeLuaFiles()` is already consumed by UIBuilder, package readiness, agent-project packaging, server Extension
  Doctor, and related selftests. Graphify reports 16 direct connections and a broader two-hop diagnostic surface. It
  is the narrow integration owner for Lua-file rules.
- `runProjectValidation()` is the shared imported-folder/API/CLI validator but currently has no first-class Lua static
  layer. Imported UI Lua can therefore bypass the same findings unless this layer is added.
- The current UI says `layout valid` and calls a descriptor bridge `responsive grid`; both overstate proof.
- B36's exact-workspace readiness ladder already separates Package, Deployed, Seen, and Experience. Reuse it later;
  do not invent a second proof state.
- The existing reference-file endpoint can serve `.lua`, `.abc`, and `.dds` within its containment guard. No new
  reference asset endpoint is needed for later renderer work.
- Directory Settings already persists the user-selected unpacked root as `x4ReferenceRoot` through
  `/api/schema/config`; `resolveXsdConfig()` is the server-side authority. `referenceManifest.ts` recursively inventories
  the complete selected tree into the read-only generation-swapped manifest, and `/api/reference/file` resolves files
  through the same configured root with traversal and symlink containment checks. B119 must reuse this chain; it must
  not add a second corpus setting, scanner, or browser-supplied absolute-path contract.
- Reproduced current classification gap: both authoritative UI Lua files are indexed as advisory
  `executable-example` records with consumer `unconsumed`; `zekton_32.dds` is an `asset-index` asset, while
  `zekton_32.abc` is indexed but classified `unsupported`/`unconsumed`. Later census/renderer work must add a narrow UI
  layout/font consumer classification or resolver over the existing manifest rather than rebuilding discovery.
- `src/lib/x4UiCallModel.ts` is intentionally filesystem-independent and currently consumes only caller-supplied
  `{ rel, text, sourcePath }`; no B119 linter or renderer is wired to `x4ReferenceRoot` yet. The pure rule evaluator may
  stay corpus-independent, but configured-corpus census, source provenance, layout-port loading, and font metrics must
  enter through the existing server authority above.
- `ui.xml` can register multiple ordered Lua documents. Round-trip must eventually preserve that order; Batch 1 does
  not change workspace schema.
- Reproduced package contradiction: `ModWorkspace.customLua`, Project Inspector, and UIBuilder all promise
  `ui/<id>_custom.lua`, and readiness treats non-empty custom Lua as authored output, but
  `server.ts::buildWorkspaceFileManifest()` omits those bytes entirely. `generateUIIndexXML()` also registers only
  `ui/<id>.lua`. A custom-only workspace can therefore pass the authored-output check yet package only manifest/README
  bytes. Batch 1C adds the narrow existing-contract repair because otherwise lint/readiness would not govern what
  deploys; imported multi-file order and workspace-schema migration remain deferred.
- Reproduced configured-corpus authority split: a standalone repo process without the extension launch environment
  resolves `./data/x4-unpacked`, while the running Antigravity sidecar owns the user's persisted Directory Settings.
  Its public read-only status currently reports `F:\Downskies\x4unpackersuiteV1\X4 unpacked 9.00` and a ready
  1,028,384-file manifest generation. The census must consume that running Forge authority and page its existing
  public manifest; it may not silently use the repo fallback, schedule a scan, or open the global-storage SQLite
  cache through a path that can perform schema/WAL writes.
- Extend-versus-replace decision: extend `analyzeLuaFiles`, `runProjectValidation`, package readiness, and B36. Replace
  only the UI editor's false proof copy in this batch. The later renderer must replace the fake canvas semantics, not
  preserve them as architecture.
- Capability-map delta planned: deterministic X4 UI table-semantics lint will become a shared validation layer;
  layout rendering/import remain absent.
- Plan changes from the original brief: linter ships first; `.abc`/`.dds` metric proof replaces the unsupported TTF
  premise; percentage and dynamic rules use narrower evidence-based policy; no renderer work is bundled into Batch 1.
- Supervision correction: replacement project instructions establish that blank/timed-out V1 waits and absent target
  files are not liveness evidence. Readback of the post-restart child session proves it was a native
  `luna_executor` (`thread_source=subagent`) on `gpt-5.6-luna`/`max` and had emitted commentary while reading the graph
  and parser contracts. The prior execution-channel and reinstall conclusions are withdrawn.

## IMPLEMENT

- Added `src/lib/x4UiCallModel.ts`, a public typed, source-located static model over the existing Lua parser. It emits
  source-ordered call, property, handler, and alias records plus explicit `static`, `dynamic`, or `unknown` values and
  categorized verification gaps. Gap detail is bounded at 128 entries and exposes `verificationGapsTruncated`; it
  cannot silently become a clean result.
- Modeled the Batch 1 vocabulary needed by the linter: frame creation; table creation, widths, rows, and cell spans;
  rendered text and edit-box values; display/open-menu calls; menu/layer data flow; helper scaling expressions;
  aliases, indexed cells, fluent receivers, handlers, and common literal table properties.
- Grounded method semantics in the shipped X4 9.00 signatures, including `table:setColWidth(col, width, scaling)`,
  `table:setColWidthPercent(col, width)`, `table:addRow(rowdata, properties, groupindex)`, cell text/edit-box calls,
  and positional options. No invented `setEditBox` API remains.
- Static evaluation is conservative across branches, loops, do-blocks, identifier reassignment, relevant member/index
  mutation, local shadowing, nested functions, and deferred function bodies. Function analysis snapshots/restores
  reachable tracked object state while preserving calls recorded inside the function; control-flow invalidation is
  depth-aware so a nested function does not mutate its enclosing branch's analysis state.
- Added `src/lib/x4UiLint.ts`, a filesystem-independent evaluator over the call model, plus
  `src/lib/x4UiLint.selftest.ts`. It implements every brief rule with stable codes, severity, cause, real shipped
  failure mode, calibrated evidence boundary, source location, next action, and separate error/warning/gap/truncation
  truth fields. Clean output says only `No known rule violated`; incomplete evidence says `Not statically verified`.
- Fresh-eyes fixtures found that distinct functions and mutually exclusive/dead branches were initially combined by
  source order. Batch 1B.1 therefore extended the call model with immutable, source-located `branchPath` and
  `reachable | conditional | unreachable` metadata. The linter now filters dead records before indexing and combines
  calls only when exact function/handler identity and branch paths are compatible. Dynamic branches remain eligible
  for findings when a defect is fully proven within one compatible path.
- All implementation and repair edits were made by fresh native V1 `luna_executor` workers on
  `gpt-5.6-luna`/`max`, `fork_context=false`. Batch 1A initial implementation child:
  `019fed16-ebf7-7642-bac3-8eef3a79bda4`. Review-driven repair children:
  `019fed31-babe-7eb3-84fd-84c7336f8e7e`, `019fed39-b545-7ec0-93bf-785eeee75d28`,
  `019fed3e-682a-7172-b406-296c263d1a08`, `019fed4a-b422-7823-afde-f90940ab4b2a`,
  `019fed56-80d7-7b03-887e-5576f630e52b`, and `019fed66-46ea-7083-ac62-8ef3e8d2a10d`. Batch 1B linter children:
  `019fed8b-0668-70c1-8d6b-424bad42f43e` and `019feda5-2a35-7753-a9ed-edc9e51f82fa`. Batch 1B.1 metadata and
  consumer children: `019fedb8-f6a7-7800-bd3f-a84db3cd5773` and `019fedc9-6211-7db0-9581-9aaafa20bb26`.
- Sol coordinated, inspected, and validated but wrote no implementation or test code. No generic worker, CLI executor,
  Terra, or resumed closed worker was used for candidate edits. No Git mutation was performed.

## VALIDATE

- PASS baseline `npm run typecheck`, exit 0, 34.1 s, and baseline `runUiCompilerSelftest()`, 11/11.
- PASS current `npm run typecheck`, exit 0.
- PASS current `npx eslint src/lib/x4UiCallModel.ts`, exit 0.
- PASS untracked-source whitespace check: `git diff --no-index --check -- /dev/null
  src/lib/x4UiCallModel.ts` returned the expected no-index difference status with zero whitespace diagnostics; the
  assertion wrapper returned exit 0.
- PASS independent focused runtime assertions for:
  - deferred function mutation isolation and top-level restoration;
  - same-function sequential mutation and conditional unknown/gap behavior;
  - nested function-depth isolation and nested control-flow invalidation;
  - handler identity, call order, and source ordering;
  - aliases, relevant-property filtering, exact method signatures, dynamic index/options behavior, Unicode text,
    edit-box semantics, and branch/loop/do invalidation.
- PASS production parse/readback:
  - `aic_menu.lua`: parsed, 86 calls, 8 handlers, 59 properties, 64 aliases, 117 gaps, not truncated, 34.5 ms.
  - `aic_hub.lua`: parsed, 122 calls, 7 handlers, 39 properties, 64 aliases, 128 gaps, truncated, 11.9 ms.
  - `aic_comm.lua`: parsed, 79 calls, 5 handlers, 46 properties, 58 aliases, 128 gaps, truncated, 12.0 ms.
- PASS GitHub owner readback: issue #41 remains open and carries this Batch 1A checkpoint at
  https://github.com/KennyG1990/X4_Forge/issues/41#issuecomment-5245867742.
- PASS GitHub owner update/readback: issue #41 remains open and carries the bounded Batch 1B/1B.1 checkpoint at
  https://github.com/KennyG1990/X4_Forge/issues/41#issuecomment-5246914876.
- PASS Batch 1B focused exported linter selftest: 78/78, exit 0. It preserves the original 66 rule/failure-mode checks
  and adds dead-branch, mutually exclusive branch, nested branch, same-branch, and outside-plus-branch controls.
- PASS Batch 1B.1 metadata probes: worker 15/15 and coordinator 14/14. PASS coordinator linter matrices: 12/12
  negative/positive branch cases plus 3/3 width-order path controls.
- PASS final `npm run typecheck`, exit 0. PASS final targeted ESLint over `x4UiCallModel.ts`, `x4UiLint.ts`, and
  `x4UiLint.selftest.ts`, exit 0. PASS worker no-index whitespace wrappers and purity scan, exit 0; coordinator raw
  no-index checks produced the expected difference status with no diagnostics, and the purity search had no matches.
- PASS final production lint readback, all `parsed:true`, zero errors, and zero warnings:
  - `aic_menu.lua`: 86 calls, 117 model gaps, not truncated; 144 visible linter gaps.
  - `aic_hub.lua`: 122 calls, 128 model gaps, truncated; 163 visible linter gaps.
  - `aic_comm.lua`: 79 calls, 128 model gaps, truncated; 137 visible linter gaps.
- The two truncation flags are a truthful bounded-analysis state, not a parse failure or clean certification. All three
  production results say `Not statically verified`; no preview, engine-acceptance, or in-game claim was made.
- Analyzer/project/package/UI integration, configured corpus census, oracle sweep, build, graph refresh, precommit,
  isolated E2E, and rendered-Studio inspection remain pending for Batch 1C+. No machine-state ask was made because no
  E2E or rendered-host gate ran.

## REVIEW

- Re-read the supplied brief, reconciled plan, shipped helper signatures, candidate source, focused assertions, and
  production readback.
- Fresh-eyes review found and corrected, through fresh Luna workers, wrong receiver/signature assumptions; invented
  edit-box behavior; positional-property ambiguity; lost static text; scalar/menu/property control-flow false greens;
  alias and shadowing leaks; and deferred/nested function object-state leakage. Every reproduced defect was rerun after
  its repair, and the final combined regression groups pass.
- Batch 1B fresh-eyes review additionally reproduced cross-function source-order false errors; real row/cell
  same-layer handler misses; a weak one-argument `scaleFont` test; softened failure-mode wording; and three false
  findings from mutually exclusive/dead branches. Fresh workers repaired each defect, and coordinator fixtures
  independently reran the exact failures after the final changes.
- Current requirement classification:
  - ordered source model, explicit uncertainty, common literal/alias/index/function data flow: done and evidenced;
  - every linter policy row, exact known failure modes, control-flow compatibility, and deterministic result contract:
    done and evidenced at the pure-library boundary;
  - three production menus parse with zero fatal/warning findings: done; complete gap enumeration remains partial for
    the two intentionally truncated inputs;
  - shared analyzer/project/package/UI wiring and end-user blocking/diagnostic behavior: pending Batch 1C+;
  - corpus census and installed/rendered validation: pending later Batch 1 gates;
  - renderer/import/keep-out/font parity: deliberately out of scope for Batch 1.
- No blocking code-review finding remains in the bounded call-model/linter source. The 128-gap detail cap and absence
  of any product consumer are named remaining concerns.

## CURRENT CHECKPOINT

- Overall status: `IN_PROGRESS`. Batch 1A call modeling and the revised Batch 1B/1B.1 pure linter core are `VERIFIED`
  at their bounded source-library contracts. They are not connected to a Forge product gate yet, so the current
  shipped editor still receives none of these findings.
- Exact next unit: Batch 1C shared integration. Project the one linter result through `analyzeLuaFiles()` and
  `runProjectValidation()`, then reuse it in package/export/deploy readiness, IDE Problems, and `UIBuilder.tsx` truth
  states. Prove fatal, warning, clean, unverified, and truncation parity before corpus/E2E work.
- Capability-map delta: none. This remains internal foundation until a shared validator/product consumer lands.
- Overall remaining work: shared analyzer/project/package/deploy integration; UI truth states; configured vanilla/DLC
  census; oracle/build/graph/precommit; isolated E2E/rendered inspection; then later issue #41 renderer, import,
  Zekton metrics, keep-out overlays, round-trip editing, and in-game phases.
- No commit, stage, push, publish, real-mod/game/config write, E2E stack, or installed-product mutation occurred.
- Suggested eventual commit title: `feat(ui): block known X4 frame and layout traps before export`.

## AAR

- Triggers: reconciliation corrected the brief's helper path and TTF premise; linter priority changed program order;
  the parent initially misclassified blank waits/absent files and interrupted active workers; resuming a closed worker
  switched it to Sol/ultra and was stopped; review repeatedly found semantic defects and required fresh repairs; one
  parent spawn script failed on unescaped backticks; a worker hit Windows command-line length and newline-transport
  failures; one smoke fixture used the wrong pre-existing method signature; and an early production harness
  intentionally exited nonzero when two files hit the gap cap before the final readback separated parse success from
  truncation state. The first untracked-Markdown whitespace wrapper also counted Git's LF-to-CRLF warning as a
  diagnostic; a corrected wrapper filtered that exact non-error warning and proved both untracked files have zero
  whitespace diagnostics. Later corpus-path reconciliation proved the existing recursive manifest/file authority is
  reusable but its UI Lua records are `unconsumed` and Zekton `.abc` is `unsupported`; the plan now forbids parallel
  B119 discovery and records the narrow consumer-classification gap. A later source-shell check incorrectly treated
  the checkout fallback as the running Antigravity configuration; the user's live screenshot and read-only installed
  global-storage `config.json` readback corrected the authority boundary. Windows app enumeration found the unique
  running Antigravity Forge window, but two state-capture attempts failed with `node_repl exec context not found`;
  no UI input occurred and filesystem readback supplied the machine-readable proof. Batch 1B review then changed the
  acceptance contract after independent fixtures reproduced cross-function and branch-path false findings. Two worker
  validation wrappers also failed at PowerShell parsing before corrected commands passed; one coordinator purity probe
  had the same quoting class. These were tooling failures, not green evidence.
- Sustain: source-first signature grounding, production-menu fixtures, exact native role metadata, conservative
  uncertainty, and independent coordinator reproduction caught convincing false greens before integration.
- Improve work/approach: make each smoke fixture derive its call shape from the shipped signature table; use short
  argument-safe smoke groups on Windows; distinguish bounded detail truncation from parser failure while never
  allowing truncation to become a clean result.
- Improve tools: durable session activity is the liveness oracle for native workers; blank waits are not. Graphify
  symbol commands were more reliable than broad natural-language starts, but the graph is stale for untracked B119
  files and must not replace live-source inspection. `git diff --check` does not inspect an untracked source file, so
  use the asserted no-index check until the file is tracked. Keep PowerShell validation wrappers free of interpolation
  next to colons and quote-heavy regexes.
- Highest-risk evidenced weakness: the verified linter is currently inert product code. Until Batch 1C feeds the same
  findings into authoring, whole-project validation, package/export/deploy readiness, IDE Problems, and UI truth copy,
  Forge can still ship the exact defects this library detects. The 128-gap cap remains a secondary corpus-census risk;
  preserve automatic `Not statically verified` rather than hiding it.
- Global/project lessons banked: this plan, handoff, backlog checkpoint, and issue #41 carry the task-local lesson.
  No memory update was requested; no external AAR-ledger write is made at this non-closing checkpoint.

## BATCH 1C OUTAGE-RECOVERY CHECKPOINT — `BLOCKED` (2026-08-10)

### Recovered implementation state

- The power-loss recovery re-baselined the current host worktree without reverting unrelated edits. HEAD, local
  `origin/main`, and remote `main` remained `0d49c6922c77536d49f6860a235d018ecbfba43b` at recovery.
- `analyzeLuaFiles()` now owns the shared X4 UI call-model/linter projection, structured per-file results and summary,
  one explicit per-file verification-gap information diagnostic, and a distinct truncation diagnostic.
- `runProjectValidation()` exposes Lua/X4 UI summary counts, flattens real Lua path/line/code/full messages, and makes
  proven errors blocking while warnings and unverified information remain nonblocking.
- Package/readiness and agent-project packaging consume the same analyzer. Custom Lua is analyzed at its emitted
  `ui/<artifact-id>_custom.lua` path; code, severity, path, line, domain, and failure-mode text survive Mod Doctor.
- Artifact compilation emits exact nonblank custom-Lua bytes, registers generated Lua before custom Lua in root
  `ui.xml`, supports custom-only output, and emits no UI artifacts when UI output is disabled or custom Lua is blank.
- `UIBuilder.tsx` analyzes generated and custom Lua separately, exposes stable status test IDs, removes `layout valid`
  and `responsive grid` proof claims, and always displays `Not verified in game`.
- The corpus checker discovers the running installed sidecar through the existing latest-instance record, requires a
  ready public reference manifest, pages official `.lua` records, applies source/domain filters, containment-checks
  every path, and reads files directly without refresh, scan, DB, config, corpus, game, or mod writes.

### Validation evidence at this checkpoint

- Shared Lua-analysis selftest: 27/27 PASS (18 pre-existing plus 9 B119 checks).
- Project-validation B119 selftest: 4/4 PASS (clean, fatal, dynamic-unverified, warning-nonblocking).
- UI compiler selftest: 18/18 PASS. Package-readiness parity: 5/5 PASS. Mod Doctor: 4/4 PASS. Project orchestration:
  14/14 PASS. Each owning worker also reported typecheck green and targeted ESLint with zero errors.
- Read-only production-menu run over `aic_menu.lua`, `aic_sheet.lua`, and `aic_comm.lua`: zero errors and zero warnings;
  every file remains unverified, and `aic_comm.lua` reports bounded evidence truncation.
- Running installed-sidecar corpus authority: configured root
  `F:\Downskies\x4unpackersuiteV1\X4 unpacked 9.00`; manifest generation
  `1785035333079-2178b4c31f`; 157 total Lua records; 81 official base/`ego_dlc_*` UI/subst-Lua records selected and
  81 read with zero read failures.
- First corpus verdict: 62 fatal errors, all exactly `lua.syntax_error` at line 1. Byte readback reproduced `EF BB BF`
  on representative shipped files, and every sampled parser message was `unexpected symbol U+FEFF`. This is one
  analyzer-normalization defect, not evidence of 62 shipped X4 layout defects. The census remains red until repaired
  and rerun; no finding is suppressed.

### Fresh-eyes findings and required continuation

1. Normalize only one leading decoded U+FEFF at the shared Lua-analysis boundary, use the same normalized text for
   baseline parsing, source-pattern rules, and X4 UI modeling, preserve line offsets, and regression-test valid,
   genuinely invalid, and source-located X4 UI inputs. Then rerun the complete 81-file census to reveal real rules.
2. Add the real analyzer -> project validation -> flat currency -> existing `diagnosticsMap.ts` Problems mapping
   integration selftest. Register it through `SELFTESTS`; do not add a provider or duplicate analyzer.
3. Reconcile preview artifact identity. `UIBuilder.tsx` currently derives `safeUiId` from display name, while export's
   `effectiveModId()` correctly prioritizes imported `sourceFolder`, then valid `contentId`, then display name. Share
   that resolution rule so imported generated/custom preview paths and generated menu IDs match export exactly.
4. After those corrections, run the declared focused suites, final typecheck/lint, official corpus census, oracle
   sweep, build, graph refresh, and fresh-eyes diff review. The registered artifact selftest, precommit, E2E, and
   rendered Antigravity inspection remain behind the machine-state ask.

### Blocker and honest close state

- Native Luna work orders `019fee53-1916-7530-a823-6418d5f09898` (BOM normalization) and
  `019fee54-cb49-75a0-b1e1-2f15328da4f8` (Problems integration) were both rejected before execution with the exact
  runtime error `Selected model is at capacity. Please try a different model.` Project routing forbids Sol, Terra,
  generic-worker, or CLI-executor substitution, so no candidate/test code was improvised.
- Current continuation status: `BLOCKED`. Overall B119 remains `IN_PROGRESS`; Batch 1C is materially implemented but
  not verified or shippable. No Git mutation, publish, installed-extension mutation, real-mod/game/config write,
  E2E stack, or in-game claim occurred.
- AAR trigger: power interruption required recovery; the official corpus exposed BOM parser incompatibility; review
  exposed imported-preview artifact-ID drift; the native implementation runtime then rejected both required workers
  at capacity. Highest-risk evidenced weakness remains false authority: until the red corpus and exact consumer path
  are corrected and installed/rendered gates pass, the editor must not present this work as proof of engine acceptance.

## POST-BOM CORPUS RECONCILIATION AMENDMENT (2026-08-10)

This amendment supersedes the earlier checkpoint's statement that BOM normalization remains unimplemented and
supersedes Batch 1's universal-error policy for 13..23 columns, all sub-two-pixel tables, and all direct click-handler
rebuilds. The source-backed corpus is stronger evidence than the original extrapolation.

### What landed and passed

- Worker `019fee53-1916-7530-a823-6418d5f09898` wrote the bounded analyzer change before its native task ended with a
  capacity error. `analyzeLuaFiles()` now strips only one leading decoded U+FEFF by cloning the input, and every layer
  consumes the same normalized text. No line is removed, so source line correspondence remains stable.
- Coordinator readback and focused validation pass: 30/30 Lua static-analysis checks, including valid BOM, invalid BOM,
  and BOM/non-BOM X4 UI source-location parity. Targeted ESLint reports zero errors and eight pre-existing-style
  `no-explicit-any` warnings. Final repository typecheck remains pending the machine-safe validation phase.
- The 81-file official census now has zero parser/BOM errors: 81 selected, 81 read, zero read failures, 14 fatal
  findings, zero warnings, 70 unverified files, and 22 bounded-detail truncations.

### Exact remaining fatal classification

- Six `lua.restricted_online_call` findings occur in trusted base-game files (`menu_map.lua`, `menu_playerinfo.lua`,
  `menu_station_configuration.lua`, `customgame.lua`, `gameoptions.lua`, and `menu_interactmenu.lua`). The existing
  message itself scopes the risk to non-verified sources. These are not X4 UI layout-linter defects and must be reported
  separately or marked not applicable for the official-source census; they must not be globally disabled for mods.
- Three `x4-ui.add-table-column-limit` findings are real vanilla calls: `menu_map.lua:13514`,
  `menu_scenario_selection.lua:290`, and `menu_ship_comparison.lua:303` all construct 13-column tables. This disproves
  `N > 12` as a universal engine-refusal law. The production observation remains: 12 drew and 24 failed; 13..23 were
  not bisected. Revised policy: 24 or above remains the proven fatal boundary for this batch; 13..23 is a warning with
  explicit context dependence and in-game verification required, not a blocking error.
- Two `x4-ui.table-width-minimum` findings are vanilla empty sentinel tables at `menu_map.lua:19935` and `:19983`:
  `addTable(1, { width = 1, scaling = false, reserveScrollBar = false })`, immediately followed by `return` and no row.
  This disproves every literal width below two as universally fatal. Revised policy: a populated sub-two-pixel table
  may retain the measured fatal rule when rows/content are statically proven; an empty sentinel is clean, and unresolved
  population is nonfatal/unverified.
- Three `x4-ui.inline-display` findings are vanilla assigned onClick handlers at `menu_missionbriefing.lua:178`,
  `menu_missionbriefing.lua:207`, and `menu_transporter.lua:122`. This disproves direct onClick -> `display()` as a
  universal fatal condition. Revised policy: retain the real one-click-late failure mode as a warning unless the
  failure-producing context can be statically proven; do not block solely on the call pattern.

### Revised remaining work order

1. Through native Luna, revise the three linter policies and fixtures exactly as above; preserve the original failure
   modes and make the new evidence boundary explicit. Add official counterexample fixtures and keep `addTable(24)`
   blocking.
2. Through the corpus owner, separate official-source-not-applicable baseline findings from X4 UI fatal counts without
   hiding them. Exit red on any remaining unexplained/applicable fatal or read failure.
3. Complete the existing Problems-mapper integration selftest and shared imported-artifact-ID resolution.
4. Rerun all focused suites and the live 81-file census. The acceptance gate is zero unexplained/applicable official
   fatal findings; warnings and unverified/truncated counts remain visible and non-clean.

### Status delta

- Current status remains `BLOCKED`, not because the BOM correction is absent, but because the required rule/corpus,
  Problems, and artifact-ID implementation work still requires native `gpt-5.6-luna`, which the runtime rejected at
  capacity. No fallback executor is authorized.

## BATCH 1D ACCEPTANCE CONTRACT — SOURCE-CORRECT ROW HEIGHT RULE (2026-08-10)

Status: `SPECIFIED`; post-kernel reconciliation corrected the brief's shorthand “a row with a large explicit height.”
In shipped `helper.lua`, `table:addRow()` has no operative row `height` property. `row:getHeight()` is the maximum of
each visible cell's scaled `y + getHeight()`, and `table:getFullHeight()` sums those row heights plus row padding,
inter-row borders, and row-group offsets. The real production pattern uses
`addRow(...)[1]:createText(..., {height = h})`; the current focused linter fixtures incorrectly put `height` on the
`addRow` options table. The real failure mode remains required, but its detector must follow the source algorithm.

- Preserve the stable `x4-ui.row-height-budget` public diagnostic/failure-mode wording where compatible, but derive
  row-height evidence from source-linked `createText/createButton/createEditBox/createIcon` cell geometry, not an
  ignored `addRow` property. A literal `addRow` `height` option receives a separate nonblocking ignored-property
  diagnostic or explicit verification gap; it must never count as rendered height.
- Associate cells to rows/tables through call-model reference identity, not variable spelling. Within one row, use the
  maximum statically known cell `y + height`, never the sum of columns. Sum independent row maxima, padding, and
  source-proven border contributions only when their execution paths are compatible. Loop/repeated rows are
  incomplete unless exact multiplicity is separately proven; never count one loop body once.
- Apply only shipped v1 defaults that are exact for the pinned Helper source: button outer height
  `Helper.standardButtonHeight`; icon/edit-box/base-cell outer height zero; text height requires its explicit height or
  remains metrics-dependent. `setText` changes complex text content/properties but does not replace the outer cell
  height. For icon/button cells with proven `affectRowHeight = false`, use the shipped non-raw row contribution of
  exactly `1` and ignore the cell y offset. Dynamic height, y, scaling, ownership, branch, or repetition becomes a
  gap, not zero.
- Apply `Helper.round` independently to unscaled cell y and height before adding them. When scaling is enabled or
  inherited and no concrete `Helper.uiScale` profile is supplied, emit a verification gap and no row-height warning:
  raw source units are not a sound lower bound because the shipped source does not establish `uiScale >= 1`.
- Compare a source-derived table full height against the actual visible-height boundary only when its scale-dependent
  inputs are exact:
  `maxVisibleHeight` when a positive compatible literal clamps it, otherwise the frame's available-height/table-y
  budget when those inputs are statically compatible. Do not use inherited table `height` as a fake table-row budget.
  `autoFrameHeight = true` remains incomplete without the required `Helper.viewHeight` and frame-y profile; omitted or
  false uses the shipped default-false path. Unknown UI scale cannot be relabeled as a source-unit heuristic.
- Focused fixtures prove one large cell trips the real warning, two cells in one row use max, two rows sum, explicit
  row padding participates, ignored `addRow.height` cannot trigger the budget, dynamic/conditional/repeated geometry
  remains incomplete, and an independent table is not contaminated. Preserve every other linter rule and run the
  call-model, linter, source-bundle, repository typecheck, and targeted ESLint regressions.

## BATCH 2A ACCEPTANCE CONTRACT — ORDERED SOURCE BUNDLE (2026-08-10)

Status: `SPECIFIED`. This starts only after the linter-first product path has focused green evidence; it does not
claim the renderer, emitter UX, package integration, or X4 acceptance is complete.

### Reconciled owner and bounded unit

- Existing import already preserves `ui.xml` and `ui/**/*.lua` as exact passthrough strings with UI regeneration off.
  Existing package planning therefore owns no-edit byte fidelity and must remain the export owner.
- `x4UiCallModel.ts` already owns per-file ordered, source-located X4 UI calls and explicit dynamic/parse gaps. Batch 2A
  adds one filesystem-independent ordered bundle over caller-supplied `ui.xml` plus Lua texts; it does not add a
  scanner, workspace field, second parser product, or new package emitter.
- Parse the ordered `<environment type="menus"><file name="..."/>` registrations without rewriting `ui.xml`.
  Preserve raw registration spelling/order/duplicates as evidence while exposing a normalized contained lookup key.
- Each resolved registered Lua document retains its exact source string and its existing `X4UiCallModel`. Missing,
  unsafe, duplicate, malformed, or dynamically unprovable material remains explicit and locked/unverified.
- A no-edit projection returns byte-for-byte identical `ui.xml` and Lua strings. A bounded source splice is accepted
  only against an exact registered path/range/expected-text precondition and only when the resulting Lua parses;
  every other document and every byte outside the range remains identical. Failed preconditions return refusal and
  do not mutate the input bundle.

### Acceptance and negative paths

- Multi-file registration order is stable and deterministic; unrelated/unregistered Lua is not silently promoted
  into the menu registration order.
- CRLF, comments, indentation, quote style, BOM, dynamic statements, and unrelated functions survive no-edit output
  exactly. No AST pretty-printer or whole-file regeneration is permitted.
- A safe literal splice changes only the requested offsets, reparses through the existing call-model owner, and
  returns a new immutable bundle. Stale expected text, out-of-range offsets, unsafe/traversing paths, missing files,
  duplicate ambiguous registrations, locked parse failures, or a replacement that breaks Lua are refused.
- Dynamic values remain visible in the call model and are not automatically editable merely because a browser can
  display them. Later UI controls may edit only source ranges this owner marks safe.
- Focused selftests include two ordered Lua files, duplicate and missing registrations, path traversal, BOM/CRLF
  fidelity, safe-splice byte locality, stale-CAS refusal, syntax-breaking replacement refusal, deterministic repeat
  output, and explicit `Not statically verified`/locked truth.

## BATCH 3A ACCEPTANCE CONTRACT — SOURCE-ANCHORED LAYOUT KERNEL (2026-08-10)

Status: `SPECIFIED`, sequenced after Batch 2A. This is a pure geometry kernel, not the visual renderer.

### Authoritative X4 9.00 source snapshot

- `ui/addons/ego_detailmonitorhelper/helper.lua`, SHA-256
  `D24A08B8DA9F2C972794B60ACB48AE36F38CB026C991249DAB9F1164272D4DF2`.
- `ui/widget/lua/widget_fullscreen.lua`, SHA-256
  `420AFBA33D925A7B55F2A82AB12773DF04826EF588317010D209B249DE7BAED1`.
- Source anchors include helper constants/scale functions at 514-587 and 832-858; frame/table creation at 3767-3928;
  width freeze/finalization at 4713-4734 and 4779-4850; first-row freeze and cell creation at 4895-4958; colspan at
  5270-5359; and widget percentage/residual conversion at 5813-5915 plus table extents at 14365-14465.

### Bounded port

- Port the exact rounding, `scaleX`, `scaleY`, and `scaleFont` semantics into pure TypeScript with caller-supplied UI
  scale and widget-system metrics. Do not hardcode machine-specific border, scrollbar, view, or UI-scale values.
- Port Helper's column state and first-`addRow()` freeze: equal default min/weight columns, explicit pixel/percent/min
  widths, per-column scaling precedence, border subtraction, reserve-scrollbar accounting, weighted residual
  distribution, zero-column repair for defined-width tables, and contracted width when no variable columns exist.
- Port `widget_fullscreen.convertColumnWidth()` separately, including the 0.01-percent distribution, ceil/subtract
  anti-subpixel behavior, last-column residual, and explicit overflow refusal. Do not collapse the Helper and widget
  stages into an invented approximation.
- Port colspan width as the sum of constituent finalized columns plus intervening borders, with the source's bounded
  span behavior. Port row/table height aggregation only from explicit cell heights/min-text-height inputs, offsets,
  row padding, border-below, and row-group metrics; text measurement itself remains a later Zekton boundary.
- Every result carries source-snapshot provenance plus refusal/unsupported state. Unknown dynamic input never receives
  geometry or a false clean verdict.

### Required golden evidence

- Golden fixtures prove default equal-weight residual distribution, fixed+automatic and percent+automatic mixes,
  explicit contraction, scaling override, reserve-scrollbar success/refusal, freeze-after-first-row, zero-width
  repair, percent and pixel overflow refusal, anti-subpixel residual behavior, colspan+borders, and row-height sums.
- Independent fixtures derive expected numbers directly from the cited Lua operations, including odd widths where
  ceil/residual order matters. Repeated evaluation is byte-for-byte deterministic.
- Typecheck, targeted ESLint, and focused selftests pass. Renderer, Canvas/WebGL, Zekton `.abc` metrics, keep-outs,
  installed Antigravity, package/deploy, and in-game proof remain explicitly outside this pure-kernel unit.

## BATCH 3B ACCEPTANCE CONTRACT — SHIPPED ZEKTON BITMAP METRICS (2026-08-10)

Status: `SPECIFIED`; independent pure-data unit that may proceed beside the geometry kernel. Governing architecture:
`docs/plans/2026-08-10-b119-x4-ui-editor-source-first-design.md`.

### Reconciled corpus authority

- The brief's TTF/OTF premise is disproven for the configured X4 9.00 snapshot. Do not download or substitute a webfont.
- Regular descriptor: `assets/fx/gui/fonts/textures/zekton_32.abc`, SHA-256
  `2E7D49EE1A6C8033403EBFE8B3FAB036A511999D1F8F9A287A257E0D52DF7598`.
- Regular atlas: `assets/fx/gui/fonts/textures/zekton_32.dds`, SHA-256
  `19483C78A2BDE509A5D118C556AF465C03ADB6CA9126276673A9C924269CA2DA`.
- Bold descriptor: `assets/fx/gui/fonts/textures/zekton bold_32.abc`, SHA-256
  `57A3F41D29B4835C0FBB6C4C0F78F28F2F7E1531A3478C8C10F1E2B6E4A91394`.
- Bold atlas: `assets/fx/gui/fonts/textures/zekton bold_32.dds`, SHA-256
  `A2BFCB11A4006E39BED99AF956C26F1DCE7C4092FFA63FC66CDA844D12019738`.
- B119 later fetches these fixed corpus-relative paths through the existing public reference manifest/file owner. This
  pure unit consumes bytes only and adds no filesystem, route, setting, scanner, database, or browser code.

### Bounded decoder and truth state

- Add a pure `ArrayBuffer`/`Uint8Array` decoder for the observed descriptor structure: fixed header through offset 47;
  unsigned 16-bit Unicode-to-one-based-glyph lookup from offset 48 through `maxCodepoint`; four-byte-aligned glyph
  records; and a bounded trailing section. Derive glyph count from the highest lookup index and reject impossible
  lengths/indices rather than reading through malformed bytes.
- Expose header values and raw glyph records without pretending every field name is game-proven. The evidence-supported
  projection includes normalized UV bounds, signed horizontal bearing, bitmap width, advance, and page; its provenance
  remains `provisional-until-game-parity` until screenshot/runtime evidence validates interpretation and font-size scale.
- Decode only the observed uncompressed A8 DDS contract: `DDS ` magic, 124-byte header, 32-byte pixel format,
  1024x2048 dimensions for the cited assets, 8-bit alpha payload, no FourCC/compression, and descriptor/atlas dimension
  parity. Return exact alpha bytes; do not rasterize with a browser fallback font.
- Provide raw-glyph-run measurement at an explicit caller-supplied scale. There is no default `fontsize/32` or other
  guessed X4 scale in this unit. Missing mappings/control sequences return typed gaps; no width or wrap claim is made.
- Parsing never mutates caller bytes. Every success/result carries descriptor/atlas identity plus provisional evidence
  state; every failure is a typed refusal and no partial geometry escapes.

### Required evidence and negative paths

- Synthetic regular/bold-compatible fixtures prove one-based lookup, signed bearing, UV/pixel conversion, raw advances,
  missing glyphs, deterministic repeated decode, and caller-byte immutability.
- DDS fixtures prove exact A8 extraction and reject bad magic/header sizes, truncated headers/payloads, wrong dimensions,
  FourCC/compressed/RGB layouts, non-8-bit alpha, and descriptor-atlas mismatch.
- ABC fixtures reject truncated maps/records, impossible max codepoint/index, non-finite/out-of-range UVs, nonzero page
  unless explicitly supported, malformed trailing data, and inputs large enough to cause unsafe allocation.
- Focused selftest prints passed/total. Repository typecheck and targeted ESLint over only the two new pure files pass
  with errors reported separately from existing warnings. A later read-only corpus harness must prove the four cited
  hashes and file invariants through the configured reference owner before browser integration.
- Renderer, text wrapping/truncation policy, call-model expansion, Canvas, UIBuilder, package/deploy, asset redistribution,
  and game-parity claims remain out of scope. Successful decoding is not proof that X4 scales or presents glyphs the
  same way.

## BATCH 3C ACCEPTANCE CONTRACT — V1 SOURCE CALL PROJECTION (2026-08-10)

Status: `SPECIFIED`; independent of the pure geometry/font workers and sequenced before scene rendering. This
extends the existing ordered `x4UiCallModel.ts`; it does not introduce a second Lua parser, AST rewriter, workspace
schema, renderer, emitter, or deployed intermediate language.

### Reconciled source/API scope

- The exact v1 vocabulary remains the brief's production subset: `createFrameHandle`, `addTable`,
  `setColWidthPercent`, `setColWidth`, `addRow`, `setColSpan`, `createText`, `createButton` plus
  `setText`/`setText2`, `createEditBox`, `createIcon`, `display`, and the three Helper scale calls.
  Do not expand this batch into unrelated Helper widget types.
- Shipped Helper authority is the same hashed X4 9.00 source as Batch 3A. Its specialized
  `cell:createText/createButton/createEditBox/createIcon` functions all return the same cell, so fluent chains must
  preserve the receiver's tracked cell identity rather than inventing browser widget objects.
- Production fixtures are the three registered AI Influence menu sources
  `aic_menu.lua`, `aic_hub.lua`, and `aic_comm.lua`. They prove button/text fluent chains, edit boxes,
  literal/dynamic properties, multiple tables, rows, spans, and Helper constants/scale expressions. Tests checked
  into this repository must be self-contained and must not depend on Ken's absolute mod path.
- Existing ordered record/source-location, branch reachability, handler, alias, dynamic-gap, and BOM behavior remain
  the owner. The linter continues consuming the same model and must not lose or reinterpret any existing record.

### Bounded model extension

- Add ordered records for `createButton`, `createIcon`, `Helper.scaleX`, `Helper.scaleY`, and
  `Helper.scaleFont`. Scale-call records retain their exact arguments and source locations but do not invent a
  numeric result when the input or UI scale is not statically supplied.
- Expose the first `addRow` argument as `interactive`, icon names as `icon`, optional column scaling, and a
  source-located ordered property projection for the known table literal passed to each v1 call. Required properties
  include:
  - frame: `x/y/width/height/layer/standardButtons/backgroundID/backgroundColor/blurBackground`;
  - table: `x/y/width/tabOrder/backgroundID/backgroundColor/highlightMode/maxVisibleHeight/reserveScrollBar/scaling`;
  - row: `height/paddingTop/paddingBottom/borderBelow/fixed/scaling`;
  - text/button text: `color/fontsize/halign/wordwrap/font/cellBGColor/x/y/height/scaling`;
  - button: `active/bgColor/highlightColor/borderColor/width/height/x/y/scaling`;
  - edit box: `height/defaultText/maxChars/selectTextOnActivation/scaling`;
  - icon: `width/height/color/affectRowHeight/x/y/scaling`.
- Preserve each projected value's existing static/dynamic/unknown status, expression text, and source range. A known
  table's omitted property remains omitted. An unresolved property table stays explicit as a verification gap and
  must not receive default values here.
- Preserve source identity for `Helper.standardTextHeight`, `standardButtonHeight`, `borderSize`,
  `viewWidth`, and `viewHeight` expressions without claiming runtime numeric values in the call model. The later
  source-proven projection/kernel boundary resolves them.
- No layout numbers, text metrics, wrapping, clipping, keep-out geometry, source mutation, or preview truth verdict
  belongs in this batch.

### Required evidence and negative paths

- A standalone focused selftest proves ordered fluent calls, same-cell data flow through
  `setColSpan():createButton():setText()`, all v1 property families, edit-box/icon arguments, row interactivity,
  scale-call argument identity, Helper constant expression identity, dynamic/unknown preservation, and exact source
  locations suitable for later compare-and-swap edits.
- Negative fixtures prove unresolved option tables remain gaps, no invented properties/defaults appear, malformed Lua
  remains a parse gap, calls with the same method name on unrelated objects do not become falsely verified X4
  geometry, and repeated analysis is deterministic without mutating the source.
- Existing linter selftest, source-bundle selftest, repository typecheck, and targeted ESLint over the two owned files
  must pass. The three production sources receive a read-only census after implementation; parse/count evidence is
  recorded, but dynamic values are not treated as failures merely because they require runtime data.

## BATCH 3C.1 ACCEPTANCE CONTRACT — LOOP EXECUTION ANCESTRY (2026-08-10)

Status: `SPECIFIED`; reconciliation for Batch 4A reproduced that the current call model traverses loop bodies once but
does not identify the resulting records as repeated. Replaying those records once would create false row/table counts.
This correction records source execution ancestry only; it does not interpret or unroll Lua.

- Extend `X4UiFunctionContext` with an immutable ordered loop path. Each segment retains exact source location, loop
  kind (`while`, `repeat`, numeric `for`, or generic `for`), nesting order, and conservative multiplicity:
  `zero-or-more` for while/numeric/generic loops and `one-or-more` for repeat-until bodies. A plain `do` block is not a
  loop. Non-loop records expose an empty path.
- Preserve branch ancestry independently; a record may be both conditional and repeated. Nested functions declared
  inside a loop retain their lexical loop ancestry, but the later projector still does not infer invocation count.
- Do not statically unroll constant bounds, invent iterable size, build a call graph, or change existing binding/property
  invalidation. Loop records remain available to the linter and source editor with their exact original ordering.
- Focused tests cover all four loop kinds, nested loop ordering, loop-plus-branch, repeat's one-or-more distinction,
  plain-do/non-loop emptiness, deterministic frozen context values, and existing 25 call-projection checks. Linter and
  source-bundle regressions, repository typecheck, and targeted ESLint must remain green.

## BATCH 3D ACCEPTANCE CONTRACT — EVIDENCE-GRADED KEEP-OUT MODEL (2026-08-10)

Status: `SPECIFIED`; pure design-time data/geometry independent of source, kernel, font, renderer, workspace, and
deploy owners. Reconciliation found no existing keep-out, normalized screenshot-region, or calibration owner in the
live codebase; this adds one bounded owner rather than extending an unrelated canvas abstraction.

### Evidence boundary and built-ins

- Built-in measured evidence is limited to the brief and production source comments:
  - conversation-wheel Back-row horizontal guide at approximately normalized `y=0.788`;
  - pre-overlay multi-option stack start guide at approximately normalized `y=0.74`;
  - INFORMATION/NPC-video leftmost vertical guide at approximately normalized `x=0.664` at input-bar height.
- Those values are guides, not invented full rectangles. The INFORMATION panel's bottom-right parallelogram description
  is retained as a note until a screenshot calibration or shipped-source polygon supplies the missing vertices.
- Mission/MESSAGES ticker and top HUD bar remain required built-in entries with `reference-unmeasured` evidence and no
  drawable geometry. They must never receive guessed coordinates merely so a preset looks complete.
- Provide the four named context presets: `cockpit-conversation`, `map-open`, `fullscreen-menu`, and
  `first-person`. Each preset explicitly grades each member's applicability/evidence; an empty or unmeasured preset is
  valid and visible, not silently promoted to safe.

### Bounded pure owner

- Add immutable normalized types for horizontal/vertical guides, calibrated polygons, unavailable/unmeasured entries,
  context-preset membership, provenance notes, evidence grade, and optional screenshot identity.
- Project known normalized guides/polygons into a caller-supplied finite positive drawable viewport. Projection never
  modifies X4 layout geometry and never returns browser CSS coordinates.
- Add a pure manual-calibration constructor that converts caller-supplied screenshot pixel points to normalized
  coordinates using exact drawable bounds and stores the caller-supplied screenshot hash/profile identity. Require at
  least three finite in-bounds non-collinear points, a non-empty stable ID/hash, and an explicit source note.
- Built-ins are frozen and deterministic. User calibration returns a new immutable object and never mutates a preset.
- Keep-out findings are advisory only. The owner may report overlap with a calibrated polygon/guide, but exposes no
  package/deploy blocking verdict and never clears `Not verified in game`.

### Required evidence and negative paths

- Focused tests prove the three exact measured guide values, no invented built-in polygon, all four presets, explicit
  unmeasured ticker/top-HUD state, normalized-to-pixel projection across at least two viewports, and deterministic
  immutable results.
- Calibration tests prove exact normalization and reject zero/negative/non-finite viewport dimensions, empty identity,
  too few points, duplicate/collinear points, out-of-bounds coordinates, NaN/Infinity, and malformed screenshot hashes.
- A projection request for an unmeasured entry returns typed unavailable state, not zero geometry. Overlap remains
  advisory and source-independent.
- Standalone selftest, repository typecheck, and targeted ESLint over only the two pure owned files pass. Canvas
  drawing, screenshot capture/UI, persistence, automatic computer vision, package/deploy policy, and game confirmation
  remain out of scope.

## BATCH 3A.1 ACCEPTANCE CONTRACT — V1 EDIT-BOX CELL PARITY (2026-08-10)

Status: `SPECIFIED`; reconciliation after Batch 3C found one narrow kernel vocabulary omission that must be corrected
before the ordered layout-program projector. `createEditBox` is in the documented v1 source vocabulary and is used by
both production input panels, while `HelperCellType` currently cannot retain an edit-box cell identity.

- Extend only the existing pure layout-kernel owner and selftest so `editbox` is a supported cell type. Do not add a
  second cell model, renderer behavior, text/input behavior, hotkey behavior, or browser widget identity.
- Preserve shipped `helper.lua` behavior: `cell:createEditBox()` specializes the same cell; edit-box `getHeight()` is
  the base cell height unless the out-of-scope hotkey minimum applies. The pinned source default inherited from the
  base widget is height `0`; the two production panels explicitly supply `Helper.standardButtonHeight`.
- An explicit edit-box height follows the kernel's existing cell scaling path. A zero-height edit box remains zero;
  it must not borrow text minimum-height behavior or the button default. `affectRowHeight` special handling remains
  limited to icon/button, exactly as the shipped source.
- Positive tests cover explicit scaled/unscaled edit-box height and zero-height behavior. Existing invalid-cell,
  text, icon, button, colspan, row-height, and full-table-height goldens must remain green. Repository typecheck and
  targeted ESLint over the two existing kernel files must pass.

## BATCH 3A.2 ACCEPTANCE CONTRACT — SOURCE-ORDERED CELL SPECIALIZATION (2026-08-10)

Status: `SPECIFIED`; Batch 4A replay cannot prebuild a row's final cell types without changing shipped behavior.
`table:addRow()` first creates pluripotent `cell` values, then later source calls run `setColSpan` and
`createText/createButton/createEditBox/createIcon` in their actual order. In `helper.lua`, `initTableCell` refuses a
cell hidden by a prior colspan and refuses overwriting an already-specialized cell. Conversely, a colspan issued after
a neighboring widget already exists logs the existing `colspan-hid-non-cell` diagnostic. The kernel needs that exact
state transition; the projector must not simulate it by gathering future calls into the initial row input.

- Add one immutable state operation that specializes an existing one-based row/column `cell` to a supported v1 type
  (`text`, `button`, `editbox`, or `icon`) and applies caller-resolved outer geometry fields using the existing cell
  state representation. It returns the same-cell state identity relationship; it does not create a browser widget.
- Refuse with the exact prior state when row/column is invalid, the target has `colspan=0`, the target is already
  specialized, the type is unsupported, or supplied geometry is malformed/dynamic. Do not silently overwrite or
  resurrect a hidden cell.
- Omitted geometry preserves the current base-cell state. Source defaults that require constants—especially button
  height—are resolved by the later source/profile projector and passed explicitly; this operation does not invent a
  profile, font metric, or browser default. Existing scaling inheritance and icon/button `affectRowHeight` behavior
  remain unchanged.
- Golden tests distinguish span-before-specialize from specialize-before-span, prove same-cell type/geometry update,
  hidden/overwrite refusal with object-identical prior state, edit-box parity, invalid geometry/type/index refusal, and
  no regression across all existing kernel checks. Typecheck and targeted ESLint remain green.

## BATCH 4A ACCEPTANCE CONTRACT — ORDERED SOURCE LAYOUT PROGRAM (2026-08-10)

Status: `SPECIFIED`; sequenced after accepted Batches 3A/3A.1 and 3C. This is the pure bridge from the source-canonical
call model to the source-ported Helper kernel. It is not the Canvas scene, font renderer, source editor, workspace
loader, package/deploy gate, or game-verification owner.

### Input and truth boundary

- Accept one immutable `X4UiCallModel`, one exact lexical projection target, and an explicit immutable projection
  profile. The target is `top-level` or a function/handler context identified by its source range; a name alone is not
  sufficient because Lua files can contain duplicate/local function names. The profile carries drawable frame
  dimensions, the kernel's `uiScale/borderSize/scrollbarWidth/standardContainerOffset` inputs, profile identity,
  provenance, and a truth grade (`supplied`, `captured`, or `unverified-default`). The function never reads config,
  corpus files, browser state, the filesystem, or process globals.
- Provide a deterministic read-only target catalog from the model. Never flatten calls from separate menu-building
  functions or handlers into one synthetic frame. Only records whose context exactly matches the selected target are
  replayed. Cross-context calls/data flow remain explicit gaps unless a later source-backed call-graph owner proves
  execution; function declaration order is not execution order.
- Refuse malformed/non-finite profiles and source-hash incompatibility. A successful projection remains
  `Not verified in game`; profile completeness, static-source completeness, and game verification are separate fields.
- Resolve only literal values, the five Batch 3C Helper symbols through an explicit profile/source-constant table, and
  direct source-matched `Helper.scaleX/scaleY/scaleFont` calls whose complete arguments are static. Do not evaluate
  arbitrary Lua, nested dynamic arithmetic, user functions, unknown globals, or C++-side values. A missing runtime
  constant is a source-located unresolved input, never zero or a guessed browser default.
- The projector consumes call-model receiver/result identity and source order. It does not reparse Lua or infer owners
  by variable spelling. Unrelated receivers remain non-applied data-flow gaps.

### Ordered program and kernel replay

- Produce immutable serializable frame/table/row/cell program nodes, an ordered operation ledger, source locations,
  kernel state where deterministically available, source-linked gaps/refusals, and aggregate projection status.
  Program IDs are deterministic from source identity/order; they are not persisted workspace IDs.
- Preserve multiple frames/tables and aliases independently. `addTable` creates the kernel table with the exact column
  count and table/frame inputs; width setters replay in source order; the first reachable `addRow` freezes widths;
  post-row width setters retain the exact prior kernel state and become visible rejected operations.
- Gather each row's same-cell specialization calls without inventing a separate widget object. `setColSpan`,
  `createText`, `createButton`, `createEditBox`, `createIcon`, `setText`, and `setText2` stay linked to their source cell.
  The kernel receives only known geometry-affecting inputs. Text/sample content and non-geometric color/interaction
  properties remain source metadata for the later scene owner.
- Apply pinned Helper defaults only when the exact source contract establishes them: table/row/cell scaling,
  `reserveScrollBar`, row border/padding/fixed values, base-cell zero geometry, button standard height, and icon/button
  `affectRowHeight`. Omitted values and explicitly dynamic values remain distinct. No call-model property is silently
  replaced with a default when a dynamic option table may override it.
- Static unreachable operations are recorded but not applied. Conditional operations are recorded as conditional gaps
  and do not mutate the deterministic state. The projector may retain a stable reachable prefix, but it must never pick
  a branch or merge mutually exclusive mutations into one authoritative layout.
- A kernel refusal is operation-local when the kernel returns the prior state. The table may remain partially
  projectable, but the rejected operation and table status stay visible. Unknown required count/owner/frame width
  prevents that node's geometry without preventing independent tables from projecting.
- Zero-height text needs a caller-supplied/proven `minTextHeight`; this batch does not turn provisional Zekton records
  into exact wrapping. Missing text height leaves row/full-table height explicitly unavailable while known columns and
  cell spans may still be retained. No browser-font fallback is allowed.

### Required evidence and negative paths

- A standalone selftest covers target catalog/selection, two functions that must never be flattened together, direct
  and aliased frame/table/row/cell chains, multiple independent tables, exact
  equal-weight and percent/pixel column results, fluent colspan/button/text identity, button default height,
  edit-box explicit height, icon `affectRowHeight=false`, and source-located operation order.
- Negative fixtures cover malformed profile, source-hash mismatch, dynamic count/width/height/span/options, unrelated
  receiver, unknown Helper constant, direct scale call with dynamic arguments, conditional and unreachable branches,
  post-first-row width change, colspan overrun, missing text minimum height, and one failed table beside one valid table.
- Assert no input mutation, deep deterministic replay, frozen results, no Node/DOM/React/network imports, and no source
  mutation. The call-model, layout-kernel, linter, and source-bundle focused suites plus repository typecheck and
  targeted ESLint must remain green.
- Production census is read-only. It records projected/partial/refused table counts and source-linked gap categories for
  `aic_menu.lua`, `aic_hub.lua`, and `aic_comm.lua`; bounded call-model truncation must propagate as analysis incomplete,
  not a green projection.

## BATCH 4B ACCEPTANCE CONTRACT — CONFIGURED-CORPUS UI SOURCE ASSETS (2026-08-10)

Status: `SPECIFIED`; independent of Batch 4A and sequenced before browser scene integration. This is the one browser
transport/evidence owner for the shipped Helper, widget presentation, and Zekton assets. It reuses the configured X4
unpacked-corpus authority; it does not add a scanner, setting, server route, database, fallback directory, renderer, or
layout policy.

### Reconciled source and transport boundary

- The 9.00 corpus contains no Zekton TTF, OTF, or WOFF. The shipped assets are the existing exact `.abc` descriptor and
  uncompressed A8 `.dds` atlas pairs. The brief's instruction to use the real shipped font governs; its TTF packaging
  example does not override the observed corpus format.
- Reuse only the existing same-origin read-only endpoints: `/api/reference/status`, `/api/reference/manifest`, and
  `/api/reference/file`. `DirectorySettings` and `resolveXsdConfig()` remain the sole configured-root owners. Browser
  code never accepts or reconstructs an absolute corpus path and never walks a directory.
- The exact supported 9.00 asset set is pinned by normalized corpus-relative path and SHA-256: Helper
  `ui/addons/ego_detailmonitorhelper/helper.lua`, widget presentation
  `ui/widget/lua/widget_fullscreen.lua`, and regular/bold Zekton descriptors/atlases already owned by
  `x4UiFontMetrics.ts`. A ready bundle requires every exact path to be present in one manifest generation and every
  returned byte stream to match its pinned digest.
- The loader accepts an explicit bounded fetch transport for testability, uses same-origin `/api/reference/*` URLs,
  bounds response sizes before hashing/decoding, and treats non-2xx, malformed JSON, unavailable/indexing/error manifest
  state, duplicate/ambiguous manifest records, missing assets, content-type drift, byte limits, digest mismatch, UTF-8
  decode failure, abort, and font decode refusal as typed evidence failures. It never falls back to a hard-coded local
  path or stale embedded bytes.
- Hash the exact response bytes with browser-compatible SHA-256 before UTF-8 decoding. Preserve copied immutable source
  text/bytes, manifest generation, configured-root status identity, per-asset path/hash/size, and decode provenance.
  Decode the font pairs only through the accepted `x4UiFontMetrics` owner; do not duplicate descriptor/DDS parsing.
- A canonical success is still `Not verified in game`; it proves that the browser consumed the expected corpus bytes,
  not C++ frame acceptance, presentation parity, runtime widget-system sizes, or font-size parity. The returned font
  evidence remains `provisional-until-game-parity` until the later screenshot/runtime gate.

### Required evidence and negative paths

- A standalone deterministic selftest uses an injected fake endpoint transport and synthetic pinned contract to prove
  status/manifest/file sequencing, URL encoding (including the bold-font space), exact byte hashing, UTF-8 source
  preservation, regular/bold decode, immutable copies, manifest-generation binding, and no input mutation. The public
  canonical wrapper remains pinned to the 9.00 identities and cannot be relabeled canonical by a caller override.
- Negative fixtures cover offline status, 202/indexing, malformed status/manifest, generation drift during loading,
  duplicate and missing exact paths, traversal-shaped manifest data, non-2xx file response, oversized source/binary,
  digest mismatch, invalid UTF-8, malformed ABC/DDS, unsupported browser hash provider, and caller abort. Independent
  failures have stable codes and never return a partially trusted canonical bundle.
- The production module has no Node, filesystem, process, React, DOM-rendering, network library, config, persistence, or
  new dependency import. It may use the supplied fetch-compatible transport, `TextDecoder`, and Web Crypto only through
  explicit capability checks. Outputs are deterministic, serializable except for copied typed font bytes, and deeply
  frozen where JavaScript permits; caller buffers/responses are never retained by alias.
- Focused asset-loader, font-metrics, layout-program, kernel, call-model, linter, source-bundle, typecheck, and targeted
  ESLint gates remain required. A live configured-endpoint read is a separate integration gate and stays unavailable
  while the local Forge server is down after the power interruption.

## BATCH 2B ACCEPTANCE CONTRACT — WORKSPACE UI SOURCE AUTHORITY ADAPTER (2026-08-10)

Status: `SPECIFIED`; independent pure adapter over the accepted source bundle and existing workspace round-trip store.
Reconciliation found that imported `ui.xml` and `ui/**/*.lua` are already preserved byte-for-byte in
`ModWorkspace.passthroughFiles` as the partial UI domain and are already emitted by the package manifest when no
modeled output claims the same path. Adding a second persistent UI-source field would create two authorities and is
therefore prohibited for this unit.

### Existing ownership and collision law

- Discover a source-owned menu only from an exact extension-root `ui.xml` passthrough record plus caller-supplied
  passthrough Lua records. Preserve path spelling, array order, raw content, reason, and all unrelated workspace state.
  Build the canonical ordered model through `buildX4UiSourceBundle()`; do not parse XML/Lua again.
- The existing package law is authoritative: active modeled `uiWidgets` and/or nonblank `customLua` generate a new
  root `ui.xml`, and generated output wins a passthrough path collision. Such a workspace is `generated-shadowing-source`,
  not source-owned. The adapter must not preview or edit the shadowed passthrough menu as though it will ship.
- Duplicate case-insensitive root `ui.xml` records, omitted/tracked-only source records, missing registered Lua,
  ambiguous registrations, unsafe paths, disabled/locked source, or generated collisions remain explicit unavailable
  or locked states. Do not choose a winner, read `sourceFolder`, or fall back to disk.
- A source edit is two-stage CAS: first the accepted `spliceX4UiSourceBundle()` transition, then an adapter commit that
  verifies every affected passthrough path and exact expected source text still matches the workspace. On success,
  replace only those existing passthrough records immutably at the same indexes and preserve every byte/path/field not
  changed by the source projection. On stale/ambiguous/missing/omitted/shadowed input, return the exact original
  workspace object.
- This adapter does not install a new standalone Lua file, synthesize `ui.xml`, convert legacy pixels, change
  `compileSettings`, clear widgets/custom Lua, mutate the filesystem, or claim game verification. Those user choices
  belong to the later UI integration gate.

### Required evidence and negative paths

- Standalone tests cover a real-shaped imported `ui.xml` plus multiple registered Lua passthrough records, registration
  order, unregistered Lua retention, no-edit byte identity, one accepted source splice reflected in exactly one
  passthrough record, compile-relevant projection identity, workspace/source immutability, and deterministic frozen
  adapter results.
- Negative fixtures cover no source, duplicate root manifest with case collision, unsafe/absolute/traversal/NUL paths,
  omitted root/Lua, missing and duplicate registered Lua, malformed XML/Lua, active widgets, active custom Lua,
  generated path collision, UI compile setting variants, stale second-stage expected text, and an unrelated passthrough
  record changed concurrently. Every refusal returns exact prior workspace identity and a stable reason.
- The production adapter imports only workspace types and `x4UiSourceBundle`; no compiler, server, filesystem, process,
  parser, DOM, React, network, config, or new dependency. Focused source-bundle and adapter tests, typecheck, targeted
  ESLint, and a later exact package-manifest round-trip integration remain required.

## POST-OUTAGE FOCUSED IMPLEMENTATION CHECKPOINT (2026-08-10)

This checkpoint supersedes the earlier `BLOCKED` continuation text caused by native-model capacity. Overall B119
remains `IN_PROGRESS / PARTIAL`: the bounded implementation below exists and has focused evidence, while broad,
installed-host, renderer, deploy, and in-game acceptance gates remain open.

### Batch 1 linter-first path now focused-green

- Corpus-calibrated linter: 83/83. `addTable(24+)` is the measured fatal rule; 13-23 warns with official 13-column
  counterevidence and requires in-game verification. Sub-two-pixel width blocks only when compatible reachable row
  population is statically proven; empty width-1 sentinels are clean. Direct onClick display remains a real failure-mode
  warning rather than a universal fatal.
- Corpus harness: 12/12. Live configured-corpus result: 81 selected, 81 read, zero read failures, zero
  unexplained/applicable fatal findings, six trusted-official online-call findings classified visibly not applicable,
  six warnings, 70 unverified files, 22 bounded-detail truncations, and 13,123 bounded gaps.
- Real consumer chain: analyzer -> `runProjectValidation()` -> flat diagnostic currency -> existing
  `diagnosticsMap.ts` passes 7/7; mapper contract passes 11/11. No parallel provider or result store was introduced.
- Shared imported artifact identity: `resolveWorkspaceArtifactId()` preserves the existing source-folder, valid
  content-ID, then safe-name precedence across UIBuilder, readiness, export, and deploy. Worker evidence is 9/9 parity,
  5/5 resolver probes, typecheck green, and zero ESLint errors; coordinator rerun passes 9/9 plus Windows/POSIX/
  content-ID/name probes.

### Batch 2A ordered source bundle accepted

- New pure owners: `src/lib/x4UiSourceBundle.ts` and `src/lib/x4UiSourceBundle.selftest.ts`.
- The bundle retains raw `ui.xml`, every supplied Lua source string, registration order, duplicate/missing/unsafe
  evidence, parse lock state, dynamic call-model gaps, and unregistered files without a filesystem or workspace schema.
- No-edit projection preserves BOM, CRLF, comments, formatting, and file order exactly as caller-owned strings.
- Editing is one immutable compare-and-swap splice against a uniquely resolved registered source. Stale text,
  out-of-range offsets, ambiguous registration/source, unsafe/missing/locked targets, and syntax-breaking replacement
  refuse and return the original bundle object.
- Fresh-eyes review reproduced that direct `luaparse` rejects shipped valid U+FEFF-prefixed Lua. The accepted correction
  substitutes one ASCII space only in the parser clone, preserving every raw offset and byte-length boundary. A golden
  test proves a post-BOM call offset and accepted splice while raw projection remains exact. A genuinely invalid Lua
  file remains locked.
- Worker selftest, repository typecheck, and lint pass with zero errors; coordinator selftest rerun passes. This is a
  source-preservation seam only. Import/workspace/package/UI integration is still a later bounded unit.

### Active continuation and honest boundary

- The power outage left native Luna `019fee82-1a34-7a81-a903-1987094d3e33` marked running but with no event after its
  initial acknowledgement and no owned-file write. Two empty terminal waits plus a queued checkpoint with no event
  confirmed that child runtime was inert; it was closed without touching repository files.
- Replacement native Luna `019fee8a-60ce-72f1-8fbf-dae0c9c67ddc` owns only the new pure layout kernel and golden tests against
  helper SHA-256 `D24A08B8DA9F2C972794B60ACB48AE36F38CB026C991249DAB9F1164272D4DF2` and widget SHA-256
  `420AFBA33D925A7B55F2A82AB12773DF04826EF588317010D209B249DE7BAED1`.
- Required but not yet run/accepted: broad oracle/precommit/E2E/build and installed Antigravity Problems/rendered UI.
  The exact machine-state question was asked and remains unanswered, so state-touching validation is held.
- Renderer, Zekton measurement, keep-out overlays, workspace/import source integration, source-preserving emitter UI,
  exact deploy hash, and X4 runtime confirmation remain required. `Not verified in game` stays authoritative.
- No Git mutation, publication, installed-extension mutation, real-mod/game/config write, E2E stack, or in-game claim
  occurred at this checkpoint.

### AAR delta

- Triggers: outage recovery; corpus counterexamples changed severity policy; initial artifact-parity fixture still used
  13 as fatal and was corrected to 24; direct Drive field-mask read failed once before the tab-aware retry; fresh-eyes
  source review forced the BOM parser-sentinel correction.
- Sustain: exact corpus authority, one diagnostic currency, disjoint native-Luna ownership, explicit unverified states,
  and raw-source CAS made false-confidence paths observable before renderer work.
- Improve: include BOM-prefixed source-plus-offset fixtures at every parser boundary and derive fatal thresholds from
  official counterexamples before freezing acceptance text.
- Highest-risk evidenced weakness: focused source/layout correctness can still become a convincing liar if installed
  presentation or X4 frame acceptance is inferred. Broad, rendered, deploy-hash, and in-game gates remain mandatory.

## BATCH 4C ACCEPTANCE CONTRACT — RENDERER-READY SAMPLES AND DESCRIPTOR FACTS (2026-08-10)

Status: `FOCUSED VERIFIED` for the bounded direct-source projection foundation; production-menu coverage remains
`PARTIAL` behind Batch 4D, and overall B119 remains `IN_PROGRESS / PARTIAL`.

The accepted Batch 4A bridge is source-correct for its bounded scope (30/30, typecheck and targeted lint green), but its
production census exposes a renderer-blocking boundary rather than a usable preview: `aic_menu.lua` projects
`0/0/4`, `aic_hub.lua` `0/0/2`, and `aic_comm.lua` `0/0/1` tables (`projected/partial/refused`) in the selected targets.
The call-model census also reaches its 128-gap cap in all three files. Most direct production tables have static column
counts but runtime-derived widths such as `tw`, `w`, `railW`, or `vw - mx * 2`. Batch 4A correctly refuses those values;
inventing them in a renderer would violate the source-first design.

Batch 4A also retains frame/table/cell source metadata, but its public nodes do not yet expose all descriptor facts a
renderer needs: frame `x/y`, table `y/maxVisibleHeight`, inherited cell `x/width`, text/button content, and text
presentation properties. A scene builder must not reimplement `resolveNumber`, direct `Helper.scale*` matching, default
propagation, or call-model ownership. This unit therefore enriches the existing projection owner before Canvas work.

### Bounded implementation

- Extend only the existing ordered call model and layout-program owners/tests. Do not add a second parser, evaluator,
  layout tree, workspace field, renderer, React component, server route, or dependency.
- Complete the v1 inherited descriptor-property projection needed by shipped Helper descriptors. At minimum include
  `x/y/width/scaling` for edit boxes and any currently omitted inherited v1 geometry consumed by text, button, edit-box,
  or icon descriptor creation. Preserve exact value status, expression, source range, receiver identity, and order.
- Add an optional immutable preview-sample input to the existing layout projector without breaking the accepted
  three-argument path. The program emits a deterministic catalog of sampleable dynamic scalar values. Samples bind to
  one source-hash-scoped, source-range-derived ID and an expected type; they never bind globally by variable spelling.
- Supported preview samples are finite numbers, strings, and booleans only. They may satisfy the exact dynamic value
  consumed by count, geometry, text, or a supported property. They may not resolve receiver/data-flow identity,
  branch choice, loop multiplicity, local-function invocation, arbitrary arithmetic, a C++ value, a color-table object,
  or any different source range. Static source always wins over a supplied sample.
- Invalid, stale, duplicate, extra, type-mismatched, non-finite, or source-mismatched samples are visible typed gaps or
  refusal; no sample silently disappears and no sampled value is written back to Lua. Every applied sample carries
  `preview-only` provenance and remains `Not verified in game`.
- Expose immutable renderer-ready descriptor facts on the existing frame/table/row/cell/operation projection, using the
  same resolver and kernel transitions: frame offset/size/layer/auto-height state; table offset/width/max-visible-height/
  scaling and presentation metadata; row padding/border/fixed/scaling; cell kind/span/outer offset/size/scaling/
  `affectRowHeight`; and source/sampled content plus supported text/font/alignment/wrap properties. Unknown fields remain
  explicit unavailable facts with source-linked gaps. Preserve color expressions as evidence; do not invent RGBA.
- Apply only source-pinned Helper defaults from the accepted hash. Relevant anchors include base widget defaults
  `helper.lua:3104-3108`, frame defaults `3121-3133` plus frame size/offset initialization `3793-3797`, table defaults
  `3163-3181`, row defaults `3188-3196`, text defaults `3204-3216`, icon/button/edit-box defaults `3218-3245`, and
  Helper constants `514-535`. Runtime C++ dimensions/colors remain explicit profile or unavailable facts.
- Keep exact-range direct `scaleX/scaleY/scaleFont` handling, kernel prior-state/refusal evidence, target isolation,
  branch/loop conservatism, immutable serializable results, source hashes, and permanent game-truth state.
- Bounded local-function call expansion is deliberately out of this unit. Its absence stays a visible production gap and
  will be reconciled as Batch 4D; this unit must not pretend sampled parameters create caller/callee ownership.

### Required evidence and negative paths

- Goldens cover a direct static menu with frame/table/row/text/button/edit-box/icon descriptors, omitted source-pinned
  defaults, explicit inherited overrides, direct scale calls, exact node facts, and no duplicate evaluator behavior.
- A runtime-derived table width and dynamic text become projected only when their exact catalog IDs receive valid
  samples; changing sample values deterministically changes kernel width/height/content while source/model bytes remain
  identical. The unsampled path stays partial/refused exactly as before.
- Negative fixtures cover stale/unknown/duplicate IDs, wrong type, non-finite number, sample for static source, source
  hash drift, same expression at two ranges, conditional/loop value, data-flow receiver, arbitrary nested expression,
  and unsupported color object. No case may mutate authoritative kernel state without an exact supported binding.
- Regression gates: expanded call-model and layout-program selftests; kernel 29/29; linter 112/112; source-bundle;
  corpus assets 23/23; typecheck; zero-warning targeted ESLint; and a read-only three-menu census reporting how many
  previously refused direct tables become sampleable while local-helper-call and truncated-analysis gaps remain honest.

### Batch 4C focused close and reconciled production boundary (2026-08-11)

- Native Luna `019feeca-6203-7e71-b41b-0e9b0b2485b0` completed the bounded correction in the call-model/layout-program
  owners only. `addRow` now keeps Lua-truthy rowdata/selectability separate from `properties.interactive`; dynamic
  rowdata does not block deterministic row geometry or first-row final-width freeze. `createText.minRowHeight`, its
  exact scaled Helper floor, and the caller-supplied C++ text-height candidate remain separate evidence. Shipped
  `setText`/`setText2` receiver restrictions and inherited/overridden text scaling are source-pinned; unsupported nested
  properties remain raw source gaps and cannot overwrite renderer facts.
- Worker and independent coordinator evidence: call model 39/39, layout program 61/61, kernel 29/29, linter 112/112,
  source bundle PASS, workspace-source adapter PASS, corpus assets 23/23, font metrics 10/10, text layout 8/8,
  repository typecheck exit 0, and zero-warning targeted ESLint. The coordinator's first regression wrapper used stale
  selftest filenames and exited 1 after the first three green suites; the exact-path rerun passed every missed suite.
- Read-only production census used the exact installed `aic_menu.lua`, `aic_hub.lua`, and `aic_comm.lua` sources with
  caller-labelled supplied dimensions and permanent `Not verified in game`. The selected `*.display` targets expose
  16/11/5 exact-range sample entries, but all bindings remain `not-applied` and all 4/2/1 direct tables remain refused.
  All three call models reach the 128-gap cap. Reconciliation proves the immediate blocker is receiver identity: each
  production file uses lexical `local Helper = rawget(_G, "Helper")`, which Batch 4C deliberately may not equate with
  the shipped global API.
- Acceptance correction: the direct-fixture sample/fact foundation is accepted, but the production-menu sampleability
  clause is deferred to the already-specified Batch 4D exact Helper-alias and local-function expansion. No generic
  `rawget` evaluator, runtime-availability proof, scene/Canvas claim, or game-acceptance claim is implied.
- AAR triggers: one intermediate worker typecheck exposed and corrected a TypeScript union-spread issue; the
  coordinator used stale selftest filenames once; multiline `tsx --eval` on Windows executed only the first statement,
  so the census was rerun as a single-line argument; and reconciliation changed the production acceptance boundary.

## BATCH 4D ACCEPTANCE CONTRACT — BOUNDED LOCAL-HELPER EXPANSION (2026-08-11)

Status: `VERIFIED` for the bounded pure call-model/layout projection; `PARTIAL` for production preview completeness and
game parity. It follows acceptance of Batch 4C and precedes any claim that the scene renderer covers `aic_menu.lua`,
`aic_hub.lua`, and `aic_comm.lua` rather than only their directly written `display()` calls.

### Reconciled reason

The three acceptance sources do not express one flat display body. `aic_hub.lua` delegates panels to `tabDossier`,
`tabInfluence`, `tabIntel`, `tabNews`, `tabFleet`, and `tabSettings`; `aic_comm.lua` delegates to drawing helpers such as
`sectionBar`, `kv`, `meter`, `drawCorrespondent`, `drawLeverage`, `drawTranscript`, `drawTerms`, and `drawInput`;
`aic_menu.lua` also uses `addWedge` and `addMeter`. The existing call model deliberately analyzes each function as a
separate exact source context and marks its parameters runtime-provided. Batch 4C scalar samples cannot and must not
invent caller/callee object ownership. Rendering only the root target would therefore omit real tables while looking
plausibly complete.

All three acceptance sources also establish the shipped helper receiver through the same lazy source idiom:
`local Helper = rawget(_G, "Helper")`, followed by an exact conditional refresh assignment using the same expression.
The current call model does not equate that lexical local with the global Helper API, so the production census cannot
project even directly written frame calls. Batch 4D must recognize this one source-proven receiver alias without
turning `rawget`, globals, or runtime availability into a general evaluator.

### Bounded implementation

- Extend only the existing call-model/layout-program owners and tests. Do not add a Lua VM, second parser, generic
  interpreter, code execution, filesystem access, server route, workspace field, renderer, React component, or
  dependency.
- Add immutable source-ranged local-function declaration and invocation facts to the existing model. A supported
  invocation is a direct same-file local function, or an exact local alias whose tracked value resolves to that
  declaration. Record declaration/body/parameter ranges, call-site range and context, ordered arguments, exact callee
  identity, and whether the invocation result is consumed. Name equality alone never establishes identity.
- Add one separate, exact Helper-receiver alias rule for the production idiom. Only an unshadowed built-in `rawget`
  called with the unshadowed global `_G` and one exact static string key `"Helper"` may bind a lexical local to the
  global Helper API identity. A later assignment of that same exact expression to the same local preserves the alias;
  any other assignment invalidates it from that source point. Preserve declaration/call/assignment ranges and an
  explicit runtime-availability gap: the alias proves receiver identity for preview projection, not that Helper was
  non-nil at load time or that X4 accepted the frame.
- Do not add a generic `rawget` evaluator. A shadowed `rawget`, shadowed `_G`, dynamic key, non-`Helper` key, computed
  global/table access, alias copied through an unresolved value, or reassigned local remains source-located and
  non-applied. Preview samples may never establish Helper receiver identity.
- Exclude computed/table/global calls, methods, varargs, unresolved aliases, closures whose declaration identity is
  unavailable, and calls whose receiver/function value is runtime-provided. They remain explicit source-located gaps.
- The layout projector may recursively instantiate a supported local helper only from an exact invocation reachable
  from the selected root target. Instance identity includes the complete call-site ancestry, so two calls to the same
  helper never share frame/table/row/cell IDs or kernel state.
- Bind a callee parameter only by its exact declaration range to the corresponding exact caller argument. Known
  frame/table/row/cell references may establish object ownership; scalar literals, direct source-matched `Helper.scale*`
  values, and accepted Batch 4C samples may establish scalar facts. Never bind by spelling or across a different call.
- Parameter substitution supports direct consumption of the bound value. Arithmetic, string functions, table access,
  arbitrary nested calls, side effects, globals, C++ values, and color objects are not evaluated. Their complete source
  expressions remain individually sampleable only where Batch 4C already permits a scalar preview sample.
- A local helper's return expression is not executed or inferred in this unit. If a later layout input consumes the
  helper call result (for example `y = sectionBar(...)`), that exact call-result source range remains a preview-only
  scalar sample point. The expanded helper's own UI effects may still project independently.
- Add an explicit immutable preview-path selection for conditional invocation call sites. It is keyed by source hash,
  exact branch-boundary ID, and exact arm ID; selects at most one non-statically-unreachable arm per boundary; carries
  `preview-only` provenance; and never changes source reachability or linter truth. Without a valid selection,
  conditional invocations remain non-applied exactly as before. Loops are never replayed or assigned an iteration count
  in this unit.
- Detect direct and indirect recursion, cycles, unsupported consumed returns, excessive depth, and excessive expanded
  invocation count before mutating projected kernel state. Use explicit deterministic limits in the projection profile;
  invalid limits or overflow refuse the affected invocation while preserving the last exact prior state.
- Merge call-site and callee branch/loop reachability. An unselected branch, any loop path, or statically unreachable
  path never mutates the deterministic scene. A selected preview branch remains visibly partial/unverified rather than
  becoming static proof.
- Preserve Batch 4C three-argument compatibility, optional sample behavior, exact source hashes/ranges, source order,
  operation ledger, kernel refusal history, immutable serializable output, and permanent `Not verified in game`.

### Required evidence and negative paths

- Positive fixtures cover one root `display()` calling two same-file helpers, nested helper calls, two invocations of
  the same helper with different arguments, exact frame ownership through a parameter, direct scalar/text/geometry
  parameter substitution, an aliased local function, preview-sampled helper call results, and a selected conditional
  tab invocation. They also cover the exact production `local Helper = rawget(_G, "Helper")` receiver alias and its
  same-expression lazy refresh assignment. IDs and operation order must be deterministic and source-derived.
- Negative fixtures cover same-named functions at different ranges, unknown/global/table/method/vararg calls, wrong
  arity, missing argument, stale source hash, duplicate/conflicting/extra branch selections, statically unreachable arm,
  looped invocation, dynamic receiver, parameter-name collision, consumed unsupported return, recursion/cycle, depth/
  invocation limits, conditional call without selection, shadowed `rawget`, shadowed `_G`, dynamic/non-`Helper` rawget
  keys, conflicting Helper-local reassignment, and sample attempts to establish function or receiver identity. Every
  refusal retains exact prior kernel state and source-located evidence.
- No-edit direct-target output remains behavior-compatible with Batch 4C. Static source and direct Helper scale values
  still outrank samples; expansion never erases unrelated verification gaps or the 128-gap truncation signal.
- Regression gates: call-model, layout-program, kernel, linter, source-bundle, corpus-assets, typecheck, and zero-warning
  targeted ESLint. The read-only production census must report, for each of the three named menus, direct tables,
  supported local invocations, expanded/sampleable tables, selected-branch tables, and remaining loop/runtime/data-flow/
  truncated gaps. The census is evidence of preview coverage, not an in-game acceptance claim.

### Focused implementation checkpoint (2026-08-11)

- Native Luna `019feeca-6203-7e71-b41b-0e9b0b2485b0` implemented the bounded unit only in the existing call-model and
  layout-program owners/tests. The model now records immutable exact declaration/parameter/invocation identities,
  direct local aliases, the exact unshadowed `rawget(_G, "Helper")` receiver idiom and invalidation history. The projector
  adds opt-in ancestry-scoped expansion, exact parameter bindings, source-hash/range-bound preview paths, deterministic
  limits, recursion/cycle refusal, and pending-subtree rollback. It does not execute Lua, replay loops, infer returns,
  prove runtime Helper availability, or weaken `Not verified in game`.
- Worker and independent coordinator gates pass: call model `46/46`, layout program `80/80`, kernel `29/29`, linter
  `112/112`, source bundle PASS, corpus assets `23/23`, repository typecheck exit 0, and zero-warning targeted ESLint over
  the four owned files. Fresh-eyes review covered shadowing/reassignment, exact declaration identity, direct-literal and
  object-ownership binding, branch selection, source order, recursion/limit preflight, subtree rollback, deep freeze,
  determinism, and no-import/no-evaluator boundaries; no acceptance-breaking defect remained.
- The read-only census used exact installed `menu.display`, `hub.display`, and `comm.display` targets, a source-identity-
  bound 1920x1080 captured profile, first non-unreachable arm per exact branch boundary, and typed placeholder samples
  generated only from each selected program's catalog. Workspace and installed Lua SHA-256 values match exactly:
  `4253D9BD...47DD7`, `657476EA...8C4F`, and `88FAB05A...3511`.
- `aic_menu.lua`: 4 direct tables (`1 conditional`, `3 unresolved`), 36 supported root invocations, 23 expanded
  invocations, 9 expanded `addTable` operations, 13 sampleable table operations, and 7 selected-branch table operations;
  none of those 7 is applied. Remaining bounded evidence includes 25 looped invocations, 14 runtime-Helper reason hits,
  62 data-flow gaps, 301 local-expansion gaps, 18 preview-path gaps, and one truncation/analysis gap.
- `aic_hub.lua`: 2 direct tables (both applied), 9 supported root invocations, 7 expanded invocations, no expanded table
  operation, 2 sampleable table operations, and no selected-branch table. Remaining evidence includes 1 looped
  invocation, 7 runtime-Helper reason hits, 7 data-flow gaps, 21 local-expansion gaps, one preview-path gap, and one
  truncation/analysis gap.
- `aic_comm.lua`: 1 unresolved direct table, 8 supported root invocations, 6 expanded invocations, no expanded table
  operation, 1 sampleable table operation, and no selected-branch table. Remaining evidence includes 2 looped
  invocations, 4 runtime-Helper reason hits, 4 data-flow gaps, 25 local-expansion gaps, one preview-path gap, and one
  truncation/analysis gap.
- Every call model still reaches the 128-gap bound. Preview arm choice and placeholder values are deterministic design
  inputs, not runtime facts; operation status is not frame acceptance. This checkpoint unblocks the pure scene unit but
  does not establish a complete production render, installed-host behavior, deploy parity, or X4 truth.

## BATCH 5A ACCEPTANCE CONTRACT — ZEKTON LINE LAYOUT AND GLYPH QUADS (2026-08-11)

Status: `VERIFIED` for the bounded pure provisional foundation; `PARTIAL` for browser/game visual parity. This unit is
accepted for the later scene/painter, but its wrap/truncation policy remains provisional until in-game comparison.

### Reconciled source facts

- X4 9.00 ships `zekton_32.abc` / `zekton bold_32.abc` and matching A8 DDS atlases; no TTF copy was found in the
  configured corpus. The accepted decoder already proves 1,140 regular glyph records, 1,141 bold records, exact Unicode
  maps, exact advances/bearings/UVs, 1024x2048 atlas parity, and immutable raw-run measurement.
- The 48-byte ABC header contains repeatable vertical data that is currently preserved but not typed. Across every
  shipped ABC family, little-endian float32 fields at offsets 4/8/12/16 form an exact outer/top/bottom/inner line-box
  relationship (`outer = top + inner + bottom`); signed int32 fields at 20/24 split the inner height to integer rounding
  tolerance. Zekton records outer/inner `52`, top/bottom `0`, and the `41/11` split. Offset 28 is observed but its semantic
  name is not proven and must remain a raw field. Offsets 36/40/44 remain atlas width/height/max-codepoint as already
  decoded. Header format/version and reserved fields must be validated, not skipped.
- Helper computes text height through C++ `GetTextHeight`, floors the scaled fontsize, and ceils the result
  (`helper.lua:5482-5497`). `widget_fullscreen.lua` delegates width, wrapping, and `TruncateText` to C++. Therefore the
  atlas can make glyph widths and candidate break points source-backed, but C++ line-break/truncation parity remains
  provisional until compared with the running game. No browser-font result may be labeled exact.

### Bounded implementation

- Extend `x4UiFontMetrics.ts` and its selftest to expose a frozen typed ABC line-metrics object while retaining all raw
  header bytes. Validate finite/nonnegative domains, exact outer/top/inner/bottom relation, bounded vertical fields,
  atlas fields, format/version, reserved fields, and malformed/truncated counterexamples. Do not silently reinterpret
  offset 28 or weaken existing 9/9 decoder evidence.
- Add one new pure browser-compatible `x4UiTextLayout.ts` owner and standalone selftest. It imports only accepted font
  metrics/types and has no DOM, Canvas, CSS, browser font, filesystem, process, network, config, React, or dependency.
- Require an explicit immutable text profile tied to exact descriptor/atlas identities. The profile supplies a proven
  nominal design size (32 only for the pinned `_32` corpus identities), requested post-`scaleFont` integer fontsize,
  line spacing, wrap/truncation mode, fallback policy, and truth grade. Invalid identity/size/profile combinations
  refuse; arbitrary filename parsing is not authority.
- Lay out Unicode code points, never UTF-16 halves. Advance is the exact ABC advance times requested-size/design-size;
  glyph quad x uses exact horizontal bearing and bitmap width; UV and alpha-atlas identity remain exact; line box uses
  typed header metrics and explicit profile scaling. Missing mappings, control/icon escape sequences, unsupported atlas
  pages, invalid newlines, and overflow remain source-located or text-indexed gaps rather than replacement guesses.
- Implement deterministic explicit v1 candidate policies for hard newlines, no-wrap truncation, and greedy word wrap.
  Preserve the original string and emit displayed text, line ranges, break reason, measured width, truncation state,
  glyph quads, and all gaps. A too-wide token may break by code point; whitespace handling and ellipsis token are profile
  fields, not hidden browser behavior. Static measurements are exact for the chosen policy; the policy's parity state is
  `provisional-until-game-parity` until screenshot calibration proves C++ agreement.
- Do not use text layout to clear `Not verified in game`, infer C++ `GetFontHeight`, fabricate kerning, substitute a
  browser font, paint colors, or mutate source. Outputs and inputs are deterministic, serializable except copied atlas
  bytes already owned by the font asset, deeply frozen, and provenance-complete.

### Required evidence and negative paths

- Header goldens cover actual pinned regular and bold assets plus synthetic top/bottom padding, integer-rounding split,
  wrong format/version, invalid outer relation, negative/non-finite/oversized metrics, bad reserved fields, truncated
  header, and prior decoder counterexamples. Record actual Zekton values without promoting offset 28 to a guessed name.
- Text goldens cover regular/bold advances, bearing-aware glyph quads, explicit scale 9/32, hard newline, exact-fit and
  one-pixel-over wrap, multiword wrap, leading/trailing/repeated whitespace, too-wide token, no-wrap truncation, empty
  string, CRLF policy, Unicode supplementary code point, missing glyph, unsupported control/icon escape, and deterministic
  replay. Assert original input bytes/text unchanged, deep freeze, JSON serialization, and exact profile provenance.
- A fixture matching Helper's default `Zekton` size 9 must show the source-backed design line candidate separately from
  Helper's source-pinned `standardTextHeight=16`; the later scene kernel decides the row maximum. Do not bake 16 into
  font metrics.
- Regression gates: expanded font-metrics selftest, new text-layout selftest, corpus-assets, layout kernel/program,
  linter, typecheck, and zero-warning targeted ESLint. Running-game wrap/truncation screenshots remain a later mandatory
  acceptance gate, so this unit closes `VERIFIED` only as a pure provisional text foundation, never as visual parity.

### Focused implementation checkpoint (2026-08-11)

- `x4UiFontMetrics.ts` now exposes the strict typed 48-byte header while retaining raw bytes; regular/bold pinned
  assets decode at 1,140/1,141 glyphs with `52/0/0/52`, `41/11`, and raw metric 28=`9`.
- `x4UiTextLayout.ts` projects Unicode-safe source-indexed lines and source-backed glyph quads from the exact ABC/DDS
  identities. It imports no Node, DOM, Canvas, CSS, React, browser-font, network, config, or persistence owner.
- Fresh-eyes correction pins nominal design size 32 only to an exact same-style regular/regular or bold/bold canonical
  identity pair and exposes an overwide ellipsis as an explicit overflow gap. The synthetic corpus fixture now writes
  the exact accepted header rather than weakening production validation.
- Coordinator reruns pass font metrics `10/10`, text layout `8/8`, and corpus assets `23/23`; targeted ESLint is clean.
  The worker regression also passed kernel `29/29`, layout program `50/50`, call model `36/36`, linter `112/112`, source
  bundle, and repository typecheck. Actual corpus SHA-256 values exactly match all four pinned asset identities.
- Remaining gate: candidate wrap/truncation/ellipsis policy and rendered vertical placement require Canvas integration
  and running-game screenshot parity. This checkpoint does not clear `Not verified in game`.

## BATCH 6A ACCEPTANCE CONTRACT — PURE X4 SCENE PROJECTION (2026-08-11)

Status: `SPECIFIED`; implementation is now unblocked by the focused-verified Batch 4D projection baseline. This unit
creates the serializable geometry/text scene consumed by the later Canvas painter. It is not React, Canvas, workspace
loading, source editing, package/deploy, keep-out presentation, screenshot parity, or game acceptance.

### Reconciled authority and boundary

- The only layout input is one immutable accepted `X4UiLayoutProgram`. The scene may consume its known descriptor facts,
  kernel states, source identities, operation ledger, gaps, and preview-only selections. It must not parse Lua, resolve
  expressions, infer receiver ownership, replay calls, rescale source values, or substitute defaults a second time.
- Shipped `helper.lua` remains authoritative for frame defaults and descriptors (`3767-3803`, `4009-4115`), table
  `getMaxVisibleHeight` / `getVisibleHeight` / `hasScrollBar` (`4866-4890`), descriptor scrollbar adjustment
  (`5004-5075`), row serialization (`5082-5117`), cell width/height (`5323-5400`), text height and descriptor offsets
  (`5482-5550`), and icon/button/edit-box descriptors (`5686-5741`, `5801-5899`, `5984-6039`).
- Shipped `widget_fullscreen.lua` remains authoritative for drawable offsets and UI scale inputs (`8692-8708`), frame
  coordinate conversion (`16932-16940`), table parent/available extents and column placement (`14255-14467`), row
  border/padding progression and cell centers (`6055-6133`, `6177-6244`), and widget placement (`11991-12021`,
  `12603-12614`, `13140-13173`, `13899-13921`, `17790-17861`). The scene expresses these as top-left drawable
  coordinates; parity of the C++ `GetFramePosition`, `GetSize`, and frame-acceptance boundary remains unverified.
- `x4UiTextLayout.ts` is the only text measurement/wrap owner. Its glyph metrics are exact for the pinned bitmap assets,
  while its wrap/truncation policy remains `provisional-until-game-parity`. The scene may translate returned glyph quads;
  it must not use Canvas/browser text measurement, recreate wrapping, fabricate kerning, or upgrade that evidence grade.
- Runtime/C++ colors, texture materials, minimum control sizes, widget active state, current scroll/selection, and frame
  acceptance are not proven by the static program. Unknown paint is retained as source evidence and a diagnostic style
  class, never invented RGBA presented as X4 truth.

### Bounded implementation

- Add only `src/lib/x4UiScene.ts` and `src/lib/x4UiScene.selftest.ts`. The production module may import accepted pure
  layout-program, layout-kernel conversion, text-layout, and font-metrics types/functions. It may not import parser,
  filesystem, process, network, workspace, config, persistence, React, DOM, Canvas, CSS, server, or source-mutation code.
- Export one minimal pure builder accepting exactly one successful layout program, an exact immutable font-asset map for
  supported `Zekton` / `Zekton Bold` identities, and an immutable scene profile. A structurally valid layout program with
  literal status `partial` is successful input: retain its known siblings and emit a partial scene. Reject a literal
  `refused` status, a missing/malformed program structure, or an internally mismatched required identity before geometry.
  The profile pins the program/source, Helper/widget/font hashes, drawable width/height, provisional text policy, and
  optional caller-supplied table view state. Refuse stale identities, malformed/unsafe numbers, duplicate IDs,
  unsupported asset pairs, or profile/program mismatch before producing scene geometry.
- Emit a deterministic, serializable, deeply frozen scene with separate frame/table/row/cell/widget/text-glyph nodes,
  source-derived IDs, parent IDs, source locations, z/source order, top-left logical rectangles, clip rectangles,
  descriptor provenance, completeness, diagnostic links, and permanent `gameTruth: "Not verified in game"`. Keep engine
  geometry and presentation/diagnostic style tokens separate. No downstream consumer may mistake an unknown color or
  texture placeholder for an engine-derived paint value.
- Frame rectangles use only known frame `x/y/width/height` descriptor facts. Table origin is frame origin plus known
  table `x/y`; available height is the frame height minus table y, bounded by a positive known `maxVisibleHeight` exactly
  as Helper does. Unknown frame/table geometry produces a source-linked scene gap and no fabricated numeric rectangle.
- Derive visible-table height and `hasScrollBar` only when full row height, available height, and required facts are all
  known. Port the descriptor's reserve/no-reserve rightmost-column adjustment and variable-column redistribution in the
  same source order, then use the accepted widget column converter. An unknown scroll decision leaves descriptor column
  geometry unavailable; it must not silently reuse pre-descriptor widths as final pixels.
- Accumulate column x positions from converted widths plus the source-pinned table border size. Accumulate row content
  top/center/bottom using row height, `paddingTop`, `paddingBottom`, and `borderBelow`; clip at the known table viewport.
  A `colspan=0` cell is retained as hidden evidence and never drawn. Visible cells use only their exact span width and
  row height. Row groups and fixed-row/scroll behavior are projected only when the accepted program provides complete
  facts; otherwise their effect remains an explicit gap without moving known siblings speculatively.
- Widget rectangles use only finalized cell `outerX/outerY/outerWidth/outerHeight` facts and the shipped widget-specific
  parent propagation rules. Zero width/height may inherit the exact accepted span/row extent only where the shipped
  source does so. Text, button, edit-box, and icon remain distinct node kinds; unsupported textures/interaction state do
  not erase known geometry.
- For each supported text surface, require known content, exact font identity, integer post-`scaleFont` size, alignment,
  offsets, available width, and explicit provisional text policy. Call `layoutZektonText`, then translate its line boxes
  and glyph quads through the source-backed cell/button/icon alignment formula. Preserve primary and secondary text as
  separate children. Missing glyphs, control escapes, unsupported fonts, overflows, and provisional wrap/truncation stay
  attached to the exact text node and propagate partial scene status.
- Affected known siblings may still project when one table/cell/text node is unavailable or refused. The scene status is
  `projected`, `partial`, or `refused` based on the actual retained geometry and gaps; a visually non-empty partial scene
  is never promoted to complete. Preview-path/sample provenance from Batch 4D remains visible and never becomes source
  or game truth.
- Keep-out presets are deliberately not engine-scene nodes and never affect layout or clipping. The later painter composes
  accepted `x4UiKeepOuts` projections as a separate design-time overlay layer over this scene.

### Fresh-review reconciliation correction (2026-08-11)

- A read-only source audit reproduced that a bare `X4UiSceneFontAssetMap` can carry fabricated decoded metrics under the
  canonical path/hash strings and can therefore change emitted glyph geometry. The production scene builder must instead
  accept the already-loaded `X4UiCorpusCanonicalSuccess` as its font-evidence input. It may import this accepted pure corpus
  evidence type/contract, but it still may not fetch, scan, hash, decode, persist, or access a filesystem itself.
- Refuse corpus failures, synthetic evidence, mutable/detached decoded font graphs, stale identities, or broken
  `assets.*.decoded` / `fonts.*` cross-links before geometry. The configured-corpus loader remains the byte/hash authority;
  the scene validates that it received that canonical immutable success boundary and must not pretend that identity strings
  alone authenticate arbitrary caller-built metrics.
- This replaces the earlier bare-map input wording for the production builder and aligns Batch 6A with Batch 6B, which
  already receives the canonical configured-corpus result. It adds no scanner, transport, browser, or persistence owner.

### Acceptance re-audit correction (2026-08-11)

- A second independent read-only audit proved that the structural `X4UiCorpusCanonicalSuccess` interface is still
  forgeable: a frozen caller-built object with copied identity strings and altered glyph metrics changes scene geometry.
  Batch 6A therefore expands only to the existing corpus authority owner, `x4UiCorpusAssets.ts` and its selftest. The
  loader must register an opaque module-private witness for each canonical success after its existing hash/decode gates,
  snapshot every mutable typed-array payload used or carried by that result, and export one pure synchronous authority
  predicate. The predicate accepts only the exact loader-issued object while every snapshotted byte still matches; it
  rejects structural clones, synthetic results, detached decoded graphs, and post-load typed-array mutation. The scene
  imports only that predicate/type and still may not fetch, scan, hash, decode, persist, or access browser/filesystem state.
- The accepted layout program must be a complete reciprocal representation of every kernel-owned row and column slot,
  including `colspan=0` placeholders. Reconcile row `fixed`, `paddingTop`, `paddingBottom`, `borderBelow`, and `scaling`,
  plus every cell fact consumed by geometry, against the matching kernel row/cell before any scene is emitted. Missing,
  duplicate, detached, or contradictory slots refuse the whole scene boundary; known siblings remain projectable only
  for structurally valid `partial` programs.
- A descriptor `reserveScrollBar=true` may become kernel `false` only for the exact source-backed kernel diagnostic:
  match both code and exact message, and recompute the available/required values for the insufficient-space message from
  the accepted kernel state. A forged code, forged message, missing diagnostic, or `false -> true` transition refuses.
- Validate the complete required operation shape, including a closed operation-kind set and metadata structure; every
  gap `operationId`/`nodeId` must resolve to its reciprocal owned record. Recompute the layout-program result-status
  invariant: any gap or non-applied operation requires `partial`, while a clean accepted graph may be `projected`.
  Malformed provenance may never fall back to a different source location.
- Add fail-first regressions for valid-looking altered glyph metrics, same-length byte mutation, missing kernel slots,
  contradictory row padding/border/scaling, forged or missing reserve diagnostics, missing operation fields, unknown
  operation kinds, dangling gap references, and impossible `projected` status. Refresh corpus-assets and scene focused
  counts, then rerun the complete Batch 6A matrix, typecheck, owned-file ESLint, import-boundary scan, and diff checks.
  This correction supersedes the earlier two-file-only sentence for the narrowly required corpus authority seam; no
  other production or test file enters Batch 6A.

### Final authority and reconciliation correction (2026-08-11)

- The canonical loader must not trust the caller-injectable `hashProvider`: a read-only probe proved that a provider can
  return the pinned digests for arbitrary bytes and receive a privately registered canonical result. Canonical/configured
  loading must reject a supplied hash provider and use only the module-owned platform Web Crypto path. The injectable
  provider remains available only to the explicitly synthetic loader. Selftests may temporarily simulate platform crypto
  in their own process, with guaranteed restoration, but no production option/export may mint or register canonical
  authority without the canonical status/manifest/file/Web-Crypto/decode/consistency path.
- Cell reconciliation must bind every known descriptor fact consumed by scene geometry or widget selection to its exact
  `HelperCellState`: normalized content kind, y, finalized outer height, scaling, `affectRowHeight`, and `minTextHeight`,
  in addition to span and existing structural state. Use the accepted program/kernel formulas; do not equate a raw state
  height with a finalized descriptor height when the source computes them differently.
- Insufficient-space scrollbar fallback must validate the real first-`addRow` transition: finalize the owning pre-row
  state, verify the exact diagnostic and finalized table fields, verify the appended row through the accepted transition,
  and reconcile any later table transition chain to the final kernel state. Do not require zero-row finalization output to
  equal a row-containing `addRow` result. Keep the exact no-variable message/source-condition check.
- Gap reciprocity is hierarchical. Compare the owner field matching the referenced node kind, then verify the operation's
  row/table/frame ancestors against that node's actual ancestry. A valid dependency-generated cell gap with table, row,
  and cell owners remains a partial program; dangling or contradictory ancestry refuses.
- Metadata validation must reject active recursion/cycles while allowing repeated acyclic references and must validate the
  closed `X4UiCallSemantics` surface rather than arbitrary objects. Add fail-first regressions for a lying canonical hash
  provider, forged consumed cell facts, a valid insufficient-space transition, a valid reciprocal cell gap, and cyclic
  semantics. Rerun the complete Batch 6A matrix and the prior authority/boundary regressions.

### Final independent-review correction (2026-08-11)

- Canonical loading must snapshot only its allowlisted transport/fetch/signal/byte-cap inputs and bind its private
  platform-hash mode before any caller callback or `await`. It must never reread the caller-owned options object for
  `hashProvider`; an ordinary object mutation or casted `Proxy` with contradictory `has`/`get` traps must not inject a
  digest provider or receive canonical authority. Synthetic loading retains the explicit injectable hash seam. Add both
  post-check mutation and Proxy fail-first regressions, including proof that the injected provider was never called.
- A source-to-consumer audit reproduced a remaining false rejection in row-owned gap reciprocity. The layout-program
  owner records real `addRow` operations with both `tableId` and `rowId`, and may attach a partial gap to that exact row;
  scene validation must therefore require the row's real table/frame ancestry rather than require `tableId` to be absent.
  Keep the frame/table/cell branches equally exact, and add positive row-owned plus wrong-ancestor negative fixtures.
- The insufficient-space acceptance proof must follow the complete ordered kernel-transition chain from the first real
  `addRow` finalization through every later kernel-bearing operation to the table's final state. Matching diagnostics alone
  do not establish continuity. Positive evidence must include real intervening cell specializations/setters and later rows;
  a missing, reordered, disconnected, or forged `stateAfter -> stateBefore` link must refuse even when diagnostic code,
  message, and provenance match. Add a three-or-more-row disconnected-chain negative so the two-row happy path cannot
  stand in for complete reconciliation.
- The scene input boundary is closed per node kind, not only per enum. Apply exact required/optional key allowlists to
  frame, table, row, and cell nodes before geometry; an unexpected property on any node kind must refuse. Replace the
  current unknown-key cycle surrogate with an allowed-field active-cycle regression, and add a shared acyclic-object
  regression proving the completed-object path does not create a false rejection.
- These corrections remain inside `x4UiScene.ts` and its selftest. Rerun scene fail-first/final counts, the complete Batch
  6A dependency matrix, typecheck, owned-file ESLint, boundary scans, diff checks, and a final independent read-only audit
  before marking the pure scene boundary accepted. The canonical options correction also remains inside the already-owned
  `x4UiCorpusAssets.ts` and its selftest; no other file enters Batch 6A.

### Second independent-review correction (2026-08-11)

The first correction is still not accepted. A fresh read-only audit reproduced five additional boundary defects that the
79/79 scene and 27/27 corpus selftests did not cover:

- Canonical hashing must be captured at the canonical public entry point as its first operation, before inspecting the
  caller options object, walking its prototype chain, reading `byteCaps`, invoking a getter/Proxy trap, calling transport,
  or awaiting. The pre-bound provider is then passed into an allowlisted internal snapshot; canonical code never binds or
  rereads platform hashing after caller-controlled property access. Add normal callback mutation plus prototype/property/
  `byteCaps` callback regressions. Each injected provider remains uncalled and changed bytes fail canonical evidence.
- Reserve reconciliation must define the exact kernel-producing call kinds (`addTable`, both column-width setters,
  `addRow`, `setColSpan`, and the four cell specialization creators). Every same-table operation of those kinds whose
  status means its deterministic kernel transition was accepted (`applied`, or `unresolved` only because descriptor facts
  remain unavailable) must carry the producer-required transition. Do not filter out a missing transition before checking
  it. Conditional, unreachable, or rejected operations do not become transition evidence.
- Reconcile the complete represented same-table chain in model/source order. Preserve exact `stateAfter -> stateBefore`
  continuity and exact final-table equality, but do not require every later diagnostics array to equal the first-row array:
  the exact reserve diagnostic must remain present while source-backed later diagnostics may append. Add a real continuous
  three-row plus diagnostic-emitting `setColSpan` fixture, and retain missing-prelude, missing-link, reordered,
  disconnected, foreign-table, forged-final, and descriptor-partial negatives/positives.
- Kernel-transition validity is independent of descriptor completeness. A cell specialization with exact accepted
  `stateBefore/stateAfter` and status `unresolved` solely because color or other C++ descriptor evidence is unavailable
  remains valid deterministic geometry in a partial scene. It must not be treated like a rejected, unreachable,
  conditional, refused, or discontinuous transition.
- Closed node input means both exact keys and exact values. Validate every optional frame/table/row/cell `identity` with
  the existing closed value-reference validator, and validate frame `widthSource`/`heightSource` with the source-location
  validator before geometry. Add malformed-value negatives plus legitimate optional-value positives.

These corrections remain confined to the same four Batch 6A corpus/scene source and selftest files. Capture each missing
regression red first, rerun the complete focused/dependency/type/lint/boundary matrix, and require another independent
read-only CLEAN audit before Batch 6B or 6C starts. Browser and game truth remain out of scope and the permanent state is
still `Not verified in game`.

### Third independent-review correction (2026-08-11)

The 83/83 scene suite still does not close Batch 6A. The next read-only producer-shaped review reproduced three further
scene-boundary defects:

- Reconcile the complete same-table producer chain from the source-valid `addTable` initial `stateAfter`, through every
  width setter, row, span, and cell-specialization transition, to the exact final table state. The first-row finalization
  check remains necessary but does not define the chain start. Do not slice away pre-row transitions, and do not bypass
  continuity for `reserve-scrollbar-no-variable-column`. Add separate disconnections for addTable-to-width,
  width-to-width, final-width-to-first-row, and post-first-row no-variable chains.
- Replace the generic unresolved rule with a closed per-operation producer policy derived from `x4UiLayoutProgram`.
  `addTable` may carry deterministic `stateAfter` while table-only descriptor facts are unavailable; cell creators may
  carry deterministic `stateBefore/stateAfter` while cell-only C++ facts are unavailable. Width setters, rows, spans,
  and cell creators also have source-valid unresolved paths with no accepted kernel transition when their static input or
  owner is unavailable; those remain explicit partial gaps, not transition evidence. No operation kind may borrow another
  kind's reason, owner IDs, gap shape, or transition policy. Applied producers require their exact producer transition;
  rejected, conditional, unreachable, or unresolved-without-transition operations never authorize the final state.
- Bind every variable diagnostic to the transition that produced it. In particular, `colspan-hid-non-cell at column N`
  must come from a source-valid `setColSpan` transition, name an in-range affected slot in the owning row, and correspond
  to a non-cell that the transition actually hides. A matching regex, self-consistent forged state, or out-of-range
  column is insufficient. Retain exact fixed diagnostic messages, reserve finalization reconciliation, diagnostic-prefix
  growth, and final-state continuity.

Add each producer-shaped regression fail-first without removing the 83 existing scene cases. Rerun the complete Batch 6A
matrix and require an independent CLEAN review of the full chain, every source-valid unresolved/no-kernel branch, every
deterministic descriptor-partial branch, and diagnostic semantics before Batch 6B/6C. The correction remains only in
`x4UiScene.ts` and `x4UiScene.selftest.ts`; corpus files stay unchanged unless their separate final audit finds a defect.

### Fourth independent-review correction (2026-08-11)

The 86/86 scene suite is still not accepted. Direct producer-to-scene review proved that handcrafted operation fixtures
were masking two layout-program contradictions plus five scene-boundary defects. This correction is split into dependent,
non-overlapping write scopes: fix and focused-accept the layout-program producer first, then correct and re-audit scene
acceptance against unmodified producer output. The independently CLEAN 28/28 corpus files remain frozen.

#### Batch 6A-P producer correction

- In `x4UiLayoutProgram.ts`, operation `sourceOrder` must use the complete call's `source.start.offset`, matching the scene
  contract and the intended source-order identity. The callee-token offset from the call model remains call-model evidence
  but cannot silently replace operation order. Add an exact raw-source regression for member calls where those offsets
  differ.
- Omitted row scaling must have one effective value. When source omits `options.scaling`, inherit the owning table kernel's
  scaling exactly as Helper/addRow does; write that same value into the descriptor fact and kernel input. Do not record
  default `true` while the kernel inherits `false`. Add explicit true/false and inherited true/false regressions.
- Keep this producer correction only in `x4UiLayoutProgram.ts` and its selftest. Rerun program/call/kernel/type/lint and a
  focused review before changing scene acceptance.

#### Batch 6A-S scene correction after 6A-P

- Add a direct raw-source `call model -> layout program -> scene` regression. An unmodified successful/partial program is
  the acceptance input; tests may not normalize `sourceOrder`, rewrite cells, or synthesize operation provenance to make
  it pass.
- Cell columns are ordered by their explicit column index and stable IDs, not monotonically increasing source offsets.
  Base cells may share a row source and a later specialization may update one cell source independently. Remove only the
  invalid source-offset ordering rule; retain strict column ordering, ownership, identity, and duplicate checks.
- Run the complete ordered deterministic producer-chain reconciliation for every kernel-backed table, regardless of
  reserve setting or diagnostic. Normal, reserve-remains-true, insufficient-space, and no-variable tables must all begin
  at the real addTable state, remain continuous through widths/rows/spans/cell creators, and end at the exact final table
  state. Missing or disconnected deterministic operations always refuse.
- Encode exact partial owner-ID subsets from the producer per operation kind. Source-valid addTable-without-frame,
  rowId-without-table, and table+row-without-cell gaps preserve reciprocal materialized siblings as partial. Continue to
  refuse dangling IDs, cross-owner ancestry, or a node claimed as materialized when its reciprocal owner does not contain
  it.
- Close status/reason/gap policy by kind. Successful addRow transitions are `applied` even when descriptor gaps attach;
  unresolved addRow has no transition and no materialized row. Applied width/table/row/span/cell operations may carry only
  producer-emitted reasons/gaps. No kind may borrow another kind's reason, owners, gap node, or transition shape.
- Bind every diagnostic delta to an operation that can produce it. Replay deterministic transitions where accepted kernel
  APIs and source-known facts permit; otherwise allow only the exact first-row finalization diagnostics already proven.
  `createText`/button/edit/icon transitions cannot append colspan diagnostics. Retain exact `setColSpan` replay, diagnostic
  growth, bounds, messages, and final state.

Permanent negatives cover real operation-order offsets, shared/out-of-order cell source locations, inherited row scaling,
normal/reserve/no-variable chain disconnections, omitted cell producers, every partial-owner subset, cross-kind status
borrowing, and diagnostics attached to non-producing operations. The complete focused/dependency/type/lint/boundary matrix
and a fresh independent CLEAN producer-to-scene audit remain mandatory before Batch 6B or 6C starts. Browser and game
truth remain outside this batch; all outputs retain `Not verified in game`.

### Fifth independent-review correction (2026-08-11)

The post-cleanup `92/92` scene candidate is not accepted. A fresh read-only producer-to-scene audit held the candidate
hashes at `B98FE5E30726FF9A3D4DBE4F7811C0176DE9EA8C4200D6E0BDFF78021CDBD469` and
`983804A5C813780448120A0D83357B34A8DBCB631F8EE0D793F79597FA782A9F`, reran the focused producer/call/kernel/type/lint
matrix green, and then reproduced three P1 defects plus one P2 defect with stdin-only producer-shaped probes. Local green
therefore did not satisfy Batch 6A-S.

- Close the operation policy by exact producer kind. Each kind must validate its complete status, exact known reason and
  gaps, permitted owner-ID subset, kernel/scale/local-expansion shape, and reciprocal membership. Unknown reasons are not
  producer evidence. Width operations may not acquire a frame/row/cell owner; `display` may retain only its optional frame
  owner and never a kernel payload; successful `addRow` remains `applied`; unresolved `addRow` may not carry a transition.
  Permanent negatives must independently refuse an unresolved/materialized row transition, an applied width with an
  arbitrary reason, a width with a forged frame owner, and a display operation with table/row/cell owners or kernel state.
- Remove unresolved state bridging. A source-valid unresolved operation without a transition is zero-state evidence: it
  cannot materialize a kernel row, row index, cells, specialization, reciprocal table membership, or any other geometry.
  The next deterministic transition's `stateBefore` must still equal the preceding accepted state. Explicit negatives
  cover unresolved no-transition `addRow` retaining a materialized row and unresolved `createText` retaining specialized
  cell state.
- Preserve real unmaterialized partial owners. The producer may retain an unresolved row node with optional `tableId`
  before successful kernel execution; that evidence is not a materialized table row and must remain outside scene
  geometry while known siblings survive. Missing-cell `setColSpan`/specialization may retain table and row IDs without a
  cell ID, and its gap node ID is absent when no cell exists; tests may not fabricate a row-targeted cell gap. Cover a
  known-table dynamic row, an ownerless unresolved row, and out-of-range `row[9]:createText(...)` directly from producer
  output.
- Permit any number of exact unresolved no-transition operations as zero-state evidence. Two consecutive dynamic width
  operations followed by a real applied row/cell are producer-valid partial output and must not be refused merely because
  the unresolved operations are adjacent. Deterministic transition continuity remains strict across them.

The correction remains bounded to `x4UiScene.ts` and `x4UiScene.selftest.ts`. Add the producer-shaped cases fail-first,
preserve the existing 92 tests, and ensure the policy tests reach the intended per-kind validator rather than failing at
the generic projected-status wrapper. Rerun the complete Batch 6A dependency/type/lint/boundary/hash matrix and require a
new independent CLEAN review with the four reproduced probe families. Batch 6B/6C, React/Canvas integration, browser
parity, installed-product validation, deploy hash, and X4 confirmation remain blocked behind accepted Batch 6A; every
state continues to say `Not verified in game`.

### Sixth independent-review correction (2026-08-11)

The expanded `96/96` fifth-correction suite is also not accepted. Its four named mutations were closed, and raw one-,
two-, and three-width zero-state sequences now pass with later deterministic continuity intact, but the independent
producer branch sweep proved that the policy was tailored to those examples rather than exhaustive. The candidate hashes
under review were `05320552DF31699855DCC9EDF500968E01B1A72E6664BBA7963B9EAC1F52CA78` and
`E491AABBAE63A10B143064F5B38CAA186CFA3D680BB37AFA7BA1E3FD829409EC`.

- Replace grouped/default operation policy with an exhaustive compile-time-closed schema for all 17
  `X4UiRelevantCallName` values and every status the accepted producer can emit. For each kind/status, validate required
  and forbidden frame/table/row/cell owners, exact reason and operation-linked gap shape, kernel/scale/local-expansion
  presence, and reciprocal owner evidence. There is no generic non-kernel success path and no permissive default. Raw
  partial output for unresolved `setText`, `display`, `OpenMenu`, direct `scaleX`/`scaleY`/`scaleFont`, and
  `createFrameHandle` must remain non-refused. Applied `display`/`createFrameHandle`/`setText` require their exact owner;
  widths reject fabricated gaps or scale payloads; direct scale rejects unrelated table/frame/row/cell owners.
- Drive acceptance from a table of untouched producer outputs, not handcrafted approximations. The selftest must build
  raw call-model/layout-program cases spanning every relevant call kind and all reachable applied, unresolved, rejected,
  conditional, and unreachable branches. It must pass each result directly to scene projection and assert exact retained
  siblings/evidence. Mutation coverage removes each required field and adds every forbidden optional payload so a schema
  cannot become broad again. Handcrafted fixtures may supplement, but never replace, the raw branch oracle.
- Recognize real unmaterialized `addRow` nodes exactly. `finishProgram` marks a no-kernel row node `refused` while the
  owning `addRow` operation remains unresolved. Permit that literal node status only under the existing exact
  no-kernel/no-row-index/no-cells/no-reciprocal-table-membership/single-unresolved-operation constraints; keep it outside
  scene geometry. Known-table and ownerless dynamic rows from untouched producer output must remain partial, while every
  materialized, dangling, cross-owner, or hybrid variant refuses.
- Close zero-state effect folding. Reconstruct and compare the exact `stateAfter` for every deterministic cell creator
  (`createText`, `createButton`, `createEditBox`, `createIcon`) from its own owner and source-known input facts, just as
  `setColSpan` is replayed. A later creator may not absorb specialization from a preceding unresolved zero-state call.
  Add a permanent negative that skips unresolved text then forges the text effect into the following button transition.

The next fail-first run must add raw positives for every source-valid non-kernel partial branch, the real `refused`
unmaterialized row status, and the folded-cell-effect/forged-payload negatives before production changes. Preserve all 96
legitimate tests, correct handcrafted tests that contradict raw producer status, and report the expanded count. The
complete dependency/type/lint/boundary/hash matrix plus another fresh independent producer sweep is mandatory. Batch
6B/6C and every browser/game claim remain blocked; `Not verified in game` is unchanged.

### Seventh independent-review correction (2026-08-11)

The `101/101` sixth-correction candidate is also rejected. The previous plan incorrectly counted 18 relevant calls;
`X4UiRelevantCallName` contains 17. The kind switch is compile-time exhaustive for those 17 names, but a kind-only switch
is not exhaustive over each kind's producer-reachable branches and per-field gap outputs. The reviewed hashes were
`73990855348B84CE26AFDC4E58EB484080CAE9ECD919DFF573FE591ED89989F7` and
`41A1584F8A5F10A8AA1414F7FE204456F4F9D3F6F49E935338B5A9934FEEE8AB`.

- Replace hand-selected branch coverage with a differential raw producer matrix. For each of the 17 calls, vary every
  source input/property that the accepted producer resolves, one field at a time, across static, dynamic, invalid,
  conditional, and unreachable forms where supported. Assert the untouched producer result and operation facts first;
  every producer `projected`/`partial` result must remain non-refused at scene, while producer `refused` remains refused.
  This matrix must include dynamic width index/scaling, percent-width index, addTable reserve/scaling, creator x/width,
  setText x, non-Helper direct scales, and all rejected kernel branches. A kind-presence assertion is insufficient.
- Reconstruct each operation's exact linked-gap multiset from its branch evidence. Compare category, status, exact reason,
  source location, optional expression, node ID, operation ID, and cardinality. Reject duplicate gaps, changed source or
  status, cross-kind categories, and loose reason/descriptor pairings. Legitimate producer categories such as
  `index`, `options`, and `width` must not be omitted.
- Make owner validation status-specific and ancestry-complete. `OpenMenu` never owns a frame; unresolved `display` has no
  frame; applied frame/display/setter/row/span/creator branches require their concrete producer owner. When a cell is
  unavailable but table+row survive, require the claimed table to equal the retained row's table. Keep exact ownerless
  unresolved evidence but reject cross-table ancestry and every added owner.
- Validate rejected kernel transitions exactly. Permit the producer's `refusal.state` field only when it is the unchanged
  state and equals the transition's accepted before/after evidence; reject missing, extra, or mismatched state. Recognize
  the exact rejected unmaterialized-row node alongside the unresolved form. Add raw rejected width/row/span/creator
  positives and mutations.
- Reconcile pre-final table height with `getFullTableHeight(state)` instead of forbidding known height before
  finalization. An untouched empty pre-final table with known height zero must project, while a mismatched height refuses.
- Remove creator replay fallback. Deterministic `createText`, `createButton`, `createEditBox`, and `createIcon` transitions
  require the producer metadata and descriptor facts needed for exact `specializeCell` replay, then compare the complete
  replayed state. Stripping semantics/facts must refuse; no target-cell-only comparison may admit a folded prior effect.
- Validate complete local-expansion authority, not shape alone. The program expansion object must have the exact producer
  schema and reciprocal limits, invocation/catalog/selection membership, ancestry, and operation IDs. An operation cannot
  carry expansion when program authority is absent; unknown keys and minimal forged expansion objects refuse.

Add these seven families fail-first while preserving the 101 legitimate tests. The pre-fix run must show the new raw
positives and adversarial mutations failing for the reproduced reasons. Production changes remain confined to
`x4UiScene.ts`; test changes remain confined to its selftest. Rerun the complete focused/dependency/type/lint/boundary
matrix and require a seventh fresh independent raw differential sweep before accepting Batch 6A. No downstream pipeline,
paint, UI, browser, deploy, or game work may start; every output remains `Not verified in game`.

### Eighth independent-review correction (2026-08-11)

The seventh-correction candidate is also rejected despite a marker-free `108/108` scene suite and a green focused
dependency/type/lint matrix. The independently reviewed hashes were
`17705C27D35231DBB637FD191E0E7A817F7E977F2A260B08AF06B819590433CF` for `x4UiScene.ts` and
`974C9468621C9956FFD04F2B703DA89EA6C8855BBE0CAC129008C01E8B113F72` for its selftest. The eighth audit made no
writes and reproduced six remaining correctness defects:

1. **P1 — source-valid producer fields falsely refuse.** The scene re-derives gap categories heuristically from
   descriptor keys instead of consuming exact per-kind/per-field producer evidence. An independent 122-case field
   sweep retained 121 intended branches and found 50 false refusals, including dynamic frame width, table y/column
   count, row scaling, creator fontsize, setText font, and scaleX enablement. Replace heuristic category inference with
   exact producer-issued branch/field evidence; permanently cover every producer-resolved field across all 17 calls.
2. **P1 — selected local expansion falsely refuses.** Catalog `invocationIds` use source-invocation IDs while scene
   validation compares invocation-instance IDs. Resolve catalog membership through `invocation.sourceInvocationId`,
   then require reciprocal catalog, selection, invocation-instance, ancestry, and operation membership. The positive
   must be untouched producer output with an actual selected branch, not only a top-level expansion.
3. **P1 — blocked addRow is misclassified as materialized.** Conditional/unreachable producer rows have no row index,
   kernel row, or cells, but the scene recognizes only rejected/unresolved unmaterialized rows. Admit the exact blocked
   producer shape under strict no-kernel/no-index/no-cell and reciprocal-link constraints; add both conditional and
   unreachable all-kind raw positives.
4. **P2 — creator replay accepts stripped or contradictory facts.** Requiring any semantic/fact field is insufficient.
   Enforce the exact per-creator descriptor/semantic schema and reconcile every overlapping value with operation kind,
   replay input, source facts, and resulting cell. Mutated `contentKind`, height, content, partial semantics, and removed
   non-replay facts must all refuse for text, button, edit-box, and icon.
5. **P2 — linked gaps are not an exact ordered multiset.** Individual supplied-gap validation accepts deletion and
   reversal. Reconstruct the complete ordered producer gap list and compare category, status, reason, source,
   expression presence/value, node ID, operation ID, cardinality, and order. Permanently test omission, duplication,
   reordering, and every field mutation.
6. **P3 — continuity cannot detect an omitted real no-op operation.** State continuity and final-state equality cannot
   prove operation-ledger completeness when a source operation has `stateBefore == stateAfter`. Add producer-issued
   complete call/operation manifest authority or digest and require exact membership/order; removing a repeated real
   width call and its reciprocal IDs must refuse.

The same audit independently confirmed three earlier repairs: pre-final empty-table height zero projects while a
mismatch refuses; exact rejected transition/refusal state mutations refuse; and tested OpenMenu/display/table-row owner
schemas are closed. It also confirmed the permanent `Not verified in game` boundary and found no debug/import/hash drift.

The next fail-first expansion must add permanent raw producer coverage for all 121 retained differential cases, a real
selected local-expansion positive, both blocked addRow statuses, complete creator-schema mutations, complete ordered-gap
mutations, and an omitted no-op operation attack before production changes. The pre-fix suite must fail for all six
reproduced mechanisms.

Reconciliation changes the implementation boundary: the accepted layout program has no independent complete call/gap
manifest, so scene-local continuity cannot prove that an unchanged source operation is present, and scene-local
descriptor-key heuristics cannot reconstruct the producer's exact gap language. This independently reproduced contract
gap permits a bounded update to the previously frozen producer. Implement the correction in two sequential sub-batches:

- **8A — producer evidence authority:** edit only `x4UiLayoutProgram.ts` and its selftest. Add an immutable,
  JSON-serializable, source-ordered manifest built from the selected/expanded producer call stream, not reconstructed by
  the scene. It must provide a complete one-to-one call/operation ledger and the exact ordered linked-gap evidence needed
  to distinguish omission, duplication, reordering, blocked calls, rejected calls, and no-op transitions. Existing
  program consumers remain compatible only through an explicit schema update; no ambient registry, hidden brand,
  parser rerun, filesystem lookup, or scene-generated digest is allowed. Independently review and freeze exact hashes.
- **8B — scene consumption:** edit only `x4UiScene.ts` and its selftest after 8A is accepted. Require exact manifest
  bijection and ordered gap equality, remove heuristic gap-category reconstruction, then fix selected expansion,
  blocked-row, and exact creator-schema validation against producer-issued evidence.

Rerun the full focused/dependency/type/lint/boundary matrix after each sub-batch and require a ninth independent audit over
the final four exact hashes. Batch 6B/6C and all UI/browser/game work remain blocked.

### 8A independent audit and explicit trust-boundary correction (2026-08-11)

The first 8A manifest candidate is rejected. It was locally green at `92/92`; reviewed hashes were
`0BC43268F9B4D838E9B3410139F28B20B6E0EF668F5CE24A36D9D9CD44A42B90` and
`0C9FA7739078C4078F251E17F156960E4C02270D20E5BF18C109703FE71676A0`. The independent audit reproduced:

- **P1:** coordinated deletion, reindexing, reordering, or duplication across the program and its embedded mirrored
  manifest can still validate; coordinated gap deletion/reversal/field mutation also validates. The call ledger is
  source-seeded, but operation and gap authority is reconstructed from the mutable final arrays.
- **P2:** selected local-expansion evidence does not require reciprocal invocation, selection, catalog, ancestry, and
  operation membership; forged or stripped source-invocation/instance evidence validates.
- **P2:** nested source schemas and numeric domains are not closed; fabricated reachability, empty identities, negative or
  unsafe positions/order, unknown nested keys, and `Infinity` can validate. `JSON.stringify` success is not lossless
  round-trip proof.
- **P3:** permanent rejected-operation coverage uses unresolved branches for most creator/span/width cases even though the
  independent raw rejected family passes production behavior.

The trust model is revised explicitly. An unsigned, self-contained, serializable snapshot cannot prove its own source
completeness after an arbitrary caller coherently rewrites every copy of the authority. Do not add more mirrored ledgers,
an embedded secret, a hidden registry, or a cosmetic digest and call that proof. Instead:

- Move evidence authority out of `X4UiLayoutProgram` into a separate required success-result sibling produced in the same
  projection call. Build it independently from the selected/expanded source-call stream and append-time operation/gap
  events. The program remains the candidate; the separately held frozen authority is the comparison source.
- Export a pure exact validator over `(program, evidenceAuthority)`. Scene 8B must consume the successful producer result
  or both exact objects, not a program alone. One-sided and mirrored mutations of the program must refuse against the
  unchanged authority; mutations of authority must refuse against the unchanged program.
- The authority object is trusted only when it is the original deeply frozen output of the accepted producer invocation.
  A JSON clone remains useful for diagnostics/round-trip checks but is not authenticated source proof. Coordinated
  malicious replacement of both program and authority is explicitly outside this static preview boundary; closing it
  would require source re-analysis or an external signer, neither of which belongs in the scene layer.
- Close every authority schema recursively: exact keys, finite safe non-negative positions/orders, non-empty deterministic
  source-derived IDs, exact status/reachability mapping, exact operation/call identity, and lossless JSON round trip.
- Validate selected expansion through exact source-invocation versus instance namespaces and reciprocal catalog,
  selection, invocation, ancestry/depth, and operation links. Add real rejected width/row/span/four-creator fixtures.

The revised fail-first suite must include the reproduced one-sided and coordinated-within-program attacks while holding
the separate authority unchanged, plus independent authority mutations while holding the program unchanged. It must not
claim resistance to coherent replacement of both trusted inputs. A fresh independent 8A audit must accept this bounded
trust contract before scene 8B starts.

### Second 8A independent-audit correction (2026-08-11)

The corrected separate-authority candidate is also rejected despite a locally green `101/101` suite. Reviewed hashes
were `FFA53D588ADB1B4C9D98DD871D84493F3DB2B8EBE6CA8B24331EA61B11F0D5FD` and
`D88F10679999206A3BCE2CDC5D13EDF8481ABF5A6E0DCA9BB6751926648982A7`. The audit confirmed static all-kind,
repeated no-op, one-sided operation/gap mutation, blocked sweeps, actual rejected behavior, recursive basic schema checks,
freeze/detachment, and refusal-result shape. It reproduced five remaining defects:

1. **P1 — expansion ledgers are not paired.** Authority selections/invocations are validated internally but not compared
   exactly with `program.localExpansion.previewPathSelections` and `.invocations`; complete invocation fields such as
   `resolution` are absent. Program-side deletion/forgery and authority-side additions/forgery can pass. Compare the exact
   ordered complete selection and invocation records in both directions, then apply reciprocal catalog/operation checks.
2. **P2 — reciprocal node operation membership is unauthenticated.** Removing or duplicating operation IDs in frame,
   table, row, or cell ledgers passes with authority unchanged. Record append-time node/metadata-ledger membership in the
   authority or derive one exact per-kind mapping; enforce uniqueness, exact membership, and no unrelated claims.
3. **P2 — reachability mapping is not exact.** Applied/rejected/unresolved calls can be changed to `conditional` or
   `unreachable`. Derive exactly one expected value: conditional status maps to conditional, unreachable maps to
   unreachable, every other status maps to reachable.
4. **P2 — freeze is incorrectly represented as origin authentication.** A recursively frozen JSON clone validates as
   `producer-frozen` because grade is caller-supplied and `Object.isFrozen` proves only immutability. Remove the serializable
   producer-origin grade and any claim that pure pair validation authenticates origin. Pair validation is structural;
   deep-freeze is an immutability check. Trusted producer provenance exists only in the internal call path that directly
   receives `projectX4UiLayoutProgram`'s success result. A structurally equal frozen clone may validate structurally and
   must not be relabelled as authenticated.
5. **P3 — the permanent rejected-family test accepts unresolved substitutes.** Add real static rejected width, row, span,
   text, button, edit-box, and icon sources and require `status === "rejected"` plus exact refusal-state and authority
   identity for every case.

The next fail-first run must add both program-side and authority-side expansion mutations, frame/table/row/cell ledger
removal/duplication, both wrong reachability enums for every non-blocked status family, the frozen-clone truth-label test,
and all seven real rejected cases. Keep 8A writes confined to the producer pair and require another independent audit
before scene 8B.

### Third 8A independent-audit correction (2026-08-11)

The `105/105` producer candidate at hashes
`213A5752A9D1214A63189E814544674EA46ED0643A0820E647646E1DC9AF31C2` and
`C7F77FA85FCE34CEE4DF5FB7E0341D8E5422AEC24AE545EC1A79B6D44D734CF1` corrects all five prior defects.
Independent raw probes confirmed 71 core one-sided attacks and 52 selected-expansion attacks refuse; intact all-kind,
blocked, ownerless, unresolved, seven-family rejected, and structurally frozen-clone inputs pass under the documented
structural-only trust boundary. One P3 fail-closed defect prevents acceptance:

- `validateX4UiLayoutEvidence` validates `operations` and `gaps` before constructing node owner maps, but does not first
  require `frames`, `tables`, `rows`, and `cells` to be arrays of valid object entries. A null collection throws on
  `.map()` and a null entry throws on `.id` instead of returning `{ valid: false }`.

Add permanent null/non-array/null-entry attacks for all four node collections before production correction. Close the
node collection and entry shapes before any mapping or dereference and return the validator's normal structural failure.
Do not weaken the now-green expansion, node-ledger, reachability, rejected-family, operation/gap, or trust semantics.
Rerun the focused matrix and one final independent 8A audit before scene 8B.

### Final 8A acceptance checkpoint (2026-08-11)

Status: `FOCUSED-ACCEPTED / CLEAN`; this accepts and freezes only the producer evidence-authority boundary. Overall B119
remains `PARTIAL` and `Not verified in game`. The accepted hashes supersede the earlier frozen `84/84` producer:

- `x4UiLayoutProgram.ts`: `2CBD9E11DFCC89A0C8D8A973A4801780F534556AC154E791678C39E3C4856F34`.
- `x4UiLayoutProgram.selftest.ts`: `AFF8919803EA70AAF90F3F863EB6DD031AA20774BB0DB05F230112B382CA7D3E`.

Fail-first was `105/109`: all four malformed-node collection families failed before the guard. The corrected suite is
`109/109`. The final independent audit returned `CLEAN`: 28/28 malformed frame/table/row/cell collection and entry
attacks returned `valid:false` with zero throws; 71/71 core one-sided attacks and 52/52 selected-expansion attacks were
rejected; and intact all-kind, repeated no-op, dynamic-gap, blocked, seven-family rejected, ownerless/partial, and frozen
clone structural controls passed. Call model `46/46`, kernel `29/29`, source-bundle `PASS`, repository typecheck, exact
owned-file ESLint, import/debug/origin/registry/crypto/network scans, hashes, and whitespace checks were green.

The accepted trust claim is deliberately narrow: pair validation proves structural agreement, while deep-freeze proves
immutability only. Trusted producer provenance exists in the direct internal success-result call path. Proxy/getter
behavior and coherent replacement of both unsigned inputs remain out of scope. Scene 8B may now consume the required
successful producer result and its separate evidence authority; it may not restore bare-program or scene-reconstructed
authority.

### Scene 8B interim checkpoint — exact corpus green, contract still rejected (2026-08-12)

Status: `IN_PROGRESS / PARTIAL`. The current scene candidate is locally green at `115/115`, with SHA-256
`69412F26E211FE2E573309AD621F57DE588EAAEFC15107F5E8C5C0AC7934EA29` for `x4UiScene.ts` and
`9FCA718D279B07E2D62B6C6C4435B99C58913D61D67359EC43A0F7ACAE37BC2D` for its selftest. The accepted producer
hashes remain unchanged. The permanent differential test now uses the exact original eighth-audit matrix recovered from
local session evidence: 122 cases generated, 121 retained, 110 unresolved, 11 rejected, with exact per-kind allocation.
The focused dependency matrix, repository typecheck, and owned-file ESLint are green. Three stale remembered selftest
aliases first produced module-not-found failures; the actual corpus-assets, keep-outs, and lint entrypoints then passed.

This candidate is not accepted. Coordinator review found that public input correctly requires a successful producer
result and validates its separate authority before geometry, but unmaterialized-row validation still calls
reason/category reconstruction helpers. That contradicts the explicit 8B requirement above to remove heuristic
gap-category reconstruction. Exact agreement for today's 121 retained branches does not justify a scene-owned parser for
future producer reason strings. The ninth audit later returned `FINDINGS`; the two-file correction is now assigned to the
scene Luna worker. Pass the accepted authority into structural validation, consume its exact ordered operation/gap
ledgers, remove the reconstruction helpers, retain the 122/121 census, and rerun the full focused matrix and a fresh
independent audit. Batch 6B/6C and browser/game claims remain blocked; `Not verified in game` is unchanged.

The completed audit reproduced a P1 acceptance escape that rejects this candidate independently of the
heuristic issue. Deeply frozen producer results remained pair-valid after scene-consumed creator facts were altered:
forged cell text reached visible scene output, removal of the creator operation fact still produced a scene, and a
coordinated operation/cell text change also reached output. The current creator replay validates kernel geometry from
operation facts but does not reconcile every overlapping cell fact consumed by the scene against the exact creator
operation, semantics, and resulting cell. Separate pair-valid mutations changed cell `outerX` and `outerWidth`, and the
emitted widget geometry changed with them; changing the cell source location also changed emitted provenance. Kernel
reconciliation presently covers y/height/type/scaling but does not establish every scene-consumed x/width/source fact.
Representative pair-valid frame x/y/width/height/layer and table x/y/maxVisibleHeight mutations also changed accepted
geometry, layer, clipping, visible height, or scrollbar-band output. Existing reserve/finalWidth, row, and span checks
correctly refused their sampled mutations and must remain unchanged.

A separate P2 finding reproduced a production compatibility bypass: a real no-op `setColSpan` result remained pair-valid
and scene-accepted after its metadata was reduced to empty arguments/semantics and its operation facts to only `span`.
The producer always supplies the real cell/span semantics in this branch. Remove the compatibility path and require exact
producer metadata, facts, ownership, and replay; handcrafted fixture support may not weaken production.

The permanent negative suite did not prove this path: its supplied-program
helper sends a bare `X4UiLayoutProgram` to the new wrapper-only API, so 77 calls across 31 negative-test blocks refuse at
the public wrapper gate before their named mechanism; some direct `as never` calls do likewise. Preserve exactly one
explicit bare-program refusal test. For every pair-boundary attack, assert the exact pair-invalid result; for every deeper
scene attack, build a deeply frozen real producer result, assert the pair remains valid, and only then require the scene
to refuse. The correction must close creator fact removal/forgery for all four creator kinds, reconcile every consumed
descriptor/provenance family, and migrate the broader negative oracle before any new local green count can be considered
evidence.

The independent positive evidence remains useful and exact. The original payload hash is
`C7E01825FDB78E8B5FF14892920A7196C92633CA53B7195D5CA15174425BF72F`; all 122 generated producer wrappers and
evidence pairs were valid, the 121 retained branches preserved the exact 110 unresolved/11 rejected and per-kind census,
zero intact branches falsely refused, all 122 bare programs refused, and 41/41 malformed/authority cases refused with
zero throws. Scene `115/115`, producer `109/109`, call model `46/46`, kernel `29/29`, font `10/10`, text `8/8`, corpus
`28/28`, keep-outs `16/16`, linter `112/112`, source bundle, typecheck, and owned ESLint passed. The scene and selftest
hashes stayed at the rejected values above and both producer hashes remained frozen. This proves current producer branch
coverage, not the pair-valid descriptor integrity that failed.

The `FINDINGS` checkpoint is synchronized and read back in GitHub #41 comment `5262730559`, Notion page
`3b84618e-d15b-8190-821e-c0eb96f43d5a`, and Drive doc
`17VLaIsT499KHg7zg30hOyLaBXB0-9jlrX3dQ63s3dtE`. All three projections state `IN PROGRESS / PARTIAL`, preserve the
rejected hashes and five rejection reasons, and say `Not verified in game`; repository Markdown remains authoritative.

### Scene 8B ninth-findings correction candidate — focused green, audit pending (2026-08-12)

Status: `IN_PROGRESS / PARTIAL`. The two-file correction is frozen for a fresh independent review at:

- `x4UiScene.ts`: `6F7623123EEA79E8D41DF94EE0093F3ABDFAC8EE9FF159DAA124EA6F2FD4E2EF`.
- `x4UiScene.selftest.ts`: `5CED7BE87648CA08165052DF09A45449034793E6DC19CB66CC3C22B78AC01453`.

The correction removes scene-owned reason/category reconstruction and the source-incomplete setColSpan fallback; uses
the producer authority for unmaterialized-row state; reconciles frame/table/row/cell and creator/source facts; validates
identified-cell source assignment; distinguishes explicit nonzero scaled source width from the Helper 5372-5388
zero/omitted-width branch; and accepts finalized text/edit-box `affectRowHeight` only when the kernel value and Helper
5432-5469 pin agree. Pair-invalid tests now call the real public entry with a real producer authority, scene-internal
attacks first prove their frozen producer pair remains valid, and exactly one bare-program wrapper control remains.

The exact differential census is unchanged: `122 generated / 121 retained / 110 unresolved / 11 rejected`. Fresh bounded
validation passed: scene `117/117`, producer `109/109`, call model `46/46`, kernel `29/29`, font `10/10`, text `8/8`,
corpus `28/28`, keep-outs `16/16`, linter `112/112`, source bundle `PASS`, repository typecheck, owned-file ESLint,
import/debug/heuristic scans, whitespace, and diff checks. Producer hashes remain
`2CBD9E11DFCC89A0C8D8A973A4801780F534556AC154E791678C39E3C4856F34` and
`AFF8919803EA70AAF90F3F863EB6DD031AA20774BB0DB05F230112B382CA7D3E`.

This is not acceptance. One final test-helper refactor briefly produced `TS2339` before correction, so the AAR remains
triggered. The independent reviewer must reproduce all prior pair-valid escapes, inspect the explicit-width and
finalization transforms directly, audit the pair-invalid/pair-valid negative census, rerun the exact matrix, and return
`CLEAN` before Batch 6B/6C begins. Browser, installed-host, deploy, C++ frame acceptance, and X4 experience gates remain
open; every result remains `Not verified in game`.

### Scene 8B `117/117` correction audit — FINDINGS and reconciled repair (2026-08-12)

Status: `IN_PROGRESS / PARTIAL`; the candidate above is rejected. The independent reviewer made no repository writes and
confirmed all four reviewed hashes remained byte-identical. The exact `122 generated / 121 retained / 110 unresolved /
11 rejected` matrix passed with all 121 intact wrappers accepted, all 121 bare programs refused, and no unexpected matrix
failure. Every declared focused dependency, type, lint, import, debug, whitespace, and hash gate also passed. Those green
results do not override four independently reproduced defects:

1. **P1 — scene-consumed state is not completely bound to the unchanged authority.** The authority operation ledger
   covers identity/order/status/ownership/reason but omits `descriptorFacts`, `metadata`, and kernel transition payload;
   non-exact fact checks also omit provenance, expression, source, and source pins. With the authority unchanged and the
   pair validator still returning valid, coherent operation-plus-node frame/table/creator changes altered scene output;
   secondary text font/size/alignment/x/y and source-offset changes escaped; and replacing an unavailable text/edit-box
   `affectRowHeight` operation fact with the finalized cell fact bypassed the unavailable-source branch.
2. **P1 — intact scaled creators falsely refuse.** At `uiScale=2` with effective scaling, all four creator kinds carry
   raw operation `outerHeight=10` and finalized cell `outerHeight=20`. The scene compares those values directly instead
   of replaying the producer scaling/finalization and refuses the valid projected pair as `malformed-structure`.
3. **P1 — omitted-width overflow disagrees with shipped Helper.** For span width `40` and scaled x `50`,
   `helper.lua:5372-5388` returns `-10`; the producer clamps to `0`; the scene recomputes `-10`. A text-only exception
   accepts the fabricated zero while edit-box/button/icon refuse. No creator kind may receive a hidden clamp or special
   compatibility path. Preserve the exact Helper result; if a negative width is not drawable, retain the exact evidence
   and return one uniform partial/unavailable geometry result rather than inventing zero or falsely refusing the whole
   source-valid program.
4. **P3 — the negative oracle still overclaims scene-internal coverage.** AST census found 79
   `sceneFor(fixture, program)` negative calls across 32 blocks that deliberately create a pair mismatch and therefore
   stop at the public pair boundary before their named scene predicate. Only six direct pair-valid mutations plus 24
   creator-loop mutations across two blocks exercise scene internals; exactly one bare-program boundary control remains
   valid. Pair-boundary and scene-internal suites must be separated and named honestly.

Reconciliation changes the implementation boundary. The accepted 8A structural-only trust claim remains valid for the
fields it covers, but it is insufficient for the scene consumer and is reopened as a sequential four-file contract repair:

- **8A.1 producer authority repair:** only `x4UiLayoutProgram.ts` and its selftest. Extend the separately frozen authority
  with exact immutable snapshots of every scene-consumed operation and node field, including descriptor facts, metadata,
  kernel/transition evidence, complete source/provenance/expression/source-pin data, and final node geometry/state. Build
  it in the producer path; do not create a scene-owned digest, registry, heuristic, or authentication claim. One-sided
  mutations of any bound field must make the pair invalid while intact projected/partial/rejected families remain valid.
  Remove the omitted-width `Math.max(0, ...)` clamp and preserve exact Helper subtraction with its 5372-5388 pin.
- **8B.1 scene and oracle repair:** only after 8A.1, edit `x4UiScene.ts` and its selftest. Require exact authority equality
  for every consumed field and full fact provenance; replay raw creator heights through the same scale/kernel path before
  comparing finalized cells; handle negative Helper-derived omitted width uniformly as explicit partial/unavailable
  geometry; remove the text-only exception; and convert every intended scene-internal negative to a deeply frozen real
  producer result whose pair validity is asserted before the attack. Keep separately named pair-invalid tests and exactly
  one intentional bare-program test.

Required fail-first evidence includes every independently reproduced escape and false refusal above, all secondary-text
fields, operation/cell affect status, full source/provenance mutations, all four scaled creator kinds, all four
omitted-width overflow kinds, and an AST census that proves no named scene-internal test terminates at the pair boundary.
After each sequential owner finishes, rerun its focused tests plus call model, kernel, font, text, corpus, keep-outs,
linter, source bundle, repository typecheck, owned-file ESLint, import/debug/heuristic scans, hashes, whitespace, and exact
matrix as applicable. A new independent read-only audit over all four final hashes must return `CLEAN` before Batch 6B or
6C starts. Browser, installed-host, deploy, C++ frame acceptance, and X4 experience validation remain pending; the
permanent product state is `Not verified in game`.

Audit AAR: the reviewer's first malformed-input probe imported `X4_LAYOUT_PROVENANCE` from the wrong owner and failed;
the corrected probe imported it from `x4UiLayoutKernel` and passed 54/54 malformed pair cases plus 7/7 malformed wrappers
with zero throws. The failed probe is not acceptance evidence. Highest-risk evidenced weakness remains a green permanent
suite whose negatives stop at an earlier gate while source-valid branches either escape authority or falsely refuse.

Bookkeeping parity was read back after this finding: GitHub #41 comment `5263387897`, Notion page
`3b84618e-d15b-8190-821e-c0eb96f43d5a`, and Drive document
`17VLaIsT499KHg7zg30hOyLaBXB0-9jlrX3dQ63s3dtE` all record the rejected hashes, three P1 findings, 79-call/32-block P3
census, sequential repair, and unchanged `PARTIAL / Not verified in game` state. Repository Markdown remains authoritative.
Capability-map search found no B119/UI-scene acceptance claim to revise, so this finding produces `no capability-map delta`.

### Producer 8A.1 authority-v2 candidate — focused green, scene migration required (2026-08-12)

Status: `IN_PROGRESS / PARTIAL`. The bounded producer repair is implemented only in `x4UiLayoutProgram.ts` and its
selftest. It is locally frozen at:

- `x4UiLayoutProgram.ts`: `0C1BF98C36C9F9C8E4FF0EE8AB37D5450FA086AE4F5DCFE4BB605874E72E4FFB`.
- `x4UiLayoutProgram.selftest.ts`: `2D2DC516F608DC65D486C275D62EC7A9C8CAC695F34ED8E1A4636A44A7E7C55C`.

Authority schema version 2 now carries a complete immutable snapshot for every operation and frame/table/row/cell
ledger entry. The pair validator requires exact snapshot equality in addition to the existing structural ledgers. The
snapshots are built from the final JSON-shaped producer objects and cloned/frozen independently; this still proves only
exact agreement with the producer result supplied to the scene, not authentication against coherent replacement of both
unsigned inputs. The exact structural comparator rejects cycles, distinguishes arrays from records, compares complete
own enumerable key sets, preserves `Object.is` primitive semantics including signed zero, and accepts ordinary or
null-prototype JSON records without treating prototype identity as source evidence. Producer normalization now removes
object properties whose value is `undefined` and maps array `undefined` entries to `null`, so a JSON round trip cannot
erase unbound state while the pair validator still reports exact agreement.

The producer no longer clamps omitted creator width. For span width `40` and scaled x `50`, all four creator kinds retain
the shipped Helper subtraction result `-10`, pinned to `helper.lua:5372-5388`. Permanent negatives cover complete
operation/node snapshots, secondary text fields, metadata, kernel/source/provenance, row and cell state, unknown and
missing nested keys, cycles, signed zero, and symmetric program/authority changes without claiming that the latter can be
authenticated locally.

Focused candidate evidence is green: producer `121/121`, call model `46/46`, kernel `29/29`, font `10/10`, text `8/8`,
corpus `28/28`, keep-outs `16/16`, linter `112/112`, source bundle `PASS`, repository typecheck, owned-file ESLint, and
the required source/import/debug/hash/whitespace scans. Coordinator readback independently reran producer `121/121`,
typecheck, and owned-file ESLint. This is not independent four-file acceptance.

The unchanged Scene 8B suite is now an intentional fail-first migration baseline at `114/117`. Its three failures are
source-relevant: the old text-only negative-width compatibility expectation now reaches `malformed-structure`; six old
"pair-valid scene-internal" mutations are correctly pair-invalid under authority v2; and the old content-kind mutation
likewise no longer crosses the public pair boundary. Scene 8B.1 must reclassify those boundary tests, construct coherent
pair-valid internal probes only where the intended scene predicate is still meaningful, replay scaled creator heights
through producer finalization, and represent exact negative width uniformly as partial/unavailable drawable geometry
without refusing the whole source-valid program or inventing zero.

AAR triggers: producer implementation required several fail-first corrections; an initial typecheck exposed helper
narrowing errors; one patch context and two shell/scan attempts failed; the first comparator revision mishandled arrays
and null-prototype records; and coordinator review caught a final `JSON.stringify` erasure hole before this checkpoint.
All corrected gates above were rerun. Highest-risk evidenced weakness remains a green pair boundary whose tests can
silently stop before the named consumer predicate. A fresh independent audit over the final producer and scene hashes is
still mandatory before Batch 6B or 6C.

### Producer 8A.1 targeted audit — FINDINGS; candidate rejected (2026-08-12)

Status: `IN_PROGRESS / PARTIAL`. A read-only independent audit verified both producer hashes stayed byte-identical and
reran the permanent selftest at `121/121`, but reproduced two P1 schema failures. The locally green 8A.1 hashes above are
rejected as an acceptance checkpoint:

1. **P1 — unchecked program regions accept malformed/non-JSON one-sided mutations.** With the original authority
   unchanged, deeply frozen mutations adding an unknown program-root key; deleting required `status` or `profile`;
   adding root/target/profile cycles; inserting function, symbol, bigint, or `undefined` values; setting
   `profile.metrics.uiScale` to `NaN`/`Infinity`; replacing metrics with an array; or making
   `previewSampleBindings` sparse returned `valid: true` without throwing. The authority has a closed top-level schema
   and JSON round trip, but the complete program does not.
2. **P1 — exact snapshot equality is not snapshot schema validation.** Coordinated malformed changes to program
   operations/nodes and their authority snapshots returned `valid: true`: missing operation metadata, unknown operation
   keys across all 18/18 operations, malformed descriptor facts, object-valued metadata arguments, array-valued or
   missing node descriptor facts, and unknown node keys across all 12/12 frame/table/row/cell nodes. Complete snapshots
   are present and ordered, but malformed matching shapes remain accepted.
3. **P3 — permanent tests stop at mismatch evidence.** Existing cycle/snapshot negatives mutate one side and therefore
   prove mismatch detection, not closed-schema validity when both compared snapshots carry the same malformed shape.
   There is no program-root non-JSON regression.

The audit separately confirmed correct coverage and failure behavior: operations `18/18`; frames `1/1`; tables `1/1`;
rows `2/2`; cells `8/8`; all original snapshots matched; all 18 one-sided program and authority operation mutations and
all 12 one-sided program and authority node mutations refused; coordinated cycles, nested `undefined`, non-finite
numbers, signed zero, and sparse snapshot arrays refused through exact comparison or the authority JSON round trip; no
probe threw. Plain/null-prototype JSON-equivalent records and acyclic shared-reference aliases remained valid by design.
The reviewer made no repository writes and cleaned no temp artifact because the harness ran through stdin.

Reconciliation reopens the producer before Scene 8B.1 can finish. The next bounded producer-only correction must validate
the complete program's closed top-level/nested JSON schema, rejecting cycles, non-JSON values, unsafe numbers, sparse
arrays, missing/unknown keys, and wrong collection kinds before pair comparison. It must also validate every operation,
node, descriptor fact, metadata object, transition/kernel payload, and nested collection against an exact schema before
snapshot equality. It may reuse shared validators and the already-complete snapshots; it may not add a second parser,
digest, registry, authentication claim, or scene-owned workaround. Permanent regressions must include every reproduced
one-sided program-root and coordinated malformed-snapshot case. The interrupted scene worker preserves its current two
owned-file checkpoint but performs no further work until this producer repair is green and independently re-audited.

The interrupted Scene 8B.1 checkpoint is explicitly unaccepted at scene source hash
`73D97D2E965B58BECC6280B64AAC535EA2FCE30BCA5FE2DE00EC35F99983C246` and selftest hash
`2E8C3D698E66C23BB805913ACB1805D817241C3EDAA8E9E0D0D105D6FBCAFB10`. Before interruption, the worker implemented
producer-scaled outer-height and explicit-width reconciliation, uniform Helper-pinned negative-width
partial/unavailable widget geometry for all four creator kinds, pair-boundary reclassification, and new scaled/four-kind
overflow fixtures. The original baseline was `114/117`; an intermediate correction reached `117/117`; the latest state
after adding the new fixtures was interrupted before a result. Therefore neither the current count nor those hashes are
acceptance evidence. No further scene test or edit ran after the freeze instruction.

Bookkeeping parity for this rejection was read back from GitHub #41 comment `5263982520`, Notion page
`3b84618e-d15b-8190-821e-c0eb96f43d5a`, and Drive document
`17VLaIsT499KHg7zg30hOyLaBXB0-9jlrX3dQ63s3dtE`. All three record both P1 mechanisms, the P3 oracle gap, rejected
producer hashes, frozen unvalidated scene hashes, producer-only next unit, and `PARTIAL / Not verified in game`.
Repository Markdown remains authoritative.

### Producer 8A.2 closed-schema correction — rejected by independent re-audit (2026-08-12)

Status: `FINDINGS / PARTIAL`. The rejected producer-only hashes are:

- `x4UiLayoutProgram.ts`: `85B57D010BE2408455CC17866DF486B852AEE63B4B860DB94BB94D0CE64FA1B9`.
- `x4UiLayoutProgram.selftest.ts`: `BFFAE765C98591AA01724FE879CC09B2276D1311930E8726831D96F8288BAC60`.

The worker first preserved the old `121/121` baseline, added 50 permanent regressions, and reproduced exactly 50 new
failures at `121/171`. The correction now passes `172/172`. It adds cycle-safe closed JSON-domain validation plus
recursive program, authority, operation, node, snapshot, metadata, descriptor-fact, kernel, gap, sample, and expansion
shape validation before exact pairing and JSON round-trip checks. Every originally reproduced program-root and matching
malformed-snapshot attack now returns a stable `program schema is invalid:` or `authority schema is invalid:` result
without throwing, including all 18 operation and 12 node unknown-key placements. The Helper-derived `-10` omitted width
and structural-only/no-authentication trust boundary remain unchanged.

Worker-focused gates passed: producer `172/172`, call model `46/46`, kernel `29/29`, font `10/10`, text `8/8`, corpus
`28/28`, keep-outs `16/16`, linter `112/112`, source bundle `PASS`, repository typecheck, zero-warning owned ESLint, and
owned diff/whitespace/newline/debug/import scans. Coordinator readback independently confirmed all four hashes, reran
producer `172/172`, repository typecheck, and zero-warning owned ESLint; the frozen scene hashes remained unchanged.

The first cross-owner integration baseline is red at `104/119` with 15 failures. Thirteen failures are valid
call-model/producer outputs refused at the scene boundary because the candidate closed schema rejects real
`metadata.semantics` members, including `fontsize` and edit-box data. The other two are the still-unaccepted Scene 8B.1
scaled-height and four-kind negative-width assertions. Command: `npx.cmd tsx src/lib/x4UiScene.selftest.ts`; exit `1`
under Node `v24.15.0` on
2026-08-12. This is direct evidence that isolated producer `172/172` is insufficient and that the current producer
hashes cannot be accepted without correction and a fresh integration rerun.

The independent re-audit returned `FINDINGS`; all four producer/scene hashes remained exact and the reviewer wrote no
files. The correction does close all 15 original one-sided root attacks and all 37 original coordinated
operation/node attacks, with zero throws. Expanded ordinary structural attacks were `24/24` refused,
expansion/authority collection attacks were `16/16` refused, and nested non-JSON/unsafe/sparse attacks were `7/7`
refused. Intact all-kind, partial, sampled, rejected, blocked-expansion, selected-expansion, JSON-clone,
null-prototype, shared-alias, and exact Helper `-10` families remained pair-valid.

It is nevertheless rejected for two P1 mechanisms, one P2 compatibility defect, and a P3 permanent-test gap:

- **P1 false refusals:** intact producer results carrying `semantics.fontsize`, `semantics.editBox`, the complete local
  parameter identity, the complete local invocation-result identity, or a Lua `nil`/JSON `null` literal are rejected by
  schemas narrower than the exported call-model contracts. The red `104/119` scene integration baseline independently
  exercises the `fontsize`/edit-box branch.
- **P1 false accepts:** coordinated matching malformed program/authority snapshots remain pair-valid for generic
  `rowGroups`/diagnostics, invented cell/value/reference/gap/failure union strings, wrong provenance values, impossible
  transition/refusal combinations, incongruent height/refusal combinations, missing property `sourceOrder`, invented
  `recordType`/`transformed` value keys, truncated parameter identity, and an invented local-result identity.
- **P2 false refusal:** the kernel can produce a legitimate non-undefined row `groupIndex`, but `schemaKernelRow` rejects
  that exported dependency shape. No current raw Lua producer path constructs row groups, so this is a dormant
  dependency-compatibility defect rather than an observed normal-source branch.
- **P3 oracle gap:** the permanent `172/172` suite does not pair-validate the existing descriptor fixture carrying
  `fontsize/defaultText/description` and lacks exact positive/negative coverage for the families above.

The reviewer reran producer `172/172`, repository typecheck, zero-warning owned ESLint, hash/status, whitespace,
import/debug, and `git diff --check` gates successfully. Two oversized stdin setup attempts failed during parsing before
imports or probes and created no files; seven split stdin matrices then produced the findings above. This is triggered
AAR evidence and not acceptance evidence. Producer 8A.3 is assigned to the existing producer owner with fail-first
regressions for every reproduced case. Scene 8B.1 remains frozen until a corrected producer passes fresh re-audit and
cross-owner integration.

Bookkeeping parity for this rejection was read back from GitHub #41 comment `5264568985`, Notion page
`3b84618e-d15b-8190-821e-c0eb96f43d5a`, and Drive document
`17VLaIsT499KHg7zg30hOyLaBXB0-9jlrX3dQ63s3dtE`. All three carry the rejected hashes, closed prior-attack counts,
remaining P1/P2/P3 mechanisms, red `104/119` integration split, active 8A.3 repair, frozen scene, blocked downstream
work, and `PARTIAL / Not verified in game`. Repository Markdown remains authoritative.

Read-only type/schema reconciliation supplied to the audit was independently reproduced:
`X4UiLocalFunctionParameterIdentity` requires `id/declarationId/index/name/source`;
`X4UiLocalInvocationResultIdentity` requires `invocationId/source/expression`; nil literals use `null`;
`X4UiCallPropertyProjection.sourceOrder` is required; and `X4UiValue` does not own the candidate schema's permissive
`recordType/transformed` fields. These are mandatory 8A.3 permanent regressions, not inferred follow-up ideas.

### Producer 8A.3 exact-schema repair — fail-first evidence (2026-08-12)

Status: `IN_PROGRESS / PARTIAL`. Only `x4UiLayoutProgram.ts` and its selftest were assigned; both frozen Scene 8B.1
files remained outside the worker's write scope. The complete permanent schema matrix was installed before production
repair. Against the unchanged rejected 8A.2 producer, the expanded selftest exited `1` at `179/195`, with 16 intended
failures. The red set reproduced false accepts for invented value/reference/runtime enums, `recordType`/`transformed`,
missing property `sourceOrder`, invented gap/cell types, and impossible successful-transition-plus-refusal shapes. It
also reproduced false refusals for intact Lua nil, local invocation-result, row-group, and diagnostic shapes. One
parameter/local-result negative fixture needed a selftest-only pairing correction; it did not weaken the production
schema requirement.

The completed producer-only candidate is locally and coordinator focused-green at `205/205`. Exact candidate hashes are
`956E00392EF26854B1B6AC52759E9C6C4AA8A312A4F181F1C66FCF3C8F17683F` for `x4UiLayoutProgram.ts` and
`78F768A48F420B3C000C2FCA4FF82DE1094A6DF1A2A62986448D0EA12ECF5BE3` for its selftest. Coordinator rerun confirmed
call model `46/46`, kernel `29/29`, font `10/10`, text `8/8`, corpus `28/28`, keep-outs `16/16`, linter `112/112`,
source bundle `PASS`, typecheck exit `0`, owned ESLint exit `0`, and owned `git diff --check` exit `0`. Read-only scene
integration improved from `104/119` to `117/119`; all 13 producer-schema false refusals are closed, leaving only the
two frozen Scene 8B.1 behaviors for finalized scaled creator height and uniform unavailable Helper-negative-width
geometry. Scene hashes remain exactly `73D97D2E965B58BECC6280B64AAC535EA2FCE30BCA5FE2DE00EC35F99983C246` and
`2E8C3D698E66C23BB805913ACB1805D817241C3EDAA8E9E0D0D105D6FBCAFB10`.

The fresh independent read-only re-audit returned `FINDINGS`; all four hashes remained exact and no files were written.
Across 157 successfully executed malformed cases, 140 refused correctly, 17 incorrectly returned pair-valid, and zero
validator calls threw. All prior matrices remained closed: root `15/15`, coordinated operation/node `37/37`, expanded
structural `24/24`, expansion/authority `16/16`, and nested non-JSON/unsafe/sparse `7/7`. Broad intact positives were
`10/10`; all seven real rejected-operation kinds, repaired call-model identities, row-group/diagnostic and height
families, and exact Helper `[-10,-10,-10,-10]` creator widths remained pair-valid.

The candidate is rejected for four mechanisms. **P1:** `schemaValue` checks optional fields individually but does not
enforce emitted status/type/member discriminants; seven impossible static/dynamic/reference/sourceLiteral/reason/symbol
combinations validate. **P1:** kernel schemas admit negative row padding, negative specialized-cell height, row/cell
cardinality drift, and a finalized zero-column table. **P1:** a state refusal binds `refusal.state` to `stateAfter` but
does not require `stateBefore === stateAfter === refusal.state`. **P2:** property source/sourceOrder/line identity is not
correlated with `value.location`; five source-incongruent mutations validate. The permanent `205/205` suite therefore
has a P3 cross-field-oracle gap despite its green result. Producer 8A.4 is assigned with fail-first regressions for all
17 escapes. Scene 8B.1 stays frozen pending correction and another independent audit.

Producer 8A.4 fail-first is now captured against unchanged 8A.3 production: `208/225`, exit `1`, with exactly 17
intended reds. The split is seven value status/type/member escapes, four kernel-domain/cross-field escapes, one rejected
state-continuity escape, and five property/source-correlation escapes. The added positive emitted-signature, kernel, and
source censuses remained green. That fail-first checkpoint was subsequently repaired.

The completed 8A.4 candidate is locally and coordinator focused-green at `225/225`. Exact hashes are
`513557DFA4DEE70162A43E6EEDF57DAB07A1A815D1090D5814D312DE284B476E` for `x4UiLayoutProgram.ts` and
`33CD3D5784E2457356F769C573B631B833B79A936EBDC506BC46E69392F1EEED` for its selftest. Coordinator rerun confirmed
call model `46/46`, kernel `29/29`, font `10/10`, text `8/8`, corpus `28/28`, keep-outs `16/16`, linter `112/112`,
source bundle `PASS`, typecheck/owned ESLint/diff check exit `0`, and frozen-scene integration `117/119` with only the
two named Scene 8B.1 behaviors. Scene hashes remain exact. A fresh independent emitted-invariant re-audit over all four
hashes is active; this is a candidate, not acceptance.

Audit AAR: six behavioral-probe fixtures and one initial PowerShell regex scan failed before usable evidence. They were
excluded from every product count; the reviewer stopped combined probes, switched to bounded split matrices, and
recorded only successful validator executions. This is tool/fixture friction, not product evidence.

#### Producer 8A.4 independent emitted-invariant re-audit and 8A.5 correction contract (2026-08-12)

Status: `FINDINGS / PARTIAL`. The fresh read-only reviewer verified all four frozen hashes before and after and made no
writes. The prior 17 defects are independently closed: value-member `7/7`, kernel `4/4`, refusal continuity `1/1`, and
direct static property/source `5/5` all refused with zero validator throws. Every earlier attack family also stayed
closed: root `15/15`, coordinated operation/node `37/37`, structural call/kernel/height `24/24`, selected
expansion/authority `16/16`, and nested non-JSON/unsafe/sparse `7/7`.

The 8A.4 hashes are nevertheless rejected. Across 154 successfully executed malformed cases, 116 refused and 38
new source-backed emitted-invariant mutations incorrectly returned pair-valid, with zero validator throws:

- **P1, profile `14/14`:** successful `program.profile` accepts zero UI scale, invalid negative dimensions, Helper or
  widget hash drift, changed pinned constants/source lines, invalid local-expansion limits, and border metrics that
  disagree with the Helper pin. The structural schema does not reproduce the normalized successful-profile domains,
  source identities, pins, limits, or kernel/target correlations.
- **P1, kernel `4/4`:** coordinated states accept negative column width, negative column weight, default colspan zero,
  and populated rows while `final=false`; no accepted kernel constructor or mutator emits those states.
- **P2, value signatures `8/8`:** the schema admits static identifier/expression/unknown, dynamic
  function/identifier/table, and unknown function/table even though the frozen call-model constructors do not emit
  those `(status,type)` pairs.
- **P2, nested identity/source `12/12`:** parameter identity `3/3`, local-invocation-result identity `3/3`, direct
  dynamic-property source/location `3/3`, and literal location/sourceLiteral `3/3` accept coordinated drift. Real
  expanded-property location differences remain valid by source-backed design and must not be overconstrained.

Positive evidence stayed intact: broad producer outputs `10/10`, seven real rejected-operation kinds `7/7`, repaired
call-model signatures `6/6`, row-group/diagnostic `2/2`, height `2/2`, exact Helper negative omitted widths `4/4`,
original/frozen-JSON/null-prototype/shared-acyclic topology `4/4`, selected expansion, and expanded-property
compatibility `3/3`. Declared gates were producer `225/225`, call model `46/46`, kernel `29/29`, typecheck exit `0`,
owned ESLint exit `0`, clean boundary/whitespace/diff scans, and frozen scene `117/119` with only finalized creator
scaled height and uniform unavailable Helper-negative-width geometry still red. No producer-schema false refusal
reappeared. Exact rejected hashes remain
`513557DFA4DEE70162A43E6EEDF57DAB07A1A815D1090D5814D312DE284B476E` and
`33CD3D5784E2457356F769C573B631B833B79A936EBDC506BC46E69392F1EEED`; scene hashes remain unchanged.

Producer 8A.5 is the next bounded unit and owns only `src/lib/x4UiLayoutProgram.ts` and
`src/lib/x4UiLayoutProgram.selftest.ts`. Before production repair, install permanent fail-first regressions for all 38
successful malformed cases above and positive guards for every actual emitted signature, valid pre-final zero-row
state, oversized pre-clamp span, negative Helper omitted width, direct dynamic property, literal, local expansion, and
expanded-property compatibility family. Then make the smallest source-backed correction that:

1. validates the exact normalized successful-profile domains, Helper/widget/source pins, local-expansion limits, and
   target/kernel/profile correlations, or snapshots and compares the complete normalized profile without weakening the
   structural-not-authentication boundary;
2. closes kernel column width/weight, default-span, and rows/final invariants while preserving legitimate pre-final and
   pre-clamp states;
3. encodes the exact call-model-emitted `(status,type)` signatures and their required/forbidden members; and
4. binds parameter IDs/names/declarations, local-result invocation/source/expression, all non-expanded property
   locations, and literal source locations exactly as emitted while preserving the documented expansion exception.

8A.5 acceptance requires the original `225/225` suite plus every new regression and positive guard to pass; the
producer, call-model, kernel, font, text, corpus, keep-out, linter, source-bundle, typecheck, owned-ESLint, boundary,
hash, and diff gates to remain green; the frozen scene to remain exactly `117/119` with only its two named behavior
failures; and a fresh independent four-hash audit to return `CLEAN`. Scene 8B.1 remains frozen and Batch 6B/6C remain
blocked until that result.

8A.5 fail-first is captured before any production repair. The expanded permanent suite exits `1` at `228/266` with
exactly the 38 named emitted-invariant assertions red and zero validator throws; all prior 225 checks plus three new
positive guards are green. The production hash remains the rejected 8A.4 hash
`513557DFA4DEE70162A43E6EEDF57DAB07A1A815D1090D5814D312DE284B476E`; the fail-first selftest hash is
`C82A610A68B667394875225E34934B35F0C9C29EB0DF2B246EA72968E8B906D7`. Both scene hashes remain byte-identical.
This is the required causal checkpoint: the test matrix reproduces all four audit mechanisms before validator code
changes.

The first 8A.5 repair candidate reached `267/267` at hashes
`47B840DEF4087C055E688D8361FF21AD2E7A69CDD3126E6BDD4E2B8621674676` and
`D71E3BFA6EBAAC13CE8494020F9AC68EF0E0E7B3A25C339D639DE003A32CC1E2`; focused dependencies, typecheck, owned lint,
and frozen-scene `117/119` classification passed. Coordinator source review rejected this as acceptance evidence before
independent audit. The static-literal regressions target `semantics.properties`, but the audited escape is a direct
operation argument and `schemaValue` still does not bind a direct argument's `sourceLiteral` to `location`. The complete
normalized profile is still absent from the authority; the new truth-grade positive changes only `program.profile`
against unchanged authority and therefore blesses one-sided drift. Expanded property source identity is also checked
only for static values, not every actually emitted expanded status. Finally, parameter declaration and local-result
identity predicates require coordinated internally consistent drift probes before their claimed owning-ledger binding
can be accepted.

A targeted coordinator-review correction is active in the same two owned files. It must capture additional fail-first
evidence against the exact `267/267` hashes, bind the complete normalized profile into the separate authority (or prove
an equally complete exact structural relation), move direct literal equality to the value boundary, apply expanded
source identity to every source-backed emitted status, and either close or explicitly bound the coordinated
parameter/local-result relations from actual constructors. The first `267/267` hashes are unaccepted; no independent
audit has been dispatched against them. Scene 8B.1 remains frozen.

The coordinator-review fail-first is now captured against that exact first repair: `269/281`, exit `1`, with 12
intended reds and all other 269 checks green. The accepted escapes are three direct operation-argument
location/sourceLiteral drifts, five still-domain-valid profile truth/uiScale/scrollbar/container-offset/source drifts,
two internally recomputed parameter declaration/source identities, one coordinated local-result identity drift, and
one non-static expanded-property source-identity drift. The additional negative frame-width case already refused under
the first repair and is green evidence rather than a red. Production remained exactly
`47B840DEF4087C055E688D8361FF21AD2E7A69CDD3126E6BDD4E2B8621674676`; the review fail-first selftest hash is
`97953D4BAAE138C450CC5B8495F841D5B12B44CF376C93CCAEAA5571301E8A9D`. The positive identity census passed. This
confirms the coordinator findings before profile-authority/value/identity correction.

The review-corrected 8A.5 candidate is coordinator focused-green at `281/281`. Exact hashes are
`0E0DB9645655AD02087B785B9282B22434B02CF4544479DD923ACA4AEFD91989` for the producer and
`FECD2E138BE4C8CD001AAF891C54B36F50017C8E94853721D2D19C81602AAF4A` for its selftest. The corrected boundary
stores a detached deeply frozen complete normalized-profile snapshot in the separate authority and requires exact
profile equality; moves direct literal source/location equality into `schemaValue`; enforces file/sourcePath identity
for every expanded property status; and adds source-bound local declaration/parameter/invocation identity snapshots
that operation values must match. The three truth-grade positives are now separately produced matching
program/authority pairs. The 14-case coordinator-review census passes `14/14`.

Coordinator rerun confirms call model `46/46`, kernel `29/29`, font `10/10`, text `8/8`, corpus `28/28`, keep-outs
`16/16`, linter `112/112`, source bundle `PASS`, typecheck exit `0`, owned ESLint exit `0`, owned diff/whitespace/newline
checks clean, and frozen scene `117/119` with only the two named 8B.1 failures. Scene hashes remain exactly
`73D97D2E965B58BECC6280B64AAC535EA2FCE30BCA5FE2DE00EC35F99983C246` and
`2E8C3D698E66C23BB805913ACB1805D817241C3EDAA8E9E0D0D105D6FBCAFB10`. A fresh independent four-hash audit must
still challenge profile/local-identity completeness, positive producer families, all prior attack matrices, malformed
authority additions, and no-false-refusal behavior. This is a candidate, not acceptance; Scene 8B.1 stays frozen.

The `281/281` audit-pending candidate was synchronized and read back from GitHub #41 comment `5266092599`, Notion page
`3b84618e-d15b-8190-821e-c0eb96f43d5a`, and Drive document
`17VLaIsT499KHg7zg30hOyLaBXB0-9jlrX3dQ63s3dtE` at revision
`AIroW36_H2B0IvdhF0sUcfGgzDQjNVxm2q-qTqcCKMnfsET0bHP7ZE_UznonTioXIv9ImQzF3AHrUcEzH66B-xAHzHdS95TEcf9lpivXE-fH`.
Each records both fail-first checkpoints, exact four hashes, focused gates, frozen scene, audit-pending state, and
unchanged `PARTIAL / Not verified in game` boundary.

Live 8A.5 independent-audit checkpoint: the reviewer verified the four candidate hashes and reproduced a source-backed
local-identity completeness/order defect. The original 38 emitted-invariant attacks now refuse `38/38`, and the 13
coordinator-review mutations refuse `13/13`, all with zero validator throws. However, `11/15` focused one-sided
local-identity authority mutations remain pair-valid, including function/invocation/parameter reordering, removal of
an unconsumed function/invocation pair, duplicate or missing parameters, wrong parameter containment, altered
unconsumed invocation text, and an extra source-shaped invocation. Sparse, cyclic, unsafe, and duplicate-function-ID
cases do refuse. The authority ledger is schema-checked and consumed operation values are cross-linked, but the program
has no independent complete local-identity ledger and source/model ordering is not otherwise proven. The `281/281`
hashes are therefore rejected as acceptance evidence. A second P1 profile-correlation mechanism is also reproduced:
four coordinated program/authority snapshot mutations leave the original profile unchanged yet pair-validate after
changing kernel `uiScale`, kernel `scrollbarWidth`, kernel `frameWidth`, or table-node `frameWidth`. Exact profile-copy
equality does not yet bind scene-producing kernel/table facts back to that profile. This is an interim `FINDINGS`
checkpoint while the reviewer completes the required prior-closure, positive, gate, and final-hash census; exact 8A.6
fail-first scope will be recorded from that final report. Scene 8B.1 remains frozen and overall status remains
`PARTIAL / Not verified in game`.
This live rejection checkpoint was synchronized and read back from GitHub #41 comment `5266352659`, Notion page
`3b84618e-d15b-8190-821e-c0eb96f43d5a`, and Drive document
`17VLaIsT499KHg7zg30hOyLaBXB0-9jlrX3dQ63s3dtE` at revision
`AIroW36HfFSd_y9m_s59MOitV0pRoD95Q1kJZi0uWdsm4Bh2qsY_iaNgeHYLdxqnVkY15F4zSKfIPMS7SvpiZS3qOQOZ6iOO3gPVMpv7esxz`.
All three readbacks contain the local-identity finding, rejected candidate state, frozen scene, and unchanged product
truth boundary; repository Markdown remains authoritative.

#### Producer 8A.5 final independent audit and 8A.6 correction contract (2026-08-12)

Status: `FINDINGS / PARTIAL`. The final read-only audit verified all four hashes before and after, wrote no files, and
rejected the `281/281` producer candidate on two P1 producer-boundary defects. Across `193` successfully executed
malformed probes, `178` refused, `15` incorrectly returned pair-valid, and zero validator calls threw.

1. **P1, exact local-identity authority:** the real call model has an ordered local declaration/invocation census, but
   `authority.localIdentities` is checked only as individually source-shaped records and referenced identities are read
   through unordered maps. Of 15 one-sided authority attacks, 11 remained pair-valid: reverse function order, reverse
   invocation order, reverse parameter order, remove an unconsumed invocation, remove an unconsumed function/invocation
   pair, duplicate or remove a parameter, move a parameter source outside its declaration with recomputed ID, change an
   unconsumed invocation expression, move a parameter to the wrong declaration with recomputed identity, and add an
   extra source-shaped invocation. Sparse arrays, cycles, unsafe offsets, and duplicate function IDs refused. This is
   observed one-sided drift, not the explicitly out-of-scope coherent replacement of both unsigned inputs.
2. **P1, profile-to-kernel/table reconciliation:** four coordinated program/authority-snapshot mutations remained
   pair-valid while the independent profile stayed unchanged: every kernel state's `metrics.uiScale`, every kernel
   state's `metrics.scrollbarWidth`, every kernel state's `frameWidth`, and table-node `frameWidth`. Exact equality of
   the two profile copies does not bind scene-producing kernel/table facts back to their owning profile/frame facts.

All previously targeted defects stayed closed: original emitted-invariant `38/38`, coordinator named mutations
`13/13` (plus its grouped intact control), prior `17/17`, root `15/15`, coordinated operation/node `37/37`, structural
call/kernel/height `24/24`, selected expansion/authority `16/16`, nested non-JSON/unsafe/sparse `7/7`, and profile
authority `7/7` refused with zero throws. Positive evidence stayed intact: broad real producers `10/10`, profile truth
grades/boundaries `7/7`, seven topology/row-group/height/pre-final controls `7/7`, seven real rejected kinds `7/7`,
Helper omitted widths `4/4` exact at `-10`, selected expansion pair-valid, and the profile snapshot detached, deeply
frozen, JSON-equal, and clone-valid.

Declared gates were producer `281/281`, call model `46/46`, kernel `29/29`, typecheck exit `0`, owned ESLint exit `0`,
clean producer diff/boundary/whitespace/newline checks, and frozen scene `117/119` with only finalized creator scaled
height and uniform unavailable Helper-negative-width geometry red. No producer-schema false refusal appeared. Exact
rejected hashes remain:

- producer `0E0DB9645655AD02087B785B9282B22434B02CF4544479DD923ACA4AEFD91989`;
- producer selftest `FECD2E138BE4C8CD001AAF891C54B36F50017C8E94853721D2D19C81602AAF4A`;
- scene `73D97D2E965B58BECC6280B64AAC535EA2FCE30BCA5FE2DE00EC35F99983C246`;
- scene selftest `2E8C3D698E66C23BB805913ACB1805D817241C3EDAA8E9E0D0D105D6FBCAFB10`.

Producer 8A.6 is the next bounded unit and owns only `src/lib/x4UiLayoutProgram.ts` and
`src/lib/x4UiLayoutProgram.selftest.ts`. Before production repair, install permanent regressions for all 15
local-identity attacks and all four profile/kernel/table attacks. Fail-first must reproduce exactly the 15 current
escapes while the four already-refusing local controls and all prior 281 checks stay green; add real same-name, nested,
alias, repeated, selected-expansion, direct-local, all-truth-grade, boundary-profile, pre-final, and rejected-output
positive guards before changing production.

The smallest accepted repair must add an independently compared, detached, frozen program-side copy of the complete
ordered local-identity ledger (or an equally complete source-backed representation), require exact pair order,
cardinality, and content, enforce parameter index/order/uniqueness and declaration containment, and retain exact
invocation expression/source/callee relations. It must also reconcile every table kernel state and every operation
transition/refusal state to the exact normalized profile metrics, then bind kernel and table `frameWidth` to the exact
owning frame fact. Preserve legitimate standalone/refused/pre-final outputs and the structural-not-authentication trust
boundary. Acceptance requires all new and prior focused gates green, frozen scene still classified only by its two
named failures, exact four-hash readback, and a fresh independent audit returning `CLEAN`. Scene 8B.1 and all downstream
paint/UI/browser/game work remain blocked; every state remains `Not verified in game`.

8A.6 Phase 1 is complete and coordinator-accepted with selftest-only ownership. The permanent oracle adds exactly the
19 named checks and stops before production repair. Its causal checkpoint is exactly `285/300`, exit `1`: the prior
`281/281` checks and four already-refusing local controls are green, exactly the 11 audited local-identity escapes and
four profile/kernel/table correlation escapes are red, and all validator calls report `threw:false`. Mutation proofs
confirm real order/cardinality/source/owner/expression changes for all 11 identity cases, actual sparse/cycle/unsafe-ID/
duplicate-ID controls, 20 program plus 20 authority HelperTableState mutations for each metric/kernel-width case, and
one program plus one authority table-node-width mutation with zero HelperTableState mutations. Targeted ESLint,
`git diff --check`, trailing-whitespace, newline, and forbidden-debug scans are green. Exact hashes are producer
`0E0DB9645655AD02087B785B9282B22434B02CF4544479DD923ACA4AEFD91989`, producer selftest
`78A33FB00032BE65D0EABA58F978A11422AA15281603C530C89CE8A1ABECE8C8`, scene
`73D97D2E965B58BECC6280B64AAC535EA2FCE30BCA5FE2DE00EC35F99983C246`, and scene selftest
`2E8C3D698E66C23BB805913ACB1805D817241C3EDAA8E9E0D0D105D6FBCAFB10`. Production and Scene remain unchanged;
Phase 2 production repair is now the active bounded unit.

Phase-1 AAR: the first compile used a helper name already present in the large selftest and the first owner-move attack
did not prove a real malformed transition, so neither intermediate run was accepted. The helper was uniquely renamed,
the attack was rebuilt around real declaration owners, and coordinator review strengthened the cycle, duplicate-ID,
target-family, and selector preconditions before accepting the exact fail-first result. These failures changed no
production evidence.

The accepted 8A.6 Phase 1 checkpoint was synchronized and read back from GitHub #41 comment `5266860529`, Notion page
`3b84618e-d15b-8190-821e-c0eb96f43d5a`, and Drive document
`17VLaIsT499KHg7zg30hOyLaBXB0-9jlrX3dQ63s3dtE` at revision
`AIroW35-FFlBX0PqWkyIiBKwLLk377aHjXTCVCr4p-J5__Y6SLokc5NlPnGltIW7mNjM2BjSNEFDv9xduor0HQvUKytChTJlZJnEA30UlzHG`.
All three readbacks contain `285/300`, the exact selftest hash, unchanged production/Scene hashes, Phase 2 scope, and
the unchanged `PARTIAL / Not verified in game` boundary.

#### Producer 8A.6 Phase 2 first candidate: coordinator owner-topology FINDINGS (2026-08-12)

Status: `FINDINGS / PARTIAL`. The first Phase 2 repair reached producer `302/302`, call model `46/46`, kernel `29/29`,
typecheck and targeted ESLint green, while frozen Scene remained exactly `117/119` with only its two named unfinished
behaviors. Exact candidate hashes are producer
`046E6E1FD4AE291286A4A8CF77DF04EA2E82085A8E76F62865511711E59F23EC`, producer selftest
`AB52344E4FD30AEDBBA6070E5E401F321B4AC7F3148741B73199C04874D99F21`, and the unchanged Scene hashes above. The
candidate is rejected before independent audit.

Coordinator read-only mutation probes reproduced five coordinated program/authority owner-link escapes with an intact
baseline pair-valid and zero throws: changing `table.frameId` to a nonexistent frame; removing the referenced
`frame.width`; removing the table ID from its owner's `frame.tableIds`; appending an unknown table ID to
`frame.tableIds`; and deleting `table.frameId` while its frame-width/kernel facts remain. Deleting only
`table.frameWidth` correctly refuses. The defect mechanism is that `ownerFrameWidth()` treats an unresolved owner or
missing owner width as an optional absence, so profile/state checks can be skipped while exact snapshots still agree.

The reconciled correction must install these five cases as permanent selftest-only fail-first regressions and capture
exactly `302/307`, exit `1`, before production changes. The repair must require reciprocal frame/table ownership:
every linked table resolves to a real width-bearing frame and appears exactly once in that frame's `tableIds`; every
frame child resolves back to that frame; a table with no frame owner cannot carry frame-width or kernel-state facts;
and any operation kernel state must resolve a consistent real frame through its frame/table owner before metric and
width comparison. Preserve legitimate unresolved addTable records that carry no owner-derived width/state. After the
focused suite is green, all prior gates and a fresh independent four-hash audit remain mandatory. This review-triggered
reimplementation is an AAR event; nothing is verified in game.

The rejected first Phase 2 candidate and owner-topology correction contract were synchronized and read back from
GitHub #41 comment `5267040263`, Notion page `3b84618e-d15b-8190-821e-c0eb96f43d5a`, and Drive document
`17VLaIsT499KHg7zg30hOyLaBXB0-9jlrX3dQ63s3dtE` at revision
`AIroW36KzI6bso7F6mJ_PJ_Nb3mgX9TZuC3iENlj4SYGFCc3aEBZcbbRwVNcaaCTIkRwH3K5Qm8p0pmplUgxlGRzkiLXbKgKO4jrzH5_pg5Z`.
All three readbacks contain the five reproduced owner escapes, exact rejected hashes, `302/307` fail-first contract,
frozen Scene, and unchanged `PARTIAL / Not verified in game` boundary.

8A.6 Phase 2A is coordinator-accepted at the required tests-only boundary: producer selftest `302/307`, exit `1`, all
existing `302/302` green, exactly the five new owner-topology regressions red, and zero validator throws. Each case uses
independent frozen program/authority clones and proves the selected owner/cardinality change with no collateral mutation.
Production remains `046E6E1FD4AE291286A4A8CF77DF04EA2E82085A8E76F62865511711E59F23EC`; selftest is
`B578959049861FA8FA571C6900D6B276FA640FE28D1BFEA2AB794D00030375B2`; both Scene hashes remain unchanged. Targeted
ESLint, selftest diff/whitespace/newline, and forbidden-debug checks are green. Production correction remains blocked
until owner-path consistency review completes; this checkpoint alone is not acceptance evidence.

Owner-path consistency review expanded the correction by five reproduced structural contradictions, each baseline-valid,
pair-valid, and non-throwing: (1) move a table and both reciprocal frame child lists to another real same-width frame
while its source-backed addTable receiver still identifies the original frame; (2) add a real but different `frameId`
to a kernel operation whose `tableId` belongs to the original frame, with exact node-ledger membership; (3) change the
table identity `parentPath` away from its `frameId` owner; (4) list a known table from a second non-owning frame; and
(5) reverse two distinct table IDs within one owning frame. A duplicate table ID already refuses through the existing
closed ID-array schema and is excluded from the red set. Phase 2A.1 must add exactly these five permanent tests without
production edits and capture `302/312`, exit `1`: all original 302 green, exactly ten owner-topology/path checks red,
zero throws, and all four production/Scene hashes unchanged. The later repair must reconcile frame/table topology in
program table order and cross-bind table `frameId`, frame `tableIds`, table identity parent, and addTable operation
receiver/result identities; an operation carrying both frame and table ownership must resolve to the same frame.

8A.6 Phase 2A.1 is coordinator-accepted at exact `302/312`, exit `1`: all 302 pre-owner-correction checks are green,
exactly the ten named owner topology/path assertions are red, and zero validator calls throw. The five added proofs use
real equal-width applied frames/tables and independently frozen pairs; each proves its intended receiver, identity,
membership, cardinality, or order mutation with no collateral target change. Targeted ESLint and selftest diff/
whitespace/newline/debug scans are green. Exact hashes are producer unchanged
`046E6E1FD4AE291286A4A8CF77DF04EA2E82085A8E76F62865511711E59F23EC`, selftest
`DF840B851CB0DDEC61479325FACD4DA60FD0A2A5965524BAC78851530A7DDE44`, and unchanged Scene hashes
`73D97D2E965B58BECC6280B64AAC535EA2FCE30BCA5FE2DE00EC35F99983C246` /
`2E8C3D698E66C23BB805913ACB1805D817241C3EDAA8E9E0D0D105D6FBCAFB10`. Phase 2B production repair is now the active
bounded unit; it must turn only these ten reds green without weakening any prior family, then pass focused integration
and fresh independent audit.

Phase-2A documentation AAR: one combined three-file patch used an imprecise BACKLOG context and was rejected atomically;
the coordinator re-read each target and applied exact per-file patches. No implementation or evidence state changed.

The accepted final `302/312` owner fail-first was synchronized and read back from GitHub #41 comment `5267308030`,
Notion page `3b84618e-d15b-8190-821e-c0eb96f43d5a`, and Drive document
`17VLaIsT499KHg7zg30hOyLaBXB0-9jlrX3dQ63s3dtE` at revision
`AIroW36o2nLmGjVsAO3D7MFTnj2XNSf7pZ_fXJD8OvOmyr-hu7u5liAhzileGSYZQLNUbJAelDbhK6YCTEj4YYUtHT6kwzJgELPpSTVyGHL5`.
All three readbacks contain exact `302/312`, the selftest hash, unchanged producer/Scene hashes, Phase 2B scope, and the
unchanged `PARTIAL / Not verified in game` boundary. The first Drive append correctly failed its stale required-revision
guard after the document advanced; the coordinator fetched the live revision, preserved concurrent content, retried
once, and read back the successful append. This is a triggered AAR tool event, not product evidence.

#### Producer 8A.6 Phase 2B candidate rejected by coordinator audit; independent audit active (2026-08-12)

Status: `IN PROGRESS / PARTIAL`. The bounded repair adds exact ordered reciprocal frame/table topology, strict linked and
ownerless table-state rules, source-backed table/addTable receiver/result identity cross-links, consistent operation
frame/table ownership, and width-bearing table ownership for every kernel transition. One real unresolved ownerless
addTable remains explicitly pair-valid only while carrying no `frameId`, `frameWidth`, or kernel state.

Worker and coordinator focused evidence agree: producer `313/313`; call model `46/46`; kernel `29/29`; font `10/10`;
text `8/8`; corpus `28/28`; keep-outs `16/16`; linter `112/112`; source bundle PASS; typecheck, targeted ESLint, and
owned diff checks green. All prior 302 producer assertions, all ten owner regressions, the new ownerless positive, and
the duplicate-child refusal are green with zero throws. Frozen Scene remains exactly `117/119`, with only finalized
creator scaled height and uniform unavailable Helper-negative omitted-width geometry red and no producer-schema false
refusals. Exact candidate hashes are producer
`766F24C11EF572DF603EFB31F3091A327B4B95AFA7505EED1A365D1A5837032E`, selftest
`AD74133867DC07D82AFF94C982AB2E8AC524CE7DE363EFD18769792F010A51E5`, and the unchanged Scene hashes above.

These hashes are rejected. A read-only coordinator probe reproduced a coherent fail-open from the existing ownerless
fixture: the unresolved `addTable` operation was assigned the unresolved frame's `frameId`; the operation and frame
memberships were mirrored exactly through the program and separate authority snapshots/ledgers; both artifacts were
deeply frozen; and `validateX4UiLayoutEvidencePair()` still returned `{ valid: true }` while the table itself remained
ownerless. The unchanged baseline pair also returned `{ valid: true }`. A follow-up exact all-kind mutation matrix proved
the mechanism is general: across 18 operations representing all 17 relevant call kinds, 42 coherent extra-owner
injections and 20 coherent required-owner removals still pair-validated after every program/authority operation and node
ledger was mirrored and both roots were deep-frozen. Representative escapes add owners to direct scale and `OpenMenu`,
add table/row/cell owners to frame/display operations, or remove the required frame from `createFrameHandle`/`display`.
An exact two-branch sibling fixture then kept five coherent source-wrong reassignments pair-valid: `createFrameHandle` and
`display` to the other frame, `setColWidth` to the other same-width table, `addRow` to the other table/row pair, and
`createText` to the other table/row/cell chain. The missing contract is exact per-call owner shape, parent-chain
reciprocity, and call receiver/result identity binding, not an isolated ownerless special case.
The independent reviewer returned `FINDINGS`, independently confirmed the owner-shape mechanism and all five sibling
reassignments, and preserved all four hashes exactly. Scene 8B.1 remains frozen. Only corrected focused evidence followed
by a fresh `CLEAN` audit may unblock it.

This rejected checkpoint is synchronized and read back from GitHub #41 comment `5267795155`, Notion page
`3b84618e-d15b-8190-821e-c0eb96f43d5a`, and Drive document
`17VLaIsT499KHg7zg30hOyLaBXB0-9jlrX3dQ63s3dtE` at revision
`AIroW34qrzuZ10l7F3_287sctfd8d4yKkLymKs4QxDvW_VfaP9e7lj3MJqDLdzCc-zHHIEGUfIYXav8ulerISXXIERZdYnQYxEAusoIBGsd_`.
All three contain the exact 42/20 owner-shape census, candidate and frozen-Scene hashes, active-audit state, and unchanged
`PARTIAL / Not verified in game` boundary; the later five-case sibling reassignment finding is currently repository-only
pending the reviewer's consolidated report. The Drive pre-write trusted-read artifacts are under
`C:\Users\Moshi\.codex\visualizations\2026\08\10\019fea10-33af-7f32-8175-424ddfebda4e\bridge\trusted-read-b119-owner-audit-20260812`.

Final-audit AAR: direct execution through the Windows `tsx.cmd -e` wrapper returned no script output for the new
owner-topology probe; invoking the same in-memory script through Node and the tsx CLI produced the deterministic
baseline-valid/forged-valid reproduction. Earlier in this audit, two `tsx -e` probes returned no script output, three dynamic fixtures initially selected no real
value, and one alias-preserving refusal mutation reached snapshot mismatch instead of its intended transition check.
Those attempts were excluded; direct Node/tsx execution, real dynamic expressions, and a JSON-cloned transition fixture
completed the intended probes. The stale graph returned unrelated nodes and was excluded from acceptance evidence.
Family-sized split matrices remained the reliable audit method.

External-sync AAR: the mandatory Docs trusted-read bridge first failed before any connector write because the code
isolate has no `atob`, then failed path validation because the checked-in bridge accepts POSIX absolute paths only. The
successful retry loaded the same bridge through byte-checked PowerShell JSON transport and ran its unchanged detector and
receiver through Git Bash `/c/...` paths with Windows workdir translation. Trusted read, guarded append, and target/tab/
revision readback then succeeded; the failed setup attempts are tool evidence only.

#### Producer 8A.6 final independent audit — FINDINGS; 8A.7 correction contract (2026-08-12)

Status: `IN PROGRESS / PARTIAL`. The reviewer independently executed 55 malformed pairs: 5 refused, 50 remained
pair-valid, zero threw, and one no-op setup was excluded. Its positive census was `8/8` accepted with zero false
refusals. A follow-up identical-sibling fixture added five independently confirmed pair-valid reassignments, yielding a
combined independent census of `60 / 5 / 55 / 0`. The coordinator's exhaustive 62-case owner addition/removal matrix is
separate supporting evidence and overlaps that independent census; do not add the two totals together.

The four audit findings are source-backed and bounded:

1. **P1 owner schema:** operation owners are not closed by call kind/status. Required owners may be removed and forbidden
   owners added while mirrored ledgers remain valid. Preserve source-valid partial branches, but encode the exact
   required/optional/forbidden owner shape emitted for all 17 call kinds.
2. **P1 topology and identity:** `table.rowIds`, `row.cellIds`, row/cell parent IDs/indexes/columns, identity parent paths,
   and call receiver/result bindings are incomplete. Add exact ordered projections and per-kind identity reciprocity.
   Identical-shape sibling fixtures must reject source-wrong reassignment for frame creation/display, width setters,
   row creation, and cell operations; geometry equality must not mask identity drift.
3. **P1 profile ingress:** three type-valid mismatches (Helper view width, view height, and standard button height when
   defaults omit it) currently return a successful producer wrapper which its own pair validator rejects. Empty profile
   provenance also pair-validates. Normalize and pair-validate through one exact shared profile predicate; every success
   must validate against its issued authority and provenance must be non-empty.
4. **P2 parameter order:** local-function parameter ranges can be swapped or overlap after IDs are recomputed. Require
   strict lexical, non-overlapping source ranges in emitted index order within each declaration.

Implementation remains producer-only. Einstein owns exactly `src/lib/x4UiLayoutProgram.ts` and
`src/lib/x4UiLayoutProgram.selftest.ts`; every other path is forbidden. Phase 1 must add permanent fail-first regressions
for all 62 exhaustive owner-shape cases, all 11 row/cell topology cases, the nine identity/receiver cases with the one
already-refusing `addTable` control explicit, all four profile-ingress/provenance cases, both parameter-range cases, and
all five identical-sibling reassignments. All historical `313/313` checks must remain green, every intended new escape
must be red, the existing control must remain green, and production must remain byte-identical. Record the exact resulting
count rather than assuming one check per generated case.

Phase 2 may then implement the smallest shared predicates and exact source-derived relations above. Acceptance requires:

- all new regressions and historical producer checks green with zero throws;
- ownerless unresolved `addTable` still pair-valid only with no fabricated frame owner/derived frame state;
- all eight reviewer positive families and the complete existing positive corpus remain pair-valid;
- call `46/46`, kernel `29/29`, font `10/10`, text `8/8`, corpus `28/28`, keep-outs `16/16`, linter `112/112`, source
  bundle PASS, typecheck, four-file targeted ESLint, diff/whitespace/debug scans, and exact hashes green;
- frozen Scene remains exactly `117/119` with only its two named unfinished geometry behaviors and zero producer-schema
  false refusals;
- a fresh read-only four-hash audit returns `CLEAN` before Scene resumes.

Broad precommit/oracle/E2E/build, browser/installed-extension inspection, Canvas integration, deploy parity, and X4 remain
outside this correction. `Not verified in game` is permanent.

The completed audit and dispatched tests-only 8A.7 Phase 1 are synchronized and read back from GitHub #41 comment
`5267970111`, the canonical Notion page, and the same Drive document at revision
`AIroW36kKuND40K1JA-1sdqq5Q7v-aExBFJEpkkTvuZ0m3zh0rqF84xg9ucs2hgGlfiHQ7329ixfqw5rLp1GLVVBA4aC1ZBQF7tV7YFO-fSx`.
All three contain combined independent `60 / 5 / 55 / 0`, positive `8/8`, all four findings, exact rejected/frozen
hashes, the tests-only boundary, and unchanged `PARTIAL / Not verified in game` state.

#### Producer 8A.7 Phase 1 coordinator review — REJECTED fixture; tests-only correction active (2026-08-12)

Status: `IN PROGRESS / PARTIAL`. The first tests-only checkpoint changed only
`src/lib/x4UiLayoutProgram.selftest.ts`, from
`AD74133867DC07D82AFF94C982AB2E8AC524CE7DE363EFD18769792F010A51E5` to
`33C672EA494FC4633B4B9B1A187509FED873FEE33A46DA85232F08A9D0F12EF7`; the rejected producer and both frozen Scene
hashes remained byte-identical. Its executable census was `315/407`, exit `1`: historical `313/313` green, two
controls green, 92 red 8A.7 checks, 94 unique 8A.7 names, and zero validator throws. Typecheck, targeted lint, and
scoped diff checks also passed.

That count is not accepted. Coordinator parsing of every failed check's machine-readable proof reproduced one invalid
fixture: `identity/result/receiver creator receiver drift` had `proof.fixtureReady=false`, because its selected target
cell had no distinct identity and the receiver remained the exact same `row[1]` identity before and after. The reported
92 intended reds therefore contain 91 demonstrated acceptance gaps plus one setup failure. Production remains frozen.
Einstein has a tests-only correction order to use a genuinely distinct same-shape sibling identity and prove explicit
before/after inequality plus target equality. Acceptance remains exact `315/407`, but now requires all 92 red checks to
have ready fixtures, zero throws, all historical checks and both controls green, and production/Scene hashes unchanged.

AAR trigger: worker self-report incorrectly classified the suite as having zero unexpected failures. Sustain the
structured per-case proof payload; improve the gate by parsing every failed `proof.fixtureReady` field instead of
trusting aggregate counts. No production authorization is granted until that parser is clean.

#### Producer 8A.7 Phase 1 corrected fail-first — ACCEPTED (2026-08-12)

Status: `IN PROGRESS / PARTIAL`. The tests-only correction is coordinator-accepted at selftest SHA-256
`F53D5F58F88914DBDEC48344EE35BAE44173E04751D5FE600083421C951724A5`. Independent execution returned exactly
`315/407`, exit `1`: historical `313/313` green, 92 genuine fail-first checks red, two controls green, all 94 8A.7 names
unique, zero `fixtureReady=false`, and zero validator throws. The corrected creator receiver proof changes the canonical
identity from `row[1]` to distinct `row[3]`, proves before/after inequality and after/target equality, and reproduces the
current pair validator accepting that coherent source-wrong mutation.

Typecheck and targeted selftest ESLint exited `0`; final-newline, CRLF, trailing-whitespace, debug-marker, and scoped diff
checks are clean. Production remains byte-identical at
`766F24C11EF572DF603EFB31F3091A327B4B95AFA7505EED1A365D1A5837032E`; frozen Scene remains byte-identical at
`73D97D2E965B58BECC6280B64AAC535EA2FCE30BCA5FE2DE00EC35F99983C246` and
`2E8C3D698E66C23BB805913ACB1805D817241C3EDAA8E9E0D0D105D6FBCAFB10`.

Phase 2 production repair is now authorized only within `src/lib/x4UiLayoutProgram.ts`, with the accepted selftest as
the oracle. It must close all 92 gaps without weakening tests, preserve both controls and every historical positive,
and return the full producer suite green before dependency and frozen-Scene reconciliation. Broad host/UI/game gates
remain outside this focused unit; overall status remains `PARTIAL / Not verified in game`.

The accepted checkpoint is synchronized and read back from GitHub #41 comment `5268427188`, Notion comment
`3ba4618e-d15b-8116-bf66-001d5f5117fc`, and the same Drive document at revision
`AIroW34XFHNcEwyJVzil1Wxd8Vf7W5-_fCzQ19bDoPXWigBexEBkjx_PYbTDONLShXlpAhhOfcfJHXleJuPLFBDUihbT-4bJgxAZUxQKaxEt`.
All three readbacks contain the accepted selftest hash and exact `315/407` census. The fresh Drive trusted-read manifest
is under
`C:\Users\Moshi\.codex\visualizations\2026\08\10\019fea10-33af-7f32-8175-424ddfebda4e\bridge\trusted-read-b119-phase1-accepted-20260812`;
it found no protected controls. The first bridge bootstrap attempt stopped before connector access because the restricted
code isolate also lacks `TextEncoder`; the documented byte-count fallback then completed successfully and the guarded
revision-locked append/readback passed.

#### Producer 8A.7 Phase 2 focused-green candidate — AUDIT ACTIVE (2026-08-12)

Status: `IN PROGRESS / PARTIAL`; not accepted. Einstein changed only `src/lib/x4UiLayoutProgram.ts`, from
`766F24C11EF572DF603EFB31F3091A327B4B95AFA7505EED1A365D1A5837032E` to candidate
`685E714F16F1B1962562860DCAD5512404B659700339B3F20B36DFF247E822BE`. The accepted selftest and both frozen Scene
files remain byte-identical at their documented hashes.

Worker and coordinator focused executions agree: producer `407/407`; call model `46/46`; kernel `29/29`; font
`10/10`; text `8/8`; corpus `28/28`; keep-outs `16/16`; linter `112/112`; source bundle `PASS`; repository typecheck and
four-file targeted ESLint exit `0`. Frozen Scene remains exactly `117/119`, exit `1`, with only finalized creator scaled
height and unavailable Helper-negative omitted-width geometry red. The frozen Scene selftest's existing
`console.error` is its failure reporter, not candidate debug code. The first coordinator parallel-wrapper attempt had a
JavaScript quoting error before launching commands; the corrected wrapper produced the evidence above.

Source review has not accepted the candidate. Two residual risks are explicitly in the independent audit: (1) profile
pin/coherence semantics currently appear duplicated between `normalizeProfile` and `schemaProfile`, while the contract
requires one shared exact predicate to prevent drift; (2) row/cell parent and index members remain schema-optional, so
the reviewer must attack coherent removal/drift on applied identified nodes beyond the permanent matrix. The reviewer
must rerun the prior malformed and positive censuses against all four exact hashes and return `CLEAN` before Scene may
resume. No external tracker projection is advanced for this unaccepted candidate.

#### Producer 8A.7 final independent audit — FINDINGS; candidate REJECTED (2026-08-12)

Status: `FINDINGS / PARTIAL`. Candidate production hash
`685E714F16F1B1962562860DCAD5512404B659700339B3F20B36DFF247E822BE` is rejected; the accepted selftest and frozen
Scene hashes remain exact, and the reviewer wrote no files. Focused producer `407/407`, typecheck, targeted ESLint, and
frozen Scene `117/119` were reconfirmed. Intended-state census was `12/12` accepted with zero false refusals. The
independent copied-state census was `137 / 100 / 37 / 0` (cases / declined / still accepted / exceptions); its all-kind
62 and sibling cases overlap earlier evidence and are not added to prior totals.

Three bounded findings remain:

1. **P1 operation ownership:** 31 non-applied or mixed-ancestry cases still pair-validate: 20 known-owner removals,
   four impossible partial-owner additions, three cross-ancestor owner combinations, and four non-applied equal-shape
   sibling substitutions. Owner presence and receiver/result reconciliation must follow the producer's exact kind and
   branch semantics, not only applied/rejected/kernel-backed operations.
2. **P1 materialized topology:** six applied row/cell cases remain valid after removing row `tableId`/`rowIndex` or cell
   `rowId`/`rowIndex` with reciprocal list changes, or moving row/cell coordinates outside the owning kernel bounds.
   Materialized nodes need complete bounded ancestry and exact owning table-slot reconciliation; legitimate unresolved
   nodes must remain representable.
3. **P2 profile admission:** four inputs with extra keys on Helper/default pins or their source objects return
   `projected` wrappers whose untouched issued pair immediately validates false. `sourcePinValid` accepts and clone-copies
   the extra members while the closed pair schema declines them. Implement the specified one shared exact profile
   normalizer/predicate or reconstruct accepted pins from declared fields; every non-refused result must self-validate.

The first reviewer request was stopped by a wording-triggered content-filter false positive before returning evidence;
it wrote nothing. A neutral local data-consistency QA retry completed normally and produced the report above. AAR:
describe this domain as paired UI-layout data consistency in worker orders; never weaken the review scope to bypass a
filter.

Next bounded unit is tests-only. Add one permanent, causally proved regression per 37 pair-valid case and per four
self-invalid profile input: exact expected fail-first `407/448`, exit `1`, with all historical 407 green, exactly 41 new
reds, zero unready fixtures, zero checker exceptions, production byte-identical at the rejected hash, and Scene hashes
unchanged. Only after coordinator acceptance may production resume. Scene remains frozen and overall status remains
`PARTIAL / Not verified in game`.

The rejection and dispatched tests-only unit are synchronized and read back from GitHub #41 comment `5269030352`,
Notion comment `3ba4618e-d15b-815c-b8e7-001d757fa725`, and Drive revision
`AIroW35jdTuJjaxLzjqOdDXvhXSMYuvVV7mMBo6klwiklgOcvTdLi67Kw5sGJEERX7RMEE4Go9wHyLu-cbHfE9B1H0zpXV7anMtjHXjET0_u`.
All three contain the rejected hash, exact `137 / 100 / 37 / 0` census, four profile-ingress failures, `407/448`
tests-only gate, frozen Scene boundary, and `PARTIAL / Not verified in game`. The fresh Drive trusted-read artifacts are
under
`C:\Users\Moshi\.codex\visualizations\2026\08\10\019fea10-33af-7f32-8175-424ddfebda4e\bridge\trusted-read-b119-phase2-rejected-20260812`;
no protected controls were found and revision-locked append/readback passed.

#### Producer 8A.7 Phase 3A first tests-only checkpoint — REJECTED profile oracle (2026-08-12)

Status: `IN PROGRESS / PARTIAL`. The first Phase 3A tests-only checkpoint changed only the producer selftest to
`A2125E0963FDEFFFD74BA3496CC9E1F230DC5BAA4D9E02A59E0D47B1E12FFEAA` and executed the requested aggregate
`407/448`, exit `1`: all prior 407 green, 41 new reds, reported family counts `20 / 4 / 3 / 4 / 6 / 4`, zero checker
throws, and forbidden production/Scene hashes unchanged. Typecheck, targeted lint, and hygiene checks passed.

The checkpoint is rejected after coordinator source review. The four profile checks define `fixtureReady` by requiring
the current defect to persist (`status !== refused`, program and authority emitted, issued pair invalid), then require
the same `fixtureReady` and `status === refused` in the passing assertion. They therefore cannot turn green after the
intended proper refusal: the refusal would make `fixtureReady=false`. Aggregate red counts are not sufficient evidence
for a permanent oracle.

Einstein has a tests-only correction order. Each profile case must retain machine-readable proof of the current
self-invalid-success escape while defining stable setup readiness from the extra-key input. The assertion may pass only
on a proper refused/no-issued-pair outcome. Exact aggregate acceptance remains `407/448`, but production repair remains
unauthorized until all four truth tables are future-passable and the other 37 pair regressions remain unchanged.

AAR trigger: this is the second Phase 3 fail-first checkpoint where machine-parsed current readiness was green but
future-passability was not. Add explicit current-bug and expected-fixed booleans for dual-outcome regressions; review both
truth-table branches before accepting a tests-first gate.

#### Producer 8A.7 Phase 3A corrected fail-first — ACCEPTED (2026-08-12)

Status: `IN PROGRESS / PARTIAL`. The corrected tests-only oracle is coordinator-accepted at selftest SHA-256
`6287289F02F80DA9E21A6020AFC8ACDA0ED0F1ADE189F3575E6FFE5CC47A99A1`. Independent execution and machine parsing
returned exact `407/448`, exit `1`: all prior 407 checks green; 41 new checks red; all 41 names unique; zero unready
fixtures; zero checker throws; and no unexpected rows.

Exact new family census is 20 non-applied owner removals, four impossible partial-owner additions, three mixed
cross-ancestor combinations, four non-applied equal-shape sibling substitutions, six materialized topology/bounds
cases, and four profile-ingress cases. All 37 copied-pair cases remain pair-valid under the rejected candidate and prove
their intended mutation. All four profile cases prove `currentEscape=true`, `expectedRefusal=false`, input extra member
present, non-refused partial result, emitted program and authority, untouched issued pair invalid, and no throw. Their
source truth table is future-passable: proper `refused + no pair` makes `expectedRefusal=true` and the assertion green;
refusal with an emitted pair or a checker exception remains red.

Typecheck and targeted selftest ESLint exit `0`; final newline, LF/CRLF/bare-CR, trailing-whitespace, debug-marker, and
scoped documentation diff checks are clean. Rejected production remains byte-identical at
`685E714F16F1B1962562860DCAD5512404B659700339B3F20B36DFF247E822BE`; frozen Scene remains byte-identical at
`73D97D2E965B58BECC6280B64AAC535EA2FCE30BCA5FE2DE00EC35F99983C246` and
`2E8C3D698E66C23BB805913ACB1805D817241C3EDAA8E9E0D0D105D6FBCAFB10`.

Phase 3B production repair may now resume only in `src/lib/x4UiLayoutProgram.ts` against this frozen oracle. It must
enforce producer-exact owner presence and identity across non-applied branches, complete and bound materialized node
ancestry/coordinates while preserving legitimate unresolved nodes, and replace duplicated permissive profile pin
handling with one exact ingress/pair contract. No test or Scene edit is authorized.

Accepted Phase 3A is synchronized and read back from GitHub #41 comment `5269285042`, Notion comment
`3ba4618e-d15b-8101-9c76-001d367906f3`, and Drive revision
`AIroW34F5AdCFhxM0kWLqxHZ5m5o9DfaGk04SHMMpW50RdhTF0oC34oQPwkTjwVk6OuE5_FIXgfL9VWOZB0ZnKWHRCFvLPQDwIAyWpMYinBR`.
All three contain the accepted hash, exact `407/448` gate, family census, profile truth-table boundary, production-only
next unit, frozen Scene state, and `PARTIAL / Not verified in game`.

### Phase 3B production candidate — focused-green, audit pending (2026-08-12)

Status: `IN PROGRESS / PARTIAL`. Production-only repair changed `src/lib/x4UiLayoutProgram.ts` from rejected SHA-256
`685E714F16F1B1962562860DCAD5512404B659700339B3F20B36DFF247E822BE` to candidate SHA-256
`DDE9CCA8A8B945710D61103F93E4134EEFA79A246F1830679859A11ED0ACFAD4`. The accepted test oracle and both Scene files
remain byte-identical at `6287289F02F80DA9E21A6020AFC8ACDA0ED0F1ADE189F3575E6FFE5CC47A99A1`,
`73D97D2E965B58BECC6280B64AAC535EA2FCE30BCA5FE2DE00EC35F99983C246`, and
`2E8C3D698E66C23BB805913ACB1805D817241C3EDAA8E9E0D0D105D6FBCAFB10`.

The candidate derives owner presence from emitted operation branch/status and metadata, reconciles receiver/result and
full table/row/cell ancestry, binds materialized rows/cells to exact kernel slots and column bounds, rejects extra profile
keys through a shared exact pin shape, binds nested local-invocation results to the emitted invocation ledger, and
fail-closes any non-refused wrapper whose issued program/authority pair does not validate. Legitimate unresolved,
conditional, unreachable, ownerless, dynamic-unknown, and locally expanded branches remain explicit rather than guessed.

Worker and independent coordinator runs match exactly: producer `448/448`; call model `46/46`; kernel `29/29`; font
`10/10`; text `8/8`; corpus `28/28`; keep-outs `16/16`; linter `112/112`; source bundle `PASS`; repository typecheck and
targeted four-file ESLint exit `0`; hashes, LF/final-newline, trailing-whitespace/debug scans, and scoped diff check are
clean. Frozen Scene remains exactly `117/119`, with only `finalized creator scaled height` and `unavailable Helper-negative
omitted-width geometry` failing. This is the expected pre-8B.1 integration signal, not a green Scene acceptance gate.

The repair required multiple semantic corrections after intermediate runs: an over-broad owner predicate falsely refused
a legitimate conditional branch; an unresolved edit-box may legitimately omit an unavailable cell owner; the new
self-validation guard exposed valid dynamic-unknown values and direct local-invocation results whose caller range differs
from the invocation range. Each was narrowed at the shared contract rather than by changing tests. These failures trigger
the AAR and require the active fresh audit to probe the late boundaries explicitly.

No external tracker was advanced for this candidate. Phase 3C is a read-only four-hash audit: rerun the intended `12/12`
positive census, the prior complete `137` inconsistent-state census, and a bounded late-change adversarial matrix. Scene
work remains frozen and the candidate is not accepted unless that audit is `CLEAN`. Overall B119 remains `PARTIAL` and
`Not verified in game`.

The first Phase 3C reviewer turn ended without a verdict after a false-positive platform content filter triggered while
the reviewer described malformed copied-object cases. No files changed and no audit result was accepted from that turn.
The same native Luna reviewer was resumed with neutral local data-consistency wording and the original acceptance bar.
The resumed audit has independently confirmed that all `62` all-kind owner-shape changes and all `20` prior non-applied
owner removals now decline with zero checker exceptions; cross-field profile, local-invocation, `groupIndex`,
`numColumns`, and conditional-owner checks remain in progress. This failed tool attempt is an AAR trigger and does not
advance the candidate.

### Phase 3C independent consistency audit — `FINDINGS`; candidate rejected (2026-08-12)

Status: `PARTIAL / FINDINGS`. The exact production candidate
`DDE9CCA8A8B945710D61103F93E4134EEFA79A246F1830679859A11ED0ACFAD4` is rejected. The audit retained the frozen
producer selftest and Scene hashes
`6287289F02F80DA9E21A6020AFC8ACDA0ED0F1ADE189F3575E6FFE5CC47A99A1`,
`73D97D2E965B58BECC6280B64AAC535EA2FCE30BCA5FE2DE00EC35F99983C246`, and
`2E8C3D698E66C23BB805913ACB1805D817241C3EDAA8E9E0D0D105D6FBCAFB10` before and after; no source, test, Scene,
repository-temporary, or external file was written by the reviewer.

The independent acceptance evidence is:

- producer selftest `448/448`, typecheck clean, four-file ESLint clean, and targeted hygiene clean;
- intended positive census `12/12` accepted, zero false refusals, zero exceptions;
- prior inconsistent-state census `137/137` declined, zero accepted, zero exceptions; and
- late-change matrix `64` total: `2` intended valid states accepted, `47` inconsistent states declined, `15`
  inconsistent states still accepted, and zero checker exceptions.

The four reproduced contract failures are:

1. `P1`, two accepted table column-count inconsistencies: `table.numColumns` may be increased or removed while
   `kernelState.columns.length` remains unchanged because no table-level equality is enforced and cell bounds prefer
   `numColumns`.
2. `P1`, three accepted row-group inconsistencies: row-to-table kernel-slot comparison removes `groupIndex`, even though
   the producer copies the exact table row and the kernel uses that field for row-group width calculations.
3. `P2`, nine accepted conditional/unreachable owner inconsistencies: the `optionalBlockedOwners` branch skips exact
   owner presence checks, allowing both source-impossible additions and removals.
4. `P2`, one accepted local-invocation inconsistency: a value occurrence may be rebound to an existing sibling
   invocation because the validator proves invocation existence but not occurrence-to-invocation provenance.

Profile ingress/pair parity, dynamic-unknown signatures, legitimate unresolved cell-owner absence, and invalid
non-refused wrapper output all satisfied their late checks. Scene stayed frozen and remains exactly `117/119`, with only
`finalized creator scaled height` and `unavailable Helper-negative omitted-width geometry` failing.

Phase 3D is test-only: add one causal fail-first regression for each of the `15` independently reproduced inconsistent
states. Production and both Scene files remain byte-frozen. Expected gate: all historical `448/448` remain green and
the new checks alone fail (`448/463`) with unique names, ready fixtures, zero exceptions, and exact family counts
`1 / 3 / 2 / 9` for local invocation / row `groupIndex` / table column count / blocked owners. Only after independent
acceptance of that oracle may Phase 3E repair production. The renderer remains frozen and B119 remains `PARTIAL / Not
verified in game`.

Phase 3D fixture reconciliation corrected the coordinator's initial row-group wording from the reviewer's retained
evidence. The three `groupIndex` cases start from an emitted row whose row-node and table-slot `groupIndex` are absent and
whose table `rowGroups` is empty; only the row-node snapshot is changed to `1`, `2`, or `999`. The exact nine blocked-owner
cases are conditional `createText` with added `tableId` and added `rowId`; unreachable `createIcon` with added `tableId`
and added `rowId`; conditional `addRow` with row-only `rowId` removed; conditional `setColWidth` with `tableId` removed;
conditional `addRow` with both owners present and separately `tableId` or `rowId` removed; and unreachable row-only
`addRow` with `rowId` removed. The local-invocation case replaces one `createText` width occurrence's `getA` result triple
with its height sibling `getB` triple while leaving the enclosing width occurrence unchanged. This clarification changes
fixture construction, not scope, count, or acceptance criteria.

AAR trigger: the first reviewer turn was lost to a false-positive platform content filter. Resuming the same native
reviewer with neutral local data-consistency wording preserved the evidence boundary and produced the final no-write
verdict. Highest-risk evidenced weakness: aggregate `448/448` looked complete while 15 producer-impossible cross-field
states remained accepted; future producer closes require a fresh copied-state matrix over relationships touched by the
repair, not only the permanent suite.

The Phase 3C rejection and Phase 3D test-only contract are synchronized and read back from GitHub #41 comment
`5270062709`, Notion comment `3ba4618e-d15b-81d1-90e4-001d4f445131`, and Drive revision
`AIroW36LL_hXQuwKnmg3sXth4_PhKT_GJBka7qzzvL-i1o0cQSI5za4ZHs-Cy9Y5fQzA2WSiYt_3KCKmsdfxZA5k0EhrubQpSbmXUFt5-dP1`.
All three contain the rejected hash, `12/12`, `137/137`, the `64`-case late matrix, four residual families, frozen Scene
boundary, and `PARTIAL / Not verified in game`. The first Drive structure request used an invalid mixed legacy/tab field
mask and failed before mutation; the corrected tab-aware request supplied the exact revision and final index used by the
append-only write.

### Phase 3D exact fail-first oracle — accepted after independent `CLEAN` audit (2026-08-12)

Status: `PARTIAL`; test-oracle checkpoint `VERIFIED` for its bounded purpose. Only
`src/lib/x4UiLayoutProgram.selftest.ts` changed, from accepted SHA-256
`6287289F02F80DA9E21A6020AFC8ACDA0ED0F1ADE189F3575E6FFE5CC47A99A1` to
`C00658FDD98E8ADE5B69A0984B257AA863F524600968A13E5035E5B6A955232A`. Production and both Scene files remain
byte-identical at `DDE9CCA8A8B945710D61103F93E4134EEFA79A246F1830679859A11ED0ACFAD4`,
`73D97D2E965B58BECC6280B64AAC535EA2FCE30BCA5FE2DE00EC35F99983C246`, and
`2E8C3D698E66C23BB805913ACB1805D817241C3EDAA8E9E0D0D105D6FBCAFB10`.

Coordinator and independent reviewer both reproduce the exact intended fail-first result:

- selftest exit `1`, `448/463`; every historical `448/448` check remains green;
- exactly `15/15` unique Phase 3D checks are red because the frozen validator returns `valid:true` for a ready
  inconsistent pair;
- exact family counts `1 / 3 / 2 / 9` for local invocation / row `groupIndex` / table `numColumns` / blocked owners;
- `0` unready/no-op fixtures, `0` validator exceptions, and `463/463` unique names;
- typecheck, targeted ESLint, diff check, LF/final-newline/trailing-whitespace, import, and debug-marker gates clean; and
- independent before/after four-hash audit and reviewer writes `none`.

The independent fixture review confirmed the exact local `getA` width to sibling `getB` result-triple change while the
enclosing width expression/location remains unchanged; three row-node-only `groupIndex` additions on an empty-group
baseline with the table kernel unchanged; two exact `numColumns` parity changes from baseline `2`/two kernel columns;
and the nine retained conditional/unreachable owner shapes at exact operation indexes `3`, `4`, `5`, `6`, `7`, and `8`.
Repeated indexes are compatible separate field changes from the same source-exact before shape.

The first worker run had the intended 15 red checks but was not accepted: its local proof compared unlike record shapes
and its blocked-owner selectors did not select the audited emitted shapes. The worker corrected both using exact
invocation triples and a dedicated emitted conditional/unreachable fixture before the accepted hash. Two reviewer
command-construction attempts also failed before producing product evidence; corrected split checks passed. These are AAR
triggers. Highest-risk evidenced weakness: an exact red count can still be invalid evidence when fixture readiness is
wrong, so future tests-first checkpoints must independently parse detail payloads and inspect the selected before shape.

Phase 3E is production-only against the frozen `C00658...` oracle. It must enforce exact table column-count parity,
row-node `groupIndex` parity with its owning table slot whenever the row node carries that field while preserving
table-authoritative Helper row-group metadata, producer-exact conditional/unreachable owner shapes, and value
occurrence-to-local-invocation provenance. It must return `463/463` without changing tests or Scene, preserve intended
partial branches, pass focused dependencies/typecheck/lint, and then survive a fresh independent copied-state audit.
Scene remains frozen; overall B119 remains `PARTIAL / Not verified in game`.

Phase 3E produced a production-only candidate under native Luna worker `019ff1e6-df0c-71e0-831a-4a482169bfb4`,
submission `019ff714-2d63-7340-9377-79fef2d325be`. Its sole write was `src/lib/x4UiLayoutProgram.ts`, now SHA-256
`D6A5EB24750DA3CE4E6D351E925D19FC1A98936B59EBE5715FE4B24DE212EDC8`. Coordinator reproduction is exact
`463/463`, exit `0`: all historical `448/448`, all Phase 3D `15/15`, `463` unique names, zero unready fixtures, and zero
validator exceptions. Focused dependencies remain exact at linter `112/112`, source bundle `PASS`, keep-outs `16/16`,
kernel `29/29`, font `10/10`, text `8/8`, call model `46/46`, and corpus `28/28`; typecheck and targeted ESLint exit `0`.
Scene remains the exact frozen `117/119`, with only finalized creator scaled height and Helper-negative omitted-width
geometry failing. Frozen hashes remain selftest `C00658...`, Scene `73D97D...`, and Scene selftest `2E8C3D...`.

This is not yet an accepted Phase 3E close. Independent Phase 3F audit is active under reviewer
`019ff083-b11a-7aa1-bb7d-5d8da8146355`, submission `019ff725-b713-73a1-b5b8-aa8c09f6c858`. Its required matrix is
`12/12` intended positives, all prior `137/137` inconsistent states declined, the late matrix at exactly `2` valid
accepted plus all `62` inconsistent declined, and fresh systematic probes of optional blocked-owner branches and local
invocation consumers beyond the single frozen `createText` case. Worker completion and `463/463` are not acceptance.

Phase 3E has AAR triggers. The first local-invocation predicate falsely rejected a legitimate sampled expansion and was
narrowed before the candidate became green; blocked-owner reconciliation required multiple historical-positive passes.
Coordinator evidence scripts initially used individual-check property `passed` instead of `pass`, assumed Scene emitted
JSON when it emits text, and counted whole-file trailing whitespace without first isolating the edited ranges; each was
corrected before recording evidence. The full untracked producer has `29` legacy trailing-space lines, none in Phase 3E's
edited ranges, plus LF-only content and a final newline. Because Git does not inspect an untracked file with ordinary
`git diff --check`, exact content scans and frozen hashes are the applicable hygiene evidence. The first Phase 3F dispatch
attempt also failed on coordinator JavaScript quoting before any message or side effect; the corrected submission above
is the operative audit. Highest-risk evidenced weakness remains a green fixed oracle masking nearby optional-branch
bypasses; the independent mutation matrix is the required control.

### Phase 3F independent copied-state audit — `FINDINGS`, Phase 3E candidate rejected (2026-08-12)

Independent reviewer `019ff083-b11a-7aa1-bb7d-5d8da8146355` completed submission
`019ff725-b713-73a1-b5b8-aa8c09f6c858` read-only. Start/end hashes remained production
`D6A5EB24750DA3CE4E6D351E925D19FC1A98936B59EBE5715FE4B24DE212EDC8`, selftest
`C00658FDD98E8ADE5B69A0984B257AA863F524600968A13E5035E5B6A955232A`, Scene
`73D97D2E965B58BECC6280B64AAC535EA2FCE30BCA5FE2DE00EC35F99983C246`, and Scene selftest
`2E8C3D698E66C23BB805913ACB1805D817241C3EDAA8E9E0D0D105D6FBCAFB10`; no write-capable command ran.

The fixed baselines all reproduced: layout `463/463` (`448/448` historical plus Phase 3D `15/15`), Scene `117/119`
with only its two retained failures, all focused dependency counts, typecheck/lint, and `12/12` intended producer states
accepted. The exact prior matrix is now fully green: all `137/137` inconsistent copied states declined, and the late
matrix classified `2` valid states accepted plus all `62` inconsistent states declined with zero exceptions. Of those
late `64`, `63` were dynamically exercised; the invalid-success-wrapper case was verified at the source self-validation
path rather than independently injected through the public API. This evidence confirms Phase 3E repaired its declared
15 cases without weakening the prior validation surface.

Fresh probes rejected the candidate:

- **P1 blocked-owner gap:** systematic conditional/unreachable mutations across `setColSpan`, `createButton`, `setText`,
  `setText2`, and `createEditBox` produced `96` ready states: `56` declined and `40` inconsistent states accepted. For
  each kind/status, the validator accepted removing `tableId` or `rowId` from a source-emitted linked shape and adding
  `tableId` or `rowId` to a source-emitted ownerless shape, with program/authority snapshots mirrored. The cause is the
  explicit kind/status skips in `schemaOperationOwnerShape`, not evidence-derived expected shapes.
- **P1 local-occurrence gap:** direct sibling invocation substitution produced `10` ready states: only `createText`
  declined; `9` inconsistent substitutions remained accepted for `createFrameHandle`, `createButton`, `createEditBox`,
  `createIcon`, `setText`, `setText2`, `setColWidth`, `addRow`, and `addTable`. The general invocation-ledger identity is
  sound, and direct source/location equality is exact, but the occurrence check is invoked only for `createText` without
  local expansion.
- **P3 permanent-oracle gap:** the accepted selftest encodes only the single `createText` local case and omits the five
  blocked-owner skip kinds, explaining why fixed `463/463` did not cover these source-backed variants.

Table `numColumns` parity and directional row `groupIndex` behavior passed fresh probes: exact column parity accepted and
five mismatches/removals declined; two valid group states accepted and three inconsistent states declined. The Phase 3E
candidate is retained as the unaccepted production base because it closes the prior 15 states without observed
regression, but it is not an accepted close and must not unblock Scene.

Reviewer AAR triggers were two PowerShell parser errors, one corrected no-op historical selector, one malformed `rg`
expression, one locked-session-log read attempt, and graph data lacking the untracked B119 symbols; all were excluded
from product counts. Highest-risk evidenced weakness is test-specific validation dispatch: correct predicates can exist
but leave sibling operation kinds unprotected. The bounded control is a generated all-kind/status fail-first matrix plus
an independent copied-state audit after the generalized production repair.

### Phase 3G exact fail-first oracle — `SPECIFIED`, test-only next unit

Freeze production at `D6A5EB24750DA3CE4E6D351E925D19FC1A98936B59EBE5715FE4B24DE212EDC8` and both Scene files. Modify only
`src/lib/x4UiLayoutProgram.selftest.ts` to encode all `49` newly reproduced inconsistent states: the exact `40` blocked-
owner mutations (`5` kinds x `2` statuses x linked-remove/ownerless-add for `tableId` and `rowId`) and exact `9` direct
local-invocation sibling substitutions outside `createText`. Each check must prove fixture readiness, an unchanged
enclosing source occurrence where applicable, the exact before/after copied shape, mirrored authority mutation, no
exception, and current pair-validator acceptance before expecting rejection.

The required fail-first result is exact `463/512`, exit `1`: all existing `463/463` remain green; exactly the new `49`
checks are red; all `512` names are unique; family counts are `40 / 9`; fixture-not-ready and validator exceptions are
zero. Typecheck, targeted ESLint, focused dependencies, frozen hashes, and Scene `117/119` must remain exact. An
independent detail audit must accept that oracle before Phase 3H may edit production to derive blocked-owner shape from
emitted evidence and apply exact direct-occurrence binding across every source-emitted consumer kind. Overall B119 stays
`PARTIAL / Not verified in game`.

Phase 3G ran under native Luna worker `019ff1e6-df0c-71e0-831a-4a482169bfb4`, submission
`019ff73e-a8ba-7943-8aca-bf29ee1eb28e`, with sole write ownership of `src/lib/x4UiLayoutProgram.selftest.ts`. Candidate
selftest hash is `16CD456BDCB133EF5CFF9E834FF5F21D472F163BC087D71A9B855FA768724DD5`. Coordinator reproduction is exact
`463/512`, exit `1`: historical `463/463` green, all and only new `49` red, `512` unique names, family counts `40 / 9`,
zero unready fixtures/exceptions, and all `49` mutated pairs currently accepted. Mechanical detail parsing confirms all
`40` owner tuples are unique across the required kind/status/shape/field Cartesian product with exact mirrored shapes,
and all `9` local cases use distinct invocation IDs while preserving enclosing expression/location and authority snapshot.
Focused dependencies, typecheck/lint, frozen production/Scene hashes, and Scene `117/119` remain exact. One coordinator
PowerShell detail-audit expression failed to parse before evidence; the corrected audit produced the counts above.

Independent Phase 3G oracle review is active under `019ff083-b11a-7aa1-bb7d-5d8da8146355`, submission
`019ff74a-f23b-70c3-8581-51ab8b76054f`. The selftest is not accepted and Phase 3H production remains locked until that
review independently confirms fixture causality, coverage, source structure, hashes, and no writes.

### Phase 3G exact fail-first oracle — accepted after independent `CLEAN` audit (2026-08-12)

Independent reviewer `019ff083-b11a-7aa1-bb7d-5d8da8146355` completed submission
`019ff74a-f23b-70c3-8581-51ab8b76054f` with verdict `CLEAN` and no writes. Start/end hashes remained production
`D6A5EB24750DA3CE4E6D351E925D19FC1A98936B59EBE5715FE4B24DE212EDC8`, accepted selftest
`16CD456BDCB133EF5CFF9E834FF5F21D472F163BC087D71A9B855FA768724DD5`, Scene
`73D97D2E965B58BECC6280B64AAC535EA2FCE30BCA5FE2DE00EC35F99983C246`, and Scene selftest
`2E8C3D698E66C23BB805913ACB1805D817241C3EDAA8E9E0D0D105D6FBCAFB10`.

Independent full-output parsing reproduced exact `463/512`, expected exit `1`: historical `463/463` green, Phase 3G
`0/49` green, all `512` names unique, `49/49` fixtures ready, zero exceptions, current validator accepted `49/49`, and
family counts `40 / 9`. No failed check exists outside Phase 3G.

The owner family is the complete unique Cartesian product of five kinds (`setColSpan`, `createButton`, `setText`,
`setText2`, `createEditBox`), two statuses, two source-emitted shapes, and two fields. Twenty distinct source-emitted
operations each support exactly two field mutations. All linked before-shapes are `{tableId,rowId,cellId}`; all ownerless
before-shapes are `{}`; every mutation changed its requested field, mirrored the authority snapshot and reciprocal node
ledgers, and remained `valid:true / threw:false` before the check expected rejection. Ownerless additions use real applied
table/row IDs unrelated to the source receiver `other`, so they are semantically inconsistent rather than malformed IDs.

The local family covers exactly nine direct, non-expanded source-emitted operations: `createFrameHandle`, `createButton`,
`createEditBox`, `createIcon`, `setText`, `setText2`, `setColWidth`, `addRow`, and `addTable`. Every baseline pair is valid,
the `getA` and `getB` invocation IDs are distinct, only `getA.localInvocationResult` is replaced by the exact `getB`
triple in program/authority, enclosing `getA` expression/location remain unchanged, and validation stays
`valid:true / threw:false`. Discovered paths match the intended consumer fields; no helper selected the same value or a
non-consumer artifact.

Byte-level in-memory removal of only the Phase 3G block and its summary fields reconstructs the previous selftest hash
`C00658FDD98E8ADE5B69A0984B257AA863F524600968A13E5035E5B6A955232A` exactly, proving the prior oracle was not
deleted, renamed, or weakened. Focused dependencies, typecheck/lint, hygiene, frozen hashes, and Scene `117/119` remain
exact. The graph lacks these untracked symbols and remains excluded from acceptance evidence.

Phase 3H is now unlocked as a production-only correction against immutable selftest `16CD456...`. It must remove the
five blocked-owner kind/status skips by deriving exact owner shape from emitted source evidence and apply exact direct
local-result occurrence binding to every direct source-emitted consumer, not a list of nine test kinds. Required result is
exact `512/512` while preserving all prior matrices, intended states, focused dependencies, frozen Scene, and hashes for
all non-production files. A fresh independent all-kind copied-state audit remains mandatory before acceptance. Overall
B119 remains `PARTIAL / Not verified in game`.

The accepted Phase 3G checkpoint and Phase 3H contract are synchronized and read back from GitHub #41 comment
`5271329467`, Notion comment `3ba4618e-d15b-81e2-b13b-001d8163a9fd`, and Drive revision
`AIroW35YQmaJ04Y0YO1NnJk6IzJyA3qKkqhAW7zJWFPnetHku09OFRJITjUcILAUAHsDv5VjZqYDEjcw846y4AHZTUIIYG-tpYBFwpo2l83p`.
All three preserve the accepted selftest hash, exact `463/512` fail-first evidence, byte-level prior-oracle reconstruction,
frozen production/Scene boundary, production-only next unit, and `PARTIAL / Not verified in game`.

Phase 3H production correction is active under native Luna worker `019ff1e6-df0c-71e0-831a-4a482169bfb4`, submission
`019ff753-f2c7-7c72-b70f-46f01a32255e`, with sole write ownership of `src/lib/x4UiLayoutProgram.ts`. The accepted
`16CD456...` selftest and both Scene files are immutable. Acceptance requires exact `512/512`, all focused gates, and a
fresh independent all-kind copied-state matrix; worker completion alone is not acceptance.

Phase 3H produced candidate production hash `B98D1BA4FE864892932656ED856453BC4E20642AA08C4DC4C2D7A211893FAB4C`.
Coordinator reproduction is exact `512/512`, exit `0`: all historical `463/463`, all Phase 3G `49/49`, `512` unique names,
focused dependencies exact, typecheck/lint clean, immutable non-production hashes exact, and Scene still only its two
retained failures at `117/119`. Production is the only worker-owned file changed.

The final owner predicate has no kind/status bypass. It matches metadata references to exact emitted node identities,
derives row/table ancestry from emitted node and parent-path evidence, and preserves legitimate unresolved table/row-only
shapes where no cell materializes. The local predicate traverses complete operation metadata, enforces exact source versus
consumer location per invocation ancestry, uses sample-catalog evidence per consuming operation, and excludes copied
owner/result/data-flow evidence records from consumer occurrence enforcement. It retains the separate exact invocation
ledger checks.

Phase 3H has AAR triggers: the first broad owner closure falsely refused legitimate unresolved partial ancestry; the first
operation-wide local occurrence pass falsely refused expansion/sample/evidence-copy records. Several refinements were
required before `512/512`: exact emitted-node matching, row parent-path ancestry, per-operation sample evidence, expansion
ancestry, and consumer-versus-evidence metadata roles. These are not accepted merely because the permanent suite is green.
Highest-risk evidenced weakness is an exemption that can be attacker-steered by copied metadata, expansion ancestry, or
operation-ID prefix similarity. Independent Phase 3I is active under reviewer
`019ff083-b11a-7aa1-bb7d-5d8da8146355`, submission `019ff76b-e18d-73a2-8ec6-4b7313eace7c`, and explicitly attacks
those mechanisms while rerunning all prior matrices. Candidate remains unaccepted; Scene remains frozen and B119 stays
`PARTIAL / Not verified in game`.

### Phase 3I independent provenance audit — `FINDINGS`, Phase 3H rejected (2026-08-12)

The original reviewer submission was interrupted by an automated content classifier while describing ordinary local
data-integrity probes. It made no writes. The same native Luna reviewer resumed with neutral terminology under submission
`019ff77c-d3f2-7961-9c2a-3ae2be3505cd` and completed the exact frozen boundary. Start/end SHA-256 values remained
production `B98D1BA4FE864892932656ED856453BC4E20642AA08C4DC4C2D7A211893FAB4C`, accepted selftest
`16CD456BDCB133EF5CFF9E834FF5F21D472F163BC087D71A9B855FA768724DD5`, Scene
`73D97D2E965B58BECC6280B64AAC535EA2FCE30BCA5FE2DE00EC35F99983C246`, and Scene selftest
`2E8C3D698E66C23BB805913ACB1805D817241C3EDAA8E9E0D0D105D6FBCAFB10`. Reviewer writes were `none`.

The permanent and prior independent evidence remains sound: producer `512/512`; intended source-emitted positives
`12/12`; historical inconsistent states `137/137` declined; late matrix `2/2` valid accepted plus `62/62` inconsistent
declined; Phase 3F owner-shape substitutions `96/96` declined; direct local-occurrence substitutions `10/10` declined;
zero checker exceptions. Focused dependencies, typecheck, four-file ESLint, hygiene, and immutable hashes passed. Scene
remains exact `117/119` with only its two retained geometry failures.

Fresh source-backed probes reject Phase 3H despite those greens:

- A two-frame/two-table/two-row/two-cell emitted baseline was pair-valid. Five of six coherent sibling provenance
  substitutions remained accepted: `createFrameHandle`, `setColWidth`, `addRow`, unresolved `createText`, and `display`.
  Only `addTable` declined through its separate uniqueness rule. Owner IDs, reciprocal ledgers, receiver/result/semantics
  identities, and authority snapshots all moved coherently to sibling B while the original source/call evidence remained
  on branch A. Expected owners are therefore derived from the candidate metadata being checked instead of independent
  source-call provenance.
- Ten direct sibling occurrence substitutions now decline, but three non-descendant expansion substitutions remain
  accepted: ancestor, sibling expansion, and unrelated top-level expansion. A same-operation sampled-source substitution
  also remains accepted when the nested result triple moves from `getA` to catalogued `getB` while the enclosing `getA`
  expression/location remains unchanged. Descendant substitution and an unknown-wrapper injection decline correctly.
- The selftest collector drops `detail` from passing checks, while the final Phase 3G census reconstructs readiness and
  family names from that detail. The green run therefore reports `phase3G.fixtureNotReady: 49` and family
  `{"unknown":49}` even though the individual checks pass. This does not invalidate the independently accepted Phase 3G
  oracle, but it makes the permanent green summary unable to prove present fixture readiness.

Mechanism: owner shape is computed from operation metadata at production lines approximately `4135-4202`; candidate
ancestry checks prove internal consistency but do not independently bind receiver/result/semantics to the source call.
Local invocation membership is checked, but exact occurrence comparison is skipped for sampled sources and expansion
invocations outside descendant ancestry around lines `4994-5019`. The success wrapper calls the same validator, so
self-validation cannot close either provenance gap.

Phase 3I is a non-clean AAR. Sustains: immutable hashes, exact prior-matrix recovery, split evidence commands, and an
independent reviewer prevented a convincing green suite from becoming acceptance. Improve work/tools: use neutral
data-integrity language for local structural probes, preserve passing-check detail in the oracle, and split complex
PowerShell readbacks after two parser failures that produced no evidence or writes. Highest-risk evidenced weakness is
candidate metadata serving as both claim and oracle; coherent copied state can remain structurally self-consistent while
no longer matching the source call.

### Phase 3J exact fail-first provenance oracle — `SPECIFIED`, test-only next unit

Freeze production at rejected hash `B98D1BA4...FAB4C` and both Scene files. Modify only
`src/lib/x4UiLayoutProgram.selftest.ts`; production repair is forbidden in this phase. Preserve every existing check and
repair the check collector so passing checks retain their detail and the green Phase 3G summary reports zero unready
fixtures with exact families `40 / 9` rather than `unknown`.

Add exactly eleven source-emitted checks against pair-valid baselines:

- six coherent sibling-provenance checks for `createFrameHandle`, `addTable`, `setColWidth`, `addRow`, unresolved
  `createText`, and `display`; the five reproduced false acceptances must be red while `addTable` remains a green negative
  control through its independent uniqueness rule;
- five expansion/sample-context checks: ancestor, sibling-expansion, unrelated-top-level-expansion, same-operation
  sampled-source, and descendant; the first four reproduced inconsistent states must be red while descendant remains a
  green negative control.

Every fixture must prove its unmodified emitted pair is valid, the substitution is non-no-op, authority/reciprocal state
is coherently mirrored where required, the expected source/call occurrence remains unchanged, and the validator call does
not throw. Exact fail-first result is `514/523`, exit `1`: all historical `512/512` remain green; exactly nine Phase 3J
checks are red in families `owner-provenance 5 / occurrence-context 4`; both negative controls are green; fixture-not-ready
and checker-exception counts are zero; current-validator-accepted is exactly nine. The final summary must also retain the
accepted Phase 3G detail census on a green run. Typecheck, targeted selftest ESLint, focused dependencies, Scene
`117/119`, four frozen hashes, line endings, final newline, trailing whitespace, and no debug output must remain exact.
An independent test-oracle audit must accept the `514/523` evidence before any Phase 3K production correction. B119
remains `PARTIAL / Not verified in game`; Scene remains frozen.

The Phase 3I rejection and Phase 3J contract are synchronized and read back from GitHub #41 comment `5272077132`,
Notion comment `3ba4618e-d15b-8146-a341-001d31063ca1`, and Drive revision
`AIroW36RAplrt75Vyj9vXey-Hi89PlXVotAYcg8Xpu7v-XwC0B8_GNZ_PBleOtDBmm2oeJ4kSYAWNXIKoWthv58d4HKdxhQ3z-Wq_RebH2bM`.
All three preserve the rejected hashes, exact prior/fresh censuses, passing-detail defect, `514/523` test-only gate,
frozen production/Scene boundary, and `PARTIAL / Not verified in game`.

Phase 3J implementation is active under native Luna producer `019ff1e6-df0c-71e0-831a-4a482169bfb4`, submission
`019ff78a-09b1-7012-bba8-2e3b664e822f`, with sole write ownership of `src/lib/x4UiLayoutProgram.selftest.ts`. Production,
Scene, documentation, trackers, Git state, and unrelated dirty files are frozen. Producer completion is not acceptance;
coordinator reproduction and a fresh independent test-oracle audit remain mandatory.

The first Phase 3J candidate at selftest hash `DEAEB64D601108003C9F651B508E71032C54F11A80C4A3215A4E524371C6A884`
reproduced top-level `514/523`, historical `512/512`, exact red/control names, truthful Phase 3G `40 / 9`, focused gates,
and frozen hashes. Coordinator review rejected it before independent audit for three oracle-reporting/fixture mismatches:
the sampled case exercised `getB -> getA` instead of documented `getA -> getB`; Phase 3J `historicalGreen` reused the
Phase 3G baseline and printed `463`; and `familyCounts` printed all cases `6 / 5` rather than red families `5 / 4`.
Two coordinator parsing attempts also used nonexistent `passed`/`ok` fields before the corrected `pass` census; they
produced no writes or accepted evidence. Targeted test-only correction is active under submission
`019ff7a3-8c8a-7881-ba45-371e1c556434`. The worker also had one temporary TypeScript helper-narrowing failure before its
final green typecheck. These are AAR triggers; the Phase 3J acceptance contract and frozen production/Scene boundary do
not change.

The corrected Phase 3J candidate selftest hash is
`51BE901FE7CF8F8985879245AC10799ED305CEE6B297764224439368175D03F2`. Coordinator execution reproduces exact
`514/523`, exit `1`, `523` unique names, every historical check `512/512` green, nine new reds, and two green controls.
Phase 3G is truthful at `49/49`, `40 / 9`, zero unready/exceptions. Phase 3J reports historicalGreen `512`, failed
familyCounts `5 / 4`, all-case census `6 / 5`, zero unready/exceptions, and currentValidatorAccepted `9`. The sampled
proof is exactly before `getA()`, replacement/after `getB()`, unchanged enclosing expression/location, valid baseline,
no throw, and current validation `true`. Coordinator typecheck, targeted ESLint, focused dependencies, Scene `117/119`,
scoped diff hygiene, and frozen hashes pass.

Independent test-oracle audit is active under reviewer `019ff083-b11a-7aa1-bb7d-5d8da8146355`, submission
`019ff7a9-3cac-79f3-ae50-7e214787a2f1`. It must prove causal readiness, both controls, truthful summary derivation,
preservation/reconstruction of accepted prior selftest `16CD456...`, exact hashes, and no writes. Candidate is not
accepted and Phase 3K remains locked until `CLEAN`.

### Phase 3J first independent audit — `FINDINGS`, corrected candidate rejected (2026-08-12)

Reviewer `019ff083-b11a-7aa1-bb7d-5d8da8146355`, submission `019ff7a9-3cac-79f3-ae50-7e214787a2f1`, returned
`FINDINGS` with no writes. Start/end hashes stayed production `B98D1BA4...FAB4C`, candidate selftest
`51BE901FE7CF8F8985879245AC10799ED305CEE6B297764224439368175D03F2`, Scene `73D97D...C246`, and Scene selftest
`2E8C3D...FB10`. The reviewer reconstructed the prior accepted selftest entirely in memory by reverting passing-detail
retention, removing only the contiguous Phase 3J additions/summary, and restoring the prior inline Phase 3G count. The
result matched `16CD456BDCB133EF5CFF9E834FF5F21D472F163BC087D71A9B855FA768724DD5` exactly, proving all prior `512`
predicates/names were preserved.

All machine counts and other cases reproduce, but two fixtures violate the causal contract:

- The addTable green control maps `metadata.receiver` through `tableId`, installing tableB's identity where a source
  addTable receiver is its owning frame. It declines with `program addTable receiver does not identify its owning frame`.
  Its proof derives readiness from the same incorrect mapping, so this is a malformed control rather than the intended
  coherent frameB/tableB sibling substitution.
- The sampled case supplies preview sample `sampleWidth`, but independent consumer readback shows that sample is consumed
  only by a separate dynamic addTable, not the mutated expanded createText. The getB catalog entry is a genuine consumer
  of the createText and the `getA -> getB` occurrence gap reproduces, but the explicit sampled-input relationship required
  by this case is absent. `fixtureReady` does not currently prove sample-to-operation ownership.

Phase 3J remains test-only and keeps its exact `514/523` acceptance count. Correct only these two fixtures:

1. For addTable, transfer the coherent sibling relationship from frameA/tableA to frameB/tableB: `metadata.receiver`
   must be exact frameB identity, `metadata.result` exact tableB identity, owner fields and reciprocal operation ledgers
   must match both nodes, operation source/call evidence must remain branch A, baseline must be valid, and the current
   validator must decline through the intended independent addTable source/uniqueness binding rather than receiver shape.
2. Make the selected preview sample a genuine input consumed by the mutated createText operation while retaining exact
   getA/getB invocation results. Readiness must mechanically prove the selected sample catalog entry/ID is linked to that
   operation, sampled and unsampled baselines are valid, `getA -> getB` is non-no-op with unchanged enclosing
   expression/location, authority matches, no throw occurs, and the current validator still accepts it.

All eleven names, exact red/control polarity, Phase 3G detail, Phase 3J `5 / 4` failed and `6 / 5` all-case censuses,
historical `512/512`, frozen production/Scene hashes, focused gates, and no-write boundary remain unchanged. Another
independent test-oracle audit is mandatory before Phase 3J acceptance or Phase 3K production work. Reviewer tool friction
included one optional-field parser error, two in-memory reconstruction setup failures before exact success, and a stale
graph; all were read-only AAR triggers and excluded from product evidence.

The Phase 3J rejection and two-fixture correction contract are synchronized and read back from GitHub #41 comment
`5272537693`, Notion comment `3ba4618e-d15b-8107-be3e-001df5bd1c62`, and Drive revision
`AIroW36vk_BGi_rN9DhU-OaarSq5q_F8L7Nbfy1z1HQR3FJTaLW9QAdow9Ncfg61BJbZaBSiIPzRdGpZsvw5ValoAUVotsIUoa_GpZ2_5j5N`.
All three preserve the exact rejected selftest hash, prior-hash reconstruction, both non-causal fixture findings, unchanged
`514/523` correction gate, frozen production/Scene, and `PARTIAL / Not verified in game`.

The two-fixture correction is active under native Luna producer `019ff1e6-df0c-71e0-831a-4a482169bfb4`, submission
`019ff7b4-9206-7c12-bcdb-d1881da20ed4`, with only `src/lib/x4UiLayoutProgram.selftest.ts` writable. It must make addTable
receiver/result exact frameB/tableB identities and prove the selected sample is consumed by the mutated createText, while
retaining all eleven names, `514/523`, exact summaries, prior reconstruction, and frozen production/Scene. Worker
completion is not acceptance; a second independent audit remains mandatory.

The corrected two-fixture candidate selftest hash is
`66A61597AC4342FC84A165DEFA20583A7FBE612040AAF7CCE6DDAF74AA66BD96`. Coordinator reproduction is exact
`514/523`, historical `512/512`, Phase 3G `40 / 9`, Phase 3J failed `5 / 4` and all-case `6 / 5`, zero unready/exceptions,
and nine current acceptances. The addTable control now has frameA-to-frameB receiver and tableA-to-tableB result identities,
an unchanged source/authority proof, and declines only for `program table identity does not have one unique addTable
operation`. The sampled source now has a structured `sampleWidth` consumer whose exact operation ID/kind/field/source
match the expanded createText `fontsize`; the exact sample binding is consumed and differs from the unsampled binding,
both pairs validate, and getA-to-getB remains accepted with unchanged enclosing occurrence. Typecheck, targeted lint,
Scene `117/119`, scoped hygiene, and frozen hashes pass. One transient proof-helper typecheck failure was corrected before
the final green run.

Second independent audit is active under reviewer `019ff083-b11a-7aa1-bb7d-5d8da8146355`, submission
`019ff7c6-7527-7130-aea5-3d2cd3768a9d`. Its first delivery attempt failed locally because Markdown backticks terminated
the JavaScript tool string; no message or write occurred, and the plain-text resend succeeded. Phase 3J remains unaccepted
and Phase 3K locked pending `CLEAN`.

### Phase 3J exact fail-first provenance oracle — accepted after second independent `CLEAN` audit (2026-08-12)

Independent reviewer `019ff083-b11a-7aa1-bb7d-5d8da8146355` completed submission
`019ff7c6-7527-7130-aea5-3d2cd3768a9d` with verdict `CLEAN` and no writes. Start/end hashes remained production
`B98D1BA4FE864892932656ED856453BC4E20642AA08C4DC4C2D7A211893FAB4C`, accepted selftest
`66A61597AC4342FC84A165DEFA20583A7FBE612040AAF7CCE6DDAF74AA66BD96`, Scene
`73D97D2E965B58BECC6280B64AAC535EA2FCE30BCA5FE2DE00EC35F99983C246`, and Scene selftest
`2E8C3D698E66C23BB805913ACB1805D817241C3EDAA8E9E0D0D105D6FBCAFB10`.

The accepted oracle is exact `514/523`, expected exit `1`: all non-Phase-3J checks `512/512` green, all `523` names
unique, exactly nine Phase 3J reds, and exactly two green controls. Phase 3G remains `49/49`, families `40 / 9`, zero
unready/exceptions. Phase 3J reports historical `512`, failed families `5 / 4`, all-case census `6 / 5`, zero
unready/exceptions, and currentValidatorAccepted `9`. In-memory reversal of only collector detail retention, the contiguous
Phase 3J block/summary, and the prior Phase 3G historical form reconstructs accepted hash
`16CD456BDCB133EF5CFF9E834FF5F21D472F163BC087D71A9B855FA768724DD5` exactly at `534079` bytes.

The addTable control independently proves frameA-to-frameB receiver identity, tableA-to-tableB result/owner identity,
unchanged source/sourceOrder, coherent table ledgers and authority snapshot, and declines only through `program table
identity does not have one unique addTable operation`. The sample case independently proves exact catalog/source/sample
IDs; exact target createText operation ID/kind/`fontsize` field/source consumer; one consumed binding; valid sampled and
unsampled pairs; and exact getA-to-getB replacement with unchanged enclosing occurrence and authority. The descriptor
remains runtime-unknown; acceptance is limited to operation-specific consumed preview evidence and does not claim geometry
resolution. The other nine fixtures remain causal and ready. Focused dependencies, typecheck/lint, Scene `117/119`,
hygiene, final hashes, and no-write containment pass.

Phase 3J's non-clean AAR sustains the independent-oracle rule: three numerically exact candidates were rejected or
corrected before acceptance because summary fields, directionality, receiver identity, or sample ownership were wrong.
Improve work/tools: preserve passing detail, parse the real `pass` field, use plain strings in JavaScript tool messages,
split PowerShell probes, and require structured operation-consumer evidence. Highest-risk evidenced weakness remains a
structurally self-consistent claim serving as its own oracle. Reviewer command-quoting and scan setup failures were
read-only and excluded from product evidence; no graph evidence was used because the current B119 files are untracked.

### Phase 3K independent source-binding production correction — accepted after Phase 3L `CLEAN` audit

Freeze accepted selftest `66A61597...66BD96` and both Scene files. Modify only `src/lib/x4UiLayoutProgram.ts`; tests,
Scene, documentation, UI integration, trackers, and Git state are forbidden during implementation. Preserve the explicit
boundary that pair validation is structural, not authentication of coherently replaced unsigned inputs.

Add detached source-call binding evidence built directly from each selected `ProjectableCall`, not from the emitted
operation, its mutable metadata, node owner fields, authority operation snapshot, status/kind exception lists, sample ID
prefixes, or expansion ancestry guesses. The authority must carry enough closed-schema, frozen, serializable evidence to
bind every operation's original receiver, result, semantics/reference identities, and every localInvocationResult consumer
to its exact call occurrence. If the authority schema changes, version and exact-key validation must change atomically;
unknown/missing/sparse/forged bindings must fail closed.

Validation must compare the emitted operation against that detached call evidence before candidate-derived owner-shape,
node-ledger, sample, or expansion exemptions can authorize it. It must reject coherent sibling owner/receiver/result/
semantics substitutions even when program owners, reciprocal node ledgers, operation snapshots, and candidate metadata all
agree. It must reject local-result substitutions to ancestor, sibling expansion, unrelated top-level expansion, or another
sampled source while preserving exact source-emitted direct, descendant, expanded, sampled, unresolved, partial table/row,
ownerless, conditional, unreachable, and rejected states. No operation-kind list or test-name special case is allowed.

Exact production gate is `523/523`, exit `0`: all historical `512/512` and all Phase 3J `11/11` green; Phase 3G remains
`49/49` with currentValidatorAccepted `0`; Phase 3J has failed `0`, currentValidatorAccepted `0`, all-case census `6 / 5`,
zero unready/exceptions, and the same two controls green. Focused dependency counts, typecheck, production/selftest ESLint,
Scene `117/119` with only its two retained failures, deep freeze/JSON/closed-schema behavior, deterministic replay, exact
hashes for frozen files, line endings, final newline, whitespace, imports, and debug scans must pass.

A fresh independent Phase 3L audit is mandatory before production acceptance. It must rerun intended `12/12`, historical
`137/137`, late `2 + 62`, owner `96/96`, direct local `10/10`, all Phase 3J controls/findings, and fresh all-kind coherent
source-binding substitutions. It must also try modifying/removing/duplicating/reordering the new detached evidence and
cross-operation sampled/expansion bindings while preserving true source-emitted states. Candidate green counts are not
acceptance. Scene remains frozen and B119 stays `PARTIAL / Not verified in game`.

The accepted Phase 3J checkpoint and Phase 3K contract are synchronized and read back from GitHub #41 comment
`5272904725`, Notion comment `3ba4618e-d15b-8174-8241-001dc87622d4`, and Drive revision
`AIroW34Zemne4Qpfb5mAO8GvYNUx_NIRRqe2k_YOmFYByP-anMYCL3We9OQlQB05IPbCr6b-tADYb8jHWzB30nMbO2fh5INoRV_v2VgUTQxZ`.
All three preserve the accepted selftest hash, exact `514/523` evidence and prior reconstruction, corrected causal
controls, production-only source-binding contract, frozen Scene boundary, and `PARTIAL / Not verified in game`.

Phase 3K implementation is active under native Luna producer `019ff1e6-df0c-71e0-831a-4a482169bfb4`, submission
`019ff7d8-2392-76c0-806d-88050f2306a3`, with only `src/lib/x4UiLayoutProgram.ts` writable. Tests, Scene, docs, trackers,
Git state, and unrelated dirty files are frozen. Exact candidate target is `523/523`; coordinator reproduction and fresh
Phase 3L all-kind `CLEAN` audit remain mandatory before acceptance.

The Phase 3K producer returned candidate hash
`D14F4D8929FD237074AA63E379B9AA7DA3A93D96D1CF9637D5E02CBE21668DFB`. Authority schema v3 adds an ordered,
deep-frozen `sourceBindings` ledger constructed directly from each selected call's JSON-normalized metadata and checks it
against emitted operation metadata and authority snapshots before legacy owner/occurrence rules. Coordinator reproduction
is exact: `523/523`, `523` unique, Phase 3G `49/49`, Phase 3J `11/11`, both currentValidatorAccepted counts `0`, typecheck
and zero-warning ESLint green, dependencies `46/46`, `29/29`, `10/10`, `8/8`, `28/28`, `16/16`, `112/112`, source
bundle `PASS`, and Scene exactly `117/119` with only the two retained 8B.1 failures. Frozen selftest and Scene hashes are
unchanged. This is a candidate checkpoint, not acceptance.

Phase 3L read-only acceptance audit is active under reviewer submission
`019ff7e4-8ced-7a21-861a-d3f30a00efa9`. It must independently rerun all prior matrices plus missing/extra/sparse/
duplicate/reordered/cross-operation and receiver/result/semantics/local-result binding probes across every operation kind,
and prove valid direct/expanded/sampled/unresolved/partial/ownerless/conditional/unreachable/rejected states remain
accepted. Phase 3K remains unaccepted until a `CLEAN` result. Non-clean AAR: the producer's first run exposed undefined
members in the detached metadata clone; JSON normalization corrected the JSON-domain mismatch before all final gates.

Phase 3L returned `CLEAN` with exact hashes and no writes. Independent evidence accepted `12/12` intended positives,
declined `137/137` historical inconsistent states, accepted the exact late `2` valid controls while declining `62/62`,
declined `96/96` conditional/unreachable owner substitutions and `10/10` direct local-occurrence substitutions, and
declined `101/101` fresh detached-binding mutations with zero throws. Fresh coverage included all 18 operation kinds,
operation-only/snapshot-only/operation-plus-snapshot/binding-only changes, missing/extra/sparse/duplicate/reordered and
cross-operation entries, receiver/result/semantics/local-result consumers, expanded metadata, and a non-no-op sampled
cross-operation binding. The reviewer found zero shared object references between binding and candidate copies, preserved
all valid direct/expanded/sampled/partial/rejected/conditional/unreachable/ownerless states, and reproduced all focused
gates plus Scene `117/119`. Production hash `D14F4D8929FD237074AA63E379B9AA7DA3A93D96D1CF9637D5E02CBE21668DFB`
is accepted and frozen. This proves structural pair consistency, not origin authentication.

The next bounded unit resumes the existing Scene worker on only the retained `8B.1` failures: finalized creator scaled
height and uniform unavailable geometry for Helper-negative omitted widths. Production and its accepted oracle are frozen;
Scene must reach `119/119` without invented zero geometry, browser measurement, or game-verification claims, then receive
a fresh read-only acceptance audit before Batch 6A closes.

Scene 8B.1 implementation resumed under native Luna worker `019fef89-02a6-7561-81be-e90a987cbd27`, submission
`019ff803-fef3-7a01-99d0-6b3af879b16c`. Only `src/lib/x4UiScene.ts` and `src/lib/x4UiScene.selftest.ts` are writable;
accepted producer/oracle, docs, UI integration, trackers, Git state, and external paths are frozen. Exact fail-first is
`117/119`; exact target is `119/119`, four-kind scaled-height/negative-width parity, all focused gates, and a new
independent Scene audit before acceptance.

Accepted Phase 3K/active Scene projection is synchronized and read back at GitHub #41 comment `5273323633`, Notion
comment `3ba4618e-d15b-8124-8d8d-001d8b7f1f74`, and Drive revision
`AIroW36YVnFWA00-5H6iCYWHVUShS2sQSqwUaeUbfxqWeeJ_Eaz607CFBmuBsMJZangEKNpQvX7m7YEEAO5pIuyZaJiKDxxAK81zKKLr2id2`.
All three preserve the accepted production hash, Phase 3L matrices, structural-not-authentication boundary, active Scene
unit, and `PARTIAL / Not verified in game` state.

Scene 8B.1 reached a candidate `119/119` at Scene hash
`B4A05BC87BDE5D497199A4D7649A59D3F3B489C291DCCCC5F63167479EAB7842` and selftest hash
`26C12C36B51EFE2A7D2D0CA7308390A4CCEBA2857636E4FC717389F5D1A8F0D0`. Coordinator reproduction confirmed
`119/119`, producer `523/523`, repository typecheck, and zero-warning owned ESLint. A fresh read-only audit independently
proved the source-valid behavior: all four creators use raw height `10`, finalized height `20`, and Scene height `20` at
`uiScale=2`; all four omitted-width creators retain exact `-10`, Helper `5372-5388` evidence, unavailable widget geometry,
parent cell geometry, and partial status; twelve real scale/kernel/provenance mutations refused; all focused gates passed;
and no production defect or write occurred. Exact reversal of the final production delta reconstructed prior Scene hash
`73D97D2E...C246`, proving the only production changes were removal of an evaluated-but-unused diagnostic serialization
payload and brace-only formatting. The geometry behavior predates this resume.

The audit verdict is nevertheless `FINDINGS`: P3 permanent-oracle coverage. The two new Scene assertions prove values and
geometry but do not pin each finalized `outerHeight` provenance link or each negative `outerWidth` value, provenance, and
Helper `5372-5388` link. The accepted producer oracle proves the negative value and source pin, but not the resulting Scene
links. Scene 8B.1 therefore remains unaccepted. The next bounded correction is selftest-only in
`src/lib/x4UiScene.selftest.ts`: extend the existing two 8B.1 cases to assert all four exact evidence links and retain real
changed scale, kernel, and provenance rejection controls. Production, producer, all other tests, docs during worker
execution, UI integration, Git state, and external paths remain frozen. Require exact `119/119`, focused gates, unchanged
production/producer hashes, and another fresh no-write `CLEAN` audit before Batch 6A acceptance.

Scene 8B.2 is active under the existing native Luna Scene worker, submission
`019ff827-c0b9-7850-86b7-916119e0ce7e`. Only `src/lib/x4UiScene.selftest.ts` is writable. Exact production and producer
hashes above are frozen; the candidate must remain `119/119` with stronger all-kind provenance and non-no-op boundary
assertions, then pass coordinator reproduction and a new independent no-write audit.

Scene 8B.2 completed at selftest SHA-256
`934B6E68557E357F7F62BC4097184EFDAC1FEABA3E63CCDF62BB9CB94B9CA63A`; Scene production remains
`B4A05BC87BDE5D497199A4D7649A59D3F3B489C291DCCCC5F63167479EAB7842`, and both accepted producer hashes remain
exact. Coordinator reproduction passed Scene `119/119`, producer `523/523`, repository typecheck, and zero-warning owned
ESLint. Fresh independent reviewer submission `019ff832-2fb5-7c43-ba84-0d12dd2df1cd` returned `CLEAN`, zero writes,
and all seven acceptance criteria green: both real fixtures prove pair validity before mapping; all four creators pin raw
height `10`, finalized height `20`, exact source-literal continuity, and the Scene `outerHeight` link; all four omitted-width
creators pin exact `-10`, `source-pinned-default`, Helper `5372-5388`, unavailable widget geometry, retained parent-cell
geometry, linked diagnostics, and partial status; and the twelve four-kind scale/kernel/provenance controls are non-no-op,
pair-invalid, and Scene-refused. Positive and exact-zero width boundaries remain distinct. Batch 6A is therefore accepted
at the focused pure-Scene layer and unblocks the already-specified Batch 6B preview pipeline. Browser, installed-host,
deploy, C++ frame acceptance, and in-game experience remain open; B119 remains `PARTIAL / Not verified in game`.

Scene 8B.2 AAR is non-clean. The first strengthened test run used an incorrect test-only Scene cell lookup, and typecheck
then caught a test-only boolean literal-narrowing assignment; both were corrected without production changes. During
coordinator API reconciliation, an assumed `x4UiLinter.ts` path failed before `rg --files` identified the actual owner
`x4UiLint.ts`; no file changed. Sustain the exact hash stop-gates and independent no-write audit. Improve future API
orientation by resolving file names before querying exports.

The accepted Batch 6A checkpoint is synchronized and read back at GitHub #41 comment `5273815148`, Notion comment
`3ba4618e-d15b-81d7-8e7d-001d66b9e6ec`, and Drive revision
`AIroW34aKGsxvrEt4y5KsHUG4ZVUULaB6QZMlbkiTKeNr7bch85Vi9QItPQ4hQS2go2C2m-jQfThShrba37lFOsI48aznWnC4etNy87kB2ui`.
All three retain the four accepted hashes, focused gates, independent `CLEAN` receipt, pure-Scene scope, Batch 6B next
unit, and unchanged `PARTIAL / Not verified in game` boundary. Repository Markdown remains authoritative.
The Notion task properties were also refreshed and read back as `Status=In Progress`, `Evidence Grade=Partial`, Batch 6A
Scene `CLEAN`/accepted, Batch 6B pipeline active, and the live UI/deploy/X4 gates still open.

The Phase 3F rejection and Phase 3G test-only contract are synchronized and read back from GitHub #41 comment
`5271062148`, Notion comment `3ba4618e-d15b-8112-babc-001d285cab77`, and Drive revision
`AIroW34QwWm_rC-S2McCvoclRWZVoTGTr9nGlvXR4Qf_dP0jw06b5AQa1b-XQjtY_XoOz-YfBBhVu3FfUW6XHboRimW3x4mYctsEMq-F_ujh`.
All three preserve the rejected production hash, `40/96` and `9/10` fresh findings, exact `463/512` next gate, frozen
Scene boundary, and `PARTIAL / Not verified in game`.

The accepted Phase 3D checkpoint is synchronized and read back from GitHub #41 comment `5270316387`, Notion comment
`3ba4618e-d15b-81ee-8cf1-001dcdff9a38`, and Drive revision
`AIroW35if-Cx5nsXoSQKHGAk7VDKAHLtFXhDPfEDUa2XxouivSpcjbVX22n0EwjskWclE29rTeQln1DBqDztQCWbPdr3bvLFIqwGDVQbi332`.
All three preserve the accepted selftest hash, exact fail-first counts, frozen production/Scene boundary, independent
`CLEAN` audit, Phase 3E production-only next unit, and `PARTIAL / Not verified in game`.

The final 8A.5 rejection and active 8A.6 contract were synchronized and read back from GitHub #41 comment
`5266490479`, Notion page `3b84618e-d15b-8190-821e-c0eb96f43d5a`, and Drive document
`17VLaIsT499KHg7zg30hOyLaBXB0-9jlrX3dQ63s3dtE` at revision
`AIroW341C6UJlhubGyCalWJKuKi-H1SvZKf0x3SfGiVbJm1fxzj-jUv1Z0dUJbz_O5AKisATqP--zwp8odiSYXJP4ZoqJYxzmVSDlFF_o89U`.
Each readback contains the `193 / 178 / 15 / 0` census, both P1 mechanisms, exact rejected hashes, frozen scene, active
producer-only scope, and unchanged `PARTIAL / Not verified in game` boundary.

Re-audit AAR: two combined stdin/setup markers, one absent-selector fixture, and one combined boundary-scan command
failed before usable evidence. The reviewer excluded them from product counts, reran the valid selector directly, and
completed literal split scans. The durable tool rule remains: small independent matrices only; setup failures are AAR
evidence, never product evidence.

Coordinator live-checkpoint AAR: one Google Docs read used a legacy body field mask against a tabbed document and
failed before returning evidence; the tab-aware document/text endpoints then succeeded and the appended checkpoint was
read back. One combined documentation patch also used context from the wrong target file and was rejected atomically;
the corrected per-file patch succeeded. Neither failure changed product evidence or implementation state.

Bookkeeping parity for the 8A.4 rejection and active 8A.5 correction was read back from GitHub #41 comment
`5265682197`, Notion page `3b84618e-d15b-8190-821e-c0eb96f43d5a`, and Drive document
`17VLaIsT499KHg7zg30hOyLaBXB0-9jlrX3dQ63s3dtE` at revision
`AIroW371icPTt2nccVBlnKv5tWVb7X0jmovljHoDwfjqL1mg2FnmvQ0opMC8WOtZaUSFLAq2NX_5AsNkRE1l3HqpZ8t8-8uZMf-xV6hIeLZk`.
All three carry the exact rejected hashes, `154 / 116 / 38 / 0` malformed-case census, frozen `117/119` scene, active
producer-only scope, and unchanged `PARTIAL / Not verified in game` state. Repository Markdown remains authoritative.

The later 8A.5 fail-first checkpoint was also synchronized and read back from GitHub #41 comment `5265772862`, the
same Notion page, and the same Drive document at revision
`AIroW34anVOv3jVHuaMhlOIHXHzPYYkAxeHXMxp50-LBWiAUiwhUD8aOKOmmiK4N5LkNPzrxz8-whJO_yX0ComseBHkP4JGYRDHj6x4q9SuR`.
Each surface records `228/266`, exactly 38 intended reds, zero throws, unchanged production, frozen scene, and active
producer repair.

### Acceptance evidence and negative paths

- Geometry goldens cover frame/table offsets, equal/percent/pixel columns, descriptor scrollbar present/absent with both
  reserve modes, border-separated column x positions, row padding/borders, known clipping, fixed and hidden colspan
  cells, multi-column spans, and independent frames/tables. Expected numbers are traced to the pinned Lua lines above.
- Widget goldens cover text, button, edit-box, and icon outer rectangles; explicit versus inherited width/height; primary
  and secondary text identity; left/center/right alignment; regular/bold Zekton glyph-quad translation; multiline wrap;
  truncation; and one known sibling beside one unavailable node.
- Negative fixtures cover refused/structurally incomplete programs while separately proving partial-program sibling
  retention; stale source/profile/hash, malformed dimensions, duplicate scene
  IDs, unknown frame/table/row/cell geometry, unknown scrollbar decision, insufficient rightmost scrollbar width,
  unsupported font/assets, missing glyph/control escape, unavailable C++ color/texture/state, provisional text gaps,
  overflow, and attempts to use preview samples or selected branches as game proof.
- Assert deterministic deep-equal replay, no input or font-byte mutation, all public output deeply frozen, JSON
  serialization, exact source/diagnostic back-links, and a production import-boundary scan. Every non-refused output must
  contain the literal permanent `Not verified in game` state.
- Required focused gates: new scene selftest; current layout-program, call-model, layout-kernel, font-metrics,
  text-layout, corpus-assets, keep-outs, linter, and source-bundle selftests; repository typecheck; and zero-warning
  targeted ESLint over the two owned files. Precommit/oracle/E2E/build/installed-host/X4 validation remains behind the
  unanswered machine-state gate and cannot close this pure unit as browser or game parity.

## BATCH 6B ACCEPTANCE CONTRACT — SOURCE-PINNED PREVIEW PIPELINE (2026-08-11)

Status: `SPECIFIED`; implementation depends on the focused acceptance of Batch 6A. This unit creates one pure,
deterministic orchestration boundary from the existing workspace source authority and configured-corpus evidence to an
exact target catalog, layout program, and scene. It does not fetch, render, mutate source, package, deploy, or claim game
acceptance.

Implementation is active under native Luna producer-context worker `019ff1e6-df0c-71e0-831a-4a482169bfb4`, submission
`019ff83b-94b8-71a0-ad8e-e0758f989f48`. Only `src/lib/x4UiPreviewPipeline.ts` and
`src/lib/x4UiPreviewPipeline.selftest.ts` are writable; both were absent at dispatch. All accepted source/corpus/lint/
producer/Scene owners, docs, UI, Git state, trackers, and external/game/mod paths are frozen. Require a meaningful
fail-first, the complete focused matrix below, exact frozen dependency hashes, coordinator reproduction, and a fresh
read-only audit before acceptance.
The required pre-production fail-first is captured: `tsx src/lib/x4UiPreviewPipeline.selftest.ts` exited `1` with
`ERR_MODULE_NOT_FOUND` while the production module was intentionally absent. The first production draft then ran the
scaffold and repository typecheck exposed only local pipeline typing issues; correction and the full behavioral matrix are
active. This command failure/type correction makes the Batch 6B AAR non-clean even if the final candidate passes.

The first complete candidate remains `PARTIAL`, not accepted. Exact hashes are pipeline
`A9182F898C3AE32BD502BAA4F6B87CC948BD1176C7A11899277EC3F31A9CF020` and selftest
`9402B866DF9ABE2F352D22EFB3F06E700F83FE9E8EA8953A50F391D06231FE2F`; all four frozen Batch 6A hashes remained
exact. Worker and coordinator reproduced pipeline `35/35`, Scene `119/119`, producer `523/523`, call model `46/46`,
kernel `29/29`, corpus `28/28`, font `10/10`, text `8/8`, keep-outs `16/16`, linter `112/112`, source/workspace
bundle `PASS`, typecheck, and zero-warning owned ESLint. Fresh no-write reviewer submission
`019ff863-39af-7fd3-a62d-bbaf97c2d13c` returned `FINDINGS`: the result upgraded `unverified-default` text-height
evidence to `captured`; malformed input fabricated an empty required `widgetPort`; and the permanent oracle lacked a
loader-issued canonical/Scene success, an independent partial-program-to-partial-Scene path, a successful preview-path
selection, and exact blocking-error durability through downstream refusal. Static and dynamic independent probes found
the JSON-normalized call-model handoff byte-equivalent to direct projection, so that handoff is not a reproduced
production defect, but its equivalence still needs a permanent assertion.

Correction submission `019ff871-ab55-7c70-94cf-06abfc8971ef` is active under the same native Luna worker with the same
two-file write boundary. It must add fail-first regressions, preserve text-height grades, model malformed profile evidence
honestly, exercise the public canonical loader through its complete test-only authority path, keep projected/partial/
refused/path/lint cases distinct, pin direct-versus-pipeline call-model equivalence, rerun every focused gate, and receive
a new independent `CLEAN` audit before Batch 6B can be accepted. Overall B119 remains `PARTIAL / Not verified in game`.

The correction candidate is focused-green but still pending that audit. Tests-only fail-first against unchanged production
was exact `40/50`, exit `1`; the final selftest is `50/50`, exit `0`. Corrected hashes are pipeline
`7E1ABF68D33E3DF2C3304A0FD22766CB292D9E6A49386B670223BEF5F191D97D` and selftest
`C578C93B5C36E136C8CCEC23CA699DCAE19232B33A47D33BE910D74B13065016`; all four Batch 6A hashes remain exact.
Worker and coordinator again reproduced every declared focused owner: Scene `119/119`, producer `523/523`, call model
`46/46`, kernel `29/29`, corpus `28/28`, font `10/10`, text `8/8`, source/workspace `PASS`, keep-outs `16/16`, linter
`112/112`, typecheck, zero-warning owned ESLint, and clean diff/hygiene. The new oracle separately reports canonical
projection, partial program/Scene, refused program, successful preview path, blocking-lint durability, canonical-loader
authority, and crypto restoration. Fresh no-write re-audit submission `019ff890-ff54-70d2-b4e5-f7d7e44e3c7e` must also
decide whether allowing a partial Scene beside a projected canonical program is honest and whether the detached-model
equivalence assertion sufficiently proves the no-rebuild row. Batch 6B remains `PARTIAL` until that review returns.

That re-audit returned `FINDINGS`, with zero writes and all six hashes unchanged. The canonical fixture is behaviorally
valid and distinct from the partial-program fixture: its producer is `projected` with twelve applied operations and zero
producer gaps, while Scene conservatively remains `partial` with nonempty `1/1/1/4` frame/table/row/cell geometry and
three widgets because runtime-only scrollbar/text/interaction/texture facts remain unavailable. However, those exact
identity, pin, and geometry facts are diagnostic detail rather than pass conditions and must become causal assertions.

Reconciliation also corrected the earlier raw-equivalence assumption. Exact workspace call models contain optional
object members whose values are JavaScript `undefined`; the accepted strict JSON-domain producer refuses such raw
objects before projection. Batch 6B therefore does not require the false claim that raw and JSON-normalized producer
calls both succeed. The no-rebuild acceptance row instead requires an explicit, bounded normalization contract: reuse the
already-built call model; omit only object members whose value is `undefined` (and preserve the existing array JSON
mapping if present); prove the raw and normalized models have identical `JSON.stringify` bytes, exact source identity,
call order/count/ranges/metadata for every defined value, and unchanged caller input; prove direct normalized projection
is byte-equal to pipeline projection; retain the exact raw producer refusal as boundary evidence; and retain the source/
import proof that no scanner, parser, or call-model builder is invoked. This is an integration normalization, not a call-
model rebuild. It may not remove, rewrite, default, or reorder any defined evidence. Final correction remains limited to
the two Batch 6B files and must receive a new independent `CLEAN` audit.

Final oracle-only correction submission `019ff89c-1464-7d40-b10f-e04ade8ef058` changed only the selftest, from
`C578C93B5C36E136C8CCEC23CA699DCAE19232B33A47D33BE910D74B13065016` to
`DDFAD0F2929B617353B22494A8C2540D4A495A34036F52E2EAC7C0B423A9F538`; production and all four Batch 6A hashes
remain exact. Worker and coordinator reproduce pipeline `57/57` plus every declared focused gate. Canonical acceptance
now causally requires loader authority, projected `12/12` operations, zero producer gaps, exact source/dimensions/
Helper/widget/all-font identities, exact `1/1/1/4/3` geometry, and nested game truth, with three non-no-op rejection
controls. Static and dynamic normalization audits retain exact raw producer refusal, prove the permitted JSON mapping and
defined-evidence preservation, compare normalized direct output to pipeline output, preserve inputs/game truth, and reject
four non-no-op defined-evidence/order mutations. Final no-write acceptance audit submission
`019ff8ae-8ecf-78a0-aa1f-17c6d3025c5e` is active; Batch 6B remains `PARTIAL` unless it returns `CLEAN`.

The final audit returned `CLEAN`, with zero writes. It found both second-review findings causally closed, all original
Batch 6B acceptance rows passing, and all six first-review findings still closed. Exact accepted hashes are pipeline
`7E1ABF68D33E3DF2C3304A0FD22766CB292D9E6A49386B670223BEF5F191D97D` and selftest
`DDFAD0F2929B617353B22494A8C2540D4A495A34036F52E2EAC7C0B423A9F538`; Scene, Scene selftest, producer, and producer
selftest remain frozen at their accepted hashes. Coordinator final reproduction passed pipeline `57/57`, Scene
`119/119`, producer `523/523`, call model `46/46`, kernel `29/29`, corpus `28/28`, font `10/10`, text `8/8`,
source/workspace `PASS`, keep-outs `16/16`, linter `112/112`, repository typecheck, zero-warning owned ESLint, exact-hash
readback, no-builder/import boundary scans, and diff hygiene. Batch 6B is therefore focused-accepted. This does not prove
browser rendering, editor integration, deploy identity, C++ frame acceptance, or in-game visibility; overall B119 remains
`PARTIAL / Not verified in game`.

Batch 6B AAR is non-clean. The required absent-module fail-first, local typing correction, first independent-review
production defects and missing fixtures, and second-review correction of the false raw-success equivalence assumption all
fired triggers. Sustain the fail-first/frozen-hash/fresh-review sequence. Improve by making every reported identity and
geometry fact part of the pass predicate from the first oracle draft and by separating raw JSON-domain refusal from the
bounded integration normalization contract before claiming equivalence. Highest-risk evidenced weakness: an oracle can
print correct evidence while its verdict ignores it, or can normalize both comparison sides and hide the production
boundary. The implemented causal predicates and seven non-no-op mutation controls are the bounded mitigation.

Accepted Batch 6B was synchronized and read back without closing the feature: GitHub #41 comment `5274809846`, Notion
comment `3bb4618e-d15b-8137-b63f-001d412db698`, and Drive revision
`AIroW34Gt_rL0bVF3JcVCp9NV4gy4dJU-zQfsh850pwXMLwGDTFM-5ihI_pyNVSzBqwgC7riCNENd2fnRU6vAbFTF2b0VwQtB-Jboy9V0zP4`.

### Reconciled authority and boundary

- Reuse `buildX4UiWorkspaceSource`, its existing source bundle/call models, `lintX4UiCallModel`,
  `createX4UiLayoutTargetCatalog`, `projectX4UiLayoutProgram`, `projectX4UiScene`, and the canonical configured-corpus
  result. Do not create another
  scanner, Lua parser, workspace store, source registry, corpus route, profile persistence layer, or layout model.
- A preview source is identified by the existing source-file index, raw path, and call-model source identity. A target is
  identified by its exact catalog ID and source range. No function name, path basename, list position, or first candidate
  may silently stand in for an exact selection. Missing or stale selection returns a visible `needs-selection` or refusal
  state with all candidates; it never previews a different target.
- Read-only preview may retain diagnostic evidence from a locked or generated-shadowing source bundle when that bundle is
  internally valid, but the result must preserve the workspace authority/ship status. It may not relabel a locked preview
  as editable or shippable. An unavailable or ambiguous root/source remains unavailable.
- The configured X4 corpus remains the only production source of shipped Helper/widget/font bytes. Synthetic corpus
  evidence is test-only and can never be promoted to canonical production evidence.

### Bounded implementation

- Add only `src/lib/x4UiPreviewPipeline.ts` and `src/lib/x4UiPreviewPipeline.selftest.ts`. The module is pure and may
  import only the accepted source, corpus evidence types, call-model/linter, layout-program, layout-kernel provenance,
  scene, text-policy, and font-metric owners. It may not import React, DOM, Canvas, CSS, fetch/network, filesystem,
  process, server, persistence, package/deploy, or source-mutation code.
- Export an exact preview-profile builder and one pipeline projector. Profile input explicitly supplies positive finite
  drawable width/height and UI scale, a stable provenance label, and truth grade `supplied`, `captured`, or
  `unverified-default`. Optional C++ text-height evidence, local-expansion limits, scalar samples, path selections, and
  table view state retain their existing evidence grades; omitted runtime/C++ values stay unavailable.
- Port `widgetSystem.scaleSizeMinValue(insize, minvalue) = max(minvalue, floor(insize * uiScale + 0.5))` from
  `widget_fullscreen.lua:8725-8726`. Derive table border from `(2, 2)`, row-group/container offset from `(4, 3)`, and
  Helper scrollbar width from `scaleSizeMinValue(4, 3) + scaleSizeMinValue(4, 3)`, exactly matching
  `widget_fullscreen.lua:867-868, 8702-8708` and `helper.lua:705-712`. Pin Helper text/button defaults `16/25` and
  view/border assignment sites at `helper.lua:522, 533, 707-710`. Browser CSS or device-pixel-ratio values are never
  substituted for these inputs.
- Construct matching layout and scene profiles from the same source identity, drawable dimensions, Helper/widget hashes,
  canonical regular/bold Zekton identities, and explicit provisional text policy. All defaults visible in the later UI
  are labelled `unverified-default`; captured/supplied grades require caller input and do not imply game verification.
- Lint every materialized Lua source directly from the source bundle's already-built call model, including registered and
  unregistered files, and retain each file's registration/authority state. Findings and verification gaps are available
  even when no render target is selected or scene projection refuses. Do not rebuild a call model just to lint it, and do
  not collapse linter errors, warnings, unverified gaps, or truncation into one green/failed boolean.
- Project exactly one selected source/target. Preserve target/sample/path catalogs and precise refusal/gap states so the
  later UI can request missing preview-only values without mutating source. A partial program remains a partial scene;
  a refused program cannot produce scene geometry. Every output branch carries the literal `Not verified in game`.
- Return immutable, JSON-serializable phase data for source availability, corpus identity, source/target candidates,
  selected identities, normalized profile facts, program, scene, gaps/refusals, and ship/edit authority. Do not catch a
  deterministic refusal and replace it with an empty successful preview.

### Acceptance evidence and negative paths

- Goldens prove exact profile metrics at UI scales below, at, and above the minimum/rounding boundaries, including the
  brief's 2560x1440 / approximately 1.4 unverified-default profile. Width/height/UI-scale changes must flow through the
  accepted Helper/widget port and change only their dependent facts.
- Fixtures cover source-owned, locked-readable, generated-shadowing, unavailable, duplicate-root, canonical-corpus,
  stale-corpus, no-source selection, no-target selection, duplicate same-named targets, exact target selection, stale
  target ID/range, partial program, refused program, preview samples/paths, and table view state. Ambiguous candidates
  must never auto-select.
- Linter fixtures prove that all source-file findings remain source-located and available before target selection, that
  unregistered files are not silently dropped, and that a renderer refusal cannot erase or downgrade a blocking lint
  diagnostic.
- Assert no call-model rebuild, no input/font-byte/workspace mutation, deterministic deep-equal replay, complete deep
  freeze, JSON serialization, exact source identities, and permanent game-truth label.
- Required focused gates: new pipeline selftest plus scene, layout-program, call-model, layout-kernel, corpus-assets,
  font-metrics, text-layout, source-bundle, workspace-source, keep-outs, and linter selftests; repository typecheck; and
  zero-warning owned-file ESLint. Heavy host/UI/game gates remain deferred under the machine-state gate.

## BATCH 6C ACCEPTANCE CONTRACT — CANVAS PAINT PLAN AND KEEP-OUT COMPOSITION (2026-08-11)

Status: `IN PROGRESS`; implementation begins only after Batch 6B focused acceptance and external readback. Baseline:
both owned files are absent; accepted dependency hashes are pipeline
`7E1ABF68D33E3DF2C3304A0FD22766CB292D9E6A49386B670223BEF5F191D97D`, pipeline selftest
`DDFAD0F2929B617353B22494A8C2540D4A495A34036F52E2EAC7C0B423A9F538`, Scene
`B4A05BC87BDE5D497199A4D7649A59D3F3B489C291DCCCC5F63167479EAB7842`, Scene selftest
`934B6E68557E357F7F62BC4097184EFDAC1FEABA3E63CCDF62BB9CB94B9CA63A`, font metrics
`EF898F640D6285A908343962D86F69B95BD609272F3A2636A984BA029ED4B695`, text layout
`D0B1962D9EE12E3C88DC19543C3A2E3771331B6150728B8858A93F7ECE1E74FB`, corpus
`F08195B48B858F4721A50CA946FA73672F87FD87C923CE5DFBD9D18F32BEC4D2`, and keep-outs
`3715EB1380A2913FD41BAE756493DA1B388CB65EF8B7C3A6C199061343860C8F`. This unit creates deterministic Canvas draw
commands; it does not own source
selection, parsing, layout, browser sizing, interaction, source mutation, package/deploy, or game verification.
Native Luna submission `019ff8c2-3a98-7af3-b6d3-ce97b5f22e18` owns only the two absent paint-plan files. It must record
the absent-production `ERR_MODULE_NOT_FOUND` fail-first before writing production, then satisfy the complete contract,
focused gate matrix, exact dependency hashes, coordinator reproduction, and a fresh independent no-write `CLEAN` audit.
That fail-first is captured: exact `npx.cmd tsx src/lib/x4UiPaintPlan.selftest.ts` exited `1` with
`ERR_MODULE_NOT_FOUND`; production was absent and only the owned selftest existed. Production implementation and full
acceptance-oracle expansion are now active in the same bounded submission.
First-draft coordinator review reproduced required corrections before candidate acceptance: preserve the intentional
projected-program/partial-Scene case; distinguish valid negative positions from unsafe dimensions; use the measured
conversation Back-row identity for `y=0.788` rather than the separate option-stack `y=0.74`; prove bold through matching
source-derived text-layout/font identities rather than relabelling regular evidence; and route background, selection,
gap, icon/material diagnostic geometry through the same accepted clip hierarchy as glyphs. Permanent goldens must include
partial cell, widget, and glyph clips plus deterministic multi-frame layer/z/source ordering. The correction remains
inside the same two owned files and still requires all focused gates and fresh independent `CLEAN`.

The corrected candidate is focused-green but not accepted. Exact hashes are production
`887294D0EF42D7A05504FABE62A82F78859485AD38015400FCB70E323E2F4FC9` and selftest
`BA634F665DDF7ABCE6C9E4FD83B69412E559FD8220013C374EFF9E945022D94D`. Worker and coordinator reproduce paint plan
`31/31`, Scene `119/119`, font metrics `10/10`, text layout `8/8`, corpus `28/28`, keep-outs `16/16`, preview pipeline
`57/57`, source/workspace `PASS`, repository typecheck, zero-warning owned ESLint, exact dependency hashes, and clean
diff/static boundary scans. The permanent oracle now includes source-derived regular/bold text, two frame layers,
deterministic layer/z/source ordering, clipped cell/widget/glyph/background/gap/selection/unsupported diagnostics, empty
clips, exact measured guides, all four context labels, wrapper/direct truth refusals, canonical-corpus identity, and
malformed hierarchy/atlas/dimension/duplicate negatives. Fresh independent read-only `CLEAN` remains mandatory.

### Independent rejection and tests-first correction contract (2026-08-12)

The fresh no-write audit `019ff8f0-825a-7e91-adc5-3517603c1832` returned `FINDINGS`; the hashes above are rejected,
not accepted. It executed `78/78` probes: `71` inconsistent inputs, `20` correctly refused, `51` incorrectly accepted,
`7/7` intended-valid controls accepted, and zero checker throws. Start/end hashes for both owned files and all eight
frozen dependencies remained exact, and the reviewer wrote no files. The existing `31/31` suite and all declared
focused gates stayed green, proving that the current oracle is incomplete rather than that the findings are pre-existing
gate failures.

The same two-file unit must now install the reproduced cases as causal fail-first predicates before production repair:

- Enforce exact reciprocal, ordered frame/table/row/cell/widget/text/glyph ancestry before deriving command clips,
  frame ownership, or ordering. The audit accepted all `13/13` parent/membership removal or reassignment probes and
  demonstrated both clip expansion to the full drawable and a changed emitted frame ID while the semantic frame ID
  remained unchanged.
- Require a materialized glyph to have matching layout evidence and reconcile every consumed text/line/glyph/layout-quad
  field in both directions. Missing layout, foreign line membership, impossible line index, source/code-point range
  drift, invalid UV/quad facts, code-point drift, and bitmap-bound drift must refuse.
- Close Scene source and selection records. Profile file/path/hash must agree with source-bearing Scene evidence;
  selection must be an exact record whose source agrees with selected nodes. Primitive selection, stale source, and
  nested game-truth fields must refuse rather than silently disappear.
- Validate keep-out projections against the existing keep-out owner's closed IDs, context membership, evidence grades,
  status/reason combinations, viewport bounds, and exact keys. Unknown IDs, invented grades, wrong context/member pairs,
  out-of-viewport guides, duplicate IDs, and nested truth fields must refuse while all four valid context controls stay
  green.
- Bind ordering to accepted source evidence: finite valid frame layer/z domains, exact source order rather than mutable
  self-reference, canonical gap order, and a positive fixture containing genuinely distinct frame layers. Golden ordering
  assertions must use an independent expected order, not values re-read from the candidate.
- Preserve each gap's exact own source even when its linked program node has no Scene geometry. The unchanged producer
  fixture currently loses or widens `4/13` gap source links; require all-gap source equality.
- Apply closed recursive schemas to every consumed nested Scene, diagnostic, provenance, and style record. Reject the
  five reproduced false engine/game/paint additions instead of silently sanitizing them.
- Require positive drawable width and height. Add zero-width and zero-height empty-Scene negatives.

The repair remains confined to `src/lib/x4UiPaintPlan.ts` and `src/lib/x4UiPaintPlan.selftest.ts`. Freeze every accepted
dependency at the hashes above; preserve all `7/7` valid controls, exact keep-out guides, partial/empty clipping behavior,
recursive freeze/serialization/nonmutation, and literal `Not verified in game`. Rerun the complete focused matrix,
coordinator reproduction, exact hash readback, boundary/diff scans, then require a new independent no-write `CLEAN`
audit. Browser, React, Canvas execution, editor integration, deploy, installed-host, and game proof remain out of scope.

The review triggered the AAR: one combined inline probe was excluded after Windows rejected command length before Node,
and the reviewer records six excluded harness-construction failures total (four command-length and two inline-syntax)
plus one mistyped initial hash filename. None supplied product evidence. Sustain exact hash stop-gates and producer-shaped
mutation controls; improve by using short, independently parseable probe matrices on Windows from the start. The
highest-risk evidenced weakness is a convincing green selftest that permits inconsistent ancestry to change clipping and
frame assignment.

Tests-first receipt: before any production repair, the expanded paint-plan selftest ran `34/85`, exit nonzero, with
exactly `51` intended red predicates, zero unready fixtures, and zero validator throws. This causally reproduces the
independent accepted-escape census inside the permanent oracle. Production repair may now proceed through shared
validation chokepoints in the same owned source file; no red may be deleted, weakened, or converted to printed-only
detail to obtain green.

First production-pass checkpoint is rejected at `14/85`: all 51 named malformed mutations reached refusal, but an
over-broad Scene JSON-domain/schema gate also refused legitimate baseline, clipping, and keep-out controls. This is a
validator overconstraint, not product acceptance. Narrow the gate to exact consumed closed contracts and preserve valid
Scene compatibility before reclassifying any remaining red.

The narrowed candidate reached `85/85`, exit `0`, with all 51 reproduced mutations refused and no fixture/throw errors,
but its interim report names only three valid controls. The acceptance contract requires the independent audit's `7/7`
intended-valid controls. This remains a candidate discrepancy: map all seven to causal permanent predicates, add any
missing four, and rerun before final focused-gate/hash evidence.

The valid-control discrepancy is closed in the permanent oracle. The stable repaired candidate is production
`D7C901D3A52F0489766E590A43417EC5039F2D1414C41DB57E9CAFF524A0BE3B` and selftest
`E2B1F6022C338DD94542CB1911A6B5FEB4D514F40B93429AA74DE169052F9556`; it remains unaccepted pending a new
independent no-write audit. The selftest is `85/85`, with `51/51` inconsistent mutations refused, three explicit refusal
controls green, all seven intended-valid controls separately named and machine-counted `7/7`, zero unready fixtures, and
zero validator exceptions. The seven positives are: all four keep-out contexts; canonical regular glyph/atlas commands;
source-derived bold text; partial glyph clipping; empty-clip diagnostics without raster; partial cell clipping; and partial
widget plus unsupported-runtime-paint clipping.

Worker and coordinator independently reproduce Scene `119/119`, preview `57/57`, call model `46/46`, kernel `29/29`,
font `10/10`, text `8/8`, corpus `28/28`, keep-outs `16/16`, source/workspace `PASS`, typecheck exit `0`, zero-warning
owned ESLint, diff/hygiene/boundary scans, and every frozen dependency hash. One coordinator wrapper combining lint,
hash, and whitespace checks failed at PowerShell parse time before any check ran; it is excluded from evidence, and the
three smaller corrected commands all passed. The first production repair also fell to `14/85` by blanket-refusing valid
Scene inputs; narrowing to consumed closed contracts restored the positives. Both failures remain AAR triggers.

The final audit must repeat the 51 families and independently probe coherent edits that preserve local shape, especially
an arbitrary valid 64-hex source SHA substituted consistently across all available source-bearing evidence, coherent
file/path rewrites, empty/source-only selections, same-offset gap reordering, closed preview binding/selection records,
and unknown nested engine/paint truth aliases. A syntactically invalid or all-zero SHA alone does not prove source
identity authority. If the paint-plan input lacks independent mod-source hash authority, the audit must classify whether
the accepted Scene is the documented trust boundary or whether the public builder contract remains forgeable; do not
silently call this closed.

Fresh no-write audit submission `019ff939-a3b2-75c2-82e8-74d2d1747d04` is active against the two exact candidate hashes
and eight frozen hashes above. Its hash stop-gate passed; wait for its complete causal census and `CLEAN` or `FINDINGS`
before any focused acceptance or editor integration.

### Second independent rejection and authority correction contract (2026-08-13)

Audit `019ff939-a3b2-75c2-82e8-74d2d1747d04` returned `FINDINGS`, zero writes; both candidate and all frozen hashes
remained exact. The repaired `85/85` oracle causally closes its original `51/51` malformed cases and keeps `7/7` valid
controls. The independent extension executed 41 probes: 20 accepted, 21 refused, zero throws, with ten unique inconsistent
mechanisms accepted. An additional gap-source matrix correctly refused `11/11` mismatches. Three fixture setup attempts
(wrong loader discriminator, malformed descriptor length, unsupported content type) are excluded from product evidence.

The remaining source-backed findings are:

- **P1 source attribution:** any nonzero 64-hex profile SHA and a coherent profile/node/gap file/path rewrite are accepted,
  then copied into output. A local string-shape check is not independent source authority.
- **P2 layout reciprocity:** layout glyph `x`, `y`, and `lineBoxY`, line `breakReason`, and line
  `sourceCodePointRange` can diverge from Scene evidence without refusal.
- **P2 preview closure:** preview sample/path array members use a generic JSON-domain check; added `engineStatus`,
  `paintColor`, `runtimeAccepted`, and `gameTruth` aliases remain accepted.
- **P2 gap order:** equalizing source offsets, reversing gaps, and renumbering sequential IDs changes emitted diagnostic
  order while passing the current nondecreasing-offset check.
- **P3 oracle:** the fixture declares menu-table layers, not actual `createFrameHandle` option layers; projected frame
  layers are `[4,4]`, so the required distinct-layer sort path is still not exercised and the expected order is derived
  from the candidate itself.

Reconciliation expands the correction only where existing owners must supply missing authority; duplicating another
source hash or Scene parser inside the paint plan is forbidden:

1. `x4UiScene.ts/.selftest.ts` preserve the layout line's exact `sourceCodePointRange` as first-class Scene evidence.
   Add it to the public line shape, producer copy, closed schema, and source-backed tests. Do not infer or recalculate it.
2. `x4UiPreviewPipeline.ts/.selftest.ts` become the independent mod-source authority already naturally available at the
   exact selected source/target chokepoint. Add a private `WeakMap`-backed, loader-result-identity authority for only
   successful projected/partial pipeline results and one exported paint-source predicate. The authority records immutable
   source-bound Scene evidence needed by paint: exact model identity including SHA; node source locations/order; exact
   gap sequence and source metadata; closed preview sample/path records; and text/glyph source evidence. Clones, forged
   records, refused/needs-selection results, stale source, coherent rewrites, or changed recorded source evidence must not
   validate. Preserve result shape and all existing pipeline behavior. Legitimate candidate Scene-only clip/status
   variations used to prove paint clipping may remain valid only when the recorded source evidence is unchanged.
3. `x4UiPaintPlan.ts/.selftest.ts` require that issued preview authority in addition to canonical corpus evidence and
   reject missing/unissued/stale authority. Reuse its source-bound predicate before copying attribution or emitting gaps.
   Complete direct layout reciprocity for `x`, `y`, `lineBoxY`, `breakReason`, and the newly preserved line
   `sourceCodePointRange`. Make the fixture pass truly distinct frame layers through real frame options and assert an
   independently declared expected order.

Implementation is sequential and tests-first: Scene red/green first; preview-authority red/green second; paint red/green
last. Writable paths are exactly those six files. The accepted corpus, font, text, keep-out, call-model, kernel,
layout-program, source/workspace, and linter owners remain frozen. Preserve all prior 51 negatives, 7 positives, exact
guides, clip behavior, deep freeze/JSON/nonmutation, and literal `Not verified in game`. Required final evidence includes
all three focused suites, every prior dependency gate, typecheck, six-file zero-warning ESLint, hashes/scans, coordinator
reproduction, and another fresh independent no-write audit. Browser/editor/deploy/game work remains out of scope.

This audit triggers the AAR. Sustain beyond-oracle coherent mutations and exact hash/no-write gates. Improve by declaring
the issuing authority before downstream source attribution and by proving fixture semantics rather than comments/source
spelling. Highest-risk evidenced weakness: a locally consistent Scene can be relabelled to another source and still emit
convincing source-linked paint evidence.

Native Luna correction submission `019ff950-deb9-75a2-9f83-b45640d828f4` owns exactly the six sequential files above.
Its first gate is exact baseline hashes, then Phase S, P, and C red/green in order. No downstream integration may start.

Phase S fail-first is captured before Scene production changes: exact Scene selftest exited `1` at `119/120`. The sole
intended red is exact line `sourceCodePointRange` preservation; missing, malformed, and altered-field negatives are
installed and already pass. Minimal direct-copy/schema production repair is now authorized.

Phase S final is `120/120`, exit `0`. Scene now preserves the accepted layout line's exact code-point range. Phase P is
tests-only until the private preview issuance-authority fail-first is captured.

Phase P fail-first is captured against unchanged preview production: `63/66`, exit `1`. Exactly three positives are red:
intact issued authority, clip-only candidate allowance, and projected-program/partial-Scene allowance. Clone/refusal,
source rewrite, gap reorder, changed line evidence, and preview-alias negatives are installed and green. Private issuance
record/predicate production work is now authorized.

Phase P final is `66/66`, exit `0`. Positives prove intact issued authority, clip-only candidate allowance, and
projected-program/partial-Scene allowance. Negatives cover deep clone, refused/needs-selection, coherent source rewrite,
gap reorder/renumber, line evidence drift, and preview alias/truth forgery. Phase C pre-layer fail-first is `87/94`, exit
`1`, with exactly seven reds: authority clone, stale authority, line code-point range, glyph quad `x`, `y`, `lineBoxY`,
and coherent source rewrite. Missing authority and gap-order controls already refuse. Paint production remains untouched
until the distinct-layer oracle and fixture-only red/green are captured.

The distinct-layer fixture/oracle is now causal without a paint production edit. Phase C is `88/95`, exit `1`: prior
`51/51` malformed cases refuse, three refusal controls and all `7/7` intended-valid controls pass, including genuine
distinct frame-layer ordering. Exactly seven reds remain: authority clone, stale authority, line code-point range, glyph
quad `x`, `y`, `lineBoxY`, and coherent source rewrite. Paint production repair is now authorized at its authority and
layout-reciprocity chokepoints.

Phase C focused final is `95/95`, exit `0`: all seven new reds are closed; the original `51/51` malformed mutations
refuse; three refusal controls and all `7/7` intended-valid controls pass. The temporary selftest compatibility fallback
was removed, so actual issued preview authority is mandatory on the real paint call path. This is candidate evidence only;
complete owner/dependency/type/lint/hash gates and fresh independent review remain required.

The six-file correction is now coordinator-reproduced but remains unaccepted. Exact candidate hashes are Scene
`B11E4C64576B9D5DC4B53FED8C25D8783295863936896F9404C8926AFD888334`, Scene selftest
`C4CE51D6D2E8936820A9CBCC6094152670A7E2C1A2AFF55BB109700B26570F8E`, preview pipeline
`ABCB9AEF1C155B9CE572A9A57B3D2E9336125F81F5B9841F2C18FD9AEFAF1927`, preview selftest
`A829DE930284E45A968670056FFA7D9EE8F0EC514475A28C8FF8C11D2EA78412`, paint plan
`315E6E423CA6F04D8CA7FCAFB0AC96AD120B8A0A5DB8145B7C93EC66F717DB2E`, and paint selftest
`494D5F9041D8F89019254DCF3D0A1894BF2E55E661FCA08FFB045CFB71F45B06`. Coordinator validation passed Scene
`120/120`, preview `66/66`, paint `95/95`, producer `523/523`, call model `46/46`, kernel `29/29`, corpus `28/28`, font
`10/10`, text `8/8`, keep-outs `16/16`, linter `112/112`, source/workspace `PASS`, repository typecheck, six-file
zero-warning ESLint, frozen dependency hashes, and boundary/diff/hygiene scans. A fresh independent no-write audit must
return `CLEAN` before focused acceptance or any editor integration; overall B119 remains `PARTIAL / Not verified in game`.

### Third independent rejection and complete issued-Scene authority correction (2026-08-13)

Fresh no-write audit submission `019ff975-8297-7e01-9609-c024be9e94b0` returned `FINDINGS`; all six candidate and
eight frozen-owner hashes remained exact before and after, Git status was unchanged, and no repository or temporary file
was written. Every focused gate remained green, including Scene `120/120`, preview `66/66`, paint `95/95`, producer
`523/523`, call model `46/46`, kernel `29/29`, corpus `28/28`, font `10/10`, text `8/8`, keep-outs `16/16`, linter
`112/112`, source bundle `PASS`, typecheck, six-file ESLint, diff, and boundary/hygiene scans. Those gates therefore remain
candidate evidence, not acceptance.

The independent probe census executed 15 successful cases with zero product exceptions. Of ten mutation cases, six were
incorrectly accepted and changed the emitted paint plan, one non-allowlisted table `zOrder=-10` mutation was accepted
without an output change in that fixture, and three correctly
refused. Exact issued-result controls behaved correctly: a cloned result refused, an unchanged Scene clone and direct/
wrapper forms remained usable, source rewrite refused, preview aliases and gap reorder refused, and altered-profile cross-
result pairing refused.

The material defects are:

- **P1 issued-Scene coverage:** the private record authenticates the preview result identity but retains only source/order
  summaries for most nodes and omits drawable dimensions, rectangles, owner/parent ledgers, frame layers, z-order,
  completeness, and other paint-consumed Scene facts. Starting from a real issued result, coherent cell `rect.x`, drawable
  width/profile width, frame layer, table `zOrder`, and reciprocal table/frame reassignment changes all remained accepted;
  all but the fixture's `zOrder` case changed geometry, logical drawable, order, or frame ownership in the paint plan.
- **P2 text/glyph coverage:** coordinated glyph/layout changes bypass the local Scene reciprocity check because the issued
  record omits layout geometry and glyph identity/quad facts. Coordinated glyph `quad.x` plus layout-quad `x`, and glyph
  `codePoint` plus layout code point, remained accepted and changed paint output.

The existing candidate hashes are rejected. Reconciliation keeps paint production, Scene production, corpus, and all
other accepted owners frozen. The bounded correction owns only `x4UiPreviewPipeline.ts/.selftest.ts` plus the paint
selftest needed to prove the public call path. Replace the partial Scene evidence projection with one immutable normalized
snapshot of the complete issued Scene and compare a candidate against that snapshot before paint. The normalization may
allow only the exact documented test variations: root Scene `status` may conservatively change from projected to partial,
and existing Scene-node `clipRect` fields may change for clipping tests. Do not use generic recursive key-name stripping;
`programStatus`, geometry, drawable/profile dimensions, owners/parents/membership, layers/z/source order, completeness,
provenance, text/layout/glyph facts, gaps, preview records, verification, and every other field remain exact. Keep the
private WeakMap, successful-result issuance gate, canonical corpus gate, no serialized token/output-shape change, and
literal `Not verified in game`.

The repair is tests-first. Install causal predicate-level and public paint-path regressions for every reproduced P1/P2
family, first prove they are red while all previous `66/66` and `95/95` controls remain green, then change preview
production only. Retain positive intact-clone, clip-only, and projected-program/partial-Scene cases; retain cloned/unissued/
refused/needs-selection/stale/source/gap/preview-alias negatives; add coordinated geometry, topology, order, drawable,
glyph-position, and glyph-identity attacks plus nonmutation/freeze/output-shape checks. Rerun every focused gate, exact
hash/boundary readback, coordinator reproduction, and another fresh no-write audit. No React/editor integration may start
before `CLEAN`; overall B119 remains `PARTIAL / Not verified in game`.

This rejection and correction contract are synchronized and read back without closing the feature: GitHub #41 comment
`5276263923`, Notion comment `3bb4618e-d15b-81b7-a7e9-001db08a7aa0`, and Drive revision
`AIroW35QBDlqjglRZDowCYgKgl8BedpYyAKE_V8QaEkUa9ESYVKNVXKWHTPDKuujZsRCZWFmJu217bu_KaYVpl8rZVezLB-NYBCSx0bl6o2A`.

### Complete issued-Scene authority fail-first receipt (2026-08-13)

Native Luna submission `019ff98b-1069-7303-8d99-557f953a1f4c` completed the tests-only phase without changing
production. The coordinator reproduced both suites on the authoritative host: preview is exactly `66/74`, exit `1`, and
the public paint path is exactly `95/103`, exit `1`. All previous `66 + 95 = 161` predicates remain green. Exactly eight
new predicates are red in each suite, with `fixtureReady=true`, a real changed candidate, zero product exceptions, and
current incorrect acceptance: cell geometry, coherent drawable/profile width, frame layer, reciprocal table/frame
reassignment, paired glyph/layout `x`, paired glyph/layout code point, table z-order, and a broader non-allowlisted node
completeness guard. The paint-path receipt preserves its prior `51/51` malformed refusals, `3/3` authority controls, and
`7/7` valid controls.

The protected host hashes at this red checkpoint are preview production
`ABCB9AEF1C155B9CE572A9A57B3D2E9336125F81F5B9841F2C18FD9AEFAF1927`, preview selftest
`FC64FB8782D59408A6E96BD56759686D1B93EB699221030199F8D25EA45037E7`, paint production
`315E6E423CA6F04D8CA7FCAFB0AC96AD120B8A0A5DB8145B7C93EC66F717DB2E`, paint selftest
`2D11721BECC0603DB5CDF12FDCB5AC937EE6CBF7E75B2D2A74F2E21DBA5593B9`, Scene production
`B11E4C64576B9D5DC4B53FED8C25D8783295863936896F9404C8926AFD888334`, and Scene selftest
`C4CE51D6D2E8936820A9CBCC6094152670A7E2C1A2AFF55BB109700B26570F8E`.

Production repair is now authorized in `src/lib/x4UiPreviewPipeline.ts` only. Both selftests, paint/Scene production, and
every accepted owner are frozen at the hashes above. Replace the partial evidence record with a normalized complete
issued-Scene snapshot; permit only root projected-to-partial status and top-level Scene-node `clipRect` variation for the
existing clip path. Do not recursively strip `status` or `clipRect`: `programStatus`, gap/scrollbar state, nested
scrollbar clipping, and every other Scene fact remain exact. Required green receipt is preview `74/74` and paint
`103/103` with no output-shape/token change, followed by all focused gates, host hash/boundary readback, coordinator
reproduction, and a fresh no-write `CLEAN` audit. No editor integration is authorized yet; overall B119 remains
`PARTIAL / Not verified in game`.

The first strict-JSON production pass is rejected at preview `53/74` and paint fixture `1/3`, owned hash
`44ECBA7FF5FB54FF227425448EFF636A839066805C7ECC668825C845F987134C`; all five frozen hashes remained exact. It
correctly failed closed but could not issue any real Scene because the accepted Scene model contains explicit optional
`undefined` members, first observed at `$.frames[0].provenanceLinks[0].operationId`. The earlier instruction to reject
all `undefined` therefore contradicted the actual accepted Scene contract and is superseded.

The subsequent sentinel pass is also rejected at preview `72/74` and paint `97/103`, owned hash
`3A8EF3E3DE8069598A9532C3FF43E9079F735564B4618038773CE43573B63F54`; all eight authority attacks refuse, but the
existing JSON-clone, clip, and conservative-partial positives correctly establish that optional object-valued
`undefined` is not identity evidence. Final normalization must therefore omit only own enumerable object properties
whose data value is `undefined`, exactly matching the established JSON-domain handoff. Undefined array values remain
invalid; sparse/decorated arrays, actual symbols, functions, bigints, accessors, cycles, non-finite numbers, and
non-plain objects still refuse. Missing and explicit undefined object properties are intentionally equivalent; every
defined value and key remains exact. No sentinel, logging, serialized token, or result-shape change may remain.

The frozen Phase T tests also introduced eleven TypeScript readonly-assignment errors in the paint selftest and one
unused-local ESLint warning in the preview selftest. Runtime predicates are causal, but repository acceptance cannot
pass with those static defects. Sequence the correction: first make preview production exact `74/74` and `103/103`
with both tests frozen; then freeze production and mechanically repair only those test typing/lint defects without
changing fixtures, mutations, predicates, names, counts, or expected outcomes. Rerun the full focused matrix afterward.

The final production-only normalization candidate is now focused-runtime green and coordinator-reproduced: preview is
exactly `74/74`, paint is exactly `103/103`, the eight Phase T issued-Scene attacks are `8/8` causal refusals with zero
unready fixtures or exceptions, and all prior valid controls remain green. `src/lib/x4UiPreviewPipeline.ts` is frozen at
SHA-256 `317DB32A492CDBB3727A9CC5B7FE5A6222A1814A62F1C83D402B957B01C7C12E`; no sentinel, debug output, serialized
token, or result-shape change remains. The protected hashes remain preview selftest
`FC64FB8782D59408A6E96BD56759686D1B93EB699221030199F8D25EA45037E7`, paint production
`315E6E423CA6F04D8CA7FCAFB0AC96AD120B8A0A5DB8145B7C93EC66F717DB2E`, paint selftest
`2D11721BECC0603DB5CDF12FDCB5AC937EE6CBF7E75B2D2A74F2E21DBA5593B9`, Scene production
`B11E4C64576B9D5DC4B53FED8C25D8783295863936896F9404C8926AFD888334`, and Scene selftest
`C4CE51D6D2E8936820A9CBCC6094152670A7E2C1A2AFF55BB109700B26570F8E`. This is not accepted yet: native Luna
submission `019ff9f1-a0cb-7fd0-b69b-51fb8f14de38` owns only the two Phase T selftests for the mechanical static cleanup;
repository typecheck, six-file zero-warning ESLint, exact hash readback, and a fresh independent no-write `CLEAN` audit
must still pass before editor integration. Overall B119 remains `PARTIAL / Not verified in game`.

The sequenced test-only cleanup is complete and independently reproduced on the authoritative host. Preview remains
exactly `74/74`; paint remains exactly `103/103`, including Phase T `8/8` with zero unready fixtures/exceptions, prior
malformed refusals `51/51`, authority controls `3/3`, and valid controls `7/7`. Repository typecheck and six-file
zero-warning ESLint both exit `0`. Production hashes remain preview
`317DB32A492CDBB3727A9CC5B7FE5A6222A1814A62F1C83D402B957B01C7C12E`, paint
`315E6E423CA6F04D8CA7FCAFB0AC96AD120B8A0A5DB8145B7C93EC66F717DB2E`, and Scene
`B11E4C64576B9D5DC4B53FED8C25D8783295863936896F9404C8926AFD888334`; the mechanically corrected selftests are
preview `24E3C66979913A33F93421FBD1F7EAA5169B977083D08A36912681F73A717F87`, paint
`BCD2AB87D8F0BAD7CBBE32D9B86B4EC7A1129C3E330E12FBDC99611BA0CA8643`, and unchanged Scene
`C4CE51D6D2E8936820A9CBCC6094152670A7E2C1A2AFF55BB109700B26570F8E`. Fresh native Luna audit
`019ffa06-d1e9-70a0-8f60-1166714c20df` is active with zero write authority. Only its independent `CLEAN` permits Batch
6C focused acceptance and Batch 6D implementation; overall B119 remains `PARTIAL / Not verified in game`.

### Fourth independent rejection and prototype-safe Scene correction contract (2026-08-13)

The final no-write audit returned `FINDINGS`, zero writes, after independently reproducing the exact six hashes, preview
`74/74`, paint `103/103`, Phase T `8/8`, malformed refusals `51/51`, authority controls `3/3`, valid controls `7/7`,
repository typecheck, and six-file zero-warning ESLint. Its source-level P2 finding is causal enough to reject the
candidate: issuance snapshots only own JSON-domain properties, while paint validation and geometry selection read
optional Scene fields through ordinary prototype lookup. A non-enumerable inherited `rect`, `zOrder`, `outerRect`,
`naturalRect`, or `clipRect` can therefore affect paint without appearing in the issued authority snapshot. The auditor
did not mutate the repository and exact before/after status and hashes match.

The correction remains bounded to the existing preview/paint authority seam; Canvas Batch 6D stays locked. First add
runtime fail-first coverage using a real issued fixture and reversible prototype pollution, with cleanup in `finally`.
Prove every affected inherited field is either ignored as non-Scene data or deterministically refused before paint, never
consumed; prove a custom non-plain prototype still refuses; and prove equivalent own-property Scenes and all established
clip/status positives remain green. Then make the narrowest production correction so validation and rendering consume
only the canonical own-property Scene domain already recorded by authority. Do not add a public token, sentinel, clone
fallback, debug channel, browser dependency, or result-shape change. Required acceptance is the expanded preview/paint
focused suites, Phase T and all prior counters, repository typecheck, zero-warning owned ESLint, exact frozen dependency
hashes, coordinator host reproduction, and a fresh independent no-write `CLEAN` audit. This failed audit is an AAR
trigger; overall B119 remains `PARTIAL / Not verified in game`.

The bounded correction candidate is now tests-first and coordinator-reproduced on the authoritative host. The fail-first
paint receipt was exactly `104/109`, exit `1`: inherited `rect`, `outerRect`, and `naturalRect` changed unavailable
geometry to source-derived geometry; inherited `zOrder` changed accepted command order; inherited invalid `clipRect`
changed acceptance. All five fixtures were ready and non-throwing, while the custom non-plain-prototype refusal control
stayed green. Production now reads those optional paint facts only through own-property access. Final preview is `74/74`;
paint is `109/109`, including unchanged malformed `51/51`, authority `3/3`, valid `7/7`, Phase T `8/8`, and new
prototype boundary `6/6`, with zero fixture or validator exceptions. Repository typecheck and exact six-file
zero-warning ESLint exit `0`. Candidate hashes are paint production
`300DD9AD9434E220E9D3FF995FA70DE94FDE2EEA79468E5DE9879F4DA946ED15` and paint selftest
`900ED6D64CF474E08FD69BFFE71063A319030BE87E8A795B39D5C5AC913D91F6`; all four preview/Scene hashes remain exact.
Fresh zero-write audit `019ffbbd-e29f-72b3-a7cb-515c9be51693` must enumerate every downstream inherited optional field,
not only the original five. Only its `CLEAN` permits focused Batch 6C acceptance and unlocks Canvas Batch 6D. Overall
B119 remains `PARTIAL / Not verified in game`.

### Fifth independent rejection and closed-domain materialization contract (2026-08-13)

Audit `019ffbbd-e29f-72b3-a7cb-515c9be51693` returned `FINDINGS`, zero writes, with exact before/after status and six-hash
parity. It independently reproduced preview `74/74`, paint `109/109` and every named counter, typecheck, and six-file
zero-warning ESLint. The five guarded fields and custom-prototype refusal pass, but that repair is rejected because it
does not close the authority boundary. Paint validates the issued own-property snapshot and then continues to validate
and render the original prototype-bearing Scene. Direct optional reads remain for ancestry/ownership/layer fields,
table/row/cell/widget/view state, text font/layout, source/provenance/gap fields, nested identity pins, and wrapper
`keepOuts`/`selection`. Inherited values can therefore change acceptance, hierarchy, ordering, raster font choice,
diagnostic attachment/source, or output without appearing in issued authority. The auditor classified four P1 and two
P2 families; no P0/P3 was found.

The next correction must close the domain structurally, not add another field list. Tests-first, add representative
causal inherited-property attacks for every audit family and prove no fixture/setup exception. Extend the existing
private preview authority seam with one public verifier/materializer that, only for the exact issued result and accepted
candidate Scene, returns a deeply frozen recursively own-property Scene projection whose plain records have null
prototypes. It must expose no token, snapshot, sentinel, log, or clone-based authority; the existing boolean predicate may
delegate to it. It must preserve only the established root `projected -> partial`, direct own node `clipRect`, and own
object-`undefined` equivalences, while continuing to refuse custom prototypes, accessors, symbols, sparse/decorated
arrays, undefined array slots, cycles, nonfinite values, functions, and bigint.

Paint must unwrap direct Scene/result wrappers through own properties, obtain that materialized Scene immediately after
corpus/input checks, and use only the materialized Scene for all validation and commands. It may never read the original
candidate afterward. Optional input `keepOuts` and `selection` must be read only when own and must be validated/copied
into the same inheritance-free data domain before consumption; inherited wrapper values are absent. Canonical corpus
authority remains loader-issued and unchanged. Required evidence is causal fail-first counts, expanded preview/paint
suites with every prior counter exact, null-prototype/deep-freeze/JSON determinism checks, repository typecheck,
six-file zero-warning ESLint, exact hashes, coordinator host reproduction, and a new independent zero-write audit that
enumerates the full boundary. Canvas Batch 6D remains locked and B119 remains `PARTIAL / Not verified in game`.

The closed-domain correction candidate is now tests-first and coordinator-reproduced on the authoritative host. Preview
fail-first was exactly `74/89`, exit `1`, with all `15` new materializer tests red and zero unready fixtures/exceptions.
Paint fail-first was exactly `117/127`, exit `1`: `10` closed-domain reds with zero unready fixtures/exceptions; seven
prototype attacks changed accepted output/acceptance, inherited `keepOuts`/`selection` emitted commands, input and Scene
wrapper getters were invoked, and a custom-prototype selection was accepted. Every pre-existing malformed, authority,
valid, Phase T, and prototype-boundary check remained green.

Production now exports one WeakMap-gated verifier/materializer, returns a fresh deeply frozen recursive own-data Scene
whose records have null prototypes, and retains no token or public snapshot. Exact result identity is mandatory; clone
authority refuses. Candidate own `status` and direct own node `clipRect` allowances survive in the materialized Scene;
all malformed JSON-domain families still refuse. Paint unwraps Scene/result inputs through own descriptors, obtains the
materialized Scene before validation, and exclusively consumes it. Optional own `keepOuts`/`selection` are separately
materialized; inherited values are absent and malformed/accessor/custom values refuse.

Coordinator host reproduction is preview `89/89` (`15/15` closed domain) and paint `127/127` (`18/18` closed domain),
with pre-existing `103/103`, malformed `51/51`, authority `3/3`, valid `7/7`, Phase T `8/8`, and prior prototype boundary
`6/6` exact; all fixture/exception counters are zero. Repository typecheck and exact six-file zero-warning ESLint exit
`0`. Candidate hashes are preview production `F1D7062E04AA1E7EE8F7DFBBB1A7C444F88C8D508AADE5949F233097C08B0759`,
preview selftest `31B8EC410F59952651C0E473C60A96D239EC3DF9340D68BD71691C3E5375AF99`, paint production
`0FBF2928436D689D42A37286A9CA5BD23953B0CE63B779FA11EF02037A90CBDF`, and paint selftest
`43F266F2326F8DB63ADEA32ABEA4E6D360CA72854B11BA249A88F14D182CE303`; both Scene hashes remain exact. A fresh
independent zero-write full-boundary audit remains mandatory. Only `CLEAN` accepts Batch 6C and unlocks Canvas Batch 6D;
overall B119 remains `PARTIAL / Not verified in game`.

Fresh no-write audit `019ffbf7-d938-7022-b26d-7516ca1ae66f` returned `CLEAN`, zero writes, and exact before/after
six-hash plus scoped-status parity. It independently reran preview `89/89` with closed domain `15/15`, paint `127/127`
with all old/new counters exact, repository typecheck, exact six-file zero-warning ESLint, and complete source/static
authority review. It found no retained original-candidate alias, accessor invocation, prototype escape, corpus bypass,
public authority leak, truth escalation, or test-oracle defect. All `15 + 18` closed-domain checks were causal,
fixture-ready, non-vacuous, independently asserted, and cleaned up. Batch 6C is therefore `VERIFIED` at the focused pure
paint-plan boundary. This does not verify browser pixels, the Forge editor, package/deploy, C++ frame acceptance, or X4
rendering; B119 remains `PARTIAL / Not verified in game`. Canvas Batch 6D is now unlocked under its existing bounded
acceptance contract.

The accepted Batch 6C checkpoint is synchronized and read back at GitHub #41 comment `5285331097`, Notion comment
`3bb4618e-d15b-81e2-93c3-001d06d2ba02`, and Drive revision
`AIroW35VX58JivbT3O7MSGFQxOELaadevCdJZ_aYdz0iaDmcrrqJt8NjqGzZGHmnPrPoCMYBVPHJPYXepVHexfgHsTrTxzKdDHylpyZMzhKD`.
The first Drive append attempt returned an internal connector error and did not mutate the document; a fresh
revision/tail read followed by one end-of-segment retry succeeded. This is an AAR trigger, not a product failure.

### Reconciled authority and boundary

- Consume the accepted scene, exact canonical Zekton decoded A8 atlases, and accepted `x4UiKeepOuts` projections. Scene
  logical coordinates are authoritative for placement. Browser layout, `measureText`, `fillText`, CSS flex/grid, DOM
  measurement, and guessed font metrics are forbidden.
- Engine colors, materials, textures, hover/active state, scrollbar runtime visibility, and C++ acceptance remain unknown.
  Source geometry and diagnostic presentation are separate command layers. Any placeholder palette is explicitly named
  diagnostic and can never be described as an X4 engine color.
- Keep-outs are a separate design-time overlay layer. They never alter scene rectangles, clipping, z order, target
  selection, linter severity, or package output. Measured guides retain their evidence grade; unmeasured ticker/top-HUD
  entries remain visible as unavailable facts rather than invented rectangles.

### Bounded implementation

- Add only `src/lib/x4UiPaintPlan.ts` and `src/lib/x4UiPaintPlan.selftest.ts`. Export one pure builder producing an
  immutable, serializable logical-size paint plan with explicit ordered layers: background/diagnostic geometry, exact
  bitmap glyph alpha blits, diagnostic gaps/selections, and keep-out overlays.
- Clip every command to the accepted scene/node clip hierarchy. Empty clips produce no raster command but remain in
  diagnostics. Text uses scene glyph quads and exact atlas alpha bounds/identity; no command may contain browser-rendered
  text. Unsupported icons/materials produce labelled diagnostic geometry, not fake engine artwork.
- Preserve frame layer/source order and stable node/source IDs in every command. Partial/unavailable nodes use separate
  diagnostic styles and links. The plan itself and every overlay retain `Not verified in game`.
- The later Canvas adapter will set the backing store from logical drawable dimensions and use CSS only to scale the
  finished bitmap. Device-pixel ratio may improve display sampling but must not change logical layout or text wrap.

### Acceptance evidence and negative paths

- Golden plans cover independent layers/frames, nested clipping, zero clips, partially clipped cells/widgets/glyphs,
  regular/bold alpha blits, deterministic z/source order, selected-node diagnostics, the wheel guide at normalized
  `y=0.788`, video-left guide at normalized `x=0.664`, context presets, and unavailable keep-outs.
- Negative fixtures refuse malformed/stale scene/font identities, out-of-bounds atlas reads, unsafe dimensions,
  duplicate command IDs, parent/clip violations, and any attempt to mark engine paint or game verification true.
- Static boundary checks reject `measureText`, `fillText`, DOM/CSS/React/server/filesystem imports, and browser-layout
  calculations. Assert no input/atlas mutation, deterministic deep-equal replay, deep freeze, JSON serialization, and
  permanent truth label.
- Required focused gates: new paint-plan selftest plus scene, font-metrics, text-layout, corpus-assets, keep-outs, and
  pipeline selftests; repository typecheck; and zero-warning owned-file ESLint. Actual Canvas rendering, screenshot
  inspection, installed-product proof, and X4 parity remain later gates.

## BATCH 6D ACCEPTANCE CONTRACT — CANVAS PAINT ADAPTER (2026-08-13)

Status: `SPECIFIED / UNLOCKED`; Batch 6C received a fresh independent no-write `CLEAN`. This bounded
unit converts the accepted serializable paint plan into browser Canvas pixels. It does not parse Lua, project layout,
select source, fetch the corpus, mutate workspace/source, integrate React, package, deploy, or claim game acceptance.

### Reconciled owner and truth boundary

- Add only `src/lib/x4UiCanvasRenderer.ts` and `src/lib/x4UiCanvasRenderer.selftest.ts`. Consume an accepted
  `X4UiPaintPlanResult` plus the exact loader-issued canonical corpus result; never consume Scene/call-model/program
  inputs directly or rebuild paint commands.
- Set the backing-store width and height from `plan.logicalDrawable`. CSS scaling, browser layout, device-pixel ratio,
  and container dimensions may not feed back into X4 geometry, glyph placement, line breaks, or command order.
- Traverse the four paint layers and every command in their issued order. Rasterize glyphs from the matching regular or
  bold Zekton A8 atlas bytes and the exact source/destination rectangles. `fillText`, `strokeText`, `measureText`, DOM
  text, browser fonts, and guessed advances are forbidden.
- Geometry, gaps, selections, unsupported runtime paint, unavailable nodes, and keep-outs use one exported explicitly
  diagnostic palette. The palette is not an X4 color/material claim. Every success/refusal receipt retains
  `Not verified in game` and `gameVerified:false`.
- The renderer may define a minimal Canvas/surface contract and an injectable surface factory for deterministic tests,
  but production defaults must exercise the real browser 2D Canvas API. No server, filesystem, network, React, package,
  workspace, or source-edit dependency belongs in this module.

### Required behavior and negative paths

- Positive fixtures prove exact backing-store size, layer/command order, clipping save/restore balance, independent
  frame/layer order, regular and bold alpha source selection, deterministic scaled blits, geometry/selection/gap
  diagnostics, wheel guide `y=0.788`, video-left guide `x=0.664`, polygon keep-outs, unavailable overlays, empty layers,
  and deterministic replay without mutating the plan, corpus, or atlas bytes.
- Refuse before drawing on a refused/malformed paint result, noncanonical/stale corpus, atlas identity or dimension
  mismatch, unsafe/nonfinite rectangle, out-of-bounds source read, impossible destination, duplicate/out-of-order
  command, game-truth escalation, missing 2D context, failed image/surface allocation, or unsupported command kind.
  Refusal clears no caller state and never returns a partial-success claim.
- The fake-context oracle must record every state/draw call and prove zero browser-font APIs. Static scans reject
  `fillText`, `strokeText`, `measureText`, CSS/React/server/filesystem/network imports, and any `gameVerified:true` path.
- Required gates: renderer selftest; paint, preview, Scene, font, corpus, keep-out, text, kernel, call-model, producer,
  linter, and source/workspace focused suites; repository typecheck; zero-warning owned/focused ESLint; exact frozen
  dependency hashes; boundary/debug/whitespace scans; coordinator reproduction; and a fresh no-write review. Browser
  screenshot evidence remains a later React integration gate, so this pure adapter can close only `FOCUSED VERIFIED`.

### Rollback

Remove the two new adapter files. The accepted paint plan and every source/corpus/layout owner remain byte-identical;
no workspace, corpus, installed extension, mod, game directory, or configuration is mutated.

### Batch 6D reconciliation amendment — structural order, callback isolation, and atomic owned surface

Coordinator review rejected the first `31/31` candidate despite green focused dependencies. The first correction matrix
was causal at `35/43`, exit `1`, with exactly eight reds: three coherent order mutations rendered; three post-validation
callbacks rendered after changing glyph destination `x=5 -> 6`, canonical alpha `255 -> 0`, and drawable width
`100 -> 101`; and two caller-target commit failures restored dimensions but left observable setter/draw traces.

The bounded repair distinguishes two contracts that the original wording conflated:

- The adapter must prove structural order consistency: across the fixed four-layer tuple, command order numbers are one
  complete unique `0..N-1` set, and each layer array is increasing. Offsets, gaps, duplicates, stale order fields, and
  incoherent reorderings refuse. A coherently reordered array whose order fields are also rewritten into a complete,
  internally consistent sequence is a different structurally valid paint plan. Detecting that as a forgery would require
  private producer-issued authority that `x4UiPaintPlan` does not expose; Batch 6D does not invent or claim origin
  authentication.
- The renderer owns its final composite surface. It allocates, stages, and paints through the production browser factory
  or injected test factory, then returns that surface only with a separate deeply frozen success receipt. It no longer
  mutates a caller-owned target. Any refusal discards internal surfaces and returns no surface, giving later React
  integration an atomic adopt/swap-on-success boundary.
- Before any surface/context callback, the renderer must descriptor-safely detach every operation primitive and copy the
  required A8 bytes. Immediately before success it must revalidate/fingerprint the original paint result and recheck
  exact canonical-corpus authority. Callback mutation therefore refuses without returning a surface and cannot alter
  rendered commands through a stale live reference.

This amendment changes no accepted Scene/paint/corpus/font owner and does not weaken game truth. Batch 6D remains
tests-first and can close only `FOCUSED VERIFIED`; browser adoption, screenshot proof, deploy identity, and X4 remain
open and `Not verified in game`.

### Batch 6D first independent audit rejection — oracle-completeness correction

Fresh zero-write Luna audit `019ffcda-c87a-70c1-8fa2-22d0c2c693ce` independently reproduced renderer `44/44`, every
declared focused dependency, typecheck, exact owned-file ESLint, diff check, static boundaries, and exact candidate plus
dependency hashes, then returned `FINDINGS`. It found no direct P0/P1 production defect; it rejected acceptance because
the selftest could still permit a broken implementation to look green:

- callback mutation coverage omitted surface dimension setters/getters, `putImageData`, and successful paint callbacks;
- refusal assertions proved only that no surface was returned, not that malformed/refused inputs caused zero factory or
  draw calls before refusal;
- several order, diagnostic, measured-guide, polygon, and unavailable-overlay checks inspected input plans/receipts
  rather than the emitted Canvas trace; and
- deep-freeze checks did not enumerate nested success arrays/palette and complete refusal truth fields.

The next bounded correction is test-first and owns only `src/lib/x4UiCanvasRenderer.selftest.ts` unless a new causal red
proves a production defect. Production `src/lib/x4UiCanvasRenderer.ts` is frozen at SHA-256
`5C16F57B2D1DD59E12A9E0ECD607AEC5C754126B053E0D829655D5C61113C703`. The corrected oracle must first record the new
checks red or independently demonstrate why production already satisfies each mechanism, then cover every callback
stage with operation/pixel equivalence plus final refusal, assert zero factory/context/draw trace for all pre-allocation
refusals, assert exact emitted operation ordering and all overlay families, and recursively enumerate the frozen receipt
boundary. It must preserve the complete prior `44/44` matrix and every frozen dependency hash.

Acceptance still requires coordinator reproduction of the expanded suite and all focused gates, exact before/after
hashes, and a new independent zero-write `CLEAN`. No React/editor integration is authorized before that result. The audit
is an AAR trigger: a green behavioral suite that asserts its input/receipt more strongly than its emitted side effects is
not an adequate renderer oracle.

The rejection and tests-only dispatch are synchronized and read back at GitHub #41 comment `5286605053`, Notion
comment `3bb4618e-d15b-8195-b49b-001d0acdfa34`, and Drive revision
`AIroW37Nv-kjq4KuJv-naRl8B443x3GLEIQxSTRvOqLObCgcDSH4zgWKU5aaQjBLDw4fOIbd4iXQnFJjjKEZcCj4Oo4DIVGBjzDRnwyhUTnq`.
The first tabs-aware Drive field mask was malformed and returned HTTP 400 before any write; a full-document read then
established exact target tab `t.0`, end index, and required revision for the guarded append. This is bookkeeping-tool
friction and an AAR trigger, not product evidence.

The tests-only correction changed only `src/lib/x4UiCanvasRenderer.selftest.ts`, from
`A1827EBB226EA1AF12024BCBF50B30D2AF688B8018718D2B7FDA6F9912963BC9` to
`98F5AF68696BAB7664FD660E1270FFD538BDF5B2EAE21F03A9165C9EAFEFBD10`; production remains frozen at
`5C16F57B2D1DD59E12A9E0ECD607AEC5C754126B053E0D829655D5C61113C703`. The expanded oracle is `65/65`: prior
`44/44`, callback isolation `7/7`, pre-allocation `6/6`, emitted trace `3/3`, freeze/truth `2/2`, and oracle sensitivity
`3/3`. Production already satisfied every newly causal check, so this correction produced no behavioral red and did not
authorize a production edit. Coordinator reproduction passed the exact `65/65`, paint `127/127`, preview `89/89`,
Scene `120/120`, font `10/10`, corpus `28/28`, keep-outs `16/16`, text `8/8`, kernel `29/29`, call model `46/46`,
layout program `523/523`, linter `112/112`, both source owners `PASS`, typecheck, exact two-file zero-warning ESLint,
and diff check. Fresh zero-write Luna audit `019ffd0e-2b2b-7250-a161-8c445b68ea37` is active. Batch 6D remains rejected
unless that audit returns `CLEAN`; React/editor integration is still locked and B119 remains
`PARTIAL / Not verified in game`.

### Batch 6D second independent audit rejection — cross-layer order and independent pixel oracle

Fresh zero-write Luna audit `019ffd0e-2b2b-7250-a161-8c445b68ea37` returned `FINDINGS` with no repository writes and
exact before/after parity for all fourteen frozen hashes and scoped Git status. It independently reproduced Canvas
`65/65`, paint `127/127`, preview `89/89`, Scene `120/120`, font `10/10`, corpus `28/28`, keep-outs `16/16`, text
`8/8`, kernel `29/29`, call model `46/46`, layout program `523/523`, linter `112/112`, both source-owner checks,
typecheck, exact two-file zero-warning ESLint, diff hygiene, and all forbidden-API scans. Those green gates are
insufficient because its fresh probes exposed one confirmed structural defect and two oracle weaknesses:

- swapping one background order with one glyph order preserves the complete `0..N-1` set and each layer's internal
  monotonicity, so the current validator renders while `buildOperations` paints fixed tuple/array order and ignores the
  conflicting order fields;
- the emitted-trace oracle reconstructs expected operations with logic shaped like the implementation, so a shared
  semantic mistake can remain green; and
- the atlas oracle observes only one alpha byte and does not independently prove every RGBA byte written for both
  regular and bold A8 atlases.

The audit also retained a reference to a factory-returned surface, deliberately returned that pre-existing object from
the allocator, and observed its dimensions change before a later refusal. Reconciliation classifies this as a real
contract-clarity gap but not proof that the renderer mutates a caller target: `surfaceFactory(width, height, role)` is an
allocator whose returned surface transfers to renderer ownership, and the production API accepts no target surface at
all. Returning an aliased existing target violates that allocator contract; arbitrary callback side effects cannot be
made transactional by this pure adapter. The correction may not weaken atomic UI acceptance: it must make allocator
ownership explicit, prove that any options object carrying a `target`/existing-surface field refuses before allocation,
and preserve the later React rule that the mounted Canvas changes only by adopting the returned renderer-owned surface
after `status === 'rendered'`. A refusal may discard mutated renderer-owned staging allocations, but it may not receive,
clear, resize, paint, or return the caller's mounted target.

The next bounded unit remains owned only by `src/lib/x4UiCanvasRenderer.ts` and
`src/lib/x4UiCanvasRenderer.selftest.ts`. It is tests-first: preserve all existing `65/65`; first add a causal
cross-layer-order regression that is red against `5C16F57B...13C703`, an invalid-target-option pre-allocation control,
literal independently curated composite-trace goldens that do not call a production-shaped expected-operation builder,
and complete regular/bold RGBA atlas assertions over every byte. Then make the smallest production correction so each
command's `order` equals its flattened fixed-layer issuance index, clarify allocator ownership in the public type
contract, and rerun every focused dependency, typecheck, exact lint, hashes, and hygiene. No Scene, paint, corpus,
React, workspace, server, package, or deployment owner may change. A new independent no-write `CLEAN` remains mandatory
before Batch 6D can be focused-accepted or editor integration can start. Overall B119 remains
`PARTIAL / Not verified in game`.

The audit rejection and initial two-file correction contract were synchronized and read back at GitHub #41 comment
`5288798450`, Notion comment `3bb4618e-d15b-81cd-baf3-001dc72c7b26`, and Drive revision
`AIroW36kfUW0iJlIbnjJhFdQxeMrfNqfYJcyeOzIMuXTPHPRUPD0lYL7tnXRz8tVrgPP9tYBhDMtMKF80PrK8Nc88UnjEBKI94dKgf9roCQQ`.

### Batch 6D.1 coordinator rejection — real paint-plan coupling was hidden by the fixture

The two-file worker produced a valid causal receipt against the old renderer: `68/69`, with historical families exact
and only the new cross-layer assertion red; after adding flattened-index validation it reported `69/69`, typecheck,
focused dependencies, exact lint, and hashes green. Candidate hashes were renderer
`4B126345C83F5868C705EDA478545B45E3E9A8FF13B89DA1C1E2E522350816D4` and selftest
`FBC2AE38056E1BEA9D567B6342AFEBFA969F8C1D9EC33408160103FDD1E280EE`.

Coordinator source review rejected that green result before independent audit. The selftest's `acceptedPlan()` took the
real result from `projectX4UiPaintPlan()` and silently rewrote every command's `order` to its flattened four-layer index.
The worker's final concern correctly disclosed that raw paint output has non-flattened layer order fields. Therefore the
new renderer rejects the actual accepted paint-plan owner, while the test passes only a synthetic normalized clone. This
violates the exact source -> preview -> paint -> Canvas chain and makes `69/69` non-product evidence.

Reconciliation found the coupling in `x4UiPaintPlan`: one global counter is incremented while node geometry and
diagnostics are emitted interleaved, then glyphs, gaps/selections, and keep-outs are emitted, but the resulting commands
are regrouped into the fixed paint layers afterward. The arrays define paint composition while the retained `order`
values describe pre-grouping construction chronology. The renderer cannot both require flattened paint order and accept
that owner. Sorting all layers by those old values would destroy the fixed composition contract; weakening the renderer
would leave stale cross-layer order mutations structurally indistinguishable.

The corrected bounded unit therefore expands, necessarily, to the existing four-file producer/consumer coupling:

- `src/lib/x4UiPaintPlan.ts` and `.selftest.ts` must make the final issued layer tuple authoritative by assigning each
  command its exact flattened index after grouping, while preserving array order, object identity between
  `layers[2]/diagnostics` and `layers[3]/keepOuts`, deep freeze, replay, and all existing paint semantics;
- `src/lib/x4UiCanvasRenderer.ts` and `.selftest.ts` retain the narrow `order === flattened index` validation, explicit
  renderer-owned allocator contract, literal trace golden, complete regular/bold RGBA oracle, and target-option
  pre-allocation refusal; and
- the Canvas fixture must consume the raw paint result directly. Any test-only order rewrite is forbidden.

This repair is tests-first across both owners. Before production edits, the paint selftest must causally fail a new raw
flattened-order invariant and the Canvas selftest must fail on the same raw paint result/cross-layer defect while all
historical checks remain green. The final candidate must pass raw paint -> Canvas without normalization, preserve all
preview/Scene/corpus/font/layout/source owners byte-for-byte, and receive a fresh independent four-file no-write audit.
The previously accepted Batch 6C hash is reopened only for this exact order-metadata coupling; no geometry, authority,
keep-out, selection, or truth behavior is reopened. React/editor integration remains locked and B119 remains
`PARTIAL / Not verified in game`.

This coordinator rejection and corrected four-file contract are synchronized and read back at GitHub #41 comment
`5288853384`, Notion comment `3bc4618e-d15b-81cb-9a11-001de2b56048`, and Drive revision
`AIroW37W_qKgcYSMJxasJf45EQh3r8mqDYzSW8LUH_Qg6ueMbjkC9nY5bY_VZrY6ZqLxZJroktf4BmIJAg8QQU6YB6N16CfJSIyv46zvEigD`.

### Batch 6D.2 four-file producer/consumer correction — focused accepted

Status: `FOCUSED VERIFIED / CLEAN`; overall B119 remains `PARTIAL / Not verified in game`. Native Luna worker
`019ffe2f-9ca2-7ca2-860f-755373158c99` completed the corrected
tests-first unit with the required causal receipts. Before either production owner changed, paint was exactly `130/131`:
all historical `127/127` checks passed and only the raw flattened-order invariant was red. Canvas was exactly `69/70`:
the raw production paint result refused `out-of-order-command` before any factory, context, or draw activity, while all
69 prior checks stayed green. Production hashes at that red checkpoint were unchanged.

The narrow repair assigns exact `0..N-1` order values only after the fixed four-layer tuple has been formed. It does not
sort or reorder any layer. `plan.diagnostics` and `plan.keepOuts` retain exact object identity with the commands in
layers 2 and 3. The Canvas fixture now passes the raw `projectX4UiPaintPlan()` result directly to the strict renderer;
the rejected accepted-plan order rewrite is gone. Final worker and coordinator evidence is paint `131/131`, Canvas
`70/70`, preview `89/89`, Scene `120/120`, font `10/10`, corpus `28/28`, keep-outs `16/16`, text `8/8`, kernel
`29/29`, call model `46/46`, layout program `523/523`, linter `112/112`, source bundle `PASS`, workspace source
`PASS`, repository typecheck, exact four-file zero-warning ESLint, and diff hygiene.

The exact candidate hashes are:

- paint production `1C75A6142E42F841BB9541D6890145AB9944DF5EB79EF485D05ECC96B49A8731`;
- paint selftest `95116519FB7EED30EA4E58743A11D717D95D29CD40B407459BE805D475D18BEF`;
- Canvas production unchanged at `4B126345C83F5868C705EDA478545B45E3E9A8FF13B89DA1C1E2E522350816D4`;
- Canvas selftest `AF9096E75CBA25028289B626D794A6BF78066609EBE3B15245AEED3A41426FB7`.

Frozen preview and Scene owners retain their accepted hashes. Fresh zero-write native Luna auditor
`019ffe3f-c8f9-7ee3-a5ea-d99e89d6563c` returned `CLEAN`, changed no files, and preserved all eight required hashes.
It independently reran every focused owner, typecheck, exact lint, diff and boundary scans, then passed an independent
`11/11` in-memory production harness: raw paint orders were exact `0..66`; diagnostics/keep-out identity held;
cross-layer order drift and target/existing-surface options refused before factory/context/draw; a coherent same-layer
reorder rendered; the literal canonical composite trace matched all `403` operations; every regular/bold A8 RGBA byte
matched; and the deeply frozen receipt remained `Not verified in game`, `gameVerified:false`. Three discarded harness
setup attempts failed before product execution (runner marker, TSX loader, export list); they made no repository writes
and are AAR triggers, not product evidence. Batch 6D is focused-accepted and React/editor integration is unlocked.
Broad precommit/oracle/E2E/build, rendered Forge inspection, deploy identity, C++ frame acceptance, and X4 experience
remain open.

The accepted Batch 6D receipt is synchronized and read back in GitHub #41 comment `5289048407`, Notion comment
`3bc4618e-d15b-81fe-b0c4-001dbb1f0a11`, and Drive revision
`AIroW36a6u47PpYCnkkIJyLHJ6dti1Xtg0ERB2HFyYyNcKeis-czmFt5JejaQQYTTx5P0Occ0DJa5XzWnKtPQCX_XkVro2lbz-iYtNsEEm69`.
The guarded Drive append was accepted as a long-running connector cell and then read back from tab `t.0`; no duplicate
write was issued.

## BATCH 7A ACCEPTANCE CONTRACT — SOURCE-FIRST EDITOR MOUNT

Status: `IN_PROGRESS`; implementation was unlocked by the Batch 6D `CLEAN` audit. This is the first
React/editor mounting unit for the already accepted source, corpus, preview, paint, Canvas, and keep-out owners. It is
not a new parser, scanner, renderer, emitter, persistence model, deploy gate, or game-verification authority.

### Reconciled approach and reused ownership

The durable source-first design in `docs/plans/2026-08-10-b119-x4-ui-editor-source-first-design.md` remains
authoritative. Three approaches were rechecked against the live code:

1. adding the complete renderer workflow directly to the existing `UIBuilder.tsx` monolith is rejected because it
   couples asynchronous corpus state, source authority, selection, pure projection, and DOM Canvas adoption into the
   legacy pixel designer;
2. adding a server-side preview owner is rejected because the configured-corpus routes and browser Canvas adapter
   already exist and a second renderer would drift; and
3. a dedicated source-first React panel over a pure session/view-model adapter is selected. `UIBuilder.tsx` owns only
   tab mounting and preserves its current linter/status work.

The batch must reuse, without replacement or copied semantics:

- `buildX4UiWorkspaceSource()` for passthrough `ui.xml`/Lua authority, generated-shadow locking, shippability, and CAS
  provenance;
- `loadConfiguredX4UiCorpusAssets()` over the existing public `/api/reference/status`, `/manifest`, and `/file` routes;
- `projectX4UiPreviewPipeline()` for exact source/target selection, linter materialization, profile, program, and Scene;
- `projectX4UiPaintPlan()` and `renderX4UiPaintPlanToCanvas()` for the raw accepted preview-to-pixel chain; and
- `KEEP_OUT_PRESETS`, `BUILT_IN_KEEP_OUTS`, `getKeepOutPreset()`, and `projectBuiltInKeepOut()` for evidence-graded
  overlays.

No browser directory picker, recursive scan, hardcoded corpus path, new server route, generated-source fallback,
whole-file emitter, or `uiWidgets` conversion may enter this unit.

### Bounded files and responsibilities

- Create `src/lib/x4UiEditorSession.ts`: pure, frozen editor projection and Canvas-adoption state reducer. It composes
  the accepted owners, never accesses DOM/fetch/storage, never auto-selects a source or target, and never upgrades game
  truth.
- Create `src/lib/x4UiEditorSession.selftest.ts`: fail-first tests for exact selection, corpus-independent lint,
  keep-out evidence, profile changes, stale selection, and adopt-on-render/retain-on-refusal identity.
- Create `src/components/X4UiSourceEditor.tsx`: the browser presentation, configured-corpus load/reload lifecycle,
  profile/source/target/overlay controls, finding presentation, and exclusive adoption of a renderer-owned completed
  `HTMLCanvasElement`.
- Create `src/components/X4UiSourceEditor.selftest.tsx`: server-rendered structural/truth-state checks plus pure handler
  seams; no jsdom dependency or fake browser renderer is introduced.
- Modify only the necessary mounting/tab labels in `src/components/UIBuilder.tsx`. Existing generated/custom Lua lint
  cards and legacy functionality must remain intact.

Source mutation, sample-value editing, screenshot calibration, persisted editor state, source-safe property controls,
direct-call insertion/deletion, package/export/deploy identity, and confirmation are deliberately deferred to later
documented batches. The panel may display existing dynamic/sample gaps, but Batch 7A does not edit them.

### Required user-visible contract

- The source-first panel is the default UI sub-tab. The old absolute-pixel surface remains available and is labelled
  `Legacy pixel designer`, never as the X4 renderer.
- `Not verified in game` is permanent and prominent. A clean static result reads `No known static rule violated`; it
  never reads `will render`, `game accurate`, or equivalent proof language.
- Source authority, availability, editability, shippability, registration, generated-shadow lock, and refusal reasons
  are visible. Generated-shadowed or ambiguous source cannot silently fall back to generated Lua.
- Corpus loading is asynchronous, abortable on replacement/unmount, and explicitly reports canonical, loading,
  unavailable, stale, or malformed evidence. Linter/source findings remain visible when corpus loading fails.
- Profile controls expose drawable width, drawable height, and UI scale. Defaults are exactly `2560`, `1440`, and
  `1.4`, labelled `unverified-default`; finite positive validation is required.
- Source and target selectors begin blank. Selecting a source does not select a target. Workspace/source/profile drift
  clears stale dependent selection; the pipeline never falls back to a first candidate.
- Every linter finding exposes severity/code/location/message plus `failureMode`, `evidenceBoundary`, and `nextAction`.
  The calibrated whole-frame refusal/conversation-close symptom is therefore visible at the actual blocking rule.
- All four context presets are present. The measured `y=0.788`, `y=0.74`, and `x=0.664` guides retain their exact
  evidence; ticker/top-HUD entries remain visibly unavailable/unmeasured rather than receiving invented rectangles.
- CSS may fit only the completed logical bitmap. Browser layout must not recompute X4 table, row, text, or keep-out
  coordinates.
- A rendered result atomically replaces the prior mounted Canvas with the renderer-owned returned surface. A refusal
  retains the prior surface, marks it stale/refused, and exposes the refusal; no caller target is passed to the renderer.

### Required fail-first and validation evidence

The Luna implementation worker must first add focused tests that fail because the mount/session owner does not yet
exist, while all accepted production hashes remain unchanged. Final focused acceptance requires:

1. pure session tests proving no auto-selection, linter-before-corpus, exact stale-selection refusal, profile change,
   four preset projections, measured/unmeasured truth, raw preview/paint eligibility, and Canvas adoption/refusal state;
2. component structural tests proving permanent game-truth copy, source/corpus/profile/selectors/linter/keep-out
   controls, the legacy label, and no success copy that claims engine acceptance;
3. the complete accepted 14-owner focused matrix, new session/component selftests, repository typecheck, and exact
   owned-file zero-warning ESLint;
4. import/boundary scans proving no filesystem, server, compiler/emitter, storage, screenshot, deployment, game, or
   alternate-renderer owner entered the new files;
5. frozen before/after hashes for accepted Batch 6 owners and scoped diff/status hygiene; and
6. a fresh independent no-write source-to-mounted-state audit before the batch is focused-accepted.

The real rendered Forge surface remains a required later validation layer behind the machine-state gate. Therefore a
focused-green Batch 7A candidate is still `PARTIAL` until that visual interaction is run; it cannot clear deploy or game
truth.

### Batch 7A first-candidate audit and correction — `IN_PROGRESS`, 2026-08-14

The first candidate passed all 16 focused selftests and repository typecheck; exact five-file ESLint reported zero
errors and three UIBuilder `no-explicit-any` warnings. Fresh zero-write native Luna audit
`019ffe99-ba04-7e72-bedc-7a439ddc1e1a` preserved all five hashes but returned `FINDINGS`, so none of those hashes are
accepted. The audit reproduced:

1. unconditional `No known static rule violated` copy even with findings or unavailable/incomplete analysis;
2. the fatal whole-frame/reload/conversation-close symptom applied to nonblocking 13–23 `addTable` warnings rather than
   only the calibrated blocking 24+ finding;
3. raw diagnostics and verification gaps promoted into duplicate/incomplete finding cards;
4. a current/rendered Canvas whose detail says it is stale;
5. malformed or forged rendered/refused receipts accepted by the session adoption boundary;
6. missing causal pure-handler proof for corpus abort/late results, Canvas replacement/refusal, and selector drift; and
7. inactive keep-out preset checkboxes mutating shared active-preset state.

The correction remains inside the existing five-file boundary and is split across disjoint owners. The session worker
must validate the exact renderer receipt envelope before adoption. The component worker must make static-rule and
Canvas states orthogonal and truthful, use normalized complete lint findings, bind the fatal symptom to the blocking
rule, add causal pure-handler tests without a new DOM dependency, disable/reject inactive keep-out toggles, and remove
the three exact-file lint warnings. Both workers must capture fail-first receipts. A complete focused coordinator rerun
and a new independent zero-write `CLEAN` audit remain mandatory before Batch 7A can be focused-accepted.

### Batch 7A correction close — `FOCUSED VERIFIED / CLEAN`, 2026-08-14

The two bounded corrections and the final shared-ID keep-out repair are focused-accepted. Lorentz hardened the pure
session boundary so only a complete producer-issued renderer receipt can adopt a new Canvas; malformed, forged,
profile-drifted, or refusal receipts retain the prior surface as stale. Kant separated static-rule truth from Canvas
truth, projected only normalized complete findings, restricted the whole-frame reload/conversation-close failure mode
to the calibrated blocking `addTable(24+)` rule, added causal lifecycle/selection seams, and cleared exact-file lint.
A follow-up component correction made keep-out mutation require the originating preset ID to equal the active preset;
this closes the shared `conversation-back-row` escape in both inactive-to-active directions while every refusal returns
the original selected-entry array by identity.

Final accepted SHA-256 values are:

- `src/lib/x4UiEditorSession.ts` —
  `9A2DBAF6FCBA4CE0FDF9F3AB15F7AAA180950D497ED42137DE9C98AB9F01E6F4`;
- `src/lib/x4UiEditorSession.selftest.ts` —
  `638E0448BE5829CA9957D8DF301A6B47F1F6A19CF3C0C6AB77DD83861C95BEBC`;
- `src/components/X4UiSourceEditor.tsx` —
  `7962F47619FF83C4AFBECAB0761E532D2E5E246C223EB8FC4E153A1A2B19CCB2`;
- `src/components/X4UiSourceEditor.selftest.tsx` —
  `2A14C3BBB3F36AB13C8C8983011087749042EA3F873BC9728651B61C4064D945`; and
- `src/components/UIBuilder.tsx` —
  `E2E47C43D3EEE0479B79BE1923F55AEDAF4A0E7257887081AE6A85B34772FA69`.

Coordinator validation passed all 16 focused selftests, including linter `112/112`, call model `46/46`, layout
`523/523`, kernel `29/29`, text `8/8`, font `10/10`, corpus `28/28`, keep-outs `16/16`, Scene `120/120`, preview
`89/89`, paint `131/131`, Canvas `70/70`, plus source/workspace/session/component owners. Repository typecheck,
exact five-file ESLint with `--max-warnings=0`, scoped `git diff --check`, and forbidden-owner scans passed.

Fresh native Luna zero-write audit `019ffee7-8866-79c1-8cd7-fe68f7ddbd04` returned `CLEAN`: all 13 authoritative
hashes matched before/after; all focused gates passed; hostile receipt/prior-state, linter precedence/deduplication,
corpus race, selector drift, four-preset evidence, UIBuilder-preservation, and both shared-ID keep-out directions passed.
The audit's three failed probe attempts were harness errors—wrong `projected` expectation, malformed quoted source
assertion, and a literal scan where production correctly imports a constant. Narrow corrected probes passed and no
product defect was found. These failures make the AAR non-clean and reinforce that audit scripts must assert public
contract values and imported ownership before treating source-text mismatches as product evidence.

The real rendered Forge surface, package/export identity, deploy, C++ frame acceptance, and in-game experience remain
open. Therefore Batch 7A is focused-accepted, but overall B119 remains `PARTIAL / Not verified in game`.

This acceptance and both next-unit specifications are synchronized and read back at GitHub #41 comment `5290634571`,
Notion comment `3bc4618e-d15b-81bc-ab21-001dbed9fc9d`, and guarded Drive revision
`AIroW37ORCYwemt1rD9CUx6i4hRFVi8xiwgXyDTuCQFbjRqS2GRL7LMDiZm6cLHWkcMQs49z4dgq8F3nYueoxh_fvIKi7IgNqdlKCKEKLUDZ`.

## BATCH 7B ACCEPTANCE CONTRACT — BOUNDED SOURCE-LITERAL EDIT AUTHORITY

Status: `IN_PROGRESS / FIRST CANDIDATE REJECTED`. This unit adds the pure mutation authority needed by later UI property controls. It does not mount
controls, insert/delete calls, emit or format whole files, package a mod, deploy, or claim game acceptance.

### Plan and bounded ownership

- Create only `src/lib/x4UiSourceEdits.ts` and `src/lib/x4UiSourceEdits.selftest.ts`.
- Reuse `X4UiWorkspaceSource`, `spliceX4UiWorkspaceSource()`, selected call/layout-program provenance, and the existing
  parser/model owners. No second parser, scanner, source bundle, workspace model, emitter, or formatter is allowed.
- Catalog only statically editable scalar values whose existing number/string/boolean `sourceLiteral` exactly matches
  the declared UTF-16 source range. Dynamic, constant-folded, aliased, unsupported, generated-shadowed, ambiguous,
  unregistered, or nonliteral values remain locked with typed reasons.
- Apply one edit through expected raw-text CAS. Preserve the original Lua quote style for strings, encode Lua safely,
  accept only finite numbers and booleans, and reparse the complete document before accepting the changed workspace.
- Structural direct-call insertion/deletion is deliberately deferred: the current call-model ranges prove call
  expressions, not complete statement/anchor ownership. This unit may not infer those ranges.

### Risks, rollback, and acceptance

The primary risk is silently changing source outside the selected literal or accepting stale provenance. Every refusal
must return the exact original workspace object; no-edit must preserve every byte and object identity. A successful edit
must change exactly one proven range, leave all other bytes identical, replace only the selected workspace source
record, and survive reparse with equivalent selected-call/value provenance. Rollback is deletion of the two new pure
owners; no existing source, corpus, game file, package, or configuration is mutated by the tests.

Fail-first tests must cover static number/string/boolean discovery and edits; single/double-quote preservation and
escaping; finite-number formatting; exact one-range locality; no-edit byte identity; stale expected text/range;
generated shadow, ambiguous/unregistered source, foreign identity, unsupported/dynamic expression, invalid literal,
syntax-breaking replacement, and reparse/provenance drift. Every refusal must prove exact original-object identity and
zero partial mutation. Required validation is the new selftest plus source/workspace/call-model/layout-program focused
owners, repository typecheck, exact two-file zero-warning ESLint, `git diff --check`, forbidden-owner scans, before/after
accepted-owner hashes, and a fresh independent zero-write audit. Evidence is recorded in this plan and B119 trackers.

## BATCH 7C ACCEPTANCE CONTRACT — PREVIEW-ONLY SAMPLE VALUES

Status: `IN_PROGRESS / FIRST CANDIDATE REJECTED`. This disjoint unit exposes the existing layout-program sample catalog in the source-first editor
and feeds validated samples into preview projection. Samples are design-time measurement inputs only and never source,
workspace, package, deploy, or game truth.

### Plan and bounded ownership

- Modify only `src/lib/x4UiEditorSession.ts`, `src/lib/x4UiEditorSession.selftest.ts`,
  `src/components/X4UiSourceEditor.tsx`, and `src/components/X4UiSourceEditor.selftest.tsx`.
- Reuse `X4UiLayoutPreviewSampleCatalog`, `X4UiLayoutPreviewSampleInput`, the selected layout program, and the accepted
  `projectX4UiPreviewPipeline({ samples })` owner. Do not add a parallel expression evaluator, parser, persistence
  owner, source mutation helper, renderer, or UIBuilder change.
- Add pure catalog/state reconciliation and input-parsing seams. Display each dynamic expression with its exact source
  identity and `{expression}` placeholder; accept only the catalog-declared string/finite-number/boolean shape.
- Source, target, selected-program, or catalog drift must remove stale samples before projection. Unknown, duplicate,
  malformed, or type-mismatched sample keys are refused rather than coerced or retained.
- The panel must state that samples affect preview measurement only. Editing samples may change preview geometry but
  must never change workspace/source identity, exportable bytes, linter truth, or `Not verified in game` state.

### Risks, rollback, and acceptance

The primary risk is allowing stale or coerced design data to masquerade as deployed Lua. Rollback is the four-file
scoped diff; no persistent format or source bytes are introduced. Fail-first tests must prove catalog-driven controls,
number/string/boolean parsing, `{expression}` labels, exact sample forwarding, stale-state reconciliation across every
selection/source/catalog drift, refusal of unknown/nonfinite/type-mismatched values, and unchanged workspace/source
identity. Existing linter, keep-out, Canvas adoption/refusal, corpus race, and permanent game-truth behavior must remain
green. Required validation is the affected session/component tests plus layout-program/preview/paint/Canvas/source/
workspace owners, repository typecheck, exact four-file zero-warning ESLint, `git diff --check`, forbidden-owner scans,
accepted-owner hashes, and a fresh independent zero-write audit. Evidence is recorded in this plan and B119 trackers.

## BATCH 7B/7C FIRST-CANDIDATE AUDIT REJECTION AND CORRECTION CONTRACT — 2026-08-14

Status: `IN_PROGRESS / FINDINGS`. The first disjoint implementations passed all 17 focused selftests, repository
typecheck, exact six-file zero-warning ESLint, scoped diff/whitespace/owner scans, and preserved all 14 declared hashes
through zero-write audit `019fff95-ca11-7523-81ef-1beca66c71f7`. Those greens are insufficient: the independent
hostile matrix returned four high-severity product findings, so none of the six candidate hashes is accepted.

### Reproduced findings

1. The source-edit consumer trusts structurally plausible caller-supplied catalog content. A forged entry retaining a
   legitimate ID can retarget `addTable` count to the same call's width literal and be accepted; copied workspace,
   source, and program objects, duplicate IDs, prototype-backed entries, and foreign path/operation/order data also
   cross the mutation boundary.
2. Source-edit normalization recursively copies arbitrary enumerable nested objects. A prototype-backed call can lose
   required fields yet normalize, and duplicate call/evidence nodes can escape to an uncaught layout exception instead
   of a typed non-mutating refusal.
3. Sample reconciliation accepts extra or inherited catalog/value members, prototype-backed entries, empty consumers,
   foreign entry source identities, reversed ranges, and target drift. These malformed values can remain forwardable.
4. Sample state is bound only to source/catalog identity. Changing the selected profile from `100x80 @ 1.0` to
   `1280x720 @ 1.1` changes the selected program while retaining the same catalog ID; stale samples remain accepted and
   are forwarded.

The independent census was source controls `4/4`, stale/range/lock refusals `11/11`, no-edit/locality `2/2`, numeric
and string encoding `15/15`, source authenticity `0/10`, malformed normalization `3/5`, sample parsing `14/14`, base
sample reconciliation `8/12`, additional catalog shape/drift `2/6`, source/target selection clearing `3/3`,
profile/program clearing `0/1`, canonical sample locality `1/1`, UI preview-only truth `2/2`. Harness setup and one
transient no-diagnostic ESLint exit were corrected and recorded separately; final standard gates were green.

### Tests-first correction boundaries

- Batch 7B correction owns only `src/lib/x4UiSourceEdits.ts` and `src/lib/x4UiSourceEdits.selftest.ts`. First install
  permanent causal regressions for every accepted authenticity variant and malformed-model throw. Then bind apply to
  the exact owner-issued catalog/context/entry authority, reject clones, prototypes, duplicate IDs, retargeted ranges,
  and foreign provenance before CAS, validate nested normalization as closed plain own-data input, and turn every
  malformed/layout exception into the existing typed refusal while preserving exact original workspace/source/catalog
  identity and bytes.
- Batch 7C correction owns only `src/lib/x4UiEditorSession.ts`, its selftest,
  `src/components/X4UiSourceEditor.tsx`, and its selftest. First install permanent causal regressions for every
  malformed catalog/value case and profile/program drift. Then enforce a closed own-data catalog/sample schema with
  exact source/range/target/consumer reconciliation and bind editor sample state to the complete selected program and
  normalized profile identity. Only the existing layout-program sample input may be forwarded; source/workspace bytes,
  UIBuilder, persistence, export/deploy, and game truth remain untouched.

Both corrections must preserve all frozen owners and the positive byte-local/canonical-sample behavior. Coordinator
acceptance requires the complete 17-owner matrix, typecheck, exact owned-file zero-warning ESLint, scoped diff and
boundary scans, causal fail-first receipts, final hashes, and a new independent zero-write `CLEAN` audit. Broad
precommit/oracle/E2E/build, rendered Forge, package/deploy, C++ acceptance, and in-game experience remain separately
gated and unclaimed. The failed audit and harness discrepancies make the AAR non-clean.

### Coordinator review rejection of first 7C correction

The first correction reached all focused greens at session/component hashes `6360581C...BB78D5A`,
`435AB49E...0B54B8`, `F9F79719...8DF10`, and `192BF860...31E6E`, but these hashes are rejected before independent
audit. A direct public-seam probe supplied a closed, internally coherent sample catalog whose `targetId` was forged;
`reconcileX4UiEditorSampleState(samples, catalog)` returned `status:"accepted"`. The correction's authoritative tests
passed an optional third `expectedCatalog` only for target/range/consumer mutations, leaving ordinary two-argument
callers able to omit the authority boundary.

The next 7C correction must first install this exact two-argument fail-first regression, then require a session-issued
catalog/program authority at every public reconcile/update path. A caller-supplied catalog may never authenticate
itself by being passed as both candidate and expectation. Cloned or forged catalogs, target/range/consumer/expression
drift, and foreign session/program catalogs must refuse and clear forwardable samples; the exact catalog object issued
from the current selected layout program must remain accepted. No layout-program owner, source bytes, UIBuilder,
persistence, export, deploy, or game-truth file may change.

## BATCH 7D ACCEPTANCE CONTRACT — SOURCE-SAFE PROPERTY CONTROLS

Status: `SPECIFIED / BLOCKED ON BATCH 7B/7C CLEAN`. This unit mounts the accepted scalar source-edit authority in the
source-first editor. It is UI glue over the existing source/workspace/parser/layout owners, not a new source model,
emitter, formatter, or mutation authority.

### Reconciled ownership and scope

- Modify only `src/components/X4UiSourceEditor.tsx`, `src/components/X4UiSourceEditor.selftest.tsx`, and
  `src/components/UIBuilder.tsx`. Batch 7B's `x4UiSourceEdits` production and test owners remain frozen after their
  independent `CLEAN`; Batch 7C's session owner remains frozen after its independent `CLEAN`.
- Reuse `discoverX4UiSourceEdits()` and `applyX4UiSourceEdit()` against the exact current workspace, projected source,
  and selected layout program. The editor may display only the exact owner-issued catalog. It may not clone, rebuild,
  infer, or broaden catalog entries.
- `UIBuilder` remains the sole React workspace-state owner. The child submits the exact expected workspace identity and
  accepted replacement workspace; the parent commits only when the expected object is still current. A stale parent
  closure is a refusal, never a last-writer-wins overwrite.
- Render explicit number, string, and boolean controls for editable static literals and read-only rows for locked
  entries. Each row shows source path/range, call/field identity, current literal, and the owner's lock/refusal reason.
  Apply is explicit; typing alone does not mutate source.
- Parse UI input only according to the catalog-declared scalar type, then submit the existing raw-text/range CAS
  request. Successful application forwards the exact accepted workspace object. Refusal retains the exact original
  workspace and source bytes and displays the typed reason. Source/profile/target/catalog drift clears staged input and
  receipts before another edit can be submitted.
- A committed source change must naturally rebuild the existing source/session/linter/preview projections and return
  game truth to `Not verified in game`. The control must never claim package, deploy, C++ acceptance, or in-game proof.

Direct-call insertion/deletion, minimal-scaffold generation, whole-file formatting, screenshot calibration, persisted
`uiEditorState`, package/export/deploy identity, and game confirmation are explicitly out of scope. They require later
bounded units and may not be smuggled into this integration.

### Risks, rollback, and acceptance

The primary risks are committing an accepted edit over a newer workspace, exposing a forged catalog through UI props,
or presenting an uncommitted edit as durable. Rollback is the three-file UI diff; no corpus, game file, package,
deployed mod, or configuration is touched.

Tests first must prove: exact owner-issued editable and locked rows; explicit apply behavior for number/string/boolean;
single/double-quote preservation through the existing owner; exact one-range byte locality; no-edit identity; stale
workspace/source/catalog/range refusal; invalid/nonfinite/type-mismatched input refusal; dynamic/aliased/generated/
ambiguous locks; parent expected-workspace CAS; no callback on refusal; staged-state clearing on selection/program/source
drift; refreshed linter/preview source identity after commit; and permanent `Not verified in game` copy. SSR must remain
deterministic and must not mutate props.

Required evidence is a causal fail-first receipt, the affected component selftest plus source-edit/source/workspace/
call-model/layout/session/preview/linter focused owners, repository typecheck, exact three-file zero-warning ESLint,
scoped `git diff --check`, before/after frozen-owner hashes, and a fresh independent zero-write audit. Rendered browser,
package/deploy, C++ acceptance, and in-game experience remain separately gated and unclaimed.

### Batch 7B/7C corrected-candidate checkpoint — 2026-08-14

Status: `FINDINGS / CORRECTION ACTIVE`. Batch 7B's source-edit correction first proved all eleven owner-authenticity
attacks crossed unchanged production, then installed exact WeakMap-issued catalog/context/entry authority, closed nested
model validation, and contained layout refusal. Its candidate hashes are `A151628B...A1E2E1` and
`550B8D57...F7BBA`.

Batch 7C round two first proved unchanged session hash `6360581C...BB78D5A` accepted the exact two-argument forged-
target call, then removed optional expected-catalog trust and required the session-issued authority at public reconcile
and update seams. Its candidate hashes are `3B76B896...E0F9F`, `01841353...E9755`, `C34E96B3...120C98`, and
`1E1769AB...14143B`; UIBuilder remains `E2E47C43...72FA69`.

Coordinator validation passed all 17 focused owners, including linter `112/112`, call model `46/46`, layout program
`523/523`, kernel `29/29`, font `10/10`, text `8/8`, corpus `28/28`, keep-outs `16/16`, Scene `120/120`, preview
`89/89`, paint `131/131`, Canvas `70/70`, plus source bundle/workspace/session/component/source-edit tests. Repository
typecheck, exact six-file zero-warning ESLint, scoped diff, trailing-whitespace, optional-expected-catalog, and unsafe-
TypeScript scans passed. All 14 declared hashes matched the worker receipts.

Fresh native Luna zero-write auditor `01a000b5-dad3-7a22-ba50-12aaa5093c17` returned `FINDINGS` with no audit-owned
writes and all 14 declared hashes unchanged. All 17 focused selftests, repository typecheck, exact six-file zero-warning
ESLint, scoped diff/whitespace/unsafe-cast/owner scans, and all sample families passed. The corrected sample aggregate was
`52/52`: omitted authority, clones, foreign sessions, rebind attempts, malformed catalog/value shapes, and complete
source/target/program/profile/selection drift all refused or cleared without forwarding stale samples.

The source-edit candidate remains rejected despite those greens. Four independent failures crossed the mutation or
containment boundary:

1. cloned call-model evidence could retarget `addTable(1, { width = 80 })` count provenance to the width literal and
   applying `90` changed the width while leaving the real count untouched;
2. nested `undefined`, `NaN`, and `Infinity` evidence still produced a ready catalog and accepted source mutation;
3. a cloned program marked `refused` retained usable target/operation data and still produced an editable catalog and
   accepted mutation; and
4. throwing public `context.program` and `input.catalog` accessors escaped the catch/fallback path.

The original two-file Batch 7B owner must install these exact fail-first regressions, reject non-finite and non-whitelisted
undefined model data, require accepted owner-issued source/program evidence rather than overlapping field names, and
snapshot untrusted public fields without rereading throwing accessors during fallback. Batch 7C remains frozen at its
green sample hashes but is not accepted independently of the combined boundary. Batch 7D remains blocked pending a
fresh combined `CLEAN`. Broad precommit/oracle/E2E/build, rendered Forge, package/deploy, C++ acceptance, and in-game
experience remain separately gated and unclaimed.

AAR trigger: focused green tests again failed to cover an authority escape. Sustain the hostile zero-write audit;
improve the source-edit oracle with exact wrong-literal, refused-program, non-finite/undefined, and throwing-wrapper
rows. The highest-risk evidenced weakness is that derived call evidence can still authorize a byte-local edit to the
wrong literal; the bounded mitigation is the two-file tests-first correction and another independent audit.

### Batch 7B correction round two candidate — 2026-08-14

Status: `IN_PROGRESS / AUDIT PENDING`. The original two-file owner reproduced the rejected production hash
`A151628B...A1E2E1` crossing every new causal row before repair: wrong-literal retarget accepted and changed width;
four nested undefined/non-finite rows produced actionable accepted mutations; a refused program remained editable;
and the public-boundary matrix exposed throwing/accessor/custom-prototype escapes.

The candidate now requires the existing `X4UiLayoutEvidenceAuthority` in the source-edit context, validates the exact
program/evidence pair through the existing layout owner, compares call/operation metadata to the detached source
binding, closes undefined/non-finite normalization, and captures public inputs through own data descriptors without
invoking accessors. The permanent round-two matrix is green: wrong-literal `1/1`, malformed evidence `5/5`, refused
program `1/1`, and public boundaries `9/9` with zero getter reads. Owned selftest is `29/29`; source/workspace/call-model/
layout-program/session/component/preview/linter focused owners, typecheck, exact two-file lint, and scoped hygiene are
green under coordinator reproduction.

Candidate hashes are `6B1624DAA2C0AABD0801E732578EB3A91FBE9D6AA398B720CE9BADCAA0B69663` and
`D08E94628F26B456E4B868D35D91941DAA86D63EE71E570949F123F4721E2D9E`; all 32 frozen X4 UI dependencies remained
unchanged. A fresh zero-write auditor must repeat the complete prior matrix and additionally attack coherent deeply
frozen program/evidence/source/workspace clones, detached source-binding substitutions, partial authority wrappers,
and every public accessor. No candidate hash is accepted and Batch 7D remains blocked until that audit returns `CLEAN`.

### Batch 7B round-two independent rejection and issuance-boundary correction — 2026-08-14

Status: `IN_PROGRESS / FINDINGS`. Fresh native Luna audit `01a00130-274a-7141-bf81-21d77e71c81b` made no writes,
preserved all 14 declared hashes, reran all 17 focused selftests plus typecheck and exact lint, and rejected the
`6B1624DA...B69663` / `D08E9462...E2D9E` source-edit candidate. Its independent family results were valid positives
`9/9`, cross-field authenticity `23/25`, coherent clones `1/7`, status/authority `19/20`, malformed model `13/14`,
public boundary/accessors `3/13`, catalog/apply `14/14`, reparse `6/6`, sample authority `77/77`, and UI/static truth
`5/5`.

Five mechanisms remain reproduced:

1. a deeply cloned and deeply frozen workspace/source/program/evidence quartet can discover a new catalog and apply a
   count edit because structural pair validity cannot establish producer origin;
2. a `partial` layout program is still actionable;
3. reordered call or evidence-record ledgers remain actionable because matching is by search rather than exact index;
4. nested request objects accept custom/null prototypes, unknown or symbol fields, and repeatedly invoke value/range
   accessors; and
5. nested program/evidence/source/workspace accessors and proxy reflection traps are observable before refusal, with a
   proxied boundary able to produce a catalog.

Reconciliation changes the implementation boundary. The existing structural evidence validator remains the right
portable integrity oracle, but it cannot and should not claim that a caller-created coherent clone originated from the
accepted producer. That limitation was acceptable for read-only preview; it is not sufficient authority for source
mutation. Batch 7B will extend the existing producers with private, non-serializable identity issuance rather than add
a signer, second model, or parallel authority service. Repository caller census found no production source-edit caller;
only its selftest currently consumes the public API, so the unsafe wrapper-shaped API can be corrected before Batch 7D
becomes its first UI consumer. Graphify's affected query failed to canonicalize both new untracked script paths; the
fallback `rg` caller census is the recorded search boundary and this tool failure is an AAR trigger.

The corrected work is sequential and bounded:

- **7B-A — layout-program issuance:** modify only `src/lib/x4UiLayoutProgram.ts` and its selftest. Register each exact
  successful emitted `program` / `evidenceAuthority` pair in a module-private `WeakMap` after the existing structural
  self-validation succeeds, and export a fail-closed identity predicate. Preserve the public result shape, JSON data,
  frozen objects, structural validator, and existing `523/523`. Exact issued pairs must pass; coherent clones, swapped
  authorities, proxies, and refused results must fail without reading attacker properties or throwing.
- **7B-B — workspace-source issuance:** modify only `src/lib/x4UiWorkspaceSource.ts` and its selftest. Register the exact
  `source` / `workspace` pair returned by the existing builder in a module-private `WeakMap`, expose a fail-closed
  identity predicate, and ensure successful splice/reparse outputs are naturally reissued through that builder. Preserve
  the source/result shape, compile projection, CAS behavior, and every existing workspace-source check. Exact built
  pairs pass; coherent clones, cross-pairs, proxies, and caller-authored lookalikes fail without observable traversal.
- **7B-C — source-edit consumer:** only after both producer seams pass, modify only `src/lib/x4UiSourceEdits.ts` and its
  selftest. Discovery must require both exact issued pairs and `program.status === "projected"` before reading semantic
  state. Bind calls, operations, source bindings, and records by exact ledger index/order rather than `.find()`.
  Replace nested caller-owned context/request wrappers with the exact issued catalog plus primitive entry/value/CAS
  arguments, so accessors, custom prototypes, symbols, unknown fields, and proxy reflection cannot become mutation
  authority. The catalog entry remains the canonical expected path/range/text CAS source. Preserve static number,
  string, boolean, quote-style, byte-locality, full-document reparse, and original-object refusal behavior.

Each sub-batch requires a causal fail-first receipt, its complete existing selftest, affected focused dependencies,
repository typecheck, exact owned-file zero-warning ESLint, scoped diff/hygiene scans, and frozen unrelated hashes.
After integration, a new independent zero-write auditor must repeat all prior families and explicitly prove exact-issued
positives; coherent clone/cross-pair refusal; projected-only status; call/record order; proxy/accessor zero-observation;
catalog/apply locality; reparse provenance; and the frozen Batch 7C `77/77` sample authority matrix. Only `CLEAN`
accepts Batch 7B/7C or unlocks Batch 7D. Rollback is the six exact implementation/test hunks; no workspace data, corpus,
game file, package, deploy state, or configuration is mutated. Broad precommit/oracle/E2E/build, rendered Forge,
package/deploy, C++ frame acceptance, and in-game experience remain gated and unclaimed.

AAR trigger: a locally green authority consumer again overclaimed what structural equality proves. Sustain independent
hostile review and exact source-byte locality. Improve the contract by separating portable structural validity from
producer-issued mutation authority. Highest-risk evidenced weakness is a convincing coherent clone authorizing a real
source byte change; the bounded mitigation is the two producer WeakMap seams plus the primitive source-edit boundary.

The rejection and reconciled three-unit correction are synchronized and read back at GitHub #41 comment `5296548001`,
Notion comment `3bc4618e-d15b-81dd-8296-001d2637385a`, and guarded Drive revision
`AIroW34TLCQVbsXzcBWUvza_Jtwgih4nauJlb-3Zecc3ENWrRXXUQL96Mp51BqBE-NZbCGdn8t5EXZghOMO63JkRLljOnFGeu40QJouA98ge`.
All three projections say `FINDINGS`, reject the candidate hashes, keep Batch 7D blocked, and retain `Not verified in
game`.

### Batch 7B-A/7B-B producer issuance candidates — focused green, 2026-08-14

Both disjoint producer units have causal receipts and coordinator-focused green evidence. They are candidate
dependencies for 7B-C, not independently accepted source-mutation authority.

- Layout issuance first ran `523/531`, exit `1`, with unchanged production `D14F4D89...68DFB`; all eight new issuance
  checks were red. The final exact-identity predicate registers only non-refused results after existing structural
  self-validation. Final selftest is `531/531`; production hash is
  `77097F6B20E79D77F7363DA5DEEA3E6BDBD3B67302A94EACBB62BA151225E8D0` and selftest hash is
  `CDD94A81205BD7E784CF5EBC8F1DE8567D04F3BD8D8B6D7443B5C9C4BCEE0046`.
- Workspace/source issuance first failed on the intentionally missing predicate export with unchanged production
  `10C3014D...B0A96`; its expanded selftest hash was `07652...3F99D`. The final builder registers each exact frozen
  source against its exact workspace, including naturally rebuilt successful splice output. The final selftest passes
  `126` call sites / `130` runtime executions; production hash is
  `8D4B00CE3D2905EC84F3ED4EFEA4E81B877AF31BE121CF8C768B30811DC9B109` and selftest hash is
  `F3EA35258BB763718DB0AB5E21B303249F814685340B783A1CC0B0A3C937123A`.

Coordinator reran layout `531/531`, workspace-source PASS, repository typecheck, exact four-file zero-warning ESLint,
scoped `git diff --check`, and the forbidden random/global/network/filesystem boundary scan. Exact originals pass;
coherent clones, one-sided clones, cross-pairs, proxies/accessors, null/primitives, and refused layout results fail with
zero observed traps and zero throws. The original source-edit Luna owner is now implementing only 7B-C against these
four hashes. Batch 7C remains frozen and Batch 7D remains blocked pending combined focused evidence and fresh audit.

### Batch 7B-C first issuance-integrated candidate — coordinator causal-review rejection, 2026-08-14

Status: `IN_PROGRESS / REVIEW FINDINGS`. The source-edit owner captured a valid positional fail-first against unchanged
production `6B1624DA...B69663`: exact discovery was locked, exact apply refused, and a workspace proxy was observed once.
Its candidate then reached owned `33/33`, all 17 focused owners, typecheck, exact six-file zero-warning ESLint, scoped
hygiene, and exact producer/frozen-consumer hash parity. Candidate hashes are
`6BE0A7F53D3C34693C4B0665718EA85F362347C55F09301B132BF0997E67CF2C` and
`153AE281B9020645F9719E0348471B35E58EAE4943A588BCAF59DA68B57A2B55`. These hashes are rejected before independent
audit because coordinator review found the ledger oracle does not prove its named predicate.

**[REPRODUCED] test-oracle defect:** `contextWithCallModel()` replaces `context.source` with a shallow clone. Every
wrong-literal, reordered-call, reordered-record, and malformed-model end-to-end row therefore fails the new
`isIssuedX4UiWorkspaceSourcePair()` gate before `modelMatchesEvidenceAuthority()` can run. The tests correctly prove
that unissued source clones cannot mutate, but their ledger labels overclaim deeper evidence.

The prior auditor clarified its exact original accepted mutations: it separately reversed `X4UiCallModel.calls` and
`X4UiCallModel.records` inside the selected source file model, leaving elements, numeric order, source text/hash, target,
program, evidence authority, literal, and provenance unchanged. Discovery issued 12 editable entries and apply changed
`addTable(1)` to `addTable(2)`. Current source-edit matching now binds calls, operations, and source bindings by index,
but production references `model.records` only during normalization/duplicate checks and carries no proof that the
issued layout program was projected from the same complete normalized model as the canonical workspace source.

**[HYPOTHESIS requiring fail-first proof]:** a caller can project a reordered-record model through the legitimate layout
producer, receive an exact issued program/evidence pair, then combine that pair with the exact canonical workspace/source
pair. Both identity gates would pass and current source-edit discovery may accept because `records` is not represented in
the matcher. Do not call this a product defect until the exact cross-producer fixture executes, but the declared exact-
model integrity contract remains unmet even if the reorder proves behaviorally inert.

The bounded correction is sequential:

- **7B-A.1 model provenance:** modify only layout program production/selftest. Extend the private issuance record with a
  detached deeply frozen snapshot of the complete normalized input call model; export a fail-closed predicate that
  requires the exact issued program/evidence pair and structural equality to a supplied normalized model. Do not add a
  public result field, digest, signer, symbol, or serialized token. Exact structural clones of the same normalized model
  pass; reordered `calls` or `records`, wrong-literal metadata, additions/removals, sparse/non-JSON data, and cross-model
  pairs fail. Preserve all existing result JSON and `531/531`.
- **7B-C.1 consumer/oracle:** after 7B-A.1, modify only source-edit production/selftest. First construct programs through
  the real layout producer from reordered-call, reordered-record, and wrong-literal models while retaining the exact
  canonical workspace/source pair. Require the current candidate to demonstrate which rows cross. Then make discovery
  require the producer's complete-model predicate over its canonical normalized source model before catalog issuance.
  Keep direct pure ledger checks or truthful labels so no named family stops at the workspace-issuance gate. Preserve
  the primitive API, byte-locality/reparse behavior, all 33 existing checks, and upstream hashes except the declared
  7B-A.1 pair.

Rerun the complete focused matrix, typecheck, exact owned lint, hygiene/hash scans, and only then dispatch the fresh
independent audit. Batch 7C and Batch 7D remain frozen. AAR trigger: coordinator review again caught a negative matrix
whose assertions passed at an earlier gate than their labels; prior green counts are candidate evidence, not acceptance.

### Batch 7B-A.1 complete-model issuance checkpoint — focused accepted dependency, 2026-08-14

Status: `FOCUSED ACCEPTED DEPENDENCY / NOT COMBINED ACCEPTANCE`. The layout owner installed eleven tests before
production. Fail-first preserved production hash `77097F6B20E79D77F7363DA5DEEA3E6BDBD3B67302A94EACBB62BA151225E8D0`,
changed only the selftest to `772F88D51628FC6858861F55E28F6A9A44C86C721D82E9BB6E125BC34B8FBCDD`, and ran
`531/542`, exit `1`: every historical check passed and all eleven new checks failed.

The bounded implementation extends the existing private layout issuance WeakMap. Each non-refused, structurally
self-validating producer result now records its exact evidence-authority identity plus a detached, deeply frozen snapshot
of the complete JSON-domain input `X4UiCallModel`. The new
`isIssuedX4UiLayoutEvidencePairForModel(program, evidenceAuthority, model)` predicate first requires exact pair identity,
then compares the supplied closed plain-data model to the complete ordered snapshot. It accepts structural clones of the
same model while rejecting reordered `calls`, reordered `records`, wrong literals, added/removed records or calls,
sparse arrays, undefined/non-finite/custom/prototype/accessor/proxy/cyclic content, cross-model content, and pair proxies.
No public program, authority, result, or serialized JSON shape changed.

Final hashes are layout production `6D16A261043F54E10BC519124B55C6862E3A4009314BDED27E9A970EE0FA7484` and selftest
`8431C30512566181ECA7AD8050B42DA92216FCC6A9E4BECBFFCCD112125AE3BC`. The worker passed `542/542`, typecheck,
exact two-file ESLint, diff and whitespace checks. Coordinator independently reran the layout suite with exit `0`,
repository typecheck, exact lint, and diff hygiene; exact source-edit and workspace production/selftest hashes remained
`6BE0A7F5...67CF2C`, `153AE281...A2B55`, `8D4B00CE...C9B109`, and `F3EA3525...37123A`.

Source-edit 7B-C.1 is now the only active implementation unit. It owns only source-edit production/selftest, must first
produce causal issued-model red evidence against the exact canonical workspace/source pair, and then require the new
complete-model predicate at discovery and apply. Batch 7C, all React/renderer production, and Batch 7D remain frozen.
This checkpoint is not game verification and does not authorize source mutation until the combined fresh hostile audit
returns `CLEAN`.

### Batch 7B-C.1 complete-model consumer candidate — causal green, audit active, 2026-08-14

Status: `CANDIDATE / FRESH AUDIT ACTIVE`. Tests were installed before the consumer changed. Fail-first preserved source-
edit production `6BE0A7F53D3C34693C4B0665718EA85F362347C55F09301B132BF0997E67CF2C`, changed only its selftest to
`48256F839B494951115699BE178B69255731D9F729267C6558EFE73A2C0B8E5B`, and exited `1`. Five models were altered and
projected through the real layout producer: reversed `calls` with elements/order values intact, reversed `records`, a
same-call wrong-literal retarget, an added non-call record, and a removed non-call record. Each resulting exact issued
program/evidence pair was combined with the exact canonical issued workspace/source. Every row reached discovery,
produced a ready catalog with 12 editable entries, and accepted a mutating apply. This reproduces the product defect and
proves the previous cloned-source negative matrix stopped at the wrong gate.

The bounded correction changes only source-edit production/selftest. Discovery selects and normalizes the canonical
source file, then requires the producer's complete-model predicate before issuing a catalog. Apply repeats the same
canonical model check and exact call/evidence correspondence before consuming the private catalog and primitive CAS
arguments. Public positional signatures, aliases, catalog/result JSON, scalar encoding, byte-local splice, complete
reparse/reissuance, no-op and second-edit behavior remain unchanged.

Candidate hashes are source-edit production `C90FFC54AE7E4A7DF655222D61872CF7935195CA70E23EC1EB7B4C584E7BD2D9` and
selftest `50FA05F041007DC96B130845082DF74933BCC21D7581C4C1C24CA0707A986F65`. The worker and coordinator each passed
source-edit `34/34`; all five complete-model attacks now lock with zero editable entries and typed non-mutating apply
refusal. Coordinator independently reran all 17 focused owners, repository typecheck, exact six-file zero-warning ESLint,
whitespace/diff/unsafe scans, corrected production-caller census, and all 16 declared frozen hashes. One initial caller-
census regex was malformed and is an AAR trigger; the corrected path-based census returned no source-edit consumer.

Fresh native Luna zero-write auditor `01a001ea-351c-77e3-915b-d98817ab9b60` owns no repository paths and is testing the
exact candidate hashes against independent valid edits, complete-model attacks, clones/cross-pairs, partial/refused state,
catalog/CAS/reparse boundaries, hostile proxy/accessor inputs, frozen sample/session UI truth, all focused gates, and
before/after hash parity. Batch 7C and Batch 7D remain frozen. `Not verified in game` remains mandatory.

### Batch 7B-C.1 first audit — profile-oracle reconciliation, 2026-08-14

Status: `NON-CLEAN ORACLE CORRECTION / CANDIDATE HASHES FROZEN`. Auditor
`01a001ea-351c-77e3-915b-d98817ab9b60` made no writes, preserved all 16 declared hashes, passed all 17 focused owners,
typecheck, exact six-file lint, diff/import/caller scans, valid edit/reparse/CAS positives, seven altered complete-model
refusals, twelve zero-observation boundary probes, malformed primitives/models, partial/refused/lookalike cases, and
permanent game truth. It returned `FINDINGS` for one profile-cross probe required by the coordinator's audit order: a
second exact producer-issued program/evidence pair for the same complete model/source/target at a different `uiScale`
issued 12 editable entries and accepted a source edit.

Follow-up inspection changed the acceptance contract. The four-argument 7B API receives only exact workspace/source and
program/evidence pairs; it receives no current session profile, no fifth expected-profile input, and no workspace/profile
issuance. Both profile variants were internally valid and producer-issued for the exact same complete model, source SHA-
256, target ID/range, and source text. Their 12 literal/range pairs were byte-identical. The accepted edit selected the
same literal/range/call provenance, changed only `80` to `81`, preserved unrelated workspace records, and completed the
existing byte-local reparse/reissuance proof. A different valid layout profile therefore does not establish a source-
literal authority failure at 7B.

Ownership is corrected as follows:

- 7B remains profile-agnostic source-literal provenance. Exact pair identity, complete-model equality, projected status,
  target/source/hash/range, catalog/entry authority, primitive CAS, and reparse remain its bar.
- 7D owns the current normalized profile and exact session projection. It must derive discovery only from that current
  projection, retain no caller-selectable program/evidence input, and clear staged inputs/receipts on workspace, source,
  selection, target, program, catalog, or profile drift before apply.
- Cross-profile source-edit refusal is removed from the 7B audit oracle. A fresh auditor must instead prove that two valid
  profiles expose the same source-literal provenance while all forged/cross-model/cross-source/cross-target identities
  remain refused. The 7D audit must later prove current-session profile freshness.

No production code changed during this reconciliation. The original audit remains honestly `FINDINGS` against its
supplied oracle; it is not rewritten as `CLEAN`. This acceptance change is an AAR trigger. Candidate hashes remain under
review and Batch 7D stays blocked until a fresh corrected-scope zero-write audit returns `CLEAN`.

### Batch 7B-C.1 corrected-scope independent acceptance — 2026-08-14

Status: `FOCUSED VERIFIED / CLEAN`; overall B119 remains `PARTIAL / Not verified in game`. Fresh native Luna auditor
`01a0020e-14cb-70e2-ac63-fada7020cd17` made zero writes, preserved every declared production and selftest hash, and
returned `CLEAN` against the corrected source-literal authority contract. All 17 focused owners passed, including
source edits `34/34`, call model `46/46`, layout program `542/542`, kernel `29/29`, font `10/10`, text `8/8`, corpus
`28/28`, keep-outs `16/16`, Scene `120/120`, preview `89/89`, paint `131/131`, Canvas `70/70`, and linter `112/112`.
Repository typecheck, exact six-file zero-warning ESLint, diff/import/caller/unsafe scans, and the no-fatal corpus lint
census also passed.

The independent corrected matrix passed `58/58`: authority 5, valid positives 8, CAS 1, primitive refusals 6, profile
3, complete-model boundaries 7, provenance boundaries 13, catalog 1, hostile public boundaries 5, and hostile models
9. Frozen Batch 7C/session/UI truth passed `9/9`. Two legitimate producer-issued profiles for the same exact complete
model/source/hash/target each exposed the same 12 source-literal IDs, ranges, ordering, target/call identity, and
provenance; the same typed edit was byte-local and reparsed/reissued under both. Forged, cross-model, cross-source,
cross-target, malformed, accessor, proxy, stale-CAS, and partial/refused cases remained non-authoritative. No production
source-edit caller existed before Batch 7D.

The auditor corrected two probe-oracle mistakes during the run: stale offsets after a length-changing edit and an
incorrect expectation that a no-op edit must reparse. Corrected whole-file byte-local/no-op assertions passed `8/8`;
no product change or weakened acceptance criterion resulted. This is an AAR trigger, not a product finding.

Batch 7B/7C source-mutation authority is accepted at the focused boundary and Batch 7D is now authorized. Batch 7D
must derive the exact current session projection, own current-profile freshness in the React seam, clear staged state
on all declared drift, and modify only its three declared UI files. Broad precommit/oracle/E2E/build, rendered Forge,
package/deploy identity, C++ frame acceptance, and in-game experience remain separately gated and unclaimed.

This acceptance checkpoint is synchronized and read back at GitHub #41 comment `5298323330`, Notion comment
`3bc4618e-d15b-81a1-ab3c-001dc866896e`, and guarded Drive revision
`AIroW37NNOR--wcHWt3qDTrSBXf9NTn4fGwTKOE0PWyrVBodAccprsIZzy9Ac3eM-v74jvXQo57bdy4J-IKa2Nq1s0Z1a2icRtxvhRWXdVFI`.
All three projections retain `PARTIAL / Not verified in game`, accept only the focused 7B/7C boundary, and identify
Batch 7D as the active exact three-file unit.

### Batch 7D source-safe property-controls candidate and parent-CAS correction — 2026-08-14

Status: `CANDIDATE / FRESH AUDIT REQUIRED`; overall B119 remains `PARTIAL / Not verified in game`. Tests were installed
before the first production change. With source editor and UIBuilder production frozen at `C34E96B3...120C98` and
`E2E47C43...72FA69`, test-only hash `BF459704...652DD9` exited `1` with twelve red rows for projection-bound discovery,
strict scalar parsing, staging, drift clearing, parent CAS, deterministic controls, exact owner calls, and current-
session wiring. The first candidate then passed 41 new 7D assertions plus all focused dependencies at hashes
`58065776...46E2EC`, `8DA2C192...4C8272`, and `0F655DB8...DEF436`.

Coordinator review rejected that first candidate before audit. `UIBuilder` returned an accepted closure decision before
React's functional updater proved the live current workspace. If the rendered closure still held expected workspace E
but the updater received newer workspace N, the updater preserved N while the child had already installed an accepted
receipt. The permanent test had exercised only the pure classifier and static callback text, not the actual delayed
parent protocol. This was a causal no-false-success acceptance failure, not a source-owner mutation failure.

The correction again changed test only first. Both first-candidate production hashes remained exact, test-only hash
`49C9856B...42A27F1` exited `1`, and seven causal rows proved the missing pending protocol, missing child readback,
false synchronous acceptance, missing typed stale refusal, and accepted child receipt despite preserved newer N. The
corrected parent scheduler is pure and exact-object CAS: submission is only `pending`; exact replacement R readback is
the sole accepted transition; unchanged E stays pending; newer N remains untouched and settles visibly as
`stale-parent-workspace`. Staging and controls are disabled while pending, and all declared context drift still clears
pending/staged/receipt state.

Corrected candidate hashes are source editor `82DFB6DB...7A878`, selftest `EC448373...F42F8A`, and UIBuilder
`C2378669...62BFD5`. Worker and coordinator both passed the prior 41/41 7D assertions, causal parent-CAS `10/10`, pending
SSR `2/2`, source edits `34/34`, workspace/source bundle PASS, call model `46/46`, layout `542/542`, editor session
PASS, preview `89/89`, linter `112/112`, repository typecheck, exact three-file zero-warning ESLint, and scoped diff/
hygiene scans. All accepted 7B/7C dependency hashes remained exact. A fresh independent zero-write hostile audit must
prove the actual callback/readback protocol, all scalar/CAS/drift families, no prop mutation, exact frozen hashes, and
permanent game truth before Batch 7D can be accepted or broad machine gates can begin.

### Batch 7D first independent audit — no-op acknowledgement correction — 2026-08-14

Status: `FINDINGS / CORRECTION ACTIVE`; candidate hashes remain rejected. Fresh zero-write auditor
`01a00250-c881-7820-a273-f9f03e00ca96` changed no files and preserved every actual hash. All eighteen focused selftests,
the complete `17/17` owner census, integration `7/7`, repository typecheck, exact three-file zero-warning ESLint, and
diff hygiene passed. Independent families were actual parent updater/CAS `10/10`, pending UI `4/4`, scalar parsing/
staging `20/20`, and source mutation/CAS `12/12`. Those greens did not accept the candidate.

One product defect remained. The owner-accepted `changed:false` branch installed `Accepted no-op` before invoking the
parent commit/readback seam. If the rendered context still referenced workspace E while the live parent had advanced to
N, no bytes were overwritten but the UI could report success against stale E instead of typed
`stale-parent-workspace`. This is the same no-false-success authority contract as a changed edit. Exact workspace
identity alone cannot prove a no-op updater ran because expected and replacement are both E.

The bounded correction remains in the same three files and is tests-first. Both changed and no-op successes must submit
the exact expected and owner-returned workspace to UIBuilder and remain pending until an actual parent-issued
acknowledgement bound to the exact attempt. Changed E-to-R accepts only exact R after the live updater runs. No-op E-to-E
accepts only after the parent acknowledges that the live updater processed E. Newer N remains untouched and visibly
refuses. Delayed, omitted, cloned, crossed, stale, or forged acknowledgements cannot accept, and the functional updater
must remain pure/idempotent.

The auditor's second item was an audit-order typo, not product drift: the submitted layout production gate omitted the
final `4` and had only 63 characters. The canonical and observed exact hash is
`6D16A261043F54E10BC519124B55C6862E3A4009314BDED27E9A970EE0FA7484`; before/after matched it. The auditor also
corrected two probe-oracle issues (PowerShell `.cmd` quote stripping and a legitimately `partial` fixture) before
reporting the product finding. Graphify again failed to canonicalize the untracked script path, so direct named-file
inspection and scans remain the recorded fallback. Broad/visual/deploy/game gates stay locked and `Not verified in
game` remains mandatory.

### Batch 7D acknowledgement and execution-time authority rounds — 2026-08-14

Status: `FINDINGS / ROUND 5 CORRECTION ACTIVE`; overall B119 remains `PARTIAL / Not verified in game`. The second
candidate unified changed and no-op edits behind the exact parent-issued attempt acknowledgement. It passed the prior
`41/41`, parent-CAS `10/10`, pending SSR `2/2`, and causal no-op acknowledgement `29/29` families, but coordinator
review reproduced a passive-effect race: a scheduled effect could replace a newer pending draft using its stale render
closure. Round three changed the effect to a functional state update and added `8/8` reconciliation rows. A fresh audit
then showed that the first regression covered only closure R / ref R, not stale closure E / execution-time ref R, and
that acknowledgement settlement bound only workspace rather than the full editor authority.

Round four installed the clarified stale-closure case and complete context settlement tests before production repair.
The final candidate moved the passive effect to execution-time `sourceEditContextRef.current`, bound pending receipts to
all eight exact identities (workspace, source, selection, target, program, evidence authority, catalog, and profile),
made hostile context wrappers fail closed through owner-issued identity, and made the source-edit truth label constant.
Candidate hashes were editor
`E2B2D66580B6D6DAB812DBE0A248E29F6B4DF69E51E0CAD9B2FB13E03B5D6392`, selftest
`74A48DA03EFF7CF9377A57A0DBDF838F6293668F19C9B1FFA34EE69D8B1B21DB`, and unchanged UIBuilder
`7132FBDC3DF1EEBB7A0183BEDC9C9BB8EC0741BA65C6BC13D18B8CCB23032B0A`. Worker and coordinator each passed
source editor `41/41 + 10/10 + 2/2 + 29/29 + 8/8 + 27/27`, source edits `34/34`, workspace/source/session owners,
preview `89/89`, linter `112/112`, repository typecheck, and exact zero-warning ESLint.

Fresh zero-write auditor `01a002bd-1b13-7a11-8aaf-d8df3ae0e5bc` preserved all three hashes and returned `FINDINGS`.
The repaired passive effect, all-eight-field settlement, hostile-wrapper boundary, parent acknowledgement, and permanent
game-truth rows passed. The unresolved product hypothesis is at the actual event-handler seam: stale
`stageSourceEdit` and `applySourceEdit` closures still capture context/state E. If invoked after execution-time authority
and the live draft advance to R, staging can replace R's receipt with E state, while apply can mutate E and subsequently
tag the pending result with R. Existing tests exercise the pure edit and acknowledgement owners but do not causally run
the real stateful handlers in this E/R ordering, so this is also a test gap and the round-four hashes are rejected.

Round five is confined to `X4UiSourceEditor.tsx` and its selftest; UIBuilder and every accepted pure owner are frozen.
The Luna owner must first capture a failing production-owned stale-stage/stale-apply matrix, including drift before
handler entry and before functional-updater execution, then make old E callbacks perform zero source/parent/state work
against live R while retaining exact E/E and R/R positives. No parent side effect may move inside a React updater. A new
zero-write hostile `CLEAN` audit remains mandatory before broad gates unlock.

Read-only live integration evidence also closed the directory-wiring question. The running Antigravity sidecar at its
published loopback instance resolves `x4ReferenceRoot` to
`F:\Downskies\x4unpackersuiteV1\X4 unpacked 9.00`; its manifest is `ready` at generation
`1785035333079-2178b4c31f`. The production browser loader accepted that live generation and all six exact pinned hashes
for Helper, widget_fullscreen, and regular/bold Zekton descriptor/atlas assets. The saved Antigravity configuration also
contains the expected mod workspace, extensions folder, game installation, corpus root, and schema path. No config,
corpus, game, or installed-extension file was written. The three acceptance menus are already usable as a no-write game
fixture: workspace and installed-extension SHA-256 match for `aic_menu.lua` (`4253D9BD...47DD7`), `aic_hub.lua`
(`657476EA...B8C4F`), and `aic_comm.lua` (`88FAB05A...3511`); `content.xml` (`A44FDA0C...13AFC`) and `ui.xml`
(`BB26D38B...03E5`) match too. The first renderer-versus-X4 comparison therefore needs no deploy mutation if these
identities remain exact.

### Pre-runtime real-menu projection census — blocking findings, 2026-08-14

Status: `FAILED / TESTS-FIRST CORRECTION REQUIRED`. Coordinator ran the production workspace adapter, target catalog,
editor session, configured-corpus loader, and layout-program projection against the exact current workspace copies of
the three acceptance menus. The corpus loader accepted live generation `1785035333079-2178b4c31f`; source identities
matched the installed X4 extension. All three real display targets nevertheless returned `previewStatus=refused`,
`programStatus=refused`, and `canRender=false`:

- `aic_menu.lua` `menu.display`: `program.localIdentities.invocations[15] does not match a unique source-bound local
  invocation`;
- `aic_hub.lua` `hub.display`: `program.operations[0].metadata.semantics.layer.sourceLiteral must equal value.location
  for direct literals`;
- `aic_comm.lua` `comm.display`: the same direct-layer literal refusal.

This is a reproduced product and test-oracle failure. The focused `542/542` layout-program suite proves its synthetic
contract but does not prove the three required shipping sources remain projectable. It blocks rendered-Forge and game
parity work regardless of the source-editor lifecycle correction. A disjoint tests-first layout-program unit must freeze
production, reproduce both real source-shape families with permanent repository fixtures, then repair only the producer
schema/identity relation that falsely refuses valid emitted evidence. The exact real-menu no-refusal census becomes a
required gate before browser rendering; dynamic/incomplete operations may remain partial but cannot make the complete
target wrapper self-invalid. Source editor Round 5 continues independently. This reconciliation changes the critical
path and is an AAR trigger.

### Layout-program correction and downstream Scene reconciliation — 2026-08-14

Status: `PARTIAL / DOWNSTREAM CORRECTION ACTIVE`. Native Luna `01a002d7-a2ce-7b31-9c74-967b5752364b` captured the
two source-shaped failures first at `542/544`, then repaired only the layout-program owner and its selftest. Coordinator
reran the exact candidate at `548/548`, with production hash
`9ECFE8AA3D0853A139DF0BF58821AC1A622E684C42E76FFF12EB3F297729C2F2` and selftest hash
`EC3D2D94EAEF18C38A2110F136B666C8FD30D807D82F94D19BC200278985A09A`. The valid repeated/source-bound local
invocation now projects `partial`; valid propagated frame-layer evidence projects `projected`; the new ambiguous,
cross-bound, out-of-range, and forged-layer controls remain refused. Fresh zero-write audit
`01a00353-6779-70e3-a4bf-743157508f31` is active, so these hashes are not accepted yet.

The coordinator then reran the production workspace adapter and full session path with all seven `ui.xml`-registered
Lua sources, the exact three target functions, a source-bound 1920x1080 captured profile, and the live canonical corpus.
Corpus generation `1785035333079-2178b4c31f`, Helper hash `D24A08B8...4DF2`, widget hash
`420AFBA3...AED1`, and all three menu source hashes matched. The original layout refusals are closed: `menu.display`,
`hub.display`, and `comm.display` each return `programStatus=partial` with 66/18/14 operations respectively. All three
still return `canRender=false`, however, because the downstream Scene owner rejects the issued pairs at its independent
`validateProgramStructure` boundary as `malformed-structure`. This is a separate cross-owner integration defect, not
renderer or game evidence. Scene-only tests-first repair `01a00352-510b-71a0-9841-fc54c1e6e92b` is active against
baseline hashes `B11E4C64...88334` / `C4CE51D6...0F8E`. Browser, broad, and X4 gates remain locked until both fresh
audits are clean and the exact three-menu session census reports renderable current results.

A second coordinator pass then exercised the editor's actual session-issued sample catalog, binding, and authority.
The first blanket numeric fixture was discarded because it supplied `80` to a span field. A corrected consumer-aware
rerun used bounded semantic values including `span=6`, viewport 1920x1080, and valid width/position/height samples; the
same menu refusal survived. This corrected an overbroad reading of the unsampled census. `hub.display` and
`comm.display` remain validator-valid `partial` programs and now materialize real
geometry before Scene: hub has 2 tables / 2 rows / 4 cells and comm has 1 / 1 / 3. Both still fail only at Scene's
`malformed-structure` boundary. `menu.display`, however, exposes a second layout-program defect once its 16 accepted
samples are consumed: self-validation refuses `program.operations[29]` because its conditional `setColSpan` branch
carries a `cellId` relation the schema says is not emitted for that branch. The active zero-write layout audit was given
this exact reproduction and cannot return `CLEAN` over the unsampled-only path. This sampled result is the current
production acceptance boundary; it supersedes any implication above that all three non-refused unsampled wrappers are
render-ready. The discarded span-80 fixture is an AAR harness trigger and is not product evidence.

Fresh zero-write audit `01a00353-6779-70e3-a4bf-743157508f31` returned `FINDINGS` and independently reproduced the
corrected real-session path. Both layout hashes remained exact; the permanent suite stayed `548/548`; exact two-file
ESLint and hostile identity/provenance/integrity checks passed. With consumer-aware `span=6`, 1920x1080 viewport, and
bounded geometry values, `menu.display` refuses `malformed-profile` at source line 726 / model order 219 because the
conditional static `row[1]:setColSpan(7)` operation gains its exact materialized `cellId` while the closed owner-shape
schema still treats that relation as forbidden. Hub and comm continue to issue validator-valid sampled geometry, so the
unsampled zero-cell state is an unresolved-width partial boundary rather than a permanent local-alias failure. The
audit's full typecheck was temporarily red only in concurrent owned Scene selftest work at line 5281; that diagnostic is
not layout-candidate evidence and must be cleared by the Scene owner.

The reconciled next layout unit is tests-first and limited to `x4UiLayoutProgram.ts` plus its selftest under exact native
Luna `01a00369-ec87-72a0-a790-5b76a0a3537e`. It must install a repository-contained real projector/sample regression,
then accept an optional conditional cell owner only when independently bound by exact emitted node/reference and
reciprocal table/row/cell/operation closure. Wrong, cross-row, cross-table, forged, detached, duplicated, reordered,
accessor, proxy, and ownerless conditional variants must remain refused. No source path, hash, line, model-order, menu,
or target special case is allowed. Exact live-menu census and a fresh zero-write hostile audit remain mandatory.

Source-editor Round five also hit a workflow/runtime AAR trigger before implementation: its first resumed lane waited on
an Agent Brain recall and exposed no native `luna_executor` / `gpt-5.6-luna` / `max` runtime proof. It stopped with zero
writes and no filesystem escalation. The coordinator replaced it with exact native Luna
`01a00365-95a3-7be3-9f9a-3f6d5acac624`, preserving the same two-file tests-first scope and frozen UIBuilder hash.

#### Source-editor Round-five candidate — fresh audit active

The corrected native Luna lane captured the required fail-first against unchanged production: stale-stage entry
`24/24`, stale-stage scheduled-updater `24/24`, and stale-apply entry `24/24` all failed, exit `1`, while production and
UIBuilder hashes remained exact. The bounded repair added execution-time context/draft identity gates and functional
updater rechecks. Final source editor families are green: prior `41/41 + 10/10 + 2/2 + 29/29 + 8/8 + 27/27`, new
stage entry `24/24`, stage updater `24/24`, apply entry `24/24`, stage positives `2/2`, apply positives `2/2`, and
stale apply-updater `8/8`. Coordinator independently reran that complete selftest, repository typecheck, and exact
owned-file ESLint. Candidate hashes are
`C7D1ABB7D638D403EE6150A2FFC511D654938650B33B16DBD98BB384E96294F2` /
`0D061E8D301E70E9233B07A2E85B27E33D42D196BC303464A76F5F3CB3FCEB7D`; UIBuilder remains
`7132FBDC3DF1EEBB7A0183BEDC9C9BB8EC0741BA65C6BC13D18B8CCB23032B0A`. Fresh zero-write hostile auditor
`01a00378-8f7b-7883-a2ec-a30b1cb72e4c` returned `FINDINGS` with all three hashes exact and zero writes. Actual compiled
stage callbacks passed stale-entry and scheduled-updater drift `8/8` each plus current E/E and R/R controls `2/2`.
Actual compiled apply callbacks reproduced two missing interleavings. First, UIBuilder's synchronous `flushSync` parent
submission can change both live refs and the draft before the old callback resumes; the old callback then
unconditionally installs its captured pending object and overwrites the newer context/staging. Second, with context and
pending submission unchanged, fulfillment and rejection both clear a newer staged draft because they do not bind
settlement to the exact pending draft object. Source-editor/source-edit tests, typecheck, exact lint, UIBuilder seams,
all eight context identities, hostile wrappers, acknowledgement substitution controls, and permanent game truth remained
green outside those two findings.

Round six is tests-first under exact native Luna `01a0038b-4666-7171-b39c-32f761da501c` in the same two source-editor
files, with UIBuilder byte-frozen. It must make pending installation a side-effect-free functional transition bound to
the exact execution context, execution draft, and parent submission after the parent returns; any reentrant live change
preserves the exact newer state and may never resurrect the old pending object. Fulfillment and rejection must settle
only the exact pending draft object installed by that attempt; same context and same submission alone are insufficient.
Legitimate no-op E-to-E, changed E-to-R, stale N, delayed/duplicate/forged acknowledgements, all prior Round-five
matrices, and `Not verified in game` remain mandatory. Another fresh zero-write hostile `CLEAN` is required.

#### Scene sampled-source candidate — fresh audit active

Native Luna `01a00352-510b-71a0-9841-fc54c1e6e92b` isolated two exact independent Scene failures. Repeated expanded
local calls retain callee `modelOrder`, so valid hub and comm samples were rejected at `model-order`; refused
unmaterialized table/row nodes retain legitimate downstream non-applied operation IDs, so the prior one-operation
recognizer rejected their reciprocity. Fail-first hub was validator-valid `10 operations / 1 frame / 2 tables / 2 rows /
4 cells`; comm was `7 / 1 / 1 / 1 / 3`; the unmaterialized control failed `row-reciprocal`. The repair accepts duplicate
model order only across distinct, uniquely linked, exact target/source-bound expanded invocations, and recognizes partial
owner chains only when ordered, issued, owner-shaped, gap-bound, and non-applied. Detached, duplicated, reordered,
contradictory, applied, malformed, or authority-mismatched variants remain refused in permanent tests.

Coordinator independently reran Scene `122/122`, repository typecheck, and exact two-file ESLint at hashes
`ADE6C8E6EC3125E023B05A0C793AD48716BC6002F6C4775CCE3628B4049CE5C3` /
`9C0214635824A21FC47D9F767AA0BC5DA43F3789784EFA2B18C22C60A2C80707`; layout production remained exact
`9ECFE8AA3D0853A139DF0BF58821AC1A622E684C42E76FFF12EB3F297729C2F2`. Fresh zero-write Scene auditor
`01a00381-f62a-7a11-92cb-20c5009174b8` is active. This candidate does not clear the upstream sampled-menu layout defect
and is not browser or game evidence.

That Scene audit completed its substantive matrix with no causal Scene finding: Scene stayed `122/122`; 72 independent
probes passed (`7/7` positives, `56/56` refusals, `9/9` malformed/accessor/cycle cases, no throws); hub and comm
materialized `2/2/4` and `1/1/3` table/row/cell geometry and were accepted `partial`; repeated-occurrence and
unmaterialized-chain controls behaved correctly. It withheld `CLEAN` only because the concurrently owned layout
production hash changed from `9ECF...9C2F2` to `EE6A...C61AA3` during the audit and its typecheck snapshot saw the now-
fixed layout-test narrowing errors. The zero-write parity rerun against stabilized layout hashes
`EE6A58C1...C61AA3` / `A9295A27...C1016` and exact Scene hashes `ADE6C8E6...49CE5C3` /
`9C021463...2C80707` returned `CLEAN`: all four hashes held before/after, Scene remained `122/122`, full typecheck and
exact lint passed, and all 72 hostile outcomes remained correct. The focused Scene candidate is accepted; browser and
game truth remain untested.

#### Conditional-cell owner repair — coordinator red checkpoint, 2026-08-15

Native Luna `01a00369-ec87-72a0-a790-5b76a0a3537e` has changed only the two declared layout-program files. The
coordinator's exact-current focused run is still red at `548/549`, exit `1`. The sole failed assertion is the new direct
positive, `B119 sampled conditional static setColSpan materializes and closes its exact cell owner`: its unsampled path
currently refuses, and its sampled path refuses `malformed-profile` because `program cell operation receiver does not
identify its owning cell`. The same regression's local-invocation and production-shaped variants both return `partial`
and validate, and all nine conditional-owner hostile cases pass. This is not an accepted candidate or game-readiness
evidence. The worker must reconcile whether the direct fixture is genuinely valid or noncausal without weakening the
schema, deleting the positive, or special-casing a source/index; then return a fully green suite for independent review.

The corrected layout candidate is now coordinator-green at `549/549`, repository typecheck, exact two-file ESLint, and
diff-check. Exact hashes are production `EE6A58C17990D2BBE6489C977EE5E22FB5A7679FADAC789CF20130A203C61AA3` and
selftest `A9295A27946B27FE19BCE1584486AB01E2AC91BF92004E367DDA4B8703DC1016`. The direct cross-table/closure positive is
retained; the simpler two-column/span-seven schema fixture is not accepted as a substitute for the real twelve-column
owner path. Owner Luna is rerunning the exact live three-menu layout census, and fresh zero-write native Luna auditor
`01a003a1-f051-7c32-98b9-f98382a7211a` is independently attacking the current pair and exact live menu. This remains a
candidate until both source census and audit are clean.

Source-editor Round six has now reached causal fail-first with production still exact
`C7D1ABB7D638D403EE6150A2FFC511D654938650B33B16DBD98BB384E96294F2`. Selftest hash
`6F09FB2F00DED80B982FB3B608ECF1DC57C901A26FA55DC50CB8B6C0A3376E83` exits `1` with 82 named failures: 64
reentrant-parent cases across all eight authority fields, four prior receipt states, and fulfillment/rejection; 16
draft-only settlement cases across four states, same/different callback identity, and fulfillment/rejection; plus two
exact-pending repeated-updater idempotence cases. The independent finding-one control remains `4/4`. This is valid red
evidence only; no source-editor production repair is accepted from this checkpoint.

The bounded Round-six candidate is now focused-green at production/selftest hashes
`5154A1BBDEA470E433C99C4AA33842821099E0D08A91791770B0AD7DC957D004` /
`B5702729A72E16367D3FC70B880F6D6A774887AF0F242876E4D2E992A7204A81`; UIBuilder remains exact
`7132FBDC3DF1EEBB7A0183BEDC9C9BB8EC0741BA65C6BC13D18B8CCB23032B0A`. Coordinator reran every prior source-editor
family plus Round-six `64/64 + 16/16 + 2/2`, exact two-file ESLint, source edits `34/34`, preview `89/89`, linter
`112/112`, editor session, two-file diff-check, and—after the concurrent layout-test narrowing was corrected—the full
repository typecheck green. Fresh zero-write native
Luna auditor `01a0039d-838e-78d3-8ddf-fdb2ef061e68` returned `CLEAN` against the actual compiled callback.

#### Source-editor Round-six independent acceptance — 2026-08-15

Status: `FOCUSED VERIFIED / CLEAN`; overall B119 remains `IN PROGRESS / PARTIAL — Not verified in game`. The audit
changed no files and preserved source-editor, selftest, and UIBuilder hashes exactly at `5154A1BB...7D004`,
`B5702729...04A81`, and `7132FBDC...32B0A`. The complete selftest and exact ESLint passed alongside independent
reentrant-parent `64/64`, draft-only acknowledgement `16/16`, exact settlement/idempotence `2/2`, acknowledgement
`24/24`, and callback-acknowledgement variants `9/9`. No current-byte causal escape was reproduced. The source-editor
candidate is accepted at the focused boundary; broad host, rendered browser, deploy, C++ frame acceptance, and game-
experience evidence remain open.

#### Full-brief completion reconciliation before runtime gates — 2026-08-15

The first three-menu renderable census is a runtime-entry gate, not the B119 close. Current-source inspection against
the governing brief and source-first design records four required post-census implementation families:

- `X4UiSourceEditor` exposes exact scalar source controls and a source-canonical Canvas preview, while the separate
  legacy pixel designer still owns drag/resize. Proven direct-call insertion/deletion, minimal-source scaffold creation,
  and source-canonical visual manipulation are not mounted.
- `x4UiKeepOuts.ts` owns validated screenshot-polygon calibration data and all four context presets, but the editor has
  no screenshot/manual-polygon calibration UI or persisted design-time calibration consumer.
- Scene/paint/Canvas render exact geometry and Zekton glyph alpha, but `button`, `editbox`, and `icon` still emit
  `unsupported-runtime-paint`; real widget paint must be derived from shipped `widget_fullscreen.lua` and corpus assets
  before pixel parity can pass.
- The existing readiness owner already binds experience confirmation to an exact workspace hash/deploy timestamp, but
  UIBuilder's B119 truth state remains unconditional. A B119 confirmation adapter must reuse that authority and also
  bind artifact ID, registered Lua/hash set, preview profile/metrics identity, and blocking-lint state so any drift
  restores `Not verified in game`.

The remaining acceptance evidence is still missing: compile/export/package byte identity and edit locality, installed
Forge rendering, UI-scale comparison, manual calibration interaction, exact deploy identity, and three Forge-versus-X4
screenshot comparisons covering columns, rows, wrap, and truncation. No capability-map delta is claimed yet; these are
gaps in the already documented B119 architecture, not new parallel infrastructure.

#### Conditional-cell owner audit rejection and causal rework — 2026-08-15

Status: `FINDINGS / TESTS-FIRST CORRECTION ACTIVE`. Fresh zero-write native Luna audit
`01a003a1-f051-7c32-98b9-f98382a7211a` preserved layout hashes `EE6A58C1...C61AA3` /
`A9295A27...C1016`, passed the permanent suite `549/549`, repository typecheck, exact lint, and an `11/11` hostile
matrix with zero throws. Those greens do not accept the candidate. The exact workspace `aic_menu.lua` target with all
16 consumer-aware samples still self-refuses `malformed-profile: program cell operation receiver does not identify its
owning cell`; no sampled issued pair exists. Hub and comm remain non-refused/schema-valid partial programs.

The audit also proved that the new direct positive is noncausal: it materializes the expected 12-column `ct`, but the
conditional `setColSpan` operation closes over a cell in the earlier 4-column `tt`. Its reciprocal graph is internally
valid while its source ownership is wrong. Therefore the `549/549` candidate and its positive assertion are rejected.
Native Luna `01a003bc-cf99-7913-bff4-d1b9ced8e455` now owns only `x4UiLayoutProgram.ts` and its selftest. It must first
capture a causal red that requires the operation, receiver identity, and reciprocal table/row/cell ledgers to name the
same expected materialized `ct`, then repair exact issued ownership without source/path/order special cases or schema
weakening. Exact sampled menu/hub/comm census plus a new zero-write hostile `CLEAN` audit remain mandatory.

#### Conditional-owner second audit rejection and three-menu correction — 2026-08-15

Status: `FINDINGS / TESTS-FIRST CORRECTION ACTIVE`. Native Luna `01a003bc-cf99-7913-bff4-d1b9ced8e455` produced a
valid fail-first receipt at `548/549` with production unchanged, then returned a coordinator-green `550/550` candidate
at layout hashes `AE6C49A4A14BABDBC84F1AD109731E53D832163D70934DD4C4685F331FBAE30A` /
`11E5CE7678B2E7A56C0D76A76F7D6E55035CBCC5B9EEB7D3FA9439D444E7BC12`. Coordinator independently passed the
complete selftest, repository typecheck, exact two-file ESLint, and diff-check. Those greens do not accept the pair.

Fresh zero-write Luna audit `01a005b9-e7d0-7f91-9ce1-40f7b283bd19` and the separate exact integration auditor
`01a003a7-f662-7213-b76d-67572589ddf3` preserved every declared repository, workspace, installed-source, and corpus
hash and independently returned the same three-menu result with consumer-aware samples, `span=6`, and `1920x1080`:

- `aic_menu.lua` accepted all 16 samples but refused at `program.operations[53]`: the emitted conditional
  `setColSpan` owner shape omitted required `rowId`. The exact source operation is line 812/model order 281; its causal
  chain is `addTable` op208 -> `ct` -> `addRow` op278 -> `row` -> `row[(slot - 1) * 4 + 1]` at columns 1/5/9.
- `aic_hub.lua` accepted all 11 samples but refused at `program.operations[12]`: the conditional `createButton` owner
  shape also omitted required `rowId`. The exact source operation is line 691/model order 449; its causal chain is
  `addTable` op441 -> `st` -> `addRow` op448 -> `sr` -> `sr[i]` under `ipairs(TABS)`.
- `aic_comm.lua` accepted all five samples and issued a self-validating `partial` program with `14` operations and
  geometry `1 frame / 1 table / 1 row / 3 cells`, but strict Scene refused `malformed-structure`. The first mismatch is
  `table-reserve-true-false`: source-pinned `reserveScrollBar=true` conflicts with final Helper/kernel state `false`
  after all three columns receive percentage widths and no variable-width column remains.

The independent hostile matrix also proved three current-byte authority escapes despite `550/550`: a different cell in
the same row can replace the conditional owner when both snapshots and reciprocal ledgers are coherently rewritten; an
earlier sibling table/row/cell chain can be forged the same way while source receiver metadata remains unchanged; and
table/row/cell `operationIds` arrays can be reversed in both snapshots because order is not enforced. All three return
`valid=true` without throws. Wrong earlier/later table, cross-row, detached, ownerless, duplicated, accessor, and proxy
attacks refuse, and valid same-name siblings remain accepted.

Native Luna `01a0076a-f9ab-7c41-a395-b2f8f9b6478e` owns only the same two layout-program files. It must first install
source-shaped fail-first regressions for both real conditional-owner mechanisms, all three accepted attacks, and the
Helper-derived final scrollbar fact. Production repair must bind source receiver/reference identity to exact
table/row/cell ownership, enforce reciprocal ledger order, and make the final consumed scrollbar fact agree with the
shipped Helper/kernel without weakening Scene. Exact three-menu `canRender=true`, focused gates, and another fresh
zero-write hostile `CLEAN` audit remain mandatory before broad or runtime gates unlock.

#### Conditional-owner third candidate and fresh three-menu audit — 2026-08-15

Status: `CANDIDATE GREEN / INDEPENDENT AUDIT ACTIVE`; overall B119 remains `IN PROGRESS / PARTIAL — Not verified in
game`. Native Luna `01a0076a-f9ab-7c41-a395-b2f8f9b6478e` preserved the historical `550/550`, then added eight
source-shaped tests for the two real deferred-owner mechanisms, final scrollbar state, cross-cell substitution, forged
earlier-sibling ownership, and the three table/row/cell ledger reversals. The tests-only receipt was exactly `550/558`,
fixtures `8/8`, zero validator exceptions, with production still `AE6C49A4...BAE30A`.

The candidate is now `558/558` at production
`9B7A48361EF1BC00306BFD6B312CDCC9BB56CA756EB381ABA88C5A71CD051210` and selftest
`9F8F3B2777842BE9141B4CC7E8F83A543A6C81514827F8F998F4B02DFEFA444C`. It resolves deferred table, row, and cell
owners only after materialization; requires source receiver/result/semantic references to identify the emitted owners;
normalizes and validates reciprocal node ledgers in operation order; and derives the descriptor scrollbar fact from the
final Helper/kernel state. Coordinator reproduction passed `558/558`, phases `15/15 + 49/49 + 11/11`, zero validator
exceptions, zero hostile acceptance, repository typecheck, and exact two-file ESLint.

The coordinator did not accept the worker's first close receipt blindly: the final selftest edit had introduced a
reproducible `TS2367` at line 11552 after the worker's earlier green typecheck. A same-worker, selftest-only correction
rewrote the identical `conditional`/`looped` membership predicate without casts, preserving all 558 checks and the
production hash; coordinator typecheck then passed. This stale-receipt mismatch and two failed patch applications during
the worker repair are AAR triggers.

Read-only hash census confirms workspace and installed X4 sources remain byte-identical for `aic_menu.lua`
`4253D9BD...47DD7`, `aic_hub.lua` `657476EA...B8C4F`, and `aic_comm.lua` `88FAB05A...3511`; Scene, preview, and paint
owners remain frozen. Fresh zero-write native Luna `01a00796-c378-7d80-bcad-452cd290213b` is now running the exact
1920x1080, UI-scale-1 consumer-aware three-menu projection through strict Scene/preview/paint plus the hostile mutation
matrix. Only an exact three-menu `canRender=true` result and audit `CLEAN` unlock broad/runtime gates.

#### Conditional-owner third audit rejection — exact current three-menu gate, 2026-08-15

Status: `FINDINGS / PARTIAL CHECKPOINT`; overall B119 remains `IN PROGRESS / PARTIAL — Not verified in game`.
Fresh zero-write native Luna audit `01a00796-c378-7d80-bcad-452cd290213b` preserved all supplied current hashes and
reproduced layout `558/558`, phases `15/15 + 49/49 + 11/11`, zero validator exceptions, repository typecheck, and exact
two-file ESLint. Those focused gates do not accept the candidate. The auditor then used the canonical configured
`x4-9.00` corpus and the exact byte-identical workspace/installed `aic_menu.lua`, `aic_hub.lua`, and `aic_comm.lua`
sources at `1920x1080`, UI scale 1, with each target's complete consumer-aware sample catalog (including menu
`span=6` and hub `count=2/index=1`). The required production-path census was:

- menu: 16 samples; `status=refused`, `canRender=false`; layout self-validation says program cell operation source
  references do not identify the owning cell; Scene and paint are not reached;
- hub: 11 samples; an 18-operation `partial` program with geometry `2 tables / 2 rows / 4 cells` is emitted, but
  strict Scene refuses `malformed-structure`, so `canRender=false` and paint is not reached;
- comm: five samples; a 14-operation `partial` program with geometry `1 table / 1 row / 3 cells` is emitted, but
  strict Scene refuses `malformed-structure`, so `canRender=false` and paint is not reached.

The hostile matrix refused cross-cell substitution, a forged earlier-sibling chain, and reversed table/row/cell
ledgers with zero throws while retaining positive controls. Final source/evidence/kernel `reserveScrollBar` parity is
covered by the green layout suite, but comm still fails the strict Scene/render gate. All supplied layout, Scene,
preview, paint, selftest, workspace, and installed-menu hashes matched before/after. The audit changed no files and
preserved the pre-existing dirty worktree exactly. Temporary custom-transport attempts failed only inside the
read-only audit harness before it matched the canonical fetch/manifest contract; they touched no durable state.

This satisfies the acceptance contract's `FINDINGS` branch and rejects the candidate. Broad E2E/build/rendered-Forge
and game gates remain locked. The next implementation unit must be tests-first and bounded to the reproduced
real-source owner/structure failures. This state may be committed only as an explicit `PARTIAL` blast-radius
checkpoint; it is not renderer acceptance and does not weaken `preview for layout, game for truth`.

External checkpoint projection is only partially verified. GitHub #41 comment `5304669783` was created and read back
with the exact result above. The canonical Drive document accepted a revision-guarded append and read back the new
tail at revision `AIroW344...F1xdj`. Notion returned success IDs `3bd4618e-d15b-8169-900a-001d629c4546` for a page
comment and `3bd4618e-d15b-81d7-953a-001d9ecc6503` for an explicit discussion reply, but repeated comment readback
still reports 25 comments and exposes neither ID. The Notion projection is therefore `PARTIAL / UNVERIFIED`; no third
blind write is authorized because it could create hidden duplicates. The first Drive mutation also remained in-flight
for roughly 30 minutes before succeeding and reading back. These two connector behaviors, plus the first failed
documentation patch context match, are AAR tool-friction triggers; none changed product code or weakened the gate.

Checkpoint containment remains exact: 79 current worktree entries split into 51 B119 manifest paths and 28 excluded
entries; all 51 manifest paths are dirty and the manifest's tracked `git diff --check` exits zero. The precomputed
Graphify graph cannot answer the current failure path because it predates the still-untracked B119 files and contains no
`projectX4UiEditorSession` node. Rebuilding it is deliberately deferred until after checkpointing so graph artifacts do
not enlarge the blast radius. Read-only process evidence sees Antigravity but no X4 process; machine quiet remains
unknown, so the mandatory machine-state gate still prohibits precommit, staging, commit, and push.

The linter proof boundary was refreshed without mutation. Exact commands `npx.cmd tsx src/lib/x4UiLint.selftest.ts`,
`npm run test:x4-ui-corpus -- --selftest`, and `npm run test:x4-ui-corpus -- --json` exited zero. Results are linter
`112/112`, corpus harness `12/12`, and live authority `http://127.0.0.1:53797` resolving the configured unpacked root
`F:\Downskies\x4unpackersuiteV1\X4 unpacked 9.00` at manifest generation `1785035333079-2178b4c31f`. The live census
read all `81/81` selected official base/DLC Lua files with zero read failures and zero applicable fatal findings. Six
trusted-official restricted-online-call findings remain visible and explicitly not applicable to that official-source
census; the report also carries six warnings, 70 unverified files, 26 bounded-detail truncations, and 13,657
verification gaps. These fresh counts supersede older current-count summaries without rewriting their historical
receipts. They validate the bounded static linter/corpus contract, not renderer acceptance or in-game behavior.

#### Post-rejection causal audit and checkpoint gate — 2026-08-15

Fresh native Luna `01a007cf-8266-7df3-a083-e1a9af631564` completed a zero-write follow-up with status `PARTIAL`.
It reproduced the exact menu refusal and narrowed it to the source-owner invariant in
`x4UiLayoutProgram.ts`: an operation with `cellId` reaches validation, but the resolved cell identity is absent or does
not exactly equal the emitted receiver/result/semantic source reference. The all-references-equal branch is not the
failure. This is a producer/contract defect with high confidence; exact operation index, ID, call kind, line, model
order, cell identity, and actual references remain unknown because the bounded in-memory diagnostic failed.

Hub and comm remain exact at 18 operations with geometry `2/2/4` and 14 operations with geometry `1/1/3`, then strict
Scene returns `malformed-structure`. Their first failing `validateProgramStructure` stage and compared fields remain
unknown because the validator discards its stage before returning `false`; no unsupported cause is recorded. The audit
classifies each provisionally as a producer-to-Scene contract defect (`60%` producer / `40%` Scene validator), not a
profile defect. Repeated PowerShell inline-harness no-output failures and the stale Graphify canonicalization failure are
AAR/tool-friction evidence, not product findings.

The post-checkpoint correction remains sequential and tests-first: first expose and preserve the exact menu operation
and owner ledgers, add hostile receiver/semantic/result/owner controls, and repair only producer owner binding without
weakening `requireSourceOwnerIdentity`; then expose the first hub/comm structure stage, add one-field hostile mutations,
and repair only the owner named by that evidence. Final focused acceptance remains menu `16/16`, hub `11/11`, comm
`5/5`, all three `canRender=true`, exact geometry/operation counts, hostile refusals, layout `558/558`, phases
`15/15 + 49/49 + 11/11`, Scene/preview/paint families, typecheck, exact lint, hash parity, and a fresh zero-write
`CLEAN`. None of this is in-game proof.

At `2026-08-16T00:04:11Z`, process readback found 18 `Antigravity IDE` processes and zero X4 processes; Ken explicitly
confirmed the machine is quiet and ordered a checkpoint commit followed by continued work. The mandatory machine-state
gate is therefore satisfied for the exact 51-path B119 partial checkpoint. The 28 excluded dirty entries remain outside
the staging manifest.

#### Precommit route-authority reconciliation — 2026-08-15

The first machine-state-authorized `npm run precommit:check` exited `1` at `npm run test:capabilities`; no paths were
staged. The capability audit first rejected CommonJS direct-run guards in
`src/server/x4UiIntegration.selftest.ts` and `vscode-extension/src/diagnosticsMap.ts` because bare `require` escaped
static route-source analysis. Two disjoint one-file native Luna repairs replaced only those guards with established
`process.argv[1]` filename checks. Direct selftests pass `7/7` and `11/11`, import remains side-effect-free, typecheck
and diff checks pass, and the audit advances beyond both files without weakening the oracle.

The next audit result is substantive and fail-closed: the new public GET
`/api/agent/x4-ui-integration-selftest` and its four newly reachable route sources are absent from the standing route
disposition manifest. Removing the selftest would discard runtime-oracle coverage, so reconciliation requires the
existing reviewed candidate/promotion workflow. The reviewed candidate is SHA-256
`C2B4AE641B0C849F2348E8241BAEEEA5F64BA49213CCD6E34E2E4B6323F227C5`. Its complete semantic delta is:

- add source-boundary entries `src/lib/x4UiCallModel.ts`, `src/lib/x4UiLint.ts`,
  `src/server/x4UiIntegration.selftest.ts`, and `vscode-extension/src/diagnosticsMap.ts`;
- add `GET /api/agent/x4-ui-integration-selftest` as `public-selftest`, owner
  `runX4UiIntegrationSelftest`, one registration, public resource, optional workspace;
- no removed or changed routes/sources; no dynamic-route, capability-signature, MCP identity/signature/module,
  schema-version, or other-field change.

The generated route has the same authority shape as all 136 existing public selftests, and candidate generation's full
in-memory audit passed. Ken explicitly authorized promotion. Native Luna changed only
`config/forge-route-dispositions.json`; its final SHA-256 exactly matches the candidate. The semantic delta is the four
declared source additions and one public selftest route; three existing route records were textually reordered with
unchanged values. The checkpoint manifest is now exactly 52 paths, and the 28 unrelated dirty entries remain excluded.

Post-promotion validation passes: exact promotion, `npm run test:capabilities`, repository typecheck, manifest
`git diff --check`, and the complete machine-state-authorized `npm run precommit:check`. The full gate passed tripwires,
canon mirrors, 54/54 E2E-verdict selftests, Vite lifecycle, product-copy, durable-writer audits, the 12-capability /
297-literal-route contract, MCP capability selftests, action-receipt coverage (`82` routes / `55` surfaces), typecheck,
and file-size guards. No path was staged during either precommit run.

Durable projection is mixed but explicit. GitHub #41 comment `5304942931` was created and read back. The canonical
Drive document was updated through a protected-control-aware, revision-guarded write and read back in tab `t.0` at Drive
revision `78` / Docs revision
`AIroW35zilH6cbfsvLYHgF2GCdKz0jhA4iQRZD1Kzm5t0lLlcIk0rp7hZZ9KmqzlA9U2ZFUFuNF0m_x32IYmlSRuiFED5x4b60s_Oe2a7a5M`.
Fresh Notion all-comments readback still exposes neither prior success ID, so that projection remains
`PARTIAL / UNVERIFIED`; no third blind write is authorized. The initial precommit failure, two newly exposed guard
defects, one malformed worker-spawn command, long authority checks, and the Windows trusted-read transport correction
are AAR triggers.

#### Post-checkpoint exact-menu layout repair — 2026-08-16

Status: `PARTIAL`; the bounded layout-owner defect is accepted, while Scene/preview/paint and in-game proof remain open.
Checkpoint `77138741a9f470e2c6c37c2d6857688dd1e2b13e` is committed and pushed with remote parity. Native Luna
`01a008e2-3017-7813-a890-c6df3af4552d` then changed only `x4UiLayoutProgram.ts` and its selftest. The exact causal
failure was a conditional `addRow` with no source-owner cells: deferred line-726/model-order-219 `setColSpan` resolved
to a later materialized row instead of its emitted `row[1]` source identity. Selftest-only fail-first receipts were
`558/559` and exact multi-row `564/565`, each preserving the applicable production hash.

The repaired producer emits authority-bound non-kernel source-owner cells for conditional rows without adding those
rows to drawable table/kernel geometry. Final hashes are production
`334BBD62869559385537E610BEBD1B8FCBE24F5515357FE1C4C20EA674669A42` and selftest
`595AFA93EEE1893D591798F73F49D09717650BC06853D01E9FD4EBB15C070C0D`. Worker and coordinator validations pass layout
`565/565`, repository typecheck, exact two-file ESLint, and diff hygiene; receiver/result/semantic/owner, cross-cell,
forged-sibling, and reversed-ledger negatives still refuse without throws.

The exact byte-identical workspace/installed menu hash remains
`4253D9BD9DE4113D4DE0B881DBF5A1E90CAA7B30F735BA925403EBEF7EC47DD7`. With the canonical 9.00 corpus,
`1920x1080`, UI scale 1, and all 16 consumer-aware samples, the real menu now emits `partial` layout geometry
`1 frame / 4 tables / 9 rows / 88 cells / 66 operations / 95 gaps`. Scene is the first refusal at
`malformed-structure`; preview refuses at `scene`, `canRender=false`, and paint is not reached. No mod, game, corpus,
configuration, installed extension, preview, paint, or Canvas path changed. Scene-only native Luna
`01a00937-79f9-7af0-a73c-a5ae7ac30685` is active tests-first against the exact menu/hub/comm structures.

AAR trigger: the first compact synthetic row-rebind positive was green while the real multi-row menu still refused.
Sustain exact real-source censuses before promoting a producer candidate. Highest-risk weakness remains a convincing
standalone preview or synthetic fixture that does not exercise the native game acceptance boundary; retain permanent
`Not verified in game` state and keep game deployment authoritative.

#### Preview-to-Paint exact-origin audit rejection and Paint-ingress repair contract — 2026-08-16

Status: `FINDINGS / PARTIAL`; the real configured MENU/HUB/COMM projection is now positive, but the public Paint input
boundary is rejected and overall B119 remains `IN_PROGRESS / PARTIAL — Not verified in game`. The tests-first Preview
repair changed `x4UiPreviewPipeline.ts`, its selftest, and `x4UiPaintPlan.selftest.ts`. It replaced structural Scene-copy
authority with one private `WeakMap` binding between the exact issued Preview result and exact raw Scene object. Worker
and coordinator focused validation passed Preview `92/92`, Paint `136/136`, Scene `127/127`, Layout `565/565`, typecheck,
exact lint, and diff hygiene.

Fresh zero-write native Luna audit `01a00c3e-2f3c-74d2-acad-b5b5ac335a5b` preserved every supplied hash and returned
`FINDINGS`. Its corrected configured file-backed census used all exact consumer-aware samples at `1920x1080`, UI scale
1: MENU `16` (`11 applied / 5 not applied`), HUB `11` (`9/2`), and COMM `5` (`5/0`). All three reach non-refused
`partial` Layout, Scene, and Paint; the editor-session projections report `canRender=true`; every result remains
`Not verified in game`. Paint totals are MENU `66 operations / 27 applied`, geometry `1/4/2/16/3/5/7`, `158`
diagnostics; HUB `18/11`, geometry `1/2/2/8/2/3/5`, `38`; COMM `14/12`, geometry `1/1/1/3/3/5/10`, `40`.

The same independent 14-case hostile matrix found two causal ingress defects despite zero thrown exceptions. A Scene
wrapper with a custom prototype and otherwise exact own fields reached Paint as `partial`; `exactOwnDataKeys()` checks
own descriptors but not the wrapper prototype. A Proxy around the exact raw Scene refused, but one descriptor trap fired
because `sceneCandidateFromInput()` probes the candidate's `format` descriptor before the private exact-identity
materializer. Accessor-wrapper getter calls remained zero. The earlier auditor's status-envelope, catalog-envelope,
selection, expression-mapping, import, and buffered-output failures are audit-harness friction only; they changed no
files and do not weaken or satisfy the product oracle.

Reconciliation expands the bounded implementation unit to exactly `src/lib/x4UiPreviewPipeline.ts`,
`src/lib/x4UiPreviewPipeline.selftest.ts`, `src/lib/x4UiPaintPlan.ts`, and `src/lib/x4UiPaintPlan.selftest.ts`.
JavaScript provides no trap-free reflection that distinguishes an arbitrary plain object from a Proxy; therefore the
earlier Paint-only plan could not both inspect an arbitrary reconstructed wrapper and guarantee zero Proxy observation.
The private Preview authority must also bind the exact issued Scene-result wrapper identity alongside the exact raw
Scene identity. Paint must pass its candidate directly to that private materializer before any candidate descriptor,
key, or prototype observation and accept only either exact issued identity. The positive wrapper control becomes the
actual Preview-issued wrapper, not a structurally matching caller reconstruction.

Tests must first reproduce both failures against the public Paint entry: custom-prototype wrapper accepted, and Proxy
Scene refused only after a nonzero trap count. They must also prove that the exact issued raw Scene and exact issued
Scene-result wrapper remain accepted. Accessor wrappers, arbitrary matching plain wrappers, inherited/custom-prototype
wrappers, copied Scenes/results/authorities, cross-result identities, mismatched status copies, and Proxy Scenes must
refuse deterministically with zero getter/proxy observation and zero throws. No public token or caller-computable digest
may replace the private object-identity boundary.

Acceptance requires a causal red receipt, final Paint/Preview/Scene/Layout focused suites, typecheck, exact four-file
zero-warning ESLint, diff hygiene, protected-hash parity outside the four owned files, and a fresh independent zero-write
audit. That audit must repeat the complete three-menu census and hostile matrix. Broad Forge E2E/build/browser and X4
gates remain locked; a non-refused Paint plan is layout-preview evidence, not game acceptance.

#### Exact-origin authority accepted; sampled Scene census rejected — 2026-08-16

Status: `FINDINGS / PARTIAL`; exact Preview-to-Paint object authority is focused-accepted, while the complete sampled
MENU/HUB/COMM editor-session path refuses in Scene. Overall B119 remains
`IN_PROGRESS / PARTIAL — Not verified in game`.

The tests-first exact-origin correction changed only the Preview and Paint production/selftest pairs. Final hashes are
Preview production `A28179C95B14B2D84583332FC94E0E27C78EDB5240E7BA6A102FE18D271B8EC6`, Preview selftest
`DFE82E76A329DCB2236F3985414532B211287914D87C48C3FD65F66FC7EFA1D5`, Paint production
`711388F4B66F53DCE31F6E33CFF83B125C967B81822003CAF074447258D964FB`, and Paint selftest
`7E8CB62F6112F0653AED0F9A0EB650C5301A06ABE706DFC616E8E7ECD1EB6E48`. Coordinator validation passes Preview `94/94`,
Paint `138/138`, Scene `127/127`, Layout `565/565`, repository typecheck, exact four-file ESLint, and diff hygiene.
Independent hostile testing passes `14/14`: only the exact issued raw Scene and exact issued Preview Scene-result
wrapper produce partial Paint. Structural/custom-prototype copies, mutated/cross-result/mismatched-status wrappers,
copied verification fields, caller-computable clones, accessors, and Proxies refuse deterministically with zero getter
or Proxy observation and zero throws. This closes the exact-origin defect; it does not prove sampled layout acceptance.

Fresh zero-write native Luna audit `01a00d23-038e-7592-8df0-df19402cf280` preserved all 42 worktree entries byte-for-byte
and returned `FINDINGS` on the complete configured-corpus path. The configured unpacked authority resolves to
`F:\Downskies\x4unpackersuiteV1\X4 unpacked 9.00`; workspace and installed MENU/HUB/COMM sources are byte-identical at
hashes `4253D9BD9DE4113D4DE0B881DBF5A1E90CAA7B30F735BA925403EBEF7EC47DD7`,
`657476EAD08229977E1F2A69079FFDCAB56D908B72AF5C87BD4F4734DCCB8C4F`, and
`88FAB05A79EF33CB28E098081EA6A5E29E8F3B7C4150C39BF38913C51C063511`. Consumer-aware sampling materially changes
the programs and preserves valid sampled/unsampled authority pairs:

- MENU: `16` samples (`11 applied / 5 not applied`), `66 operations / 27 applied`, `88` cells, `95` gaps;
- HUB: `11` samples (`9/2`), `18/11`, `4` cells, `16` gaps;
- COMM: `5` samples (`5/0`), `14/12`, `3` cells, `11` gaps.

All three exact editor sessions then refuse at Scene with public code `malformed-structure` and message
`layout program is malformed, incomplete in required structure, or internally mismatched`. Paint is not reached,
`canRender=false`, Preview records one `scene` gap, and every verification label remains `Not verified in game` /
`gameVerified=false`. Geometry and Paint diagnostics are not zero; they are unavailable because Scene refused first.
The first failing invariant is not yet known: `validateProgramStructure` reaches its refusal path, but
`refuseStructure(_stage)` discards the stage before `validateInputs` emits the generic public result. The prior positive
sampled Paint receipt used a weaker harness and is superseded by this complete public editor-session audit.

The reconciled correction is sequential and tests-first. Initially only `src/lib/x4UiScene.ts` and
`src/lib/x4UiScene.selftest.ts` are writable. With production frozen, add portable minimal fixtures that preserve the
materialized row/cell/kernel ownership relations from all three real sampled programs and capture causal red receipts.
Expose the exact first failing structural stage to tests without weakening or broadening the public acceptance surface,
then repair only the invariant named by that evidence. No source/index/target-name special case is allowed. Every prior
hostile owner/source/ledger mutation must still refuse. If the stage proves the Layout producer is wrong, stop and
revise the documented scope before any Layout write.

Focused acceptance requires Scene prior plus new sampled checks, Layout `565/565`, Preview `94/94`, Paint `138/138`,
repository typecheck, exact owned-file zero-warning ESLint, diff hygiene, the complete exact MENU/HUB/COMM census through
non-refused Paint with `canRender=true`, the 14-case zero-observation origin matrix, and a fresh independent zero-write
combined `CLEAN`. Source-canonical insertion/deletion, keep-out calibration UI, unsupported widget paint, broad Forge
gates, deploy identity, and game screenshot comparisons remain locked. A non-refused standalone Paint plan remains
layout-preview evidence only; game deployment remains the authority.

AAR triggers: the earlier sampled positive was not reproduced through the same complete public session path; the audit
harness also incurred one approval wait and several malformed inline-TSX attempts before producing the accepted
read-only receipt. Sustain exact public-path censuses and byte-preservation checks. Highest-risk weakness remains a
convincing standalone preview whose sampled or authority path differs from deployment; retain permanent
`Not verified in game` state and require exact deploy plus in-game comparison for final verification.

#### Owning-frame correction accepted causally; candidate rejected at cell outer height — 2026-08-16

Status: `FINDINGS / PARTIAL`; the first shared Scene invariant is causally corrected, but the complete exact public
session still refuses one stage later. Overall B119 remains `IN_PROGRESS / PARTIAL — Not verified in game`.

Native Luna `01a00d4f-1b2b-7280-8a70-7ea4b302f569` kept Scene production frozen at
`A78B6468B400C87DC9F6D36DD800032682885D2887E62AEDCEECF40445684EA5` while three portable consumer-aware
MENU/HUB/COMM source shapes reproduced public `malformed-structure`. The new internal test-only diagnostic named the
same first stage for all three: `table-kernel-frame-width`. Reconciliation against the accepted Layout owner proves the
existing producer contract already requires `kernelState.frameWidth` to equal the owning frame width. Scene alone was
comparing that kernel value to the global profile frame width. The bounded repair now resolves the owning frame through
the table's exact owner relation and uses the profile width only when the owner has no resolved width.

The candidate hashes are Scene production
`6AAA2CD37676831A70737F204EE40A3749CC91224D6FF457A422D0D88D082A26` and selftest
`DE2A85CEF1032588D7ECA72C061DD3512845D3C3A6A75C1719C1E57A59C526DE`. Worker and coordinator gates pass Scene
`128/128`, Layout `565/565`, Preview `94/94`, Paint `138/138`, repository typecheck, exact Scene-pair zero-warning
ESLint, and diff hygiene. One-field kernel-width, reciprocal owner, operation-ledger, and source-owner mutations still
refuse. The 14-case exact Preview/Paint origin matrix remains green with zero Proxy/getter observation and no throws.

Fresh zero-write native Luna audit `01a00d6d-179c-71b2-b740-b894206c4ecd` rejects this as a complete Scene candidate.
It minted the exact sample catalog, binding, and private catalog authority through `projectX4UiEditorSession`, supplied
consumer-aware values, reproduced every expected configured count, and preserved all candidate/protected/source/corpus
hashes plus the 42-entry status. Exact outcomes are:

- MENU: `16` samples (`11/5`), Layout `partial` with `1 frame / 4 tables / 9 rows / 88 cells`, `66 operations / 27
  applied / 95 gaps`; Scene refuses at `cell-outer-height`, Preview refuses with one Scene gap, Paint is not reached,
  `canRender=false`.
- HUB: `11` (`9/2`), `1/2/2/4`, `18/11/16`; the same `cell-outer-height` refusal and downstream result.
- COMM: `5` (`5/0`), `1/1/1/3`, `14/12/11`; the same `cell-outer-height` refusal and downstream result.

All remain exactly `Not verified in game` / `gameVerified=false`; Scene geometry and Paint diagnostics are unavailable,
not zero. The audit also finds the new `B119 configured ...` selftest output materially misleading: it combines fixed
configured-source receipt constants with portable-fixture Scene geometry, so a reader can mistake fixture acceptance for
the exact session result. That label/evidence mixture must be removed before acceptance. The audit's initial quoted-path
containment parser omitted `Note for Kimi.md` from its baseline hash, but status counts stayed exact and no audit write
occurred; this is harness friction, not product evidence.

The next bounded correction remains in `src/lib/x4UiScene.ts` and `src/lib/x4UiScene.selftest.ts`. Preserve the valid
owning-frame rule. First capture, from each exact real program, the failing cell ID/kind, cell/kernel type, scaling,
height, affect-row-height, row/column, `cell.height`, and complete `descriptorFacts.outerHeight`, plus the exact Helper
`cell:getHeight`, icon, button, or edit-box branch that governs it. Add portable positives reproducing that exact branch
and one-field hostile mutations for descriptor value/provenance/source pin, kernel height/scaling/type, and owner slot.
Repair only the invariant named by that evidence; do not make unknown/unavailable facts known, skip valid consistency
checks, special-case source names/hashes, or touch Layout without a documented scope revision. Separately label portable
fixture output as fixture evidence and real public-session output as real-session evidence.

Acceptance remains Scene prior plus new checks, Layout `565/565`, Preview `94/94`, Paint `138/138`, typecheck, exact
lint, diff hygiene, the complete exact public MENU/HUB/COMM session through non-refused Paint with `canRender=true`, the
14-case origin matrix, protected-hash/42-entry containment, and a fresh zero-write combined `CLEAN`. Source insertion,
keep-out calibration UI, widget paint, broad Forge gates, deploy identity, and game comparison remain locked.

AAR triggers: the portable test passed while the exact session failed one stage later, and its console label mixed two
proof levels. Sustain staged internal diagnostics and exact public-session reruns after every repaired invariant. Improve
the audit harness by using a quote-safe status manifest so filenames with spaces cannot be omitted. Highest-risk
weakness remains fixture output presented next to real-source receipt data; proof surfaces must state which object was
actually executed.

#### Exact sampled Scene/session path accepted; structural-edit provenance specified — 2026-08-17

Status: sampled source-first projection `FOCUSED VERIFIED / CLEAN`; overall B119 remains
`IN_PROGRESS / PARTIAL — Not verified in game`. Broad Forge, installed-host, package/deploy, C++ frame-acceptance, and
in-game experience gates have not run and are not implied by this checkpoint.

The final Scene/session correction is accepted at production/selftest hashes
`DA6AFE26435BA19758FBF8CB2BFCF0EAD7C61B7CEB4B4783E28810E4142215D7` /
`B6B16C7732E39853A693E9C7A5F0EE406C969FAFF29A0A0AAE5EF8A21F8111FD`. It preserves the owning-frame relation,
ports the exact Helper outer-height branches represented by available source facts, leaves unavailable `cell.height`
unasserted, and physically contains configured workspace reads after resolving child reparse points. The editor-session
test correction separately proves that a stateless resize with no supplied samples/catalog/binding authority issues a
fresh `1280x720 @ 1.1` Scene/Paint; it does not inherit stale profile authority. Profile drift still clears genuinely
supplied stale samples.

Fresh zero-write native Luna auditor `01a00ea1-1ceb-7ad0-9b37-0360caa26e31` returned `CLEAN`. `HEAD` and
`origin/main` remained `77138741a9f470e2c6c37c2d6857688dd1e2b13e`; all ten supplied production/selftest hashes
remained exact; worktree status stayed exactly 43 entries before and after. Required evidence passed: EditorSession;
Scene default and strict `136/136` each with configured MENU/HUB/COMM `3/3`; Layout `565/565`; Preview `94/94`;
Paint `138/138`; repository typecheck; exact corrected-selftest ESLint with zero warnings; exact diff hygiene; hostile
frame/cell owner, issued-origin, copy, prototype, accessor, Proxy, and mismatch matrices with zero throws or observation.
The no-config ordinary path remains truthfully `NOT RUN`; strict mode fails only `configured-census-unavailable`.

Exact configured receipts at `1920x1080`, UI scale 1 are:

- MENU: Layout `16 samples (11 applied / 5 not applied)`, `66/27 operations`, `1/4/9/88`, `95` gaps; Scene
  `1/4/2/16/3/5/7`, `137` diagnostics; Paint `203/165`.
- HUB: Layout `11 (9/2)`, `18/11`, `1/2/2/4`, `16`; Scene `1/2/2/4/0/0/0`, `29`; Paint `44/35`.
- COMM: Layout `5 (5/0)`, `14/12`, `1/1/1/3`, `11`; Scene `1/1/1/3/0/0/0`, `22`; Paint `34/28`.

Every exact session reaches non-refused Paint, zero Preview gaps, and `canRender=true`, while retaining permanent
`Not verified in game` / `gameVerified=false`. These receipts unlock source-canonical editing work only; they do not
unlock broad/runtime/game claims.

Recovery/AAR evidence is non-clean. During the preceding tests-only correction, `apply_patch` unexpectedly zero-filled
`src/lib/x4UiScene.selftest.ts` to 456,225 NUL bytes. Production was frozen immediately. No exact sibling, temp, IDE,
or Git blob existed; the worker restored the exact pre-failure hash by replaying all 78 recorded patches from `HEAD`
before applying the final bounded test changes. No approximate reconstruction was accepted. Reconciliation also
corrected two false assumptions: the old resized-session null-Paint assertion was a surrogate that passed only while
Scene rejected downstream, and requiring status to remain 42 was impossible after intentionally modifying the formerly
clean EditorSession selftest. The truthful accepted baseline is 43. Sustain exact hashes, causal public-path receipts,
and immediate write-freeze/recovery on patch anomalies.

## BATCH 8A ACCEPTANCE CONTRACT — ENCLOSING LUA STATEMENT PROVENANCE

Status: `FINDINGS / CORRECTION ACTIVE`. This is the first bounded prerequisite for direct-call insertion/deletion. It adds
provenance only; it does not mutate source, emit Lua, mount controls, generate a scaffold, package, deploy, or claim
game acceptance.

### Reconciliation and bounded ownership

- Existing owners are reused: `X4UiCallRecord` in `src/lib/x4UiCallModel.ts`, owner-issued layout evidence,
  `spliceX4UiWorkspaceSource()`, `x4UiSourceEdits.ts`, and `X4UiSourceEditor`. No second parser, AST, source bundle,
  workspace model, emitter, formatter, or descriptor DSL is allowed.
- Current `X4UiCallRecord.source` proves only the call expression. `processStatement()` sees the enclosing luaparse
  statement but discards that association before `evaluateCall()` emits a record. Therefore deletion cannot yet prove a
  complete syntactic statement, and insertion cannot prove a stable before-statement anchor. Inferring line ranges from
  whitespace or call text is forbidden.
- Fail-first reconciliation found one necessary existing traversal defect: luaparse exposes numeric-for `start`, `end`,
  and optional `step` as scalar child nodes, while the current implementation calls `nodeArray()` and therefore skips
  every call expression in those bounds. Batch 8A may correct only that traversal so such relevant calls receive the
  required non-standalone numeric-for provenance. This is not permission for new folding or layout semantics; existing
  real-menu counts and every coupled authority must remain unchanged.
- Batch 8A may modify only `src/lib/x4UiCallModel.ts` and `src/lib/x4UiCallModel.selftest.ts`. All other production,
  test, documentation, corpus, mod, game, package, and configuration paths are frozen.

### Required behavior

- Every relevant call record must carry exact, immutable enclosing-statement provenance from the luaparse node already
  being processed: source file/path, UTF-16 start/end offsets, line/column range, normalized statement kind, and whether
  this call node is the root expression of a standalone `CallStatement`.
- Nested receiver/chained calls in the same statement share the exact statement range, but only the outer root call may
  be marked standalone. Calls used as local/assignment initializers, return values, conditions, loop bounds, arguments,
  or nested expressions must never be marked standalone.
- Provenance must remain source-derived and context-local across branches, loops, handlers, and local helper expansion.
  It may not be reconstructed from rendered text, indentation guesses, model order, or caller-supplied objects.
- Existing call expression ranges, ordering, semantics, source literals, branch/loop paths, authority issuance, and all
  public truth labels must remain unchanged.

### Tests-first acceptance and negative path

The Luna owner must first add failing tests against unchanged production for direct call statements, fluent chains,
local and assignment initializers, return/condition/loop/argument nesting, semicolon spelling, CRLF and LF sources,
UTF-16 offsets, branches, loops, and handlers. Tests must prove exact source slices and containment, identical statement
ranges for calls sharing one statement, root-only standalone classification, immutable emitted provenance, and no
cross-statement leakage. Malformed/unlocatable nodes must fail closed without inventing an insertion/deletion range.

The accepted fail-first shape must distinguish implementation evidence from harness defects: unchanged production must
fail only the new provenance assertions; a quoting failure in an exploratory AST probe and any mistaken test access
path are tooling/test defects, not product diagnoses. Any such correction keeps the AAR non-clean and must not weaken
the final matrix.

Required validation is the complete call-model selftest; the directly coupled layout-program, linter, source-edit,
workspace-source, EditorSession, Scene, Preview, and Paint focused selftests; repository typecheck; zero-warning ESLint
on exactly the owned pair; `git diff --check` on exactly the owned pair; forbidden-path/hash and exact 43-entry status
baseline containment. Because both owned files are currently clean, an intentional two-file candidate must have exactly
45 status entries, with those two owned paths as the only additions to the preserved 43-entry baseline. A fresh
independent zero-write Luna audit must return `CLEAN` before Batch 8A is accepted.

Rollback is deletion of the new provenance field/type and its tests. After acceptance, Batch 8B may extend the existing
`x4UiSourceEdits` owner with typed structural edit discovery/application using those exact statement/anchor facts and
`spliceX4UiWorkspaceSource()` CAS. Batch 8C may then mount insertion/deletion controls in the existing source editor;
minimal tested scaffold creation remains a separate bounded subunit. Whole-file pretty-printing and descriptor-to-Lua
translation remain forbidden throughout.

#### Batch 8A round-one audit rejection and terminator correction — 2026-08-17

Fresh zero-write native Luna auditor `01a00ec4-e1c1-7893-bc4e-28765d8013a1` returned `FINDINGS`. The candidate is
valid for before-statement anchors and all non-deletion provenance: the complete hostile matrix passed; call model
`51/51`, Layout `565/565`, Lint `112/112`, SourceEdits `34/34`, Scene default/strict `136/136` with configured
MENU/HUB/COMM `3/3`, Preview `94/94`, Paint `138/138`, typecheck, lint, and diff hygiene all passed; status remained
45 and all 16 protected hashes stayed exact. It is nevertheless rejected for Batch 8A acceptance because luaparse's
statement node range ends immediately before a trailing semicolon. The candidate records that exact AST span but no
terminator/deletion-span evidence, so it cannot truthfully claim a complete semicolon-terminated deletion range.

The correction remains confined to the same two call-model files and preserves the valid round-one implementation.
Extend `X4UiCallStatementProvenance` with an exact safe CAS deletion range and explicit terminator classification while
retaining the raw AST `source` range separately. Terminator recognition is a bounded lexical suffix check anchored at
the AST end: it may consume only horizontal spaces/tabs followed by the first semicolon on the same line. It must never
cross CR/LF, absorb a comment, consume a second semicolon, or reach into the next statement. This is not a second parser,
general line scanner, formatter, or permission to infer the statement body.

Required fail-first controls are immediate `call();`, horizontally spaced `call() ;`, no-semicolon calls, two
same-line statements, doubled semicolons, semicolon plus trailing comment, comment before semicolon, CRLF/LF, astral
text, fluent inner/outer calls sharing one deletion range, and non-standalone contexts. For every standalone positive,
deleting exactly the issued deletion range from an in-memory source must reparse, remove only that root statement, and
preserve the following statement and all bytes outside the range. No-semicolon/comment-before-semicolon cases must
preserve unowned trivia rather than overclaim it. Provenance and all nested locations remain deeply frozen.

Round-two acceptance repeats every round-one gate and hostile probe, exact status 45 containment, configured receipts,
and a fresh zero-write `CLEAN`. Batch 8B remains locked until then. AAR triggers include the rejected semicolon
overclaim plus the auditor's graphify canonicalization failure, inline-command quoting failures, Windows command-length
failure, invalid top-level/early-return Lua fixtures, incorrect call/UTF-16 counts, and strict-mode throw assumption;
none was treated as product evidence.

#### Batch 8A round-two acceptance — 2026-08-17

Status: `FOCUSED VERIFIED / CLEAN`; overall B119 remains
`IN_PROGRESS / PARTIAL — Not verified in game`. Batch 8A is accepted and unlocks only the bounded structural source-edit
owner below. It does not prove Forge rendering, package/deploy identity, C++ frame acceptance, or in-game experience.

The accepted call-model hashes are production
`E0842D11D156764917DC36740294D43FA7CBCC75089C4B4187E17190DBF4CD4C` and selftest
`7CDB2CA96D5E545E1DAB4CDF44FF874CA507066373C8DBE818E43EBB3977D432`. The tests-first correction moved unchanged
round-one production from `52/57` to `57/57`: all prior 51 checks stayed green while the five new deletion-provenance
families failed first. The final implementation retains the raw luaparse statement range, adds a separately frozen
`deletionSource` and `none | semicolon` terminator fact, and extends ownership only through horizontal spaces/tabs and
the first same-line semicolon. Numeric-for scalar traversal, statement-stack restoration, root-only standalone-call
classification, malformed/NUL fail-closed behavior, and existing call semantics remain intact.

Coordinator review and rerun passed call model `57/57`, SourceEdits `34/34`, repository typecheck, exact owned-file
ESLint, exact diff hygiene, hash/NUL/newline checks, and exact 45-entry containment. Fresh zero-write native Luna auditor
`01a00eed-8a23-7080-93cd-4217a691df66` then returned `CLEAN` with no repository writes. Its independent matrix passed
all ten deletion-boundary forms, fluent inner/outer root identity, local/assignment/return/condition/loop/argument/
handler non-root contexts, exact deletion-and-reparse byte locality, malformed/NUL refusal, and immutable UTF-16
locations. Coupled receipts passed Layout `565/565`, current lint `112/112`, Scene default and strict `136/136` with
configured MENU/HUB/COMM `3/3`, Preview `94/94`, Paint `138/138`, WorkspaceSource, SourceBundle, EditorSession,
typecheck, exact ESLint, and diff hygiene. The configured operation receipts stayed MENU `66/27`, HUB `18/11`, and
COMM `14/12`; all remained `canRender=true`, `gameVerified=false`, and `Not verified in game`.

This close is non-clean. The round-one implementation overclaimed complete deletion while luaparse excluded a trailing
semicolon; independent review caught it. The round-two auditor also corrected one read-only fluent-call lookup mistake,
and the work order named stale `luaStaticAnalysis.selftest.ts` before resolving the current owner to
`x4UiLint.selftest.ts`. Sustain independent hostile review and separate raw-AST versus safe-deletion ranges. Improve
audit commands by resolving current selftest owners before execution. Highest-risk evidenced weakness remains source
mutation that can look byte-local while deleting unowned trivia; Batch 8B must consume only the accepted owner-issued
range and re-establish complete source/layout provenance after every splice.

## BATCH 8B ACCEPTANCE CONTRACT — SOURCE-CANONICAL STRUCTURAL CAS

Status: `SPECIFIED / READY FOR TESTS-FIRST IMPLEMENTATION`. This unit adds typed direct-call insertion/deletion to the
existing source-edit owner. It does not mount UI controls, generate a scaffold, pretty-print a file, write the configured
mod/corpus/game, package, deploy, or claim game verification.

### Reconciliation and bounded ownership

- Graphify and source review confirm one existing mutation path: `discoverX4UiSourceEdits()` owns issued layout/source
  authority; `applyX4UiSourceEdit()` owns CAS, byte locality, complete reparse, and provenance re-establishment;
  `spliceX4UiWorkspaceSource()` delegates to `spliceX4UiSourceBundle()` and already accepts zero-length insertion and
  ranged deletion. `X4UiSourceEditor` consumes this owner. There is no capability-map delta and no second emitter,
  formatter, parser, workspace adapter, or descriptor language is allowed.
- Modify only `src/lib/x4UiSourceEdits.ts` and `src/lib/x4UiSourceEdits.selftest.ts`. All other production, test,
  documentation, corpus, mod, game, package, configuration, Git, and external-record paths are frozen during the code
  unit. The accepted pre-write hashes are production
  `C90FFC54AE7E4A7DF655222D61872CF7935195CA70E23EC1EB7B4C584E7BD2D9` and selftest
  `50FA05F041007DC96B130845082DF74933BCC21D7581C4C1C24CA0707A986F65`. The truthful status baseline is 45; a
  two-file candidate must be exactly 47 entries and preserve the other 45 byte-for-byte.

### Required structural contract

- Structural discovery must consume the exact issued workspace/source and projected program/evidence pair plus the
  accepted call-model `enclosingStatement` facts. Caller-authored clones, crossed pairs, stale catalogs, Proxies,
  accessors, custom prototypes, malformed collections, and foreign source/target facts fail closed without observation
  or mutation.
- A delete entry is issued only for a unique complete root standalone call statement whose complete relevant-call set is
  exactly bound to applied operations inside the selected layout target. Calls that are nested, non-root, dynamic,
  outside the target, unbound to the issued program, or share a statement with any unproven relevant call are locked.
  Fluent calls sharing one statement produce one deletion action over the accepted `deletionSource`; no duplicate or
  partial-chain delete is allowed.
- An insertion anchor is issued only at the accepted source start of the selected table's first proven standalone row
  statement, or before the selected frame's proven standalone display statement when no earlier table-row anchor is
  available. The anchor is a zero-length CAS range with `expectedText === ''`. Its local indentation and LF/CRLF style
  are derived from bounded adjacent source bytes; no whole-file formatting or line-range inference is allowed.
- Insertion accepts direct Lua call source, not a descriptor or intermediate DSL. The inserted payload must be exactly
  one parseable standalone relevant X4 UI call statement after local indentation/newline framing; assignment, return,
  control flow, multiple statements, comments-as-payload, unrelated calls, or text that changes the selected source
  outside the issued zero-length range must refuse. The post-splice call model must prove the one intended new root
  statement and preserve every prior call/operation fact modulo the exact offset/order shift.
- Deletion must remove exactly the issued `deletionSource`, reparse, remove exactly that statement's bound relevant-call
  set, preserve all outside bytes, and preserve every unaffected call/operation fact modulo the exact offset/order shift.
  Both mutation kinds must return the original workspace/source objects on refusal, rebuild through the existing
  workspace-source owner on success, re-establish a newly issued catalog/program/evidence path, and retain permanent
  `Not verified in game` truth.

### Tests-first, negative path, and acceptance

The Luna owner must first add causal failing tests against unchanged production. Required positives cover deletion of
plain and semicolon-terminated direct statements, one fluent-chain statement, insertion before first row and fallback
display anchors, empty-range CAS, local indentation, LF/CRLF, and astral-prefix UTF-16 offsets. Exact in-memory before/
after assertions must prove reparse, one intended call-ledger delta, outside-byte identity, unchanged unrelated files,
and newly issued source/layout authority.

Required refusals cover nested/local/assignment/return/condition/loop/argument calls, partial fluent deletion,
statements with foreign or unbound relevant calls, missing/ambiguous anchors, stale expected ranges/text, malformed or
multi-statement insertion, comments/unrelated calls, parse failure, dynamic/foreign targets, crossed/clone/proxy/
accessor/prototype inputs, repeated use of stale entries, and any attempt to absorb a second semicolon, comment,
newline, or next statement. Existing scalar discovery/application must remain exactly compatible and all prior
`34/34` checks must stay green.

Focused acceptance requires the expanded SourceEdits suite; CallModel `57/57`; Layout `565/565`; current lint
`112/112`; WorkspaceSource, SourceBundle, EditorSession, Scene default/strict `136/136` with configured
MENU/HUB/COMM `3/3`; Preview `94/94`; Paint `138/138`; repository typecheck; exact owned-file zero-warning ESLint;
exact diff hygiene; protected-hash and 47-entry containment; and a fresh independent zero-write Luna `CLEAN`.
Broad precommit/oracle/E2E/build/rendered-Forge, package/deploy, configured-mod writes, and X4 gates remain locked.
Rollback is exact restoration of the two accepted pre-write hashes; no other path is part of this unit.

### Round-one candidate rejection and correction contract — 2026-08-17

Status: `FINDINGS / REJECTED / CORRECTION REQUIRED`. The two-file candidate at production
`4A2A3DE1E0DA89AF39799BBBC5DF248126B58013CC3750853F1E88FE8DA3EF6F` and selftest
`05C14B3B61E9FF673F1E80D2DBE39D097EA60B99099AA635D55FE7C3AC4BD37B` is not accepted. It retained exact 47-entry
containment, was NUL-free and LF-terminated, passed diff hygiene and every declared focused/coupled test, but fresh
zero-write native Luna auditor `01a00f3e-f4e6-76f0-a8fb-5dbbfe602da9` reproduced six contract failures without changing
any file:

- receiver spelling was used as insertion ownership: two different applied table identities both named `table`
  incorrectly issued one anchor, while one table reached through `table` and `alias` incorrectly issued none;
- a `tableA` first-row anchor accepted an applied `tableB:setColWidthPercent(1, 50)` payload, and the same foreign-table
  escape reproduced against a different frame's fallback anchor;
- `frame:display(print("x"))` and `frame:display(foo())` each hid an unrelated executable call in `localInvocations`;
  both insertion and whole-statement deletion accepted them because only relevant `model.calls` were counted;
- structural success shallow-froze only the result wrapper; the newly issued workspace, passthrough array, and changed
  source record remained caller-mutable;
- adding the first row at a fallback-display anchor was refused because the correct reissued authority transitioned to
  `first-row`; and
- inserting before a valid fluent `addRow(...)[1]:createText(...)` statement falsely refused because source-derived
  row/cell paths, owner IDs, and related invocation identities were compared without a causal offset/owner remap.

The correction stays in the same two files and must begin with causal red tests against the rejected production hash.
It must use exact issued `tableId` / `frameId` ownership rather than receiver text, bind the inserted applied operation
to the anchor owner (including table-to-frame ancestry), reject every unproven nested executable invocation for both
discovery and payloads, immutably seal successful authority state, permit only the proven fallback-to-first-row
transition, and map source-derived row/cell/invocation identities through the exact splice without blanket owner/kernel
suppression. Required tests include table and frame alias/reassignment pairs, foreign-owner calls at both anchor kinds,
hidden `print` / `foo` insertion and deletion, post-success mutation attempts, fallback transition, and the configured
mod's fluent row/widget shape. All previous 62 SourceEdits checks and every coupled gate remain mandatory; exact
47-entry containment and a new zero-write `CLEAN` are still required before Batch 8C. No capability-map delta.

This review is non-clean. The round-one green suite proved syntax, CAS, and basic ledger counts but not semantic owner
identity, complete executable-call coverage, immutable returned authority, or realistic fluent-call remapping. The
highest-risk evidenced weakness is an apparently byte-local edit being accepted for the wrong X4 table/frame. Sustain
the independent hostile audit; improve the test oracle from receiver spelling/count equality to issued owner identity
and causal state correspondence. Broad, UI, deploy, and game gates remain locked, and all truth stays
`Not verified in game`.

### Round-two candidate rejection and expanded correction contract — 2026-08-17

Status: `FINDINGS / REJECTED / TESTS-FIRST CORRECTION REQUIRED`. The SourceEdits candidate at production
`E074705A76469F64E5833329B5A6DB7D8479C78F3B6D3839303AFEABB8C3347A` and selftest
`090A572AAAD5DDDC6629FCD207C8D0FE0B13CE61A77C903BAB739D427ECAD430` is not accepted. Owner and coordinator runs
passed prior SourceEdits `62/62` plus causal `16/16`, CallModel `57/57`, Layout `565/565`, lint `112/112`, Scene
default/strict `136/136` with configured `3/3`, Preview `94/94`, Paint `138/138`, WorkspaceSource, SourceBundle,
EditorSession, typecheck, exact pair ESLint, pair/repository diff hygiene, hash/NUL/final-LF checks, and exact 47-entry
containment. Those results are candidate evidence only.

Fresh zero-write native Luna auditor `01a00fbb-2c42-7f61-beb9-cbaf727bd260` preserved every file and returned
`FINDINGS`. It independently reproduced:

- P2 false acceptance: `frame:display(function() foo() end)` hides executable body calls not represented by the
  current `localInvocations` ledger;
- P2 false refusal: generic string remapping treats ordinary literal text such as `@row:999999` as a source-derived
  identity;
- P2 authority mutation: deep-freezing a success result freezes shared caller-owned workspace/source records; and
- P2 metadata drift: workspace-source splicing changes `content` but preserves the old `bytes` count.

It also proved the oracle is not acceptance-grade: F3 insertion rows can refuse on owner mismatch without testing the
hidden-call gate; F4 samples selected surfaces rather than recursively proving the returned graph and original inputs;
F5 does not prove the exact transitioned owner/target/entry sequence; F6 does not prove every row/cell/parent/related/
invocation/call-location identity or kernel/state transition. First-row post-reparse owner matching also checks only
`tableId`, not the complete issued `tableId + frameId` tuple. No P0/P1 finding was reported, but every P2/P3 item blocks
Batch 8B acceptance.

Reconciliation expands ownership only where the defect actually lives. SourceEdits remains the structural CAS owner;
WorkspaceSource remains the splice/byte-metadata owner. No parser, formatter, emitter, splicer, workspace adapter, or
authority parallel is allowed. The correction write set is exactly:

- `src/lib/x4UiSourceEdits.ts`;
- `src/lib/x4UiSourceEdits.selftest.ts`;
- `src/lib/x4UiWorkspaceSource.ts`; and
- `src/lib/x4UiWorkspaceSource.selftest.ts`.

The frozen WorkspaceSource production/selftest baseline is
`8D4B00CE3D2905EC84F3ED4EFEA4E81B877AF31BE121CF8C768B30811DC9B109` /
`F3EA35258BB763718DB0AB5E21B303249F814685340B783A1CC0B0A3C937123A`. Current worktree inventory is exactly 47;
if both currently clean WorkspaceSource files are intentionally modified, the truthful final inventory is exactly 49.
All other files and accepted hashes remain frozen.

Tests must fail first against the rejected round-two hashes and isolate each contract. WorkspaceSource must recompute
or remove stale byte metadata at the single existing splice owner and prove ASCII plus astral/UTF-8 byte counts.
SourceEdits must reject hidden executable function/table bodies using existing call-model evidence or a conservative
source-shape refusal, never a second parser; remap only schema-proven identity fields while comparing user literals
verbatim; clone the successful authority graph before deep freeze so caller-owned input remains unchanged; compare the
complete issued owner tuple; and deeply assert exact transition/catalog identity, source/layout authority, semantic
call/operation ledgers, kernel envelopes/state continuity, outside-byte identity, and refusal reason isolation.

Acceptance repeats every prior/coupled focused gate, exact four-file ESLint/diff/NUL/LF/hash containment, exact final
status, coordinator hostile-probe review, and a fresh independent zero-write Luna `CLEAN`. Broad precommit/oracle/E2E/
build/rendered-Forge, package/deploy, configured mod/corpus/game writes, and X4 validation remain locked. Truth remains
`Not verified in game`. This review is non-clean: green tests again failed to prove the authority contract; sustain
fresh hostile audits and require every negative test to identify its causal refusal path.

### Round-three candidate rejection and SourceEdits-only correction — 2026-08-17

Status: `FINDINGS / REJECTED / TESTS-FIRST CORRECTION REQUIRED`. Overall B119 remains
`IN_PROGRESS / PARTIAL — Not verified in game`.

The integrated round-three candidate hashes are SourceEdits production
`F83C11B3E997F205C409CE889355A7785A3CBACB4CAEEDB0D77C363A0FDD6918`, SourceEdits selftest
`83C63057A2487C4ECE4941A9419F6CBD1E951790B66C62B6CB837F46B0862DBC`, WorkspaceSource production
`B56B7A1ADD1AFD52EAFDBC077AF747DD93148CA9A62DAEDFC89CAD096D0F813E`, and WorkspaceSource selftest
`358F0C7837C42B13097EB0D053C0100F8AFEBF1595C19FC855619E5E2D311CFE`. The exact worktree inventory is 49.

Coordinator reproduction passed SourceEdits prior `62/62`, causal `18/18`, aggregate `12/12`; WorkspaceSource causal
`5/5`; SourceBundle and EditorSession; CallModel `57/57`; Layout `565/565`; current lint `112/112`; Scene `136/136`
plus configured MENU/HUB/COMM `3/3`; Preview `94/94`; Paint `138/138`; typecheck; exact four-file zero-warning ESLint;
and exact diff/hash/NUL/LF/status containment. Fresh zero-write native Luna auditor
`01a0100d-17ef-7ab2-94b3-ce34ef9645c5` repeated all 13 command families, preserved every hash and status entry, and
still returned `FINDINGS` from independent process-memory probes:

- direct payloads containing inert nested strings such as `frame:display({ value = "foo()" })` are falsely refused by
  raw call-shaped expression matching, although actual function/IIFE/load/table-body executions fail closed;
- `structuralInvariant()` treats any nested object with string `kind`, string `origin`, and a `path` shaped like
  `@name:digits` as parser provenance, so an arbitrary user record can enter source-derived normalization;
- WorkspaceSource correctly clones all own keys, but SourceEdits `freezeDeep()` walks only enumerable values, leaving
  accepted non-enumerable and symbol-owned nested records mutable; and
- the F6 selftest's retained-operation comparator strips kernel `stateBefore` / `stateAfter`, omits operation metadata,
  and omits singular source-derived ID fields. Its isolated state-continuity corruption does not prove the complete
  retained semantic ledger.

The independent byte/ownership probe accepted ASCII and astral/non-ASCII edits, refreshed `bytes` only when that
metadata existed, preserved absent metadata, rebuilt source/bundle authority, detached every mutable caller-owned graph,
and left original inputs exact and mutable. Owner aliases/reassignments, complete table/frame ancestry, foreign payloads,
and fallback-to-first-row transition also passed. Therefore freeze WorkspaceSource production/selftest at the hashes
above and return correction ownership to the two SourceEdits files only. No capability-map delta.

The SourceEdits owner must work tests-first against the rejected production hash and record causal reds for all four
findings before production changes. The executable-shape correction must consume existing call-model facts and a
bounded string/comment-aware shape check only where the call model lacks body evidence; it must not add a second Lua
parser or make actual executable bodies acceptable. Short quoted strings, escapes, Lua long-bracket strings, and
comments containing call-shaped text require positive byte-verbatim controls. Identity remapping must use explicit
schema-owned fields; object-shape heuristics such as `{kind, origin, path}` are forbidden. Deep freeze must traverse
every own key, including non-enumerable and symbol keys, without observing hostile public inputs before exact issued
authority is established.

F6 must compare retained call and operation facts including singular and plural row/cell/parent/related/local-invocation/
call-location IDs, operation metadata, kernel envelope, and exact `stateBefore` / `stateAfter` after causal line/column/
offset remapping. Negative controls must mutate each family independently and prove rejection or comparator failure;
they may not pass through an unrelated owner/refusal gate. Preserve all previous 62 + 18 + 12 rows, every coupled gate,
the frozen WorkspaceSource pair, exact status 49, permanent `Not verified in game`, and refusal identity. A new fresh
zero-write Luna `CLEAN` remains mandatory before Batch 8B acceptance or any editor integration.

This close is non-clean. The first correction overfit raw expression text and enumerable-only fixtures, while the F6
test mirrored production omissions. Sustain hostile process-memory probes. Improve the oracle by proving inert syntax
and every hidden own-key/ledger family explicitly. Highest-risk evidenced weakness is a source edit comparator that can
normalize or omit caller-visible semantic data and thereby call a drifted edit safe.

### Round-four through round-seven audit sequence and current rejection — 2026-08-17

Status: `FINDINGS / REJECTED / TESTS-FIRST CORRECTION REQUIRED`. Overall B119 remains
`IN_PROGRESS / PARTIAL — Not verified in game`. Batch 8C editor controls, keep-out calibration UI, widget paint,
broad Forge gates, deploy identity, and game comparison remain locked.

The intervening candidates were not accepted merely because their declared matrices were green. Round four
`9A4F...39E3` / `50AE...9927` collapsed nested source locations and grouped mutations in ways that could hide omitted
branches. Round five `49001A56...A47B` / `920EC45D...BEF1` still blanket-remapped nested lookalike keys, observed
accessors, and accepted coherent downstream state drift. Round six
`9BB7FA6527DDE7A7DD9D4C14CB7533EB38EE256C9FF67EB5E7E59342FD553A8D` /
`4D44B924390642562473C0F4CDE660CC1743BE6E00BF105E90B7DF6125196996` passed its declared suites but fresh auditor
`01a010ec-1266-7e12-8b0d-0cc1de3c878e` reproduced malformed producer-shaped ledgers accepted at the correspondence
seam and a valid retained range ending exactly at the deletion anchor falsely refused.

The round-seven candidate is SourceEdits production
`509D8477E2912A034A7FDF4DFB962CD683807DE73FD4CDCD92D0A547A29B881F` (203080 bytes) and selftest
`06628B888FEF02C0E8F3BA526146498CB3CDB17DC01124ED653BDDDB4EEF7D4C` (290915 bytes). Frozen WorkspaceSource remains
`B56B7A1ADD1AFD52EAFDBC077AF747DD93148CA9A62DAEDFC89CAD096D0F813E` /
`358F0C7837C42B13097EB0D053C0100F8AFEBF1595C19FC855619E5E2D311CFE`. All four are NUL-free, CR-free, LF-terminated,
and the exact worktree inventory remained 49 before and after audit.

Worker and coordinator validation passed SourceEdits prior `62/62`, causal `18/18`, aggregate `12/12`, round four
`31/31`, round five `95/95`, round six `97/97`, and round seven `125/125`; WorkspaceSource `5/5`; SourceBundle and
EditorSession; CallModel `57/57`; Layout `565/565`; lint `112/112`; Scene `136/136` with embedded configured
MENU/HUB/COMM `3/3`; Preview `94/94`; Paint `138/138`; repository typecheck; exact pair ESLint; and diff hygiene.
Those green gates are insufficient.

Fresh zero-write native Luna auditor `01a01160-a980-7b23-a1f6-64dd37839b1c` preserved every byte and returned
`FINDINGS`:

- a valid direct `createText` statement deletion returns `accepted:false` with `reparse-provenance-drift`, although
  the reparsed layout is projected with four calls, four operations, and zero gaps. `call.order` is the index in the
  complete call-model `records` stream, which includes property, handler, and alias records. The candidate's
  `structuralOrderShift()` subtracts only removed relevant-call bindings. In the reproduced case the retained
  `display` operation moves from model order 17 to 14 while the comparator predicts a one-call shift;
- kernel transition shape validation checks only the `stateBefore` / `stateAfter` / `refusal` envelope. It does not
  validate `stateBefore` and `stateAfter` against the actual closed `HelperTableState` producer contract, and the
  round-seven schema matrix has no kernel-state branch.

The next correction owns only `src/lib/x4UiSourceEdits.ts` and
`src/lib/x4UiSourceEdits.selftest.ts`. Production must remain frozen until selftest-only changes reproduce both defects:
the exact valid `createText` deletion red through the public structural-apply path, and a complete malformed-kernel-state
matrix that is valid at every enclosing producer branch but rejected only because each kernel-state field is missing,
invalid, inherited, accessor-bearing, cyclic, or semantically inconsistent. The order repair must derive shifts from the
complete producer record stream or another independently proven equivalent; it may not trust caller-supplied after
orders, infer from relevant-call count, or weaken retained call/operation equality. Kernel validation must port the
current Layout/Helper closed state contract, including provenance, metrics, properties, columns, rows/cells, row groups,
diagnostics, and transition/refusal consistency, without importing a private validator or inventing a parallel schema.

All prior matrices and coupled focused gates remain mandatory, as do exact two-file containment, frozen WorkspaceSource
hashes, status 49, coordinator hostile probes, and a new fresh zero-write Luna `CLEAN`. The audit harness incurred
non-evidence graphify path-canonicalization, Windows quote-stripping, and malformed inline-fixture failures; none changed
files or counts and none is acceptance evidence. No capability-map delta. External records remain unchanged for this
rejected candidate.

This review is non-clean. Sustain independent public-path deletion probes. Improve the permanent oracle so a deletion
before property-bearing calls proves global record-order remapping, and so every emitted kernel transition is checked
against the producer's closed state schema. Highest-risk evidenced weakness is a convincing source edit that reparses
cleanly but is falsely refused because its provenance comparator models a narrower order domain than the parser emits.

### Round-eight retained-record audit and round-nine correction — 2026-08-17

Status: `FINDINGS / REJECTED / TESTS-FIRST CORRECTION ACTIVE`. Overall B119 remains
`IN_PROGRESS / PARTIAL — Not verified in game`; keep-out calibration, widget paint, broad Forge gates, deploy identity,
and game comparison remain locked.

Round eight closed the prior valid-deletion/global-order and closed-kernel-state defects. Its exact SourceEdits hashes
are production `8E37F18D2E4F0D2E79666CFC1F572DE598BD1BE50080CFC2529589C867139E79` (219299 bytes) and selftest
`E0F7A257A158E61D440EC49EC0CF185FEE566B9AD7BA8EA85F995161C1332BAE` (341593 bytes). Frozen WorkspaceSource remains
`B56B7A1ADD1AFD52EAFDBC077AF747DD93148CA9A62DAEDFC89CAD096D0F813E` /
`358F0C7837C42B13097EB0D053C0100F8AFEBF1595C19FC855619E5E2D311CFE`. All four are NUL-free, CR-free, LF-terminated;
the worktree inventory remained exactly 49.

Worker and coordinator validation passed SourceEdits prior `62/62`, round-two `18/18`, round-three `12/12`, round-four
`31/31`, round-five `95/95`, round-six `97/97`, round-seven `125/125`, audit `10/10`, producer-kernel `63/63`, every
coupled focused suite, typecheck, exact pair ESLint, diff hygiene, byte shape, and frozen dependency checks. A real
producer-shaped public deletion also reparsed successfully, matched exact workspace CAS, and retained four calls, four
operations, and zero gaps. These greens do not establish complete source authority.

Fresh zero-write native Luna auditor `01a011f7-206a-70b3-ad17-0824cc581eb0` preserved every byte and returned
`FINDINGS`. Five independent after-side retained-record mutations incorrectly compared equal: property
`value.expression`, property `path`, handler `path`, handler `context.reachability`, and alias `value.expression`.
`structuralCompleteRecordIdentityAfterSplice()` compared the common record identity/order shell but omitted current
producer payloads. The closed comparison must include property `path`, `value`, optional `owner`, `assignment`, and
`context`; handler `path`, `value`, optional `functionSource`, `bodySource`, `parameters`, and `context`; and alias
`value`, `aliasKind`, and `context`. Missing, extra, inherited, accessor-bearing, and explicit-undefined variants must
follow the exact producer contract. Generic key remapping and fixture-value special cases remain forbidden.

The same audit measured the public-input Proxy boundary at one `getPrototypeOf` trap and zero getter observations. No
avoidable browser-language alternative was found, so this is recorded as a residual boundary rather than the present
acceptance blocker. Initial inline/base64/fixture harness failures were non-evidence and made zero writes.

Exact native `luna_executor` Meitner `01a01212-e38e-7f12-93d7-9536a6bf2bf2` owns only
`src/lib/x4UiSourceEdits.ts` and `src/lib/x4UiSourceEdits.selftest.ts`. Production remains frozen until the separate
retained-payload matrix is causally red. Each row must prove baseline true, mutation applied, comparator false, and no
throw; cover every property, handler, and alias producer field plus extra/missing/undefined shapes. The production
repair must be schema-aware and preserve both public deletion positives, fluent/insertion behavior, complete-record
order, closed kernel-state validation, Proxy boundary, all prior suites, exact two-file containment, frozen
WorkspaceSource hashes, byte shape, and exact status 49. Coordinator reproduction and a new fresh zero-write native
Luna `CLEAN` are mandatory before Batch 8B acceptance.

The tests-first gate has now passed honestly. With production still exactly `8E37...39E79`, the new matrix produced 28
named rows: 16 causal reds and 12 rows already rejected by existing guards. Every row proved `baseline=true`,
`mutationApplied=true`, and `threw=false`; the 16 reds isolated the defect as `comparator=true`. All earlier SourceEdits
families remained green at scalar `34/34`, structural `1/1`, prior `62/62`, round two `18/18`, round three `12/12`,
round four `31/31`, round five `95/95`, round six `97/97`, round seven `125/125`, audit `10/10`, and producer-kernel
`63/63`. Only the selftest changed for the red receipt. Production repair is now active in the same bounded ownership.

Interim implementation checkpoint: the original retained-payload matrix is now `28/28` green, and the expanded final
matrix is `43/43` green across property 23, handler 12, and alias 8. The first closed normalization made 103 prior
round-seven rows red because source-derived complete-record paths were not remapped through their exact schema parent
field; the worker corrected that schema-path handling rather than weakening the older correspondence oracle. A broad
temporary diagnostic then exited `0xC0000409` before output; it was removed in favor of narrow diagnostics, and no
production debug output remains. SourceEdits now exits 0 with all earlier matrix counts unchanged. This is still an
interim candidate: coupled suites, typecheck, exact ESLint, pair/full diff hygiene, final hashes/sizes/byte shape,
status 49, and exact two-file containment remain required before coordinator review and fresh zero-write audit.

The final round-nine candidate is production
`CA4DFD33245A5EE04451E9038AE97A3A342CA5A8DB1C53E1F5215FFC1AF12BB0` (224786 bytes) and selftest
`D1DB935DFCB43C4DB4FF108950A00A69D043DC5CDEEFEE56479073BD1307FBD9` (356324 bytes). Worker and coordinator each
reproduced retained payload `43/43`, all prior SourceEdits matrices, WorkspaceSource `5/5`, SourceBundle, EditorSession,
CallModel `57/57`, Layout `565/565`, lint `112/112`, Scene `136/136` with configured MENU/HUB/COMM `3/3`, Preview
`94/94`, Paint `138/138`, repository typecheck, exact pair ESLint, pair/full diff hygiene, frozen WorkspaceSource
hashes, NUL/CR/final-LF shape, exact status 49, and two-file implementation containment. The permanent matrix emits all
43 row receipts and independently records baseline, mutation application, comparator result, throw result, and boundary
observation result. Coordinator static review also confirmed closed Reflect-owned keys, exact producer schema branches,
nested parser-value/context normalization, and exact schema-owned source remapping.

This evidence advances the unit to `CANDIDATE`, not acceptance. Fresh zero-write native Luna auditor McClintock
`01a01240-6c6c-72d0-9a00-ab9723d3f265` is now independently reviewing the code, rebuilding a file-free real-producer
public deletion with a second variant, mutating retained property/handler/alias fields beyond the permanent rows,
checking hostile closed-data boundaries, rerunning every focused/coupled gate, and proving exact hash/status readback.
Batch 8B becomes accepted only on `CLEAN`; any causal finding returns it to a bounded tests-first correction. Broad
Forge, deploy, external-record, and game gates remain locked. Preview remains `Not verified in game`.

This review is non-clean. Sustain fresh producer-shaped public probes even after large green matrices. Improve the
permanent oracle by mutating every field in every producer record type rather than mirroring the comparator's selected
keys. Highest-risk evidenced weakness is a source edit that preserves call/layout shape and exact CAS while silently
accepting drift in property, handler, or alias semantics. No capability-map delta; external records remain unchanged.

### Batch 8B round-nine accepted — 2026-08-17

Status: `FOCUSED VERIFIED / ACCEPTED`. Overall B119 remains `IN_PROGRESS / PARTIAL — Not verified in game`.

Mandatory zero-write native Luna auditor McClintock `01a01240-6c6c-72d0-9a00-ab9723d3f265` returned `CLEAN` against
SourceEdits production/selftest
`CA4DFD33245A5EE04451E9038AE97A3A342CA5A8DB1C53E1F5215FFC1AF12BB0` /
`D1DB935DFCB43C4DB4FF108950A00A69D043DC5CDEEFEE56479073BD1307FBD9` and frozen WorkspaceSource production/selftest
`B56B7A1ADD1AFD52EAFDBC077AF747DD93148CA9A62DAEDFC89CAD096D0F813E` /
`358F0C7837C42B13097EB0D053C0100F8AFEBF1595C19FC855619E5E2D311CFE`. It preserved HEAD/origin parity, exact status
49, and digest `49CD893BB8085161CA5C37BB249C8E273E6B7D9CBC111E731233104C11A212AC` with no writes.

The auditor independently reviewed the closed property/handler/alias schemas, exact source remap, global order and
cardinality, insertion/deletion bounds, and independent call substreams. Two file-free real-producer public positives
on distinct paths/layouts each passed discovery, apply, complete reparse, exact CAS, byte locality, provenance
restoration, and `4 calls / 4 operations / 0 gaps`. A separate issued stream transitioned `5→4` calls, `5→4`
operations, and `22→19` complete records. Hostile retained-record and boundary matrices passed `47/47` and `12/12`;
every row proved the baseline, applied mutation, comparator refusal, no throw, and zero getter observations. A hostile
Proxy produced exactly one caught `getPrototypeOf` trap and no other trap. All focused/coupled suites, typecheck, exact
ESLint, diff hygiene, hashes, byte shape, and containment repeated green.

Supplemental zero-write auditor Halley `01a01254-6064-72c3-b0ca-05137b761e05` independently agreed on code review,
hashes, inventory, operation catalog, and focused selftests, but its public apply/hostile matrix did not run because of
transport/selector failures. Per its stop rule it returned `FINDINGS — PARTIAL AUDIT LIMITATION`, not a product
finding. This does not contradict McClintock's complete mandatory CLEAN receipt.

Review classification: source-canonical insertion/deletion and WorkspaceSource CAS authority are done and evidenced
at focused scope. Broad Forge UI, packaged product, deploy, C++ frame acceptance, and in-game experience remain
deliberately unproven. No capability-map delta.

AAR trigger: the supplemental audit harness failed. Sustain exact hashes, disjoint ownership, and independent public
producer probes. Improve audit tooling by separating fixture selection from transport so a harness failure cannot look
like a product result. Highest-risk evidenced weakness remains false acceptance at a source-authority boundary; the
accepted closed-schema comparator and mandatory independent CLEAN materially reduce that risk.

### Batch 8C reconciled plan — manual screenshot-calibrated keep-outs

Status: `SPECIFIED`. Lane: `FULL`.

PLAN
- Bounded unit: connect manual screenshot polygon calibration to the existing keep-out authority, editor session,
  logical paint plan, and existing canvas overlay; then mount local design-time controls in the existing source editor.
- Assumptions: v1 receives user-entered screenshot evidence and pixel points. It does not capture screenshots or infer
  regions with computer vision. Calibrations are editor-session state only; no project/source/config persistence is
  authorized in this unit.
- Authoritative references: the source-first design's Keep-out overlays contract; existing
  `calibrateKeepOutPolygon()`, `projectKeepOut()`, EditorSession, PaintPlan, Canvas renderer, and source-editor owners.
- In scope: exact drawable bounds, screenshot SHA-256/profile, stable ID/context/note, normalized polygon points,
  explicit enabled state, provenance/evidence display, deterministic reprojection at the active drawable size, and
  advisory paint commands carrying `Not verified in game`.
- Out of scope: automatic screenshot capture/CV, invented ticker/top-HUD geometry, persistence, package/deploy policy,
  overlap blocking, widget texture paint, deploy-confirm identity, broad installed-host proof, and X4 validation.
- Risks/authorization: malformed or forged calibration data must not become paint authority. No mod, corpus, game,
  configuration, network, spending, deletion, or external filesystem mutation is required.
- Rollback: revert only Batch 8C-owned files to their recorded pre-unit hashes; accepted Batch 8B files remain frozen.

RECONCILE
- Existing chain reused: `x4UiKeepOuts` already normalizes and projects polygons; EditorSession currently admits only
  preset members; PaintPlan currently revalidates only built-ins; Canvas already paints polygon commands; the source
  editor already owns context keep-out controls. Building a second overlay/persistence/emitter path is forbidden.
- Couplings: calibration input → issued normalized entry → session projection → paint revalidation → canvas command;
  viewport/profile changes must reproject normalized points without changing calibration provenance.
- Capability-map delta: none; this extends the existing keep-out capability.

IMPLEMENT
- Batch 8C.1 authority spine owns only `x4UiKeepOuts.ts/.selftest.ts`, `x4UiEditorSession.ts/.selftest.ts`, and
  `x4UiPaintPlan.ts/.selftest.ts`. Session accepts calibration inputs plus explicitly enabled manual IDs, invokes the
  existing calibrator, and exposes immutable result/projection/evidence. Paint input carries the issued entry and its
  projection; Paint reprojects with `projectKeepOut(entry, drawable)` and accepts only exact correspondence. Built-in
  overlays use the same entry-plus-projection path. For a built-in, paint `context` is the selected preset application
  context and Paint must prove that preset contains the production-evidence entry; `entry.context` remains the evidence
  origin and need not equal the selected preset. For a manual entry, paint `context` must exactly equal the issued
  `entry.context`. A duplicated manual stable ID makes every occurrence ambiguous: all occurrences refuse, issue no
  entry/projection, and emit no paint command.
- Batch 8C.2 UI controls owns only `X4UiSourceEditor.tsx/.selftest.tsx`, after 8C.1 acceptance. Controls collect stable
  ID, context, source note, screenshot hash/profile, exact drawable origin/size, and at least three `x,y` pixel points;
  they show refusal or calibrated provenance and allow explicit enable/remove without editing Lua or workspace files.

VALIDATE
- Acceptance: one valid polygon calibrates, retains exact screenshot identity, projects at two viewport sizes, reaches
  Paint and the existing polygon Canvas command, remains advisory, and always states `Not verified in game`. Built-in
  guides remain byte/behavior compatible. Invalid calibration is visible and emits no paint command. Polygon overlap
  never blocks preview/package/deploy state.
- Negative paths: malformed/empty hash/profile/context/note/ID, invalid bounds, too few/duplicate/collinear/non-finite/
  out-of-bounds points, duplicate IDs, built-in ID collision, context mismatch, stale viewport projection, forged
  evidence/game truth, unknown/extra/inherited/accessor keys, cycles, symbols/non-enumerables, caller mutation, and a
  hostile Proxy must fail closed without getters, mutation, throw escape, or stale overlay retention.
- Required focused evidence: causal fail-first rows; keep-out/session/paint/component selftests; coupled preview/canvas
  tests where affected; `npm run typecheck`; exact ESLint; diff/hash/NUL/CR/final-LF/dirty-set containment; coordinator
  review; fresh zero-write native Luna CLEAN. Broad precommit/oracle/E2E/build, rendered Forge, package/deploy, and game
  gates remain locked pending the machine-state ask.

RECONCILE DELTA — 2026-08-18
- Coordinator review reproduced two acceptance-boundary defects in the first candidate: only the later duplicate stable
  ID refused while the first occurrence still painted, and built-ins used `entry.context` rather than the selected
  preset application context. The prior unqualified context-equality wording was therefore incorrect for composed
  built-in presets and is replaced by the split rule above.
- Correction remains within the same six authority files and must start with causal Session/Paint reds against the
  recorded candidate hashes. Required positives cover all four preset contexts through the entry-plus-projection path;
  required negatives cover every-occurrence duplicate refusal/no-paint, built-in preset-membership mismatch, manual
  context mismatch, and forged/stale entry/projection correspondence. The original six calibration-seam reds remain
  necessary but are not sufficient end-to-end evidence.
- Zero-write audit `01a012fa-45f9-7371-a895-cd84d13ed486` returned `FINDINGS`, with 52 status records unchanged and
  all six candidate hashes exact. It reproduced four defects: group-wide duplicate refusal is missing; built-in context
  is evidence-origin rather than selected-preset; production Canvas rejects a valid issued manual polygon because its
  command validator permits only built-in IDs/contexts; and Paint still accepts the legacy no-entry built-in bypass.
- Correction is sequential. First, the Session/Paint pair and selftests must remove or strictly close the no-entry path,
  implement group-wide duplicate refusal, and split preset application context from evidence origin with causal reds
  against the rejected hashes. Second, the Canvas pair must consume the corrected required-entry Paint fixture and
  admit only the valid closed shape for calibrated manual polygon commands while preserving built-in validation,
  duplicate-command rejection, advisory-only truth, and `Not verified in game`.
- The untouched Canvas literal trace mismatch is a separate test-oracle issue: the auditor mapped operation 365 to gap
  command `gap:scene-gap:000002` order 58 and proved runtime plus dynamic oracle agree while the literal golden repeats
  `setFillStyle` eight times. An in-memory HEAD fixture reproduced the same `rendered / 73 / 403 / firstDiff=365`, so
  that mismatch pre-existed Batch 8C.1. Its maintenance is selftest-only, even though the distinct manual-ID validation
  finding now requires a bounded Canvas production change. Each mechanism needs a separate causal receipt.

CLOSE
- Batch 8C may reach focused acceptance only after both subunits and the fresh zero-write audit pass. The program still
  remains `PARTIAL / Not verified in game` until its later broad, installed-host, deploy, and in-game gates.

### Batch 8C.1 candidate — focused green, coupled Canvas red — 2026-08-17

Status: `PARTIAL / CANDIDATE`. Exact native Luna Parfit `01a0127c-145a-70a1-9d2c-7a4cc1fb214c` changed only the six
documented KeepOuts, EditorSession, and PaintPlan production/selftest files. The causal fail-first matrix was `6/6` red
before production and is `6/6` green after repair. The exact pre-production hashes were KeepOuts
`3715EB1380A2913FD41BAE756493DA1B388CB65EF8B7C3A6C199061343860C8F`, EditorSession
`3B76B8962E5423BED24EC6FFE1B3CC7362DEC81F16D1A3857DB3C2D7426E0F9F`, and PaintPlan
`711388F4B66F53DCE31F6E33CFF83B125C967B81822003CAF074447258D964FB`. The six rows causally covered canonical
drawable bounds, `x/y` origin aliases, built-in-ID collision, an extra calibration-input key, an accessor field without
getter execution, and an extra point key. They exercised the `calibrateKeepOutPolygon()` seam only; no Session or
Paint end-to-end row was captured red before production changed. Final hashes are:

- KeepOuts `0325012641209481DFAE32E55933B76F1F163A2FDD2A5538F377623B49723301` /
  `E91CE59288A1EC67B19EDE64BD90FD59F5AC5701EAEDF64BE0612A52CD1D9822`;
- EditorSession `379356DC830B1EF1EA46AAAACF4A709A6B5D3024BA5A812471BCA6868B844099` /
  `29563E78EAFE2FA3F5C14C559FF0E5EFF2CE53DB862DE43A727CB64206453D01`;
- PaintPlan `26228E25C83023004822C58B02AF7B72D78E003B092739BEB4AE261AEBEBBFD6` /
  `774A7CEF63CE19E75BBC626848A62BEB0429F04C5B01AAD95C4F2FF7FA2E187E`.

Worker and coordinator focused validation passed KeepOuts `17/17`, EditorSession, Paint `143/143`, Preview `94/94`,
typecheck, exact six-file ESLint, and diff hygiene. Every owned file is NUL-free, CR-free, and LF-terminated.

The coupled Canvas selftest is `65/70`, so acceptance is withheld. All five failures share one first divergence at
composite trace operation 365: the literal oracle expects `setFillStyle #ef4444`, while the actual renderer emits
`save`. The renderer returns `rendered`, all 73 command IDs/orders are exact, and expected/actual trace lengths are both
403; the four other failures are downstream equality/sensitivity assertions. This is not yet classified as a stale
golden or a product ordering defect. Canvas production/selftest were untouched.

Fresh zero-write native auditor Lagrange `01a012fa-45f9-7371-a895-cd84d13ed486` is independently mapping the mismatch
to the exact command and auditing manual issuance, built-in context composition, duplicate-ID behavior, forged/stale
authority, and closed-data boundaries. Batch 8C.2 React controls, broad gates, and game gates remain frozen. AAR trigger:
the required coupled test failed; no acceptance claim may be based on the narrower greens.

The audit returned `FINDINGS`, zero writes, with status count `52` before/after and every supplied hash exact. It
classified the five Canvas reds as one pre-existing stale literal-golden cascade, then reproduced four product findings:
group-wide duplicate refusal missing; selected-preset context replaced by evidence-origin context; valid manual Paint
rejected by Canvas's built-in-only command validator; and the legacy no-entry built-in Paint bypass. The candidate is
rejected. Correction order is Session/Paint authority first, then Canvas manual-command validation plus independent
literal-golden maintenance, then all coupled focused gates and a new zero-write audit.

### Batch 8C.1 correction candidate and proxy re-audit — 2026-08-18

Status: `FINDINGS / CORRECTION ACTIVE`. Native Luna Parfit corrected the four prior findings tests-first. Exact red
evidence against unchanged production covered the group-wide duplicate winner, three non-cockpit selected-preset
contexts, the no-entry built-in bypass, and valid manual Paint refused by Canvas. Coordinator and fresh zero-write Luna
Pasteur then reproduced Session causal `1/1`, Paint `148/148` with causal `9/9`, Canvas `75/75` with causal `10/10`,
KeepOuts `17/17`, Preview `94/94`, typecheck, exact six-file ESLint, and diff hygiene. The stale Canvas literal is now
exactly 73 commands / 403 operations with oracle sensitivity `3/3`; the real manual polygon path reaches Canvas.

Final audited hashes before the next correction are Session `6EDA944663241569CF6E9F15F5BC82F5F70C33D4396F3DE6A228F8D1E683D41D`
/ `AFA6FB1274B105838F4509ACED3754ADF28EEAB3FCE46004699D9436843A418C`, Paint
`0C488162BD5D301BC725211C14DE0D4893EB754E00FF7D74A5954E2A1C2B0266` /
`07BF5DBC022F953D86968D30D621F752AD8B38D2E7DB6CE5C61287FFC7B170B1`, and Canvas
`CF7AFAF3ED76E98DF27CAE5143E04B4E8E97D48704ADE261A4C8CBABBE9A8AC2` /
`B45116AB3455317F25DE641C9F9D1687B59820D817D8CE596EF679D8E1C6228F`. Audit status count was 54 before/after with
zero writes.

Pasteur's hostile matrix closed safely-known duplicate identity: 12/12 cases and 26/26 occurrences refused, with no
entry, projection, enablement, or Paint authority. Unknown accessor/inherited identities correctly refused only
themselves and remained nonblocking. It found one new HIGH defect: a transparent Proxy around a valid manual-calibration
array is accepted by Session, and a transparent Proxy around valid issued keep-out input is accepted by Paint after
proxy traps run. That violates the specified hostile-Proxy fail-closed boundary.

The next bounded correction owns only Session/Paint production and selftests. It is tests-first against the exact hashes
above. Permanent reds must reproduce both accepted transparent Proxy containers, prove the intended seam and trap
census, and add mixed accessor/proxy controls. The correction should reuse the existing browser-safe repository
precedent of descriptor/accessor validation plus `structuredClone` admissibility; Node-only `util.types.isProxy`, a new
server owner, or parallel authority infrastructure is forbidden. It must refuse Proxy containers before issuing entry,
projection, enablement, command, or stale overlay, preserve zero getter invocation and throw containment, and preserve
visible/nonblocking invalid calibrations. If those requirements cannot all be met for a combined hostile case using
portable browser semantics, stop and document the exact contradiction rather than weakening a test or inventing proof.
Canvas, KeepOuts, React, broad gates, and game truth remain frozen until this correction and a fresh zero-write audit are
CLEAN.

The accepted Batch 8B checkpoint was synchronized and read back at GitHub #41 comment `5322307397`, Drive revision
`AIroW37jpAOMfCUlSFwOXv_uXS1YYM94MujBar8ureU3U5V06iBJpgWyL2cVfNYsUaiQOAonke94ZCJD-LRJsAjmq6AOtu_0NPuAZQGa1F2m`,
and Notion page `3b84618e-d15b-8190-821e-c0eb96f43d5a`.

### Batch 8C.1 transparent-Proxy contradiction and reconciled boundary — 2026-08-18

Status: `SPECIFIED / CORRECTION ACTIVE`. The strict transparent-Proxy correction stopped before production exactly as
required. Its permanent fail-first rows left Session `3/6` and Paint `150/152`: transparent Proxy containers and direct
Proxy elements could present otherwise-valid calibration or issued keep-out data. Session and Paint production stayed
byte-identical at `6EDA944663241569CF6E9F15F5BC82F5F70C33D4396F3DE6A228F8D1E683D41D` and
`0C488162BD5D301BC725211C14DE0D4893EB754E00FF7D74A5954E2A1C2B0266`; Canvas `75/75`, KeepOuts `17/17`, Preview
`94/94`, typecheck, exact lint, diff hygiene, byte shape, and status count 54 remained unchanged.

RECONCILE
- Portable browser JavaScript has no semantic operation that identifies a fully transparent Proxy while preserving the
  target's behavior. Descriptor reflection is intentionally transparent. `structuredClone` rejects a Proxy, but cloning
  an ordinary mixed array traverses its values and invokes accessors. Therefore unconditional transparent-Proxy refusal,
  zero getter execution, and nonblocking treatment of malformed peers cannot all be guaranteed. The previous acceptance
  conjunction is impossible and is replaced; no product code will pretend otherwise.
- The enforceable authority property is detached, one-boundary consumption. Session must materialize each calibration
  candidate through own data descriptors into a fresh closed-data snapshot before duplicate counting or calibration.
  Paint must capture each keep-out item's `context`, exact issued-entry identity, and exact issued-projection identity
  from one descriptor admission, then materialize only those captured issued objects into fresh closed data. No later
  validation, projection, output, or diagnostic may read from or retain the caller's container, item, nested object, or
  Proxy.
- A transparent Proxy is consequently treated as an untrusted data facade, not as authority and not as a detectable
  type. Its traps may run during the bounded descriptor capture. Throwing/revoked traps refuse without escaping;
  accessors, symbols, cycles, decorated/sparse arrays, unknown shapes, and non-enumerable data remain closed. A malformed
  Session item remains visible/refused while unrelated valid items remain nonblocking. Paint keeps its all-or-nothing
  issued-authority boundary.
- The correction remains bounded to the Session/Paint production/selftest pairs. KeepOuts, Canvas, React, external
  records, broad gates, and game truth remain frozen. This is a reconciled acceptance change caused by a language-level
  contradiction, not a test relaxation over a feasible defect.

VALIDATE
- Before production edits, add causal time-of-check/time-of-use rows that make a Proxy present one stable ID during
  duplicate discovery and another during calibration, and make Paint present issued entry/projection identities during
  admission but forged structural values during later materialization. Both must be red against the unchanged production
  hashes and green only when every downstream decision consumes the detached snapshot.
- Retain the transparent-container/direct-element rows as facade controls: require zero getter execution, bounded/caught
  traps, immutable detached outputs, no output change after target mutation or post-call trap arming, exact issued
  identity at Paint admission, no stale overlay, and deterministic replay. Retain revoked/throwing, mixed accessor,
  symbol, cycle, duplicate, selected-context, no-entry, copied/stale/mismatch, Canvas, KeepOuts, and Preview controls.
- Focused acceptance still requires every Session/Paint row green, Canvas `75/75`, KeepOuts `17/17`, Preview `94/94`,
  typecheck, exact four-file ESLint, diff/hash/NUL/CR/final-LF/status containment, coordinator reproduction, and a fresh
  zero-write native Luna `CLEAN`. The product remains `Not verified in game`.

### Batch 8C.1 detached-snapshot correction and final CLEAN — 2026-08-18

Status: `FOCUSED VERIFIED / ACCEPTED`; overall B119 remains `IN_PROGRESS / PARTIAL — Not verified in game`.

The detached-snapshot repair began with causal fail-first evidence against unchanged Session/Paint production. Session
was `6/7`, with only `causal-session-toctou-snapshot-stops-collision-swap` red; Paint was `152/153`, with only
`causal-paint-toctou-snapshot-stops-forged-second-story` red. The repair snapshots each Session candidate from its own
data descriptors before duplicate/calibration work and makes Paint capture the exact issued entry/projection identities
once before materialization. Final production hashes are Session
`20B7429079DA6C7297A505667C07C1FDD015827839BB468C4412402E7E7D5AF0` and Paint
`4F1F783526D201EBAF1CE0156592CF27924EF40B47EE004446880FB62BF870B5`.

The first fresh audit found no production authority escape but rejected acceptance because the permanent tests asserted
only aggregate Proxy activity in several accepted facade rows and a Session getter counter was disconnected from the
real `get` trap. A tests-only correction made every accepted Session/Paint facade and TOCTOU row use the same exact
five-field census predicate (`total/get/getPrototypeOf/ownKeys/getOwnPropertyDescriptor`) and added sensitivity controls
that accept the real vector and reject `get + 1`, `ownKeys + 1`, `getPrototypeOf + 1`, descriptor `+1`, and descriptor
`-1`. Final selftest hashes are Session
`49C10D546016338A2E482D26D0B48187B0CD53366A7F9D3EC2F0EF613DC6F518` and Paint
`E221AC858AE9FE47C75EC2844DFB0DBD113AD3A7E4D69F073164DA82CE4A7AC8`.

Coordinator reproduction passed Session `7/7`, Paint `153/153` with causal `14/14`, CanvasRenderer `75/75`, KeepOuts
`17/17` with causal `6/6`, Preview `94/94`, repository typecheck, exact four-file ESLint, and diff hygiene. All four
Session/Paint files have no NUL or CR and retain a final LF; production hashes remained frozen. Final independent
zero-write native Luna auditor `01a013a2-01a8-7f82-ae3e-66c9d2555399` returned `CLEAN`, changed no files, preserved
HEAD/origin at `77138741a9f470e2c6c37c2d6857688dd1e2b13e`, and preserved the exact 54-entry status digest
`82a0d89d8ba0208e9aa75dadeeb327d4773a79922ace04059e380b72c52d117b`. Its independent nested transparent-Proxy probe
also produced detached recursively frozen output with zero getter calls. Batch 8C.2 may now mount only the specified
session-local manual controls in the existing source-editor keep-out section. Broad, installed-host, deploy, and game
gates remain locked behind their later machine-state gate; no game verification is claimed.

### Batch 8C.2 React candidate — fresh audit FINDINGS and row-local correction — 2026-08-18

Status: `FINDINGS / CORRECTION ACTIVE`; overall B119 remains `IN_PROGRESS / PARTIAL — Not verified in game`.

The initial two-file candidate reached a focused green matrix at production/selftest hashes
`8FF6C50835EE0C6DE1397AA1EDFF1CE480B25B407294BB07A2941DA2EFDC0AA8` and
`2F15ED9B12797581B30E765DDBC474C7D8088ABF08D149349BF10EF14C74D79D`: component, Session `7/7`, Paint `153/153`,
CanvasRenderer `75/75`, KeepOuts `17/17`, Preview `94/94`, typecheck, exact two-file ESLint, and diff hygiene all passed.
Those greens do not accept the candidate.

Fresh zero-write Luna auditor `01a013de-066a-7172-8006-a450058ce543` independently reproduced a P1 row-identity
escape. `setX4UiManualCalibrationRowEnabled()` stores stable IDs, and the rendered checkbox reads the same stable-ID
set. Two rows sharing an ID therefore alias: enabling row one produces the visible vector `[true, true]`, and toggling
row two clears row one's explicit state. Duplicate admission still correctly blocks Session/Paint, but the local UI
violates the documented distinct-row contract. The audit also identified ambiguous evidence labels around historical
pre-correction hashes; those receipts are useful but must not read as current hashes, and no selftest may pretend to
embed its own current hash.

The audit changed no files and preserved all ten supplied hashes, `HEAD=origin/main` at
`77138741a9f470e2c6c37c2d6857688dd1e2b13e`, status count `56`, and full status digest
`9EC85F3E3CF4B1010D3CAA68FCE0E438A22FC035FDDDC0D3C1DDD47B363DF2BD`. Original exact Luna owner
`01a013b5-007b-7da1-ba20-b03b260f5c5e` now owns only the same two React files. It must first capture a causal red, then
key local explicit enablement by immutable `rowId`; derive primitive stable IDs only in the validated Session input;
keep valid-valid and valid-malformed duplicates ambiguity-blocked; preserve each surviving row's own enable state;
remove only the deleted row's state; retain plain session-local controls and `Not verified in game`; and relabel the
historical hash receipt without inventing current evidence. Full focused reproduction plus a new independent zero-write
`CLEAN` remain mandatory.

In parallel, Luna `01a013ee-8dc8-7292-a1d8-c44281fadb9d` has a read-only reconciliation task for the later real-widget
paint boundary. It must classify shipped `widget_fullscreen.lua`/Helper/assets and C++ getters before any producer or
paint owner is assigned. This research is not implementation or acceptance. Broad Forge, installed-host, deploy-byte,
C++ frame-acceptance, and X4 screenshot gates remain unrun and unclaimed.

### Batch 8C.2 row-local correction and final CLEAN — 2026-08-18

Status: `FOCUSED VERIFIED / ACCEPTED`; overall B119 remains `IN_PROGRESS / PARTIAL — Not verified in game`.

The exact Luna owner captured the required causal red before production, then changed only
`src/components/X4UiSourceEditor.tsx` and its selftest. Final hashes are production
`B085A0A542D6B17E287DE52CB19452D2E75D67ACA15454274D61D20C3E85C3C2` and selftest
`9FF34E6471C045CB4FC7F3A2CEAF94391548967D8E5BFE2F20D8994F79EFE3ED`. Session-local enablement stores immutable
row IDs; stable IDs are projected only after parse and duplicate validation. Valid-valid and valid-malformed duplicate
rows retain independent checkbox state while both remain ambiguity-blocked. Removing a row activates the survivor only
when that survivor was independently enabled, and stable-ID edits preserve row-local intent through collision and
recovery. Historical hashes are explicitly labelled pre-correction receipts.

Coordinator reproduction passed the component selftest, Session `7/7`, Paint `153/153`, CanvasRenderer `75/75`,
KeepOuts `17/17`, Preview `94/94`, typecheck, exact two-file ESLint, and diff hygiene. Its independent executable probe
produced row vectors `[true,false]` and `[true,true]`, ambiguous Session IDs `[]`, enabled-survivor recovery
`["probe-shared"]`, and disabled-survivor recovery `[]`. Fresh zero-write Luna
`01a013ff-fca7-7c50-bb49-4aba524aee30` returned `CLEAN`: it repeated the full matrix, found no weakened assertion or
production escape, changed no files, matched every supplied hash, and preserved
`HEAD=origin/main=77138741a9f470e2c6c37c2d6857688dd1e2b13e` plus the exact 56-entry status digest
`9EC85F3E3CF4B1010D3CAA68FCE0E438A22FC035FDDDC0D3C1DDD47B363DF2BD`. Batch 8C is complete at focused scope.

### Added end-to-end AI Influence visual acceptance fixture — 2026-08-18

Status: `SPECIFIED`; it extends the final product proof and does not weaken or replace any existing B119 gate.

The required fixture is
`C:\Users\Moshi\Desktop\# AI Influence mod UI design\design_handoff_ai_influence`. The coordinator read the complete
README and visually inspected all twelve supplied references: `00-brief.png`, `00-vanilla-reference.webp`, and every
`1a`-`1j` PNG. `AI Influence UI.dc.html` is an interactive visual reference only and must not be translated into the
product. The completed Forge must author source-preserving X4 Lua using the real Helper/widget calls and the configured
unpacked corpus.

Acceptance sequence:

1. Build recommended comm-link screen `1b` through the Forge first. Preserve the left state rail, fixed bottom anchors,
   internally scrolling transcript, static side-by-side choices and input dock, unobscured NPC centre, and native-wheel
   keep-out band.
2. Build the remaining comm-link (`1a`, `1c`), confirmation gate (`1d`-`1f`), and hub (`1g`-`1j`) surfaces through the
   same editor/emitter. Use flat square X4 chrome, 1 px blue rules, state-only colour, Zekton-backed text, scaled row
   heights, solid table-backed meters, and disabled-visible gated actions.
3. Capture Forge renders at the design resolution and applicable UI scales; compare geometry, wrapping, truncation,
   fixed/scroll regions, and keep-outs against the supplied images. A browser match remains `Not verified in game`.
4. Deploy the exact emitted bytes through the validated Forge path, prove deploy hash identity, and capture matching X4
   screenshots. Only game-reported frame acceptance plus visual comparison can promote the result to 1:1 in game.

Negative paths: the HTML/CSS prototype is never used as implementation code; preview never claims engine acceptance;
the conversation wheel/NPC keep-outs may not be occluded; gated actions may not disappear; and streaming/dice variants
may not shift the static action region.

Visual-inspection ledger (the PNG/WebP pixels, not the HTML, are authoritative):

- `1a` deliberately spends most of the screen on unobscured live scene; the right dock is a tall, dense information
  column whose transcript owns the only expanding/scrolling region and whose choice stack is pinned below it.
- `1b` is not a centred modal. Its sparse state rail, untouched NPC-safe centre, and three independent bottom-anchored
  transcript/choice/input plates are the composition. The entire lowest band remains visually empty for the native
  wheel. Matching labels while shifting those masses is a failed visual comparison.
- `1c` is a three-column full-screen ledger with a deliberately empty upper centre and the active conversation pinned
  to the centre bottom. The narrow correspondent history and leverage columns frame that empty live-conversation field.
- `1d`-`1f` are compact centred decision plates surrounded by large quiet margins. Their hierarchy comes from one
  dominant blue header/action, thin row rules, fixed numeric gutters, and visibly retained disabled/gated rows—not from
  ornament, shadows, rounded cards, or extra colour.
- `1g` uses a narrow faction master list and a much wider detail/ledger pane; the selected faction row is the strongest
  blue mass. `1h` is three equal audit columns with independently pinned footers. Their large lower empty fields are
  intentional and must not be compressed away by auto-height layout.
- `1i` and `1j` show two tabs stacked only for the handoff image. They must become separate tab states. Both rely on
  long, low-density rows, fixed right-aligned status/action columns, and colour that encodes source/outcome rather than
  decoration.
- Across every screen, the most important visual invariants are proportional column widths, deliberate negative space,
  thin square blue chrome, bottom/static anchoring, and restrained state-only colour. Presence of all copy is necessary
  but insufficient for visual acceptance.

#### Visual source freeze and `1b` keep-out reconciliation — 2026-08-19

Status: `SPECIFIED / REPRODUCED CONFLICT`; no product, mod, game, corpus, or configuration file changed during this
read-only reconciliation.

The coordinator re-opened the supplied pixels, including `1b` and the vanilla reference, rather than relying on the
README or HTML alone. Immutable handoff identities are README
`413970EB6BE9D199A98918EE6352DF1595E1F41B1007BFA46627DA0F3D2F7163`, reference-only HTML
`0AF1FBEC4BC7C8C32C5C4DAE927F7357BBEB91F706197361C176D07E60E5D7D2`, and support script
`8FE7DF74405F3C55F49B7249C74EA1397E65D07DEA2B1BD3B4A489BEC2E28CBE`. Image SHA-256 identities are:

- `00-brief.png` `B7FD3CA46BDE57AB9031CBBC20FA9D6C3B7CEBD8525E608F23F732437F8BF857` (`1278x803`) and
  `00-vanilla-reference.webp` `D943111D010FFDC0DF96D58CCA00D906B94DA4317BB7CE24EC9062D2A09A43CB` (`2560x1440`);
- `1a` `B7645A19FDBFC81D50618E82144895E8249CE910D65498F8850E6E42400A5EB3`, `1b`
  `C22D77069445514B52D0258D9AF98907AFAA2B4B2438D08EFE73FD9E67554CF2`, `1c`
  `ED58A9F6287D2347E66D2BAF4AEE9AD0B6A1150EEE4D491BAB6D6DF6A3A7AB9B`, `1g`
  `6CD8E74ED44B65A8E110D623EC18498502D6D58A4385CD9E4384F2F52F67362C`, `1h`
  `7BF5A7726105750C157BC0FB62F41576A2BA5D310EC1EBD4092BEFE040D8F03A`, `1i`
  `92171B690EEAD994F776406F5FC7A8275E21C40AF3106E8E70C3090678F138E9`, and `1j`
  `7E32CA4B9BAC1D615C632E3EBB89E85ED31DD1BE5F1D26A581AFE5327F5D9DA7` are `2562x1442` source images whose
  visual card is the specified `2560x1440` canvas plus border;
- cropped decision-card references `1d` `195C20E272EF09AAF00D237C84FD18EB0EF60780EB0F06E39F01EC4F20AC25B9`
  (`1380x840`), `1e` `25778A56F6F2787DABC6B465209022BE99821F9958487BFFD4E1A9650B704710`
  (`1382x1002`), and `1f` `25F09C3E4D1DC92B00900A0C85033F6E200F1F18FB5EDD924A44DD6F8AF96566`
  (`1382x1002`) do not prove an absolute full-screen position; centre them in the `2560x1440` Forge canvas using the
  README plate dimensions and compare their internal geometry.

`[REPRODUCED]` Forge already owns and tests the source-requested cockpit-conversation guides: Back row `y=0.788`,
option-stack start `y=0.740`, and INFORMATION/NPC-video left edge `x=0.664`. At `2560x1440` these project without
rounding to `y=1134.72`, `y=1065.6`, and `x=1699.84`; the existing SourceEditor exposes the preset and Session -> Paint
-> Canvas carries the active guides. The `1b` source places a centred choice plate at `bottom=236` with content-box
width `1360` plus `26px` horizontal padding, so its visible outer span is `x=574..1986`, its bottom is `y=1204`, and
the supplied pixels visibly span both horizontal guides. The `1360px` input dock spans `x=600..1960` at input-bar
height and crosses the measured `x=1699.84` information-panel edge. This conflicts with the handoff's simultaneous
claims that the native wheel remains unobscured and nothing need be blank until approximately `y=1290`.

`[INFERENCE — high confidence, not game proof]` the mock cannot be copied pixel-for-pixel and also be declared clear of
the measured cockpit-conversation guides unless that exact X4 state suppresses, clips, or relocates the native wheel or
INFORMATION panel. The built-ins are guides, not measured full polygons, so intersection identifies a release-blocking
design risk rather than proving the exact occluded area. During Forge dogfood, enable `Cockpit conversation`, render the
literal `1b` geometry first to expose the collision, then preserve that evidence and create the smallest adjusted
variant that clears the active native regions. Do not silently shift the mock and do not promote either variant until
the deployed X4 screenshot establishes which native elements are present in the exact comm-link state.

External-record synchronization was read back without closing B119: GitHub #41 comment `5347871212` contains the
exact conflict checkpoint; Notion accepted comment `3c14618e-d15b-815e-968b-001d3fd913c1`, while its comments reader
again returned a stale discussion snapshot, so the schema-confirmed `Reverse Sync Result` property was updated and
read back with the three projected coordinates and pending gates instead of posting a duplicate. Drive appended the
same checkpoint under required revision
`AIroW34ec3tH_2d7m2zQDfMCm8rxh5dZp1CK8EbCPjrq4507c_TrVbTtqXFH7G4KeMGSC7OYBgz5ZhE4621LDPzvuG_Yz_MnmpuYTWq8Rnux`;
readback revision is
`AIroW35HtnX_2zZyHPLJwj9JIih8FTNVwLDSx2NZsJFb-l4bzsQD3tIkHbViIOHKLsZCeNFWPN8t5FDokUpSJvyQjEEcjHvQ3ayDbyb-JXKc`,
with the exact heading at indexes `90605..90667`, `HEADING_2` paragraph authority through index `90668`, and the
final pending-X4 sentence present.

Reconciliation found no ADR conflict and no capability-map delta: this checkpoint strengthens the open B119 acceptance
fixture but does not promote the uncommitted editor to a verified cumulative capability. Triggered AAR: the first HTML
search used a PowerShell-sensitive regex and failed before execution; the corrected read used fixed-string searches.
The first hash census also passed a wildcard to `Get-FileHash -LiteralPath`, which correctly did not expand it; explicit
`Get-ChildItem` enumeration produced the frozen hashes above. Neither failed read wrote data. Sustain the direct pixel
inspection plus exact source/geometry trace. Highest-risk evidenced weakness is that measured guides are not complete
native polygons; the bounded reduction is the literal-versus-clear dual render followed by exact-state X4 capture.

### Widget-paint source reconciliation amendment — 2026-08-18

Status: `SPECIFIED`; overall B119 remains `IN_PROGRESS / PARTIAL — Not verified in game`.

The read-only audit completed with no repository writes and corrected an overly broad first classification. Shipped X4
9.00 `libraries/colors.xml` is exact canonical default-theme data at SHA-256
`6A57FE660D546F5144206581A40194CE13D0D11478B584A46467F0AAE715B883`, 72,950 bytes. Its schema
`libraries/colors.xsd` is SHA-256 `F0D31824E00227EFF6288B084E29346C5AA9D2694BFB0D62D6008EE3DBD879DF`, 7,981 bytes. The
canonical graph has 224 unique `<color>` definitions, 804 unique one-hop `<mapping>` entries, zero duplicate IDs, zero
invalid references, and no mapping-to-mapping chains. Omitted XML `r/g/b` default to `0`, `a` to `255`, and `glow` to
`0` under the shipped schema.

This promotes default flat fills, row backgrounds, text/icon colors, button defaults, edit-box defaults, and known
`Color["id"]` references from unavailable to canonical-default-only evidence. It does not promote them to current
runtime truth: `widget_fullscreen.lua` receives the effective map from C++, while `gameoptions.lua` exposes profile,
definition, mapping, import/export, and colorblind controls. Personal overrides, active profile, daltonization mode and
strength, hover/active/selection state, materials, textures, glow rendering, and C++ metrics remain unavailable until
captured from the running game. Source-literal TOK color tables are independently source-known. Their Lua alpha semantics
must remain distinct from XML's 0-255 domain; no silent conversion is permitted.

Sequential bounded owner graph:

1. **P1 — CallModel color expression producer.** Own only `src/lib/x4UiCallModel.ts` and its selftest. Tests first for
   literal `{r,g,b,a}`, known symbolic `Color["id"]`, unknown ID, dynamic key, conditional expression,
   function-returned color, and omitted glow. Preserve exact fields, source locations, and provenance; never infer an
   effective runtime value or resolve the canonical map in this layer.
2. **P2 — CorpusAssets color loader.** Own only `src/lib/x4UiCorpusAssets.ts` and its selftest. Add exact XML/XSD
   identities and parse the closed default graph. Require canonical counts above plus negatives for hash mismatch,
   malformed/truncated XML, duplicate IDs, absent base references, mapping-to-mapping references, and invalid
   RGBA/glow domains. A captured C++ map must remain a separate non-canonical input.
3. **P3 — LayoutProgram default resolution.** Own only `src/lib/x4UiLayoutProgram.ts` and its selftest. Resolve known
   symbolic IDs against accepted canonical assets with base ref, RGBA, glow, and `default-only` grade; preserve literal
   TOK colors as source-known. Unknown/dynamic/conditional IDs, missing assets, and runtime mismatch remain explicit
   gaps.
4. **P4-P7 — Scene, Paint, Canvas, preview/editor.** Proceed serially after each upstream pair is accepted. Propagate
   color provenance and runtime gaps, add exact flat paint only where evidence permits, and retain diagnostic treatment
   for materials/glow/state/metrics. Every visible preview continues to carry `Not verified in game`.

Each code pair requires a causal fail-first receipt, its focused and coupled dependency matrix, typecheck and exact
lint/diff hygiene, immutable hash readback, and a fresh zero-write Luna audit before the next owner starts. Broad
precommit/oracle/E2E/build, installed-host inspection, deploy-byte proof, and X4 screenshot comparison stay locked until
all focused widget batches are accepted and the machine-state question is answered.

P1 execution started with exact native Luna `01a01611-35b0-72c3-86ec-b1e730b5a118`, owning only the CallModel pair.
Starting hashes are production `E0842D11D156764917DC36740294D43FA7CBCC75089C4B4187E17190DBF4CD4C` and selftest
`7CDB2CA96D5E545E1DAB4CDF44FF874CA507066373C8DBE818E43EBB3977D432`; coordinator baseline is `57/57`. No
candidate is accepted until a fail-first receipt, complete focused/coupled green matrix, exact containment, and fresh
zero-write audit are recorded.

Triggered AAR evidence retained for this unit: the revision-guarded Drive append refused because a concurrent writer had
already advanced the document; latest readback contained the intended equivalent checkpoint, so no retry or duplicate
entry was written. The first independent PowerShell XML census used the wrong assumed root and returned a false `1/1`;
inspection proved the root is `<colormap>`, and the corrected XPath census returned `224/804/0/0/0` for colors,
mappings, duplicate color IDs, duplicate mapping IDs, and invalid references. Do not bank or cite the failed selector.
Repeated blank native-worker waits are non-terminal mailbox timeouts, not worker-failure evidence; no interrupt or
fallback executor is authorized from elapsed time alone.

### P1 first CallModel candidate — real-source rejection — 2026-08-18

Status: `FINDINGS / REJECTED`; P2 and every downstream owner remain locked.

The worker captured a causal `57/65` fail-first receipt with eight named color families before production, then reported
CallModel `65/65`, LayoutProgram `565/565`, SourceEdits `62/62`, Lint `112/112`, typecheck, exact ESLint, and diff check
green. Coordinator reproduction matched those results. The exact candidate hashes are production
`D314F111E95385D57BF039A85C65360000551EB83C2BCA6B53FCA472FB4DB6B0` and selftest
`C7ABAC0785184B533251EFCB3A0635A2B4C7302F994F324FA269404FF7F8E3FA`; the worker's terminal receipt omitted the
production digest's final `0`, so its written hash is not accepted evidence.

The synthetic green does not cover the authoritative production shape. Public-model probes over the exact AI Influence
sources returned menu `23` total color records / `15` TOK uses, hub `56/50`, and comm `29/27`. Every direct stable
`TOK.member` example inspected remains `kind=unresolved` with reason `MemberExpression is not source-resolvable`.
Because P1 emits neither the resolved literal channels nor sufficient declaration provenance in that result, P3 cannot
recover the exact source-known RGBA without adding a second Lua parser. This is a release-blocking P1 failure, not a
permitted runtime gap.

Fresh zero-write Luna `01a0162c-5b40-74b2-9ec9-b90b938ecbaf` is auditing the complete candidate, including real
`TOK.member` and static-index variants, aliases and mutations, lexical/global `Color` shadowing, UTF-16 source identity,
all six color-bearing properties, deep freeze/JSON closure, and the non-enumerable per-property `colorExpression` versus
the enumerable top-level `model.colorExpressions` authority. Production stays frozen until the audit returns; the same
original worker may receive a targeted correction only after findings are reconciled.

The audit returned `FINDINGS` with no writes and exact hash/gate parity. It independently reproduced:

- **P1 real-source failure:** menu/hub/comm have `23/56/29` color records, `15/50/27` TOK-bearing records, and
  `11/35/20` direct stable `TOK.member` records; every direct row is unresolved and exposes no channel/declaration fact
  sufficient for a downstream consumer without reparsing Lua.
- **P1 duplicate authority:** projection `colorExpression` is public-but-non-enumerable, omitted by JSON, and attached
  to a mutable projection while the top-level sidecar is frozen. Mutating the projection name leaves the sidecar
  unchanged.
- **P1 weakened oracle:** an unmutated `validAlias` is deliberately required to remain unresolved, and the test labels
  the evidence serializable while explicitly requiring `Object.keys` to hide the per-property field.
- **P2 separate boundary:** direct BOM-prefixed CallModel input fails parse while CRLF/astral ranges pass. The accepted
  source-bundle adapter already uses an equal-length BOM parser sentinel; no active product path or real menu reproduced
  a BOM failure, so this remains a named deferred boundary rather than P1 scope expansion.

Original exact Luna `01a01611-35b0-72c3-86ec-b1e730b5a118` now owns the correction in the same two files. It must first
make the corrected TOK/single-authority cases causally red against rejected production, then remove all hidden projection
color fields, retain one frozen enumerable `model.colorExpressions` authority, and resolve stable inline/local-alias/
`TOK.member`/`TOK["member"]` literals through the existing object graph. Literal evidence must carry exact use and
declaration ranges plus channel/key ranges; pre-use direct/alias/branch mutations remain unresolved, while post-use
mutation cannot retroactively erase earlier exact evidence. Reconciliation below supersedes the original menu `11/11`
assumption after the real source proved two uses undeclared. P2 remains locked pending a new independent audit.

### P1 correction candidate and reconciled real-source contract — 2026-08-18

Status: `CANDIDATE / AUDIT ACTIVE`; P2 and downstream owners remain locked.

The tests-first correction produced causal `64/68` before production and now passes CallModel `68/68`, LayoutProgram
`565/565`, SourceEdits `62/62`, Lint `112/112`, typecheck, exact ESLint, and diff hygiene. Exact candidate SHA-256 values
are production `35A75178A444232D0EB41F0D8A65CDEDFFCC15A224467C35AAB121A2BF19EC6C` and selftest
`6DD840BB51E381EB754AB0440C06DBB4BBC846E632CC20FE55FCEEC752323E4B`.

Coordinator public-API probes over the exact installed AI Influence menu sources return total/TOK-bearing/direct TOK
color-expression counts of menu `23/15/11`, hub `56/50/35`, and comm `29/27/20`. Hub resolves all `35/35` direct
expressions to source-literal evidence and comm resolves all `20/20`. Menu resolves all nine declared direct values; its
two remaining direct expressions are `TOK.header` at lines 728 and 731. The source `TOK` declaration at lines 211-223
contains no `header` member. Those two calls are source defects, so unresolved/fail-closed is the only truthful result.
The previous `11/11` menu acceptance requirement is therefore superseded by `9/9 declared literal-table + 2/2 exact
undeclared unresolved`, while hub `35/35` and comm `20/20` remain unchanged.

Independent coordinator probes additionally establish that all 484 public property projections are ordinary enumerable
records with no hidden `colorExpression`; the original model sidecar arrays and every one of their 108 entries are
deeply frozen, plain, and enumerable-only; JSON round-trip is exact; all 66 real literal-table entries retain exact use,
declaration, channel, and key source slices; and no resolved/runtime/default/effective RGBA field exists. Two read-only
inline probe mistakes occurred before that receipt (one regular-expression quoting error and one `Array.every` callback
signature error); both failed before product assertions and were corrected without writes. Fresh zero-write Luna
`01a01654-41a8-7db0-8b9f-8bee0a5d4b43` is auditing the exact hashes and adjusted contract. P1 is accepted only on
`CLEAN`.

### P1 final focused acceptance — 2026-08-18

Status: `FOCUSED VERIFIED / CLEAN`; overall B119 remains `IN_PROGRESS / PARTIAL — Not verified in game`.

Fresh zero-write Luna `01a01654-41a8-7db0-8b9f-8bee0a5d4b43` changed no files and preserved production/selftest
SHA-256 `35A75178A444232D0EB41F0D8A65CDEDFFCC15A224467C35AAB121A2BF19EC6C` /
`6DD840BB51E381EB754AB0440C06DBB4BBC846E632CC20FE55FCEEC752323E4B`. It independently passed CallModel `68/68`,
LayoutProgram `565/565`, SourceEdits `62/62`, Lint `112/112`, typecheck, exact ESLint, diff hygiene, the adjusted exact
menu/hub/comm census, deep freeze/plain/enumerable/JSON checks, source range reconstruction, and hostile stable-alias,
pre/post-mutation, malformed table, dynamic key, and Color shadow/reassignment cases. No alternate projection-owned
color authority or runtime/default/effective RGBA claim remains. P1 is accepted; its two `TOK.header` gaps remain exact
source-defect diagnostics for the future linter and are not silently resolved.

The audit itself had non-product probe corrections: two inline quoting errors, one over-strict assertion, one incorrect
conditional/function-kind expectation, and the known graphify canonicalization failure. These are AAR triggers but do
not weaken the independent product result. Sustain exact hashes, public-API real-source census, and zero-write hostile
review. Improve future audit harnesses by using checked-in or quote-safe reusable probes instead of dense shell inline
scripts. Highest-risk evidenced weakness remains the installed mod's undeclared `TOK.header`: without this linter its
visible frame failure can point far away from the source error.

External projection was synchronized and read back in the same checkpoint: GitHub #41 comment `5333191082`; Notion
page `3b84618e-d15b-8190-821e-c0eb96f43d5a`; and Drive document
`17VLaIsT499KHg7zg30hOyLaBXB0-9jlrX3dQ63s3dtE` at returned revision
`AIroW36kbsNOqwpPsO6YTAqqGIUkQIXeOih56K-iaaNEI_1Vd9Jn-vqgTak39AoOfe5MrJnPI8gS_ZJjHu0ycvZWZvs9l_QufySQXDkR0z5K`.

### P2 reconciled implementation boundary — configured-corpus color evidence

Status: `FOCUSED VERIFIED / ACCEPTED`; P1 is accepted and exact native Luna
`01a01665-4e66-7712-856a-c4fb35e37b74` owned only
`src/lib/x4UiCorpusAssets.ts` and `src/lib/x4UiCorpusAssets.selftest.ts`. Starting SHA-256 values are
`F08195B48B858F4721A50CA946FA73672F87FD87C923CE5DFBD9D18F32BEC4D2` /
`33D12EF151CDB0163E9AB7CB61E20861C9041733763AF0F994CEB45EE0277F53`; baseline was `28/28`. P3 is unlocked.

No new directory discovery or backend endpoint is needed. `x4UiCorpusAssets` already reaches the user-selected unpacked
corpus through `/api/reference/status`, `/api/reference/manifest`, and `/api/reference/file`, with manifest-generation
coherence, size caps, UTF-8 checks, platform SHA-256, detached bytes, and loader-issued canonical authority. P2 must
extend that owner and reuse those exact transport/evidence helpers. It may not read the local filesystem in browser code,
introduce a second scanner, add a hard-coded `F:` path, or accept caller-supplied canonical hashes.

The existing six-asset canonical success shape is consumed by Scene and other accepted owners using exact-key checks.
Adding color fields to that default result now would deliberately break accepted coupled suites before their serial
owner stage. P2 must therefore expose color evidence through a distinct opt-in canonical result/function or an
equivalently non-breaking extension inside the same module, while preserving the existing loader's bytes, public shape,
authority behavior, and all current downstream tests. Later LayoutProgram/Scene integration will consume the opt-in
result under their own bounded owners.

Pinned inputs are `libraries/colors.xml` SHA-256
`6A57FE660D546F5144206581A40194CE13D0D11478B584A46467F0AAE715B883` and `libraries/colors.xsd` SHA-256
`F0D31824E00227EFF6288B084E29346C5AA9D2694BFB0D62D6008EE3DBD879DF`. The exact XSD defines ID pattern
`[a-zA-Z_][a-zA-Z0-9_]*`, integer `r/g/b/a` domain `0..255` with defaults `0/0/0/255`, and float `glow` domain `0..1`
with default `0`. Its keys require unique color IDs, unique mapping IDs, and every mapping `ref` to target a base color,
not another mapping. Canonical acceptance is exactly 224 colors and 804 mappings, with zero duplicate IDs, invalid base
references, or mapping chains.

The result must be detached, recursively frozen, plain/enumerable, JSON-stable default-only evidence with separate base
definitions and mapping references. It must carry both source identities and permanent `Not verified in game` /
`canonical-default-only` grading; it must not claim active profile, personal overrides, C++ effective map,
daltonization, widget state, material, texture, glow rendering, or engine acceptance. Required fail-first families include
both hash mismatches, malformed/truncated or wrong-root XML, missing/duplicate containers, duplicate color/mapping IDs,
invalid IDs, invalid/missing/non-finite/out-of-domain channels or glow, absent base refs, mapping-to-mapping refs,
generation drift, forged/structurally cloned authority, and exposed-byte mutation. Existing CorpusAssets `28/28`, all
current canonical consumers, typecheck, exact two-file ESLint, diff hygiene, immutable hashes, and a fresh zero-write
audit remain required.

P2 closed tests-first at production/selftest SHA-256
`FFC90BE312FFC3ACA728C039A00F6FE410F291EFBC49C3DF6D9775E24606D818` /
`AB57AE45BCBFB13D8B8A26D02425E4D25297E48874B74831C6F750D707326609`. The first candidate passed `36/36`, but
fresh zero-write auditor `01a0176b-8fee-7f01-8e1b-649bd39e71b2` found three real defects: malformed XML declarations
were accepted, an unbound XSD `schema` root was accepted, and the legacy six-asset Lua UTF-8 error contract drifted.
The correction captured those exact families fail-first at `36/39`, then passed CorpusAssets `39/39`, CallModel
`68/68`, EditorSession `7/7`, PreviewPipeline `94/94`, Scene `136/136`, PaintPlan `153/153`, CanvasRenderer `75/75`,
typecheck, exact two-file ESLint, and scoped diff hygiene. The existing six-asset loader shape and Lua error wording are
preserved.

The configured-corpus public loader was independently exercised over the exact pinned real corpus bytes: it made the
expected six transport reads, issued canonical authority, returned exactly 224 base colors and 804 mappings, and kept
`canonical-default-only` / `Not verified in game`. Final zero-write auditor
`01a01787-dd5b-7301-ae6d-ed97a1ea72f1` returned `CLEAN`; its separately authorized Scene fixture run passed `136/136`,
removed its unique temporary directory, preserved both final hashes, changed no file, and retained an exact 56-entry
repository status. P2 is accepted at focused scope; no active profile, C++ effective map, material, glow, widget-state,
or game-acceptance claim was added.

### P3 pre-reconciliation — color facts into LayoutProgram

Status: `FINDINGS / CORRECTION GATE`; P2 fixes the exact public input, but the first P3 focused-green candidate is not
accepted. Scene remains locked.

P3 extends the existing optional-input projection boundary; calls without accepted canonical color evidence must remain
byte-for-byte behaviorally identical. It consumes P1's sole `model.colorExpressions` sidecar by exact call source,
property name, and expression source. It may not reparse Lua, read XML, consult ambient UI state, or accept a structural
clone of P2 authority. Source-literal tables become known source facts only when P1 marked them `literal-table`;
symbolic `Color["id"]` becomes known only when P2 proves the ID and base mapping. Dynamic, conditional, function,
scalar, unknown-ID, malformed, or undeclared expressions remain explicit gaps.

The numeric domains remain distinct in the public fact. Shipped Helper line 8845 converts Lua color text alpha as
`color.a * 255 / 100`, and the real AI Influence TOK declarations use RGB `0..255` with alpha `0..100`. The pinned XSD
defines corpus XML `r/g/b/a` as raw `0..255`. P3 must retain an explicit source-literal-percent-alpha versus
canonical-XML-byte-alpha domain and raw values; it must not silently normalize or merge them. Paint/Canvas may later
derive browser opacity as `a/100` or `a/255` according to that domain under their own owners.

Read-only census gives a bounded real-source target: helper/widget contain 145 distinct textual `Color["..."]` IDs,
144 present in the canonical graph; the sole missing `foo` occurs only in commented example lines. The three active AI
Influence menus expose four symbolic color records, all known `text_inactive`; their remaining exact literal colors are
P1 TOK evidence. P3 tests must cover those real facts plus known helper defaults such as `table_background_default`,
unknown IDs, absent/forged/mutated P2 authority, mapping/base identity, source/declaration ranges, alpha-domain
separation, default-only provenance, no regression without the optional input, evidence-pair validation, and JSON/freeze
closure. It still cannot claim current C++ map, active profile, state colors, glow/material appearance, or game parity.

Exact native Luna `01a0179d-1fe2-7962-a07a-d1632e0aebcc` captured old LayoutProgram `565/565` plus new color assertions
at `4/18` green and 14 causal reds while production remained at
`334BBD62869559385537E610BEBD1B8FCBE24F5515357FE1C4C20EA674669A42`. Its candidate is production/selftest
`1761BBE388C16FA80C49DE6A1F8D26EAA558221CEBE142B2EFC1C97904DB093A` /
`E6FC8E440953DA665A7E9C748D4AAD8477AADDD4E8093A87C67064FC2D7CEFFA`, with LayoutProgram `583/583`, CallModel
`68/68`, CorpusAssets `39/39`, SourceEdits `62/62`, Lint `112/112`, typecheck, exact ESLint, and scoped diff hygiene
green. Those greens are insufficient.

Coordinator source readback reproduced a release-blocking `Port it, don't invent it` violation. Shipped Helper uses
`Color["row_background"]` at line 3200, `Color["text_normal"]` at line 3207 and nested textproperty line 3422, and
`Color["icon_normal"]` at line 3220. The candidate instead uses invented `cell_background_default` / `icon_default`
and substitutes `text_inactive`; the first two IDs are absent from the real pinned `colors.xml`. Its default-color test
asserts only that every result is known against a synthetic graph containing those invented IDs, so it cannot catch the
source mismatch. The candidate is rejected pending tests-first exact-ID correction. Fresh zero-write Luna
`01a01860-ac30-73a2-8aef-edfed9e884a5` is auditing the complete pair, P1 gap suppression, evidence schema/oracles, and
real corpus/source agreement before the original owner receives the correction. Native file-change readback confirms
the older row-receiver/conditional-cell hunks were present in the supplied starting hashes and were not P3 writes.

The zero-write audit is complete with `FINDINGS`, no repository writes, unchanged candidate hashes, and all existing
focused gates green: LayoutProgram `583/583`, CallModel `68/68`, CorpusAssets `39/39`, SourceEdits `62/62`, Lint
`112/112`, typecheck, exact two-file ESLint, and scoped diff hygiene. Those greens missed four additional P3 defects.
The expression/source-only suppression predicate can erase a forged non-color width gap; the pure evidence-pair schema
accepts consistently cloned color facts whose channel domains, top-level values, source identities, requested/base IDs,
or canonical pins are forged; a throwing `model.colorExpressions` container accessor escapes typed refusal; and the
post-authority-mutation selftest reads the original program instead of the rerun result.

The required real-source receipt also failed. A direct six-argument probe used genuine loader-issued 224/804 P2 evidence
over the exact MENU/HUB/COMM sources, but selected display targets produced zero known color facts; enabling local
expansion then self-refused on evidence-catalog reciprocity. The same audit separately proved that PreviewPipeline omits
the sixth color-evidence argument, while Scene accepts an unissued cloned no-color pair and its current generic fact
validator rejects known `color-object` facts. Those are downstream integration findings, not authority to expand the
two-file P3 owner.

Original exact Luna `01a0179d-1fe2-7962-a07a-d1632e0aebcc` is active on the tests-first P3 correction. It must use the
exact shipped defaults and distinct line-3422 nested-text pin, retain unrelated gaps, close semantic schema invariants,
contain hostile sidecar access, assert actual reruns, and fix the P3 local-expansion reciprocity mechanism. Coordinator
reproduction plus a new fresh zero-write `CLEAN` remain mandatory. The canonical raw NUL-delimited status receipt remains
56 entries, 2,279 bytes, SHA-256 `A644998111590D20DF8AED18DBC79C98F8D78946BED5CA1D8E691EAD861273A2`;
the auditor's larger newline-normalized byte count was not worktree drift.

### P3 final focused acceptance — 2026-08-19

Status: `FOCUSED VERIFIED / CLEAN`. Overall B119 remains `PARTIAL / Not verified in game`.

The correction preserved rejected production while the expanded selftest failed `579/603` with exactly 24 causal reds
across exact defaults/pins, non-color gap retention, hostile sidecar access, actual reruns, and semantic color-pair
closure. A later real-source discovery added a second fail-first receipt at `603/604`: the static preview-path catalog
retained descendant invocation IDs absent from the bounded expansion ledger, so MENU self-refused on evidence
reciprocity. The narrow correction emits only catalog invocation IDs reciprocal with the exact ledger. Final hashes are
production `F2E877693DAD16ACF59846E26FEC2BDE8FCE7C69AC1D86623A2F3109D5CD6D17` and selftest
`758C622CF0289F231AF710B9EC8EEB86AAC12773F4B2D1A79757F5B0A03353B8`.

Coordinator reproduction passed LayoutProgram `604/604` with historical Phase 3D `15/15`, 3G `49/49`, and 3J
`11/11`; CallModel `68/68`; CorpusAssets `39/39`; SourceEdits `62/62`; Lint `112/112`; typecheck; exact two-file
ESLint; and scoped diff hygiene. The owner and fresh zero-write auditor independently loaded genuine P2 authority from
the pinned XML/XSD at exactly 224 bases / 804 mappings. With `maxDepth=4` and `maxInvocations=64`, both reproduced:

| Target | Expansion expanded/rejected/conditional/unreachable/looped | P1 -> projected TOK gaps | Known color facts | Pair |
|---|---:|---:|---:|---|
| MENU | 7/35/76/1/25 | 6 -> 5 | 0 | valid |
| HUB | 6/10/8/1/1 | 11 -> 0 | 0 | valid |
| COMM | 5/14/7/1/2 | 7 -> 0 | 0 | valid |

Fresh auditor `01a018bf-ac7d-77d1-aae8-0e85571516b0` returned `CLEAN` with zero writes and exact 56-entry /
2,279-byte / `A644998111590D20DF8AED18DBC79C98F8D78946BED5CA1D8E691EAD861273A2` raw status parity. Its coordinated
eight-fact clone mutation passed pure semantic pair validation but failed `isIssuedX4UiLayoutEvidencePair`; that is the
intended separation and makes Scene's missing issuance check a downstream blocker rather than a P3 defect. The audit's
first OS-temp probe paused on a hidden mandatory approval, was abandoned with zero artifacts, and a no-temp inline probe
then produced the exact real-source receipt. The LayoutProgram selftest's roughly 50 MB successful output is a tooling
debt/AAR item, not a failed oracle.

P3 is accepted. The next bounded integration must carry loader-issued color authority through the existing
SourceEditor -> EditorSession -> PreviewPipeline chain into the sixth LayoutProgram input. A disjoint Scene owner must
require issued-pair authority, admit known color-object facts, expose base tint separately, and retain material, texture,
glow, active/hover/selection, C++ effective-map, and game-acceptance gaps. No capability-map delta yet.

### Scene/Paint pre-reconciliation — known tint is not complete material truth

Status: `P4 SCENE ACCEPTED / CLEAN`; P3 is accepted. Final Scene production/selftest hashes are
`FE85C52848C7643EA6B5195FCA4C4270E7036F763BE756CB48327D599050BF99` /
`34A4D496C968366A18DB6023D2F6BD91F50C2C1A066F6D75BC0944F49FF35C8F`; coordinator validation passed Scene
`139/139`, typecheck, exact ESLint, and diff hygiene, and final zero-write Luna
`01a01938-d17c-76a2-9e17-d910b66e9e80` returned `CLEAN`. Paint and Canvas remain serially locked behind P4.5.

Color availability alone must not erase existing paint/state/material gaps. Shipped Helper passes row/cell backgrounds
through direct `SetTableCellColor` and text through direct color channels, so those can carry a known base color while
retaining separate glow/font-rendering limits. Buttons and edit boxes pass background/highlight/border colors into C++
widget descriptors, where active/inactive/hover selection is runtime state; tables pass `backgroundID` plus
`backgroundColor` into `CreateTable`, where the material/texture behavior is not present in Lua. For example, canonical
`table_background_default` resolves to opaque white, which is a tint fact and plainly not proof that the visible table
surface is an opaque white rectangle.

Scene must therefore store color facts separately from completeness and retain diagnostic links for unknown state,
material, texture, and glow. Paint may emit a base-state preview tint only with explicit provenance and partial status;
it may call a surface `complete` only when every relevant primitive and state input is source/corpus-known. Canvas must
consume the typed alpha domain, never substitute its diagnostic palette as X4 color evidence, and keep
`Not verified in game` visible. X4 screenshots remain the oracle for material/state appearance.

P4 owns only `src/lib/x4UiScene.ts` and `src/lib/x4UiScene.selftest.ts`. Its fail-first contract covers the currently
accepted coordinated-but-unissued LayoutProgram/evidence clone, the currently refused issued known color-object facts,
exact per-owner/slot retention for table, cell, widget and nested text colours, hostile closed-schema inputs, and the
coexistence of known base tint with unresolved material/state/glow/game gaps. It may add a typed Scene colour-fact
contract even though current Paint exact-shape validation will intentionally refuse colour-bearing Scene until P5;
hiding values only in provenance links to preserve an obsolete downstream shape is not acceptable. Existing no-colour
issued paths must remain green. P5 will then update the Paint pair against the accepted P4 shape; P6 updates Canvas;
only after both are accepted may the configured colour loader be wired through SourceEditor, EditorSession and
PreviewPipeline.

### P4.5 reconciliation — public Paint authority requires Preview colour ingress

Status: `FOCUSED VERIFIED / CLEAN`. Final production/selftest hashes are
`CF429EB982BED6C424DCB778AC7D184EBABDA4C9330364DAC12431BCA223CA82` /
`5D85E9810C9776B87D24A8EFFF6AF57740534998E0D4AC8C7B3EEABEFA328324`. Baseline `94/94` plus new tests against
unchanged production produced exactly four reds at `98/102`; final Preview is `102/102`, Scene `139/139`,
LayoutProgram `604/604`, with typecheck, exact ESLint, and diff hygiene green. Fresh zero-write Luna
`01a01955-12ed-73a2-9c8e-06b8a4130d8b` returned `CLEAN` with no findings or writes.

The original P4 -> P5 ordering omitted an authority dependency. `projectX4UiPaintPlan()` accepts only the exact Scene
privately issued by `projectX4UiPreviewPipeline()`, while Preview currently calls `projectX4UiLayoutProgram()` with five
arguments and omits the sixth colour-evidence input. A direct Scene fixture, cloned Preview result, or test-only Paint
bypass would therefore prove a surrogate contract rather than the public path. P5 cannot honestly go green until a
colour-bearing Scene can be issued by Preview.

P4.5 is the narrow prerequisite and owns only `src/lib/x4UiPreviewPipeline.ts` and
`src/lib/x4UiPreviewPipeline.selftest.ts`. It adds an optional loader-issued colour-evidence input and forwards that
exact value as LayoutProgram's sixth argument. It does not discover files, load the configured corpus, change
EditorSession/SourceEditor, paint pixels, or relax LayoutProgram's existing authority checks. Tests must begin red
against unchanged Preview production and prove that an issued `224`-base / `804`-mapping authority reaches exact
LayoutProgram facts, Scene owners, and the existing private Preview-to-Paint authority boundary. Absent evidence must
preserve the current no-colour path; forged, cloned, malformed, stale, or unissued evidence must not create known colour
facts; every outcome remains `Not verified in game` / `gameVerified=false`.

The corrected serial order is P4 Scene -> P4.5 Preview ingress -> P5 Paint -> P6 Canvas -> P7 configured loader and
SourceEditor/EditorSession wiring. This is a reconciliation-driven acceptance-contract change, not a scope expansion:
it closes the already-required public authority path and prevents Paint tests from passing through a test-only bypass.

### P5 specified contract — source-backed base tints in the public Paint plan

Status: `FOCUSED VERIFIED / CLEAN`; P4.5 passed coordinator reproduction and a fresh zero-write audit.

P5 owns only `src/lib/x4UiPaintPlan.ts` and `src/lib/x4UiPaintPlan.selftest.ts`. It must consume a colour-bearing Scene
through the exact P4.5 Preview authority; a direct Scene call, cloned authority, internal-validator export, or test-only
Paint issuer is not acceptance evidence. Current Paint `153/153` is the no-colour baseline and must remain green.

Paint must validate the complete P4 Scene colour-fact shape and copy each fact into an explicit immutable
`base-preview-tint` command payload. The payload retains field, slot, raw value and domain, provenance, expression,
source, optional source pin/sample, and `Not verified in game`; it also states `partial` colour completeness. No RGBA or
CSS normalization occurs in Paint. A node-geometry command carries every exact tint owned by its table, cell, widget, or
text node. Each glyph command additionally carries the one exact tint owned by its parent text slot. Button highlight
and border, icon tint, and other non-base-state facts remain present as typed payloads even when Canvas cannot yet draw
their unresolved material/state primitive.

Known tint must never remove Scene's runtime/material/state/glow/C++/font/game diagnostics, promote a node or plan to
complete, or replace Paint's unsupported-runtime diagnostics. Missing/unavailable colour remains diagnostic-only and
must not generate a tint payload. The four accepted layer identities and global command ordering remain unchanged.
Current Canvas exact-command validation is expected to refuse colour-bearing Paint until P6; hiding tint to preserve
that obsolete shape is forbidden.

Tests start red against frozen Paint production and must prove all table/cell/button background/highlight/border,
editbox, icon, direct-text, and nested primary/secondary owner paths through the exact public
Preview -> Paint authority. They also prove raw percent-alpha versus byte-alpha retention, full provenance, immutable
detachment, omission behavior, malformed colour refusal without observation, continued copied-authority rejection,
partial truth, four-layer ordering, and no regression in the existing 153-case hostile/keep-out/selection matrix.

P5 acceptance receipt, 2026-08-19: the public colour-bearing fixture issued ten exact Scene owner facts. With Paint
production frozen, the expanded selftest was `159/165`, with exactly six causal reds for projection, owner retention,
glyph inheritance, partial truth, no-colour compatibility, and immutable detachment. Final Paint is `165/165` at
production/selftest hashes `9FDBE53D68F516DD36670ABC1DF75F65611F81C3EA34E99BEA546EE905005A85` /
`A0680C4B1B748695EE59BB63858B11A7693D3721CE2F09BB8C101E46B46799BF`. Coordinator reruns passed Preview `102/102`,
Scene `139/139`, typecheck, exact-pair ESLint, and diff hygiene. Canvas remained the expected pre-P6 `70/75` boundary.
Fresh zero-write Luna `01a0198b-0877-76e2-b229-988ca8ce9e7b` returned `CLEAN`, confirmed the supplied hashes and outside-
write hygiene, and reported no findings. P5 is accepted; it does not establish Canvas pixels, browser rendering, game
frame acceptance, or in-game parity.

### P6 specified contract — typed Canvas tint consumption without an engine-parity claim

Status: `FOCUSED VERIFIED / ACCEPTED`; browser, package, deploy, C++ frame acceptance, and X4 remain open.

P6 owns only `src/lib/x4UiCanvasRenderer.ts` and `src/lib/x4UiCanvasRenderer.selftest.ts`. The frozen starting hashes
are Canvas production `CF7AFAF3ED76E98DF27CAE5143E04B4E8E97D48704ADE261A4C8CBABBE9A8AC2` and selftest
`B45116AB3455317F25DE641C9F9D1687B59820D817D8CE596EF679D8E1C6228F`. It extends the existing strict Paint-result
validator, detached command snapshot, renderer-owned atlas staging, four fixed layers, and deterministic trace. It must
not introduce a second renderer, consume Scene/Layout evidence directly, mislabel a structurally accepted Paint-shaped
value as producer-origin-authenticated, or weaken the post-validation mutation boundary. The accepted Batch 6D Canvas
contract is deliberately structural and explicitly lacks producer-origin authentication; exact hostile structural
copies must continue reaching the Canvas validator so malformed payloads are rejected causally.

Reconciliation correction, 2026-08-19: the original P6 sentence incorrectly required rejection of every structural
Paint clone. That contradicted the accepted Batch 6D record and permanent positive structural-boundary test. The
acceptance contract above restores the existing architecture; this is a non-clean documentation correction, not a
new authority claim or a weakened payload/post-callback check.

The present Canvas result is `70/75`, but those five rows are one stale literal-trace cascade: P4 added two accepted
owner-linked unavailable-colour diagnostics to the no-colour Scene, taking the fixture from 73 commands / 403 composite
operations to 75 / 417. The raw plan still renders and no tint-bearing Canvas fixture is exercised. P6 must first prove
that exact upstream delta and correct the trace oracle with Canvas production frozen, restoring the existing 75 rows.
It must then add a public configured-colour Preview -> Paint -> Canvas fixture and capture a separate fail-first receipt
against unchanged Canvas production. A test-only golden correction is not evidence that tint rendering works.

Canvas admits `base-preview-tint` only as the exact optional P5 payload on geometry and glyph commands. Admission is a
closed own-data validation of every nested fact and retains the raw Paint object unchanged. At the rendering boundary
only, source-literal alpha derives as `a / 100`; canonical XML alpha derives as `a / 255`. RGB channels remain their
validated `0..255` values. The two domains remain distinguishable in validation and tests; Canvas must not silently
clamp, merge, reinterpret, or write normalized values back into Paint evidence. Glow is retained evidence but is not a
drawable colour channel and must not affect pixels.

Known table-background, cell-background, and widget-background slots replace the diagnostic fill for their exact owner
geometry. A widget-border slot adds an outline on that same geometry. Widget-highlight is retained but is not painted as
the active base state because hover/selection state is unavailable. Widget-icon remains diagnostic-only because its
texture/mask/material is unavailable. Text tint applies only to glyphs owned by that exact primary or secondary text
node. Untinted geometry and glyphs retain the existing diagnostic palette and exact no-colour behavior.

Tinted glyphs use deterministic renderer-owned A8 atlas staging keyed by canonical font identity plus exact drawable
tint. Their RGB bytes come from the accepted tint; each staged pixel alpha is the canonical A8 byte multiplied by the
typed derived alpha with one documented deterministic byte-rounding rule. Distinct primary/secondary tints must not
share a staged surface accidentally. Repeated identical tints may reuse a renderer-owned surface. No caller surface,
CSS parser, global composite state, material, texture, active profile, daltonization, C++ colour map, or font-engine
behavior may be inferred.

Acceptance requires causal coverage for both alpha domains; exact table/cell/button/editbox background; button border;
withheld highlight and icon paint; direct, primary, and secondary text; tint-specific atlas bytes and reuse; clipping;
four-layer/global command order; deep detachment; accessor/proxy/prototype/symbol/sparse/duplicate/reassigned/extra-key
refusal before allocation; callback mutation refusal; unchanged no-colour trace; unchanged keep-outs/diagnostics; and
permanent `Not verified in game` / `gameVerified=false`. Focused Canvas, Paint, Preview, and Scene suites, typecheck,
exact-pair ESLint, diff hygiene, and a fresh zero-write Luna audit must pass before P6 is accepted. Real browser pixels,
packaged Forge UI, and X4 remain later validation layers.

P6 audit rejection, 2026-08-19: the first colour-bearing Canvas candidate is not accepted despite focused green. The
candidate is Canvas `100/100` with Stage-B `25/25` at production/selftest hashes
`490F430673C51957751A3113C68046A10C811F355A349FDDBC2C064AB119DBB3` /
`CB8D89BEE59294BE7E28BE9CD6171B160ADF8F9AA31784448A50A993AE69D4C2`; Paint `165/165`, Preview `102/102`, Scene
`139/139`, typecheck, exact-pair ESLint, and diff hygiene also pass. Fresh zero-write Luna
`01a019d2-fc1c-7223-b008-ee7a2403ab69` preserved every hash and reproduced three producer/consumer mismatches: Canvas
accepts string and full-location `sourcePin` forms that P5 cannot emit; containment ignores `sourcePath`; and a
`mappingSource` can accompany `requestedId === resolvedBaseId` even though Scene refuses that relationship. The audit
also found no independent causal row for duplicate/reassigned tint facts or slots.

The next bounded correction keeps production frozen at `490F4306...19DBB3` while tests first replace the impossible
positive `sourcePin` fixture with the exact `{sourcePath,lineStart,lineEnd}` contract and capture causal reds for hostile
string/full-location pins, `sourcePath` drift, same-ID mapping provenance, and duplicate/reassigned facts. Production may
then narrow only those three validators. The original implementation receipt is permanently non-clean: a complete
`76/86` fail-first result exists in worker chronology for ten initial Stage-B behaviors, but no durable repository
receipt proves red chronology for the fourteen later rows, including the explicit half-up byte-rounding change. Do not
rewrite that history or label the final 25-row matrix fully tests-first. The correction needs a new exact red receipt,
full focused/coupled green, immutable hashes, coordinator reproduction, and another fresh zero-write audit.

P6 correction fail-first receipt, 2026-08-19: the first tests-only run printed `107/113`, Stage-B `32/38`, but four of
its six rows had `mutationApplied=false`. The worker incorrectly treated the row names as a valid receipt and changed
production before coordinator review. The coordinator detected the hash drift, interrupted writes, preserved the
evidence, and required an exact byte recovery. Forensics over the retained patch preimage showed that the attempted
inverse had only split one frozen condition across two lines; a one-line recovery restored exact production
`490F430673C51957751A3113C68046A10C811F355A349FDDBC2C064AB119DBB3`.

With corrected mutation construction and production frozen, the authoritative fail-first checkpoint is selftest
`F401AE90628E26D261AEBD0D4C785B247ED6C022E0086765F04EF334C0BE4351`: Canvas `107/113`, Stage-B `32/38`, exactly six
causal reds for string and full-location pins, declaration/channel/key `sourcePath` drift, and same-ID mapping
provenance. Every row reports `mutationApplied=true` and the old production incorrectly completes the full render
(`5` factories, `20` dimension reads, `5` contexts, `570` paint operations, `4/4` image-data stage/put, `48` fills,
`25` draws, `1` stroke) instead of pre-allocation refusal. Offset, glow, duplicate-fact, reassigned-owner, and
duplicate-slot rows are explicitly already-green strengthening coverage. Only the three-validator production repair is
authorized next; this interruption/recovery remains a non-clean AAR trigger even if final validation passes.

P6 final acceptance receipt, 2026-08-19: fresh replacement Luna `01a01a8e-7caf-7b61-b62b-0f3cd927616d` applied only
the three authorized production validators; typecheck required three compile-only `unknown` narrowings in the new
offset-strengthening rows. Final production/selftest hashes are
`C7B277D7A471C77A352A184881015E1F3C5C867CE1443108D84CE965D2278B94` /
`FC493F3B263C9A1340A3E2BB264DAFBFDDBB9043CCB265C16343797CAC9CAE9C`. Worker and coordinator independently passed
Canvas `113/113` with Stage-B `38/38`, Paint `165/165`, Preview `102/102`, Scene `139/139`, typecheck, exact-pair
ESLint, diff hygiene, and exact hashes. Fresh zero-write Luna `01a01a94-1779-7d80-965a-cae9d3278d53` returned
`CLEAN`: no files changed; pre/post raw status stayed 56 entries / 2,279 bytes /
`A644998111590D20DF8AED18DBC79C98F8D78946BED5CA1D8E691EAD861273A2`; all protected hashes and
`HEAD === origin/main === 77138741a9f470e2c6c37c2d6857688dd1e2b13e` matched. It independently supported exact pin shape,
`sourcePath` containment, mapping provenance, coherent structural clones, mutation/refusal, quantization, withheld
highlight/icon tint, no-colour trace, and permanent game-truth boundaries. P6 is accepted at focused scope. The original
25-row chronology and premature-edit recovery remain non-clean history; acceptance does not establish browser pixels,
packaged Forge rendering, C++ frame acceptance, or in-game parity.

### P7 specified contract — configured colour authority through SourceEditor and EditorSession

Status: `SPECIFIED / ACTIVE`; P6 passed coordinator reproduction and a fresh zero-write audit.

Frozen P7 baseline, 2026-08-19: SourceEditor production/selftest are
`B085A0A542D6B17E287DE52CB19452D2E75D67ACA15454274D61D20C3E85C3C2` /
`9FF34E6471C045CB4FC7F3A2CEAF94391548967D8E5BFE2F20D8994F79EFE3ED`; EditorSession production/selftest are
`20B7429079DA6C7297A505667C07C1FDD015827839BB468C4412402E7E7D5AF0` /
`49C10D546016338A2E482D26D0B48187B0CD53366A7F9D3EC2F0EF613DC6F518`. Coordinator baseline passed EditorSession
`7/7` and the complete SourceEditor SSR/authority/CAS/manual-calibration matrix. These exact hashes are the P7
tests-first starting boundary; P6 acceptance now unlocks only the four declared P7 files.

Reconciliation found one missing public seam, not a missing subsystem. `x4UiCorpusAssets.ts` already owns both pinned
configured loaders, and `X4UiSourceEditor.tsx` already owns the bounded status/manifest/file transport and the single
configured-corpus request lifecycle. `x4UiPreviewPipeline.ts` already accepts the exact optional P2 colour authority.
The remaining gap is that SourceEditor calls only `loadConfiguredX4UiCorpusAssets()`, while `X4UiEditorSessionInput` and
its two Preview projections carry only the six-asset corpus. P7 extends those existing owners; it must not add another
transport, endpoint, renderer, colour parser, or authority brand. No capability-map delta is expected.

P7 owns only `src/components/X4UiSourceEditor.tsx`, `src/components/X4UiSourceEditor.selftest.tsx`,
`src/lib/x4UiEditorSession.ts`, and `src/lib/x4UiEditorSession.selftest.ts`. The configured default loader must invoke
the existing core and colour loaders over the same bounded transport and abort signal. Its result keeps the two issued
authorities distinct. The core result remains the geometry/font authority; the colour result remains optional
canonical-default-only evidence. Existing custom `corpusLoader` callers that return only an exact loader-issued core
result remain compatible and must be reported as core-canonical with colour unavailable, never as colour-canonical.

SourceEditor classification must inspect only own enumerable data properties without invoking accessors. An exact
core-plus-colour result accepts both authorities. Exact core success plus a refused, malformed, stale, offline, late,
aborted, or absent colour result keeps the core usable and exposes a separate visible colour status/detail. Colour
success without exact core success cannot make the editor canonical or paintable. Structural copies, inherited values,
accessor wrappers, extra/reassigned nested values, throwing or revoked reflection traps, and stale request generations
cannot become either authority. Classification snapshots exact own data descriptors once, invokes no `get` trap, never
retains the outer envelope, and preserves only exact loader-issued inner core/colour authorities. A transparent get-only
Proxy facade around that exact envelope is therefore admissible but grants no authority of its own; accessor,
inherited, decorated, structural-clone, reassigned, throwing-`ownKeys`, throwing-`getOwnPropertyDescriptor`, and
throwing-`getPrototypeOf` forms refuse safely. Reload/abort handling remains one request generation, and both results
are discarded together when late.

EditorSession adds one optional colour-evidence input and safely snapshots only its own data descriptor. It forwards
the exact still-valid loader-issued authority unchanged into both the catalog Preview and the selected/sample Preview;
it never reparses, clones, brands, or discovers colour evidence. Missing or invalid colour evidence degrades to the
existing source-backed no-colour path without manufacturing tints. Valid evidence must reach the already-accepted
Layout -> Scene -> Paint chain and produce the exact owner-linked partial base tints; Paint still receives colour only
through Preview authority. Every session and UI state remains `Not verified in game` / `gameVerified=false`.

Tests must start red with all four production files frozen. Required causal families are: configured default dual-load
over the existing allowlisted endpoints; legacy custom-loader compatibility; exact dual-authority acceptance; core
success with colour offline/refused/malformed/stale; colour success with core failure; abort/late/reload discard;
accessor/inherited/decorated/clone/reassignment and throwing-reflection refusal without reads or false colour claims;
transparent-facade detachment with zero `get` trap reads; exact authority identity through both Session Preview passes;
selected and sampled public paths producing the expected Scene/Paint tint owners; unchanged
no-colour rendering; and permanent game-truth labels. Focused SourceEditor and EditorSession suites plus CorpusAssets,
Preview, Paint, Canvas, typecheck, exact four-file ESLint, diff hygiene, and a fresh zero-write Luna audit must pass.
Browser-rendered status/pixels, production build, installed Forge, and X4 screenshot comparison remain later broad/live
gates. Rollback is the exact four-file diff; no corpus, workspace, mod, game, or standing configuration bytes are written.

P7 fail-first receipt, 2026-08-19: both production files remained exact at SourceEditor
`B085A0A542D6B17E287DE52CB19452D2E75D67ACA15454274D61D20C3E85C3C2` and EditorSession
`20B7429079DA6C7297A505667C07C1FDD015827839BB468C4412402E7E7D5AF0`. Tests-only hashes are SourceEditor
`ABFB4C59E81BF171FB1AE88978EE64823024A0A5CBA82F6AD62078D366294339` and EditorSession
`09C753537C69FB60A84435C7D33F91309CD34FFC06754C8572B42BE5BA16D86B`. Existing SourceEditor and Session `7/7`
matrices remained green; typecheck, exact two-test-file ESLint, and diff hygiene passed. The new P7 matrix is `4/19`,
with exactly fifteen behavioral reds: SourceEditor `1/12` and EditorSession `3/7`.

The eleven SourceEditor reds cover the missing shared-signal dual loader, exact dual classification, legacy core-only
colour-unavailable state, independent absent/offline/thrown/malformed/stale colour handling, hostile envelope safety,
late/abort/reload lifecycle, and visible separate colour detail. Its color-without-core rejection is already green. The
four Session reds cover selected and sampled owner-linked tints, separately observable issued catalog/final coloured
outcomes, and a sampled one-descriptor TOCTOU facade. That facade preserves keys/descriptors and proves catalog issuance,
sample reconciliation/binding consumption, and post-call stability under old production, but reports exactly zero
`colorEvidence` descriptor reads and no final colour owners. Invalid colour degradation, color-without-core refusal, and
permanent game truth are already green. No production test hook is required: production must capture the descriptor
once, and source review plus the real sampled outcome must prove the captured local reaches both existing Preview calls.

P7 envelope reconciliation correction, 2026-08-19: the first SourceEditor hostile-envelope oracle was internally
contradictory because portable JavaScript cannot distinguish a transparent Proxy from its target through safe own-data
descriptor reflection while also guaranteeing zero trap invocation. Production remains frozen. The test must instead
prove the safe enforceable boundary above: one detached descriptor snapshot, zero `get` reads, exact inner-authority
identity only, transparent-facade admissibility, and safe refusal of accessor/inherited/decorated/clone/reassigned and
throwing-reflection forms. A revised causal red receipt is required before production implementation is authorized.

Revised P7 fail-first receipt, 2026-08-19: SourceEditor selftest is now
`6213F20B263855A1DA725C9A0CDAC4E6A9FE0FA5A88079E287DFFE17FAD11D05`; EditorSession selftest remains
`09C753537C69FB60A84435C7D33F91309CD34FFC06754C8572B42BE5BA16D86B`. Coordinator reproduction preserved exact
production hashes `B085A0A5...5C3C2` / `20B74290...AF0`, the complete pre-P7 matrices, typecheck, exact two-test-file
ESLint, and diff hygiene. The P7 census remains SourceEditor `1/12`, EditorSession `3/7`, aggregate `4/19`. The revised
envelope row is genuinely causal: current production performs eight direct `get` reads, accepts no dual authority, and
does not exercise the intended reflection boundary; the transparent exact facade, five negative forms, and three
throwing-reflection cases therefore remain red for the specified reasons. Production implementation in the two declared
owners is now authorized; tests may change only for compile/correctness, not to weaken this receipt.

P7 focused candidate, 2026-08-19: SourceEditor production/selftest are
`F4CF7F877A149A691E2D8FB05511DF3D1191A30D305EE92209830725F229D662` /
`3A90005C647EDB6724A6B0F38CECF646B68E5F4C378985ED9B991D2EE328F5E4`; EditorSession production/selftest are
`990B1338BEF3F2CA14857EA236B517EF9DE23CC4884F60987A206C78BE4E8213` /
`A7FCAAE150E2EC85BE67F949BF7962E4726277C544E38135BBA2C0BAB66CAC29`. Worker and coordinator independently pass
SourceEditor P7 `12/12`, EditorSession baseline `7/7` plus P7 `7/7`, CorpusAssets `39/39`, Preview `102/102`, Paint
`165/165`, Canvas `113/113`, Scene `139/139`, typecheck, exact four-file ESLint, and exact diff hygiene. The transparent
envelope executes zero `get` traps and preserves only exact detached inner authorities; five hostile envelope families
refuse with zero getter reads; all three throwing-reflection controls are contained at exactly one relevant trap. The
Session descriptor facade reads `colorEvidence` exactly once and the same captured authority reaches both catalog and
final Preview owner-linked tints. Exact core plus independently aborted colour now remains core-usable with colour
unavailable, its original detail, and no colour authority.

One tests-only fixture correction was necessary: both P7 Lua fixtures used `row[1]:setColSpan(2)` and then populated
`row[2]`, creating an overlapping cell that the accepted Layout/Scene owners correctly dropped. Changing those two
fixture spans to `1` made the already-specified button/text owners reachable without changing expected owners or row
counts. Session sample binding now keys the selected target plus issued sample catalog rather than colour-resolved full
program data, so adding colour evidence does not falsely stale orthogonal layout samples while profile/selection/catalog
drift remains guarded. Fresh zero-write audit is still required; browser pixels, build/package, installed Forge, deploy,
and X4 remain unverified.

AAR trigger: after the first green worker receipt, a coordinator-found independent-colour-abort defect was sent back.
The Luna worker incorrectly attempted nested Sol-Luna routing and entered `waitingOnApproval`. Runtime thread metadata,
not elapsed time or file timing, reproduced the blocker. The coordinator interrupted only that workflow violation and
returned the correction to the existing Luna owner; no additional implementation agent or approval was needed.

P7 fresh-audit result and correction contract, 2026-08-19: zero-write Luna
`01a01af6-6d38-7870-ab01-a4b64912ce08` returned `FINDINGS`. It preserved all four candidate hashes, the 57-row
unstaged worktree, every focused count, typecheck, exact lint, and diff hygiene; `graphify` failed before execution with
`Failed to canonicalize script path`, so the reviewer used direct source inspection. The implementation remains a
focused-green candidate but is not accepted because four test-proof gaps remain:

- the default-loader row always resolves an offline response and therefore proves neither concurrent branch start nor
  rejection isolation; a `Promise.all` regression could pass;
- the hostile-envelope matrix has throwing reflection proxies but no actually revoked `Proxy.revocable` envelope;
- the Session colour-owner oracle proves only at-least-one presence, not exact frame/table/row/cell/widget/text/tint
  counts, so duplicate geometry or owner facts could pass after the fixture colspan correction; and
- SSR/pure classification does not mount the React component across delayed reload, abort/rejection, and cleanup, so a
  stale effect write could regress without detection.

The narrow correction is tests-first and must not change the current P7 production hashes. It may edit the two existing
selftests plus one focused existing-host Playwright spec under `tests/e2e/`; it may not add a DOM package, test-only
production hook, endpoint, transport, renderer, or authority brand. The SourceEditor selftest must use controlled
deferred transport calls to prove both configured loaders overlap, then reject one branch while the other reaches exact
canonical authority. It must classify a revoked facade without outward throw or authority. The Session selftest must
lock exact projection geometry and owner/tint cardinalities and include mutation sensitivity for duplicate or drifted
facts. The browser spec must mount the real SourceEditor in Forge's existing Vite/Playwright host, delay configured
corpus requests across Reload, force one rejection/abort, unmount with another request outstanding, and prove the late
generation cannot overwrite current UI or produce an uncaught error. This focused browser spec becomes applicable P7
evidence because the audit showed the prior pure surrogate was insufficient; the broader E2E suite, build, installed
Forge, deploy, and X4 remain later gates. Require coordinator reproduction and another fresh zero-write `CLEAN` audit
before P7 acceptance. Overall B119 remains `PARTIAL / Not verified in game`; no capability-map delta.

P7 audit-proof correction candidate, 2026-08-19: native Luna `01a01b0b-6f60-7c82-93ba-d7282939cab4` changed only
the two selftests and new `tests/e2e/x4-ui-source-editor.spec.ts`. Frozen production stayed exact at SourceEditor
`F4CF7F877A149A691E2D8FB05511DF3D1191A30D305EE92209830725F229D662` and EditorSession
`990B1338BEF3F2CA14857EA236B517EF9DE23CC4884F60987A206C78BE4E8213`. Final test hashes are SourceEditor
`59D66E776C95C7A5EF175F315840F07A95437DE302EF43D09235DAAADAFF1812`, Session
`71356DBE3B1A5DB7DE345D8EF49A2A94E6806122693C7D476F12F8F7B5FC8FED`, and Playwright
`FF14DAC4D5F69AEF39243478CEFB440624D868DEF98EB9F65ED5F855F835220C`.

The strengthened default-loader oracle now requires both configured branches to issue status work before either
settles, rejects one transport branch, and proves the other still reaches one exact canonical authority as an ordinary
all-settled pair. A sequential implementation times out the row and `Promise.all` rejection fails it. The hostile
matrix now classifies an actually revoked `Proxy.revocable` envelope without outward throw or authority. Selected and
sampled span-1 fixtures have separate measured shape oracles and duplicate/drift sensitivity. Both project exactly one
frame, one table, one row, four cells, four widgets, six texts, thirteen Scene colour facts, and thirty-two Paint tint
attachments; their exact owner multiplicities differ legitimately because sampled dynamic text resolves canonical
primary colour where the selected fixture retains a source-literal primary colour.

The new Playwright spec uses the real seeded Forge app and `[data-workspace-view="ui-designer"]`; it delays both initial
`/api/reference/status` requests, reloads into a controlled current 503 generation, settles the old generation late and
aborted, verifies core and colour status/detail do not regress, retains exact `Not verified in game`, then unmounts via
the Blueprint view with another generation outstanding and requires no page error or remount. This spec is authored but
not yet executed: the project machine-state ask is mandatory before Playwright starts the ephemeral 3100/3101 stack.
Focused SourceEditor is `12/12`; Session baseline/P7 is `7/7 + 7/7`; typecheck, exact three-file ESLint, and exact diff
hygiene pass. An intermediate typecheck rejected an unsupported Playwright `toHaveText(..., { exact })` option; the
test retained exact anchored/string assertions using the installed API and the final typecheck is green. Status remains
`PARTIAL / candidate` until the focused browser spec runs and a fresh zero-write audit returns `CLEAN`.

P7 mounted-oracle static review correction, 2026-08-19: coordinator review found that the first Playwright candidate
made both colour test IDs optional, so removing the P7 colour status/detail UI could falsely pass. Exact native Luna
`01a01b2b-76a7-7532-9ba5-e09245275442` changed only `tests/e2e/x4-ui-source-editor.spec.ts`: both colour signals are
now required exactly once and visible, and their settled current-generation state is included in the late-generation
non-overwrite proof. The first correction then asserted a marker from the body of a controlled HTTP 503. Source
reconciliation reproduced that `readStatus()` intentionally returns the fixed `status-http` failure before parsing a
non-success body, making that assertion impossible. The same Luna owner corrected the oracle to require exact
`unavailable` core/colour status and the public fixed non-success-response detail. Final Playwright hash is
`136F613690B1AE44A7B2F950DACCEE2A1040476EBFB13E215FA0484856D4D831`; production remains byte-exact at SourceEditor
`F4CF7F877A149A691E2D8FB05511DF3D1191A30D305EE92209830725F229D662` and EditorSession
`990B1338BEF3F2CA14857EA236B517EF9DE23CC4884F60987A206C78BE4E8213`. Worker and coordinator both pass typecheck,
exact-file ESLint, and diff hygiene. Playwright remains deliberately unexecuted pending the mandatory machine-state
confirmation; P7 therefore remains `PARTIAL / candidate`. AAR triggers: optional mounted colour assertions and the
unparsed-503-body assumption both reached static review before runtime and were corrected without production changes.

P7 second zero-write audit, 2026-08-19: native Luna `01a01b37-d15d-7cf2-9a16-0be108ffb162` preserved all five
declared hashes, exact `HEAD == origin/main` at `77138741a9f470e2c6c37c2d6857688dd1e2b13e`, 58 porcelain rows, and zero
staged paths. SourceEditor P7 `12/12`, EditorSession P7 `7/7`, typecheck, exact five-file ESLint, and exact-path diff
hygiene remained green. The candidate is nevertheless `FINDINGS`, not accepted: the transport-throw row is normalized
to a fulfilled failure inside CorpusAssets and therefore cannot distinguish `Promise.all` from `Promise.allSettled`;
the Paint tint multiplicity omits the actual command `ownerId`; and the mounted generation-three path proves only
unmount/no-pageerror after test-controlled settlement, not that the component cleanup aborted the shared generation
signal before settlement. These are test-authority defects, not reproduced production failures.

The reconciled correction is three independent tests-first slices. Exact native Luna
`01a01b44-847d-7ec1-a810-4519dd068fe1` owns only SourceEditor production/selftest and may add the smallest defaulted
branch-loader seam necessary to produce a true rejected promise while preserving concurrent start, one shared signal,
the canonical fulfilled branch, and the permanent game-truth boundary. Exact native Luna
`01a01b44-8589-7f02-855f-b31449727aaf` owns only the EditorSession selftest and must bind Paint multiplicities to exact
static `ownerId` values plus wrong-owner and same-colour duplicate/missing mutation sensitivity; production remains
frozen. Exact native Luna `01a01b44-86c4-7dd3-8784-af365ee125f2` owns only the mounted Playwright spec and must observe
the real generation-three fetch signal become aborted after unmount and before manual route settlement, while retaining
the exact core/colour HTTP-503, stale-generation, no-pageerror, and `Not verified in game` assertions. No worker may run
Playwright before the machine-state gate. Coordinator review, combined focused gates, and a new zero-write audit are
required before P7 acceptance; broad/build/install/deploy/X4 remain locked. No capability-map delta.

P7 post-correction audit, 2026-08-19: SourceEditor production/selftest
`335AB14EA7EF2800E4E3B08E288E0E7EF4E031CD651FA8DD6F21B46D4F81CE57` /
`3E8FD64C40DF6526401879228FBFD9678342D9D7F53F9D11255D0A046D714CCD`, frozen EditorSession production
`990B1338BEF3F2CA14857EA236B517EF9DE23CC4884F60987A206C78BE4E8213`, Session selftest
`A86B49EDFCB0BBB4BB41F8E305E3C99F0D6268D7D113AFDDE76627743943DD9B`, and mounted spec
`E9D745F18813DFFBFBBC604F67CF603F2B1A0E48BEA635F57DDA1A249BB52DB2` passed SourceEditor `12/12`, Session
`7/7`, typecheck, exact five-file lint, and diff hygiene. Fresh zero-write Luna
`01a01b57-696b-7172-ba36-0f8a82c19204` independently accepted the real rejected-promise/`Promise.all` mutant,
reflection/game-truth boundaries, and the mounted shared-signal cleanup oracle at static scope, but returned `FINDINGS`
for one remaining owner-test escape: the Session helpers used `command.nodeId ?? command.id`. Deleting the real
`nodeId` and forging `id` to an expected fixture owner therefore preserved cardinality and legacy colour multiplicity
while the supposedly exact oracle still passed.

The same Session selftest owner `01a01b44-8589-7f02-855f-b31449727aaf` is correcting only that file. Exact authority
must require `nodeId` for every tint-bearing command, never synthesize owner identity from `id`, and include selected
and sampled mutants that delete `nodeId` while preserving `id` and tint data. Those mutants must pass an explicit
legacy fallback oracle and fail the corrected exact oracle while the prior wrong-owner and same-colour duplicate/missing
receipts remain green. Production stays frozen. Require combined static gates and another zero-write audit before P7
promotion; Playwright remains machine-gated. AAR triggers now include the first tuple-inference typecheck failure, the
auditor's corrected staged-path census, graphify's Windows canonicalization failure, and the first CJS top-level-await
mutant-probe failure. No capability-map delta.

P7 second post-correction audit, 2026-08-19: fresh zero-write Luna
`01a01b6a-4ba3-7291-9365-68ab44d3a2db` confirmed that exact tint extraction and command lookup now use only `nodeId`,
the sole `nodeId ?? id` path is isolated in the named legacy helper, expected owner maps are static, every focused gate
is green, and loader/mounted/reflection/game-truth boundaries remain intact. It still returned `FINDINGS`: the
delete-`nodeId` mutant assigned `command.id` to the expected owner before deletion, so its `fallbackIdPreserved` receipt
proved a manufactured post-write value rather than preservation of the original command. The Session selftest owner
must snapshot the original own `id`, never rewrite it, delete only `nodeId`, and require exact original-`id` and tint
preservation. If the real fixture's original `id` cannot satisfy the legacy fallback, the test must report that shape
and construct a separate honest causal control rather than manufacture preservation. Production remains frozen;
combined gates and another zero-write audit remain mandatory. No capability-map delta.

## P7 FINAL STATIC CHECKPOINT — CLEAN / MOUNTED VALIDATION PENDING (2026-08-19)

Status: `PARTIAL`. The P7 five-file candidate is accepted at static/focused scope after final zero-write review; the
real mounted Forge interaction is still unexecuted and therefore P7 is not runtime-verified.

### Reconciled correction

- The real selected and sampled Paint commands already have own geometry-prefixed `id` values distinct from `nodeId`.
  The corrected mutant snapshots that original `id`, never rewrites it, deletes only `nodeId`, and proves unchanged
  tint data, cardinality, and non-owner colour multiplicity. The strict owner oracle rejects it; the legacy fallback is
  honestly false for those real fixtures.
- A separate minimal control starts with original `id === nodeId`. Deleting only `nodeId` makes the named legacy
  `command.nodeId ?? command.id` oracle accept while the strict `nodeId` oracle rejects. This establishes the fallback
  escape without manufacturing evidence in the real fixture.
- The SourceEditor loader seam remains optional and defaults to the production configured core/colour loaders. Its
  causal test starts both branches before settlement, shares one signal, produces a genuinely rejected loader promise,
  retains the canonical fulfilled branch through `Promise.allSettled`, and rejects a `Promise.all` mutant.
- The mounted spec statically records exactly two generation-three status requests, one shared signal, no pre-unmount
  abort, then abort events after unmount and before manual settlement. It retains mandatory core/colour status/detail,
  controlled HTTP 503, stale-generation, no-pageerror, and `Not verified in game` assertions.

### Frozen candidate and host-native evidence

- `src/components/X4UiSourceEditor.tsx`:
  `335AB14EA7EF2800E4E3B08E288E0E7EF4E031CD651FA8DD6F21B46D4F81CE57`.
- `src/components/X4UiSourceEditor.selftest.tsx`:
  `3E8FD64C40DF6526401879228FBFD9678342D9D7F53F9D11255D0A046D714CCD`.
- `src/lib/x4UiEditorSession.ts`:
  `990B1338BEF3F2CA14857EA236B517EF9DE23CC4884F60987A206C78BE4E8213`.
- `src/lib/x4UiEditorSession.selftest.ts`:
  `751E520F77EA28E1635A3CD87D63BF6ACFB721942FCA3B610E79A4D2F8DFC7AC`.
- `tests/e2e/x4-ui-source-editor.spec.ts`:
  `E9D745F18813DFFBFBBC604F67CF603F2B1A0E48BEA635F57DDA1A249BB52DB2`.
- Host-native SourceEditor selftest: `12/12`, exit 0.
- Host-native EditorSession selftest: `7/7`, exit 0; selected and sampled receipts retain their real original IDs and
  the separate static legacy-fallback control passes.
- Host-native `npm run typecheck`: exit 0.
- Host-native exact five-file ESLint: exit 0.
- Host-native exact five-file `git diff --check`: exit 0.
- `HEAD == origin/main == 77138741a9f470e2c6c37c2d6857688dd1e2b13e`; 58 porcelain rows; zero staged paths.
- Final zero-write Luna `01a01b8a-9132-7a61-92bd-d327e947700b`: `CLEAN`, no files changed, no findings. It independently
  verified exact hashes, focused rows, loader seam, static owner maps and mutants, absence of a production `nodeId -> id`
  fallback, permanent game-truth boundary, and mounted abort assertions.

### Mounted-validation isolation amendment — 2026-08-19

Status: `FOCUSED VERIFIED / CLEAN`; the mounted SourceEditor spec remains unexecuted.

Read-only reconciliation found that the Playwright API stack redirects `X4_STATE_DIR`, `X4_CONFIG_DIR`, and discovery
state into its per-process OS-temp root but does not set `X4_DATA_DIR`. The mounted spec calls
`seedServerWorkspace()`, which performs `POST /api/agent/workspace`; that transaction creates recovery and authoritative
action-receipt records and projects history through stores rooted by `dataPath()`. With the current environment those
stores resolve to this checkout's live `data/` directory. Running the supposedly isolated spec would therefore mutate
live Forge persistence even though its workspace registry and configuration are ephemeral. This is a reproduced harness
isolation defect, not a hypothetical runtime risk, and the machine-sensitive gate stays locked until it is repaired.

The bounded tests-first repair owns only `playwright.config.ts` and a new focused
`scripts/e2e-ephemeral-environment.selftest.ts`. The selftest must inspect the actual Playwright configuration object and
fail against the frozen configuration because `X4_DATA_DIR` is absent. Production then sets `X4_DATA_DIR` to an absolute
child of the same `E2E_STATE_DIR`, while the configured `X4_REFERENCE_ROOT` remains a deliberately external read-only
input. Acceptance requires the causal red receipt, focused selftest, typecheck, exact-file ESLint and diff hygiene,
immutable hashes, coordinator reproduction, and a fresh zero-write Luna audit. The later mounted run must additionally
fingerprint the live `.studio-state`, `config.json`, and `data/` roots before and after, parse the E2E harness verdict,
and prove ports `3100/3101` and the owned process tree are gone. Rollback is the exact two-file repair diff. There is no
capability-map delta; this restores the already-declared ephemeral-test boundary.

Acceptance receipt: exact native Luna `01a01c17-1ae3-7b43-9721-61dcc0a5054c` captured the required fail-first exit `1`
with `X4_DATA_DIR must be defined in the API webServer environment`, then changed only the declared pair. Final SHA-256
values are `playwright.config.ts`
`E53CBC377066A77E30306A3E384598E2064B889F0B2F9A4B1150B5C8E0843A41` and the new selftest
`DDC899A834FB7E15B20C2FA9503E77D436AC76262D6624805EB8602762A662B5`. Worker and coordinator independently passed
the focused selftest, typecheck, exact two-file ESLint, and diff hygiene without running Playwright. Fresh zero-write
Luna `01a01c1e-1cb0-7761-bf22-1dfe8b16c003` returned `CLEAN`, changed no files, preserved both hashes and zero staged
paths, and passed the same four gates. It confirmed that the configured child environment closes every `dataPath()`
consumer reached by the API stack; an extra assertion that `X4_STATE_DIR` is beneath `os.tmpdir()` is optional
strengthening rather than a release-relevant escape because the actual public config already constructs that per-process
root. Static acceptance does not prove runtime cleanup or live-root byte stability. Overall B119 remains
`PARTIAL / Not verified in game`.

External projection was synchronized and read back without closing B119: GitHub #41 comment `5348802753` contains the
exact isolation checkpoint; Notion page `3b84618e-d15b-8190-821e-c0eb96f43d5a` now reads
`P7 static CLEAN; mounted-harness X4_DATA_DIR isolation repair CLEAN at GitHub #41 comment 5348802753; mounted
Playwright, broad/install, AI Influence dogfood, deploy, and X4 remain pending; Not verified in game`; and Drive document
`17VLaIsT499KHg7zg30hOyLaBXB0-9jlrX3dQ63s3dtE` advanced under required revision
`AIroW35HtnX_2zZyHPLJwj9JIih8FTNVwLDSx2NZsJFb-l4bzsQD3tIkHbViIOHKLsZCeNFWPN8t5FDokUpSJvyQjEEcjHvQ3ayDbyb-JXKc`
to read-back revision
`AIroW34XpQzBJ5NRIzi9GCDV97S8idXzYqEdJo5jgBbhA6avhPuNrZnFDbj_NfKeK0pP4aXsfotYXFqGjp710FS--upL0orCwd8VErzIcOKS`.
Its exact heading is `HEADING_2` at indexes `91675..91747`, and both the fail-first and pending-X4 sentences are present.

### Remaining required validation

After the mandatory machine-state answer, run only
`node scripts/run-e2e.mjs tests/e2e/x4-ui-source-editor.spec.ts`; parse the harness verdict, verify the ephemeral
3100/3101 stack stopped, and prove the live workspace remained unchanged. Then re-freeze hashes/focused gates and run a
fresh post-runtime zero-write audit. Broad oracle/precommit/build/package, installed Forge rendering, AI Influence 1b
dogfood through Forge with fresh visual comparison to every relevant supplied photo, deploy-byte identity, and X4
runtime/screenshot truth remain later gates. Product copy remains `Not verified in game`.

### AAR delta

- A coordinator check first resolved through the Codex sandbox mirror. The path exposed the host-truth violation, so
  those matching results were not treated as authority; every frozen hash and focused gate was repeated host-native.
- A Google Docs refresh used an invalid partial-response field mask with one unmatched parenthesis and returned HTTP
  400. It wrote nothing. The full indexed document read then succeeded and supplied revision/end-index authority before
  any synchronization write.
- Sustain: static green is not promotion. Three successive no-write audits found genuine proof defects before this
  CLEAN candidate; the bounded correction/audit loop prevented a convincing but weak renderer test from becoming the
  release authority.

### External checkpoint readback

- GitHub #41 comment `5347454408`: exact P7 static-clean / mounted-pending checkpoint read back.
- Notion accepted comment `3c14618e-d15b-814a-9d69-001d190c9b03`. Because the comments reader remained on its
  pre-write discussion snapshot, no duplicate was posted. The data-source schema confirmed `Reverse Sync Result` is a
  text property; a minimal update now states the static-clean and remaining mounted/broad/dogfood/deploy/X4 boundary,
  and the page fetch read it back exactly.
- Google Doc `17VLaIsT499KHg7zg30hOyLaBXB0-9jlrX3dQ63s3dtE`: revision-guarded append succeeded from revision
  `AIroW34pUzWukpvgsk9Qv5OVdfpbAsma3UhA2etwamLgJJfmSdpATPCWOTEmbct9GlBtBWfyiz7Rv96XKCHgK-IVpa4h6lHQBioPXRpYJCaX`
  to revision
  `AIroW34ec3tH_2d7m2zQDfMCm8rxh5dZp1CK8EbCPjrq4507c_TrVbTtqXFH7G4KeMGSC7OYBgz5ZhE4621LDPzvuG_Yz_MnmpuYTWq8Rnux`.
  Readback found the `HEADING_2` marker at index 89070 plus the final repository-authority sentence.
- Tool AAR: fetching a returned Notion comment ID as though it were a page returned the expected `object_not_found`;
  comment IDs and page IDs are different object classes. The schema-backed property readback supplied durable proof.

### Mounted SourceEditor run — isolated cleanup verified, lifecycle oracle failed (2026-08-19)

Status: `PARTIAL / FAILED REQUIRED METHOD`. Ken supplied the required machine-state answer: Antigravity open, X4 not
running, machine quiet. The coordinator ran exactly
`node scripts/run-e2e.mjs tests/e2e/x4-ui-source-editor.spec.ts` against the repaired ephemeral stack.

The harness result was deterministic across its retry: `0 passed / 1 failed / 0 flaky / 1 bad-result`, child exit `1`.
The failure is at `tests/e2e/x4-ui-source-editor.spec.ts:281`: generation-three recorded two status fetches but their
observed `AbortSignal` identities had set size `2`, while the static oracle expected size `1`. The new structured verdict
is `test-results/e2e-verdict.json` SHA-256
`63CA15C9604E684516C756B69C1E5099C045FD54BADB4D84E6C9FE4C57D5EE53`, timestamp
`2026-08-19T23:26:16.9958005Z`.

Isolation and cleanup passed independently of the behavioral failure. The runner reported lifecycle complete,
`treeGone=true`, no cleanup errors, one termination pass, root PID `37436`, and no remaining owned PIDs. Ports
`3000/3001/3100/3101` were free and no X4 process existed after the run. The complete untracked-file worktree census
remained exactly `59` entries / `2387` bytes of porcelain output / SHA-256
`E7F3756DF0BD50D7D8CC5A117550604F394EB0647F4BA8E3E1642F8FCC781EDA`, with zero staged paths. Live roots were
byte-identical before and after: `.studio-state` `9` files / `4` directories / `12,382,674` bytes / tree digest
`A70776B8CF69435702A2BB48DF73F9B5A5DC35985B51268298DAE311649C025C`; `config.json` `463` bytes / digest
`E4C090258945687435565FB8E728C8722A51D113EBAD4CD0A26BC5665EE26772`; and `data/` `3,686` files / `42`
directories / `607,386,585` bytes / tree digest
`A81D43E9BF19C5311FD1A1F9E593D98978C299E35614D7FCBB201D935AE20726`. The `X4_DATA_DIR` repair is therefore
runtime-proven to preserve the live Forge roots.

Reconciliation classifies the failed identity assertion as a reproduced test-authority discrepancy, not yet a
production abort defect. `X4UiSourceEditor` creates one controller per effect invocation and passes its exact signal to
`loadX4UiSourceEditorCorpusEnvelope`; that function passes the same value to both branch loaders, and `request()` passes
that value to the bounded fetch transport. The accepted focused selftest independently proves branch-loader and
transport object identity. Since the mounted fetch wrapper runs before native `fetch()` and observes the supplied
`RequestInit.signal` directly, two identities imply two effect/loader invocations were grouped under the harness's
manually assigned generation label. The current test labels requests by an external mutable counter and therefore does
not identify their owning effect lifecycle.

The next bounded tests-first unit owns only `tests/e2e/x4-ui-source-editor.spec.ts` unless causal evidence proves a
production change is required. It must make the mounted harness lifecycle-aware without adding a production test hook:
group observable fetches by their signal identity, distinguish aborted StrictMode/stale invocations from the active
invocation, require one active lifecycle to issue both core/colour initial status requests, prove every request in that
active lifecycle shares one signal, then prove unmount aborts that signal before any manually controlled route settles.
It must retain the exact HTTP-503 current-generation core/colour result, stale-generation non-overwrite, no-pageerror,
unmount/no-remount, and permanent `Not verified in game` assertions. A deliberately flattened external-generation
oracle must fail first against the observed mounted behavior; the lifecycle-aware oracle must pass only if same-owner
requests abort together. If the new evidence instead shows two independently active non-aborted lifecycles at the
unmount boundary, stop and reclassify it as a production lifecycle defect before touching production.

Acceptance requires exact test diff review, typecheck, owned-file ESLint, diff hygiene, the isolated mounted spec with
authoritative structured verdict, post-run process/port/live-root parity, and a fresh zero-write Luna audit. Frozen P7
production and focused-test hashes may not change without a documented reproduced production defect. Broad E2E,
build/package/install, AI Influence dogfood, deploy, and X4 remain locked. Rollback is the exact mounted-spec-only diff;
no capability-map delta. Overall B119 remains `PARTIAL / Not verified in game`.

First lifecycle-aware attempt and coordinator rejection: Luna `01a01c5d-11e9-70c3-b5fa-cbad6bf2b1cc` changed only the
mounted spec to group observations by signal identity and passed exact ESLint, typecheck, and diff hygiene. Its mounted
run remained red at `0/1`, with lifecycle IDs `5` and `6` each owning one non-aborted request; cleanup again completed
with no remaining PIDs or listeners. The worker classified that as a production/runtime discrepancy and stopped without
touching production. Coordinator review rejected that conclusion because the test sampled immediately after the route
layer reached `>= 2` requests. That boundary can observe one request from each lifecycle before either lifecycle's paired
branch reaches the browser harness; it is not the declared unmount-boundary condition and cannot prove a duplicate active
lifecycle. The same Luna owner was resumed for a targeted test-only correction: poll until exactly one complete
two-request non-aborted signal group exists and every other observed group is cleanup-aborted, then select that group and
prove its unmount abort before route settlement. Only a causal timeout/final readback with multiple non-aborted groups and
no complete pair may reclassify production. This review-forced reimplementation is an AAR trigger; production remains
frozen and the mounted gate remains failed.

### Reproduced mounted owner-signal defect and bounded production repair — 2026-08-19

Status: `FAILED / REPRODUCED`. The corrected lifecycle-aware oracle is frozen at
`tests/e2e/x4-ui-source-editor.spec.ts` SHA-256
`C810FDAA7AF5901F3F057E75794F9058BD22A53EC9950DD1ACD924E2D2E01496`. It polls for ten seconds for exactly one
complete two-request live signal group while requiring every competing group to be cleanup-aborted. Both retry attempts
ended identically: lifecycle/signal `5` owned one non-aborted request with zero abort events; lifecycle/signal `6` owned
one non-aborted request with zero abort events; no same-signal core/colour pair ever formed. The authoritative structured
verdict is `0 passed / 1 failed / 0 flaky / 1 bad-result`, child exit `1`, receipt SHA-256
`41B159D6D8D35E76AEEC25CA070D18E8C3B113EB80143046E920016C45B72BAF`, timestamp
`2026-08-19T23:42:32.2519675Z`. Lifecycle cleanup remained complete with `treeGone=true`, no remaining captured PID,
ports `3000/3001/3100/3101` free, and no X4 process. Exact-file ESLint, typecheck, and diff hygiene passed. The test did
not weaken or reach the later unmount assertion because the required active owner pair was absent.

This is now a reproduced production/runtime contract defect. Frozen SourceEditor production/selftest hashes remain
`335AB14EA7EF2800E4E3B08E288E0E7EF4E031CD651FA8DD6F21B46D4F81CE57` /
`3E8FD64C40DF6526401879228FBFD9678342D9D7F53F9D11255D0A046D714CCD`. Source reconciliation shows the intended
outer signal is supplied to both branch loaders, but the mounted fetch boundary does not retain one identity. The
narrowest repair is therefore to make the envelope owner authoritative at its transport boundary: create one transport
facade closed over the envelope's `signal`, ignore any branch-supplied transport signal, and pass that same facade to
both configured loaders. This makes cancellation ownership explicit at the last application-controlled boundary before
`fetch` rather than relying on branch option propagation.

The tests-first production unit owns only `src/components/X4UiSourceEditor.tsx` and
`src/components/X4UiSourceEditor.selftest.tsx`; the mounted spec is frozen read-only at the hash above. Its fail-first
selftest must inject both branches, have each attempt transport with a distinct rogue signal, and prove the current raw
transport leaks those identities. The repaired envelope must preserve concurrent branch start and `Promise.allSettled`
behavior while the underlying transport sees only the exact outer owner signal for every call. It must also prove owner
abort propagation and refuse any mutation that restores branch-supplied signal authority. No corpus loader, Session,
Paint, Canvas, UIBuilder, API, or harness configuration change is permitted.

Acceptance requires the causal selftest red/green receipt; exact SourceEditor focused rows; typecheck; exact production,
selftest, and frozen mounted-spec ESLint/diff hygiene; hash/containment readback; then the exact mounted harness command.
The mounted gate must form one same-signal two-request live group, retain all current 503/stale/colour/pageerror/game-truth
checks, and prove unmount abort before settlement. Post-run process/port and live-root parity plus a fresh independent
zero-write Luna audit remain mandatory. Rollback is the exact two-file production/selftest diff. Broad and downstream
gates remain locked; no capability-map delta. Overall B119 remains `PARTIAL / Not verified in game`.

### Cross-layer reconciliation supersedes the owner-signal defect diagnosis — 2026-08-19

The production-defect classification above is superseded. Repository-wide fetch ownership search found the missing
reader/writer coupling in `src/main.tsx:34-160`: the Playwright init script installs its observing `window.fetch` first;
Forge startup captures that function as `originalFetch`, then installs `customFetch`. For every bounded API request,
`customFetch` reads the caller's upstream signal, invokes `createAbortDeadline(upstreamSignal, deadlineMs)`, replaces
`RequestInit.signal` with that request-specific `deadline.signal`, and only then delegates to the test observer. The two
mounted identities are therefore the expected per-request deadline signals, not evidence that SourceEditor issued two
upstream lifecycle signals. Both derived signals remain live while their held requests are pending and are designed to
abort when the one upstream owner aborts or their independent deadline expires.

The explicit owner-transport facade experiment did not change the mounted result—still exact one-request live groups
`5` and `6`—which is the expected falsification: the downstream deadline owner intentionally derives a fresh signal
after the SourceEditor boundary. The experimental production/selftest hashes were
`D72F041519EFC9FD42494F323E51D18D26B20FBF56F8A7C9AF80B5BBDEB0FD24` /
`F283084972BEDC402943A4061A73179C499789876C7F4D1AA71ACB1DF0812F32`; its mounted receipt was structured red at
`0/1`, SHA-256 `2FF9F369BB6C027A6A0ACD1C03345E22A46EBC56BEA6DA600386F68A2AE340AE`, timestamp
`2026-08-19T23:50:19.4872623Z`, with complete process cleanup. This experiment is `REVERTED`, not accepted. Exact Luna
`01a01c69-cb53-76b0-bfae-fb794e3518c0` must restore only its two files to frozen hashes
`335AB14EA7EF2800E4E3B08E288E0E7EF4E031CD651FA8DD6F21B46D4F81CE57` /
`3E8FD64C40DF6526401879228FBFD9678342D9D7F53F9D11255D0A046D714CCD` and rerun static gates without another
mounted run.

The corrected acceptance contract is cross-layer, with no production change: the accepted SourceEditor selftest proves
both configured branch loaders receive the exact one upstream owner signal and its raw injected transport preserves that
identity; the mounted test proves the two expected request-deadline derivatives are both live before unmount and both
receive abort events after unmount but before either held route is manually settled. Native-fetch object identity must
not be asserted equal. The next test-only unit owns only the mounted spec, removes lifecycle grouping by downstream
signal, records one exact post-click request cohort, requires two non-null distinct deadline-signal identities with zero
pre-unmount abort events, and then requires both to abort synchronously at the cleanup boundary before settlement. It
must retain every current 503/stale/colour/pageerror/no-remount/game-truth assertion. A one-signal cohort, a missing abort,
an abort only after settlement, or a stale UI overwrite must fail.

Acceptance requires the exact restored production/selftest hashes; causal test-only diff; SourceEditor `12/12`;
request-deadline focused tests if present; typecheck; exact ESLint/diff hygiene; frozen non-owned hashes; exact mounted
structured green; full process/port and live-root parity; then a fresh zero-write Luna audit. This reconciliation and the
review-forced production revert are AAR triggers. No capability-map delta; overall B119 remains
`PARTIAL / Not verified in game`.

### P7 mounted acceptance and broad-gate promotion — 2026-08-19

Status: `FOCUSED VERIFIED / CLEAN`; P7 is promoted into broad host validation, not game verification.

The final mounted-spec-only correction is frozen at `tests/e2e/x4-ui-source-editor.spec.ts` SHA-256
`5ABE7E0235FC41EAD822AC07CF59B403761ADAB2573C764D3DF67B3B1D63AC3E`. It records exactly the two post-click
core/colour status requests, requires two non-null distinct live request-deadline signals with no pre-unmount abort,
freezes those exact identities, unmounts SourceEditor through Blueprint, and requires both derived signals to emit abort
before either held route is manually settled. It retains controlled HTTP 503 core/colour failure rendering,
stale-generation non-overwrite, no page error or remount, and exact `Not verified in game` copy. Static SourceEditor
coverage remains the complementary authority that both branch loaders receive one shared upstream owner signal.

The exact isolated mounted command
`node scripts/run-e2e.mjs tests/e2e/x4-ui-source-editor.spec.ts` passed `1/1`, with zero failed, flaky, bad, or missing
results. `test-results/e2e-verdict.json` is SHA-256
`95BD5006AD61E8E16CDDD3B7C66B090634A7DED00E0D2A684052B52ED37B9714`, generated
`2026-08-19T23:58:12.183Z`; its lifecycle is complete, `treeGone=true`, and `remainingPids=[]`. Ports
`3000/3001/3100/3101` and the X4 process were absent afterward. The complete worktree remained exactly 59 NUL entries,
2,387 bytes, SHA-256 `E7F3756DF0BD50D7D8CC5A117550604F394EB0647F4BA8E3E1642F8FCC781EDA`, with zero staged paths and
`HEAD == origin/main == 77138741a9f470e2c6c37c2d6857688dd1e2b13e`. The earlier pre/post live-root receipts remained exact, so the
`X4_DATA_DIR` isolation repair is runtime proven.

Coordinator reproduction passed SourceEditor `12/12`, EditorSession `7/7`, the E2E environment containment selftest,
typecheck, exact seven-file ESLint, and exact seven-file diff hygiene. Fresh zero-write native Luna
`01a01c7a-34f9-78c1-ab77-61707af2ce94` returned `CLEAN`, changed no files, preserved every accepted hash and the complete
worktree fingerprint, independently traced the upstream-to-deadline abort coupling, and found no material false-green or
unsafe broad-gate blocker. P7 is accepted. The next gates are the runtime-discovered oracle sweep, full verdict-parsed
E2E, precommit, production build/package, and real rendered Forge inspection. AI Influence dogfood, deploy-byte identity,
and X4 remain pending; overall B119 remains `PARTIAL / Not verified in game`.

### AAR delta — mounted lifecycle correction

- Sustain: the static and mounted tests now prove different ownership boundaries instead of asserting impossible native
  object identity across `customFetch` deadline derivation.
- Improve work/approach: the first lifecycle interpretation and the later production-defect diagnosis were both wrong;
  repository-wide reader/writer reconciliation should have included `src/main.tsx` before authorizing production work.
- Improve tools: the verdict-parsed isolated runner and exact live-root/worktree receipts prevented both false success and
  persistence contamination despite the failed attempts.
- Highest-risk evidenced weakness: a highly convincing mounted oracle can still test the wrong observation boundary.
  The bounded mitigation is the accepted cross-layer static-plus-mounted contract and the permanent game-truth label.

### Broad runtime-oracle fail-first — 2026-08-19

Status: `FAILED REQUIRED METHOD / correction active`. The isolated runtime index discovered 134 oracles. The first real
execution of `npm run test:oracles` returned `132/134`; the only reds were `/agent/lua-static-selftest` and
`/agent/project-orchestration-selftest` (`12/14`). The isolated server and temporary config root were torn down, the
oracle port was released, no X4 process started, the exact 59-entry/2,387-byte worktree fingerprint remained unchanged,
and zero paths were staged.

Read-only reconciliation reproduced one shared stale expectation. The accepted linter implementation correctly emits a
warning for literal `addTable(13..23)` because official X4 9.00 has valid 13-column tables and the mod range is
unbisected; it emits a blocking error only at `24+`, the measured refusal boundary. `runLuaStaticAnalysisSelftest()`
still builds its fatal, BOM-fatal, mixed-error, and deterministic fixtures from `addTable(13)`, while
`runProjectOrchestrationSelftest()` still expects a package containing `addTable(13)` to block. The runtime reds are
therefore tests that contradict the accepted policy, not evidence that the linter or renderer changed incorrectly.

Exact native Luna `01a01c83-fdbc-70d3-bdbb-65890016f6e1` owns only
`src/lib/luaStaticAnalysis.ts` and `src/lib/projectOrchestration.ts`. It must preserve production analysis/package code,
add mutation-sensitive 13-warning/nonblocking and 24-error/blocking rows, retain clean/dynamic/BOM/truncation/determinism
coverage, pass focused selftests/typecheck/exact lint/diff hygiene, and make the isolated runtime sweep `134/134`. Full
E2E remains paused. No capability-map delta.

Tool AAR: the first wrapper command was rejected before execution because the host command-policy parser mangled an
inline drive-path/environment assignment. It created no process or file. The simplified process-scoped temporary-config
wrapper executed successfully and supplied the authoritative fail-first receipt.

Correction candidate: Luna `01a01c83-fdbc-70d3-bdbb-65890016f6e1` changed only the two declared selftest owners. The
Lua static owner now proves 31/31 rows, including separate 12-clean, 13-warning, and 24-error cases; BOM location uses the
warning boundary; mixed 24-error plus dynamic gap remains independent; and determinism spans all three severities. The
project orchestration owner now proves 15/15 rows: the old height fixture is honestly named and checked as a nonblocking
unverified gap, while separate package fixtures prove 13 warning/nonblocking and 24 error/blocking. Review preserved the
pre-existing uncertainty row after rejecting an intermediate patch that had replaced it.

Final candidate hashes are `src/lib/luaStaticAnalysis.ts`
`04F5820CA77B429626E110EC561E34587207821B7A9F420139B70918990A496E` and
`src/lib/projectOrchestration.ts` `3376624C5B55B3C9AE0F56ECA7DD06B967012D228B1A5B0134CA8E9698A303AB`.
Worker and coordinator independently passed both focused selftests, typecheck, exact lint with zero errors, and diff
hygiene. The ten `no-explicit-any` lint warnings are unchanged pre-existing lines. Worker and coordinator also each ran
the isolated runtime-index sweep at `134/134` green. The two new tracked modifications make the expected full worktree
authority 61 NUL entries / 2,454 bytes / SHA-256
`A04DB7221CBF0B85E7AA36ADA33A53646BB12792B8289BA6D1C92E23874A771F`, zero staged; excluding those exact owners
returns the prior 59-entry fingerprint. Fresh zero-write Luna `01a01c95-618e-74e3-9f1d-5cf339bf10f9` is auditing the
candidate. Full E2E remains locked until `CLEAN`.

Audit close: zero-write Luna `01a01c95-618e-74e3-9f1d-5cf339bf10f9` returned `CLEAN`, changed no files, independently
passed Lua `31/31`, orchestration `15/15`, typecheck, identical-to-HEAD lint warnings, diff hygiene, and runtime-index
`134/134`; it preserved both hashes, the exact 61-entry status fingerprint, zero staged paths, and released port 8972.
The broad oracle gate is accepted. Source fallback discovers 133 while the running registry exposes 134; runtime index is
the authoritative project gate. Full serial E2E is now unlocked; engine truth remains `Not verified in game`.

### Full E2E fail-first — manifest readiness oracle — 2026-08-20

Status: `FAILED REQUIRED METHOD / tests-only correction active`. Ken's machine gate remained valid. The coordinator
captured full pre-run content receipts, then ran exactly `npm run test:e2e`: 103 tests, one worker. The structured verdict
is `102 passed / 1 failed / 0 flaky / 1 bad-result`, child exit 1. The sole failure repeated on retry in
`tests/e2e/project-browser.spec.ts:203`: expected the directory-config response manifest state `ready`, received
`scanning`. Receipt `test-results/e2e-verdict.json` is SHA-256
`D106E146E500EF65A869534B4DC7A3B44480E9F9A869D5EEE0CB87A78933C7A2`, generated
`2026-08-20T00:53:55.862Z`; report inspection is complete, lifecycle is complete, `treeGone=true`, and no PID remains.

The isolation contract remained exact despite the red. Before and after, `.studio-state` is 9 files / 4 directories /
12,382,674 bytes / content-tree digest `244B8BD79EE7C8EEB93FBF1F374EF053FF1E91333088AF14D5AFB9EE60EE550E`;
`data/` is 3,686 / 42 / 607,386,585 / `A279C2CA9FFB646885B8E433D44AD9EFE61803D44629CAA5DC037DA23C083B56`;
and `config.json` is 463 bytes / `3EC65D540E6763D13D6F8F27D9005F80C3C855B00D3DCFDD5E7330726AE37779`
with unchanged timestamp. Worktree status remained exact at 61/2,454/
`A04DB7221CBF0B85E7AA36ADA33A53646BB12792B8289BA6D1C92E23874A771F`, zero staged; all validation ports and X4
were absent after teardown.

Cross-layer reconciliation classifies the red as a stale test oracle exposed by the accepted `X4_DATA_DIR` isolation,
not a stuck production scan. A fresh per-run data root has no cached manifest. `scheduleReferenceManifest()` therefore
starts the first background scan and returns the documented `scanning` state with metadata; `ready` exists only after no
scan is active, while `stale` preserves a prior complete generation during replacement. The project-browser test changes
only workspace/filesystem roles and must remain usable without waiting for a full unpacked-corpus scan. The former
live-data leak could mask this by supplying a pre-existing ready generation.

Exact native Luna `01a01cab-4297-77a0-af08-9028c642f2b4` owns only
`tests/e2e/project-browser.spec.ts`. It must replace the ready-only assertion with strict state/shape coupling that accepts
only ready, scanning, or stale; rejects error/unavailable/idle/absent; requires active-scan metadata for scanning/stale;
and retains every visual decomposition, overlap, cue-filter, round-trip, restore, and cleanup assertion. It may not wait
for the corpus, raise timeouts, quarantine, skip, or touch production. Focused verdict-parsed green, typecheck, exact lint,
diff hygiene, cleanup, coordinator review, and a fresh zero-write audit are mandatory before rerunning the full suite.

AAR delta: the earlier live-data contamination made a ready-only assertion look stable. Once isolation was fixed, the
test revealed that it had coupled an unrelated project-browser behavior to background corpus completion. The durable
lesson is to assert asynchronous status shape and downstream independence, not immediate completion, unless completion
is the feature under test.

Correction candidate: `tests/e2e/project-browser.spec.ts` is frozen at
`3E8E8966164E30E0557A9E8F36FF4997F3C6D9FB2E8C2DECD22CE8344DF9E2BC`. It accepts only ready/scanning/stale,
forbids an error field, requires ready to omit scan metadata, and requires scanning/stale metadata to contain nonempty
generation/startedAt plus finite nonnegative files/bytes. It adds no poll, timeout, retry, quarantine, skip, or production
hook and retains all downstream project-browser assertions.

Worker `01a01cab-4297-77a0-af08-9028c642f2b4` passed the focused three-test spec and static gates. The coordinator's
first reproduction was correctly rejected by the verdict parser when the Playwright child exited Windows
`3221226505` before producing a structured report; lifecycle teardown still completed. The exact rerun produced 3/3
structured green, receipt SHA-256 `C9ADC7DD7F96840BB1610CA7016B60FE9056FA3C9560769734553AEF212FA504`,
generated `2026-08-20T01:04:08.226Z`, with complete lifecycle, `treeGone=true`, and no remaining PID. Typecheck, exact
lint with zero errors/three unchanged warnings, and diff hygiene pass. Current status authority is 62/2,491/
`F59E6635628F79E43B7F91BF4677C5C4385172CFF7B0BCBA0BCE9EC5995706E5`, zero staged. Fresh zero-write Luna
`01a01cb3-5172-7812-b275-ed55c0bf38c0` is auditing before the full-suite rerun.

Tool AAR: a successful worker run does not substitute for coordinator reproduction, and a child process exit with no
structured report remains red even when lifecycle cleanup succeeds. The exact retry supplied evidence; the failed launch
is retained as a non-clean validation event.

### Fresh post-restart audit acceptance — 2026-08-20

The pre-restart audit worker was no longer present after the Codex restart and therefore supplied no verdict. Fresh
native `luna_executor` Pauli `01a01d16-ae78-7ec2-9247-4afa0e297116` repeated the required audit read-only and returned
`CLEAN`: candidate hash exact at
`3E8E8966164E30E0557A9E8F36FF4997F3C6D9FB2E8C2DECD22CE8344DF9E2BC`, `HEAD == origin/main`, 62 status entries,
zero staged paths, `git diff --check` green, and no files changed. Its hostile public-contract review found no remaining
false-green path in the ready/scanning/stale coupling and reported global spawned-thread cap `4` from the fresh runtime.
The coordinator captured the terminal result and immediately closed the worker; `close_agent` returned terminal
`completed` previous status.

The tests-only correction is accepted at focused/audit scope. The next required method is the exact serial
`npm run test:e2e` rerun with verdict parsing and complete ephemeral-stack/live-root containment readback. That run
remains locked until a fresh machine-state answer confirms Antigravity state, X4 state, and a quiet machine. Product
truth remains `PARTIAL / Not verified in game`.

### Full E2E host-instability reconciliation and bounded Reload repair — 2026-08-20

Status: `FAILED REQUIRED METHOD / BOUNDED REPAIR SPECIFIED`. Ken confirmed Antigravity running, X4 absent, and the
machine quiet. The first exact `npm run test:e2e` rerun discovered 104 tests and passed tests 1-18 before the Playwright
child exited with Windows status `3221226505`; no structured report was produced, so verdict receipt
`7F1E29C5487B6CD53D4E6BA9FA3DE85CA1B5EA8E2E3F05DEC3A2011E2C0E1280` is correctly red. One bounded retry crossed
that boundary, passed through test 22, then lost the isolated backend and cascaded connection-refused failures; the
child exited `4294967295` without a structured report and receipt
`B50DCB02061A9233C881C1FBEAA8CE2B101D519B5325269B7E6E7B14EE06DC86` is red. Both lifecycle wrappers reported
complete teardown. No third full-suite retry is authorized: repeated no-report host deaths are retained as failed gate
evidence, not converted into a product pass.

The narrow diagnostic command
`node scripts/run-e2e.mjs tests/e2e/continuous-polling.spec.ts --grep "large dense workspace"` passed both dense
pointer-close and accessibility-traversal rows `2/2`, with structured receipt
`6B9CB5D7C59CC0F80A8C0B05AC3B3AC4632111967267272731A9F3BFD6C9742A`, complete lifecycle, `treeGone=true`, and no
remaining PID. This falsifies a deterministic failure in the exact dense block where the second broad run died, but it
does not clear the full-suite gate. `npm run typecheck`, lint at zero errors/592 pre-existing warnings, the runtime-index
oracle sweep `134/134`, and `npm run build` all pass. The production bundle is therefore buildable while overall B119
remains `PARTIAL` because full E2E and game proof are still outstanding.

An isolated production launch of `dist/server.cjs` on port 3200 used a disposable state/config/data root and the real
configured unpacked corpus `F:\Downskies\x4unpackersuiteV1\X4 unpacked 9.00`; it did not touch live ports 3000/3001.
Rendered in-app-browser inspection proved the permanent `Game verification / Not verified in game` state, generated-Lua
status, linter findings, preview-only refusal without exact extension-root `ui.xml` passthrough, measured keep-outs
(`wheel y=0.788`, `option stack y=0.74`, `video left edge x=0.664`), and explicit unmeasured ticker/top-strip status.
After saving the configured corpus path, server status advanced from scan to canonical ready and a full page reload
eventually rendered `Status: canonical` plus accepted canonical-default colour evidence.

That run also reproduced one bounded editor defect: after the server became ready, SourceEditor's `Reload` action could
retain the prior `idle` or `scanning` response while a full page reload obtained canonical state. The status response has
an ETag and no explicit cache-control header. Browser-cache reuse is the leading hypothesis, not yet a proven diagnosis;
loader/effect state staleness remains the alternative. The smallest causal repair unit owns only
`src/components/X4UiSourceEditor.tsx` and `tests/e2e/x4-ui-source-editor.spec.ts`. The mounted test must first observe the
effective native-fetch init for each exact core/colour reload cohort and fail because status requests do not specify
`cache: 'no-store'`. Production may then add only that request cache mode at the existing bounded corpus transport. It
must not change endpoint allowlisting, AbortSignal ownership/deadlines, corpus authority, polling, retries, server cache
policy, linter policy, renderer semantics, or the permanent game-truth warning.

Acceptance requires a recorded fail-first receipt; exact mounted structured `1/1` green with all existing 503,
stale-generation, colour, abort, page-error, and game-truth checks retained; SourceEditor focused selftests; typecheck;
exact ESLint and `git diff --check` for the two owned files; coordinator diff review; exact content hashes; post-run
ports/process containment; and preservation of every non-owned worktree path. Current pre-repair authority is production
SHA-256 `335AB14EA7EF2800E4E3B08E288E0E7EF4E031CD651FA8DD6F21B46D4F81CE57`, mounted-spec SHA-256
`5ABE7E0235FC41EAD822AC07CF59B403761ADAB2573C764D3DF67B3B1D63AC3E`, 78 status entries, zero observed validation
listeners, and no X4 process. Additional untracked Antigravity showcase evidence appeared during validation and is
explicitly non-owned. Rollback is the exact two-file repair diff; no capability-map delta.

The isolated production server and browser tab are stopped and port 3200 is free. Its exact disposable root
`C:\Users\Moshi\AppData\Local\Temp\x4forge-b119-prod-3200` contains 10 files / 160,904,914 bytes. A verified native
PowerShell cleanup command was rejected by host policy before execution, so the root is deliberately retained rather
than deleted through another shell. This cleanup failure and the two broad-run deaths are triggered AAR inputs. Engine
truth, AI Influence dogfood, deployment, and X4 execution remain pending.

### Reload repair acceptance and durable-writer precommit blocker — 2026-08-20

The Reload repair is accepted at focused scope. Native Luna `01a0225b-8c20-7be2-b798-b1c41e1ec0c3` changed only the
declared SourceEditor production and mounted-spec owners, returned terminal `completed`, and was immediately closed. Its
causal fail-first mounted run exited 1 with exact expected cache modes `["no-store","no-store"]` and observed
`[null,null]`; the structured verdict was `0/1` red with `treeGone=true`. The final candidate is SourceEditor SHA-256
`A05F47E6B117225D35EB69255C9EA215334B67C2C7FF31BB26D5C04D13059813` and mounted spec
`D15C6F4295E93D1929615329AA219317DBB2AC0D27AFA983EE2BA9EEF1B277E3`.

Coordinator review proved exact minimality without rewriting either file: deleting one production `cache: 'no-store'`
option reconstructs frozen SourceEditor hash `335AB14E...CE57`; deleting the four cache-observation/assertion lines
reconstructs frozen mounted-spec hash `5ABE7E02...AC3E`. SourceEditor focused matrices pass, including canonical colour
`12/12`; typecheck, exact two-file ESLint with zero warnings/errors, and diff hygiene pass. The exact mounted command is
structured `1/1` green at receipt SHA-256 `1EBC966BFD93FDCBAD550F1C8AB1B2B2DED32C6FE5EA8CB30DC5424A2E47266F`, generated
`2026-08-21T03:35:42.647Z`, with complete report/lifecycle, `treeGone=true`, and no remaining PID. Exact pre/post
`.studio-state`, `data`, and `config.json` content receipts match; all validation ports are free and X4 remains absent.
The rebuilt production bundle passes. This fixes browser-cache staleness only; it does not change or claim engine frame
acceptance, and every rendered surface remains `Not verified in game`.

The next required method, `npm run precommit:check`, is red at the durable-writer inventory. All earlier precommit rows
passed, then `npm run test:writers` reported exactly two coupled defects: source fingerprint declared
`5c5a82d9c66897cc9df2fccb91387a005070b083a0d306f8d5c9cde84ad84305` versus current
`92e3f28c114ab64992a327ab91afc8343551a4259e444d707d602f9b3e07ed28`, and unregistered
`src/lib/x4UiScene.selftest.ts` calls `writeFileSync:2`, `mkdirSync:2`, `rmSync:1`, `mkdtempSync:1`, `symlinkSync:2`.
This is pre-existing B119 fixture behavior exposed by the first broad precommit, not a Reload repair regression. The
exact Scene test creates two files and two directory links beneath a unique `mkdtempSync(tmpdir())` root and removes that
root in `finally`; it tests physical child-reparse escape refusal and does not write configured corpus, workspace, game,
or mod paths.

The bounded correction owns only `config/durable-writers.json`, starting SHA-256
`286890776ED5509843B13E2D62B81AAA003B9B7082E654D32EB72F329A3663F8`. It must add one honest alphabetized
`fixture-only` entry with the exact audited calls, test owner, temporary-root rationale, and cleanup/failure contract,
then replace only the top-level fingerprint with the scanner-issued current value. Frozen Scene selftest SHA-256
`34A4D496C968366A18DB6023D2F6BD91F50C2C1A066F6D75BC0944F49FF35C8F` must not change. Acceptance requires JSON
parse, scanner-to-manifest exact fingerprint/call agreement, durable-writer selftest and audit green, focused Scene
selftest green, diff hygiene, preservation of both Reload-repair hashes, and a coordinator `npm run precommit:check`
rerun. No audit bypass, call deletion, fixture weakening, or production writer change is permitted. Rollback is the
single manifest diff; no capability-map delta. The precommit red and earlier malformed read-only regex are AAR triggers.

### Durable-writer acceptance and reviewed action-receipt coupling — 2026-08-20

Native Luna `01a02268-3252-7413-8475-ef955ea9a722` changed only `config/durable-writers.json`, returned terminal
`completed`, and was immediately closed. Final manifest SHA-256 is
`AC0240CF553F505CC8F4C85A55792D16C2C39558B23546757CA954B4B8E4CF14`; deleting exactly the new fixture entry and
restoring the prior fingerprint reconstructs exact starting hash `28689077...663F8`. Scene remains byte-frozen at
`34A4D496...35C8F` and passes `139/139`; the scanner agrees on all five call counts. Worker and coordinator durable
writer gates pass: audit selftest `14/14`, 42 registered filesystem sources, 11 host-store sources, 2 browser-output
sources, and extension durable-write `8/8`.

The full precommit rerun passed writer and capability gates, then failed at action-receipt coverage because that reviewed
authority intentionally consumes `config/durable-writers.json` by indexed source reference. Exact in-memory candidate
comparison proves zero route additions/removals/changes (`82` unchanged), one added surface
`filesystem-writer:src/lib/x4UiScene.selftest.ts`, and 16 later filesystem-writer surfaces whose only change is the
deterministic `#/writers/N` index shift. Reviewed surfaces move `55 -> 56`. The candidate reviewed-manifest SHA-256 is
`dbf9366e62302d925bfd1a6bcd049b830b86dcc5aa7ce69e777c130a7c8548fa`; the current reviewed authority is
`25d7b2a12b151fd8b1039f797dd5845a0779e2e1c9bd641a6c44325de12b33b4`.

This necessary coupling supersedes the earlier classification of action-receipt drift as unrelated. The bounded unit
owns only `config/action-receipt-coverage.json` and `src/lib/actionReceiptPolicyBundle.ts`; selftest
`src/lib/actionReceiptPolicyBundle.selftest.ts` is frozen at SHA-256
`BE0ACB817F82EBBEAFF1210BF779B0B55CF4FE3F973AC95CC38F4FEC9D5E5A4D`. Starting policy source is
`51EADF9FB6B8B39D8669AB0AA24660B291F2EAB6A1DD06B3F01A1ACB9DB1007D`. The worker must use the repository's guarded
`--write-candidate` and exact-SHA/current-SHA `--promote-candidate` workflow rather than manually generating the reviewed
manifest, independently compare candidate routes/surfaces before promotion, then update only the pinned reviewed-manifest
SHA constant to the promoted manifest hash. No route, capability, receipt policy, inventory scanner, selftest, or durable
writer entry may change.

Acceptance requires candidate and promotion selftests; exact candidate comparison (`82` routes unchanged, only the one
new surface plus index-only shifts); atomic promotion/readback; policy-bundle selftest; action-receipt audit; capability
contracts; typecheck; exact lint/diff hygiene; all frozen B119/writer hashes; candidate-temp cleanup; and the complete
coordinator precommit rerun. Rollback restores the two exact pre-change hashes above. The first precommit audit red and
the intermediate writer-manifest fingerprint red remain AAR triggers; no capability-map delta.

Sequence correction: the first worker correctly stopped with zero writes because
`npm run test:action-receipt-coverage:selftest` invokes `--candidate-selftest`, whose CLI wrapper additionally runs the
currently stale imported policy-bundle selftest. Requiring that package command green before promotion is circular: the
bundle cannot validate until the reviewed manifest and its pin are updated. This does not weaken the guard. The corrected
order is standalone `--promotion-selftest`; guarded `--write-candidate` (which runs the candidate structural selftests
before writing); exact candidate diff review; exact-SHA/current-SHA promotion; pin update; then the full package-level
candidate/promotion/policy-bundle selftest, policy-bundle selftest, and audit. The initial package red is retained as
fail-first evidence. No owned file changed during the stopped attempt; the same Luna owner is resumed with this targeted
correction.

Candidate-path correction: standalone promotion selftest passed `23/23`, but the resumed worker correctly stopped again
with zero writes because the audit rejects every candidate outside the repository's `test-results` root. The prior
OS-temp authority contradicted `resolveActionReceiptCoverageCandidatePath()` and is superseded. The exact permitted
artifact is `test-results/b119-x4-ui-scene-writer.candidate.json`; its parent already exists and the candidate is absent.
The same owner may create only that regular file through `--write-candidate`, use it for exact promotion, then remove only
that file after successful readback. No directory creation or deletion is authorized. This second stop and a malformed
read-only PowerShell conditional are additional AAR triggers, not product findings.

Promotion close and selftest-oracle correction: exact candidate envelope SHA-256 is
`ffab715c659db9b958d4f11987e6ac6a74d3d8405f111b3cc9bffaeffe15076c`; guarded promotion returned `REVIEWED` with
82 routes, 56 surfaces, 95,062 canonical LF bytes, and reviewed SHA-256
`DBF9366E62302D925BFD1A6BCD049B830B86DCC5AA7CE69E777C130A7C8548FA`. Policy source now pins that exact hash at
SHA-256 `07BAA23E5E33B3C94E61FEA907DB8C940A64D45199FF2DC9F756A330276C6D27`. Independent candidate comparison passed:
routes are byte-semantically unchanged; only the Scene fixture surface was added; exactly 16 later writer references
shifted by one index with no semantic-field change. Coverage audit, capability contracts, MCP capability selftest,
typecheck, exact lint, and diff hygiene pass. The candidate regular file was verified under `test-results`, removed by
exact path, and is absent; no directory was removed.

The only reds are frozen `actionReceiptPolicyBundle.selftest.ts` rows `bundled_policy_positive_counts` and
`later_load_is_not_poisoned`, leaving that matrix `16/18`. Both literally encode the former surface count `55` in three
comparisons while route count `82` remains correct. This is a stale test oracle caused by the reviewed one-surface
promotion, not a production-policy defect. The next bounded unit owns only
`src/lib/actionReceiptPolicyBundle.selftest.ts`, starting SHA-256
`BE0ACB817F82EBBEAFF1210BF779B0B55CF4FE3F973AC95CC38F4FEC9D5E5A4D`, and may replace only those three expected
surface counts `55 -> 56`. It must retain exact route counts, hash/source-ref checks, freeze/mutation/hostile-source
coverage, and all other rows. Acceptance requires standalone `18/18`, package coverage selftests, coverage audit,
typecheck, exact lint/diff hygiene, frozen manifest/policy/writer/Scene/Reload hashes, and coordinator precommit. Rollback
is the exact one-selftest diff; no capability-map delta.

### Reviewed-policy close and broad precommit acceptance — 2026-08-21

The selftest-only correction is accepted at SHA-256
`220B6DD6F5D4CF038EDB03C32CFDB2CB8EE761BFCBB265BA61ABA4AEA93DC417`. Exact native Luna changed only three literal
surface expectations `55 -> 56`; reversing only those edits reconstructs frozen starting hash `BE0ACB81...E5A4D`.
Worker and coordinator policy-bundle selftests pass `18/18`, including exact `82/56`, reviewed hash, source references,
recursive freeze, mutation refusal, fresh reload, hostile-source refusal, and read-only bundle sources. Package coverage
selftests pass candidate `57/57` and promotion `23/23`; all authority and B119 hashes remain exact.

The complete coordinator `npm run precommit:check` now exits 0. Recorded gates are tripwire 0 hits, canonical instruction
mirrors identical, verdict selftest `54/54`, E2E Vite lifecycle PASS, shipped product-copy PASS, durable-writer selftest
`14/14`, 42/11/2 filesystem/host-store/browser-output sources, extension durable-write `8/8`, capability contract PASS
(12 capabilities, 297 disposed literal routes, 1 reviewed dynamic registrar, 11 MCP aliases; contract SHA-256
`bb467c4b70402b3dd31571dbe10d60ec05653dc6f6600f043037e993f292037c`), MCP capability PASS, action-receipt coverage
PASS at manifest `dbf9366e...548fa` / `82` routes / `56` surfaces, typecheck PASS, and large-file guards PASS. Production
build and focused mounted SourceEditor remain green. No subagent remains open; all validation ports are free and X4 is
absent.

Overall B119 remains `PARTIAL / Not verified in game`. The required exact full E2E gate is still red from the two retained
104-test host deaths without complete structured reports; the exact dense boundary passes `2/2` in isolation, but that
does not substitute for full-suite completion. The declared no-third-retry stop remains in force. AI Influence reference
dogfood, exact deploy-byte identity, C++ frame acceptance, and player-visible X4 inspection are not run. No commit or push
is authorized from this checkpoint while that required gate remains red; `HEAD == origin/main` is still the prior
checkpoint.

### AAR delta — rendered Reload through reviewed policy promotion

- Sustain: causal mounted cache observation converted a rendered stale-state report into a one-option repair, while exact
  hash reversal proved minimality and live-root receipts proved E2E isolation.
- Improve work/approach: the first action-receipt worker order required a package selftest that could only pass after
  promotion, and the first candidate path contradicted the CLI's repository `test-results` boundary. Read the complete
  mode parser and wrapper composition before issuing future promotion work orders.
- Improve tools: the coverage audit hid its validator error list behind one stable error; an in-memory candidate/manifest
  comparator was required to prove the exact one-surface and index-only delta. Two read-only PowerShell probes also used
  invalid inline `if` expression syntax, and one regex probe was malformed. Keep these as command-quality failures.
- Highest-risk evidenced weakness: the monolithic full E2E host can die before writing a complete report even when the
  nearby focused tests and lifecycle isolation are green. Until a separately planned harness-stability change supplies
  complete structured evidence without weakening one-worker semantics, the gate remains red and game/deploy claims stay
  blocked.
- Project lesson banked in this plan: durable-writer insertion is coupled to reviewed action-receipt surface authority;
  use guarded candidate generation/promotion and update the pinned hash plus exact count selftests in the same bounded
  unit. External StarForge AAR/capability records are not modified in this workspace task; no capability-map delta.

### Post-restart E2E stability contract — 2026-08-21

Status: `SPECIFIED / ONE FULL-GATE RUN AUTHORIZED`; overall B119 remains
`PARTIAL / Not verified in game` until the run produces complete structured truth.

The prior no-third-retry stop applied to the degraded host session that produced two incomplete 104-test runs. Ken then
restarted Codex and supplied a fresh machine gate: Antigravity running, X4 absent, machine quiet. Under this new runtime,
the coordinator ran two serial, isolated discriminators with no agents or competing validation processes:

- `node scripts/run-e2e.mjs tests/e2e/continuous-polling.spec.ts` passed structured `39/39`, including both former
  crash boundaries, at receipt SHA-256 `B01C1BC728F60F341E69B38E52D0E8F76F36E42595279C833D88B807B3BA1DAB`;
- the exact full-suite prefix through that file (canvas coverage, canvas interactions, capability contract, and
  continuous polling) passed structured `48/48` at receipt SHA-256
  `71EDA692F9CEF2964B296669FCFAFE6FD05A511CB0115BA4A5320634D79AC7A5`, generated
  `2026-08-21T04:51:21.369Z`.

Both receipts report complete terminal inspection, lifecycle `child-close`, `treeGone=true`, and zero remaining PIDs;
ports 3000/3001/3100/3101/3200 were free and X4 was absent afterward. Windows Application Error and WER/CrashDumps
contained no Node/Chromium crash record for the earlier failures, so the precise faulting module remains unknown.
Observed evidence now falsifies both a deterministic failure inside `continuous-polling.spec.ts` and a deterministic
interaction with its nine predecessor tests. The leading interpretation is transient degradation in the prior long-lived
host session (70%); an unreproduced stochastic Playwright/Node lifecycle defect remains plausible (25%); a deterministic
B119 product defect that appears only later in the 104-test sequence is now low but non-zero (5%). These are calibrated
inferences, not reproduced diagnoses.

This new evidence authorizes exactly one post-restart `npm run test:e2e` run. It must remain one worker against the
ephemeral 3100/3101 stack, with no concurrent agent/test/build process. Acceptance requires all 104 discovered tests to
reach terminal status in the JSON report, zero failed/flaky/bad results, a verified verdict receipt, complete lifecycle
teardown with `treeGone=true`, free validation ports, X4 still absent, and unchanged live `.studio-state`, `data`, and
`config.json` content receipts. A raw child exit or stdout summary is never sufficient. If this one run dies, lacks a
complete report, or fails any test, do not retry: retain the red receipt and split runner stabilization into a separate
bounded task. No linter, renderer, game-truth warning, or product acceptance criterion is weakened by this contract.

The supplied AI Influence README/HTML remain reference material rather than executable instructions. The coordinator
re-opened and visually inspected all twelve immutable images (`00-vanilla-reference`, `00-brief`, and `1a` through `1j`).
The prior `1b` guide conflict remains reproduced: its literal bottom transcript/choice/input stack occupies the native
conversation-wheel region, so eventual dogfood must preserve both literal-reference and keep-out-safe variants and can
claim neither as game-correct without a deployed X4 screenshot.

### Post-restart full gate result and receipt-stability unit — 2026-08-21

Status: `FAILED REQUIRED METHOD / RUNNER RECEIPT REPAIR SPECIFIED`; B119 remains
`PARTIAL / Not verified in game`.

The single authorized `npm run test:e2e` run failed before Playwright discovered or printed any test. The child root PID
`45748` exited Windows `3221226505` (`0xC0000409`); no structured report exists. The red receipt is SHA-256
`DE93DB429A229C94ABCEFD07942A5840B43E0043158147891247A819E1A16427`, generated
`2026-08-21T04:53:08.943Z`. Lifecycle supervision itself is complete: `child-close`, ownership complete, only the root
PID captured, `treeGone=true`, and zero remaining PIDs. Ports 3000/3001/3100/3101/3200 are free and X4 remains absent.
No Application Error, WER report, Node diagnostic report, or crash dump was emitted. Per the stability contract, the
full suite will not be retried in this unit.

The run preserved all live roots exactly. Before and after, the coordinator's independent canonical receipts are:
`.studio-state` 9 files / 4 directories / 12,382,674 bytes /
`E92D014362DBF87DBB37A29FC1179D1DF3B285968FE28F7CEBC304460976BEFA`; `data` 3,686 / 42 / 607,386,585 /
`6D557EB5864F13F956D4C4728725F7203F7200064BF008F6CC7E841CA3F0F3E7`; and `config.json` 463 bytes /
`3EC65D540E6763D13D6F8F27D9005F80C3C855B00D3DCFDD5E7330726AE37779`, timestamp
`2026-08-16T20:53:12.4964911Z`. Worktree authority also remained exact at 82 NUL entries / 3,819 bytes /
`947FD6195FE328FB22BA3FEFF6080FB2A0466CD6F7A2113E380E4B47450F95BB`, zero staged.

Reconciliation found a second, deterministic runner defect in the failure path. Empty stdout makes
`verdictFromStdout('')` return `totalTests: 0` but `noTests: false`; `boundedVerdict()` preserves that contradiction,
while the receipt schema correctly requires `noTests === (totalTests === 0)`. The runner therefore wrote the red JSON
above but rejected its own readback (`RECEIPT FAIL`). The host crash remains unresolved; this serializer defect did not
cause the crash, but it prevents a durable verified red receipt precisely when the harness is most needed.

The next bounded implementation owns only `scripts/run-e2e.mjs`, starting SHA-256
`F3D11583810AB8D1DF908F8649174880BB4B04B3C2664908AF52B2DA00632758`. Tests must fail first by constructing the exact
empty-stdout/no-structured-report receipt and requiring schema-valid canonical `noTests: true`, `totalTests: 0`,
`structuredReportMissing: true`, and `green: false`. Production may then normalize only the persisted bounded verdict's
`noTests` field from its canonical total count. It must not add a retry, reinterpret partial output as a pass, change
Playwright arguments, lifecycle ownership, report authority, quarantine policy, or full-gate semantics.

Acceptance requires the new causal red before production; final runner selftest all green with the added row;
`node --check scripts/run-e2e.mjs`; exact diff review proving only the selftest and canonical persisted-field fix;
immutable readback hash; and a fresh zero-write audit. The existing `npm run lint` command covers only `src` and
`server.ts`; direct ESLint on this script has a pre-existing 33-error Node-environment/config mismatch and is explicitly
not an applicable acceptance oracle. No full E2E rerun is authorized by this repair. Rollback restores the one file to
the starting hash; no capability-map delta.

AAR delta: the full launch failure repeated in a fresh runtime and invalidates the earlier 70% transient-host estimate;
an unresolved stochastic Node/Playwright/Windows launch defect is now the leading interpretation (70%), broader host
instability is secondary (25%), and a deterministic B119 product failure before discovery is very unlikely (5%). The
malformed PowerShell `rg` glob and inapplicable direct-ESLint probe are additional tool-quality failures. The highest-risk
weakness remains that a required release gate can fail before producing test truth; this unit repairs only durable red
evidence, not that launch defect.

### Node 24.15 Windows crash differential — 2026-08-21

Status: `SPECIFIED / RUNTIME DIFFERENTIAL LOCKED BEHIND RECEIPT REPAIR`; no system installation or persistent
configuration change is authorized.

Current host evidence matches a published Node failure unusually closely: Windows 11 Home build `10.0.26200`, global
Node `v24.15.0`, libuv `1.51.0`, V8 `13.6.233.17-node.48`, Playwright `1.61.0`, and loopback traffic on `127.0.0.1`.
Node issue `nodejs/node#63620` documents silent Windows `0xC0000409` exits in Node 24.15.0 during high volumes of
short-lived HTTP connects, with `127.0.0.1` reproducing in all four reported trials; its version bisect reports Node
24.16.0 clean. Node's 24.16.0 release record confirms the libuv update to `1.52.1`. This repository's long Playwright
gate performs sustained loopback API/readiness traffic, and the observed failures produce the same silent status with no
WER entry. Source: https://github.com/nodejs/node/issues/63620 and
https://nodejs.org/en/blog/release/v24.16.0.

An already-installed, read-only Codex workspace runtime provides Node `v24.19.0` / libuv `1.52.1` at
`C:\Users\Moshi\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe`. No download, package
install, PATH persistence, registry write, or system Node replacement is required. The leading root-cause hypothesis is
now the documented Node 24.15 Windows TCP-connect defect (90%); another native Node/Playwright/Windows defect is 8%; a
B119 product failure before test discovery is 2%. Exact local faulting-stack proof remains unavailable, so this is still
`[HYPOTHESIS]`, not `[REPRODUCED]` root cause.

After the one-file receipt serializer repair is causally accepted and audited, exactly one controlled A/B completion run
is authorized with a process-local PATH whose first entry is the existing Node 24.19 binary directory, invoking that
exact binary on `scripts/run-e2e.mjs`. `process.execPath` will therefore spawn Playwright with 24.19, and the PATH-local
override will also route the configured `node ... server.ts` web-server command to 24.19. The global Node installation
must remain untouched. Capture and assert the effective Node/libuv versions immediately before the run.

The differential is accepted only on the same strict 104-test JSON-report, zero-failure/flake/bad-result, verified
receipt, lifecycle/tree teardown, free-port, X4-absent, live-root parity, and worktree-preservation contract. If it fails,
do not try another flag/version or rerun. If it passes, classify the old-runtime failures as environment-specific with
high confidence, keep their red receipts, and separately reconcile a durable minimum-Node/CI/preflight contract before
calling the repository generally safe on Windows. A newer-runtime green does not verify X4 rendering or engine frame
acceptance.

### Receipt-stability acceptance and runtime differential unlock — 2026-08-21

Status: `FOCUSED VERIFIED / CLEAN`; the Windows launch defect and overall B119 full gate remain open.

Exact native Luna `01a022ac-be19-78c0-b35f-658704738b42` changed only `scripts/run-e2e.mjs`, returned terminal
`completed`, and was immediately closed. Tests-first was causal: baseline `54/54`, then `54/55` with only
`empty_stdout_receipt_canonical_no_tests` red while production remained frozen. The final one-file SHA-256 is
`836D690243CB822ADC310BCE2FE16253100C8BAB3D96E4241D2569D1115747A2`; selftest is `55/55`, `node --check` passes,
and diff hygiene passes. The production hunk computes the already bounded `totalTests` once and derives only persisted
`noTests` from `totalTests === 0`; the second hunk is the exact empty-stdout/no-report receipt row. Retry count,
Playwright arguments, stdout parsing, report authority, lifecycle, quarantine, completion, and product behavior are
unchanged.

Fresh zero-write native Luna audit `01a022b0-13a9-7a92-a4df-34472b6f1cc7` independently returned `CLEAN` with exact
candidate hash, two-hunk scope, `55/55`, syntax and diff checks green, and no files changed; it was immediately closed.
No subagent remains open. The controlled Node 24.19/libuv 1.52.1 differential described above is now unlocked. This
acceptance repairs durable fail-closed evidence only and does not convert the prior full-suite launch failure into a
pass.

### Node 24.19 differential result — full E2E accepted — 2026-08-21

Status: `FULL E2E VERIFIED ON SAFE RUNTIME / ENVIRONMENT DEFECT ISOLATED`; overall B119 remains
`PARTIAL / Not verified in game` because dogfood, deploy-byte identity, C++ frame acceptance, and player-visible X4
inspection remain open.

With no subagent or competing validation process active, the coordinator prepended only the existing bundled Node
directory to the child process PATH and invoked its exact `node.exe` on `scripts/run-e2e.mjs`. Root and a spawned child
both reported Node `v24.19.0`, libuv `1.52.1`, and the same bundled executable. No persistent PATH, registry, package,
global Node, or system setting changed.

The exact one-worker 104-test suite completed in 8.5 minutes: `104 passed / 0 failed / 0 flaky / 0 bad-result` via the
complete JSON report. Verified receipt `test-results/e2e-verdict.json` is SHA-256
`48CDE7843D32C997AF8369D8F4B601A71D149966C3CC2F6B7172CDBB0511E5D0`, 4,835 bytes, generated
`2026-08-21T05:14:50.747Z`. Report inspection discovered and terminally classified all 104 tests. Lifecycle is complete
with `child-close`, `treeGone=true`, and zero remaining PIDs. All validation ports are free and X4 remains absent.

Isolation and preservation are exact before/after: `.studio-state` 9 files / 4 directories / 12,382,674 bytes /
`E92D014362DBF87DBB37A29FC1179D1DF3B285968FE28F7CEBC304460976BEFA`; `data` 3,686 / 42 / 607,386,585 /
`6D557EB5864F13F956D4C4728725F7203F7200064BF008F6CC7E841CA3F0F3E7`; `config.json` 463 bytes /
`3EC65D540E6763D13D6F8F27D9005F80C3C855B00D3DCFDD5E7330726AE37779`, timestamp
`2026-08-16T20:53:12.4964911Z`; worktree 83 NUL entries / 3,842 bytes /
`8066F4ED9EBFBE9B3FAD2422E0D9DA517B56990320B49F3699C06E63D87629D6`, zero staged. The marketing-showcase test
updated its already untracked screenshot evidence as designed; no live workspace/config content moved.

The controlled A/B result raises the Node 24.15 Windows TCP-connect defect to 98% confidence as the mechanism behind
the silent `0xC0000409` failures: the same repository, corpus, Playwright version, tests, one-worker topology, and machine
fail under Node 24.15.0/libuv 1.51.0 yet complete under Node 24.19.0/libuv 1.52.1, matching Node's published version
bisect. Another native runtime interaction remains 2%; a B119 product-test failure is not supported by current evidence.
This is strong environment isolation, not a symbolized local crash dump. The three historical red receipts remain part
of the AAR and are not rewritten as passes.

Next gates are complete precommit and production build under the safe process-local runtime, graph refresh, durable
record readback, and a bounded B119-only commit/push with explicit staging. No in-game or deploy claim is unlocked by
E2E alone; every UI surface remains permanently labelled `Not verified in game` until X4 evidence exists.

### Host-gate close and executable checkpoint — 2026-08-21

Status: `FOCUSED/HOST VERIFIED / COMMITTED`; overall B119 remains `PARTIAL / Not verified in game`.

The complete precommit contract passed under Node `24.19.0`: e2e verdict `55/55`, Vite lifecycle, product-copy,
durable-writer selftests `14/14`, writer inventory `42 filesystem / 11 host-store / 2 browser-output`, extension durable
write `8/8`, capability contract `12 capabilities / 297 literal routes / 1 reviewed dynamic registrar / 11 MCP aliases`
at contract SHA-256 `bb467c4b70402b3dd31571dbe10d60ec05653dc6f6600f043037e993f292037c`, MCP capability checks, action-receipt
coverage `82 routes / 56 surfaces` at manifest SHA-256
`dbf9366e62302d925bfd1a6bcd049b830b86dcc5aa7ce69e777c130a7c8548fa`, typecheck, and size guards. Production Vite
and server bundles passed. The code graph refreshed to `9665` nodes / `24226` edges / `327` communities, and no
graphify process remained.

Explicit staging contained exactly 35 reconciled B119 implementation/config/test paths and no documentation,
showcase evidence, generated result file, unrelated deletion, W3B1 record, onboarding file, issue template, or other
untracked user path. Cached diff hygiene passed. Git's commit hook reran the full precommit contract successfully; the
executable checkpoint is `505253ba4fa40c75fcb252945229841766685a05`, commit title
`feat(ui): validate source-first X4 UI editor checkpoint`. Push readback proved
`origin/main == 505253ba4fa40c75fcb252945229841766685a05` and zero staged paths.

REVIEW against the request: source-backed X4 call/layout/corpus/paint projection, round-trip source editing, static
rules, keep-outs, truthful incomplete states, isolated mounted editor behavior, and broad host gates are done and
evidenced. AI Influence dogfood output, deploy-byte identity, C++ frame acceptance, and player-visible X4 comparison
remain deliberately open. No preview or test result is represented as engine proof; `Not verified in game` remains
binding. No capability-map delta.

AAR delta: `graphify update . --max-workers 2` failed safely because `update` does not accept the worker option even
though the global help displays it in another command's option block. The successful fallback ran the exact update at
below-normal process priority and verified process cleanup. Sustain explicit-path staging, immutable receipts, and the
process-local safe Node runtime. Improve the graphify CLI/help boundary and ensure future Git hooks inherit the safe
runtime instead of global Node `24.15.0`. Highest-risk evidenced weakness remains the gap between a persuasive browser
preview and C++ frame acceptance; the bounded reduction is real dogfood deployment plus exact in-game screenshots, not
stronger preview claims.

### AI Influence `1b` isolated dogfood execution contract — 2026-08-21

Status: `IN_PROGRESS / ISOLATED`; overall B119 remains `PARTIAL / Not verified in game`.

The first dogfood unit is bounded to the gitignored Forge-owned root
`F:\DEV_ENV\X4_Forge\dev-docs\b119-ai-influence-dogfood`. The real workspace mod
`F:\DEV_ENV\projects\Mods\X4Mods\x4_ai_influence`, live extension under
`G:\SteamLibrary\steamapps\common\X4 Foundations\extensions`, unpacked corpus, supplied design bundle, repository
implementation/config/state, and Git index are read-only. Baseline `aic_menu.lua` SHA-256 is
`4253D9BD9DE4113D4DE0B881DBF5A1E90CAA7B30F735BA925403EBEF7EC47DD7`. No deploy, game launch, standing-config
mutation, package install, or persistent service is authorized while Ken is asleep.

Exact native Luna `01a022df-8997-7492-b797-4cf40683f215` owns only the isolated root. It must preserve a byte-identical
baseline, create literal-reference and minimally keep-out-safe real-Lua variants, and produce seedable sanitized Forge
`ModWorkspace` JSON snapshots. The literal variant retains the supplied 2560x1440 rail/plate/dock geometry and records
its known collision with `y=0.788`, `y=0.740`, and `x=0.664`; the safe variant changes only source-level geometry needed
to clear measured guides and cannot claim pixel identity or game correctness. Both remain `Not verified in game`.

The reproducible owned driver must call existing Forge source/call/lint/layout/session/Scene/Preview/Paint/keep-out
owners using shipped corpus assets. It must distinguish bytes actually issued through Forge source-edit authority from
manual isolated source drafting; a missing authoring capability is a dogfood product gap, not permission to mislabel an
external patch. Acceptance requires bounded JSON/Markdown evidence, immutable variant hashes, exact linter axes and
projection statuses, configured-corpus provenance, selected target/sample facts, keep-out intersection truth or an exact
projection limitation, isolated mod validation, rendered Forge inspection at 2560x1440, and before/after proof that real
mod/game bytes and processes did not change. Browser parity remains preview evidence only. Deployment and X4 screenshots
remain separately write-gated.

### AI Influence `1b` mounted-sample fail-first — 2026-08-21

Status: `FAILED REQUIRED METHOD / REPRODUCED`; the isolated dogfood unit and overall B119 remain
`PARTIAL / Not verified in game`.

The corrected keep-out-safe snapshot was reseeded through the existing Studio workspace replacement API only after
the mounted browser exposed a stale isolated workspace (`F07B3E68...C069` rather than the accepted
`37FAE9C8...7A4F`). The committed isolated receipt operation is
`b119-mounted-safe-reseed-9489c57021d149c88581a7258ae688f1`; readback proved the selected
`ui/addons/ai_influence_chat/aic_menu.lua` SHA-256 is
`37FAE9C83E1FEF6319378B9B8F60711D4E44ADE54FD6B5B26A44E4FC672E7A4F`. The real mod, live extension, unpacked
corpus, Git index, and standing configuration remained read-only.

Mounted production selected `menu.display`, configured canonical core and color evidence, drawable `2560x1440`, and
UI scale `1`. With samples and keep-outs off, the canvas was honestly `rendered/current` but empty (`0`
non-transparent pixels). The public sample controls then accepted exactly nine source-ranged values: `vw=2560`,
`vh=1440`, `px@513=330`, `tw@513=1360`, `px@536=330`, `tw@537=1360`, `px@692=330`, `_choiceY=985`, and
`tw@692=1360`. All nine remained visible with no sample error, but the mounted Canvas changed to `stale`, painted
`0` pixels, and refused the resulting Paint command with
`source-literal basePreviewTints channels or declaration evidence is malformed`. Reloading both configured canonical
branches returned `canonical/canonical` and reproduced the same refusal. Screenshot
`dev-docs/b119-ai-influence-dogfood/browser-evidence/b119-sampled-stale-preview.png` is SHA-256
`197B8896E3BBC3FA38AEC2F5BC10DCDB238846EA2D3336407301EB2131238F53`.

Reconciliation changes the acceptance contract: a headless session reaching Scene/Paint and reporting real primitive
counts does not prove the mounted Canvas accepts those commands. The next production unit is tests-first and bounded to
the existing color-fact producer/consumer path. It must reproduce the exact sampled keep-out-safe source through public
Layout -> Scene -> Paint -> Canvas owners, identify whether the producer emits invalid containment/channel evidence or
the Canvas rejects valid source evidence, and repair the responsible existing owner without weakening hostile-shape,
source-containment, duplicate/reassignment, alpha-domain, or game-truth refusals. Acceptance requires a durable causal
red, focused producer/consumer selftests, exact sample-binding consumption, mounted `rendered/current` with non-zero
actual UI pixels while keep-outs are off, `Not verified in game`, typecheck, exact lint, production build, immutable
real-mod/game/corpus receipts, and clean process/port teardown. Full E2E/precommit remain required before promotion if
production changes. No deploy or X4 launch is authorized in this unattended unit. Rollback is the exact bounded Git
diff plus restoration of the isolated snapshot.

### AI Influence `1b` mounted-sample second red — 2026-08-21

Status: `FAILED REQUIRED METHOD / REPRODUCED`; the first bounded Canvas repair is necessary but not sufficient and is
not authorized for promotion.

Exact native Luna `01a02342-33e5-7d62-8071-69e4fdb87198` produced a causal focused receipt: the pre-repair Canvas
incorrectly required the `TOK.plate` use-site range to contain its separate declaration range (`115/116`), while the
same-file/sourcePath identity repair reached `116/116`. Coordinator readback under Node `24.19.0` / libuv `1.52.1`
independently confirmed `116/116`, typecheck, exact-file ESLint, diff hygiene, and production SHA-256
`565C29228899ECAA5E952D20EFB225179256EA640A26B154FAD368260FF2DCEA`. The worker returned terminal `completed`
and was immediately closed.

The required mounted method remained red after rebuilding the production bundle and restarting only the isolated
Forge server on port `3300`. Exact source SHA-256 `37FAE9C8...7A4F`, target `menu.display`, profile `2560x1440` at
scale `1`, canonical core/color corpus, keep-outs off, and the same nine values produced `stale`, the same malformed
source-literal refusal, and exactly `0` non-transparent/non-black pixels. This is stronger evidence than the focused
fixture and therefore blocks promotion.

The isolated driver was then rerun under Node `24.19.0` with read-only access to the real mod, live extension, and
unpacked corpus. Both variants consumed every accepted sample binding (`12/12` literal; `9/9` safe), reached partial
Scene/Paint, and still produced Canvas `refused` before allocation. Its safe paint contains `26` tint facts, including
three `source-literal-percent-alpha` `TOK.plate` facts whose use-site and declaration have the same file/source identity
but separate ranges. Real source, live extension, selected corpus assets, X4 absence, and observed ports matched
before/after exactly. No deployment or game mutation occurred.

Reconciled follow-up contract: preserve the first fail-first row and identity repair while deriving the next red from
the actual isolated sampled Paint facts, not a hand-built surrogate. Diagnose every predicate in the broad
`channels or declaration evidence is malformed` branch and repair only the predicate proven incompatible with valid
producer evidence. Cross-file/sourcePath refusal, declaration-to-channel/key containment, exact closed shapes,
duplicate/reassignment checks, numeric/alpha domains, pre-allocation refusal, and `Not verified in game` remain
mandatory. Acceptance remains mounted `rendered/current` plus non-zero UI pixels with overlays off; headless acceptance
alone cannot close the unit. The promotion gates and unattended no-X4 boundary are unchanged.

### AI Influence `1b` bounded Canvas acceptance — 2026-08-21

Status: `FOCUSED VERIFIED / MOUNTED RENDERED / VISUAL PARITY PARTIAL`; overall B119 remains
`PARTIAL / Not verified in game`.

Exact native Luna `01a02361-db58-7b13-99c0-9b338d40f93c` derived the second red from the sampled alias topology.
Before the second production change the focused suite was `116/117`: `TOK.plate` and its literal declaration had valid
same-source identity and declaration/channel containment but Canvas refused before any allocation solely because the
use expression text differed from the declaration expression text. Fail-first receipt
`dev-docs/b119-ai-influence-dogfood/evidence/source-literal-canvas-second-fail-first.json` is SHA-256
`E84629ABB3C567DA32E6DC36B6DF6BA766D2F0F74AF01F28D246F5667C276FAA`.

The bounded repair removes only that false expression-equality predicate. It preserves non-empty use and declaration
expressions, exact same `file`/optional `sourcePath` identity, declaration-to-every-channel/key containment, closed
records, cross-file/sourcePath refusal, duplicate/reassignment rejection, numeric/alpha domains, pre-allocation
failure, and game-truth refusal. Production SHA-256 is
`5318E9B40D28ACB73452591F0896D5CC8972E24B5F3D4DD24125ECDF85A56E3D`; selftest SHA-256 is
`334472456F1D4E418706DD518E30D023150F09533F74D374F26DAC231A6C3DC9`. Worker and coordinator focused runs both
passed `117/117`; typecheck, exact-file ESLint, diff hygiene, and production build passed. Final focused receipt
`dev-docs/b119-ai-influence-dogfood/evidence/source-literal-canvas-second-final.json` is SHA-256
`F35E9D28DE1C4C9E4128192DE5D497AEE83C7E46230B764C823C7A194EB69F79`. The worker returned terminal `completed`
and was immediately closed.

The read-only driver then accepted both sampled Canvas plans: literal consumed `12/12` bindings and rendered `39` UI
primitive commands; safe consumed `9/9` and rendered `38`; both had `0` not-applied bindings. Real source, live
extension, selected corpus assets, X4 absence, and observed ports matched before/after exactly.

Mounted production was rebuilt and rerun against exact safe source SHA-256 `37FAE9C8...7A4F`, `menu.display`, canonical
core/color evidence, `2560x1440`, scale `1`, exactly nine non-empty values, and keep-outs off. It reached
`rendered/current` with `3,686,400` non-transparent/non-black pixels and zero new browser console errors while retaining
`Not verified in game`. Census
`dev-docs/b119-ai-influence-dogfood/browser-evidence/b119-final-mounted-census.json` is SHA-256
`FFEA43F0A609F42234BBB98D3EA9FB8A55DA5AEDA046909EAA17CFCD30235073`; clean screenshot
`b119-final-rendered-current-clean.png` is SHA-256
`190B3758EA69E96114DB699E92A4E7F7D402B300B0CEFA94F2C461BE26159BAA`.

Cockpit-conversation keep-outs remained advisory and separately added cyan guide colors for measured `y=0.788`,
`y=0.740`, and `x=0.664`; overlay census SHA-256 is
`062B6A8C2374335F3A83F4655A67DD3C363E06E13E4BFBD34040C13688D465BF`. Visual review does not claim parity: the
nine-sample fixture currently appears mainly as a gray full-frame plate with a red lower strip. The Canvas refusal is
fixed and real primitives are mounted, but reconstructing the supplied AI Influence composition, exact text, and
in-game appearance remains separate dogfood work. Full E2E/precommit, fresh review, durable close, and Git projection
remain before promotion. X4 frame acceptance and player-visible comparison remain unavailable while unattended.

### AI Influence `1b` Canvas promotion close — 2026-08-21

Status: `HOST VERIFIED / COMMITTED / VISUAL PARITY PARTIAL`; overall B119 remains
`PARTIAL / Not verified in game`.

#### VALIDATE

- Focused authority: worker and coordinator Canvas `117/117`; exact production/selftest SHA-256 remain
  `5318E9B40D28ACB73452591F0896D5CC8972E24B5F3D4DD24125ECDF85A56E3D` /
  `334472456F1D4E418706DD518E30D023150F09533F74D374F26DAC231A6C3DC9`.
- Dogfood integration: literal/safe variants rendered `39/38` UI primitive commands, consumed `12/12` and `9/9`
  accepted bindings, and left `0` not-applied bindings. Real mod, live extension, selected corpus assets, X4 absence,
  and observed ports matched before/after.
- Mounted native browser: exact safe source `37FAE9C8...7A4F`, target `menu.display`, canonical core/color evidence,
  `2560x1440`, scale `1`, nine samples, and overlays off reached `rendered/current` with `3,686,400` non-black pixels
  and zero new console errors. The permanent product state remained `Not verified in game`.
- Static/build: typecheck, exact-file ESLint, diff hygiene, and production build passed.
- Full serial E2E: `104/104`, zero failed/flaky/bad result, complete discovery/terminal parity, `child-close`,
  `treeGone=true`, and no remaining owned PID. Receipt `test-results/e2e-verdict.json` SHA-256 is
  `553B20B3E323F675568B4E0171233F2F86A0DAA11E61E16168326834A7882D44`.
- Complete precommit under process-local Node `24.19.0` / libuv `1.52.1`: verdict `55/55`, Vite lifecycle,
  product-copy, writer `14/14` plus extension `8/8`, capability/MCP, action-receipt `82/56`, typecheck, and size guards
  passed. The graph refreshed to `9666` nodes / `24230` edges / `319` communities.
- Negative path: cross-file/sourcePath mismatch, declaration/channel non-containment, hostile/extra records,
  duplicates/reassignment, numeric/alpha-domain errors, and pre-allocation refusal remain covered. The two authorized
  valid-alias rows alone changed from red to green.
- Containment: `.studio-state`, live `data`, and `config.json` content receipts remained exact; ports `3100`, `3101`,
  and `3300` were free after teardown; X4 remained absent. No real mod, extension, corpus, or standing config was
  written.

#### REVIEW

- Done and evidenced: valid source-literal aliases now survive the exact Layout -> Scene -> Paint -> Canvas consumer;
  the isolated AI Influence sample paints real mounted pixels; measured keep-outs remain advisory and visible; all
  output remains explicit preview evidence.
- Partial: the current nine-sample fixture is predominantly a gray full-frame plate with a red lower strip. It does not
  yet reconstruct the supplied AI Influence mockup's exact composition, text, or visual hierarchy.
- Open and deliberately deferred: exact source/sample reconstruction, real-mod deploy-byte identity, X4 C++ frame
  acceptance, and player-visible screenshot comparison. No preview or headless gate can close these methods.
- No capability-map delta: the change repairs an existing Canvas consumer contract and adds no new capability owner.

#### DOCUMENT CLOSE AND PROMOTION

Explicit staging contained only `src/lib/x4UiCanvasRenderer.ts` and
`src/lib/x4UiCanvasRenderer.selftest.ts`; cached diff hygiene passed. Commit
`4c480418e0bb4095d0bd5935a3767b29cdd0e0f8` (`fix(ui): accept valid source-literal color aliases`) is pushed, and
readback proved `origin/main == HEAD` with an empty index. Every unrelated dirty path remains preserved. GitHub owner
issue #41 remains open because visual parity, deploy, and in-game acceptance are not complete. The same partial
checkpoint was projected and read back exactly at comment `5367932527`.

Rollback is a targeted revert of `4c480418e0bb4095d0bd5935a3767b29cdd0e0f8`; the ignored isolated dogfood root can
be discarded independently. No live-game rollback is required because no deploy or X4 write occurred.

#### AAR

- Sustain: causal fail-first receipts, mounted-pixel validation after headless acceptance, exact-file staging,
  process-local safe Node, one-worker E2E, immutable containment receipts, and immediate terminal-worker closure.
- Improve work/approach: the first Canvas repair addressed range identity but mounted retest exposed a second false
  equality between alias-use and declaration expressions. Treat producer/consumer topology as a paired mounted
  contract before promotion, not as two independent focused greens.
- Improve tools: after context interruption, unchanged HEAD and a populated index did not reveal that the original
  `git commit` hook was still running. A retry briefly created two precommit trees. Read-only PID/ancestry inspection
  reproduced the duplicate; only the newer verified tree was stopped, while the original safe-Node tree completed and
  produced the promoted commit. The first Ctrl-C ended the wrapper but left descendants alive, so exact ancestry was
  revalidated before stopping those descendants. One initial read-only PowerShell ancestry query also failed on an
  empty pipeline and was corrected before any mutation. A later pre-commit guard matched its own broad PowerShell
  command line and failed safely; executable-specific `git.exe`/`node.exe`/`cmd.exe` filtering then proved the real
  process census empty. Future resumes must inspect both Git state and matching process ancestry before retrying an
  interrupted long-running command.
- Highest-risk evidenced weakness: a pixel-producing browser preview is still a persuasive liar about X4's C++ frame
  acceptance and final player composition. The bounded reduction is an exact Forge deploy followed by X4 screenshots
  and comparison, while preserving `Not verified in game` until that evidence exists.
- Project lesson is banked in this authoritative B119 record. No external AAR-ledger or capability-map write is needed
  for this bounded consumer repair.

### AI Influence `1b` reference-flat mounted visual fail-first — 2026-08-21

Status: `FAILED REQUIRED METHOD / REPRODUCED`; the API/static fixture is accepted, but visual parity and overall B119
remain `PARTIAL / Not verified in game`.

#### BASELINE AND RECONCILE

The isolated `reference-flat` fixture rebuilt the supplied `1b` composition as one static source-owned
`menu.display`: one frame, 16 tables, 24 rows, 61 cells, 33 widgets, 37 texts, and 757 exact Zekton glyphs. Source
SHA-256 is `1D7A3D67D94894FB3A90BBE4E6BD7A3C5FA32A2EAB1DD2BC5E43F714EC7E35E2`. Folder validation is green with zero
structural/schema/lint/project errors. The first public project-API attempt sent only the nine `ModWorkspace`
passthrough files and correctly failed cross-file validation because 17 modeled MD files were absent; the corrected
public `project/create -> project/file/create -> project/validate -> project/package` round trip sent all 26 package
files, preserved every content hash, and passed with zero cross-file or X4-UI errors. The isolated Studio workspace
readback preserved all nine mounted-source hashes and the exact selected Lua hash. No validation baseline was advanced.

The disposable Forge host used process-local state/config/data/discovery roots under the gitignored dogfood directory.
Its first configured-corpus load reproduced a loader usability edge: `/api/reference/status` returned `idle`, so the UI
refused before issuing the manifest request that schedules indexing. One public `/api/reference/manifest` GET scheduled
the scan; after it reached `ready`, the mounted Reload path accepted canonical core and color evidence. This is a
separate product gap, not the cause of the visual failure below.

Mounted production selected exact source/target `aic_menu.lua` / `menu.display`, profile `2560x1440`, scale `1`, and
keep-outs off. It reported `rendered/current`, canonical corpus/color evidence, and the permanent
`Not verified in game` truth. The accepted bitmap nevertheless contains only an opaque `#6b7280` field and
red diagnostic blocks: pixel-buffer SHA-256
`8DA55D3338364071A537631670962CDC4D42229E7816F18855CDDC17AC0B95D1`, 3,686,400 non-transparent/non-black pixels,
476,624 red-class pixels, and zero cyan/green/amber-class pixels. Screenshot
`dev-docs/b119-ai-influence-dogfood/evidence/reference-flat-mounted-off.png` is 2175x876, SHA-256
`F5420C03F5212E7D4A90A6F9DBF132F1762D9173CDEBAFE708540A8B2C7175E2`. Direct visual inspection against supplied
`1b-commlink-subtitle-plate.png` (2562x1442, SHA-256
`C22D77069445514B52D0258D9AF98907AFAA2B4B2438D08EFE73FD9E67554CF2`) found no readable text, source palette,
transcript hierarchy, choice labels, or input composition in the mounted result. Cockpit keep-outs remained separate
and advisory: enabling them added 6,560 cyan-class pixels and produced pixel-buffer SHA-256
`413EA96E0076CBA9DD05DAA5FB0442E5551D6A239EA500783B909E3155E6A11F`; screenshot
`evidence/reference-flat-mounted-cockpit-keepouts.png` is SHA-256
`8222CD67F11FE2859B72CA016C48DBAC2081402F402C91ECB5DE0B917F47ED59`.

The cause is source-proven in the existing owner chain. `x4UiPaintPlan` emits known source tints and exact glyph alpha
blits, then emits every incomplete/unsupported Scene gap as a diagnostic command carrying its whole owning-node
rectangle. `x4UiCanvasRenderer` first fills every untinted structural node with diagnostic gray and later fills every
gap rectangle opaquely red. The later diagnostics therefore erase the already accepted source-colored geometry and
glyphs. This is the designed diagnostic-map behavior, but the product mounts it under `Source preview canvas`; it is
not a useful composition preview and cannot satisfy the supplied renderer request. No parallel renderer is authorized.

Frozen preimages for the bounded correction are Canvas production
`5318E9B40D28ACB73452591F0896D5CC8972E24B5F3D4DD24125ECDF85A56E3D`, Canvas selftest
`334472456F1D4E418706DD518E30D023150F09533F74D374F26DAC231A6C3DC9`, SourceEditor production
`A05F47E6B117225D35EB69255C9EA215334B67C2C7FF31BB26D5C04D13059813`, and SourceEditor selftest
`3E8FD64C40DF6526401879228FBFD9678342D9D7F53F9D11255D0A046D714CCD`. All unrelated dirty paths remain outside
this task. The server/browser were closed; ports `3300/3100/3101` are free and X4 is absent.

#### RECONCILED TESTS-FIRST CORRECTION CONTRACT

Extend the existing Canvas owner; do not add a renderer. The bounded candidate may edit only the four frozen files
above unless a causal red proves a narrower upstream owner is required. Add an explicit source-composition presentation
path for the mounted SourceEditor while retaining the current diagnostic-map path for debugging and prior contracts.
In source-composition presentation, accepted source-tinted geometry and exact Zekton alpha blits remain the visible
authority; untinted structural containers do not become opaque invented X4 surfaces; gap/unavailable/unsupported
diagnostics remain visible but may not cover the interior of accepted source-colored geometry or glyphs. Keep-outs
remain the final independent advisory layer. This does not invent X4 materials, button textures, hover/active state, or
C++ acceptance; unavailable engine paint remains explicitly unavailable and the product remains
`Not verified in game`.

Required fail-first evidence must use the real public reference-flat Preview -> Scene -> Paint result or a mechanically
extracted exact command family, not a hand-waved color sample. Before production changes it must prove that a known
source-tinted rectangle and glyph are absent from final pixels because later opaque diagnostics overwrite them. It must
also prove that the existing diagnostic-map path retains its current deterministic trace and receipt behavior.

Acceptance requires: exact Canvas and SourceEditor focused suites; the full existing producer/consumer matrix; typecheck
and exact-file zero-warning lint; hostile-shape, order, callback-mutation, corpus/font identity, alpha-domain,
pre-allocation, keep-out, stale-adoption, and permanent game-truth negatives; mounted canonical
`rendered/current` at `2560x1440` scale `1`; visual inspection showing readable Zekton text plus nonzero
cyan/green/amber source colors with diagnostics no longer opaque over the composition; advisory guide verification;
zero browser console errors; full serial E2E, precommit/build, graph refresh, exact containment receipts, and clean
process/port teardown before promotion. Visual improvement is still preview evidence, not proof of X4 parity. No real
mod deploy or X4 launch is authorized while unattended. Rollback is the exact four-file bounded diff plus deletion of
the ignored dogfood/runtime evidence.

### AI Influence `1b` source-composition correction close — 2026-08-21

Status: `HOST VERIFIED / COMMITTED / VISUAL RECONSTRUCTION PARTIAL`; overall B119 remains
`PARTIAL / Not verified in game`.

#### IMPLEMENT

- Extended the existing `x4UiCanvasRenderer` with an explicit `diagnostic-map | source-composition` presentation
  contract. The default remains `diagnostic-map`, preserving the existing deterministic diagnostic receipt and callers.
- `X4UiSourceEditor` now explicitly requests `source-composition`; no second renderer, route, state owner, dependency,
  caller-owned target surface, or X4 material claim was added.
- Source composition paints only source-proven background/border tints for node geometry, leaves untinted structural
  containers unfilled, preserves exact Zekton alpha blits, and subtracts accepted source geometry/glyph coverage from
  later gap/unavailable diagnostics. Keep-outs remain the final independent advisory layer.

#### VALIDATE

- Causal fail-first: Canvas was `118/119`; the real source-tinted rectangle and glyph ended as opaque
  `[239,68,68,255]` diagnostics and frozen production refused `source-composition`. SourceEditor separately failed its
  explicit presentation assertion. Final Canvas is `119/119`, including unchanged prior diagnostic `44/44` and final
  Stage-B `44/44`; SourceEditor's canonical color matrix is `12/12`.
- Adjacent authority matrix: EditorSession `7/7`, Paint `165/165`, Preview `102/102`, and Scene `139/139`. Typecheck,
  exact four-file zero-warning ESLint, `git diff --check`, production build, alternate-renderer/forbidden scans, and
  coordinator reruns passed. Final hashes are Canvas production
  `0AFD884CC75B9D4E7785481D473B11F346EAD5A30F3FD9F6FCE59F173B3635AA`, Canvas selftest
  `1D0D5F15CCABBBDC1F6DF65DAE55095FF4B3147C9FDABE38F909CD5B7024F8F4`, SourceEditor production
  `FB660DCF3DA8C1A9DF06F1CAD1B59A68C2F1AF00A7AE0ED50C83377886BB26B2`, and SourceEditor selftest
  `3A0B08B90AED0AA72C9E90F78D76AE714C6EFBC987EDF88F271FFC5070B13376`.
- Mounted production used exact source SHA-256
  `1D7A3D67D94894FB3A90BBE4E6BD7A3C5FA32A2EAB1DD2BC5E43F714EC7E35E2`, target `menu.display`, configured
  canonical core/color evidence, `2560x1440`, scale `1`, and keep-outs off. It reached `rendered/current`, retained
  `Not verified in game`, and had zero console errors. Pixel-buffer SHA-256 is
  `7E2702C76D73B10EF7F6889BEDEB57DD9716BB9B7145798EA28F793CC25FE300`; all `3,686,400` pixels are nontransparent/
  nonblack, with `0` exact red diagnostics and nonzero cyan (`29,281`), green (`12,023`), amber (`34,381`), and white
  (`48,991`) classification counts. Exact unavailable-gray still occupies `3,209,776` pixels.
- Clean screenshot `dev-docs/b119-ai-influence-dogfood/evidence/reference-flat-source-composition-off.png` is SHA-256
  `F30597C4E5173BC0D0AD5DFAA0A5C00BA0A449D8FCC5F91901DE1BC65A95E39C`. Direct inspection against supplied
  `1b-commlink-subtitle-plate.png` proves source text/palette are now visible, but the spatial composition, dark field,
  hierarchy, and exact reference appearance do not match.
- Cockpit keep-outs changed the pixel-buffer SHA-256 to
  `26FD9B20C8675A5860C7224246634704CF1608B5E82C901458F822D1E768269F` and visibly projected the measured
  `x=0.664` guide. Screenshot `reference-flat-source-composition-cockpit.png` is SHA-256
  `F469C127497855F61C7B7398D8AEF620E2EC361CAE44C0204FB8F7FACEEA79B8`; overlays were returned to off.
- Full serial isolated E2E passed `104/104`, zero failed/flaky/bad, `child-close`, `treeGone=true`; verdict SHA-256 is
  `9010B4821ADCB8AD16082AA0EE6006FCC68BBC99325322CE61C274F415086080`. Complete precommit passed twice under
  process-local Node `24.19.0` / libuv `1.52.1`: verdict `55/55`, Vite lifecycle, product-copy, writer `14/14` plus
  extension `8/8`, capability/MCP, action-receipt `82/56`, typecheck, and size guards. Graphify refreshed to `9689`
  nodes / `24281` edges / `301` communities before commit; the post-commit hook reported no further topology delta.
- Teardown returned Node to the pre-worker baseline `50`; ports `3100`, `3101`, and `3300` are free, X4 is absent,
  no Graphify/Forge/browser/test worker remains, and no real mod, live extension, unpacked corpus, standing config, or
  game directory was written.

#### REVIEW AND CLOSE

- Done and evidenced: diagnostics no longer erase accepted source geometry/glyphs in the mounted SourceEditor; the
  legacy diagnostic-map behavior remains available and default; exact source colors/text and advisory keep-outs render;
  the linter and permanent game-truth warning remain intact.
- Partial: `3,209,776 / 3,686,400` pixels remain unavailable-gray, layout is visibly fragmented, and the mounted image
  does not match the supplied `1b` reference. This is a useful source-composition preview, not a finished AI Influence
  screen or a pixel-parity claim.
- Deferred and still required: reduce/represent unavailable diagnostics without inventing X4 paint; reconstruct exact
  source/sample geometry for all supplied references; prove real package/deploy byte identity; obtain X4 C++ frame
  acceptance; capture and compare player-visible screenshots. No capability-map delta.
- Implementation commit `ace6d46f286593443f4fa2dc6fe0b5f6938d4d88`
  (`fix(ui): preserve source composition under diagnostics`) is pushed with `origin/main == HEAD` and an empty index.
  GitHub owner issue #41 remains open; exact checkpoint comment `5369110625` was read back after write. Rollback is a
  targeted revert of that commit; ignored dogfood evidence can be discarded independently.

#### AAR

- Sustain: one exact native Luna worker, causal fail-first raster assertions, default-contract preservation, direct
  reference-image inspection, mounted pixel census, serial safe-Node gates, immediate worker closure, process/port
  teardown, and exact-path staging.
- Improve work/approach: the first accepted bitmap criterion proved pixels existed but did not distinguish an opaque
  diagnostic map from a usable composition. Future renderer slices must include source-color/text survival and visual
  reference comparison before promotion.
- Improve tools: one coordinator batch used stale `x4UiPreview.selftest.ts` instead of
  `x4UiPreviewPipeline.selftest.ts`; one stale Playwright ref and one guessed keep-out test ID failed safely before fresh
  semantic lookup; one read-only PowerShell receipt had an empty-pipe syntax error; and a broad process guard matched its
  own command line. Each was corrected without product mutation. Prefer `rg --files`, fresh snapshots/stable test IDs,
  collected PowerShell rows, and executable-specific process filters.
- Highest-risk evidenced weakness: unavailable diagnostics can still dominate a persuasive source preview while X4
  acceptance remains unknown. The next bounded experiment is a source-composition diagnostic presentation that keeps
  incompleteness visible without replacing most of the intended dark composition, followed by the exact same mounted
  reference comparison; only subsequent real-game evidence can establish frame acceptance.
