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

**DURABLE SYNC**

- Source checkpoint `0194d62e811305797bf8c18ac68158f035adc8d6` is pushed with exact local, tracking, and direct-remote
  parity. The commit contains exactly the four implementation/test paths plus this plan, `BACKLOG.md`, and
  `SESSION-HANDOFF.md`.
- GitHub #41 comment `5518404390` was written and read back; the issue remains open with bounded `VERIFIED` and overall
  `PARTIAL` separated.
- Notion owner `3b84618e-d15b-8190-821e-c0eb96f43d5a` was updated and read back as `In Progress / Partial`, with the
  exact commit, native/E2E/package evidence, remaining boundaries, and no OpenVSX claim.
- Google Drive Current Status document `17VLaIsT499KHg7zg30hOyLaBXB0-9jlrX3dQ63s3dtE`, tab `t.0`, was appended and
  read back with one `HEADING_2` plus seven exact checkpoint paragraphs at revision
  `ANLCKQnz-cGm-CH7Hg9hWcOGNdURH9xZ03PCCFwYQWPASmiyEr0CVP705Ov9ur9vngPDMFleaJ9yW8FeUTW2j7MKMRekmuhQywOOIqpiXzde`.

### BOUNDED UNIT — INSTALLED STUDIO WORKSPACE-AUTHORITY SWITCH (`SPECIFIED`)

**PLAN**

- **Bounded unit:** repair the installed extension host so a confirmed Studio-tab workspace switch changes the
  extension's immutable workspace authority to the same target before a new scoped agent key is minted. This is a
  prerequisite for using the existing Forge to inspect the current AI Influence workspace; it is not a renderer or
  menu-parity claim.
- **Assumptions / unresolved facts:** the selected Studio tab and the extension host are intended to share one
  workspace ID after `workspace-authority-changed`. The current server conflict refusal is authoritative. No claim is
  made yet about the three AI menus' renderability.
- **Authoritative references:** ADR-F5 workspace authority, `requestedWorkspaceIdentity()` and
  `/api/agent/workspaces/bootstrap` in `server.ts`, the installed `0.0.70` extension output, and the current
  `vscode-extension/src/extension.ts` callers. The server's duplicate-identity rejection must not be weakened.
- **In scope:** target-specific bootstrap request headers, startup fallback behavior, Studio-message rebinding,
  causal pure selftests, extension build/package/probe/install, and an installed-host switch/key/API readback.
- **Out of scope:** server identity-policy changes, cross-workspace agent keys, mod/game writes, X4 launch, UI menu
  reconstruction, OpenVSX publication, or changes to any existing workspace contents.
- **Affected paths:** `vscode-extension/src/extension.ts`; one narrowly owned pure request-header helper and selftest;
  this plan, `BACKLOG.md`, and `SESSION-HANDOFF.md`. Existing unrelated extension release metadata stays untouched.
- **Risks / authorization:** a bad fix could bind an agent key to the wrong workspace or strand the extension on an
  invalid target. The user authorized existing-Forge updates and Computer Use. The repair may replace only the
  installed X4 Forge extension after a fresh backup; it may not mutate the mod or game.
- **Rollback:** restore the current installed extension from a byte-complete backup, or reinstall the already reviewed
  `x4-forge-studio-0.0.70-b119-pen-advance-019fea10.vsix`. Workspace state is read-only during this unit.

**BASELINE / RECONCILE**

- Repository baseline is `HEAD == origin/main == db4fdc9db57fee766faea7a2b8299adbd1188a26`; the broad unrelated dirty
  tree is preserved. The installed sidecar is `http://127.0.0.1:64929` and X4 is not running.
- The visible Studio tab successfully restored `x4 AiLive` as `ws_bca860d02b9ea61f6028bfb4`, but the extension output
  recorded `workspace authority change failed closed: Conflicting workspaceId values were supplied in the request.`
  A subsequently created one-hour read key remained bound to `ws_f61166c42849c757cf219c37` (`Pipeline Test UI`).
- Cause: `handleStudioMessage()` posts target `workspaceId` in the JSON body while `backendApiHeaders(handle, true)`
  still emits the prior `handle.workspaceId` in `x-workspace-id`. `requestedWorkspaceIdentity()` detects both distinct
  values and returns `WORKSPACE_ID_CONFLICT` before rebinding. Startup fallback has the same stale-header possibility.
- Existing capability reused: tab-local restore, extension `handle.workspaceId`, server bootstrap lookup, immutable key
  binding, and strict conflict rejection. The general API-header helper remains unchanged for normal reads/writes.
- Capability-map delta is deferred until installed-host validation establishes that the repaired authority actually
  follows the selected tab.

**ACCEPTANCE CONTRACT**

1. A target-workspace request helper must preserve authorization, client identity, content type, and operation ID while
   replacing a stale `x-workspace-id` with the exact target. An empty bootstrap target must remove the stale header.
   The input header object must not be mutated.
2. Both startup bootstrap attempts and Studio-message rebinding must use the target-consistent helper. `handle.workspaceId`
   and persisted global state update only after an OK response whose returned workspace ID exactly equals the target.
3. Negative tests cover stale-old/new-target conflict prevention, empty fallback, malformed/blank target refusal at the
   existing caller boundary, preserved unrelated headers, and no pre-success handle mutation. Server conflict policy,
   agent immutable binding, and normal `backendApiHeaders()` behavior remain unchanged.
4. The pure selftest, extension TypeScript/build, applicable root type/lint/oracle/precommit gates, package inspection,
   and staged-app probe must pass without weakening an oracle, timeout, route policy, or assertion.
5. Installed-host acceptance requires switching between two existing workspaces, observing a successful extension log
   for the selected target, minting a new one-hour read key, and reading only that target through the Agent API. A
   mismatched workspace header must still return `WORKSPACE_BINDING_MISMATCH`.
6. No workspace, mod, staging, or game content may change. If installed-host authority remains on the old workspace,
   the unit is `FAILED`; source/build success alone is `PARTIAL`.

**REQUIRED EVIDENCE**

- Pure selftest output and exact changed-file diff.
- Extension build/package/probe hashes plus installed-byte comparison and rollback path.
- Extension-output success line, bound-key workspace summary, and retained mismatch refusal from the live sidecar.
- Final path census proving workspace/mod/game content hashes or snapshots were unchanged.

**IMPLEMENT**

- `workspaceAuthorityHeaders()` now copies the request headers, replaces a stale `x-workspace-id` with the exact
  bootstrap target, and removes the header for the intentional default-workspace fallback. Authorization, client,
  content-type, operation identity, and unrelated headers survive without mutating the input object.
- `workspaceAuthorityResponseAcceptable()` requires an OK response, a valid immutable workspace ID, and exact target
  echo for every nonblank request. Only the explicit blank fallback may accept the server-selected valid default.
- Startup bootstrap and `workspace-authority-changed` both use the same target-consistent helper. The extension handle
  and `globalState` still mutate only after the response passes their authority checks. Server conflict and immutable
  agent-key enforcement were not weakened.

**VALIDATE**

- Pure selftest passes the causal old-header/new-body conflict, replacement, blank fallback, case-insensitive header,
  preservation, nonmutation, invalid response, wrong response, and response-failure cases. Extension TypeScript,
  extension build, root typecheck, exact-path ESLint, diff hygiene, and Graphify pass; Graphify is
  `10,172 nodes / 25,586 edges / 330 communities` and shows both bootstrap callers using the helper.
- Complete `npm run precommit:check` exits `0`: verdict selftest `55/55`, writer audits `15/15 + 8/8`, capability audit
  `12 capabilities / 297 routes / 11 MCP aliases`, action receipts `82 routes / 57 surfaces`, and final
  `[precommit] OK`. Production build emits `1,848` modules. The first combined stage/probe command stopped after two
  probe assertions; the isolated rerun passes `16/16` without changing an assertion or timeout.
- Strict configured three-menu census passes `176/176`, executing `MENU/HUB/COMM = 3/3`. At `1920x1080`, MENU is
  partial with `209` paint commands / `171` diagnostics, HUB with `70/39`, and COMM with `35/29`; COMM still emits zero
  widgets/text/glyphs. This is a truthful next-work baseline, not three-menu fidelity or game proof.
- Final VSIX `x4-forge-studio-0.0.70-b119-workspace-authority-final-019fea10.vsix` is `26,288,780` bytes, SHA-256
  `132FB260D8CADBF90CC2120C581D1D73D22C78E097775999A4FE756927AEE04A`, with `2,107` inspected entries and
  `71,586,507` unpacked bytes. Package inspection is `13/13`; installed `out/extension.js` is `142,926` bytes,
  SHA-256 `3DA7E84BC00E0EB2808524DE0934196117604FDE31BF7ED03E641004F819B367`, exactly matching the staged build.
- Same-version replacement while Antigravity remained open failed safely after `1,100` native-file `EPERM` retries.
  A byte-complete rollback copy remains at
  `C:\\Users\\Moshi\\AppData\\Local\\Temp\\x4forge-b119-workspace-authority-final-backup-20260902-215707`.
  `CloseMainWindow()` then closed the IDE gracefully, the CLI installed the inspected VSIX, and a fresh Antigravity
  process launched the packaged sidecar. Raw child termination is not a stop contract: the extension respawned its
  owned sidecar, so it was not used for the accepted replacement.
- Installed runtime first reproduced the bug as `WORKSPACE_ID_CONFLICT`. The repaired installed candidate then bound
  `ws_bca860d02b9ea61f6028bfb4` and successfully accepted the restored Studio tab's cross-target switch to
  `ws_f61166c42849c757cf219c37`. The compiled 5,000-character switch-handler window is byte-identical between that
  accepted candidate and the final package at SHA-256
  `1A948D0232D9E7BCFD7B10E1956CA74AE1CCF9EDFD8AD58442CC3B2B7432742F`; the final package's additional change is the independently
  tested startup-response echo guard.
- Two clean final-package restarts logged final activation, sidecar readiness, authority bind, and successful
  Studio-tab authority selection. The current selected tab is Pipeline Test, so the final log correctly ends at
  `workspace authority selected by Studio tab: ws_f61166c42849c757cf219c37`. One first-restart `fetch failed` was
  retained; the clean replay succeeded without source or state repair.
- On the final sidecar, a temporary one-hour read key was created against AI workspace
  `ws_bca860d02b9ea61f6028bfb4`, read `x4 AiLive` (`2,927` nodes) with HTTP `200`, and returned HTTP `403` plus
  `WORKSPACE_BINDING_MISMATCH` against Pipeline Test. Both temporary keys were revoked; no plaintext key was recorded.
- Final protected census exactly equals baseline: AI workspace JSON
  `79A7738581FA7C09A3704204F54A08B92375BA3A574BBC7AE8DCF432CB2BE520`, Pipeline JSON
  `18A3C6507C33967F77A723CA8854D6F855192FD61AC657D71D3DA3353DC69FBC`, Mod Workspace
  `127 / 11,262,724 / CC3B7E98...CBBB`, loose build `155 / 537,684,179 / 70C6DECC...0A97`, and game target
  `126 / 11,262,072 / 636CFAB9...862B7`; X4 process count is zero. A transient `287`-file count was correctly rejected
  as a census mistake because it included the mod's existing 160-file `.git` directory.

