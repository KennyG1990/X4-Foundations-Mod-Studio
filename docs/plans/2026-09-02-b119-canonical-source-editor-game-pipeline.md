# B119 — Canonical Source Editor and Live Game Pipeline Checkpoint

Date: 2026-09-02
Lane: FULL
Status: `BOUNDED VERIFIED / OVERALL B119 IN_PROGRESS / PARTIAL`

## PLAN

- **Bounded unit:** mount the reviewed B119 extension in the existing Antigravity Forge, repair the real
  `pipeline_test` false linter/source-edit refusals, prove canonical selected-target editing and preview at two Forge
  profiles, deploy the UI-only package through Forge, and verify the same source in X4.
- **Assumptions:** configured X4 9.00 unpacked corpus
  `F:\Downskies\x4unpackersuiteV1\X4 unpacked 9.00` is authoritative for Helper/widget/font data; the dedicated
  `pipeline_test` workspace and game extension are isolated from gameplay state.
- **In scope:** X4 engine-global lint ownership, selected-function source-edit provenance, installed extension/package
  identity, two-profile Forge preview, exact Forge dry-run/apply, live X4 rendering and interaction, logs, records, and
  rollback evidence.
- **Out of scope:** arbitrary Lua execution, complete `helper.lua` / `widget_fullscreen.lua` parity, universal C++
  frame acceptance, exact Forge/X4 pixel equality, AI Influence reconstruction, gameplay/save testing, and OpenVSX.
- **Risks and authorization boundaries:** the user explicitly authorized Antigravity update, Computer Use, Forge
  workspace/deploy operations, X4 launch, Git commit/push, and external records. The only game-directory target was
  `G:\SteamLibrary\steamapps\common\X4 Foundations\extensions\pipeline_test`; rollback is an exact Forge redeploy or
  the retained one-use recovery owner. No other extension or save was mutated.
- **Acceptance criteria:** installed bytes equal reviewed package bytes; the mounted Source Editor binds exact
  `ui/pipeline_test.lua -> menu.createFrame`; the canonical catalog is editable while no-corpus and forged provenance
  stay locked; linter no longer reports valid `OpenMenu`/`RemoveScript`; preview renders at both declared Forge
  profiles with permanent `Not verified in game`; Forge dry-run/apply agree on exactly four package files; X4 visibly
  renders, accepts both buttons and native edit-box input, and closes the panel without an owned runtime error.
- **Required validation and negative path:** focused selftests, TypeScript, lint, oracle sweep, build, full E2E test
  inventory, complete precommit, final-package/served-byte hashes, installed rendered-host inspection, deploy hashes,
  current-session game log, active-field close behavior, and clean game exit. No-corpus, selected-target isolation,
  forged source/metadata/order/issuance, missing workspace/client identity, and non-owned dirty paths must fail closed.
- **Evidence:** ignored screenshots under
  `dev-docs/b119-x4-ui-pipeline-smoke/source-editor-ingame-20260902/`; exact results below; owner issue GitHub #41.

## BASELINE

- Repository started at `HEAD == origin/main == 2e2a897a1625969dca9c8bc187569ca41e41d34c` with a broad unrelated
  dirty worktree. Only four implementation/test paths and B119 records belong to this checkpoint; explicit path staging
  preserved every other change.
- Installed Antigravity extension `0.0.70` initially served an older frontend. Prior same-version replacement had been
  safely reverted after native-file locks; its complete backup remained available.
- Dedicated Forge workspace: `ws_f61166c42849c757cf219c37`, `Pipeline Test UI`, workspace hash
  `9370c92de860f0e9`, snapshot hash `bac7fd9981f5984f`.
- X4 was not running before the controlled launch. The configured game profile is windowed `2544x1353`; the current run
  opened no save.

## RECONCILE

- Reused owners: shared Lua static analysis, ordered call model, layout program/Scene/Paint/Canvas pipeline, canonical
  corpus loader, source-edit catalog and evidence authority, existing Studio sidecar, project compiler/validator,
  guarded Mod Workspace, deploy planner/applier, debug watcher, and Computer Use. No parallel editor, linter, renderer,
  compiler, deployer, or web app was added.
- The real source contained valid engine-injected `OpenMenu` and `RemoveScript`, but the baseline global set omitted
  them. The selected target was also falsely locked because layout operations deliberately enrich parser output with
  derived numeric-expression and the exact shipped `Helper.headerRowCenteredProperties` fields.
- The fix remains fail closed: only parser-derived `numericExpression` omission and the exact canonical header-property
  enrichment may reconcile. Source ranges, call identity/order, Helper property identity, operation metadata, binding
  metadata, issued ordering, and owner issuance remain exact.
- Capability-map delta: canonical selected-target source editing and an installed UI-only Forge-to-X4 path now have a
  fresh exact-source receipt. This strengthens the existing B119 capability; it does not change the game-truth boundary.

## IMPLEMENT

- `src/lib/luaStaticAnalysis.ts` recognizes `OpenMenu` and `RemoveScript` as X4 engine globals and adds causal checks.
- `src/lib/x4UiSourceEdits.ts` accepts only the two source-proven enrichment differences while retaining every existing
  provenance/issuance check.
- `src/lib/x4UiSourceEdits.selftest.ts` adds the exact 5,488-byte `pipeline_test.lua`, canonical corpus loading,
  selected-function isolation, no-corpus refusal, exact catalog readiness, and raw/enriched/issued attack matrices.
- `tests/e2e/x4-ui-source-editor.spec.ts` owns its health-card fixture explicitly so mounted Source Editor lifecycle
  coverage does not depend on unrelated live readiness state.
- No mod source changed. Exact source SHA-256 remained
  `C1D9CD8580C6175E95C543259A2AB19F8B463282BF48B2229EB6013D6052718E`.

## VALIDATE

- Focused: Lua linter `33/33`; source edits `90/90`; preview pipeline `108/108`; integration `21/21`; TypeScript pass.
- Lint: exact changed paths pass with zero errors; full lint passes with zero errors and retains `592` existing warnings.
- Runtime-index oracle sweep: `134/134`.
- Build: production build passes. Reviewed and mounted browser asset is `/assets/index-BC8LFCKK.js`, `2,699,949`
  bytes, SHA-256 `AA930AAE011DA57B185FB570857EEEC8902FAFAD116C1F6EE773663762482BD2`. Installed backend
  `app/dist/server.cjs` is SHA-256 `8E1E4B14752F4C5C39D8049922135922F55C6760E407ECE8DD5A2219583942F5`.
- Package/install: exact VSIX
  `vscode-extension/x4-forge-studio-0.0.70-b119-linter-source-edits-019fea10.vsix` is `0.0.70`, SHA-256
  `2187C3FD6B6B4BB839385B97B0861EFF3B00B1A59F075B82B5CA1C3FA015E460`; installed extension bytes and served
  frontend were independently read back. No OpenVSX publish occurred.
- E2E: focused mounted Source Editor path `1/1`. The single unsharded Windows run did not produce a complete receipt
  because the long-lived Node child exited `0xC0000409`; this remains red environment evidence. Two authoritative
  serial shards covered the exact inventory at `52/52 + 52/52`, with receipt SHA-256
  `4F3967BA1D742085957D4FFEA22F04E47E9AD6E5C367715803DC516E66C94DB1` and
  `4D3FA9F759CD26F8BCBEC7C259AEC7BF19F6AC7DDAC341FAFF3F96E4881649E2`.
- Complete `npm run precommit:check` passed before commit and again in the commit hook: capability audit
  `12 capabilities / 297 routes / 1 dynamic registrar / 11 MCP aliases`, action-receipt coverage
  `882 routes / 56 surfaces`, writer and MCP gates, TypeScript, and size guards all green.
- Mounted Forge: selected exact `ui/pipeline_test.lua -> menu.createFrame`; source-owned/editable/shippable authority;
  canonical core/color/font status; 36 editable entries; no collision or generated-shadow lock; no-corpus remained
  locked. Preview rendered at `1280x720 / scale 1` and `2560x1440 / scale 1.4`; both retained permanent
  `Not verified in game`.
