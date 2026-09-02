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