**REVIEW / CLOSE / AAR**

- Requirements 1-4 and 6 are done with causal, package, installed-host, and immutable-census evidence. Requirement 5
  is done by the installed cross-target switch, exact compiled-handler identity in the final package, final-package
  bind/selection replay, target-bound key read, and retained mismatched-header refusal.
- Fresh-eyes review forced the startup exact-echo guard before final packaging. No server policy, workspace contents,
  mod bytes, staging bytes, game bytes, release metadata, OpenVSX state, or unrelated working-tree path changed.
- **Status:** this bounded workspace-authority repair is `VERIFIED`; overall B119 remains
  `IN_PROGRESS / PARTIAL / Not verified in game`. The next bounded unit is a backed-up, paired-CAS re-import of the
  current configured AI Influence source followed by a new strict three-menu census. OpenVSX remains deferred.
- **AAR:** sustain target-consistent duplicate authority and exact response echo. Improve installed replacement by
  treating graceful IDE shutdown as the only accepted native-lock release. Tool friction included one transient UI
  fetch race, one incomplete combined probe, one PowerShell alias collision, and one `.git`-inclusive false census;
  all failed evidence is retained. Highest risk was silent extension/tab authority divergence, now contained by one
  copied-header helper, fail-closed response checks, immutable key binding, and installed cross-target evidence.

**DURABLE SYNC**

- Source checkpoint `104fa24ee21c9be135014f77f10bbff87452b789` is pushed with exact local `HEAD`,
  `origin/main`, and direct-remote parity; the six owned implementation/record paths are clean.
- GitHub #41 remains open. Comment `5519542967` was written and read back with the bounded `VERIFIED` / overall
  `PARTIAL` boundary, next paired-CAS import, and no OpenVSX claim intact.
- Notion owner `3b84618e-d15b-8190-821e-c0eb96f43d5a` was updated in place and read back at
  `2026-09-03T02:45:26.111Z` as `Status=In Progress / Evidence Grade=Partial`; its summary, reverse-sync receipt,
  checkpoint section, commit, and GitHub comment agree.
- Google Current Status document `17VLaIsT499KHg7zg30hOyLaBXB0-9jlrX3dQ63s3dtE`, tab `t.0`, passed the
  file-backed protected-control scan with zero protected controls, then accepted one revision-guarded section at
  revision `AIroW357C_UGd302aKKSXBH8TxCjQtwshU69T33JkZOtN2vnczFFByE5KSL_n2YXQmhArdAS1D26Inu5HqxrZOkp8hfrotvx2E6seWQ-k7uD`.
  Readback proves exactly one peer `HEADING_2`, eight `NORMAL_TEXT` paragraphs, the intended terminal empty paragraph,
  and no unrelated tab or structure change.

### BOUNDED UNIT — CURRENT AI WORKSPACE PAIRED-CAS IMPORT (`SPECIFIED`)

**PLAN**

- **Bounded unit:** refresh only persisted Forge workspace `ws_bca860d02b9ea61f6028bfb4` (`x4 AiLive`) from the
  configured Mod Workspace folder `x4_ai_influence`, using the existing read-only folder importer and guarded
  workspace mutation contract. Then run the strict MENU/HUB/COMM source-to-scene census against the refreshed state
  and identify the first causal visible-operation gap.
- **Assumptions / unresolved facts:** the filesystem source is newer than the persisted August workspace snapshot;
  import may expose additional source calls without making all three menus visible. The exact first gap is unknown
  until the refreshed state passes strict execution. No preview/game parity claim follows merely from import success.
- **Authoritative references:** configured Mod Workspace root; `content.xml` and current Lua files under
  `F:\DEV_ENV\projects\Mods\X4Mods\x4_ai_influence`; `importModFolder()`; `GET /api/agent/workspace`;
  `POST /api/agent/workspace`; `WorkspaceRegistry`; and the existing strict three-menu census.
- **In scope:** byte-exact workspace backup; authenticated explicit-target import; one same-read
  `workspaceHash`/`snapshotHash` pair; dry-run and no-force guarded persistence; receipt/hash/version readback; current
  source-pin verification; immutable protected-path census; and strict MENU/HUB/COMM execution/paint diagnostics.
- **Out of scope:** source-mod edits, loose-build or game-extension writes, deployment, X4 launch, renderer repairs,
  OpenVSX publication, Pipeline Test workspace mutation, or a claim that the refreshed preview is verified in game.
- **Risks / authorization:** selecting or persisting the wrong workspace could overwrite Forge design state. The user
  explicitly authorized the existing Forge and unattended state work. The exact workspace JSON is copied before any
  mutation; all writes use explicit target identity, caller-owned operation identity, paired CAS, and no `force`.
- **Rollback:** restore the byte-exact backed-up AI workspace JSON while Forge is stopped, or use the mutation
  receipt/recovery contract if supported by the resulting receipt. No source, build, or deployed game bytes are part
  of the rollback surface.

**BASELINE / RECONCILE**

- Repository baseline is `HEAD == origin/main == aa34be12999f55faaccbea41386da39793529c2b`; the unrelated dirty tree is
  preserved. Installed sidecar `http://127.0.0.1:61112` is alive, and X4 process count is zero.
- AI workspace JSON is `11,953,625` bytes / SHA-256
  `79A7738581FA7C09A3704204F54A08B92375BA3A574BBC7AE8DCF432CB2BE520`; Pipeline Test workspace JSON is `8,477`
  bytes / `18A3C6507C33967F77A723CA8854D6F855192FD61AC657D71D3DA3353DC69FBC`.
- Protected current baselines remain Mod Workspace `127 / 11,262,724 / CC3B7E98...CBBB`, loose build
  `155 / 537,684,179 / 70C6DECC...0A97`, and game target `126 / 11,262,072 / 636CFAB9...862B7`.
- Reconciliation found no need for a parallel importer or persistence path: `/api/agent/mod-folder/import` returns an
  imported workspace without persisting it, while `/api/agent/workspace` already owns paired content/snapshot CAS,
  dry-run preview, immutable registry commit, and action receipts. No capability-map delta is expected unless runtime
  evidence changes that contract.

**ACCEPTANCE CONTRACT**

1. A unique backup must match the pre-mutation AI workspace byte count and SHA-256 exactly.
2. Import must resolve the configured `workspace` root and exact `x4_ai_influence` folder, find `content.xml`, return a
   nondegenerate workspace/report, and leave every persisted/protected path unchanged.
3. One current `GET /api/agent/workspace` must supply `version`, `workspaceHash`, and `snapshotHash` from the same read.
   Dry-run persistence with that exact pair must report the proposed result without changing the state-file hash,
   version, or current hashes.
4. Actual persistence must target only `ws_bca860d02b9ea61f6028bfb4`, reuse the unchanged paired baseline, use a valid
   unique operation ID, omit `force`, and return a successful receipt plus new exact version/content/snapshot hashes.
   Any conflict or target mismatch fails closed and leaves the backup authoritative.
5. Post-read workspace state must contain current filesystem source pins/materialization. Pipeline Test workspace,
   Mod Workspace, loose build, and deployed game extension must equal baseline; X4 remains absent.
6. The strict configured MENU/HUB/COMM census must execute all three current sources and produce an honest per-menu
   call/paint/diagnostic census. Any zero-visible-output menu remains `PARTIAL`, with the first causal missing or
   unsupported operation named; preview remains `Not verified in game`.

**REQUIRED VALIDATION / NEGATIVE PATH / EVIDENCE**

- Authenticated import and paired-CAS dry-run/commit response summaries with secrets redacted.
- Pre/post workspace file hashes, API version/content/snapshot hashes, receipt identity, current source hashes, and
  protected-path equality census.
- Existing causal CAS rejection tests remain the negative-path oracle; the live run must additionally prove no-force
  dry-run immutability. No intentionally stale write is sent to the real workspace merely to manufacture a failure.
- Strict three-menu selftest/corpus output and the first causal rendering-gap receipt. This unit cannot close above
  `PARTIAL` for overall B119 without native preview and in-game evidence.

**IMPLEMENT / VALIDATE**

- A byte-exact rollback copy was written before mutation at
  `C:\\Users\\Moshi\\AppData\\Local\\Temp\\x4forge-b119-ai-current-import-backup-20260902-231826\\ws_bca860d02b9ea61f6028bfb4.json`:
  `11,953,625` bytes / SHA-256
  `79A7738581FA7C09A3704204F54A08B92375BA3A574BBC7AE8DCF432CB2BE520`, exactly matching the baseline AI workspace.
- Read-only import selected exactly `F:\\DEV_ENV\\projects\\Mods\\X4Mods\\x4_ai_influence`, found `content.xml`, and
  returned version `201`, `127` files, `2,930` nodes, `2,824` links, `15/17` graph-editable MD files, zero
  non-regenerable MD files, and summary `editable:16 / generated:2 / partial:12 / passthrough:52 / binary:45`.
  The imported source stamp is `3986863d2ea3e970:125`; `compileSettings.ui` remains `false`, so this operation refreshes
  source truth without pretending that the graph compiler owns the Lua.
- One same-read guard captured version `1786230857366`, `workspaceHash=53a0600ee0b000a7`, and
  `snapshotHash=dbf65b6162ced511`. Dry-run operation `b119.ai-current-import.dryrun.20260903t0319z` succeeded with
  `applied=false`, `0` errors, `11` warnings, and `31` information diagnostics. State-file bytes/hash and all three
  guard heads remained unchanged, proving the live negative path without issuing an intentionally stale write.
- Actual operation `b119.ai-current-import.commit.20260903t0319z` reused that unchanged paired guard, omitted `force`,
  targeted only `ws_bca860d02b9ea61f6028bfb4`, and committed. Post-read is version `1788405630271`,
  `workspaceHash=2bedad775ec33294`, `snapshotHash=dc8771c3a0bce095`; the persisted JSON is `12,774,311` bytes /
  SHA-256 `D2E3E6570D61C376F70808880AAF7220AC3EFC42405AA5BC1847D97D437F5E05`.
- Durable receipt/recovery reference is
  `ar_c554bd122712fed927e34f59cf9b8839b54d082a08811ade869348184376cf2f`; its file is `2,626` bytes / SHA-256
  `22E6863A0DF8696EC31E58E0F541A1685DED56EE6D2F83FB321BD71A4B140CB4`, status `committed`, rollback available,
  internal receipt hash `390095f545e6200edc56f1ec40bf6b6b91f6aba3d12c5ac7b8b4de8b5cd11817`, and validation `workspace-cas` passed.
- Persisted Lua text now exactly equals disk for MENU (`87,366` bytes /
  `4253D9BD9DE4113D4DE0B881DBF5A1E90CAA7B30F735BA925403EBEF7EC47DD7`), HUB (`42,000` /
  `657476EAD08229977E1F2A69079FFDCAB56D908B72AF5C87BD4F4734DCCB8C4F`), and COMM (`27,481` /
  `88FAB05A79EF33CB28E098081EA6A5E29E8F3B7C4150C39BF38913C51C063511`). Pipeline Test JSON remains exactly
  `18A3C6507C33967F77A723CA8854D6F855192FD61AC657D71D3DA3353DC69FBC`; X4 remains absent.
