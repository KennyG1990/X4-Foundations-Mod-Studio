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