- Forge deploy: initial missing-target and missing-client calls refused before write. Exact dry-run and apply then passed
  every source-sync, XML, compile, preflight, deploy, byte, doctor, drift, and baseline stage for only
  `pipeline_test`. Workspace, staging package (excluding Forge metadata), and deployed target agree on:
  - `content.xml` — 367 bytes — `23A7E9A5D789DD31B5BFBFDCF7D9A6B63CB33971170C3C0E64438C77B52A5034`
  - `README.md` — 210 bytes — `31B80A5145A9E9EBAF252C91DF24D58DE29B5BED76BAECC6FB6839E4EDF1C871`
  - `ui.xml` — 273 bytes — `655331A4423A550532042B23C8E60141A60DCC0E1C42D4DE6DA653DAAD1C1689`
  - `ui/pipeline_test.lua` — 5,488 bytes — `C1D9CD8580C6175E95C543259A2AB19F8B463282BF48B2229EB6013D6052718E`
- Real X4: at the configured windowed `2544x1353` profile, X4 9.00 rendered the exact panel, titles, status, two
  buttons, and edit box. Both buttons accepted pointer interaction; the edit box accepted native key `a`; the first
  close click deactivated the active edit box and the next standard-close click removed the panel. X4 remained
  responsive and then exited cleanly; final X4 process count is zero.
- Current debuglog: zero `pipeline_test` owned runtime errors, zero `DisplayView`/view-setup failures, and no Lua stack
  failure for the fixture. Forge's watcher honestly returns `not_seen`, not clean machine proof, because the fixture has
  no positive boot marker. The rendered/interacted host is positive experience evidence; marker coverage remains open.
- Screenshot hashes:
  - Forge 1280 profile: `319E8043ECD0ACB6ABD4ABA9DB8B5607FD0ED812EBD2D2E9EF28F6CBA4FA37C5`
  - Forge 2560 profile: `05596A7E60221351F7FA6EB20824EEF5FDFFF9AAEF6D69EC36E6CD4AB6261660`
  - X4 open: `184CE882BD2FD9EB1A03879E4D0A1E9DE525CF23403645831E5A54B90496F798`
  - X4 edit box: `616D778296D36E48577E943639CEDC2EA2F06BBA6272A210DC7361A4FAF47D9F`
  - X4 closed: `489787B5F98F1B29FDEB68FDEA002627BF6EF9835EF735832A08D26093B4645A`

## REVIEW

- **Done and evidenced:** exact installed frontend/backend identity; canonical source-backed selected-target editing;
  engine-global lint correction; provenance attack refusal; two Forge preview profiles; exact UI-only deploy; real X4
  frame acceptance, buttons, native input, standard close, scoped log result, clean process exit, and exact Git parity.
- **Partial:** Forge and X4 were not captured at the same exact drawable/UI-scale pair in this continuation, so no new
  pixel-diff or 1:1 claim is made. The prior two-profile X4 scaling receipts remain valid but do not universalize frame
  acceptance. The silent fixture lacks a positive machine-readable boot marker.
- **Open:** complete linter/Helper/widget coverage, remaining source-composed/dynamic UI branches, measured keep-out
  overlays across real contexts, AI Influence screen reconstruction from all supplied images, release acceptance, and
  OpenVSX publish-before-commit.
- **Final bounded status:** `VERIFIED`. **Overall B119:** `IN_PROGRESS / PARTIAL`. Preview remains
  `Not verified in game` by product design even when a separate exact deploy has game evidence.

## CLOSE

- Source commit `bc686eb47cad5dc42243dedf482f85b57bfcc5c7` contains exactly four owned files and is pushed with
  `HEAD == origin/main == git ls-remote`; zero path remains staged.
- GitHub #41 remains open; comment `5510457342` was written and read back. Notion owner
  `3b84618e-d15b-8190-821e-c0eb96f43d5a` remains `In Progress / Partial` and contains the checkpoint.
- Google Current Status document `17VLaIsT499KHg7zg30hOyLaBXB0-9jlrX3dQ63s3dtE`, tab `t.0`, was protected-read and
  revision-guarded from `ANLCKQns7Ywz-nOshDuawo2V6oAAadvCEMfEL07UZgkczSTf3BcATXkViurs0KmInVmYNeQEZu0LgvxMu2eYnsJ1SgQHrmTEZ45_j_Udgrio`
  to `ANLCKQnNd6iVCfBusgAjOMlguoEO653tWFSs8Q3fX6V7orjHuejYVMNMMkDikxHbKrmiDnRYQryRXfi6PjNVXbETgO6-UZDapHeYBUSN6Rsh`.
  Readback proves the new marker is `HEADING_2`, all nine body paragraphs are `NORMAL_TEXT`, and the prior native date
  chip plus out-of-scope structure remain intact.
- X4 UI quick-reference cards 21-23, the X4 Forge capability-map delta, and project AAR were written and read back.
  Commit-hook Graphify completed with no lingering process at `10,122` nodes / `25,488` edges / `312` communities.
- No unrelated dirty file, save, neighboring game extension, provider credential, public extension, or OpenVSX state
  changed.
- Suggested record commit title: `docs(ui-editor): record canonical Forge-to-X4 checkpoint`.

## AAR

- **Sustain:** use the configured corpus, retain exact source and package hashes, fail closed on provenance, inspect the
  installed rendered host, deploy through Forge, and make X4 interaction—not preview confidence—the authority.
- **Improve work/approach:** the real selected target should have been part of source-edit acceptance earlier. Synthetic
  operation matrices passed while parser-derived enrichment still locked the canonical fixture.
- **Improve tools:** unsharded E2E remains vulnerable to Windows `0xC0000409`, while exact serial shards are stable;
  generic text injection did not reach X4 direct input but native key events did; debug-watcher absence of an owned
  marker correctly prevents a clean machine verdict despite strong visual proof. The Google Docs code isolate lacked
  both `atob` and `TextDecoder`; two pre-connector loader attempts failed without mutation before deterministic base64
  and UTF-8 decoding loaded the checked-in trusted-read bridge byte-exactly.
- **Triggered events:** missing workspace/client API calls refused safely; one health-card fixture needed explicit
  ownership; unsharded E2E failed to complete; the first edit-box close click deactivated input before standard close;
  several diagnostic PowerShell probes needed narrower syntax/path corrections. None changed the product boundary.
- **Highest-risk evidenced weakness:** canonical metadata enrichment can look like provenance drift and lock real source,
  while relaxing equality broadly would permit forged edits. The bounded normalizer accepts only two source-proven
  differences and retains raw/enriched/issued attack matrices.
- **Project lessons banked:** concise cards in the X4 UI quick reference; delta in the X4 Forge capability map; this
  triggered AAR in the project ledger.

## 2026-09-02 CONTINUATION — mounted canvas reconciliation

### PLAN

- **Bounded unit:** repair the mounted Source Editor transition from its initial no-selection refusal to the exact
  renderable `ui/pipeline_test.lua -> menu.createFrame` canvas, then capture native bitmap dimensions at the configured
  X4 `2544x1353 / UI scale 1` profile.
- **Baseline:** `HEAD == origin/main == 0cff4627a87cb754cea50440a7f8eefd98c2dea0`; the index is empty and the broad
  unrelated worktree remains preserved. A fresh sidecar browser selected the exact source and target but retained
  `canvas status: refused`, the initial missing-identity detail, and zero canvas children. Reselecting another exact
  target and returning to `menu.createFrame` reproduced the same result with no browser warning or error.
- **Reconciliation:** the current pure owners, run against the retained Pipeline Test workspace snapshot and the live
  configured corpus, return exact selected source/target authority, `status: partial`, `Scene: partial`, `Paint:
  partial`, `canRender: true`, and `preview and paint accepted; Not verified in game`. The failure is therefore bounded
  to mounted canvas lifecycle/commit behavior; no new parser, renderer, corpus loader, or editor product is authorized.
- **In scope:** the existing Source Editor mount/commit owner plus causal component/E2E regressions; native canvas
  width/height evidence; permanent `Not verified in game` truth text.