- The source mod remains Git-clean at `4c0a422b7e3d0f492b572b9da8d2d7ea19a2b453`. A server-equivalent sorted
  regular-tree read reports source `127 files / 19 directories / 11,262,724 bytes /
  9B1A0021A22927D55168A8904C255CEDC630853DB02B07389A64742E269C0BEC`, loose build
  `155 / 19 / 537,684,179 / 1808F251BF466545EE8B57E352289081453B8B71989DC915A47E160427E2D758`, and game target
  `126 / 18 / 11,262,072 / A9046192C83C8B5C0A1304AF96D64A43A203F5EE8EF5E34987583752884EB295`. These hashes use
  `regularTreeFingerprint()` framing and are not byte-comparable to the earlier abbreviated aggregate fingerprints;
  no source/build/deploy writer ran, and the tracked source owner remained exactly clean.
- Strict configured Scene exits `0` at `176/176` and executes MENU/HUB/COMM `3/3`. MENU remains
  `66 operations / 27 applied / 209 paint commands / 171 diagnostics`; HUB is `18/11/70/39`; COMM is
  `14/12/35/29` and still emits `0` widgets, `0` texts, and `0` glyphs. Every chain remains
  `Not verified in game`.

**CAUSAL RECEIPT / REVIEW / CLOSE / AAR**

- `[REPRODUCED]` The first COMM visibility failure is its line `505-506` title expression:
  `"COMM CHANNEL    " .. ascii("encrypted - " .. tostring(...))`. The existing sample catalog issues only `mx`, `my`,
  and `vw - mx * 2`; `isSampleableValue()` rejects every call-shaped expression, so the renderer has no title text,
  cannot derive canonical Zekton height for the zero-height text cell, cannot finalize row/table geometry, and
  deliberately withholds both otherwise-known buttons.
- A read-only live-corpus diagnostic projected the exact disk source at `1920x1080 / effective scale 1` and reproduced
  `0` widgets / `0` texts / `0` glyphs with height gaps at line `505`. Replacing only that title expression **in
  memory** with the equivalent static string produced `3` widgets (title plus two buttons), `5` text nodes, `52`
  glyphs, `104` paint commands, and no layout height gap. The title rect was `1298x22 @ 32,27`; the buttons were
  `279x25 @ 1332,27` and `279x25 @ 1613,27`. Disk SHA remained
  `88FAB05A79EF33CB28E098081EA6A5E29E8F3B7C4150C39BF38913C51C063511` before and after.
- Supplying `minTextHeight:16` through the public Source Editor control-shaped profile did not change the zero-widget
  result; this confirms that a hidden/global floor is neither presently exposed nor a faithful substitute for the
  missing composed string. Secondary COMM gaps remain (notably 100%-allocated columns with default scrollbar reserve
  and unresolved `TOK` colors), but they are not the first cause of the zero-widget output.
- **Bounded-unit status: `VERIFIED`.** The current configured source is now the persisted Forge authority, with guarded
  rollback, paired-CAS receipt, exact source pins, protected-path evidence, strict three-menu execution, and a causal
  next gap. Overall B119 remains `IN_PROGRESS / PARTIAL / Not verified in game` because current COMM source still has
  no preview-issued value for the dynamic title and no new native Forge/X4 comparison has occurred.
- **AAR:** sustain paired same-read CAS plus an immutable backup before workspace mutation. Improve diagnostics by
  using the public editor-session path first; an initial raw malformed-profile attempt and one incorrect corpus-shape
  introspection both failed without writes. Highest-risk observed weakness is that a safe preview-only string could
  unblock exact font geometry, yet the blanket call-expression rejection currently hides it with a much larger
  downstream failure. The next unit must widen only evidence issuance, never evaluate Lua or weaken source authority.

**DURABLE SYNC**

- Documentation checkpoint `b6f2be9d41cc367da568c533c9071742d42bcc5b` has exact local, tracking, and direct-remote
  parity. GitHub #41 comment `5520171578` was written and read back; the issue remains open.
- Notion owner `3b84618e-d15b-8190-821e-c0eb96f43d5a` was read back with checkpoint `b6f2be9`, comment
  `5520171578`, receipt `ar_c554bd...cf2f`, and unchanged `In Progress / Partial` status.
- Google Current Status tab `t.0` was revision-guarded and read back at revision
  `AIroW37mol_WtZzxMvoIK0a0Lvd3aX3IpD6XMPhdb7_ceDfIGPrN8fN2sDhzOAFNIkwzHccOyk63vzRM2mwEd9ivtabZPNXgy3Q5NA8L4lfJ`.
  The appended section is exactly one `HEADING_2` plus eight `NORMAL_TEXT` paragraphs and preserves the terminal
  paragraph.

### BOUNDED UNIT — OPAQUE CALL-SHAPED TEXT SAMPLES (`SPECIFIED`)

**PLAN / RECONCILE**

- **Bounded unit:** allow the existing preview-only sample catalog to issue a string entry for a dynamic
  `createText`/`setText`/`setText2` expression even when its syntax contains ordinary function calls, then prove that a
  user-supplied opaque string unlocks the current COMM title/button geometry. The expression is displayed as provenance
  only; Forge does not parse further, invoke a function, evaluate Lua, or infer game truth from the sample.
- **Existing infrastructure reused:** exact source/range/type-derived sample IDs, session-issued catalog authority,
  source/target/profile binding, strict scalar parsing, immutable sample state, consumer-specific application,
  preview-only provenance, stale/tamper rejection, generic text input in `X4UiSourceEditorSamples`, canonical Zekton
  measurement, and the strict current-source three-menu census. The component already renders string controls, so no
  parallel UI or new persistence path is expected.
- **Likely owned paths:** `src/lib/x4UiLayoutProgram.ts`, `src/lib/x4UiLayoutProgram.selftest.ts`, and
  `src/lib/x4UiScene.selftest.ts`; add `src/lib/x4UiEditorSession.selftest.ts` only if the public authority boundary
  needs a new causal assertion. `src/components/X4UiSourceEditor.tsx` should remain unchanged unless reconciliation
  proves the generic string control is insufficient. All other paths are forbidden.
- **Out of scope:** automatic Lua execution, C++/`C.*` or `Helper.*` sampling, numeric/boolean call-result sampling,
  expression evaluation, source mutation, sample persistence into the mod/workspace/export, global `minTextHeight`,
  secondary COMM scrollbar/color repair, deploy/game writes, X4 launch, OpenVSX, or pixel-parity claims.
- **Risk / rollback:** over-broad sampling could turn unknown execution into fake authority. Rollback is the explicit
  owned-path Git diff; the source mod, persisted workspaces, installed extension, loose build, and game target are not
  mutation surfaces for this unit.

**ACCEPTANCE CONTRACT**

1. Catalog issuance may cross the call-shape guard only when the requested consumer type is exactly `string`, the
   value is dynamic and scalar-compatible, and the expression contains neither `C.*` nor `Helper.*`. Existing static,
   nil, table, function, reference, receiver-identity, resolved-scale, and empty-expression exclusions remain intact.
2. Numeric and boolean calls remain absent from the catalog. `C.Get*`, `Helper.*`, forged/unissued IDs, wrong scalar
   types, wrong source identity/range, stale catalog/binding/profile/selection, conditional/non-applied consumers, and
   authority mutation all continue to fail closed.
3. The current unprovided COMM projection remains honest and geometry-incomplete. Its issued catalog gains exactly one
   opaque string entry bound to lines `505-506`; supplying a sample such as
   `COMM CHANNEL    encrypted - sampled sector` consumes only that entry and yields the title plus both buttons with
   canonical live-corpus Zekton geometry. Source bytes, export bytes, linter truth, and every `Not verified in game`
   marker remain unchanged.
4. MENU and HUB current-source receipts remain unchanged except for mechanically updated totals if a newly eligible
   opaque string appears there and is explicitly accounted for. The strict census must execute all three and assert
   the supplied COMM sample's layout, Scene, Paint, provenance, and no-height-gap result.
5. Required validation: focused LayoutProgram, EditorSession (if touched), Scene strict configured census, affected UI
   component tests if touched, TypeScript, exact-path ESLint, diff hygiene, Graphify, and complete precommit. At least
   one negative fixture must prove a call-shaped numeric value is still unavailable and one must prove `C.*`/`Helper.*`
   string expressions are not issued.

Status at plan time: `SPECIFIED`. No capability-map delta: this extends the existing preview-sample authority rather
than introducing a new capability. Overall B119 remains `PARTIAL`; native preview and X4 are later acceptance layers.

**IMPLEMENT**

- `isSampleableValue()` now receives the requested scalar type. Its established static/nil/table/function/reference,
  numeric-expression, resolved-scale, `C.*`, `Helper.*`, and empty-expression exclusions remain intact; only an
  ordinary call-shaped value that is both `dynamic|unknown` and requested as `string` may now receive an issued
  preview-sample entry. The value remains opaque: Forge does not expand, invoke, or evaluate the expression.
- The focused Layout fixture covers `createText`, `setText`, and `setText2` with supplied opaque strings, and retains
  negative call-shaped number, boolean, direct `C.*`, and direct `Helper.*` cases. The exact current COMM census now
  requires one and only one newly issued call-shaped title entry at source lines `505-506`, proves the unprovided
  zero-widget state, then proves the supplied title plus both button geometries and no Layout height gap.
- No component, editor control, source-mod byte, persisted workspace, package, installed extension, loose build,
  deployed game extension, linter rule, or game-truth marker changed. The existing generic string sample control is
  reused. Exact implementation scope is three files: `x4UiLayoutProgram.ts`, its selftest, and
  `x4UiScene.selftest.ts`.

**VALIDATE**

- Configured source-bound LayoutProgram: `X4_REFERENCE_ROOT=F:\\Downskies\\x4unpackersuiteV1\\X4 unpacked 9.00`
  with `tsx src/lib/x4UiLayoutProgram.selftest.ts` exits `0`, `706/706`, zero skipped. Its named regression proves
  exactly three string entries and consumed preview-only values while number/boolean/`C.*`/`Helper.*` calls remain
  absent.
- EditorSession exits `0` at `8/8`; canonical color matrix exits `0` at `7/7`. Exact-path ESLint for all three changed
  code/test files, whole-repository TypeScript, and changed-path `git diff --check` all exit `0`.
- Strict configured Scene exits `0` at `176/176` and executes `MENU,HUB,COMM = 3/3`. MENU explicitly accounts for its
  newly eligible dynamic strings (`22` supplied, `10` consumed, `12` not consumed; `66/27` operations; `207` paint
  commands / `169` diagnostics). HUB remains `9/7/2`, `18/11`, `70/39`. COMM is `4/4/0`, `14/12`, and now reaches
  `3` widgets / `5` texts / `52` glyphs / `104` paint commands / `38` diagnostics. The deterministic font fixture has
  `outer=16`, so its exact title rectangle is `1298x16 @ 32,27`; this is fixture evidence, not a live-font claim.
- A separate read-only public-session diagnostic loaded the configured corpus from the installed sidecar at manifest
  generation `1785035333079-2178b4c31f`: Helper `D24A08B8...D4DF2`, widget
  `420AFBA3...A72ED1`, regular descriptor `2E7D49EE...F7598`, and actual Zekton `outer=52`. Against the exact COMM
  source SHA `88FAB05A...63511`, the unprovided projection remains `0` widgets. Supplying only the issued title yields
  `3` widgets / `5` texts / `52` glyphs, title `1298x22 @ 32,27`, DOSSIER `279x25 @ 1332,27`, and END
  `279x25 @ 1613,27`, with no height-category gap and `Not verified in game` intact. This reconciles the apparent
  `16` versus `22` difference as deterministic fixture metrics versus the selected shipped descriptor.
- The source Lua remains byte-identical at `88FAB05A79EF33CB28E098081EA6A5E29E8F3B7C4150C39BF38913C51C063511`;
  its repository remains clean at `4c0a422b7e3d0f492b572b9da8d2d7ea19a2b453`; X4 remains absent.
- Graphify rebuilt to `10,172` nodes / `25,586` edges / `329` communities. Its private-helper reverse query returned
  no direct affected nodes, so the accepted blast boundary comes from the explicit `collect()` caller inspection and
  behavior suites. Optional `reviewctl`, its project ruleset, and the referenced standalone BlastRadius tool are not
  installed; they are not project acceptance gates and were not represented as executed.
- Complete `npm run precommit:check` exits `0`: verdict `55/55`, Vite lifecycle, product-copy guard, writer
  `15/15 + 8/8`, capability `12 / 297 / 11`, MCP capability recovery, action receipts `82 routes / 57 surfaces`,
  TypeScript, and final `[precommit] OK` all pass.

**REVIEW / CLOSE / AAR**

- Acceptance items 1-5 are done and evidenced. Fresh-eyes review required one comment-only correction to state the
  opaque authority boundary explicitly; the same native Luna worker made it, reran ESLint/TypeScript/diff hygiene,
  returned `VERIFIED`, and was closed with terminal status. No behavioral reimplementation was required.
- The current COMM title and both buttons are now source-faithfully projectable through the real configured corpus,
  but the whole menu still has secondary analysis/data-flow/table/cell gaps and no new installed-host or X4 comparison.
  **Bounded-unit status: `VERIFIED`; overall B119: `IN_PROGRESS / PARTIAL / Not verified in game`.** No capability-map
  delta and no OpenVSX claim. The next bounded unit is package/install/native Forge preview proof for this exact commit,
  followed by a separately controlled deploy/X4 comparison.
- **AAR:** sustain an unsupplied causal baseline, exact sample authority, a supplied positive projection, and a real
  corpus replay distinct from deterministic fixtures. Improve the ad-hoc diagnostic harness: a `.cmd -e` quoting
  attempt, a top-level-await attempt, and one stale result-shape read failed without writes before direct Node + an
  async wrapper + `statusIdentity` produced the accepted receipt. Tooling lacks the optional review scanner and its
  rules, while Graphify cannot derive a useful reverse edge for this private helper. Highest-risk observed weakness is
  confusing a fixture-font rectangle with selected-corpus geometry; retain both values and their provenance instead
  of normalizing one away. Project lesson card 27 is banked at
  `F:\\StarForge\\wiki\\x4-modding-methods\\07 UI (Lua widgets, menus, overlays)\\ui-modding-gotchas-quick-reference.md`,
  SHA-256 `29FA2A9EC7F1C2F577686490A5EF586197D911604A76BE70D10F0237AA56A86D`.

**DURABLE SYNC**

- Source checkpoint `817490d9234305b86754ecedb08eea0cd149d5e7` has exact local, tracking, and direct-remote
  parity. GitHub #41 comment `5521085100` was written and read back; the owner issue remains open.
- Notion owner `3b84618e-d15b-8190-821e-c0eb96f43d5a` was updated in place and read back with the exact checkpoint,
  `Status=In Progress`, and `Evidence Grade=Partial`.
- Google Current Status document `17VLaIsT499KHg7zg30hOyLaBXB0-9jlrX3dQ63s3dtE`, tab `t.0`, was appended under a
  required-revision guard and read back at revision
  `ANLCKQlD-Zec95PyKUeZzzv92wc_HokmnRBmXgZ3FQrC5iXutq3uRlOu477v3JMUURoZgVWazRF8XGKfwndWAfjB8RiXkeMBYKJW1RfA_zLa`.
  Its checkpoint is exactly one `HEADING_2` plus seven `NORMAL_TEXT` paragraphs.

### BOUNDED UNIT — PACKAGE AND INSTALL OPAQUE-TEXT CANDIDATE (`VERIFIED`)

**PLAN / BASELINE / RECONCILE**

- **Bounded unit:** build the current Forge application, stage the existing extension owner, create and inspect one
  uniquely named `0.0.70` VSIX containing source checkpoint `817490d`, back up the currently installed extension,
  replace it through Antigravity's native extension installer after a graceful IDE close, and prove installed critical
  bytes plus a fresh packaged sidecar. This unit installs the renderer change; visual current-COMM interaction is the
  immediately following unit.
- **Repository baseline:** `HEAD == origin/main == direct remote main ==
  bb68a349fbf58f986d706335dc8ade2210dea3c8`. The broad unrelated dirty tree is preserved. Existing dirty extension
  release metadata is an established immutable package input, not owned work: `package.json F9B7E29C...B50F9`,
  `.vscodeignore 73FE7207...557AF`, `CHANGELOG.md F6B9D2CC...1CE2`, `README.md 3C116430...155A`, and
  `release-notes.json A04841EF...2FCA7`.
- **Runtime baseline:** Antigravity is open; X4 is absent. Installed extension
  `C:\\Users\\Moshi\\.antigravity-ide\\extensions\\x4forge.x4-forge-studio-0.0.70` contains `2,106` files /
  `71,583,645` bytes with local manifest SHA-256 `AA79D995...75578`. Its sidecar is PID `21300` on
  `127.0.0.1:61112`; installed `out/extension.js` is `142,926` bytes / `3DA7E84B...B367` and
  `app/dist/server.cjs` is `3,602,516` bytes / `868D04E9...8844`.
- **Existing infrastructure reused:** root production build; extension `build`, `stage-app`, `probe-app`, `package`, and
  `inspect-package` scripts; the existing `x4forge.x4-forge-studio-0.0.70` install owner; native IDE install command;
  sidecar discovery manifest; and prior exact critical-file comparison procedure. Graphify has no useful packaging
  owner traversal because packaging is script/manifest driven; direct script and prior receipt inspection is the
  authoritative reconciliation path. No capability-map delta.
- **In scope:** generated build/stage/package bytes, a uniquely named untracked VSIX, one complete temporary backup,
  graceful Antigravity close/relaunch, native same-version replacement, installed/package critical-byte parity, and
  read-only runtime/workspace/source checks.
- **Out of scope:** edits or staging of release metadata, source mod/workspace/build/game content, deploy, X4 launch,
  OpenVSX/Marketplace publication, version bump, release claim, or visual/game verification.
- **Risk / rollback:** an interrupted same-version install could leave the Forge extension missing or partial. Close
  Antigravity before replacement, retain a byte-complete backup, and restore that exact directory or reinstall the
  previously reviewed workspace-authority VSIX if any install/start/parity gate fails. User editor state is left to
  Antigravity's graceful `CloseMainWindow()` path; no force-kill is an accepted normal close.

**ACCEPTANCE CONTRACT**

1. Root production build, extension build, stage, staged-app probe, package inspection, and inspector selftest pass.
   The unique candidate is named `x4-forge-studio-0.0.70-b119-opaque-text-bb68a34.vsix`; no existing VSIX is
   overwritten and no package/release source file is modified.
2. Record candidate byte count, SHA-256, entry count, unpacked bytes, version/publisher, and hashes for
   `out/extension.js`, `out/sidecar-supervisor.js`, `app/dist/index.html`, `app/dist/server.cjs`, and the emitted
   frontend JS/CSS assets. Package inspection must reject secrets, source maps, traversal, duplicates, oversized
   entries, and embedded first-party machine paths through its existing fail-closed checks.
3. Before replacement, copy the exact installed extension to a unique temporary backup and prove equal file count,
   byte count, and deterministic manifest hash. Resolve both absolute paths before any recursive operation.
4. Antigravity must close gracefully before native install. The installer must return success; a fresh IDE process and
   sidecar must start from the installed `0.0.70` path. Installed critical files must exactly match the inspected
   package extraction, allowing only the IDE-owned `__metadata` package-field delta already established by prior
   receipts.
5. Negative/containment proof: if install or startup fails, restore the backup before continuing. The persisted AI and
   Pipeline workspace files, configured source mod, loose build, and deployed game extension remain byte-identical;
   X4 remains absent. The unrelated repository dirty set remains unstaged and preserved.
6. Successful package/install closes this bounded unit as `VERIFIED` only for installed byte/runtime authority. Every
   preview remains `Not verified in game`; current-COMM rendered interaction and native X4 remain separate required
   gates, and no OpenVSX publication is implied.

Status at plan time: `SPECIFIED`. Evidence is recorded below, in `BACKLOG.md`, and in `SESSION-HANDOFF.md`; the VSIX
and temporary backup are rollback/evidence artifacts and remain untracked.

**IMPLEMENT / VALIDATE**

- The first host build on `F:` completed the root production build (`1,848` modules), extension build, staging,
  staged-app probe (`16/16`), and VSIX-inspector selftest (`13/13`). Packaging under the default Node `24.15.0`
  then returned `UNKNOWN: unknown error, read`. The resulting `19,199,782`-byte file
  `F:\DEV_ENV\X4_Forge\vscode-extension\x4-forge-studio-0.0.70-b119-opaque-text-bb68a34.vsix`
  (`0EA1CB338D408B345B358DABF7C9F4703FC6BAEBF63F6A05F668C03B20DA9BD0`) is a rejected partial: the inspector
  proves that it has no ZIP end-of-central-directory record. It was never installed or published.
- At the same failure boundary Windows reproduced a storage-layer fault: Disk 1 `ST4000DM004-2CV104`, serial
  `ZFN1XGQH`, was surprise-removed (System event `157`), with I/O retries (`153`), paging errors (`51`), and NTFS
  event `140` failing to flush the `F:` transaction log because the device no longer existed. `F:` disappeared from
  PowerShell, then returned. No further build/package write was trusted on that volume.
- Recovery used isolated exact clone
  `C:\Users\Moshi\AppData\Local\Temp\x4forge-b119-recovery-bb68a34-20260903-0230` at
  `bb68a349fbf58f986d706335dc8ade2210dea3c8`. The five pre-existing dirty package/release inputs were copied with
  the pinned hashes above; installed media supplied the unchanged sixteen media assets. Under bundled Node `24.19.0`,
  root dependency install, extension dependency install, root production build (`1,848` modules), extension build,
  stage, configured-corpus staged probe (`16/16`), and inspector selftest (`13/13`) all passed.