- **Out of scope:** changing Lua or the deployed mod, relaxing source/corpus authority, hiding partial geometry gaps,
  universal frame acceptance, AI Influence reconstruction, and OpenVSX.
- **Rollback:** revert only the exact bounded component/test paths; the mod, deployment target, installed extension,
  workspace, and prior evidence remain unchanged until a reviewed package is deliberately installed.
- **Acceptance:** a mounted editor must begin refused without selection, transition to a current non-stale canvas after
  exact source/target selection and canonical corpus acceptance, replace rather than accumulate surfaces across profile
  changes, expose the native bitmap dimensions through the existing canvas element, preserve fail-closed no-corpus and
  stale-result behavior, and never change `Not verified in game`.
- **Validation:** causal fail-first test; focused Source Editor/session/Paint/Canvas tests; TypeScript; exact lint; mounted
  serial E2E with zero page/console errors; production build; installed-host inspection; same-profile Forge/X4 geometry
  comparison. The negative path is missing selection or corpus producing no current canvas and no false success.
- **Evidence:** `dev-docs/b119-x4-ui-pipeline-smoke/source-editor-ingame-20260902/`; GitHub #41 and the existing B119
  Notion/Drive owners remain the external projections.

### RECONCILE REVISION

- The initial direct-sidecar refusal did not survive reconciliation as an installed-product defect. The supported
  Antigravity host visibly retained one `Rendered/current` bitmap at exact `ui/pipeline_test.lua -> menu.createFrame`,
  canonical core/color authority, and `2544x1353 / scale 1`.
- A causal mounted diagnostic against the unchanged production component transitioned from no selection to exactly one
  canvas and replaced it on profile change. The native attributes were `2560x1440` for that test's default profile and
  `1800x900` after replacement. Its only initial red was the test's incorrect `2544` expectation.
- The direct sidecar browser still retained the initial refusal after explicit blank/reselect. Current evidence assigns
  about 90% likelihood to client-state/corpus-readiness divergence and 10% to an uncovered product edge. That surface
  is not sufficient authority for a production patch while the installed host and mounted diagnostic are green.
- A portable ephemeral-corpus variant remained unavailable while the fresh manifest was `idle` for the bounded
  30-second window. The temporary hardcoded `127.0.0.1:50239` proxy and every experimental test change were removed.
  No implementation or test file remains changed.

### VALIDATE / REVIEW / CLOSE

- Installed-host visual inspection: exact selected source/target, profile `2544x1353 / scale 1`, canonical core/color,
  one visible panel bitmap, and permanent `Not verified in game` boundary.
- Same-profile X4 run: exact four-file package rendered; both buttons responded; the edit box accepted native key `a`;
  standard close removed the panel; X4 exited cleanly; zero owned runtime/view-setup errors.
- Screenshot-space comparison: Forge and X4 panel/button/editbox geometry agree after the Forge host's approximately
  `1.515x` display resampling. Exact native pixels and Zekton glyph positions remain unproven.
- Restored-tree validation: Source Editor selftest passed all reported matrices including P7 `12/12`; UI integration
  passed `21/21`; TypeScript and exact owned-path ESLint passed; serial Source Editor E2E passed `1/1` with
  `treeGone=true`; ephemeral ports `3100/3101` stopped.
- Parent close rerun reproduced those gates on the restored tree: UI integration `21/21`, Source Editor P7 `12/12`,
  TypeScript, exact owned-path ESLint, and focused mounted E2E `1/1`. The E2E process tree is gone and neither
  `3100` nor `3101` has a listener. Its inert per-run state directory
  `%TEMP%\\x4forge-e2e-state-27916` remained after the wrapper exited; an exact path-validated cleanup command was
  rejected by host policy, so the directory is retained and not disguised as clean teardown.
- Requirement review: mounted installed preview, same-profile game acceptance, interaction, close, and proportional
  geometry are done and evidenced. Native bitmap extraction, pixel equality, complete Helper/widget coverage, full
  keep-out context coverage, AI Influence reconstruction, release acceptance, and OpenVSX remain open.
- **Bounded status:** `VERIFIED` for the same-source/same-profile pipeline and proportional geometry comparison.
  **Pixel-parity status:** `PARTIAL`. **Overall B119:** `IN_PROGRESS / PARTIAL`. No OpenVSX release is claimed.

### AAR DELTA

- **Sustain:** require the supported installed host and causal mounted test to agree before changing production.
- **Improve work/approach:** the first direct-sidecar symptom was prematurely localized to the canvas lifecycle. The
  stronger installed-host observation and baseline mounted test disproved that diagnosis before source changed.
- **Improve tools:** the fresh ephemeral corpus can remain manifest-idle beyond one standard E2E window, while a live
  sidecar is canonical. Default E2E must not hardcode that sidecar; retain host-specific probes as evidence only. The
  focused wrapper's `treeGone=true` proves process-tree termination, not deletion of its state directory; inspect and
  record both surfaces separately.
- **Highest-risk evidenced weakness:** a convincing automation surface can diverge from the supported host. Patching to
  that surface would create an uncaused repair. Reproduce in the installed host or a portable causal test first.

### DURABLE PROJECTION READBACK

- Repository checkpoint `27c1470ecd5179e8e40f9184e89c2df320ce698b` passed complete precommit directly and in
  the commit hook, was pushed, and matched local `HEAD`, `origin/main`, and direct remote `main` exactly.
- GitHub #41 remains open; comment `5512448232` was written and read back with the bounded verified/overall partial
  boundary intact.
- Notion owner `3b84618e-d15b-8190-821e-c0eb96f43d5a` was updated in place and read back as
  `Status=In Progress / Evidence Grade=Partial`, with the exact commit and GitHub comment present.
- Google Current Status document `17VLaIsT499KHg7zg30hOyLaBXB0-9jlrX3dQ63s3dtE`, tab `t.0`, was updated under an
  exact revision guard and read back at revision
  `ANLCKQnsxhUytocioHZoSZ9nBJM6LYlVGnu4fP12TgwXXEYIXv8VYVSmlEsZ2ONWb82TTAFecuEXEUd0mSx2inNNzbUj97FOTABQRY1qRxhw`.
  Its new marker is exactly one `HEADING_2` followed by eight `NORMAL_TEXT` paragraphs.
- The first Docs append inserted before the previous terminal period, leaving the old paragraph unpunctuated and the
  new final paragraph double-punctuated. A second revision-guarded delete/insert repaired both; final readback is clean.
  This formatting retry is an AAR trigger, not a product failure.

## 2026-09-02 CONTINUATION — native preview bitmap evidence export

### PLAN

- **Bounded unit:** extend the existing Source Editor canvas mount with a current-only native PNG export and exact
  bitmap/source/target/profile identity. This produces an inspectable Forge evidence artifact for the next pixel/font
  comparison; it does not change or duplicate renderer, layout, corpus, source-edit, deploy, or game-truth authority.
- **Baseline:** `HEAD == origin/main == direct remote == 7a500b74e618fc3aa9a17261edda3d1f936b4c9b`; the broad
  unrelated worktree remains preserved and the index is empty. Installed Antigravity visibly holds one current
  `ui/pipeline_test.lua -> menu.createFrame` canvas at `2544x1353 / scale 1`. X4 is absent. The direct sidecar client
  remains non-authoritative for this installed-host comparison.
- **Reconciliation:** `renderX4UiPaintPlanToCanvas` already allocates the composite through the existing surface
  factory; the browser factory returns an `HTMLCanvasElement`; `X4UiEditorCanvasState` already retains the exact
  current surface and immutable rendered receipt; and the Source Editor directly mounts that surface. No export owner
  or download control exists. Reuse these resources rather than creating another bitmap or rendering path.
- **In scope:** `src/components/X4UiSourceEditor.tsx`, its selftest, and the focused Source Editor E2E only. A pure
  current-export classification/helper may live in that component; no backend route or persistent store is authorized.
- **Out of scope:** changing paint pixels, adding an image encoder, accepting non-DOM test surfaces as product PNGs,
  changing preview/game truth, comparing against X4 in this first unit, installing a package before source gates pass,
  changing the deployed mod, or publishing OpenVSX.