- Controlled packaging on `C:` produced
  `C:\Users\Moshi\AppData\Local\Temp\x4forge-b119-recovery-bb68a34-20260903-0230\vscode-extension\x4-forge-studio-0.0.70-b119-opaque-text-bb68a34.vsix`:
  `26,288,744` bytes, SHA-256 `B4CB6BAE032BDBAEFA9CE4451A35EDF3293015C99CF46DF4E66DFF7B7FE19C98`.
  Fail-closed inspection passes with `2,107` ZIP entries / `71,587,579` unpacked bytes and identity
  `x4forge.x4-forge-studio@0.0.70`.
- The installed baseline was copied to
  `C:\Users\Moshi\AppData\Local\Temp\x4forge-b119-opaque-install-backup-20260903-0240`; source and backup each
  contain `2,106` files / `71,583,645` bytes and deterministic manifest
  `AA79D99569D091331174A7EBF34ABE9F1FBC2CD4A72F6D452A2CFD20DA875578`. Antigravity accepted a graceful main-window
  close and left zero IDE/sidecar processes before replacement.
- Calling the GUI executable with `--install-extension --force` returned exit `0` but only relaunched Antigravity and
  left the old frontend installed. This is retained as a false-success negative. After another graceful close, the
  IDE's actual Electron CLI owner (`resources\app\out\cli.js`, `ELECTRON_RUN_AS_NODE=1`) returned exit `0` and
  replaced the same-version extension. Package-versus-install comparison found zero payload mismatches: the installed
  tree has the package payload plus only IDE-owned `.vsixmanifest`, and installed `package.json` differs only by the
  IDE-owned `__metadata` field.
- Current installed critical receipts are exact: `out/extension.js` `142,926` /
  `3DA7E84BC00E0EB2808524DE0934196117604FDE31BF7ED03E641004F819B367`; `out/sidecar-supervisor.js` `4,512` /
  `436D6BC63DC72D79B8F4A811DE7C8EE8D3EA4532A6280D010504E451F714FAC9`; `app/dist/index.html` `519` /
  `DE2083577093396F0B4D52E78FB55097E219B907C0A249A8A3B3895B5AB9C536`; `app/dist/server.cjs` `3,602,516` /
  `868D04E91367ABE05CE68DC215E665F5AC66E98D8267D0926CC2BB0C02EB8844`; JS `2,713,326` /
  `1D83DD88A4B90FA998C61829D1816365F2BDEFE4754F7E203DEBFE066D973CA0`; CSS `161,052` /
  `2E442EBF0DC7CC7381FAAC208B1F58D6716B0E18D48E941A48136CF487781F08`.
- A fresh visible Antigravity PID `54088` activated the installed extension and a managed sidecar PID `47500` from
  the installed `0.0.70` path on `127.0.0.1:52236`. After a stability interval the root returned `200`, configured
  reference status returned `200`, unauthenticated schema config correctly returned `401`, and served JS/CSS bytes
  exactly matched the inspected package hashes above. The initial post-install relaunch had ended without a crash or
  extension error after logging `sidecar ready`; a second controlled relaunch therefore owns the accepted live proof.
- Persisted workspace containment is exact: AI workspace `12,774,311` /
  `D2E3E6570D61C376F70808880AAF7220AC3EFC42405AA5BC1847D97D437F5E05`; Pipeline workspace `8,477` /
  `18A3C6507C33967F77A723CA8854D6F855192FD61AC657D71D3DA3353DC69FBC`. X4 remained absent. No source mod,
  loose build, game extension, release service, or OpenVSX surface was written.

**REVIEW / CLOSE / AAR**

- Requirements `1-6` are done and evidenced for packaging, rollback, installed bytes, live sidecar authority, endpoint
  behavior, and containment. The unit closes `VERIFIED`; it does not prove the current COMM canvas, deploy identity,
  native X4 rendering, pixel parity, full Helper/widget coverage, original-brief completion, or release acceptance.
  Overall B119 remains `IN_PROGRESS / PARTIAL / Not verified in game`.
- Sustain: fail-closed package inspection, exact backup manifests, and served-asset hashes prevented both the truncated
  archive and the GUI install command's false exit-0 from becoming false success.
- Improve work/approach: the first package attempt should have used the pinned bundled Node and a non-`F:` staging
  volume once disk instability had been observed. Recovery did so without changing source or acceptance.
- Improve tools: the IDE GUI executable treats extension-install arguments as a normal app launch; installed-product
  automation must call its Electron CLI owner and then compare package payload to installed bytes.
- Highest-risk evidenced weakness: the `F:` disk can disappear during sustained reads, including an NTFS transaction
  log flush. Source checkpoint `bb68a34` is already on the direct remote and all package/install work is recoverable on
  `C:`; avoid heavy build/package writes on `F:` until the storage path is independently stable.
- AAR triggers: package read failure, surprise removal, one invalid archive, one false-success installer path, one
  PowerShell probe syntax correction, and one initial relaunch that ended before HTTP capture. No capability-map delta.
  Suggested commit title: `docs(ui-editor): record installed opaque preview candidate`.

## 2026-09-03 CONTINUATION — current COMM source through Forge and X4

### PLAN / BASELINE / RECONCILE

- **Bounded unit:** use the installed `817490d` renderer candidate against the current configured AI Influence COMM
  source, supply only its owner-issued opaque title sample, export the mounted native Forge bitmap at the exact X4
  drawable/effective-scale profile, deploy the unchanged source through Forge, and compare the shared static controls
  with the same source visibly running in X4.
- **Baseline:** repository `HEAD == origin/main == 667514ffd5a7348fe19d596b2d0944213217d51b`; the broad unrelated dirty
  tree and empty index were preserved. Installed Antigravity sidecar PID `47500` served the reviewed package on
  `127.0.0.1:52236`; X4 was absent. Current source and game-target `aic_comm.lua` were both `27,481` bytes / SHA-256
  `88FAB05A79EF33CB28E098081EA6A5E29E8F3B7C4150C39BF38913C51C063511`.
- **Existing owners reused:** installed Source Editor selection/sample/profile authority, canonical Helper/widget/Zekton
  corpus, current-only PNG export, guarded Forge deploy/recovery, X4's real menu lifecycle, and the scoped debug log.
  No renderer, linter, parser, source, workspace, mod, or game code changed.
- **In scope:** exact installed-host source/target/profile identity, current PNG export, one guarded deploy of
  `x4_ai_influence`, native COMM open/expand/DOSSIER/close interaction, screenshot/hash retention, scoped failure
  search, and shared title/button geometry comparison.
- **Out of scope:** evaluating Lua in Forge, reconstructing runtime-generated COMM body rows, arbitrary frame
  acceptance, three-menu pixel parity, complete Helper/widget or keep-out coverage, AI Influence redesign, release
  acceptance, and OpenVSX.
- **Risk / rollback:** the game target was copied first to
  `C:\Users\Moshi\AppData\Local\Temp\x4_ai_influence-pre-b119-deploy-20260903-0800` (`126` files /
  `11,262,072` bytes). Forge recovery `deploy-mtl7qza7-20dfdc68d3e531ff` remains ready until
  `2026-09-10T07:38:23.647Z`; its before and expected-current fingerprint are both
  `a9046192c83c8b5c0a1304af96d64a43a203f5ee8ef5e34987583752884eb295`.
- **Acceptance:** the installed host must show exact current source/target/corpus/profile and `rendered/current`; PNG
  export must use that mounted canvas at `2544x1353`; Forge and game `aic_comm.lua` must remain byte-identical; X4 must
  render and accept a state transition plus close; owned frame/Lua failures must be zero; shared static control bounds
  must be measured without promoting the dynamic body or universal parity.

### VALIDATE

- Installed Antigravity selected exact
  `ui/addons/ai_influence_chat/aic_comm.lua -> comm.display`, source SHA-256 `88FAB05A...63511`, and supplied only
  `COMM CHANNEL    encrypted - Argon Prime` for the issued lines `505-506` opaque string. The Source Editor reported
  canonical corpus authority, profile `2544x1353 / user scale 1 / Effective Helper scale 1.2527777777777778`, native
  bitmap `2544x1353`, `rendered/current`, and permanent `Not verified in game`.
- `EXPORT CURRENT PNG` serialized the mounted current canvas to
  `dev-docs/b119-x4-ui-pipeline-smoke/source-editor-ingame-20260903/forge-current-comm-2544x1353-effective-scale-1.2527777777777778.png`:
  `96,514` bytes / SHA-256 `263A8F6AAC56C24B085288E84FBA6A0A362327F3207732DE36D18334B2BDC9CD`.
  It contains the source-static title, DOSSIER, and END controls; it does not invent the runtime-built body.
- Forge deploy operation `b119-deploy-1788421088734` targeted only the configured
  `G:\SteamLibrary\steamapps\common\X4 Foundations\extensions\x4_ai_influence`. History records `124` overwritten,
  `0` added, `0` deleted, `6` preserved, and a ready whole-tree recovery. Source and target COMM files remain exact at
  `27,481` / `88FAB05A...63511`; the source mod remains clean at `4c0a422b7e3d0f492b572b9da8d2d7ea19a2b453`.
- Fresh X4 9.00 used the vanilla conversation action `Speak to AI`, rendered the compact panel, expanded the exact
  COMM menu, accepted DOSSIER and transitioned to the hub, then accepted standard close and returned to gameplay. X4
  exited cleanly and its final process count is zero.
- Current debuglog contains two `onOpenCommLink` rows, one MENU `display DONE`, three COMM `ensureRegistered` rows,
  and one COMM `display DONE cite=nil`. Exact searches return zero `DisplayView(): Failed to set up the view`,
  `COMM FAILED`, `Lua traceback`, `Lua Error`, or `stack traceback`. X4 labels the mod's normal diagnostic writes
  `[=ERROR=]`; that prefix alone is not an owned failure.
- Retained X4 evidence:
  - baseline `241,572` / `EDFECA86DFE200D405560259DF8BEFF0C6BF92201A4DE2E3618B3635F8A392FA`
  - compact COMM `246,247` / `DF6ACEA4326DC4893A5A686218B67024A7A7B58EA4D8F707ADD009B58A89E475`
  - expanded COMM `220,033` / `E34DA6C63B2189BE1AF60960E04F14E6F8C1AA7A7AD86FFB0C527954A0D7500B`
  - DOSSIER/hub `313,121` / `45AC2DBA9CD174BB4889A1FF87FF75D9EF76A0F92FAC2208B081671B990F5649`
- The X4 window is `2546x1385`; removing its one-pixel side borders and 32-pixel title bar yields the exact
  `2544x1353` drawable. Forge title glyph bounds are `x=44..630, y=39..67`; X4 drawable bounds are approximately
  `x=39..628, y=37..65`. Forge button interiors are `x=1765..2134 / 2138..2507, y=33..63`; X4 is approximately
  `x=1769..2135 / 2142..2510, y=32..61`. Shared edges differ by at most `5` horizontal and `2` vertical pixels.
  Forge idle blue is RGB `[0,60,102]`; X4 idle blue is approximately `[0,57,102]`. X4's selected DOSSIER state is
  intentionally brighter and is not a color-parity failure.