- **Risks:** a stale surface could be exported under current source/profile labels; a DOM serialization error could be
  presented as success; a hostile filename could escape intended naming; a download action could accidentally imply
  engine verification. Fail closed and keep `Not verified in game` adjacent to the control.
- **Rollback:** revert only the exact component/selftest/E2E paths. The installed extension, workspace, mod, game,
  prior screenshots, external records, and deployed package remain unchanged until a separately reviewed install gate.
- **Acceptance:** (1) empty/refused/stale/non-DOM states cannot export; (2) current receipt dimensions must equal the
  mounted canvas attributes; (3) metadata shows exact source file, target, drawable profile, UI scale, and native bitmap
  size; (4) export uses the already-mounted current canvas and creates one `image/png` download with a deterministic
  sanitized filename; (5) missing/throwing/empty serialization leaves a visible refusal and no download; (6) profile or
  selection replacement invalidates old export identity; (7) permanent `Not verified in game` remains literal.
- **Validation:** causal helper/component negatives; existing Source Editor selftest including P7; TypeScript; exact
  ESLint; focused mounted E2E proving no control before a current surface, one current canvas/export after canonical
  selection, exact `2560x1440 -> 1800x900` replacement identity, one PNG download, no stale export, zero page/console
  errors, complete lifecycle, no `3100/3101` listeners, and unchanged live workspace. Installed-host packaging/export
  is a later gate after source review.
- **Evidence:** this plan; focused test receipts; eventual installed export under
  `dev-docs/b119-x4-ui-pipeline-smoke/source-editor-ingame-20260902/`.

Status at plan time: `SPECIFIED`. No capability-map delta.

### IMPLEMENT / VALIDATE / REVIEW CHECKPOINT

- The existing mounted-canvas owner now exposes a current-only PNG evidence export. It serializes the already-mounted
  `HTMLCanvasElement`; it does not rerender, add an encoder, add a backend route, or persist a second bitmap.
- Exact adjacent metadata reports source file and digest, selected target, normalized drawable profile, UI scale, and
  native bitmap dimensions. The control and success/refusal text retain literal `Not verified in game`.
- Empty, refused, stale, non-DOM, malformed-receipt, dimension-mismatch, superseded-identity, missing/throwing/empty
  serialization, and stale-selection paths fail closed with no successful download receipt.
- The first causal red proved the classifier/control/metadata were absent. The implementation then passed the complete
  Source Editor selftest, P7 canonical-color matrix `12/12`, TypeScript, exact three-file ESLint, and the exact focused
  E2E `2/2` with zero failed/flaky/bad-result and `child-close, treeGone=true`.
- Fresh-eyes review reproduced one medium stale-callback defect: two distinct source identities can sanitize to one
  filename, so filename plus a reused canvas object was not exact completion authority. The causal red observed equal
  filenames and missing identity keys. The minimal correction carries the canonical identity key and compares it again
  when `toBlob` completes.
- Coordinator post-correction reruns pass: selftest including P7 `12/12`; whole-repository TypeScript; exact three-file
  ESLint; focused E2E `2/2`; no listener remains on `3100/3101`; the installed live Forge sidecar remained running.
- **Bounded source status:** `VERIFIED`. **Installed-host/export status:** `PENDING`. **Overall B119:**
  `IN_PROGRESS / PARTIAL`; preview remains `Not verified in game` and OpenVSX remains out of scope.

### AAR DELTA

- **Sustain:** bind asynchronous evidence completion to exact source/target/profile authority, not a display label or
  sanitized filename; retain causal red-to-green proof and rerun the ordered full spec after isolated tests.
- **Improve work/approach:** the first candidate checked current canvas, current classification, and filename, but did
  not separately preserve the issued identity key across asynchronous completion. Fresh-eyes race review found it.
- **Improve tools:** the focused E2E required a bounded ready-manifest fixture because the ephemeral scanner can remain
  `idle/scanning`; early fixture attempts and one transient port collision failed before the final exact two-test pass.
- **Highest-risk evidenced weakness:** a convincing PNG can be stale while its safe filename appears unchanged. Exact
  identity-key comparison now closes that path; installed Antigravity download behavior remains the next authority.

### INSTALLED-HOST / NATIVE-PIXEL VALIDATION

- Complete isolated-worktree precommit passed. Production and extension builds passed; stage/probe passed `16/16`.
  Reviewed package `x4-forge-studio-0.0.70-b119-native-png-019fea10.vsix` contains `2,092` entries, is
  `18,600,594` bytes, and has SHA-256 `377B555B6CF8FFD9A24B3A2D1EAAA2C582C4E4A5EAEBCB7F6BA9E25A07835A21`.
- The installed `0.0.70` extension was backed up to
  `C:\Users\Moshi\AppData\Local\Temp\x4forge-b119-install-backup-20260902-140638`, replaced reversibly, and checked
  byte-for-byte against the reviewed package for the extension host, sidecar, server, HTML, CSS, and frontend bundle.
  The only package-directory delta was the IDE installer's expected `__metadata` field.
- In installed Antigravity, the exact canonical source `ui/pipeline_test.lua` at SHA-256
  `C1D9CD8580C6175E95C543259A2AB19F8B463282BF48B2229EB6013D6052718E` and target `menu.createFrame` produced one
  current mounted canvas. The export control retained `Preview evidence only · Not verified in game` and saved one
  PNG with native bitmap dimensions `2544x1353`.
- Entered scale `1` artifact:
  `dev-docs/b119-x4-ui-pipeline-smoke/source-editor-ingame-20260902/forge-native-preview-export-2544x1353-scale1-20260902.png`;
  `84,189` bytes; SHA-256 `473173A568D1BA5B7405AE1314471FB8FD012E959E3BC597B5B28E3C7D4A076B`;
  non-black panel bounds `x=1007..1535`, `y=458..618`, `529x161`.
- The corresponding X4 capture is approximately `666` pixels wide at `x=939..1604`. Native pixels therefore reject
  the earlier claim that entered Forge scale `1` and X4's user scale setting `1` are the same effective profile.

### RECONCILIATION REVISION — USER SCALE IS NOT `Helper.uiScale`

- Shipped `helper.lua` assigns `Helper.uiScale = C.GetUIScale(false)` and `scaleX` / `scaleY` multiply by that value.
  Shipped `targetsystem.lua` states that `C.GetUIScale(false)` practically equals the user UI-scale factor multiplied
  by a resolution factor and shows `resolutionFactor = screenHeight / 1080`.
- At drawable height `1353`, that factor is `1353 / 1080 = 1.25277777777778`. Re-entering this as the current Forge
  profile's effective scale produced an installed-host PNG exactly `2544x1353`, `90,917` bytes, at:
  `dev-docs/b119-x4-ui-pipeline-smoke/source-editor-ingame-20260902/forge-native-preview-export-2544x1353-effective-scale-1.252777778-20260902.png`.
- The corrected artifact's non-black/blue bounds are `x=940..1602`, `y=403..605`, `663x203`. Against X4's
  approximately `666`-pixel panel at `x=939..1604`, width differs by `3` pixels (`0.45%`) and center differs by less
  than one pixel. Full panel height is also approximately aligned; JPEG/background composition prevents treating the
  X4 screenshot's threshold mask as an exact alpha oracle.
- **Reproduced defect:** the layout kernel consumes an effective `Helper.uiScale`, but the Source Editor labels its
  direct input `UI scale`, inviting users to enter the game's user-scale option. The renderer port itself is strongly
  corroborated at this bounded frame; the profile contract is misleading.
- **Revised next bounded unit:** preserve the kernel's effective-scale input and all existing internal receipts; expose
  user UI scale separately and derive/display the effective value from drawable height and the shipped 1080 baseline.
  Add causal unit/component/E2E coverage for the derived profile, explicit/custom-effective fallback, invalid inputs,
  and permanent `Not verified in game`; then repeat installed export and X4 comparison.
- **Status:** native PNG export `VERIFIED`; pixel geometry for this frame `BOUNDED VERIFIED` within screenshot/JPEG
  tolerance; profile-control semantics `FAILED / REPRODUCED`; overall B119 `IN_PROGRESS / PARTIAL`. Exact Zekton
  metrics, complete Helper/widget coverage, release acceptance, and OpenVSX remain open.

### AAR DELTA — NATIVE PROFILE TRUTH

- **Sustain:** export and measure native bitmaps before interpreting resampled host screenshots; ground scale semantics
  in shipped X4 source comments and helper assignments.
- **Improve work/approach:** the prior same-profile claim equated X4's user setting with `Helper.uiScale`. Native pixels
  disproved it; the corrected effective scale explains essentially the entire width delta.
- **Improve tools:** Windows' Downloads known folder resolves to `F:\Downskies`, not the literal user-profile folder;
  artifact collection must resolve the known-folder location before declaring a download missing.
- **Highest-risk evidenced weakness:** a renderer can be mathematically faithful yet mislead users through a mislabeled
  profile control. Keep user-scale and effective-scale authority explicit and inspectable.

### DURABLE PROJECTION READBACK

- Repository checkpoint `1799dc6145e39a35c7e6f816da793fc691b53df0` passed complete precommit directly and
  again in the commit hook, was pushed, and matches local `HEAD`, `origin/main`, and direct remote `main` exactly.
- GitHub #41 remains open. Comment `5514694526` was written and read back with the exact commit, current-only export,
  installed package hash, `529 -> 663 versus ~666` comparison, and overall `IN_PROGRESS / PARTIAL` boundary.
- Notion owner `3b84618e-d15b-8190-821e-c0eb96f43d5a` was updated in place and read back as
  `Status=In Progress / Evidence Grade=Partial`; its properties and appended checkpoint contain commit `1799dc6`,
  GitHub comment `5514694526`, effective scale `1.252777...`, and no OpenVSX claim.
- Google Current Status document `17VLaIsT499KHg7zg30hOyLaBXB0-9jlrX3dQ63s3dtE`, tab `t.0`, was updated under the
  prior exact revision guard and read back at revision
  `ANLCKQnPV2tiWmIsxqdSqFY7Da7kUB6J0Vy4fh6H79AaVrF0TARj2mfS1QqH4NkY5724ZZDrMx2d5lqfuHVtVdYJUD6svM1BaIqew2yYe290`.
  The new marker is exactly one `HEADING_2` plus eight `NORMAL_TEXT` paragraphs with the same bounded status.
- X4 UI quick-reference card 25 records the wrong/right/why lesson for user scale versus effective `Helper.uiScale`.
  Readback path is `F:\StarForge\wiki\x4-modding-methods\07 UI (Lua widgets, menus, overlays)\ui-modding-gotchas-quick-reference.md`,
  lines 333-348; SHA-256 `6DF79A06976F26CC78EACECBE09F8FE5D17B2CAE43B44D7DC36F03AB2E5040DC`.
- No capability-map delta: this corrects the profile interpretation and strengthens evidence for the existing B119
  layout/renderer capability; it does not promote universal parity or engine acceptance.

### BOUNDED UNIT — SOURCE-FAITHFUL USER/EFFECTIVE SCALE CONTROLS (`SPECIFIED`)

**PLAN**

- **Bounded unit:** correct only the canonical Source Editor's scale controls while retaining normalized
  `profile.uiScale` as the effective `Helper.uiScale` consumed by the existing Session, preview, layout, Scene, Paint,
  canvas, verification, and export owners.
- **Authoritative source:** configured X4 9.00 `helper.lua` lines 735 and 832-842; `targetsystem.lua` lines 945-950;
  current profile owner `src/lib/x4UiEditorSession.ts`; current control/export owner
  `src/components/X4UiSourceEditor.tsx`.
- **In scope:** derived mode `effective = userScale * drawableHeight / 1080`; an explicit custom-effective fallback;
  unambiguous user/effective labels and export filename/metadata; causal pure/component/E2E tests; permanent
  `Not verified in game` state.
- **Out of scope:** changing the normalized profile schema or kernel meaning, reading X4 settings automatically,
  HUD scale, width-derived scaling, arbitrary C++ behavior, renderer expansion, game confirmation, release acceptance,
  or OpenVSX publication.
- **Compatibility:** the existing unverified default remains effective scale `1.4` at `2560x1440`; derived mode exposes
  the corresponding user factor `1.05`. This preserves existing internal receipts without claiming that the default is
  captured game truth. Changing user scale or drawable height recomputes the effective value; custom-effective mode
  preserves its explicit effective value across height changes.
- **Risk:** stale canvases or ambiguous evidence if user and effective values diverge. Rollback is the bounded source
  commit; current pushed checkpoint `47ce998bea73fc2a0ecf3645663c00141b93b72b` is the recovery target.

**ACCEPTANCE CONTRACT**

1. Exact finite positive inputs derive `1 * 1353 / 1080 = 1.252777777777...`; reverse derivation recovers `1` within
   floating-point tolerance. Zero, negative, non-finite, and malformed inputs fail closed without entering a profile.
2. Derived mode is explicit, changing height reprojects with the current user factor, and changing width does not alter
   effective scale. Custom-effective mode permits a positive effective value and does not silently recompute it.
3. Existing downstream profile and verification receipts still carry one effective `uiScale`; no second renderer,
   profile schema, persistence owner, backend route, or deploy authority is introduced.
4. Export metadata says `Effective Helper scale`; the deterministic PNG filename identifies `effective-scale`; stale,
   superseded, malformed, and serialization-negative behavior remains refusal-only.
5. Focused Source Editor selftest, exact ESLint, TypeScript, and focused browser tests pass, including derived/custom
   mode transitions and the unchanged permanent `Not verified in game` boundary.
6. After package/install proof, installed Antigravity at `2544x1353 / user scale 1` exports a native bitmap whose
   effective value is `1353/1080`; a fresh X4 comparison is required before this unit can close `VERIFIED`.

**BASELINE / RECONCILE**

- Baseline is `HEAD == origin/main == 47ce998bea73fc2a0ecf3645663c00141b93b72b`; the broad unrelated dirty tree is
  preserved. Antigravity is open, X4 is absent, and the operator reported the machine quiet.
- Graphify confirms `X4UiSourceEditor` owns the control boundary; exact search shows all downstream readers treat
  `uiScale` as the effective multiplier. No ADR contradicts the correction. No capability-map delta is warranted until
  runtime validation strengthens the existing B119 capability claim.

**IMPLEMENT / VALIDATE CHECKPOINT — 2026-09-02**

- One exact native `luna_executor` changed only `src/components/X4UiSourceEditor.tsx`, its selftest, and the focused
  Source Editor E2E spec. The component now derives the effective scale without rounding, retains a custom-effective
  mode, labels evidence unambiguously, and emits `effective-scale` PNG identity.
- Deterministic evidence is green: Source Editor selftest exit `0`, whole-repository TypeScript exit `0`, exact
  three-file ESLint exit `0`, and scoped `git diff --check` exit `0`.
- `[REPRODUCED]` The required focused E2E remains red. Repeated one-minute attempts reached valid React state
  (`profile.uiScale = 1.2`, derived effective control disabled as intended), then timed out while Playwright attempted
  a subsequent ordinary profile input edit. Ports `3100/3101` stopped and no matching E2E process remained.
- `[HYPOTHESIS]` Existing synchronous canvas work monopolizes the browser after several rapid high-cost profile
  transitions. This is not evidence that the scale math or React state is wrong, but it is a real renderer-performance
  risk and prevents this checkpoint from closing.

**REVIEW CORRECTION — CAUSAL E2E BOUNDARY**

- The new transition matrix was inserted into the existing export/serialization-negative scenario after a
  `2560x1440` render. That couples scale semantics to accumulated renderer cost and obscures which contract failed.
- Corrective unit: restore the prior proven export scenario's single width/height replacement while retaining the new
  `Effective Helper scale` metadata and filename assertions. Add an independent scale-mode scenario that configures a
  small positive drawable profile and user factor before selecting a source/target, then proves height dependency,
  width independence, custom-effective retention, switch-back derivation, and permanent `Not verified in game`.