- Focused mounted export E2E passed `1/1` in `1.3m` with the exact structured PASS receipt and lifecycle teardown.
  Ports `3100/3101` are stopped; installed sidecar `52236` remains live. Two fresh direct browser contexts correctly
  lacked the installed Studio workspace authority and were rejected as comparison clients; they did not change source.

### REVIEW / CLOSE / AAR

- **Done and evidenced:** installed current-source preview, exact native export, unchanged-source Forge deploy, real
  X4 frame acceptance, visible state transition and close, scoped zero-failure searches, and same-drawable static
  title/button geometry within the brief's few-pixel tolerance.
- **Partial:** the current COMM body is assembled from runtime values and branches that were not issued to the preview,
  so this is not a whole-menu pixel match. MENU/HUB/COMM three-menu wrap/truncation acceptance, complete vocabulary,
  all four keep-out contexts, AI Influence reference reconstruction, release acceptance, and OpenVSX remain open.
- **Status:** this bounded current-COMM source-to-game unit is `VERIFIED`; overall B119 remains
  `IN_PROGRESS / PARTIAL`. The preview continues to say `Not verified in game`; game evidence remains a separate
  deploy-bound authority.
- **AAR:** sustain exact current source/profile identity, one owner-issued sample, mounted native export, deploy hash,
  visible X4 interaction, and failure-signature search as separate evidence layers. Improve automation by using the
  trusted installed Studio client for workspace-bound comparisons; a fresh browser context is not equivalent. Tool
  retries included two rejected untrusted browser contexts, the Downloads known-folder lookup, one image-analysis
  shape error, and PowerShell collection/directory syntax corrections; none changed product or protected source.
- **Highest-risk evidenced weakness:** a faithful static header can look like proof of the dynamic menu. Keep missing
  runtime branches visibly absent, retain sample provenance, and require the running game for every experience claim.
  No capability-map delta: this strengthens the existing B119 source-preview/deploy capability.
- A temporary deploy credential is scoped to AI workspace deploy and expires after seven days. Its
  plaintext exists only in the temporary operator artifact used for this run; revocation/deletion remains a separately
  confirmed credential action rather than being hidden in document close.
- Suggested commit title: `docs(ui-editor): record current COMM game checkpoint`.

## 2026-09-06 CONTINUATION — B119 dogfood and `0.0.71` release checkpoint

### PLAN / BASELINE / RECONCILE

- **Bounded unit:** close the already-implemented linter-first editor and record the final AI Influence visual census
  and public `0.0.71` artifact boundary without reopening implementation or game writes.
- **Baseline:** Forge main pre-release `HEAD == origin/main == 1690898eda51c3caf6adb1252ac35b38368b8bc6`; the broad
  unrelated dirty tree remains preserved. X4 is not running for this documentation close. The final package and
  installed/runtime evidence are retained under the B119 visual-release record.
- **Reconciliation:** direct `x4UiLint` is `140/140`, including clean, warning, blocking `addTable(24)`, whole-frame,
  and conversation-close symptom coverage. The implementation is linter-first and source-backed; it does not claim
  universal Helper/widget parity, exact scale correlation, or universal Forge/X4 pixel equality.
- **Capability-map delta:** none. This checkpoint strengthens existing source-preview/linter evidence; no new
  demonstrated capability or cross-project lesson requires a map/workflow-ledger update.

### IMPLEMENT / VALIDATE

- No source, test, package, game, or workspace implementation changed in this documentation close. The final VSIX is
  `F:\DEV_ENV\X4_Forge\vscode-extension\x4-forge-studio-0.0.71.vsix`, `26,296,414` bytes, SHA-256
  `3143296C72B5A8B6A526148CA98048FA340FA534BB41A1D890F930DA69FB054B`; inspection passed with `2,107` archive
  entries / `2,105` extension payload files.
- The retained install backup is
  `C:\Users\Moshi\AppData\Local\Temp\x4forge-b119-0.0.71-final-install-backup-20260906T024434135Z` (`2,106`
  files / `71,618,336` bytes). Installed parity passed for all `2,105` packaged files, with only the expected IDE
  `.vsixmanifest` extra; normalized `package.json` and app JS/CSS/server identities match. Installed sidecar: port
  `56347`, PID `64300`, cwd the installed `0.0.71` app.
- Installed runtime oracle sweep passed `134/134` with `X4_FORGE_TIMEOUT_MS=90000`; serial E2E passed `106/106`, zero
  failed/flaky/bad/quarantined results, `treeGone=true`, and closed ports `3100/3101`; the live workspace remained
  unchanged. Production build passed `1,848` modules, stage/build and probe passed `16/16`, precommit passed, and
  Graphify refreshed to `10,396` nodes / `26,075` edges / `336` communities (HTML skipped above its size guard).
- Installed visual smoke rendered the Forge workbench and setup modal. The prior Pipeline Test Menu A canvas/export is
  current at `2560x1440`, but visible text-row/wrap overlap prevents a universal pixel-fidelity claim. The exact
  installed `x4 AiLive` `aic_menu.lua -> menu.display` path refused with
  `source-composition has no renderer-issued visible source geometry fill/border or canonical tinted glyph; visual
  diagnostics require an authoritative source operation`; export was disabled, source SHA-256 remained
  `4253D9BD9DE4113D4DE0B881DBF5A1E90CAA7B30F735BA925403EBEF7EC47DD7`, and preview remains `Not verified in game`.
- At `2026-09-06T06:59:36Z`, OpenVSX version `0.0.71` returned HTTP `200` and `/versions` contained `0.0.71`.
  Independent download from
  `https://open-vsx.org/api/x4forge/x4-forge-studio/0.0.71/file/x4forge.x4-forge-studio-0.0.71.vsix` was exactly
  `26,296,414` bytes with SHA-256
  `3143296C72B5A8B6A526148CA98048FA340FA534BB41A1D890F930DA69FB054B`, matching the local VSIX exactly. At
  `2026-09-06T07:08:17Z`, the registry `/latest` pointer also returned `0.0.71` with that same download URL. The
  earlier `0.0.70` result was transient indexing lag that resolved, not a publish failure; pointer convergence is now
  verified.

### REVIEW / CLOSE / AAR

- **Bounded release unit:** `VERIFIED` for publication, version-endpoint presence, independently downloaded public
  artifact parity, and the resolved `/latest` pointer readback.
- **Overall B119:** `PARTIAL / IN_PROGRESS`. Exact few-pixel parity across the required real menus, exact scale
  correlation beyond bounded fixtures, full AI Influence reference reconstruction/current in-game validation, and
  permanent `Not verified in game` preview semantics remain open. Historical `1b`/`1c`/`1d`/hub captures and the
  current census do not establish universal helper/widget parity; `1e` is not re-established through a valid current
  path and `1f` remains data-blocked.
- **AAR:** the documented false-red default oracle timeout, aborted/fast-failed E2E attempts, missed workspace-switch
  confirmation, command-policy rejection, same-version install lock/`EPERM` retries, stale-directory recovery, and
  Graphify HTML size guard, and corrected quoting-safe PowerShell whitespace/readback probes are retained as
  tool/approach triggers.
  Highest risk is a Forge source-composition receipt
  that can report current while its Canvas has zero visible pixels; the positive-geometry/refusal rule is a Forge
  preview rule, not a proven X4 engine behavior.
- **Durable close:** the AI Influence census, this checkpoint, UI gotcha cards, and X4 Forge AAR are the evidence
  records. No capability-map delta and no cross-project workflow AAR are recorded. Suggested commit title:
  `docs(ui-editor): close B119 dogfood and 0.0.71 parity`.

### EXTERNAL PROJECTION RECEIPT

- Source/release commit `981eb507811572e2daaadae6549490223f144266` was pushed with exact local, tracking, and
  direct-remote `refs/heads/main` parity.
- GitHub #41 comment `5557777386` was written and read back; the owner issue remains open with bounded release
  `VERIFIED` and overall B119 `PARTIAL / IN_PROGRESS` stated separately.
- Notion owner `3b84618e-d15b-8190-821e-c0eb96f43d5a` was updated in place and read back as
  `Status=In Progress / Evidence Grade=Partial`, with the exact checkpoint, public artifact hash, comment ID, and
  remaining AI parity gates.
- Google Current Status document `17VLaIsT499KHg7zg30hOyLaBXB0-9jlrX3dQ63s3dtE`, tab `t.0`, accepted five exact
  revision-guarded replacements and was read back at revision
  `ANLCKQmDhtrpnfO1W9qZ6MVOrOmzKfNGmkBKS448FRbrYxIfcMjuN05OKv67TGvna9Q-6vbzu18Dr6EPWABJ_-TCT1Z_EgF1orlcMRiEQjU-`.

## 2026-09-06 CONTINUATION — closed numeric `math.*` geometry for real AI Influence source

Task: B119 source-preview deterministic math geometry
Lane: FULL
Status: `IN_PROGRESS` (reconciled acceptance revised; review repair required)

### PLAN

- **Bounded unit:** extend the existing closed numeric-expression model so the exact current
  `ui/addons/ai_influence_chat/aic_menu.lua -> menu.display` source can preserve and resolve only deterministic
  `math.floor`, `math.ceil`, `math.min`, and `math.max` calls whose arguments are already closed numeric
  expressions. Re-run the same installed Forge source/profile comparison after focused and release-level validation.
- **Assumptions / unresolved facts:** X4's Lua/UI runtime remains authoritative. The source parser can prove the
  callee and argument structure, but menu-history rows, branch-selected text, `_useH`, and the resulting `ty` are
  runtime state and must remain explicitly absent or owner-sampled. C++ frame acceptance remains unknowable in the
  browser and is not promoted by this unit.
- **Authoritative references:** current AI Influence source SHA-256
  `4253D9BD9DE4113D4DE0B881DBF5A1E90CAA7B30F735BA925403EBEF7EC47DD7`; configured canonical unpacked corpus
  generation `1788680993999-6fc9cf04ab`; the existing `x4UiCallModel` closed expression grammar; exact source-AST
  checks in `x4UiLayoutProgram`; and the current 2560x1440 / X4 user scale 1.05 / effective Helper scale 1.4 profile.
- **In scope:** exact descriptors, source validation, schema/evidence serialization, deterministic resolution,
  immutability, preservation of closed numeric provenance when read from an exact source-owned tracked table field,
  focused negative tests, and the real-source/profile probe plus installed rendered-host inspection.
- **Out of scope:** arbitrary Lua execution; arbitrary `math` functions; random/time/runtime calls; trig; user-defined
  callees; inferring menu rows or branch text; sample-alias redesign; AI Influence source/game mutation; deployment;
  universal Helper/widget/C++ parity; and completion of the twelve-reference benchmark.
- **Affected implementation surfaces:** `src/lib/x4UiCallModel.ts`, `src/lib/x4UiLayoutProgram.ts`, and their focused
  selftests. A preview-pipeline selftest may change only if needed to prove the public source/profile contract. UI,
  server, package/release, corpus, workspace, mod, and game files are forbidden in this unit.
- **Risks / authorization boundaries:** accepting an unproven callee or forged descriptor would turn source evidence
  into invented geometry. Resolution must reject malformed, non-finite, zero-argument, unsupported, or cross-source
  structures. No mod/game/settings bytes are written. Rollback is a path-limited revert of only the worker-owned files.
- **Acceptance criteria (revised after real-source reconciliation):**
  1. Exact source/profile projection automatically resolves `px=600` and `tw=1050`; those values no longer appear in
     the opaque sample catalog. `_choiceY` remains an explicit sample in this bounded unit because the final source
     binding is conditionally reassigned; `979` is only the no-pending-action path value, not a universal source fact.
  2. The frame remains source/profile resolved at `x=0`, `y=0`, `width=2560`, `height=1440`, `layer=4`.
  3. Runtime-dependent `_choiceY`, `_useH`, `ty`, branch text, and rows remain explicit partial/sample state; no content
     is invented. A later path-sensitive unit may remove the `_choiceY` sample only after Forge can select and prove an
     implicit false arm for the exact source conditional.
  4. Forged or cross-source descriptors, wrong callees, unsupported functions, zero-argument min/max, malformed arity,
     and non-finite results reject or remain unavailable without false success.
  5. Descriptor schema, evidence JSON, canonical ordering, and deep-freeze behavior are covered and deterministic.
  6. Focused call-model/layout tests, typecheck, owned-path lint, real-source public probe, full oracle/e2e/build/package
     gates required by an eventual installed update, and negative lifecycle checks pass.
  7. The updated installed Forge visually exposes more source-static menu structure with only genuinely runtime values
     sampled, while retaining `Not verified in game`. No game proof is claimed from the preview.
- **Evidence locations:** focused command receipts in this record; installed Forge screenshots under
  `dev-docs/b119-x4-ui-pipeline-smoke/`; release evidence only after all source gates pass.

### BASELINE / RECONCILE

- **Revision / worktree:** `HEAD == origin/main == 596ef0c79ac3c574ed1ca1af96840705388e24c2`; the broad unrelated
  modified/untracked tree and empty intended-code diff are preserved. X4 is stopped; installed Forge `0.0.71` is live
  on sidecar port `56347` with the configured `x4 AiLive` workspace and canonical corpus.
- **Reproduced visible baseline:** the installed editor can be made `rendered/current`, but the real full canvas is
  predominantly black and exposes only the bottom input plus `SEND` / `END` controls. That is nonzero geometry, not a
  useful whole-menu render and not game proof.
- **Correction to the prior diagnosis:** the frame call is already exact and source/profile resolved. Its 2560x1440
  geometry is not the current blocker. The missing static plate/choice geometry comes from safe deterministic
  `math.floor(...)` expressions becoming opaque values.
- **Existing capability reused:** literals, Helper view constants, `or`, unary/binary arithmetic, grouping, direct
  Helper scale calls, exact source ranges, AST validation, source/profile evidence, and resolver/schema machinery
  already exist. This unit extends that owner rather than adding another evaluator or parser.
- **Plan change after implementation reconciliation:** the exact `LAY.plateL` / `LAY.plateR` reads showed that the
  call model also discards an already-closed numeric descriptor when reading a source-owned tracked table field. That
  preservation is necessary for the documented real-source acceptance, so it is included in the same bounded owner.
  Dynamic/reassigned/unknown table fields remain unavailable, and negative tests must reject provenance that is not
  tied to the exact source-owned field read.
- **Second plan change after the real-source probe:** `tw = floor(vw * (plateR - plateL)) = 1050` and
  `px = floor(vw * plateL) = 600` are unconditional source/profile facts. `_choiceY` starts as
  `floor(vh * 0.68) = 979` but line 492 conditionally subtracts `Helper.scaleY(150)` when
  `menu._pendingAction` is true. The existing path catalog exposes only the explicit `then` arm and cannot select the
  implicit false arm, so the post-branch use must remain sampled. The prior universal-979 acceptance was incorrect and
  is withdrawn rather than weakening control-flow invalidation.
- **Fresh-eyes review repair contract:** reproduced counterexamples must reject source-overridden global `math` or
  `math.<function>`; reject a numeric source table that escaped through an opaque call before its field read; preserve
  the original alias when another name copies the same descriptor; accept parser-valid whitespace/comments around the
  exact global math member; and make the non-finite regression assert the affected frame fact rather than a nonexistent
  cell. These repairs remain within the same four owned source/selftest files.
- **Second fresh-eyes repair contract:** a same-file local helper currently returns through the call model's early
  local-invocation branch before numeric literal-table arguments are marked escaped. The layout projector independently
  rejects `mutate(LAY)` before `LAY.plateL`, so rendered geometry is fail-closed, but the public call model still reports
  the resulting alias as static and the linter consumes static call values directly. A second counterexample wraps the
  same object as `{ lay = LAY }`; `mutate(wrapper)` currently leaves both the call model and projected frame at the false
  known value `23`, because escape tracking does not traverse reachable tracked literal objects. Implicit array fields
  (`{ LAY }`), nested arrays, and dynamic-key fields (`{ [runtimeKey] = LAY }`) reproduce the same false render; the
  evaluator currently evaluates those child values but discards their reachability when no static field name exists.
  A post-construction `wrapper[runtimeKey] = LAY` assignment reproduces it as well, including when the wrapper also has
  a self-cycle.
  The call model must therefore taint numeric literal-table arguments and every reachable source-object descendant,
  including unnamed or dynamically keyed constructor and assignment values, before returning from an unexpanded
  local-helper or opaque invocation. Traversal must be cycle-safe. A call after the field read must not retroactively
  invalidate the earlier value, and the known menu lifecycle layer must remain intact.
- **Third fresh-eyes repair contract:** review of the recursive candidate found three remaining authority bypasses.
  Snapshot traversal records each object's private reachable edges but does not visit descendants that exist only on
  those edges; control-flow restore must traverse them. A numeric table with an ordinary `name` field is classified as
  a menu and therefore remains falsely known when escaped through a wrapper; menu lifecycle preservation must be tied
  to exact safe lifecycle call context rather than exempting every menu-shaped object from mutation authority. Finally,
  the exact-global `math` proof detects direct `math` writes but not explicit aliases through `_G`: opaque
  `mutate(math)`, `rawset(_G, "math", ...)`, `rawset(_G.math, "floor", ...)`, `_G.math.floor = ...`, and
  `_G["math"]["floor"] = ...` all currently leave a falsely known projected result. Exact source-visible global-math
  replacement or escape before use must invalidate later math descriptors. Follow-up probes reproduce the same false
  known result for `mutate(_G)`, a wrapper carrying `_G`, `local m = math; m.floor = ...`,
  `local g = _G; g.math.floor = ...`, and `_G[runtimeKey] = ...`; direct `math[runtimeKey] = ...` already fails closed.
  Exact aliases, wrappers, and dynamic global keys therefore belong to the same private authority model. The same
  operations after use must not invalidate an earlier fact. This does not claim protection against invisible external
  runtime monkey-patching with no source-visible authority path.
- **Fourth fresh-eyes repair contract:** coordinator validation of the third candidate reproduced four related
  source-visible global-read bypasses. `rawget(_G, "math")`, `rawget(g, "math")` after `g = _G`, `_G[runtimeKey]`,
  and `rawget(_G, runtimeKey)` can each yield the real math table, but the returned value currently loses private
  authority identity. Mutating `.floor` through that value before `math.floor(1.5)` therefore leaves a falsely static
  result of `1`; the direct `_G[runtimeKey].floor = ...` form reproduces the same defect. Exact or possibly-math reads
  from a source-proven global-environment value must retain private math authority through aliases and wrappers until
  mutation or opaque escape, while static non-math reads and pure reads remain usable. The same false-known result is
  reproduced when math or `_G` is stored in an implicit array field, dynamically keyed wrapper field, or numeric
  post-construction assignment and then read back before mutation; named `w.m` already fails closed. Authority-bearing
  unnamed/indexed wrapper reads therefore belong to this same repair, including nested wrapper reachability. Exact
  unshadowed `rawget(w, "m")` / `rawget(w, 1)` over authority-bearing wrappers reproduce the same loss and must preserve
  private authority without turning ordinary static non-authority reads into math. Conditional aliases also reproduce
  the defect when a binding may become math, may cease being math, or is formed by
  `runtimeCondition and math or {}` and is then mutated after the merge. Control-flow reconciliation must retain
  conservative possible-math identity across those source-visible paths. Preserve exact
  `rawget(_G, "Helper")`, source-order after-use controls, and the nineteen-sample real-source result. This repair is
  required before broad gates or release.
- **Capability-map delta:** none at specification time; this is a fidelity repair within the existing B119 capability.
- **Negative baseline / AAR triggers:** nested-scroll clipping initially captured the linter instead of the canvas;
  browser download capture timed out; sanitized DOM inspection could not call `canvas.toDataURL`; and the earlier frame
  diagnosis was stale. These are evidence/tooling failures to retain in the close even if the repair succeeds.

### IMPLEMENT / VALIDATE / REVIEW / CLOSE / AAR

- First Luna pass added closed `floor` / `ceil` / `min` / `max` descriptors plus source-owned table-field provenance.
  Focused call-model `94/94`, layout `713 passed / 1 skipped`, typecheck, and owned-path lint passed after one owned
  TypeScript narrowing repair. The real-source probe resolved frame `0/0/2560/1440/layer4`, `px=600`, and `tw=1050`.
- The first review-forced repair closed all five causal counterexamples, then passed call-model `97/97`, layout
  `718 passed / 1 skipped`, typecheck, owned-path lint, diff hygiene, and the exact real-source probe. That probe retains
  `_choiceY` as a sample and reports nineteen runtime-state samples total. It also caught and repaired an over-broad
  escape rule that had invalidated the normal `menu.layer` lifecycle.
- Coordinator review then reproduced one narrower remaining defect: `local function mutate(t) ...; mutate(LAY)` leaves
  the call-model alias static even though the layout projector correctly makes frame geometry unavailable. A
  source-order control with the call after the read remains known, and conditional `math.floor` replacement before the
  read is likewise rejected by the projector. Nested-wrapper probes then reproduced a stronger false-render case:
  `local wrapper = { lay = LAY }; mutate(wrapper)` remains projected with known frame `x=23` for both an opaque global
  callee and a same-file local helper. A direct alias argument is already rejected, proving the missing boundary is
  reachable-object traversal rather than alias ownership. Follow-up probes reproduced the same false known render for
  `{ LAY }`, `{{ LAY }}`, and `{ [runtimeKey] = LAY }`; the latter already emits a dynamic-key verification gap but still
  promotes the later geometry. `wrapper[runtimeKey] = LAY; wrapper.self = wrapper; mutate(wrapper)` reproduces the same
  false projection, establishing both post-construction reachability and cycle-safety requirements. The public-model/
  linter mismatch and false projected geometry require the second bounded repair above.