- The correction may edit only `tests/e2e/x4-ui-source-editor.spec.ts`. It must not weaken export refusal assertions,
  change production behavior, raise the timeout, skip rendering, or hide the repeated red evidence. Acceptance is the
  complete focused Source Editor spec green under the normal 60-second test timeout, followed by exact lint and diff
  hygiene. If the independent small-profile case still stalls, stop with `FAILED` and retain the renderer-performance
  defect as the next production unit.

**CAUSAL E2E RESULT — `FAILED`**

- The independent test-only split ran the complete focused spec once: `1 passed / 2 failed`, exit `1`. Exact test-file
  ESLint and diff hygiene passed; ports `3100/3101` and matching E2E processes were absent afterward.
- The restored export case exposed one stale expected value: derived mode correctly changed effective scale to `0.875`
  after height changed from `1440` to `900`, while the test still expected the former fixed `1.4` filename.
- The independent `320x360` scale case still timed out on the final custom-to-derived transition. Small composite
  dimensions therefore do not remove the repeated-render stall; test structure alone is not the production fix.

### BOUNDED UNIT — RENDERER-OWNED ZEKTON ATLAS BYTE CACHE (`SPECIFIED`)

**PLAN / RECONCILE**

- **Observed cost:** the configured canonical regular and bold Zekton atlases are each `1024x2048`, or `2,097,152`
  A8 bytes. `renderX4UiPaintPlanToCanvas()` currently calls `stageAtlas()` on every render; every distinct role/tint
  expands those invariant bytes into a new `8,388,608`-byte RGBA image with a JavaScript per-pixel SDF/tint loop.
  Profile width, height, and effective-scale edits change destinations and the composite, not canonical atlas bytes or
  accepted tint identities.
- **Existing owner reused:** `x4UiCanvasRenderer.ts` already owns detached A8 snapshots, exact tint keys, per-render
  identical-tint reuse, allocation/refusal policy, and post-callback mutation checks. No parallel renderer, worker,
  backend route, browser-font path, or caller-owned surface is needed.
- **Bounded change:** add an opt-in opaque renderer session whose private, bounded cache retains detached RGBA byte
  expansions by loader-issued canonical corpus object plus exact role/tint key. Every render still allocates a fresh
  atlas surface and composite; a hit copies private bytes into fresh `ImageData` with the intrinsic typed-array copy,
  then executes the existing `putImageData`/draw path. The Source Editor owns one session for its mounted lifetime.
- **Bound:** retain at most eight role/tint byte entries per corpus/session with deterministic least-recently-used
  eviction. At `1024x2048`, the upper bound is 64 MiB per live Source Editor session before ordinary transient surfaces;
  unmounting or losing the canonical corpus key makes the private cache collectible.
- **Non-goals:** no cross-process or persistent cache, no cached Canvas surface, no change to SDF/tint math, no change
  to Paint/Scene/layout receipts, no timeout increase, no asynchronous/worker renderer redesign, and no claim of X4
  runtime parity or frame acceptance.
- **Rollback:** targeted revert of the renderer session/cache, Source Editor wiring, and causal tests; recovery remains
  pushed commit `47ce998bea73fc2a0ecf3645663c00141b93b72b` plus the uncommitted scale-control checkpoint.

**ACCEPTANCE CONTRACT**

1. Tests first produce a causal red for two renders in one authentic session: identical canonical corpus plus exact
   role/tint must reuse private RGBA bytes, while every call still allocates fresh renderer-owned surfaces/composite.
2. Omitted sessions preserve existing one-call semantics. Forged/malformed sessions refuse before allocation. Different
   corpus objects and role/tint keys never alias. Failed allocation/image-data/put paths do not poison a later render.
3. LRU capacity is exactly eight entries and eviction is deterministic; no cache byte array or atlas surface is exposed
   to callers. Existing raw DDS immutability, tint-domain, clipping, mutation, and permanent truth-boundary tests remain
   green.
4. The Source Editor uses one opaque session without changing normalized profile, canvas commit, export identity, or
   external custom-surface behavior. SSR/selftests retain the `Not verified in game` state.
5. The export test expects derived effective scale `0.875` after `1800x900`; the independent scale test remains causal.
   The complete focused Source Editor spec must pass `3/3` under the existing 60-second per-test timeout.
6. Focused Canvas and Source Editor selftests, TypeScript, exact-file ESLint, diff hygiene, graph refresh, full precommit,
   build/package/install, installed-host transitions, and fresh X4 comparison all pass before promotion.

**CACHE VALIDATION CHECKPOINT — `PARTIAL`**

- Tests-first produced the exact missing-export red for `createX4UiCanvasRenderSession`. The diagnostic-free implementation
  then passed Canvas `140/140`, the complete Source Editor selftest matrix, whole-repository TypeScript, exact five-file
  ESLint, and scoped diff hygiene.
- The complete focused browser spec remained red at `2 passed / 1 failed`. The scale scenario reached the custom
  `640x360` state but exceeded the unchanged 60-second test timeout before its remaining assertions completed. Harness
  teardown removed the ephemeral stack; ports `3100/3101` and matching E2E processes were absent.
- `[REPRODUCED]` The full fixture uses exactly one atlas cache key, `regular|255|255|255|1`: the first render misses and
  every subsequent render hits with cache size one. Renderer calls measured approximately `0.45-0.57 s`; there is no
  eight-entry LRU churn.
- `[REPRODUCED]` `projectX4UiEditorSession()` measured approximately `1.4-1.6 s` per invocation in the browser fixture
  and executes twice per Source Editor state update. Inspection shows that each invocation always calls the complete
  preview pipeline once for sample-catalog derivation and again for the final preview, even when reconciliation yields
  no sample values. The remaining failure is cumulative projection/browser scheduling cost, not the atlas cache.

### BOUNDED UNIT — SAMPLELESS SESSION PREVIEW REUSE (`SPECIFIED`)

**PLAN / RECONCILE**

- **Existing owner reused:** `projectX4UiEditorSession()` in `src/lib/x4UiEditorSession.ts` already owns both the
  catalog-preview and final-preview calls. No Source Editor cache, second session owner, worker, persistence layer, or
  weakened browser assertion is needed for the first correction.
- **Bounded change:** when sample reconciliation produces `samples === undefined`, reuse the already accepted
  `catalogPreview` as the final preview instead of invoking the identical preview pipeline again. When accepted sample
  values exist, retain the second projection exactly as today.
- **Non-goals:** no memoization across calls, no mutation or identity contract added to public receipts, no change to
  source/target reconciliation, normalized profiles, sample bindings/authorities, Paint/Scene/layout semantics, cache
  capacity, browser timeout, or permanent `Not verified in game` state.
- **Rollback:** targeted revert of this conditional preview reuse and its tests; the renderer cache remains independently
  removable through the prior bounded unit.

**ACCEPTANCE CONTRACT**

1. Fail-first evidence remains the diagnostic-free focused browser result `2/3` with the scale scenario timing out.
2. Existing sampled, stale-sample, refused-sample, no-selection, malformed, keep-out, source-authority, and paint/session
   selftests remain green; a new causal row proves sampleless output is value-equivalent while accepted samples still
   take the sampled projection path.
3. No public receipt or truth field changes, and no timeout, retry, fixture, or assertion is weakened.
4. Session, Source Editor, Canvas, TypeScript, exact-file ESLint, and diff hygiene pass before one serial run of the
   complete focused Source Editor spec. Acceptance requires `3/3` under the existing 60-second timeout plus clean
   ephemeral teardown.
5. If this bounded reuse is insufficient, stop and reconcile the Source Editor's separate provisional-selection
   projection as a new unit rather than silently broadening this one.

**IMPLEMENT / VALIDATE RESULT — `PARTIAL`**

- The bounded production delta is one branch in `projectX4UiEditorSession()`: reconciled `samples === undefined` reuses
  `catalogPreview`; accepted samples retain the existing second `previewFor(...)` path. No public shape, cross-call
  memoization, mutable state, timeout, fixture, assertion, or truth field changed.
- The new session causal row is green. Parent reruns pass Session `8/8`, Canvas `140/140`, the complete Source Editor
  selftest including P7 `12/12`, whole-repository TypeScript, exact seven-file ESLint, and scoped diff hygiene.
- The first complete post-change focused E2E run produced valid passes for scenario 1 (`9.9 s`) and scenario 2
  (`42.1 s`), then Windows terminated the child with `0xC0000409` before scenario 3 emitted a result. The structured
  report was incomplete and therefore red; `treeGone=true`. The exact unchanged scale scenario then passed `1/1` in
  `53.6 s` with a complete structured PASS and clean teardown. A parent replay of scenario 1 hit the same Windows child
  termination before any result, so it adds no product verdict and was not retried blindly.
- Graphify refreshed and resolves the changed session owner. Complete `npm run precommit:check` exits `0`: tripwires,
  canon mirrors, E2E verdict `55/55`, Vite lifecycle, product copy, durable writers `15/15 + 8/8`, capability contract
  `12 / 297 / 1 / 11`, MCP capabilities, action receipts `82` routes / `57` surfaces, TypeScript, and final `OK`.
- **Review:** all three unchanged scenarios have positive evidence in this checkpoint, and the original scale timeout is
  repaired. The bounded unit remains formally `PARTIAL` because the declared single complete `3/3` receipt is absent;
  the remaining red is the known Windows E2E child-lifecycle owner, not evidence of a Source Editor assertion failure.
  Installed-host and X4 validation may proceed, but release acceptance and OpenVSX remain blocked.

### BOUNDED UNIT — NATIVE X4 TEXT-METRIC ORACLE (`SPECIFIED`)

**PLAN / RECONCILE**

- **Reproduced defect:** the installed Forge native PNG and a fresh exact-drawable X4 capture agree on panel and button
  geometry to approximately one raster pixel, but thresholded native glyph bounds are materially different: Forge
  renders `My First Button` about `97` pixels wide while X4 renders about `109`, and `Second Button` about `96` versus
  `106`. This is a text-raster fidelity defect, not evidence that frame geometry or the source-to-game pipeline failed.
- **Ruled out:** shipped `helper.lua` lines 846-858 and the current layout kernel both implement
  `ceil(fontsize * Helper.uiScale)`; shipped `libraries/fonts.xml` explicitly declares Zekton and Zekton Bold at design
  size `32`. The remaining unknown is the native C++ `GetTextWidth`/font-raster interpretation of the exact `.abc` and
  `.dds` data, not the Lua scaling law or nominal design-size declaration.
- **Existing owners reused:** the unchanged `pipeline_test` UI-only fixture, Forge guarded deploy authority, X4's
  shipped FFI `GetTextWidth`, `GetTextHeight`, and `GetUIScale`, the current Zekton decoder/text layout/Scene/Paint/
  Canvas owners, and the existing same-profile evidence directory. No parallel renderer, browser font, guessed
  multiplier, or end-user diagnostic product is introduced.
- **Bounded diagnostic:** temporarily add one guarded, one-shot native metric probe to only
  `dev-docs/b119-x4-ui-pipeline-smoke/package/pipeline_test/ui/pipeline_test.lua`; deploy only the matching isolated
  `pipeline_test` target; launch X4 without loading a save; capture exact regular/bold widths and heights across the
  source strings and relevant font sizes; then restore and redeploy the original `5,488`-byte
  `C1D9CD8580C6175E95C543259A2AB19F8B463282BF48B2229EB6013D6052718E` source.
- **Risks / rollback:** a malformed FFI probe can refuse the fixture or produce a Lua log error. It cannot touch a save
  or gameplay state. Rollback is the retained original four-file package and exact guarded Forge redeploy; final target
  bytes must match the pre-probe hash census. The operator's 2026-09-02 unattended `go` explicitly authorizes this
  isolated package/game-target write and X4 launch.

**ACCEPTANCE CONTRACT**

1. The diagnostic source remains fail-safe when Helper/FFI authority is unavailable, emits at most one uniquely scoped
   metric set, and does not change the panel's table/widget calls or interaction behavior.
2. The logged receipt includes both `GetUIScale(false)` and `GetUIScale(true)`, regular and bold Zekton, relevant
   integer font sizes including the effective button size, and exact widths for `My First Button`, `Second Button`, and
   at least one single-glyph/control string. Values must be finite, positive, and read back from a fresh run.
3. Before launch, Forge validation/deploy authority accepts only the isolated package. After collection, X4 exits and
   the exact original source is restored through the same authority; workspace/staging/game hashes agree and no
   matching probe marker remains in the deployed Lua.
4. Product correction is authorized only from the native metric receipt plus shipped corpus evidence. Screenshot-only
   tuning, CSS/browser-font substitution, arbitrary stretch constants, timeout increases, and weakened truth labels are
   forbidden.
5. Any production repair must be tests-first in the existing FontMetrics/TextLayout/Scene/Paint/Canvas chain, retain
   exact corpus identities and `Not verified in game`, pass focused tests, TypeScript, exact lint, graph refresh,
   precommit/build/package/install, and produce a fresh native PNG/X4 comparison before promotion.
6. Negative paths include unavailable FFI authority, non-finite native returns, duplicate probe execution, stale source
   identity, deploy mismatch, and failed restoration. Any failed restoration leaves this unit `FAILED`, not partial.

**EVIDENCE LOCATIONS**

- Native Forge/X4 captures and metric log excerpts:
  `dev-docs/b119-x4-ui-pipeline-smoke/source-editor-ingame-20260902/`.
- Comparison and close receipt:
  `dev-docs/b119-x4-ui-pipeline-smoke/source-editor-ingame-20260902/same-profile-comparison.md`.

**NATIVE ORACLE RESULT — `VERIFIED`**

- The isolated probe was accepted by Forge's dry-run and deploy gates, rendered the unchanged panel in a fresh X4
  process, and emitted exactly `53` scoped rows: one start, three scale values, twelve `Helper.scaleFont` values,
  thirty-six successful width/height samples, and one complete row with `success=36 failure=0`.
- X4 reported `Helper.uiScale=1.2527778148651`, `GetUIScale(false)=1.2527778148651`, and
  `GetUIScale(true)=1`. No `DisplayView(): Failed to set up the view`, Lua error, or traceback occurred.
- Reconciliation against the exact regular and bold `.abc` records produced zero error for every native width:
  `GetTextWidth(text, font, size) = sum(record.advance + record.horizontalBearing) * size / 32`.
  The current Forge path sums only `record.advance`, which is the reproduced cause of its compressed glyph run.
- Native height also matched all thirty-six samples with zero error:
  `GetTextHeight(text, font, size, 0) = descriptor.lineMetrics.outer * size / 32` for the unwrapped probe strings.
  No height correction is authorized by this receipt.
- X4 was closed, then the exact original `5,488`-byte Lua was restored through Forge. Fixture, Mod Workspace,
  staging, and game target all returned to SHA-256
  `C1D9CD8580C6175E95C543259A2AB19F8B463282BF48B2229EB6013D6052718E`, with zero probe markers.

### BOUNDED UNIT — NATIVE ABC PEN-ADVANCE PARITY (`SPECIFIED`)

**PLAN / RECONCILE**

- **Existing owners reused:** `x4UiFontMetrics.ts` decodes the exact signed field at record offset `16` and the
  unsigned advance field at offset `20`; `x4UiTextLayout.ts` owns token widths, wrapping, pen progression, and glyph
  quads. The Scene/Paint/Canvas chain consumes this output and is not a second metric authority.
- **Bounded correction:** preserve every decoded raw field and public truth label, add one evidence-named native
  pen-advance helper in FontMetrics, and use its `horizontalBearing + advance` result in glyph-run measurement and
  TextLayout token/pen widths. Continue positioning each bitmap quad from its exact horizontal-bearing field.
- **Non-goals:** no guessed multiplier, CSS/browser font, atlas/SDF threshold change, line-height change, source/API
  model change, wrap-policy redesign, public verification upgrade, or removal of `Not verified in game`.