- The recursive repair then passed call-model `99/99`, layout `719 passed / 1 skipped`, typecheck, exact lint, diff
  hygiene, and the real-source `px=600` / `tw=1050` / nineteen-sample probe. Independent review did not accept that
  intermediate green state: it reproduced known frame `x=23` through a wrapped numeric table carrying a normal `name`
  field, found missing reachable-edge snapshot traversal, and reproduced known frame `x=1` after all five explicit
  `_G`/global-math mutation forms listed in the third repair contract (the already-supported
  `rawset(math, "floor", ...)` control alone failed closed). Alias/global-table follow-ups listed in that contract also
  reproduced false known output; direct dynamic `math[...]` is the positive rejection control. The third repair is
  complete at call-model `101/101`, layout `720 passed / 1 skipped`, typecheck, exact lint, diff hygiene, and the exact
  real-source `px=600` / `tw=1050` / one `_choiceY` sample / nineteen-total-samples probe. Independent coordinator
  replay confirmed those counts and the linter remained `140/140`, but fresh-eyes review then reproduced all four
  global-read authority bypasses in the fourth contract above.
- The fourth repair is now complete. It retains exact and possible `math` / `_G` authority through direct and aliased
  `rawget`, implicit and nested table slots, dynamic-key wrappers, numeric assignments, opaque/local-helper escape,
  conditional merges, and logical selection. Numeric and string table keys remain distinct and overwrite order remains
  source-ordered. Pure reads, static non-math reads, exact `rawget(_G, "Helper")`, menu lifecycle layer `4`, and
  post-use mutation controls remain known. The exact worker gates passed at call-model `102/102`, layout
  `721 passed / 1 skipped / 722 total`, project typecheck, exact four-file ESLint, and exact diff hygiene.
- Independent coordinator validation replayed the original fifteen false-known mutations and confirmed all fifteen now
  return non-static geometry with no trusted math descriptor. Four pure-read/non-math/Helper controls and one post-use
  control remain static `1` with a `math-call` descriptor. Independent focused gates also passed at call-model
  `102/102`, layout `721 passed / 1 skipped`, linter `140/140`, typecheck, exact lint, and diff hygiene. The exact current
  `aic_menu.lua -> menu.display` probe remains `parsed=true`, `projection=partial`, `px=600`, `tw=1050`, one
  `_choiceY` sample, and nineteen samples total.
- Broad oracle/e2e/build/package gates, installed Forge rendered-host inspection, and any later game comparison are
  still pending. No package, install, or release is claimed from this checkpoint. Overall B119 remains
  `PARTIAL / IN_PROGRESS / Not verified in game`.

### 2026-09-06 broad-gate and release checkpoint

- The isolated oracle wrapper passed `134/134` on port `8972`; its process tree exited and the port closed. A prior
  direct `node scripts/oracle-sweep.mjs` invocation failed `0/133` because it requires a running API server; that is a
  reproduced command-precondition failure and an AAR trigger, not a product regression.
- The first full E2E invocation failed before test discovery with no structured report and Windows child exit
  `0xC0000409`; lifecycle cleanup still reported `treeGone=true`. An exact Playwright `--list` then discovered
  `106` tests in `24` files. The controlled serial retry passed `106/106`, zero failed/flaky/bad/quarantined results,
  from the authoritative JSON report in `test-results/e2e-verdict.json`, and closed ports `3100/3101`.
- The protected live mod workspace remained exact after E2E: excluding its non-deployable `.git` metadata, it is
  `127 files / 19 directories / 11,262,724 bytes /
  9B1A0021A22927D55168A8904C255CEDC630853DB02B07389A64742E269C0BEC`, and its Git worktree remains clean at
  `4c0a422b7e3d0f492b572b9da8d2d7ea19a2b453`.
- Production build passed `1,848` modules. `npm run precommit:check` passed canon mirrors, tripwires, E2E verdict
  `55/55`, Vite lifecycle, product-copy, durable writers, capability contract, MCP contract, action-receipt coverage
  (`82 routes / 57 surfaces`, manifest `396865ea4e877035d8f8c29607d9b5e22dd5ca891b420855b59efbf8087b23bb`),
  typecheck, and size guards.
- **Next bounded unit — public `0.0.72` release:** change only extension version/release metadata and its generated
  changelog; describe deterministic real-source `math.floor/ceil/min/max` geometry, fail-closed escaped/mutated math
  authority, and the retained `Not verified in game` boundary. Then run changelog, stage-app, extension build,
  `16/16` probe, stable VSIX package, secret/path scan, and independent artifact inspection/hash. Publish to OpenVSX
  before committing, verify remote version and downloaded-byte parity, install into Antigravity with a retained
  `0.0.71` rollback copy, and inspect the real rendered host. Release metadata must not claim in-game verification,
  pixel parity, arbitrary Lua execution, or completion of the twelve-reference benchmark.
- Overall B119 remains `PARTIAL / IN_PROGRESS / Not verified in game`; this checkpoint authorizes only release and
  installed-host validation of the bounded deterministic-math repair.

### 2026-09-06 deterministic-math `0.0.72` release close

#### IMPLEMENT / VALIDATE

- Release metadata was advanced only from `0.0.71` to `0.0.72`. The notes state the bounded capability: exact closed
  numeric `math.floor`, `math.ceil`, `math.min`, and `math.max` expressions can contribute source geometry; aliases,
  wrappers, dynamic global reads, control-flow merges, mutation, and opaque escape invalidate later math authority;
  runtime-dependent values remain preview-only samples. The notes retain `Not verified in game` and make no arbitrary
  Lua, universal Helper/widget/C++, pixel-parity, or twelve-reference-completion claim.
- Changelog generation passed with `60` versions and `0.0.72` newest. Production stage/build passed, the staged-app
  probe passed `16/16`, and stable VSIX packaging produced
  `vscode-extension/x4-forge-studio-0.0.72.vsix`: `2,107` archive entries, `2,105` extension payload files,
  `71,654,054` unpacked bytes, `26,303,425` archive bytes, SHA-256
  `5C6B2C20C42E93359DED03DBF199F00C1C858AFCC579388F10F94818CDDEA4B0`. Independent package inspection found no
  secret or machine-path leak.
- OpenVSX accepted one publication of `x4forge.x4-forge-studio` `0.0.72`. Initial direct-version readback returned
  `404` while indexing; no duplicate publish was attempted. At `2026-09-06T12:10Z`, `/latest` and the direct
  `0.0.72` endpoint both returned `0.0.72`. An independent public download to
  `C:\Users\Moshi\AppData\Local\Temp\x4forge-openvsx-0.0.72-20260906T081058030Z\x4forge.x4-forge-studio-0.0.72.vsix`
  was exactly `26,303,425` bytes with the same SHA-256, proving byte-for-byte public artifact parity.
- Installed Antigravity `0.0.71` was retained recoverably at
  `C:\Users\Moshi\AppData\Local\Temp\x4forge-b119-0.0.71-final-install-backup-20260906T024434135Z`. Antigravity was
  closed gracefully, the real Electron CLI installed `0.0.72`, and all `2,105` packaged payload files matched the
  installed extension exactly; the only extra was the expected IDE `.vsixmanifest`. Antigravity restarted visibly.
  Installed sidecar evidence was one supervisor plus one server, port `60966`, HTTP root `200`, exact configured
  corpus, and unauthenticated configuration `401`. Installed runtime oracles passed `134/134`.
- In the installed `0.0.72` editor, exact current source
  `ui/addons/ai_influence_chat/aic_menu.lua` at SHA-256
  `4253D9BD9DE4113D4DE0B881DBF5A1E90CAA7B30F735BA925403EBEF7EC47DD7` and target `menu.display` exposed exactly
  `19` owner-issued samples and `33` source branch boundaries. Before samples, source composition correctly refused
  because it had no authoritative visible source operation. The first ten supplied samples retained that refusal.
  Supplying the source-issued `_choiceY` sample as `979` after the preceding required geometry/text samples caused a
  deterministic transition to `rendered/current`, mounted one native `2560x1440` Canvas, and retained `Not verified
  in game`. Visual inspection found the source-defined edit box plus `SEND` and `END` controls at the low panel
  anchor; no unissued transcript, rail, or runtime-built choice content was invented.
- Retained installed visual evidence:
  `dev-docs/b119-ai-influence-dogfood/installed-release-20260906/installed-0.0.72-menu-display-sampled-current-2560x1440.png`,
  `45,676` bytes, SHA-256
  `5286095C6B16A15230D79F770B4FB6CD026B80BC08F59E32D215FC4AD37D6A8F`. An all-samples/all-branches stress probe
  later produced a refused successor while retaining the prior bitmap as `stale`, proving the current-only commit
  boundary rather than replacing it with misleading output. Both standard browser probes had zero page/console
  errors.
- No mod or game byte changed in this release unit. The same exact AI source hash already has retained X4 acceptance
  from the 2026-09-03 current-COMM checkpoint and the 2026-09-05 three-menu parity run, but those prior game receipts
  do not promote this new Forge preview to game truth. X4 was not relaunched for the parser-only release close.

#### REVIEW / CLOSE

- **Done and evidenced:** all four focused implementation suites and negative authority matrix; linter `140/140`;
  typecheck and exact lint; oracle `134/134`; serial E2E `106/106` with zero failed/flaky/bad/quarantined tests and
  `treeGone=true`; production build and complete precommit; stable package inspection; installed byte/runtime/UI
  proof; a positive source-composition bitmap caused by the exact issued sample boundary; OpenVSX version/latest and
  independently downloaded artifact parity.
- **Deliberately unchanged:** AI Influence source, workspace, deployed game extension, saves, corpus, game settings,
  renderer game-truth language, and all unrelated dirty paths. No capability-map delta: this strengthens the existing
  source-faithful preview owner without establishing a new universal engine capability.
- **Bounded status:** `VERIFIED` for deterministic-math authority, release `0.0.72`, installed rendered-host behavior,
  and public artifact parity. **Overall B119:** `IN_PROGRESS / PARTIAL`. The rendered current bitmap is a faithful
  static fragment, not the complete runtime menu; full twelve-reference AI Influence reconstruction/current-path game
  validation and universal Helper/widget/C++ acceptance remain open. Preview remains permanently `Not verified in
  game`.
- Suggested commit title: `feat(ui-editor): resolve source math geometry and publish 0.0.72`.

#### AAR

- **Sustain:** preserve exact source/profile identity, source-order authority invalidation, positive-pixel proof,
  package/install/public hashes, and game truth as separate evidence layers.
- **Improve work/approach:** the first all-samples/all-branches replay rebuilt the complete projection after every
  input and took several minutes. A causal replay that stopped at the first current bitmap identified `_choiceY` as
  the final required sample with less ambiguity. Do not interpret a retained stale bitmap as the latest render.
- **Improve tools:** a computer-use native-select wrapper could change the DOM selection without completing React's
  controlled event path, while ordinary Playwright selected the same exact option cleanly. The Electron installer
  also returned blank output despite a successful install, and the first process census counted the supervisor command
  line as a second server. Verify actual installed bytes, child topology, DOM state, and console errors instead of
  trusting wrapper return text. The first OpenVSX download command used unsupported `New-Item -LiteralPath`; the exact
  `-Path` retry succeeded.
- **Highest-risk evidenced weakness:** a believable static fragment can be mistaken for the whole runtime menu.
  Continue to expose every omitted sample/branch, preserve stale/refused states, and require exact clean deploy plus X4
  for each player-experience claim. Project-specific gotcha card `40` banks the source-visible math-authority lesson.