- **Affected code/test boundary:** `x4UiFontMetrics.ts` and its selftest, `x4UiTextLayout.ts` and its selftest, plus only
  causally broken downstream Scene/Paint/Canvas assertions. No fixture, timeout, or oracle weakening is allowed.
- **Rollback:** targeted revert of this bounded helper and its call sites. Exact pre-change source remains at
  `be34a96f817290c95fc29b2acc87eb119a120c76`; the diagnostic mod is already restored independently.

**ACCEPTANCE CONTRACT**

1. Tests fail first on a synthetic nonzero-bearing glyph because both raw measurement and TextLayout still omit the
   native contribution; the test must distinguish the raw stored fields from the derived native pen advance.
2. The helper rejects or safely propagates impossible negative/non-finite/overflow geometry without partial success.
   Zero-bearing fixtures remain value-identical.
3. Canonical regular and bold tests encode the native oracle vectors: at design size `32`, widths are regular
   `298/286/38` and bold `309/295/38` for `My First Button` / `Second Button` / `M`; scaled sizes retain exact linear
   parity. Height remains `52` at design size and is not altered.
4. Wrapping, truncation, horizontal alignment, glyph pen positions, and `scaledAdvance` use the same derived native
   advance. Raw `advance`, `bearingX`, bitmap bounds, UVs, corpus hashes, and authority/provenance remain exact.
5. FontMetrics, TextLayout, Scene, Paint, Canvas, Source Editor, and session selftests pass, followed by TypeScript,
   exact-file ESLint, diff hygiene, graph refresh, full precommit, production build, extension package/install, and
   an installed native PNG generated from the same source/profile.
6. Release acceptance additionally requires a fresh X4 screenshot comparison showing the corrected glyph extent while
   panel/button geometry and interactions remain stable. Until that passes, this bounded unit is `PARTIAL` and
   OpenVSX remains blocked.

**IMPLEMENT**

- `x4UiFontMetrics.ts` now derives one explicit native pen advance from the preserved raw ABC fields:
  `horizontalBearing + advance`. The helper refuses non-finite, unsafe, nonpositive, or over-cap results before any
  partial measurement can escape.
- `measureZektonGlyphRun()` and `x4UiTextLayout.ts` use that same value for run width, wrapping, truncation, alignment,
  and pen progression. Bitmap placement still applies the raw bearing once; raw descriptor fields, atlas geometry,
  corpus hashes, height law, and authority labels are unchanged.
- Tests retain the fail-first distinction between raw fields and derived native advance, cover positive/negative/zero
  bearings and impossible geometry, and pin the regular/bold canonical oracle vectors.

**VALIDATE**

- Native X4 oracle: `36/36` width/height samples succeeded. All widths exactly equal
  `sum(horizontalBearing + advance) * size / 32`; all unwrapped heights exactly equal
  `lineMetrics.outer * size / 32`.
- Focused product gates: FontMetrics `15/15`, TextLayout `12/12`, Integration `21/21`, Canvas `140/140`,
  LayoutKernel `34/34`, KeepOut `17/17`, Paint `180/180`, Scene `176/176`, Preview `108/108`, CorpusAssets `39/39`,
  SourceEdits `90/90`, Source Editor P7 `12/12`, plus the remaining eight UI entrypoints, whole-repository TypeScript,
  exact-file ESLint, diff hygiene, and Graphify refresh all pass.
- Complete `npm run precommit:check` exits `0`; production build, extension stage/build, package inspection, and probe
  `16/16` pass. Reviewed VSIX:
  `vscode-extension/x4-forge-studio-0.0.70-b119-pen-advance-019fea10.vsix`, `26,288,585` bytes, SHA-256
  `55031D0626F840B4CFEA8572B85FFF21C1B6D618E91B1EC82C9DB6F1D26C938F`.
- The candidate replaced only the existing Antigravity `0.0.70` extension after a complete backup at
  `C:\Users\Moshi\AppData\Local\Temp\x4forge-b119-pen-advance-backup-20260902-193500`; installed critical bytes and
  staged package bytes match. The installed Source Editor bound exact `ui/pipeline_test.lua -> menu.createFrame`,
  derived effective scale `1.2527777777777778` from `2544x1353 / user scale 1`, exported one current native PNG, and
  retained `Preview evidence only · Not verified in game`.
- The corrected Forge PNG is `2544x1353`, `91,675` bytes, SHA-256
  `521F647DC1B6FB46E701166482137D63E1AD8983346DED7172204E2E52C440EE`. Across neutral-white thresholds, the old
  first-button glyph extent was `97-98` pixels, corrected Forge is `108-109`, and fresh X4 is `108-109`; the second
  label is old `95-96`, corrected `104-105`, and X4 `106`. The status text moved from `219` to `244` pixels versus
  X4 `243-245`. This verifies the targeted pen-width repair within `0-2` raster pixels without asserting identical
  antialiasing, frame decoration, or every widget.
- Fresh X4 9.00 rendered the unchanged exact package at the same profile. Both buttons highlighted, the edit box
  accepted native input and retained it through focus change, standard close removed the panel, and X4 exited. The
  fresh screenshot is `407,029` bytes / SHA-256
  `0045715651BDEC6CFC9A5371ED5BFF6A058E41F6448EB1AF55F015E472452C5D`; the scoped debuglog has zero
  `pipeline_test` runtime errors, zero view-setup failures, and zero Lua traceback matches.
- The complete serial Source Editor browser suite now passes `3/3` in `1.9m` with child exit `0`, complete structured
  report, and `treeGone=true`. Receipt SHA-256:
  `54E178115CAD3F3BC4814A35218CC4E9E1CB4D7F4EDC5DC71AC2657615837A06`. Ports `3100/3101` and matching Node
  processes are absent; the per-run state directory remains inert. The live Antigravity discovery hash and protected
  mod/game Lua hashes did not change.
- Final rollback census: repository fixture, Mod Workspace, Forge loose staging, and game target are each `5,488`
  bytes / `C1D9CD8580C6175E95C543259A2AB19F8B463282BF48B2229EB6013D6052718E`, with no probe marker; X4 process count is
  zero.

**REVIEW / CLOSE — BOUNDED UNIT `VERIFIED`; OVERALL B119 `IN_PROGRESS / PARTIAL`**

- Acceptance rows 1-6 are done and evidenced for this exact corpus/source/profile: raw-versus-derived tests, invalid
  geometry refusal, canonical vectors, shared layout consumption, full static/package/installed-host gates, corrected
  native PNG, and fresh X4 rendering/interaction all passed.
- The earlier incomplete `2/3` Windows child receipt remains historical red evidence, but it is superseded for current
  product acceptance by the complete unchanged `3/3` receipt above; no timeout, retry policy, fixture, or assertion was
  weakened.
- This closes the reproduced Zekton pen-advance defect and strengthens the existing source-faithful renderer capability.
  It does not prove universal C++ frame acceptance, every `helper.lua`/`widget_fullscreen.lua` path, exact shader/alpha
  raster identity, all keep-out variants, arbitrary Lua, the full AI Influence reference reconstruction, or release /
  OpenVSX acceptance. Every preview continues to say `Not verified in game`, and GitHub #41 remains open.

**AAR**

- **Sustain:** use shipped descriptors plus direct native `C.GetTextWidth`/`GetTextHeight` probes to settle ambiguous
  field semantics, then bind the smallest correction through one shared measurement/layout owner.
- **Improve work/approach:** the original advance-only interpretation was plausible but wrong and survived broad green
  tests. Canonical single-field fixtures were not causal enough; nonzero-bearing corpus vectors and native values must
  be present before font parity is claimed.
- **Improve tools:** the first extension-backup command failed safely because `Copy-Item -LiteralPath` does not expand
  `*`; two PowerShell collection pipelines needed syntax correction; the Computer Use save dialog required current
  coordinate inspection; and bulk text injection did not reach X4 while native key input did. None altered product or
  protected bytes.
- **Highest-risk evidenced weakness:** readable binary-field names can still invite a convincing but false semantic
  assumption. Keep raw fields source-labeled, derive game behavior in a separately named function, and require native
  oracle vectors plus rendered-host/X4 evidence before promoting fidelity.
